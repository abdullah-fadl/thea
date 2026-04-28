'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useConfirm } from '@/components/ui/confirm-modal';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function Payments() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { hasPermission, isLoading } = useRoutePermission('/billing/payments');
  const { hasPermission: canRecord } = useRoutePermission('/billing/payments');
  const { hasPermission: canVoid } = useRoutePermission('/billing/payments');
  const { prompt: showPrompt } = useConfirm();

  const [encounterCoreId, setEncounterCoreId] = useState('');
  const [includeVoided, setIncludeVoided] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'BANK_TRANSFER' | 'INSURANCE_COPAY'>('CASH');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCurrency, setPaymentCurrency] = useState('SAR');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);

  const paymentsUrl = encounterCoreId.trim()
    ? `/api/billing/payments?encounterCoreId=${encodeURIComponent(encounterCoreId.trim())}${
        includeVoided ? '&includeVoided=1' : ''
      }`
    : null;
  const balanceUrl = encounterCoreId.trim()
    ? `/api/billing/balance?encounterCoreId=${encodeURIComponent(encounterCoreId.trim())}`
    : null;

  const { data: paymentsData, mutate: mutatePayments } = useSWR(hasPermission && paymentsUrl ? paymentsUrl : null, fetcher, {
    refreshInterval: 0,
  });
  const { data: balanceData, mutate: mutateBalance } = useSWR(hasPermission && balanceUrl ? balanceUrl : null, fetcher, {
    refreshInterval: 0,
  });

  const payments = Array.isArray(paymentsData?.items) ? paymentsData.items : [];
  const balance = balanceData || null;

  const recordPayment = async () => {
    setPaymentBusy(true);
    try {
      const key =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const res = await fetch('/api/billing/payments/record', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterCoreId,
          method: paymentMethod,
          amount: Number(paymentAmount),
          currency: paymentCurrency.trim(),
          reference: paymentReference.trim() || undefined,
          note: paymentNote.trim() || undefined,
          idempotencyKey: key,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || tr('فشلت العملية', 'Failed'));
      setPaymentDialogOpen(false);
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentNote('');
      await mutatePayments();
      await mutateBalance();
    } catch {
      // read-only page, ignore toast
    } finally {
      setPaymentBusy(false);
    }
  };

  const voidPayment = async (paymentId: string) => {
    const reason = await showPrompt(tr('سبب الإلغاء؟', 'Void reason?'));
    if (!reason) return;
    try {
      const key =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const res = await fetch(`/api/billing/payments/${paymentId}/void`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, idempotencyKey: key }),
      });
      if (!res.ok) return;
      await mutatePayments();
      await mutateBalance();
    } catch {
      // ignore
    }
  };

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{tr('المدفوعات', 'Payments')}</h2>
          <p className="text-sm text-muted-foreground">{tr('المدفوعات اليدوية فقط.', 'Manual payments only.')}</p>
        </div>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1 md:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('معرف الزيارة', 'EncounterCoreId')}</span>
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
                {tr('تضمين الملغاة', 'Include voided')}
              </label>
            </div>
          </div>

          {!paymentsUrl ? (
            <div className="text-sm text-muted-foreground">{tr('أدخل معرف الزيارة لعرض المدفوعات.', 'Enter an encounterCoreId to view payments.')}</div>
          ) : (
            <Tabs defaultValue="payments">
              <TabsList>
                <TabsTrigger value="payments">{tr('المدفوعات', 'Payments')}</TabsTrigger>
                <TabsTrigger value="balance">{tr('الرصيد', 'Balance')}</TabsTrigger>
              </TabsList>

              <TabsContent value="payments">
                <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{tr('المدفوعات', 'Payments')}</h2>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      {canRecord ? (
                        <Button className="rounded-xl" size="sm" variant="outline" onClick={() => setPaymentDialogOpen(true)}>
                          {tr('تسجيل دفعة', 'Record Payment')}
                        </Button>
                      ) : null}
                    </div>
                    {/* Table header */}
                    <div className="overflow-x-auto">
                    <div className="min-w-[700px]">
                    <div className="grid grid-cols-6 gap-4 px-4 py-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الطريقة', 'Method')}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المبلغ', 'Amount')}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التاريخ', 'Created')}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المرجع', 'Reference')}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('إجراء', 'Action')}</span>
                    </div>
                    {/* Table body */}
                    {payments.length ? (
                      payments.map((item: any) => (
                        <div
                          key={item.id || item.paymentId}
                          className="grid grid-cols-6 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast"
                        >
                          <span className="text-sm text-foreground">{item.method}</span>
                          <span className="text-sm text-foreground">
                            {item.amount} {item.currency}
                          </span>
                          <span className="text-sm text-foreground">
                            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                              {item.status}
                            </span>
                          </span>
                          <span className="text-sm text-foreground text-xs">
                            {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
                          </span>
                          <span className="text-sm text-foreground">{item.reference || '—'}</span>
                          <span className="text-sm text-foreground">
                            {canVoid && (item.status === 'RECORDED' || item.status === 'COMPLETED') ? (
                              <Button className="rounded-xl" size="sm" variant="outline" onClick={() => voidPayment(item.id || item.paymentId)}>
                                {tr('إلغاء', 'Void')}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="grid grid-cols-6 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                        <span className="text-sm text-muted-foreground col-span-6">
                          {tr('لم يتم تسجيل مدفوعات.', 'No payments recorded.')}
                        </span>
                      </div>
                    )}
                  </div>
                  </div>
                </div>
                </div>
              </TabsContent>

              <TabsContent value="balance">
                <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{tr('الرصيد', 'Balance')}</h2>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{tr('الإجمالي', 'Total')}</span>
                      <span>{balance?.grandTotalActive ?? '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{tr('المدفوع', 'Paid')}</span>
                      <span>{balance?.paidRecorded ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{tr('الرصيد', 'Balance')}</span>
                      <span>{balance?.balance ?? 0}</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('تسجيل دفعة', 'Record Payment')}</DialogTitle>
            <DialogDescription>{tr('تسجيل يدوي/غير متصل فقط.', 'Manual/offline capture only.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الطريقة', 'Method')}</span>
              <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'INSURANCE_COPAY')}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={tr('الطريقة', 'Method')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">{tr('نقدي', 'Cash')}</SelectItem>
                  <SelectItem value="CARD">{tr('بطاقة', 'Card')}</SelectItem>
                  <SelectItem value="BANK_TRANSFER">{tr('تحويل بنكي', 'Bank Transfer')}</SelectItem>
                  <SelectItem value="INSURANCE_COPAY">{tr('مشاركة تأمين', 'Insurance Copay')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المبلغ', 'Amount')}</span>
                <Input className="rounded-xl thea-input-focus" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('العملة', 'Currency')}</span>
                <Input className="rounded-xl thea-input-focus" value={paymentCurrency} onChange={(e) => setPaymentCurrency(e.target.value)} placeholder="SAR" />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المرجع', 'Reference')}</span>
              <Input className="rounded-xl thea-input-focus" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder={tr('اختياري', 'Optional')} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ملاحظة', 'Note')}</span>
              <Textarea className="rounded-xl thea-input-focus" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button className="rounded-xl" variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button className="rounded-xl" onClick={recordPayment} disabled={paymentBusy}>
                {paymentBusy ? tr('جاري الحفظ...', 'Saving...') : tr('تسجيل', 'Record')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
