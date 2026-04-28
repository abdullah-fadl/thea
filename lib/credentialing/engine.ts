/**
 * Staff Credentialing & Privileging Engine
 *
 * Core business logic for managing staff credentials, clinical privileges,
 * expiry alerts, and practitioner readiness checks.
 *
 * Saudi-specific: SCFHS, DataFlow, SMLE, MOH credential types.
 */

import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CredentialType =
  | 'medical_license'
  | 'specialty_board'
  | 'bls'
  | 'acls'
  | 'pals'
  | 'nrp'
  | 'dea'
  | 'cme'
  | 'malpractice_insurance'
  | 'health_certificate'
  | 'dataflow_verification'
  | 'scfhs_classification'
  | 'nursing_license';

export type PrivilegeType =
  | 'admitting'
  | 'surgical'
  | 'procedural'
  | 'prescribing'
  | 'sedation'
  | 'laser'
  | 'radiology_ordering'
  | 'blood_transfusion'
  | 'ventilator_management'
  | 'central_line';

export type StaffCategory =
  | 'physician'
  | 'nurse'
  | 'pharmacist'
  | 'technician'
  | 'allied_health';

export type CredentialStatus =
  | 'active'
  | 'expired'
  | 'expiring_soon'
  | 'revoked'
  | 'pending_renewal'
  | 'pending_verification';

export type VerificationStatus = 'pending' | 'verified' | 'failed' | 'waived';

export type PrivilegeStatus =
  | 'active'
  | 'suspended'
  | 'revoked'
  | 'temporary'
  | 'probationary';

export type AlertType =
  | 'expiring_30d'
  | 'expiring_60d'
  | 'expiring_90d'
  | 'expired'
  | 'verification_needed'
  | 'review_due';

// Label maps for display
export const CREDENTIAL_TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  medical_license: { en: 'Medical License', ar: 'رخصة طبية' },
  specialty_board: { en: 'Specialty Board', ar: 'شهادة البورد' },
  bls: { en: 'BLS (Basic Life Support)', ar: 'الإنعاش القلبي الأساسي' },
  acls: { en: 'ACLS (Advanced Cardiac)', ar: 'الإنعاش القلبي المتقدم' },
  pals: { en: 'PALS (Pediatric ALS)', ar: 'إنعاش الأطفال المتقدم' },
  nrp: { en: 'NRP (Neonatal Resuscitation)', ar: 'إنعاش حديثي الولادة' },
  dea: { en: 'DEA Registration', ar: 'تسجيل DEA' },
  cme: { en: 'CME Credits', ar: 'ساعات التعليم المستمر' },
  malpractice_insurance: { en: 'Malpractice Insurance', ar: 'تأمين الأخطاء الطبية' },
  health_certificate: { en: 'Health Certificate', ar: 'الشهادة الصحية' },
  dataflow_verification: { en: 'DataFlow Verification', ar: 'التحقق من DataFlow' },
  scfhs_classification: { en: 'SCFHS Classification', ar: 'تصنيف الهيئة السعودية' },
  nursing_license: { en: 'Nursing License', ar: 'رخصة التمريض' },
};

export const PRIVILEGE_TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  admitting: { en: 'Admitting Privileges', ar: 'صلاحية القبول' },
  surgical: { en: 'Surgical Privileges', ar: 'صلاحية الجراحة' },
  procedural: { en: 'Procedural Privileges', ar: 'صلاحية الإجراءات' },
  prescribing: { en: 'Prescribing Privileges', ar: 'صلاحية الوصف' },
  sedation: { en: 'Sedation Privileges', ar: 'صلاحية التخدير' },
  laser: { en: 'Laser Privileges', ar: 'صلاحية الليزر' },
  radiology_ordering: { en: 'Radiology Ordering', ar: 'طلب الأشعة' },
  blood_transfusion: { en: 'Blood Transfusion', ar: 'نقل الدم' },
  ventilator_management: { en: 'Ventilator Management', ar: 'إدارة جهاز التنفس' },
  central_line: { en: 'Central Line', ar: 'القسطرة المركزية' },
};

