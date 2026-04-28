import { getCVisionDb } from '@/lib/cvision/db';
import { sendEmail, EmailOptions } from './sender';
import { v4 as uuid } from 'uuid';

export async function queueEmail(tenantId: string, options: EmailOptions) {
  const db = await getCVisionDb(tenantId);
  const doc = {
    tenantId, emailId: uuid(),
    to: Array.isArray(options.to) ? options.to : [options.to],
    subject: options.subject, html: options.html,
    cc: options.cc, bcc: options.bcc, replyTo: options.replyTo,
    status: 'QUEUED', attempts: 0, lastAttempt: null as Date | null, error: null as string | null,
    createdAt: new Date(), sentAt: null as Date | null,
  };
  await db.collection('cvision_email_queue').insertOne(doc);
  return doc.emailId;
}

export async function processQueue(tenantId: string): Promise<{ processed: number; sent: number; failed: number }> {
  const db = await getCVisionDb(tenantId);
  const pending = await db.collection('cvision_email_queue')
    .find({ tenantId, status: { $in: ['QUEUED', 'FAILED'] }, attempts: { $lt: 3 } })
    .sort({ createdAt: 1 }).limit(10).toArray();

  let sent = 0, failed = 0;
  for (const email of pending) {
    const e = email as any;
    await db.collection('cvision_email_queue').updateOne({ _id: email._id, tenantId }, { $set: { status: 'SENDING', lastAttempt: new Date() }, $inc: { attempts: 1 } });

    const result = await sendEmail(tenantId, { to: e.to, subject: e.subject, html: e.html, cc: e.cc, bcc: e.bcc, replyTo: e.replyTo });

    if (result.success) {
      await db.collection('cvision_email_queue').updateOne({ _id: email._id, tenantId }, { $set: { status: 'SENT', sentAt: new Date(), messageId: result.messageId } });
      sent++;
    } else {
      const newStatus = (e.attempts || 0) + 1 >= 3 ? 'PERMANENTLY_FAILED' : 'FAILED';
      await db.collection('cvision_email_queue').updateOne({ _id: email._id, tenantId }, { $set: { status: newStatus, error: result.error } });
      failed++;
    }
  }

  return { processed: pending.length, sent, failed };
}
