import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { getPathway, updatePathway, completePathwayTask } from '@/lib/workflow/pathways';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const id = (params as { id: string }).id;
    const pathway = await getPathway(tenantId, id);
    if (!pathway) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(pathway);
  }),
  { tenantScoped: true, permissionKey: 'opd.visit.view' },
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const id = (params as { id: string }).id;
    const body = await req.json();
    const updated = await updatePathway(tenantId, id, body);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  }),
  { tenantScoped: true, permissionKey: 'opd.visit.create' },
);

/**
 * POST /api/workflow/pathways/[id]
 * Complete a task in a pathway instance.
 * Body: { action: 'complete_task', taskId, notes? }
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const instanceId = (params as { id: string }).id;
    const body = await req.json();

    if (body.action !== 'complete_task' || !body.taskId) {
      return NextResponse.json({ error: 'action must be "complete_task" and taskId is required' }, { status: 400 });
    }

    const instance = await completePathwayTask(tenantId, instanceId, body.taskId, userId, body.notes);
    if (!instance) return NextResponse.json({ error: 'Instance or task not found' }, { status: 404 });
    return NextResponse.json(instance);
  }),
  { tenantScoped: true, permissionKey: 'opd.visit.create' },
);
