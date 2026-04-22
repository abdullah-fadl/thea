'use client';

import { useState } from 'react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionPageHeader, CVisionPageLayout, CVisionEmptyState, CVisionSkeletonCard, CVisionSkeletonStyles,
  CVisionMiniStat, CVisionStatsRow, CVisionTabs, CVisionTabContent,
  CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd,
  CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { toast } from 'sonner';
import {
  Lock, Shield, ShieldAlert, ShieldCheck, RefreshCw,
  Monitor, Smartphone, Globe, Clock, Unlock, AlertTriangle,
  CheckCircle2, XCircle,
} from 'lucide-react';

// --- API helpers ---

const secApi = (params: Record<string, string>, signal?: AbortSignal) => {
  const sp = new URLSearchParams(params);
  return fetch(`/api/cvision/auth/security?${sp}`, { credentials: 'include', signal }).then(r => r.json());
};

const sessApi = (params: Record<string, string>, signal?: AbortSignal) => {
  const sp = new URLSearchParams(params);
  return fetch(`/api/cvision/sessions?${sp}`, { credentials: 'include', signal }).then(r => r.json());
};

const secPost = (body: Record<string, unknown>) =>
  fetch('/api/cvision/auth/security', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(body),
  }).then(r => r.json());

const sessPost = (body: Record<string, unknown>) =>
  fetch('/api/cvision/sessions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(body),
  }).then(r => r.json());

// --- Types ---

interface SecurityStats { totalLogins?: number; failedLogins?: number; lockedAccounts?: number; suspiciousActivities?: number }
interface Session { sessionId: string; device?: string; browser?: string; ip?: string; location?: string; createdAt: string; lastActive?: string; isCurrent?: boolean }
interface Alert { _id?: string; id?: string; type: string; email?: string; ip?: string; reason?: string; resolved?: boolean; createdAt: string }
interface LockedAccount { email: string; lockedAt?: string; failedAttempts?: number; lockReason?: string }

// --- Page ---

