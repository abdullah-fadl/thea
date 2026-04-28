#!/usr/bin/env npx tsx
/**
 * Seed — Creates CVision simulator users + org structure in the test tenant.
 *
 * Usage: npx tsx simulator/seed-cvision.ts
 *
 * Created users:
 * - sim-cv-admin@test.thea.com     (admin → cvision_admin)
 * - sim-cv-hr@test.thea.com        (hr-admin → hr_admin)
 * - sim-cv-hr-mgr@test.thea.com    (hr-manager → hr_manager)
 * - sim-cv-mgr@test.thea.com       (manager → manager)
 * - sim-cv-emp@test.thea.com       (staff → employee)
 * - sim-cv-payroll@test.thea.com   (hr-admin → hr_admin)
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const TARGET_TENANT = process.env.THEA_SIM_TENANT || 'test-tenant-a';
const DEFAULT_PASSWORD = process.env.THEA_SIM_PASSWORD || 'password123';

// ── CVision Permission Constants (mirrored from lib/cvision/constants.ts) ──
// Inlined to avoid importing Next.js-dependent modules in standalone script.
const P = {
  VIEW: 'cvision.view',
  ORG_READ: 'cvision.org.read',
  ORG_WRITE: 'cvision.org.write',
  EMPLOYEES_READ: 'cvision.employees.read',
  EMPLOYEES_WRITE: 'cvision.employees.write',
  EMPLOYEES_STATUS: 'cvision.employees.status',
  REQUESTS_READ: 'cvision.requests.read',
  REQUESTS_WRITE: 'cvision.requests.write',
  REQUESTS_APPROVE: 'cvision.requests.approve',
  REQUESTS_ESCALATE: 'cvision.requests.escalate',
  RECRUITMENT_READ: 'cvision.recruitment.read',
  RECRUITMENT_WRITE: 'cvision.recruitment.write',
  RECRUITMENT_APPROVE: 'cvision.recruitment.approve',
  PAYROLL_READ: 'cvision.payroll.read',
  PAYROLL_WRITE: 'cvision.payroll.write',
  PAYROLL_APPROVE: 'cvision.payroll.approve',
  SCHEDULING_READ: 'cvision.scheduling.read',
  SCHEDULING_WRITE: 'cvision.scheduling.write',
  SCHEDULING_APPROVE: 'cvision.scheduling.approve',
  PERFORMANCE_READ: 'cvision.performance.read',
  PERFORMANCE_WRITE: 'cvision.performance.write',
  PERFORMANCE_CALIBRATE: 'cvision.performance.calibrate',
  ATTENDANCE_READ: 'cvision.attendance.read',
  ATTENDANCE_WRITE: 'cvision.attendance.write',
  ATTENDANCE_APPROVE: 'cvision.attendance.approve',
  LEAVES_READ: 'cvision.leaves.read',
  LEAVES_WRITE: 'cvision.leaves.write',
  LEAVES_APPROVE: 'cvision.leaves.approve',
  TRAINING_READ: 'cvision.training.read',
  TRAINING_WRITE: 'cvision.training.write',
  TRAINING_APPROVE: 'cvision.training.approve',
  INSURANCE_READ: 'cvision.insurance.read',
  INSURANCE_WRITE: 'cvision.insurance.write',
  GRIEVANCES_READ: 'cvision.grievances.read',
  GRIEVANCES_WRITE: 'cvision.grievances.write',
  REPORTS_READ: 'cvision.reports.read',
  REPORTS_EXPORT: 'cvision.reports.export',
  NOTIFICATIONS_READ: 'cvision.notifications.read',
  NOTIFICATIONS_WRITE: 'cvision.notifications.write',
  ONBOARDING_READ: 'cvision.onboarding.read',
  ONBOARDING_WRITE: 'cvision.onboarding.write',
  POLICIES_READ: 'cvision.policies.read',
  POLICIES_WRITE: 'cvision.policies.write',
  SELF_SERVICE: 'cvision.self_service',
  AUDIT_READ: 'cvision.audit.read',
  DELEGATION_MANAGE: 'cvision.delegation.manage',
  CONFIG_WRITE: 'cvision.config.write',
  CONTRACTS_READ: 'cvision.contracts.read',
  CONTRACTS_WRITE: 'cvision.contracts.write',
  LETTERS_READ: 'cvision.letters.read',
  LETTERS_WRITE: 'cvision.letters.write',
  LOANS_READ: 'cvision.loans.read',
  LOANS_WRITE: 'cvision.loans.write',
  LOANS_APPROVE: 'cvision.loans.approve',
  TRAVEL_READ: 'cvision.travel.read',
  TRAVEL_WRITE: 'cvision.travel.write',
  TRAVEL_APPROVE: 'cvision.travel.approve',
  COMPENSATION_READ: 'cvision.compensation.read',
  REWARDS_READ: 'cvision.rewards.read',
  SUCCESSION_READ: 'cvision.succession.read',
  DASHBOARDS_READ: 'cvision.dashboards.read',
  FILES_READ: 'cvision.files.read',
  FILES_WRITE: 'cvision.files.write',
  BRANCHES_READ: 'cvision.branches.read',
};

const ALL_PERMISSIONS = Object.values(P);

/** CVision role → permissions (mirrors CVISION_ROLE_PERMISSIONS in constants.ts) */
function getCVisionPermissions(role: string): string[] {
  switch (role) {
    case 'admin':
      return ALL_PERMISSIONS;
    case 'hr-admin':
      return ALL_PERMISSIONS.filter(p => p !== P.CONFIG_WRITE);
    case 'hr-manager':
      return ALL_PERMISSIONS.filter(p => p !== P.CONFIG_WRITE && p !== P.AUDIT_READ);
    case 'manager':
      return [
        P.VIEW, P.ORG_READ, P.EMPLOYEES_READ,
        P.REQUESTS_READ, P.REQUESTS_WRITE, P.REQUESTS_APPROVE,
        P.ATTENDANCE_READ, P.LEAVES_READ, P.LEAVES_APPROVE,
        P.LOANS_READ, P.LOANS_APPROVE,
        P.TRAVEL_READ, P.TRAVEL_APPROVE,
        P.TRAINING_READ, P.TRAINING_APPROVE,
        P.PERFORMANCE_READ, P.PERFORMANCE_WRITE,
        P.SCHEDULING_READ, P.REPORTS_READ,
        P.NOTIFICATIONS_READ, P.NOTIFICATIONS_WRITE,
        P.POLICIES_READ, P.DELEGATION_MANAGE, P.SELF_SERVICE,
      ];
    case 'staff':
      return [
        P.VIEW, P.SELF_SERVICE,
        P.NOTIFICATIONS_READ, P.POLICIES_READ,
        P.REQUESTS_READ, P.PERFORMANCE_READ,
        P.LEAVES_READ, P.ATTENDANCE_READ, P.TRAINING_READ,
      ];
    default:
      return [P.VIEW];
  }
}

