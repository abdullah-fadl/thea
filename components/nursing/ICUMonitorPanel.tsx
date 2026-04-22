'use client';

import { useState } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Building2 } from 'lucide-react';
import {
  DEFAULT_VENT_SETTINGS, VENT_MODES, DEFAULT_HEMO,
  type VentilatorSettings, type VentMode, type HemodynamicReading,
  type DripEntry, type ICUMonitoringData, calculatePFRatio, calculateMAP,
} from '@/lib/clinical/icuMonitoring';

interface Props {
  value: ICUMonitoringData | null;
  onChange: (data: ICUMonitoringData) => void;
}

export function ICUMonitorPanel({ value, onChange }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const data = value || { ventilator: [], hemodynamics: [], drips: [] };

  const [ventSettings, setVentSettings] = useState<VentilatorSettings>(DEFAULT_VENT_SETTINGS);
  const [abgPh, setAbgPh] = useState('');
  const [abgPco2, setAbgPco2] = useState('');
  const [abgPo2, setAbgPo2] = useState('');
  const [abgHco3, setAbgHco3] = useState('');
  const [abgBE, setAbgBE] = useState('');
  const [abgLactate, setAbgLactate] = useState('');

  const [hemo, setHemo] = useState<HemodynamicReading>({ ...DEFAULT_HEMO, recordedAt: new Date().toISOString() });

  const [dripName, setDripName] = useState('');
  const [dripConc, setDripConc] = useState('');
  const [dripRate, setDripRate] = useState('');
  const [dripDose, setDripDose] = useState('');

  const [section, setSection] = useState<'vent' | 'hemo' | 'drip'>('vent');

  const addVentReading = () => {
    const reading = {
      settings: { ...ventSettings },
      measured: {
        actualTv: 0, actualRr: 0, minuteVent: 0,
        peakPressure: 0, plateauPressure: 0, compliance: 0, resistance: 0,
      },
      abg: abgPh ? {
        ph: Number(abgPh) || 0, pco2: Number(abgPco2) || 0,
        po2: Number(abgPo2) || 0, hco3: Number(abgHco3) || 0,
        baseExcess: Number(abgBE) || 0, lactate: Number(abgLactate) || 0,
      } : undefined,
      recordedAt: new Date().toISOString(),
    };
    const updated = { ...data, ventilator: [reading, ...data.ventilator] };
    onChange(updated);
    setAbgPh(''); setAbgPco2(''); setAbgPo2(''); setAbgHco3(''); setAbgBE(''); setAbgLactate('');
  };

  const addHemoReading = () => {
    const reading = { ...hemo, recordedAt: new Date().toISOString() };
    const updated = { ...data, hemodynamics: [reading, ...data.hemodynamics] };
    onChange(updated);
    setHemo({ ...DEFAULT_HEMO, recordedAt: new Date().toISOString() });
  };

  const addDrip = () => {
    if (!dripName.trim()) return;
    const entry: DripEntry = {
      id: crypto.randomUUID?.() || Date.now().toString(),
      drugName: dripName.trim(),
      concentration: dripConc.trim(),
      rate: Number(dripRate) || 0,
      dose: dripDose.trim(),
      startedAt: new Date().toISOString(),
      adjustments: [],
    };
    const updated = { ...data, drips: [...data.drips, entry] };
    onChange(updated);
    setDripName(''); setDripConc(''); setDripRate(''); setDripDose('');
  };

  const stopDrip = (id: string) => {
    const updated = {
      ...data,
      drips: data.drips.map((d) => d.id === id ? { ...d, stoppedAt: new Date().toISOString() } : d),
    };
    onChange(updated);
  };

  const pfResult = data.ventilator[0]?.abg
    ? calculatePFRatio(data.ventilator[0].abg.po2, data.ventilator[0].settings.fio2)
    : null;

  return (
    <div className="border rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-1">
          <Building2 className="h-4 w-4" />
          {tr('مراقبة العناية المركزة', 'ICU Monitoring')}
        </h3>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1">
        {(['vent', 'hemo', 'drip'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`text-xs px-3 py-1.5 rounded-md transition font-medium ${
              section === s
                ? 'bg-rose-600 text-white'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            {s === 'vent' ? tr('التنفس الصناعي', 'Ventilator')
              : s === 'hemo' ? tr('الديناميكا الدموية', 'Hemodynamics')
              : tr('التسريبات', 'Drips')}
          </button>
        ))}
      </div>

      {/* ── Ventilator Section ── */}
      {section === 'vent' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">{tr('الوضع', 'Mode')}</label>
              <Select value={ventSettings.mode} onValueChange={(v: VentMode) => setVentSettings((p) => ({ ...p, mode: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VENT_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.labelEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {[
              { key: 'fio2', label: 'FiO2 %', ar: 'FiO2 %' },
              { key: 'peep', label: 'PEEP', ar: 'PEEP' },
              { key: 'tidalVolume', label: 'TV (mL)', ar: 'حجم مدّي' },
              { key: 'rr', label: 'Set RR', ar: 'معدل التنفس' },
              { key: 'pip', label: 'PIP', ar: 'PIP' },
              { key: 'ps', label: 'PS', ar: 'PS' },
            ].map(({ key, label, ar }) => (
              <div key={key}>
                <label className="text-xs text-muted-foreground">{tr(ar, label)}</label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  value={ventSettings[key as keyof VentilatorSettings]}
                  onChange={(e) => setVentSettings((p) => ({ ...p, [key]: Number(e.target.value) || 0 }))}
                />
              </div>
            ))}
          </div>

          {/* ABG */}
          <div>
            <p className="text-xs font-medium mb-1">{tr('غازات الدم', 'ABG')}</p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {[
                { val: abgPh, set: setAbgPh, label: 'pH' },
                { val: abgPco2, set: setAbgPco2, label: 'PaCO2' },
                { val: abgPo2, set: setAbgPo2, label: 'PaO2' },
                { val: abgHco3, set: setAbgHco3, label: 'HCO3' },
                { val: abgBE, set: setAbgBE, label: 'BE' },
                { val: abgLactate, set: setAbgLactate, label: 'Lactate' },
              ].map(({ val, set, label }) => (
                <div key={label}>
                  <label className="text-[10px] text-muted-foreground">{label}</label>
                  <Input type="number" step="0.1" className="h-7 text-xs" value={val} onChange={(e) => set(e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          {pfResult && pfResult.ratio > 0 && (
            <div className={`text-xs px-2 py-1 rounded ${
              pfResult.category === 'normal' ? 'bg-green-100 text-green-800' :
              pfResult.category === 'mild' ? 'bg-amber-100 text-amber-800' :
              pfResult.category === 'moderate' ? 'bg-orange-100 text-orange-800' :
              'bg-red-100 text-red-800'
            }`}>
              P/F Ratio: {pfResult.ratio} — {tr(pfResult.labelAr, pfResult.labelEn)}
            </div>
          )}

          <button onClick={addVentReading} className="w-full py-1.5 text-xs rounded bg-rose-600 text-white hover:bg-rose-700 transition">
            {tr('تسجيل قراءة', 'Record Reading')}
          </button>

          {data.ventilator.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {data.ventilator.map((v, i) => (
                <div key={i} className="text-xs border rounded p-2 flex justify-between">
                  <span>{v.settings.mode} FiO2:{v.settings.fio2}% PEEP:{v.settings.peep} TV:{v.settings.tidalVolume}</span>
                  <span className="text-muted-foreground">{new Date(v.recordedAt).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Hemodynamics Section ── */}
      {section === 'hemo' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { key: 'map', label: 'MAP', ar: 'MAP' },
              { key: 'cvp', label: 'CVP', ar: 'CVP' },
              { key: 'co', label: 'CO (L/min)', ar: 'النتاج القلبي' },
              { key: 'ci', label: 'CI', ar: 'مؤشر القلب' },
              { key: 'svr', label: 'SVR', ar: 'SVR' },
              { key: 'svv', label: 'SVV %', ar: 'SVV' },
              { key: 'scvO2', label: 'ScvO2 %', ar: 'ScvO2' },
            ].map(({ key, label, ar }) => (
              <div key={key}>
                <label className="text-xs text-muted-foreground">{tr(ar, label)}</label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  value={hemo[key as keyof HemodynamicReading] as any || ''}
                  onChange={(e) => setHemo((p) => ({ ...p, [key]: Number(e.target.value) || 0 }))}
                />
              </div>
            ))}
            <div>
              <label className="text-xs text-muted-foreground">{tr('ضغط شرياني', 'Art Line')}</label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  placeholder="Sys"
                  className="h-8 text-xs w-1/2"
                  value={hemo.art.systolic || ''}
                  onChange={(e) => setHemo((p) => ({ ...p, art: { ...p.art, systolic: Number(e.target.value) || 0 } }))}
                />
                <Input
                  type="number"
                  placeholder="Dia"
                  className="h-8 text-xs w-1/2"
                  value={hemo.art.diastolic || ''}
                  onChange={(e) => setHemo((p) => ({ ...p, art: { ...p.art, diastolic: Number(e.target.value) || 0 } }))}
                />
              </div>
            </div>
          </div>

          {hemo.art.systolic > 0 && (
            <div className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
              Calculated MAP: {calculateMAP(hemo.art.systolic, hemo.art.diastolic)} mmHg
            </div>
          )}

          <button onClick={addHemoReading} className="w-full py-1.5 text-xs rounded bg-rose-600 text-white hover:bg-rose-700 transition">
            {tr('تسجيل قراءة', 'Record Reading')}
          </button>

          {data.hemodynamics.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {data.hemodynamics.map((h, i) => (
                <div key={i} className="text-xs border rounded p-2 flex justify-between">
                  <span>MAP:{h.map} CVP:{h.cvp} CO:{h.co} CI:{h.ci} Art:{h.art.systolic}/{h.art.diastolic}</span>
                  <span className="text-muted-foreground">{new Date(h.recordedAt).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Drips Section ── */}
      {section === 'drip' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">{tr('اسم الدواء', 'Drug Name')}</label>
              <Input className="h-8 text-xs" value={dripName} onChange={(e) => setDripName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{tr('التركيز', 'Concentration')}</label>
              <Input className="h-8 text-xs" value={dripConc} onChange={(e) => setDripConc(e.target.value)} placeholder="e.g., 4mg/250mL" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{tr('المعدل', 'Rate (mL/hr)')}</label>
              <Input type="number" className="h-8 text-xs" value={dripRate} onChange={(e) => setDripRate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{tr('الجرعة', 'Dose')}</label>
              <Input className="h-8 text-xs" value={dripDose} onChange={(e) => setDripDose(e.target.value)} placeholder="e.g., 5 mcg/kg/min" />
            </div>
          </div>
          <button onClick={addDrip} disabled={!dripName.trim()} className="w-full py-1.5 text-xs rounded bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition">
            {tr('إضافة تسريب', 'Add Drip')}
          </button>

          {data.drips.length > 0 && (
            <div className="space-y-1">
              {data.drips.map((d) => (
                <div key={d.id} className={`text-xs border rounded p-2 flex items-center justify-between ${d.stoppedAt ? 'opacity-50' : ''}`}>
                  <div>
                    <span className="font-medium">{d.drugName}</span>
                    <span className="text-muted-foreground mx-1">{d.concentration}</span>
                    <span className="font-bold text-rose-600">{d.rate} mL/hr</span>
                    {d.dose && <span className="text-muted-foreground ml-1">({d.dose})</span>}
                  </div>
                  {!d.stoppedAt ? (
                    <button onClick={() => stopDrip(d.id)} className="text-red-600 hover:text-red-800 font-medium">
                      {tr('إيقاف', 'Stop')}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">{tr('متوقف', 'Stopped')}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
