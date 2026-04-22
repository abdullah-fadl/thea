/**
 * Email Service
 *
 * Generic email sending service using nodemailer.
 * Falls back to console logging when SMTP is not configured (development mode).
 *
 * Usage:
 *   import { sendEmail, sendPasswordResetEmail } from '@/lib/services/email';
 */

import nodemailer from 'nodemailer';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// ---------------------------------------------------------------------------
// SMTP Configuration
// ---------------------------------------------------------------------------

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !port || !user || !pass) {
    return null;
  }

  return { host, port: Number(port), user, pass, from: from || user };
}

let _transporter: any | null = null;

function getTransporter(): any | null {
  const config = getSmtpConfig();
  if (!config) return null;

  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  return _transporter;
}

// ---------------------------------------------------------------------------
// sendEmail — generic
// ---------------------------------------------------------------------------

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<boolean> {
  const transporter = getTransporter();
  const config = getSmtpConfig();

  if (!transporter || !config) {
    // Graceful fallback: log to console in development
    logger.warn('SMTP not configured — logging email to console', { category: 'email' });
    // eslint-disable-next-line no-console
    console.log('='.repeat(60));
    // eslint-disable-next-line no-console
    console.log(`[EMAIL] To: ${to}`);
    // eslint-disable-next-line no-console
    console.log(`[EMAIL] Subject: ${subject}`);
    // eslint-disable-next-line no-console
    console.log(`[EMAIL] Body:\n${text || html}`);
    // eslint-disable-next-line no-console
    console.log('='.repeat(60));
    return true;
  }

  try {
    await transporter.sendMail({
      from: config.from,
      to,
      subject,
      html,
      text,
    });

    logger.info('Email sent successfully', { category: 'email', to, subject });
    return true;
  } catch (error) {
    logger.error('Failed to send email', {
      category: 'email',
      to,
      subject,
      error: error instanceof Error ? error : undefined,
    });
    return false;
  }
}

// ---------------------------------------------------------------------------
// sendPasswordResetEmail
// ---------------------------------------------------------------------------

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  locale: 'ar' | 'en' = 'ar',
): Promise<boolean> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'http://localhost:3000';
  const resetLink = `${baseUrl}/reset-password?token=${token}`;

  const subject =
    locale === 'ar'
      ? 'إعادة تعيين كلمة المرور — Thea'
      : 'Password Reset — Thea';

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; }
    .container { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: #0f172a; padding: 24px 32px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; }
    .body { padding: 32px; }
    .section { margin-bottom: 28px; }
    .section h2 { font-size: 16px; margin: 0 0 8px; color: #334155; }
    .section p { font-size: 14px; line-height: 1.7; color: #475569; margin: 0 0 16px; }
    .btn { display: inline-block; padding: 12px 32px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; }
    .btn:hover { background: #1d4ed8; }
    .link-fallback { font-size: 12px; color: #94a3b8; word-break: break-all; margin-top: 12px; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
    .footer { padding: 16px 32px; text-align: center; font-size: 12px; color: #94a3b8; background: #f8fafc; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Thea EHR</h1>
    </div>
    <div class="body">
      <!-- Arabic Section -->
      <div class="section" dir="rtl" style="text-align: right;">
        <h2>إعادة تعيين كلمة المرور</h2>
        <p>
          لقد تلقينا طلبًا لإعادة تعيين كلمة المرور الخاصة بحسابك. اضغط على الزر أدناه لإعادة تعيين كلمة المرور.
          هذا الرابط صالح لمدة ساعة واحدة فقط.
        </p>
        <p style="text-align: center;">
          <a href="${resetLink}" class="btn">إعادة تعيين كلمة المرور</a>
        </p>
        <p>
          إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد الإلكتروني بأمان.
        </p>
      </div>

      <hr class="divider" />

      <!-- English Section -->
      <div class="section" dir="ltr" style="text-align: left;">
        <h2>Password Reset</h2>
        <p>
          We received a request to reset the password for your account. Click the button below to reset your password.
          This link is valid for one hour only.
        </p>
        <p style="text-align: center;">
          <a href="${resetLink}" class="btn">Reset Password</a>
        </p>
        <p>
          If you did not request a password reset, you can safely ignore this email.
        </p>
      </div>

      <hr class="divider" />

      <p class="link-fallback">
        If the button does not work, copy and paste this link into your browser:<br/>
        ${resetLink}
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Thea Technologies. All rights reserved.
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = [
    'إعادة تعيين كلمة المرور — Password Reset',
    '',
    'لقد تلقينا طلبًا لإعادة تعيين كلمة المرور الخاصة بحسابك.',
    'We received a request to reset the password for your account.',
    '',
    `رابط إعادة التعيين / Reset link: ${resetLink}`,
    '',
    'هذا الرابط صالح لمدة ساعة واحدة فقط.',
    'This link is valid for one hour only.',
    '',
    'إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد الإلكتروني.',
    'If you did not request a password reset, you can safely ignore this email.',
  ].join('\n');

  return sendEmail({ to: email, subject, html, text });
}
