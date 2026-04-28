'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useEffect, useCallback } from 'react';

import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Target,
  Brain,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';

interface ModuleAccuracy {
  moduleId: string;
  moduleName: string;
  totalDecisions: number;
  autoApproved: number;
  humanReviewed: number;
  autoRejected: number;
  humanAgreedWithAI: number;
  humanDisagreedWithAI: number;
  accuracyRate: number;
  avgConfidence: number;
  confidenceDistribution: { range: string; count: number }[];
}

const MODULE_COLORS: Record<string, string> = {
  'ai-matching': 'bg-purple-100 text-purple-800',
  'retention-risk': 'bg-rose-100 text-rose-800',
  'candidate-ranking': 'bg-cyan-100 text-cyan-800',
  'skills-assessment': 'bg-teal-100 text-teal-800',
  'interview-scoring': 'bg-indigo-100 text-indigo-800',
  'whatif-simulation': 'bg-amber-100 text-amber-800',
  'promotion-readiness': 'bg-emerald-100 text-emerald-800',
};

function statusBadge(rate: number): { label: string; color: string; icon: typeof CheckCircle } {
  if (rate >= 85) return { label: 'Excellent', color: 'bg-green-100 text-green-800', icon: CheckCircle };
  if (rate >= 75) return { label: 'Good', color: 'bg-blue-100 text-blue-800', icon: CheckCircle };
  if (rate >= 60) return { label: 'Fair', color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle };
  return { label: 'Poor', color: 'bg-red-100 text-red-800', icon: AlertTriangle };
}

