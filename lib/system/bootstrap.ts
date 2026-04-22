/**
 * System Bootstrap Utilities
 *
 * Safe one-time initialization logic for system-wide settings
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export interface SystemSetting {
  key: string;
  value: any;
  updatedAt: Date;
}

/**
 * Get a system setting value
 */
export async function getSystemSetting(key: string): Promise<any | null> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key },
    });
    return setting?.value ?? null;
  } catch (error) {
    logger.error('Error getting system setting', { category: 'system', key, error });
    return null;
  }
}

/**
 * Set a system setting value
 */
export async function setSystemSetting(key: string, value: any): Promise<boolean> {
  try {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value, updatedAt: new Date() },
      create: { key, value, updatedAt: new Date() },
    });
    return true;
  } catch (error) {
    logger.error('Error setting system setting', { category: 'system', key, error });
    return false;
  }
}

/**
 * Check if owner has been initialized
 */
export async function isOwnerInitialized(): Promise<boolean> {
  const initialized = await getSystemSetting('owner_initialized');
  return initialized === true;
}

/**
 * Mark owner as initialized
 */
export async function markOwnerInitialized(): Promise<boolean> {
  return await setSystemSetting('owner_initialized', true);
}

/**
 * Bootstrap Thea Owner (Explicit Email-Based)
 *
 * Promotes user to thea-owner ONLY if their email matches THEA_OWNER_EMAIL env var.
 * This is the ONLY bootstrap path. Never promotes admin@hospital.com automatically.
 *
 * @param userId - User ID to potentially promote
 * @param userEmail - User email (for specific email check)
 * @returns true if user was promoted, false otherwise
 */
export async function bootstrapTheaOwner(userId: string, userEmail: string): Promise<boolean> {
  try {
    const user = await prisma.user.findFirst({
      where: { id: userId },
    });

    if (!user) {
      return false;
    }

    // Get owner email from environment variable
    const ownerEmail = process.env.THEA_OWNER_EMAIL || process.env.Thea_OWNER_EMAIL;

    // If THEA_OWNER_EMAIL/Thea_OWNER_EMAIL is not set, do nothing
    if (!ownerEmail || ownerEmail.trim() === '') {
      logger.warn('THEA_OWNER_EMAIL not set. Owner bootstrap skipped.', { category: 'system' });
      return false;
    }

    // ONLY promote if email matches THEA_OWNER_EMAIL
    if (userEmail.toLowerCase() === ownerEmail.toLowerCase()) {
      if ((user.role as string) !== 'thea-owner') {
        await prisma.user.update({
          where: { id: userId },
          data: {
            role: 'THEA_OWNER' as string,
            updatedAt: new Date(),
          },
        });

        // Mark as initialized
        await markOwnerInitialized();

        // Log bootstrap action (safe - no PHI)
        logger.info('Thea Owner role assigned', { category: 'system', ownerEmail, userId });

        return true;
      }
      // Already thea-owner, ensure flag is set
      await markOwnerInitialized();
      return false;
    }

    // Email does not match THEA_OWNER_EMAIL - do nothing
    return false;
  } catch (error) {
    logger.error('Error during owner bootstrap', { category: 'system', error });
    return false;
  }
}
