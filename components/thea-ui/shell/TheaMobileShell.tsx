'use client';

import { useState, useEffect } from 'react';
import { useApiError } from '@/lib/hooks/useApiError';
import { TheaMobileTopBar } from './TheaMobileTopBar';
import { TheaMobileBottomNav } from './TheaMobileBottomNav';
import { TheaMobileSidebar } from './TheaMobileSidebar';
import { SkipToContent } from '@/components/a11y/SkipToContent';

interface TheaMobileShellProps {
  children: React.ReactNode;
}

export function TheaMobileShell({ children }: TheaMobileShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Handle API errors globally (including session expiration)
  useApiError();

  // Scroll restoration
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'auto';
    }
  }, []);

  // Smooth scrolling for anchor links
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]');
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (href && href !== '#') {
          e.preventDefault();
          const id = href.substring(1);
          const element = document.getElementById(id);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <SkipToContent />
      {/* Mobile Sidebar Sheet */}
      <TheaMobileSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

      {/* Top Bar */}
      <TheaMobileTopBar onMenuClick={() => setSidebarOpen(true)} />

      {/* Content Area with safe area padding */}
      <main
        id="main-content"
        role="main"
        tabIndex={-1}
        className="flex-1 overflow-y-auto thea-scroll"
        style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
      >
        <div className="px-4 py-4">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      <TheaMobileBottomNav />

    </div>
  );
}
