'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { FlaskConical, Radio, Wrench, Search, Clipboard, BarChart3, X } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const ORDER_KIND_ICONS: Record<string, React.ReactNode> = {
  LAB: <FlaskConical className="w-4 h-4 inline-block" />,
  RAD: <Radio className="w-4 h-4 inline-block" />,
  PROCEDURE: <Wrench className="w-4 h-4 inline-block" />,
};

const ORDER_KINDS = [
  { value: 'LAB', label: 'Laboratory' },
  { value: 'RAD', label: 'Radiology' },
  { value: 'PROCEDURE', label: 'Procedure' },
];

const DUE_WITHIN_OPTIONS = [
  { value: 7, labelAr: 'أسبوع', labelEn: '1 week' },
  { value: 14, labelAr: 'أسبوعان', labelEn: '2 weeks' },
  { value: 30, labelAr: 'شهر', labelEn: '1 month' },
  { value: 60, labelAr: 'شهران', labelEn: '2 months' },
  { value: 90, labelAr: '3 أشهر', labelEn: '3 months' },
];

const STATUS_STYLES: Record<string, string> = {
  ORDERED: 'bg-amber-100 text-amber-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-700 line-through',
};

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  ORDERED: { ar: 'تم الطلب', en: 'Ordered' },
  IN_PROGRESS: { ar: 'قيد التنفيذ', en: 'In progress' },
  COMPLETED: { ar: 'مكتمل', en: 'Completed' },
  CANCELLED: { ar: 'ملغي', en: 'Cancelled' },
};

/** Orders tab shows only lab/radiology etc. Medications appear only in Prescription tab. */
function isMedicationOrder(order: any): boolean {
  const k = String(order?.kind || order?.category || '').toUpperCase();
  return (
    k === 'PHARMACY' ||
    k === 'MEDICATION' ||
    k === 'MED' ||
    k.includes('PHARM') ||
    k.includes('MEDICATION')
  );
}

interface SelectedOrderItem {
  id: string;
  code?: string;
  name: string;
  nameAr?: string;
  title: string;
  kind: string;
  basePrice?: number;
}

