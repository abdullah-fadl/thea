'use client';

import useSWR from 'swr';
import { useState } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Microscope, Camera } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface LabResult {
  id: string;
  testName: string;
  testNameAr?: string;
  orderedAt?: string;
  completedAt?: string;
  status: string;
  parameters: {
    name: string;
    nameAr?: string;
    value: string;
    unit: string;
    flag: string;
    referenceRange?: string;
  }[];
}

interface RadiologyResult {
  id: string;
  examName: string;
  examNameAr?: string;
  orderedAt?: string;
  completedAt?: string;
  status: string;
  report: string;
  impression: string;
  radiologist?: string;
  hasImages?: boolean;
}

export default function ResultsPanel({ visitId }: { visitId: string }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [activeTab, setActiveTab] = useState<'lab' | 'radiology'>('lab');

  const { data: labData } = useSWR(`/api/opd/encounters/${visitId}/lab-results`, fetcher);
  const { data: radData } = useSWR(`/api/opd/encounters/${visitId}/radiology-results`, fetcher);

  const labResults: LabResult[] = Array.isArray(labData?.results) ? labData.results : [];
  const radResults: RadiologyResult[] = Array.isArray(radData?.results) ? radData.results : [];

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('lab')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'lab' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Microscope className="h-4 w-4 inline-block" /> {tr('المختبر', 'Lab')} ({labResults.length})
        </button>
        <button
          onClick={() => setActiveTab('radiology')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'radiology'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Camera className="h-4 w-4 inline-block" /> {tr('الأشعة', 'Radiology')} ({radResults.length})
        </button>
      </div>

      {activeTab === 'lab' ? (
        <div className="space-y-4">
          {labResults.length === 0 ? (
            <div className="bg-card rounded-xl border border-slate-200 p-8 text-center text-slate-500">
              {tr('لا توجد نتائج مختبر', 'No lab results')}
            </div>
          ) : (
            labResults.map((result) => (
              <div key={result.id} className="bg-card rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">{result.testNameAr || result.testName}</h3>
                    <p className="text-sm text-slate-500">
                      {result.completedAt ? new Date(result.completedAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : ''}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      result.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {result.status === 'COMPLETED' ? tr('نهائي', 'Final') : tr('أولي', 'Preliminary')}
                  </span>
                </div>

                <table className="w-full">
                  <thead>
                    <tr className="text-right text-sm text-slate-500 bg-slate-50">
                      <th className="px-4 py-2 font-medium">{tr('الفحص', 'Test')}</th>
                      <th className="px-4 py-2 font-medium">{tr('النتيجة', 'Result')}</th>
                      <th className="px-4 py-2 font-medium">{tr('الوحدة', 'Unit')}</th>
                      <th className="px-4 py-2 font-medium">{tr('المرجع', 'Reference')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.parameters.map((param, idx) => (
                      <tr key={idx} className="border-t border-slate-100">
                        <td className="px-4 py-2 font-medium">{param.nameAr || param.name}</td>
                        <td
                          className={`px-4 py-2 font-mono ${
                            param.flag.includes('CRITICAL')
                              ? 'text-red-600 font-bold'
                              : param.flag !== 'NORMAL'
                              ? 'text-amber-600 font-bold'
                              : ''
                          }`}
                        >
                          {param.value}
                          {param.flag !== 'NORMAL' && <span className="ml-2">{param.flag.includes('LOW') ? '↓' : '↑'}</span>}
                        </td>
                        <td className="px-4 py-2 text-slate-500">{param.unit}</td>
                        <td className="px-4 py-2 text-slate-500 text-sm">{param.referenceRange}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {radResults.length === 0 ? (
            <div className="bg-card rounded-xl border border-slate-200 p-8 text-center text-slate-500">
              {tr('لا توجد نتائج أشعة', 'No radiology results')}
            </div>
          ) : (
            radResults.map((result) => (
              <div key={result.id} className="bg-card rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">{result.examNameAr || result.examName}</h3>
                    <p className="text-sm text-slate-500">
                      {result.completedAt ? new Date(result.completedAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : ''} •{' '}
                      {result.radiologist || '—'}
                    </p>
                  </div>
                  {result.hasImages ? (
                    <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 inline-flex items-center gap-1">
                      <Camera className="h-3.5 w-3.5" /> {tr('عرض الصور', 'View images')}
                    </button>
                  ) : null}
                </div>

                <div className="p-4">
                  <div className="mb-4">
                    <h4 className="font-medium text-slate-700 mb-1">{tr('التقرير', 'Report')}</h4>
                    <p className="text-slate-600 whitespace-pre-line">{result.report}</p>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-3">
                    <h4 className="font-medium text-blue-800 mb-1">{tr('الانطباع', 'Impression')}</h4>
                    <p className="text-blue-700">{result.impression}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
