'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useMe } from '@/lib/hooks/useMe';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

function OrderNoteIndicator({ orderId, patientMasterId }: { orderId: string; patientMasterId?: string | null }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { data } = useSWR(orderId ? `/api/orders/context?orderId=${encodeURIComponent(orderId)}` : null, fetcher, {
    refreshInterval: 0,
  });
  const noteId = data?.noteId ? String(data.noteId) : '';

  if (noteId && patientMasterId) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-full text-[11px] font-bold px-2.5 py-0.5 border border-border text-muted-foreground">{tr('مرتبط', 'Linked')}</span>
        <Link
          href={`/patient/${encodeURIComponent(patientMasterId)}/journey#note-${noteId}`}
          className="px-3 py-1 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted thea-transition-fast"
        >
          {tr('فتح الملاحظة', 'Open Note')}
        </Link>
      </div>
    );
  }

  return <span className="rounded-full text-[11px] font-bold px-2.5 py-0.5 border border-border text-muted-foreground">{noteId ? tr('مرتبط', 'Linked') : tr('غير مرتبط', 'Not linked')}</span>;
}

const ALL_DEPARTMENTS = [
  { key: 'laboratory', label: 'Laboratory', labelAr: '\u0645\u062e\u062a\u0628\u0631' },
  { key: 'radiology', label: 'Radiology', labelAr: '\u0623\u0634\u0639\u0629' },
  { key: 'operating-room', label: 'Procedures', labelAr: '\u0625\u062c\u0631\u0627\u0621\u0627\u062a' },
];

