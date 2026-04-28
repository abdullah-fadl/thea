'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  User,
  Droplets,
  Timer,
  Zap,
  Heart,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Pencil,
  Save,
  Plus,
  Trash2,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface Props {
  caseId: string;
  tr: (ar: string, en: string) => string;
  language: string;
}

const POSITIONS = [
  { value: 'SUPINE',                    ar: 'استلقاء ظهري',     en: 'Supine' },
  { value: 'PRONE',                     ar: 'استلقاء بطني',     en: 'Prone' },
  { value: 'LATERAL_L',                 ar: 'جانبي أيسر',      en: 'Left Lateral' },
  { value: 'LATERAL_R',                 ar: 'جانبي أيمن',      en: 'Right Lateral' },
  { value: 'LITHOTOMY',                 ar: 'وضع التفتيت',     en: 'Lithotomy' },
  { value: 'TRENDELENBURG',             ar: 'تريندلنبرغ',      en: 'Trendelenburg' },
  { value: 'REVERSE_TRENDELENBURG',     ar: 'تريندلنبرغ معكوس', en: 'Reverse Trendelenburg' },
  { value: 'SITTING',                   ar: 'جلوس',           en: 'Sitting' },
  { value: 'BEACH_CHAIR',              ar: 'كرسي شاطئ',      en: 'Beach Chair' },
];

const SKIN_AGENTS = [
  { value: 'BETADINE',       ar: 'بيتادين',        en: 'Betadine' },
  { value: 'CHLORHEXIDINE',  ar: 'كلورهيكسيدين',   en: 'Chlorhexidine' },
  { value: 'ALCOHOL',        ar: 'كحول',           en: 'Alcohol' },
  { value: 'IODINE',         ar: 'يود',            en: 'Iodine' },
  { value: 'OTHER',          ar: 'أخرى',           en: 'Other' },
];

const SKIN_INTEGRITY = [
  { value: 'INTACT', ar: 'سليم', en: 'Intact' },
  { value: 'RASH',   ar: 'طفح',  en: 'Rash' },
  { value: 'WOUND',  ar: 'جرح',  en: 'Wound' },
  { value: 'OTHER',  ar: 'أخرى', en: 'Other' },
];

const CAUTERY_TYPES = [
  { value: 'MONOPOLAR', ar: 'أحادي القطب',  en: 'Monopolar' },
  { value: 'BIPOLAR',   ar: 'ثنائي القطب',  en: 'Bipolar' },
  { value: 'BOTH',      ar: 'كلاهما',       en: 'Both' },
];

interface PositionAid { aid: string; location: string }

