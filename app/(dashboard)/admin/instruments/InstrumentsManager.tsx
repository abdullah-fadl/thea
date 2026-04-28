'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Plus,
  Wifi,
  WifiOff,
  AlertTriangle,
  Wrench,
  Activity,
  TestTube2,
  Monitor,
  Heart,
  Zap,
  Trash2,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type InstrumentType = 'lab_analyzer' | 'imaging_modality' | 'vitals_monitor' | 'ecg';
type InstrumentProtocol = 'HL7' | 'ASTM' | 'DICOM' | 'FHIR' | 'REST';
type ConnectionType = 'tcp' | 'http' | 'serial' | 'dicom_cstore';
type InstrumentStatus = 'ONLINE' | 'OFFLINE' | 'ERROR' | 'MAINTENANCE';

interface Instrument {
  id: string;
  name: string;
  type: InstrumentType;
  manufacturer: string;
  model: string;
  serialNumber: string;
  department: string;
  protocol: InstrumentProtocol;
  connectionType: ConnectionType;
  host?: string;
  port?: number;
  aeTitle?: string;
  status: InstrumentStatus;
  lastHeartbeat?: string;
  config: Record<string, unknown>;
}

const TYPE_ICONS: Record<InstrumentType, typeof TestTube2> = {
  lab_analyzer: TestTube2,
  imaging_modality: Monitor,
  vitals_monitor: Heart,
  ecg: Zap,
};

