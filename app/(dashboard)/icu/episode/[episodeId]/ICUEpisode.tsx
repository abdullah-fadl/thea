'use client';

import { useState, type ReactNode } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useMe } from '@/lib/hooks/useMe';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TasksPanel } from '@/components/tasks/TasksPanel';
import { HandoverPanel } from '@/components/handover/HandoverPanel';
import { Wind, Droplets, Heart, Brain, CircleDot, AlertTriangle } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// SOFA organ scoring definitions
const SOFA_SYSTEMS = [
  {
    key: 'respiratory', ar: 'الجهاز التنفسي (PaO2/FiO2)', en: 'Respiratory (PaO2/FiO2)', icon: <Wind className="h-4 w-4 inline-block" /> as ReactNode,
    options: [
      { score: 0, ar: '≥ 400', en: '≥ 400' }, { score: 1, ar: '300–399', en: '300–399' },
      { score: 2, ar: '200–299', en: '200–299' }, { score: 3, ar: '100–199 + vent', en: '100–199 + vent' },
      { score: 4, ar: '< 100 + vent', en: '< 100 + vent' },
    ],
  },
  {
    key: 'coagulation', ar: 'التخثر (PLT ×10³)', en: 'Coagulation (PLT ×10³)', icon: <Droplets className="h-4 w-4 inline-block" /> as ReactNode,
    options: [
      { score: 0, ar: '≥ 150', en: '≥ 150' }, { score: 1, ar: '100–149', en: '100–149' },
      { score: 2, ar: '50–99', en: '50–99' }, { score: 3, ar: '20–49', en: '20–49' },
      { score: 4, ar: '< 20', en: '< 20' },
    ],
  },
  {
    key: 'liver', ar: 'الكبد (Bilirubin mg/dL)', en: 'Liver (Bilirubin mg/dL)', icon: <Heart className="h-4 w-4 inline-block" /> as ReactNode,
    options: [
      { score: 0, ar: '< 1.2', en: '< 1.2' }, { score: 1, ar: '1.2–1.9', en: '1.2–1.9' },
      { score: 2, ar: '2.0–5.9', en: '2.0–5.9' }, { score: 3, ar: '6.0–11.9', en: '6.0–11.9' },
      { score: 4, ar: '≥ 12.0', en: '≥ 12.0' },
    ],
  },
  {
    key: 'cardiovascular', ar: 'القلب والأوعية (MAP / ضاغطات)', en: 'Cardiovascular (MAP / Vasopressors)', icon: <Heart className="h-4 w-4 inline-block text-red-500" /> as ReactNode,
    options: [
      { score: 0, ar: 'MAP ≥ 70', en: 'MAP ≥ 70' }, { score: 1, ar: 'MAP < 70', en: 'MAP < 70' },
      { score: 2, ar: 'دوبامين ≤5 أو دوبوتامين', en: 'Dopamine ≤5 or Dobutamine' },
      { score: 3, ar: 'دوبامين >5 أو أدرينالين ≤0.1', en: 'Dopamine >5 or Epi ≤0.1' },
      { score: 4, ar: 'دوبامين >15 أو أدرينالين >0.1', en: 'Dopamine >15 or Epi >0.1' },
    ],
  },
  {
    key: 'cns', ar: 'الجهاز العصبي (GCS)', en: 'CNS (GCS)', icon: <Brain className="h-4 w-4 inline-block" /> as ReactNode,
    options: [
      { score: 0, ar: 'GCS 15', en: 'GCS 15' }, { score: 1, ar: 'GCS 13–14', en: 'GCS 13–14' },
      { score: 2, ar: 'GCS 10–12', en: 'GCS 10–12' }, { score: 3, ar: 'GCS 6–9', en: 'GCS 6–9' },
      { score: 4, ar: 'GCS < 6', en: 'GCS < 6' },
    ],
  },
  {
    key: 'renal', ar: 'الكلى (Creatinine μmol/L)', en: 'Renal (Creatinine μmol/L)', icon: <CircleDot className="h-4 w-4 inline-block" /> as ReactNode,
    options: [
      { score: 0, ar: '< 110', en: '< 110' }, { score: 1, ar: '110–170', en: '110–170' },
      { score: 2, ar: '171–299', en: '171–299' }, { score: 3, ar: '300–440 / UO < 500', en: '300–440 / UO < 500' },
      { score: 4, ar: '> 440 / UO < 200', en: '> 440 / UO < 200' },
    ],
  },
];

