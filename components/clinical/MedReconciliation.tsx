'use client';

import { useState, useEffect } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Pause,
  Play,
  Edit2,
  X,
  Pill,
  ClipboardCheck,
} from 'lucide-react';
import type { HomeMedication } from './HomeMedications';
import { checkDrugAllergy } from '@/lib/clinical/allergyCheck';
import { checkDuplicateTherapy } from '@/lib/clinical/duplicateCheck';
import { useLang } from '@/hooks/use-lang';

export type ReconciliationDecision = 'continue' | 'hold' | 'stop' | 'modify' | 'pending';

export interface ReconciliationItem {
  homeMedication: HomeMedication;
  decision: ReconciliationDecision;
  newDose?: string;
  newFrequency?: string;
  reason?: string;
  hospitalEquivalent?: string;
  alerts: {
    type: 'allergy' | 'duplicate' | 'interaction' | 'info';
    severity: 'high' | 'moderate' | 'low';
    message: string;
  }[];
  decidedBy?: string;
  decidedAt?: string;
}

interface Props {
  patientId: string;
  encounterId: string;
  type: 'admission' | 'discharge';
  homeMedications: HomeMedication[];
  hospitalMedications?: any[];
  patientAllergies?: string[];
  onComplete: (items: ReconciliationItem[]) => void;
  onCancel: () => void;
}

const decisionConfig: Record<
  ReconciliationDecision,
  {
    label: string;
    labelAr: string;
    color: string;
    icon: any;
    description: string;
    descriptionAr: string;
  }
> = {
  continue: {
    label: 'Continue',
    labelAr: 'استمرار',
    color: 'bg-green-100 text-green-700 border-green-300',
    icon: Play,
    description: 'Continue the medication at the same dose',
    descriptionAr: 'استمر في إعطاء الدواء بنفس الجرعة',
  },
  hold: {
    label: 'Hold',
    labelAr: 'إيقاف مؤقت',
    color: 'bg-amber-100 text-amber-700 border-amber-300',
    icon: Pause,
    description: 'Temporarily hold during admission',
    descriptionAr: 'أوقف الدواء مؤقتاً أثناء الإقامة',
  },
  stop: {
    label: 'Stop',
    labelAr: 'إيقاف دائم',
    color: 'bg-red-100 text-red-700 border-red-300',
    icon: X,
    description: 'Permanently discontinue the medication',
    descriptionAr: 'أوقف الدواء نهائياً',
  },
  modify: {
    label: 'Modify',
    labelAr: 'تعديل',
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    icon: Edit2,
    description: 'Continue with dose or frequency adjustment',
    descriptionAr: 'استمر مع تعديل الجرعة أو التكرار',
  },
  pending: {
    label: 'Pending',
    labelAr: 'قيد المراجعة',
    color: 'bg-muted text-foreground border-border',
    icon: AlertTriangle,
    description: 'No decision made yet',
    descriptionAr: 'لم يتم اتخاذ قرار بعد',
  },
};

