import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody, safeParseBody } from '@/lib/validation/helpers';
import {
  createBatchJob,
  processBatch,
  getBatchProgress,
  listBatchJobs,
} from '@/lib/integrations/nphies/batchProcessor';
import { nphiesConfig } from '@/lib/integrations/nphies/config';
import { canAccessBilling } from '@/lib/billing/access';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const batchEligibilityItemSchema = z.object({
  patientId: z.string().min(1),
  insuranceId: z.string().min(1),
  serviceDate: z.string().optional(),
  serviceCategories: z.array(z.string()).optional(),
});

const batchClaimItemSchema = z.object({
  patientId: z.string().min(1),
  insuranceId: z.string().min(1),
  encounterId: z.string().min(1),
  encounterType: z.enum(['outpatient', 'inpatient', 'emergency']),
  encounterStartDate: z.string().min(1),
  encounterEndDate: z.string().optional(),
  services: z.array(z.object({
    code: z.string().min(1),
    display: z.string().min(1),
    date: z.string().min(1),
    quantity: z.number().min(1),
    unitPrice: z.number().min(0),
    totalPrice: z.number().min(0),
    priorAuthNumber: z.string().optional(),
  })).min(1),
  diagnosis: z.array(z.object({
    code: z.string().min(1),
    display: z.string().min(1),
    type: z.enum(['principal', 'secondary']),
  })).min(1),
});

const batchPriorAuthItemSchema = z.object({
  patientId: z.string().min(1),
  insuranceId: z.string().min(1),
  encounterId: z.string().optional(),
  services: z.array(z.object({
    code: z.string().min(1),
    display: z.string().min(1),
    quantity: z.number().min(1),
    unitPrice: z.number().min(0),
  })).min(1),
  diagnosis: z.array(z.object({
    code: z.string().min(1),
    display: z.string().min(1),
  })).min(1),
});

const batchRequestSchema = z.object({
  type: z.enum(['eligibility', 'claim', 'prior-auth'], {
    message: 'type is required (eligibility, claim, or prior-auth)',
  }),
  items: z.array(z.any()).min(1, 'At least one item is required').max(100, 'Maximum 100 items per batch'),
  concurrency: z.number().min(1).max(10).optional(),
});

