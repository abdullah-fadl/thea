'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody,
  CVisionBadge, CVisionPageHeader, CVisionPageLayout,
  CVisionSkeletonCard,
  CVisionTable, CVisionTableHead, CVisionTableBody,
  CVisionTh, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Minus, Briefcase, Users, BarChart3 } from 'lucide-react';

interface PositionSummary {
  id: string;
  departmentCode: string;
  departmentName: string;
  jobTitleCode: string;
  jobTitleName: string;
  gradeCode?: string | null;
  gradeName?: string | null;
  budgetedHeadcount: number;
  activeHeadcount: number;
  variance: number;
  utilizationPercent: number;
  isActive: boolean;
}

interface PositionsSummaryResponse {
  success: boolean;
  positions: PositionSummary[];
  totals: {
    budgetedHeadcount: number;
    activeHeadcount: number;
    variance: number;
  };
  count: number;
}

export default function PositionsSummaryPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const { data: summaryRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.positions.list({ view: 'summary' }),
    queryFn: () => cvisionFetch<PositionsSummaryResponse>('/api/cvision/positions/summary'),
  });
  const positions = summaryRaw?.positions || [];
  const totals = summaryRaw?.totals || { budgetedHeadcount: 0, activeHeadcount: 0, variance: 0 };

  function getVarianceIcon(variance: number) {
    if (variance > 0) return <TrendingDown size={16} color={C.green} />;
    if (variance < 0) return <TrendingUp size={16} color={C.red} />;
    return <Minus size={16} color={C.textMuted} />;
  }

  function getUtilizationStyle(percent: number): React.CSSProperties {
    if (percent >= 100) return { color: C.red, fontWeight: 600 };
    if (percent >= 90) return { color: C.orange, fontWeight: 600 };
    if (percent >= 75) return { color: C.green };
    return { color: C.textMuted };
  }

  if (loading) return <div style={{ padding: 24 }}><CVisionSkeletonCard C={C} height={260} /></div>;

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('ملخص المناصب', 'Positions Summary')}
        titleEn="Positions Summary"
        subtitle={tr('الميزانية مقابل عدد الموظفين الفعلي حسب المنصب', 'Budget vs actual headcount by position')}
        icon={Briefcase}
        isRTL={isRTL}
      />

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        <CVisionCard C={C}>
          <CVisionCardBody>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <Users size={20} color={C.blue} style={{ margin: '0 auto 6px' }} />
              <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{totals.budgetedHeadcount}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{tr('العدد المخطط', 'Budgeted Headcount')}</div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <Users size={20} color={C.green} style={{ margin: '0 auto 6px' }} />
              <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{totals.activeHeadcount}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{tr('العدد الفعلي', 'Active Headcount')}</div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <BarChart3 size={20} color={totals.variance > 0 ? C.green : totals.variance < 0 ? C.red : C.textMuted} style={{ margin: '0 auto 6px' }} />
              <div style={{
                fontSize: 22, fontWeight: 700,
                color: totals.variance > 0 ? C.green : totals.variance < 0 ? C.red : C.text,
              }}>
                {totals.variance > 0 ? '+' : ''}{totals.variance}
              </div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{tr('الفرق', 'Variance')}</div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      </div>

      {/* Positions Table */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('تفاصيل المناصب', 'Position Details')}</div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <CVisionTable C={C}>
            <CVisionTableHead C={C}>
              <CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh>
              <CVisionTh C={C}>{tr('المسمى الوظيفي', 'Job Title')}</CVisionTh>
              <CVisionTh C={C}>{tr('الدرجة', 'Grade')}</CVisionTh>
              <CVisionTh C={C} align="right">{tr('المخطط', 'Budgeted')}</CVisionTh>
              <CVisionTh C={C} align="right">{tr('الفعلي', 'Active')}</CVisionTh>
              <CVisionTh C={C} align="right">{tr('الفرق', 'Variance')}</CVisionTh>
              <CVisionTh C={C} align="right">{tr('الاستخدام', 'Utilization')}</CVisionTh>
              <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
            </CVisionTableHead>
            <CVisionTableBody>
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: C.textMuted, padding: '24px 14px', fontSize: 13 }}>
                    {tr('لم يتم العثور على مناصب. أنشئ مناصب لتتبع العدد.', 'No positions found. Create positions to track headcount.')}
                  </td>
                </tr>
              ) : (
                positions.map((pos) => (
                  <CVisionTr C={C} key={pos.id}>
                    <CVisionTd>
                      <div>
                        <div style={{ fontWeight: 500, color: C.text }}>{pos.departmentName}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: 'monospace' }}>{pos.departmentCode}</div>
                      </div>
                    </CVisionTd>
                    <CVisionTd>
                      <div>
                        <div style={{ fontWeight: 500, color: C.text }}>{pos.jobTitleName}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: 'monospace' }}>{pos.jobTitleCode}</div>
                      </div>
                    </CVisionTd>
                    <CVisionTd>
                      {pos.gradeName ? (
                        <div>
                          <div style={{ color: C.text }}>{pos.gradeName}</div>
                          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: 'monospace' }}>{pos.gradeCode}</div>
                        </div>
                      ) : (
                        <span style={{ color: C.textMuted }}>-</span>
                      )}
                    </CVisionTd>
                    <CVisionTd align="right" style={{ fontWeight: 500, color: C.text }}>{pos.budgetedHeadcount}</CVisionTd>
                    <CVisionTd align="right" style={{ fontWeight: 500, color: C.text }}>{pos.activeHeadcount}</CVisionTd>
                    <CVisionTd align="right">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                        {getVarianceIcon(pos.variance)}
                        <span style={{ fontWeight: 500, color: pos.variance > 0 ? C.green : pos.variance < 0 ? C.red : C.text }}>
                          {pos.variance > 0 ? '+' : ''}{pos.variance}
                        </span>
                      </div>
                    </CVisionTd>
                    <CVisionTd align="right">
                      <span style={getUtilizationStyle(pos.utilizationPercent)}>
                        {pos.utilizationPercent.toFixed(1)}%
                      </span>
                    </CVisionTd>
                    <CVisionTd>
                      <CVisionBadge C={C} variant={pos.isActive ? 'success' : 'muted'}>
                        {pos.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}
                      </CVisionBadge>
                    </CVisionTd>
                  </CVisionTr>
                ))
              )}
            </CVisionTableBody>
          </CVisionTable>
        </CVisionCardBody>
      </CVisionCard>
    </CVisionPageLayout>
  );
}
