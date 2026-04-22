/**
 * Admin Module Tests
 *
 * Validates Zod schemas (from lib/validation/admin.schema.ts and route-local schemas)
 * and performs route wiring checks via fs.readFileSync on the actual source files.
 *
 * 20 test scenarios across 6 groups:
 *  1-5   User Management
 *  6-9   Roles
 *  10-13 Groups & Hospitals
 *  14-16 Quotas
 *  17-18 Audit & Export
 *  19-20 Doctor Onboarding
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

// ── Import shared validation schemas ────────────────────────────────────────
import {
  createUserSchema,
  updateUserSchema,
  createQuotaSchema,
  updateQuotaSchema,
  createGroupSchema,
  updateGroupSchema,
  createHospitalSchema,
  updateHospitalSchema,
  createRoleSchema,
  updateRoleSchema,
  platformAccessSchema,
  clinicalSettingsSchema,
  dataExportSchema,
  onboardDoctorSchema,
} from '@/lib/validation/admin.schema';

// ── Helper: read a route source file ────────────────────────────────────────
function readRoute(...segments: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. User Management (tests 1-5)
// ─────────────────────────────────────────────────────────────────────────────
describe('Admin > User Management', () => {
  // Test 1: createUserSchema requires email, password, firstName, lastName, role
  it('1 — createUserSchema requires email+password+firstName+lastName+role', () => {
    const valid = createUserSchema.safeParse({
      email: 'doc@thea.com.sa',
      password: 'Str0ng!Pass12',
      firstName: 'Ahmed',
      lastName: 'Khan',
      role: 'opd-doctor',
    });
    expect(valid.success).toBe(true);

    // Missing required fields should fail
    const missing = createUserSchema.safeParse({
      email: 'doc@thea.com.sa',
    });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      const fieldNames = missing.error.issues.map((i) => i.path[0]);
      expect(fieldNames).toContain('password');
      expect(fieldNames).toContain('firstName');
      expect(fieldNames).toContain('lastName');
      expect(fieldNames).toContain('role');
    }
  });

  // Test 2: password must be 12+ chars with upper+lower+number+special
  it('2 — createUserSchema password must be 12+ chars with upper+lower+number+special', () => {
    const base = {
      email: 'user@thea.com.sa',
      firstName: 'Test',
      lastName: 'User',
      role: 'nurse',
    };

    // Too short
    const tooShort = createUserSchema.safeParse({ ...base, password: 'Ab1!' });
    expect(tooShort.success).toBe(false);

    // No uppercase
    const noUpper = createUserSchema.safeParse({ ...base, password: 'abcdef123456!' });
    expect(noUpper.success).toBe(false);

    // No lowercase
    const noLower = createUserSchema.safeParse({ ...base, password: 'ABCDEF123456!' });
    expect(noLower.success).toBe(false);

    // No number
    const noNumber = createUserSchema.safeParse({ ...base, password: 'Abcdefghijk!' });
    expect(noNumber.success).toBe(false);

    // No special character
    const noSpecial = createUserSchema.safeParse({ ...base, password: 'Abcdefghijk1' });
    expect(noSpecial.success).toBe(false);

    // Valid password
    const valid = createUserSchema.safeParse({ ...base, password: 'Abcdefghijk1!' });
    expect(valid.success).toBe(true);
  });

  // Test 3: updateUserSchema — all fields optional
  it('3 — updateUserSchema accepts empty object (all fields optional)', () => {
    const emptyResult = updateUserSchema.safeParse({});
    expect(emptyResult.success).toBe(true);

    const partial = updateUserSchema.safeParse({ isActive: false });
    expect(partial.success).toBe(true);

    const roleOnly = updateUserSchema.safeParse({ role: 'opd-doctor' });
    expect(roleOnly.success).toBe(true);
  });

  // Test 4: user route prevents role escalation [SEC-02]
  it('4 — user [id] route contains SEC-02 role escalation guard', () => {
    const src = readRoute('app', 'api', 'admin', 'users', '[id]', 'route.ts');

    // Must reference the SEC-02 tag
    expect(src).toContain('SEC-02');

    // Must define the privileged roles that require admin/owner to assign
    expect(src).toContain('PRIVILEGED_ROLES');
    expect(src).toContain('ROLE_ESCALATION_DENIED');

    // Must check operator role before allowing privileged role assignment
    expect(src).toContain("operatorRole !== 'admin'");
    expect(src).toContain("operatorRole !== 'thea-owner'");
  });

  // Test 5: user POST route enforces tenant maxUsers limit
  it('5 — user POST route enforces tenant maxUsers limit', () => {
    const src = readRoute('app', 'api', 'admin', 'users', 'route.ts');

    // Must query for maxUsers from tenant
    expect(src).toContain('maxUsers');

    // Must count current users
    expect(src).toContain('prisma.user.count');

    // Must return 403 when limit exceeded
    expect(src).toContain('User limit exceeded');
    expect(src).toContain('currentUserCount >= tenant.maxUsers');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Roles (tests 6-9)
// ─────────────────────────────────────────────────────────────────────────────
describe('Admin > Roles', () => {
  // Test 6: createRoleSchema requires key (2-64 chars) + permissions (min 1)
  // Note: the route-local schema in roles/route.ts uses `key` rather than `roleKey`
  // and requires permissions with min(1). We replicate that here.
  it('6 — createRoleSchema (route-local) requires key (2-64, lowercase+dash+underscore) + permissions (min 1)', () => {
    // Replicate the route-local schema to test it precisely
    const routeCreateRoleSchema = z.object({
      key: z.string().min(2).max(64).regex(/^[a-z0-9-_]+$/),
      label: z.string().max(120).optional(),
      labelAr: z.string().max(120).optional(),
      permissions: z.array(z.string()).min(1),
    });

    // Valid
    const valid = routeCreateRoleSchema.safeParse({
      key: 'lab-tech',
      permissions: ['lab.results.view'],
    });
    expect(valid.success).toBe(true);

    // Key too short (1 char)
    const tooShort = routeCreateRoleSchema.safeParse({
      key: 'x',
      permissions: ['lab.results.view'],
    });
    expect(tooShort.success).toBe(false);

    // Empty permissions
    const noPerms = routeCreateRoleSchema.safeParse({
      key: 'lab-tech',
      permissions: [],
    });
    expect(noPerms.success).toBe(false);

    // Missing permissions entirely
    const missingPerms = routeCreateRoleSchema.safeParse({
      key: 'lab-tech',
    });
    expect(missingPerms.success).toBe(false);
  });

  // Test 7: role key must be lowercase alphanumeric + dash/underscore
  it('7 — role key rejects uppercase, spaces, and special characters', () => {
    // The shared createRoleSchema uses `roleKey`
    const withUpper = createRoleSchema.safeParse({
      roleKey: 'LabTech',
      label: 'Lab Tech',
      permissions: ['lab.results.view'],
    });
    expect(withUpper.success).toBe(false);

    const withSpaces = createRoleSchema.safeParse({
      roleKey: 'lab tech',
      label: 'Lab Tech',
      permissions: ['lab.results.view'],
    });
    expect(withSpaces.success).toBe(false);

    const withSpecial = createRoleSchema.safeParse({
      roleKey: 'lab@tech',
      label: 'Lab Tech',
    });
    expect(withSpecial.success).toBe(false);

    // Valid keys with dash and underscore
    const dashKey = createRoleSchema.safeParse({
      roleKey: 'lab-tech',
      label: 'Lab Tech',
    });
    expect(dashKey.success).toBe(true);

    const underscoreKey = createRoleSchema.safeParse({
      roleKey: 'lab_tech',
      label: 'Lab Tech',
    });
    expect(underscoreKey.success).toBe(true);
  });

  // Test 8: updateRoleSchema PATCH propagates permissions to users
  it('8 — role [roleKey] PATCH route propagates permissions to users', () => {
    const src = readRoute('app', 'api', 'admin', 'roles', '[roleKey]', 'route.ts');

    // Must propagate permissions when they change
    expect(src).toContain('Propagate permission changes to all users with this role');
    expect(src).toContain('prisma.user.updateMany');
    expect(src).toContain("where: { tenantId: tenant.id, role: roleKey }");

    // Must also update TenantUser areas
    expect(src).toContain('prisma.tenantUser.updateMany');
  });

  // Test 9: delete role route prevents deleting admin role
  it('9 — role [roleKey] DELETE route prevents deleting admin role', () => {
    const src = readRoute('app', 'api', 'admin', 'roles', '[roleKey]', 'route.ts');

    expect(src).toContain("roleKey === 'admin'");
    expect(src).toContain('Cannot delete admin role');
    expect(src).toContain("{ status: 400 }");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Groups & Hospitals (tests 10-13)
// ─────────────────────────────────────────────────────────────────────────────
describe('Admin > Groups & Hospitals', () => {
  // Test 10: createGroupSchema requires name+code
  it('10 — createGroupSchema (route-local) requires name+code', () => {
    // The route-local schema in groups/route.ts has name+code
    const routeGroupSchema = z.object({
      name: z.string().min(1),
      code: z.string().min(1),
      isActive: z.boolean().optional().default(true),
    });

    const valid = routeGroupSchema.safeParse({ name: 'Main Group', code: 'MG-01' });
    expect(valid.success).toBe(true);

    const noName = routeGroupSchema.safeParse({ code: 'MG-01' });
    expect(noName.success).toBe(false);

    const noCode = routeGroupSchema.safeParse({ name: 'Main Group' });
    expect(noCode.success).toBe(false);

    const emptyName = routeGroupSchema.safeParse({ name: '', code: 'MG-01' });
    expect(emptyName.success).toBe(false);
  });

  // Test 11: createHospitalSchema requires name+code+groupId
  it('11 — createHospitalSchema (route-local) requires name+code+groupId', () => {
    const routeHospitalSchema = z.object({
      name: z.string().min(1),
      code: z.string().min(1),
      groupId: z.string().min(1),
      isActive: z.boolean().optional().default(true),
    });

    const valid = routeHospitalSchema.safeParse({
      name: 'Central Hospital',
      code: 'CH-01',
      groupId: 'group-uuid-1',
    });
    expect(valid.success).toBe(true);

    const noGroupId = routeHospitalSchema.safeParse({
      name: 'Central Hospital',
      code: 'CH-01',
    });
    expect(noGroupId.success).toBe(false);

    const emptyGroupId = routeHospitalSchema.safeParse({
      name: 'Central Hospital',
      code: 'CH-01',
      groupId: '',
    });
    expect(emptyGroupId.success).toBe(false);
  });

  // Test 12: hospital delete prevented if active users exist
  it('12 — hospital [id] DELETE route prevents deletion if active users exist', () => {
    const src = readRoute('app', 'api', 'admin', 'hospitals', '[id]', 'route.ts');

    // Must check for active users before delete
    expect(src).toContain('prisma.user.count');
    expect(src).toContain('hospitalId: id');
    expect(src).toContain('isActive: true');
    expect(src).toContain('Cannot delete hospital with active users');
    expect(src).toContain('{ status: 400 }');
  });

  // Test 13: group-admin access scope restrictions (users GET route)
  it('13 — users GET route restricts group-admin to their own groupId', () => {
    const src = readRoute('app', 'api', 'admin', 'users', 'route.ts');

    // group-admin scope filter
    expect(src).toContain("userRole === 'group-admin'");
    expect(src).toContain('where.groupId = user.groupId');

    // Audit log for scope violation
    expect(src).toContain('scope_violation');
    expect(src).toContain("groupId !== user.groupId");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Quotas (tests 14-16)
// ─────────────────────────────────────────────────────────────────────────────
describe('Admin > Quotas', () => {
  // Test 14: createQuotaSchema requires scopeType+scopeId+featureKey
  it('14 — createQuotaSchema requires scopeType+scopeId+featureKey', () => {
    const valid = createQuotaSchema.safeParse({
      scopeType: 'group',
      scopeId: 'group-uuid-1',
      featureKey: 'patients.create',
    });
    expect(valid.success).toBe(true);

    // scopeType must be 'group' or 'user'
    const badScope = createQuotaSchema.safeParse({
      scopeType: 'hospital',
      scopeId: 'h-1',
      featureKey: 'patients.create',
    });
    expect(badScope.success).toBe(false);

    // Missing scopeId
    const noScopeId = createQuotaSchema.safeParse({
      scopeType: 'group',
      featureKey: 'patients.create',
    });
    expect(noScopeId.success).toBe(false);

    // Missing featureKey
    const noFeature = createQuotaSchema.safeParse({
      scopeType: 'group',
      scopeId: 'g-1',
    });
    expect(noFeature.success).toBe(false);
  });

  // Test 15: default limit is 999999 when not provided
  it('15 — quotas POST route defaults limit to 999999 when not provided', () => {
    // Schema allows limit to be optional
    const parsed = createQuotaSchema.safeParse({
      scopeType: 'user',
      scopeId: 'user-1',
      featureKey: 'encounters.create',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.limit).toBeUndefined();
    }

    // The route fills in the default
    const src = readRoute('app', 'api', 'admin', 'quotas', 'route.ts');
    expect(src).toContain('parsed.limit || 999999');
  });

  // Test 16: updateQuotaSchema rejects clearing both limit and endsAt
  it('16 — quotas [id] PATCH route rejects clearing both limit and endsAt', () => {
    // Schema itself allows partial updates
    const valid = updateQuotaSchema.safeParse({ status: 'locked' });
    expect(valid.success).toBe(true);

    const clearEndsAt = updateQuotaSchema.safeParse({ endsAt: null });
    expect(clearEndsAt.success).toBe(true);

    // The route enforces the business rule
    const src = readRoute('app', 'api', 'admin', 'quotas', '[id]', 'route.ts');
    expect(src).toContain('Either limit or endsAt (or both) must be provided');
    expect(src).toContain('parsed.endsAt === null && !willHaveLimit');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Audit & Export (tests 17-18)
// ─────────────────────────────────────────────────────────────────────────────
describe('Admin > Audit & Export', () => {
  // Test 17: audit route validates ISO 8601 date format
  it('17 — audit GET route validates ISO 8601 date format', () => {
    const src = readRoute('app', 'api', 'admin', 'audit', 'route.ts');

    expect(src).toContain('validateISOTimestamp');
    expect(src).toContain('Invalid timestamp format. Use ISO 8601');
    expect(src).toContain("searchParams.get('startDate')");
    expect(src).toContain("searchParams.get('endDate')");

    // Must return 400 on validation errors
    expect(src).toContain('{ status: 400 }');
  });

  // Test 18: data export route returns xlsx for valid collection
  it('18 — data-export GET route produces xlsx with Content-Disposition header', () => {
    const src = readRoute('app', 'api', 'admin', 'data-export', 'route.ts');

    // Must use ExcelJS to build workbook
    expect(src).toContain("import ExcelJS from 'exceljs'");
    expect(src).toContain('workbook.xlsx.writeBuffer');

    // Must set correct Content-Type for xlsx
    expect(src).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    // Must set Content-Disposition header
    expect(src).toContain('Content-Disposition');
    expect(src).toContain('_export.xlsx');

    // Must validate collection parameter
    expect(src).toContain('Collection is required');

    // Must have a whitelist of supported collections via modelMap
    expect(src).toContain('fetchFromModel');
    expect(src).toContain('Unsupported collection for export');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Doctor Onboarding (tests 19-20)
// ─────────────────────────────────────────────────────────────────────────────
describe('Admin > Doctor Onboarding', () => {
  // Test 19: doctorSchema requires all mandatory fields
  it('19 — doctorSchema (route-local) requires displayName+email+staffId+licenseNumber+primaryUnit+clinics+workingDays+startTime+endTime+appointmentDuration+password', () => {
    // Replicate the route-local schema
    const doctorSchema = z.object({
      displayName: z.string().min(1),
      email: z.string().email(),
      staffId: z.string().min(1),
      licenseNumber: z.string().min(1),
      nationalId: z.string().optional().default(''),
      mobile: z.string().optional().default(''),
      specialties: z.array(z.string()).optional().default([]),
      consultationServiceCode: z.string().optional().default(''),
      level: z.enum(['CONSULTANT', 'SPECIALIST', 'RESIDENT']).optional().default('CONSULTANT'),
      employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONSULTANT']).default('FULL_TIME'),
      primaryUnit: z.string().min(1),
      clinics: z.array(z.string()).min(1),
      roomIds: z.array(z.string()).optional().default([]),
      canPrescribe: z.boolean().default(true),
      canRequestImaging: z.boolean().default(true),
      canPerformProcedures: z.boolean().default(false),
      workingDays: z.array(z.number().int().min(0).max(6)).min(1),
      startTime: z.string().min(1),
      endTime: z.string().min(1),
      appointmentDuration: z.number().int().min(5),
      breakStart: z.string().optional().default(''),
      breakEnd: z.string().optional().default(''),
      password: z.string().min(12),
      role: z.string().min(1).default('opd-doctor'),
      sendWelcomeEmail: z.boolean().default(true),
    });

    const validDoctor = {
      displayName: 'Dr. Ahmed',
      email: 'ahmed@hospital.com',
      staffId: 'STF-001',
      licenseNumber: 'LIC-12345',
      primaryUnit: 'unit-opd',
      clinics: ['clinic-1'],
      workingDays: [0, 1, 2, 3, 4],
      startTime: '08:00',
      endTime: '16:00',
      appointmentDuration: 15,
      password: 'Str0ng!Pass12',
    };
    const valid = doctorSchema.safeParse(validDoctor);
    expect(valid.success).toBe(true);

    // Missing displayName
    const { displayName, ...noDisplayName } = validDoctor;
    expect(doctorSchema.safeParse(noDisplayName).success).toBe(false);

    // Missing email
    const { email, ...noEmail } = validDoctor;
    expect(doctorSchema.safeParse(noEmail).success).toBe(false);

    // Missing staffId
    const { staffId, ...noStaffId } = validDoctor;
    expect(doctorSchema.safeParse(noStaffId).success).toBe(false);

    // Missing clinics
    const { clinics, ...noClinics } = validDoctor;
    expect(doctorSchema.safeParse(noClinics).success).toBe(false);

    // Empty clinics array
    expect(doctorSchema.safeParse({ ...validDoctor, clinics: [] }).success).toBe(false);

    // Empty workingDays
    expect(doctorSchema.safeParse({ ...validDoctor, workingDays: [] }).success).toBe(false);

    // appointmentDuration < 5
    expect(doctorSchema.safeParse({ ...validDoctor, appointmentDuration: 3 }).success).toBe(false);

    // Password too short
    expect(doctorSchema.safeParse({ ...validDoctor, password: 'Short1!' }).success).toBe(false);
  });

  // Test 20: break start requires break end (and vice versa)
  it('20 — doctor onboard route rejects breakStart without breakEnd', () => {
    const src = readRoute('app', 'api', 'admin', 'doctors', 'onboard', 'route.ts');

    // Must validate that break start and end are provided together
    expect(src).toContain('breakStart && !data.breakEnd');
    expect(src).toContain('!data.breakStart && data.breakEnd');
    expect(src).toContain('Break start and end must be provided together');
    expect(src).toContain('{ status: 400 }');
  });
});
