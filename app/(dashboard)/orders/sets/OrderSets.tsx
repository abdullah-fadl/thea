'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Plus, Search, Play, Edit2, Copy, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface OrderSetItem {
  type: 'lab' | 'medication' | 'radiology' | 'procedure';
  code: string;
  name: string;
  instructions?: string;
  dose?: string;
  frequency?: string;
}

interface OrderSet {
  id: string;
  name: string;
  nameAr: string;
  category: string;
  description?: string;
  items: OrderSetItem[];
  isActive: boolean;
  createdAt: string;
}

const categoryOptions = [
  { value: '', labelAr: 'الكل', labelEn: 'All' },
  { value: 'admission', labelAr: 'أوامر الدخول', labelEn: 'Admission Orders' },
  { value: 'discharge', labelAr: 'أوامر الخروج', labelEn: 'Discharge Orders' },
  { value: 'diabetes', labelAr: 'السكري', labelEn: 'Diabetes' },
  { value: 'hypertension', labelAr: 'ارتفاع الضغط', labelEn: 'Hypertension' },
  { value: 'infection', labelAr: 'العدوى', labelEn: 'Infection' },
  { value: 'pain', labelAr: 'الألم', labelEn: 'Pain' },
  { value: 'cardiac', labelAr: 'القلب', labelEn: 'Cardiac' },
  { value: 'respiratory', labelAr: 'الجهاز التنفسي', labelEn: 'Respiratory' },
  { value: 'er', labelAr: 'الطوارئ', labelEn: 'Emergency' },
  { value: 'opd', labelAr: 'العيادات', labelEn: 'OPD' },
  { value: 'ipd', labelAr: 'المنومين', labelEn: 'IPD' },
];

function mapItems(rawItems: any[]): OrderSetItem[] {
  return rawItems.map((item) => {
    const kind = String(item.kind || item.type || '').toUpperCase();
    const type =
      kind === 'RADIOLOGY'
        ? 'radiology'
        : kind === 'PROCEDURE' || kind === 'NON_MED'
        ? 'procedure'
        : kind === 'MEDICATION'
        ? 'medication'
        : 'lab';
    return {
      type,
      code: String(item.orderCode || item.code || ''),
      name: String(item.displayName || item.name || ''),
      instructions: item.defaults?.clinicalText || item.instructions,
      dose: item.defaults?.dose || item.dose,
      frequency: item.defaults?.frequency || item.frequency,
    };
  });
}

