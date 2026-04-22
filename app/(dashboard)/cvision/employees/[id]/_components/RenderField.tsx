'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionButton, CVisionInput, CVisionTextarea, CVisionSelect , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { COUNTRIES } from '@/lib/cvision/countries';
import { CONTRACT_TYPES } from '@/lib/cvision/constants';
import type { ProfileSectionKey, ProfileFieldDefinition } from '@/lib/cvision/types';
import type { ProfileResponse, ReferenceData } from './types';

// ── Context interface for all dependencies the renderField function needs ──

export interface RenderFieldContext {
  profile: ProfileResponse;
  editData: Record<string, Record<string, any>>;
  setEditData: React.Dispatch<React.SetStateAction<Record<string, Record<string, any>>>>;
  editingSection: ProfileSectionKey | null;
  referenceData: RenderFieldReferenceData;
  absherLookingUp: boolean;
  absherLookupDone: boolean;
  absherLookupError: string | null;
  handleAbsherLookup: (sectionKey: string, fieldKey: string) => void;
}

/** Extended reference data that includes branches */
export interface RenderFieldReferenceData extends ReferenceData {
  branches: Array<{ id: string; name: string; isHeadquarters?: boolean }>;
}

/**
 * Renders a profile form field based on its definition and section context.
 *
 * Extracted from the main EmployeeProfilePage to reduce file size.
 * This is a standalone function (not a component) so it can be passed as a
 * `renderField` prop to child card components that expect the signature:
 *   (field, sectionKey, value, disabled) => ReactNode
 */
export function createRenderField(ctx: RenderFieldContext) {
  const {
    profile,
    editData,
    setEditData,
    referenceData,
    absherLookingUp,
    absherLookupDone,
    absherLookupError,
    handleAbsherLookup,
  } = ctx;

  const {
    departments,
    jobTitles,
    positions,
    employees,
    units,
    grades,
    branches,
  } = referenceData;

  return function renderField(
    field: ProfileFieldDefinition,
    sectionKey: ProfileSectionKey,
    value: unknown,
    disabled: boolean = false,
  ): React.ReactNode {
    return (
      <RenderFieldInner
        field={field}
        sectionKey={sectionKey}
        value={value}
        disabled={disabled}
        profile={profile}
        editData={editData}
        setEditData={setEditData}
        departments={departments}
        jobTitles={jobTitles}
        positions={positions}
        employees={employees}
        units={units}
        grades={grades}
        branches={branches}
        absherLookingUp={absherLookingUp}
        absherLookupDone={absherLookupDone}
        absherLookupError={absherLookupError}
        handleAbsherLookup={handleAbsherLookup}
      />
    );
  };
}

// ── Inner component that uses hooks (C, isDark, tr) ──

interface RenderFieldInnerProps {
  field: ProfileFieldDefinition;
  sectionKey: ProfileSectionKey;
  value: unknown;
  disabled: boolean;
  profile: ProfileResponse;
  editData: Record<string, Record<string, unknown>>;
  setEditData: React.Dispatch<React.SetStateAction<Record<string, Record<string, unknown>>>>;
  departments: ReferenceData['departments'];
  jobTitles: ReferenceData['jobTitles'];
  positions: ReferenceData['positions'];
  employees: ReferenceData['employees'];
  units: ReferenceData['units'];
  grades: ReferenceData['grades'];
  branches: Array<{ id: string; name: string; isHeadquarters?: boolean }>;
  absherLookingUp: boolean;
  absherLookupDone: boolean;
  absherLookupError: string | null;
  handleAbsherLookup: (sectionKey: string, fieldKey: string) => void;
}

