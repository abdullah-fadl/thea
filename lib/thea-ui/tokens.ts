/**
 * Thea UI Design Language — Design Tokens
 *
 * All visual constants for the Thea UI design system.
 * These are the source of truth — never hardcode hex values in components.
 *
 * Color philosophy:
 *   - Sidebar: Always dark (#0B1220), unaffected by theme toggle
 *   - Workspace: Light (#F5F7FB) in light mode, respects dark mode
 *   - Primary accent: Blue (#1D4ED8 light, #60a5fa dark)
 *   - Status colors: Semantic (green=ready, amber=waiting, blue=active, red=danger)
 *
 * Dark mode:
 *   Most components use CSS variable-based Tailwind classes (bg-card, text-foreground, etc.)
 *   which automatically adapt. The THEA_UI_DARK tokens below are for the rare cases
 *   where inline styles reference THEA_UI constants directly.
 */
export const THEA_UI = {
  // ── Sidebar (always dark, ignores theme) ──
  sidebar: {
    bg: '#0B1220',
    text: '#E2E8F0',
    textMuted: '#94A3B8',
    activeBg: '#111B2E',
    hoverBg: 'rgba(255, 255, 255, 0.04)',
    dot: '#334155',
    dotActive: '#1D4ED8',
    border: 'rgba(148, 163, 184, 0.18)',
    brandLogo: '#1D4ED8',
    userAvatar: '#1F2937',
    width: { collapsed: 60, expanded: 260 },
  },

  // ── Main workspace ──
  workspace: {
    bg: '#F5F7FB',
    borderRadius: '20px 0 0 20px',
    margin: '10px 0 10px 0',
    shadow: '-4px 0 30px rgba(0, 0, 0, 0.12)',
  },

  // ── Cards ──
  card: {
    bg: '#FFFFFF',
    border: '#E5E7EB',
    borderHover: '#CBD5E1',
    radius: 16,
    padding: 14,
  },

  // ── Colors ──
  colors: {
    primary: '#1D4ED8',
    primaryLight: '#EEF2FF',
    primaryBorder: '#C7D2FE',
    cta: '#F97316',
    ctaBorder: '#F97316',
    danger: '#EF4444',
    dangerLight: '#FEF2F2',
    dangerBorder: '#FECACA',
    success: '#059669',
    successLight: '#ECFDF5',
    successBorder: '#A7F3D0',
    warning: '#D97706',
    warningLight: '#FFFBEB',
    warningBorder: '#FDE68A',
    link: '#2563EB',
    info: '#2563EB',
    infoLight: '#EFF6FF',
    infoBorder: '#BFDBFE',
  },

  // ── Text ──
  text: {
    primary: '#0F172A',
    secondary: '#334155',
    tertiary: '#475569',
    muted: '#64748B',
    placeholder: '#94A3B8',
    inverse: '#FFFFFF',
  },

  // ── Backgrounds ──
  bg: {
    page: '#F5F7FB',
    card: '#FFFFFF',
    input: '#F8FAFC',
    muted: '#F1F5F9',
    hover: '#F1F5F9',
    header: '#FFFFFF',
  },

  // ── Borders ──
  border: {
    default: '#E5E7EB',
    hover: '#CBD5E1',
    focus: '#1D4ED8',
    light: '#F1F5F9',
  },

  // ── Status badges ──
  status: {
    WAITING_DOCTOR:    { label: 'Waiting',   color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
    READY_FOR_DOCTOR:  { label: 'Ready',     color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
    IN_DOCTOR:         { label: 'In Exam',   color: '#1D4ED8', bg: '#EEF2FF', border: '#C7D2FE' },
    COMPLETED:         { label: 'Completed', color: '#94A3B8', bg: '#F1F5F9', border: '#E2E8F0' },
    WAITING_NURSE:     { label: 'Waiting',   color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
    IN_NURSING:        { label: 'In Prep',   color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  } as Record<string, { label: string; color: string; bg: string; border: string }>,

  // ── Visit type badges ──
  visitType: {
    fu:  { color: '#2563EB', bg: '#EEF2FF' },
    new: { color: '#059669', bg: '#ECFDF5' },
    urg: { color: '#EF4444', bg: '#FEF2F2' },
  } as Record<string, { color: string; bg: string }>,

  // ── Animation ──
  animation: {
    ease: 'cubic-bezier(0.16, 1, 0.3, 1)',
    duration: {
      fast: '200ms',
      normal: '250ms',
      sidebar: '350ms',
      panel: '400ms',
    },
  },

  // ── Border radius ──
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 14,
    xl: 16,
    pill: 999,
  },

  // ── Shadows ──
  shadow: {
    none: 'none',
    sm: '0 1px 2px rgba(0, 0, 0, 0.04)',
    md: '0 4px 12px rgba(0, 0, 0, 0.06)',
    lg: '0 6px 16px rgba(0, 0, 0, 0.08)',
    xl: '0 24px 48px -8px rgba(0, 0, 0, 0.12)',
    focus: (color: string) => `0 0 0 3px ${color}12`,
    glow: (color: string) => `0 0 12px ${color}26`,
  },

  // ── Typography ──
  font: {
    family: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", sans-serif',
    size: {
      xs: 9.5,
      sm: 11,
      base: 12,
      md: 13,
      lg: 14,
      xl: 16,
      '2xl': 18,
    },
    weight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
      black: 900,
    },
  },

  // ── Layout ──
  layout: {
    headerHeight: 56,
    tabsHeight: 46,
    patientListWidth: { expanded: '100%', collapsed: 280 },
    mainGrid: '3fr 6fr 3fr',
    kpiGrid: 'repeat(4, 1fr)',
    ehrGrid: 'repeat(3, 1fr)',
    maxContentWidth: 1400,
  },

  // ── Spacing (consistent with Tailwind scale) ──
  space: {
    xs: 4,
    sm: 6,
    md: 10,
    lg: 14,
    xl: 18,
    '2xl': 20,
  },
} as const;

/**
 * Helper: Get status config by status key
 */
export function getTheaUiStatus(status: string) {
  return THEA_UI.status[status] || THEA_UI.status.COMPLETED;
}

/**
 * Helper: Get visit type config
 */
export function getTheaUiVisitType(typeKey: string) {
  return THEA_UI.visitType[typeKey] || THEA_UI.visitType.fu;
}

/**
 * Dark mode token overrides.
 * Use `getTheaToken(key, isDark)` helper below for adaptive values.
 */
export const THEA_UI_DARK = {
  workspace: {
    bg: '#0f172a',
  },
  card: {
    bg: '#1e293b',
    border: '#334155',
    borderHover: '#475569',
  },
  colors: {
    primary: '#60a5fa',
    primaryLight: 'rgba(96, 165, 250, 0.12)',
    primaryBorder: '#3b82f6',
    danger: '#f87171',
    dangerLight: 'rgba(248, 113, 113, 0.12)',
    dangerBorder: '#ef4444',
    success: '#34d399',
    successLight: 'rgba(52, 211, 153, 0.12)',
    successBorder: '#10b981',
    warning: '#fbbf24',
    warningLight: 'rgba(251, 191, 36, 0.12)',
    warningBorder: '#f59e0b',
    link: '#60a5fa',
    info: '#60a5fa',
    infoLight: 'rgba(96, 165, 250, 0.12)',
    infoBorder: '#3b82f6',
  },
  text: {
    primary: '#f8fafc',
    secondary: '#cbd5e1',
    tertiary: '#94a3b8',
    muted: '#64748b',
    placeholder: '#475569',
    inverse: '#0f172a',
  },
  bg: {
    page: '#0f172a',
    card: '#1e293b',
    input: '#1e293b',
    muted: '#1e293b',
    hover: '#334155',
    header: '#1e293b',
  },
  border: {
    default: '#334155',
    hover: '#475569',
    focus: '#60a5fa',
    light: '#1e293b',
  },
} as const;
