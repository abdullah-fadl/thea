'use client';

import Link from 'next/link';
import { useLang } from '@/hooks/use-lang';
import { Users, ClipboardList, Calendar, Clock, ListChecks } from 'lucide-react';

const LINKS = [
  { href: '/scheduling/scheduling', label: 'Appointment Board', labelAr: 'لوحة المواعيد', icon: ListChecks },
  { href: '/scheduling/calendar', label: 'Calendar', labelAr: 'التقويم', icon: Calendar },
  { href: '/scheduling/availability', label: 'Availability', labelAr: 'إدارة التوفر', icon: Clock },
  { href: '/scheduling/resources', label: 'Resources', labelAr: 'الموارد', icon: Users },
  { href: '/scheduling/templates', label: 'Templates', labelAr: 'القوالب', icon: ClipboardList },
];

export default function SchedulingPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-extrabold text-base">
            {tr('الجدولة', 'Scheduling')}
          </h2>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {LINKS.map((l) => {
            const Icon = l.icon;
            const label = tr(l.labelAr, l.label);
            return (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-xl border border-border px-4 py-3 thea-hover-lift flex items-center gap-3"
              >
                <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
