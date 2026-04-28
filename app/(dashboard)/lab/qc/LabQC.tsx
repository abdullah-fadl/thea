'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { BarChart3, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function LabQC() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [selectedAnalyte, setSelectedAnalyte] = useState('');
  const [showEntry, setShowEntry] = useState(false);

  // Entry form state
  const [formAnalyte, setFormAnalyte] = useState('');
  const [formLot, setFormLot] = useState('');
  const [formLevel, setFormLevel] = useState(1);
  const [formValue, setFormValue] = useState('');
  const [formMean, setFormMean] = useState('');
  const [formSD, setFormSD] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const queryParams = selectedAnalyte ? `?analyteCode=${selectedAnalyte}&limit=30` : '?limit=30';
  const { data, mutate } = useSWR(`/api/lab/qc${queryParams}`, fetcher);

  const results = data?.results ?? [];
  const analytes = data?.analytes ?? [];

  // Build Levey-Jennings data (chronological)
  const ljData = useMemo(() => {
    if (results.length === 0) return null;

    const sorted = [...results]
      .sort((a: any, b: any) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime());

    const mean = sorted[0]?.mean ?? 0;
    const sd = sorted[0]?.sd ?? 1;

    return {
      points: sorted.map((r: any) => ({
        date: new Date(r.performedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: r.value,
        zScore: r.zScore,
        status: r.status,
      })),
      mean,
      sd,
    };
  }, [results]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setLastResult(null);

    try {
      const res = await fetch('/api/lab/qc', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analyteCode: formAnalyte,
          lotNumber: formLot,
          level: formLevel,
          value: Number(formValue),
          mean: Number(formMean),
          sd: Number(formSD),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setLastResult(data);
        setFormValue('');
        mutate();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tr('مراقبة الجودة', 'Quality Control')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{tr('مراقبة الجودة — قواعد ويستجارد', 'Quality Control — Westgard Rules')}</p>
          </div>
          <button
            onClick={() => setShowEntry(!showEntry)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            {tr('إدخال قياس QC', 'Enter QC Measurement')}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: QC Entry + Last Result */}
          <div className="space-y-4">
            {/* Analyte selector */}
            <div className="bg-card rounded-2xl border border-border p-4">
              <label className="text-sm font-medium text-foreground block mb-2">{tr('اختر التحليل', 'Select Analyte')}</label>
              <select
                value={selectedAnalyte}
                onChange={(e) => setSelectedAnalyte(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus text-sm"
              >
                <option value="">{tr('جميع التحاليل', 'All Analytes')}</option>
                {analytes.map((a: any) => (
                  <option key={a.code} value={a.code}>
                    {a.code} {a.name?.ar ? `— ${a.name.ar}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Entry form */}
            {showEntry && (
              <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-4 space-y-3">
                <h3 className="font-bold text-foreground text-sm">{tr('إدخال قياس جديد', 'Enter New Measurement')}</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">{tr('رمز التحليل', 'Analyte Code')}</label>
                    <input
                      type="text"
                      value={formAnalyte}
                      onChange={(e) => setFormAnalyte(e.target.value)}
                      placeholder="GLU"
                      required
                      className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">{tr('رقم الدفعة', 'Lot Number')}</label>
                    <input
                      type="text"
                      value={formLot}
                      onChange={(e) => setFormLot(e.target.value)}
                      placeholder="LOT-2026-01"
                      required
                      className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">{tr('المستوى', 'Level')}</label>
                    <select
                      value={formLevel}
                      onChange={(e) => setFormLevel(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus text-sm"
                    >
                      <option value={1}>{tr('المستوى 1', 'Level 1')}</option>
                      <option value={2}>{tr('المستوى 2', 'Level 2')}</option>
                      <option value={3}>{tr('المستوى 3', 'Level 3')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">{tr('المتوسط', 'Mean')}</label>
                    <input
                      type="number"
                      step="any"
                      value={formMean}
                      onChange={(e) => setFormMean(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">{tr('الانحراف المعياري', 'SD')}</label>
                    <input
                      type="number"
                      step="any"
                      value={formSD}
                      onChange={(e) => setFormSD(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">{tr('القيمة المقاسة', 'Measured Value')}</label>
                  <input
                    type="number"
                    step="any"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus text-sm text-lg font-bold"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ القياس', 'Save Measurement')}
                </button>
              </form>
            )}

            {/* Last result feedback */}
            {lastResult && (
              <div
                className={`rounded-2xl border p-4 ${
                  lastResult.westgard.status === 'pass'
                    ? 'bg-green-50 border-green-200'
                    : lastResult.westgard.status === 'warning'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {lastResult.westgard.status === 'pass' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  )}
                  <span className="font-bold text-sm">
                    z = {Number(lastResult.westgard.zScore).toFixed(2)} — {lastResult.westgard.status.toUpperCase()}
                  </span>
                </div>
                {lastResult.westgard.violations.length > 0 && (
                  <ul className="text-xs space-y-1">
                    {lastResult.westgard.violations.map((v: any, i: number) => (
                      <li key={i} className="text-red-700">
                        {v.rule}: {v.message.en}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Right: Levey-Jennings Chart */}
          <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-5">
            <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              <span>{tr('مخطط ليفي-جينينغز', 'Levey-Jennings Chart')}</span>
              {selectedAnalyte && (
                <span className="text-sm font-normal text-muted-foreground">— {selectedAnalyte}</span>
              )}
            </h2>

            {ljData && ljData.points.length > 0 ? (
              <LeveyJenningsChart data={ljData} />
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                {tr('لا توجد بيانات كافية لعرض الرسم البياني', 'Not enough data to display chart')}
              </div>
            )}

            {/* Results table */}
            {results.length > 0 && (
              <div className="mt-4 max-h-[200px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">{tr('التاريخ', 'Date')}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">{tr('القيمة', 'Value')}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">z-Score</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">{tr('الحالة', 'Status')}</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">{tr('القاعدة', 'Rule')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {results.map((r: any, i: number) => (
                      <tr key={r.id || i}>
                        <td className="px-3 py-1.5 text-muted-foreground text-xs">
                          {new Date(r.performedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-3 py-1.5 font-medium">{Number(r.value).toFixed(2)}</td>
                        <td className="px-3 py-1.5">{Number(r.zScore).toFixed(2)}</td>
                        <td className="px-3 py-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              r.status === 'pass'
                                ? 'bg-green-100 text-green-700'
                                : r.status === 'warning'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">
                          {r.violations?.map((v: any) => v.rule).join(', ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Levey-Jennings Chart (CSS-based, no external chart lib)
// ---------------------------------------------------------------------------

function LeveyJenningsChart({
  data,
}: {
  data: {
    points: { date: string; value: number; zScore: number; status: string }[];
    mean: number;
    sd: number;
  };
}) {
  const { points, mean, sd } = data;

  // Y-axis range: mean ± 4 SD
  const yMin = mean - 4 * sd;
  const yMax = mean + 4 * sd;
  const yRange = yMax - yMin;

  const toY = (value: number) => {
    const pct = ((yMax - value) / yRange) * 100;
    return Math.max(0, Math.min(100, pct));
  };

  const sdLines = [
    { label: '+3SD', value: mean + 3 * sd, color: 'border-red-300', textColor: 'text-red-500' },
    { label: '+2SD', value: mean + 2 * sd, color: 'border-yellow-300', textColor: 'text-yellow-600' },
    { label: '+1SD', value: mean + 1 * sd, color: 'border-border', textColor: 'text-muted-foreground' },
    { label: 'Mean', value: mean, color: 'border-blue-400', textColor: 'text-blue-600' },
    { label: '-1SD', value: mean - 1 * sd, color: 'border-border', textColor: 'text-muted-foreground' },
    { label: '-2SD', value: mean - 2 * sd, color: 'border-yellow-300', textColor: 'text-yellow-600' },
    { label: '-3SD', value: mean - 3 * sd, color: 'border-red-300', textColor: 'text-red-500' },
  ];

  return (
    <div className="relative h-64 w-full">
      {/* SD reference lines */}
      {sdLines.map((line) => (
        <div
          key={line.label}
          className={`absolute left-10 right-0 border-t border-dashed ${line.color}`}
          style={{ top: `${toY(line.value)}%` }}
        >
          <span className={`absolute -left-10 -top-2 text-[9px] font-mono ${line.textColor}`}>
            {line.label}
          </span>
        </div>
      ))}

      {/* Data points */}
      <div className="absolute left-10 right-0 top-0 bottom-0 flex items-end">
        {points.map((point, i) => {
          const x = points.length > 1 ? (i / (points.length - 1)) * 100 : 50;
          const y = toY(point.value);

          return (
            <div
              key={i}
              className="absolute"
              style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
              title={`${point.date}: ${point.value} (z=${Number(point.zScore).toFixed(2)})`}
            >
              <div
                className={`w-3 h-3 rounded-full border-2 ${
                  point.status === 'pass'
                    ? 'bg-green-500 border-green-600'
                    : point.status === 'warning'
                    ? 'bg-yellow-400 border-yellow-600'
                    : 'bg-red-500 border-red-600'
                }`}
              />
            </div>
          );
        })}

        {/* Connecting lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          {points.map((point, i) => {
            if (i === 0) return null;
            const prev = points[i - 1];
            const x1 = points.length > 1 ? ((i - 1) / (points.length - 1)) * 100 : 50;
            const x2 = points.length > 1 ? (i / (points.length - 1)) * 100 : 50;
            const y1 = toY(prev.value);
            const y2 = toY(point.value);
            return (
              <line
                key={i}
                x1={`${x1}%`}
                y1={`${y1}%`}
                x2={`${x2}%`}
                y2={`${y2}%`}
                stroke="#94a3b8"
                strokeWidth="1"
              />
            );
          })}
        </svg>
      </div>

      {/* X-axis labels */}
      <div className="absolute left-10 right-0 bottom-0 flex justify-between translate-y-4">
        {points.length <= 10
          ? points.map((p, i) => (
              <span key={i} className="text-[8px] text-muted-foreground">
                {p.date}
              </span>
            ))
          : [0, Math.floor(points.length / 2), points.length - 1].map((idx) => (
              <span key={idx} className="text-[8px] text-muted-foreground">
                {points[idx]?.date}
              </span>
            ))}
      </div>
    </div>
  );
}
