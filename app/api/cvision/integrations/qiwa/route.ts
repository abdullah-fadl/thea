import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Integrations — Qiwa API
 *
 * GET  ?action=nitaqat            → live Nitaqat status from employee DB
 * GET  ?action=contracts          → simulated Qiwa contracts
 * GET  ?action=permits            → simulated work permits
 *
 * POST action=create-contract     → simulated contract creation
 * POST action=transfer            → simulated employee transfer
 * POST action=saudization-cert    → simulated certificate request
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSessionAndTenant, middlewareError } from '@/lib/cvision/middleware';
import { getCVisionDb } from '@/lib/cvision/db';
import { isSaudiEmployee } from '@/lib/cvision/saudi-utils';
import {
  QiwaClient,
  type NitaqatStatusResult,
} from '@/lib/cvision/integrations/qiwa/qiwa-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireSessionAndTenant(request);
    if (!authResult.success || !authResult.data) return middlewareError(authResult);

    const { tenantId } = authResult.data;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const db = await getCVisionDb(tenantId);

    // ── NITAQAT (from real employee data) ──────────────────────────
    if (action === 'nitaqat') {
      const employees = await db
        .collection('cvision_employees')
        .find({ tenantId, status: 'ACTIVE' })
        .toArray();

      let saudiCount = 0;
      const departmentMap: Record<string, { total: number; saudi: number }> = {};

      for (const emp of employees) {
        const saudi = isSaudiEmployee(emp as unknown as Parameters<typeof isSaudiEmployee>[0]);
        if (saudi) saudiCount++;

        const dept = String((emp as Record<string, unknown>).departmentName || (emp as Record<string, unknown>).department || 'Unassigned');
        if (!departmentMap[dept]) departmentMap[dept] = { total: 0, saudi: 0 };
        departmentMap[dept].total++;
        if (saudi) departmentMap[dept].saudi++;
      }

      const status = QiwaClient.calculateNitaqatFromCounts(saudiCount, employees.length);

      const departments = Object.entries(departmentMap).map(([name, d]) => ({
        name,
        total: d.total,
        saudi: d.saudi,
        nonSaudi: d.total - d.saudi,
        rate: d.total > 0 ? Math.round((d.saudi / d.total) * 1000) / 10 : 0,
      }));

      return NextResponse.json({ success: true, data: { ...status, departments } });
    }

    // ── CONTRACTS (simulation) ────────────────────────────────────
    if (action === 'contracts') {
      const client = newQiwaClient(tenantId);
      const result = await client.getContracts();
      return NextResponse.json({ success: true, data: result });
    }

    // ── WORK PERMITS (simulation) ─────────────────────────────────
    if (action === 'permits') {
      const client = newQiwaClient(tenantId);
      const result = await client.getWorkPermits();
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    logger.error('Qiwa API error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireSessionAndTenant(request);
    if (!authResult.success || !authResult.data) return middlewareError(authResult);

    const { tenantId } = authResult.data;
    const body = await request.json();
    const { action } = body;
    const client = newQiwaClient(tenantId);

    // ── CREATE CONTRACT (simulation) ─────────────────────────────
    if (action === 'create-contract') {
      const result = await client.createContract(body.data || body);
      return NextResponse.json({ success: true, data: result });
    }

    // ── TRANSFER (simulation) ────────────────────────────────────
    if (action === 'transfer') {
      const result = await client.initiateTransfer(body.data || body);
      return NextResponse.json({ success: true, data: result });
    }

    // ── SAUDIZATION CERTIFICATE (simulation) ─────────────────────
    if (action === 'saudization-cert') {
      const result = await client.requestSaudizationCertificate();
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    logger.error('Qiwa API POST error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function newQiwaClient(tenantId: string): QiwaClient {
  return new QiwaClient({
    tenantId,
    baseUrl: 'https://api.qiwa.sa',
    mode: 'SIMULATION',
  });
}
