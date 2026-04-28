'use client';

import Link from 'next/link';
import { useLang } from '@/hooks/use-lang';

export default function ClinicalInfra() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const LINKS = [
    { href: '/admin/clinical-infra/facilities', label: tr('المنشآت', 'Facilities') },
    { href: '/admin/clinical-infra/units', label: tr('الوحدات السريرية', 'Clinical Units') },
    { href: '/admin/clinical-infra/floors', label: tr('الطوابق', 'Floors') },
    { href: '/admin/clinical-infra/rooms', label: tr('الغرف', 'Rooms') },
    { href: '/admin/clinical-infra/beds', label: tr('الأسرّة', 'Beds') },
    { href: '/admin/clinical-infra/specialties', label: tr('التخصصات', 'Specialties') },
    { href: '/admin/clinical-infra/clinics', label: tr('العيادات', 'Clinics') },
    { href: '/admin/clinical-infra/providers', label: tr('مقدمو الخدمة', 'Providers') },
  ];

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-extrabold text-base">{tr('البنية التحتية السريرية', 'Clinical Infrastructure')}</h2>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-xl border border-border px-3 py-2 thea-hover-lift">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
