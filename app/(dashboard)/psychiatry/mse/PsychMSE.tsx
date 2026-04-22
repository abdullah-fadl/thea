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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Brain,
  ClipboardList,
  Users,
  Plus,
  Eye,
  Activity,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface MSE {
  id: string;
  patientMasterId: string;
  assessedByName?: string;
  assessedAt: string;
  appearance?: { grooming?: string; hygiene?: string; clothing?: string; build?: string };
  behavior?: { cooperation?: string; eyeContact?: string; psychomotor?: string; mannerisms?: string };
  speech?: { rate?: string; volume?: string; tone?: string; articulation?: string; spontaneity?: string };
  moodReported?: string;
  affectObserved?: string;
  affectCongruence?: string;
  affectRange?: string;
  thoughtProcess?: string;
  thoughtContent?: { suicidal?: boolean; homicidal?: boolean; delusions?: boolean; obsessions?: boolean; phobias?: boolean };
  delusionType?: string;
  perceptions?: { hallucinations?: { auditory?: boolean; visual?: boolean; tactile?: boolean; olfactory?: boolean; gustatory?: boolean }; illusions?: boolean; derealization?: boolean; depersonalization?: boolean };
  cognition?: { orientation?: { person?: boolean; place?: boolean; time?: boolean; situation?: boolean }; attention?: string; concentration?: string; memory?: { immediate?: string; recent?: string; remote?: string } };
  mmseScore?: number;
  mocaScore?: number;
  insight?: string;
  judgment?: string;
  reliability?: string;
  summary?: string;
  clinicalImpression?: string;
  notes?: string;
  createdAt: string;
}

