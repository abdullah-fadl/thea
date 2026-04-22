'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useLang } from '@/hooks/use-lang';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface AllergyBannerProps {
  allergies: string | null;
  patientName?: string;
}

export function AllergyBanner({ allergies, patientName }: AllergyBannerProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const normalized = String(allergies || '').trim();
  const hasAllergies = Boolean(normalized);

  const toneClasses = hasAllergies
    ? 'border-red-300 bg-red-50 text-red-950'
    : 'border-emerald-200 bg-emerald-50 text-emerald-900';
  const icon = hasAllergies ? <AlertTriangle className="h-6 w-6 text-red-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  const headline = hasAllergies ? `${tr('الحساسيات', 'ALLERGIES')}: ${normalized}` : tr('لا توجد حساسية دوائية معروفة', 'No Known Drug Allergies');

  return (
    <Card className={`w-full ${toneClasses}`} dir="auto">
      <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div>{icon}</div>
          <div className="space-y-1">
            <div className={hasAllergies ? 'text-base font-semibold' : 'text-sm font-medium'}>{headline}</div>
            {patientName ? (
              <div className="text-xs text-muted-foreground">{tr('المريض', 'Patient')}: {patientName}</div>
            ) : null}
          </div>
        </div>
        {hasAllergies ? (
          <div className="text-xs font-medium uppercase tracking-wide">{tr('تنبيه أمان حرج', 'Critical Safety Alert')}</div>
        ) : (
          <div className="text-xs text-muted-foreground">{tr('تم اجتياز فحص السلامة', 'Safety check passed')}</div>
        )}
      </CardContent>
    </Card>
  );
}
