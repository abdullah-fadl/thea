'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TestModeArea, TestModePosition, TEST_MODE_AREAS, TEST_MODE_POSITIONS } from '@/lib/ui/testMode';

const STORAGE_PREFIX = 'uiTestMode';

export interface UiTestModeState {
  enabled: boolean;
  area: TestModeArea | null;
  position: TestModePosition | null;
}

const defaultState: UiTestModeState = {
  enabled: false,
  area: null,
  position: null,
};

export function useUiTestMode(tenantId?: string | null) {
  const storageKey = useMemo(() => {
    const keySuffix = tenantId ? String(tenantId).trim() : 'unknown';
    return `${STORAGE_PREFIX}:${keySuffix}`;
  }, [tenantId]);

  const hasTenantKey = Boolean(tenantId && String(tenantId).trim());

  const [state, setState] = useState<UiTestModeState>(defaultState);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasTenantKey) {
      const unknownKey = `${STORAGE_PREFIX}:unknown`;
      const tenantKey = storageKey;
      const unknownValue = window.localStorage.getItem(unknownKey);
      const tenantValue = window.localStorage.getItem(tenantKey);
      if (unknownValue && !tenantValue) {
        window.localStorage.setItem(tenantKey, unknownValue);
        window.localStorage.removeItem(unknownKey);
      }
    }
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as UiTestModeState;
      if (
        typeof parsed === 'object' &&
        parsed &&
        (parsed.area === null || TEST_MODE_AREAS.includes(parsed.area)) &&
        (parsed.position === null || Object.values(TEST_MODE_POSITIONS).flat().includes(parsed.position))
      ) {
        setState({
          enabled: Boolean(parsed.enabled),
          area: parsed.area || null,
          position: parsed.position || null,
        });
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [storageKey, hasTenantKey]);

  const persist = useCallback(
    (next: UiTestModeState) => {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      const cookieValue = encodeURIComponent(JSON.stringify(next));
      document.cookie = `ui-test-mode=${cookieValue}; path=/; max-age=31536000`;
      if (!next.enabled) {
        document.cookie = 'ui-test-mode=; path=/; max-age=0';
      }
      setState(next);
    },
    [storageKey]
  );

  const setEnabled = useCallback(
    (enabled: boolean) => {
      persist({ ...state, enabled });
    },
    [persist, state]
  );

  const setSelection = useCallback(
    (area: TestModeArea | null, position: TestModePosition | null) => {
      persist({ ...state, area, position });
    },
    [persist, state]
  );

  const setTestMode = useCallback(
    (next: UiTestModeState) => {
      persist(next);
    },
    [persist]
  );

  const clearStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(storageKey);
    setState(defaultState);
  }, [storageKey]);

  const reset = useCallback(() => {
    clearStorage();
  }, [clearStorage]);

  return { state, setEnabled, setSelection, setTestMode, clearStorage, reset };
}
