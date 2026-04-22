'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionPageHeader, CVisionPageLayout, CVisionEmptyState, CVisionSkeletonCard,
  CVisionTabs, CVisionTabContent,
  CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import {
  ScanSearch, RefreshCw, AlertTriangle, CheckCircle2, Users,
  Merge, Sparkles, FileWarning,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────
interface CompletenessItem { employeeId: string; employeeName: string; completeness: number; missingFields: string[] }
interface DuplicateGroup { _id: { name: string; dob: string }; count: number; employees: { _id: string; name: string; email: string; phone: string; department: string }[] }

// ─── Page ─────────────────────────────────────────────────────────
export default function DataQualityPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [activeTab, setActiveTab] = useState('completeness');

  // Completeness mutation
  const completenessMutation = useMutation({
    mutationFn: () => cvisionFetch<{ ok: boolean; data?: CompletenessItem[]; avgCompleteness?: number; error?: string }>('/api/cvision/data-quality', { params: { action: 'completeness-report' } }),
    onError: () => toast.error(tr('فشل فحص الاكتمال', 'Failed to run completeness check')),
    onSuccess: (res) => {
      if (!res.ok) toast.error(res.error || tr('فشل فحص الاكتمال', 'Failed to run completeness check'));
    },
  });

  const completeness = completenessMutation.data?.ok ? (completenessMutation.data.data || []) : [];
  const avgCompleteness = completenessMutation.data?.ok ? (completenessMutation.data.avgCompleteness || 0) : 0;
  const completenessLoading = completenessMutation.isPending;
  const completenessLoaded = completenessMutation.isSuccess && !!completenessMutation.data?.ok;

  // Duplicates mutation
  const duplicatesMutation = useMutation({
    mutationFn: () => cvisionFetch<{ ok: boolean; data?: DuplicateGroup[]; error?: string }>('/api/cvision/data-quality', { params: { action: 'find-duplicates' } }),
    onError: () => toast.error(tr('فشل البحث عن التكرارات', 'Failed to find duplicates')),
    onSuccess: (res) => {
      if (!res.ok) toast.error(res.error || tr('فشل البحث عن التكرارات', 'Failed to find duplicates'));
    },
  });

  const duplicates = duplicatesMutation.data?.ok ? (duplicatesMutation.data.data || []) : [];
  const dupLoading = duplicatesMutation.isPending;
  const dupLoaded = duplicatesMutation.isSuccess && !!duplicatesMutation.data?.ok;

  // Standardize preview mutation
  const stdPreviewMutation = useMutation({
    mutationFn: () => cvisionMutate<{ ok: boolean; data?: any[]; error?: string }>('/api/cvision/data-quality', 'POST', { action: 'standardize', dryRun: true }),
    onError: () => toast.error(tr('فشل فحص التوحيد', 'Failed to run standardization check')),
    onSuccess: (res) => {
      if (!res.ok) toast.error(res.error || tr('فشل فحص التوحيد', 'Failed to run standardization check'));
    },
  });

  const stdChanges = stdPreviewMutation.data?.ok ? (stdPreviewMutation.data.data || []) : [];
  const stdLoading = stdPreviewMutation.isPending;
  const stdLoaded = stdPreviewMutation.isSuccess && !!stdPreviewMutation.data?.ok;

  // Apply standardization mutation
  const applyStdMutation = useMutation({
    mutationFn: () => cvisionMutate<{ ok: boolean; total?: number; error?: string }>('/api/cvision/data-quality', 'POST', { action: 'standardize', dryRun: false }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(tr(`تم توحيد ${res.total} سجل`, `Standardized ${res.total} records`));
        stdPreviewMutation.reset();
      } else {
        toast.error(res.error || tr('فشل التطبيق', 'Failed to apply'));
      }
    },
    onError: () => toast.error(tr('فشل تطبيق التوحيد', 'Failed to apply standardization')),
  });

  const applying = applyStdMutation.isPending;

  function completenessColor(pct: number): string {
    if (pct >= 80) return C.green;
    if (pct >= 50) return C.orange;
    return C.red;
  }

  const tabs = [
    { id: 'completeness', label: tr('الاكتمال', 'Completeness'), labelAr: 'الاكتمال', icon: <FileWarning size={14} /> },
    { id: 'duplicates', label: tr('التكرارات', 'Duplicates'), labelAr: 'التكرارات', icon: <Users size={14} /> },
    { id: 'standardize', label: tr('التوحيد', 'Standardize'), labelAr: 'التوحيد', icon: <Sparkles size={14} /> },
  ];

  return (
    <CVisionPageLayout style={{ maxWidth: 1024 }}>
      <CVisionPageHeader C={C} title={tr('جودة البيانات', 'Data Quality')} titleEn="Data Quality" icon={ScanSearch} isRTL={isRTL}
        subtitle={tr('فحص بيانات الموظفين للاكتمال والتكرارات والتوحيد', 'Scan employee data for completeness, duplicates, and standardization issues.')}
      />

      <CVisionTabs C={C} tabs={tabs} activeTab={activeTab} onChange={setActiveTab} isRTL={isRTL} />

      {/* Completeness Tab */}
      <CVisionTabContent id="completeness" activeTab={activeTab}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CVisionButton C={C} isDark={isDark} variant="primary" onClick={() => completenessMutation.mutate()} loading={completenessLoading}
            icon={completenessLoading ? undefined : <ScanSearch size={14} />}
          >
            {completenessLoading ? tr('جاري الفحص...', 'Scanning...') : tr('تشغيل فحص الاكتمال', 'Run Completeness Scan')}
          </CVisionButton>

          {completenessLoading && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3,4].map(i => <CVisionSkeletonCard key={i} C={C} height={48} />)}</div>}

          {completenessLoaded && !completenessLoading && (
            <>
              <CVisionCard C={C}>
                <CVisionCardHeader C={C}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tr('الاكتمال الإجمالي', 'Overall Completeness')}</span>
                </CVisionCardHeader>
                <CVisionCardBody>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color: completenessColor(avgCompleteness) }}>{avgCompleteness}%</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: C.barTrack, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 4, background: completenessColor(avgCompleteness), width: `${avgCompleteness}%` }} />
                    </div>
                    <span style={{ fontSize: 13, color: C.textMuted }}>{completeness.length} {tr('موظف', 'employees')}</span>
                  </div>
                </CVisionCardBody>
              </CVisionCard>

              {completeness.length === 0 ? (
                <CVisionEmptyState C={C} icon={CheckCircle2} title={tr('جميع البيانات مكتملة', 'All data is complete')} description={tr('لم يتم العثور على حقول مفقودة', 'No missing fields found across employee records.')} />
              ) : (
                <CVisionCard C={C}>
                  <CVisionTable C={C}>
                    <CVisionTableHead C={C}>
                      <CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh>
                      <CVisionTh C={C}>{tr('الاكتمال', 'Completeness')}</CVisionTh>
                      <CVisionTh C={C}>{tr('الحقول المفقودة', 'Missing Fields')}</CVisionTh>
                    </CVisionTableHead>
                    <CVisionTableBody>
                      {completeness.filter(c => c.completeness < 100).slice(0, 50).map(item => (
                        <CVisionTr key={item.employeeId} C={C}>
                          <CVisionTd style={{ fontWeight: 500, color: C.text }}>{item.employeeName || item.employeeId}</CVisionTd>
                          <CVisionTd>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 60, height: 6, borderRadius: 4, background: C.barTrack, overflow: 'hidden' }}>
                                <div style={{ height: '100%', borderRadius: 4, background: completenessColor(item.completeness), width: `${item.completeness}%` }} />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 500, color: completenessColor(item.completeness) }}>{item.completeness}%</span>
                            </div>
                          </CVisionTd>
                          <CVisionTd>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {item.missingFields.map(f => (
                                <CVisionBadge key={f} C={C} variant="danger" style={{ fontSize: 10 }}>{f}</CVisionBadge>
                              ))}
                            </div>
                          </CVisionTd>
                        </CVisionTr>
                      ))}
                    </CVisionTableBody>
                  </CVisionTable>
                </CVisionCard>
              )}
            </>
          )}

          {!completenessLoaded && !completenessLoading && (
            <CVisionEmptyState C={C} icon={FileWarning} title={tr('قم بتشغيل فحص الاكتمال', 'Run a completeness scan')} description={tr('تحقق من الموظفين الذين لديهم حقول مطلوبة مفقودة', 'Check which employees have missing required fields.')} />
          )}
        </div>
      </CVisionTabContent>

      {/* Duplicates Tab */}
      <CVisionTabContent id="duplicates" activeTab={activeTab}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CVisionButton C={C} isDark={isDark} variant="primary" onClick={() => duplicatesMutation.mutate()} loading={dupLoading}
            icon={dupLoading ? undefined : <Users size={14} />}
          >
            {dupLoading ? tr('جاري الفحص...', 'Scanning...') : tr('البحث عن التكرارات', 'Find Duplicates')}
          </CVisionButton>

          {dupLoading && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3].map(i => <CVisionSkeletonCard key={i} C={C} height={64} />)}</div>}

          {dupLoaded && !dupLoading && (
            <>
              {duplicates.length === 0 ? (
                <CVisionEmptyState C={C} icon={CheckCircle2} title={tr('لم يتم العثور على تكرارات', 'No duplicates found')} description={tr('جميع سجلات الموظفين فريدة', 'All employee records appear to be unique.')} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: C.red }}>
                    <AlertTriangle size={16} />
                    {duplicates.length} {tr('مجموعة تكرار محتملة', 'potential duplicate group')}{duplicates.length !== 1 ? tr('ات', 's') : ''} {tr('تم العثور عليها', 'found')}
                  </div>
                  {duplicates.map((group, gi) => (
                    <CVisionCard key={gi} C={C}>
                      <CVisionCardHeader C={C}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Merge size={16} color={C.orange} />
                          <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{group._id.name || 'Unknown'} ({group.count} {tr('سجلات', 'records')})</span>
                        </div>
                      </CVisionCardHeader>
                      <CVisionCardBody style={{ padding: 0 }}>
                        <CVisionTable C={C}>
                          <CVisionTableHead C={C}>
                            <CVisionTh C={C}>{tr('الاسم', 'Name')}</CVisionTh>
                            <CVisionTh C={C}>{tr('البريد', 'Email')}</CVisionTh>
                            <CVisionTh C={C}>{tr('الهاتف', 'Phone')}</CVisionTh>
                            <CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh>
                          </CVisionTableHead>
                          <CVisionTableBody>
                            {group.employees.map((emp, ei) => (
                              <CVisionTr key={ei} C={C}>
                                <CVisionTd style={{ fontWeight: 500, color: C.text }}>{emp.name}</CVisionTd>
                                <CVisionTd style={{ color: C.textMuted }}>{emp.email || '-'}</CVisionTd>
                                <CVisionTd style={{ color: C.textMuted }}>{emp.phone || '-'}</CVisionTd>
                                <CVisionTd style={{ color: C.textMuted }}>{emp.department || '-'}</CVisionTd>
                              </CVisionTr>
                            ))}
                          </CVisionTableBody>
                        </CVisionTable>
                      </CVisionCardBody>
                    </CVisionCard>
                  ))}
                </div>
              )}
            </>
          )}

          {!dupLoaded && !dupLoading && (
            <CVisionEmptyState C={C} icon={Users} title={tr('قم بتشغيل فحص التكرارات', 'Run a duplicate scan')} description={tr('ابحث عن موظفين مكررين بناء على الاسم وتاريخ الميلاد', 'Find employees that may be duplicated based on name and date of birth.')} />
          )}
        </div>
      </CVisionTabContent>

      {/* Standardize Tab */}
      <CVisionTabContent id="standardize" activeTab={activeTab}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CVisionButton C={C} isDark={isDark} variant="primary" onClick={() => stdPreviewMutation.mutate()} loading={stdLoading}
              icon={stdLoading ? undefined : <Sparkles size={14} />}
            >
              {stdLoading ? tr('جاري الفحص...', 'Scanning...') : tr('معاينة التوحيد', 'Preview Standardization')}
            </CVisionButton>
            {stdLoaded && stdChanges.length > 0 && (
              <CVisionButton C={C} isDark={isDark} variant="primary" onClick={() => applyStdMutation.mutate()} loading={applying}
                icon={applying ? undefined : <CheckCircle2 size={14} />}
              >
                {tr('تطبيق', 'Apply')} {stdChanges.length} {tr('تغييرات', 'Changes')}
              </CVisionButton>
            )}
          </div>

          {stdLoading && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3].map(i => <CVisionSkeletonCard key={i} C={C} height={48} />)}</div>}

          {stdLoaded && !stdLoading && (
            <>
              {stdChanges.length === 0 ? (
                <CVisionEmptyState C={C} icon={CheckCircle2} title={tr('البيانات موحدة بالفعل', 'Data is already standardized')} description={tr('لم يتم العثور على مشاكل', 'No name casing, phone formatting, or email issues found.')} />
              ) : (
                <CVisionCard C={C}>
                  <CVisionTable C={C}>
                    <CVisionTableHead C={C}>
                      <CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh>
                      <CVisionTh C={C}>{tr('التغييرات المقترحة', 'Proposed Changes')}</CVisionTh>
                    </CVisionTableHead>
                    <CVisionTableBody>
                      {stdChanges.slice(0, 50).map((item, i) => (
                        <CVisionTr key={i} C={C}>
                          <CVisionTd style={{ fontWeight: 500, color: C.text }}>{item.name || item.employeeId}</CVisionTd>
                          <CVisionTd>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {Object.entries(item.changes).map(([field, newVal]) => (
                                <CVisionBadge key={field} C={C} variant="muted" style={{ fontSize: 10 }}>
                                  {field}: <span style={{ fontFamily: 'monospace', marginLeft: 4 }}>{String(newVal)}</span>
                                </CVisionBadge>
                              ))}
                            </div>
                          </CVisionTd>
                        </CVisionTr>
                      ))}
                    </CVisionTableBody>
                  </CVisionTable>
                </CVisionCard>
              )}
            </>
          )}

          {!stdLoaded && !stdLoading && (
            <CVisionEmptyState C={C} icon={Sparkles} title={tr('معاينة التوحيد', 'Preview standardization')} description={tr('إصلاح حالة الأحرف وتنسيق الهاتف وتوحيد البريد الإلكتروني', 'Fix name casing, phone formatting, and email normalization with a dry-run preview first.')} />
          )}
        </div>
      </CVisionTabContent>
    </CVisionPageLayout>
  );
}
