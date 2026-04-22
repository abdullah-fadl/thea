'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionInput, CVisionTextarea, CVisionSelect, CVisionPageHeader, CVisionPageLayout,
  CVisionTabs, CVisionTabContent, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import type { CVisionTabItem } from '@/components/cvision/ui/CVisionTabs';
import type { CVisionPalette } from '@/lib/cvision/theme';
import { toast } from 'sonner';
import {
  Bus, MapPin, Users, Truck, Plus, BarChart3, ClipboardCheck,
  FileText, CheckCircle, XCircle, AlertTriangle, Trash2,
  Shield, Wrench, Route,
} from 'lucide-react';

/* -- API helpers -- */
const api = (action: string, params?: Record<string, string>, signal?: AbortSignal) => {
  const sp = new URLSearchParams({ action, ...params });
  return fetch(`/api/cvision/transport?${sp}`, { credentials: 'include', signal }).then(r => r.json());
};
const post = (body: any) =>
  fetch('/api/cvision/transport', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) }).then(r => r.json());

/* -- Shared -- */
const statusVariant = (s: string): 'success' | 'muted' | 'warning' | 'danger' | 'info' | 'purple' => {
  if (s === 'ACTIVE' || s === 'APPROVED' || s === 'COMPLETED') return 'success';
  if (s === 'PENDING' || s === 'MAINTENANCE' || s === 'SCHEDULED' || s === 'SUSPENDED') return 'warning';
  if (s === 'REJECTED' || s === 'DECOMMISSIONED') return 'danger';
  return 'muted';
};

function ProgressBar({ value, max, C }: { value: number; max: number; C: CVisionPalette }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = pct >= 90 ? C.red : pct >= 70 ? C.gold : C.green;
  return (
    <div style={{ width: '100%', background: C.bgSubtle, borderRadius: 99, height: 8 }}>
      <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: color, transition: 'width 0.3s' }} />
    </div>
  );
}

/* ==== TAB 1: ROUTES ==== */

