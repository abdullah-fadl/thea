import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ─────────────────────────────────────────────────────────── */

export type NotificationType = 'ALERT' | 'REMINDER' | 'APPROVAL' | 'INFO' | 'WARNING' | 'URGENT';
export type NotificationCategory = 'LEAVE' | 'ATTENDANCE' | 'PAYROLL' | 'INSURANCE' | 'IQAMA' | 'CONTRACT' | 'TRAINING' | 'PERFORMANCE' | 'LOAN' | 'APPROVAL' | 'BIRTHDAY' | 'ANNIVERSARY' | 'POLICY' | 'SYSTEM';
export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export const TYPE_LABELS: Record<NotificationType, string> = {
  ALERT: 'Alert', REMINDER: 'Reminder', APPROVAL: 'Approval Required',
  INFO: 'Information', WARNING: 'Warning', URGENT: 'Urgent',
};

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  LEAVE: 'Leave', ATTENDANCE: 'Attendance', PAYROLL: 'Payroll', INSURANCE: 'Insurance',
  IQAMA: 'Iqama/Visa', CONTRACT: 'Contract', TRAINING: 'Training', PERFORMANCE: 'Performance',
  LOAN: 'Loan', APPROVAL: 'Approval', BIRTHDAY: 'Birthday', ANNIVERSARY: 'Anniversary',
  POLICY: 'Policy', SYSTEM: 'System',
};

export const AUTO_ALERTS = [
  { trigger: 'IQAMA_EXPIRY_90_DAYS', priority: 'MEDIUM' as NotificationPriority, channels: ['inApp', 'email'] },
  { trigger: 'IQAMA_EXPIRY_30_DAYS', priority: 'HIGH' as NotificationPriority, channels: ['inApp', 'email', 'sms'] },
  { trigger: 'IQAMA_EXPIRY_7_DAYS', priority: 'URGENT' as NotificationPriority, channels: ['inApp', 'email', 'sms', 'whatsapp'] },
  { trigger: 'CONTRACT_EXPIRY_60_DAYS', priority: 'MEDIUM' as NotificationPriority, channels: ['inApp', 'email'] },
  { trigger: 'CONTRACT_EXPIRY_14_DAYS', priority: 'HIGH' as NotificationPriority, channels: ['inApp', 'email', 'sms'] },
  { trigger: 'INSURANCE_EXPIRY_30_DAYS', priority: 'HIGH' as NotificationPriority, channels: ['inApp', 'email'] },
  { trigger: 'PROBATION_ENDING_14_DAYS', priority: 'MEDIUM' as NotificationPriority, channels: ['inApp', 'email'] },
  { trigger: 'TRAINING_CERT_EXPIRY_30_DAYS', priority: 'MEDIUM' as NotificationPriority, channels: ['inApp', 'email'] },
  { trigger: 'BIRTHDAY_TODAY', priority: 'LOW' as NotificationPriority, channels: ['inApp'] },
  { trigger: 'WORK_ANNIVERSARY', priority: 'LOW' as NotificationPriority, channels: ['inApp'] },
  { trigger: 'LEAVE_BALANCE_LOW', priority: 'MEDIUM' as NotificationPriority, channels: ['inApp'] },
  { trigger: 'PENDING_APPROVAL_24H', priority: 'MEDIUM' as NotificationPriority, channels: ['inApp', 'email'] },
  { trigger: 'LOAN_OVERDUE', priority: 'HIGH' as NotificationPriority, channels: ['inApp', 'email', 'sms'] },
  { trigger: 'PAYSLIP_READY', priority: 'LOW' as NotificationPriority, channels: ['inApp', 'email'] },
];

/* ── Seed Data ─────────────────────────────────────────────────────── */

