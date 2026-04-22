import type { SMSResult } from '../sender';

export async function sendViaTwilio(config: any, to: string, message: string): Promise<SMSResult> {
  try {
    const sid = config.twilioSid || process.env.TWILIO_SID;
    const token = config.twilioToken || process.env.TWILIO_TOKEN;
    const from = config.twilioFrom || process.env.TWILIO_FROM;

    const body = new URLSearchParams({ To: to, From: from, Body: message });

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(sid + ':' + token).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = await res.json();
    if (data.sid) return { success: true, messageId: data.sid };
    return { success: false, error: data.message || 'Twilio error' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
