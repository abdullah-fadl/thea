'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useDevMode } from '@/lib/dev-mode';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionPageLayout, CVisionPageHeader, CVisionCard, CVisionCardHeader, CVisionCardBody,
  CVisionButton, CVisionBadge, CVisionInput, CVisionSelect, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { Loader2, Database, FileText, Users, Briefcase, DollarSign, CreditCard, UserCog, X } from 'lucide-react';
import { DebugBanner } from '@/components/cvision/DebugBanner';
import { CVISION_ROLES } from '@/lib/cvision/roles';

interface DiagnosticsData {
  tenantId: string;
  userId?: string;
  roles?: string[];
  employeeId?: string | null;
  departmentIds?: string[];
  employeeStatus?: string | null;
  hasTenantWideAccess?: boolean;
  employees?: {
    totalInTenant: number;
    visibleByScope: number;
    byStatus: { active: number; probation: number; resigned: number; terminated: number };
    archived: number;
  };
  requisitions: { count: number; ids: string[] };
  candidates: { count: number; ids: string[] };
  documents: { count: number; ids: string[] };
  parseJobs: { count: number; ids: string[] };
  payrollProfiles: { count: number; ids: string[] };
  payrollRuns: { count: number; ids: string[] };
  payslips: { count: number; ids: string[] };
  loans: { count: number; ids: string[] };
}

interface ImpersonationState {
  active: boolean;
  impersonation: { role: string; departmentIds?: string[]; employeeId?: string } | null;
}

