#!/usr/bin/env npx tsx
/**
 * Seed — Creates simulator users + reference data in the test tenant.
 *
 * Usage: yarn sim:seed
 *
 * This seeds the required test users AND clinical infrastructure
 * (departments, ER beds, etc.) for the simulator directly in the database.
 *
 * Created users:
 * - sim-receptionist@test.thea.com (reception role)
 * - sim-nurse@test.thea.com (nurse role)
 * - sim-doctor@test.thea.com (doctor role)
 * - sim-staff@test.thea.com (staff role)
 * - sim-portal@test.thea.com (portal user)
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const TARGET_TENANT = process.env.THEA_SIM_TENANT || 'test-tenant-a';
const SECONDARY_TENANT = process.env.THEA_SIM_TENANT_B || 'test-tenant-b';
const DEFAULT_PASSWORD = process.env.THEA_SIM_PASSWORD || 'password123';

interface SeedUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  platform?: 'health' | 'cvision' | 'both';
}

const SEED_USERS: SeedUser[] = [
  // Core clinical roles
  { email: 'sim-receptionist@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'Sim', lastName: 'Receptionist', role: 'reception' },
  { email: 'sim-nurse@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'Sim', lastName: 'Nurse', role: 'nurse' },
  { email: 'sim-doctor@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'Sim', lastName: 'Doctor', role: 'doctor' },
  { email: 'sim-staff@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'Sim', lastName: 'Staff', role: 'staff' },
  { email: 'sim-portal@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'Sim', lastName: 'Portal', role: 'user' },
  // CVision roles
  { email: 'sim-cv-admin@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'Sim', lastName: 'CVAdmin', role: 'cvision-admin', platform: 'cvision' },
  { email: 'sim-cv-hr@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'Sim', lastName: 'CVHR', role: 'cvision-hr-manager', platform: 'cvision' },
  { email: 'sim-cv-hr-mgr@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'Sim', lastName: 'CVHRMgr', role: 'cvision-hr-manager', platform: 'cvision' },
  { email: 'sim-cv-mgr@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'Sim', lastName: 'CVManager', role: 'cvision-manager', platform: 'cvision' },
  { email: 'sim-cv-emp@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'Sim', lastName: 'CVEmployee', role: 'cvision-employee', platform: 'cvision' },
  { email: 'sim-cv-payroll@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'Sim', lastName: 'CVPayroll', role: 'cvision-admin', platform: 'cvision' },
];

/** Secondary tenant users (Tenant B) for cross-tenant isolation tests */
const SEED_USERS_TENANT_B: SeedUser[] = [
  { email: 'sim-receptionist-b@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'SimB', lastName: 'Receptionist', role: 'reception' },
  { email: 'sim-nurse-b@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'SimB', lastName: 'Nurse', role: 'nurse' },
  { email: 'sim-doctor-b@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'SimB', lastName: 'Doctor', role: 'doctor' },
  { email: 'sim-staff-b@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'SimB', lastName: 'Staff', role: 'staff' },
  { email: 'sim-portal-b@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'SimB', lastName: 'Portal', role: 'user' },
  { email: 'sim-cv-admin-b@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'SimB', lastName: 'CVAdmin', role: 'cvision-admin', platform: 'cvision' },
  { email: 'sim-cv-hr-b@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'SimB', lastName: 'CVHR', role: 'cvision-hr-manager', platform: 'cvision' },
  { email: 'sim-cv-hr-mgr-b@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'SimB', lastName: 'CVHRMgr', role: 'cvision-hr-manager', platform: 'cvision' },
  { email: 'sim-cv-mgr-b@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'SimB', lastName: 'CVManager', role: 'cvision-manager', platform: 'cvision' },
  { email: 'sim-cv-emp-b@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'SimB', lastName: 'CVEmployee', role: 'cvision-employee', platform: 'cvision' },
  { email: 'sim-cv-payroll-b@test.thea.com', password: DEFAULT_PASSWORD, firstName: 'SimB', lastName: 'CVPayroll', role: 'cvision-admin', platform: 'cvision' },
];

interface SeedDepartment {
  name: string;
  code: string;
  type: string;
}

const SEED_DEPARTMENTS: SeedDepartment[] = [
  { name: 'General Medicine', code: 'GEN-MED', type: 'OPD' },
  { name: 'Family Medicine', code: 'FAM-MED', type: 'OPD' },
  { name: 'Internal Medicine', code: 'INT-MED', type: 'BOTH' },
  { name: 'Pediatrics', code: 'PEDS', type: 'BOTH' },
  { name: 'Orthopedics', code: 'ORTHO', type: 'OPD' },
  { name: 'Emergency', code: 'ER', type: 'BOTH' },
];

interface SeedErBed {
  label: string;
  shortCode: string;
  bedType: string;
  status: string;
}

const SEED_ER_BEDS: SeedErBed[] = [
  { label: 'ER Bed 1', shortCode: 'ER-B1', bedType: 'ER', status: 'available' },
  { label: 'ER Bed 2', shortCode: 'ER-B2', bedType: 'ER', status: 'available' },
  { label: 'ER Bed 3', shortCode: 'ER-B3', bedType: 'ER', status: 'available' },
  { label: 'ER Bed 4', shortCode: 'ER-B4', bedType: 'ER', status: 'available' },
  { label: 'ER Resuscitation', shortCode: 'ER-R1', bedType: 'ER', status: 'available' },
];

function createPrisma(): PrismaClient {
  const connStr = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connStr) throw new Error('DATABASE_URL or DIRECT_URL must be set in .env.local');
  const adapter = new PrismaPg({ connectionString: connStr });
  return new PrismaClient({ adapter });
}

async function seedUsers(prisma: PrismaClient, tenantUuid: string) {
  console.log('  ── Users ──');
  for (const user of SEED_USERS) {
    const existing = await prisma.user.findFirst({
      where: { email: user.email },
      select: { id: true },
    });

    if (existing) {
      console.log(`  – Exists:  ${user.email} (${user.role})`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(user.password, 10);
    const userId = randomUUID();
    const isCvision = user.platform === 'cvision' || user.platform === 'both';
    const isHealth = !user.platform || user.platform === 'health' || user.platform === 'both';
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
        platformAccessHealth: isHealth,
        platformAccessCvision: isCvision,
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
          areas: ['OPD', 'ER', 'IPD', 'ORDERS', 'RESULTS', 'BILLING', 'REGISTRATION', 'NOTIFICATIONS'],
          isActive: true,
        },
      });
    } catch {
      // TenantUser may not be required for all setups
    }

    console.log(`  ✓ Created: ${user.email} (${user.role})`);
  }
}

async function seedDepartments(prisma: PrismaClient, tenantUuid: string) {
  console.log('\n  ── Departments ──');
  for (const dept of SEED_DEPARTMENTS) {
    const existing = await prisma.department.findFirst({
      where: { tenantId: tenantUuid, code: dept.code },
      select: { id: true },
    });

    if (existing) {
      console.log(`  – Exists:  ${dept.name} (${dept.code})`);
      continue;
    }

    await prisma.department.create({
      data: {
        id: randomUUID(),
        tenantId: tenantUuid,
        name: dept.name,
        code: dept.code,
        type: dept.type,
        isActive: true,
      },
    });

    console.log(`  ✓ Created: ${dept.name} (${dept.code}, type=${dept.type})`);
  }
}

async function seedErBeds(prisma: PrismaClient, tenantUuid: string) {
  console.log('\n  ── ER Beds ──');
  for (const bed of SEED_ER_BEDS) {
    try {
      const existing = await prisma.clinicalInfraBed.findFirst({
        where: { tenantId: tenantUuid, shortCode: bed.shortCode },
        select: { id: true },
      });

      if (existing) {
        console.log(`  – Exists:  ${bed.label} (${bed.shortCode})`);
        continue;
      }

      await prisma.clinicalInfraBed.create({
        data: {
          id: randomUUID(),
          tenantId: tenantUuid,
          label: bed.label,
          shortCode: bed.shortCode,
          bedType: bed.bedType,
          status: bed.status,
        },
      });

      console.log(`  ✓ Created: ${bed.label} (${bed.shortCode})`);
    } catch {
      console.log(`  – Skipped: ${bed.label} (model may not exist)`);
    }
  }
}

interface SeedProcedure {
  code: string;
  name: string;
  nameAr: string;
  basePrice: number;
}

const SEED_PROCEDURES: SeedProcedure[] = [
  { code: 'APPY', name: 'Appendectomy', nameAr: 'استئصال الزائدة', basePrice: 5000 },
  { code: 'CHOLE', name: 'Cholecystectomy', nameAr: 'استئصال المرارة', basePrice: 6000 },
  { code: 'HERNIA', name: 'Hernia Repair', nameAr: 'إصلاح الفتق', basePrice: 4500 },
  { code: 'CSECT', name: 'Cesarean Section', nameAr: 'عملية قيصرية', basePrice: 7000 },
  { code: 'ORIF', name: 'Open Reduction Internal Fixation', nameAr: 'تثبيت كسر داخلي', basePrice: 8000 },
  { code: 'KNEE-ARTH', name: 'Knee Arthroscopy', nameAr: 'منظار ركبة', basePrice: 3500 },
  { code: 'TONSIL', name: 'Tonsillectomy', nameAr: 'استئصال اللوزتين', basePrice: 2500 },
  { code: 'CATARACT', name: 'Cataract Extraction', nameAr: 'إزالة الساد', basePrice: 3000 },
];

async function seedProcedureCatalog(prisma: PrismaClient, tenantUuid: string) {
  console.log('\n  ── Procedure Catalog ──');
  for (const proc of SEED_PROCEDURES) {
    try {
      const existing = await prisma.billingChargeCatalog.findFirst({
        where: { tenantId: tenantUuid, code: proc.code },
        select: { id: true },
      });

      if (existing) {
        console.log(`  – Exists:  ${proc.name} (${proc.code})`);
        continue;
      }

      await prisma.billingChargeCatalog.create({
        data: {
          id: randomUUID(),
          tenantId: tenantUuid,
          code: proc.code,
          name: proc.name,
          nameAr: proc.nameAr,
          itemType: 'PROCEDURE',
          departmentDomain: 'OR',
          unitType: 'PER_PROCEDURE',
          basePrice: proc.basePrice,
          allowedForCash: true,
          allowedForInsurance: true,
          status: 'ACTIVE',
        },
      });

      console.log(`  ✓ Created: ${proc.name} (${proc.code})`);
    } catch {
      console.log(`  – Skipped: ${proc.name} (model may not exist)`);
    }
  }
}

async function main() {
  console.log('\n  Thea Simulator — Seed');
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

    await seedUsers(prisma, tenant.id);
    await seedDepartments(prisma, tenant.id);
    await seedErBeds(prisma, tenant.id);
    await seedProcedureCatalog(prisma, tenant.id);

    // Seed secondary tenant (Tenant B) for cross-tenant isolation tests
    const tenantB = await prisma.tenant.findFirst({
      where: { tenantId: SECONDARY_TENANT },
      select: { id: true, name: true },
    });

    if (tenantB) {
      console.log(`\n  Secondary tenant found: ${tenantB.name} (${tenantB.id})\n`);
      console.log('  ── Tenant B Users ──');
      for (const user of SEED_USERS_TENANT_B) {
        const existing = await prisma.user.findFirst({
          where: { email: user.email },
          select: { id: true },
        });

        if (existing) {
          console.log(`  – Exists:  ${user.email} (${user.role})`);
          continue;
        }

        const hashedPassword = await bcrypt.hash(user.password, 10);
        const userId = randomUUID();
        const isCvision = user.platform === 'cvision' || user.platform === 'both';
        const isHealth = !user.platform || user.platform === 'health' || user.platform === 'both';
        await prisma.user.create({
          data: {
            id: userId,
            email: user.email,
            password: hashedPassword,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            tenantId: tenantB.id,
            isActive: true,
            platformAccessHealth: isHealth,
            platformAccessCvision: isCvision,
          },
        });

        try {
          await prisma.tenantUser.create({
            data: {
              id: randomUUID(),
              userId,
              tenantId: tenantB.id,
              roles: [user.role],
              areas: ['OPD', 'ER', 'IPD', 'ORDERS', 'RESULTS', 'BILLING', 'REGISTRATION', 'NOTIFICATIONS'],
              isActive: true,
            },
          });
        } catch {
          // TenantUser may not be required for all setups
        }

        console.log(`  + Created: ${user.email} (${user.role})`);
      }

      // Seed basic departments for Tenant B
      await seedDepartments(prisma, tenantB.id);
    } else {
      console.log(`\n  Secondary tenant "${SECONDARY_TENANT}" not found — skipping Tenant B seed.`);
      console.log('    Create it via the owner console to enable cross-tenant tests.');
    }

    console.log('\n  Seed complete.\n');
  } catch (err) {
    console.error('\n  Seed failed:', (err as Error).message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
