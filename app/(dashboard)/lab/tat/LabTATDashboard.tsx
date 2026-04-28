'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import {
  Timer,
  CheckCircle2,
  FlaskConical,
  AlertTriangle,
  CalendarDays,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type Category = 'All' | 'Chemistry' | 'Hematology' | 'Coagulation' | 'Blood Gas' | 'Microbiology' | 'Urinalysis';

const CATEGORIES: Category[] = ['All', 'Chemistry', 'Hematology', 'Coagulation', 'Blood Gas', 'Microbiology', 'Urinalysis'];

export default function LabTATDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [category, setCategory] = useState<Category>('All');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  const queryParams = new URLSearchParams({
    from: new Date(dateFrom).toISOString(),
    to: new Date(dateTo + 'T23:59:59').toISOString(),
    ...(category !== 'All' ? { category } : {}),
  }).toString();

  const { data } = useSWR(`/api/lab/tat?${queryParams}`, fetcher, {
    refreshInterval: 30000,
  });

  const breakdowns = data?.breakdowns ?? [];
  const summary = data?.summary ?? {
    avgTotalTAT: 0,
    withinTargetPct: 0,
    ordersToday: 0,
    criticalAlerts: 0,
  };

  const categoryLabels: Record<Category, string> = {
    All: tr('الكل', 'All'),
    Chemistry: tr('الكيمياء', 'Chemistry'),
    Hematology: tr('أمراض الدم', 'Hematology'),
    Coagulation: tr('التخثر', 'Coagulation'),
    'Blood Gas': tr('غازات الدم', 'Blood Gas'),
    Microbiology: tr('الأحياء الدقيقة', 'Microbiology'),
    Urinalysis: tr('تحليل البول', 'Urinalysis'),
  };

  const formatMin = (min: number) => {
    if (min < 60) return `${min} ${tr('د', 'min')}`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}${tr('س', 'h')} ${m}${tr('د', 'm')}`;
  };

  const tatColor = (avgTotal: number, target: number) => {
    if (avgTotal <= target) return 'bg-green-100 text-green-700';
    if (avgTotal <= target * 1.5) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const withinTargetBadge = (pct: number) => {
    if (pct >= 90) return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{pct}%</Badge>;
    if (pct >= 70) return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">{pct}%</Badge>;
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{pct}%</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Timer className="w-6 h-6 text-blue-600" />
              {tr('لوحة وقت الاستجابة', 'TAT Dashboard')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {tr('مراقبة أوقات الاستجابة في المختبر', 'Monitor laboratory turnaround times')}
            </p>
          </div>
          {/* Date Range */}
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-36 h-9 text-sm"
            />
            <span className="text-muted-foreground text-sm">{tr('إلى', 'to')}</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-36 h-9 text-sm"
            />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-50">
                  <Timer className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tr('متوسط الوقت الكلي', 'Avg Total TAT')}</p>
                  <p className="text-2xl font-bold text-foreground">{formatMin(summary.avgTotalTAT)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-green-50">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tr('ضمن الهدف', 'Within Target')}</p>
                  <p className="text-2xl font-bold text-foreground">{summary.withinTargetPct}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-50">
                  <FlaskConical className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tr('طلبات اليوم', 'Orders Today')}</p>
                  <p className="text-2xl font-bold text-foreground">{summary.ordersToday}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-50">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tr('تنبيهات حرجة', 'Critical TAT Alerts')}</p>
                  <p className="text-2xl font-bold text-foreground">{summary.criticalAlerts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category Tabs */}
        <Tabs value={category} onValueChange={(v) => setCategory(v as Category)} className="mb-4">
          <TabsList className="flex-wrap">
            {CATEGORIES.map((cat) => (
              <TabsTrigger key={cat} value={cat}>{categoryLabels[cat]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* TAT Breakdown Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground">{tr('اسم الفحص', 'Test Name')}</th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground">{tr('الفئة', 'Category')}</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">{tr('العدد', 'Count')}</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">{tr('طلب→جمع', 'Order→Collect')}</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">{tr('جمع→استلام', 'Collect→Receive')}</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">{tr('استلام→نتيجة', 'Receive→Result')}</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">{tr('نتيجة→تحقق', 'Result→Verify')}</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">{tr('الكلي', 'Total')}</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">{tr('الهدف', 'Target')}</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">{tr('ضمن الهدف', 'Within Target')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {breakdowns.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                      {tr('لا توجد بيانات للفترة المحددة', 'No data for the selected period')}
                    </td>
                  </tr>
                )}
                {breakdowns.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{row.testName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.category}</td>
                    <td className="px-4 py-3 text-center">{row.count}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{formatMin(row.avgOrderToCollect)}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{formatMin(row.avgCollectToReceive)}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{formatMin(row.avgReceiveToResult)}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{formatMin(row.avgResultToVerify)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${tatColor(row.avgTotal, row.targetMinutes)}`}>
                        {formatMin(row.avgTotal)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{formatMin(row.targetMinutes)}</td>
                    <td className="px-4 py-3 text-center">{withinTargetBadge(row.withinTargetPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
