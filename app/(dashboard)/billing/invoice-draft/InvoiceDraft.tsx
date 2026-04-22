'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { safeUUID } from '@/lib/utils/uuid';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import CreditNoteDialog from '@/components/billing/CreditNoteDialog';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function InvoiceDraft() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { hasPermission, isLoading } = useRoutePermission('/billing/invoice-draft');

  const [encounterCoreId, setEncounterCoreId] = useState('');
  const [includeVoided, setIncludeVoided] = useState(false);

  const invoiceUrl = encounterCoreId.trim()
    ? `/api/billing/invoice-draft?encounterCoreId=${encodeURIComponent(encounterCoreId.trim())}${
        includeVoided ? '&includeVoided=1' : ''
      }`
    : null;
  const postingUrl = encounterCoreId.trim()
    ? `/api/billing/posting?encounterCoreId=${encodeURIComponent(encounterCoreId.trim())}`
    : null;

  const { data } = useSWR(hasPermission && invoiceUrl ? invoiceUrl : null, fetcher, { refreshInterval: 0 });
  const { data: postingData, mutate: mutatePosting } = useSWR(
    hasPermission && postingUrl ? postingUrl : null,
    fetcher,
    { refreshInterval: 0 }
  );

  const lineItems = Array.isArray(data?.lineItems) ? data.lineItems : [];
  const totals = data?.totals || null;
  const breakdown = data?.breakdown || null;
  const payerContext = data?.payerContext || null;
  const billingLock = data?.billingLock || null;
  const readiness = data?.readiness || null;
  const billingPosting = postingData?.posting || null;
  const [postingBusy, setPostingBusy] = useState(false);
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [creditActionBusy, setCreditActionBusy] = useState<string | null>(null);

  const creditNotesUrl = encounterCoreId.trim()
    ? `/api/billing/credit-notes?encounterCoreId=${encodeURIComponent(encounterCoreId.trim())}`
    : null;
  const { data: creditNotesData, mutate: mutateCreditNotes } = useSWR(
    hasPermission && creditNotesUrl ? creditNotesUrl : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const creditNotes = Array.isArray(creditNotesData?.creditNotes) ? creditNotesData.creditNotes : [];

  const handleCreditNoteAction = async (id: string, action: 'APPROVE' | 'CANCEL') => {
    setCreditActionBusy(id);
    try {
      await fetch(`/api/billing/credit-notes/${id}`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      await mutateCreditNotes();
    } finally {
      setCreditActionBusy(null);
    }
  };

  const postBilling = async () => {
    setPostingBusy(true);
    try {
      const key = safeUUID();
      const res = await fetch('/api/billing/posting/post', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterCoreId, idempotencyKey: key }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed');
      await mutatePosting();
    } catch {
      // ignore
    } finally {
      setPostingBusy(false);
    }
  };

  const unpostBilling = async () => {
    setPostingBusy(true);
    try {
      const key = safeUUID();
      const res = await fetch('/api/billing/posting/unpost', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterCoreId, idempotencyKey: key }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed');
      await mutatePosting();
    } catch {
      // ignore
    } finally {
      setPostingBusy(false);
    }
  };

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{tr('مسودة الفاتورة', 'Invoice Draft')}</h2>
          <p className="text-sm text-muted-foreground">{tr('مسودة للقراءة فقط مشتقة من الرسوم.', 'Read-only draft derived from charges.')}</p>
        </div>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1 md:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">EncounterCoreId</span>
              <Input
                className="rounded-xl thea-input-focus"
                value={encounterCoreId}
                onChange={(e) => setEncounterCoreId(e.target.value)}
                placeholder={tr('أدخل معرف الزيارة', 'Enter encounterCoreId')}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={includeVoided} onCheckedChange={(value) => setIncludeVoided(Boolean(value))} />
                {tr('تضمين الملغي', 'Include voided')}
              </label>
            </div>
          </div>
          {data?.patientMasterId ? (
            <div className="flex gap-2">
              <Button asChild variant="outline" className="rounded-xl">
                <Link href={`/patient/${data.patientMasterId}`}>{tr('فتح ملف المريض', 'Open Patient Profile')}</Link>
              </Button>
            </div>
          ) : null}

          {!invoiceUrl ? (
            <div className="text-sm text-muted-foreground">{tr('أدخل معرف الزيارة لعرض المسودة.', 'Enter an encounterCoreId to view draft.')}</div>
          ) : (
            <div className="space-y-4">
              {/* Invoice Info */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{tr('معلومات الفاتورة', 'Invoice Info')}</h2>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{tr('رقم الفاتورة', 'Invoice Number')}</span>
                    <span>{data?.invoiceNumber || '\u2014'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{tr('الزيارة', 'Encounter')}</span>
                    <span>{data?.encounterCoreId || '\u2014'}</span>
                  </div>
                </div>
              </div>

              {/* Payer Context */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{tr('سياق الدافع', 'Payer Context')}</h2>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{tr('الوضع', 'Mode')}</span>
                    <span>{payerContext?.mode || '\u2014'}</span>
                  </div>
                  {payerContext?.mode === 'INSURANCE' ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span>{tr('الشركة', 'Company')}</span>
                        <span>{payerContext.insuranceCompanyName || payerContext.insuranceCompanyId || '\u2014'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{tr('العضو/البوليصة', 'Member/Policy')}</span>
                        <span>{payerContext.memberOrPolicyRef || '\u2014'}</span>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Billing Status */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{tr('حالة الفوترة', 'Billing Status')}</h2>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{tr('القفل', 'Lock')}</span>
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{billingLock?.isLocked ? 'LOCKED' : 'UNLOCKED'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{tr('الجاهزية', 'Readiness')}</span>
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{readiness?.ready ? 'READY' : 'NOT_READY'}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tr('رسوم نشطة:', 'Active charges:')} {readiness?.metrics?.activeCharges ?? 0} {tr('• ملغية:', '• Voided:')} {readiness?.metrics?.voidedCharges ?? 0}
                  </div>
                  {readiness?.reasons?.length ? (
                    <div className="text-xs text-muted-foreground">{tr('الأسباب:', 'Reasons:')} {readiness.reasons.join(', ')}</div>
                  ) : null}
                </div>
              </div>

              {/* Billing Posting */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{tr('ترحيل الفوترة', 'Billing Posting')}</h2>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{tr('الحالة', 'Status')}</span>
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{billingPosting?.status || 'DRAFT'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      disabled={
                        postingBusy ||
                        billingPosting?.status === 'POSTED' ||
                        !billingLock?.isLocked ||
                        !readiness?.ready
                      }
                      onClick={postBilling}
                    >
                      {tr('ترحيل', 'Post')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      disabled={postingBusy || billingPosting?.status !== 'POSTED'}
                      onClick={unpostBilling}
                    >
                      {tr('إلغاء الترحيل', 'Unpost')}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{tr('الإجماليات', 'Totals')}</h2>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{tr('الإجمالي الكلي', 'Grand Total')}</span>
                    <span>{totals?.grandTotalActive ?? '\u2014'}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tr('نشط:', 'Active:')} {totals?.counts?.active ?? 0} {tr('• ملغي:', '• Voided:')} {totals?.counts?.voided ?? 0}
                  </div>
                  <div className="space-y-2 pt-2">
                    <div className="font-medium">{tr('حسب القسم', 'By Department')}</div>
                    {breakdown?.byDepartment?.length ? (
                      breakdown.byDepartment.map((item: any) => (
                        <div key={item.department} className="flex items-center justify-between">
                          <span>{item.department}</span>
                          <span>{item.total}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-muted-foreground">{tr('لا توجد رسوم نشطة.', 'No active charges.')}</div>
                    )}
                  </div>
                  <div className="space-y-2 pt-2">
                    <div className="font-medium">{tr('حسب نوع الأوردر', 'By Order Kind')}</div>
                    {breakdown?.byOrderKind?.length ? (
                      breakdown.byOrderKind.map((item: any) => (
                        <div key={item.kind} className="flex items-center justify-between">
                          <span>{item.kind}</span>
                          <span>{item.total}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-muted-foreground">{tr('لا توجد رسوم نشطة.', 'No active charges.')}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Credit Notes */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">{tr('إشعارات الائتمان', 'Credit Notes')}</h2>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setShowCreditDialog(true)}
                  >
                    {tr('+ إصدار إشعار ائتمان', '+ Issue Credit Note')}
                  </Button>
                </div>
                {creditNotes.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{tr('لم يتم إصدار إشعارات ائتمان.', 'No credit notes issued.')}</div>
                ) : (
                  <div className="space-y-2">
                    {creditNotes.map((cn: any) => (
                      <div key={cn.id} className="rounded-xl border border-border px-4 py-3 flex items-center justify-between gap-4 text-sm">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{cn.type}</span>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              cn.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                              cn.status === 'APPLIED' ? 'bg-blue-100 text-blue-700' :
                              cn.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                              'bg-muted text-muted-foreground'
                            }`}>{cn.status}</span>
                          </div>
                          <div className="text-muted-foreground text-xs mt-1 truncate">{cn.reason}</div>
                        </div>
                        <div className="font-semibold whitespace-nowrap">SAR {cn.amount?.toFixed(2)}</div>
                        {cn.status === 'DRAFT' && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl h-7 text-xs"
                              disabled={creditActionBusy === cn.id}
                              onClick={() => handleCreditNoteAction(cn.id, 'APPROVE')}
                            >
                              {tr('موافقة', 'Approve')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl h-7 text-xs text-destructive"
                              disabled={creditActionBusy === cn.id}
                              onClick={() => handleCreditNoteAction(cn.id, 'CANCEL')}
                            >
                              {tr('إلغاء', 'Cancel')}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Line Items */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{tr('البنود', 'Line Items')}</h2>
                </div>
                <div className="overflow-x-auto">
                  <div className="min-w-[900px]">
                  {/* Table Header */}
                  <div className="grid grid-cols-8 gap-4 px-4 py-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الرمز', 'Code')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('القسم', 'Dept')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الكمية', 'Qty')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السعر', 'Unit')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الإجمالي', 'Total')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الإنشاء', 'Created')}</span>
                  </div>
                  {/* Table Body */}
                  {lineItems.length ? (
                    lineItems.map((item: any) => (
                      <div key={item.chargeEventId} className="grid grid-cols-8 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                        <span className="text-sm text-foreground">{item.code}</span>
                        <span className="text-sm text-foreground">{item.name}</span>
                        <span className="text-sm text-foreground">{item.department}</span>
                        <span className="text-sm text-foreground">{item.qty}</span>
                        <span className="text-sm text-foreground">{item.unitPrice}</span>
                        <span className="text-sm text-foreground">{item.total}</span>
                        <span className="text-sm text-foreground">
                          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{item.status}</span>
                        </span>
                        <span className="text-xs text-foreground">
                          {item.createdAt ? new Date(item.createdAt).toLocaleString() : '\u2014'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="grid grid-cols-8 gap-4 px-4 py-3 rounded-xl">
                      <span className="col-span-8 text-sm text-muted-foreground">
                        {tr('لم يتم العثور على بنود.', 'No line items found.')}
                      </span>
                    </div>
                  )}
                </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {showCreditDialog && encounterCoreId.trim() && (
        <CreditNoteDialog
          encounterCoreId={encounterCoreId.trim()}
          onClose={() => setShowCreditDialog(false)}
          onSuccess={() => mutateCreditNotes()}
        />
      )}
    </div>
  );
}
