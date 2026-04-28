import type { SMSResult } from '../sender';

export async function sendViaUnifonic(config: any, to: string, message: string): Promise<SMSResult> {
  try {
    const appSid = config.unifonicAppSid || process.env.UNIFONIC_APP_SID;
    const senderId = config.unifonicSenderId || process.env.UNIFONIC_SENDER_ID || 'CVision';

    const res = await fetch('https://el.cloud.unifonic.com/rest/SMS/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(appSid + ':').toString('base64')}` },
      body: JSON.stringify({ recipient: to.replace('+', ''), body: message, SenderID: senderId }),
    });

    const data = await res.json();
    if (data.success || res.ok) return { success: true, messageId: data.data?.MessageID || data.messageId };
    return { success: false, error: data.message || 'Unifonic error' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
