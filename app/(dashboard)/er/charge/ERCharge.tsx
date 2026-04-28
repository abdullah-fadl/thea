'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useMe } from '@/lib/hooks/useMe';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type FilterKey = 'overdue' | 'escalations' | 'transfers' | 'sepsis';

export default function ERCharge() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { me } = useMe();
  const { toast } = useToast();
  const { hasPermission, isLoading } = useRoutePermission('/er/charge');

  const tenantId = String(me?.tenantId || '');
  const email = String(me?.user?.email || '');
  const role = String(me?.user?.role || '');
  const canAccess = canAccessChargeConsole({ email, tenantId, role });

  const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());
  const { data, isLoading: overviewLoading, mutate } = useSWR(
    hasPermission && canAccess ? '/api/er/charge/overview' : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: usersData } = useSWR(
    hasPermission && canAccess ? '/api/er/nursing/users' : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const typedUsersData = usersData as { items?: Array<{ id: string; display: string }> } | undefined;
  const users = Array.isArray(typedUsersData?.items) ? typedUsersData.items : [];

  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
    overdue: false,
    escalations: false,
    transfers: false,
    sepsis: false,
  });

  const typedData = data as {
    encounters?: Record<string, unknown>[];
    openEscalations?: Record<string, unknown>[];
    openTransferRequests?: Record<string, unknown>[];
    counts?: Record<string, number>;
  } | undefined;
  const encounters = Array.isArray(typedData?.encounters) ? typedData.encounters : [];
  const openEscalations = Array.isArray(typedData?.openEscalations) ? typedData.openEscalations : [];
  const openTransfers = Array.isArray(typedData?.openTransferRequests) ? typedData.openTransferRequests : [];
  const counts = typedData?.counts || {};

  const filteredEncounters = useMemo(() => {
    const anyFilter = Object.values(filters).some(Boolean);
    if (!anyFilter) return encounters;
    return encounters.filter((e: Record<string, unknown>) => {
      if (filters.overdue && !(e.vitalsOverdue || e.tasksOverdue)) return false;
      if (filters.escalations && !e.hasOpenEscalation) return false;
      if (filters.transfers && !e.hasOpenTransferRequest) return false;
      if (filters.sepsis && !e.sepsisSuspected) return false;
      return true;
    });
  }, [encounters, filters]);

  const [approveDialog, setApproveDialog] = useState<{ requestId: string; encounterId: string } | null>(null);
  const [approveNewNurseId, setApproveNewNurseId] = useState('');
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const resolveEscalation = async (escalationId: string) => {
    setActionBusyId(escalationId);
    try {
      const res = await fetch('/api/er/nursing/escalations/resolve', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escalationId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || tr('فشل حل التصعيد', 'Failed to resolve escalation'));
      toast({ title: tr('نجاح', 'Success'), description: tr('تم إغلاق التصعيد.', 'Escalation resolved.') });
      await mutate();
    } catch (err: unknown) {
      toast({ title: tr('خطأ', 'Error'), description: (err as Record<string, unknown>)?.message as string || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
    } finally {
      setActionBusyId(null);
    }
  };

  const resolveTransfer = async (args: {
    requestId: string;
    encounterId: string;
    action: 'APPROVE' | 'REJECT' | 'CANCEL';
    newPrimaryNurseUserId?: string;
  }) => {
    setActionBusyId(args.requestId);
    try {
      const res = await fetch('/api/er/nursing/transfer-requests/resolve', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterId: args.encounterId,
          requestId: args.requestId,
          action: args.action,
          newPrimaryNurseUserId: args.newPrimaryNurseUserId,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || tr('فشلت العملية', 'Failed'));
      toast({ title: tr('نجاح', 'Success'), description: language === 'ar' ? `تم تنفيذ إجراء النقل: ${args.action}` : `Transfer ${args.action.toLowerCase()}d.` });
      await mutate();
    } catch (err: unknown) {
      toast({ title: tr('خطأ', 'Error'), description: (err as Record<string, unknown>)?.message as string || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
    } finally {
      setActionBusyId(null);
    }
  };

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  if (!canAccess) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">{tr('وحدة التحكم', 'Charge Console')}</h2>
            <p className="text-sm text-muted-foreground">{tr('الوصول محدود لأدوار المشرف/المسؤول.', 'Access is limited to charge/supervisor/admin roles.')}</p>
            <div className="text-sm text-muted-foreground">{tr('محظور.', 'Forbidden.')}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{tr('وحدة تحكم الطوارئ', 'ER Charge Console')}</h1>
            <p className="text-sm text-muted-foreground">{tr('نظرة تشغيلية عامة.', 'Operational overview (deterministic, audit-first, no notifications).')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('الزيارات', 'Visits')}: {counts.encounters ?? encounters.length}</span>
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('متأخر', 'Overdue')}: {counts.overdueEncounters ?? '—'}</span>
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('تصعيدات', 'Escalations')}: {counts.openEscalations ?? openEscalations.length}</span>
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('نقل', 'Transfers')}: {counts.openTransferRequests ?? openTransfers.length}</span>
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('إنتان', 'Sepsis')}: {counts.sepsisSuspected ?? '—'}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{tr('الفلاتر', 'Filters')}</h2>
          <p className="text-sm text-muted-foreground">{tr('تبديل لتضييق القائمة الحية.', 'Toggle to narrow the live list.')}</p>
          <div className="flex flex-wrap gap-6">
            {(['overdue', 'escalations', 'transfers', 'sepsis'] as FilterKey[]).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <Switch
                  checked={filters[k]}
                  onCheckedChange={(v) => setFilters((p) => ({ ...p, [k]: Boolean(v) }))}
                />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {k === 'overdue'
                    ? tr('المتأخر فقط', 'Overdue only')
                    : k === 'escalations'
                    ? tr('التصعيدات فقط', 'Escalations only')
                    : k === 'transfers'
                    ? tr('النقل فقط', 'Transfers only')
                    : tr('الإنتان فقط', 'Sepsis only')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Live ER list */}
        <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{tr('قائمة الطوارئ الحية', 'Live ER list')}</h2>
          <p className="text-sm text-muted-foreground">{tr('جميع الزيارات (تحديث مستمر).', 'All visits (polling).')}</p>
          {overviewLoading && <div className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>}
          {!overviewLoading && filteredEncounters.length === 0 && (
            <div className="text-sm text-muted-foreground">{tr('لا توجد زيارات تطابق الفلاتر المحددة.', 'No visits match the selected filters.')}</div>
          )}
          {!overviewLoading && filteredEncounters.length > 0 && (
            <div>
              <div className="grid grid-cols-8 gap-4 px-4 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المريض', 'Patient')}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الرقم الطبي', 'MRN')}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الفرز', 'Triage')}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السرير', 'Bed')}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الممرض الرئيسي', 'Primary Nurse')}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الشارات', 'Badges')}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">{tr('إجراء', 'Action')}</span>
              </div>
              <div className="divide-y divide-border">
                {filteredEncounters.map((e: Record<string, unknown>) => {
                  const mrn = e.mrn || e.tempMrn || '—';
                  return (
                    <div key={String(e.encounterId)} className="grid grid-cols-8 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                      <span className="text-sm text-foreground font-medium">{String(e.patientName || tr('غير معروف', 'Unknown'))}</span>
                      <span className="text-sm text-foreground">
                        <span className="text-xs text-muted-foreground">{String(mrn)}</span>
                        <div className="text-[11px] text-muted-foreground">{tr('زيارة الطوارئ', 'ER Visit')}: {String(e.visitNumber || 'ER-—')}</div>
                      </span>
                      <span className="text-sm text-foreground text-xs text-muted-foreground">{String(e.triageLevel ?? '—')}</span>
                      <span className="text-sm text-foreground text-xs text-muted-foreground">{String(e.status || '—')}</span>
                      <span className="text-sm text-foreground text-xs text-muted-foreground">{String(e.bedLabel || '—')}</span>
                      <span className="text-sm text-foreground text-xs text-muted-foreground">{String(e.primaryNurseDisplay || '—')}</span>
                      <span className="text-sm text-foreground">
                        <div className="flex flex-wrap gap-2">
                          {e.vitalsOverdue && <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{tr('مؤشرات متأخرة', 'Vitals overdue')}</span>}
                          {e.tasksOverdue && <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{tr('مهام متأخرة', 'Tasks overdue')}</span>}
                          {e.hasOpenEscalation && <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{tr('تصعيد', 'Escalation')}</span>}
                          {e.hasOpenTransferRequest && <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{tr('نقل', 'Transfer')}</span>}
                          {e.sepsisSuspected && <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('إنتان', 'Sepsis')}</span>}
                        </div>
                      </span>
                      <span className="text-sm text-foreground text-right">
                        <Button asChild size="sm" variant="outline" className="rounded-xl">
                          <Link href={`/er/encounter/${e.encounterId}`}>{tr('عرض الزيارة', 'View Visit')}</Link>
                        </Button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Open Escalations */}
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">{tr('التصعيدات المفتوحة', 'Open Escalations')}</h2>
            <p className="text-sm text-muted-foreground">{tr('المفتوحة فقط. الحل مُدقَّق.', 'OPEN only. Resolve is audited.')}</p>
            <div className="space-y-2">
              {openEscalations.length === 0 && <div className="text-sm text-muted-foreground">{tr('لا توجد تصعيدات مفتوحة.', 'No open escalations.')}</div>}
              {openEscalations.length > 0 && (
                <div>
                  <div className="grid grid-cols-4 gap-4 px-4 py-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المريض', 'Patient')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الأولوية', 'Urgency')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السبب', 'Reason')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">{tr('إجراء', 'Action')}</span>
                  </div>
                  <div className="divide-y divide-border">
                    {openEscalations.map((e: Record<string, unknown>) => {
                      const mrn = String(e.mrn || e.tempMrn || '—');
                      const busy = actionBusyId === String(e.id);
                      return (
                        <div key={String(e.id)} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                          <span className="text-sm text-foreground">
                            <div className="font-medium">{String(e.patientName || tr('غير معروف', 'Unknown'))}</div>
                            <div className="text-xs text-muted-foreground">{mrn}</div>
                          </span>
                          <span className="text-sm text-foreground text-xs text-muted-foreground">{String(e.urgency || tr('روتيني', 'ROUTINE'))}</span>
                          <span className="text-sm text-foreground">{String(e.reason)}</span>
                          <span className="text-sm text-foreground text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl"
                              disabled={busy}
                              onClick={() => resolveEscalation(String(e.id))}
                            >
                              {tr('حل', 'Resolve')}
                            </Button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Open Transfer Requests */}
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">{tr('طلبات النقل المفتوحة', 'Open Transfer Requests')}</h2>
            <p className="text-sm text-muted-foreground">{tr('المفتوحة فقط. الموافقة تنفذ نقل الممرض الرئيسي (مُدقَّق).', 'OPEN only. Approve executes primary nurse transfer (audited).')}</p>
            <div className="space-y-2">
              {openTransfers.length === 0 && <div className="text-sm text-muted-foreground">{tr('لا توجد طلبات نقل مفتوحة.', 'No open transfer requests.')}</div>}
              {openTransfers.length > 0 && (
                <div>
                  <div className="grid grid-cols-4 gap-4 px-4 py-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المريض', 'Patient')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الأولوية', 'Urgency')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('مطلوب بواسطة', 'Requested by')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">{tr('إجراءات', 'Actions')}</span>
                  </div>
                  <div className="divide-y divide-border">
                    {openTransfers.map((r: Record<string, unknown>) => {
                      const mrn = String(r.mrn || r.tempMrn || '—');
                      const busy = actionBusyId === String(r.id);
                      return (
                        <div key={String(r.id)} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                          <span className="text-sm text-foreground">
                            <div className="font-medium">{String(r.patientName || tr('غير معروف', 'Unknown'))}</div>
                            <div className="text-xs text-muted-foreground">{mrn}</div>
                          </span>
                          <span className="text-sm text-foreground text-xs text-muted-foreground">{String(r.urgency || tr('روتيني', 'ROUTINE'))}</span>
                          <span className="text-sm text-foreground text-xs text-muted-foreground">{String(r.requestedByDisplay || '—')}</span>
                          <span className="text-sm text-foreground text-right">
                            <div className="inline-flex flex-wrap gap-2 justify-end">
                              <Button
                                size="sm"
                                className="rounded-xl"
                                disabled={busy}
                                onClick={() => {
                                  setApproveDialog({ requestId: String(r.id), encounterId: String(r.encounterId) });
                                  setApproveNewNurseId('');
                                }}
                              >
                                {tr('موافقة', 'Approve')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-xl"
                                disabled={busy}
                                onClick={() => resolveTransfer({ requestId: String(r.id), encounterId: String(r.encounterId), action: 'REJECT' })}
                              >
                                {tr('رفض', 'Reject')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-xl"
                                disabled={busy}
                                onClick={() => resolveTransfer({ requestId: String(r.id), encounterId: String(r.encounterId), action: 'CANCEL' })}
                              >
                                {tr('إلغاء', 'Cancel')}
                              </Button>
                            </div>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={Boolean(approveDialog)}
        onOpenChange={(open) => {
          if (!open) {
            setApproveDialog(null);
            setApproveNewNurseId('');
          }
        }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('موافقة على النقل', 'Approve Transfer')}</DialogTitle>
            <DialogDescription>{tr('اختر الممرض الرئيسي الجديد.', 'Select the new Primary Nurse.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الممرض الرئيسي الجديد', 'New Primary Nurse')}</span>
            <Select value={approveNewNurseId} onValueChange={setApproveNewNurseId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={tr('اختر مستخدم', 'Select user')} />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.display}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setApproveDialog(null)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button
              className="rounded-xl"
              disabled={!approveDialog || !approveNewNurseId}
              onClick={async () => {
                if (!approveDialog) return;
                await resolveTransfer({
                  requestId: approveDialog.requestId,
                  encounterId: approveDialog.encounterId,
                  action: 'APPROVE',
                  newPrimaryNurseUserId: approveNewNurseId,
                });
                setApproveDialog(null);
                setApproveNewNurseId('');
              }}
            >
              {tr('موافقة ونقل', 'Approve & Transfer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
