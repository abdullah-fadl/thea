'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import {
  ClipboardList, Plus, Save, Trash2, Play, ChevronDown, ChevronUp,
  Loader2, Check, TestTube2, Stethoscope, Pill, Activity,
} from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface OrderSetItem {
  kind: string;
  orderCode: string;
  orderName: string;
  priority: string;
  department?: string;
  instructions?: string;
}

interface OrderSet {
  id: string;
  name: string;
  nameAr: string;
  category: string;
  description?: string;
  items: OrderSetItem[];
  isActive: boolean;
  isDefault: boolean;
}

const KIND_ICONS: Record<string, typeof TestTube2> = {
  LAB: TestTube2,
  RADIOLOGY: Activity,
  MEDICATION: Pill,
  PROCEDURE: Stethoscope,
  CONSULT: Stethoscope,
};

const PRIORITY_COLORS: Record<string, string> = {
  STAT: 'bg-red-100 text-red-700',
  URGENT: 'bg-orange-100 text-orange-700',
  ROUTINE: 'bg-green-100 text-green-700',
};

export default function OrderSetsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { data, mutate } = useSWR('/api/orders/sets?seed=true', fetcher);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newSet, setNewSet] = useState({ name: '', nameAr: '', category: 'General', description: '' });

  const orderSets: OrderSet[] = data?.orderSets || [];
  const categories = [...new Set(orderSets.map((s) => s.category))];

  const handleDelete = async (id: string) => {
    await fetch(`/api/orders/sets/${id}`, { credentials: 'include', method: 'DELETE' });
    mutate();
  };

  const handleCreate = async () => {
    if (!newSet.name || !newSet.nameAr) return;
    setSaving(true);
    await fetch('/api/orders/sets', {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newSet, items: [] }),
    });
    setSaving(false);
    setShowCreate(false);
    setNewSet({ name: '', nameAr: '', category: 'General', description: '' });
    mutate();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{tr('مجموعات الأوامر', 'Order Sets')}</h1>
              <p className="text-sm text-muted-foreground">{tr('إدارة مجموعات الأوامر', 'Order Sets Management')}</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            {tr('مجموعة جديدة', 'New Order Set')}
          </button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="bg-card rounded-2xl border border-border p-6 mb-6">
            <h2 className="text-lg font-bold mb-4">{tr('إنشاء مجموعة أوامر', 'Create Order Set')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <input
                type="text" placeholder={tr('الاسم (إنجليزي)', 'Name (English)')} value={newSet.name}
                onChange={(e) => setNewSet({ ...newSet, name: e.target.value })}
                className="px-3 py-2 border border-border rounded-xl text-sm"
              />
              <input
                type="text" placeholder={tr('الاسم (عربي)', 'Name (Arabic)')} dir="rtl" value={newSet.nameAr}
                onChange={(e) => setNewSet({ ...newSet, nameAr: e.target.value })}
                className="px-3 py-2 border border-border rounded-xl text-sm"
              />
              <input
                type="text" placeholder={tr('الفئة', 'Category')} value={newSet.category}
                onChange={(e) => setNewSet({ ...newSet, category: e.target.value })}
                className="px-3 py-2 border border-border rounded-xl text-sm"
              />
              <input
                type="text" placeholder={tr('الوصف', 'Description')} value={newSet.description}
                onChange={(e) => setNewSet({ ...newSet, description: e.target.value })}
                className="px-3 py-2 border border-border rounded-xl text-sm"
              />
            </div>
            <button
              onClick={handleCreate} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {tr('إنشاء', 'Create')}
            </button>
          </div>
        )}

        {/* Order Sets by Category */}
        {categories.map((cat) => (
          <div key={cat} className="mb-6">
            <h2 className="text-lg font-bold mb-3 text-muted-foreground">{cat}</h2>
            <div className="space-y-3">
              {orderSets
                .filter((s) => s.category === cat)
                .map((set) => {
                  const isExpanded = expandedId === set.id;
                  return (
                    <div
                      key={set.id}
                      className="bg-card rounded-2xl border border-border overflow-hidden"
                    >
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30"
                        onClick={() => setExpandedId(isExpanded ? null : set.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <ClipboardList className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm">{tr(set.nameAr, set.name)}</h3>
                            <p className="text-[11px] text-muted-foreground">
                              {set.items.length} {tr('أمر', 'orders')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {set.isDefault && (
                            <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{tr('افتراضي', 'Default')}</span>
                          )}
                          {!set.isDefault && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(set.id); }}
                              className="p-1 hover:bg-red-100 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
                          )}
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border p-4 bg-muted/10">
                          {set.description && (
                            <p className="text-xs text-muted-foreground mb-3">{set.description}</p>
                          )}
                          <div className="space-y-2">
                            {set.items.map((item, idx) => {
                              const Icon = KIND_ICONS[item.kind] || Activity;
                              return (
                                <div key={idx} className="flex items-center justify-between p-2 bg-background rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm">{item.orderName}</span>
                                    <span className="text-[10px] text-muted-foreground">{item.orderCode}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded">{item.kind}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${PRIORITY_COLORS[item.priority] || ''}`}>
                                      {item.priority}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}

        {orderSets.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            {tr('جاري تحميل مجموعات الأوامر...', 'Loading order sets...')}
          </div>
        )}
      </div>
    </div>
  );
}
