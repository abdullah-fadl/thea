// core/rbac/roles.ts — IMDAD Role-Based Access Control System

export type ImdadRole =
  | 'BOARD_MEMBER'
  | 'CEO'
  | 'CFO_GROUP'
  | 'COO_GROUP'
  | 'CMO_GROUP'
  | 'THEA_SOLUTIONS_CEO'
  | 'THEA_MEDICAL_CEO'
  | 'THEA_LAB_CEO'
  | 'THEA_PHARMACY_CEO'
  | 'DAHNAA_DENTAL_CEO'
  | 'VP_SUPPLY_CHAIN'
  | 'GENERAL_DIRECTOR'
  | 'MEDICAL_DIRECTOR'
  | 'EXECUTIVE_DIRECTOR'
  | 'NURSING_DIRECTOR'
  | 'CFO'
  | 'IT_DIRECTOR'
  | 'DENTAL_DIRECTOR'
  | 'SUPPLY_CHAIN_MANAGER'
  | 'HEAD_OF_DEPARTMENT'
  | 'SUPERVISOR'
  | 'HEAD_NURSE';

export type SupplyDomain =
  | 'MEDICAL_CONSUMABLES'
  | 'MEDICAL_DEVICES'
  | 'NON_MEDICAL_CONSUMABLES'
  | 'NON_MEDICAL_DEVICES'
  | 'FURNITURE'
  | 'OFFICE_EQUIPMENT'
  | 'IT_SYSTEMS'
  | 'DENTAL';

export type PermissionAction =
  | 'VIEW'
  | 'REQUEST'
  | 'APPROVE'
  | 'EXECUTE'
  | 'OVERRIDE'
  | 'CONFIGURE';

// ---------------------------------------------------------------------------
// Subsidiary types
// ---------------------------------------------------------------------------

export type Subsidiary = 'THEA_SOLUTIONS' | 'THEA_MEDICAL' | 'THEA_LAB' | 'THEA_PHARMACY' | 'DAHNAA_DENTAL' | 'HOSPITAL';

export const SUBSIDIARY_DOMAINS: Record<Subsidiary, SupplyDomain[]> = {
  THEA_SOLUTIONS: ['IT_SYSTEMS', 'OFFICE_EQUIPMENT'],
  THEA_MEDICAL: ['MEDICAL_DEVICES'],
  THEA_LAB: ['MEDICAL_CONSUMABLES'], // lab consumables
  THEA_PHARMACY: ['MEDICAL_CONSUMABLES'], // pharmacy supplies
  DAHNAA_DENTAL: ['DENTAL'],
  HOSPITAL: ['MEDICAL_CONSUMABLES', 'NON_MEDICAL_CONSUMABLES', 'NON_MEDICAL_DEVICES', 'FURNITURE'],
};

// ---------------------------------------------------------------------------
// Role definition interface
// ---------------------------------------------------------------------------

export interface RoleDefinition {
  role: ImdadRole;
  tier: 0 | 1 | 2 | 3;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  domains: SupplyDomain[] | 'ALL';
  hospitalScope: 'ALL' | 'ASSIGNED';
  permissions: PermissionAction[];
  reportsTo: ImdadRole | null;
  canOverride: boolean;
  canEscalate: boolean;
  dashboardView: 'EXECUTIVE' | 'OPERATIONAL' | 'DEPARTMENTAL';
  visibleModules: string[];
  subsidiary?: Subsidiary;
}

// ---------------------------------------------------------------------------
// Role definitions
// ---------------------------------------------------------------------------

