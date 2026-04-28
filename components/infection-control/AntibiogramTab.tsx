'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

function getCellColor(pct: number): string {
  if (pct >= 90) return 'bg-green-100 text-green-800';
  if (pct >= 70) return 'bg-yellow-100 text-yellow-800';
  if (pct >= 50) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}

interface Props {
  tr: (ar: string, en: string) => string;
  language: string;
}

export default function AntibiogramTab({ tr, language }: Props) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data, isLoading } = useSWR(
    `/api/infection-control/antibiogram?year=${year}`,
    fetcher, { refreshInterval: 300000 }
  );

  const organisms: string[] = data?.organisms || [];
  const antibiotics: string[] = data?.antibiotics || [];
  const matrix = data?.matrix || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">{tr('مخطط مقاومة المضادات الحيوية', 'Antibiogram')}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {tr('نسبة الحساسية (%S) — الكائنات ≥30 عزلة حسب إرشادات CLSI M39', 'Susceptibility rate (%S) — Organisms ≥30 isolates per CLSI M39 guidelines')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
            <Printer className="h-3.5 w-3.5" />
            {tr('طباعة', 'Print')}
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-green-100 border border-green-300" /> ≥90% {tr('حساس', 'Susceptible')}</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-yellow-100 border border-yellow-300" /> 70-89%</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-orange-100 border border-orange-300" /> 50-69%</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-red-100 border border-red-300" /> &lt;50% {tr('مقاوم', 'Resistant')}</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-muted border border-border" /> {tr('بيانات غير كافية', 'Insufficient data')}</span>
      </div>

      {/* Antibiogram Table */}
      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground text-sm animate-pulse">{tr('جاري التحميل...', 'Loading...')}</div>
      ) : organisms.length === 0 ? (
        <div className="p-12 text-center bg-card border rounded-2xl">
          <p className="text-sm text-muted-foreground">{tr('لا توجد بيانات حساسية كافية لهذا العام', 'No sufficient sensitivity data for this year')}</p>
          <p className="text-xs text-muted-foreground mt-1">{tr('تحتاج ≥30 عزلة لكل كائن لإظهار البيانات', 'Need ≥30 isolates per organism to display data')}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b-2 border-border">
                  <th className="text-start px-3 py-2.5 font-bold sticky left-0 bg-muted/50 z-10 min-w-[180px]">
                    {tr('الكائن الدقيق', 'Organism')}
                  </th>
                  <th className="text-center px-2 py-2.5 font-bold min-w-[40px]">n</th>
                  {antibiotics.map((ab: any) => (
                    <th key={ab.code} className="text-center px-1.5 py-2.5 font-bold min-w-[50px]" title={language === 'ar' ? ab.nameAr : ab.name}>
                      <div className="writing-mode-vertical whitespace-nowrap text-[10px] transform -rotate-45 origin-center h-16 flex items-end justify-center">
                        {ab.code}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {organisms.map((org: any) => (
                  <tr key={org.name} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium italic sticky left-0 bg-card z-10">
                      <span className="text-xs">{language === 'ar' ? org.nameAr : org.name}</span>
                    </td>
                    <td className="text-center px-2 py-2 font-mono text-muted-foreground">{org.totalIsolates}</td>
                    {antibiotics.map((ab: any) => {
                      const cell = matrix[org.name]?.[ab.code];
                      if (!cell || cell.total === 0) {
                        return <td key={ab.code} className="text-center px-1.5 py-2 bg-muted/50 text-muted-foreground">—</td>;
                      }
                      return (
                        <td
                          key={ab.code}
                          className={`text-center px-1.5 py-2 font-bold ${getCellColor(cell.percentage)}`}
                          title={`${cell.susceptible}S / ${cell.intermediate}I / ${cell.resistant}R (n=${cell.total})`}
                        >
                          {cell.percentage}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
