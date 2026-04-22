'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  HandMetal,
  Plus,
  TrendingUp,
  TrendingDown,
  Users,
  ClipboardCheck,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const MOMENTS = ['BEFORE_PATIENT', 'BEFORE_ASEPTIC', 'AFTER_BODY_FLUID', 'AFTER_PATIENT', 'AFTER_SURROUNDINGS'] as const;
const STAFF_CATEGORIES = ['PHYSICIAN', 'NURSE', 'ALLIED_HEALTH', 'SUPPORT', 'STUDENT'] as const;
const METHODS = ['HANDWASH', 'HAND_RUB', 'GLOVES', 'NONE'] as const;

export default function HandHygieneCompliance() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [momentFilter, setMomentFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [busy, setBusy] = useState(false);

  // Form state
  const [formDept, setFormDept] = useState('');
  const [formCategory, setFormCategory] = useState<string>('NURSE');
  const [formMoment, setFormMoment] = useState<string>('BEFORE_PATIENT');
  const [formCompliant, setFormCompliant] = useState(true);
  const [formMethod, setFormMethod] = useState<string>('HANDWASH');
  const [formNotes, setFormNotes] = useState('');

  const queryParams = new URLSearchParams();
  if (deptFilter) queryParams.set('department', deptFilter);
  if (startDate) queryParams.set('startDate', startDate);
  if (endDate) queryParams.set('endDate', endDate);

  const { data, mutate } = useSWR(
    `/api/infection-control/hand-hygiene?${queryParams.toString()}`,
    fetcher,
    { refreshInterval: 15000 }
  );

  const overall = data?.overall || { opportunities: 0, compliant: 0, rate: 0 };
  const byDepartment: any[] = Array.isArray(data?.byDepartment) ? data.byDepartment : [];
  const byStaffCategory: any[] = Array.isArray(data?.byStaffCategory) ? data.byStaffCategory : [];
  const byMoment: any[] = Array.isArray(data?.byMoment) ? data.byMoment : [];
  const recentAudits: any[] = Array.isArray(data?.recentAudits) ? data.recentAudits : [];

  const filteredMomentData = momentFilter === 'ALL'
    ? byMoment
    : byMoment.filter((m: any) => m.moment === momentFilter);

  const momentLabel = (m: string) => {
    const labels: Record<string, [string, string]> = {
      BEFORE_PATIENT: ['قبل ملامسة المريض', 'Before Patient Contact'],
      BEFORE_ASEPTIC: ['قبل الاجراء المعقم', 'Before Aseptic Task'],
      AFTER_BODY_FLUID: ['بعد التعرض لسوائل الجسم', 'After Body Fluid'],
      AFTER_PATIENT: ['بعد ملامسة المريض', 'After Patient Contact'],
      AFTER_SURROUNDINGS: ['بعد ملامسة محيط المريض', 'After Surroundings'],
    };
    const l = labels[m];
    return l ? tr(l[0], l[1]) : m;
  };

  const categoryLabel = (c: string) => {
    const labels: Record<string, [string, string]> = {
      PHYSICIAN: ['طبيب', 'Physician'],
      NURSE: ['ممرض', 'Nurse'],
      ALLIED_HEALTH: ['صحة مساندة', 'Allied Health'],
      SUPPORT: ['دعم', 'Support'],
      STUDENT: ['طالب', 'Student'],
    };
    const l = labels[c];
    return l ? tr(l[0], l[1]) : c;
  };

  const methodLabel = (m: string) => {
    const labels: Record<string, [string, string]> = {
      HANDWASH: ['غسل اليدين', 'Handwash'],
      HAND_RUB: ['فرك اليدين', 'Hand Rub'],
      GLOVES: ['قفازات', 'Gloves'],
      NONE: ['لا شيء', 'None'],
    };
    const l = labels[m];
    return l ? tr(l[0], l[1]) : m;
  };

  const complianceColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-500';
    if (rate >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const complianceBg = (rate: number) => {
    if (rate >= 80) return 'bg-green-100 dark:bg-green-900/20';
    if (rate >= 60) return 'bg-yellow-100 dark:bg-yellow-900/20';
    return 'bg-red-100 dark:bg-red-900/20';
  };

  const handleCreate = async () => {
    if (!formDept.trim()) return;
    setBusy(true);
    try {
      await fetch('/api/infection-control/hand-hygiene', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department: formDept.trim(),
          staffCategory: formCategory,
          moment: formMoment,
          compliant: formCompliant,
          method: formMethod,
          notes: formNotes.trim() || null,
        }),
      });
      setShowDialog(false);
      setFormDept('');
      setFormNotes('');
      await mutate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HandMetal className="h-6 w-6 text-blue-500" />
            {tr('الامتثال لنظافة اليدين', 'Hand Hygiene Compliance')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('مراقبة الامتثال لنظافة اليدين وفق لحظات منظمة الصحة العالمية الخمسة', 'Monitor hand hygiene compliance based on WHO 5 Moments')}
          </p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {tr('ملاحظة جديدة', 'New Observation')}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tr('اجمالي الملاحظات', 'Total Observations')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overall.opportunities}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tr('معدل الامتثال', 'Compliance Rate')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overall.rate >= 80 ? 'text-green-600' : overall.rate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
              {overall.rate}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tr('ملتزم', 'Compliant')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{overall.compliant}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tr('غير ملتزم', 'Non-Compliant')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overall.opportunities - overall.compliant}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <Tabs value={momentFilter} onValueChange={setMomentFilter}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="ALL">{tr('الكل', 'All')}</TabsTrigger>
            {MOMENTS.map((m) => (
              <TabsTrigger key={m} value={m} className="text-xs">{momentLabel(m)}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">{tr('القسم', 'Department')}</label>
          <Input
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            placeholder={tr('بحث القسم', 'Filter department')}
            className="w-[160px]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">{tr('من', 'From')}</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-[150px]" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">{tr('الى', 'To')}</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-[150px]" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Department Compliance Bars */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-bold text-sm">{tr('الامتثال حسب القسم', 'Compliance by Department')}</h2>
          </div>
          <div className="p-5 space-y-3">
            {byDepartment.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{tr('لا توجد بيانات', 'No data')}</p>
            ) : (
              byDepartment.map((dept: any) => (
                <div key={dept.department} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{dept.department}</span>
                    <span className={`font-bold ${dept.rate >= 80 ? 'text-green-600' : dept.rate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {dept.rate}% ({dept.compliant}/{dept.opportunities})
                    </span>
                  </div>
                  <div className={`w-full h-3 rounded-full ${complianceBg(dept.rate)}`}>
                    <div
                      className={`h-3 rounded-full transition-all ${complianceColor(dept.rate)}`}
                      style={{ width: `${Math.min(100, dept.rate)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Staff Category Breakdown */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-bold text-sm">{tr('الامتثال حسب فئة الكادر', 'Compliance by Staff Category')}</h2>
          </div>
          <div className="p-5 space-y-3">
            {byStaffCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{tr('لا توجد بيانات', 'No data')}</p>
            ) : (
              byStaffCategory.map((cat: any) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{categoryLabel(cat.category)}</span>
                    <span className={`font-bold ${cat.rate >= 80 ? 'text-green-600' : cat.rate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {cat.rate}% ({cat.compliant}/{cat.opportunities})
                    </span>
                  </div>
                  <div className={`w-full h-3 rounded-full ${complianceBg(cat.rate)}`}>
                    <div
                      className={`h-3 rounded-full transition-all ${complianceColor(cat.rate)}`}
                      style={{ width: `${Math.min(100, cat.rate)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* WHO 5 Moments Summary */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-bold text-sm">{tr('لحظات منظمة الصحة العالمية الخمسة', 'WHO 5 Moments Summary')}</h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {byMoment.map((m: any) => (
              <div key={m.moment} className={`p-4 rounded-xl border text-center ${complianceBg(m.rate)}`}>
                <div className="text-xs font-semibold text-muted-foreground mb-1">{momentLabel(m.moment)}</div>
                <div className={`text-2xl font-bold ${m.rate >= 80 ? 'text-green-600' : m.rate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {m.rate}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {m.compliant}/{m.opportunities} {tr('ملاحظة', 'obs')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Audits Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-bold text-sm">{tr('الملاحظات الاخيرة', 'Recent Observations')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-start font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('التاريخ', 'Date')}</th>
                <th className="px-4 py-3 text-start font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('القسم', 'Department')}</th>
                <th className="px-4 py-3 text-start font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('فئة الكادر', 'Staff Category')}</th>
                <th className="px-4 py-3 text-start font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('اللحظة', 'Moment')}</th>
                <th className="px-4 py-3 text-start font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('ملتزم', 'Compliant')}</th>
                <th className="px-4 py-3 text-start font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('الطريقة', 'Method')}</th>
              </tr>
            </thead>
            <tbody>
              {recentAudits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {tr('لا توجد ملاحظات', 'No observations recorded')}
                  </td>
                </tr>
              ) : (
                recentAudits.map((audit: any) => (
                  <tr key={audit.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">
                      {audit.auditDate ? new Date(audit.auditDate).toLocaleDateString() : '---'}
                    </td>
                    <td className="px-4 py-3">{audit.department || '---'}</td>
                    <td className="px-4 py-3">{categoryLabel(audit.staffCategory)}</td>
                    <td className="px-4 py-3 text-xs">{momentLabel(audit.moment)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={audit.compliant ? 'default' : 'destructive'} className="text-xs">
                        {audit.compliant ? tr('نعم', 'Yes') : tr('لا', 'No')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{audit.method ? methodLabel(audit.method) : '---'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Observation Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tr('ملاحظة جديدة', 'New Observation')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tr('القسم', 'Department')}
              </label>
              <Input
                value={formDept}
                onChange={(e) => setFormDept(e.target.value)}
                placeholder={tr('اسم القسم', 'Department name')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tr('فئة الكادر', 'Staff Category')}
                </label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tr('لحظة منظمة الصحة العالمية', 'WHO Moment')}
                </label>
                <Select value={formMoment} onValueChange={setFormMoment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOMENTS.map((m) => (
                      <SelectItem key={m} value={m}>{momentLabel(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tr('ملتزم', 'Compliant')}
                </label>
                <Select value={formCompliant ? 'yes' : 'no'} onValueChange={(v) => setFormCompliant(v === 'yes')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">{tr('نعم', 'Yes')}</SelectItem>
                    <SelectItem value="no">{tr('لا', 'No')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tr('الطريقة', 'Method')}
                </label>
                <Select value={formMethod} onValueChange={setFormMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{methodLabel(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tr('ملاحظات', 'Notes')}
              </label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder={tr('ملاحظات اختيارية', 'Optional notes')}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                {tr('الغاء', 'Cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={busy || !formDept.trim()}>
                {busy ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ الملاحظة', 'Save Observation')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
