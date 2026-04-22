'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionInput, CVisionLabel, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionSelect , CVisionDialog, CVisionDialogFooter , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';

import { toast } from 'sonner';
import {
  Link2, RefreshCw, Loader2, Download, FileText, ChevronDown,
  ChevronRight, Settings, Eye, EyeOff, AlertCircle, CheckCircle2,
  Zap, HardDrive, Globe, Shield, BarChart3, Plus, Trash2, Search,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IntegrationItem {
  id: string;
  name: string;
  provider: string;
  description: string;
  url: string;
  features: string[];
  mandatory: boolean;
  hasApi: boolean;
  defaultMode: string;
  status: string;
  mode: string;
  lastSync: string | null;
  lastError: string | null;
  hasCredentials: boolean;
  settings: Record<string, any>;
  configured: boolean;
}

interface NitaqatData {
  band: string;
  bandLabel: string;
  bandColor: string;
  saudizationRate: number;
  saudiCount: number;
  nonSaudiCount: number;
  totalEmployees: number;
  requiredRate: number;
  deficit: number;
  availableVisas: number;
  status: string;
}

interface LogEntry {
  id: string;
  integrationId: string;
  action: string;
  status: string;
  duration?: number;
  error?: string;
  createdAt: string;
}

interface FeatureLabels {
  [key: string]: { en: string };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BANKS_DATA = [
  { code: 'RJHI', nameAr: 'بنك الراجحي', nameEn: 'Al Rajhi Bank' },
  { code: 'SABB', nameAr: 'ساب', nameEn: 'SABB' },
  { code: 'SNB', nameAr: 'البنك الأهلي السعودي', nameEn: 'Saudi National Bank' },
  { code: 'RIBL', nameAr: 'بنك الرياض', nameEn: 'Riyad Bank' },
  { code: 'BILD', nameAr: 'بنك البلاد', nameEn: 'Bank Al Bilad' },
  { code: 'ALIN', nameAr: 'بنك الإنماء', nameEn: 'Alinma Bank' },
  { code: 'BJAZ', nameAr: 'بنك الجزيرة', nameEn: 'Bank Al Jazira' },
  { code: 'ARNB', nameAr: 'البنك العربي الوطني', nameEn: 'Arab National Bank' },
];

const INTEGRATION_ICONS: Record<string, string> = {
  qiwa: '🏛️',
  mudad: '💰',
  gosi: '🛡️',
  absher: '🪪',
  muqeem: '🌐',
  yaqeen: '🔍',
  nafath: '🔐',
  wathq: '📜',
  zatca: '🧾',
  banks: '🏦',
};

const MODE_BADGE: Record<string, { labelAr: string; labelEn: string; icon: typeof Zap; className: string }> = {
  SIMULATION: { labelAr: 'محاكاة', labelEn: 'SIM', icon: Zap, className: 'bg-blue-100 text-blue-700 border-blue-300' },
  FILE_EXPORT: { labelAr: 'ملف', labelEn: 'FILE', icon: HardDrive, className: 'bg-amber-100 text-amber-700 border-amber-300' },
  LIVE: { labelAr: 'مباشر', labelEn: 'LIVE', icon: Globe, className: 'bg-green-100 text-green-700 border-green-300' },
};

const STATUS_BORDER: Record<string, string> = {
  CONNECTED: 'border-l-green-500',
  SIMULATED: 'border-l-blue-500',
  ERROR: 'border-l-red-500',
  DISCONNECTED: 'border-l-gray-300',
  PENDING: 'border-l-yellow-500',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntegrationsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [featureLabels, setFeatureLabels] = useState<FeatureLabels>({});
  const [nitaqat, setNitaqat] = useState<NitaqatData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [expandedSettings, setExpandedSettings] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [savingId, setSavingId] = useState<string | null>(null);

  // File export state
  const [fileMonth, setFileMonth] = useState(new Date().getMonth() + 1);
  const [fileYear, setFileYear] = useState(new Date().getFullYear());
  const [selectedBank, setSelectedBank] = useState('RJHI');
  const [generating, setGenerating] = useState<string | null>(null);

  // Company details
  const [companyDetails, setCompanyDetails] = useState({
    companyNameEn: '', companyNameAr: '', crNumber: '', molNumber: '',
    gosiNumber: '', vatNumber: '', nationalAddress: '',
    signatoryId: '', signatoryMobile: '',
  });

  // Bank accounts
  const [bankAccounts, setBankAccounts] = useState<{ bank: string; iban: string; name: string }[]>([]);

  // Credential fields (per-integration)
  const [credentials, setCredentials] = useState<Record<string, Record<string, string>>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // ── Data loading ────────────────────────────────────────────────

  const integrationsQuery = useQuery({
    queryKey: cvisionKeys.integrations.list({ action: 'all' }),
    queryFn: async () => {
      const [listData, nitaqatData, logsData] = await Promise.all([
        cvisionFetch<any>('/api/cvision/integrations', { params: { action: 'list' } }),
        cvisionFetch<any>('/api/cvision/integrations', { params: { action: 'nitaqat' } }),
        cvisionFetch<any>('/api/cvision/integrations', { params: { action: 'logs', limit: '20' } }),
      ]);

      // Auto-seed if no configured integrations
      let finalListData = listData;
      if (!listData.data?.length || listData.data.every((i: any) => !i.configured)) {
        await cvisionMutate('/api/cvision/integrations', 'POST', { action: 'seed' });
        finalListData = await cvisionFetch<any>('/api/cvision/integrations', { params: { action: 'list' } });
      }

      return { listData: finalListData, nitaqatData, logsData };
    },
  });

  useEffect(() => {
    if (!integrationsQuery.data) return;
    const { listData, nitaqatData, logsData } = integrationsQuery.data;
    if (listData.success) {
      setIntegrations(listData.data);
      setSummary(listData.summary);
      setFeatureLabels(listData.featureLabels || {});
    }
    if (nitaqatData.success) setNitaqat(nitaqatData.data);
    if (logsData.success) setLogs(logsData.data);
  }, [integrationsQuery.data]);

  const loading = integrationsQuery.isLoading;
  const loadAll = useCallback(() => integrationsQuery.refetch(), [integrationsQuery]);

  // ── Actions ─────────────────────────────────────────────────────

  async function handleTest(integrationId: string) {
    setTestingId(integrationId);
    try {
      const data = await cvisionFetch<any>('/api/cvision/integrations', { params: { action: 'test', integrationId } });
      const d = data.data;
      if (d?.connected) {
        toast.success(tr('تم الاتصال بنجاح', 'Connection Successful'), {
          description: `${integrationId} ${tr('استجاب خلال', 'responded in')} ${d.responseTime}ms (${tr('محاكاة', 'Simulation')})`,
        });
      } else {
        toast.error(tr('فشل الاتصال', 'Connection Failed'), {
          description: `${tr('خطأ', 'Error')}: ${d?.error || tr('غير معروف', 'Unknown')}`,
        });
      }
      loadAll();
    } catch {
      toast.error(tr('خطأ', 'Error'), { description: tr('فشل الاختبار', 'Test failed') });
    } finally {
      setTestingId(null);
    }
  }

  async function handleSync(integrationId: string) {
    setSyncingId(integrationId);
    try {
      const data = await cvisionMutate<any>('/api/cvision/integrations', 'POST', { action: 'sync', integrationId });
      if (data.data?.synced) {
        toast.success(tr('تمت المزامنة', 'Sync Complete'), {
          description: `${tr('تمت مزامنة', 'Synced')} ${integrationId} ${tr('خلال', 'in')} ${data.data.duration}ms`,
        });
      } else {
        toast.error(tr('فشلت المزامنة', 'Sync Failed'), {
          description: data.data?.error || tr('خطأ غير معروف', 'Unknown error'),
        });
      }
      loadAll();
    } catch {
      toast.error(tr('خطأ', 'Error'), { description: tr('فشلت المزامنة', 'Sync failed') });
    } finally {
      setSyncingId(null);
    }
  }

  async function handleToggleMode(integrationId: string, mode: string) {
    try {
      const data = await cvisionMutate<any>('/api/cvision/integrations', 'POST', { action: 'toggle-mode', integrationId, mode });
      if (!data.success) {
        toast.error(tr('لا يمكن تغيير الوضع', 'Cannot change mode'), { description: data.error });
        return;
      }
      toast.success(tr('تم تحديث الوضع', 'Mode Updated'), {
        description: `${integrationId} ${tr('تم ضبطه إلى', 'set to')} ${mode}`,
      });
      loadAll();
    } catch {
      toast.error(tr('خطأ', 'Error'), { description: tr('فشل تحديث الوضع', 'Failed to update mode') });
    }
  }

  async function handleSaveConfig(integrationId: string) {
    setSavingId(integrationId);
    try {
      const creds = credentials[integrationId] || {};
      const data = await cvisionMutate<any>('/api/cvision/integrations', 'POST', {
          action: 'configure',
          integrationId,
          apiUrl: creds.apiUrl,
          apiKey: creds.apiKey,
          credentials: { clientId: creds.clientId, clientSecret: creds.clientSecret },
          settings: { molNumber: creds.molNumber, crNumber: creds.crNumber },
        });
      if (data.success) {
        toast.success(tr('تم الحفظ', 'Saved'), {
          description: `${tr('تم تحديث تكوين', 'Configuration for')} ${integrationId} ${tr('', 'updated')}`,
        });
        loadAll();
      }
    } catch {
      toast.error(tr('خطأ', 'Error'), { description: tr('فشل الحفظ', 'Failed to save') });
    } finally {
      setSavingId(null);
    }
  }

  async function handleGenerateFile(type: string) {
    setGenerating(type);
    try {
      const data = await cvisionMutate<any>('/api/cvision/integrations', 'POST', {
          action: type === 'sif' ? 'generate-sif' : type === 'wps' ? 'generate-wps' : 'generate-gosi',
          bank: selectedBank,
          month: fileMonth,
          year: fileYear,
        });
      if (data.success && data.data?.content) {
        const blob = new Blob([data.data.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(tr('تم إنشاء الملف', 'File Generated'), {
          description: `${tr('تم تنزيل', 'Downloaded')} ${data.data.filename}`,
        });
      } else {
        toast.error(tr('خطأ', 'Error'), { description: tr('فشل إنشاء الملف', 'Failed to generate file') });
      }
    } catch {
      toast.error(tr('خطأ', 'Error'), { description: tr('فشل الإنشاء', 'Generation failed') });
    } finally {
      setGenerating(null);
    }
  }

  // ── Credential helpers ──────────────────────────────────────────

  function updateCredential(integrationId: string, field: string, value: string) {
    setCredentials(prev => ({
      ...prev,
      [integrationId]: { ...(prev[integrationId] || {}), [field]: value },
    }));
  }

  // ── Compliance summary ─────────────────────────────────────────

  const compliance = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const wpsDeadline = new Date(year, month, 10);
    if (wpsDeadline <= now) wpsDeadline.setMonth(wpsDeadline.getMonth() + 1);
    const wpsDays = Math.ceil((wpsDeadline.getTime() - now.getTime()) / 86400000);

    const gosiDeadline = new Date(year, month, 15);
    if (gosiDeadline <= now) gosiDeadline.setMonth(gosiDeadline.getMonth() + 1);
    const gosiDays = Math.ceil((gosiDeadline.getTime() - now.getTime()) / 86400000);

    const nitaqatOk = nitaqat && ['PLATINUM', 'GREEN_HIGH', 'GREEN_MID', 'GREEN_LOW'].includes(nitaqat.band);

    return { wpsDays, gosiDays, nitaqatOk };
  }, [nitaqat]);

  // ── Loading ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <CVisionSkeletonCard C={C} height={200} style={{ height: 40, width: 384 }}  />
        <CVisionSkeletonCard C={C} height={200} style={{ height: 96, width: '100%' }}  />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 192 }}  />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>{tr('التكاملات الحكومية والبنكية', 'Government & Bank Integrations')}</h1>
          <p style={{ color: C.textMuted, marginTop: 4 }}>{tr('إدارة الاتصالات بالأنظمة الحكومية السعودية والبنوك', 'Manage connections to Saudi government systems and banks')}</p>
        </div>
        <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => loadAll()} disabled={loading}>
          <RefreshCw style={{ height: 16, width: 16, marginInlineEnd: 8 }} />
          {tr('تحديث', 'Refresh')}
        </CVisionButton>
      </div>

      <CVisionTabs
        C={C}
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'dashboard', label: tr('لوحة المعلومات', 'Dashboard') },
          { id: 'export', label: tr('تصدير الملفات', 'File Export') },
          { id: 'settings', label: tr('الإعدادات', 'Settings') },
        ]}
      >
        {/* ================================================================ */}
        {/* TAB 1: Dashboard                                                 */}
        {/* ================================================================ */}
        <CVisionTabContent tabId="dashboard">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 24 }}>

          {/* Status banner */}
          {summary && (
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 16 }}>
                <Link2 style={{ height: 20, width: 20 }} />
                {tr('حالة التكامل', 'Integration Status')}: {summary.total} {tr('خدمة مكوّنة', 'services configured')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Zap style={{ height: 16, width: 16, color: C.blue }} />
                  <span>{summary.simulation} {tr('في وضع المحاكاة', 'in Simulation Mode')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HardDrive style={{ height: 16, width: 16, color: C.orange }} />
                  <span>{summary.fileExport} {tr('في وضع تصدير الملفات', 'in File Export Mode')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Globe style={{ height: 16, width: 16, color: C.green }} />
                  <span>{summary.live} {tr('اتصالات مباشرة', 'Live Connections')}</span>
                </div>
                {summary.errors > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.red }}>
                    <AlertCircle style={{ height: 16, width: 16 }} />
                    <span>{summary.errors} {tr('أخطاء', 'Errors')}</span>
                  </div>
                )}
              </div>
              {summary.live === 0 && (
                <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                  {tr('قم بتكوين بيانات API في تبويب الإعدادات لتفعيل الاتصالات المباشرة.', 'Configure API credentials in the Settings tab to enable live connections.')}
                </p>
              )}
            </div>
          )}

          {/* Integration cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
            {integrations.map(intg => {
              const modeBadge = MODE_BADGE[intg.mode] || MODE_BADGE.SIMULATION;
              const ModeBadgeIcon = modeBadge.icon;
              const borderClass = STATUS_BORDER[intg.status] || STATUS_BORDER.DISCONNECTED;
              return (
                <div
                  key={intg.id}
                  className={`rounded-lg border-l-4 border bg-card p-4 space-y-3 ${borderClass}`}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 24 }}>{INTEGRATION_ICONS[intg.id] || '🔗'}</span>
                      <div>
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {intg.name}
                          {intg.mandatory && (
                            <CVisionBadge C={C} variant="outline" style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 0, paddingBottom: 0, color: C.orange }}>{tr('مطلوب', 'Required')}</CVisionBadge>
                          )}
                        </div>
                        <p style={{ fontSize: 12, color: C.textMuted }}>{intg.provider}</p>
                      </div>
                    </div>
                    <CVisionBadge C={C} variant="outline" className={`text-xs ${modeBadge.className}`}>
                      <ModeBadgeIcon style={{ height: 12, width: 12, marginInlineEnd: 4 }} />
                      {tr(modeBadge.labelAr, modeBadge.labelEn)}
                    </CVisionBadge>
                  </div>

                  <p style={{ fontSize: 12, color: C.textMuted }}>{intg.description}</p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {intg.features.slice(0, 4).map(f => (
                      <CVisionBadge C={C} key={f} variant="secondary" className="text-[10px]">
                        {featureLabels[f]?.en || f}
                      </CVisionBadge>
                    ))}
                  </div>

                  <div style={{ fontSize: 12, color: C.textMuted }}>
                    <div>{tr('الحالة', 'Status')}: {intg.status === 'SIMULATED' ? tr('وضع المحاكاة', 'Simulation Mode') : intg.status}</div>
                    <div>{tr('آخر مزامنة', 'Last Sync')}: {intg.lastSync ? new Date(intg.lastSync).toLocaleDateString(isRTL ? 'ar-SA' : 'en') : tr('لم تتم', 'Never')}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                    <CVisionButton C={C} isDark={isDark}
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(intg.id)}
                      disabled={testingId === intg.id}
                    >
                      {testingId === intg.id ? <Loader2 style={{ height: 12, width: 12, animation: 'spin 1s linear infinite' }} /> : <Zap style={{ height: 12, width: 12 }} />}
                      <span style={{ marginInlineStart: 4 }}>{tr('اختبار', 'Test')}</span>
                    </CVisionButton>
                    <CVisionButton C={C} isDark={isDark}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(intg.id)}
                      disabled={syncingId === intg.id}
                    >
                      {syncingId === intg.id ? <Loader2 style={{ height: 12, width: 12, animation: 'spin 1s linear infinite' }} /> : <RefreshCw style={{ height: 12, width: 12 }} />}
                      <span style={{ marginInlineStart: 4 }}>{tr('مزامنة', 'Sync')}</span>
                    </CVisionButton>
                    <CVisionButton C={C} isDark={isDark}
                      variant="ghost"
                      size="sm"
                      onClick={() => { setExpandedSettings(intg.id); setActiveTab('settings'); }}
                    >
                      <Settings style={{ height: 12, width: 12, marginInlineEnd: 4 }} />
                      {tr('تكوين', 'Configure')}
                    </CVisionButton>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Nitaqat widget */}
          {nitaqat && (
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChart3 style={{ height: 20, width: 20 }} />
                  {tr('حالة نطاقات (محسوبة من البيانات)', 'Nitaqat Status (Calculated from Data)')}
                </h3>
                <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => loadAll()}>
                  <RefreshCw style={{ height: 12, width: 12, marginInlineEnd: 4 }} /> {tr('تحديث', 'Refresh')}
                </CVisionButton>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 24 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{tr('النطاق', 'Band')}:</span>
                    <CVisionBadge C={C}
                      style={{ fontSize: 13, paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, backgroundColor: nitaqat.bandColor, color: '#fff' }}
                    >
                      {nitaqat.bandLabel}
                    </CVisionBadge>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{tr('نسبة السعودة', 'Saudization Rate')}</span>
                      <span style={{ fontWeight: 600 }}>{nitaqat.saudizationRate}%</span>
                    </div>
                    <div style={{ width: '100%', background: C.bgSubtle, borderRadius: '50%', height: 12, overflow: 'hidden' }}>
                      <div
                        style={{ borderRadius: '50%', transition: 'all 0.2s', width: `${Math.min(nitaqat.saudizationRate, 100)}%`, backgroundColor: nitaqat.bandColor }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center' }}>
                    <div style={{ borderRadius: 6, background: C.bgSubtle, padding: 8 }}>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{nitaqat.saudiCount}</div>
                      <div style={{ color: C.textMuted }}>{tr('سعودي', 'Saudi')}</div>
                    </div>
                    <div style={{ borderRadius: 6, background: C.bgSubtle, padding: 8 }}>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{nitaqat.nonSaudiCount}</div>
                      <div style={{ color: C.textMuted }}>{tr('غير سعودي', 'Non-Saudi')}</div>
                    </div>
                    <div style={{ borderRadius: 6, background: C.bgSubtle, padding: 8 }}>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{nitaqat.totalEmployees}</div>
                      <div style={{ color: C.textMuted }}>{tr('الإجمالي', 'Total')}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {nitaqat.saudizationRate >= nitaqat.requiredRate
                      ? <CheckCircle2 style={{ height: 16, width: 16, color: C.green }} />
                      : <AlertCircle style={{ height: 16, width: 16, color: C.red }} />
                    }
                    <span>
                      {nitaqat.saudizationRate >= nitaqat.requiredRate
                        ? tr(`أعلى من الحد الأدنى (${nitaqat.requiredRate}%)`, `Above minimum (${nitaqat.requiredRate}%)`)
                        : tr(`أقل من الحد الأدنى (${nitaqat.requiredRate}%) — يحتاج ${nitaqat.deficit} موظف سعودي إضافي`, `Below minimum (${nitaqat.requiredRate}%) — need ${nitaqat.deficit} more Saudi employees`)
                      }
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BarChart3 style={{ height: 16, width: 16, color: C.textMuted }} />
                    <span>{tr(`تأشيرات العمل المتاحة: ${nitaqat.availableVisas} (تقديرية)`, `Available work visas: ${nitaqat.availableVisas} (estimated)`)}</span>
                  </div>
                  <p style={{ fontSize: 12, color: C.textMuted, paddingTop: 8 }}>
                    {tr('آخر حساب: الآن — البيانات من سجلات الموظفين', 'Last calculated: Just now — Data from cvision_employees')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Compliance summary */}
          <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontWeight: 600 }}>{tr('قائمة الامتثال الشهرية', 'Monthly Compliance Checklist')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <ComplianceRow
                done={false}
                label={tr(`ملف رواتب WPS — مستحق خلال ${compliance.wpsDays} يوم`, `WPS Salary File — Due in ${compliance.wpsDays} days`)}
                action={tr('إنشاء', 'Generate')}
                onAction={() => handleGenerateFile('wps')}
                isRTL={isRTL}
              />
              <ComplianceRow
                done={false}
                label={tr(`اشتراكات التأمينات الاجتماعية — مستحقة خلال ${compliance.gosiDays} يوم`, `GOSI Contributions — Due in ${compliance.gosiDays} days`)}
                action={tr('إنشاء', 'Generate')}
                onAction={() => handleGenerateFile('gosi')}
                isRTL={isRTL}
              />
              <ComplianceRow
                done={compliance.nitaqatOk || false}
                label={tr(
                  `نطاقات — ${nitaqat?.bandLabel || 'غير متوفر'} ${compliance.nitaqatOk ? '(ملتزم)' : '(يحتاج اهتمام)'}`,
                  `Nitaqat — ${nitaqat?.bandLabel || 'N/A'} ${compliance.nitaqatOk ? '(compliant)' : '(needs attention)'}`
                )}
                isRTL={isRTL}
              />
              <ComplianceRow
                done={false}
                label={tr('الفاتورة الإلكترونية ZATCA — وضع المحاكاة', 'ZATCA E-Invoicing — Simulation Mode')}
                action={tr('إعداد', 'Setup')}
                onAction={() => { setExpandedSettings('zatca'); setActiveTab('settings'); }}
                isRTL={isRTL}
              />
            </div>
          </div>

          {/* Recent logs */}
          {logs.length > 0 && (
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ fontWeight: 600 }}>{tr('النشاط الأخير', 'Recent Activity')}</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: isRTL ? 'right' : 'left', color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>
                      <th style={{ paddingBottom: 8, paddingInlineEnd: 16 }}>{tr('التاريخ', 'Date')}</th>
                      <th style={{ paddingBottom: 8, paddingInlineEnd: 16 }}>{tr('التكامل', 'Integration')}</th>
                      <th style={{ paddingBottom: 8, paddingInlineEnd: 16 }}>{tr('الإجراء', 'Action')}</th>
                      <th style={{ paddingBottom: 8, paddingInlineEnd: 16 }}>{tr('الحالة', 'Status')}</th>
                      <th style={{ paddingBottom: 8 }}>{tr('المدة', 'Duration')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.slice(0, 10).map(log => (
                      <tr key={log.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ paddingTop: 8, paddingBottom: 8, paddingInlineEnd: 16, fontSize: 12 }}>{new Date(log.createdAt).toLocaleString(isRTL ? 'ar-SA' : 'en')}</td>
                        <td style={{ paddingTop: 8, paddingBottom: 8, paddingInlineEnd: 16 }}>{log.integrationId}</td>
                        <td style={{ paddingTop: 8, paddingBottom: 8, paddingInlineEnd: 16 }}>{log.action}</td>
                        <td style={{ paddingTop: 8, paddingBottom: 8, paddingInlineEnd: 16 }}>
                          <CVisionBadge C={C} variant={log.status === 'SUCCESS' ? 'default' : 'destructive'} className="text-[10px]">
                            {log.status}
                          </CVisionBadge>
                        </td>
                        <td style={{ paddingTop: 8, paddingBottom: 8, fontSize: 12 }}>{log.duration ? `${log.duration}ms` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        </CVisionTabContent>

        {/* ================================================================ */}
        {/* TAB 2: File Export                                                */}
        {/* ================================================================ */}
        <CVisionTabContent tabId="export">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 24 }}>

          {/* Period selector */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('الشهر', 'Month')}</CVisionLabel>
              <CVisionSelect
                C={C}
                value={String(fileMonth)}
                options={Array.from({ length: 12 }, (_, i) => (
                    ({ value: String(i + 1), label: `${new Date(2000, i).toLocaleString(isRTL ? 'ar-SA' : 'en', { month: 'long' })}` })
                  ))}
                style={{ width: 128 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('السنة', 'Year')}</CVisionLabel>
              <CVisionSelect
                C={C}
                value={String(fileYear)}
                options={[2024, 2025, 2026].map(y => (
                    ({ value: String(y), label: String(y) })
                  ))}
                style={{ width: 112 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('البنك', 'Bank')}</CVisionLabel>
              <CVisionSelect
                C={C}
                value={selectedBank}
                onChange={setSelectedBank}
                options={BANKS_DATA.map(b => (
                    ({ value: b.code, label: tr(b.nameAr, b.nameEn) })
                  ))}
                style={{ width: 192 }}
              />
            </div>
          </div>

          {/* Salary files */}
          <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>💰</span> {tr('ملفات الرواتب', 'Salary Files')}
            </h3>
            <p style={{ fontSize: 13, color: C.textMuted }}>
              {tr('إنشاء ملفات تحويل رواتب البنك (SIF) وملفات حماية الأجور (WPS) للفترة المحددة.', 'Generate bank salary transfer (SIF) and Mudad wage protection (WPS) files for the selected period.')}
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <CVisionButton C={C} isDark={isDark} onClick={() => handleGenerateFile('sif')} disabled={generating === 'sif'}>
                {generating === 'sif' ? <Loader2 style={{ height: 16, width: 16, marginInlineEnd: 8, animation: 'spin 1s linear infinite' }} /> : <Download style={{ height: 16, width: 16, marginInlineEnd: 8 }} />}
                {tr('تنزيل ملف SIF', 'Download SIF File')}
              </CVisionButton>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => handleGenerateFile('wps')} disabled={generating === 'wps'}>
                {generating === 'wps' ? <Loader2 style={{ height: 16, width: 16, marginInlineEnd: 8, animation: 'spin 1s linear infinite' }} /> : <Download style={{ height: 16, width: 16, marginInlineEnd: 8 }} />}
                {tr('تنزيل ملف WPS', 'Download WPS File')}
              </CVisionButton>
            </div>
          </div>

          {/* GOSI file */}
          <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🛡️</span> {tr('اشتراكات التأمينات الاجتماعية', 'GOSI Contributions')}
            </h3>
            <p style={{ fontSize: 13, color: C.textMuted }}>
              {tr('إنشاء ملف اشتراكات التأمينات الاجتماعية الشهرية. مستحق بحلول الـ 15 من كل شهر.', 'Generate monthly GOSI social insurance contribution file. Due by the 15th of each month.')}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CVisionButton C={C} isDark={isDark} onClick={() => handleGenerateFile('gosi')} disabled={generating === 'gosi'}>
                {generating === 'gosi' ? <Loader2 style={{ height: 16, width: 16, marginInlineEnd: 8, animation: 'spin 1s linear infinite' }} /> : <Download style={{ height: 16, width: 16, marginInlineEnd: 8 }} />}
                {tr('تنزيل ملف GOSI CSV', 'Download GOSI CSV')}
              </CVisionButton>
              <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>
                {tr('الموعد النهائي: 15 من كل شهر', 'Deadline: 15th of each month')}
              </CVisionBadge>
            </div>
          </div>

          {/* E-Invoice */}
          <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🧾</span> {tr('الفاتورة الإلكترونية', 'E-Invoice')}
              </h3>
              <CVisionBadge C={C} variant="outline" style={{ background: C.blueDim, color: C.blue }}>
                <Zap style={{ height: 12, width: 12, marginInlineEnd: 4 }} /> {tr('وضع المحاكاة', 'Simulation Mode')}
              </CVisionBadge>
            </div>
            <p style={{ fontSize: 13, color: C.textMuted }}>
              {tr('إنشاء فواتير إلكترونية متوافقة مع ZATCA بصيغة UBL 2.1 ورموز QR للاختبار. يتطلب التكامل الحقيقي مع ZATCA شهادة CSID.', 'Generate ZATCA-compliant UBL 2.1 e-invoices and QR codes for testing. Real ZATCA integration requires a CSID certificate.')}
            </p>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => { setExpandedSettings('zatca'); setActiveTab('settings'); }}>
              <Settings style={{ height: 16, width: 16, marginInlineEnd: 8 }} />
              {tr('تكوين ZATCA', 'Configure ZATCA')}
            </CVisionButton>
          </div>

        </div>
        </CVisionTabContent>

        {/* ================================================================ */}
        {/* TAB 3: Settings                                                  */}
        {/* ================================================================ */}
        <CVisionTabContent tabId="settings">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 24 }}>

          {/* Company details */}
          <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🏢</span> {tr('بيانات الشركة', 'Company Details')}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
              <SettingsField label={tr('اسم الشركة (بالإنجليزية)', 'Company Name (EN)')} value={companyDetails.companyNameEn} onChange={v => setCompanyDetails(p => ({ ...p, companyNameEn: v }))} placeholder="Thea Health" />
              <SettingsField label={tr('اسم الشركة (بالعربية)', 'Company Name (AR)')} value={companyDetails.companyNameAr} onChange={v => setCompanyDetails(p => ({ ...p, companyNameAr: v }))} placeholder={tr('اسم الشركة بالعربية', 'Company name in Arabic')} />
              <SettingsField label={tr('رقم السجل التجاري', 'Commercial Registration #')} value={companyDetails.crNumber} onChange={v => setCompanyDetails(p => ({ ...p, crNumber: v }))} placeholder="1010XXXXXX" />
              <SettingsField label={tr('رقم منشأة وزارة العمل', 'MOL Establishment #')} value={companyDetails.molNumber} onChange={v => setCompanyDetails(p => ({ ...p, molNumber: v }))} />
              <SettingsField label={tr('رقم منشأة التأمينات', 'GOSI Establishment #')} value={companyDetails.gosiNumber} onChange={v => setCompanyDetails(p => ({ ...p, gosiNumber: v }))} />
              <SettingsField label={tr('الرقم الضريبي', 'VAT Number')} value={companyDetails.vatNumber} onChange={v => setCompanyDetails(p => ({ ...p, vatNumber: v }))} placeholder="3XXXXXXXXXXXXX3" />
              <SettingsField label={tr('العنوان الوطني', 'National Address')} value={companyDetails.nationalAddress} onChange={v => setCompanyDetails(p => ({ ...p, nationalAddress: v }))} className="md:col-span-2" />
              <SettingsField label={tr('رقم هوية المفوض بالتوقيع', 'Authorized Signatory ID')} value={companyDetails.signatoryId} onChange={v => setCompanyDetails(p => ({ ...p, signatoryId: v }))} />
              <SettingsField label={tr('جوال المفوض بالتوقيع', 'Authorized Signatory Mobile')} value={companyDetails.signatoryMobile} onChange={v => setCompanyDetails(p => ({ ...p, signatoryMobile: v }))} placeholder="+966 5X XXX XXXX" />
            </div>
            <CVisionButton C={C} isDark={isDark} onClick={() => toast.success(tr('تم الحفظ', 'Saved'), { description: tr('تم تحديث بيانات الشركة', 'Company details updated') })}>
              {tr('حفظ بيانات الشركة', 'Save Company Details')}
            </CVisionButton>
          </div>

          {/* Bank accounts */}
          <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🏦</span> {tr('الحسابات البنكية', 'Bank Accounts')}
              </h3>
              <CVisionButton C={C} isDark={isDark}
                variant="outline"
                size="sm"
                onClick={() => setBankAccounts(prev => [...prev, { bank: '', iban: '', name: '' }])}
              >
                <Plus style={{ height: 12, width: 12, marginInlineEnd: 4 }} /> {tr('إضافة حساب', 'Add Account')}
              </CVisionButton>
            </div>
            {bankAccounts.length === 0 && (
              <p style={{ fontSize: 13, color: C.textMuted }}>{tr('لا توجد حسابات بنكية مكوّنة. أضف حسابًا لتفعيل إنشاء ملفات الرواتب.', 'No bank accounts configured. Add one to enable salary file generation.')}</p>
            )}
            {bankAccounts.map((acct, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 12, alignItems: 'flex-end', borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('البنك', 'Bank')}</CVisionLabel>
                  <CVisionSelect
                C={C}
                value={acct.bank}
                placeholder={tr('اختر بنكًا', 'Select bank')}
                options={BANKS_DATA.map(b => (
                        ({ value: b.code, label: tr(b.nameAr, b.nameEn) })
                      ))}
              />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('رقم الآيبان', 'IBAN')}</CVisionLabel>
                  <CVisionInput C={C}
                    value={acct.iban}
                    onChange={e => {
                      const next = [...bankAccounts];
                      next[idx] = { ...acct, iban: e.target.value };
                      setBankAccounts(next);
                    }}
                    placeholder="SA80 XXXX XXXX XXXX XXXX XXXX"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('اسم الحساب', 'Account Name')}</CVisionLabel>
                  <CVisionInput C={C}
                    value={acct.name}
                    onChange={e => {
                      const next = [...bankAccounts];
                      next[idx] = { ...acct, name: e.target.value };
                      setBankAccounts(next);
                    }}
                    placeholder={tr('اسم الشركة', 'Company Name')}
                  />
                </div>
                <CVisionButton C={C} isDark={isDark}
                  variant="ghost"
                  size="icon"
                  style={{ color: C.red }}
                  onClick={() => setBankAccounts(prev => prev.filter((_, i) => i !== idx))}
                >
                  <Trash2 style={{ height: 16, width: 16 }} />
                </CVisionButton>
              </div>
            ))}
          </div>

          {/* Integration-specific settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontWeight: 600 }}>{tr('تكوين التكاملات', 'Integration Configuration')}</h3>
            {integrations.map(intg => {
              const isExpanded = expandedSettings === intg.id;
              const creds = credentials[intg.id] || {};
              return (
                <div key={intg.id} style={{ borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                  <button
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, transition: 'color 0.2s, background 0.2s', textAlign: isRTL ? 'right' : 'left' }}
                    onClick={() => setExpandedSettings(isExpanded ? null : intg.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 18 }}>{INTEGRATION_ICONS[intg.id] || '🔗'}</span>
                      <div>
                        <span style={{ fontWeight: 500 }}>{intg.name}</span>
                        <span style={{ fontSize: 12, color: C.textMuted, marginInlineStart: 8 }}>({intg.provider})</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CVisionBadge C={C} variant="outline" className={`text-[10px] ${MODE_BADGE[intg.mode]?.className}`}>
                        {intg.mode}
                      </CVisionBadge>
                      {isExpanded ? <ChevronDown style={{ height: 16, width: 16 }} /> : <ChevronRight style={{ height: 16, width: 16 }} />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div style={{ borderTop: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Mode toggle */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <CVisionLabel C={C} style={{ fontSize: 12, fontWeight: 500 }}>{tr('الوضع', 'Mode')}</CVisionLabel>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {(['SIMULATION', 'LIVE', 'FILE_EXPORT'] as const).map(m => {
                            if (m === 'FILE_EXPORT' && intg.hasApi) return null;
                            if (m === 'LIVE' && !intg.hasApi) return null;
                            const modeLabel = m === 'SIMULATION' ? tr('محاكاة', 'SIMULATION') : m === 'LIVE' ? tr('مباشر', 'LIVE') : tr('تصدير ملفات', 'FILE EXPORT');
                            return (
                              <CVisionButton C={C} isDark={isDark}
                                key={m}
                                size="sm"
                                variant={intg.mode === m ? 'default' : 'outline'}
                                onClick={() => handleToggleMode(intg.id, m)}
                              >
                                {m === 'SIMULATION' && <Zap style={{ height: 12, width: 12, marginInlineEnd: 4 }} />}
                                {m === 'LIVE' && <Globe style={{ height: 12, width: 12, marginInlineEnd: 4 }} />}
                                {m === 'FILE_EXPORT' && <HardDrive style={{ height: 12, width: 12, marginInlineEnd: 4 }} />}
                                {modeLabel}
                              </CVisionButton>
                            );
                          })}
                        </div>
                      </div>

                      {/* API credentials */}
                      {intg.hasApi && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
                          <SettingsField
                            label={tr('رابط API', 'API URL')}
                            value={creds.apiUrl || ''}
                            onChange={v => updateCredential(intg.id, 'apiUrl', v)}
                            placeholder={`https://api.${intg.url || intg.id + '.sa'}`}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('مفتاح API', 'API Key')}</CVisionLabel>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <CVisionInput C={C}
                                type={showSecrets[intg.id] ? 'text' : 'password'}
                                value={creds.apiKey || ''}
                                onChange={e => updateCredential(intg.id, 'apiKey', e.target.value)}
                                placeholder="••••••••••"
                              />
                              <CVisionButton C={C} isDark={isDark}
                                variant="ghost"
                                size="icon"
                                className="shrink-0"
                                onClick={() => setShowSecrets(p => ({ ...p, [intg.id]: !p[intg.id] }))}
                              >
                                {showSecrets[intg.id] ? <EyeOff style={{ height: 16, width: 16 }} /> : <Eye style={{ height: 16, width: 16 }} />}
                              </CVisionButton>
                            </div>
                          </div>
                          <SettingsField
                            label={tr('معرّف العميل', 'Client ID')}
                            value={creds.clientId || ''}
                            onChange={v => updateCredential(intg.id, 'clientId', v)}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('المفتاح السري', 'Client Secret')}</CVisionLabel>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <CVisionInput C={C}
                                type={showSecrets[intg.id] ? 'text' : 'password'}
                                value={creds.clientSecret || ''}
                                onChange={e => updateCredential(intg.id, 'clientSecret', e.target.value)}
                                placeholder="••••••••••"
                              />
                              <CVisionButton C={C} isDark={isDark}
                                variant="ghost"
                                size="icon"
                                className="shrink-0"
                                onClick={() => setShowSecrets(p => ({ ...p, [intg.id]: !p[intg.id] }))}
                              >
                                {showSecrets[intg.id] ? <EyeOff style={{ height: 16, width: 16 }} /> : <Eye style={{ height: 16, width: 16 }} />}
                              </CVisionButton>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Additional settings for certain integrations */}
                      {(intg.id === 'qiwa' || intg.id === 'mudad') && (
                        <SettingsField
                          label={tr('رقم منشأة وزارة العمل', 'Company MOL #')}
                          value={creds.molNumber || ''}
                          onChange={v => updateCredential(intg.id, 'molNumber', v)}
                        />
                      )}
                      {(intg.id === 'wathq' || intg.id === 'zatca') && (
                        <SettingsField
                          label={tr('رقم السجل التجاري', 'CR Number')}
                          value={creds.crNumber || ''}
                          onChange={v => updateCredential(intg.id, 'crNumber', v)}
                        />
                      )}

                      <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
                        <CVisionButton C={C} isDark={isDark}
                          size="sm"
                          onClick={() => handleTest(intg.id)}
                          variant="outline"
                          disabled={testingId === intg.id}
                        >
                          {testingId === intg.id ? <Loader2 style={{ height: 12, width: 12, marginInlineEnd: 4, animation: 'spin 1s linear infinite' }} /> : <Zap style={{ height: 12, width: 12, marginInlineEnd: 4 }} />}
                          {tr('اختبار الاتصال', 'Test Connection')}
                        </CVisionButton>
                        <CVisionButton C={C} isDark={isDark}
                          size="sm"
                          onClick={() => handleSaveConfig(intg.id)}
                          disabled={savingId === intg.id}
                        >
                          {savingId === intg.id ? <Loader2 style={{ height: 12, width: 12, marginInlineEnd: 4, animation: 'spin 1s linear infinite' }} /> : null}
                          {tr('حفظ', 'Save')}
                        </CVisionButton>
                        <CVisionButton C={C} isDark={isDark}
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setCredentials(p => ({ ...p, [intg.id]: {} }));
                            toast.info(tr('تم إعادة التعيين', 'Reset'), { description: tr('تم مسح الحقول', 'Fields cleared') });
                          }}
                        >
                          {tr('إعادة تعيين', 'Reset')}
                        </CVisionButton>
                      </div>

                      {/* Help text */}
                      <div style={{ borderRadius: 6, padding: 12, fontSize: 12, color: C.textMuted }}>
                        <p style={{ fontWeight: 500, marginBottom: 4 }}>{tr('للحصول على بيانات API:', 'To get API credentials:')}</p>
                        <ol style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <li>{tr(`سجّل في ${intg.url || intg.id + '.sa'}`, `Register at ${intg.url || intg.id + '.sa'}`)}</li>
                          <li>{tr('اطلب وصول API لمنشأتك', 'Request API access for your establishment')}</li>
                          <li>{tr('أدخل البيانات أعلاه ثم اضغط حفظ', 'Enter the credentials above and click Save')}</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Logs */}
          {logs.length > 0 && (
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ fontWeight: 600 }}>{tr('سجلات التكامل', 'Integration Logs')}</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: isRTL ? 'right' : 'left', color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>
                      <th style={{ paddingBottom: 8, paddingInlineEnd: 16 }}>{tr('التاريخ', 'Date')}</th>
                      <th style={{ paddingBottom: 8, paddingInlineEnd: 16 }}>{tr('التكامل', 'Integration')}</th>
                      <th style={{ paddingBottom: 8, paddingInlineEnd: 16 }}>{tr('الإجراء', 'Action')}</th>
                      <th style={{ paddingBottom: 8, paddingInlineEnd: 16 }}>{tr('الحالة', 'Status')}</th>
                      <th style={{ paddingBottom: 8, paddingInlineEnd: 16 }}>{tr('المدة', 'Duration')}</th>
                      <th style={{ paddingBottom: 8 }}>{tr('التفاصيل', 'Details')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ paddingTop: 8, paddingBottom: 8, paddingInlineEnd: 16, fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(log.createdAt).toLocaleString(isRTL ? 'ar-SA' : 'en')}</td>
                        <td style={{ paddingTop: 8, paddingBottom: 8, paddingInlineEnd: 16 }}>{log.integrationId}</td>
                        <td style={{ paddingTop: 8, paddingBottom: 8, paddingInlineEnd: 16 }}>{log.action}</td>
                        <td style={{ paddingTop: 8, paddingBottom: 8, paddingInlineEnd: 16 }}>
                          <CVisionBadge C={C} variant={log.status === 'SUCCESS' ? 'default' : 'destructive'} className="text-[10px]">
                            {log.status}
                          </CVisionBadge>
                        </td>
                        <td style={{ paddingTop: 8, paddingBottom: 8, paddingInlineEnd: 16, fontSize: 12 }}>{log.duration ? `${log.duration}ms` : '—'}</td>
                        <td style={{ paddingTop: 8, paddingBottom: 8, fontSize: 12, color: C.textMuted }}>{log.error || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        </CVisionTabContent>
      </CVisionTabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SettingsField({ label, value, onChange, placeholder, className, type = 'text' }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  type?: string;
}) {
  const { C, isDark } = useCVisionTheme();
  return (
    <div className={`space-y-1 ${className || ''}`}>
      <CVisionLabel C={C} style={{ fontSize: 12 }}>{label}</CVisionLabel>
      <CVisionInput C={C}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function ComplianceRow({ done, label, action, onAction, isRTL }: {
  done: boolean;
  label: string;
  action?: string;
  onAction?: () => void;
  isRTL?: boolean;
}) {
  const { C, isDark } = useCVisionTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {done
          ? <CheckCircle2 style={{ height: 16, width: 16, color: C.green }} />
          : <div style={{ height: 16, width: 16, borderRadius: 6, border: `1px solid ${C.border}` }} />
        }
        <span className={done ? 'text-green-700' : ''}>{label}</span>
      </div>
      {action && onAction && (
        <CVisionButton C={C} isDark={isDark} variant="link" size="sm" style={{ fontSize: 12, padding: 0 }} onClick={onAction}>
          {action} &rarr;
        </CVisionButton>
      )}
    </div>
  );
}
