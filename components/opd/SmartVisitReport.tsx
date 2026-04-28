'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { FileText, Printer, Download, RefreshCw, ChevronDown, ChevronUp, ClipboardList } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

interface Props {
  encounterCoreId: string;
}

interface VisitReportSection {
  key: string;
  titleAr: string;
  titleEn: string;
  content: string | null;
  contentAr: string | null;
  isEmpty: boolean;
  items?: Array<{ label: string; labelAr: string; value: string }>;
}

export default function SmartVisitReport({ encounterCoreId }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const isRTL = language === 'ar';
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const { data: report, isLoading, mutate } = useSWR(
    encounterCoreId ? `/api/visit-reports/${encodeURIComponent(encounterCoreId)}` : null,
    fetcher,
  );

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    if (report?.sections) {
      setExpandedSections(new Set(report.sections.filter((s: VisitReportSection) => !s.isEmpty).map((s: VisitReportSection) => s.key)));
    }
  };

  const collapseAll = () => setExpandedSections(new Set());

  const handlePrint = () => {
    window.open(`/api/visit-reports/${encodeURIComponent(encounterCoreId)}?format=html&lang=${language}`, '_blank');
  };

  const handleDownload = async () => {
    const res = await fetch(`/api/visit-reports/${encodeURIComponent(encounterCoreId)}?format=text&lang=${language}`, { credentials: 'include' });
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visit-report-${encounterCoreId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!report || report.error) {
    return (
      <div className="p-6 text-center text-gray-500">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>{tr('لا يوجد تقرير متاح', 'No report available')}</p>
      </div>
    );
  }

  const sections = (report.sections || []).filter((s: VisitReportSection) => !s.isEmpty);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold">{tr('التقرير الذكي', 'Smart Report')}</h3>
          <span className="text-xs text-gray-500">
            {sections.length} {tr('قسم', 'sections')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-blue-600 hover:underline"
          >
            {tr('توسيع الكل', 'Expand All')}
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-blue-600 hover:underline"
          >
            {tr('طي الكل', 'Collapse All')}
          </button>
          <button
            onClick={() => mutate()}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            title={tr('تحديث', 'Refresh')}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 text-sm transition"
          >
            <Printer className="w-3.5 h-3.5" />
            {tr('طباعة', 'Print')}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            {tr('تحميل', 'Download')}
          </button>
        </div>
      </div>

      {/* Patient Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl text-sm">
        <div>
          <div className="text-xs text-gray-500 mb-0.5">{tr('المريض', 'Patient')}</div>
          <div className="font-medium">{report.patient?.fullName}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-0.5">{tr('رقم الملف', 'MRN')}</div>
          <div className="font-medium">{report.patient?.mrn}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-0.5">{tr('الطبيب', 'Doctor')}</div>
          <div className="font-medium">{isRTL ? (report.visit?.doctorAr || report.visit?.doctor) : report.visit?.doctor}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-0.5">{tr('التاريخ', 'Date')}</div>
          <div className="font-medium">{report.visit?.date ? new Date(report.visit.date).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US') : '—'}</div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {sections.map((section: VisitReportSection) => {
          const isExpanded = expandedSections.has(section.key);
          const title = isRTL ? section.titleAr : section.titleEn;

          return (
            <div
              key={section.key}
              className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition text-left"
              >
                <span className="font-medium text-sm">{title}</span>
                <div className="flex items-center gap-2">
                  {section.items && (
                    <span className="text-xs text-gray-400">{section.items.length}</span>
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700/50">
                  {section.items && section.items.length > 0 ? (
                    <table className="w-full text-sm mt-2">
                      <tbody>
                        {section.items.map((item, idx) => (
                          <tr key={idx} className="border-b border-gray-100 dark:border-gray-700/30 last:border-0">
                            <td className="py-2 pe-4 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {isRTL ? item.labelAr : item.label}
                            </td>
                            <td className="py-2 text-gray-600 dark:text-gray-400">
                              {item.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 whitespace-pre-wrap">
                      {isRTL ? (section.contentAr || section.content) : section.content}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-xs text-gray-400 text-center pt-2">
        {tr('تم إنشاء التقرير', 'Report generated')}: {new Date(report.generatedAt).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
      </div>
    </div>
  );
}
