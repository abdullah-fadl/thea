'use client';

import type { ReactNode } from 'react';
import { useState, useRef, useEffect } from 'react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionButton, CVisionInput, CVisionLabel, CVisionSkeletonCard , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { Loader2, History, Pencil, X, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  ProfileSectionKey,
  ProfileFieldDefinition,
  ProfileSection,
  EditableCardProps,
  ReferenceData,
} from './types';
import ProfileField from './ProfileField';

interface SectionCardProps {
  sectionKey: ProfileSectionKey;
  title: string;
  icon: LucideIcon;
  section: ProfileSection | undefined;
  editData: Record<string, any>;
  saving: boolean;
  changeReason: string;
  historyOpen: boolean;
  isEditing: boolean;
  canEdit: boolean;
  editReason: string | null;
  onToggleEdit: () => void;
  onCancelEdit: () => void;
  onSaveSection: () => Promise<void>;
  onEditDataChange: (data: Record<string, any>) => void;
  onChangeReasonUpdate: (reason: string) => void;
  onHistoryToggle: (open: boolean) => void;
  onFixProfile: () => void;
  fixingProfile: boolean;
  renderField: (field: ProfileFieldDefinition, sectionKey: ProfileSectionKey, value: any, disabled: boolean) => ReactNode;
  referenceData: ReferenceData;
  employee?: any;
  headerContent?: ReactNode;
  footerContent?: ReactNode;
  fieldOverrides?: ProfileFieldDefinition[];
  showPositionFallback?: boolean;
}

