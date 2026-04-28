'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Plus, Target, CheckCircle2, Circle, Clock, Trash2, AlertCircle, XCircle } from 'lucide-react';
import { type ReactNode } from 'react';
import { useLang } from '@/hooks/use-lang';
import {
  type CarePlanData, type CarePlanEntry, type NCPGoal, type NCPIntervention, type NCPStatus, type NCPPriority, type GoalStatus,
  DEFAULT_CARE_PLAN, COMMON_DIAGNOSES, createEmptyPlan,
} from '@/lib/clinical/nursingCarePlan';

interface NursingCarePlanProps {
  value: CarePlanData | null;
  onChange: (data: CarePlanData) => void;
  compact?: boolean;
  disabled?: boolean;
}

const PRIORITY_CFG: Record<NCPPriority, { bg: string; text: string; labelAr: string; labelEn: string }> = {
  HIGH: { bg: 'bg-red-100', text: 'text-red-700', labelAr: 'عالية', labelEn: 'High' },
  MEDIUM: { bg: 'bg-amber-100', text: 'text-amber-700', labelAr: 'متوسطة', labelEn: 'Medium' },
  LOW: { bg: 'bg-blue-100', text: 'text-blue-700', labelAr: 'منخفضة', labelEn: 'Low' },
};

const STATUS_CFG: Record<NCPStatus, { bg: string; text: string; labelAr: string; labelEn: string }> = {
  ACTIVE: { bg: 'bg-green-100', text: 'text-green-700', labelAr: 'نشطة', labelEn: 'Active' },
  RESOLVED: { bg: 'bg-emerald-100', text: 'text-emerald-700', labelAr: 'محلولة', labelEn: 'Resolved' },
  REVISED: { bg: 'bg-amber-100', text: 'text-amber-700', labelAr: 'معدّلة', labelEn: 'Revised' },
  DISCONTINUED: { bg: 'bg-muted', text: 'text-muted-foreground', labelAr: 'موقفة', labelEn: 'Discontinued' },
};

const GOAL_STATUS_CFG: Record<GoalStatus, { labelAr: string; labelEn: string; icon: ReactNode }> = {
  NOT_MET: { labelAr: 'لم يتحقق', labelEn: 'Not Met', icon: <XCircle className="w-4 h-4 text-red-500" /> },
  PARTIALLY_MET: { labelAr: 'تحقق جزئياً', labelEn: 'Partially Met', icon: <AlertCircle className="w-4 h-4 text-orange-500" /> },
  MET: { labelAr: 'تحقق', labelEn: 'Met', icon: <CheckCircle2 className="w-4 h-4 text-green-600" /> },
};

export function NursingCarePlan({ value, onChange, compact = false, disabled = false }: NursingCarePlanProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const data = value || DEFAULT_CARE_PLAN;
  const [expanded, setExpanded] = useState(!compact);

  const update = useCallback((plans: CarePlanEntry[]) => {
    onChange({ plans });
  }, [onChange]);

  const activeCount = data.plans.filter(p => p.status === 'ACTIVE').length;

  if (compact) {
    if (!value || data.plans.length === 0) return null;
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
        <Target className="w-3 h-3" /> {activeCount}
      </span>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-3 bg-green-50/50 transition-colors">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-green-600" />
          <span className="font-semibold text-sm text-green-700">{tr('خطة الرعاية التمريضية', 'Nursing Care Plan')}</span>
          {data.plans.length > 0 && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              {activeCount} {tr('نشطة', 'active')} / {data.plans.length}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          {!disabled && (
            <button
              onClick={() => update([createEmptyPlan(), ...data.plans])}
              className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> {tr('إضافة تشخيص تمريضي', 'Add Nursing Diagnosis')}
            </button>
          )}

          {data.plans.length > 0 ? (
            data.plans.map((plan, idx) => (
              <PlanCard key={plan.id} plan={plan} tr={tr} language={language} disabled={disabled}
                onChange={(patch) => { const next = [...data.plans]; next[idx] = { ...next[idx], ...patch, updatedAt: new Date().toISOString() }; update(next); }}
                onRemove={() => update(data.plans.filter((_, i) => i !== idx))}
              />
            ))
          ) : (
            <p className="text-xs text-muted-foreground italic">{tr('لا توجد خطط رعاية', 'No care plans')}</p>
          )}
        </div>
      )}
    </div>
  );
}

