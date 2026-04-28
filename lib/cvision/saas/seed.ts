import { logger } from '@/lib/monitoring/logger';
/**
 * CVision SaaS — Seed Default Tenant
 *
 * Creates the default Thea Health tenant if the cvision_tenants collection is empty.
 * Safe to run on every boot — skips if data already exists.
 */

import { getTenantDbByKey } from '@/lib/cvision/infra';
import { createTenant, getTenant, ensureTenantIndexes, Tenant } from './tenant-manager';
import { createUser, ensureUserIndexes, TenantUserRole } from './user-manager';
import { ensureTenantIdIndexes } from './data-isolation';

const DEFAULT_TENANT_ID = 'thea-health';

const DEFAULT_TENANT: Partial<Tenant> = {
  tenantId: DEFAULT_TENANT_ID,
  companyName: 'Thea Health',
  commercialRegistration: '',
  email: 'thea@thea.com.sa',
  phone: '+966500000000',
  website: 'https://thea.com.sa',

  address: {
    street: '',
    city: 'Riyadh',
    district: '',
    postalCode: '',
    country: 'SA',
  },

  branding: {
    primaryColor: '#FF6B00',
    secondaryColor: '#1a1a2e',
    accentColor: '#f59e0b',
  },

  subscription: {
    plan: 'ENTERPRISE',
    status: 'ACTIVE',
    billingCycle: 'ANNUAL',
    startDate: new Date(),
    maxEmployees: -1,
    maxUsers: -1,
    features: ['ALL'],
    price: 0,
  },

  settings: {
    language: 'both',
    timezone: 'Asia/Riyadh',
    dateFormat: 'DD/MM/YYYY',
    currency: 'SAR',
    weekStart: 'sunday',
    workDays: [0, 1, 2, 3, 4],
    workHoursPerDay: 8,
    fiscalYearStart: 1,

    enableAI: true,
    enableRetentionAI: true,
    enableWhatIf: true,
    enableGovernmentIntegrations: true,
    enableRecruitment: true,
    enablePerformance: true,
    enableDisciplinary: true,
    enableMuqeem: true,

    emailNotifications: true,
    smsNotifications: false,
  },

  createdBy: 'system',
};

/**
 * Seed the default tenant and system admin user.
 * Only seeds if the tenant doesn't already exist.
 */
export async function seedDefaultTenant(): Promise<{
  seeded: boolean;
  tenantId: string;
  message: string;
}> {
  try {
    // Ensure indexes first
    await ensureTenantIndexes();

    // Check if default tenant exists
    const existing = await getTenant(DEFAULT_TENANT_ID);
    if (existing) {
      return {
        seeded: false,
        tenantId: DEFAULT_TENANT_ID,
        message: 'Default tenant already exists, skipping seed.',
      };
    }

    // Create tenant
    await createTenant(DEFAULT_TENANT);

    // Ensure user indexes
    await ensureUserIndexes(DEFAULT_TENANT_ID);

    // Create default system admin user
    try {
      await createUser(DEFAULT_TENANT_ID, {
        userId: 'system-admin',
        email: 'admin@thea.com.sa',
        name: 'System Admin',
        role: 'SUPER_ADMIN' as TenantUserRole,
        isActive: true,
      });
    } catch {
      // User may already exist from a previous partial seed
    }

    // Ensure tenantId indexes on all collections
    await ensureTenantIdIndexes(DEFAULT_TENANT_ID);

    logger.info('[CVision SaaS] Default tenant seeded:', DEFAULT_TENANT_ID);

    return {
      seeded: true,
      tenantId: DEFAULT_TENANT_ID,
      message: 'Default tenant and admin user created successfully.',
    };
  } catch (error: any) {
    logger.error('[CVision SaaS] Seed error:', error.message);
    return {
      seeded: false,
      tenantId: DEFAULT_TENANT_ID,
      message: `Seed failed: ${error.message}`,
    };
  }
}

export { DEFAULT_TENANT_ID };
