'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function DiagnosisCatalog() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const { hasPermission, isLoading } = useRoutePermission('/billing/diagnosis-catalog');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [icd10, setIcd10] = useState('');
  const searchParam = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  const { data, mutate } = useSWR(hasPermission ? `/api/catalogs/diagnosis${searchParam}` : null, fetcher, {
    refreshInterval: 0,
  });
  const items = Array.isArray(data?.items) ? data.items : [];
  const rows = useMemo(() => items, [items]);

  const resetForm = () => {
    setCode('');
    setName('');
    setCategory('');
    setIcd10('');
  };

  const createItem = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/catalogs/diagnosis', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          category: category.trim() || undefined,
          icd10: icd10.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to create diagnosis');
      toast({ title: tr('تم إنشاء التشخيص', 'Diagnosis created') });
      resetForm();
      setAddOpen(false);
      await mutate();
    } catch (err: unknown) {
      toast({
        title: tr('خطأ', 'Error'),
        description: (err as Error)?.message || tr('فشلت العملية', 'Failed'),
        variant: 'destructive' as const,
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{tr('كتالوج التشخيصات', 'Diagnosis Catalog')}</h2>
          <p className="text-sm text-muted-foreground">{tr('كتالوج التشخيصات السريرية (رموز ICD-10).', 'Clinical diagnosis catalog (ICD-10 codes).')}</p>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
              <Input
              placeholder={tr('بحث بالرمز أو الاسم', 'Search by code or name')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs rounded-xl thea-input-focus"
            />
            <Button className="rounded-xl" onClick={() => { resetForm(); setAddOpen(true); }}>
              {tr('إضافة تشخيص', 'Add Diagnosis')}
            </Button>
          </div>
          <div>
            <div className="grid grid-cols-4 gap-4 px-4 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الرمز', 'Code')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الفئة', 'Category')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">ICD-10</span>
            </div>
            <div className="divide-y divide-border">
              {rows.length ? (
                rows.map((item: any) => (
                  <div key={item.id} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                    <span className="text-sm text-foreground">{item.code || '—'}</span>
                    <span className="text-sm text-foreground">{item.name || '—'}</span>
                    <span className="text-sm text-foreground">{item.category || '—'}</span>
                    <span className="text-sm text-foreground">{item.icd10 || '—'}</span>
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-muted-foreground">{tr('لم يتم العثور على تشخيصات.', 'No diagnoses found.')}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('إضافة تشخيص', 'Add Diagnosis')}</DialogTitle>
            <DialogDescription>{tr('أضف تشخيصًا جديدًا إلى الكتالوج', 'Add a new diagnosis to the catalog.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الرمز', 'Code')}</span>
              <Input className="rounded-xl thea-input-focus" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. J00, A00.0" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
              <Input className="rounded-xl thea-input-focus" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acute nasopharyngitis" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الفئة', 'Category')} ({tr('اختياري', 'optional')})</span>
              <Input className="rounded-xl thea-input-focus" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Respiratory" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">ICD-10 ({tr('اختياري', 'optional')})</span>
              <Input className="rounded-xl thea-input-focus" value={icd10} onChange={(e) => setIcd10(e.target.value)} placeholder="e.g. J00" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setAddOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button className="rounded-xl" onClick={createItem} disabled={saving || !code.trim() || !name.trim()}>
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('إنشاء', 'Create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
