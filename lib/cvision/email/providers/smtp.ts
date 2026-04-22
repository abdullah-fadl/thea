import type { EmailOptions, EmailResult } from '../sender';

interface SMTPConfig { host: string; port: number; secure: boolean; user: string; pass: string; from?: string; }

export async function sendViaSMTP(config: SMTPConfig, options: EmailOptions): Promise<EmailResult> {
  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: config.host, port: config.port, secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });

    const info = await transporter.sendMail({
      from: config.from || config.user,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      cc: options.cc?.join(', '),
      bcc: options.bcc?.join(', '),
      replyTo: options.replyTo,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments?.map(a => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
    });

    return { success: true, messageId: info.messageId };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
