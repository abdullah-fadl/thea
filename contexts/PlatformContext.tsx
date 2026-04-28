/**
 * Platform Context Provider
 * 
 * Provides platform context throughout the application:
 * - Current platform key
 * - Platform name
 * - Breadcrumbs
 * - Consistent navigation
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export type PlatformKey = 'sam' | 'thea-health' | 'cvision' | 'edrac';

export interface PlatformInfo {
  key: PlatformKey;
  name: string;
  displayName: string;
  route: string;
}

export const PLATFORMS: Record<PlatformKey, PlatformInfo> = {
  'sam': {
    key: 'sam',
    name: 'SAM',
    displayName: 'SAM - Policy System',
    route: '/platforms/sam',
  },
  'thea-health': {
    key: 'thea-health',
    name: 'Thea Health',
    displayName: 'Thea Health',
    route: '/platforms/thea-health',
  },
  'cvision': {
    key: 'cvision',
    name: 'CVision',
    displayName: 'CVision',
    route: '/platforms/cvision',
  },
  'edrac': {
    key: 'edrac',
    name: 'EDRAC',
    displayName: 'EDRAC',
    route: '/platforms/edrac',
  },
};

interface PlatformContextType {
  platform: PlatformInfo | null;
  setPlatform: (platform: PlatformKey | null) => void;
  breadcrumbs: Breadcrumb[];
  addBreadcrumb: (breadcrumb: Breadcrumb) => void;
  clearBreadcrumbs: () => void;
}

export interface Breadcrumb {
  label: string;
  href?: string;
}

const PlatformContext = createContext<PlatformContextType | undefined>(undefined);

export function PlatformProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [platform, setPlatformState] = useState<PlatformInfo | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);

  // Detect platform from pathname
  useEffect(() => {
    if (pathname.startsWith('/platforms/sam')) {
      setPlatformState(PLATFORMS['sam']);
    } else if (pathname.startsWith('/platforms/thea-health')) {
      setPlatformState(PLATFORMS['thea-health']);
    } else if (pathname.startsWith('/platforms/cvision')) {
      setPlatformState(PLATFORMS['cvision']);
    } else if (pathname.startsWith('/platforms/edrac')) {
      setPlatformState(PLATFORMS['edrac']);
    } else {
      setPlatformState(null);
    }
  }, [pathname]);

  const setPlatform = (platformKey: PlatformKey | null) => {
    if (platformKey) {
      setPlatformState(PLATFORMS[platformKey]);
    } else {
      setPlatformState(null);
    }
  };

  const addBreadcrumb = (breadcrumb: Breadcrumb) => {
    setBreadcrumbs(prev => [...prev, breadcrumb]);
  };

  const clearBreadcrumbs = () => {
    setBreadcrumbs([]);
  };

  return (
    <PlatformContext.Provider
      value={{
        platform,
        setPlatform,
        breadcrumbs,
        addBreadcrumb,
        clearBreadcrumbs,
      }}
    >
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatformContext() {
  const context = useContext(PlatformContext);
  if (context === undefined) {
    throw new Error('usePlatformContext must be used within a PlatformProvider');
  }
  return context;
}