export default function SecurityPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['cvision', 'security', 'stats'],
    queryFn: () => secApi({ action: 'stats' }),
  });
  const stats: SecurityStats = (statsData as any)?.stats as SecurityStats || {};
  const config = (statsData as any)?.config as Record<string, unknown> || null;

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['cvision', 'sessions', 'my-sessions'],
    queryFn: () => sessApi({ action: 'my-sessions' }),
    enabled: activeTab === 'sessions',
  });
  const sessions: Session[] = (sessionsData as any)?.data as Session[] || [];

  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['cvision', 'security', 'alerts'],
    queryFn: () => secApi({ action: 'alerts' }),
    enabled: activeTab === 'alerts',
  });
  const alerts: Alert[] = (alertsData as any)?.alerts as Alert[] || [];

  const { data: lockedData, isLoading: lockedLoading } = useQuery({
    queryKey: ['cvision', 'security', 'locked'],
    queryFn: () => secApi({ action: 'locked' }),
    enabled: activeTab === 'locked',
  });
  const locked: LockedAccount[] = (lockedData as any)?.accounts as LockedAccount[] || [];

  const fetchStats = () => queryClient.invalidateQueries({ queryKey: ['cvision', 'security', 'stats'] });
  const fetchSessions = () => queryClient.invalidateQueries({ queryKey: ['cvision', 'sessions', 'my-sessions'] });
  const fetchAlerts = () => queryClient.invalidateQueries({ queryKey: ['cvision', 'security', 'alerts'] });
  const fetchLocked = () => queryClient.invalidateQueries({ queryKey: ['cvision', 'security', 'locked'] });

  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId: string) => sessPost({ action: 'revoke-session', sessionId }),
    onSuccess: (res: any) => {
      if (res.ok) { toast.success(tr('تم إلغاء الجلسة', 'Session revoked')); fetchSessions(); }
      else toast.error(res.error || tr('فشل', 'Failed'));
    },
    onError: () => toast.error(tr('فشل إلغاء الجلسة', 'Failed to revoke session')),
  });

  const revokeSession = async (sessionId: string) => { revokeSessionMutation.mutate(sessionId); };

  const revokeAllMutation = useMutation({
    mutationFn: () => sessPost({ action: 'revoke-all' }),
    onSuccess: (res: any) => {
      if (res.ok) { toast.success(tr('تم إلغاء جميع الجلسات الأخرى', 'All other sessions revoked')); fetchSessions(); }
      else toast.error(res.error || tr('فشل', 'Failed'));
      setConfirmRevokeAll(false);
    },
    onError: () => { toast.error(tr('فشل', 'Failed')); setConfirmRevokeAll(false); },
  });

  const revokeAll = async () => { revokeAllMutation.mutate(); };

  const unlockMutation = useMutation({
    mutationFn: (email: string) => secPost({ action: 'unlock', email }),
    onSuccess: (res: any, email: string) => {
      if (res.success) { toast.success(tr(`تم فتح ${email}`, `Unlocked ${email}`)); fetchLocked(); fetchStats(); }
      else toast.error(res.error || tr('فشل', 'Failed'));
    },
    onError: () => toast.error(tr('فشل فتح الحساب', 'Failed to unlock')),
  });

  const unlockAccount = async (email: string) => { unlockMutation.mutate(email); };

  const resolveAlertMutation = useMutation({
    mutationFn: (alertId: string) => secPost({ action: 'resolve', activityId: alertId }),
    onSuccess: (res: any) => {
      if (res.success) { toast.success(tr('تم حل التنبيه', 'Alert resolved')); fetchAlerts(); fetchStats(); }
      else toast.error(res.error || tr('فشل', 'Failed'));
    },
    onError: () => toast.error(tr('فشل حل التنبيه', 'Failed to resolve')),
  });

  const resolveAlert = async (alertId: string) => { resolveAlertMutation.mutate(alertId); };

  function formatDate(d?: string): string {
    if (!d) return '-';
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  const tabs = [
    { id: 'overview', label: 'Overview', labelAr: 'نظرة عامة', icon: <Shield size={14} /> },
    { id: 'sessions', label: 'Sessions', labelAr: 'الجلسات', icon: <Monitor size={14} /> },
    { id: 'alerts', label: 'Alerts', labelAr: 'التنبيهات', icon: <ShieldAlert size={14} /> },
    { id: 'locked', label: 'Locked Accounts', labelAr: 'حسابات مقفلة', icon: <Lock size={14} /> },
  ];

  return (
    <CVisionPageLayout style={{ maxWidth: 960, margin: '0 auto' }}>
      <CVisionPageHeader
        C={C}
        title={tr('الأمان', 'Security')}
        titleEn="Security"
        subtitle={tr('مراقبة نشاط تسجيل الدخول وإدارة الجلسات ومراجعة التنبيهات الأمنية', 'Monitor login activity, manage sessions, and review security alerts.')}
        icon={Lock}
        isRTL={isRTL}
      />

      <CVisionTabs C={C} tabs={tabs} activeTab={activeTab} onChange={setActiveTab} isRTL={isRTL} />

      {/* -- Overview -- */}
      <CVisionTabContent id="overview" activeTab={activeTab}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {statsLoading ? (
            <>
              <CVisionSkeletonStyles />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                {[1, 2, 3, 4].map(i => <CVisionSkeletonCard key={i} C={C} height={90} />)}
              </div>
            </>
          ) : (
            <>
              <CVisionStatsRow>
                <CVisionMiniStat C={C} label={tr('إجمالي الدخول', 'Total Logins')} value={stats.totalLogins ?? 0} icon={Shield} color={C.blue} colorDim={C.blueDim} />
                <CVisionMiniStat C={C} label={tr('الدخول الفاشل', 'Failed Logins')} value={stats.failedLogins ?? 0} icon={ShieldAlert} color={C.orange} colorDim={C.orangeDim} />
                <CVisionMiniStat C={C} label={tr('حسابات مقفلة', 'Locked Accounts')} value={stats.lockedAccounts ?? 0} icon={Lock} color={C.red} colorDim={C.redDim} />
                <CVisionMiniStat C={C} label={tr('أنشطة مشبوهة', 'Suspicious Activities')} value={stats.suspiciousActivities ?? 0} icon={AlertTriangle} color={C.gold} colorDim={C.goldDim} />
              </CVisionStatsRow>

              {config && (
                <CVisionCard C={C}>
                  <CVisionCardHeader C={C}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tr('إعدادات الأمان', 'Security Configuration')}</span>
                  </CVisionCardHeader>
                  <CVisionCardBody>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, fontSize: 13 }}>
                      {config.maxFailedAttempts && (
                        <div>
                          <div style={{ color: C.textMuted, fontSize: 11 }}>{tr('أقصى محاولات فاشلة', 'Max Failed Attempts')}</div>
                          <div style={{ fontWeight: 500, color: C.text }}>{String(config.maxFailedAttempts)}</div>
                        </div>
                      )}
                      {config.lockoutDurationMinutes && (
                        <div>
                          <div style={{ color: C.textMuted, fontSize: 11 }}>{tr('مدة القفل', 'Lockout Duration')}</div>
                          <div style={{ fontWeight: 500, color: C.text }}>{String(config.lockoutDurationMinutes)} {tr('دقيقة', 'min')}</div>
                        </div>
                      )}
                      {config.sessionTimeoutMinutes && (
                        <div>
                          <div style={{ color: C.textMuted, fontSize: 11 }}>{tr('مهلة الجلسة', 'Session Timeout')}</div>
                          <div style={{ fontWeight: 500, color: C.text }}>{String(config.sessionTimeoutMinutes)} {tr('دقيقة', 'min')}</div>
                        </div>
                      )}
                      {config.twoFactorEnabled !== undefined && (
                        <div>
                          <div style={{ color: C.textMuted, fontSize: 11 }}>{tr('المصادقة الثنائية', '2FA')}</div>
                          <div style={{ fontWeight: 500, color: C.text }}>{config.twoFactorEnabled ? tr('مفعل', 'Enabled') : tr('معطل', 'Disabled')}</div>
                        </div>
                      )}
                    </div>
                  </CVisionCardBody>
                </CVisionCard>
              )}
            </>
          )}
        </div>
      </CVisionTabContent>

      {/* -- Sessions -- */}
      <CVisionTabContent id="sessions" activeTab={activeTab}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={() => fetchSessions()}>{tr('تحديث', 'Refresh')}</CVisionButton>
            {sessions.length > 1 && (
              <CVisionButton C={C} isDark={isDark} variant="danger" size="sm" icon={<XCircle size={14} />} onClick={() => setConfirmRevokeAll(true)}>
                {tr('إلغاء كل الأخرى', 'Revoke All Others')}
              </CVisionButton>
            )}
          </div>

          {sessionsLoading && (
            <>
              <CVisionSkeletonStyles />
              {[1, 2, 3].map(i => <CVisionSkeletonCard key={i} C={C} height={64} />)}
            </>
          )}

          {!sessionsLoading && sessions.length === 0 && (
            <CVisionEmptyState C={C} icon={Monitor} title={tr('لا توجد جلسات نشطة', 'No active sessions')} description={tr('ستظهر بيانات الجلسات هنا', 'Session data will appear here.')} />
          )}

          {!sessionsLoading && sessions.map(s => (
            <CVisionCard key={s.sessionId} C={C}>
              <CVisionCardBody style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ borderRadius: '50%', background: C.bgSubtle, padding: 8 }}>
                    {s.device?.toLowerCase().includes('mobile') ? <Smartphone size={16} color={C.textMuted} /> : <Monitor size={16} color={C.textMuted} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {s.browser || tr('متصفح غير معروف', 'Unknown Browser')} {s.device ? `on ${s.device}` : ''}
                      {s.isCurrent && <CVisionBadge C={C} variant="success">{tr('الحالية', 'Current')}</CVisionBadge>}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 12, marginTop: 2 }}>
                      {s.ip && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Globe size={11} />{s.ip}</span>}
                      {s.lastActive && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} />{formatDate(s.lastActive)}</span>}
                    </div>
                  </div>
                </div>
                {!s.isCurrent && (
                  <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<XCircle size={14} />} onClick={() => revokeSession(s.sessionId)}>
                    {tr('إلغاء', 'Revoke')}
                  </CVisionButton>
                )}
              </CVisionCardBody>
            </CVisionCard>
          ))}
        </div>
      </CVisionTabContent>

      {/* -- Alerts -- */}
      <CVisionTabContent id="alerts" activeTab={activeTab}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={() => fetchAlerts()}>{tr('تحديث', 'Refresh')}</CVisionButton>

          {alertsLoading && (
            <>
              <CVisionSkeletonStyles />
              {[1, 2, 3].map(i => <CVisionSkeletonCard key={i} C={C} height={56} />)}
            </>
          )}

          {!alertsLoading && alerts.length === 0 && (
            <CVisionEmptyState C={C} icon={ShieldCheck} title={tr('لا توجد تنبيهات أمنية', 'No security alerts')} description={tr('كل شيء واضح - لم يتم اكتشاف أنشطة مشبوهة', 'All clear - no suspicious activities detected.')} />
          )}

          {!alertsLoading && alerts.length > 0 && (
            <CVisionCard C={C}>
              <CVisionTable C={C}>
                <CVisionTableHead C={C}>
                  <CVisionTh C={C}>{tr('النوع', 'Type')}</CVisionTh>
                  <CVisionTh C={C}>{tr('البريد', 'Email')}</CVisionTh>
                  <CVisionTh C={C}>{tr('العنوان', 'IP')}</CVisionTh>
                  <CVisionTh C={C}>{tr('السبب', 'Reason')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الوقت', 'Time')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('الإجراء', 'Action')}</CVisionTh>
                </CVisionTableHead>
                <CVisionTableBody>
                  {alerts.map((a, i) => (
                    <CVisionTr C={C} key={a._id || a.id || i}>
                      <CVisionTd>
                        <CVisionBadge C={C} variant="danger">
                          <AlertTriangle size={12} style={{ marginRight: 4 }} />
                          {a.type || tr('مشبوه', 'Suspicious')}
                        </CVisionBadge>
                      </CVisionTd>
                      <CVisionTd style={{ fontSize: 13, color: C.text }}>{a.email || '-'}</CVisionTd>
                      <CVisionTd style={{ fontSize: 13, color: C.textMuted, fontFamily: 'monospace' }}>{a.ip || '-'}</CVisionTd>
                      <CVisionTd style={{ fontSize: 13, color: C.textMuted }}>{a.reason || '-'}</CVisionTd>
                      <CVisionTd style={{ fontSize: 13, color: C.textMuted }}>{formatDate(a.createdAt)}</CVisionTd>
                      <CVisionTd align="right">
                        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<CheckCircle2 size={12} />} onClick={() => resolveAlert(a._id || a.id || '')}>
                          {tr('حل', 'Resolve')}
                        </CVisionButton>
                      </CVisionTd>
                    </CVisionTr>
                  ))}
                </CVisionTableBody>
              </CVisionTable>
            </CVisionCard>
          )}
        </div>
      </CVisionTabContent>

      {/* -- Locked Accounts -- */}
      <CVisionTabContent id="locked" activeTab={activeTab}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={() => fetchLocked()}>{tr('تحديث', 'Refresh')}</CVisionButton>

          {lockedLoading && (
            <>
              <CVisionSkeletonStyles />
              {[1, 2, 3].map(i => <CVisionSkeletonCard key={i} C={C} height={56} />)}
            </>
          )}

          {!lockedLoading && locked.length === 0 && (
            <CVisionEmptyState C={C} icon={ShieldCheck} title={tr('لا توجد حسابات مقفلة', 'No locked accounts')} description={tr('جميع الحسابات متاحة', 'All accounts are accessible.')} />
          )}

          {!lockedLoading && locked.length > 0 && (
            <CVisionCard C={C}>
              <CVisionTable C={C}>
                <CVisionTableHead C={C}>
                  <CVisionTh C={C}>{tr('البريد', 'Email')}</CVisionTh>
                  <CVisionTh C={C}>{tr('محاولات فاشلة', 'Failed Attempts')}</CVisionTh>
                  <CVisionTh C={C}>{tr('وقت القفل', 'Locked At')}</CVisionTh>
                  <CVisionTh C={C}>{tr('السبب', 'Reason')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('الإجراء', 'Action')}</CVisionTh>
                </CVisionTableHead>
                <CVisionTableBody>
                  {locked.map(acc => (
                    <CVisionTr C={C} key={acc.email}>
                      <CVisionTd style={{ fontWeight: 500, color: C.text }}>{acc.email}</CVisionTd>
                      <CVisionTd><CVisionBadge C={C} variant="muted">{acc.failedAttempts ?? '-'}</CVisionBadge></CVisionTd>
                      <CVisionTd style={{ fontSize: 13, color: C.textMuted }}>{formatDate(acc.lockedAt)}</CVisionTd>
                      <CVisionTd style={{ fontSize: 13, color: C.textMuted }}>{acc.lockReason || tr('محاولات فاشلة كثيرة', 'Too many failed attempts')}</CVisionTd>
                      <CVisionTd align="right">
                        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<Unlock size={12} />} onClick={() => unlockAccount(acc.email)}>
                          {tr('فتح', 'Unlock')}
                        </CVisionButton>
                      </CVisionTd>
                    </CVisionTr>
                  ))}
                </CVisionTableBody>
              </CVisionTable>
            </CVisionCard>
          )}
        </div>
      </CVisionTabContent>

      {/* Confirm Revoke All Dialog */}
      <CVisionDialog
        C={C}
        open={confirmRevokeAll}
        onClose={() => setConfirmRevokeAll(false)}
        title={tr('إلغاء كل الجلسات الأخرى؟', 'Revoke all other sessions?')}
        isRTL={isRTL}
        width={440}
      >
        <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6, marginBottom: 16 }}>
          {tr('سيتم تسجيل خروجك من جميع الأجهزة الأخرى. ستبقى جلستك الحالية نشطة.', 'This will sign you out from all other devices. Your current session will remain active.')}
        </div>
        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setConfirmRevokeAll(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="danger" onClick={revokeAll}>{tr('إلغاء الكل', 'Revoke All')}</CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>
    </CVisionPageLayout>
  );
}
