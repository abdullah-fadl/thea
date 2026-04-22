import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import {
  createUnit, assignEmployee, checkOutEmployee,
  submitMaintenanceRequest, resolveMaintenanceRequest,
  recordUtility,
  listUnits, getEmployeeHousing, getOccupancyReport, getMaintenanceRequests, getStats,
} from '@/lib/cvision/housing';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ═══════════════════════════════════════════════════════════════════ */
/* GET                                                                */
/* ═══════════════════════════════════════════════════════════════════ */

/** Roles that may perform HR/admin housing management operations. */
const HR_ADMIN_ROLES = new Set(['admin', 'tenant-admin', 'hr', 'hr-manager', 'hr-admin', 'thea-owner']);

function isHrAdmin(role: string): boolean {
  return HR_ADMIN_ROLES.has(String(role).toLowerCase());
}

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId, userId, role }) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action') || 'list';
      const db = await getCVisionDb(tenantId);

      /* ── List units — HR/admin only ──────────────────────────────── */
      if (action === 'list') {
        if (!isHrAdmin(role)) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }
        const status = searchParams.get('status') || undefined;
        const type = searchParams.get('type') || undefined;
        const items = await listUnits(db, tenantId, { status, type });
        return NextResponse.json({ success: true, data: { items, total: items.length } });
      }

      /* ── Employee housing ─────────────────────────────────────────
       * HR/admin may query any employee by supplying employeeId.
       * Regular employees may only query their own record; the
       * employeeId param is ignored and userId is used instead so
       * a user cannot enumerate other employees' housing data.
       * ─────────────────────────────────────────────────────────── */
      if (action === 'employee-housing') {
        let employeeId: string;
        if (isHrAdmin(role)) {
          const param = searchParams.get('employeeId');
          if (!param) return NextResponse.json({ success: false, error: 'employeeId required' }, { status: 400 });
          employeeId = param;
        } else {
          // Non-admin users may only retrieve their own housing record.
          employeeId = userId;
        }
        const unit = await getEmployeeHousing(db, tenantId, employeeId);
        return NextResponse.json({ success: true, data: unit });
      }

      /* ── Occupancy report — HR/admin only ────────────────────────── */
      if (action === 'occupancy-report') {
        if (!isHrAdmin(role)) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }
        const report = await getOccupancyReport(db, tenantId);
        return NextResponse.json({ success: true, ...report });
      }

      /* ── Maintenance requests — HR/admin only ────────────────────── */
      if (action === 'maintenance') {
        if (!isHrAdmin(role)) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }
        const status = searchParams.get('mStatus') || undefined;
        const items = await getMaintenanceRequests(db, tenantId, status);
        return NextResponse.json({ success: true, data: { items, total: items.length } });
      }

      /* ── Stats — HR/admin only ───────────────────────────────────── */
      if (action === 'stats') {
        if (!isHrAdmin(role)) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }
        const result = await getStats(db, tenantId);
        return NextResponse.json({ success: true, ...result });
      }

      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    } catch (err: any) {
      logger.error('[housing GET]', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  },
);

/* ═══════════════════════════════════════════════════════════════════ */
/* POST                                                               */
/* ═══════════════════════════════════════════════════════════════════ */

export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId, role }) => {
    try {
      const body = await request.json();
      const { action } = body;
      const db = await getCVisionDb(tenantId);

      /* ── Create unit — HR/admin only ─────────────────────────────── */
      if (action === 'create-unit') {
        if (!isHrAdmin(role)) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }
        const result = await createUnit(db, tenantId, body);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Assign employee — HR/admin only ─────────────────────────── */
      if (action === 'assign-employee') {
        if (!isHrAdmin(role)) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }
        const result = await assignEmployee(db, tenantId, body.unitId, body);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Check out employee — HR/admin only ──────────────────────── */
      if (action === 'check-out') {
        if (!isHrAdmin(role)) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }
        const result = await checkOutEmployee(db, tenantId, body.unitId, body.employeeId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Submit maintenance request ───────────────────────────────
       * Any authenticated tenant user may submit a maintenance request
       * for a unit they occupy.  The reportedBy field is pinned to the
       * authenticated userId so the caller cannot impersonate others.
       * ─────────────────────────────────────────────────────────── */
      if (action === 'submit-maintenance') {
        const result = await submitMaintenanceRequest(db, tenantId, body.unitId, {
          ...body,
          reportedBy: userId,
        });
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Resolve maintenance request — HR/admin only ─────────────── */
      if (action === 'resolve-maintenance') {
        if (!isHrAdmin(role)) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }
        const result = await resolveMaintenanceRequest(db, tenantId, body.unitId, body.requestId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Record utility — HR/admin only ──────────────────────────── */
      if (action === 'record-utility') {
        if (!isHrAdmin(role)) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }
        const result = await recordUtility(db, tenantId, body.unitId, body);
        return NextResponse.json({ success: true, ...result });
      }

      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    } catch (err: any) {
      logger.error('[housing POST]', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.employees.write' },
);
