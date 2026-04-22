import twilio from 'twilio';
import { logger } from '@/lib/monitoring/logger';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

function getClient() {
  if (accountSid && authToken) return twilio(accountSid, authToken);
  return null;
}

function normalizeNumber(to: string): string | null {
  let n = to.replace(/[^0-9]/g, '');
  if (n.startsWith('00966')) n = n.slice(5);
  if (n.startsWith('966')) n = n.slice(3);
  if (n.startsWith('0')) n = n.slice(1);
  // Validate: Saudi mobile numbers are 9 digits starting with 5
  if (n.length !== 9 || !n.startsWith('5')) {
    logger.warn('Invalid Saudi mobile number after normalization', { category: 'system', raw: to, normalized: n });
    return null;
  }
  return '+966' + n;
}

export async function sendSMS(
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!accountSid || !authToken || !fromNumber) {
    logger.debug('SMS dev mode (no Twilio credentials)', { category: 'system', to, message });
    return { success: true, messageId: 'dev-mode' };
  }

  const normalizedTo = normalizeNumber(to);
  if (!normalizedTo) {
    return { success: false, error: `Invalid phone number: ${to}` };
  }

  try {
    const client = getClient()!;
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: normalizedTo,
    });
    logger.info('SMS sent via Twilio', { category: 'system', to: normalizedTo, sid: result.sid });
    return { success: true, messageId: result.sid };
  } catch (error: any) {
    logger.error('SMS send error', { category: 'system', error });
    return { success: false, error: error.message };
  }
}

export async function sendOTP(mobile: string, otp: string): Promise<{ success: boolean; error?: string }> {
  const message = `رمز التحقق الخاص بك: ${otp}\nصالح لمدة 5 دقائق.\n\nYour Thea Health OTP: ${otp}\nValid for 5 minutes.`;
  return sendSMS(mobile, message);
}

export async function sendAppointmentReminder(
  mobile: string,
  patientName: string,
  doctorName: string,
  dateTime: string,
  clinicName: string
): Promise<{ success: boolean; error?: string }> {
  const message = `عزيزي/ة ${patientName}، تذكير بموعدك مع د. ${doctorName} الساعة ${dateTime} في عيادة ${clinicName}.\n\nDear ${patientName}, reminder: appointment with Dr. ${doctorName} at ${dateTime}, ${clinicName}.\n\nThea Health`;
  return sendSMS(mobile, message);
}
