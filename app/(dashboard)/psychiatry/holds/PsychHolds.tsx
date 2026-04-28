'use client';

import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import useSWR from 'swr';
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Shield,
  Lock,
  Clock,
  AlertTriangle,
  Plus,
  Users,
  FileText,
  Bell,
  Scale,
  CheckCircle,
  Eye,
  UserX,
  Brain,
  Gavel,
  HeartPulse,
  ClipboardList,
  Phone,
  CalendarClock,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface HoldReview {
  reviewDate: string;
  reviewedBy: string;
  reviewedByUserId?: string;
  justificationContinues: boolean;
  notes?: string;
}

interface InvoluntaryHold {
  id: string;
  tenantId: string;
  patientMasterId: string;
  episodeId?: string;
  encounterId?: string;
  holdType: string;
  status: string;
  holdStartAt: string;
  holdExpiresAt: string;
  legalBasis?: string;
  dangerToSelf: boolean;
  dangerToSelfEvidence?: string;
  dangerToOthers: boolean;
  dangerToOthersEvidence?: string;
  gravelyDisabled: boolean;
  gravelyDisabledEvidence?: string;
  additionalCriteria?: string;
  extensionReason?: string;
  extensionRequested: boolean;
  courtOrderRef?: string;
  courtOrderDate?: string;
  patientNotified: boolean;
  patientNotifiedAt?: string;
  familyNotified: boolean;
  familyNotifiedAt?: string;
  familyNotifiedBy?: string;
  familyContactName?: string;
  legalRepNotified: boolean;
  legalRepNotifiedAt?: string;
  psychiatricEvalAt?: string;
  psychiatricEvalBy?: string;
  evalFindings?: string;
  reviews: HoldReview[];
  conversionToVoluntary: boolean;
  voluntaryConsentAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  notes?: string;
  orderedByUserId: string;
  orderedByName?: string;
  orderedAt: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function msUntilExpiry(expiresAt: string): number {
  return new Date(expiresAt).getTime() - Date.now();
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'EXPIRED';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return `${d}d ${rh}h`;
  }
  return `${h}h ${m}m`;
}

