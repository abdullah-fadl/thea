/**
 * Imdad Simulation Engine
 *
 * Manages simulation lifecycle (init, start, pause, stop, reset)
 * and executes simulation ticks that generate SCM events.
 *
 * All functions accept a tenantId parameter to respect multi-tenancy.
 */

import { prisma } from '@/lib/db/prisma';
import type {
  ActiveScenario,
  SimulationConfig,
  SimulationStatus,
  SpeedMultiplier,
  TickResult,
} from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONFIG_KEY = 'imdad.simulation.config';

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

async function loadConfigRow(tenantId: string) {
  return prisma.imdadSystemConfig.findFirst({
    where: { tenantId, configKey: CONFIG_KEY },
  });
}

function parseConfig(row: { configValue: any } | null): SimulationConfig | null {
  if (!row?.configValue) return null;
  return row.configValue as unknown as SimulationConfig;
}

/** Get the current simulation config, or null if not initialized. */
export async function getSimulationConfig(tenantId: string): Promise<SimulationConfig | null> {
  const row = await loadConfigRow(tenantId);
  return parseConfig(row);
}

/** Initialize the simulation if it has not been initialized yet. Returns the config. */
export async function initializeSimulation(tenantId: string): Promise<SimulationConfig> {
  const existing = await getSimulationConfig(tenantId);
  if (existing) return existing;
  return createOrResetConfig(tenantId);
}

/** Create or reset the simulation config to defaults. */
export async function createOrResetConfig(tenantId: string): Promise<SimulationConfig> {
  const now = new Date();
  const config: SimulationConfig = {
    id: crypto.randomUUID(),
    tenantId,
    status: 'paused',
    speedMultiplier: 1,
    tickIntervalSeconds: 60,
    totalTicks: 0,
    simulationTime: now.toISOString(),
    activeScenarios: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await prisma.imdadSystemConfig.upsert({
    where: {
      tenantId_configKey_scope_scopeId: {
        tenantId,
        configKey: CONFIG_KEY,
        scope: 'GLOBAL',
        scopeId: '',
      },
    },
    update: {
      configValue: config as any,
      version: { increment: 1 },
    },
    create: {
      tenantId,
      configKey: CONFIG_KEY,
      configValue: config as any,
      scope: 'GLOBAL',
      createdBy: 'system',
      updatedBy: 'system',
    } as any,
  });

  return config;
}

// ---------------------------------------------------------------------------
// State mutation helpers
// ---------------------------------------------------------------------------

async function updateConfig(tenantId: string, patch: Partial<SimulationConfig>): Promise<SimulationConfig> {
  const current = await getSimulationConfig(tenantId);
  if (!current) throw new Error('Simulation not initialized');

  const updated: SimulationConfig = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await prisma.imdadSystemConfig.updateMany({
    where: { tenantId, configKey: CONFIG_KEY },
    data: { configValue: updated as any },
  });

  return updated;
}

export async function updateSimulationStatus(tenantId: string, status: SimulationStatus): Promise<SimulationConfig> {
  return updateConfig(tenantId, { status });
}

export async function updateSimulationSpeed(tenantId: string, speed: SpeedMultiplier): Promise<SimulationConfig> {
  return updateConfig(tenantId, { speedMultiplier: speed });
}

export async function updateTickInterval(tenantId: string, seconds: number): Promise<SimulationConfig> {
  return updateConfig(tenantId, { tickIntervalSeconds: seconds });
}

export async function updateActiveScenarios(tenantId: string, scenarios: ActiveScenario[]): Promise<SimulationConfig> {
  return updateConfig(tenantId, { activeScenarios: scenarios });
}

// ---------------------------------------------------------------------------
// Event logging
// ---------------------------------------------------------------------------

export async function logSimulationEvent(
  tenantId: string,
  tick: number,
  simulationTime: Date,
  eventType: string,
  message: string,
  hospitalId?: string,
  departmentId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO imdad_simulation_events (id, tenant_id, tick, simulation_time, event_type, message, hospital_id, department_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
      crypto.randomUUID(),
      tenantId,
      tick,
      simulationTime,
      eventType,
      message,
      hospitalId ?? null,
      departmentId ?? null,
      metadata ? JSON.stringify(metadata) : null,
      new Date(),
    );
  } catch (err) {
    // Simulation events table may not exist yet; log and continue
    console.warn('[SIM_ENGINE] Failed to log simulation event:', err);
  }
}

/** Get recent simulation events, ordered newest first. */
export async function getRecentEvents(tenantId: string, limit = 20): Promise<unknown[]> {
  try {
    const events = await prisma.$queryRawUnsafe<unknown[]>(
      `SELECT * FROM imdad_simulation_events WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      tenantId,
      limit,
    );
    return events;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Tick execution
// ---------------------------------------------------------------------------

/** Execute a single simulation tick. Advances the clock and generates events. */
export async function executeTick(tenantId: string): Promise<TickResult> {
  const config = await getSimulationConfig(tenantId);
  if (!config) throw new Error('Simulation not initialized');

  const newTick = config.totalTicks + 1;
  const advanceMs = config.tickIntervalSeconds * 1000 * config.speedMultiplier;
  const newSimTime = new Date(new Date(config.simulationTime).getTime() + advanceMs);

  // Expire completed scenarios
  const activeScenarios = config.activeScenarios.filter(
    (s) => newTick - s.startedAtTick < s.durationTicks,
  );

  // Log tick event
  await logSimulationEvent(tenantId, newTick, newSimTime, 'TICK', `Tick ${newTick} executed`, undefined, undefined, {
    speedMultiplier: config.speedMultiplier,
    activeScenarioCount: activeScenarios.length,
  });

  // Generate scenario-specific events
  let eventsGenerated = 1; // the tick event itself
  for (const scenario of activeScenarios) {
    const shouldGenerate = Math.random() < scenario.intensity;
    if (shouldGenerate) {
      await logSimulationEvent(
        tenantId,
        newTick,
        newSimTime,
        `SCENARIO_${scenario.type}`,
        `Scenario ${scenario.type} triggered event at tick ${newTick}`,
        scenario.hospitalIds[0],
        undefined,
        { intensity: scenario.intensity, ticksSinceStart: newTick - scenario.startedAtTick },
      );
      eventsGenerated++;
    }
  }

  // Persist updated config
  await updateConfig(tenantId, {
    totalTicks: newTick,
    simulationTime: newSimTime.toISOString(),
    activeScenarios,
  });

  return {
    tick: newTick,
    simulationTime: newSimTime.toISOString(),
    eventsGenerated,
    activeScenarios,
  };
}
