import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { workflowLogger, getTraceId, withTraceId } from '@/lib/imdad/logger';
import { increment } from '@/lib/imdad/metrics';
import { checkRateLimit } from '@/lib/imdad/rate-limit';
import { resolveIdentity, IdentityError } from '@/lib/imdad/user-identity';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// SLA hours per approval role
// ---------------------------------------------------------------------------
const SLA_MAP: Record<string, number> = {
  HEAD_OF_DEPARTMENT: 4,
  DON: 8,
  EXECUTIVE_DIRECTOR: 8,
  SUPPLY_CHAIN: 12,
  GENERAL_DIRECTOR: 24,
  CFO: 24,
  COO: 48,
  BIOMEDICAL: 6,
  IT_DIRECTOR: 8,
};

// ---------------------------------------------------------------------------
// Role display names
// ---------------------------------------------------------------------------
const ROLE_NAMES: Record<string, { en: string; ar: string }> = {
  HEAD_OF_DEPARTMENT: { en: 'Head of Department', ar: '\u0631\u0626\u064a\u0633 \u0627\u0644\u0642\u0633\u0645' },
  DON: { en: 'Director of Nursing', ar: '\u0645\u062f\u064a\u0631 \u0627\u0644\u062a\u0645\u0631\u064a\u0636' },
  EXECUTIVE_DIRECTOR: { en: 'Executive Director', ar: '\u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u062a\u0646\u0641\u064a\u0630\u064a' },
  SUPPLY_CHAIN: { en: 'Supply Chain', ar: '\u0633\u0644\u0633\u0644\u0629 \u0627\u0644\u0625\u0645\u062f\u0627\u062f' },
  GENERAL_DIRECTOR: { en: 'General Director', ar: '\u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u0639\u0627\u0645' },
  CFO: { en: 'Chief Financial Officer', ar: '\u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u0645\u0627\u0644\u064a' },
  COO: { en: 'Chief Operating Officer', ar: '\u0645\u062f\u064a\u0631 \u0627\u0644\u0639\u0645\u0644\u064a\u0627\u062a' },
  BIOMEDICAL: { en: 'Biomedical Engineering', ar: '\u0627\u0644\u0647\u0646\u062f\u0633\u0629 \u0627\u0644\u0637\u0628\u064a\u0629' },
  IT_DIRECTOR: { en: 'IT Director', ar: '\u0645\u062f\u064a\u0631 \u062a\u0642\u0646\u064a\u0629 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a' },
};

// ---------------------------------------------------------------------------
// SLA deadline hours by priority
// ---------------------------------------------------------------------------
const PRIORITY_SLA_HOURS: Record<string, number> = {
  EMERGENCY: 4,
  URGENT: 24,
  ROUTINE: 72,
};

// ---------------------------------------------------------------------------
// Build approval chain based on request type, domain, cost, and priority
// ---------------------------------------------------------------------------
function buildApprovalChain(
  requestType: string,
  domain: string,
  totalCost: number,
  _priority: string,
): Array<{ role: string; roleName: string; roleNameAr: string; slaHours: number }> {
  const steps: Array<{ role: string; roleName: string; roleNameAr: string; slaHours: number }> = [];

  const addStep = (role: string) => {
    const names = ROLE_NAMES[role] ?? { en: role, ar: role };
    steps.push({
      role,
      roleName: names.en,
      roleNameAr: names.ar,
      slaHours: SLA_MAP[role] ?? 24,
    });
  };

  switch (requestType) {
    case 'MAINTENANCE_REQUEST': {
      addStep('HEAD_OF_DEPARTMENT');
      if (domain === 'IT_SYSTEMS') {
        addStep('IT_DIRECTOR');
      } else {
        addStep('BIOMEDICAL');
      }
      if (totalCost >= 20_000) {
        addStep('GENERAL_DIRECTOR');
      }
      break;
    }
    case 'TRANSFER_REQUEST': {
      addStep('HEAD_OF_DEPARTMENT');
      addStep('SUPPLY_CHAIN');
      break;
    }
    case 'BUDGET_REQUEST': {
      addStep('HEAD_OF_DEPARTMENT');
      addStep('DON');
      addStep('GENERAL_DIRECTOR');
      addStep('CFO');
      if (totalCost >= 500_000) {
        addStep('COO');
      }
      break;
    }
    // SUPPLY_REQUEST and REPLENISHMENT_REQUEST
    default: {
      addStep('HEAD_OF_DEPARTMENT');
      addStep('DON');
      addStep('SUPPLY_CHAIN');
      if (totalCost >= 50_000) {
        addStep('GENERAL_DIRECTOR');
      }
      if (totalCost >= 200_000) {
        addStep('COO');
      }
      break;
    }
  }

  return steps;
}

