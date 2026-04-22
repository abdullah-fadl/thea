'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMe } from '@/lib/hooks/useMe';

/**
 * Tracks user navigation and saves session state
 * Runs on client-side to save lastRoute and lastPlatformKey
 */
export function SessionStateTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { me } = useMe();

  useEffect(() => {
    // Only save if user is authenticated
    if (!me?.user?.id) {
      return;
    }

    // Don't save login/logout routes
    if (pathname === '/login' || pathname === '/logout') {
      return;
    }

    // Extract platform key from pathname
    let platformKey: string | undefined = undefined;
    if (pathname.startsWith('/platforms/sam')) {
      platformKey = 'sam';
    } else if (pathname.startsWith('/platforms/thea-health')) {
      platformKey = 'thea-health';
    } else if (pathname.startsWith('/platforms/cvision')) {
      platformKey = 'cvision';
    } else if (pathname.startsWith('/platforms/edrac')) {
      platformKey = 'edrac';
    }

    // Build full route with query params
    const fullRoute = searchParams.toString() 
      ? `${pathname}?${searchParams.toString()}`
      : pathname;

    // Save session state via API
    fetch('/api/auth/save-session-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lastRoute: fullRoute,
        lastPlatformKey: platformKey,
      }),
      credentials: 'include',
    }).catch(error => {
      // Silently fail - session state saving is not critical
      console.debug('[SessionStateTracker] Failed to save session state:', error);
    });
  }, [pathname, searchParams, me]);

  return null; // This component doesn't render anything
}
