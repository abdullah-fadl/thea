'use client';

import { ReactNode, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useKeyboardShortcuts } from '@/lib/cvision/hooks/useKeyboardShortcuts';
import ShortcutSheet from '@/components/cvision/ShortcutSheet';
import OfflineIndicator from '@/components/cvision/OfflineIndicator';
import { ImpersonationBanner } from '@/components/cvision/ImpersonationBanner';

interface CVisionLayoutProps {
  children: ReactNode;
}

export default function CVisionLayout({ children }: CVisionLayoutProps) {
  const router = useRouter();
  const [shortcutSheetOpen, setShortcutSheetOpen] = useState(false);

  const shortcutHandlers = useMemo(
    () => ({
      navDashboard: () => router.push('/cvision'),
      navEmployees: () => router.push('/cvision/employees'),
      navAttendance: () => router.push('/cvision/attendance'),
      navPayroll: () => router.push('/cvision/payroll'),
      navRecruitment: () => router.push('/cvision/recruitment'),
      showShortcuts: () => setShortcutSheetOpen((o) => !o),
      toggleDarkMode: () => {
        /* handled by CVision shell theme toggle */
      },
      closeModal: () => setShortcutSheetOpen(false),
    }),
    [router]
  );

  useKeyboardShortcuts(shortcutHandlers);

  // Tenant branding CSS variables
  useEffect(() => {
    const ac = new AbortController();
    fetch('/api/cvision/saas?action=tenant', { credentials: 'include', signal: ac.signal })
      .then((r) => (r.ok ? r.json() : { data: null }))
      .then((r) => {
        if (r.data?.branding?.primaryColor) {
          document.documentElement.style.setProperty('--cvision-primary', r.data.branding.primaryColor);
        }
        if (r.data?.branding?.secondaryColor) {
          document.documentElement.style.setProperty('--cvision-secondary', r.data.branding.secondaryColor);
        }
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);

  return (
    <>
      <OfflineIndicator />
      <ImpersonationBanner />
      <ShortcutSheet open={shortcutSheetOpen} onOpenChange={setShortcutSheetOpen} />
      {children}
    </>
  );
}
