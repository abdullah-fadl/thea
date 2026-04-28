import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import {
  createAdmissionRequestSchema,
  DEFAULT_CHECKLIST_ITEMS,
} from '@/lib/validation/admission.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Shape returned from admissionRequest stats query */
interface AdmissionRequestStatus {
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Shape of the fallback body fields when patient/doctor lookup fails */
interface AdmissionRequestBody {
  patientName?: string;
  mrn?: string;
  requestingDoctorName?: string;
  admittingDoctorName?: string;
}

/** Allergy snapshot for the admission request */
interface AllergySnapshot {
  allergen: string;
  reaction: string | null;
  severity: string | null;
}

/** Pending order snapshot */
interface PendingOrderSnapshot {
  kind: string;
  title: string;
  status: string;
}

// ─── GET /api/admission/requests ─────────────────────────────────────────────
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = req.nextUrl;
      const status = url.searchParams.get('status');
      const urgency = url.searchParams.get('urgency');
      const targetDepartment = url.searchParams.get('targetDepartment');
      const source = url.searchParams.get('source');
      const search = url.searchParams.get('search') || '';
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '50', 10)));

      const where: any = { tenantId };
      if (status && status !== 'ALL') where.status = status;
      if (urgency) where.urgency = urgency;
      if (targetDepartment) where.targetDepartment = targetDepartment;
      if (source) where.source = source;

      // Search by patient name or MRN
      if (search) {
        where.OR = [
          { patientName: { contains: search, mode: 'insensitive' } },
          { mrn: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [items, total] = await Promise.all([
        prisma.admissionRequest.findMany({
          where,
          orderBy: [
            { createdAt: 'desc' },
          ],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.admissionRequest.count({ where }),
      ]);

      // Compute stats: count by status
      const allForStats = await prisma.admissionRequest.findMany({
        where: { tenantId },
        select: { status: true, createdAt: true, updatedAt: true },
        take: 500,
      }) as AdmissionRequestStatus[];

      const statusCounts: Record<string, number> = {};
      let totalWaitMs = 0;
      let pendingCount = 0;
      const now = Date.now();

      for (const r of allForStats) {
        statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
        if (r.status !== 'ADMITTED' && r.status !== 'CANCELLED') {
          totalWaitMs += now - new Date(r.createdAt).getTime();
          pendingCount++;
        }
      }

      const avgWaitMinutes = pendingCount > 0 ? Math.round(totalWaitMs / pendingCount / 60000) : 0;

      return NextResponse.json({
        items,
        total,
        page,
        pageSize,
        stats: {
          byStatus: statusCounts,
          avgWaitMinutes,
          pendingCount,
        },
      });
    } catch (err) {
      logger.error('[admission/requests] GET error:', err);
      return NextResponse.json({ error: 'Failed to fetch admission requests' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.view' }
);

// ─── POST /api/admission/requests ────────────────────────────────────────────
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const body: AdmissionRequestBody = await req.json();
      const parsed = createAdmissionRequestSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const data = parsed.data;

      // 1. Lookup patient for name/MRN
      let patientName = '';
      let mrn = '';
      try {
        const patient = await prisma.patientMaster.findFirst({
          where: { tenantId, id: data.patientMasterId },
        });
        if (!patient) {
          return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
        }
        patientName = patient.fullName || patient.firstName || '';
        mrn = patient.mrn || '';
      } catch {
        // PatientMaster may not exist in Prisma yet — accept name from body
        patientName = body.patientName || '';
        mrn = body.mrn || '';
      }

      // 2. Lookup requesting doctor name
      let requestingDoctorName = '';
      try {
        const doc = await prisma.user.findFirst({
          where: { tenantId, id: data.requestingDoctorId },
        });
        requestingDoctorName =
          doc?.displayName ||
          `${doc?.firstName || ''} ${doc?.lastName || ''}`.trim() ||
          '';
      } catch {
        requestingDoctorName = body.requestingDoctorName || '';
      }

      // 3. Lookup admitting doctor name (if provided)
      let admittingDoctorName = '';
      if (data.admittingDoctorId) {
        try {
          const admDoc = await prisma.user.findFirst({
            where: { tenantId, id: data.admittingDoctorId },
          });
          admittingDoctorName =
            admDoc?.displayName ||
            `${admDoc?.firstName || ''} ${admDoc?.lastName || ''}`.trim() ||
            '';
        } catch {
          admittingDoctorName = body.admittingDoctorName || '';
        }
      }

      // 4. Snapshot patient allergies
      let allergies: AllergySnapshot[] = [];
      try {
        const patientAllergies = await prisma.patientAllergy.findMany({
          where: { tenantId, patientId: data.patientMasterId, status: 'active' },
        });
        allergies = patientAllergies.map((a) => ({
          allergen: a.allergen,
          reaction: a.reaction,
          severity: a.severity,
        }));
      } catch {
        // PatientAllergy may not be accessible — continue without
      }

      // 5. Copy pending orders from source encounter
      let pendingOrders: PendingOrderSnapshot[] = [];
      if (data.sourceEncounterId) {
        try {
          if (data.source === 'OPD') {
            const orders = await prisma.opdOrder.findMany({
              where: { tenantId, encounterCoreId: data.sourceEncounterId, status: 'ORDERED' },
              take: 50,
            });
            pendingOrders = orders.map((o) => ({
              kind: o.kind || o.orderType || '',
              title: o.title || (o.orderDetails as Record<string, string> | null)?.testName || '',
              status: o.status,
            }));
          } else if (data.source === 'ER') {
            const orders = await prisma.ordersHub.findMany({
              where: {
                tenantId,
                encounterCoreId: data.sourceEncounterId,
                status: { in: ['ORDERED', 'IN_PROGRESS', 'ACCEPTED'] },
              },
              take: 50,
            });
            pendingOrders = orders.map((o) => ({
              kind: o.kind,
              title: o.orderName || '',
              status: o.status,
            }));
          }
        } catch {
          // Orders lookup may fail — continue without
        }
      }

      // 6. Create AdmissionRequest
      const request = await prisma.admissionRequest.create({
        data: {
          tenantId,
          source: data.source,
          sourceEncounterId: data.sourceEncounterId || null,
          sourceHandoffId: data.sourceHandoffId || null,
          patientMasterId: data.patientMasterId,
          patientName: patientName || body.patientName || '',
          mrn: mrn || body.mrn || '',
          requestingDoctorId: data.requestingDoctorId,
          requestingDoctorName: requestingDoctorName || body.requestingDoctorName || '',
          admittingDoctorId: data.admittingDoctorId || null,
          admittingDoctorName: admittingDoctorName || body.admittingDoctorName || '',
          targetDepartment: data.targetDepartment,
          targetUnit: data.targetUnit || null,
          urgency: data.urgency || 'ELECTIVE',
          bedType: data.bedType || 'GENERAL',
          primaryDiagnosis: data.primaryDiagnosis || null,
          primaryDiagnosisCode: data.primaryDiagnosisCode || null,
          clinicalSummary: data.clinicalSummary || null,
          reasonForAdmission: data.reasonForAdmission || null,
          pendingOrders: pendingOrders as any,
          allergies: allergies as any,
          status: 'PENDING',
          isolationRequired: data.isolationRequired ?? false,
          isolationType: data.isolationType || null,
          expectedLOS: data.expectedLOS || null,
          paymentType: data.paymentType || null,
          insuranceId: data.insuranceId || null,
          createdByUserId: userId,
          updatedByUserId: userId,
        },
      });

      // 7. Auto-create checklist
      const checklist = await prisma.admissionChecklist.create({
        data: {
          tenantId,
          admissionRequestId: request.id,
          items: DEFAULT_CHECKLIST_ITEMS.map((item) => ({ ...item })),
          completionPercentage: 0,
          allRequiredComplete: false,
        },
      });

      return NextResponse.json({ success: true, request, checklist }, { status: 201 });
    } catch (err) {
      logger.error('[admission/requests] POST error:', err);
      return NextResponse.json({ error: 'Failed to create admission request' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.manage' }
);
