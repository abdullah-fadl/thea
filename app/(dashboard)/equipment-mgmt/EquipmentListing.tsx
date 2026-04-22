'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Search,
  AlertTriangle,
  Shield,
  Clock,
  CheckCircle2,
  Wrench,
  Bug,
} from 'lucide-react';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

const STATUS_CONFIG: Record<string, { ar: string; en: string; color: string }> = {
  OPERATIONAL: { ar: 'يعمل', en: 'Operational', color: 'bg-green-100 text-green-700' },
  UNDER_MAINTENANCE: { ar: 'تحت الصيانة', en: 'Under Maintenance', color: 'bg-amber-100 text-amber-700' },
  OUT_OF_SERVICE: { ar: 'خارج الخدمة', en: 'Out of Service', color: 'bg-red-100 text-red-700' },
  CALIBRATION_DUE: { ar: 'معايرة مطلوبة', en: 'Calibration Due', color: 'bg-orange-100 text-orange-700' },
};

const CATEGORIES = [
  { value: 'ALL', ar: 'الكل', en: 'All' },
  { value: 'VENTILATOR', ar: 'تنفس اصطناعي', en: 'Ventilator' },
  { value: 'MONITOR', ar: 'مراقبة', en: 'Monitor' },
  { value: 'PUMP', ar: 'مضخة', en: 'Pump' },
  { value: 'IMAGING', ar: 'تصوير', en: 'Imaging' },
  { value: 'LAB', ar: 'مختبر', en: 'Lab' },
  { value: 'SURGICAL', ar: 'جراحية', en: 'Surgical' },
  { value: 'DEFIBRILLATOR', ar: 'مزيل رجفان', en: 'Defibrillator' },
  { value: 'OTHER', ar: 'أخرى', en: 'Other' },
];

const MAINTENANCE_TYPES = [
  { value: 'PREVENTIVE', ar: 'وقائية', en: 'Preventive' },
  { value: 'CORRECTIVE', ar: 'تصحيحية', en: 'Corrective' },
  { value: 'CALIBRATION', ar: 'معايرة', en: 'Calibration' },
  { value: 'INSPECTION', ar: 'فحص', en: 'Inspection' },
];

const SEVERITY_CONFIG: Record<string, { ar: string; en: string; color: string }> = {
  LOW: { ar: 'منخفض', en: 'Low', color: 'bg-green-100 text-green-700' },
  MEDIUM: { ar: 'متوسط', en: 'Medium', color: 'bg-amber-100 text-amber-700' },
  HIGH: { ar: 'مرتفع', en: 'High', color: 'bg-orange-100 text-orange-700' },
  CRITICAL: { ar: 'حرج', en: 'Critical', color: 'bg-red-100 text-red-700' },
};

