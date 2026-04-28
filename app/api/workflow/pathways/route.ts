import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import {
  listPathways,
  createPathway,
  seedDefaultPathways,
  startPathway,
  checkOverdueTasks,
  getPatientPathways,
} from '@/lib/workflow/pathways';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const params = new URL(req.url).searchParams;

    if (params.get('seed') === 'true') {
      await seedDefaultPathways(tenantId, userId);
    }

    // Get patient's active pathways
    if (params.get('patientId')) {
      const instances = await getPatientPathways(tenantId, params.get('patientId')!);
      return NextResponse.json({ instances, total: instances.length });
    }

    // Check overdue tasks
    if (params.get('overdue') === 'true') {
      const overdue = await checkOverdueTasks(tenantId);
      return NextResponse.json({ overdueTasks: overdue, count: overdue.length });
    }

    const pathways = await listPathways(tenantId);
    return NextResponse.json({ pathways, total: pathways.length });
  }),
  { tenantScoped: true, permissionKey: 'opd.visit.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json();

    // Start a pathway instance for a patient
    if (body.action === 'start') {
      if (!body.pathwayId || !body.patientId || !body.encounterId) {
        return NextResponse.json(
          { error: 'pathwayId, patientId, and encounterId are required' },
          { status: 400 },
        );
      }
      const instance = await startPathway(tenantId, userId, body);
      if (!instance) return NextResponse.json({ error: 'Pathway not found' }, { status: 404 });
      return NextResponse.json(instance, { status: 201 });
    }

    // Create new pathway template
    if (!body.name || !body.tasks) {
      return NextResponse.json({ error: 'name and tasks are required' }, { status: 400 });
    }

    const pathway = await createPathway(tenantId, userId, body);
    return NextResponse.json(pathway, { status: 201 });
  }),
  { tenantScoped: true, permissionKey: 'opd.visit.create' },
);
