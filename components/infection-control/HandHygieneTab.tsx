'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { HandMetal, Target, Plus, Save } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const MOMENTS: { value: string; ar: string; en: string; icon: string }[] = [
  { value: 'BEFORE_PATIENT',       ar: 'قبل ملامسة المريض',      en: 'Before patient contact',      icon: '1' },
  { value: 'BEFORE_ASEPTIC',       ar: 'قبل الإجراء المعقم',     en: 'Before aseptic task',          icon: '2' },
  { value: 'AFTER_BODY_FLUID',     ar: 'بعد التعرض لسوائل',      en: 'After body fluid exposure',    icon: '3' },
  { value: 'AFTER_PATIENT',        ar: 'بعد ملامسة المريض',      en: 'After patient contact',        icon: '4' },
  { value: 'AFTER_SURROUNDINGS',   ar: 'بعد ملامسة محيط المريض', en: 'After patient surroundings',   icon: '5' },
];

const STAFF_CATEGORIES = [
  { value: 'PHYSICIAN',     ar: 'طبيب',          en: 'Physician' },
  { value: 'NURSE',         ar: 'ممرض/ة',        en: 'Nurse' },
  { value: 'ALLIED_HEALTH', ar: 'صحي مساعد',     en: 'Allied Health' },
  { value: 'SUPPORT',       ar: 'دعم',           en: 'Support Staff' },
  { value: 'STUDENT',       ar: 'متدرب',         en: 'Student' },
];

const METHODS = [
  { value: 'HANDWASH', ar: 'غسل اليدين', en: 'Handwash' },
  { value: 'HAND_RUB', ar: 'معقم يدوي',  en: 'Hand Rub' },
  { value: 'GLOVES',   ar: 'قفازات',     en: 'Gloves' },
  { value: 'NONE',     ar: 'لم يتم',     en: 'None' },
];

const DEPARTMENTS = ['ICU', 'MICU', 'SICU', 'NICU', 'ER', 'General Ward', 'OPD', 'OR', 'Lab', 'Pharmacy', 'Radiology'];

interface ComplianceEntry { department?: string; category?: string; moment?: string; rate: number; opportunities: number; compliant: number }

interface Props {
  tr: (ar: string, en: string) => string;
  language: string;
}

