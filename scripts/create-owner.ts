/**
 * Create Thea Owner Account
 *
 * Creates the platform owner user + owner tenant in PostgreSQL via Prisma.
 *
 * Usage:
 *   npx tsx scripts/create-owner.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import dotenv from 'dotenv';

// Load .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Use MIGRATION_URL (direct connection) — pooler URLs may fail with "Tenant or user not found"
const connectionString = process.env.MIGRATION_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL/DIRECT_URL is not set in .env.local');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ─── Config ─────────────────────────────────────────────────────────────────
const OWNER_EMAIL = process.env.THEA_OWNER_EMAIL || 'thea@thea.com.sa';
const OWNER_PASSWORD = process.env.THEA_OWNER_PASSWORD;
if (!OWNER_PASSWORD) {
  console.error('❌ THEA_OWNER_PASSWORD must be set in environment or .env.local');
  process.exit(1);
}
const OWNER_TENANT_ID = 'thea-owner-dev';

async function main() {
  console.log('\n🚀 Creating Thea Owner Account...\n');

  // ── 1. Create owner tenant ──────────────────────────────────────────────
  console.log('📦 Step 1: Creating owner tenant...');

  let tenant = await prisma.tenant.findUnique({
    where: { tenantId: OWNER_TENANT_ID },
  });

  if (tenant) {
    console.log(`   ✅ Tenant "${OWNER_TENANT_ID}" already exists (id: ${tenant.id})`);
  } else {
    tenant = await prisma.tenant.create({
      data: {
        tenantId: OWNER_TENANT_ID,
        name: 'Thea Platform Owner',
        status: 'ACTIVE',
        planType: 'ENTERPRISE',
        entitlementSam: true,
        entitlementHealth: true,
        entitlementEdrac: true,
        entitlementCvision: true,
        maxUsers: 999,
      },
    });
    console.log(`   ✅ Tenant created: "${OWNER_TENANT_ID}" (id: ${tenant.id})`);
  }

  // ── 2. Hash password ────────────────────────────────────────────────────
  console.log('🔐 Step 2: Hashing password...');
  const hashedPassword = await bcrypt.hash(OWNER_PASSWORD, 10);
  console.log('   ✅ Password hashed (bcrypt, 10 rounds)');

  // ── 3. Create owner user ────────────────────────────────────────────────
  console.log('👤 Step 3: Creating owner user...');

  const existingUser = await prisma.user.findFirst({
    where: { email: OWNER_EMAIL.toLowerCase() },
  });

  if (existingUser) {
    console.log(`   ⚠️  User "${OWNER_EMAIL}" already exists (id: ${existingUser.id})`);

    if (existingUser.role !== 'THEA_OWNER') {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { role: 'THEA_OWNER', password: hashedPassword },
      });
      console.log(`   ✅ Updated role to THEA_OWNER and reset password`);
    } else {
      // Update password anyway
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { password: hashedPassword },
      });
      console.log(`   ✅ Password reset for existing owner`);
    }
  } else {
    const user = await prisma.user.create({
      data: {
        email: OWNER_EMAIL.toLowerCase(),
        password: hashedPassword,
        firstName: 'Thea',
        lastName: 'Owner',
        displayName: 'Thea Owner',
        role: 'THEA_OWNER',
        tenantId: tenant.id,
        isActive: true,
        permissions: ['*'],
        platformAccessSam: true,
        platformAccessHealth: true,
        platformAccessEdrac: true,
        platformAccessCvision: true,
      },
    });
    console.log(`   ✅ Owner user created (id: ${user.id})`);
  }

  // ── 4. Create system settings record ────────────────────────────────────
  console.log('⚙️  Step 4: Setting owner_initialized flag...');

  // Use raw SQL since system_settings may not have a Prisma model
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "system_settings" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "key" TEXT UNIQUE NOT NULL,
        "value" JSONB DEFAULT 'true'::jsonb,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await prisma.$executeRawUnsafe(`
      INSERT INTO "system_settings" ("key", "value", "updatedAt")
      VALUES ('owner_initialized', 'true'::jsonb, NOW())
      ON CONFLICT ("key") DO UPDATE SET "value" = 'true'::jsonb, "updatedAt" = NOW()
    `);
    console.log('   ✅ owner_initialized = true');
  } catch (e) {
    console.log('   ⚠️  Could not set system_settings (non-critical):', (e as Error).message);
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(50));
  console.log('✅ Owner Account Ready!');
  console.log('═'.repeat(50));
  console.log(`   📧 Email:    ${OWNER_EMAIL}`);
  console.log(`   🔑 Password: ********** (from THEA_OWNER_PASSWORD)`);
  console.log(`   👑 Role:     thea-owner (THEA_OWNER)`);
  console.log(`   🏢 Tenant:   ${OWNER_TENANT_ID}`);
  console.log('═'.repeat(50));
  console.log('\n⚠️  غيّر الباسوورد بعد أول تسجيل دخول!\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