export default function SectionCard({
  sectionKey,
  title,
  icon: Icon,
  section,
  editData,
  saving,
  changeReason,
  historyOpen,
  isEditing,
  canEdit,
  editReason,
  onToggleEdit,
  onCancelEdit,
  onSaveSection,
  onEditDataChange,
  onChangeReasonUpdate,
  onHistoryToggle,
  onFixProfile,
  fixingProfile,
  renderField,
  referenceData,
  employee,
  headerContent,
  footerContent,
  fieldOverrides,
  showPositionFallback = false,
}: SectionCardProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);

  // Missing section state
  if (!section) {
    return (
      <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon style={{ width: 20, height: 20, color: C.textMuted }} />
            <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{title}</h3>
          </div>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ padding: 12, background: `${C.red}10`, border: `1px solid ${C.red}30`, borderRadius: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 13, color: C.red }}>
                {tr('بيانات القسم مفقودة. قد يكون هذا الموظف قد تم توظيفه قبل تنفيذ أقسام الملف الشخصي.', 'Section data is missing. This employee may have been hired before profile sections were implemented.')}
              </p>
              <CVisionButton
                C={C}
                isDark={isDark}
                variant="outline"
                onClick={onFixProfile}
                disabled={fixingProfile}
                icon={fixingProfile ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> : undefined}
              >
                {fixingProfile ? tr('جاري إصلاح الملف...', 'Fixing Profile...') : tr('إصلاح أقسام الملف', 'Fix Profile Sections')}
              </CVisionButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Resolve fields
  const rawFields = fieldOverrides || (Array.isArray(section.schemaJson?.fields) ? section.schemaJson!.fields : []);
  const seenFieldKeys = new Set<string>();
  const validEmploymentKeys = new Set(['departmentId', 'unitId', 'positionId', 'jobTitleId', 'managerEmployeeId', 'hiredAt', 'gradeId']);
  const fields = rawFields.filter((f) => {
    if (!f?.key || seenFieldKeys.has(f.key)) return false;
    if (sectionKey === 'EMPLOYMENT' && !validEmploymentKeys.has(f.key)) return false;
    seenFieldKeys.add(f.key);
    return true;
  });

  const history = Array.isArray(section.history) ? section.history : [];

  // EMPLOYMENT schema missing fallback
  if (sectionKey === 'EMPLOYMENT' && (!section.schemaJson || fields.length === 0) && !fieldOverrides) {
    const fallbackFields: ProfileFieldDefinition[] = [
      { key: 'departmentId', label: 'Department', type: 'select', required: true },
      { key: 'unitId', label: 'Unit', type: 'select', required: false },
      { key: 'positionId', label: 'Position', type: 'select', required: false },
      { key: 'jobTitleId', label: 'Job Title', type: 'select', required: false },
      { key: 'managerEmployeeId', label: 'Manager', type: 'select', required: false },
      { key: 'branchId', label: 'Branch', type: 'select', required: false },
      { key: 'workLocation', label: 'Work Location', type: 'text', required: false },
      { key: 'hiredAt', label: 'Hire Date', type: 'date', required: false },
    ];

    return (
      <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon style={{ width: 20, height: 20, color: C.textMuted }} />
            <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{title}</h3>
          </div>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: 12, background: `${C.blue}10`, border: `1px solid ${C.blue}30`, borderRadius: 8 }}>
            <p style={{ fontSize: 13, color: C.blue }}>
              {tr('المخطط قيد التحميل. الحقول الأساسية متاحة أدناه.', 'Schema is loading. Basic fields are available below.')}
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
            {fallbackFields.map((field) => (
              <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C} required={field.required}>
                  {field.label}
                </CVisionLabel>
                {renderField(field, sectionKey, employee?.[field.key as keyof typeof employee], !canEdit)}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Schema missing for non-EMPLOYMENT sections
  if (!section.schemaJson || fields.length === 0) {
    return (
      <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon style={{ width: 20, height: 20, color: C.textMuted }} />
            <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{title}</h3>
          </div>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: C.textMuted }}>
            {tr('المخطط مفقود لهذا القسم. قد يكون هذا الموظف قد تم توظيفه قبل تنفيذ أقسام الملف الشخصي.', 'Schema missing for this section. This employee may have been hired before profile sections were implemented.')}
          </p>
          <CVisionButton
            C={C}
            isDark={isDark}
            variant="outline"
            onClick={onFixProfile}
            disabled={fixingProfile}
            icon={fixingProfile ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> : undefined}
          >
            {fixingProfile ? tr('جاري إصلاح الملف...', 'Fixing Profile...') : tr('إصلاح أقسام الملف', 'Fix Profile Sections')}
          </CVisionButton>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden', transition: 'box-shadow 0.2s' }}>
      {/* Card Header */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32, width: 32, borderRadius: 8, background: `${C.gold}15` }}>
              <Icon style={{ width: 16, height: 16, color: C.gold }} />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{title}</h3>
              {section.updatedAt && (
                <p style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                  {tr('تم التحديث', 'Updated')} {new Date(section.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* History button */}
            <button
              style={{ width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted }}
              onClick={() => setHistoryDrawerOpen(true)}
            >
              <History style={{ width: 16, height: 16 }} />
            </button>

            {/* Edit / Save / Cancel buttons */}
            {canEdit && !isEditing && (
              <button
                style={{ width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted }}
                onClick={onToggleEdit}
              >
                <Pencil style={{ width: 16, height: 16 }} />
              </button>
            )}
            {isEditing && (
              <>
                <button
                  style={{ width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.red }}
                  onClick={onCancelEdit}
                >
                  <X style={{ width: 16, height: 16 }} />
                </button>
                <CVisionButton
                  C={C}
                  isDark={isDark}
                  variant="primary"
                  onClick={onSaveSection}
                  disabled={saving}
                  icon={saving
                    ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                    : <Check style={{ width: 16, height: 16 }} />
                  }
                >
                  {tr('حفظ', 'Save')}
                </CVisionButton>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {/* Header content (legacy warnings, etc.) */}
        {headerContent}

        {/* Permission warning */}
        {!canEdit && (
          <div style={{ padding: 12, background: `${C.orange}10`, border: `1px solid ${C.orange}30`, borderRadius: 8, marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: C.orange }}>
              {tr('ليس لديك صلاحية لتعديل هذا القسم.', 'You do not have permission to edit this section.')}
              {editReason === 'FORBIDDEN_SECTION' && ` ${tr('ليس لديك صلاحية لتعديل قسم', 'You do not have permission to edit')} ${sectionKey} ${tr('', 'section.')}`}
              {editReason === 'FORBIDDEN_EMPLOYEE' && ` ${tr('يمكنك تعديل ملفك الشخصي فقط.', 'You can only edit your own profile.')}`}
              {editReason === 'FORBIDDEN_SCOPE' && ` ${tr('ليس لديك وصول لموظفي هذا القسم.', 'You do not have access to employees in this department.')}`}
              {editReason === 'EMPLOYEE_STATUS_BLOCKED' && ` ${tr('لا يمكن تحديث الملف لهذه الحالة.', 'Cannot update profile for this employee status.')}`}
              {editReason === 'SECTION_READONLY' && ` ${sectionKey} ${tr('القسم للقراءة فقط لدورك.', 'section is read-only for your role.')}`}
              {editReason === 'DEPARTMENT_MISMATCH' && ` ${tr('ليس لديك وصول لموظفي هذا القسم.', 'You do not have access to employees in this department.')}`}
            </p>
          </div>
        )}

        {/* Change reason (only in edit mode) */}
        {isEditing && canEdit && (
          <div style={{ marginBottom: 16, padding: 12, background: `${C.textMuted}08`, borderRadius: 8 }}>
            <CVisionLabel C={C}>{tr('سبب التغيير (اختياري)', 'Change Reason (Optional)')}</CVisionLabel>
            <CVisionInput
              C={C}
              placeholder={tr('سبب هذا التغيير...', 'Reason for this change...')}
              value={changeReason}
              onChange={(e) => onChangeReasonUpdate(e.target.value)}
              style={{ marginTop: 4, height: 32, fontSize: 13 }}
            />
          </div>
        )}

        {/* Fields grid */}
        {fields.length > 0 ? (
          <div style={isEditing ? { display: 'flex', flexDirection: 'column', gap: 16 } : { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
            {fields.map((field) => {
              if (!field || !field.key) return null;

              const fieldValue = sectionKey === 'EMPLOYMENT' &&
                (field.key === 'departmentId' || field.key === 'jobTitleId' || field.key === 'gradeId' || field.key === 'positionId')
                ? (employee?.[field.key as keyof typeof employee] ?? section.dataJson?.[field.key])
                : section.dataJson?.[field.key];

              if (isEditing) {
                return (
                  <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <CVisionLabel C={C} required={field.required}>
                      {field.label || field.key}
                    </CVisionLabel>
                    {renderField(field, sectionKey, fieldValue, !canEdit)}
                  </div>
                );
              }

              return (
                <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <p style={{ fontSize: 11, fontWeight: 500, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {field.label || field.key}
                  </p>
                  <ProfileField
                    field={field}
                    value={editData[field.key] ?? fieldValue}
                    sectionKey={sectionKey}
                    referenceData={referenceData}
                  />
                </div>
              );
            })}

            {/* FALLBACK: Always show Position field for EMPLOYMENT if not in schema */}
            {showPositionFallback && !fields.some((f) => f.key === 'positionId') && (
              <div key="positionId-fallback" style={{ display: 'flex', flexDirection: 'column', gap: isEditing ? 6 : 2 }}>
                {isEditing ? (
                  <>
                    <CVisionLabel C={C}>{tr('المنصب (لخطط القوى العاملة)', 'Position (for Manpower Plans)')}</CVisionLabel>
                    {renderField(
                      { key: 'positionId', label: 'Position', type: 'select', required: false },
                      sectionKey,
                      employee?.positionId ?? section.dataJson?.positionId,
                      !canEdit,
                    )}
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 11, fontWeight: 500, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {tr('المنصب', 'Position')}
                    </p>
                    <ProfileField
                      field={{ key: 'positionId', label: 'Position', type: 'select', required: false }}
                      value={editData.positionId ?? employee?.positionId ?? section.dataJson?.positionId}
                      sectionKey={sectionKey}
                      referenceData={referenceData}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: C.textMuted }}>{tr('لا توجد حقول متاحة لهذا القسم.', 'No fields available for this section.')}</p>
        )}

        {/* Footer content (contract status bar, etc.) */}
        {footerContent}
      </div>

      {/* History Drawer (slide-in panel) */}
      {historyDrawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setHistoryDrawerOpen(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: isRTL ? 'auto' : 0,
              left: isRTL ? 0 : 'auto',
              bottom: 0,
              width: 400,
              maxWidth: '90vw',
              background: C.bgCard,
              borderLeft: isRTL ? 'none' : `1px solid ${C.border}`,
              borderRight: isRTL ? `1px solid ${C.border}` : 'none',
              padding: 24,
              overflowY: 'auto',
              boxShadow: `0 0 20px ${C.text}15`,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text }}>
                {title} {tr('السجل', 'History')}
              </h3>
              <button
                style={{ width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted }}
                onClick={() => setHistoryDrawerOpen(false)}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            {history.length === 0 ? (
              <p style={{ fontSize: 13, color: C.textMuted }}>{tr('لا يوجد سجل متاح', 'No history available')}</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ padding: '8px 4px', textAlign: isRTL ? 'right' : 'left', fontSize: 12, fontWeight: 500, color: C.textMuted }}>{tr('التاريخ', 'Date')}</th>
                    <th style={{ padding: '8px 4px', textAlign: isRTL ? 'right' : 'left', fontSize: 12, fontWeight: 500, color: C.textMuted }}>{tr('بواسطة', 'Changed By')}</th>
                    <th style={{ padding: '8px 4px', textAlign: isRTL ? 'right' : 'left', fontSize: 12, fontWeight: 500, color: C.textMuted }}>{tr('السبب', 'Reason')}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr key={entry?.id || Math.random()} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '8px 4px', fontSize: 13, color: C.text }}>
                        {entry?.createdAt ? new Date(entry.createdAt).toLocaleString() : '\u2014'}
                      </td>
                      <td style={{ padding: '8px 4px', fontSize: 13, color: C.text }}>{entry?.changedByUserId || '\u2014'}</td>
                      <td style={{ padding: '8px 4px', fontSize: 13, color: C.text }}>{entry?.changeReason || '\u2014'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
