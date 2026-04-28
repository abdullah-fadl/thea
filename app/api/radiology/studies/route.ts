import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { validateBody } from '@/lib/validation/helpers';
import { nanoid } from 'nanoid';
import { logger } from '@/lib/monitoring/logger';
import { isValidTransition, actionToStatus, type StudyStatus } from '@/lib/radiology/studyStatus';
import { getDefaultSource } from '@/lib/dicomweb/sources';
import { searchStudies as searchPacsStudies } from '@/lib/dicomweb/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET — list radiology studies
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const params = req.nextUrl.searchParams;
    const search = params.get('search');
    const dateFrom = params.get('dateFrom');
    const dateTo = params.get('dateTo');
    const modality = params.get('modality');
    const status = params.get('status');
    const source = params.get('source') || 'local'; // 'local' | 'pacs' | 'all'

    // Read from orders_hub (primary source of truth)
    const where: Prisma.OrdersHubWhereInput = {
      tenantId,
      departmentKey: 'radiology',
      kind: 'RADIOLOGY',
    };

    if (search) {
      where.OR = [
        { orderName: { contains: search, mode: 'insensitive' } },
        { orderCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (modality) {
      where.meta = { path: ['modality'], equals: modality.toUpperCase() };
    }

    if (status) {
      where.status = status;
    }

    if (dateFrom || dateTo) {
      const dateFilter: Prisma.DateTimeNullableFilter = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.orderedAt = dateFilter;
    }

    const rawStudies = await prisma.ordersHub.findMany({
      where,
      orderBy: { orderedAt: 'desc' },
      take: 100,
    });

    // Patient enrichment
    const patientIds = [...new Set(rawStudies.map((s) => s.patientMasterId).filter(Boolean))] as string[];
    const patients = patientIds.length
      ? await prisma.patientMaster.findMany({
          where: { tenantId, id: { in: patientIds } },
        })
      : [];
    const patientMap = patients.reduce<Record<string, (typeof patients)[0]>>((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});

    const items = rawStudies.map((s: any) => {
      const meta = (s.meta || {});
      const patient = patientMap[String(s.patientMasterId || s.patientId || '')] || {} as Record<string, unknown>;
      return {
        ...s,
        examCode: s.orderCode || s.examCode,
        examName: s.orderName || s.examName,
        modality: meta.modality || s.modality,
        bodyPart: meta.bodyPart || s.bodyPart,
        accessionNumber: meta.accessionNumber || s.accessionNumber,
        studyDate: s.orderedAt || s.studyDate,
        patientId: s.patientMasterId || s.patientId,
        patientName: [(patient as any).firstName, (patient as any).lastName].filter(Boolean).join(' ') || s.patientName || 'Unknown',
        mrn: (patient as any).mrn || s.mrn || null,
      };
    });

    // PACS search (if source=pacs or source=all)
    let pacsItems: any[] = [];
    if (source === 'pacs' || source === 'all') {
      try {
        const pacsSource = await getDefaultSource(tenantId);
        if (pacsSource) {
          const qidoParams: Record<string, string> = {};
          if (search) qidoParams['PatientName'] = `*${search}*`;
          if (modality) qidoParams['ModalitiesInStudy'] = modality.toUpperCase();
          if (dateFrom) qidoParams['StudyDate'] = dateFrom.replace(/-/g, '') + '-';
          if (dateTo) {
            const existing = qidoParams['StudyDate'] || '';
            qidoParams['StudyDate'] = existing + dateTo.replace(/-/g, '');
          }

          const pacsStudies = await searchPacsStudies(pacsSource, qidoParams);
          pacsItems = pacsStudies.map((ps) => ({
            id: ps.studyInstanceUID,
            studyInstanceUID: ps.studyInstanceUID,
            source: 'pacs',
            sourceId: pacsSource.id,
            patientName: ps.patientName || 'Unknown',
            patientId: ps.patientID || '',
            mrn: ps.patientID || null,
            examName: ps.studyDescription || '',
            studyDescription: ps.studyDescription || '',
            modality: ps.modalitiesInStudy?.[0] || '',
            studyDate: ps.studyDate || null,
            accessionNumber: ps.accessionNumber || null,
            numberOfImages: ps.numberOfStudyRelatedInstances || 0,
            numberOfSeries: ps.numberOfStudyRelatedSeries || 0,
            status: 'PACS',
            referringPhysician: ps.referringPhysicianName || null,
            institutionName: ps.institutionName || null,
          }));
        }
      } catch (err) {
        logger.error('[radiology/studies] PACS search failed', { category: 'api', error: err });
      }
    }

    // Merge results
    if (source === 'pacs') {
      return NextResponse.json({ items: pacsItems, source: 'pacs' });
    }

    if (source === 'all') {
      // Deduplicate by accession number
      const localAccessions = new Set(items.map((i: any) => i.accessionNumber).filter(Boolean));
      const deduped = pacsItems.filter((p) => !p.accessionNumber || !localAccessions.has(p.accessionNumber));
      return NextResponse.json({ items: [...items, ...deduped], source: 'all' });
    }

    return NextResponse.json({ items, source: 'local' });
  }),
  { tenantScoped: true, permissionKey: 'radiology.view' }
);

