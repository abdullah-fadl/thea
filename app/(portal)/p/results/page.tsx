'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { FileText, TestTube2, Scan, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function ResultsPage() {
  const { data } = useSWR('/api/portal/results', fetcher);
  const [tab, setTab] = useState<'all' | 'lab' | 'radiology'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const router = useRouter();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const labResults = data?.labResults || [];
  const radResults = data?.radiologyResults || [];

  const filteredLabs = tab === 'radiology' ? [] : labResults;
  const filteredRads = tab === 'lab' ? [] : radResults;

  const handleExplain = (type: string, content: string) => {
    const params = new URLSearchParams({ type, content: content.substring(0, 500) });
    router.push(`/p/explain?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{tr('نتائجي', 'My Results')}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'all' as const, label: tr('الكل', 'All') },
          { id: 'lab' as const, label: tr('مختبر', 'Lab') },
          { id: 'radiology' as const, label: tr('أشعة', 'Radiology') },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm ${tab === t.id ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-muted text-muted-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Lab Results */}
      {filteredLabs.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-muted-foreground mb-3 flex items-center gap-2">
            <TestTube2 className="w-4 h-4" /> {tr('نتائج المختبر', 'Lab Results')}
          </h2>
          <div className="space-y-2">
            {filteredLabs.map((result: any) => {
              const id = result.id as string;
              const isExpanded = expandedId === id;
              return (
                <div key={id} className="bg-card rounded-2xl border border-border overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30"
                    onClick={() => setExpandedId(isExpanded ? null : id)}
                  >
                    <div className="flex items-center gap-3">
                      <TestTube2 className="w-4 h-4 text-purple-500" />
                      <div>
                        <h3 className="font-medium text-sm">{result.testName as string || result.orderName as string || tr('فحص مخبري', 'Lab Test')}</h3>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(result.createdAt as string).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(result.isCritical as boolean) && (
                        <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                          {tr('حرج', 'Critical')}
                        </span>
                      )}
                      <span className="text-sm font-bold">{result.value as string || ''}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-border p-4 bg-muted/10">
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        {result.unit && <div><span className="text-muted-foreground">{tr('الوحدة', 'Unit')}: </span>{result.unit as string}</div>}
                        {result.referenceRange && <div><span className="text-muted-foreground">{tr('المدى الطبيعي', 'Normal Range')}: </span>{result.referenceRange as string}</div>}
                        {result.status && <div><span className="text-muted-foreground">{tr('الحالة', 'Status')}: </span>{result.status as string}</div>}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExplain('lab_result', `${result.testName || ''}: ${result.value || ''} ${result.unit || ''} (Reference: ${result.referenceRange || 'N/A'})`);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-xl text-xs hover:bg-violet-200"
                      >
                        <Sparkles className="w-3 h-3" /> {tr('اشرحلي بثيا', 'Explain with Thea')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Radiology Results */}
      {filteredRads.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-muted-foreground mb-3 flex items-center gap-2">
            <Scan className="w-4 h-4" /> {tr('تقارير الأشعة', 'Radiology Reports')}
          </h2>
          <div className="space-y-2">
            {filteredRads.map((result: any) => {
              const id = result.id as string;
              return (
                <div key={id} className="bg-card rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Scan className="w-4 h-4 text-blue-500" />
                      <div>
                        <h3 className="font-medium text-sm">{result.studyDescription as string || result.modality as string || tr('دراسة تصويرية', 'Imaging Study')}</h3>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(result.createdAt as string).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleExplain('radiology_report', result.findings as string || result.impression as string || '')}
                      className="flex items-center gap-1 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-xl text-xs hover:bg-violet-200"
                    >
                      <Sparkles className="w-3 h-3" /> {tr('اشرحلي', 'Explain')}
                    </button>
                  </div>
                  {(result.impression as string) && (
                    <p className="text-xs text-muted-foreground mt-2">{(result.impression as string).substring(0, 200)}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {filteredLabs.length === 0 && filteredRads.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          <FileText className="w-8 h-8 mx-auto mb-2" />
          <p>{tr('لا توجد نتائج بعد', 'No results yet')}</p>
        </div>
      )}
    </div>
  );
}
