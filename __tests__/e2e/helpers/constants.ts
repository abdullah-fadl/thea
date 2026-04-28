/**
 * Shared constants for E2E workflow tests
 */

export const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
export const TEST_SECRET = process.env.TEST_SECRET || 'test-secret-change-in-production';

// ── Test Users (seeded by global-setup.ts) ──────────────────────────────

export const TEST_USER = {
  email: 'test-a@example.com',
  password: 'password123',
  tenantId: 'test-tenant-a',
};

export const TEST_USER_B = {
  email: 'test-b@example.com',
  password: 'password123',
  tenantId: 'test-tenant-b',
};

export const EXPIRED_USER = {
  email: 'expired@example.com',
  password: 'password123',
  tenantId: 'test-tenant-expired',
};

export const BLOCKED_USER = {
  email: 'blocked@example.com',
  password: 'password123',
  tenantId: 'test-tenant-blocked',
};

export const NOSAM_USER = {
  email: 'nosam@example.com',
  password: 'password123',
  tenantId: 'test-tenant-nosam',
};

// ── Sample Patient Data (realistic Saudi) ───────────────────────────────

export const SAMPLE_PATIENTS = {
  male: {
    firstName: 'Mohammed',
    lastName: 'Al-Rashidi',
    firstNameAr: 'محمد',
    lastNameAr: 'الرشيدي',
    dob: '1990-03-15',
    gender: 'MALE',
    nationalId: '1098765432',
    mobile: '+966501234567',
    nationality: 'SA',
    city: 'Riyadh',
  },
  female: {
    firstName: 'Fatima',
    lastName: 'Al-Dosari',
    firstNameAr: 'فاطمة',
    lastNameAr: 'الدوسري',
    dob: '1985-07-22',
    gender: 'FEMALE',
    nationalId: '2098765432',
    mobile: '+966509876543',
    nationality: 'SA',
    city: 'Jeddah',
  },
  child: {
    firstName: 'Omar',
    lastName: 'Al-Harbi',
    firstNameAr: 'عمر',
    lastNameAr: 'الحربي',
    dob: '2020-01-10',
    gender: 'MALE',
    nationalId: '1234567890',
    mobile: '+966505555555',
    nationality: 'SA',
    city: 'Dammam',
  },
};
