'use client';

// =============================================================================
// IPD Bed Setup — Configure and manage ward beds
// =============================================================================

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import {
  Bed, Plus, RefreshCw, Check, X, Pencil, Power,
  ChevronDown, ChevronRight,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

interface BedItem {
  id: string;
  bedLabel: string;
  ward: string | null;
  room: string | null;
  unit: string | null;
  departmentId: string | null;
  departmentName: string | null;
  isActive: boolean;
  status: 'AVAILABLE' | 'OCCUPIED' | 'INACTIVE';
}

const STATUS_STYLE: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  OCCUPIED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  INACTIVE: 'bg-muted text-muted-foreground',
};

// ── Add Bed Form ─────────────────────────────────────────────────────────────
function AddBedForm({ onAdded, tr }: { onAdded: () => void; tr: (ar: string, en: string) => string }) {
  const [bedLabel, setBedLabel] = useState('');
  const [ward, setWard] = useState('');
  const [room, setRoom] = useState('');
  const [unit, setUnit] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bedLabel.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/ipd/beds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bedLabel, ward, room, unit }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setBedLabel(''); setWard(''); setRoom(''); setUnit('');
      onAdded();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-blue-200 dark:border-blue-800 p-4">
      <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2">
        <Plus className="h-4 w-4" />
        {tr('إضافة سرير جديد', 'Add New Bed')}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">{tr('رقم/اسم السرير *', 'Bed Label *')}</label>
          <input
            value={bedLabel}
            onChange={e => setBedLabel(e.target.value)}
            placeholder={tr('مثال: B-101', 'e.g. B-101')}
            className="w-full text-sm px-3 py-1.5 rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">{tr('الجناح', 'Ward')}</label>
          <input
            value={ward}
            onChange={e => setWard(e.target.value)}
            placeholder={tr('مثال: الطب الباطني', 'e.g. Internal Med')}
            className="w-full text-sm px-3 py-1.5 rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">{tr('الغرفة', 'Room')}</label>
          <input
            value={room}
            onChange={e => setRoom(e.target.value)}
            placeholder={tr('مثال: 101', 'e.g. 101')}
            className="w-full text-sm px-3 py-1.5 rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">{tr('الوحدة', 'Unit')}</label>
          <input
            value={unit}
            onChange={e => setUnit(e.target.value)}
            placeholder={tr('مثال: ICU', 'e.g. ICU')}
            className="w-full text-sm px-3 py-1.5 rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      <button
        type="submit"
        disabled={saving || !bedLabel.trim()}
        className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {tr('إضافة سرير', 'Add Bed')}
      </button>
    </form>
  );
}

