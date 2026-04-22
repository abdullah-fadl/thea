import type { Db } from '@/lib/cvision/infra/mongo-compat';

const QUEUE = 'cvision_email_queue';
const TEMPLATES = 'cvision_email_templates';

/* ── Built-in Templates ────────────────────────────────────────────── */

export const EMAIL_TEMPLATES: Record<string, { subject: string; body: string }> = {
  WELCOME_EMAIL: {
    subject: 'Welcome to {{companyName}}!',
    body: `<h2>Welcome, {{employeeName}}!</h2>
<p>We're excited to have you join {{companyName}} as {{position}} in the {{department}} department.</p>
<p>Your start date is {{startDate}}. Please report to {{location}} at {{time}}.</p>
<p><a href="{{portalUrl}}">Access your employee portal</a></p>`,
  },
  LEAVE_APPROVED: {
    subject: 'Leave Request Approved — {{leaveType}}',
    body: `<p>Hi {{employeeName}},</p>
<p>Your {{leaveType}} request has been approved:</p>
<ul><li>From: {{startDate}}</li><li>To: {{endDate}}</li><li>Days: {{days}}</li></ul>
<p>Approved by: {{approverName}}</p>`,
  },
  LEAVE_REJECTED: {
    subject: 'Leave Request Rejected — {{leaveType}}',
    body: `<p>Hi {{employeeName}},</p>
<p>Your {{leaveType}} request from {{startDate}} to {{endDate}} has been rejected.</p>
<p>Reason: {{reason}}</p>
<p>Rejected by: {{approverName}}</p>`,
  },
  PAYSLIP_READY: {
    subject: 'Your Payslip for {{month}} is Ready',
    body: `<p>Hi {{employeeName}},</p>
<p>Your payslip for {{month}} is now available.</p>
<p><a href="{{payslipUrl}}">View Payslip</a></p>`,
  },
  CONTRACT_EXPIRING: {
    subject: 'Contract Expiry Alert — {{employeeName}}',
    body: `<p>Hi HR Team,</p>
<p>The employment contract for <strong>{{employeeName}}</strong> ({{department}}) is expiring on <strong>{{expiryDate}}</strong> ({{daysRemaining}} days remaining).</p>
<p>Please take action to renew or end the contract.</p>`,
  },
  IQAMA_EXPIRING: {
    subject: 'Iqama Expiry Alert — {{employeeName}}',
    body: `<p>Hi HR Team,</p>
<p>The Iqama for <strong>{{employeeName}}</strong> expires on <strong>{{expiryDate}}</strong> ({{daysRemaining}} days).</p>
<p>Action required for renewal.</p>`,
  },
  LOAN_APPROVED: {
    subject: 'Loan Request Approved',
    body: `<p>Hi {{employeeName}},</p>
<p>Your loan request for <strong>{{amount}} SAR</strong> has been approved.</p>
<p>Monthly installment: {{installment}} SAR over {{months}} months.</p>`,
  },
  PASSWORD_RESET: {
    subject: 'Password Reset Request',
    body: `<p>Hi {{employeeName}},</p>
<p>A password reset was requested for your account.</p>
<p><a href="{{resetUrl}}">Reset your password</a></p>
<p>This link expires in 1 hour. If you did not request this, please ignore.</p>`,
  },
  APPROVAL_PENDING: {
    subject: 'Action Required: {{requestType}} needs your approval',
    body: `<p>Hi {{approverName}},</p>
<p><strong>{{requesterName}}</strong> has submitted a {{requestType}} that requires your approval.</p>
<p>Details: {{details}}</p>
<p><a href="{{approvalUrl}}">Review & Approve</a></p>`,
  },
  TRAINING_ENROLLMENT: {
    subject: 'Training Enrollment Confirmation — {{courseName}}',
    body: `<p>Hi {{employeeName}},</p>
<p>You have been enrolled in the following training:</p>
<ul><li>Course: {{courseName}}</li><li>Date: {{startDate}}</li><li>Location: {{location}}</li></ul>`,
  },
  PROBATION_ENDING: {
    subject: 'Probation Period Ending — {{employeeName}}',
    body: `<p>Hi HR Team,</p>
<p>The probation period for <strong>{{employeeName}}</strong> ({{department}}) ends on <strong>{{endDate}}</strong>.</p>
<p>Please complete the probation evaluation.</p>`,
  },
  BIRTHDAY_WISH: {
    subject: 'Happy Birthday, {{employeeName}}! 🎂',
    body: `<p>Dear {{employeeName}},</p>
<p>Wishing you a wonderful birthday from the entire {{companyName}} team!</p>`,
  },
};