function RoutesTab({ C, isDark, tr, isRTL }: { C: CVisionPalette; isDark: boolean; tr: (ar: string, en: string) => string; isRTL: boolean }) {
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ name: '', nameAr: '', type: 'BUS', capacity: '40', monthlyCostPerEmployee: '0', description: '' });

  const { data: routesRaw, isLoading: loading, refetch: load } = useQuery({
    queryKey: cvisionKeys.transport.list({ action: 'routes' }),
    queryFn: () => cvisionFetch('/api/cvision/transport', { params: { action: 'routes' } }),
  });
  const routes: any[] = routesRaw?.data || [];

  const handleCreate = async () => {
    const res = await post({ action: 'create-route', ...form, capacity: Number(form.capacity), monthlyCostPerEmployee: Number(form.monthlyCostPerEmployee) });
    if (res.ok) { toast.success(tr('تم إنشاء المسار', 'Route created')); setShowCreate(false); setForm({ name: '', nameAr: '', type: 'BUS', capacity: '40', monthlyCostPerEmployee: '0', description: '' }); load(); }
    else toast.error(res.error || tr('فشل', 'Failed'));
  };

  if (loading) return <><CVisionSkeletonStyles />{[1,2,3].map(i => <CVisionSkeletonCard key={i} C={C} height={100} />)}</>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: C.textMuted }}>{routes.length} {tr('مسار(ات)', 'route(s)')}</span>
        <CVisionButton C={C} isDark={isDark} size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>{tr('إضافة مسار', 'Add Route')}</CVisionButton>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {routes.map((r: any) => (
          <CVisionCard key={r.routeId} C={C} onClick={() => setSelected(r)}>
            <CVisionCardBody style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{r.routeNumber} · {r.type}</div>
                </div>
                <CVisionBadge C={C} variant={statusVariant(r.status)}>{r.status}</CVisionBadge>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={12} />{r.currentPassengers || 0}/{r.capacity}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} />{r.stops?.length || 0} {tr('محطات', 'stops')}</span>
              </div>
              <ProgressBar value={r.currentPassengers || 0} max={r.capacity || 1} C={C} />
              {r.monthlyCostPerEmployee > 0 && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>{r.monthlyCostPerEmployee} SAR/{tr('شهر لكل موظف', 'month per employee')}</div>}
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>

      {/* Detail Dialog */}
      <CVisionDialog C={C} open={!!selected} onClose={() => setSelected(null)} title={selected?.name || ''} isRTL={isRTL}>
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><span style={{ color: C.textMuted }}>{tr('رقم المسار', 'Route #')}:</span> <span style={{ color: C.text }}>{selected.routeNumber}</span></div>
              <div><span style={{ color: C.textMuted }}>{tr('النوع', 'Type')}:</span> <span style={{ color: C.text }}>{selected.type}</span></div>
              <div><span style={{ color: C.textMuted }}>{tr('السعة', 'Capacity')}:</span> <span style={{ color: C.text }}>{selected.currentPassengers || 0}/{selected.capacity}</span></div>
              <div><span style={{ color: C.textMuted }}>{tr('الحالة', 'Status')}:</span> <CVisionBadge C={C} variant={statusVariant(selected.status)}>{selected.status}</CVisionBadge></div>
              <div><span style={{ color: C.textMuted }}>{tr('التكلفة الشهرية', 'Monthly Cost')}:</span> <span style={{ color: C.text }}>{selected.monthlyCostPerEmployee || 0} SAR</span></div>
              <div><span style={{ color: C.textMuted }}>GPS:</span> <span style={{ color: C.text }}>{selected.gpsEnabled ? tr('مفعل', 'Enabled') : tr('معطل', 'Disabled')}</span></div>
            </div>
            {selected.stops?.length > 0 && (
              <div>
                <div style={{ fontWeight: 500, marginBottom: 8, color: C.text }}>{tr('المحطات', 'Stops')}</div>
                {[...selected.stops].sort((a: any, b: any) => a.order - b.order).map((s: any) => (
                  <div key={s.stopId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 4 }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: C.bgSubtle, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: C.text }}>{s.order}</span>
                    <span style={{ flex: 1, color: C.text }}>{s.name}</span>
                    <span style={{ color: C.textMuted }}>{s.arrivalTime}</span>
                  </div>
                ))}
              </div>
            )}
            {selected.schedule?.length > 0 && (
              <div>
                <div style={{ fontWeight: 500, marginBottom: 8, color: C.text }}>{tr('الجدول', 'Schedule')}</div>
                {selected.schedule.map((s: any, i: number) => (
                  <div key={i} style={{ fontSize: 12, marginBottom: 4, color: C.textSecondary }}>
                    <CVisionBadge C={C} variant="muted">{s.direction === 'TO_WORK' ? tr('إلى العمل', 'To Work') : tr('إلى المنزل', 'To Home')}</CVisionBadge>
                    <span style={{ marginLeft: 8 }}>{s.departureTime} — {s.arrivalTime} · {s.days?.join(', ')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CVisionDialog>

      {/* Create Dialog */}
      <CVisionDialog C={C} open={showCreate} onClose={() => setShowCreate(false)} title={tr('إنشاء مسار', 'Create Route')} isRTL={isRTL}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CVisionInput C={C} label={tr('الاسم', 'Name')} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={tr('مسار شمال الرياض', 'North Riyadh Route')} />
          <CVisionInput C={C} label={tr('الاسم بالعربي', 'Name (Arabic)')} value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <CVisionSelect C={C} label={tr('النوع', 'Type')} value={form.type} onChange={v => setForm({ ...form, type: v })} options={[{ value: 'BUS', label: tr('حافلة', 'Bus') }, { value: 'VAN', label: tr('فان', 'Van') }, { value: 'SHUTTLE', label: tr('شاتل', 'Shuttle') }]} />
            <CVisionInput C={C} label={tr('السعة', 'Capacity')} type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} />
          </div>
          <CVisionInput C={C} label={tr('التكلفة الشهرية / موظف (ريال)', 'Monthly Cost / Employee (SAR)')} type="number" value={form.monthlyCostPerEmployee} onChange={e => setForm({ ...form, monthlyCostPerEmployee: e.target.value })} />
          <CVisionTextarea C={C} label={tr('الوصف', 'Description')} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        <CVisionDialogFooter>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setShowCreate(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} onClick={handleCreate} disabled={!form.name}>{tr('إنشاء', 'Create')}</CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

/* ==== TAB 2: VEHICLES ==== */

function VehiclesTab({ C, isDark, tr, isRTL }: { C: CVisionPalette; isDark: boolean; tr: (ar: string, en: string) => string; isRTL: boolean }) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ plateNumber: '', type: 'BUS', make: '', model: '', year: String(new Date().getFullYear()), capacity: '40', driverName: '', driverPhone: '', fuelType: 'DIESEL' });

  const load = useCallback(async (signal?: AbortSignal) => { setLoading(true); try { const j = await api('vehicles', undefined, signal); setVehicles(j.data || []); } finally { setLoading(false); } }, []);
  useEffect(() => { const ac = new AbortController(); load(ac.signal); return () => ac.abort(); }, [load]);

  const handleCreate = async () => {
    const res = await post({ action: 'create-vehicle', ...form, year: Number(form.year), capacity: Number(form.capacity) });
    if (res.ok) { toast.success(tr('تمت إضافة المركبة', 'Vehicle added')); setShowCreate(false); load(); } else toast.error(res.error || tr('فشل', 'Failed'));
  };

  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (loading) return <><CVisionSkeletonStyles />{[1,2,3].map(i => <CVisionSkeletonCard key={i} C={C} height={60} />)}</>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: C.textMuted }}>{vehicles.length} {tr('مركبة(ات)', 'vehicle(s)')}</span>
        <CVisionButton C={C} isDark={isDark} size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>{tr('إضافة مركبة', 'Add Vehicle')}</CVisionButton>
      </div>

      {vehicles.some((v: any) => v.insuranceExpiry && new Date(v.insuranceExpiry) <= thirtyDays) && (
        <CVisionCard C={C} hover={false} style={{ borderColor: C.gold + '60' }}>
          <CVisionCardBody style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.gold, fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
              <AlertTriangle size={16} /> {tr('تأمين ينتهي قريبا', 'Insurance Expiring Soon')}
            </div>
            <div style={{ fontSize: 12, color: C.textMuted }}>
              {vehicles.filter((v: any) => v.insuranceExpiry && new Date(v.insuranceExpiry) <= thirtyDays).map((v: any) => (
                <div key={v.vehicleId}>{v.vehicleNumber} ({v.plateNumber}) — {tr('ينتهي', 'expires')} {new Date(v.insuranceExpiry).toLocaleDateString()}</div>
              ))}
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      <CVisionCard C={C}>
        <CVisionCardBody style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.textMuted }}>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'left' }}>{tr('رقم المركبة', 'Vehicle #')}</th>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'left' }}>{tr('اللوحة', 'Plate')}</th>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'left' }}>{tr('النوع', 'Type')}</th>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'left' }}>{tr('الشركة / الموديل', 'Make / Model')}</th>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'left' }}>{tr('السائق', 'Driver')}</th>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'left' }}>{tr('السعة', 'Capacity')}</th>
                <th style={{ padding: '8px 0', textAlign: 'left' }}>{tr('الحالة', 'Status')}</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: C.textMuted }}>{tr('لا توجد مركبات', 'No vehicles')}</td></tr>
              ) : vehicles.map((v: any) => (
                <tr key={v.vehicleId} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '8px 12px 8px 0', fontWeight: 500, color: C.text }}>{v.vehicleNumber}</td>
                  <td style={{ padding: '8px 12px 8px 0', color: C.textSecondary }}>{v.plateNumber}</td>
                  <td style={{ padding: '8px 12px 8px 0' }}><CVisionBadge C={C} variant="muted">{v.type}</CVisionBadge></td>
                  <td style={{ padding: '8px 12px 8px 0', color: C.textSecondary }}>{v.make} {v.model} {v.year ? `(${v.year})` : ''}</td>
                  <td style={{ padding: '8px 12px 8px 0', color: C.textSecondary }}>{v.driverName || '\u2014'}</td>
                  <td style={{ padding: '8px 12px 8px 0', color: C.text }}>{v.capacity}</td>
                  <td style={{ padding: '8px 0' }}><CVisionBadge C={C} variant={statusVariant(v.status)}>{v.status}</CVisionBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CVisionCardBody>
      </CVisionCard>

      <CVisionDialog C={C} open={showCreate} onClose={() => setShowCreate(false)} title={tr('إضافة مركبة', 'Add Vehicle')} isRTL={isRTL}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <CVisionInput C={C} label={tr('رقم اللوحة', 'Plate Number')} value={form.plateNumber} onChange={e => setForm({ ...form, plateNumber: e.target.value })} placeholder="ABC 1234" />
            <CVisionSelect C={C} label={tr('النوع', 'Type')} value={form.type} onChange={v => setForm({ ...form, type: v })} options={[{ value: 'BUS', label: tr('حافلة', 'Bus') }, { value: 'VAN', label: tr('فان', 'Van') }, { value: 'SHUTTLE', label: tr('شاتل', 'Shuttle') }]} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <CVisionInput C={C} label={tr('الشركة', 'Make')} value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} placeholder="Toyota" />
            <CVisionInput C={C} label={tr('الموديل', 'Model')} value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="Coaster" />
            <CVisionInput C={C} label={tr('السنة', 'Year')} type="number" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <CVisionInput C={C} label={tr('اسم السائق', 'Driver Name')} value={form.driverName} onChange={e => setForm({ ...form, driverName: e.target.value })} />
            <CVisionInput C={C} label={tr('هاتف السائق', 'Driver Phone')} value={form.driverPhone} onChange={e => setForm({ ...form, driverPhone: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <CVisionInput C={C} label={tr('السعة', 'Capacity')} type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} />
            <CVisionSelect C={C} label={tr('الوقود', 'Fuel')} value={form.fuelType} onChange={v => setForm({ ...form, fuelType: v })} options={[{ value: 'DIESEL', label: tr('ديزل', 'Diesel') }, { value: 'GASOLINE', label: tr('بنزين', 'Gasoline') }, { value: 'ELECTRIC', label: tr('كهربائي', 'Electric') }, { value: 'HYBRID', label: tr('هجين', 'Hybrid') }]} />
          </div>
        </div>
        <CVisionDialogFooter>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setShowCreate(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} onClick={handleCreate} disabled={!form.plateNumber}>{tr('إضافة', 'Add')}</CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

/* ==== TAB 3: ASSIGNMENTS ==== */

function AssignmentsTab({ C, isDark, tr, isRTL }: { C: CVisionPalette; isDark: boolean; tr: (ar: string, en: string) => string; isRTL: boolean }) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [filterRoute, setFilterRoute] = useState('all');
  const [form, setForm] = useState({ employeeId: '', employeeName: '', routeId: '', pickupStopId: '', dropoffStopId: '', monthlyDeduction: '' });

  const load = useCallback(async (signal?: AbortSignal) => { setLoading(true); try { const [aR, rR] = await Promise.all([api('assignments', { status: 'ACTIVE' }, signal), api('routes', undefined, signal)]); setAssignments(aR.data || []); setRoutes(rR.data || []); } finally { setLoading(false); } }, []);
  useEffect(() => { const ac = new AbortController(); load(ac.signal); return () => ac.abort(); }, [load]);

  const handleAssign = async () => {
    const res = await post({ action: 'assign-employee', ...form, monthlyDeduction: form.monthlyDeduction ? Number(form.monthlyDeduction) : undefined });
    if (res.ok) { toast.success(tr('تم تعيين الموظف', 'Employee assigned')); setShowAssign(false); setForm({ employeeId: '', employeeName: '', routeId: '', pickupStopId: '', dropoffStopId: '', monthlyDeduction: '' }); load(); } else toast.error(res.error || tr('فشل', 'Failed'));
  };

  const handleRemove = async (employeeId: string) => {
    const res = await post({ action: 'remove-employee', employeeId });
    if (res.ok) { toast.success(tr('تم إزالة الموظف من النقل', 'Employee removed from transport')); load(); } else toast.error(res.error || tr('فشل', 'Failed'));
  };

  const filtered = filterRoute === 'all' ? assignments : assignments.filter((a: any) => a.routeId === filterRoute);
  const selectedRoute = routes.find((r: any) => r.routeId === form.routeId);

  if (loading) return <><CVisionSkeletonStyles /><CVisionSkeletonCard C={C} height={160} /></>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <CVisionButton C={C} isDark={isDark} size="sm" variant={filterRoute === 'all' ? undefined : 'outline'} onClick={() => setFilterRoute('all')}>{tr('الكل', 'All')} ({assignments.length})</CVisionButton>
          {routes.filter((r: any) => r.status === 'ACTIVE').map((r: any) => (
            <CVisionButton key={r.routeId} C={C} isDark={isDark} size="sm" variant={filterRoute === r.routeId ? undefined : 'outline'} onClick={() => setFilterRoute(r.routeId)}>
              {r.name} ({assignments.filter((a: any) => a.routeId === r.routeId).length})
            </CVisionButton>
          ))}
        </div>
        <CVisionButton C={C} isDark={isDark} size="sm" icon={<Plus size={14} />} onClick={() => setShowAssign(true)}>{tr('تعيين', 'Assign')}</CVisionButton>
      </div>

      <CVisionCard C={C}>
        <CVisionCardBody style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.textMuted }}>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'left' }}>{tr('الموظف', 'Employee')}</th>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'left' }}>{tr('المسار', 'Route')}</th>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'left' }}>{tr('الصعود', 'Pickup')}</th>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'left' }}>{tr('النزول', 'Dropoff')}</th>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'right' }}>{tr('الخصم', 'Deduction')}</th>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'left' }}>{tr('منذ', 'Since')}</th>
                <th style={{ padding: '8px 0' }}>{tr('إجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: C.textMuted }}>{tr('لا توجد تعيينات', 'No assignments')}</td></tr>
              ) : filtered.map((a: any) => (
                <tr key={a.assignmentId} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '8px 12px 8px 0', fontWeight: 500, color: C.text }}>{a.employeeName || a.employeeId}</td>
                  <td style={{ padding: '8px 12px 8px 0', color: C.textSecondary }}>{a.routeName || a.routeId}</td>
                  <td style={{ padding: '8px 12px 8px 0', fontSize: 12, color: C.textMuted }}>{a.pickupStopName || a.pickupStopId || '\u2014'}</td>
                  <td style={{ padding: '8px 12px 8px 0', fontSize: 12, color: C.textMuted }}>{a.dropoffStopName || a.dropoffStopId || '\u2014'}</td>
                  <td style={{ padding: '8px 12px 8px 0', textAlign: 'right', color: C.text }}>{a.monthlyDeduction || 0} SAR</td>
                  <td style={{ padding: '8px 12px 8px 0', fontSize: 12, color: C.textMuted }}>{a.startDate ? new Date(a.startDate).toLocaleDateString() : '\u2014'}</td>
                  <td style={{ padding: '8px 0' }}>
                    <CVisionButton C={C} isDark={isDark} variant="danger" size="sm" icon={<Trash2 size={12} />} onClick={() => handleRemove(a.employeeId)}>{tr('إزالة', 'Remove')}</CVisionButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CVisionCardBody>
      </CVisionCard>

      <CVisionDialog C={C} open={showAssign} onClose={() => setShowAssign(false)} title={tr('تعيين موظف لمسار', 'Assign Employee to Route')} isRTL={isRTL}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <CVisionInput C={C} label={tr('رقم الموظف', 'Employee ID')} value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} placeholder="EMP-001" />
            <CVisionInput C={C} label={tr('اسم الموظف', 'Employee Name')} value={form.employeeName} onChange={e => setForm({ ...form, employeeName: e.target.value })} />
          </div>
          <CVisionSelect C={C} label={tr('المسار', 'Route')} value={form.routeId} onChange={v => setForm({ ...form, routeId: v, pickupStopId: '', dropoffStopId: '' })} options={routes.filter((r: any) => r.status === 'ACTIVE').map((r: any) => ({ value: r.routeId, label: `${r.name} (${r.currentPassengers || 0}/${r.capacity})` }))} />
          {selectedRoute && selectedRoute.stops?.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <CVisionSelect C={C} label={tr('محطة الصعود', 'Pickup Stop')} value={form.pickupStopId} onChange={v => setForm({ ...form, pickupStopId: v })} options={selectedRoute.stops.map((s: any) => ({ value: s.stopId, label: `${s.name} (${s.arrivalTime})` }))} />
              <CVisionSelect C={C} label={tr('محطة النزول', 'Dropoff Stop')} value={form.dropoffStopId} onChange={v => setForm({ ...form, dropoffStopId: v })} options={selectedRoute.stops.map((s: any) => ({ value: s.stopId, label: `${s.name} (${s.arrivalTime})` }))} />
            </div>
          )}
          <CVisionInput C={C} label={tr('الخصم الشهري (ريال)', 'Monthly Deduction (SAR)')} type="number" value={form.monthlyDeduction} onChange={e => setForm({ ...form, monthlyDeduction: e.target.value })} placeholder={selectedRoute?.monthlyCostPerEmployee ? String(selectedRoute.monthlyCostPerEmployee) : '0'} />
        </div>
        <CVisionDialogFooter>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setShowAssign(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} onClick={handleAssign} disabled={!form.employeeId || !form.routeId}>{tr('تعيين', 'Assign')}</CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

