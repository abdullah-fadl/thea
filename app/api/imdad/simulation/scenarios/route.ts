import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import {
  getSimulationConfig,
  updateActiveScenarios,
  initializeSimulation,
  logSimulationEvent,
} from '@/lib/imdad/simulation/engine';
import { SCENARIO_DEFINITIONS } from '@/lib/imdad/simulation/scenarios';
import type { ActiveScenario, ScenarioType } from '@/lib/imdad/simulation/types';

/** GET — list available scenarios and currently active ones */
export const GET = withAuthTenant(
  async (_req, { tenantId }) => {
    await initializeSimulation(tenantId);
    const config = await getSimulationConfig(tenantId);
    return NextResponse.json({
      data: {
        available: SCENARIO_DEFINITIONS,
        active: config?.activeScenarios ?? [],
      },
    });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.admin' },
);

/** POST — inject or remove a scenario */
export const POST = withAuthTenant(
  async (req, { tenantId }) => {
    await initializeSimulation(tenantId);
    const config = await getSimulationConfig(tenantId);
    if (!config) {
      return NextResponse.json({ error: 'Simulation not initialized' }, { status: 400 });
    }

    const body = await req.json();
    const { action, scenarioType, intensity, durationTicks, hospitalIds } = body as {
      action: 'inject' | 'remove' | 'clear';
      scenarioType?: ScenarioType;
      intensity?: number;
      durationTicks?: number;
      hospitalIds?: string[];
    };

    const current = (config.activeScenarios ?? []) as ActiveScenario[];

    if (action === 'clear') {
      await updateActiveScenarios(tenantId, []);
      await logSimulationEvent(tenantId, config.totalTicks, new Date(config.simulationTime), 'SCENARIOS_CLEARED', 'All active scenarios cleared');
      return NextResponse.json({ data: { active: [] } });
    }

    if (action === 'inject' && scenarioType) {
      const def = SCENARIO_DEFINITIONS.find(d => d.type === scenarioType);
      if (!def) {
        return NextResponse.json({ error: 'Unknown scenario type' }, { status: 400 });
      }

      const newScenario: ActiveScenario = {
        type: scenarioType,
        hospitalIds: hospitalIds ?? [],
        intensity: Math.min(1, Math.max(0, intensity ?? def.defaultIntensity)),
        startedAtTick: config.totalTicks,
        durationTicks: durationTicks ?? def.defaultDurationTicks,
      };

      // Replace if same type exists
      const updated = current.filter(s => s.type !== scenarioType);
      updated.push(newScenario);
      await updateActiveScenarios(tenantId, updated);

      await logSimulationEvent(
        tenantId,
        config.totalTicks, new Date(config.simulationTime), 'SCENARIO_INJECTED',
        `Scenario injected: ${def.nameEn} (intensity: ${newScenario.intensity})`,
        undefined, undefined, { scenario: newScenario },
      );

      return NextResponse.json({ data: { active: updated } });
    }

    if (action === 'remove' && scenarioType) {
      const updated = current.filter(s => s.type !== scenarioType);
      await updateActiveScenarios(tenantId, updated);
      return NextResponse.json({ data: { active: updated } });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.admin' },
);
