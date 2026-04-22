'use client';

import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import useSWR from 'swr';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  FileText,
  Plus,
  Pen,
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  Trash2,
  X,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface GoalProgressItem {
  goalId: string;
  goalDescription: string;
  progressRating: number;
  progressNotes: string;
}

interface MedicationResponseItem {
  drug: string;
  effectiveness: 'EFFECTIVE' | 'PARTIAL' | 'INEFFECTIVE' | '';
  sideEffects: string;
  adherence: 'GOOD' | 'PARTIAL' | 'NON_ADHERENT' | '';
}

interface RiskReassessment {
  suicideRisk: string;
  violenceRisk: string;
  changes: string;
}

interface BriefMse {
  mood: string;
  affect: string;
  thoughtProcess: string;
  insight: string;
  judgment: string;
}

interface TreatmentPlan {
  id: string;
  patientMasterId: string;
  dsm5Diagnosis?: string;
  status: string;
  goals?: {
    id: string;
    description: string;
    status: string;
  }[];
}

interface ProgressNote {
  id: string;
  patientMasterId: string;
  treatmentPlanId?: string;
  authorUserId: string;
  authorName?: string;
  noteDate: string;
  noteType: string;
  dataSection?: string;
  assessmentSection?: string;
  planSection?: string;
  goalProgress?: GoalProgressItem[];
  medicationResponse?: MedicationResponseItem[];
  riskReassessment?: RiskReassessment;
  briefMse?: BriefMse;
  groupSessionId?: string;
  sessionDurationMin?: number;
  nextSessionDate?: string;
  status: string;
  signedAt?: string;
  signedBy?: string;
  cosignedBy?: string;
  cosignedAt?: string;
  amendmentNotes?: string;
  notes?: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const NOTE_TYPES = ['INDIVIDUAL', 'GROUP', 'FAMILY', 'CRISIS', 'DISCHARGE'] as const;
const STATUSES = ['DRAFT', 'SIGNED', 'AMENDED', 'COSIGNED'] as const;
const RISK_LEVELS = ['LOW', 'MODERATE', 'HIGH', 'IMMINENT'] as const;
const VIOLENCE_RISK_LEVELS = ['LOW', 'MODERATE', 'HIGH'] as const;
const EFFECTIVENESS_OPTIONS = ['EFFECTIVE', 'PARTIAL', 'INEFFECTIVE'] as const;
const ADHERENCE_OPTIONS = ['GOOD', 'PARTIAL', 'NON_ADHERENT'] as const;
const AFFECT_OPTIONS = ['EUTHYMIC', 'DYSPHORIC', 'ANXIOUS', 'IRRITABLE', 'EUPHORIC', 'FLAT', 'BLUNTED', 'LABILE', 'CONSTRICTED'] as const;
const THOUGHT_PROCESS_OPTIONS = ['LINEAR', 'CIRCUMSTANTIAL', 'TANGENTIAL', 'LOOSE_ASSOCIATIONS', 'FLIGHT_OF_IDEAS', 'THOUGHT_BLOCKING', 'PERSEVERATION'] as const;
const INSIGHT_OPTIONS = ['GOOD', 'FAIR', 'POOR', 'ABSENT'] as const;
const JUDGMENT_OPTIONS = ['GOOD', 'FAIR', 'POOR', 'IMPAIRED'] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function truncate(str: string | undefined | null, max: number): string {
  if (!str) return '\u2014';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

function formatDate(d: string | undefined | null): string {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ================================================================== */
/*  PsychProgressNotes -- Main Component                               */
/* ================================================================== */
export default function PsychProgressNotes() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  // ---------- State ----------
  const [search, setSearch] = useState('');
  const [filterNoteType, setFilterNoteType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedNote, setSelectedNote] = useState<ProgressNote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [amendmentText, setAmendmentText] = useState('');
  const [showAmendDialog, setShowAmendDialog] = useState(false);

  // ---------- Create form state ----------
  const emptyMedResponse: MedicationResponseItem = { drug: '', effectiveness: '', sideEffects: '', adherence: '' };
  const [form, setForm] = useState({
    patientMasterId: '',
    noteType: 'INDIVIDUAL' as string,
    treatmentPlanId: '',
    dataSection: '',
    assessmentSection: '',
    planSection: '',
    sessionDurationMin: '',
    nextSessionDate: '',
    notes: '',
    // Brief MSE
    mood: '',
    affect: '',
    thoughtProcess: '',
    insight: '',
    judgment: '',
    // Risk reassessment
    suicideRisk: '',
    violenceRisk: '',
    riskChanges: '',
  });
  const [goalProgress, setGoalProgress] = useState<GoalProgressItem[]>([]);
  const [medResponses, setMedResponses] = useState<MedicationResponseItem[]>([]);

  // ---------- Data fetching ----------
  const { data, mutate } = useSWR('/api/psychiatry/progress-notes', fetcher, { refreshInterval: 15000 });
  const allNotes: ProgressNote[] = data?.notes ?? [];

  // Fetch treatment plans for the dropdown
  const { data: tpData } = useSWR('/api/psychiatry/treatment-plan?status=ACTIVE', fetcher);
  const treatmentPlans: TreatmentPlan[] = tpData?.plans ?? [];

  // ---------- Filtering ----------
  const filtered = allNotes.filter((n) => {
    if (filterNoteType !== 'ALL' && n.noteType !== filterNoteType) return false;
    if (filterStatus !== 'ALL' && n.status !== filterStatus) return false;
    if (
      search &&
      !n.patientMasterId.toLowerCase().includes(search.toLowerCase()) &&
      !(n.authorName || '').toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  // ---------- KPIs ----------
  const todayStr = new Date().toISOString().slice(0, 10);
  const totalNotes = allNotes.length;
  const draftCount = allNotes.filter((n) => n.status === 'DRAFT').length;
  const signedToday = allNotes.filter(
    (n) => n.signedAt && n.signedAt.slice(0, 10) === todayStr,
  ).length;
  const crisisCount = allNotes.filter((n) => n.noteType === 'CRISIS').length;

  // ---------- Get risk level from note ----------
  const getRiskLevel = (n: ProgressNote): string => {
    if (!n.riskReassessment) return '\u2014';
    const r = n.riskReassessment as RiskReassessment;
    if (r.suicideRisk === 'IMMINENT' || r.suicideRisk === 'HIGH') return r.suicideRisk;
    if (r.violenceRisk === 'HIGH') return r.violenceRisk;
    return r.suicideRisk || r.violenceRisk || '\u2014';
  };

  const getRiskBadgeVariant = (level: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (level === 'HIGH' || level === 'IMMINENT') return 'destructive';
    if (level === 'MODERATE') return 'secondary';
    return 'outline';
  };

  const getStatusBadgeVariant = (s: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (s === 'SIGNED' || s === 'COSIGNED') return 'default';
    if (s === 'DRAFT') return 'secondary';
    if (s === 'AMENDED') return 'outline';
    return 'outline';
  };

  const noteTypeLabel = (t: string): string => {
    const map: Record<string, [string, string]> = {
      INDIVIDUAL: ['\u0641\u0631\u062F\u064A', 'Individual'],
      GROUP: ['\u062C\u0645\u0627\u0639\u064A', 'Group'],
      FAMILY: ['\u0639\u0627\u0626\u0644\u064A', 'Family'],
      CRISIS: ['\u0623\u0632\u0645\u0629', 'Crisis'],
      DISCHARGE: ['\u062E\u0631\u0648\u062C', 'Discharge'],
    };
    const pair = map[t];
    return pair ? tr(pair[0], pair[1]) : t;
  };

  const statusLabel = (s: string): string => {
    const map: Record<string, [string, string]> = {
      DRAFT: ['\u0645\u0633\u0648\u062F\u0629', 'Draft'],
      SIGNED: ['\u0645\u0648\u0642\u0651\u0639', 'Signed'],
      AMENDED: ['\u0645\u0639\u062F\u0651\u0644', 'Amended'],
      COSIGNED: ['\u0645\u0648\u0642\u0651\u0639 \u0645\u0634\u062A\u0631\u0643', 'Co-signed'],
    };
    const pair = map[s];
    return pair ? tr(pair[0], pair[1]) : s;
  };

  // ---------- When treatment plan changes, load its goals ----------
  const handleTreatmentPlanChange = (planId: string) => {
    setForm((f) => ({ ...f, treatmentPlanId: planId }));
    if (planId) {
      const plan = treatmentPlans.find((p) => p.id === planId);
      if (plan?.goals && Array.isArray(plan.goals)) {
        setGoalProgress(
          plan.goals.map((g) => ({
            goalId: g.id,
            goalDescription: g.description,
            progressRating: 3,
            progressNotes: '',
          })),
        );
      } else {
        setGoalProgress([]);
      }
    } else {
      setGoalProgress([]);
    }
  };

  // ---------- Med response helpers ----------
  const addMedResponse = () => {
    setMedResponses((prev) => [...prev, { ...emptyMedResponse }]);
  };

  const removeMedResponse = (idx: number) => {
    setMedResponses((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateMedResponse = (idx: number, field: keyof MedicationResponseItem, value: string) => {
    setMedResponses((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)),
    );
  };

  // ---------- Reset form ----------
  const resetForm = () => {
    setForm({
      patientMasterId: '',
      noteType: 'INDIVIDUAL',
      treatmentPlanId: '',
      dataSection: '',
      assessmentSection: '',
      planSection: '',
      sessionDurationMin: '',
      nextSessionDate: '',
      notes: '',
      mood: '',
      affect: '',
      thoughtProcess: '',
      insight: '',
      judgment: '',
      suicideRisk: '',
      violenceRisk: '',
      riskChanges: '',
    });
    setGoalProgress([]);
    setMedResponses([]);
  };

  // ---------- Create handler ----------
  const handleCreate = async () => {
    if (!form.patientMasterId.trim()) {
      toast({ title: tr('\u062D\u0642\u0644 \u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u0631\u064A\u0636 \u0645\u0637\u0644\u0648\u0628', 'Patient ID is required'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        patientMasterId: form.patientMasterId.trim(),
        noteType: form.noteType,
        treatmentPlanId: form.treatmentPlanId || null,
        dataSection: form.dataSection || null,
        assessmentSection: form.assessmentSection || null,
        planSection: form.planSection || null,
        sessionDurationMin: form.sessionDurationMin ? parseInt(form.sessionDurationMin, 10) : null,
        nextSessionDate: form.nextSessionDate || null,
        notes: form.notes || null,
      };

      // Goal progress (only if any exist)
      if (goalProgress.length > 0) {
        payload.goalProgress = goalProgress;
      }

      // Medication response (only if any have drug names)
      const validMeds = medResponses.filter((m) => m.drug.trim());
      if (validMeds.length > 0) {
        payload.medicationResponse = validMeds;
      }

      // Risk reassessment (only if any field is set)
      if (form.suicideRisk || form.violenceRisk || form.riskChanges) {
        payload.riskReassessment = {
          suicideRisk: form.suicideRisk || null,
          violenceRisk: form.violenceRisk || null,
          changes: form.riskChanges || null,
        };
      }

      // Brief MSE (only if any field is set)
      if (form.mood || form.affect || form.thoughtProcess || form.insight || form.judgment) {
        payload.briefMse = {
          mood: form.mood || null,
          affect: form.affect || null,
          thoughtProcess: form.thoughtProcess || null,
          insight: form.insight || null,
          judgment: form.judgment || null,
        };
      }

      const res = await fetch('/api/psychiatry/progress-notes', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create note');
      }

      toast({ title: tr('\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0629', 'Progress note created') });
      setShowNewDialog(false);
      resetForm();
      mutate();
    } catch (err: any) {
      toast({ title: err.message || tr('\u062E\u0637\u0623', 'Error'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Sign handler ----------
  const handleSign = async (noteId: string) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/psychiatry/progress-notes', {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: noteId, action: 'sign' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to sign note');
      }
      toast({ title: tr('\u062A\u0645 \u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0629', 'Note signed successfully') });
      mutate();
      // Update local state if viewing this note
      const updated = await res.json();
      if (selectedNote?.id === noteId) setSelectedNote(updated.note);
    } catch (err: any) {
      toast({ title: err.message || tr('\u062E\u0637\u0623', 'Error'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Cosign handler ----------
  const handleCosign = async (noteId: string) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/psychiatry/progress-notes', {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: noteId, action: 'cosign' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to co-sign note');
      }
      toast({ title: tr('\u062A\u0645 \u0627\u0644\u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0645\u0634\u062A\u0631\u0643', 'Note co-signed successfully') });
      mutate();
      const updated = await res.json();
      if (selectedNote?.id === noteId) setSelectedNote(updated.note);
    } catch (err: any) {
      toast({ title: err.message || tr('\u062E\u0637\u0623', 'Error'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Amendment handler ----------
  const handleAmend = async () => {
    if (!selectedNote || !amendmentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/psychiatry/progress-notes', {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedNote.id, action: 'amend', amendmentNotes: amendmentText.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to amend note');
      }
      toast({ title: tr('\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0629', 'Note amended successfully') });
      setShowAmendDialog(false);
      setAmendmentText('');
      mutate();
      const updated = await res.json();
      setSelectedNote(updated.note);
    } catch (err: any) {
      toast({ title: err.message || tr('\u062E\u0637\u0623', 'Error'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- DAP preview for table ----------
  const getDapPreview = (n: ProgressNote): string => {
    const parts: string[] = [];
    if (n.dataSection) parts.push('D: ' + n.dataSection);
    if (n.assessmentSection) parts.push('A: ' + n.assessmentSection);
    if (n.planSection) parts.push('P: ' + n.planSection);
    return truncate(parts.join(' | '), 80);
  };

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div className="space-y-6 p-4 md:p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* ---------- Header ---------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {tr('\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u062A\u0642\u062F\u0645', 'Progress Notes')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {tr(
              '\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0637\u0628 \u0627\u0644\u0646\u0641\u0633\u064A \u0628\u062A\u0646\u0633\u064A\u0642 DAP',
              'Psychiatry progress notes in DAP format',
            )}
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowNewDialog(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          {tr('\u0645\u0644\u0627\u062D\u0638\u0629 \u062C\u062F\u064A\u062F\u0629', 'New Note')}
        </Button>
      </div>

      {/* ---------- KPI Cards ---------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {tr('\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A', 'Total Notes')}
            </CardTitle>
            <FileText className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalNotes}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {tr('\u063A\u064A\u0631 \u0645\u0648\u0642\u0651\u0639\u0629 / \u0645\u0633\u0648\u062F\u0629', 'Unsigned / Draft')}
            </CardTitle>
            <Clock className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{draftCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {tr('\u0645\u0648\u0642\u0651\u0639\u0629 \u0627\u0644\u064A\u0648\u0645', 'Signed Today')}
            </CardTitle>
            <CheckCircle className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{signedToday}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {tr('\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0623\u0632\u0645\u0627\u062A', 'Crisis Notes')}
            </CardTitle>
            <AlertTriangle className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{crisisCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* ---------- Filters ---------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder={tr('\u0628\u062D\u062B \u0628\u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u0631\u064A\u0636 \u0623\u0648 \u0627\u0633\u0645 \u0627\u0644\u0645\u0624\u0644\u0641...', 'Search by patient ID or author...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={filterNoteType} onValueChange={setFilterNoteType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={tr('\u0646\u0648\u0639 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0629', 'Note Type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('\u0627\u0644\u0643\u0644', 'All Types')}</SelectItem>
            {NOTE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {noteTypeLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={tr('\u0627\u0644\u062D\u0627\u0644\u0629', 'Status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('\u0627\u0644\u0643\u0644', 'All Statuses')}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ---------- Table ---------- */}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{tr('\u0627\u0644\u062A\u0627\u0631\u064A\u062E', 'Date')}</th>
                <th className="px-4 py-3 text-start font-medium">{tr('\u0627\u0644\u0645\u0631\u064A\u0636', 'Patient')}</th>
                <th className="px-4 py-3 text-start font-medium">{tr('\u0627\u0644\u0646\u0648\u0639', 'Type')}</th>
                <th className="px-4 py-3 text-start font-medium">{tr('\u0645\u0644\u062E\u0635 DAP', 'DAP Preview')}</th>
                <th className="px-4 py-3 text-start font-medium">{tr('\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u062E\u0637\u0631', 'Risk Level')}</th>
                <th className="px-4 py-3 text-start font-medium">{tr('\u0627\u0644\u062D\u0627\u0644\u0629', 'Status')}</th>
                <th className="px-4 py-3 text-start font-medium">{tr('\u0625\u062C\u0631\u0627\u0621\u0627\u062A', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    {tr('\u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u0644\u0627\u062D\u0638\u0627\u062A', 'No notes found')}
                  </td>
                </tr>
              )}
              {filtered.map((n) => {
                const risk = getRiskLevel(n);
                return (
                  <tr key={n.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(n.noteDate)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{truncate(n.patientMasterId, 12)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={n.noteType === 'CRISIS' ? 'destructive' : 'outline'}>
                        {noteTypeLabel(n.noteType)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 max-w-[240px] truncate text-muted-foreground">
                      {getDapPreview(n)}
                    </td>
                    <td className="px-4 py-3">
                      {risk !== '\u2014' ? (
                        <Badge variant={getRiskBadgeVariant(risk)}>{risk}</Badge>
                      ) : (
                        <span className="text-muted-foreground">{'\u2014'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusBadgeVariant(n.status)}>
                        {statusLabel(n.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setSelectedNote(n); setShowViewDialog(true); }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {n.status === 'DRAFT' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSign(n.id)}
                            disabled={submitting}
                          >
                            <Pen className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/*  CREATE DIALOG                                                 */}
      {/* ============================================================ */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{tr('\u0645\u0644\u0627\u062D\u0638\u0629 \u062A\u0642\u062F\u0645 \u062C\u062F\u064A\u062F\u0629', 'New Progress Note')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* ---- Basic Info ---- */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{tr('\u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u0631\u064A\u0636', 'Patient ID')} *</Label>
                <Input
                  value={form.patientMasterId}
                  onChange={(e) => setForm((f) => ({ ...f, patientMasterId: e.target.value }))}
                  placeholder={tr('\u0623\u062F\u062E\u0644 \u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u0631\u064A\u0636', 'Enter patient ID')}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{tr('\u0646\u0648\u0639 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0629', 'Note Type')} *</Label>
                <Select value={form.noteType} onValueChange={(v) => setForm((f) => ({ ...f, noteType: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {noteTypeLabel(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ---- Link to Treatment Plan ---- */}
            <div className="space-y-1.5">
              <Label>{tr('\u0631\u0628\u0637 \u0628\u062E\u0637\u0629 \u0627\u0644\u0639\u0644\u0627\u062C', 'Link to Treatment Plan')}</Label>
              <Select value={form.treatmentPlanId || '__none__'} onValueChange={(v) => handleTreatmentPlanChange(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder={tr('\u0627\u062E\u062A\u064A\u0627\u0631\u064A', 'Optional')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{tr('\u0628\u062F\u0648\u0646', 'None')}</SelectItem>
                  {treatmentPlans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.dsm5Diagnosis || p.id.slice(0, 8)} - {p.patientMasterId.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ---- DAP Sections ---- */}
            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="text-lg font-semibold">
                {tr('\u062A\u0646\u0633\u064A\u0642 DAP', 'DAP Format')}
              </h3>

              {/* Data Section */}
              <div className="space-y-1.5">
                <Label className="text-base font-medium">
                  D - {tr('\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A', 'Data')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {tr(
                    '\u0633\u062C\u0644 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A\u060C \u062A\u0635\u0631\u064A\u062D\u0627\u062A \u0627\u0644\u0645\u0631\u064A\u0636\u060C \u0627\u0644\u0639\u0644\u0627\u0645\u0627\u062A \u0627\u0644\u062D\u064A\u0648\u064A\u0629\u060C \u0646\u062A\u0627\u0626\u062C \u0627\u0644\u0641\u062D\u0648\u0635\u0627\u062A\u060C \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0633\u0644\u0648\u0643\u064A\u0629',
                    'Record observations, patient statements, vital signs, test results, behavioral observations',
                  )}
                </p>
                <Textarea
                  value={form.dataSection}
                  onChange={(e) => setForm((f) => ({ ...f, dataSection: e.target.value }))}
                  rows={5}
                  placeholder={tr(
                    '\u0623\u062F\u062E\u0644 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0648\u0636\u0648\u0639\u064A\u0629 \u0648\u0627\u0644\u0630\u0627\u062A\u064A\u0629...',
                    'Enter objective and subjective data...',
                  )}
                />
              </div>

              {/* Assessment Section */}
              <div className="space-y-1.5">
                <Label className="text-base font-medium">
                  A - {tr('\u0627\u0644\u062A\u0642\u064A\u064A\u0645', 'Assessment')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {tr(
                    '\u0627\u0644\u062A\u0641\u0633\u064A\u0631 \u0627\u0644\u0633\u0631\u064A\u0631\u064A\u060C \u0627\u0644\u0627\u0646\u0637\u0628\u0627\u0639 \u0627\u0644\u062A\u0634\u062E\u064A\u0635\u064A\u060C \u0627\u0644\u062A\u0642\u062F\u0645 \u0646\u062D\u0648 \u0627\u0644\u0623\u0647\u062F\u0627\u0641',
                    'Clinical interpretation, diagnostic impression, progress toward goals',
                  )}
                </p>
                <Textarea
                  value={form.assessmentSection}
                  onChange={(e) => setForm((f) => ({ ...f, assessmentSection: e.target.value }))}
                  rows={5}
                  placeholder={tr(
                    '\u0623\u062F\u062E\u0644 \u0627\u0644\u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u0633\u0631\u064A\u0631\u064A...',
                    'Enter clinical assessment...',
                  )}
                />
              </div>

              {/* Plan Section */}
              <div className="space-y-1.5">
                <Label className="text-base font-medium">
                  P - {tr('\u0627\u0644\u062E\u0637\u0629', 'Plan')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {tr(
                    '\u0627\u0644\u062E\u0637\u0648\u0627\u062A \u0627\u0644\u062A\u0627\u0644\u064A\u0629\u060C \u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0627\u0644\u0639\u0644\u0627\u062C\u060C \u0627\u0644\u0625\u062D\u0627\u0644\u0627\u062A\u060C \u062C\u062F\u0648\u0644 \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629',
                    'Next steps, treatment modifications, referrals, follow-up schedule',
                  )}
                </p>
                <Textarea
                  value={form.planSection}
                  onChange={(e) => setForm((f) => ({ ...f, planSection: e.target.value }))}
                  rows={5}
                  placeholder={tr(
                    '\u0623\u062F\u062E\u0644 \u0627\u0644\u062E\u0637\u0629...',
                    'Enter plan...',
                  )}
                />
              </div>
            </div>

            {/* ---- Goal Progress (shown only when treatment plan is linked) ---- */}
            {goalProgress.length > 0 && (
              <div className="space-y-4 rounded-lg border p-4">
                <h3 className="text-lg font-semibold">
                  {tr('\u062A\u0642\u062F\u0645 \u0627\u0644\u0623\u0647\u062F\u0627\u0641', 'Goal Progress')}
                </h3>
                {goalProgress.map((gp, idx) => (
                  <div key={gp.goalId} className="space-y-2 rounded border p-3">
                    <p className="text-sm font-medium">{gp.goalDescription || `${tr('\u0647\u062F\u0641', 'Goal')} ${idx + 1}`}</p>
                    <div className="space-y-1.5">
                      <Label>
                        {tr('\u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u062A\u0642\u062F\u0645', 'Progress Rating')}: {gp.progressRating}/5
                      </Label>
                      <Slider
                        value={[gp.progressRating]}
                        onValueChange={([v]) =>
                          setGoalProgress((prev) =>
                            prev.map((g, i) => (i === idx ? { ...g, progressRating: v } : g)),
                          )
                        }
                        min={1}
                        max={5}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{tr('\u0645\u0644\u0627\u062D\u0638\u0627\u062A', 'Notes')}</Label>
                      <Textarea
                        value={gp.progressNotes}
                        onChange={(e) =>
                          setGoalProgress((prev) =>
                            prev.map((g, i) =>
                              i === idx ? { ...g, progressNotes: e.target.value } : g,
                            ),
                          )
                        }
                        rows={2}
                        placeholder={tr('\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u062A\u0642\u062F\u0645...', 'Progress notes...')}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ---- Medication Response ---- */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {tr('\u0627\u0633\u062A\u062C\u0627\u0628\u0629 \u0627\u0644\u0623\u062F\u0648\u064A\u0629', 'Medication Response')}
                </h3>
                <Button size="sm" variant="outline" onClick={addMedResponse}>
                  <Plus className="mr-1 h-3 w-3" />
                  {tr('\u0625\u0636\u0627\u0641\u0629 \u062F\u0648\u0627\u0621', 'Add Drug')}
                </Button>
              </div>
              {medResponses.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {tr(
                    '\u0644\u0645 \u064A\u062A\u0645 \u0625\u0636\u0627\u0641\u0629 \u0623\u062F\u0648\u064A\u0629. \u0627\u0646\u0642\u0631 "\u0625\u0636\u0627\u0641\u0629 \u062F\u0648\u0627\u0621" \u0644\u0644\u0628\u062F\u0621.',
                    'No medications added. Click "Add Drug" to begin.',
                  )}
                </p>
              )}
              {medResponses.map((mr, idx) => (
                <div key={idx} className="grid gap-3 rounded border p-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2 flex items-start gap-2">
                    <div className="flex-1 space-y-1.5">
                      <Label>{tr('\u0627\u0633\u0645 \u0627\u0644\u062F\u0648\u0627\u0621', 'Drug Name')}</Label>
                      <Input
                        value={mr.drug}
                        onChange={(e) => updateMedResponse(idx, 'drug', e.target.value)}
                        placeholder={tr('\u0627\u062F\u062E\u0644 \u0627\u0633\u0645 \u0627\u0644\u062F\u0648\u0627\u0621', 'Enter drug name')}
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="mt-6 text-destructive"
                      onClick={() => removeMedResponse(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{tr('\u0627\u0644\u0641\u0639\u0627\u0644\u064A\u0629', 'Effectiveness')}</Label>
                    <Select
                      value={mr.effectiveness}
                      onValueChange={(v) => updateMedResponse(idx, 'effectiveness', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={tr('\u0627\u062E\u062A\u0631', 'Select')} />
                      </SelectTrigger>
                      <SelectContent>
                        {EFFECTIVENESS_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o === 'EFFECTIVE'
                              ? tr('\u0641\u0639\u0651\u0627\u0644', 'Effective')
                              : o === 'PARTIAL'
                                ? tr('\u062C\u0632\u0626\u064A', 'Partial')
                                : tr('\u063A\u064A\u0631 \u0641\u0639\u0651\u0627\u0644', 'Ineffective')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{tr('\u0627\u0644\u0627\u0644\u062A\u0632\u0627\u0645', 'Adherence')}</Label>
                    <Select
                      value={mr.adherence}
                      onValueChange={(v) => updateMedResponse(idx, 'adherence', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={tr('\u0627\u062E\u062A\u0631', 'Select')} />
                      </SelectTrigger>
                      <SelectContent>
                        {ADHERENCE_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o === 'GOOD'
                              ? tr('\u062C\u064A\u062F', 'Good')
                              : o === 'PARTIAL'
                                ? tr('\u062C\u0632\u0626\u064A', 'Partial')
                                : tr('\u063A\u064A\u0631 \u0645\u0644\u062A\u0632\u0645', 'Non-adherent')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>{tr('\u0627\u0644\u0622\u062B\u0627\u0631 \u0627\u0644\u062C\u0627\u0646\u0628\u064A\u0629', 'Side Effects')}</Label>
                    <Input
                      value={mr.sideEffects}
                      onChange={(e) => updateMedResponse(idx, 'sideEffects', e.target.value)}
                      placeholder={tr('\u0635\u0641 \u0627\u0644\u0622\u062B\u0627\u0631 \u0627\u0644\u062C\u0627\u0646\u0628\u064A\u0629', 'Describe side effects')}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* ---- Risk Reassessment ---- */}
            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="text-lg font-semibold">
                {tr('\u0625\u0639\u0627\u062F\u0629 \u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u062E\u0637\u0631', 'Risk Reassessment')}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{tr('\u062E\u0637\u0631 \u0627\u0644\u0627\u0646\u062A\u062D\u0627\u0631', 'Suicide Risk Level')}</Label>
                  <Select value={form.suicideRisk || '__none__'} onValueChange={(v) => setForm((f) => ({ ...f, suicideRisk: v === '__none__' ? '' : v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder={tr('\u0627\u062E\u062A\u0631', 'Select')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{tr('\u063A\u064A\u0631 \u0645\u062D\u062F\u062F', 'Not specified')}</SelectItem>
                      {RISK_LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{tr('\u062E\u0637\u0631 \u0627\u0644\u0639\u0646\u0641', 'Violence Risk Level')}</Label>
                  <Select value={form.violenceRisk || '__none__'} onValueChange={(v) => setForm((f) => ({ ...f, violenceRisk: v === '__none__' ? '' : v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder={tr('\u0627\u062E\u062A\u0631', 'Select')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{tr('\u063A\u064A\u0631 \u0645\u062D\u062F\u062F', 'Not specified')}</SelectItem>
                      {VIOLENCE_RISK_LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{tr('\u0627\u0644\u062A\u063A\u064A\u064A\u0631\u0627\u062A', 'Changes')}</Label>
                <Textarea
                  value={form.riskChanges}
                  onChange={(e) => setForm((f) => ({ ...f, riskChanges: e.target.value }))}
                  rows={2}
                  placeholder={tr(
                    '\u0635\u0641 \u0623\u064A \u062A\u063A\u064A\u064A\u0631\u0627\u062A \u0641\u064A \u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u062E\u0637\u0631...',
                    'Describe any changes in risk level...',
                  )}
                />
              </div>
            </div>

            {/* ---- Brief MSE ---- */}
            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="text-lg font-semibold">
                {tr('\u0641\u062D\u0635 \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u0639\u0642\u0644\u064A\u0629 \u0627\u0644\u0645\u0648\u062C\u0632', 'Brief Mental Status Exam')}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{tr('\u0627\u0644\u0645\u0632\u0627\u062C', 'Mood')}</Label>
                  <Input
                    value={form.mood}
                    onChange={(e) => setForm((f) => ({ ...f, mood: e.target.value }))}
                    placeholder={tr('\u0645\u062B\u0644: \u0645\u0643\u062A\u0626\u0628\u060C \u0642\u0644\u0642\u060C \u0637\u0628\u064A\u0639\u064A', 'e.g., Depressed, Anxious, Normal')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{tr('\u0627\u0644\u0648\u062C\u062F\u0627\u0646', 'Affect')}</Label>
                  <Select value={form.affect || '__none__'} onValueChange={(v) => setForm((f) => ({ ...f, affect: v === '__none__' ? '' : v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder={tr('\u0627\u062E\u062A\u0631', 'Select')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{tr('\u063A\u064A\u0631 \u0645\u062D\u062F\u062F', 'Not specified')}</SelectItem>
                      {AFFECT_OPTIONS.map((a) => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{tr('\u0639\u0645\u0644\u064A\u0629 \u0627\u0644\u062A\u0641\u0643\u064A\u0631', 'Thought Process')}</Label>
                  <Select value={form.thoughtProcess || '__none__'} onValueChange={(v) => setForm((f) => ({ ...f, thoughtProcess: v === '__none__' ? '' : v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder={tr('\u0627\u062E\u062A\u0631', 'Select')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{tr('\u063A\u064A\u0631 \u0645\u062D\u062F\u062F', 'Not specified')}</SelectItem>
                      {THOUGHT_PROCESS_OPTIONS.map((tp) => (
                        <SelectItem key={tp} value={tp}>{tp}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{tr('\u0627\u0644\u0628\u0635\u064A\u0631\u0629', 'Insight')}</Label>
                  <Select value={form.insight || '__none__'} onValueChange={(v) => setForm((f) => ({ ...f, insight: v === '__none__' ? '' : v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder={tr('\u0627\u062E\u062A\u0631', 'Select')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{tr('\u063A\u064A\u0631 \u0645\u062D\u062F\u062F', 'Not specified')}</SelectItem>
                      {INSIGHT_OPTIONS.map((i) => (
                        <SelectItem key={i} value={i}>{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{tr('\u0627\u0644\u062D\u0643\u0645', 'Judgment')}</Label>
                  <Select value={form.judgment || '__none__'} onValueChange={(v) => setForm((f) => ({ ...f, judgment: v === '__none__' ? '' : v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder={tr('\u0627\u062E\u062A\u0631', 'Select')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{tr('\u063A\u064A\u0631 \u0645\u062D\u062F\u062F', 'Not specified')}</SelectItem>
                      {JUDGMENT_OPTIONS.map((j) => (
                        <SelectItem key={j} value={j}>{j}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ---- Session Details ---- */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{tr('\u0645\u062F\u0629 \u0627\u0644\u062C\u0644\u0633\u0629 (\u062F\u0642\u0627\u0626\u0642)', 'Session Duration (minutes)')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sessionDurationMin}
                  onChange={(e) => setForm((f) => ({ ...f, sessionDurationMin: e.target.value }))}
                  placeholder="45"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{tr('\u0645\u0648\u0639\u062F \u0627\u0644\u062C\u0644\u0633\u0629 \u0627\u0644\u0642\u0627\u062F\u0645\u0629', 'Next Session Date')}</Label>
                <Input
                  type="date"
                  value={form.nextSessionDate}
                  onChange={(e) => setForm((f) => ({ ...f, nextSessionDate: e.target.value }))}
                />
              </div>
            </div>

            {/* ---- Additional Notes ---- */}
            <div className="space-y-1.5">
              <Label>{tr('\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629', 'Additional Notes')}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder={tr('\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629...', 'Additional notes...')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              {tr('\u0625\u0644\u063A\u0627\u0621', 'Cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting
                ? tr('\u062C\u0627\u0631\u064A \u0627\u0644\u062D\u0641\u0638...', 'Saving...')
                : tr('\u0625\u0646\u0634\u0627\u0621 \u0645\u0633\u0648\u062F\u0629', 'Create Draft')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/*  VIEW DIALOG                                                   */}
      {/* ============================================================ */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          {selectedNote && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {tr('\u0645\u0644\u0627\u062D\u0638\u0629 \u0627\u0644\u062A\u0642\u062F\u0645', 'Progress Note')}
                  <Badge variant={getStatusBadgeVariant(selectedNote.status)} className="ml-2">
                    {statusLabel(selectedNote.status)}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5 py-2">
                {/* ---- Meta Info ---- */}
                <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <span className="font-medium text-muted-foreground">{tr('\u0627\u0644\u062A\u0627\u0631\u064A\u062E', 'Date')}:</span>{' '}
                    {formatDate(selectedNote.noteDate)}
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">{tr('\u0627\u0644\u0645\u0631\u064A\u0636', 'Patient')}:</span>{' '}
                    <span className="font-mono">{selectedNote.patientMasterId.slice(0, 12)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">{tr('\u0627\u0644\u0645\u0624\u0644\u0641', 'Author')}:</span>{' '}
                    {selectedNote.authorName || '\u2014'}
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">{tr('\u0627\u0644\u0646\u0648\u0639', 'Type')}:</span>{' '}
                    <Badge variant={selectedNote.noteType === 'CRISIS' ? 'destructive' : 'outline'}>
                      {noteTypeLabel(selectedNote.noteType)}
                    </Badge>
                  </div>
                  {selectedNote.sessionDurationMin != null && (
                    <div>
                      <span className="font-medium text-muted-foreground">{tr('\u0627\u0644\u0645\u062F\u0629', 'Duration')}:</span>{' '}
                      {selectedNote.sessionDurationMin} {tr('\u062F\u0642\u064A\u0642\u0629', 'min')}
                    </div>
                  )}
                  {selectedNote.nextSessionDate && (
                    <div>
                      <span className="font-medium text-muted-foreground">{tr('\u0627\u0644\u062C\u0644\u0633\u0629 \u0627\u0644\u0642\u0627\u062F\u0645\u0629', 'Next Session')}:</span>{' '}
                      {formatDate(selectedNote.nextSessionDate)}
                    </div>
                  )}
                  {selectedNote.signedAt && (
                    <div>
                      <span className="font-medium text-muted-foreground">{tr('\u0648\u0642\u0651\u0639 \u0628\u0648\u0627\u0633\u0637\u0629', 'Signed by')}:</span>{' '}
                      {selectedNote.signedBy} ({formatDate(selectedNote.signedAt)})
                    </div>
                  )}
                  {selectedNote.cosignedBy && (
                    <div>
                      <span className="font-medium text-muted-foreground">{tr('\u062A\u0648\u0642\u064A\u0639 \u0645\u0634\u062A\u0631\u0643', 'Co-signed by')}:</span>{' '}
                      {selectedNote.cosignedBy} ({formatDate(selectedNote.cosignedAt)})
                    </div>
                  )}
                </div>

                {/* ---- DAP Sections ---- */}
                <div className="space-y-4 rounded-lg border p-4">
                  <h3 className="text-lg font-bold">
                    {tr('\u062A\u0646\u0633\u064A\u0642 DAP', 'DAP Format')}
                  </h3>

                  <div className="space-y-1">
                    <h4 className="font-semibold text-blue-700 dark:text-blue-400">
                      D - {tr('\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A', 'Data')}
                    </h4>
                    <p className="whitespace-pre-wrap text-sm">
                      {selectedNote.dataSection || tr('\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A', 'No data recorded')}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-semibold text-green-700 dark:text-green-400">
                      A - {tr('\u0627\u0644\u062A\u0642\u064A\u064A\u0645', 'Assessment')}
                    </h4>
                    <p className="whitespace-pre-wrap text-sm">
                      {selectedNote.assessmentSection || tr('\u0644\u0627 \u064A\u0648\u062C\u062F \u062A\u0642\u064A\u064A\u0645', 'No assessment recorded')}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-semibold text-purple-700 dark:text-purple-400">
                      P - {tr('\u0627\u0644\u062E\u0637\u0629', 'Plan')}
                    </h4>
                    <p className="whitespace-pre-wrap text-sm">
                      {selectedNote.planSection || tr('\u0644\u0627 \u062A\u0648\u062C\u062F \u062E\u0637\u0629', 'No plan recorded')}
                    </p>
                  </div>
                </div>

                {/* ---- Goal Progress (if any) ---- */}
                {selectedNote.goalProgress && Array.isArray(selectedNote.goalProgress) && selectedNote.goalProgress.length > 0 && (
                  <div className="space-y-3 rounded-lg border p-4">
                    <h3 className="text-lg font-semibold">
                      {tr('\u062A\u0642\u062F\u0645 \u0627\u0644\u0623\u0647\u062F\u0627\u0641', 'Goal Progress')}
                    </h3>
                    {(selectedNote.goalProgress as GoalProgressItem[]).map((gp, idx) => (
                      <div key={idx} className="rounded border p-3">
                        <p className="text-sm font-medium">{gp.goalDescription || `${tr('\u0647\u062F\u0641', 'Goal')} ${idx + 1}`}</p>
                        <div className="mt-1 flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">{tr('\u0627\u0644\u062A\u0642\u064A\u064A\u0645', 'Rating')}:</span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((v) => (
                              <div
                                key={v}
                                className={`h-3 w-6 rounded-sm ${v <= gp.progressRating ? 'bg-blue-500' : 'bg-muted'}`}
                              />
                            ))}
                          </div>
                          <span className="font-medium">{gp.progressRating}/5</span>
                        </div>
                        {gp.progressNotes && (
                          <p className="mt-1 text-sm text-muted-foreground">{gp.progressNotes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ---- Medication Response (if any) ---- */}
                {selectedNote.medicationResponse && Array.isArray(selectedNote.medicationResponse) && selectedNote.medicationResponse.length > 0 && (
                  <div className="space-y-3 rounded-lg border p-4">
                    <h3 className="text-lg font-semibold">
                      {tr('\u0627\u0633\u062A\u062C\u0627\u0628\u0629 \u0627\u0644\u0623\u062F\u0648\u064A\u0629', 'Medication Response')}
                    </h3>
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="px-2 py-1.5 text-start font-medium">{tr('\u0627\u0644\u062F\u0648\u0627\u0621', 'Drug')}</th>
                          <th className="px-2 py-1.5 text-start font-medium">{tr('\u0627\u0644\u0641\u0639\u0627\u0644\u064A\u0629', 'Effectiveness')}</th>
                          <th className="px-2 py-1.5 text-start font-medium">{tr('\u0627\u0644\u0627\u0644\u062A\u0632\u0627\u0645', 'Adherence')}</th>
                          <th className="px-2 py-1.5 text-start font-medium">{tr('\u0622\u062B\u0627\u0631 \u062C\u0627\u0646\u0628\u064A\u0629', 'Side Effects')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedNote.medicationResponse as MedicationResponseItem[]).map((mr, idx) => (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="px-2 py-1.5 font-medium">{mr.drug}</td>
                            <td className="px-2 py-1.5">
                              <Badge
                                variant={
                                  mr.effectiveness === 'EFFECTIVE'
                                    ? 'default'
                                    : mr.effectiveness === 'INEFFECTIVE'
                                      ? 'destructive'
                                      : 'secondary'
                                }
                              >
                                {mr.effectiveness || '\u2014'}
                              </Badge>
                            </td>
                            <td className="px-2 py-1.5">
                              <Badge
                                variant={
                                  mr.adherence === 'GOOD'
                                    ? 'default'
                                    : mr.adherence === 'NON_ADHERENT'
                                      ? 'destructive'
                                      : 'secondary'
                                }
                              >
                                {mr.adherence || '\u2014'}
                              </Badge>
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground">{mr.sideEffects || '\u2014'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ---- Risk Reassessment (if any) ---- */}
                {selectedNote.riskReassessment && (
                  <div className="space-y-2 rounded-lg border p-4">
                    <h3 className="text-lg font-semibold">
                      {tr('\u0625\u0639\u0627\u062F\u0629 \u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u062E\u0637\u0631', 'Risk Reassessment')}
                    </h3>
                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <span className="font-medium text-muted-foreground">{tr('\u062E\u0637\u0631 \u0627\u0644\u0627\u0646\u062A\u062D\u0627\u0631', 'Suicide Risk')}:</span>{' '}
                        {(selectedNote.riskReassessment as RiskReassessment).suicideRisk ? (
                          <Badge variant={getRiskBadgeVariant((selectedNote.riskReassessment as RiskReassessment).suicideRisk)}>
                            {(selectedNote.riskReassessment as RiskReassessment).suicideRisk}
                          </Badge>
                        ) : '\u2014'}
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">{tr('\u062E\u0637\u0631 \u0627\u0644\u0639\u0646\u0641', 'Violence Risk')}:</span>{' '}
                        {(selectedNote.riskReassessment as RiskReassessment).violenceRisk ? (
                          <Badge variant={getRiskBadgeVariant((selectedNote.riskReassessment as RiskReassessment).violenceRisk)}>
                            {(selectedNote.riskReassessment as RiskReassessment).violenceRisk}
                          </Badge>
                        ) : '\u2014'}
                      </div>
                    </div>
                    {(selectedNote.riskReassessment as RiskReassessment).changes && (
                      <p className="text-sm text-muted-foreground">
                        {(selectedNote.riskReassessment as RiskReassessment).changes}
                      </p>
                    )}
                  </div>
                )}

                {/* ---- Brief MSE (if any) ---- */}
                {selectedNote.briefMse && (
                  <div className="space-y-2 rounded-lg border p-4">
                    <h3 className="text-lg font-semibold">
                      {tr('\u0641\u062D\u0635 \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u0639\u0642\u0644\u064A\u0629 \u0627\u0644\u0645\u0648\u062C\u0632', 'Brief MSE')}
                    </h3>
                    <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      {(selectedNote.briefMse as BriefMse).mood && (
                        <div>
                          <span className="font-medium text-muted-foreground">{tr('\u0627\u0644\u0645\u0632\u0627\u062C', 'Mood')}:</span>{' '}
                          {(selectedNote.briefMse as BriefMse).mood}
                        </div>
                      )}
                      {(selectedNote.briefMse as BriefMse).affect && (
                        <div>
                          <span className="font-medium text-muted-foreground">{tr('\u0627\u0644\u0648\u062C\u062F\u0627\u0646', 'Affect')}:</span>{' '}
                          {(selectedNote.briefMse as BriefMse).affect}
                        </div>
                      )}
                      {(selectedNote.briefMse as BriefMse).thoughtProcess && (
                        <div>
                          <span className="font-medium text-muted-foreground">{tr('\u0639\u0645\u0644\u064A\u0629 \u0627\u0644\u062A\u0641\u0643\u064A\u0631', 'Thought Process')}:</span>{' '}
                          {(selectedNote.briefMse as BriefMse).thoughtProcess}
                        </div>
                      )}
                      {(selectedNote.briefMse as BriefMse).insight && (
                        <div>
                          <span className="font-medium text-muted-foreground">{tr('\u0627\u0644\u0628\u0635\u064A\u0631\u0629', 'Insight')}:</span>{' '}
                          {(selectedNote.briefMse as BriefMse).insight}
                        </div>
                      )}
                      {(selectedNote.briefMse as BriefMse).judgment && (
                        <div>
                          <span className="font-medium text-muted-foreground">{tr('\u0627\u0644\u062D\u0643\u0645', 'Judgment')}:</span>{' '}
                          {(selectedNote.briefMse as BriefMse).judgment}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ---- Amendment Notes (if amended) ---- */}
                {selectedNote.amendmentNotes && (
                  <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
                    <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                      {tr('\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u062A\u0639\u062F\u064A\u0644', 'Amendment Notes')}
                    </h3>
                    <p className="whitespace-pre-wrap text-sm">{selectedNote.amendmentNotes}</p>
                  </div>
                )}

                {/* ---- Additional Notes ---- */}
                {selectedNote.notes && (
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      {tr('\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629', 'Additional Notes')}
                    </h4>
                    <p className="whitespace-pre-wrap text-sm">{selectedNote.notes}</p>
                  </div>
                )}
              </div>

              {/* ---- Actions ---- */}
              <DialogFooter className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setShowViewDialog(false)}>
                  {tr('\u0625\u063A\u0644\u0627\u0642', 'Close')}
                </Button>

                {selectedNote.status === 'DRAFT' && (
                  <Button
                    onClick={() => handleSign(selectedNote.id)}
                    disabled={submitting}
                  >
                    <Pen className="mr-2 h-4 w-4" />
                    {tr('\u062A\u0648\u0642\u064A\u0639', 'Sign Note')}
                  </Button>
                )}

                {selectedNote.status === 'SIGNED' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handleCosign(selectedNote.id)}
                      disabled={submitting}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {tr('\u062A\u0648\u0642\u064A\u0639 \u0645\u0634\u062A\u0631\u0643', 'Co-sign')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setAmendmentText(''); setShowAmendDialog(true); }}
                    >
                      <Pen className="mr-2 h-4 w-4" />
                      {tr('\u062A\u0639\u062F\u064A\u0644', 'Amend')}
                    </Button>
                  </>
                )}

                {selectedNote.status === 'COSIGNED' && (
                  <Button
                    variant="outline"
                    onClick={() => { setAmendmentText(''); setShowAmendDialog(true); }}
                  >
                    <Pen className="mr-2 h-4 w-4" />
                    {tr('\u062A\u0639\u062F\u064A\u0644', 'Amend')}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/*  AMEND DIALOG                                                  */}
      {/* ============================================================ */}
      <Dialog open={showAmendDialog} onOpenChange={setShowAmendDialog}>
        <DialogContent dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>
              {tr('\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0629', 'Amend Note')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {tr(
                '\u0623\u062F\u062E\u0644 \u0633\u0628\u0628 \u0627\u0644\u062A\u0639\u062F\u064A\u0644 \u0648\u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u0645\u0635\u062D\u062D\u0629. \u0633\u064A\u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0629 \u0625\u0644\u0649 "\u0645\u0639\u062F\u0651\u0644".',
                'Enter the reason for amendment and corrected information. The note status will change to "Amended".',
              )}
            </p>
            <div className="space-y-1.5">
              <Label>{tr('\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u062A\u0639\u062F\u064A\u0644', 'Amendment Notes')} *</Label>
              <Textarea
                value={amendmentText}
                onChange={(e) => setAmendmentText(e.target.value)}
                rows={5}
                placeholder={tr(
                  '\u0623\u062F\u062E\u0644 \u0633\u0628\u0628 \u0648\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u062A\u0639\u062F\u064A\u0644...',
                  'Enter reason and details of the amendment...',
                )}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAmendDialog(false)}>
              {tr('\u0625\u0644\u063A\u0627\u0621', 'Cancel')}
            </Button>
            <Button
              onClick={handleAmend}
              disabled={submitting || !amendmentText.trim()}
            >
              {submitting
                ? tr('\u062C\u0627\u0631\u064A...', 'Saving...')
                : tr('\u062D\u0641\u0638 \u0627\u0644\u062A\u0639\u062F\u064A\u0644', 'Save Amendment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
