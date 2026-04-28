import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ─────────────────────────────────────────────────────────── */

export type IntegrationType = 'ACCOUNTING' | 'ERP' | 'COMMUNICATION' | 'CALENDAR' | 'STORAGE' | 'AUTH' | 'PAYMENT' | 'CUSTOM';
export type SyncFrequency = 'REALTIME' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MANUAL';
export type IntegrationStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR';

export const AVAILABLE_INTEGRATIONS = [
  { provider: 'SAP', type: 'ERP' as IntegrationType, features: ['GL_JOURNAL', 'COST_CENTER', 'PAYROLL_POSTING'], logo: '🏢' },
  { provider: 'ORACLE_FINANCIALS', type: 'ERP' as IntegrationType, features: ['GL_JOURNAL', 'AP', 'PAYROLL'], logo: '🔴' },
  { provider: 'QUICKBOOKS', type: 'ACCOUNTING' as IntegrationType, features: ['PAYROLL_JOURNAL', 'EXPENSE_SYNC'], logo: '📗' },
  { provider: 'XERO', type: 'ACCOUNTING' as IntegrationType, features: ['PAYROLL_JOURNAL', 'EXPENSE_SYNC'], logo: '🔵' },
  { provider: 'QOYOD', type: 'ACCOUNTING' as IntegrationType, features: ['PAYROLL_JOURNAL'], logo: '🇸🇦' },
  { provider: 'SLACK', type: 'COMMUNICATION' as IntegrationType, features: ['NOTIFICATIONS', 'LEAVE_REQUESTS', 'APPROVALS'], logo: '💬' },
  { provider: 'MICROSOFT_TEAMS', type: 'COMMUNICATION' as IntegrationType, features: ['NOTIFICATIONS', 'CALENDAR_SYNC'], logo: '🟣' },
  { provider: 'WHATSAPP_BUSINESS', type: 'COMMUNICATION' as IntegrationType, features: ['NOTIFICATIONS', 'ALERTS'], logo: '💚' },
  { provider: 'GOOGLE_CALENDAR', type: 'CALENDAR' as IntegrationType, features: ['EVENT_SYNC', 'LEAVE_SYNC', 'TRAINING_SYNC'], logo: '📅' },
  { provider: 'OUTLOOK_CALENDAR', type: 'CALENDAR' as IntegrationType, features: ['EVENT_SYNC', 'LEAVE_SYNC'], logo: '📆' },
  { provider: 'GOOGLE_DRIVE', type: 'STORAGE' as IntegrationType, features: ['DOCUMENT_BACKUP', 'LETTER_EXPORT'], logo: '📁' },
  { provider: 'SHAREPOINT', type: 'STORAGE' as IntegrationType, features: ['DOCUMENT_SYNC'], logo: '📂' },
  { provider: 'GOOGLE_SSO', type: 'AUTH' as IntegrationType, features: ['SSO_LOGIN'], logo: '🔐' },
  { provider: 'MICROSOFT_SSO', type: 'AUTH' as IntegrationType, features: ['SSO_LOGIN'], logo: '🔑' },
  { provider: 'LDAP', type: 'AUTH' as IntegrationType, features: ['DIRECTORY_SYNC', 'SSO'], logo: '🗂️' },
  { provider: 'SAML', type: 'AUTH' as IntegrationType, features: ['SSO_LOGIN'], logo: '🛡️' },
  { provider: 'UNIFONIC', type: 'COMMUNICATION' as IntegrationType, features: ['SMS_SEND'], logo: '📱' },
  { provider: 'YAMAMAH', type: 'COMMUNICATION' as IntegrationType, features: ['SMS_SEND'], logo: '📲' },
] as const;

export const TYPE_LABELS: Record<IntegrationType, string> = {
  ACCOUNTING: 'Accounting', ERP: 'ERP', COMMUNICATION: 'Communication',
  CALENDAR: 'Calendar', STORAGE: 'Storage', AUTH: 'Authentication',
  PAYMENT: 'Payment', CUSTOM: 'Custom',
};

/* ── Seed Data ─────────────────────────────────────────────────────── */

export async function ensureSeedData(db: Db, tenantId: string): Promise<void> {
  const coll = db.collection('cvision_integrations');
  const count = await coll.countDocuments({ tenantId });
  if (count > 0) return;

  const now = new Date();
  await coll.insertMany([
    {
      tenantId, name: 'Microsoft Teams', type: 'COMMUNICATION', provider: 'MICROSOFT_TEAMS',
      config: { apiUrl: 'https://graph.microsoft.com/v1.0', webhookUrl: '' },
      syncSettings: { enabled: true, frequency: 'REALTIME', direction: 'ONE_WAY', lastSyncAt: new Date(), lastSyncStatus: 'SUCCESS', mappings: [] },
      status: 'ACTIVE', createdAt: now, updatedAt: now,
    },
    {
      tenantId, name: 'QuickBooks Online', type: 'ACCOUNTING', provider: 'QUICKBOOKS',
      config: { apiUrl: 'https://quickbooks.api.intuit.com/v3' },
      syncSettings: { enabled: true, frequency: 'DAILY', direction: 'ONE_WAY', lastSyncAt: new Date(Date.now() - 86400000), lastSyncStatus: 'SUCCESS', mappings: [{ localField: 'payrollTotal', remoteField: 'journal.amount' }] },
      status: 'ACTIVE', createdAt: now, updatedAt: now,
    },
    {
      tenantId, name: 'Google Calendar', type: 'CALENDAR', provider: 'GOOGLE_CALENDAR',
      config: { apiUrl: 'https://www.googleapis.com/calendar/v3' },
      syncSettings: { enabled: false, frequency: 'HOURLY', direction: 'TWO_WAY', mappings: [] },
      status: 'INACTIVE', createdAt: now, updatedAt: now,
    },
  ]);

  const logColl = db.collection('cvision_integration_logs');
  await logColl.insertMany([
    { tenantId, provider: 'MICROSOFT_TEAMS', action: 'NOTIFICATION_SENT', status: 'SUCCESS', message: 'Sent leave approval to #hr-notifications', createdAt: new Date(Date.now() - 3600000) },
    { tenantId, provider: 'QUICKBOOKS', action: 'PAYROLL_JOURNAL', status: 'SUCCESS', message: 'Posted Feb 2026 payroll journal: 485,200 SAR', createdAt: new Date(Date.now() - 86400000) },
    { tenantId, provider: 'QUICKBOOKS', action: 'PAYROLL_JOURNAL', status: 'PARTIAL', message: 'Posted Jan 2026 — 2 cost center mappings missing', createdAt: new Date(Date.now() - 86400000 * 30) },
  ]);
}
