'use client';

import { useEffect, useCallback } from 'react';

// ─── Shortcut Definitions ──────────────────────────────────────────────────

export interface ShortcutDef {
  key: string;
  modifiers: ('meta' | 'ctrl' | 'shift' | 'alt')[];
  action: string;
  description: string;
  group: 'Navigation' | 'Actions' | 'UI Toggles';
  /** If true, shortcut is suppressed when focus is in an input/textarea */
  ignoreInInput?: boolean;
}

export const SHORTCUTS: ShortcutDef[] = [
  // Navigation
  { key: '1', modifiers: ['alt'], action: 'navDashboard', description: 'Go to Dashboard', group: 'Navigation', ignoreInInput: true },
  { key: '2', modifiers: ['alt'], action: 'navEmployees', description: 'Go to Employees', group: 'Navigation', ignoreInInput: true },
  { key: '3', modifiers: ['alt'], action: 'navAttendance', description: 'Go to Attendance', group: 'Navigation', ignoreInInput: true },
  { key: '4', modifiers: ['alt'], action: 'navPayroll', description: 'Go to Payroll', group: 'Navigation', ignoreInInput: true },
  { key: '5', modifiers: ['alt'], action: 'navRecruitment', description: 'Go to Recruitment', group: 'Navigation', ignoreInInput: true },

  // Actions
  { key: 'k', modifiers: ['meta'], action: 'openSearch', description: 'Open search', group: 'Actions' },
  { key: '/', modifiers: ['meta'], action: 'showShortcuts', description: 'Show keyboard shortcuts', group: 'Actions' },
  { key: '?', modifiers: [], action: 'showShortcuts', description: 'Show keyboard shortcuts', group: 'Actions', ignoreInInput: true },

  // UI Toggles
  { key: 'd', modifiers: ['meta', 'shift'], action: 'toggleDarkMode', description: 'Toggle dark mode', group: 'UI Toggles' },
  { key: 'Escape', modifiers: [], action: 'closeModal', description: 'Close modal / dialog', group: 'UI Toggles' },
];

// ─── Platform Detection ─────────────────────────────────────────────────────

export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.platform?.toUpperCase().includes('MAC') ||
    navigator.userAgent?.toUpperCase().includes('MAC');
}

export function getModifierSymbol(mod: string): string {
  const mac = isMac();
  switch (mod) {
    case 'meta': return mac ? '\u2318' : 'Ctrl';
    case 'ctrl': return mac ? '\u2303' : 'Ctrl';
    case 'shift': return mac ? '\u21E7' : 'Shift';
    case 'alt': return mac ? '\u2325' : 'Alt';
    default: return mod;
  }
}

export function getKeyLabel(key: string): string {
  if (key === 'Escape') return 'Esc';
  if (key === '/') return '/';
  if (key === '?') return '?';
  return key.toUpperCase();
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export type ShortcutHandlers = Partial<Record<string, () => void>>;

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    for (const shortcut of SHORTCUTS) {
      // Skip input-only shortcuts when in an input
      if (isInput && shortcut.ignoreInInput) continue;

      // Check modifiers
      const needsMeta = shortcut.modifiers.includes('meta');
      const needsShift = shortcut.modifiers.includes('shift');
      const needsAlt = shortcut.modifiers.includes('alt');
      const needsCtrl = shortcut.modifiers.includes('ctrl');

      const metaMatch = needsMeta ? (e.metaKey || e.ctrlKey) : !(e.metaKey || e.ctrlKey);
      const shiftMatch = needsShift ? e.shiftKey : !e.shiftKey;
      const altMatch = needsAlt ? e.altKey : !e.altKey;
      const ctrlMatch = needsCtrl ? e.ctrlKey : true; // ctrl is already covered by meta on non-Mac

      // Special case: '?' requires shift+/ but we don't want to require shift modifier
      if (shortcut.key === '?') {
        if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
          const handler = handlers[shortcut.action];
          if (handler) {
            e.preventDefault();
            handler();
          }
          return;
        }
        continue;
      }

      // For meta shortcuts, accept both metaKey and ctrlKey (cross-platform)
      let modMatch: boolean;
      if (needsMeta) {
        modMatch = (e.metaKey || e.ctrlKey) && shiftMatch && !e.altKey;
      } else if (needsAlt) {
        modMatch = e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey;
      } else {
        modMatch = metaMatch && shiftMatch && altMatch;
      }

      if (!modMatch) continue;

      // Check key
      if (e.key.toLowerCase() !== shortcut.key.toLowerCase() && e.key !== shortcut.key) continue;

      // Match found
      const handler = handlers[shortcut.action];
      if (handler) {
        // Don't prevent default for Cmd+K — GlobalSearch handles it
        if (shortcut.action !== 'openSearch') {
          e.preventDefault();
        }
        handler();
      }
      return;
    }
  }, [handlers]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
