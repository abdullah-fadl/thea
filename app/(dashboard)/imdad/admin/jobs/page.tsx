'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';

interface JobLastExecution {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  result: string | null;
  errorMessage: string | null;
}

interface JobEntry {
  name: string;
  description: string;
  descriptionAr?: string;
  cronExpression: string;
  isEnabled: boolean;
  category: string;
  lastExecution: JobLastExecution | null;
}

const CATEGORY_OPTIONS = ['INVENTORY', 'PROCUREMENT', 'FINANCIAL', 'MAINTENANCE', 'ANALYTICS', 'INTEGRATION', 'CLEANUP'] as const;

export default function JobsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [data, setData] = useState<JobEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobEntry | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      const res = await fetch(`/api/imdad/admin/jobs?${params}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [categoryFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleRunNow = async (jobName: string) => {
    setRunningJob(jobName);
    try {
      const res = await fetch('/api/imdad/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          jobName,
          organizationId: '00000000-0000-0000-0000-000000000000', // placeholder — resolved server-side
        }),
      });
      if (res.ok) {
        setToast({ type: 'success', message: tr(`تم تشغيل المهمة: ${jobName}`, `Job triggered: ${jobName}`) });
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        setToast({ type: 'error', message: tr(`فشل تشغيل المهمة: ${err.message || jobName}`, `Job failed: ${err.message || jobName}`) });
      }
    } catch {
      setToast({ type: 'error', message: tr('حدث خطأ أثناء تشغيل المهمة', 'An error occurred while running the job') });
    }
    setRunningJob(null);
  };

  const formatDateTime = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; label: string }> = {
      RUNNING: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', label: tr('قيد التشغيل', 'Running') },
      COMPLETED: { color: 'bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]', label: tr('مكتمل', 'Completed') },
      FAILED: { color: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#A0522D]', label: tr('فشل', 'Failed') },
      PENDING: { color: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('قيد الانتظار', 'Pending') },
      CANCELLED: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', label: tr('ملغى', 'Cancelled') },
    };
    const s = map[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const enabledBadge = (enabled: boolean) => (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
      enabled
        ? 'bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]'
        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
    }`}>
      {enabled ? tr('مفعّل', 'Enabled') : tr('معطّل', 'Disabled')}
    </span>
  );

  const categoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      INVENTORY: tr('المخزون', 'Inventory'),
      PROCUREMENT: tr('المشتريات', 'Procurement'),
      FINANCIAL: tr('المالية', 'Financial'),
      MAINTENANCE: tr('الصيانة', 'Maintenance'),
      ANALYTICS: tr('التحليلات', 'Analytics'),
      INTEGRATION: tr('التكامل', 'Integration'),
      CLEANUP: tr('التنظيف', 'Cleanup'),
    };
    return map[cat] || cat;
  };

  const filtered = data.filter(j => {
    if (search) {
      const q = search.toLowerCase();
      if (!j.name.toLowerCase().includes(q) && !j.description.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {tr('المهام المجدولة', 'Background Jobs')}
      </h1>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 ${language === 'ar' ? 'left-4' : 'right-4'} z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success'
            ? 'bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]'
            : 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#A0522D]'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder={tr('بحث بالاسم أو الوصف...', 'Search by name or description...')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        />
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع الفئات', 'All Categories')}</option>
          {CATEGORY_OPTIONS.map(c => (
            <option key={c} value={c}>{categoryLabel(c)}</option>
          ))}
        </select>
        <button
          onClick={fetchData}
          className="px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          {tr('تحديث', 'Refresh')}
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('جارٍ التحميل...', 'Loading...')}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('لا توجد مهام مسجلة', 'No jobs found')}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  tr('اسم المهمة', 'Job Name'),
                  tr('الوصف', 'Description'),
                  tr('التعبير الزمني', 'Cron'),
                  tr('الحالة', 'Enabled'),
                  tr('الفئة', 'Category'),
                  tr('آخر تنفيذ', 'Last Execution'),
                  tr('بدأ في', 'Started'),
                  tr('انتهى في', 'Completed'),
                  tr('النتيجة', 'Result'),
                  tr('الإجراءات', 'Actions'),
                ].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-start">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.map(job => (
                <tr
                  key={job.name}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => setSelectedJob(job)}
                >
                  <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900 dark:text-white">{job.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate">
                    {language === 'ar' && job.descriptionAr ? job.descriptionAr : job.description}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-gray-400">{job.cronExpression}</td>
                  <td className="px-4 py-3 text-sm">{enabledBadge(job.isEnabled)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{categoryLabel(job.category)}</td>
                  <td className="px-4 py-3 text-sm">
                    {job.lastExecution ? statusBadge(job.lastExecution.status) : <span className="text-xs text-gray-400">{tr('لم يُنفذ', 'Never run')}</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatDateTime(job.lastExecution?.startedAt || null)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatDateTime(job.lastExecution?.completedAt || null)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                    {job.lastExecution?.errorMessage
                      ? <span className="text-[#8B4513] dark:text-[#A0522D]">{job.lastExecution.errorMessage}</span>
                      : (job.lastExecution?.result || '—')}
                  </td>
                  <td className="px-4 py-3 text-sm" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleRunNow(job.name)}
                      disabled={runningJob === job.name || !job.isEnabled}
                      className="px-3 py-1.5 bg-[#D4A017] text-white rounded-lg text-xs font-medium hover:bg-[#C4960C] disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {runningJob === job.name
                        ? tr('جارٍ التشغيل...', 'Running...')
                        : tr('تشغيل الآن', 'Run Now')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
        <span>{tr(`إجمالي المهام: ${data.length}`, `Total Jobs: ${data.length}`)}</span>
        <span>{tr(`المفعّلة: ${data.filter(j => j.isEnabled).length}`, `Enabled: ${data.filter(j => j.isEnabled).length}`)}</span>
        <span>{tr(`الفاشلة: ${data.filter(j => j.lastExecution?.status === 'FAILED').length}`, `Failed: ${data.filter(j => j.lastExecution?.status === 'FAILED').length}`)}</span>
      </div>

      {/* Detail Sheet */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedJob(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-xl bg-white dark:bg-gray-900 shadow-xl overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 space-y-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {tr('تفاصيل المهمة', 'Job Details')}
                </h2>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl"
                >
                  &times;
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">{tr('اسم المهمة', 'Job Name')}</p>
                  <p className="font-mono font-medium text-gray-900 dark:text-white">{selectedJob.name}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">{tr('الفئة', 'Category')}</p>
                  <p className="text-gray-900 dark:text-white">{categoryLabel(selectedJob.category)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 dark:text-gray-400">{tr('الوصف', 'Description')}</p>
                  <p className="text-gray-900 dark:text-white">
                    {language === 'ar' && selectedJob.descriptionAr ? selectedJob.descriptionAr : selectedJob.description}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">{tr('التعبير الزمني', 'Cron Expression')}</p>
                  <p className="font-mono text-gray-900 dark:text-white">{selectedJob.cronExpression}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">{tr('الحالة', 'Status')}</p>
                  {enabledBadge(selectedJob.isEnabled)}
                </div>
              </div>

              {selectedJob.lastExecution && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {tr('آخر تنفيذ', 'Last Execution')}
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">{tr('الحالة', 'Status')}</p>
                      {statusBadge(selectedJob.lastExecution.status)}
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">{tr('المعرّف', 'Execution ID')}</p>
                      <p className="font-mono text-xs text-gray-900 dark:text-white">{selectedJob.lastExecution.id}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">{tr('بدأ في', 'Started At')}</p>
                      <p className="text-gray-900 dark:text-white">{formatDateTime(selectedJob.lastExecution.startedAt)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">{tr('انتهى في', 'Completed At')}</p>
                      <p className="text-gray-900 dark:text-white">{formatDateTime(selectedJob.lastExecution.completedAt)}</p>
                    </div>
                  </div>
                  {selectedJob.lastExecution.result && (
                    <div>
                      <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">{tr('ملخص النتيجة', 'Result Summary')}</p>
                      <pre className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                        {selectedJob.lastExecution.result}
                      </pre>
                    </div>
                  )}
                  {selectedJob.lastExecution.errorMessage && (
                    <div>
                      <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">{tr('رسالة الخطأ', 'Error Message')}</p>
                      <pre className="bg-[#8B4513]/5 dark:bg-[#8B4513]/15 p-3 rounded-lg text-xs text-[#8B4513] dark:text-[#A0522D] overflow-x-auto">
                        {selectedJob.lastExecution.errorMessage}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <button
                  onClick={() => { handleRunNow(selectedJob.name); setSelectedJob(null); }}
                  disabled={!selectedJob.isEnabled || runningJob === selectedJob.name}
                  className="px-5 py-2 bg-[#D4A017] text-white rounded-lg text-sm font-medium hover:bg-[#C4960C] disabled:opacity-50 transition-colors"
                >
                  {tr('تشغيل الآن', 'Run Now')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
