'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

// ---------------------------------------------------------------------------
// Config Maps (bilingual)
// ---------------------------------------------------------------------------

const URGENCY_CONFIG: Record<string, { ar: string; en: string; color: string; sort: number }> = {
  stat: { ar: 'طارئ', en: 'STAT', color: 'bg-red-100 text-red-800 border-red-300', sort: 0 },
  urgent: { ar: 'عاجل', en: 'Urgent', color: 'bg-orange-100 text-orange-800 border-orange-300', sort: 1 },
  routine: { ar: 'روتيني', en: 'Routine', color: 'bg-blue-100 text-blue-800 border-blue-300', sort: 2 },
  scheduled: { ar: 'مجدول', en: 'Scheduled', color: 'bg-muted text-foreground border-border', sort: 3 },
};

const STATUS_CONFIG: Record<string, { ar: string; en: string; color: string }> = {
  pending: { ar: 'معلق', en: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  assigned: { ar: 'مُعيّن', en: 'Assigned', color: 'bg-blue-100 text-blue-800' },
  in_transit: { ar: 'في الطريق', en: 'In Transit', color: 'bg-purple-100 text-purple-800' },
  completed: { ar: 'مكتمل', en: 'Completed', color: 'bg-green-100 text-green-800' },
  cancelled: { ar: 'ملغي', en: 'Cancelled', color: 'bg-red-100 text-red-800' },
};

const MODE_CONFIG: Record<string, { ar: string; en: string }> = {
  wheelchair: { ar: 'كرسي متحرك', en: 'Wheelchair' },
  stretcher: { ar: 'نقالة', en: 'Stretcher' },
  bed: { ar: 'سرير', en: 'Bed' },
  ambulatory: { ar: 'مشي', en: 'Ambulatory' },
  ambulance: { ar: 'إسعاف', en: 'Ambulance' },
  neonatal_isolette: { ar: 'حاضنة أطفال', en: 'Neonatal Isolette' },
};

const REQUEST_TYPE_CONFIG: Record<string, { ar: string; en: string }> = {
  intra_facility: { ar: 'داخل المنشأة', en: 'Intra-Facility' },
  inter_facility: { ar: 'بين المنشآت', en: 'Inter-Facility' },
  ambulance: { ar: 'إسعاف', en: 'Ambulance' },
  discharge: { ar: 'خروج', en: 'Discharge' },
};

const STAFF_STATUS_CONFIG: Record<string, { ar: string; en: string; color: string }> = {
  available: { ar: 'متاح', en: 'Available', color: 'bg-green-100 text-green-800' },
  busy: { ar: 'مشغول', en: 'Busy', color: 'bg-red-100 text-red-800' },
  off_duty: { ar: 'خارج الخدمة', en: 'Off Duty', color: 'bg-muted text-muted-foreground' },
  break: { ar: 'استراحة', en: 'On Break', color: 'bg-yellow-100 text-yellow-800' },
};

const ISOLATION_TYPE_CONFIG: Record<string, { ar: string; en: string }> = {
  contact: { ar: 'تلامسي', en: 'Contact' },
  droplet: { ar: 'رذاذ', en: 'Droplet' },
  airborne: { ar: 'هوائي', en: 'Airborne' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type TabKey = 'board' | 'new' | 'staff' | 'metrics' | 'history';

export default function TransportDashboard() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>('board');
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [assignDialog, setAssignDialog] = useState<{ requestId: string; requestOrigin: string } | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [cancelDialog, setCancelDialog] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [detailDialog, setDetailDialog] = useState<any | null>(null);

  // New staff form
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({ userId: '', name: '', nameAr: '', phone: '', zone: '' });

  // New request form
  const [requestForm, setRequestForm] = useState({
    patientId: '',
    patientName: '',
    encounterId: '',
    requestType: 'intra_facility' as string,
    urgency: 'routine' as string,
    origin: '',
    originDetails: '',
    destination: '',
    destinationDetails: '',
    transportMode: 'wheelchair' as string,
    oxygenRequired: false,
    monitorRequired: false,
    ivPumpRequired: false,
    isolationRequired: false,
    isolationType: '' as string,
    nurseEscort: false,
    specialInstructions: '',
    notes: '',
  });

  // Data fetching
  const { data: activeData, mutate: mutateActive } = useSWR(
    '/api/transport/requests?status=pending&limit=200',
    fetcher,
    { refreshInterval: 10000 },
  );
  const { data: assignedData, mutate: mutateAssigned } = useSWR(
    '/api/transport/requests?status=assigned&limit=200',
    fetcher,
    { refreshInterval: 10000 },
  );
  const { data: transitData, mutate: mutateTransit } = useSWR(
    '/api/transport/requests?status=in_transit&limit=200',
    fetcher,
    { refreshInterval: 10000 },
  );
  const { data: historyData, mutate: mutateHistory } = useSWR(
    activeTab === 'history'
      ? `/api/transport/requests?${statusFilter ? `status=${statusFilter}&` : ''}${urgencyFilter ? `urgency=${urgencyFilter}&` : ''}limit=100`
      : null,
    fetcher,
  );
  const { data: staffData, mutate: mutateStaff } = useSWR(
    '/api/transport/staff?workload=true',
    fetcher,
    { refreshInterval: 15000 },
  );
  const { data: metricsData } = useSWR(
    activeTab === 'metrics' ? '/api/transport/metrics' : null,
    fetcher,
  );
  const { data: escalationData } = useSWR(
    '/api/transport/requests?escalation=true',
    fetcher,
    { refreshInterval: 30000 },
  );

  const pendingItems: any[] = Array.isArray(activeData?.items) ? activeData.items : [];
  const assignedItems: any[] = Array.isArray(assignedData?.items) ? assignedData.items : [];
  const transitItems: any[] = Array.isArray(transitData?.items) ? transitData.items : [];
  const historyItems: any[] = Array.isArray(historyData?.items) ? historyData.items : [];
  const staffList: any[] = Array.isArray(staffData?.staff) ? staffData.staff : [];
  const metrics = metricsData?.metrics;
  const escalated: any[] = Array.isArray(escalationData?.escalated) ? escalationData.escalated : [];

  const mutateAll = useCallback(() => {
    mutateActive();
    mutateAssigned();
    mutateTransit();
    mutateStaff();
  }, [mutateActive, mutateAssigned, mutateTransit, mutateStaff]);

  // Update status helper
  const handleStatusUpdate = async (id: string, status: string, reason?: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/transport/requests/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, cancelReason: reason }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: tr('خطأ', 'Error'), description: json.error, variant: 'destructive' });
        return;
      }
      toast({ title: tr('تم التحديث', 'Updated') });
      mutateAll();
    } catch {
      toast({ title: tr('فشل', 'Failed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  // Assign transporter
  const handleAssign = async () => {
    if (!assignDialog || !selectedStaffId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/transport/requests/${assignDialog.requestId}/assign`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: selectedStaffId }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: tr('خطأ', 'Error'), description: json.error, variant: 'destructive' });
        return;
      }
      toast({ title: tr('تم التعيين', 'Assigned') });
      setAssignDialog(null);
      setSelectedStaffId('');
      mutateAll();
    } catch {
      toast({ title: tr('فشل', 'Failed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  // Create new request
  const handleCreateRequest = async () => {
    if (!requestForm.patientId || !requestForm.origin || !requestForm.destination) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('المريض والمصدر والوجهة مطلوبة', 'Patient, origin and destination are required'),
        variant: 'destructive',
      });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...requestForm,
        isolationType: requestForm.isolationRequired ? requestForm.isolationType || undefined : undefined,
      };
      const res = await fetch('/api/transport/requests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: tr('خطأ', 'Error'), description: json.error, variant: 'destructive' });
        return;
      }

      // Show isolation alert if present
      if (json.isolationAlert) {
        toast({
          title: tr('تنبيه عزل', 'Isolation Alert'),
          description: tr(json.isolationAlert.messageAr, json.isolationAlert.message),
          variant: 'destructive',
        });
      } else {
        toast({ title: tr('تم إنشاء الطلب', 'Request Created') });
      }

      // Reset form
      setRequestForm({
        patientId: '',
        patientName: '',
        encounterId: '',
        requestType: 'intra_facility',
        urgency: 'routine',
        origin: '',
        originDetails: '',
        destination: '',
        destinationDetails: '',
        transportMode: 'wheelchair',
        oxygenRequired: false,
        monitorRequired: false,
        ivPumpRequired: false,
        isolationRequired: false,
        isolationType: '',
        nurseEscort: false,
        specialInstructions: '',
        notes: '',
      });
      setActiveTab('board');
      mutateAll();
    } catch {
      toast({ title: tr('فشل الإنشاء', 'Creation Failed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  // Add staff
  const handleAddStaff = async () => {
    if (!staffForm.userId || !staffForm.name) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('معرف المستخدم والاسم مطلوبان', 'User ID and name are required'),
        variant: 'destructive',
      });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/transport/staff', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffForm),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: tr('خطأ', 'Error'), description: json.error, variant: 'destructive' });
        return;
      }
      toast({ title: tr('تمت الإضافة', 'Staff Added') });
      setShowAddStaff(false);
      setStaffForm({ userId: '', name: '', nameAr: '', phone: '', zone: '' });
      mutateStaff();
    } catch {
      toast({ title: tr('فشل', 'Failed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  // Update staff status
  const handleStaffStatusUpdate = async (staffId: string, status: string) => {
    setBusy(true);
    try {
      const res = await fetch('/api/transport/staff', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, status }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast({ title: tr('خطأ', 'Error'), description: json.error, variant: 'destructive' });
        return;
      }
      mutateStaff();
      mutateAll();
    } catch {
      toast({ title: tr('فشل', 'Failed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  // Cancel handler
  const handleCancel = () => {
    if (!cancelDialog) return;
    handleStatusUpdate(cancelDialog, 'cancelled', cancelReason);
    setCancelDialog(null);
    setCancelReason('');
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderUrgencyBadge = (urgency: string) => {
    const cfg = URGENCY_CONFIG[urgency] || URGENCY_CONFIG.routine;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cfg.color}`}>
        {tr(cfg.ar, cfg.en)}
      </span>
    );
  };

  const renderStatusBadge = (status: string) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
        {tr(cfg.ar, cfg.en)}
      </span>
    );
  };

  const renderTransportCard = (item: any, showActions = true) => {
    const isStatOverdue =
      item.urgency === 'stat' &&
      item.status === 'pending' &&
      Date.now() - new Date(item.createdAt).getTime() > 5 * 60 * 1000;

    return (
      <div
        key={item.id}
        className={`border rounded-lg p-3 mb-2 cursor-pointer transition hover:shadow-md ${
          isStatOverdue ? 'border-red-500 bg-red-50 animate-pulse' : 'border-border bg-card'
        } ${item.isolationRequired ? 'ring-2 ring-amber-400' : ''}`}
        onClick={() => setDetailDialog(item)}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-sm truncate">
            {item.patientName || item.patientId}
          </span>
          {renderUrgencyBadge(item.urgency)}
        </div>

        <div className="text-xs text-muted-foreground mb-1">
          <span className="font-medium">{item.origin}</span>
          {' → '}
          <span className="font-medium">{item.destination}</span>
        </div>

        <div className="flex items-center gap-1 flex-wrap text-xs mb-2">
          <span className="text-muted-foreground">
            {MODE_CONFIG[item.transportMode]
              ? tr(MODE_CONFIG[item.transportMode].ar, MODE_CONFIG[item.transportMode].en)
              : item.transportMode}
          </span>
          {item.oxygenRequired && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">O2</Badge>
          )}
          {item.monitorRequired && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">{tr('مونيتور', 'Monitor')}</Badge>
          )}
          {item.ivPumpRequired && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">IV</Badge>
          )}
          {item.isolationRequired && (
            <Badge variant="destructive" className="text-[10px] px-1 py-0">
              {tr('عزل', 'Isolation')}
              {item.isolationType && ` (${ISOLATION_TYPE_CONFIG[item.isolationType]
                ? tr(ISOLATION_TYPE_CONFIG[item.isolationType].ar, ISOLATION_TYPE_CONFIG[item.isolationType].en)
                : item.isolationType})`}
            </Badge>
          )}
          {item.nurseEscort && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0">{tr('مرافق تمريض', 'Nurse Escort')}</Badge>
          )}
        </div>

        {item.assignedToName && (
          <div className="text-xs text-muted-foreground">
            {tr('المُعيّن:', 'Assigned:')} {item.assignedToName}
          </div>
        )}

        {isStatOverdue && (
          <div className="text-xs font-semibold text-red-700 mt-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {tr(
              'تجاوز حد 5 دقائق — يحتاج تصعيد',
              'Exceeds 5-min threshold — escalation needed',
            )}
          </div>
        )}

        {showActions && (
          <div className="flex items-center gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
            {item.status === 'pending' && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs"
                  disabled={busy}
                  onClick={() => setAssignDialog({ requestId: item.id, requestOrigin: item.origin })}
                >
                  {tr('تعيين', 'Assign')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-red-600"
                  disabled={busy}
                  onClick={() => setCancelDialog(item.id)}
                >
                  {tr('إلغاء', 'Cancel')}
                </Button>
              </>
            )}
            {item.status === 'assigned' && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs"
                  disabled={busy}
                  onClick={() => handleStatusUpdate(item.id, 'in_transit')}
                >
                  {tr('بدء النقل', 'Start Transport')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-red-600"
                  disabled={busy}
                  onClick={() => setCancelDialog(item.id)}
                >
                  {tr('إلغاء', 'Cancel')}
                </Button>
              </>
            )}
            {item.status === 'in_transit' && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs bg-green-600 hover:bg-green-700"
                  disabled={busy}
                  onClick={() => handleStatusUpdate(item.id, 'completed')}
                >
                  {tr('وصل', 'Arrived')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-red-600"
                  disabled={busy}
                  onClick={() => setCancelDialog(item.id)}
                >
                  {tr('إلغاء', 'Cancel')}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Tab content
  // ---------------------------------------------------------------------------

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'board', label: tr('لوحة النقل', 'Active Board') },
    { key: 'new', label: tr('طلب جديد', 'New Request') },
    { key: 'staff', label: tr('الطاقم', 'Staff') },
    { key: 'metrics', label: tr('المؤشرات', 'Metrics') },
    { key: 'history', label: tr('السجل', 'History') },
  ];

  return (
    <div className="p-4 max-w-[1400px] mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{tr('إدارة نقل المرضى', 'Patient Transport Management')}</h1>
        {escalated.length > 0 && (
          <Badge variant="destructive" className="animate-bounce">
            {tr(`${escalated.length} طلب طارئ متأخر`, `${escalated.length} overdue STAT`)}
          </Badge>
        )}
      </div>

      {/* Stat escalation banner */}
      {escalated.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-3 mb-4">
          <p className="text-sm font-semibold text-red-800 mb-1">
            <AlertTriangle className="h-4 w-4 inline mr-1" />{tr('تصعيد: طلبات STAT معلقة أكثر من 5 دقائق', 'Escalation: STAT requests pending over 5 minutes')}
          </p>
          {escalated.map((e: any) => (
            <div key={e.id} className="text-xs text-red-700">
              {e.patientName || 'Unknown'} — {e.origin} → {e.destination} ({e.minutesPending} {tr('دقيقة', 'min')})
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ──────────────────────────────────────────────────── */}
      {/* Active Board Tab — Kanban columns */}
      {/* ──────────────────────────────────────────────────── */}
      {activeTab === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pending Column */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-sm">{tr('معلق', 'Pending')}</h3>
              <Badge variant="secondary">{pendingItems.length}</Badge>
            </div>
            <div className="bg-yellow-50/50 rounded-lg p-2 min-h-[200px]">
              {pendingItems.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">{tr('لا توجد طلبات', 'No requests')}</p>
              )}
              {pendingItems.map((item: any) => renderTransportCard(item))}
            </div>
          </div>

          {/* Assigned Column */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-sm">{tr('مُعيّن', 'Assigned')}</h3>
              <Badge variant="secondary">{assignedItems.length}</Badge>
            </div>
            <div className="bg-blue-50/50 rounded-lg p-2 min-h-[200px]">
              {assignedItems.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">{tr('لا توجد طلبات', 'No requests')}</p>
              )}
              {assignedItems.map((item: any) => renderTransportCard(item))}
            </div>
          </div>

          {/* In Transit Column */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-sm">{tr('في الطريق', 'In Transit')}</h3>
              <Badge variant="secondary">{transitItems.length}</Badge>
            </div>
            <div className="bg-purple-50/50 rounded-lg p-2 min-h-[200px]">
              {transitItems.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">{tr('لا توجد طلبات', 'No requests')}</p>
              )}
              {transitItems.map((item: any) => renderTransportCard(item))}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────── */}
      {/* New Request Tab */}
      {/* ──────────────────────────────────────────────────── */}
      {activeTab === 'new' && (
        <div className="max-w-2xl space-y-4">
          <h3 className="font-semibold mb-2">{tr('طلب نقل جديد', 'New Transport Request')}</h3>

          {/* Patient Info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{tr('معرف المريض *', 'Patient ID *')}</Label>
              <Input
                value={requestForm.patientId}
                onChange={(e) => setRequestForm((p) => ({ ...p, patientId: e.target.value }))}
                placeholder={tr('UUID المريض', 'Patient UUID')}
              />
            </div>
            <div>
              <Label>{tr('اسم المريض', 'Patient Name')}</Label>
              <Input
                value={requestForm.patientName}
                onChange={(e) => setRequestForm((p) => ({ ...p, patientName: e.target.value }))}
              />
            </div>
          </div>

          {/* Request Type & Urgency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{tr('نوع الطلب *', 'Request Type *')}</Label>
              <Select
                value={requestForm.requestType}
                onValueChange={(v) => setRequestForm((p) => ({ ...p, requestType: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REQUEST_TYPE_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{tr(v.ar, v.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tr('الأولوية *', 'Urgency *')}</Label>
              <Select
                value={requestForm.urgency}
                onValueChange={(v) => setRequestForm((p) => ({ ...p, urgency: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(URGENCY_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{tr(v.ar, v.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Origin & Destination */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{tr('من (المصدر) *', 'Origin *')}</Label>
              <Input
                value={requestForm.origin}
                onChange={(e) => setRequestForm((p) => ({ ...p, origin: e.target.value }))}
                placeholder={tr('جناح / قسم / غرفة', 'Ward / Unit / Room')}
              />
            </div>
            <div>
              <Label>{tr('إلى (الوجهة) *', 'Destination *')}</Label>
              <Input
                value={requestForm.destination}
                onChange={(e) => setRequestForm((p) => ({ ...p, destination: e.target.value }))}
                placeholder={tr('جناح / قسم / غرفة', 'Ward / Unit / Room')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{tr('تفاصيل المصدر', 'Origin Details')}</Label>
              <Input
                value={requestForm.originDetails}
                onChange={(e) => setRequestForm((p) => ({ ...p, originDetails: e.target.value }))}
              />
            </div>
            <div>
              <Label>{tr('تفاصيل الوجهة', 'Destination Details')}</Label>
              <Input
                value={requestForm.destinationDetails}
                onChange={(e) => setRequestForm((p) => ({ ...p, destinationDetails: e.target.value }))}
              />
            </div>
          </div>

          {/* Transport Mode */}
          <div>
            <Label>{tr('وسيلة النقل', 'Transport Mode')}</Label>
            <Select
              value={requestForm.transportMode}
              onValueChange={(v) => setRequestForm((p) => ({ ...p, transportMode: v }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(MODE_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{tr(v.ar, v.en)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Equipment & Safety Needs */}
          <div>
            <Label className="mb-2 block">{tr('المعدات والسلامة', 'Equipment & Safety')}</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={requestForm.oxygenRequired}
                  onChange={(e) => setRequestForm((p) => ({ ...p, oxygenRequired: e.target.checked }))}
                />
                {tr('أوكسجين', 'Oxygen')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={requestForm.monitorRequired}
                  onChange={(e) => setRequestForm((p) => ({ ...p, monitorRequired: e.target.checked }))}
                />
                {tr('مونيتور', 'Monitor')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={requestForm.ivPumpRequired}
                  onChange={(e) => setRequestForm((p) => ({ ...p, ivPumpRequired: e.target.checked }))}
                />
                {tr('مضخة وريدية', 'IV Pump')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={requestForm.nurseEscort}
                  onChange={(e) => setRequestForm((p) => ({ ...p, nurseEscort: e.target.checked }))}
                />
                {tr('مرافق تمريض', 'Nurse Escort')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={requestForm.isolationRequired}
                  onChange={(e) => setRequestForm((p) => ({ ...p, isolationRequired: e.target.checked }))}
                />
                <span className={requestForm.isolationRequired ? 'text-red-700 font-medium' : ''}>
                  {tr('عزل مطلوب', 'Isolation Required')}
                </span>
              </label>
            </div>
          </div>

          {/* Isolation Type (conditional) */}
          {requestForm.isolationRequired && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
              <p className="text-sm font-semibold text-amber-800 mb-2">
                <AlertTriangle className="h-4 w-4 inline mr-1" />{tr('تنبيه: المريض يحتاج احتياطات عزل', 'Alert: Patient requires isolation precautions')}
              </p>
              <Label>{tr('نوع العزل', 'Isolation Type')}</Label>
              <Select
                value={requestForm.isolationType}
                onValueChange={(v) => setRequestForm((p) => ({ ...p, isolationType: v }))}
              >
                <SelectTrigger><SelectValue placeholder={tr('اختر النوع', 'Select type')} /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ISOLATION_TYPE_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{tr(v.ar, v.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Special Instructions & Notes */}
          <div>
            <Label>{tr('تعليمات خاصة', 'Special Instructions')}</Label>
            <Textarea
              value={requestForm.specialInstructions}
              onChange={(e) => setRequestForm((p) => ({ ...p, specialInstructions: e.target.value }))}
              rows={2}
            />
          </div>
          <div>
            <Label>{tr('ملاحظات', 'Notes')}</Label>
            <Textarea
              value={requestForm.notes}
              onChange={(e) => setRequestForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
            />
          </div>

          <Button onClick={handleCreateRequest} disabled={busy} className="w-full">
            {busy ? tr('جاري الإنشاء...', 'Creating...') : tr('إنشاء طلب النقل', 'Create Transport Request')}
          </Button>
        </div>
      )}

      {/* ──────────────────────────────────────────────────── */}
      {/* Staff Tab */}
      {/* ──────────────────────────────────────────────────── */}
      {activeTab === 'staff' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">{tr('طاقم النقل', 'Transport Staff')}</h3>
            <Button size="sm" onClick={() => setShowAddStaff(true)}>
              {tr('إضافة موظف', 'Add Staff')}
            </Button>
          </div>

          {staffList.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              {tr('لا يوجد طاقم نقل مسجل', 'No transport staff registered')}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {staffList.map((s: any) => {
                const stCfg = STAFF_STATUS_CONFIG[s.status] || STAFF_STATUS_CONFIG.available;
                return (
                  <div key={s.id} className="border rounded-lg p-3 bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{tr(s.nameAr || s.name, s.name)}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${stCfg.color}`}>
                        {tr(stCfg.ar, stCfg.en)}
                      </span>
                    </div>
                    {s.zone && (
                      <p className="text-xs text-muted-foreground mb-1">{tr('المنطقة:', 'Zone:')} {s.zone}</p>
                    )}
                    <p className="text-xs text-muted-foreground mb-2">
                      {tr('مهام اليوم:', 'Today:')} {s.completedToday || 0} {tr('مكتملة', 'completed')}
                      {s.avgTransportTime != null && ` | ${tr('متوسط:', 'Avg:')} ${s.avgTransportTime} ${tr('د', 'min')}`}
                    </p>

                    {/* Workload bar */}
                    <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                      <div
                        className={`h-1.5 rounded-full ${
                          (s.completedToday || 0) > 10 ? 'bg-red-500' : (s.completedToday || 0) > 5 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(((s.completedToday || 0) / 15) * 100, 100)}%` }}
                      />
                    </div>

                    {/* Status quick-change */}
                    <div className="flex flex-wrap gap-1">
                      {s.status !== 'available' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs"
                          disabled={busy}
                          onClick={() => handleStaffStatusUpdate(s.id, 'available')}
                        >
                          {tr('متاح', 'Available')}
                        </Button>
                      )}
                      {s.status !== 'break' && s.status !== 'off_duty' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs"
                          disabled={busy}
                          onClick={() => handleStaffStatusUpdate(s.id, 'break')}
                        >
                          {tr('استراحة', 'Break')}
                        </Button>
                      )}
                      {s.status !== 'off_duty' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs"
                          disabled={busy}
                          onClick={() => handleStaffStatusUpdate(s.id, 'off_duty')}
                        >
                          {tr('خارج الخدمة', 'Off Duty')}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────── */}
      {/* Metrics Tab */}
      {/* ──────────────────────────────────────────────────── */}
      {activeTab === 'metrics' && (
        <div>
          <h3 className="font-semibold mb-3">{tr('مؤشرات الأداء', 'Performance Metrics')}</h3>
          {!metrics ? (
            <p className="text-muted-foreground text-sm text-center py-8">{tr('جاري التحميل...', 'Loading...')}</p>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="border rounded-lg p-4 bg-card text-center">
                  <p className="text-2xl font-bold text-blue-600">{metrics.totalRequests}</p>
                  <p className="text-xs text-muted-foreground">{tr('إجمالي الطلبات', 'Total Requests')}</p>
                </div>
                <div className="border rounded-lg p-4 bg-card text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {metrics.avgResponseTimeMinutes != null ? `${metrics.avgResponseTimeMinutes}` : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground">{tr('متوسط وقت الاستجابة (دقيقة)', 'Avg Response Time (min)')}</p>
                </div>
                <div className="border rounded-lg p-4 bg-card text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {metrics.avgTransportTimeMinutes != null ? `${metrics.avgTransportTimeMinutes}` : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground">{tr('متوسط وقت النقل (دقيقة)', 'Avg Transport Time (min)')}</p>
                </div>
                <div className="border rounded-lg p-4 bg-card text-center">
                  <p className="text-2xl font-bold text-emerald-600">{metrics.completionRate}%</p>
                  <p className="text-xs text-muted-foreground">{tr('نسبة الإنجاز', 'Completion Rate')}</p>
                </div>
              </div>

              {/* Status breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
                <div className="border rounded p-2 text-center bg-yellow-50">
                  <p className="text-lg font-bold">{metrics.pendingCount}</p>
                  <p className="text-xs">{tr('معلق', 'Pending')}</p>
                </div>
                <div className="border rounded p-2 text-center bg-blue-50">
                  <p className="text-lg font-bold">{metrics.assignedCount}</p>
                  <p className="text-xs">{tr('مُعيّن', 'Assigned')}</p>
                </div>
                <div className="border rounded p-2 text-center bg-purple-50">
                  <p className="text-lg font-bold">{metrics.inTransitCount}</p>
                  <p className="text-xs">{tr('في الطريق', 'In Transit')}</p>
                </div>
                <div className="border rounded p-2 text-center bg-green-50">
                  <p className="text-lg font-bold">{metrics.completedCount}</p>
                  <p className="text-xs">{tr('مكتمل', 'Completed')}</p>
                </div>
                <div className="border rounded p-2 text-center bg-red-50">
                  <p className="text-lg font-bold">{metrics.cancelledCount}</p>
                  <p className="text-xs">{tr('ملغي', 'Cancelled')}</p>
                </div>
              </div>

              {/* By Urgency */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-lg p-3 bg-card">
                  <h4 className="text-sm font-semibold mb-2">{tr('حسب الأولوية', 'By Urgency')}</h4>
                  {Object.entries(metrics.byUrgency || {}).map(([k, v]) => {
                    const cfg = URGENCY_CONFIG[k];
                    return (
                      <div key={k} className="flex items-center justify-between text-sm mb-1">
                        <span>{cfg ? tr(cfg.ar, cfg.en) : k}</span>
                        <span className="font-medium">{v as number}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="border rounded-lg p-3 bg-card">
                  <h4 className="text-sm font-semibold mb-2">{tr('حسب وسيلة النقل', 'By Transport Mode')}</h4>
                  {Object.entries(metrics.byMode || {}).map(([k, v]) => {
                    const cfg = MODE_CONFIG[k];
                    return (
                      <div key={k} className="flex items-center justify-between text-sm mb-1">
                        <span>{cfg ? tr(cfg.ar, cfg.en) : k}</span>
                        <span className="font-medium">{v as number}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="border rounded-lg p-3 bg-card">
                  <h4 className="text-sm font-semibold mb-2">{tr('حسب النوع', 'By Request Type')}</h4>
                  {Object.entries(metrics.byRequestType || {}).map(([k, v]) => {
                    const cfg = REQUEST_TYPE_CONFIG[k];
                    return (
                      <div key={k} className="flex items-center justify-between text-sm mb-1">
                        <span>{cfg ? tr(cfg.ar, cfg.en) : k}</span>
                        <span className="font-medium">{v as number}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────── */}
      {/* History Tab */}
      {/* ──────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <Select value={statusFilter || '__all__'} onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={tr('كل الحالات', 'All Statuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{tr('الكل', 'All')}</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{tr(v.ar, v.en)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={urgencyFilter || '__all__'} onValueChange={(v) => setUrgencyFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={tr('كل الأولويات', 'All Urgencies')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{tr('الكل', 'All')}</SelectItem>
                {Object.entries(URGENCY_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{tr(v.ar, v.en)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => mutateHistory()}>
              {tr('تحديث', 'Refresh')}
            </Button>
          </div>

          {historyItems.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              {tr('لا توجد سجلات', 'No records found')}
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">{tr('المريض', 'Patient')}</th>
                    <th className="px-3 py-2 text-start font-medium">{tr('المسار', 'Route')}</th>
                    <th className="px-3 py-2 text-start font-medium">{tr('الأولوية', 'Urgency')}</th>
                    <th className="px-3 py-2 text-start font-medium">{tr('الحالة', 'Status')}</th>
                    <th className="px-3 py-2 text-start font-medium">{tr('المُعيّن', 'Assigned To')}</th>
                    <th className="px-3 py-2 text-start font-medium">{tr('المدة', 'Duration')}</th>
                    <th className="px-3 py-2 text-start font-medium">{tr('التاريخ', 'Date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((item: any) => (
                    <tr
                      key={item.id}
                      className="border-t hover:bg-muted/50 cursor-pointer"
                      onClick={() => setDetailDialog(item)}
                    >
                      <td className="px-3 py-2">{item.patientName || item.patientId?.slice(0, 8)}</td>
                      <td className="px-3 py-2 text-xs">
                        {item.origin} → {item.destination}
                      </td>
                      <td className="px-3 py-2">{renderUrgencyBadge(item.urgency)}</td>
                      <td className="px-3 py-2">{renderStatusBadge(item.status)}</td>
                      <td className="px-3 py-2 text-xs">{item.assignedToName || '-'}</td>
                      <td className="px-3 py-2 text-xs">
                        {item.actualDuration != null ? `${item.actualDuration} ${tr('د', 'min')}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {new Date(item.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────── */}
      {/* Assign Dialog */}
      {/* ──────────────────────────────────────────────────── */}
      <Dialog open={!!assignDialog} onOpenChange={() => { setAssignDialog(null); setSelectedStaffId(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('تعيين ناقل', 'Assign Transporter')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>{tr('اختر موظف النقل', 'Select Transport Staff')}</Label>
            <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
              <SelectTrigger><SelectValue placeholder={tr('اختر...', 'Select...')} /></SelectTrigger>
              <SelectContent>
                {staffList
                  .filter((s: any) => s.status === 'available')
                  .map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {tr(s.nameAr || s.name, s.name)}
                      {s.zone ? ` (${s.zone})` : ''}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {staffList.filter((s: any) => s.status === 'available').length === 0 && (
              <p className="text-xs text-red-600">
                {tr('لا يوجد موظفون متاحون حالياً', 'No staff currently available')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAssignDialog(null); setSelectedStaffId(''); }}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={handleAssign} disabled={!selectedStaffId || busy}>
              {busy ? tr('جاري التعيين...', 'Assigning...') : tr('تعيين', 'Assign')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────────────────────────────────────────────────── */}
      {/* Cancel Dialog */}
      {/* ──────────────────────────────────────────────────── */}
      <Dialog open={!!cancelDialog} onOpenChange={() => { setCancelDialog(null); setCancelReason(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('إلغاء الطلب', 'Cancel Request')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>{tr('سبب الإلغاء', 'Cancellation Reason')}</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={tr('أدخل سبب الإلغاء (اختياري)', 'Enter cancellation reason (optional)')}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelDialog(null); setCancelReason(''); }}>
              {tr('تراجع', 'Back')}
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={busy}>
              {busy ? tr('جاري الإلغاء...', 'Cancelling...') : tr('تأكيد الإلغاء', 'Confirm Cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────────────────────────────────────────────────── */}
      {/* Add Staff Dialog */}
      {/* ──────────────────────────────────────────────────── */}
      <Dialog open={showAddStaff} onOpenChange={setShowAddStaff}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('إضافة موظف نقل', 'Add Transport Staff')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{tr('معرف المستخدم *', 'User ID *')}</Label>
              <Input
                value={staffForm.userId}
                onChange={(e) => setStaffForm((p) => ({ ...p, userId: e.target.value }))}
                placeholder="UUID"
              />
            </div>
            <div>
              <Label>{tr('الاسم (إنجليزي) *', 'Name (English) *')}</Label>
              <Input
                value={staffForm.name}
                onChange={(e) => setStaffForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>{tr('الاسم (عربي)', 'Name (Arabic)')}</Label>
              <Input
                value={staffForm.nameAr}
                onChange={(e) => setStaffForm((p) => ({ ...p, nameAr: e.target.value }))}
              />
            </div>
            <div>
              <Label>{tr('الهاتف', 'Phone')}</Label>
              <Input
                value={staffForm.phone}
                onChange={(e) => setStaffForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label>{tr('المنطقة/المبنى', 'Zone/Building')}</Label>
              <Input
                value={staffForm.zone}
                onChange={(e) => setStaffForm((p) => ({ ...p, zone: e.target.value }))}
                placeholder={tr('مثال: المبنى أ', 'e.g., Building A')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStaff(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={handleAddStaff} disabled={busy}>
              {busy ? tr('جاري الإضافة...', 'Adding...') : tr('إضافة', 'Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────────────────────────────────────────────────── */}
      {/* Detail Dialog */}
      {/* ──────────────────────────────────────────────────── */}
      <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tr('تفاصيل طلب النقل', 'Transport Request Details')}</DialogTitle>
          </DialogHeader>
          {detailDialog && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                {renderStatusBadge(detailDialog.status)}
                {renderUrgencyBadge(detailDialog.urgency)}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground text-xs">{tr('المريض', 'Patient')}</p>
                  <p className="font-medium">{detailDialog.patientName || detailDialog.patientId?.slice(0, 8)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{tr('نوع الطلب', 'Request Type')}</p>
                  <p className="font-medium">
                    {REQUEST_TYPE_CONFIG[detailDialog.requestType]
                      ? tr(REQUEST_TYPE_CONFIG[detailDialog.requestType].ar, REQUEST_TYPE_CONFIG[detailDialog.requestType].en)
                      : detailDialog.requestType}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground text-xs">{tr('المسار', 'Route')}</p>
                <p className="font-medium">{detailDialog.origin} → {detailDialog.destination}</p>
                {detailDialog.originDetails && (
                  <p className="text-xs text-muted-foreground">{tr('تفاصيل المصدر:', 'Origin:')} {detailDialog.originDetails}</p>
                )}
                {detailDialog.destinationDetails && (
                  <p className="text-xs text-muted-foreground">{tr('تفاصيل الوجهة:', 'Dest:')} {detailDialog.destinationDetails}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground text-xs">{tr('وسيلة النقل', 'Transport Mode')}</p>
                  <p>
                    {MODE_CONFIG[detailDialog.transportMode]
                      ? tr(MODE_CONFIG[detailDialog.transportMode].ar, MODE_CONFIG[detailDialog.transportMode].en)
                      : detailDialog.transportMode}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{tr('المُعيّن', 'Assigned To')}</p>
                  <p>{detailDialog.assignedToName || tr('غير معيّن', 'Unassigned')}</p>
                </div>
              </div>

              {/* Equipment flags */}
              <div className="flex flex-wrap gap-1">
                {detailDialog.oxygenRequired && <Badge variant="outline">O2</Badge>}
                {detailDialog.monitorRequired && <Badge variant="outline">{tr('مونيتور', 'Monitor')}</Badge>}
                {detailDialog.ivPumpRequired && <Badge variant="outline">IV</Badge>}
                {detailDialog.nurseEscort && <Badge variant="secondary">{tr('مرافق تمريض', 'Nurse Escort')}</Badge>}
                {detailDialog.isolationRequired && (
                  <Badge variant="destructive">
                    {tr('عزل', 'Isolation')} - {detailDialog.isolationType || 'N/A'}
                  </Badge>
                )}
              </div>

              {/* Timestamps */}
              <div className="text-xs text-muted-foreground space-y-0.5 border-t pt-2">
                <p>{tr('إنشاء:', 'Created:')} {new Date(detailDialog.createdAt).toLocaleString()}</p>
                {detailDialog.dispatchedAt && (
                  <p>{tr('إرسال:', 'Dispatched:')} {new Date(detailDialog.dispatchedAt).toLocaleString()}</p>
                )}
                {detailDialog.pickedUpAt && (
                  <p>{tr('التقاط:', 'Picked Up:')} {new Date(detailDialog.pickedUpAt).toLocaleString()}</p>
                )}
                {detailDialog.completedAt && (
                  <p>{tr('إنجاز:', 'Completed:')} {new Date(detailDialog.completedAt).toLocaleString()}</p>
                )}
                {detailDialog.cancelledAt && (
                  <p>{tr('إلغاء:', 'Cancelled:')} {new Date(detailDialog.cancelledAt).toLocaleString()}</p>
                )}
                {detailDialog.actualDuration != null && (
                  <p>{tr('المدة الفعلية:', 'Actual Duration:')} {detailDialog.actualDuration} {tr('دقيقة', 'minutes')}</p>
                )}
                {detailDialog.estimatedDuration != null && (
                  <p>{tr('المدة المتوقعة:', 'Estimated:')} {detailDialog.estimatedDuration} {tr('دقيقة', 'minutes')}</p>
                )}
              </div>

              {detailDialog.specialInstructions && (
                <div className="border-t pt-2">
                  <p className="text-xs text-muted-foreground">{tr('تعليمات خاصة', 'Special Instructions')}</p>
                  <p className="text-sm">{detailDialog.specialInstructions}</p>
                </div>
              )}

              {detailDialog.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">{tr('ملاحظات', 'Notes')}</p>
                  <p className="text-sm">{detailDialog.notes}</p>
                </div>
              )}

              {detailDialog.cancelReason && (
                <div className="bg-red-50 border border-red-200 rounded p-2">
                  <p className="text-xs text-red-600">{tr('سبب الإلغاء:', 'Cancel Reason:')} {detailDialog.cancelReason}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialog(null)}>
              {tr('إغلاق', 'Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