export default function DiagnosticsPage() {
  const isDev = useDevMode();
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(null);
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [savingOverride, setSavingOverride] = useState(false);

  const devOverrideAvailable = isDev;

  const { data, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.diagnostics.list(),
    queryFn: async () => {
      const diagnostics = await cvisionFetch<any>('/api/cvision/diagnostics');
      if (diagnostics.success) return diagnostics.data as DiagnosticsData;
      toast.error(diagnostics.error || tr('فشل التحميل', 'Failed to load diagnostics'));
      return null;
    },
  });

  const { data: impersonationData } = useQuery({
    queryKey: cvisionKeys.diagnostics.detail('impersonation'),
    queryFn: () => cvisionFetch<any>('/api/cvision/dev-override'),
    enabled: devOverrideAvailable,
  });

  // Sync impersonation data from query
  if (impersonationData && !impersonation) {
    setImpersonation(impersonationData);
    setOverrideEnabled(impersonationData.active);
    if (impersonationData.impersonation) {
      setSelectedRole(impersonationData.impersonation.role);
      setSelectedDepartmentIds(impersonationData.impersonation.departmentIds || []);
      setSelectedEmployeeId(impersonationData.impersonation.employeeId || '');
    }
  }

  async function saveImpersonation() {
    try {
      setSavingOverride(true);
      const result = await cvisionMutate<any>('/api/cvision/dev-override', 'POST', {
        role: selectedRole, departmentIds: selectedDepartmentIds.length > 0 ? selectedDepartmentIds : undefined, employeeId: selectedEmployeeId || undefined,
      });
      if (result.success) {
        setImpersonation(result); setOverrideEnabled(result.active);
        toast.success(tr('تم التطبيق', `Now impersonating: ${selectedRole}`));
        window.location.reload();
      } else { toast.error(result.error || tr('فشل', 'Failed to set impersonation')); }
    } catch (error: any) { toast.error(error.message || tr('فشل', 'Failed to set impersonation')); }
    finally { setSavingOverride(false); }
  }

  async function clearImpersonation() {
    try {
      setSavingOverride(true);
      const result = await cvisionFetch<any>('/api/cvision/dev-override', { method: 'DELETE' });
      if (result.success) {
        setImpersonation(result); setOverrideEnabled(false);
        setSelectedRole(''); setSelectedDepartmentIds([]); setSelectedEmployeeId('');
        toast.success(tr('تم المسح', 'Impersonation cleared'));
        window.location.reload();
      } else { toast.error(result.error || tr('فشل', 'Failed to clear impersonation')); }
    } catch (error: any) { toast.error(error.message || tr('فشل', 'Failed to clear impersonation')); }
    finally { setSavingOverride(false); }
  }

  if (loading) {
    return (
      <CVisionPageLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
          <Loader2 size={32} color={C.textMuted} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      </CVisionPageLayout>
    );
  }

  const CountCard = ({ icon: Icon, title, count, ids }: { icon: any; title: string; count: number; ids: string[] }) => (
    <CVisionCard C={C}>
      <CVisionCardHeader C={C}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={16} color={C.textMuted} />
          <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{title}</span>
        </div>
      </CVisionCardHeader>
      <CVisionCardBody>
        <div style={{ fontSize: 28, fontWeight: 700, color: C.text, marginBottom: 8 }}>{count}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ids.length > 0 ? ids.map(id => (
            <div key={id} style={{ fontFamily: 'monospace', fontSize: 11, color: C.textMuted }}>{id}</div>
          )) : (
            <div style={{ fontSize: 12, color: C.textMuted }}>{tr('لا يوجد', `No ${title.toLowerCase()}`)}</div>
          )}
        </div>
      </CVisionCardBody>
    </CVisionCard>
  );

  return (
    <CVisionPageLayout>
      <DebugBanner />

      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{tr('تشخيصات CVision', 'CVision Diagnostics')}</h1>
        <p style={{ color: C.textMuted, fontSize: 13 }}>{tr('عدادات قاعدة البيانات للمستأجر الحالي', 'Database counts and IDs for current tenant')}</p>
        {isDev && (
          <p style={{ fontSize: 11, color: C.orange, marginTop: 8 }}>
            {tr('ملاحظة: بعد البذر، يجب أن تكون أعداد التوظيف > 0', 'Note: After seeding, recruitment counts (requisitions, candidates) should be >0')}
          </p>
        )}
      </div>

      {/* Developer Override Section (DEV-ONLY) */}
      {devOverrideAvailable && (
        <CVisionCard C={C} style={{ border: `1px solid ${C.purple}30` }}>
          <CVisionCardHeader C={C}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserCog size={16} color={C.purple} />
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tr('تجاوز المطور (DEV-ONLY)', 'Developer Override (DEV-ONLY)')}</span>
            </div>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{tr('تفعيل تجاوز المطور', 'Enable Developer Override')}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{tr('انتحال الأدوار للاختبار (OWNER فقط)', 'Impersonate roles/scopes for testing (OWNER only)')}</div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={overrideEnabled}
                  onChange={e => {
                    setOverrideEnabled(e.target.checked);
                    if (!e.target.checked) clearImpersonation();
                  }}
                  style={{ accentColor: C.purple, width: 18, height: 18 }}
                />
              </label>
            </div>

            {overrideEnabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 4 }}>{tr('انتحال الدور', 'Impersonate Role')}</div>
                  <CVisionSelect
                    C={C}
                    value={selectedRole}
                    onChange={setSelectedRole}
                    options={[
                      { value: CVISION_ROLES.HR_ADMIN, label: 'HR_ADMIN' },
                      { value: CVISION_ROLES.HR_MANAGER, label: 'HR_MANAGER' },
                      { value: CVISION_ROLES.EMPLOYEE, label: 'EMPLOYEE' },
                      { value: CVISION_ROLES.AUDITOR, label: 'AUDITOR' },
                    ]}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 4 }}>{tr('نطاق الأقسام (اختياري)', 'Department Scope (Optional)')}</div>
                  <CVisionInput
                    C={C}
                    placeholder={tr('معرفات الأقسام مفصولة بفواصل', 'Comma-separated department IDs')}
                    value={selectedDepartmentIds.join(', ')}
                    onChange={(e: any) => setSelectedDepartmentIds(e.target.value.split(',').map((id: string) => id.trim()).filter(Boolean))}
                  />
                  <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{tr('اتركه فارغا للوصول على مستوى المستأجر', 'Leave empty for tenant-wide access (if role allows)')}</div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 4 }}>{tr('رقم الموظف (اختياري)', 'Employee ID (Optional - for "self" simulation)')}</div>
                  <CVisionInput
                    C={C}
                    placeholder={tr('رقم الموظف', 'Employee ID')}
                    value={selectedEmployeeId}
                    onChange={(e: any) => setSelectedEmployeeId(e.target.value)}
                  />
                  <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{tr('محاكاة العرض كموظف', 'Simulate viewing as this employee')}</div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <CVisionButton C={C} isDark={isDark} size="sm" onClick={saveImpersonation} disabled={!selectedRole || savingOverride}
                    icon={savingOverride ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : undefined}>
                    {tr('تطبيق الانتحال', 'Apply Impersonation')}
                  </CVisionButton>
                  {impersonation?.active && (
                    <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={clearImpersonation} disabled={savingOverride} icon={<X size={14} />}>
                      {tr('مسح', 'Clear')}
                    </CVisionButton>
                  )}
                </div>

                {impersonation?.active && impersonation.impersonation && (
                  <div style={{ padding: 12, background: `${C.purple}15`, borderRadius: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                      {tr('ينتحل حاليا:', 'Currently impersonating:')} <CVisionBadge C={C} variant="purple">{impersonation.impersonation.role}</CVisionBadge>
                    </div>
                    {impersonation.impersonation.departmentIds && impersonation.impersonation.departmentIds.length > 0 && (
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{tr('الأقسام:', 'Departments:')} {impersonation.impersonation.departmentIds.join(', ')}</div>
                    )}
                    {impersonation.impersonation.employeeId && (
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{tr('رقم الموظف:', 'Employee ID:')} {impersonation.impersonation.employeeId}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CVisionCardBody>
        </CVisionCard>
      )}

      {data ? (
        <>
          {/* Recruitment Section */}
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 12 }}>{tr('التوظيف', 'Recruitment')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              <CountCard icon={Briefcase} title={tr('الطلبات', 'Requisitions')} count={data.requisitions.count} ids={data.requisitions.ids} />
              <CountCard icon={Users} title={tr('المرشحون', 'Candidates')} count={data.candidates.count} ids={data.candidates.ids} />
              <CountCard icon={FileText} title={tr('المستندات', 'Documents')} count={data.documents.count} ids={data.documents.ids} />
              <CountCard icon={Database} title={tr('مهام التحليل', 'Parse Jobs')} count={data.parseJobs.count} ids={data.parseJobs.ids} />
            </div>
          </div>

          {/* Payroll Section */}
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 12 }}>{tr('الرواتب', 'Payroll')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              <CountCard icon={DollarSign} title={tr('ملفات الرواتب', 'Payroll Profiles')} count={data.payrollProfiles.count} ids={data.payrollProfiles.ids} />
              <CountCard icon={FileText} title={tr('تشغيلات الرواتب', 'Payroll Runs')} count={data.payrollRuns.count} ids={data.payrollRuns.ids} />
              <CountCard icon={Database} title={tr('كشوف الرواتب', 'Payslips')} count={data.payslips.count} ids={data.payslips.ids} />
              <CountCard icon={CreditCard} title={tr('القروض', 'Loans')} count={data.loans.count} ids={data.loans.ids} />
            </div>
          </div>
        </>
      ) : (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ color: C.textMuted }}>{tr('فشل تحميل التشخيصات', 'Failed to load diagnostics')}</div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Authorization Context & Employee Counts */}
      {data && (
        <>
          <CVisionCard C={C} style={{ border: `1px solid ${C.green}30` }}>
            <CVisionCardHeader C={C}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} color={C.green} />
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tr('سياق التفويض وأعداد الموظفين', 'Authorization Context & Employee Counts')}</span>
              </div>
            </CVisionCardHeader>
            <CVisionCardBody>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{tr('المستأجر والمستخدم', 'Tenant & User')}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.textMuted }}>
                    TenantId: <CVisionBadge C={C} variant="muted">{data.tenantId}</CVisionBadge>
                  </div>
                  {data.userId && (
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.textMuted }}>
                      UserId: <CVisionBadge C={C} variant="muted">{data.userId}</CVisionBadge>
                    </div>
                  )}
                  {data.roles && data.roles.length > 0 && (
                    <div style={{ fontSize: 11, color: C.textMuted }}>
                      {tr('الأدوار:', 'Roles:')} {data.roles.map(r => <CVisionBadge key={r} C={C} variant="muted" style={{ marginLeft: 4 }}>{r}</CVisionBadge>)}
                    </div>
                  )}
                  {data.hasTenantWideAccess !== undefined && (
                    <div style={{ fontSize: 11, color: C.textMuted }}>
                      {tr('وصول شامل:', 'Tenant-wide Access:')} <CVisionBadge C={C} variant={data.hasTenantWideAccess ? 'success' : 'muted'}>{data.hasTenantWideAccess ? tr('نعم', 'Yes') : tr('لا', 'No')}</CVisionBadge>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{tr('ربط الموظف والنطاق', 'Employee Link & Scope')}</div>
                  {data.employeeId ? (
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.textMuted }}>
                      {tr('رقم الموظف:', 'Employee ID:')} <CVisionBadge C={C} variant="muted">{data.employeeId}</CVisionBadge>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: C.textMuted }}>{tr('لا يوجد ربط موظف', 'No employee link')}</div>
                  )}
                  {data.departmentIds && data.departmentIds.length > 0 ? (
                    <div style={{ fontSize: 11, color: C.textMuted }}>
                      {tr('نطاق الأقسام:', 'Department Scope:')} {data.departmentIds.map(d => <CVisionBadge key={d} C={C} variant="muted" style={{ marginLeft: 4 }}>{d}</CVisionBadge>)}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: C.textMuted }}>{tr('لا يوجد نطاق أقسام', 'No department scope')}</div>
                  )}
                  {data.employeeStatus && (
                    <div style={{ fontSize: 11, color: C.textMuted }}>
                      {tr('حالة الموظف:', 'Employee Status:')} <CVisionBadge C={C} variant="muted">{data.employeeStatus}</CVisionBadge>
                    </div>
                  )}
                </div>
              </div>
              {data.employees && (
                <div style={{ paddingTop: 16, marginTop: 16, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 12 }}>{tr('أعداد الموظفين', 'Employee Counts')}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>{tr('الإجمالي في المستأجر', 'Total in Tenant')}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{data.employees.totalInTenant}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>{tr('مرئي حسب النطاق', 'Visible by Scope')}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{data.employees.visibleByScope}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>{tr('مؤرشف', 'Archived')}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{data.employees.archived}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>{tr('حسب الحالة', 'By Status')}</div>
                      <div style={{ fontSize: 11, color: C.text, display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                        <div>{tr('نشط:', 'Active:')} <strong>{data.employees.byStatus.active}</strong></div>
                        <div>{tr('تجربة:', 'Probation:')} <strong>{data.employees.byStatus.probation}</strong></div>
                        <div>{tr('مستقيل:', 'Resigned:')} <strong>{data.employees.byStatus.resigned}</strong></div>
                        <div>{tr('منتهي:', 'Terminated:')} <strong>{data.employees.byStatus.terminated}</strong></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CVisionCardBody>
          </CVisionCard>

          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('معلومات المستأجر والمستخدم', 'Tenant & User Info')}</span>
            </CVisionCardHeader>
            <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 13, color: C.text }}>
                TenantId: <CVisionBadge C={C} variant="default">{data.tenantId}</CVisionBadge>
              </div>
              {data.userId && (
                <div style={{ fontFamily: 'monospace', fontSize: 13, color: C.text }}>
                  UserId: <CVisionBadge C={C} variant="muted">{data.userId}</CVisionBadge>
                </div>
              )}
              {data.roles && data.roles.length > 0 && (
                <div style={{ fontFamily: 'monospace', fontSize: 13, color: C.text }}>
                  {tr('الأدوار:', 'Roles:')} {data.roles.map(r => <CVisionBadge key={r} C={C} variant="muted" style={{ marginLeft: 4 }}>{r}</CVisionBadge>)}
                </div>
              )}
            </CVisionCardBody>
          </CVisionCard>
        </>
      )}
    </CVisionPageLayout>
  );
}
