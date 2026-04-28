/**
 * Thea UI Design Migration — Feature Flags
 *
 * Controls which parts of the UI use the new Thea UI design language.
 * Set individual flags to `true` as each phase is completed.
 *
 * Migration phases:
 *   Phase 1: sidebar
 *   Phase 2: login
 *   Phase 3: shell (header + main area)
 *   Phase 4: cards (component kit)
 *   Phase 5: pages (individual page conversions)
 *   Phase 6: mobile
 */
export const THEA_UI_DESIGN = {
  /** Phase 1 — Dark sidebar with hover-expand */
  sidebar: true,
  /** Phase 2 — Redesigned login page */
  login: true,
  /** Phase 3 — Rounded main area + patient context header */
  shell: true,
  /** Phase 3 — Thea UI header with patient context + KPI badges */
  header: true,
  /** Phase 4 — Thea UI card components */
  cards: true,
  /** Phase 5 — Individual page conversions */
  pages: true,
  /** Phase 6 — Mobile-specific Thea UI adaptations */
  mobile: true,
} as const;

export type TheaUiFeatureKey = keyof typeof THEA_UI_DESIGN;

/**
 * Hook to check if a Thea UI design feature is enabled.
 * Use in components to conditionally render Thea vs Thea UI design.
 *
 * @example
 * ```tsx
 * const useTheaSidebar = useTheaUiFlag('sidebar');
 * return useTheaSidebar ? <TheaSidebar /> : <TheaSidebar />;
 * ```
 */
export function useTheaUiFlag(key: TheaUiFeatureKey): boolean {
  return THEA_UI_DESIGN[key];
}

/**
 * Check multiple flags at once.
 * Returns true only if ALL specified flags are enabled.
 */
export function useTheaUiFlags(...keys: TheaUiFeatureKey[]): boolean {
  return keys.every(key => THEA_UI_DESIGN[key]);
}
