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
  ShieldAlert,
  Plus,
  Hand,
  Wind,
  Droplets,
  Shield,
  AlertTriangle,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const ISOLATION_TYPES = ['CONTACT', 'DROPLET', 'AIRBORNE', 'PROTECTIVE', 'ENTERIC', 'COMBINED'] as const;
const REASONS = ['MRSA', 'VRE', 'C_DIFF', 'TB', 'COVID', 'CHICKENPOX', 'MEASLES', 'NEUTROPENIA', 'OTHER'] as const;

export default function IsolationPrecautions() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [showDialog, setShowDialog] = useState(false);
  const [busy, setBusy] = useState(false);

  // Form state
  const [formPatientId, setFormPatientId] = useState('');
  const [formType, setFormType] = useState<string>('CONTACT');
  const [formReason, setFormReason] = useState<string>('MRSA');
  const [formOrganism, setFormOrganism] = useState('');
  const [formRoom, setFormRoom] = useState('');
  const [formBed, setFormBed] = useState('');
  const [formNegPressure, setFormNegPressure] = useState(false);
  const [formNotes, setFormNotes] = useState('');
  // PPE
  const [ppeGown, setPpeGown] = useState(false);
  const [ppeGloves, setPpeGloves] = useState(false);
  const [ppeSurgical, setPpeSurgical] = useState(false);
  const [ppeN95, setPpeN95] = useState(false);
  const [ppePapr, setPpePapr] = useState(false);
  const [ppeEye, setPpeEye] = useState(false);
  const [ppeShoe, setPpeShoe] = useState(false);

  const queryParams = new URLSearchParams();
  if (statusFilter !== 'ALL') queryParams.set('status', statusFilter);
  if (typeFilter !== 'ALL') queryParams.set('isolationType', typeFilter);

  const { data, mutate } = useSWR(
    `/api/infection-control/isolation?${queryParams.toString()}`,
    fetcher,
    { refreshInterval: 15000 }
  );

  const items: any[] = Array.isArray(data?.items) ? data.items : [];
  const summary = data?.summary || { total: 0, active: 0, discontinued: 0, cleared: 0, byType: {} };

  const typeColor = (t: string) => {
    switch (t) {
      case 'CONTACT': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'DROPLET': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'AIRBORNE': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'PROTECTIVE': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'ENTERIC': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'COMBINED': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'ACTIVE': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'DISCONTINUED': return 'bg-muted text-foreground';
      case 'CLEARED': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const typeLabel = (t: string) => {
    const labels: Record<string, [string, string]> = {
      CONTACT: ['تلامس', 'Contact'],
      DROPLET: ['رذاذ', 'Droplet'],
      AIRBORNE: ['محمول جوا', 'Airborne'],
      PROTECTIVE: ['وقائي', 'Protective'],
      ENTERIC: ['معوي', 'Enteric'],
      COMBINED: ['مجمع', 'Combined'],
    };
    const l = labels[t];
    return l ? tr(l[0], l[1]) : t;
  };

  const reasonLabel = (r: string) => {
    const labels: Record<string, [string, string]> = {
      MRSA: ['MRSA', 'MRSA'],
      VRE: ['VRE', 'VRE'],
      C_DIFF: ['كلوستريديوم', 'C. diff'],
      TB: ['سل', 'TB'],
      COVID: ['كوفيد', 'COVID'],
      CHICKENPOX: ['جدري مائي', 'Chickenpox'],
      MEASLES: ['حصبة', 'Measles'],
      NEUTROPENIA: ['قلة العدلات', 'Neutropenia'],
      OTHER: ['اخرى', 'Other'],
    };
    const l = labels[r];
    return l ? tr(l[0], l[1]) : r;
  };

  const daysActive = (startedAt: string) => {
    if (!startedAt) return 0;
    const start = new Date(startedAt);
    const now = new Date();
    return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000));
  };

  const handleCreate = async () => {
    if (!formPatientId.trim()) return;
    setBusy(true);
    try {
      await fetch('/api/infection-control/isolation', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientMasterId: formPatientId.trim(),
          isolationType: formType,
          reason: formReason,
          organism: formOrganism.trim() || null,
          roomNumber: formRoom.trim() || null,
          bedLabel: formBed.trim() || null,
          isNegativePressure: formNegPressure,
          ppeGown, ppeGloves, ppeMaskSurgical: ppeSurgical,
          ppeMaskN95: ppeN95, ppePapr: ppePapr,
          ppeEyeProtection: ppeEye, ppeShoeCovers: ppeShoe,
          notes: formNotes.trim() || null,
        }),
      });
      setShowDialog(false);
      resetForm();
      await mutate();
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setBusy(true);
    try {
      await fetch('/api/infection-control/isolation', {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      await mutate();
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setFormPatientId('');
    setFormType('CONTACT');
    setFormReason('MRSA');
    setFormOrganism('');
    setFormRoom('');
    setFormBed('');
    setFormNegPressure(false);
    setFormNotes('');
    setPpeGown(false);
    setPpeGloves(false);
    setPpeSurgical(false);
    setPpeN95(false);
    setPpePapr(false);
    setPpeEye(false);
    setPpeShoe(false);
  };

  const ppeIcons = (item: any) => {
    const ppeBadges: { key: string; label: string }[] = [];
    if (item.ppeGown) ppeBadges.push({ key: 'gown', label: tr('ثوب', 'Gown') });
    if (item.ppeGloves) ppeBadges.push({ key: 'gloves', label: tr('قفازات', 'Gloves') });
    if (item.ppeMaskSurgical) ppeBadges.push({ key: 'surgical', label: tr('كمامة جراحية', 'Surgical Mask') });
    if (item.ppeMaskN95) ppeBadges.push({ key: 'n95', label: 'N95' });
    if (item.ppePapr) ppeBadges.push({ key: 'papr', label: 'PAPR' });
    if (item.ppeEyeProtection) ppeBadges.push({ key: 'eye', label: tr('حماية العين', 'Eye') });
    if (item.ppeShoeCovers) ppeBadges.push({ key: 'shoe', label: tr('اغطية احذية', 'Shoes') });
    return ppeBadges;
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-red-500" />
            {tr('ادارة احتياطات العزل', 'Isolation Precautions Manager')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('تتبع وادارة عزل المرضى ومتطلبات معدات الحماية الشخصية', 'Track and manage patient isolation and PPE requirements')}
          </p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {tr('عزل جديد', 'New Isolation')}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tr('العزل النشط', 'Active Isolations')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tr('تلامس', 'Contact')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary.byType?.CONTACT || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tr('رذاذ', 'Droplet')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary.byType?.DROPLET || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tr('محمول جوا', 'Airborne')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.byType?.AIRBORNE || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tr('وقائي', 'Protective')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.byType?.PROTECTIVE || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="ALL">{tr('الكل', 'All')}</TabsTrigger>
            <TabsTrigger value="ACTIVE">{tr('نشط', 'Active')}</TabsTrigger>
            <TabsTrigger value="DISCONTINUED">{tr('ملغي', 'Discontinued')}</TabsTrigger>
            <TabsTrigger value="CLEARED">{tr('تم الاخلاء', 'Cleared')}</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={tr('نوع العزل', 'Isolation Type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('جميع الانواع', 'All Types')}</SelectItem>
            {ISOLATION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Data Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-start font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('المريض', 'Patient')}</th>
                <th className="px-4 py-3 text-start font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('الغرفة/السرير', 'Room/Bed')}</th>
                <th className="px-4 py-3 text-start font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('النوع', 'Type')}</th>
                <th className="px-4 py-3 text-start font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('السبب', 'Reason')}</th>
                <th className="px-4 py-3 text-start font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('معدات الحماية', 'PPE')}</th>
                <th className="px-4 py-3 text-start font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('تاريخ البدء', 'Start Date')}</th>
                <th className="px-4 py-3 text-start font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('ايام نشطة', 'Days Active')}</th>
                <th className="px-4 py-3 text-start font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</th>
                <th className="px-4 py-3 text-start font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('اجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    {tr('لا توجد سجلات عزل', 'No isolation records found')}
                  </td>
                </tr>
              ) : (
                items.map((item: any) => (
                  <tr key={item.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{item.patientMasterId?.slice(0, 8) || '---'}</td>
                    <td className="px-4 py-3">
                      {item.roomNumber || '---'}{item.bedLabel ? ` / ${item.bedLabel}` : ''}
                      {item.isNegativePressure && (
                        <Badge variant="outline" className="ml-1 text-[10px]">
                          <Wind className="h-3 w-3 mr-0.5" />
                          {tr('ضغط سلبي', 'Neg. Pressure')}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full text-xs font-bold px-2.5 py-0.5 ${typeColor(item.isolationType)}`}>
                        {typeLabel(item.isolationType)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{item.reason ? reasonLabel(item.reason) : '---'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {ppeIcons(item).map((ppe) => (
                          <Badge key={ppe.key} variant="secondary" className="text-[10px] py-0">
                            {ppe.label}
                          </Badge>
                        ))}
                        {ppeIcons(item).length === 0 && <span className="text-muted-foreground">---</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.startedAt ? new Date(item.startedAt).toLocaleDateString() : '---'}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {item.status === 'ACTIVE' ? daysActive(item.startedAt) : '---'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full text-xs font-bold px-2.5 py-0.5 ${statusColor(item.status)}`}>
                        {item.status === 'ACTIVE' ? tr('نشط', 'Active') : item.status === 'DISCONTINUED' ? tr('ملغي', 'Discontinued') : tr('تم الاخلاء', 'Cleared')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.status === 'ACTIVE' && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            disabled={busy}
                            onClick={() => handleStatusChange(item.id, 'DISCONTINUED')}
                          >
                            {tr('الغاء', 'Discontinue')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            disabled={busy}
                            onClick={() => handleStatusChange(item.id, 'CLEARED')}
                          >
                            {tr('اخلاء', 'Clear')}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Isolation Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr('عزل جديد', 'New Isolation Precaution')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Patient search */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tr('معرف المريض', 'Patient ID')}
              </label>
              <Input
                value={formPatientId}
                onChange={(e) => setFormPatientId(e.target.value)}
                placeholder={tr('ادخل معرف المريض', 'Enter patient ID')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Isolation Type */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tr('نوع العزل', 'Isolation Type')}
                </label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ISOLATION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reason */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tr('السبب', 'Reason')}
                </label>
                <Select value={formReason} onValueChange={setFormReason}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => (
                      <SelectItem key={r} value={r}>{reasonLabel(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Organism */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tr('الكائن الحي', 'Organism')}
              </label>
              <Input
                value={formOrganism}
                onChange={(e) => setFormOrganism(e.target.value)}
                placeholder={tr('اختياري - مثال: MRSA', 'Optional - e.g. MRSA')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Room */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tr('رقم الغرفة', 'Room Number')}
                </label>
                <Input
                  value={formRoom}
                  onChange={(e) => setFormRoom(e.target.value)}
                  placeholder={tr('رقم الغرفة', 'Room number')}
                />
              </div>
              {/* Bed */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tr('السرير', 'Bed')}
                </label>
                <Input
                  value={formBed}
                  onChange={(e) => setFormBed(e.target.value)}
                  placeholder={tr('تسمية السرير', 'Bed label')}
                />
              </div>
            </div>

            {/* Negative Pressure */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="negPressure"
                checked={formNegPressure}
                onChange={(e) => setFormNegPressure(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="negPressure" className="text-sm">
                {tr('غرفة ضغط سلبي', 'Negative Pressure Room')}
              </label>
            </div>

            {/* PPE Checklist */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tr('متطلبات معدات الحماية الشخصية', 'PPE Requirements')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { state: ppeGown, set: setPpeGown, ar: 'ثوب واقي', en: 'Gown' },
                  { state: ppeGloves, set: setPpeGloves, ar: 'قفازات', en: 'Gloves' },
                  { state: ppeSurgical, set: setPpeSurgical, ar: 'كمامة جراحية', en: 'Surgical Mask' },
                  { state: ppeN95, set: setPpeN95, ar: 'كمامة N95', en: 'N95 Respirator' },
                  { state: ppePapr, set: setPpePapr, ar: 'جهاز تنفس PAPR', en: 'PAPR' },
                  { state: ppeEye, set: setPpeEye, ar: 'حماية العين', en: 'Eye Protection' },
                  { state: ppeShoe, set: setPpeShoe, ar: 'اغطية الاحذية', en: 'Shoe Covers' },
                ].map((ppe) => (
                  <div key={ppe.en} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={ppe.state}
                      onChange={(e) => ppe.set(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-sm">{tr(ppe.ar, ppe.en)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
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
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                {tr('الغاء', 'Cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={busy || !formPatientId.trim()}>
                {busy ? tr('جاري الانشاء...', 'Creating...') : tr('انشاء عزل', 'Create Isolation')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
