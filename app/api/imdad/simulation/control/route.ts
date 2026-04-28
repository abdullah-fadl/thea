import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import {
  initializeSimulation,
  updateSimulationStatus,
  updateSimulationSpeed,
  updateTickInterval,
  getSimulationConfig,
  createOrResetConfig,
} from '@/lib/imdad/simulation/engine';
import type { SimulationStatus, SpeedMultiplier } from '@/lib/imdad/simulation/types';

export const GET = withAuthTenant(
  async (_req, { tenantId }) => {
    const config = await initializeSimulation(tenantId);
    return NextResponse.json({ data: config });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.admin' },
);

export const POST = withAuthTenant(
  async (req, { tenantId }) => {
    const body = await req.json();
    const { action, speed, tickInterval } = body as {
      action?: 'start' | 'pause' | 'resume' | 'stop' | 'reset';
      speed?: SpeedMultiplier;
      tickInterval?: number;
    };

    await initializeSimulation(tenantId);

    if (action) {
      switch (action) {
        case 'start':
        case 'resume':
          await updateSimulationStatus(tenantId, 'running');
          break;
        case 'pause':
          await updateSimulationStatus(tenantId, 'paused');
          break;
        case 'stop':
          await updateSimulationStatus(tenantId, 'stopped');
          break;
        case 'reset':
          await createOrResetConfig(tenantId);
          break;
      }
    }

    if (speed && [1, 5, 10, 20, 60].includes(speed)) {
      await updateSimulationSpeed(tenantId, speed);
    }

    if (tickInterval && tickInterval >= 10 && tickInterval <= 3600) {
      await updateTickInterval(tenantId, tickInterval);
    }

    const config = await getSimulationConfig(tenantId);
    return NextResponse.json({ data: config });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.admin' },
);