export const ROLE_DEFINITIONS: Record<ImdadRole, RoleDefinition> = {
  // -----------------------------------------------------------------------
  // Tier 0 — Board & CEO
  // -----------------------------------------------------------------------

  BOARD_MEMBER: {
    role: 'BOARD_MEMBER',
    tier: 0,
    name: 'Board Member',
    nameAr: 'عضو مجلس الإدارة',
    description: 'Board-level oversight with view access across all domains and hospitals',
    descriptionAr: 'إشراف على مستوى مجلس الإدارة مع صلاحية عرض جميع المجالات والمستشفيات',
    domains: 'ALL',
    hospitalScope: 'ALL',
    permissions: ['VIEW'],
    reportsTo: null,
    canOverride: false,
    canEscalate: false,
    dashboardView: 'EXECUTIVE',
    visibleModules: [
      'dashboard',
      'reports',
      'analytics',
      'budgets',
    ],
  },

  CEO: {
    role: 'CEO',
    tier: 0,
    name: 'Chief Executive Officer',
    nameAr: 'الرئيس التنفيذي',
    description: 'Top-level executive authority over all supply domains and hospitals with full override capability',
    descriptionAr: 'السلطة التنفيذية العليا على جميع مجالات التوريد والمستشفيات مع صلاحية التجاوز الكاملة',
    domains: 'ALL',
    hospitalScope: 'ALL',
    permissions: ['VIEW', 'REQUEST', 'APPROVE', 'EXECUTE', 'OVERRIDE', 'CONFIGURE'],
    reportsTo: 'BOARD_MEMBER',
    canOverride: true,
    canEscalate: true,
    dashboardView: 'EXECUTIVE',
    visibleModules: [
      'dashboard',
      'requests',
      'approvals',
      'procurement',
      'inventory',
      'reports',
      'analytics',
      'settings',
      'users',
      'audit',
      'hospitals',
      'vendors',
      'contracts',
      'budgets',
    ],
  },

  // -----------------------------------------------------------------------
  // Tier 1 — C-Suite & Subsidiary CEOs
  // -----------------------------------------------------------------------

  CFO_GROUP: {
    role: 'CFO_GROUP',
    tier: 1,
    name: 'Group CFO',
    nameAr: 'المدير المالي للمجموعة',
    description: 'Financial oversight across all supply domains at the group level',
    descriptionAr: 'الإشراف المالي على جميع مجالات التوريد على مستوى المجموعة',
    domains: 'ALL',
    hospitalScope: 'ALL',
    permissions: ['VIEW', 'APPROVE'],
    reportsTo: 'CEO',
    canOverride: false,
    canEscalate: true,
    dashboardView: 'EXECUTIVE',
    visibleModules: [
      'dashboard',
      'approvals',
      'reports',
      'analytics',
      'budgets',
      'contracts',
    ],
  },

  COO_GROUP: {
    role: 'COO_GROUP',
    tier: 1,
    name: 'Group COO',
    nameAr: 'مدير العمليات للمجموعة',
    description: 'Operational authority across all supply domains with override capability',
    descriptionAr: 'السلطة التشغيلية على جميع مجالات التوريد مع صلاحية التجاوز',
    domains: 'ALL',
    hospitalScope: 'ALL',
    permissions: ['VIEW', 'APPROVE', 'EXECUTE', 'OVERRIDE'],
    reportsTo: 'CEO',
    canOverride: true,
    canEscalate: true,
    dashboardView: 'EXECUTIVE',
    visibleModules: [
      'dashboard',
      'requests',
      'approvals',
      'procurement',
      'inventory',
      'reports',
      'analytics',
      'hospitals',
      'vendors',
      'contracts',
    ],
  },

  CMO_GROUP: {
    role: 'CMO_GROUP',
    tier: 1,
    name: 'Group CMO',
    nameAr: 'المدير الطبي للمجموعة',
    description: 'Medical authority over medical devices, consumables, and dental supplies',
    descriptionAr: 'السلطة الطبية على الأجهزة والمستهلكات الطبية ومستلزمات طب الأسنان',
    domains: ['MEDICAL_DEVICES', 'MEDICAL_CONSUMABLES', 'DENTAL'],
    hospitalScope: 'ALL',
    permissions: ['VIEW', 'APPROVE'],
    reportsTo: 'CEO',
    canOverride: false,
    canEscalate: true,
    dashboardView: 'EXECUTIVE',
    visibleModules: [
      'dashboard',
      'approvals',
      'reports',
      'analytics',
      'hospitals',
      'vendors',
    ],
  },

  THEA_SOLUTIONS_CEO: {
    role: 'THEA_SOLUTIONS_CEO',
    tier: 1,
    name: 'Thea Solutions CEO',
    nameAr: 'الرئيس التنفيذي لثيا للحلول',
    description: 'Full authority over IT systems and office equipment for Thea Solutions subsidiary',
    descriptionAr: 'السلطة الكاملة على أنظمة تقنية المعلومات والمعدات المكتبية لشركة ثيا للحلول',
    domains: ['IT_SYSTEMS', 'OFFICE_EQUIPMENT'],
    hospitalScope: 'ALL',
    permissions: ['VIEW', 'REQUEST', 'APPROVE', 'EXECUTE', 'OVERRIDE', 'CONFIGURE'],
    reportsTo: 'CEO',
    canOverride: true,
    canEscalate: true,
    dashboardView: 'EXECUTIVE',
    visibleModules: [
      'dashboard',
      'requests',
      'approvals',
      'procurement',
      'inventory',
      'reports',
      'analytics',
      'vendors',
      'contracts',
    ],
    subsidiary: 'THEA_SOLUTIONS',
  },

  THEA_MEDICAL_CEO: {
    role: 'THEA_MEDICAL_CEO',
    tier: 1,
    name: 'Thea Medical CEO',
    nameAr: 'الرئيس التنفيذي لثيا الطبية',
    description: 'Full authority over medical devices for Thea Medical subsidiary',
    descriptionAr: 'السلطة الكاملة على الأجهزة الطبية لشركة ثيا الطبية',
    domains: ['MEDICAL_DEVICES'],
    hospitalScope: 'ALL',
    permissions: ['VIEW', 'REQUEST', 'APPROVE', 'EXECUTE', 'OVERRIDE', 'CONFIGURE'],
    reportsTo: 'CEO',
    canOverride: true,
    canEscalate: true,
    dashboardView: 'EXECUTIVE',
    visibleModules: [
      'dashboard',
      'requests',
      'approvals',
      'procurement',
      'inventory',
      'reports',
      'analytics',
      'vendors',
      'contracts',
    ],
    subsidiary: 'THEA_MEDICAL',
  },

  THEA_LAB_CEO: {
    role: 'THEA_LAB_CEO',
    tier: 1,
    name: 'Thea Lab CEO',
    nameAr: 'الرئيس التنفيذي لثيا للمختبرات',
    description: 'Full authority over lab consumables for Thea Lab subsidiary',
    descriptionAr: 'السلطة الكاملة على مستهلكات المختبرات لشركة ثيا للمختبرات',
    domains: ['MEDICAL_CONSUMABLES'],
    hospitalScope: 'ALL',
    permissions: ['VIEW', 'REQUEST', 'APPROVE', 'EXECUTE', 'OVERRIDE', 'CONFIGURE'],
    reportsTo: 'CEO',
    canOverride: true,
    canEscalate: true,
    dashboardView: 'EXECUTIVE',
    visibleModules: [
      'dashboard',
      'requests',
      'approvals',
      'procurement',
      'inventory',
      'reports',
      'analytics',
      'vendors',
      'contracts',
    ],
    subsidiary: 'THEA_LAB',
  },

  THEA_PHARMACY_CEO: {
    role: 'THEA_PHARMACY_CEO',
    tier: 1,
    name: 'Thea Pharmacy CEO',
    nameAr: 'الرئيس التنفيذي لثيا للصيدلة',
    description: 'Full authority over pharmacy supplies for Thea Pharmacy subsidiary',
    descriptionAr: 'السلطة الكاملة على مستلزمات الصيدلة لشركة ثيا للصيدلة',
    domains: ['MEDICAL_CONSUMABLES'],
    hospitalScope: 'ALL',
    permissions: ['VIEW', 'REQUEST', 'APPROVE', 'EXECUTE', 'OVERRIDE', 'CONFIGURE'],
    reportsTo: 'CEO',
    canOverride: true,
    canEscalate: true,
    dashboardView: 'EXECUTIVE',
    visibleModules: [
      'dashboard',
      'requests',
      'approvals',
      'procurement',
      'inventory',
      'reports',
      'analytics',
      'vendors',
      'contracts',
    ],
    subsidiary: 'THEA_PHARMACY',
  },

  DAHNAA_DENTAL_CEO: {
    role: 'DAHNAA_DENTAL_CEO',
    tier: 1,
    name: 'Dahnaa Dental CEO',
    nameAr: 'الرئيس التنفيذي لدهناء لطب الأسنان',
    description: 'Full authority over dental supplies for Dahnaa Dental subsidiary',
    descriptionAr: 'السلطة الكاملة على مستلزمات طب الأسنان لشركة دهناء لطب الأسنان',
    domains: ['DENTAL'],
    hospitalScope: 'ALL',
    permissions: ['VIEW', 'REQUEST', 'APPROVE', 'EXECUTE', 'OVERRIDE', 'CONFIGURE'],
    reportsTo: 'CEO',
    canOverride: true,
    canEscalate: true,
    dashboardView: 'EXECUTIVE',
    visibleModules: [
      'dashboard',
      'requests',
      'approvals',
      'procurement',
      'inventory',
      'reports',
      'analytics',
      'vendors',
      'contracts',
    ],
    subsidiary: 'DAHNAA_DENTAL',
  },

  // -----------------------------------------------------------------------
  // Existing Tier 1 roles (legacy hospital-level directors)
  VP_SUPPLY_CHAIN: {
    role: 'VP_SUPPLY_CHAIN' as ImdadRole,
    tier: 1,
    name: 'VP Supply Chain',
    nameAr: 'نائب الرئيس لسلسلة الإمداد',
    description: 'Oversees all supply chain domains across the group',
    descriptionAr: 'يشرف على جميع مجالات سلسلة الإمداد عبر المجموعة',
    domains: 'ALL' as const,
    hospitalScope: 'ALL' as const,
    permissions: ['VIEW', 'REQUEST', 'APPROVE', 'EXECUTE'] as PermissionAction[],
    reportsTo: 'CEO' as ImdadRole,
    canOverride: false,
    canEscalate: true,
    dashboardView: 'EXECUTIVE' as const,
    visibleModules: [
      'dashboard', 'command-center', 'war-room', 'decisions', 'inventory',
      'procurement', 'assets', 'quality', 'warehouse', 'budget-governance',
      'financial', 'analytics',
    ],
  },

  // -----------------------------------------------------------------------

  GENERAL_DIRECTOR: {
    role: 'GENERAL_DIRECTOR',
    tier: 1,
    name: 'General Director',
    nameAr: 'المدير العام',
    description: 'Top-level authority over all supply domains and hospitals',
    descriptionAr: 'السلطة العليا على جميع مجالات التوريد والمستشفيات',
    domains: 'ALL',
    hospitalScope: 'ALL',
    permissions: ['VIEW', 'REQUEST', 'APPROVE', 'EXECUTE', 'OVERRIDE', 'CONFIGURE'],
    reportsTo: null,
    canOverride: true,
    canEscalate: true,
    dashboardView: 'EXECUTIVE',
    visibleModules: [
      'dashboard',
      'requests',
      'approvals',
      'procurement',
      'inventory',
      'reports',
      'analytics',
      'settings',
      'users',
      'audit',
      'hospitals',
      'vendors',
      'contracts',
      'budgets',
    ],
  },

  MEDICAL_DIRECTOR: {
    role: 'MEDICAL_DIRECTOR',
    tier: 1,
    name: 'Medical Director',
    nameAr: 'المدير الطبي',
    description: 'Authority over medical consumables, devices, and dental supplies',
    descriptionAr: 'السلطة على المستهلكات الطبية والأجهزة والمستلزمات السنية',
    domains: ['MEDICAL_CONSUMABLES', 'MEDICAL_DEVICES', 'DENTAL'],
    hospitalScope: 'ALL',
    permissions: ['VIEW', 'REQUEST', 'APPROVE', 'EXECUTE'],
    reportsTo: 'GENERAL_DIRECTOR',
    canOverride: false,
    canEscalate: true,
    dashboardView: 'EXECUTIVE',
    visibleModules: [
      'dashboard',
      'requests',
      'approvals',
      'inventory',
      'reports',
      'analytics',
      'hospitals',
      'vendors',
    ],
  },

  EXECUTIVE_DIRECTOR: {
    role: 'EXECUTIVE_DIRECTOR',
    tier: 1,
    name: 'Executive Director',
    nameAr: 'المدير التنفيذي',
    description: 'Authority over non-medical supplies, furniture, office equipment, and IT',
    descriptionAr: 'السلطة على المستلزمات غير الطبية والأثاث والمعدات المكتبية وتقنية المعلومات',
    domains: [
      'NON_MEDICAL_CONSUMABLES',
      'NON_MEDICAL_DEVICES',
      'FURNITURE',
      'OFFICE_EQUIPMENT',
      'IT_SYSTEMS',
    ],
    hospitalScope: 'ALL',
    permissions: ['VIEW', 'REQUEST', 'APPROVE', 'EXECUTE'],
    reportsTo: 'GENERAL_DIRECTOR',
    canOverride: false,
    canEscalate: true,
    dashboardView: 'EXECUTIVE',
    visibleModules: [
      'dashboard',
      'requests',
      'approvals',
      'inventory',
      'reports',
      'analytics',
      'hospitals',
      'vendors',
    ],
  },

  NURSING_DIRECTOR: {
    role: 'NURSING_DIRECTOR',
    tier: 1,
    name: 'Nursing Director',
    nameAr: 'مدير التمريض',
    description: 'Authority over medical consumables and devices for nursing operations',
    descriptionAr: 'السلطة على المستهلكات والأجهزة الطبية لعمليات التمريض',
    domains: ['MEDICAL_CONSUMABLES', 'MEDICAL_DEVICES'],
    hospitalScope: 'ALL',
    permissions: ['VIEW', 'REQUEST', 'APPROVE'],
    reportsTo: 'GENERAL_DIRECTOR',
    canOverride: false,
    canEscalate: true,
    dashboardView: 'EXECUTIVE',
    visibleModules: [
      'dashboard',
      'requests',
      'approvals',
      'inventory',
      'reports',
      'hospitals',
    ],
  },

  // -----------------------------------------------------------------------
  // Tier 2 — Operational directors & managers
  // -----------------------------------------------------------------------

  CFO: {
    role: 'CFO',
    tier: 2,
    name: 'Chief Financial Officer',
    nameAr: 'المدير المالي',
    description: 'Financial oversight across all supply domains',
    descriptionAr: 'الإشراف المالي على جميع مجالات التوريد',
    domains: 'ALL',
    hospitalScope: 'ALL',
    permissions: ['VIEW', 'APPROVE'],
    reportsTo: 'GENERAL_DIRECTOR',
    canOverride: false,
    canEscalate: true,
    dashboardView: 'EXECUTIVE',
    visibleModules: [
      'dashboard',
      'approvals',
      'reports',
      'analytics',
      'budgets',
      'contracts',
    ],
  },

  IT_DIRECTOR: {
    role: 'IT_DIRECTOR',
    tier: 2,
    name: 'IT Director',
    nameAr: 'مدير تقنية المعلومات',
    description: 'Authority over IT systems and office equipment',
    descriptionAr: 'السلطة على أنظمة تقنية المعلومات والمعدات المكتبية',
    domains: ['IT_SYSTEMS', 'OFFICE_EQUIPMENT'],
    hospitalScope: 'ALL',
    permissions: ['VIEW', 'REQUEST', 'APPROVE', 'EXECUTE'],
    reportsTo: 'EXECUTIVE_DIRECTOR',
    canOverride: false,
    canEscalate: true,
    dashboardView: 'OPERATIONAL',
    visibleModules: [
      'dashboard',
      'requests',
      'approvals',
      'inventory',
      'reports',
      'vendors',
    ],
  },

  DENTAL_DIRECTOR: {
    role: 'DENTAL_DIRECTOR',
    tier: 2,
    name: 'Dental Director',
    nameAr: 'مدير طب الأسنان',
    description: 'Authority over dental supplies and equipment',
    descriptionAr: 'السلطة على مستلزمات ومعدات طب الأسنان',
    domains: ['DENTAL'],
    hospitalScope: 'ALL',
    permissions: ['VIEW', 'REQUEST', 'APPROVE', 'EXECUTE'],
    reportsTo: 'MEDICAL_DIRECTOR',
    canOverride: false,
    canEscalate: true,
    dashboardView: 'OPERATIONAL',
    visibleModules: [
      'dashboard',
      'requests',
      'approvals',
      'inventory',
      'reports',
      'vendors',
    ],
  },

  SUPPLY_CHAIN_MANAGER: {
    role: 'SUPPLY_CHAIN_MANAGER',
    tier: 2,
    name: 'Supply Chain Manager',
    nameAr: 'مدير سلسلة الإمداد',
    description: 'Operational management across all supply domains',
    descriptionAr: 'الإدارة التشغيلية لجميع مجالات التوريد',
    domains: 'ALL',
    hospitalScope: 'ALL',
    permissions: ['VIEW', 'REQUEST', 'APPROVE', 'EXECUTE'],
    reportsTo: 'EXECUTIVE_DIRECTOR',
    canOverride: false,
    canEscalate: true,
    dashboardView: 'OPERATIONAL',
    visibleModules: [
      'dashboard',
      'requests',
      'approvals',
      'procurement',
      'inventory',
      'reports',
      'analytics',
      'vendors',
      'contracts',
    ],
  },

  // -----------------------------------------------------------------------
  // Tier 3 — Department-level roles
  // -----------------------------------------------------------------------

  HEAD_OF_DEPARTMENT: {
    role: 'HEAD_OF_DEPARTMENT',
    tier: 3,
    name: 'Head of Department',
    nameAr: 'رئيس القسم',
    description: 'Department-level authority over assigned supply domains',
    descriptionAr: 'سلطة على مستوى القسم على مجالات التوريد المعينة',
    domains: [], // Assigned at runtime via user profile
    hospitalScope: 'ASSIGNED',
    permissions: ['VIEW', 'REQUEST'],
    reportsTo: null, // Varies by department — resolved at runtime
    canOverride: false,
    canEscalate: true,
    dashboardView: 'DEPARTMENTAL',
    visibleModules: [
      'dashboard',
      'requests',
      'inventory',
      'reports',
    ],
  },

  SUPERVISOR: {
    role: 'SUPERVISOR',
    tier: 3,
    name: 'Supervisor',
    nameAr: 'مشرف',
    description: 'Supervisory role within a department at an assigned hospital',
    descriptionAr: 'دور إشرافي داخل قسم في مستشفى معين',
    domains: [], // Assigned at runtime via user profile
    hospitalScope: 'ASSIGNED',
    permissions: ['VIEW', 'REQUEST'],
    reportsTo: 'HEAD_OF_DEPARTMENT',
    canOverride: false,
    canEscalate: true,
    dashboardView: 'DEPARTMENTAL',
    visibleModules: [
      'dashboard',
      'requests',
      'inventory',
    ],
  },

  HEAD_NURSE: {
    role: 'HEAD_NURSE',
    tier: 3,
    name: 'Head Nurse',
    nameAr: 'رئيسة التمريض',
    description: 'Nursing lead at an assigned hospital with medical supply access',
    descriptionAr: 'قائدة التمريض في مستشفى معين مع صلاحية الوصول للمستلزمات الطبية',
    domains: ['MEDICAL_CONSUMABLES', 'MEDICAL_DEVICES'],
    hospitalScope: 'ASSIGNED',
    permissions: ['VIEW', 'REQUEST'],
    reportsTo: 'NURSING_DIRECTOR',
    canOverride: false,
    canEscalate: true,
    dashboardView: 'DEPARTMENTAL',
    visibleModules: [
      'dashboard',
      'requests',
      'inventory',
      'reports',
    ],
  },
};

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