// RASS scale
const RASS_LEVELS = [
  { score: 4,  ar: 'هيجان شديد',    en: 'Combative',        color: 'bg-red-700 text-white',    desc: 'عنيف، خطر فوري',            descEn: 'Violent, immediate danger' },
  { score: 3,  ar: 'هياج شديد',     en: 'Very Agitated',    color: 'bg-red-600 text-white',    desc: 'يسحب الأنابيب، عدواني',      descEn: 'Pulls tubes, aggressive' },
  { score: 2,  ar: 'هياج',          en: 'Agitated',         color: 'bg-orange-500 text-white', desc: 'حركة متكررة، يقاوم المنفسة', descEn: 'Frequent movement, fights vent' },
  { score: 1,  ar: 'حركة زائدة',    en: 'Restless',         color: 'bg-amber-500 text-white',  desc: 'قلق خفيف، متحرك',           descEn: 'Anxious, apprehensive' },
  { score: 0,  ar: 'متيقظ هادئ',    en: 'Alert & Calm',     color: 'bg-green-600 text-white',  desc: 'هادئ ومتفاعل',              descEn: 'Alert and calm' },
  { score: -1, ar: 'خواء طفيف',     en: 'Drowsy',           color: 'bg-teal-500 text-white',   desc: 'يستيقظ بالصوت',             descEn: 'Briefly awakens to voice (>10s)' },
  { score: -2, ar: 'خواء خفيف',     en: 'Light Sedation',   color: 'bg-blue-500 text-white',   desc: 'يفتح العينين للحظات بالصوت', descEn: 'Awakens to voice (<10s)' },
  { score: -3, ar: 'خواء معتدل',    en: 'Moderate Sedation', color: 'bg-blue-600 text-white',  desc: 'حركة/فتح عيون للصوت بدون تواصل', descEn: 'Eye opening to voice, no gaze' },
  { score: -4, ar: 'خواء عميق',     en: 'Deep Sedation',    color: 'bg-indigo-600 text-white', desc: 'لا يستجيب للصوت لكن للمس',   descEn: 'No response to voice, moves to touch' },
  { score: -5, ar: 'عدم استجابة',   en: 'Unarousable',      color: 'bg-gray-700 text-white',   desc: 'لا استجابة للصوت أو اللمس',  descEn: 'No response to voice or physical' },
];

function sofaRisk(total: number) {
  if (total >= 11) return { ar: 'عالي جداً (>50%)', en: 'Very High (>50%)', color: 'bg-red-600 text-white' };
  if (total >= 7)  return { ar: 'عالي (>40%)',       en: 'High (>40%)',      color: 'bg-orange-600 text-white' };
  if (total >= 4)  return { ar: 'متوسط (~25%)',      en: 'Moderate (~25%)',  color: 'bg-amber-500 text-white' };
  return { ar: 'منخفض (<10%)', en: 'Low (<10%)', color: 'bg-green-600 text-white' };
}

type TabKey = 'summary' | 'sofa' | 'sedation' | 'vitals' | 'notes' | 'transfer';

