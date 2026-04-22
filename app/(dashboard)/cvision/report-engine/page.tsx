'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionDialog, CVisionDialogFooter, CVisionEmptyState, CVisionInput, CVisionPageHeader, CVisionPageLayout, CVisionSelect, CVisionSkeletonCard, CVisionTabContent, CVisionTabs, CVisionTextarea } from '@/components/cvision/ui';
import { toast } from 'sonner';
import {
  FileText, BarChart3, PieChart, Clock, Play, Copy, Trash2,
  Calendar, Plus, Download, Share2, Table as TableIcon, TrendingUp,
} from 'lucide-react';

const CATEGORY_COLOR: Record<string, 'info' | 'success' | 'purple' | 'warning' | 'muted' | 'danger'> = {
  HR: 'info', PAYROLL: 'success', RECRUITMENT: 'purple', ATTENDANCE: 'warning',
  TRAINING: 'info', INSURANCE: 'danger', CUSTOM: 'muted',
};

const CHART_ICONS: Record<string, any> = {
  TABLE: TableIcon, BAR: BarChart3, LINE: TrendingUp, PIE: PieChart,
  DONUT: PieChart, AREA: TrendingUp, SCATTER: BarChart3,
};

/* ═══ Templates ════════════════════════════════════════════════════ */

