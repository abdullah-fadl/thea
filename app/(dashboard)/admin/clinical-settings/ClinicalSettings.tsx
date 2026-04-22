'use client';

import { useEffect, useState } from 'react';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';

interface ClinicalSettings {
  requireNursingBeforeDoctor: boolean;
  requireConsentBeforeTransfer: boolean;
  requireVitalsBeforeTransfer: boolean;
  requireTimeoutBeforeProcedure: boolean;
  allowVitalsRefusalWithConsent: boolean;
  lockNursingAfterReady: boolean;
  autoPriorityFromVitals: boolean;
}

const DEFAULT_SETTINGS: ClinicalSettings = {
  requireNursingBeforeDoctor: true,
  requireConsentBeforeTransfer: false,
  requireVitalsBeforeTransfer: true,
  requireTimeoutBeforeProcedure: true,
  allowVitalsRefusalWithConsent: false,
  lockNursingAfterReady: true,
  autoPriorityFromVitals: true,
};

const SETTINGS_CONFIG: {
  key: keyof ClinicalSettings;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
}[] = [
  {
    key: 'requireNursingBeforeDoctor',
    label: 'يجب إتمام التمريض قبل الطبيب',
    labelEn: 'Require nursing before doctor',
    description: 'لن يتمكن الطبيب من فتح الزيارة حتى يكتمل تقييم التمريض',
    descriptionEn: 'Doctor cannot open visit until nursing assessment is complete',
  },
  {
    key: 'requireConsentBeforeTransfer',
    label: 'يجب الحصول على الموافقة قبل التحويل',
    labelEn: 'Require consent before transfer',
    description: 'يجب توقيع موافقة المريض قبل تحويله للطبيب',
    descriptionEn: 'Patient consent must be signed before transfer to doctor',
  },
  {
    key: 'requireVitalsBeforeTransfer',
    label: 'يجب تسجيل العلامات الحيوية قبل التحويل',
    labelEn: 'Require vitals before transfer',
    description: 'يجب تسجيل العلامات الحيوية قبل تحويل المريض للطبيب',
    descriptionEn: 'Vitals must be recorded before transferring patient to doctor',
  },
  {
    key: 'requireTimeoutBeforeProcedure',
    label: 'يجب إتمام Time Out قبل الإجراء',
    labelEn: 'Require Time Out before procedure',
    description: 'يجب إتمام قائمة التحقق الجراحية قبل بدء أي إجراء',
    descriptionEn: 'Surgical safety checklist must be completed before any procedure',
  },
  {
    key: 'allowVitalsRefusalWithConsent',
    label: 'السماح برفض العلامات الحيوية مع موافقة الرفض',
    labelEn: 'Allow vitals refusal with consent',
    description: 'يسمح للمريض برفض قياس العلامات الحيوية إذا وقّع موافقة الرفض',
    descriptionEn: 'Allow patient to refuse vitals if a refusal consent is signed',
  },
  {
    key: 'lockNursingAfterReady',
    label: 'قفل سجل التمريض بعد التحويل',
    labelEn: 'Lock nursing record after ready',
    description: 'لن يمكن تعديل سجل التمريض بعد تحويل المريض للطبيب إلا بإذن',
    descriptionEn: 'Nursing record cannot be edited after transfer unless unlocked',
  },
  {
    key: 'autoPriorityFromVitals',
    label: 'اقتراح الأولوية تلقائياً من العلامات الحيوية',
    labelEn: 'Auto-suggest priority from vitals',
    description: 'يتم اقتراح أولوية المريض تلقائياً بناءً على العلامات الحيوية الحرجة',
    descriptionEn: 'Patient priority is auto-suggested based on critical vital signs',
  },
];

export default function ClinicalSettings() {
  const { language } = useLang();
  const { toast } = useToast();
  const { hasPermission, isLoading } = useRoutePermission('/admin/clinical-settings');
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [settings, setSettings] = useState<ClinicalSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/clinical-settings', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
          }
        }
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleToggle = (key: keyof ClinicalSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/clinical-settings', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) throw new Error();
      toast({ title: tr('تم حفظ الإعدادات', 'Settings saved') });
    } catch {
      toast({ title: tr('فشل حفظ الإعدادات', 'Failed to save settings'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-destructive">{tr('ليس لديك صلاحية', 'Access denied')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">{tr('إعدادات سريرية', 'Clinical Settings')}</h1>
          <p className="text-muted-foreground mt-1">{tr('إعدادات سير العمل السريري وقواعد الأمان', 'Clinical workflow settings and safety rules')}</p>
        </div>

        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          {SETTINGS_CONFIG.map((item) => (
            <div key={item.key} className="p-5 flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="font-medium text-foreground">
                  {language === 'ar' ? item.label : item.labelEn}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {language === 'ar' ? item.description : item.descriptionEn}
                </div>
              </div>
              <button
                onClick={() => handleToggle(item.key)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings[item.key] ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
                    settings[item.key] ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {saving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ الإعدادات', 'Save Settings')}
          </button>
        </div>
      </div>
    </div>
  );
}
