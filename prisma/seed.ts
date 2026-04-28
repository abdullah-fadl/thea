/**
 * Seed Script for Thea EHR
 *
 * Populates the database with default reference data required for a fresh
 * installation. Uses upsert operations so it is safe to run multiple times
 * (idempotent).
 *
 * Usage:
 *   npx prisma db seed          # Via Prisma hook
 *   npx tsx prisma/seed.ts       # Direct execution
 *
 * What gets seeded:
 *   1. System settings (locale, timezone, currency, etc.)
 *   2. Note: Departments and RoleDefinitions are tenant-scoped and should be
 *      seeded per-tenant via the admin UI or a tenant setup script.
 */

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Seed data definitions
// ---------------------------------------------------------------------------

/**
 * Default system settings.
 * These are global (not tenant-scoped) and configure the platform defaults.
 */
const systemSettings: Array<{ key: string; value: unknown; description: string }> = [
  {
    key: 'default_locale',
    value: 'ar',
    description: 'Default language / اللغة الافتراضية',
  },
  {
    key: 'default_timezone',
    value: 'Asia/Riyadh',
    description: 'Default timezone / المنطقة الزمنية',
  },
  {
    key: 'default_currency',
    value: 'SAR',
    description: 'Default currency / العملة',
  },
  {
    key: 'default_date_format',
    value: 'DD/MM/YYYY',
    description: 'Date format / صيغة التاريخ',
  },
  {
    key: 'patient_id_prefix',
    value: 'TH',
    description: 'Patient MRN prefix / بادئة رقم الملف الطبي',
  },
  {
    key: 'encounter_id_prefix',
    value: 'ENC',
    description: 'Encounter ID prefix / بادئة رقم الزيارة',
  },
  {
    key: 'followup_free_days',
    value: 14,
    description: 'Free follow-up period in days / فترة المتابعة المجانية بالأيام',
  },
  {
    key: 'sms_enabled',
    value: false,
    description: 'SMS reminders enabled / تفعيل تذكيرات الرسائل القصيرة',
  },
  {
    key: 'nphies_enabled',
    value: false,
    description: 'NPHIES integration enabled / تفعيل تكامل نفيس',
  },
];

/**
 * Default department templates.
 * These are used when creating departments for a new tenant. They are stored
 * as a system setting so the admin UI can read them as defaults.
 */
const departmentTemplates = [
  { nameAr: 'عيادة عامة', nameEn: 'General Clinic', code: 'GEN', type: 'OPD' },
  { nameAr: 'طوارئ', nameEn: 'Emergency', code: 'ER', type: 'ER' },
  { nameAr: 'صيدلية', nameEn: 'Pharmacy', code: 'PHAR', type: 'SUPPORT' },
  { nameAr: 'مختبر', nameEn: 'Laboratory', code: 'LAB', type: 'SUPPORT' },
  { nameAr: 'أشعة', nameEn: 'Radiology', code: 'RAD', type: 'SUPPORT' },
  { nameAr: 'عيادة أسنان', nameEn: 'Dental Clinic', code: 'DENT', type: 'OPD' },
  { nameAr: 'عيادة عيون', nameEn: 'Ophthalmology', code: 'OPH', type: 'OPD' },
  { nameAr: 'عيادة أطفال', nameEn: 'Pediatrics', code: 'PED', type: 'OPD' },
  { nameAr: 'عيادة نساء وولادة', nameEn: 'OB/GYN', code: 'OBGYN', type: 'OPD' },
  { nameAr: 'عيادة باطنية', nameEn: 'Internal Medicine', code: 'INT', type: 'OPD' },
  { nameAr: 'عيادة جراحة', nameEn: 'Surgery', code: 'SURG', type: 'OPD' },
  { nameAr: 'عيادة جلدية', nameEn: 'Dermatology', code: 'DERM', type: 'OPD' },
  { nameAr: 'تمريض', nameEn: 'Nursing', code: 'NURS', type: 'SUPPORT' },
  { nameAr: 'العناية المركزة', nameEn: 'ICU', code: 'ICU', type: 'IPD' },
  { nameAr: 'تنويم', nameEn: 'Inpatient', code: 'IPD', type: 'IPD' },
  { nameAr: 'غرفة العمليات', nameEn: 'Operating Room', code: 'OR', type: 'OR' },
  { nameAr: 'الطب النفسي', nameEn: 'Psychiatry', code: 'PSYCH', type: 'OPD' },
  { nameAr: 'العلاج الطبيعي', nameEn: 'Physiotherapy', code: 'PHYSIO', type: 'OPD' },
  { nameAr: 'التغذية', nameEn: 'Nutrition', code: 'NUTR', type: 'SUPPORT' },
  { nameAr: 'بنك الدم', nameEn: 'Blood Bank', code: 'BB', type: 'SUPPORT' },
  { nameAr: 'التعقيم المركزي', nameEn: 'CSSD', code: 'CSSD', type: 'SUPPORT' },
  { nameAr: 'علم الأمراض', nameEn: 'Pathology', code: 'PATH', type: 'SUPPORT' },
];

