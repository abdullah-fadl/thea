/**
 * CVision Integration Hooks
 * Feature flags for SAM/Thea integration points.
 */

// Feature flag checks
export function isEmployeeSyncEnabled(): boolean {
  return process.env.CVISION_EMPLOYEE_SYNC === 'true';
}

export function isAuthFederationEnabled(): boolean {
  return process.env.CVISION_AUTH_FEDERATION === 'true';
}

export function isPayrollIntegrationEnabled(): boolean {
  return process.env.CVISION_PAYROLL_INTEGRATION === 'true';
}

export function isAttendanceDeviceSyncEnabled(): boolean {
  return process.env.CVISION_ATTENDANCE_DEVICE_SYNC === 'true';
}

export function isGovernmentApisEnabled(): boolean {
  return process.env.CVISION_GOVERNMENT_APIS === 'true';
}

// Integration status type
export interface IntegrationStatus {
  id: string;
  name: string;
  nameAr: string;
  enabled: boolean;
  status: 'active' | 'inactive' | 'error' | 'pending';
  lastSyncAt?: string;
  config?: Record<string, any>;
}

// Get all integration statuses
export function getIntegrationStatuses(): IntegrationStatus[] {
  return [
    {
      id: 'employee_sync',
      name: 'Employee Sync (Thea \u2194 CVision)',
      nameAr: '\u0645\u0632\u0627\u0645\u0646\u0629 \u0627\u0644\u0645\u0648\u0638\u0641\u064a\u0646 (\u062b\u064a\u0627 \u2194 CVision)',
      enabled: isEmployeeSyncEnabled(),
      status: isEmployeeSyncEnabled() ? 'active' : 'inactive',
    },
    {
      id: 'auth_federation',
      name: 'Auth Federation (SSO)',
      nameAr: '\u062a\u0648\u062d\u064a\u062f \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629 (SSO)',
      enabled: isAuthFederationEnabled(),
      status: isAuthFederationEnabled() ? 'active' : 'inactive',
    },
    {
      id: 'payroll_integration',
      name: 'Payroll System Integration',
      nameAr: '\u0631\u0628\u0637 \u0646\u0638\u0627\u0645 \u0627\u0644\u0631\u0648\u0627\u062a\u0628',
      enabled: isPayrollIntegrationEnabled(),
      status: isPayrollIntegrationEnabled() ? 'active' : 'inactive',
    },
    {
      id: 'attendance_device_sync',
      name: 'Attendance Device Sync (IoT)',
      nameAr: '\u0645\u0632\u0627\u0645\u0646\u0629 \u0623\u062c\u0647\u0632\u0629 \u0627\u0644\u062d\u0636\u0648\u0631',
      enabled: isAttendanceDeviceSyncEnabled(),
      status: isAttendanceDeviceSyncEnabled() ? 'active' : 'inactive',
    },
    {
      id: 'government_apis',
      name: 'Government APIs (QIWA, GOSI, Mudad)',
      nameAr: '\u0648\u0627\u062c\u0647\u0627\u062a \u0627\u0644\u062d\u0643\u0648\u0645\u0629 (\u0642\u0648\u0649\u060c \u0627\u0644\u062a\u0623\u0645\u064a\u0646\u0627\u062a\u060c \u0645\u062f\u062f)',
      enabled: isGovernmentApisEnabled(),
      status: isGovernmentApisEnabled() ? 'active' : 'inactive',
    },
  ];
}

// Webhook receiver types
export interface WebhookPayload {
  event: string;
  source: string;
  timestamp: string;
  data: Record<string, any>;
}

// Validate webhook payload
export function validateWebhookPayload(payload: any): { valid: boolean; error?: string } {
  if (!payload) return { valid: false, error: 'Empty payload' };
  if (!payload.event) return { valid: false, error: 'Missing event field' };
  if (!payload.source) return { valid: false, error: 'Missing source field' };
  if (!payload.data) return { valid: false, error: 'Missing data field' };
  return { valid: true };
}
