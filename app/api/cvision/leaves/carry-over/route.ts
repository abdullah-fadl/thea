/**
 * CVision Leave Balance Carry-Over API
 *
 * POST /api/cvision/leaves/carry-over
 *   action=preview  — Dry-run showing what would be carried over
 *   action=execute  — Actually perform the year-end carry-over
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuditedAuth } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) {
  return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm);
}

// ---------------------------------------------------------------------------
// Validation Schema
// ---------------------------------------------------------------------------

const carryOverSchema = z.object({
  action: z.enum(['preview', 'execute']),
  fromYear: z.number().int().min(2020).max(2040),
  toYear: z.number().int().min(2021).max(2041),
}).refine(d => d.toYear === d.fromYear + 1, { message: 'toYear must be fromYear + 1' });

// ---------------------------------------------------------------------------
// POST — Year-end leave balance carry-over
// ---------------------------------------------------------------------------

export const POST = withAuditedAuth(
  async (request: NextRequest, { tenantId, userId }) => {
    const ctxResult = await requireCtx(request);
    if (ctxResult instanceof NextResponse) return ctxResult;
    const ctx = ctxResult;

    // Admin-only: requires CONFIG_WRITE permission
    if (!hasPerm(ctx, CVISION_PERMISSIONS.CONFIG_WRITE)) {
      return deny('INSUFFICIENT_PERMISSION', 'Only admins can perform leave carry-over');
    }

    const body = await request.json();
    const parsed = carryOverSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Validation error', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { action, fromYear, toYear } = parsed.data;
    const db = await getCVisionDb(tenantId);

    // Fetch all ANNUAL leave balances for fromYear
    const balances = await db
      .collection('cvision_leave_balances')
      .find({ tenantId, year: fromYear, leaveType: 'ANNUAL' })
      .limit(50000)
      .toArray();

    // Calculate carry-over per employee — max 15 days per Saudi labor law
    const carryOverItems = balances.map((b: any) => {
      const remaining = Math.max((b.entitled ?? 0) - (b.used ?? 0), 0);
      const carryOver = Math.min(remaining, 15);
      return {
        employeeId: b.employeeId,
        entitled: b.entitled ?? 0,
        used: b.used ?? 0,
        remaining,
        carryOver,
      };
    });

    // -----------------------------------------------------------------------
    // Preview: return the list without making changes
    // -----------------------------------------------------------------------
    if (action === 'preview') {
      return NextResponse.json({
        ok: true,
        data: {
          fromYear,
          toYear,
          totalEmployees: carryOverItems.length,
          totalCarryOverDays: carryOverItems.reduce((sum: number, i: any) => sum + i.carryOver, 0),
          employees: carryOverItems,
        },
      });
    }

    // -----------------------------------------------------------------------
    // Execute: upsert each employee's toYear balance with carriedOver field
    // -----------------------------------------------------------------------
    let processed = 0;

    for (const item of carryOverItems) {
      if (item.carryOver <= 0) continue;

      await db.collection('cvision_leave_balances').updateOne(
        {
          tenantId,
          employeeId: item.employeeId,
          year: toYear,
          leaveType: 'ANNUAL',
        },
        {
          $set: {
            carriedOver: item.carryOver,
            updatedAt: new Date(),
            updatedBy: userId,
          },
          $setOnInsert: {
            tenantId,
            employeeId: item.employeeId,
            year: toYear,
            leaveType: 'ANNUAL',
            entitled: 0,
            used: 0,
            pending: 0,
            createdAt: new Date(),
            createdBy: userId,
          },
        },
        { upsert: true },
      );

      processed++;
    }

    return NextResponse.json({
      ok: true,
      data: {
        fromYear,
        toYear,
        processedEmployees: processed,
        totalCarryOverDays: carryOverItems.reduce((sum: number, i: any) => sum + i.carryOver, 0),
      },
      message: `Carry-over completed: ${processed} employee(s) processed`,
    });
  },
  { resourceType: 'LEAVE_BALANCE', platformKey: 'cvision', permissionKey: 'cvision.config.write' } as any,
);
