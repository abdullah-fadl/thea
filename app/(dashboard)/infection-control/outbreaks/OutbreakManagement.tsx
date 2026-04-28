'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import {
  AlertTriangle,
  Plus,
  Users,
  Shield,
  Bell,
  ChevronDown,
  ChevronUp,
  Activity,
  Megaphone,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const INFECTION_TYPES = ['SSI', 'CLABSI', 'CAUTI', 'VAP', 'GI', 'RESPIRATORY', 'SKIN', 'OTHER'] as const;
const STATUSES = ['ACTIVE', 'CONTAINED', 'RESOLVED', 'MONITORING'] as const;

export default function OutbreakManagement() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showDeclareDialog, setShowDeclareDialog] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Declare form
  const [formName, setFormName] = useState('');
  const [formOrganism, setFormOrganism] = useState('');
  const [formType, setFormType] = useState<string>('RESPIRATORY');
  const [formDept, setFormDept] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Add case form
  const [casePatientName, setCasePatientName] = useState('');
  const [caseMrn, setCaseMrn] = useState('');
  const [caseOnsetDate, setCaseOnsetDate] = useState('');
  const [caseCulture, setCaseCulture] = useState('');

  // Control measure form
  const [measureText, setMeasureText] = useState('');
  const [measurePerson, setMeasurePerson] = useState('');

  // Communication form
  const [commMethod, setCommMethod] = useState('Email');
  const [commAudience, setCommAudience] = useState('');
  const [commMessage, setCommMessage] = useState('');

  const queryParams = new URLSearchParams();
  if (statusFilter !== 'ALL') queryParams.set('status', statusFilter);

  const { data, mutate } = useSWR(
    `/api/infection-control/outbreaks?${queryParams.toString()}`,
    fetcher,
    { refreshInterval: 15000 }
  );

  const items: any[] = Array.isArray(data?.items) ? data.items : [];
  const summary = data?.summary || { total: 0, active: 0, contained: 0, resolved: 0, monitoring: 0, totalCases: 0, notified: 0 };

  // Fetch detail for expanded outbreak
  const { data: detailData, mutate: mutateDetail } = useSWR(
    expandedId ? `/api/infection-control/outbreaks/${expandedId}` : null,
    fetcher,
    { refreshInterval: 15000 }
  );
  const detail = detailData?.outbreak || null;

  const statusColor = (s: string) => {
    switch (s) {
      case 'ACTIVE': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'CONTAINED': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'RESOLVED': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'MONITORING': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const statusLabel = (s: string) => {
    const labels: Record<string, [string, string]> = {
      ACTIVE: ['نشط', 'Active'],
      CONTAINED: ['محتوى', 'Contained'],
      RESOLVED: ['تم الحل', 'Resolved'],
      MONITORING: ['تحت المراقبة', 'Monitoring'],
    };
    const l = labels[s];
    return l ? tr(l[0], l[1]) : s;
  };

  const handleDeclare = async () => {
    if (!formName.trim()) return;
    setBusy(true);
    try {
      await fetch('/api/infection-control/outbreaks', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          organism: formOrganism.trim() || null,
          infectionType: formType,
          department: formDept.trim() || null,
          startDate: formStartDate || null,
          notes: formNotes.trim() || null,
        }),
      });
      setShowDeclareDialog(false);
      setFormName('');
      setFormOrganism('');
      setFormDept('');
      setFormStartDate('');
      setFormNotes('');
      await mutate();
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (outbreakId: string, newStatus: string) => {
    setBusy(true);
    try {
      await fetch(`/api/infection-control/outbreaks/${outbreakId}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      await mutate();
      await mutateDetail();
    } finally {
      setBusy(false);
    }
  };

  const handleAddCase = async (outbreakId: string) => {
    if (!casePatientName.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/infection-control/outbreaks/${outbreakId}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newCase: {
            patientName: casePatientName.trim(),
            mrn: caseMrn.trim() || null,
            onsetDate: caseOnsetDate || null,
            cultureResult: caseCulture.trim() || null,
            status: 'ACTIVE',
          },
        }),
      });
      setCasePatientName('');
      setCaseMrn('');
      setCaseOnsetDate('');
      setCaseCulture('');
      await mutate();
      await mutateDetail();
    } finally {
      setBusy(false);
    }
  };

  const handleAddMeasure = async (outbreakId: string) => {
    if (!measureText.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/infection-control/outbreaks/${outbreakId}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newControlMeasure: {
            measure: measureText.trim(),
            responsiblePerson: measurePerson.trim() || null,
          },
        }),
      });
      setMeasureText('');
      setMeasurePerson('');
      await mutateDetail();
    } finally {
      setBusy(false);
    }
  };

  const handleNotifyAuthority = async (outbreakId: string, authority: string) => {
    setBusy(true);
    try {
      await fetch(`/api/infection-control/outbreaks/${outbreakId}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifyAuthority: { to: authority },
        }),
      });
      await mutate();
      await mutateDetail();
    } finally {
      setBusy(false);
    }
  };

  const handleAddCommunication = async (outbreakId: string) => {
    if (!commMessage.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/infection-control/outbreaks/${outbreakId}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newCommunication: {
            method: commMethod,
            audience: commAudience.trim() || null,
            message: commMessage.trim(),
          },
        }),
      });
      setCommMessage('');
      setCommAudience('');
      await mutateDetail();
    } finally {
      setBusy(false);
    }
  };

  const cases = Array.isArray(detail?.cases) ? detail.cases : [];
  const controlMeasures = Array.isArray(detail?.controlMeasures) ? detail.controlMeasures : [];
  const communications = Array.isArray(detail?.staffCommunication) ? detail.staffCommunication : [];
  const envActions = Array.isArray(detail?.environmentalActions) ? detail.environmentalActions : [];

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            {tr('ادارة التفشيات', 'Outbreak Management')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('اعلان وتتبع وادارة تفشيات العدوى', 'Declare, track, and manage infection outbreaks')}
          </p>
        </div>
        <Button onClick={() => setShowDeclareDialog(true)} className="gap-2" variant="destructive">
          <Plus className="h-4 w-4" />
          {tr('اعلان تفشي', 'Declare Outbreak')}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tr('التفشيات النشطة', 'Active Outbreaks')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tr('اجمالي الحالات', 'Total Cases')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalCases}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tr('تم الاحتواء', 'Contained')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary.contained}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tr('تم ابلاغ الجهات', 'Authorities Notified')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary.notified}</div>
          </CardContent>
        </Card>
      </div>

      {/* Status Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="ALL">{tr('الكل', 'All')} ({summary.total})</TabsTrigger>
          <TabsTrigger value="ACTIVE">{tr('نشط', 'Active')} ({summary.active})</TabsTrigger>
          <TabsTrigger value="CONTAINED">{tr('محتوى', 'Contained')} ({summary.contained})</TabsTrigger>
          <TabsTrigger value="RESOLVED">{tr('تم الحل', 'Resolved')} ({summary.resolved})</TabsTrigger>
          <TabsTrigger value="MONITORING">{tr('مراقبة', 'Monitoring')} ({summary.monitoring})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Outbreak Cards */}
      <div className="space-y-4">
        {items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-2xl">
            {tr('لا توجد تفشيات مسجلة', 'No outbreaks recorded')}
          </div>
        ) : (
          items.map((ob: any) => {
            const isExpanded = expandedId === ob.id;
            return (
              <div key={ob.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                {/* Outbreak Summary Row */}
                <div
                  className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : ob.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-base">{ob.name}</h3>
                      <Badge className={`text-xs ${statusColor(ob.status)}`}>
                        {statusLabel(ob.status)}
                      </Badge>
                      {ob.infectionType && (
                        <Badge variant="outline" className="text-xs">{ob.infectionType}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {ob.organism && <span>{tr('الكائن', 'Organism')}: {ob.organism}</span>}
                      {ob.department && <span>{tr('القسم', 'Dept')}: {ob.department}</span>}
                      <span>{tr('الحالات', 'Cases')}: {ob.activeCases || 0}/{ob.totalCases || 0}</span>
                      <span>{tr('تاريخ البدء', 'Start')}: {ob.startDate ? new Date(ob.startDate).toLocaleDateString() : '---'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ob.notifiedAuthorities && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Bell className="h-3 w-3" />
                        {tr('تم الابلاغ', 'Notified')}
                      </Badge>
                    )}
                    {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && detail && detail.id === ob.id && (
                  <div className="border-t border-border p-5 space-y-6">
                    {/* Status Controls */}
                    <div className="flex flex-wrap gap-2">
                      {STATUSES.map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant={detail.status === s ? 'default' : 'outline'}
                          disabled={busy || detail.status === s}
                          onClick={() => handleStatusChange(ob.id, s)}
                        >
                          {statusLabel(s)}
                        </Button>
                      ))}
                    </div>

                    {/* Cases Table */}
                    <div className="space-y-3">
                      <h4 className="font-bold text-sm flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {tr('قائمة الحالات', 'Case List')} ({cases.length})
                      </h4>
                      {cases.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border bg-muted/30">
                                <th className="px-3 py-2 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr('المريض', 'Patient')}</th>
                                <th className="px-3 py-2 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr('رقم الملف', 'MRN')}</th>
                                <th className="px-3 py-2 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr('تاريخ الظهور', 'Onset Date')}</th>
                                <th className="px-3 py-2 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr('نتيجة الزراعة', 'Culture Result')}</th>
                                <th className="px-3 py-2 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cases.map((c: any, idx: number) => (
                                <tr key={idx} className="border-b border-border">
                                  <td className="px-3 py-2">{c.patientName || '---'}</td>
                                  <td className="px-3 py-2 font-mono text-xs">{c.mrn || '---'}</td>
                                  <td className="px-3 py-2">{c.onsetDate || '---'}</td>
                                  <td className="px-3 py-2">{c.cultureResult || '---'}</td>
                                  <td className="px-3 py-2">
                                    <Badge variant={c.status === 'ACTIVE' ? 'destructive' : 'secondary'} className="text-xs">
                                      {c.status === 'ACTIVE' ? tr('نشط', 'Active') : c.status === 'RECOVERED' ? tr('متعافي', 'Recovered') : c.status}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {/* Add Case */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
                        <Input
                          value={casePatientName}
                          onChange={(e) => setCasePatientName(e.target.value)}
                          placeholder={tr('اسم المريض', 'Patient name')}
                          className="text-sm"
                        />
                        <Input
                          value={caseMrn}
                          onChange={(e) => setCaseMrn(e.target.value)}
                          placeholder={tr('رقم الملف', 'MRN')}
                          className="text-sm"
                        />
                        <Input
                          type="date"
                          value={caseOnsetDate}
                          onChange={(e) => setCaseOnsetDate(e.target.value)}
                          className="text-sm"
                        />
                        <Input
                          value={caseCulture}
                          onChange={(e) => setCaseCulture(e.target.value)}
                          placeholder={tr('نتيجة الزراعة', 'Culture result')}
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAddCase(ob.id)}
                          disabled={busy || !casePatientName.trim()}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {tr('اضافة حالة', 'Add Case')}
                        </Button>
                      </div>
                    </div>

                    {/* Control Measures */}
                    <div className="space-y-3">
                      <h4 className="font-bold text-sm flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        {tr('اجراءات السيطرة', 'Control Measures')} ({controlMeasures.length})
                      </h4>
                      {controlMeasures.length > 0 && (
                        <div className="space-y-2">
                          {controlMeasures.map((m: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 text-sm">
                              <input type="checkbox" checked={m.status === 'COMPLETED'} readOnly className="rounded" />
                              <div className="flex-1">
                                <span className="font-medium">{m.measure}</span>
                                {m.responsiblePerson && (
                                  <span className="text-muted-foreground ml-2">({m.responsiblePerson})</span>
                                )}
                              </div>
                              <Badge variant="outline" className="text-xs">{m.status || 'IN_PROGRESS'}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {m.implementedAt ? new Date(m.implementedAt).toLocaleDateString() : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                        <Input
                          value={measureText}
                          onChange={(e) => setMeasureText(e.target.value)}
                          placeholder={tr('اجراء السيطرة', 'Control measure')}
                          className="text-sm"
                        />
                        <Input
                          value={measurePerson}
                          onChange={(e) => setMeasurePerson(e.target.value)}
                          placeholder={tr('الشخص المسؤول', 'Responsible person')}
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAddMeasure(ob.id)}
                          disabled={busy || !measureText.trim()}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {tr('اضافة اجراء', 'Add Measure')}
                        </Button>
                      </div>
                    </div>

                    {/* Authority Notification */}
                    <div className="space-y-3">
                      <h4 className="font-bold text-sm flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        {tr('ابلاغ الجهات المختصة', 'Authority Notification')}
                      </h4>
                      {detail.notifiedAuthorities ? (
                        <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-sm">
                          <span className="text-green-700 dark:text-green-300 font-medium">
                            {tr('تم الابلاغ', 'Notified')}: {detail.notifiedTo || 'MOH'}
                          </span>
                          {detail.notifiedDate && (
                            <span className="text-muted-foreground ml-2">
                              ({new Date(detail.notifiedDate).toLocaleDateString()})
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {['MOH', 'CDC', 'LOCAL_HEALTH_DEPT'].map((authority) => (
                            <Button
                              key={authority}
                              size="sm"
                              variant="outline"
                              onClick={() => handleNotifyAuthority(ob.id, authority)}
                              disabled={busy}
                              className="gap-1"
                            >
                              <Megaphone className="h-3 w-3" />
                              {tr('ابلاغ', 'Notify')} {authority === 'MOH' ? tr('وزارة الصحة', 'MOH') : authority === 'CDC' ? 'CDC' : tr('الصحة المحلية', 'Local Health Dept')}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Communication Log */}
                    <div className="space-y-3">
                      <h4 className="font-bold text-sm flex items-center gap-2">
                        <Megaphone className="h-4 w-4" />
                        {tr('سجل التواصل', 'Communication Log')} ({communications.length})
                      </h4>
                      {communications.length > 0 && (
                        <div className="space-y-2">
                          {communications.map((c: any, idx: number) => (
                            <div key={idx} className="p-3 rounded-xl bg-muted/30 text-sm">
                              <div className="flex justify-between">
                                <span className="font-medium">{c.method} - {c.audience}</span>
                                <span className="text-xs text-muted-foreground">
                                  {c.date ? new Date(c.date).toLocaleDateString() : ''}
                                </span>
                              </div>
                              <p className="text-muted-foreground mt-1">{c.message}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                        <Select value={commMethod} onValueChange={setCommMethod}>
                          <SelectTrigger className="text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Email">{tr('بريد الكتروني', 'Email')}</SelectItem>
                            <SelectItem value="Meeting">{tr('اجتماع', 'Meeting')}</SelectItem>
                            <SelectItem value="Announcement">{tr('اعلان', 'Announcement')}</SelectItem>
                            <SelectItem value="Phone">{tr('هاتف', 'Phone')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={commAudience}
                          onChange={(e) => setCommAudience(e.target.value)}
                          placeholder={tr('الجمهور', 'Audience')}
                          className="text-sm"
                        />
                        <Input
                          value={commMessage}
                          onChange={(e) => setCommMessage(e.target.value)}
                          placeholder={tr('الرسالة', 'Message')}
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAddCommunication(ob.id)}
                          disabled={busy || !commMessage.trim()}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {tr('اضافة', 'Add')}
                        </Button>
                      </div>
                    </div>

                    {/* Environmental Actions */}
                    {envActions.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-bold text-sm flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          {tr('الاجراءات البيئية', 'Environmental Actions')} ({envActions.length})
                        </h4>
                        <div className="space-y-2">
                          {envActions.map((ea: any, idx: number) => (
                            <div key={idx} className="p-3 rounded-xl bg-muted/30 text-sm">
                              <div className="flex justify-between">
                                <span className="font-medium">{ea.action}</span>
                                <span className="text-xs text-muted-foreground">
                                  {ea.date ? new Date(ea.date).toLocaleDateString() : ''}
                                </span>
                              </div>
                              {ea.area && <p className="text-muted-foreground">{tr('المنطقة', 'Area')}: {ea.area}</p>}
                              {ea.result && <p className="text-muted-foreground">{tr('النتيجة', 'Result')}: {ea.result}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Declare Outbreak Dialog */}
      <Dialog open={showDeclareDialog} onOpenChange={setShowDeclareDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tr('اعلان تفشي جديد', 'Declare New Outbreak')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tr('اسم التفشي', 'Outbreak Name')}
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={tr('مثال: تفشي MRSA - العناية المركزة', 'e.g. MRSA Outbreak - ICU')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tr('الكائن الحي', 'Organism')}
                </label>
                <Input
                  value={formOrganism}
                  onChange={(e) => setFormOrganism(e.target.value)}
                  placeholder={tr('مثال: MRSA', 'e.g. MRSA')}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tr('نوع العدوى', 'Infection Type')}
                </label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INFECTION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tr('تاريخ البدء', 'Start Date')}
                </label>
                <Input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tr('ملاحظات', 'Notes')}
              </label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder={tr('ملاحظات اضافية', 'Additional notes')}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDeclareDialog(false)}>
                {tr('الغاء', 'Cancel')}
              </Button>
              <Button variant="destructive" onClick={handleDeclare} disabled={busy || !formName.trim()}>
                {busy ? tr('جاري الاعلان...', 'Declaring...') : tr('اعلان التفشي', 'Declare Outbreak')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
