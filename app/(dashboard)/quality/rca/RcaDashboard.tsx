'use client';
import { useLang } from '@/hooks/use-lang';
import useSWR from 'swr';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertOctagon, FileText, Target, CheckCircle, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type RcaStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'CLOSED';
type FmeaStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
type SentinelStatus = 'REPORTED' | 'UNDER_INVESTIGATION' | 'RCA_COMPLETED' | 'CLOSED';

interface RcaAnalysis {
  id: string;
  title: string;
  incidentDate: string;
  analysisDate: string;
  problemStatement: string;
  status: RcaStatus;
  rootCauses: unknown[];
  recommendations: unknown[];
  facilitatorId: string;
}

interface FmeaAnalysis {
  id: string;
  processName: string;
  conductedDate: string;
  status: FmeaStatus;
  steps: { rpn: number }[];
}

interface SentinelEvent {
  id: string;
  eventType: string;
  eventDate: string;
  description: string;
  rcaCompleted: boolean;
  status: SentinelStatus;
}

function statusColor(s: string): string {
  const map: Record<string, string> = {
    DRAFT: 'bg-muted text-foreground',
    IN_REVIEW: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    CLOSED: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    COMPLETED: 'bg-green-100 text-green-800',
    REPORTED: 'bg-red-100 text-red-700',
    UNDER_INVESTIGATION: 'bg-orange-100 text-orange-800',
    RCA_COMPLETED: 'bg-purple-100 text-purple-800',
  };
  return map[s] ?? 'bg-muted text-muted-foreground';
}

