'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { safeUUID } from '@/lib/utils/uuid';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function Statement() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { hasPermission, isLoading } = useRoutePermission('/billing/statement');

  const [encounterCoreId, setEncounterCoreId] = useState('');
  const [includeVoided, setIncludeVoided] = useState(false);

  const statementUrl = encounterCoreId.trim()
    ? `/api/billing/statement?encounterCoreId=${encodeURIComponent(encounterCoreId.trim())}${
        includeVoided ? '&includeVoided=1' : ''
      }`
    : null;
  const ledgerUrl = encounterCoreId.trim()
    ? `/api/billing/ledger?encounterCoreId=${encodeURIComponent(encounterCoreId.trim())}${
        includeVoided ? '&includeVoided=1' : ''
      }`
    : null;
  const lockUrl = encounterCoreId.trim()
    ? `/api/billing/lock?encounterCoreId=${encodeURIComponent(encounterCoreId.trim())}`
    : null;
  const readinessUrl = encounterCoreId.trim()
    ? `/api/billing/readiness?encounterCoreId=${encodeURIComponent(encounterCoreId.trim())}`
    : null;
  const postingUrl = encounterCoreId.trim()
    ? `/api/billing/posting?encounterCoreId=${encodeURIComponent(encounterCoreId.trim())}`
    : null;

  const { data: statementData } = useSWR(hasPermission && statementUrl ? statementUrl : null, fetcher, {
    refreshInterval: 0,
  });
  const { data: ledgerData } = useSWR(hasPermission && ledgerUrl ? ledgerUrl : null, fetcher, { refreshInterval: 0 });
  const { data: lockData } = useSWR(hasPermission && lockUrl ? lockUrl : null, fetcher, { refreshInterval: 0 });
  const { data: readinessData } = useSWR(hasPermission && readinessUrl ? readinessUrl : null, fetcher, { refreshInterval: 0 });
  const { data: postingData, mutate: mutatePosting } = useSWR(
    hasPermission && postingUrl ? postingUrl : null,
    fetcher,
    { refreshInterval: 0 }
  );

  const lineItems = Array.isArray(statementData?.lineItems) ? statementData.lineItems : [];
  const totals = statementData?.totals || null;
  const breakdown = statementData?.breakdown || null;
  const ledgerEntries = Array.isArray(ledgerData?.entries) ? ledgerData.entries : [];
  const payerContext = statementData?.payerContext || null;
  const billingLock = lockData?.lock || null;
  const readiness = readinessData || null;
  const billingPosting = postingData?.posting || null;

  const [postingBusy, setPostingBusy] = useState(false);

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
      // ignore toast here for read-only page
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
      // ignore toast here for read-only page
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
          <h2 className="text-lg font-semibold text-foreground">{tr('كشف الزيارة', 'Encounter Statement')}</h2>
          <p className="text-sm text-muted-foreground">{tr('عرض دفتر الأستاذ المالي للقراءة فقط.', 'Read-only financial ledger view.')}</p>
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
          {statementData?.patientMasterId ? (
            <div className="flex gap-2">
              <Button asChild variant="outline" className="rounded-xl">
                <Link href={`/patient/${statementData.patientMasterId}`}>{tr('فتح ملف المريض', 'Open Patient Profile')}</Link>
              </Button>
            </div>
          ) : null}

          {!statementUrl ? (
            <div className="text-sm text-muted-foreground">{tr('أدخل معرف الزيارة لعرض الكشف.', 'Enter an encounterCoreId to view statement.')}</div>
          ) : (
            <Tabs defaultValue="statement">
              <TabsList>
                <TabsTrigger value="statement">{tr('الكشف', 'Statement')}</TabsTrigger>
                <TabsTrigger value="ledger">{tr('دفتر الأستاذ', 'Ledger')}</TabsTrigger>
              </TabsList>

              <TabsContent value="statement">
                <div className="space-y-4">
                  {/* Billing Status */}
                  <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-foreground">{tr('حالة الفوترة', 'Billing Status')}</h2>
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
                    <h2 className="text-lg font-semibold text-foreground">{tr('ترحيل الفوترة', 'Billing Posting')}</h2>
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

                  {/* Payer Context */}
                  <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-foreground">{tr('سياق الدافع', 'Payer Context')}</h2>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{tr('الوضع', 'Mode')}</span>
                        <span>{payerContext?.mode || '—'}</span>
                      </div>
                      {payerContext?.mode === 'INSURANCE' ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span>{tr('الشركة', 'Company')}</span>
                            <span>{payerContext.insuranceCompanyName || payerContext.insuranceCompanyId || '—'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>{tr('العضو/البوليصة', 'Member/Policy')}</span>
                            <span>{payerContext.memberOrPolicyRef || '—'}</span>
                          </div>
                        </>
                      ) : null}
                      {payerContext?.notes ? (
                        <div className="text-xs text-muted-foreground">{tr('ملاحظات:', 'Notes:')} {payerContext.notes}</div>
                      ) : null}
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-foreground">{tr('الإجماليات', 'Totals')}</h2>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{tr('الإجمالي الكلي', 'Grand Total')}</span>
                        <span>{totals?.grandTotalActive ?? '—'}</span>
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

                  {/* Line Items */}
                  <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-foreground">{tr('البنود', 'Line Items')}</h2>
                    <div className="overflow-x-auto">
                      <div className="min-w-[900px]">
                      {/* Header */}
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
                      {/* Rows */}
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
                            <span className="text-sm text-foreground text-xs">
                              {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
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
              </TabsContent>

              <TabsContent value="ledger">
                <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">{tr('دفتر الأستاذ', 'Ledger')}</h2>
                  <div className="space-y-2 text-sm">
                    {ledgerEntries.length ? (
                      ledgerEntries.map((entry: any) => (
                        <div key={`${entry.refId}-${entry.type}-${entry.ts}`} className="flex items-center justify-between border border-border rounded-xl p-3">
                          <div>
                            <div className="font-medium">{entry.type}</div>
                            <div className="text-xs text-muted-foreground">
                              {entry.ts ? new Date(entry.ts).toLocaleString() : '—'} • {entry.metadata?.code || '—'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div>{entry.amountDelta}</div>
                            <div className="text-xs text-muted-foreground">{tr('الرصيد', 'Balance')} {entry.runningBalance}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">{tr('لم يتم العثور على قيود.', 'No ledger entries found.')}</div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
