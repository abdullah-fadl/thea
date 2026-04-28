'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  ShieldCheck,
  Clock,
  X,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface CountItem {
  itemName: string;
  expectedCount: number;
  actualCount: number;
}

interface Props {
  caseId: string;
  tr: (ar: string, en: string) => string;
  language: string;
}

const CATEGORIES = [
  { key: 'instruments', ar: 'الأدوات الجراحية', en: 'Instruments' },
  { key: 'sponges',     ar: 'الشاش والإسفنج',  en: 'Sponges' },
  { key: 'needles',     ar: 'الإبر',           en: 'Needles' },
  { key: 'blades',      ar: 'الشفرات',         en: 'Blades' },
  { key: 'otherItems',  ar: 'أخرى',           en: 'Other Items' },
];

export default function OrSurgicalCountForm({ caseId, tr, language }: Props) {
  const { data, mutate } = useSWR(`/api/or/cases/${caseId}/surgical-counts`, fetcher);
  const counts: any[] = data?.counts || [];

  const [phase, setPhase] = useState<'PRE_OP' | 'POST_OP'>('PRE_OP');
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  // Each category holds an array of CountItem
  const [items, setItems] = useState<Record<string, CountItem[]>>({
    instruments: [], sponges: [], needles: [], blades: [], otherItems: [],
  });
  const [verifiedByUserId, setVerifiedByUserId] = useState('');
  const [verifiedByName, setVerifiedByName] = useState('');
  const [discrepancyNote, setDiscrepancyNote] = useState('');
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  // Existing counts for this phase
  const preOpCounts = counts.filter((c: any) => c.phase === 'PRE_OP');
  const postOpCounts = counts.filter((c: any) => c.phase === 'POST_OP');
  const unresolvedDiscrepancies = counts.filter((c: any) => c.isDiscrepancy && !c.discrepancyResolved);

  // Auto-fill POST_OP expected from last PRE_OP actuals
  const autoFillPostOp = () => {
    const lastPreOp = preOpCounts[preOpCounts.length - 1];
    if (!lastPreOp) return;
    const filled: Record<string, CountItem[]> = {
      instruments: [], sponges: [], needles: [], blades: [], otherItems: [],
    };
    for (const cat of CATEGORIES) {
      const catItems: any[] = Array.isArray(lastPreOp[cat.key]) ? lastPreOp[cat.key] : [];
      filled[cat.key] = catItems.map((i: any) => ({
        itemName: i.itemName || '',
        expectedCount: Number(i.actualCount) || 0,
        actualCount: 0,
      }));
    }
    setItems(filled);
    setPhase('POST_OP');
    setShowForm(true);
  };

  const addItem = (category: string) => {
    setItems((prev) => ({
      ...prev,
      [category]: [...prev[category], { itemName: '', expectedCount: 0, actualCount: 0 }],
    }));
  };

  const removeItem = (category: string, idx: number) => {
    setItems((prev) => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== idx),
    }));
  };

  const updateItem = (category: string, idx: number, field: keyof CountItem, value: string | number) => {
    setItems((prev) => ({
      ...prev,
      [category]: prev[category].map((item, i) =>
        i === idx ? { ...item, [field]: field === 'itemName' ? value : Number(value) || 0 } : item
      ),
    }));
  };

  // Compute running totals
  const allItems = Object.values(items).flat();
  const totalExpected = allItems.reduce((s, i) => s + i.expectedCount, 0);
  const totalActual = allItems.reduce((s, i) => s + i.actualCount, 0);
  const hasDiscrepancy = totalExpected !== totalActual && allItems.length > 0;

  const submitCount = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/or/cases/${caseId}/surgical-counts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase,
          ...items,
          verifiedByUserId: verifiedByUserId || undefined,
          verifiedByName: verifiedByName || undefined,
          discrepancyNote: hasDiscrepancy ? discrepancyNote : undefined,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setItems({ instruments: [], sponges: [], needles: [], blades: [], otherItems: [] });
        setVerifiedByUserId('');
        setVerifiedByName('');
        setDiscrepancyNote('');
        await mutate();
      }
    } finally { setBusy(false); }
  };

  const resolveDiscrepancy = async () => {
    if (!resolveId || !resolveNote.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/or/cases/${caseId}/surgical-counts/${resolveId}/resolve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionNote: resolveNote }),
      });
      setResolveId(null);
      setResolveNote('');
      await mutate();
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      {/* Unresolved Discrepancy Alert */}
      {unresolvedDiscrepancies.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3 animate-pulse">
          <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-red-700">{tr('تباين في عد الأدوات!', 'COUNT DISCREPANCY DETECTED!')}</p>
            <p className="text-sm text-red-600 mt-1">
              {tr(
                `يوجد ${unresolvedDiscrepancies.length} تباين غير محلول — تحقق من الأدوات فوراً`,
                `${unresolvedDiscrepancies.length} unresolved discrepancy — verify instruments immediately`
              )}
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={phase === 'PRE_OP' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setPhase('PRE_OP'); setShowForm(true); setItems({ instruments: [], sponges: [], needles: [], blades: [], otherItems: [] }); }}
        >
          {tr('عد ما قبل العملية', 'Pre-Op Count')}
        </Button>
        <Button
          variant={phase === 'POST_OP' ? 'default' : 'outline'}
          size="sm"
          onClick={autoFillPostOp}
          disabled={preOpCounts.length === 0}
        >
          {tr('عد ما بعد العملية', 'Post-Op Count')}
        </Button>
        {showForm && (
          <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Count Entry Form */}
      {showForm && (
        <div className="border border-border rounded-xl p-4 space-y-4 bg-muted/10">
          <div className="flex items-center gap-2">
            <Badge className={phase === 'PRE_OP' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
              {phase === 'PRE_OP' ? tr('قبل العملية', 'PRE-OP') : tr('بعد العملية', 'POST-OP')}
            </Badge>
            <span className="text-sm font-medium">{tr('عد الأدوات الجراحية', 'Surgical Item Count')}</span>
          </div>

          {/* Category tables */}
          {CATEGORIES.map((cat) => (
            <div key={cat.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{tr(cat.ar, cat.en)}</h4>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => addItem(cat.key)}>
                  <Plus className="h-3 w-3" /> {tr('إضافة', 'Add')}
                </Button>
              </div>
              {items[cat.key].length === 0 ? (
                <p className="text-xs text-muted-foreground italic">{tr('لا عناصر', 'No items')}</p>
              ) : (
                <div className="space-y-1">
                  <div className="grid grid-cols-[1fr_80px_80px_32px] gap-2 text-[11px] font-semibold text-muted-foreground px-1">
                    <span>{tr('العنصر', 'Item')}</span>
                    <span className="text-center">{tr('متوقع', 'Expected')}</span>
                    <span className="text-center">{tr('فعلي', 'Actual')}</span>
                    <span />
                  </div>
                  {items[cat.key].map((item, idx) => {
                    const mismatch = item.expectedCount !== item.actualCount && item.expectedCount > 0;
                    return (
                      <div key={idx} className={`grid grid-cols-[1fr_80px_80px_32px] gap-2 items-center ${mismatch ? 'bg-red-50 rounded-lg px-1' : 'px-1'}`}>
                        <Input
                          value={item.itemName}
                          onChange={(e) => updateItem(cat.key, idx, 'itemName', e.target.value)}
                          placeholder={tr('اسم الأداة', 'Item name')}
                          className="h-8 text-xs"
                        />
                        <Input
                          type="number"
                          min={0}
                          value={item.expectedCount}
                          onChange={(e) => updateItem(cat.key, idx, 'expectedCount', e.target.value)}
                          className="h-8 text-xs text-center"
                        />
                        <Input
                          type="number"
                          min={0}
                          value={item.actualCount}
                          onChange={(e) => updateItem(cat.key, idx, 'actualCount', e.target.value)}
                          className={`h-8 text-xs text-center ${mismatch ? 'border-red-400 bg-red-100' : ''}`}
                        />
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeItem(cat.key, idx)}>
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Running Total */}
          {allItems.length > 0 && (
            <div className={`flex items-center justify-between rounded-lg px-4 py-2.5 font-bold text-sm ${hasDiscrepancy ? 'bg-red-100 border border-red-300 text-red-800' : 'bg-green-100 border border-green-300 text-green-800'}`}>
              <span>
                {tr('إجمالي', 'Total')}: {tr('متوقع', 'Expected')} {totalExpected} | {tr('فعلي', 'Actual')} {totalActual}
              </span>
              <span className="flex items-center gap-1.5">
                {hasDiscrepancy ? (
                  <><AlertTriangle className="h-4 w-4" /> {tr('تباين!', 'DISCREPANCY!')}</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> {tr('متطابق', 'MATCH')}</>
                )}
              </span>
            </div>
          )}

          {/* Discrepancy Note */}
          {hasDiscrepancy && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-red-700">{tr('ملاحظة التباين (مطلوب)', 'Discrepancy Note (required)')}</label>
              <Textarea
                value={discrepancyNote}
                onChange={(e) => setDiscrepancyNote(e.target.value)}
                placeholder={tr('صف الإجراء المتخذ...', 'Describe action taken...')}
                rows={2}
                className="border-red-300"
              />
            </div>
          )}

          {/* Two-Nurse Verification */}
          <div className="border border-border rounded-lg p-3 space-y-2 bg-background">
            <h4 className="text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              {tr('تحقق بواسطة ممرض/ة ثاني/ة', 'Two-Nurse Verification')}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{tr('معرف الممرض المتحقق', 'Verifier User ID')}</label>
                <Input
                  value={verifiedByUserId}
                  onChange={(e) => setVerifiedByUserId(e.target.value)}
                  placeholder={tr('معرف المستخدم', 'User ID')}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{tr('اسم الممرض المتحقق', 'Verifier Name')}</label>
                <Input
                  value={verifiedByName}
                  onChange={(e) => setVerifiedByName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <Button onClick={submitCount} disabled={busy || allItems.length === 0 || (hasDiscrepancy && !discrepancyNote.trim())}>
              {busy ? tr('جاري الحفظ...', 'Saving...') : tr('تسجيل العد', 'Record Count')}
            </Button>
          </div>
        </div>
      )}

      {/* Historical Counts */}
      {counts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold">{tr('سجل العد', 'Count History')}</h3>
          <div className="space-y-2">
            {counts.map((c: any) => {
              const isUnresolved = c.isDiscrepancy && !c.discrepancyResolved;
              return (
                <div key={c.id} className={`border rounded-xl p-3 ${isUnresolved ? 'border-red-300 bg-red-50' : 'border-border'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={c.phase === 'PRE_OP' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                        {c.phase === 'PRE_OP' ? tr('قبل', 'PRE') : tr('بعد', 'POST')}
                      </Badge>
                      {c.isDiscrepancy ? (
                        <Badge className={c.discrepancyResolved ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
                          {c.discrepancyResolved ? tr('محلول', 'Resolved') : tr('تباين!', 'DISCREPANCY')}
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> {tr('متطابق', 'Match')}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {tr('متوقع', 'Exp')}: {c.totalExpected} | {tr('فعلي', 'Act')}: {c.totalActual}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {c.countedAt ? new Date(c.countedAt).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                  </div>
                  {c.verifiedByName && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-blue-500" />
                      {tr('تحقق بواسطة', 'Verified by')}: {c.verifiedByName}
                    </p>
                  )}
                  {c.discrepancyNote && (
                    <p className="text-xs text-red-600 mt-1">{tr('ملاحظة', 'Note')}: {c.discrepancyNote}</p>
                  )}
                  {c.resolutionNote && (
                    <p className="text-xs text-green-700 mt-1">{tr('الحل', 'Resolution')}: {c.resolutionNote}</p>
                  )}
                  {/* Resolve button for unresolved discrepancies */}
                  {isUnresolved && (
                    <div className="mt-2">
                      {resolveId === c.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={resolveNote}
                            onChange={(e) => setResolveNote(e.target.value)}
                            placeholder={tr('سبب الحل (مثل: أشعة أكدت عدم وجود أداة)', 'Resolution reason (e.g., X-ray confirmed no retained item)')}
                            className="h-8 text-xs flex-1"
                          />
                          <Button size="sm" className="h-8 text-xs" onClick={resolveDiscrepancy} disabled={busy || !resolveNote.trim()}>
                            {tr('حل', 'Resolve')}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setResolveId(null)}>
                            {tr('إلغاء', 'Cancel')}
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={() => setResolveId(c.id)}>
                          {tr('حل التباين', 'Resolve Discrepancy')}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
