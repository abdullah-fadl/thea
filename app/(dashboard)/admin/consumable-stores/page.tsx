'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Warehouse, Plus, Package, AlertTriangle, ArrowDown, ArrowUp } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function ConsumableStoresPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [locationType, setLocationType] = useState('DEPARTMENT');
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [adjustItem, setAdjustItem] = useState<any>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustType, setAdjustType] = useState<'RECEIVE' | 'ADJUST'>('RECEIVE');

  const { data: storesData, mutate: mutateStores } = useSWR('/api/consumables/stores?status=ALL', fetcher);
  const { data: inventoryData, mutate: mutateInventory } = useSWR(
    selectedStore ? `/api/consumables/stores/inventory?storeId=${selectedStore}` : null,
    fetcher
  );
  const { data: alertsData } = useSWR('/api/consumables/stores/alerts', fetcher);

  const stores = storesData?.stores || [];
  const inventory = inventoryData?.items || [];
  const stats = inventoryData?.stats || {};
  const alerts = alertsData?.alerts || [];

  const handleCreate = async () => {
    if (!name) return;
    const res = await fetch('/api/consumables/stores', {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, nameAr, locationType }),
    });
    if (res.ok) {
      toast({ title: tr('تم الإنشاء', 'Created') });
      setShowCreate(false);
      setName('');
      setNameAr('');
      mutateStores();
    }
  };

  const handleAdjust = async () => {
    if (!adjustItem || adjustQty <= 0) return;
    const res = await fetch('/api/consumables/stores/inventory', {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: selectedStore,
        supplyCatalogId: adjustItem.supplyCatalogId,
        movementType: adjustType,
        quantity: adjustQty,
        reason: adjustType === 'RECEIVE' ? 'Manual receive' : 'Manual adjustment',
      }),
    });
    if (res.ok) {
      toast({ title: tr('تم التعديل', 'Adjusted') });
      setAdjustItem(null);
      setAdjustQty(0);
      mutateInventory();
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-2xl flex items-center justify-center">
            <Warehouse className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{tr('مخازن المستهلكات', 'Consumable Stores')}</h1>
            <p className="text-sm text-muted-foreground">{tr('إدارة المخازن والمخزون', 'Manage stores and inventory')}</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" /> {tr('مخزن جديد', 'New Store')}
        </button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 font-bold text-amber-800 mb-2">
            <AlertTriangle className="w-4 h-4" />
            {tr('تنبيهات المخزون', 'Stock Alerts')} ({alerts.length})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {alerts.slice(0, 6).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-card rounded-xl text-sm">
                <div>
                  <span className="font-medium">{a.supplyName}</span>
                  <span className="text-muted-foreground ms-1">({a.storeName})</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs ${a.status === 'OUT_OF_STOCK' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {a.currentQty} {tr('متبقي', 'left')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stores List */}
        <div className="space-y-2">
          <h2 className="font-bold text-sm text-muted-foreground">{tr('المخازن', 'Stores')}</h2>
          {stores.map((store: any) => (
            <button
              key={store.id}
              onClick={() => setSelectedStore(store.id)}
              className={`w-full text-start p-4 rounded-2xl border transition-colors ${selectedStore === store.id ? 'border-purple-500 bg-purple-50' : 'hover:bg-muted'}`}
            >
              <div className="font-bold text-sm">{language === 'ar' ? (store.nameAr || store.name) : store.name}</div>
              <div className="text-xs text-muted-foreground">{store.code} &middot; {store.locationType}</div>
            </button>
          ))}
          {stores.length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">{tr('لا توجد مخازن', 'No stores')}</div>
          )}
        </div>

        {/* Inventory */}
        <div className="lg:col-span-2 space-y-4">
          {selectedStore && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: tr('الكل', 'Total'), value: stats.total || 0, color: 'text-blue-600' },
                  { label: tr('متوفر', 'In Stock'), value: stats.inStock || 0, color: 'text-green-600' },
                  { label: tr('منخفض', 'Low'), value: stats.low || 0, color: 'text-amber-600' },
                  { label: tr('نفذ', 'Out'), value: stats.outOfStock || 0, color: 'text-red-600' },
                ].map((s) => (
                  <div key={s.label} className="bg-card rounded-xl border p-3 text-center">
                    <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-[10px] text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Items */}
              <div className="space-y-2">
                {inventory.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-card rounded-xl border">
                    <div className="flex items-center gap-3">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-sm">{item.supplyName}</div>
                        <div className="text-[10px] text-muted-foreground">{item.supplyCode} &middot; {item.category}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        item.status === 'IN_STOCK' ? 'bg-green-100 text-green-700' :
                        item.status === 'LOW' ? 'bg-amber-100 text-amber-700' :
                        item.status === 'OUT_OF_STOCK' ? 'bg-red-100 text-red-700' : 'bg-muted'
                      }`}>
                        {item.currentQty}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setAdjustItem(item); setAdjustType('RECEIVE'); setAdjustQty(0); }}
                          className="p-1 text-green-600 hover:bg-green-50 rounded-lg" title={tr('استلام', 'Receive')}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setAdjustItem(item); setAdjustType('ADJUST'); setAdjustQty(item.currentQty); }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg" title={tr('تعديل', 'Adjust')}
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {inventory.length === 0 && (
                  <div className="text-center text-muted-foreground py-8 text-sm">{tr('لا يوجد مخزون', 'No inventory')}</div>
                )}
              </div>
            </>
          )}
          {!selectedStore && (
            <div className="text-center text-muted-foreground py-12">
              <Warehouse className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{tr('اختر مخزن لعرض المخزون', 'Select a store to view inventory')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Store Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-background rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg">{tr('مخزن جديد', 'New Store')}</h3>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr('اسم المخزن (إنجليزي)', 'Store Name')} className="w-full px-3 py-2 rounded-xl border" />
            <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder={tr('اسم المخزن (عربي)', 'Store Name (Arabic)')} className="w-full px-3 py-2 rounded-xl border" />
            <select value={locationType} onChange={(e) => setLocationType(e.target.value)} className="w-full px-3 py-2 rounded-xl border">
              <option value="DEPARTMENT">{tr('قسم', 'Department')}</option>
              <option value="FLOOR">{tr('طابق', 'Floor')}</option>
              <option value="UNIT">{tr('وحدة', 'Unit')}</option>
              <option value="CRASH_CART">{tr('عربة طوارئ', 'Crash Cart')}</option>
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 rounded-xl border hover:bg-muted">{tr('إلغاء', 'Cancel')}</button>
              <button onClick={handleCreate} className="flex-1 px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700">{tr('إنشاء', 'Create')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      {adjustItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-background rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold">{adjustType === 'RECEIVE' ? tr('استلام مخزون', 'Receive Stock') : tr('تعديل المخزون', 'Adjust Stock')}</h3>
            <p className="text-sm text-muted-foreground">{adjustItem.supplyName}</p>
            <input type="number" min={0} value={adjustQty} onChange={(e) => setAdjustQty(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 rounded-xl border text-center text-lg font-bold" />
            <div className="flex gap-2">
              <button onClick={() => setAdjustItem(null)} className="flex-1 px-4 py-2 rounded-xl border hover:bg-muted">{tr('إلغاء', 'Cancel')}</button>
              <button onClick={handleAdjust} className="flex-1 px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700">{tr('تأكيد', 'Confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
