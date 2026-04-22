'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionDialog, CVisionDialogFooter, CVisionInput, CVisionSelect, CVisionPageHeader, CVisionPageLayout, CVisionSkeletonCard, CVisionTabs, CVisionTabContent, type CVisionTabItem, type CVisionSelectOption } from '@/components/cvision/ui';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { toast } from 'sonner';
import {
  Plug, CheckCircle2, XCircle, RefreshCw, Zap, Unplug,
  Activity, Clock, Settings, ArrowRightLeft,
} from 'lucide-react';

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'muted'> = {
  ACTIVE: 'success', ERROR: 'danger', INACTIVE: 'muted',
};
const SYNC_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = {
  SUCCESS: 'success', PARTIAL: 'warning', FAILED: 'danger',
};
const TYPE_VARIANT: Record<string, 'purple' | 'info' | 'success' | 'warning' | 'danger' | 'muted'> = {
  ERP: 'purple', ACCOUNTING: 'info', COMMUNICATION: 'success', CALENDAR: 'warning',
  STORAGE: 'info', AUTH: 'danger', PAYMENT: 'purple', CUSTOM: 'muted',
};

/* ====== Connected Tab ====== */
function ConnectedTab({ C, isDark, tr }: { C: any; isDark: boolean; tr: (ar: string, en: string) => string }) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: cvisionKeys.integrationsManager.list({ action: 'list' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/integrations-mgr', { params: { action: 'list' } }),
  });
  const integrations = listQuery.data?.integrations || [];
  const loading = listQuery.isLoading;
  const load = useCallback(() => listQuery.refetch(), [listQuery]);

  const syncNow = async (provider: string) => {
    await cvisionMutate('/api/cvision/integrations-mgr', 'POST', { action: 'sync-now', provider });
    toast.success(tr('تم المزامنة', 'Sync completed'));
    load();
  };

  const testConn = async (provider: string) => {
    const j = await cvisionMutate<any>('/api/cvision/integrations-mgr', 'POST', { action: 'test-connection', provider });
    toast.success(j.result || tr('الاتصال ناجح', 'Connection OK'));
  };

  const disconnect = async (provider: string) => {
    await cvisionMutate('/api/cvision/integrations-mgr', 'POST', { action: 'disconnect', provider });
    toast.success(tr('تم قطع الاتصال', 'Disconnected'));
    load();
  };

  if (loading) return <div style={{ display: 'grid', gap: 16 }}>{[1, 2, 3].map(i => <CVisionSkeletonCard C={C} key={i} height={192} />)}</div>;
  if (integrations.length === 0) return <p style={{ color: C.textMuted, fontSize: 13, paddingTop: 32, paddingBottom: 32, textAlign: 'center' }}>{tr('لا توجد تكاملات متصلة. اذهب إلى تبويب المتاح للاتصال.', 'No integrations connected yet. Go to the Available tab to connect one.')}</p>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {integrations.map((ig: any) => (
        <CVisionCard C={C} key={ig.provider}>
          <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: C.text }}>
                <Plug size={16} /> {ig.name}
              </div>
              <CVisionBadge C={C} variant={STATUS_VARIANT[ig.status] || 'muted'}>
                {ig.status === 'ACTIVE' ? <CheckCircle2 size={12} style={{ marginRight: 4 }} /> : ig.status === 'ERROR' ? <XCircle size={12} style={{ marginRight: 4 }} /> : null}
                {ig.status}
              </CVisionBadge>
            </div>
            <div style={{ fontSize: 12, color: C.textMuted }}>{ig.type} - {ig.provider}</div>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.textMuted }}><ArrowRightLeft size={12} /> {ig.syncSettings?.direction || 'N/A'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.textMuted }}><Clock size={12} /> {ig.syncSettings?.frequency || 'N/A'}</div>
              {ig.syncSettings?.lastSyncAt && (
                <div style={{ color: C.textMuted, gridColumn: 'span 2' }}>{tr('آخر مزامنة:', 'Last sync:')} {new Date(ig.syncSettings.lastSyncAt).toLocaleString()} — {ig.syncSettings.lastSyncStatus}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" icon={<RefreshCw size={12} />} onClick={() => syncNow(ig.provider)}>{tr('مزامنة', 'Sync Now')}</CVisionButton>
              <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" icon={<Zap size={12} />} onClick={() => testConn(ig.provider)}>{tr('اختبار', 'Test')}</CVisionButton>
              <CVisionButton C={C} isDark={isDark} size="sm" variant="ghost" style={{ color: C.red }} icon={<Unplug size={12} />} onClick={() => disconnect(ig.provider)}>{tr('قطع', 'Disconnect')}</CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      ))}
    </div>
  );
}