export async function ensureSeedData(db: Db, tenantId: string): Promise<void> {
  const coll = db.collection('cvision_notification_center');
  const count = await coll.countDocuments({ tenantId });
  if (count > 0) return;

  const now = new Date();
  const day = (d: number) => { const dt = new Date(now); dt.setDate(dt.getDate() - d); return dt; };

  const seeds = [
    { notificationId: 'NTF-001', recipientId: 'EMP-001', recipientType: 'INDIVIDUAL', title: 'Leave Request Approved', message: 'Your annual leave request (5 days) has been approved by Fahad Al-Qahtani.', type: 'INFO', category: 'LEAVE', priority: 'LOW', actionUrl: '/cvision/leaves', actionLabel: 'View Leave', read: true, readAt: day(1), dismissed: false, createdAt: day(2) },
    { notificationId: 'NTF-002', recipientId: 'EMP-001', recipientType: 'INDIVIDUAL', title: 'Payslip Ready', message: 'Your payslip for February 2026 is now available for download.', type: 'INFO', category: 'PAYROLL', priority: 'LOW', actionUrl: '/cvision/payroll', actionLabel: 'View Payslip', read: false, dismissed: false, createdAt: day(1) },
    { notificationId: 'NTF-003', recipientId: 'EMP-001', recipientType: 'INDIVIDUAL', title: 'Training Reminder', message: 'Your mandatory safety training session is scheduled for March 5, 2026.', type: 'REMINDER', category: 'TRAINING', priority: 'MEDIUM', actionUrl: '/cvision/training', actionLabel: 'View Training', read: false, dismissed: false, createdAt: day(0) },
    { notificationId: 'NTF-004', recipientId: 'EMP-001', recipientType: 'INDIVIDUAL', title: 'Pending Approval', message: 'You have 2 pending leave requests awaiting your approval.', type: 'APPROVAL', category: 'APPROVAL', priority: 'HIGH', actionUrl: '/cvision/requests', actionLabel: 'Review', read: false, dismissed: false, createdAt: day(0) },
    { notificationId: 'NTF-005', recipientId: 'EMP-002', recipientType: 'INDIVIDUAL', title: 'Contract Renewal', message: 'Your employment contract expires in 60 days. HR will contact you regarding renewal.', type: 'ALERT', category: 'CONTRACT', priority: 'MEDIUM', actionUrl: '/cvision/contracts', actionLabel: 'View Contract', read: false, dismissed: false, createdAt: day(3) },
    { notificationId: 'NTF-006', recipientId: 'EMP-003', recipientType: 'INDIVIDUAL', title: 'New Company Policy', message: 'A new Remote Work Policy (POL-006) has been published. Please review and acknowledge.', type: 'INFO', category: 'POLICY', priority: 'MEDIUM', actionUrl: '/cvision/company-policies', actionLabel: 'Review Policy', read: false, dismissed: false, createdAt: day(1) },
    { notificationId: 'NTF-007', recipientId: 'EMP-005', recipientType: 'INDIVIDUAL', title: 'Loan Payment Due', message: 'Your next loan installment of 1,500 SAR is due on March 1, 2026.', type: 'REMINDER', category: 'LOAN', priority: 'HIGH', actionUrl: '/cvision/payroll/loans', actionLabel: 'View Loan', read: false, dismissed: false, createdAt: day(0) },
    { notificationId: 'NTF-008', recipientId: 'EMP-006', recipientType: 'INDIVIDUAL', title: 'Happy Work Anniversary!', message: 'Congratulations on completing 5 years with the company! 🎉', type: 'INFO', category: 'ANNIVERSARY', priority: 'LOW', read: true, readAt: day(0), dismissed: false, createdAt: day(0) },
  ];

  await coll.insertMany(seeds.map(s => ({
    ...s, tenantId,
    channels: { inApp: true, email: true, sms: false, whatsapp: false, push: false },
    deliveryStatus: { inApp: s.read ? 'READ' : 'SENT' },
    sourceSystem: 'SEED',
    updatedAt: now,
  })));
}

export async function createNotification(db: Db, tenantId: string, data: {
  recipientId: string; title: string; message: string;
  type: NotificationType; category: NotificationCategory; priority: NotificationPriority;
  actionUrl?: string; actionLabel?: string; sourceSystem?: string; sourceId?: string;
}): Promise<string> {
  const count = await db.collection('cvision_notification_center').countDocuments({ tenantId });
  const notificationId = `NTF-${String(count + 1).padStart(4, '0')}`;
  const now = new Date();

  await db.collection('cvision_notification_center').insertOne({
    ...data, tenantId, notificationId,
    recipientType: 'INDIVIDUAL',
    channels: { inApp: true, email: data.priority !== 'LOW', sms: data.priority === 'URGENT', whatsapp: false, push: false },
    deliveryStatus: { inApp: 'SENT' },
    read: false, dismissed: false,
    sourceSystem: data.sourceSystem || 'SYSTEM',
    createdAt: now, updatedAt: now,
  });

  return notificationId;
}
