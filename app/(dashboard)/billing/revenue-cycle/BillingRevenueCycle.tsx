'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type DatePreset = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (preset) {
    case 'this_month': {
      const start = new Date(y, m, 1);
      return { from: start.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
    }
    case 'last_month': {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] };
    }
    case 'this_quarter': {
      const qStart = new Date(y, Math.floor(m / 3) * 3, 1);
      return { from: qStart.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
    }
    case 'this_year': {
      const start = new Date(y, 0, 1);
      return { from: start.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
    }
    default:
      return { from: '', to: '' };
  }
}

function formatSAR(value: number): string {
  return `SAR ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function BillingRevenueCycle() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading: permLoading } = useRoutePermission('/billing/revenue-cycle');

  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const dateRange = useMemo(() => {
    if (preset === 'custom') return { from: customFrom, to: customTo };
    return getDateRange(preset);
  }, [preset, customFrom, customTo]);

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (dateRange.from) params.set('from', dateRange.from);
    if (dateRange.to) params.set('to', dateRange.to);
    return `/api/billing/revenue-cycle?${params.toString()}`;
  }, [dateRange]);

  const { data, isLoading, mutate } = useSWR(hasPermission ? apiUrl : null, fetcher, {
    refreshInterval: 15000,
  });

  if (permLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        {tr('ليس لديك صلاحية للوصول لهذه الصفحة', 'You do not have permission to access this page')}
      </div>
    );
  }

  const summary = data?.summary || {};
  const revenueBreakdown = data?.revenueBreakdown || {};
  const aging = data?.agingBuckets || {};
  const pipeline = data?.claimsPipeline || {};
  const denialReasons = Array.isArray(data?.denialReasons) ? data.denialReasons : [];
  const recentPayments = Array.isArray(data?.recentPayments) ? data.recentPayments : [];

  const maxAgingAmount = Math.max(
    aging['0_30']?.amount || 0,
    aging['31_60']?.amount || 0,
    aging['61_90']?.amount || 0,
    aging['90_plus']?.amount || 0,
    1,
  );

  return (
    <div className="p-4 md:p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold">
          {tr('لوحة دورة الإيرادات', 'Revenue Cycle Dashboard')}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={preset} onValueChange={(v) => setPreset(v as DatePreset)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">{tr('هذا الشهر', 'This Month')}</SelectItem>
              <SelectItem value="last_month">{tr('الشهر الماضي', 'Last Month')}</SelectItem>
              <SelectItem value="this_quarter">{tr('هذا الربع', 'This Quarter')}</SelectItem>
              <SelectItem value="this_year">{tr('هذا العام', 'This Year')}</SelectItem>
              <SelectItem value="custom">{tr('مخصص', 'Custom')}</SelectItem>
            </SelectContent>
          </Select>
          {preset === 'custom' && (
            <>
              <Input
                type="date"
                className="w-[160px]"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                placeholder={tr('من', 'From')}
              />
              <Input
                type="date"
                className="w-[160px]"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                placeholder={tr('إلى', 'To')}
              />
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            {tr('تحديث', 'Refresh')}
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{tr('إجمالي الإيرادات', 'Total Revenue')}</p>
            <p className="text-xl font-bold text-green-700">{formatSAR(summary.totalCharges || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{tr('الرصيد المعلق', 'Outstanding Balance')}</p>
            <p className="text-xl font-bold text-orange-600">{formatSAR(summary.totalOutstanding || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{tr('نسبة التحصيل', 'Collection Rate')}</p>
            <p className="text-xl font-bold text-blue-700">{summary.collectionRate || 0}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{tr('متوسط أيام الدفع', 'Avg Days to Payment')}</p>
            <p className="text-xl font-bold">{summary.avgDaysToPayment || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{tr('نسبة الرفض', 'Denial Rate')}</p>
            <p className="text-xl font-bold text-red-600">{summary.denialRate || 0}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{tr('تفصيل الإيرادات', 'Revenue Breakdown')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border p-4 bg-green-50">
              <p className="text-sm text-muted-foreground">{tr('نقدي', 'Cash')}</p>
              <p className="text-2xl font-bold text-green-700">{formatSAR(revenueBreakdown.cash || 0)}</p>
            </div>
            <div className="rounded-lg border p-4 bg-blue-50">
              <p className="text-sm text-muted-foreground">{tr('تأمين', 'Insurance')}</p>
              <p className="text-2xl font-bold text-blue-700">{formatSAR(revenueBreakdown.insurance || 0)}</p>
            </div>
            <div className="rounded-lg border p-4 bg-purple-50">
              <p className="text-sm text-muted-foreground">{tr('حكومي', 'Government')}</p>
              <p className="text-2xl font-bold text-purple-700">{formatSAR(revenueBreakdown.government || 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aging Buckets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{tr('فترات التقادم', 'Aging Buckets')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { key: '0_30', label: tr('0-30 يوم', '0-30 Days'), color: 'bg-green-500' },
              { key: '31_60', label: tr('31-60 يوم', '31-60 Days'), color: 'bg-yellow-500' },
              { key: '61_90', label: tr('61-90 يوم', '61-90 Days'), color: 'bg-orange-500' },
              { key: '90_plus', label: tr('90+ يوم', '90+ Days'), color: 'bg-red-500' },
            ].map((bucket) => {
              const bucketData = aging[bucket.key] || { count: 0, amount: 0 };
              const widthPct = maxAgingAmount > 0 ? (bucketData.amount / maxAgingAmount) * 100 : 0;
              return (
                <div key={bucket.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{bucket.label}</span>
                    <span className="text-muted-foreground">
                      {formatSAR(bucketData.amount)} ({bucketData.count} {tr('عنصر', 'items')})
                    </span>
                  </div>
                  <div className="h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${bucket.color} rounded-full transition-all duration-500`}
                      style={{ width: `${Math.max(widthPct, 1)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Claims Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{tr('خط أنبوب المطالبات', 'Claims Pipeline')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4">
            {[
              { key: 'DRAFT', label: tr('مسودة', 'Draft'), variant: 'secondary' as const },
              { key: 'SUBMITTED', label: tr('مقدمة', 'Submitted'), variant: 'default' as const },
              { key: 'RESUBMITTED', label: tr('معاد تقديمها', 'Resubmitted'), variant: 'outline' as const },
              { key: 'REJECTED', label: tr('مرفوضة', 'Rejected'), variant: 'destructive' as const },
              { key: 'PAID', label: tr('مدفوعة', 'Paid'), variant: 'default' as const },
            ].map((stage, idx, arr) => (
              <div key={stage.key} className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <Badge variant={stage.variant} className="text-lg px-4 py-2">
                    {pipeline[stage.key] || 0}
                  </Badge>
                  <span className="text-xs text-muted-foreground mt-1">{stage.label}</span>
                </div>
                {idx < arr.length - 1 && (
                  <span className="text-muted-foreground text-2xl hidden md:inline">&rarr;</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Denial Reasons Table */}
      {denialReasons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{tr('أسباب الرفض', 'Denial Reasons')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-3 font-medium">{tr('السبب', 'Reason')}</th>
                    <th className="py-2 px-3 font-medium">{tr('العدد', 'Count')}</th>
                    <th className="py-2 px-3 font-medium">{tr('المبلغ', 'Amount')}</th>
                    <th className="py-2 px-3 font-medium">{tr('% من الإجمالي', '% of Total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {denialReasons.map((row: any, idx: number) => (
                    <tr key={idx} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3">{row.reason}</td>
                      <td className="py-2 px-3">{row.count}</td>
                      <td className="py-2 px-3">{formatSAR(row.amount)}</td>
                      <td className="py-2 px-3">{row.percentOfTotal}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{tr('المدفوعات الأخيرة', 'Recent Payments')}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {tr('لا توجد مدفوعات', 'No payments found')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-3 font-medium">{tr('التاريخ', 'Date')}</th>
                    <th className="py-2 px-3 font-medium">{tr('المريض', 'Patient')}</th>
                    <th className="py-2 px-3 font-medium">{tr('المبلغ', 'Amount')}</th>
                    <th className="py-2 px-3 font-medium">{tr('الطريقة', 'Method')}</th>
                    <th className="py-2 px-3 font-medium">{tr('الحالة', 'Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((row: any) => (
                    <tr key={row.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3">
                        {row.date ? new Date(row.date).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '-'}
                      </td>
                      <td className="py-2 px-3">{row.patientName || '-'}</td>
                      <td className="py-2 px-3">{formatSAR(row.amount)}</td>
                      <td className="py-2 px-3">
                        <Badge variant="outline">{row.method}</Badge>
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={row.status === 'RECORDED' ? 'default' : 'destructive'}>
                          {row.status === 'RECORDED' ? tr('مسجل', 'Recorded') : tr('ملغي', 'Voided')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