// ---------------------------------------------------------------------------
// POST — create a new radiology study / order
// ---------------------------------------------------------------------------

const createStudySchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  mrn: z.string().min(1),
  encounterId: z.string().optional(),
  examCode: z.string().min(1),
  examName: z.string().min(1),
  examNameAr: z.string().optional(),
  modality: z.enum(['XR', 'CT', 'MRI', 'US', 'NM', 'FLUORO']),
  bodyPart: z.string().min(1),
  priority: z.number().int().min(0).max(3).default(0),
  clinicalIndication: z.string().optional(),
  clinicalIndicationAr: z.string().optional(),
  orderingDoctorId: z.string().optional(),
  orderingDoctorName: z.string().optional(),
  withContrast: z.boolean().default(false),
}).passthrough();

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, createStudySchema);
    if ('error' in v) return v.error;

    const now = new Date();
    const accessionNumber = `RAD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${nanoid(6).toUpperCase()}`;

    const studyId = `rad_${nanoid(12)}`;

    // Write to orders_hub (primary source of truth)
    const order = await prisma.ordersHub.create({
      data: {
        id: studyId,
        tenantId,
        kind: 'RADIOLOGY',
        departmentKey: 'radiology',
        orderCode: v.data.examCode,
        orderName: v.data.examName,
        orderNameAr: v.data.examNameAr || null,
        patientMasterId: v.data.patientId,
        encounterCoreId: v.data.encounterId || null,
        priority: String(v.data.priority),
        clinicalText: v.data.clinicalIndication || null,
        status: 'ORDERED',
        orderedAt: now,
        createdByUserId: userId || null,
        meta: {
          modality: v.data.modality,
          bodyPart: v.data.bodyPart,
          accessionNumber,
          withContrast: v.data.withContrast || false,
          patientName: v.data.patientName,
          mrn: v.data.mrn,
          orderingDoctorId: v.data.orderingDoctorId || null,
          orderingDoctorName: v.data.orderingDoctorName || user?.displayName || user?.email || null,
        },
      },
    });

    // Build study response object for backward compatibility
    const study = {
      id: order.id,
      tenantId,
      ...v.data,
      accessionNumber,
      status: 'ORDERED' as StudyStatus,
      orderedAt: now,
      orderedBy: userId,
      orderedByName: v.data.orderingDoctorName || user?.displayName || user?.email || null,
      studyDate: now,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };

    logger.info('Radiology study created', {
      category: 'api',
      tenantId,
      userId,
      route: '/api/radiology/studies',
      studyId: study.id,
      modality: study.modality,
    });

    return NextResponse.json({ success: true, study });
  }),
  { tenantScoped: true, permissionKey: 'radiology.orders.create' }
);

// ---------------------------------------------------------------------------
// PUT — update study status (workflow transitions)
// ---------------------------------------------------------------------------

const updateStudyStatusSchema = z.object({
  studyId: z.string().min(1),
  action: z.enum(['schedule', 'start', 'complete', 'report', 'verify', 'cancel']),
  scheduledAt: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, updateStudyStatusSchema);
    if ('error' in v) return v.error;
    const { studyId, action, scheduledAt, notes } = v.data;

    const study = await prisma.ordersHub.findFirst({
      where: { tenantId, id: studyId, kind: 'RADIOLOGY' },
    });

    if (!study) {
      return NextResponse.json({ error: 'Study not found' }, { status: 404 });
    }

    const targetStatus = actionToStatus(action);
    if (!targetStatus) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!isValidTransition(study.status as StudyStatus, targetStatus)) {
      return NextResponse.json(
        {
          error: `Cannot transition from ${study.status} to ${targetStatus}`,
          currentStatus: study.status,
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const updateData: Record<string, unknown> = {
      status: targetStatus,
    };

    if (action === 'start') {
      updateData.inProgressAt = now;
    }
    if (action === 'complete') {
      updateData.completedAt = now;
    }
    if (action === 'verify') {
      // Store verify info in meta since OrdersHub doesn't have verifiedAt/verifiedBy
      const currentMeta = (study.meta || {}) as Record<string, unknown>;
      updateData.meta = {
        ...(currentMeta as object),
        verifiedAt: now.toISOString(),
        verifiedBy: userId,
        verifierName: user?.displayName || user?.email || null,
        ...(scheduledAt ? { scheduledAt } : {}),
      };
    }
    if (action === 'schedule' && scheduledAt) {
      const currentMeta = (study.meta || {}) as Record<string, unknown>;
      updateData.meta = { ...(currentMeta as object), scheduledAt: new Date(scheduledAt).toISOString() };
    }
    if (action === 'cancel') {
      updateData.cancelledAt = now;
      updateData.cancelReason = notes || null;
    }
    if (notes) {
      updateData.notes = notes;
    }

    // Update orders_hub (primary source of truth)
    await prisma.ordersHub.update({
      where: { id: studyId },
      data: updateData as any,
    });

    logger.info(`Radiology study ${action}`, {
      category: 'api',
      tenantId,
      userId,
      route: '/api/radiology/studies',
      studyId,
      fromStatus: study.status,
      toStatus: targetStatus,
    });

    return NextResponse.json({ success: true, status: targetStatus });
  }),
  { tenantScoped: true, permissionKey: 'radiology.orders.edit' }
);
