'use client';

import { usePathname } from 'next/navigation';
import { useLang } from '@/hooks/use-lang';
import { useApiError } from '@/lib/hooks/useApiError';
import { TheaSidebar } from '@/components/thea-ui/sidebar';
import { TheaHeader } from './TheaHeader';
import { THEA_UI } from '@/lib/thea-ui/tokens';
import { SkipToContent } from '@/components/a11y/SkipToContent';

interface TheaDesktopShellProps {
  children: React.ReactNode;
}

export function TheaDesktopShell({ children }: TheaDesktopShellProps) {
  const { isRTL, language } = useLang();
  const pathname = usePathname();
  const isAppointmentsPage = pathname?.includes('/opd/appointments') ?? false;

  // Handle API errors globally (including session expiration)
  useApiError();

  return (
    <div
      className="flex w-full"
      style={{
        height: '100vh',
        background: THEA_UI.sidebar.bg,
        position: 'relative',
      }}
    >
      <SkipToContent />
      {/* Thea UI Sidebar — fixed */}
      <nav
        aria-label={language === 'ar' ? 'القائمة الرئيسية' : 'Main navigation'}
        className="fixed top-0 h-screen z-50 hidden md:block"
        style={isRTL ? { right: 0 } : { left: 0 }}
      >
        <TheaSidebar onLinkClick={() => {}} />
      </nav>

      {/* Main area — rounded corners, light background */}
      <div
        className="flex-1 flex flex-col min-w-0 thea-main-area thea-animate-ws-in"
        style={
          isRTL
            ? { marginRight: THEA_UI.sidebar.width.collapsed }
            : { marginLeft: THEA_UI.sidebar.width.collapsed }
        }
      >
        {/* Header */}
        <TheaHeader />

        {/* Content — no top padding on appointments page so page header sits close to TheaHeader */}
        <main
          id="main-content"
          role="main"
          tabIndex={-1}
          className={`flex-1 overflow-auto px-4 md:px-6 pb-4 md:pb-6 bg-background ${isAppointmentsPage ? 'pt-0' : 'pt-4 md:pt-6'}`}
        >
          {children}
        </main>
      </div>

    </div>
  );
}