export default function OrdersPanel({ visitId }: { visitId: string }) {
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { data, error, mutate, isLoading } = useSWR(
    visitId ? `/api/opd/encounters/${visitId}/orders` : null,
    fetcher
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const getStatusLabel = (status: string) => {
    const s = (status || 'ORDERED').toUpperCase();
    const labels = STATUS_LABELS[s] || { ar: status, en: status };
    return language === 'ar' ? labels.ar : labels.en;
  };

  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState('LAB');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedOrderItem[]>([]);
  const [catalogResults, setCatalogResults] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [notes, setNotes] = useState('');
  const [dueWithinDays, setDueWithinDays] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const rawItems = Array.isArray(data?.items) ? data.items : [];
  const items = rawItems.filter((o: any) => !isMedicationOrder(o));

  // Debounce catalog search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setCatalogResults([]);
      return;
    }
    setCatalogLoading(true);
    fetch(`/api/billing/catalog/search?kind=${kind}&query=${encodeURIComponent(debouncedQuery)}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setCatalogResults(Array.isArray(d?.items) ? d.items : []))
      .catch(() => setCatalogResults([]))
      .finally(() => setCatalogLoading(false));
  }, [debouncedQuery, kind]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-orders-selector]')) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const getDisplayName = (item: any) =>
    language === 'ar' ? item.nameAr || item.name || item.title : item.name || item.nameAr || item.title;

  const addItem = (item: any) => {
    const id = item.id || item.code;
    if (selectedItems.some((s) => s.id === id)) {
      toast({ title: tr('الطلب مضاف مسبقاً', 'Order already added') });
      return;
    }
    const title = item.nameAr || item.name || item.title;
    setSelectedItems([
      ...selectedItems,
      {
        id,
        code: item.code,
        name: item.name || title,
        nameAr: item.nameAr,
        title,
        kind,
        basePrice: Number(item.basePrice || 0),
      },
    ]);
    setQuery('');
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const removeItem = (id: string) => {
    setSelectedItems(selectedItems.filter((s) => s.id !== id));
  };

  const handleCreate = async () => {
    if (selectedItems.length === 0) {
      toast({ title: tr('الرجاء اختيار طلب واحد على الأقل', 'Please select at least one order'), variant: 'destructive' as const });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/opd/encounters/${visitId}/orders`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orders: selectedItems.map((o) => ({
            kind: o.kind,
            title: o.title,
            catalogItemId: o.id,
            catalogCode: o.code || undefined,
            price: o.basePrice || undefined,
            notes: notes.trim() || undefined,
            ...(o.kind === 'PROCEDURE' && dueWithinDays ? { dueWithinDays } : {}),
          })),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || tr('فشل إنشاء الطلبات', 'Failed to create orders'));
      toast({ title: tr('تم إنشاء الطلبات بنجاح', 'Orders created successfully') });
      setSelectedItems([]);
      setNotes('');
      setDueWithinDays(undefined);
      setQuery('');
      setShowForm(false);
      mutate();
    } catch (err: any) {
      toast({ title: err.message || tr('خطأ', 'Error'), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelId || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/opd/orders/${cancelId}/cancel`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelReason: cancelReason.trim() }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || tr('فشل إلغاء الطلب', 'Failed to cancel'));
      toast({ title: tr('تم إلغاء الطلب', 'Order cancelled') });
      setCancelId(null);
      setCancelReason('');
      mutate();
    } catch (err: any) {
      toast({ title: err.message || tr('خطأ', 'Error'), variant: 'destructive' as const });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{tr('الطلبات', 'Orders')}</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
          >
            {showForm ? tr('إلغاء', 'Cancel') : tr('+ طلب جديد', '+ New order')}
          </button>
        </div>

        {showForm && (
          <div data-orders-selector className="mb-6 p-4 rounded-lg border border-indigo-200 bg-indigo-50/50 space-y-4">
            <div className="flex gap-2">
              {ORDER_KINDS.map((k) => (
                <button
                  key={k.value}
                  onClick={() => setKind(k.value)}
                  className={`px-3 py-2 rounded-lg text-sm border ${
                    kind === k.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-card text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {ORDER_KIND_ICONS[k.value]} {k.label}
                </button>
              ))}
            </div>

            {/* Search + Dropdown */}
            <div className="relative">
              <div className="relative">
                <span className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {catalogLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={tr('ابحث بالكود أو الاسم...', 'Search by code or name...')}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => catalogResults.length > 0 && setShowDropdown(true)}
                  className="w-full ps-10 pe-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {showDropdown && query.length >= 2 && (
                <div className="absolute z-20 mt-1 w-full bg-card border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {catalogLoading ? (
                    <div className="p-4 text-center text-slate-500 text-sm">{tr('جاري البحث...', 'Searching...')}</div>
                  ) : catalogResults.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-sm">{tr('لا توجد نتائج', 'No results')}</div>
                  ) : (
                    catalogResults.map((item: any) => {
                      const alreadySelected = selectedItems.some((s) => s.id === (item.id || item.code));
                      return (
                        <button
                          key={item.id || item.code}
                          type="button"
                          onClick={() => addItem(item)}
                          disabled={alreadySelected}
                          className="w-full px-4 py-3 text-start hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed border-b border-slate-100 last:border-0"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-slate-800">{getDisplayName(item)}</span>
                            {item.code && <span className="text-xs text-slate-400 font-mono">{item.code}</span>}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Selected orders */}
            {selectedItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-slate-600 mb-2">
                  {tr('الطلبات المختارة:', 'Selected orders:')}
                </p>
                {selectedItems.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-card"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-indigo-600 font-medium shrink-0">
                        {ORDER_KIND_ICONS[kind] || <FlaskConical className="w-4 h-4 inline-block" />}
                      </span>
                      {o.code && (
                        <span className="font-mono text-sm text-slate-500 shrink-0">{o.code}</span>
                      )}
                      {o.code && <span className="text-slate-300 shrink-0">-</span>}
                      <span className="text-sm text-slate-800 truncate">{o.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(o.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 shrink-0"
                      title={tr('حذف', 'Remove')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              placeholder={tr('ملاحظات (اختياري)', 'Notes (optional)')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            {/* Due within selector — only for PROCEDURE orders */}
            {kind === 'PROCEDURE' && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  {tr('مدة التنفيذ المتوقعة', 'Expected completion within')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {DUE_WITHIN_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDueWithinDays(dueWithinDays === opt.value ? undefined : opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm border ${
                        dueWithinDays === opt.value
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-card text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {language === 'ar' ? opt.labelAr : opt.labelEn}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={saving || selectedItems.length === 0}
              className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving
                ? tr('جاري الحفظ...', 'Saving...')
                : tr('إنشاء الطلبات', 'Create orders') + (selectedItems.length ? ` (${selectedItems.length})` : '')}
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="text-sm text-slate-500 text-center py-8">{tr('جاري تحميل الطلبات...', 'Loading orders...')}</div>
        ) : error ? (
          <div className="text-sm text-red-600 text-center py-8">{tr('فشل تحميل الطلبات', 'Failed to load orders')}</div>
        ) : items.length ? (
          <div className="space-y-3">
            {items.map((order: any) => {
              const statusKey = (order.status || 'ORDERED').toUpperCase();
              const isDone = statusKey === 'COMPLETED' || order.hasResult;
              const isPaid = order.paymentStatus === 'PAID' || order.paidAt;
              return (
                <div
                  key={order.id}
                  className="rounded-lg border border-slate-200 p-4 flex flex-wrap items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-900">
                        {ORDER_KIND_ICONS[order.kind] || <Clipboard className="w-4 h-4 inline-block" />}{' '}
                        {order.title || order.name || tr('طلب', 'Order')}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          STATUS_STYLES[statusKey] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
                      <span className={isPaid ? 'text-emerald-600' : 'text-amber-600'}>
                        {tr('الدفع:', 'Payment:')} {isPaid ? tr('مدفوع', 'Paid') : tr('باقي', 'Pending')}
                      </span>
                      <span className="text-slate-500">
                        {tr('الإجراء:', 'Procedure:')} {isDone ? tr('تم', 'Done') : tr('باقي', 'Pending')}
                      </span>
                    </div>
                    {order.notes && (
                      <div className="text-xs text-slate-500 mt-1">{order.notes}</div>
                    )}
                    <div className="text-xs text-slate-400 mt-1">
                      {order.orderedAt
                        ? new Date(order.orderedAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-GB', { timeZone: 'Asia/Riyadh' })
                        : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isDone || order.hasResult ? (
                      <Link
                        href={`/opd/visit/${visitId}/results`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
                      >
                        <BarChart3 className="w-3.5 h-3.5 inline-block" /> {tr('عرض النتائج', 'View Results')}
                      </Link>
                    ) : null}
                    {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
                      <button
                        onClick={() => {
                          setCancelId(order.id);
                          setCancelReason('');
                        }}
                        className="text-xs text-red-600 hover:text-red-800 px-2 py-1"
                      >
                        {tr('إلغاء', 'Cancel')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-slate-500 text-center py-8">{tr('لا يوجد طلبات بعد', 'No orders yet')}</div>
        )}
      </div>

      {cancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-card rounded-xl p-6 w-full max-w-md shadow-lg space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">{tr('إلغاء الطلب', 'Cancel order')}</h3>
            <textarea
              placeholder={tr('سبب الإلغاء (مطلوب)', 'Cancel reason (required)')}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setCancelId(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                {tr('رجوع', 'Back')}
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling || !cancelReason.trim()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {cancelling ? tr('جاري الإلغاء...', 'Cancelling...') : tr('تأكيد الإلغاء', 'Confirm cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
