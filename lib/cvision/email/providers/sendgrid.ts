import type { EmailOptions, EmailResult } from '../sender';

export async function sendViaSendGrid(apiKey: string, options: EmailOptions): Promise<EmailResult> {
  try {
    const to = Array.isArray(options.to) ? options.to : [options.to];
    const body: any = {
      personalizations: [{ to: to.map(e => ({ email: e })), cc: options.cc?.map(e => ({ email: e })), bcc: options.bcc?.map(e => ({ email: e })) }],
      from: { email: process.env.EMAIL_FROM || 'noreply@cvision.hr' },
      subject: options.subject,
      content: [{ type: 'text/html', value: options.html }],
    };
    if (options.replyTo) body.reply_to = { email: options.replyTo };

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok || res.status === 202) {
      return { success: true, messageId: res.headers.get('x-message-id') || undefined };
    }
    const err = await res.text();
    return { success: false, error: `SendGrid ${res.status}: ${err}` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
