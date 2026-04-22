/**
 * CVision Integrations — Shared Types & Registry
 *
 * Type definitions for all Saudi government and banking integrations.
 * Follows the same tenant-scoped pattern as the rest of CVision.
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export type IntegrationStatus =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'SIMULATED'
  | 'ERROR'
  | 'PENDING';

export type IntegrationMode = 'LIVE' | 'SIMULATION' | 'FILE_EXPORT';

export interface IntegrationConfig {
  id: string;
  tenantId: string;
  name: string;
  provider: string;
  status: IntegrationStatus;
  mode: IntegrationMode;
  lastSync?: string;
  lastError?: string;
  apiUrl?: string;
  apiKey?: string;
  credentials?: Record<string, string>;
  settings: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface IntegrationLog {
  id: string;
  tenantId: string;
  integrationId: string;
  action: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  request?: any;
  response?: any;
  error?: string;
  duration?: number;
  createdAt: string;
}

export interface FileExport {
  filename: string;
  format: 'CSV' | 'SIF' | 'XML' | 'JSON' | 'XLSX';
  content: string;
  mimeType: string;
  recordCount: number;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Registry entry (static metadata, not persisted per-tenant)
// ---------------------------------------------------------------------------

export interface IntegrationRegistryEntry {
  id: string;
  name: string;
  provider: string;
  description: string;
  url: string;
  features: string[];
  mandatory: boolean;
  hasApi: boolean;
  defaultMode: IntegrationMode;
}

// ---------------------------------------------------------------------------
// Registry — all known Saudi government & banking integrations
// ---------------------------------------------------------------------------

export const INTEGRATIONS_REGISTRY: IntegrationRegistryEntry[] = [
  {
    id: 'qiwa',
    name: 'Qiwa',
    provider: 'MHRSD',
    description: 'Labor contracts, Saudization, work permits',
    url: 'qiwa.sa',
    features: ['contracts', 'nitaqat', 'work_permits', 'transfers'],
    mandatory: true,
    hasApi: true,
    defaultMode: 'SIMULATION',
  },
  {
    id: 'mudad',
    name: 'Mudad',
    provider: 'MHRSD',
    description: 'Wage Protection System (WPS), salary transfers',
    url: 'mudad.mlsd.gov.sa',
    features: ['wps', 'salary_transfer', 'compliance'],
    mandatory: true,
    hasApi: true,
    defaultMode: 'FILE_EXPORT',
  },
  {
    id: 'gosi',
    name: 'GOSI',
    provider: 'GOSI',
    description: 'Social insurance contributions',
    url: 'gosi.gov.sa',
    features: ['contributions', 'registration', 'certificates'],
    mandatory: true,
    hasApi: true,
    defaultMode: 'FILE_EXPORT',
  },
  {
    id: 'absher',
    name: 'Absher Business',
    provider: 'MOI',
    description: 'Visas, iqamas, employee permits',
    url: 'absher.sa',
    features: ['visas', 'iqama_renewal', 'exit_reentry', 'violations'],
    mandatory: true,
    hasApi: true,
    defaultMode: 'SIMULATION',
  },
  {
    id: 'muqeem',
    name: 'Muqeem',
    provider: 'MOI',
    description: 'Resident management, iqama services',
    url: 'muqeem.com.sa',
    features: ['iqama_renewal', 'exit_reentry', 'final_exit', 'reports'],
    mandatory: true,
    hasApi: true,
    defaultMode: 'SIMULATION',
  },
  {
    id: 'yaqeen',
    name: 'Yaqeen',
    provider: 'Elm',
    description: 'National ID & iqama identity verification',
    url: 'elm.sa',
    features: ['id_verification', 'iqama_verification', 'cr_verification'],
    mandatory: false,
    hasApi: true,
    defaultMode: 'SIMULATION',
  },
  {
    id: 'nafath',
    name: 'Nafath',
    provider: 'NIC',
    description: 'National Single Sign-On (SSO)',
    url: 'iam.gov.sa',
    features: ['sso', 'identity_auth', 'biometric'],
    mandatory: false,
    hasApi: true,
    defaultMode: 'SIMULATION',
  },
  {
    id: 'wathq',
    name: 'Wathq',
    provider: 'MOC',
    description: 'Commercial registration data verification',
    url: 'developer.wathq.sa',
    features: ['cr_lookup', 'financial_statements', 'trademarks'],
    mandatory: false,
    hasApi: true,
    defaultMode: 'SIMULATION',
  },
  {
    id: 'zatca',
    name: 'ZATCA Fatoora',
    provider: 'ZATCA',
    description: 'E-invoicing (Fatoora Phase 2)',
    url: 'zatca.gov.sa',
    features: ['e_invoicing', 'tax_reporting', 'vat'],
    mandatory: true,
    hasApi: true,
    defaultMode: 'SIMULATION',
  },
  {
    id: 'banks',
    name: 'Banking',
    provider: 'Banks',
    description: 'Salary file transfers (SIF), SADAD payments',
    url: '',
    features: ['salary_transfer', 'sif_export', 'sadad'],
    mandatory: true,
    hasApi: false,
    defaultMode: 'FILE_EXPORT',
  },
];

// ---------------------------------------------------------------------------
// Feature labels
// ---------------------------------------------------------------------------

export const FEATURE_LABELS: Record<string, string> = {
  contracts: 'Labor Contracts',
  nitaqat: 'Saudization (Nitaqat)',
  work_permits: 'Work Permits',
  transfers: 'Employee Transfers',
  wps: 'Wage Protection (WPS)',
  salary_transfer: 'Salary Transfer',
  compliance: 'Compliance Reports',
  contributions: 'Insurance Contributions',
  registration: 'Employee Registration',
  certificates: 'Certificates',
  visas: 'Visas',
  iqama_renewal: 'Iqama Renewal',
  exit_reentry: 'Exit/Re-entry',
  final_exit: 'Final Exit',
  violations: 'Violations',
  reports: 'Reports',
  id_verification: 'ID Verification',
  iqama_verification: 'Iqama Verification',
  cr_verification: 'CR Verification',
  sso: 'Single Sign-On',
  identity_auth: 'Identity Auth',
  biometric: 'Biometric',
  cr_lookup: 'CR Lookup',
  financial_statements: 'Financial Statements',
  trademarks: 'Trademarks',
  e_invoicing: 'E-Invoicing',
  tax_reporting: 'Tax Reporting',
  vat: 'VAT',
  sif_export: 'SIF Export',
  sadad: 'SADAD Payments',
};
