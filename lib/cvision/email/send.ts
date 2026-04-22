import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Offer Email Service
 *
 * Sends professional HTML offer emails to candidates via SMTP (nodemailer).
 * Falls back to console.log when SMTP is not configured (no crash).
 *
 * Required env vars (all optional -- graceful degradation):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendOfferEmailParams {
  to: string;
  candidateName: string;
  position: string;
  salary: number;
  currency: string;
  startDate: string; // ISO or human-readable
  expiryDate: string;
  benefits?: string[];
  portalUrl: string;
  companyName?: string;
  /** Optional language override: 'ar' forces Arabic, anything else English */
  lang?: 'en' | 'ar';
}

export interface SendOfferEmailResult {
  sent: boolean;
  messageId?: string;
  fallback: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// SMTP Config
// ---------------------------------------------------------------------------

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !port) {
    return null;
  }

  return { host, port: Number(port), user, pass, from };
}

let _transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (_transporter) return _transporter;

  const cfg = getSmtpConfig();
  if (!cfg) return null;

  _transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    ...(cfg.user && cfg.pass
      ? { auth: { user: cfg.user, pass: cfg.pass } }
      : {}),
  });

  return _transporter;
}

// ---------------------------------------------------------------------------
// Language detection helper
// ---------------------------------------------------------------------------

/** Very lightweight Arabic script detection */
function looksArabic(text: string): boolean {
  // Unicode range for Arabic characters
  return /[\u0600-\u06FF]/.test(text);
}

function detectLang(candidateName: string, override?: 'en' | 'ar'): 'en' | 'ar' {
  if (override) return override;
  return looksArabic(candidateName) ? 'ar' : 'en';
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-SA', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function formatDate(dateStr: string, lang: 'en' | 'ar'): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function buildBenefitsHtml(benefits: string[], lang: 'en' | 'ar'): string {
  if (!benefits.length) return '';

  const heading = lang === 'ar' ? 'المزايا' : 'Benefits';
  const items = benefits
    .map(
      (b) =>
        `<li style="padding:4px 0;color:#374151;">${b}</li>`
    )
    .join('');

  return `
    <tr>
      <td style="padding:16px 24px 4px;">
        <h3 style="margin:0;font-size:15px;color:#111827;">${heading}</h3>
      </td>
    </tr>
    <tr>
      <td style="padding:0 24px 16px;">
        <ul style="margin:8px 0;padding-left:20px;${lang === 'ar' ? 'direction:rtl;padding-right:20px;padding-left:0;' : ''}">${items}</ul>
      </td>
    </tr>
  `;
}

