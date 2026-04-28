'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionSelect, CVisionDialog, CVisionDialogFooter , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';

import { useToast } from '@/hooks/use-toast';
import {
  Users, CheckCircle2, AlertTriangle, Clock, Plane, DollarSign,
  Search, Plus, Eye, RefreshCw, Loader2, ShieldCheck, X, FileText,
  CalendarDays, ArrowRight, Info, Download, MapPin, Bell,
} from 'lucide-react';
import {
  type IqamaRecord,
  type MuqeemAlert,
  type ExitReentryVisa,
  type Dependent,
  NATIONALITIES,
  IQAMA_RENEWAL_COSTS,
  VISA_TYPE_LABELS,
  ALERT_TYPE_LABELS,
} from '@/lib/cvision/muqeem/muqeem-engine';

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Types                                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

interface DashboardData {
  totalForeignEmployees: number;
  iqamaStatus: { valid: number; expiringSoon: number; expired: number };
  activeDepartures: number;
  costs: { totalAnnualCost: number; totalAnnualCostFormatted: string; upcomingRenewalCost: number; upcomingRenewalCostFormatted: string };
  nationalityBreakdown: { code: string; name: string; count: number }[];
  departmentBreakdown: { name: string; count: number }[];
  absherStats: { verified: number; pending: number; mismatch: number };
}

interface EnrichedRecord extends IqamaRecord {
  daysRemaining: number;
  currentStatus: string;
  recommendation?: { action: string; urgency: string; estimatedCost: number };
}

