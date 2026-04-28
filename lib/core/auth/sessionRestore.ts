/**
 * Session Restore Management
 *
 * Persists and restores last session state:
 * - lastPlatformKey
 * - lastRoute
 * - lastTenantId
 * - lastVisitedAt
 */

import { prisma } from '@/lib/db/prisma';
import { SessionState } from '../models/SessionState';

/**
 * Save session state
 */
export async function saveSessionState(
  userId: string,
  state: {
    lastPlatformKey?: string;
    lastRoute?: string;
    lastTenantId?: string;
  }
): Promise<void> {
  const now = new Date();

  await prisma.sessionState.upsert({
    where: { userId },
    create: {
      userId,
      ...state,
      lastVisitedAt: now,
      autoRestore: true,
    },
    update: {
      ...state,
      lastVisitedAt: now,
    },
  });
}

/**
 * Get last session state
 */
export async function getLastSessionState(
  userId: string
): Promise<SessionState | null> {
  const row = await prisma.sessionState.findUnique({ where: { userId } });
  if (!row) return null;

  return {
    id: row.id,
    userId: row.userId,
    lastPlatformKey: row.lastPlatformKey ?? undefined,
    lastRoute: row.lastRoute ?? undefined,
    lastTenantId: row.lastTenantId ?? undefined,
    lastVisitedAt: row.lastVisitedAt ?? new Date(),
    autoRestore: row.autoRestore,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Restore session state on login
 * Returns the route to redirect to
 */
export async function restoreSessionState(
  userId: string
): Promise<string | null> {
  const state = await getLastSessionState(userId);

  if (!state || !state.autoRestore) {
    return null;
  }

  // If we have a last route, return it
  if (state.lastRoute) {
    return state.lastRoute;
  }

  // If we have a last platform, redirect to platform hub
  if (state.lastPlatformKey) {
    return `/platforms/${state.lastPlatformKey}`;
  }

  // Default to platforms hub
  return '/platforms';
}

/**
 * Clear session state (on logout, but keep metadata)
 */
export async function clearSessionState(userId: string): Promise<void> {
  // Don't delete, just clear route/platform but keep metadata
  await prisma.sessionState.update({
    where: { userId },
    data: {
      lastRoute: null,
      lastPlatformKey: null,
    },
  });
}
