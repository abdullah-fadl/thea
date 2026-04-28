'use client';
import { useLang } from '@/hooks/use-lang';
import useSWR from 'swr';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Video, Phone, Calendar, Users, Clock, MessageSquare, Plus, X,
  PhoneCall, PhoneOff, AlertCircle, CheckCircle2, ChevronRight,
  Activity, RefreshCw, Wifi, Star,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type Consultation = {
  id: string;
  patientMasterId: string;
  doctorId: string;
  scheduledAt: string;
  duration: number;
  type: string;
  status: string;
  chiefComplaint?: string;
  notes?: string;
  meetingUrl?: string;
  meetingId?: string;
  startedAt?: string;
  endedAt?: string;
  actualDuration?: number;
  prescription?: unknown;
  followUpNeeded?: boolean;
  followUpDate?: string;
  patientRating?: number;
  patientFeedback?: string;
};

type RxRow = { id: string; drug: string; dose: string; frequency: string; duration: string; instructions: string };

const STATUS_CONFIG: Record<string, { ar: string; en: string; color: string }> = {
  SCHEDULED:   { ar: 'مجدول',   en: 'Scheduled',   color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' },
  IN_PROGRESS: { ar: 'جارٍ',    en: 'In Progress',  color: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300' },
  COMPLETED:   { ar: 'مكتمل',   en: 'Completed',    color: 'bg-muted text-foreground' },
  MISSED:      { ar: 'فائت',    en: 'Missed',       color: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300' },
  CANCELLED:   { ar: 'ملغى',    en: 'Cancelled',    color: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300' },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// ─── Create Dialog ────────────────────────────────────────────────────────────
function CreateConsultationDialog({ onClose, onCreated, lang }: {
  onClose: () => void;
  onCreated: () => void;
  lang: string;
}) {
  const tr = (ar: string, en: string) => lang === 'ar' ? ar : en;
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    patientMasterId: '',
    doctorId: '',
    type: 'VIDEO',
    scheduledAt: '',
    duration: '30',
    chiefComplaint: '',
    meetingUrl: '',
  });

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.patientMasterId || !form.scheduledAt) {
      toast({ title: tr('حقول مطلوبة', 'Required fields missing'), variant: 'destructive' as const });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/telemedicine/consultations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          duration: Number(form.duration),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Failed');
      }
      toast({ title: tr('تم إنشاء الجلسة', 'Session created') });
      onCreated();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error';
      toast({ title: tr('خطأ', 'Error'), description: msg, variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">{tr('جلسة تطبيب عن بُعد جديدة', 'New Telemedicine Session')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>{tr('معرّف المريض *', 'Patient ID *')}</Label>
              <Input value={form.patientMasterId} onChange={e => set('patientMasterId', e.target.value)}
                placeholder="UUID" className="thea-input-focus" />
            </div>
            <div className="space-y-1">
              <Label>{tr('معرّف الطبيب', 'Doctor ID')}</Label>
              <Input value={form.doctorId} onChange={e => set('doctorId', e.target.value)}
                placeholder={tr('اختياري', 'Optional')} className="thea-input-focus" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>{tr('نوع الاتصال', 'Call Type')}</Label>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger className="thea-input-focus"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIDEO">{tr('مرئي', 'Video')}</SelectItem>
                  <SelectItem value="PHONE">{tr('صوتي', 'Phone')}</SelectItem>
                  <SelectItem value="CHAT">{tr('دردشة', 'Chat')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{tr('المدة (دقيقة)', 'Duration (min)')}</Label>
              <Input type="number" min={5} max={120} value={form.duration} onChange={e => set('duration', e.target.value)}
                className="thea-input-focus" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{tr('وقت الجلسة المجدول *', 'Scheduled At *')}</Label>
            <Input type="datetime-local" value={form.scheduledAt} onChange={e => set('scheduledAt', e.target.value)}
              className="thea-input-focus" />
          </div>
          <div className="space-y-1">
            <Label>{tr('الشكوى الرئيسية', 'Chief Complaint')}</Label>
            <Input value={form.chiefComplaint} onChange={e => set('chiefComplaint', e.target.value)}
              placeholder={tr('وصف مختصر...', 'Brief description...')} className="thea-input-focus" />
          </div>
          <div className="space-y-1">
            <Label>{tr('رابط الاجتماع', 'Meeting URL')}</Label>
            <Input value={form.meetingUrl} onChange={e => set('meetingUrl', e.target.value)}
              placeholder="https://meet.example.com/..." className="thea-input-focus" />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>{tr('إلغاء', 'Cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('إنشاء الجلسة', 'Create Session')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Consultation Modal (slide-over) ─────────────────────────────────────────
function ConsultationModal({ consultation, onClose, onUpdated, lang }: {
  consultation: Consultation;
  onClose: () => void;
  onUpdated: () => void;
  lang: string;
}) {
  const tr = (ar: string, en: string) => lang === 'ar' ? ar : en;
  const { toast } = useToast();
  const [tab, setTab] = useState<'info' | 'notes' | 'rx' | 'followup'>('info');
  const [saving, setSaving] = useState(false);

  // Notes
  const [notes, setNotes] = useState(consultation.notes || '');

  // Prescription rows
  const [rxRows, setRxRows] = useState<RxRow[]>(() => {
    try {
      const p = consultation.prescription as RxRow[] | null;
      return Array.isArray(p) ? p : [];
    } catch { return []; }
  });

  // Follow-up
  const [followUpNeeded, setFollowUpNeeded] = useState(consultation.followUpNeeded ?? false);
  const [followUpDate, setFollowUpDate] = useState(
    consultation.followUpDate ? consultation.followUpDate.slice(0, 10) : ''
  );

  const addRxRow = () => setRxRows(p => [...p, { id: Date.now().toString(), drug: '', dose: '', frequency: '', duration: '', instructions: '' }]);
  const removeRxRow = (id: string) => setRxRows(p => p.filter(r => r.id !== id));
  const setRx = (id: string, k: keyof RxRow, v: string) =>
    setRxRows(p => p.map(r => r.id === id ? { ...r, [k]: v } : r));

  const callAction = async (newStatus: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/telemedicine/consultations/${consultation.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم تحديث الحالة', 'Status updated') });
      onUpdated();
    } catch {
      toast({ title: tr('خطأ', 'Error'), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  const saveNotes = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/telemedicine/consultations/${consultation.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم حفظ الملاحظات', 'Notes saved') });
      onUpdated();
    } catch {
      toast({ title: tr('خطأ', 'Error'), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  const saveRx = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/telemedicine/consultations/${consultation.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prescription: rxRows }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم حفظ الوصفة', 'Prescription saved') });
      onUpdated();
    } catch {
      toast({ title: tr('خطأ', 'Error'), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  const saveFollowUp = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/telemedicine/consultations/${consultation.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followUpNeeded,
          followUpDate: followUpDate ? followUpDate : null,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم الحفظ', 'Saved') });
      onUpdated();
    } catch {
      toast({ title: tr('خطأ', 'Error'), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  const statusCfg = STATUS_CONFIG[consultation.status] || STATUS_CONFIG['SCHEDULED'];
  const isScheduled = consultation.status === 'SCHEDULED';
  const isInProgress = consultation.status === 'IN_PROGRESS';
  const isTerminal = ['COMPLETED', 'MISSED', 'CANCELLED'].includes(consultation.status);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card border-l w-full max-w-2xl h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                {tr(statusCfg.ar, statusCfg.en)}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(consultation.scheduledAt).toLocaleString()}
              </span>
            </div>
            <h2 className="text-lg font-semibold">
              {consultation.chiefComplaint || tr('استشارة', 'Consultation')}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tr('المريض:', 'Patient:')} {consultation.patientMasterId.slice(0, 8)}...
              {'  '}·{'  '}
              {tr('الطبيب:', 'Doctor:')} {consultation.doctorId.slice(0, 8)}...
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg shrink-0 mt-0.5">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Call controls */}
        {!isTerminal && (
          <div className="flex items-center gap-2 px-5 py-3 bg-muted/30 border-b shrink-0 flex-wrap">
            {isScheduled && (
              <>
                <Button size="sm" onClick={() => callAction('IN_PROGRESS')} disabled={saving}
                  className="bg-green-600 hover:bg-green-700 text-white gap-1">
                  <PhoneCall className="h-4 w-4" />
                  {tr('بدء الجلسة', 'Start Session')}
                </Button>
                {consultation.meetingUrl && (
                  <Button size="sm" variant="outline" onClick={() => window.open(consultation.meetingUrl!, '_blank')} className="gap-1">
                    <Wifi className="h-4 w-4" />
                    {tr('الانضمام', 'Join')}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => callAction('MISSED')} disabled={saving} className="gap-1 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  {tr('فائت', 'Missed')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => callAction('CANCELLED')} disabled={saving} className="gap-1 text-muted-foreground">
                  <X className="h-4 w-4" />
                  {tr('إلغاء', 'Cancel')}
                </Button>
              </>
            )}
            {isInProgress && (
              <>
                <Button size="sm" onClick={() => callAction('COMPLETED')} disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  {tr('إنهاء الجلسة', 'End Session')}
                </Button>
                {consultation.meetingUrl && (
                  <Button size="sm" variant="outline" onClick={() => window.open(consultation.meetingUrl!, '_blank')} className="gap-1">
                    <Wifi className="h-4 w-4" />
                    {tr('انضمام', 'Rejoin')}
                  </Button>
                )}
                <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium px-2">
                  <Activity className="h-3.5 w-3.5 animate-pulse" />
                  {tr('الجلسة جارية', 'Session active')}
                </div>
              </>
            )}
          </div>
        )}
        {isTerminal && consultation.status === 'COMPLETED' && (
          <div className="flex items-center gap-2 px-5 py-2 bg-muted/50/20 border-b shrink-0 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            {tr('انتهت الجلسة', 'Session ended')}
            {consultation.actualDuration ? ` — ${consultation.actualDuration} ${tr('دقيقة', 'min')}` : ''}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b shrink-0 px-5 gap-1">
          {(['info', 'notes', 'rx', 'followup'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {t === 'info'    && tr('المعلومات', 'Info')}
              {t === 'notes'   && tr('الملاحظات', 'Notes')}
              {t === 'rx'      && tr('الوصفة', 'Prescription')}
              {t === 'followup'&& tr('المتابعة', 'Follow-up')}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Info tab */}
          {tab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: tr('نوع الاتصال', 'Call Type'), value: consultation.type },
                  { label: tr('المدة المجدولة', 'Scheduled Duration'), value: `${consultation.duration} ${tr('د', 'min')}` },
                  { label: tr('وقت البدء', 'Start Time'), value: consultation.startedAt ? new Date(consultation.startedAt).toLocaleString() : '—' },
                  { label: tr('وقت الانتهاء', 'End Time'), value: consultation.endedAt ? new Date(consultation.endedAt).toLocaleString() : '—' },
                  { label: tr('المدة الفعلية', 'Actual Duration'), value: consultation.actualDuration ? `${consultation.actualDuration} ${tr('د', 'min')}` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="space-y-1">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-medium">{value}</p>
                  </div>
                ))}
              </div>
              {consultation.meetingUrl && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{tr('رابط الاجتماع', 'Meeting URL')}</p>
                  <a href={consultation.meetingUrl} target="_blank" rel="noreferrer"
                    className="text-sm text-primary hover:underline break-all">
                    {consultation.meetingUrl}
                  </a>
                </div>
              )}
              {consultation.chiefComplaint && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{tr('الشكوى الرئيسية', 'Chief Complaint')}</p>
                  <p className="text-sm">{consultation.chiefComplaint}</p>
                </div>
              )}
              {consultation.patientRating != null && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{tr('تقييم المريض', 'Patient Rating')}</p>
                  <p className="text-sm flex items-center gap-0.5">{Array.from({ length: consultation.patientRating }, (_, i) => <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />)} <span className="ml-1">{consultation.patientRating}/5</span></p>
                  {consultation.patientFeedback && <p className="text-xs text-muted-foreground mt-1">{consultation.patientFeedback}</p>}
                </div>
              )}
            </div>
          )}

          {/* Notes tab */}
          {tab === 'notes' && (
            <div className="space-y-3">
              <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={tr('الملاحظات السريرية، التشخيص، خطة العلاج...', 'Clinical notes, diagnosis, treatment plan...')}
                rows={12} className="thea-input-focus text-sm" />
              <div className="flex justify-end">
                <Button onClick={saveNotes} disabled={saving} size="sm">
                  {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('حفظ الملاحظات', 'Save Notes')}
                </Button>
              </div>
            </div>
          )}

          {/* Prescription tab */}
          {tab === 'rx' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  {rxRows.length} {tr('دواء', 'medication(s)')}
                </p>
                <Button size="sm" variant="outline" onClick={addRxRow} className="gap-1">
                  <Plus className="h-4 w-4" />
                  {tr('إضافة دواء', 'Add Medication')}
                </Button>
              </div>
              {rxRows.length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  {tr('لا توجد أدوية. أضف دواءً لبدء الوصفة.', 'No medications. Add one to start prescription.')}
                </div>
              )}
              {rxRows.map((row, i) => (
                <div key={row.id} className="border rounded-xl p-3 space-y-2 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                    <button onClick={() => removeRxRow(row.id)} className="p-1 hover:bg-muted rounded">
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('الدواء', 'Drug')}</Label>
                      <Input value={row.drug} onChange={e => setRx(row.id, 'drug', e.target.value)}
                        placeholder={tr('اسم الدواء', 'Drug name')} className="h-8 text-xs thea-input-focus" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('الجرعة', 'Dose')}</Label>
                      <Input value={row.dose} onChange={e => setRx(row.id, 'dose', e.target.value)}
                        placeholder="e.g. 500mg" className="h-8 text-xs thea-input-focus" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('التكرار', 'Frequency')}</Label>
                      <Input value={row.frequency} onChange={e => setRx(row.id, 'frequency', e.target.value)}
                        placeholder="e.g. TID" className="h-8 text-xs thea-input-focus" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('المدة', 'Duration')}</Label>
                      <Input value={row.duration} onChange={e => setRx(row.id, 'duration', e.target.value)}
                        placeholder="e.g. 7 days" className="h-8 text-xs thea-input-focus" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{tr('تعليمات', 'Instructions')}</Label>
                    <Input value={row.instructions} onChange={e => setRx(row.id, 'instructions', e.target.value)}
                      placeholder={tr('مع الطعام، قبل النوم...', 'With food, before sleep...')} className="h-8 text-xs thea-input-focus" />
                  </div>
                </div>
              ))}
              {rxRows.length > 0 && (
                <div className="flex justify-end">
                  <Button onClick={saveRx} disabled={saving} size="sm">
                    {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('حفظ الوصفة', 'Save Prescription')}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Follow-up tab */}
          {tab === 'followup' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setFollowUpNeeded(p => !p)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    followUpNeeded ? 'bg-primary' : 'bg-muted'
                  }`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-card shadow transition-transform ${
                    followUpNeeded ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                <Label>{tr('يحتاج متابعة', 'Requires follow-up')}</Label>
              </div>
              {followUpNeeded && (
                <div className="space-y-1">
                  <Label>{tr('تاريخ المتابعة', 'Follow-up Date')}</Label>
                  <Input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                    className="thea-input-focus max-w-xs" />
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={saveFollowUp} disabled={saving} size="sm">
                  {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Availability Manager ─────────────────────────────────────────────────────
function AvailabilityManager({ lang }: { lang: string }) {
  const tr = (ar: string, en: string) => lang === 'ar' ? ar : en;
  const { toast } = useToast();
  const { data, mutate } = useSWR('/api/telemedicine/availability', fetcher, { revalidateOnFocus: false });
  const slots: Record<string, unknown>[] = data?.slots ?? [];
  const [form, setForm] = useState({ doctorId: '', dayOfWeek: '1', startTime: '08:00', endTime: '17:00', slotDuration: '30' });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleAdd = async () => {
    if (!form.startTime || !form.endTime) return;
    setSaving(true);
    try {
      const res = await fetch('/api/telemedicine/availability', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, dayOfWeek: Number(form.dayOfWeek), slotDuration: Number(form.slotDuration) }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم إضافة الوقت', 'Slot added') });
      await mutate();
    } catch {
      toast({ title: tr('خطأ', 'Error'), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  const grouped: Record<number, typeof slots> = {};
  slots.forEach(s => {
    const d = Number(s.dayOfWeek);
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(s);
  });

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">{tr('إضافة وقت متاح', 'Add Availability Slot')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{tr('معرّف الطبيب', 'Doctor ID')}</Label>
              <Input value={form.doctorId} onChange={e => set('doctorId', e.target.value)}
                placeholder={tr('اختياري', 'Optional')} className="h-8 text-xs thea-input-focus" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tr('يوم الأسبوع', 'Day of Week')}</Label>
              <Select value={form.dayOfWeek} onValueChange={v => set('dayOfWeek', v)}>
                <SelectTrigger className="h-8 text-xs thea-input-focus"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {lang === 'ar' ? DAY_NAMES_AR[i] : d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tr('مدة الجلسة (دقيقة)', 'Slot Duration (min)')}</Label>
              <Input type="number" min={5} max={120} value={form.slotDuration} onChange={e => set('slotDuration', e.target.value)}
                className="h-8 text-xs thea-input-focus" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tr('من', 'From')}</Label>
              <Input type="time" value={form.startTime} onChange={e => set('startTime', e.target.value)}
                className="h-8 text-xs thea-input-focus" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tr('إلى', 'To')}</Label>
              <Input type="time" value={form.endTime} onChange={e => set('endTime', e.target.value)}
                className="h-8 text-xs thea-input-focus" />
            </div>
          </div>
          <Button size="sm" onClick={handleAdd} disabled={saving} className="gap-1">
            <Plus className="h-4 w-4" />
            {saving ? tr('جارٍ الإضافة...', 'Adding...') : tr('إضافة', 'Add Slot')}
          </Button>
        </CardContent>
      </Card>

      {slots.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {tr('لا توجد أوقات متاحة', 'No availability slots configured')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b)).map(([day, daySlots]) => (
            <Card key={day} className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{lang === 'ar' ? DAY_NAMES_AR[Number(day)] : DAY_NAMES[Number(day)]}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {daySlots.map(s => (
                  <div key={s.id as string} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                    <span className="font-medium">{s.startTime as string} – {s.endTime as string}</span>
                    <span className="text-xs text-muted-foreground">{s.slotDuration as number} {tr('د/جلسة', 'min/slot')}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
type TabKey = 'queue' | 'all' | 'availability';

export function TelemedicineDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [activeTab, setActiveTab] = useState<TabKey>('queue');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [refreshKey, setRefreshKey] = useState(0);

  // Today's data
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const todayKey = `/api/telemedicine/consultations?dateFrom=${todayStart.toISOString()}&dateTo=${todayEnd.toISOString()}`;
  const { data: todayData, mutate: mutateToday } = useSWR(`${todayKey}&_k=${refreshKey}`, fetcher);
  const todayConsultations: Consultation[] = todayData?.consultations ?? [];

  // All consultations (filtered)
  const allKey = statusFilter === 'ALL'
    ? `/api/telemedicine/consultations`
    : `/api/telemedicine/consultations?status=${statusFilter}`;
  const { data: allData, mutate: mutateAll } = useSWR(`${allKey}&_k=${refreshKey}`, fetcher);
  const allConsultations: Consultation[] = allData?.consultations ?? [];

  // KPIs
  const inProgress = todayConsultations.filter(c => c.status === 'IN_PROGRESS').length;
  const scheduled   = todayConsultations.filter(c => c.status === 'SCHEDULED').length;
  const completed   = todayConsultations.filter(c => c.status === 'COMPLETED').length;

  const refresh = () => {
    setRefreshKey(k => k + 1);
    mutateToday();
    mutateAll();
  };

  // Sort today by scheduledAt ASC
  const sortedToday = [...todayConsultations].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  const isUpcoming = (c: Consultation) => {
    const diff = new Date(c.scheduledAt).getTime() - Date.now();
    return diff > 0 && diff < 15 * 60 * 1000;
  };

  const typeIcon = (t: string) => {
    if (t === 'VIDEO') return <Video className="h-4 w-4 text-blue-500" />;
    if (t === 'PHONE') return <Phone className="h-4 w-4 text-green-500" />;
    return <MessageSquare className="h-4 w-4 text-purple-500" />;
  };

  return (
    <div className="p-4 md:p-6 space-y-5" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tr('الطب عن بُعد', 'Telemedicine')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{tr('إدارة الاستشارات عن بُعد', 'Remote consultation management')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} className="gap-1">
            <RefreshCw className="h-4 w-4" />
            {tr('تحديث', 'Refresh')}
          </Button>
          <Button onClick={() => setShowCreate(true)} className="gap-1">
            <Plus className="h-4 w-4" />
            {tr('جلسة جديدة', 'New Session')}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: <Calendar className="h-5 w-5 text-blue-500" />, label: tr('إجمالي اليوم', "Today's Total"), value: todayConsultations.length, color: 'text-blue-600' },
          { icon: <Activity className="h-5 w-5 text-green-500 animate-pulse" />, label: tr('جارٍ الآن', 'In Progress'), value: inProgress, color: 'text-green-600' },
          { icon: <Clock className="h-5 w-5 text-amber-500" />, label: tr('مجدول', 'Scheduled'), value: scheduled, color: 'text-amber-600' },
          { icon: <CheckCircle2 className="h-5 w-5 text-muted-foreground" />, label: tr('مكتمل اليوم', 'Completed Today'), value: completed, color: 'text-muted-foreground' },
        ].map(k => (
          <Card key={k.label} className="rounded-2xl">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">{k.icon}<p className="text-xs text-muted-foreground">{k.label}</p></div>
              <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b gap-1">
        {(['queue', 'all', 'availability'] as TabKey[]).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t === 'queue'        && tr("طابور اليوم", "Today's Queue")}
            {t === 'all'          && tr('جميع الجلسات', 'All Sessions')}
            {t === 'availability' && tr('الإتاحة', 'Availability')}
          </button>
        ))}
      </div>

      {/* Today's Queue Tab */}
      {activeTab === 'queue' && (
        <div className="space-y-3">
          {sortedToday.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>{tr('لا توجد جلسات اليوم', 'No sessions scheduled for today')}</p>
            </div>
          ) : (
            sortedToday.map(c => {
              const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG['SCHEDULED'];
              const upcoming = isUpcoming(c);
              return (
                <div key={c.id}
                  className={`border rounded-2xl p-4 hover:bg-muted/20 transition-colors cursor-pointer ${
                    upcoming ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/10' : 'bg-card'
                  }`}
                  onClick={() => setSelectedConsultation(c)}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                        {typeIcon(c.type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{c.chiefComplaint || tr('استشارة', 'Consultation')}</p>
                          {upcoming && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                              {tr('قريبًا', 'Soon')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(c.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {'  ·  '}
                          {c.duration} {tr('د', 'min')}
                          {'  ·  '}
                          {c.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                        {tr(cfg.ar, cfg.en)}
                      </span>
                      {c.status === 'SCHEDULED' && (
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs gap-1"
                          onClick={e => { e.stopPropagation(); void fetch(`/api/telemedicine/consultations/${c.id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'IN_PROGRESS' }) }).then(refresh); }}>
                          <PhoneCall className="h-3 w-3" />
                          {tr('بدء', 'Start')}
                        </Button>
                      )}
                      {c.status === 'IN_PROGRESS' && (
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-7 text-xs gap-1"
                          onClick={e => { e.stopPropagation(); void fetch(`/api/telemedicine/consultations/${c.id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'COMPLETED' }) }).then(refresh); }}>
                          <PhoneOff className="h-3 w-3" />
                          {tr('إنهاء', 'End')}
                        </Button>
                      )}
                      {c.meetingUrl && c.status !== 'COMPLETED' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                          onClick={e => { e.stopPropagation(); window.open(c.meetingUrl!, '_blank'); }}>
                          <Wifi className="h-3 w-3" />
                          {tr('انضمام', 'Join')}
                        </Button>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* All Sessions Tab */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap items-center">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 thea-input-focus"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tr('كل الحالات', 'All Statuses')}</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{tr(v.ar, v.en)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{allConsultations.length} {tr('جلسة', 'sessions')}</p>
          </div>
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-start font-medium">{tr('النوع', 'Type')}</th>
                  <th className="p-3 text-start font-medium">{tr('الوقت المجدول', 'Scheduled At')}</th>
                  <th className="p-3 text-start font-medium">{tr('الشكوى', 'Chief Complaint')}</th>
                  <th className="p-3 text-start font-medium">{tr('المدة', 'Duration')}</th>
                  <th className="p-3 text-start font-medium">{tr('الحالة', 'Status')}</th>
                  <th className="p-3 text-start font-medium">{tr('إجراء', 'Action')}</th>
                </tr>
              </thead>
              <tbody>
                {allConsultations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-muted-foreground">
                      {tr('لا توجد جلسات', 'No sessions found')}
                    </td>
                  </tr>
                ) : (
                  allConsultations.map(c => {
                    const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG['SCHEDULED'];
                    return (
                      <tr key={c.id} className="border-t hover:bg-muted/30 cursor-pointer"
                        onClick={() => setSelectedConsultation(c)}>
                        <td className="p-3">{typeIcon(c.type)}</td>
                        <td className="p-3 text-xs">{new Date(c.scheduledAt).toLocaleString()}</td>
                        <td className="p-3">{c.chiefComplaint || '—'}</td>
                        <td className="p-3">{c.actualDuration ?? c.duration} {tr('د', 'min')}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                            {tr(cfg.ar, cfg.en)}
                          </span>
                        </td>
                        <td className="p-3">
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Availability Tab */}
      {activeTab === 'availability' && <AvailabilityManager lang={language} />}

      {/* Modals */}
      {showCreate && (
        <CreateConsultationDialog
          onClose={() => setShowCreate(false)}
          onCreated={refresh}
          lang={language}
        />
      )}
      {selectedConsultation && (
        <ConsultationModal
          consultation={selectedConsultation}
          onClose={() => setSelectedConsultation(null)}
          onUpdated={() => { refresh(); setSelectedConsultation(null); }}
          lang={language}
        />
      )}
    </div>
  );
}

export default TelemedicineDashboard;
