'use client';

import Link from 'next/link';
import { useLang } from '@/hooks/use-lang';

export default function ObgynDashboardPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{tr('وحدة النساء والولادة', 'OB/GYN Module')}</h1>
          <p className="text-slate-500">{tr('إدارة حالات النساء والولادة', 'Manage OB/GYN cases')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/obgyn/patients" className="bg-card rounded-xl border border-slate-200 p-4 hover:bg-slate-50">
            <div className="text-lg font-semibold text-slate-900">{tr('المرضى', 'Patients')}</div>
            <div className="text-sm text-slate-500">{tr('اختيار المريضة للنماذج', 'Select patient for forms')}</div>
          </Link>
          <div className="bg-card rounded-xl border border-slate-200 p-4">
            <div className="text-lg font-semibold text-slate-900">{tr('التقارير', 'Reports')}</div>
            <div className="text-sm text-slate-500">{tr('قيد الإعداد', 'Under preparation')}</div>
          </div>
          <div className="bg-card rounded-xl border border-slate-200 p-4">
            <div className="text-lg font-semibold text-slate-900">{tr('الإعدادات', 'Settings')}</div>
            <div className="text-sm text-slate-500">{tr('قيد الإعداد', 'Under preparation')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
