'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { CircleDot, Clipboard } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// ── Tooth Data ────────────────────────────────────────────────────────────────

const ADULT_TEETH = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft:  [21, 22, 23, 24, 25, 26, 27, 28],
  lowerLeft:  [31, 32, 33, 34, 35, 36, 37, 38],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
};

const CHILD_TEETH = {
  upperRight: [55, 54, 53, 52, 51],
  upperLeft:  [61, 62, 63, 64, 65],
  lowerLeft:  [71, 72, 73, 74, 75],
  lowerRight: [85, 84, 83, 82, 81],
};

const SURFACES = ['O', 'M', 'D', 'B', 'L'] as const;

const SURFACE_LABELS: Record<string, { ar: string; en: string }> = {
  O: { ar: 'إطباقي', en: 'Occlusal' },
  M: { ar: 'إنسي',   en: 'Mesial' },
  D: { ar: 'وحشي',   en: 'Distal' },
  B: { ar: 'شفوي',   en: 'Buccal' },
  L: { ar: 'لساني',  en: 'Lingual' },
};

const CONDITIONS = {
  healthy:    { color: '#ffffff', labelAr: 'سليم',       labelEn: 'Healthy',      border: '#d1d5db' },
  decay:      { color: '#ef4444', labelAr: 'تسوس',       labelEn: 'Decay',        border: '#dc2626' },
  filled:     { color: '#3b82f6', labelAr: 'حشوة',       labelEn: 'Filled',       border: '#2563eb' },
  crown:      { color: '#f59e0b', labelAr: 'تاج',        labelEn: 'Crown',        border: '#d97706' },
  missing:    { color: '#6b7280', labelAr: 'مفقود',      labelEn: 'Missing',      border: '#4b5563' },
  implant:    { color: '#8b5cf6', labelAr: 'زرعة',       labelEn: 'Implant',      border: '#7c3aed' },
  rootCanal:  { color: '#ec4899', labelAr: 'علاج عصب',  labelEn: 'Root Canal',   border: '#db2777' },
  extraction: { color: '#dc2626', labelAr: 'خلع مطلوب', labelEn: 'Extraction',   border: '#b91c1c' },
  bridge:     { color: '#14b8a6', labelAr: 'جسر',        labelEn: 'Bridge',       border: '#0d9488' },
};

type ConditionKey = keyof typeof CONDITIONS;

interface ToothCondition {
  toothNumber: number;
  surfaces: Record<string, ConditionKey>;
  notes: string;
}

// ── Procedure Catalog ─────────────────────────────────────────────────────────

const PROCEDURES = [
  { code: 'D0120', name: 'Periodic Oral Evaluation',      nameAr: 'فحص دوري',                     fee: 150  },
  { code: 'D0220', name: 'Periapical X-ray',              nameAr: 'أشعة حول الذروة',               fee: 80   },
  { code: 'D0330', name: 'Panoramic X-ray',               nameAr: 'أشعة بانورامية',                fee: 250  },
  { code: 'D1110', name: 'Prophylaxis (Cleaning)',        nameAr: 'تنظيف الأسنان',                 fee: 300  },
  { code: 'D2140', name: 'Amalgam Filling (1 surface)',   nameAr: 'حشوة أملغم (سطح واحد)',         fee: 200  },
  { code: 'D2330', name: 'Composite Filling (1 surface)', nameAr: 'حشوة كمبوزيت (سطح واحد)',       fee: 350  },
  { code: 'D2331', name: 'Composite Filling (2 surfaces)',nameAr: 'حشوة كمبوزيت (سطحان)',           fee: 450  },
  { code: 'D2750', name: 'Porcelain Crown',               nameAr: 'تاج خزف',                       fee: 2000 },
  { code: 'D3310', name: 'Root Canal - Anterior',         nameAr: 'علاج عصب أمامي',                fee: 800  },
  { code: 'D3320', name: 'Root Canal - Premolar',         nameAr: 'علاج عصب ضاحك',                 fee: 1000 },
  { code: 'D3330', name: 'Root Canal - Molar',            nameAr: 'علاج عصب طاحن',                 fee: 1400 },
  { code: 'D7140', name: 'Simple Extraction',             nameAr: 'خلع بسيط',                      fee: 350  },
  { code: 'D7210', name: 'Surgical Extraction',           nameAr: 'خلع جراحي',                     fee: 700  },
  { code: 'D6010', name: 'Endosteal Implant',             nameAr: 'زرعة سنية',                     fee: 5000 },
] as const;