function RenderFieldInner({
  field,
  sectionKey,
  value,
  disabled,
  profile,
  editData,
  setEditData,
  departments,
  jobTitles,
  positions,
  employees,
  units,
  grades,
  branches,
  absherLookingUp,
  absherLookupDone,
  absherLookupError,
  handleAbsherLookup,
}: RenderFieldInnerProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  // ── Helper: update editData for this section ──
  function updateField(updates: Record<string, any>) {
    setEditData((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        ...updates,
      },
    }));
  }

  function setFieldValue(key: string, val: unknown) {
    setEditData((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        [key]: val,
      },
    }));
  }

  // ──────────────────────────────────────────────────────
  // CRITICAL: Force jobTitleId to use Select dropdown regardless of schema type
  // ──────────────────────────────────────────────────────
  const isJobTitleField = field.key === 'jobTitleId' || field.key === 'jobTitle' || field.label?.toLowerCase().includes('job title');

  if (sectionKey === 'EMPLOYMENT' && isJobTitleField) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Profile] Rendering jobTitleId dropdown:', {
        fieldKey: field.key,
        fieldLabel: field.label,
        fieldType: field.type,
        sectionKey,
        value,
        editDataValue: editData[sectionKey]?.[field.key],
        isJobTitleField,
      });
    }

    // Handle both 'jobTitle' and 'jobTitleId' field keys
    const rawFieldValue =
      editData[sectionKey]?.[field.key] ??
      editData[sectionKey]?.jobTitleId ??
      editData[sectionKey]?.jobTitle ??
      value;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidUUID = rawFieldValue && typeof rawFieldValue === 'string' && uuidRegex.test(rawFieldValue.trim());
    const selectValue = isValidUUID ? rawFieldValue.trim() : '';

    // If we have an invalid value (like 'RN'), clear it
    if (rawFieldValue && !isValidUUID && field.key === 'jobTitle') {
      if (editData[sectionKey] && editData[sectionKey][field.key]) {
        const updates: Record<string, unknown> = { ...editData[sectionKey] };
        delete updates[field.key];
        delete updates.jobTitle;
        updates.jobTitleId = null;
        setEditData((prev) => ({ ...prev, [sectionKey]: updates }));
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[Profile] jobTitleId dropdown state:', {
        fieldKey: field.key,
        rawFieldValue,
        selectValue,
        isValidUUID,
        jobTitlesCount: jobTitles.length,
        jobTitles: jobTitles.map((jt) => ({ id: jt.id, name: jt.name, code: jt.code })),
      });
    }

    return (
      <CVisionSelect
                C={C}
                value={selectValue}
                onChange={(val) => {
          const updates: Record<string, unknown> = { ...editData[sectionKey] };
          updates.jobTitleId = val;
          delete updates.jobTitle;
          updates.gradeId = null;
          setEditData((prev) => ({ ...prev, [sectionKey]: updates }));
        }}
                placeholder={tr('اختر المسمى الوظيفي', 'Select job title')}
                options={[...(Array.isArray(jobTitles) && jobTitles.length > 0 ?
            jobTitles.map((job) => (
              ({ value: job.id, label: `${job.name}${job.code ? ` (${job.code})` : ''}` })
            )) : [])]}
                disabled={disabled}
              />
    );
  }

  // ──────────────────────────────────────────────────────
  // CRITICAL: Force contractType to use Select dropdown
  // ──────────────────────────────────────────────────────
  if (sectionKey === 'CONTRACT' && field.key === 'contractType') {
    const validContractTypes = CONTRACT_TYPES.map(t => t.value) as string[];
    const rawFieldValue = editData[sectionKey]?.[field.key] ?? value;
    const safeValue = rawFieldValue && validContractTypes.includes(rawFieldValue as string) ? rawFieldValue : '';

    return (
      <CVisionSelect
                C={C}
                value={safeValue as string}
                onChange={(v) => {
          if (validContractTypes.includes(v as string)) {
            setFieldValue('contractType', v);
          } else {
            setFieldValue('contractType', null);
          }
        }}
                placeholder={tr('اختر نوع العقد', 'Select contract type')}
                options={[...CONTRACT_TYPES.map((x) => (
            ({ value: x.value, label: x.label })
          ))]}
                disabled={disabled}
              />
    );
  }

  // ── Get field value from editData first, then fallback to original value ──
  const rawFieldValue = editData[sectionKey]?.[field.key] ?? value;

  let fieldValue: any = rawFieldValue;
  if (sectionKey === 'EMPLOYMENT') {
    if (field.key === 'departmentId' || field.key === 'positionId' || field.key === 'jobTitleId') {
      if (rawFieldValue && typeof rawFieldValue === 'string') {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(rawFieldValue.trim())) {
          fieldValue = null;
        } else {
          fieldValue = rawFieldValue.trim();
        }
      } else {
        fieldValue = rawFieldValue || null;
      }
    } else {
      fieldValue = rawFieldValue ?? '';
    }
  } else {
    fieldValue = rawFieldValue ?? '';
  }

  // ── Switch on field type ──
  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
      // CONTRACT: contractType MUST use Select even when schema says text
      if (sectionKey === 'CONTRACT' && field.key === 'contractType') {
        const validContractTypes = CONTRACT_TYPES.map(t => t.value) as string[];
        const safeValue = fieldValue && validContractTypes.includes(fieldValue as string) ? fieldValue : '';
        return (
          <CVisionSelect
                C={C}
                value={safeValue as string}
                onChange={(v) => {
              if (validContractTypes.includes(v as string)) {
                setFieldValue('contractType', v);
              } else {
                setFieldValue('contractType', null);
              }
            }}
                placeholder={tr('اختر نوع العقد', 'Select contract type')}
                options={[...CONTRACT_TYPES.map((x) => (
                ({ value: x.value, label: x.label })
              ))]}
                disabled={disabled}
              />
        );
      }

      // EMPLOYMENT: departmentId
      if (sectionKey === 'EMPLOYMENT' && field.key === 'departmentId') {
        const selectValue = fieldValue && typeof fieldValue === 'string' && fieldValue.trim() !== '' ? fieldValue : '';
        return (
          <CVisionSelect
                C={C}
                value={selectValue}
                onChange={(v) => {
              updateField({ [field.key]: v, unitId: null, jobTitleId: null, gradeId: null, positionId: null });
            }}
                placeholder={tr('اختر القسم', 'Select department')}
                options={[...(Array.isArray(departments) && departments.length > 0 ?
                departments.map((d) => (
                  ({ value: d.id, label: `${d.name}${d.code ? ` (${d.code})` : ''}` })
                )) : [])]}
                disabled={disabled}
              />
        );
      }

      // EMPLOYMENT: jobTitleId (text schema fallback)
      if (sectionKey === 'EMPLOYMENT' && field.key === 'jobTitleId') {
        const selectValue = fieldValue && typeof fieldValue === 'string' && fieldValue.trim() !== '' ? fieldValue : '';
        return (
          <CVisionSelect
                C={C}
                value={selectValue}
                onChange={(val) => {
              updateField({ [field.key]: val, gradeId: null });
            }}
                placeholder={tr('اختر المسمى الوظيفي', 'Select job title')}
                options={[...(Array.isArray(jobTitles) && jobTitles.length > 0 ?
                jobTitles.map((job) => (
                  ({ value: job.id, label: `${job.name}${job.code ? ` (${job.code})` : ''}` })
                )) : [])]}
                disabled={disabled}
              />
        );
      }

      // EMPLOYMENT: positionId
      if (sectionKey === 'EMPLOYMENT' && field.key === 'positionId') {
        const dependsOnValue = editData[sectionKey]?.departmentId || profile?.employee?.departmentId;
        const selectValue = fieldValue && typeof fieldValue === 'string' && fieldValue.trim() !== '' ? fieldValue : '';
        return (
          <CVisionSelect
                C={C}
                value={selectValue}
                onChange={(v) => setFieldValue(field.key, v)}
                placeholder={dependsOnValue ? tr('اختر المنصب', 'Select position') : tr('اختر القسم أولاً', 'Select department first')}
                options={[...(Array.isArray(positions) && positions.length > 0 ?
                positions.map((p) => (
                  ({ value: p.id, label: (p as any).jobTitleName as string || p.title || p.positionCode })
                )) : [])]}
                disabled={disabled || !dependsOnValue}
              />
        );
      }

      // EMPLOYMENT: managerEmployeeId
      if (sectionKey === 'EMPLOYMENT' && field.key === 'managerEmployeeId') {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const safeValue = fieldValue && typeof fieldValue === 'string' && uuidRegex.test(fieldValue) ? fieldValue : 'none';
        return (
          <CVisionSelect
                C={C}
                value={safeValue}
                onChange={(val) => setFieldValue(field.key, val === 'none' ? null : val)}
                placeholder={tr('اختر المدير', 'Select manager')}
                options={[{ value: 'none', label: tr('بدون', 'None') }, ...(Array.isArray(employees) && employees.length > 0 ?
                employees.map((emp) => (
                  ({ value: emp.id, label: `${emp.firstName} ${emp.lastName}` })
                )) : [])]}
                disabled={disabled}
              />
        );
      }

      // EMPLOYMENT: branchId
      if (sectionKey === 'EMPLOYMENT' && field.key === 'branchId') {
        const safeValue = fieldValue && typeof fieldValue === 'string' && fieldValue.trim() !== '' ? fieldValue : 'none';
        return (
          <CVisionSelect
                C={C}
                value={safeValue}
                onChange={(val) => {
              setFieldValue('branchId', val === 'none' ? null : val);
            }}
                placeholder={tr('اختر الفرع', 'Select branch')}
                options={[{ value: 'none', label: tr('بدون', 'None') }, ...Array.isArray(branches) && branches.map((b) => (
                ({ value: b.id, label: `${b.name}${b.isHeadquarters ? ' (HQ)' : ''}` })
              ))]}
                disabled={disabled}
              />
        );
      }

      // PERSONAL: nationality
      if (sectionKey === 'PERSONAL' && field.key === 'nationality') {
        return (
          <CVisionSelect
                C={C}
                value={(fieldValue as string) || ''}
                onChange={(v) => setFieldValue('nationality', v)}
                placeholder={tr('اختر الدولة', 'Select country')}
                options={[...COUNTRIES.map((c) => (
                ({ value: c, label: c })
              ))]}
                disabled={disabled}
              />
        );
      }

      // PERSONAL: National ID with Absher lookup
      if (sectionKey === 'PERSONAL' && (field.key === 'nationalId' || field.key === 'nationalID')) {
        return (
          <div style={{ display: 'flex', gap: 8 }}>
            <CVisionInput
              C={C}
              type="text"
              value={fieldValue || ''}
              disabled={disabled}
              placeholder="1XXXXXXXXX"
              style={{ flex: 1 }}
              onChange={(e) => {
                setFieldValue(field.key, e.target.value);
                // Reset lookup state handled by parent
              }}
            />
            <CVisionButton
              C={C}
              isDark={isDark}
              type="button"
              variant={absherLookupDone ? 'outline' : 'default'}
              size="sm"
              style={{ height: 36, paddingLeft: 12, paddingRight: 12 }}
              disabled={disabled || absherLookingUp || !(editData[sectionKey]?.[field.key] || fieldValue)}
              onClick={() => handleAbsherLookup(sectionKey, field.key)}
            >
              {absherLookingUp ? (
                <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite' }} />
              ) : absherLookupDone ? (
                <>{tr('تم التحقق', 'Verified')}</>
              ) : (
                <>{tr('بحث', 'Lookup')}</>
              )}
            </CVisionButton>
          </div>
        );
      }

      // Default text/email/phone input
      return (
        <CVisionInput
          C={C}
          type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
          value={fieldValue}
          disabled={disabled}
          onChange={(e) => setFieldValue(field.key, e.target.value)}
        />
      );

    case 'textarea':
      return (
        <CVisionTextarea
          C={C}
          value={fieldValue}
          disabled={disabled}
          onChange={(e) => setFieldValue(field.key, e.target.value)}
          rows={3}
        />
      );

    case 'number':
      return (
        <CVisionInput
          C={C}
          type="number"
          value={fieldValue}
          disabled={disabled}
          onChange={(e) => setFieldValue(field.key, parseFloat(e.target.value) || 0)}
        />
      );

    case 'date':
      return (
        <CVisionInput
          C={C}
          type="date"
          value={fieldValue ? new Date(fieldValue).toISOString().split('T')[0] : ''}
          disabled={disabled}
          onChange={(e) => setFieldValue(field.key, e.target.value)}
        />
      );

    case 'json':
      return (
        <CVisionTextarea
          C={C}
          value={
            typeof fieldValue === 'string'
              ? fieldValue
              : fieldValue !== null && fieldValue !== undefined
                ? JSON.stringify(fieldValue, null, 2)
                : ''
          }
          disabled={disabled}
          onChange={(e) => {
            try {
              const parsed = e.target.value.trim() ? JSON.parse(e.target.value) : null;
              setFieldValue(field.key, parsed);
            } catch {
              setFieldValue(field.key, e.target.value);
            }
          }}
          rows={6}
          style={{ fontFamily: 'monospace', fontSize: 13 }}
          placeholder='{"key": "value"}'
        />
      );

    case 'select':
      // jobTitleId
      if (sectionKey === 'EMPLOYMENT' && field.key === 'jobTitleId') {
        const selectValue = fieldValue && typeof fieldValue === 'string' && fieldValue.trim() !== '' ? fieldValue : '';
        return (
          <CVisionSelect
                C={C}
                value={selectValue}
                onChange={(val) => updateField({ [field.key]: val, gradeId: null })}
                placeholder={tr('اختر المسمى الوظيفي', 'Select job title')}
                options={[...(Array.isArray(jobTitles) && jobTitles.length > 0 ?
                jobTitles.map((job) => (
                  ({ value: job.id, label: `${job.name}${job.code ? ` (${job.code})` : ''}` })
                )) : [])]}
                disabled={disabled}
              />
        );
      }

      // departmentId
      if (field.source === 'departments' || field.key === 'departmentId') {
        const selectValue = fieldValue && typeof fieldValue === 'string' && fieldValue.trim() !== '' ? fieldValue : '';
        return (
          <CVisionSelect
                C={C}
                value={selectValue}
                onChange={(v) => {
              const updates: Record<string, any> = { [field.key]: v };
              if (field.key === 'departmentId') {
                updates.jobTitleId = null;
                updates.gradeId = null;
                updates.positionId = null;
              }
              updateField(updates);
            }}
                placeholder={tr('اختر القسم', 'Select department')}
                options={[...(Array.isArray(departments) && departments.length > 0 ?
                departments.map((d) => (
                  ({ value: d.id, label: `${d.name}${d.code ? ` (${d.code})` : ''}` })
                )) : [])]}
                disabled={disabled}
              />
        );
      }

      // positionId
      if (field.source === 'departmentPositions' || field.key === 'positionId') {
        const dependsOnValue = field.dependsOn
          ? (editData[sectionKey]?.[field.dependsOn] || profile?.employee?.[field.dependsOn as keyof typeof profile.employee])
          : (editData[sectionKey]?.departmentId || profile?.employee.departmentId);
        const selectValue = fieldValue && typeof fieldValue === 'string' && fieldValue.trim() !== '' ? fieldValue : '';
        return (
          <CVisionSelect
                C={C}
                value={selectValue}
                onChange={(v) => setFieldValue(field.key, v)}
                placeholder={dependsOnValue ? tr('اختر المنصب', 'Select position') : tr('اختر القسم أولاً', 'Select department first')}
                options={[...(Array.isArray(positions) && positions.length > 0 ?
                positions.map((p) => (
                  ({ value: p.id, label: (p as any).jobTitleName as string || p.title || p.positionCode })
                )) : [])]}
                disabled={disabled || !dependsOnValue}
              />
        );
      }

      // unitId
      if (field.key === 'unitId') {
        const hasDept = !!(editData[sectionKey]?.departmentId || profile?.employee?.departmentId);
        return (
          <CVisionSelect
                C={C}
                value={fieldValue || ''}
                onChange={(val) => updateField({ [field.key]: val, positionId: null, jobTitleId: null })}
                placeholder={hasDept ? tr('اختر الوحدة', 'Select unit') : tr('اختر القسم أولاً', 'Select department first')}
                options={[...(Array.isArray(units) && units.length > 0 ?
                units.map((unit) => (
                  ({ value: unit.id, label: unit.name })
                )) : [])]}
                disabled={disabled || !hasDept}
              />
        );
      }

      // gradeId
      if (field.key === 'gradeId') {
        const jobTitleId = editData[sectionKey]?.jobTitleId || profile?.employee?.jobTitleId;
        const selectValue = fieldValue && typeof fieldValue === 'string' && fieldValue.trim() !== '' ? fieldValue : '';
        return (
          <CVisionSelect
                C={C}
                value={selectValue}
                onChange={(val) => setFieldValue(field.key, val)}
                placeholder={jobTitleId ? tr('اختر الدرجة (اختياري)', 'Select grade (optional)') : tr('اختر المسمى الوظيفي أولاً', 'Select job title first')}
                options={[...(Array.isArray(grades) && grades.length > 0 ?
                grades.map((grade) => (
                  ({ value: grade.id, label: `${grade.name}${grade.code ? ` (${grade.code})` : ''}${grade.level ? ` - Level ${grade.level}` : ''}` })
                )) : [])]}
                disabled={disabled || !jobTitleId}
              />
        );
      }

      // managerEmployeeId
      if (field.key === 'managerEmployeeId') {
        return (
          <CVisionSelect
                C={C}
                value={fieldValue || 'none'}
                onChange={(val) => setFieldValue(field.key, val === 'none' ? null : val)}
                placeholder={tr('اختر المدير', 'Select manager')}
                options={[{ value: 'none', label: tr('بدون', 'None') }, ...(Array.isArray(employees) && employees.length > 0 ?
                employees.map((emp) => (
                  ({ value: emp.id, label: `${emp.firstName} ${emp.lastName}` })
                )) : [])]}
                disabled={disabled}
              />
        );
      }

      // contractType
      if (field.key === 'contractType') {
        const validContractTypes = CONTRACT_TYPES.map(t => t.value) as string[];
        const safeValue = fieldValue && validContractTypes.includes(fieldValue) ? fieldValue : '';
        return (
          <CVisionSelect
                C={C}
                value={safeValue}
                onChange={(v) => {
              if (validContractTypes.includes(v as string)) {
                setFieldValue('contractType', v);
              } else {
                setFieldValue('contractType', null);
              }
            }}
                placeholder={tr('اختر نوع العقد', 'Select contract type')}
                options={[...CONTRACT_TYPES.map((x) => (
                ({ value: x.value, label: x.label })
              ))]}
                disabled={disabled}
              />
        );
      }

      // Generic select with options
      return (
        <CVisionSelect
                C={C}
                value={fieldValue}
                onChange={(val) => setFieldValue(field.key, val)}
                placeholder={tr('اختر', 'Select')}
                options={[...(field.options || []).map((opt) => (
              ({ value: opt, label: opt })
            ))]}
                disabled={disabled}
              />
      );

    default:
      // CONTRACT: contractType fallback
      if (sectionKey === 'CONTRACT' && field.key === 'contractType') {
        const validContractTypes = CONTRACT_TYPES.map(t => t.value) as string[];
        const safeValue = fieldValue && validContractTypes.includes(fieldValue) ? fieldValue : '';
        return (
          <CVisionSelect
                C={C}
                value={safeValue}
                onChange={(v) => {
              if (validContractTypes.includes(v as string)) {
                setFieldValue('contractType', v);
              } else {
                setFieldValue('contractType', null);
              }
            }}
                placeholder={tr('اختر نوع العقد', 'Select contract type')}
                options={[...CONTRACT_TYPES.map((x) => (
                ({ value: x.value, label: x.label })
              ))]}
                disabled={disabled}
              />
        );
      }

      // EMPLOYMENT: managerEmployeeId fallback
      if (sectionKey === 'EMPLOYMENT' && field.key === 'managerEmployeeId') {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const safeValue = fieldValue && typeof fieldValue === 'string' && uuidRegex.test(fieldValue) ? fieldValue : 'none';
        return (
          <CVisionSelect
                C={C}
                value={safeValue}
                onChange={(val) => setFieldValue(field.key, val === 'none' ? null : val)}
                placeholder={tr('اختر المدير', 'Select manager')}
                options={[{ value: 'none', label: tr('بدون', 'None') }, ...(Array.isArray(employees) && employees.length > 0 ?
                employees.map((emp) => (
                  ({ value: emp.id, label: `${emp.firstName} ${emp.lastName}` })
                )) : [])]}
                disabled={disabled}
              />
        );
      }

      // EMPLOYMENT: departmentId fallback
      if (sectionKey === 'EMPLOYMENT' && field.key === 'departmentId') {
        const selectValue = fieldValue && typeof fieldValue === 'string' && fieldValue.trim() !== '' ? fieldValue : '';
        return (
          <CVisionSelect
                C={C}
                value={selectValue}
                onChange={(v) => {
              updateField({ [field.key]: v, unitId: null, jobTitleId: null, gradeId: null, positionId: null });
            }}
                placeholder={tr('اختر القسم', 'Select department')}
                options={[...(Array.isArray(departments) && departments.length > 0 ?
                departments.map((d) => (
                  ({ value: d.id, label: `${d.name}${d.code ? ` (${d.code})` : ''}` })
                )) : [])]}
                disabled={disabled}
              />
        );
      }

      // EMPLOYMENT: jobTitleId fallback
      if (sectionKey === 'EMPLOYMENT' && field.key === 'jobTitleId') {
        const selectValue = fieldValue && typeof fieldValue === 'string' && fieldValue.trim() !== '' ? fieldValue : '';
        return (
          <CVisionSelect
                C={C}
                value={selectValue}
                onChange={(val) => updateField({ [field.key]: val, gradeId: null })}
                placeholder={tr('اختر المسمى الوظيفي', 'Select job title')}
                options={[...(Array.isArray(jobTitles) && jobTitles.length > 0 ?
                jobTitles.map((job) => (
                  ({ value: job.id, label: `${job.name}${job.code ? ` (${job.code})` : ''}` })
                )) : [])]}
                disabled={disabled}
              />
        );
      }

      // EMPLOYMENT: positionId fallback
      if (sectionKey === 'EMPLOYMENT' && field.key === 'positionId') {
        const rawPositionId = editData[sectionKey]?.positionId ?? profile?.employee?.positionId ?? value;
        const selectValue = rawPositionId && typeof rawPositionId === 'string' && rawPositionId !== 'none' && rawPositionId.trim() !== ''
          ? rawPositionId.trim()
          : '';

        if (process.env.NODE_ENV === 'development') {
          console.log('[Profile] Rendering positionId dropdown:', {
            fieldKey: field.key,
            rawPositionId,
            selectValue,
            positionsCount: positions.length,
          });
        }

        return (
          <CVisionSelect
                C={C}
                value={selectValue}
                onChange={(v) => {
              const updates: Record<string, unknown> = {
                ...editData[sectionKey],
                positionId: v === 'none' || v === '' ? null : v,
              };

              if (process.env.NODE_ENV === 'development') {
                console.log('[Profile] Position selected:', { value: v, positionId: updates.positionId });
              }

              setEditData((prev) => ({ ...prev, [sectionKey]: updates }));
            }}
                placeholder={tr('اختر المنصب (اختياري)', 'Select position (optional)')}
                options={[{ value: 'none', label: tr('بدون', 'None') }, ...(Array.isArray(positions) && positions.length > 0 ?
                positions.filter((p) => p.id && p.id.trim() !== '').map((p) => (
                  ({ value: p.id, label: p.positionCode ? `${p.positionCode}${p.title ? ` - ${p.title}` : ''}` : (p.title || p.id) })
                )) : [])]}
                disabled={disabled}
              />
        );
      }

      // For other fields, use default disabled input
      return <CVisionInput C={C} value={fieldValue} disabled={disabled || true} />;
  }
}