export default function Orders() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const { hasPermission, isLoading } = useRoutePermission('/orders');
  const { me } = useMe();

  // Fetch tenant-user to get department assignment
  const { data: tenantUserData } = useSWR(
    hasPermission ? '/api/access/tenant-user' : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const userDepartments: string[] = Array.isArray(tenantUserData?.tenantUser?.departments)
    ? tenantUserData.tenantUser.departments.map((d: string) => String(d || '').trim().toLowerCase()).filter(Boolean)
    : [];
  const userRoles: string[] = Array.isArray(tenantUserData?.tenantUser?.roles)
    ? tenantUserData.tenantUser.roles.map((r: string) => String(r || '').trim().toLowerCase())
    : [];
  const isAdminDev = userRoles.includes('admin') || userRoles.includes('dev');

  // Filter visible tabs: if user has departments assigned, show only those. Admin/dev see all.
  const visibleDepartments = useMemo(() => {
    if (isAdminDev || !userDepartments.length) return ALL_DEPARTMENTS;
    return ALL_DEPARTMENTS.filter((dept) => userDepartments.includes(dept.key));
  }, [userDepartments, isAdminDev]);

  // Default tab: user's first department, or 'laboratory'
  const defaultTab = visibleDepartments.length > 0 ? visibleDepartments[0].key : 'laboratory';
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Sync activeTab when visibleDepartments loads (initial render has empty departments)
  useEffect(() => {
    if (visibleDepartments.length > 0 && !visibleDepartments.find((d) => d.key === activeTab)) {
      setActiveTab(visibleDepartments[0].key);
    }
  }, [visibleDepartments, activeTab]);
  const [selected, setSelected] = useState<any>(null);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignDisplay, setAssignDisplay] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [resultSummary, setResultSummary] = useState('');
  const [resultText, setResultText] = useState('');
  const [busy, setBusy] = useState(false);
  const [orCaseId, setOrCaseId] = useState<string | null>(null);

  const queueUrl = useMemo(() => `/api/orders/queue?departmentKey=${encodeURIComponent(activeTab)}`, [activeTab]);
  const { data, mutate } = useSWR(hasPermission ? queueUrl : null, fetcher, { refreshInterval: 0 });
  const rows = Array.isArray(data?.items) ? data.items : [];

  useEffect(() => {
    setOrCaseId(null);
  }, [selected?.id]);

  const handleAction = async (path: string, body?: any) => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(path, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Action failed');
      toast({ title: payload.noOp ? tr('لا تغيير', 'No change') : tr('تم التحديث', 'Updated') });
      await mutate();
      if (payload.order) setSelected(payload.order);
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشل', 'Failed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const submitResult = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const payload = {
        summaryText: resultSummary.trim() || undefined,
        attachments: resultText.trim()
          ? [{ type: 'TEXT', label: 'Result Text', text: resultText.trim() }]
          : [],
      };
      const res = await fetch(`/api/orders/${selected.id}/results`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add result');
      toast({ title: tr('تم حفظ النتيجة', 'Result saved') });
      setResultSummary('');
      setResultText('');
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشل', 'Failed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const createOrCase = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch('/api/or/cases/create-from-order', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: selected.id }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to create OR case');
      const id = payload?.case?.id ? String(payload.case.id) : '';
      if (id) setOrCaseId(id);
      toast({ title: payload.noOp ? tr('تم إنشاؤها مسبقاً', 'Already created') : tr('تم إنشاء حالة غرفة العمليات', 'OR case created') });
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشل', 'Failed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 md:p-6">
      {/* Card wrapper */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">{tr('مركز الطلبات', 'Orders Hub')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{tr('قوائم انتظار العمليات بين الأقسام', 'Cross-department operational queues')}</p>
        </div>

        {/* TheaTab pills */}
        <div className="px-5 pt-4">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted w-fit">
            {visibleDepartments.map((dept) => (
              <button
                key={dept.key}
                onClick={() => setActiveTab(dept.key)}
                className={`px-4 py-2 text-sm rounded-xl thea-transition-fast ${
                  activeTab === dept.key
                    ? 'bg-card text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                }`}
              >
                {language === 'ar' ? dept.labelAr : dept.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table as div-based grid rows */}
        <div className="p-5">
          {/* Header row */}
          <div className="hidden md:grid grid-cols-8 gap-3 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
            <div>{tr('التاريخ', 'Created')}</div>
            <div>{tr('المريض', 'Patient')}</div>
            <div>{tr('الزيارة', 'Encounter')}</div>
            <div>{tr('الطلب', 'Order')}</div>
            <div>{tr('الأولوية', 'Priority')}</div>
            <div>{tr('الحالة', 'Status')}</div>
            <div>{tr('مُسند إلى', 'Assigned')}</div>
            <div>{tr('ملاحظة', 'Note')}</div>
          </div>

          {/* Data rows */}
          {rows.length ? (
            rows.map((row: any) => {
              const order = row.order || {};
              const patient = row.patient || {};
              return (
                <div
                  key={order.id}
                  onClick={() => setSelected(order)}
                  className="grid grid-cols-1 md:grid-cols-8 gap-2 md:gap-3 px-3 py-3 border-b border-border last:border-b-0 cursor-pointer hover:bg-muted/50 thea-transition-fast rounded-xl"
                >
                  <div className="text-xs text-muted-foreground">
                    {order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}
                  </div>
                  <div className="text-sm text-foreground font-medium">{patient.fullName || tr('غير معروف', 'Unknown')}</div>
                  <div className="text-xs text-muted-foreground">{String(order.encounterCoreId || '').slice(0, 8)}</div>
                  <div className="text-sm text-foreground">{order.orderName}</div>
                  <div>
                    <span className="rounded-full text-[11px] font-bold px-2.5 py-0.5 border border-border text-muted-foreground">
                      {order.priority || 'ROUTINE'}
                    </span>
                  </div>
                  <div>
                    <span className="rounded-full text-[11px] font-bold px-2.5 py-0.5 border border-border text-muted-foreground">
                      {order.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {order.assignedTo?.display || order.assignedTo?.userId || '—'}
                  </div>
                  <div>
                    <OrderNoteIndicator orderId={order.id} patientMasterId={order.patientMasterId || patient?.id} />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-3 py-8 text-sm text-muted-foreground text-center">
              {tr('لا توجد طلبات في القائمة.', 'No orders in queue.')}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div
            className="bg-card rounded-2xl shadow-xl border border-border max-w-lg w-full max-h-[85vh] overflow-y-auto thea-scroll"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border">
              <h3 className="text-base font-bold text-foreground">{tr('تفاصيل الطلب', 'Order Details')}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{tr('إجراءات دورة الحياة حتمية.', 'Lifecycle actions are deterministic.')}</p>
            </div>

            <div className="p-5 space-y-4 text-sm">
              <div>
                <div className="font-medium text-foreground">{selected.orderName}</div>
                <div className="text-xs text-muted-foreground">
                  {selected.kind} • {selected.orderCode} • {selected.priority}
                </div>
              </div>

              {(String(selected.kind || '').toUpperCase() === 'PROCEDURE' ||
                String(selected.departmentKey || '').toLowerCase() === 'operating-room') ? (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('حالة غرفة العمليات', 'OR Case')}</label>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={createOrCase} disabled={busy} className="px-3 py-1.5 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted thea-transition-fast disabled:opacity-50">
                      {tr('إنشاء حالة غرفة العمليات', 'Create OR Case')}
                    </button>
                    {orCaseId ? (
                      <Link href={`/or/cases/${encodeURIComponent(orCaseId)}`} className="px-3 py-1.5 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted thea-transition-fast">
                        {tr('فتح حالة غرفة العمليات', 'Open OR Case')}
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button onClick={() => handleAction(`/api/orders/${selected.id}/accept`)} disabled={busy} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 thea-transition-fast">
                  {tr('قبول', 'Accept')}
                </button>
                <button onClick={() => handleAction(`/api/orders/${selected.id}/start`)} disabled={busy} className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted thea-transition-fast disabled:opacity-50">
                  {tr('بدء', 'Start')}
                </button>
                <button onClick={() => handleAction(`/api/orders/${selected.id}/result-ready`)} disabled={busy} className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted thea-transition-fast disabled:opacity-50">
                  {tr('النتيجة جاهزة', 'Result Ready')}
                </button>
                <button onClick={() => handleAction(`/api/orders/${selected.id}/complete`)} disabled={busy} className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted thea-transition-fast disabled:opacity-50">
                  {tr('إكمال', 'Complete')}
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('إسناد', 'Assign')}</label>
                <div className="grid gap-2 md:grid-cols-2">
                  <input placeholder={tr('معرف المستخدم', 'User ID')} value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border-[1.5px] border-border bg-background text-foreground text-sm thea-input-focus" />
                  <input placeholder={tr('اسم العرض', 'Display name')} value={assignDisplay} onChange={(e) => setAssignDisplay(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border-[1.5px] border-border bg-background text-foreground text-sm thea-input-focus" />
                </div>
                <button
                  onClick={() =>
                    handleAction(`/api/orders/${selected.id}/assign`, {
                      assignedTo: { userId: assignUserId || null, display: assignDisplay || null },
                    })
                  }
                  disabled={busy}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted thea-transition-fast disabled:opacity-50"
                >
                  {tr('إسناد', 'Assign')}
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النتائج', 'Results')}</label>
                <textarea placeholder={tr('الملخص', 'Summary')} value={resultSummary} onChange={(e) => setResultSummary(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border-[1.5px] border-border bg-background text-foreground text-sm thea-input-focus min-h-[60px] resize-none" />
                <textarea placeholder={tr('نص النتيجة المرفق', 'Result text attachment')} value={resultText} onChange={(e) => setResultText(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border-[1.5px] border-border bg-background text-foreground text-sm thea-input-focus min-h-[60px] resize-none" />
                <button onClick={submitResult} disabled={busy} className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted thea-transition-fast disabled:opacity-50">
                  {tr('حفظ النتيجة', 'Save Result')}
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('إلغاء', 'Cancel')}</label>
                <input placeholder={tr('سبب الإلغاء', 'Cancel reason')} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border-[1.5px] border-border bg-background text-foreground text-sm thea-input-focus" />
                <button
                  onClick={() => handleAction(`/api/orders/${selected.id}/cancel`, { cancelReason })}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted thea-transition-fast disabled:opacity-50"
                >
                  {tr('إلغاء الطلب', 'Cancel Order')}
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('تأكيد النتيجة', 'Acknowledge Result')}</label>
                <button
                  onClick={() => handleAction(`/api/orders/${selected.id}/ack`, { reason: 'Acknowledged' })}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted thea-transition-fast disabled:opacity-50"
                >
                  {tr('تأكيد النتيجة', 'ACK Result')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