// ---------------------------------------------------------------------------
// POST — Create a supply request
// ---------------------------------------------------------------------------
export const POST = withAuthTenant(
  async (request, { tenantId, userId, user }) => {
    const traceId = getTraceId(request);
    const log = workflowLogger({ traceId, route: '/api/imdad/workflow/requests', action: 'CREATE', tenantId, userId });
    try {
      const rl = checkRateLimit(tenantId, userId, { maxPerMinute: 20 });
      if (!rl.allowed) {
        log.error('TOO_MANY_REQUESTS', 'Rate limit exceeded');
        return NextResponse.json({ error: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded', retryAfterMs: rl.resetAt - Date.now() }, { status: 429 });
      }
      log.start();
      const body = await request.json();
      const {
        requestType = 'SUPPLY_REQUEST',
        idempotencyKey,
        hospitalId,
        department,
        departmentAr,
        domain,
        items,
        priority = 'ROUTINE',
        justification,
        justificationAr,
        deviceId,
        deviceName,
        maintenanceType,
        sourceHospitalId,
        targetHospitalId,
        budgetCategory,
        budgetPeriod,
        budgetAmount,
      } = body;

      // ── STRICT IDENTITY: fetch from authoritative source (users table) ──
      let identity;
      try {
        identity = await resolveIdentity(userId, tenantId);
      } catch (e) {
        if (e instanceof IdentityError) {
          return NextResponse.json(e.toResponse(), { status: 403 });
        }
        throw e;
      }
      const requestedBy = identity.fullName;
      const requestedByAr = identity.fullName; // Arabic name from canonical source
      const requestedByRole = identity.role;

      // IDEMPOTENCY: if key provided, check for existing request
      if (idempotencyKey) {
        const existing = await prisma.imdadSupplyRequest.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
          include: { items: true, approvalSteps: { orderBy: { stepNumber: 'asc' } as any } } as any,
        });
        if (existing) {
          return NextResponse.json(existing, { status: 200 });
        }
      }

      // Validate required fields
      if (!hospitalId || !department || !domain) {
        return NextResponse.json(
          { error: 'Missing required fields: hospitalId, department, domain' },
          { status: 400 },
        );
      }
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: 'MISSING_ITEMS', message: 'At least one item is required' }, { status: 400 });
      }
      const totalAmount = budgetAmount || items.reduce((s: number, i: any) => s + (Number(i.estimatedCost) || 0) * (Number(i.quantity) || 0), 0);
      if (totalAmount <= 0) {
        return NextResponse.json({ error: 'INVALID_AMOUNT', message: 'Total estimated cost must be greater than 0' }, { status: 400 });
      }

      // Generate request code: REQ-{year}-{0001}
      const year = new Date().getFullYear();
      const existingCount = await prisma.imdadSupplyRequest.count({
        where: { tenantId },
      });
      const seq = String(existingCount + 1).padStart(4, '0');
      const code = `REQ-${year}-${seq}`;

      // Calculate total estimated cost
      const totalEstimatedCost = items.reduce(
        (sum: number, item: { estimatedCost?: number; quantity?: number }) =>
          sum + (Number(item.estimatedCost) || 0),
        0,
      );

      // Build approval chain
      const approvalChain = buildApprovalChain(requestType, domain, totalEstimatedCost, priority);

      // SLA deadline
      const slaHours = PRIORITY_SLA_HOURS[priority] ?? 72;
      const slaDeadlineAt = new Date(Date.now() + slaHours * 60 * 60 * 1000);

      // Look up hospital name (best-effort)
      let hospitalName = hospitalId;
      let hospitalNameAr: string | null = null;
      try {
        const hospital = await (prisma as any).imdadHospital.findFirst({
          where: { tenantId, id: hospitalId },
          select: { name: true, nameAr: true },
        });
        if (hospital) {
          hospitalName = hospital.name;
          hospitalNameAr = hospital.nameAr ?? null;
        }
      } catch {
        // Hospital lookup is best-effort; proceed with hospitalId as name
      }

      const now = new Date();

      // Create the request with items and approval steps in a transaction
      const created = await prisma.$transaction(async (tx) => {
        const supplyRequest = await tx.imdadSupplyRequest.create({
          data: {
            tenantId,
            code,
            idempotencyKey: idempotencyKey || null,
            requestType: requestType as any,
            hospitalId,
            hospitalName,
            hospitalNameAr,
            department,
            departmentAr,
            requestedBy,
            requestedByAr,
            requestedByUserId: userId,
            requestedByRole,
            domain,
            priority: priority as any,
            justification,
            justificationAr,
            totalEstimatedCost,
            status: 'SUBMITTED',
            currentApprovalStep: 0,
            slaDeadlineAt,
            slaBreached: false,
            deviceId,
            deviceName,
            maintenanceType,
            sourceHospitalId,
            targetHospitalId,
            budgetCategory,
            budgetPeriod,
            budgetAmount: budgetAmount != null ? Number(budgetAmount) : null,
            items: {
              create: items.map((item: any) => ({
                tenantId,
                itemId: item.itemId ?? null,
                name: item.name,
                nameAr: item.nameAr ?? null,
                sku: item.sku ?? '',
                quantity: Number(item.quantity) || 1,
                unit: item.unit ?? 'unit',
                estimatedCost: Number(item.estimatedCost) || 0,
              })),
            },
            approvalSteps: {
              create: approvalChain.map((step, idx) => ({
                tenantId,
                stepNumber: idx,
                role: step.role,
                roleName: step.roleName,
                roleNameAr: step.roleNameAr,
                slaHours: step.slaHours,
                status: idx === 0 ? 'PENDING' : ('PENDING' as any),
                pendingSince: idx === 0 ? now : null,
              })),
            },
          } as any,
          include: {
            items: true,
            approvalSteps: { orderBy: { stepNumber: 'asc' } },
          } as any,
        });

        // Create audit entry
        await tx.imdadSupplyRequestAudit.create({
          data: {
            tenantId,
            requestId: supplyRequest.id,
            requestCode: code,
            action: 'CREATED',
            performedBy: userId,
            performedByRole: requestedByRole,
            previousState: 'NONE',
            newState: 'SUBMITTED',
            metadata: { totalEstimatedCost, itemCount: items.length, priority, traceId },
          },
        });

        return supplyRequest;
      });

      increment('requestsCreated');
      log.success(`Request ${created.code} created`, { requestCode: created.code, requestId: created.id });
      return withTraceId(NextResponse.json(created, { status: 201 }), traceId);
    } catch (err: any) {
      log.error('INTERNAL_ERROR', err?.message);
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: err?.message },
        { status: 500 },
      );
    }
  },
  { platformKey: 'imdad' as any, permissionKey: 'imdad.workflow.manage' },
);

// ---------------------------------------------------------------------------
// GET — List supply requests
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const hospitalId = searchParams.get('hospitalId');
      const status = searchParams.get('status');
      const role = searchParams.get('role');

      const where: any = { tenantId, isDeleted: false };
      if (hospitalId) where.hospitalId = hospitalId;
      if (status) where.status = status;

      // If filtering by role, find requests where the current step matches the role
      if (role) {
        where.approvalSteps = {
          some: {
            role,
            status: 'PENDING',
          },
        };
      }

      const requests = await prisma.imdadSupplyRequest.findMany({
        where,
        include: {
          items: true,
          approvalSteps: { orderBy: { stepNumber: 'asc' } },
        } as any,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      return NextResponse.json(requests);
    } catch (err: any) {
      console.error('[IMDAD] Failed to list supply requests:', err);
      return NextResponse.json(
        { error: 'Failed to list supply requests', details: err?.message },
        { status: 500 },
      );
    }
  },
  { platformKey: 'imdad' as any, permissionKey: 'imdad.workflow.manage' },
);