/* ── Template Rendering ────────────────────────────────────────────── */

export function renderTemplate(template: { subject: string; body: string }, data: Record<string, any>): { subject: string; body: string } {
  const replace = (str: string) =>
    str.replace(/\{\{(\w+)\}\}/g, (_, key) => (data[key] ?? `{{${key}}}`).toString());
  return { subject: replace(template.subject), body: replace(template.body) };
}

/* ── Queue Management ──────────────────────────────────────────────── */

export async function queueEmail(
  db: Db, tenantId: string,
  options: {
    to: string;
    cc?: string[];
    bcc?: string[];
    templateId?: string;
    templateData?: Record<string, any>;
    subject?: string;
    body?: string;
    priority?: 'HIGH' | 'NORMAL' | 'LOW';
  },
) {
  let subject = options.subject || '';
  let body = options.body || '';

  if (options.templateId) {
    const builtin = EMAIL_TEMPLATES[options.templateId];
    const custom = builtin
      ? null
      : await db.collection(TEMPLATES).findOne({ tenantId, templateId: options.templateId });

    const tmpl = builtin || (custom ? { subject: custom.subject as string, body: custom.body as string } : null);
    if (tmpl) {
      const rendered = renderTemplate(tmpl, options.templateData || {});
      subject = rendered.subject;
      body = rendered.body;
    }
  }

  const doc = {
    tenantId,
    to: options.to,
    cc: options.cc || [],
    bcc: options.bcc || [],
    subject,
    body,
    templateId: options.templateId,
    templateData: options.templateData,
    priority: options.priority || 'NORMAL',
    status: 'QUEUED' as const,
    attempts: 0,
    maxAttempts: 3,
    createdAt: new Date(),
  };

  await db.collection(QUEUE).insertOne(doc);
  return doc;
}

export async function processEmailQueue(db: Db, tenantId: string) {
  const emails = await db.collection(QUEUE).find({
    tenantId,
    status: { $in: ['QUEUED', 'FAILED'] },
    attempts: { $lt: 3 },
  }).sort({ priority: 1, createdAt: 1 }).limit(50).toArray();

  let sent = 0;
  let failed = 0;

  for (const email of emails) {
    try {
      // In production: use nodemailer / SES / SendGrid etc.
      // For now, mark as sent (simulated)
      await db.collection(QUEUE).updateOne({ _id: email._id, tenantId }, {
        $set: { status: 'SENT', sentAt: new Date(), lastAttemptAt: new Date() },
        $inc: { attempts: 1 },
      });
      sent++;
    } catch (err: any) {
      const newAttempts = (email.attempts || 0) + 1;
      await db.collection(QUEUE).updateOne({ _id: email._id, tenantId }, {
        $set: {
          status: newAttempts >= email.maxAttempts ? 'FAILED' : 'QUEUED',
          lastError: err.message,
          lastAttemptAt: new Date(),
        },
        $inc: { attempts: 1 },
      });
      failed++;
    }
  }

  return { processed: emails.length, sent, failed };
}

/* ── Query Helpers ─────────────────────────────────────────────────── */

export async function getEmailQueue(db: Db, tenantId: string, status?: string, limit = 50) {
  const query: any = { tenantId };
  if (status) query.status = status;
  return db.collection(QUEUE).find(query).sort({ createdAt: -1 }).limit(limit).toArray();
}

export async function getEmailStats(db: Db, tenantId: string) {
  const pipeline = [
    { $match: { tenantId } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ];
  const stats = await db.collection(QUEUE).aggregate(pipeline).toArray();
  return stats.reduce((acc: any, s: any) => { acc[s._id] = s.count; return acc; }, {});
}

export async function listTemplates(db: Db, tenantId: string) {
  const custom = await db.collection(TEMPLATES).find({ tenantId }).toArray();
  const builtInList = Object.entries(EMAIL_TEMPLATES).map(([id, tmpl]) => ({
    templateId: id, ...tmpl, builtIn: true,
  }));
  return [...builtInList, ...custom.map((t: any) => ({ ...t, builtIn: false }))];
}

export async function saveTemplate(db: Db, tenantId: string, templateId: string, data: { subject: string; body: string }) {
  await db.collection(TEMPLATES).updateOne(
    { tenantId, templateId },
    { $set: { ...data, tenantId, templateId, updatedAt: new Date() } },
    { upsert: true },
  );
  return db.collection(TEMPLATES).findOne({ tenantId, templateId });
}
