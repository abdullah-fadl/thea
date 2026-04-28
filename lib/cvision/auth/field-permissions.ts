/**
 * CVision Field-Level Permission Engine
 *
 * Controls which employee data fields each role can see/edit.
 * Integrates with the existing CVISION_ROLES system.
 *
 * Access levels:
 *   FULL     — read + write
 *   READ     — read only
 *   NONE     — hidden (field stripped from response)
 *   OWN_ONLY — can see/edit only when viewing own profile
 */

import { CVISION_ROLES, type CVisionRole, getCVisionRole } from '@/lib/cvision/roles';

// ─── Types ───────────────────────────────────────────────────

export type FieldAccess = 'FULL' | 'READ' | 'NONE' | 'OWN_ONLY';

export interface FieldPermission {
  field: string;
  /** Mapping from CVisionRole value → access level */
  access: Record<string, FieldAccess>;
}

// Shorthand aliases for the role values used in the permission table
const OW  = CVISION_ROLES.OWNER;          // 'owner'
const CA  = CVISION_ROLES.CVISION_ADMIN;  // 'cvision_admin'
const HA  = CVISION_ROLES.HR_ADMIN;       // 'hr_admin'
const HM  = CVISION_ROLES.HR_MANAGER;     // 'hr_manager'
const MG  = CVISION_ROLES.MANAGER;        // 'manager'
const EM  = CVISION_ROLES.EMPLOYEE;       // 'employee'
const AU  = CVISION_ROLES.AUDITOR;        // 'auditor'
const SO  = CVISION_ROLES.THEA_OWNER;     // 'thea-owner'
const CD  = CVISION_ROLES.CANDIDATE;      // 'candidate'

/** Build an access map for all roles from a compact tuple. Order: SO OW CA HA HM MG EM AU CD */
function perm(field: string, ...levels: [FieldAccess, FieldAccess, FieldAccess, FieldAccess, FieldAccess, FieldAccess, FieldAccess, FieldAccess, FieldAccess]): FieldPermission {
  return {
    field,
    access: {
      [SO]: levels[0], [OW]: levels[1], [CA]: levels[2], [HA]: levels[3],
      [HM]: levels[4], [MG]: levels[5], [EM]: levels[6], [AU]: levels[7], [CD]: levels[8],
    },
  };
}

// ─── Permission Table ────────────────────────────────────────
//                                                SO      OW      CA      HA      HM      MG       EM         AU      CD

