'use client';

import { useCallback, useEffect, useState } from 'react';
import { UI_PREVIEW_ROLES, UiPreviewRole } from '@/lib/ui/preview';

const STORAGE_KEY = 'uiPreviewRole';

export function useUiPreviewRole() {
  const [previewRole, setPreviewRoleState] = useState<UiPreviewRole | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && UI_PREVIEW_ROLES.includes(stored as UiPreviewRole)) {
      setPreviewRoleState(stored as UiPreviewRole);
    }
  }, []);

  const setPreviewRole = useCallback((role: UiPreviewRole | null) => {
    if (typeof window === 'undefined') return;
    if (!role) {
      window.localStorage.removeItem(STORAGE_KEY);
      setPreviewRoleState(null);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, role);
    setPreviewRoleState(role);
  }, []);

  return { previewRole, setPreviewRole };
}
