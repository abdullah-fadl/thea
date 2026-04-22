'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';

interface Budget {
  id: string;
  budgetCode: string;
  budgetName: string;
  budgetNameAr?: string;
  fiscalYear: number;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  allocatedAmount: number;
  consumedAmount: number;
  availableAmount: number;
  status: string;
  costCenter?: { id: string; code: string; name: string; nameAr?: string };
}

interface BudgetsResponse {
  items: Budget[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUSES = ['DRAFT', 'ACTIVE', 'FROZEN', 'CLOSED', 'EXHAUSTED'];

const statusLabelsAr: Record<string, string> = {
  DRAFT: 'مسودة',
  ACTIVE: 'نشط',
  FROZEN: 'مجمّد',
  CLOSED: 'مغلق',
  EXHAUSTED: 'مستنفد',
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR' }).format(amount);
}

function getUtilization(allocated: number, consumed: number) {
  if (allocated <= 0) return 0;
  return Math.round((consumed / allocated) * 100);
}

function UtilizationBar({ percent }: { percent: number }) {
  const color =
    percent >= 95
      ? 'bg-[#8B4513]'
      : percent >= 80
        ? 'bg-[#E8A317]'
        : 'bg-[#6B8E23]';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{percent}%</span>
    </div>
  );
}

function StatusBadge({ status, tr }: { status: string; tr: (ar: string, en: string) => string }) {
  const map: Record<string, { label: [string, string]; cls: string }> = {
    DRAFT: { label: ['مسودة', 'Draft'], cls: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
    ACTIVE: { label: ['نشط', 'Active'], cls: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]' },
    FROZEN: { label: ['مجمد', 'Frozen'], cls: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#D4A017]/20 dark:text-[#E8A317]' },
    CLOSED: { label: ['مغلق', 'Closed'], cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
    EXHAUSTED: { label: ['منتهي', 'Exhausted'], cls: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#CD853F]' },
  };
  const entry = map[status] ?? { label: [status, status], cls: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${entry.cls}`}>
      {tr(entry.label[0], entry.label[1])}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
        </div>
      ))}
    </div>
  );
}

export default function BudgetsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [data, setData] = useState<BudgetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterYear, setFilterYear] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCostCenter, setFilterCostCenter] = useState('');

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filterYear) params.set('fiscalYear', filterYear);
      if (filterStatus) params.set('status', filterStatus);
      if (filterCostCenter) params.set('costCenterId', filterCostCenter);
      const res = await fetch(`/api/imdad/financial/budgets?${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [page, filterYear, filterStatus, filterCostCenter]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {tr('الميزانيات', 'Budgets')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {tr('إدارة ومتابعة الميزانيات المالية', 'Manage and track financial budgets')}
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-[#D4A017] px-4 py-2 text-sm font-medium text-white hover:bg-[#C4960C] transition-colors">
          <span>+</span>
          {tr('ميزانية جديدة', 'New Budget')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterYear}
          onChange={(e) => { setFilterYear(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">{tr('جميع السنوات', 'All Fiscal Years')}</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">{tr('جميع الحالات', 'All Statuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{tr(statusLabelsAr[s] || s, s)}</option>
          ))}
        </select>
        <input
          type="text"
          value={filterCostCenter}
          onChange={(e) => { setFilterCostCenter(e.target.value); setPage(1); }}
          placeholder={tr('معرف مركز التكلفة', 'Cost Center ID')}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white placeholder:text-gray-400"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-x-auto">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr('لا توجد ميزانيات', 'No budgets found')}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('رمز الميزانية', 'Budget Code')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('الاسم', 'Name')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('السنة المالية', 'Fiscal Year')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('الفترة', 'Period')}
                </th>
                <th className="px-4 py-3 text-end font-medium text-gray-600 dark:text-gray-400">
                  {tr('المخصص', 'Allocated')}
                </th>
                <th className="px-4 py-3 text-end font-medium text-gray-600 dark:text-gray-400">
                  {tr('المستهلك', 'Consumed')}
                </th>
                <th className="px-4 py-3 text-end font-medium text-gray-600 dark:text-gray-400">
                  {tr('المتاح', 'Available')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('نسبة الاستخدام', 'Utilization %')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('الحالة', 'Status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.items.map((b) => {
                const util = getUtilization(b.allocatedAmount, b.consumedAmount);
                return (
                  <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-4 py-3 font-mono text-xs text-gray-900 dark:text-white">
                      {b.budgetCode}
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">
                      {language === 'ar' && b.budgetNameAr ? b.budgetNameAr : b.budgetName}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {b.fiscalYear}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {b.periodType}
                    </td>
                    <td className="px-4 py-3 text-end font-medium text-gray-900 dark:text-white">
                      {formatCurrency(b.allocatedAmount)}
                    </td>
                    <td className="px-4 py-3 text-end text-gray-600 dark:text-gray-400">
                      {formatCurrency(b.consumedAmount)}
                    </td>
                    <td className="px-4 py-3 text-end text-gray-600 dark:text-gray-400">
                      {formatCurrency(b.availableAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <UtilizationBar percent={util} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} tr={tr} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr('الصفحة', 'Page')} {data.page} {tr('من', 'of')} {data.totalPages} ({data.total} {tr('سجل', 'records')})
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {tr('السابق', 'Previous')}
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page >= data.totalPages}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {tr('التالي', 'Next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
