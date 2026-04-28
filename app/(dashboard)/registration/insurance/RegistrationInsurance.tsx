'use client';

import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';

export default function RegistrationInsurance() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { hasPermission, isLoading } = useRoutePermission('/registration');

  if (isLoading) {
    return (
      <div className="p-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-extrabold text-base">{tr('التأمين', 'Insurance')}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{tr('جاري التحميل...', 'Loading...')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="p-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-extrabold text-base">{tr('التأمين', 'Insurance')}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{tr('غير مصرح', 'Forbidden')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-extrabold text-base">{tr('التأمين (للقراءة فقط)', 'Insurance (Read-only)')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{tr('رابط مرجعي فقط — لا تسعير أو مطالبات', 'Reference link only — no pricing or claims')}</p>
        </div>
        <div className="p-5 text-sm text-muted-foreground space-y-2">
          <div>{tr('هذا عنصر نائب لتكاملات التأمين المستقبلية.', 'This is a placeholder for future insurance integrations.')}</div>
          <div>{tr('لا تتوفر إجراءات فوترة أو مدفوعات أو ترميز.', 'No billing, payments, or coding actions are available.')}</div>
        </div>
      </div>
    </div>
  );
}
