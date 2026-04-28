'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pill,
  AlertTriangle,
  TrendingDown,
  FlaskConical,
  Activity,
  ShieldCheck,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function AntibioticStewardship() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [days, setDays] = useState('30');

  const { data } = useSWR(
    `/api/infection-control/stewardship?days=${days}`,
    fetcher,
    { refreshInterval: 15000 }
  );

  const metrics = data?.metrics || {
    totalPrescriptions: 0,
    totalDDD: 0,
    dddPer1000PatientDays: 0,
    avgDurationDays: 0,
    cultureGuidedRate: 0,
    deEscalationRate: 0,
    ivToOralConversionRate: 0,
    restrictedDrugCount: 0,
    totalPatientDays: 0,
  };

  const topDrugs: any[] = Array.isArray(data?.topDrugs) ? data.topDrugs : [];
  const byDepartment: any[] = Array.isArray(data?.byDepartment) ? data.byDepartment : [];
  const byCategory: any[] = Array.isArray(data?.byCategory) ? data.byCategory : [];
  const alerts: any[] = Array.isArray(data?.alerts) ? data.alerts : [];
  const alertsByType: Record<string, number> = data?.alertsByType || {};

  const severityColor = (s: string) => {
    switch (s?.toUpperCase()) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'HIGH': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'LOW': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Pill className="h-6 w-6 text-purple-500" />
            {tr('لوحة الرقابة على المضادات الحيوية', 'Antibiotic Stewardship Dashboard')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('مراقبة استخدام المضادات الحيوية ومؤشرات الرقابة', 'Monitor antibiotic usage and stewardship metrics')}
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">{tr('اخر 7 ايام', 'Last 7 Days')}</SelectItem>
            <SelectItem value="30">{tr('اخر 30 يوم', 'Last 30 Days')}</SelectItem>
            <SelectItem value="90">{tr('اخر 90 يوم', 'Last 90 Days')}</SelectItem>
            <SelectItem value="180">{tr('اخر 6 اشهر', 'Last 6 Months')}</SelectItem>
            <SelectItem value="365">{tr('اخر سنة', 'Last Year')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tr('DDD/1000 يوم مريض', 'DDD/1000 Patient-Days')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.dddPer1000PatientDays}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {tr('اجمالي DDD', 'Total DDD')}: {metrics.totalDDD}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tr('معدل الزراعة الموجهة', 'Culture-Guided Rate')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metrics.cultureGuidedRate >= 70 ? 'text-green-600' : metrics.cultureGuidedRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {metrics.cultureGuidedRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <FlaskConical className="h-3 w-3" />
              {tr('بناء على الزراعة', 'Culture-guided')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tr('معدل خفض التصعيد', 'De-escalation Rate')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metrics.deEscalationRate >= 30 ? 'text-green-600' : 'text-yellow-600'}`}>
              {metrics.deEscalationRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              {tr('تم خفض التصعيد', 'De-escalated')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tr('الادوية المقيدة', 'Restricted Drugs')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{metrics.restrictedDrugCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {tr('من اصل', 'of')} {metrics.totalPrescriptions} {tr('وصفة', 'prescriptions')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tr('التنبيهات النشطة', 'Active Alerts')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{alerts.length}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {tr('تنبيهات الرقابة', 'Stewardship alerts')}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top 10 Antibiotics */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-bold text-sm">{tr('اكثر 10 مضادات حيوية استخداما', 'Top 10 Antibiotics')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2 text-start font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('اسم الدواء', 'Drug Name')}</th>
                  <th className="px-4 py-2 text-start font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('وصفات', 'Rx')}</th>
                  <th className="px-4 py-2 text-start font-semibold text-xs uppercase tracking-wider text-muted-foreground">DDD</th>
                </tr>
              </thead>
              <tbody>
                {topDrugs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                      {tr('لا توجد بيانات', 'No data')}
                    </td>
                  </tr>
                ) : (
                  topDrugs.map((drug: any, idx: number) => (
                    <tr key={idx} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2 font-medium">
                        {language === 'ar' && drug.nameAr ? drug.nameAr : drug.name}
                      </td>
                      <td className="px-4 py-2">{drug.count}</td>
                      <td className="px-4 py-2 font-mono">{drug.ddd}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Department Breakdown */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-bold text-sm">{tr('توزيع حسب القسم', 'Department Breakdown')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2 text-start font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('القسم', 'Department')}</th>
                  <th className="px-4 py-2 text-start font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('وصفات', 'Rx')}</th>
                  <th className="px-4 py-2 text-start font-semibold text-xs uppercase tracking-wider text-muted-foreground">DDD</th>
                </tr>
              </thead>
              <tbody>
                {byDepartment.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                      {tr('لا توجد بيانات', 'No data')}
                    </td>
                  </tr>
                ) : (
                  byDepartment.map((dept: any, idx: number) => (
                    <tr key={idx} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2 font-medium">{dept.department}</td>
                      <td className="px-4 py-2">{dept.count}</td>
                      <td className="px-4 py-2 font-mono">{dept.ddd}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Duration Analysis */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-bold text-sm">{tr('تحليل المدة', 'Duration Analysis')}</h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-muted/30 text-center">
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                {tr('متوسط مدة العلاج', 'Average Duration')}
              </div>
              <div className="text-2xl font-bold">{metrics.avgDurationDays}</div>
              <div className="text-xs text-muted-foreground">{tr('ايام', 'days')}</div>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 text-center">
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                {tr('اجمالي الوصفات', 'Total Prescriptions')}
              </div>
              <div className="text-2xl font-bold">{metrics.totalPrescriptions}</div>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 text-center">
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                {tr('تحويل وريدي الى فموي', 'IV to Oral Rate')}
              </div>
              <div className="text-2xl font-bold">{metrics.ivToOralConversionRate}%</div>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 text-center">
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                {tr('ايام المريض', 'Patient-Days')}
              </div>
              <div className="text-2xl font-bold">{metrics.totalPatientDays}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      {byCategory.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-bold text-sm">{tr('توزيع حسب الفئة', 'Category Breakdown')}</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {byCategory.map((cat: any, idx: number) => (
                <div key={idx} className="p-3 rounded-xl border bg-muted/10">
                  <div className="text-xs font-semibold text-muted-foreground uppercase">{cat.category}</div>
                  <div className="text-lg font-bold mt-1">{cat.count} {tr('وصفة', 'Rx')}</div>
                  <div className="text-xs text-muted-foreground">DDD: {cat.ddd}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active Stewardship Alerts */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            {tr('تنبيهات الرقابة النشطة', 'Active Stewardship Alerts')}
          </h2>
        </div>
        <div className="p-5">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {tr('لا توجد تنبيهات نشطة', 'No active alerts')}
            </p>
          ) : (
            <div className="space-y-3">
              {alerts.slice(0, 20).map((alert: any) => (
                <div key={alert.id} className="p-4 rounded-xl border border-border hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`text-xs ${severityColor(alert.severity)}`}>
                          {alert.severity || 'N/A'}
                        </Badge>
                        {alert.type && (
                          <Badge variant="outline" className="text-xs">
                            {alert.type}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm">
                        {language === 'ar' && alert.messageAr ? alert.messageAr : alert.message || tr('تنبيه رقابة', 'Stewardship alert')}
                      </p>
                      {alert.drugName && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {tr('الدواء', 'Drug')}: {alert.drugName}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {alert.createdAt ? new Date(alert.createdAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
