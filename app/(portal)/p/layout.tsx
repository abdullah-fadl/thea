'use client';

import { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import useSWR from 'swr';
import { Sparkles } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

export default function PortalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const showNav = !pathname.startsWith('/p/login');
  const { data } = useSWR(showNav ? '/api/portal/profile' : null, (url: string) =>
    fetch(url, { credentials: 'include' }).then((r) => r.json())
  );
  const profile = data?.profile || null;

  const logout = async () => {
    await fetch('/api/portal/auth/logout', { credentials: 'include', method: 'POST' }).catch(() => null);
    router.replace('/p/login');
  };

  return (
    <div className="min-h-screen bg-background text-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
      {showNav && (
        <div className="border-b">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">{tr('بوابة ثيا للمرضى', 'Thea Patient Portal')}</div>
              {profile ? (
                <div className="text-xs text-muted-foreground">
                  {profile.fullName} {tr('•', '•')} {tr('رقم الملف', 'MRN')} {profile.mrn || '—'}
                </div>
              ) : null}
            </div>
            <div className="flex gap-2">
              {[
                { href: '/p/book', label: tr('حجز موعد', 'Book') },
                { href: '/p/appointments', label: tr('مواعيدي', 'Appointments') },
                { href: '/p/results', label: tr('نتائجي', 'Results') },
                { href: '/p/medications', label: tr('أدويتي', 'Meds') },
                { href: '/p/care-path', label: tr('جدول رعايتي', 'My Care') },
                { href: '/p/messages', label: tr('الرسائل', 'Messages') },
                { href: '/p/reports', label: tr('تقاريري', 'Reports') },
                { href: '/p/explain', label: tr('ثيا', 'Thea'), hasIcon: true },
                { href: '/p/family-access', label: tr('وصول العائلة', 'Family') },
                { href: '/p/profile', label: tr('الملف الشخصي', 'Profile') },
              ].map((nav) => {
                const isActive = pathname === nav.href || pathname.startsWith(nav.href + '/');
                return (
                  <Button
                    key={nav.href}
                    variant="ghost"
                    className={isActive ? 'font-bold text-primary border-b-2 border-primary rounded-b-none' : ''}
                    onClick={() => router.push(nav.href)}
                  >
                    {'hasIcon' in nav && nav.hasIcon ? <><Sparkles className="h-3.5 w-3.5 mr-1 inline" />{nav.label}</> : nav.label}
                  </Button>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              >
                {language === 'ar' ? 'EN' : 'عر'}
              </Button>
              <Button variant="outline" onClick={logout}>
                {tr('تسجيل الخروج', 'Logout')}
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-5xl mx-auto px-6 py-6">{children}</div>
    </div>
  );
}
