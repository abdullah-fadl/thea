'use client';

import { useState } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Trash2, UserX, CalendarClock, RefreshCw, CheckSquare, Square, AlertCircle } from 'lucide-react';

interface Booking {
  id: string;
  patientName?: string;
  date?: string;
  status?: string;
  time?: string;
}

interface Props {
  bookings: Booking[];
  onComplete?: () => void;
}

type BulkAction = 'cancel' | 'no-show' | 'reschedule-date';

export default function BulkBookingActions({ bookings, onComplete }: Props) {
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<BulkAction | null>(null);
  const [newDate, setNewDate] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancellable = bookings.filter(b =>
    !['CANCELLED', 'COMPLETED'].includes(b.status ?? '')
  );

  const toggleAll = () => {
    if (selectedIds.size === cancellable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cancellable.map(b => b.id)));
    }
  };

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const execute = async () => {
    if (!action || selectedIds.size === 0) return;
    if (action === 'reschedule-date' && !newDate) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        action,
        bookingIds: Array.from(selectedIds),
      };
      if (action === 'cancel' && cancelReason) body.cancelReason = cancelReason;
      if (action === 'reschedule-date') body.newDate = newDate;

      const res = await fetch('/api/opd/booking/bulk', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      const count = data.cancelled ?? data.updated ?? data.rescheduled ?? 0;
      const actionLabel = action === 'cancel'
        ? tr('إلغاء', 'cancelled')
        : action === 'no-show'
        ? tr('غياب', 'marked no-show')
        : tr('تأجيل', 'rescheduled');

      setResult(tr(`تم ${actionLabel} ${count} موعد`, `${count} bookings ${actionLabel}`));
      setSelectedIds(new Set());
      setAction(null);
      onComplete?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={toggleAll} className="text-muted-foreground hover:text-blue-600 transition">
            {selectedIds.size === cancellable.length && cancellable.length > 0
              ? <CheckSquare className="w-5 h-5 text-blue-600" />
              : <Square className="w-5 h-5" />
            }
          </button>
          <span className="text-sm font-medium">
            {selectedIds.size > 0
              ? tr(`${selectedIds.size} محدد`, `${selectedIds.size} selected`)
              : tr('تحديد الكل', 'Select all')}
          </span>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAction('cancel')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
                action === 'cancel'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {tr('إلغاء جماعي', 'Bulk Cancel')}
            </button>
            <button
              onClick={() => setAction('no-show')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
                action === 'no-show'
                  ? 'bg-orange-600 text-white'
                  : 'bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-900/20'
              }`}
            >
              <UserX className="w-3.5 h-3.5" />
              {tr('تسجيل غياب', 'Mark No-Show')}
            </button>
            <button
              onClick={() => setAction('reschedule-date')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
                action === 'reschedule-date'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20'
              }`}
            >
              <CalendarClock className="w-3.5 h-3.5" />
              {tr('تأجيل جماعي', 'Bulk Reschedule')}
            </button>
          </div>
        )}
      </div>

      {/* Action options */}
      {action && (
        <div className="p-4 bg-muted/50/30 border-b border-border flex items-end gap-3 flex-wrap">
          {action === 'cancel' && (
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">{tr('سبب الإلغاء', 'Cancel reason')}</label>
              <input
                type="text"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder={tr('اختياري', 'Optional')}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
              />
            </div>
          )}
          {action === 'reschedule-date' && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{tr('التاريخ الجديد', 'New date')}</label>
              <input
                type="date"
                value={newDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setNewDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
              />
            </div>
          )}
          <button
            onClick={execute}
            disabled={loading || (action === 'reschedule-date' && !newDate)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-card dark:text-slate-900 text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50 transition"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
            {tr(`تنفيذ على ${selectedIds.size} موعد`, `Apply to ${selectedIds.size} bookings`)}
          </button>
          <button
            onClick={() => { setAction(null); setError(null); }}
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            {tr('إلغاء', 'Cancel')}
          </button>
        </div>
      )}

      {/* Result / Error */}
      {result && (
        <div className="mx-4 mt-3 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm">
          {result}
        </div>
      )}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Bookings list */}
      <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
        {cancellable.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {tr('لا توجد مواعيد قابلة للتعديل', 'No editable bookings')}
          </div>
        ) : (
          cancellable.map(booking => (
            <label
              key={booking.id}
              className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(booking.id)}
                onChange={() => toggle(booking.id)}
                className="rounded border-border"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{booking.patientName ?? '—'}</div>
                <div className="text-xs text-muted-foreground">
                  {booking.date} {booking.time ? `• ${booking.time}` : ''}
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                booking.status === 'ACTIVE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                booking.status === 'CHECKED_IN' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                booking.status === 'ARRIVED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                'bg-muted text-muted-foreground'
              }`}>
                {booking.status}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
