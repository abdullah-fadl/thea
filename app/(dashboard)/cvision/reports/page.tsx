'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionPageLayout, CVisionPageHeader, CVisionCard, CVisionCardHeader, CVisionCardBody,
  CVisionButton, CVisionBadge, CVisionInput, CVisionSkeletonCard, CVisionEmptyState,
  CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd,
  CVisionTabs, CVisionTabContent, type CVisionTabItem, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import {
  FileBarChart, Download, Play, ChevronRight, Loader2, ArrowLeft,
  Users, DollarSign, GraduationCap, Briefcase, ClipboardList, Shield,
  Calendar, FileText, CreditCard, BarChart3, Building2, Package,
} from 'lucide-react';
import { toast } from 'sonner';

/* -- Category config -------------------------------------------------------- */

const CATEGORIES = [
  { key: 'all', label: 'All Reports', labelAr: 'كل التقارير', icon: FileBarChart },
  { key: 'HR', label: 'Human Resources', labelAr: 'الموارد البشرية', icon: Users },
  { key: 'PAYROLL', label: 'Payroll & Compensation', labelAr: 'الرواتب والتعويضات', icon: DollarSign },
  { key: 'ATTENDANCE', label: 'Attendance & Leaves', labelAr: 'الحضور والإجازات', icon: Calendar },
  { key: 'RECRUITMENT', label: 'Recruitment', labelAr: 'التوظيف', icon: Briefcase },
  { key: 'TRAINING', label: 'Training', labelAr: 'التدريب', icon: GraduationCap },
  { key: 'COMPLIANCE', label: 'Compliance & Assets', labelAr: 'الامتثال والأصول', icon: Shield },
];

const TEMPLATE_CATEGORY: Record<string, string> = {
  'headcount': 'HR', 'turnover': 'HR', 'saudization': 'HR', 'employee-master': 'HR',
  'contract-expiry': 'HR', 'document-expiry': 'HR',
  'payroll-summary': 'PAYROLL', 'compensation': 'PAYROLL', 'loan-outstanding': 'PAYROLL',
  'leave-balance': 'ATTENDANCE',
  'recruitment': 'RECRUITMENT',
  'training': 'TRAINING', 'performance': 'TRAINING',
  'compliance': 'COMPLIANCE', 'asset-inventory': 'COMPLIANCE',
};

const TEMPLATE_ICONS: Record<string, any> = {
  'headcount': Users, 'turnover': BarChart3, 'saudization': Building2,
  'employee-master': ClipboardList, 'contract-expiry': Calendar, 'document-expiry': FileText,
  'payroll-summary': DollarSign, 'compensation': CreditCard, 'loan-outstanding': CreditCard,
  'leave-balance': Calendar, 'recruitment': Briefcase, 'training': GraduationCap,
  'performance': BarChart3, 'compliance': Shield, 'asset-inventory': Package,
};

/* -- Component -------------------------------------------------------------- */

