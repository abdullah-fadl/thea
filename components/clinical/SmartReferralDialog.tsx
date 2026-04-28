'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import {
  Building2, Globe, MessageSquare, RefreshCw, X, Sparkles,
  Trophy, Medal, Award, Star, User, AlertTriangle, Search,
  BarChart3, TrendingUp, CircleDot, CreditCard, Flag,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface Props {
  open: boolean;
  onClose: () => void;
  encounterId: string;
  patientId: string;
  patientName: string;
  currentDiagnoses?: string[];
  onSuccess?: () => void;
  /** Provider creating the referral (for filtering "my" referrals) */
  fromProviderId?: string;
  fromProviderName?: string;
  fromSpecialtyCode?: string;
  fromSpecialtyName?: string;
}

type ReferralType = 'internal' | 'external' | 'consultation';
type Priority = 'routine' | 'urgent' | 'stat';

interface ProviderRecommendation {
  providerId: string;
  providerName: string;
  providerNameAr: string;
  specialtyCode: string;
  clinicId?: string;
  level?: string;
  score: number;
  isActiveNow: boolean;
  nextAvailableSlot: string | null;
  stats: {
    availableSlotsToday: number;
    totalSlotsToday: number;
    bookedToday: number;
    utilizationPct: number;
    currentQueueSize: number;
  };
  recommendation: {
    reason: string;
    reasonEn: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  };
}

