'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

/* ─── CVision Color Palette ──────────────────────────────────────────── */

export interface CVisionPalette {
  bg: string;
  bgSidebar: string;
  bgCard: string;
  bgCardHover: string;
  bgSubtle: string;
  border: string;
  borderHover: string;
  gold: string;
  goldLight: string;
  goldDim: string;
  purple: string;
  purpleDim: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  green: string;
  greenDim: string;
  greenBadge: string;
  red: string;
  redDim: string;
  redBadge: string;
  blue: string;
  blueDim: string;
  blueBadge: string;
  orange: string;
  orangeDim: string;
  orangeBadge: string;
  shadow: string;
  shadowHover: string;
  notifBorder: string;
  headerBg: string;
  barTrack: string;
  barAlpha: string;
  avatarBorder: string;
}

export type CVisionMode = 'dark' | 'light';

export const cvisionThemes: Record<CVisionMode, CVisionPalette> = {
  dark: {
    bg: '#08080F',
    bgSidebar: '#0C0C16',
    bgCard: 'rgba(255,255,255,0.035)',
    bgCardHover: 'rgba(255,255,255,0.06)',
    bgSubtle: 'rgba(255,255,255,0.025)',
    border: 'rgba(255,255,255,0.07)',
    borderHover: 'rgba(255,255,255,0.14)',
    gold: '#C9A962',
    goldLight: '#E2C97E',
    goldDim: 'rgba(201,169,98,0.12)',
    purple: '#7C5CBF',
    purpleDim: 'rgba(124,92,191,0.12)',
    text: '#E8E4DF',
    textSecondary: '#A09BA5',
    textMuted: '#6A6570',
    green: '#4ADE80',
    greenDim: 'rgba(74,222,128,0.10)',
    greenBadge: 'rgba(74,222,128,0.10)',
    red: '#F87171',
    redDim: 'rgba(248,113,113,0.10)',
    redBadge: 'rgba(248,113,113,0.10)',
    blue: '#60A5FA',
    blueDim: 'rgba(96,165,250,0.10)',
    blueBadge: 'rgba(96,165,250,0.10)',
    orange: '#FB923C',
    orangeDim: 'rgba(251,146,60,0.10)',
    orangeBadge: 'rgba(251,146,60,0.10)',
    shadow: 'none',
    shadowHover: 'none',
    notifBorder: '#08080F',
    headerBg: 'transparent',
    barTrack: 'rgba(255,255,255,0.04)',
    barAlpha: '50',
    avatarBorder: '20',
  },
  light: {
    bg: '#F5F4F1',
    bgSidebar: '#FFFFFF',
    bgCard: '#FFFFFF',
    bgCardHover: '#FAF9F7',
    bgSubtle: '#EEECEA',
    border: '#DBD8D1',
    borderHover: '#C5C0B6',
    gold: '#8B6B2F',
    goldLight: '#A88040',
    goldDim: 'rgba(139,107,47,0.10)',
    purple: '#5D4290',
    purpleDim: 'rgba(93,66,144,0.10)',
    text: '#1A1718',
    textSecondary: '#4A4348',
    textMuted: '#7E7884',
    green: '#15803D',
    greenDim: 'rgba(21,128,61,0.09)',
    greenBadge: '#D1FAE5',
    red: '#DC2626',
    redDim: 'rgba(220,38,38,0.09)',
    redBadge: '#FEE2E2',
    blue: '#1D4ED8',
    blueDim: 'rgba(29,78,216,0.09)',
    blueBadge: '#DBEAFE',
    orange: '#C2410C',
    orangeDim: 'rgba(194,65,12,0.09)',
    orangeBadge: '#FFEDD5',
    shadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)',
    shadowHover: '0 6px 24px rgba(0,0,0,0.10)',
    notifBorder: '#FFFFFF',
    headerBg: '#F0EFEB',
    barTrack: '#E8E5E0',
    barAlpha: '90',
    avatarBorder: '',
  },
};

/* ─── Theme Hook ─────────────────────────────────────────────────────── */

const STORAGE_KEY = 'cvision-theme';

export function useCVisionTheme() {
  const [mode, setMode] = useState<CVisionMode>('dark');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        setMode(stored);
      }
    } catch {
      // SSR or localStorage unavailable
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const C = useMemo(() => cvisionThemes[mode], [mode]);
  const isDark = mode === 'dark';

  return { mode, C, isDark, toggleMode };
}
