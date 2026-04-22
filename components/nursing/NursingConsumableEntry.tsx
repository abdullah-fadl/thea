'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import {
  Package, Search, Plus, Minus, Trash2, FileText,
  ChevronDown, X, AlertTriangle, Loader2,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface ConsumableItem {
  supplyCatalogId: string;
  supplyCode: string;
  supplyName: string;
  quantity: number;
  wasteQty: number;
  usageContext: string;
  notes: string;
  storeId: string;
  costPrice: number;
  isChargeable: boolean;
}

interface Props {
  encounterCoreId: string;
  patientMasterId?: string;
  department: 'OPD' | 'ER' | 'IPD' | 'OR' | 'ICU';
  onClose: () => void;
  onSuccess?: () => void;
}

const USAGE_CONTEXTS = [
  { value: 'PROCEDURE', labelAr: 'إجراء', labelEn: 'Procedure' },
  { value: 'DRESSING', labelAr: 'ضماد', labelEn: 'Dressing' },
  { value: 'IV_LINE', labelAr: 'خط وريدي', labelEn: 'IV Line' },
  { value: 'CATHETER', labelAr: 'قسطرة', labelEn: 'Catheter' },
  { value: 'DRAIN', labelAr: 'درنقة', labelEn: 'Drain' },
  { value: 'SPLINT', labelAr: 'جبيرة', labelEn: 'Splint' },
  { value: 'MONITORING', labelAr: 'مراقبة', labelEn: 'Monitoring' },
  { value: 'ROUTINE', labelAr: 'روتيني', labelEn: 'Routine' },
  { value: 'OTHER', labelAr: 'أخرى', labelEn: 'Other' },
];

