'use client';

/**
 * Partogram — Labor Progress Chart
 * WHO-standard partogram showing cervical dilation vs. time with alert and action lines.
 * Reads/writes from obgyn_forms with type: 'partogram_reading'.
 */

import { useState } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Plus, RefreshCw } from 'lucide-react';

interface PartogramReading {
  id?: string;
  recordedAt: string; // ISO string
  dilation: number;   // 0-10 cm
  station: number;    // -3 to +3
  fetalHr: number;    // bpm
  contractions: number; // per 10 min
  bp: string;         // e.g. "120/80"
  hr: number;         // maternal
  temp: number;       // °C
  oxytocin?: string;  // units/hr
  liquor?: 'CLEAR' | 'MECONIUM_THIN' | 'MECONIUM_THICK' | 'BLOOD' | 'ABSENT';
}

interface Props {
  patientId: string;
}

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

// WHO alert line: starts at 3cm dilation at hour 0, rises 1cm/hr
// Action line: alert line + 4 hours
function getAlertDilation(hours: number) { return Math.min(10, 3 + hours); }
function getActionDilation(hours: number) { return Math.min(10, 3 + Math.max(0, hours - 4)); }

export default function Partogram({ patientId }: Props) {
  const { language } = useLang();
  const isAr = language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);

  const { data, isLoading, mutate } = useSWR(
    `/api/obgyn/forms/${patientId}?type=partogram_reading`,
    fetcher,
  );

  const readings: PartogramReading[] = (data?.items ?? []).map((item: any) => item.data as PartogramReading);
  const sortedReadings = [...readings].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  // Compute hours from first reading
  const firstTime = sortedReadings[0]?.recordedAt ? new Date(sortedReadings[0].recordedAt).getTime() : null;
  const readingsWithHour = sortedReadings.map(r => ({
    ...r,
    hour: firstTime ? (new Date(r.recordedAt).getTime() - firstTime) / 3600000 : 0,
  }));

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Omit<PartogramReading, 'id'>>({
    recordedAt: new Date().toISOString().slice(0, 16),
    dilation: 0,
    station: 0,
    fetalHr: 140,
    contractions: 0,
    bp: '',
    hr: 80,
    temp: 37.0,
    oxytocin: '',
    liquor: 'CLEAR',
  });

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/obgyn/forms/${patientId}`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'partogram_reading', data: form }),
      });
      await mutate();
      setShowForm(false);
      setForm(prev => ({ ...prev, recordedAt: new Date().toISOString().slice(0, 16) }));
    } finally {
      setSaving(false);
    }
  }

  // SVG chart dimensions
  const SVG_W = 600;
  const SVG_H = 260;
  const PAD = { top: 20, right: 20, bottom: 30, left: 45 };
  const chartW = SVG_W - PAD.left - PAD.right;
  const chartH = SVG_H - PAD.top - PAD.bottom;
  const maxHours = 24;

  function xPx(h: number) { return PAD.left + (h / maxHours) * chartW; }
  function yPx(dilation: number) { return PAD.top + chartH - (dilation / 10) * chartH; }

  // Build path string for a set of [hour, dilation] points
  function makePath(points: [number, number][]): string {
    if (points.length === 0) return '';
    return points.map(([h, d], i) => `${i === 0 ? 'M' : 'L'}${xPx(h).toFixed(1)},${yPx(d).toFixed(1)}`).join(' ');
  }

  // Alert line: [0,3] → [7,10]
  const alertLinePoints: [number, number][] = Array.from({ length: 8 }, (_, i) => [i, getAlertDilation(i)]);
  // Action line: [4,3] → [11,10]
  const actionLinePoints: [number, number][] = Array.from({ length: 8 }, (_, i) => [i + 4, getActionDilation(i + 4)]);
  // Patient dilation path
  const patientPoints: [number, number][] = readingsWithHour.map(r => [r.hour, r.dilation]);

  const liquorColors: Record<string, string> = {
    CLEAR: 'text-blue-600',
    MECONIUM_THIN: 'text-yellow-600',
    MECONIUM_THICK: 'text-orange-700',
    BLOOD: 'text-red-600',
    ABSENT: 'text-muted-foreground',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {tr('الباروتغرام — متابعة المخاض', 'Partogram — Labor Progress')}
        </h3>
        <div className="flex gap-2">
          <button onClick={() => mutate()} className="p-1.5 rounded-lg border border-border hover:bg-muted/50 transition">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition">
            <Plus className="w-3.5 h-3.5" />
            {tr('قراءة جديدة', 'Add Reading')}
          </button>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card p-2">
        <svg width={SVG_W} height={SVG_H} className="min-w-full">
          {/* Grid lines */}
          {Array.from({ length: 11 }, (_, i) => i).map(d => (
            <g key={`dil-${d}`}>
              <line x1={PAD.left} y1={yPx(d)} x2={SVG_W - PAD.right} y2={yPx(d)} stroke="#e5e7eb" strokeWidth={0.5} />
              <text x={PAD.left - 6} y={yPx(d) + 4} fontSize={9} textAnchor="end" fill="#9ca3af">{d}</text>
            </g>
          ))}
          {Array.from({ length: maxHours + 1 }, (_, i) => i).map(h => (
            <g key={`hr-${h}`}>
              <line x1={xPx(h)} y1={PAD.top} x2={xPx(h)} y2={SVG_H - PAD.bottom} stroke="#e5e7eb" strokeWidth={0.5} />
              {h % 2 === 0 && <text x={xPx(h)} y={SVG_H - PAD.bottom + 14} fontSize={9} textAnchor="middle" fill="#9ca3af">{h}h</text>}
            </g>
          ))}

          {/* Axes */}
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={SVG_H - PAD.bottom} stroke="#6b7280" strokeWidth={1} />
          <line x1={PAD.left} y1={SVG_H - PAD.bottom} x2={SVG_W - PAD.right} y2={SVG_H - PAD.bottom} stroke="#6b7280" strokeWidth={1} />

          {/* Axis labels */}
          <text x={12} y={SVG_H / 2} fontSize={9} fill="#6b7280" transform={`rotate(-90, 12, ${SVG_H / 2})`} textAnchor="middle">
            {tr('تمدد (سم)', 'Dilation (cm)')}
          </text>
          <text x={SVG_W / 2} y={SVG_H - 2} fontSize={9} fill="#6b7280" textAnchor="middle">
            {tr('الزمن (ساعات)', 'Time (hours)')}
          </text>

          {/* Alert line (orange dashed) */}
          <path d={makePath(alertLinePoints)} fill="none" stroke="#f97316" strokeWidth={1.5} strokeDasharray="5,3" />
          <text x={xPx(7) + 4} y={yPx(10) + 3} fontSize={8} fill="#f97316">{tr('خط التنبيه', 'Alert')}</text>

          {/* Action line (red dashed) */}
          <path d={makePath(actionLinePoints)} fill="none" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5,3" />
          <text x={xPx(11) + 4} y={yPx(10) + 3} fontSize={8} fill="#ef4444">{tr('خط التدخل', 'Action')}</text>

          {/* Patient dilation (blue solid) */}
          {patientPoints.length > 0 && (
            <>
              <path d={makePath(patientPoints)} fill="none" stroke="#2563eb" strokeWidth={2} />
              {patientPoints.map(([h, d], i) => (
                <circle key={i} cx={xPx(h)} cy={yPx(d)} r={3.5} fill="#2563eb" />
              ))}
            </>
          )}

          {/* Legend */}
          <g transform={`translate(${PAD.left + 10}, ${PAD.top + 5})`}>
            <line x1={0} y1={6} x2={16} y2={6} stroke="#2563eb" strokeWidth={2} />
            <text x={20} y={10} fontSize={8} fill="#2563eb">{tr('التمدد', 'Dilation')}</text>
          </g>
        </svg>
      </div>

      {/* Readings Table */}
      {sortedReadings.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="px-2 py-1.5 text-left border">{tr('الوقت', 'Time')}</th>
                <th className="px-2 py-1.5 text-center border">{tr('تمدد', 'Dil.')}</th>
                <th className="px-2 py-1.5 text-center border">{tr('الوضع', 'Station')}</th>
                <th className="px-2 py-1.5 text-center border">{tr('نبض جنين', 'FHR')}</th>
                <th className="px-2 py-1.5 text-center border">{tr('تقلصات/10د', 'Ctx/10m')}</th>
                <th className="px-2 py-1.5 text-center border">{tr('ضغط', 'BP')}</th>
                <th className="px-2 py-1.5 text-center border">{tr('نبض', 'HR')}</th>
                <th className="px-2 py-1.5 text-center border">{tr('حرارة', 'Temp')}</th>
                <th className="px-2 py-1.5 text-center border">{tr('السائل', 'Liquor')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedReadings.map((r, idx) => (
                <tr key={idx} className="border-b hover:bg-muted/50">
                  <td className="px-2 py-1 border text-muted-foreground">
                    {new Date(r.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-2 py-1 text-center border font-medium text-blue-600">{r.dilation} cm</td>
                  <td className="px-2 py-1 text-center border">{r.station > 0 ? `+${r.station}` : r.station}</td>
                  <td className={`px-2 py-1 text-center border font-medium ${r.fetalHr < 110 || r.fetalHr > 160 ? 'text-red-600' : 'text-foreground'}`}>{r.fetalHr}</td>
                  <td className="px-2 py-1 text-center border">{r.contractions}</td>
                  <td className="px-2 py-1 text-center border">{r.bp}</td>
                  <td className="px-2 py-1 text-center border">{r.hr}</td>
                  <td className="px-2 py-1 text-center border">{r.temp}°C</td>
                  <td className={`px-2 py-1 text-center border font-medium ${liquorColors[r.liquor ?? 'CLEAR']}`}>
                    {r.liquor ? tr(
                      r.liquor === 'CLEAR' ? 'صافٍ' : r.liquor === 'MECONIUM_THIN' ? 'عقي خفيف' : r.liquor === 'MECONIUM_THICK' ? 'عقي كثيف' : r.liquor === 'BLOOD' ? 'دموي' : 'غائب',
                      r.liquor.replace('_', ' ')
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sortedReadings.length === 0 && !isLoading && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          {tr('لا توجد قراءات بعد. أضف أول قراءة للبدء.', 'No readings yet. Add the first reading to begin.')}
        </div>
      )}

      {/* Add Reading Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-pink-600 to-rose-600">
              <h3 className="font-semibold text-white">{tr('إضافة قراءة باروتغرام', 'Add Partogram Reading')}</h3>
              <button onClick={() => setShowForm(false)} className="text-white/80 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">{tr('الوقت', 'Time')}</label>
                  <input type="datetime-local" value={form.recordedAt} onChange={e => setForm(p => ({ ...p, recordedAt: e.target.value }))}
                    className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card mt-0.5" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{tr('تمدد عنق الرحم (سم)', 'Dilation (cm)')}</label>
                  <input type="number" min={0} max={10} step={0.5} value={form.dilation} onChange={e => setForm(p => ({ ...p, dilation: Number(e.target.value) }))}
                    className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card mt-0.5" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{tr('وضع الرأس (station)', 'Station (-3 to +3)')}</label>
                  <input type="number" min={-3} max={3} value={form.station} onChange={e => setForm(p => ({ ...p, station: Number(e.target.value) }))}
                    className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card mt-0.5" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{tr('نبض الجنين (bpm)', 'Fetal HR (bpm)')}</label>
                  <input type="number" min={60} max={200} value={form.fetalHr} onChange={e => setForm(p => ({ ...p, fetalHr: Number(e.target.value) }))}
                    className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card mt-0.5" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{tr('تقلصات / 10 دقائق', 'Contractions/10 min')}</label>
                  <input type="number" min={0} max={10} value={form.contractions} onChange={e => setForm(p => ({ ...p, contractions: Number(e.target.value) }))}
                    className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card mt-0.5" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{tr('ضغط الدم', 'Blood Pressure')}</label>
                  <input type="text" placeholder="e.g. 120/80" value={form.bp} onChange={e => setForm(p => ({ ...p, bp: e.target.value }))}
                    className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card mt-0.5" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{tr('نبض الأم (bpm)', 'Maternal HR (bpm)')}</label>
                  <input type="number" min={40} max={200} value={form.hr} onChange={e => setForm(p => ({ ...p, hr: Number(e.target.value) }))}
                    className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card mt-0.5" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{tr('الحرارة (°C)', 'Temperature (°C)')}</label>
                  <input type="number" min={35} max={42} step={0.1} value={form.temp} onChange={e => setForm(p => ({ ...p, temp: Number(e.target.value) }))}
                    className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card mt-0.5" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{tr('الأوكسيتوسين', 'Oxytocin (units/hr)')}</label>
                  <input type="text" placeholder="e.g. 4 units/hr" value={form.oxytocin ?? ''} onChange={e => setForm(p => ({ ...p, oxytocin: e.target.value }))}
                    className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card mt-0.5" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{tr('السائل الأمنيوسي', 'Liquor')}</label>
                  <select value={form.liquor} onChange={e => setForm(p => ({ ...p, liquor: e.target.value as PartogramReading['liquor'] }))}
                    className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card mt-0.5">
                    <option value="CLEAR">{tr('صافٍ', 'Clear')}</option>
                    <option value="MECONIUM_THIN">{tr('عقي خفيف', 'Meconium (thin)')}</option>
                    <option value="MECONIUM_THICK">{tr('عقي كثيف', 'Meconium (thick)')}</option>
                    <option value="BLOOD">{tr('دموي', 'Blood')}</option>
                    <option value="ABSENT">{tr('غائب', 'Absent')}</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="border-t border-border p-4 flex gap-2 justify-end bg-muted/50/50">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition">
                {tr('إلغاء', 'Cancel')}
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 transition">
                {saving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
