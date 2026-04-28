'use client';

import { useState, useCallback, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Plus, Trash2, Save, AlertCircle, Droplets, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Shift = 'MORNING' | 'AFTERNOON' | 'NIGHT';

type IntakeType = 'IV_FLUID' | 'ORAL' | 'NG_TUBE' | 'BLOOD' | 'MEDICATION';
type OutputType = 'URINE' | 'DRAIN' | 'EMESIS' | 'STOOL' | 'INSENSIBLE';

interface IntakeItem {
  id: string;
  type: IntakeType;
  label: string;
  volume: number | '';
}

interface OutputItem {
  id: string;
  type: OutputType;
  label: string;
  volume: number | '';
}

interface FluidEntry {
  id: string;
  shift: Shift;
  shiftDate: string;
  intakes: IntakeItem[];
  outputs: OutputItem[];
  totalIntake: number;
  totalOutput: number;
  netBalance: number;
  notes: string | null;
}

interface FluidBalanceSheetProps {
  episodeId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIFTS: { value: Shift; labelAr: string; labelEn: string; color: string }[] = [
  { value: 'MORNING',   labelAr: 'صباحي',   labelEn: 'Morning',   color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 'AFTERNOON', labelAr: 'مسائي',   labelEn: 'Afternoon', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { value: 'NIGHT',     labelAr: 'ليلي',    labelEn: 'Night',     color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
];

const INTAKE_TYPES: { value: IntakeType; labelAr: string; labelEn: string }[] = [
  { value: 'IV_FLUID',   labelAr: 'سائل وريدي',  labelEn: 'IV Fluid' },
  { value: 'ORAL',       labelAr: 'فموي',          labelEn: 'Oral' },
  { value: 'NG_TUBE',    labelAr: 'أنبوب معدي',   labelEn: 'NG Tube' },
  { value: 'BLOOD',      labelAr: 'دم / مشتقات',  labelEn: 'Blood/Products' },
  { value: 'MEDICATION', labelAr: 'أدوية وريدية', labelEn: 'IV Medications' },
];

const OUTPUT_TYPES: { value: OutputType; labelAr: string; labelEn: string }[] = [
  { value: 'URINE',      labelAr: 'بول',          labelEn: 'Urine' },
  { value: 'DRAIN',      labelAr: 'تصريف',        labelEn: 'Drain' },
  { value: 'EMESIS',     labelAr: 'قيء',          labelEn: 'Emesis' },
  { value: 'STOOL',      labelAr: 'براز',         labelEn: 'Stool' },
  { value: 'INSENSIBLE', labelAr: 'فاقد غير محسوس', labelEn: 'Insensible Loss' },
];

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

const uid = () => Math.random().toString(36).slice(2, 9);

// ─── Component ────────────────────────────────────────────────────────────────

export function FluidBalanceSheet({ episodeId }: FluidBalanceSheetProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  // Date = today by default
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedShift, setSelectedShift] = useState<Shift>('MORNING');

  const apiUrl = `/api/ipd/episodes/${episodeId}/fluid-balance?shiftDate=${selectedDate}`;
  const { data, isLoading, error } = useSWR<{
    entries: FluidEntry[];
    totals: { totalIntake24h: number; totalOutput24h: number; netBalance24h: number };
  }>(apiUrl, fetcher);

  const entries = data?.entries ?? [];
  const totals24h = data?.totals ?? { totalIntake24h: 0, totalOutput24h: 0, netBalance24h: 0 };

  // Find existing entry for selected shift
  const existingEntry = useMemo(
    () => entries.find(e => e.shift === selectedShift),
    [entries, selectedShift]
  );

  // Local editable state for intakes/outputs
  const [intakes, setIntakes] = useState<IntakeItem[]>([]);
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Sync from existing entry when shift/date changes
  const loadEntry = useCallback((entry: FluidEntry | undefined) => {
    if (entry) {
      setIntakes((entry.intakes as IntakeItem[]) ?? []);
      setOutputs((entry.outputs as OutputItem[]) ?? []);
      setNotes(entry.notes ?? '');
    } else {
      setIntakes([]);
      setOutputs([]);
      setNotes('');
    }
  }, []);

  // When date or shift changes, reload
  const handleShiftChange = (s: Shift) => {
    setSelectedShift(s);
    const found = entries.find(e => e.shift === s);
    loadEntry(found);
  };

  const handleDateChange = (d: string) => {
    setSelectedDate(d);
    // Reset; SWR will refetch
    setIntakes([]);
    setOutputs([]);
    setNotes('');
  };

  // Totals
  const totalIntake = useMemo(
    () => intakes.reduce((s, i) => s + (Number(i.volume) || 0), 0), [intakes]
  );
  const totalOutput = useMemo(
    () => outputs.reduce((s, o) => s + (Number(o.volume) || 0), 0), [outputs]
  );
  const netBalance = totalIntake - totalOutput;

  const addIntake = () => {
    setIntakes(prev => [...prev, { id: uid(), type: 'IV_FLUID', label: '', volume: '' }]);
  };

  const addOutput = () => {
    setOutputs(prev => [...prev, { id: uid(), type: 'URINE', label: '', volume: '' }]);
  };

  const removeIntake = (id: string) => setIntakes(prev => prev.filter(i => i.id !== id));
  const removeOutput = (id: string) => setOutputs(prev => prev.filter(o => o.id !== id));

  const patchIntake = (id: string, key: keyof IntakeItem, val: string | number) => {
    setIntakes(prev => prev.map(i => i.id === id ? { ...i, [key]: val } : i));
  };

  const patchOutput = (id: string, key: keyof OutputItem, val: string | number) => {
    setOutputs(prev => prev.map(o => o.id === id ? { ...o, [key]: val } : o));
  };

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (existingEntry) {
        const res = await fetch(`/api/ipd/episodes/${episodeId}/fluid-balance`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id: existingEntry.id, intakes, outputs, notes }),
        });
        if (!res.ok) throw new Error();
      } else {
        const res = await fetch(`/api/ipd/episodes/${episodeId}/fluid-balance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ shift: selectedShift, shiftDate: selectedDate, intakes, outputs, notes }),
        });
        if (!res.ok) throw new Error();
      }
      showToast('success', tr('تم حفظ موازنة السوائل', 'Fluid balance saved'));
      mutate(apiUrl);
    } catch {
      showToast('error', tr('فشل الحفظ', 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  // Net balance color
  const netColor = netBalance > 200
    ? 'text-blue-700 bg-blue-50 border-blue-200'
    : netBalance < -200
      ? 'text-orange-700 bg-orange-50 border-orange-200'
      : 'text-green-700 bg-green-50 border-green-200';

  const net24Color = totals24h.netBalance24h > 500
    ? 'text-blue-700'
    : totals24h.netBalance24h < -500
      ? 'text-orange-700'
      : 'text-green-700';

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4" dir={dir}>
        <Droplets className="w-4 h-4 animate-pulse" />
        {tr('جاري تحميل سجلات السوائل...', 'Loading fluid balance...')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 p-4" dir={dir}>
        <AlertCircle className="w-4 h-4" />
        {tr('خطأ في تحميل البيانات', 'Error loading data')}
      </div>
    );
  }

  return (
    <div className="space-y-5" dir={dir}>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-white text-sm shadow-lg ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* 24-Hour Cumulative Summary */}
      <div className="bg-muted/50 border rounded-xl p-4">
        <p className="text-xs font-semibold text-muted-foreground mb-3">{tr('إجمالي 24 ساعة', '24-Hour Cumulative')} — {selectedDate}</p>
        <div className="grid grid-cols-3 gap-3">
          <KpiCard
            label={tr('إجمالي الوارد', 'Total Intake')}
            value={totals24h.totalIntake24h}
            unit="mL"
            color="text-blue-700"
            icon={<TrendingUp className="w-4 h-4 text-blue-500" />}
          />
          <KpiCard
            label={tr('إجمالي الصادر', 'Total Output')}
            value={totals24h.totalOutput24h}
            unit="mL"
            color="text-orange-700"
            icon={<TrendingDown className="w-4 h-4 text-orange-500" />}
          />
          <KpiCard
            label={tr('الموازنة الصافية', 'Net Balance')}
            value={totals24h.netBalance24h}
            unit="mL"
            color={net24Color}
            icon={<Minus className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Date + Shift Selectors */}
      <div className="flex flex-wrap gap-3 items-center">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('التاريخ', 'Date')}</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => handleDateChange(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('الوردية', 'Shift')}</label>
          <div className="flex gap-1.5">
            {SHIFTS.map(s => (
              <button
                key={s.value}
                onClick={() => handleShiftChange(s.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedShift === s.value
                    ? s.color
                    : 'bg-card text-muted-foreground border-border hover:border-border'
                }`}
              >
                {tr(s.labelAr, s.labelEn)}
                {entries.find(e => e.shift === s.value) && (
                  <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Net Balance for this shift */}
      <div className={`border rounded-xl px-4 py-3 flex items-center justify-between ${netColor}`}>
        <p className="text-sm font-semibold">{tr('الموازنة الصافية — هذه الوردية', 'Net Balance — This Shift')}</p>
        <p className="text-xl font-bold">
          {netBalance > 0 ? '+' : ''}{netBalance.toLocaleString()} mL
        </p>
      </div>

      {/* Intakes + Outputs columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* INTAKES */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b">
            <h4 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {tr('الوارد (Intakes)', 'Intakes')}
            </h4>
            <button
              onClick={addIntake}
              className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:text-blue-800"
            >
              <Plus className="w-3.5 h-3.5" />
              {tr('إضافة', 'Add')}
            </button>
          </div>
          <div className="p-3 space-y-2">
            {intakes.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">{tr('لا يوجد وارد. اضغط إضافة.', 'No intakes. Click Add.')}</p>
            )}
            {intakes.map(item => (
              <FluidRow
                key={item.id}
                value={item}
                types={INTAKE_TYPES}
                language={language}
                onChangeType={v => patchIntake(item.id, 'type', v)}
                onChangeLabel={v => patchIntake(item.id, 'label', v)}
                onChangeVolume={v => patchIntake(item.id, 'volume', v === '' ? '' : Number(v))}
                onRemove={() => removeIntake(item.id)}
                placeholderLabel={tr('وصف...', 'Description...')}
              />
            ))}
            {intakes.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs font-medium text-muted-foreground">{tr('إجمالي الوارد', 'Total Intake')}</span>
                <span className="text-sm font-bold text-blue-700">{totalIntake.toLocaleString()} mL</span>
              </div>
            )}
          </div>
        </div>

        {/* OUTPUTS */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-orange-50 border-b">
            <h4 className="text-sm font-semibold text-orange-800 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              {tr('الصادر (Outputs)', 'Outputs')}
            </h4>
            <button
              onClick={addOutput}
              className="flex items-center gap-1 text-xs text-orange-600 font-medium hover:text-orange-800"
            >
              <Plus className="w-3.5 h-3.5" />
              {tr('إضافة', 'Add')}
            </button>
          </div>
          <div className="p-3 space-y-2">
            {outputs.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">{tr('لا يوجد صادر. اضغط إضافة.', 'No outputs. Click Add.')}</p>
            )}
            {outputs.map(item => (
              <FluidRow
                key={item.id}
                value={item}
                types={OUTPUT_TYPES}
                language={language}
                onChangeType={v => patchOutput(item.id, 'type', v)}
                onChangeLabel={v => patchOutput(item.id, 'label', v)}
                onChangeVolume={v => patchOutput(item.id, 'volume', v === '' ? '' : Number(v))}
                onRemove={() => removeOutput(item.id)}
                placeholderLabel={tr('وصف...', 'Description...')}
              />
            ))}
            {outputs.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs font-medium text-muted-foreground">{tr('إجمالي الصادر', 'Total Output')}</span>
                <span className="text-sm font-bold text-orange-700">{totalOutput.toLocaleString()} mL</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notes + Save */}
      <div className="bg-card border rounded-xl p-4 space-y-3">
        <label className="text-xs font-medium text-muted-foreground block">{tr('ملاحظات', 'Notes')}</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder={tr('ملاحظات السوائل للوردية...', 'Fluid notes for this shift...')}
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving
            ? tr('جاري الحفظ...', 'Saving...')
            : existingEntry
              ? tr('تحديث الوردية', 'Update Shift')
              : tr('حفظ الوردية', 'Save Shift')
          }
        </button>
      </div>
    </div>
  );
}