export default function NursingConsumableEntry({ encounterCoreId, patientMasterId, department, onClose, onSuccess }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [items, setItems] = useState<ConsumableItem[]>([]);
  const [search, setSearch] = useState('');
  const [usageContext, setUsageContext] = useState('ROUTINE');
  const [submitting, setSubmitting] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState('');

  const { data: storesData } = useSWR('/api/consumables/stores?status=ACTIVE', fetcher);
  const { data: templatesData } = useSWR(`/api/consumables/templates?department=${department}&seed=true`, fetcher);
  const { data: catalogData } = useSWR(search.length >= 2 ? `/api/catalogs/supplies?search=${encodeURIComponent(search)}` : null, fetcher);

  const stores = storesData?.stores || [];
  const templates = templatesData?.templates || [];
  const catalogItems = catalogData?.items || [];

  useEffect(() => {
    if (stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
    }
  }, [stores, selectedStoreId]);

  const addItem = useCallback((supply: any) => {
    const exists = items.find((i) => i.supplyCatalogId === supply.id);
    if (exists) {
      setItems(items.map((i) =>
        i.supplyCatalogId === supply.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setItems([...items, {
        supplyCatalogId: supply.id,
        supplyCode: supply.code,
        supplyName: supply.name,
        quantity: 1,
        wasteQty: 0,
        usageContext,
        notes: '',
        storeId: selectedStoreId,
        costPrice: Number(supply.costPrice || 0),
        isChargeable: supply.isChargeable !== false,
      }]);
    }
    setSearch('');
  }, [items, usageContext, selectedStoreId]);

  const applyTemplate = useCallback((template: any) => {
    const templateItems = (template.items || []).map((ti: any) => ({
      supplyCatalogId: ti.supplyCatalogId,
      supplyCode: ti.supplyCode,
      supplyName: ti.supplyName,
      quantity: ti.defaultQty || 1,
      wasteQty: 0,
      usageContext: template.usageContext || usageContext,
      notes: '',
      storeId: selectedStoreId,
      costPrice: 0,
      isChargeable: true,
    }));
    setItems(templateItems);
    setUsageContext(template.usageContext || usageContext);
    setShowTemplates(false);
  }, [usageContext, selectedStoreId]);

  const updateItem = (idx: number, field: keyof ConsumableItem, value: any) => {
    setItems(items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/consumables/usage', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterCoreId,
          patientMasterId,
          department,
          items: items.map((i) => ({
            ...i,
            storeId: i.storeId || undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast({ title: tr('تم التسجيل', 'Recorded'), description: tr(`تم تسجيل ${items.length} مستهلك`, `${items.length} consumable(s) recorded`) });
      setItems([]);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const totalCost = items.reduce((s, i) => s + i.costPrice * i.quantity, 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-background w-full sm:max-w-xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            <h2 className="font-bold">{tr('تسجيل مستهلكات', 'Record Consumables')}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Store & Context selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{tr('المخزن', 'Store')}</label>
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-background text-sm"
              >
                <option value="">{tr('بدون مخزن', 'No Store')}</option>
                {stores.map((s: any) => (
                  <option key={s.id} value={s.id}>{language === 'ar' ? (s.nameAr || s.name) : s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{tr('نوع الاستخدام', 'Usage Type')}</label>
              <select
                value={usageContext}
                onChange={(e) => setUsageContext(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-background text-sm"
              >
                {USAGE_CONTEXTS.map((ctx) => (
                  <option key={ctx.value} value={ctx.value}>{language === 'ar' ? ctx.labelAr : ctx.labelEn}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Templates Quick-Fill */}
          <div>
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 bg-purple-50 rounded-xl hover:bg-purple-100 w-full justify-between"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {tr('قوالب جاهزة', 'Quick Templates')}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
            </button>
            {showTemplates && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {templates.map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className="text-start p-3 bg-muted/50 rounded-xl hover:bg-muted border text-sm"
                  >
                    <div className="font-medium">{language === 'ar' ? (t.nameAr || t.name) : t.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {(Array.isArray(t.items) ? t.items : []).length} {tr('عنصر', 'items')}
                    </div>
                  </button>
                ))}
                {templates.length === 0 && (
                  <div className="col-span-2 text-center text-muted-foreground text-sm py-4">
                    {tr('لا توجد قوالب', 'No templates available')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute start-3 top-3 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr('ابحث عن مستهلك...', 'Search consumable...')}
              className="w-full ps-10 pe-3 py-2.5 rounded-xl border bg-background text-sm"
            />
            {search.length >= 2 && catalogItems.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-background border rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                {catalogItems.map((item: any) => (
                  <button
                    key={item.id}
                    onClick={() => addItem(item)}
                    className="w-full text-start px-4 py-2.5 hover:bg-muted text-sm flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-[10px] text-muted-foreground">{item.code} &middot; {item.category || ''}</div>
                    </div>
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Items List */}
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="bg-muted/30 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{item.supplyName}</div>
                    <div className="text-[10px] text-muted-foreground">{item.supplyCode}</div>
                  </div>
                  <button onClick={() => removeItem(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  {/* Quantity */}
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-muted-foreground">{tr('الكمية', 'Qty')}</label>
                    <div className="flex items-center border rounded-lg">
                      <button onClick={() => updateItem(idx, 'quantity', Math.max(1, item.quantity - 1))} className="px-2 py-1 hover:bg-muted">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-3 py-1 text-sm font-bold min-w-[32px] text-center">{item.quantity}</span>
                      <button onClick={() => updateItem(idx, 'quantity', item.quantity + 1)} className="px-2 py-1 hover:bg-muted">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {/* Waste */}
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      {tr('هدر', 'Waste')}
                    </label>
                    <div className="flex items-center border rounded-lg">
                      <button onClick={() => updateItem(idx, 'wasteQty', Math.max(0, item.wasteQty - 1))} className="px-2 py-1 hover:bg-muted">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 py-1 text-sm min-w-[24px] text-center">{item.wasteQty}</span>
                      <button onClick={() => updateItem(idx, 'wasteQty', item.wasteQty + 1)} className="px-2 py-1 hover:bg-muted">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <div className="text-center text-muted-foreground py-8 text-sm">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>{tr('ابحث عن مستهلك أو اختر قالب جاهز', 'Search for a consumable or choose a template')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 space-y-3">
          {items.length > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {items.length} {tr('عنصر', 'item(s)')} &middot; {items.reduce((s, i) => s + i.quantity, 0)} {tr('وحدة', 'units')}
              </span>
              {totalCost > 0 && (
                <span className="font-bold">{totalCost.toFixed(2)} SAR</span>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border text-sm hover:bg-muted">
              {tr('إلغاء', 'Cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={items.length === 0 || submitting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Package className="w-4 h-4" />
              )}
              {tr('تسجيل', 'Record')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