interface ExpiringRecord {
  employeeId: string; employeeName: string; department: string; nationality: string;
  iqamaNumber: string; iqamaExpiryDate: string; daysRemaining: number;
  severity: string; renewalCostEstimate: number; renewalCostFormatted: string;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Helpers                                                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

const fmt = (d: string | undefined | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const fmtShort = (d: string | undefined | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : '—';

const sar = (n: number) => `SAR ${n.toLocaleString('en-US')}`;

const FLAG_MAP: Record<string, string> = {
  SA: '🇸🇦', EG: '🇪🇬', PK: '🇵🇰', IN: '🇮🇳', PH: '🇵🇭', BD: '🇧🇩',
  JO: '🇯🇴', SY: '🇸🇾', YE: '🇾🇪', SD: '🇸🇩', LB: '🇱🇧', US: '🇺🇸', GB: '🇬🇧',
};

function daysColor(days: number) {
  if (days > 90) return 'text-green-600 dark:text-green-400';
  if (days > 30) return 'text-amber-600 dark:text-amber-400';
  if (days >= 14) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function StatusBadge({ status }: { status: string }) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const cfg: Record<string, { label: string; cls: string }> = {
    VALID: { label: tr('صالح', 'Valid'), cls: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' },
    EXPIRING_SOON: { label: tr('ينتهي قريباً', 'Expiring'), cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
    EXPIRED: { label: tr('منتهي', 'Expired'), cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
    RENEWED: { label: tr('مجدد', 'Renewed'), cls: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
    CANCELLED: { label: tr('ملغي', 'Cancelled'), cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  };
  const c = cfg[status] || cfg.VALID;
  return <CVisionBadge C={C} className={c.cls}>{c.label}</CVisionBadge>;
}

function SeverityBadge({ severity }: { severity: string }) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const cfg: Record<string, { label: string; cls: string }> = {
    INFO: { label: tr('معلومات', 'Info'), cls: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
    WARNING: { label: tr('تحذير', 'Warning'), cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
    URGENT: { label: tr('عاجل', 'Urgent'), cls: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' },
    CRITICAL: { label: 'حرج/Critical', cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
  };
  const c = cfg[severity] || cfg.INFO;
  return <CVisionBadge C={C} className={c.cls}>{c.label}</CVisionBadge>;
}

function borderByStatus(status: string) {
  if (status === 'VALID' || status === 'RENEWED') return 'border-l-4 border-l-green-500';
  if (status === 'EXPIRING_SOON') return 'border-l-4 border-l-amber-500';
  return 'border-l-4 border-l-red-500';
}

function visaBorder(status: string) {
  if (status === 'ISSUED') return 'border-l-4 border-l-blue-500';
  if (status === 'DEPARTED') return 'border-l-4 border-l-orange-500';
  if (status === 'RETURNED') return 'border-l-4 border-l-green-500';
  return 'border-l-4 border-l-red-500';
}

function VisaStatusBadge({ status }: { status: string }) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const cfg: Record<string, { label: string; cls: string; Icon: typeof FileText }> = {
    ISSUED: { label: tr('صادر', 'Issued'), cls: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300', Icon: FileText },
    DEPARTED: { label: 'غادر/Departed', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300', Icon: Plane },
    RETURNED: { label: 'عاد/Returned', cls: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300', Icon: CheckCircle2 },
    EXPIRED: { label: tr('منتهي', 'Expired'), cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300', Icon: X },
  };
  const c = cfg[status] || cfg.ISSUED;
  return <CVisionBadge C={C} className={`${c.cls} inline-flex items-center gap-1`}><c.Icon className="h-3 w-3" /> {c.label}</CVisionBadge>;
}

function alertCardStyle(severity: string) {
  const map: Record<string, string> = {
    CRITICAL: 'border-l-4 border-l-red-600 bg-red-50 dark:bg-red-950/30',
    URGENT: 'border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-950/30',
    WARNING: 'border-l-4 border-l-amber-400 bg-amber-50 dark:bg-amber-950/30',
    INFO: 'border-l-4 border-l-blue-400 bg-blue-50 dark:bg-blue-950/30',
  };
  return map[severity] || map.INFO;
}

function severityIcon(severity: string) {
  return <div className={`h-2.5 w-2.5 rounded-full ${severity === 'CRITICAL' ? 'bg-red-600' : severity === 'URGENT' ? 'bg-orange-500' : severity === 'WARNING' ? 'bg-amber-500' : 'bg-blue-500'}`} />;
}

function isStale(lastCheck: string | undefined | null) {
  if (!lastCheck) return true;
  return Math.floor((Date.now() - new Date(lastCheck).getTime()) / (1000 * 60 * 60 * 24)) > 90;
}

function absherDisplayStatus(rec: { absherStatus?: string; lastAbsherCheck?: string }) {
  if (rec.absherStatus === 'MISMATCH') return 'MISMATCH';
  if (rec.absherStatus === 'VERIFIED' && !isStale(rec.lastAbsherCheck)) return 'VERIFIED';
  if (rec.absherStatus === 'VERIFIED' && isStale(rec.lastAbsherCheck)) return 'STALE';
  return 'PENDING';
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Main Page                                                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

export default function MuqeemPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const { toast } = useToast();
  const [tab, setTab] = useState('dashboard');

  // Dashboard
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [expiring, setExpiring] = useState<ExpiringRecord[]>([]);

  // Records
  const [records, setRecords] = useState<EnrichedRecord[]>([]);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsPage, setRecordsPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterNationality, setFilterNationality] = useState('all');
  const [filterDept, setFilterDept] = useState('all');

  // Alerts
  const [alerts, setAlerts] = useState<MuqeemAlert[]>([]);

  // Exit/Re-entry
  const [exitVisas, setExitVisas] = useState<any[]>([]);

  // Modals
  const [detailRecord, setDetailRecord] = useState<EnrichedRecord | null>(null);
  const [showRenewModal, setShowRenewModal] = useState<EnrichedRecord | null>(null);
  const [renewExpiry, setRenewExpiry] = useState('');
  const [renewLoading, setRenewLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ employeeId: '', iqamaNumber: '', iqamaIssueDate: '', iqamaExpiryDate: '', passportNumber: '', passportIssueDate: '', passportExpiryDate: '', nationality: '', insuranceProvider: '', insuranceNumber: '', insuranceExpiryDate: '' });
  const [addDeps, setAddDeps] = useState<{ name: string; relationship: string; iqamaNumber: string; dateOfBirth: string }[]>([]);
  const [addLoading, setAddLoading] = useState(false);

  // Issue exit/re-entry
  const [showExitVisaModal, setShowExitVisaModal] = useState<EnrichedRecord | null>(null);
  const [exitForm, setExitForm] = useState({ type: 'SINGLE', duration: '90', destination: '' });
  const [exitLoading, setExitLoading] = useState(false);

  // Action loading
  const [actionLoading, setActionLoading] = useState(false);

  // Tab 3: Exit/Re-entry filters & modals
  const [exitFilter, setExitFilter] = useState('ALL');
  const [exitSearch, setExitSearch] = useState('');
  const [showDepartureModal, setShowDepartureModal] = useState<any>(null);
  const [departureDate, setDepartureDate] = useState(new Date().toISOString().slice(0, 10));
  const [departureDestination, setDepartureDestination] = useState('');
  const [departureLoading, setDepartureLoading] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState<any>(null);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [returnLoading, setReturnLoading] = useState(false);
  const [showIssueFromTab, setShowIssueFromTab] = useState(false);
  const [issueEmployee, setIssueEmployee] = useState('');
  const [issueForm, setIssueForm] = useState({ type: 'SINGLE', duration: '30', departureDate: '', destination: '' });
  const [issueLoading, setIssueLoading] = useState(false);

  // Tab 4: Alert filters
  const [alertFilterType, setAlertFilterType] = useState('ALL');
  const [alertFilterSeverity, setAlertFilterSeverity] = useState('ALL');
  const [alertFilterStatus, setAlertFilterStatus] = useState('UNRESOLVED');

  // Tab 5: Absher verification modal & bulk
  const [showVerifyModal, setShowVerifyModal] = useState<EnrichedRecord | null>(null);
  const [verifyStep, setVerifyStep] = useState<'loading' | 'result'>('loading');
  const [bulkVerifying, setBulkVerifying] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkResults, setBulkResults] = useState<{ verified: number; mismatches: number; errors: number } | null>(null);

  /* ─── Fetchers (React Query) ──────────────────────────────────────── */

  const recordFilters = { page: recordsPage, search: searchQuery, status: filterStatus, nationality: filterNationality, department: filterDept };

  const dashboardQuery = useQuery({
    queryKey: ['cvision', 'muqeem', 'dashboard'],
    queryFn: async () => {
      const dashRes = await cvisionFetch<any>('/api/cvision/muqeem', { params: { action: 'dashboard' } });
      const expRes = await cvisionFetch<any>('/api/cvision/muqeem', { params: { action: 'expiring', days: '90' } });
      return { dashboard: dashRes.success ? dashRes.data : null, expiring: expRes.success ? (expRes.data?.items || expRes.data || []) : [] };
    },
  });

  const recordsQuery = useQuery({
    queryKey: ['cvision', 'muqeem', 'records', recordFilters],
    queryFn: () => {
      const params: Record<string, string> = { action: 'list', page: String(recordsPage), limit: '20' };
      if (searchQuery) params.search = searchQuery;
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterNationality !== 'all') params.nationality = filterNationality;
      if (filterDept !== 'all') params.department = filterDept;
      return cvisionFetch<any>('/api/cvision/muqeem', { params });
    },
  });

  const alertsQuery = useQuery({
    queryKey: ['cvision', 'muqeem', 'alerts'],
    queryFn: () => cvisionFetch<any>('/api/cvision/muqeem', { params: { action: 'alerts' } }),
  });

  const exitVisasQuery = useQuery({
    queryKey: ['cvision', 'muqeem', 'exit-reentry'],
    queryFn: () => cvisionFetch<any>('/api/cvision/muqeem', { params: { action: 'exit-reentry' } }),
  });

  const loading = dashboardQuery.isLoading || recordsQuery.isLoading || alertsQuery.isLoading || exitVisasQuery.isLoading;

  useEffect(() => {
    if (dashboardQuery.data) {
      setDashboard(dashboardQuery.data.dashboard);
      setExpiring(dashboardQuery.data.expiring);
    }
  }, [dashboardQuery.data]);
  useEffect(() => {
    if (recordsQuery.data?.success) {
      setRecords(recordsQuery.data.data?.items || recordsQuery.data.data || []);
      setRecordsTotal(recordsQuery.data.pagination?.total || 0);
    }
  }, [recordsQuery.data]);
  useEffect(() => { if (alertsQuery.data?.success) setAlerts(alertsQuery.data.data?.items || alertsQuery.data.data || []); }, [alertsQuery.data]);
  useEffect(() => { if (exitVisasQuery.data?.success) setExitVisas(exitVisasQuery.data.data?.items || exitVisasQuery.data.data || []); }, [exitVisasQuery.data]);

  const queryClient = useQueryClient();
  const loadAll = useCallback(() => queryClient.invalidateQueries({ queryKey: ['cvision', 'muqeem'] }), [queryClient]);

  /* ─── Actions ──────────────────────────────────────────────────────── */

  const handleRenew = async () => {
    if (!showRenewModal || !renewExpiry) return;
    setRenewLoading(true);
    try {
      const res = await fetch('/api/cvision/muqeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'renew', employeeId: showRenewModal.employeeId, newExpiryDate: renewExpiry }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to renew');
      toast({ title: 'Iqama Renewed', description: `Cost: ${json.renewalCostFormatted}` });
      setShowRenewModal(null);
      loadAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setRenewLoading(false); }
  };

  const handleAddRecord = async () => {
    if (!addForm.iqamaNumber || !addForm.iqamaExpiryDate || !addForm.passportNumber || !addForm.nationality) {
      toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    setAddLoading(true);
    try {
      const res = await fetch('/api/cvision/muqeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'create', ...addForm, dependents: addDeps }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create');
      toast({ title: 'Record Created', description: `Iqama record added. ${json.alertsCreated || 0} alerts generated.` });
      setShowAddModal(false);
      setAddForm({ employeeId: '', iqamaNumber: '', iqamaIssueDate: '', iqamaExpiryDate: '', passportNumber: '', passportIssueDate: '', passportExpiryDate: '', nationality: '', insuranceProvider: '', insuranceNumber: '', insuranceExpiryDate: '' });
      setAddDeps([]);
      loadAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setAddLoading(false); }
  };

  const handleIssueExitVisa = async () => {
    if (!showExitVisaModal) return;
    setExitLoading(true);
    try {
      const res = await fetch('/api/cvision/muqeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'issue-exit-reentry', employeeId: showExitVisaModal.employeeId, type: exitForm.type, duration: parseInt(exitForm.duration), destination: exitForm.destination }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      toast({ title: 'Visa Issued', description: `${json.visa?.visaNumber} — Cost: ${json.costFormatted}` });
      setShowExitVisaModal(null);
      loadAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setExitLoading(false); }
  };

  const handleVerifyAbsher = async (employeeId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/cvision/muqeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'verify-absher', employeeId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      toast({ title: 'Absher Verified', description: 'Employee data verified successfully' });
      loadAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setActionLoading(false); }
  };

  const handleGenerateAlerts = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/cvision/muqeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'generate-alerts' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      toast({ title: 'Alerts Generated', description: `New: ${json.data.newAlerts}, Resolved: ${json.data.resolvedAlerts}, Active: ${json.data.totalActive}` });
      alertsQuery.refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setActionLoading(false); }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const res = await fetch('/api/cvision/muqeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'resolve-alert', alertId }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: 'Alert Resolved' });
      alertsQuery.refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleViewDetail = async (rec: EnrichedRecord) => {
    try {
      const res = await fetch(`/api/cvision/muqeem?action=detail&employeeId=${rec.employeeId}`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) setDetailRecord(json.data);
      else setDetailRecord(rec);
    } catch { setDetailRecord(rec); }
  };

  const openRenewModal = (rec: EnrichedRecord) => {
    const nextYear = new Date(rec.iqamaExpiryDate);
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setRenewExpiry(nextYear.toISOString().slice(0, 10));
    setShowRenewModal(rec);
  };

  /* ─── Tab 3 Handlers ────────────────────────────────────────────── */

  const handleRecordDeparture = async () => {
    if (!showDepartureModal) return;
    setDepartureLoading(true);
    try {
      const res = await fetch('/api/cvision/muqeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'record-departure', employeeId: showDepartureModal.employeeId, departureDate, destination: departureDestination || showDepartureModal.destination }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      toast({ title: 'Departure Recorded', description: `${showDepartureModal.employeeName} departure confirmed` });
      setShowDepartureModal(null);
      loadAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setDepartureLoading(false); }
  };

  const handleRecordReturn = async () => {
    if (!showReturnModal) return;
    setReturnLoading(true);
    try {
      const res = await fetch('/api/cvision/muqeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'record-return', employeeId: showReturnModal.employeeId, returnDate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      const msg = json.lateReturn ? 'Employee returned after visa expiry' : 'Return recorded successfully';
      toast({ title: 'Return Recorded', description: msg, variant: json.lateReturn ? 'destructive' : 'default' });
      setShowReturnModal(null);
      loadAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setReturnLoading(false); }
  };

  const handleIssueVisaFromTab = async () => {
    if (!issueEmployee) {
      toast({ title: 'Error', description: 'Please select an employee', variant: 'destructive' });
      return;
    }
    setIssueLoading(true);
    try {
      const res = await fetch('/api/cvision/muqeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'issue-exit-reentry', employeeId: issueEmployee, type: issueForm.type, duration: parseInt(issueForm.duration), destination: issueForm.destination }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      toast({ title: 'Visa Issued', description: `${json.visa?.visaNumber} — Cost: ${json.costFormatted}` });
      setShowIssueFromTab(false);
      setIssueEmployee('');
      loadAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setIssueLoading(false); }
  };

  /* ─── Tab 4 Handlers ────────────────────────────────────────────── */

  const handleMarkAllRead = async () => {
    setActionLoading(true);
    try {
      for (const a of alerts.filter((al: any) => !al.resolved)) {
        await fetch('/api/cvision/muqeem', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ action: 'resolve-alert', alertId: a._id }),
        });
      }
      toast({ title: 'All Alerts Resolved' });
      alertsQuery.refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setActionLoading(false); }
  };

  /* ─── Tab 5 Handlers ────────────────────────────────────────────── */

  const handleVerifyWithModal = (rec: EnrichedRecord) => {
    setShowVerifyModal(rec);
    setVerifyStep('loading');
    setTimeout(() => setVerifyStep('result'), 1500);
  };

  const handleConfirmVerify = async () => {
    if (!showVerifyModal) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/cvision/muqeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'verify-absher', employeeId: showVerifyModal.employeeId }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: 'Verified', description: `${showVerifyModal.employeeName} — Absher data confirmed` });
      setShowVerifyModal(null);
      loadAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setActionLoading(false); }
  };

  const handleReportMismatch = async () => {
    if (!showVerifyModal) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/cvision/muqeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'update', employeeId: showVerifyModal.employeeId, absherStatus: 'MISMATCH' }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: 'Mismatch Reported', description: `${showVerifyModal.employeeName} marked as mismatch`, variant: 'destructive' });
      setShowVerifyModal(null);
      loadAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setActionLoading(false); }
  };

  const handleBulkVerify = async () => {
    const toVerify = records.filter(r => absherDisplayStatus(r) !== 'VERIFIED');
    if (toVerify.length === 0) {
      toast({ title: 'All Up to Date', description: 'All employees are already verified' });
      return;
    }
    setBulkVerifying(true);
    setBulkTotal(toVerify.length);
    setBulkProgress(0);
    setBulkResults(null);
    let verified = 0, errors = 0;
    for (let i = 0; i < toVerify.length; i++) {
      setBulkProgress(i + 1);
      try {
        const res = await fetch('/api/cvision/muqeem', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ action: 'verify-absher', employeeId: toVerify[i].employeeId }),
        });
        if (res.ok) verified++; else errors++;
      } catch { errors++; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    setBulkResults({ verified, mismatches: 0, errors });
    setBulkVerifying(false);
    toast({ title: 'Bulk Verification Complete', description: `${verified} verified, ${errors} errors` });
    loadAll();
  };

  /* ─── Derived ──────────────────────────────────────────────────────── */

  const urgentAlertCount = alerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'URGENT').length;
  const nationalities = dashboard?.nationalityBreakdown || [];
  const departments = dashboard?.departmentBreakdown || [];
  const maxNatCount = Math.max(...nationalities.map(n => n.count), 1);

  // Exit visa derived
  const filteredExitVisas = exitVisas.filter((v: any) => {
    if (exitFilter !== 'ALL' && v.status !== exitFilter) return false;
    if (exitSearch && !v.employeeName?.toLowerCase().includes(exitSearch.toLowerCase())) return false;
    return true;
  });
  const exitStats = {
    active: exitVisas.filter((v: any) => v.status === 'ISSUED' || v.status === 'DEPARTED').length,
    abroad: exitVisas.filter((v: any) => v.status === 'DEPARTED').length,
    expiringSoon: exitVisas.filter((v: any) => (v.status === 'ISSUED' || v.status === 'DEPARTED') && v.daysRemaining <= 14).length,
    totalIssued: exitVisas.length,
  };

  // Alert derived
  const filteredAlerts = alerts.filter((a: any) => {
    if (alertFilterType !== 'ALL' && a.type !== alertFilterType) return false;
    if (alertFilterSeverity !== 'ALL' && a.severity !== alertFilterSeverity) return false;
    if (alertFilterStatus === 'UNRESOLVED' && a.resolved) return false;
    if (alertFilterStatus === 'RESOLVED' && !a.resolved) return false;
    return true;
  });
  const alertSummary = {
    critical: alerts.filter(a => a.severity === 'CRITICAL').length,
    urgent: alerts.filter(a => a.severity === 'URGENT').length,
    warning: alerts.filter(a => a.severity === 'WARNING').length,
    info: alerts.filter(a => a.severity === 'INFO').length,
    total: alerts.length,
  };

  // Absher derived
  const absherCounts = {
    verified: records.filter(r => absherDisplayStatus(r) === 'VERIFIED').length,
    pending: records.filter(r => absherDisplayStatus(r) === 'PENDING').length,
    stale: records.filter(r => absherDisplayStatus(r) === 'STALE').length,
    mismatch: records.filter(r => absherDisplayStatus(r) === 'MISMATCH').length,
  };
  const activeIqamaRecords = records.filter(r => {
    const s = r.currentStatus || r.iqamaStatus;
    return s === 'VALID' || s === 'EXPIRING_SOON' || s === 'RENEWED';
  });

  /* ─── Loading ──────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><CVisionSkeletonCard C={C} height={200} style={{ height: 32, width: 256 }}  /><CVisionSkeletonCard C={C} height={200} style={{ height: 16, width: 320, marginTop: 8 }}  /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => (<CVisionSkeletonCard C={C} height={200} key={i} style={{ borderRadius: 12 }}  />))}
        </div>
        <CVisionSkeletonCard C={C} height={200} style={{ height: 40, width: '100%' }}  />
        <CVisionSkeletonCard C={C} height={200} style={{ width: '100%' }}  />
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════ */
  /* Render                                                                  */
  /* ═══════════════════════════════════════════════════════════════════════ */

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText style={{ height: 24, width: 24 }} />
            Muqeem — Iqama &amp; Visa Management
          </h1>
          <p style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>Iqama and visa management</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={loadAll} style={{ gap: 6 }}>
            <RefreshCw style={{ height: 14, width: 14 }} /> Refresh
          </CVisionButton>
          <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => setShowAddModal(true)} style={{ gap: 6 }}>
            <Plus style={{ height: 14, width: 14 }} /> Add Record
          </CVisionButton>
        </div>
      </div>

