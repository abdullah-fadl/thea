'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTextarea, CVisionSelect, CVisionDialog, CVisionDialogFooter , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useDevMode } from '@/lib/dev-mode';

import {
  AlertTriangle, Shield, Users, Calendar, Clock, ChevronRight, Search,
  Download, Plus, FileText, Eye, XCircle, CheckCircle, BarChart3, TrendingUp,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface Warning {
  warningNumber: string;
  employeeId: string;
  employeeName: string;
  department: string;
  jobTitle: string;
  type: string;
  severity: string;
  category: string;
  incidentDate: string;
  incidentDescription: string;
  laborLawArticle?: string;
  previousWarnings: number;
  escalationLevel: number;
  actionTaken: string;
  suspensionDays: number;
  status: string;
  acknowledgedAt?: string;
  employeeResponse?: string;
  appealDate?: string;
  appealReason?: string;
  appealDecision?: string;
  expiryDate: string;
  isActive: boolean;
  issuedAt?: string;
  createdAt: string;
}

interface Stats {
  totalThisYear: number;
  activeWarnings: number;
  pendingReview: number;
  critical: number;
  expiringSoon: number;
  uniqueEmployees: number;
  acknowledgedRate: number;
  appealedRate: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  byDepartment: Record<string, number>;
  bySeverity: Record<string, number>;
  byMonth: Record<string, number>;
  repeatOffenders: { employeeId: string; employeeName: string; count: number; department?: string }[];
}

interface Employee {
  id: string;
  fullName?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  departmentId?: string;
  jobTitle?: string;
  positionTitle?: string;
  hireDate?: string;
  status?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const getWarningTypeLabels = (tr: (ar: string, en: string) => string): Record<string, { label: string; color: string }> => ({
  VERBAL_WARNING: { label: tr('إنذار شفهي', 'Verbal Warning'), color: 'bg-gray-100 text-gray-800 border-gray-300' },
  FIRST_WRITTEN: { label: '1st Written', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  SECOND_WRITTEN: { label: '2nd Written', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  FINAL_WARNING: { label: tr('إنذار نهائي', 'Final Warning'), color: 'bg-red-100 text-red-800 border-red-300' },
  SUSPENSION: { label: tr('إيقاف', 'Suspension'), color: 'bg-red-200 text-red-900 border-red-400' },
  TERMINATION: { label: tr('فصل', 'Termination'), color: 'bg-gray-900 text-white border-gray-900' },
});

const SEVERITY_COLORS: Record<string, string> = {
  MINOR: 'border-l-yellow-400',
  MODERATE: 'border-l-orange-400',
  MAJOR: 'border-l-red-500',
  CRITICAL: 'border-l-red-800',
};

const SEVERITY_BADGE: Record<string, string> = {
  MINOR: 'bg-yellow-100 text-yellow-800',
  MODERATE: 'bg-orange-100 text-orange-800',
  MAJOR: 'bg-red-100 text-red-800',
  CRITICAL: 'bg-red-200 text-red-900',
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING_REVIEW: 'bg-blue-100 text-blue-800',
  ISSUED: 'bg-indigo-100 text-indigo-800',
  ACKNOWLEDGED: 'bg-green-100 text-green-800',
  APPEALED: 'bg-amber-100 text-amber-800',
  APPEAL_APPROVED: 'bg-emerald-100 text-emerald-800',
  APPEAL_REJECTED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-500',
  REVOKED: 'bg-gray-100 text-gray-500 line-through',
};

const CATEGORIES = [
  'ATTENDANCE', 'PERFORMANCE', 'CONDUCT', 'POLICY_VIOLATION',
  'SAFETY', 'INSUBORDINATION', 'HARASSMENT', 'THEFT', 'OTHER',
];

const CATEGORY_LABELS: Record<string, string> = {
  ATTENDANCE: 'Attendance',
  PERFORMANCE: 'Performance',
  CONDUCT: 'Conduct',
  POLICY_VIOLATION: 'Policy Violation',
  SAFETY: 'Safety',
  INSUBORDINATION: 'Insubordination',
  HARASSMENT: 'Harassment',
  THEFT: 'Theft',
  OTHER: 'Other',
};

const LABOR_LAW_ARTICLES = [
  { value: 'Article 66', label: 'Article 66 — Penalties for violations' },
  { value: 'Article 80', label: 'Article 80 — Termination without notice/compensation' },
  { value: 'Article 81', label: 'Article 81 — Employee right to leave without notice' },
  { value: 'Article 71', label: 'Article 71 — Probation period termination' },
  { value: 'Article 75', label: 'Article 75 — Contract termination' },
];

const getEscalationSteps = (tr: (ar: string, en: string) => string) => [
  { key: 'VERBAL_WARNING', label: tr('شفهي', 'Verbal') },
  { key: 'FIRST_WRITTEN', label: '1st Written' },
  { key: 'SECOND_WRITTEN', label: '2nd Written' },
  { key: 'FINAL_WARNING', label: tr('نهائي', 'Final') },
  { key: 'SUSPENSION', label: tr('إيقاف', 'Suspend') },
  { key: 'TERMINATION', label: tr('فصل', 'Terminate') },
];

const getSeverityOptions = (tr: (ar: string, en: string) => string) => [
  { value: 'MINOR', label: tr('بسيط', 'Minor'), desc: 'First occurrence, minimal impact' },
  { value: 'MODERATE', label: tr('متوسط', 'Moderate'), desc: 'Repeated occurrence or noticeable impact' },
  { value: 'MAJOR', label: tr('كبير', 'Major'), desc: 'Serious violation with significant impact' },
  { value: 'CRITICAL', label: tr('حرج', 'Critical'), desc: 'Severe violation, immediate action required' },
];

// ─── Helper functions ───────────────────────────────────────────────────────────

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getEmpName(emp: any) {
  return emp.fullName || emp.name || `${emp.firstName || emp.firstNameEn || ''} ${emp.lastName || emp.lastNameEn || ''}`.trim() || 'Unknown';
}

// ─── Escalation Progress Bar ────────────────────────────────────────────────────

function EscalationBar({ level }: { level: number }) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const ESCALATION_STEPS = getEscalationSteps(tr);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {ESCALATION_STEPS.map((step, i) => {
        const active = i < level;
        const current = i === level - 1;
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                current ? 'bg-red-500 ring-2 ring-red-200' : active ? 'bg-orange-400' : 'bg-gray-200'
              }`}
              title={step.label}
            />
            {i < ESCALATION_STEPS.length - 1 && (
              <div className={`h-0.5 w-3 ${active ? 'bg-orange-300' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
      <span style={{ marginLeft: 8, fontSize: 12, color: C.textMuted }}>
        Level {level}/6
      </span>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function DisciplinaryPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const WARNING_TYPE_LABELS = getWarningTypeLabels(tr);
  const ESCALATION_STEPS = getEscalationSteps(tr);
  const SEVERITY_OPTIONS = getSeverityOptions(tr);

  const isDev = useDevMode();
  const [activeTab, setActiveTab] = useState('active');
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  // Issue form state
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [escalationInfo, setEscalationInfo] = useState<any>(null);
  const [formStep, setFormStep] = useState(1);
  const [form, setForm] = useState({
    category: '',
    severity: '',
    incidentDate: new Date().toISOString().split('T')[0],
    incidentDescription: '',
    incidentDescriptionAr: '',
    location: '',
    witnesses: '',
    type: '',
    actionTaken: '',
    laborLawArticle: '',
    companyPolicyRef: '',
    suspensionDays: 0,
    salaryDeduction: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  // Employee records tab
  const [recordsSearch, setRecordsSearch] = useState('');
  const [selectedRecordEmployee, setSelectedRecordEmployee] = useState<string | null>(null);
  const [employeeHistory, setEmployeeHistory] = useState<Warning[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Detail modal
  const [detailWarning, setDetailWarning] = useState<Warning | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
    open: false, title: '', message: '', onConfirm: () => {},
  });

  // ── Fetch data (React Query) ──────────────────────────────────────────────────

  const { data: warningsRaw, isLoading: loadingWarnings } = useQuery({
    queryKey: cvisionKeys.disciplinary.list({ action: 'active-warnings' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/disciplinary', { params: { action: 'active-warnings' } }),
  });
  const warnings: Warning[] = warningsRaw?.data?.items || [];

  const { data: statsRaw, isLoading: loadingStats } = useQuery({
    queryKey: cvisionKeys.disciplinary.list({ action: 'stats' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/disciplinary', { params: { action: 'stats' } }),
  });
  const stats: Stats | null = statsRaw?.data || null;

  const { data: employeesRaw } = useQuery({
    queryKey: cvisionKeys.employees.list({ statuses: 'ACTIVE,PROBATION', limit: '500' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/employees', { params: { statuses: 'ACTIVE,PROBATION', limit: '500' } }),
  });
  const employees: Employee[] = (() => {
    const d = employeesRaw;
    if (d?.success && Array.isArray(d?.data)) return d.data;
    if (d?.items) return d.items;
    if (d?.data?.items) return d.data.items;
    if (Array.isArray(d?.data)) return d.data;
    return [];
  })();

  const loading = loadingWarnings;

  const fetchAll = () => {
    queryClient.invalidateQueries({ queryKey: cvisionKeys.disciplinary.all });
    queryClient.invalidateQueries({ queryKey: cvisionKeys.employees.all });
  };

  // ── Escalation check when employee selected ──────────────────────────────────

  const checkEscalation = useCallback(async (employeeId: string) => {
    try {
      const data = await cvisionFetch<any>('/api/cvision/disciplinary', { params: { action: 'escalation-check', employeeId } });
      if (data.success) {
        setEscalationInfo(data.data);
        setForm(prev => ({
          ...prev,
          type: data.data.suggestedType,
          actionTaken: data.data.suggestedAction,
        }));
      }
    } catch { /* ignore */ }
  }, []);

  // ── Employee history ──────────────────────────────────────────────────────────

  const fetchEmployeeHistory = useCallback(async (employeeId: string) => {
    setHistoryLoading(true);
    try {
      const data = await cvisionFetch<any>('/api/cvision/disciplinary', { params: { action: 'employee-history', employeeId } });
      if (data.success) setEmployeeHistory(data.data.items);
    } catch { /* ignore */ }
    setHistoryLoading(false);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────────

  const doAction = useCallback(async (actionName: string, payload: Record<string, any>) => {
    try {
      const data = await cvisionMutate<any>('/api/cvision/disciplinary', 'POST', { action: actionName, ...payload });
      if (!data.success) {
        setError(data.error || 'Action failed');
        return false;
      }
      fetchAll();
      return true;
    } catch {
      setError('Action failed');
      return false;
    }
  }, [fetchAll]);

  const handleIssue = (w: Warning) => {
    setConfirmDialog({
      open: true,
      title: 'Issue Warning',
      message: `Are you sure you want to issue ${w.warningNumber} to ${w.employeeName}? This action will be recorded permanently.`,
      onConfirm: async () => {
        await doAction('issue', { warningNumber: w.warningNumber });
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  };

  const handleRevoke = (w: Warning) => {
    setConfirmDialog({
      open: true,
      title: 'Revoke Warning',
      message: `Revoke warning ${w.warningNumber} for ${w.employeeName}? This will deactivate the warning.`,
      onConfirm: async () => {
        await doAction('revoke', { warningNumber: w.warningNumber, reason: 'Revoked by HR' });
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  };

  const handleCreateWarning = async () => {
    if (!selectedEmployee) return;
    setSubmitting(true);
    const success = await doAction('create', {
      employeeId: selectedEmployee.id,
      type: form.type,
      severity: form.severity,
      category: form.category,
      incidentDate: form.incidentDate,
      incidentDescription: form.incidentDescription,
      incidentDescriptionAr: form.incidentDescriptionAr,
      location: form.location,
      witnesses: form.witnesses ? form.witnesses.split(',').map(w => w.trim()) : [],
      laborLawArticle: form.laborLawArticle,
      companyPolicyRef: form.companyPolicyRef,
      actionTaken: form.actionTaken,
      suspensionDays: form.suspensionDays,
      salaryDeduction: form.salaryDeduction,
    });
    setSubmitting(false);
    if (success) {
      setSelectedEmployee(null);
      setEscalationInfo(null);
      setFormStep(1);
      setForm({
        category: '', severity: '', incidentDate: new Date().toISOString().split('T')[0],
        incidentDescription: '', incidentDescriptionAr: '', location: '', witnesses: '',
        type: '', actionTaken: '', laborLawArticle: '', companyPolicyRef: '',
        suspensionDays: 0, salaryDeduction: 0,
      });
      setActiveTab('active');
    }
  };

  const handleSeed = async () => {
    await doAction('seed', {});
  };

  // ── Filtered employees for search ─────────────────────────────────────────────

  const filteredEmployees = empSearch.length >= 2
    ? employees.filter(e => {
        const name = getEmpName(e).toLowerCase();
        return name.includes(empSearch.toLowerCase()) || e.id.toLowerCase().includes(empSearch.toLowerCase());
      }).slice(0, 10)
    : [];

  const recordsFilteredEmployees = recordsSearch.length >= 2
    ? employees.filter(e => {
        const name = getEmpName(e).toLowerCase();
        return name.includes(recordsSearch.toLowerCase()) || e.id.toLowerCase().includes(recordsSearch.toLowerCase());
      }).slice(0, 10)
    : [];

  // ── Loading skeleton ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <CVisionSkeletonCard C={C} height={200} style={{ height: 40, width: 256 }}  />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          {[...Array(5)].map((_, i) => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 96 }}  />)}
        </div>
        <CVisionSkeletonCard C={C} height={200} style={{ height: 384 }}  />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield style={{ height: 24, width: 24, color: C.red }} />
            Disciplinary Actions
          </h1>
          <p style={{ color: C.textMuted, marginTop: 4 }}>
            Manage warnings, disciplinary records, and progressive discipline tracking
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isDev && (
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={handleSeed}>
              Seed Data
            </CVisionButton>
          )}
          <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => { setActiveTab('issue'); setFormStep(1); }}>
            <Plus style={{ height: 16, width: 16, marginRight: 4 }} /> Issue Warning
          </CVisionButton>
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgSubtle }}>
          <div style={{ fontSize: 13, color: C.textSecondary }}>{error}</div>
          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" className="ml-auto" onClick={() => setError('')}>Dismiss</CVisionButton>
        </div>
      )}

      {/* Tabs */}
      <CVisionTabs
        C={C}
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'active', label: tr('إنذارات نشطة', 'Active Warnings'), icon: <AlertTriangle style={{ height: 16, width: 16 }} /> },
          { id: 'issue', label: tr('إصدار إنذار', 'Issue Warning'), icon: <FileText style={{ height: 16, width: 16 }} /> },
          { id: 'records', label: tr('سجلات الموظفين', 'Employee Records'), icon: <Users style={{ height: 16, width: 16 }} /> },
          { id: 'analytics', label: tr('التحليلات', 'Analytics'), icon: <BarChart3 style={{ height: 16, width: 16 }} /> },
        ]}
      >
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: Active Warnings                                               */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <CVisionTabContent tabId="active">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 24 }}>
          {/* Stats bar */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <CVisionCard C={C}>
                <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12, paddingLeft: 16, paddingRight: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle style={{ height: 20, width: 20, color: C.orange }} />
                    <div>
                      <p style={{ fontSize: 24, fontWeight: 700 }}>{stats.activeWarnings}</p>
                      <p style={{ fontSize: 12, color: C.textMuted }}>Active Warnings</p>
                    </div>
                  </div>
                </CVisionCardBody>
              </CVisionCard>
              <CVisionCard C={C}>
                <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12, paddingLeft: 16, paddingRight: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText style={{ height: 20, width: 20, color: C.blue }} />
                    <div>
                      <p style={{ fontSize: 24, fontWeight: 700 }}>{stats.pendingReview}</p>
                      <p style={{ fontSize: 12, color: C.textMuted }}>Pending Review</p>
                    </div>
                  </div>
                </CVisionCardBody>
              </CVisionCard>
              <CVisionCard C={C} className={stats.critical > 0 ? 'ring-2 ring-red-400' : ''}>
                <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12, paddingLeft: 16, paddingRight: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <XCircle className={`h-5 w-5 text-red-600 ${stats.critical > 0 ? 'animate-pulse' : ''}`} />
                    <div>
                      <p style={{ fontSize: 24, fontWeight: 700, color: C.red }}>{stats.critical}</p>
                      <p style={{ fontSize: 12, color: C.textMuted }}>Critical</p>
                    </div>
                  </div>
                </CVisionCardBody>
              </CVisionCard>
              <CVisionCard C={C}>
                <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12, paddingLeft: 16, paddingRight: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Calendar style={{ height: 20, width: 20, color: C.orange }} />
                    <div>
                      <p style={{ fontSize: 24, fontWeight: 700 }}>{stats.expiringSoon}</p>
                      <p style={{ fontSize: 12, color: C.textMuted }}>Expiring Soon</p>
                    </div>
                  </div>
                </CVisionCardBody>
              </CVisionCard>
              <CVisionCard C={C}>
                <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12, paddingLeft: 16, paddingRight: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users style={{ height: 20, width: 20, color: C.purple }} />
                    <div>
                      <p style={{ fontSize: 24, fontWeight: 700 }}>{stats.uniqueEmployees}</p>
                      <p style={{ fontSize: 12, color: C.textMuted }}>Employees Affected</p>
                    </div>
                  </div>
                </CVisionCardBody>
              </CVisionCard>
            </div>
          )}

          {/* Warning cards */}
          {warnings.length === 0 ? (
            <CVisionCard C={C}>
              <CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center', color: C.textMuted }}>
                <Shield style={{ height: 48, width: 48, marginBottom: 12, opacity: 0.3 }} />
                <p style={{ fontSize: 16, fontWeight: 500 }}>No active warnings</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>All clear! Click &quot;Issue Warning&quot; to create a new disciplinary action.</p>
              </CVisionCardBody>
            </CVisionCard>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {warnings.map((w) => (
                <CVisionCard C={C} key={w.warningNumber} className={`border-l-4 ${SEVERITY_COLORS[w.severity] || 'border-l-gray-300'}`}>
                  <CVisionCardBody style={{ padding: 20 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      {/* Top row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: C.textMuted }}>{w.warningNumber}</span>
                        <CVisionBadge C={C} className={SEVERITY_BADGE[w.severity] || ''}>{w.severity}</CVisionBadge>
                        <CVisionBadge C={C} className={WARNING_TYPE_LABELS[w.type]?.color || ''}>{WARNING_TYPE_LABELS[w.type]?.label || w.type}</CVisionBadge>
                      </div>
                      <CVisionBadge C={C} className={STATUS_BADGE[w.status] || ''}>{w.status.replace(/_/g, ' ')}</CVisionBadge>
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Users style={{ height: 16, width: 16, color: C.textMuted }} />
                      <span style={{ fontWeight: 600 }}>{w.employeeName}</span>
                      <span style={{ color: C.textMuted }}>—</span>
                      <span style={{ fontSize: 13, color: C.textMuted }}>{w.department} &middot; {w.jobTitle}</span>
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>{CATEGORY_LABELS[w.category] || w.category}</CVisionBadge>
                    </div>

                    <p style={{ fontSize: 13, marginTop: 8, color: C.textMuted }}>
                      &ldquo;{w.incidentDescription}&rdquo;
                    </p>

                    <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', fontSize: 12, color: C.textMuted }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar style={{ height: 12, width: 12 }} /> Incident: {fmtDate(w.incidentDate)}</span>
                      {w.previousWarnings > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FileText style={{ height: 12, width: 12 }} /> Previous: {w.previousWarnings}</span>
                      )}
                      {w.laborLawArticle && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>&#9878; {w.laborLawArticle}</span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock style={{ height: 12, width: 12 }} /> Expires: {fmtDate(w.expiryDate)}</span>
                    </div>

                    {/* Escalation bar */}
                    <div style={{ marginTop: 12 }}>
                      <EscalationBar level={w.escalationLevel} />
                    </div>

                    {/* Acknowledged / appeal status */}
                    {w.acknowledgedAt && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.green }}>
                        <CheckCircle style={{ height: 12, width: 12 }} /> Acknowledged on {fmtDate(w.acknowledgedAt)}
                      </div>
                    )}
                    {w.appealDate && (
                      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.orange }}>
                        &#9878; Appeal filed on {fmtDate(w.appealDate)}
                        {w.appealReason && <span style={{ marginLeft: 4 }}>— &ldquo;{w.appealReason}&rdquo;</span>}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => { setDetailWarning(w); setDetailOpen(true); }}>
                        <Eye style={{ height: 14, width: 14, marginRight: 4 }} /> View Details
                      </CVisionButton>
                      <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => {
                        setSelectedRecordEmployee(w.employeeId);
                        fetchEmployeeHistory(w.employeeId);
                        setActiveTab('records');
                      }}>
                        Employee History
                      </CVisionButton>
                      {w.status === 'DRAFT' && (
                        <CVisionButton C={C} isDark={isDark} size="sm" variant="default" onClick={() => handleIssue(w)}>
                          Issue Warning
                        </CVisionButton>
                      )}
                      {!['REVOKED', 'EXPIRED', 'APPEAL_APPROVED'].includes(w.status) && (
                        <CVisionButton C={C} isDark={isDark} size="sm" variant="danger" onClick={() => handleRevoke(w)}>
                          <XCircle style={{ height: 14, width: 14, marginRight: 4 }} /> Revoke
                        </CVisionButton>
                      )}
                    </div>
                  </CVisionCardBody>
                </CVisionCard>
              ))}
            </div>
          )}
        </div>
        </CVisionTabContent>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: Issue Warning                                                 */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <CVisionTabContent tabId="issue">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 24 }}>
          {/* Step indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            {[1, 2, 3, 4].map((step) => (
              <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    formStep === step
                      ? 'bg-primary text-primary-foreground'
                      : formStep > step
                        ? 'bg-green-500 text-white'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {formStep > step ? <CheckCircle style={{ height: 16, width: 16 }} /> : step}
                </div>
                <span className={`text-sm ${formStep === step ? 'font-semibold' : 'text-muted-foreground'}`}>
                  {step === 1 ? 'Employee' : step === 2 ? 'Incident' : step === 3 ? 'Action' : 'Review'}
                </span>
                {step < 4 && <ChevronRight style={{ height: 16, width: 16, color: C.textMuted }} />}
              </div>
            ))}
          </div>

          {/* Step 1: Select Employee */}
          {formStep === 1 && (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Select Employee</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>Search for the employee to issue a warning to</div>
              </CVisionCardHeader>
              <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ position: 'relative' }}>
                  <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
                  <CVisionInput C={C}
                    placeholder="Search by name or employee ID..."
                    style={{ paddingLeft: 36 }}
                    value={empSearch}
                    onChange={(e) => { setEmpSearch(e.target.value); setSelectedEmployee(null); setEscalationInfo(null); }}
                  />
                </div>
                {filteredEmployees.length > 0 && !selectedEmployee && (
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 12 }}>
                    {filteredEmployees.map((emp) => (
                      <button
                        key={emp.id}
                        style={{ width: '100%', textAlign: 'left', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, transition: 'color 0.2s, background 0.2s' }}
                        onClick={() => {
                          setSelectedEmployee(emp);
                          setEmpSearch(getEmpName(emp));
                          checkEscalation(emp.id);
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{getEmpName(emp)}</span>
                        <span style={{ fontSize: 13, color: C.textMuted, marginLeft: 8 }}>{emp.jobTitle || emp.positionTitle || ''}</span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedEmployee && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <CVisionCard C={C} className="bg-muted/50">
                      <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12, paddingLeft: 16, paddingRight: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ height: 40, width: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gold, fontWeight: 700 }}>
                            {getEmpName(selectedEmployee).charAt(0)}
                          </div>
                          <div>
                            <p style={{ fontWeight: 600 }}>{getEmpName(selectedEmployee)}</p>
                            <p style={{ fontSize: 13, color: C.textMuted }}>
                              {selectedEmployee.jobTitle || selectedEmployee.positionTitle || 'N/A'} &middot; Since {fmtDate(selectedEmployee.hireDate)}
                            </p>
                          </div>
                        </div>
                      </CVisionCardBody>
                    </CVisionCard>

                    {escalationInfo && (
                      <div style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgSubtle }}>
                        <AlertTriangle style={{ height: 16, width: 16 }} />
                        <div style={{ fontSize: 13, color: C.textSecondary }}>
                          {escalationInfo.activeWarnings === 0 ? (
                            <span style={{ color: C.green }}>This employee has no active warnings. Suggested: <strong>Verbal Warning</strong></span>
                          ) : (
                            <span style={{ color: C.orange }}>
                              This employee has <strong>{escalationInfo.activeWarnings} active warning{escalationInfo.activeWarnings > 1 ? 's' : ''}</strong>.
                              Next escalation level: <strong>{WARNING_TYPE_LABELS[escalationInfo.suggestedType]?.label}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {escalationInfo?.previousWarnings?.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <p style={{ fontSize: 13, fontWeight: 500 }}>Active Warnings:</p>
                        {escalationInfo.previousWarnings.map((pw: Warning) => (
                          <div key={pw.warningNumber} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: 8, borderRadius: 6, background: C.bgSubtle }}>
                            <CVisionBadge C={C} className={WARNING_TYPE_LABELS[pw.type]?.color || ''} variant="outline">
                              {WARNING_TYPE_LABELS[pw.type]?.label}
                            </CVisionBadge>
                            <span>{CATEGORY_LABELS[pw.category] || pw.category}</span>
                            <span style={{ color: C.textMuted }}>— {fmtDate(pw.incidentDate)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <CVisionButton C={C} isDark={isDark} onClick={() => setFormStep(2)}>
                      Continue <ChevronRight style={{ height: 16, width: 16, marginLeft: 4 }} />
                    </CVisionButton>
                  </div>
                )}
              </CVisionCardBody>
            </CVisionCard>
          )}

          {/* Step 2: Incident Details */}
          {formStep === 2 && (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Incident Details</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>Describe the incident that triggered this disciplinary action</div>
              </CVisionCardHeader>
              <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <CVisionLabel C={C}>Category *</CVisionLabel>
                    <CVisionSelect
                C={C}
                value={form.category}
                placeholder="Select category"
                options={CATEGORIES.map(c => (
                          ({ value: c, label: CATEGORY_LABELS[c] })
                        ))}
              />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <CVisionLabel C={C}>Incident Date *</CVisionLabel>
                    <CVisionInput C={C} type="date" value={form.incidentDate} onChange={(e) => setForm(prev => ({ ...prev, incidentDate: e.target.value }))} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <CVisionLabel C={C}>Severity *</CVisionLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    {SEVERITY_OPTIONS.map((s) => (
                      <button
                        key={s.value}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          form.severity === s.value
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-primary/50'
                        }`}
                        onClick={() => setForm(prev => ({ ...prev, severity: s.value }))}
                      >
                        <CVisionBadge C={C} className={SEVERITY_BADGE[s.value]}>{s.label}</CVisionBadge>
                        <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{s.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <CVisionLabel C={C}>Description (English) *</CVisionLabel>
                  <CVisionTextarea C={C}
                    placeholder="Describe the incident in detail..."
                    rows={4}
                    value={form.incidentDescription}
                    onChange={(e) => setForm(prev => ({ ...prev, incidentDescription: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <CVisionLabel C={C}>Description (Arabic)</CVisionLabel>
                  <CVisionTextarea C={C}
                    placeholder="Incident description in Arabic (optional)"
                    rows={3}
                    value={form.incidentDescriptionAr}
                    onChange={(e) => setForm(prev => ({ ...prev, incidentDescriptionAr: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <CVisionLabel C={C}>Location</CVisionLabel>
                    <CVisionInput C={C} placeholder="e.g., Office, Conference Room" value={form.location} onChange={(e) => setForm(prev => ({ ...prev, location: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <CVisionLabel C={C}>Witnesses</CVisionLabel>
                    <CVisionInput C={C} placeholder="Comma-separated names" value={form.witnesses} onChange={(e) => setForm(prev => ({ ...prev, witnesses: e.target.value }))} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setFormStep(1)}>Back</CVisionButton>
                  <CVisionButton C={C} isDark={isDark}
                    onClick={() => setFormStep(3)}
                    disabled={!form.category || !form.severity || !form.incidentDescription}
                  >
                    Continue <ChevronRight style={{ height: 16, width: 16, marginLeft: 4 }} />
                  </CVisionButton>
                </div>
              </CVisionCardBody>
            </CVisionCard>
          )}

          {/* Step 3: Action & Legal Reference */}
          {formStep === 3 && (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Action &amp; Legal Reference</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>Define the warning type, action taken, and legal basis</div>
              </CVisionCardHeader>
              <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <CVisionLabel C={C}>Warning Type *</CVisionLabel>
                    <CVisionSelect
                C={C}
                value={form.type}
                placeholder="Select type"
                options={Object.entries(WARNING_TYPE_LABELS).map(([k, v]) => (
                          ({ value: k, label: v.label })
                        ))}
              />
                    {escalationInfo && form.type !== escalationInfo.suggestedType && (
                      <p style={{ fontSize: 12, color: C.orange }}>
                        Suggested type based on escalation: {WARNING_TYPE_LABELS[escalationInfo.suggestedType]?.label}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <CVisionLabel C={C}>Saudi Labor Law Article</CVisionLabel>
                    <CVisionSelect
                C={C}
                value={form.laborLawArticle}
                placeholder="Select article"
                options={LABOR_LAW_ARTICLES.map(a => (
                          ({ value: a.value, label: a.label })
                        ))}
              />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <CVisionLabel C={C}>Action Taken *</CVisionLabel>
                  <CVisionTextarea C={C}
                    rows={3}
                    value={form.actionTaken}
                    onChange={(e) => setForm(prev => ({ ...prev, actionTaken: e.target.value }))}
                    placeholder="Describe the action taken..."
                  />
                </div>

                {form.type === 'SUSPENSION' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <CVisionLabel C={C}>Suspension Days</CVisionLabel>
                    <CVisionInput C={C} type="number" min={1} value={form.suspensionDays} onChange={(e) => setForm(prev => ({ ...prev, suspensionDays: parseInt(e.target.value) || 0 }))} />
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <CVisionLabel C={C}>Company Policy Reference</CVisionLabel>
                  <CVisionInput C={C} placeholder="e.g., Attendance Policy v2" value={form.companyPolicyRef} onChange={(e) => setForm(prev => ({ ...prev, companyPolicyRef: e.target.value }))} />
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setFormStep(2)}>Back</CVisionButton>
                  <CVisionButton C={C} isDark={isDark} onClick={() => setFormStep(4)} disabled={!form.type || !form.actionTaken}>
                    Continue <ChevronRight style={{ height: 16, width: 16, marginLeft: 4 }} />
                  </CVisionButton>
                </div>
              </CVisionCardBody>
            </CVisionCard>
          )}

          {/* Step 4: Review & Submit */}
          {formStep === 4 && selectedEmployee && (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Review &amp; Issue</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>Review the warning details before saving</div>
              </CVisionCardHeader>
              <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <h4 style={{ fontWeight: 600, fontSize: 13, color: C.textMuted }}>Employee</h4>
                    <p style={{ fontWeight: 500 }}>{getEmpName(selectedEmployee)}</p>
                    <p style={{ fontSize: 13, color: C.textMuted }}>{selectedEmployee.jobTitle || selectedEmployee.positionTitle}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <h4 style={{ fontWeight: 600, fontSize: 13, color: C.textMuted }}>Warning</h4>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <CVisionBadge C={C} className={WARNING_TYPE_LABELS[form.type]?.color || ''}>{WARNING_TYPE_LABELS[form.type]?.label || form.type}</CVisionBadge>
                      <CVisionBadge C={C} className={SEVERITY_BADGE[form.severity] || ''}>{form.severity}</CVisionBadge>
                    </div>
                    <CVisionBadge C={C} variant="outline">{CATEGORY_LABELS[form.category] || form.category}</CVisionBadge>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontWeight: 600, fontSize: 13, color: C.textMuted, marginBottom: 4 }}>Incident ({fmtDate(form.incidentDate)})</h4>
                  <p style={{ fontSize: 13 }}>{form.incidentDescription}</p>
                </div>

                <div>
                  <h4 style={{ fontWeight: 600, fontSize: 13, color: C.textMuted, marginBottom: 4 }}>Action Taken</h4>
                  <p style={{ fontSize: 13 }}>{form.actionTaken}</p>
                </div>

                {form.laborLawArticle && (
                  <div>
                    <h4 style={{ fontWeight: 600, fontSize: 13, color: C.textMuted, marginBottom: 4 }}>Legal Reference</h4>
                    <p style={{ fontSize: 13 }}>{form.laborLawArticle}</p>
                  </div>
                )}

                {/* Impact preview */}
                {escalationInfo && (
                  <div style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgSubtle }}>
                    <TrendingUp style={{ height: 16, width: 16 }} />
                    <div style={{ fontSize: 13, color: C.textSecondary }}>
                      {escalationInfo.activeWarnings === 0
                        ? 'This is the employee\'s first warning. The next occurrence would result in a First Written Warning.'
                        : `This is warning #${escalationInfo.activeWarnings + 1}. ${
                            escalationInfo.activeWarnings >= 3
                              ? 'The next violation may result in suspension or termination.'
                              : `One more will escalate to ${WARNING_TYPE_LABELS[ESCALATION_STEPS[Math.min(escalationInfo.activeWarnings + 1, 5)].key]?.label || 'next level'}.`
                          }`}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
                  <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setFormStep(3)}>Back</CVisionButton>
                  <CVisionButton C={C} isDark={isDark} variant="outline" onClick={handleCreateWarning} disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save as Draft'}
                  </CVisionButton>
                  <CVisionButton C={C} isDark={isDark} onClick={async () => {
                    setSubmitting(true);
                    const success = await doAction('create', {
                      employeeId: selectedEmployee.id,
                      type: form.type,
                      severity: form.severity,
                      category: form.category,
                      incidentDate: form.incidentDate,
                      incidentDescription: form.incidentDescription,
                      incidentDescriptionAr: form.incidentDescriptionAr,
                      location: form.location,
                      witnesses: form.witnesses ? form.witnesses.split(',').map(w => w.trim()) : [],
                      laborLawArticle: form.laborLawArticle,
                      companyPolicyRef: form.companyPolicyRef,
                      actionTaken: form.actionTaken,
                      suspensionDays: form.suspensionDays,
                      salaryDeduction: form.salaryDeduction,
                    });
                    if (success) {
                      // Also immediately issue the created warning
                      const listRes = await fetch('/api/cvision/disciplinary?action=list&status=DRAFT&employeeId=' + selectedEmployee.id + '&limit=1', { credentials: 'include' });
                      const listData = await listRes.json();
                      if (listData.success && listData.data.items.length > 0) {
                        await doAction('issue', { warningNumber: listData.data.items[0].warningNumber });
                      }
                      setSelectedEmployee(null);
                      setEscalationInfo(null);
                      setFormStep(1);
                      setForm({
                        category: '', severity: '', incidentDate: new Date().toISOString().split('T')[0],
                        incidentDescription: '', incidentDescriptionAr: '', location: '', witnesses: '',
                        type: '', actionTaken: '', laborLawArticle: '', companyPolicyRef: '',
                        suspensionDays: 0, salaryDeduction: 0,
                      });
                      setActiveTab('active');
                    }
                    setSubmitting(false);
                  }} disabled={submitting}>
                    {submitting ? 'Issuing...' : 'Issue Warning Now'}
                  </CVisionButton>
                </div>
              </CVisionCardBody>
            </CVisionCard>
          )}
        </div>
        </CVisionTabContent>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: Employee Records                                              */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <CVisionTabContent tabId="records">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 24 }}>
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Employee Disciplinary Records</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>Search for an employee to view their complete disciplinary history</div>
            </CVisionCardHeader>
            <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
                <CVisionInput C={C}
                  placeholder="Search by name or employee ID..."
                  style={{ paddingLeft: 36 }}
                  value={recordsSearch}
                  onChange={(e) => { setRecordsSearch(e.target.value); setSelectedRecordEmployee(null); setEmployeeHistory([]); }}
                />
              </div>
              {recordsFilteredEmployees.length > 0 && !selectedRecordEmployee && (
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 12 }}>
                  {recordsFilteredEmployees.map((emp) => (
                    <button
                      key={emp.id}
                      style={{ width: '100%', textAlign: 'left', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, transition: 'color 0.2s, background 0.2s' }}
                      onClick={() => {
                        setSelectedRecordEmployee(emp.id);
                        setRecordsSearch(getEmpName(emp));
                        fetchEmployeeHistory(emp.id);
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{getEmpName(emp)}</span>
                      <span style={{ fontSize: 13, color: C.textMuted, marginLeft: 8 }}>{emp.jobTitle || emp.positionTitle || ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </CVisionCardBody>
          </CVisionCard>

          {/* Employee profile card */}
          {selectedRecordEmployee && (() => {
            const emp = employees.find(e => e.id === selectedRecordEmployee);
            const activeCount = employeeHistory.filter(w => w.isActive && !['REVOKED', 'EXPIRED'].includes(w.status)).length;
            const totalCount = employeeHistory.length;
            const maxLevel = employeeHistory.length > 0
              ? Math.max(...employeeHistory.filter(w => w.isActive).map(w => w.escalationLevel || 0))
              : 0;

            return (
              <CVisionCard C={C}>
                <CVisionCardBody style={{ padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ height: 56, width: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gold, fontSize: 18, fontWeight: 700 }}>
                        {emp ? getEmpName(emp).charAt(0) : '?'}
                      </div>
                      <div>
                        <h3 style={{ fontSize: 18, fontWeight: 600 }}>{emp ? getEmpName(emp) : 'Unknown'}</h3>
                        <p style={{ color: C.textMuted }}>
                          {emp?.jobTitle || emp?.positionTitle || 'N/A'} &middot; Since {fmtDate(emp?.hireDate)}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 24, textAlign: 'center' }}>
                      <div>
                        <p className={`text-2xl font-bold ${activeCount === 0 ? 'text-green-600' : activeCount >= 2 ? 'text-red-600' : 'text-amber-600'}`}>
                          {activeCount}
                        </p>
                        <p style={{ fontSize: 12, color: C.textMuted }}>Active</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 24, fontWeight: 700 }}>{totalCount}</p>
                        <p style={{ fontSize: 12, color: C.textMuted }}>Total</p>
                      </div>
                      <div>
                        <p className={`text-2xl font-bold ${activeCount === 0 ? 'text-green-600' : 'text-amber-600'}`}>
                          {activeCount === 0 ? '✓' : '⚠'}
                        </p>
                        <p style={{ fontSize: 12, color: C.textMuted }}>Status</p>
                      </div>
                    </div>
                  </div>

                  {/* Escalation level bar */}
                  <div style={{ marginTop: 16 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Escalation Level</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {ESCALATION_STEPS.map((step, i) => {
                        const active = i < maxLevel;
                        const current = i === maxLevel - 1;
                        return (
                          <div key={step.key} style={{ flex: 1 }}>
                            <div className={`h-2 rounded-full ${
                              current ? 'bg-red-500' : active ? 'bg-orange-400' : 'bg-gray-200'
                            }`} />
                            <p className={`text-[10px] mt-1 text-center ${current ? 'font-semibold text-red-600' : 'text-muted-foreground'}`}>
                              {step.label}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {activeCount === 0 && totalCount === 0 && (
                    <div style={{ marginTop: 16, textAlign: 'center', paddingTop: 16, paddingBottom: 16, color: C.green, background: C.greenDim, borderRadius: 12 }}>
                      <CheckCircle style={{ height: 24, width: 24, marginBottom: 4 }} />
                      <p style={{ fontWeight: 500 }}>Clean Record</p>
                      <p style={{ fontSize: 13 }}>No disciplinary actions on file</p>
                    </div>
                  )}

                  {/* Timeline */}
                  {historyLoading ? (
                    <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {[1, 2].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 80 }}  />)}
                    </div>
                  ) : employeeHistory.length > 0 && (
                    <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 0 }}>
                      <h4 style={{ fontWeight: 600, marginBottom: 12 }}>Timeline</h4>
                      {employeeHistory.map((w, idx) => (
                        <div key={w.warningNumber} style={{ display: 'flex', gap: 12 }}>
                          {/* Timeline line */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div className={`h-3 w-3 rounded-full mt-1.5 ${
                              w.isActive ? (
                                w.severity === 'CRITICAL' ? 'bg-red-600' :
                                w.severity === 'MAJOR' ? 'bg-red-500' :
                                w.severity === 'MODERATE' ? 'bg-orange-400' : 'bg-yellow-400'
                              ) : 'bg-gray-300'
                            }`} />
                            {idx < employeeHistory.length - 1 && <div style={{ width: 2, flex: 1, marginTop: 4 }} />}
                          </div>
                          {/* Content */}
                          <div className={`flex-1 pb-4 ${!w.isActive ? 'opacity-60' : ''}`}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, fontWeight: 500 }}>{fmtDate(w.incidentDate)}</span>
                              <CVisionBadge C={C} className={WARNING_TYPE_LABELS[w.type]?.color || ''} variant="outline">
                                {WARNING_TYPE_LABELS[w.type]?.label}
                              </CVisionBadge>
                              <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>{CATEGORY_LABELS[w.category] || w.category}</CVisionBadge>
                              <CVisionBadge C={C} className={STATUS_BADGE[w.status] || ''} variant="outline">{w.status.replace(/_/g, ' ')}</CVisionBadge>
                            </div>
                            <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>&ldquo;{w.incidentDescription}&rdquo;</p>
                            <CVisionButton C={C} isDark={isDark}
                              variant="ghost"
                              size="sm"
                              style={{ marginTop: 4, height: 28, paddingLeft: 8, paddingRight: 8, fontSize: 12 }}
                              onClick={() => { setDetailWarning(w); setDetailOpen(true); }}
                            >
                              View Details
                            </CVisionButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: 16 }}>
                    <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => {
                      const emp2 = employees.find(e => e.id === selectedRecordEmployee);
                      if (emp2) {
                        setSelectedEmployee(emp2);
                        setEmpSearch(getEmpName(emp2));
                        checkEscalation(emp2.id);
                        setFormStep(2);
                        setActiveTab('issue');
                      }
                    }}>
                      <Plus style={{ height: 14, width: 14, marginRight: 4 }} /> Issue New Warning
                    </CVisionButton>
                  </div>
                </CVisionCardBody>
              </CVisionCard>
            );
          })()}
        </div>
        </CVisionTabContent>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TAB 4: Analytics                                                     */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <CVisionTabContent tabId="analytics">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 24 }}>
          {!stats ? (
            <CVisionCard C={C}>
              <CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center', color: C.textMuted }}>
                No analytics data available yet. Issue some warnings first.
              </CVisionCardBody>
            </CVisionCard>
          ) : (
            <>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                <CVisionCard C={C}>
                  <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12, paddingLeft: 16, paddingRight: 16, textAlign: 'center' }}>
                    <p style={{ fontSize: 30, fontWeight: 700 }}>{stats.totalThisYear}</p>
                    <p style={{ fontSize: 13, color: C.textMuted }}>Total This Year</p>
                  </CVisionCardBody>
                </CVisionCard>
                <CVisionCard C={C}>
                  <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12, paddingLeft: 16, paddingRight: 16, textAlign: 'center' }}>
                    <p style={{ fontSize: 30, fontWeight: 700, color: C.green }}>{stats.acknowledgedRate}%</p>
                    <p style={{ fontSize: 13, color: C.textMuted }}>Acknowledged</p>
                  </CVisionCardBody>
                </CVisionCard>
                <CVisionCard C={C}>
                  <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12, paddingLeft: 16, paddingRight: 16, textAlign: 'center' }}>
                    <p style={{ fontSize: 30, fontWeight: 700, color: C.orange }}>{stats.appealedRate}%</p>
                    <p style={{ fontSize: 13, color: C.textMuted }}>Appealed</p>
                  </CVisionCardBody>
                </CVisionCard>
                <CVisionCard C={C}>
                  <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12, paddingLeft: 16, paddingRight: 16, textAlign: 'center' }}>
                    <p style={{ fontSize: 30, fontWeight: 700, color: C.red }}>{stats.repeatOffenders.length}</p>
                    <p style={{ fontSize: 13, color: C.textMuted }}>Repeat Offenders</p>
                  </CVisionCardBody>
                </CVisionCard>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 24 }}>
                {/* By Category */}
                <CVisionCard C={C}>
                  <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Warnings by Category</div>
                  </CVisionCardHeader>
                  <CVisionCardBody>
                    {Object.entries(stats.byCategory).length === 0 ? (
                      <p style={{ fontSize: 13, color: C.textMuted }}>No data</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {Object.entries(stats.byCategory)
                          .sort(([, a], [, b]) => b - a)
                          .map(([cat, count]) => {
                            const total = Object.values(stats.byCategory).reduce((s, v) => s + v, 0);
                            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                            return (
                              <div key={cat}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                                  <span>{CATEGORY_LABELS[cat] || cat}</span>
                                  <span style={{ color: C.textMuted }}>{count} ({pct}%)</span>
                                </div>
                                <div style={{ height: 6, borderRadius: 3, background: C.bgSubtle, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: C.gold, borderRadius: 3, transition: "width 0.3s" }} /></div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </CVisionCardBody>
                </CVisionCard>

                {/* By Department */}
                <CVisionCard C={C}>
                  <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Warnings by Department</div>
                  </CVisionCardHeader>
                  <CVisionCardBody>
                    {Object.entries(stats.byDepartment).length === 0 ? (
                      <p style={{ fontSize: 13, color: C.textMuted }}>No data</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {Object.entries(stats.byDepartment)
                          .sort(([, a], [, b]) => b - a)
                          .map(([dept, count]) => {
                            const total = Object.values(stats.byDepartment).reduce((s, v) => s + v, 0);
                            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                            return (
                              <div key={dept}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                                  <span>{dept}</span>
                                  <span style={{ color: C.textMuted }}>{count} ({pct}%)</span>
                                </div>
                                <div style={{ height: 6, borderRadius: 3, background: C.bgSubtle, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: C.gold, borderRadius: 3, transition: "width 0.3s" }} /></div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </CVisionCardBody>
                </CVisionCard>

                {/* Severity Distribution */}
                <CVisionCard C={C}>
                  <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Severity Distribution</div>
                  </CVisionCardHeader>
                  <CVisionCardBody>
                    {Object.entries(stats.bySeverity).length === 0 ? (
                      <p style={{ fontSize: 13, color: C.textMuted }}>No data</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {['MINOR', 'MODERATE', 'MAJOR', 'CRITICAL'].map(sev => {
                          const count = stats.bySeverity[sev] || 0;
                          if (count === 0) return null;
                          const total = Object.values(stats.bySeverity).reduce((s, v) => s + v, 0);
                          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                          return (
                            <div key={sev}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                                <CVisionBadge C={C} className={SEVERITY_BADGE[sev]}>{sev}</CVisionBadge>
                                <span style={{ color: C.textMuted }}>{count} ({pct}%)</span>
                              </div>
                              <div style={{ height: 6, borderRadius: 3, background: C.bgSubtle, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: C.gold, borderRadius: 3, transition: "width 0.3s" }} /></div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CVisionCardBody>
                </CVisionCard>

                {/* Monthly Trend */}
                <CVisionCard C={C}>
                  <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Monthly Trend</div>
                  </CVisionCardHeader>
                  <CVisionCardBody>
                    {Object.entries(stats.byMonth).length === 0 ? (
                      <p style={{ fontSize: 13, color: C.textMuted }}>No data</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {Object.entries(stats.byMonth)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([month, count]) => {
                            const maxCount = Math.max(...Object.values(stats.byMonth));
                            const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
                            const label = new Date(month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
                            return (
                              <div key={month}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                                  <span>{label}</span>
                                  <span style={{ color: C.textMuted }}>{count}</span>
                                </div>
                                <div style={{ height: 6, borderRadius: 3, background: C.bgSubtle, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: C.gold, borderRadius: 3, transition: "width 0.3s" }} /></div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </CVisionCardBody>
                </CVisionCard>
              </div>

              {/* Repeat offenders */}
              {stats.repeatOffenders.length > 0 && (
                <CVisionCard C={C}>
                  <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AlertTriangle style={{ height: 16, width: 16, color: C.red }} />
                      Repeat Offenders
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>Employees with 2 or more active warnings</div>
                  </CVisionCardHeader>
                  <CVisionCardBody>
                    <div className="divide-y">
                      {stats.repeatOffenders.map((ro) => (
                        <div key={ro.employeeId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, paddingBottom: 12 }}>
                          <div>
                            <p style={{ fontWeight: 500 }}>{ro.employeeName}</p>
                            <p style={{ fontSize: 13, color: C.textMuted }}>{ro.department || 'N/A'}</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <CVisionBadge C={C} variant="danger">{ro.count} warnings</CVisionBadge>
                            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => {
                              setSelectedRecordEmployee(ro.employeeId);
                              setRecordsSearch(ro.employeeName);
                              fetchEmployeeHistory(ro.employeeId);
                              setActiveTab('records');
                            }}>
                              View Record
                            </CVisionButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CVisionCardBody>
                </CVisionCard>
              )}

              {/* Export */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={async () => {
                  try {
                    const res = await fetch('/api/cvision/disciplinary?action=list&limit=100', { credentials: 'include' });
                    const data = await res.json();
                    if (!data.success) return;
                    const items = data.data.items;
                    const header = ['Warning #', 'Employee', 'Department', 'Type', 'Severity', 'Category', 'Incident Date', 'Status', 'Active'];
                    const rows = items.map((w: Warning) => [
                      w.warningNumber, w.employeeName, w.department,
                      WARNING_TYPE_LABELS[w.type]?.label || w.type, w.severity,
                      CATEGORY_LABELS[w.category] || w.category, fmtDate(w.incidentDate),
                      w.status, w.isActive ? 'Yes' : 'No',
                    ]);
                    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `disciplinary_report_${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch { /* ignore */ }
                }}>
                  <Download style={{ height: 16, width: 16, marginRight: 4 }} /> Export Report
                </CVisionButton>
              </div>
            </>
          )}
        </div>
        </CVisionTabContent>
      </CVisionTabs>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* Detail Modal                                                           */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <CVisionDialog C={C} open={detailOpen} onClose={() => setDetailOpen(false)} title="Details" isDark={isDark}>
          {detailWarning && (
            <>                
                <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
                  {detailWarning.employeeName} — {detailWarning.department} &middot; {detailWarning.jobTitle}
                </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, fontSize: 13 }}>
                  <div>
                    <p style={{ color: C.textMuted }}>Status</p>
                    <CVisionBadge C={C} className={STATUS_BADGE[detailWarning.status] || ''}>{detailWarning.status.replace(/_/g, ' ')}</CVisionBadge>
                  </div>
                  <div>
                    <p style={{ color: C.textMuted }}>Category</p>
                    <p style={{ fontWeight: 500 }}>{CATEGORY_LABELS[detailWarning.category] || detailWarning.category}</p>
                  </div>
                  <div>
                    <p style={{ color: C.textMuted }}>Incident Date</p>
                    <p style={{ fontWeight: 500 }}>{fmtDate(detailWarning.incidentDate)}</p>
                  </div>
                  <div>
                    <p style={{ color: C.textMuted }}>Expiry Date</p>
                    <p style={{ fontWeight: 500 }}>{fmtDate(detailWarning.expiryDate)}</p>
                  </div>
                  {detailWarning.laborLawArticle && (
                    <div>
                      <p style={{ color: C.textMuted }}>Saudi Labor Law</p>
                      <p style={{ fontWeight: 500 }}>{detailWarning.laborLawArticle}</p>
                    </div>
                  )}
                  <div>
                    <p style={{ color: C.textMuted }}>Previous Warnings</p>
                    <p style={{ fontWeight: 500 }}>{detailWarning.previousWarnings}</p>
                  </div>
                </div>

                <div>
                  <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 4 }}>Escalation Level</p>
                  <EscalationBar level={detailWarning.escalationLevel} />
                </div>

                <div>
                  <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 4 }}>Incident Description</p>
                  <p style={{ fontSize: 13, background: C.bgSubtle, borderRadius: 6, padding: 12 }}>{detailWarning.incidentDescription}</p>
                </div>

                <div>
                  <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 4 }}>Action Taken</p>
                  <p style={{ fontSize: 13, background: C.bgSubtle, borderRadius: 6, padding: 12 }}>{detailWarning.actionTaken}</p>
                </div>

                {detailWarning.acknowledgedAt && (
                  <div style={{ padding: 12, background: C.greenDim, borderRadius: 12 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: C.green }}>Acknowledged on {fmtDate(detailWarning.acknowledgedAt)}</p>
                    {detailWarning.employeeResponse && (
                      <p style={{ fontSize: 13, color: C.green, marginTop: 4 }}>Employee response: &ldquo;{detailWarning.employeeResponse}&rdquo;</p>
                    )}
                  </div>
                )}

                {detailWarning.appealDate && (
                  <div style={{ padding: 12, background: C.orangeDim, borderRadius: 12 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: C.orange }}>Appeal filed on {fmtDate(detailWarning.appealDate)}</p>
                    {detailWarning.appealReason && (
                      <p style={{ fontSize: 13, color: C.orange, marginTop: 4 }}>Reason: &ldquo;{detailWarning.appealReason}&rdquo;</p>
                    )}
                    {detailWarning.appealDecision && (
                      <p style={{ fontSize: 13, color: C.orange, marginTop: 4 }}>Decision: {detailWarning.appealDecision}</p>
                    )}
                  </div>
                )}

                {detailWarning.suspensionDays > 0 && (
                  <div style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgSubtle }}>
                    <div style={{ fontSize: 13, color: C.textSecondary }}>
                      Suspension: {detailWarning.suspensionDays} day{detailWarning.suspensionDays > 1 ? 's' : ''} without pay
                    </div>
                  </div>
                )}
              </div>

              <CVisionDialogFooter C={C}>
                {detailWarning.status === 'DRAFT' && (
                  <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => { setDetailOpen(false); handleIssue(detailWarning); }}>
                    Issue Warning
                  </CVisionButton>
                )}
                {detailWarning.status === 'APPEALED' && (
                  <>
                    <CVisionButton C={C} isDark={isDark} size="sm" variant="default" onClick={async () => {
                      await doAction('decide-appeal', { warningNumber: detailWarning.warningNumber, decision: 'APPROVED' });
                      setDetailOpen(false);
                    }}>
                      Approve Appeal
                    </CVisionButton>
                    <CVisionButton C={C} isDark={isDark} size="sm" variant="danger" onClick={async () => {
                      await doAction('decide-appeal', { warningNumber: detailWarning.warningNumber, decision: 'REJECTED' });
                      setDetailOpen(false);
                    }}>
                      Reject Appeal
                    </CVisionButton>
                  </>
                )}
                <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => setDetailOpen(false)}>Close</CVisionButton>
              </CVisionDialogFooter>
            </>
          )}
      </CVisionDialog>

      {/* Confirm Dialog */}
      <CVisionDialog C={C} open={confirmDialog.open} onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))} title="Confirm Action" isDark={isDark}>

            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{confirmDialog.message}</p>          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>Cancel</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={confirmDialog.onConfirm}>Confirm</CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}