export default function InstrumentsManager() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const TYPE_LABELS: Record<InstrumentType, string> = {
    lab_analyzer: tr('محلل مختبر', 'Lab Analyzer'),
    imaging_modality: tr('جهاز تصوير', 'Imaging Modality'),
    vitals_monitor: tr('مراقب علامات', 'Vitals Monitor'),
    ecg: tr('جهاز قلب', 'ECG'),
  };

  const STATUS_STYLES: Record<InstrumentStatus, { bg: string; text: string; icon: typeof Wifi; label: string }> = {
    ONLINE: { bg: 'bg-green-100', text: 'text-green-700', icon: Wifi, label: tr('متصل', 'Online') },
    OFFLINE: { bg: 'bg-muted', text: 'text-foreground', icon: WifiOff, label: tr('غير متصل', 'Offline') },
    ERROR: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle, label: tr('خطأ', 'Error') },
    MAINTENANCE: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Wrench, label: tr('صيانة', 'Maintenance') },
  };

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterDept, setFilterDept] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<Instrument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const params = new URLSearchParams();
  if (filterDept) params.set('department', filterDept);
  if (filterType) params.set('type', filterType);
  if (filterStatus) params.set('status', filterStatus);

  const { data, mutate } = useSWR(`/api/integration/instruments?${params}`, fetcher, { refreshInterval: 15000 });
  const instruments: Instrument[] = data?.instruments ?? [];

  const departments = [...new Set(instruments.map((i) => i.department))];

  const handleTestConnection = async (id: string) => {
    setTesting(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/integration/instruments/${id}/test`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      setTestResult(data);
      mutate();
    } finally {
      setTesting(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch('/api/integration/instruments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'delete', id: deleteTarget.id }),
      });
      mutate();
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tr('إدارة الأجهزة', 'Instruments Manager')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{tr('إدارة الأجهزة الطبية المتصلة', 'Manage connected medical instruments')}</p>
          </div>
          <button
            onClick={() => { setEditingId(null); setShowModal(true); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            {tr('إضافة جهاز', 'Add Instrument')}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-2xl border border-border p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="px-3 py-2 border border-border rounded-xl thea-input-focus text-sm"
            >
              <option value="">{tr('جميع الأقسام', 'All Departments')}</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-border rounded-xl thea-input-focus text-sm"
            >
              <option value="">{tr('جميع الأنواع', 'All Types')}</option>
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-border rounded-xl thea-input-focus text-sm"
            >
              <option value="">{tr('جميع الحالات', 'All Statuses')}</option>
              <option value="ONLINE">{tr('متصل', 'Online')}</option>
              <option value="OFFLINE">{tr('غير متصل', 'Offline')}</option>
              <option value="ERROR">{tr('خطأ', 'Error')}</option>
              <option value="MAINTENANCE">{tr('صيانة', 'Maintenance')}</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label={tr('إجمالي', 'Total')} value={instruments.length} color="text-blue-600" bg="bg-blue-50" />
          <StatCard label={tr('متصل', 'Online')} value={instruments.filter((i) => i.status === 'ONLINE').length} color="text-green-600" bg="bg-green-50" />
          <StatCard label={tr('غير متصل', 'Offline')} value={instruments.filter((i) => i.status === 'OFFLINE').length} color="text-muted-foreground" bg="bg-muted/50" />
          <StatCard label={tr('خطأ', 'Error')} value={instruments.filter((i) => i.status === 'ERROR').length} color="text-red-600" bg="bg-red-50" />
        </div>

        {/* Instruments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instruments.map((instrument) => {
            const TypeIcon = TYPE_ICONS[instrument.type] || Activity;
            const statusStyle = STATUS_STYLES[instrument.status] || STATUS_STYLES.OFFLINE;
            const StatusIcon = statusStyle.icon;

            return (
              <div key={instrument.id} className="bg-card rounded-2xl border border-border p-5 thea-hover-lift">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                      <TypeIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-sm">{instrument.name}</h3>
                      <p className="text-xs text-muted-foreground">{instrument.manufacturer} {instrument.model}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${statusStyle.bg} ${statusStyle.text}`}>
                    <StatusIcon className="w-3 h-3" />
                    {statusStyle.label}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground mb-3">
                  <div className="flex justify-between">
                    <span>{tr('القسم', 'Department')}</span>
                    <span className="font-medium text-foreground">{instrument.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{tr('البروتوكول', 'Protocol')}</span>
                    <span className="font-medium text-foreground">{instrument.protocol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{tr('الاتصال', 'Connection')}</span>
                    <span className="font-medium text-foreground">{instrument.connectionType}{instrument.host ? ` — ${instrument.host}:${instrument.port}` : ''}</span>
                  </div>
                  {instrument.lastHeartbeat && (
                    <div className="flex justify-between">
                      <span>{tr('آخر اتصال', 'Last Heartbeat')}</span>
                      <span className="text-foreground">{new Date(instrument.lastHeartbeat).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US')}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleTestConnection(instrument.id)}
                    disabled={testing === instrument.id}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs border border-border rounded-lg hover:bg-muted disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${testing === instrument.id ? 'animate-spin' : ''}`} />
                    {tr('اختبار', 'Test')}
                  </button>
                  <button
                    onClick={() => { setEditingId(instrument.id); setShowModal(true); }}
                    className="flex items-center justify-center px-2 py-1.5 text-xs border border-border rounded-lg hover:bg-muted"
                    title={tr('تعديل', 'Edit')}
                  >
                    <Settings className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(instrument)}
                    className="flex items-center justify-center px-2 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                    title={tr('حذف', 'Delete')}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {instruments.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>{tr('لا توجد أجهزة مسجلة', 'No instruments registered')}</p>
            </div>
          )}
        </div>

        {/* Test result toast */}
        {testResult && (
          <div className={`fixed bottom-6 ${language === 'ar' ? 'left-6' : 'right-6'} p-4 rounded-2xl shadow-lg border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 text-sm font-medium">
              {testResult.success ? (
                <Wifi className="w-4 h-4 text-green-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              )}
              <span>{testResult.success ? tr('الاتصال ناجح', 'Connection successful') : tr('فشل الاتصال', 'Connection failed')}</span>
              {testResult.responseTime && <span className="text-xs text-muted-foreground">({testResult.responseTime}ms)</span>}
            </div>
            {testResult.error && <p className="text-xs text-red-600 mt-1">{testResult.error}</p>}
            <button onClick={() => setTestResult(null)} className="absolute top-1 right-2 text-xs text-muted-foreground">&times;</button>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {deleteTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-2xl max-w-sm w-full p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-xl">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-lg font-bold text-foreground">{tr('تأكيد الحذف', 'Confirm Delete')}</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                {tr('هل أنت متأكد من حذف هذا الجهاز؟', 'Are you sure you want to delete this instrument?')}
              </p>
              <p className="text-sm font-bold text-foreground mb-4">{deleteTarget.name}</p>
              <p className="text-xs text-red-600 mb-6">
                {tr('لا يمكن التراجع عن هذا الإجراء.', 'This action cannot be undone.')}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  {tr('إلغاء', 'Cancel')}
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? tr('جاري الحذف...', 'Deleting...') : tr('حذف', 'Delete')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <InstrumentModal
            instrumentId={editingId}
            instruments={instruments}
            onClose={() => { setShowModal(false); setEditingId(null); }}
            onSave={() => { mutate(); setShowModal(false); setEditingId(null); }}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function InstrumentModal({
  instrumentId,
  instruments,
  onClose,
  onSave,
}: {
  instrumentId: string | null;
  instruments: Instrument[];
  onClose: () => void;
  onSave: () => void;
}) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const existing = instrumentId ? instruments.find((i) => i.id === instrumentId) : null;

  const [form, setForm] = useState({
    name: existing?.name || '',
    type: existing?.type || 'lab_analyzer',
    manufacturer: existing?.manufacturer || '',
    model: existing?.model || '',
    serialNumber: existing?.serialNumber || '',
    department: existing?.department || '',
    protocol: existing?.protocol || 'HL7',
    connectionType: existing?.connectionType || 'tcp',
    host: existing?.host || '',
    port: existing?.port || 0,
    aeTitle: existing?.aeTitle || '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/integration/instruments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: instrumentId ? 'update' : 'create',
          id: instrumentId,
          ...form,
          port: Number(form.port) || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }
      onSave();
    } catch (err: any) {
      setError(err.message || tr('فشل الحفظ', 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-card rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold">{instrumentId ? tr('تعديل الجهاز', 'Edit Instrument') : tr('إضافة جهاز جديد', 'Add New Instrument')}</h2>
        </div>

        <div className="p-6 space-y-3">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
          )}

          <Field label={tr('الاسم', 'Name')} value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">{tr('النوع', 'Type')}</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as InstrumentType })} className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus text-sm">
                <option value="lab_analyzer">{tr('محلل مختبر', 'Lab Analyzer')}</option>
                <option value="imaging_modality">{tr('جهاز تصوير', 'Imaging Modality')}</option>
                <option value="vitals_monitor">{tr('مراقب علامات', 'Vitals Monitor')}</option>
                <option value="ecg">{tr('جهاز قلب', 'ECG')}</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{tr('البروتوكول', 'Protocol')}</label>
              <select value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value as InstrumentProtocol })} className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus text-sm">
                <option value="HL7">HL7</option>
                <option value="ASTM">ASTM</option>
                <option value="DICOM">DICOM</option>
                <option value="FHIR">FHIR</option>
                <option value="REST">REST</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={tr('الشركة المصنعة', 'Manufacturer')} value={form.manufacturer} onChange={(v) => setForm({ ...form, manufacturer: v })} required />
            <Field label={tr('الموديل', 'Model')} value={form.model} onChange={(v) => setForm({ ...form, model: v })} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={tr('الرقم التسلسلي', 'Serial Number')} value={form.serialNumber} onChange={(v) => setForm({ ...form, serialNumber: v })} />
            <Field label={tr('القسم', 'Department')} value={form.department} onChange={(v) => setForm({ ...form, department: v })} required />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">{tr('نوع الاتصال', 'Connection Type')}</label>
            <select value={form.connectionType} onChange={(e) => setForm({ ...form, connectionType: e.target.value as ConnectionType })} className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus text-sm">
              <option value="tcp">TCP</option>
              <option value="http">HTTP</option>
              <option value="serial">{tr('تسلسلي', 'Serial')}</option>
              <option value="dicom_cstore">DICOM C-STORE</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label={tr('عنوان IP / المضيف', 'Host/IP')} value={form.host} onChange={(v) => setForm({ ...form, host: v })} placeholder="192.168.1.100" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{tr('المنفذ', 'Port')}</label>
              <input type="number" value={form.port || ''} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus text-sm" />
            </div>
          </div>

          {(form.protocol === 'DICOM' || form.connectionType === 'dicom_cstore') && (
            <Field label={tr('عنوان AE', 'AE Title')} value={form.aeTitle} onChange={(v) => setForm({ ...form, aeTitle: v })} placeholder="ANALYZER_01" />
          )}
        </div>

        <div className="p-6 border-t border-border flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-muted-foreground text-sm">{tr('إلغاء', 'Cancel')}</button>
          <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? tr('جاري...', 'Saving...') : instrumentId ? tr('حفظ التعديلات', 'Save Changes') : tr('إضافة', 'Add')}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus text-sm" />
    </div>
  );
}
