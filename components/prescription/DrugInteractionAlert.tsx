'use client';

import { ShieldAlert, AlertTriangle, Info, type LucideIcon } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

interface Interaction {
  drug1: string;
  drug2: string;
  severity: 'major' | 'moderate' | 'minor';
  description: string;
  descriptionAr?: string;
}

interface DrugInteractionAlertProps {
  interactions: Interaction[];
  onAcknowledge: () => void;
  onCancel: () => void;
}

const SEVERITY_CONFIG: Record<string, { bg: string; border: string; Icon: LucideIcon; iconColor: string; labelAr: string; labelEn: string; labelColor: string }> = {
  major: {
    bg: 'bg-red-50',
    border: 'border-red-500',
    Icon: ShieldAlert,
    iconColor: 'text-red-600',
    labelAr: 'خطير',
    labelEn: 'Major',
    labelColor: 'text-red-700',
  },
  moderate: {
    bg: 'bg-amber-50',
    border: 'border-amber-500',
    Icon: AlertTriangle,
    iconColor: 'text-amber-600',
    labelAr: 'متوسط',
    labelEn: 'Moderate',
    labelColor: 'text-amber-700',
  },
  minor: {
    bg: 'bg-blue-50',
    border: 'border-blue-500',
    Icon: Info,
    iconColor: 'text-blue-600',
    labelAr: 'بسيط',
    labelEn: 'Minor',
    labelColor: 'text-blue-700',
  },
};

export function DrugInteractionAlert({ interactions, onAcknowledge, onCancel }: DrugInteractionAlertProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const hasMajor = interactions.some((i) => i.severity === 'major');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl max-w-lg w-full">
        <div className={`p-4 rounded-t-xl ${hasMajor ? 'bg-red-600' : 'bg-amber-500'}`}>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            {hasMajor ? <ShieldAlert className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />} {tr('تحذير تفاعل دوائي', 'Drug interaction warning')}
          </h2>
        </div>

        <div className="p-6 max-h-96 overflow-y-auto">
          {interactions.map((interaction, idx) => {
            const config = SEVERITY_CONFIG[interaction.severity];
            return (
              <div
                key={idx}
                className={`mb-4 p-4 rounded-lg border-2 ${config.bg} ${config.border}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <config.Icon className={`w-5 h-5 ${config.iconColor}`} />
                  <span className={`font-semibold ${config.labelColor}`}>{language === 'ar' ? config.labelAr : config.labelEn}</span>
                </div>
                <p className="font-medium text-slate-900">
                  {interaction.drug1} + {interaction.drug2}
                </p>
                <p className="text-slate-600 mt-1">{language === 'ar' ? (interaction.descriptionAr || interaction.description) : interaction.description}</p>
              </div>
            );
          })}
        </div>

        <div className="p-6 border-t border-slate-200">
          {hasMajor ? (
            <div className="mb-4 p-3 bg-red-100 rounded-lg text-red-700 text-sm">
              {tr('تم اكتشاف تفاعل خطير. يرجى المراجعة قبل المتابعة.', 'Major interaction detected. Review before proceeding.')}
            </div>
          ) : null}

          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-slate-600 hover:text-slate-800"
            >
              {tr('تعديل الوصفة', 'Edit prescription')}
            </button>
            <button
              onClick={onAcknowledge}
              className={`px-6 py-2 rounded-lg font-medium text-white ${
                hasMajor ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {hasMajor ? tr('أقر وأتابع', 'Acknowledge and continue') : tr('متابعة', 'Continue')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
