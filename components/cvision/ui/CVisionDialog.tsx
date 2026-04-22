'use client';

import { ReactNode, CSSProperties, useEffect } from 'react';
import { X } from 'lucide-react';
import { type CVisionPalette } from '@/lib/cvision/theme';

/* ─── Dialog ─────────────────────────────────────────────────────────── */

interface CVisionDialogProps {
  C: CVisionPalette;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number | string;
  maxWidth?: number | string;
  title?: string;
  titleEn?: string;
  titleAr?: string;
  isRTL?: boolean;
  isDark?: boolean;
  className?: string;
}

export function CVisionDialog({ C, open, onClose, children, width = 520, maxWidth: customMaxWidth, title, titleEn, titleAr, isRTL, isDark, className }: CVisionDialogProps) {
  const displayTitle = titleEn || title;
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Content */}
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{
          position: 'relative',
          width: typeof width === 'number' ? width : width,
          maxWidth: customMaxWidth || '95vw',
          maxHeight: '90vh',
          borderRadius: 16,
          background: C.bgSidebar,
          border: `1px solid ${C.border}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        {(displayTitle || titleAr) && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
                {isRTL ? (titleAr || displayTitle) : displayTitle}
              </div>
              {displayTitle && titleAr && (
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                  {isRTL ? displayTitle : titleAr}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: C.bgSubtle,
                border: `1px solid ${C.border}`,
                cursor: 'pointer',
                color: C.textMuted,
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Dialog Footer ──────────────────────────────────────────────────── */

interface CVisionDialogFooterProps {
  C?: CVisionPalette;
  children: ReactNode;
  style?: CSSProperties;
}

export function CVisionDialogFooter({ C, children, style }: CVisionDialogFooterProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 8,
        padding: '14px 20px',
        borderTop: C ? `1px solid ${C.border}` : '1px solid rgba(255,255,255,0.08)',
        background: C?.headerBg || 'transparent',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
