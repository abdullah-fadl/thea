/**
 * Imdad Simulation Types
 *
 * Shared type definitions for the SCM simulation engine.
 */

export type SimulationStatus = 'running' | 'paused' | 'stopped' | 'not_initialized';

export type SpeedMultiplier = 1 | 5 | 10 | 20 | 60;

export type ScenarioType =
  | 'DEMAND_SPIKE'
  | 'SUPPLY_DISRUPTION'
  | 'QUALITY_ISSUE'
  | 'BUDGET_FREEZE'
  | 'VENDOR_DELAY'
  | 'EMERGENCY_ORDER'
  | 'SEASONAL_SURGE'
  | 'REGULATORY_AUDIT';

export interface ActiveScenario {
  type: ScenarioType;
  hospitalIds: string[];
  intensity: number; // 0..1
  startedAtTick: number;
  durationTicks: number;
}

export interface SimulationConfig {
  id: string;
  tenantId: string;
  status: SimulationStatus;
  speedMultiplier: SpeedMultiplier;
  tickIntervalSeconds: number;
  totalTicks: number;
  simulationTime: string; // ISO timestamp
  activeScenarios: ActiveScenario[];
  createdAt: string;
  updatedAt: string;
}

export interface SimulationEvent {
  id: string;
  tick: number;
  simulationTime: string;
  eventType: string;
  message: string;
  hospitalId?: string;
  departmentId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface TickResult {
  tick: number;
  simulationTime: string;
  eventsGenerated: number;
  activeScenarios: ActiveScenario[];
}
