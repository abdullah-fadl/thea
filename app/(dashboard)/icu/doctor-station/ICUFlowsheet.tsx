'use client';

import React, { useState, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import {
  ChevronDown, ChevronRight, RefreshCw, Clock, Printer,
  Activity, Wind, Droplets, FlaskConical, Brain, Heart,
  Thermometer, TrendingUp,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// ---------- Types ----------
interface FlowsheetCell {
  value: string | number | null;
  abnormal: boolean;
  critical: boolean;
}

interface FlowsheetRow {
  category: string;
  parameter: string;
  paramKey: string;
  unit: string;
  values: Record<string, FlowsheetCell>;
}

interface FlowsheetData {
  episodeId: string;
  hours: number;
  hourColumns: string[];
  rows: FlowsheetRow[];
}

// ---------- Category Config ----------
interface CategoryConfig {
  key: string;
  label: (tr: (a: string, e: string) => string) => string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  headerBg: string;
}

const CATEGORIES: CategoryConfig[] = [
  {
    key: 'vitals',
    label: (tr) => tr('الإشارات الحيوية', 'Vitals'),
    icon: <Activity className="w-3.5 h-3.5" />,
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    headerBg: 'bg-red-100',
  },
  {
    key: 'ventilator',
    label: (tr) => tr('جهاز التنفس', 'Ventilator'),
    icon: <Wind className="w-3.5 h-3.5" />,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    headerBg: 'bg-blue-100',
  },
  {
    key: 'abg',
    label: (tr) => tr('غازات الدم', 'ABG'),
    icon: <Droplets className="w-3.5 h-3.5" />,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    headerBg: 'bg-purple-100',
  },
  {
    key: 'hemodynamics',
    label: (tr) => tr('الديناميكا الدموية', 'Hemodynamics'),
    icon: <Heart className="w-3.5 h-3.5" />,
    color: 'text-pink-700',
    bgColor: 'bg-pink-50',
    headerBg: 'bg-pink-100',
  },
  {
    key: 'drips',
    label: (tr) => tr('الأدوية المستمرة', 'Drips'),
    icon: <Thermometer className="w-3.5 h-3.5" />,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    headerBg: 'bg-orange-100',
  },
  {
    key: 'io',
    label: (tr) => tr('الدخل / الخرج', 'I/O'),
    icon: <Droplets className="w-3.5 h-3.5" />,
    color: 'text-teal-700',
    bgColor: 'bg-teal-50',
    headerBg: 'bg-teal-100',
  },
  {
    key: 'labs',
    label: (tr) => tr('المختبر', 'Labs'),
    icon: <FlaskConical className="w-3.5 h-3.5" />,
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    headerBg: 'bg-green-100',
  },
  {
    key: 'scores',
    label: (tr) => tr('الدرجات', 'Scores'),
    icon: <Brain className="w-3.5 h-3.5" />,
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    headerBg: 'bg-indigo-100',
  },
];

// ---------- Component ----------
interface ICUFlowsheetProps {
  episodeId: string;
}

export default function ICUFlowsheet({ episodeId }: ICUFlowsheetProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [timeRange, setTimeRange] = useState<12 | 24 | 48>(24);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { data, isLoading, mutate } = useSWR<FlowsheetData>(
    `/api/icu/doctors/flowsheet?episodeId=${episodeId}&hours=${timeRange}`,
    fetcher,
    { refreshInterval: 60000 },
  );

  const hourColumns = data?.hourColumns || [];
  const rows = data?.rows || [];

  // Group rows by category
  const grouped = useMemo(() => {
    const map = new Map<string, FlowsheetRow[]>();
    for (const row of rows) {
      const existing = map.get(row.category) || [];
      existing.push(row);
      map.set(row.category, existing);
    }
    return map;
  }, [rows]);

  // Format hour column header
  function formatHour(hk: string): string {
    // hk format: "2026-03-03T14"
    const h = parseInt(hk.slice(11, 13), 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}${ampm}`;
  }

  function formatDate(hk: string): string {
    return hk.slice(5, 10); // "03-03"
  }

  // Toggle category collapse
  function toggleCategory(catKey: string) {
    setCollapsed((prev) => ({ ...prev, [catKey]: !prev[catKey] }));
  }

  // Print handler
  function handlePrint() {
    window.print();
  }

  // Detect date boundaries for header grouping
  const dateGroups = useMemo(() => {
    const groups: { date: string; cols: string[] }[] = [];
    let currentDate = '';
    for (const hk of hourColumns) {
      const d = formatDate(hk);
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: d, cols: [hk] });
      } else {
        groups[groups.length - 1].cols.push(hk);
      }
    }
    return groups;
  }, [hourColumns]);

  // Cell rendering
  function renderCell(cell: FlowsheetCell | undefined) {
    if (!cell || cell.value === null || cell.value === undefined) {
      return <span className="text-muted-foreground">·</span>;
    }
    let bg = '';
    if (cell.critical) bg = 'bg-red-200 text-red-900 font-bold';
    else if (cell.abnormal) bg = 'bg-yellow-100 text-yellow-900 font-semibold';

    const displayVal = typeof cell.value === 'number'
      ? (Number.isInteger(cell.value) ? cell.value : cell.value.toFixed(1))
      : cell.value;

    return (
      <span className={`inline-block px-0.5 rounded ${bg}`} title={String(cell.value)}>
        {displayVal}
      </span>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-60 text-muted-foreground text-sm">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> {tr('جاري تحميل ورقة المتابعة...', 'Loading flowsheet...')}
      </div>
    );
  }

  if (!data || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-60 text-muted-foreground text-sm gap-2">
        <TrendingUp className="w-8 h-8 opacity-30" />
        {tr('لا توجد بيانات لورقة المتابعة', 'No flowsheet data available')}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{tr('ورقة المتابعة', 'ICU Flowsheet')}</span>
        </div>
        <div className="flex items-center gap-2">
          {([12, 24, 48] as const).map((h) => (
            <button key={h}
              onClick={() => setTimeRange(h)}
              className={`px-3 py-1 rounded text-xs font-medium transition
                ${timeRange === h ? 'bg-blue-600 text-white' : 'border text-muted-foreground hover:bg-muted/50'}`}>
              {h}{tr('س', 'h')}
            </button>
          ))}
          <button onClick={() => mutate()} className="p-1.5 border rounded hover:bg-muted/50" title={tr('تحديث', 'Refresh')}>
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={handlePrint} className="p-1.5 border rounded hover:bg-muted/50" title={tr('طباعة', 'Print')}>
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Flowsheet Grid */}
      <div className="border rounded-lg overflow-hidden">
        <div ref={scrollRef} className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]" style={{ minWidth: hourColumns.length * 52 + 180 }}>
            {/* Date Header Row */}
            <thead>
              <tr className="bg-muted">
                <th className="sticky left-0 z-20 bg-muted border-r w-[180px] min-w-[180px] px-2 py-1 text-left">
                  {tr('المتغير', 'Parameter')}
                </th>
                {dateGroups.map((dg) => (
                  <th key={dg.date} colSpan={dg.cols.length}
                    className="px-1 py-0.5 text-center border-l font-bold text-foreground bg-muted">
                    {dg.date}
                  </th>
                ))}
              </tr>
              {/* Hour Header Row */}
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-20 bg-muted/50 border-r w-[180px] min-w-[180px] px-2 py-0.5 text-left text-muted-foreground">
                  {tr('الوحدة', 'Unit')}
                </th>
                {hourColumns.map((hk) => (
                  <th key={hk} className="px-0.5 py-0.5 text-center border-l font-medium text-muted-foreground min-w-[48px]">
                    {formatHour(hk)}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {CATEGORIES.map((cat) => {
                const catRows = grouped.get(cat.key) || [];
                if (catRows.length === 0) return null;
                const isCollapsed = collapsed[cat.key] || false;

                return (
                  <React.Fragment key={cat.key}>
                    {/* Category Header */}
                    <tr className={`${cat.headerBg} cursor-pointer select-none`}
                      onClick={() => toggleCategory(cat.key)}>
                      <td className={`sticky left-0 z-10 ${cat.headerBg} border-r px-2 py-1 font-bold ${cat.color}`}
                        colSpan={1}>
                        <div className="flex items-center gap-1.5">
                          {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {cat.icon}
                          {cat.label(tr)}
                          <span className="text-muted-foreground font-normal">({catRows.length})</span>
                        </div>
                      </td>
                      <td colSpan={hourColumns.length} className={`${cat.headerBg}`} />
                    </tr>

                    {/* Parameter Rows */}
                    {!isCollapsed && catRows.map((row) => (
                      <tr key={row.paramKey} className={`${cat.bgColor} hover:bg-white/50 transition`}>
                        <td className={`sticky left-0 z-10 ${cat.bgColor} border-r px-2 py-0.5`}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">{row.parameter}</span>
                            <span className="text-[9px] text-muted-foreground ml-1 shrink-0">{row.unit}</span>
                          </div>
                        </td>
                        {hourColumns.map((hk) => (
                          <td key={hk} className="px-0.5 py-0.5 text-center border-l">
                            {renderCell(row.values[hk])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" />
          {tr('غير طبيعي', 'Abnormal')}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-200 border border-red-300" />
          {tr('حرج', 'Critical')}
        </span>
        <span className="flex items-center gap-1">
          <span className="text-muted-foreground">·</span>
          {tr('لا توجد بيانات', 'No data')}
        </span>
        <span className="ml-auto">{tr('آخر تحديث كل دقيقة', 'Auto-refresh every 60s')}</span>
      </div>
    </div>
  );
}
