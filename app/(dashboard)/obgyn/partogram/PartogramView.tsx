'use client';
import { useLang } from '@/hooks/use-lang';
import useSWR from 'swr';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Baby, Clock, Plus, X, ChevronRight, Activity, Circle } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

const STATUS_CFG: Record<string, { ar: string; en: string; color: string; dot: string }> = {
  ACTIVE:      { ar: 'نشط',       en: 'Active',       color: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300',   dot: 'bg-green-500' },
  DELIVERED:   { ar: 'ولادة',     en: 'Delivered',    color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',       dot: 'bg-blue-500' },
  CSECTION:    { ar: 'قيصرية',    en: 'C-Section',    color: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300', dot: 'bg-orange-500' },
  TRANSFERRED: { ar: 'محوّل',     en: 'Transferred',  color: 'bg-muted text-foreground',          dot: 'bg-muted-foreground' },
};

// ─── Create Partogram Dialog ──────────────────────────────────────────────────
function CreatePartogramDialog({ onClose, onCreated, lang }: {
  onClose: () => void;
  onCreated: () => void;
  lang: string;
}) {
  const tr = (ar: string, en: string) => lang === 'ar' ? ar : en;
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    patientMasterId: '',
    episodeId: '',
    gestationalAge: '',
    gravidaPara: '',
    admissionTime: new Date().toISOString().slice(0, 16),
    cervixOnAdmission: '',
    presentingPart: 'VERTEX',
    fetalPosition: '',
    membraneStatus: 'INTACT',
    ruptureTime: '',
  });
  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.patientMasterId) {
      toast({ title: tr('معرّف المريضة مطلوب', 'Patient ID is required'), variant: 'destructive' as const });
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        patientMasterId: form.patientMasterId,
        episodeId: form.episodeId || undefined,
        admissionTime: form.admissionTime,
        gravidaPara: form.gravidaPara || undefined,
        gestationalAge: form.gestationalAge ? Number(form.gestationalAge) : undefined,
        cervixOnAdmission: form.cervixOnAdmission ? Number(form.cervixOnAdmission) : undefined,
        presentingPart: form.presentingPart,
        fetalPosition: form.fetalPosition || undefined,
        membraneStatus: form.membraneStatus,
        ruptureTime: form.ruptureTime || undefined,
      };
      const res = await fetch('/api/obgyn/partogram', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Failed'); }
      toast({ title: tr('تم فتح بارتوجراف', 'Partogram started') });
      onCreated();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error';
      toast({ title: tr('خطأ', 'Error'), description: msg, variant: 'destructive' as const });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">{tr('بارتوجراف جديد', 'New Partogram')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>{tr('معرّف المريضة *', 'Patient ID *')}</Label>
              <Input value={form.patientMasterId} onChange={e => set('patientMasterId', e.target.value)}
                placeholder="UUID" className="thea-input-focus" />
            </div>
            <div className="space-y-1">
              <Label>{tr('معرّف الحالة', 'Episode ID')}</Label>
              <Input value={form.episodeId} onChange={e => set('episodeId', e.target.value)}
                placeholder={tr('اختياري', 'Optional')} className="thea-input-focus" />
            </div>
            <div className="space-y-1">
              <Label>{tr('عمر الحمل (أسبوع)', 'Gestational Age (wk)')}</Label>
              <Input type="number" min={20} max={45} value={form.gestationalAge} onChange={e => set('gestationalAge', e.target.value)}
                className="thea-input-focus" />
            </div>
            <div className="space-y-1">
              <Label>{tr('الحمل والوضع (G P)', 'Gravida/Para')}</Label>
              <Input value={form.gravidaPara} onChange={e => set('gravidaPara', e.target.value)}
                placeholder="G2P1" className="thea-input-focus" />
            </div>
            <div className="space-y-1">
              <Label>{tr('وقت الدخول *', 'Admission Time *')}</Label>
              <Input type="datetime-local" value={form.admissionTime} onChange={e => set('admissionTime', e.target.value)}
                className="thea-input-focus" />
            </div>
            <div className="space-y-1">
              <Label>{tr('تمدد عنق الرحم (سم)', 'Cervix Dilation (cm)')}</Label>
              <Input type="number" min={0} max={10} step={0.5} value={form.cervixOnAdmission}
                onChange={e => set('cervixOnAdmission', e.target.value)} className="thea-input-focus" />
            </div>
            <div className="space-y-1">
              <Label>{tr('الجزء المتقدم', 'Presenting Part')}</Label>
              <Select value={form.presentingPart} onValueChange={v => set('presentingPart', v)}>
                <SelectTrigger className="thea-input-focus"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VERTEX">{tr('قمة الرأس', 'Vertex')}</SelectItem>
                  <SelectItem value="FACE">{tr('وجه', 'Face')}</SelectItem>
                  <SelectItem value="BROW">{tr('جبهة', 'Brow')}</SelectItem>
                  <SelectItem value="BREECH">{tr('مقعدي', 'Breech')}</SelectItem>
                  <SelectItem value="SHOULDER">{tr('كتف', 'Shoulder')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{tr('حالة الأغشية', 'Membrane Status')}</Label>
              <Select value={form.membraneStatus} onValueChange={v => set('membraneStatus', v)}>
                <SelectTrigger className="thea-input-focus"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INTACT">{tr('سليمة', 'Intact')}</SelectItem>
                  <SelectItem value="RUPTURED">{tr('متمزقة', 'Ruptured')}</SelectItem>
                  <SelectItem value="ARTIFICIAL">{tr('مصطنعة', 'Artificial Rupture')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.membraneStatus !== 'INTACT' && (
              <div className="space-y-1">
                <Label>{tr('وقت التمزق', 'Rupture Time')}</Label>
                <Input type="datetime-local" value={form.ruptureTime} onChange={e => set('ruptureTime', e.target.value)}
                  className="thea-input-focus" />
              </div>
            )}
            <div className="space-y-1">
              <Label>{tr('موضع الجنين', 'Fetal Position')}</Label>
              <Input value={form.fetalPosition} onChange={e => set('fetalPosition', e.target.value)}
                placeholder="e.g. LOA, ROA, OP" className="thea-input-focus" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>{tr('إلغاء', 'Cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('فتح البارتوجراف', 'Start Partogram')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Listing ─────────────────────────────────────────────────────────────
export function PartogramView() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [showCreate, setShowCreate] = useState(false);
  const { data, mutate } = useSWR(`/api/obgyn/partogram?status=${statusFilter}`, fetcher, { refreshInterval: 30000 });
  const partograms: Record<string, unknown>[] = data?.partograms ?? [];

  const elapsedLabel = (admittedAt: string) => {
    const mins = Math.round((Date.now() - new Date(admittedAt).getTime()) / 60000);
    if (mins < 60) return `${mins} ${tr('د', 'min')}`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}${tr('س', 'h')} ${m > 0 ? `${m}${tr('د', 'min')}` : ''}`;
  };

  const kpiActive  = partograms.filter(p => p.status === 'ACTIVE').length;
  const kpiDelivered = partograms.filter(p => p.status === 'DELIVERED').length;

  return (
    <div className="p-4 md:p-6 space-y-5" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {tr('مراقبة الولادة — البارتوجراف', 'Labor Monitoring — Partogram')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr('متابعة تقدم المخاض وحالة الجنين', 'Monitor labor progress and fetal wellbeing')}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1">
          <Plus className="h-4 w-4" />
          {tr('بارتوجراف جديد', 'New Partogram')}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: <Activity className="h-5 w-5 text-green-500 animate-pulse" />, label: tr('مخاض نشط', 'Active Labor'), value: kpiActive, color: 'text-green-600' },
          { icon: <Baby className="h-5 w-5 text-blue-500" />, label: tr('ولادات اليوم', "Today's Deliveries"), value: kpiDelivered, color: 'text-blue-600' },
          { icon: <Circle className="h-5 w-5 text-orange-400" />, label: tr('قيصرية', 'C-Section'), value: partograms.filter(p => p.status === 'CSECTION').length, color: 'text-orange-600' },
          { icon: <Baby className="h-5 w-5 text-muted-foreground" />, label: tr('الكل', 'Total'), value: partograms.length, color: 'text-foreground' },
        ].map(k => (
          <Card key={k.label} className="rounded-2xl">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">{k.icon}<p className="text-xs text-muted-foreground">{k.label}</p></div>
              <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-3 items-center flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 thea-input-focus"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">{tr('نشط', 'Active Labor')}</SelectItem>
            <SelectItem value="DELIVERED">{tr('ولادة مكتملة', 'Delivered')}</SelectItem>
            <SelectItem value="CSECTION">{tr('قيصرية', 'C-Section')}</SelectItem>
            <SelectItem value="TRANSFERRED">{tr('محوّل', 'Transferred')}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">{partograms.length} {tr('حالة', 'cases')}</p>
      </div>

      {/* Cards */}
      {partograms.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Baby className="h-14 w-14 mx-auto mb-3 opacity-20" />
          <p>{tr('لا توجد حالات', 'No labor cases')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {partograms.map((p) => {
            const cfg = STATUS_CFG[p.status as string] || STATUS_CFG['ACTIVE'];
            return (
              <Card key={p.id as string}
                className="rounded-2xl cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                onClick={() => router.push(`/obgyn/partogram/${p.id as string}`)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
                      <CardTitle className="text-sm">
                        {(p.gravidaPara as string) || 'G?P?'}
                        {p.gestationalAge ? ` · ${p.gestationalAge as number}w` : ''}
                      </CardTitle>
                    </div>
                    <Badge variant="secondary" className={`text-xs ${cfg.color}`}>
                      {tr(cfg.ar, cfg.en)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{tr('دخول:', 'Admitted:')} {new Date(p.admissionTime as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {p.status === 'ACTIVE' && (
                      <span className="text-amber-600 font-medium">{elapsedLabel(p.admissionTime as string)} {tr('مضت', 'elapsed')}</span>
                    )}
                  </div>
                  {(p.cervixOnAdmission as number) != null && (
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{tr('تمدد عنق الرحم', 'Cervical Dilation')}</span>
                        <span className="font-bold text-primary">{p.cervixOnAdmission as number} cm</span>
                      </div>
                      <div className="w-full bg-muted h-2 rounded-full">
                        <div className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${((p.cervixOnAdmission as number) / 10) * 100}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {p.presentingPart as string || '—'}
                      {p.fetalPosition ? ` · ${p.fetalPosition as string}` : ''}
                    </span>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span>{tr('عرض', 'View Chart')}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreatePartogramDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => mutate()}
          lang={language}
        />
      )}
    </div>
  );
}

export default PartogramView;
