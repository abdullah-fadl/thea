'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionSelect, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useEffect, useCallback } from 'react';

import {
  Settings,
  Save,
  RotateCcw,
  Loader2,
  Shield,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface ThresholdConfig {
  moduleId: string;
  moduleName: string;
  moduleNameAr: string;
  autoApproveThreshold: number;
  reviewThreshold: number;
  autoRejectThreshold: number;
  isActive: boolean;
  escalationRole: string;
  maxReviewTime: number;
}

interface ModuleAccuracy {
  moduleId: string;
  moduleName: string;
  totalDecisions: number;
  accuracyRate: number;
}

const ROLE_LABELS: Record<string, string> = {
  HR_MANAGER: 'HR Manager',
  MANAGER: 'Manager',
  OWNER: 'Owner',
  ADMIN: 'Admin',
};

const MODULE_COLORS: Record<string, string> = {
  'ai-matching': 'bg-purple-100 text-purple-800',
  'retention-risk': 'bg-rose-100 text-rose-800',
  'candidate-ranking': 'bg-cyan-100 text-cyan-800',
  'skills-assessment': 'bg-teal-100 text-teal-800',
  'interview-scoring': 'bg-indigo-100 text-indigo-800',
  'whatif-simulation': 'bg-amber-100 text-amber-800',
  'promotion-readiness': 'bg-emerald-100 text-emerald-800',
};

export default function ThresholdsConfigTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [configs, setConfigs] = useState<ThresholdConfig[]>([]);
  const [accuracy, setAccuracy] = useState<ModuleAccuracy[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<ThresholdConfig | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editAutoApprove, setEditAutoApprove] = useState(80);
  const [editReview, setEditReview] = useState(50);
  const [editReject, setEditReject] = useState(30);
  const [editRole, setEditRole] = useState('HR_MANAGER');
  const [editMaxTime, setEditMaxTime] = useState(48);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const [tRes, aRes] = await Promise.all([
        fetch('/api/cvision/ai/threshold?action=thresholds', { credentials: 'include', signal }),
        fetch('/api/cvision/ai/threshold?action=accuracy', { credentials: 'include', signal }),
      ]);
      const tData = await tRes.json();
      const aData = await aRes.json();
      if (tData.success) setConfigs(tData.data?.thresholds || []);
      if (aData.success) setAccuracy(aData.data?.modules || []);
    } catch {
      toast.error(tr('فشل تحميل إعدادات الحدود', 'Failed to load threshold configs'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const ac = new AbortController(); loadData(ac.signal); return () => ac.abort(); }, [loadData]);

  const openEdit = (cfg: ThresholdConfig) => {
    setEditItem(cfg);
    setEditAutoApprove(cfg.autoApproveThreshold);
    setEditReview(cfg.reviewThreshold);
    setEditReject(cfg.autoRejectThreshold);
    setEditRole(cfg.escalationRole);
    setEditMaxTime(cfg.maxReviewTime);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editItem) return;
    if (editAutoApprove <= editReview) {
      toast.error(tr('يجب أن تكون الموافقة التلقائية أعلى من حد المراجعة', 'Auto-approve must be higher than review threshold'));
      return;
    }
    if (editReview <= editReject) {
      toast.error(tr('يجب أن يكون حد المراجعة أعلى من الرفض التلقائي', 'Review threshold must be higher than auto-reject'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/cvision/ai/threshold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'update-threshold',
          moduleId: editItem.moduleId,
          autoApproveThreshold: editAutoApprove,
          reviewThreshold: editReview,
          autoRejectThreshold: editReject,
          escalationRole: editRole,
          maxReviewTime: editMaxTime,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('تم تحديث الحد', 'Threshold updated'));
        setEditOpen(false);
        loadData();
      } else {
        toast.error(data.error || tr('فشل التحديث', 'Failed to update'));
      }
    } catch {
      toast.error(tr('فشل التحديث', 'Failed to update'));
    } finally {
      setSaving(false);
    }
  };

  const getAccuracyForModule = (moduleId: string) => accuracy.find(a => a.moduleId === moduleId);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1, 2, 3, 4].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 128, borderRadius: 16 }}  />)}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield style={{ height: 20, width: 20 }} />
            {tr('حدود الثقة', 'Confidence Thresholds')}
          </div>
          <div style={{ fontSize: 12, color: C.textMuted }}>
            {tr('تكوين متى يتم قبول قرارات الذكاء الاصطناعي تلقائيًا أو تحتاج مراجعة بشرية أو يتم رفضها تلقائيًا.', 'Configure when AI decisions are auto-approved, need human review, or are auto-rejected.')}
          </div>
        </CVisionCardHeader>
      </CVisionCard>

      {/* Module Threshold Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {configs.map(cfg => {
          const mc = MODULE_COLORS[cfg.moduleId] || 'bg-gray-100 text-gray-800';
          const acc = getAccuracyForModule(cfg.moduleId);

          return (
            <CVisionCard C={C} key={cfg.moduleId}>
              <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <CVisionBadge C={C} className={mc} variant="secondary">{cfg.moduleName}</CVisionBadge>
                      {cfg.isActive ? (
                        <CVisionBadge C={C} variant="outline" style={{ color: C.green }}>{tr('نشط', 'Active')}</CVisionBadge>
                      ) : (
                        <CVisionBadge C={C} variant="outline" className="text-gray-500">{tr('غير نشط', 'Inactive')}</CVisionBadge>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: C.textMuted }}>{cfg.moduleNameAr}</p>
                  </div>
                  <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => openEdit(cfg)}>
                    <Settings style={{ height: 14, width: 14, marginRight: 4 }} />
                    {tr('تعديل', 'Edit')}
                  </CVisionButton>
                </div>

                {/* Threshold Bar */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ position: 'relative', height: 32, borderRadius: '50%', overflow: 'hidden' }}>
                    <div
                      style={{ position: 'absolute', background: C.redDim, display: 'flex', alignItems: 'center', justifyContent: 'center', width: `${cfg.autoRejectThreshold}%` }}
                    >
                      {cfg.autoRejectThreshold >= 15 && (
                        <span style={{ fontWeight: 500, color: C.red }}>{tr('رفض', 'Reject')}</span>
                      )}
                    </div>
                    <div
                      style={{ position: 'absolute', background: C.orangeDim, display: 'flex', alignItems: 'center', justifyContent: 'center', left: `${cfg.autoRejectThreshold}%`, width: `${cfg.autoApproveThreshold - cfg.autoRejectThreshold}%` }}
                    >
                      <span style={{ fontWeight: 500, color: C.orange }}>{tr('مراجعة بشرية', 'Human Review')}</span>
                    </div>
                    <div
                      style={{ position: 'absolute', background: C.greenDim, display: 'flex', alignItems: 'center', justifyContent: 'center', left: `${cfg.autoApproveThreshold}%`, width: `${100 - cfg.autoApproveThreshold}%` }}
                    >
                      {(100 - cfg.autoApproveThreshold) >= 10 && (
                        <span style={{ fontWeight: 500, color: C.green }}>{tr('تلقائي', 'Auto')}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ color: C.textMuted }}>0</span>
                    <span style={{ color: C.red }}>{cfg.autoRejectThreshold}</span>
                    <span style={{ color: C.orange }}>{cfg.reviewThreshold}</span>
                    <span style={{ color: C.green }}>{cfg.autoApproveThreshold}</span>
                    <span style={{ color: C.textMuted }}>100</span>
                  </div>
                </div>

                {/* Details row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: C.textMuted, flexWrap: 'wrap' }}>
                  <span>{tr('التصعيد:', 'Escalation:')} <span style={{ fontWeight: 500 }}>{ROLE_LABELS[cfg.escalationRole] || cfg.escalationRole}</span></span>
                  <span>{tr('الحد الأقصى لوقت المراجعة:', 'Max review time:')} <span style={{ fontWeight: 500 }}>{cfg.maxReviewTime}{tr('س', 'h')}</span></span>
                  {acc && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {tr('الدقة:', 'Accuracy:')}
                      <span className={`font-medium ${acc.accuracyRate >= 80 ? 'text-green-600' : acc.accuracyRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {acc.accuracyRate}%
                      </span>
                      ({acc.totalDecisions} {tr('قرارات', 'decisions')})
                      {acc.accuracyRate < 80 && (
                        <AlertTriangle style={{ height: 12, width: 12, color: C.orange }} />
                      )}
                    </span>
                  )}
                </div>

                {/* Suggestions */}
                {acc && acc.accuracyRate < 80 && acc.totalDecisions >= 5 && (
                  <div style={{ marginTop: 8, borderRadius: 8, background: C.orangeDim, border: `1px solid ${C.border}`, padding: 8, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <AlertTriangle style={{ height: 14, width: 14, color: C.orange, marginTop: 2 }} />
                    <p style={{ fontSize: 12, color: C.orange }}>
                      {tr(`الدقة أقل من هدف 80%. ضع في اعتبارك خفض الموافقة التلقائية إلى ${Math.max(cfg.autoApproveThreshold - 5, cfg.reviewThreshold + 5)}% لالتقاط المزيد من الحالات الحدية.`, `Accuracy below 80% target. Consider lowering auto-approve to ${Math.max(cfg.autoApproveThreshold - 5, cfg.reviewThreshold + 5)}% to capture more edge cases.`)}
                    </p>
                  </div>
                )}
              </CVisionCardBody>
            </CVisionCard>
          );
        })}
      </div>

      {/* Saudi Labor Rules info */}
      <CVisionCard C={C} className="border-blue-200">
        <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: C.blue, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Shield style={{ height: 14, width: 14 }} />
            {tr('كيف تعمل الحدود', 'How Thresholds Work')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: C.blue }}>
            <p>{tr('≥ حد الموافقة التلقائية ← يتم تطبيق القرار تلقائيًا بدون تدخل بشري', '≥ Auto-Approve threshold → Decision applied automatically, no human needed')}</p>
            <p>{tr('≥ حد المراجعة ولكن < الموافقة التلقائية ← في قائمة المراجعة البشرية مع مؤقت انتهاء', '≥ Review threshold but < Auto-Approve → Queued for human review with expiration timer')}</p>
            <p>{tr('< حد الرفض التلقائي ← يتم رفض القرار تلقائيًا كجودة منخفضة', '< Auto-Reject threshold → Decision automatically rejected as low quality')}</p>
            <p>{tr('العناصر المتأخرة يتم تصعيدها تلقائيًا إلى دور التصعيد المحدد', 'Overdue items are auto-escalated to the configured escalation role')}</p>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* ── Edit Dialog ── */}
      <CVisionDialog C={C} open={editOpen} onClose={() => setEditOpen(false)} title={tr('تعديل الإعدادات', 'Edit Configuration')} isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              {editItem ? tr(`تكوين حدود الموافقة التلقائية والمراجعة لـ ${editItem.moduleName}`, `Configure auto-approve and review thresholds for ${editItem.moduleName}`) : tr('ضبط حدود قرارات الذكاء الاصطناعي', 'Adjust AI decision thresholds')}
            </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>{tr('حد الموافقة التلقائية (≥ هذا ← موافقة تلقائية)', 'Auto-Approve Threshold (≥ this → auto-approve)')}</CVisionLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={editAutoApprove}
                  onChange={e => setEditAutoApprove(parseInt(e.target.value))}
                  style={{ flex: 1, height: 8 }}
                />
                <CVisionInput C={C}
                  type="number"
                  style={{ width: 80 }}
                  value={editAutoApprove}
                  onChange={e => setEditAutoApprove(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>{tr('حد المراجعة (≥ هذا ← مراجعة بشرية)', 'Review Threshold (≥ this → human review)')}</CVisionLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range"
                  min={5}
                  max={95}
                  value={editReview}
                  onChange={e => setEditReview(parseInt(e.target.value))}
                  style={{ flex: 1, height: 8 }}
                />
                <CVisionInput C={C}
                  type="number"
                  style={{ width: 80 }}
                  value={editReview}
                  onChange={e => setEditReview(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>{tr('حد الرفض التلقائي (< هذا ← رفض تلقائي)', 'Auto-Reject Threshold (< this → auto-reject)')}</CVisionLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range"
                  min={0}
                  max={90}
                  value={editReject}
                  onChange={e => setEditReject(parseInt(e.target.value))}
                  style={{ flex: 1, height: 8 }}
                />
                <CVisionInput C={C}
                  type="number"
                  style={{ width: 80 }}
                  value={editReject}
                  onChange={e => setEditReject(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Preview bar */}
            <div>
              <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('معاينة', 'Preview')}</CVisionLabel>
              <div style={{ position: 'relative', height: 24, borderRadius: '50%', overflow: 'hidden', marginTop: 4 }}>
                <div style={{ position: 'absolute', background: C.redDim, width: `${editReject}%` }} />
                <div style={{ position: 'absolute', background: C.orangeDim, left: `${editReject}%`, width: `${editAutoApprove - editReject}%` }} />
                <div style={{ position: 'absolute', background: C.greenDim, left: `${editAutoApprove}%`, width: `${100 - editAutoApprove}%` }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C}>{tr('دور التصعيد', 'Escalation Role')}</CVisionLabel>
                <CVisionSelect
                C={C}
                value={editRole}
                onChange={setEditRole}
                options={[
                  { value: 'HR_MANAGER', label: tr('مدير الموارد البشرية', 'HR Manager') },
                  { value: 'MANAGER', label: tr('المدير', 'Manager') },
                  { value: 'OWNER', label: tr('المالك', 'Owner') },
                  { value: 'ADMIN', label: tr('المسؤول', 'Admin') },
                ]}
              />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C}>{tr('الحد الأقصى لوقت المراجعة (ساعات)', 'Max Review Time (hours)')}</CVisionLabel>
                <CVisionInput C={C}
                  type="number"
                  min={1}
                  max={720}
                  value={editMaxTime}
                  onChange={e => setEditMaxTime(parseInt(e.target.value) || 48)}
                />
              </div>
            </div>

            {/* Validation */}
            {editAutoApprove <= editReview && (
              <p style={{ fontSize: 12, color: C.red }}>{tr('يجب أن تكون الموافقة التلقائية أعلى من حد المراجعة', 'Auto-approve must be higher than review threshold')}</p>
            )}
            {editReview <= editReject && (
              <p style={{ fontSize: 12, color: C.red }}>{tr('يجب أن يكون حد المراجعة أعلى من الرفض التلقائي', 'Review threshold must be higher than auto-reject')}</p>
            )}
          </div>

          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => {}}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark}
              onClick={handleSave}
              disabled={saving || editAutoApprove <= editReview || editReview <= editReject}
            >
              {saving ? <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite', marginRight: 8 }} /> : <Save style={{ height: 16, width: 16, marginRight: 8 }} />}
              {tr('حفظ', 'Save')}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}
