/**
 * Profile save validation + API call logic.
 *
 * Extracted from the main page component to reduce file size.
 * These are pure async functions with no React dependencies.
 */

import type { ProfileSectionKey } from '@/lib/cvision/types';
import type { ProfileResponse } from './types';

// ── UUID validation regex ──
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Validation helpers ──

function validateEmploymentData(data: Record<string, any>): void {
  // Remove legacy 'jobTitle' field if exists (should use 'jobTitleId' instead)
  if (data.jobTitle !== undefined) {
    delete data.jobTitle;
  }

  // Remove empty strings and convert to null for optional UUID fields
  if (data.departmentId === '') data.departmentId = null;
  if (data.unitId === '') data.unitId = null;
  if (data.jobTitleId === '') data.jobTitleId = null;
  if (data.positionId === '') data.positionId = null;
  if (data.positionId === 'none') data.positionId = null;
  if (data.managerEmployeeId === '') data.managerEmployeeId = null;
  if (data.gradeId === '') data.gradeId = null;
  if (data.branchId === '' || data.branchId === 'none') data.branchId = null;
  if (data.workLocation === '') data.workLocation = null;

  // Log what we're sending for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log('[Profile Save] EMPLOYMENT data to send:', {
      positionId: data.positionId,
      departmentId: data.departmentId,
      jobTitleId: data.jobTitleId,
      fullData: data,
    });
  }

  // Validate UUID format if provided (allow empty/null values)
  const uuidFields: Array<{ key: string; label: string }> = [
    { key: 'departmentId', label: 'Department' },
    { key: 'jobTitleId', label: 'Job Title' },
    { key: 'positionId', label: 'Position' },
    { key: 'unitId', label: 'Unit' },
    { key: 'gradeId', label: 'Grade' },
  ];

  for (const { key, label } of uuidFields) {
    if (data[key] && data[key] !== '' && data[key] !== null && !UUID_REGEX.test(data[key])) {
      throw new Error(`Invalid ${label} ID format`);
    }
  }

  // Special message for job title
  if (data.jobTitleId && data.jobTitleId !== '' && data.jobTitleId !== null && !UUID_REGEX.test(data.jobTitleId)) {
    throw new Error('Invalid Job Title ID format. Please select a Job Title from the dropdown.');
  }

  // Special message for manager
  if (data.managerEmployeeId && data.managerEmployeeId !== '' && data.managerEmployeeId !== null && !UUID_REGEX.test(data.managerEmployeeId)) {
    throw new Error('Manager must be selected from the dropdown (invalid ID format)');
  }
}

function validatePersonalData(data: Record<string, any>): void {
  if (data.passportNumber) {
    const passportRegex = /^[A-Za-z0-9]{6,15}$/;
    if (!passportRegex.test(data.passportNumber)) {
      throw new Error('Passport number must be 6-15 alphanumeric characters');
    }
  }
  if (data.passportIssueDate && data.passportExpiryDate) {
    if (new Date(data.passportIssueDate) >= new Date(data.passportExpiryDate)) {
      throw new Error('Passport expiry date must be after issue date');
    }
  }
  if (data.idExpiryDate) {
    const expiry = new Date(data.idExpiryDate);
    if (isNaN(expiry.getTime())) {
      throw new Error('Invalid ID expiry date');
    }
  }
}

function validateContractData(data: Record<string, any>): void {
  if (data.contractType) {
    const validContractTypes = ['PERMANENT', 'FIXED_TERM', 'LOCUM', 'PART_TIME', 'INTERN'];
    if (!validContractTypes.includes(data.contractType)) {
      throw new Error(
        `Invalid contract type "${data.contractType}". Please select a valid contract type from the dropdown: ${validContractTypes.join(', ')}`,
      );
    }
  }

  if (data.startDate && data.endDate) {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    if (startDate > endDate) {
      throw new Error('Start date must be before or equal to end date');
    }
  }

  if (data.probationEndDate && data.endDate) {
    const probationDate = new Date(data.probationEndDate);
    const endDate = new Date(data.endDate);
    if (probationDate > endDate) {
      throw new Error('Probation end date must be before or equal to contract end date');
    }
  }
}

// ── Parse API error responses ──

