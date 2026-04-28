'use client';

import { usePathname } from 'next/navigation';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { TheaDesktopShell, TheaMobileShell } from '@/components/thea-ui/shell';
import CVisionShell from '@/components/cvision/CVisionShell';
import CVisionMobileShell from '@/components/cvision/CVisionMobileShell';

interface ClientLayoutSwitcherProps {
  children: React.ReactNode;
}

/**
 * Client-side layout switcher that chooses between Desktop and Mobile shell
 * based on viewport width (mobile: < 768px).
 * CVision uses its own gold/purple branded shell.
 */
export function ClientLayoutSwitcher({ children }: ClientLayoutSwitcherProps) {
  const pathname = usePathname();
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (pathname.startsWith('/cvision')) {
    return isMobile
      ? <CVisionMobileShell>{children}</CVisionMobileShell>
      : <CVisionShell>{children}</CVisionShell>;
  }

  // Imdad has its own shell (ImdadSidebar + IdentityBar) in its layout.tsx
  if (pathname.startsWith('/imdad')) {
    return <>{children}</>;
  }

  if (isMobile) {
    return <TheaMobileShell>{children}</TheaMobileShell>;
  }

  return <TheaDesktopShell>{children}</TheaDesktopShell>;
}
