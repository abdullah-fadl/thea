import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Event Handlers — wires events to cross-system actions:
 * notifications, emails, SMS, webhooks, status updates, etc.
 */

import { registerHandler, type EventPayload } from './dispatcher';
import { getCVisionDb } from '@/lib/cvision/db';
import { v4 as uuid } from 'uuid';

// ─── Helper: send in-app notification ───────────────────────────

async function sendNotification(tenantId: string, recipientId: string, type: string, title: string, body?: string, link?: string) {
  try {
    const db = await getCVisionDb(tenantId);
    await db.collection('cvision_notifications').insertOne({
      tenantId, notificationId: uuid(), recipientId, type, title, body: body || '',
      link: link || '', read: false, readAt: null, createdAt: new Date(),
    });
  } catch (e) { logger.error('[Notification] Failed:', e); }
}

// ─── Helper: notify all users with a role ───────────────────────

async function notifyRole(tenantId: string, role: string, title: string, body: string) {
  try {
    const db = await getCVisionDb(tenantId);
    const users = await db.collection('cvision_employees').find({ tenantId, status: { $in: ['ACTIVE', 'active'] }, 'roles': role, deletedAt: null }).project({ id: 1, employeeId: 1 }).toArray();
    for (const u of users) {
      await sendNotification(tenantId, (u as Record<string, unknown>).id as string || (u as Record<string, unknown>).employeeId as string, 'SYSTEM', title, body);
    }
  } catch (e) { logger.error('[NotifyRole] Failed:', e); }
}

// ─── Helper: send SMS if provider is configured ─────────────────

async function sendSMSIfEnabled(tenantId: string, phone: string | undefined, message: string) {
  if (!phone) return;
  try {
    const { sendSMS } = await import('@/lib/cvision/sms/sender');
    await sendSMS(tenantId, phone, message);
  } catch (e) { logger.error('[SMS] Failed:', e); }
}

// ─── Helper: queue a template email ─────────────────────────────

async function sendTemplateEmail(tenantId: string, email: string | undefined, templateKey: string, variables: Record<string, string>) {
  if (!email) return;
  try {
    const { renderTemplate } = await import('@/lib/cvision/email/renderer');
    const { queueEmail } = await import('@/lib/cvision/email/queue');
    const rendered = await renderTemplate(tenantId, templateKey, variables);
    await queueEmail(tenantId, { to: email, subject: rendered.subject, html: rendered.html });
  } catch (e) { logger.error('[Email] Failed:', e); }
}

// ─── Helper: dispatch webhook ───────────────────────────────────

async function dispatchWebhookEvent(tenantId: string, eventName: string, data: any) {
  try {
    const { dispatchWebhook } = await import('@/lib/cvision/webhook');
    await dispatchWebhook(tenantId, eventName, data);
  } catch (e) { logger.error('[Webhook] Failed:', e); }
}

// ─── Helper: update resource status (workflow integration) ──────

async function updateResourceStatus(tenantId: string, resourceType: string, resourceId: string, status: string) {
  try {
    const db = await getCVisionDb(tenantId);
    const collectionMap: Record<string, string> = {
      leave: 'cvision_leaves', loan: 'cvision_loans', travel: 'cvision_travel_requests',
      letter: 'cvision_letters', training: 'cvision_training_enrollments',
    };
    const col = collectionMap[resourceType];
    if (!col) return;
    const idField = `${resourceType}Id`;
    await db.collection(col).updateOne({ tenantId, [idField]: resourceId }, { $set: { status, updatedAt: new Date() } });
  } catch (e) { logger.error('[StatusUpdate] Failed:', e); }
}

// ═══ Register all handlers ══════════════════════════════════════

