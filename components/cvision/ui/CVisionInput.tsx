'use client';

import { InputHTMLAttributes, TextareaHTMLAttributes, useState, CSSProperties, forwardRef } from 'react';
import { type CVisionPalette } from '@/lib/cvision/theme';

/* ─── Input ──────────────────────────────────────────────────────────── */

interface CVisionInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'style'> {
  C: CVisionPalette;
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  containerStyle?: CSSProperties;
  style?: CSSProperties;
}

export const CVisionInput = forwardRef<HTMLInputElement, CVisionInputProps>(
  ({ C, label, error, icon, containerStyle, style, ...rest }, ref) => {
    const [focused, setFocused] = useState(false);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...containerStyle }}>
        {label && (
          <label style={{ fontSize: 11, fontWeight: 500, color: C.textSecondary, letterSpacing: 0.3 }}>
            {label}
          </label>
        )}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {icon && (
            <span style={{ position: 'absolute', left: 12, color: C.textMuted, pointerEvents: 'none', display: 'flex' }}>
              {icon}
            </span>
          )}
          <input
            ref={ref}
            onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
            style={{
              width: '100%',
              height: 38,
              padding: icon ? '0 12px 0 36px' : '0 12px',
              borderRadius: 10,
              border: `1px solid ${error ? C.red + '60' : focused ? C.gold + '50' : C.border}`,
              background: C.bgCard,
              color: C.text,
              fontSize: 13,
              outline: 'none',
              transition: 'border-color 0.2s',
              fontFamily: 'inherit',
              ...style,
            }}
            {...rest}
          />
        </div>
        {error && <span style={{ fontSize: 10, color: C.red }}>{error}</span>}
      </div>
    );
  }
);
CVisionInput.displayName = 'CVisionInput';

/* ─── Textarea ───────────────────────────────────────────────────────── */

interface CVisionTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'style'> {
  C: CVisionPalette;
  label?: string;
  error?: string;
  containerStyle?: CSSProperties;
  style?: CSSProperties;
}

export const CVisionTextarea = forwardRef<HTMLTextAreaElement, CVisionTextareaProps>(
  ({ C, label, error, containerStyle, style, ...rest }, ref) => {
    const [focused, setFocused] = useState(false);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...containerStyle }}>
        {label && (
          <label style={{ fontSize: 11, fontWeight: 500, color: C.textSecondary, letterSpacing: 0.3 }}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          style={{
            width: '100%',
            minHeight: 80,
            padding: 12,
            borderRadius: 10,
            border: `1px solid ${error ? C.red + '60' : focused ? C.gold + '50' : C.border}`,
            background: C.bgCard,
            color: C.text,
            fontSize: 13,
            outline: 'none',
            transition: 'border-color 0.2s',
            fontFamily: 'inherit',
            resize: 'vertical',
            ...style,
          }}
          {...rest}
        />
        {error && <span style={{ fontSize: 10, color: C.red }}>{error}</span>}
      </div>
    );
  }
);
CVisionTextarea.displayName = 'CVisionTextarea';

/* ─── Label ──────────────────────────────────────────────────────────── */

interface CVisionLabelProps {
  C: CVisionPalette;
  children: React.ReactNode;
  required?: boolean;
  style?: CSSProperties;
  htmlFor?: string;
  className?: string;
}

export function CVisionLabel({ C, children, required, style, htmlFor, className }: CVisionLabelProps) {
  return (
    <label htmlFor={htmlFor} className={className} style={{ fontSize: 11, fontWeight: 500, color: C.textSecondary, letterSpacing: 0.3, ...style }}>
      {children}
      {required && <span style={{ color: C.red, marginLeft: 2 }}>*</span>}
    </label>
  );
}