function PlanCard({ plan, tr, language, disabled, onChange, onRemove }: {
  plan: CarePlanEntry; tr: (a: string, e: string) => string; language: string; disabled: boolean;
  onChange: (p: Partial<CarePlanEntry>) => void; onRemove: () => void;
}) {
  const [open, setOpen] = useState(plan.status === 'ACTIVE' && !plan.nursingDiagnosis);
  const sCfg = STATUS_CFG[plan.status];
  const pCfg = PRIORITY_CFG[plan.priority];

  const addGoal = () => onChange({ goals: [...plan.goals, { id: `g-${Date.now()}`, description: '', targetDate: '', status: 'NOT_MET', evaluation: '' }] });
  const addIntervention = () => onChange({ interventions: [...plan.interventions, { id: `i-${Date.now()}`, description: '', frequency: '', completed: false }] });

  return (
    <div className={`border rounded-lg overflow-hidden ${plan.status === 'RESOLVED' ? 'opacity-60' : ''}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-muted/50 transition-colors">
        <Target className="w-4 h-4 text-green-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium text-foreground truncate">{plan.nursingDiagnosis || tr('تشخيص جديد', 'New Diagnosis')}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${sCfg.bg} ${sCfg.text}`}>{tr(sCfg.labelAr, sCfg.labelEn)}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${pCfg.bg} ${pCfg.text}`}>{tr(pCfg.labelAr, pCfg.labelEn)}</span>
          </div>
          {plan.relatedTo && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{tr('مرتبط بـ:', 'R/T:')} {plan.relatedTo}</p>}
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">{plan.goals.length}G {plan.interventions.length}I</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t pt-3">
          {/* Diagnosis */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('التشخيص التمريضي', 'Nursing Diagnosis')}</label>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {COMMON_DIAGNOSES.slice(0, 7).map(d => (
                <button key={d.labelEn} onClick={() => !disabled && onChange({ nursingDiagnosis: language === 'ar' ? d.labelAr : d.labelEn })}
                  className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${plan.nursingDiagnosis === (language === 'ar' ? d.labelAr : d.labelEn) ? 'bg-green-600 text-white border-green-600' : 'bg-card text-muted-foreground border-border hover:border-green-300'}`}>
                  {tr(d.labelAr, d.labelEn)}
                </button>
              ))}
            </div>
            <input type="text" value={plan.nursingDiagnosis} onChange={e => !disabled && onChange({ nursingDiagnosis: e.target.value })} placeholder={tr('أو اكتب تشخيص', 'Or type diagnosis')} className="w-full text-xs border rounded px-2 py-1.5" disabled={disabled} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('مرتبط بـ (R/T)', 'Related To')}</label>
              <input type="text" value={plan.relatedTo} onChange={e => !disabled && onChange({ relatedTo: e.target.value })} className="w-full text-xs border rounded px-2 py-1.5" disabled={disabled} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('يتضح من (AEB)', 'Evidenced By')}</label>
              <input type="text" value={plan.evidencedBy} onChange={e => !disabled && onChange({ evidencedBy: e.target.value })} className="w-full text-xs border rounded px-2 py-1.5" disabled={disabled} />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('الحالة', 'Status')}</label>
              <select value={plan.status} onChange={e => !disabled && onChange({ status: e.target.value as NCPStatus })} className="w-full text-xs border rounded px-2 py-1.5" disabled={disabled}>
                {(Object.keys(STATUS_CFG) as NCPStatus[]).map(s => <option key={s} value={s}>{tr(STATUS_CFG[s].labelAr, STATUS_CFG[s].labelEn)}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('الأولوية', 'Priority')}</label>
              <select value={plan.priority} onChange={e => !disabled && onChange({ priority: e.target.value as NCPPriority })} className="w-full text-xs border rounded px-2 py-1.5" disabled={disabled}>
                {(Object.keys(PRIORITY_CFG) as NCPPriority[]).map(p => <option key={p} value={p}>{tr(PRIORITY_CFG[p].labelAr, PRIORITY_CFG[p].labelEn)}</option>)}
              </select>
            </div>
          </div>

          {/* Goals */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-muted-foreground">{tr('الأهداف', 'Goals')} ({plan.goals.length})</label>
              {!disabled && <button onClick={addGoal} className="text-xs text-green-600 hover:text-green-700 flex items-center gap-0.5"><Plus className="w-3 h-3" />{tr('هدف', 'Goal')}</button>}
            </div>
            {plan.goals.map((g, gi) => (
              <div key={g.id} className="flex items-start gap-2 p-2 bg-muted/50 rounded mb-1 text-xs">
                <span>{GOAL_STATUS_CFG[g.status].icon}</span>
                <div className="flex-1 space-y-1">
                  <input type="text" value={g.description} placeholder={tr('وصف الهدف', 'Goal description')} disabled={disabled}
                    onChange={e => { const goals = [...plan.goals]; goals[gi] = { ...g, description: e.target.value }; onChange({ goals }); }}
                    className="w-full text-xs border rounded px-2 py-1" />
                  <div className="flex gap-2">
                    <select value={g.status} disabled={disabled}
                      onChange={e => { const goals = [...plan.goals]; goals[gi] = { ...g, status: e.target.value as GoalStatus }; onChange({ goals }); }}
                      className="text-[10px] border rounded px-1 py-0.5">
                      {(Object.keys(GOAL_STATUS_CFG) as GoalStatus[]).map(s => <option key={s} value={s}>{tr(GOAL_STATUS_CFG[s].labelAr, GOAL_STATUS_CFG[s].labelEn)}</option>)}
                    </select>
                    {!disabled && <button onClick={() => onChange({ goals: plan.goals.filter((_, i) => i !== gi) })} className="text-muted-foreground hover:text-red-500"><Trash2 className="w-3 h-3" /></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Interventions */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-muted-foreground">{tr('التدخلات', 'Interventions')} ({plan.interventions.length})</label>
              {!disabled && <button onClick={addIntervention} className="text-xs text-green-600 hover:text-green-700 flex items-center gap-0.5"><Plus className="w-3 h-3" />{tr('تدخل', 'Intervention')}</button>}
            </div>
            {plan.interventions.map((intv, ii) => (
              <div key={intv.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded mb-1 text-xs">
                <button disabled={disabled} onClick={() => { const interventions = [...plan.interventions]; interventions[ii] = { ...intv, completed: !intv.completed, completedAt: !intv.completed ? new Date().toISOString() : undefined }; onChange({ interventions }); }}>
                  {intv.completed ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                </button>
                <input type="text" value={intv.description} placeholder={tr('وصف التدخل', 'Intervention')} disabled={disabled}
                  onChange={e => { const interventions = [...plan.interventions]; interventions[ii] = { ...intv, description: e.target.value }; onChange({ interventions }); }}
                  className={`flex-1 text-xs border rounded px-2 py-1 ${intv.completed ? 'line-through text-muted-foreground' : ''}`} />
                {!disabled && <button onClick={() => onChange({ interventions: plan.interventions.filter((_, i) => i !== ii) })} className="text-muted-foreground hover:text-red-500"><Trash2 className="w-3 h-3" /></button>}
              </div>
            ))}
          </div>

          {/* Evaluation */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('التقييم', 'Evaluation')}</label>
            <textarea value={plan.evaluation} onChange={e => !disabled && onChange({ evaluation: e.target.value })} rows={2} className="w-full text-xs border rounded px-2 py-1.5 resize-none" disabled={disabled} placeholder={tr('تقييم تقدم الخطة...', 'Evaluate plan progress...')} />
          </div>

          {!disabled && <div className="flex justify-end"><button onClick={onRemove} className="text-xs text-red-500 hover:text-red-700">{tr('حذف الخطة', 'Remove Plan')}</button></div>}
        </div>
      )}
    </div>
  );
}
