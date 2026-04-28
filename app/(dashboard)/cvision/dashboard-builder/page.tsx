'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionPageHeader, CVisionPageLayout, CVisionEmptyState, CVisionSkeletonCard, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import {
  LayoutDashboard, Settings, Plus, Trash2, RotateCcw, BarChart3,
  PieChart, TrendingUp, Table2, Calendar, List, Gauge, Zap, Bell, ShieldCheck,
  Users, Briefcase, Clock, DollarSign,
} from 'lucide-react';

const api = (action: string, params?: Record<string, string>, signal?: AbortSignal) => {
  return cvisionFetch<any>('/api/cvision/dashboards', { params: { action, ...params }, signal });
};
const post = (body: any) => cvisionMutate<any>('/api/cvision/dashboards', 'POST', body);

const widgetIcon: Record<string, any> = {
  STAT_CARD: BarChart3, BAR_CHART: BarChart3, PIE_CHART: PieChart,
  LINE_CHART: TrendingUp, DONUT_CHART: PieChart, TABLE: Table2,
  CALENDAR: Calendar, LIST: List, KPI_GAUGE: Gauge,
  QUICK_ACTIONS: Zap, NOTIFICATIONS: Bell, COMPLIANCE: ShieldCheck,
};

/* ════ Widget Renderer ════════════════════════════════════════════ */

function WidgetCard({ widget, onRemove, editMode, C, isDark, tr }: { widget: any; onRemove: () => void; editMode: boolean; C: any; isDark: boolean; tr: (a: string, e: string) => string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const Icon = widgetIcon[widget.type] || BarChart3;

  useEffect(() => {
    const ds = widget.config?.dataSource;
    if (!ds) { setLoading(false); return; }
    const ac = new AbortController();
    api('widget-data', { dataSource: ds }, ac.signal).then(j => { setData(j.data); setLoading(false); }).catch(() => {});
    return () => ac.abort();
  }, [widget.config?.dataSource]);

  const label = widget.config?.label || widget.type;

  if (loading) return <CVisionSkeletonCard C={C} height={120} />;

  return (
    <CVisionCard C={C} style={{ height: '100%', position: 'relative', border: editMode ? `1px dashed ${C.gold}40` : undefined }}>
      {editMode && (
        <CVisionButton C={C} isDark={isDark} size="sm" variant="danger"
          style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, padding: 0, zIndex: 10, opacity: 0.7 }}
          onClick={onRemove}
        >
          <Trash2 size={12} />
        </CVisionButton>
      )}
      <CVisionCardBody style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Icon size={14} color={C.textMuted} />
          <span style={{ fontSize: 11, fontWeight: 500, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        </div>

        {widget.type === 'STAT_CARD' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.text }}>{typeof data?.value === 'number' ? data.value.toLocaleString() : data?.value || '\u2014'}</div>
              {data?.unit && <span style={{ fontSize: 11, color: C.textMuted }}>{data.unit}</span>}
            </div>
          </div>
        )}

        {widget.type === 'KPI_GAUGE' && data && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{data.value}{data.unit}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{tr('الهدف', 'Target')}: {data.target}{data.unit}</div>
            <div style={{ marginTop: 8, height: 8, borderRadius: 4, background: C.barTrack, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, background: data.value >= data.target ? C.green : C.orange, width: `${Math.min((data.value / data.target) * 100, 100)}%` }} />
            </div>
          </div>
        )}

        {(widget.type === 'BAR_CHART' || widget.type === 'PIE_CHART' || widget.type === 'DONUT_CHART') && Array.isArray(data) && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
            {data.map((d: any, i: number) => {
              const max = Math.max(...data.map((x: any) => x.count || 0));
              const pct = max > 0 ? ((d.count || 0) / max) * 100 : 0;
              return (
                <div key={i} style={{ fontSize: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span style={{ color: C.text }}>{d._id}</span><span style={{ fontWeight: 500, color: C.text }}>{d.count}</span></div>
                  <div style={{ height: 6, borderRadius: 4, background: C.barTrack, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 4, background: C.gold, width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        )}

        {widget.type === 'LINE_CHART' && Array.isArray(data) && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
            {data.map((d: any, i: number) => {
              const max = Math.max(...data.map((x: any) => x.hires || 0));
              const h = max > 0 ? ((d.hires || 0) / max) * 100 : 0;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: '100%', background: C.gold, borderRadius: '4px 4px 0 0', height: `${Math.max(h, 5)}%`, minHeight: 4 }} />
                  <span style={{ fontSize: 9, color: C.textMuted }}>{d.month}</span>
                </div>
              );
            })}
          </div>
        )}

        {(widget.type === 'TABLE' || widget.type === 'LIST' || widget.type === 'CALENDAR' || widget.type === 'NOTIFICATIONS') && Array.isArray(data) && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
            {data.map((d: any, i: number) => (
              <div key={i} style={{ fontSize: 11, padding: 6, borderRadius: 6, background: C.bgSubtle, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>{d.name || d.title || d.employee || d.candidate || d.text}</span>
                <span style={{ color: C.textMuted, flexShrink: 0 }}>{d.date || d.time || d.type || d.department || d.status || d.position || ''}</span>
              </div>
            ))}
          </div>
        )}

        {widget.type === 'QUICK_ACTIONS' && (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {[{ l: tr('موظف جديد', 'New Employee'), i: Users }, { l: tr('تشغيل الرواتب', 'Run Payroll'), i: DollarSign }, { l: tr('نشر وظيفة', 'Post Job'), i: Briefcase }, { l: tr('الحضور', 'Attendance'), i: Clock }].map(a => (
              <CVisionButton key={a.l} C={C} isDark={isDark} variant="outline" size="sm" icon={<a.i size={12} />} style={{ justifyContent: 'flex-start', fontSize: 11 }}>{a.l}</CVisionButton>
            ))}
          </div>
        )}

        {widget.type === 'COMPLIANCE' && data && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.text }}>{data.score}/100</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{tr('درجة الامتثال', 'Compliance Score')}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, fontSize: 11 }}>
              <span style={{ color: C.red }}>{data.overdue} {tr('متأخر', 'overdue')}</span>
              <span style={{ color: C.orange }}>{data.dueSoon} {tr('قريب', 'due soon')}</span>
            </div>
          </div>
        )}
      </CVisionCardBody>
    </CVisionCard>
  );
}