export default function EquipmentListing() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const queryParams = new URLSearchParams();
  if (categoryFilter !== 'ALL') queryParams.set('category', categoryFilter);
  if (statusFilter) queryParams.set('status', statusFilter);
  if (searchTerm.trim()) queryParams.set('q', searchTerm.trim());
  const queryStr = queryParams.toString();

  const { data, mutate, isLoading } = useSWR(
    `/api/equipment-mgmt${queryStr ? `?${queryStr}` : ''}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const equipment: any[] = Array.isArray(data?.equipment) ? data.equipment : [];

  const kpis = {
    total: equipment.length,
    operational: equipment.filter((e) => e.status === 'OPERATIONAL').length,
    underMaintenance: equipment.filter((e) => e.status === 'UNDER_MAINTENANCE').length,
    outOfService: equipment.filter((e) => e.status === 'OUT_OF_SERVICE').length,
    calibrationDue: equipment.filter((e) => e.status === 'CALIBRATION_DUE').length,
  };

  // Modals
  const [showNew, setShowNew] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'maintenance' | 'issues'>('info');
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [busy, setBusy] = useState(false);

  const [newForm, setNewForm] = useState({
    assetTag: '', name: '', category: 'OTHER', manufacturer: '',
    model: '', serialNumber: '', purchaseDate: '', warrantyExpiry: '',
    location: '', notes: '',
  });

  const [maintForm, setMaintForm] = useState({
    maintenanceType: 'PREVENTIVE', findings: '', partsReplaced: '',
    cost: '', nextDueDate: '', notes: '',
  });

  const [issueForm, setIssueForm] = useState({
    severity: 'MEDIUM', description: '',
  });

  const [newStatus, setNewStatus] = useState('');

  const { data: detailData, mutate: mutateDetail } = useSWR(
    selectedEquipment ? `/api/equipment-mgmt/${selectedEquipment.id}` : null,
    fetcher
  );

  const createEquipment = async () => {
    if (!newForm.assetTag.trim() || !newForm.name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/equipment-mgmt', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newForm),
      });
      if (res.ok) {
        setShowNew(false);
        setNewForm({ assetTag: '', name: '', category: 'OTHER', manufacturer: '', model: '', serialNumber: '', purchaseDate: '', warrantyExpiry: '', location: '', notes: '' });
        await mutate();
      }
    } finally {
      setBusy(false);
    }
  };

  const addMaintenance = async () => {
    if (!selectedEquipment || !maintForm.maintenanceType) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/equipment-mgmt/${selectedEquipment.id}/maintenance`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...maintForm,
          cost: maintForm.cost ? Number(maintForm.cost) : undefined,
          partsReplaced: maintForm.partsReplaced
            ? maintForm.partsReplaced.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
        }),
      });
      if (res.ok) {
        setShowMaintenance(false);
        setMaintForm({ maintenanceType: 'PREVENTIVE', findings: '', partsReplaced: '', cost: '', nextDueDate: '', notes: '' });
        await Promise.all([mutate(), mutateDetail()]);
      }
    } finally {
      setBusy(false);
    }
  };

  const reportIssue = async () => {
    if (!selectedEquipment || !issueForm.description.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/equipment-mgmt/${selectedEquipment.id}/issues`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issueForm),
      });
      if (res.ok) {
        setShowIssue(false);
        setIssueForm({ severity: 'MEDIUM', description: '' });
        await Promise.all([mutate(), mutateDetail()]);
      }
    } finally {
      setBusy(false);
    }
  };

  const resolveIssue = async (issueId: string, resolution: string) => {
    if (!selectedEquipment) return;
    setBusy(true);
    try {
      await fetch(`/api/equipment-mgmt/${selectedEquipment.id}/issues`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, resolution }),
      });
      await Promise.all([mutate(), mutateDetail()]);
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async () => {
    if (!selectedEquipment || !newStatus) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/equipment-mgmt/${selectedEquipment.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setShowStatusChange(false);
        setNewStatus('');
        // Update selectedEquipment in-place
        setSelectedEquipment((prev: any) => prev ? { ...prev, status: newStatus } : null);
        await Promise.all([mutate(), mutateDetail()]);
      }
    } finally {
      setBusy(false);
    }
  };

  const openDetail = (eq: any) => {
    setSelectedEquipment(eq);
    setDetailTab('info');
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {tr('إدارة المعدات', 'Equipment Management')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('سجل المعدات والصيانة والأعطال', 'Equipment registry, maintenance and issue tracking')}
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          {tr('معدة جديدة', 'Add Equipment')}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: tr('الإجمالي', 'Total'), value: kpis.total, color: 'bg-blue-50 border-blue-200 text-blue-800' },
          { label: tr('يعمل', 'Operational'), value: kpis.operational, color: 'bg-green-50 border-green-200 text-green-800' },
          { label: tr('تحت الصيانة', 'Under Maint.'), value: kpis.underMaintenance, color: 'bg-amber-50 border-amber-200 text-amber-800' },
          { label: tr('خارج الخدمة', 'Out of Service'), value: kpis.outOfService, color: 'bg-red-50 border-red-200 text-red-800' },
          { label: tr('معايرة مطلوبة', 'Cal. Due'), value: kpis.calibrationDue, color: 'bg-orange-50 border-orange-200 text-orange-800' },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-2xl border p-4 ${kpi.color}`}>
            <p className="text-xs font-medium opacity-70">{kpi.label}</p>
            <p className="text-3xl font-extrabold mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative w-64">
          <Search className="absolute start-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={tr('بحث بالاسم، رقم الأصل...', 'Search by name, asset tag...')}
            className="ps-9 h-9 text-sm"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                categoryFilter === cat.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {tr(cat.ar, cat.en)}
            </button>
          ))}
        </div>
        <Select value={statusFilter || '__all__'} onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder={tr('كل الحالات', 'All Statuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{tr('كل الحالات', 'All Statuses')}</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{tr(v.ar, v.en)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-bold text-base">{tr('سجل المعدات', 'Equipment Registry')}</h2>
        </div>
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">{tr('جاري التحميل...', 'Loading...')}</div>
        ) : equipment.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">{tr('لا توجد معدات', 'No equipment found')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-start font-semibold">{tr('رقم الأصل', 'Asset Tag')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{tr('الاسم', 'Name')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{tr('الفئة', 'Category')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{tr('الموقع', 'Location')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{tr('الحالة', 'Status')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{tr('تنبيهات', 'Alerts')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{tr('الصيانة القادمة', 'Next Maint.')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{tr('إجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((eq: any) => {
                  const statusCfg = STATUS_CONFIG[eq.status] || { ar: eq.status, en: eq.status, color: 'bg-muted text-foreground' };
                  const catCfg = CATEGORIES.find((c) => c.value === eq.category);
                  const hasAlerts = eq.warrantyExpired || eq.warrantyExpiringSoon || eq.maintenanceOverdue || eq.openIssueCount > 0;

                  return (
                    <tr key={eq.id} className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => openDetail(eq)}>
                      <td className="px-4 py-3 font-mono text-xs">{eq.assetTag}</td>
                      <td className="px-4 py-3 font-medium">{eq.name}</td>
                      <td className="px-4 py-3 text-xs">
                        {catCfg ? tr(catCfg.ar, catCfg.en) : eq.category}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{eq.location || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                          {tr(statusCfg.ar, statusCfg.en)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {hasAlerts ? (
                          <div className="flex items-center gap-1">
                            {eq.warrantyExpired && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold" title={tr('الضمان منتهي', 'Warranty expired')}>
                                <Shield className="w-3 h-3 inline-block" />
                              </span>
                            )}
                            {eq.warrantyExpiringSoon && !eq.warrantyExpired && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold" title={tr('الضمان ينتهي قريباً', 'Warranty expiring soon')}>
                                <Shield className="w-3 h-3 inline-block" />
                              </span>
                            )}
                            {eq.maintenanceOverdue && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold" title={tr('صيانة متأخرة', 'Maintenance overdue')}>
                                <Clock className="w-3 h-3 inline-block" />
                              </span>
                            )}
                            {eq.openIssueCount > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold" title={tr('أعطال مفتوحة', 'Open issues')}>
                                <Bug className="w-3 h-3 inline-block" /> {eq.openIssueCount}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {eq.nextMaintenanceDate ? (
                          <span className={eq.maintenanceOverdue ? 'text-red-600 font-medium' : ''}>
                            {new Date(eq.nextMaintenanceDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openDetail(eq); }}>
                          {tr('عرض', 'View')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Equipment Detail Panel */}
      <Dialog open={!!selectedEquipment} onOpenChange={(open) => !open && setSelectedEquipment(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedEquipment?.name}
              <span className="ms-2 font-mono text-xs font-normal text-muted-foreground">{selectedEquipment?.assetTag}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedEquipment && (
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex gap-1 border-b border-border">
                {([
                  { key: 'info', ar: 'المعلومات', en: 'Info' },
                  { key: 'maintenance', ar: 'الصيانة', en: 'Maintenance' },
                  { key: 'issues', ar: 'الأعطال', en: 'Issues' },
                ] as const).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setDetailTab(t.key)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      detailTab === t.key
                        ? 'border-b-2 border-primary text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tr(t.ar, t.en)}
                  </button>
                ))}
              </div>

              {/* Info Tab */}
              {detailTab === 'info' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { label: tr('الفئة', 'Category'), value: (() => { const c = CATEGORIES.find((x) => x.value === selectedEquipment.category); return c ? tr(c.ar, c.en) : selectedEquipment.category; })() },
                      { label: tr('الشركة المصنعة', 'Manufacturer'), value: selectedEquipment.manufacturer },
                      { label: tr('الموديل', 'Model'), value: selectedEquipment.model },
                      { label: tr('الرقم التسلسلي', 'Serial Number'), value: selectedEquipment.serialNumber },
                      { label: tr('الموقع', 'Location'), value: selectedEquipment.location },
                      { label: tr('تاريخ الشراء', 'Purchase Date'), value: selectedEquipment.purchaseDate ? new Date(selectedEquipment.purchaseDate).toLocaleDateString() : null },
                      { label: tr('انتهاء الضمان', 'Warranty Expiry'), value: selectedEquipment.warrantyExpiry ? new Date(selectedEquipment.warrantyExpiry).toLocaleDateString() : null },
                    ].map((f) => (
                      <div key={f.label}>
                        <p className="text-xs text-muted-foreground">{f.label}</p>
                        <p className="font-medium">{f.value || '—'}</p>
                      </div>
                    ))}
                    <div>
                      <p className="text-xs text-muted-foreground">{tr('الحالة', 'Status')}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${(STATUS_CONFIG[selectedEquipment.status] || { color: 'bg-muted text-foreground' }).color}`}>
                          {(() => { const s = STATUS_CONFIG[selectedEquipment.status]; return s ? tr(s.ar, s.en) : selectedEquipment.status; })()}
                        </span>
                        <button
                          onClick={() => { setNewStatus(selectedEquipment.status); setShowStatusChange(true); }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {tr('تغيير', 'Change')}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Warranty / Maintenance Alerts */}
                  {(selectedEquipment.warrantyExpired || selectedEquipment.warrantyExpiringSoon || selectedEquipment.maintenanceOverdue) && (
                    <div className="space-y-2">
                      {selectedEquipment.warrantyExpired && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                          <Shield className="w-4 h-4" />
                          {tr('الضمان منتهي!', 'Warranty has expired!')}
                        </div>
                      )}
                      {selectedEquipment.warrantyExpiringSoon && !selectedEquipment.warrantyExpired && (
                        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                          <Shield className="w-4 h-4" />
                          {tr('الضمان ينتهي خلال 30 يوم', 'Warranty expires within 30 days')}
                        </div>
                      )}
                      {selectedEquipment.maintenanceOverdue && (
                        <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-700">
                          <Clock className="w-4 h-4" />
                          {tr('الصيانة المجدولة متأخرة!', 'Scheduled maintenance is overdue!')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Maintenance Tab */}
              {detailTab === 'maintenance' && (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => setShowMaintenance(true)}>
                      <Wrench className="w-3.5 h-3.5 me-1" />
                      {tr('إضافة سجل صيانة', 'Add Maintenance Record')}
                    </Button>
                  </div>
                  {(detailData?.maintenanceRecords || []).length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-6">
                      {tr('لا توجد سجلات صيانة', 'No maintenance records')}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(detailData?.maintenanceRecords || []).map((m: any) => {
                        const typeCfg = MAINTENANCE_TYPES.find((t) => t.value === m.maintenanceType);
                        return (
                          <div key={m.id} className="bg-muted/40 rounded-xl p-3 text-sm space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{typeCfg ? tr(typeCfg.ar, typeCfg.en) : m.maintenanceType}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(m.performedAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                              </span>
                            </div>
                            {m.findings && <p className="text-xs text-muted-foreground">{m.findings}</p>}
                            {m.cost != null && m.cost > 0 && (
                              <p className="text-xs">{tr('التكلفة:', 'Cost:')} {m.cost.toLocaleString()} SAR</p>
                            )}
                            {m.nextDueDate && (
                              <p className={`text-xs ${new Date(m.nextDueDate) < new Date() ? 'text-red-600 font-medium' : 'text-amber-600'}`}>
                                {tr('الصيانة القادمة:', 'Next due:')} {new Date(m.nextDueDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Issues Tab */}
              {detailTab === 'issues' && (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button size="sm" variant="destructive" onClick={() => setShowIssue(true)}>
                      <Bug className="w-3.5 h-3.5 me-1" />
                      {tr('الإبلاغ عن عطل', 'Report Issue')}
                    </Button>
                  </div>
                  {(detailData?.issues || []).length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-6">
                      {tr('لا توجد أعطال', 'No issues reported')}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(detailData?.issues || []).map((issue: any) => {
                        const sevCfg = SEVERITY_CONFIG[issue.severity] || { ar: issue.severity, en: issue.severity, color: 'bg-muted text-foreground' };
                        const isOpen = issue.status === 'OPEN' || issue.status === 'IN_PROGRESS';
                        return (
                          <IssueCard
                            key={issue.id}
                            issue={issue}
                            sevCfg={sevCfg}
                            isOpen={isOpen}
                            tr={tr}
                            language={language}
                            busy={busy}
                            onResolve={resolveIssue}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={showStatusChange} onOpenChange={setShowStatusChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{tr('تغيير حالة المعدة', 'Change Equipment Status')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{tr(v.ar, v.en)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowStatusChange(false)}>{tr('إلغاء', 'Cancel')}</Button>
              <Button onClick={changeStatus} disabled={busy || !newStatus || newStatus === selectedEquipment?.status}>
                {busy ? tr('جاري التحديث...', 'Updating...') : tr('تحديث', 'Update')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Equipment Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr('إضافة معدة جديدة', 'Add New Equipment')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{tr('رقم الأصل', 'Asset Tag')} *</Label>
                <Input value={newForm.assetTag} onChange={(e) => setNewForm((f) => ({ ...f, assetTag: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{tr('الاسم', 'Name')} *</Label>
                <Input value={newForm.name} onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{tr('الفئة', 'Category')} *</Label>
              <Select value={newForm.category} onValueChange={(v) => setNewForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter((c) => c.value !== 'ALL').map((c) => (
                    <SelectItem key={c.value} value={c.value}>{tr(c.ar, c.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{tr('الشركة المصنعة', 'Manufacturer')}</Label>
                <Input value={newForm.manufacturer} onChange={(e) => setNewForm((f) => ({ ...f, manufacturer: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{tr('الموديل', 'Model')}</Label>
                <Input value={newForm.model} onChange={(e) => setNewForm((f) => ({ ...f, model: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{tr('الرقم التسلسلي', 'Serial Number')}</Label>
                <Input value={newForm.serialNumber} onChange={(e) => setNewForm((f) => ({ ...f, serialNumber: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{tr('الموقع', 'Location')}</Label>
                <Input value={newForm.location} onChange={(e) => setNewForm((f) => ({ ...f, location: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{tr('تاريخ الشراء', 'Purchase Date')}</Label>
                <Input type="date" value={newForm.purchaseDate} onChange={(e) => setNewForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{tr('انتهاء الضمان', 'Warranty Expiry')}</Label>
                <Input type="date" value={newForm.warrantyExpiry} onChange={(e) => setNewForm((f) => ({ ...f, warrantyExpiry: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{tr('ملاحظات', 'Notes')}</Label>
              <Textarea value={newForm.notes} onChange={(e) => setNewForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowNew(false)} disabled={busy}>{tr('إلغاء', 'Cancel')}</Button>
              <Button onClick={createEquipment} disabled={busy || !newForm.assetTag.trim() || !newForm.name.trim()}>
                {busy ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Maintenance Record Dialog */}
      <Dialog open={showMaintenance} onOpenChange={setShowMaintenance}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tr('إضافة سجل صيانة', 'Add Maintenance Record')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>{tr('نوع الصيانة', 'Maintenance Type')}</Label>
              <Select value={maintForm.maintenanceType} onValueChange={(v) => setMaintForm((f) => ({ ...f, maintenanceType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MAINTENANCE_TYPES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{tr(m.ar, m.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{tr('النتائج', 'Findings')}</Label>
              <Textarea value={maintForm.findings} onChange={(e) => setMaintForm((f) => ({ ...f, findings: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{tr('التكلفة', 'Cost')} (SAR)</Label>
                <Input type="number" value={maintForm.cost} onChange={(e) => setMaintForm((f) => ({ ...f, cost: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{tr('الصيانة القادمة', 'Next Due Date')}</Label>
                <Input type="date" value={maintForm.nextDueDate} onChange={(e) => setMaintForm((f) => ({ ...f, nextDueDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{tr('القطع المستبدلة', 'Parts Replaced')} ({tr('مفصولة بفاصلة', 'comma separated')})</Label>
              <Input value={maintForm.partsReplaced} onChange={(e) => setMaintForm((f) => ({ ...f, partsReplaced: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{tr('ملاحظات', 'Notes')}</Label>
              <Textarea value={maintForm.notes} onChange={(e) => setMaintForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowMaintenance(false)} disabled={busy}>{tr('إلغاء', 'Cancel')}</Button>
              <Button onClick={addMaintenance} disabled={busy}>
                {busy ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Issue Dialog */}
      <Dialog open={showIssue} onOpenChange={setShowIssue}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tr('الإبلاغ عن عطل', 'Report Equipment Issue')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>{tr('الخطورة', 'Severity')}</Label>
              <Select value={issueForm.severity} onValueChange={(v) => setIssueForm((f) => ({ ...f, severity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SEVERITY_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{tr(v.ar, v.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{tr('وصف المشكلة', 'Issue Description')} *</Label>
              <Textarea value={issueForm.description} onChange={(e) => setIssueForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowIssue(false)} disabled={busy}>{tr('إلغاء', 'Cancel')}</Button>
              <Button variant="destructive" onClick={reportIssue} disabled={busy || !issueForm.description.trim()}>
                {busy ? tr('جاري الإرسال...', 'Submitting...') : tr('إبلاغ', 'Report')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Issue Card with inline resolve
// ---------------------------------------------------------------------------
function IssueCard({
  issue,
  sevCfg,
  isOpen,
  tr,
  language,
  busy,
  onResolve,
}: {
  issue: any;
  sevCfg: { ar: string; en: string; color: string };
  isOpen: boolean;
  tr: (ar: string, en: string) => string;
  language: string;
  busy: boolean;
  onResolve: (issueId: string, resolution: string) => Promise<void>;
}) {
  const [showResolve, setShowResolve] = useState(false);
  const [resolution, setResolution] = useState('');

  return (
    <div className="bg-muted/40 rounded-xl p-3 text-sm space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sevCfg.color}`}>
            {tr(sevCfg.ar, sevCfg.en)}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(issue.reportedAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
          </span>
        </div>
        <span className={`text-xs font-semibold ${issue.status === 'RESOLVED' || issue.status === 'CLOSED' ? 'text-green-600' : 'text-red-600'}`}>
          {issue.status === 'RESOLVED' ? tr('محلول', 'Resolved') :
           issue.status === 'CLOSED' ? tr('مغلق', 'Closed') :
           issue.status === 'IN_PROGRESS' ? tr('قيد العمل', 'In Progress') :
           tr('مفتوح', 'Open')}
        </span>
      </div>
      <p className="text-xs">{issue.description}</p>
      {issue.resolution && (
        <div className="flex items-center gap-1 text-xs text-green-700">
          <CheckCircle2 className="w-3 h-3" />
          {tr('الحل:', 'Resolution:')} {issue.resolution}
        </div>
      )}
      {isOpen && !showResolve && (
        <button
          onClick={() => setShowResolve(true)}
          className="text-xs text-blue-600 hover:underline"
        >
          {tr('حل هذا العطل', 'Resolve this issue')}
        </button>
      )}
      {showResolve && (
        <div className="space-y-2 pt-1 border-t border-border">
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder={tr('وصف الحل...', 'Describe the resolution...')}
            className="w-full px-3 py-2 border border-border rounded-xl text-xs resize-none"
            rows={2}
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowResolve(false)} className="text-xs text-muted-foreground hover:text-foreground">
              {tr('إلغاء', 'Cancel')}
            </button>
            <button
              onClick={async () => {
                await onResolve(issue.id, resolution);
                setShowResolve(false);
                setResolution('');
              }}
              disabled={busy || !resolution.trim()}
              className="text-xs px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {tr('حل', 'Resolve')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
