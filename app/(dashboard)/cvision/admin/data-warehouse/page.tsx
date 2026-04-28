'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionPageLayout, CVisionPageHeader, CVisionCard, CVisionCardHeader, CVisionCardBody,
  CVisionButton, CVisionBadge, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { Database, Play, Download, CheckCircle, Loader2, Clock } from 'lucide-react';

export default function DataWarehousePage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const queryClient = useQueryClient();

  const [etlResult, setEtlResult] = useState<any>(null);

  const { data: tablesData } = useQuery({
    queryKey: cvisionKeys.admin.dataWarehouse.list({ view: 'tables' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/data-warehouse', { params: { action: 'tables' } }),
  });
  const { data: statusData } = useQuery({
    queryKey: cvisionKeys.admin.dataWarehouse.list({ view: 'status' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/data-warehouse', { params: { action: 'status' } }),
  });

  const tables = tablesData?.ok ? (tablesData.data || []) : [];
  const lastRun = statusData?.ok ? statusData.data : null;

  const etlMutation = useMutation({
    mutationFn: () => cvisionMutate<any>('/api/cvision/data-warehouse', 'POST', { action: 'run-etl' }),
    onSuccess: (d) => { if (d.ok) { setEtlResult(d.data); queryClient.invalidateQueries({ queryKey: cvisionKeys.admin.dataWarehouse.all }); } },
  });
  const running = etlMutation.isPending;

  const exportTable = (table: string) => {
    window.open(`/api/cvision/data-warehouse?action=export&table=${table}`, '_blank');
  };

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('مستودع البيانات', 'Data Warehouse')}
        titleEn="Data Warehouse"
        icon={Database}
        iconColor={C.blue}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} onClick={() => etlMutation.mutate()} disabled={running} icon={running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}>
            {tr('تشغيل ETL', 'Run ETL')}
          </CVisionButton>
        }
      />

      {lastRun && (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <CheckCircle size={20} color={C.green} />
            <div>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{tr('آخر تشغيل ETL', 'Last ETL Run')}</span>
              <div style={{ fontSize: 12, color: C.textMuted }}>{new Date(lastRun.completedAt).toLocaleString()}</div>
            </div>
            <CVisionBadge C={C} variant="muted"><Clock size={12} style={{ marginRight: 4 }} />{lastRun.durationMs}ms</CVisionBadge>
            <CVisionBadge C={C} variant="info">{lastRun.tablesUpdated} {tr('جدول', 'tables')}</CVisionBadge>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {etlResult && (
        <CVisionCard C={C} style={{ border: `1px solid ${C.green}40` }}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.green }}>{tr('اكتمل ETL', 'ETL Completed')} ({etlResult.durationMs}ms)</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {etlResult.results?.map((r: any) => (
                <div key={r.table} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.text }}>
                  <span>{r.table}</span>
                  <span style={{ fontWeight: 500 }}>{r.rowCount} {tr('صف', 'rows')} ({r.duration}ms)</span>
                </div>
              ))}
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {tables.map(t => (
          <CVisionCard C={C} key={t.name}>
            <CVisionCardBody style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{t.description}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginTop: 8 }}>
                    {t.rowCount.toLocaleString()} <span style={{ fontSize: 13, fontWeight: 400, color: C.textMuted }}>{tr('صف', 'rows')}</span>
                  </div>
                </div>
                <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" onClick={() => exportTable(t.name)} icon={<Download size={16} />} />
              </div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 8, fontFamily: 'monospace' }}>{t.name}</div>
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>

      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('اتصال BI', 'BI Connection')}</span>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ fontSize: 13, color: C.text, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div><strong>{tr('نقطة OData:', 'OData Endpoint:')}</strong> <code style={{ background: C.bgSubtle, padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>/api/cvision/bi/odata/fact_employees</code></div>
            <div><strong>{tr('يدعم', 'Supports')}:</strong> $filter, $select, $orderby, $top, $skip</div>
            <div style={{ color: C.textMuted }}>{tr('اربط PowerBI أو Tableau باستخدام موصل OData مع الرابط أعلاه.', 'Connect PowerBI or Tableau using the OData connector with the URL above.')}</div>
          </div>
        </CVisionCardBody>
      </CVisionCard>
    </CVisionPageLayout>
  );
}
