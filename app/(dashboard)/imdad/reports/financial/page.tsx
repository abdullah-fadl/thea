'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, FileText, AlertTriangle, Loader2 } from 'lucide-react';

interface FinancialKpi {
  totalBudget: number;
  budgetUtilized: number;
  outstandingInvoices: number;
  overduePayments: number;
}

interface BudgetComparison {
  category: string;
  categoryAr?: string;
  budget: number;
  actual: number;
  variance: number;
  variancePercent: number;
}

interface CostCenter {
  id: string;
  name: string;
  nameAr?: string;
  allocated: number;
  spent: number;
  remaining: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  vendorName: string;
  vendorNameAr?: string;
  status: string;
  amount: number;
  dueDate: string;
  createdAt: string;
}

export default function FinancialReportPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<FinancialKpi>({
    totalBudget: 0,
    budgetUtilized: 0,
    outstandingInvoices: 0,
    overduePayments: 0,
  });
  const [budgetComparison, setBudgetComparison] = useState<BudgetComparison[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      const qs = params.toString() ? `?${params.toString()}` : '';

      const [kpiRes, budgetRes, costCenterRes, invoiceRes] = await Promise.all([
        fetch(`/api/imdad/analytics/kpi-snapshots${qs}`),
        fetch(`/api/imdad/financial/budgets/comparison${qs}`),
        fetch(`/api/imdad/financial/cost-centers${qs}`),
        fetch(`/api/imdad/financial/invoices${qs}`),
      ]);

      if (kpiRes.ok) {
        const data = await kpiRes.json();
        setKpi({
          totalBudget: data.totalBudget ?? 0,
          budgetUtilized: data.budgetUtilized ?? 0,
          outstandingInvoices: data.outstandingInvoices ?? 0,
          overduePayments: data.overduePayments ?? 0,
        });
      }

      if (budgetRes.ok) {
        const data = await budgetRes.json();
        setBudgetComparison(data.comparisons ?? data ?? []);
      }

      if (costCenterRes.ok) {
        const data = await costCenterRes.json();
        setCostCenters(data.costCenters ?? data.items ?? data ?? []);
      }

      if (invoiceRes.ok) {
        const data = await invoiceRes.json();
        setInvoices(data.invoices ?? data.items ?? data ?? []);
      }
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 15);

  const utilizationPercent = kpi.totalBudget > 0
    ? ((kpi.budgetUtilized / kpi.totalBudget) * 100).toFixed(1)
    : '0';

  const invoiceStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
      case 'settled':
        return 'bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]';
      case 'pending':
      case 'submitted':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'overdue':
        return 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#A0522D]';
      case 'partial':
        return 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]';
      case 'cancelled':
      case 'voided':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const invoiceStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid': return tr('مدفوع', 'Paid');
      case 'settled': return tr('مسوى', 'Settled');
      case 'pending': return tr('معلق', 'Pending');
      case 'submitted': return tr('مقدم', 'Submitted');
      case 'overdue': return tr('متأخر', 'Overdue');
      case 'partial': return tr('جزئي', 'Partial');
      case 'cancelled': return tr('ملغي', 'Cancelled');
      case 'voided': return tr('ملغي', 'Voided');
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4A017]" />
        <span className="ms-3 text-gray-500">{tr('جاري التحميل...', 'Loading...')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {tr('التقرير المالي', 'Financial Report')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {tr('تحليلات الميزانية والفواتير والمدفوعات', 'Budget, invoices, and payment analytics')}
          </p>
        </div>

        {/* Date Range Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">
            {tr('من', 'From')}
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
          <label className="text-sm text-gray-600 dark:text-gray-400">
            {tr('إلى', 'To')}
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4A017]/10 dark:bg-[#C4960C]/20">
              <DollarSign className="h-6 w-6 text-[#D4A017] dark:text-[#E8A317]" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr('إجمالي الميزانية', 'Total Budget')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {kpi.totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#6B8E23]/10 dark:bg-[#556B2F]/20">
              <TrendingUp className="h-6 w-6 text-[#6B8E23] dark:text-[#9CB86B]" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr('الميزانية المستخدمة', 'Budget Utilized')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {kpi.budgetUtilized.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {utilizationPercent}% {tr('مستخدم', 'utilized')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
              <FileText className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr('فواتير معلقة', 'Outstanding Invoices')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {kpi.outstandingInvoices.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#8B4513]/10 dark:bg-[#8B4513]/20">
              <AlertTriangle className="h-6 w-6 text-[#8B4513] dark:text-[#A0522D]" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr('مدفوعات متأخرة', 'Overdue Payments')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {kpi.overduePayments.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget vs Actual */}
      <Card>
        <CardHeader>
          <CardTitle>{tr('مقارنة الميزانية مع الفعلي', 'Budget vs Actual')}</CardTitle>
        </CardHeader>
        <CardContent>
          {budgetComparison.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr('لا توجد بيانات', 'No data available')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr('الفئة', 'Category')}</TableHead>
                    <TableHead className="text-end">{tr('الميزانية', 'Budget')}</TableHead>
                    <TableHead className="text-end">{tr('الفعلي', 'Actual')}</TableHead>
                    <TableHead className="text-end">{tr('الفرق', 'Variance')}</TableHead>
                    <TableHead className="text-end">{tr('النسبة', '% Var')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgetComparison.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {language === 'ar' && row.categoryAr ? row.categoryAr : row.category}
                      </TableCell>
                      <TableCell className="text-end">
                        {row.budget.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-end">
                        {row.actual.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell
                        className={`text-end font-semibold ${
                          row.variance < 0 ? 'text-[#8B4513]' : 'text-[#6B8E23]'
                        }`}
                      >
                        {row.variance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell
                        className={`text-end ${
                          row.variancePercent < 0 ? 'text-[#8B4513]' : 'text-[#6B8E23]'
                        }`}
                      >
                        {row.variancePercent.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost Center Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>{tr('توزيع مراكز التكلفة', 'Cost Center Breakdown')}</CardTitle>
        </CardHeader>
        <CardContent>
          {costCenters.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr('لا توجد بيانات', 'No data available')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr('مركز التكلفة', 'Cost Center')}</TableHead>
                    <TableHead className="text-end">{tr('المخصص', 'Allocated')}</TableHead>
                    <TableHead className="text-end">{tr('المنفق', 'Spent')}</TableHead>
                    <TableHead className="text-end">{tr('المتبقي', 'Remaining')}</TableHead>
                    <TableHead className="text-end">{tr('الاستخدام', 'Usage')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costCenters.map((cc) => {
                    const usagePercent = cc.allocated > 0
                      ? ((cc.spent / cc.allocated) * 100).toFixed(1)
                      : '0';
                    const isOverBudget = cc.spent > cc.allocated;
                    return (
                      <TableRow key={cc.id}>
                        <TableCell className="font-medium">
                          {language === 'ar' && cc.nameAr ? cc.nameAr : cc.name}
                        </TableCell>
                        <TableCell className="text-end">
                          {cc.allocated.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-end">
                          {cc.spent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell
                          className={`text-end font-semibold ${isOverBudget ? 'text-[#8B4513]' : 'text-[#6B8E23]'}`}
                        >
                          {cc.remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                              <div
                                className={`h-full rounded-full ${
                                  isOverBudget ? 'bg-[#8B4513]' : Number(usagePercent) > 80 ? 'bg-yellow-500' : 'bg-[#6B8E23]'
                                }`}
                                style={{ width: `${Math.min(Number(usagePercent), 100)}%` }}
                              />
                            </div>
                            <span className="text-sm">{usagePercent}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>{tr('الفواتير الأخيرة', 'Recent Invoices')}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr('لا توجد فواتير', 'No invoices found')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr('رقم الفاتورة', 'Invoice #')}</TableHead>
                    <TableHead>{tr('المورد', 'Vendor')}</TableHead>
                    <TableHead>{tr('الحالة', 'Status')}</TableHead>
                    <TableHead className="text-end">{tr('المبلغ', 'Amount')}</TableHead>
                    <TableHead>{tr('تاريخ الاستحقاق', 'Due Date')}</TableHead>
                    <TableHead>{tr('تاريخ الإنشاء', 'Created')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                      <TableCell>
                        {language === 'ar' && inv.vendorNameAr ? inv.vendorNameAr : inv.vendorName}
                      </TableCell>
                      <TableCell>
                        <Badge className={invoiceStatusColor(inv.status)}>
                          {invoiceStatusLabel(inv.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end font-semibold">
                        {inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(inv.dueDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(inv.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