function parseApiError(status: number, data: any, sectionKey: string): string {
  // 403 errors
  if (status === 403) {
    const errorCode = data.code || 'FORBIDDEN';
    if (errorCode === 'TERMINATED_ACCESS_BLOCKED') return 'Terminated employees cannot access this resource';
    if (errorCode === 'RESIGNED_READONLY') return 'Resigned employees have read-only access';
    if (errorCode === 'FORBIDDEN_SECTION') return `You do not have permission to edit ${sectionKey} section`;
    if (errorCode === 'FORBIDDEN_EMPLOYEE') return 'You can only edit your own profile';
    if (errorCode === 'FORBIDDEN_SCOPE') return 'You do not have access to employees in this department';
    return data.error || 'Access denied';
  }

  // 400 validation errors
  if (status === 400) {
    let errorMessage = data.error || data.message || 'Validation failed';

    if (data.details) {
      if (data.details.errors && Array.isArray(data.details.errors) && data.details.errors.length > 0) {
        const zodErrors = data.details.errors;
        const errorMessages = zodErrors.map((err: any) => {
          const fieldName = err.path?.join('.') || 'field';
          const fieldLabel =
            fieldName === 'departmentId' ? 'Department' :
            fieldName === 'jobTitleId' ? 'Job Title' :
            fieldName === 'managerEmployeeId' ? 'Manager' :
            fieldName === 'positionId' ? 'Position' :
            fieldName === 'gradeId' ? 'Grade' :
            fieldName;
          return `${fieldLabel}: ${err.message || 'Invalid value'}`;
        });
        errorMessage = errorMessages.join(', ');
      } else if (data.details.message) {
        errorMessage = data.details.message;
      } else if (typeof data.details === 'object') {
        const fieldErrors = Object.entries(data.details)
          .map(([field, message]) => {
            const fieldLabel =
              field === 'departmentId' ? 'Department' :
              field === 'jobTitleId' ? 'Job Title' :
              field === 'managerEmployeeId' ? 'Manager' :
              field === 'positionId' ? 'Position' :
              field === 'gradeId' ? 'Grade' :
              field;
            return `${fieldLabel}: ${message}`;
          });
        if (fieldErrors.length > 0) {
          errorMessage = fieldErrors.join(', ');
        }
      }
    }

    // Handle specific error codes
    if (data.code === 'JOB_TITLE_DEPARTMENT_MISMATCH') {
      errorMessage = 'The selected Job Title does not belong to the selected Department. Please select a Job Title that belongs to the Department.';
    } else if (data.code === 'INVALID_JOB_TITLE') {
      errorMessage = 'Invalid Job Title. Please select a Job Title from the dropdown.';
    } else if (data.code === 'INVALID_DEPARTMENT') {
      errorMessage = 'Invalid Department. Please select a Department from the dropdown.';
    }

    return errorMessage;
  }

  return data.error || data.message || 'Failed to save section';
}

// ── Main save function ──

export interface SaveSectionParams {
  employeeId: string;
  sectionKey: ProfileSectionKey;
  editData: Record<string, Record<string, any>>;
  changeReason: Record<string, string>;
}

/**
 * Validate and save a single profile section via the API.
 * Returns nothing on success; throws on failure.
 */
