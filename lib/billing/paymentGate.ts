import { prisma } from '@/lib/db/prisma';

export interface PaymentGateResult {
  allowed: boolean;
  reason?: string;
  paymentStatus?: string;
}

export async function checkOrderPayment(
  _db: any,
  tenantId: string,
  orderId: string,
  _orderType: 'LAB' | 'RADIOLOGY' | 'PROCEDURE'
): Promise<PaymentGateResult> {
  // Read exclusively from orders_hub (primary source of truth)
  const order: any = await prisma.ordersHub.findFirst({
    where: { tenantId, id: orderId },
  });

  if (!order) {
    return { allowed: false, reason: 'الأوردر غير موجود' };
  }

  const paymentStatus = order.payment?.status ?? (order.meta as Record<string, Record<string, unknown>> | undefined)?.payment?.status;

  if (['PAID', 'INSURANCE_APPROVED', 'EXEMPTED'].includes(paymentStatus)) {
    return { allowed: true, paymentStatus };
  }

  if (paymentStatus === 'PENDING_PAYMENT') {
    return { allowed: false, reason: 'الأوردر بانتظار الدفع', paymentStatus };
  }

  if (paymentStatus === 'INSURANCE_PENDING') {
    return { allowed: false, reason: 'بانتظار موافقة التأمين', paymentStatus };
  }

  if (paymentStatus === 'INSURANCE_REJECTED') {
    return { allowed: false, reason: 'التأمين مرفوض - يرجى الدفع كاش', paymentStatus };
  }

  return { allowed: false, reason: 'لم يتم تسجيل الدفع', paymentStatus: paymentStatus || 'UNKNOWN' };
}

export function withPaymentGate(orderType: 'LAB' | 'RADIOLOGY' | 'PROCEDURE') {
  return async (_db: any, tenantId: string, orderId: string) => {
    const result = await checkOrderPayment(_db, tenantId, orderId, orderType);
    if (!result.allowed) {
      throw new Error(result.reason || 'الدفع مطلوب قبل تنفيذ الأوردر');
    }
    return result;
  };
}
