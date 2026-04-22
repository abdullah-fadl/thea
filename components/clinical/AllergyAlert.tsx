'use client';

import { AlertTriangle, XCircle, AlertCircle, Info } from 'lucide-react';
import { AllergyAlert as AllergyAlertType } from '@/lib/clinical/allergyCheck';
import { useLang } from '@/hooks/use-lang';

interface Props {
  alerts: AllergyAlertType[];
  onOverride?: (alertId: string, reason: string) => void;
  onCancel?: () => void;
}

const severityConfig = {
  contraindicated: {
    icon: XCircle,
    bg: 'bg-red-50',
    border: 'border-red-500',
    text: 'text-red-800',
    iconColor: 'text-red-600',
  },
  high: {
    icon: AlertTriangle,
    bg: 'bg-orange-50',
    border: 'border-orange-500',
    text: 'text-orange-800',
    iconColor: 'text-orange-600',
  },
  moderate: {
    icon: AlertCircle,
    bg: 'bg-yellow-50',
    border: 'border-yellow-500',
    text: 'text-yellow-800',
    iconColor: 'text-yellow-600',
  },
  low: {
    icon: Info,
    bg: 'bg-blue-50',
    border: 'border-blue-500',
    text: 'text-blue-800',
    iconColor: 'text-blue-600',
  },
};

export function AllergyAlertComponent({ alerts, onOverride, onCancel }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  if (!alerts.length) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-red-600 flex items-center gap-2 mb-4">
            <AlertTriangle className="w-6 h-6" />
            {tr('تنبيه حساسية الأدوية', 'Drug Allergy Alert')}
          </h2>

          <div className="space-y-4">
            {alerts.map((alert) => {
              const config = severityConfig[alert.severity];
              const Icon = config.icon;

              return (
                <div key={alert.id} className={`p-4 rounded-lg border-2 ${config.bg} ${config.border}`}>
                  <div className="flex items-start gap-3">
                    <Icon className={`w-5 h-5 mt-0.5 ${config.iconColor}`} />
                    <div className="flex-1">
                      <p className={`font-semibold ${config.text}`}>{language === 'ar' ? alert.messageAr : alert.message}</p>
                      <p className="text-sm text-muted-foreground mt-1">{language === 'ar' ? alert.message : alert.messageAr}</p>
                      <p className="text-sm mt-2 font-medium">{tr('التوصية', 'Recommendation')}: {language === 'ar' ? alert.recommendationAr : alert.recommendation}</p>
                      {alert.crossReactivityRisk && (
                        <p className="text-xs text-muted-foreground mt-1">{tr('نسبة الخطر', 'Risk ratio')}: {alert.crossReactivityRisk}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-2 px-4 bg-muted text-foreground rounded-lg font-medium hover:bg-muted"
            >
              {tr('إلغاء الوصفة', 'Cancel Prescription')}
            </button>

            {alerts.some((a) => a.requiresOverride) && onOverride && (
              <button
                onClick={() => {
                  const reason = prompt(tr('سبب تجاوز التحذير:', 'Reason for overriding the alert:'));
                  if (reason) {
                    alerts.forEach((a) => {
                      if (a.requiresOverride) onOverride(a.id, reason);
                    });
                  }
                }}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
              >
                {tr('تجاوز (مع التوثيق)', 'Override (with documentation)')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
