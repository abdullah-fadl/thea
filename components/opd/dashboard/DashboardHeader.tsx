'use client';

import { useLang } from '@/hooks/use-lang';
import TimeFilter, { TimeFilterValue } from '@/components/TimeFilter';
import { useState } from 'react';
import { Building2, Download, FileSpreadsheet, Filter, RefreshCw } from 'lucide-react';

interface DashboardHeaderProps {
  filter: TimeFilterValue;
  onFilterChange: (v: TimeFilterValue) => void;
  onRefresh: () => void;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  isLoading?: boolean;
  isRefreshing?: boolean;
  lastUpdated?: Date | null;
}

export default function DashboardHeader({
  filter,
  onFilterChange,
  onRefresh,
  onExportPDF,
  onExportExcel,
  isLoading,
  isRefreshing,
  lastUpdated,
}: DashboardHeaderProps) {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [showFilter, setShowFilter] = useState(false);

  return (
    <div className="bg-card border border-border rounded-xl mb-3">
      <div className="max-w-[1600px] mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl shadow-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {tr('مركز قيادة العيادات الخارجية', 'OPD Command Center')}
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                {isRefreshing && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden />
                )}
                {lastUpdated
                  ? tr(
                      `آخر تحديث: ${lastUpdated.toLocaleTimeString('ar-SA')}`,
                      `Last updated: ${lastUpdated.toLocaleTimeString('en-US')}`
                    )
                  : tr('نظرة عامة على العيادات الخارجية', 'Outpatient overview')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
              title={tr('تحديث', 'Refresh')}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            {onExportPDF && (
              <button
                onClick={onExportPDF}
                className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"
                title={tr('تصدير PDF', 'Export PDF')}
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            {onExportExcel && (
              <button
                onClick={onExportExcel}
                className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"
                title={tr('تصدير Excel', 'Export Excel')}
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setShowFilter(!showFilter)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-lg transition-colors ${
                showFilter
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              {showFilter ? tr('إخفاء الفلتر', 'Hide filter') : tr('عرض الفلتر', 'Show filter')}
            </button>
          </div>
        </div>
      </div>
      {showFilter && (
        <div className="max-w-[1600px] mx-auto px-4 pb-4">
          <TimeFilter value={filter} onChange={onFilterChange} onApply={onRefresh} />
        </div>
      )}
    </div>
  );
}
