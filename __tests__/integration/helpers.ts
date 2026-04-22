/**
 * Integration Test Helpers
 *
 * Provides authenticated HTTP helpers, test-user seeding, JWT generation,
 * and cleanup utilities for Thea EHR integration tests.
 *
 * Prerequisites:
 *   - The dev server running: `yarn dev`
 *   - PostgreSQL reachable via DATABASE_URL
 *   - JWT_SECRET env var set
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-integration-tests-32chars!!';

// ---------------------------------------------------------------------------
// Prisma client (shared for test seeding / cleanup)
// Uses the same PrismaPg adapter pattern as the production app (Prisma v7)
// ---------------------------------------------------------------------------

let _prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        '[Integration Tests] DATABASE_URL is not set. ' +
        'Make sure your .env.local is loaded or DATABASE_URL is exported.',
      );
    }
    const adapter = new PrismaPg({ connectionString });
    _prisma = new PrismaClient({
      adapter,
      log: ['error'],
    });
  }
  return _prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = null;
  }
}

// ---------------------------------------------------------------------------
// Roles & Permission sets
// ---------------------------------------------------------------------------

export type TestRole = 'admin' | 'doctor' | 'nurse' | 'receptionist' | 'patient' | 'viewer';

const ROLE_TO_DB_ROLE: Record<TestRole, string> = {
  admin: 'admin',
  doctor: 'doctor',
  nurse: 'nurse',
  receptionist: 'receptionist',
  patient: 'patient',
  viewer: 'viewer',
};

const ROLE_PERMISSIONS: Record<TestRole, string[]> = {
  admin: [
    'opd.dashboard.view', 'opd.visit.view', 'opd.visit.create', 'opd.visit.edit',
    'opd.doctor.encounter.view', 'opd.doctor.encounter.edit',
    'orders.hub.view', 'orders.hub.create',
    'er.register.create', 'er.triage.edit', 'er.beds.assign',
    'er.encounter.view', 'er.disposition.update',
    'ipd.live-beds.view', 'ipd.live-beds.edit', 'ipd.admin.view', 'ipd.admin.edit',
    'lab.orders.view', 'lab.orders.create', 'lab.specimens.view', 'lab.results.view',
    'pharmacy.dispense.view', 'pharmacy.prescriptions.create', 'pharmacy.dispense.create', 'pharmacy.view',
    'billing.view', 'billing.payment.view', 'billing.payment.create', 'billing.invoices.view',
    'admin.users.view', 'admin.users.create', 'admin.users.edit',
    'admin.tenants.view', 'admin.settings.view',
  ],
  doctor: [
    'opd.dashboard.view', 'opd.visit.view', 'opd.visit.create', 'opd.visit.edit',
    'opd.doctor.encounter.view', 'opd.doctor.encounter.edit', 'opd.nursing.flow',
    'orders.hub.view', 'orders.hub.create',
    'er.board.view', 'er.encounter.view', 'er.doctor.view', 'er.triage.edit', 'er.disposition.update',
    'ipd.live-beds.view', 'ipd.live-beds.edit',
    'lab.orders.view', 'lab.orders.create', 'lab.results.view',
    'pharmacy.prescriptions.create',
    'billing.invoices.view',
  ],
  nurse: [
    'opd.dashboard.view', 'opd.visit.view', 'opd.nursing.edit', 'opd.nursing.flow',
    'er.board.view', 'er.register.create', 'er.nursing.view', 'er.triage.edit', 'er.beds.view', 'er.beds.assign', 'er.encounter.view',
    'ipd.live-beds.view', 'ipd.live-beds.edit',
    'lab.specimens.view',
    'pharmacy.dispense.view',
  ],
  receptionist: [
    'opd.dashboard.view', 'opd.visit.view', 'opd.visit.create',
    'er.register.create', 'er.encounter.view',
    'billing.view', 'billing.payment.view', 'billing.payment.create', 'billing.invoices.view',
  ],
  patient: [
    'portal.profile.view', 'portal.appointments.view', 'portal.results.view',
  ],
  viewer: [
    'opd.dashboard.view', 'opd.visit.view',
  ],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TestTenant {
  id: string;        // UUID
  tenantId: string;  // business key (e.g. 'test-integ-a')
  name: string;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: TestRole;
  dbRole: string;
  tenantId: string;     // UUID FK
  tenantKey: string;    // business key
  firstName: string;
  lastName: string;
  department?: string;
  departmentKey?: string;
  permissions: string[];
}

export interface TestContext {
  tenantA: TestTenant;
  tenantB: TestTenant;
  users: Record<TestRole, TestUser>;
  tenantBAdmin: TestUser;
  tokens: Record<TestRole, string>;
  tokenTenantB: string;
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

/**
 * Generate a JWT access token identical to what the login route produces.
 */
