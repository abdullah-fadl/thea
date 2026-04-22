// ===================================================================
// IMDAD BRAIN -- Central Autonomous Decision Engine
// ===================================================================

// ---- Domain Types ----
export type SupplyDomain =
  | 'MEDICAL_CONSUMABLES' | 'MEDICAL_DEVICES' | 'NON_MEDICAL_CONSUMABLES'
  | 'NON_MEDICAL_DEVICES' | 'FURNITURE' | 'OFFICE_EQUIPMENT' | 'IT_SYSTEMS' | 'DENTAL';

// ---- Signal Types ----
export type SignalType =
  | 'DEVICE_FAILURE' | 'VENDOR_DELAY' | 'STOCKOUT' | 'BUDGET_OVERRUN'
  | 'QUALITY_RISK' | 'LIFECYCLE_BREACH' | 'EXPIRY_WARNING' | 'WORKFORCE_STRAIN'
  | 'CLINICAL_DEMAND_SPIKE' | 'MAINTENANCE_DUE' | 'CONTRACT_EXPIRY' | 'COMPLIANCE_VIOLATION';

export type SignalSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Signal {
  id: string;
  type: SignalType;
  severity: SignalSeverity;
  domain: SupplyDomain;
  hospitalId: string;
  hospitalName: string;
  hospitalNameAr: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  metric: number;
  threshold: number;
  detectedAt: Date;
  resolvedAt: Date | null;
  sourceEntity: string;
  sourceEntityId: string;
}

// ---- Decision Types ----
export type DecisionType =
  | 'EMERGENCY_PROCUREMENT' | 'VENDOR_ESCALATION' | 'STOCK_REALLOCATION'
  | 'MAINTENANCE_DISPATCH' | 'BUDGET_ADJUSTMENT' | 'DEVICE_REPLACEMENT'
  | 'SUPPLY_REORDER' | 'RISK_MITIGATION' | 'VENDOR_SWITCH' | 'COST_OPTIMIZATION';

export type DecisionStatus = 'GENERATED' | 'AUTO_APPROVED' | 'PENDING_REVIEW' | 'EXECUTING' | 'COMPLETED' | 'REJECTED';

export interface FinancialImpact {
  estimatedCost: number;    // SAR
  avoidedLoss: number;      // SAR
  netImpact: number;        // SAR (positive = savings)
  budgetDeviation: number;  // percentage
}

export interface ApprovalStep {
  role: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
  timestamp: Date | null;
  autoApproved: boolean;
}

export interface DecisionOutcome {
  status: 'PENDING' | 'SUCCESS' | 'DELAYED' | 'FAILED';
  timeToResolution: number; // seconds
  costAccuracy: number; // actual vs estimated percentage
  riskReduced: boolean;
}

export type ImpactType = 'LOSS' | 'SAVING' | 'RISK' | 'OPPORTUNITY';
export type ImpactCause = 'DELAYED_PROCUREMENT' | 'EMERGENCY_PRICING' | 'EQUIPMENT_DOWNTIME' | 'OVERSTOCK' | 'STOCK_TRANSFER' | 'VENDOR_NEGOTIATION' | 'AVOIDED_EMERGENCY' | 'OPTIMIZED_UTILIZATION' | 'DEMAND_SPIKE' | 'VENDOR_DELAY';

export interface ImpactEntry {
  id: string;
  hospitalId: string;
  hospitalName: string;
  hospitalNameAr: string;
  domain: SupplyDomain;
  type: ImpactType;
  value: number; // SAR (positive = savings, negative = losses stored as positive in LOSS entries)
  trend: 'increasing' | 'stable' | 'decreasing';
  cause: ImpactCause;
  description: string;
  descriptionAr: string;
  linkedDecisionId: string | null;
  timestamp: Date;
}

export interface SupplyChainState {
  totalSpend: number;
  totalSaved: number;
  efficiencyScore: number; // 0-100
  vendorRiskIndex: number; // 0-100
  transferVsProcurementRatio: number; // 0-1
}

export interface ImpactState {
  losses: ImpactEntry[];
  savings: ImpactEntry[];
  risks: ImpactEntry[];
  opportunities: ImpactEntry[];
  supplyChain: SupplyChainState;
}

export type AssetRevenueClass = 'REVENUE_GENERATING' | 'SUPPORT';

export interface RevenueAsset {
  id: string;
  name: string;
  nameAr: string;
  type: string; // MRI, CT, Ultrasound, Endoscopy, CathLab, OR, Xray, Mammography
  hospitalId: string;
  hospitalName: string;
  hospitalNameAr: string;
  revenueClass: AssetRevenueClass;
  utilizationRate: number; // 0-100
  revenuePerHour: number; // SAR
  revenuePerDay: number; // SAR
  hoursPerDay: number; // operating hours
  downtimeLoss: number; // SAR lost to downtime
  missedOpportunities: number; // SAR from idle slots
  status: 'ACTIVE' | 'MAINTENANCE' | 'IDLE' | 'DOWN';
}

export interface RevenueState {
  assets: RevenueAsset[];
  totalDailyRevenue: number;
  totalMissedRevenue: number;
  totalDowntimeLoss: number;
  avgUtilization: number;
  opportunities: RevenueOpportunity[];
}

export interface RevenueOpportunity {
  id: string;
  hospitalId: string;
  hospitalName: string;
  hospitalNameAr: string;
  assetName: string;
  assetNameAr: string;
  type: 'INCREASE_UTILIZATION' | 'ADD_DEVICE' | 'REALLOCATE' | 'REDUCE';
  potentialRevenueSAR: number;
  description: string;
  descriptionAr: string;
}

export interface Decision {
  id: string;
  code: string;
  type: DecisionType;
  status: DecisionStatus;
  domain: SupplyDomain;
  hospitalId: string;
  hospitalName: string;
  hospitalNameAr: string;
  title: string;
  titleAr: string;
  reasoning: string;
  reasoningAr: string;
  confidenceScore: number;
  riskScore: number;
  autoApproved: boolean;
  sourceSignalIds: string[];
  createdAt: Date;
  executedAt: Date | null;
  executingTicks: number;
  impactEstimate: { costSAR: number; riskReduction: number; timeHours: number };
  financialImpact: FinancialImpact;
  requiresApproval: boolean;
  approvalAuthority: string;
  governance: { subsidiary: string; domainOwner: string };
  approvalChain: ApprovalStep[];
  outcome: DecisionOutcome | null;
  impactMetrics: { costBefore: number; costAfter: number; riskBefore: number; riskAfter: number; netImpactSAR: number; timeSaved: number } | null;
}

// ---- Action Types ----
export type ActionType =
  | 'CREATE_PO' | 'NOTIFY_VENDOR' | 'TRANSFER_STOCK' | 'DISPATCH_TECHNICIAN'
  | 'REALLOCATE_BUDGET' | 'EMERGENCY_ORDER' | 'SCHEDULE_INSPECTION' | 'DISPOSAL_REQUEST'
  | 'VENDOR_ALERT' | 'COMPLIANCE_REPORT';

export type ActionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface Action {
  id: string;
  code: string;
  type: ActionType;
  status: ActionStatus;
  decisionId: string;
  decisionCode: string;
  domain: SupplyDomain;
  hospitalId: string;
  hospitalName: string;
  hospitalNameAr: string;
  description: string;
  descriptionAr: string;
  createdAt: Date;
  completedAt: Date | null;
  cost: number;         // SAR
  budgetImpact: number; // SAR
}

// ---- Hospital State ----
export interface HospitalState {
  id: string;
  name: string;
  nameAr: string;
  city: string;
  cityAr: string;
  region: string;
  regionAr: string;
  pressure: number;
  status: 'OPERATIONAL' | 'ELEVATED' | 'HIGH_PRESSURE' | 'CRITICAL';
  activeSignals: number;
  decisionsToday: number;
  domains: Record<SupplyDomain, DomainState>;
  inventory: InventoryState;
  assets: AssetState;
  budget: BudgetState;
  domainBudgets: DomainBudget[];
  budgetPhase: BudgetPhase;
}

export interface DomainState {
  riskScore: number;
  activeItems: number;
  criticalItems: number;
  budgetAllocated: number;
  budgetConsumed: number;
  lifecycleAlerts: number;
  standardizationScore: number;
}

export interface InventoryState {
  totalItems: number;
  belowReorderPoint: number;
  stockoutCount: number;
  expiringWithin90Days: number;
}

export interface AssetState {
  totalDevices: number;
  operational: number;
  underMaintenance: number;
  condemned: number;
  calibrationDue: number;
}

export interface BudgetState {
  allocated: number;
  consumed: number;
  utilizationPct: number;
  overrunRisk: boolean;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  nameAr: string;
  domain: SupplyDomain;
  category: string;
  hospitalId: string;
  location: string; // ward, store, warehouse
  onHand: number;
  reserved: number;
  available: number;
  inTransit: number;
  reorderPoint: number;
  expiryDate: Date | null;
  unit: string;
  manufacturer: string;
}

export interface DeviceAsset {
  id: string;
  serialNumber: string;
  name: string;
  nameAr: string;
  model: string;
  manufacturer: string;
  domain: SupplyDomain;
  hospitalId: string;
  department: string;
  departmentAr: string;
  status: 'ACTIVE' | 'DOWN' | 'MAINTENANCE' | 'AVAILABLE' | 'ASSIGNED' | 'CONDEMNED';
  lastMaintenanceDate: Date;
  nextMaintenanceDate: Date;
  purchaseDate: Date;
  warrantyExpiry: Date;
}

// ---- Procurement Timeline ----
export type ProcurementStage = 'REQUEST' | 'APPROVAL' | 'ORDER' | 'SHIPMENT' | 'DELIVERY';
export type ProcurementRisk = 'ON_TRACK' | 'AT_RISK' | 'DELAYED';

export interface ProcurementOrder {
  id: string;
  code: string;
  title: string;
  titleAr: string;
  vendor: string;
  vendorAr: string;
  domain: SupplyDomain;
  totalSAR: number;
  stage: ProcurementStage;
  delayRisk: ProcurementRisk;
  requestDate: Date;
  approvalDate: Date | null;
  orderDate: Date | null;
  shipmentDate: Date | null;
  expectedDelivery: Date;
  actualDelivery: Date | null;
  hospitalId: string;
  hospitalName: string;
  hospitalNameAr: string;
  slaCompliance: boolean;
  daysInCurrentStage: number;
}

// ---- System Pulse ----
export interface SystemPulse {
  healthScore: number;
  operationalPressure: number;
  trend: 'improving' | 'stable' | 'degrading';
  activeSignals: number;
  activeDecisions: number;
  actionsToday: number;
  cyclesCompleted: number;
  autonomyScore: number;
  lastCycleAt: Date;
}

// ---- Pressure Data ----
export interface PressureDimension {
  key: string;
  label: string;
  labelAr: string;
  pressure: number;
  trend: 'rising' | 'stable' | 'falling';
  drivers: string[];
}

export interface PressureData {
  dimensions: PressureDimension[];
  composite: number;
  state: 'STABLE' | 'ELEVATED' | 'HIGH_PRESSURE' | 'CRITICAL_PRESSURE';
}

// ---- Budget Engine Types ----
export interface DomainBudget {
  domain: SupplyDomain;
  annualBudget: number;
  approvedBudget: number;
  committedSpend: number;
  actualSpend: number;
  forecastSpend: number;
  burnRate: number; // monthly
  variance: number; // actual vs budget percentage
  remainingBudget: number;
  utilization: number; // percentage
}

export type BudgetPhase = 'DEPARTMENT_BUDGETING' | 'HOSPITAL_REVIEW' | 'GROUP_CONSOLIDATION' | 'APPROVAL' | 'EXECUTION';

// ---- Full Brain State ----
// ---- Supply Request Workflow ----
export type RequestType = 'SUPPLY_REQUEST' | 'MAINTENANCE_REQUEST' | 'TRANSFER_REQUEST' | 'BUDGET_REQUEST' | 'REPLENISHMENT_REQUEST';
export type RequestStatus = 'DRAFT' | 'SUBMITTED' | 'IN_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PO_GENERATED' | 'ORDERED' | 'DELIVERED' | 'WORK_ORDER_CREATED' | 'TRANSFER_INITIATED' | 'BUDGET_APPROVED' | 'COMPLETED';

export interface RequestApprovalStep {
  role: string;
  roleName: string;
  roleNameAr: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WAITING' | 'ESCALATED';
  timestamp: Date | null;
  comments: string;
  slaHours: number;
  pendingSince: Date | null;
  escalatedTo: string | null;
}

export interface SupplyRequest {
  id: string;
  code: string;
  requestType: RequestType;
  hospitalId: string;
  hospitalName: string;
  hospitalNameAr: string;
  department: string;
  departmentAr: string;
  requestedBy: string;
  requestedByAr: string;
  requestedByRole: string;
  domain: SupplyDomain;
  items: Array<{
    itemId: string;
    name: string;
    nameAr: string;
    sku: string;
    quantity: number;
    unit: string;
    estimatedCost: number;
  }>;
  totalEstimatedCost: number;
  priority: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  justification: string;
  justificationAr: string;
  status: RequestStatus;
  approvalChain: RequestApprovalStep[];
  currentApprovalStep: number;
  createdAt: Date;
  updatedAt: Date;
  poCode: string | null;
  expectedDelivery: Date | null;
  slaDeadline: Date;
  slaBreached: boolean;
  // Maintenance-specific
  deviceId?: string;
  deviceName?: string;
  deviceNameAr?: string;
  maintenanceType?: 'PREVENTIVE' | 'CORRECTIVE' | 'EMERGENCY';
  workOrderCode?: string;
  // Transfer-specific
  sourceHospitalId?: string;
  sourceHospitalName?: string;
  sourceHospitalNameAr?: string;
  targetHospitalId?: string;
  targetHospitalName?: string;
  targetHospitalNameAr?: string;
  // Budget-specific
  budgetCategory?: string;
  budgetPeriod?: string;
  budgetAmount?: number;
}

export interface ImdadState {
  hospitals: HospitalState[];
  signals: Signal[];
  decisions: Decision[];
  actions: Action[];
  pulse: SystemPulse;
  pressure: PressureData;
  procurement: ProcurementOrder[];
  impact: ImpactState;
  revenue: RevenueState;
  inventoryItems: InventoryItem[];
  deviceAssets: DeviceAsset[];
  requests: SupplyRequest[];
  auditLog: AuditEntry[];
  cycleCount: number;
  isRunning: boolean;
}

// ---- Audit Trail ----
export interface AuditEntry {
  id: string;
  timestamp: Date;
  requestId: string;
  requestCode: string;
  action: 'CREATED' | 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'SLA_BREACHED' | 'COMPLETED' | 'STATE_CHANGE';
  performedBy: string;
  performedByRole: string;
  previousState: string;
  newState: string;
  stepRole: string | null;
  comments: string;
  metadata: Record<string, any>;
}

// ---- Hospital Definitions ----
interface HospitalDef {
  id: string; name: string; nameAr: string;
  city: string; cityAr: string; region: string; regionAr: string;
  basePressure: number; budgetBase: number;
}

