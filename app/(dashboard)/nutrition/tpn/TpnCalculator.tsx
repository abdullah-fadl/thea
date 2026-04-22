'use client';

// =============================================================================
// TPN (Total Parenteral Nutrition) Calculator
// Full-featured TPN order management with real-time calculations, electrolytes,
// vitamins, trace elements, additives, lab monitoring, and pharmacist verification.
// =============================================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Beaker,
  Plus,
  RefreshCw,
  Eye,
  CheckCircle2,
  ClipboardCheck,
  Activity,
  AlertTriangle,
  Droplets,
  Pill,
  Stethoscope,
  FileText,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import {
  DEXTROSE_CONCENTRATIONS,
  AMINO_ACID_CONCENTRATIONS,
  LIPID_CONCENTRATIONS,
  STANDARD_ELECTROLYTES,
  STANDARD_VITAMINS,
  STANDARD_TRACE_ELEMENTS,
  ACCESS_TYPES,
  LAB_MONITORING_SCHEDULE,
  calculateTpnCalories,
  calculateTpnProtein,
  calculateGIR,
  calculateOsmolarity,
  calculateBMI,
  isPeripheralSafe,
  calculateTotalVolume,
  type DextroseInput,
  type AminoAcidInput,
  type LipidInput,
} from '@/lib/nutrition/tpnDefinitions';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { en: string; ar: string; color: string; bg: string }> = {
  DRAFT:     { en: 'Draft',     ar: 'مسودة',   color: 'text-muted-foreground',  bg: 'bg-muted' },
  ACTIVE:    { en: 'Active',    ar: 'نشط',     color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
  COMPLETED: { en: 'Completed', ar: 'مكتمل',   color: 'text-blue-600',  bg: 'bg-blue-100 dark:bg-blue-900/30' },
  CANCELLED: { en: 'Cancelled', ar: 'ملغي',    color: 'text-red-600',   bg: 'bg-red-100 dark:bg-red-900/30' },
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '---';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Form tab key ─────────────────────────────────────────────────────────────

type FormTabKey = 'patient' | 'macros' | 'electrolytes' | 'vitamins' | 'additives' | 'summary';

interface FormTabDef {
  key: FormTabKey;
  ar: string;
  en: string;
}

const FORM_TABS: FormTabDef[] = [
  { key: 'patient',      ar: 'بيانات المريض',     en: 'Patient Info' },
  { key: 'macros',       ar: 'المغذيات الكبرى',   en: 'Macronutrients' },
  { key: 'electrolytes', ar: 'الأملاح',           en: 'Electrolytes' },
  { key: 'vitamins',     ar: 'الفيتامينات',       en: 'Vitamins & Trace Elements' },
  { key: 'additives',    ar: 'الإضافات والمراقبة', en: 'Additives & Monitoring' },
  { key: 'summary',      ar: 'الملخص والإرسال',   en: 'Summary & Submit' },
];

// ── Default form state ───────────────────────────────────────────────────────

interface ElectrolyteEntry { name: string; amount: number }
interface VitaminEntry { name: string; amount: string; unit: string; enabled: boolean }
interface TraceElementEntry { name: string; amount: string; unit: string; enabled: boolean }
interface AdditiveEntry { name: string; amount: string; unit: string }

interface TpnForm {
  patientMasterId: string;
  episodeId: string;
  weight: number;
  height: number;
  caloricTarget: number;
  proteinTarget: number;
  accessType: string;
  infusionHours: number;
  dextroseConc: string;
  dextroseVol: number;
  aminoAcidConc: string;
  aminoAcidVol: number;
  lipidConc: string;
  lipidVol: number;
  electrolytes: ElectrolyteEntry[];
  standardVitamins: boolean;
  vitamins: VitaminEntry[];
  standardTraceElements: boolean;
  traceElements: TraceElementEntry[];
  additives: AdditiveEntry[];
  labMonitoring: string[];
  compatibilityCheck: boolean;
  notes: string;
}

function defaultForm(): TpnForm {
  return {
    patientMasterId: '',
    episodeId: '',
    weight: 0,
    height: 0,
    caloricTarget: 25,
    proteinTarget: 1.2,
    accessType: 'CENTRAL',
    infusionHours: 24,
    dextroseConc: '10',
    dextroseVol: 500,
    aminoAcidConc: '10',
    aminoAcidVol: 500,
    lipidConc: '20',
    lipidVol: 250,
    electrolytes: STANDARD_ELECTROLYTES.map(e => ({ name: e.name, amount: 0 })),
    standardVitamins: true,
    vitamins: STANDARD_VITAMINS.map(v => ({ name: v.name, amount: v.standardDose, unit: v.unit, enabled: false })),
    standardTraceElements: true,
    traceElements: STANDARD_TRACE_ELEMENTS.map(t => ({ name: t.name, amount: t.standardDose, unit: t.unit, enabled: false })),
    additives: [],
    labMonitoring: LAB_MONITORING_SCHEDULE.map(l => l.test),
    compatibilityCheck: false,
    notes: '',
  };
}

// =============================================================================
// Main Component
// =============================================================================

export default function TpnCalculator() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState<any>(null);
  const [formTab, setFormTab] = useState<FormTabKey>('patient');
  const [form, setForm] = useState<TpnForm>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Fetch orders
  const queryParams = new URLSearchParams({ ...(statusFilter ? { status: statusFilter } : {}) });
  const { data, mutate, isLoading } = useSWR(`/api/nutrition/tpn?${queryParams}`, fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false,
  });

  const orders: any[] = data?.orders || [];
  const stats = data?.stats || { activeOrders: 0, verifiedOrders: 0, monthlyOrders: 0, avgCalPerKg: 0 };

  // ── Live calculations ──────────────────────────────────────────────────────

  const dextroseInput: DextroseInput = useMemo(() => ({
    concentration: form.dextroseConc,
    volume: form.dextroseVol || 0,
  }), [form.dextroseConc, form.dextroseVol]);

  const aminoAcidInput: AminoAcidInput = useMemo(() => ({
    concentration: form.aminoAcidConc,
    volume: form.aminoAcidVol || 0,
  }), [form.aminoAcidConc, form.aminoAcidVol]);

  const lipidInput: LipidInput | null = useMemo(() => {
    if (!form.lipidVol) return null;
    return { concentration: form.lipidConc, volume: form.lipidVol };
  }, [form.lipidConc, form.lipidVol]);

  const liveCalories = useMemo(
    () => calculateTpnCalories(dextroseInput, aminoAcidInput, lipidInput),
    [dextroseInput, aminoAcidInput, lipidInput],
  );

  const liveProtein = useMemo(
    () => calculateTpnProtein(aminoAcidInput),
    [aminoAcidInput],
  );

  const liveGIR = useMemo(
    () => calculateGIR(dextroseInput, form.weight, form.infusionHours),
    [dextroseInput, form.weight, form.infusionHours],
  );

  const liveTotalVolume = useMemo(
    () => calculateTotalVolume(form.dextroseVol || 0, form.aminoAcidVol || 0, form.lipidVol || 0),
    [form.dextroseVol, form.aminoAcidVol, form.lipidVol],
  );

  const liveOsmolarity = useMemo(
    () => calculateOsmolarity(dextroseInput, aminoAcidInput, form.electrolytes, liveTotalVolume),
    [dextroseInput, aminoAcidInput, form.electrolytes, liveTotalVolume],
  );

  const liveBMI = useMemo(
    () => form.height > 0 ? calculateBMI(form.weight, form.height) : 0,
    [form.weight, form.height],
  );

  const liveCalPerKg = form.weight > 0 ? Math.round((liveCalories.totalKcal / form.weight) * 10) / 10 : 0;
  const liveProtPerKg = form.weight > 0 ? Math.round((liveProtein / form.weight) * 100) / 100 : 0;
  const liveInfusionRate = form.infusionHours > 0 ? Math.round((liveTotalVolume / form.infusionHours) * 10) / 10 : 0;
  const peripheralSafe = isPeripheralSafe(liveOsmolarity);

  // ── Form helpers ───────────────────────────────────────────────────────────

  const updateForm = useCallback((field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const updateElectrolyte = useCallback((index: number, amount: number) => {
    setForm(prev => {
      const next = [...prev.electrolytes];
      next[index] = { ...next[index], amount };
      return { ...prev, electrolytes: next };
    });
  }, []);

  const addAdditive = useCallback(() => {
    setForm(prev => ({
      ...prev,
      additives: [...prev.additives, { name: '', amount: '', unit: 'units' }],
    }));
  }, []);

  const removeAdditive = useCallback((index: number) => {
    setForm(prev => ({
      ...prev,
      additives: prev.additives.filter((_, i) => i !== index),
    }));
  }, []);

  const updateAdditive = useCallback((index: number, field: string, value: string) => {
    setForm(prev => {
      const next = [...prev.additives];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, additives: next };
    });
  }, []);

  const toggleLabMonitoring = useCallback((test: string) => {
    setForm(prev => {
      const labs = prev.labMonitoring.includes(test)
        ? prev.labMonitoring.filter(t => t !== test)
        : [...prev.labMonitoring, test];
      return { ...prev, labMonitoring: labs };
    });
  }, []);

  const openCreate = useCallback(() => {
    setForm(defaultForm());
    setEditingId(null);
    setFormTab('patient');
    setCreateDialogOpen(true);
  }, []);

  const openEdit = useCallback((order: any) => {
    setForm({
      patientMasterId: order.patientMasterId || '',
      episodeId: order.episodeId || '',
      weight: order.weight || 0,
      height: order.height || 0,
      caloricTarget: 25,
      proteinTarget: 1.2,
      accessType: order.accessType || 'CENTRAL',
      infusionHours: order.infusionHours || 24,
      dextroseConc: order.dextrose?.concentration || '10',
      dextroseVol: order.dextrose?.volume || 0,
      aminoAcidConc: order.aminoAcids?.concentration || '10',
      aminoAcidVol: order.aminoAcids?.volume || 0,
      lipidConc: order.lipids?.concentration || '20',
      lipidVol: order.lipids?.volume || 0,
      electrolytes: STANDARD_ELECTROLYTES.map(e => {
        const existing = (order.electrolytes || []).find((el: any) => el.name === e.name);
        return { name: e.name, amount: existing?.amount || 0 };
      }),
      standardVitamins: true,
      vitamins: STANDARD_VITAMINS.map(v => {
        const existing = (order.vitamins || []).find((vi: any) => vi.name === v.name);
        return { name: v.name, amount: existing?.amount || v.standardDose, unit: v.unit, enabled: !!existing };
      }),
      standardTraceElements: true,
      traceElements: STANDARD_TRACE_ELEMENTS.map(t => {
        const existing = (order.traceElements || []).find((te: any) => te.name === t.name);
        return { name: t.name, amount: existing?.amount || t.standardDose, unit: t.unit, enabled: !!existing };
      }),
      additives: order.additives || [],
      labMonitoring: order.labMonitoring?.map((l: any) => l.test || l) || LAB_MONITORING_SCHEDULE.map(l => l.test),
      compatibilityCheck: order.compatibilityCheck || false,
      notes: order.notes || '',
    });
    setEditingId(order.id);
    setFormTab('patient');
    setCreateDialogOpen(true);
  }, []);

  // ── Submit handler ─────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!form.patientMasterId) {
      toast({ title: tr('خطأ', 'Error'), description: tr('معرف المريض مطلوب', 'Patient ID is required'), variant: 'destructive' });
      return;
    }
    if (!form.weight || form.weight <= 0) {
      toast({ title: tr('خطأ', 'Error'), description: tr('الوزن مطلوب', 'Weight is required'), variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        patientMasterId: form.patientMasterId,
        episodeId: form.episodeId || null,
        weight: form.weight,
        height: form.height || null,
        infusionHours: form.infusionHours,
        accessType: form.accessType,
        dextrose: { concentration: form.dextroseConc, volume: form.dextroseVol },
        aminoAcids: { concentration: form.aminoAcidConc, volume: form.aminoAcidVol },
        lipids: form.lipidVol ? { concentration: form.lipidConc, volume: form.lipidVol } : null,
        electrolytes: form.electrolytes.filter(e => e.amount > 0),
        vitamins: form.vitamins.filter(v => v.enabled || form.standardVitamins).map(v => ({ name: v.name, amount: v.amount, unit: v.unit })),
        traceElements: form.traceElements.filter(t => t.enabled || form.standardTraceElements).map(t => ({ name: t.name, amount: t.amount, unit: t.unit })),
        additives: form.additives.filter(a => a.name),
        labMonitoring: form.labMonitoring.map(test => {
          const def = LAB_MONITORING_SCHEDULE.find(l => l.test === test);
          return { test, frequency: def?.frequency || '' };
        }),
        compatibilityCheck: form.compatibilityCheck,
        notes: form.notes,
        status: 'DRAFT',
      };

      let res: Response;
      if (editingId) {
        payload.id = editingId;
        res = await fetch('/api/nutrition/tpn', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/nutrition/tpn', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const result = await res.json();
      if (!res.ok) {
        toast({ title: tr('خطأ', 'Error'), description: result.error || tr('حدث خطأ', 'An error occurred'), variant: 'destructive' });
      } else {
        toast({ title: tr('تم بنجاح', 'Success'), description: editingId ? tr('تم تحديث الأمر', 'Order updated') : tr('تم إنشاء الأمر', 'Order created') });
        setCreateDialogOpen(false);
        mutate();
      }
    } catch {
      toast({ title: tr('خطأ', 'Error'), description: tr('فشل الاتصال', 'Connection failed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [form, editingId, toast, tr, mutate]);

  // ── Status update handler ──────────────────────────────────────────────────

  const handleStatusChange = useCallback(async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/nutrition/tpn', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast({ title: tr('خطأ', 'Error'), description: result.error || tr('حدث خطأ', 'An error occurred'), variant: 'destructive' });
      } else {
        toast({ title: tr('تم بنجاح', 'Success'), description: tr('تم تحديث الحالة', 'Status updated') });
        mutate();
      }
    } catch {
      toast({ title: tr('خطأ', 'Error'), description: tr('فشل الاتصال', 'Connection failed'), variant: 'destructive' });
    }
  }, [toast, tr, mutate]);

  // ── Pharmacist verify handler ──────────────────────────────────────────────

  const handleVerify = useCallback(async (orderId: string) => {
    try {
      const res = await fetch('/api/nutrition/tpn', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, pharmacistVerified: true }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast({ title: tr('خطأ', 'Error'), description: result.error || tr('حدث خطأ', 'An error occurred'), variant: 'destructive' });
      } else {
        toast({ title: tr('تم بنجاح', 'Success'), description: tr('تم التحقق من الصيدلي', 'Pharmacist verified') });
        mutate();
        if (viewOrder?.id === orderId) {
          setViewOrder(result.order);
        }
      }
    } catch {
      toast({ title: tr('خطأ', 'Error'), description: tr('فشل الاتصال', 'Connection failed'), variant: 'destructive' });
    }
  }, [toast, tr, mutate, viewOrder]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 md:p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Beaker className="h-6 w-6 text-purple-600" />
            {tr('حاسبة التغذية الوريدية الكاملة', 'TPN Calculator')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('إدارة وحساب أوامر التغذية الوريدية الكاملة', 'Manage and calculate Total Parenteral Nutrition orders')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="ml-1">{tr('تحديث', 'Refresh')}</span>
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            <span className="ml-1">{tr('أمر جديد', 'New Order')}</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          icon={<Activity className="h-5 w-5" />}
          label={tr('أوامر نشطة', 'Active Orders')}
          value={stats.activeOrders}
          color="text-green-600 dark:text-green-400"
          bg="bg-green-50 dark:bg-green-900/20"
        />
        <KPICard
          icon={<Droplets className="h-5 w-5" />}
          label={tr('متوسط سعرات/كغ/يوم', 'Avg Calories/kg/day')}
          value={stats.avgCalPerKg}
          color="text-blue-600 dark:text-blue-400"
          bg="bg-blue-50 dark:bg-blue-900/20"
        />
        <KPICard
          icon={<Shield className="h-5 w-5" />}
          label={tr('تحقق الصيدلي', 'Pharmacist Verified')}
          value={stats.verifiedOrders}
          color="text-purple-600 dark:text-purple-400"
          bg="bg-purple-50 dark:bg-purple-900/20"
        />
        <KPICard
          icon={<FileText className="h-5 w-5" />}
          label={tr('أوامر هذا الشهر', 'Orders This Month')}
          value={stats.monthlyOrders}
          color="text-amber-600 dark:text-amber-400"
          bg="bg-amber-50 dark:bg-amber-900/20"
        />
      </div>

      {/* Status filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{tr('تصفية حسب الحالة', 'Filter by Status')}</Label>
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={tr('جميع الحالات', 'All Statuses')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{tr('الكل', 'All')}</SelectItem>
                  <SelectItem value="DRAFT">{tr('مسودة', 'Draft')}</SelectItem>
                  <SelectItem value="ACTIVE">{tr('نشط', 'Active')}</SelectItem>
                  <SelectItem value="COMPLETED">{tr('مكتمل', 'Completed')}</SelectItem>
                  <SelectItem value="CANCELLED">{tr('ملغي', 'Cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tr('أوامر التغذية الوريدية', 'TPN Orders')}</CardTitle>
          <CardDescription>{tr('قائمة جميع الأوامر', 'List of all orders')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('التاريخ', 'Date')}</TableHead>
                  <TableHead>{tr('المريض', 'Patient')}</TableHead>
                  <TableHead className="text-center">{tr('الوزن', 'Weight')}</TableHead>
                  <TableHead className="text-center">{tr('سعرات', 'Calories')}</TableHead>
                  <TableHead className="text-center">{tr('بروتين', 'Protein')}</TableHead>
                  <TableHead className="text-center">{tr('GIR', 'GIR')}</TableHead>
                  <TableHead className="text-center">{tr('أوسمولارية', 'Osmolarity')}</TableHead>
                  <TableHead className="text-center">{tr('المنفذ', 'Access')}</TableHead>
                  <TableHead className="text-center">{tr('الحالة', 'Status')}</TableHead>
                  <TableHead className="text-center">{tr('إجراءات', 'Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      {tr('لا توجد أوامر', 'No orders found')}
                    </TableCell>
                  </TableRow>
                )}
                {orders.map((order: any) => {
                  const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.DRAFT;
                  return (
                    <TableRow key={order.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{fmtDate(order.orderDate)}</TableCell>
                      <TableCell className="font-mono text-xs">{order.patientMasterId?.slice(0, 8)}...</TableCell>
                      <TableCell className="text-center">{order.weight} {tr('كغ', 'kg')}</TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{order.totalCalories}</span>
                        <span className="text-xs text-muted-foreground"> ({order.caloriesPerKg}/kg)</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{order.totalProtein}g</span>
                        <span className="text-xs text-muted-foreground"> ({order.proteinPerKg}/kg)</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={order.glucoseInfusionRate > 5 ? 'text-red-600 font-bold' : ''}>
                          {order.glucoseInfusionRate}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={!isPeripheralSafe(order.osmolarity || 0) && order.accessType === 'PERIPHERAL' ? 'text-red-600 font-bold' : ''}>
                          {order.osmolarity}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">
                          {order.accessType === 'CENTRAL' ? tr('مركزي', 'Central') : tr('طرفي', 'Peripheral')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`${sc.bg} ${sc.color} border-0 text-xs`}>
                          {tr(sc.ar, sc.en)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <Button variant="ghost" size="sm" onClick={() => setViewOrder(order)} title={tr('عرض', 'View')}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {order.status === 'DRAFT' && (
                            <Button variant="ghost" size="sm" onClick={() => openEdit(order)} title={tr('تعديل', 'Edit')}>
                              <FileText className="h-4 w-4" />
                            </Button>
                          )}
                          {order.status === 'DRAFT' && (
                            <Button variant="ghost" size="sm" onClick={() => handleStatusChange(order.id, 'ACTIVE')} title={tr('تفعيل', 'Activate')}>
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? tr('تعديل أمر TPN', 'Edit TPN Order') : tr('أمر TPN جديد', 'New TPN Order')}
            </DialogTitle>
            <DialogDescription>
              {tr('حساب وإنشاء وصفة التغذية الوريدية الكاملة', 'Calculate and create a Total Parenteral Nutrition formula')}
            </DialogDescription>
          </DialogHeader>

          {/* Live running totals bar */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 p-3 rounded-lg bg-muted/50 border text-center">
            <div>
              <p className="text-[10px] text-muted-foreground">{tr('الحجم', 'Volume')}</p>
              <p className="text-sm font-bold">{liveTotalVolume} mL</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">{tr('سعرات', 'Calories')}</p>
              <p className="text-sm font-bold">{liveCalories.totalKcal} kcal</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">{tr('بروتين', 'Protein')}</p>
              <p className="text-sm font-bold">{liveProtein} g</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">{tr('سعرات/كغ', 'Cal/kg')}</p>
              <p className="text-sm font-bold">{liveCalPerKg}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">GIR</p>
              <p className={`text-sm font-bold ${liveGIR > 5 ? 'text-red-600' : ''}`}>{liveGIR}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">{tr('أوسمولارية', 'Osmolarity')}</p>
              <p className={`text-sm font-bold ${!peripheralSafe && form.accessType === 'PERIPHERAL' ? 'text-red-600' : ''}`}>
                {liveOsmolarity}
              </p>
            </div>
          </div>

          {/* Warnings */}
          {liveGIR > 5 && (
            <div className="flex items-center gap-2 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-700 dark:text-red-300 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {tr('تحذير: GIR يتجاوز 5 ملغ/كغ/دقيقة — خطر ارتفاع السكر', 'Warning: GIR exceeds 5 mg/kg/min - hyperglycemia risk')}
            </div>
          )}
          {!peripheralSafe && form.accessType === 'PERIPHERAL' && (
            <div className="flex items-center gap-2 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-700 dark:text-red-300 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {tr('تحذير: الأوسمولارية تتجاوز 900 — غير آمن للوريد الطرفي', 'Warning: Osmolarity exceeds 900 mOsm/L - unsafe for peripheral IV')}
            </div>
          )}

          {/* Form tab bar */}
          <div className="flex gap-1 border-b overflow-x-auto">
            {FORM_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFormTab(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  formTab === tab.key
                    ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tr(tab.ar, tab.en)}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="min-h-[300px]">
            {formTab === 'patient' && (
              <PatientInfoTab form={form} updateForm={updateForm} liveBMI={liveBMI} liveInfusionRate={liveInfusionRate} tr={tr} />
            )}
            {formTab === 'macros' && (
              <MacronutrientsTab form={form} updateForm={updateForm} liveCalories={liveCalories} liveProtein={liveProtein} liveGIR={liveGIR} liveOsmolarity={liveOsmolarity} liveTotalVolume={liveTotalVolume} liveCalPerKg={liveCalPerKg} liveProtPerKg={liveProtPerKg} tr={tr} />
            )}
            {formTab === 'electrolytes' && (
              <ElectrolytesTab form={form} updateElectrolyte={updateElectrolyte} tr={tr} />
            )}
            {formTab === 'vitamins' && (
              <VitaminsTraceTab form={form} updateForm={updateForm} tr={tr} />
            )}
            {formTab === 'additives' && (
              <AdditivesMonitoringTab form={form} updateForm={updateForm} addAdditive={addAdditive} removeAdditive={removeAdditive} updateAdditive={updateAdditive} toggleLabMonitoring={toggleLabMonitoring} tr={tr} />
            )}
            {formTab === 'summary' && (
              <SummaryTab form={form} liveCalories={liveCalories} liveProtein={liveProtein} liveGIR={liveGIR} liveOsmolarity={liveOsmolarity} liveTotalVolume={liveTotalVolume} liveCalPerKg={liveCalPerKg} liveProtPerKg={liveProtPerKg} liveInfusionRate={liveInfusionRate} liveBMI={liveBMI} peripheralSafe={peripheralSafe} tr={tr} />
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            {formTab !== 'summary' && (
              <Button variant="secondary" onClick={() => {
                const idx = FORM_TABS.findIndex(t => t.key === formTab);
                if (idx < FORM_TABS.length - 1) setFormTab(FORM_TABS[idx + 1].key);
              }}>
                {tr('التالي', 'Next')}
              </Button>
            )}
            {formTab === 'summary' && (
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? tr('جاري الحفظ...', 'Saving...') : editingId ? tr('تحديث الأمر', 'Update Order') : tr('إنشاء الأمر', 'Create Order')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Order Dialog */}
      <Dialog open={!!viewOrder} onOpenChange={open => { if (!open) setViewOrder(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr('تفاصيل أمر TPN', 'TPN Order Details')}</DialogTitle>
            <DialogDescription>{fmtDate(viewOrder?.orderDate)}</DialogDescription>
          </DialogHeader>
          {viewOrder && <ViewOrderContent order={viewOrder} onVerify={handleVerify} onStatusChange={handleStatusChange} tr={tr} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// KPI Card
// =============================================================================

function KPICard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: string | number; color: string; bg: string }) {
  return (
    <Card className={bg}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs font-medium truncate">{label}</span>
        </div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Tab 1: Patient Info
// =============================================================================

function PatientInfoTab({ form, updateForm, liveBMI, liveInfusionRate, tr }: {
  form: TpnForm; updateForm: (f: string, v: any) => void; liveBMI: number; liveInfusionRate: number; tr: (a: string, e: string) => string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>{tr('معرف المريض', 'Patient ID')} *</Label>
          <Input value={form.patientMasterId} onChange={e => updateForm('patientMasterId', e.target.value)} placeholder={tr('معرف المريض', 'Patient Master ID')} />
        </div>
        <div className="space-y-1.5">
          <Label>{tr('معرف الحلقة', 'Episode ID')}</Label>
          <Input value={form.episodeId} onChange={e => updateForm('episodeId', e.target.value)} placeholder={tr('اختياري', 'Optional')} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label>{tr('الوزن (كغ)', 'Weight (kg)')} *</Label>
          <Input type="number" min={0} step={0.1} value={form.weight || ''} onChange={e => updateForm('weight', parseFloat(e.target.value) || 0)} />
        </div>
        <div className="space-y-1.5">
          <Label>{tr('الطول (سم)', 'Height (cm)')}</Label>
          <Input type="number" min={0} step={0.1} value={form.height || ''} onChange={e => updateForm('height', parseFloat(e.target.value) || 0)} />
        </div>
        <div className="space-y-1.5">
          <Label>{tr('مؤشر كتلة الجسم', 'BMI')}</Label>
          <div className="h-9 flex items-center px-3 bg-muted rounded-md text-sm font-medium">
            {liveBMI > 0 ? liveBMI : '---'}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{tr('معدل التسريب', 'Infusion Rate')}</Label>
          <div className="h-9 flex items-center px-3 bg-muted rounded-md text-sm font-medium">
            {liveInfusionRate > 0 ? `${liveInfusionRate} mL/hr` : '---'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label>{tr('هدف السعرات (سعرة/كغ/يوم)', 'Caloric Target (kcal/kg/day)')}</Label>
          <Input type="number" min={0} step={0.5} value={form.caloricTarget || ''} onChange={e => updateForm('caloricTarget', parseFloat(e.target.value) || 0)} />
        </div>
        <div className="space-y-1.5">
          <Label>{tr('هدف البروتين (غ/كغ/يوم)', 'Protein Target (g/kg/day)')}</Label>
          <Input type="number" min={0} step={0.1} value={form.proteinTarget || ''} onChange={e => updateForm('proteinTarget', parseFloat(e.target.value) || 0)} />
        </div>
        <div className="space-y-1.5">
          <Label>{tr('نوع المنفذ', 'Access Type')}</Label>
          <Select value={form.accessType} onValueChange={v => updateForm('accessType', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACCESS_TYPES.map(at => (
                <SelectItem key={at.value} value={at.value}>
                  {tr(at.labelAr, at.label)} ({tr('حد', 'max')} {at.maxOsmolarity} mOsm/L)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{tr('ساعات التسريب', 'Infusion Hours')}</Label>
          <Input type="number" min={8} max={24} value={form.infusionHours} onChange={e => updateForm('infusionHours', parseInt(e.target.value) || 24)} />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Tab 2: Macronutrients
// =============================================================================

function MacronutrientsTab({ form, updateForm, liveCalories, liveProtein, liveGIR, liveOsmolarity, liveTotalVolume, liveCalPerKg, liveProtPerKg, tr }: {
  form: TpnForm; updateForm: (f: string, v: any) => void;
  liveCalories: { dextroseKcal: number; aminoAcidKcal: number; lipidKcal: number; totalKcal: number };
  liveProtein: number; liveGIR: number; liveOsmolarity: number; liveTotalVolume: number; liveCalPerKg: number; liveProtPerKg: number;
  tr: (a: string, e: string) => string;
}) {
  return (
    <div className="space-y-6">
      {/* Dextrose */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Droplets className="h-4 w-4 text-amber-500" />
          {tr('الدكستروز', 'Dextrose')}
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{tr('التركيز', 'Concentration')}</Label>
            <Select value={form.dextroseConc} onValueChange={v => updateForm('dextroseConc', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEXTROSE_CONCENTRATIONS.map(d => (
                  <SelectItem key={d.value} value={d.value}>
                    {tr(d.labelAr, d.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{tr('الحجم (مل)', 'Volume (mL)')}</Label>
            <Input type="number" min={0} step={50} value={form.dextroseVol || ''} onChange={e => updateForm('dextroseVol', parseFloat(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{tr('السعرات', 'Calories')}</Label>
            <div className="h-9 flex items-center px-3 bg-amber-50 dark:bg-amber-900/20 rounded-md text-sm font-bold text-amber-700 dark:text-amber-300">
              {liveCalories.dextroseKcal} kcal
            </div>
          </div>
        </div>
      </div>

      {/* Amino Acids */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Pill className="h-4 w-4 text-blue-500" />
          {tr('الأحماض الأمينية', 'Amino Acids')}
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{tr('التركيز', 'Concentration')}</Label>
            <Select value={form.aminoAcidConc} onValueChange={v => updateForm('aminoAcidConc', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AMINO_ACID_CONCENTRATIONS.map(a => (
                  <SelectItem key={a.value} value={a.value}>
                    {tr(a.labelAr, a.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{tr('الحجم (مل)', 'Volume (mL)')}</Label>
            <Input type="number" min={0} step={50} value={form.aminoAcidVol || ''} onChange={e => updateForm('aminoAcidVol', parseFloat(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{tr('البروتين / السعرات', 'Protein / Calories')}</Label>
            <div className="h-9 flex items-center px-3 bg-blue-50 dark:bg-blue-900/20 rounded-md text-sm font-bold text-blue-700 dark:text-blue-300">
              {liveProtein}g / {liveCalories.aminoAcidKcal} kcal
            </div>
          </div>
        </div>
      </div>

      {/* Lipids */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Droplets className="h-4 w-4 text-green-500" />
          {tr('الدهون', 'Lipids')}
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{tr('التركيز', 'Concentration')}</Label>
            <Select value={form.lipidConc} onValueChange={v => updateForm('lipidConc', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIPID_CONCENTRATIONS.map(l => (
                  <SelectItem key={l.value} value={l.value}>
                    {tr(l.labelAr, l.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{tr('الحجم (مل) — 0 لعدم الإضافة', 'Volume (mL) - 0 for none')}</Label>
            <Input type="number" min={0} step={50} value={form.lipidVol || ''} onChange={e => updateForm('lipidVol', parseFloat(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{tr('السعرات', 'Calories')}</Label>
            <div className="h-9 flex items-center px-3 bg-green-50 dark:bg-green-900/20 rounded-md text-sm font-bold text-green-700 dark:text-green-300">
              {liveCalories.lipidKcal} kcal
            </div>
          </div>
        </div>
      </div>

      {/* Summary totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg border bg-muted/30">
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">{tr('إجمالي الحجم', 'Total Volume')}</p>
          <p className="text-lg font-bold">{liveTotalVolume} mL</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">{tr('إجمالي السعرات', 'Total Calories')}</p>
          <p className="text-lg font-bold">{liveCalories.totalKcal} kcal</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">{tr('سعرات/كغ', 'Cal/kg')}</p>
          <p className="text-lg font-bold">{liveCalPerKg}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">{tr('بروتين/كغ', 'Protein/kg')}</p>
          <p className="text-lg font-bold">{liveProtPerKg} g</p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Tab 3: Electrolytes
// =============================================================================

function ElectrolytesTab({ form, updateElectrolyte, tr }: {
  form: TpnForm; updateElectrolyte: (i: number, v: number) => void; tr: (a: string, e: string) => string;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Activity className="h-4 w-4 text-teal-500" />
        {tr('الأملاح والإلكتروليتات', 'Electrolytes')}
      </h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">{tr('الاسم', 'Name')}</TableHead>
              <TableHead className="text-center">{tr('الكمية', 'Amount')}</TableHead>
              <TableHead className="text-center">{tr('الوحدة', 'Unit')}</TableHead>
              <TableHead className="text-center">{tr('النطاق الموصى به', 'Recommended Range')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {form.electrolytes.map((elec, idx) => {
              const def = STANDARD_ELECTROLYTES[idx];
              const rangeText = def.perKg
                ? `${def.defaultMin}-${def.defaultMax} ${def.unit}/kg/${tr('يوم', 'day')}`
                : `${def.defaultMin}-${def.defaultMax} ${def.unit}/${tr('يوم', 'day')}`;
              return (
                <TableRow key={elec.name}>
                  <TableCell className="font-medium">
                    {tr(def.nameAr, def.name)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={elec.amount || ''}
                      onChange={e => updateElectrolyte(idx, parseFloat(e.target.value) || 0)}
                      className="w-24 mx-auto text-center"
                    />
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">{def.unit}</TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">{rangeText}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// =============================================================================
// Tab 4: Vitamins & Trace Elements
// =============================================================================

function VitaminsTraceTab({ form, updateForm, tr }: {
  form: TpnForm; updateForm: (f: string, v: any) => void; tr: (a: string, e: string) => string;
}) {
  const toggleVitamin = (idx: number) => {
    const next = [...form.vitamins];
    next[idx] = { ...next[idx], enabled: !next[idx].enabled };
    updateForm('vitamins', next);
  };
  const updateVitaminAmount = (idx: number, amount: string) => {
    const next = [...form.vitamins];
    next[idx] = { ...next[idx], amount };
    updateForm('vitamins', next);
  };
  const toggleTraceElement = (idx: number) => {
    const next = [...form.traceElements];
    next[idx] = { ...next[idx], enabled: !next[idx].enabled };
    updateForm('traceElements', next);
  };
  const updateTraceAmount = (idx: number, amount: string) => {
    const next = [...form.traceElements];
    next[idx] = { ...next[idx], amount };
    updateForm('traceElements', next);
  };

  return (
    <div className="space-y-6">
      {/* Vitamins */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Pill className="h-4 w-4 text-orange-500" />
            {tr('الفيتامينات', 'Vitamins')}
          </h3>
          <div className="flex items-center gap-2">
            <Checkbox
              id="stdVitamins"
              checked={form.standardVitamins}
              onCheckedChange={v => updateForm('standardVitamins', v)}
            />
            <Label htmlFor="stdVitamins" className="text-xs cursor-pointer">
              {tr('حزمة الفيتامينات القياسية (MVI)', 'Standard Multivitamin (MVI)')}
            </Label>
          </div>
        </div>
        <div className="space-y-2">
          {STANDARD_VITAMINS.map((vit, idx) => {
            const formVit = form.vitamins[idx];
            return (
              <div key={vit.name} className="flex items-center gap-3 p-2 rounded border bg-card">
                <Checkbox
                  checked={formVit?.enabled || form.standardVitamins}
                  onCheckedChange={() => toggleVitamin(idx)}
                  disabled={form.standardVitamins}
                />
                <span className="text-sm flex-1 min-w-[180px]">
                  {tr(vit.nameAr, vit.name)}
                </span>
                <Input
                  type="text"
                  value={formVit?.amount || vit.standardDose}
                  onChange={e => updateVitaminAmount(idx, e.target.value)}
                  className="w-20 text-center text-sm"
                  disabled={!formVit?.enabled && !form.standardVitamins}
                />
                <span className="text-xs text-muted-foreground w-10">{vit.unit}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trace Elements */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-teal-500" />
            {tr('العناصر النادرة', 'Trace Elements')}
          </h3>
          <div className="flex items-center gap-2">
            <Checkbox
              id="stdTrace"
              checked={form.standardTraceElements}
              onCheckedChange={v => updateForm('standardTraceElements', v)}
            />
            <Label htmlFor="stdTrace" className="text-xs cursor-pointer">
              {tr('حزمة العناصر النادرة القياسية', 'Standard Trace Elements Package')}
            </Label>
          </div>
        </div>
        <div className="space-y-2">
          {STANDARD_TRACE_ELEMENTS.map((te, idx) => {
            const formTe = form.traceElements[idx];
            return (
              <div key={te.name} className="flex items-center gap-3 p-2 rounded border bg-card">
                <Checkbox
                  checked={formTe?.enabled || form.standardTraceElements}
                  onCheckedChange={() => toggleTraceElement(idx)}
                  disabled={form.standardTraceElements}
                />
                <span className="text-sm flex-1 min-w-[180px]">
                  {tr(te.nameAr, te.name)}
                </span>
                <Input
                  type="text"
                  value={formTe?.amount || te.standardDose}
                  onChange={e => updateTraceAmount(idx, e.target.value)}
                  className="w-20 text-center text-sm"
                  disabled={!formTe?.enabled && !form.standardTraceElements}
                />
                <span className="text-xs text-muted-foreground w-10">{te.unit}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Tab 5: Additives & Monitoring
// =============================================================================

function AdditivesMonitoringTab({ form, updateForm, addAdditive, removeAdditive, updateAdditive, toggleLabMonitoring, tr }: {
  form: TpnForm;
  updateForm: (f: string, v: any) => void;
  addAdditive: () => void;
  removeAdditive: (i: number) => void;
  updateAdditive: (i: number, f: string, v: string) => void;
  toggleLabMonitoring: (t: string) => void;
  tr: (a: string, e: string) => string;
}) {
  return (
    <div className="space-y-6">
      {/* Additives */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{tr('الإضافات', 'Additives')}</h3>
          <Button variant="outline" size="sm" onClick={addAdditive}>
            <Plus className="h-3 w-3" />
            <span className="ml-1">{tr('إضافة', 'Add')}</span>
          </Button>
        </div>
        {form.additives.length === 0 && (
          <p className="text-sm text-muted-foreground">{tr('لا توجد إضافات (مثل: انسولين, هيبارين)', 'No additives (e.g. insulin, heparin)')}</p>
        )}
        {form.additives.map((additive, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              value={additive.name}
              onChange={e => updateAdditive(idx, 'name', e.target.value)}
              placeholder={tr('الاسم', 'Name')}
              className="flex-1"
            />
            <Input
              value={additive.amount}
              onChange={e => updateAdditive(idx, 'amount', e.target.value)}
              placeholder={tr('الكمية', 'Amount')}
              className="w-24"
            />
            <Input
              value={additive.unit}
              onChange={e => updateAdditive(idx, 'unit', e.target.value)}
              placeholder={tr('الوحدة', 'Unit')}
              className="w-24"
            />
            <Button variant="ghost" size="sm" onClick={() => removeAdditive(idx)}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ))}
      </div>

      {/* Lab Monitoring */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{tr('جدول مراقبة المختبر', 'Lab Monitoring Schedule')}</h3>
        <div className="space-y-2">
          {LAB_MONITORING_SCHEDULE.map(lab => (
            <div key={lab.test} className="flex items-center gap-3 p-2 rounded border bg-card">
              <Checkbox
                checked={form.labMonitoring.includes(lab.test)}
                onCheckedChange={() => toggleLabMonitoring(lab.test)}
              />
              <div className="flex-1">
                <span className="text-sm font-medium">{tr(lab.testAr, lab.test)}</span>
                <span className="text-xs text-muted-foreground block">{tr(lab.frequencyAr, lab.frequency)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compatibility check */}
      <div className="flex items-center gap-2 p-3 rounded border bg-card">
        <Checkbox
          id="compat"
          checked={form.compatibilityCheck}
          onCheckedChange={v => updateForm('compatibilityCheck', v)}
        />
        <Label htmlFor="compat" className="cursor-pointer">
          {tr('تم التحقق من التوافق الكيميائي', 'Compatibility check performed')}
        </Label>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label>{tr('ملاحظات', 'Notes')}</Label>
        <Textarea
          value={form.notes}
          onChange={e => updateForm('notes', e.target.value)}
          placeholder={tr('ملاحظات إضافية...', 'Additional notes...')}
          rows={3}
        />
      </div>
    </div>
  );
}

// =============================================================================
// Tab 6: Summary & Submit
// =============================================================================

function SummaryTab({ form, liveCalories, liveProtein, liveGIR, liveOsmolarity, liveTotalVolume, liveCalPerKg, liveProtPerKg, liveInfusionRate, liveBMI, peripheralSafe, tr }: {
  form: TpnForm;
  liveCalories: { dextroseKcal: number; aminoAcidKcal: number; lipidKcal: number; totalKcal: number };
  liveProtein: number; liveGIR: number; liveOsmolarity: number; liveTotalVolume: number;
  liveCalPerKg: number; liveProtPerKg: number; liveInfusionRate: number; liveBMI: number; peripheralSafe: boolean;
  tr: (a: string, e: string) => string;
}) {
  const dexConc = DEXTROSE_CONCENTRATIONS.find(d => d.value === form.dextroseConc);
  const aaConc = AMINO_ACID_CONCENTRATIONS.find(a => a.value === form.aminoAcidConc);
  const lipConc = LIPID_CONCENTRATIONS.find(l => l.value === form.lipidConc);
  const accessDef = ACCESS_TYPES.find(a => a.value === form.accessType);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">{tr('ملخص وصفة TPN', 'TPN Formula Summary')}</h3>

      {/* Patient */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded border bg-card">
        <div><span className="text-xs text-muted-foreground">{tr('المريض', 'Patient')}</span><p className="text-sm font-medium font-mono">{form.patientMasterId || '---'}</p></div>
        <div><span className="text-xs text-muted-foreground">{tr('الوزن', 'Weight')}</span><p className="text-sm font-medium">{form.weight} {tr('كغ', 'kg')}</p></div>
        <div><span className="text-xs text-muted-foreground">{tr('الطول', 'Height')}</span><p className="text-sm font-medium">{form.height ? `${form.height} cm` : '---'}</p></div>
        <div><span className="text-xs text-muted-foreground">{tr('م.ك.ج', 'BMI')}</span><p className="text-sm font-medium">{liveBMI || '---'}</p></div>
      </div>

      {/* Components */}
      <div className="rounded border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tr('المكون', 'Component')}</TableHead>
              <TableHead className="text-center">{tr('التركيز', 'Concentration')}</TableHead>
              <TableHead className="text-center">{tr('الحجم', 'Volume')}</TableHead>
              <TableHead className="text-center">{tr('السعرات', 'Calories')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">{tr('دكستروز', 'Dextrose')}</TableCell>
              <TableCell className="text-center">{dexConc ? tr(dexConc.labelAr, dexConc.label) : '---'}</TableCell>
              <TableCell className="text-center">{form.dextroseVol} mL</TableCell>
              <TableCell className="text-center font-medium">{liveCalories.dextroseKcal} kcal</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">{tr('أحماض أمينية', 'Amino Acids')}</TableCell>
              <TableCell className="text-center">{aaConc ? tr(aaConc.labelAr, aaConc.label) : '---'}</TableCell>
              <TableCell className="text-center">{form.aminoAcidVol} mL</TableCell>
              <TableCell className="text-center font-medium">{liveCalories.aminoAcidKcal} kcal</TableCell>
            </TableRow>
            {form.lipidVol > 0 && (
              <TableRow>
                <TableCell className="font-medium">{tr('دهون', 'Lipids')}</TableCell>
                <TableCell className="text-center">{lipConc ? tr(lipConc.labelAr, lipConc.label) : '---'}</TableCell>
                <TableCell className="text-center">{form.lipidVol} mL</TableCell>
                <TableCell className="text-center font-medium">{liveCalories.lipidKcal} kcal</TableCell>
              </TableRow>
            )}
            <TableRow className="bg-muted/50 font-bold">
              <TableCell>{tr('الإجمالي', 'TOTAL')}</TableCell>
              <TableCell />
              <TableCell className="text-center">{liveTotalVolume} mL</TableCell>
              <TableCell className="text-center">{liveCalories.totalKcal} kcal</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Calculated values */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded border bg-card">
        <div>
          <span className="text-xs text-muted-foreground">{tr('بروتين إجمالي', 'Total Protein')}</span>
          <p className="text-sm font-bold">{liveProtein} g ({liveProtPerKg} g/kg)</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">{tr('معدل التسريب', 'Infusion Rate')}</span>
          <p className="text-sm font-bold">{liveInfusionRate} mL/hr ({form.infusionHours}h)</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">GIR</span>
          <p className={`text-sm font-bold ${liveGIR > 5 ? 'text-red-600' : 'text-green-600'}`}>
            {liveGIR} mg/kg/min {liveGIR > 5 ? '(!!)' : ''}
          </p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">{tr('أوسمولارية', 'Osmolarity')}</span>
          <p className={`text-sm font-bold ${!peripheralSafe && form.accessType === 'PERIPHERAL' ? 'text-red-600' : ''}`}>
            {liveOsmolarity} mOsm/L
          </p>
        </div>
      </div>

      {/* Access type and safety checks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 rounded border bg-card">
          <span className="text-xs text-muted-foreground">{tr('نوع المنفذ', 'Access Type')}</span>
          <p className="text-sm font-bold">{accessDef ? tr(accessDef.labelAr, accessDef.label) : form.accessType}</p>
        </div>
        <div className={`p-3 rounded border ${peripheralSafe || form.accessType === 'CENTRAL' ? 'bg-green-50 dark:bg-green-900/20 border-green-200' : 'bg-red-50 dark:bg-red-900/20 border-red-200'}`}>
          <span className="text-xs text-muted-foreground">{tr('فحص السلامة', 'Safety Check')}</span>
          {form.accessType === 'CENTRAL' ? (
            <p className="text-sm font-bold text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              {tr('خط مركزي - آمن', 'Central line - Safe')}
            </p>
          ) : peripheralSafe ? (
            <p className="text-sm font-bold text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              {tr('أوسمولارية آمنة للوريد الطرفي', 'Osmolarity safe for peripheral IV')}
            </p>
          ) : (
            <p className="text-sm font-bold text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              {tr('أوسمولارية عالية - غير آمن للوريد الطرفي!', 'High osmolarity - Unsafe for peripheral IV!')}
            </p>
          )}
        </div>
      </div>

      {/* Electrolytes summary */}
      {form.electrolytes.filter(e => e.amount > 0).length > 0 && (
        <div className="p-3 rounded border bg-card space-y-1">
          <span className="text-xs text-muted-foreground font-medium">{tr('الأملاح', 'Electrolytes')}</span>
          <div className="flex flex-wrap gap-2">
            {form.electrolytes.filter(e => e.amount > 0).map(e => {
              const def = STANDARD_ELECTROLYTES.find(d => d.name === e.name);
              return (
                <Badge key={e.name} variant="outline" className="text-xs">
                  {def ? tr(def.nameAr, def.name) : e.name}: {e.amount} {def?.unit || ''}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Compatibility & notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 rounded border bg-card">
          <span className="text-xs text-muted-foreground">{tr('فحص التوافق', 'Compatibility Check')}</span>
          <p className="text-sm font-bold flex items-center gap-1">
            {form.compatibilityCheck ? (
              <><CheckCircle2 className="h-4 w-4 text-green-600" /> {tr('تم', 'Done')}</>
            ) : (
              <><X className="h-4 w-4 text-muted-foreground" /> {tr('لم يتم', 'Not done')}</>
            )}
          </p>
        </div>
        {form.notes && (
          <div className="p-3 rounded border bg-card">
            <span className="text-xs text-muted-foreground">{tr('ملاحظات', 'Notes')}</span>
            <p className="text-sm">{form.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// View Order Content
// =============================================================================

function ViewOrderContent({ order, onVerify, onStatusChange, tr }: {
  order: any;
  onVerify: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  tr: (a: string, e: string) => string;
}) {
  const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.DRAFT;
  const accessDef = ACCESS_TYPES.find(a => a.value === order.accessType);

  return (
    <div className="space-y-4">
      {/* Status and verification */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge className={`${sc.bg} ${sc.color} border-0`}>{tr(sc.ar, sc.en)}</Badge>
        {order.pharmacistVerified ? (
          <Badge className="bg-green-100 dark:bg-green-900/30 text-green-600 border-0">
            <Shield className="h-3 w-3 mr-1" />
            {tr('تحقق الصيدلي', 'Pharmacist Verified')}
          </Badge>
        ) : (
          <Button variant="outline" size="sm" onClick={() => onVerify(order.id)}>
            <ClipboardCheck className="h-4 w-4 mr-1" />
            {tr('تحقق الصيدلي', 'Verify as Pharmacist')}
          </Button>
        )}
        {order.status === 'DRAFT' && (
          <Button variant="outline" size="sm" onClick={() => onStatusChange(order.id, 'ACTIVE')} className="text-green-600">
            <CheckCircle2 className="h-4 w-4 mr-1" /> {tr('تفعيل', 'Activate')}
          </Button>
        )}
        {order.status === 'ACTIVE' && (
          <Button variant="outline" size="sm" onClick={() => onStatusChange(order.id, 'COMPLETED')} className="text-blue-600">
            <CheckCircle2 className="h-4 w-4 mr-1" /> {tr('إكمال', 'Complete')}
          </Button>
        )}
      </div>

      {/* Patient info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded border bg-card">
        <div><span className="text-xs text-muted-foreground">{tr('المريض', 'Patient')}</span><p className="text-sm font-medium font-mono">{order.patientMasterId?.slice(0, 12)}...</p></div>
        <div><span className="text-xs text-muted-foreground">{tr('الوزن', 'Weight')}</span><p className="text-sm font-medium">{order.weight} {tr('كغ', 'kg')}</p></div>
        <div><span className="text-xs text-muted-foreground">{tr('المنفذ', 'Access')}</span><p className="text-sm font-medium">{accessDef ? tr(accessDef.labelAr, accessDef.label) : order.accessType}</p></div>
        <div><span className="text-xs text-muted-foreground">{tr('م.ك.ج', 'BMI')}</span><p className="text-sm font-medium">{order.bmi || '---'}</p></div>
      </div>

      {/* Calculated values */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 p-3 rounded border bg-muted/30">
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">{tr('الحجم', 'Volume')}</p>
          <p className="text-sm font-bold">{order.totalVolume} mL</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">{tr('سعرات', 'Calories')}</p>
          <p className="text-sm font-bold">{order.totalCalories} kcal</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">{tr('بروتين', 'Protein')}</p>
          <p className="text-sm font-bold">{order.totalProtein}g</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">{tr('سعرات/كغ', 'Cal/kg')}</p>
          <p className="text-sm font-bold">{order.caloriesPerKg}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">GIR</p>
          <p className={`text-sm font-bold ${(order.glucoseInfusionRate || 0) > 5 ? 'text-red-600' : ''}`}>{order.glucoseInfusionRate}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">{tr('أوسمولارية', 'Osmolarity')}</p>
          <p className="text-sm font-bold">{order.osmolarity}</p>
        </div>
      </div>

      {/* Components breakdown */}
      <div className="rounded border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tr('المكون', 'Component')}</TableHead>
              <TableHead className="text-center">{tr('التفاصيل', 'Details')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">{tr('دكستروز', 'Dextrose')}</TableCell>
              <TableCell className="text-center">
                {order.dextrose?.concentration}% - {order.dextrose?.volume} mL
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">{tr('أحماض أمينية', 'Amino Acids')}</TableCell>
              <TableCell className="text-center">
                {order.aminoAcids?.concentration}% - {order.aminoAcids?.volume} mL
              </TableCell>
            </TableRow>
            {order.lipids?.volume > 0 && (
              <TableRow>
                <TableCell className="font-medium">{tr('دهون', 'Lipids')}</TableCell>
                <TableCell className="text-center">
                  {order.lipids?.concentration}% - {order.lipids?.volume} mL
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Electrolytes */}
      {Array.isArray(order.electrolytes) && order.electrolytes.length > 0 && (
        <div className="p-3 rounded border bg-card space-y-1">
          <span className="text-xs text-muted-foreground font-medium">{tr('الأملاح', 'Electrolytes')}</span>
          <div className="flex flex-wrap gap-2">
            {order.electrolytes.map((e: any, i: number) => (
              <Badge key={i} variant="outline" className="text-xs">
                {e.name}: {e.amount} {e.unit || ''}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Infusion details */}
      <div className="grid grid-cols-2 gap-3 p-3 rounded border bg-card">
        <div>
          <span className="text-xs text-muted-foreground">{tr('معدل التسريب', 'Infusion Rate')}</span>
          <p className="text-sm font-bold">{order.infusionRate} mL/hr</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">{tr('ساعات التسريب', 'Infusion Hours')}</span>
          <p className="text-sm font-bold">{order.infusionHours}h</p>
        </div>
      </div>

      {/* Verification info */}
      {order.pharmacistVerified && (
        <div className="p-3 rounded border bg-green-50 dark:bg-green-900/20 border-green-200">
          <span className="text-xs text-muted-foreground">{tr('التحقق', 'Verification')}</span>
          <p className="text-sm font-medium text-green-700 dark:text-green-300 flex items-center gap-1">
            <Shield className="h-4 w-4" />
            {tr('تم التحقق بواسطة الصيدلي', 'Pharmacist verified')}
            {order.verifiedAt ? ` — ${fmtDate(order.verifiedAt)}` : ''}
          </p>
        </div>
      )}

      {/* Notes */}
      {order.notes && (
        <div className="p-3 rounded border bg-card">
          <span className="text-xs text-muted-foreground">{tr('ملاحظات', 'Notes')}</span>
          <p className="text-sm mt-1">{order.notes}</p>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 rounded border bg-card text-sm">
        <div><span className="text-xs text-muted-foreground">{tr('تاريخ الأمر', 'Order Date')}</span><p className="font-medium">{fmtDate(order.orderDate)}</p></div>
        {order.startDate && <div><span className="text-xs text-muted-foreground">{tr('تاريخ البدء', 'Start Date')}</span><p className="font-medium">{fmtDate(order.startDate)}</p></div>}
        {order.endDate && <div><span className="text-xs text-muted-foreground">{tr('تاريخ الانتهاء', 'End Date')}</span><p className="font-medium">{fmtDate(order.endDate)}</p></div>}
      </div>
    </div>
  );
}