export default function ModelAccuracyTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [modules, setModules] = useState<ModuleAccuracy[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch('/api/cvision/ai/threshold?action=accuracy', { credentials: 'include', signal });
      const data = await res.json();
      if (data.success) setModules(data.data?.modules || []);
    } catch {
      toast.error(tr('فشل تحميل بيانات الدقة', 'Failed to load accuracy data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const ac = new AbortController(); loadData(ac.signal); return () => ac.abort(); }, [loadData]);

  const totalDecisions = modules.reduce((s, m) => s + m.totalDecisions, 0);
  const totalAgreed = modules.reduce((s, m) => s + m.humanAgreedWithAI, 0);
  const totalHumanReviewed = modules.reduce((s, m) => s + m.humanReviewed, 0);
  const overallAccuracy = totalHumanReviewed > 0 ? Math.round((totalAgreed / totalHumanReviewed) * 100) : 0;

  const allDistribution = [
    { range: '0-20', count: 0 },
    { range: '20-40', count: 0 },
    { range: '40-60', count: 0 },
    { range: '60-80', count: 0 },
    { range: '80-100', count: 0 },
  ];
  for (const m of modules) {
    for (let i = 0; i < m.confidenceDistribution.length && i < 5; i++) {
      allDistribution[i].count += m.confidenceDistribution[i]?.count || 0;
    }
  }
  const maxDist = Math.max(...allDistribution.map(d => d.count), 1);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[1, 2, 3].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 112, borderRadius: 16 }}  />)}
        </div>
        <CVisionSkeletonCard C={C} height={200} style={{ height: 256, borderRadius: 16 }}  />
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <CVisionCard C={C}>
        <CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}>
          <Brain style={{ height: 48, width: 48, marginBottom: 12 }} />
          <p style={{ fontSize: 16, fontWeight: 500 }}>{tr('لا توجد بيانات دقة بعد', 'No accuracy data yet')}</p>
          <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
            {tr('عند مراجعة قرارات الذكاء الاصطناعي، ستظهر مقاييس الدقة هنا.', 'As AI decisions are reviewed, accuracy metrics will appear here.')}
          </p>
        </CVisionCardBody>
      </CVisionCard>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 13, color: C.textMuted }}>{tr('الدقة الإجمالية', 'Overall Accuracy')}</p>
                <p className={`text-3xl font-bold mt-1 ${overallAccuracy >= 80 ? 'text-green-600' : overallAccuracy >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {overallAccuracy}%
                </p>
              </div>
              <Target style={{ height: 32, width: 32 }} />
            </div>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{tr('وافق الإنسان مع الذكاء الاصطناعي', 'Human agreed with AI')}</p>
          </CVisionCardBody>
        </CVisionCard>

        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 13, color: C.textMuted }}>{tr('إجمالي القرارات', 'Total Decisions')}</p>
                <p style={{ fontSize: 30, fontWeight: 700, marginTop: 4 }}>{totalDecisions}</p>
              </div>
              <Activity style={{ height: 32, width: 32 }} />
            </div>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{tr('عبر جميع الوحدات', 'Across all modules')}</p>
          </CVisionCardBody>
        </CVisionCard>

        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 13, color: C.textMuted }}>{tr('المراجعات البشرية', 'Human Reviews')}</p>
                <p style={{ fontSize: 30, fontWeight: 700, marginTop: 4, color: C.blue }}>{totalHumanReviewed}</p>
              </div>
              <Brain style={{ height: 32, width: 32 }} />
            </div>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
              {totalAgreed} {tr('وافق،', 'agreed,')} {totalHumanReviewed - totalAgreed} {tr('لم يوافق', 'disagreed')}
            </p>
          </CVisionCardBody>
        </CVisionCard>
      </div>

      {/* Per Module Table */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('أداء كل وحدة', 'Per Module Performance')}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{tr('تفصيل الدقة والقرارات حسب وحدة الذكاء الاصطناعي', 'Accuracy and decision breakdown by AI module')}</div>
            </div>
            <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => loadData()}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </CVisionButton>
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ borderRadius: 8, border: `1px solid ${C.border}` }}>
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                  <CVisionTh C={C}>{tr('الوحدة', 'Module')}</CVisionTh>
                  <CVisionTh C={C} align="center">{tr('القرارات', 'Decisions')}</CVisionTh>
                  <CVisionTh C={C} align="center">{tr('الدقة', 'Accuracy')}</CVisionTh>
                  <CVisionTh C={C} align="center">{tr('متوسط الثقة', 'Avg Confidence')}</CVisionTh>
                  <CVisionTh C={C} align="center">{tr('الحالة', 'Status')}</CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {modules.map(m => {
                  const status = statusBadge(m.accuracyRate);
                  const StatusIcon = status.icon;
                  const mc = MODULE_COLORS[m.moduleId] || 'bg-gray-100 text-gray-800';

                  return (
                    <CVisionTr C={C} key={m.moduleId}>
                      <CVisionTd>
                        <CVisionBadge C={C} className={mc} variant="secondary">{m.moduleName}</CVisionBadge>
                      </CVisionTd>
                      <CVisionTd align="center" style={{ fontWeight: 500 }}>{m.totalDecisions}</CVisionTd>
                      <CVisionTd align="center">
                        <span className={`font-bold ${m.accuracyRate >= 80 ? 'text-green-600' : m.accuracyRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {m.accuracyRate}%
                        </span>
                      </CVisionTd>
                      <CVisionTd align="center">
                        <CVisionBadge C={C} variant="outline">{m.avgConfidence}%</CVisionBadge>
                      </CVisionTd>
                      <CVisionTd align="center">
                        <CVisionBadge C={C} className={status.color} variant="secondary">
                          <StatusIcon style={{ height: 12, width: 12, marginRight: 4 }} />
                          {status.label}
                        </CVisionBadge>
                      </CVisionTd>
                    </CVisionTr>
                  );
                })}
              </CVisionTableBody>
            </CVisionTable>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Confidence Distribution */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('توزيع الثقة', 'Confidence Distribution')}</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>{tr('ما مدى ثقة الذكاء الاصطناعي في جميع القرارات؟', 'How confident is the AI across all decisions?')}</div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allDistribution.map(d => (
              <div key={d.range} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: C.textMuted, width: 48, textAlign: 'right' }}>{d.range}%</span>
                <div style={{ flex: 1, height: 24, borderRadius: 6, overflow: 'hidden' }}>
                  <div
                    className={`h-full rounded ${
                      d.range === '80-100' ? 'bg-green-400' :
                      d.range === '60-80' ? 'bg-blue-400' :
                      d.range === '40-60' ? 'bg-yellow-400' :
                      d.range === '20-40' ? 'bg-orange-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${Math.max((d.count / maxDist) * 100, d.count > 0 ? 3 : 0)}%` }}
                  />
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, width: 64 }}>{d.count} {tr('قرارات', 'decisions')}</span>
              </div>
            ))}
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Module detail cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
        {modules.map(m => {
          const status = statusBadge(m.accuracyRate);
          const mc = MODULE_COLORS[m.moduleId] || 'bg-gray-100 text-gray-800';

          return (
            <CVisionCard C={C} key={m.moduleId}>
              <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CVisionBadge C={C} className={mc} variant="secondary">{m.moduleName}</CVisionBadge>
                  <CVisionBadge C={C} className={status.color} variant="secondary">{status.label}</CVisionBadge>
                </div>
              </CVisionCardHeader>
              <CVisionCardBody style={{ paddingTop: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: C.textMuted }}>{tr('موافقة تلقائية', 'Auto-approved')}</span>
                      <span style={{ fontWeight: 500 }}>{m.autoApproved}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: C.textMuted }}>{tr('مراجعة بشرية', 'Human reviewed')}</span>
                      <span style={{ fontWeight: 500 }}>{m.humanReviewed}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: C.textMuted }}>{tr('رفض تلقائي', 'Auto-rejected')}</span>
                      <span style={{ fontWeight: 500 }}>{m.autoRejected}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: C.textMuted }}>{tr('وافق الإنسان', 'Human agreed')}</span>
                      <span style={{ fontWeight: 500, color: C.green }}>{m.humanAgreedWithAI}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: C.textMuted }}>{tr('لم يوافق الإنسان', 'Human disagreed')}</span>
                      <span style={{ fontWeight: 500, color: C.red }}>{m.humanDisagreedWithAI}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: C.textMuted }}>{tr('متوسط الثقة', 'Avg confidence')}</span>
                      <span style={{ fontWeight: 500 }}>{m.avgConfidence}%</span>
                    </div>
                  </div>
                </div>

                {/* Mini distribution */}
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 12 }}>
                  {m.confidenceDistribution.map((d, i) => (
                    <div
                      key={d.range}
                      className={`h-4 rounded-sm ${
                        i === 4 ? 'bg-green-300' :
                        i === 3 ? 'bg-blue-300' :
                        i === 2 ? 'bg-yellow-300' :
                        i === 1 ? 'bg-orange-300' : 'bg-red-300'
                      }`}
                      style={{ flex: Math.max(d.count, 0.5) }}
                      title={`${d.range}%: ${d.count} decisions`}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: C.textMuted, marginTop: 2 }}>
                  <span>0%</span>
                  <span>100%</span>
                </div>

                {/* Alert */}
                {m.accuracyRate < 80 && m.totalDecisions >= 3 && (
                  <div style={{ marginTop: 8, borderRadius: 8, background: C.orangeDim, border: `1px solid ${C.border}`, padding: 8, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <AlertTriangle style={{ height: 12, width: 12, color: C.orange, marginTop: 2 }} />
                    <p style={{ color: C.orange }}>
                      {tr('أقل من هدف الدقة 80% — يُنصح بإعادة معايرة الحدود', 'Below 80% accuracy target — consider recalibrating thresholds')}
                    </p>
                  </div>
                )}
              </CVisionCardBody>
            </CVisionCard>
          );
        })}
      </div>

      {/* Model Health Alerts */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle style={{ height: 16, width: 16 }} />
            {tr('تنبيهات صحة النموذج', 'Model Health Alerts')}
          </div>
        </CVisionCardHeader>
        <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {modules.filter(m => m.accuracyRate < 80 && m.totalDecisions >= 3).map(m => (
            <div key={m.moduleId} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, borderRadius: 12, border: `1px solid ${C.border}`, background: C.orangeDim, padding: 12 }}>
              <AlertTriangle style={{ height: 16, width: 16, color: C.orange, marginTop: 2 }} />
              <p style={{ fontSize: 13, color: C.orange }}>
                <span style={{ fontWeight: 500 }}>{m.moduleName}</span> {tr(`انخفضت الدقة تحت 80% (${m.accuracyRate}%) — يُنصح بإعادة المعايرة`, `accuracy dropped below 80% (${m.accuracyRate}%) — consider recalibrating`)}
              </p>
            </div>
          ))}
          {modules.filter(m => m.accuracyRate >= 85 && m.totalDecisions >= 3).map(m => (
            <div key={m.moduleId} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, borderRadius: 12, border: `1px solid ${C.border}`, background: C.greenDim, padding: 12 }}>
              <CheckCircle style={{ height: 16, width: 16, color: C.green, marginTop: 2 }} />
              <p style={{ fontSize: 13, color: C.green }}>
                <span style={{ fontWeight: 500 }}>{m.moduleName}</span> {tr(`يعمل بشكل جيد عند ${m.accuracyRate}% دقة`, `performing well at ${m.accuracyRate}% accuracy`)}
              </p>
            </div>
          ))}
          {modules.every(m => m.totalDecisions < 3) && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, borderRadius: 12, border: `1px solid ${C.border}`, padding: 12 }}>
              <Activity style={{ height: 16, width: 16, color: C.textMuted, marginTop: 2 }} />
              <p style={{ fontSize: 13, color: C.textMuted }}>
                {tr('لا توجد بيانات كافية بعد لإنشاء تنبيهات صحة النموذج. مطلوب 3 قرارات على الأقل لكل وحدة.', 'Not enough data yet to generate model health alerts. Minimum 3 decisions per module required.')}
              </p>
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}