// ─── FluidRow ─────────────────────────────────────────────────────────────────

function FluidRow<T extends { value: string; labelAr: string; labelEn: string }>({
  value, types, language, onChangeType, onChangeLabel, onChangeVolume, onRemove, placeholderLabel,
}: {
  value: { type: string; label: string; volume: number | string };
  types: T[];
  language: string;
  onChangeType: (v: string) => void;
  onChangeLabel: (v: string) => void;
  onChangeVolume: (v: string) => void;
  onRemove: () => void;
  placeholderLabel: string;
}) {
  const selectedType = types.find(t => t.value === value.type);
  return (
    <div className="flex items-center gap-2">
      <select
        value={value.type}
        onChange={e => onChangeType(e.target.value)}
        className="border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none min-w-[100px]"
      >
        {types.map(t => (
          <option key={t.value} value={t.value}>
            {language === 'ar' ? t.labelAr : t.labelEn}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={value.label}
        onChange={e => onChangeLabel(e.target.value)}
        placeholder={placeholderLabel}
        className="flex-1 border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
      />
      <input
        type="number"
        value={value.volume}
        onChange={e => onChangeVolume(e.target.value)}
        placeholder="mL"
        min={0}
        className="w-20 border rounded px-2 py-1.5 text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
      />
      <button onClick={onRemove} className="text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, unit, color, icon,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-card border rounded-lg p-3 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>
        {value > 0 ? '+' : ''}{value.toLocaleString()}
      </p>
      <p className="text-[10px] text-muted-foreground">{unit}</p>
    </div>
  );
}