// ── ToothSVG ──────────────────────────────────────────────────────────────────

function ToothSVG({
  number, condition, isSelected, onClick, onSurfaceClick,
}: {
  number: number;
  condition?: ToothCondition;
  isSelected: boolean;
  onClick: () => void;
  onSurfaceClick: (surface: string) => void;
}) {
  const get = (s: string) => CONDITIONS[condition?.surfaces?.[s] || 'healthy'];

  return (
    <svg
      width="46" height="58" viewBox="0 0 50 60"
      className={`cursor-pointer transition-transform hover:scale-110 ${isSelected ? 'ring-2 ring-blue-500 rounded' : ''}`}
      onClick={onClick}
    >
      <rect x="5" y="5" width="40" height="50" rx="5" fill={get('healthy').color} stroke="#374151" strokeWidth="2" />
      <rect x="15" y="20" width="20" height="20" fill={get('O').color} stroke="#374151" strokeWidth="1"
        onClick={(e) => { e.stopPropagation(); onSurfaceClick('O'); }} className="cursor-pointer" />
      <rect x="5" y="15" width="10" height="30" fill={get('M').color} stroke="#374151" strokeWidth="1"
        onClick={(e) => { e.stopPropagation(); onSurfaceClick('M'); }} className="cursor-pointer" />
      <rect x="35" y="15" width="10" height="30" fill={get('D').color} stroke="#374151" strokeWidth="1"
        onClick={(e) => { e.stopPropagation(); onSurfaceClick('D'); }} className="cursor-pointer" />
      <rect x="15" y="5" width="20" height="15" fill={get('B').color} stroke="#374151" strokeWidth="1"
        onClick={(e) => { e.stopPropagation(); onSurfaceClick('B'); }} className="cursor-pointer" />
      <rect x="15" y="40" width="20" height="15" fill={get('L').color} stroke="#374151" strokeWidth="1"
        onClick={(e) => { e.stopPropagation(); onSurfaceClick('L'); }} className="cursor-pointer" />
      <text x="25" y="57" textAnchor="middle" fontSize="9" fill="#374151">{number}</text>
    </svg>
  );
}

// ── Main DentalPanel ──────────────────────────────────────────────────────────

