'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Clock, Briefcase, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang } from '@/hooks/use-lang';

const items = [
  { href: '/cvision', icon: LayoutDashboard, ar: 'الرئيسية', en: 'Home' },
  { href: '/cvision/employees', icon: Users, ar: 'الموظفين', en: 'Staff' },
  { href: '/cvision/attendance', icon: Clock, ar: 'الحضور', en: 'Attend' },
  { href: '/cvision/recruitment', icon: Briefcase, ar: 'التوظيف', en: 'Recruit' },
  { href: '/cvision/payroll', icon: DollarSign, ar: 'الرواتب', en: 'Payroll' },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  if (!pathname.startsWith('/cvision')) return null;

  return (
    <nav
      className={cn(
        'fixed bottom-0 inset-x-0 z-50 md:hidden',
        'bg-background/95 backdrop-blur border-t'
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-14">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === '/cvision'
              ? pathname === '/cvision'
              : pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-0.5',
                'transition-colors active:scale-95',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] leading-none">{tr(item.ar, item.en)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