function buildEnglishHtml(params: SendOfferEmailParams & { formattedSalary: string; formattedStart: string; formattedExpiry: string }): string {
  const { candidateName, position, formattedSalary, formattedStart, formattedExpiry, benefits, portalUrl, companyName } = params;
  const company = companyName || 'Our Company';

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#2563eb,#1e40af);padding:32px 24px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">Job Offer from ${company}</h1>
        </td>
      </tr>

      <!-- Greeting -->
      <tr>
        <td style="padding:24px 24px 8px;">
          <p style="margin:0;font-size:16px;color:#111827;">Dear <strong>${candidateName}</strong>,</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px;">
          <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">
            We are pleased to extend a formal offer of employment for the position of
            <strong>${position}</strong> at ${company}. We were impressed with your qualifications
            and believe you will be a valuable addition to our team.
          </p>
        </td>
      </tr>

      <!-- Offer Details -->
      <tr>
        <td style="padding:16px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
                <span style="font-size:13px;color:#6b7280;">Position</span><br>
                <strong style="font-size:15px;color:#111827;">${position}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
                <span style="font-size:13px;color:#6b7280;">Total Monthly Salary</span><br>
                <strong style="font-size:18px;color:#059669;">${formattedSalary}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
                <span style="font-size:13px;color:#6b7280;">Proposed Start Date</span><br>
                <strong style="font-size:15px;color:#111827;">${formattedStart}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 20px;">
                <span style="font-size:13px;color:#6b7280;">Offer Valid Until</span><br>
                <strong style="font-size:15px;color:#dc2626;">${formattedExpiry}</strong>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Benefits -->
      ${buildBenefitsHtml(benefits || [], 'en')}

      <!-- CTA -->
      <tr>
        <td style="padding:16px 24px 8px;text-align:center;">
          <p style="margin:0 0 12px;font-size:15px;color:#374151;">
            Please review the full offer details and respond through our portal:
          </p>
          <a href="${portalUrl}" target="_blank"
             style="display:inline-block;padding:14px 32px;background:#2563eb;color:#ffffff;
                    text-decoration:none;font-size:15px;font-weight:600;border-radius:6px;">
            View &amp; Respond to Offer
          </a>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:24px;text-align:center;border-top:1px solid #e5e7eb;margin-top:16px;">
          <p style="margin:0;font-size:13px;color:#9ca3af;">
            This offer is confidential and intended solely for ${candidateName}.
            If you have any questions, please contact our HR department.
          </p>
          <p style="margin:8px 0 0;font-size:12px;color:#d1d5db;">&copy; ${new Date().getFullYear()} ${company}. All rights reserved.</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function buildArabicHtml(params: SendOfferEmailParams & { formattedSalary: string; formattedStart: string; formattedExpiry: string }): string {
  const { candidateName, position, formattedSalary, formattedStart, formattedExpiry, benefits, portalUrl, companyName } = params;
  const company = companyName || 'شركتنا';

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Roboto,'Noto Naskh Arabic',Tahoma,sans-serif;direction:rtl;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#2563eb,#1e40af);padding:32px 24px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">عرض وظيفي من ${company}</h1>
        </td>
      </tr>

      <!-- Greeting -->
      <tr>
        <td style="padding:24px 24px 8px;text-align:right;">
          <p style="margin:0;font-size:16px;color:#111827;">عزيزي/عزيزتي <strong>${candidateName}</strong>،</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px;text-align:right;">
          <p style="margin:0;font-size:15px;color:#374151;line-height:1.8;">
            يسرنا أن نقدم لك عرض عمل رسمي لشغل وظيفة
            <strong>${position}</strong> في ${company}.
            لقد أعجبنا بمؤهلاتك ونؤمن بأنك ستكون إضافة قيمة لفريقنا.
          </p>
        </td>
      </tr>

      <!-- Offer Details -->
      <tr>
        <td style="padding:16px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;text-align:right;">
                <span style="font-size:13px;color:#6b7280;">المسمى الوظيفي</span><br>
                <strong style="font-size:15px;color:#111827;">${position}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;text-align:right;">
                <span style="font-size:13px;color:#6b7280;">الراتب الشهري الإجمالي</span><br>
                <strong style="font-size:18px;color:#059669;">${formattedSalary}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;text-align:right;">
                <span style="font-size:13px;color:#6b7280;">تاريخ البدء المقترح</span><br>
                <strong style="font-size:15px;color:#111827;">${formattedStart}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 20px;text-align:right;">
                <span style="font-size:13px;color:#6b7280;">العرض صالح حتى</span><br>
                <strong style="font-size:15px;color:#dc2626;">${formattedExpiry}</strong>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Benefits -->
      ${buildBenefitsHtml(benefits || [], 'ar')}

      <!-- CTA -->
      <tr>
        <td style="padding:16px 24px 8px;text-align:center;">
          <p style="margin:0 0 12px;font-size:15px;color:#374151;">
            يرجى مراجعة تفاصيل العرض الكاملة والرد من خلال بوابتنا:
          </p>
          <a href="${portalUrl}" target="_blank"
             style="display:inline-block;padding:14px 32px;background:#2563eb;color:#ffffff;
                    text-decoration:none;font-size:15px;font-weight:600;border-radius:6px;">
            عرض والرد على العرض
          </a>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:24px;text-align:center;border-top:1px solid #e5e7eb;margin-top:16px;">
          <p style="margin:0;font-size:13px;color:#9ca3af;">
            هذا العرض سري ومخصص فقط لـ ${candidateName}.
            إذا كان لديك أي استفسار، يرجى التواصل مع قسم الموارد البشرية.
          </p>
          <p style="margin:8px 0 0;font-size:12px;color:#d1d5db;">&copy; ${new Date().getFullYear()} ${company}. جميع الحقوق محفوظة.</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a professional offer email to a candidate.
 *
 * If SMTP is not configured the function logs the offer details to stdout and
 * returns `{ sent: false, fallback: true }` -- it never throws.
 */
export async function sendOfferEmail(
  params: SendOfferEmailParams
): Promise<SendOfferEmailResult> {
  const lang = detectLang(params.candidateName, params.lang);

  const formattedSalary = formatCurrency(params.salary, params.currency);
  const formattedStart = formatDate(params.startDate, lang);
  const formattedExpiry = formatDate(params.expiryDate, lang);

  const htmlBody =
    lang === 'ar'
      ? buildArabicHtml({ ...params, formattedSalary, formattedStart, formattedExpiry })
      : buildEnglishHtml({ ...params, formattedSalary, formattedStart, formattedExpiry });

  const subject =
    lang === 'ar'
      ? `عرض وظيفي - ${params.position} | ${params.companyName || 'شركتنا'}`
      : `Job Offer - ${params.position} | ${params.companyName || 'Our Company'}`;

  // ----- Try SMTP -----
  const transporter = getTransporter();

  if (!transporter) {
    logger.info('[Offer Email] SMTP not configured -- falling back to console');
    logger.info(`[Offer Email] To: ${params.to}`);
    logger.info(`[Offer Email] Subject: ${subject}`);
    logger.info(`[Offer Email] Candidate: ${params.candidateName}`);
    logger.info(`[Offer Email] Position: ${params.position}`);
    logger.info(`[Offer Email] Salary: ${formattedSalary}`);
    logger.info(`[Offer Email] Start: ${formattedStart}`);
    logger.info(`[Offer Email] Portal: ${params.portalUrl}`);
    return { sent: false, fallback: true };
  }

  try {
    const smtpCfg = getSmtpConfig()!;
    const from = smtpCfg.from || `"${params.companyName || 'HR'}" <noreply@${smtpCfg.host}>`;

    const info = await transporter.sendMail({
      from,
      to: params.to,
      subject,
      html: htmlBody,
    });

    logger.info(`[Offer Email] Sent to ${params.to} (messageId=${info.messageId})`);
    return { sent: true, messageId: info.messageId, fallback: false };
  } catch (err: any) {
    logger.error('[Offer Email] SMTP send failed:', err?.message || String(err));
    return { sent: false, fallback: false, error: err?.message || String(err) };
  }
}