export default function OrderSets() {
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selectedSet, setSelectedSet] = useState<OrderSet | null>(null);
  const [showExecute, setShowExecute] = useState(false);
  const [executePatientId, setExecutePatientId] = useState('');
  const [executeEncounterId, setExecuteEncounterId] = useState('');
  const [executeEncounterType, setExecuteEncounterType] = useState('OPD');
  const [executing, setExecuting] = useState(false);

  const params = new URLSearchParams();
  params.set('includeItems', '1');
  if (search) params.set('search', search);
  if (category) params.set('category', category);

  const { data } = useSWR(`/api/order-sets?${params.toString()}`, fetcher);

  const orderSets: OrderSet[] = useMemo(() => {
    const raw = data?.items || [];
    return raw.map((set: any) => ({
      id: set.id,
      name: set.name || set.title || 'Order Set',
      nameAr: set.nameAr || set.name || set.title || 'Order Set',
      category: String(set.category || set.scope || 'general').toLowerCase(),
      description: set.description || '',
      items: mapItems(Array.isArray(set.items) ? set.items : []),
      isActive: String(set.status || 'ACTIVE').toUpperCase() === 'ACTIVE',
      createdAt: set.createdAt,
    }));
  }, [data]);

  const filteredSets = orderSets.filter((set) => {
    const matchesSearch = search
      ? `${set.name} ${set.nameAr} ${set.description || ''}`.toLowerCase().includes(search.toLowerCase())
      : true;
    const matchesCategory = category ? set.category === category : true;
    return matchesSearch && matchesCategory;
  });

  const openExecute = (orderSet: OrderSet) => {
    setSelectedSet(orderSet);
    setShowExecute(true);
  };

  const handleExecuteOrderSet = async () => {
    if (!selectedSet) return;
    setExecuting(true);
    try {
      const res = await fetch('/api/order-sets/execute', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderSetId: selectedSet.id,
          patientId: executePatientId || undefined,
          encounterId: executeEncounterId || undefined,
          encounterType: executeEncounterType,
        }),
      });

      if (!res.ok) throw new Error('Failed to execute order set');

      toast({ title: tr('تم تنفيذ مجموعة الأوامر', 'Order set executed successfully') });
      setShowExecute(false);
      setExecutePatientId('');
      setExecuteEncounterId('');
    } catch (error) {
      toast({ title: tr('فشل تنفيذ مجموعة الأوامر', 'Failed to execute order set'), variant: 'destructive' });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">{tr('مجموعات الأوامر', 'Order Sets')}</h1>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            {tr('إضافة مجموعة', 'Add Set')}
          </button>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={tr('بحث...', 'Search...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-border rounded-xl thea-input-focus"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-4 py-2 border border-border rounded-xl thea-input-focus"
            >
              {categoryOptions.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {tr(cat.labelAr, cat.labelEn)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSets.map((orderSet) => (
            <div
              key={orderSet.id}
              className="bg-card rounded-2xl border border-border p-4 thea-hover-lift transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-foreground">{orderSet.nameAr}</h3>
                  <p className="text-sm text-muted-foreground">{orderSet.name}</p>
                </div>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-[11px] font-bold">
                  {(() => { const c = categoryOptions.find((c) => c.value === orderSet.category); return c ? tr(c.labelAr, c.labelEn) : orderSet.category; })()}
                </span>
              </div>

              {orderSet.description && <p className="text-sm text-muted-foreground mb-3">{orderSet.description}</p>}

              <div className="text-sm text-muted-foreground mb-4">{orderSet.items.length} {tr('عنصر', 'items')}</div>

              <div className="space-y-1 mb-4 max-h-32 overflow-y-auto">
                {orderSet.items.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        item.type === 'lab'
                          ? 'bg-purple-500'
                          : item.type === 'medication'
                          ? 'bg-green-500'
                          : item.type === 'radiology'
                          ? 'bg-blue-500'
                          : 'bg-amber-500'
                      }`}
                    />
                    <span className="truncate">{item.name}</span>
                  </div>
                ))}
                {orderSet.items.length > 3 && (
                  <div className="text-xs text-muted-foreground">+{orderSet.items.length - 3} {tr('عناصر أخرى', 'more items')}</div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <button
                  onClick={() => openExecute(orderSet)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700"
                >
                  <Play className="w-4 h-4" />
                  {tr('تنفيذ', 'Execute')}
                </button>
                <button className="p-2 text-muted-foreground thea-hover-lift rounded-xl">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button className="p-2 text-muted-foreground thea-hover-lift rounded-xl">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
            </div>
          </div>

      {showExecute && selectedSet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-semibold text-foreground">{tr('تنفيذ مجموعة الأوامر', 'Execute Order Set')}</h2>
              <button onClick={() => setShowExecute(false)} className="p-1 thea-hover-lift rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">{tr('معرف المريض', 'Patient ID')}</label>
                <input
                  value={executePatientId}
                  onChange={(e) => setExecutePatientId(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
                  placeholder="patientMasterId"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">{tr('معرف الزيارة', 'Encounter ID')}</label>
                <input
                  value={executeEncounterId}
                  onChange={(e) => setExecuteEncounterId(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
                  placeholder="encounterCoreId"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">{tr('نوع الزيارة', 'Encounter Type')}</label>
                <select
                  value={executeEncounterType}
                  onChange={(e) => setExecuteEncounterType(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
                >
                  <option value="OPD">OPD</option>
                  <option value="ER">ER</option>
                  <option value="IPD">IPD</option>
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-border flex gap-2">
              <button
                onClick={() => setShowExecute(false)}
                className="flex-1 px-4 py-2 border border-border rounded-xl thea-hover-lift"
              >
                {tr('إلغاء', 'Cancel')}
              </button>
              <button
                onClick={handleExecuteOrderSet}
                disabled={executing || (!executeEncounterId && !executePatientId)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                {executing ? tr('جاري التنفيذ...', 'Executing...') : tr('تنفيذ', 'Execute')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
