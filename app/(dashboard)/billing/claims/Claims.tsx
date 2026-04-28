'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function Claims() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { hasPermission, isLoading } = useRoutePermission('/billing/claims');

  const [encounterCoreId, setEncounterCoreId] = useState('');
  const [includeVoided, setIncludeVoided] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string>('');
  const [rejectReasonCode, setRejectReasonCode] = useState<string>('MISSING_INFO');
  const [rejectReasonText, setRejectReasonText] = useState('');
  const [remitAmount, setRemitAmount] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const eligibilityUrl = encounterCoreId.trim()
    ? `/api/billing/eligibility?encounterCoreId=${encodeURIComponent(encounterCoreId.trim())}`
    : null;
  const claimUrl = encounterCoreId.trim()
    ? `/api/billing/claim-draft?encounterCoreId=${encodeURIComponent(encounterCoreId.trim())}${
        includeVoided ? '&includeVoided=1' : ''
      }`
    : null;

  const { data: eligibilityData } = useSWR(hasPermission && eligibilityUrl ? eligibilityUrl : null, fetcher, {
    refreshInterval: 0,
  });
  const { data: claimData } = useSWR(hasPermission && claimUrl ? claimUrl : null, fetcher, { refreshInterval: 0 });
  const { data: claimsData, mutate: mutateClaims } = useSWR(
    hasPermission ? '/api/billing/claims' : null,
    fetcher,
    { refreshInterval: 0 }
  );

  const lineItems = Array.isArray(claimData?.lineItems) ? claimData.lineItems : [];
  const totals = claimData?.totals || null;
  const breakdown = claimData?.breakdown || null;
  const claimItems = Array.isArray(claimsData?.items) ? claimsData.items : [];
  const selectedClaim = claimItems.find((item: any) => item.id === selectedClaimId) || null;

  const createClaimDraft = async () => {
    if (!encounterCoreId.trim()) return;
    setActionBusy(true);
    try {
      const res = await fetch('/api/billing/claims', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterCoreId: encounterCoreId.trim() }),
      });
      await res.json().catch(() => ({}));
      await mutateClaims();
    } finally {
      setActionBusy(false);
    }
  };

  const submitClaim = async () => {
    if (!selectedClaimId) return;
    setActionBusy(true);
    try {
      await fetch(`/api/billing/claims/${encodeURIComponent(selectedClaimId)}/submit`, { credentials: 'include', method: 'POST' });
      await mutateClaims();
    } finally {
      setActionBusy(false);
    }
  };

  const rejectClaim = async () => {
    if (!selectedClaimId) return;
    setActionBusy(true);
    try {
      await fetch(`/api/billing/claims/${encodeURIComponent(selectedClaimId)}/reject`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasonCode: rejectReasonCode, reasonText: rejectReasonText.trim() }),
      });
      await mutateClaims();
    } finally {
      setActionBusy(false);
    }
  };

  const resubmitClaim = async () => {
    if (!selectedClaimId) return;
    setActionBusy(true);
    try {
      await fetch(`/api/billing/claims/${encodeURIComponent(selectedClaimId)}/resubmit`, { credentials: 'include', method: 'POST' });
      await mutateClaims();
    } finally {
      setActionBusy(false);
    }
  };

  const remitClaim = async () => {
    if (!selectedClaimId) return;
    setActionBusy(true);
    try {
      await fetch(`/api/billing/claims/${encodeURIComponent(selectedClaimId)}/remit`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paidAmount: Number(remitAmount || 0) }),
      });
      await mutateClaims();
    } finally {
      setActionBusy(false);
    }
  };

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-4">
      {/* Claims Tools Card */}
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{tr('أدوات المطالبات', 'Claims Tools')}</h2>
          <p className="text-sm text-muted-foreground">{tr('أهلية للقراءة فقط + مسودة مطالبة.', 'Read-only eligibility + claim draft.')}</p>
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
          {encounterCoreId.trim() ? (
            <div className="flex gap-2">
              <Button asChild variant="outline" className="rounded-xl">
                <Link href={`/billing/statement?encounterCoreId=${encodeURIComponent(encounterCoreId.trim())}`}>
                  {tr('فتح الكشف', 'Open Statement')}
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href={`/billing/invoice-draft?encounterCoreId=${encodeURIComponent(encounterCoreId.trim())}`}>
                  {tr('فتح مسودة الفاتورة', 'Open Invoice Draft')}
                </Link>
              </Button>
              <Button className="rounded-xl" variant="outline" onClick={createClaimDraft} disabled={actionBusy}>
                {tr('إنشاء مسودة مطالبة', 'Create Claim Draft')}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {!encounterCoreId.trim() ? (
        <div className="text-sm text-muted-foreground">{tr('أدخل معرف الزيارة لعرض الأهلية ومسودة المطالبة.', 'Enter an encounterCoreId to view eligibility and claim draft.')}</div>
      ) : (
        <>
          {/* Eligibility Card */}
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{tr('الأهلية', 'Eligibility')}</h2>
              <p className="text-sm text-muted-foreground">{tr('محلي (بدون استدعاءات خارجية).', 'Local stub (no external calls).')}</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{tr('الحالة', 'Status')}</span>
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{eligibilityData?.eligibilityStatus || 'UNKNOWN'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">{tr('الدافع', 'Payer')}</span>
                <span>{eligibilityData?.payerContext?.insuranceCompanyName || eligibilityData?.payerContext?.insuranceCompanyId || '—'}</span>
              </div>
              {eligibilityData?.warnings?.length ? (
                <div className="text-xs text-muted-foreground">{tr('تحذيرات:', 'Warnings:')} {eligibilityData.warnings.join(', ')}</div>
              ) : null}
              <div className="pt-2">
                <div className="font-medium">{tr('ملخص المنافع', 'Benefits Summary')}</div>
                {eligibilityData?.benefitsSummary?.length ? (
                  <ul className="list-disc pl-4 text-xs text-muted-foreground">
                    {eligibilityData.benefitsSummary.map((item: string, idx: number) => (
                      <li key={`${item}-${idx}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-muted-foreground">{tr('لم يتم العثور على ملاحظات البوليصة.', 'No policy notes found.')}</div>
                )}
              </div>
            </div>
          </div>

          {/* Claim Draft Card */}
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{tr('مسودة المطالبة', 'Claim Draft')}</h2>
              <p className="text-sm text-muted-foreground">{tr('معاينة للقراءة فقط.', 'Read-only preview.')}</p>
            </div>
            <div className="space-y-3">
              <div className="text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{tr('رقم المطالبة', 'Claim Number')}</span>
                  <span>{claimData?.claimNumber || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{tr('المريض', 'Patient')}</span>
                  <span>{claimData?.patient?.name || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{tr('القسم', 'Department')}</span>
                  <span>{claimData?.provider?.department || 'UNKNOWN'}</span>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="font-medium">{tr('الإجماليات', 'Totals')}</div>
                <div className="flex items-center justify-between">
                  <span>{tr('الإجمالي الكلي', 'Grand Total')}</span>
                  <span>{totals?.grandTotalActive ?? '—'}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Active: {totals?.counts?.active ?? 0} • Voided: {totals?.counts?.voided ?? 0}
                </div>
              </div>
              <div className="space-y-2 text-sm">
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
              <div className="space-y-2 text-sm">
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
              {/* Table 1: Claim Draft Line Items (7 cols) */}
              <div className="pt-2 space-y-1 overflow-x-auto">
                <div className="min-w-[800px]">
                <div className="grid grid-cols-7 gap-4 px-4 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الرمز', 'Code')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('القسم', 'Dept')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الكمية', 'Qty')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السعر', 'Unit')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الإجمالي', 'Total')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                </div>
                {lineItems.length ? (
                  lineItems.map((item: any) => (
                    <div key={item.chargeEventId} className="grid grid-cols-7 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                      <span className="text-sm text-foreground">{item.code}</span>
                      <span className="text-sm text-foreground">{item.name}</span>
                      <span className="text-sm text-foreground">{item.department}</span>
                      <span className="text-sm text-foreground">{item.qty}</span>
                      <span className="text-sm text-foreground">{item.unitPrice}</span>
                      <span className="text-sm text-foreground">{item.total}</span>
                      <span className="text-sm text-foreground">
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{item.status}</span>
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="grid grid-cols-7 gap-4 px-4 py-3">
                    <span className="col-span-7 text-sm text-muted-foreground">{tr('لم يتم العثور على بنود.', 'No line items found.')}</span>
                  </div>
                )}
              </div>
              </div>
            </div>
          </div>

          {/* Claims Lifecycle Card */}
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{tr('دورة حياة المطالبات', 'Claims Lifecycle')}</h2>
              <p className="text-sm text-muted-foreground">{tr('مسودة ← تقديم ← رفض ← إعادة تقديم ← مدفوع.', 'Draft \u2192 Submit \u2192 Reject \u2192 Resubmit \u2192 Paid.')}</p>
            </div>
            <div className="space-y-4">
              {/* Table 2: Claims Lifecycle (5 cols) */}
              <div className="space-y-1 overflow-x-auto">
                <div className="min-w-[700px]">
                <div className="grid grid-cols-5 gap-4 px-4 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المطالبة', 'Claim')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المريض', 'Patient')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الإصدار', 'Version')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الإجمالي', 'Total')}</span>
                </div>
                {claimItems.length ? (
                  claimItems.map((item: any) => (
                    <div key={item.id} onClick={() => setSelectedClaimId(item.id)} className="grid grid-cols-5 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast cursor-pointer">
                      <span className="text-sm text-foreground text-xs">{item.claimNumber || item.id?.slice(0, 8)}</span>
                      <span className="text-sm text-foreground">{item.patientName || 'Unknown'}</span>
                      <span className="text-sm text-foreground">
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{item.status}</span>
                      </span>
                      <span className="text-sm text-foreground">{item.version || 1}</span>
                      <span className="text-sm text-foreground">{item.totals?.grandTotalActive ?? '—'}</span>
                    </div>
                  ))
                ) : (
                  <div className="grid grid-cols-5 gap-4 px-4 py-3">
                    <span className="col-span-5 text-sm text-muted-foreground">{tr('لم يتم إنشاء مطالبات بعد.', 'No claims created yet.')}</span>
                  </div>
                )}
              </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المطالبة المحددة', 'Selected Claim')}</span>
                  <Select value={selectedClaimId} onValueChange={setSelectedClaimId}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder={tr('اختر مطالبة', 'Select claim')} />
                    </SelectTrigger>
                    <SelectContent>
                      {claimItems.map((item: any) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.claimNumber || item.id?.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground">
                    {tr('الحالة:', 'Status:')} {selectedClaim?.status || '—'}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('سبب الرفض', 'Reject Reason')}</span>
                  <Select value={rejectReasonCode} onValueChange={setRejectReasonCode}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder={tr('اختر السبب', 'Select reason')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MISSING_INFO">{tr('معلومات ناقصة', 'Missing info')}</SelectItem>
                      <SelectItem value="CODING_ERROR">{tr('خطأ في الترميز', 'Coding error')}</SelectItem>
                      <SelectItem value="ELIGIBILITY">{tr('الأهلية', 'Eligibility')}</SelectItem>
                      <SelectItem value="DUPLICATE">{tr('مكرر', 'Duplicate')}</SelectItem>
                      <SelectItem value="OTHER">{tr('أخرى', 'Other')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    className="rounded-xl thea-input-focus"
                    value={rejectReasonText}
                    onChange={(e) => setRejectReasonText(e.target.value)}
                    placeholder={tr('تفاصيل السبب', 'Reason details')}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('مبلغ التحويل', 'Remittance Amount')}</span>
                  <Input
                    className="rounded-xl thea-input-focus"
                    value={remitAmount}
                    onChange={(e) => setRemitAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button className="rounded-xl" onClick={submitClaim} disabled={actionBusy || selectedClaim?.status !== 'DRAFT'}>
                  {tr('تقديم', 'Submit')}
                </Button>
                <Button
                  className="rounded-xl"
                  variant="outline"
                  onClick={rejectClaim}
                  disabled={actionBusy || selectedClaim?.status !== 'SUBMITTED'}
                >
                  {tr('رفض', 'Reject')}
                </Button>
                <Button
                  className="rounded-xl"
                  variant="outline"
                  onClick={resubmitClaim}
                  disabled={actionBusy || selectedClaim?.status !== 'REJECTED'}
                >
                  {tr('إعادة تقديم', 'Resubmit')}
                </Button>
                <Button
                  className="rounded-xl"
                  variant="outline"
                  onClick={remitClaim}
                  disabled={actionBusy || selectedClaim?.status !== 'RESUBMITTED'}
                >
                  {tr('تحديد كمدفوع', 'Mark Paid')}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
