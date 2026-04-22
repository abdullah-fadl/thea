import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import {
  createEntry,
  submitWeek,
  approveTimesheet,
  rejectTimesheet,
  getMyTimesheet,
  getTeamTimesheets,
  getPendingApproval,
  createProject,
  updateProject,
  getProjectHours,
  listProjects,
  getUtilizationReport,
  getBillingReport,
  getStats,
} from '@/lib/cvision/timesheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(async (request: NextRequest, { tenantId, userId }: any) => {
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'my-timesheet';

  // ── My timesheet ──────────────────────────────────────────────────────
  if (action === 'my-timesheet') {
    const weekStartDate = searchParams.get('weekStartDate') || undefined;
    const data = await getMyTimesheet(db, tenantId, userId, weekStartDate);
    return NextResponse.json({ ok: true, data });
  }

  // ── Team timesheets ───────────────────────────────────────────────────
  if (action === 'team-timesheets') {
    const status = searchParams.get('status') || undefined;
    const data = await getTeamTimesheets(db, tenantId, status);
    return NextResponse.json({ ok: true, data });
  }

  // ── Project hours ─────────────────────────────────────────────────────
  if (action === 'project-hours') {
    const projectId = searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ ok: false, error: 'projectId is required' }, { status: 400 });
    }
    const data = await getProjectHours(db, tenantId, projectId);
    return NextResponse.json({ ok: true, data });
  }

  // ── Utilization report ────────────────────────────────────────────────
  if (action === 'utilization-report') {
    const data = await getUtilizationReport(db, tenantId);
    return NextResponse.json({ ok: true, data });
  }

  // ── Billing report ────────────────────────────────────────────────────
  if (action === 'billing-report') {
    const data = await getBillingReport(db, tenantId);
    return NextResponse.json({ ok: true, data });
  }

  // ── Pending approval ──────────────────────────────────────────────────
  if (action === 'pending-approval') {
    const data = await getPendingApproval(db, tenantId);
    return NextResponse.json({ ok: true, data });
  }

  // ── Projects list ─────────────────────────────────────────────────────
  if (action === 'projects') {
    const status = searchParams.get('status') || undefined;
    const data = await listProjects(db, tenantId, status);
    return NextResponse.json({ ok: true, data });
  }

  // ── Stats ─────────────────────────────────────────────────────────────
  if (action === 'stats') {
    const data = await getStats(db, tenantId);
    return NextResponse.json({ ok: true, data });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.attendance.read' });

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }: any) => {
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const { action } = body;

  // ── Create timesheet entry ────────────────────────────────────────────
  if (action === 'create-entry') {
    const data = await createEntry(db, tenantId, body);
    return NextResponse.json({ ok: true, data });
  }

  // ── Submit week ───────────────────────────────────────────────────────
  if (action === 'submit-week') {
    if (!body.timesheetId) {
      return NextResponse.json({ ok: false, error: 'timesheetId is required' }, { status: 400 });
    }
    const data = await submitWeek(db, tenantId, body.timesheetId);
    return NextResponse.json({ ok: true, data });
  }

  // ── Approve timesheet ─────────────────────────────────────────────────
  if (action === 'approve') {
    if (!body.timesheetId) {
      return NextResponse.json({ ok: false, error: 'timesheetId is required' }, { status: 400 });
    }
    const data = await approveTimesheet(db, tenantId, body.timesheetId, userId);
    return NextResponse.json({ ok: true, data });
  }

  // ── Reject timesheet ──────────────────────────────────────────────────
  if (action === 'reject') {
    if (!body.timesheetId) {
      return NextResponse.json({ ok: false, error: 'timesheetId is required' }, { status: 400 });
    }
    const data = await rejectTimesheet(db, tenantId, body.timesheetId);
    return NextResponse.json({ ok: true, data });
  }

  // ── Create project ────────────────────────────────────────────────────
  if (action === 'create-project') {
    const data = await createProject(db, tenantId, body);
    return NextResponse.json({ ok: true, data });
  }

  // ── Update project ────────────────────────────────────────────────────
  if (action === 'update-project') {
    if (!body.projectId) {
      return NextResponse.json({ ok: false, error: 'projectId is required' }, { status: 400 });
    }
    const data = await updateProject(db, tenantId, body.projectId, body);
    return NextResponse.json({ ok: true, data });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.attendance.write' });
