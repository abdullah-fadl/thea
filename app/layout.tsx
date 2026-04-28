import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { cookies } from 'next/headers';
import './globals.css';
import { LanguageProvider } from '@/components/LanguageProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { SessionStateTracker } from '@/components/SessionStateTracker';
import { ACTIVE_PLATFORM_COOKIE, parseActivePlatform } from '@/lib/shell/platform';
import { validateProductionSecurity } from '@/lib/security/productionChecks';
import Providers from './providers';

const inter = Inter({ subsets: ['latin'] });

if (typeof window === 'undefined') {
  validateProductionSecurity();
}

export const metadata: Metadata = {
  title: 'Thea',
  description: 'Advanced Electronic Health Records System',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read platform from cookies on server
  const cookieStore = await cookies();
  const platformCookie = parseActivePlatform(cookieStore.get(ACTIVE_PLATFORM_COOKIE)?.value);
  const initialPlatform = platformCookie || 'sam';

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:bg-card focus:text-foreground focus:px-4 focus:py-2 focus:rounded focus:shadow-lg dark:focus:bg-slate-800 dark:focus:text-white"
        >
          Skip to main content
        </a>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme');
                  const root = document.documentElement;
                  root.classList.toggle('dark', theme === 'dark');
                } catch (e) {}
              })();
            `,
          }}
        />
        <Providers>
          <QueryProvider>
            <LanguageProvider initialPlatform={initialPlatform}>
              <div data-testid="page-ready">
                {children}
              </div>
              <SessionStateTracker />
            </LanguageProvider>
          </QueryProvider>
        </Providers>
      </body>
    </html>
  );
}
