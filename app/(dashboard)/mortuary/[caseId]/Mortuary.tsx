'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useMe } from '@/lib/hooks/useMe';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function Mortuary({ params }: { params: { caseId: string } }) {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const { me } = useMe();
  const { hasPermission, isLoading } = useRoutePermission('/mortuary');
  const caseId = String(params.caseId || '').trim();

  const tenantId = String(me?.tenantId || '');
  const email = String(me?.user?.email || '');
  const role = String(me?.user?.role || '');
  const canAccess = canAccessChargeConsole({ email, tenantId, role });

  const { data, mutate } = useSWR(
    hasPermission && caseId ? `/api/mortuary/${encodeURIComponent(caseId)}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const mortuaryCase = data?.mortuaryCase || null;

  const [morgueRoom, setMorgueRoom] = useState('');
  const [shelf, setShelf] = useState('');
  const [status, setStatus] = useState<'RELEASED_TO_FAMILY' | 'TRANSFERRED_OUT'>('RELEASED_TO_FAMILY');
  const [releasedAt, setReleasedAt] = useState('');
  const [releasedTo, setReleasedTo] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const saveLocation = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/mortuary/${encodeURIComponent(caseId)}/location`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ morgueRoom, shelf }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed');
      toast({ title: payload.noOp ? tr('لا تغيير', 'No change') : tr('تم تحديث الموقع', 'Location updated') });
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشل', 'Failed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/mortuary/${encodeURIComponent(caseId)}/status`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          releaseDetails: status === 'RELEASED_TO_FAMILY'
            ? { releasedAt, releasedTo, idNumber, reason }
            : null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed');
      toast({ title: payload.noOp ? tr('لا تغيير', 'No change') : tr('تم تحديث الحالة', 'Status updated') });
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشل', 'Failed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;
  if (!canAccess) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 max-w-4xl space-y-4">
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-extrabold text-base">{tr('حالة المشرحة', 'Mortuary Case')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{tr('متابعة تشغيلية فقط.', 'Operational tracking only.')}</p>
        </div>
        <div className="p-5 space-y-2 text-sm">
          <div>{tr('معرف الحالة:', 'Case ID:')} {caseId}</div>
          <div>{tr('الحالة:', 'Status:')} {mortuaryCase?.status || '\u2014'}</div>
          <div>{tr('رقم البطاقة:', 'Body Tag:')} {mortuaryCase?.bodyTagNumber || '\u2014'}</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-extrabold text-base">{tr('الموقع', 'Location')}</h2>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('غرفة المشرحة', 'Morgue Room')}</span>
              <Input className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast" value={morgueRoom} onChange={(e) => setMorgueRoom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الرف', 'Shelf')}</span>
              <Input className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast" value={shelf} onChange={(e) => setShelf(e.target.value)} />
            </div>
          </div>
          <Button className="rounded-xl" onClick={saveLocation} disabled={busy}>
            {tr('حفظ الموقع', 'Save Location')}
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-extrabold text-base">{tr('الحالة', 'Status')}</h2>
        </div>
        <div className="p-5 space-y-3">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
            <Select value={status} onValueChange={(value) => setStatus(value as 'RELEASED_TO_FAMILY' | 'TRANSFERRED_OUT')}>
              <SelectTrigger>
                <SelectValue placeholder={tr('الحالة', 'Status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RELEASED_TO_FAMILY">{tr('سُلِّم للعائلة', 'Released to Family')}</SelectItem>
                <SelectItem value="TRANSFERRED_OUT">{tr('محوَّل للخارج', 'Transferred Out')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {status === 'RELEASED_TO_FAMILY' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('تاريخ التسليم', 'Released At')}</span>
                <Input className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast" value={releasedAt} onChange={(e) => setReleasedAt(e.target.value)} placeholder="YYYY-MM-DD HH:mm" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('سُلِّم إلى', 'Released To')}</span>
                <Input className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast" value={releasedTo} onChange={(e) => setReleasedTo(e.target.value)} />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رقم الهوية', 'ID Number')}</span>
                <Input className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السبب', 'Reason')}</span>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </div>
          ) : null}
          <Button className="rounded-xl" onClick={updateStatus} disabled={busy}>
            {tr('تحديث الحالة', 'Update Status')}
          </Button>
        </div>
      </div>
    </div>
  );
}
