import { logger } from '@/lib/monitoring/logger';
import { checkRateLimit } from '@/lib/cvision/middleware/rate-limiter';

const EMAIL_RATE_LIMIT = { windowMs: 60_000, maxRequests: 50 };

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  cc?: string[];
  bcc?: string[];
  attachments?: { filename: string; content: Buffer; contentType: string }[];
  replyTo?: string;
}

export interface EmailResult { success: boolean; messageId?: string; error?: string; }

export type EmailProvider = 'smtp' | 'sendgrid' | 'ses' | 'mock';

export async function sendEmail(tenantId: string, options: EmailOptions, provider?: EmailProvider): Promise<EmailResult> {
  const rl = checkRateLimit(`email:${tenantId}`, EMAIL_RATE_LIMIT);
  if (!rl.allowed) {
    logger.warn(`[EMAIL] Rate limit exceeded for tenant ${tenantId}. Retry after ${rl.retryAfter}s.`);
    return { success: false, error: 'Rate limit exceeded — too many emails per minute' };
  }

  const p = provider || (process.env.EMAIL_PROVIDER as EmailProvider) || 'mock';
  switch (p) {
    case 'sendgrid': return sendViaSendGrid(options);
    case 'ses': return sendViaSES(options);
    case 'smtp': return sendViaSMTP(options);
    default: return sendViaMock(tenantId, options);
  }
}

async function sendViaSendGrid(options: EmailOptions): Promise<EmailResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return { success: false, error: 'SENDGRID_API_KEY not configured' };
  try {
    const to = Array.isArray(options.to) ? options.to.map(e => ({ email: e })) : [{ email: options.to }];
    const body: any = {
      personalizations: [{ to, cc: options.cc?.map(e => ({ email: e })), bcc: options.bcc?.map(e => ({ email: e })) }],
      from: { email: process.env.EMAIL_FROM || 'noreply@cvision.hr' },
      subject: options.subject,
      content: [{ type: 'text/html', value: options.html }],
    };
    if (options.replyTo) body.reply_to = { email: options.replyTo };
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok || res.status === 202) return { success: true, messageId: res.headers.get('x-message-id') || '' };
    return { success: false, error: `SendGrid error: ${res.status}` };
  } catch (e: any) { return { success: false, error: e.message }; }
}

async function sendViaSES(options: EmailOptions): Promise<EmailResult> {
  return { success: false, error: 'AWS SES requires aws-sdk — configure in production' };
}

async function sendViaSMTP(options: EmailOptions): Promise<EmailResult> {
  try {
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@cvision.hr',
      to: Array.isArray(options.to) ? options.to.join(',') : options.to,
      cc: options.cc?.join(','), bcc: options.bcc?.join(','),
      subject: options.subject, html: options.html,
      replyTo: options.replyTo,
    });
    return { success: true, messageId: info.messageId };
  } catch (e: any) { return { success: false, error: e.message }; }
}

async function sendViaMock(tenantId: string, options: EmailOptions): Promise<EmailResult> {
  logger.info(`[EMAIL-MOCK] To: ${String(options.to).replace(/(.{3}).*(@.*)/, '$1***$2')} Subject: [redacted]`);
  return { success: true, messageId: `mock-${Date.now()}` };
}