export const EMPLOYEE_FIELD_PERMISSIONS: FieldPermission[] = [
  // Personal Information
  perm('firstName',                             'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'OWN_ONLY', 'READ', 'NONE'),
  perm('lastName',                              'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'OWN_ONLY', 'READ', 'NONE'),
  perm('fullName',                              'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'OWN_ONLY', 'READ', 'NONE'),
  perm('name',                                  'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'OWN_ONLY', 'READ', 'NONE'),
  perm('email',                                 'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'OWN_ONLY', 'READ', 'NONE'),
  perm('phone',                                 'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'OWN_ONLY', 'NONE', 'NONE'),
  perm('nationalId',                            'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'NONE', 'OWN_ONLY', 'NONE', 'NONE'),
  perm('dateOfBirth',                           'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'NONE', 'OWN_ONLY', 'NONE', 'NONE'),
  perm('maritalStatus',                         'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'NONE', 'OWN_ONLY', 'NONE', 'NONE'),
  perm('address',                               'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'NONE', 'OWN_ONLY', 'NONE', 'NONE'),
  perm('gender',                                'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'NONE', 'OWN_ONLY', 'NONE', 'NONE'),
  perm('nationality',                           'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'OWN_ONLY', 'READ', 'NONE'),

  // Employment Information (broadly visible)
  perm('department',                            'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'READ',     'READ', 'NONE'),
  perm('departmentId',                          'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'READ',     'READ', 'NONE'),
  perm('departmentName',                        'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'READ',     'READ', 'NONE'),
  perm('jobTitle',                              'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'READ',     'READ', 'NONE'),
  perm('jobTitleId',                            'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'READ',     'READ', 'NONE'),
  perm('positionId',                            'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'READ',     'READ', 'NONE'),
  perm('manager',                               'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'READ',     'READ', 'NONE'),
  perm('managerId',                             'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'READ',     'READ', 'NONE'),
  perm('hireDate',                              'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'READ',     'READ', 'NONE'),
  perm('hiredAt',                               'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'READ',     'READ', 'NONE'),
  perm('employmentType',                        'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'READ',     'READ', 'NONE'),
  perm('contractType',                          'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'READ',     'READ', 'NONE'),
  perm('status',                                'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'READ',     'READ', 'NONE'),
  perm('employeeNo',                            'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'READ',     'READ', 'NONE'),

  // Financial Information — MOST RESTRICTED
  perm('basicSalary',                           'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'NONE', 'OWN_ONLY', 'NONE', 'NONE'),
  perm('housingAllowance',                      'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'NONE', 'OWN_ONLY', 'NONE', 'NONE'),
  perm('transportAllowance',                    'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'NONE', 'OWN_ONLY', 'NONE', 'NONE'),
  perm('totalSalary',                           'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'NONE', 'OWN_ONLY', 'NONE', 'NONE'),
  perm('salary',                                'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'NONE', 'OWN_ONLY', 'NONE', 'NONE'),
  perm('bankName',                              'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'NONE', 'OWN_ONLY', 'NONE', 'NONE'),
  perm('iban',                                  'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'NONE', 'OWN_ONLY', 'NONE', 'NONE'),
  perm('bankAccountNumber',                     'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'NONE', 'OWN_ONLY', 'NONE', 'NONE'),

  // Documents — Sensitive
  perm('passportNumber',                        'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'NONE', 'OWN_ONLY', 'NONE', 'NONE'),
  perm('iqamaNumber',                           'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'NONE', 'OWN_ONLY', 'NONE', 'NONE'),
  perm('visaNumber',                            'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'NONE', 'OWN_ONLY', 'NONE', 'NONE'),
  perm('iqamaExpiry',                           'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'NONE', 'OWN_ONLY', 'NONE', 'NONE'),
  perm('passportExpiry',                        'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'NONE', 'OWN_ONLY', 'NONE', 'NONE'),

  // Performance — Managers can see their team
  perm('performanceScore',                      'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'OWN_ONLY', 'NONE', 'NONE'),
  perm('disciplinaryRecord',                    'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'OWN_ONLY', 'NONE', 'NONE'),
  perm('leaveBalance',                          'FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'READ', 'OWN_ONLY', 'NONE', 'NONE'),

  // Internal / System
  perm('id',                                    'READ', 'READ', 'READ', 'READ', 'READ', 'READ', 'READ',     'READ', 'NONE'),
  perm('tenantId',                              'READ', 'READ', 'READ', 'READ', 'READ', 'READ', 'READ',     'READ', 'NONE'),
  perm('createdAt',                             'READ', 'READ', 'READ', 'READ', 'READ', 'READ', 'READ',     'READ', 'NONE'),
  perm('updatedAt',                             'READ', 'READ', 'READ', 'READ', 'READ', 'READ', 'READ',     'READ', 'NONE'),
];

// Fast lookup index built once
const _fieldIndex = new Map<string, FieldPermission>();
for (const fp of EMPLOYEE_FIELD_PERMISSIONS) {
  _fieldIndex.set(fp.field, fp);
}

// ─── Core API ────────────────────────────────────────────────

/**
 * Get access level for a single field given a CVision role.
 * Fields not in the table are passed through (FULL) so unknown/new
 * fields aren't accidentally hidden — opt-in restriction.
 */
export function getFieldAccess(field: string, role: string): FieldAccess {
  const fp = _fieldIndex.get(field);
  if (!fp) return 'NONE'; // unknown fields restricted by default for security
  return fp.access[role] ?? 'NONE';
}

/**
 * Filter an employee record, stripping fields the viewer may not see.
 * Safe to call on any plain object. Non-destructive (returns a new object).
 */
export function filterEmployeeData(
  employee: Record<string, any>,
  viewerRole: string,
  isOwnProfile: boolean,
): Record<string, any> {
  const filtered: Record<string, any> = {};

  for (const [key, value] of Object.entries(employee)) {
    const access = getFieldAccess(key, viewerRole);

    if (access === 'FULL' || access === 'READ') {
      filtered[key] = value;
    } else if (access === 'OWN_ONLY' && isOwnProfile) {
      filtered[key] = value;
    }
    // 'NONE' → omitted
  }

  return filtered;
}

/**
 * Filter an array of employees (e.g. list endpoint).
 */
export function filterEmployeeList(
  employees: Record<string, any>[],
  viewerRole: string,
  viewerEmployeeId?: string,
): Record<string, any>[] {
  return employees.map(emp => {
    const empId = emp.id || emp.employeeId || emp._id?.toString();
    const isOwn = !!viewerEmployeeId && empId === viewerEmployeeId;
    return filterEmployeeData(emp, viewerRole, isOwn);
  });
}

/**
 * Check if the viewer can edit a specific field.
 */
export function canEditField(field: string, role: string, isOwnProfile: boolean): boolean {
  const access = getFieldAccess(field, role);
  if (access === 'FULL') return true;
  if (access === 'OWN_ONLY' && isOwnProfile) return true;
  return false;
}

/**
 * Return the list of fields visible to a role (useful for UI rendering).
 */
export function getVisibleFields(role: string, isOwnProfile: boolean): { field: string; canEdit: boolean }[] {
  return EMPLOYEE_FIELD_PERMISSIONS
    .filter(fp => {
      const a = fp.access[role] ?? 'NONE';
      return a === 'FULL' || a === 'READ' || (a === 'OWN_ONLY' && isOwnProfile);
    })
    .map(fp => ({
      field: fp.field,
      canEdit: canEditField(fp.field, role, isOwnProfile),
    }));
}

/**
 * Resolve the effective CVision role from a platform role string
 * and determine the right field-level role to use.
 */
export function resolveFieldRole(platformRole: string): string {
  return getCVisionRole(platformRole);
}

// ─── Page-Level Permissions ──────────────────────────────────

const _HR_PLUS: string[] = [SO, OW, CA, HA, HM];
const _MANAGER_PLUS: string[] = [..._HR_PLUS, MG];
const _EMP_PLUS: string[] = [..._MANAGER_PLUS, EM];
const _ALL_EXCEPT_CANDIDATE: string[] = [..._EMP_PLUS, AU];

export const PAGE_PERMISSIONS: Record<string, string[]> = {
  '/cvision':                _ALL_EXCEPT_CANDIDATE,
  '/cvision/employees':      [..._HR_PLUS, MG, AU],
  '/cvision/attendance':     _EMP_PLUS,
  '/cvision/recruitment':    _HR_PLUS,
  '/cvision/payroll':        _HR_PLUS,
  '/cvision/scheduling':     _MANAGER_PLUS,
  '/cvision/performance':    _MANAGER_PLUS,
  '/cvision/promotions':     _HR_PLUS,
  '/cvision/disciplinary':   _HR_PLUS,
  '/cvision/analytics':      _HR_PLUS,
  '/cvision/retention':      _HR_PLUS,
  '/cvision/reports':        _HR_PLUS,
  '/cvision/settings':       [SO, OW, CA],
  '/cvision/ai/skills':      _HR_PLUS,
  '/cvision/ai/governance':  [SO, OW, CA],
};

export function canAccessPage(page: string, role: string): boolean {
  const allowed = PAGE_PERMISSIONS[page];
  if (!allowed) return true; // unlisted pages → allowed
  return allowed.includes(role);
}
