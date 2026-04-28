'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  ShieldAlert,
  Plus,
  Activity,
  BarChart3,
  Grid3X3,
  AlertTriangle,
  HandMetal,
  Pill,
} from 'lucide-react';

/* ── Lazy tab components ─────────────────────────────────────────────── */
import SurveillanceTab from '@/components/infection-control/SurveillanceTab';
import HAIRatesTab from '@/components/infection-control/HAIRatesTab';
import AntibiogramTab from '@/components/infection-control/AntibiogramTab';
import OutbreaksTab from '@/components/infection-control/OutbreaksTab';
import HandHygieneTab from '@/components/infection-control/HandHygieneTab';
import StewardshipTab from '@/components/infection-control/StewardshipTab';

/* ── Constants ───────────────────────────────────────────────────────── */
const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

const INFECTION_TYPES: Record<string, { ar: string; en: string }> = {
  SSI:       { ar: 'عدوى موضع الجراحة',               en: 'Surgical Site Infection' },
  CAUTI:     { ar: 'عدوى بولية مرتبطة بقثطرة',         en: 'CAUTI' },
  CLABSI:    { ar: 'عدوى دموية مركزية',                en: 'CLABSI' },
  VAP:       { ar: 'التهاب رئوي بالتنفس الاصطناعي',    en: 'VAP' },
  CDIFF:     { ar: 'كلوستريديوم ديفيسيل',              en: 'C. difficile' },
  MRSA:      { ar: 'مرسا',                             en: 'MRSA' },
  VRE:       { ar: 'المكورات المعوية المقاومة',         en: 'VRE' },
  OTHER_HAI: { ar: 'عدوى أخرى',                       en: 'Other HAI' },
};

const ISOLATION_PRECAUTIONS = [
  { value: 'CONTACT',    ar: 'تلامسي',  en: 'Contact' },
  { value: 'DROPLET',    ar: 'قطيرات',  en: 'Droplet' },
  { value: 'AIRBORNE',   ar: 'هوائي',   en: 'Airborne' },
  { value: 'PROTECTIVE', ar: 'وقائي',   en: 'Protective' },
];

const ISOLATION_BADGE_COLORS: Record<string, string> = {
  CONTACT:    'bg-yellow-100 text-yellow-800 border-yellow-200',
  DROPLET:    'bg-blue-100 text-blue-800 border-blue-200',
  AIRBORNE:   'bg-red-100 text-red-800 border-red-200',
  PROTECTIVE: 'bg-green-100 text-green-800 border-green-200',
};

const OUTCOME_OPTIONS: Record<string, { ar: string; en: string }> = {
  ACTIVE:      { ar: 'نشط',   en: 'Active' },
  RESOLVED:    { ar: 'تعافى', en: 'Resolved' },
  TRANSFERRED: { ar: 'محول',  en: 'Transferred' },
  DECEASED:    { ar: 'وفاة',  en: 'Deceased' },
};

const ONSET_OPTIONS = [
  { value: 'COMMUNITY',             ar: 'مجتمعي',                   en: 'Community-acquired' },
  { value: 'HEALTHCARE_ASSOCIATED', ar: 'مرتبط بالرعاية الصحية',     en: 'Healthcare-associated (HCAI)' },
];

const emptyForm = {
  patientMasterId: '',
  episodeId: '',
  reportDate: new Date().toISOString().slice(0, 10),
  infectionType: '',
  onset: 'COMMUNITY',
  organism: '',
  isolationPrecautions: [] as string[],
  treatmentStarted: false,
  treatment: '',
  outcome: 'ACTIVE',
  notifiable: false,
  notes: '',
};

