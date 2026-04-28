/**
 * Create Thea Owner in PostgreSQL
 *
 * Usage:
 *   npx tsx scripts/create-owner-pg.ts
 */

import bcrypt from 'bcryptjs';

// Load env
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function createOwner() {
  // Dynamic import to ensure env is loaded first
  const { prisma } = await import('../lib/db/prisma');

  const email = process.env.THEA_OWNER_EMAIL || 'thea@thea.com.sa';
  const password = process.env.THEA_OWNER_PASSWORD;
  if (!password) {
    console.error('❌ THEA_OWNER_PASSWORD must be set in environment or .env.local');
    process.exit(1);
  }

  console.log(`\n🔧 Creating owner user: ${email}\n`);

  // Check if already exists
  const existing = await prisma.user.findFirst({
    where: { email: email.toLowerCase() },
  });

  if (existing) {
    console.log(`✅ Owner already exists: ${existing.email} (role: ${existing.role})`);
    process.exit(0);
  }

  // Hash password with bcrypt (salt rounds = 10)
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create owner user
  const owner = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName: 'Thea',
      lastName: 'Owner',
      role: 'thea-owner',
      isActive: true,
      tenantId: null, // Owner is global — no tenant
      groupId: null,
    },
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Owner created!`);
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Role:     thea-owner`);
  console.log(`   ID:       ${owner.id}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n⚠️  غيّر الباسورد بعد أول تسجيل دخول!');

  await prisma.$disconnect();
  process.exit(0);
}

createOwner().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
