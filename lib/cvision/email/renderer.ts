import { getCVisionDb } from '@/lib/cvision/db';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function renderTemplate(tenantId: string, templateKey: string, variables: Record<string, string>): Promise<{ subject: string; html: string }> {
  const db = await getCVisionDb(tenantId);
  const tpl = await db.collection('cvision_email_templates').findOne({ tenantId, key: templateKey }) as Record<string, unknown> | null;

  let subject: string = (tpl?.subject as string) || templateKey;
  let html: string = (tpl?.body as string) || `<p>${templateKey}</p>`;

  Object.entries(variables).forEach(([k, v]) => {
    const ek = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\{\\{${ek}\\}\\}`, 'g');
    const escaped = escapeHtml(v);
    subject = subject.replace(regex, escaped);
    html = html.replace(regex, escaped);
  });

  const wrapper = `
<!DOCTYPE html>
<html dir="rtl">
<head><meta charset="UTF-8"><style>body{font-family:'Segoe UI',Tahoma,sans-serif;margin:0;padding:0;background:#f8fafc}
.container{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden}
.header{background:#2563eb;color:#fff;padding:20px;text-align:center}
.content{padding:24px}
.footer{padding:16px 24px;background:#f1f5f9;text-align:center;font-size:12px;color:#64748b}</style></head>
<body><div class="container">
<div class="header"><h2>CVision HR</h2></div>
<div class="content">${html}</div>
<div class="footer">هذا البريد تم إرساله تلقائياً من نظام CVision HR<br/>This email was sent automatically from CVision HR</div>
</div></body></html>`;

  return { subject, html: wrapper };
}