/* ================================================================== */
/*  PsychMSE — Main Component                                         */
/* ================================================================== */
export default function PsychMSE() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  // ---------- State ----------
  const [search, setSearch] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedMSE, setSelectedMSE] = useState<MSE | null>(null);

  // New MSE form
  const [form, setForm] = useState({
    patientMasterId: '',
    // Appearance
    grooming: '', hygiene: '', clothing: '', build: '',
    // Behavior
    cooperation: '', eyeContact: '', psychomotor: '', mannerisms: '',
    // Speech
    speechRate: '', speechVolume: '', speechTone: '', speechArticulation: '', speechSpontaneity: '',
    // Mood & Affect
    moodReported: '',
    affectObserved: '',
    affectCongruence: '',
    affectRange: '',
    // Thought Process
    thoughtProcess: '',
    // Thought Content
    suicidalIdeation: false, homicidalIdeation: false, delusions: false, obsessions: false, phobias: false,
    delusionType: '',
    // Perceptions
    hallAuditory: false, hallVisual: false, hallTactile: false, hallOlfactory: false, hallGustatory: false,
    illusions: false, derealization: false, depersonalization: false,
    // Cognition
    orientPerson: true, orientPlace: true, orientTime: true, orientSituation: true,
    attention: '', concentration: '',
    memoryImmediate: '', memoryRecent: '', memoryRemote: '',
    mmseScore: '',
    mocaScore: '',
    // Insight & Judgment
    insight: '', judgment: '',
    // Reliability
    reliability: '',
    // Summary
    summary: '', clinicalImpression: '',
  });

  const [formStep, setFormStep] = useState(0);

  // ---------- Data ----------
  const { data, mutate } = useSWR('/api/psychiatry/mse', fetcher, { refreshInterval: 15000 });
  const exams: MSE[] = data?.exams ?? [];

  const filtered = exams.filter(
    (e) =>
      !search ||
      e.patientMasterId.toLowerCase().includes(search.toLowerCase()) ||
      (e.assessedByName || '').toLowerCase().includes(search.toLowerCase()),
  );

  // ---------- KPIs ----------
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = exams.filter((e) => e.assessedAt?.slice(0, 10) === todayStr).length;
  const uniquePatients = new Set(exams.map((e) => e.patientMasterId)).size;
  const cogScores = exams.filter((e) => e.mmseScore != null || e.mocaScore != null);
  const avgCog =
    cogScores.length > 0
      ? Math.round(cogScores.reduce((s, e) => s + (e.mmseScore ?? e.mocaScore ?? 0), 0) / cogScores.length)
      : 0;

  // ---------- Helpers ----------
  const getSummarySnippet = (e: MSE) => {
    if (e.summary) return e.summary.slice(0, 60) + (e.summary.length > 60 ? '...' : '');
    const parts: string[] = [];
    if (e.affectObserved) parts.push(e.affectObserved);
    if (e.thoughtProcess) parts.push(e.thoughtProcess);
    if (e.moodReported) parts.push(e.moodReported);
    return parts.join(', ') || '—';
  };

  // ---------- Actions ----------
  const resetForm = () => {
    setForm({
      patientMasterId: '',
      grooming: '', hygiene: '', clothing: '', build: '',
      cooperation: '', eyeContact: '', psychomotor: '', mannerisms: '',
      speechRate: '', speechVolume: '', speechTone: '', speechArticulation: '', speechSpontaneity: '',
      moodReported: '', affectObserved: '', affectCongruence: '', affectRange: '',
      thoughtProcess: '',
      suicidalIdeation: false, homicidalIdeation: false, delusions: false, obsessions: false, phobias: false,
      delusionType: '',
      hallAuditory: false, hallVisual: false, hallTactile: false, hallOlfactory: false, hallGustatory: false,
      illusions: false, derealization: false, depersonalization: false,
      orientPerson: true, orientPlace: true, orientTime: true, orientSituation: true,
      attention: '', concentration: '',
      memoryImmediate: '', memoryRecent: '', memoryRemote: '',
      mmseScore: '', mocaScore: '',
      insight: '', judgment: '', reliability: '',
      summary: '', clinicalImpression: '',
    });
    setFormStep(0);
  };

  const handleCreate = async () => {
    try {
      const payload = {
        patientMasterId: form.patientMasterId,
        appearance: {
          grooming: form.grooming || null,
          hygiene: form.hygiene || null,
          clothing: form.clothing || null,
          build: form.build || null,
        },
        behavior: {
          cooperation: form.cooperation || null,
          eyeContact: form.eyeContact || null,
          psychomotor: form.psychomotor || null,
          mannerisms: form.mannerisms || null,
        },
        speech: {
          rate: form.speechRate || null,
          volume: form.speechVolume || null,
          tone: form.speechTone || null,
          articulation: form.speechArticulation || null,
          spontaneity: form.speechSpontaneity || null,
        },
        moodReported: form.moodReported || null,
        affectObserved: form.affectObserved || null,
        affectCongruence: form.affectCongruence || null,
        affectRange: form.affectRange || null,
        thoughtProcess: form.thoughtProcess || null,
        thoughtContent: {
          suicidal: form.suicidalIdeation,
          homicidal: form.homicidalIdeation,
          delusions: form.delusions,
          obsessions: form.obsessions,
          phobias: form.phobias,
        },
        delusionType: form.delusions ? (form.delusionType || null) : null,
        perceptions: {
          hallucinations: {
            auditory: form.hallAuditory,
            visual: form.hallVisual,
            tactile: form.hallTactile,
            olfactory: form.hallOlfactory,
            gustatory: form.hallGustatory,
          },
          illusions: form.illusions,
          derealization: form.derealization,
          depersonalization: form.depersonalization,
        },
        cognition: {
          orientation: {
            person: form.orientPerson,
            place: form.orientPlace,
            time: form.orientTime,
            situation: form.orientSituation,
          },
          attention: form.attention || null,
          concentration: form.concentration || null,
          memory: {
            immediate: form.memoryImmediate || null,
            recent: form.memoryRecent || null,
            remote: form.memoryRemote || null,
          },
        },
        mmseScore: form.mmseScore ? Number(form.mmseScore) : null,
        mocaScore: form.mocaScore ? Number(form.mocaScore) : null,
        insight: form.insight || null,
        judgment: form.judgment || null,
        reliability: form.reliability || null,
        summary: form.summary || null,
        clinicalImpression: form.clinicalImpression || null,
      };

      const res = await fetch('/api/psychiatry/mse', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم إنشاء فحص الحالة النفسية', 'Mental Status Exam created') });
      setShowNewDialog(false);
      resetForm();
      mutate();
    } catch {
      toast({ title: tr('فشل في الإنشاء', 'Failed to create'), variant: 'destructive' });
    }
  };

  const FORM_STEPS = [
    tr('المظهر', 'Appearance'),
    tr('السلوك', 'Behavior'),
    tr('الكلام', 'Speech'),
    tr('المزاج والوجدان', 'Mood & Affect'),
    tr('التفكير', 'Thought'),
    tr('الإدراك', 'Perceptions'),
    tr('الإدراك المعرفي', 'Cognition'),
    tr('البصيرة والحكم', 'Insight & Judgment'),
    tr('الملخص', 'Summary'),
  ];

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div className="p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          {tr('فحص الحالة النفسية (MSE)', 'Mental Status Exam (MSE)')}
        </h1>
        <Button onClick={() => { resetForm(); setShowNewDialog(true); }} size="sm">
          <Plus className="h-4 w-4 me-1" />
          {tr('فحص جديد', 'New Exam')}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <ClipboardList className="h-3.5 w-3.5" />
              {tr('فحوصات اليوم', 'Exams Today')}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{todayCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {tr('مرضى مقيّمين', 'Patients Assessed')}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{uniquePatients}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Brain className="h-3.5 w-3.5" />
              {tr('متوسط الإدراك', 'Avg Cognition Score')}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{avgCog > 0 ? avgCog : '—'}</p></CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-3 items-center">
        <Input placeholder={tr('بحث بالمريض...', 'Search by patient...')} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>

      {/* Recent MSE List */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-start font-medium">{tr('المريض', 'Patient')}</th>
              <th className="p-3 text-start font-medium">{tr('التاريخ', 'Date')}</th>
              <th className="p-3 text-start font-medium">{tr('المقيّم', 'Assessed By')}</th>
              <th className="p-3 text-start font-medium">{tr('الوجدان', 'Affect')}</th>
              <th className="p-3 text-start font-medium">{tr('التفكير', 'Thought Process')}</th>
              <th className="p-3 text-start font-medium">{tr('MMSE', 'MMSE')}</th>
              <th className="p-3 text-start font-medium">{tr('MoCA', 'MoCA')}</th>
              <th className="p-3 text-start font-medium">{tr('البصيرة', 'Insight')}</th>
              <th className="p-3 text-start font-medium">{tr('ملخص', 'Summary')}</th>
              <th className="p-3 text-start font-medium">{tr('إجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">{tr('لا توجد فحوصات', 'No exams found')}</td></tr>
            ) : filtered.map((e) => (
              <tr key={e.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-mono text-xs">{e.patientMasterId.slice(0, 8)}...</td>
                <td className="p-3 text-xs">{new Date(e.assessedAt).toLocaleDateString()}</td>
                <td className="p-3 text-xs">{e.assessedByName || '—'}</td>
                <td className="p-3 text-xs">{e.affectObserved?.replace(/_/g, ' ') || '—'}</td>
                <td className="p-3 text-xs">{e.thoughtProcess?.replace(/_/g, ' ') || '—'}</td>
                <td className="p-3 text-xs font-medium">{e.mmseScore ?? '—'}</td>
                <td className="p-3 text-xs font-medium">{e.mocaScore ?? '—'}</td>
                <td className="p-3 text-xs">{e.insight || '—'}</td>
                <td className="p-3 text-xs max-w-[200px] truncate">{getSummarySnippet(e)}</td>
                <td className="p-3">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setSelectedMSE(e); setShowDetailDialog(true); }}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============================================================ */}
      {/* New MSE Dialog — Multi-step                                   */}
      {/* ============================================================ */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>
              {tr('فحص حالة نفسية جديد', 'New Mental Status Exam')} — {FORM_STEPS[formStep]} ({formStep + 1}/{FORM_STEPS.length})
            </DialogTitle>
          </DialogHeader>

          {/* Step indicators */}
          <div className="flex gap-1 mb-2">
            {FORM_STEPS.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded ${i <= formStep ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>

          <div className="space-y-4 min-h-[200px]">
            {/* Step 0: Appearance */}
            {formStep === 0 && (
              <>
                <div>
                  <Label>{tr('معرف المريض', 'Patient ID')}</Label>
                  <Input value={form.patientMasterId} onChange={(e) => setForm((f) => ({ ...f, patientMasterId: e.target.value }))} placeholder={tr('أدخل معرف المريض', 'Enter patient ID')} />
                </div>
                <h3 className="font-semibold text-sm">{tr('المظهر', 'Appearance')}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{tr('العناية الشخصية', 'Grooming')}</Label>
                    <Select value={form.grooming} onValueChange={(v) => setForm((f) => ({ ...f, grooming: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WELL_GROOMED">{tr('مرتب', 'Well Groomed')}</SelectItem>
                        <SelectItem value="DISHEVELED">{tr('غير مرتب', 'Disheveled')}</SelectItem>
                        <SelectItem value="UNKEMPT">{tr('مهمل', 'Unkempt')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('النظافة', 'Hygiene')}</Label>
                    <Select value={form.hygiene} onValueChange={(v) => setForm((f) => ({ ...f, hygiene: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GOOD">{tr('جيدة', 'Good')}</SelectItem>
                        <SelectItem value="FAIR">{tr('متوسطة', 'Fair')}</SelectItem>
                        <SelectItem value="POOR">{tr('ضعيفة', 'Poor')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('الملابس', 'Clothing')}</Label>
                    <Select value={form.clothing} onValueChange={(v) => setForm((f) => ({ ...f, clothing: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="APPROPRIATE">{tr('مناسبة', 'Appropriate')}</SelectItem>
                        <SelectItem value="INAPPROPRIATE">{tr('غير مناسبة', 'Inappropriate')}</SelectItem>
                        <SelectItem value="BIZARRE">{tr('غريبة', 'Bizarre')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('البنية', 'Build')}</Label>
                    <Select value={form.build} onValueChange={(v) => setForm((f) => ({ ...f, build: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="THIN">{tr('نحيف', 'Thin')}</SelectItem>
                        <SelectItem value="AVERAGE">{tr('متوسط', 'Average')}</SelectItem>
                        <SelectItem value="OVERWEIGHT">{tr('زائد الوزن', 'Overweight')}</SelectItem>
                        <SelectItem value="OBESE">{tr('بدين', 'Obese')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {/* Step 1: Behavior */}
            {formStep === 1 && (
              <>
                <h3 className="font-semibold text-sm">{tr('السلوك', 'Behavior')}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{tr('التعاون', 'Cooperation')}</Label>
                    <Select value={form.cooperation} onValueChange={(v) => setForm((f) => ({ ...f, cooperation: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="COOPERATIVE">{tr('متعاون', 'Cooperative')}</SelectItem>
                        <SelectItem value="GUARDED">{tr('حذر', 'Guarded')}</SelectItem>
                        <SelectItem value="UNCOOPERATIVE">{tr('غير متعاون', 'Uncooperative')}</SelectItem>
                        <SelectItem value="HOSTILE">{tr('عدائي', 'Hostile')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('التواصل البصري', 'Eye Contact')}</Label>
                    <Select value={form.eyeContact} onValueChange={(v) => setForm((f) => ({ ...f, eyeContact: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GOOD">{tr('جيد', 'Good')}</SelectItem>
                        <SelectItem value="INTERMITTENT">{tr('متقطع', 'Intermittent')}</SelectItem>
                        <SelectItem value="POOR">{tr('ضعيف', 'Poor')}</SelectItem>
                        <SelectItem value="AVOIDANT">{tr('تجنب', 'Avoidant')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('النشاط الحركي', 'Psychomotor Activity')}</Label>
                    <Select value={form.psychomotor} onValueChange={(v) => setForm((f) => ({ ...f, psychomotor: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NORMAL">{tr('طبيعي', 'Normal')}</SelectItem>
                        <SelectItem value="AGITATED">{tr('مهتاج', 'Agitated')}</SelectItem>
                        <SelectItem value="RETARDED">{tr('بطيء', 'Retarded')}</SelectItem>
                        <SelectItem value="RESTLESS">{tr('قلق حركي', 'Restless')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('العادات الحركية', 'Mannerisms')}</Label>
                    <Input value={form.mannerisms} onChange={(e) => setForm((f) => ({ ...f, mannerisms: e.target.value }))} placeholder={tr('ملاحظات', 'Notes')} />
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Speech */}
            {formStep === 2 && (
              <>
                <h3 className="font-semibold text-sm">{tr('الكلام', 'Speech')}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{tr('السرعة', 'Rate')}</Label>
                    <Select value={form.speechRate} onValueChange={(v) => setForm((f) => ({ ...f, speechRate: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NORMAL">{tr('طبيعي', 'Normal')}</SelectItem>
                        <SelectItem value="RAPID">{tr('سريع', 'Rapid')}</SelectItem>
                        <SelectItem value="SLOW">{tr('بطيء', 'Slow')}</SelectItem>
                        <SelectItem value="PRESSURED">{tr('مضغوط', 'Pressured')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('الصوت', 'Volume')}</Label>
                    <Select value={form.speechVolume} onValueChange={(v) => setForm((f) => ({ ...f, speechVolume: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NORMAL">{tr('طبيعي', 'Normal')}</SelectItem>
                        <SelectItem value="LOUD">{tr('عالي', 'Loud')}</SelectItem>
                        <SelectItem value="SOFT">{tr('منخفض', 'Soft')}</SelectItem>
                        <SelectItem value="WHISPERED">{tr('همس', 'Whispered')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('النغمة', 'Tone')}</Label>
                    <Select value={form.speechTone} onValueChange={(v) => setForm((f) => ({ ...f, speechTone: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NORMAL">{tr('طبيعي', 'Normal')}</SelectItem>
                        <SelectItem value="MONOTONE">{tr('رتيب', 'Monotone')}</SelectItem>
                        <SelectItem value="ANGRY">{tr('غاضب', 'Angry')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('النطق', 'Articulation')}</Label>
                    <Select value={form.speechArticulation} onValueChange={(v) => setForm((f) => ({ ...f, speechArticulation: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CLEAR">{tr('واضح', 'Clear')}</SelectItem>
                        <SelectItem value="SLURRED">{tr('متداخل', 'Slurred')}</SelectItem>
                        <SelectItem value="MUMBLED">{tr('مبهم', 'Mumbled')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('التلقائية', 'Spontaneity')}</Label>
                    <Select value={form.speechSpontaneity} onValueChange={(v) => setForm((f) => ({ ...f, speechSpontaneity: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SPONTANEOUS">{tr('تلقائي', 'Spontaneous')}</SelectItem>
                        <SelectItem value="RESPONSIVE_ONLY">{tr('استجابي فقط', 'Responsive Only')}</SelectItem>
                        <SelectItem value="MUTE">{tr('صامت', 'Mute')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Mood & Affect */}
            {formStep === 3 && (
              <>
                <h3 className="font-semibold text-sm">{tr('المزاج والوجدان', 'Mood & Affect')}</h3>
                <div className="space-y-3">
                  <div>
                    <Label>{tr('المزاج (حسب المريض)', 'Mood (Patient-reported)')}</Label>
                    <Input value={form.moodReported} onChange={(e) => setForm((f) => ({ ...f, moodReported: e.target.value }))} placeholder={tr('كما يصفه المريض', 'As described by patient')} />
                  </div>
                  <div>
                    <Label>{tr('الوجدان (الملاحظ)', 'Affect (Observed)')}</Label>
                    <Select value={form.affectObserved} onValueChange={(v) => setForm((f) => ({ ...f, affectObserved: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EUTHYMIC">{tr('سوي المزاج', 'Euthymic')}</SelectItem>
                        <SelectItem value="DYSPHORIC">{tr('مكتئب', 'Dysphoric')}</SelectItem>
                        <SelectItem value="ANXIOUS">{tr('قلق', 'Anxious')}</SelectItem>
                        <SelectItem value="IRRITABLE">{tr('عصبي', 'Irritable')}</SelectItem>
                        <SelectItem value="EUPHORIC">{tr('مبتهج', 'Euphoric')}</SelectItem>
                        <SelectItem value="FLAT">{tr('مسطح', 'Flat')}</SelectItem>
                        <SelectItem value="BLUNTED">{tr('باهت', 'Blunted')}</SelectItem>
                        <SelectItem value="LABILE">{tr('متقلب', 'Labile')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('التوافق', 'Congruence')}</Label>
                    <Select value={form.affectCongruence} onValueChange={(v) => setForm((f) => ({ ...f, affectCongruence: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CONGRUENT">{tr('متوافق', 'Congruent')}</SelectItem>
                        <SelectItem value="INCONGRUENT">{tr('غير متوافق', 'Incongruent')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('النطاق', 'Range')}</Label>
                    <Select value={form.affectRange} onValueChange={(v) => setForm((f) => ({ ...f, affectRange: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FULL">{tr('كامل', 'Full')}</SelectItem>
                        <SelectItem value="RESTRICTED">{tr('مقيد', 'Restricted')}</SelectItem>
                        <SelectItem value="BLUNTED">{tr('باهت', 'Blunted')}</SelectItem>
                        <SelectItem value="FLAT">{tr('مسطح', 'Flat')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {/* Step 4: Thought Process & Content */}
            {formStep === 4 && (
              <>
                <div>
                  <Label>{tr('مسار التفكير', 'Thought Process')}</Label>
                  <Select value={form.thoughtProcess} onValueChange={(v) => setForm((f) => ({ ...f, thoughtProcess: v }))}>
                    <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LINEAR">{tr('خطي', 'Linear')}</SelectItem>
                      <SelectItem value="CIRCUMSTANTIAL">{tr('إسهابي', 'Circumstantial')}</SelectItem>
                      <SelectItem value="TANGENTIAL">{tr('ظلي', 'Tangential')}</SelectItem>
                      <SelectItem value="LOOSE_ASSOCIATIONS">{tr('ترابط فضفاض', 'Loose Associations')}</SelectItem>
                      <SelectItem value="FLIGHT_OF_IDEAS">{tr('تطاير الأفكار', 'Flight of Ideas')}</SelectItem>
                      <SelectItem value="THOUGHT_BLOCKING">{tr('إعاقة التفكير', 'Thought Blocking')}</SelectItem>
                      <SelectItem value="PERSEVERATION">{tr('إلحاح', 'Perseveration')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <h4 className="font-semibold text-sm mt-3">{tr('محتوى التفكير', 'Thought Content')}</h4>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.suicidalIdeation} onCheckedChange={(v) => setForm((f) => ({ ...f, suicidalIdeation: !!v }))} />
                    {tr('أفكار انتحارية', 'Suicidal Ideation')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.homicidalIdeation} onCheckedChange={(v) => setForm((f) => ({ ...f, homicidalIdeation: !!v }))} />
                    {tr('أفكار قتل', 'Homicidal Ideation')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.delusions} onCheckedChange={(v) => setForm((f) => ({ ...f, delusions: !!v }))} />
                    {tr('أوهام', 'Delusions')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.obsessions} onCheckedChange={(v) => setForm((f) => ({ ...f, obsessions: !!v }))} />
                    {tr('وساوس', 'Obsessions')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.phobias} onCheckedChange={(v) => setForm((f) => ({ ...f, phobias: !!v }))} />
                    {tr('رهاب', 'Phobias')}
                  </label>
                </div>
                {form.delusions && (
                  <div>
                    <Label>{tr('نوع الوهم', 'Delusion Type')}</Label>
                    <Select value={form.delusionType} onValueChange={(v) => setForm((f) => ({ ...f, delusionType: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PARANOID">{tr('اضطهادي', 'Paranoid')}</SelectItem>
                        <SelectItem value="GRANDIOSE">{tr('عظمة', 'Grandiose')}</SelectItem>
                        <SelectItem value="SOMATIC">{tr('جسدي', 'Somatic')}</SelectItem>
                        <SelectItem value="REFERENTIAL">{tr('إسنادي', 'Referential')}</SelectItem>
                        <SelectItem value="EROTOMANIC">{tr('هوس عشقي', 'Erotomanic')}</SelectItem>
                        <SelectItem value="JEALOUS">{tr('غيرة', 'Jealous')}</SelectItem>
                        <SelectItem value="NIHILISTIC">{tr('عدمي', 'Nihilistic')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            {/* Step 5: Perceptions */}
            {formStep === 5 && (
              <>
                <h3 className="font-semibold text-sm">{tr('الإدراك', 'Perceptions')}</h3>
                <h4 className="text-sm text-muted-foreground">{tr('الهلوسات', 'Hallucinations')}</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'hallAuditory', ar: 'سمعية', en: 'Auditory' },
                    { key: 'hallVisual', ar: 'بصرية', en: 'Visual' },
                    { key: 'hallTactile', ar: 'لمسية', en: 'Tactile' },
                    { key: 'hallOlfactory', ar: 'شمية', en: 'Olfactory' },
                    { key: 'hallGustatory', ar: 'ذوقية', en: 'Gustatory' },
                  ].map((h) => (
                    <label key={h.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form[h.key as keyof typeof form] as boolean}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, [h.key]: !!v }))}
                      />
                      {tr(h.ar, h.en)}
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.illusions} onCheckedChange={(v) => setForm((f) => ({ ...f, illusions: !!v }))} />
                    {tr('أوهام حسية', 'Illusions')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.derealization} onCheckedChange={(v) => setForm((f) => ({ ...f, derealization: !!v }))} />
                    {tr('اللاواقعية', 'Derealization')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.depersonalization} onCheckedChange={(v) => setForm((f) => ({ ...f, depersonalization: !!v }))} />
                    {tr('تبدد الشخصية', 'Depersonalization')}
                  </label>
                </div>
              </>
            )}

            {/* Step 6: Cognition */}
            {formStep === 6 && (
              <>
                <h3 className="font-semibold text-sm">{tr('الإدراك المعرفي', 'Cognition')}</h3>
                <h4 className="text-sm text-muted-foreground">{tr('التوجه', 'Orientation')}</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'orientPerson', ar: 'الشخص', en: 'Person' },
                    { key: 'orientPlace', ar: 'المكان', en: 'Place' },
                    { key: 'orientTime', ar: 'الزمان', en: 'Time' },
                    { key: 'orientSituation', ar: 'الموقف', en: 'Situation' },
                  ].map((o) => (
                    <label key={o.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form[o.key as keyof typeof form] as boolean}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, [o.key]: !!v }))}
                      />
                      {tr(o.ar, o.en)}
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <Label>{tr('الانتباه', 'Attention')}</Label>
                    <Select value={form.attention} onValueChange={(v) => setForm((f) => ({ ...f, attention: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INTACT">{tr('سليم', 'Intact')}</SelectItem>
                        <SelectItem value="IMPAIRED">{tr('ضعيف', 'Impaired')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('التركيز', 'Concentration')}</Label>
                    <Select value={form.concentration} onValueChange={(v) => setForm((f) => ({ ...f, concentration: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INTACT">{tr('سليم', 'Intact')}</SelectItem>
                        <SelectItem value="IMPAIRED">{tr('ضعيف', 'Impaired')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <h4 className="text-sm text-muted-foreground mt-3">{tr('الذاكرة', 'Memory')}</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>{tr('فورية', 'Immediate')}</Label>
                    <Select value={form.memoryImmediate} onValueChange={(v) => setForm((f) => ({ ...f, memoryImmediate: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INTACT">{tr('سليم', 'Intact')}</SelectItem>
                        <SelectItem value="IMPAIRED">{tr('ضعيف', 'Impaired')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('حديثة', 'Recent')}</Label>
                    <Select value={form.memoryRecent} onValueChange={(v) => setForm((f) => ({ ...f, memoryRecent: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INTACT">{tr('سليم', 'Intact')}</SelectItem>
                        <SelectItem value="IMPAIRED">{tr('ضعيف', 'Impaired')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('بعيدة', 'Remote')}</Label>
                    <Select value={form.memoryRemote} onValueChange={(v) => setForm((f) => ({ ...f, memoryRemote: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INTACT">{tr('سليم', 'Intact')}</SelectItem>
                        <SelectItem value="IMPAIRED">{tr('ضعيف', 'Impaired')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <Label>{tr('درجة MMSE (0-30)', 'MMSE Score (0-30)')}</Label>
                    <Input type="number" min="0" max="30" value={form.mmseScore} onChange={(e) => setForm((f) => ({ ...f, mmseScore: e.target.value }))} placeholder="0-30" />
                  </div>
                  <div>
                    <Label>{tr('درجة MoCA (0-30)', 'MoCA Score (0-30)')}</Label>
                    <Input type="number" min="0" max="30" value={form.mocaScore} onChange={(e) => setForm((f) => ({ ...f, mocaScore: e.target.value }))} placeholder="0-30" />
                  </div>
                </div>
              </>
            )}

            {/* Step 7: Insight & Judgment */}
            {formStep === 7 && (
              <>
                <h3 className="font-semibold text-sm">{tr('البصيرة والحكم', 'Insight & Judgment')}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{tr('البصيرة', 'Insight')}</Label>
                    <Select value={form.insight} onValueChange={(v) => setForm((f) => ({ ...f, insight: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GOOD">{tr('جيد', 'Good')}</SelectItem>
                        <SelectItem value="FAIR">{tr('متوسط', 'Fair')}</SelectItem>
                        <SelectItem value="POOR">{tr('ضعيف', 'Poor')}</SelectItem>
                        <SelectItem value="ABSENT">{tr('غائب', 'Absent')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('الحكم', 'Judgment')}</Label>
                    <Select value={form.judgment} onValueChange={(v) => setForm((f) => ({ ...f, judgment: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GOOD">{tr('جيد', 'Good')}</SelectItem>
                        <SelectItem value="FAIR">{tr('متوسط', 'Fair')}</SelectItem>
                        <SelectItem value="POOR">{tr('ضعيف', 'Poor')}</SelectItem>
                        <SelectItem value="IMPAIRED">{tr('ضعيف', 'Impaired')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('الموثوقية', 'Reliability')}</Label>
                    <Select value={form.reliability} onValueChange={(v) => setForm((f) => ({ ...f, reliability: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GOOD">{tr('جيد', 'Good')}</SelectItem>
                        <SelectItem value="FAIR">{tr('متوسط', 'Fair')}</SelectItem>
                        <SelectItem value="POOR">{tr('ضعيف', 'Poor')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {/* Step 8: Summary */}
            {formStep === 8 && (
              <>
                <h3 className="font-semibold text-sm">{tr('الملخص والانطباع السريري', 'Summary & Clinical Impression')}</h3>
                <div>
                  <Label>{tr('الانطباع السريري', 'Clinical Impression')}</Label>
                  <Textarea value={form.clinicalImpression} onChange={(e) => setForm((f) => ({ ...f, clinicalImpression: e.target.value }))} placeholder={tr('الانطباع السريري العام', 'Overall clinical impression')} rows={3} />
                </div>
                <div>
                  <Label>{tr('الملخص', 'Summary')}</Label>
                  <Textarea value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} placeholder={tr('ملخص الفحص', 'Exam summary')} rows={3} />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>{tr('إلغاء', 'Cancel')}</Button>
            {formStep > 0 && (
              <Button variant="outline" onClick={() => setFormStep((s) => s - 1)}>{tr('السابق', 'Previous')}</Button>
            )}
            {formStep < FORM_STEPS.length - 1 ? (
              <Button onClick={() => setFormStep((s) => s + 1)} disabled={formStep === 0 && !form.patientMasterId}>
                {tr('التالي', 'Next')}
              </Button>
            ) : (
              <Button onClick={handleCreate} disabled={!form.patientMasterId}>
                {tr('إنشاء الفحص', 'Create Exam')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Detail Dialog                                                 */}
      {/* ============================================================ */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{tr('تفاصيل فحص الحالة النفسية', 'Mental Status Exam Details')}</DialogTitle>
          </DialogHeader>
          {selectedMSE && (
            <div className="space-y-4 text-sm">
              {/* Header */}
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">{tr('المريض', 'Patient')}:</span> <span className="font-mono">{selectedMSE.patientMasterId.slice(0, 12)}</span></div>
                <div><span className="text-muted-foreground">{tr('التاريخ', 'Date')}:</span> {new Date(selectedMSE.assessedAt).toLocaleString()}</div>
                <div><span className="text-muted-foreground">{tr('المقيّم', 'Assessed By')}:</span> {selectedMSE.assessedByName || '—'}</div>
              </div>

              {/* Sections */}
              {selectedMSE.appearance && (
                <Section title={tr('المظهر', 'Appearance')}>
                  <DetailGrid items={[
                    { label: tr('العناية', 'Grooming'), value: selectedMSE.appearance.grooming },
                    { label: tr('النظافة', 'Hygiene'), value: selectedMSE.appearance.hygiene },
                    { label: tr('الملابس', 'Clothing'), value: selectedMSE.appearance.clothing },
                    { label: tr('البنية', 'Build'), value: selectedMSE.appearance.build },
                  ]} />
                </Section>
              )}

              {selectedMSE.behavior && (
                <Section title={tr('السلوك', 'Behavior')}>
                  <DetailGrid items={[
                    { label: tr('التعاون', 'Cooperation'), value: selectedMSE.behavior.cooperation },
                    { label: tr('التواصل البصري', 'Eye Contact'), value: selectedMSE.behavior.eyeContact },
                    { label: tr('النشاط الحركي', 'Psychomotor'), value: selectedMSE.behavior.psychomotor },
                    { label: tr('العادات', 'Mannerisms'), value: selectedMSE.behavior.mannerisms },
                  ]} />
                </Section>
              )}

              {selectedMSE.speech && (
                <Section title={tr('الكلام', 'Speech')}>
                  <DetailGrid items={[
                    { label: tr('السرعة', 'Rate'), value: selectedMSE.speech.rate },
                    { label: tr('الصوت', 'Volume'), value: selectedMSE.speech.volume },
                    { label: tr('النغمة', 'Tone'), value: selectedMSE.speech.tone },
                    { label: tr('النطق', 'Articulation'), value: selectedMSE.speech.articulation },
                    { label: tr('التلقائية', 'Spontaneity'), value: selectedMSE.speech.spontaneity },
                  ]} />
                </Section>
              )}

              <Section title={tr('المزاج والوجدان', 'Mood & Affect')}>
                <DetailGrid items={[
                  { label: tr('المزاج', 'Mood'), value: selectedMSE.moodReported },
                  { label: tr('الوجدان', 'Affect'), value: selectedMSE.affectObserved?.replace(/_/g, ' ') },
                  { label: tr('التوافق', 'Congruence'), value: selectedMSE.affectCongruence },
                  { label: tr('النطاق', 'Range'), value: selectedMSE.affectRange },
                ]} />
              </Section>

              {selectedMSE.thoughtProcess && (
                <Section title={tr('التفكير', 'Thought')}>
                  <p><span className="text-muted-foreground">{tr('مسار التفكير', 'Process')}:</span> {selectedMSE.thoughtProcess.replace(/_/g, ' ')}</p>
                  {selectedMSE.thoughtContent && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedMSE.thoughtContent.suicidal && <Badge variant="destructive" className="text-xs">{tr('أفكار انتحارية', 'Suicidal')}</Badge>}
                      {selectedMSE.thoughtContent.homicidal && <Badge variant="destructive" className="text-xs">{tr('أفكار قتل', 'Homicidal')}</Badge>}
                      {selectedMSE.thoughtContent.delusions && <Badge variant="outline" className="text-xs">{tr('أوهام', 'Delusions')}{selectedMSE.delusionType ? ` (${selectedMSE.delusionType})` : ''}</Badge>}
                      {selectedMSE.thoughtContent.obsessions && <Badge variant="outline" className="text-xs">{tr('وساوس', 'Obsessions')}</Badge>}
                      {selectedMSE.thoughtContent.phobias && <Badge variant="outline" className="text-xs">{tr('رهاب', 'Phobias')}</Badge>}
                    </div>
                  )}
                </Section>
              )}

              {selectedMSE.perceptions && (
                <Section title={tr('الإدراك', 'Perceptions')}>
                  <div className="flex flex-wrap gap-1">
                    {selectedMSE.perceptions.hallucinations?.auditory && <Badge className="text-xs">{tr('سمعية', 'Auditory')}</Badge>}
                    {selectedMSE.perceptions.hallucinations?.visual && <Badge className="text-xs">{tr('بصرية', 'Visual')}</Badge>}
                    {selectedMSE.perceptions.hallucinations?.tactile && <Badge className="text-xs">{tr('لمسية', 'Tactile')}</Badge>}
                    {selectedMSE.perceptions.hallucinations?.olfactory && <Badge className="text-xs">{tr('شمية', 'Olfactory')}</Badge>}
                    {selectedMSE.perceptions.hallucinations?.gustatory && <Badge className="text-xs">{tr('ذوقية', 'Gustatory')}</Badge>}
                    {selectedMSE.perceptions.illusions && <Badge variant="outline" className="text-xs">{tr('أوهام حسية', 'Illusions')}</Badge>}
                    {selectedMSE.perceptions.derealization && <Badge variant="outline" className="text-xs">{tr('لاواقعية', 'Derealization')}</Badge>}
                    {selectedMSE.perceptions.depersonalization && <Badge variant="outline" className="text-xs">{tr('تبدد', 'Depersonalization')}</Badge>}
                  </div>
                </Section>
              )}

              {selectedMSE.cognition && (
                <Section title={tr('الإدراك المعرفي', 'Cognition')}>
                  <div className="space-y-1">
                    <div className="flex gap-2">
                      <span className="text-muted-foreground">{tr('التوجه', 'Orientation')}:</span>
                      {selectedMSE.cognition.orientation?.person && <Badge variant="outline" className="text-xs text-green-700">{tr('شخص', 'Person')}</Badge>}
                      {selectedMSE.cognition.orientation?.place && <Badge variant="outline" className="text-xs text-green-700">{tr('مكان', 'Place')}</Badge>}
                      {selectedMSE.cognition.orientation?.time && <Badge variant="outline" className="text-xs text-green-700">{tr('زمان', 'Time')}</Badge>}
                      {selectedMSE.cognition.orientation?.situation && <Badge variant="outline" className="text-xs text-green-700">{tr('موقف', 'Situation')}</Badge>}
                    </div>
                    <DetailGrid items={[
                      { label: tr('الانتباه', 'Attention'), value: selectedMSE.cognition.attention },
                      { label: tr('التركيز', 'Concentration'), value: selectedMSE.cognition.concentration },
                      { label: tr('ذاكرة فورية', 'Immediate Memory'), value: selectedMSE.cognition.memory?.immediate },
                      { label: tr('ذاكرة حديثة', 'Recent Memory'), value: selectedMSE.cognition.memory?.recent },
                      { label: tr('ذاكرة بعيدة', 'Remote Memory'), value: selectedMSE.cognition.memory?.remote },
                    ]} />
                    <div className="flex gap-4 mt-1">
                      {selectedMSE.mmseScore != null && <span><span className="text-muted-foreground">MMSE:</span> <strong>{selectedMSE.mmseScore}/30</strong></span>}
                      {selectedMSE.mocaScore != null && <span><span className="text-muted-foreground">MoCA:</span> <strong>{selectedMSE.mocaScore}/30</strong></span>}
                    </div>
                  </div>
                </Section>
              )}

              <Section title={tr('البصيرة والحكم', 'Insight & Judgment')}>
                <DetailGrid items={[
                  { label: tr('البصيرة', 'Insight'), value: selectedMSE.insight },
                  { label: tr('الحكم', 'Judgment'), value: selectedMSE.judgment },
                  { label: tr('الموثوقية', 'Reliability'), value: selectedMSE.reliability },
                ]} />
              </Section>

              {selectedMSE.clinicalImpression && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">{tr('الانطباع السريري', 'Clinical Impression')}</h4>
                  <p className="text-muted-foreground">{selectedMSE.clinicalImpression}</p>
                </div>
              )}
              {selectedMSE.summary && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">{tr('الملخص', 'Summary')}</h4>
                  <p className="text-muted-foreground">{selectedMSE.summary}</p>
                </div>
              )}
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

/* ------------------------------------------------------------------ */
/*  Helper sub-components                                              */
/* ------------------------------------------------------------------ */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-3">
      <h4 className="font-semibold text-sm mb-2">{title}</h4>
      {children}
    </div>
  );
}

function DetailGrid({ items }: { items: { label: string; value?: string | null }[] }) {
  const filled = items.filter((i) => i.value);
  if (filled.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-1 text-xs">
      {filled.map((item, i) => (
        <span key={i}><span className="text-muted-foreground">{item.label}:</span> {item.value?.replace(/_/g, ' ')}</span>
      ))}
    </div>
  );
}