export function initializeEventHandlers() {
  // ─── Employee lifecycle ──────────
  registerHandler('employee.created', async (p: EventPayload) => {
    await sendNotification(p.tenantId, p.resourceId, 'SYSTEM', 'مرحباً بك في الشركة! 🎉', 'تم إنشاء حسابك بنجاح', '/cvision/self-service');
    await dispatchWebhookEvent(p.tenantId, 'employee.created', p.data);
  });

  registerHandler('employee.resigned', async (p: EventPayload) => {
    await notifyRole(p.tenantId, 'hr-admin', 'استقالة موظف', `الموظف ${p.data.name || p.resourceId} قدم استقالته`);
    await dispatchWebhookEvent(p.tenantId, 'employee.resigned', p.data);
  });

  registerHandler('employee.terminated', async (p: EventPayload) => {
    await notifyRole(p.tenantId, 'hr-admin', 'إنهاء خدمات', `تم إنهاء خدمات الموظف ${p.data.name || p.resourceId}`);
    await dispatchWebhookEvent(p.tenantId, 'employee.terminated', p.data);
  });

  // ─── Leave lifecycle ─────────────
  registerHandler('leave.requested', async (p: EventPayload) => {
    if (p.data.managerId) {
      await sendNotification(p.tenantId, p.data.managerId, 'APPROVAL_PENDING', `طلب إجازة من ${p.data.employeeName || 'موظف'}`, undefined, '/cvision/requests');
    }
  });

  registerHandler('leave.approved', async (p: EventPayload) => {
    await sendNotification(p.tenantId, p.data.employeeId, 'APPROVAL_RESULT', 'تمت الموافقة على إجازتك ✅');
    await sendSMSIfEnabled(p.tenantId, p.data.employeePhone, `تمت الموافقة على إجازتك من ${p.data.startDate} إلى ${p.data.endDate}`);
    await sendTemplateEmail(p.tenantId, p.data.employeeEmail, 'leave_approved', p.data);
    await dispatchWebhookEvent(p.tenantId, 'leave.approved', p.data);
  });

  registerHandler('leave.rejected', async (p: EventPayload) => {
    await sendNotification(p.tenantId, p.data.employeeId, 'APPROVAL_RESULT', 'تم رفض طلب إجازتك ❌');
    await sendTemplateEmail(p.tenantId, p.data.employeeEmail, 'leave_rejected', p.data);
  });

  // ─── Loan lifecycle ──────────────
  registerHandler('loan.approved', async (p: EventPayload) => {
    await sendNotification(p.tenantId, p.data.employeeId, 'APPROVAL_RESULT', 'تمت الموافقة على سلفتك 💰');
    await sendTemplateEmail(p.tenantId, p.data.employeeEmail, 'loan_approved', p.data);
    await dispatchWebhookEvent(p.tenantId, 'loan.approved', p.data);
  });

  registerHandler('loan.rejected', async (p: EventPayload) => {
    await sendNotification(p.tenantId, p.data.employeeId, 'APPROVAL_RESULT', 'تم رفض طلب السلفة');
  });

  // ─── Contract alerts ─────────────
  registerHandler('contract.expiring', async (p: EventPayload) => {
    await sendNotification(p.tenantId, p.data.managerId || p.data.hrId || p.triggeredBy, 'EXPIRY_ALERT', `عقد ${p.data.employeeName} ينتهي خلال ${p.data.daysLeft} يوم ⚠️`);
    await sendTemplateEmail(p.tenantId, p.data.hrEmail, 'contract_expiring', p.data);
  });

  // ─── Training ────────────────────
  registerHandler('training.completed', async (p: EventPayload) => {
    await sendNotification(p.tenantId, p.data.employeeId, 'SYSTEM', 'مبروك! أكملت الدورة التدريبية 🎓');
    await dispatchWebhookEvent(p.tenantId, 'training.completed', p.data);
  });

  // ─── Workflow lifecycle ──────────
  registerHandler('workflow.approved', async (p: EventPayload) => {
    await updateResourceStatus(p.tenantId, p.data.resourceType, p.data.resourceId, 'APPROVED');
    await sendNotification(p.tenantId, p.data.initiatorId, 'APPROVAL_RESULT', `تمت الموافقة على طلبك ✅`);
  });

  registerHandler('workflow.rejected', async (p: EventPayload) => {
    await updateResourceStatus(p.tenantId, p.data.resourceType, p.data.resourceId, 'REJECTED');
    await sendNotification(p.tenantId, p.data.initiatorId, 'APPROVAL_RESULT', `تم رفض طلبك ❌`);
  });

  // ─── Generic approval pending ────
  registerHandler('approval.pending', async (p: EventPayload) => {
    await sendNotification(p.tenantId, p.data.approverId, 'APPROVAL_PENDING', `طلب ${p.data.requestType || ''} بانتظار موافقتك`, undefined, p.data.link || '/cvision/requests');
  });

  // ─── Expiry alerts ───────────────
  registerHandler('expiry.alert', async (p: EventPayload) => {
    await sendNotification(p.tenantId, p.data.recipientId || p.triggeredBy, 'EXPIRY_ALERT', p.data.title || 'تنبيه انتهاء', p.data.body);
  });

  // ─── Letters ─────────────────────
  registerHandler('letter.generated', async (p: EventPayload) => {
    await sendNotification(p.tenantId, p.data.employeeId, 'SYSTEM', 'تم إصدار خطابك 📄', undefined, `/cvision/letters`);
  });

  // ─── Travel ──────────────────────
  registerHandler('travel.approved', async (p: EventPayload) => {
    await sendNotification(p.tenantId, p.data.employeeId, 'APPROVAL_RESULT', 'تمت الموافقة على طلب السفر ✈️');
    await dispatchWebhookEvent(p.tenantId, 'travel.approved', p.data);
  });
}