/* ====== Available Tab ====== */
function AvailableTab({ C, isDark, tr, isRTL }: { C: any; isDark: boolean; tr: (ar: string, en: string) => string; isRTL: boolean }) {
  const [available, setAvailable] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [connectOpen, setConnectOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [apiUrl, setApiUrl] = useState('');

  const availableQuery = useQuery({
    queryKey: cvisionKeys.integrationsManager.list({ action: 'available' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/integrations-mgr', { params: { action: 'available' } }),
  });
  const available2 = availableQuery.data?.available || [];
  const loading = availableQuery.isLoading;
  useEffect(() => { if (availableQuery.data) setAvailable(availableQuery.data.available || []); }, [availableQuery.data]);
  const load = useCallback(() => availableQuery.refetch(), [availableQuery]);

  const connect = async () => {
    if (!selected) return;
    await cvisionMutate('/api/cvision/integrations-mgr', 'POST', { action: 'connect', provider: selected.provider, name: selected.provider.replace(/_/g, ' '), type: selected.type, config: { apiUrl } });
    toast.success(`${selected.provider} ${tr('متصل', 'connected')}`);
    setConnectOpen(false);
    setSelected(null);
    setApiUrl('');
    load();
  };

  const types = ['ALL', ...new Set(available.map(a => a.type))];
  const filtered = typeFilter === 'ALL' ? available : available.filter(a => a.type === typeFilter);

  const typeOptions: CVisionSelectOption[] = types.map(t => ({
    value: t,
    label: t === 'ALL' ? tr('جميع الأنواع', 'All Types') : t,
  }));

  if (loading) return <div style={{ display: 'grid', gap: 16 }}>{[1, 2, 3, 4].map(i => <CVisionSkeletonCard C={C} key={i} height={144} />)}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 192 }}>
        <CVisionSelect C={C} options={typeOptions} value={typeFilter} onChange={setTypeFilter} />
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {filtered.map((a: any) => (
          <CVisionCard C={C} key={a.provider} style={{ opacity: a.connected ? 0.6 : 1 }}>
            <CVisionCardBody style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 16 }}>{a.logo}</p>
                <CVisionBadge C={C} variant={TYPE_VARIANT[a.type] || 'muted'}>{a.type}</CVisionBadge>
              </div>
              <p style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{a.provider.replace(/_/g, ' ')}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {a.features.map((f: string) => <CVisionBadge C={C} key={f} variant="muted" style={{ fontSize: 10 }}>{f.replace(/_/g, ' ')}</CVisionBadge>)}
              </div>
              {a.connected ? (
                <CVisionBadge C={C} variant="success">{tr('متصل', 'Connected')}</CVisionBadge>
              ) : (
                <CVisionButton C={C} isDark={isDark} size="sm" style={{ width: '100%' }} icon={<Plug size={12} />} onClick={() => { setSelected(a); setConnectOpen(true); }}>
                  {tr('اتصال', 'Connect')}
                </CVisionButton>
              )}
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>

      <CVisionDialog C={C} open={connectOpen} onClose={() => setConnectOpen(false)} title={tr('اتصال', 'Connect') + ' ' + (selected?.provider?.replace(/_/g, ' ') || '')} titleAr={tr('اتصال', 'Connect') + ' ' + (selected?.provider?.replace(/_/g, ' ') || '')} isRTL={isRTL} width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CVisionInput C={C} placeholder={tr('رابط API (اختياري)', 'API URL (optional)')} value={apiUrl} onChange={e => setApiUrl(e.target.value)} />
          <p style={{ fontSize: 12, color: C.textMuted }}>{tr('أدخل رابط API أو اتركه فارغاً للإعداد لاحقاً.', 'Enter the API URL or leave blank to configure later.')}</p>
        </div>
        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} onClick={connect}>{tr('اتصال', 'Connect')}</CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

/* ====== Sync Logs Tab ====== */
function SyncLogsTab({ C, isDark, tr }: { C: any; isDark: boolean; tr: (ar: string, en: string) => string }) {
  const [provFilter, setProvFilter] = useState('ALL');

  const logsQuery = useQuery({
    queryKey: cvisionKeys.integrationsManager.list({ action: 'logs', provider: provFilter }),
    queryFn: () => {
      const params: Record<string, string> = { action: 'logs' };
      if (provFilter !== 'ALL') params.provider = provFilter;
      return cvisionFetch<any>('/api/cvision/integrations-mgr', { params });
    },
  });
  const logs = logsQuery.data?.logs || [];
  const loading = logsQuery.isLoading;

  if (loading) return <CVisionSkeletonCard C={C} height={192} />;

  const providers = [...new Set(logs.map(l => l.provider))];
  const provOptions: CVisionSelectOption[] = [
    { value: 'ALL', label: tr('جميع المزودين', 'All Providers') },
    ...providers.map(p => ({ value: p as string, label: p as string })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 192 }}>
        <CVisionSelect C={C} options={provOptions} value={provFilter} onChange={v => { setProvFilter(v); }} />
      </div>

      {logs.length === 0 ? (
        <p style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', paddingTop: 32, paddingBottom: 32 }}>{tr('لا توجد سجلات مزامنة.', 'No sync logs found.')}</p>
      ) : (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 16, overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}`, textAlign: 'left', color: C.textMuted }}>
                <th style={{ padding: '8px 16px 8px 0' }}>{tr('الوقت', 'Time')}</th>
                <th style={{ padding: '8px 16px 8px 0' }}>{tr('المزود', 'Provider')}</th>
                <th style={{ padding: '8px 16px 8px 0' }}>{tr('الإجراء', 'Action')}</th>
                <th style={{ padding: '8px 16px 8px 0' }}>{tr('الحالة', 'Status')}</th>
                <th style={{ padding: '8px 16px 8px 0' }}>{tr('الرسالة', 'Message')}</th>
              </tr></thead>
              <tbody>
                {logs.map((l: any, i: number) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '8px 16px 8px 0', fontSize: 12, color: C.textMuted }}>{new Date(l.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '8px 16px 8px 0', fontWeight: 500, color: C.text }}>{l.provider}</td>
                    <td style={{ padding: '8px 16px 8px 0', color: C.text }}>{l.action?.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '8px 16px 8px 0', fontWeight: 500, color: l.status === 'SUCCESS' ? C.green : l.status === 'PARTIAL' ? C.orange : C.red }}>{l.status}</td>
                    <td style={{ padding: '8px 16px 8px 0', color: C.textMuted }}>{l.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CVisionCardBody>
        </CVisionCard>
      )}
    </div>
  );
}

/* ====== Settings Tab ====== */
function SettingsTab({ C, isDark, tr }: { C: any; isDark: boolean; tr: (ar: string, en: string) => string }) {
  const statusQuery = useQuery({
    queryKey: cvisionKeys.integrationsManager.list({ action: 'sync-status' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/integrations-mgr', { params: { action: 'sync-status' } }),
  });
  const statuses = statusQuery.data?.statuses || [];
  const loading = statusQuery.isLoading;

  if (loading) return <CVisionSkeletonCard C={C} height={192} />;
  if (statuses.length === 0) return <p style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', paddingTop: 32, paddingBottom: 32 }}>{tr('لا توجد تكاملات نشطة للإعداد.', 'No active integrations to configure.')}</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tr('حالة التكاملات النشطة', 'Active Integration Status')}</h3>
      {statuses.map((s: any) => (
        <CVisionCard C={C} key={s.provider}>
          <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{s.name}</p>
              <p style={{ fontSize: 12, color: C.textMuted }}>{tr('التكرار:', 'Frequency:')} {s.frequency} - {tr('مفعّل:', 'Enabled:')} {s.enabled ? tr('نعم', 'Yes') : tr('لا', 'No')}</p>
              {s.lastSync && <p style={{ fontSize: 12, color: C.textMuted }}>{tr('آخر مزامنة:', 'Last sync:')} {new Date(s.lastSync).toLocaleString()} — {s.lastStatus}</p>}
            </div>
            <CVisionBadge C={C} variant={SYNC_VARIANT[s.lastStatus] || 'muted'}>{s.lastStatus || 'N/A'}</CVisionBadge>
          </CVisionCardBody>
        </CVisionCard>
      ))}
    </div>
  );
}

/* ====== Main Page ====== */
export default function IntegrationsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [activeTab, setActiveTab] = useState('connected');

  const tabs: CVisionTabItem[] = [
    { id: 'connected', label: tr('المتصلة', 'Connected') },
    { id: 'available', label: tr('المتاحة', 'Available') },
    { id: 'logs', label: tr('سجلات المزامنة', 'Sync Logs') },
    { id: 'settings', label: tr('الإعدادات', 'Settings') },
  ];

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('التكاملات الخارجية', 'Third-Party Integrations')}
        titleEn="Third-Party Integrations"
        subtitle={tr('ربط أنظمة المحاسبة والتواصل والتقويم والتخزين والمصادقة', 'Connect accounting, communication, calendar, storage & auth systems')}
        icon={Plug}
        isRTL={isRTL}
      />

      <CVisionTabs C={C} tabs={tabs} activeTab={activeTab} onChange={setActiveTab} isRTL={isRTL} />

      <CVisionTabContent id="connected" activeTab={activeTab}><ConnectedTab C={C} isDark={isDark} tr={tr} /></CVisionTabContent>
      <CVisionTabContent id="available" activeTab={activeTab}><AvailableTab C={C} isDark={isDark} tr={tr} isRTL={isRTL} /></CVisionTabContent>
      <CVisionTabContent id="logs" activeTab={activeTab}><SyncLogsTab C={C} isDark={isDark} tr={tr} /></CVisionTabContent>
      <CVisionTabContent id="settings" activeTab={activeTab}><SettingsTab C={C} isDark={isDark} tr={tr} /></CVisionTabContent>
    </CVisionPageLayout>
  );
}
