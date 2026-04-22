'use client';

import { createContext, useCallback, useContext, useMemo, useRef } from 'react';

type VisitPricingCache = Map<string, any>;

interface VisitPricingContextValue {
  getPricing: (key: string) => any | undefined;
  setPricing: (key: string, value: any) => void;
}

const VisitPricingContext = createContext<VisitPricingContextValue | null>(null);

const globalCache: VisitPricingCache = new Map();

export function buildVisitPricingKey(args: {
  patientId: string;
  doctorId: string;
  specialtyCode?: string | null;
}) {
  const specialty = String(args.specialtyCode || '').trim();
  return `${args.patientId}::${args.doctorId}::${specialty}`;
}

export function VisitPricingProvider({ children }: { children: React.ReactNode }) {
  const cacheRef = useRef<VisitPricingCache>(new Map());

  const getPricing = useCallback((key: string) => cacheRef.current.get(key), []);
  const setPricing = useCallback((key: string, value: any) => {
    cacheRef.current.set(key, value);
    globalCache.set(key, value);
  }, []);

  const value = useMemo(() => ({ getPricing, setPricing }), [getPricing, setPricing]);

  return <VisitPricingContext.Provider value={value}>{children}</VisitPricingContext.Provider>;
}

export function useVisitPricingCache() {
  const ctx = useContext(VisitPricingContext);
  const getPricing = useCallback((key: string) => ctx?.getPricing(key) ?? globalCache.get(key), [ctx]);
  const setPricing = useCallback(
    (key: string, value: any) => {
      if (ctx) ctx.setPricing(key, value);
      else globalCache.set(key, value);
    },
    [ctx]
  );
  return { getPricing, setPricing };
}
