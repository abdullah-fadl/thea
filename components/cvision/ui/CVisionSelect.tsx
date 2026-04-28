'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, CSSProperties, ReactNode, createElement } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { type CVisionPalette } from '@/lib/cvision/theme';

export interface CVisionSelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface CVisionSelectProps {
  C: CVisionPalette;
  options: CVisionSelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  style?: CSSProperties;
}

export function CVisionSelect({
  C,
  options,
  value,
  onChange,
  placeholder,
  label,
  disabled,
  style,
}: CVisionSelectProps) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setDropdownRect(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownRect({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 160),
    });
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target) && !document.getElementById('cvision-select-dropdown')?.contains(target)) {
        setOpen(false);
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const dropdownContent = open && dropdownRect && typeof document !== 'undefined' && (
    <div
      id="cvision-select-dropdown"
      role="listbox"
      style={{
        position: 'fixed',
        top: dropdownRect.top,
        left: dropdownRect.left,
        width: dropdownRect.width,
        maxHeight: 220,
        overflowY: 'auto',
        background: C.bgSidebar,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
        zIndex: 9999,
        padding: 4,
      }}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => {
              onChange?.(opt.value);
              setOpen(false);
              setFocused(false);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 8,
              border: 'none',
              background: isSelected ? C.goldDim : 'transparent',
              color: isSelected ? C.gold : C.text,
              fontSize: 12,
              fontWeight: isSelected ? 600 : 400,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'inherit',
            }}
          >
            {typeof opt.icon === 'function' ? createElement(opt.icon as React.ComponentType<{ size: number }>, { size: 14 }) : opt.icon}
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {opt.label}
            </span>
            {isSelected && <Check size={14} color={C.gold} />}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative', ...style }} ref={ref}>
        {label && (
          <label style={{ fontSize: 11, fontWeight: 500, color: C.textSecondary, letterSpacing: 0.3 }}>
            {label}
          </label>
        )}
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => { setOpen(!open); setFocused(true); }}
          style={{
            height: 38,
            padding: '0 12px',
            borderRadius: 10,
            border: `1px solid ${focused ? C.gold + '50' : C.border}`,
            background: C.bgCard,
            color: selected ? C.text : C.textMuted,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            fontFamily: 'inherit',
            transition: 'border-color 0.2s',
            outline: 'none',
            textAlign: 'inherit',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
            {selected?.icon && (typeof selected.icon === 'function' ? createElement(selected.icon as React.ComponentType<{ size: number }>, { size: 14 }) : selected.icon)}
            {selected?.label || placeholder || '—'}
          </span>
          <ChevronDown size={14} color={C.textMuted} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
        </button>
      </div>
      {typeof document !== 'undefined' && dropdownContent && createPortal(dropdownContent, document.body)}
    </>
  );
}
