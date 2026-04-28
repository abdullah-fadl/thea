/**
 * Thea UI Design Language — Main Entry Point
 *
 * Import everything from here:
 * ```
 * import { THEA_UI, useTheaUiFlag, THEA_UI_DESIGN } from '@/lib/thea-ui';
 * ```
 */

export { THEA_UI, getTheaUiStatus, getTheaUiVisitType } from './tokens';
export { THEA_UI_DESIGN, useTheaUiFlag, useTheaUiFlags } from './feature-flags';
export type { TheaUiFeatureKey } from './feature-flags';