export async function saveSectionToApi({
  employeeId,
  sectionKey,
  editData,
  changeReason,
}: SaveSectionParams): Promise<void> {
  const dataToSend = { ...(editData[sectionKey] || {}) };

  // Section-specific validation
  if (sectionKey === 'EMPLOYMENT') validateEmploymentData(dataToSend);
  if (sectionKey === 'PERSONAL') validatePersonalData(dataToSend);
  if (sectionKey === 'CONTRACT') validateContractData(dataToSend);

  const res = await fetch(`/api/cvision/employees/${employeeId}/profile/${sectionKey}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      dataJson: dataToSend,
      changeReason: changeReason[sectionKey] || null,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(parseApiError(res.status, data, sectionKey));
  }

  // Trigger dashboard refresh event for EMPLOYMENT section changes
  if (sectionKey === 'EMPLOYMENT' && typeof window !== 'undefined') {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('cvision:refresh-dashboard'));
    }, 100);
  }

  // Sync document expiry dates with Muqeem records when PERSONAL section is saved
  if (sectionKey === 'PERSONAL') {
    const hasDocChanges = dataToSend.idExpiryDate || dataToSend.passportExpiryDate || dataToSend.passportNumber;
    if (hasDocChanges) {
      try {
        await fetch('/api/cvision/muqeem?action=sync-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            employeeId,
            iqamaExpiryDate: dataToSend.idExpiryDate || undefined,
            passportNumber: dataToSend.passportNumber || undefined,
            passportExpiryDate: dataToSend.passportExpiryDate || undefined,
          }),
        });
      } catch {
        // Muqeem sync is best-effort; don't block profile save on failure
      }
    }
  }
}

// ── Change detection ──

export function detectSectionChanges(
  sectionKey: ProfileSectionKey,
  editData: Record<string, Record<string, any>>,
  profile: ProfileResponse,
): boolean {
  const section = profile.sections[sectionKey];
  if (!section || !section.canEdit) return false;

  const sectionData = editData[sectionKey] || {};

  if (sectionKey === 'EMPLOYMENT') {
    const empData = sectionData;
    return (
      (empData.departmentId || null) !== (profile.employee?.departmentId || null) ||
      (empData.positionId || null) !== (profile.employee?.positionId || null) ||
      (empData.jobTitleId || null) !== (profile.employee?.jobTitleId || null) ||
      (empData.managerEmployeeId || null) !== (profile.employee?.managerEmployeeId || null) ||
      (empData.hiredAt || null) !== (profile.employee?.hiredAt || null) ||
      (empData.gradeId || null) !== (profile.employee?.gradeId || null) ||
      (empData.branchId || null) !== (profile.employee?.branchId || null) ||
      (empData.workLocation || null) !== (profile.employee?.workLocation || null)
    );
  }

  const originalData = section.dataJson || {};
  return Object.keys(sectionData).some(key => {
    const newValue = sectionData[key];
    const oldValue = originalData[key];
    return JSON.stringify(newValue) !== JSON.stringify(oldValue);
  });
}

export function hasAnyProfileChanges(
  editData: Record<string, Record<string, any>>,
  profile: ProfileResponse,
): boolean {
  const sections: ProfileSectionKey[] = ['PERSONAL', 'EMPLOYMENT', 'FINANCIAL', 'CONTRACT'];
  return sections.some(sk => detectSectionChanges(sk, editData, profile));
}

// ── Completeness calculation ──

export interface CompletenessResult {
  filled: number;
  total: number;
  percentage: number;
}

export function calculateCompleteness(
  profile: ProfileResponse,
  editData: Record<string, Record<string, any>>,
): CompletenessResult {
  let filled = 0;
  let total = 0;
  const sections: ProfileSectionKey[] = ['PERSONAL', 'EMPLOYMENT', 'FINANCIAL', 'CONTRACT'];

  for (const sk of sections) {
    const sec = profile.sections[sk];
    if (!sec?.schemaJson?.fields) continue;
    for (const field of sec.schemaJson.fields) {
      total++;
      const val = editData[sk]?.[field.key] ?? sec.dataJson?.[field.key];
      if (val !== null && val !== undefined && val !== '') filled++;
    }
  }

  // Also count root employee fields for EMPLOYMENT canonical values
  const empFields = ['departmentId', 'jobTitleId'] as const;
  for (const k of empFields) {
    const val = profile.employee[k];
    if (val && !total) { total++; filled++; }
  }

  // Count identity document fields toward completeness
  const personalData = editData.PERSONAL || profile.sections?.PERSONAL?.dataJson || {};
  const nat = personalData.nationality || personalData.nationalityCode || '';
  const isSaudiEmployee = (() => {
    if (!nat) return false;
    const n = (nat as string).toLowerCase().trim();
    return n === 'sa' || n === 'saudi' || n === 'saudi arabian' || n === 'saudi arabia';
  })();

  const sharedDocFields = ['idExpiryDate', 'passportNumber'] as const;
  for (const k of sharedDocFields) {
    total++;
    if (personalData[k]) filled++;
  }
  if (!isSaudiEmployee) {
    const extraDocFields = ['passportExpiryDate', 'visaNumber', 'visaExpiryDate'] as const;
    for (const k of extraDocFields) {
      total++;
      if (personalData[k]) filled++;
    }
  }

  return { filled, total, percentage: total > 0 ? Math.round((filled / total) * 100) : 0 };
}