export function MedReconciliation({
  patientId,
  encounterId,
  type,
  homeMedications,
  hospitalMedications = [],
  patientAllergies = [],
  onComplete,
  onCancel,
}: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [currentStep, setCurrentStep] = useState(0);
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [showModifyForm, setShowModifyForm] = useState<number | null>(null);

  useEffect(() => {
    const initialItems: ReconciliationItem[] = homeMedications.map((med) => {
      const alerts: ReconciliationItem['alerts'] = [];

      const allergyResult = checkDrugAllergy(
        med.drugName,
        patientAllergies.map((a) => ({ allergen: a }))
      );
      if (!allergyResult.safe) {
        allergyResult.alerts.forEach((alert) => {
          alerts.push({
            type: 'allergy',
            severity:
              alert.severity === 'contraindicated' || alert.severity === 'high' ? 'high' : 'moderate',
            message: alert.messageAr,
          });
        });
      }

      const duplicateAlerts = checkDuplicateTherapy(
        med.drugName,
        hospitalMedications.map((m) => ({
          drugCode: m.drugCode || '',
          drugName: m.drugName,
          status: 'active' as const,
          startDate: m.startDate || '',
        }))
      );
      duplicateAlerts.forEach((alert) => {
        alerts.push({
          type: 'duplicate',
          severity: alert.severity,
          message: alert.messageAr,
        });
      });

      return {
        homeMedication: med,
        decision: 'pending',
        alerts,
      };
    });

    setItems(initialItems);
    setCurrentStep(0);
  }, [homeMedications, hospitalMedications, patientAllergies]);

  const currentItem = items[currentStep];
  const pendingCount = items.filter((i) => i.decision === 'pending').length;
  const completedCount = items.length - pendingCount;

  const handleDecision = (
    decision: ReconciliationDecision,
    extra?: {
      newDose?: string;
      newFrequency?: string;
      reason?: string;
    }
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[currentStep] = {
        ...updated[currentStep],
        decision,
        ...extra,
        decidedAt: new Date().toISOString(),
      };
      return updated;
    });

    if (currentStep < items.length - 1) {
      const nextPending = items.findIndex((item, idx) => idx > currentStep && item.decision === 'pending');
      if (nextPending !== -1) {
        setCurrentStep(nextPending);
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleComplete = () => {
    if (pendingCount > 0) {
      if (!confirm(tr(`لا يزال هناك ${pendingCount} دواء بدون قرار. هل تريد المتابعة؟`, `There are still ${pendingCount} medications without a decision. Continue?`))) {
        return;
      }
    }
    onComplete(items);
  };

  if (items.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-slate-200 p-8 text-center">
        <Pill className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p className="text-slate-500">{tr('لا توجد أدوية منزلية للمصالحة', 'No home medications to reconcile')}</p>
        <button onClick={onCancel} className="mt-4 px-4 py-2 border rounded-lg hover:bg-slate-50">
          {tr('إغلاق', 'Close')}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-slate-200">
      <div className="p-4 border-b bg-slate-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {type === 'admission' ? tr('مصالحة الأدوية - الدخول', 'Medication Reconciliation - Admission') : tr('مصالحة الأدوية - الخروج', 'Medication Reconciliation - Discharge')}
            </h2>
            <p className="text-sm text-slate-500">
              {completedCount}/{items.length} {tr('تم مراجعتها', 'reviewed')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
              {items.filter((i) => i.decision === 'continue').length} {tr('استمرار', 'Continue')}
            </span>
            <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">
              {items.filter((i) => i.decision === 'hold').length} {tr('إيقاف مؤقت', 'Hold')}
            </span>
            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
              {items.filter((i) => i.decision === 'stop').length} {tr('إيقاف', 'Stop')}
            </span>
          </div>
        </div>

        <div className="mt-4 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 transition-all" style={{ width: `${(completedCount / items.length) * 100}%` }} />
        </div>
      </div>

      <div className="p-4 border-b overflow-x-auto">
        <div className="flex gap-2">
          {items.map((item, idx) => {
            const config = decisionConfig[item.decision];
            const hasAlerts = item.alerts.length > 0;
            return (
              <button
                key={item.homeMedication.id}
                onClick={() => setCurrentStep(idx)}
                className={`flex-shrink-0 px-3 py-2 rounded-lg border-2 transition-all ${
                  idx === currentStep ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                } ${config.color}`}
              >
                <div className="flex items-center gap-2">
                  {hasAlerts && <AlertTriangle className="w-4 h-4 text-red-500" />}
                  <span className="text-sm font-medium whitespace-nowrap">{item.homeMedication.drugName}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {currentItem && (
        <div className="p-6">
          {currentItem.alerts.length > 0 && (
            <div className="mb-4 space-y-2">
              {currentItem.alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg flex items-start gap-2 ${
                    alert.severity === 'high' ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
                  }`}
                >
                  <AlertTriangle
                    className={`w-5 h-5 flex-shrink-0 ${
                      alert.severity === 'high' ? 'text-red-500' : 'text-amber-500'
                    }`}
                  />
                  <span
                    className={`text-sm ${
                      alert.severity === 'high' ? 'text-red-700' : 'text-amber-700'
                    }`}
                  >
                    {alert.message}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-card rounded-lg">
                <Pill className="w-8 h-8 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-slate-900">{currentItem.homeMedication.drugName}</h3>
                {currentItem.homeMedication.genericName && (
                  <p className="text-slate-500">{currentItem.homeMedication.genericName}</p>
                )}
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-xs text-slate-500">{tr('الجرعة', 'Dose')}</span>
                    <p className="font-medium">
                      {currentItem.homeMedication.dose} {currentItem.homeMedication.unit}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">{tr('التكرار', 'Frequency')}</span>
                    <p className="font-medium">{currentItem.homeMedication.frequency}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">{tr('الطريقة', 'Route')}</span>
                    <p className="font-medium">{currentItem.homeMedication.route}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">{tr('السبب', 'Indication')}</span>
                    <p className="font-medium">{currentItem.homeMedication.indication || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['continue', 'hold', 'stop', 'modify'] as ReconciliationDecision[]).map((decision) => {
              const config = decisionConfig[decision];
              const Icon = config.icon;
              const isSelected = currentItem.decision === decision;
              return (
                <button
                  key={decision}
                  onClick={() => {
                    if (decision === 'modify') {
                      setShowModifyForm(currentStep);
                    } else {
                      handleDecision(decision);
                    }
                  }}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    isSelected ? `${config.color} border-current` : 'bg-card border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Icon className={`w-6 h-6 mx-auto mb-2 ${isSelected ? '' : 'text-slate-400'}`} />
                  <div className="font-medium">{language === 'ar' ? config.labelAr : config.label}</div>
                  <div className="text-xs text-slate-500 mt-1">{language === 'ar' ? config.descriptionAr : config.description}</div>
                </button>
              );
            })}
          </div>

          {currentItem.decision !== 'pending' && currentItem.decision !== 'continue' && (
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">{tr('سبب القرار', 'Decision Reason')}</label>
              <input
                type="text"
                value={currentItem.reason || ''}
                onChange={(e) => {
                  setItems((prev) => {
                    const updated = [...prev];
                    updated[currentStep] = {
                      ...updated[currentStep],
                      reason: e.target.value,
                    };
                    return updated;
                  });
                }}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder={tr('اكتب سبب القرار...', 'Enter decision reason...')}
              />
            </div>
          )}
        </div>
      )}

      <div className="p-4 border-t bg-slate-50 flex items-center justify-between">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-card disabled:opacity-50"
        >
          <ArrowRight className="w-4 h-4" />
          {tr('السابق', 'Previous')}
        </button>

        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="px-4 py-2 border rounded-lg hover:bg-card">
            {tr('إلغاء', 'Cancel')}
          </button>

          {currentStep === items.length - 1 || pendingCount === 0 ? (
            <button
              onClick={handleComplete}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <ClipboardCheck className="w-4 h-4" />
              {tr('إنهاء المصالحة', 'Complete Reconciliation')}
            </button>
          ) : (
            <button
              onClick={() => setCurrentStep(Math.min(items.length - 1, currentStep + 1))}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {tr('التالي', 'Next')}
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {showModifyForm !== null && (
        <ModifyDoseForm
          medication={items[showModifyForm].homeMedication}
          currentDose={items[showModifyForm].newDose}
          currentFrequency={items[showModifyForm].newFrequency}
          onSubmit={(newDose, newFrequency, reason) => {
            handleDecision('modify', { newDose, newFrequency, reason });
            setShowModifyForm(null);
          }}
          onClose={() => setShowModifyForm(null)}
        />
      )}
    </div>
  );
}

function ModifyDoseForm({
  medication,
  currentDose,
  currentFrequency,
  onSubmit,
  onClose,
}: {
  medication: HomeMedication;
  currentDose?: string;
  currentFrequency?: string;
  onSubmit: (newDose: string, newFrequency: string, reason: string) => void;
  onClose: () => void;
}) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [newDose, setNewDose] = useState(currentDose || medication.dose);
  const [newFrequency, setNewFrequency] = useState(currentFrequency || medication.frequency);
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">{tr('تعديل الجرعة', 'Modify Dose')}</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{tr('الجرعة الجديدة', 'New Dose')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newDose}
                onChange={(e) => setNewDose(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg"
              />
              <span className="px-3 py-2 bg-slate-100 rounded-lg">{medication.unit}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {tr('الجرعة الحالية:', 'Current dose:')} {medication.dose} {medication.unit}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{tr('التكرار الجديد', 'New Frequency')}</label>
            <select
              value={newFrequency}
              onChange={(e) => setNewFrequency(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="QD">{tr('مرة يومياً (QD)', 'Once daily (QD)')}</option>
              <option value="BID">{tr('مرتين يومياً (BID)', 'Twice daily (BID)')}</option>
              <option value="TID">{tr('ثلاث مرات يومياً (TID)', 'Three times daily (TID)')}</option>
              <option value="QID">{tr('أربع مرات يومياً (QID)', 'Four times daily (QID)')}</option>
              <option value="Q8H">{tr('كل 8 ساعات (Q8H)', 'Every 8 hours (Q8H)')}</option>
              <option value="Q12H">{tr('كل 12 ساعة (Q12H)', 'Every 12 hours (Q12H)')}</option>
              <option value="QHS">{tr('عند النوم (QHS)', 'At bedtime (QHS)')}</option>
              <option value="PRN">{tr('عند الحاجة (PRN)', 'As needed (PRN)')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{tr('سبب التعديل *', 'Reason for Modification *')}</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={2}
              placeholder={tr('مثال: تعديل الجرعة حسب وظائف الكلى', 'e.g., Dose adjusted for renal function')}
              required
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50">
            {tr('إلغاء', 'Cancel')}
          </button>
          <button
            onClick={() => {
              if (!reason.trim()) {
                alert(tr('يرجى إدخال سبب التعديل', 'Please enter a reason for the modification'));
                return;
              }
              onSubmit(newDose, newFrequency, reason);
            }}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {tr('تأكيد التعديل', 'Confirm Modification')}
          </button>
        </div>
      </div>
    </div>
  );
}
