import type { EmailOptions, EmailResult } from '../sender';

export async function sendViaSES(region: string, options: EmailOptions): Promise<EmailResult> {
  try {
    const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
    const client = new SESClient({ region });
    const to = Array.isArray(options.to) ? options.to : [options.to];
    const cmd = new SendEmailCommand({
      Source: process.env.EMAIL_FROM || 'noreply@cvision.hr',
      Destination: { ToAddresses: to, CcAddresses: options.cc, BccAddresses: options.bcc },
      Message: { Subject: { Data: options.subject }, Body: { Html: { Data: options.html } } },
      ReplyToAddresses: options.replyTo ? [options.replyTo] : undefined,
    });
    const res = await client.send(cmd);
    return { success: true, messageId: res.MessageId };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