const ALL_DOMAINS: SupplyDomain[] = [
  'MEDICAL_CONSUMABLES',
  'MEDICAL_DEVICES',
  'NON_MEDICAL_CONSUMABLES',
  'NON_MEDICAL_DEVICES',
  'FURNITURE',
  'OFFICE_EQUIPMENT',
  'IT_SYSTEMS',
  'DENTAL',
];

/**
 * Returns the concrete list of domains for a role definition,
 * expanding 'ALL' into the full domain list.
 */
function resolvedDomains(def: RoleDefinition): SupplyDomain[] {
  return def.domains === 'ALL' ? ALL_DOMAINS : def.domains;
}

/**
 * Check whether a role has access to a given supply domain.
 *
 * For Tier-3 roles with empty domain arrays (HEAD_OF_DEPARTMENT, SUPERVISOR),
 * domain access is determined at runtime by the user's `assignedDomains`.
 * This function returns `false` for those roles — the caller should check
 * the user profile separately.
 */
export function canAccess(role: ImdadRole, domain: SupplyDomain): boolean {
  const def = ROLE_DEFINITIONS[role];
  return resolvedDomains(def).includes(domain);
}

/**
 * Check whether a role definition includes a given permission action.
 */
export function canPerform(role: ImdadRole, action: PermissionAction): boolean {
  const def = ROLE_DEFINITIONS[role];
  return def.permissions.includes(action);
}

