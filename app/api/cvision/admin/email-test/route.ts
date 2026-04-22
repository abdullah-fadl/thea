import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { sendEmail } from '@/lib/cvision/email/sender';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

export const POST = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.CONFIG_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires CONFIG_WRITE');

  const body = await request.json();
  const result = await sendEmail(tenantId, {
    to: body.to || ctx.userId,
    subject: 'CVision HR — Test Email',
    html: '<h2>Test Email</h2><p>If you received this email, your email configuration is working correctly.</p><p>إذا وصلك هذا البريد، فإن إعدادات البريد تعمل بشكل صحيح.</p>',
  });

  return NextResponse.json({ ok: result.success, data: result });
});
