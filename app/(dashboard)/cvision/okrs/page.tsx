'use client';

import { useState, useCallback } from 'react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionDialog, CVisionDialogFooter, CVisionEmptyState, CVisionInput, CVisionPageHeader, CVisionPageLayout, CVisionSkeleton, CVisionSkeletonCard, CVisionTabContent, CVisionTabs, CVisionTextarea } from '@/components/cvision/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { toast } from 'sonner';
import { Target, GitBranch, User, BarChart3, TrendingUp, TrendingDown, Minus, Gauge, ArrowRight } from 'lucide-react';

const api = (action: string, params?: Record<string, string>, signal?: AbortSignal) => {
  const sp = new URLSearchParams({ action, ...params });
  return fetch(`/api/cvision/okrs?${sp}`, { credentials: 'include', signal }).then(r => r.json());
};
const post = (body: any) => fetch('/api/cvision/okrs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) }).then(r => r.json());

const trendIcon: Record<string, any> = { UP: TrendingUp, DOWN: TrendingDown, STABLE: Minus };

function statusBadgeVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'muted' {
  if (status === 'ON_TRACK') return 'success';
  if (status === 'AT_RISK') return 'warning';
  if (status === 'BEHIND') return 'danger';
  if (status === 'COMPLETED') return 'info';
  return 'muted';
}

function statusBorderColor(status: string, C: any): string {
  if (status === 'ON_TRACK') return C.green;
  if (status === 'AT_RISK') return C.orange;
  if (status === 'BEHIND') return C.red;
  if (status === 'COMPLETED') return C.blue;
  return C.border;
}

function ragBadgeVariant(rag: string): 'success' | 'warning' | 'danger' {
  if (rag === 'GREEN') return 'success';
  if (rag === 'YELLOW') return 'warning';
  return 'danger';
}

function ragBarColor(rag: string, C: any): string {
  if (rag === 'GREEN') return C.green;
  if (rag === 'YELLOW') return C.orange;
  return C.red;
}

/* ════ OKR Tree ═══════════════════════════════════════════════════ */

function OKRTreeTab({ C, isDark, tr }: { C: any; isDark: boolean; tr: (ar: string, en: string) => string }) {
  const year = new Date().getFullYear();

  const { data: treeRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.okrs.list({ action: 'alignment-tree', year: String(year) }),
    queryFn: () => api('alignment-tree', { year: String(year) }),
  });
  const tree = (treeRaw as any)?.tree || [];

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2,3].map(i => <CVisionSkeletonCard key={i} C={C} height={80} />)}</div>;
  if (tree.length === 0) return <CVisionEmptyState C={C} icon={Target} title={tr('لا توجد OKRs لعام ' + year, `No OKRs for ${year}`)} />;

  function OKRNode({ okr, depth = 0 }: { okr: any; depth?: number }) {
    return (
      <div style={{ marginLeft: depth * 24, marginBottom: 12 }}>
        <CVisionCard C={C} style={{ borderLeft: `4px solid ${statusBorderColor(okr.overallStatus, C)}` }}>
          <CVisionCardBody>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CVisionBadge C={C} variant="muted">{okr.level}</CVisionBadge>
                <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{okr.objective}</span>
              </div>
              <CVisionBadge C={C} variant={statusBadgeVariant(okr.overallStatus)}>{okr.overallStatus?.replace('_', ' ')}</CVisionBadge>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: C.textMuted }}>
              <span>{okr.ownerName}</span>
              <span>{okr.period} {okr.year}</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontWeight: 500 }}>{okr.overallProgress}%</span>
            </div>
            <div style={{ marginTop: 8, height: 6, borderRadius: 4, background: C.barTrack, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, background: C.gold, transition: 'all 0.3s', width: `${okr.overallProgress}%` }} />
            </div>
            {(okr.keyResults || []).length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {okr.keyResults.map((kr: any) => (
                  <div key={kr.krId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <ArrowRight size={12} color={C.textMuted} />
                    <span style={{ flex: 1, color: C.text }}>{kr.description}</span>
                    <span style={{ color: C.textMuted }}>{kr.currentValue}/{kr.targetValue} {kr.unit}</span>
                    <CVisionBadge C={C} variant={statusBadgeVariant(kr.status)} style={{ fontSize: 10 }}>{kr.progress}%</CVisionBadge>
                  </div>
                ))}
              </div>
            )}
          </CVisionCardBody>
        </CVisionCard>
        {(okr.children || []).map((child: any) => <OKRNode key={child.okrId} okr={child} depth={depth + 1} />)}
      </div>
    );
  }

  return <div>{tree.map(o => <OKRNode key={o.okrId} okr={o} />)}</div>;
}

