'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  SPECIALTIES,
  POSITIONING_OPTIONS,
  SKIN_PREP_OPTIONS,
  SUTURE_TYPES,
  SUTURE_SIZES,
  NEEDLE_TYPES,
  MED_ROUTES,
  MED_TIMING,
  COMMON_INSTRUMENTS,
  CARD_STATUS_CONFIG,
} from '@/lib/or/preferenceCardDefinitions';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface InstrumentItem {
  name: string;
  quantity: number;
  size: string;
  notes: string;
}

interface SutureItem {
  type: string;
  size: string;
  quantity: number;
  needle: string;
}

interface ImplantItem {
  name: string;
  manufacturer: string;
  catalog: string;
  size: string;
}

interface EquipmentItem {
  name: string;
  settings: string;
  notes: string;
}

interface MedicationItem {
  name: string;
  dose: string;
  route: string;
  timing: string;
}

/* ─── Constants ─────────────────────────────────────────────────────────── */

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

const emptyInstrument = (): InstrumentItem => ({ name: '', quantity: 1, size: '', notes: '' });
const emptySuture = (): SutureItem => ({ type: 'VICRYL', size: '3-0', quantity: 1, needle: 'TAPER' });
const emptyImplant = (): ImplantItem => ({ name: '', manufacturer: '', catalog: '', size: '' });
const emptyEquipment = (): EquipmentItem => ({ name: '', settings: '', notes: '' });
const emptyMedication = (): MedicationItem => ({ name: '', dose: '', route: 'IV', timing: 'INTRA_OP' });

/* ─── Form state interface ──────────────────────────────────────────────── */

interface CardForm {
  surgeonId: string;
  surgeonName: string;
  procedureName: string;
  procedureCode: string;
  specialty: string;
  estimatedDuration: string;
  roomPreference: string;
  instruments: InstrumentItem[];
  sutures: SutureItem[];
  implants: ImplantItem[];
  equipment: EquipmentItem[];
  medications: MedicationItem[];
  positioning: string;
  skinPrep: string;
  draping: string;
  specialRequests: string;
}

