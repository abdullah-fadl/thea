import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { executeTick, getSimulationConfig, initializeSimulation } from '@/lib/imdad/simulation/engine';

export const POST = withAuthTenant(
  async (_req, { tenantId }) => {
    await initializeSimulation(tenantId);
    const config = await getSimulationConfig(tenantId);
    if (!config || config.status !== 'running') {
      return NextResponse.json(
        { error: 'Simulation is not running', status: config?.status ?? 'not_initialized' },
        { status: 400 },
      );
    }

    const result = await executeTick(tenantId);
    return NextResponse.json({ data: result });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.admin' },
);
