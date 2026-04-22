'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type OrderSetPanelProps = {
  encounterType: 'ER' | 'OPD' | 'IPD';
  encounterId: string;
  canApply: boolean;
};

export function OrderSetsPanel({ encounterType, encounterId, canApply }: OrderSetPanelProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);

  const setsUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('scope', encounterType);
    return `/api/order-sets?${params.toString()}`;
  }, [encounterType]);
  const { data: setsData } = useSWR(encounterId ? setsUrl : null, fetcher, { refreshInterval: 0 });
  const sets = Array.isArray(setsData?.items) ? setsData.items : [];

  const itemsUrl = selectedId ? `/api/order-sets/${encodeURIComponent(selectedId)}/items` : null;
  const { data: itemsData } = useSWR(itemsUrl, fetcher, { refreshInterval: 0 });
  const items = Array.isArray(itemsData?.items) ? itemsData.items : [];

  const applicationsUrl = encounterId
    ? `/api/order-sets/applications?encounterType=${encodeURIComponent(encounterType)}&encounterId=${encodeURIComponent(encounterId)}`
    : null;
  const { data: applicationsData } = useSWR(applicationsUrl, fetcher, { refreshInterval: 0 });
  const applications = Array.isArray(applicationsData?.items) ? applicationsData.items : [];

  const applySet = async () => {
    if (!selectedId || !encounterId) return;
    setApplyBusy(true);
    try {
      const res = await fetch(`/api/order-sets/${encodeURIComponent(selectedId)}/apply`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterType, encounterId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed');
      toast({ title: payload.noOp ? tr('تم التطبيق مسبقاً', 'Already applied') : tr('تم تطبيق مجموعة الطلبات', 'Order set applied') });
      setPreviewOpen(false);
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشل', 'Failed'), variant: 'destructive' as const });
    } finally {
      setApplyBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr('مجموعات الطلبات', 'Order Sets')}</CardTitle>
        <CardDescription>{tr('تطبيق مجموعة طلبات جاهزة', 'Apply a prepared set of orders')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder={tr('اختر مجموعة طلبات', 'Select order set')} />
            </SelectTrigger>
            <SelectContent>
              {sets.map((set: any) => (
                <SelectItem key={set.id} value={set.id}>
                  {set.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" disabled={!selectedId} onClick={() => setPreviewOpen(true)}>
            {tr('معاينة', 'Preview')}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">{tr('مجموعات الطلبات المطبقة', 'Applied Order Sets')}</div>
        {applications.length ? (
          <div className="space-y-1 text-xs">
            {applications.map((app: any) => (
              <div key={app.id} className="flex items-center justify-between">
                <span>{String(app.orderSetId || '').slice(0, 8)}</span>
                <span>{app.appliedAt ? new Date(app.appliedAt).toLocaleString() : '—'}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">{tr('لا توجد تطبيقات بعد', 'No applications yet.')}</div>
        )}
      </CardContent>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('معاينة مجموعة الطلبات', 'Order Set Preview')}</DialogTitle>
            <DialogDescription>{tr('الطلبات التي سيتم إنشاؤها', 'Orders that will be created')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {items.length ? (
              items.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between">
                  <span>
                    {item.displayName} <span className="text-xs text-muted-foreground">({item.orderCode})</span>
                  </span>
                  <Badge variant="outline">{item.kind}</Badge>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">{tr('لا توجد عناصر', 'No items.')}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={applySet} disabled={!canApply || applyBusy || !selectedId}>
              {applyBusy ? tr('جاري التطبيق...', 'Applying...') : tr('تطبيق', 'Apply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
