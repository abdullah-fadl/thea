'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface CVisionAuthzState {
  roles: string[];
  isOwner: boolean;
}

const CVisionAuthzContext = createContext<CVisionAuthzState | null>(null);

const OWNER_ROLES = new Set(['owner', 'thea-owner']);

const PLATFORM_TO_CVISION: Record<string, string> = {
  'thea-owner': 'cvision_admin',
  admin: 'cvision_admin',
  'group-admin': 'hr_admin',
  'hospital-admin': 'hr_admin',
  'hr-manager': 'hr_manager',
  'hr-admin': 'hr_admin',
  supervisor: 'hr_manager',
  manager: 'manager',
  staff: 'employee',
  viewer: 'auditor',
  candidate: 'candidate',
};

let _cache: { data: CVisionAuthzState | null; ts: number } | null = null;
const CACHE_TTL = 60_000;

async function fetchAuthz(signal?: AbortSignal): Promise<CVisionAuthzState | null> {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL) return _cache.data;

  try {
    const res = await fetch('/api/auth/me', { credentials: 'include', signal });
    if (!res.ok) return null;
    const json = await res.json();
    const user = json?.user;
    if (!user) return null;

    const platformRole = String(user.role || '').trim().toLowerCase();
    const cvisionRole = PLATFORM_TO_CVISION[platformRole] || 'employee';
    const roles = [platformRole, cvisionRole].filter(Boolean);
    if (OWNER_ROLES.has(platformRole) && !roles.includes('owner')) {
      roles.push('owner');
    }

    const state: CVisionAuthzState = {
      roles,
      isOwner: OWNER_ROLES.has(platformRole),
    };

    _cache = { data: state, ts: Date.now() };
    return state;
  } catch (err) {
    // AbortError is expected on cleanup — don't treat it as a real failure
    if (err instanceof Error && err.name === 'AbortError') return null;
    return null;
  }
}

export function CVisionAuthzProvider({ children }: { children: ReactNode }) {
  const [authz, setAuthz] = useState<CVisionAuthzState | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    fetchAuthz(controller.signal).then((state) => {
      if (mounted) setAuthz(state);
    });
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  return (
    <CVisionAuthzContext.Provider value={authz}>
      {children}
    </CVisionAuthzContext.Provider>
  );
}

export function useCVisionAuthz(): CVisionAuthzState | null {
  const ctx = useContext(CVisionAuthzContext);

  const [standalone, setStandalone] = useState<CVisionAuthzState | null>(null);
  const isProvided = ctx !== null;
  // Stable ref so the cleanup closure always sees the latest value
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!isProvided) {
      mountedRef.current = true;
      const controller = new AbortController();
      fetchAuthz(controller.signal).then((state) => {
        if (mountedRef.current) setStandalone(state);
      });
      return () => {
        mountedRef.current = false;
        controller.abort();
      };
    }
  }, [isProvided]);

  return ctx ?? standalone;
}