/* ════ My OKRs ════════════════════════════════════════════════════ */

function MyOKRsTab({ C, isDark, tr, isRTL }: { C: any; isDark: boolean; tr: (ar: string, en: string) => string; isRTL: boolean }) {
  const queryClient = useQueryClient();
  const [checkIn, setCheckIn] = useState<{ okrId: string; kr: any } | null>(null);
  const [checkInValue, setCheckInValue] = useState('');
  const [checkInNotes, setCheckInNotes] = useState('');

  const { data: okrsRaw, isLoading: loading, refetch: load } = useQuery({
    queryKey: cvisionKeys.okrs.list({ action: 'my-okrs', employeeId: 'EMP-001' }),
    queryFn: () => api('my-okrs', { employeeId: 'EMP-001' }),
  });
  const okrs = (okrsRaw as any)?.okrs || [];

  if (loading) return <CVisionSkeletonCard C={C} height={160} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {okrs.length === 0 && <CVisionEmptyState C={C} icon={Target} title={tr('لا توجد أهداف', 'No OKRs assigned')} />}
      {okrs.map(okr => (
        <CVisionCard key={okr.okrId} C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{okr.objective}</span>
              <CVisionBadge C={C} variant={statusBadgeVariant(okr.overallStatus)}>{okr.overallProgress}%</CVisionBadge>
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{okr.period} {okr.year}</div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(okr.keyResults || []).map((kr: any) => (
                <div key={kr.krId} style={{ padding: 10, borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: C.text }}>{kr.description}</span>
                    <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => { setCheckIn({ okrId: okr.okrId, kr }); setCheckInValue(String(kr.currentValue)); }}>
                      {tr('تسجيل', 'Check-in')}
                    </CVisionButton>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.textMuted }}>
                    <span>{kr.currentValue}/{kr.targetValue} {kr.unit}</span>
                    <CVisionBadge C={C} variant={statusBadgeVariant(kr.status)} style={{ fontSize: 10 }}>{kr.status}</CVisionBadge>
                    <span>{tr('الوزن', 'Weight')}: {kr.weight}%</span>
                  </div>
                  <div style={{ marginTop: 4, height: 6, borderRadius: 4, background: C.barTrack, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: C.gold, width: `${kr.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CVisionCardBody>
        </CVisionCard>
      ))}

      <CVisionDialog C={C} open={!!checkIn} onClose={() => setCheckIn(null)} title={tr('تسجيل', 'Check-in')} titleAr="تسجيل" isRTL={isRTL}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{checkIn?.kr?.description}</div>
          <CVisionInput C={C} type="number" label={tr('القيمة الحالية', 'Current Value')} value={checkInValue} onChange={e => setCheckInValue(e.target.value)} />
          <div style={{ fontSize: 11, color: C.textMuted }}>{tr('الهدف', 'Target')}: {checkIn?.kr?.targetValue} {checkIn?.kr?.unit}</div>
          <CVisionTextarea C={C} label={tr('ملاحظات', 'Notes')} value={checkInNotes} onChange={e => setCheckInNotes(e.target.value)} rows={2} />
        </div>
        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setCheckIn(null)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="primary" onClick={async () => {
            await post({ action: 'check-in', okrId: checkIn!.okrId, krId: checkIn!.kr.krId, value: parseFloat(checkInValue), notes: checkInNotes });
            toast.success(tr('تم التسجيل', 'Check-in recorded'));
            setCheckIn(null); setCheckInNotes('');
            load();
          }}>{tr('حفظ', 'Save Check-in')}</CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

/* ════ KPI Dashboard ═════════════════════════════════════════════ */

function KPIDashboardTab({ C, isDark, tr }: { C: any; isDark: boolean; tr: (ar: string, en: string) => string }) {
  const { data: kpisRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.okrs.list({ action: 'kpi-dashboard' }),
    queryFn: () => api('kpi-dashboard'),
  });
  const kpis = (kpisRaw as any)?.kpis || [];

  if (loading) return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>{[1,2,3,4,5,6].map(i => <CVisionSkeletonCard key={i} C={C} height={120} />)}</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
      {kpis.map((kpi: any) => {
        const TrendIcon = trendIcon[kpi.trend] || Minus;
        const pct = kpi.targetValue > 0 ? Math.round((kpi.currentValue / kpi.targetValue) * 100) : 0;
        return (
          <CVisionCard key={kpi.kpiId} C={C}>
            <CVisionCardBody>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: C.textMuted }}>{kpi.kpiId}</span>
                <CVisionBadge C={C} variant={ragBadgeVariant(kpi.ragStatus)}>{kpi.ragStatus}</CVisionBadge>
              </div>
              <div style={{ fontWeight: 500, fontSize: 13, color: C.text, marginBottom: 4 }}>{kpi.name}</div>
              {kpi.nameAr && <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>{kpi.nameAr}</div>}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{typeof kpi.currentValue === 'number' ? kpi.currentValue.toFixed(1) : kpi.currentValue}</span>
                <span style={{ fontSize: 13, color: C.textMuted, marginBottom: 2 }}>/ {kpi.targetValue} {kpi.unit}</span>
                <div style={{ flex: 1 }} />
                <TrendIcon size={16} color={kpi.trend === 'UP' ? C.green : kpi.trend === 'DOWN' ? C.red : C.textMuted} />
              </div>
              <div style={{ marginTop: 8, height: 6, borderRadius: 4, background: C.barTrack, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, background: ragBarColor(kpi.ragStatus, C), width: `${Math.min(pct, 100)}%` }} />
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{kpi.formula}</div>
            </CVisionCardBody>
          </CVisionCard>
        );
      })}
    </div>
  );
}

/* ════ Progress Dashboard ════════════════════════════════════════ */

function ProgressDashboardTab({ C, isDark, tr }: { C: any; isDark: boolean; tr: (ar: string, en: string) => string }) {
  const year = new Date().getFullYear();

  const { data: dashRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.okrs.list({ action: 'progress-dashboard', year: String(year) }),
    queryFn: () => api('progress-dashboard', { year: String(year) }),
  });
  const dashboard = (dashRaw as any)?.dashboard || null;

  if (loading) return <CVisionSkeletonCard C={C} height={160} />;
  if (!dashboard) return null;

  const miniStat = (label: string, labelAr: string, value: string | number, color?: string) => (
    <CVisionCard C={C} style={{ flex: '1 1 140px', padding: 16 }}>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{tr(labelAr, label)}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || C.text }}>{value}</div>
    </CVisionCard>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {miniStat('Total OKRs', 'إجمالي الأهداف', dashboard.total)}
        {miniStat('Avg Progress', 'متوسط التقدم', `${dashboard.avgProgress}%`)}
        {miniStat('On Track', 'على المسار', dashboard.byStatus?.ON_TRACK || 0, C.green)}
        {miniStat('At Risk / Behind', 'في خطر / متأخر', (dashboard.byStatus?.AT_RISK || 0) + (dashboard.byStatus?.BEHIND || 0), C.red)}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {miniStat('Company-level', 'مستوى الشركة', dashboard.byLevel?.COMPANY || 0)}
        {miniStat('Department-level', 'مستوى القسم', dashboard.byLevel?.DEPARTMENT || 0)}
        {miniStat('Individual-level', 'مستوى فردي', dashboard.byLevel?.INDIVIDUAL || 0)}
      </div>
    </div>
  );
}

/* ════ Main Page ═══════════════════════════════════════════════════ */

export default function OKRsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [activeTab, setActiveTab] = useState('tree');

  const tabs = [
    { id: 'tree', label: 'OKR Tree', labelAr: 'شجرة الأهداف', icon: <GitBranch size={14} /> },
    { id: 'my', label: 'My OKRs', labelAr: 'أهدافي', icon: <User size={14} /> },
    { id: 'kpis', label: 'KPI Dashboard', labelAr: 'لوحة المؤشرات', icon: <Gauge size={14} /> },
    { id: 'progress', label: 'Progress', labelAr: 'التقدم', icon: <BarChart3 size={14} /> },
  ];

  return (
    <CVisionPageLayout>
      <CVisionPageHeader C={C} title={tr('مؤشرات الأداء والأهداف', 'KPIs & OKRs')} titleEn="KPIs & OKRs" icon={Target} isRTL={isRTL} />

      <CVisionTabs C={C} tabs={tabs} activeTab={activeTab} onChange={setActiveTab} isRTL={isRTL} />

      <CVisionTabContent id="tree" activeTab={activeTab}>
        <OKRTreeTab C={C} isDark={isDark} tr={tr} />
      </CVisionTabContent>
      <CVisionTabContent id="my" activeTab={activeTab}>
        <MyOKRsTab C={C} isDark={isDark} tr={tr} isRTL={isRTL} />
      </CVisionTabContent>
      <CVisionTabContent id="kpis" activeTab={activeTab}>
        <KPIDashboardTab C={C} isDark={isDark} tr={tr} />
      </CVisionTabContent>
      <CVisionTabContent id="progress" activeTab={activeTab}>
        <ProgressDashboardTab C={C} isDark={isDark} tr={tr} />
      </CVisionTabContent>
    </CVisionPageLayout>
  );
}
