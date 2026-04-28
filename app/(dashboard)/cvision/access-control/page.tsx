'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionSkeletonCard, CVisionSkeletonStyles , CVisionDialog, CVisionDialogFooter , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';

import { toast } from 'sonner';
import {
  ArrowRight, Check, ChevronLeft, ChevronRight, Clock,
  FileText, GitBranch, Key, Search, Shield, ShieldCheck,
  Users, X, XCircle,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════
 *  Types
 * ═══════════════════════════════════════════════════════════════════ */

interface Delegation {
  delegationId: string;
  delegatorId: string; delegatorName: string;
  delegateId: string; delegateName: string;
  scope: string; permissions: string[];
  startDate: string; endDate: string; reason: string;
  status: string; linkedLeaveId?: string;
  createdAt: string;
}

interface ApprovalRule {
  ruleId: string; requestType: string; priority: number;
  conditions: { minAmount?: number; maxAmount?: number; minDays?: number; maxDays?: number; departments?: string[]; grades?: string[] };
  approvers: { step: number; type: string; label: string; timeoutHours: number; timeoutAction: string }[];
}

interface AuditEntry {
  id: string; action: string; resourceType: string; resourceId: string;
  actorUserId: string; actorEmail?: string; actorRole: string;
  success: boolean; createdAt: string;
}

interface AuditStats {
  total: number; denials: number;
  byModule: { _id: string; count: number }[];
  byAction: { _id: string; count: number }[];
  topUsers: { userId: string; email?: string; role: string; count: number }[];
}

/* ═══════════════════════════════════════════════════════════════════
 *  Permission matrix data
 * ═══════════════════════════════════════════════════════════════════ */

const ROLES = ['owner', 'hr-admin', 'hr-manager', 'manager', 'recruiter', 'supervisor', 'auditor', 'employee'] as const;
const PERM_GROUPS: { group: string; perms: string[] }[] = [
  { group: 'Dashboard', perms: ['cvision.view'] },
  { group: 'Organization', perms: ['cvision.org.read', 'cvision.org.write'] },
  { group: 'Employees', perms: ['cvision.employees.read', 'cvision.employees.write', 'cvision.employees.status', 'cvision.employees.delete'] },
  { group: 'Attendance', perms: ['cvision.attendance.read', 'cvision.attendance.write', 'cvision.attendance.approve'] },
  { group: 'Leaves', perms: ['cvision.leaves.read', 'cvision.leaves.write', 'cvision.leaves.approve'] },
  { group: 'Loans', perms: ['cvision.loans.read', 'cvision.loans.write', 'cvision.loans.approve'] },
  { group: 'Payroll', perms: ['cvision.payroll.read', 'cvision.payroll.write', 'cvision.payroll.approve'] },
  { group: 'Recruitment', perms: ['cvision.recruitment.read', 'cvision.recruitment.write', 'cvision.recruitment.approve'] },
  { group: 'Performance', perms: ['cvision.performance.read', 'cvision.performance.write', 'cvision.performance.calibrate'] },
  { group: 'Training', perms: ['cvision.training.read', 'cvision.training.write', 'cvision.training.approve'] },
  { group: 'Travel', perms: ['cvision.travel.read', 'cvision.travel.write', 'cvision.travel.approve'] },
  { group: 'Policies', perms: ['cvision.policies.read', 'cvision.policies.write'] },
  { group: 'Workflows', perms: ['cvision.workflows.read', 'cvision.workflows.write'] },
  { group: 'Audit', perms: ['cvision.audit.read'] },
  { group: 'Delegation', perms: ['cvision.delegation.manage'] },
  { group: 'Config', perms: ['cvision.config.write'] },
];

function roleHasPerm(role: string, perm: string): boolean {
  // Fetch from known CVISION_ROLE_PERMISSIONS inline (mirrors constants.ts)
  // Owner/admin/cvision_admin get all
  if (['owner', 'admin', 'cvision_admin'].includes(role)) return true;
  // We'll fetch real data from API but for the static matrix use a simplified view
  const ROLE_MAP: Record<string, string[]> = {
    'hr-admin': ['cvision.view', 'cvision.org.read', 'cvision.org.write', 'cvision.employees.read', 'cvision.employees.write', 'cvision.employees.status', 'cvision.employees.delete', 'cvision.requests.read', 'cvision.requests.write', 'cvision.requests.approve', 'cvision.recruitment.read', 'cvision.recruitment.write', 'cvision.recruitment.approve', 'cvision.payroll.read', 'cvision.payroll.write', 'cvision.payroll.approve', 'cvision.performance.read', 'cvision.performance.write', 'cvision.performance.calibrate', 'cvision.attendance.read', 'cvision.attendance.write', 'cvision.attendance.approve', 'cvision.leaves.read', 'cvision.leaves.write', 'cvision.leaves.approve', 'cvision.loans.read', 'cvision.loans.write', 'cvision.loans.approve', 'cvision.training.read', 'cvision.training.write', 'cvision.training.approve', 'cvision.travel.read', 'cvision.travel.write', 'cvision.travel.approve', 'cvision.policies.read', 'cvision.policies.write', 'cvision.workflows.read', 'cvision.workflows.write', 'cvision.audit.read', 'cvision.delegation.manage'],
    'hr-manager': ['cvision.view', 'cvision.org.read', 'cvision.org.write', 'cvision.employees.read', 'cvision.employees.write', 'cvision.employees.status', 'cvision.requests.read', 'cvision.requests.write', 'cvision.requests.approve', 'cvision.recruitment.read', 'cvision.recruitment.write', 'cvision.recruitment.approve', 'cvision.payroll.read', 'cvision.performance.read', 'cvision.performance.write', 'cvision.performance.calibrate', 'cvision.attendance.read', 'cvision.attendance.write', 'cvision.attendance.approve', 'cvision.leaves.read', 'cvision.leaves.write', 'cvision.leaves.approve', 'cvision.loans.read', 'cvision.loans.write', 'cvision.loans.approve', 'cvision.training.read', 'cvision.training.write', 'cvision.training.approve', 'cvision.travel.read', 'cvision.travel.write', 'cvision.travel.approve', 'cvision.policies.read', 'cvision.policies.write', 'cvision.workflows.read', 'cvision.workflows.write', 'cvision.delegation.manage'],
    manager: ['cvision.view', 'cvision.org.read', 'cvision.employees.read', 'cvision.requests.read', 'cvision.requests.write', 'cvision.requests.approve', 'cvision.attendance.read', 'cvision.leaves.read', 'cvision.leaves.approve', 'cvision.loans.read', 'cvision.loans.approve', 'cvision.travel.read', 'cvision.travel.approve', 'cvision.training.read', 'cvision.training.approve', 'cvision.performance.read', 'cvision.performance.write', 'cvision.policies.read', 'cvision.delegation.manage'],
    recruiter: ['cvision.view', 'cvision.org.read', 'cvision.employees.read', 'cvision.recruitment.read', 'cvision.recruitment.write'],
    supervisor: ['cvision.view', 'cvision.org.read', 'cvision.employees.read', 'cvision.attendance.read', 'cvision.leaves.read', 'cvision.leaves.approve', 'cvision.requests.read', 'cvision.requests.write', 'cvision.performance.read', 'cvision.performance.write', 'cvision.policies.read'],
    auditor: ['cvision.view', 'cvision.org.read', 'cvision.employees.read', 'cvision.attendance.read', 'cvision.leaves.read', 'cvision.loans.read', 'cvision.payroll.read', 'cvision.recruitment.read', 'cvision.performance.read', 'cvision.training.read', 'cvision.travel.read', 'cvision.policies.read', 'cvision.workflows.read', 'cvision.audit.read'],
    employee: ['cvision.view', 'cvision.policies.read', 'cvision.leaves.read', 'cvision.attendance.read', 'cvision.training.read', 'cvision.performance.read', 'cvision.requests.read'],
  };
  return (ROLE_MAP[role] || []).includes(perm);
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  EXPIRED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  REVOKED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }

/* ═══════════════════════════════════════════════════════════════════
 *  Page
 * ═══════════════════════════════════════════════════════════════════ */

export default function AccessControlPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();

  // ── Audit pagination state ──
  const [auditPage, setAuditPage] = useState(1);
  const [auditSearch, setAuditSearch] = useState('');

  // ── Roles ──
  const { data: rolesRaw, isLoading: loadingRoles } = useQuery({
    queryKey: ['cvision', 'roles', 'list'],
    queryFn: () => cvisionFetch<any>('/api/cvision/roles', { params: { action: 'list' } }),
  });
  const roles: any[] = (rolesRaw as any)?.data || [];

  const { data: userRolesRaw } = useQuery({
    queryKey: ['cvision', 'roles', 'user-roles'],
    queryFn: () => cvisionFetch<any>('/api/cvision/roles', { params: { action: 'user-roles' } }),
  });
  const userRoles: any[] = (userRolesRaw as any)?.data || [];

  const { data: roleStatsRaw } = useQuery({
    queryKey: ['cvision', 'roles', 'stats'],
    queryFn: () => cvisionFetch<any>('/api/cvision/roles', { params: { action: 'stats' } }),
  });
  const roleStats: any = (roleStatsRaw as any)?.data || {};

  // ── Role mutations ──
  const seedRolesMutation = useMutation({
    mutationFn: () => cvisionMutate('/api/cvision/roles', 'POST', { action: 'seed' }),
    onSuccess: () => { toast.success(tr('تم إنشاء الأدوار الافتراضية', 'Default roles seeded')); queryClient.invalidateQueries({ queryKey: ['cvision', 'roles'] }); },
    onError: (err: any) => toast.error(err.message || tr('فشل', 'Failed')),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: string) => cvisionMutate('/api/cvision/roles', 'POST', { action: 'delete', roleId }),
    onSuccess: () => { toast.success(tr('تم حذف الدور', 'Role deleted')); queryClient.invalidateQueries({ queryKey: ['cvision', 'roles'] }); },
    onError: (err: any) => toast.error(err.message || tr('فشل', 'Failed')),
  });

  const removeUserRoleMutation = useMutation({
    mutationFn: (d: { userId: string; roleId: string }) => cvisionMutate('/api/cvision/roles', 'POST', { action: 'remove', ...d }),
    onSuccess: () => { toast.success(tr('تم إزالة الدور', 'Role removed')); queryClient.invalidateQueries({ queryKey: ['cvision', 'roles'] }); },
    onError: (err: any) => toast.error(err.message || tr('فشل', 'Failed')),
  });

  // ── Delegations ──
  const { data: delegRaw, isLoading: loadingDeleg } = useQuery({
    queryKey: ['cvision', 'delegations', 'list'],
    queryFn: () => cvisionFetch<any>('/api/cvision/delegations', { params: { action: 'list' } }),
  });
  const delegOut: Delegation[] = (delegRaw as any)?.outgoing || [];
  const delegIn: Delegation[] = (delegRaw as any)?.incoming || [];

  // ── Approval matrix ──
  const { data: matRaw } = useQuery({
    queryKey: ['cvision', 'approval-matrix', 'list'],
    queryFn: () => cvisionFetch<any>('/api/cvision/approval-matrix', { params: { action: 'list' } }),
  });
  const matrixRules: ApprovalRule[] = ((matRaw as any)?.data as ApprovalRule[]) || [];

  // ── Audit log ──
  const { data: logRaw } = useQuery({
    queryKey: cvisionKeys.auditLog.list({ action: 'list', page: String(auditPage), limit: '20', search: auditSearch }),
    queryFn: () => cvisionFetch<any>('/api/cvision/audit-log', { params: { action: 'list', page: String(auditPage), limit: '20', ...(auditSearch ? { search: auditSearch } : {}) } }),
  });
  const auditEntries: AuditEntry[] = ((logRaw as any)?.data as AuditEntry[]) || [];
  const auditPages = (logRaw as any)?.pages || 1;

  // ── Audit stats ──
  const { data: statRaw } = useQuery({
    queryKey: ['cvision', 'audit-log', 'stats'],
    queryFn: () => cvisionFetch<any>('/api/cvision/audit-log', { params: { action: 'stats', days: '30' } }),
  });
  const auditStats: AuditStats | null = ((statRaw as any)?.data as AuditStats) || null;

  const loading = loadingDeleg || loadingRoles;

  const fetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ['cvision', 'roles'] });
    queryClient.invalidateQueries({ queryKey: ['cvision', 'delegations'] });
    queryClient.invalidateQueries({ queryKey: ['cvision', 'approval-matrix'] });
    queryClient.invalidateQueries({ queryKey: cvisionKeys.auditLog.all });
    queryClient.invalidateQueries({ queryKey: ['cvision', 'audit-log'] });
  };

  const fetchAuditPage = useCallback(async (p: number, q?: string) => {
    setAuditPage(p);
    if (q !== undefined) setAuditSearch(q);
  }, []);

  const revokeMutation = useMutation({
    mutationFn: (delegationId: string) => cvisionMutate('/api/cvision/delegations', 'POST', { action: 'revoke', delegationId }),
    onSuccess: () => { toast.success(tr('تم إلغاء التفويض', 'Delegation revoked')); fetchAll(); },
    onError: (err: any) => toast.error(err.message || tr('فشل', 'Failed')),
  });

  const revokeDelegation = useCallback(async (delegationId: string) => {
    revokeMutation.mutate(delegationId);
  }, [revokeMutation]);

  if (loading) return <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}><CVisionSkeletonCard C={C} height={200} style={{ height: 32, width: 320 }}  /><CVisionSkeletonCard C={C} height={200} style={{ height: 256 }}  /></div>;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>{tr('التحكم في الوصول والتفويض', 'Access Control & Delegation')}</h1>
        <p style={{ color: C.textMuted }}>الصلاحيات والتفويضات ومصفوفة الموافقات وسجل التدقيق</p>
      </div>

      <CVisionTabs
        C={C}
        defaultTab="manage-roles"
        tabs={[
          { id: 'manage-roles', label: tr('إدارة الأدوار', 'Manage Roles'), icon: <Shield style={{ height: 14, width: 14 }} /> },
          { id: 'user-assignments', label: tr('إسناد المستخدمين', 'User Assignments'), icon: <Key style={{ height: 14, width: 14 }} /> },
          { id: 'roles', label: tr('مصفوفة الصلاحيات', 'Permission Matrix'), icon: <ShieldCheck style={{ height: 14, width: 14 }} /> },
          { id: 'delegations', label: tr('التفويضات', 'Delegations'), icon: <Users style={{ height: 14, width: 14 }} /> },
          { id: 'matrix', label: tr('مصفوفة الموافقات', 'Approval Matrix'), icon: <GitBranch style={{ height: 14, width: 14 }} /> },
          { id: 'audit', label: tr('سجل التدقيق', 'Audit Log'), icon: <FileText style={{ height: 14, width: 14 }} /> },
        ]}
      >
        {/* ═══ Tab: Manage Roles ═══ */}
        <CVisionTabContent tabId="manage-roles">
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 16 }}><div style={{ fontSize: 24, fontWeight: 700 }}>{roleStats.totalRoles || 0}</div><div style={{ fontSize: 12, color: C.textMuted }}>{tr('الأدوار', 'Roles')}</div></CVisionCardBody></CVisionCard>
            <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 16 }}><div style={{ fontSize: 24, fontWeight: 700 }}>{roleStats.assignedUsers || 0}</div><div style={{ fontSize: 12, color: C.textMuted }}>{tr('المستخدمون المُسندة', 'Assigned Users')}</div></CVisionCardBody></CVisionCard>
            <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 16 }}><div style={{ fontSize: 24, fontWeight: 700 }}>{roleStats.activeDelegations || 0}</div><div style={{ fontSize: 12, color: C.textMuted }}>{tr('التفويضات النشطة', 'Active Delegations')}</div></CVisionCardBody></CVisionCard>
            <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 16 }}><div style={{ fontSize: 24, fontWeight: 700, color: roleStats.criticalEvents ? C.red : C.text }}>{roleStats.criticalEvents || 0}</div><div style={{ fontSize: 12, color: C.textMuted }}>{tr('أحداث حرجة (7 أيام)', 'Critical Events (7d)')}</div></CVisionCardBody></CVisionCard>
          </div>

          {/* Seed button */}
          {roles.length === 0 && (
            <CVisionCard C={C}>
              <CVisionCardBody style={{ paddingTop: 24, paddingBottom: 24, textAlign: 'center' }}>
                <p style={{ color: C.textMuted, marginBottom: 12 }}>{tr('لم يتم إنشاء أدوار بعد. اضغط لإنشاء الأدوار الافتراضية.', 'No roles created yet. Click to seed default roles.')}</p>
                <CVisionButton C={C} isDark={isDark} onClick={() => seedRolesMutation.mutate()}>
                  <Shield style={{ height: 14, width: 14, marginRight: 6 }} />{tr('إنشاء الأدوار الافتراضية', 'Seed Default Roles')}
                </CVisionButton>
              </CVisionCardBody>
            </CVisionCard>
          )}

          {/* Roles list */}
          {roles.length > 0 && (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('الأدوار المتاحة', 'Available Roles')}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{tr('أدوار CVision المستقلة — النظامية محمية من الحذف', 'Independent CVision roles — system roles are protected')}</div>
              </CVisionCardHeader>
              <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {roles.map((role: any) => (
                  <div key={role.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Shield style={{ height: 16, width: 16, color: role.isSystem ? C.gold : C.textMuted }} />
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{role.name}</span>
                        <CVisionBadge C={C} variant="outline" className="text-[10px]" style={{ fontFamily: 'monospace' }}>{role.code}</CVisionBadge>
                        {role.isSystem && <CVisionBadge C={C} className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">{tr('نظامي', 'System')}</CVisionBadge>}
                        <CVisionBadge C={C} variant="outline" className="text-[10px]">{role.dataScope}</CVisionBadge>
                      </div>
                      {!role.isSystem && (
                        <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ height: 24, color: C.red }} onClick={() => deleteRoleMutation.mutate(role.id)}>
                          <XCircle style={{ height: 12, width: 12, marginRight: 4 }} />{tr('حذف', 'Delete')}
                        </CVisionButton>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{role.description}</p>
                    {role.approvalAuthority?.canApprove?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: C.textMuted }}>{tr('يوافق على:', 'Approves:')}</span>
                        {role.approvalAuthority.canApprove.map((a: string) => (
                          <CVisionBadge key={a} C={C} variant="outline" className="text-[10px]">{a}</CVisionBadge>
                        ))}
                        {role.approvalAuthority.maxApprovalAmount > 0 && (
                          <CVisionBadge C={C} variant="outline" className="text-[10px]">{tr('حد:', 'Limit:')} {role.approvalAuthority.maxApprovalAmount.toLocaleString()} SAR</CVisionBadge>
                        )}
                      </div>
                    )}
                    {role.restrictedFields?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: C.textMuted }}>{tr('حقول محظورة:', 'Restricted:')}</span>
                        {role.restrictedFields.map((f: string) => (
                          <span key={f} style={{ fontSize: 10, background: 'rgba(239,68,68,0.1)', color: C.red, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1, borderRadius: 4, fontFamily: 'monospace' }}>{f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CVisionCardBody>
            </CVisionCard>
          )}
        </div>
        </CVisionTabContent>

        {/* ═══ Tab: User Assignments ═══ */}
        <CVisionTabContent tabId="user-assignments">
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('إسناد الأدوار للمستخدمين', 'User Role Assignments')}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{tr('المستخدمون وأدوارهم في CVision', 'Users and their CVision roles')}</div>
            </CVisionCardHeader>
            <CVisionCardBody>
              {userRoles.length === 0 && (
                <p style={{ fontSize: 13, color: C.textMuted, paddingTop: 16, paddingBottom: 16, textAlign: 'center' }}>
                  {tr('لم يتم إسناد أدوار CVision لأي مستخدم بعد.', 'No CVision role assignments yet.')}
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {userRoles.map((ur: any) => (
                  <div key={ur.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Users style={{ height: 14, width: 14, color: C.gold }} />
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{ur.userName || ur.userId}</span>
                      <span style={{ fontSize: 11, color: C.textMuted }}>ID: {ur.userId.slice(0, 8)}...</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {(ur.roleIds || []).map((rid: string) => {
                        const matchedRole = roles.find((r: any) => r.id === rid || r.code === rid);
                        return (
                          <div key={rid} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <CVisionBadge C={C} className="text-[11px]" style={{ background: rid === ur.primaryRoleId ? C.gold + '22' : undefined }}>
                              {matchedRole?.name || rid}
                            </CVisionBadge>
                            <button
                              style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.red, fontSize: 12, padding: 0, lineHeight: 1 }}
                              title={tr('إزالة الدور', 'Remove role')}
                              onClick={() => removeUserRoleMutation.mutate({ userId: ur.userId, roleId: rid })}
                            >×</button>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                      {tr('أُسند بواسطة:', 'Assigned by:')} {ur.assignedBy?.slice(0, 8)}... | {fmtDate(ur.updatedAt || ur.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </CVisionCardBody>
          </CVisionCard>
        </div>
        </CVisionTabContent>

        {/* ═══ Tab: Permission Matrix ═══ */}
        <CVisionTabContent tabId="roles">
        <div style={{ marginTop: 16 }}>
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}><div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('الأدوار × الصلاحيات', 'Roles × Permissions')}</div><div style={{ fontSize: 12, color: C.textMuted }}>{tr('مصفوفة صلاحيات ثابتة — أخضر = ممنوح', 'Static permission matrix — green = granted')}</div></CVisionCardHeader>
            <CVisionCardBody style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ textAlign: 'left', paddingTop: 8, paddingBottom: 8, paddingLeft: 4, paddingRight: 4, position: 'sticky', background: C.bgCard, zIndex: 10, width: 144 }}>{tr('الصلاحية', 'Permission')}</th>
                    {ROLES.map(r => <th key={r} style={{ textAlign: 'center', paddingTop: 8, paddingBottom: 8, paddingLeft: 4, paddingRight: 4 }}>{r}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {PERM_GROUPS.map(g => (
                    <React.Fragment key={g.group}>
                      <tr><td colSpan={ROLES.length + 1} style={{ paddingTop: 12, paddingBottom: 4, paddingLeft: 4, paddingRight: 4, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase' }}>{g.group}</td></tr>
                      {g.perms.map(p => {
                        const short = p.replace('cvision.', '');
                        return (
                          <tr key={p} style={{ borderBottom: `1px solid ${C.border}` }}>
                            <td style={{ paddingTop: 6, paddingBottom: 6, paddingLeft: 4, paddingRight: 4, position: 'sticky', background: C.bgCard, zIndex: 10, fontFamily: 'monospace' }}>{short}</td>
                            {ROLES.map(r => (
                              <td key={r} style={{ textAlign: 'center', paddingTop: 6, paddingBottom: 6, paddingLeft: 4, paddingRight: 4 }}>
                                {roleHasPerm(r, p) ? <Check style={{ height: 14, width: 14, color: C.green }} /> : <X style={{ height: 14, width: 14 }} />}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </CVisionCardBody>
          </CVisionCard>
        </div>
        </CVisionTabContent>

        {/* ═══ Tab 2: Delegations ═══ */}
        <CVisionTabContent tabId="delegations">
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('التفويضات الصادرة', 'Outgoing Delegations')}</div><div style={{ fontSize: 12, color: C.textMuted }}>{tr('صلاحيات فوّضتها للآخرين', 'Permissions I delegated to others')}</div></CVisionCardHeader>
              <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {delegOut.length === 0 && <p style={{ fontSize: 13, color: C.textMuted, paddingTop: 8, paddingBottom: 8 }}>{tr('لا توجد تفويضات صادرة.', 'No outgoing delegations.')}</p>}
                {delegOut.map(d => (
                  <div key={d.delegationId} style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>→ {d.delegateName}</span>
                      <CVisionBadge C={C} className={`text-[10px] ${STATUS_COLORS[d.status] || ''}`}>{d.status}</CVisionBadge>
                      <CVisionBadge C={C} variant="outline" className="text-[10px]">{d.scope}</CVisionBadge>
                      {(d.status === 'ACTIVE' || d.status === 'PENDING') && (
                        <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ height: 24, paddingLeft: 8, paddingRight: 8, color: C.red }} onClick={() => revokeDelegation(d.delegationId)}>
                          <XCircle style={{ height: 12, width: 12, marginRight: 4 }} />{tr('إلغاء', 'Revoke')}
                        </CVisionButton>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{fmtDate(d.startDate)} → {fmtDate(d.endDate)}</div>
                    {d.reason && <div style={{ fontSize: 12, marginTop: 2 }}>{d.reason}</div>}
                    {d.scope === 'SPECIFIC' && d.permissions.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>{d.permissions.slice(0, 5).map(p => <span key={p} style={{ background: C.bgSubtle, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 6, fontFamily: 'monospace' }}>{p.replace('cvision.', '')}</span>)}{d.permissions.length > 5 && <span style={{ color: C.textMuted }}>+{d.permissions.length - 5} more</span>}</div>
                    )}
                  </div>
                ))}
              </CVisionCardBody>
            </CVisionCard>

            <CVisionCard C={C}>
              <CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('التفويضات الواردة', 'Incoming Delegations')}</div><div style={{ fontSize: 12, color: C.textMuted }}>{tr('صلاحيات مفوّضة لي', 'Permissions delegated to me')}</div></CVisionCardHeader>
              <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {delegIn.length === 0 && <p style={{ fontSize: 13, color: C.textMuted, paddingTop: 8, paddingBottom: 8 }}>{tr('لا توجد تفويضات واردة.', 'No incoming delegations.')}</p>}
                {delegIn.map(d => (
                  <div key={d.delegationId} style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>← {d.delegatorName}</span>
                      <CVisionBadge C={C} className={`text-[10px] ${STATUS_COLORS[d.status] || ''}`}>{d.status}</CVisionBadge>
                      <CVisionBadge C={C} variant="outline" className="text-[10px]">{d.scope}</CVisionBadge>
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{fmtDate(d.startDate)} → {fmtDate(d.endDate)}</div>
                    {d.reason && <div style={{ fontSize: 12, marginTop: 2 }}>{d.reason}</div>}
                  </div>
                ))}
              </CVisionCardBody>
            </CVisionCard>
          </div>
        </div>
        </CVisionTabContent>

        {/* ═══ Tab 3: Approval Matrix ═══ */}
        <CVisionTabContent tabId="matrix">
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {matrixRules.length === 0 && (
            <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 32, paddingBottom: 32, textAlign: 'center', color: C.textMuted }}>{tr('لم يتم تكوين قواعد موافقة بعد. استخدم API لإنشاء القواعد.', 'No approval rules configured yet. Use the API to create rules.')}</CVisionCardBody></CVisionCard>
          )}
          {matrixRules.map(rule => (
            <CVisionCard C={C} key={rule.ruleId}>
              <CVisionCardBody style={{ paddingTop: 12, paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <CVisionBadge C={C} variant="outline">{rule.requestType}</CVisionBadge>
                  <span style={{ fontSize: 12, color: C.textMuted }}>{tr('الأولوية', 'Priority')}: {rule.priority}</span>
                  {rule.conditions.minAmount != null && <span style={{ fontSize: 12 }}>≥ {rule.conditions.minAmount} SAR</span>}
                  {rule.conditions.maxAmount != null && <span style={{ fontSize: 12 }}>≤ {rule.conditions.maxAmount} SAR</span>}
                  {rule.conditions.minDays != null && <span style={{ fontSize: 12 }}>≥ {rule.conditions.minDays}d</span>}
                  {rule.conditions.maxDays != null && <span style={{ fontSize: 12 }}>≤ {rule.conditions.maxDays}d</span>}
                  {rule.conditions.departments?.length ? <span style={{ fontSize: 12 }}>{tr('الأقسام', 'Depts')}: {rule.conditions.departments.join(', ')}</span> : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  {rule.approvers.sort((a, b) => a.step - b.step).map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {i > 0 && <ArrowRight style={{ height: 12, width: 12, color: C.textMuted }} />}
                      <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, fontSize: 12 }}>
                        <div style={{ fontWeight: 500 }}>{a.label}</div>
                        <div style={{ color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}><Clock style={{ height: 10, width: 10 }} />{a.timeoutHours}h → {a.timeoutAction}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CVisionCardBody>
            </CVisionCard>
          ))}
        </div>
        </CVisionTabContent>

        {/* ═══ Tab 4: Audit Log ═══ */}
        <CVisionTabContent tabId="audit">
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {auditStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 16 }}><div style={{ fontSize: 24, fontWeight: 700 }}>{auditStats.total}</div><div style={{ fontSize: 12, color: C.textMuted }}>{tr('إجمالي العمليات (30 يوم)', 'Total ops (30d)')}</div></CVisionCardBody></CVisionCard>
              <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 16 }}><div style={{ fontSize: 24, fontWeight: 700, color: C.red }}>{auditStats.denials}</div><div style={{ fontSize: 12, color: C.textMuted }}>{tr('المرفوضات', 'Denials')}</div></CVisionCardBody></CVisionCard>
              <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 16 }}><div style={{ fontSize: 24, fontWeight: 700 }}>{auditStats.byModule?.length || 0}</div><div style={{ fontSize: 12, color: C.textMuted }}>{tr('الوحدات', 'Modules')}</div></CVisionCardBody></CVisionCard>
              <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 16 }}><div style={{ fontSize: 24, fontWeight: 700 }}>{auditStats.topUsers?.length || 0}</div><div style={{ fontSize: 12, color: C.textMuted }}>{tr('المستخدمون النشطون', 'Active users')}</div></CVisionCardBody></CVisionCard>
            </div>
          )}

          {auditStats && auditStats.topUsers.length > 0 && (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}><div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tr('أكثر المستخدمين نشاطاً (30 يوم)', 'Most Active Users (30d)')}</div></CVisionCardHeader>
              <CVisionCardBody>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {auditStats.topUsers.slice(0, 5).map((u, i) => (
                    <CVisionBadge C={C} key={i} variant="outline" style={{ fontSize: 12 }}>{u.email || u.userId} — {u.count} ops</CVisionBadge>
                  ))}
                </div>
              </CVisionCardBody>
            </CVisionCard>
          )}

          <CVisionCard C={C}>
            <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('مسار التدقيق', 'Audit Trail')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', height: 14, width: 14, color: C.textMuted }} />
                    <CVisionInput C={C} placeholder={tr('بحث...', 'Search...')} style={{ height: 32, width: 192, paddingLeft: 28, fontSize: 12 }} value={auditSearch} onChange={e => setAuditSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchAuditPage(1, auditSearch)} />
                  </div>
                  <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ height: 32 }} onClick={() => fetchAuditPage(1, auditSearch)}>{tr('بحث', 'Go')}</CVisionButton>
                </div>
              </div>
            </CVisionCardHeader>
            <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {auditEntries.length === 0 && <p style={{ fontSize: 13, color: C.textMuted, paddingTop: 16, paddingBottom: 16, textAlign: 'center' }}>{tr('لم يتم العثور على سجلات تدقيق.', 'No audit entries found.')}</p>}
              {auditEntries.map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, borderBottom: `1px solid ${C.border}`, paddingTop: 6, paddingBottom: 6 }}>
                  <div className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${e.success ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 500 }}>{e.action}</span>
                    <span style={{ color: C.textMuted }}> {tr('على', 'on')} </span>
                    <span style={{ fontFamily: 'monospace' }}>{e.resourceType}</span>
                    <span style={{ color: C.textMuted }}> {tr('بواسطة', 'by')} </span>
                    <span>{e.actorEmail || e.actorUserId}</span>
                    <span style={{ color: C.textMuted }}> ({e.actorRole})</span>
                  </div>
                  <span style={{ color: C.textMuted, whiteSpace: 'nowrap' }}>{fmtDate(e.createdAt)}</span>
                </div>
              ))}

              {auditPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 8 }}>
                  <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" disabled={auditPage <= 1} onClick={() => fetchAuditPage(auditPage - 1, auditSearch)}><ChevronLeft style={{ height: 16, width: 16 }} /></CVisionButton>
                  <span style={{ fontSize: 12 }}>{auditPage} / {auditPages}</span>
                  <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" disabled={auditPage >= auditPages} onClick={() => fetchAuditPage(auditPage + 1, auditSearch)}><ChevronRight style={{ height: 16, width: 16 }} /></CVisionButton>
                </div>
              )}
            </CVisionCardBody>
          </CVisionCard>
        </div>
        </CVisionTabContent>
      </CVisionTabs>
    </div>
  );
}

// React is already imported via JSX transform but we need the namespace for Fragment usage
import React from 'react';
