'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useToast } from '@/hooks/use-toast';
import { useMe } from '@/lib/hooks/useMe';
import { useLang } from '@/hooks/use-lang';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type HandoverPanelProps = {
  encounterCoreId?: string;
  episodeId?: string;
};

function roleKey(role: string) {
  const r = String(role || '').toLowerCase();
  if (r.includes('doctor') || r.includes('physician')) return 'doctor';
  if (r.includes('nurse') || r.includes('nursing')) return 'nurse';
  return r;
}

export function HandoverPanel({ encounterCoreId, episodeId }: HandoverPanelProps) {
  const { me } = useMe();
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [risksText, setRisksText] = useState('');
  const [toRole, setToRole] = useState<'doctor' | 'nurse'>('nurse');
  const [toUserId, setToUserId] = useState('');
  const [busy, setBusy] = useState(false);

  const params = useMemo(() => {
    const qs = new URLSearchParams();
    if (encounterCoreId) qs.set('encounterCoreId', encounterCoreId);
    if (episodeId) qs.set('episodeId', episodeId);
    return qs.toString();
  }, [encounterCoreId, episodeId]);

  const { data, mutate } = useSWR(params ? `/api/handover/by-encounter?${params}` : null, fetcher, {
    refreshInterval: 0,
  });
  const items = Array.isArray(data?.items) ? data.items : [];
  const openHandover = items.find((h: any) => h.status === 'OPEN') || null;

  const createHandover = async () => {
    setBusy(true);
    try {
      const key =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const res = await fetch('/api/handover/create', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterCoreId: encounterCoreId || undefined,
          episodeId: episodeId || undefined,
          fromRole: roleKey(me?.user?.role || ''),
          toRole,
          toUserId: toUserId.trim() || undefined,
          summary: summary.trim(),
          risks: risksText
            .split('\n')
            .map((r) => r.trim())
            .filter(Boolean),
          idempotencyKey: key,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed');
      toast({ title: payload.noOp ? tr('لا تغيير', 'No change') : tr('تم إنشاء التسليم', 'Handover created') });
      setOpen(false);
      setSummary('');
      setRisksText('');
      setToUserId('');
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشل', 'Failed'), variant: 'destructive' as const });
    } finally {
      setBusy(false);
    }
  };

  const finalizeHandover = async (handoverId: string) => {
    setBusy(true);
    try {
      const res = await fetch('/api/handover/finalize', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handoverId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed');
      toast({ title: payload.noOp ? tr('تم الإنهاء مسبقاً', 'Already finalized') : tr('تم إنهاء التسليم', 'Handover finalized') });
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشل', 'Failed'), variant: 'destructive' as const });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr('تسليم المناوبة', 'Shift Handover')}</CardTitle>
        <CardDescription>{tr('استمرارية سريرية منظمة', 'Structured clinical continuity')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {openHandover ? (
          <div className="rounded-md border p-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <div className="font-medium">{tr('تسليم مفتوح', 'Open Handover')}</div>
              <Badge variant="outline">{openHandover.toRole}</Badge>
            </div>
            <div>{openHandover.summary}</div>
            {openHandover.risks?.length ? (
              <div className="text-xs text-muted-foreground">{tr('المخاطر', 'Risks')}: {openHandover.risks.join(', ')}</div>
            ) : null}
            <div className="flex items-center gap-2">
              <Badge variant="outline">{openHandover.status}</Badge>
              <Button size="sm" variant="outline" onClick={() => finalizeHandover(openHandover.id)} disabled={busy}>
                {tr('إنهاء التسليم', 'Finalize Handover')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">{tr('لا يوجد تسليم مفتوح.', 'No open handover.')}</div>
        )}

        <Button variant="outline" onClick={() => setOpen(true)}>
          {tr('إنشاء تسليم', 'Create Handover')}
        </Button>

        <div className="space-y-2 text-sm">
          <div className="font-medium">{tr('سجل التسليمات', 'Handover History')}</div>
          {items.length ? (
            items.map((item: any) => (
              <div key={item.id} className="rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <span>{item.summary}</span>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : '\u2014'}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">{tr('لا توجد تسليمات بعد.', 'No handovers yet.')}</div>
          )}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('إنشاء تسليم', 'Create Handover')}</DialogTitle>
            <DialogDescription>{tr('ملخص إضافي فقط', 'Summary only')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{tr('الدور المستلم', 'Receiving Role')}</Label>
              <Select value={toRole} onValueChange={(value) => setToRole(value as 'doctor' | 'nurse')}>
                <SelectTrigger>
                  <SelectValue placeholder={tr('الدور', 'Role')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="doctor">{tr('طبيب', 'Doctor')}</SelectItem>
                  <SelectItem value="nurse">{tr('ممرض', 'Nurse')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{tr('المستخدم المستلم (اختياري)', 'Receiving User (optional)')}</Label>
              <Input value={toUserId} onChange={(e) => setToUserId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{tr('الملخص', 'Summary')}</Label>
              <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{tr('المخاطر (سطر لكل خطر)', 'Risks (one per line)')}</Label>
              <Textarea value={risksText} onChange={(e) => setRisksText(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={createHandover} disabled={busy || !summary.trim()}>
              {busy ? tr('جاري الحفظ...', 'Saving...') : tr('إنشاء', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
