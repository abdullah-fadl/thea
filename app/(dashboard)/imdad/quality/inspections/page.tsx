'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import InspectionFormDialog from '@/components/imdad/quality/InspectionFormDialog';
import InspectionDetailSheet from '@/components/imdad/quality/InspectionDetailSheet';

interface Inspection {
  _id?: string;
  id: string;
  inspectionNumber: string;
  inspectionType: string;
  referenceType?: string;
  referenceNumber?: string;
  itemName?: string;
  status: string;
  inspectorName?: string;
  scheduledDate?: string;
  overallResult?: string;
  version?: number;
}

const STATUS_OPTIONS = ['SCHEDULED', 'IN_PROGRESS', 'PASSED', 'FAILED', 'CONDITIONAL_PASS', 'CANCELLED', 'ON_HOLD'] as const;
const TYPE_OPTIONS = ['INCOMING', 'IN_PROCESS', 'OUTGOING', 'RANDOM', 'COMPLAINT_DRIVEN', 'PERIODIC', 'RECALL'] as const;

export default function QualityInspectionsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [data, setData] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const limit = 20;

  // Dialogs
  const [showCreate, setShowCreate] = useState(false);
  const [editInspection, setEditInspection] = useState<any>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('inspectionType', typeFilter);
      const res = await fetch(`/api/imdad/quality/inspections?${params}`, { credentials: 'include' });
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
  }, [page, search, statusFilter, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; label: string }> = {
      PASSED: { color: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]', label: tr('ناجح', 'Passed') },
      FAILED: { color: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D2691E]', label: tr('راسب', 'Failed') },
      IN_PROGRESS: { color: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('قيد التنفيذ', 'In Progress') },
      SCHEDULED: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', label: tr('مجدول', 'Scheduled') },
      CONDITIONAL_PASS: { color: 'bg-[#E8A317]/10 text-[#E8A317] dark:bg-[#E8A317]/20 dark:text-[#E8A317]', label: tr('نجاح مشروط', 'Conditional Pass') },
      ON_HOLD: { color: 'bg-[#D4A017]/15 text-[#C4960C] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('معلق', 'On Hold') },
      CANCELLED: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', label: tr('ملغي', 'Cancelled') },
    };
    const s = map[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      INCOMING: tr('وارد', 'Incoming'),
      IN_PROCESS: tr('أثناء العملية', 'In-Process'),
      OUTGOING: tr('صادر', 'Outgoing'),
      RANDOM: tr('عشوائي', 'Random'),
      COMPLAINT_DRIVEN: tr('شكوى', 'Complaint-Driven'),
      PERIODIC: tr('دوري', 'Periodic'),
      RECALL: tr('استرجاع', 'Recall'),
    };
    return map[type] || type;
  };

  const resultBadge = (result: string | undefined) => {
    if (!result) return <span className="text-gray-400">—</span>;
    const map: Record<string, string> = {
      PASS: 'text-[#6B8E23] dark:text-[#9CB86B]',
      FAIL: 'text-[#8B4513] dark:text-[#D2691E]',
      CONDITIONAL: 'text-[#E8A317] dark:text-[#E8A317]',
    };
    const labelMap: Record<string, string> = {
      PASS: tr('ناجح', 'Pass'),
      FAIL: tr('فاشل', 'Fail'),
      CONDITIONAL: tr('مشروط', 'Conditional'),
    };
    const color = map[result] || 'text-gray-600 dark:text-gray-400';
    return <span className={`font-medium ${color}`}>{labelMap[result] || result}</span>;
  };

  const formatDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const statusFilterLabel = (s: string) => {
    const map: Record<string, string> = {
      SCHEDULED: tr('مجدول', 'Scheduled'),
      IN_PROGRESS: tr('قيد التنفيذ', 'In Progress'),
      PASSED: tr('ناجح', 'Passed'),
      FAILED: tr('راسب', 'Failed'),
      CONDITIONAL_PASS: tr('نجاح مشروط', 'Conditional Pass'),
      CANCELLED: tr('ملغي', 'Cancelled'),
      ON_HOLD: tr('معلق', 'On Hold'),
    };
    return map[s] || s;
  };

  function handleRowClick(row: Inspection) {
    setSelectedId(row.id || row._id || null);
    setShowDetail(true);
  }

  function handleEdit(insp: any) {
    setEditInspection(insp);
  }

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {tr('فحوصات الجودة', 'Quality Inspections')}
        </h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 me-2" />
          {tr('إنشاء فحص جديد', 'Create Inspection')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={tr('بحث...', 'Search...')}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="border rounded-lg ps-10 pe-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          />
        </div>
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
            <option key={t} value={t}>{typeLabel(t)}</option>
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
          {tr('لا توجد فحوصات', 'No inspections found')}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  tr('رقم الفحص', 'Inspection #'),
                  tr('النوع', 'Type'),
                  tr('المرجع', 'Reference'),
                  tr('الصنف', 'Item'),
                  tr('الحالة', 'Status'),
                  tr('الفاحص', 'Inspector'),
                  tr('التاريخ المجدول', 'Scheduled Date'),
                  tr('النتيجة', 'Result'),
                ].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-start">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {data.map(row => (
                <tr
                  key={row.id || row._id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  onClick={() => handleRowClick(row)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{row.inspectionNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{typeLabel(row.inspectionType)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.referenceNumber || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.itemName || '—'}</td>
                  <td className="px-4 py-3 text-sm">{statusBadge(row.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.inspectorName || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(row.scheduledDate)}</td>
                  <td className="px-4 py-3 text-sm">{resultBadge(row.overallResult)}</td>
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

      {/* Create Dialog */}
      <InspectionFormDialog
        mode="create"
        open={showCreate}
        onOpenChange={setShowCreate}
        onSuccess={fetchData}
      />

      {/* Edit Dialog */}
      <InspectionFormDialog
        mode="edit"
        inspection={editInspection}
        open={!!editInspection}
        onOpenChange={(open) => { if (!open) setEditInspection(null); }}
        onSuccess={fetchData}
      />

      {/* Detail Sheet */}
      <InspectionDetailSheet
        inspectionId={selectedId}
        open={showDetail}
        onOpenChange={setShowDetail}
        onEdit={handleEdit}
        onStatusChange={fetchData}
      />
    </div>
  );
}