export function RcaDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const { data: rcaData, mutate: mutateRca } = useSWR('/api/quality/rca', fetcher);
  const { data: fmeaData, mutate: mutateFmea } = useSWR('/api/quality/fmea', fetcher);
  const { data: sentinelData, mutate: mutateSentinel } = useSWR(
    '/api/quality/sentinel-events',
    fetcher,
  );

  const rcas: RcaAnalysis[] = rcaData?.analyses ?? [];
  const fmeas: FmeaAnalysis[] = fmeaData?.analyses ?? [];
  const sentinels: SentinelEvent[] = sentinelData?.events ?? [];

  // ── New RCA form state ──────────────────────────────────────────────────────
  const [rcaDialogOpen, setRcaDialogOpen] = useState(false);
  const [rcaForm, setRcaForm] = useState({
    title: '',
    problemStatement: '',
    incidentDate: new Date().toISOString().split('T')[0],
  });
  const [rcaSaving, setRcaSaving] = useState(false);

  // ── New FMEA form state ─────────────────────────────────────────────────────
  const [fmeaDialogOpen, setFmeaDialogOpen] = useState(false);
  const [fmeaForm, setFmeaForm] = useState({ processName: '', processScope: '' });
  const [fmeaSaving, setFmeaSaving] = useState(false);

  // ── New Sentinel form state ─────────────────────────────────────────────────
  const [sentinelDialogOpen, setSentinelDialogOpen] = useState(false);
  const [sentinelForm, setSentinelForm] = useState({
    eventType: 'OTHER',
    eventDate: new Date().toISOString().split('T')[0],
    description: '',
    immediateActions: '',
  });
  const [sentinelSaving, setSentinelSaving] = useState(false);

  async function saveRca() {
    if (!rcaForm.title || !rcaForm.problemStatement) {
      toast({ title: tr('يرجى ملء جميع الحقول المطلوبة', 'Please fill all required fields'), variant: 'destructive' });
      return;
    }
    setRcaSaving(true);
    try {
      const res = await fetch('/api/quality/rca', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rcaForm),
      });
      if (!res.ok) throw new Error();
      toast({ title: tr('تم إنشاء تحليل RCA', 'RCA analysis created') });
      setRcaDialogOpen(false);
      setRcaForm({ title: '', problemStatement: '', incidentDate: new Date().toISOString().split('T')[0] });
      mutateRca();
    } catch {
      toast({ title: tr('فشل الحفظ', 'Save failed'), variant: 'destructive' });
    } finally {
      setRcaSaving(false);
    }
  }

  async function saveFmea() {
    if (!fmeaForm.processName) {
      toast({ title: tr('يرجى إدخال اسم العملية', 'Process name is required'), variant: 'destructive' });
      return;
    }
    setFmeaSaving(true);
    try {
      const res = await fetch('/api/quality/fmea', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fmeaForm),
      });
      if (!res.ok) throw new Error();
      toast({ title: tr('تم إنشاء تحليل FMEA', 'FMEA analysis created') });
      setFmeaDialogOpen(false);
      setFmeaForm({ processName: '', processScope: '' });
      mutateFmea();
    } catch {
      toast({ title: tr('فشل الحفظ', 'Save failed'), variant: 'destructive' });
    } finally {
      setFmeaSaving(false);
    }
  }

  async function saveSentinel() {
    if (!sentinelForm.description || !sentinelForm.eventDate) {
      toast({ title: tr('يرجى ملء الحقول المطلوبة', 'Please fill required fields'), variant: 'destructive' });
      return;
    }
    setSentinelSaving(true);
    try {
      const res = await fetch('/api/quality/sentinel-events', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sentinelForm),
      });
      if (!res.ok) throw new Error();
      toast({ title: tr('تم تسجيل الحدث الحارس', 'Sentinel event reported') });
      setSentinelDialogOpen(false);
      setSentinelForm({ eventType: 'OTHER', eventDate: new Date().toISOString().split('T')[0], description: '', immediateActions: '' });
      mutateSentinel();
    } catch {
      toast({ title: tr('فشل الحفظ', 'Save failed'), variant: 'destructive' });
    } finally {
      setSentinelSaving(false);
    }
  }

  function statusLabel(s: string): string {
    const map: Record<string, [string, string]> = {
      DRAFT: ['مسودة', 'Draft'],
      IN_REVIEW: ['قيد المراجعة', 'In Review'],
      APPROVED: ['معتمد', 'Approved'],
      CLOSED: ['مغلق', 'Closed'],
      IN_PROGRESS: ['جارٍ', 'In Progress'],
      COMPLETED: ['مكتمل', 'Completed'],
      REPORTED: ['مُبلَّغ', 'Reported'],
      UNDER_INVESTIGATION: ['تحت التحقيق', 'Under Investigation'],
      RCA_COMPLETED: ['RCA مكتمل', 'RCA Completed'],
    };
    const [ar, en] = map[s] ?? [s, s];
    return tr(ar, en);
  }

  const SENTINEL_TYPES = [
    'WRONG_PATIENT', 'WRONG_SITE', 'WRONG_PROCEDURE', 'WRONG_DRUG',
    'WRONG_DOSE', 'FALL', 'UNEXPECTED_DEATH', 'OTHER',
  ];

  return (
    <div className="p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {tr('تحليل الجذر وإدارة المخاطر', 'Root Cause Analysis & Risk Management')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('RCA · FMEA · الأحداث الحارسة', 'RCA · FMEA · Sentinel Events')}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* New RCA Dialog */}
          <Dialog open={rcaDialogOpen} onOpenChange={setRcaDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                {tr('تحليل RCA', 'New RCA')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{tr('تحليل RCA جديد', 'New RCA Analysis')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>{tr('العنوان *', 'Title *')}</Label>
                  <Input
                    value={rcaForm.title}
                    onChange={(e) => setRcaForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder={tr('عنوان التحليل', 'Analysis title')}
                  />
                </div>
                <div>
                  <Label>{tr('تاريخ الحادثة *', 'Incident Date *')}</Label>
                  <Input
                    type="date"
                    value={rcaForm.incidentDate}
                    onChange={(e) => setRcaForm((p) => ({ ...p, incidentDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{tr('وصف المشكلة *', 'Problem Statement *')}</Label>
                  <Textarea
                    value={rcaForm.problemStatement}
                    onChange={(e) => setRcaForm((p) => ({ ...p, problemStatement: e.target.value }))}
                    placeholder={tr('صف المشكلة بوضوح', 'Describe the problem clearly')}
                    rows={3}
                  />
                </div>
                <Button onClick={saveRca} disabled={rcaSaving} className="w-full">
                  {rcaSaving ? tr('جارٍ الحفظ...', 'Saving...') : tr('إنشاء التحليل', 'Create Analysis')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* New FMEA Dialog */}
          <Dialog open={fmeaDialogOpen} onOpenChange={setFmeaDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                {tr('FMEA', 'New FMEA')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{tr('تحليل FMEA جديد', 'New FMEA Analysis')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>{tr('اسم العملية *', 'Process Name *')}</Label>
                  <Input
                    value={fmeaForm.processName}
                    onChange={(e) => setFmeaForm((p) => ({ ...p, processName: e.target.value }))}
                    placeholder={tr('مثال: إدارة أدوية المرضى', 'e.g. Patient medication management')}
                  />
                </div>
                <div>
                  <Label>{tr('نطاق العملية', 'Process Scope')}</Label>
                  <Textarea
                    value={fmeaForm.processScope}
                    onChange={(e) => setFmeaForm((p) => ({ ...p, processScope: e.target.value }))}
                    placeholder={tr('وصف نطاق العملية', 'Describe process scope')}
                    rows={2}
                  />
                </div>
                <Button onClick={saveFmea} disabled={fmeaSaving} className="w-full">
                  {fmeaSaving ? tr('جارٍ الحفظ...', 'Saving...') : tr('إنشاء التحليل', 'Create Analysis')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* New Sentinel Event Dialog */}
          <Dialog open={sentinelDialogOpen} onOpenChange={setSentinelDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-1">
                <AlertOctagon className="h-4 w-4" />
                {tr('حدث حارس', 'Sentinel Event')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-destructive">
                  {tr('الإبلاغ عن حدث حارس', 'Report Sentinel Event')}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>{tr('نوع الحدث *', 'Event Type *')}</Label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm bg-background"
                    value={sentinelForm.eventType}
                    onChange={(e) => setSentinelForm((p) => ({ ...p, eventType: e.target.value }))}
                  >
                    {SENTINEL_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{tr('تاريخ الحدث *', 'Event Date *')}</Label>
                  <Input
                    type="date"
                    value={sentinelForm.eventDate}
                    onChange={(e) => setSentinelForm((p) => ({ ...p, eventDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{tr('الوصف *', 'Description *')}</Label>
                  <Textarea
                    value={sentinelForm.description}
                    onChange={(e) => setSentinelForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder={tr('صف الحدث بالتفصيل', 'Describe the event in detail')}
                    rows={3}
                  />
                </div>
                <div>
                  <Label>{tr('الإجراءات الفورية', 'Immediate Actions')}</Label>
                  <Textarea
                    value={sentinelForm.immediateActions}
                    onChange={(e) => setSentinelForm((p) => ({ ...p, immediateActions: e.target.value }))}
                    placeholder={tr('الإجراءات المتخذة فورًا', 'Actions taken immediately')}
                    rows={2}
                  />
                </div>
                <Button onClick={saveSentinel} disabled={sentinelSaving} variant="destructive" className="w-full">
                  {sentinelSaving ? tr('جارٍ الحفظ...', 'Saving...') : tr('الإبلاغ', 'Report Event')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {tr('تحليلات RCA', 'RCA Analyses')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{rcas.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {rcas.filter((r) => r.status === 'DRAFT').length} {tr('مسودة', 'draft')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              {tr('تحليلات FMEA', 'FMEA Analyses')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{fmeas.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {fmeas.reduce((acc, f) => acc + (f.steps ?? []).filter((s) => s.rpn >= 100).length, 0)}{' '}
              {tr('خطر مرتفع', 'high risk')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
              <AlertOctagon className="h-4 w-4" />
              {tr('أحداث حارسة', 'Sentinel Events')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{sentinels.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {sentinels.filter((e) => e.status === 'REPORTED' || e.status === 'UNDER_INVESTIGATION').length}{' '}
              {tr('مفتوحة', 'open')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              {tr('معدل الإغلاق', 'Closure Rate')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {rcas.length > 0
                ? Math.round(
                    (rcas.filter((r) => r.status === 'APPROVED' || r.status === 'CLOSED').length /
                      rcas.length) *
                      100,
                  )
                : 0}
              %
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rca">
        <TabsList>
          <TabsTrigger value="rca">RCA ({rcas.length})</TabsTrigger>
          <TabsTrigger value="fmea">FMEA ({fmeas.length})</TabsTrigger>
          <TabsTrigger value="sentinel">
            {tr('أحداث حارسة', 'Sentinel')} ({sentinels.length})
          </TabsTrigger>
        </TabsList>

        {/* RCA Tab */}
        <TabsContent value="rca">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3 text-start font-medium">{tr('العنوان', 'Title')}</th>
                    <th className="p-3 text-start font-medium">{tr('تاريخ الحادثة', 'Incident Date')}</th>
                    <th className="p-3 text-start font-medium hidden md:table-cell">
                      {tr('الأسباب الجذرية', 'Root Causes')}
                    </th>
                    <th className="p-3 text-start font-medium hidden md:table-cell">
                      {tr('التوصيات', 'Recommendations')}
                    </th>
                    <th className="p-3 text-start font-medium">{tr('الحالة', 'Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rcas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        {tr('لا توجد تحليلات RCA بعد', 'No RCA analyses yet')}
                      </td>
                    </tr>
                  ) : (
                    rcas.map((r) => (
                      <tr key={r.id} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium">{r.title}</td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {new Date(r.incidentDate).toLocaleDateString()}
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          {Array.isArray(r.rootCauses) ? r.rootCauses.length : 0}{' '}
                          {tr('سبب', 'causes')}
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          {Array.isArray(r.recommendations) ? r.recommendations.length : 0}{' '}
                          {tr('توصية', 'actions')}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(r.status)}`}
                          >
                            {statusLabel(r.status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FMEA Tab */}
        <TabsContent value="fmea">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3 text-start font-medium">{tr('اسم العملية', 'Process Name')}</th>
                    <th className="p-3 text-start font-medium">{tr('التاريخ', 'Date')}</th>
                    <th className="p-3 text-start font-medium">{tr('الخطوات', 'Steps')}</th>
                    <th className="p-3 text-start font-medium text-red-600">
                      {tr('خطر مرتفع (RPN≥100)', 'High Risk (RPN≥100)')}
                    </th>
                    <th className="p-3 text-start font-medium">{tr('الحالة', 'Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {fmeas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        {tr('لا توجد تحليلات FMEA بعد', 'No FMEA analyses yet')}
                      </td>
                    </tr>
                  ) : (
                    fmeas.map((f) => {
                      const highRisk = (f.steps ?? []).filter((s) => s.rpn >= 100).length;
                      return (
                        <tr key={f.id} className="border-t hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium">{f.processName}</td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {new Date(f.conductedDate).toLocaleDateString()}
                          </td>
                          <td className="p-3">{(f.steps ?? []).length}</td>
                          <td className="p-3">
                            {highRisk > 0 ? (
                              <span className="font-bold text-red-600">{highRisk}</span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(f.status)}`}
                            >
                              {statusLabel(f.status)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sentinel Events Tab */}
        <TabsContent value="sentinel">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3 text-start font-medium">{tr('النوع', 'Type')}</th>
                    <th className="p-3 text-start font-medium">{tr('تاريخ الحدث', 'Event Date')}</th>
                    <th className="p-3 text-start font-medium hidden md:table-cell">
                      {tr('الوصف', 'Description')}
                    </th>
                    <th className="p-3 text-start font-medium">RCA</th>
                    <th className="p-3 text-start font-medium">{tr('الحالة', 'Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sentinels.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        {tr('لا توجد أحداث حارسة مسجلة', 'No sentinel events recorded')}
                      </td>
                    </tr>
                  ) : (
                    sentinels.map((e) => (
                      <tr key={e.id} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <Badge variant="destructive" className="text-xs whitespace-nowrap">
                            {e.eventType.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {new Date(e.eventDate).toLocaleDateString()}
                        </td>
                        <td className="p-3 hidden md:table-cell max-w-xs">
                          <span className="line-clamp-2">{e.description}</span>
                        </td>
                        <td className="p-3 text-center">
                          {e.rcaCompleted ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <AlertOctagon className="h-4 w-4 text-red-500 mx-auto" />
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(e.status)}`}
                          >
                            {statusLabel(e.status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
