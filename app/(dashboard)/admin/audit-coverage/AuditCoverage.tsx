'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/hooks/use-lang';

type CoverageRow = {
  key: string;
  labelEn: string;
  labelAr: string;
};

function isoDaysAgo(days: number) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

export default function AuditCoverage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [status, setStatus] = useState<Record<string, boolean | 'loading' | 'error'>>({});

  const rows: CoverageRow[] = useMemo(
    () => [
      { key: 'patient_master', labelEn: 'Patient Master', labelAr: 'الملف الرئيسي للمريض' },
      { key: 'encounter_core', labelEn: 'Encounter Core', labelAr: 'الزيارة الأساسية' },
      { key: 'department_entry', labelEn: 'Department Entry', labelAr: 'دخول القسم' },
      { key: 'orders_hub', labelEn: 'Orders Hub', labelAr: 'مركز الطلبات' },
      { key: 'charge_events', labelEn: 'Charge Events', labelAr: 'أحداث الرسوم' },
      { key: 'billing_lock', labelEn: 'Billing Lock', labelAr: 'قفل الفوترة' },
      { key: 'billing_posting', labelEn: 'Billing Posting', labelAr: 'ترحيل الفوترة' },
      { key: 'payments', labelEn: 'Payments', labelAr: 'المدفوعات' },
      { key: 'clinical_notes', labelEn: 'Clinical Notes', labelAr: 'الملاحظات السريرية' },
      { key: 'tasks', labelEn: 'Tasks', labelAr: 'المهام' },
      { key: 'results', labelEn: 'Results', labelAr: 'النتائج' },
      { key: 'handover', labelEn: 'Handover', labelAr: 'تسليم المناوبة' },
      { key: 'discharge', labelEn: 'Discharge', labelAr: 'الخروج' },
      { key: 'death_mortuary', labelEn: 'Death / Mortuary', labelAr: 'الوفاة / المشرحة' },
    ],
    []
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const next: Record<string, boolean | 'loading' | 'error'> = {};
      for (const r of rows) next[r.key] = 'loading';
      setStatus(next);

      const from = encodeURIComponent(isoDaysAgo(30));
      const to = encodeURIComponent(new Date().toISOString());

      const results = await Promise.all(
        rows.map(async (r) => {
          try {
            const res = await fetch(
              `/api/admin/audit/export?from=${from}&to=${to}&entityType=${encodeURIComponent(r.key)}&limit=1`,
              { credentials: 'include' }
            );
            if (!res.ok) return { key: r.key, value: 'error' as const };
            const data = await res.json().catch(() => null);
            const count = Number(data?.count ?? 0);
            return { key: r.key, value: count > 0 };
          } catch {
            return { key: r.key, value: 'error' as const };
          }
        })
      );

      if (cancelled) return;
      const merged: Record<string, boolean | 'loading' | 'error'> = {};
      for (const r of results) merged[r.key] = r.value;
      setStatus(merged);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [rows]);

  const title = tr('تغطية التدقيق', 'Audit Coverage');
  const desc = tr(
    'عرض سريع لأنواع الكيانات الرئيسية وروابط تصدير سجلات التدقيق.',
    'Quick matrix of major entity types with audit export links.'
  );

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl">
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </div>
        <div>
          {/* Header */}
          <div className="grid grid-cols-3 gap-4 px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {language === 'ar' ? 'الكيان' : 'Entity'}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {language === 'ar' ? 'يوجد تدقيق؟' : 'Has audit writes?'}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {language === 'ar' ? 'تصدير' : 'Export'}
            </span>
          </div>
          {/* Body */}
          {rows.map((r) => {
            const s = status[r.key] ?? 'loading';
            const has = s === true;
            const badge =
              s === 'loading' ? (
                <span className="inline-flex items-center rounded-full text-[11px] font-bold px-2.5 py-0.5 bg-muted text-muted-foreground">{language === 'ar' ? 'جاري الفحص' : 'Checking'}</span>
              ) : s === 'error' ? (
                <span className="inline-flex items-center rounded-full text-[11px] font-bold px-2.5 py-0.5 bg-destructive text-destructive-foreground">{language === 'ar' ? 'خطأ' : 'Error'}</span>
              ) : has ? (
                <span className="inline-flex items-center rounded-full text-[11px] font-bold px-2.5 py-0.5 bg-primary text-primary-foreground">{language === 'ar' ? 'نعم' : 'Yes'}</span>
              ) : (
                <span className="inline-flex items-center rounded-full text-[11px] font-bold px-2.5 py-0.5 border border-border text-muted-foreground">{language === 'ar' ? 'لا' : 'No'}</span>
              );

            const from = encodeURIComponent(isoDaysAgo(30));
            const to = encodeURIComponent(new Date().toISOString());
            const href = `/api/admin/audit/export?from=${from}&to=${to}&entityType=${encodeURIComponent(r.key)}`;

            return (
              <div
                key={r.key}
                className="grid grid-cols-3 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast"
              >
                <span className="text-sm text-foreground font-medium">
                  {language === 'ar' ? r.labelAr : r.labelEn}
                </span>
                <span className="text-sm text-foreground">{badge}</span>
                <span className="text-sm text-foreground">
                  <Link className="underline text-sm" href={href} target="_blank">
                    {language === 'ar' ? 'فتح JSON' : 'Open JSON'}
                  </Link>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
