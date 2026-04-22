'use client';

import React, { ReactNode, useState, CSSProperties, ButtonHTMLAttributes, createElement } from 'react';
import { Loader2 } from 'lucide-react';
import { type CVisionPalette } from '@/lib/cvision/theme';

type Variant = 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'destructive' | 'link';
type Size = 'sm' | 'md' | 'lg' | 'icon';

export interface CVisionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  C: CVisionPalette;
  isDark?: boolean;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode | React.ComponentType<any>;
  children?: ReactNode;
  style?: CSSProperties;
  asChild?: boolean;
}

const sizeMap: Record<Size, { h: number; px: number; fs: number; gap: number }> = {
  sm: { h: 30, px: 10, fs: 11, gap: 4 },
  md: { h: 36, px: 14, fs: 12, gap: 6 },
  lg: { h: 42, px: 18, fs: 13, gap: 8 },
  icon: { h: 36, px: 0, fs: 12, gap: 0 },
};

export function CVisionButton({
  C,
  isDark = true,
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  children,
  disabled,
  style,
  ...rest
}: CVisionButtonProps) {
  const [hovered, setHovered] = useState(false);
  const s = sizeMap[size];
  const isDisabled = disabled || loading;

  const getStyle = (): CSSProperties => {
    const base: CSSProperties = {
      height: s.h,
      padding: size === 'icon' ? `0 ${s.h / 2 - 2}px` : `0 ${s.px}px`,
      borderRadius: 10,
      fontSize: s.fs,
      fontWeight: 600,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.gap,
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      opacity: isDisabled ? 0.5 : 1,
      transition: 'all 0.2s',
      border: 'none',
      outline: 'none',
      fontFamily: 'inherit',
      whiteSpace: 'nowrap',
    };

    switch (variant) {
      case 'default':
      case 'primary':
        return {
          ...base,
          background: hovered
            ? `linear-gradient(135deg, ${C.goldLight || C.gold}, ${C.purple})`
            : `linear-gradient(135deg, ${isDark ? C.gold : C.goldLight}, ${C.purple})`,
          color: '#fff',
          boxShadow: isDark ? 'none' : `0 2px 10px ${C.gold}30`,
        };
      case 'secondary':
        return {
          ...base,
          background: hovered ? C.goldDim : C.bgCard,
          color: C.gold,
          border: `1px solid ${hovered ? C.gold + '40' : C.border}`,
        };
      case 'outline':
        return {
          ...base,
          background: hovered ? C.bgSubtle : 'transparent',
          color: C.textSecondary,
          border: `1px solid ${hovered ? C.borderHover : C.border}`,
        };
      case 'ghost':
        return {
          ...base,
          background: hovered ? C.bgSubtle : 'transparent',
          color: hovered ? C.text : C.textSecondary,
          border: '1px solid transparent',
        };
      case 'destructive':
      case 'danger':
        return {
          ...base,
          background: hovered ? C.red : C.redDim,
          color: hovered ? '#fff' : C.red,
          border: `1px solid ${hovered ? C.red : C.red + '30'}`,
        };
      case 'link':
        return {
          ...base,
          background: 'transparent',
          color: hovered ? C.gold : C.textSecondary,
          border: 'none',
          textDecoration: hovered ? 'underline' : 'none',
          padding: 0,
          height: 'auto',
        };
      default:
        return base;
    }
  };

  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={isDisabled}
      style={{ ...getStyle(), ...style }}
      {...rest}
    >
      {loading ? <Loader2 size={s.fs} style={{ animation: 'spin 1s linear infinite' }} /> : typeof icon === 'function' ? createElement(icon as React.ComponentType<{ size: number }>, { size: s.fs }) : icon}
      {children}
    </button>
  );
}
