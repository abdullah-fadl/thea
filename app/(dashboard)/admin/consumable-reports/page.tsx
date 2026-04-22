'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { BarChart3, Package, AlertTriangle, Building2 } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function ConsumableReportsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [days, setDays] = useState(30);

  const { data } = useSWR(`/api/consumables/reports?view=summary&days=${days}`, fetcher);

  const report = data || {};
  const topItems = report.topItems || [];
  const byDepartment = report.byDepartment || [];
  const byContext = report.byContext || [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{tr('تقارير المستهلكات', 'Consumable Reports')}</h1>
            <p className="text-sm text-muted-foreground">{tr('تحليل الاستهلاك والهدر', 'Usage and waste analysis')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-xl text-sm ${days === d ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-muted text-muted-foreground'}`}
            >
              {d}{tr('ي', 'd')}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: tr('إجمالي الأحداث', 'Total Events'), value: report.totalEvents || 0, icon: BarChart3, color: 'text-blue-600 bg-blue-50' },
          { label: tr('إجمالي العناصر', 'Total Items'), value: report.totalItems || 0, icon: Package, color: 'text-purple-600 bg-purple-50' },
          { label: tr('الهدر', 'Waste'), value: report.totalWaste || 0, icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
          { label: tr('نسبة الهدر', 'Waste %'), value: `${report.wasteRatio || 0}%`, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
          { label: tr('التكلفة', 'Cost'), value: `${(report.totalCost || 0).toFixed(0)} SAR`, icon: BarChart3, color: 'text-green-600 bg-green-50' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card rounded-2xl border p-4">
            <div className={`w-8 h-8 rounded-xl ${kpi.color} flex items-center justify-center mb-2`}>
              <kpi.icon className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold">{kpi.value}</div>
            <div className="text-xs text-muted-foreground">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Items */}
        <div className="bg-card rounded-2xl border p-6">
          <h2 className="font-bold mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-purple-600" />
            {tr('الأكثر استهلاكاً', 'Top Consumed')}
          </h2>
          <div className="space-y-2">
            {topItems.slice(0, 10).map((item: any, idx: number) => (
              <div key={item.supplyCatalogId} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold">{item.qty}</span>
                  {item.cost > 0 && (
                    <span className="text-xs text-muted-foreground">{item.cost.toFixed(0)} SAR</span>
                  )}
                </div>
              </div>
            ))}
            {topItems.length === 0 && (
              <div className="text-center text-muted-foreground py-4 text-sm">{tr('لا توجد بيانات', 'No data')}</div>
            )}
          </div>
        </div>

        {/* By Department + Context */}
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border p-6">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              {tr('حسب القسم', 'By Department')}
            </h2>
            <div className="space-y-2">
              {byDepartment.map((d: any) => {
                const maxQty = byDepartment[0]?.quantity || 1;
                const pct = Math.round((d.quantity / maxQty) * 100);
                return (
                  <div key={d.department} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{d.department}</span>
                      <span className="font-bold">{d.quantity}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {byDepartment.length === 0 && (
                <div className="text-center text-muted-foreground py-4 text-sm">{tr('لا توجد بيانات', 'No data')}</div>
              )}
            </div>
          </div>

          <div className="bg-card rounded-2xl border p-6">
            <h2 className="font-bold mb-4">{tr('حسب نوع الاستخدام', 'By Usage Type')}</h2>
            <div className="flex flex-wrap gap-2">
              {byContext.map((c: any) => (
                <div key={c.usageContext} className="px-3 py-2 bg-muted rounded-xl text-sm">
                  <span className="font-medium">{c.usageContext}</span>
                  <span className="text-muted-foreground ms-2">{c.quantity}</span>
                </div>
              ))}
              {byContext.length === 0 && (
                <div className="text-muted-foreground text-sm">{tr('لا توجد بيانات', 'No data')}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