/* ==== TAB 4: REQUESTS ==== */

function RequestsTab({ C, isDark, tr }: { C: CVisionPalette; isDark: boolean; tr: (ar: string, en: string) => string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');

  const load = useCallback(async (signal?: AbortSignal) => { setLoading(true); try { const j = await api('requests', { status: statusFilter }, signal); setRequests(j.data || []); } finally { setLoading(false); } }, [statusFilter]);
  useEffect(() => { const ac = new AbortController(); load(ac.signal); return () => ac.abort(); }, [load]);

  const handleApprove = async (requestId: string) => { const res = await post({ action: 'approve-request', requestId }); if (res.ok) { toast.success(tr('تمت الموافقة', 'Request approved')); load(); } else toast.error(res.error || tr('فشل', 'Failed')); };
  const handleReject = async (requestId: string) => { const res = await post({ action: 'reject-request', requestId }); if (res.ok) { toast.success(tr('تم الرفض', 'Request rejected')); load(); } else toast.error(res.error || tr('فشل', 'Failed')); };

  const typeLabel: Record<string, string> = { NEW_ASSIGNMENT: tr('تعيين جديد', 'New Assignment'), CHANGE_ROUTE: tr('تغيير مسار', 'Change Route'), CHANGE_STOP: tr('تغيير محطة', 'Change Stop'), CANCEL: tr('إلغاء النقل', 'Cancel Transport'), TEMPORARY: tr('مؤقت', 'Temporary') };

  if (loading) return <><CVisionSkeletonStyles /><CVisionSkeletonCard C={C} height={160} /></>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {['PENDING', 'APPROVED', 'REJECTED'].map(s => (
          <CVisionButton key={s} C={C} isDark={isDark} size="sm" variant={statusFilter === s ? undefined : 'outline'} onClick={() => setStatusFilter(s)}>
            {s} {s === 'PENDING' && requests.length > 0 ? `(${requests.length})` : ''}
          </CVisionButton>
        ))}
      </div>
      <CVisionCard C={C}>
        <CVisionCardBody style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.textMuted }}>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'left' }}>{tr('الموظف', 'Employee')}</th>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'left' }}>{tr('النوع', 'Type')}</th>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'left' }}>{tr('السبب', 'Reason')}</th>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'left' }}>{tr('التاريخ', 'Date')}</th>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'left' }}>{tr('الحالة', 'Status')}</th>
                {statusFilter === 'PENDING' && <th style={{ padding: '8px 0' }}>{tr('إجراءات', 'Actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: C.textMuted }}>{tr('لا توجد طلبات', 'No requests')}</td></tr>
              ) : requests.map((r: any) => (
                <tr key={r.requestId} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '8px 12px 8px 0', fontWeight: 500, color: C.text }}>{r.employeeName || r.employeeId}</td>
                  <td style={{ padding: '8px 12px 8px 0' }}><CVisionBadge C={C} variant="muted">{typeLabel[r.type] || r.type}</CVisionBadge></td>
                  <td style={{ padding: '8px 12px 8px 0', color: C.textSecondary, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason || '\u2014'}</td>
                  <td style={{ padding: '8px 12px 8px 0', fontSize: 12, color: C.textMuted }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: '8px 12px 8px 0' }}><CVisionBadge C={C} variant={statusVariant(r.status)}>{r.status}</CVisionBadge></td>
                  {statusFilter === 'PENDING' && (
                    <td style={{ padding: '8px 0' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <CVisionButton C={C} isDark={isDark} size="sm" variant="ghost" icon={<CheckCircle size={12} />} onClick={() => handleApprove(r.requestId)} style={{ color: C.green }}>{tr('موافقة', 'Approve')}</CVisionButton>
                        <CVisionButton C={C} isDark={isDark} size="sm" variant="ghost" icon={<XCircle size={12} />} onClick={() => handleReject(r.requestId)} style={{ color: C.red }}>{tr('رفض', 'Reject')}</CVisionButton>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}

/* ==== TAB 5: TRIPS ==== */

function TripsTab({ C, isDark, tr, isRTL }: { C: CVisionPalette; isDark: boolean; tr: (ar: string, en: string) => string; isRTL: boolean }) {
  const [trips, setTrips] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRecord, setShowRecord] = useState(false);
  const [form, setForm] = useState({ routeId: '', direction: 'TO_WORK', notes: '' });

  const load = useCallback(async (signal?: AbortSignal) => { setLoading(true); try { const [tR, rR] = await Promise.all([api('trips', undefined, signal), api('routes', undefined, signal)]); setTrips(tR.data || []); setRoutes(rR.data || []); } finally { setLoading(false); } }, []);
  useEffect(() => { const ac = new AbortController(); load(ac.signal); return () => ac.abort(); }, [load]);

  const handleRecord = async () => {
    const res = await post({ action: 'record-trip', ...form });
    if (res.ok) { toast.success(tr('تم تسجيل الرحلة', 'Trip recorded')); setShowRecord(false); setForm({ routeId: '', direction: 'TO_WORK', notes: '' }); load(); } else toast.error(res.error || tr('فشل', 'Failed'));
  };

  if (loading) return <><CVisionSkeletonStyles /><CVisionSkeletonCard C={C} height={160} /></>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: C.textMuted }}>{trips.length} {tr('رحلة(ات)', 'trip(s)')}</span>
        <CVisionButton C={C} isDark={isDark} size="sm" icon={<Plus size={14} />} onClick={() => setShowRecord(true)}>{tr('تسجيل رحلة', 'Record Trip')}</CVisionButton>
      </div>
      <CVisionCard C={C}>
        <CVisionCardBody style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.textMuted }}>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'left' }}>{tr('المسار', 'Route')}</th>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'left' }}>{tr('الاتجاه', 'Direction')}</th>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'left' }}>{tr('التاريخ', 'Date')}</th>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'left' }}>{tr('الركاب', 'Passengers')}</th>
                <th style={{ padding: '8px 12px 8px 0', textAlign: 'left' }}>{tr('الحالة', 'Status')}</th>
                <th style={{ padding: '8px 0', textAlign: 'left' }}>{tr('ملاحظات', 'Notes')}</th>
              </tr>
            </thead>
            <tbody>
              {trips.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: C.textMuted }}>{tr('لا توجد رحلات مسجلة', 'No trips recorded')}</td></tr>
              ) : trips.map((t: any) => (
                <tr key={t.tripId} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '8px 12px 8px 0', fontWeight: 500, color: C.text }}>{t.routeName || t.routeId}</td>
                  <td style={{ padding: '8px 12px 8px 0' }}><CVisionBadge C={C} variant="muted">{t.direction === 'TO_WORK' ? tr('إلى العمل', 'To Work') : tr('إلى المنزل', 'To Home')}</CVisionBadge></td>
                  <td style={{ padding: '8px 12px 8px 0', fontSize: 12, color: C.textMuted }}>{new Date(t.tripDate).toLocaleDateString()}</td>
                  <td style={{ padding: '8px 12px 8px 0', color: C.text }}>{t.passengerCount || 0}/{t.expectedPassengers || 0}</td>
                  <td style={{ padding: '8px 12px 8px 0' }}><CVisionBadge C={C} variant={statusVariant(t.status)}>{t.status}</CVisionBadge></td>
                  <td style={{ padding: '8px 0', fontSize: 12, color: C.textMuted, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.notes || '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CVisionCardBody>
      </CVisionCard>

      <CVisionDialog C={C} open={showRecord} onClose={() => setShowRecord(false)} title={tr('تسجيل رحلة', 'Record Trip')} isRTL={isRTL}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CVisionSelect C={C} label={tr('المسار', 'Route')} value={form.routeId} onChange={v => setForm({ ...form, routeId: v })} options={routes.filter((r: any) => r.status === 'ACTIVE').map((r: any) => ({ value: r.routeId, label: r.name }))} />
          <CVisionSelect C={C} label={tr('الاتجاه', 'Direction')} value={form.direction} onChange={v => setForm({ ...form, direction: v })} options={[{ value: 'TO_WORK', label: tr('إلى العمل', 'To Work') }, { value: 'FROM_WORK', label: tr('من العمل', 'From Work') }]} />
          <CVisionTextarea C={C} label={tr('ملاحظات', 'Notes')} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>
        <CVisionDialogFooter>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setShowRecord(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} onClick={handleRecord} disabled={!form.routeId}>{tr('تسجيل', 'Record')}</CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

/* ==== TAB 6: DASHBOARD ==== */

function DashboardTab({ C, tr }: { C: CVisionPalette; tr: (ar: string, en: string) => string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { const ac = new AbortController(); api('dashboard', undefined, ac.signal).then(j => { setData(j.data || {}); setLoading(false); }).catch(() => {}); return () => ac.abort(); }, []);

  if (loading) return <><CVisionSkeletonStyles /><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>{[1,2,3,4].map(i => <CVisionSkeletonCard key={i} C={C} height={80} />)}</div></>;
  if (!data) return null;

  const stats = [
    { label: tr('المسارات النشطة', 'Active Routes'), value: data.activeRoutes || 0, icon: Route, sub: `${data.totalRoutes || 0} ${tr('إجمالي', 'total')}`, color: C.blue },
    { label: tr('المركبات النشطة', 'Active Vehicles'), value: data.activeVehicles || 0, icon: Truck, sub: `${data.totalVehicles || 0} ${tr('إجمالي', 'total')}`, color: C.green },
    { label: tr('الموظفون المنقولون', 'Transported Employees'), value: data.transportedEmployees || 0, icon: Users, sub: `${data.occupancyRate || 0}% ${tr('إشغال', 'occupancy')}`, color: C.purple },
    { label: tr('الخصومات الشهرية', 'Monthly Deductions'), value: `${(data.monthlyDeductions || 0).toLocaleString()} SAR`, icon: Bus, sub: `${data.pendingRequests || 0} ${tr('طلبات معلقة', 'pending requests')}`, color: C.gold },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {stats.map((s, i) => (
          <CVisionCard key={i} C={C} hover={false}>
            <CVisionCardBody style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>{s.label}</span>
                <s.icon size={16} color={s.color} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{s.value}</div>
              {s.sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{s.sub}</div>}
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>

      {(data.expiringInsurance > 0 || data.upcomingMaintenance > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
          {data.expiringInsurance > 0 && (
            <CVisionCard C={C} hover={false} style={{ borderColor: C.gold + '60' }}>
              <CVisionCardBody style={{ padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.gold, fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                  <Shield size={16} /> {data.expiringInsurance} {tr('تأمين ينتهي', 'Insurance Expiring')}
                </div>
                {(data.alerts?.expiringInsurance || []).map((v: any) => (
                  <div key={v.vehicleId} style={{ fontSize: 12, color: C.textMuted }}>{v.vehicleNumber} ({v.plateNumber}) — {new Date(v.expiry).toLocaleDateString()}</div>
                ))}
              </CVisionCardBody>
            </CVisionCard>
          )}
          {data.upcomingMaintenance > 0 && (
            <CVisionCard C={C} hover={false} style={{ borderColor: C.blue + '60' }}>
              <CVisionCardBody style={{ padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.blue, fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                  <Wrench size={16} /> {data.upcomingMaintenance} {tr('صيانة قادمة', 'Upcoming Maintenance')}
                </div>
                {(data.alerts?.upcomingMaintenance || []).map((v: any) => (
                  <div key={v.vehicleId} style={{ fontSize: 12, color: C.textMuted }}>{v.vehicleNumber} ({v.plateNumber}) — {new Date(v.date).toLocaleDateString()}</div>
                ))}
              </CVisionCardBody>
            </CVisionCard>
          )}
        </div>
      )}

      {data.busiestRoutes?.length > 0 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}><span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('إشغال المسارات', 'Route Occupancy')}</span></CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.busiestRoutes.map((r: any) => (
                <div key={r.routeId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 110, fontSize: 13, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  <div style={{ flex: 1 }}><ProgressBar value={r.passengers} max={r.capacity} C={C} /></div>
                  <div style={{ fontSize: 12, color: C.textMuted, width: 80, textAlign: 'right' }}>{r.passengers}/{r.capacity} ({r.occupancy}%)</div>
                </div>
              ))}
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {data.recentTrips?.length > 0 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}><span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('الرحلات الأخيرة', 'Recent Trips')}</span></CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {data.recentTrips.map((t: any) => (
                <div key={t.tripId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CVisionBadge C={C} variant="muted">{t.direction === 'TO_WORK' ? '\u2192' : '\u2190'}</CVisionBadge>
                    <span style={{ fontWeight: 500, color: C.text }}>{t.routeName}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: C.textMuted }}>
                    <span>{t.passengerCount} {tr('ركاب', 'passengers')}</span>
                    <span>{new Date(t.tripDate).toLocaleDateString()}</span>
                    <CVisionBadge C={C} variant={statusVariant(t.status)}>{t.status}</CVisionBadge>
                  </div>
                </div>
              ))}
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}
    </div>
  );
}

/* ==== MAIN PAGE ==== */

export default function TransportPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs: CVisionTabItem[] = [
    { id: 'dashboard', label: tr('لوحة التحكم', 'Dashboard'), icon: <BarChart3 size={14} /> },
    { id: 'routes', label: tr('المسارات', 'Routes'), icon: <Route size={14} /> },
    { id: 'vehicles', label: tr('المركبات', 'Vehicles'), icon: <Truck size={14} /> },
    { id: 'assignments', label: tr('التعيينات', 'Assignments'), icon: <Users size={14} /> },
    { id: 'requests', label: tr('الطلبات', 'Requests'), icon: <FileText size={14} /> },
    { id: 'trips', label: tr('الرحلات', 'Trips'), icon: <ClipboardCheck size={14} /> },
  ];

  return (
    <CVisionPageLayout style={{ padding: 24 }}>
      <CVisionPageHeader
        C={C}
        title={tr('إدارة النقل', 'Transportation Management')}
        titleEn="Transportation Management"
        icon={Bus}
        isRTL={isRTL}
      />
      <CVisionTabs C={C} tabs={tabs} activeTab={activeTab} onChange={setActiveTab} isRTL={isRTL} />
      <div style={{ marginTop: 16 }}>
        {activeTab === 'dashboard' && <DashboardTab C={C} tr={tr} />}
        {activeTab === 'routes' && <RoutesTab C={C} isDark={isDark} tr={tr} isRTL={isRTL} />}
        {activeTab === 'vehicles' && <VehiclesTab C={C} isDark={isDark} tr={tr} isRTL={isRTL} />}
        {activeTab === 'assignments' && <AssignmentsTab C={C} isDark={isDark} tr={tr} isRTL={isRTL} />}
        {activeTab === 'requests' && <RequestsTab C={C} isDark={isDark} tr={tr} />}
        {activeTab === 'trips' && <TripsTab C={C} isDark={isDark} tr={tr} isRTL={isRTL} />}
      </div>
    </CVisionPageLayout>
  );
}