/* ════ Main Page ═══════════════════════════════════════════════════ */

export default function DashboardBuilderPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const [availableWidgets, setAvailableWidgets] = useState<any[]>([]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    const j = await api('my-dashboard', undefined, signal);
    setDashboard(j.dashboard);
    setLoading(false);
  }, []);

  useEffect(() => { const ac = new AbortController(); load(ac.signal); return () => ac.abort(); }, [load]);

  const openWidgetPicker = async () => {
    const j = await api('available-widgets');
    setAvailableWidgets(j.widgets || []);
    setShowWidgetPicker(true);
  };

  const addWidget = async (widget: any) => {
    if (!dashboard?._id) return;
    const maxY = Math.max(0, ...(dashboard.layout || []).map((w: any) => w.y + w.height));
    await post({
      action: 'add-widget', dashboardId: dashboard._id,
      widget: { type: widget.type, x: 0, y: maxY, width: widget.defaultWidth, height: widget.defaultHeight, config: { label: widget.label, dataSource: widget.dataSource } },
    });
    toast.success(tr(`تمت إضافة ${widget.label}`, `Added ${widget.label}`));
    setShowWidgetPicker(false);
    load();
  };

  const removeWidget = async (widgetId: string) => {
    if (!dashboard?._id) return;
    await post({ action: 'remove-widget', dashboardId: dashboard._id, widgetId });
    toast.success(tr('تم حذف الأداة', 'Widget removed'));
    load();
  };

  const resetDashboard = async () => {
    await post({ action: 'reset-default' });
    toast.success(tr('تمت إعادة اللوحة إلى الافتراضي', 'Dashboard reset to default'));
    load();
  };

  if (loading) return (
    <CVisionPageLayout>
      <CVisionSkeletonCard C={C} height={40} style={{ maxWidth: 300 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>{[1,2,3,4].map(i => <CVisionSkeletonCard key={i} C={C} height={100} />)}</div>
    </CVisionPageLayout>
  );

  const layout = dashboard?.layout || [];
  const gridCols = 12;

  const widgetCategories = availableWidgets.reduce((acc: any, w: any) => {
    if (!acc[w.category]) acc[w.category] = [];
    acc[w.category].push(w);
    return acc;
  }, {});

  return (
    <CVisionPageLayout>
      <CVisionPageHeader C={C} title={tr('منشئ لوحات التحكم', 'Dashboard Builder')} titleEn="Dashboard Builder" icon={LayoutDashboard} isRTL={isRTL}
        subtitle={tr('خصص لوحة التحكم بالسحب والإفلات', 'Customize your dashboard with drag & drop widgets')}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CVisionButton C={C} isDark={isDark} variant={editMode ? 'primary' : 'outline'} size="sm" icon={<Settings size={14} />} onClick={() => setEditMode(!editMode)}>
              {editMode ? tr('تم التحرير', 'Done Editing') : tr('تحرير التخطيط', 'Edit Layout')}
            </CVisionButton>
            {editMode && (
              <>
                <CVisionButton C={C} isDark={isDark} size="sm" variant="primary" icon={<Plus size={14} />} onClick={openWidgetPicker}>{tr('إضافة أداة', 'Add Widget')}</CVisionButton>
                <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" icon={<RotateCcw size={14} />} onClick={resetDashboard}>{tr('إعادة تعيين', 'Reset')}</CVisionButton>
              </>
            )}
          </div>
        }
      />

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
        {layout.map((w: any) => (
          <div key={w.widgetId} style={{ gridColumn: `span ${Math.min(w.width, gridCols)}`, minHeight: w.height * 60 }}>
            <WidgetCard widget={w} editMode={editMode} onRemove={() => removeWidget(w.widgetId)} C={C} isDark={isDark} tr={tr} />
          </div>
        ))}
      </div>

      {layout.length === 0 && (
        <CVisionEmptyState C={C} icon={LayoutDashboard} title={tr('لوحة فارغة', 'Empty Dashboard')}
          description={tr('انقر على "تحرير التخطيط" لبدء إضافة الأدوات', 'Click "Edit Layout" to start adding widgets')}
          action={<CVisionButton C={C} isDark={isDark} variant="primary" icon={<Plus size={14} />} onClick={() => { setEditMode(true); openWidgetPicker(); }}>{tr('أضف أداتك الأولى', 'Add Your First Widget')}</CVisionButton>}
        />
      )}

      <CVisionDialog C={C} open={showWidgetPicker} onClose={() => setShowWidgetPicker(false)} title={tr('إضافة أداة', 'Add Widget')} isRTL={isRTL}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.entries(widgetCategories).map(([cat, widgets]) => (
            <div key={cat}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>{cat}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(widgets as any[]).map((w: any, i: number) => {
                  const WIcon = widgetIcon[w.type] || BarChart3;
                  return (
                    <button
                      key={i}
                      onClick={() => addWidget(w)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 10,
                        border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer',
                        textAlign: 'left', fontSize: 12, color: C.text, transition: 'all 0.2s', fontFamily: 'inherit',
                      }}
                    >
                      <WIcon size={16} color={C.textMuted} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.label}</span>
                      <CVisionBadge C={C} variant="muted" style={{ fontSize: 10, flexShrink: 0 }}>{w.type.replace('_', ' ')}</CVisionBadge>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CVisionDialog>
    </CVisionPageLayout>
  );
}