export function SmartReferralDialog({
  open,
  onClose,
  encounterId,
  patientId,
  patientName,
  currentDiagnoses = [],
  onSuccess,
  fromProviderId,
  fromProviderName,
  fromSpecialtyCode,
  fromSpecialtyName,
}: Props) {
  const { language } = useLang();
  const { toast } = useToast();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  // Form state
  const [referralType, setReferralType] = useState<ReferralType>('internal');
  const [specialtyCode, setSpecialtyCode] = useState('');
  const [selectedProvider, setSelectedProvider] =
    useState<ProviderRecommendation | null>(null);
  const [showAllProviders, setShowAllProviders] = useState(false);
  const [providerSearch, setProviderSearch] = useState('');
  const [manualOverride, setManualOverride] = useState(false);
  const [priority, setPriority] = useState<Priority>('routine');
  const [reason, setReason] = useState('');
  const [clinicalSummary, setClinicalSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [completeAfterReferral, setCompleteAfterReferral] = useState(true);
  const [transferBilling, setTransferBilling] = useState(false);

  // External referral fields
  const [externalFacility, setExternalFacility] = useState('');
  const [externalDoctor, setExternalDoctor] = useState('');
  const [externalPhone, setExternalPhone] = useState('');

  // Fetch specialties (existing API — MongoDB based)
  const { data: specialtiesData } = useSWR(
    open ? '/api/specialties' : null,
    fetcher
  );
  const specialties = specialtiesData?.items || [];

  // Fetch smart recommendations when specialty is selected
  const { data: recommendationsData, isLoading: loadingRecs } = useSWR(
    open && specialtyCode && referralType !== 'external'
      ? `/api/referrals/smart-recommend?specialtyCode=${specialtyCode}`
      : null,
    fetcher
  );
  const recommendations: ProviderRecommendation[] =
    recommendationsData?.recommendations || [];
  const allProviders: ProviderRecommendation[] =
    recommendationsData?.allProviders || [];

  // Fetch ALL providers for manual override (when no providers in selected specialty)
  const { data: allProvidersData, isLoading: loadingAllProviders } = useSWR(
    open && specialtyCode && manualOverride && referralType !== 'external'
      ? `/api/referrals/smart-recommend?specialtyCode=__ALL__&limit=50`
      : null,
    fetcher
  );
  const manualProviders: ProviderRecommendation[] =
    allProvidersData?.allProviders || [];

  // Reset form when closing
  useEffect(() => {
    if (!open) {
      setReferralType('internal');
      setSpecialtyCode('');
      setSelectedProvider(null);
      setShowAllProviders(false);
      setProviderSearch('');
      setManualOverride(false);
      setPriority('routine');
      setReason('');
      setClinicalSummary('');
      setExternalFacility('');
      setExternalDoctor('');
      setExternalPhone('');
      setTransferBilling(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr(
          'يجب إدخال سبب التحويل',
          'Referral reason is required'
        ),
        variant: 'destructive' as const,
      });
      return;
    }

    if (referralType !== 'external' && !selectedProvider && specialtyCode) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('يجب اختيار طبيب', 'Please select a provider'),
        variant: 'destructive' as const,
      });
      return;
    }

    if (referralType === 'external' && !externalFacility.trim()) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr(
          'يجب إدخال اسم المنشأة',
          'Facility name is required'
        ),
        variant: 'destructive' as const,
      });
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        encounterId,
        patientId,
        patientName,
        type: referralType,
        priority,
        reason: reason.trim(),
        clinicalSummary: clinicalSummary.trim() || undefined,
        diagnosisCodes: currentDiagnoses,
        transferBilling: referralType !== 'external' ? transferBilling : false,
      };
      if (fromProviderId) body.fromProviderId = fromProviderId;
      if (fromProviderName) body.fromProviderName = fromProviderName;
      if (fromSpecialtyCode) body.fromSpecialtyCode = fromSpecialtyCode;
      if (fromSpecialtyName) body.fromSpecialtyName = fromSpecialtyName;

      if (referralType !== 'external') {
        body.toSpecialtyCode = specialtyCode || undefined;
        if (selectedProvider) {
          body.toProviderId = selectedProvider.providerId;
          body.toProviderName =
            language === 'ar'
              ? selectedProvider.providerNameAr
              : selectedProvider.providerName;
          body.wasSmartRecommended = recommendations.some(
            (r) => r.providerId === selectedProvider.providerId
          );
          body.smartScore = selectedProvider.score;
        }
      } else {
        body.toFacilityName = externalFacility.trim();
        body.toDoctorName = externalDoctor.trim() || undefined;
        body.toFacilityPhone = externalPhone.trim() || undefined;
      }

      const res = await fetch('/api/referrals', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create referral');
      }

      toast({ title: tr('تم إرسال التحويل بنجاح', 'Referral sent successfully') });

      // Optionally complete the visit after referral
      if (completeAfterReferral) {
        const flowRes = await fetch(`/api/opd/encounters/${encounterId}/flow-state`, {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ opdFlowState: 'COMPLETED', completionReason: 'REFERRAL' }),
        });
        if (!flowRes.ok) {
          const flowErr = await flowRes.json().catch(() => ({}));
          const msg = flowErr.messageEn || flowErr.message || flowErr.error || tr('فشل إنهاء الزيارة', 'Failed to complete visit');
          toast({ title: tr('لم تُنهَ الزيارة', 'Visit not completed'), description: msg, variant: 'destructive' as const });
        } else {
          await fetch(`/api/opd/encounters/${encounterId}/timestamps`, {
            credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ opdTimestamps: { doctorEndAt: new Date().toISOString() } }),
          });
          toast({ title: tr('تم إنهاء الزيارة وإرسال التحويل', 'Visit completed and referral sent') });
        }
      }

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      toast({
        title: tr('خطأ', 'Error'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive' as const,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  // When manual override is active, show all providers; otherwise show specialty-filtered
  const activePool = manualOverride
    ? manualProviders
    : (showAllProviders || recommendations.length === 0 ? allProviders : recommendations);

  const displayProviders = providerSearch.trim()
    ? activePool.filter((p) => {
        const q = providerSearch.toLowerCase();
        return (
          p.providerName.toLowerCase().includes(q) ||
          p.providerNameAr.toLowerCase().includes(q)
        );
      })
    : activePool;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-border">
        {/* ── Header ── */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <RefreshCw className="w-5 h-5" /> {tr('تحويل مريض', 'Patient Referral')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-xl thea-transition-fast text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 thea-scroll">
          {/* Patient Info */}
          <div className="bg-muted/50 rounded-xl px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {tr('المريض:', 'Patient:')}{' '}
              <strong className="text-foreground">{patientName}</strong>
            </p>
          </div>

          {/* ── Referral Type ── */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {tr('نوع التحويل', 'Referral Type')}
            </label>
            <div className="flex gap-2">
              {(
                [
                  {
                    value: 'internal' as ReferralType,
                    label: tr('داخلي', 'Internal'),
                    Icon: Building2,
                  },
                  {
                    value: 'external' as ReferralType,
                    label: tr('خارجي', 'External'),
                    Icon: Globe,
                  },
                  {
                    value: 'consultation' as ReferralType,
                    label: tr('استشارة', 'Consultation'),
                    Icon: MessageSquare,
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setReferralType(opt.value);
                    setSelectedProvider(null);
                  }}
                  className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium thea-transition-fast flex items-center justify-center gap-1.5 ${
                    referralType === opt.value
                      ? 'bg-emerald-600 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  <opt.Icon className="w-4 h-4" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Internal/Consultation: Specialty + Smart Recommendations ── */}
          {referralType !== 'external' && (
            <>
              {/* Specialty Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {tr('التخصص', 'Specialty')}
                </label>
                <select
                  value={specialtyCode}
                  onChange={(e) => {
                    setSpecialtyCode(e.target.value);
                    setSelectedProvider(null);
                    setShowAllProviders(false);
                  }}
                  className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-foreground
                              focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 thea-transition-fast"
                >
                  <option value="">
                    {tr('اختر التخصص...', 'Select specialty...')}
                  </option>
                  {specialties.map((s: Record<string, string>) => (
                    <option key={s.code || s.id} value={s.code || s.id}>
                      {language === 'ar'
                        ? s.nameAr || s.name
                        : s.name || s.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Provider Recommendations */}
              {specialtyCode && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />{' '}
                      {recommendations.length > 0
                        ? tr('الأطباء الموصى بهم', 'Recommended Providers')
                        : tr('اختر طبيباً', 'Select a Provider')}
                    </label>
                    {allProviders.length > recommendations.length && recommendations.length > 0 && (
                      <button
                        onClick={() => { setShowAllProviders(!showAllProviders); setProviderSearch(''); }}
                        className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                      >
                        {showAllProviders
                          ? tr('الموصى بهم فقط', 'Recommended only')
                          : tr(`عرض الكل (${allProviders.length})`, `Show all (${allProviders.length})`)}
                      </button>
                    )}
                  </div>

                  {/* Search box — show when there are providers OR manual override */}
                  {!loadingRecs && (activePool.length > 0 || manualOverride) && (
                    <input
                      type="text"
                      value={providerSearch}
                      onChange={(e) => setProviderSearch(e.target.value)}
                      placeholder={tr('ابحث عن طبيب...', 'Search provider...')}
                      className="w-full px-3 py-2 mb-3 border border-border rounded-xl bg-background text-sm
                                  focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 thea-transition-fast"
                    />
                  )}

                  {loadingRecs || (manualOverride && loadingAllProviders) ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <span className="inline-block w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
                      <br />
                      {tr('جاري البحث...', 'Searching...')}
                    </div>
                  ) : displayProviders.length > 0 ? (
                    <>
                      {manualOverride && (
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> {tr('يظهر كل الأطباء — ليس مقيداً بالقسم', 'Showing all providers — not filtered by specialty')}
                          </span>
                          <button
                            onClick={() => { setManualOverride(false); setProviderSearch(''); }}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            {tr('إلغاء', 'Cancel')}
                          </button>
                        </div>
                      )}
                      <div className="space-y-2 max-h-64 overflow-y-auto thea-scroll">
                        {displayProviders.map(
                          (provider: ProviderRecommendation, idx: number) => {
                            const isSelected = selectedProvider?.providerId === provider.providerId;
                            const isRecommended = !manualOverride && recommendations.some((r) => r.providerId === provider.providerId);
                            const MedalIcon = isRecommended
                              ? idx === 0 ? Trophy : idx === 1 ? Medal : idx === 2 ? Award : Star
                              : User;
                            const medalColor = isRecommended
                              ? idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-muted-foreground' : idx === 2 ? 'text-orange-600' : 'text-amber-400'
                              : 'text-muted-foreground';

                            return (
                              <button
                                key={provider.providerId}
                                type="button"
                                onClick={() => setSelectedProvider(provider)}
                                className={`w-full text-start p-4 rounded-xl border thea-transition-fast ${
                                  isSelected
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                    : 'border-border hover:border-emerald-300 dark:hover:border-emerald-700'
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2.5">
                                    <MedalIcon className={`w-5 h-5 ${medalColor}`} />
                                    <div>
                                      <p className="font-semibold text-foreground">
                                        {language === 'ar' ? provider.providerNameAr : provider.providerName}
                                      </p>
                                      {isRecommended && provider.recommendation.confidence !== 'LOW' && (
                                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                                          <Star className="w-3 h-3 shrink-0" />
                                          {language === 'ar'
                                            ? provider.recommendation.reason
                                            : provider.recommendation.reasonEn}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  {provider.score > 0 && (
                                    <span
                                      className={`text-sm font-bold ${
                                        provider.score >= 70
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : provider.score >= 40
                                          ? 'text-amber-600 dark:text-amber-400'
                                          : 'text-red-500'
                                      }`}
                                    >
                                      {provider.score}%
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                  <span className="inline-flex items-center gap-1"><BarChart3 className="w-3 h-3" /> {provider.stats.availableSlotsToday} {tr('متاح', 'available')}</span>
                                  <span className="inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {provider.stats.utilizationPct}% {tr('إشغال', 'utilization')}</span>
                                  {provider.isActiveNow && (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                                      <CircleDot className="w-3 h-3" /> {tr('شغال الآن', 'Active now')}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          }
                        )}
                      </div>
                    </>
                  ) : providerSearch ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      {tr('لا نتائج للبحث', 'No search results')}
                    </div>
                  ) : (
                    <div className="text-center py-6 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {tr('لا يوجد أطباء مرتبطون بهذا القسم', 'No providers linked to this specialty')}
                      </p>
                      {!manualOverride && (
                        <button
                          onClick={() => { setManualOverride(true); setProviderSearch(''); }}
                          className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted thea-transition-fast text-foreground inline-flex items-center gap-1.5"
                        >
                          <Search className="w-4 h-4" /> {tr('بحث في كل الأطباء', 'Search all providers')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── External Referral Fields ── */}
          {referralType === 'external' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {tr('اسم المنشأة', 'Facility Name')} *
                </label>
                <input
                  type="text"
                  value={externalFacility}
                  onChange={(e) => setExternalFacility(e.target.value)}
                  placeholder={tr(
                    'مستشفى / عيادة...',
                    'Hospital / Clinic...'
                  )}
                  className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-foreground
                              focus:ring-2 focus:ring-emerald-500 thea-transition-fast"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {tr('اسم الطبيب', 'Doctor Name')}
                  </label>
                  <input
                    type="text"
                    value={externalDoctor}
                    onChange={(e) => setExternalDoctor(e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-foreground
                                focus:ring-2 focus:ring-emerald-500 thea-transition-fast"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {tr('رقم الهاتف', 'Phone')}
                  </label>
                  <input
                    type="tel"
                    value={externalPhone}
                    onChange={(e) => setExternalPhone(e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-foreground
                                focus:ring-2 focus:ring-emerald-500 thea-transition-fast"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Reason & Summary ── */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {tr('سبب التحويل', 'Referral Reason')} *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={tr(
                'اشرح سبب التحويل...',
                'Explain the reason for referral...'
              )}
              className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-foreground
                          resize-none focus:ring-2 focus:ring-emerald-500 thea-transition-fast"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {tr('ملخص سريري', 'Clinical Summary')}
            </label>
            <textarea
              value={clinicalSummary}
              onChange={(e) => setClinicalSummary(e.target.value)}
              rows={2}
              placeholder={tr(
                'ملخص الحالة (اختياري)...',
                'Case summary (optional)...'
              )}
              className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-foreground
                          resize-none focus:ring-2 focus:ring-emerald-500 thea-transition-fast"
            />
          </div>

          {/* ── Priority ── */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {tr('الأولوية', 'Priority')}
            </label>
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  { value: 'routine' as Priority, label: tr('عادي', 'Routine'), active: 'bg-slate-600 text-white' },
                  { value: 'urgent' as Priority, label: tr('عاجل', 'Urgent'), active: 'bg-amber-500 text-white' },
                  { value: 'stat' as Priority, label: tr('طارئ', 'STAT'), active: 'bg-red-600 text-white' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPriority(opt.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium thea-transition-fast ${
                    priority === opt.value
                      ? opt.active
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-border space-y-3">

          {/* Transfer Billing toggle — only for internal referrals */}
          {referralType !== 'external' && (
            <div className={`rounded-xl border p-3 transition-colors ${
              transferBilling
                ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                : 'border-border bg-muted/30'
            }`}>
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={transferBilling}
                  onChange={(e) => setTransferBilling(e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-600 mt-0.5"
                />
                <div>
                  <span className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4" /> {tr('نقل الفاتورة للدكتور الجديد', 'Transfer billing to new doctor')}
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {transferBilling
                      ? tr(
                          'الكشفية تنتقل — المريض يدفع الفرق فقط إذا كان الدكتور الجديد استشاري',
                          'Invoice transfers — patient pays the difference only if new doctor is a consultant'
                        )
                      : tr(
                          'المريض يدفع كشفية جديدة عند الاستقبال للدكتور الجديد',
                          'Patient pays a new consultation fee at reception for the new doctor'
                        )}
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Complete visit checkbox */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={completeAfterReferral}
              onChange={(e) => setCompleteAfterReferral(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-600"
            />
            <span className="text-sm text-foreground inline-flex items-center gap-1.5">
              <Flag className="w-4 h-4" /> {tr('إنهاء زيارتي بعد إرسال التحويل', 'Complete my visit after sending referral')}
            </span>
          </label>
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-xl thea-transition-fast"
            >
              {tr('إلغاء', 'Cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !reason.trim()}
              className="px-6 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700
                          disabled:opacity-50 disabled:cursor-not-allowed font-semibold thea-transition-fast"
            >
              {saving
                ? tr('جاري الإرسال...', 'Sending...')
                : tr('إرسال التحويل', 'Send Referral')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SmartReferralDialog;