/* ── Main Dashboard ──────────────────────────────────────────────────── */
export default function InfectionControlDashboard() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [activeTab, setActiveTab] = useState('surveillance');
  const [periodDays, setPeriodDays] = useState(30);

  /* ── Surveillance tab state (passed down) ──────────────────────────── */
  const [typeFilter, setTypeFilter] = useState('');
  const [activeIsolationOnly, setActiveIsolationOnly] = useState(false);
  const [notifiableOnly, setNotifiableOnly] = useState(false);

  const { data: statsData } = useSWR(
    `/api/infection-control/stats?days=${periodDays}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  const queryParams = new URLSearchParams();
  if (typeFilter)          queryParams.set('infectionType', typeFilter);
  if (activeIsolationOnly) queryParams.set('activeIsolation', 'true');
  if (notifiableOnly)      queryParams.set('notifiable', 'true');
  const queryStr = queryParams.toString();

  const { data, mutate, isLoading } = useSWR(
    `/api/infection-control${queryStr ? `?${queryStr}` : ''}`,
    fetcher,
    { refreshInterval: 30000 }
  );
  const records: any[] = Array.isArray(data?.records) ? data.records : [];

  /* ── New case dialog ───────────────────────────────────────────────── */
  const [showNew, setShowNew]       = useState(false);
  const [busy, setBusy]             = useState(false);
  const [form, setForm]             = useState({ ...emptyForm });
  const [formError, setFormError]   = useState('');

  const togglePrecaution = (value: string) => {
    setForm((f) => ({
      ...f,
      isolationPrecautions: f.isolationPrecautions.includes(value)
        ? f.isolationPrecautions.filter((v) => v !== value)
        : [...f.isolationPrecautions, value],
    }));
  };

  const createRecord = async () => {
    setFormError('');
    if (!form.patientMasterId.trim()) {
      setFormError(tr('رقم المريض مطلوب', 'Patient Master ID is required'));
      return;
    }
    if (!form.infectionType) {
      setFormError(tr('نوع العدوى مطلوب', 'Infection type is required'));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/infection-control', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          episodeId: form.episodeId.trim() || undefined,
        }),
      });
      if (res.ok) {
        setShowNew(false);
        setForm({ ...emptyForm });
        await mutate();
      } else {
        const err = await res.json().catch(() => ({}));
        setFormError(err?.error || tr('حدث خطأ', 'An error occurred'));
      }
    } finally {
      setBusy(false);
    }
  };

  /* ── Tab config ────────────────────────────────────────────────────── */
  const tabs = [
    { value: 'surveillance', label: tr('المراقبة', 'Surveillance'),         icon: <Activity className="h-4 w-4" /> },
    { value: 'hai-rates',    label: tr('معدلات العدوى', 'HAI Rates'),       icon: <BarChart3 className="h-4 w-4" /> },
    { value: 'antibiogram',  label: tr('مخطط المقاومة', 'Antibiogram'),     icon: <Grid3X3 className="h-4 w-4" /> },
    { value: 'outbreaks',    label: tr('تتبع الفاشيات', 'Outbreaks'),       icon: <AlertTriangle className="h-4 w-4" /> },
    { value: 'hand-hygiene', label: tr('نظافة اليدين', 'Hand Hygiene'),     icon: <HandMetal className="h-4 w-4" /> },
    { value: 'stewardship',  label: tr('إشراف المضادات', 'Stewardship'),    icon: <Pill className="h-4 w-4" /> },
  ];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-red-600" />
            {tr('مكافحة العدوى', 'Infection Control')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('مراقبة حالات العدوى المرتبطة بالرعاية الصحية', 'Healthcare-associated infection surveillance')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(periodDays)} onValueChange={(v) => setPeriodDays(Number(v))}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[7, 14, 30, 60, 90, 180, 365].map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} {tr('يوم', 'days')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowNew(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {tr('حالة جديدة', 'New HAI Case')}
          </Button>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/40 p-1 rounded-xl">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg"
            >
              {t.icon}
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* 1. Surveillance (existing) */}
        <TabsContent value="surveillance" className="mt-4">
          <SurveillanceTab
            tr={tr}
            language={language}
            periodDays={periodDays}
            statsData={statsData}
            records={records}
            isLoading={isLoading}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            activeIsolationOnly={activeIsolationOnly}
            setActiveIsolationOnly={setActiveIsolationOnly}
            notifiableOnly={notifiableOnly}
            setNotifiableOnly={setNotifiableOnly}
          />
        </TabsContent>

        {/* 2. HAI Rates */}
        <TabsContent value="hai-rates" className="mt-4">
          <HAIRatesTab tr={tr} language={language} />
        </TabsContent>

        {/* 3. Antibiogram */}
        <TabsContent value="antibiogram" className="mt-4">
          <AntibiogramTab tr={tr} language={language} />
        </TabsContent>

        {/* 4. Outbreaks */}
        <TabsContent value="outbreaks" className="mt-4">
          <OutbreaksTab tr={tr} language={language} />
        </TabsContent>

        {/* 5. Hand Hygiene */}
        <TabsContent value="hand-hygiene" className="mt-4">
          <HandHygieneTab tr={tr} language={language} />
        </TabsContent>

        {/* 6. Stewardship */}
        <TabsContent value="stewardship" className="mt-4">
          <StewardshipTab tr={tr} language={language} periodDays={periodDays} />
        </TabsContent>
      </Tabs>

      {/* ── New Case Dialog ────────────────────────────────────────────── */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              {tr('تسجيل حالة عدوى جديدة', 'Register New HAI Case')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Patient info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>
                  {tr('رقم المريض', 'Patient Master ID')}
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <Input
                  value={form.patientMasterId}
                  onChange={(e) => setForm((f) => ({ ...f, patientMasterId: e.target.value }))}
                  placeholder="PM-..."
                  className={!form.patientMasterId && formError ? 'border-red-400' : ''}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{tr('رقم الرقاد (اختياري)', 'Episode ID (optional)')}</Label>
                <Input
                  value={form.episodeId}
                  onChange={(e) => setForm((f) => ({ ...f, episodeId: e.target.value }))}
                />
              </div>
            </div>

            {/* Type + Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>
                  {tr('نوع العدوى', 'Infection Type')}
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <Select value={form.infectionType} onValueChange={(v) => setForm((f) => ({ ...f, infectionType: v }))}>
                  <SelectTrigger className={!form.infectionType && formError ? 'border-red-400' : ''}>
                    <SelectValue placeholder={tr('اختر...', 'Select...')} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INFECTION_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        <span className="font-bold">{k}</span>
                        <span className="text-muted-foreground ml-2 text-xs">— {tr(v.ar, v.en)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{tr('تاريخ الإبلاغ', 'Report Date')}</Label>
                <Input
                  type="date"
                  value={form.reportDate}
                  onChange={(e) => setForm((f) => ({ ...f, reportDate: e.target.value }))}
                />
              </div>
            </div>

            {/* Onset + Organism */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{tr('مصدر العدوى', 'Infection Onset')}</Label>
                <Select value={form.onset} onValueChange={(v) => setForm((f) => ({ ...f, onset: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ONSET_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{tr(o.ar, o.en)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{tr('الكائن الدقيق', 'Causative Organism')}</Label>
                <Input
                  value={form.organism}
                  onChange={(e) => setForm((f) => ({ ...f, organism: e.target.value }))}
                  placeholder={tr('مثال: MRSA، E. coli', 'e.g. MRSA, E. coli')}
                />
              </div>
            </div>

            {/* Isolation Precautions */}
            <div className="space-y-2">
              <Label>{tr('احتياطات العزل المطلوبة', 'Required Isolation Precautions')}</Label>
              <div className="flex flex-wrap gap-4">
                {ISOLATION_PRECAUTIONS.map((p) => (
                  <label key={p.value} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={form.isolationPrecautions.includes(p.value)}
                      onCheckedChange={() => togglePrecaution(p.value)}
                    />
                    <span className={`font-medium ${ISOLATION_BADGE_COLORS[p.value]?.split(' ')[1] || ''}`}>
                      {tr(p.ar, p.en)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Treatment */}
            <div className="space-y-3 border border-border rounded-xl p-4 bg-muted/20">
              <h4 className="text-sm font-semibold">{tr('العلاج', 'Treatment')}</h4>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={form.treatmentStarted}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, treatmentStarted: Boolean(c) }))}
                />
                <Label className="cursor-pointer">{tr('بدأ العلاج', 'Treatment Started')}</Label>
              </div>
              {form.treatmentStarted && (
                <div className="space-y-1.5">
                  <Label>{tr('بروتوكول العلاج', 'Treatment Protocol')}</Label>
                  <Textarea
                    value={form.treatment}
                    onChange={(e) => setForm((f) => ({ ...f, treatment: e.target.value }))}
                    placeholder={tr('اذكر المضادات الحيوية والجرعة والمدة...', 'Describe antibiotics, dose, duration...')}
                    rows={2}
                  />
                </div>
              )}
            </div>

            {/* Outcome + Notes */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{tr('النتيجة الحالية', 'Current Outcome')}</Label>
                <Select value={form.outcome} onValueChange={(v) => setForm((f) => ({ ...f, outcome: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(OUTCOME_OPTIONS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{tr(v.ar, v.en)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{tr('ملاحظات', 'Notes')}</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>

            {/* Notifiable */}
            <div className="border border-red-200 bg-red-50 rounded-xl p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={form.notifiable}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, notifiable: Boolean(c) }))}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-semibold text-red-700 text-sm">
                    {tr('حالة إخطارية', 'Notifiable Disease Case')}
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {tr(
                      'يجب إبلاغ وزارة الصحة والجهات المختصة في غضون 24 ساعة',
                      'Must be reported to the Ministry of Health and relevant authorities within 24 hours'
                    )}
                  </p>
                </div>
              </label>
            </div>

            {/* Error */}
            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-1">
              <Button
                variant="outline"
                onClick={() => { setShowNew(false); setFormError(''); setForm({ ...emptyForm }); }}
                disabled={busy}
              >
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button
                onClick={createRecord}
                disabled={busy || !form.patientMasterId.trim() || !form.infectionType}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {busy ? tr('جاري الحفظ...', 'Saving...') : tr('تسجيل الحالة', 'Register Case')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
