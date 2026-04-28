'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useLang } from '@/hooks/use-lang';

type NavItem = {
  labelAr: string;
  labelEn: string;
  href: string;
};

const NAV_ITEMS: NavItem[] = [
  { labelAr: 'الرئيسية', labelEn: 'Home', href: '/sam/home' },
  { labelAr: 'المكتبة', labelEn: 'Library', href: '/sam/library' },
  { labelAr: 'الامتثال', labelEn: 'Compliance', href: '/sam/compliance' },
  { labelAr: 'المخاطر', labelEn: 'Risks', href: '/sam/risks' },
  { labelAr: 'المعايير', labelEn: 'Standards', href: '/sam/standards' },
  { labelAr: 'الثغرات', labelEn: 'Gaps', href: '/sam/gaps' },
  { labelAr: 'التعارضات', labelEn: 'Conflicts', href: '/sam/conflicts' },
  { labelAr: 'المشكلات', labelEn: 'Issues', href: '/sam/issues' },
  { labelAr: 'المساعد', labelEn: 'Assistant', href: '/sam/assistant' },
  { labelAr: 'المسودات', labelEn: 'Drafts', href: '/sam/drafts' },
];

export function SamTopNav() {
  const pathname = usePathname();
  const { language } = useLang();

  return (
    <nav className="mb-4 border-b">
      <div className="flex flex-wrap gap-2 py-2">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/sam/home' && pathname?.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-md px-3 py-1 text-sm transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {language === 'ar' ? item.labelAr : item.labelEn}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

