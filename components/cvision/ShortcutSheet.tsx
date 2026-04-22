'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionDialog } from '@/components/cvision/ui';
import { SHORTCUTS, getModifierSymbol, getKeyLabel, type ShortcutDef } from '@/lib/cvision/hooks/useKeyboardShortcuts';

interface ShortcutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ShortcutKey({ children, C }: { children: string; C: any }) {
  return (
    <kbd
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 24,
        height: 24,
        padding: '0 6px',
        fontSize: 11,
        fontFamily: 'monospace',
        fontWeight: 500,
        background: C.bgSubtle,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        boxShadow: `0 1px 2px ${C.border}`,
        color: C.text,
      }}
    >
      {children}
    </kbd>
  );
}

function ShortcutRow({ shortcut, C }: { shortcut: ShortcutDef; C: any }) {
  const keys = [...shortcut.modifiers.map(getModifierSymbol), getKeyLabel(shortcut.key)];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
      <span style={{ fontSize: 13, color: C.text }}>{shortcut.description}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {keys.map((k, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {i > 0 && <span style={{ color: C.textMuted, fontSize: 11 }}>+</span>}
            <ShortcutKey C={C}>{k}</ShortcutKey>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ShortcutSheet({ open, onOpenChange }: ShortcutSheetProps) {
  const { C } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const groups = new Map<string, ShortcutDef[]>();
  const seen = new Set<string>();
  for (const s of SHORTCUTS) {
    if (seen.has(s.action)) continue;
    seen.add(s.action);
    const list = groups.get(s.group) || [];
    list.push(s);
    groups.set(s.group, list);
  }

  return (
    <CVisionDialog
      C={C}
      open={open}
      onClose={() => onOpenChange(false)}
      title={tr('اختصارات لوحة المفاتيح', 'Keyboard Shortcuts')}
      titleEn="Keyboard Shortcuts"
      isRTL={isRTL}
      maxWidth={420}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
        {['Navigation', 'Actions', 'UI Toggles'].map(groupName => {
          const items = groups.get(groupName);
          if (!items || items.length === 0) return null;
          return (
            <div key={groupName}>
              <h4 style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                {groupName}
              </h4>
              <div>
                {items.map(s => <ShortcutRow key={s.action} shortcut={s} C={C} />)}
              </div>
            </div>
          );
        })}
      </div>
    </CVisionDialog>
  );
}
