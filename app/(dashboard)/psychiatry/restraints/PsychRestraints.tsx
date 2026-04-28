'use client';

import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import useSWR from 'swr';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  ShieldAlert,
  Clock,
  Activity,
  Syringe,
  DoorClosed,
  Plus,
  Eye,
  Stethoscope,
  MessageSquare,
  Timer,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface MonitoringCheck {
  time: string;
  checkedBy: string;
  circulation?: string;
  skinIntegrity?: string;
  emotionalStatus?: string;
  hydration?: string;
  toileting?: string;
  notes?: string;
}

interface RestraintLog {
  id: string;
  patientMasterId: string;
  interventionType: string;
  restraintType?: string;
  seclusionRoom?: string;
  reason: string;
  behaviorDescription?: string;
  alternativesAttempted?: { alternative: string; result: string }[];
  startedAt: string;
  endedAt?: string;
  totalDurationMin?: number;
  monitoringChecks?: MonitoringCheck[];
  monitoringFreqMin: number;
  physicianAssessedAt?: string;
  physicianAssessedBy?: string;
  physicianNotes?: string;
  debriefCompleted: boolean;
  debriefNotes?: string;
  patientDebriefNotes?: string;
  status: string;
  discontinuedReason?: string;
  orderedByName?: string;
  orderedAt: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function minutesSince(dateStr: string): number {
  return Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

const ALTERNATIVES = [
  { key: 'verbal_deescalation', ar: 'التهدئة اللفظية', en: 'Verbal De-escalation' },
  { key: 'prn_medication', ar: 'دواء عند الحاجة', en: 'PRN Medication Offered' },
  { key: 'environment_change', ar: 'تغيير البيئة', en: 'Environment Change' },
  { key: 'sensory_modulation', ar: 'التعديل الحسي', en: 'Sensory Modulation' },
  { key: 'one_on_one', ar: 'مرافقة فردية', en: '1:1 Observation' },
  { key: 'comfort_measures', ar: 'إجراءات الراحة', en: 'Comfort Measures' },
];

/* ================================================================== */
/*  PsychRestraints — Main Component                                   */
/* ================================================================== */
export default function PsychRestraints() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  // ---------- State ----------
  const [statusTab, setStatusTab] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showMonitorDialog, setShowMonitorDialog] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showPhysicianDialog, setShowPhysicianDialog] = useState(false);
  const [showDebriefDialog, setShowDebriefDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedRestraint, setSelectedRestraint] = useState<RestraintLog | null>(null);

  // New restraint form
  const [newForm, setNewForm] = useState({
    patientMasterId: '',
    interventionType: '',
    restraintType: '',
    seclusionRoom: '',
    reason: '',
    behaviorDescription: '',
    monitoringFreqMin: 15,
    alternativesAttempted: [] as string[],
  });

  // Monitoring form
  const [monitorForm, setMonitorForm] = useState({
    circulation: '',
    skinIntegrity: '',
    emotionalStatus: '',
    hydration: '',
    toileting: '',
    notes: '',
  });

  // End form
  const [endForm, setEndForm] = useState({ discontinuedReason: '', notes: '' });

  // Physician form
  const [physicianForm, setPhysicianForm] = useState({ physicianName: '', notes: '' });

  // Debrief form
  const [debriefForm, setDebriefForm] = useState({ staffNotes: '', patientNotes: '' });

  // ---------- Data ----------
  const params = new URLSearchParams();
  if (statusTab !== 'ALL') params.set('status', statusTab);
  if (typeFilter !== 'ALL') params.set('interventionType', typeFilter);
  const queryString = params.toString() ? `?${params.toString()}` : '';

  const { data, mutate } = useSWR(`/api/psychiatry/restraints${queryString}`, fetcher, { refreshInterval: 15000 });
  const restraints: RestraintLog[] = data?.restraints ?? [];

  const filtered = restraints.filter(
    (r) =>
      !search ||
      r.patientMasterId.toLowerCase().includes(search.toLowerCase()) ||
      r.reason.toLowerCase().includes(search.toLowerCase()) ||
      (r.orderedByName || '').toLowerCase().includes(search.toLowerCase()),
  );

  // ---------- KPIs ----------
  const activeCount = restraints.filter((r) => r.status === 'ACTIVE').length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = restraints.filter((r) => r.startedAt?.slice(0, 10) === todayStr).length;
  const completedToday = restraints.filter((r) => r.status === 'COMPLETED' && r.endedAt?.slice(0, 10) === todayStr);
  const avgDuration =
    completedToday.length > 0
      ? Math.round(completedToday.reduce((s, r) => s + (r.totalDurationMin || 0), 0) / completedToday.length)
      : 0;
  const physicalCount = restraints.filter((r) => r.interventionType === 'PHYSICAL_RESTRAINT').length;
  const chemicalCount = restraints.filter((r) => r.interventionType === 'CHEMICAL_RESTRAINT').length;
  const seclusionCount = restraints.filter((r) => r.interventionType === 'SECLUSION').length;

  // ---------- Helpers ----------
  const interventionBadge = (type: string) => {
    switch (type) {
      case 'PHYSICAL_RESTRAINT':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'CHEMICAL_RESTRAINT':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'SECLUSION':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const interventionLabel = (type: string) => {
    switch (type) {
      case 'PHYSICAL_RESTRAINT': return tr('تقييد جسدي', 'Physical');
      case 'CHEMICAL_RESTRAINT': return tr('تقييد كيميائي', 'Chemical');
      case 'SECLUSION': return tr('عزل', 'Seclusion');
      default: return type;
    }
  };

  const reasonLabel = (reason: string) => {
    switch (reason) {
      case 'DANGER_TO_SELF': return tr('خطر على النفس', 'Danger to Self');
      case 'DANGER_TO_OTHERS': return tr('خطر على الآخرين', 'Danger to Others');
      case 'INTERFERING_WITH_TREATMENT': return tr('تدخل في العلاج', 'Interfering with Treatment');
      case 'ELOPEMENT_RISK': return tr('خطر الهروب', 'Elopement Risk');
      default: return reason;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'CANCELLED':
        return 'bg-muted text-foreground';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE': return tr('نشط', 'Active');
      case 'COMPLETED': return tr('مكتمل', 'Completed');
      case 'CANCELLED': return tr('ملغي', 'Cancelled');
      default: return status;
    }
  };

  const getMonitoringDue = (r: RestraintLog) => {
    if (r.status !== 'ACTIVE') return null;
    const checks = r.monitoringChecks || [];
    const lastCheck = checks.length > 0 ? checks[checks.length - 1].time : r.startedAt;
    const minSinceLast = minutesSince(lastCheck);
    const remaining = r.monitoringFreqMin - minSinceLast;
    return remaining;
  };

  // ---------- Actions ----------
  const handleCreate = async () => {
    try {
      const alternatives = newForm.alternativesAttempted.map((a) => ({
        alternative: a,
        result: 'attempted',
      }));
      const res = await fetch('/api/psychiatry/restraints', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientMasterId: newForm.patientMasterId,
          interventionType: newForm.interventionType,
          restraintType: newForm.interventionType === 'PHYSICAL_RESTRAINT' ? newForm.restraintType : null,
          seclusionRoom: newForm.interventionType === 'SECLUSION' ? newForm.seclusionRoom : null,
          reason: newForm.reason,
          behaviorDescription: newForm.behaviorDescription,
          monitoringFreqMin: newForm.monitoringFreqMin,
          alternativesAttempted: alternatives.length > 0 ? alternatives : null,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم إنشاء سجل التقييد', 'Restraint log created') });
      setShowNewDialog(false);
      setNewForm({ patientMasterId: '', interventionType: '', restraintType: '', seclusionRoom: '', reason: '', behaviorDescription: '', monitoringFreqMin: 15, alternativesAttempted: [] });
      mutate();
    } catch {
      toast({ title: tr('فشل في الإنشاء', 'Failed to create'), variant: 'destructive' });
    }
  };

  const handleMonitorCheck = async () => {
    if (!selectedRestraint) return;
    try {
      const res = await fetch(`/api/psychiatry/restraints/${selectedRestraint.id}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addMonitoringCheck: monitorForm }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم تسجيل فحص المراقبة', 'Monitoring check recorded') });
      setShowMonitorDialog(false);
      setMonitorForm({ circulation: '', skinIntegrity: '', emotionalStatus: '', hydration: '', toileting: '', notes: '' });
      mutate();
    } catch {
      toast({ title: tr('فشل التسجيل', 'Failed to record'), variant: 'destructive' });
    }
  };

  const handleEndRestraint = async () => {
    if (!selectedRestraint) return;
    try {
      const res = await fetch(`/api/psychiatry/restraints/${selectedRestraint.id}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endRestraint: endForm }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم إنهاء التقييد', 'Restraint ended') });
      setShowEndDialog(false);
      setEndForm({ discontinuedReason: '', notes: '' });
      mutate();
    } catch {
      toast({ title: tr('فشل الإنهاء', 'Failed to end'), variant: 'destructive' });
    }
  };

  const handlePhysicianAssessment = async () => {
    if (!selectedRestraint) return;
    try {
      const res = await fetch(`/api/psychiatry/restraints/${selectedRestraint.id}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ physicianAssessment: physicianForm }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم تقييم الطبيب', 'Physician assessment recorded') });
      setShowPhysicianDialog(false);
      setPhysicianForm({ physicianName: '', notes: '' });
      mutate();
    } catch {
      toast({ title: tr('فشل التسجيل', 'Failed to record'), variant: 'destructive' });
    }
  };

  const handleDebrief = async () => {
    if (!selectedRestraint) return;
    try {
      const res = await fetch(`/api/psychiatry/restraints/${selectedRestraint.id}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debrief: debriefForm }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم تسجيل الجلسة', 'Debrief recorded') });
      setShowDebriefDialog(false);
      setDebriefForm({ staffNotes: '', patientNotes: '' });
      mutate();
    } catch {
      toast({ title: tr('فشل التسجيل', 'Failed to record'), variant: 'destructive' });
    }
  };

  const toggleAlternative = (key: string) => {
    setNewForm((f) => ({
      ...f,
      alternativesAttempted: f.alternativesAttempted.includes(key)
        ? f.alternativesAttempted.filter((a) => a !== key)
        : [...f.alternativesAttempted, key],
    }));
  };

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div className="p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          {tr('سجل التقييد والعزل', 'Restraint / Seclusion Log')}
        </h1>
        <Button onClick={() => setShowNewDialog(true)} size="sm">
          <Plus className="h-4 w-4 me-1" />
          {tr('أمر تقييد جديد', 'New Restraint Order')}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
              {tr('نشط', 'Active')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {activeCount}
              {activeCount > 0 && <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse ms-2" />}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {tr('اليوم', 'Today')}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{todayCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Timer className="h-3.5 w-3.5" />
              {tr('متوسط المدة', 'Avg Duration')}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{avgDuration > 0 ? formatDuration(avgDuration) : '—'}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Activity className="h-3.5 w-3.5 text-orange-500" />
              {tr('جسدي', 'Physical')}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-orange-600">{physicalCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Syringe className="h-3.5 w-3.5 text-purple-500" />
              {tr('كيميائي', 'Chemical')}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-purple-600">{chemicalCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <DoorClosed className="h-3.5 w-3.5 text-blue-500" />
              {tr('عزل', 'Seclusion')}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-blue-600">{seclusionCount}</p></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Tabs value={statusTab} onValueChange={setStatusTab}>
          <TabsList>
            <TabsTrigger value="ALL">{tr('الكل', 'All')}</TabsTrigger>
            <TabsTrigger value="ACTIVE">{tr('نشط', 'Active')}</TabsTrigger>
            <TabsTrigger value="COMPLETED">{tr('مكتمل', 'Completed')}</TabsTrigger>
            <TabsTrigger value="CANCELLED">{tr('ملغي', 'Cancelled')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={tr('نوع التدخل', 'Intervention Type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('جميع الأنواع', 'All Types')}</SelectItem>
            <SelectItem value="PHYSICAL_RESTRAINT">{tr('تقييد جسدي', 'Physical Restraint')}</SelectItem>
            <SelectItem value="CHEMICAL_RESTRAINT">{tr('تقييد كيميائي', 'Chemical Restraint')}</SelectItem>
            <SelectItem value="SECLUSION">{tr('عزل', 'Seclusion')}</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder={tr('بحث...', 'Search...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-start font-medium">{tr('المريض', 'Patient')}</th>
              <th className="p-3 text-start font-medium">{tr('النوع', 'Type')}</th>
              <th className="p-3 text-start font-medium">{tr('نوع التقييد', 'Restraint Type')}</th>
              <th className="p-3 text-start font-medium">{tr('السبب', 'Reason')}</th>
              <th className="p-3 text-start font-medium">{tr('البداية', 'Started')}</th>
              <th className="p-3 text-start font-medium">{tr('المدة', 'Duration')}</th>
              <th className="p-3 text-start font-medium">{tr('مراقبة', 'Monitor Due')}</th>
              <th className="p-3 text-start font-medium">{tr('طبيب', 'Physician')}</th>
              <th className="p-3 text-start font-medium">{tr('جلسة', 'Debrief')}</th>
              <th className="p-3 text-start font-medium">{tr('الحالة', 'Status')}</th>
              <th className="p-3 text-start font-medium">{tr('إجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-muted-foreground">
                  {tr('لا توجد سجلات تقييد', 'No restraint logs found')}
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const dur = r.endedAt
                  ? r.totalDurationMin ?? minutesSince(r.startedAt)
                  : minutesSince(r.startedAt);
                const monDue = getMonitoringDue(r);
                const isOverdue = monDue !== null && monDue <= 0;
                const rowBg =
                  r.status === 'ACTIVE'
                    ? isOverdue
                      ? 'bg-red-50 dark:bg-red-950/20'
                      : 'bg-yellow-50 dark:bg-yellow-950/20'
                    : '';

                return (
                  <tr key={r.id} className={`border-t hover:bg-muted/30 ${rowBg}`}>
                    <td className="p-3 font-mono text-xs">{r.patientMasterId.slice(0, 8)}...</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${interventionBadge(r.interventionType)}`}>
                        {interventionLabel(r.interventionType)}
                      </span>
                    </td>
                    <td className="p-3 text-xs">{r.restraintType?.replace(/_/g, ' ') || '—'}</td>
                    <td className="p-3 text-xs">{reasonLabel(r.reason)}</td>
                    <td className="p-3 text-xs">{new Date(r.startedAt).toLocaleString()}</td>
                    <td className="p-3 text-xs font-medium">{formatDuration(dur)}</td>
                    <td className="p-3">
                      {monDue !== null ? (
                        <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>
                          {isOverdue ? tr('متأخر!', 'OVERDUE!') : `${monDue}m`}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3">
                      {r.physicianAssessedAt ? (
                        <Badge variant="outline" className="text-green-700 border-green-300 text-xs">{tr('نعم', 'Yes')}</Badge>
                      ) : r.status === 'ACTIVE' ? (
                        <Badge variant="outline" className="text-red-700 border-red-300 text-xs">{tr('معلق', 'Pending')}</Badge>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3">
                      {r.debriefCompleted ? (
                        <Badge variant="outline" className="text-green-700 border-green-300 text-xs">{tr('نعم', 'Yes')}</Badge>
                      ) : r.status === 'COMPLETED' ? (
                        <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">{tr('معلق', 'Pending')}</Badge>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(r.status)}`}>
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title={tr('عرض التفاصيل', 'View Details')}
                          onClick={() => { setSelectedRestraint(r); setShowDetailDialog(true); }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {r.status === 'ACTIVE' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title={tr('فحص مراقبة', 'Monitoring Check')}
                              onClick={() => { setSelectedRestraint(r); setShowMonitorDialog(true); }}
                            >
                              <Activity className="h-3.5 w-3.5 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title={tr('تقييم الطبيب', 'Physician Assessment')}
                              onClick={() => { setSelectedRestraint(r); setShowPhysicianDialog(true); }}
                            >
                              <Stethoscope className="h-3.5 w-3.5 text-purple-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-600"
                              title={tr('إنهاء التقييد', 'End Restraint')}
                              onClick={() => { setSelectedRestraint(r); setShowEndDialog(true); }}
                            >
                              <Clock className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {(r.status === 'COMPLETED' && !r.debriefCompleted) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title={tr('جلسة ختامية', 'Debrief')}
                            onClick={() => { setSelectedRestraint(r); setShowDebriefDialog(true); }}
                          >
                            <MessageSquare className="h-3.5 w-3.5 text-amber-600" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ============================================================ */}
      {/* New Restraint Order Dialog                                     */}
      {/* ============================================================ */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{tr('أمر تقييد جديد', 'New Restraint Order')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{tr('معرف المريض', 'Patient ID')}</Label>
              <Input value={newForm.patientMasterId} onChange={(e) => setNewForm((f) => ({ ...f, patientMasterId: e.target.value }))} placeholder={tr('أدخل معرف المريض', 'Enter patient ID')} />
            </div>
            <div>
              <Label>{tr('نوع التدخل', 'Intervention Type')}</Label>
              <Select value={newForm.interventionType} onValueChange={(v) => setNewForm((f) => ({ ...f, interventionType: v }))}>
                <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PHYSICAL_RESTRAINT">{tr('تقييد جسدي', 'Physical Restraint')}</SelectItem>
                  <SelectItem value="CHEMICAL_RESTRAINT">{tr('تقييد كيميائي', 'Chemical Restraint')}</SelectItem>
                  <SelectItem value="SECLUSION">{tr('عزل', 'Seclusion')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newForm.interventionType === 'PHYSICAL_RESTRAINT' && (
              <div>
                <Label>{tr('نوع التقييد', 'Restraint Type')}</Label>
                <Select value={newForm.restraintType} onValueChange={(v) => setNewForm((f) => ({ ...f, restraintType: v }))}>
                  <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WRIST">{tr('معصم', 'Wrist')}</SelectItem>
                    <SelectItem value="ANKLE">{tr('كاحل', 'Ankle')}</SelectItem>
                    <SelectItem value="VEST">{tr('سترة', 'Vest')}</SelectItem>
                    <SelectItem value="MITT">{tr('قفاز', 'Mitt')}</SelectItem>
                    <SelectItem value="FOUR_POINT">{tr('أربع نقاط', 'Four Point')}</SelectItem>
                    <SelectItem value="BED_RAIL">{tr('حاجز السرير', 'Bed Rail')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {newForm.interventionType === 'SECLUSION' && (
              <div>
                <Label>{tr('غرفة العزل', 'Seclusion Room')}</Label>
                <Input value={newForm.seclusionRoom} onChange={(e) => setNewForm((f) => ({ ...f, seclusionRoom: e.target.value }))} placeholder={tr('رقم الغرفة', 'Room number')} />
              </div>
            )}
            <div>
              <Label>{tr('السبب', 'Reason')}</Label>
              <Select value={newForm.reason} onValueChange={(v) => setNewForm((f) => ({ ...f, reason: v }))}>
                <SelectTrigger><SelectValue placeholder={tr('اختر السبب', 'Select reason')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DANGER_TO_SELF">{tr('خطر على النفس', 'Danger to Self')}</SelectItem>
                  <SelectItem value="DANGER_TO_OTHERS">{tr('خطر على الآخرين', 'Danger to Others')}</SelectItem>
                  <SelectItem value="INTERFERING_WITH_TREATMENT">{tr('تدخل في العلاج', 'Interfering with Treatment')}</SelectItem>
                  <SelectItem value="ELOPEMENT_RISK">{tr('خطر الهروب', 'Elopement Risk')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tr('وصف السلوك', 'Behavior Description')}</Label>
              <Textarea value={newForm.behaviorDescription} onChange={(e) => setNewForm((f) => ({ ...f, behaviorDescription: e.target.value }))} placeholder={tr('صف السلوك الذي أدى لهذا القرار', 'Describe the behavior leading to this decision')} />
            </div>
            <div>
              <Label>{tr('البدائل المحاولة', 'Alternatives Attempted')}</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {ALTERNATIVES.map((alt) => (
                  <label key={alt.key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={newForm.alternativesAttempted.includes(alt.key)}
                      onCheckedChange={() => toggleAlternative(alt.key)}
                    />
                    {tr(alt.ar, alt.en)}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>{tr('تكرار المراقبة (دقائق)', 'Monitoring Frequency (min)')}</Label>
              <Select value={String(newForm.monitoringFreqMin)} onValueChange={(v) => setNewForm((f) => ({ ...f, monitoringFreqMin: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 {tr('دقائق', 'min')}</SelectItem>
                  <SelectItem value="10">10 {tr('دقائق', 'min')}</SelectItem>
                  <SelectItem value="15">15 {tr('دقائق', 'min')}</SelectItem>
                  <SelectItem value="30">30 {tr('دقائق', 'min')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>{tr('إلغاء', 'Cancel')}</Button>
            <Button onClick={handleCreate} disabled={!newForm.patientMasterId || !newForm.interventionType || !newForm.reason}>
              {tr('إنشاء', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Monitoring Check Dialog                                       */}
      {/* ============================================================ */}
      <Dialog open={showMonitorDialog} onOpenChange={setShowMonitorDialog}>
        <DialogContent className="max-w-md" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{tr('فحص المراقبة', 'Monitoring Check')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{tr('الدورة الدموية', 'Circulation')}</Label>
              <Select value={monitorForm.circulation} onValueChange={(v) => setMonitorForm((f) => ({ ...f, circulation: v }))}>
                <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NORMAL">{tr('طبيعي', 'Normal')}</SelectItem>
                  <SelectItem value="IMPAIRED">{tr('ضعيف', 'Impaired')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tr('سلامة الجلد', 'Skin Integrity')}</Label>
              <Select value={monitorForm.skinIntegrity} onValueChange={(v) => setMonitorForm((f) => ({ ...f, skinIntegrity: v }))}>
                <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INTACT">{tr('سليم', 'Intact')}</SelectItem>
                  <SelectItem value="REDNESS">{tr('احمرار', 'Redness')}</SelectItem>
                  <SelectItem value="BREAKDOWN">{tr('تلف', 'Breakdown')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tr('الحالة العاطفية', 'Emotional Status')}</Label>
              <Select value={monitorForm.emotionalStatus} onValueChange={(v) => setMonitorForm((f) => ({ ...f, emotionalStatus: v }))}>
                <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CALM">{tr('هادئ', 'Calm')}</SelectItem>
                  <SelectItem value="AGITATED">{tr('مضطرب', 'Agitated')}</SelectItem>
                  <SelectItem value="CRYING">{tr('يبكي', 'Crying')}</SelectItem>
                  <SelectItem value="SLEEPING">{tr('نائم', 'Sleeping')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tr('الترطيب', 'Hydration')}</Label>
              <Select value={monitorForm.hydration} onValueChange={(v) => setMonitorForm((f) => ({ ...f, hydration: v }))}>
                <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADEQUATE">{tr('كافي', 'Adequate')}</SelectItem>
                  <SelectItem value="OFFERED">{tr('عُرض', 'Offered')}</SelectItem>
                  <SelectItem value="REFUSED">{tr('رُفض', 'Refused')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tr('دورة المياه', 'Toileting')}</Label>
              <Select value={monitorForm.toileting} onValueChange={(v) => setMonitorForm((f) => ({ ...f, toileting: v }))}>
                <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OFFERED">{tr('عُرض', 'Offered')}</SelectItem>
                  <SelectItem value="USED">{tr('مستخدم', 'Used')}</SelectItem>
                  <SelectItem value="REFUSED">{tr('رُفض', 'Refused')}</SelectItem>
                  <SelectItem value="NA">{tr('غير قابل للتطبيق', 'N/A')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tr('ملاحظات', 'Notes')}</Label>
              <Textarea value={monitorForm.notes} onChange={(e) => setMonitorForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMonitorDialog(false)}>{tr('إلغاء', 'Cancel')}</Button>
            <Button onClick={handleMonitorCheck}>{tr('تسجيل', 'Record')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* End Restraint Dialog                                          */}
      {/* ============================================================ */}
      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent className="max-w-md" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{tr('إنهاء التقييد', 'End Restraint')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{tr('سبب الإيقاف', 'Discontinued Reason')}</Label>
              <Select value={endForm.discontinuedReason} onValueChange={(v) => setEndForm((f) => ({ ...f, discontinuedReason: v }))}>
                <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BEHAVIOR_IMPROVED">{tr('تحسن السلوك', 'Behavior Improved')}</SelectItem>
                  <SelectItem value="ORDER_EXPIRED">{tr('انتهى الأمر', 'Order Expired')}</SelectItem>
                  <SelectItem value="PHYSICIAN_ORDER">{tr('أمر الطبيب', 'Physician Order')}</SelectItem>
                  <SelectItem value="PATIENT_REQUEST">{tr('طلب المريض', 'Patient Request')}</SelectItem>
                  <SelectItem value="OTHER">{tr('أخرى', 'Other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tr('ملاحظات', 'Notes')}</Label>
              <Textarea value={endForm.notes} onChange={(e) => setEndForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEndDialog(false)}>{tr('إلغاء', 'Cancel')}</Button>
            <Button variant="destructive" onClick={handleEndRestraint}>{tr('إنهاء التقييد', 'End Restraint')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Physician Face-to-Face Dialog                                 */}
      {/* ============================================================ */}
      <Dialog open={showPhysicianDialog} onOpenChange={setShowPhysicianDialog}>
        <DialogContent className="max-w-md" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{tr('تقييم الطبيب وجهاً لوجه', 'Physician Face-to-Face Assessment')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{tr('اسم الطبيب', 'Physician Name')}</Label>
              <Input value={physicianForm.physicianName} onChange={(e) => setPhysicianForm((f) => ({ ...f, physicianName: e.target.value }))} />
            </div>
            <div>
              <Label>{tr('ملاحظات التقييم', 'Assessment Notes')}</Label>
              <Textarea value={physicianForm.notes} onChange={(e) => setPhysicianForm((f) => ({ ...f, notes: e.target.value }))} placeholder={tr('ملاحظات التقييم الطبي', 'Clinical assessment notes')} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPhysicianDialog(false)}>{tr('إلغاء', 'Cancel')}</Button>
            <Button onClick={handlePhysicianAssessment}>{tr('تسجيل', 'Record')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Debrief Dialog                                                */}
      {/* ============================================================ */}
      <Dialog open={showDebriefDialog} onOpenChange={setShowDebriefDialog}>
        <DialogContent className="max-w-md" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{tr('الجلسة الختامية', 'Debrief Session')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{tr('ملاحظات الفريق', 'Staff Debrief Notes')}</Label>
              <Textarea value={debriefForm.staffNotes} onChange={(e) => setDebriefForm((f) => ({ ...f, staffNotes: e.target.value }))} placeholder={tr('ملاحظات الفريق حول الحادثة', 'Staff notes about the incident')} rows={3} />
            </div>
            <div>
              <Label>{tr('ملاحظات المريض', 'Patient Debrief Notes')}</Label>
              <Textarea value={debriefForm.patientNotes} onChange={(e) => setDebriefForm((f) => ({ ...f, patientNotes: e.target.value }))} placeholder={tr('ملاحظات المريض ومشاعره', 'Patient notes and feelings')} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDebriefDialog(false)}>{tr('إلغاء', 'Cancel')}</Button>
            <Button onClick={handleDebrief}>{tr('تسجيل', 'Record')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Detail / Timeline Dialog                                      */}
      {/* ============================================================ */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{tr('تفاصيل التقييد', 'Restraint Details')}</DialogTitle>
          </DialogHeader>
          {selectedRestraint && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">{tr('المريض', 'Patient')}:</span> <span className="font-mono">{selectedRestraint.patientMasterId.slice(0, 12)}</span></div>
                <div><span className="text-muted-foreground">{tr('النوع', 'Type')}:</span> {interventionLabel(selectedRestraint.interventionType)}</div>
                <div><span className="text-muted-foreground">{tr('السبب', 'Reason')}:</span> {reasonLabel(selectedRestraint.reason)}</div>
                <div><span className="text-muted-foreground">{tr('الحالة', 'Status')}:</span> {statusLabel(selectedRestraint.status)}</div>
                <div><span className="text-muted-foreground">{tr('أمر بواسطة', 'Ordered By')}:</span> {selectedRestraint.orderedByName || '—'}</div>
                <div><span className="text-muted-foreground">{tr('البداية', 'Started')}:</span> {new Date(selectedRestraint.startedAt).toLocaleString()}</div>
                {selectedRestraint.endedAt && (
                  <div><span className="text-muted-foreground">{tr('النهاية', 'Ended')}:</span> {new Date(selectedRestraint.endedAt).toLocaleString()}</div>
                )}
                {selectedRestraint.totalDurationMin != null && (
                  <div><span className="text-muted-foreground">{tr('المدة', 'Duration')}:</span> {formatDuration(selectedRestraint.totalDurationMin)}</div>
                )}
              </div>

              {selectedRestraint.behaviorDescription && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">{tr('وصف السلوك', 'Behavior Description')}</h4>
                  <p className="text-sm text-muted-foreground">{selectedRestraint.behaviorDescription}</p>
                </div>
              )}

              {/* Physician Assessment */}
              {selectedRestraint.physicianAssessedAt && (
                <div className="border rounded-lg p-3">
                  <h4 className="text-sm font-semibold mb-1 flex items-center gap-1">
                    <Stethoscope className="h-4 w-4" />
                    {tr('تقييم الطبيب', 'Physician Assessment')}
                  </h4>
                  <p className="text-xs text-muted-foreground">{tr('بواسطة', 'By')}: {selectedRestraint.physicianAssessedBy} — {new Date(selectedRestraint.physicianAssessedAt).toLocaleString()}</p>
                  {selectedRestraint.physicianNotes && <p className="text-sm mt-1">{selectedRestraint.physicianNotes}</p>}
                </div>
              )}

              {/* Debrief */}
              {selectedRestraint.debriefCompleted && (
                <div className="border rounded-lg p-3">
                  <h4 className="text-sm font-semibold mb-1 flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    {tr('الجلسة الختامية', 'Debrief')}
                  </h4>
                  {selectedRestraint.debriefNotes && (
                    <div className="mt-1">
                      <span className="text-xs text-muted-foreground">{tr('ملاحظات الفريق', 'Staff')}:</span>
                      <p className="text-sm">{selectedRestraint.debriefNotes}</p>
                    </div>
                  )}
                  {selectedRestraint.patientDebriefNotes && (
                    <div className="mt-1">
                      <span className="text-xs text-muted-foreground">{tr('ملاحظات المريض', 'Patient')}:</span>
                      <p className="text-sm">{selectedRestraint.patientDebriefNotes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Monitoring Timeline */}
              <div>
                <h4 className="text-sm font-semibold mb-2">{tr('خط زمني للمراقبة', 'Monitoring Timeline')}</h4>
                {(!selectedRestraint.monitoringChecks || selectedRestraint.monitoringChecks.length === 0) ? (
                  <p className="text-sm text-muted-foreground">{tr('لا توجد فحوصات مراقبة بعد', 'No monitoring checks recorded yet')}</p>
                ) : (
                  <div className="space-y-2">
                    {(selectedRestraint.monitoringChecks as MonitoringCheck[]).map((check, i) => (
                      <div key={i} className="border rounded-lg p-2 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{tr('فحص', 'Check')} #{i + 1}</span>
                          <span className="text-muted-foreground">{new Date(check.time).toLocaleTimeString()}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-muted-foreground">
                          {check.circulation && <span>{tr('دورة دموية', 'Circ')}: {check.circulation}</span>}
                          {check.skinIntegrity && <span>{tr('جلد', 'Skin')}: {check.skinIntegrity}</span>}
                          {check.emotionalStatus && <span>{tr('عاطفي', 'Emotional')}: {check.emotionalStatus}</span>}
                          {check.hydration && <span>{tr('ترطيب', 'Hydration')}: {check.hydration}</span>}
                          {check.toileting && <span>{tr('مرحاض', 'Toileting')}: {check.toileting}</span>}
                        </div>
                        {check.notes && <p className="mt-1">{check.notes}</p>}
                        <p className="text-muted-foreground mt-0.5">{tr('بواسطة', 'By')}: {check.checkedBy}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>{tr('إغلاق', 'Close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