const HOSPITALS: HospitalDef[] = [
  { id: 'RYD-CTR', name: 'Thea Central', nameAr: '\u062B\u064A\u0627 \u0627\u0644\u0645\u0631\u0643\u0632\u064A', city: 'Riyadh', cityAr: '\u0627\u0644\u0631\u064A\u0627\u0636', region: 'Central', regionAr: '\u0627\u0644\u0648\u0633\u0637\u0649', basePressure: 32, budgetBase: 45_000_000 },
  { id: 'RYD-SPC', name: 'Thea Specialist', nameAr: '\u062B\u064A\u0627 \u0627\u0644\u062A\u062E\u0635\u0635\u064A', city: 'Riyadh', cityAr: '\u0627\u0644\u0631\u064A\u0627\u0636', region: 'Central', regionAr: '\u0627\u0644\u0648\u0633\u0637\u0649', basePressure: 38, budgetBase: 38_000_000 },
  { id: 'RYD-WCH', name: 'Thea Women & Children', nameAr: '\u062B\u064A\u0627 \u0627\u0644\u0646\u0633\u0627\u0621 \u0648\u0627\u0644\u0623\u0637\u0641\u0627\u0644', city: 'Riyadh', cityAr: '\u0627\u0644\u0631\u064A\u0627\u0636', region: 'Central', regionAr: '\u0627\u0644\u0648\u0633\u0637\u0649', basePressure: 28, budgetBase: 32_000_000 },
  { id: 'RYD-RHB', name: 'Thea Rehab', nameAr: '\u062B\u064A\u0627 \u0627\u0644\u062A\u0623\u0647\u064A\u0644', city: 'Riyadh', cityAr: '\u0627\u0644\u0631\u064A\u0627\u0636', region: 'Central', regionAr: '\u0627\u0644\u0648\u0633\u0637\u0649', basePressure: 20, budgetBase: 18_000_000 },
  { id: 'RYD-DNT', name: 'Thea Dental Center', nameAr: '\u0645\u0631\u0643\u0632 \u062B\u064A\u0627 \u0644\u0637\u0628 \u0627\u0644\u0623\u0633\u0646\u0627\u0646', city: 'Riyadh', cityAr: '\u0627\u0644\u0631\u064A\u0627\u0636', region: 'Central', regionAr: '\u0627\u0644\u0648\u0633\u0637\u0649', basePressure: 15, budgetBase: 12_000_000 },
  { id: 'JED-NTH', name: 'Thea Jeddah North', nameAr: '\u062B\u064A\u0627 \u062C\u062F\u0629 \u0627\u0644\u0634\u0645\u0627\u0644\u064A', city: 'Jeddah', cityAr: '\u062C\u062F\u0629', region: 'Western', regionAr: '\u0627\u0644\u063A\u0631\u0628\u064A\u0629', basePressure: 35, budgetBase: 30_000_000 },
  { id: 'JED-STH', name: 'Thea Jeddah South', nameAr: '\u062B\u064A\u0627 \u062C\u062F\u0629 \u0627\u0644\u062C\u0646\u0648\u0628\u064A', city: 'Jeddah', cityAr: '\u062C\u062F\u0629', region: 'Western', regionAr: '\u0627\u0644\u063A\u0631\u0628\u064A\u0629', basePressure: 30, budgetBase: 26_000_000 },
  { id: 'DMM-001', name: 'Thea Dammam', nameAr: '\u062B\u064A\u0627 \u0627\u0644\u062F\u0645\u0627\u0645', city: 'Dammam', cityAr: '\u0627\u0644\u062F\u0645\u0627\u0645', region: 'Eastern', regionAr: '\u0627\u0644\u0634\u0631\u0642\u064A\u0629', basePressure: 33, budgetBase: 28_000_000 },
  { id: 'KHB-001', name: 'Thea Khobar', nameAr: '\u062B\u064A\u0627 \u0627\u0644\u062E\u0628\u0631', city: 'Khobar', cityAr: '\u0627\u0644\u062E\u0628\u0631', region: 'Eastern', regionAr: '\u0627\u0644\u0634\u0631\u0642\u064A\u0629', basePressure: 25, budgetBase: 22_000_000 },
  { id: 'MED-001', name: 'Thea Madinah', nameAr: '\u062B\u064A\u0627 \u0627\u0644\u0645\u062F\u064A\u0646\u0629', city: 'Madinah', cityAr: '\u0627\u0644\u0645\u062F\u064A\u0646\u0629', region: 'Western', regionAr: '\u0627\u0644\u063A\u0631\u0628\u064A\u0629', basePressure: 22, budgetBase: 20_000_000 },
  { id: 'ABH-001', name: 'Thea Abha', nameAr: '\u062B\u064A\u0627 \u0623\u0628\u0647\u0627', city: 'Abha', cityAr: '\u0623\u0628\u0647\u0627', region: 'Southern', regionAr: '\u0627\u0644\u062C\u0646\u0648\u0628\u064A\u0629', basePressure: 18, budgetBase: 16_000_000 },
  { id: 'TBK-001', name: 'Thea Tabuk', nameAr: '\u062B\u064A\u0627 \u062A\u0628\u0648\u0643', city: 'Tabuk', cityAr: '\u062A\u0628\u0648\u0643', region: 'Northern', regionAr: '\u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629', basePressure: 19, budgetBase: 15_000_000 },
  { id: 'HAL-001', name: 'Thea Hail', nameAr: '\u062B\u064A\u0627 \u062D\u0627\u0626\u0644', city: 'Hail', cityAr: '\u062D\u0627\u0626\u0644', region: 'Northern', regionAr: '\u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629', basePressure: 17, budgetBase: 14_000_000 },
  { id: 'QSM-001', name: 'Thea Qassim', nameAr: '\u062B\u064A\u0627 \u0627\u0644\u0642\u0635\u064A\u0645', city: 'Qassim', cityAr: '\u0627\u0644\u0642\u0635\u064A\u0645', region: 'Central', regionAr: '\u0627\u0644\u0648\u0633\u0637\u0649', basePressure: 21, budgetBase: 17_000_000 },
];

const ALL_DOMAINS: SupplyDomain[] = [
  'MEDICAL_CONSUMABLES', 'MEDICAL_DEVICES', 'NON_MEDICAL_CONSUMABLES',
  'NON_MEDICAL_DEVICES', 'FURNITURE', 'OFFICE_EQUIPMENT', 'IT_SYSTEMS', 'DENTAL',
];

const DOMAIN_SIGNALS: Record<SupplyDomain, SignalType[]> = {
  MEDICAL_DEVICES: ['DEVICE_FAILURE', 'LIFECYCLE_BREACH', 'MAINTENANCE_DUE', 'QUALITY_RISK'],
  MEDICAL_CONSUMABLES: ['STOCKOUT', 'EXPIRY_WARNING', 'QUALITY_RISK'],
  NON_MEDICAL_CONSUMABLES: ['STOCKOUT', 'EXPIRY_WARNING'],
  NON_MEDICAL_DEVICES: ['DEVICE_FAILURE', 'MAINTENANCE_DUE'],
  FURNITURE: ['LIFECYCLE_BREACH', 'QUALITY_RISK'],
  OFFICE_EQUIPMENT: ['DEVICE_FAILURE', 'MAINTENANCE_DUE'],
  IT_SYSTEMS: ['DEVICE_FAILURE', 'COMPLIANCE_VIOLATION'],
  DENTAL: ['DEVICE_FAILURE', 'STOCKOUT', 'MAINTENANCE_DUE', 'EXPIRY_WARNING'],
};

const UNIVERSAL_SIGNALS: SignalType[] = ['BUDGET_OVERRUN', 'VENDOR_DELAY', 'CONTRACT_EXPIRY', 'WORKFORCE_STRAIN'];

const SIGNAL_TITLES: Record<SignalType, { en: string; ar: string }> = {
  DEVICE_FAILURE: { en: 'Device Failure Detected', ar: '\u0627\u0643\u062A\u0634\u0627\u0641 \u0639\u0637\u0644 \u0641\u064A \u0627\u0644\u062C\u0647\u0627\u0632' },
  VENDOR_DELAY: { en: 'Vendor Delivery Delay', ar: '\u062A\u0623\u062E\u0631 \u062A\u0648\u0631\u064A\u062F \u0627\u0644\u0645\u0648\u0631\u062F' },
  STOCKOUT: { en: 'Stock Depleted', ar: '\u0646\u0641\u0627\u062F \u0627\u0644\u0645\u062E\u0632\u0648\u0646' },
  BUDGET_OVERRUN: { en: 'Budget Overrun Risk', ar: '\u062E\u0637\u0631 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u0645\u064A\u0632\u0627\u0646\u064A\u0629' },
  QUALITY_RISK: { en: 'Quality Risk Identified', ar: '\u062A\u062D\u062F\u064A\u062F \u0645\u062E\u0627\u0637\u0631 \u0627\u0644\u062C\u0648\u062F\u0629' },
  LIFECYCLE_BREACH: { en: 'Asset Lifecycle Breach', ar: '\u062A\u062C\u0627\u0648\u0632 \u062F\u0648\u0631\u0629 \u062D\u064A\u0627\u0629 \u0627\u0644\u0623\u0635\u0644' },
  EXPIRY_WARNING: { en: 'Expiry Warning', ar: '\u062A\u062D\u0630\u064A\u0631 \u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629' },
  WORKFORCE_STRAIN: { en: 'Workforce Strain', ar: '\u0636\u063A\u0637 \u0639\u0644\u0649 \u0627\u0644\u0642\u0648\u0649 \u0627\u0644\u0639\u0627\u0645\u0644\u0629' },
  CLINICAL_DEMAND_SPIKE: { en: 'Clinical Demand Spike', ar: '\u0627\u0631\u062A\u0641\u0627\u0639 \u0645\u0641\u0627\u062C\u0626 \u0641\u064A \u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u0633\u0631\u064A\u0631\u064A' },
  MAINTENANCE_DUE: { en: 'Maintenance Overdue', ar: '\u0635\u064A\u0627\u0646\u0629 \u0645\u062A\u0623\u062E\u0631\u0629' },
  CONTRACT_EXPIRY: { en: 'Contract Expiring', ar: '\u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0639\u0642\u062F' },
  COMPLIANCE_VIOLATION: { en: 'Compliance Violation', ar: '\u0645\u062E\u0627\u0644\u0641\u0629 \u0627\u0644\u0627\u0645\u062A\u062B\u0627\u0644' },
};

const DECISION_MAP: Record<SignalType, { type: DecisionType; confidence: number }[]> = {
  DEVICE_FAILURE: [{ type: 'MAINTENANCE_DISPATCH', confidence: 90 }],
  STOCKOUT: [{ type: 'SUPPLY_REORDER', confidence: 85 }],
  VENDOR_DELAY: [{ type: 'VENDOR_ESCALATION', confidence: 80 }],
  BUDGET_OVERRUN: [{ type: 'BUDGET_ADJUSTMENT', confidence: 75 }, { type: 'COST_OPTIMIZATION', confidence: 70 }],
  QUALITY_RISK: [{ type: 'RISK_MITIGATION', confidence: 85 }],
  LIFECYCLE_BREACH: [{ type: 'DEVICE_REPLACEMENT', confidence: 88 }],
  EXPIRY_WARNING: [{ type: 'SUPPLY_REORDER', confidence: 82 }],
  MAINTENANCE_DUE: [{ type: 'MAINTENANCE_DISPATCH', confidence: 92 }],
  WORKFORCE_STRAIN: [{ type: 'RISK_MITIGATION', confidence: 72 }],
  CLINICAL_DEMAND_SPIKE: [{ type: 'EMERGENCY_PROCUREMENT', confidence: 88 }],
  CONTRACT_EXPIRY: [{ type: 'VENDOR_SWITCH', confidence: 78 }],
  COMPLIANCE_VIOLATION: [{ type: 'RISK_MITIGATION', confidence: 90 }],
};

const DECISION_ACTIONS: Record<DecisionType, ActionType[]> = {
  EMERGENCY_PROCUREMENT: ['CREATE_PO', 'EMERGENCY_ORDER'],
  VENDOR_ESCALATION: ['VENDOR_ALERT', 'NOTIFY_VENDOR'],
  STOCK_REALLOCATION: ['TRANSFER_STOCK'],
  MAINTENANCE_DISPATCH: ['DISPATCH_TECHNICIAN', 'SCHEDULE_INSPECTION'],
  BUDGET_ADJUSTMENT: ['REALLOCATE_BUDGET'],
  DEVICE_REPLACEMENT: ['DISPOSAL_REQUEST', 'CREATE_PO'],
  SUPPLY_REORDER: ['CREATE_PO'],
  RISK_MITIGATION: ['COMPLIANCE_REPORT'],
  VENDOR_SWITCH: ['VENDOR_ALERT', 'CREATE_PO'],
  COST_OPTIMIZATION: ['REALLOCATE_BUDGET'],
};

const DECISION_TITLES: Record<DecisionType, { en: string; ar: string }> = {
  EMERGENCY_PROCUREMENT: { en: 'Emergency Procurement', ar: '\u0634\u0631\u0627\u0621 \u0637\u0627\u0631\u0626' },
  VENDOR_ESCALATION: { en: 'Vendor Escalation', ar: '\u062A\u0635\u0639\u064A\u062F \u0644\u0644\u0645\u0648\u0631\u062F' },
  STOCK_REALLOCATION: { en: 'Stock Reallocation', ar: '\u0625\u0639\u0627\u062F\u0629 \u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u0645\u062E\u0632\u0648\u0646' },
  MAINTENANCE_DISPATCH: { en: 'Maintenance Dispatch', ar: '\u0625\u0631\u0633\u0627\u0644 \u0641\u0631\u064A\u0642 \u0627\u0644\u0635\u064A\u0627\u0646\u0629' },
  BUDGET_ADJUSTMENT: { en: 'Budget Adjustment', ar: '\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u064A\u0632\u0627\u0646\u064A\u0629' },
  DEVICE_REPLACEMENT: { en: 'Device Replacement', ar: '\u0627\u0633\u062A\u0628\u062F\u0627\u0644 \u0627\u0644\u062C\u0647\u0627\u0632' },
  SUPPLY_REORDER: { en: 'Supply Reorder', ar: '\u0625\u0639\u0627\u062F\u0629 \u0637\u0644\u0628 \u0627\u0644\u0645\u0633\u062A\u0644\u0632\u0645\u0627\u062A' },
  RISK_MITIGATION: { en: 'Risk Mitigation', ar: '\u062A\u062E\u0641\u064A\u0641 \u0627\u0644\u0645\u062E\u0627\u0637\u0631' },
  VENDOR_SWITCH: { en: 'Vendor Switch', ar: '\u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0645\u0648\u0631\u062F' },
  COST_OPTIMIZATION: { en: 'Cost Optimization', ar: '\u062A\u062D\u0633\u064A\u0646 \u0627\u0644\u062A\u0643\u0627\u0644\u064A\u0641' },
};

const PROCUREMENT_STAGES: ProcurementStage[] = ['REQUEST', 'APPROVAL', 'ORDER', 'SHIPMENT', 'DELIVERY'];

