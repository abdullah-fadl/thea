'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface CostCenter {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  departmentId?: string;
  glAccountCode?: string;
  managerUserId?: string;
  isActive: boolean;
  parentId?: string | null;
  children?: CostCenter[];
}

interface CostCentersResponse {
  items: CostCenter[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-6" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
        </div>
      ))}
    </div>
  );
}

function CostCenterRow({
  item,
  depth,
  language,
  tr,
  expanded,
  onToggle,
}: {
  item: CostCenter;
  depth: number;
  language: string;
  tr: (ar: string, en: string) => string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expanded.has(item.id);

  return (
    <>
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
        <td className="px-4 py-3">
          <div className="flex items-center" style={{ paddingInlineStart: `${depth * 24}px` }}>
            {hasChildren ? (
              <button
                onClick={() => onToggle(item.id)}
                className="mr-1 rounded p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                )}
              </button>
            ) : (
              <span className="inline-block w-5" />
            )}
            <span className="font-mono text-xs text-gray-900 dark:text-white">{item.code}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-gray-900 dark:text-white">
          {language === 'ar' && item.nameAr ? item.nameAr : item.name}
        </td>
        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-sm">
          {item.departmentId ?? '—'}
        </td>
        <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
          {item.glAccountCode ?? '—'}
        </td>
        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-sm">
          {item.managerUserId ?? '—'}
        </td>
        <td className="px-4 py-3">
          {item.isActive ? (
            <span className="inline-flex items-center rounded-full bg-[#6B8E23]/10 px-2.5 py-0.5 text-xs font-medium text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]">
              {tr('نشط', 'Active')}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
              {tr('غير نشط', 'Inactive')}
            </span>
          )}
        </td>
      </tr>
      {hasChildren && isExpanded &&
        item.children!.map((child) => (
          <CostCenterRow
            key={child.id}
            item={child}
            depth={depth + 1}
            language={language}
            tr={tr}
            expanded={expanded}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

export default function CostCentersPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [data, setData] = useState<CostCentersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'tree' | 'flat'>('tree');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const fetchCostCenters = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (viewMode === 'tree') {
        params.set('tree', 'true');
      } else {
        params.set('page', String(page));
        params.set('limit', '50');
      }
      const res = await fetch(`/api/imdad/financial/cost-centers?${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [viewMode, page]);

  useEffect(() => {
    fetchCostCenters();
  }, [fetchCostCenters]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    if (!data) return;
    const ids = new Set<string>();
    const collectIds = (items: CostCenter[]) => {
      for (const item of items) {
        if (item.children && item.children.length > 0) {
          ids.add(item.id);
          collectIds(item.children);
        }
      }
    };
    collectIds(data.items);
    setExpanded(ids);
  };

  const collapseAll = () => {
    setExpanded(new Set());
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {tr('مراكز التكلفة', 'Cost Centers')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {tr('إدارة التسلسل الهرمي لمراكز التكلفة', 'Manage cost center hierarchy')}
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-[#D4A017] px-4 py-2 text-sm font-medium text-white hover:bg-[#C4960C] transition-colors">
          <span>+</span>
          {tr('إضافة مركز تكلفة', 'Add Cost Center')}
        </button>
      </div>

      {/* View controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          <button
            onClick={() => { setViewMode('tree'); setPage(1); }}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'tree'
                ? 'bg-[#D4A017] text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {tr('عرض شجري', 'Tree View')}
          </button>
          <button
            onClick={() => setViewMode('flat')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'flat'
                ? 'bg-[#D4A017] text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {tr('عرض مسطح', 'Flat View')}
          </button>
        </div>
        {viewMode === 'tree' && (
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {tr('توسيع الكل', 'Expand All')}
            </button>
            <button
              onClick={collapseAll}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {tr('طي الكل', 'Collapse All')}
            </button>
          </div>
        )}
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
              {tr('لا توجد مراكز تكلفة', 'No cost centers found')}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('الرمز', 'Code')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('الاسم', 'Name')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('القسم', 'Department')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('حساب دفتر الأستاذ', 'GL Account')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('المدير', 'Manager')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('الحالة', 'Is Active')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.items.map((item) => (
                <CostCenterRow
                  key={item.id}
                  item={item}
                  depth={0}
                  language={language}
                  tr={tr}
                  expanded={expanded}
                  onToggle={toggleExpand}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination (flat view only) */}
      {viewMode === 'flat' && data && data.totalPages && data.totalPages > 1 && (
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
              onClick={() => setPage((p) => Math.min(data.totalPages!, p + 1))}
              disabled={page >= (data.totalPages ?? 1)}
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