export default function ICUEpisode(props: any) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const { me } = useMe();
  const { hasPermission, isLoading: permLoading } = useRoutePermission('/icu/episode');
  const isDoctor = ['doctor', 'physician'].some((r) => String(me?.user?.role || '').toLowerCase().includes(r));

  const episodeId = String(props?.params?.episodeId || '').trim();
  const [activeTab, setActiveTab] = useState<TabKey>('summary');

  const { data: summaryData } = useSWR(episodeId ? `/api/icu/episodes/${episodeId}/summary` : null, fetcher);
  const episode = summaryData?.episode || null;
  const encounterCoreId = String(episode?.encounterId || '');

  const { data: icuEventsData, mutate: mutateIcuEvents } = useSWR(
    episodeId ? `/api/icu/episodes/${episodeId}/events` : null, fetcher
  );
  const icuEvents: any[] = icuEventsData?.items || [];
  const latestEvent = icuEvents.length ? icuEvents[icuEvents.length - 1] : null;

  const { data: sofaData, mutate: mutateSofa } = useSWR(
    episodeId ? `/api/icu/episodes/${episodeId}/sofa` : null, fetcher, { revalidateOnFocus: false }
  );
  const sofaScores: any[] = sofaData?.scores || [];
  const latestSofa = sofaScores.length ? sofaScores[0] : null;

  const { data: vitalsData } = useSWR(episodeId ? `/api/ipd/episodes/${episodeId}/vitals` : null, fetcher);
  const vitals: any[] = vitalsData?.items || [];

  const notesUrl = encounterCoreId ? `/api/clinical-notes?encounterCoreId=${encodeURIComponent(encounterCoreId)}` : null;
  const { data: notesData, mutate: mutateNotes } = useSWR(notesUrl, fetcher);
  const notes: any[] = notesData?.items || [];

  // SOFA form
  const [sofaForm, setSofaForm] = useState<Record<string, number>>({
    respiratory: 0, coagulation: 0, liver: 0, cardiovascular: 0, cns: 0, renal: 0,
  });
  const [sofaNotes, setSofaNotes] = useState('');
  const [savingSofa, setSavingSofa] = useState(false);
  const sofaTotal = Object.values(sofaForm).reduce((s, v) => s + v, 0);

  // RASS / Sedation
  const [rassScore, setRassScore] = useState(0);
  const [rassTarget, setRassTarget] = useState(-2);
  const [rassNotes, setRassNotes] = useState('');
  const [sedationDrug, setSedationDrug] = useState('');
  const [sedationDose, setSedationDose] = useState('');
  const [savingRass, setSavingRass] = useState(false);

  // Admit / Transfer
  const [admitSource, setAdmitSource] = useState<'OR' | 'ER' | 'IPD'>('IPD');
  const [admitNote, setAdmitNote] = useState('');
  const [admitBusy, setAdmitBusy] = useState(false);
  const [transferDest, setTransferDest] = useState<'WARD' | 'ICU' | 'DISCHARGE' | ''>('');
  const [transferNote, setTransferNote] = useState('');
  const [transferBusy, setTransferBusy] = useState(false);

  // Doctor notes
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);

  const handleSaveSofa = async () => {
    setSavingSofa(true);
    try {
      const res = await fetch(`/api/icu/episodes/${episodeId}/sofa`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sofaForm, notes: sofaNotes.trim() || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || tr('فشل الحفظ', 'Failed'));
      toast({ title: tr('تم حفظ SOFA', 'SOFA saved') });
      setSofaNotes('');
      await mutateSofa();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message, variant: 'destructive' });
    } finally {
      setSavingSofa(false);
    }
  };

  const handleSaveRass = async () => {
    setSavingRass(true);
    try {
      const res = await fetch(`/api/ipd/episodes/${episodeId}/nursing-assessments`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rassScore, rassTarget, rassNotes: rassNotes.trim() || null,
          sedationDrug: sedationDrug.trim() || null,
          sedationDose: sedationDose.trim() || null,
          assessmentType: 'RASS',
        }),
      });
      if (!res.ok) throw new Error(tr('فشل الحفظ', 'Failed'));
      toast({ title: tr('تم حفظ RASS', 'RASS saved') });
      setRassNotes(''); setSedationDrug(''); setSedationDose('');
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message, variant: 'destructive' });
    } finally {
      setSavingRass(false);
    }
  };

  const admitToIcu = async () => {
    setAdmitBusy(true);
    try {
      const res = await fetch(`/api/icu/episodes/${episodeId}/admit`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: admitSource, note: admitNote.trim() || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || tr('فشل', 'Failed'));
      toast({ title: json.noOp ? tr('لا تغيير', 'No change') : tr('تم القبول في العناية المركزة', 'Admitted to ICU') });
      setAdmitNote('');
      await mutateIcuEvents();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message, variant: 'destructive' });
    } finally {
      setAdmitBusy(false);
    }
  };

  const transferFromIcu = async () => {
    if (!transferDest) return;
    setTransferBusy(true);
    try {
      const res = await fetch(`/api/icu/episodes/${episodeId}/transfer`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: transferDest, note: transferNote.trim() || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || tr('فشل', 'Failed'));
      toast({ title: json.noOp ? tr('لا تغيير', 'No change') : tr('تم تسجيل النقل', 'Transfer recorded') });
      setTransferNote('');
      await mutateIcuEvents();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message, variant: 'destructive' });
    } finally {
      setTransferBusy(false);
    }
  };

  const saveNote = async () => {
    if (!encounterCoreId || !noteContent.trim()) {
      toast({ title: tr('مطلوب', 'Required'), description: tr('المحتوى مطلوب', 'Note content required'), variant: 'destructive' });
      return;
    }
    setNoteBusy(true);
    try {
      const res = await fetch('/api/clinical-notes', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientMasterId: String(episode?.patient?.id || episode?.patientMasterId || ''),
          encounterCoreId, area: 'ICU', noteType: 'IPD_DAILY',
          title: noteTitle.trim() || tr('ملاحظة يومية عناية مركزة', 'ICU Daily Note'),
          content: noteContent.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || tr('فشل', 'Failed'));
      toast({ title: tr('تم الحفظ', 'Saved') });
      setNoteTitle(''); setNoteContent('');
      await mutateNotes();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message, variant: 'destructive' });
    } finally {
      setNoteBusy(false);
    }
  };

  if (permLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  const TABS: Array<{ key: TabKey; ar: string; en: string }> = [
    { key: 'summary',  ar: 'ملخص المريض',     en: 'Summary' },
    { key: 'sofa',     ar: 'نقاط SOFA',        en: 'SOFA Score' },
    { key: 'sedation', ar: 'التخدير / RASS',    en: 'Sedation / RASS' },
    { key: 'vitals',   ar: 'العلامات الحيوية',  en: 'Vitals' },
    { key: 'notes',    ar: 'الملاحظات الطبية', en: 'Clinical Notes' },
    { key: 'transfer', ar: 'القبول والنقل',      en: 'Admit / Transfer' },
  ];

  const risk = sofaRisk(sofaTotal);

  return (
    <div className="p-4 md:p-6 space-y-4 bg-background" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Episode Header */}
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-foreground">{tr('قضية العناية المركزة', 'ICU Episode')}</CardTitle>
              <CardDescription>
                {episode?.patient?.fullName || '—'} · {tr('المعرف', 'ID')}: {episodeId.slice(0, 8)}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {latestEvent && <Badge variant="secondary">{latestEvent.destination || latestEvent.type}</Badge>}
              {latestSofa && (
                <Badge className={sofaRisk(latestSofa.totalScore).color}>
                  SOFA {latestSofa.totalScore}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        {episode && (
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm pt-0">
            {[
              { label: tr('المريض', 'Patient'), value: episode.patient?.fullName || '—' },
              { label: tr('سبب القبول', 'Admission'), value: episode.reasonForAdmission || '—' },
              { label: tr('الجناح/السرير', 'Bed'), value: [episode.location?.unit, episode.location?.bed].filter(Boolean).join(' – ') || '—' },
              { label: tr('تاريخ القبول', 'Admitted'), value: episode.createdAt ? new Date(episode.createdAt).toLocaleDateString() : '—' },
            ].map((item, i) => (
              <div key={i}>
                <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
                <p className="font-medium text-foreground truncate">{item.value}</p>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto pb-px">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40'
            }`}
          >
            {tr(tab.ar, tab.en)}
          </button>
        ))}
      </div>

      {/* ─── Summary ─── */}
      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground">{tr('أحداث العناية المركزة', 'ICU Events')}</CardTitle>
            </CardHeader>
            <CardContent>
              {icuEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">{tr('لا أحداث', 'No events yet')}</p>
              ) : (
                <div className="space-y-2">
                  {[...icuEvents].reverse().slice(0, 5).map((ev: any) => (
                    <div key={ev.id} className="flex items-center justify-between text-sm">
                      <Badge variant="outline">{ev.type}</Badge>
                      <span className="text-muted-foreground text-xs">
                        {ev.createdAt ? new Date(ev.createdAt).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground">{tr('آخر SOFA', 'Latest SOFA')}</CardTitle>
            </CardHeader>
            <CardContent>
              {latestSofa ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-foreground">{latestSofa.totalScore}</span>
                    <Badge className={sofaRisk(latestSofa.totalScore).color}>
                      {tr(sofaRisk(latestSofa.totalScore).ar, sofaRisk(latestSofa.totalScore).en)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(latestSofa.scoredAt).toLocaleString()}</p>
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    {['respiratory', 'coagulation', 'liver', 'cardiovascular', 'cns', 'renal'].map((k) => (
                      <span key={k} className={`px-1.5 py-0.5 rounded text-center ${latestSofa[k] >= 3 ? 'bg-red-100 text-red-800 dark:bg-red-900/20' : 'bg-muted text-muted-foreground'}`}>
                        {k.slice(0, 4).toUpperCase()}: {latestSofa[k]}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{tr('لم يُسجَّل بعد', 'Not recorded yet')}</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground">{tr('آخر علامات حيوية', 'Latest Vitals')}</CardTitle>
            </CardHeader>
            <CardContent>
              {vitals.length > 0 ? (
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[
                    { label: 'BP', value: `${vitals[0]?.vitals?.systolic || '—'}/${vitals[0]?.vitals?.diastolic || '—'}` },
                    { label: 'HR', value: String(vitals[0]?.vitals?.hr || '—') },
                    { label: 'RR', value: String(vitals[0]?.vitals?.rr || '—') },
                    { label: 'Temp', value: String(vitals[0]?.vitals?.temp || '—') },
                    { label: 'SpO2', value: `${vitals[0]?.vitals?.spo2 || '—'}%` },
                    { label: 'Glucose', value: String(vitals[0]?.vitals?.glucose || '—') },
                  ].map((v, i) => (
                    <div key={i} className="bg-muted/50 rounded p-1.5">
                      <p className="text-muted-foreground">{v.label}</p>
                      <p className="font-bold text-foreground">{v.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{tr('لا علامات حيوية', 'No vitals recorded')}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── SOFA Score ─── */}
      {activeTab === 'sofa' && (
        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-foreground">{tr('تسجيل نقاط SOFA جديدة', 'Record New SOFA Score')}</CardTitle>
              <CardDescription>{tr('تقييم فشل الأعضاء المتسلسل', 'Sequential Organ Failure Assessment')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {SOFA_SYSTEMS.map((sys) => (
                  <div key={sys.key} className="border border-border rounded-xl p-3">
                    <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                      {sys.icon} {tr(sys.ar, sys.en)}
                    </p>
                    <div className="space-y-1">
                      {sys.options.map((opt) => (
                        <button
                          key={opt.score}
                          onClick={() => setSofaForm((prev) => ({ ...prev, [sys.key]: opt.score }))}
                          className={`w-full text-left text-xs px-2 py-1.5 rounded border transition-all flex items-center gap-2 ${
                            sofaForm[sys.key] === opt.score
                              ? opt.score >= 3 ? 'bg-red-600 text-white border-red-600'
                                : opt.score >= 2 ? 'bg-orange-500 text-white border-orange-500'
                                : opt.score >= 1 ? 'bg-amber-500 text-white border-amber-500'
                                : 'bg-green-600 text-white border-green-600'
                              : 'bg-background text-muted-foreground border-border hover:bg-muted'
                          }`}
                        >
                          <span className="font-bold w-3">{opt.score}</span>
                          <span>{tr(opt.ar, opt.en)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total + Risk */}
              <div className="flex items-center gap-4 p-4 border border-border rounded-xl bg-muted/30 flex-wrap">
                <div>
                  <p className="text-xs text-muted-foreground">{tr('المجموع', 'Total Score')}</p>
                  <p className="text-4xl font-bold text-foreground">{sofaTotal}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tr('خطر الوفاة', 'Mortality Risk')}</p>
                  <Badge className={risk.color}>{tr(risk.ar, risk.en)}</Badge>
                </div>
                <div className="flex-1 min-w-[120px]">
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        sofaTotal >= 11 ? 'bg-red-600' : sofaTotal >= 7 ? 'bg-orange-500' : sofaTotal >= 4 ? 'bg-amber-500' : 'bg-green-600'
                      }`}
                      style={{ width: `${Math.min(100, (sofaTotal / 24) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{sofaTotal} / 24</p>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-foreground">{tr('ملاحظات (اختياري)', 'Notes (optional)')}</Label>
                <Textarea value={sofaNotes} onChange={(e) => setSofaNotes(e.target.value)} className="thea-input-focus" rows={2} />
              </div>
              <Button onClick={handleSaveSofa} disabled={savingSofa}>
                {savingSofa ? tr('جارٍ الحفظ...', 'Saving...') : tr('حفظ نقاط SOFA', 'Save SOFA Score')}
              </Button>
            </CardContent>
          </Card>

          {/* SOFA History */}
          {sofaScores.length > 0 && (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-foreground">{tr('سجل نقاط SOFA', 'SOFA Score History')}</CardTitle>
              </CardHeader>
              <CardContent>
                {sofaScores.length >= 2 && (
                  <div className="mb-4 pb-4 border-b border-border">
                    <p className="text-xs text-muted-foreground mb-2">{tr('اتجاه SOFA (أحدث → أقدم)', 'SOFA Trend (newest → oldest)')}</p>
                    <div className="flex items-end gap-1.5 h-16">
                      {sofaScores.slice(0, 10).reverse().map((s: any, i: number) => (
                        <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
                          <div
                            className={`w-full rounded-t transition-all ${s.totalScore >= 11 ? 'bg-red-600' : s.totalScore >= 7 ? 'bg-orange-500' : s.totalScore >= 4 ? 'bg-amber-500' : 'bg-green-600'}`}
                            style={{ height: `${Math.max(4, (s.totalScore / 24) * 60)}px` }}
                          />
                          <span className="text-[9px] text-muted-foreground">{s.totalScore}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-3 text-muted-foreground">{tr('التاريخ', 'Date')}</th>
                        {['Resp', 'Coag', 'Liver', 'Cardio', 'CNS', 'Renal'].map((h) => (
                          <th key={h} className="text-center py-2 px-2 text-muted-foreground">{h}</th>
                        ))}
                        <th className="text-center py-2 px-2 text-foreground font-bold">{tr('المجموع', 'Total')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sofaScores.map((s: any) => (
                        <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                            {new Date(s.scoredAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </td>
                          {['respiratory', 'coagulation', 'liver', 'cardiovascular', 'cns', 'renal'].map((k) => (
                            <td key={k} className={`text-center py-2 px-2 font-medium ${s[k] >= 3 ? 'text-red-600' : s[k] >= 2 ? 'text-orange-500' : s[k] >= 1 ? 'text-amber-500' : 'text-green-600'}`}>
                              {s[k]}
                            </td>
                          ))}
                          <td className="text-center py-2 px-2">
                            <Badge className={sofaRisk(s.totalScore).color}>{s.totalScore}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ─── Sedation / RASS ─── */}
      {activeTab === 'sedation' && (
        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-foreground">{tr('تقييم التخدير — RASS', 'Sedation Assessment — RASS')}</CardTitle>
              <CardDescription>{tr('مقياس ريتشموند للهياج والتخدير', 'Richmond Agitation-Sedation Scale')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground mb-2">{tr('درجة RASS الحالية', 'Current RASS Score')}</p>
                <div className="space-y-1">
                  {RASS_LEVELS.map((level) => (
                    <button
                      key={level.score}
                      onClick={() => setRassScore(level.score)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left border transition-all ${
                        rassScore === level.score ? `${level.color} border-transparent` : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <span className={`w-8 text-center font-bold text-sm ${rassScore === level.score ? 'text-white' : 'text-foreground'}`}>
                        {level.score > 0 ? `+${level.score}` : level.score}
                      </span>
                      <span className={`font-medium text-sm flex-1 ${rassScore === level.score ? 'text-white' : 'text-foreground'}`}>
                        {tr(level.ar, level.en)}
                      </span>
                      <span className={`text-xs ${rassScore === level.score ? 'text-white/80' : 'text-muted-foreground'}`}>
                        {tr(level.desc, level.descEn)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-foreground">{tr('هدف RASS المستهدف', 'Target RASS')}</Label>
                <Select value={String(rassTarget)} onValueChange={(v) => setRassTarget(Number(v))}>
                  <SelectTrigger className="thea-input-focus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RASS_LEVELS.map((l) => (
                      <SelectItem key={l.score} value={String(l.score)}>
                        {l.score > 0 ? `+${l.score}` : l.score} — {tr(l.ar, l.en)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {rassScore !== rassTarget && (
                  <p className={`text-xs mt-1 flex items-center gap-1 ${Math.abs(rassScore - rassTarget) > 2 ? 'text-red-600' : 'text-amber-600'}`}>
                    <AlertTriangle className="h-3 w-3" /> {tr('المريض خارج الهدف بـ', 'Patient is')} {Math.abs(rassScore - rassTarget)} {tr('درجات', 'points off target')}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-foreground">{tr('دواء التخدير', 'Sedation Drug')}</Label>
                  <Input value={sedationDrug} onChange={(e) => setSedationDrug(e.target.value)}
                    placeholder={tr('مثال: برووفول، ميدازولام', 'e.g., Propofol, Midazolam')} className="thea-input-focus" />
                </div>
                <div className="space-y-1">
                  <Label className="text-foreground">{tr('الجرعة', 'Dose')}</Label>
                  <Input value={sedationDose} onChange={(e) => setSedationDose(e.target.value)}
                    placeholder="e.g., 1–4 mg/kg/hr" className="thea-input-focus" />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-foreground">{tr('ملاحظات التخدير', 'Sedation Notes')}</Label>
                <Textarea value={rassNotes} onChange={(e) => setRassNotes(e.target.value)} className="thea-input-focus" rows={3}
                  placeholder={tr('خطة التخدير، تعديلات الجرعة...', 'Sedation plan, dose adjustments...')} />
              </div>

              <Button onClick={handleSaveRass} disabled={savingRass}>
                {savingRass ? tr('جارٍ الحفظ...', 'Saving...') : tr('حفظ تقييم RASS', 'Save RASS Assessment')}
              </Button>
            </CardContent>
          </Card>

          {/* Reference table */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground">{tr('أدوية التخدير الشائعة في العناية المركزة', 'Common ICU Sedation Agents')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {[
                  { drug: 'Propofol', ar: 'برووفول', dose: '0.3–4 mg/kg/hr', noteAr: 'سريع التأثير — مراقبة الدهون', noteEn: 'Fast on/off — lipid watch' },
                  { drug: 'Midazolam', ar: 'ميدازولام', dose: '0.02–0.1 mg/kg/hr', noteAr: 'تراكم في الفشل الكلوي', noteEn: 'Caution: accumulation in renal failure' },
                  { drug: 'Dexmedetomidine', ar: 'ديكسميديتوميدين', dose: '0.2–0.7 mcg/kg/hr', noteAr: 'تخدير مع تعاون المريض', noteEn: 'Cooperative sedation' },
                  { drug: 'Ketamine', ar: 'كيتامين', dose: '0.1–0.5 mg/kg/hr', noteAr: 'موسع شعبي، مستقر للدورة', noteEn: 'Bronchodilator, hemostable' },
                  { drug: 'Fentanyl', ar: 'فنتانيل', dose: '25–200 mcg/hr', noteAr: 'مسكن أساسي (A1C)', noteEn: 'Analgesia first (A1C)' },
                  { drug: 'Morphine', ar: 'مورفين', dose: '2–30 mg/hr', noteAr: 'حذر في فشل الكلى', noteEn: 'Caution renal failure' },
                ].map((item, i) => (
                  <div key={i} className="border border-border rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-medium text-foreground">{item.drug}</span>
                      <span className="text-muted-foreground">{item.dose}</span>
                    </div>
                    <p className="text-muted-foreground">{tr(item.noteAr, item.noteEn)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Vitals ─── */}
      {activeTab === 'vitals' && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-foreground">{tr('سجل العلامات الحيوية', 'Vitals Record')}</CardTitle>
          </CardHeader>
          <CardContent>
            {vitals.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {[tr('الوقت', 'Time'), 'BP', 'HR', 'RR', 'Temp', 'SpO2', 'Glucose'].map((h) => (
                        <th key={h} className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vitals.map((v: any) => (
                      <tr key={v.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3 text-xs text-muted-foreground">{v.recordedAt ? new Date(v.recordedAt).toLocaleString() : '—'}</td>
                        <td className="py-2 px-3">{v.vitals?.systolic || '—'}/{v.vitals?.diastolic || '—'}</td>
                        <td className="py-2 px-3">{v.vitals?.hr || '—'}</td>
                        <td className="py-2 px-3">{v.vitals?.rr || '—'}</td>
                        <td className="py-2 px-3">{v.vitals?.temp || '—'}</td>
                        <td className="py-2 px-3">{v.vitals?.spo2 ? `${v.vitals.spo2}%` : '—'}</td>
                        <td className="py-2 px-3">{v.vitals?.glucose || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">{tr('لا توجد علامات حيوية', 'No vitals recorded')}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Clinical Notes ─── */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          {isDoctor && (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-foreground">{tr('إضافة ملاحظة طبية', 'Add Clinical Note')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-foreground">{tr('العنوان', 'Title')}</Label>
                  <Input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder={tr('ملاحظة يومية عناية مركزة', 'ICU Daily Note')} className="thea-input-focus" />
                </div>
                <div className="space-y-1">
                  <Label className="text-foreground">{tr('المحتوى', 'Content')}</Label>
                  <Textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} className="thea-input-focus" rows={5} />
                </div>
                <Button onClick={saveNote} disabled={noteBusy}>
                  {noteBusy ? tr('جارٍ الحفظ...', 'Saving...') : tr('حفظ الملاحظة', 'Save Note')}
                </Button>
              </CardContent>
            </Card>
          )}
          {notes.length > 0 ? (
            <div className="space-y-3">
              {notes.map((n: any) => (
                <Card key={n.id} className="rounded-2xl">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm text-foreground">{n.title || tr('ملاحظة', 'Note')}</CardTitle>
                      <span className="text-xs text-muted-foreground">{n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{n.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-2xl">
              <CardContent className="py-6 text-center text-muted-foreground text-sm">
                {tr('لا توجد ملاحظات بعد', 'No notes yet')}
              </CardContent>
            </Card>
          )}
          {encounterCoreId && <TasksPanel encounterCoreId={encounterCoreId} />}
          <HandoverPanel encounterCoreId={encounterCoreId} episodeId={episodeId} />
        </div>
      )}

      {/* ─── Admit / Transfer ─── */}
      {activeTab === 'transfer' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-foreground">{tr('قبول في العناية المركزة', 'ICU Admission')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-foreground">{tr('المصدر', 'Source')}</Label>
                  <Select value={admitSource} onValueChange={(v: any) => setAdmitSource(v)}>
                    <SelectTrigger className="thea-input-focus"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(['OR', 'ER', 'IPD'] as const).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-foreground">{tr('ملاحظة (اختياري)', 'Note (optional)')}</Label>
                  <Input value={admitNote} onChange={(e) => setAdmitNote(e.target.value)} className="thea-input-focus" />
                </div>
                <Button onClick={admitToIcu} disabled={admitBusy || !episodeId}>
                  {admitBusy ? tr('جارٍ...', 'Admitting...') : tr('قبول في العناية المركزة', 'Admit to ICU')}
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-foreground">{tr('نقل / خروج من العناية المركزة', 'ICU Transfer / Discharge')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-foreground">{tr('الوجهة', 'Destination')}</Label>
                  <Select value={transferDest} onValueChange={(v: any) => setTransferDest(v)}>
                    <SelectTrigger className="thea-input-focus">
                      <SelectValue placeholder={tr('اختر الوجهة', 'Select destination')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WARD">{tr('الجناح', 'Ward')}</SelectItem>
                      <SelectItem value="ICU">{tr('عناية مركزة أخرى', 'Other ICU')}</SelectItem>
                      <SelectItem value="DISCHARGE">{tr('خروج', 'Discharge')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-foreground">{tr('ملاحظة (اختياري)', 'Note (optional)')}</Label>
                  <Input value={transferNote} onChange={(e) => setTransferNote(e.target.value)} className="thea-input-focus" />
                </div>
                <Button onClick={transferFromIcu} disabled={transferBusy || !transferDest}>
                  {transferBusy ? tr('جارٍ...', 'Processing...') : tr('تسجيل النقل', 'Record Transfer')}
                </Button>
              </CardContent>
            </Card>
          </div>

          {icuEvents.length > 0 && (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-sm text-foreground">{tr('سجل الأحداث', 'Event History')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...icuEvents].reverse().map((ev: any) => (
                    <div key={ev.id} className="flex items-center gap-3 text-sm py-1 border-b border-border/50 flex-wrap">
                      <Badge variant="outline">{ev.type}</Badge>
                      {ev.source && <span className="text-muted-foreground">{tr('من', 'from')} {ev.source}</span>}
                      {ev.destination && <span className="text-muted-foreground">{tr('إلى', 'to')} {ev.destination}</span>}
                      {ev.note && <span className="text-muted-foreground truncate max-w-xs">{ev.note}</span>}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
