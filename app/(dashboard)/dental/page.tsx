'use client';

import Link from 'next/link';
import { useLang } from '@/hooks/use-lang';

export default function DentalDashboardPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <div className="min-h-screen bg-background p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{tr('وحدة طب الأسنان', 'Dental Module')}</h1>
          <p className="text-muted-foreground">{tr('إدارة مرضى وإجراءات طب الأسنان', 'Manage dental patients and procedures')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/dental/patients"
            className="bg-card rounded-2xl border border-border p-5 hover:bg-muted transition-colors thea-hover-lift"
          >
            <div className="text-lg font-semibold text-foreground">{tr('المرضى', 'Patients')}</div>
            <div className="text-sm text-muted-foreground">{tr('قائمة مرضى الأسنان والمخططات', 'Dental patients list & charts')}</div>
          </Link>
          <Link
            href="/dental/procedures"
            className="bg-card rounded-2xl border border-border p-5 hover:bg-muted transition-colors thea-hover-lift"
          >
            <div className="text-lg font-semibold text-foreground">{tr('الإجراءات', 'Procedures')}</div>
            <div className="text-sm text-muted-foreground">{tr('كتالوج إجراءات الأسنان', 'Dental procedures catalog')}</div>
          </Link>
          <div className="bg-card rounded-2xl border border-border p-5 opacity-60">
            <div className="text-lg font-semibold text-foreground">{tr('التقارير', 'Reports')}</div>
            <div className="text-sm text-muted-foreground">{tr('قيد الإعداد', 'Coming soon')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