interface SeedUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
}

const SEED_USERS: SeedUser[] = [
  { email: 'sim-cv-admin@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'Sim', lastName: 'CVAdmin', role: 'admin' },
  { email: 'sim-cv-hr@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'Sim', lastName: 'CVHR', role: 'hr-admin' },
  { email: 'sim-cv-hr-mgr@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'Sim', lastName: 'CVHRMgr', role: 'hr-manager' },
  { email: 'sim-cv-mgr@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'Sim', lastName: 'CVManager', role: 'manager' },
  { email: 'sim-cv-emp@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'Sim', lastName: 'CVEmployee', role: 'staff' },
  { email: 'sim-cv-payroll@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'Sim', lastName: 'CVPayroll', role: 'hr-admin' },
];

function createPrisma(): PrismaClient {
  const connStr = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connStr) throw new Error('DATABASE_URL or DIRECT_URL must be set in .env.local');
  const adapter = new PrismaPg({ connectionString: connStr });
  return new PrismaClient({ adapter });
}

async function seedUsers(prisma: PrismaClient, tenantUuid: string) {
  console.log('  ── CVision Users ──');
  for (const user of SEED_USERS) {
    const permissions = getCVisionPermissions(user.role);
    const existing = await prisma.user.findFirst({
      where: { email: user.email },
      select: { id: true },
    });

    if (existing) {
      // Always update permissions on re-seed (in case role permissions changed)
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          permissions,
          platformAccessCvision: true,
        },
      });
      console.log(`  – Updated: ${user.email} (${user.role}, ${permissions.length} perms)`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(user.password, 10);
    const userId = randomUUID();
    await prisma.user.create({
      data: {
        id: userId,
        email: user.email,
        password: hashedPassword,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: tenantUuid,
        isActive: true,
        platformAccessHealth: true,
        platformAccessCvision: true,
        permissions,
      },
    });

    // Create TenantUser link
    try {
      await prisma.tenantUser.create({
        data: {
          id: randomUUID(),
          userId,
          tenantId: tenantUuid,
          roles: [user.role],
          areas: ['CVISION'],
          isActive: true,
        },
      });
    } catch {
      // TenantUser may not be required for all setups
    }

    console.log(`  ✓ Created: ${user.email} (${user.role}, ${permissions.length} perms)`);
  }
}

async function main() {
  console.log('\n  Thea Simulator — CVision Seed');
  console.log(`  Target tenant: ${TARGET_TENANT}`);
  console.log('');

  const prisma = createPrisma();

  try {
    // Resolve tenant
    const tenant = await prisma.tenant.findFirst({
      where: { tenantId: TARGET_TENANT },
      select: { id: true, name: true },
    });

    if (!tenant) {
      console.error(`  ✗ Tenant "${TARGET_TENANT}" not found.`);
      console.error('    Create it first via the owner console, or set THEA_SIM_TENANT.\n');
      process.exit(1);
    }

    console.log(`  Tenant found: ${tenant.name} (${tenant.id})\n`);

    // Enable CVision entitlement on tenant
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { entitlementCvision: true },
    });
    console.log('  ✓ Tenant entitlementCvision enabled');

    // Enable CVision on subscription contract (if exists)
    try {
      const updated = await prisma.subscriptionContract.updateMany({
        where: { tenantId: tenant.id },
        data: { enabledCvision: true },
      });
      if (updated.count > 0) {
        console.log(`  ✓ Subscription contract CVision enabled (${updated.count})`);
      }
    } catch {
      // Contract may not exist yet — will be auto-created on first login
    }

    console.log('');
    await seedUsers(prisma, tenant.id);

    console.log('\n  CVision seed complete.\n');
  } catch (err) {
    console.error('\n  CVision seed failed:', (err as Error).message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
