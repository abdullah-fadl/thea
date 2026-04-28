'use client';

import { useLang } from '@/hooks/use-lang';

const DENTAL_PROCEDURES = [
  { code: 'D0120', nameAr: 'فحص دوري', nameEn: 'Periodic oral evaluation', fee: 150, category: 'diagnostic' },
  { code: 'D0220', nameAr: 'أشعة ذروية', nameEn: 'Periapical X-ray', fee: 50, category: 'diagnostic' },
  { code: 'D0330', nameAr: 'أشعة بانورامية', nameEn: 'Panoramic X-ray', fee: 200, category: 'diagnostic' },
  { code: 'D1110', nameAr: 'تنظيف الأسنان', nameEn: 'Prophylaxis (cleaning)', fee: 250, category: 'preventive' },
  { code: 'D2140', nameAr: 'حشوة أملغم - سطح واحد', nameEn: 'Amalgam filling - 1 surface', fee: 200, category: 'restorative' },
  { code: 'D2150', nameAr: 'حشوة أملغم - سطحين', nameEn: 'Amalgam filling - 2 surfaces', fee: 300, category: 'restorative' },
  { code: 'D2330', nameAr: 'حشوة تجميلية - سطح واحد', nameEn: 'Composite filling - 1 surface', fee: 350, category: 'restorative' },
  { code: 'D2331', nameAr: 'حشوة تجميلية - سطحين', nameEn: 'Composite filling - 2 surfaces', fee: 450, category: 'restorative' },
  { code: 'D2750', nameAr: 'تاج بورسلين', nameEn: 'Crown - porcelain', fee: 2500, category: 'restorative' },
  { code: 'D3310', nameAr: 'علاج عصب - سن أمامي', nameEn: 'Root canal - anterior', fee: 1500, category: 'endodontics' },
  { code: 'D3320', nameAr: 'علاج عصب - سن ضاحك', nameEn: 'Root canal - premolar', fee: 2000, category: 'endodontics' },
  { code: 'D3330', nameAr: 'علاج عصب - سن طاحن', nameEn: 'Root canal - molar', fee: 2500, category: 'endodontics' },
  { code: 'D7140', nameAr: 'خلع - سن بازغ', nameEn: 'Extraction - erupted tooth', fee: 300, category: 'surgical' },
  { code: 'D7210', nameAr: 'خلع جراحي', nameEn: 'Surgical extraction', fee: 600, category: 'surgical' },
  { code: 'D6010', nameAr: 'زرعة سنية داخل العظم', nameEn: 'Implant - endosteal', fee: 5000, category: 'implants' },
];

const CATEGORIES: Record<string, { ar: string; en: string; color: string }> = {
  diagnostic:   { ar: 'تشخيصية',  en: 'Diagnostic',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  preventive:   { ar: 'وقائية',   en: 'Preventive',   color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  restorative:  { ar: 'ترميمية',  en: 'Restorative',  color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  endodontics:  { ar: 'لبية',     en: 'Endodontics',  color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
  surgical:     { ar: 'جراحية',   en: 'Surgical',     color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  implants:     { ar: 'زراعة',    en: 'Implants',     color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
};

export default function DentalProcedures() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const totalFees = DENTAL_PROCEDURES.reduce((sum, p) => sum + p.fee, 0);

  return (
    <div className="min-h-screen bg-background p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            {tr('كتالوج إجراءات الأسنان', 'Dental Procedures Catalog')}
          </h1>
          <p className="text-muted-foreground">
            {tr('قائمة الإجراءات والرسوم المعتمدة', 'Approved procedures and fees list')}
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="text-2xl font-bold text-foreground">{DENTAL_PROCEDURES.length}</div>
            <div className="text-sm text-muted-foreground">{tr('إجمالي الإجراءات', 'Total Procedures')}</div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="text-2xl font-bold text-foreground">{Object.keys(CATEGORIES).length}</div>
            <div className="text-sm text-muted-foreground">{tr('التصنيفات', 'Categories')}</div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="text-2xl font-bold text-foreground">
              {totalFees.toLocaleString()} <span className="text-base">{tr('ر.س', 'SAR')}</span>
            </div>
            <div className="text-sm text-muted-foreground">{tr('مجموع الرسوم', 'Total Fees')}</div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr className="text-sm text-muted-foreground">
                <th className="px-4 py-3 font-medium text-start">{tr('الكود', 'Code')}</th>
                <th className="px-4 py-3 font-medium text-start">{tr('الإجراء', 'Procedure')}</th>
                <th className="px-4 py-3 font-medium text-start">{tr('التصنيف', 'Category')}</th>
                <th className="px-4 py-3 font-medium text-start">{tr('الرسوم', 'Fee')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {DENTAL_PROCEDURES.map((proc) => {
                const cat = CATEGORIES[proc.category];
                return (
                  <tr key={proc.code} className="thea-hover-lift">
                    <td className="px-4 py-3 font-mono text-muted-foreground text-sm">{proc.code}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {language === 'ar' ? proc.nameAr : proc.nameEn}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {language === 'ar' ? proc.nameEn : proc.nameAr}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${cat.color}`}>
                        {tr(cat.ar, cat.en)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {proc.fee.toLocaleString()} {tr('ر.س', 'SAR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