// ---- Utility ----
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randf(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function year(): number { return new Date().getFullYear(); }

// ===================================================================
// ImdadBrain Class
// ===================================================================
export class ImdadBrain {
  private static instance: ImdadBrain | null = null;
  private state: ImdadState;
  private listeners: Set<(state: ImdadState) => void> = new Set();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private decisionCounter = 0;
  private signalCounter = 0;
  private actionCounter = 0;
  private procurementCounter = 0;

  private constructor() {
    this.state = this.initializeState();
  }

  static getInstance(): ImdadBrain {
    if (!ImdadBrain.instance) {
      ImdadBrain.instance = new ImdadBrain();
    }
    return ImdadBrain.instance;
  }

  subscribe(listener: (state: ImdadState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): ImdadState {
    return this.state;
  }

  start(): void {
    if (this.state.isRunning) return;
    this.state.isRunning = true;
    this.intervalId = setInterval(() => this.tick(), 1000);
    this.notify();
  }

  stop(): void {
    this.state.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.notify();
  }

  // ---- State Initialization ----

  private initializeState(): ImdadState {
    const hospitals = HOSPITALS.map(h => this.buildHospital(h));
    const procurement = this.buildInitialProcurement(hospitals);
    const inventoryItems = this.buildInventoryItems(hospitals);
    const deviceAssets = this.buildDeviceAssets(hospitals);

    return {
      hospitals,
      signals: [],
      decisions: [],
      actions: [],
      pulse: {
        healthScore: 85,
        operationalPressure: 25,
        trend: 'stable',
        activeSignals: 0,
        activeDecisions: 0,
        actionsToday: 0,
        cyclesCompleted: 0,
        autonomyScore: 92,
        lastCycleAt: new Date(),
      },
      pressure: {
        dimensions: this.buildPressureDimensions(),
        composite: 25,
        state: 'STABLE',
      },
      procurement,
      impact: {
        losses: [],
        savings: [],
        risks: [],
        opportunities: [],
        supplyChain: { totalSpend: 0, totalSaved: 0, efficiencyScore: 85, vendorRiskIndex: 20, transferVsProcurementRatio: 0 },
      },
      revenue: this.buildRevenueState(hospitals),
      inventoryItems,
      deviceAssets,
      requests: [],
      auditLog: [],
      cycleCount: 0,
      isRunning: false,
    };
  }

  private buildHospital(def: HospitalDef): HospitalState {
    const domains = {} as Record<SupplyDomain, DomainState>;
    const domainShareMap: Record<SupplyDomain, number> = {
      MEDICAL_DEVICES: 0.30,
      MEDICAL_CONSUMABLES: 0.25,
      IT_SYSTEMS: 0.15,
      NON_MEDICAL_CONSUMABLES: 0.08,
      NON_MEDICAL_DEVICES: 0.07,
      FURNITURE: 0.05,
      OFFICE_EQUIPMENT: 0.05,
      DENTAL: 0.05,
    };

    const domainBudgets: DomainBudget[] = [];

    for (const d of ALL_DOMAINS) {
      const share = domainShareMap[d];
      const allocated = Math.round(def.budgetBase * share);
      domains[d] = {
        riskScore: rand(5, 35),
        activeItems: rand(50, 800),
        criticalItems: rand(0, 8),
        budgetAllocated: allocated,
        budgetConsumed: Math.round(allocated * randf(0.4, 0.75)),
        lifecycleAlerts: rand(0, 4),
        standardizationScore: rand(70, 98),
      };

      // Build DomainBudget entry
      const annualBudget = allocated;
      const committedSpend = Math.round(annualBudget * randf(0.0, 0.30));
      const actualSpend = Math.round(annualBudget * randf(0.0, 0.20));
      const forecastSpend = Math.round(annualBudget * 0.95);
      const burnRate = Math.round(actualSpend / 3); // March = 3 months in
      const expectedSpend = Math.round(annualBudget * 3 / 12);
      const variance = expectedSpend > 0 ? Math.round(((actualSpend - expectedSpend) / expectedSpend) * 10000) / 100 : 0;
      const remainingBudget = annualBudget - actualSpend;
      const utilization = annualBudget > 0 ? Math.round((actualSpend / annualBudget) * 10000) / 100 : 0;

      domainBudgets.push({
        domain: d,
        annualBudget,
        approvedBudget: annualBudget,
        committedSpend,
        actualSpend,
        forecastSpend,
        burnRate,
        variance,
        remainingBudget,
        utilization,
      });
    }

    const totalDevices = rand(200, 1200);
    const operational = Math.round(totalDevices * randf(0.88, 0.97));

    return {
      id: def.id,
      name: def.name,
      nameAr: def.nameAr,
      city: def.city,
      cityAr: def.cityAr,
      region: def.region,
      regionAr: def.regionAr,
      pressure: def.basePressure,
      status: 'OPERATIONAL',
      activeSignals: 0,
      decisionsToday: 0,
      domains,
      inventory: {
        totalItems: rand(2000, 15000),
        belowReorderPoint: rand(5, 40),
        stockoutCount: rand(0, 3),
        expiringWithin90Days: rand(10, 80),
      },
      assets: {
        totalDevices,
        operational,
        underMaintenance: totalDevices - operational - rand(0, 5),
        condemned: rand(0, 5),
        calibrationDue: rand(2, 20),
      },
      budget: {
        allocated: def.budgetBase,
        consumed: Math.round(def.budgetBase * randf(0.45, 0.72)),
        utilizationPct: 0,
        overrunRisk: false,
      },
      domainBudgets,
      budgetPhase: 'EXECUTION',
    };
  }

  private buildInitialProcurement(hospitals: HospitalState[]): ProcurementOrder[] {
    const orders: ProcurementOrder[] = [];
    const vendors = [
      { en: 'MedSupply Co', ar: '\u0634\u0631\u0643\u0629 \u0645\u064A\u062F \u0633\u0628\u0644\u0627\u064A' },
      { en: 'Gulf Medical Equipment', ar: '\u0645\u0639\u062F\u0627\u062A \u0627\u0644\u062E\u0644\u064A\u062C \u0627\u0644\u0637\u0628\u064A\u0629' },
      { en: 'Al Salam Devices', ar: '\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0633\u0644\u0627\u0645' },
      { en: 'National IT Solutions', ar: '\u062D\u0644\u0648\u0644 \u062A\u0642\u0646\u064A\u0629 \u0648\u0637\u0646\u064A\u0629' },
    ];

    for (let i = 0; i < 8; i++) {
      const h = pick(hospitals);
      const v = pick(vendors);
      const stage = pick(PROCUREMENT_STAGES);
      const now = new Date();
      const reqDate = new Date(now.getTime() - rand(5, 30) * 86400000);
      orders.push({
        id: `PO-${year()}-${++this.procurementCounter}`,
        code: `PO-${year()}-${this.procurementCounter}`,
        title: `${pick(ALL_DOMAINS).replace(/_/g, ' ')} Order`,
        titleAr: '\u0637\u0644\u0628 \u062A\u0648\u0631\u064A\u062F',
        vendor: v.en,
        vendorAr: v.ar,
        domain: pick(ALL_DOMAINS),
        totalSAR: rand(15000, 500000),
        stage,
        delayRisk: pick(['ON_TRACK', 'ON_TRACK', 'AT_RISK'] as ProcurementRisk[]),
        requestDate: reqDate,
        approvalDate: PROCUREMENT_STAGES.indexOf(stage) >= 1 ? new Date(reqDate.getTime() + rand(1, 5) * 86400000) : null,
        orderDate: PROCUREMENT_STAGES.indexOf(stage) >= 2 ? new Date(reqDate.getTime() + rand(5, 10) * 86400000) : null,
        shipmentDate: PROCUREMENT_STAGES.indexOf(stage) >= 3 ? new Date(reqDate.getTime() + rand(10, 20) * 86400000) : null,
        expectedDelivery: new Date(now.getTime() + rand(5, 45) * 86400000),
        actualDelivery: stage === 'DELIVERY' ? new Date(now.getTime() - rand(0, 3) * 86400000) : null,
        hospitalId: h.id,
        hospitalName: h.name,
        hospitalNameAr: h.nameAr,
        slaCompliance: Math.random() > 0.2,
        daysInCurrentStage: rand(1, 7),
      });
    }
    return orders;
  }

  private buildPressureDimensions(): PressureDimension[] {
    return [
      { key: 'supply', label: 'Supply Chain', labelAr: '\u0633\u0644\u0633\u0644\u0629 \u0627\u0644\u0625\u0645\u062F\u0627\u062F', pressure: 22, trend: 'stable', drivers: [] },
      { key: 'devices', label: 'Medical Devices', labelAr: '\u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0637\u0628\u064A\u0629', pressure: 28, trend: 'stable', drivers: [] },
      { key: 'budget', label: 'Budget', labelAr: '\u0627\u0644\u0645\u064A\u0632\u0627\u0646\u064A\u0629', pressure: 20, trend: 'stable', drivers: [] },
      { key: 'compliance', label: 'Compliance', labelAr: '\u0627\u0644\u0627\u0645\u062A\u062B\u0627\u0644', pressure: 15, trend: 'stable', drivers: [] },
      { key: 'workforce', label: 'Workforce', labelAr: '\u0627\u0644\u0642\u0648\u0649 \u0627\u0644\u0639\u0627\u0645\u0644\u0629', pressure: 18, trend: 'stable', drivers: [] },
      { key: 'vendor', label: 'Vendor Performance', labelAr: '\u0623\u062F\u0627\u0621 \u0627\u0644\u0645\u0648\u0631\u062F\u064A\u0646', pressure: 24, trend: 'stable', drivers: [] },
    ];
  }

  // ---- Inventory & Device Generation ----

  private buildInventoryItems(hospitals: HospitalState[]): InventoryItem[] {
    const ITEM_DEFS: { sku: string; name: string; nameAr: string; domain: SupplyDomain; category: string; unit: string; manufacturer: string; baseOnHand: number; hasExpiry: boolean }[] = [
      { sku: 'SYR-5CC', name: '5cc Syringe', nameAr: 'حقنة 5 سي سي', domain: 'MEDICAL_CONSUMABLES', category: 'Syringes', unit: 'box', manufacturer: 'BD', baseOnHand: 200, hasExpiry: true },
      { sku: 'SYR-10CC', name: '10cc Syringe', nameAr: 'حقنة 10 سي سي', domain: 'MEDICAL_CONSUMABLES', category: 'Syringes', unit: 'box', manufacturer: 'BD', baseOnHand: 180, hasExpiry: true },
      { sku: 'CAN-20G', name: 'IV Cannula 20G', nameAr: 'كانيولا وريدية 20G', domain: 'MEDICAL_CONSUMABLES', category: 'IV Access', unit: 'box', manufacturer: 'B.Braun', baseOnHand: 150, hasExpiry: true },
      { sku: 'CAN-22G', name: 'IV Cannula 22G', nameAr: 'كانيولا وريدية 22G', domain: 'MEDICAL_CONSUMABLES', category: 'IV Access', unit: 'box', manufacturer: 'B.Braun', baseOnHand: 150, hasExpiry: true },
      { sku: 'USG-GEL', name: 'Ultrasound Gel', nameAr: 'جل الموجات فوق الصوتية', domain: 'MEDICAL_CONSUMABLES', category: 'Diagnostics', unit: 'bottle', manufacturer: 'Parker Labs', baseOnHand: 80, hasExpiry: true },
      { sku: 'GLV-M', name: 'Surgical Gloves M', nameAr: 'قفازات جراحية وسط', domain: 'MEDICAL_CONSUMABLES', category: 'PPE', unit: 'box', manufacturer: 'Ansell', baseOnHand: 300, hasExpiry: true },
      { sku: 'GLV-L', name: 'Surgical Gloves L', nameAr: 'قفازات جراحية كبير', domain: 'MEDICAL_CONSUMABLES', category: 'PPE', unit: 'box', manufacturer: 'Ansell', baseOnHand: 250, hasExpiry: true },
      { sku: 'GAU-4X4', name: 'Gauze Pads 4x4', nameAr: 'شاش 4×4', domain: 'MEDICAL_CONSUMABLES', category: 'Wound Care', unit: 'pack', manufacturer: 'Medline', baseOnHand: 400, hasExpiry: false },
      { sku: 'NS-500', name: 'Normal Saline 500ml', nameAr: 'محلول ملحي 500 مل', domain: 'MEDICAL_CONSUMABLES', category: 'IV Fluids', unit: 'bottle', manufacturer: 'Baxter', baseOnHand: 350, hasExpiry: true },
      { sku: 'DEX-5-1L', name: 'Dextrose 5% 1L', nameAr: 'دكستروز 5% 1 لتر', domain: 'MEDICAL_CONSUMABLES', category: 'IV Fluids', unit: 'bottle', manufacturer: 'Baxter', baseOnHand: 200, hasExpiry: true },
      { sku: 'FOL-16F', name: 'Foley Catheter 16Fr', nameAr: 'قسطرة فولي 16', domain: 'MEDICAL_CONSUMABLES', category: 'Urology', unit: 'piece', manufacturer: 'Bard', baseOnHand: 100, hasExpiry: true },
      { sku: 'SUC-14F', name: 'Suction Catheter 14Fr', nameAr: 'قسطرة شفط 14', domain: 'MEDICAL_CONSUMABLES', category: 'Respiratory', unit: 'piece', manufacturer: 'Teleflex', baseOnHand: 120, hasExpiry: true },
      { sku: 'ECG-EL', name: 'ECG Electrodes', nameAr: 'أقطاب تخطيط القلب', domain: 'MEDICAL_CONSUMABLES', category: 'Diagnostics', unit: 'pack', manufacturer: '3M', baseOnHand: 500, hasExpiry: true },
      { sku: 'O2M-AD', name: 'Oxygen Mask Adult', nameAr: 'قناع أكسجين للبالغين', domain: 'MEDICAL_CONSUMABLES', category: 'Respiratory', unit: 'piece', manufacturer: 'Intersurgical', baseOnHand: 100, hasExpiry: false },
      { sku: 'DRP-STR', name: 'Surgical Drape', nameAr: 'ستارة جراحية', domain: 'MEDICAL_CONSUMABLES', category: 'Surgical', unit: 'pack', manufacturer: 'Medline', baseOnHand: 60, hasExpiry: false },
    ];

    const LOCATIONS = ['Main Store', 'ICU', 'Emergency', 'OR', 'Ward-1', 'Ward-2', 'Pharmacy'];
    const now = Date.now();
    const items: InventoryItem[] = [];

    hospitals.forEach((h, hIdx) => {
      ITEM_DEFS.forEach((def, dIdx) => {
        // Distribute items across 2 locations per item type per hospital
        const loc1 = LOCATIONS[dIdx % LOCATIONS.length];
        const loc2 = LOCATIONS[(dIdx + 3) % LOCATIONS.length];
        const locations = [loc1, loc2];

        locations.forEach((location, locIdx) => {
          const seed = (hIdx + 1) * 100 + dIdx * 10 + locIdx;
          const onHand = Math.round(def.baseOnHand * (0.5 + (seed % 10) / 10));
          const reserved = Math.round(onHand * (0.05 + (seed % 7) / 100));
          const inTransit = seed % 4 === 0 ? Math.round(onHand * 0.05) : 0;
          const reorderPoint = Math.round(onHand * 0.3);
          const expiryDays = def.hasExpiry ? 30 + ((seed * 7) % 151) : 0; // 30-180 days

          items.push({
            id: `INV-${h.id}-${def.sku}-${locIdx}`,
            sku: def.sku,
            name: def.name,
            nameAr: def.nameAr,
            domain: def.domain,
            category: def.category,
            hospitalId: h.id,
            location,
            onHand,
            reserved,
            available: onHand - reserved,
            inTransit,
            reorderPoint,
            expiryDate: def.hasExpiry ? new Date(now + expiryDays * 86_400_000) : null,
            unit: def.unit,
            manufacturer: def.manufacturer,
          });
        });
      });
    });

    return items;
  }

  private buildDeviceAssets(hospitals: HospitalState[]): DeviceAsset[] {
    const DEVICE_DEFS: { name: string; nameAr: string; model: string; manufacturer: string; domain: SupplyDomain }[] = [
      { name: 'Cardiac Monitor', nameAr: 'جهاز مراقبة القلب', model: 'Philips IntelliVue MX800', manufacturer: 'Philips', domain: 'MEDICAL_DEVICES' },
      { name: 'Infusion Pump', nameAr: 'مضخة تسريب', model: 'B.Braun Infusomat', manufacturer: 'B.Braun', domain: 'MEDICAL_DEVICES' },
      { name: 'Syringe Pump', nameAr: 'مضخة محقنة', model: 'B.Braun Perfusor', manufacturer: 'B.Braun', domain: 'MEDICAL_DEVICES' },
      { name: 'Ventilator', nameAr: 'جهاز تنفس', model: 'Draeger Evita V500', manufacturer: 'Draeger', domain: 'MEDICAL_DEVICES' },
      { name: 'Defibrillator', nameAr: 'جهاز صدمات كهربائية', model: 'Philips HeartStart MRx', manufacturer: 'Philips', domain: 'MEDICAL_DEVICES' },
      { name: 'Patient Monitor', nameAr: 'جهاز مراقبة المريض', model: 'GE CARESCAPE B650', manufacturer: 'GE Healthcare', domain: 'MEDICAL_DEVICES' },
      { name: 'Blood Pressure Monitor', nameAr: 'جهاز قياس ضغط الدم', model: 'Welch Allyn Connex', manufacturer: 'Welch Allyn', domain: 'MEDICAL_DEVICES' },
      { name: 'Pulse Oximeter', nameAr: 'مقياس التأكسج النبضي', model: 'Masimo Radical-7', manufacturer: 'Masimo', domain: 'MEDICAL_DEVICES' },
      { name: 'ECG Machine', nameAr: 'جهاز تخطيط القلب', model: 'GE MAC 5500', manufacturer: 'GE Healthcare', domain: 'MEDICAL_DEVICES' },
      { name: 'Suction Machine', nameAr: 'جهاز شفط', model: 'Medela Vario 18', manufacturer: 'Medela', domain: 'MEDICAL_DEVICES' },
      { name: 'Nebulizer', nameAr: 'جهاز استنشاق', model: 'Omron CompAir', manufacturer: 'Omron', domain: 'MEDICAL_DEVICES' },
      { name: 'Glucometer', nameAr: 'جهاز قياس السكر', model: 'Roche Accu-Chek', manufacturer: 'Roche', domain: 'MEDICAL_DEVICES' },
    ];

    const DEPARTMENTS = [
      { en: 'ICU', ar: 'العناية المركزة' },
      { en: 'Emergency', ar: 'الطوارئ' },
      { en: 'OR', ar: 'غرفة العمليات' },
      { en: 'Ward-1', ar: 'الجناح-1' },
      { en: 'Ward-2', ar: 'الجناح-2' },
      { en: 'Outpatient', ar: 'العيادات الخارجية' },
    ];

    const STATUS_DIST: DeviceAsset['status'][] = [
      'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE',
      'ASSIGNED', 'MAINTENANCE', 'DOWN', 'AVAILABLE',
    ];

    const now = Date.now();
    const devices: DeviceAsset[] = [];

    hospitals.forEach((h, hIdx) => {
      DEVICE_DEFS.forEach((def, dIdx) => {
        const seed = (hIdx + 1) * 100 + dIdx;
        const dept = DEPARTMENTS[dIdx % DEPARTMENTS.length];
        const status = STATUS_DIST[seed % STATUS_DIST.length];
        const serialSuffix = String(seed).padStart(6, '0');
        const purchaseDaysAgo = 365 + (seed % 730); // 1-3 years ago
        const lastMaintDaysAgo = 30 + (seed % 60);  // 30-90 days ago
        const nextMaintDays = 30 + (seed % 90);     // 30-120 days ahead
        const warrantyDays = 365 + (seed % 730);    // 1-3 years ahead

        devices.push({
          id: `DEV-${h.id}-${dIdx}`,
          serialNumber: `SN-${def.manufacturer.substring(0, 3).toUpperCase()}-${serialSuffix}`,
          name: def.name,
          nameAr: def.nameAr,
          model: def.model,
          manufacturer: def.manufacturer,
          domain: def.domain,
          hospitalId: h.id,
          department: dept.en,
          departmentAr: dept.ar,
          status,
          lastMaintenanceDate: new Date(now - lastMaintDaysAgo * 86_400_000),
          nextMaintenanceDate: new Date(now + nextMaintDays * 86_400_000),
          purchaseDate: new Date(now - purchaseDaysAgo * 86_400_000),
          warrantyExpiry: new Date(now + warrantyDays * 86_400_000),
        });
      });
    });

    return devices;
  }

  // ---- Search Methods ----

  searchItems(query: string, hospitalId?: string): InventoryItem[] {
    const q = query.toLowerCase();
    return this.state.inventoryItems.filter(item => {
      if (hospitalId && item.hospitalId !== hospitalId) return false;
      return item.name.toLowerCase().includes(q) ||
             item.nameAr.includes(query) ||
             item.sku.toLowerCase().includes(q) ||
             item.manufacturer.toLowerCase().includes(q);
    });
  }

  searchDevices(query: string, hospitalId?: string): DeviceAsset[] {
    const q = query.toLowerCase();
    return this.state.deviceAssets.filter(device => {
      if (hospitalId && device.hospitalId !== hospitalId) return false;
      return device.name.toLowerCase().includes(q) ||
             device.nameAr.includes(query) ||
             device.model.toLowerCase().includes(q) ||
             device.manufacturer.toLowerCase().includes(q) ||
             device.serialNumber.toLowerCase().includes(q);
    });
  }

  private buildRevenueState(hospitals: HospitalState[]): RevenueState {
    const REVENUE_RATES: Record<string, { rate: number; nameAr: string; hours: number }> = {
      'MRI': { rate: 1500, nameAr: 'رنين مغناطيسي', hours: 14 },
      'CT': { rate: 800, nameAr: 'أشعة مقطعية', hours: 12 },
      'Ultrasound': { rate: 400, nameAr: 'موجات فوق صوتية', hours: 10 },
      'OR': { rate: 3000, nameAr: 'غرفة عمليات', hours: 12 },
      'Endoscopy': { rate: 1200, nameAr: 'منظار', hours: 8 },
      'CathLab': { rate: 5000, nameAr: 'معمل قسطرة', hours: 10 },
      'Xray': { rate: 200, nameAr: 'أشعة سينية', hours: 16 },
      'Mammography': { rate: 350, nameAr: 'ماموجرام', hours: 8 },
      'Dental Chair': { rate: 300, nameAr: 'كرسي أسنان', hours: 10 },
      'Dental Xray': { rate: 150, nameAr: 'أشعة أسنان', hours: 10 },
    };

    // Device layouts by hospital size
    const LARGE_LAYOUT: Array<[string, number]> = [
      ['MRI', 2], ['CT', 2], ['Ultrasound', 3], ['OR', 4],
      ['Endoscopy', 1], ['CathLab', 1], ['Xray', 2], ['Mammography', 1],
    ];
    const MEDIUM_LAYOUT: Array<[string, number]> = [
      ['MRI', 1], ['CT', 1], ['Ultrasound', 2], ['OR', 3],
      ['Endoscopy', 1], ['Xray', 2],
    ];
    const SMALL_LAYOUT: Array<[string, number]> = [
      ['CT', 1], ['Ultrasound', 1], ['OR', 2], ['Xray', 1],
    ];
    const DENTAL_LAYOUT: Array<[string, number]> = [
      ['Dental Chair', 8], ['Dental Xray', 2],
    ];

    const LARGE_IDS = ['RYD-CTR', 'RYD-SPC'];
    const MEDIUM_IDS = ['JED-NTH', 'JED-STH', 'DMM-001', 'KHB-001'];
    const DENTAL_ID = 'RYD-DNT';

    const assets: RevenueAsset[] = [];
    let assetIdx = 0;

    for (const hospital of hospitals) {
      let layout: Array<[string, number]>;
      if (hospital.id === DENTAL_ID) {
        layout = DENTAL_LAYOUT;
      } else if (LARGE_IDS.includes(hospital.id)) {
        layout = LARGE_LAYOUT;
      } else if (MEDIUM_IDS.includes(hospital.id)) {
        layout = MEDIUM_LAYOUT;
      } else {
        layout = SMALL_LAYOUT;
      }

      for (const [deviceType, count] of layout) {
        for (let i = 0; i < count; i++) {
          const info = REVENUE_RATES[deviceType];
          const utilization = 55 + ((assetIdx * 17 + 3) % 31); // 55-85 deterministic
          const activeHours = info.hours * (utilization / 100);
          const revenuePerDay = activeHours * info.rate;
          const idleHours = info.hours * ((100 - utilization) / 100);

          assets.push({
            id: `REV-${hospital.id}-${deviceType.replace(/\s/g, '')}-${i + 1}`,
            name: count > 1 ? `${deviceType} #${i + 1}` : deviceType,
            nameAr: count > 1 ? `${info.nameAr} #${i + 1}` : info.nameAr,
            type: deviceType,
            hospitalId: hospital.id,
            hospitalName: hospital.name,
            hospitalNameAr: hospital.nameAr,
            revenueClass: 'REVENUE_GENERATING',
            utilizationRate: utilization,
            revenuePerHour: info.rate,
            revenuePerDay: Math.round(revenuePerDay),
            hoursPerDay: info.hours,
            downtimeLoss: 0,
            missedOpportunities: Math.round(idleHours * info.rate),
            status: 'ACTIVE',
          });
          assetIdx++;
        }
      }
    }

    const totalDailyRevenue = assets.reduce((s, a) => s + a.revenuePerDay, 0);
    const totalMissedRevenue = assets.reduce((s, a) => s + a.missedOpportunities, 0);
    const avgUtilization = assets.length > 0
      ? Math.round(assets.reduce((s, a) => s + a.utilizationRate, 0) / assets.length)
      : 0;

    return {
      assets,
      totalDailyRevenue,
      totalMissedRevenue,
      totalDowntimeLoss: 0,
      avgUtilization,
      opportunities: [],
    };
  }

  // ---- Core Loop ----

  private tick(): void {
    this.scanSignals();
    this.detectAnomalies();
    this.generateDecisions();
    this.executeActions();
    this.advanceProcurement();
    this.updateSystemHealth();
    this.detectImpacts();
    this.updateRevenue();
    this.checkRequestSLAs();
    this.state.cycleCount++;
    this.state.pulse.cyclesCompleted++;
    this.state.pulse.lastCycleAt = new Date();
    this.notify();
  }

  // ---- Signal Scanning ----

  private scanSignals(): void {
    for (const hospital of this.state.hospitals) {
      const baseProbability = 0.02 + hospital.pressure / 500;

      for (const domain of ALL_DOMAINS) {
        if (Math.random() > baseProbability) continue;

        const domainSignals = DOMAIN_SIGNALS[domain];
        const possibleSignals = [...domainSignals, ...UNIVERSAL_SIGNALS];
        const signalType = pick(possibleSignals);
        let severity = this.computeSeverity(hospital.pressure);

        // Cross-hospital optimization: reduce stockout severity if another hospital has excess
        if (signalType === 'STOCKOUT' && (severity === 'CRITICAL' || severity === 'HIGH')) {
          const excessHospital = this.findExcessStock(domain, hospital.id);
          if (excessHospital) {
            severity = 'MEDIUM';
          }
        }
        const titles = SIGNAL_TITLES[signalType];

        const signal: Signal = {
          id: `SIG-${year()}-${++this.signalCounter}`,
          type: signalType,
          severity,
          domain,
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          hospitalNameAr: hospital.nameAr,
          title: titles.en,
          titleAr: titles.ar,
          description: `${titles.en} in ${domain.replace(/_/g, ' ')} at ${hospital.name}`,
          descriptionAr: `${titles.ar} \u0641\u064A ${hospital.nameAr}`,
          metric: randf(0.5, 1.5),
          threshold: 1.0,
          detectedAt: new Date(),
          resolvedAt: null,
          sourceEntity: domain,
          sourceEntityId: `${hospital.id}-${domain}-${Date.now()}`,
        };

        this.state.signals.push(signal);
        hospital.activeSignals++;
        hospital.pressure = clamp(hospital.pressure + (severity === 'CRITICAL' ? 5 : severity === 'HIGH' ? 3 : 1), 0, 100);
      }
    }
  }

  private computeSeverity(pressure: number): SignalSeverity {
    const r = Math.random();
    if (pressure > 70) return r < 0.4 ? 'CRITICAL' : r < 0.7 ? 'HIGH' : 'MEDIUM';
    if (pressure > 50) return r < 0.15 ? 'CRITICAL' : r < 0.45 ? 'HIGH' : r < 0.8 ? 'MEDIUM' : 'LOW';
    return r < 0.05 ? 'CRITICAL' : r < 0.2 ? 'HIGH' : r < 0.55 ? 'MEDIUM' : 'LOW';
  }

  // ---- Anomaly Detection ----

  private detectAnomalies(): void {
    for (const hospital of this.state.hospitals) {
      const unresolvedSignals = this.state.signals.filter(s => s.hospitalId === hospital.id && !s.resolvedAt);
      const stockouts = unresolvedSignals.filter(s => s.type === 'STOCKOUT').length;
      const deviceFailures = unresolvedSignals.filter(s => s.type === 'DEVICE_FAILURE').length;

      if (stockouts >= 3 && !unresolvedSignals.some(s => s.type === 'CLINICAL_DEMAND_SPIKE')) {
        this.state.signals.push({
          id: `SIG-${year()}-${++this.signalCounter}`,
          type: 'CLINICAL_DEMAND_SPIKE',
          severity: 'HIGH',
          domain: 'MEDICAL_CONSUMABLES',
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          hospitalNameAr: hospital.nameAr,
          title: 'Clinical Demand Spike Detected',
          titleAr: '\u0627\u0631\u062A\u0641\u0627\u0639 \u0645\u0641\u0627\u062C\u0626 \u0641\u064A \u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u0633\u0631\u064A\u0631\u064A',
          description: `Multiple stockouts indicate demand spike at ${hospital.name}`,
          descriptionAr: `\u0646\u0641\u0627\u062F \u0645\u062A\u0639\u062F\u062F \u064A\u0634\u064A\u0631 \u0625\u0644\u0649 \u0627\u0631\u062A\u0641\u0627\u0639 \u0627\u0644\u0637\u0644\u0628 \u0641\u064A ${hospital.nameAr}`,
          metric: stockouts,
          threshold: 2,
          detectedAt: new Date(),
          resolvedAt: null,
          sourceEntity: 'CROSS_DOMAIN',
          sourceEntityId: `anomaly-${hospital.id}-${Date.now()}`,
        });
        hospital.activeSignals++;
        hospital.pressure = clamp(hospital.pressure + 4, 0, 100);
      }

      if (deviceFailures >= 2 && !unresolvedSignals.some(s => s.type === 'WORKFORCE_STRAIN')) {
        this.state.signals.push({
          id: `SIG-${year()}-${++this.signalCounter}`,
          type: 'WORKFORCE_STRAIN',
          severity: 'MEDIUM',
          domain: 'MEDICAL_DEVICES',
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          hospitalNameAr: hospital.nameAr,
          title: 'Workforce Strain from Device Failures',
          titleAr: '\u0636\u063A\u0637 \u0639\u0644\u0649 \u0627\u0644\u0642\u0648\u0649 \u0627\u0644\u0639\u0627\u0645\u0644\u0629 \u0628\u0633\u0628\u0628 \u0623\u0639\u0637\u0627\u0644 \u0627\u0644\u0623\u062C\u0647\u0632\u0629',
          description: `Multiple device failures creating workforce strain at ${hospital.name}`,
          descriptionAr: `\u0623\u0639\u0637\u0627\u0644 \u0645\u062A\u0639\u062F\u062F\u0629 \u062A\u0633\u0628\u0628 \u0636\u063A\u0637\u0627\u064B \u0641\u064A ${hospital.nameAr}`,
          metric: deviceFailures,
          threshold: 1,
          detectedAt: new Date(),
          resolvedAt: null,
          sourceEntity: 'CROSS_DOMAIN',
          sourceEntityId: `anomaly-${hospital.id}-${Date.now()}`,
        });
        hospital.activeSignals++;
      }
    }
  }

  // ---- Decision Generation ----

  private generateDecisions(): void {
    const unresolvedSignals = this.state.signals.filter(s => !s.resolvedAt);
    const existingDecisionSignals = new Set(this.state.decisions.filter(d => d.status !== 'COMPLETED' && d.status !== 'REJECTED').flatMap(d => d.sourceSignalIds));

    for (const signal of unresolvedSignals) {
      if (existingDecisionSignals.has(signal.id)) continue;

      const mappings = DECISION_MAP[signal.type];
      if (!mappings) continue;

      for (const mapping of mappings) {
        let confidence = mapping.confidence;
        if (signal.severity === 'CRITICAL') confidence = Math.min(confidence + 5, 99);
        const isStockoutCritical = signal.type === 'STOCKOUT' && signal.severity === 'CRITICAL';
        // Cross-hospital optimization: check for excess stock before emergency procurement
        const excessStockHospital = signal.type === 'STOCKOUT' ? this.findExcessStock(signal.domain, signal.hospitalId) : null;
        let type: DecisionType;
        if (isStockoutCritical && !excessStockHospital) {
          type = 'EMERGENCY_PROCUREMENT';
          confidence = 95;
        } else if (signal.type === 'STOCKOUT' && excessStockHospital) {
          type = 'STOCK_REALLOCATION';
          confidence = Math.min(confidence + 5, 99);
        } else {
          type = isStockoutCritical ? 'EMERGENCY_PROCUREMENT' : mapping.type;
          if (isStockoutCritical) confidence = 95;
        }

        const titles = DECISION_TITLES[type];

        // --- Financial Impact (deterministic based on hospital index + domain) ---
        const hospitalIndex = HOSPITALS.findIndex(h => h.id === signal.hospitalId);
        const domainIndex = ALL_DOMAINS.indexOf(signal.domain);
        const seedValue = ((hospitalIndex + 1) * 7 + (domainIndex + 1) * 13) % 100;
        const financialImpact = this.calculateFinancialImpact(type, signal.domain, seedValue);

        // --- Governance: approval authority based on domain ---
        let approvalAuthority = 'AUTO';
        let subsidiary = 'THEA_HEALTH';
        let domainOwner = 'THEA_HEALTH_COO';

        if (signal.domain === 'MEDICAL_DEVICES') {
          approvalAuthority = 'THEA_MEDICAL_CEO';
          subsidiary = 'THEA_MEDICAL';
          domainOwner = 'THEA_MEDICAL_CEO';
        } else if (signal.domain === 'IT_SYSTEMS') {
          approvalAuthority = 'THEA_SOLUTIONS_CEO';
          subsidiary = 'THEA_SOLUTIONS';
          domainOwner = 'THEA_SOLUTIONS_CEO';
        } else if (signal.domain === 'DENTAL') {
          approvalAuthority = 'DAHNAA_DENTAL_CEO';
          subsidiary = 'DAHNAA_DENTAL';
          domainOwner = 'DAHNAA_DENTAL_CEO';
        }

        // --- Approval Logic ---
        const requiresApproval =
          financialImpact.estimatedCost > 50000 ||
          confidence < 85 ||
          signal.domain === 'MEDICAL_DEVICES' ||
          signal.domain === 'IT_SYSTEMS' ||
          signal.domain === 'DENTAL';

        const autoApproved = !requiresApproval && confidence >= 85;
        if (autoApproved) approvalAuthority = 'AUTO';

        const decision: Decision = {
          id: `DEC-${year()}-${++this.decisionCounter}`,
          code: `DEC-${year()}-${this.decisionCounter}`,
          type,
          status: autoApproved ? 'AUTO_APPROVED' : 'PENDING_REVIEW',
          domain: signal.domain,
          hospitalId: signal.hospitalId,
          hospitalName: signal.hospitalName,
          hospitalNameAr: signal.hospitalNameAr,
          title: titles.en,
          titleAr: titles.ar,
          reasoning: `Signal ${signal.id} (${signal.type}) triggered ${type} with ${confidence}% confidence`,
          reasoningAr: `\u0627\u0644\u0625\u0634\u0627\u0631\u0629 ${signal.id} \u0623\u062F\u062A \u0625\u0644\u0649 ${titles.ar} \u0628\u062B\u0642\u0629 ${confidence}%`,
          confidenceScore: confidence,
          riskScore: signal.severity === 'CRITICAL' ? 90 : signal.severity === 'HIGH' ? 70 : signal.severity === 'MEDIUM' ? 45 : 20,
          autoApproved,
          sourceSignalIds: [signal.id],
          createdAt: new Date(),
          executedAt: null,
          executingTicks: 0,
          impactEstimate: {
            costSAR: financialImpact.estimatedCost,
            riskReduction: rand(15, 60),
            timeHours: rand(2, 72),
          },
          financialImpact,
          requiresApproval,
          approvalAuthority,
          governance: { subsidiary, domainOwner },
          approvalChain: [],
          outcome: null,
          impactMetrics: null,
        };

        // Build approval chain based on cost and domain
        decision.approvalChain = this.buildApprovalChain(decision);

        this.state.decisions.push(decision);
        existingDecisionSignals.add(signal.id);

        const hospital = this.state.hospitals.find(h => h.id === signal.hospitalId);
        if (hospital) hospital.decisionsToday++;
      }
    }
  }

  // ---- Approval Chain ----

  private buildApprovalChain(decision: Decision): ApprovalStep[] {
    const chain: ApprovalStep[] = [];
    const cost = decision.financialImpact.estimatedCost;

    // Department level (cost < 10000 SAR)
    if (cost < 10000 && decision.confidenceScore >= 90) {
      // Auto-approve at department level
      chain.push({ role: 'SUPERVISOR', status: 'APPROVED', timestamp: new Date(), autoApproved: true });
      return chain;
    }

    // Hospital level (10000-50000 SAR)
    if (cost < 50000) {
      chain.push({ role: 'HEAD_OF_DEPARTMENT', status: 'PENDING', timestamp: null, autoApproved: false });
      // Domain-specific director
      if (['MEDICAL_DEVICES', 'MEDICAL_CONSUMABLES'].includes(decision.domain)) {
        chain.push({ role: 'MEDICAL_DIRECTOR', status: 'PENDING', timestamp: null, autoApproved: false });
      } else if (['IT_SYSTEMS', 'OFFICE_EQUIPMENT'].includes(decision.domain)) {
        chain.push({ role: 'EXECUTIVE_DIRECTOR', status: 'PENDING', timestamp: null, autoApproved: false });
      } else {
        chain.push({ role: 'EXECUTIVE_DIRECTOR', status: 'PENDING', timestamp: null, autoApproved: false });
      }
      return chain;
    }

    // Group level (>= 50000 SAR)
    chain.push({ role: 'HEAD_OF_DEPARTMENT', status: 'PENDING', timestamp: null, autoApproved: false });
    chain.push({ role: 'GENERAL_DIRECTOR', status: 'PENDING', timestamp: null, autoApproved: false });

    // Subsidiary CEO for domain
    const subsidiaryCeo = this.getSubsidiaryCeo(decision.domain);
    if (subsidiaryCeo) {
      chain.push({ role: subsidiaryCeo, status: 'PENDING', timestamp: null, autoApproved: false });
    }

    if (cost >= 200000) {
      chain.push({ role: 'COO_GROUP', status: 'PENDING', timestamp: null, autoApproved: false });
    }
    if (cost >= 500000) {
      chain.push({ role: 'CEO', status: 'PENDING', timestamp: null, autoApproved: false });
    }

    return chain;
  }

  private getSubsidiaryCeo(domain: SupplyDomain): string | null {
    const map: Partial<Record<SupplyDomain, string>> = {
      MEDICAL_DEVICES: 'THEA_MEDICAL_CEO',
      IT_SYSTEMS: 'THEA_SOLUTIONS_CEO',
      OFFICE_EQUIPMENT: 'THEA_SOLUTIONS_CEO',
      DENTAL: 'DAHNAA_DENTAL_CEO',
    };
    return map[domain] || null;
  }

  // ---- Cross-Hospital Optimization ----

  private findExcessStock(domain: SupplyDomain, excludeHospitalId: string): HospitalState | null {
    return this.state.hospitals.find(h =>
      h.id !== excludeHospitalId &&
      h.domains[domain].activeItems > h.domains[domain].criticalItems * 3
    ) || null;
  }

  // ---- Action Execution ----

  private executeActions(): void {
    const approvedDecisions = this.state.decisions.filter(
      d => d.status === 'AUTO_APPROVED' || d.status === 'EXECUTING'
    );

    for (const decision of approvedDecisions) {
      if (decision.status === 'AUTO_APPROVED') {
        decision.status = 'EXECUTING';
        decision.executedAt = new Date();
        decision.executingTicks = 0;

        const actionTypes = DECISION_ACTIONS[decision.type] || [];
        for (const actionType of actionTypes) {
          // --- Cost per action type ---
          const estimatedCost = decision.financialImpact.estimatedCost;
          let actionCost = 0;
          if (actionType === 'CREATE_PO') actionCost = estimatedCost;
          else if (actionType === 'EMERGENCY_ORDER') actionCost = Math.round(estimatedCost * 1.2); // rush premium
          else if (actionType === 'DISPATCH_TECHNICIAN') actionCost = 5000;
          else if (actionType === 'TRANSFER_STOCK') actionCost = 2000;
          else if (actionType === 'REALLOCATE_BUDGET') actionCost = 0;
          else if (actionType === 'SCHEDULE_INSPECTION') actionCost = 3000;
          else if (actionType === 'DISPOSAL_REQUEST') actionCost = 1000;
          else if (actionType === 'VENDOR_ALERT') actionCost = 0;
          else if (actionType === 'NOTIFY_VENDOR') actionCost = 0;
          else if (actionType === 'COMPLIANCE_REPORT') actionCost = 0;

          const action: Action = {
            id: `ACT-${year()}-${++this.actionCounter}`,
            code: `ACT-${year()}-${this.actionCounter}`,
            type: actionType,
            status: 'IN_PROGRESS',
            decisionId: decision.id,
            decisionCode: decision.code,
            domain: decision.domain,
            hospitalId: decision.hospitalId,
            hospitalName: decision.hospitalName,
            hospitalNameAr: decision.hospitalNameAr,
            description: `${actionType.replace(/_/g, ' ')} for ${decision.title}`,
            descriptionAr: `\u0625\u062C\u0631\u0627\u0621 \u0644\u0640 ${decision.titleAr}`,
            createdAt: new Date(),
            completedAt: null,
            cost: actionCost,
            budgetImpact: -actionCost, // negative = spend
          };
          this.state.actions.push(action);

          if (actionType === 'CREATE_PO' || actionType === 'EMERGENCY_ORDER') {
            this.createProcurementFromAction(action);
          }
        }
      }

      if (decision.status === 'EXECUTING') {
        decision.executingTicks++;
        if (decision.executingTicks >= 3) {
          decision.status = 'COMPLETED';
          const hospital = this.state.hospitals.find(h => h.id === decision.hospitalId);
          if (hospital) {
            const relief = rand(2, 5);
            hospital.pressure = clamp(hospital.pressure - relief, 0, 100);
          }

          for (const sigId of decision.sourceSignalIds) {
            const sig = this.state.signals.find(s => s.id === sigId);
            if (sig && !sig.resolvedAt) {
              sig.resolvedAt = new Date();
              if (hospital) hospital.activeSignals = Math.max(0, hospital.activeSignals - 1);
            }
          }

          // Set outcome tracking
          const hospitalIndex = HOSPITALS.findIndex(h => h.id === decision.hospitalId);
          decision.outcome = {
            status: 'SUCCESS',
            timeToResolution: (Date.now() - decision.createdAt.getTime()) / 1000,
            costAccuracy: 95 + (hospitalIndex % 10), // 95-104%
            riskReduced: true,
          };

          const relatedActions = this.state.actions.filter(a => a.decisionId === decision.id);
          for (const a of relatedActions) {
            if (a.status === 'IN_PROGRESS') {
              a.status = 'COMPLETED';
              a.completedAt = new Date();

              // Update domain budget on action completion
              if (a.cost > 0 && hospital) {
                const domainBudget = hospital.domainBudgets.find(db => db.domain === a.domain);
                if (domainBudget) {
                  domainBudget.committedSpend += a.cost;
                  domainBudget.actualSpend += a.cost;
                  domainBudget.remainingBudget = domainBudget.annualBudget - domainBudget.actualSpend;
                  domainBudget.utilization = domainBudget.annualBudget > 0
                    ? Math.round((domainBudget.actualSpend / domainBudget.annualBudget) * 10000) / 100
                    : 0;
                  domainBudget.burnRate = Math.round(domainBudget.actualSpend / 3);
                  const expectedSpend = Math.round(domainBudget.annualBudget * 3 / 12);
                  domainBudget.variance = expectedSpend > 0
                    ? Math.round(((domainBudget.actualSpend - expectedSpend) / expectedSpend) * 10000) / 100
                    : 0;
                }
              }
            }
          }
        }
      }
    }
  }

  private createProcurementFromAction(action: Action): void {
    const now = new Date();
    const hospital = this.state.hospitals.find(h => h.id === action.hospitalId);
    const vendors = ['MedSupply Co', 'Gulf Medical Equipment', 'Al Salam Devices'];
    const vendorsAr = ['\u0634\u0631\u0643\u0629 \u0645\u064A\u062F \u0633\u0628\u0644\u0627\u064A', '\u0645\u0639\u062F\u0627\u062A \u0627\u0644\u062E\u0644\u064A\u062C \u0627\u0644\u0637\u0628\u064A\u0629', '\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0633\u0644\u0627\u0645'];
    const vi = rand(0, vendors.length - 1);

    this.state.procurement.push({
      id: `PO-${year()}-${++this.procurementCounter}`,
      code: `PO-${year()}-${this.procurementCounter}`,
      title: action.description,
      titleAr: action.descriptionAr,
      vendor: vendors[vi],
      vendorAr: vendorsAr[vi],
      domain: action.domain,
      totalSAR: rand(10000, 300000),
      stage: action.type === 'EMERGENCY_ORDER' ? 'ORDER' : 'REQUEST',
      delayRisk: 'ON_TRACK',
      requestDate: now,
      approvalDate: action.type === 'EMERGENCY_ORDER' ? now : null,
      orderDate: action.type === 'EMERGENCY_ORDER' ? now : null,
      shipmentDate: null,
      expectedDelivery: new Date(now.getTime() + rand(7, 30) * 86400000),
      actualDelivery: null,
      hospitalId: action.hospitalId,
      hospitalName: hospital?.name || '',
      hospitalNameAr: hospital?.nameAr || '',
      slaCompliance: true,
      daysInCurrentStage: 0,
    });
  }

  // ---- Procurement Advancement ----

  private advanceProcurement(): void {
    for (const po of this.state.procurement) {
      if (po.stage === 'DELIVERY' && po.actualDelivery) continue;

      po.daysInCurrentStage += 0.01; // approximate daily increment per tick

      const hasVendorDelay = this.state.signals.some(
        s => s.hospitalId === po.hospitalId && s.type === 'VENDOR_DELAY' && !s.resolvedAt
      );
      const advanceProb = hasVendorDelay ? 0.003 : 0.008;

      if (Math.random() < advanceProb) {
        const idx = PROCUREMENT_STAGES.indexOf(po.stage);
        if (idx < PROCUREMENT_STAGES.length - 1) {
          const now = new Date();
          po.stage = PROCUREMENT_STAGES[idx + 1];
          po.daysInCurrentStage = 0;
          if (po.stage === 'APPROVAL') po.approvalDate = now;
          if (po.stage === 'ORDER') po.orderDate = now;
          if (po.stage === 'SHIPMENT') po.shipmentDate = now;
          if (po.stage === 'DELIVERY') po.actualDelivery = now;
        }
      }

      if (po.daysInCurrentStage > 0.05 && po.delayRisk === 'ON_TRACK') {
        po.delayRisk = 'AT_RISK';
      }
      if (po.daysInCurrentStage > 0.12) {
        po.delayRisk = 'DELAYED';
      }
    }
  }

  // ---- System Health Update ----

  private updateSystemHealth(): void {
    const activeSignals = this.state.signals.filter(s => !s.resolvedAt);
    const activeDecisions = this.state.decisions.filter(d => d.status !== 'COMPLETED' && d.status !== 'REJECTED');
    const actionsToday = this.state.actions.filter(a => {
      const diff = Date.now() - a.createdAt.getTime();
      return diff < 86400000;
    });

    for (const hospital of this.state.hospitals) {
      // Natural pressure decay
      hospital.pressure = clamp(hospital.pressure - 0.5, 0, 100);

      // Recalculate active signals count
      hospital.activeSignals = activeSignals.filter(s => s.hospitalId === hospital.id).length;

      // Domain risk from active signals
      for (const domain of ALL_DOMAINS) {
        const domainSignals = activeSignals.filter(s => s.hospitalId === hospital.id && s.domain === domain);
        const ds = hospital.domains[domain];
        ds.riskScore = clamp(
          ds.riskScore + domainSignals.length * 2 - 0.5,
          0,
          100
        );
        ds.criticalItems = domainSignals.filter(s => s.severity === 'CRITICAL').length;
      }

      // Budget utilization
      hospital.budget.utilizationPct = hospital.budget.allocated > 0
        ? Math.round((hospital.budget.consumed / hospital.budget.allocated) * 100)
        : 0;
      hospital.budget.overrunRisk = hospital.budget.utilizationPct > 85;

      // Status from pressure
      if (hospital.pressure >= 80) hospital.status = 'CRITICAL';
      else if (hospital.pressure >= 60) hospital.status = 'HIGH_PRESSURE';
      else if (hospital.pressure >= 40) hospital.status = 'ELEVATED';
      else hospital.status = 'OPERATIONAL';
    }

    // System pulse
    const avgPressure = this.state.hospitals.reduce((sum, h) => sum + h.pressure, 0) / this.state.hospitals.length;
    const prevPressure = this.state.pulse.operationalPressure;
    const pulse = this.state.pulse;
    pulse.healthScore = clamp(Math.round(100 - avgPressure), 0, 100);
    pulse.operationalPressure = Math.round(avgPressure * 10) / 10;
    pulse.activeSignals = activeSignals.length;
    pulse.activeDecisions = activeDecisions.length;
    pulse.actionsToday = actionsToday.length;
    pulse.trend = avgPressure < prevPressure - 1 ? 'improving' : avgPressure > prevPressure + 1 ? 'degrading' : 'stable';

    const totalDecisions = this.state.decisions.length;
    const autoApproved = this.state.decisions.filter(d => d.autoApproved).length;
    pulse.autonomyScore = totalDecisions > 0 ? Math.round((autoApproved / totalDecisions) * 100) : 92;

    // Pressure dimensions
    this.updatePressureDimensions(activeSignals);
  }

  private updatePressureDimensions(activeSignals: Signal[]): void {
    const dims = this.state.pressure.dimensions;
    const byType = (types: SignalType[]) => activeSignals.filter(s => types.includes(s.type)).length;

    const supplyDim = dims.find(d => d.key === 'supply')!;
    const supplyCount = byType(['STOCKOUT', 'EXPIRY_WARNING', 'CLINICAL_DEMAND_SPIKE']);
    supplyDim.pressure = clamp(15 + supplyCount * 8, 0, 100);
    supplyDim.drivers = supplyCount > 0 ? [`${supplyCount} active supply signals`] : [];

    const deviceDim = dims.find(d => d.key === 'devices')!;
    const deviceCount = byType(['DEVICE_FAILURE', 'LIFECYCLE_BREACH', 'MAINTENANCE_DUE']);
    deviceDim.pressure = clamp(18 + deviceCount * 7, 0, 100);
    deviceDim.drivers = deviceCount > 0 ? [`${deviceCount} device issues`] : [];

    const budgetDim = dims.find(d => d.key === 'budget')!;
    const budgetCount = byType(['BUDGET_OVERRUN']);
    budgetDim.pressure = clamp(12 + budgetCount * 12, 0, 100);
    budgetDim.drivers = budgetCount > 0 ? [`${budgetCount} budget overruns`] : [];

    const compDim = dims.find(d => d.key === 'compliance')!;
    const compCount = byType(['COMPLIANCE_VIOLATION', 'QUALITY_RISK']);
    compDim.pressure = clamp(10 + compCount * 10, 0, 100);
    compDim.drivers = compCount > 0 ? [`${compCount} compliance issues`] : [];

    const workDim = dims.find(d => d.key === 'workforce')!;
    const workCount = byType(['WORKFORCE_STRAIN']);
    workDim.pressure = clamp(14 + workCount * 9, 0, 100);
    workDim.drivers = workCount > 0 ? [`${workCount} workforce signals`] : [];

    const vendorDim = dims.find(d => d.key === 'vendor')!;
    const vendorCount = byType(['VENDOR_DELAY', 'CONTRACT_EXPIRY']);
    vendorDim.pressure = clamp(16 + vendorCount * 8, 0, 100);
    vendorDim.drivers = vendorCount > 0 ? [`${vendorCount} vendor issues`] : [];

    for (const dim of dims) {
      const prev = dim.pressure;
      dim.trend = dim.pressure > prev + 2 ? 'rising' : dim.pressure < prev - 2 ? 'falling' : 'stable';
    }

    const composite = Math.round(dims.reduce((s, d) => s + d.pressure, 0) / dims.length);
    this.state.pressure.composite = composite;
    this.state.pressure.state = composite >= 70 ? 'CRITICAL_PRESSURE' : composite >= 50 ? 'HIGH_PRESSURE' : composite >= 30 ? 'ELEVATED' : 'STABLE';
  }

  // ---- Financial Impact Calculation ----

  private calculateFinancialImpact(
    decisionType: DecisionType,
    domain: SupplyDomain,
    seed: number,
  ): FinancialImpact {
    // Deterministic range selection based on seed (0-99)
    const lerp = (min: number, max: number) => Math.round(min + (seed / 100) * (max - min));

    let estimatedCost: number;
    let avoidedLoss: number;
    let netImpact: number;
    let budgetDeviation: number;

    switch (decisionType) {
      case 'EMERGENCY_PROCUREMENT':
        estimatedCost = lerp(25000, 150000);
        avoidedLoss = estimatedCost * 3;
        netImpact = avoidedLoss - estimatedCost;
        budgetDeviation = lerp(5, 15);
        break;
      case 'DEVICE_REPLACEMENT':
        estimatedCost = lerp(50000, 500000);
        avoidedLoss = estimatedCost * 2;
        netImpact = avoidedLoss - estimatedCost;
        budgetDeviation = lerp(8, 25);
        break;
      case 'SUPPLY_REORDER':
        estimatedCost = lerp(5000, 50000);
        avoidedLoss = Math.round(estimatedCost * 1.5);
        netImpact = avoidedLoss - estimatedCost;
        budgetDeviation = lerp(1, 5);
        break;
      case 'VENDOR_ESCALATION':
        estimatedCost = 0;
        avoidedLoss = 100000;
        netImpact = avoidedLoss;
        budgetDeviation = 0;
        break;
      case 'BUDGET_ADJUSTMENT':
        estimatedCost = 0;
        avoidedLoss = 0;
        netImpact = 50000;
        budgetDeviation = lerp(-10, 10);
        break;
      case 'MAINTENANCE_DISPATCH':
        estimatedCost = lerp(5000, 30000);
        avoidedLoss = estimatedCost * 4;
        netImpact = avoidedLoss - estimatedCost;
        budgetDeviation = lerp(1, 8);
        break;
      case 'RISK_MITIGATION':
        estimatedCost = lerp(10000, 80000);
        avoidedLoss = estimatedCost * 2.5;
        netImpact = Math.round(avoidedLoss - estimatedCost);
        budgetDeviation = lerp(2, 10);
        break;
      case 'VENDOR_SWITCH':
        estimatedCost = lerp(5000, 20000);
        avoidedLoss = lerp(50000, 200000);
        netImpact = avoidedLoss - estimatedCost;
        budgetDeviation = lerp(-5, 5);
        break;
      case 'COST_OPTIMIZATION':
        estimatedCost = lerp(2000, 10000);
        avoidedLoss = 0;
        netImpact = lerp(20000, 100000);
        budgetDeviation = lerp(-15, -3);
        break;
      case 'STOCK_REALLOCATION':
        estimatedCost = lerp(2000, 8000);
        avoidedLoss = lerp(15000, 60000);
        netImpact = avoidedLoss - estimatedCost;
        budgetDeviation = lerp(0, 3);
        break;
      default:
        estimatedCost = lerp(5000, 50000);
        avoidedLoss = estimatedCost * 2;
        netImpact = avoidedLoss - estimatedCost;
        budgetDeviation = lerp(1, 10);
    }

    // Domain-based multiplier for cost sensitivity
    const domainMultiplier =
      domain === 'MEDICAL_DEVICES' ? 1.4 :
      domain === 'IT_SYSTEMS' ? 1.2 :
      domain === 'DENTAL' ? 1.1 :
      domain === 'MEDICAL_CONSUMABLES' ? 1.0 :
      0.8;

    return {
      estimatedCost: Math.round(estimatedCost * domainMultiplier),
      avoidedLoss: Math.round(avoidedLoss * domainMultiplier),
      netImpact: Math.round(netImpact * domainMultiplier),
      budgetDeviation,
    };
  }

  // ---- Financial Summary ----

  getFinancialSummary(): { totalSpent: number; totalSaved: number; netImpact: number; budgetUtilization: number } {
    const completedActions = this.state.actions.filter(a => a.status === 'COMPLETED');
    const totalSpent = completedActions.reduce((sum, a) => sum + a.cost, 0);

    const completedDecisions = this.state.decisions.filter(d => d.status === 'COMPLETED');
    const totalSaved = completedDecisions.reduce((sum, d) => sum + d.financialImpact.avoidedLoss, 0);

    const netImpact = totalSaved - totalSpent;

    // Budget utilization: total allocated across all hospitals vs total consumed + action costs
    const totalAllocated = this.state.hospitals.reduce((sum, h) => sum + h.budget.allocated, 0);
    const totalConsumed = this.state.hospitals.reduce((sum, h) => sum + h.budget.consumed, 0) + totalSpent;
    const budgetUtilization = totalAllocated > 0 ? Math.round((totalConsumed / totalAllocated) * 100) : 0;

    return { totalSpent, totalSaved, netImpact, budgetUtilization };
  }

  // ---- Financial Dashboard ----

  getFinancialDashboard(): {
    groupBudget: { total: number; spent: number; committed: number; remaining: number; utilization: number };
    byDomain: DomainBudget[];
    byHospital: Array<{ id: string; name: string; budget: number; spent: number; utilization: number }>;
  } {
    // Aggregate domain budgets across all hospitals
    const domainAgg: Record<string, DomainBudget> = {};
    let totalBudget = 0;
    let totalSpent = 0;
    let totalCommitted = 0;

    for (const hospital of this.state.hospitals) {
      for (const db of hospital.domainBudgets) {
        if (!domainAgg[db.domain]) {
          domainAgg[db.domain] = {
            domain: db.domain,
            annualBudget: 0,
            approvedBudget: 0,
            committedSpend: 0,
            actualSpend: 0,
            forecastSpend: 0,
            burnRate: 0,
            variance: 0,
            remainingBudget: 0,
            utilization: 0,
          };
        }
        const agg = domainAgg[db.domain];
        agg.annualBudget += db.annualBudget;
        agg.approvedBudget += db.approvedBudget;
        agg.committedSpend += db.committedSpend;
        agg.actualSpend += db.actualSpend;
        agg.forecastSpend += db.forecastSpend;
        agg.burnRate += db.burnRate;
        agg.remainingBudget += db.remainingBudget;

        totalBudget += db.annualBudget;
        totalSpent += db.actualSpend;
        totalCommitted += db.committedSpend;
      }
    }

    // Calculate utilization and variance for aggregated domains
    const byDomain: DomainBudget[] = Object.values(domainAgg).map(d => {
      d.utilization = d.annualBudget > 0 ? Math.round((d.actualSpend / d.annualBudget) * 10000) / 100 : 0;
      const expectedSpend = Math.round(d.annualBudget * 3 / 12);
      d.variance = expectedSpend > 0 ? Math.round(((d.actualSpend - expectedSpend) / expectedSpend) * 10000) / 100 : 0;
      return d;
    });

    const byHospital = this.state.hospitals.map(h => {
      const budget = h.domainBudgets.reduce((s, db) => s + db.annualBudget, 0);
      const spent = h.domainBudgets.reduce((s, db) => s + db.actualSpend, 0);
      return {
        id: h.id,
        name: h.name,
        budget,
        spent,
        utilization: budget > 0 ? Math.round((spent / budget) * 10000) / 100 : 0,
      };
    });

    return {
      groupBudget: {
        total: totalBudget,
        spent: totalSpent,
        committed: totalCommitted,
        remaining: totalBudget - totalSpent,
        utilization: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 10000) / 100 : 0,
      },
      byDomain,
      byHospital,
    };
  }

  // ---- Notifications ----

  // ---- Revenue Intelligence ----

  private updateRevenue(): void {
    if (this.state.cycleCount % 10 !== 0) return;

    const assets = this.state.revenue.assets;
    for (const asset of assets) {
      // Utilization fluctuates slightly each cycle
      const drift = ((asset.id.length * 7 + this.state.cycleCount) % 11) - 5; // -5 to +5
      asset.utilizationRate = Math.max(20, Math.min(98, asset.utilizationRate + drift * 0.3));

      // Calculate revenue
      const activeHours = asset.hoursPerDay * (asset.utilizationRate / 100);
      asset.revenuePerDay = Math.round(activeHours * asset.revenuePerHour);

      // Downtime loss = if status is DOWN or MAINTENANCE
      if (asset.status === 'DOWN' || asset.status === 'MAINTENANCE') {
        asset.downtimeLoss = asset.hoursPerDay * asset.revenuePerHour;
        asset.revenuePerDay = 0;
      } else {
        asset.downtimeLoss = 0;
      }

      // Missed opportunities = unused capacity
      const idleHours = asset.hoursPerDay * ((100 - asset.utilizationRate) / 100);
      asset.missedOpportunities = Math.round(idleHours * asset.revenuePerHour);

      // Small chance of status change
      if (asset.status === 'ACTIVE' && ((asset.id.length + this.state.cycleCount) % 200 === 0)) {
        asset.status = 'MAINTENANCE';
      } else if (asset.status === 'MAINTENANCE' && ((asset.id.length + this.state.cycleCount) % 50 === 0)) {
        asset.status = 'ACTIVE';
      }
    }

    // Aggregate
    const activeAssets = assets.filter(a => a.status === 'ACTIVE');
    this.state.revenue.totalDailyRevenue = activeAssets.reduce((s, a) => s + a.revenuePerDay, 0);
    this.state.revenue.totalMissedRevenue = activeAssets.reduce((s, a) => s + a.missedOpportunities, 0);
    this.state.revenue.totalDowntimeLoss = assets.filter(a => a.status !== 'ACTIVE').reduce((s, a) => s + a.downtimeLoss, 0);
    this.state.revenue.avgUtilization = activeAssets.length > 0 ? activeAssets.reduce((s, a) => s + a.utilizationRate, 0) / activeAssets.length : 0;

    // Generate opportunities
    this.state.revenue.opportunities = [];
    for (const asset of activeAssets) {
      if (asset.utilizationRate < 50) {
        this.state.revenue.opportunities.push({
          id: `OPP-${asset.id}`,
          hospitalId: asset.hospitalId,
          hospitalName: asset.hospitalName,
          hospitalNameAr: asset.hospitalNameAr,
          assetName: asset.name,
          assetNameAr: asset.nameAr,
          type: 'INCREASE_UTILIZATION',
          potentialRevenueSAR: asset.missedOpportunities * 0.5,
          description: `Increase ${asset.name} utilization from ${Math.round(asset.utilizationRate)}% to 75% = +${Math.round(asset.missedOpportunities * 0.5).toLocaleString()} SAR/day`,
          descriptionAr: `زيادة استخدام ${asset.nameAr} من ${Math.round(asset.utilizationRate)}% إلى 75% = +${Math.round(asset.missedOpportunities * 0.5).toLocaleString()} ر.س/يوم`,
        });
      }
      if (asset.utilizationRate > 90) {
        this.state.revenue.opportunities.push({
          id: `OPP-EXP-${asset.id}`,
          hospitalId: asset.hospitalId,
          hospitalName: asset.hospitalName,
          hospitalNameAr: asset.hospitalNameAr,
          assetName: asset.name,
          assetNameAr: asset.nameAr,
          type: 'ADD_DEVICE',
          potentialRevenueSAR: asset.revenuePerDay * 0.4,
          description: `${asset.name} at ${Math.round(asset.utilizationRate)}% capacity — consider adding device for +${Math.round(asset.revenuePerDay * 0.4).toLocaleString()} SAR/day`,
          descriptionAr: `${asset.nameAr} عند ${Math.round(asset.utilizationRate)}% سعة — إضافة جهاز = +${Math.round(asset.revenuePerDay * 0.4).toLocaleString()} ر.س/يوم`,
        });
      }
    }
  }

  // ---- Impact Intelligence Engine ----

  private detectImpacts(): void {
    const now = new Date();

    // Detect LOSSES from completed decisions
    for (const decision of this.state.decisions) {
      if (decision.status !== 'COMPLETED' || !decision.financialImpact) continue;
      // Skip if already tracked
      if (this.state.impact.losses.some(l => l.linkedDecisionId === decision.id) ||
          this.state.impact.savings.some(s => s.linkedDecisionId === decision.id)) continue;

      const hospital = this.state.hospitals.find(h => h.id === decision.hospitalId);
      if (!hospital) continue;

      // Emergency procurement = LOSS (rush premium)
      if (decision.type === 'EMERGENCY_PROCUREMENT') {
        const rushPremium = decision.financialImpact.estimatedCost * 0.2; // 20% rush premium
        this.state.impact.losses.push({
          id: `IMP-L-${this.state.impact.losses.length + 1}`,
          hospitalId: decision.hospitalId,
          hospitalName: hospital.name,
          hospitalNameAr: hospital.nameAr,
          domain: decision.domain,
          type: 'LOSS',
          value: rushPremium,
          trend: 'stable',
          cause: 'EMERGENCY_PRICING',
          description: `Rush premium on emergency order: ${decision.code}`,
          descriptionAr: `علاوة طوارئ على طلب عاجل: ${decision.code}`,
          linkedDecisionId: decision.id,
          timestamp: now,
        });
      }

      // Stock transfer = SAVING (avoided procurement)
      if (decision.type === 'STOCK_REALLOCATION') {
        const saved = decision.financialImpact.avoidedLoss;
        this.state.impact.savings.push({
          id: `IMP-S-${this.state.impact.savings.length + 1}`,
          hospitalId: decision.hospitalId,
          hospitalName: hospital.name,
          hospitalNameAr: hospital.nameAr,
          domain: decision.domain,
          type: 'SAVING',
          value: saved,
          trend: 'increasing',
          cause: 'STOCK_TRANSFER',
          description: `Cross-hospital transfer avoided procurement: ${decision.code}`,
          descriptionAr: `نقل بين المستشفيات تجنب المشتريات: ${decision.code}`,
          linkedDecisionId: decision.id,
          timestamp: now,
        });
      }

      // Regular procurement = opportunity to save
      if (decision.type === 'SUPPLY_REORDER' && decision.financialImpact.netImpact > 0) {
        this.state.impact.savings.push({
          id: `IMP-S-${this.state.impact.savings.length + 1}`,
          hospitalId: decision.hospitalId,
          hospitalName: hospital.name,
          hospitalNameAr: hospital.nameAr,
          domain: decision.domain,
          type: 'SAVING',
          value: decision.financialImpact.netImpact,
          trend: 'stable',
          cause: 'AVOIDED_EMERGENCY',
          description: `Proactive reorder avoided emergency: ${decision.code}`,
          descriptionAr: `إعادة طلب استباقية تجنبت الطوارئ: ${decision.code}`,
          linkedDecisionId: decision.id,
          timestamp: now,
        });
      }

      // Device replacement = both loss and opportunity
      if (decision.type === 'DEVICE_REPLACEMENT') {
        this.state.impact.losses.push({
          id: `IMP-L-${this.state.impact.losses.length + 1}`,
          hospitalId: decision.hospitalId,
          hospitalName: hospital.name,
          hospitalNameAr: hospital.nameAr,
          domain: decision.domain,
          type: 'LOSS',
          value: decision.financialImpact.estimatedCost,
          trend: 'stable',
          cause: 'EQUIPMENT_DOWNTIME',
          description: `Device replacement cost: ${decision.code}`,
          descriptionAr: `تكلفة استبدال جهاز: ${decision.code}`,
          linkedDecisionId: decision.id,
          timestamp: now,
        });
        // But also avoided loss
        this.state.impact.savings.push({
          id: `IMP-S-${this.state.impact.savings.length + 1}`,
          hospitalId: decision.hospitalId,
          hospitalName: hospital.name,
          hospitalNameAr: hospital.nameAr,
          domain: decision.domain,
          type: 'SAVING',
          value: decision.financialImpact.avoidedLoss,
          trend: 'increasing',
          cause: 'AVOIDED_EMERGENCY',
          description: `Avoided extended downtime: ${decision.code}`,
          descriptionAr: `تجنب توقف ممتد: ${decision.code}`,
          linkedDecisionId: decision.id,
          timestamp: now,
        });
      }

      // Set impactMetrics on the decision
      decision.impactMetrics = {
        costBefore: decision.financialImpact.estimatedCost + decision.financialImpact.avoidedLoss,
        costAfter: decision.financialImpact.estimatedCost,
        riskBefore: decision.riskScore,
        riskAfter: Math.max(0, decision.riskScore - 30),
        netImpactSAR: decision.financialImpact.netImpact,
        timeSaved: 4 + (decision.hospitalId.length % 8), // hours
      };
    }

    // Detect RISKS from active signals
    for (const signal of this.state.signals) {
      if (signal.resolvedAt) continue;
      if (this.state.impact.risks.some(r => r.linkedDecisionId === signal.id)) continue;

      const hospital = this.state.hospitals.find(h => h.id === signal.hospitalId);
      if (!hospital) continue;

      if (signal.severity === 'CRITICAL' || signal.severity === 'HIGH') {
        const riskValue = signal.severity === 'CRITICAL' ? 150000 : 75000;
        this.state.impact.risks.push({
          id: `IMP-R-${this.state.impact.risks.length + 1}`,
          hospitalId: signal.hospitalId,
          hospitalName: hospital.name,
          hospitalNameAr: hospital.nameAr,
          domain: signal.domain,
          type: 'RISK',
          value: riskValue,
          trend: 'increasing',
          cause: signal.type === 'VENDOR_DELAY' ? 'VENDOR_DELAY' : signal.type === 'STOCKOUT' ? 'DEMAND_SPIKE' : 'EQUIPMENT_DOWNTIME',
          description: signal.title,
          descriptionAr: signal.titleAr,
          linkedDecisionId: signal.id,
          timestamp: now,
        });
      }
    }

    // Update supply chain state
    const totalActions = this.state.actions.filter(a => a.status === 'COMPLETED');
    const transfers = totalActions.filter(a => a.type === 'TRANSFER_STOCK');
    const purchases = totalActions.filter(a => a.type === 'CREATE_PO' || a.type === 'EMERGENCY_ORDER');

    this.state.impact.supplyChain = {
      totalSpend: this.state.impact.losses.reduce((s, l) => s + l.value, 0),
      totalSaved: this.state.impact.savings.reduce((s, sv) => s + sv.value, 0),
      efficiencyScore: Math.min(100, 70 + (this.state.impact.savings.length * 2)),
      vendorRiskIndex: Math.min(100, this.state.impact.risks.filter(r => r.cause === 'VENDOR_DELAY').length * 15),
      transferVsProcurementRatio: purchases.length > 0 ? transfers.length / (transfers.length + purchases.length) : 0,
    };

    // Keep only last 50 entries per category to prevent memory bloat
    if (this.state.impact.losses.length > 50) this.state.impact.losses = this.state.impact.losses.slice(-50);
    if (this.state.impact.savings.length > 50) this.state.impact.savings = this.state.impact.savings.slice(-50);
    if (this.state.impact.risks.length > 50) this.state.impact.risks = this.state.impact.risks.slice(-50);
  }

  getImpactDashboard(hospitalId?: string): {
    topLosses: ImpactEntry[];
    topSavings: ImpactEntry[];
    activeRisks: ImpactEntry[];
    totalLost: number;
    totalSaved: number;
    netImpact: number;
    trend: 'improving' | 'stable' | 'degrading';
    supplyChain: SupplyChainState;
  } {
    const filter = (entries: ImpactEntry[]) => hospitalId ? entries.filter(e => e.hospitalId === hospitalId) : entries;
    const losses = filter(this.state.impact.losses);
    const savings = filter(this.state.impact.savings);
    const risks = filter(this.state.impact.risks);
    const totalLost = losses.reduce((s, l) => s + l.value, 0);
    const totalSaved = savings.reduce((s, sv) => s + sv.value, 0);
    return {
      topLosses: losses.slice(-3).reverse(),
      topSavings: savings.slice(-3).reverse(),
      activeRisks: risks.filter(r => r.trend !== 'decreasing').slice(-5).reverse(),
      totalLost,
      totalSaved,
      netImpact: totalSaved - totalLost,
      trend: totalSaved > totalLost * 1.2 ? 'improving' : totalLost > totalSaved * 1.2 ? 'degrading' : 'stable',
      supplyChain: this.state.impact.supplyChain,
    };
  }

  getRevenueDashboard(hospitalId?: string): {
    totalRevenue: number;
    missedRevenue: number;
    downtimeLoss: number;
    avgUtilization: number;
    topOpportunities: RevenueOpportunity[];
    assetsByHospital: Array<{ hospitalId: string; hospitalName: string; assetCount: number; revenue: number; utilization: number }>;
  } {
    const filter = (a: RevenueAsset) => hospitalId ? a.hospitalId === hospitalId : true;
    const assets = this.state.revenue.assets.filter(filter);
    const active = assets.filter(a => a.status === 'ACTIVE');
    // Group by hospital
    const byHospital = new Map<string, { name: string; assets: RevenueAsset[] }>();
    for (const a of assets) {
      const entry = byHospital.get(a.hospitalId) || { name: a.hospitalName, assets: [] };
      entry.assets.push(a);
      byHospital.set(a.hospitalId, entry);
    }
    return {
      totalRevenue: active.reduce((s, a) => s + a.revenuePerDay, 0),
      missedRevenue: active.reduce((s, a) => s + a.missedOpportunities, 0),
      downtimeLoss: assets.filter(a => a.status !== 'ACTIVE').reduce((s, a) => s + a.downtimeLoss, 0),
      avgUtilization: active.length > 0 ? Math.round(active.reduce((s, a) => s + a.utilizationRate, 0) / active.length) : 0,
      topOpportunities: this.state.revenue.opportunities.filter(o => hospitalId ? o.hospitalId === hospitalId : true).sort((a, b) => b.potentialRevenueSAR - a.potentialRevenueSAR).slice(0, 5),
      assetsByHospital: Array.from(byHospital.entries()).map(([id, data]) => ({
        hospitalId: id,
        hospitalName: data.name,
        assetCount: data.assets.length,
        revenue: data.assets.filter(a => a.status === 'ACTIVE').reduce((s, a) => s + a.revenuePerDay, 0),
        utilization: Math.round(data.assets.filter(a => a.status === 'ACTIVE').reduce((s, a) => s + a.utilizationRate, 0) / Math.max(1, data.assets.filter(a => a.status === 'ACTIVE').length)),
      })),
    };
  }

  // ==================================================================
  // SLA ESCALATION ENGINE
  // ==================================================================

  private checkRequestSLAs(): void {
    if (this.state.cycleCount % 30 !== 0) return; // Check every 30 ticks

    const now = new Date();
    const escalationMap: Record<string, string> = {
      HEAD_OF_DEPARTMENT: 'GENERAL_DIRECTOR',
      DON: 'GENERAL_DIRECTOR',
      EXECUTIVE_DIRECTOR: 'GENERAL_DIRECTOR',
      SUPPLY_CHAIN: 'GENERAL_DIRECTOR',
      GENERAL_DIRECTOR: 'COO',
      CFO: 'COO',
      COO: 'CEO',
      BIOMEDICAL: 'EXECUTIVE_DIRECTOR',
      IT_DIRECTOR: 'EXECUTIVE_DIRECTOR',
    };

    for (const request of this.state.requests) {
      if (['REJECTED', 'PO_GENERATED', 'DELIVERED', 'WORK_ORDER_CREATED', 'TRANSFER_INITIATED', 'BUDGET_APPROVED', 'COMPLETED'].includes(request.status)) continue;

      const step = request.approvalChain[request.currentApprovalStep];
      if (!step || step.status !== 'PENDING' || !step.pendingSince) continue;

      const elapsedMs = now.getTime() - step.pendingSince.getTime();
      const elapsedHours = elapsedMs / 3600000;

      if (elapsedHours > step.slaHours && !step.escalatedTo) {
        // Escalate
        const escalateTo = escalationMap[step.role];
        if (escalateTo) {
          step.escalatedTo = escalateTo;
          step.status = 'ESCALATED';
          request.slaBreached = true;

          this.addAudit({
            requestId: request.id, requestCode: request.code,
            action: 'ESCALATED', performedBy: 'SYSTEM', performedByRole: 'SYSTEM',
            previousState: 'PENDING', newState: 'ESCALATED',
            stepRole: step.role, comments: `SLA breached (${step.slaHours}h). Escalated from ${step.role} to ${escalateTo}`,
            metadata: { elapsedHours: Math.round(elapsedHours), slaHours: step.slaHours, escalatedTo: escalateTo },
          });

          // Allow escalatedTo role to approve
          step.status = 'PENDING';
        }

        // Also mark overall SLA
        this.addAudit({
          requestId: request.id, requestCode: request.code,
          action: 'SLA_BREACHED', performedBy: 'SYSTEM', performedByRole: 'SYSTEM',
          previousState: request.status, newState: request.status,
          stepRole: step.role, comments: `Step SLA breached: ${step.role} exceeded ${step.slaHours}h`,
          metadata: { stepIndex: request.currentApprovalStep, elapsedHours: Math.round(elapsedHours) },
        });
      }
    }
  }

  // ==================================================================
  // SUPPLY REQUEST WORKFLOW
  // ==================================================================

  private requestCounter = 0;
  private auditCounter = 0;

  private addAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
    this.auditCounter++;
    this.state.auditLog.push({
      id: `AUD-${this.auditCounter}`,
      timestamp: new Date(),
      ...entry,
    });
    // Keep last 500 entries
    if (this.state.auditLog.length > 500) this.state.auditLog = this.state.auditLog.slice(-500);
  }

  createRequest(params: {
    requestType?: RequestType;
    hospitalId: string;
    department: string;
    departmentAr: string;
    requestedBy: string;
    requestedByAr: string;
    requestedByRole: string;
    domain: SupplyDomain;
    items: Array<{ itemId: string; name: string; nameAr: string; sku: string; quantity: number; unit: string; estimatedCost: number }>;
    priority: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
    justification: string;
    justificationAr: string;
    // Maintenance
    deviceId?: string;
    deviceName?: string;
    deviceNameAr?: string;
    maintenanceType?: 'PREVENTIVE' | 'CORRECTIVE' | 'EMERGENCY';
    // Transfer
    sourceHospitalId?: string;
    targetHospitalId?: string;
    // Budget
    budgetCategory?: string;
    budgetPeriod?: string;
    budgetAmount?: number;
  }): SupplyRequest {
    const hospital = this.state.hospitals.find(h => h.id === params.hospitalId);
    const now = new Date();
    this.requestCounter++;
    const reqType = params.requestType || 'SUPPLY_REQUEST';
    const codePrefixes: Record<RequestType, string> = {
      SUPPLY_REQUEST: 'REQ', MAINTENANCE_REQUEST: 'MNT', TRANSFER_REQUEST: 'TRF',
      BUDGET_REQUEST: 'BDG', REPLENISHMENT_REQUEST: 'RPL',
    };
    const code = `${codePrefixes[reqType]}-${now.getFullYear()}-${String(this.requestCounter).padStart(4, '0')}`;

    // Build approval chain based on request type, domain, and cost
    const totalCost = params.budgetAmount || params.items.reduce((s, i) => s + i.estimatedCost * i.quantity, 0);
    const chain = this.buildRequestApprovalChain(reqType, params.domain, totalCost, params.priority);

    // Set first step to PENDING (active)
    if (chain.length > 0) chain[0].status = 'PENDING';

    // SLA: ROUTINE=72h, URGENT=24h, EMERGENCY=4h
    const slaHours = params.priority === 'EMERGENCY' ? 4 : params.priority === 'URGENT' ? 24 : 72;
    const slaDeadline = new Date(now.getTime() + slaHours * 3600000);

    const request: SupplyRequest = {
      id: `req-${this.requestCounter}`,
      code,
      hospitalId: params.hospitalId,
      hospitalName: hospital?.name || params.hospitalId,
      hospitalNameAr: hospital?.nameAr || params.hospitalId,
      department: params.department,
      departmentAr: params.departmentAr,
      requestedBy: params.requestedBy,
      requestedByAr: params.requestedByAr,
      requestedByRole: params.requestedByRole,
      domain: params.domain,
      items: params.items,
      totalEstimatedCost: totalCost,
      priority: params.priority,
      justification: params.justification,
      justificationAr: params.justificationAr,
      requestType: reqType,
      status: 'SUBMITTED',
      approvalChain: chain,
      currentApprovalStep: 0,
      createdAt: now,
      updatedAt: now,
      poCode: null,
      expectedDelivery: null,
      slaDeadline,
      slaBreached: false,
      // Type-specific fields
      deviceId: params.deviceId,
      deviceName: params.deviceName,
      deviceNameAr: params.deviceNameAr,
      maintenanceType: params.maintenanceType,
      sourceHospitalId: params.sourceHospitalId,
      sourceHospitalName: params.sourceHospitalId ? this.state.hospitals.find(h => h.id === params.sourceHospitalId)?.name : undefined,
      sourceHospitalNameAr: params.sourceHospitalId ? this.state.hospitals.find(h => h.id === params.sourceHospitalId)?.nameAr : undefined,
      targetHospitalId: params.targetHospitalId || params.hospitalId,
      targetHospitalName: params.targetHospitalId ? this.state.hospitals.find(h => h.id === params.targetHospitalId)?.name : undefined,
      targetHospitalNameAr: params.targetHospitalId ? this.state.hospitals.find(h => h.id === params.targetHospitalId)?.nameAr : undefined,
      budgetCategory: params.budgetCategory,
      budgetPeriod: params.budgetPeriod,
      budgetAmount: params.budgetAmount,
    };

    this.state.requests.push(request);

    // Set pendingSince on first step
    if (chain.length > 0) chain[0].pendingSince = now;

    // AUDIT: creation
    this.addAudit({
      requestId: request.id, requestCode: request.code,
      action: 'CREATED', performedBy: params.requestedBy, performedByRole: params.requestedByRole,
      previousState: 'NONE', newState: 'SUBMITTED',
      stepRole: chain[0]?.role || null, comments: params.justification,
      metadata: { requestType: reqType, totalCost: totalCost, priority: params.priority, itemCount: params.items.length },
    });

    this.notify();
    return request;
  }

  private buildRequestApprovalChain(reqType: RequestType, domain: SupplyDomain, cost: number, priority: 'ROUTINE' | 'URGENT' | 'EMERGENCY'): RequestApprovalStep[] {
    const slaMap: Record<string, number> = {
      HEAD_OF_DEPARTMENT: 4, DON: 8, EXECUTIVE_DIRECTOR: 8, SUPPLY_CHAIN: 12,
      GENERAL_DIRECTOR: 24, CFO: 24, COO: 48, BIOMEDICAL: 6, IT_DIRECTOR: 8,
    };
    const s = (role: string, roleName: string, roleNameAr: string): RequestApprovalStep =>
      ({ role, roleName, roleNameAr, status: 'WAITING', timestamp: null, comments: '', slaHours: slaMap[role] || 12, pendingSince: null, escalatedTo: null });

    // ---- MAINTENANCE REQUEST ----
    // HOD → Biomedical/IT → Supply Chain (for parts)
    if (reqType === 'MAINTENANCE_REQUEST') {
      const chain = [s('HEAD_OF_DEPARTMENT', 'Head of Department', 'رئيس القسم')];
      if (domain === 'IT_SYSTEMS') {
        chain.push(s('IT_DIRECTOR', 'IT Director', 'مدير تقنية المعلومات'));
      } else {
        chain.push(s('BIOMEDICAL', 'Biomedical Engineering', 'الهندسة الطبية'));
      }
      if (cost >= 20000) chain.push(s('GENERAL_DIRECTOR', 'General Director', 'المدير العام'));
      return chain;
    }

    // ---- TRANSFER REQUEST ----
    // HOD (source) → Supply Chain → HOD (target hospital auto-approved)
    if (reqType === 'TRANSFER_REQUEST') {
      return [
        s('HEAD_OF_DEPARTMENT', 'Head of Department (Source)', 'رئيس القسم (المصدر)'),
        s('SUPPLY_CHAIN', 'Supply Chain', 'سلسلة الإمداد'),
      ];
    }

    // ---- BUDGET REQUEST ----
    // HOD → Director → GD → CFO → (COO if > 500K)
    if (reqType === 'BUDGET_REQUEST') {
      const chain = [s('HEAD_OF_DEPARTMENT', 'Head of Department', 'رئيس القسم')];
      if (['MEDICAL_CONSUMABLES', 'MEDICAL_DEVICES'].includes(domain)) {
        chain.push(s('DON', 'Nursing Director', 'مديرة التمريض'));
      } else {
        chain.push(s('EXECUTIVE_DIRECTOR', 'Executive Director', 'المدير التنفيذي'));
      }
      chain.push(s('GENERAL_DIRECTOR', 'General Director', 'المدير العام'));
      chain.push(s('CFO', 'CFO', 'المدير المالي'));
      if (cost >= 500000) chain.push(s('COO', 'COO', 'مدير العمليات'));
      return chain;
    }

    // ---- SUPPLY / REPLENISHMENT REQUEST (original flow) ----
    const chain: RequestApprovalStep[] = [];
    if (priority === 'EMERGENCY' && cost < 10000) {
      chain.push(s('HEAD_OF_DEPARTMENT', 'Head of Department', 'رئيس القسم'));
      chain.push(s('SUPPLY_CHAIN', 'Supply Chain', 'سلسلة الإمداد'));
      return chain;
    }
    chain.push(s('HEAD_OF_DEPARTMENT', 'Head of Department', 'رئيس القسم'));
    if (['MEDICAL_CONSUMABLES', 'MEDICAL_DEVICES'].includes(domain)) {
      chain.push(s('DON', 'Nursing Director', 'مديرة التمريض'));
    } else {
      chain.push(s('EXECUTIVE_DIRECTOR', 'Executive Director', 'المدير التنفيذي'));
    }
    chain.push(s('SUPPLY_CHAIN', 'Supply Chain', 'سلسلة الإمداد'));
    if (cost >= 50000) chain.push(s('GENERAL_DIRECTOR', 'General Director', 'المدير العام'));
    if (cost >= 200000) chain.push(s('COO', 'COO', 'مدير العمليات'));
    return chain;
  }

  approveRequestStep(requestId: string, role: string, comments: string = '', userId?: string, userName?: string): { success: boolean; request: SupplyRequest | null; error?: string } {
    const request = this.state.requests.find(r => r.id === requestId);
    if (!request) return { success: false, request: null, error: 'Request not found' };

    // STATE GUARD: prevent action on terminal states
    if (['REJECTED', 'PO_GENERATED', 'DELIVERED', 'WORK_ORDER_CREATED', 'TRANSFER_INITIATED', 'BUDGET_APPROVED', 'COMPLETED'].includes(request.status)) {
      return { success: false, request, error: `Request is in terminal state: ${request.status}` };
    }

    const stepIndex = request.currentApprovalStep;
    const step = request.approvalChain[stepIndex];

    // STATE GUARD: prevent wrong role
    if (!step || (step.role !== role && step.escalatedTo !== role)) {
      return { success: false, request, error: `Not your turn. Current step requires: ${step?.role || 'none'}` };
    }

    // STATE GUARD: prevent double approval
    if (step.status === 'APPROVED') {
      return { success: false, request, error: 'Step already approved' };
    }

    const previousState = request.status;

    // Approve current step
    step.status = 'APPROVED';
    step.timestamp = new Date();
    step.comments = comments;
    request.updatedAt = new Date();

    // AUDIT — full identity
    this.addAudit({
      requestId: request.id, requestCode: request.code,
      action: 'APPROVED',
      performedBy: userName || userId || role,
      performedByRole: role,
      previousState, newState: 'IN_APPROVAL',
      stepRole: step.role, comments,
      metadata: { stepIndex, totalSteps: request.approvalChain.length, userId: userId || null },
    });

    // Move to next step
    if (stepIndex + 1 < request.approvalChain.length) {
      request.currentApprovalStep = stepIndex + 1;
      request.approvalChain[stepIndex + 1].status = 'PENDING';
      request.status = 'IN_APPROVAL';
    } else {
      // All approved — finalize based on request type
      const hospital = this.state.hospitals.find(h => h.id === request.hospitalId);
      const rt = request.requestType || 'SUPPLY_REQUEST';

      if (rt === 'MAINTENANCE_REQUEST') {
        request.status = 'WORK_ORDER_CREATED';
        request.workOrderCode = `WO-${new Date().getFullYear()}-${String(this.requestCounter).padStart(4, '0')}`;
        request.expectedDelivery = new Date(Date.now() + 3 * 86400000); // 3 days for maintenance

      } else if (rt === 'TRANSFER_REQUEST') {
        request.status = 'TRANSFER_INITIATED';
        request.expectedDelivery = new Date(Date.now() + 2 * 86400000); // 2 days for transfer

      } else if (rt === 'BUDGET_REQUEST') {
        request.status = 'BUDGET_APPROVED';

      } else {
        // SUPPLY_REQUEST / REPLENISHMENT_REQUEST → PO
        request.status = 'PO_GENERATED';
        const poCode = `PO-${new Date().getFullYear()}-${String(this.state.procurement.length + 1).padStart(4, '0')}`;
        request.poCode = poCode;
        request.expectedDelivery = new Date(Date.now() + 14 * 86400000);

        this.state.procurement.push({
          id: `po-req-${request.id}`,
          code: poCode,
          title: `Supply request ${request.code}`,
          titleAr: `طلب إمداد ${request.code}`,
          vendor: 'Auto-assigned',
          vendorAr: 'تعيين تلقائي',
          domain: request.domain,
          totalSAR: request.totalEstimatedCost,
          stage: 'ORDER' as const,
          delayRisk: 'ON_TRACK' as const,
          requestDate: request.createdAt,
          approvalDate: new Date(),
          orderDate: new Date(),
          shipmentDate: null,
          expectedDelivery: request.expectedDelivery,
          actualDelivery: null,
          hospitalId: request.hospitalId,
          hospitalName: hospital?.name || request.hospitalId,
          hospitalNameAr: hospital?.nameAr || request.hospitalId,
          slaCompliance: true,
          daysInCurrentStage: 0,
        });
      }
    }

    // Set pendingSince on new current step
    if (request.status === 'IN_APPROVAL') {
      const nextStep = request.approvalChain[request.currentApprovalStep];
      if (nextStep) nextStep.pendingSince = new Date();
    }

    // Check SLA
    if (new Date() > request.slaDeadline) {
      request.slaBreached = true;
    }

    // Final state audit
    if ((request.status as any) !== 'IN_APPROVAL' && (request.status as any) !== 'SUBMITTED') {
      this.addAudit({
        requestId: request.id, requestCode: request.code,
        action: 'COMPLETED', performedBy: 'SYSTEM', performedByRole: 'SYSTEM',
        previousState: 'IN_APPROVAL', newState: request.status,
        stepRole: null, comments: `All approvals complete. Final: ${request.status}`,
        metadata: { poCode: request.poCode, workOrderCode: request.workOrderCode },
      });
    }

    this.notify();
    return { success: true, request };
  }

  rejectRequestStep(requestId: string, role: string, comments: string = '', userId?: string, userName?: string): { success: boolean; request: SupplyRequest | null; error?: string } {
    const request = this.state.requests.find(r => r.id === requestId);
    if (!request) return null;

    if (!request) return { success: false, request: null, error: 'Request not found' };
    if (['REJECTED', 'PO_GENERATED', 'COMPLETED'].includes(request.status)) {
      return { success: false, request, error: `Request is in terminal state: ${request.status}` };
    }

    const stepIndex = request.currentApprovalStep;
    const step = request.approvalChain[stepIndex];
    if (!step || (step.role !== role && step.escalatedTo !== role)) {
      return { success: false, request, error: `Not your turn. Current step requires: ${step?.role || 'none'}` };
    }
    if (step.status === 'REJECTED') {
      return { success: false, request, error: 'Step already rejected' };
    }

    const previousState = request.status;
    step.status = 'REJECTED';
    step.timestamp = new Date();
    step.comments = comments;
    request.status = 'REJECTED';
    request.updatedAt = new Date();

    this.addAudit({
      requestId: request.id, requestCode: request.code,
      action: 'REJECTED',
      performedBy: userName || userId || role,
      performedByRole: role,
      previousState, newState: 'REJECTED',
      stepRole: step.role, comments,
      metadata: { stepIndex, reason: comments },
    });

    this.notify();
    return { success: true, request };
  }

  getRequests(hospitalId?: string): SupplyRequest[] {
    if (hospitalId) return this.state.requests.filter(r => r.hospitalId === hospitalId);
    return this.state.requests;
  }

  getRequest(requestId: string): SupplyRequest | null {
    return this.state.requests.find(r => r.id === requestId) || null;
  }

  getAuditLog(requestId?: string): AuditEntry[] {
    if (requestId) return this.state.auditLog.filter(a => a.requestId === requestId);
    return this.state.auditLog;
  }

  // Advance request to DELIVERED status (simulate delivery)
  deliverRequest(requestId: string): SupplyRequest | null {
    const request = this.state.requests.find(r => r.id === requestId);
    if (!request || request.status !== 'PO_GENERATED') return null;

    request.status = 'DELIVERED';
    request.updatedAt = new Date();

    // Update inventory — increase stock for requested items
    for (const item of request.items) {
      const invItem = this.state.inventoryItems.find(
        i => i.sku === item.sku && i.hospitalId === request.hospitalId
      );
      if (invItem) {
        invItem.onHand += item.quantity;
        invItem.available += item.quantity;
      }
    }

    this.notify();
    return request;
  }

  private notify(): void {
    const snapshot = { ...this.state };
    this.listeners.forEach(l => l(snapshot));
  }

  // ---- Cleanup (for tests / HMR) ----

  static reset(): void {
    if (ImdadBrain.instance) {
      ImdadBrain.instance.stop();
      ImdadBrain.instance = null;
    }
  }
}
