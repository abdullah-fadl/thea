'use client';

import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function QualityKPIs() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading } = useRoutePermission('/quality/kpis');

  const { data } = useSWR(hasPermission ? '/api/quality/kpis' : null, fetcher, { refreshInterval: 0 });
  const incidentsByType = data?.incidents?.byType || {};
  const incidentsBySeverity = data?.incidents?.bySeverity || {};
  const rcm = data?.rcm || {};

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-4">
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-extrabold text-base">{tr('مؤشرات الحوادث', 'Incident KPIs')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{tr('أعداد للقراءة فقط حسب النوع والشدة.', 'Read-only counts by type and severity.')}</p>
        </div>
        <div className="p-5 grid gap-4 md:grid-cols-2 text-sm">
          <div>
            <div className="font-medium mb-2">{tr('حسب النوع', 'By Type')}</div>
            {Object.keys(incidentsByType).length ? (
              Object.keys(incidentsByType).map((key) => (
                <div key={key} className="flex items-center justify-between px-4 py-2 rounded-xl thea-hover-lift thea-transition-fast">
                  <span>{key}</span>
                  <span>{incidentsByType[key]}</span>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">{tr('لا توجد حوادث.', 'No incidents.')}</div>
            )}
          </div>
          <div>
            <div className="font-medium mb-2">{tr('حسب الشدة', 'By Severity')}</div>
            {Object.keys(incidentsBySeverity).length ? (
              Object.keys(incidentsBySeverity).map((key) => (
                <div key={key} className="flex items-center justify-between px-4 py-2 rounded-xl thea-hover-lift thea-transition-fast">
                  <span>{key}</span>
                  <span>{incidentsBySeverity[key]}</span>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">{tr('لا توجد حوادث.', 'No incidents.')}</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-extrabold text-base">{tr('مقاييس إدارة دورة الإيرادات', 'RCM Metrics')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{tr('أعداد دورة حياة المطالبات.', 'Claims lifecycle counts.')}</p>
        </div>
        <div className="p-5 text-sm space-y-1">
          {Object.keys(rcm).length ? (
            Object.keys(rcm).map((key) => (
              <div key={key} className="flex items-center justify-between px-4 py-2 rounded-xl thea-hover-lift thea-transition-fast">
                <span>{key}</span>
                <span>{rcm[key]}</span>
              </div>
            ))
          ) : (
            <div className="text-muted-foreground">{tr('لا يوجد نشاط مطالبات.', 'No claim activity.')}</div>
          )}
        </div>
      </div>
    </div>
  );
}
