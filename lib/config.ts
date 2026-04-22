/**
 * Application Configuration
 *
 * Central configuration for Thea (EHR Platform).
 * This module provides config-driven values for app identity and branding.
 *
 * Environment Variables:
 * - APP_NAME: Display name for the application (default: "Thea")
 * - APP_CODE: Short code/identifier for the application (default: "sam")
 * - APP_TYPE: Type of platform (default: "policy_platform")
 */

export const APP_CONFIG = {
  name: 'Thea',
  fullName: 'Thea EHR',
  nameArabic: 'ثيا',
  description: 'Advanced Electronic Health Records System',
  descriptionArabic: 'نظام إدارة السجلات الطبية المتقدم',
  logo: '/brand/thea.svg',
  logoHealth: '/brand/thea-health.svg',
  version: '2.0.0',
  company: 'Thea Technologies',
  website: 'https://thea.health',
  support: 'support@thea.health',

  // Legacy support for migration
  legacyNames: ['Thea', 'Thea', 'thea'],

  // Platform specific
  platforms: {
    health: {
      name: 'Thea Health',
      nameArabic: 'ثيا الصحة',
      path: '/platforms/thea-health',
      legacyPath: '/platforms/thea-health',
    },
    sam: {
      name: 'SAM',
      nameArabic: 'سَم',
      path: '/platforms/sam',
    },
    cvision: {
      name: 'C-Vision',
      nameArabic: 'سي فيجن',
      path: '/cvision',
    },
  },

  // User roles update
  roles: {
    THEA_OWNER: 'thea-owner',
    ADMIN: 'admin',
    USER: 'user',
  },
} as const;

/**
 * Backward-compatible config used across the app.
 */
export const appConfig = {
  name: process.env.APP_NAME || APP_CONFIG.name,
  code: process.env.APP_CODE || 'sam',
  type: process.env.APP_TYPE || 'policy_platform',
  get title(): string {
    return APP_CONFIG.fullName;
  },
  get description(): string {
    return APP_CONFIG.description;
  },
} as const;

/**
 * Helper to get app name for i18n
 */
export function getAppName(language: 'en' | 'ar' = 'en', context?: string): string {
  if (language === 'ar') {
    return context === 'full' ? 'نظام ثيا للسجلات الطبية' : APP_CONFIG.nameArabic;
  }
  return context === 'full' ? 'Thea Electronic Health Records' : APP_CONFIG.name;
}

/**
 * Legacy compatibility
 */
export function getLegacyAppName(): string {
  return 'Thea';
}

