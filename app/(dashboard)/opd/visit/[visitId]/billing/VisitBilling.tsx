'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const PAYMENT_STATUS_STYLES: Record<string, { style: string }> = {
  PAID: { style: 'bg-emerald-100 text-emerald-800' },
  PENDING: { style: 'bg-amber-100 text-amber-800' },
  SKIPPED: { style: 'bg-slate-100 text-slate-600' },
};

export default function VisitBilling() {
  const { visitId } = useParams();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const { data: opdData } = useSWR(
    visitId ? `/api/opd/encounters/${visitId}` : null,
    fetcher
  );
  const { data: chargeSummary } = useSWR(
    visitId ? `/api/billing/charge-summary?encounterCoreId=${visitId}` : null,
    fetcher
  );
  const { data: chargeEvents } = useSWR(
    visitId ? `/api/billing/charge-events?encounterCoreId=${visitId}` : null,
    fetcher
  );

  const opd = opdData?.opd || opdData || {};
  const payment = opd?.payment;
  const billingMeta = opd?.billingMeta;
  const events = Array.isArray(chargeEvents?.items) ? chargeEvents.items : [];

  const paymentConfig = payment?.status ? PAYMENT_STATUS_STYLES[payment.status] : null;

  return (
    <div className="space-y-4">
      {/* Payment Snapshot */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">{tr('الدفع', 'Payment')}</h2>

        {payment ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-background p-3">
              <div className="text-xs text-muted-foreground">{tr('الحالة', 'Status')}</div>
              <div className="mt-1">
                <span className={`text-sm px-2 py-0.5 rounded-full ${paymentConfig?.style || 'bg-slate-100'}`}>
                  {payment.status === 'PAID'
                    ? tr('مدفوع', 'Paid')
                    : payment.status === 'PENDING'
                    ? tr('معلّق', 'Pending')
                    : payment.status === 'SKIPPED'
                    ? tr('تم التخطي', 'Skipped')
                    : payment.status}
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <div className="text-xs text-muted-foreground">{tr('المبلغ', 'Amount')}</div>
              <div className="font-semibold text-foreground mt-1">
                {payment.amount != null ? `${payment.amount} SAR` : '\u2014'}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <div className="text-xs text-muted-foreground">{tr('طريقة الدفع', 'Payment method')}</div>
              <div className="text-sm text-foreground mt-1">
                {payment.method
                  ? payment.method === 'CASH'
                    ? tr('نقدي', 'Cash')
                    : payment.method === 'CARD'
                    ? tr('بطاقة', 'Card')
                    : payment.method === 'ONLINE'
                    ? tr('إلكتروني', 'Online')
                    : payment.method
                  : '\u2014'}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <div className="text-xs text-muted-foreground">{tr('نوع الخدمة', 'Service type')}</div>
              <div className="text-sm text-foreground mt-1">
                {payment.serviceType === 'CONSULTATION' ? tr('استشارة', 'Consultation') : payment.serviceType === 'FOLLOW_UP' ? tr('متابعة', 'Follow-up') : payment.serviceType || '\u2014'}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">{tr('لا يوجد معلومات دفع', 'No payment information')}</div>
        )}

        {payment?.paidAt && (
          <div className="text-xs text-muted-foreground mt-3">
            {tr('تاريخ الدفع', 'Paid at')}: {new Date(payment.paidAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-GB', { timeZone: 'Asia/Riyadh' })}
          </div>
        )}
      </div>

      {/* Billing Meta */}
      {billingMeta && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">{tr('تفاصيل الفاتورة', 'Billing details')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {billingMeta.visitType && (
              <div>
                <span className="text-muted-foreground">{tr('نوع الزيارة', 'Visit type')}: </span>
                <span className="text-foreground">{billingMeta.visitType}</span>
              </div>
            )}
            {billingMeta.serviceCode && (
              <div>
                <span className="text-muted-foreground">{tr('كود الخدمة', 'Service code')}: </span>
                <span className="text-foreground">{billingMeta.serviceCode}</span>
              </div>
            )}
            {billingMeta.serviceName && (
              <div>
                <span className="text-muted-foreground">{tr('الخدمة', 'Service')}: </span>
                <span className="text-foreground">{billingMeta.serviceName}</span>
              </div>
            )}
            {billingMeta.price != null && (
              <div>
                <span className="text-muted-foreground">{tr('السعر', 'Price')}: </span>
                <span className="text-foreground">{billingMeta.price} SAR</span>
              </div>
            )}
            {billingMeta.isFree && (
              <div>
                <span className="text-emerald-700 font-medium">{tr('مجاني', 'Free')}</span>
                {billingMeta.reason && <span className="text-muted-foreground"> ({billingMeta.reason})</span>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Charge Summary */}
      {chargeSummary && !chargeSummary.error && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">{tr('ملخص الرسوم', 'Charge summary')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-background p-3">
              <div className="text-xs text-muted-foreground">{tr('الإجمالي', 'Gross')}</div>
              <div className="font-semibold text-foreground mt-1">
                {chargeSummary.totalGross != null ? `${chargeSummary.totalGross} SAR` : '\u2014'}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <div className="text-xs text-muted-foreground">{tr('الخصم', 'Discount')}</div>
              <div className="font-semibold text-foreground mt-1">
                {chargeSummary.totalDiscount != null ? `${chargeSummary.totalDiscount} SAR` : '\u2014'}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <div className="text-xs text-muted-foreground">{tr('الصافي', 'Net')}</div>
              <div className="font-semibold text-emerald-700 mt-1">
                {chargeSummary.totalNet != null ? `${chargeSummary.totalNet} SAR` : '\u2014'}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <div className="text-xs text-muted-foreground">{tr('عدد البنود', 'Items count')}</div>
              <div className="font-semibold text-foreground mt-1">
                {chargeSummary.counts?.active ?? chargeSummary.counts?.total ?? '\u2014'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charge Events */}
      {events.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">{tr('بنود الرسوم', 'Charge items')}</h3>
          <div className="space-y-2">
            {events.map((event: any) => (
              <div
                key={event.id}
                className={`rounded-xl border border-border p-3 flex items-center justify-between text-sm ${
                  event.status === 'VOID' ? 'opacity-50 line-through' : ''
                }`}
              >
                <div>
                  <div className="font-medium text-foreground">
                    {event.serviceName || event.description || event.chargeCode || tr('رسم', 'Charge')}
                  </div>
                  {event.departmentKey && (
                    <div className="text-xs text-muted-foreground">{event.departmentKey}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-medium text-foreground">
                    {event.amount != null ? `${event.amount} SAR` : '\u2014'}
                  </div>
                  <div className={`text-xs ${event.status === 'VOID' ? 'text-red-500' : 'text-emerald-600'}`}>
                    {event.status === 'VOID' ? tr('ملغي', 'Voided') : tr('فعال', 'Active')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no billing data at all */}
      {!payment && !billingMeta && events.length === 0 && (!chargeSummary || chargeSummary.error) && (
        <div className="bg-card rounded-2xl border border-border p-6 text-center">
          <div className="text-sm text-muted-foreground">{tr('لا يوجد بيانات فوترة لهذه الزيارة', 'No billing data for this visit')}</div>
        </div>
      )}
    </div>
  );
}
