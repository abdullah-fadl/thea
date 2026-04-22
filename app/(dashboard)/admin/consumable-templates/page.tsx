'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { FileText, Plus, ChevronDown, ChevronUp, Package } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function ConsumableTemplatesPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [dept, setDept] = useState('ALL');
  const [ctx, setCtx] = useState('PROCEDURE');

  const { data, mutate } = useSWR('/api/consumables/templates?seed=true', fetcher);
  const templates = data?.templates || [];

  const handleCreate = async () => {
    if (!name) return;
    const res = await fetch('/api/consumables/templates', {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        nameAr,
        department: dept,
        usageContext: ctx,
        items: [{ supplyCatalogId: '', supplyCode: '', supplyName: 'Placeholder', defaultQty: 1 }],
      }),
    });
    if (res.ok) {
      toast({ title: tr('تم الإنشاء', 'Created') });
      setShowCreate(false);
      setName('');
      setNameAr('');
      mutate();
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{tr('قوالب المستهلكات', 'Consumable Templates')}</h1>
            <p className="text-sm text-muted-foreground">{tr('قوالب جاهزة للإجراءات التمريضية', 'Pre-built templates for nursing procedures')}</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" /> {tr('قالب جديد', 'New Template')}
        </button>
      </div>

      <div className="space-y-3">
        {templates.map((t: any) => {
          const isExpanded = expandedId === t.id;
          const items = (t.items as Record<string, unknown>[]) || [];
          return (
            <div key={t.id} className="bg-card rounded-2xl border overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : t.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30"
              >
                <div className="flex items-center gap-3 text-start">
                  <FileText className="w-4 h-4 text-purple-500" />
                  <div>
                    <div className="font-bold text-sm">{language === 'ar' ? (t.nameAr || t.name) : t.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {t.department} &middot; {t.usageContext} &middot; {items.length} {tr('عنصر', 'items')}
                    </div>
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {isExpanded && (
                <div className="border-t p-4 bg-muted/10 space-y-2">
                  {items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2 bg-background rounded-xl text-sm">
                      <div className="flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{item.supplyName || 'Unknown'}</span>
                      </div>
                      <span className="text-muted-foreground">×{item.defaultQty}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {templates.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{tr('لا توجد قوالب', 'No templates')}</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-background rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg">{tr('قالب جديد', 'New Template')}</h3>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr('اسم القالب (إنجليزي)', 'Template Name')} className="w-full px-3 py-2 rounded-xl border" />
            <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder={tr('اسم القالب (عربي)', 'Template Name (Arabic)')} className="w-full px-3 py-2 rounded-xl border" />
            <div className="grid grid-cols-2 gap-3">
              <select value={dept} onChange={(e) => setDept(e.target.value)} className="px-3 py-2 rounded-xl border">
                {['ALL', 'OPD', 'ER', 'IPD', 'OR', 'ICU'].map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={ctx} onChange={(e) => setCtx(e.target.value)} className="px-3 py-2 rounded-xl border">
                {['PROCEDURE', 'DRESSING', 'IV_LINE', 'CATHETER', 'DRAIN', 'SPLINT', 'MONITORING', 'ROUTINE', 'OTHER'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 rounded-xl border hover:bg-muted">{tr('إلغاء', 'Cancel')}</button>
              <button onClick={handleCreate} className="flex-1 px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700">{tr('إنشاء', 'Create')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