/**
 * Return the list of hospital IDs visible to a role.
 *
 * - Roles with `hospitalScope: 'ALL'` see every hospital.
 * - Roles with `hospitalScope: 'ASSIGNED'` see only their assigned hospital.
 */
export function getVisibleHospitals(
  role: ImdadRole,
  assignedHospitalId?: string,
  allHospitalIds?: string[],
): string[] {
  const def = ROLE_DEFINITIONS[role];

  if (def.hospitalScope === 'ALL') {
    return allHospitalIds ?? [];
  }

  // ASSIGNED scope — return the single assigned hospital (if provided)
  return assignedHospitalId ? [assignedHospitalId] : [];
}

/**
 * Return all roles that the given role has hierarchical authority over.
 *
 * Walks the `reportsTo` chain in reverse: any role whose `reportsTo`
 * (directly or transitively) equals the given role is considered subordinate.
 */
export function getRoleHierarchy(role: ImdadRole): ImdadRole[] {
  const subordinates: ImdadRole[] = [];

  // Build a map of role -> direct reports
  const directReportsMap = new Map<ImdadRole, ImdadRole[]>();
  for (const def of Object.values(ROLE_DEFINITIONS)) {
    if (def.reportsTo) {
      const existing = directReportsMap.get(def.reportsTo) ?? [];
      existing.push(def.role);
      directReportsMap.set(def.reportsTo, existing);
    }
  }

  // BFS to collect all transitive subordinates
  const queue: ImdadRole[] = directReportsMap.get(role) ?? [];
  const visited = new Set<ImdadRole>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    subordinates.push(current);

    const reports = directReportsMap.get(current) ?? [];
    for (const r of reports) {
      if (!visited.has(r)) queue.push(r);
    }
  }

  return subordinates;
}