export const CATEGORY_LABELS: Record<string, { en: string; ar: string }> = {
  physician: { en: 'Physician', ar: 'طبيب' },
  nurse: { en: 'Nurse', ar: 'ممرض/ة' },
  pharmacist: { en: 'Pharmacist', ar: 'صيدلي/ة' },
  technician: { en: 'Technician', ar: 'فني/ة' },
  allied_health: { en: 'Allied Health', ar: 'الصحة المساندة' },
};

export const ISSUING_AUTHORITIES: Record<string, { en: string; ar: string }> = {
  SCFHS: { en: 'Saudi Commission for Health Specialties (SCFHS)', ar: 'الهيئة السعودية للتخصصات الصحية' },
  MOH: { en: 'Ministry of Health (MOH)', ar: 'وزارة الصحة' },
  SMLE: { en: 'Saudi Medical Licensing Exam (SMLE)', ar: 'اختبار الرخصة الطبية السعودية' },
  AHA: { en: 'American Heart Association (AHA)', ar: 'جمعية القلب الأمريكية' },
  hospital: { en: 'Hospital Authority', ar: 'إدارة المستشفى' },
  dataflow: { en: 'DataFlow Group', ar: 'مجموعة داتافلو' },
};

// ---------------------------------------------------------------------------
// Required credentials per staff category
// ---------------------------------------------------------------------------

const REQUIRED_CREDENTIALS: Record<StaffCategory, CredentialType[]> = {
  physician: [
    'medical_license',
    'specialty_board',
    'bls',
    'malpractice_insurance',
    'health_certificate',
    'scfhs_classification',
  ],
  nurse: [
    'nursing_license',
    'bls',
    'health_certificate',
    'scfhs_classification',
  ],
  pharmacist: [
    'medical_license',
    'health_certificate',
    'scfhs_classification',
  ],
  technician: [
    'health_certificate',
    'scfhs_classification',
  ],
  allied_health: [
    'health_certificate',
    'scfhs_classification',
  ],
};

/**
 * Get required credential types for a staff category
 */
export function getRequiredCredentials(category: StaffCategory): CredentialType[] {
  return REQUIRED_CREDENTIALS[category] || REQUIRED_CREDENTIALS.allied_health;
}

// ---------------------------------------------------------------------------
// Credential CRUD & queries
// ---------------------------------------------------------------------------

/**
 * Get all credentials for a staff member
 */
export async function getStaffCredentials(userId: string, tenantId: string) {
  return prisma.staffCredential.findMany({
    where: { tenantId, userId },
    orderBy: { expiryDate: 'asc' },
    take: 100,
  });
}

/**
 * Get all clinical privileges for a staff member
 */
export async function getStaffPrivileges(userId: string, tenantId: string) {
  return prisma.clinicalPrivilege.findMany({
    where: { tenantId, userId },
    orderBy: { grantedAt: 'desc' },
    take: 100,
  });
}

// ---------------------------------------------------------------------------
// Status scanning
// ---------------------------------------------------------------------------

/**
 * Scan all credentials for a tenant and update statuses based on expiry dates.
 * Returns summary of changes.
 */
export async function checkCredentialStatus(tenantId: string) {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Find credentials that have expired
  const expiredCredentials = await prisma.staffCredential.findMany({
    where: {
      tenantId,
      expiryDate: { lt: now },
      status: { notIn: ['expired', 'revoked'] },
    },
    take: 500,
  });

  // Find credentials expiring within 30 days
  const expiringCredentials = await prisma.staffCredential.findMany({
    where: {
      tenantId,
      expiryDate: { gte: now, lte: thirtyDaysFromNow },
      status: { notIn: ['expired', 'revoked', 'expiring_soon'] },
    },
    take: 500,
  });

  // Update expired credentials
  let expiredCount = 0;
  for (const cred of expiredCredentials) {
    await prisma.staffCredential.update({
      where: { id: cred.id },
      data: { status: 'expired' },
    });
    expiredCount++;
  }

  // Update expiring-soon credentials
  let expiringCount = 0;
  for (const cred of expiringCredentials) {
    await prisma.staffCredential.update({
      where: { id: cred.id },
      data: { status: 'expiring_soon' },
    });
    expiringCount++;
  }

  return { expiredCount, expiringCount, scannedAt: now };
}

