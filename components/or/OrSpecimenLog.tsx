'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  FlaskConical,
  Plus,
  CheckCircle2,
  ArrowRight,
  Send,
  Clock,
  X,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface Props {
  caseId: string;
  patientMasterId?: string;
  tr: (ar: string, en: string) => string;
  language: string;
}

const SPECIMEN_TYPES = [
  { value: 'BIOPSY',         ar: 'خزعة',          en: 'Biopsy' },
  { value: 'EXCISION',       ar: 'استئصال',       en: 'Excision' },
  { value: 'RESECTION',      ar: 'قطع',           en: 'Resection' },
  { value: 'FLUID',          ar: 'سائل',          en: 'Fluid' },
  { value: 'SWAB',           ar: 'مسحة',          en: 'Swab' },
  { value: 'CYTOLOGY',       ar: 'خلوي',          en: 'Cytology' },
  { value: 'FROZEN_SECTION', ar: 'مقطع مجمد',     en: 'Frozen Section' },
  { value: 'OTHER',          ar: 'أخرى',          en: 'Other' },
];

const DESTINATIONS = [
  { value: 'PATHOLOGY',     ar: 'علم الأمراض',     en: 'Pathology',     color: 'bg-purple-100 text-purple-800' },
  { value: 'MICROBIOLOGY',  ar: 'الأحياء الدقيقة', en: 'Microbiology',  color: 'bg-blue-100 text-blue-800' },
  { value: 'CYTOLOGY',      ar: 'علم الخلايا',     en: 'Cytology',      color: 'bg-pink-100 text-pink-800' },
  { value: 'HISTOLOGY',     ar: 'الأنسجة',        en: 'Histology',     color: 'bg-orange-100 text-orange-800' },
  { value: 'OTHER',         ar: 'أخرى',           en: 'Other',         color: 'bg-muted text-foreground' },
];

const FIXATIVES = [
  { value: 'FORMALIN', ar: 'فورمالين', en: 'Formalin' },
  { value: 'FROZEN',   ar: 'مجمد',    en: 'Frozen' },
  { value: 'FRESH',    ar: 'طازج',    en: 'Fresh' },
  { value: 'OTHER',    ar: 'أخرى',    en: 'Other' },
];

const emptyForm = {
  specimenLabel: '',
  specimenType: '',
  site: '',
  destination: '',
  fixative: '',
  containerType: '',
  quantity: 1,
  handedToName: '',
  notes: '',
};

