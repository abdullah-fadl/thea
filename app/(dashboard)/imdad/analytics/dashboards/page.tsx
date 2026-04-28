'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';

interface DashboardConfig {
  id: string;
  configName: string;
  configType: string;
  userId: string | null;
  roleType: string | null;
  isDefault: boolean;
  isActive: boolean;
  updatedAt: string;
}

const CONFIG_TYPE_OPTIONS = ['PERSONAL', 'ORGANIZATION', 'ROLE_BASED'] as const;

export default function AnalyticsDashboardsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [data, setData] = useState<DashboardConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [configTypeFilter, setConfigTypeFilter] = useState('');
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (configTypeFilter) params.set('configType', configTypeFilter);
      const res = await fetch(`/api/imdad/analytics/dashboards?${params}`, { credentials: 'include' });
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
  }, [page, search, configTypeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const configTypeBadge = (type: string) => {
    const map: Record<string, { color: string; label: string }> = {
      PERSONAL: { color: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('شخصي', 'Personal') },
      ORGANIZATION: { color: 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#4A5D23]/20 dark:text-[#9CB86B]', label: tr('مؤسسي', 'Organization') },
      ROLE_BASED: { color: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('حسب الدور', 'Role-Based') },
    };
    const s = map[type] || { color: 'bg-gray-100 text-gray-800', label: type };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const configTypeFilterLabel = (t: string) => {
    const map: Record<string, string> = {
      PERSONAL: tr('شخصي', 'Personal'),
      ORGANIZATION: tr('مؤسسي', 'Organization'),
      ROLE_BASED: tr('حسب الدور', 'Role-Based'),
    };
    return map[t] || t;
  };

  const boolBadge = (val: boolean, trueLabel: string, falseLabel: string) => {
    return val
      ? <span className="px-2 py-1 rounded-full text-xs font-medium bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]">{trueLabel}</span>
      : <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">{falseLabel}</span>;
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US');
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {tr('لوحات المعلومات التحليلية', 'Analytics Dashboards')}
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
          value={configTypeFilter}
          onChange={e => { setConfigTypeFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع الأنواع', 'All Types')}</option>
          {CONFIG_TYPE_OPTIONS.map(t => (
            <option key={t} value={t}>{configTypeFilterLabel(t)}</option>
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
          {tr('لا توجد لوحات معلومات', 'No dashboards found')}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  tr('اسم الإعداد', 'Config Name'),
                  tr('النوع', 'Config Type'),
                  tr('المستخدم', 'User'),
                  tr('نوع الدور', 'Role Type'),
                  tr('افتراضي', 'Default'),
                  tr('نشط', 'Active'),
                  tr('تاريخ التحديث', 'Updated At'),
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
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{row.configName}</td>
                  <td className="px-4 py-3 text-sm">{configTypeBadge(row.configType)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {row.userId || tr('على مستوى المؤسسة', 'Organization-wide')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.roleType || '—'}</td>
                  <td className="px-4 py-3 text-sm">{boolBadge(row.isDefault, tr('نعم', 'Yes'), tr('لا', 'No'))}</td>
                  <td className="px-4 py-3 text-sm">{boolBadge(row.isActive, tr('نشط', 'Active'), tr('غير نشط', 'Inactive'))}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(row.updatedAt)}</td>
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