export function generateTestToken(
  userId: string,
  email: string,
  role: string,
  sessionId: string,
  activeTenantId?: string,
): string {
  return jwt.sign(
    {
      userId,
      email,
      role,
      sessionId,
      activeTenantId,
      entitlements: { sam: true, health: true, edrac: true, cvision: true },
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

/**
 * Generate an expired JWT for negative testing.
 */
export function generateExpiredToken(userId: string, email: string, role: string): string {
  return jwt.sign(
    { userId, email, role, sessionId: uuidv4(), activeTenantId: 'expired' },
    JWT_SECRET,
    { expiresIn: '-1s' },
  );
}

// ---------------------------------------------------------------------------
// Authenticated fetch helper
// ---------------------------------------------------------------------------

/**
 * Perform an HTTP request against the running dev server, sending the JWT
 * as an `auth-token` cookie (matching the production auth pattern).
 */
export async function authenticatedFetch(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const headers = new Headers(options.headers || {});
  headers.set('Cookie', `auth-token=${token}`);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...options, headers, redirect: 'manual' });
}

/**
 * Shorthand POST with JSON body.
 */
export async function authPost(path: string, token: string, body: unknown): Promise<Response> {
  return authenticatedFetch(path, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Shorthand GET.
 */
export async function authGet(path: string, token: string): Promise<Response> {
  return authenticatedFetch(path, token, { method: 'GET' });
}

/**
 * Shorthand PATCH.
 */
export async function authPatch(path: string, token: string, body: unknown): Promise<Response> {
  return authenticatedFetch(path, token, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const TEST_PASSWORD = 'IntegTestP@ss2026!';
const HASHED_PASSWORD_CACHE: { value?: string } = {};

async function hashedPassword(): Promise<string> {
  if (!HASHED_PASSWORD_CACHE.value) {
    HASHED_PASSWORD_CACHE.value = await bcrypt.hash(TEST_PASSWORD, 10);
  }
  return HASHED_PASSWORD_CACHE.value;
}

/**
 * Seeds two tenants, a full set of role-based users in Tenant A,
 * and one admin in Tenant B (for isolation tests).
 *
 * Returns TestContext with users, tokens, and tenant metadata.
 */
export async function seedTestData(): Promise<TestContext> {
  const prisma = getPrisma();
  const pw = await hashedPassword();
  const now = new Date();
  const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  // ---- Tenants --------------------------------------------------------

  const tenantAKey = `test-integ-a-${Date.now()}`;
  const tenantBKey = `test-integ-b-${Date.now()}`;

  const tenantARow = await prisma.tenant.create({
    data: {
      tenantId: tenantAKey,
      name: 'Integration Test Hospital A',
      status: 'ACTIVE',
      planType: 'ENTERPRISE',
      entitlementSam: true,
      entitlementHealth: true,
      entitlementEdrac: true,
      entitlementCvision: true,
      maxUsers: 50,
      subscriptionEndsAt: oneYearFromNow,
    },
  });

  const tenantBRow = await prisma.tenant.create({
    data: {
      tenantId: tenantBKey,
      name: 'Integration Test Hospital B',
      status: 'ACTIVE',
      planType: 'ENTERPRISE',
      entitlementSam: true,
      entitlementHealth: true,
      entitlementEdrac: true,
      entitlementCvision: true,
      maxUsers: 50,
      subscriptionEndsAt: oneYearFromNow,
    },
  });

  // Subscription contracts
  await prisma.subscriptionContract.create({
    data: {
      tenantId: tenantARow.id,
      status: 'active',
      enabledSam: true,
      enabledTheaHealth: true,
      enabledCvision: true,
      enabledEdrac: true,
      maxUsers: 50,
      currentUsers: 0,
      planType: 'enterprise',
      enabledFeatures: {},
      storageLimit: BigInt(1000000000),
      subscriptionStartsAt: now,
      subscriptionEndsAt: oneYearFromNow,
      gracePeriodEnabled: false,
    },
  });

  await prisma.subscriptionContract.create({
    data: {
      tenantId: tenantBRow.id,
      status: 'active',
      enabledSam: true,
      enabledTheaHealth: true,
      enabledCvision: true,
      enabledEdrac: true,
      maxUsers: 50,
      currentUsers: 0,
      planType: 'enterprise',
      enabledFeatures: {},
      storageLimit: BigInt(1000000000),
      subscriptionStartsAt: now,
      subscriptionEndsAt: oneYearFromNow,
      gracePeriodEnabled: false,
    },
  });

  const tenantA: TestTenant = { id: tenantARow.id, tenantId: tenantAKey, name: tenantARow.name! };
  const tenantB: TestTenant = { id: tenantBRow.id, tenantId: tenantBKey, name: tenantBRow.name! };

  // ---- Users -----------------------------------------------------------

  const roleDefs: { role: TestRole; firstName: string; lastName: string; dept?: string; deptKey?: string }[] = [
    { role: 'admin',        firstName: 'Admin',        lastName: 'TestA', dept: 'Administration', deptKey: 'ADMIN' },
    { role: 'doctor',       firstName: 'Doctor',       lastName: 'TestA', dept: 'OPD',            deptKey: 'OPD' },
    { role: 'nurse',        firstName: 'Nurse',        lastName: 'TestA', dept: 'ER',             deptKey: 'ER' },
    { role: 'receptionist', firstName: 'Receptionist', lastName: 'TestA', dept: 'Registration',   deptKey: 'REGISTRATION' },
    { role: 'patient',      firstName: 'Patient',      lastName: 'TestA' },
    { role: 'viewer',       firstName: 'Viewer',       lastName: 'TestA' },
  ];

  const users: Record<string, TestUser> = {};
  const tokens: Record<string, string> = {};

  for (const def of roleDefs) {
    const userId = uuidv4();
    const email = `${def.role}.${tenantAKey}@test.thea.local`;
    const dbRole = ROLE_TO_DB_ROLE[def.role];

    await prisma.user.create({
      data: {
        id: userId,
        email,
        password: pw,
        firstName: def.firstName,
        lastName: def.lastName,
        role: dbRole as string,
        tenantId: tenantA.id,
        isActive: true,
        department: def.dept || null,
        permissions: ROLE_PERMISSIONS[def.role],
      },
    });

    // Create session for the user
    const sessionId = uuidv4();
    await prisma.session.create({
      data: {
        sessionId,
        userId,
        tenantId: tenantA.id,
        activeTenantId: tenantA.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: 'IntegrationTest/1.0',
        ip: '127.0.0.1',
      },
    });

    // Link session to user so validateSession passes
    await prisma.user.update({
      where: { id: userId },
      data: { activeSessionId: sessionId },
    });

    // Create TenantUser link (for area-based access)
    try {
      await (prisma as Record<string, unknown>).tenantUser.create({
        data: {
          userId,
          tenantId: tenantA.id,
          roles: [dbRole],
          areas: def.deptKey ? [def.deptKey, 'OPD', 'ER', 'IPD', 'ORDERS', 'RESULTS', 'BILLING', 'REGISTRATION', 'NOTIFICATIONS'] : ['OPD', 'ER', 'IPD', 'ORDERS', 'RESULTS', 'BILLING', 'REGISTRATION', 'NOTIFICATIONS'],
          isActive: true,
        },
      });
    } catch {
      // TenantUser table may not exist in all schemas — skip silently
    }

    const token = generateTestToken(userId, email, def.role === 'admin' ? 'admin' : 'staff', sessionId, tenantAKey);

    const testUser: TestUser = {
      id: userId,
      email,
      password: TEST_PASSWORD,
      role: def.role,
      dbRole,
      tenantId: tenantA.id,
      tenantKey: tenantAKey,
      firstName: def.firstName,
      lastName: def.lastName,
      department: def.dept,
      departmentKey: def.deptKey,
      permissions: ROLE_PERMISSIONS[def.role],
    };

    users[def.role] = testUser;
    tokens[def.role] = token;
  }

  // ---- Tenant B admin ------------------------------------------------

  const tenantBAdminId = uuidv4();
  const tenantBAdminEmail = `admin.${tenantBKey}@test.thea.local`;
  await prisma.user.create({
    data: {
      id: tenantBAdminId,
      email: tenantBAdminEmail,
      password: pw,
      firstName: 'Admin',
      lastName: 'TestB',
      role: 'admin' as string,
      tenantId: tenantB.id,
      isActive: true,
      department: 'Administration',
      permissions: ROLE_PERMISSIONS.admin,
    },
  });

  const tenantBSessionId = uuidv4();
  await prisma.session.create({
    data: {
      sessionId: tenantBSessionId,
      userId: tenantBAdminId,
      tenantId: tenantB.id,
      activeTenantId: tenantB.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent: 'IntegrationTest/1.0',
      ip: '127.0.0.1',
    },
  });

  // Link session to user so validateSession passes
  await prisma.user.update({
    where: { id: tenantBAdminId },
    data: { activeSessionId: tenantBSessionId },
  });

  try {
    await (prisma as Record<string, unknown>).tenantUser.create({
      data: {
        userId: tenantBAdminId,
        tenantId: tenantB.id,
        roles: ['admin'],
        areas: ['ADMIN', 'OPD', 'ER', 'IPD', 'ORDERS', 'RESULTS', 'BILLING', 'REGISTRATION', 'NOTIFICATIONS'],
        isActive: true,
      },
    });
  } catch { /* TenantUser may not exist */ }

  const tokenTenantB = generateTestToken(tenantBAdminId, tenantBAdminEmail, 'admin', tenantBSessionId, tenantBKey);

  const tenantBAdmin: TestUser = {
    id: tenantBAdminId,
    email: tenantBAdminEmail,
    password: TEST_PASSWORD,
    role: 'admin',
    dbRole: 'ADMIN',
    tenantId: tenantB.id,
    tenantKey: tenantBKey,
    firstName: 'Admin',
    lastName: 'TestB',
    department: 'Administration',
    departmentKey: 'ADMIN',
    permissions: ROLE_PERMISSIONS.admin,
  };

  return {
    tenantA,
    tenantB,
    users: users as Record<TestRole, TestUser>,
    tenantBAdmin,
    tokens: tokens as Record<TestRole, string>,
    tokenTenantB,
  };
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Removes ALL test data created by seedTestData.
 * Cascades through sessions, encounters, patients, etc.
 */
export async function cleanupTestData(ctx: TestContext): Promise<void> {
  const prisma = getPrisma();
  const tenantIds = [ctx.tenantA.id, ctx.tenantB.id];
  const userIds = [
    ...Object.values(ctx.users).map((u) => u.id),
    ctx.tenantBAdmin.id,
  ];

  try {
    // Delete in dependency order (children first)

    // ER (must come before patientMaster due to FK on patientId)
    await (prisma as Record<string, unknown>).erTriageAssessment?.deleteMany({ where: { encounterId: { not: undefined } } }).catch(() => {});
    await (prisma as Record<string, unknown>).erDisposition?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).erBedAssignment?.deleteMany({ where: { encounterId: { not: undefined } } }).catch(() => {});
    await (prisma as Record<string, unknown>).erAuditLog?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).erEncounter?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).erPatient?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).erBed?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).erSequence?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});

    // OPD / Clinical
    await prisma.opdEncounter.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await prisma.encounterCore.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await prisma.patientMaster.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});

    // IPD
    await (prisma as Record<string, unknown>).ipdMedOrder?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).ipdOrder?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).ipdBedAssignment?.deleteMany({ where: { episodeId: { not: undefined } } }).catch(() => {});
    await (prisma as Record<string, unknown>).ipdEpisode?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).ipdBed?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});

    // Lab / Pharmacy / Billing
    await (prisma as Record<string, unknown>).labResult?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).labSpecimen?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).labOrder?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).prescription?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).payment?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).invoice?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).ordersHub?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});

    // Orders
    await (prisma as Record<string, unknown>).opdOrder?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});

    // Discharge
    await (prisma as Record<string, unknown>).dischargeFinalization?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});

    // Visit notes
    await (prisma as Record<string, unknown>).opdVisitNote?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});

    // Audit logs
    await (prisma as Record<string, unknown>).auditLog?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});

    // TenantUser
    await (prisma as Record<string, unknown>).tenantUser?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});

    // Sessions
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});

    // Users
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});

    // Subscription contracts
    await prisma.subscriptionContract.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});

    // Tenants (last, since FK constraints reference them)
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } }).catch(() => {});
  } catch (err) {
    console.warn('[integration cleanup] partial failure:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Patient creation helper
// ---------------------------------------------------------------------------

/**
 * Creates a test patient directly in the DB and returns the record.
 */
export async function createTestPatient(
  tenantId: string,
  overrides: Partial<{
    firstName: string;
    lastName: string;
    gender: string;
    dob: Date;
    mobile: string;
    nationalId: string;
  }> = {},
) {
  const prisma = getPrisma();
  const id = uuidv4();
  const firstName = overrides.firstName || 'Test';
  const lastName = overrides.lastName || 'Patient';
  const patient = await prisma.patientMaster.create({
    data: {
      id,
      tenantId,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      nameNormalized: `${firstName} ${lastName}`.toLowerCase(),
      gender: (overrides.gender || 'MALE') as string,
      dob: overrides.dob || new Date('1990-01-15'),
      mobile: overrides.mobile || `+9665${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
      status: 'KNOWN' as string,
    } as Record<string, unknown>,
  });
  return patient;
}

// ---------------------------------------------------------------------------
// Wait helper
// ---------------------------------------------------------------------------

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Server health check
// ---------------------------------------------------------------------------

/**
 * Verifies the dev server is reachable before running tests.
 * Call this in `beforeAll` to produce a clear error if the server is down.
 */
export async function ensureServerRunning(): Promise<void> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, { method: 'GET' });
    // Even a 401 means the server is up
    if (res.status >= 500) throw new Error(`Server error: ${res.status}`);
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    const cause = e.cause as Record<string, unknown> | undefined;
    if (cause?.code === 'ECONNREFUSED' || (e.message as string)?.includes('fetch failed')) {
      throw new Error(
        `\n\n❌  Integration tests require a running dev server.\n` +
        `   Start it with:  yarn dev\n` +
        `   Then re-run:    yarn test:integration\n\n`,
      );
    }
    // Any other error means the server IS reachable (maybe 401/404 etc.)
  }
}
