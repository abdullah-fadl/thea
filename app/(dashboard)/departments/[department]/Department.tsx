'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const DEPARTMENTS: Record<string, { title: string; key: string }> = {
  opd: { title: 'OPD', key: 'OPD' },
  laboratory: { title: 'Laboratory', key: 'LABORATORY' },
  radiology: { title: 'Radiology', key: 'RADIOLOGY' },
  or: { title: 'Operating Room', key: 'OPERATING_ROOM' },
  'cath-lab': { title: 'Cath Lab', key: 'CATH_LAB' },
  physiotherapy: { title: 'Physiotherapy', key: 'PHYSIOTHERAPY' },
  delivery: { title: 'Delivery / L&D', key: 'DELIVERY' },
  icu: { title: 'Critical Care (ICU)', key: 'CRITICAL_CARE' },
  mortuary: { title: 'Mortuary / Death', key: 'MORTUARY' },
};

const ORDERS_DEPARTMENT_KEYS: Record<string, string> = {
  LABORATORY: 'laboratory',
  RADIOLOGY: 'radiology',
  OPERATING_ROOM: 'operating-room',
  CATH_LAB: 'cath-lab',
};

export default function Department(props: any) {
  const { isRTL } = useLang();
  const { toast } = useToast();
  const { hasPermission, isLoading } = useRoutePermission('/departments');
  const params = props?.params || {};
  const slug = String(params.department || '').trim().toLowerCase();
  const department = DEPARTMENTS[slug];

  const searchParams = useSearchParams();
  const encounterCoreId = searchParams.get('encounterCoreId') || '';
  const [entering, setEntering] = useState(false);
  const [exiting, setExiting] = useState(false);

  const { data } = useSWR(
    hasPermission && encounterCoreId ? `/api/encounters/${encounterCoreId}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: entryData, mutate: mutateEntry } = useSWR(
    hasPermission && encounterCoreId && department
      ? `/api/departments/active?encounterCoreId=${encodeURIComponent(encounterCoreId)}&departmentKey=${department.key}`
      : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const ordersDepartmentKey = department ? ORDERS_DEPARTMENT_KEYS[department.key] : null;
  const { data: ordersData } = useSWR(
    hasPermission && encounterCoreId && ordersDepartmentKey
      ? `/api/orders/queue?departmentKey=${encodeURIComponent(ordersDepartmentKey)}&encounterCoreId=${encodeURIComponent(encounterCoreId)}`
      : null,
    fetcher,
    { refreshInterval: 0 }
  );

  const encounter = data?.encounter || null;
  const patientName = data?.patient?.fullName || null;
  const latestEntry = entryData?.latestEntry || null;
  const activeEntries = Array.isArray(entryData?.items) ? entryData.items : [];
  const isInDepartment = activeEntries.some((item: any) => item.departmentKey === department?.key);
  const orders = Array.isArray(ordersData?.items) ? ordersData.items : [];
  const statusLabel = isInDepartment ? 'IN' : 'OUT';
  const encounterShort = encounterCoreId ? encounterCoreId.slice(0, 8) : '—';

  const header = useMemo(() => {
    if (!department) return 'Department';
    return `${department.title} Shell`;
  }, [department]);

  const enterDepartment = async () => {
    if (!encounterCoreId || !department) return;
    setEntering(true);
    try {
      const res = await fetch('/api/departments/enter', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterCoreId, departmentKey: department.key }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to enter department');
      toast({ title: payload.noOp ? 'Already entered' : 'Entered department' });
      await mutateEntry();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed', variant: 'destructive' });
    } finally {
      setEntering(false);
    }
  };

  const exitDepartment = async () => {
    if (!encounterCoreId || !department) return;
    setExiting(true);
    try {
      const res = await fetch('/api/departments/exit', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterCoreId, departmentKey: department.key }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to exit department');
      toast({ title: payload.noOp ? 'Already exited' : 'Exited department' });
      await mutateEntry();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed', variant: 'destructive' });
    } finally {
      setExiting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle>{header}</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="p-6">
        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle>{header}</CardTitle>
            <CardDescription>Forbidden</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!department) {
    return (
      <div className="p-6">
        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle>Department</CardTitle>
            <CardDescription>Not found</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!encounterCoreId) {
    return (
      <div className="p-6">
        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle>{header}</CardTitle>
            <CardDescription>Missing encounterCoreId</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (encounter && encounter.status === 'CLOSED') {
    return (
      <div className="p-6 space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle>{header}</CardTitle>
            <CardDescription>Closed encounters are read-only</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Encounter {encounter.id} is CLOSED and cannot enter department shells.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <Card className="rounded-2xl border-border">
        <CardHeader>
          <CardTitle>{header}</CardTitle>
          <CardDescription>Structure only — no clinical workflows</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div>
            Department Key: <Badge variant="outline">{department.key}</Badge>
          </div>
          <div>Encounter ID: {encounterShort}</div>
          <div>Patient: {patientName || '—'}</div>
          <div>Core Status: {encounter?.status || '—'}</div>
          <div>
            Status: <Badge variant="outline">{statusLabel}</Badge>
          </div>
          <div>Entered At: {latestEntry?.enteredAt ? new Date(latestEntry.enteredAt).toLocaleString() : '—'}</div>
          <div>Exited At: {latestEntry?.exitedAt ? new Date(latestEntry.exitedAt).toLocaleString() : '—'}</div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={enterDepartment} disabled={entering || isInDepartment}>
              {entering ? 'Entering...' : 'Enter Department'}
            </Button>
            <Button variant="outline" onClick={exitDepartment} disabled={exiting || !isInDepartment}>
              {exiting ? 'Exiting...' : 'Exit Department'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {ordersDepartmentKey ? (
        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle>Active Orders</CardTitle>
            <CardDescription>Read-only operational list</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {orders.map((row: any) => {
              const order = row.order || {};
              return (
                <div key={order.id} className="flex items-center justify-between border border-border rounded-xl p-2 thea-hover-lift">
                  <div>
                    <div className="font-medium">{order.orderName}</div>
                    <div className="text-xs text-muted-foreground">
                      {order.orderCode} • {order.status} • {order.priority}
                    </div>
                  </div>
                  <Badge variant="outline">{order.status}</Badge>
                </div>
              );
            })}
            {!orders.length && <div className="text-sm text-muted-foreground">No active orders.</div>}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