// ---------------------------------------------------------------------------
// Governance utilities
// ---------------------------------------------------------------------------

/**
 * Returns the chain of roles that can approve actions in a given domain,
 * ordered from the most specific subsidiary CEO up to the CEO.
 *
 * Example:
 *   MEDICAL_DEVICES → [THEA_MEDICAL_CEO, CMO_GROUP, COO_GROUP, CEO]
 *   IT_SYSTEMS      → [THEA_SOLUTIONS_CEO, COO_GROUP, CEO]
 *   DENTAL          → [DAHNAA_DENTAL_CEO, CMO_GROUP, COO_GROUP, CEO]
 */
export function getApprovalAuthority(domain: SupplyDomain, _hospitalId: string): ImdadRole[] {
  const chain: ImdadRole[] = [];

  // 1. Find the subsidiary CEO that owns this domain
  const subsidiaryCeoRoles: ImdadRole[] = [
    'THEA_SOLUTIONS_CEO',
    'THEA_MEDICAL_CEO',
    'THEA_LAB_CEO',
    'THEA_PHARMACY_CEO',
    'DAHNAA_DENTAL_CEO',
  ];

  for (const ceoRole of subsidiaryCeoRoles) {
    const def = ROLE_DEFINITIONS[ceoRole];
    if (resolvedDomains(def).includes(domain)) {
      chain.push(ceoRole);
    }
  }

  // 2. Add relevant C-suite roles
  // CMO_GROUP covers medical/dental domains
  if (resolvedDomains(ROLE_DEFINITIONS.CMO_GROUP).includes(domain)) {
    chain.push('CMO_GROUP');
  }

  // COO_GROUP has operational authority over all domains
  chain.push('COO_GROUP');

  // 3. CEO is always the final authority
  chain.push('CEO');

  return chain;
}

/**
 * Returns which subsidiary owns a given supply domain.
 * Falls back to 'HOSPITAL' for domains not owned by a specific subsidiary.
 */
export function getDomainOwner(domain: SupplyDomain): Subsidiary {
  for (const [subsidiary, domains] of Object.entries(SUBSIDIARY_DOMAINS) as [Subsidiary, SupplyDomain[]][]) {
    if (subsidiary === 'HOSPITAL') continue; // check specific subsidiaries first
    if (domains.includes(domain)) {
      return subsidiary;
    }
  }
  return 'HOSPITAL';
}