function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return '---';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ================================================================== */
/*  PsychHolds Component                                               */
/* ================================================================== */
export default function PsychHolds() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  /* ---------- State ---------- */
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewTab, setViewTab] = useState('overview');
  const [selectedHold, setSelectedHold] = useState<InvoluntaryHold | null>(null);

  // Sub-dialogs for view/manage
  const [showEvalDialog, setShowEvalDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [showExtensionDialog, setShowExtensionDialog] = useState(false);

  // Tick timer for countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  // Create form state
  const [createForm, setCreateForm] = useState({
    patientMasterId: '',
    holdType: 'INITIAL_72H',
    legalBasis: '',
    holdStartAt: new Date().toISOString().slice(0, 16),
    dangerToSelf: false,
    dangerToSelfEvidence: '',
    dangerToOthers: false,
    dangerToOthersEvidence: '',
    gravelyDisabled: false,
    gravelyDisabledEvidence: '',
    additionalCriteria: '',
    extensionReason: '',
    courtOrderRef: '',
    courtOrderDate: '',
    notes: '',
  });

  // Eval form
  const [evalForm, setEvalForm] = useState({ evaluator: '', findings: '' });

  // Review form
  const [reviewForm, setReviewForm] = useState({ justificationContinues: true, notes: '' });

  // Resolve form
  const [resolveForm, setResolveForm] = useState({ newStatus: 'DISCHARGED', notes: '' });

  // Extension form
  const [extensionForm, setExtensionForm] = useState({ reason: '' });

  // Notify family form
  const [familyForm, setFamilyForm] = useState({ notifiedBy: '', contactName: '' });

  /* ---------- Data ---------- */
  const params = new URLSearchParams();
  if (statusFilter !== 'ALL') params.set('status', statusFilter);
  if (typeFilter !== 'ALL') params.set('holdType', typeFilter);
  const queryString = params.toString() ? `?${params.toString()}` : '';

  const { data, mutate } = useSWR(`/api/psychiatry/involuntary-hold${queryString}`, fetcher, { refreshInterval: 15000 });
  const holds: InvoluntaryHold[] = data?.holds ?? [];

  const filtered = holds.filter(
    (h) =>
      !search ||
      h.patientMasterId.toLowerCase().includes(search.toLowerCase()) ||
      (h.orderedByName || '').toLowerCase().includes(search.toLowerCase()) ||
      (h.legalBasis || '').toLowerCase().includes(search.toLowerCase()),
  );

  /* ---------- KPIs ---------- */
  const activeHolds = holds.filter((h) => h.status === 'ACTIVE');
  const activeCount = activeHolds.length;
  const expiringIn24h = activeHolds.filter((h) => {
    const ms = msUntilExpiry(h.holdExpiresAt);
    return ms > 0 && ms <= 24 * 60 * 60 * 1000;
  }).length;
  const pendingEvals = activeHolds.filter((h) => !h.psychiatricEvalAt).length;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const totalThisMonth = holds.filter((h) => new Date(h.orderedAt) >= monthStart).length;

  /* ---------- Submission helpers ---------- */
  const [submitting, setSubmitting] = useState(false);

  async function apiPost(body: Record<string, unknown>) {
    const res = await fetch('/api/psychiatry/involuntary-hold', {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function apiPut(body: Record<string, unknown>) {
    const res = await fetch('/api/psychiatry/involuntary-hold', {
      credentials: 'include',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function handleCreate() {
    if (!createForm.patientMasterId.trim()) {
      toast({ title: tr('معرف المريض مطلوب', 'Patient ID is required'), variant: 'destructive' });
      return;
    }
    if (!createForm.dangerToSelf && !createForm.dangerToOthers && !createForm.gravelyDisabled) {
      toast({ title: tr('معيار واحد على الأقل مطلوب', 'At least one criterion is required'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiPost(createForm);
      if (result.error) {
        toast({ title: result.error, variant: 'destructive' });
      } else {
        toast({ title: tr('تم إنشاء الاحتجاز', 'Hold created successfully') });
        setShowCreateDialog(false);
        setCreateStep(1);
        setCreateForm({
          patientMasterId: '',
          holdType: 'INITIAL_72H',
          legalBasis: '',
          holdStartAt: new Date().toISOString().slice(0, 16),
          dangerToSelf: false,
          dangerToSelfEvidence: '',
          dangerToOthers: false,
          dangerToOthersEvidence: '',
          gravelyDisabled: false,
          gravelyDisabledEvidence: '',
          additionalCriteria: '',
          extensionReason: '',
          courtOrderRef: '',
          courtOrderDate: '',
          notes: '',
        });
        mutate();
      }
    } catch {
      toast({ title: tr('حدث خطأ', 'An error occurred'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(action: string, extra: Record<string, unknown> = {}) {
    if (!selectedHold) return;
    setSubmitting(true);
    try {
      const result = await apiPut({ id: selectedHold.id, action, ...extra });
      if (result.error) {
        toast({ title: result.error, variant: 'destructive' });
      } else {
        toast({ title: tr('تم التحديث', 'Updated successfully') });
        setSelectedHold(result.hold);
        mutate();
      }
    } catch {
      toast({ title: tr('حدث خطأ', 'An error occurred'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- Badge helpers ---------- */
  const holdTypeBadge = (type: string) => {
    switch (type) {
      case 'INITIAL_72H':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'EXTENSION':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'COURT_ORDER':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const holdTypeLabel = (type: string) => {
    switch (type) {
      case 'INITIAL_72H': return tr('72 ساعة أولية', '72h Initial');
      case 'EXTENSION': return tr('تمديد 14 يوم', '14-Day Extension');
      case 'COURT_ORDER': return tr('أمر محكمة', 'Court Order');
      default: return type;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'EXPIRED':
        return 'bg-muted text-foreground';
      case 'CONVERTED_VOLUNTARY':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'DISCHARGED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'COURT_RELEASED':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE': return tr('نشط', 'Active');
      case 'EXPIRED': return tr('منتهي', 'Expired');
      case 'CONVERTED_VOLUNTARY': return tr('تحويل طوعي', 'Voluntary');
      case 'DISCHARGED': return tr('مخرج', 'Discharged');
      case 'COURT_RELEASED': return tr('إفراج قضائي', 'Court Released');
      default: return status;
    }
  };

  /* ================================================================== */
  /*  RENDER                                                             */
  /* ================================================================== */
  return (
    <div className="space-y-6 p-4 md:p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* ---------- Header ---------- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-red-600" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{tr('الاحتجاز القسري', 'Involuntary Holds')}</h1>
            <p className="text-sm text-muted-foreground">{tr('إدارة حالات الاحتجاز القسري والإجراءات القانونية', 'Manage involuntary holds and legal procedures')}</p>
          </div>
        </div>
        <Button onClick={() => { setShowCreateDialog(true); setCreateStep(1); }} className="gap-2">
          <Plus className="h-4 w-4" />
          {tr('احتجاز جديد', 'New Hold')}
        </Button>
      </div>

      {/* ---------- KPI Cards ---------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{tr('احتجازات نشطة', 'Active Holds')}</CardTitle>
            <Lock className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{tr('تنتهي خلال 24 ساعة', 'Expiring in 24h')}</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{expiringIn24h}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{tr('تقييمات معلقة', 'Pending Evaluations')}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{pendingEvals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{tr('إجمالي هذا الشهر', 'Total This Month')}</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalThisMonth}</div>
          </CardContent>
        </Card>
      </div>

      {/* ---------- Filters ---------- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <Input
          placeholder={tr('بحث بمعرف المريض أو الاسم...', 'Search by patient ID or name...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="ALL">{tr('الكل', 'All')}</TabsTrigger>
            <TabsTrigger value="ACTIVE">{tr('نشط', 'Active')}</TabsTrigger>
            <TabsTrigger value="EXPIRED">{tr('منتهي', 'Expired')}</TabsTrigger>
            <TabsTrigger value="CONVERTED_VOLUNTARY">{tr('طوعي', 'Voluntary')}</TabsTrigger>
            <TabsTrigger value="DISCHARGED">{tr('مخرج', 'Discharged')}</TabsTrigger>
            <TabsTrigger value="COURT_RELEASED">{tr('إفراج', 'Released')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={tr('نوع الاحتجاز', 'Hold Type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('جميع الأنواع', 'All Types')}</SelectItem>
            <SelectItem value="INITIAL_72H">{tr('72 ساعة أولية', '72h Initial')}</SelectItem>
            <SelectItem value="EXTENSION">{tr('تمديد', 'Extension')}</SelectItem>
            <SelectItem value="COURT_ORDER">{tr('أمر محكمة', 'Court Order')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ---------- Table ---------- */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-start font-medium">{tr('التاريخ', 'Date')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('المريض', 'Patient')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('نوع الاحتجاز', 'Hold Type')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('المعايير', 'Criteria')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('الحالة', 'Status')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('ينتهي خلال', 'Expires In')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('الإجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      {tr('لا توجد سجلات احتجاز', 'No hold records found')}
                    </td>
                  </tr>
                )}
                {filtered.map((hold) => {
                  const remaining = msUntilExpiry(hold.holdExpiresAt);
                  const isExpired = remaining <= 0 && hold.status === 'ACTIVE';
                  const isUrgent = remaining > 0 && remaining <= 24 * 60 * 60 * 1000 && hold.status === 'ACTIVE';

                  return (
                    <tr key={hold.id} className="border-b transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(hold.orderedAt)}
                      </td>
                      <td className="px-4 py-3 font-medium">{hold.patientMasterId}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={holdTypeBadge(hold.holdType)}>
                          {holdTypeLabel(hold.holdType)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {hold.dangerToSelf && (
                            <span title={tr('خطر على النفس', 'Danger to Self')}>
                              <UserX className="h-4 w-4 text-red-500" />
                            </span>
                          )}
                          {hold.dangerToOthers && (
                            <span title={tr('خطر على الآخرين', 'Danger to Others')}>
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                            </span>
                          )}
                          {hold.gravelyDisabled && (
                            <span title={tr('عجز شديد', 'Gravely Disabled')}>
                              <HeartPulse className="h-4 w-4 text-purple-500" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={statusBadge(hold.status)}>
                          {statusLabel(hold.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {hold.status === 'ACTIVE' ? (
                          <span className={`text-xs font-semibold ${isExpired ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-muted-foreground'}`}>
                            {isExpired ? (
                              <span className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {tr('منتهي', 'EXPIRED')}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatCountdown(remaining)}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">---</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedHold(hold);
                            setViewTab('overview');
                            setShowViewDialog(true);
                          }}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          {tr('عرض', 'View')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ================================================================== */}
      {/*  CREATE DIALOG (Multi-Step)                                          */}
      {/* ================================================================== */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-600" />
              {tr('إنشاء احتجاز قسري جديد', 'Create New Involuntary Hold')}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {tr(`الخطوة ${createStep} من ${createForm.holdType === 'INITIAL_72H' ? '3' : '4'}`, `Step ${createStep} of ${createForm.holdType === 'INITIAL_72H' ? '3' : '4'}`)}
            </p>
          </DialogHeader>

          {/* Step 1: Patient & Legal */}
          {createStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">{tr('المريض والأساس القانوني', 'Patient & Legal Basis')}</h3>
              <div className="space-y-3">
                <div>
                  <Label>{tr('معرف المريض', 'Patient ID')} *</Label>
                  <Input
                    value={createForm.patientMasterId}
                    onChange={(e) => setCreateForm((f) => ({ ...f, patientMasterId: e.target.value }))}
                    placeholder={tr('أدخل معرف المريض', 'Enter patient ID')}
                  />
                </div>
                <div>
                  <Label>{tr('نوع الاحتجاز', 'Hold Type')} *</Label>
                  <Select value={createForm.holdType} onValueChange={(v) => setCreateForm((f) => ({ ...f, holdType: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INITIAL_72H">{tr('احتجاز أولي 72 ساعة', '72-Hour Initial Hold')}</SelectItem>
                      <SelectItem value="EXTENSION">{tr('تمديد 14 يوم', '14-Day Extension')}</SelectItem>
                      <SelectItem value="COURT_ORDER">{tr('أمر محكمة 30 يوم', '30-Day Court Order')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{tr('الأساس القانوني', 'Legal Basis')}</Label>
                  <Textarea
                    value={createForm.legalBasis}
                    onChange={(e) => setCreateForm((f) => ({ ...f, legalBasis: e.target.value }))}
                    placeholder={tr('الأساس القانوني للاحتجاز...', 'Legal basis for hold...')}
                    rows={3}
                  />
                </div>
                <div>
                  <Label>{tr('بداية الاحتجاز', 'Hold Start')} *</Label>
                  <Input
                    type="datetime-local"
                    value={createForm.holdStartAt}
                    onChange={(e) => setCreateForm((f) => ({ ...f, holdStartAt: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Criteria */}
          {createStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">{tr('معايير الاحتجاز', 'Hold Criteria')}</h3>
              <p className="text-xs text-muted-foreground">{tr('يجب اختيار معيار واحد على الأقل', 'At least one criterion must be selected')}</p>

              {/* Danger to Self */}
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="dangerToSelf"
                    checked={createForm.dangerToSelf}
                    onCheckedChange={(c) => setCreateForm((f) => ({ ...f, dangerToSelf: Boolean(c) }))}
                  />
                  <Label htmlFor="dangerToSelf" className="flex items-center gap-2 cursor-pointer font-medium">
                    <UserX className="h-4 w-4 text-red-500" />
                    {tr('خطر على النفس', 'Danger to Self')}
                  </Label>
                </div>
                {createForm.dangerToSelf && (
                  <Textarea
                    value={createForm.dangerToSelfEvidence}
                    onChange={(e) => setCreateForm((f) => ({ ...f, dangerToSelfEvidence: e.target.value }))}
                    placeholder={tr('الأدلة والملاحظات...', 'Evidence and observations...')}
                    rows={2}
                  />
                )}
              </div>

              {/* Danger to Others */}
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="dangerToOthers"
                    checked={createForm.dangerToOthers}
                    onCheckedChange={(c) => setCreateForm((f) => ({ ...f, dangerToOthers: Boolean(c) }))}
                  />
                  <Label htmlFor="dangerToOthers" className="flex items-center gap-2 cursor-pointer font-medium">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    {tr('خطر على الآخرين', 'Danger to Others')}
                  </Label>
                </div>
                {createForm.dangerToOthers && (
                  <Textarea
                    value={createForm.dangerToOthersEvidence}
                    onChange={(e) => setCreateForm((f) => ({ ...f, dangerToOthersEvidence: e.target.value }))}
                    placeholder={tr('الأدلة والملاحظات...', 'Evidence and observations...')}
                    rows={2}
                  />
                )}
              </div>

              {/* Gravely Disabled */}
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="gravelyDisabled"
                    checked={createForm.gravelyDisabled}
                    onCheckedChange={(c) => setCreateForm((f) => ({ ...f, gravelyDisabled: Boolean(c) }))}
                  />
                  <Label htmlFor="gravelyDisabled" className="flex items-center gap-2 cursor-pointer font-medium">
                    <HeartPulse className="h-4 w-4 text-purple-500" />
                    {tr('عجز شديد', 'Gravely Disabled')}
                  </Label>
                </div>
                {createForm.gravelyDisabled && (
                  <Textarea
                    value={createForm.gravelyDisabledEvidence}
                    onChange={(e) => setCreateForm((f) => ({ ...f, gravelyDisabledEvidence: e.target.value }))}
                    placeholder={tr('الأدلة والملاحظات...', 'Evidence and observations...')}
                    rows={2}
                  />
                )}
              </div>

              {/* Additional Criteria */}
              <div>
                <Label>{tr('معايير إضافية', 'Additional Criteria')}</Label>
                <Textarea
                  value={createForm.additionalCriteria}
                  onChange={(e) => setCreateForm((f) => ({ ...f, additionalCriteria: e.target.value }))}
                  placeholder={tr('أي معايير إضافية...', 'Any additional criteria...')}
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Step 3: Extension / Court (only for EXTENSION or COURT_ORDER) */}
          {createStep === 3 && createForm.holdType !== 'INITIAL_72H' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">
                {createForm.holdType === 'EXTENSION'
                  ? tr('تفاصيل التمديد', 'Extension Details')
                  : tr('تفاصيل أمر المحكمة', 'Court Order Details')}
              </h3>
              <div className="space-y-3">
                <div>
                  <Label>{tr('سبب التمديد', 'Extension Reason')}</Label>
                  <Textarea
                    value={createForm.extensionReason}
                    onChange={(e) => setCreateForm((f) => ({ ...f, extensionReason: e.target.value }))}
                    placeholder={tr('سبب طلب التمديد...', 'Reason for extension request...')}
                    rows={3}
                  />
                </div>
                {createForm.holdType === 'COURT_ORDER' && (
                  <>
                    <div>
                      <Label>{tr('رقم أمر المحكمة', 'Court Order Reference')}</Label>
                      <Input
                        value={createForm.courtOrderRef}
                        onChange={(e) => setCreateForm((f) => ({ ...f, courtOrderRef: e.target.value }))}
                        placeholder={tr('رقم الأمر القضائي', 'Court order number')}
                      />
                    </div>
                    <div>
                      <Label>{tr('تاريخ أمر المحكمة', 'Court Order Date')}</Label>
                      <Input
                        type="date"
                        value={createForm.courtOrderDate}
                        onChange={(e) => setCreateForm((f) => ({ ...f, courtOrderDate: e.target.value }))}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 3 for INITIAL or Step 4 for others: Confirm */}
          {((createStep === 3 && createForm.holdType === 'INITIAL_72H') ||
            (createStep === 4 && createForm.holdType !== 'INITIAL_72H')) && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">{tr('مراجعة وتأكيد', 'Review & Confirm')}</h3>
              <div className="rounded-lg border p-4 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-muted-foreground">{tr('المريض', 'Patient')}:</span>
                  <span className="font-medium">{createForm.patientMasterId}</span>

                  <span className="text-muted-foreground">{tr('نوع الاحتجاز', 'Hold Type')}:</span>
                  <span className="font-medium">{holdTypeLabel(createForm.holdType)}</span>

                  <span className="text-muted-foreground">{tr('البداية', 'Start')}:</span>
                  <span className="font-medium">{formatDateTime(createForm.holdStartAt)}</span>
                </div>
                <hr />
                <div>
                  <span className="font-medium">{tr('المعايير', 'Criteria')}:</span>
                  <ul className="mt-1 space-y-1">
                    {createForm.dangerToSelf && (
                      <li className="flex items-center gap-2">
                        <UserX className="h-3.5 w-3.5 text-red-500" />
                        {tr('خطر على النفس', 'Danger to Self')}
                        {createForm.dangerToSelfEvidence && <span className="text-muted-foreground">({createForm.dangerToSelfEvidence.slice(0, 50)}...)</span>}
                      </li>
                    )}
                    {createForm.dangerToOthers && (
                      <li className="flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                        {tr('خطر على الآخرين', 'Danger to Others')}
                        {createForm.dangerToOthersEvidence && <span className="text-muted-foreground">({createForm.dangerToOthersEvidence.slice(0, 50)}...)</span>}
                      </li>
                    )}
                    {createForm.gravelyDisabled && (
                      <li className="flex items-center gap-2">
                        <HeartPulse className="h-3.5 w-3.5 text-purple-500" />
                        {tr('عجز شديد', 'Gravely Disabled')}
                        {createForm.gravelyDisabledEvidence && <span className="text-muted-foreground">({createForm.gravelyDisabledEvidence.slice(0, 50)}...)</span>}
                      </li>
                    )}
                  </ul>
                </div>
                {createForm.legalBasis && (
                  <>
                    <hr />
                    <div>
                      <span className="font-medium">{tr('الأساس القانوني', 'Legal Basis')}:</span>
                      <p className="mt-1 text-muted-foreground">{createForm.legalBasis}</p>
                    </div>
                  </>
                )}
                {createForm.extensionReason && (
                  <>
                    <hr />
                    <div>
                      <span className="font-medium">{tr('سبب التمديد', 'Extension Reason')}:</span>
                      <p className="mt-1 text-muted-foreground">{createForm.extensionReason}</p>
                    </div>
                  </>
                )}
              </div>
              <div>
                <Label>{tr('ملاحظات إضافية', 'Additional Notes')}</Label>
                <Textarea
                  value={createForm.notes}
                  onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder={tr('ملاحظات اختيارية...', 'Optional notes...')}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {createStep > 1 && (
              <Button variant="outline" onClick={() => setCreateStep((s) => s - 1)}>
                {tr('السابق', 'Back')}
              </Button>
            )}
            {/* Next / Submit logic */}
            {(() => {
              const totalSteps = createForm.holdType === 'INITIAL_72H' ? 3 : 4;
              const isLastStep = createStep === totalSteps;
              // For INITIAL_72H: Step 3 is confirm. Steps 1, 2, 3.
              // For EXTENSION/COURT_ORDER: Step 4 is confirm. Steps 1, 2, 3, 4.
              // But step 3 for INITIAL_72H is the same as step 4 for non-INITIAL.
              // We need to skip step 3 (extension) when INITIAL_72H, so:
              const isConfirmStep =
                (createStep === 3 && createForm.holdType === 'INITIAL_72H') ||
                (createStep === 4 && createForm.holdType !== 'INITIAL_72H');

              if (isConfirmStep) {
                return (
                  <Button onClick={handleCreate} disabled={submitting}>
                    {submitting ? tr('جاري الإنشاء...', 'Creating...') : tr('إنشاء الاحتجاز', 'Create Hold')}
                  </Button>
                );
              }
              return (
                <Button
                  onClick={() => {
                    // Validate step 1
                    if (createStep === 1 && !createForm.patientMasterId.trim()) {
                      toast({ title: tr('معرف المريض مطلوب', 'Patient ID is required'), variant: 'destructive' });
                      return;
                    }
                    // Validate step 2
                    if (createStep === 2 && !createForm.dangerToSelf && !createForm.dangerToOthers && !createForm.gravelyDisabled) {
                      toast({ title: tr('معيار واحد على الأقل مطلوب', 'At least one criterion is required'), variant: 'destructive' });
                      return;
                    }
                    // For INITIAL_72H, skip step 3 (extension details) and go directly to confirm
                    if (createStep === 2 && createForm.holdType === 'INITIAL_72H') {
                      setCreateStep(3);
                    } else {
                      setCreateStep((s) => s + 1);
                    }
                  }}
                >
                  {tr('التالي', 'Next')}
                </Button>
              );
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/*  VIEW/MANAGE DIALOG (Tabbed)                                         */}
      {/* ================================================================== */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-600" />
              {tr('تفاصيل الاحتجاز القسري', 'Involuntary Hold Details')}
            </DialogTitle>
          </DialogHeader>

          {selectedHold && (
            <Tabs value={viewTab} onValueChange={setViewTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview" className="text-xs">{tr('نظرة عامة', 'Overview')}</TabsTrigger>
                <TabsTrigger value="notifications" className="text-xs">{tr('الإشعارات', 'Notifications')}</TabsTrigger>
                <TabsTrigger value="evaluation" className="text-xs">{tr('التقييم', 'Evaluation')}</TabsTrigger>
                <TabsTrigger value="reviews" className="text-xs">{tr('المراجعات', 'Reviews')}</TabsTrigger>
                <TabsTrigger value="resolution" className="text-xs">{tr('الحل', 'Resolution')}</TabsTrigger>
              </TabsList>

              {/* ---- Overview Tab ---- */}
              <TabsContent value="overview" className="space-y-4 mt-4">
                {/* Status + Countdown */}
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={`text-base px-3 py-1 ${statusBadge(selectedHold.status)}`}>
                    {statusLabel(selectedHold.status)}
                  </Badge>
                  {selectedHold.status === 'ACTIVE' && (
                    <div className={`text-lg font-bold ${msUntilExpiry(selectedHold.holdExpiresAt) <= 0 ? 'text-red-600' : msUntilExpiry(selectedHold.holdExpiresAt) <= 24 * 60 * 60 * 1000 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        {msUntilExpiry(selectedHold.holdExpiresAt) <= 0
                          ? tr('منتهي الصلاحية', 'EXPIRED')
                          : `${formatCountdown(msUntilExpiry(selectedHold.holdExpiresAt))} ${tr('متبقي', 'remaining')}`}
                      </div>
                    </div>
                  )}
                </div>

                {/* Hold info grid */}
                <div className="rounded-lg border p-4 space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-y-2">
                    <span className="text-muted-foreground">{tr('نوع الاحتجاز', 'Hold Type')}:</span>
                    <Badge variant="outline" className={holdTypeBadge(selectedHold.holdType)}>
                      {holdTypeLabel(selectedHold.holdType)}
                    </Badge>

                    <span className="text-muted-foreground">{tr('المريض', 'Patient')}:</span>
                    <span className="font-medium">{selectedHold.patientMasterId}</span>

                    <span className="text-muted-foreground">{tr('بداية الاحتجاز', 'Hold Start')}:</span>
                    <span>{formatDateTime(selectedHold.holdStartAt)}</span>

                    <span className="text-muted-foreground">{tr('انتهاء الاحتجاز', 'Hold Expiry')}:</span>
                    <span>{formatDateTime(selectedHold.holdExpiresAt)}</span>

                    <span className="text-muted-foreground">{tr('أمر بواسطة', 'Ordered By')}:</span>
                    <span>{selectedHold.orderedByName || selectedHold.orderedByUserId}</span>

                    <span className="text-muted-foreground">{tr('تاريخ الأمر', 'Ordered At')}:</span>
                    <span>{formatDateTime(selectedHold.orderedAt)}</span>
                  </div>
                </div>

                {/* Criteria */}
                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="text-sm font-semibold">{tr('معايير الاحتجاز', 'Hold Criteria')}</h4>
                  {selectedHold.dangerToSelf && (
                    <div className="flex items-start gap-2 rounded bg-red-50 dark:bg-red-900/10 p-3">
                      <UserX className="mt-0.5 h-4 w-4 text-red-600" />
                      <div>
                        <span className="text-sm font-medium text-red-800 dark:text-red-300">{tr('خطر على النفس', 'Danger to Self')}</span>
                        {selectedHold.dangerToSelfEvidence && (
                          <p className="mt-1 text-xs text-red-700 dark:text-red-400">{selectedHold.dangerToSelfEvidence}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {selectedHold.dangerToOthers && (
                    <div className="flex items-start gap-2 rounded bg-orange-50 dark:bg-orange-900/10 p-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-orange-600" />
                      <div>
                        <span className="text-sm font-medium text-orange-800 dark:text-orange-300">{tr('خطر على الآخرين', 'Danger to Others')}</span>
                        {selectedHold.dangerToOthersEvidence && (
                          <p className="mt-1 text-xs text-orange-700 dark:text-orange-400">{selectedHold.dangerToOthersEvidence}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {selectedHold.gravelyDisabled && (
                    <div className="flex items-start gap-2 rounded bg-purple-50 dark:bg-purple-900/10 p-3">
                      <HeartPulse className="mt-0.5 h-4 w-4 text-purple-600" />
                      <div>
                        <span className="text-sm font-medium text-purple-800 dark:text-purple-300">{tr('عجز شديد', 'Gravely Disabled')}</span>
                        {selectedHold.gravelyDisabledEvidence && (
                          <p className="mt-1 text-xs text-purple-700 dark:text-purple-400">{selectedHold.gravelyDisabledEvidence}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {selectedHold.additionalCriteria && (
                    <div className="rounded bg-muted/50 p-3">
                      <span className="text-xs text-muted-foreground">{tr('معايير إضافية', 'Additional Criteria')}:</span>
                      <p className="mt-1 text-sm">{selectedHold.additionalCriteria}</p>
                    </div>
                  )}
                </div>

                {/* Legal Basis */}
                {selectedHold.legalBasis && (
                  <div className="rounded-lg border p-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Scale className="h-4 w-4" />
                      {tr('الأساس القانوني', 'Legal Basis')}
                    </h4>
                    <p className="mt-2 text-sm text-muted-foreground">{selectedHold.legalBasis}</p>
                  </div>
                )}

                {/* Court order details */}
                {(selectedHold.courtOrderRef || selectedHold.courtOrderDate) && (
                  <div className="rounded-lg border p-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Gavel className="h-4 w-4" />
                      {tr('تفاصيل أمر المحكمة', 'Court Order Details')}
                    </h4>
                    <div className="mt-2 text-sm grid grid-cols-2 gap-2">
                      {selectedHold.courtOrderRef && (
                        <>
                          <span className="text-muted-foreground">{tr('الرقم المرجعي', 'Reference')}:</span>
                          <span>{selectedHold.courtOrderRef}</span>
                        </>
                      )}
                      {selectedHold.courtOrderDate && (
                        <>
                          <span className="text-muted-foreground">{tr('التاريخ', 'Date')}:</span>
                          <span>{formatDateTime(selectedHold.courtOrderDate)}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedHold.notes && (
                  <div className="rounded-lg border p-4">
                    <h4 className="text-sm font-semibold">{tr('ملاحظات', 'Notes')}</h4>
                    <p className="mt-2 text-sm text-muted-foreground">{selectedHold.notes}</p>
                  </div>
                )}
              </TabsContent>

              {/* ---- Notifications Tab ---- */}
              <TabsContent value="notifications" className="space-y-4 mt-4">
                {/* Patient Notification */}
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      {tr('إشعار المريض', 'Patient Notification')}
                    </h4>
                    {selectedHold.patientNotified ? (
                      <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        {tr('تم الإشعار', 'Notified')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                        {tr('لم يتم', 'Pending')}
                      </Badge>
                    )}
                  </div>
                  {selectedHold.patientNotifiedAt && (
                    <p className="text-xs text-muted-foreground">{tr('تاريخ الإشعار', 'Notified at')}: {formatDateTime(selectedHold.patientNotifiedAt)}</p>
                  )}
                  {!selectedHold.patientNotified && selectedHold.status === 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={submitting}
                      onClick={() => handleAction('notify_patient')}
                    >
                      <Bell className="mr-1 h-3 w-3" />
                      {tr('إشعار الآن', 'Notify Now')}
                    </Button>
                  )}
                </div>

                {/* Family Notification */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {tr('إشعار العائلة', 'Family Notification')}
                    </h4>
                    {selectedHold.familyNotified ? (
                      <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        {tr('تم الإشعار', 'Notified')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                        {tr('لم يتم', 'Pending')}
                      </Badge>
                    )}
                  </div>
                  {selectedHold.familyNotifiedAt && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>{tr('تاريخ الإشعار', 'Notified at')}: {formatDateTime(selectedHold.familyNotifiedAt)}</p>
                      {selectedHold.familyNotifiedBy && <p>{tr('بواسطة', 'By')}: {selectedHold.familyNotifiedBy}</p>}
                      {selectedHold.familyContactName && <p>{tr('جهة الاتصال', 'Contact')}: {selectedHold.familyContactName}</p>}
                    </div>
                  )}
                  {!selectedHold.familyNotified && selectedHold.status === 'ACTIVE' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">{tr('بواسطة', 'Notified By')}</Label>
                          <Input
                            value={familyForm.notifiedBy}
                            onChange={(e) => setFamilyForm((f) => ({ ...f, notifiedBy: e.target.value }))}
                            placeholder={tr('اسم المبلغ', 'Notifier name')}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">{tr('اسم جهة الاتصال', 'Contact Name')}</Label>
                          <Input
                            value={familyForm.contactName}
                            onChange={(e) => setFamilyForm((f) => ({ ...f, contactName: e.target.value }))}
                            placeholder={tr('اسم أحد أفراد العائلة', 'Family member name')}
                            className="text-sm"
                          />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={submitting}
                        onClick={() => {
                          handleAction('notify_family', {
                            familyNotifiedBy: familyForm.notifiedBy,
                            familyContactName: familyForm.contactName,
                          });
                          setFamilyForm({ notifiedBy: '', contactName: '' });
                        }}
                      >
                        <Phone className="mr-1 h-3 w-3" />
                        {tr('إشعار الآن', 'Notify Now')}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Legal Representative Notification */}
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Scale className="h-4 w-4" />
                      {tr('إشعار الممثل القانوني', 'Legal Rep Notification')}
                    </h4>
                    {selectedHold.legalRepNotified ? (
                      <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        {tr('تم الإشعار', 'Notified')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                        {tr('لم يتم', 'Pending')}
                      </Badge>
                    )}
                  </div>
                  {selectedHold.legalRepNotifiedAt && (
                    <p className="text-xs text-muted-foreground">{tr('تاريخ الإشعار', 'Notified at')}: {formatDateTime(selectedHold.legalRepNotifiedAt)}</p>
                  )}
                  {!selectedHold.legalRepNotified && selectedHold.status === 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={submitting}
                      onClick={() => handleAction('notify_legal')}
                    >
                      <Scale className="mr-1 h-3 w-3" />
                      {tr('إشعار الآن', 'Notify Now')}
                    </Button>
                  )}
                </div>

                {/* Rights Documentation Checklist */}
                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    {tr('توثيق الحقوق', 'Rights Documentation')}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className={`h-4 w-4 ${selectedHold.patientNotified ? 'text-green-600' : 'text-muted-foreground'}`} />
                      <span>{tr('تم إبلاغ المريض بحقوقه', 'Patient informed of their rights')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className={`h-4 w-4 ${selectedHold.familyNotified ? 'text-green-600' : 'text-muted-foreground'}`} />
                      <span>{tr('تم إبلاغ العائلة', 'Family/next of kin notified')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className={`h-4 w-4 ${selectedHold.legalRepNotified ? 'text-green-600' : 'text-muted-foreground'}`} />
                      <span>{tr('تم إبلاغ الممثل القانوني', 'Legal representative notified')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className={`h-4 w-4 ${selectedHold.psychiatricEvalAt ? 'text-green-600' : 'text-muted-foreground'}`} />
                      <span>{tr('تم إجراء التقييم النفسي', 'Psychiatric evaluation completed')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className={`h-4 w-4 ${(selectedHold.reviews?.length ?? 0) > 0 ? 'text-green-600' : 'text-muted-foreground'}`} />
                      <span>{tr('تمت مراجعة دورية واحدة على الأقل', 'At least one periodic review completed')}</span>
                    </div>
                  </div>
                  <div className="mt-3 rounded bg-blue-50 dark:bg-blue-900/10 p-3">
                    <h5 className="text-xs font-semibold text-blue-800 dark:text-blue-300">{tr('معلومات الاستئناف', 'Appeals Information')}</h5>
                    <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
                      {tr(
                        'للمريض الحق في الاستئناف أمام المحكمة المختصة خلال مدة الاحتجاز. يجب توفير محامٍ إذا لزم الأمر.',
                        'The patient has the right to appeal to the appropriate court during the hold period. An attorney must be provided if needed.'
                      )}
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* ---- Evaluation Tab ---- */}
              <TabsContent value="evaluation" className="space-y-4 mt-4">
                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    {tr('التقييم النفسي', 'Psychiatric Evaluation')}
                  </h4>
                  {selectedHold.psychiatricEvalAt ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800 dark:text-green-300">{tr('مكتمل', 'Completed')}</span>
                      </div>
                      <div className="text-sm grid grid-cols-2 gap-2">
                        <span className="text-muted-foreground">{tr('التاريخ', 'Date')}:</span>
                        <span>{formatDateTime(selectedHold.psychiatricEvalAt)}</span>
                        <span className="text-muted-foreground">{tr('المقيّم', 'Evaluator')}:</span>
                        <span>{selectedHold.psychiatricEvalBy || '---'}</span>
                      </div>
                      {selectedHold.evalFindings && (
                        <div className="mt-2 rounded bg-muted/50 p-3">
                          <span className="text-xs font-medium">{tr('النتائج', 'Findings')}:</span>
                          <p className="mt-1 text-sm">{selectedHold.evalFindings}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-amber-600 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        {tr('التقييم النفسي لم يتم بعد', 'Psychiatric evaluation not yet completed')}
                      </p>
                      {selectedHold.status === 'ACTIVE' && (
                        <>
                          <div className="space-y-2">
                            <div>
                              <Label className="text-xs">{tr('اسم المقيّم', 'Evaluator Name')}</Label>
                              <Input
                                value={evalForm.evaluator}
                                onChange={(e) => setEvalForm((f) => ({ ...f, evaluator: e.target.value }))}
                                placeholder={tr('اسم الطبيب النفسي', 'Psychiatrist name')}
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">{tr('النتائج', 'Findings')}</Label>
                              <Textarea
                                value={evalForm.findings}
                                onChange={(e) => setEvalForm((f) => ({ ...f, findings: e.target.value }))}
                                placeholder={tr('نتائج التقييم النفسي...', 'Psychiatric evaluation findings...')}
                                rows={4}
                              />
                            </div>
                          </div>
                          <Button
                            size="sm"
                            disabled={submitting}
                            onClick={() => {
                              handleAction('record_eval', {
                                psychiatricEvalBy: evalForm.evaluator,
                                evalFindings: evalForm.findings,
                              });
                              setEvalForm({ evaluator: '', findings: '' });
                            }}
                          >
                            <Brain className="mr-1 h-3 w-3" />
                            {tr('تسجيل التقييم', 'Record Evaluation')}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ---- Reviews Tab ---- */}
              <TabsContent value="reviews" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    {tr('المراجعات الدورية', 'Periodic Reviews')}
                  </h4>
                  {selectedHold.status === 'ACTIVE' && (
                    <Button size="sm" variant="outline" onClick={() => setShowReviewDialog(true)}>
                      <Plus className="mr-1 h-3 w-3" />
                      {tr('إضافة مراجعة', 'Add Review')}
                    </Button>
                  )}
                </div>

                {(selectedHold.reviews?.length ?? 0) === 0 ? (
                  <div className="rounded-lg border p-8 text-center text-muted-foreground">
                    <ClipboardList className="mx-auto h-8 w-8 mb-2 opacity-40" />
                    <p>{tr('لا توجد مراجعات بعد', 'No reviews yet')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedHold.reviews.map((review, idx) => (
                      <div key={idx} className="rounded-lg border p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {tr('مراجعة', 'Review')} #{idx + 1}
                          </span>
                          <Badge variant="outline" className={review.justificationContinues ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}>
                            {review.justificationContinues
                              ? tr('المبرر مستمر', 'Justification Continues')
                              : tr('المبرر انتهى', 'Justification Ended')}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground grid grid-cols-2 gap-1">
                          <span>{tr('التاريخ', 'Date')}:</span>
                          <span>{formatDateTime(review.reviewDate)}</span>
                          <span>{tr('بواسطة', 'By')}:</span>
                          <span>{review.reviewedBy}</span>
                        </div>
                        {review.notes && (
                          <p className="text-sm text-muted-foreground mt-1">{review.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ---- Resolution Tab ---- */}
              <TabsContent value="resolution" className="space-y-4 mt-4">
                {selectedHold.resolvedAt ? (
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <h4 className="text-sm font-semibold">{tr('تم الحل', 'Resolved')}</h4>
                    </div>
                    <div className="text-sm grid grid-cols-2 gap-2">
                      <span className="text-muted-foreground">{tr('الحالة النهائية', 'Final Status')}:</span>
                      <Badge variant="outline" className={statusBadge(selectedHold.status)}>
                        {statusLabel(selectedHold.status)}
                      </Badge>
                      <span className="text-muted-foreground">{tr('تاريخ الحل', 'Resolved At')}:</span>
                      <span>{formatDateTime(selectedHold.resolvedAt)}</span>
                      <span className="text-muted-foreground">{tr('بواسطة', 'Resolved By')}:</span>
                      <span>{selectedHold.resolvedBy || '---'}</span>
                    </div>
                    {selectedHold.resolutionNotes && (
                      <div className="rounded bg-muted/50 p-3">
                        <span className="text-xs font-medium">{tr('ملاحظات', 'Notes')}:</span>
                        <p className="mt-1 text-sm">{selectedHold.resolutionNotes}</p>
                      </div>
                    )}
                    {selectedHold.conversionToVoluntary && selectedHold.voluntaryConsentAt && (
                      <div className="rounded bg-green-50 dark:bg-green-900/10 p-3">
                        <span className="text-xs font-semibold text-green-800 dark:text-green-300">{tr('تحويل إلى طوعي', 'Converted to Voluntary')}</span>
                        <p className="mt-1 text-xs text-green-700 dark:text-green-400">
                          {tr('تاريخ الموافقة الطوعية', 'Voluntary consent at')}: {formatDateTime(selectedHold.voluntaryConsentAt)}
                        </p>
                      </div>
                    )}
                  </div>
                ) : selectedHold.status === 'ACTIVE' ? (
                  <div className="space-y-4">
                    {/* Convert to Voluntary */}
                    <div className="rounded-lg border p-4 space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        {tr('تحويل إلى إقامة طوعية', 'Convert to Voluntary Admission')}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {tr(
                          'إذا وافق المريض على البقاء طوعيًا، يتم تحويل الاحتجاز القسري إلى إقامة طوعية.',
                          'If the patient agrees to stay voluntarily, the involuntary hold is converted to voluntary admission.'
                        )}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-green-300 text-green-700 hover:bg-green-50"
                        disabled={submitting}
                        onClick={() => setShowConvertDialog(true)}
                      >
                        <CheckCircle className="mr-1 h-3 w-3" />
                        {tr('تحويل إلى طوعي', 'Convert to Voluntary')}
                      </Button>
                    </div>

                    {/* Resolve / Discharge */}
                    <div className="rounded-lg border p-4 space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        {tr('حل / إخراج', 'Resolve / Discharge')}
                      </h4>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs">{tr('الحالة الجديدة', 'New Status')}</Label>
                          <Select value={resolveForm.newStatus} onValueChange={(v) => setResolveForm((f) => ({ ...f, newStatus: v }))}>
                            <SelectTrigger className="text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="DISCHARGED">{tr('إخراج', 'Discharged')}</SelectItem>
                              <SelectItem value="COURT_RELEASED">{tr('إفراج قضائي', 'Court Released')}</SelectItem>
                              <SelectItem value="EXPIRED">{tr('منتهي', 'Expired')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">{tr('ملاحظات الحل', 'Resolution Notes')}</Label>
                          <Textarea
                            value={resolveForm.notes}
                            onChange={(e) => setResolveForm((f) => ({ ...f, notes: e.target.value }))}
                            placeholder={tr('ملاحظات...', 'Notes...')}
                            rows={2}
                          />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={submitting}
                        onClick={() => {
                          handleAction('resolve', {
                            newStatus: resolveForm.newStatus,
                            resolutionNotes: resolveForm.notes,
                          });
                          setResolveForm({ newStatus: 'DISCHARGED', notes: '' });
                        }}
                      >
                        {tr('حل الاحتجاز', 'Resolve Hold')}
                      </Button>
                    </div>

                    {/* Request Extension */}
                    <div className="rounded-lg border p-4 space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-amber-600" />
                        {tr('طلب تمديد', 'Request Extension')}
                      </h4>
                      {selectedHold.extensionRequested ? (
                        <div className="flex items-center gap-2 text-amber-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm">{tr('تم طلب التمديد بالفعل', 'Extension already requested')}</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs">{tr('سبب التمديد', 'Extension Reason')}</Label>
                            <Textarea
                              value={extensionForm.reason}
                              onChange={(e) => setExtensionForm((f) => ({ ...f, reason: e.target.value }))}
                              placeholder={tr('سبب طلب التمديد...', 'Reason for extension...')}
                              rows={2}
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-300 text-amber-700 hover:bg-amber-50"
                            disabled={submitting}
                            onClick={() => {
                              handleAction('request_extension', {
                                extensionReason: extensionForm.reason,
                              });
                              setExtensionForm({ reason: '' });
                            }}
                          >
                            <CalendarClock className="mr-1 h-3 w-3" />
                            {tr('طلب تمديد', 'Request Extension')}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border p-8 text-center text-muted-foreground">
                    <p>{tr('الاحتجاز غير نشط', 'Hold is not active')}</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/*  ADD REVIEW Sub-Dialog                                               */}
      {/* ================================================================== */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-md" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              {tr('إضافة مراجعة دورية', 'Add Periodic Review')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="justContinues"
                checked={reviewForm.justificationContinues}
                onCheckedChange={(c) => setReviewForm((f) => ({ ...f, justificationContinues: Boolean(c) }))}
              />
              <Label htmlFor="justContinues" className="cursor-pointer">
                {tr('المبرر لا يزال قائمًا', 'Justification continues to exist')}
              </Label>
            </div>
            <div>
              <Label>{tr('ملاحظات المراجعة', 'Review Notes')}</Label>
              <Textarea
                value={reviewForm.notes}
                onChange={(e) => setReviewForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={tr('ملاحظات المراجعة...', 'Review notes...')}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button
              disabled={submitting}
              onClick={() => {
                handleAction('add_review', {
                  justificationContinues: reviewForm.justificationContinues,
                  reviewNotes: reviewForm.notes,
                });
                setReviewForm({ justificationContinues: true, notes: '' });
                setShowReviewDialog(false);
              }}
            >
              {tr('حفظ المراجعة', 'Save Review')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/*  CONVERT TO VOLUNTARY Sub-Dialog                                     */}
      {/* ================================================================== */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent className="max-w-md" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              {tr('تأكيد التحويل إلى طوعي', 'Confirm Voluntary Conversion')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {tr(
                'هل أنت متأكد من تحويل هذا الاحتجاز القسري إلى إقامة طوعية؟ يجب أن يكون المريض قد وافق على البقاء طوعيًا.',
                'Are you sure you want to convert this involuntary hold to a voluntary admission? The patient must have agreed to stay voluntarily.'
              )}
            </p>
            <div className="rounded bg-amber-50 dark:bg-amber-900/10 p-3">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {tr(
                  'تحذير: هذا الإجراء لا يمكن التراجع عنه. سيتم تسجيل تاريخ الموافقة الطوعية.',
                  'Warning: This action cannot be undone. The voluntary consent date will be recorded.'
                )}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertDialog(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={submitting}
              onClick={() => {
                handleAction('convert_voluntary');
                setShowConvertDialog(false);
              }}
            >
              {tr('تأكيد التحويل', 'Confirm Conversion')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