export default function ReportsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [selected, setSelected] = useState<any>(null);
  const [results, setResults] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [groupBy, setGroupBy] = useState('');
  const [category, setCategory] = useState('all');

  const { data: templatesData, isLoading: pageLoading } = useQuery({
    queryKey: cvisionKeys.reports.list({ action: 'templates' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/reports', { params: { action: 'templates' } }),
  });
  const templates = templatesData?.data || [];

  const generateMutation = useMutation({
    mutationFn: (tpl: any) => {
      const filters: any[] = [];
      if (dateFrom) filters.push({ field: 'createdAt', operator: 'gte', value: dateFrom });
      if (dateTo) filters.push({ field: 'createdAt', operator: 'lte', value: dateTo });
      return cvisionMutate<any>('/api/cvision/reports', 'POST', {
        action: 'generate', templateKey: tpl.key,
        filters: filters.length ? filters : undefined,
        groupBy: groupBy || undefined,
      });
    },
    onSuccess: (d) => {
      if (d.ok) { setResults(d.data); toast.success(tr(`تم إنشاء التقرير — ${d.data?.total || 0} سجل`, `Report generated — ${d.data?.total || 0} records`)); }
      else toast.error(d.error || tr('فشل في الإنشاء', 'Failed to generate'));
    },
    onError: () => toast.error(tr('خطأ في الشبكة', 'Network error')),
  });

  const loading = generateMutation.isPending;

  const generate = (tpl: any) => {
    setResults(null);
    generateMutation.mutate(tpl);
  };

  const exportCSV = async () => {
    if (!selected || !results) return;
    const fields = selected.defaultFields || [];
    const header = fields.map((f: string) => f.replace(/([A-Z])/g, ' $1').replace(/^./, (s: string) => s.toUpperCase())).join(',');
    const rows = (results.data || []).map((row: any) =>
      fields.map((f: string) => `"${String(row[f] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${selected.key}-report.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(tr('تم تصدير CSV', 'CSV exported'));
  };

  /* -- Loading ------------------------------------------------------------ */

  if (pageLoading) return (
    <CVisionPageLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <CVisionSkeletonCard C={C} height={40} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[...Array(6)].map((_, i) => <CVisionSkeletonCard key={i} C={C} height={112} />)}
        </div>
      </div>
    </CVisionPageLayout>
  );

  /* -- Report Detail + Results -------------------------------------------- */

  if (selected) {
    const Icon = TEMPLATE_ICONS[selected.key] || FileBarChart;

    const getStatusVariant = (val: string): 'success' | 'danger' | 'warning' | 'muted' => {
      if (['ACTIVE', 'COMPLETED', 'HIRED', 'APPROVED'].includes(val)) return 'success';
      if (['RESIGNED', 'TERMINATED', 'CANCELLED', 'OPEN'].includes(val)) return 'danger';
      if (['PROBATION', 'PENDING', 'IN_PROGRESS', 'PLANNING'].includes(val)) return 'warning';
      return 'muted';
    };

    return (
      <CVisionPageLayout>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => { setSelected(null); setResults(null); setGroupBy(''); }} icon={<ArrowLeft size={16} />}>
            {tr('رجوع', 'Back')}
          </CVisionButton>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: C.goldDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={20} color={C.gold} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{selected.name}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{selected.nameAr}</div>
          </div>
        </div>

        {/* Parameters */}
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('معاملات التقرير', 'Report Parameters')}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{selected.description}</div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
              <CVisionInput C={C} label={tr('من تاريخ', 'From Date')} type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 160 }} />
              <CVisionInput C={C} label={tr('إلى تاريخ', 'To Date')} type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 160 }} />
              <CVisionInput C={C} label={tr('تجميع حسب', 'Group By')} placeholder={tr('مثال: القسم', 'e.g. department')} value={groupBy} onChange={e => setGroupBy(e.target.value)} style={{ width: 176 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <CVisionButton C={C} isDark={isDark} onClick={() => generate(selected)} disabled={loading} icon={loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}>
                  {tr('إنشاء', 'Generate')}
                </CVisionButton>
                {results && (
                  <CVisionButton C={C} isDark={isDark} variant="outline" onClick={exportCSV} icon={<Download size={14} />}>
                    {tr('تصدير CSV', 'Export CSV')}
                  </CVisionButton>
                )}
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>

        {/* Loading */}
        {loading && (
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: '48px 20px', textAlign: 'center' }}>
              <Loader2 size={32} color={C.gold} style={{ margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 13, color: C.textMuted }}>{tr('جاري إنشاء التقرير...', 'Generating report...')}</div>
            </CVisionCardBody>
          </CVisionCard>
        )}

        {/* Results */}
        {results && !loading && (
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('النتائج', 'Results')}</div>
                <CVisionBadge C={C} variant="muted">{results.total} {tr('سجل', 'records')}</CVisionBadge>
              </div>
            </CVisionCardHeader>
            <CVisionCardBody>
              {results.grouped ? (
                <CVisionTable C={C}>
                  <CVisionTableHead C={C}>
                    <CVisionTh C={C}>{tr('المجموعة', 'Group')}</CVisionTh>
                    <CVisionTh C={C} align="right" width={96}>{tr('العدد', 'Count')}</CVisionTh>
                  </CVisionTableHead>
                  <CVisionTableBody>
                    {(results.data || []).map((row: any, i: number) => (
                      <CVisionTr C={C} key={i}>
                        <CVisionTd style={{ fontWeight: 500, color: C.text }}>{row._id || '—'}</CVisionTd>
                        <CVisionTd align="right" style={{ fontWeight: 700, color: C.text }}>{row.count}</CVisionTd>
                      </CVisionTr>
                    ))}
                  </CVisionTableBody>
                </CVisionTable>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <CVisionTable C={C}>
                    <CVisionTableHead C={C}>
                      {(selected.defaultFields || []).map((f: string) => (
                        <CVisionTh C={C} key={f}>
                          {f.replace(/([A-Z])/g, ' $1').replace(/^./, (s: string) => s.toUpperCase())}
                        </CVisionTh>
                      ))}
                    </CVisionTableHead>
                    <CVisionTableBody>
                      {(results.data || []).length === 0 ? (
                        <CVisionTr C={C}>
                          <CVisionTd style={{ textAlign: 'center', color: C.textMuted, padding: '32px 14px' }}>
                            {tr('لا توجد بيانات', 'No data found')}
                          </CVisionTd>
                        </CVisionTr>
                      ) : (results.data || []).slice(0, 200).map((row: any, i: number) => (
                        <CVisionTr C={C} key={i}>
                          {(selected.defaultFields || []).map((f: string) => {
                            const val = row[f];
                            if (f === 'status' && val) {
                              return <CVisionTd key={f}><CVisionBadge C={C} variant={getStatusVariant(val)}>{val}</CVisionBadge></CVisionTd>;
                            }
                            if (typeof val === 'string' && val.endsWith('%') && f !== 'name') {
                              const num = parseInt(val);
                              const color = num >= 70 ? C.green : num >= 40 ? C.orange : C.red;
                              return <CVisionTd key={f} style={{ fontWeight: 700, color }}>{val}</CVisionTd>;
                            }
                            return (
                              <CVisionTd key={f} style={{ fontSize: 13, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>
                                {val ?? '—'}
                              </CVisionTd>
                            );
                          })}
                        </CVisionTr>
                      ))}
                    </CVisionTableBody>
                  </CVisionTable>
                  {(results.data || []).length > 200 && (
                    <div style={{ fontSize: 13, color: C.textMuted, marginTop: 12, textAlign: 'center' }}>
                      {tr(`عرض 200 من ${results.total} سجل. قم بتصدير CSV لرؤية الكل.`, `Showing 200 of ${results.total} records. Export CSV to see all.`)}
                    </div>
                  )}
                </div>
              )}
            </CVisionCardBody>
          </CVisionCard>
        )}
      </CVisionPageLayout>
    );
  }

  /* -- Report List -------------------------------------------------------- */

  const filtered = category === 'all' ? templates : templates.filter(t => TEMPLATE_CATEGORY[t.key] === category);

  const tabItems: CVisionTabItem[] = CATEGORIES.map(c => ({
    id: c.key,
    label: c.label,
    labelAr: c.labelAr,
    icon: <c.icon size={14} />,
    badge: c.key === 'all' ? templates.length : templates.filter(t => TEMPLATE_CATEGORY[t.key] === c.key).length,
  }));

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('التقارير', 'Reports')}
        titleEn="Reports"
        subtitle={tr('أنشئ تقارير من بيانات مؤسستك. انقر على أي تقرير لتهيئته وإنشائه.', 'Generate reports from your organization data. Click any report to configure and generate.')}
        icon={FileBarChart}
        isRTL={isRTL}
      />

      <CVisionTabs C={C} tabs={tabItems} activeTab={category} onChange={setCategory} isRTL={isRTL} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {filtered.map(t => {
          const Icon = TEMPLATE_ICONS[t.key] || FileBarChart;
          const cat = TEMPLATE_CATEGORY[t.key] || 'HR';
          return (
            <CVisionCard
              key={t.key}
              C={C}
              onClick={() => { setSelected(t); setResults(null); setGroupBy(''); }}
            >
              <CVisionCardBody style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: C.goldDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={20} color={C.gold} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>{t.nameAr}</div>
                      </div>
                      <ChevronRight size={16} color={C.textMuted} style={{ flexShrink: 0, marginTop: 2 }} />
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.description}</div>
                    <CVisionBadge C={C} variant="muted" style={{ marginTop: 8 }}>{cat}</CVisionBadge>
                  </div>
                </div>
              </CVisionCardBody>
            </CVisionCard>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <CVisionEmptyState
          C={C}
          icon={FileBarChart}
          title={tr('لا توجد تقارير في هذه الفئة', 'No reports in this category')}
        />
      )}
    </CVisionPageLayout>
  );
}
