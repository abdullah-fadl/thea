'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';
import { Search, Plus, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

interface Contract {
  _id: string;
  contractNumber: string;
  title: string;
  titleAr?: string;
  vendorName: string;
  vendorNameAr?: string;
  type: string;
  startDate: string;
  endDate: string;
  totalValue: number;
  currency: string;
  status: string;
}

interface ContractsResponse {
  contracts: Contract[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_OPTIONS = ['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWED', 'PENDING_RENEWAL'] as const;
const TYPE_OPTIONS = ['SUPPLY', 'SERVICE', 'MAINTENANCE', 'LEASE', 'FRAMEWORK'] as const;

function statusBadge(status: string) {
  const map: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    ACTIVE: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]',
    EXPIRED: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#CD853F]',
    TERMINATED: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#CD853F]',
    RENEWED: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#D4A017]/20 dark:text-[#E8A317]',
    PENDING_RENEWAL: 'bg-[#E8A317]/10 text-[#C4960C] dark:bg-[#E8A317]/20 dark:text-[#E8A317]',
  };
  return map[status] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
}

export default function ContractsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (vendorFilter) params.set('vendor', vendorFilter);

      const res = await fetch(`/api/imdad/procurement/contracts?${params}`);
      if (res.ok) {
        const data: ContractsResponse = await res.json();
        setContracts(data.contracts ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      // handle error silently
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, typeFilter, vendorFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(total / limit) || 1;

  const statusTr: Record<string, [string, string]> = {
    DRAFT: ['مسودة', 'Draft'],
    ACTIVE: ['نشط', 'Active'],
    EXPIRED: ['منتهي', 'Expired'],
    TERMINATED: ['منهي', 'Terminated'],
    RENEWED: ['مجدد', 'Renewed'],
    PENDING_RENEWAL: ['بانتظار التجديد', 'Pending Renewal'],
  };

  const typeTr: Record<string, [string, string]> = {
    SUPPLY: ['توريد', 'Supply'],
    SERVICE: ['خدمات', 'Service'],
    MAINTENANCE: ['صيانة', 'Maintenance'],
    LEASE: ['تأجير', 'Lease'],
    FRAMEWORK: ['إطاري', 'Framework'],
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {tr('العقود', 'Contracts')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {tr('إدارة ومتابعة العقود مع الموردين', 'Manage and track vendor contracts')}
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-[#D4A017] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#C4960C] transition-colors">
          <Plus className="h-4 w-4" />
          {tr('عقد جديد', 'New Contract')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={tr('بحث برقم العقد أو العنوان...', 'Search by contract number or title...')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 ps-10 pe-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">{tr('جميع الحالات', 'All Statuses')}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{tr(statusTr[s]?.[0] ?? s, statusTr[s]?.[1] ?? s)}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">{tr('جميع الأنواع', 'All Types')}</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{tr(typeTr[t]?.[0] ?? t, typeTr[t]?.[1] ?? t)}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder={tr('تصفية بالمورد...', 'Filter by vendor...')}
          value={vendorFilter}
          onChange={(e) => { setVendorFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              {[
                tr('رقم العقد', 'Contract Number'),
                tr('العنوان', 'Title'),
                tr('المورد', 'Vendor'),
                tr('النوع', 'Type'),
                tr('تاريخ البدء', 'Start Date'),
                tr('تاريخ الانتهاء', 'End Date'),
                tr('القيمة الإجمالية', 'Total Value'),
                tr('الحالة', 'Status'),
                tr('إجراءات', 'Actions'),
              ].map((h) => (
                <th key={h} className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                  ))}
                </tr>
              ))
            ) : contracts.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  {tr('لا توجد عقود', 'No contracts found')}
                </td>
              </tr>
            ) : (
              contracts.map((c) => (
                <tr key={c._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-[#D4A017] dark:text-[#E8A317]">{c.contractNumber}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {language === 'ar' && c.titleAr ? c.titleAr : c.title}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {language === 'ar' && c.vendorNameAr ? c.vendorNameAr : c.vendorName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {tr(typeTr[c.type]?.[0] ?? c.type, typeTr[c.type]?.[1] ?? c.type)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {new Date(c.startDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-SA')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {new Date(c.endDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-SA')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {c.totalValue?.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-SA', { style: 'currency', currency: c.currency || 'SAR' })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(c.status)}`}>
                      {tr(statusTr[c.status]?.[0] ?? c.status, statusTr[c.status]?.[1] ?? c.status)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <button className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr(
              `عرض ${(page - 1) * limit + 1} - ${Math.min(page * limit, total)} من ${total}`,
              `Showing ${(page - 1) * limit + 1} - ${Math.min(page * limit, total)} of ${total}`
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-300 p-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {tr(`${page} من ${totalPages}`, `${page} of ${totalPages}`)}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-gray-300 p-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
