import { logger } from '@/lib/monitoring/logger';
export interface SMSResult { success: boolean; messageId?: string; error?: string; }

export type SMSProvider = 'unifonic' | 'twilio' | 'mock';

/** Maximum allowed SMS body length (concatenated SMS cap; single SMS is 160 chars). */
const SMS_MAX_LENGTH = 1600;

/**
 * Sanitize an SMS message body to prevent parameter injection.
 *
 * URLSearchParams handles percent-encoding automatically, so the real risk is
 * content that embeds literal `&key=value` sequences that a naive string-concat
 * sender would split into extra parameters. We strip control characters and
 * null bytes, then enforce a length cap so the string can never be used to
 * smuggle oversized payloads to the upstream SMS gateway.
 *
 * @throws {Error} if the sanitized message exceeds SMS_MAX_LENGTH characters.
 */
function sanitizeSmsBody(message: string): string {
  // Remove null bytes and ASCII control characters (except tab/LF/CR which
  // some gateways allow in body text).
  const sanitized = message.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  if (sanitized.length === 0) {
    throw new Error('SMS message body must not be empty after sanitization');
  }

  if (sanitized.length > SMS_MAX_LENGTH) {
    throw new Error(
      `SMS message body exceeds maximum allowed length of ${SMS_MAX_LENGTH} characters (got ${sanitized.length})`
    );
  }

  return sanitized;
}

export function validateAndFormat(phone: string): string {
  let p = phone.replace(/[\s\-()]/g, '');
  if (p.startsWith('05')) p = '+966' + p.slice(1);
  else if (p.startsWith('5') && p.length === 9) p = '+966' + p;
  else if (p.startsWith('966')) p = '+' + p;
  else if (!p.startsWith('+')) p = '+' + p;
  return p;
}

export async function sendSMS(tenantId: string, to: string, message: string, provider?: SMSProvider): Promise<SMSResult> {
  const p = provider || (process.env.SMS_PROVIDER as SMSProvider) || 'mock';
  const formatted = validateAndFormat(to);

  let sanitizedMessage: string;
  try {
    sanitizedMessage = sanitizeSmsBody(message);
  } catch (e: any) {
    return { success: false, error: e.message };
  }

  switch (p) {
    case 'unifonic': return sendViaUnifonic(formatted, sanitizedMessage);
    case 'twilio': return sendViaTwilio(formatted, sanitizedMessage);
    default: return sendViaMock(formatted, sanitizedMessage);
  }
}

async function sendViaUnifonic(to: string, message: string): Promise<SMSResult> {
  const appSid = process.env.UNIFONIC_APP_SID;
  if (!appSid) return { success: false, error: 'UNIFONIC_APP_SID not configured' };
  try {
    const recipient = to.replace('+', '');
    const body = new URLSearchParams({ AppSid: appSid, Recipient: recipient, Body: message, SenderID: process.env.UNIFONIC_SENDER_ID || 'CVision' });
    const res = await fetch('https://el.cloud.unifonic.com/rest/SMS/messages', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
    const data = await res.json();
    if (data.success) return { success: true, messageId: data.data?.MessageID };
    return { success: false, error: data.message || 'Unifonic error' };
  } catch (e: any) { return { success: false, error: e.message }; }
}

async function sendViaTwilio(to: string, message: string): Promise<SMSResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE;
  if (!sid || !token || !from) return { success: false, error: 'Twilio not configured' };
  try {
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const body = new URLSearchParams({ To: to, From: from, Body: message });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
    const data = await res.json();
    if (data.sid) return { success: true, messageId: data.sid };
    return { success: false, error: data.message || 'Twilio error' };
  } catch (e: any) { return { success: false, error: e.message }; }
}

async function sendViaMock(to: string, message: string): Promise<SMSResult> {
  logger.info(`[SMS-MOCK] To: ${to} Message: ${message}`);
  return { success: true, messageId: `mock-sms-${Date.now()}` };
}
