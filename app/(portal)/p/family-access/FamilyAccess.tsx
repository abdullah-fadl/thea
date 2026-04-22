'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

const RELATIONSHIPS = ['PARENT', 'GUARDIAN', 'CAREGIVER', 'SPOUSE', 'OTHER'] as const;

function relLabel(r: string, tr: (a: string, e: string) => string) {
  const m: Record<string, [string, string]> = {
    PARENT: ['والد/ة', 'Parent'], GUARDIAN: ['وصي', 'Guardian'], CAREGIVER: ['مقدم رعاية', 'Caregiver'],
    SPOUSE: ['زوج/ة', 'Spouse'], OTHER: ['أخرى', 'Other'],
  };
  return tr(m[r]?.[0] || r, m[r]?.[1] || r);
}

export default function FamilyAccess() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();

  const { data, mutate } = useSWR('/api/portal/proxy-access', fetcher, { refreshInterval: 30000 });
  const accesses = data?.accesses || [];

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ patientId: '', proxyName: '', relationship: 'PARENT', scope: 'ALL' });

  const grantAccess = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/proxy-access', { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (res.ok) { toast({ title: tr('تم منح الوصول', 'Access granted') }); mutate(); setShowAdd(false); }
    } catch { toast({ title: tr('فشل', 'Failed'), variant: 'destructive' }); }
  }, [form, mutate, toast, tr]);

  const revokeAccess = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/portal/proxy-access/${id}/revoke`, { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (res.ok) { toast({ title: tr('تم إلغاء الوصول', 'Access revoked') }); mutate(); }
    } catch { toast({ title: tr('فشل', 'Failed'), variant: 'destructive' }); }
  }, [mutate, toast, tr]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{tr('وصول العائلة', 'Family Access')}</h1>
        <Button onClick={() => setShowAdd(!showAdd)}>{showAdd ? tr('إلغاء', 'Cancel') : tr('إضافة وصول', 'Add Access')}</Button>
      </div>

      {showAdd && (
        <Card>
          <CardHeader><CardTitle>{tr('منح وصول جديد', 'Grant New Access')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder={tr('معرف المريض', 'Patient ID')} value={form.patientId} onChange={e => setForm(p => ({ ...p, patientId: e.target.value }))} />
            <Input placeholder={tr('اسم الوكيل', 'Proxy name')} value={form.proxyName} onChange={e => setForm(p => ({ ...p, proxyName: e.target.value }))} />
            <Select value={form.relationship} onValueChange={v => setForm(p => ({ ...p, relationship: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map(r => <SelectItem key={r} value={r}>{relLabel(r, tr)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={grantAccess}>{tr('منح الوصول', 'Grant Access')}</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {accesses.map((a: any) => (
          <Card key={a.id}>
            <CardContent className="pt-4 flex justify-between items-center">
              <div>
                <span className="font-medium">{a.proxyName}</span>
                <Badge variant="outline" className="ml-2">{relLabel(a.relationship, tr)}</Badge>
                <span className="text-sm text-muted-foreground ml-3">{tr('النطاق', 'Scope')}: {a.scope}</span>
              </div>
              <div className="flex gap-2 items-center">
                <Badge className={a.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-muted'}>{a.status}</Badge>
                {a.status === 'ACTIVE' && <Button size="sm" variant="destructive" onClick={() => revokeAccess(a.id)}>{tr('إلغاء', 'Revoke')}</Button>}
              </div>
            </CardContent>
          </Card>
        ))}
        {accesses.length === 0 && <Card><CardContent className="pt-6 text-center text-muted-foreground">{tr('لا يوجد وصول عائلي', 'No family access configured')}</CardContent></Card>}
      </div>
    </div>
  );
}
