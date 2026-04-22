'use client';

import { useState, useMemo } from 'react';
import { useLang } from '@/hooks/use-lang';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  DollarSign, Loader2, CheckCircle2, XCircle, Search,
  Percent, List, AlertTriangle,
} from 'lucide-react';

interface ItemPrice {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  itemType: string;
  standardCost: number | null;
  lastPurchaseCost: number | null;
  categoryName?: string;
}

interface UpdateResult {
  updated: number;
  failed: { id: string; reason: string }[];
}

type Mode = 'percentage' | 'by-item';

export default function BulkUpdatePricesPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [mode, setMode] = useState<Mode>('percentage');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [percentage, setPercentage] = useState(0);
  const [priceField, setPriceField] = useState<'standardCost' | 'lastPurchaseCost'>('standardCost');
  const [editedPrices, setEditedPrices] = useState<Record<string, { standardCost?: number; lastPurchaseCost?: number }>>({});
  const [reason, setReason] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<UpdateResult | null>(null);

  const { data: items = [], isLoading } = useQuery<ItemPrice[]>({
    queryKey: ['imdad', 'items-prices', search, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (categoryFilter) params.set('category', categoryFilter);
      params.set('limit', '200');
      const res = await fetch(`/api/imdad/inventory/items?${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      const d = await res.json();
      return d.items ?? d ?? [];
    },
  });

  const categories = useMemo(() => {
    const cats = new Set(items.map((i) => i.itemType).filter(Boolean));
    return Array.from(cats).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (categoryFilter && item.itemType !== categoryFilter) return false;
      return true;
    });
  }, [items, categoryFilter]);

  // Percentage mode: preview
  const percentagePreview = useMemo(() => {
    if (mode !== 'percentage' || percentage === 0) return [];
    return filteredItems
      .filter((item) => {
        const currentPrice = item[priceField];
        return currentPrice != null && currentPrice > 0;
      })
      .map((item) => {
        const currentPrice = item[priceField]!;
        const newPrice = Math.round(currentPrice * (1 + percentage / 100) * 100) / 100;
        return { ...item, currentPrice, newPrice };
      });
  }, [filteredItems, percentage, priceField, mode]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      let updates: { itemId: string; standardCost?: number; lastPurchaseCost?: number }[] = [];

      if (mode === 'percentage') {
        updates = percentagePreview.map((item) => ({
          itemId: item.id,
          [priceField]: item.newPrice,
        }));
      } else {
        updates = Object.entries(editedPrices)
          .filter(([, prices]) => prices.standardCost !== undefined || prices.lastPurchaseCost !== undefined)
          .map(([itemId, prices]) => ({
            itemId,
            ...prices,
          }));
      }

      if (updates.length === 0) throw new Error('No updates');

      const res = await fetch('/api/imdad/bulk/update-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ updates, reason }),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<UpdateResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setShowConfirm(false);
      setEditedPrices({});
    },
    onError: () => {
      setResult({ updated: 0, failed: [{ id: '-', reason: tr('خطأ في الاتصال', 'Connection error') }] });
      setShowConfirm(false);
    },
  });

  const editCount =
    mode === 'percentage'
      ? percentagePreview.length
      : Object.keys(editedPrices).length;

  const formatPrice = (v: number | null) =>
    v != null
      ? new Intl.NumberFormat(language === 'ar' ? 'ar-SA' : 'en-SA', {
          style: 'currency',
          currency: 'SAR',
        }).format(v)
      : '-';

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#4A5D23]/10 dark:bg-[#4A5D23]/20">
          <DollarSign className="h-5 w-5 text-[#4A5D23] dark:text-[#9CB86B]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {tr('تحديث الأسعار بالجملة', 'Bulk Update Prices')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr('تحديث أسعار الأصناف بالنسبة المئوية أو بشكل فردي', 'Update item prices by percentage or individually')}
          </p>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800 w-fit">
        <button
          onClick={() => { setMode('percentage'); setResult(null); }}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'percentage'
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          <Percent className="h-4 w-4" />
          {tr('بالنسبة المئوية', 'By Percentage')}
        </button>
        <button
          onClick={() => { setMode('by-item'); setResult(null); }}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'by-item'
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          <List className="h-4 w-4" />
          {tr('حسب الصنف', 'By Item')}
        </button>
      </div>

      {/* Filters + controls */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {tr('التصنيف', 'Category')}
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">{tr('جميع التصنيفات', 'All Categories')}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {mode === 'percentage' && (
            <>
              {/* Price field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {tr('حقل السعر', 'Price Field')}
                </label>
                <select
                  value={priceField}
                  onChange={(e) => setPriceField(e.target.value as any)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="standardCost">{tr('التكلفة المعيارية', 'Standard Cost')}</option>
                  <option value="lastPurchaseCost">{tr('آخر سعر شراء', 'Last Purchase Cost')}</option>
                </select>
              </div>

              {/* Percentage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {tr('النسبة المئوية (%)', 'Percentage (%)')}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={percentage || ''}
                  onChange={(e) => setPercentage(parseFloat(e.target.value) || 0)}
                  placeholder={tr('مثال: 5 للزيادة، -10 للتخفيض', 'e.g. 5 to increase, -10 to decrease')}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </>
          )}

          {mode === 'by-item' && (
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {tr('بحث', 'Search')}
              </label>
              <div className="relative">
                <Search className="absolute start-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tr('ابحث بالاسم أو الرمز...', 'Search by name or code...')}
                  className="w-full rounded-lg border border-gray-300 bg-white ps-9 pe-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {tr('سبب التحديث', 'Update Reason')} <span className="text-[#8B4513]">*</span>
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={tr('مثال: تحديث أسعار الربع الثاني', 'e.g. Q2 price revision')}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      {/* Percentage preview table */}
      {mode === 'percentage' && percentage !== 0 && (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {tr('معاينة التغييرات', 'Preview Changes')}
            </h3>
            <span className="rounded-full bg-[#4A5D23]/10 px-2.5 py-0.5 text-xs font-medium text-[#4A5D23] dark:bg-[#4A5D23]/20 dark:text-[#9CB86B]">
              {tr(`${percentagePreview.length} صنف سيتأثر`, `${percentagePreview.length} item(s) affected`)}
            </span>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : percentagePreview.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {tr('لا توجد أصناف متطابقة', 'No matching items')}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/50">
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-2 text-start font-medium text-gray-700 dark:text-gray-300">{tr('الرمز', 'Code')}</th>
                    <th className="px-4 py-2 text-start font-medium text-gray-700 dark:text-gray-300">{tr('الاسم', 'Name')}</th>
                    <th className="px-4 py-2 text-start font-medium text-gray-700 dark:text-gray-300">{tr('السعر الحالي', 'Current Price')}</th>
                    <th className="px-4 py-2 text-start font-medium text-gray-700 dark:text-gray-300">{tr('السعر الجديد', 'New Price')}</th>
                    <th className="px-4 py-2 text-start font-medium text-gray-700 dark:text-gray-300">{tr('الفرق', 'Difference')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {percentagePreview.slice(0, 50).map((item) => {
                    const diff = item.newPrice - item.currentPrice;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-2 font-mono text-gray-900 dark:text-white">{item.code}</td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                          {language === 'ar' ? (item.nameAr || item.name) : item.name}
                        </td>
                        <td className="px-4 py-2 text-gray-500">{formatPrice(item.currentPrice)}</td>
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{formatPrice(item.newPrice)}</td>
                        <td className={`px-4 py-2 font-medium ${diff > 0 ? 'text-[#8B4513]' : 'text-[#556B2F]'}`}>
                          {diff > 0 ? '+' : ''}{formatPrice(diff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* By-item editable table */}
      {mode === 'by-item' && (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {tr('لا توجد أصناف', 'No items found')}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/50">
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-2 text-start font-medium text-gray-700 dark:text-gray-300">{tr('الرمز', 'Code')}</th>
                    <th className="px-4 py-2 text-start font-medium text-gray-700 dark:text-gray-300">{tr('الاسم', 'Name')}</th>
                    <th className="px-4 py-2 text-start font-medium text-gray-700 dark:text-gray-300">{tr('التكلفة المعيارية', 'Standard Cost')}</th>
                    <th className="px-4 py-2 text-start font-medium text-gray-700 dark:text-gray-300">{tr('آخر سعر شراء', 'Last Purchase Cost')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredItems.slice(0, 100).map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-2 font-mono text-gray-900 dark:text-white">{item.code}</td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                        {language === 'ar' ? (item.nameAr || item.name) : item.name}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={item.standardCost ?? ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setEditedPrices((prev) => ({
                              ...prev,
                              [item.id]: {
                                ...prev[item.id],
                                standardCost: isNaN(val) ? undefined : val,
                              },
                            }));
                          }}
                          placeholder={formatPrice(item.standardCost)}
                          className="w-28 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-[#4A5D23] focus:outline-none focus:ring-1 focus:ring-[#4A5D23] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={item.lastPurchaseCost ?? ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setEditedPrices((prev) => ({
                              ...prev,
                              [item.id]: {
                                ...prev[item.id],
                                lastPurchaseCost: isNaN(val) ? undefined : val,
                              },
                            }));
                          }}
                          placeholder={formatPrice(item.lastPurchaseCost)}
                          className="w-28 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-[#4A5D23] focus:outline-none focus:ring-1 focus:ring-[#4A5D23] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Submit bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-gray-500">
          {tr(`${editCount} تحديث سيتم تطبيقه`, `${editCount} update(s) to apply`)}
        </span>
        <button
          disabled={editCount === 0 || !reason || updateMutation.isPending}
          onClick={() => setShowConfirm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#4A5D23] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#3d4d1c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
          {tr('تطبيق التحديثات', 'Apply Updates')}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {tr('نتائج التحديث', 'Update Results')}
          </h3>
          <div className="flex items-center gap-4">
            {result.updated > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#556B2F] dark:text-[#9CB86B]">
                <CheckCircle2 className="h-4 w-4" />
                {tr(`تم تحديث ${result.updated} صنف`, `${result.updated} item(s) updated`)}
              </span>
            )}
            {result.failed.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#8B4513] dark:text-[#CD853F]">
                <XCircle className="h-4 w-4" />
                {tr(`فشل ${result.failed.length}`, `${result.failed.length} failed`)}
              </span>
            )}
          </div>
          {result.failed.length > 0 && (
            <ul className="text-sm text-[#8B4513] dark:text-[#CD853F] space-y-1 list-disc list-inside">
              {result.failed.map((f, i) => (
                <li key={i}>{f.reason}</li>
              ))}
            </ul>
          )}
          <button
            onClick={() => setResult(null)}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            {tr('إخفاء', 'Dismiss')}
          </button>
        </div>
      )}

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[#4A5D23]" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tr('تأكيد تحديث الأسعار', 'Confirm Price Update')}
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {mode === 'percentage'
                ? tr(
                    `سيتم تطبيق ${percentage > 0 ? 'زيادة' : 'تخفيض'} بنسبة ${Math.abs(percentage)}% على ${editCount} صنف.`,
                    `A ${Math.abs(percentage)}% ${percentage > 0 ? 'increase' : 'decrease'} will be applied to ${editCount} item(s).`
                  )
                : tr(
                    `سيتم تحديث أسعار ${editCount} صنف.`,
                    `Prices for ${editCount} item(s) will be updated.`
                  )}
            </p>
            <p className="text-xs text-gray-500">
              {tr('السبب:', 'Reason:')} {reason}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {tr('إلغاء', 'Cancel')}
              </button>
              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[#4A5D23] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d4d1c] disabled:opacity-50"
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {tr('تأكيد التحديث', 'Confirm Update')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
