'use client';

import { useMemo } from 'react';

export function useDevMode(): boolean {
  return useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (
      process.env.NODE_ENV === 'development' ||
      process.env.NEXT_PUBLIC_DEV_MODE === '1'
    );
  }, []);
}