      {/* Critical Alert Banner */}
      {urgentAlertCount > 0 && (
        <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, background: C.redDim, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.red }}>
            <AlertTriangle style={{ height: 20, width: 20 }} />
            <span style={{ fontWeight: 500 }}>{urgentAlertCount} urgent alert{urgentAlertCount !== 1 ? 's' : ''} — Immediate action required</span>
          </div>
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => setTab('alerts')} style={{ gap: 4, color: C.red }}>
            View Alerts <ArrowRight style={{ height: 14, width: 14 }} />
          </CVisionButton>
        </div>
      )}

      {/* Tabs */}
      <CVisionTabs
        C={C}
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: 'dashboard', label: tr('لوحة التحكم', 'Dashboard') },
          { id: 'records', label: tr('سجلات الإقامة', 'Iqama Records') },
          { id: 'exit-reentry', label: tr('خروج وعودة', 'Exit/Re-entry') },
          { id: 'alerts', label: 'Alerts', badge: alerts.length },
          { id: 'absher', label: 'Absher' },
        ]}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 1: Dashboard                                               */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <CVisionTabContent tabId="dashboard">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <CVisionCard C={C}><CVisionCardBody style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.textMuted, fontSize: 12, fontWeight: 500 }}><Users style={{ height: 16, width: 16 }} />Foreign Employees</div>
              <p style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{dashboard?.totalForeignEmployees || 0}</p>
            </CVisionCardBody></CVisionCard>

            <CVisionCard C={C}><CVisionCardBody style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.green, fontSize: 12, fontWeight: 500 }}><CheckCircle2 style={{ height: 16, width: 16 }} />Valid Iqamas</div>
              <p style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: C.green }}>{dashboard?.iqamaStatus.valid || 0}</p>
            </CVisionCardBody></CVisionCard>

            <CVisionCard C={C}><CVisionCardBody style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.orange, fontSize: 12, fontWeight: 500 }}><Clock style={{ height: 16, width: 16 }} />Expiring (90d)</div>
              <p style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: C.orange }}>{dashboard?.iqamaStatus.expiringSoon || 0}</p>
            </CVisionCardBody></CVisionCard>

            <CVisionCard C={C}><CVisionCardBody style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.orange, fontSize: 12, fontWeight: 500 }}><AlertTriangle style={{ height: 16, width: 16 }} />Expiring (30d)</div>
              <p style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: C.orange }}>{expiring.filter(e => e.daysRemaining <= 30).length}</p>
            </CVisionCardBody></CVisionCard>

            <CVisionCard C={C}><CVisionCardBody style={{ padding: 16 }}>
              <div className={`flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-medium`}><AlertTriangle style={{ height: 16, width: 16 }} />Expired</div>
              <p className={`text-2xl font-bold mt-1 text-red-600 dark:text-red-400 ${(dashboard?.iqamaStatus.expired || 0) > 0 ? 'animate-pulse' : ''}`}>{dashboard?.iqamaStatus.expired || 0}</p>
            </CVisionCardBody></CVisionCard>

            <CVisionCard C={C}><CVisionCardBody style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.blue, fontSize: 12, fontWeight: 500 }}><Plane style={{ height: 16, width: 16 }} />Currently Abroad</div>
              <p style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: C.blue }}>{dashboard?.activeDepartures || 0}</p>
            </CVisionCardBody></CVisionCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 24 }}>
            {/* Upcoming Expirations */}
            <CVisionCard C={C} className="lg:col-span-2">
              <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CalendarDays style={{ height: 16, width: 16 }} /> Upcoming Expirations (90 Days)
                </div>
              </CVisionCardHeader>
              <CVisionCardBody>
                {expiring.length === 0 ? (
                  <div style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32, color: C.textMuted }}>
                    <CheckCircle2 style={{ height: 32, width: 32, marginBottom: 8, color: C.green }} />
                    No iqamas expiring in the next 90 days
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.textMuted, textAlign: 'left' }}>
                          <th style={{ paddingBottom: 8, fontWeight: 500 }}>Employee</th>
                          <th style={{ paddingBottom: 8, fontWeight: 500 }}>Iqama</th>
                          <th style={{ paddingBottom: 8, fontWeight: 500 }}>Expiry Date</th>
                          <th style={{ paddingBottom: 8, fontWeight: 500 }}>Days Left</th>
                          <th style={{ paddingBottom: 8, fontWeight: 500 }}>Status</th>
                          <th style={{ paddingBottom: 8, fontWeight: 500 }}>Renewal Cost</th>
                          <th style={{ paddingBottom: 8, fontWeight: 500 }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expiring.map((e) => (
                          <tr key={e.employeeId} style={{ borderBottom: `1px solid ${C.border}` }}>
                            <td style={{ paddingTop: 10, paddingBottom: 10 }}>
                              <div style={{ fontWeight: 500 }}>{e.employeeName}</div>
                              <div style={{ fontSize: 12, color: C.textMuted }}>{e.department}</div>
                            </td>
                            <td style={{ paddingTop: 10, paddingBottom: 10, fontFamily: 'monospace', fontSize: 12 }}>{e.iqamaNumber}</td>
                            <td style={{ paddingTop: 10, paddingBottom: 10 }}>{fmt(e.iqamaExpiryDate)}</td>
                            <td style={{ paddingTop: 10, paddingBottom: 10 }}><span className={`font-bold ${daysColor(e.daysRemaining)}`}>{e.daysRemaining}</span></td>
                            <td style={{ paddingTop: 10, paddingBottom: 10 }}><SeverityBadge severity={e.severity} /></td>
                            <td style={{ paddingTop: 10, paddingBottom: 10 }}>{e.renewalCostFormatted}</td>
                            <td style={{ paddingTop: 10, paddingBottom: 10 }}>
                              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ height: 28, fontSize: 12 }}
                                onClick={() => { const rec = records.find(r => r.employeeId === e.employeeId); if (rec) openRenewModal(rec); else setTab('records'); }}>
                                Renew
                              </CVisionButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CVisionCardBody>
            </CVisionCard>

            {/* Cost Summary */}
            <CVisionCard C={C}>
              <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DollarSign style={{ height: 16, width: 16 }} /> Annual Iqama Costs
                </div>
              </CVisionCardHeader>
              <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: C.textMuted }}>Employee Iqamas ({dashboard?.totalForeignEmployees || 0} × {sar(IQAMA_RENEWAL_COSTS.EMPLOYEE)})</span>
                  <span style={{ fontWeight: 500 }}>{sar((dashboard?.totalForeignEmployees || 0) * IQAMA_RENEWAL_COSTS.EMPLOYEE)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: C.textMuted }}>Work Permits ({dashboard?.totalForeignEmployees || 0} × {sar(IQAMA_RENEWAL_COSTS.WORK_PERMIT)})</span>
                  <span style={{ fontWeight: 500 }}>{sar((dashboard?.totalForeignEmployees || 0) * IQAMA_RENEWAL_COSTS.WORK_PERMIT)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: C.textMuted }}>Upcoming Renewals (90 days)</span>
                  <span style={{ fontWeight: 500, color: C.orange }}>{dashboard?.costs.upcomingRenewalCostFormatted || 'SAR 0'}</span>
                </div>
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
                  <span>Total Annual Cost</span>
                  <span>{dashboard?.costs.totalAnnualCostFormatted || 'SAR 0'}</span>
                </div>
              </CVisionCardBody>
            </CVisionCard>

            {/* Nationality Breakdown */}
            <CVisionCard C={C}>
              <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Nationality Breakdown</div>
              </CVisionCardHeader>
              <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {nationalities.length === 0 ? (
                  <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', paddingTop: 16, paddingBottom: 16 }}>No data</p>
                ) : nationalities.map((n) => {
                  const pct = dashboard?.totalForeignEmployees ? Math.round((n.count / dashboard.totalForeignEmployees) * 100) : 0;
                  return (
                    <div key={n.code} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ width: 24, textAlign: 'center' }}>{FLAG_MAP[n.code] || '🏳️'}</span>
                      <span style={{ width: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>
                      <div style={{ flex: 1, height: 20, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}>
                        <div style={{ borderRadius: '50%', transition: 'all 0.2s', width: `${(n.count / maxNatCount) * 100}%` }} />
                      </div>
                      <span style={{ width: 32, textAlign: 'right', fontWeight: 500 }}>{n.count}</span>
                      <span style={{ width: 40, textAlign: 'right', color: C.textMuted, fontSize: 12 }}>{pct}%</span>
                    </div>
                  );
                })}
              </CVisionCardBody>
            </CVisionCard>
          </div>

          {/* Absher Mini Card */}
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 13 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 style={{ height: 16, width: 16, color: C.green }} /> Verified: <strong>{dashboard?.absherStats.verified || 0}</strong></span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock style={{ height: 16, width: 16, color: C.orange }} /> Pending: <strong>{dashboard?.absherStats.pending || 0}</strong></span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle style={{ height: 16, width: 16, color: C.red }} /> Mismatch: <strong>{dashboard?.absherStats.mismatch || 0}</strong></span>
              </div>
              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => setTab('absher')} style={{ gap: 6 }}>
                <ShieldCheck style={{ height: 14, width: 14 }} /> Run Verification <ArrowRight style={{ height: 14, width: 14 }} />
              </CVisionButton>
            </CVisionCardBody>
          </CVisionCard>
        </div>
        </CVisionTabContent>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 2: Iqama Records                                           */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <CVisionTabContent tabId="records">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
                <CVisionInput C={C} placeholder="Search by name, iqama number..." value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setRecordsPage(1); }}
                  style={{ paddingLeft: 32 }} />
              </div>
            </div>
            <CVisionSelect
                C={C}
                value={filterStatus}
                placeholder="Status"
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'VALID', label: tr('صالح', 'Valid') },
                  { value: 'EXPIRING_SOON', label: tr('ينتهي قريباً', 'Expiring') },
                  { value: 'EXPIRED', label: tr('منتهي', 'Expired') },
                ]}
              />
            <CVisionSelect
                C={C}
                value={filterNationality}
                placeholder="Nationality"
                options={[
                  { value: 'all', label: 'All Nationalities' },
                  ...nationalities.map(n => ({ value: n.code, label: `${FLAG_MAP[n.code] || ''} ${n.name}` })),
                ]}
              />
            <CVisionSelect
                C={C}
                value={filterDept}
                placeholder="Department"
                options={[
                  { value: 'all', label: 'All Departments' },
                  ...departments.map(d => ({ value: d.name, label: d.name })),
                ]}
              />
            {(searchQuery || filterStatus !== 'all' || filterNationality !== 'all' || filterDept !== 'all') && (
              <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setFilterStatus('all'); setFilterNationality('all'); setFilterDept('all'); setRecordsPage(1); }}>
                <X style={{ height: 14, width: 14, marginRight: 4 }} /> Clear
              </CVisionButton>
            )}
          </div>

          {/* Record Cards */}
          {records.length === 0 ? (
            <CVisionCard C={C}>
              <CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}>
                <FileText style={{ height: 40, width: 40, marginBottom: 12, color: C.textMuted }} />
                <p style={{ fontSize: 16, fontWeight: 500 }}>No iqama records found</p>
                <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Add records for non-Saudi employees.</p>
                <CVisionButton C={C} isDark={isDark} style={{ marginTop: 16, gap: 6 }} onClick={() => setShowAddModal(true)}>
                  <Plus style={{ height: 16, width: 16 }} /> Add Record
                </CVisionButton>
              </CVisionCardBody>
            </CVisionCard>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {records.map((rec) => {
                const status = rec.currentStatus || rec.iqamaStatus;
                const nat = NATIONALITIES[rec.nationality];
                return (
                  <CVisionCard C={C} key={rec._id || rec.employeeId} className={`${borderByStatus(status)} hover:shadow-md transition-shadow`}>
                    <CVisionCardBody style={{ padding: 16 }}>
                      {/* Top row */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{rec.employeeName}</span>
                            <StatusBadge status={status} />
                          </div>
                          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>{rec.department}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className={`text-xl font-bold ${daysColor(rec.daysRemaining)}`}>{rec.daysRemaining}</span>
                          <div style={{ fontSize: 12, color: C.textMuted }}>days left</div>
                        </div>
                      </div>

                      {/* Info grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', fontSize: 13, marginBottom: 12 }}>
                        <div>
                          <span style={{ color: C.textMuted }}>Iqama: </span>
                          <span style={{ fontFamily: 'monospace' }}>{rec.iqamaNumber}</span>
                          <span style={{ marginLeft: 6 }}>{FLAG_MAP[rec.nationality] || ''} {nat?.label || rec.nationality}</span>
                        </div>
                        <div>
                          <span style={{ color: C.textMuted }}>Issue: </span>{fmt(rec.iqamaIssueDate)}
                          <span style={{ marginLeft: 6, marginRight: 6 }}>→</span>
                          <span style={{ color: C.textMuted }}>Expiry: </span>{fmt(rec.iqamaExpiryDate)}
                        </div>
                        <div>
                          <span style={{ color: C.textMuted }}>Passport: </span>
                          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{rec.passportNumber}</span>
                          <span style={{ marginLeft: 4, fontSize: 12, color: C.textMuted }}>Exp: {fmtShort(rec.passportExpiryDate)}</span>
                        </div>
                        <div>
                          <span style={{ color: C.textMuted }}>Insurance: </span>
                          {rec.insuranceProvider || '—'}
                          {rec.insuranceExpiryDate && <span style={{ marginLeft: 4, fontSize: 12, color: C.textMuted }}>Exp: {fmtShort(rec.insuranceExpiryDate)}</span>}
                        </div>
                      </div>

                      {/* Bottom row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: C.textMuted }}>
                          <span>Dependents: <strong className="text-foreground">{rec.dependents?.length || 0}</strong></span>
                          <span>Annual Cost: <strong className="text-foreground">{sar(rec.totalAnnualCost || 0)}</strong></span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            Absher: {rec.absherStatus === 'VERIFIED'
                              ? <><CheckCircle2 style={{ height: 12, width: 12, color: C.green }} /> {rec.lastAbsherCheck ? fmtShort(rec.lastAbsherCheck) : 'Verified'}</>
                              : <><Clock style={{ height: 12, width: 12, color: C.orange }} /> {rec.absherStatus}</>}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ height: 28, fontSize: 12, gap: 4 }} onClick={() => handleViewDetail(rec)}>
                            <Eye style={{ height: 12, width: 12 }} /> View
                          </CVisionButton>
                          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ height: 28, fontSize: 12 }} onClick={() => openRenewModal(rec)}>
                            Renew
                          </CVisionButton>
                          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ height: 28, fontSize: 12 }} onClick={() => { setShowExitVisaModal(rec); setExitForm({ type: 'SINGLE', duration: '90', destination: '' }); }}>
                            Exit Visa
                          </CVisionButton>
                        </div>
                      </div>
                    </CVisionCardBody>
                  </CVisionCard>
                );
              })}

              {/* Pagination */}
              {recordsTotal > 20 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, paddingTop: 8 }}>
                  <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" disabled={recordsPage <= 1} onClick={() => setRecordsPage(p => p - 1)}>Previous</CVisionButton>
                  <span style={{ fontSize: 13, color: C.textMuted }}>Page {recordsPage} of {Math.ceil(recordsTotal / 20)}</span>
                  <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" disabled={recordsPage >= Math.ceil(recordsTotal / 20)} onClick={() => setRecordsPage(p => p + 1)}>Next</CVisionButton>
                </div>
              )}
            </div>
          )}
        </div>
        </CVisionTabContent>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 3: Exit/Re-entry Visas                                      */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <CVisionTabContent tabId="exit-reentry">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <CVisionCard C={C}><CVisionCardBody style={{ padding: 16 }}>
              <div style={{ color: C.textMuted, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><Plane className="h-3.5 w-3.5" /> Active Visas</div>
              <p style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{exitStats.active}</p>
            </CVisionCardBody></CVisionCard>
            <CVisionCard C={C}><CVisionCardBody style={{ padding: 16 }}>
              <div style={{ color: C.orange, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><Plane className="h-3.5 w-3.5" /> Currently Abroad</div>
              <p style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: C.orange }}>{exitStats.abroad}</p>
            </CVisionCardBody></CVisionCard>
            <CVisionCard C={C}><CVisionCardBody style={{ padding: 16 }}>
              <div style={{ color: C.red, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><Clock className="h-3.5 w-3.5" /> Expiring Soon</div>
              <p style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: C.red }}>{exitStats.expiringSoon}</p>
            </CVisionCardBody></CVisionCard>
            <CVisionCard C={C}><CVisionCardBody style={{ padding: 16 }}>
              <div style={{ color: C.textMuted, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><FileText className="h-3.5 w-3.5" /> Total Issued (2026)</div>
              <p style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{exitStats.totalIssued}</p>
            </CVisionCardBody></CVisionCard>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <CVisionSelect
                C={C}
                value={exitFilter}
                onChange={setExitFilter}
                placeholder="Status"
                options={[
                  { value: 'ALL', label: 'All Status' },
                  { value: 'ISSUED', label: tr('صادر', 'Issued') },
                  { value: 'DEPARTED', label: 'Departed' },
                  { value: 'RETURNED', label: 'Returned' },
                  { value: 'EXPIRED', label: tr('منتهي', 'Expired') },
                ]}
              />
            <div style={{ flex: 1 }}>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
                <CVisionInput C={C} placeholder="Search employee..." value={exitSearch}
                  onChange={(e) => setExitSearch(e.target.value)} style={{ paddingLeft: 32 }} />
              </div>
            </div>
            {(exitFilter !== 'ALL' || exitSearch) && (
              <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => { setExitFilter('ALL'); setExitSearch(''); }}>
                <X style={{ height: 14, width: 14, marginRight: 4 }} /> Clear
              </CVisionButton>
            )}
            <CVisionButton C={C} isDark={isDark} size="sm" style={{ gap: 6 }} onClick={() => { setShowIssueFromTab(true); setIssueEmployee(''); setIssueForm({ type: 'SINGLE', duration: '30', departureDate: '', destination: '' }); }}>
              <Plus style={{ height: 14, width: 14 }} /> Issue Exit/Re-entry Visa
            </CVisionButton>
          </div>

          {/* Visa Cards */}
          {filteredExitVisas.length === 0 ? (
            <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}>
              <Plane style={{ height: 40, width: 40, marginBottom: 12, color: C.textMuted }} />
              <p style={{ fontSize: 16, fontWeight: 500 }}>No exit/re-entry visas found</p>
              <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Issue a visa for an employee with an active iqama.</p>
            </CVisionCardBody></CVisionCard>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredExitVisas.map((v: any) => {
                const nearingExpiry = (v.status === 'ISSUED' || v.status === 'DEPARTED') && v.daysRemaining <= 7;
                return (
                  <CVisionCard C={C} key={v.id || v.visaNumber} className={`${visaBorder(v.status)} hover:shadow-md transition-shadow`}>
                    <CVisionCardBody style={{ padding: 16 }}>
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <VisaStatusBadge status={v.status} />
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{v.employeeName}</span>
                        </div>
                        {(v.status === 'ISSUED' || v.status === 'DEPARTED') && (
                          <div style={{ textAlign: 'right' }}>
                            <span className={`text-xl font-bold ${daysColor(v.daysRemaining)} ${nearingExpiry ? 'animate-pulse' : ''}`}>{v.daysRemaining}</span>
                            <div style={{ fontSize: 12, color: C.textMuted }}>days remaining</div>
                          </div>
                        )}
                      </div>

                      {/* Info grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', fontSize: 13, marginBottom: 12 }}>
                        <div><span style={{ color: C.textMuted }}>Visa Type: </span>{VISA_TYPE_LABELS[v.type as keyof typeof VISA_TYPE_LABELS] || v.type}</div>
                        <div><span style={{ color: C.textMuted }}>Visa #: </span><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v.visaNumber}</span></div>
                        <div><span style={{ color: C.textMuted }}>Duration: </span>{v.duration || '—'} days</div>
                        <div><span style={{ color: C.textMuted }}>Issued: </span>{fmt(v.issueDate)}</div>
                        <div><span style={{ color: C.textMuted }}>Expires: </span>{fmt(v.expiryDate)}</div>
                        {v.destination && <div><span style={{ color: C.textMuted }}>Destination: </span>{v.destination}</div>}
                      </div>

                      {/* Departed info block */}
                      {v.status === 'DEPARTED' && (
                        <div style={{ fontSize: 13, marginBottom: 12, padding: 10, borderRadius: 6, background: C.orangeDim, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div><span style={{ color: C.textMuted }}>Departed: </span>{fmt(v.departureDate)}<span style={{ marginLeft: 8, marginRight: 8, color: C.textMuted }}>|</span><span style={{ color: C.textMuted }}>Destination: </span>{v.destination || '—'}</div>
                          {v.expectedReturnDate && <div><span style={{ color: C.textMuted }}>Expected Return: </span>{fmt(v.expectedReturnDate)}</div>}
                          {v.daysRemaining <= 14 && (
                            <p style={{ color: C.orange, fontWeight: 500, marginTop: 4, fontSize: 12 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle className="h-3.5 w-3.5" /> Must return by {fmt(v.expiryDate)} or iqama will be cancelled</span>
                            </p>
                          )}
                        </div>
                      )}

                      {/* Returned info block */}
                      {v.status === 'RETURNED' && (
                        <div style={{ fontSize: 13, marginBottom: 12, padding: 10, borderRadius: 6, background: C.greenDim, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div><span style={{ color: C.textMuted }}>Departed: </span>{fmt(v.departureDate)}<span style={{ marginLeft: 8, marginRight: 8, color: C.textMuted }}>→</span><span style={{ color: C.textMuted }}>Returned: </span>{fmt(v.returnDate)}</div>
                        </div>
                      )}

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 6 }}>
                        {v.status === 'ISSUED' && (
                          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ height: 28, fontSize: 12, gap: 4 }}
                            onClick={() => { setShowDepartureModal(v); setDepartureDate(new Date().toISOString().slice(0, 10)); setDepartureDestination(v.destination || ''); }}>
                            <Plane style={{ height: 12, width: 12 }} /> Record Departure
                          </CVisionButton>
                        )}
                        {v.status === 'DEPARTED' && (
                          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ height: 28, fontSize: 12, gap: 4 }}
                            onClick={() => { setShowReturnModal(v); setReturnDate(new Date().toISOString().slice(0, 10)); }}>
                            <MapPin style={{ height: 12, width: 12 }} /> Record Return
                          </CVisionButton>
                        )}
                        {(v.status === 'ISSUED' || v.status === 'DEPARTED') && (
                          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ height: 28, fontSize: 12 }} onClick={() => {
                            const rec = records.find(r => r.employeeId === v.employeeId);
                            if (rec) handleViewDetail(rec);
                          }}>View History</CVisionButton>
                        )}
                      </div>
                    </CVisionCardBody>
                  </CVisionCard>
                );
              })}
            </div>
          )}
        </div>
        </CVisionTabContent>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 4: Alerts & Reminders                                       */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <CVisionTabContent tabId="alerts">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Alert Summary */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, fontSize: 13 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span className="h-2.5 w-2.5 rounded-full bg-red-600 inline-block" /> Critical: <strong>{alertSummary.critical}</strong></span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span className="h-2.5 w-2.5 rounded-full bg-orange-500 inline-block" /> Urgent: <strong>{alertSummary.urgent}</strong></span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" /> Warning: <strong>{alertSummary.warning}</strong></span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" /> Info: <strong>{alertSummary.info}</strong></span>
            <span style={{ color: C.textMuted }}>| Total: <strong className="text-foreground">{alertSummary.total}</strong></span>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <CVisionSelect
                C={C}
                value={alertFilterType}
                onChange={setAlertFilterType}
                placeholder="Type"
                options={[
                  { value: 'ALL', label: 'All Types' },
                  { value: 'IQAMA_EXPIRY', label: 'Iqama Expiry' },
                  { value: 'PASSPORT_EXPIRY', label: 'Passport Expiry' },
                  { value: 'VISA_EXPIRY', label: 'Visa Expiry' },
                  { value: 'INSURANCE_EXPIRY', label: 'Insurance Expiry' },
                ]}
              />
            <CVisionSelect
                C={C}
                value={alertFilterSeverity}
                onChange={setAlertFilterSeverity}
                placeholder="Severity"
                options={[
                  { value: 'ALL', label: 'All Severity' },
                  { value: 'CRITICAL', label: 'Critical' },
                  { value: 'URGENT', label: tr('عاجل', 'Urgent') },
                  { value: 'WARNING', label: tr('تحذير', 'Warning') },
                  { value: 'INFO', label: tr('معلومات', 'Info') },
                ]}
              />
            <CVisionSelect
                C={C}
                value={alertFilterStatus}
                onChange={setAlertFilterStatus}
                placeholder="Status"
                options={[
                  { value: 'UNRESOLVED', label: 'Unresolved' },
                  { value: 'RESOLVED', label: 'Resolved' },
                  { value: 'ALL', label: 'All' },
                ]}
              />
            <div style={{ display: 'flex', gap: 8 }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={handleGenerateAlerts} disabled={actionLoading} style={{ gap: 6 }}>
                {actionLoading ? <Loader2 style={{ height: 14, width: 14, animation: 'spin 1s linear infinite' }} /> : <Bell style={{ height: 14, width: 14 }} />} Generate All Alerts
              </CVisionButton>
              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={handleMarkAllRead} disabled={actionLoading} style={{ gap: 6 }}>
                <CheckCircle2 style={{ height: 14, width: 14 }} /> Mark All Read
              </CVisionButton>
            </div>
          </div>

          {/* Alert Cards */}
          {filteredAlerts.length === 0 ? (
            <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}>
              <CheckCircle2 style={{ height: 40, width: 40, marginBottom: 12, color: C.green }} />
              <p style={{ fontSize: 16, fontWeight: 500 }}>No active alerts</p>
              <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>All documents are up to date</p>
            </CVisionCardBody></CVisionCard>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredAlerts.map((a: any) => {
                const typeLabel = ALERT_TYPE_LABELS[a.type as keyof typeof ALERT_TYPE_LABELS];
                return (
                  <CVisionCard C={C} key={a._id} className={alertCardStyle(a.severity)}>
                    <CVisionCardBody style={{ padding: 16 }}>
                      {/* Severity header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 16 }}>{severityIcon(a.severity)}</span>
                        <SeverityBadge severity={a.severity} />
                        <span style={{ fontSize: 13, color: C.textMuted }}>— {a.daysRemaining} days remaining</span>
                      </div>

                      {/* English message */}
                      <div style={{ marginBottom: 4 }}>
                        <p style={{ fontWeight: 500 }}>{typeLabel || a.type} — {a.employeeName}</p>
                        <p style={{ fontSize: 13, color: C.textMuted }}>{a.message}</p>
                      </div>

                      {/* Critical action required */}
                      {a.severity === 'CRITICAL' && (
                        <div style={{ fontSize: 13, marginBottom: 8 }}>
                          <p style={{ fontWeight: 500, color: C.red }}>Action Required: Renew immediately</p>
                          <p style={{ color: C.textMuted, fontSize: 12 }}>Estimated Cost: {sar(IQAMA_RENEWAL_COSTS.EMPLOYEE)}</p>
                        </div>
                      )}

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        {(a.type === 'IQAMA_EXPIRY' && (a.severity === 'CRITICAL' || a.severity === 'URGENT')) && (
                          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ height: 28, fontSize: 12, gap: 4 }}
                            onClick={() => { const rec = records.find(r => r.employeeId === a.employeeId); if (rec) openRenewModal(rec); }}>
                            Renew Now
                          </CVisionButton>
                        )}
                        {a.type === 'PASSPORT_EXPIRY' && (
                          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ height: 28, fontSize: 12 }} onClick={() => {
                            const rec = records.find(r => r.employeeId === a.employeeId);
                            if (rec) handleViewDetail(rec);
                          }}>Update Passport Info</CVisionButton>
                        )}
                        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ height: 28, fontSize: 12 }} onClick={() => handleResolveAlert(a._id)}>
                          Mark Resolved
                        </CVisionButton>
                        <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ height: 28, fontSize: 12 }} onClick={() => handleResolveAlert(a._id)}>
                          Dismiss
                        </CVisionButton>
                      </div>
                    </CVisionCardBody>
                  </CVisionCard>
                );
              })}
            </div>
          )}
        </div>
        </CVisionTabContent>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 5: Absher Verification                                      */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <CVisionTabContent tabId="absher">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Info Banner */}
          <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, background: C.blueDim, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Info style={{ height: 20, width: 20, color: C.blue }} />
            <p style={{ fontSize: 13, color: C.blue }}>
              Absher verification is simulated. Actual integration requires MOL API access credentials.
            </p>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <CVisionCard C={C}><CVisionCardBody style={{ padding: 16 }}>
              <div style={{ color: C.green, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 className="h-3.5 w-3.5" /> Verified</div>
              <p style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: C.green }}>{absherCounts.verified}</p>
            </CVisionCardBody></CVisionCard>
            <CVisionCard C={C}><CVisionCardBody style={{ padding: 16 }}>
              <div style={{ color: C.orange, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><Clock className="h-3.5 w-3.5" /> Pending / Never Checked</div>
              <p style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: C.orange }}>{absherCounts.pending}</p>
            </CVisionCardBody></CVisionCard>
            <CVisionCard C={C}><CVisionCardBody style={{ padding: 16 }}>
              <div style={{ color: C.orange, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle className="h-3.5 w-3.5" /> Stale (&gt;90 days)</div>
              <p style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: C.orange }}>{absherCounts.stale}</p>
            </CVisionCardBody></CVisionCard>
            <CVisionCard C={C}><CVisionCardBody style={{ padding: 16 }}>
              <div style={{ color: C.red, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><X className="h-3.5 w-3.5" /> Mismatch</div>
              <p style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: C.red }}>{absherCounts.mismatch}</p>
            </CVisionCardBody></CVisionCard>
          </div>

          {/* Bulk Verification Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck style={{ height: 20, width: 20 }} /> Employee Verification Status
            </h3>
            <CVisionButton C={C} isDark={isDark} size="sm" style={{ gap: 6 }} onClick={handleBulkVerify} disabled={bulkVerifying || actionLoading}>
              {bulkVerifying ? <Loader2 style={{ height: 14, width: 14, animation: 'spin 1s linear infinite' }} /> : <ShieldCheck style={{ height: 14, width: 14 }} />}
              {bulkVerifying ? `Verifying ${bulkProgress} of ${bulkTotal}...` : 'Verify All Employees'}
            </CVisionButton>
          </div>

          {bulkResults && (
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, background: C.greenDim, padding: 12, fontSize: 13 }}>
              <p style={{ fontWeight: 500, color: C.green }}>
                Bulk verification complete: {bulkResults.verified} verified, {bulkResults.mismatches} mismatches, {bulkResults.errors} errors
              </p>
            </div>
          )}

          {/* Employee Table */}
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: 0 }}>
              {records.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32, color: C.textMuted }}>No records to verify</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.textMuted, textAlign: 'left' }}>
                        <th style={{ padding: 12, fontWeight: 500 }}>Employee</th>
                        <th style={{ padding: 12, fontWeight: 500 }}>Iqama #</th>
                        <th style={{ padding: 12, fontWeight: 500 }}>Nationality</th>
                        <th style={{ padding: 12, fontWeight: 500 }}>Last Check</th>
                        <th style={{ padding: 12, fontWeight: 500 }}>Status</th>
                        <th style={{ padding: 12, fontWeight: 500 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((rec) => {
                        const aStatus = absherDisplayStatus(rec);
                        return (
                          <tr key={rec.employeeId} style={{ borderBottom: `1px solid ${C.border}` }}>
                            <td style={{ padding: 12 }}>
                              <div style={{ fontWeight: 500 }}>{rec.employeeName}</div>
                              <div style={{ fontSize: 12, color: C.textMuted }}>{rec.department}</div>
                            </td>
                            <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 12 }}>{rec.iqamaNumber}</td>
                            <td style={{ padding: 12 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {FLAG_MAP[rec.nationality] || '🏳️'} {NATIONALITIES[rec.nationality]?.label || rec.nationality}
                              </span>
                            </td>
                            <td style={{ padding: 12 }}>{rec.lastAbsherCheck ? fmt(rec.lastAbsherCheck) : <span style={{ color: C.textMuted }}>Never</span>}</td>
                            <td style={{ padding: 12 }}>
                              {aStatus === 'VERIFIED' && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.green }}><CheckCircle2 style={{ height: 16, width: 16 }} /> Verified</span>}
                              {aStatus === 'PENDING' && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.orange }}><Clock style={{ height: 16, width: 16 }} /> Pending</span>}
                              {aStatus === 'STALE' && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.orange }}><AlertTriangle style={{ height: 16, width: 16 }} /> Stale</span>}
                              {aStatus === 'MISMATCH' && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.red }}><X style={{ height: 16, width: 16 }} /> Mismatch</span>}
                            </td>
                            <td style={{ padding: 12 }}>
                              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ height: 28, fontSize: 12, gap: 4 }} disabled={actionLoading || bulkVerifying}
                                onClick={() => handleVerifyWithModal(rec)}>
                                <ShieldCheck style={{ height: 12, width: 12 }} /> {aStatus === 'VERIFIED' ? 'Re-check' : 'Verify Now'}
                              </CVisionButton>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CVisionCardBody>
          </CVisionCard>
        </div>
        </CVisionTabContent>
      </CVisionTabs>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: View Detail                                                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <CVisionDialog C={C} open={!!detailRecord} onClose={() => setDetailRecord(null)} title="Record Details" isDark={isDark}>
          {detailRecord && (
            <>                
                <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{detailRecord.department} · {NATIONALITIES[detailRecord.nationality]?.label || detailRecord.nationality}</p>              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 24, marginTop: 16 }}>
                {/* Left column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Iqama Information</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>Number</span><span style={{ fontFamily: 'monospace' }}>{detailRecord.iqamaNumber}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>Issue Date</span><span>{fmt(detailRecord.iqamaIssueDate)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>Expiry Date</span><span>{fmt(detailRecord.iqamaExpiryDate)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>Days Remaining</span><span className={`font-bold ${daysColor(detailRecord.daysRemaining || 0)}`}>{detailRecord.daysRemaining || 0}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>Status</span><StatusBadge status={detailRecord.currentStatus || detailRecord.iqamaStatus} /></div>
                    </div>
                  </div>
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Passport</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>Number</span><span style={{ fontFamily: 'monospace' }}>{detailRecord.passportNumber}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>Issue</span><span>{fmt(detailRecord.passportIssueDate)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>Expiry</span><span>{fmt(detailRecord.passportExpiryDate)}</span></div>
                    </div>
                  </div>
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Insurance</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>Provider</span><span>{detailRecord.insuranceProvider || '—'}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>Number</span><span>{detailRecord.insuranceNumber || '—'}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>Expiry</span><span>{fmt(detailRecord.insuranceExpiryDate)}</span></div>
                    </div>
                  </div>
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Sponsor</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>Name</span><span>{detailRecord.sponsorName}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>CR Number</span><span style={{ fontFamily: 'monospace' }}>{detailRecord.sponsorId}</span></div>
                    </div>
                  </div>
                </div>

                {/* Right column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Dependents ({detailRecord.dependents?.length || 0})</h4>
                    {(!detailRecord.dependents || detailRecord.dependents.length === 0) ? (
                      <p style={{ fontSize: 13, color: C.textMuted }}>No dependents</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {detailRecord.dependents.map((dep: Dependent) => (
                          <div key={dep.id} style={{ padding: 8, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }}>
                            <div style={{ fontWeight: 500 }}>{dep.name}</div>
                            <div style={{ fontSize: 12, color: C.textMuted }}>{dep.relationship} · Iqama: {dep.iqamaNumber || '—'} · Exp: {fmtShort(dep.iqamaExpiryDate)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Cost Breakdown</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>Iqama Renewal</span><span>{sar(IQAMA_RENEWAL_COSTS.EMPLOYEE)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>Work Permit</span><span>{sar(IQAMA_RENEWAL_COSTS.WORK_PERMIT)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>Dependents ({detailRecord.dependents?.length || 0} × {sar(IQAMA_RENEWAL_COSTS.DEPENDENT)})</span><span>{sar((detailRecord.dependents?.length || 0) * IQAMA_RENEWAL_COSTS.DEPENDENT)}</span></div>
                      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>Total Annual</span><span>{sar(detailRecord.totalAnnualCost || 0)}</span></div>
                    </div>
                  </div>
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Absher Status</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      {detailRecord.absherStatus === 'VERIFIED' ? <CheckCircle2 style={{ height: 16, width: 16, color: C.green }} /> : <Clock style={{ height: 16, width: 16, color: C.orange }} />}
                      {detailRecord.absherStatus}
                      {detailRecord.lastAbsherCheck && <span style={{ color: C.textMuted }}>· Last: {fmt(detailRecord.lastAbsherCheck)}</span>}
                    </div>
                  </div>

                  {/* Exit/Re-entry history */}
                  {detailRecord.exitReentryVisas && detailRecord.exitReentryVisas.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Exit/Re-entry History</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {detailRecord.exitReentryVisas.map((v: ExitReentryVisa) => (
                          <div key={v.id} style={{ padding: 8, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v.visaNumber}</span>
                              <StatusBadge status={v.status} />
                            </div>
                            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                              {v.type} · {fmt(v.issueDate)} → {fmt(v.expiryDate)}
                              {v.destination && ` · ${v.destination}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendation */}
                  {detailRecord.recommendation && (
                    <div style={{ padding: 12, borderRadius: 12, background: C.bgSubtle }}>
                      <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Recommendation</h4>
                      <p style={{ fontSize: 13 }}>{detailRecord.recommendation.action}</p>
                      {detailRecord.recommendation.estimatedCost > 0 && (
                        <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Estimated cost: {sar(detailRecord.recommendation.estimatedCost)}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <CVisionDialogFooter C={C}>
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => { setDetailRecord(null); if (detailRecord) openRenewModal(detailRecord); }}>Renew Iqama</CVisionButton>
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => { setDetailRecord(null); if (detailRecord) { setShowExitVisaModal(detailRecord); setExitForm({ type: 'SINGLE', duration: '90', destination: '' }); } }}>Issue Exit Visa</CVisionButton>
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setDetailRecord(null)}>Close</CVisionButton>
              </CVisionDialogFooter>
            </>
          )}
      </CVisionDialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Renew Iqama                                                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <CVisionDialog C={C} open={!!showRenewModal} onClose={() => setShowRenewModal(null)} title="Renew Iqama" isDark={isDark}>
          {showRenewModal && (
            <>                
                <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Current expiry: {fmt(showRenewModal.iqamaExpiryDate)}</p>              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                <div>
                  <CVisionLabel C={C}>New Expiry Date</CVisionLabel>
                  <CVisionInput C={C} type="date" value={renewExpiry} onChange={(e) => setRenewExpiry(e.target.value)} />
                </div>
                <div style={{ padding: 12, background: C.bgSubtle, borderRadius: 12, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Employee Iqama</span><span>{sar(IQAMA_RENEWAL_COSTS.EMPLOYEE)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Work Permit</span><span>{sar(IQAMA_RENEWAL_COSTS.WORK_PERMIT)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Dependents ({showRenewModal.dependents?.length || 0})</span><span>{sar((showRenewModal.dependents?.length || 0) * IQAMA_RENEWAL_COSTS.DEPENDENT)}</span></div>
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>Total</span>
                    <span>{sar(IQAMA_RENEWAL_COSTS.EMPLOYEE + IQAMA_RENEWAL_COSTS.WORK_PERMIT + (showRenewModal.dependents?.length || 0) * IQAMA_RENEWAL_COSTS.DEPENDENT)}</span>
                  </div>
                </div>
              </div>
              <CVisionDialogFooter C={C}>
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setShowRenewModal(null)}>Cancel</CVisionButton>
                <CVisionButton C={C} isDark={isDark} onClick={handleRenew} disabled={renewLoading} style={{ gap: 6 }}>
                  {renewLoading && <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite' }} />} Confirm Renewal
                </CVisionButton>
              </CVisionDialogFooter>
            </>
          )}
      </CVisionDialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Issue Exit/Re-entry Visa                                    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <CVisionDialog C={C} open={!!showExitVisaModal} onClose={() => setShowExitVisaModal(null)} title="Exit Visa" isDark={isDark}>
          {showExitVisaModal && (
            <>                
                <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{showExitVisaModal.employeeName}</p>              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                <div>
                  <CVisionLabel C={C}>Type</CVisionLabel>
                  <CVisionSelect
                C={C}
                value={exitForm.type}
                options={[
                  { value: 'SINGLE', label: 'Single — {sar(IQAMA_RENEWAL_COSTS.EXIT_REENTRY_SINGLE)}' },
                  { value: 'MULTIPLE', label: 'Multiple — {sar(IQAMA_RENEWAL_COSTS.EXIT_REENTRY_MULTIPLE)}' },
                ]}
              />
                </div>
                <div>
                  <CVisionLabel C={C}>Duration (days)</CVisionLabel>
                  <CVisionInput C={C} type="number" value={exitForm.duration} onChange={(e) => setExitForm(f => ({ ...f, duration: e.target.value }))} />
                </div>
                <div>
                  <CVisionLabel C={C}>Destination (optional)</CVisionLabel>
                  <CVisionInput C={C} value={exitForm.destination} onChange={(e) => setExitForm(f => ({ ...f, destination: e.target.value }))} placeholder="e.g. Egypt" />
                </div>
              </div>
              <CVisionDialogFooter C={C}>
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setShowExitVisaModal(null)}>Cancel</CVisionButton>
                <CVisionButton C={C} isDark={isDark} onClick={handleIssueExitVisa} disabled={exitLoading} style={{ gap: 6 }}>
                  {exitLoading && <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite' }} />} Issue Visa
                </CVisionButton>
              </CVisionDialogFooter>
            </>
          )}
      </CVisionDialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Add New Record                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <CVisionDialog C={C} open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Worker" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Create a new iqama record for a non-Saudi employee</p>          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginTop: 16 }}>
            <div className="col-span-2">
              <CVisionLabel C={C}>Employee ID *</CVisionLabel>
              <CVisionInput C={C} value={addForm.employeeId} onChange={(e) => setAddForm(f => ({ ...f, employeeId: e.target.value }))} placeholder="Employee ID" />
            </div>
            <div>
              <CVisionLabel C={C}>Iqama Number * (10 digits, starts with 2)</CVisionLabel>
              <CVisionInput C={C} value={addForm.iqamaNumber} onChange={(e) => setAddForm(f => ({ ...f, iqamaNumber: e.target.value }))} placeholder="2XXXXXXXXX" maxLength={10} />
            </div>
            <div>
              <CVisionLabel C={C}>Nationality *</CVisionLabel>
              <CVisionSelect
                C={C}
                value={addForm.nationality}
                placeholder="Select..."
                options={Object.entries(NATIONALITIES).filter(([, v]) => v.requiresIqama).map(([code, info]) => (
                    ({ value: code, label: `${FLAG_MAP[code] || ''} ${info.label}` })
                  ))}
              />
            </div>
            <div>
              <CVisionLabel C={C}>Iqama Issue Date *</CVisionLabel>
              <CVisionInput C={C} type="date" value={addForm.iqamaIssueDate} onChange={(e) => setAddForm(f => ({ ...f, iqamaIssueDate: e.target.value }))} />
            </div>
            <div>
              <CVisionLabel C={C}>Iqama Expiry Date *</CVisionLabel>
              <CVisionInput C={C} type="date" value={addForm.iqamaExpiryDate} onChange={(e) => setAddForm(f => ({ ...f, iqamaExpiryDate: e.target.value }))} />
            </div>
            <div>
              <CVisionLabel C={C}>Passport Number *</CVisionLabel>
              <CVisionInput C={C} value={addForm.passportNumber} onChange={(e) => setAddForm(f => ({ ...f, passportNumber: e.target.value }))} placeholder="A12345678" />
            </div>
            <div>
              <CVisionLabel C={C}>Passport Issue Date</CVisionLabel>
              <CVisionInput C={C} type="date" value={addForm.passportIssueDate} onChange={(e) => setAddForm(f => ({ ...f, passportIssueDate: e.target.value }))} />
            </div>
            <div>
              <CVisionLabel C={C}>Passport Expiry Date</CVisionLabel>
              <CVisionInput C={C} type="date" value={addForm.passportExpiryDate} onChange={(e) => setAddForm(f => ({ ...f, passportExpiryDate: e.target.value }))} />
            </div>
            <div>
              <CVisionLabel C={C}>Insurance Provider</CVisionLabel>
              <CVisionInput C={C} value={addForm.insuranceProvider} onChange={(e) => setAddForm(f => ({ ...f, insuranceProvider: e.target.value }))} placeholder="e.g. Bupa Arabia" />
            </div>
            <div>
              <CVisionLabel C={C}>Insurance Number</CVisionLabel>
              <CVisionInput C={C} value={addForm.insuranceNumber} onChange={(e) => setAddForm(f => ({ ...f, insuranceNumber: e.target.value }))} />
            </div>
            <div>
              <CVisionLabel C={C}>Insurance Expiry</CVisionLabel>
              <CVisionInput C={C} type="date" value={addForm.insuranceExpiryDate} onChange={(e) => setAddForm(f => ({ ...f, insuranceExpiryDate: e.target.value }))} />
            </div>
          </div>

          {/* Dependents */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <CVisionLabel C={C} style={{ fontSize: 13, fontWeight: 600 }}>Dependents</CVisionLabel>
              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ height: 28, fontSize: 12, gap: 4 }}
                onClick={() => setAddDeps(d => [...d, { name: '', relationship: 'SPOUSE', iqamaNumber: '', dateOfBirth: '' }])}>
                <Plus style={{ height: 12, width: 12 }} /> Add Dependent
              </CVisionButton>
            </div>
            {addDeps.map((dep, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
                <CVisionInput C={C} placeholder="Name" value={dep.name} onChange={(e) => { const d = [...addDeps]; d[i].name = e.target.value; setAddDeps(d); }} />
                <CVisionSelect
                C={C}
                value={dep.relationship}
                options={[
                  { value: 'SPOUSE', label: 'Spouse' },
                  { value: 'SON', label: 'Son' },
                  { value: 'DAUGHTER', label: 'Daughter' },
                  { value: 'PARENT', label: 'Parent' },
                ]}
              />
                <CVisionInput C={C} placeholder="Iqama #" value={dep.iqamaNumber} onChange={(e) => { const d = [...addDeps]; d[i].iqamaNumber = e.target.value; setAddDeps(d); }} />
                <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ height: 36 }} onClick={() => setAddDeps(d => d.filter((_, j) => j !== i))}>
                  <X style={{ height: 16, width: 16 }} />
                </CVisionButton>
              </div>
            ))}
          </div>

          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setShowAddModal(false)}>Cancel</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleAddRecord} disabled={addLoading} style={{ gap: 6 }}>
              {addLoading && <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite' }} />} Save Record
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Record Departure                                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <CVisionDialog C={C} open={!!showDepartureModal} onClose={() => setShowDepartureModal(null)} title="Record Departure" isDark={isDark}>
          {showDepartureModal && (
            <>                
                <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{showDepartureModal.employeeName} — Visa #{showDepartureModal.visaNumber}</p>              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                <div>
                  <CVisionLabel C={C}>Departure Date</CVisionLabel>
                  <CVisionInput C={C} type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} />
                </div>
                <div>
                  <CVisionLabel C={C}>Destination</CVisionLabel>
                  <CVisionInput C={C} value={departureDestination} onChange={(e) => setDepartureDestination(e.target.value)}
                    placeholder="e.g. Jordan" />
                </div>
              </div>
              <CVisionDialogFooter C={C}>
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setShowDepartureModal(null)}>Cancel</CVisionButton>
                <CVisionButton C={C} isDark={isDark} onClick={handleRecordDeparture} disabled={departureLoading} style={{ gap: 6 }}>
                  {departureLoading && <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite' }} />} Confirm Departure
                </CVisionButton>
              </CVisionDialogFooter>
            </>
          )}
      </CVisionDialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Record Return                                               */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <CVisionDialog C={C} open={!!showReturnModal} onClose={() => setShowReturnModal(null)} title="Record Return" isDark={isDark}>
          {showReturnModal && (
            <>                
                <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{showReturnModal.employeeName} — Visa #{showReturnModal.visaNumber}</p>              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                <div>
                  <CVisionLabel C={C}>Return Date</CVisionLabel>
                  <CVisionInput C={C} type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
                </div>
                <div style={{ padding: 12, background: C.bgSubtle, borderRadius: 12, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>Visa Expiry</span><span>{fmt(showReturnModal.expiryDate)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>Departed</span><span>{fmt(showReturnModal.departureDate)}</span></div>
                  {returnDate && new Date(returnDate) > new Date(showReturnModal.expiryDate) && (
                    <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: C.redDim, color: C.red, fontSize: 12, fontWeight: 500 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle className="h-3.5 w-3.5" /> Employee returned after visa expiry — iqama may be affected</span>
                    </div>
                  )}
                </div>
              </div>
              <CVisionDialogFooter C={C}>
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setShowReturnModal(null)}>Cancel</CVisionButton>
                <CVisionButton C={C} isDark={isDark} onClick={handleRecordReturn} disabled={returnLoading} style={{ gap: 6 }}>
                  {returnLoading && <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite' }} />} Confirm Return
                </CVisionButton>
              </CVisionDialogFooter>
            </>
          )}
      </CVisionDialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Issue Exit/Re-entry from Tab 3                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <CVisionDialog C={C} open={showIssueFromTab} onClose={() => setShowIssueFromTab(false)} title="Issue Iqama" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Select an employee with an active iqama</p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            <div>
              <CVisionLabel C={C}>Employee</CVisionLabel>
              <CVisionSelect
                C={C}
                value={issueEmployee}
                onChange={setIssueEmployee}
                placeholder="Select employee..."
                options={activeIqamaRecords.map(r => (
                    ({ value: r.employeeId, label: `${FLAG_MAP[r.nationality] || ''} ${r.employeeName} — ${r.iqamaNumber}` })
                  ))}
              />
            </div>
            <div>
              <CVisionLabel C={C}>Visa Type</CVisionLabel>
              <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center text-sm transition-colors ${issueForm.type === 'SINGLE' ? 'border-primary bg-primary/5 font-medium' : 'hover:bg-muted'}`}>
                  <input type="radio" name="visaType" className="sr-only" checked={issueForm.type === 'SINGLE'}
                    onChange={() => setIssueForm(f => ({ ...f, type: 'SINGLE' }))} />
                  Single<br /><span style={{ fontSize: 12, color: C.textMuted }}>{sar(IQAMA_RENEWAL_COSTS.EXIT_REENTRY_SINGLE)}</span>
                </label>
                <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center text-sm transition-colors ${issueForm.type === 'MULTIPLE' ? 'border-primary bg-primary/5 font-medium' : 'hover:bg-muted'}`}>
                  <input type="radio" name="visaType" className="sr-only" checked={issueForm.type === 'MULTIPLE'}
                    onChange={() => setIssueForm(f => ({ ...f, type: 'MULTIPLE' }))} />
                  Multiple<br /><span style={{ fontSize: 12, color: C.textMuted }}>{sar(IQAMA_RENEWAL_COSTS.EXIT_REENTRY_MULTIPLE)}</span>
                </label>
              </div>
            </div>
            <div>
              <CVisionLabel C={C}>Duration</CVisionLabel>
              <CVisionSelect
                C={C}
                value={issueForm.duration}
                options={[
                  { value: '30', label: '30 days' },
                  { value: '60', label: '60 days' },
                  { value: '90', label: '90 days' },
                  { value: '180', label: '180 days' },
                ]}
              />
            </div>
            <div>
              <CVisionLabel C={C}>Estimated Departure Date</CVisionLabel>
              <CVisionInput C={C} type="date" value={issueForm.departureDate} onChange={(e) => setIssueForm(f => ({ ...f, departureDate: e.target.value }))} />
            </div>
            <div>
              <CVisionLabel C={C}>Destination Country</CVisionLabel>
              <CVisionInput C={C} value={issueForm.destination} onChange={(e) => setIssueForm(f => ({ ...f, destination: e.target.value }))}
                placeholder="e.g. Egypt" />
            </div>
            <div style={{ padding: 12, background: C.bgSubtle, borderRadius: 12, fontSize: 13, display: 'flex', justifyContent: 'space-between', fontWeight: 500 }}>
              <span>Visa Cost</span>
              <span>{sar(issueForm.type === 'SINGLE' ? IQAMA_RENEWAL_COSTS.EXIT_REENTRY_SINGLE : IQAMA_RENEWAL_COSTS.EXIT_REENTRY_MULTIPLE)}</span>
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setShowIssueFromTab(false)}>Cancel</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleIssueVisaFromTab} disabled={issueLoading || !issueEmployee} style={{ gap: 6 }}>
              {issueLoading && <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite' }} />} Issue Visa
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Absher Verification                                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <CVisionDialog C={C} open={!!showVerifyModal} onClose={() => setShowVerifyModal(null)} title="Verify Status" isDark={isDark}>
          {showVerifyModal && (
            <>                              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                {/* System Data */}
                <div style={{ padding: 12, background: C.bgSubtle, borderRadius: 12, fontSize: 13, fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <p style={{ fontWeight: 600, fontSize: 12, color: C.textMuted, marginBottom: 8 }}>System Data</p>
                  <p>├── Iqama: {showVerifyModal.iqamaNumber}</p>
                  <p>├── Name: {showVerifyModal.employeeName}</p>
                  <p>├── Employer: Thea Health</p>
                  <p>└── Status: Valid until {fmt(showVerifyModal.iqamaExpiryDate)}</p>
                </div>

                {verifyStep === 'loading' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 32, paddingBottom: 32, gap: 12 }}>
                    <Loader2 style={{ height: 32, width: 32, animation: 'spin 1s linear infinite', color: C.gold }} />
                    <p style={{ fontSize: 13, color: C.textMuted }}>Connecting to Absher...</p>
                  </div>
                ) : (
                  <div style={{ padding: 12, background: C.greenDim, borderRadius: 12, fontSize: 13, fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: 4, border: `1px solid ${C.border}` }}>
                    <p style={{ fontWeight: 600, fontSize: 12, color: C.green, marginBottom: 8 }}>Simulated Absher Response</p>
                    <p>├── Status: Valid</p>
                    <p>├── Name Match: Pass</p>
                    <p>├── Employer Match: Pass</p>
                    <p>└── Expiry Confirmed: Pass</p>
                  </div>
                )}
              </div>
              <CVisionDialogFooter C={C}>
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setShowVerifyModal(null)}>Cancel</CVisionButton>
                {verifyStep === 'result' && (
                  <>
                    <CVisionButton C={C} isDark={isDark} variant="outline" onClick={handleReportMismatch} disabled={actionLoading}
                      style={{ color: C.red }}>
                      Report Mismatch
                    </CVisionButton>
                    <CVisionButton C={C} isDark={isDark} onClick={handleConfirmVerify} disabled={actionLoading} style={{ gap: 6 }}>
                      {actionLoading && <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite' }} />} Confirm Verified
                    </CVisionButton>
                  </>
                )}
              </CVisionDialogFooter>
            </>
          )}
      </CVisionDialog>
    </div>
  );
}