function TemplatesTab({ C, isDark, tr, isRTL }: { C: any; isDark: boolean; tr: (a: string, e: string) => string; isRTL: boolean }) {
  const [catFilter, setCatFilter] = useState('ALL');
  const [runResult, setRunResult] = useState<any>(null);
  const [resultOpen, setResultOpen] = useState(false);

  const params: Record<string, string> = { action: 'templates' };
  if (catFilter !== 'ALL') params.category = catFilter;

  const { data: templatesData, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.reportEngine.list({ action: 'templates', catFilter }),
    queryFn: () => cvisionFetch<any>('/api/cvision/report-engine', { params }),
  });
  const templates = templatesData?.templates || [];

  const runMutation = useMutation({
    mutationFn: (tpl: any) => cvisionMutate<any>('/api/cvision/report-engine', 'POST', {
      action: 'run-custom',
      query: { dataSource: tpl.source, filters: [], columns: [{ field: '*', label: 'All', type: 'STRING' }], groupBy: tpl.groupBy || [], sortBy: [] },
    }),
    onMutate: (tpl) => { toast.info(tr('جاري التشغيل...', `Running: ${tpl.name}...`)); },
    onSuccess: (j, tpl) => {
      setRunResult({ name: tpl.name, data: j.data?.items || j.data || [] });
      setResultOpen(true);
    },
  });

  const runTemplate = (tpl: any) => runMutation.mutate(tpl);

  if (loading) return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>{[1,2,3,4,5,6].map(i => <CVisionSkeletonCard key={i} C={C} height={120} />)}</div>;

  const categories = ['ALL', 'HR', 'PAYROLL', 'ATTENDANCE', 'RECRUITMENT', 'TRAINING', 'INSURANCE'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {categories.map(c => (
          <CVisionButton key={c} C={C} isDark={isDark} size="sm" variant={catFilter === c ? 'primary' : 'outline'} onClick={() => { setCatFilter(c); }}>
            {c === 'ALL' ? tr('الكل', 'All') : c}
          </CVisionButton>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {templates.map((tpl: any, i: number) => (
          <CVisionCard key={i} C={C} onClick={() => runTemplate(tpl)}>
            <CVisionCardBody>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <CVisionBadge C={C} variant={CATEGORY_COLOR[tpl.category] || 'muted'}>{tpl.category}</CVisionBadge>
                <Play size={14} color={C.textMuted} />
              </div>
              <div style={{ fontWeight: 500, fontSize: 13, color: C.text, marginBottom: 4 }}>{tpl.name}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{tpl.description}</div>
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>

      <CVisionDialog C={C} open={resultOpen} onClose={() => setResultOpen(false)} title={runResult?.name} isRTL={isRTL} width={800}>
        {runResult?.data?.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, fontSize: 13, color: C.textMuted }}>
            {tr('لا توجد بيانات. قد لا تحتوي هذه المجموعة على بيانات بعد.', 'No data found. This collection may not have data yet.')}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, textAlign: 'left' }}>
                  {runResult?.data?.[0] && Object.keys(runResult.data[0]).filter(k => k !== '_id' && k !== 'tenantId').slice(0, 8).map(k => (
                    <th key={k} style={{ padding: '8px 12px', fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(runResult?.data?.items || runResult?.data || []).slice(0, 50).map((row: any, i: number) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    {Object.entries(row).filter(([k]) => k !== '_id' && k !== 'tenantId').slice(0, 8).map(([k, v]: any) => (
                      <td key={k} style={{ padding: '8px 12px', fontSize: 12, color: C.text }}>{typeof v === 'object' ? JSON.stringify(v).slice(0, 40) : String(v ?? '\u2014')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {(runResult?.data?.items || runResult?.data || []).length > 50 && (
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>
                {tr('عرض 50 من', 'Showing 50 of')} {runResult.data.length} {tr('صفوف', 'rows')}
              </div>
            )}
          </div>
        )}
      </CVisionDialog>
    </div>
  );
}

/* ═══ My Reports ═══════════════════════════════════════════════════ */

function MyReportsTab({ C, isDark, tr }: { C: any; isDark: boolean; tr: (a: string, e: string) => string }) {
  const queryClient = useQueryClient();

  const { data: reportsData, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.reportEngine.list({ action: 'saved-reports' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/report-engine', { params: { action: 'saved-reports' } }),
  });
  const reports = reportsData?.reports || [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: cvisionKeys.reportEngine.all });

  const runReport = async (reportId: string) => {
    toast.info(tr('جاري تشغيل التقرير...', 'Running report...'));
    const j = await cvisionFetch<any>('/api/cvision/report-engine', { params: { action: 'run-report', reportId } });
    toast.success(tr(`التقرير أرجع ${(j.data?.items || j.data || []).length} صفوف`, `Report returned ${(j.data?.items || j.data || []).length} rows`));
  };

  const duplicateMutation = useMutation({
    mutationFn: (reportId: string) => cvisionMutate<any>('/api/cvision/report-engine', 'POST', { action: 'duplicate', reportId }),
    onSuccess: () => { toast.success(tr('تم تكرار التقرير', 'Report duplicated')); invalidate(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (reportId: string) => cvisionMutate<any>('/api/cvision/report-engine', 'POST', { action: 'delete', reportId }),
    onSuccess: () => { toast.success(tr('تم حذف التقرير', 'Report deleted')); invalidate(); },
  });

  const duplicateReport = (reportId: string) => duplicateMutation.mutate(reportId);
  const deleteReport = (reportId: string) => deleteMutation.mutate(reportId);

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2].map(i => <CVisionSkeletonCard key={i} C={C} height={80} />)}</div>;
  if (reports.length === 0) return <CVisionEmptyState C={C} icon={FileText} title={tr('لا توجد تقارير محفوظة', 'No saved reports')} description={tr('أنشئ تقريرا من القوالب أو مخصص', 'Create one from the Templates or Custom tab.')} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {reports.map((rpt: any) => {
        const ChartIcon = CHART_ICONS[rpt.chartType] || TableIcon;
        return (
          <CVisionCard key={rpt.reportId} C={C}>
            <CVisionCardBody style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ChartIcon size={18} color={C.textMuted} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{rpt.name}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{rpt.description || rpt.category} · Chart: {rpt.chartType}</div>
                  {rpt.lastRunAt && <div style={{ fontSize: 11, color: C.textMuted }}>{tr('آخر تشغيل', 'Last run')}: {new Date(rpt.lastRunAt).toLocaleDateString()}</div>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CVisionBadge C={C} variant={CATEGORY_COLOR[rpt.category] || 'muted'}>{rpt.category}</CVisionBadge>
                {rpt.scheduled && <CVisionBadge C={C} variant="muted"><Calendar size={10} /> {tr('مجدول', 'Scheduled')}</CVisionBadge>}
                <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => runReport(rpt.reportId)} icon={<Play size={12} />}>{tr('تشغيل', 'Run')}</CVisionButton>
                <CVisionButton C={C} isDark={isDark} size="sm" variant="ghost" onClick={() => duplicateReport(rpt.reportId)}><Copy size={12} /></CVisionButton>
                <CVisionButton C={C} isDark={isDark} size="sm" variant="danger" onClick={() => deleteReport(rpt.reportId)}><Trash2 size={12} /></CVisionButton>
              </div>
            </CVisionCardBody>
          </CVisionCard>
        );
      })}
    </div>
  );
}

/* ═══ Scheduled ════════════════════════════════════════════════════ */

function ScheduledTab({ C, isDark, tr }: { C: any; isDark: boolean; tr: (a: string, e: string) => string }) {
  const { data: scheduledData, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.reportEngine.list({ action: 'schedule-list' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/report-engine', { params: { action: 'schedule-list' } }),
  });
  const scheduled = scheduledData?.scheduled || [];

  if (loading) return <CVisionSkeletonCard C={C} height={180} />;
  if (scheduled.length === 0) return <CVisionEmptyState C={C} icon={Clock} title={tr('لا توجد تقارير مجدولة', 'No scheduled reports.')} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {scheduled.map((rpt: any) => (
        <CVisionCard key={rpt.reportId} C={C}>
          <CVisionCardBody style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{rpt.name}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>
                {rpt.schedule?.frequency} {tr('في', 'at')} {rpt.schedule?.time} · {tr('التنسيق', 'Format')}: {rpt.schedule?.format}
              </div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{tr('المستلمون', 'Recipients')}: {(rpt.schedule?.recipients || []).join(', ')}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CVisionBadge C={C} variant={CATEGORY_COLOR[rpt.category] || 'muted'}>{rpt.category}</CVisionBadge>
              <Clock size={16} color={C.textMuted} />
            </div>
          </CVisionCardBody>
        </CVisionCard>
      ))}
    </div>
  );
}

/* ═══ Create Custom ════════════════════════════════════════════════ */

function CreateCustomTab({ C, isDark, tr }: { C: any; isDark: boolean; tr: (a: string, e: string) => string }) {
  const [form, setForm] = useState({
    name: '', description: '', category: 'HR', dataSource: 'cvision_employees',
    chartType: 'TABLE', groupByField: '',
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => cvisionMutate<any>('/api/cvision/report-engine', 'POST', data),
    onSuccess: () => {
      toast.success(tr('تم حفظ التقرير!', 'Report saved!'));
      setForm({ name: '', description: '', category: 'HR', dataSource: 'cvision_employees', chartType: 'TABLE', groupByField: '' });
    },
  });

  const save = () => {
    if (!form.name) { toast.error(tr('الاسم مطلوب', 'Name is required')); return; }
    saveMutation.mutate({
      action: 'save-report', name: form.name, description: form.description,
      category: form.category, chartType: form.chartType,
      query: { dataSource: form.dataSource, filters: [], columns: [{ field: '*', label: 'All', type: 'STRING' }], groupBy: form.groupByField ? [form.groupByField] : [], sortBy: [] },
    });
  };

  const dataSources = [
    'cvision_employees', 'cvision_payroll', 'cvision_attendance', 'cvision_leaves',
    'cvision_candidates', 'cvision_jobs', 'cvision_training_enrollments',
    'cvision_employee_insurance', 'cvision_insurance_claims',
  ];

  return (
    <CVisionCard C={C}>
      <CVisionCardHeader C={C}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('إنشاء تقرير مخصص', 'Create Custom Report')}</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{tr('قم ببناء تقرير عبر اختيار مصدر البيانات والتجميع ونوع الرسم', 'Build a report by selecting data source, grouping, and chart type')}</div>
      </CVisionCardHeader>
      <CVisionCardBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <CVisionInput C={C} label={tr('اسم التقرير', 'Report Name')} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Monthly Attrition" />
            <CVisionSelect C={C} label={tr('الفئة', 'Category')} value={form.category}
              onChange={v => setForm(p => ({ ...p, category: v }))}
              options={['HR','PAYROLL','RECRUITMENT','ATTENDANCE','TRAINING','INSURANCE','CUSTOM'].map(c => ({ value: c, label: c }))}
            />
          </div>
          <CVisionTextarea C={C} label={tr('الوصف', 'Description')} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder={tr('وصف مختصر للتقرير', 'Brief description of the report')} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <CVisionSelect C={C} label={tr('مصدر البيانات', 'Data Source')} value={form.dataSource}
              onChange={v => setForm(p => ({ ...p, dataSource: v }))}
              options={dataSources.map(d => ({ value: d, label: d.replace('cvision_', '').replace(/_/g, ' ') }))}
            />
            <CVisionInput C={C} label={tr('التجميع (اختياري)', 'Group By (optional)')} value={form.groupByField} onChange={e => setForm(p => ({ ...p, groupByField: e.target.value }))} placeholder="e.g. department" />
            <CVisionSelect C={C} label={tr('نوع الرسم', 'Chart Type')} value={form.chartType}
              onChange={v => setForm(p => ({ ...p, chartType: v }))}
              options={['TABLE','BAR','LINE','PIE','DONUT','AREA','SCATTER'].map(c => ({ value: c, label: c }))}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => toast.info(tr('المعاينة غير متاحة بعد', 'Preview not yet implemented'))}>{tr('معاينة', 'Preview')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} variant="primary" onClick={save} icon={<Plus size={14} />}>{tr('حفظ التقرير', 'Save Report')}</CVisionButton>
          </div>
        </div>
      </CVisionCardBody>
    </CVisionCard>
  );
}

/* ═══ Main Page ════════════════════════════════════════════════════ */

export default function ReportEnginePage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [activeTab, setActiveTab] = useState('templates');

  const tabs = [
    { id: 'templates', label: 'Templates', labelAr: 'القوالب', icon: <FileText size={14} /> },
    { id: 'saved', label: 'My Reports', labelAr: 'تقاريري', icon: <BarChart3 size={14} /> },
    { id: 'scheduled', label: 'Scheduled', labelAr: 'مجدولة', icon: <Clock size={14} /> },
    { id: 'create', label: 'Create Custom', labelAr: 'إنشاء مخصص', icon: <Plus size={14} /> },
  ];

  return (
    <CVisionPageLayout>
      <CVisionPageHeader C={C} title={tr('محرك التقارير المتقدم', 'Advanced Reporting Engine')} titleEn="Advanced Reporting Engine" icon={FileText} isRTL={isRTL}
        subtitle={tr('قوالب جاهزة وتقارير مخصصة وجدولة وتصدير بيانات', 'Pre-built templates, custom reports, scheduling & data export')}
      />
      <CVisionTabs C={C} tabs={tabs} activeTab={activeTab} onChange={setActiveTab} isRTL={isRTL} />

      <CVisionTabContent id="templates" activeTab={activeTab}><TemplatesTab C={C} isDark={isDark} tr={tr} isRTL={isRTL} /></CVisionTabContent>
      <CVisionTabContent id="saved" activeTab={activeTab}><MyReportsTab C={C} isDark={isDark} tr={tr} /></CVisionTabContent>
      <CVisionTabContent id="scheduled" activeTab={activeTab}><ScheduledTab C={C} isDark={isDark} tr={tr} /></CVisionTabContent>
      <CVisionTabContent id="create" activeTab={activeTab}><CreateCustomTab C={C} isDark={isDark} tr={tr} /></CVisionTabContent>
    </CVisionPageLayout>
  );
}
