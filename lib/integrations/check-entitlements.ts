/**
 * Check if user has entitlements for auto-trigger
 * Requires BOTH sam=true AND health=true
 */

import { verifyTokenEdge } from '@/lib/auth/edge';
import { logger } from '@/lib/monitoring/logger';

/**
 * Check if user is entitled to auto-trigger policy checks
 * This is a lightweight check that doesn't require DB access
 */
export async function canAutoTrigger(token: string): Promise<boolean> {
  try {
    const payload = await verifyTokenEdge(token);
    
    if (!payload || !payload.entitlements) {
      return false;
    }

    // Requires BOTH sam AND health
    return payload.entitlements.sam === true && payload.entitlements.health === true;
  } catch (error) {
    logger.error('Failed to check entitlements', { category: 'system', error });
    return false;
  }
}