export default function OrCirculatingNurseDoc({ caseId, tr, language }: Props) {
  const { data, mutate } = useSWR(`/api/or/cases/${caseId}/nursing-doc`, fetcher);
  const existing = data?.nursingDoc;

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    positioning: true, skinPrep: true, tourniquet: true, cautery: true, bloodLoss: true, notes: true,
  });

  // Form state
  const [position, setPosition] = useState('');
  const [positionAids, setPositionAids] = useState<PositionAid[]>([]);
  const [positionVerifiedBy, setPositionVerifiedBy] = useState('');
  const [skinPrepAgent, setSkinPrepAgent] = useState('');
  const [skinPrepArea, setSkinPrepArea] = useState('');
  const [skinIntegrityPreOp, setSkinIntegrityPreOp] = useState('');
  const [skinIntegrityPostOp, setSkinIntegrityPostOp] = useState('');
  const [tourniquetUsed, setTourniquetUsed] = useState(false);
  const [tourniquetSite, setTourniquetSite] = useState('');
  const [tourniquetPressure, setTourniquetPressure] = useState('');
  const [tourniquetOnTime, setTourniquetOnTime] = useState('');
  const [tourniquetOffTime, setTourniquetOffTime] = useState('');
  const [electrocauteryUsed, setElectrocauteryUsed] = useState(false);
  const [electrocauteryType, setElectrocauteryType] = useState('');
  const [cutPower, setCutPower] = useState('');
  const [coagPower, setCoagPower] = useState('');
  const [groundPadPlacement, setGroundPadPlacement] = useState('');
  const [estimatedBloodLossMl, setEstimatedBloodLossMl] = useState('');
  const [irrigationUsedMl, setIrrigationUsedMl] = useState('');
  const [drainType, setDrainType] = useState('');
  const [drainOutput, setDrainOutput] = useState('');
  const [nursingNotes, setNursingNotes] = useState('');

  // Populate from existing
  useEffect(() => {
    if (existing) {
      setPosition(existing.position || '');
      setPositionAids(Array.isArray(existing.positionAids) ? existing.positionAids : []);
      setPositionVerifiedBy(existing.positionVerifiedBy || '');
      setSkinPrepAgent(existing.skinPrepAgent || '');
      setSkinPrepArea(existing.skinPrepArea || '');
      setSkinIntegrityPreOp(existing.skinIntegrityPreOp || '');
      setSkinIntegrityPostOp(existing.skinIntegrityPostOp || '');
      setTourniquetUsed(Boolean(existing.tourniquetUsed));
      setTourniquetSite(existing.tourniquetSite || '');
      setTourniquetPressure(existing.tourniquetPressure ? String(existing.tourniquetPressure) : '');
      setTourniquetOnTime(existing.tourniquetOnTime ? new Date(existing.tourniquetOnTime).toISOString().slice(0, 16) : '');
      setTourniquetOffTime(existing.tourniquetOffTime ? new Date(existing.tourniquetOffTime).toISOString().slice(0, 16) : '');
      setElectrocauteryUsed(Boolean(existing.electrocauteryUsed));
      setElectrocauteryType(existing.electrocauteryType || '');
      const settings = existing.electrocauterySettings || {};
      setCutPower(settings.cutPower ? String(settings.cutPower) : '');
      setCoagPower(settings.coagPower ? String(settings.coagPower) : '');
      setGroundPadPlacement(existing.groundPadPlacement || '');
      setEstimatedBloodLossMl(existing.estimatedBloodLossMl != null ? String(existing.estimatedBloodLossMl) : '');
      setIrrigationUsedMl(existing.irrigationUsedMl != null ? String(existing.irrigationUsedMl) : '');
      setDrainType(existing.drainType || '');
      setDrainOutput(existing.drainOutput || '');
      setNursingNotes(existing.nursingNotes || '');
    }
  }, [existing]);

  // Tourniquet total
  let tourniquetTotalMin: number | null = null;
  if (tourniquetUsed && tourniquetOnTime && tourniquetOffTime) {
    const diff = new Date(tourniquetOffTime).getTime() - new Date(tourniquetOnTime).getTime();
    if (diff > 0) tourniquetTotalMin = Math.round(diff / 60000);
  }

  const toggleSection = (key: string) => setExpandedSections((p) => ({ ...p, [key]: !p[key] }));

  const saveDoc = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/or/cases/${caseId}/nursing-doc`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: position || undefined,
          positionAids: positionAids.length > 0 ? positionAids : undefined,
          positionVerifiedBy: positionVerifiedBy || undefined,
          skinPrepAgent: skinPrepAgent || undefined,
          skinPrepArea: skinPrepArea || undefined,
          skinIntegrityPreOp: skinIntegrityPreOp || undefined,
          skinIntegrityPostOp: skinIntegrityPostOp || undefined,
          tourniquetUsed,
          tourniquetSite: tourniquetSite || undefined,
          tourniquetPressure: tourniquetPressure ? Number(tourniquetPressure) : undefined,
          tourniquetOnTime: tourniquetOnTime || undefined,
          tourniquetOffTime: tourniquetOffTime || undefined,
          electrocauteryUsed,
          electrocauteryType: electrocauteryType || undefined,
          electrocauterySettings: (cutPower || coagPower) ? { cutPower: Number(cutPower) || 0, coagPower: Number(coagPower) || 0 } : undefined,
          groundPadPlacement: groundPadPlacement || undefined,
          estimatedBloodLossMl: estimatedBloodLossMl ? Number(estimatedBloodLossMl) : undefined,
          irrigationUsedMl: irrigationUsedMl ? Number(irrigationUsedMl) : undefined,
          drainType: drainType || undefined,
          drainOutput: drainOutput || undefined,
          nursingNotes: nursingNotes || undefined,
        }),
      });
      if (res.ok) {
        setEditing(false);
        await mutate();
      }
    } finally { setBusy(false); }
  };

  const isReadOnly = existing && !editing;

  const SectionHeader = ({ label, icon, sectionKey }: { label: string; icon: React.ReactNode; sectionKey: string }) => (
    <button
      className="w-full flex items-center justify-between py-2 text-sm font-bold"
      onClick={() => toggleSection(sectionKey)}
    >
      <span className="flex items-center gap-2">{icon} {label}</span>
      {expandedSections[sectionKey] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Edit/View toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <FileText className="h-4 w-4 text-teal-600" />
          {tr('توثيق الممرض/ة الجوال/ة', 'Circulating Nurse Documentation')}
        </h3>
        {existing && !editing && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setEditing(true)}>
            <Pencil className="h-3 w-3" /> {tr('تعديل', 'Edit')}
          </Button>
        )}
      </div>

      {/* Section 1: Patient Positioning */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-4 border-b border-border bg-muted/20">
          <SectionHeader label={tr('وضعية المريض', 'Patient Positioning')} icon={<User className="h-4 w-4 text-blue-600" />} sectionKey="positioning" />
        </div>
        {expandedSections.positioning && (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">{tr('الوضعية', 'Position')}</label>
                {isReadOnly ? (
                  <p className="text-sm">{POSITIONS.find((p) => p.value === position) ? tr(POSITIONS.find((p) => p.value === position)!.ar, POSITIONS.find((p) => p.value === position)!.en) : position || '—'}</p>
                ) : (
                  <Select value={position} onValueChange={setPosition}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                    <SelectContent>
                      {POSITIONS.map((p) => <SelectItem key={p.value} value={p.value}>{tr(p.ar, p.en)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">{tr('تحقق بواسطة', 'Verified By')}</label>
                {isReadOnly ? (
                  <p className="text-sm">{positionVerifiedBy || '—'}</p>
                ) : (
                  <Input value={positionVerifiedBy} onChange={(e) => setPositionVerifiedBy(e.target.value)} className="h-8 text-xs" placeholder={tr('معرف المستخدم', 'User ID')} />
                )}
              </div>
            </div>
            {/* Position Aids */}
            <div className="space-y-1">
              <label className="text-xs font-medium">{tr('وسائل تثبيت الوضعية', 'Positioning Aids')}</label>
              {isReadOnly ? (
                positionAids.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {positionAids.map((a, i) => <Badge key={i} variant="secondary" className="text-[11px]">{a.aid} @ {a.location}</Badge>)}
                  </div>
                ) : <p className="text-xs text-muted-foreground">—</p>
              ) : (
                <div className="space-y-1">
                  {positionAids.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input value={a.aid} onChange={(e) => { const n = [...positionAids]; n[i] = { ...n[i], aid: e.target.value }; setPositionAids(n); }} placeholder={tr('الوسيلة', 'Aid')} className="h-7 text-xs flex-1" />
                      <Input value={a.location} onChange={(e) => { const n = [...positionAids]; n[i] = { ...n[i], location: e.target.value }; setPositionAids(n); }} placeholder={tr('الموقع', 'Location')} className="h-7 text-xs flex-1" />
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPositionAids(positionAids.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => setPositionAids([...positionAids, { aid: '', location: '' }])}>
                    <Plus className="h-3 w-3" /> {tr('إضافة', 'Add')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Skin Prep */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-4 border-b border-border bg-muted/20">
          <SectionHeader label={tr('تحضير الجلد', 'Skin Preparation')} icon={<Droplets className="h-4 w-4 text-orange-600" />} sectionKey="skinPrep" />
        </div>
        {expandedSections.skinPrep && (
          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">{tr('المحلول المستخدم', 'Prep Agent')}</label>
              {isReadOnly ? (
                <p className="text-sm">{SKIN_AGENTS.find((a) => a.value === skinPrepAgent) ? tr(SKIN_AGENTS.find((a) => a.value === skinPrepAgent)!.ar, SKIN_AGENTS.find((a) => a.value === skinPrepAgent)!.en) : skinPrepAgent || '—'}</p>
              ) : (
                <Select value={skinPrepAgent} onValueChange={setSkinPrepAgent}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                  <SelectContent>{SKIN_AGENTS.map((a) => <SelectItem key={a.value} value={a.value}>{tr(a.ar, a.en)}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{tr('منطقة التحضير', 'Prep Area')}</label>
              {isReadOnly ? <p className="text-sm">{skinPrepArea || '—'}</p> : <Input value={skinPrepArea} onChange={(e) => setSkinPrepArea(e.target.value)} className="h-8 text-xs" />}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{tr('سلامة الجلد قبل', 'Skin Integrity Pre-Op')}</label>
              {isReadOnly ? (
                <p className="text-sm">{SKIN_INTEGRITY.find((s) => s.value === skinIntegrityPreOp) ? tr(SKIN_INTEGRITY.find((s) => s.value === skinIntegrityPreOp)!.ar, SKIN_INTEGRITY.find((s) => s.value === skinIntegrityPreOp)!.en) : skinIntegrityPreOp || '—'}</p>
              ) : (
                <Select value={skinIntegrityPreOp} onValueChange={setSkinIntegrityPreOp}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                  <SelectContent>{SKIN_INTEGRITY.map((s) => <SelectItem key={s.value} value={s.value}>{tr(s.ar, s.en)}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{tr('سلامة الجلد بعد', 'Skin Integrity Post-Op')}</label>
              {isReadOnly ? (
                <p className="text-sm">{SKIN_INTEGRITY.find((s) => s.value === skinIntegrityPostOp) ? tr(SKIN_INTEGRITY.find((s) => s.value === skinIntegrityPostOp)!.ar, SKIN_INTEGRITY.find((s) => s.value === skinIntegrityPostOp)!.en) : skinIntegrityPostOp || '—'}</p>
              ) : (
                <Select value={skinIntegrityPostOp} onValueChange={setSkinIntegrityPostOp}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                  <SelectContent>{SKIN_INTEGRITY.map((s) => <SelectItem key={s.value} value={s.value}>{tr(s.ar, s.en)}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Tourniquet */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-4 border-b border-border bg-muted/20">
          <SectionHeader label={tr('عاصبة (تورنيكيه)', 'Tourniquet')} icon={<Timer className="h-4 w-4 text-red-600" />} sectionKey="tourniquet" />
        </div>
        {expandedSections.tourniquet && (
          <div className="p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={tourniquetUsed} onCheckedChange={(c) => setTourniquetUsed(Boolean(c))} disabled={isReadOnly} />
              {tr('تم استخدام عاصبة', 'Tourniquet Used')}
            </label>
            {tourniquetUsed && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">{tr('الموقع', 'Site')}</label>
                  {isReadOnly ? <p className="text-sm">{tourniquetSite || '—'}</p> : <Input value={tourniquetSite} onChange={(e) => setTourniquetSite(e.target.value)} className="h-8 text-xs" />}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">{tr('الضغط (mmHg)', 'Pressure (mmHg)')}</label>
                  {isReadOnly ? <p className="text-sm">{tourniquetPressure || '—'}</p> : <Input type="number" value={tourniquetPressure} onChange={(e) => setTourniquetPressure(e.target.value)} className="h-8 text-xs" />}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">{tr('وقت التشغيل', 'On Time')}</label>
                  {isReadOnly ? <p className="text-sm">{tourniquetOnTime ? new Date(tourniquetOnTime).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US') : '—'}</p> : <Input type="datetime-local" value={tourniquetOnTime} onChange={(e) => setTourniquetOnTime(e.target.value)} className="h-8 text-xs" />}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">{tr('وقت الإيقاف', 'Off Time')}</label>
                  {isReadOnly ? <p className="text-sm">{tourniquetOffTime ? new Date(tourniquetOffTime).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US') : '—'}</p> : <Input type="datetime-local" value={tourniquetOffTime} onChange={(e) => setTourniquetOffTime(e.target.value)} className="h-8 text-xs" />}
                </div>
                {tourniquetTotalMin !== null && (
                  <div className="col-span-2">
                    <Badge className={tourniquetTotalMin > 120 ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-green-100 text-green-800'}>
                      {tr('المدة الإجمالية', 'Total Duration')}: {tourniquetTotalMin} {tr('دقيقة', 'min')}
                      {tourniquetTotalMin > 120 && (
                        <span className="ml-1 flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" /> {tr('> 120 دقيقة!', '> 120 min!')}</span>
                      )}
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 4: Electrocautery */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-4 border-b border-border bg-muted/20">
          <SectionHeader label={tr('الكي الكهربائي', 'Electrocautery')} icon={<Zap className="h-4 w-4 text-yellow-600" />} sectionKey="cautery" />
        </div>
        {expandedSections.cautery && (
          <div className="p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={electrocauteryUsed} onCheckedChange={(c) => setElectrocauteryUsed(Boolean(c))} disabled={isReadOnly} />
              {tr('تم استخدام الكي الكهربائي', 'Electrocautery Used')}
            </label>
            {electrocauteryUsed && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">{tr('النوع', 'Type')}</label>
                  {isReadOnly ? (
                    <p className="text-sm">{CAUTERY_TYPES.find((t) => t.value === electrocauteryType) ? tr(CAUTERY_TYPES.find((t) => t.value === electrocauteryType)!.ar, CAUTERY_TYPES.find((t) => t.value === electrocauteryType)!.en) : electrocauteryType || '—'}</p>
                  ) : (
                    <Select value={electrocauteryType} onValueChange={setElectrocauteryType}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>{CAUTERY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{tr(t.ar, t.en)}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">{tr('موضع لوحة الأرضية', 'Ground Pad Placement')}</label>
                  {isReadOnly ? <p className="text-sm">{groundPadPlacement || '—'}</p> : <Input value={groundPadPlacement} onChange={(e) => setGroundPadPlacement(e.target.value)} className="h-8 text-xs" />}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">{tr('طاقة القطع', 'Cut Power')}</label>
                  {isReadOnly ? <p className="text-sm">{cutPower || '—'}</p> : <Input type="number" value={cutPower} onChange={(e) => setCutPower(e.target.value)} className="h-8 text-xs" />}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">{tr('طاقة التخثر', 'Coag Power')}</label>
                  {isReadOnly ? <p className="text-sm">{coagPower || '—'}</p> : <Input type="number" value={coagPower} onChange={(e) => setCoagPower(e.target.value)} className="h-8 text-xs" />}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 5: Blood Loss & Drains */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-4 border-b border-border bg-muted/20">
          <SectionHeader label={tr('فقد الدم والمصارف', 'Blood Loss & Drains')} icon={<Heart className="h-4 w-4 text-red-600" />} sectionKey="bloodLoss" />
        </div>
        {expandedSections.bloodLoss && (
          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">{tr('فقد الدم المقدر (مل)', 'Estimated Blood Loss (mL)')}</label>
              {isReadOnly ? <p className="text-sm">{estimatedBloodLossMl || '—'} mL</p> : <Input type="number" value={estimatedBloodLossMl} onChange={(e) => setEstimatedBloodLossMl(e.target.value)} className="h-8 text-xs" />}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{tr('السوائل المستخدمة (مل)', 'Irrigation Used (mL)')}</label>
              {isReadOnly ? <p className="text-sm">{irrigationUsedMl || '—'} mL</p> : <Input type="number" value={irrigationUsedMl} onChange={(e) => setIrrigationUsedMl(e.target.value)} className="h-8 text-xs" />}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{tr('نوع المصرف', 'Drain Type')}</label>
              {isReadOnly ? <p className="text-sm">{drainType || '—'}</p> : <Input value={drainType} onChange={(e) => setDrainType(e.target.value)} className="h-8 text-xs" placeholder={tr('مثال: Jackson-Pratt', 'e.g., Jackson-Pratt')} />}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{tr('مخرجات المصرف', 'Drain Output')}</label>
              {isReadOnly ? <p className="text-sm">{drainOutput || '—'}</p> : <Input value={drainOutput} onChange={(e) => setDrainOutput(e.target.value)} className="h-8 text-xs" />}
            </div>
          </div>
        )}
      </div>

      {/* Section 6: Nursing Notes */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-4 border-b border-border bg-muted/20">
          <SectionHeader label={tr('ملاحظات التمريض', 'Nursing Notes')} icon={<FileText className="h-4 w-4 text-muted-foreground" />} sectionKey="notes" />
        </div>
        {expandedSections.notes && (
          <div className="p-4">
            {isReadOnly ? (
              <p className="text-sm whitespace-pre-wrap">{nursingNotes || tr('لا ملاحظات', 'No notes')}</p>
            ) : (
              <Textarea value={nursingNotes} onChange={(e) => setNursingNotes(e.target.value)} rows={3} />
            )}
          </div>
        )}
      </div>

      {/* Save Button */}
      {!isReadOnly && (
        <div className="flex justify-end">
          <Button onClick={saveDoc} disabled={busy} className="gap-2">
            <Save className="h-4 w-4" />
            {busy ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ التوثيق', 'Save Documentation')}
          </Button>
        </div>
      )}
    </div>
  );
}
