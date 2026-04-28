/**
 * CVision React Query key factory.
 * Provides structured, type-safe query keys for cache management.
 *
 * Usage:
 *   queryKey: cvisionKeys.employees.list({ search: 'john', status: 'active' })
 *   queryKey: cvisionKeys.employees.detail(employeeId)
 *   queryClient.invalidateQueries({ queryKey: cvisionKeys.employees.all })
 */

function createKeys<T extends string>(domain: T) {
  return {
    all: ['cvision', domain] as const,
    lists: () => ['cvision', domain, 'list'] as const,
    list: (filters?: Record<string, any>) => ['cvision', domain, 'list', filters ?? {}] as const,
    details: () => ['cvision', domain, 'detail'] as const,
    detail: (id: string) => ['cvision', domain, 'detail', id] as const,
  };
}

export const cvisionKeys = {
  // Core HR
  employees: createKeys('employees'),
  departments: createKeys('departments'),
  jobTitles: createKeys('job-titles'),
  positions: createKeys('positions'),
  units: createKeys('units'),
  grades: createKeys('grades'),
  contracts: createKeys('contracts'),
  branches: createKeys('branches'),

  // Organization
  org: {
    ...createKeys('org'),
    tree: () => ['cvision', 'org', 'tree'] as const,
    budgetedPositions: createKeys('budgeted-positions'),
  },

  // Leaves
  leaves: {
    ...createKeys('leaves'),
    balances: (employeeId: string) => ['cvision', 'leaves', 'balances', employeeId] as const,
  },

  // Attendance
  attendance: {
    ...createKeys('attendance'),
    biometric: createKeys('attendance-biometric'),
    summary: (filters?: Record<string, any>) => ['cvision', 'attendance', 'summary', filters ?? {}] as const,
  },

  // Payroll
  payroll: {
    profiles: createKeys('payroll-profiles'),
    runs: createKeys('payroll-runs'),
    payslips: createKeys('payroll-payslips'),
    loans: createKeys('payroll-loans'),
    advanced: createKeys('payroll-advanced'),
  },

  // Recruitment
  recruitment: {
    ...createKeys('recruitment'),
    requisitions: createKeys('requisitions'),
    candidates: createKeys('candidates'),
    interviews: createKeys('interviews'),
    cvInbox: createKeys('cv-inbox'),
    batches: createKeys('cv-batches'),
  },

  // Performance & Development
  performance: createKeys('performance'),
  training: createKeys('training'),
  okrs: createKeys('okrs'),
  succession: createKeys('succession'),

  // Time & Scheduling
  scheduling: createKeys('scheduling'),
  timesheets: createKeys('timesheets'),
  calendar: createKeys('calendar'),
  bookings: createKeys('bookings'),

  // Requests & Workflows
  requests: createKeys('requests'),
  workflows: createKeys('workflows'),

  // Admin & Settings
  admin: {
    settings: createKeys('admin-settings'),
    webhooks: createKeys('webhooks'),
    cron: createKeys('cron'),
    dataWarehouse: createKeys('data-warehouse'),
    systemAdmin: createKeys('system-admin'),
  },

  // Compliance & Policy
  compliance: createKeys('compliance'),
  companyPolicies: createKeys('company-policies'),
  disciplinary: createKeys('disciplinary'),
  investigations: {
    ...createKeys('investigations'),
    employees: () => ['cvision', 'investigations', 'employees'] as const,
  },
  grievances: createKeys('grievances'),
  safety: createKeys('safety'),

  // Analytics & Reports
  analytics: createKeys('analytics'),
  reports: createKeys('reports'),
  reportEngine: createKeys('report-engine'),
  dashboards: createKeys('dashboards'),
  dataQuality: createKeys('data-quality'),
  diagnostics: createKeys('diagnostics'),
  predictive: createKeys('predictive'),
  whatif: createKeys('whatif'),

  // Communications
  announcements: createKeys('announcements'),
  communications: createKeys('communications'),
  notifications: createKeys('notifications'),
  surveys: createKeys('surveys'),

  // Employee Services
  selfService: createKeys('self-service'),
  letters: createKeys('letters'),
  insurance: createKeys('insurance'),
  housing: createKeys('housing'),
  transport: createKeys('transport'),
  travel: createKeys('travel'),
  cafeteria: createKeys('cafeteria'),
  wellness: {
    ...createKeys('wellness'),
    challenges: () => ['cvision', 'wellness', 'challenges'] as const,
    moodTrends: () => ['cvision', 'wellness', 'mood-trends'] as const,
    leaderboard: () => ['cvision', 'wellness', 'leaderboard'] as const,
    resources: (filters?: Record<string, any>) => ['cvision', 'wellness', 'resources', filters ?? {}] as const,
    stats: () => ['cvision', 'wellness', 'stats'] as const,
    burnoutReport: () => ['cvision', 'wellness', 'burnout-report'] as const,
  },
  assets: createKeys('assets'),
  paycards: createKeys('paycards'),

  // Organization Development
  engagement: {
    ...createKeys('engagement'),
    suggestions: (filters?: Record<string, any>) => ['cvision', 'engagement', 'suggestions', filters ?? {}] as const,
    trending: () => ['cvision', 'engagement', 'trending'] as const,
    polls: (filters?: Record<string, any>) => ['cvision', 'engagement', 'polls', filters ?? {}] as const,
    stats: () => ['cvision', 'engagement', 'stats'] as const,
  },
  culture: createKeys('culture'),
  recognition: {
    ...createKeys('recognition'),
    feed: () => ['cvision', 'recognition', 'feed'] as const,
    leaderboard: () => ['cvision', 'recognition', 'leaderboard'] as const,
    pointsBalance: (employeeId: string) => ['cvision', 'recognition', 'points-balance', employeeId] as const,
    redemptionCatalog: () => ['cvision', 'recognition', 'redemption-catalog'] as const,
    analytics: () => ['cvision', 'recognition', 'analytics'] as const,
  },
  rewards: createKeys('rewards'),
  retention: {
    ...createKeys('retention'),
    risks: (filters?: Record<string, any>) => ['cvision', 'retention', 'risks', filters ?? {}] as const,
    stats: () => ['cvision', 'retention', 'stats'] as const,
  },
  compensation: createKeys('compensation'),
  promotions: {
    ...createKeys('promotions'),
    recommendations: () => ['cvision', 'promotions', 'recommendations'] as const,
    lookups: () => ['cvision', 'promotions', 'lookups'] as const,
    stats: () => ['cvision', 'promotions', 'stats'] as const,
  },

  // Strategic
  strategicAlignment: createKeys('strategic-alignment'),
  manpower: createKeys('manpower'),
  headcount: createKeys('headcount'),
  orgDesign: createKeys('org-design'),
  orgHealth: createKeys('org-health'),
  changeManagement: createKeys('change-management'),
  segments: createKeys('segments'),

  // AI
  ai: {
    skills: createKeys('ai-skills'),
    governance: createKeys('ai-governance'),
    matching: createKeys('ai-matching'),
  },

  // Other
  directory: createKeys('directory'),
  teams: createKeys('teams'),
  jobs: createKeys('jobs'),
  onboarding: createKeys('onboarding'),
  integrations: createKeys('integrations'),
  integrationsManager: createKeys('integrations-mgr'),
  auditLog: createKeys('audit-log'),
  recycleBin: createKeys('recycle-bin'),
  documents: createKeys('documents'),
  seed: createKeys('seed'),
  chat: createKeys('chat'),

  // Dashboard
  dashboard: {
    summary: () => ['cvision', 'dashboard', 'summary'] as const,
    manpower: () => ['cvision', 'dashboard', 'manpower'] as const,
  },

  // SaaS
  saas: {
    tenant: () => ['cvision', 'saas', 'tenant'] as const,
  },
} as const;
