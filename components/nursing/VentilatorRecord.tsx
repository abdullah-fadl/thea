'use client';

import { useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { useLang } from '@/hooks/use-lang';
import {
  Wind, Plus, Save, AlertCircle, Clock, ChevronDown, ChevronUp, Trash2,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface VentSettings {
  fio2: number;
  tv: number;
  rr: number;
  peep: number;
  ps: number;
  ie_ratio: string;
  flow: number;
}

interface PeriodicRecording {
  time: string;
  pip: number | string;
  pplat: number | string;
  compliance: number | string;
  fio2: number | string;
  spo2: number | string;
  etco2: number | string;
}

interface VentRecord {
  id: string;
  mode: string;
  settings: VentSettings;
  recordings: PeriodicRecording[];
  weaningPlan: string | null;
  extubationTime: string | null;
  extubationNote: string | null;
  startedAt: string;
  endedAt: string | null;
  recordedBy: string;
  createdAt: string;
}

interface VentilatorRecordProps {
  episodeId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VENT_MODES = [
  { value: 'AC_VC', labelAr: 'AC/VC — تحكم مساعد حجمي', labelEn: 'AC/VC — Assist Control Volume' },
  { value: 'AC_PC', labelAr: 'AC/PC — تحكم مساعد ضغطي', labelEn: 'AC/PC — Assist Control Pressure' },
  { value: 'SIMV',  labelAr: 'SIMV — تزامن متقطع',       labelEn: 'SIMV — Sync Intermittent MV' },
  { value: 'PSV',   labelAr: 'PSV — دعم الضغط',           labelEn: 'PSV — Pressure Support' },
  { value: 'CPAP',  labelAr: 'CPAP — ضغط مجرى هوائي',    labelEn: 'CPAP — Continuous Positive AP' },
  { value: 'BIPAP', labelAr: 'BiPAP — ضغط ثنائي',        labelEn: 'BiPAP — Bi-level Positive AP' },
  { value: 'HFNC',  labelAr: 'HFNC — قنيلة أنفية عالية', labelEn: 'HFNC — High-Flow Nasal Cannula' },
];

const DEFAULT_SETTINGS: VentSettings = {
  fio2: 40, tv: 500, rr: 14, peep: 5, ps: 10, ie_ratio: '1:2', flow: 40,
};

const DEFAULT_RECORDING: PeriodicRecording = {
  time: '', pip: '', pplat: '', compliance: '', fio2: '', spo2: '', etco2: '',
};

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

// ─── Component ────────────────────────────────────────────────────────────────

export function VentilatorRecord({ episodeId }: VentilatorRecordProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const apiUrl = `/api/ipd/episodes/${episodeId}/ventilator`;
  const { data, isLoading, error } = useSWR<{ records: VentRecord[] }>(apiUrl, fetcher);

  const records = data?.records ?? [];
  const activeRecord = records[0] ?? null;

  // Form state
  const [mode, setMode] = useState<string>(activeRecord?.mode ?? 'AC_VC');
  const [settings, setSettings] = useState<VentSettings>(activeRecord?.settings ?? DEFAULT_SETTINGS);
  const [recordings, setRecordings] = useState<PeriodicRecording[]>(activeRecord?.recordings ?? []);
  const [weaningPlan, setWeaningPlan] = useState<string>(activeRecord?.weaningPlan ?? '');
  const [extubationTime, setExtubationTime] = useState<string>(activeRecord?.extubationTime?.slice(0, 16) ?? '');
  const [extubationNote, setExtubationNote] = useState<string>(activeRecord?.extubationNote ?? '');
  const [startedAt, setStartedAt] = useState<string>(
    activeRecord?.startedAt?.slice(0, 16) ?? new Date().toISOString().slice(0, 16)
  );

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const patchSettings = useCallback((key: keyof VentSettings, val: number | string) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  }, []);

  const addRecording = () => {
    setRecordings(prev => [...prev, {
      ...DEFAULT_RECORDING,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    }]);
  };

  const patchRecording = (idx: number, key: keyof PeriodicRecording, val: string) => {
    setRecordings(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));
  };

  const removeRecording = (idx: number) => {
    setRecordings(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeRecord) {
        // Update existing
        const res = await fetch(apiUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            id: activeRecord.id,
            mode, settings, recordings, weaningPlan,
            extubationTime: extubationTime || null,
            extubationNote: extubationNote || null,
          }),
        });
        if (!res.ok) throw new Error();
        showToast('success', tr('تم تحديث سجل التنفس الاصطناعي', 'Ventilator record updated'));
      } else {
        // Create new
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            mode, settings, recordings, weaningPlan,
            extubationTime: extubationTime || null,
            extubationNote: extubationNote || null,
            startedAt,
          }),
        });
        if (!res.ok) throw new Error();
        showToast('success', tr('تم إنشاء سجل التنفس الاصطناعي', 'Ventilator record created'));
      }
      mutate(apiUrl);
    } catch {
      showToast('error', tr('فشل الحفظ', 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4" dir={dir}>
        <Wind className="w-4 h-4 animate-pulse" />
        {tr('جاري تحميل سجلات التنفس...', 'Loading ventilator records...')}
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
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-white text-sm shadow-lg transition-all ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Current Settings Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wind className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-blue-800 text-sm">
            {tr('إعدادات التنفس الاصطناعي الحالية', 'Current Ventilator Settings')}
          </h3>
          {activeRecord && (
            <span className="ml-auto text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
              {tr('نشط', 'Active')}
            </span>
          )}
        </div>
        {activeRecord ? (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: tr('الوضع', 'Mode'),         val: activeRecord.mode },
              { label: 'FiO₂',                       val: `${activeRecord.settings.fio2}%` },
              { label: tr('الحجم المدي', 'TV'),      val: `${activeRecord.settings.tv} mL` },
              { label: tr('معدل التنفس', 'RR'),      val: `${activeRecord.settings.rr}/min` },
              { label: 'PEEP',                        val: `${activeRecord.settings.peep} cmH₂O` },
              { label: 'PS',                          val: `${activeRecord.settings.ps} cmH₂O` },
              { label: tr('نسبة I:E', 'I:E Ratio'),  val: activeRecord.settings.ie_ratio },
              { label: tr('التدفق', 'Flow'),          val: `${activeRecord.settings.flow} L/min` },
            ].map(({ label, val }) => (
              <div key={label} className="bg-card rounded-lg p-2 text-center">
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className="text-sm font-bold text-blue-700">{val}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-blue-600">{tr('لا يوجد سجل نشط. أنشئ سجلاً جديداً.', 'No active record. Create a new one below.')}</p>
        )}
      </div>

      {/* Form */}
      <div className="bg-card border rounded-xl p-5 space-y-5">
        <h4 className="font-semibold text-foreground text-sm">
          {activeRecord ? tr('تحديث السجل', 'Update Record') : tr('سجل جديد', 'New Record')}
        </h4>

        {/* Mode + Start Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('وضع التنفس', 'Ventilation Mode')}</label>
            <select
              value={mode}
              onChange={e => setMode(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {VENT_MODES.map(m => (
                <option key={m.value} value={m.value}>
                  {language === 'ar' ? m.labelAr : m.labelEn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('وقت البدء', 'Start Time')}</label>
            <input
              type="datetime-local"
              value={startedAt}
              onChange={e => setStartedAt(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Settings Grid */}
        <div>
          <p className="text-xs font-semibold text-foreground mb-2">{tr('معاملات الجهاز', 'Device Parameters')}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SettingField
              label="FiO₂ (%)"
              value={String(settings.fio2)}
              min={21} max={100} type="number"
              onChange={v => patchSettings('fio2', Number(v))}
            />
            <SettingField
              label={tr('حجم مدي (mL)', 'Tidal Vol (mL)')}
              value={String(settings.tv)}
              min={200} max={900} type="number"
              onChange={v => patchSettings('tv', Number(v))}
            />
            <SettingField
              label={tr('معدل التنفس (/min)', 'RR (/min)')}
              value={String(settings.rr)}
              min={4} max={40} type="number"
              onChange={v => patchSettings('rr', Number(v))}
            />
            <SettingField
              label="PEEP (cmH₂O)"
              value={String(settings.peep)}
              min={0} max={25} type="number"
              onChange={v => patchSettings('peep', Number(v))}
            />
            <SettingField
              label="PS (cmH₂O)"
              value={String(settings.ps)}
              min={0} max={30} type="number"
              onChange={v => patchSettings('ps', Number(v))}
            />
            <SettingField
              label={tr('نسبة I:E', 'I:E Ratio')}
              value={settings.ie_ratio}
              type="text"
              onChange={v => patchSettings('ie_ratio', v)}
            />
            <SettingField
              label={tr('التدفق (L/min)', 'Flow (L/min)')}
              value={String(settings.flow)}
              min={5} max={100} type="number"
              onChange={v => patchSettings('flow', Number(v))}
            />
          </div>
        </div>

        {/* Periodic Recordings */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-foreground">
              {tr('التسجيلات الدورية', 'Periodic Recordings')}
              <span className="text-muted-foreground ml-1">({recordings.length})</span>
            </p>
            <button
              onClick={addRecording}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              {tr('إضافة', 'Add Row')}
            </button>
          </div>

          {recordings.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    {['Time', 'PIP', 'Pplat', tr('الامتثال', 'Compliance'), 'FiO₂%', 'SpO₂%', 'EtCO₂'].map(h => (
                      <th key={h} className="px-2 py-2 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                    <th className="px-2 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recordings.map((rec, idx) => (
                    <tr key={idx} className="hover:bg-muted/50">
                      {(Object.keys(DEFAULT_RECORDING) as (keyof PeriodicRecording)[]).map(key => (
                        <td key={key} className="px-1 py-1">
                          <input
                            type={key === 'time' ? 'time' : 'number'}
                            value={String(rec[key])}
                            onChange={e => patchRecording(idx, key, e.target.value)}
                            className="w-full border-0 bg-transparent focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5 text-xs"
                          />
                        </td>
                      ))}
                      <td className="px-1 py-1">
                        <button
                          onClick={() => removeRecording(idx)}
                          className="text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Weaning Section */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-amber-800">{tr('خطة الفطام والبثق', 'Weaning & Extubation Plan')}</p>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('خطة الفطام', 'Weaning Plan')}</label>
            <textarea
              value={weaningPlan}
              onChange={e => setWeaningPlan(e.target.value)}
              rows={3}
              placeholder={tr('خطوات الفطام التدريجي...', 'Step-down weaning steps...')}
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-amber-400 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('وقت البثق المخطط', 'Planned Extubation')}</label>
              <input
                type="datetime-local"
                value={extubationTime}
                onChange={e => setExtubationTime(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('ملاحظات البثق', 'Extubation Note')}</label>
              <input
                type="text"
                value={extubationNote}
                onChange={e => setExtubationNote(e.target.value)}
                placeholder={tr('ملاحظات...', 'Notes...')}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving
            ? tr('جاري الحفظ...', 'Saving...')
            : activeRecord
              ? tr('تحديث السجل', 'Update Record')
              : tr('إنشاء السجل', 'Create Record')
          }
        </button>
      </div>

      {/* History */}
      {records.length > 1 && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              {tr('السجلات السابقة', 'Previous Records')}
              <span className="text-xs text-muted-foreground">({records.length - 1})</span>
            </span>
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showHistory && (
            <div className="divide-y divide-border">
              {records.slice(1).map(rec => (
                <div key={rec.id} className="px-4 py-3 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground">{rec.mode}</span>
                    <span className="text-muted-foreground">{new Date(rec.startedAt).toLocaleString()}</span>
                  </div>
                  <div className="flex gap-4 text-[11px]">
                    <span>FiO₂: {rec.settings.fio2}%</span>
                    <span>TV: {rec.settings.tv}mL</span>
                    <span>RR: {rec.settings.rr}/min</span>
                    <span>PEEP: {rec.settings.peep}cmH₂O</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helper: Setting Field ────────────────────────────────────────────────────

function SettingField({
  label, value, type, min, max, onChange,
}: {
  label: string;
  value: string;
  type: 'number' | 'text';
  min?: number;
  max?: number;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">{label}</label>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(e.target.value)}
        className="w-full border rounded-lg px-2 py-1.5 text-sm font-medium text-foreground focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />
    </div>
  );
}
