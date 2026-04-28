'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionPageLayout, CVisionPageHeader, CVisionCard, CVisionCardHeader, CVisionCardBody,
  CVisionButton, CVisionBadge, CVisionInput, CVisionEmptyState,
  CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { Webhook, Plus, Trash2, Send, Eye, CheckCircle, XCircle, Loader2 } from 'lucide-react';

const ALL_EVENTS = [
  'employee.created', 'employee.updated', 'employee.terminated',
  'leave.requested', 'leave.approved', 'leave.rejected',
  'loan.approved', 'contract.created', 'contract.expiring',
  'payroll.processed', 'training.completed', 'letter.generated',
  'onboarding.started', 'offboarding.started',
];

export default function WebhooksPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [viewId, setViewId] = useState('');

  const { data: webhooksData } = useQuery({
    queryKey: cvisionKeys.admin.webhooks.list(),
    queryFn: () => cvisionFetch<any>('/api/cvision/webhooks', { params: { action: 'list' } }),
  });
  const webhooks = webhooksData?.ok ? (webhooksData.data || []) : [];

  const createMutation = useMutation({
    mutationFn: () => cvisionMutate<any>('/api/cvision/webhooks', 'POST', { action: 'create', name, url, events }),
    onSuccess: (d) => { if (d.ok) { queryClient.invalidateQueries({ queryKey: cvisionKeys.admin.webhooks.all }); setShowCreate(false); setName(''); setUrl(''); setEvents([]); } },
  });
  const loading = createMutation.isPending;

  const removeMutation = useMutation({
    mutationFn: (id: string) => cvisionMutate<any>('/api/cvision/webhooks', 'POST', { action: 'delete', webhookId: id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cvisionKeys.admin.webhooks.all }),
  });

  const testMutation = useMutation({
    mutationFn: () => cvisionMutate<any>('/api/cvision/webhooks', 'POST', { action: 'test' }),
  });

  const create = () => createMutation.mutate();
  const remove = (id: string) => removeMutation.mutate(id);
  const test = () => testMutation.mutate();

  const viewDeliveries = async (webhookId: string) => {
    setViewId(webhookId);
    try {
      const d = await cvisionFetch<any>('/api/cvision/webhooks', { params: { action: 'deliveries', webhookId } });
      if (d.ok) setDeliveries(d.data || []);
    } catch {}
  };

  const toggleEvent = (ev: string) => setEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('الويب هوكس', 'Webhooks')}
        titleEn="Webhooks"
        icon={Webhook}
        iconColor={C.purple}
        isRTL={isRTL}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={test} icon={<Send size={14} />}>
              {tr('اختبار', 'Test Ping')}
            </CVisionButton>
            <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => setShowCreate(true)} icon={<Plus size={14} />}>
              {tr('جديد', 'New Webhook')}
            </CVisionButton>
          </div>
        }
      />

      {showCreate && (
        <CVisionCard C={C} style={{ border: `1px solid ${C.purple}30` }}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('ويب هوك جديد', 'New Webhook')}</span>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CVisionInput C={C} placeholder={tr('اسم الويب هوك', 'Webhook name')} value={name} onChange={e => setName(e.target.value)} />
            <CVisionInput C={C} placeholder="https://your-server.com/webhook" value={url} onChange={e => setUrl(e.target.value)} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.textSecondary, marginBottom: 8 }}>{tr('الأحداث', 'Events')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ALL_EVENTS.map(ev => (
                  <CVisionBadge key={ev} C={C} variant={events.includes(ev) ? 'default' : 'muted'} style={{ cursor: 'pointer' }} onClick={() => toggleEvent(ev)}>
                    {ev}
                  </CVisionBadge>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <CVisionButton C={C} isDark={isDark} onClick={create} disabled={!name || !url || events.length === 0 || loading} icon={loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : undefined}>
                {tr('إنشاء', 'Create')}
              </CVisionButton>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setShowCreate(false)}>
                {tr('إلغاء', 'Cancel')}
              </CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {webhooks.map((w: any) => (
          <CVisionCard C={C} key={w.webhookId}>
            <CVisionCardBody style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 500, color: C.text }}>{w.name}</span>
                    <CVisionBadge C={C} variant={w.isActive ? 'success' : 'muted'}>{w.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}</CVisionBadge>
                  </div>
                  <div style={{ fontSize: 13, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.url}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                    {(w.events || []).map((e: string) => <CVisionBadge key={e} C={C} variant="muted">{e}</CVisionBadge>)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" onClick={() => viewDeliveries(w.webhookId)} icon={<Eye size={16} />} />
                  <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" onClick={() => remove(w.webhookId)} icon={<Trash2 size={16} color={C.red} />} />
                </div>
              </div>
            </CVisionCardBody>
          </CVisionCard>
        ))}
        {webhooks.length === 0 && !showCreate && (
          <CVisionEmptyState C={C} icon={Webhook} title={tr('لا توجد ويب هوكس', 'No webhooks configured')} description={tr('أنشئ واحدا لبدء تلقي الأحداث', 'Create one to start receiving events.')} />
        )}
      </div>

      {viewId && deliveries.length > 0 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('سجل التسليم', 'Delivery Log')}</span>
          </CVisionCardHeader>
          <CVisionTable C={C}>
            <CVisionTableHead C={C}>
              <CVisionTh C={C}>{tr('الحدث', 'Event')}</CVisionTh>
              <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
              <CVisionTh C={C}>HTTP</CVisionTh>
              <CVisionTh C={C}>{tr('المدة', 'Duration')}</CVisionTh>
              <CVisionTh C={C}>{tr('المحاولة', 'Attempt')}</CVisionTh>
              <CVisionTh C={C}>{tr('التاريخ', 'Date')}</CVisionTh>
            </CVisionTableHead>
            <CVisionTableBody>
              {deliveries.map((d: any) => (
                <CVisionTr C={C} key={d.deliveryId}>
                  <CVisionTd style={{ fontFamily: 'monospace', fontSize: 11, color: C.text }}>{d.event}</CVisionTd>
                  <CVisionTd>{d.status === 'SUCCESS' ? <CheckCircle size={16} color={C.green} /> : <XCircle size={16} color={C.red} />}</CVisionTd>
                  <CVisionTd style={{ color: C.textMuted }}>{d.responseStatus || '—'}</CVisionTd>
                  <CVisionTd style={{ color: C.textMuted }}>{d.duration}ms</CVisionTd>
                  <CVisionTd style={{ color: C.text }}>{d.attempt}</CVisionTd>
                  <CVisionTd style={{ color: C.textMuted }}>{d.createdAt ? new Date(d.createdAt).toLocaleString() : ''}</CVisionTd>
                </CVisionTr>
              ))}
            </CVisionTableBody>
          </CVisionTable>
        </CVisionCard>
      )}
    </CVisionPageLayout>
  );
}
