'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { FileText, Calendar, Stethoscope, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

interface VisitSummary {
  encounterId: string;
  date: string;
  department: string;
  doctor: string;
  doctorAr?: string;
  type: string;
  status: string;
  chiefComplaint?: string;
}

export default function PatientReportsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const isRTL = language === 'ar';
  const [selectedVisit, setSelectedVisit] = useState<string | null>(null);

  const { data, isLoading } = useSWR('/api/portal/visit-reports', fetcher);
  const { data: reportData, isLoading: reportLoading } = useSWR(
    selectedVisit ? `/api/portal/visit-reports/${encodeURIComponent(selectedVisit)}` : null,
    fetcher,
  );

  const visits: VisitSummary[] = data?.items || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{tr('تقارير زياراتي', 'My Visit Reports')}</h1>
          <p className="text-sm text-muted-foreground">{tr('سجل الزيارات والتقارير الطبية', 'Visit history and medical reports')}</p>
        </div>
      </div>

      {selectedVisit ? (
        <div>
          <button
            onClick={() => setSelectedVisit(null)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline mb-4"
          >
            {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {tr('رجوع للقائمة', 'Back to list')}
          </button>

          {reportLoading ? (
            <div className="flex items-center justify-center p-12">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : reportData?.error ? (
            <div className="p-6 text-center text-muted-foreground">
              <p>{tr('التقرير غير متاح', 'Report not available')}</p>
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
              {/* Patient header */}
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-semibold">{tr('تقرير الزيارة', 'Visit Report')}</h2>
                  <p className="text-xs text-muted-foreground">{reportData?.reportId}</p>
                </div>
                <button
                  onClick={() => {
                    window.open(
                      `/api/visit-reports/${encodeURIComponent(selectedVisit)}?format=html&lang=${language}`,
                      '_blank',
                    );
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
                >
                  {tr('طباعة', 'Print')}
                </button>
              </div>

              {/* Visit info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{tr('التاريخ', 'Date')}</span>
                  <p className="font-medium">
                    {reportData?.visit?.date
                      ? new Date(reportData.visit.date).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')
                      : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">{tr('الطبيب', 'Doctor')}</span>
                  <p className="font-medium">
                    {isRTL
                      ? reportData?.visit?.doctorAr || reportData?.visit?.doctor
                      : reportData?.visit?.doctor}
                  </p>
                </div>
              </div>

              {/* Sections — patient-safe subset */}
              {reportData?.sections
                ?.filter((s: any) => !s.isEmpty && !['attachments'].includes(s.key))
                .map((section: any) => (
                  <div key={section.key} className="border-t border-border pt-4">
                    <h3 className="font-semibold text-sm text-blue-700 dark:text-blue-400 mb-2">
                      {isRTL ? section.titleAr : section.titleEn}
                    </h3>
                    {section.items && section.items.length > 0 ? (
                      <ul className="space-y-1 text-sm">
                        {section.items.map((item: any, i: number) => (
                          <li key={i} className="flex justify-between py-1 border-b border-border last:border-0">
                            <span className="text-muted-foreground">
                              {isRTL ? item.labelAr : item.label}
                            </span>
                            <span className="text-foreground font-medium">{item.value}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {isRTL ? (section.contentAr || section.content) : section.content}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visits.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-12 text-center">
              <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">{tr('لا توجد زيارات مسجلة', 'No visits recorded')}</p>
            </div>
          ) : (
            visits.map((visit) => (
              <button
                key={visit.encounterId}
                onClick={() => setSelectedVisit(visit.encounterId)}
                className="w-full bg-card rounded-xl border border-border p-4 text-start hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Stethoscope className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        {isRTL ? (visit.doctorAr || visit.doctor) : visit.doctor}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        {new Date(visit.date).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
                        <span>•</span>
                        {visit.department}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {visit.chiefComplaint && (
                      <span className="text-xs text-muted-foreground max-w-[200px] truncate hidden sm:inline">
                        {visit.chiefComplaint}
                      </span>
                    )}
                    {isRTL ? <ChevronLeft className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