export default function DentalPanel({ patientId }: { patientId: string }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [tab, setTab] = useState<'chart' | 'treatment'>('chart');

  // ── Chart State ──
  const [chartType, setChartType] = useState<'adult' | 'child'>('adult');
  const [conditions, setConditions] = useState<Record<number, ToothCondition>>({});
  const [currentCondition, setCurrentCondition] = useState<ConditionKey>('decay');
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [savingChart, setSavingChart] = useState(false);

  const { data: chartData, mutate: mutateChart } = useSWR(
    `/api/dental/chart/${encodeURIComponent(patientId)}`, fetcher
  );

  useEffect(() => {
    if (chartData?.conditions) setConditions(chartData.conditions);
  }, [chartData]);

  const teeth = chartType === 'adult' ? ADULT_TEETH : CHILD_TEETH;

  const handleSurfaceClick = (toothNumber: number, surface: string) => {
    setSelectedTooth(toothNumber);
    setConditions((prev) => {
      const tooth = prev[toothNumber] || { toothNumber, surfaces: {}, notes: '' };
      return {
        ...prev,
        [toothNumber]: { ...tooth, surfaces: { ...tooth.surfaces, [surface]: currentCondition } },
      };
    });
  };

  const saveChart = async () => {
    setSavingChart(true);
    await fetch(`/api/dental/chart/${encodeURIComponent(patientId)}`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conditions }),
    });
    await mutateChart();
    setSavingChart(false);
  };

  // ── Treatment State ──
  const { data: treatmentData, mutate: mutateTreatment } = useSWR(
    `/api/dental/treatment/${encodeURIComponent(patientId)}`, fetcher
  );
  const items: any[] = treatmentData?.items ?? [];

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ toothNumber: '', surface: '', procedureCode: '', notes: '' });
  const [addingItem, setAddingItem] = useState(false);

  const addTreatment = async () => {
    if (!addForm.procedureCode || !addForm.toothNumber) return;
    const proc = PROCEDURES.find((p) => p.code === addForm.procedureCode);
    if (!proc) return;
    setAddingItem(true);
    await fetch(`/api/dental/treatment/${encodeURIComponent(patientId)}`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        toothNumber: addForm.toothNumber,
        surface: addForm.surface,
        procedureCode: proc.code,
        procedureName: proc.name,
        procedureNameAr: proc.nameAr,
        fee: proc.fee,
        notes: addForm.notes,
      }),
    });
    setAddForm({ toothNumber: '', surface: '', procedureCode: '', notes: '' });
    setShowAddForm(false);
    setAddingItem(false);
    await mutateTreatment();
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/dental/treatment/${encodeURIComponent(patientId)}`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id, status }),
    });
    await mutateTreatment();
  };

  const activeItems = items.filter((i: any) => i.status !== 'CANCELLED' && i.status !== 'COMPLETED');
  const totalCost = activeItems.reduce((s: number, i: any) => s + Number(i.fee || 0), 0);
  const currency = tr('ر.س', 'SAR');

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PLANNED':     return tr('مخطط',  'Planned');
      case 'IN_PROGRESS': return tr('جاري',  'In Progress');
      case 'COMPLETED':   return tr('مكتمل', 'Completed');
      case 'CANCELLED':   return tr('ملغي',  'Cancelled');
      default:            return status;
    }
  };

  // ── Render ──
  return (
    <div className="space-y-4">
      {/* Inner tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        <button
          onClick={() => setTab('chart')}
          className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${
            tab === 'chart' ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <CircleDot className="h-4 w-4 inline-block" /> {tr('مخطط الأسنان', 'Dental Chart')}
        </button>
        <button
          onClick={() => setTab('treatment')}
          className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${
            tab === 'treatment' ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <Clipboard className="h-4 w-4 inline-block" /> {tr('خطة العلاج', 'Treatment Plan')} {items.length > 0 && `(${activeItems.length})`}
        </button>
      </div>

      {/* ── CHART TAB ── */}
      {tab === 'chart' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2">
              {(['adult', 'child'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setChartType(t)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium ${
                    chartType === t ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {t === 'adult' ? tr('بالغ', 'Adult') : tr('طفل', 'Child')}
                </button>
              ))}
            </div>
            <button
              onClick={saveChart}
              disabled={savingChart}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-60"
            >
              {savingChart ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ المخطط', 'Save Chart')}
            </button>
          </div>

          {/* Condition Picker */}
          <div className="bg-muted/40 rounded-xl p-3">
            <div className="text-xs text-muted-foreground mb-2 font-medium">
              {tr('اختر الحالة ثم انقر على السطح:', 'Select condition then click a surface:')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(CONDITIONS) as [ConditionKey, typeof CONDITIONS[ConditionKey]][]).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setCurrentCondition(key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    currentCondition === key ? 'border-blue-500 bg-blue-50' : 'border-border bg-background hover:bg-muted'
                  }`}
                >
                  <span className="w-3 h-3 rounded-sm inline-block"
                    style={{ backgroundColor: val.color, border: `1px solid ${val.border}` }} />
                  {language === 'ar' ? val.labelAr : val.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="bg-card rounded-2xl border border-border p-4 overflow-x-auto">
            <div className="min-w-[560px]">
              {/* Upper jaw */}
              <div className="mb-2">
                <div className="text-center text-xs text-muted-foreground mb-1">
                  {tr('الفك العلوي', 'Upper Jaw')}
                </div>
                <div className="flex justify-center gap-0.5">
                  <div className="flex gap-0.5 border-l-2 border-border pl-1">
                    {teeth.upperRight.map((n) => (
                      <ToothSVG key={n} number={n} condition={conditions[n]} isSelected={selectedTooth === n}
                        onClick={() => setSelectedTooth(n)} onSurfaceClick={(s) => handleSurfaceClick(n, s)} />
                    ))}
                  </div>
                  <div className="flex gap-0.5 border-r-2 border-border pr-1">
                    {teeth.upperLeft.map((n) => (
                      <ToothSVG key={n} number={n} condition={conditions[n]} isSelected={selectedTooth === n}
                        onClick={() => setSelectedTooth(n)} onSurfaceClick={(s) => handleSurfaceClick(n, s)} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t-2 border-dashed border-border my-2" />

              {/* Lower jaw */}
              <div>
                <div className="flex justify-center gap-0.5">
                  <div className="flex gap-0.5 border-l-2 border-border pl-1">
                    {teeth.lowerRight.map((n) => (
                      <ToothSVG key={n} number={n} condition={conditions[n]} isSelected={selectedTooth === n}
                        onClick={() => setSelectedTooth(n)} onSurfaceClick={(s) => handleSurfaceClick(n, s)} />
                    ))}
                  </div>
                  <div className="flex gap-0.5 border-r-2 border-border pr-1">
                    {teeth.lowerLeft.map((n) => (
                      <ToothSVG key={n} number={n} condition={conditions[n]} isSelected={selectedTooth === n}
                        onClick={() => setSelectedTooth(n)} onSurfaceClick={(s) => handleSurfaceClick(n, s)} />
                    ))}
                  </div>
                </div>
                <div className="text-center text-xs text-muted-foreground mt-1">
                  {tr('الفك السفلي', 'Lower Jaw')}
                </div>
              </div>
            </div>
          </div>

          {/* Selected tooth detail */}
          {selectedTooth && (
            <div className="bg-card rounded-xl border border-border p-4 space-y-3">
              <div className="font-medium text-sm">
                {tr('السن رقم', 'Tooth #')} {selectedTooth}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {SURFACES.map((s) => (
                  <div key={s} className="text-center">
                    <div className="text-[10px] text-muted-foreground mb-1">
                      {language === 'ar' ? SURFACE_LABELS[s].ar : SURFACE_LABELS[s].en}
                    </div>
                    <div
                      className="w-10 h-10 mx-auto rounded-lg border-2 cursor-pointer hover:opacity-80 transition-opacity"
                      style={{
                        backgroundColor: CONDITIONS[conditions[selectedTooth]?.surfaces?.[s] || 'healthy'].color,
                        borderColor:     CONDITIONS[conditions[selectedTooth]?.surfaces?.[s] || 'healthy'].border,
                      }}
                      onClick={() => handleSurfaceClick(selectedTooth, s)}
                    />
                    <div className="text-[9px] text-muted-foreground mt-0.5">
                      {language === 'ar'
                        ? CONDITIONS[conditions[selectedTooth]?.surfaces?.[s] || 'healthy'].labelAr
                        : CONDITIONS[conditions[selectedTooth]?.surfaces?.[s] || 'healthy'].labelEn}
                    </div>
                  </div>
                ))}
              </div>
              <textarea
                rows={2}
                placeholder={tr('ملاحظات عن السن...', 'Notes about this tooth...')}
                value={conditions[selectedTooth]?.notes || ''}
                onChange={(e) =>
                  setConditions((prev) => ({
                    ...prev,
                    [selectedTooth]: {
                      ...prev[selectedTooth],
                      toothNumber: selectedTooth,
                      surfaces: prev[selectedTooth]?.surfaces || {},
                      notes: e.target.value,
                    },
                  }))
                }
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          )}
        </div>
      )}

      {/* ── TREATMENT TAB ── */}
      {tab === 'treatment' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-blue-700">{activeItems.length}</div>
              <div className="text-xs text-blue-600 mt-0.5">{tr('إجراء مخطط', 'Planned')}</div>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-emerald-700">
                {items.filter((i: any) => i.status === 'COMPLETED').length}
              </div>
              <div className="text-xs text-emerald-600 mt-0.5">{tr('مكتمل', 'Completed')}</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-amber-700">
                {totalCost.toLocaleString()} {currency}
              </div>
              <div className="text-xs text-amber-600 mt-0.5">{tr('التكلفة المتبقية', 'Remaining Cost')}</div>
            </div>
          </div>

          {/* Add button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-1.5 text-sm rounded-xl bg-blue-600 text-white"
            >
              + {tr('إضافة إجراء', 'Add Procedure')}
            </button>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="bg-muted/40 rounded-xl border border-border p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    {tr('رقم السن *', 'Tooth Number *')}
                  </label>
                  <input
                    type="number"
                    value={addForm.toothNumber}
                    onChange={(e) => setAddForm({ ...addForm, toothNumber: e.target.value })}
                    placeholder={tr('مثال: 26', 'e.g. 26')}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    {tr('السطح', 'Surface')}
                  </label>
                  <select
                    value={addForm.surface}
                    onChange={(e) => setAddForm({ ...addForm, surface: e.target.value })}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{tr('— اختياري —', '— Optional —')}</option>
                    {SURFACES.map((s) => (
                      <option key={s} value={s}>
                        {s} ({language === 'ar' ? SURFACE_LABELS[s].ar : SURFACE_LABELS[s].en})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  {tr('الإجراء *', 'Procedure *')}
                </label>
                <select
                  value={addForm.procedureCode}
                  onChange={(e) => setAddForm({ ...addForm, procedureCode: e.target.value })}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{tr('— اختر الإجراء —', '— Select procedure —')}</option>
                  {PROCEDURES.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code} — {language === 'ar' ? p.nameAr : p.name} ({p.fee.toLocaleString()} {currency})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  {tr('ملاحظات', 'Notes')}
                </label>
                <input
                  type="text"
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  placeholder={tr('ملاحظات اختيارية...', 'Optional notes...')}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-sm rounded-xl border border-border hover:bg-muted">
                  {tr('إلغاء', 'Cancel')}
                </button>
                <button
                  onClick={addTreatment}
                  disabled={addingItem || !addForm.procedureCode || !addForm.toothNumber}
                  className="px-4 py-1.5 text-sm rounded-xl bg-blue-600 text-white disabled:opacity-60"
                >
                  {addingItem ? tr('جاري الإضافة...', 'Adding...') : tr('إضافة', 'Add')}
                </button>
              </div>
            </div>
          )}

          {/* Treatment List */}
          <div className="space-y-2">
            {items.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">
                {tr('لا توجد إجراءات مخططة', 'No planned procedures yet')}
              </div>
            )}
            {items.map((item: any) => (
              <div
                key={item.id}
                className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
                  item.status === 'COMPLETED' ? 'opacity-60 bg-muted/30 border-border' :
                  item.status === 'CANCELLED' ? 'opacity-40 bg-muted/20 border-border' :
                  item.status === 'IN_PROGRESS' ? 'bg-amber-50 border-amber-200' :
                  'bg-card border-border'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {language === 'ar'
                        ? (item.procedureNameAr || item.procedureName)
                        : (item.procedureName   || item.procedureNameAr)}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.status === 'COMPLETED'   ? 'bg-emerald-100 text-emerald-700' :
                      item.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
                      item.status === 'CANCELLED'   ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {getStatusLabel(item.status)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {tr('السن', 'Tooth')}: {item.toothNumber}
                    {item.surface ? ` — ${item.surface}` : ''}{' '}
                    • {Number(item.fee || 0).toLocaleString()} {currency}
                    {item.notes && ` • ${item.notes}`}
                  </div>
                </div>
                {item.status === 'PLANNED' && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => updateStatus(item.id, 'IN_PROGRESS')}
                      className="px-2.5 py-1 text-xs rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200"
                    >
                      {tr('بدء', 'Start')}
                    </button>
                    <button
                      onClick={() => updateStatus(item.id, 'CANCELLED')}
                      className="px-2.5 py-1 text-xs rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                    >
                      {tr('إلغاء', 'Cancel')}
                    </button>
                  </div>
                )}
                {item.status === 'IN_PROGRESS' && (
                  <button
                    onClick={() => updateStatus(item.id, 'COMPLETED')}
                    className="px-2.5 py-1 text-xs rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 shrink-0"
                  >
                    {tr('إكمال', 'Complete')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