/**
 * Default role templates.
 * Stored as a system setting so the tenant setup process can create
 * RoleDefinition records from these templates.
 */
const roleTemplates = [
  {
    key: 'doctor',
    nameAr: 'طبيب',
    nameEn: 'Doctor',
    level: 'clinical',
    permissions: [
      'opd.visit.view', 'opd.visit.manage', 'opd.doctor-note.create',
      'opd.order.create', 'opd.order.view', 'er.encounter.view',
      'ipd.episode.view', 'patient.view', 'patient.edit',
    ],
  },
  {
    key: 'nurse',
    nameAr: 'ممرض/ة',
    nameEn: 'Nurse',
    level: 'clinical',
    permissions: [
      'opd.visit.view', 'opd.nursing-entry.create', 'opd.vitals.manage',
      'er.encounter.view', 'er.nursing-note.create', 'er.triage.manage',
      'ipd.episode.view', 'patient.view',
    ],
  },
  {
    key: 'receptionist',
    nameAr: 'موظف استقبال',
    nameEn: 'Receptionist',
    level: 'operational',
    permissions: [
      'opd.visit.view', 'opd.booking.create', 'opd.booking.manage',
      'er.encounter.create', 'patient.view', 'patient.register',
      'scheduling.view', 'scheduling.manage',
    ],
  },
  {
    key: 'pharmacist',
    nameAr: 'صيدلي',
    nameEn: 'Pharmacist',
    level: 'clinical',
    permissions: [
      'pharmacy.view', 'pharmacy.dispense', 'opd.order.view',
      'patient.view',
    ],
  },
  {
    key: 'lab_tech',
    nameAr: 'فني مختبر',
    nameEn: 'Lab Technician',
    level: 'clinical',
    permissions: [
      'lab.view', 'lab.result.create', 'lab.result.verify',
      'opd.order.view', 'patient.view',
    ],
  },
  {
    key: 'rad_tech',
    nameAr: 'فني أشعة',
    nameEn: 'Radiology Technician',
    level: 'clinical',
    permissions: [
      'radiology.view', 'radiology.report.create', 'radiology.report.verify',
      'opd.order.view', 'patient.view',
    ],
  },
  {
    key: 'admin',
    nameAr: 'مدير',
    nameEn: 'Administrator',
    level: 'admin',
    permissions: [
      'admin.users.manage', 'admin.settings.manage', 'admin.structure.manage',
      'admin.audit.view', 'admin.quotas.manage', 'admin.data.manage',
      'opd.visit.view', 'er.encounter.view', 'patient.view',
    ],
  },
  {
    key: 'billing',
    nameAr: 'موظف فوترة',
    nameEn: 'Billing Officer',
    level: 'operational',
    permissions: [
      'billing.view', 'billing.manage', 'billing.invoice.create',
      'patient.view', 'opd.visit.view',
    ],
  },
  {
    key: 'quality',
    nameAr: 'موظف جودة',
    nameEn: 'Quality Officer',
    level: 'admin',
    permissions: [
      'quality.view', 'quality.manage', 'admin.audit.view',
      'opd.visit.view', 'er.encounter.view', 'patient.view',
    ],
  },
  {
    key: 'surgeon',
    nameAr: 'جراح',
    nameEn: 'Surgeon',
    level: 'clinical',
    permissions: [
      'opd.visit.view', 'opd.visit.manage', 'opd.doctor-note.create',
      'opd.order.create', 'opd.order.view', 'or.case.view', 'or.case.manage',
      'ipd.episode.view', 'patient.view', 'patient.edit',
    ],
  },
  {
    key: 'anesthesiologist',
    nameAr: 'طبيب تخدير',
    nameEn: 'Anesthesiologist',
    level: 'clinical',
    permissions: [
      'or.case.view', 'or.case.manage', 'opd.visit.view',
      'opd.order.create', 'opd.order.view', 'ipd.episode.view',
      'patient.view', 'patient.edit',
    ],
  },
  {
    key: 'dietitian',
    nameAr: 'أخصائي تغذية',
    nameEn: 'Dietitian',
    level: 'clinical',
    permissions: [
      'opd.visit.view', 'ipd.episode.view', 'patient.view',
      'nutrition.view', 'nutrition.manage',
    ],
  },
];

