'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useEffect, useCallback } from 'react';

import { Plus, MapPin, Trash2, Edit, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Geofence {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  address?: string;
  status: string;
  createdAt: string;
}

export default function GeofenceManager() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', centerLat: '', centerLng: '', radiusMeters: '200', address: '' });

  const loadGeofences = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    fetch('/api/cvision/attendance?action=geofences', { credentials: 'include', signal })
      .then(r => r.json())
      .then(d => setGeofences(d.data?.items || d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { const ac = new AbortController(); loadGeofences(ac.signal); return () => ac.abort(); }, [loadGeofences]);

  function openCreate() {
    setEditId(null);
    setForm({ name: '', centerLat: '', centerLng: '', radiusMeters: '200', address: '' });
    setIsDialogOpen(true);
  }

  function openEdit(g: Geofence) {
    setEditId(g.id);
    setForm({ name: g.name, centerLat: String(g.centerLat), centerLng: String(g.centerLng), radiusMeters: String(g.radiusMeters), address: g.address || '' });
    setIsDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.centerLat || !form.centerLng) {
      toast.error(tr('الاسم وخط العرض وخط الطول مطلوبة', 'Name, latitude, and longitude are required'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/cvision/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'manage-geofence',
          operation: editId ? 'update' : 'create',
          geofenceId: editId || undefined,
          name: form.name,
          centerLat: parseFloat(form.centerLat),
          centerLng: parseFloat(form.centerLng),
          radiusMeters: parseInt(form.radiusMeters) || 200,
          address: form.address || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editId ? tr('تم تحديث النطاق الجغرافي', 'Geofence updated') : tr('تم إنشاء النطاق الجغرافي', 'Geofence created'));
        setIsDialogOpen(false);
        loadGeofences();
      } else {
        toast.error(data.error || tr('فشل', 'Failed'));
      }
    } catch {
      toast.error(tr('خطأ في الشبكة', 'Network error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(geofenceId: string) {
    if (!confirm(tr('هل تريد حذف هذا النطاق الجغرافي؟', 'Delete this geofence?'))) return;
    try {
      const res = await fetch('/api/cvision/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'manage-geofence', operation: 'delete', geofenceId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('تم حذف النطاق الجغرافي', 'Geofence deleted'));
        loadGeofences();
      }
    } catch {
      toast.error(tr('خطأ في الشبكة', 'Network error'));
    }
  }

  async function handleToggleStatus(g: Geofence) {
    try {
      const newStatus = g.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await fetch('/api/cvision/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'manage-geofence', operation: 'update', geofenceId: g.id, status: newStatus }),
      });
      loadGeofences();
    } catch {
      toast.error(tr('خطأ في الشبكة', 'Network error'));
    }
  }

  function getGoogleMapsUrl(lat: number, lng: number) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 13, color: C.textMuted }}>
            {tr('حدد مواقع العمل المسموحة لتسجيل الحضور عبر GPS. يمكن للموظفين تسجيل الدخول/الخروج فقط ضمن نطاق الموقع.', 'Define allowed work locations for GPS-based attendance. Employees can only clock in/out within the geofence radius.')}
          </p>
        </div>
        <CVisionButton C={C} isDark={isDark} onClick={openCreate}>
          <Plus style={{ height: 16, width: 16, marginInlineEnd: 4 }} /> {tr('إضافة موقع', 'Add Location')}
        </CVisionButton>
      </div>

      {/* Geofence cards */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingBottom: 80 }}>
          <Loader2 style={{ height: 24, width: 24, animation: 'spin 1s linear infinite', color: C.textMuted }} />
        </div>
      ) : geofences.length === 0 ? (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>
            <MapPin style={{ height: 40, width: 40, marginBottom: 12, opacity: 0.5 }} />
            <p style={{ fontWeight: 500 }}>{tr('لم يتم تكوين نطاقات جغرافية', 'No geofences configured')}</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              {tr('أضف موقع عمل لتفعيل تتبع الحضور عبر GPS.', 'Add a work location to enable GPS-based attendance tracking.')}
            </p>
          </CVisionCardBody>
        </CVisionCard>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
          {geofences.map(g => (
            <CVisionCard C={C} key={g.id} style={{ position: 'relative' }}>
              <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPin style={{ height: 16, width: 16, color: C.gold }} />
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{g.name}</div>
                  </div>
                  <CVisionBadge C={C}
                    variant={g.status === 'ACTIVE' ? 'default' : 'secondary'}
                    style={{ cursor: 'pointer', fontSize: 12 }}
                    onClick={() => handleToggleStatus(g)}
                  >
                    {g.status === 'ACTIVE' ? tr('نشط', 'ACTIVE') : tr('غير نشط', 'INACTIVE')}
                  </CVisionBadge>
                </div>
              </CVisionCardHeader>
              <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {g.address && <p style={{ fontSize: 12, color: C.textMuted }}>{g.address}</p>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 12 }}>
                  <div>
                    <span style={{ color: C.textMuted }}>{tr('خط العرض', 'Lat')}: </span>
                    <span style={{ fontFamily: 'monospace' }}>{g.centerLat.toFixed(6)}</span>
                  </div>
                  <div>
                    <span style={{ color: C.textMuted }}>{tr('خط الطول', 'Lng')}: </span>
                    <span style={{ fontFamily: 'monospace' }}>{g.centerLng.toFixed(6)}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: C.textMuted }}>{tr('النطاق', 'Radius')}: </span>
                  <span style={{ fontWeight: 500 }}>{g.radiusMeters}{tr('م', 'm')}</span>
                </div>

                <div style={{ display: 'flex', gap: 4, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                  <CVisionButton C={C} isDark={isDark} size="sm" variant="ghost" style={{ height: 28, fontSize: 12 }}
                    onClick={() => window.open(getGoogleMapsUrl(g.centerLat, g.centerLng), '_blank')}>
                    <MapPin style={{ height: 12, width: 12, marginInlineEnd: 4 }} /> {tr('الخريطة', 'Map')}
                  </CVisionButton>
                  <CVisionButton C={C} isDark={isDark} size="sm" variant="ghost" style={{ height: 28, fontSize: 12 }} onClick={() => openEdit(g)}>
                    <Edit style={{ height: 12, width: 12, marginInlineEnd: 4 }} /> {tr('تعديل', 'Edit')}
                  </CVisionButton>
                  <CVisionButton C={C} isDark={isDark} size="sm" variant="ghost" style={{ height: 28, fontSize: 12, color: C.red }} onClick={() => handleDelete(g.id)}>
                    <Trash2 style={{ height: 12, width: 12, marginInlineEnd: 4 }} /> {tr('حذف', 'Delete')}
                  </CVisionButton>
                </div>
              </CVisionCardBody>
            </CVisionCard>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <CVisionDialog C={C} open={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={tr('إعدادات النطاق الجغرافي', 'Geofence Settings')} isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{tr('حدد نطاقاً جغرافياً لتتبع الحضور عبر GPS.', 'Define a GPS boundary for attendance tracking.')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C} style={{ fontSize: 13 }}>{tr('اسم الموقع', 'Location Name')}</CVisionLabel>
              <CVisionInput C={C} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={tr('مثال: المكتب الرئيسي، فرع جدة', 'e.g. Main Office, Branch Jeddah')} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C} style={{ fontSize: 13 }}>{tr('العنوان', 'Address')} <span style={{ color: C.textMuted }}>({tr('اختياري', 'optional')})</span></CVisionLabel>
              <CVisionInput C={C} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder={tr('مثال: طريق الملك فهد، الرياض', 'e.g. King Fahd Road, Riyadh')} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C} style={{ fontSize: 13 }}>{tr('خط العرض', 'Latitude')}</CVisionLabel>
                <CVisionInput C={C} type="number" step="0.000001" value={form.centerLat} onChange={e => setForm(p => ({ ...p, centerLat: e.target.value }))} placeholder="24.7136" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C} style={{ fontSize: 13 }}>{tr('خط الطول', 'Longitude')}</CVisionLabel>
                <CVisionInput C={C} type="number" step="0.000001" value={form.centerLng} onChange={e => setForm(p => ({ ...p, centerLng: e.target.value }))} placeholder="46.6753" />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C} style={{ fontSize: 13 }}>{tr('النطاق (بالمتر)', 'Radius (meters)')}</CVisionLabel>
              <CVisionInput C={C} type="number" value={form.radiusMeters} onChange={e => setForm(p => ({ ...p, radiusMeters: e.target.value }))} placeholder="200" />
              <p style={{ fontSize: 12, color: C.textMuted }}>
                {tr('الافتراضي: 200م. يجب أن يكون الموظف ضمن هذا النطاق لتسجيل الدخول/الخروج.', 'Default: 200m. Employees must be within this radius to clock in/out.')}
              </p>
            </div>

            <CVisionButton C={C} isDark={isDark} onClick={handleSave} disabled={saving} style={{ width: '100%' }}>
              {saving ? (
                <><Loader2 style={{ height: 16, width: 16, marginInlineEnd: 8, animation: 'spin 1s linear infinite' }} /> {tr('جاري الحفظ...', 'Saving...')}</>
              ) : editId ? (
                tr('تحديث النطاق الجغرافي', 'Update Geofence')
              ) : (
                tr('إنشاء النطاق الجغرافي', 'Create Geofence')
              )}
            </CVisionButton>
          </div>
      </CVisionDialog>
    </div>
  );
}
