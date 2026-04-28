'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Activity, TrendingDown, TrendingUp, Save } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const PERCENTILE_COLORS: Record<string, string> = {
  below_p25: 'bg-green-100 text-green-800 border-green-300',
  p25_p50:   'bg-green-50 text-green-700 border-green-200',
  p50_p75:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  p75_p90:   'bg-orange-50 text-orange-700 border-orange-200',
  above_p90: 'bg-red-50 text-red-700 border-red-200',
};
const PERCENTILE_LABELS: Record<string, { ar: string; en: string }> = {
  below_p25: { ar: 'أفضل من 75% من المستشفيات', en: 'Better than 75% of hospitals' },
  p25_p50:   { ar: 'أفضل من المتوسط',          en: 'Better than average' },
  p50_p75:   { ar: 'قريب من المتوسط',           en: 'Near average' },
  p75_p90:   { ar: 'أعلى من المتوسط',           en: 'Above average' },
  above_p90: { ar: 'يحتاج تحسين عاجل',          en: 'Needs urgent improvement' },
};

const DEPARTMENTS = ['ICU', 'MICU', 'SICU', 'NICU', 'PICU', 'CCU', 'CVICU', 'General Ward', 'ER'];

interface Props {
  tr: (ar: string, en: string) => string;
  language: string;
}

export default function HAIRatesTab({ tr, language }: Props) {
  const now = new Date();
  const defaultEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const start12 = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const defaultStart = `${start12.getFullYear()}-${String(start12.getMonth() + 1).padStart(2, '0')}`;

  const { data } = useSWR(
    `/api/infection-control/hai-rates?startMonth=${defaultStart}&endMonth=${defaultEnd}`,
    fetcher, { refreshInterval: 120000 }
  );

  const rates: Record<string, unknown>[] = data?.rates || [];
  const monthlyTrend: Record<string, unknown>[] = data?.monthlyTrend || [];

  // Device-day entry form
  const [ddForm, setDdForm] = useState({
    recordDate: now.toISOString().slice(0, 10),
    department: 'ICU',
    patientDays: '',
    ventilatorDays: '',
    centralLineDays: '',
    urinaryCatheterDays: '',
  });
  const [ddBusy, setDdBusy] = useState(false);
  const [ddMsg, setDdMsg] = useState('');

  const saveDeviceDays = async () => {
    setDdBusy(true);
    setDdMsg('');
    try {
      const res = await fetch('/api/infection-control/device-days', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ddForm),
      });
      if (res.ok) setDdMsg(tr('تم الحفظ', 'Saved'));
      else { const e = await res.json().catch(() => ({})); setDdMsg(e.error || tr('خطأ', 'Error')); }
    } finally { setDdBusy(false); }
  };

  // Extract unique months for trend chart
  const trendByMonth: Record<string, Record<string, number>> = {};
  for (const t of monthlyTrend as any[]) {
    if (!trendByMonth[t.month]) trendByMonth[t.month] = {};
    trendByMonth[t.month][t.type] = t.rate;
  }
  const months = Object.keys(trendByMonth).sort();

  return (
    <div className="space-y-6">
      {/* Rate Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {rates.map((r: any) => {
          const pColor = PERCENTILE_COLORS[r.percentilePosition] || 'bg-muted/50 text-foreground border-border';
          const pLabel = PERCENTILE_LABELS[r.percentilePosition];
          return (
            <div key={r.type} className={`rounded-2xl border-2 p-5 ${pColor}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-black">{r.type}</span>
                <Activity className="h-5 w-5 opacity-50" />
              </div>
              <p className="text-4xl font-extrabold">{r.rate}</p>
              <p className="text-xs mt-1 opacity-70">
                {r.infections} {tr('عدوى', 'infections')} / {r.denominatorValue.toLocaleString()} {r.denominatorLabel}
              </p>
              {r.benchmark && (
                <div className="mt-3 pt-3 border-t border-current/10">
                  <p className="text-[11px] font-semibold opacity-80">NHSN {tr('مرجعي', 'Benchmark')}</p>
                  <div className="flex gap-2 text-[10px] mt-1 opacity-60">
                    <span>P25: {r.benchmark.p25}</span>
                    <span>P50: {r.benchmark.p50}</span>
                    <span>P75: {r.benchmark.p75}</span>
                    <span>P90: {r.benchmark.p90}</span>
                  </div>
                  <p className="text-xs mt-1.5 font-medium">
                    {r.percentilePosition === 'below_p25' && <TrendingDown className="h-3 w-3 inline mr-1" />}
                    {r.percentilePosition === 'above_p90' && <TrendingUp className="h-3 w-3 inline mr-1" />}
                    {pLabel ? tr(pLabel.ar, pLabel.en) : ''}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Monthly Trend */}
      {months.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-bold mb-4">{tr('الاتجاه الشهري', 'Monthly Trend')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-start px-3 py-2 font-semibold">{tr('الشهر', 'Month')}</th>
                  {['VAP', 'CLABSI', 'CAUTI', 'SSI'].map((t) => (
                    <th key={t} className="text-center px-3 py-2 font-semibold">{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono">{m}</td>
                    {['VAP', 'CLABSI', 'CAUTI', 'SSI'].map((t) => {
                      const val = trendByMonth[m]?.[t] ?? 0;
                      const bg = val === 0 ? '' : val <= 1 ? 'bg-green-50' : val <= 3 ? 'bg-yellow-50' : 'bg-red-50';
                      return <td key={t} className={`text-center px-3 py-2 font-bold ${bg}`}>{val}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Device-Day Data Entry */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
          <Save className="h-4 w-4" />
          {tr('تسجيل بيانات أيام الأجهزة', 'Record Device-Day Data')}
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          {tr('يسجل يومياً بواسطة ممرضة المسؤولة عن الوحدة حسب منهجية NHSN', 'Recorded daily by charge nurse per NHSN methodology')}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{tr('التاريخ', 'Date')}</Label>
            <Input type="date" value={ddForm.recordDate} onChange={(e) => setDdForm((f) => ({ ...f, recordDate: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{tr('القسم', 'Department')}</Label>
            <Select value={ddForm.department} onValueChange={(v) => setDdForm((f) => ({ ...f, department: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{tr('أيام مرضى', 'Patient-Days')}</Label>
            <Input type="number" min="0" value={ddForm.patientDays} onChange={(e) => setDdForm((f) => ({ ...f, patientDays: e.target.value }))} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{tr('أيام جهاز تنفس', 'Ventilator-Days')}</Label>
            <Input type="number" min="0" value={ddForm.ventilatorDays} onChange={(e) => setDdForm((f) => ({ ...f, ventilatorDays: e.target.value }))} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{tr('أيام قثطرة مركزية', 'Central Line-Days')}</Label>
            <Input type="number" min="0" value={ddForm.centralLineDays} onChange={(e) => setDdForm((f) => ({ ...f, centralLineDays: e.target.value }))} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{tr('أيام قثطرة بولية', 'Catheter-Days')}</Label>
            <Input type="number" min="0" value={ddForm.urinaryCatheterDays} onChange={(e) => setDdForm((f) => ({ ...f, urinaryCatheterDays: e.target.value }))} placeholder="0" />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <Button onClick={saveDeviceDays} disabled={ddBusy} size="sm" className="gap-2">
            <Save className="h-3.5 w-3.5" />
            {ddBusy ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
          </Button>
          {ddMsg && <span className="text-xs text-green-600 font-medium">{ddMsg}</span>}
        </div>
      </div>
    </div>
  );
}