export default function OrSpecimenLog({ caseId, tr, language }: Props) {
  const { data, mutate } = useSWR(`/api/or/cases/${caseId}/specimens`, fetcher);
  const specimens: any[] = data?.specimens || [];

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);

  const submitSpecimen = async () => {
    if (!form.specimenLabel.trim() || !form.specimenType || !form.destination) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/or/cases/${caseId}/specimens`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          collectedAt: new Date().toISOString(),
          handedToName: form.handedToName || undefined,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ ...emptyForm });
        await mutate();
      }
    } finally { setBusy(false); }
  };

  const confirmSent = async (specimenId: string) => {
    setBusy(true);
    try {
      await fetch(`/api/or/cases/${caseId}/specimens/${specimenId}/confirm-sent`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      await mutate();
    } finally { setBusy(false); }
  };

  const getDestColor = (dest: string) => DESTINATIONS.find((d) => d.value === dest)?.color || 'bg-muted text-foreground';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-purple-600" />
          {tr('سجل العينات الجراحية', 'Surgical Specimen Log')}
          {specimens.length > 0 && (
            <Badge variant="secondary" className="text-xs">{specimens.length}</Badge>
          )}
        </h3>
        <Button size="sm" className="gap-1 h-8" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? tr('إلغاء', 'Cancel') : tr('إضافة عينة', 'Add Specimen')}
        </Button>
      </div>

      {/* Add Specimen Form */}
      {showForm && (
        <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/10">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <label className="text-xs font-medium">{tr('تسمية العينة', 'Specimen Label')} <span className="text-red-500">*</span></label>
              <Input
                value={form.specimenLabel}
                onChange={(e) => setForm((f) => ({ ...f, specimenLabel: e.target.value }))}
                placeholder={tr('مثال: خزعة كتلة ثدي أيمن', 'e.g., Right breast mass biopsy')}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{tr('النوع', 'Type')} <span className="text-red-500">*</span></label>
              <Select value={form.specimenType} onValueChange={(v) => setForm((f) => ({ ...f, specimenType: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                <SelectContent>
                  {SPECIMEN_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{tr(t.ar, t.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{tr('الموقع التشريحي', 'Anatomical Site')}</label>
              <Input
                value={form.site}
                onChange={(e) => setForm((f) => ({ ...f, site: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{tr('الوجهة', 'Destination')} <span className="text-red-500">*</span></label>
              <Select value={form.destination} onValueChange={(v) => setForm((f) => ({ ...f, destination: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                <SelectContent>
                  {DESTINATIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{tr(d.ar, d.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{tr('المثبّت', 'Fixative')}</label>
              <Select value={form.fixative} onValueChange={(v) => setForm((f) => ({ ...f, fixative: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                <SelectContent>
                  {FIXATIVES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{tr(f.ar, f.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{tr('نوع الحاوية', 'Container Type')}</label>
              <Input
                value={form.containerType}
                onChange={(e) => setForm((f) => ({ ...f, containerType: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{tr('الكمية', 'Quantity')}</label>
              <Input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) || 1 }))}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-xs font-medium">{tr('سلم إلى (سلسلة الحفظ)', 'Handed To (Chain of Custody)')}</label>
              <Input
                value={form.handedToName}
                onChange={(e) => setForm((f) => ({ ...f, handedToName: e.target.value }))}
                placeholder={tr('اسم المستلم', 'Recipient name')}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-xs font-medium">{tr('ملاحظات', 'Notes')}</label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={submitSpecimen} disabled={busy || !form.specimenLabel.trim() || !form.specimenType || !form.destination}>
              {busy ? tr('جاري الحفظ...', 'Saving...') : tr('تسجيل العينة', 'Log Specimen')}
            </Button>
          </div>
        </div>
      )}

      {/* Specimens Table */}
      {specimens.length === 0 ? (
        <div className="text-center py-8">
          <FlaskConical className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{tr('لا عينات مسجلة لهذه العملية', 'No specimens logged for this case')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {specimens.map((s: any) => {
            const typeCfg = SPECIMEN_TYPES.find((t) => t.value === s.specimenType);
            const destCfg = DESTINATIONS.find((d) => d.value === s.destination);
            return (
              <div key={s.id} className="border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{s.specimenLabel}</span>
                      <Badge variant="secondary" className="text-[11px]">
                        {typeCfg ? tr(typeCfg.ar, typeCfg.en) : s.specimenType}
                      </Badge>
                      <Badge className={`text-[11px] ${getDestColor(s.destination)}`}>
                        {destCfg ? tr(destCfg.ar, destCfg.en) : s.destination}
                      </Badge>
                    </div>
                    {s.site && <p className="text-xs text-muted-foreground mt-0.5">{tr('الموقع', 'Site')}: {s.site}</p>}
                    {s.fixative && <p className="text-xs text-muted-foreground">{tr('المثبّت', 'Fixative')}: {s.fixative}</p>}
                  </div>
                  <div className="text-xs text-muted-foreground text-right flex-shrink-0">
                    <div className="flex items-center gap-1"><Clock className="h-3 w-3" />
                      {s.collectedAt ? new Date(s.collectedAt).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                    {s.quantity > 1 && <span>×{s.quantity}</span>}
                  </div>
                </div>

                {/* Chain of Custody Status */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 text-green-700">
                    <CheckCircle2 className="h-3 w-3" /> {tr('جُمعت', 'Collected')}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  {s.handedToName ? (
                    <span className="flex items-center gap-1 text-green-700">
                      <CheckCircle2 className="h-3 w-3" /> {tr('سُلمت إلى', 'Handed to')} {s.handedToName}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{tr('لم تُسلم بعد', 'Not handed off')}</span>
                  )}
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  {s.sentConfirmed ? (
                    <span className="flex items-center gap-1 text-green-700">
                      <CheckCircle2 className="h-3 w-3" /> {tr('تم الإرسال', 'Sent')}
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[11px] gap-1 text-blue-600"
                      onClick={() => confirmSent(s.id)}
                      disabled={busy}
                    >
                      <Send className="h-3 w-3" /> {tr('تأكيد الإرسال', 'Confirm Sent')}
                    </Button>
                  )}
                </div>

                {s.notes && (
                  <p className="text-xs text-muted-foreground">{s.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
