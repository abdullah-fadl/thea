'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useMe } from '@/lib/hooks/useMe';
import { useLang } from '@/hooks/use-lang';
import { t } from '@/lib/i18n';
import {
  Send,
  Inbox,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  ArrowRight,
  Building2,
  User,
  Calendar,
  RefreshCw,
  Zap,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function Referrals() {
  const { me } = useMe();
  const { language } = useLang();
  const tr = (key: string) => t(`referrals.${key}`, language);

  const [view, setView] = useState<'outgoing' | 'incoming'>('outgoing');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const role = String(me?.user?.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'thea-owner';

  const statusConfig = (lang: typeof language) => ({
    PENDING: { label: t('referrals.statusPending', lang), color: 'bg-amber-100 text-amber-700', icon: Clock },
    ACCEPTED: { label: t('referrals.statusAccepted', lang), color: 'bg-green-100 text-green-700', icon: CheckCircle },
    REJECTED: { label: t('referrals.statusRejected', lang), color: 'bg-red-100 text-red-700', icon: XCircle },
    COMPLETED: { label: t('referrals.statusCompleted', lang), color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
    CANCELLED: { label: t('referrals.statusCancelled', lang), color: 'bg-slate-100 text-slate-700', icon: XCircle },
  });

  const priorityConfig = (lang: typeof language) => ({
    routine: { label: t('referrals.priorityRoutine', lang), color: 'text-green-600' },
    urgent: { label: t('referrals.priorityUrgent', lang), color: 'text-amber-600' },
    stat: { label: t('referrals.priorityStat', lang), color: 'text-red-600' },
  });

  const params = new URLSearchParams();
  params.set('direction', view);
  if (statusFilter) params.set('status', statusFilter);
  if (search) params.set('search', search);
  if (isAdmin) params.set('scope', 'all');

  const { data, mutate, isLoading } = useSWR(`/api/referrals?${params.toString()}`, fetcher, {
    refreshInterval: 30000,
  });

  const referrals = data?.items || [];
  const isAdminView = !!data?.isAdminView;

  const handleAccept = async (referralId: string) => {
    if (!confirm(tr('confirmAccept'))) return;
    await fetch(`/api/referrals/${referralId}/accept`, { credentials: 'include', method: 'POST' });
    mutate();
  };

  const handleReject = async (referralId: string) => {
    const reason = prompt(tr('rejectReason'));
    if (!reason) return;
    await fetch(`/api/referrals/${referralId}/reject`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    mutate();
  };

  // Fetch stats for both directions to show accurate totals
  const { data: outData } = useSWR(`/api/referrals?direction=outgoing${isAdmin ? '&scope=all' : ''}`, fetcher, { refreshInterval: 30000 });
  const { data: inData } = useSWR(`/api/referrals?direction=incoming${isAdmin ? '&scope=all' : ''}`, fetcher, { refreshInterval: 30000 });

  const allOut: any[] = outData?.items || [];
  const allIn: any[] = inData?.items || [];

  const stats = {
    pendingOut: allOut.filter((r: any) => r.status === 'PENDING').length,
    pendingIn: allIn.filter((r: any) => r.status === 'PENDING').length,
    accepted: [...allOut, ...allIn].filter((r: any) => r.status === 'ACCEPTED').length,
    total: allOut.length + allIn.length,
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              {tr('title')}
              {isAdminView && (
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {tr('adminBadge')}
                </span>
              )}
            </h1>
            <p className="text-muted-foreground">
              {isAdminView ? tr('subtitleAdmin') : tr('subtitle')}
            </p>
          </div>
          <button onClick={() => mutate()} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl thea-hover-lift">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {tr('refresh')}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-xl">
                <Send className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pendingOut}</p>
                <p className="text-xs text-muted-foreground">{tr('pendingOut')}</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-xl">
                <Inbox className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pendingIn}</p>
                <p className="text-xs text-muted-foreground">{tr('pendingIn')}</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-xl">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.accepted}</p>
                <p className="text-xs text-muted-foreground">{tr('accepted')}</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-xl">
                <ArrowRight className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">{tr('total')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setView('outgoing')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium ${
              view === 'outgoing' ? 'bg-indigo-600 text-white' : 'bg-card border border-border text-muted-foreground thea-hover-lift'
            }`}
          >
            <Send className="w-4 h-4" />
            {tr('outgoing')}
          </button>
          <button
            onClick={() => setView('incoming')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium ${
              view === 'incoming' ? 'bg-indigo-600 text-white' : 'bg-card border border-border text-muted-foreground thea-hover-lift'
            }`}
          >
            <Inbox className="w-4 h-4" />
            {tr('incoming')}
          </button>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tr('searchPlaceholder')}
                className="w-full pr-10 pl-4 py-2 border border-border rounded-xl thea-input-focus"
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 border border-border rounded-xl thea-input-focus">
              <option value="">{tr('allStatuses')}</option>
              <option value="PENDING">{tr('statusPending')}</option>
              <option value="ACCEPTED">{tr('statusAccepted')}</option>
              <option value="REJECTED">{tr('statusRejected')}</option>
              <option value="COMPLETED">{tr('statusCompleted')}</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {referrals.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-12 text-center">
              <Send className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">{tr('noReferrals')}</h3>
              <p className="text-muted-foreground">{tr('noReferralsDesc')}</p>
            </div>
          ) : (
            referrals.map((referral: any) => {
              const sc = statusConfig(language);
              const pc = priorityConfig(language);
              const cfg = sc[referral.status as keyof typeof sc] || sc.PENDING;
              const prCfg = pc[referral.urgency as keyof typeof pc] || pc.routine;
              const StatusIcon = cfg.icon;

              return (
                <div key={referral.id} className="bg-card rounded-2xl border border-border overflow-hidden thea-hover-lift">
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-2xl ${referral.type === 'external' ? 'bg-purple-100' : 'bg-indigo-100'}`}>
                          {referral.type === 'external' ? (
                            <Building2 className="w-6 h-6 text-purple-600" />
                          ) : referral.type === 'consultation' ? (
                            <User className="w-6 h-6 text-indigo-600" />
                          ) : (
                            <ArrowRight className="w-6 h-6 text-indigo-600" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{referral.patientName}</h3>
                            <span className="text-sm text-muted-foreground">({referral.patientMrn})</span>
                            <span className={`text-sm font-medium ${prCfg.color}`}>
                              {referral.urgency === 'stat' && <Zap className="h-3.5 w-3.5 inline" />}
                              {prCfg.label}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {isAdminView ? (
                              <>
                                {tr('from')}: {referral.fromProviderName || '—'}
                                {referral.fromSpecialtyName && ` (${referral.fromSpecialtyName})`}
                                {' → '}
                                {tr('to')}:{' '}
                                {referral.type === 'external'
                                  ? referral.externalFacility
                                  : referral.toProviderName || referral.toSpecialtyName || referral.toSpecialtyCode || '—'}
                              </>
                            ) : view === 'outgoing' ? (
                              <>
                                {tr('to')}:{' '}
                                {referral.type === 'external'
                                  ? referral.externalFacility
                                  : [referral.toProviderName, referral.toSpecialtyName || referral.toSpecialtyCode].filter(Boolean).join(' — ') || '—'}
                              </>
                            ) : (
                              <>
                                {tr('from')}: {referral.fromProviderName || '—'}
                                {referral.fromSpecialtyName ? ` — ${referral.fromSpecialtyName}` : ''}
                              </>
                            )}
                          </div>
                          {(referral.reason || referral.clinicalNotes) && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {tr('reason')}: {(referral.reason || referral.clinicalNotes)?.substring(0, 120)}
                              {(referral.reason || referral.clinicalNotes)?.length > 120 ? '...' : ''}
                            </div>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(referral.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                            </span>
                            {referral.validUntil && (
                              <span>{tr('validUntil')}: {new Date(referral.validUntil).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold ${cfg.color}`}>
                          <StatusIcon className="w-4 h-4" />
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {view === 'incoming' && !isAdminView && referral.status === 'PENDING' && (
                    <div className="border-t border-border bg-background p-3 flex justify-end gap-2">
                      <button
                        onClick={() => handleReject(referral.id)}
                        className="px-4 py-2 border border-red-300 text-red-600 rounded-xl hover:bg-red-50"
                      >
                        {tr('reject')}
                      </button>
                      <button
                        onClick={() => handleAccept(referral.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700"
                      >
                        {tr('accept')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
