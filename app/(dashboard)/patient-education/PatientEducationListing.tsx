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

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

const COMPREHENSION_CONFIG: Record<string, { ar: string; en: string; color: string }> = {
  VERBALIZED_UNDERSTANDING: { ar: 'أكد الفهم', en: 'Verbalized Understanding', color: 'green' },
  RETURN_DEMO: { ar: 'أظهر عملياً', en: 'Return Demo', color: 'blue' },
  WRITTEN_TEST: { ar: 'اختبار مكتوب', en: 'Written Test', color: 'blue' },
  NO_UNDERSTANDING: { ar: 'لم يفهم', en: 'No Understanding', color: 'red' },
};

const comprehensionBadgeClass = (color: string) => {
  if (color === 'green') return 'bg-green-100 text-green-700';
  if (color === 'blue') return 'bg-blue-100 text-blue-700';
  if (color === 'red') return 'bg-red-100 text-red-700';
  return 'bg-muted text-foreground';
};

const METHODS = [
  { value: 'VERBAL', ar: 'شفهي', en: 'Verbal' },
  { value: 'WRITTEN', ar: 'مكتوب', en: 'Written' },
  { value: 'DEMONSTRATION', ar: 'عملي', en: 'Demonstration' },
  { value: 'VIDEO', ar: 'فيديو', en: 'Video' },
  { value: 'LEAFLET', ar: 'نشرة', en: 'Leaflet' },
];

const BARRIER_OPTIONS = [
  { value: 'LANGUAGE', ar: 'اللغة', en: 'Language Barrier' },
  { value: 'LITERACY', ar: 'الأمية', en: 'Literacy' },
  { value: 'COGNITIVE', ar: 'إدراكي', en: 'Cognitive' },
  { value: 'HEARING', ar: 'سمع', en: 'Hearing Impairment' },
  { value: 'VISION', ar: 'بصر', en: 'Vision Impairment' },
  { value: 'EMOTIONAL', ar: 'عاطفي', en: 'Emotional State' },
];

const TOPIC_OPTIONS = [
  { value: 'DIAGNOSIS', ar: 'التشخيص', en: 'Diagnosis' },
  { value: 'MEDICATIONS', ar: 'الأدوية', en: 'Medications' },
  { value: 'DIET', ar: 'النظام الغذائي', en: 'Diet' },
  { value: 'ACTIVITY', ar: 'النشاط البدني', en: 'Physical Activity' },
  { value: 'WOUND_CARE', ar: 'العناية بالجرح', en: 'Wound Care' },
  { value: 'FOLLOW_UP', ar: 'المتابعة', en: 'Follow-up' },
  { value: 'SIGNS_SYMPTOMS', ar: 'الأعراض والعلامات', en: 'Signs & Symptoms' },
  { value: 'SELF_CARE', ar: 'الرعاية الذاتية', en: 'Self-care' },
];