// ---------------------------------------------------------------------------
// Seed logic
// ---------------------------------------------------------------------------

async function seedSystemSettings() {
  console.log('  Seeding system settings...');

  for (const setting of systemSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {}, // Don't overwrite if already exists
      create: {
        key: setting.key,
        value: setting.value as Prisma.InputJsonValue,
      },
    });
  }

  console.log(`  -> ${systemSettings.length} system settings seeded`);
}

async function seedDepartmentTemplates() {
  console.log('  Seeding department templates...');

  await prisma.systemSetting.upsert({
    where: { key: 'department_templates' },
    update: {
      value: departmentTemplates as unknown as Prisma.InputJsonValue,
    },
    create: {
      key: 'department_templates',
      value: departmentTemplates as unknown as Prisma.InputJsonValue,
    },
  });

  console.log(`  -> ${departmentTemplates.length} department templates stored`);
}

async function seedRoleTemplates() {
  console.log('  Seeding role templates...');

  await prisma.systemSetting.upsert({
    where: { key: 'role_templates' },
    update: {
      value: roleTemplates as unknown as Prisma.InputJsonValue,
    },
    create: {
      key: 'role_templates',
      value: roleTemplates as unknown as Prisma.InputJsonValue,
    },
  });

  console.log(`  -> ${roleTemplates.length} role templates stored`);
}

/**
 * Seed departments for a specific tenant (if tenantId is provided via CLI).
 * Usage: npx tsx prisma/seed.ts --tenant=<tenant-uuid>
 */
async function seedTenantDepartments(tenantUuid: string) {
  console.log(`  Seeding departments for tenant ${tenantUuid}...`);

  let seeded = 0;
  for (const dept of departmentTemplates) {
    // Use upsert on the unique constraint [tenantId, code]
    await prisma.department.upsert({
      where: {
        tenantId_code: {
          tenantId: tenantUuid,
          code: dept.code,
        },
      },
      update: {}, // Don't overwrite existing departments
      create: {
        tenantId: tenantUuid,
        name: dept.nameEn,
        code: dept.code,
        type: dept.type,
        isActive: true,
      },
    });
    seeded++;
  }

  console.log(`  -> ${seeded} departments seeded for tenant`);
}

/**
 * Seed role definitions for a specific tenant (if tenantId is provided via CLI).
 * Usage: npx tsx prisma/seed.ts --tenant=<tenant-uuid>
 */
async function seedTenantRoles(tenantUuid: string) {
  console.log(`  Seeding role definitions for tenant ${tenantUuid}...`);

  let seeded = 0;
  for (const role of roleTemplates) {
    await prisma.roleDefinition.upsert({
      where: {
        tenantId_key: {
          tenantId: tenantUuid,
          key: role.key,
        },
      },
      update: {}, // Don't overwrite existing role definitions
      create: {
        tenantId: tenantUuid,
        key: role.key,
        label: `${role.nameEn} / ${role.nameAr}`,
        permissions: role.permissions,
        isActive: true,
      },
    });
    seeded++;
  }

  console.log(`  -> ${seeded} role definitions seeded for tenant`);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

async function main() {
  console.log('');
  console.log('============================================================');
  console.log('  Thea EHR Database Seed');
  console.log('============================================================');
  console.log('');

  const startTime = Date.now();

  // 1. Always seed system-level settings (not tenant-scoped)
  await seedSystemSettings();
  await seedDepartmentTemplates();
  await seedRoleTemplates();

  // 2. Optionally seed tenant-specific data if --tenant flag is provided
  const tenantArg = process.argv.find((a) => a.startsWith('--tenant='));
  const tenantId = tenantArg?.split('=')[1];

  if (tenantId) {
    // Verify the tenant exists
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { id: tenantId },
          { tenantId: tenantId },
        ],
      },
    });

    if (!tenant) {
      console.error(`\n  Error: Tenant "${tenantId}" not found in the database.`);
      console.error('  Create the tenant first via the owner console.\n');
      process.exit(1);
    }

    // Use the UUID id for foreign key references
    await seedTenantDepartments(tenant.id);
    await seedTenantRoles(tenant.id);
  } else {
    console.log('');
    console.log('  Tip: Run with --tenant=<id> to also seed departments and roles');
    console.log('  for a specific tenant.');
  }

  const durationMs = Date.now() - startTime;
  const durationSec = (durationMs / 1000).toFixed(1);

  console.log('');
  console.log('============================================================');
  console.log(`  Seed complete (${durationSec}s)`);
  console.log('============================================================');
  console.log('');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
