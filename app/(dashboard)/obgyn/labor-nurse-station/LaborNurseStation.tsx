'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import dynamic from 'next/dynamic';
import { Building2, Heart } from 'lucide-react';

const Partogram = dynamic(() => import('@/components/obgyn/Partogram'), { ssr: false });

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// ── MEOWS colour map ──────────────────────────────────────────────────────────
const MEOWS_CONFIG: Record<string, { bg: string; text: string; labelAr: string; labelEn: string }> = {
  NORMAL:    { bg: 'bg-emerald-100', text: 'text-emerald-700', labelAr: 'طبيعي',  labelEn: 'Normal' },
  CAUTION:   { bg: 'bg-yellow-100',  text: 'text-yellow-700',  labelAr: 'تنبيه',  labelEn: 'Caution' },
  URGENT:    { bg: 'bg-orange-100',  text: 'text-orange-700',  labelAr: 'عاجل',   labelEn: 'Urgent' },
  EMERGENCY: { bg: 'bg-red-100',     text: 'text-red-700',     labelAr: 'طارئ',   labelEn: 'Emergency' },
};

const getMeowsLabel = (cfg: typeof MEOWS_CONFIG[string], language: string) =>
  language === 'ar' ? cfg.labelAr : cfg.labelEn;

// ── Admit Dialog ──────────────────────────────────────────────────────────────
function AdmitDialog({ onClose, onAdmit }: {
  onClose: () => void;
  onAdmit: (patientId: string, data: any) => Promise<void>;
}) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({
    gravida: '', para: '', edd: '', membranesStatus: 'INTACT',
    presentationType: 'CEPHALIC', chiefComplaint: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const { data: searchData } = useSWR(
    debounced.length >= 2 ? `/api/patients/search?q=${encodeURIComponent(debounced)}&limit=8` : null,
    fetcher
  );
  const results: any[] = searchData?.patients ?? searchData?.results ?? [];

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    await onAdmit(selected.id || selected.patientMasterId, form);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg border border-border overflow-hidden">
        <div className="bg-gradient-to-r from-pink-600 to-rose-600 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">
            {tr('إدخال مريضة للولادة', 'Admit to Labor Ward')}
          </h2>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Patient search */}
          {!selected ? (
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                {tr('بحث المريضة', 'Search Patient')}
              </label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tr('الاسم، رقم الملف، الهوية...', 'Name, MRN, National ID...')}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
              {results.length > 0 && (
                <div className="mt-2 rounded-xl border border-border overflow-hidden">
                  {results.map((p: any) => (
                    <button key={p.id || p.patientMasterId} onClick={() => setSelected(p)}
                      className="w-full text-left px-4 py-3 hover:bg-muted border-b border-border last:border-0 text-sm">
                      <div className="font-medium">{p.fullName || p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.mrn}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-pink-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{selected.fullName || selected.name}</div>
                <div className="text-xs text-muted-foreground">{selected.mrn}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
            </div>
          )}

          {selected && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'gravida', label: tr('حمل (G)', 'Gravida (G)') },
                  { key: 'para',    label: tr('ولادة (P)', 'Para (P)') },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                    <input type="number" min="0"
                      value={String((form as Record<string, unknown>)[key] ?? '')}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-pink-500" />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  {tr('تاريخ الولادة المتوقع (EDD)', 'Expected Due Date (EDD)')}
                </label>
                <input type="date" value={form.edd}
                  onChange={(e) => setForm({ ...form, edd: e.target.value })}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    {tr('حالة الأغشية', 'Membranes Status')}
                  </label>
                  <select value={form.membranesStatus}
                    onChange={(e) => setForm({ ...form, membranesStatus: e.target.value })}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-pink-500">
                    <option value="INTACT">{tr('سليمة', 'Intact')}</option>
                    <option value="RUPTURED">{tr('مكسورة (SROM)', 'Ruptured (SROM)')}</option>
                    <option value="ARTIFICAL">{tr('كسر طبي (AROM)', 'Artificial (AROM)')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    {tr('وضع الجنين', 'Presentation')}
                  </label>
                  <select value={form.presentationType}
                    onChange={(e) => setForm({ ...form, presentationType: e.target.value })}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-pink-500">
                    <option value="CEPHALIC">{tr('رأسي', 'Cephalic')}</option>
                    <option value="BREECH">{tr('مقعدي', 'Breech')}</option>
                    <option value="TRANSVERSE">{tr('عرضي', 'Transverse')}</option>
                    <option value="OBLIQUE">{tr('مائل', 'Oblique')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  {tr('سبب الدخول', 'Chief Complaint')}
                </label>
                <input value={form.chiefComplaint}
                  onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })}
                  placeholder={tr('آلام المخاض، نقص الحركة...', 'Labor pains, decreased movement...')}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  {tr('ملاحظات', 'Notes')}
                </label>
                <textarea rows={2} value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none" />
              </div>
            </>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-muted/30">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-border hover:bg-muted">
            {tr('إلغاء', 'Cancel')}
          </button>
          <button onClick={handleSubmit} disabled={!selected || submitting}
            className="px-5 py-2 text-sm rounded-xl bg-pink-600 text-white disabled:opacity-50">
            {submitting ? tr('جاري الإدخال...', 'Admitting...') : tr('إدخال المريضة', 'Admit Patient')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Nursing Assessment Form ───────────────────────────────────────────────────
function NursingForm({ patientId, onSaved }: { patientId: string; onSaved: () => void }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [form, setForm] = useState({
    bp: '', hr: '', temp: '', rr: '', spo2: '',
    consciousness: 'ALERT', proteinuria: 'NONE', lochia: 'NONE',
    fetalHr: '', contractions: '', dilation: '', effacement: '',
    station: '0', liquor: 'CLEAR', oxytocin: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [meowsPreview, setMeowsPreview] = useState<any>(null);

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(`/api/obgyn/labor/${encodeURIComponent(patientId)}/nursing`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form }),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.meows) setMeowsPreview(data.meows);
    setSaving(false);
    if (res.ok) onSaved();
  };

  const meowsCfg = meowsPreview ? MEOWS_CONFIG[meowsPreview.riskLevel] ?? MEOWS_CONFIG.NORMAL : null;

  return (
    <div className="space-y-4">
      {meowsPreview && meowsCfg && (
        <div className={`${meowsCfg.bg} ${meowsCfg.text} rounded-xl px-4 py-3 flex items-center justify-between`}>
          <span className="font-semibold">
            MEOWS: {meowsPreview.totalScore} — {getMeowsLabel(meowsCfg, language)}
          </span>
          {meowsPreview.hasSingleTrigger && (
            <span className="text-xs font-medium">
              {tr('منبّه واحد', 'Single trigger')}
            </span>
          )}
        </div>
      )}

      {/* Maternal Vitals */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="text-sm font-medium text-muted-foreground mb-3">
          {tr('العلامات الحيوية للأم', 'Maternal Vitals')}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { key: 'bp'   as const, label: tr('ضغط الدم', 'Blood Pressure'),   placeholder: '120/80' },
            { key: 'hr'   as const, label: tr('نبض الأم (bpm)', 'Maternal HR (bpm)'), placeholder: '80' },
            { key: 'temp' as const, label: tr('الحرارة (°C)', 'Temperature (°C)'), placeholder: '36.8' },
            { key: 'rr'   as const, label: tr('معدل التنفس', 'Respiratory Rate'), placeholder: '16' },
            { key: 'spo2' as const, label: tr('SpO2 (%)', 'SpO2 (%)'),          placeholder: '98' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs text-muted-foreground mb-1">{label}</label>
              <input value={form[key]} onChange={f(key)} placeholder={placeholder}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-pink-500" />
            </div>
          ))}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              {tr('الوعي', 'Consciousness')}
            </label>
            <select value={form.consciousness} onChange={f('consciousness')}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-pink-500">
              <option value="ALERT">{tr('واعية تماماً', 'Alert')}</option>
              <option value="VOICE">{tr('تستجيب للصوت', 'Voice')}</option>
              <option value="PAIN">{tr('تستجيب للألم', 'Pain')}</option>
              <option value="UNRESPONSIVE">{tr('لا تستجيب', 'Unresponsive')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              {tr('بروتين البول', 'Proteinuria')}
            </label>
            <select value={form.proteinuria} onChange={f('proteinuria')}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-pink-500">
              <option value="NONE">{tr('سالب', 'None')}</option>
              <option value="TRACE">{tr('آثار', 'Trace')}</option>
              <option value="PLUS1">{tr('+ خفيف', '+ (Mild)')}</option>
              <option value="PLUS2_OR_MORE">{tr('++ أو أكثر', '++ or more')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              {tr('النزيف / الإفراز', 'Bleeding / Lochia')}
            </label>
            <select value={form.lochia} onChange={f('lochia')}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-pink-500">
              <option value="NONE">{tr('لا يوجد', 'None')}</option>
              <option value="LIGHT">{tr('خفيف', 'Light')}</option>
              <option value="MODERATE">{tr('متوسط', 'Moderate')}</option>
              <option value="HEAVY">{tr('غزير', 'Heavy')}</option>
              <option value="EXCESSIVE">{tr('خطير', 'Excessive')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Fetal Monitoring */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="text-sm font-medium text-muted-foreground mb-3">
          {tr('مراقبة الجنين والمخاض', 'Fetal & Labor Monitoring')}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { key: 'fetalHr'      as const, label: tr('نبض الجنين (bpm)', 'FHR (bpm)'),           placeholder: '140' },
            { key: 'contractions' as const, label: tr('انقباضات / 10 دقائق', 'Contractions/10min'), placeholder: '3' },
            { key: 'dilation'     as const, label: tr('اتساع عنق الرحم (cm)', 'Cervical Dilation (cm)'), placeholder: '4' },
            { key: 'effacement'   as const, label: tr('الترقق (%)', 'Effacement (%)'),              placeholder: '70' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs text-muted-foreground mb-1">{label}</label>
              <input type="number" value={form[key]} onChange={f(key)} placeholder={placeholder}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-pink-500" />
            </div>
          ))}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              {tr('مستوى الرأس', 'Fetal Station')}
            </label>
            <select value={form.station} onChange={f('station')}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-pink-500">
              {[-3, -2, -1, 0, 1, 2, 3].map((s) => (
                <option key={s} value={s}>{s > 0 ? `+${s}` : s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              {tr('السائل الأمنيوسي', 'Amniotic Fluid')}
            </label>
            <select value={form.liquor} onChange={f('liquor')}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-pink-500">
              <option value="CLEAR">{tr('صافٍ', 'Clear')}</option>
              <option value="MECONIUM_THIN">{tr('عقي خفيف', 'Thin Meconium')}</option>
              <option value="MECONIUM_THICK">{tr('عقي كثيف', 'Thick Meconium')}</option>
              <option value="BLOOD">{tr('دموي', 'Bloodstained')}</option>
              <option value="ABSENT">{tr('غائب', 'Absent')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              {tr('الأوكسيتوسين', 'Oxytocin')}
            </label>
            <input value={form.oxytocin} onChange={f('oxytocin')}
              placeholder={tr('مثال: 2 وحدة/ساعة', 'e.g. 2 units/hr')}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-pink-500" />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          {tr('ملاحظات', 'Notes')}
        </label>
        <textarea rows={2} value={form.notes} onChange={f('notes')}
          className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none" />
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2 rounded-xl bg-pink-600 text-white text-sm font-medium disabled:opacity-60">
          {saving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ التقييم', 'Save Assessment')}
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LaborNurseStation() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'vitals' | 'partogram' | 'history'>('vitals');
  const [showAdmit, setShowAdmit] = useState(false);
  const [showDischargeId, setShowDischargeId] = useState<string | null>(null);

  const { data, mutate, isValidating } = useSWR('/api/obgyn/labor/worklist', fetcher, {
    refreshInterval: 30000,
  });
  const patients: any[] = data?.patients ?? [];

  const { data: nursingHistory, mutate: mutateHistory } = useSWR(
    selectedPatient ? `/api/obgyn/labor/${encodeURIComponent(selectedPatient.patientId)}/nursing` : null,
    fetcher
  );
  const historyEntries: any[] = nursingHistory?.entries ?? [];

  const handleAdmit = async (patientId: string, formData: any) => {
    const res = await fetch(`/api/obgyn/labor/${encodeURIComponent(patientId)}/admit`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    if (res.ok) {
      setShowAdmit(false);
      await mutate();
    }
  };

  const handleDischarge = async (episodeId: string, patientId: string, action: string) => {
    await fetch(`/api/obgyn/labor/${encodeURIComponent(patientId)}/admit`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, episodeId }),
    });
    setShowDischargeId(null);
    setSelectedPatient(null);
    await mutate();
  };

  const selPat = selectedPatient
    ? patients.find((p) => p.patientId === selectedPatient.patientId) ?? selectedPatient
    : null;

  const meowsCfg = selPat ? MEOWS_CONFIG[selPat.alertLevel] ?? MEOWS_CONFIG.NORMAL : null;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 border-b border-border bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Heart className="h-5 w-5 text-pink-600" />
          <div>
            <h1 className="font-bold text-foreground">
              {tr('محطة تمريض الولادة', 'Labor Nursing Station')}
            </h1>
            <p className="text-xs text-muted-foreground">
              {patients.length} {tr('مريضة نشطة', 'active patients')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isValidating && (
            <span className="text-xs text-muted-foreground">
              {tr('جاري التحديث...', 'Refreshing...')}
            </span>
          )}
          <button onClick={() => mutate()}
            className="px-3 py-1.5 text-xs rounded-xl border border-border hover:bg-muted">↻</button>
          <button onClick={() => setShowAdmit(true)}
            className="px-4 py-1.5 text-sm rounded-xl bg-pink-600 text-white font-medium">
            + {tr('إدخال مريضة', 'Admit Patient')}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Patient List */}
        <div className="w-72 shrink-0 border-e border-border bg-card overflow-y-auto thea-scroll">
          {patients.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4">
              <Building2 className="h-8 w-8 mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {tr('لا توجد مريضات في الولادة', 'No active labor patients')}
              </p>
            </div>
          ) : (
            patients.map((p: any) => {
              const cfg = MEOWS_CONFIG[p.alertLevel] ?? MEOWS_CONFIG.NORMAL;
              const isSelected = selectedPatient?.patientId === p.patientId;
              const admittedHours = Math.floor(
                (Date.now() - new Date(p.admittedAt).getTime()) / 3600000
              );
              return (
                <button
                  key={p.patientId}
                  onClick={() => { setSelectedPatient(p); setActiveTab('vitals'); }}
                  className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${
                    isSelected ? 'bg-pink-50 border-s-2 border-s-pink-500' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm truncate">{p.patient?.fullName}</div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                      {p.meowsScore !== null ? p.meowsScore : '—'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span>{p.patient?.mrn}</span>
                    <span>•</span>
                    <span>
                      {language === 'ar'
                        ? `منذ ${admittedHours}س`
                        : `${admittedHours}h ago`}
                    </span>
                    {p.dilation !== null && <span>• {p.dilation}cm</span>}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Detail Panel */}
        {selPat ? (
          <div className="flex-1 overflow-y-auto thea-scroll p-4 space-y-4">
            {/* Patient header */}
            <div className="bg-card rounded-2xl border border-border p-4 flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-foreground">{selPat.patient?.fullName}</h2>
                  {meowsCfg && selPat.meowsScore !== null && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${meowsCfg.bg} ${meowsCfg.text}`}>
                      MEOWS {selPat.meowsScore} — {getMeowsLabel(meowsCfg, language)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                  <span>MRN: {selPat.patient?.mrn}</span>
                  <span>G{selPat.episodeData?.gravida ?? '—'}P{selPat.episodeData?.para ?? '—'}</span>
                  <span>EDD: {selPat.episodeData?.edd || '—'}</span>
                  <span>
                    {tr('وضع الجنين', 'Presentation')}: {selPat.episodeData?.presentationType || '—'}
                  </span>
                  <span>
                    {tr('الأغشية', 'Membranes')}: {selPat.episodeData?.membranesStatus || '—'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowDischargeId(selPat.episodeId)}
                className="px-3 py-1.5 text-xs rounded-xl border border-border text-muted-foreground hover:bg-muted shrink-0"
              >
                {tr('إنهاء / تحويل', 'Discharge / Transfer')}
              </button>
            </div>

            {/* Latest readings summary */}
            {selPat.latestNursing && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {[
                  { label: 'BP',                                                         value: selPat.latestNursing.bp },
                  { label: 'HR',                                                         value: selPat.latestNursing.hr ? `${selPat.latestNursing.hr} bpm` : null },
                  { label: tr('حرارة', 'Temp'),                                          value: selPat.latestNursing.temp ? `${selPat.latestNursing.temp}°C` : null },
                  { label: 'SpO2',                                                        value: selPat.latestNursing.spo2 ? `${selPat.latestNursing.spo2}%` : null },
                  { label: 'FHR',                                                         value: selPat.latestNursing.fetalHr ? `${selPat.latestNursing.fetalHr} bpm` : null,
                    alert: selPat.latestNursing.fetalHr && (selPat.latestNursing.fetalHr < 110 || selPat.latestNursing.fetalHr > 160) },
                  { label: tr('اتساع', 'Dilation'),                                      value: selPat.latestNursing.dilation ? `${selPat.latestNursing.dilation} cm` : null },
                ].map(({ label, value, alert }) => (
                  <div key={label}
                    className={`rounded-xl p-2.5 text-center ${alert ? 'bg-red-50 border border-red-200' : 'bg-muted/40'}`}>
                    <div className={`text-sm font-bold ${alert ? 'text-red-700' : 'text-foreground'}`}>
                      {value ?? '—'}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-border pb-2">
              {(['vitals', 'partogram', 'history'] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 text-sm rounded-xl font-medium transition-colors ${
                    activeTab === tab ? 'bg-pink-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}>
                  {tab === 'vitals'    ? tr('تقييم جديد', 'New Assessment') :
                   tab === 'partogram' ? tr('البارتوجرام', 'Partogram') :
                   tr('السجل', 'History')}
                </button>
              ))}
            </div>

            {activeTab === 'vitals' && (
              <NursingForm
                patientId={selPat.patientId}
                onSaved={() => { mutate(); mutateHistory(); }}
              />
            )}

            {activeTab === 'partogram' && (
              <Partogram patientId={selPat.patientId} />
            )}

            {activeTab === 'history' && (
              <div className="space-y-2">
                {historyEntries.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    {tr('لا توجد تقييمات سابقة', 'No previous assessments')}
                  </div>
                )}
                {historyEntries.map((e: any, i: number) => {
                  const cfg = MEOWS_CONFIG[e.meowsLevel] ?? MEOWS_CONFIG.NORMAL;
                  return (
                    <div key={i} className="bg-card rounded-xl border border-border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(e.assessedAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                        </span>
                        {e.meows !== null && e.meows !== undefined && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                            MEOWS {e.meows}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
                        {[
                          ['BP',                              e.bp],
                          ['HR',                              e.hr ? `${e.hr} bpm` : null],
                          [tr('حرارة', 'Temp'),               e.temp ? `${e.temp}°C` : null],
                          ['FHR',                             e.fetalHr ? `${e.fetalHr} bpm` : null],
                          [tr('اتساع', 'Dilation'),           e.dilation ? `${e.dilation} cm` : null],
                          [tr('انقباضات', 'Contractions'),    e.contractions ? `${e.contractions}/10` : null],
                        ].map(([label, value]) => value ? (
                          <span key={label as string}>
                            <span className="text-muted-foreground">{label}: </span>{value}
                          </span>
                        ) : null)}
                      </div>
                      {e.notes && <div className="text-xs text-muted-foreground mt-1">{e.notes}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <Heart className="h-12 w-12 text-pink-600" />
            <p className="text-muted-foreground">
              {tr('اختر مريضة من القائمة', 'Select a patient from the list')}
            </p>
          </div>
        )}
      </div>

      {/* Admit Dialog */}
      {showAdmit && (
        <AdmitDialog onClose={() => setShowAdmit(false)} onAdmit={handleAdmit} />
      )}

      {/* Discharge Dialog */}
      {showDischargeId && selPat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm border border-border p-6 space-y-4">
            <h2 className="font-semibold text-foreground">
              {tr('إنهاء / تحويل المريضة', 'Discharge / Transfer Patient')}
            </h2>
            <p className="text-sm text-muted-foreground">{selPat.patient?.fullName}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleDischarge(showDischargeId, selPat.patientId, 'discharge')}
                className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium"
              >
                ✓ {tr('ولادة مكتملة', 'Delivered')}
              </button>
              <button
                onClick={() => handleDischarge(showDischargeId, selPat.patientId, 'transfer')}
                className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium"
              >
                → {tr('تحويل', 'Transfer')}
              </button>
              <button
                onClick={() => setShowDischargeId(null)}
                className="w-full py-2.5 rounded-xl border border-border text-sm"
              >
                {tr('إلغاء', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
