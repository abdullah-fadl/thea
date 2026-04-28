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

function statusColor(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = status.toUpperCase();
  if (s.includes('ACCEPT') || s.includes('APPROVED') || s.includes('COMPLETE') || s === 'ELIGIBLE') return 'default';
  if (s.includes('REJECT') || s.includes('DENIED') || s.includes('ERROR') || s === 'INELIGIBLE') return 'destructive';
  if (s.includes('PARTIAL')) return 'outline';
  return 'secondary';
}

export default function NPHIESDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading: permLoading } = useRoutePermission('/billing/nphies-dashboard');

  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [resubmitting, setResubmitting] = useState<string | null>(null);

  const dateRange = useMemo(() => {
    if (preset === 'custom') return { from: customFrom, to: customTo };
    return getDateRange(preset);
  }, [preset, customFrom, customTo]);

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (dateRange.from) params.set('from', dateRange.from);
    if (dateRange.to) params.set('to', dateRange.to);
    if (statusFilter) params.set('status', statusFilter);
    return `/api/billing/nphies/dashboard?${params.toString()}`;
  }, [dateRange, statusFilter]);

  const { data, isLoading, mutate } = useSWR(hasPermission ? apiUrl : null, fetcher, {
    refreshInterval: 15000,
  });

  const handleResubmit = async (claimId: string) => {
    setResubmitting(claimId);
    try {
      // Navigate to claim resubmission - this could trigger a dialog or redirect
      // For now, we refetch after a brief delay to show updated status
      await fetch(`/api/billing/claims/${claimId}/resubmit`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId }),
      });
      await mutate();
    } catch {
      // silently fail - user can retry
    } finally {
      setResubmitting(null);
    }
  };

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
  const statusDistribution = data?.statusDistribution || {};
  const payerBreakdown = Array.isArray(data?.payerBreakdown) ? data.payerBreakdown : [];
  const recentEligibility = Array.isArray(data?.recentEligibility) ? data.recentEligibility : [];
  const recentPriorAuth = Array.isArray(data?.recentPriorAuth) ? data.recentPriorAuth : [];
  const claims = Array.isArray(data?.claims) ? data.claims : [];

  return (
    <div className="p-4 md:p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold">
          {tr('لوحة مطالبات NPHIES', 'NPHIES Claim Status Dashboard')}
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
              />
              <Input
                type="date"
                className="w-[160px]"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </>
          )}
          <Select value={statusFilter || '__all__'} onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={tr('كل الحالات', 'All Statuses')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{tr('كل الحالات', 'All Statuses')}</SelectItem>
              <SelectItem value="QUEUED">{tr('في الانتظار', 'Queued')}</SelectItem>
              <SelectItem value="SUBMITTED">{tr('مقدمة', 'Submitted')}</SelectItem>
              <SelectItem value="ACCEPTED">{tr('مقبولة', 'Accepted')}</SelectItem>
              <SelectItem value="REJECTED">{tr('مرفوضة', 'Rejected')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            {tr('تحديث / مزامنة', 'Refresh / Sync')}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{tr('إجمالي المطالبات المقدمة', 'Total Claims Submitted')}</p>
            <p className="text-2xl font-bold">{summary.totalSubmitted || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{tr('مقبولة', 'Approved')}</p>
            <p className="text-2xl font-bold text-green-700">{summary.totalApproved || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{tr('مرفوضة', 'Rejected')}</p>
            <p className="text-2xl font-bold text-red-600">{summary.totalRejected || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{tr('معلقة', 'Pending')}</p>
            <p className="text-2xl font-bold text-yellow-600">{summary.totalPending || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{tr('متوسط وقت الاستجابة', 'Avg Response Time')}</p>
            <p className="text-2xl font-bold">{summary.avgResponseTimeHours || 0} {tr('ساعة', 'hrs')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{tr('توزيع الحالات', 'Status Distribution')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { key: 'QUEUED', label: tr('في الانتظار', 'Queued'), bg: 'bg-muted', text: 'text-foreground' },
              { key: 'SUBMITTED', label: tr('مقدمة', 'Submitted'), bg: 'bg-blue-50', text: 'text-blue-700' },
              { key: 'ACCEPTED', label: tr('مقبولة', 'Accepted'), bg: 'bg-green-50', text: 'text-green-700' },
              { key: 'REJECTED', label: tr('مرفوضة', 'Rejected'), bg: 'bg-red-50', text: 'text-red-700' },
              { key: 'PARTIAL', label: tr('جزئية', 'Partial'), bg: 'bg-yellow-50', text: 'text-yellow-700' },
              { key: 'COMPLETE', label: tr('مكتملة', 'Complete'), bg: 'bg-emerald-50', text: 'text-emerald-700' },
            ].map((item) => (
              <div key={item.key} className={`rounded-lg border p-3 ${item.bg} text-center`}>
                <p className={`text-2xl font-bold ${item.text}`}>{statusDistribution[item.key] || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payer Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{tr('تفصيل حسب شركة التأمين', 'Payer Breakdown')}</CardTitle>
        </CardHeader>
        <CardContent>
          {payerBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {tr('لا توجد بيانات', 'No data available')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-3 font-medium">{tr('شركة التأمين', 'Payer Name')}</th>
                    <th className="py-2 px-3 font-medium">{tr('مقدمة', 'Submitted')}</th>
                    <th className="py-2 px-3 font-medium">{tr('مقبولة', 'Approved')}</th>
                    <th className="py-2 px-3 font-medium">{tr('مرفوضة', 'Rejected')}</th>
                    <th className="py-2 px-3 font-medium">{tr('معلقة', 'Pending')}</th>
                    <th className="py-2 px-3 font-medium">{tr('نسبة القبول', 'Approval Rate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payerBreakdown.map((row: any) => (
                    <tr key={row.payerId} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 font-medium">{row.payerName || row.payerId}</td>
                      <td className="py-2 px-3">{row.submitted}</td>
                      <td className="py-2 px-3 text-green-700">{row.approved}</td>
                      <td className="py-2 px-3 text-red-600">{row.rejected}</td>
                      <td className="py-2 px-3 text-yellow-600">{row.pending}</td>
                      <td className="py-2 px-3">
                        <Badge variant={row.approvalRate >= 80 ? 'default' : row.approvalRate >= 50 ? 'outline' : 'destructive'}>
                          {row.approvalRate}%
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

      {/* Eligibility Check Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{tr('التحقق من الأهلية', 'Eligibility Checks')}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentEligibility.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {tr('لا توجد عمليات تحقق حديثة', 'No recent eligibility checks')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-3 font-medium">{tr('المريض', 'Patient')}</th>
                    <th className="py-2 px-3 font-medium">{tr('الحالة', 'Status')}</th>
                    <th className="py-2 px-3 font-medium">{tr('مؤهل', 'Eligible')}</th>
                    <th className="py-2 px-3 font-medium">{tr('التاريخ', 'Date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEligibility.slice(0, 10).map((row: any) => (
                    <tr key={row.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3">{row.patientName}</td>
                      <td className="py-2 px-3">
                        <Badge variant={statusColor(row.status)}>{row.status}</Badge>
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={row.eligible ? 'default' : 'destructive'}>
                          {row.eligible ? tr('مؤهل', 'Eligible') : tr('غير مؤهل', 'Ineligible')}
                        </Badge>
                      </td>
                      <td className="py-2 px-3">
                        {row.createdAt ? new Date(row.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prior Authorization Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{tr('الموافقات المسبقة', 'Prior Authorizations')}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentPriorAuth.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {tr('لا توجد موافقات مسبقة حديثة', 'No recent prior authorizations')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-3 font-medium">{tr('المريض', 'Patient')}</th>
                    <th className="py-2 px-3 font-medium">{tr('الحالة', 'Status')}</th>
                    <th className="py-2 px-3 font-medium">{tr('رقم التفويض', 'Auth Number')}</th>
                    <th className="py-2 px-3 font-medium">{tr('تاريخ الانتهاء', 'Expiry')}</th>
                    <th className="py-2 px-3 font-medium">{tr('التاريخ', 'Date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPriorAuth.slice(0, 10).map((row: any) => (
                    <tr key={row.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3">{row.patientName}</td>
                      <td className="py-2 px-3">
                        <Badge variant={row.approved ? 'default' : 'destructive'}>
                          {row.approved ? tr('موافق', 'Approved') : row.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-3">{row.authorizationNumber || '-'}</td>
                      <td className="py-2 px-3">
                        {row.expiryDate
                          ? new Date(row.expiryDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')
                          : '-'}
                      </td>
                      <td className="py-2 px-3">
                        {row.createdAt ? new Date(row.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Claims Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{tr('جدول المطالبات', 'Claims Table')}</CardTitle>
        </CardHeader>
        <CardContent>
          {claims.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {tr('لا توجد مطالبات', 'No claims found')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-3 font-medium">{tr('رقم المطالبة', 'Claim ID')}</th>
                    <th className="py-2 px-3 font-medium">{tr('المريض', 'Patient')}</th>
                    <th className="py-2 px-3 font-medium">{tr('شركة التأمين', 'Payer')}</th>
                    <th className="py-2 px-3 font-medium">{tr('المبلغ', 'Amount')}</th>
                    <th className="py-2 px-3 font-medium">{tr('تاريخ التقديم', 'Submitted Date')}</th>
                    <th className="py-2 px-3 font-medium">{tr('الحالة', 'Status')}</th>
                    <th className="py-2 px-3 font-medium">{tr('تاريخ الرد', 'Response Date')}</th>
                    <th className="py-2 px-3 font-medium">{tr('الإجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((row: any) => {
                    const isRejected =
                      String(row.status || '').toUpperCase().includes('REJECT') ||
                      String(row.status || '').toUpperCase().includes('DENIED');
                    return (
                      <tr key={row.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3 font-mono text-xs">{row.claimReference}</td>
                        <td className="py-2 px-3">{row.patientName}</td>
                        <td className="py-2 px-3">{row.payerName}</td>
                        <td className="py-2 px-3">{formatSAR(row.amount)}</td>
                        <td className="py-2 px-3">
                          {row.submittedDate
                            ? new Date(row.submittedDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')
                            : '-'}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={statusColor(row.status)}>
                            {row.status}
                          </Badge>
                          {row.isResubmission && (
                            <Badge variant="outline" className="ml-1 text-[10px]">
                              {tr('إعادة تقديم', 'Resubmit')}
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {row.responseDate
                            ? new Date(row.responseDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')
                            : '-'}
                        </td>
                        <td className="py-2 px-3">
                          {isRejected && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={resubmitting === row.id}
                              onClick={() => handleResubmit(row.id)}
                            >
                              {resubmitting === row.id
                                ? tr('جارٍ...', 'Resubmitting...')
                                : tr('إعادة تقديم', 'Resubmit')}
                            </Button>
                          )}
                          {row.denialReason && (
                            <span
                              className="text-xs text-red-500 block mt-1"
                              title={row.denialReason}
                            >
                              {language === 'ar' && row.denialReasonAr ? row.denialReasonAr : row.denialReason}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
