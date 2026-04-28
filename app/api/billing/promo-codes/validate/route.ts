import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { validatePromoCodeSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const body = await req.json();
  const v = validateBody(body, validatePromoCodeSchema);
  if ('error' in v) return v.error;
  const { code, subtotal } = v.data;

  if (!code) {
    return NextResponse.json({ valid: false, message: 'الكود مطلوب' }, { status: 400 });
  }

  const promo = await prisma.billingPromoCode.findFirst({
    where: {
      tenantId,
      code: code.toUpperCase(),
      isActive: true,
    },
  });

  if (!promo) {
    return NextResponse.json({ valid: false, message: 'كود غير صالح' });
  }

  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
    return NextResponse.json({ valid: false, message: 'الكود منتهي الصلاحية' });
  }

  if (promo.maxUses && promo.usedCount >= promo.maxUses) {
    return NextResponse.json({ valid: false, message: 'تم استنفاد الكود' });
  }

  if (promo.minAmount && subtotal < Number(promo.minAmount)) {
    return NextResponse.json({
      valid: false,
      message: `الحد الأدنى للطلب ${promo.minAmount} ر.س`,
    });
  }

  return NextResponse.json({
    valid: true,
    type: promo.type,
    value: promo.value,
    message:
      promo.description ||
      `خصم ${promo.type === 'percentage' ? `${promo.value}%` : `${promo.value} ر.س`}`,
  });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
