'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function ChargeEvents() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading } = useRoutePermission('/billing/charge-events');

  const [encounterCoreId, setEncounterCoreId] = useState('');
  const [includeVoided, setIncludeVoided] = useState(false);

  const query = encounterCoreId.trim()
    ? `/api/billing/charge-events?encounterCoreId=${encodeURIComponent(encounterCoreId.trim())}${
        includeVoided ? '&includeVoided=1' : ''
      }`
    : null;

  const { data } = useSWR(hasPermission && query ? query : null, fetcher, { refreshInterval: 0 });
  const items = Array.isArray(data?.items) ? data.items : [];

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{tr('أحداث الرسوم', 'Charge Events')}</h2>
          <p className="text-sm text-muted-foreground">{tr('التقاط تشغيلي فقط — بدون فواتير.', 'Operational capture only — no invoices.')}</p>
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

          {query ? (
            <div className="overflow-x-auto">
              <div className="min-w-[1000px]">
              {/* Header */}
              <div className="grid grid-cols-9 gap-4 px-4 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الرمز', 'Code')}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('القسم', 'Department')}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الكمية', 'Qty')}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوحدة', 'Unit')}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الإجمالي', 'Total')}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الدافع', 'Payer')}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التاريخ', 'Created')}</span>
              </div>
              {/* Body */}
              {items.length ? (
                items.map((item: any) => (
                  <div key={item.id} className="grid grid-cols-9 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                    <span className="text-sm text-foreground">{item.code}</span>
                    <span className="text-sm text-foreground">{item.name}</span>
                    <span className="text-sm text-foreground">{item.departmentKey}</span>
                    <span className="text-sm text-foreground">{item.quantity}</span>
                    <span className="text-sm text-foreground">{item.unitPrice}</span>
                    <span className="text-sm text-foreground">{item.totalPrice}</span>
                    <span className="text-sm text-foreground">{item.payerType}</span>
                    <span className="text-sm text-foreground">
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{item.status}</span>
                    </span>
                    <span className="text-sm text-foreground text-xs">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="grid grid-cols-9 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                  <span className="col-span-9 text-sm text-muted-foreground">
                    {tr('لا توجد أحداث رسوم.', 'No charge events found.')}
                  </span>
                </div>
              )}
            </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">{tr('أدخل معرف الزيارة لعرض أحداث الرسوم.', 'Enter an encounterCoreId to view charge events.')}</div>
          )}
        </div>
      </div>
    </div>
  );
}