// ── Inline Edit Row ──────────────────────────────────────────────────────────
function BedRow({ bed, onUpdated, tr, isAr }: {
  bed: BedItem;
  onUpdated: () => void;
  tr: (ar: string, en: string) => string;
  isAr: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(bed.bedLabel);
  const [ward, setWard] = useState(bed.ward ?? '');
  const [room, setRoom] = useState(bed.room ?? '');
  const [saving, setSaving] = useState(false);

  const patch = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      await fetch(`/api/ipd/beds/${bed.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    await patch({ bedLabel: label, ward, room });
    setEditing(false);
  };

  const toggleActive = () => patch({ isActive: !bed.isActive });

  if (editing) {
    return (
      <tr className="border-b border-border bg-blue-50/30 dark:bg-blue-900/10">
        <td className="px-3 py-2">
          <input value={label} onChange={e => setLabel(e.target.value)}
            className="w-full text-xs px-2 py-1 rounded border border-blue-300 dark:border-blue-600 bg-card focus:outline-none" />
        </td>
        <td className="px-3 py-2">
          <input value={ward} onChange={e => setWard(e.target.value)}
            className="w-full text-xs px-2 py-1 rounded border border-border bg-card focus:outline-none" />
        </td>
        <td className="px-3 py-2">
          <input value={room} onChange={e => setRoom(e.target.value)}
            className="w-full text-xs px-2 py-1 rounded border border-border bg-card focus:outline-none" />
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{bed.unit ?? '—'}</td>
        <td className="px-3 py-2">
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[bed.status]}`}>
            {isAr ? (bed.status === 'AVAILABLE' ? 'متاح' : bed.status === 'OCCUPIED' ? 'مشغول' : 'غير نشط') : bed.status}
          </span>
        </td>
        <td className="px-3 py-2">
          <div className="flex gap-1.5">
            <button onClick={saveEdit} disabled={saving}
              className="p-1.5 rounded bg-green-500 hover:bg-green-600 text-white transition disabled:opacity-50">
              {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </button>
            <button onClick={() => setEditing(false)}
              className="p-1.5 rounded bg-muted hover:bg-muted dark:hover:bg-muted/500 transition">
              <X className="h-3 w-3" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className={`border-b border-border hover:bg-muted/50 transition ${!bed.isActive ? 'opacity-60' : ''}`}>
      <td className="px-3 py-2.5 text-sm font-medium text-foreground">{bed.bedLabel}</td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{bed.ward ?? '—'}</td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{bed.room ?? '—'}</td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{bed.unit ?? '—'}</td>
      <td className="px-3 py-2.5">
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[bed.status]}`}>
          {isAr ? (bed.status === 'AVAILABLE' ? 'متاح' : bed.status === 'OCCUPIED' ? 'مشغول' : 'غير نشط') : bed.status}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex gap-1.5">
          <button onClick={() => setEditing(true)} title={tr('تعديل', 'Edit')}
            className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition">
            <Pencil className="h-3 w-3" />
          </button>
          <button onClick={toggleActive} disabled={saving || bed.status === 'OCCUPIED'}
            title={bed.isActive ? tr('تعطيل', 'Deactivate') : tr('تفعيل', 'Activate')}
            className={`p-1.5 rounded transition disabled:opacity-40 ${
              bed.isActive
                ? 'hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500'
                : 'hover:bg-green-100 dark:hover:bg-green-900/20 text-green-600'
            }`}>
            <Power className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function BedSetup() {
  const { language } = useLang();
  const isAr = language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);
  const [showAdd, setShowAdd] = useState(false);
  const [expandedWards, setExpandedWards] = useState<Record<string, boolean>>({});

  const { data, isLoading, mutate } = useSWR('/api/ipd/beds', fetcher, { refreshInterval: 60000 });

  const beds: BedItem[] = data?.beds ?? [];
  const wards: string[] = data?.wards ?? [];

  const total = beds.length;
  const available = beds.filter(b => b.status === 'AVAILABLE').length;
  const occupied = beds.filter(b => b.status === 'OCCUPIED').length;
  const inactive = beds.filter(b => b.status === 'INACTIVE').length;

  const toggleWard = (ward: string) => {
    setExpandedWards(prev => ({ ...prev, [ward]: !prev[ward] }));
  };

  const groupedBeds = wards.reduce<Record<string, BedItem[]>>((acc, ward) => {
    acc[ward] = beds.filter(b => (b.ward ?? 'General') === ward);
    return acc;
  }, {});

  return (
    <div className="space-y-6 p-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bed className="h-6 w-6 text-blue-500" />
            {tr('إعداد أسرة العيادات الداخلية', 'IPD Bed Setup')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr('إدارة الأسرة والأجنحة', 'Manage beds and wards')}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => mutate()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50 transition">
            <RefreshCw className="h-3.5 w-3.5" />
            {tr('تحديث', 'Refresh')}
          </button>
          <button onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition">
            <Plus className="h-3.5 w-3.5" />
            {tr('سرير جديد', 'New Bed')}
          </button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: tr('إجمالي الأسرة', 'Total Beds'), value: total, color: 'bg-muted/50', text: 'text-foreground' },
          { label: tr('متاحة', 'Available'), value: available, color: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300' },
          { label: tr('مشغولة', 'Occupied'), value: occupied, color: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300' },
          { label: tr('غير نشطة', 'Inactive'), value: inactive, color: 'bg-muted/50', text: 'text-muted-foreground' },
        ].map(kpi => (
          <div key={kpi.label} className={`${kpi.color} rounded-xl p-4 border border-border`}>
            <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.text}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* ── Add Bed Form ── */}
      {showAdd && (
        <AddBedForm onAdded={() => { mutate(); setShowAdd(false); }} tr={tr} />
      )}

      {/* ── Beds by Ward ── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          {tr('جارٍ التحميل...', 'Loading...')}
        </div>
      ) : beds.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
          <Bed className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">{tr('لا توجد أسرة مضافة بعد', 'No beds configured yet')}</p>
          <button onClick={() => setShowAdd(true)} className="text-xs text-blue-600 hover:underline">
            {tr('أضف أول سرير', 'Add your first bed')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedBeds).map(([ward, wardBeds]) => {
            const isExpanded = expandedWards[ward] !== false; // default expanded
            const wardAvailable = wardBeds.filter(b => b.status === 'AVAILABLE').length;
            const wardOccupied = wardBeds.filter(b => b.status === 'OCCUPIED').length;
            const occupancy = wardBeds.length > 0 ? Math.round((wardOccupied / wardBeds.length) * 100) : 0;

            return (
              <div key={ward} className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Ward Header */}
                <button
                  onClick={() => toggleWard(ward)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/50/50 hover:bg-muted transition text-start"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <span className="font-semibold text-sm text-foreground">{ward}</span>
                    <span className="text-xs text-muted-foreground">{wardBeds.length} {tr('أسرة', 'beds')}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-green-600 dark:text-green-400">{wardAvailable} {tr('متاح', 'avail.')}</span>
                    <span className="text-blue-600 dark:text-blue-400">{wardOccupied} {tr('مشغول', 'occ.')}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${occupancy}%` }} />
                      </div>
                      <span className="text-muted-foreground font-mono">{occupancy}%</span>
                    </div>
                  </div>
                </button>

                {/* Beds Table */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                          <th className="px-3 py-2 text-start">{tr('السرير', 'Bed')}</th>
                          <th className="px-3 py-2 text-start">{tr('الجناح', 'Ward')}</th>
                          <th className="px-3 py-2 text-start">{tr('الغرفة', 'Room')}</th>
                          <th className="px-3 py-2 text-start">{tr('الوحدة', 'Unit')}</th>
                          <th className="px-3 py-2 text-start">{tr('الحالة', 'Status')}</th>
                          <th className="px-3 py-2 text-start">{tr('إجراء', 'Actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wardBeds.map(bed => (
                          <BedRow key={bed.id} bed={bed} onUpdated={mutate} tr={tr} isAr={isAr} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
