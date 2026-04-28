'use client';

import { useState, useEffect } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Returns `true` when the user has enabled "prefers-reduced-motion: reduce"
 * in their OS / browser settings. Listens for live changes.
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(QUERY);

    const handler = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    mql.addEventListener('change', handler);
    // Sync in case SSR value differs
    setReducedMotion(mql.matches);

    return () => mql.removeEventListener('change', handler);
  }, []);

  return reducedMotion;
}
