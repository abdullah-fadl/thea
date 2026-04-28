import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Lifecycle Initialization
 * Ensures event handlers are registered exactly once (idempotent).
 */

import { initializeEventHandlers } from '@/lib/cvision/events';

let initialized = false;

export function initializeLifecycle(): void {
  if (initialized) return;
  initialized = true;
  initializeEventHandlers();
  logger.info('[CVision Lifecycle] Event handlers initialized');
}