export default function HandHygieneTab({ tr, language }: Props) {
  const { data, mutate } = useSWR('/api/infection-control/hand-hygiene', fetcher, { refreshInterval: 60000 });

  const overall = data?.overall || { opportunities: 0, compliant: 0, rate: 0 };
  const byDepartment = (data?.byDepartment || []) as ComplianceEntry[];
  const byStaffCategory = (data?.byStaffCategory || []) as ComplianceEntry[];
  const byMoment = (data?.byMoment || []) as ComplianceEntry[];
  const monthlyTrend = (data?.monthlyTrend || []) as Record<string, unknown>[];

  // Batch observation entry
  const [showForm, setShowForm] = useState(false);
  const [obs, setObs] = useState({
    auditDate: new Date().toISOString().slice(0, 10),
    department: 'ICU',
    staffCategory: 'NURSE',
    moment: 'BEFORE_PATIENT',
    compliant: true,
    method: 'HAND_RUB',
  });
  const [batch, setBatch] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const addToBatch = () => {
    setBatch((b) => [...b, { ...obs }]);
  };

  const submitBatch = async () => {
    if (batch.length === 0) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/infection-control/hand-hygiene', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observations: batch }),
      });
      if (res.ok) {
        setMsg(tr(`تم حفظ ${batch.length} مراقبة`, `Saved ${batch.length} observations`));
        setBatch([]);
        await mutate();
      } else {
        const e = await res.json().catch(() => ({}));
        setMsg(e.error || tr('خطأ', 'Error'));
      }
    } finally { setBusy(false); }
  };

  const TARGET_RATE = 80; // CBAHI target

  return (
    <div className="space-y-6">
      {/* Overall Compliance + Target */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`rounded-2xl border-2 p-5 text-center ${overall.rate >= TARGET_RATE ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
          <HandMetal className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-5xl font-extrabold">{overall.rate}%</p>
          <p className="text-sm mt-1 font-medium">{tr('معدل الامتثال الكلي', 'Overall Compliance Rate')}</p>
          <p className="text-xs mt-1 opacity-60">{overall.compliant}/{overall.opportunities} {tr('مراقبة', 'observations')}</p>
        </div>
        <div className="rounded-2xl border p-5 text-center bg-card">
          <Target className="h-8 w-8 mx-auto mb-2 text-blue-500" />
          <p className="text-5xl font-extrabold text-blue-600">{TARGET_RATE}%</p>
          <p className="text-sm mt-1 font-medium">{tr('الهدف (CBAHI)', 'Target (CBAHI)')}</p>
        </div>
        <div className="rounded-2xl border p-5 text-center bg-card">
          <p className="text-5xl font-extrabold">{overall.opportunities}</p>
          <p className="text-sm mt-1 font-medium">{tr('إجمالي المراقبات', 'Total Observations')}</p>
          <p className="text-xs mt-1 text-muted-foreground">{tr('آخر 30 يوم', 'Last 30 days')}</p>
        </div>
      </div>

      {/* WHO 5 Moments */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-sm font-bold mb-4">{tr('لحظات نظافة اليدين الخمس (WHO)', 'WHO 5 Moments of Hand Hygiene')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {MOMENTS.map((m) => {
            const mData = byMoment.find((d) => d.moment === m.value);
            const rate = mData?.rate || 0;
            return (
              <div key={m.value} className="rounded-xl border p-3 text-center">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm mx-auto">{m.icon}</div>
                <p className="text-3xl font-extrabold mt-1">{rate}%</p>
                <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
                  <div className={`h-full rounded-full ${rate >= TARGET_RATE ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${Math.min(rate, 100)}%` }} />
                </div>
                <p className="text-[11px] mt-2 leading-tight">{tr(m.ar, m.en)}</p>
                <p className="text-[10px] text-muted-foreground">{mData?.compliant || 0}/{mData?.opportunities || 0}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Department + Staff Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By Department */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-bold mb-3">{tr('حسب القسم', 'By Department')}</h3>
          {byDepartment.length === 0 ? (
            <p className="text-xs text-muted-foreground">{tr('لا بيانات', 'No data')}</p>
          ) : (
            <div className="space-y-2">
              {byDepartment.map((d) => (
                <div key={d.department} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{d.department}</span>
                    <span className={`font-bold ${d.rate >= TARGET_RATE ? 'text-green-600' : 'text-red-600'}`}>{d.rate}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${d.rate >= TARGET_RATE ? 'bg-green-400' : 'bg-orange-400'}`} style={{ width: `${Math.min(d.rate, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By Staff Category */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-bold mb-3">{tr('حسب الفئة الوظيفية', 'By Staff Category')}</h3>
          {byStaffCategory.length === 0 ? (
            <p className="text-xs text-muted-foreground">{tr('لا بيانات', 'No data')}</p>
          ) : (
            <div className="space-y-2">
              {byStaffCategory.map((s) => {
                const cat = STAFF_CATEGORIES.find((c) => c.value === s.category);
                return (
                  <div key={s.category} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{cat ? tr(cat.ar, cat.en) : s.category}</span>
                      <span className={`font-bold ${s.rate >= TARGET_RATE ? 'text-green-600' : 'text-red-600'}`}>{s.rate}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${s.rate >= TARGET_RATE ? 'bg-green-400' : 'bg-orange-400'}`} style={{ width: `${Math.min(s.rate, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Observation Entry Form */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {tr('تسجيل مراقبات نظافة اليدين', 'Record Hand Hygiene Observations')}
          </h3>
          <Button variant={showForm ? 'secondary' : 'outline'} size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? tr('إخفاء', 'Hide') : tr('إظهار النموذج', 'Show Form')}
          </Button>
        </div>

        {showForm && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{tr('التاريخ', 'Date')}</Label>
                <Input type="date" value={obs.auditDate} onChange={(e) => setObs((o) => ({ ...o, auditDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{tr('القسم', 'Department')}</Label>
                <Select value={obs.department} onValueChange={(v) => setObs((o) => ({ ...o, department: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{tr('الفئة', 'Staff Category')}</Label>
                <Select value={obs.staffCategory} onValueChange={(v) => setObs((o) => ({ ...o, staffCategory: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{STAFF_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{tr(c.ar, c.en)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{tr('اللحظة', 'Moment')}</Label>
                <Select value={obs.moment} onValueChange={(v) => setObs((o) => ({ ...o, moment: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{MOMENTS.map((m) => <SelectItem key={m.value} value={m.value}>{m.icon} {tr(m.ar, m.en)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{tr('الطريقة', 'Method')}</Label>
                <Select value={obs.method} onValueChange={(v) => setObs((o) => ({ ...o, method: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{tr(m.ar, m.en)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{tr('ملتزم؟', 'Compliant?')}</Label>
                <div className="flex items-center gap-2 h-9">
                  <Checkbox checked={obs.compliant} onCheckedChange={(c) => setObs((o) => ({ ...o, compliant: Boolean(c) }))} />
                  <span className={`text-sm font-semibold ${obs.compliant ? 'text-green-600' : 'text-red-600'}`}>
                    {obs.compliant ? tr('نعم', 'Yes') : tr('لا', 'No')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" onClick={addToBatch} className="gap-1">
                <Plus className="h-3.5 w-3.5" />
                {tr('أضف للدفعة', 'Add to batch')}
              </Button>
              <span className="text-xs text-muted-foreground">
                {batch.length > 0 && `${batch.length} ${tr('مراقبة في الانتظار', 'observations pending')}`}
              </span>
            </div>

            {/* Batch preview */}
            {batch.length > 0 && (
              <div className="border rounded-xl p-3 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{tr('الدفعة', 'Batch')} ({batch.length})</span>
                  <Button size="sm" onClick={submitBatch} disabled={busy} className="gap-1">
                    <Save className="h-3.5 w-3.5" />
                    {busy ? tr('جاري...', 'Saving...') : tr('حفظ الكل', 'Save All')}
                  </Button>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {batch.map((b, i) => {
                    const mom = MOMENTS.find((m) => m.value === b.moment);
                    const cat = STAFF_CATEGORIES.find((c) => c.value === b.staffCategory);
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs bg-background rounded px-2 py-1">
                        <span className={`w-2 h-2 rounded-full ${b.compliant ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span>{b.department}</span>
                        <span className="text-muted-foreground">·</span>
                        <span>{cat ? tr(cat.ar, cat.en) : b.staffCategory}</span>
                        <span className="text-muted-foreground">·</span>
                        <span>{mom?.icon}</span>
                        <button
                          onClick={() => setBatch((bb) => bb.filter((_, j) => j !== i))}
                          className="text-red-500 hover:text-red-700 ml-auto"
                        >×</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {msg && <p className="text-xs text-green-600 font-medium">{msg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
