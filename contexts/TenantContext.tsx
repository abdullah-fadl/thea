'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type TenantContextData = {
  tenantId: string;
  org: {
    typeId: string;
    typeName: string;
    sectorId: string;
    countryCode?: string | null;
    accreditationSetIds: string[];
  };
  requiredDocumentTypes: string[];
  glossary: Record<string, string>;
  guidanceDefaults: Record<string, any>;
  overlays: {
    applied: any[];
    ignored: any[];
  };
  contextVersion: string;
};

type TenantContextState = {
  context: TenantContextData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const TenantContext = createContext<TenantContextState | undefined>(undefined);

export function TenantContextProvider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<TenantContextData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContext = useCallback(async () => {
    setIsLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch('/api/tenant/context', {
        credentials: 'include',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 409) {
          setError(payload.error || 'ORG_PROFILE_REQUIRED');
          setContext(null);
          return;
        }
        throw new Error(payload.error || 'Failed to load tenant context');
      }
      const data = await response.json();
      setContext(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load tenant context');
      setContext(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  return (
    <TenantContext.Provider value={{ context, isLoading, error, refresh: loadContext }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantContext() {
  const value = useContext(TenantContext);
  if (!value) {
    throw new Error('useTenantContext must be used within TenantContextProvider');
  }
  return value;
}