// ---------------------------------------------------------------------------
// Route Config
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// POST — Start a Batch Job
// ---------------------------------------------------------------------------

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
    if (!canAccessBilling({ email: user?.email, tenantId, role })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check NPHIES readiness
    const ready = nphiesConfig.checkReady();
    if (!ready.ready) {
      return NextResponse.json(
        { error: 'NPHIES integration is not configured', details: ready.reason },
        { status: 503 },
      );
    }

    // Parse and validate body
    const parsed = await safeParseBody(req);
    if ('error' in parsed) return parsed.error;
    const v = validateBody(parsed.body, batchRequestSchema);
    if ('error' in v) return v.error;

    const { type, items, concurrency } = v.data;

    // Validate individual items against the correct schema
    const itemSchema =
      type === 'eligibility'
        ? batchEligibilityItemSchema
        : type === 'claim'
        ? batchClaimItemSchema
        : batchPriorAuthItemSchema;

    for (let i = 0; i < items.length; i++) {
      const itemResult = itemSchema.safeParse(items[i]);
      if (!itemResult.success) {
        return NextResponse.json(
          {
            error: `Validation failed for item at index ${i}`,
            details: itemResult.error.flatten(),
          },
          { status: 400 },
        );
      }
    }

    // Resolve patient and insurance data for each item to build NPHIES-ready requests
    const resolvedItems = await resolveItemsForNphies(
      type,
      items,
      tenantId,
    );

    if ('error' in resolvedItems) {
      return NextResponse.json(
        { error: resolvedItems.error },
        { status: resolvedItems.status },
      );
    }

    // Create and process the batch job
    const job = createBatchJob(tenantId, type, resolvedItems.data, userId);

    // Process asynchronously — start processing but don't await completion
    // The client can poll via GET to check progress
    processBatch(job, concurrency || 3).catch((err) => {
      logger.error('Batch processing background error', {
        category: 'billing',
        jobId: job.id,
        error: err,
      });
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      message: 'Batch job started. Use GET with jobId to check progress.',
      messageAr: 'تم بدء المعالجة الدفعية. استخدم GET مع jobId للتحقق من التقدم.',
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.claims.create' },
);

// ---------------------------------------------------------------------------
// GET — Check Batch Job Status or List Jobs
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const jobId = String(req.nextUrl.searchParams.get('jobId') || '').trim();

    // If jobId is provided, return that specific job
    if (jobId) {
      const job = getBatchProgress(jobId);
      if (!job) {
        return NextResponse.json(
          { error: 'Batch job not found' },
          { status: 404 },
        );
      }

      // Ensure tenant isolation
      if (job.tenantId !== tenantId) {
        return NextResponse.json(
          { error: 'Batch job not found' },
          { status: 404 },
        );
      }

      return NextResponse.json({
        job: {
          id: job.id,
          type: job.type,
          status: job.status,
          progress: job.progress,
          results: job.status === 'completed' || job.status === 'failed'
            ? job.results
            : undefined,
          createdAt: job.createdAt.toISOString(),
          startedAt: job.startedAt?.toISOString(),
          completedAt: job.completedAt?.toISOString(),
          error: job.error,
        },
      });
    }

    // Otherwise, list all jobs for this tenant
    const jobs = listBatchJobs(tenantId);

    return NextResponse.json({
      jobs: jobs.map((job) => ({
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt.toISOString(),
        startedAt: job.startedAt?.toISOString(),
        completedAt: job.completedAt?.toISOString(),
      })),
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.claims.create' },
);

// ---------------------------------------------------------------------------
// Helpers — Resolve DB entities into NPHIES-ready request payloads
// ---------------------------------------------------------------------------

async function resolveItemsForNphies(
  type: string,
  items: any[],
  tenantId: string,
): Promise<{ data: any[] } | { error: string; status: number }> {
  try {
    const resolved: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Fetch patient
      const patient = await (prisma as any).patientMaster.findFirst({
        where: { id: item.patientId, tenantId },
      });
      if (!patient) {
        return {
          error: `Patient not found for item at index ${i} (patientId: ${item.patientId})`,
          status: 404,
        };
      }

      // Fetch insurance
      const insurance = await (prisma as any).patientInsurance.findFirst({
        where: { id: item.insuranceId, tenantId },
      });
      if (!insurance) {
        return {
          error: `Insurance not found for item at index ${i} (insuranceId: ${item.insuranceId})`,
          status: 404,
        };
      }

      const nphiesPatient = {
        nationalId: patient.nationalId || patient.iqama,
        fullName: patient.fullName,
        fullNameAr: (patient as any).fullNameAr,
        birthDate: patient.dob
          ? patient.dob.toISOString().split('T')[0]
          : undefined,
        gender: (patient.gender?.toLowerCase() || 'male') as 'male' | 'female',
        phone: patient.mobile,
      };

      const nphiesCoverage = {
        insurerId: insurance.insurerId,
        insurerName: insurance.insurerName,
        memberId: insurance.memberId,
        policyNumber: insurance.policyNumber,
        relationToSubscriber: (insurance.relation || 'self') as
          | 'self'
          | 'spouse'
          | 'child'
          | 'other',
        startDate: insurance.startDate
          ? insurance.startDate.toISOString()
          : undefined,
        endDate: insurance.endDate
          ? insurance.endDate.toISOString()
          : undefined,
      };

      if (type === 'eligibility') {
        resolved.push({
          patient: nphiesPatient,
          coverage: nphiesCoverage,
          serviceDate:
            item.serviceDate || new Date().toISOString().split('T')[0],
          serviceCategories: item.serviceCategories,
        });
      } else if (type === 'claim') {
        const totalAmount = item.services.reduce(
          (sum: number, s: { totalPrice: number }) => sum + s.totalPrice,
          0,
        );
        resolved.push({
          patient: nphiesPatient,
          coverage: nphiesCoverage,
          encounter: {
            id: item.encounterId,
            type: item.encounterType,
            startDate: item.encounterStartDate,
            endDate: item.encounterEndDate,
            provider: {
              id: 'default',
              name: 'Provider',
              specialty: 'general',
            },
          },
          diagnosis: item.diagnosis,
          services: item.services,
          totalAmount,
        });
      } else if (type === 'prior-auth') {
        resolved.push({
          patient: nphiesPatient,
          coverage: nphiesCoverage,
          encounterId: item.encounterId,
          diagnosis: item.diagnosis,
          services: item.services,
        });
      }
    }

    return { data: resolved };
  } catch (err) {
    logger.error('Failed to resolve batch items', {
      category: 'billing',
      error: err,
    });
    return {
      error: 'Failed to resolve patient/insurance data for batch items',
      status: 500,
    };
  }
}
