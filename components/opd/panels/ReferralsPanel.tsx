'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { Building2, Globe, MessageSquare, Clipboard, RefreshCw, Check, X } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const STATUS_STYLES: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  ACCEPTED:  'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
  SCHEDULED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200',
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
  REJECTED:  'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
  CANCELLED: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
};

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  PENDING:   { ar: 'معلق', en: 'Pending' },
  ACCEPTED:  { ar: 'مقبول', en: 'Accepted' },
  SCHEDULED: { ar: 'مجدول', en: 'Scheduled' },
  COMPLETED: { ar: 'مكتمل', en: 'Completed' },
  REJECTED:  { ar: 'مرفوض', en: 'Rejected' },
  CANCELLED: { ar: 'ملغي', en: 'Cancelled' },
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  internal:     <Building2 className="h-4 w-4 inline-block" />,
  external:     <Globe className="h-4 w-4 inline-block" />,
  consultation: <MessageSquare className="h-4 w-4 inline-block" />,
};

interface Props {
  visitId: string;
}

export default function ReferralsPanel({ visitId }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'outgoing' | 'incoming'>('outgoing');
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Outgoing: referrals sent by this doctor (filtered to this encounter)
  const { data: outData, isLoading: outLoading, mutate: mutateOut } = useSWR(
    '/api/referrals?direction=outgoing',
    fetcher
  );

  // Incoming: referrals addressed to this doctor
  const { data: inData, isLoading: inLoading, mutate: mutateIn } = useSWR(
    '/api/referrals?direction=incoming',
    fetcher
  );

  const outgoing = (outData?.items || []).filter(
    (ref: any) => ref.encounterCoreId === visitId
  );
  const incoming = (inData?.items || []).filter(
    (ref: any) => ref.status === 'PENDING' || ref.status === 'ACCEPTED'
  );

  const pendingIncoming = incoming.filter((r: any) => r.status === 'PENDING').length;

  const handleAccept = async (referralId: string) => {
    setBusy(referralId);
    try {
      const res = await fetch(`/api/referrals/${referralId}/accept`, { credentials: 'include', method: 'POST' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
      toast({ title: tr('تم قبول التحويل', 'Referral accepted') });
      mutateIn();
      mutateOut();
    } catch (e: any) {
      toast({ title: tr('خطأ', 'Error'), description: e.message, variant: 'destructive' as const });
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async (referralId: string) => {
    if (!rejectReason.trim()) {
      toast({ title: tr('أدخل سبب الرفض', 'Enter rejection reason'), variant: 'destructive' as const });
      return;
    }
    setBusy(referralId);
    try {
      const res = await fetch(`/api/referrals/${referralId}/reject`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
      toast({ title: tr('تم رفض التحويل', 'Referral rejected') });
      setRejectTarget(null);
      setRejectReason('');
      mutateIn();
    } catch (e: any) {
      toast({ title: tr('خطأ', 'Error'), description: e.message, variant: 'destructive' as const });
    } finally {
      setBusy(null);
    }
  };

  const isLoading = activeTab === 'outgoing' ? outLoading : inLoading;
  const items = activeTab === 'outgoing' ? outgoing : incoming;

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <RefreshCw className="h-5 w-5" /> {tr('التحويلات', 'Referrals')}
      </h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('outgoing')}
          className={`px-4 py-2 rounded-xl text-sm font-medium thea-transition-fast ${
            activeTab === 'outgoing'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {tr('صادرة', 'Sent')}
          {outgoing.length > 0 && (
            <span className="ml-1.5 bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
              {outgoing.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('incoming')}
          className={`relative px-4 py-2 rounded-xl text-sm font-medium thea-transition-fast ${
            activeTab === 'incoming'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {tr('واردة', 'Received')}
          {pendingIncoming > 0 && (
            <span className="ml-1.5 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {pendingIncoming}
            </span>
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          {tr('جاري التحميل...', 'Loading...')}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {activeTab === 'outgoing' ? (
            <>
              <p>{tr('لا يوجد تحويلات لهذه الزيارة', 'No referrals for this visit')}</p>
              <p className="text-sm mt-1">
                {tr('استخدم زر "تحويل" لإنشاء تحويل جديد', 'Use the "Referral" button to create a new referral')}
              </p>
            </>
          ) : (
            <p>{tr('لا يوجد تحويلات واردة', 'No incoming referrals')}</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((ref: any) => {
            const statusLabel = STATUS_LABELS[ref.status] || { ar: ref.status, en: ref.status };
            const typeIcon = TYPE_ICONS[ref.type] || <Clipboard className="h-4 w-4 inline-block" />;
            const isPending = ref.status === 'PENDING';
            const isRejectOpen = rejectTarget === ref.id;

            return (
              <div key={ref.id} className="p-4 rounded-xl border border-border">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[ref.status] || STATUS_STYLES.PENDING}`}>
                        {language === 'ar' ? statusLabel.ar : statusLabel.en}
                      </span>
                      <span className="text-sm" title={ref.type}>{typeIcon}</span>
                      {ref.urgency && ref.urgency !== 'routine' && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          ref.urgency === 'stat'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                        }`}>
                          {ref.urgency === 'stat' ? tr('طارئ', 'STAT') : tr('عاجل', 'Urgent')}
                        </span>
                      )}
                    </div>
                    {/* Outgoing: show destination */}
                    {activeTab === 'outgoing' && (
                      <p className="font-medium text-foreground">
                        {tr('إلى:', 'To:')} {ref.toProviderName || ref.toSpecialtyCode || ref.externalFacility || tr('غير محدد', 'Unspecified')}
                      </p>
                    )}
                    {/* Incoming: show origin */}
                    {activeTab === 'incoming' && (
                      <>
                        <p className="font-semibold text-foreground">{ref.patientName}</p>
                        <p className="text-sm text-muted-foreground">
                          {tr('من:', 'From:')} {ref.fromProviderName || tr('غير محدد', 'Unknown')}
                        </p>
                      </>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">{ref.reason}</p>
                    {ref.clinicalNotes && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">{ref.clinicalNotes}</p>
                    )}
                  </div>
                </div>

                {/* Accept / Reject buttons for incoming PENDING referrals */}
                {activeTab === 'incoming' && isPending && (
                  <div className="mt-3 space-y-2">
                    {!isRejectOpen ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAccept(ref.id)}
                          disabled={busy === ref.id}
                          className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium
                                     hover:bg-emerald-700 disabled:opacity-50 thea-transition-fast"
                        >
                          {busy === ref.id ? tr('جاري...', 'Processing...') : <><Check className="h-3.5 w-3.5 inline-block" /> {tr('قبول', 'Accept')}</>}
                        </button>
                        <button
                          onClick={() => setRejectTarget(ref.id)}
                          disabled={busy === ref.id}
                          className="flex-1 py-2 border border-red-300 text-red-600 rounded-xl text-sm font-medium
                                     hover:bg-red-50 disabled:opacity-50 thea-transition-fast"
                        >
                          <><X className="h-3.5 w-3.5 inline-block" /> {tr('رفض', 'Reject')}</>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder={tr('سبب الرفض...', 'Rejection reason...')}
                          rows={2}
                          className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background resize-none
                                     focus:ring-2 focus:ring-red-400 focus:border-red-400"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReject(ref.id)}
                            disabled={busy === ref.id}
                            className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-medium
                                       hover:bg-red-700 disabled:opacity-50 thea-transition-fast"
                          >
                            {busy === ref.id ? tr('جاري...', 'Processing...') : tr('تأكيد الرفض', 'Confirm Reject')}
                          </button>
                          <button
                            onClick={() => { setRejectTarget(null); setRejectReason(''); }}
                            className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted thea-transition-fast"
                          >
                            {tr('إلغاء', 'Cancel')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Status info for accepted incoming */}
                {activeTab === 'incoming' && ref.status === 'ACCEPTED' && (
                  <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <Check className="h-3.5 w-3.5 inline-block" /> {tr('تم القبول — المريض في قائمة انتظارك', 'Accepted — patient added to your queue')}
                  </div>
                )}

                <div className="mt-2 text-xs text-muted-foreground">
                  {new Date(ref.createdAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-GB', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