// ---------------------------------------------------------------------------
// Alert generation
// ---------------------------------------------------------------------------

/**
 * Generate expiry alerts for credentials expiring within 30, 60, and 90 days.
 * Avoids duplicate alerts by checking existing alerts.
 */
export async function generateExpiryAlerts(tenantId: string) {
  const now = new Date();
  const windows = [
    { days: 30, type: 'expiring_30d' as AlertType },
    { days: 60, type: 'expiring_60d' as AlertType },
    { days: 90, type: 'expiring_90d' as AlertType },
  ];

  let totalCreated = 0;

  for (const window of windows) {
    const futureDate = new Date(now.getTime() + window.days * 24 * 60 * 60 * 1000);

    const expiringCredentials = await prisma.staffCredential.findMany({
      where: {
        tenantId,
        expiryDate: { gte: now, lte: futureDate },
        status: { notIn: ['revoked'] },
      },
      take: 500,
    });

    for (const cred of expiringCredentials) {
      // Check if alert already exists
      const existing = await prisma.credentialAlert.findFirst({
        where: {
          tenantId,
          credentialId: cred.id,
          alertType: window.type,
        },
      });

      if (!existing) {
        const daysUntilExpiry = cred.expiryDate
          ? Math.ceil((cred.expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
          : 0;

        const typeLabel = CREDENTIAL_TYPE_LABELS[cred.credentialType]?.en || cred.credentialType;
        const typeLabelAr = CREDENTIAL_TYPE_LABELS[cred.credentialType]?.ar || cred.credentialType;

        await prisma.credentialAlert.create({
          data: {
            tenantId,
            credentialId: cred.id,
            userId: cred.userId,
            alertType: window.type,
            message: `${cred.staffName}'s ${typeLabel} expires in ${daysUntilExpiry} days`,
            messageAr: `${cred.staffNameAr || cred.staffName}: ${typeLabelAr} تنتهي خلال ${daysUntilExpiry} يوم`,
          },
        });
        totalCreated++;
      }
    }
  }

  // Also create alerts for already expired credentials
  const expiredCredentials = await prisma.staffCredential.findMany({
    where: {
      tenantId,
      expiryDate: { lt: now },
      status: { notIn: ['revoked'] },
    },
    take: 500,
  });

  for (const cred of expiredCredentials) {
    const existing = await prisma.credentialAlert.findFirst({
      where: {
        tenantId,
        credentialId: cred.id,
        alertType: 'expired',
      },
    });

    if (!existing) {
      const typeLabel = CREDENTIAL_TYPE_LABELS[cred.credentialType]?.en || cred.credentialType;
      const typeLabelAr = CREDENTIAL_TYPE_LABELS[cred.credentialType]?.ar || cred.credentialType;

      await prisma.credentialAlert.create({
        data: {
          tenantId,
          credentialId: cred.id,
          userId: cred.userId,
          alertType: 'expired',
          message: `${cred.staffName}'s ${typeLabel} has expired`,
          messageAr: `${cred.staffNameAr || cred.staffName}: ${typeLabelAr} منتهية الصلاحية`,
        },
      });
      totalCreated++;
    }
  }

  // Generate alerts for pending verifications
  const unverified = await prisma.staffCredential.findMany({
    where: {
      tenantId,
      verificationStatus: 'pending',
    },
    take: 500,
  });

  for (const cred of unverified) {
    const existing = await prisma.credentialAlert.findFirst({
      where: {
        tenantId,
        credentialId: cred.id,
        alertType: 'verification_needed',
      },
    });

    if (!existing) {
      const typeLabel = CREDENTIAL_TYPE_LABELS[cred.credentialType]?.en || cred.credentialType;
      const typeLabelAr = CREDENTIAL_TYPE_LABELS[cred.credentialType]?.ar || cred.credentialType;

      await prisma.credentialAlert.create({
        data: {
          tenantId,
          credentialId: cred.id,
          userId: cred.userId,
          alertType: 'verification_needed',
          message: `${cred.staffName}'s ${typeLabel} needs verification`,
          messageAr: `${cred.staffNameAr || cred.staffName}: ${typeLabelAr} تحتاج تحقق`,
        },
      });
      totalCreated++;
    }
  }

  return { totalCreated, scannedAt: now };
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Mark a credential as verified
 */
export async function verifyCredential(
  credentialId: string,
  verifiedBy: string,
  tenantId: string,
  userEmail?: string,
) {
  const credential = await prisma.staffCredential.findFirst({
    where: { id: credentialId, tenantId },
  });

  if (!credential) {
    return { error: 'Credential not found' };
  }

  const updated = await prisma.staffCredential.update({
    where: { id: credentialId },
    data: {
      verificationStatus: 'verified',
      verifiedBy,
      verifiedAt: new Date(),
    },
  });

  await createAuditLog(
    'staff_credential',
    credentialId,
    'VERIFY',
    verifiedBy,
    userEmail,
    { before: { verificationStatus: credential.verificationStatus }, after: { verificationStatus: 'verified' } },
    tenantId
  );

  return { success: true, credential: updated };
}

// ---------------------------------------------------------------------------
// Privilege management
// ---------------------------------------------------------------------------

interface GrantPrivilegeData {
  tenantId: string;
  userId: string;
  staffName: string;
  privilegeType: string;
  privilegeCode?: string;
  department?: string;
  grantedBy: string;
  grantedByName?: string;
  expiresAt?: Date;
  conditions?: string;
  supervisorId?: string;
  caseLogRequired?: number;
  notes?: string;
  status?: string;
}

/**
 * Grant a clinical privilege to a staff member
 */
export async function grantPrivilege(data: GrantPrivilegeData, userEmail?: string) {
  const privilege = await prisma.clinicalPrivilege.create({
    data: {
      tenantId: data.tenantId,
      userId: data.userId,
      staffName: data.staffName,
      privilegeType: data.privilegeType,
      privilegeCode: data.privilegeCode || null,
      department: data.department || null,
      status: data.status || 'active',
      grantedBy: data.grantedBy,
      grantedByName: data.grantedByName || null,
      expiresAt: data.expiresAt || null,
      conditions: data.conditions || null,
      supervisorId: data.supervisorId || null,
      caseLogRequired: data.caseLogRequired || null,
      notes: data.notes || null,
      nextReviewDate: data.expiresAt
        ? new Date(new Date(data.expiresAt).getTime() - 30 * 24 * 60 * 60 * 1000)
        : null,
    },
  });

  await createAuditLog(
    'clinical_privilege',
    privilege.id,
    'GRANT',
    data.grantedBy,
    userEmail,
    { after: privilege },
    data.tenantId
  );

  return privilege;
}

/**
 * Revoke a clinical privilege
 */
export async function revokePrivilege(
  privilegeId: string,
  reason: string,
  revokedBy: string,
  tenantId: string,
  userEmail?: string,
) {
  const existing = await prisma.clinicalPrivilege.findFirst({
    where: { id: privilegeId, tenantId },
  });

  if (!existing) {
    return { error: 'Privilege not found' };
  }

  const updated = await prisma.clinicalPrivilege.update({
    where: { id: privilegeId },
    data: {
      status: 'revoked',
      notes: reason,
    },
  });

  await createAuditLog(
    'clinical_privilege',
    privilegeId,
    'REVOKE',
    revokedBy,
    userEmail,
    { before: { status: existing.status }, after: { status: 'revoked', reason } },
    tenantId
  );

  return { success: true, privilege: updated };
}

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------

/**
 * Get dashboard KPIs for credentialing
 */
export async function getCredentialingDashboardStats(tenantId: string) {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    totalCredentials,
    activeCredentials,
    expiredCredentials,
    expiringCredentials,
    unverifiedCredentials,
    totalPrivileges,
    activePrivileges,
    suspendedPrivileges,
    unresolvedAlerts,
    staffWithCredentials,
  ] = await Promise.all([
    prisma.staffCredential.count({ where: { tenantId } }),
    prisma.staffCredential.count({ where: { tenantId, status: 'active' } }),
    prisma.staffCredential.count({ where: { tenantId, status: 'expired' } }),
    prisma.staffCredential.count({
      where: {
        tenantId,
        expiryDate: { gte: now, lte: thirtyDaysFromNow },
        status: { notIn: ['expired', 'revoked'] },
      },
    }),
    prisma.staffCredential.count({ where: { tenantId, verificationStatus: 'pending' } }),
    prisma.clinicalPrivilege.count({ where: { tenantId } }),
    prisma.clinicalPrivilege.count({ where: { tenantId, status: 'active' } }),
    prisma.clinicalPrivilege.count({ where: { tenantId, status: 'suspended' } }),
    prisma.credentialAlert.count({ where: { tenantId, isRead: false, isDismissed: false } }),
    prisma.staffCredential.groupBy({
      by: ['userId'],
      where: { tenantId },
      _count: true,
    }),
  ]);

  const totalStaff = staffWithCredentials.length;
  const complianceRate = totalCredentials > 0
    ? Math.round((activeCredentials / totalCredentials) * 100)
    : 100;

  return {
    totalStaff,
    totalCredentials,
    activeCredentials,
    expiredCredentials,
    expiringCredentials,
    unverifiedCredentials,
    complianceRate,
    totalPrivileges,
    activePrivileges,
    suspendedPrivileges,
    unresolvedAlerts,
  };
}

// ---------------------------------------------------------------------------
// Practitioner readiness check
// ---------------------------------------------------------------------------

interface ReadinessResult {
  ready: boolean;
  userId: string;
  staffName?: string;
  category?: string;
  missingCredentials: string[];
  expiredCredentials: string[];
  unverifiedCredentials: string[];
  activePrivileges: string[];
  issues: string[];
}

/**
 * Check if a practitioner has all required credentials active and verified.
 * Returns a go/no-go status that can be used at login or order-entry time.
 */
export async function checkPractitionerReady(
  userId: string,
  tenantId: string,
): Promise<ReadinessResult> {
  const credentials = await prisma.staffCredential.findMany({
    where: { tenantId, userId },
    take: 100,
  });

  const privileges = await prisma.clinicalPrivilege.findMany({
    where: { tenantId, userId, status: 'active' },
    take: 100,
  });

  if (credentials.length === 0) {
    return {
      ready: false,
      userId,
      missingCredentials: [],
      expiredCredentials: [],
      unverifiedCredentials: [],
      activePrivileges: [],
      issues: ['No credentials on file'],
    };
  }

  // Determine category from first credential
  const category = (credentials[0].category || 'allied_health') as StaffCategory;
  const staffName = credentials[0].staffName;
  const requiredTypes = getRequiredCredentials(category);

  const credentialsByType = new Map<string, typeof credentials[0]>();
  for (const cred of credentials) {
    // Keep the best (most recent / active) credential per type
    const existing = credentialsByType.get(cred.credentialType);
    if (!existing || cred.status === 'active') {
      credentialsByType.set(cred.credentialType, cred);
    }
  }

  const missingCredentials: string[] = [];
  const expiredCredentials: string[] = [];
  const unverifiedCredentials: string[] = [];
  const issues: string[] = [];

  for (const requiredType of requiredTypes) {
    const cred = credentialsByType.get(requiredType);
    const label = CREDENTIAL_TYPE_LABELS[requiredType]?.en || requiredType;

    if (!cred) {
      missingCredentials.push(requiredType);
      issues.push(`Missing: ${label}`);
    } else if (cred.status === 'expired') {
      expiredCredentials.push(requiredType);
      issues.push(`Expired: ${label}`);
    } else if (cred.verificationStatus === 'pending') {
      unverifiedCredentials.push(requiredType);
      issues.push(`Unverified: ${label}`);
    } else if (cred.verificationStatus === 'failed') {
      issues.push(`Verification failed: ${label}`);
    }
  }

  const ready =
    missingCredentials.length === 0 &&
    expiredCredentials.length === 0 &&
    issues.length === 0;

  return {
    ready,
    userId,
    staffName,
    category,
    missingCredentials,
    expiredCredentials,
    unverifiedCredentials,
    activePrivileges: privileges.map((p) => p.privilegeType),
    issues,
  };
}
