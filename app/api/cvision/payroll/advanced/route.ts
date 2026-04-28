import { z } from 'zod';
import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { executeDryRun } from '@/lib/cvision/payroll/dry-run-engine';
import { comparePayrollMonths } from '@/lib/cvision/payroll/comparison-engine';
import { generatePayslip, generateBulkPayslips } from '@/lib/cvision/payroll/payslip-engine';
import { generateTotalCostReport } from '@/lib/cvision/payroll/cost-report-engine';
import { generatePayrollJournalEntry, formatJournalForExport, DEFAULT_GL_MAPPING } from '@/lib/cvision/payroll/accounting-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action') || '';
      const db = await getCVisionDb(tenantId);

      if (action === 'dry-run-list') {
        const runs = await db.collection('cvision_payroll_dry_runs')
          .find({ tenantId })
          .sort({ runDate: -1 })
          .limit(20)
          .project({ employees: 0 })
          .toArray();
        return NextResponse.json({ success: true, runs });
      }

      if (action === 'dry-run-detail') {
        const dryRunId = searchParams.get('dryRunId');
        if (!dryRunId) return NextResponse.json({ success: false, error: 'Missing dryRunId' }, { status: 400 });
        const run = await db.collection('cvision_payroll_dry_runs').findOne({ tenantId, dryRunId });
        if (!run) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
        return NextResponse.json({ success: true, run });
      }

      if (action === 'comparison') {
        const month1 = searchParams.get('month1');
        const month2 = searchParams.get('month2');
        if (!month1 || !month2) return NextResponse.json({ success: false, error: 'Missing month1/month2' }, { status: 400 });
        const comparison = await comparePayrollMonths(db, tenantId, month1, month2);
        return NextResponse.json({ success: true, comparison });
      }

      if (action === 'payslip') {
        const employeeId = searchParams.get('employeeId');
        const month = searchParams.get('month');
        if (!employeeId || !month) return NextResponse.json({ success: false, error: 'Missing employeeId/month' }, { status: 400 });
        const payslip = await generatePayslip(db, tenantId, employeeId, month);
        return NextResponse.json({ success: true, payslip });
      }

      if (action === 'payslips-bulk') {
        const month = searchParams.get('month');
        if (!month) return NextResponse.json({ success: false, error: 'Missing month' }, { status: 400 });
        const payslips = await generateBulkPayslips(db, tenantId, month);
        return NextResponse.json({ success: true, payslips, total: payslips.length });
      }

      if (action === 'total-cost') {
        const month = searchParams.get('month');
        if (!month) return NextResponse.json({ success: false, error: 'Missing month' }, { status: 400 });
        const report = await generateTotalCostReport(db, tenantId, month);
        return NextResponse.json({ success: true, report });
      }

      if (action === 'journal-entry') {
        const month = searchParams.get('month');
        if (!month) return NextResponse.json({ success: false, error: 'Missing month' }, { status: 400 });
        const entry = await generatePayrollJournalEntry(db, tenantId, month);
        return NextResponse.json({ success: true, entry });
      }

      if (action === 'gl-mapping') {
        const custom = await db.collection('cvision_gl_mapping').findOne({ tenantId });
        return NextResponse.json({ success: true, mapping: custom?.mapping || DEFAULT_GL_MAPPING, isCustom: !!custom });
      }

      return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    } catch (err: any) {
      logger.error('[payroll/advanced GET]', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.payroll.read' },
);

const advancedPostSchema = z.object({
  action: z.enum([
    'run-dry-run',
    'approve-payroll',
    'generate-journal',
    'export-journal',
    'update-gl-mapping',
  ]),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  dryRunId: z.string().optional(),
  mapping: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId }) => {
    try {
      const body = await request.json();
      const parsed = advancedPostSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: 'Validation failed', details: parsed.error.flatten() },
          { status: 400 },
        );
      }
      const { action } = body;
      const db = await getCVisionDb(tenantId);

      if (action === 'run-dry-run') {
        const { month } = body;
        if (!month) return NextResponse.json({ success: false, error: 'Missing month' }, { status: 400 });
        const result = await executeDryRun(db, tenantId, month, userId);
        return NextResponse.json({ success: true, result });
      }

      if (action === 'approve-payroll') {
        const { dryRunId } = body;
        if (!dryRunId) return NextResponse.json({ success: false, error: 'Missing dryRunId' }, { status: 400 });
        const dryRun = await db.collection('cvision_payroll_dry_runs').findOne({ tenantId, dryRunId });
        if (!dryRun) return NextResponse.json({ success: false, error: 'Dry run not found' }, { status: 404 });
        if (dryRun.status === 'APPROVED') {
          return NextResponse.json({ success: false, error: 'Already approved' }, { status: 400 });
        }
        if (dryRun.status === 'ERRORS_FOUND') {
          return NextResponse.json({ success: false, error: 'Cannot approve a dry run with critical errors' }, { status: 400 });
        }

        for (const emp of dryRun.employees || []) {
          await db.collection('cvision_payslips').updateOne(
            { tenantId, employeeId: emp.employeeId, month: dryRun.month },
            { $set: { ...emp, tenantId, month: dryRun.month, status: 'APPROVED', approvedBy: userId, approvedAt: new Date(), createdAt: new Date() } },
            { upsert: true },
          );
        }

        await db.collection('cvision_payroll_dry_runs').updateOne(
          { tenantId, dryRunId },
          { $set: { approvedBy: userId, approvedAt: new Date(), status: 'APPROVED' } },
        );

        return NextResponse.json({ success: true, message: `Payroll approved for ${dryRun.month}`, employeesProcessed: dryRun.employees?.length || 0 });
      }

      if (action === 'generate-journal') {
        const { month } = body;
        if (!month) return NextResponse.json({ success: false, error: 'Missing month' }, { status: 400 });
        const entry = await generatePayrollJournalEntry(db, tenantId, month);
        return NextResponse.json({ success: true, entry });
      }

      if (action === 'export-journal') {
        const { month } = body;
        if (!month) return NextResponse.json({ success: false, error: 'Missing month' }, { status: 400 });
        const entry = await generatePayrollJournalEntry(db, tenantId, month);
        const csv = formatJournalForExport(entry);
        return NextResponse.json({ success: true, csv, filename: `journal-${month}.csv` });
      }

      if (action === 'update-gl-mapping') {
        const { mapping } = body;
        if (!mapping) return NextResponse.json({ success: false, error: 'Missing mapping' }, { status: 400 });
        await db.collection('cvision_gl_mapping').updateOne(
          { tenantId },
          { $set: { tenantId, mapping, updatedBy: userId, updatedAt: new Date() } },
          { upsert: true },
        );
        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    } catch (err: any) {
      logger.error('[payroll/advanced POST]', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.payroll.write' },
);
