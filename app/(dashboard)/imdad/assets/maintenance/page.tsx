'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';

interface MaintenanceOrder {
  id: string;
  orderNumber: string;
  assetTag: string;
  assetName: string;
  maintenanceType: string;
  status: string;
  priority: string;
  scheduledDate: string;
  completedAt: string;
  totalCost: number;
}

const STATUS_OPTIONS = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED', 'DEFERRED'] as const;
const TYPE_OPTIONS = ['PREVENTIVE', 'CORRECTIVE', 'CALIBRATION', 'SAFETY_CHECK', 'UPGRADE', 'INSTALLATION'] as const;
const PRIORITY_OPTIONS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;

export default function AssetMaintenancePage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [data, setData] = useState<MaintenanceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('maintenanceType', typeFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      const res = await fetch(`/api/imdad/assets/maintenance?${params}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 0);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [page, search, statusFilter, typeFilter, priorityFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; label: string }> = {
      SCHEDULED: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', label: tr('مجدول', 'Scheduled') },
      IN_PROGRESS: { color: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('قيد التنفيذ', 'In Progress') },
      COMPLETED: { color: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]', label: tr('مكتمل', 'Completed') },
      OVERDUE: { color: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D2691E]', label: tr('متأخر', 'Overdue') },
      CANCELLED: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', label: tr('ملغي', 'Cancelled') },
      DEFERRED: { color: 'bg-[#E8A317]/10 text-[#E8A317] dark:bg-[#E8A317]/20 dark:text-[#E8A317]', label: tr('مؤجل', 'Deferred') },
    };
    const s = map[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const statusFilterLabel = (s: string) => {
    const map: Record<string, string> = {
      SCHEDULED: tr('مجدول', 'Scheduled'),
      IN_PROGRESS: tr('قيد التنفيذ', 'In Progress'),
      COMPLETED: tr('مكتمل', 'Completed'),
      OVERDUE: tr('متأخر', 'Overdue'),
      CANCELLED: tr('ملغي', 'Cancelled'),
      DEFERRED: tr('مؤجل', 'Deferred'),
    };
    return map[s] || s;
  };

  const typeBadge = (type: string) => {
    const map: Record<string, { color: string; label: string }> = {
      PREVENTIVE: { color: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('وقائية', 'Preventive') },
      CORRECTIVE: { color: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D2691E]', label: tr('تصحيحية', 'Corrective') },
      CALIBRATION: { color: 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]', label: tr('معايرة', 'Calibration') },
      SAFETY_CHECK: { color: 'bg-[#D4A017]/15 text-[#C4960C] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('فحص سلامة', 'Safety Check') },
      UPGRADE: { color: 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]', label: tr('ترقية', 'Upgrade') },
      INSTALLATION: { color: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]', label: tr('تركيب', 'Installation') },
    };
    const t = map[type] || { color: 'bg-gray-100 text-gray-800', label: type };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.color}`}>{t.label}</span>;
  };

  const typeFilterLabel = (t: string) => {
    const map: Record<string, string> = {
      PREVENTIVE: tr('وقائية', 'Preventive'),
      CORRECTIVE: tr('تصحيحية', 'Corrective'),
      CALIBRATION: tr('معايرة', 'Calibration'),
      SAFETY_CHECK: tr('فحص سلامة', 'Safety Check'),
      UPGRADE: tr('ترقية', 'Upgrade'),
      INSTALLATION: tr('تركيب', 'Installation'),
    };
    return map[t] || t;
  };

  const priorityLabel = (p: string) => {
    const map: Record<string, string> = {
      CRITICAL: tr('حرج', 'Critical'),
      HIGH: tr('عالي', 'High'),
      MEDIUM: tr('متوسط', 'Medium'),
      LOW: tr('منخفض', 'Low'),
    };
    return map[p] || p;
  };

  const priorityBadge = (priority: string) => {
    const map: Record<string, string> = {
      CRITICAL: 'text-[#8B4513] dark:text-[#D2691E]',
      HIGH: 'text-[#C4960C] dark:text-[#E8A317]',
      MEDIUM: 'text-[#E8A317] dark:text-[#E8A317]',
      LOW: 'text-[#6B8E23] dark:text-[#9CB86B]',
    };
    const color = map[priority] || 'text-gray-600 dark:text-gray-400';
    return <span className={`font-medium ${color}`}>{priorityLabel(priority)}</span>;
  };

  const formatCurrency = (val: number | undefined | null) => {
    if (val == null) return '—';
    return new Intl.NumberFormat(language === 'ar' ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }).format(val);
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US');
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {tr('أوامر الصيانة', 'Maintenance Orders')}
      </h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder={tr('بحث...', 'Search...')}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع الحالات', 'All Statuses')}</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{statusFilterLabel(s)}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع الأنواع', 'All Types')}</option>
          {TYPE_OPTIONS.map(t => (
            <option key={t} value={t}>{typeFilterLabel(t)}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع الأولويات', 'All Priorities')}</option>
          {PRIORITY_OPTIONS.map(p => (
            <option key={p} value={p}>{priorityLabel(p)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('جارٍ التحميل...', 'Loading...')}
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('لا توجد أوامر صيانة', 'No maintenance orders found')}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  tr('رقم الأمر', 'Order #'),
                  tr('رمز الأصل', 'Asset Tag'),
                  tr('اسم الأصل', 'Asset Name'),
                  tr('النوع', 'Type'),
                  tr('الحالة', 'Status'),
                  tr('الأولوية', 'Priority'),
                  tr('التاريخ المجدول', 'Scheduled Date'),
                  tr('تاريخ الإكمال', 'Completed At'),
                  tr('التكلفة الإجمالية', 'Total Cost'),
                  tr('الإجراءات', 'Actions'),
                ].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-start">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {data.map(row => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{row.orderNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.assetTag || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.assetName || '—'}</td>
                  <td className="px-4 py-3 text-sm">{typeBadge(row.maintenanceType)}</td>
                  <td className="px-4 py-3 text-sm">{statusBadge(row.status)}</td>
                  <td className="px-4 py-3 text-sm">{priorityBadge(row.priority)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(row.scheduledDate)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(row.completedAt)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatCurrency(row.totalCost)}</td>
                  <td className="px-4 py-3 text-sm">
                    <button className="text-[#D4A017] hover:text-[#C4960C] dark:text-[#E8A317] dark:hover:text-[#E8A317] text-sm">
                      {tr('عرض', 'View')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {tr(`الإجمالي: ${total}`, `Total: ${total}`)}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            >
              {tr('السابق', 'Previous')}
            </button>
            <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
              {tr(`صفحة ${page} من ${totalPages}`, `Page ${page} of ${totalPages}`)}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            >
              {tr('التالي', 'Next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
