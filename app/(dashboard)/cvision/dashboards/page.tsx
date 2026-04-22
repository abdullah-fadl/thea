'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton,
  CVisionPageHeader, CVisionPageLayout, CVisionEmptyState, CVisionSkeletonCard,
  CVisionSelect, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { LayoutDashboard, Plus, RefreshCw, BarChart3, PieChart, TrendingUp } from 'lucide-react';

const TYPE_ICONS: Record<string, any> = { NUMBER: TrendingUp, CHART_BAR: BarChart3, CHART_PIE: PieChart, GAUGE: TrendingUp, CHART_LINE: TrendingUp, LIST: LayoutDashboard, TABLE: LayoutDashboard };

export default function DashboardsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [active, setActive] = useState<any>(null);
  const [widgetData, setWidgetData] = useState<Record<string, any>>({});

  const { data: dashboardsData, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.dashboards.list({ action: 'list' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/dashboards', { params: { action: 'list' } }),
    select: (d) => d.ok ? d.data || [] : [],
  });
  const dashboards = dashboardsData || [];

  // Auto-select first dashboard when data loads
  useEffect(() => {
    if (dashboards.length > 0 && !active) {
      setActive(dashboards[0]);
      loadWidgets(dashboards[0]);
    }
  }, [dashboards]);

  async function loadWidgets(dash: any) {
    if (!dash?.widgets) return;
    const data: Record<string, any> = {};
    await Promise.all(dash.widgets.map(async (w: any) => {
      try {
        const d = await cvisionFetch<any>('/api/cvision/dashboards', { params: { action: 'widget-data', dashboardId: dash.dashboardId, widgetId: w.widgetId } });
        if (d.ok) data[w.widgetId] = d.data;
      } catch {}
    }));
    setWidgetData(data);
  }

  const selectDashboard = (id: string) => {
    const d = dashboards.find((x: any) => x.dashboardId === id);
    if (d) { setActive(d); loadWidgets(d); }
  };

  const renderWidget = (widget: any) => {
    const Icon = TYPE_ICONS[widget.type] || TrendingUp;
    const data = widgetData[widget.widgetId];

    if (widget.type === 'NUMBER') {
      return (
        <CVisionCard key={widget.widgetId} C={C} style={{ overflow: 'hidden' }}>
          <CVisionCardBody>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: C.textMuted }}>{widget.title}</span>
              <Icon size={16} color={widget.color} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: widget.color }}>{data?.total ?? '\u2014'}</div>
          </CVisionCardBody>
        </CVisionCard>
      );
    }

    if (widget.type === 'GAUGE') {
      const pct = data?.data?.[0] ?? 0;
      return (
        <CVisionCard key={widget.widgetId} C={C}>
          <CVisionCardBody>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 8 }}>{widget.title}</div>
            <div style={{ position: 'relative', height: 10, borderRadius: 8, background: C.barTrack, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', height: '100%', borderRadius: 8, transition: 'all 0.3s', width: `${Math.min(pct, 100)}%`, backgroundColor: widget.color }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: widget.color }}>{data?.total ?? '\u2014'}</div>
          </CVisionCardBody>
        </CVisionCard>
      );
    }

    return (
      <CVisionCard key={widget.widgetId} C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon size={16} color={widget.color} />
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{widget.title}</span>
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          {data?.labels?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.labels.map((label: string, i: number) => {
                const maxVal = Math.max(...(data.data || [1]));
                const pct = maxVal > 0 ? (data.data[i] / maxVal) * 100 : 0;
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                      <span style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                      <span style={{ fontWeight: 500, color: C.text }}>{data.data[i]}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: C.barTrack, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 4, transition: 'all 0.3s', width: `${pct}%`, backgroundColor: widget.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <div style={{ fontSize: 13, color: C.textMuted }}>{tr('لا توجد بيانات', 'No data available')}</div>}
        </CVisionCardBody>
      </CVisionCard>
    );
  };

  return (
    <CVisionPageLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <CVisionPageHeader C={C} title={tr('لوحات المعلومات', 'Dashboards')} titleEn="Dashboards" icon={LayoutDashboard} isRTL={isRTL} style={{ marginBottom: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CVisionSelect
            C={C}
            options={dashboards.map(d => ({ value: d.dashboardId, label: d.name }))}
            value={active?.dashboardId || ''}
            onChange={selectDashboard}
            placeholder={tr('اختر لوحة', 'Select dashboard')}
            style={{ minWidth: 200 }}
          />
          <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" onClick={() => active && loadWidgets(active)}>
            <RefreshCw size={14} />
          </CVisionButton>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48, color: C.textMuted, fontSize: 14 }}>
          {tr('جاري تحميل لوحات المعلومات...', 'Loading dashboards...')}
        </div>
      ) : active ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {(active.widgets || []).map((w: any) => renderWidget(w))}
        </div>
      ) : (
        <CVisionEmptyState C={C} icon={LayoutDashboard} title={tr('لا توجد لوحات معلومات', 'No dashboards yet.')}
          action={<CVisionButton C={C} isDark={isDark} variant="primary" icon={<Plus size={14} />}>{tr('إنشاء لوحة', 'Create Dashboard')}</CVisionButton>}
        />
      )}
    </CVisionPageLayout>
  );
}
