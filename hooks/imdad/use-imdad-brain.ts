'use client';

/**
 * useImdadBrain — Imdad Supply Chain Intelligence Brain
 *
 * Central hook that drives all Imdad dashboards with real-time
 * simulation of supply chain metrics, hospital network state,
 * autonomous decisions, and system pulse.
 *
 * Used by: command-center, war-room, my-work, procurement, inventory,
 * warehouse, quality, financial, assets, analytics, approvals, etc.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImdadHospital {
  id: string;
  name: string;
  nameAr: string;
  pressure: number;
  status: string;
  region: string;
  regionAr: string;
  beds: number;
  activePOs: number;
  criticalItems: number;
  lastDelivery: string;
}

export interface ImdadDecision {
  id: string;
  title: string;
  titleAr: string;
  riskScore: number;
  code: string;
  decisionType: string;
  hospitalName: string;
  hospitalNameAr: string;
  domain: string;
  type: string;
  status: string;
  confidence: number;
  createdAt: string;
  financialImpact: {
    estimatedCost: number;
    avoidedLoss: number;
    netImpact: number;
  };
}

export interface ImdadAction {
  id: string;
  title: string;
  titleAr: string;
  hospitalName: string;
  hospitalNameAr: string;
  actionType: string;
  status: string;
  priority: string;
  executedAt: string;
}

export interface ImdadPulse {
  healthScore: number;
  operationalPressure: number;
  activeSignals: number;
  autonomyScore: number;
  trend: 'up' | 'down' | 'stable' | 'improving' | 'degrading' | 'rising' | 'falling';
  cyclesCompleted?: number;
  activeDecisions?: number;
  actionsToday?: number;
}

export interface ImdadPressureDimension {
  key: string;
  label: string;
  labelAr: string;
  pressure: number;
  trend?: string;
  drivers?: { label: string; labelAr: string; value: number; impact: string }[];
}

export interface ImdadPressure {
  composite: number;
  dimensions: ImdadPressureDimension[];
  trend?: string;
}

export interface ImdadImpact {
  visible: boolean;
  costSavings: number;
  riskReduction: number;
  timeSavedHours: number;
}

export type ImdadPhase =
  | 'GLOBAL_STATE'
  | 'SIGNAL_DETECTION'
  | 'CRITICAL_ESCALATION'
  | 'AUTONOMOUS_ACTION'
  | 'SYSTEM_RESPONSE'
  | 'IMPACT_DISPLAY';

export interface ImdadRequest {
  id: string;
  title: string;
  titleAr: string;
  type: string;
  status: string;
  priority: string;
  requester: string;
  requestedBy?: string;
  requestedByAr?: string;
  department: string;
  departmentAr: string;
  delegateTo?: string;
  dueDate: string;
  createdAt: string;
  code?: string;
  slaBreached?: boolean;
  totalEstimatedCost?: number;
  steps: { id: string; name: string; status: string; approver?: string }[];
  items: { name: string; qty: number; unit: string; itemId?: string }[];
}

export interface ImdadSignal {
  id: string;
  title: string;
  titleAr: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  domain: string;
  hospitalName: string;
  hospitalNameAr: string;
  detectedAt: string;
  status: string;
}

export interface ImdadInventoryItem {
  id: string;
  name: string;
  nameAr: string;
  sku: string;
  category: string;
  currentStock: number;
  reorderPoint: number;
  unit: string;
  location: string;
  status: string;
  lastUpdated: string;
  onHand?: number;
  available?: number;
}

export interface ImdadAsset {
  id: string;
  name: string;
  nameAr: string;
  assetTag: string;
  category: string;
  status: string;
  location: string;
  assignedTo?: string;
  purchaseDate: string;
  warrantyExpiry?: string;
}

export interface ImdadProcurement {
  openPOs: number;
  pendingApprovals: number;
  totalSpendMTD: number;
  savingsRate: number;
  topVendors: { name: string; spend: number }[];
}

export interface ImdadAuditEntry {
  id: string;
  action: string;
  actor: string;
  entity: string;
  entityId: string;
  timestamp: string;
  details?: string;
}

export interface ImdadBrainState {
  hospitals: ImdadHospital[];
  decisions: ImdadDecision[];
  actions: ImdadAction[];
  requests: ImdadRequest[];
  signals: ImdadSignal[];
  inventoryItems: ImdadInventoryItem[];
  deviceAssets: ImdadAsset[];
  procurement: ImdadProcurement;
  auditLog: ImdadAuditEntry[];
  pulse: ImdadPulse;
  pressure: ImdadPressure;
  impact: ImdadImpact;
  phase: ImdadPhase;
  scenarioTime: number;
  cycleCount: number;
  isLive: boolean;
  isRunning: boolean;
  lastRefresh: Date;
  setIsLive: (isLive: boolean) => void;
  approveRequestStep: (requestId: string, stepId: string, reason?: string) => void;
  rejectRequestStep: (requestId: string, stepId: string, reason?: string) => void;
  createRequest: (data: Partial<ImdadRequest>) => void;
  getAuditLog: (entity?: string) => ImdadAuditEntry[];
}

// ---------------------------------------------------------------------------
// Seed Data
// ---------------------------------------------------------------------------

const HOSPITALS: ImdadHospital[] = [];

const DECISION_TEMPLATES: Omit<ImdadDecision, 'id' | 'createdAt'>[] = [];

const ACTION_TEMPLATES: Omit<ImdadAction, 'id' | 'executedAt'>[] = [];

// ---------------------------------------------------------------------------
// Phases cycle: 5 seconds each, total 30 seconds per cycle
// ---------------------------------------------------------------------------

const PHASE_SEQUENCE: ImdadPhase[] = [
  'GLOBAL_STATE',
  'SIGNAL_DETECTION',
  'CRITICAL_ESCALATION',
  'AUTONOMOUS_ACTION',
  'SYSTEM_RESPONSE',
  'IMPACT_DISPLAY',
];

const PHASE_DURATION = 5; // seconds per phase

// ---------------------------------------------------------------------------
// Helper: bounded random
// ---------------------------------------------------------------------------

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function jitter(base: number, range: number, min = 0, max = 100) {
  return clamp(base + (Math.random() - 0.5) * range, min, max);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useImdadBrain(): ImdadBrainState {
  const [isLive, setIsLive] = useState(false);
  const [scenarioTime, setScenarioTime] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Derived phase
  const phase = useMemo<ImdadPhase>(() => {
    const idx = Math.floor(scenarioTime / PHASE_DURATION) % PHASE_SEQUENCE.length;
    return PHASE_SEQUENCE[idx];
  }, [scenarioTime]);

  // Hospitals with jittered pressure
  const [hospitals, setHospitals] = useState<ImdadHospital[]>(() =>
    HOSPITALS.map(h => ({ ...h, pressure: rand(10, 40) })),
  );

  // Decisions
  const [decisions, setDecisions] = useState<ImdadDecision[]>(() =>
    DECISION_TEMPLATES.map((d, i) => ({
      ...d,
      id: `dec-${i}-${Date.now()}`,
      createdAt: new Date(Date.now() - rand(0, 600000)).toISOString(),
    })),
  );

  // Actions
  const [actions, setActions] = useState<ImdadAction[]>(() =>
    ACTION_TEMPLATES.map((a, i) => ({
      ...a,
      id: `act-${i}-${Date.now()}`,
      executedAt: new Date(Date.now() - rand(0, 300000)).toISOString(),
    })),
  );

  // Pulse
  const [pulse, setPulse] = useState<ImdadPulse>({
    healthScore: 0,
    operationalPressure: 0,
    activeSignals: 0,
    autonomyScore: 0,
    trend: 'stable',
  });

  // Pressure per domain
  const [pressure, setPressure] = useState<ImdadPressure>({
    composite: 0,
    dimensions: [
      { key: 'procurement', label: 'Procurement', labelAr: 'المشتريات', pressure: 0 },
      { key: 'inventory', label: 'Inventory', labelAr: 'المخزون', pressure: 0 },
      { key: 'warehouse', label: 'Warehouse', labelAr: 'المستودعات', pressure: 0 },
      { key: 'quality', label: 'Quality', labelAr: 'الجودة', pressure: 0 },
      { key: 'financial', label: 'Financial', labelAr: 'المالية', pressure: 0 },
      { key: 'clinical', label: 'Clinical', labelAr: 'السريري', pressure: 0 },
    ],
  });

  // Requests (approval workflows)
  const [requests, setRequests] = useState<ImdadRequest[]>([]);

  // Signals
  const [signals] = useState<ImdadSignal[]>([]);

  // Inventory items
  const [inventoryItems] = useState<ImdadInventoryItem[]>([]);

  // Device assets
  const [deviceAssets] = useState<ImdadAsset[]>([]);

  // Procurement summary
  const [procurement] = useState<ImdadProcurement>({
    openPOs: 0, pendingApprovals: 0, totalSpendMTD: 0, savingsRate: 0,
    topVendors: [],
  });

  // Audit log
  const [auditLog] = useState<ImdadAuditEntry[]>([]);

  // Methods
  const approveRequestStep = useCallback((requestId: string, stepId: string, _reason?: string) => {
    setRequests(prev => prev.map(r => {
      if (r.id !== requestId) return r;
      const steps = r.steps.map(s => s.id === stepId ? { ...s, status: 'APPROVED' } : s);
      const allApproved = steps.every(s => s.status === 'APPROVED');
      return { ...r, steps, status: allApproved ? 'APPROVED' : r.status };
    }));
  }, []);

  const rejectRequestStep = useCallback((requestId: string, stepId: string, _reason?: string) => {
    setRequests(prev => prev.map(r => {
      if (r.id !== requestId) return r;
      const steps = r.steps.map(s => s.id === stepId ? { ...s, status: 'REJECTED' } : s);
      return { ...r, steps, status: 'REJECTED' };
    }));
  }, []);

  const createRequest = useCallback((data: Partial<ImdadRequest>) => {
    const newReq: ImdadRequest = {
      id: `req-${Date.now()}`,
      title: data.title || 'New Request',
      titleAr: data.titleAr || 'طلب جديد',
      type: data.type || 'PURCHASE_REQUEST',
      status: 'PENDING_APPROVAL',
      priority: data.priority || 'MEDIUM',
      requester: data.requester || 'Current User',
      department: data.department || 'General',
      departmentAr: data.departmentAr || 'عام',
      dueDate: data.dueDate || new Date(Date.now() + 604800000).toISOString(),
      createdAt: new Date().toISOString(),
      steps: data.steps || [{ id: 's1', name: 'Manager', status: 'PENDING' }],
      items: data.items || [],
    };
    setRequests(prev => [newReq, ...prev]);
  }, []);

  const getAuditLog = useCallback((entity?: string) => {
    if (!entity) return auditLog;
    return auditLog.filter(e => e.entity === entity);
  }, [auditLog]);

  // Impact
  const [impact, setImpact] = useState<ImdadImpact>({
    visible: false,
    costSavings: 0,
    riskReduction: 0,
    timeSavedHours: 0,
  });

  // ------ Simulation tick ------
  const tickRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const tick = useCallback(() => {
    setScenarioTime(prev => {
      const next = prev + 1;
      if (next >= PHASE_SEQUENCE.length * PHASE_DURATION) {
        setCycleCount(c => c + 1);
        return 0;
      }
      return next;
    });
    setLastRefresh(new Date());

    // Jitter hospitals
    setHospitals(prev =>
      prev.map(h => {
        const newPressure = jitter(h.pressure, 8, 5, 95);
        let status = 'normal';
        if (newPressure > 75) status = 'critical';
        else if (newPressure > 50) status = 'elevated';
        else if (newPressure > 35) status = 'moderate';
        return { ...h, pressure: Math.round(newPressure), status, criticalItems: newPressure > 60 ? rand(1, 5) : h.criticalItems };
      }),
    );

    // Jitter pulse
    setPulse(prev => {
      const healthScore = Math.round(jitter(prev.healthScore, 4, 50, 100));
      const operationalPressure = Math.round(jitter(prev.operationalPressure, 6, 10, 90));
      const activeSignals = clamp(prev.activeSignals + rand(-2, 2), 3, 30);
      const autonomyScore = Math.round(jitter(prev.autonomyScore, 3, 60, 98));
      const trend: ImdadPulse['trend'] =
        healthScore > prev.healthScore ? 'improving' :
        healthScore < prev.healthScore ? 'degrading' :
        operationalPressure > prev.operationalPressure ? 'rising' :
        operationalPressure < prev.operationalPressure ? 'falling' : 'stable';
      return { healthScore, operationalPressure, activeSignals, autonomyScore, trend };
    });

    // Jitter pressure
    setPressure(prev => {
      const newDimensions = prev.dimensions.map(d => ({
        ...d,
        pressure: Math.round(jitter(d.pressure, 6, 5, 95)),
      }));
      const avg = newDimensions.reduce((s, d) => s + d.pressure, 0) / (newDimensions.length || 1);
      return { composite: Math.round(avg), dimensions: newDimensions };
    });

    // Rotate decisions status occasionally
    setDecisions(prev =>
      prev.map(d => {
        if (Math.random() > 0.85) {
          const statuses = ['PENDING', 'EXECUTING', 'COMPLETED'];
          const currentIdx = statuses.indexOf(d.status);
          const nextStatus = statuses[Math.min(currentIdx + 1, statuses.length - 1)];
          return { ...d, status: nextStatus, riskScore: Math.round(jitter(d.riskScore, 5, 10, 100)) };
        }
        return d;
      }),
    );
  }, []);

  // Phase-specific effects
  useEffect(() => {
    if (phase === 'IMPACT_DISPLAY') {
      setImpact({
        visible: true,
        costSavings: rand(50000, 500000),
        riskReduction: rand(15, 45),
        timeSavedHours: rand(10, 80),
      });
    } else {
      setImpact(prev => ({ ...prev, visible: phase === 'SYSTEM_RESPONSE' ? prev.visible : false }));
    }
  }, [phase]);

  // Start/stop simulation
  useEffect(() => {
    if (isLive) {
      tickRef.current = setInterval(tick, 1000);
    } else if (tickRef.current) {
      clearInterval(tickRef.current);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [isLive, tick]);

  return {
    hospitals,
    decisions,
    actions,
    requests,
    signals,
    inventoryItems,
    deviceAssets,
    procurement,
    auditLog,
    pulse,
    pressure,
    impact,
    phase,
    scenarioTime,
    cycleCount,
    isLive,
    isRunning: isLive,
    lastRefresh,
    setIsLive,
    approveRequestStep,
    rejectRequestStep,
    createRequest,
    getAuditLog,
  };
}