export default function PatientEducationListing() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const { data, mutate, isLoading } = useSWR('/api/patient-education', fetcher, {
    refreshInterval: 30000,
  });

  const records: any[] = Array.isArray(data?.records) ? data.records : [];

  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    patientMasterId: '',
    episodeId: '',
    educationDate: new Date().toISOString().slice(0, 10),
    topics: [] as string[],
    method: [] as string[],
    barriers: [] as string[],
    interpreter: '',
    comprehension: '',
    followUpNeeded: false,
    notes: '',
  });

  const kpis = {
    total: records.length,
    withBarriers: records.filter((r) => Array.isArray(r.barriers) && r.barriers.length > 0).length,
    interpreterUsed: records.filter((r) => r.interpreter).length,
    followUpNeeded: records.filter((r) => r.followUpNeeded).length,
  };

  const toggleArrayField = (field: 'topics' | 'method' | 'barriers', value: string) => {
    setForm((f) => {
      const arr = f[field] as string[];
      return {
        ...f,
        [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  };

  const handleCreate = async () => {
    if (!form.patientMasterId.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/patient-education', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowNew(false);
        setForm({
          patientMasterId: '',
          episodeId: '',
          educationDate: new Date().toISOString().slice(0, 10),
          topics: [],
          method: [],
          barriers: [],
          interpreter: '',
          comprehension: '',
          followUpNeeded: false,
          notes: '',
        });
        await mutate();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {tr('تثقيف المريض', 'Patient Education')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('سجلات التثقيف الصحي للمرضى', 'Patient health education records')}
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          {tr('سجل جديد', 'New Education Record')}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: tr('إجمالي السجلات', 'Total Records'), value: kpis.total, color: 'bg-blue-50 border-blue-200 text-blue-800' },
          { label: tr('مع عوائق', 'With Barriers'), value: kpis.withBarriers, color: 'bg-red-50 border-red-200 text-red-800' },
          { label: tr('مترجم مستخدم', 'Interpreter Used'), value: kpis.interpreterUsed, color: 'bg-amber-50 border-amber-200 text-amber-800' },
          { label: tr('تحتاج متابعة', 'Follow-up Needed'), value: kpis.followUpNeeded, color: 'bg-purple-50 border-purple-200 text-purple-800' },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-2xl border p-4 ${kpi.color}`}>
            <p className="text-xs font-medium opacity-70">{kpi.label}</p>
            <p className="text-3xl font-extrabold mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-bold text-base">{tr('سجلات التثقيف', 'Education Records')}</h2>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            {tr('جاري التحميل...', 'Loading...')}
          </div>
        ) : records.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            {tr('لا توجد سجلات بعد', 'No records yet')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-start font-semibold">{tr('المريض', 'Patient ID')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{tr('عدد المواضيع', 'Topics Count')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{tr('الطريقة', 'Method')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{tr('الفهم', 'Comprehension')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{tr('العوائق', 'Barriers')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{tr('التاريخ', 'Date')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{tr('متابعة', 'Follow-up')}</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r: any) => {
                  const comp = r.comprehension ? COMPREHENSION_CONFIG[r.comprehension] : null;
                  const topicsCount = Array.isArray(r.topics) ? r.topics.length : 0;
                  const methodArr: string[] = Array.isArray(r.method) ? r.method : [];
                  const barriersArr: string[] = Array.isArray(r.barriers) ? r.barriers : [];

                  return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{r.patientMasterId}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                          {topicsCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {methodArr.length > 0 ? methodArr.join(', ') : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {comp ? (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${comprehensionBadgeClass(comp.color)}`}>
                            {tr(comp.ar, comp.en)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {barriersArr.length > 0 ? (
                          <span className="text-xs text-red-600">{barriersArr.length} {tr('عائق', 'barrier(s)')}</span>
                        ) : (
                          <span className="text-green-600 text-xs">✓</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {r.educationDate
                          ? new Date(r.educationDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {r.followUpNeeded ? (
                          <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            {tr('نعم', 'Yes')}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{tr('لا', 'No')}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Record Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr('سجل تثقيف جديد', 'New Education Record')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{tr('رقم المريض', 'Patient Master ID')} *</Label>
                <Input
                  value={form.patientMasterId}
                  onChange={(e) => setForm((f) => ({ ...f, patientMasterId: e.target.value }))}
                  placeholder="PM-..."
                />
              </div>
              <div className="space-y-1">
                <Label>{tr('رقم الرقاد', 'Episode ID')}</Label>
                <Input
                  value={form.episodeId}
                  onChange={(e) => setForm((f) => ({ ...f, episodeId: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>{tr('تاريخ التثقيف', 'Education Date')}</Label>
              <Input
                type="date"
                value={form.educationDate}
                onChange={(e) => setForm((f) => ({ ...f, educationDate: e.target.value }))}
              />
            </div>

            {/* Topics */}
            <div className="space-y-2">
              <Label>{tr('المواضيع', 'Topics')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {TOPIC_OPTIONS.map((t) => (
                  <label key={t.value} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={form.topics.includes(t.value)}
                      onCheckedChange={() => toggleArrayField('topics', t.value)}
                    />
                    {tr(t.ar, t.en)}
                  </label>
                ))}
              </div>
            </div>

            {/* Methods */}
            <div className="space-y-2">
              <Label>{tr('طريقة التثقيف', 'Education Methods')}</Label>
              <div className="flex flex-wrap gap-2">
                {METHODS.map((m) => (
                  <label key={m.value} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <Checkbox
                      checked={form.method.includes(m.value)}
                      onCheckedChange={() => toggleArrayField('method', m.value)}
                    />
                    {tr(m.ar, m.en)}
                  </label>
                ))}
              </div>
            </div>

            {/* Barriers */}
            <div className="space-y-2">
              <Label>{tr('العوائق', 'Barriers')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {BARRIER_OPTIONS.map((b) => (
                  <label key={b.value} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={form.barriers.includes(b.value)}
                      onCheckedChange={() => toggleArrayField('barriers', b.value)}
                    />
                    {tr(b.ar, b.en)}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{tr('المترجم', 'Interpreter')}</Label>
                <Input
                  value={form.interpreter}
                  onChange={(e) => setForm((f) => ({ ...f, interpreter: e.target.value }))}
                  placeholder={tr('اسم المترجم', 'Interpreter name')}
                />
              </div>
              <div className="space-y-1">
                <Label>{tr('مستوى الفهم', 'Comprehension')}</Label>
                <Select
                  value={form.comprehension}
                  onValueChange={(v) => setForm((f) => ({ ...f, comprehension: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tr('اختر...', 'Select...')} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMPREHENSION_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{tr(v.ar, v.en)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>{tr('ملاحظات', 'Notes')}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox
                checked={form.followUpNeeded}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, followUpNeeded: Boolean(checked) }))}
              />
              {tr('تحتاج متابعة', 'Follow-up Needed')}
            </label>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowNew(false)} disabled={busy}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={busy || !form.patientMasterId.trim()}>
                {busy ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