const emptyForm = (): CardForm => ({
  surgeonId: '',
  surgeonName: '',
  procedureName: '',
  procedureCode: '',
  specialty: '',
  estimatedDuration: '',
  roomPreference: '',
  instruments: [emptyInstrument()],
  sutures: [],
  implants: [],
  equipment: [],
  medications: [],
  positioning: '',
  skinPrep: '',
  draping: '',
  specialRequests: '',
});

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function OrPreferenceCards() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  /* ── Filters ─────────────────────────────────────────────────────────── */
  const [searchQuery, setSearchQuery] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  /* ── SWR ──────────────────────────────────────────────────────────────── */
  const queryParts = [
    searchQuery ? `search=${encodeURIComponent(searchQuery)}` : '',
    specialtyFilter && specialtyFilter !== 'ALL' ? `specialty=${specialtyFilter}` : '',
    statusFilter && statusFilter !== 'ALL' ? `status=${statusFilter}` : '',
  ].filter(Boolean).join('&');

  const { data: cardsData, mutate: mutateCards } = useSWR(
    `/api/or/preference-cards${queryParts ? `?${queryParts}` : ''}`,
    fetcher,
    { refreshInterval: 30000 }
  );
  const cards: any[] = Array.isArray(cardsData?.cards) ? cardsData.cards : [];

  /* ── Modals ──────────────────────────────────────────────────────────── */
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewCard, setViewCard] = useState<any | null>(null);
  const [formTab, setFormTab] = useState<'basic' | 'instruments' | 'sutures' | 'implants' | 'equipment' | 'medications' | 'setup'>('basic');
  const [form, setForm] = useState<CardForm>(emptyForm());

  /* ── KPIs ─────────────────────────────────────────────────────────────── */
  const kpiTotal = cards.length;
  const kpiActive = cards.filter((c) => c.status === 'ACTIVE').length;

  const kpiSpecialties = useMemo(() => {
    const set = new Set(cards.map((c) => c.specialty).filter(Boolean));
    return set.size;
  }, [cards]);

  const kpiMostUsed = useMemo(() => {
    if (cards.length === 0) return '-';
    const sorted = [...cards].sort((a, b) => {
      const aT = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
      const bT = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
      return bT - aT;
    });
    return sorted[0]?.procedureName || '-';
  }, [cards]);

  /* ── Helpers ──────────────────────────────────────────────────────────── */

  const specialtyLabel = (val: string) => {
    const s = SPECIALTIES.find((sp) => sp.value === val);
    return s ? tr(s.ar, s.en) : val || '-';
  };

  const positioningLabel = (val: string) => {
    const p = POSITIONING_OPTIONS.find((pp) => pp.value === val);
    return p ? tr(p.ar, p.en) : val || '-';
  };

  const skinPrepLabel = (val: string) => {
    const s = SKIN_PREP_OPTIONS.find((sp) => sp.value === val);
    return s ? tr(s.ar, s.en) : val || '-';
  };

  const sutureLabel = (val: string) => {
    const s = SUTURE_TYPES.find((st) => st.value === val);
    return s ? tr(s.ar, s.en) : val || '-';
  };

  const needleLabel = (val: string) => {
    const n = NEEDLE_TYPES.find((nt) => nt.value === val);
    return n ? tr(n.ar, n.en) : val || '-';
  };

  const medRouteLabel = (val: string) => {
    const r = MED_ROUTES.find((mr) => mr.value === val);
    return r ? tr(r.ar, r.en) : val || '-';
  };

  const medTimingLabel = (val: string) => {
    const t = MED_TIMING.find((mt) => mt.value === val);
    return t ? tr(t.ar, t.en) : val || '-';
  };

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  /* ── Form helpers ────────────────────────────────────────────────────── */

  const updateFormField = <K extends keyof CardForm>(key: K, value: CardForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const addInstrument = () => updateFormField('instruments', [...form.instruments, emptyInstrument()]);
  const removeInstrument = (i: number) => updateFormField('instruments', form.instruments.filter((_, idx) => idx !== i));

  const addSuture = () => updateFormField('sutures', [...form.sutures, emptySuture()]);
  const removeSuture = (i: number) => updateFormField('sutures', form.sutures.filter((_, idx) => idx !== i));

  const addImplant = () => updateFormField('implants', [...form.implants, emptyImplant()]);
  const removeImplant = (i: number) => updateFormField('implants', form.implants.filter((_, idx) => idx !== i));

  const addEquipment = () => updateFormField('equipment', [...form.equipment, emptyEquipment()]);
  const removeEquipment = (i: number) => updateFormField('equipment', form.equipment.filter((_, idx) => idx !== i));

  const addMedication = () => updateFormField('medications', [...form.medications, emptyMedication()]);
  const removeMedication = (i: number) => updateFormField('medications', form.medications.filter((_, idx) => idx !== i));

  const updateInstrument = (i: number, field: keyof InstrumentItem, value: string | number) => {
    const updated = [...form.instruments];
    updated[i] = { ...updated[i], [field]: value };
    updateFormField('instruments', updated);
  };

  const updateSuture = (i: number, field: keyof SutureItem, value: string | number) => {
    const updated = [...form.sutures];
    updated[i] = { ...updated[i], [field]: value };
    updateFormField('sutures', updated);
  };

  const updateImplant = (i: number, field: keyof ImplantItem, value: string) => {
    const updated = [...form.implants];
    updated[i] = { ...updated[i], [field]: value };
    updateFormField('implants', updated);
  };

  const updateEquipment = (i: number, field: keyof EquipmentItem, value: string) => {
    const updated = [...form.equipment];
    updated[i] = { ...updated[i], [field]: value };
    updateFormField('equipment', updated);
  };

  const updateMedication = (i: number, field: keyof MedicationItem, value: string) => {
    const updated = [...form.medications];
    updated[i] = { ...updated[i], [field]: value };
    updateFormField('medications', updated);
  };

  /* ── Quick-add instruments from specialty template ───────────────────── */
  const quickAddInstruments = () => {
    const specialtyKey = form.specialty;
    const templates = COMMON_INSTRUMENTS[specialtyKey];
    if (!templates || templates.length === 0) return;
    const newInstruments = templates.map((t) => ({
      name: tr(t.ar, t.en),
      quantity: 1,
      size: '',
      notes: '',
    }));
    updateFormField('instruments', [...form.instruments.filter((inst) => inst.name.trim()), ...newInstruments]);
  };

  /* ── Open create / edit ──────────────────────────────────────────────── */

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormTab('basic');
    setShowForm(true);
  };

  const openEdit = (card: any) => {
    setEditingId(card.id);
    setForm({
      surgeonId: card.surgeonId || '',
      surgeonName: card.surgeonName || '',
      procedureName: card.procedureName || '',
      procedureCode: card.procedureCode || '',
      specialty: card.specialty || '',
      estimatedDuration: card.estimatedDuration ? String(card.estimatedDuration) : '',
      roomPreference: card.roomPreference || '',
      instruments: Array.isArray(card.instruments) && card.instruments.length > 0 ? card.instruments : [emptyInstrument()],
      sutures: Array.isArray(card.sutures) ? card.sutures : [],
      implants: Array.isArray(card.implants) ? card.implants : [],
      equipment: Array.isArray(card.equipment) ? card.equipment : [],
      medications: Array.isArray(card.medications) ? card.medications : [],
      positioning: card.positioning || '',
      skinPrep: card.skinPrep || '',
      draping: card.draping || '',
      specialRequests: card.specialRequests || '',
    });
    setFormTab('basic');
    setShowForm(true);
  };

  const openDuplicate = (card: any) => {
    setEditingId(null);
    setForm({
      surgeonId: '',
      surgeonName: '',
      procedureName: card.procedureName ? `${card.procedureName} (${tr('نسخة', 'Copy')})` : '',
      procedureCode: '',
      specialty: card.specialty || '',
      estimatedDuration: card.estimatedDuration ? String(card.estimatedDuration) : '',
      roomPreference: card.roomPreference || '',
      instruments: Array.isArray(card.instruments) ? [...card.instruments] : [emptyInstrument()],
      sutures: Array.isArray(card.sutures) ? [...card.sutures] : [],
      implants: Array.isArray(card.implants) ? [...card.implants] : [],
      equipment: Array.isArray(card.equipment) ? [...card.equipment] : [],
      medications: Array.isArray(card.medications) ? [...card.medications] : [],
      positioning: card.positioning || '',
      skinPrep: card.skinPrep || '',
      draping: card.draping || '',
      specialRequests: card.specialRequests || '',
    });
    setFormTab('basic');
    setShowForm(true);
  };

  /* ── Save ─────────────────────────────────────────────────────────────── */

  const handleSave = async () => {
    if (!form.surgeonName || !form.procedureName || form.instruments.filter((inst) => inst.name.trim()).length === 0) return;
    setBusy(true);
    try {
      const payload: any = {
        ...form,
        instruments: form.instruments.filter((inst) => inst.name.trim()),
        sutures: form.sutures.filter((s) => s.type),
        implants: form.implants.filter((im) => im.name.trim()),
        equipment: form.equipment.filter((eq) => eq.name.trim()),
        medications: form.medications.filter((m) => m.name.trim()),
        estimatedDuration: form.estimatedDuration ? Number(form.estimatedDuration) : null,
      };

      if (editingId) {
        payload.id = editingId;
      }

      const res = await fetch('/api/or/preference-cards', {
        method: editingId ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowForm(false);
        setForm(emptyForm());
        setEditingId(null);
        await mutateCards();
      }
    } finally {
      setBusy(false);
    }
  };

  /* ── Archive / Activate ──────────────────────────────────────────────── */

  const handleToggleStatus = async (card: any) => {
    setBusy(true);
    try {
      await fetch('/api/or/preference-cards', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: card.id,
          status: card.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE',
        }),
      });
      await mutateCards();
    } finally {
      setBusy(false);
    }
  };

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="p-4 md:p-6 space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tr('بطاقات تفضيلات الجراح', 'OR Preference Cards')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('إدارة بطاقات تفضيلات الجراحين للعمليات', 'Manage surgeon preference cards for surgical procedures')}
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          {tr('+ بطاقة جديدة', '+ New Card')}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase">{tr('إجمالي البطاقات', 'Total Cards')}</p>
          <p className="text-2xl font-bold mt-1">{kpiTotal}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase">{tr('بطاقات نشطة', 'Active Cards')}</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{kpiActive}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase">{tr('التخصصات المغطاة', 'Specialties Covered')}</p>
          <p className="text-2xl font-bold mt-1">{kpiSpecialties}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase">{tr('الأكثر استخداماً', 'Most Used')}</p>
          <p className="text-lg font-semibold mt-1 truncate">{kpiMostUsed}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <Input
          className="w-64"
          placeholder={tr('بحث بالعملية...', 'Search by procedure...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={tr('التخصص', 'Specialty')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
            {SPECIALTIES.map((sp) => (
              <SelectItem key={sp.value} value={sp.value}>{tr(sp.ar, sp.en)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={tr('الحالة', 'Status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
            {Object.entries(CARD_STATUS_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{tr(cfg.ar, cfg.en)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(searchQuery || specialtyFilter || statusFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setSpecialtyFilter(''); setStatusFilter(''); }}>
            {tr('مسح الفلاتر', 'Clear Filters')}
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{tr('الجراح', 'Surgeon')}</th>
                <th className="px-4 py-3 text-start font-medium">{tr('العملية', 'Procedure')}</th>
                <th className="px-4 py-3 text-start font-medium">{tr('التخصص', 'Specialty')}</th>
                <th className="px-4 py-3 text-start font-medium">{tr('الأدوات', 'Instruments')}</th>
                <th className="px-4 py-3 text-start font-medium">{tr('آخر استخدام', 'Last Used')}</th>
                <th className="px-4 py-3 text-start font-medium">{tr('الحالة', 'Status')}</th>
                <th className="px-4 py-3 text-start font-medium">{tr('الإجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cards.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    {tr('لا توجد بطاقات تفضيل', 'No preference cards found')}
                  </td>
                </tr>
              )}
              {cards.map((card: any) => {
                const stCfg = CARD_STATUS_CONFIG[card.status] || CARD_STATUS_CONFIG.ACTIVE;
                const instCount = Array.isArray(card.instruments) ? card.instruments.length : 0;
                return (
                  <tr key={card.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{card.surgeonName || '-'}</td>
                    <td className="px-4 py-3">{card.procedureName}</td>
                    <td className="px-4 py-3">{specialtyLabel(card.specialty)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">{instCount}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(card.lastUsedAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stCfg.color}`}>
                        {tr(stCfg.ar, stCfg.en)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => setViewCard(card)}>
                          {tr('عرض', 'View')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(card)}>
                          {tr('تعديل', 'Edit')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openDuplicate(card)}>
                          {tr('نسخ', 'Copy')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────
       * CREATE / EDIT DIALOG
       * ────────────────────────────────────────────────────────────────── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>
              {editingId ? tr('تعديل بطاقة التفضيل', 'Edit Preference Card') : tr('بطاقة تفضيل جديدة', 'New Preference Card')}
            </DialogTitle>
          </DialogHeader>

          {/* Form tabs */}
          <div className="flex gap-1 border-b mb-4 overflow-x-auto">
            {([
              { key: 'basic', ar: 'المعلومات', en: 'Basic Info' },
              { key: 'instruments', ar: 'الأدوات', en: 'Instruments' },
              { key: 'sutures', ar: 'الخيوط', en: 'Sutures' },
              { key: 'implants', ar: 'الزرعات', en: 'Implants' },
              { key: 'equipment', ar: 'المعدات', en: 'Equipment' },
              { key: 'medications', ar: 'الأدوية', en: 'Medications' },
              { key: 'setup', ar: 'التجهيز', en: 'Setup' },
            ] as { key: typeof formTab; ar: string; en: string }[]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFormTab(tab.key)}
                className={`px-3 py-2 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  formTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tr(tab.ar, tab.en)}
                {tab.key === 'instruments' && form.instruments.filter((inst) => inst.name.trim()).length > 0 && (
                  <span className="ms-1 text-[10px] bg-primary/10 text-primary px-1.5 rounded-full">
                    {form.instruments.filter((inst) => inst.name.trim()).length}
                  </span>
                )}
                {tab.key === 'sutures' && form.sutures.length > 0 && (
                  <span className="ms-1 text-[10px] bg-primary/10 text-primary px-1.5 rounded-full">{form.sutures.length}</span>
                )}
                {tab.key === 'implants' && form.implants.length > 0 && (
                  <span className="ms-1 text-[10px] bg-primary/10 text-primary px-1.5 rounded-full">{form.implants.length}</span>
                )}
                {tab.key === 'equipment' && form.equipment.length > 0 && (
                  <span className="ms-1 text-[10px] bg-primary/10 text-primary px-1.5 rounded-full">{form.equipment.length}</span>
                )}
                {tab.key === 'medications' && form.medications.length > 0 && (
                  <span className="ms-1 text-[10px] bg-primary/10 text-primary px-1.5 rounded-full">{form.medications.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* ── Basic Info ──────────────────────────────────────────────── */}
          {formTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{tr('اسم الجراح', 'Surgeon Name')}</Label>
                  <Input value={form.surgeonName} onChange={(e) => updateFormField('surgeonName', e.target.value)} placeholder={tr('أدخل اسم الجراح', 'Enter surgeon name')} />
                </div>
                <div>
                  <Label>{tr('اسم العملية', 'Procedure Name')}</Label>
                  <Input value={form.procedureName} onChange={(e) => updateFormField('procedureName', e.target.value)} placeholder={tr('أدخل اسم العملية', 'Enter procedure name')} />
                </div>
                <div>
                  <Label>{tr('رمز العملية', 'Procedure Code')}</Label>
                  <Input value={form.procedureCode} onChange={(e) => updateFormField('procedureCode', e.target.value)} placeholder={tr('اختياري', 'Optional')} />
                </div>
                <div>
                  <Label>{tr('التخصص', 'Specialty')}</Label>
                  <Select value={form.specialty} onValueChange={(v) => updateFormField('specialty', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={tr('اختر التخصص', 'Select Specialty')} />
                    </SelectTrigger>
                    <SelectContent>
                      {SPECIALTIES.map((sp) => (
                        <SelectItem key={sp.value} value={sp.value}>{tr(sp.ar, sp.en)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{tr('المدة المقدرة (دقيقة)', 'Estimated Duration (min)')}</Label>
                  <Input type="number" value={form.estimatedDuration} onChange={(e) => updateFormField('estimatedDuration', e.target.value)} placeholder="60" />
                </div>
                <div>
                  <Label>{tr('تفضيل الغرفة', 'Room Preference')}</Label>
                  <Input value={form.roomPreference} onChange={(e) => updateFormField('roomPreference', e.target.value)} placeholder={tr('اختياري', 'Optional')} />
                </div>
              </div>
            </div>
          )}

          {/* ── Instruments ─────────────────────────────────────────────── */}
          {formTab === 'instruments' && (
            <div className="space-y-4">
              {form.specialty && COMMON_INSTRUMENTS[form.specialty] && (
                <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                  <p className="text-sm">
                    {tr(`إضافة أدوات ${specialtyLabel(form.specialty)} الشائعة`, `Quick-add common ${specialtyLabel(form.specialty)} instruments`)}
                  </p>
                  <Button size="sm" variant="outline" onClick={quickAddInstruments}>
                    {tr('إضافة سريعة', 'Quick Add')}
                  </Button>
                </div>
              )}

              {form.instruments.map((inst, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">{tr('أداة', 'Instrument')} #{i + 1}</p>
                    {form.instruments.length > 1 && (
                      <Button variant="ghost" size="sm" className="text-red-500 h-6 px-2" onClick={() => removeInstrument(i)}>
                        {tr('حذف', 'Remove')}
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="col-span-2">
                      <Input value={inst.name} onChange={(e) => updateInstrument(i, 'name', e.target.value)} placeholder={tr('اسم الأداة', 'Instrument name')} />
                    </div>
                    <Input type="number" value={inst.quantity} onChange={(e) => updateInstrument(i, 'quantity', Number(e.target.value) || 1)} placeholder={tr('الكمية', 'Qty')} />
                    <Input value={inst.size} onChange={(e) => updateInstrument(i, 'size', e.target.value)} placeholder={tr('الحجم', 'Size')} />
                  </div>
                  <Input value={inst.notes} onChange={(e) => updateInstrument(i, 'notes', e.target.value)} placeholder={tr('ملاحظات', 'Notes')} />
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addInstrument}>
                {tr('+ إضافة أداة', '+ Add Instrument')}
              </Button>
            </div>
          )}

          {/* ── Sutures ─────────────────────────────────────────────────── */}
          {formTab === 'sutures' && (
            <div className="space-y-4">
              {form.sutures.length === 0 && (
                <p className="text-sm text-muted-foreground">{tr('لا توجد خيوط مضافة', 'No sutures added yet')}</p>
              )}
              {form.sutures.map((sut, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">{tr('خيط', 'Suture')} #{i + 1}</p>
                    <Button variant="ghost" size="sm" className="text-red-500 h-6 px-2" onClick={() => removeSuture(i)}>
                      {tr('حذف', 'Remove')}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Select value={sut.type} onValueChange={(v) => updateSuture(i, 'type', v)}>
                      <SelectTrigger><SelectValue placeholder={tr('النوع', 'Type')} /></SelectTrigger>
                      <SelectContent>
                        {SUTURE_TYPES.map((st) => (
                          <SelectItem key={st.value} value={st.value}>{tr(st.ar, st.en)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={sut.size} onValueChange={(v) => updateSuture(i, 'size', v)}>
                      <SelectTrigger><SelectValue placeholder={tr('الحجم', 'Size')} /></SelectTrigger>
                      <SelectContent>
                        {SUTURE_SIZES.map((sz) => (
                          <SelectItem key={sz} value={sz}>{sz}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="number" value={sut.quantity} onChange={(e) => updateSuture(i, 'quantity', Number(e.target.value) || 1)} placeholder={tr('الكمية', 'Qty')} />
                    <Select value={sut.needle} onValueChange={(v) => updateSuture(i, 'needle', v)}>
                      <SelectTrigger><SelectValue placeholder={tr('الإبرة', 'Needle')} /></SelectTrigger>
                      <SelectContent>
                        {NEEDLE_TYPES.map((nt) => (
                          <SelectItem key={nt.value} value={nt.value}>{tr(nt.ar, nt.en)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addSuture}>
                {tr('+ إضافة خيط', '+ Add Suture')}
              </Button>
            </div>
          )}

          {/* ── Implants ────────────────────────────────────────────────── */}
          {formTab === 'implants' && (
            <div className="space-y-4">
              {form.implants.length === 0 && (
                <p className="text-sm text-muted-foreground">{tr('لا توجد زرعات مضافة', 'No implants added yet')}</p>
              )}
              {form.implants.map((imp, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">{tr('زرعة', 'Implant')} #{i + 1}</p>
                    <Button variant="ghost" size="sm" className="text-red-500 h-6 px-2" onClick={() => removeImplant(i)}>
                      {tr('حذف', 'Remove')}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Input value={imp.name} onChange={(e) => updateImplant(i, 'name', e.target.value)} placeholder={tr('الاسم', 'Name')} />
                    <Input value={imp.manufacturer} onChange={(e) => updateImplant(i, 'manufacturer', e.target.value)} placeholder={tr('الشركة المصنعة', 'Manufacturer')} />
                    <Input value={imp.catalog} onChange={(e) => updateImplant(i, 'catalog', e.target.value)} placeholder={tr('رقم الكتالوج', 'Catalog #')} />
                    <Input value={imp.size} onChange={(e) => updateImplant(i, 'size', e.target.value)} placeholder={tr('الحجم', 'Size')} />
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addImplant}>
                {tr('+ إضافة زرعة', '+ Add Implant')}
              </Button>
            </div>
          )}

          {/* ── Equipment ───────────────────────────────────────────────── */}
          {formTab === 'equipment' && (
            <div className="space-y-4">
              {form.equipment.length === 0 && (
                <p className="text-sm text-muted-foreground">{tr('لا توجد معدات مضافة', 'No equipment added yet')}</p>
              )}
              {form.equipment.map((eq, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">{tr('جهاز', 'Equipment')} #{i + 1}</p>
                    <Button variant="ghost" size="sm" className="text-red-500 h-6 px-2" onClick={() => removeEquipment(i)}>
                      {tr('حذف', 'Remove')}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input value={eq.name} onChange={(e) => updateEquipment(i, 'name', e.target.value)} placeholder={tr('اسم الجهاز', 'Equipment name')} />
                    <Input value={eq.settings} onChange={(e) => updateEquipment(i, 'settings', e.target.value)} placeholder={tr('الإعدادات', 'Settings')} />
                    <Input value={eq.notes} onChange={(e) => updateEquipment(i, 'notes', e.target.value)} placeholder={tr('ملاحظات', 'Notes')} />
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addEquipment}>
                {tr('+ إضافة جهاز', '+ Add Equipment')}
              </Button>
            </div>
          )}

          {/* ── Medications ──────────────────────────────────────────────── */}
          {formTab === 'medications' && (
            <div className="space-y-4">
              {form.medications.length === 0 && (
                <p className="text-sm text-muted-foreground">{tr('لا توجد أدوية مضافة', 'No medications added yet')}</p>
              )}
              {form.medications.map((med, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">{tr('دواء', 'Medication')} #{i + 1}</p>
                    <Button variant="ghost" size="sm" className="text-red-500 h-6 px-2" onClick={() => removeMedication(i)}>
                      {tr('حذف', 'Remove')}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Input value={med.name} onChange={(e) => updateMedication(i, 'name', e.target.value)} placeholder={tr('اسم الدواء', 'Medication name')} />
                    <Input value={med.dose} onChange={(e) => updateMedication(i, 'dose', e.target.value)} placeholder={tr('الجرعة', 'Dose')} />
                    <Select value={med.route} onValueChange={(v) => updateMedication(i, 'route', v)}>
                      <SelectTrigger><SelectValue placeholder={tr('الطريقة', 'Route')} /></SelectTrigger>
                      <SelectContent>
                        {MED_ROUTES.map((mr) => (
                          <SelectItem key={mr.value} value={mr.value}>{tr(mr.ar, mr.en)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={med.timing} onValueChange={(v) => updateMedication(i, 'timing', v)}>
                      <SelectTrigger><SelectValue placeholder={tr('التوقيت', 'Timing')} /></SelectTrigger>
                      <SelectContent>
                        {MED_TIMING.map((mt) => (
                          <SelectItem key={mt.value} value={mt.value}>{tr(mt.ar, mt.en)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addMedication}>
                {tr('+ إضافة دواء', '+ Add Medication')}
              </Button>
            </div>
          )}

          {/* ── Setup ───────────────────────────────────────────────────── */}
          {formTab === 'setup' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{tr('وضعية المريض', 'Patient Positioning')}</Label>
                  <Select value={form.positioning} onValueChange={(v) => updateFormField('positioning', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={tr('اختر الوضعية', 'Select positioning')} />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITIONING_OPTIONS.map((po) => (
                        <SelectItem key={po.value} value={po.value}>{tr(po.ar, po.en)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{tr('تحضير الجلد', 'Skin Prep')}</Label>
                  <Select value={form.skinPrep} onValueChange={(v) => updateFormField('skinPrep', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={tr('اختر التحضير', 'Select skin prep')} />
                    </SelectTrigger>
                    <SelectContent>
                      {SKIN_PREP_OPTIONS.map((sp) => (
                        <SelectItem key={sp.value} value={sp.value}>{tr(sp.ar, sp.en)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>{tr('التغطية', 'Draping')}</Label>
                <Textarea
                  value={form.draping}
                  onChange={(e) => updateFormField('draping', e.target.value)}
                  placeholder={tr('وصف طريقة التغطية...', 'Describe draping method...')}
                  rows={3}
                />
              </div>
              <div>
                <Label>{tr('طلبات خاصة', 'Special Requests')}</Label>
                <Textarea
                  value={form.specialRequests}
                  onChange={(e) => updateFormField('specialRequests', e.target.value)}
                  placeholder={tr('أي طلبات أو ملاحظات خاصة...', 'Any special requests or notes...')}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Save button */}
          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={busy}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={handleSave} disabled={busy || !form.surgeonName || !form.procedureName}>
              {busy
                ? tr('جاري الحفظ...', 'Saving...')
                : editingId
                ? tr('تحديث البطاقة', 'Update Card')
                : tr('إنشاء البطاقة', 'Create Card')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ──────────────────────────────────────────────────────────────────
       * VIEW DETAIL DIALOG
       * ────────────────────────────────────────────────────────────────── */}
      <Dialog open={!!viewCard} onOpenChange={(open) => !open && setViewCard(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{tr('بطاقة تفضيل الجراح', 'Surgeon Preference Card')}</DialogTitle>
          </DialogHeader>

          {viewCard && (
            <div className="space-y-6 mt-2">
              {/* Header info */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">{viewCard.procedureName}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(CARD_STATUS_CONFIG[viewCard.status] || CARD_STATUS_CONFIG.ACTIVE).color}`}>
                      {tr((CARD_STATUS_CONFIG[viewCard.status] || CARD_STATUS_CONFIG.ACTIVE).ar, (CARD_STATUS_CONFIG[viewCard.status] || CARD_STATUS_CONFIG.ACTIVE).en)}
                    </span>
                    <span className="text-xs text-muted-foreground">v{viewCard.version || 1}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">{tr('الجراح', 'Surgeon')}</p>
                    <p className="font-medium">{viewCard.surgeonName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{tr('التخصص', 'Specialty')}</p>
                    <p className="font-medium">{specialtyLabel(viewCard.specialty)}</p>
                  </div>
                  {viewCard.procedureCode && (
                    <div>
                      <p className="text-xs text-muted-foreground">{tr('رمز العملية', 'Code')}</p>
                      <p className="font-medium">{viewCard.procedureCode}</p>
                    </div>
                  )}
                  {viewCard.estimatedDuration && (
                    <div>
                      <p className="text-xs text-muted-foreground">{tr('المدة', 'Duration')}</p>
                      <p className="font-medium">{viewCard.estimatedDuration} {tr('دقيقة', 'min')}</p>
                    </div>
                  )}
                  {viewCard.roomPreference && (
                    <div>
                      <p className="text-xs text-muted-foreground">{tr('الغرفة', 'Room')}</p>
                      <p className="font-medium">{viewCard.roomPreference}</p>
                    </div>
                  )}
                  {viewCard.lastUsedAt && (
                    <div>
                      <p className="text-xs text-muted-foreground">{tr('آخر استخدام', 'Last Used')}</p>
                      <p className="font-medium">{fmtDate(viewCard.lastUsedAt)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Instruments */}
              {Array.isArray(viewCard.instruments) && viewCard.instruments.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">{tr('الأدوات', 'Instruments')} ({viewCard.instruments.length})</h4>
                  <div className="border rounded overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-start">{tr('الاسم', 'Name')}</th>
                          <th className="px-3 py-2 text-start">{tr('الكمية', 'Qty')}</th>
                          <th className="px-3 py-2 text-start">{tr('الحجم', 'Size')}</th>
                          <th className="px-3 py-2 text-start">{tr('ملاحظات', 'Notes')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {viewCard.instruments.map((inst: any, i: number) => (
                          <tr key={i}>
                            <td className="px-3 py-2">{inst.name}</td>
                            <td className="px-3 py-2">{inst.quantity || 1}</td>
                            <td className="px-3 py-2">{inst.size || '-'}</td>
                            <td className="px-3 py-2">{inst.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sutures */}
              {Array.isArray(viewCard.sutures) && viewCard.sutures.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">{tr('الخيوط', 'Sutures')} ({viewCard.sutures.length})</h4>
                  <div className="border rounded overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-start">{tr('النوع', 'Type')}</th>
                          <th className="px-3 py-2 text-start">{tr('الحجم', 'Size')}</th>
                          <th className="px-3 py-2 text-start">{tr('الكمية', 'Qty')}</th>
                          <th className="px-3 py-2 text-start">{tr('الإبرة', 'Needle')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {viewCard.sutures.map((sut: any, i: number) => (
                          <tr key={i}>
                            <td className="px-3 py-2">{sutureLabel(sut.type)}</td>
                            <td className="px-3 py-2">{sut.size || '-'}</td>
                            <td className="px-3 py-2">{sut.quantity || 1}</td>
                            <td className="px-3 py-2">{needleLabel(sut.needle)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Implants */}
              {Array.isArray(viewCard.implants) && viewCard.implants.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">{tr('الزرعات', 'Implants')} ({viewCard.implants.length})</h4>
                  <div className="border rounded overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-start">{tr('الاسم', 'Name')}</th>
                          <th className="px-3 py-2 text-start">{tr('الشركة', 'Manufacturer')}</th>
                          <th className="px-3 py-2 text-start">{tr('الكتالوج', 'Catalog')}</th>
                          <th className="px-3 py-2 text-start">{tr('الحجم', 'Size')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {viewCard.implants.map((imp: any, i: number) => (
                          <tr key={i}>
                            <td className="px-3 py-2">{imp.name}</td>
                            <td className="px-3 py-2">{imp.manufacturer || '-'}</td>
                            <td className="px-3 py-2">{imp.catalog || '-'}</td>
                            <td className="px-3 py-2">{imp.size || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Equipment */}
              {Array.isArray(viewCard.equipment) && viewCard.equipment.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">{tr('المعدات', 'Equipment')} ({viewCard.equipment.length})</h4>
                  <div className="border rounded overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-start">{tr('الاسم', 'Name')}</th>
                          <th className="px-3 py-2 text-start">{tr('الإعدادات', 'Settings')}</th>
                          <th className="px-3 py-2 text-start">{tr('ملاحظات', 'Notes')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {viewCard.equipment.map((eq: any, i: number) => (
                          <tr key={i}>
                            <td className="px-3 py-2">{eq.name}</td>
                            <td className="px-3 py-2">{eq.settings || '-'}</td>
                            <td className="px-3 py-2">{eq.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Medications */}
              {Array.isArray(viewCard.medications) && viewCard.medications.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">{tr('الأدوية', 'Medications')} ({viewCard.medications.length})</h4>
                  <div className="border rounded overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-start">{tr('الاسم', 'Name')}</th>
                          <th className="px-3 py-2 text-start">{tr('الجرعة', 'Dose')}</th>
                          <th className="px-3 py-2 text-start">{tr('الطريقة', 'Route')}</th>
                          <th className="px-3 py-2 text-start">{tr('التوقيت', 'Timing')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {viewCard.medications.map((med: any, i: number) => (
                          <tr key={i}>
                            <td className="px-3 py-2">{med.name}</td>
                            <td className="px-3 py-2">{med.dose || '-'}</td>
                            <td className="px-3 py-2">{medRouteLabel(med.route)}</td>
                            <td className="px-3 py-2">{medTimingLabel(med.timing)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Setup / Positioning */}
              {(viewCard.positioning || viewCard.skinPrep || viewCard.draping || viewCard.specialRequests) && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">{tr('التجهيز', 'Setup')}</h4>
                  <div className="border rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {viewCard.positioning && (
                      <div>
                        <p className="text-xs text-muted-foreground">{tr('وضعية المريض', 'Positioning')}</p>
                        <p className="font-medium">{positioningLabel(viewCard.positioning)}</p>
                      </div>
                    )}
                    {viewCard.skinPrep && (
                      <div>
                        <p className="text-xs text-muted-foreground">{tr('تحضير الجلد', 'Skin Prep')}</p>
                        <p className="font-medium">{skinPrepLabel(viewCard.skinPrep)}</p>
                      </div>
                    )}
                    {viewCard.draping && (
                      <div className="col-span-full">
                        <p className="text-xs text-muted-foreground">{tr('التغطية', 'Draping')}</p>
                        <p className="font-medium">{viewCard.draping}</p>
                      </div>
                    )}
                    {viewCard.specialRequests && (
                      <div className="col-span-full">
                        <p className="text-xs text-muted-foreground">{tr('طلبات خاصة', 'Special Requests')}</p>
                        <p className="font-medium">{viewCard.specialRequests}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => { setViewCard(null); openDuplicate(viewCard); }}>
                  {tr('نسخ البطاقة', 'Duplicate Card')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setViewCard(null); openEdit(viewCard); }}>
                  {tr('تعديل', 'Edit')}
                </Button>
                <Button
                  variant={viewCard.status === 'ACTIVE' ? 'destructive' : 'default'}
                  size="sm"
                  onClick={() => { handleToggleStatus(viewCard); setViewCard(null); }}
                  disabled={busy}
                >
                  {viewCard.status === 'ACTIVE' ? tr('أرشفة', 'Archive') : tr('تفعيل', 'Activate')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
