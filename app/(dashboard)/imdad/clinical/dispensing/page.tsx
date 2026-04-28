'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';

interface DispenseRequest {
  id: string;
  dispenseNumber: string;
  orderType: string;
  patientName?: string;
  patientMrn?: string;
  departmentId?: string;
  departmentName?: string;
  priority: string;
  status: string;
  dispensedAt?: string;
  createdAt?: string;
}

const STATUS_OPTIONS = ['PENDING', 'PICKING', 'PICKED', 'VERIFIED', 'DISPENSED', 'PARTIALLY_DISPENSED', 'RETURNED', 'CANCELLED'] as const;
const PRIORITY_OPTIONS = ['STAT', 'URGENT', 'ROUTINE', 'PRN'] as const;

export default function DispensingPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [data, setData] = useState<DispenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      const res = await fetch(`/api/imdad/clinical/dispensing?${params}`, { credentials: 'include' });
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
  }, [page, search, statusFilter, priorityFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; label: string }> = {
      PENDING: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', label: tr('معلق', 'Pending') },
      PICKING: { color: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#D4A017]/20 dark:text-[#E8A317]', label: tr('قيد التجهيز', 'Picking') },
      PICKED: { color: 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]', label: tr('تم التجهيز', 'Picked') },
      VERIFIED: { color: 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]', label: tr('تم التحقق', 'Verified') },
      DISPENSED: { color: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]', label: tr('تم الصرف', 'Dispensed') },
      PARTIALLY_DISPENSED: { color: 'bg-[#E8A317]/10 text-[#E8A317] dark:bg-[#E8A317]/20 dark:text-[#E8A317]', label: tr('صرف جزئي', 'Partially Dispensed') },
      RETURNED: { color: 'bg-[#E8A317]/10 text-[#C4960C] dark:bg-[#E8A317]/20 dark:text-[#E8A317]', label: tr('مرتجع', 'Returned') },
      CANCELLED: { color: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#CD853F]', label: tr('ملغي', 'Cancelled') },
    };
    const s = map[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const priorityBadge = (priority: string) => {
    const map: Record<string, { color: string; label: string }> = {
      STAT: { color: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#CD853F]', label: tr('طارئ', 'STAT') },
      URGENT: { color: 'bg-[#E8A317]/10 text-[#C4960C] dark:bg-[#E8A317]/20 dark:text-[#E8A317]', label: tr('عاجل', 'Urgent') },
      ROUTINE: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', label: tr('روتيني', 'Routine') },
      PRN: { color: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#D4A017]/20 dark:text-[#E8A317]', label: tr('عند الحاجة', 'PRN') },
    };
    const s = map[priority] || { color: 'bg-gray-100 text-gray-800', label: priority };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const statusFilterLabel = (s: string) => {
    const map: Record<string, string> = {
      PENDING: tr('معلق', 'Pending'),
      PICKING: tr('قيد التجهيز', 'Picking'),
      PICKED: tr('تم التجهيز', 'Picked'),
      VERIFIED: tr('تم التحقق', 'Verified'),
      DISPENSED: tr('تم الصرف', 'Dispensed'),
      PARTIALLY_DISPENSED: tr('صرف جزئي', 'Partially Dispensed'),
      RETURNED: tr('مرتجع', 'Returned'),
      CANCELLED: tr('ملغي', 'Cancelled'),
    };
    return map[s] || s;
  };

  const priorityFilterLabel = (p: string) => {
    const map: Record<string, string> = {
      STAT: tr('طارئ', 'STAT'),
      URGENT: tr('عاجل', 'Urgent'),
      ROUTINE: tr('روتيني', 'Routine'),
      PRN: tr('عند الحاجة', 'PRN'),
    };
    return map[p] || p;
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US');
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {tr('صرف الأدوية', 'Dispensing')}
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
          value={priorityFilter}
          onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع الأولويات', 'All Priorities')}</option>
          {PRIORITY_OPTIONS.map(p => (
            <option key={p} value={p}>{priorityFilterLabel(p)}</option>
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
          {tr('لا توجد طلبات صرف', 'No dispense requests found')}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  tr('رقم الصرف', 'Dispense #'),
                  tr('نوع الطلب', 'Order Type'),
                  tr('اسم المريض', 'Patient Name'),
                  tr('رقم الملف', 'MRN'),
                  tr('القسم', 'Department'),
                  tr('الأولوية', 'Priority'),
                  tr('الحالة', 'Status'),
                  tr('تاريخ الصرف', 'Dispensed At'),
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
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{row.dispenseNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.orderType || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.patientName || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.patientMrn || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.departmentName || row.departmentId?.slice(0, 8) || '—'}</td>
                  <td className="px-4 py-3 text-sm">{priorityBadge(row.priority)}</td>
                  <td className="px-4 py-3 text-sm">{statusBadge(row.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(row.dispensedAt || row.createdAt || '')}</td>
                  <td className="px-4 py-3 text-sm">
                    <button className="text-[#D4A017] hover:text-[#C4960C] dark:text-[#E8A317] dark:hover:text-[#D4A017] text-sm">
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
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
