'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useMe } from '@/lib/hooks/useMe';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { Button } from '@/components/ui/button';

interface ContinuityProps {
  params?: { episodeId?: string };
}

interface ActiveMed {
  orderId: string;
  drugName: string;
  dose?: string;
  route?: string;
  schedule?: string;
  type?: string;
}

interface OverdueOrder {
  orderId: string;
  drugName?: string;
  count: number;
}

interface MarEvent {
  id: string;
  performedAt: string;
  drugName: string;
  action: string;
  reason?: string;
}

interface CarePlan {
  id: string;
  problem: string;
  goals: string;
  status: string;
}

interface Order {
  id: string;
  kind?: string;
  title: string;
  status: string;
}

interface VitalsItem {
  critical?: boolean;
  vitals?: {
    systolic?: string | number;
    diastolic?: string | number;
    hr?: string | number;
    rr?: string | number;
    temp?: string | number;
    spo2?: string | number;
  };
}

interface ProgressItem {
  assessment?: string;
  responseToCarePlan?: string;
}

interface EpisodeResponse {
  episode?: Record<string, unknown>;
}

interface ListResponse<T> {
  items?: T[];
}

interface MedReconResponse {
  activeMeds?: ActiveMed[];
  pendingVerification?: ActiveMed[];
  overdueSnapshot?: { overdueDoseCount: number; overdueOrders: OverdueOrder[] };
}

interface MarResponse {
  history?: MarEvent[];
}

interface CachedSnapshot {
  episodeData?: EpisodeResponse;
  ordersData?: ListResponse<Order>;
  vitalsData?: ListResponse<Record<string, unknown>>;
  carePlansData?: ListResponse<CarePlan>;
  doctorProgressData?: ListResponse<Record<string, unknown>>;
  nursingProgressData?: ListResponse<Record<string, unknown>>;
  medReconData?: MedReconResponse;
  marData?: MarResponse;
  updatedAt?: string;
}

export default function Continuity(props: ContinuityProps) {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { me } = useMe();
  const { hasPermission, isLoading } = useRoutePermission('/ipd/episode');

  const tenantId = String(me?.tenantId || '');
  const email = String(me?.user?.email || '');
  const role = String(me?.user?.role || '');
  const canAccess = canAccessChargeConsole({ email, tenantId, role });
  const roleLower = role.toLowerCase();
  const isDoctor = roleLower.includes('doctor') || roleLower.includes('physician');
  const isNurse = roleLower.includes('nurse') || roleLower.includes('nursing');
  const isPharmacy = roleLower.includes('pharmacy');

  const episodeId = String(props?.params?.episodeId || '').trim();
  const [isOnline, setIsOnline] = useState(true);
  const [hasFetchError, setHasFetchError] = useState(false);
  const [cachedSnapshot, setCachedSnapshot] = useState<CachedSnapshot | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      setHasFetchError(false);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const offlineMode = !isOnline || hasFetchError;
  const cacheKey = tenantId && episodeId ? `ipd-episode-snapshot:${tenantId}:${episodeId}` : '';

  useEffect(() => {
    if (!cacheKey || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (raw) setCachedSnapshot(JSON.parse(raw));
    } catch {
      setCachedSnapshot(null);
    }
  }, [cacheKey]);

  const updateCache = (key: string, value: unknown) => {
    if (!cacheKey || typeof window === 'undefined') return;
    setCachedSnapshot((prev) => {
      const next: CachedSnapshot = {
        ...(prev || {}),
        [key]: value,
        updatedAt: new Date().toISOString(),
      };
      try {
        window.localStorage.setItem(cacheKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const fetcher = async (url: string) => {
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        const error = Object.assign(new Error(`Request failed (${res.status})`), { status: res.status });
        throw error;
      }
      return await res.json();
    } catch (err: unknown) {
      if (!(err instanceof Error && 'status' in err)) setHasFetchError(true);
      throw err;
    }
  };

  const canFetchEpisode = hasPermission && episodeId && !offlineMode;
  const { data, isLoading: loading } = useSWR(
    canFetchEpisode ? `/api/ipd/episodes/${episodeId}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const canFetchEpisodeDetails = canFetchEpisode && Boolean((data as EpisodeResponse | undefined)?.episode);
  const { data: ordersData } = useSWR(
    canFetchEpisodeDetails && (canAccess || isDoctor) ? `/api/ipd/episodes/${episodeId}/orders` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: vitalsData } = useSWR(
    canFetchEpisodeDetails && (canAccess || isNurse) ? `/api/ipd/episodes/${episodeId}/vitals` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: carePlansData } = useSWR(
    canFetchEpisodeDetails && (canAccess || isDoctor) ? `/api/ipd/episodes/${episodeId}/care-plans` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: doctorProgressData } = useSWR(
    canFetchEpisodeDetails && (canAccess || isDoctor) ? `/api/ipd/episodes/${episodeId}/doctor-progress` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: nursingProgressData } = useSWR(
    canFetchEpisodeDetails && (canAccess || isNurse) ? `/api/ipd/episodes/${episodeId}/nursing-progress` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: medReconData } = useSWR(
    canFetchEpisodeDetails && (canAccess || isDoctor || isNurse || isPharmacy)
      ? `/api/ipd/episodes/${episodeId}/med-recon`
      : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: marData } = useSWR(
    canFetchEpisodeDetails && (canAccess || isNurse) ? `/api/ipd/episodes/${episodeId}/mar` : null,
    fetcher,
    { refreshInterval: 0 }
  );

  useEffect(() => {
    if (!offlineMode && data) updateCache('episodeData', data);
  }, [offlineMode, data]);
  useEffect(() => {
    if (!offlineMode && ordersData) updateCache('ordersData', ordersData);
  }, [offlineMode, ordersData]);
  useEffect(() => {
    if (!offlineMode && vitalsData) updateCache('vitalsData', vitalsData);
  }, [offlineMode, vitalsData]);
  useEffect(() => {
    if (!offlineMode && carePlansData) updateCache('carePlansData', carePlansData);
  }, [offlineMode, carePlansData]);
  useEffect(() => {
    if (!offlineMode && doctorProgressData) updateCache('doctorProgressData', doctorProgressData);
  }, [offlineMode, doctorProgressData]);
  useEffect(() => {
    if (!offlineMode && nursingProgressData) updateCache('nursingProgressData', nursingProgressData);
  }, [offlineMode, nursingProgressData]);
  useEffect(() => {
    if (!offlineMode && medReconData) updateCache('medReconData', medReconData);
  }, [offlineMode, medReconData]);
  useEffect(() => {
    if (!offlineMode && marData) updateCache('marData', marData);
  }, [offlineMode, marData]);

  const episodeData = offlineMode && cachedSnapshot?.episodeData ? cachedSnapshot.episodeData : data;
  const effectiveOrdersData = offlineMode && cachedSnapshot?.ordersData ? cachedSnapshot.ordersData : ordersData;
  const effectiveVitalsData = offlineMode && cachedSnapshot?.vitalsData ? cachedSnapshot.vitalsData : vitalsData;
  const effectiveCarePlansData =
    offlineMode && cachedSnapshot?.carePlansData ? cachedSnapshot.carePlansData : carePlansData;
  const effectiveDoctorProgressData =
    offlineMode && cachedSnapshot?.doctorProgressData ? cachedSnapshot.doctorProgressData : doctorProgressData;
  const effectiveNursingProgressData =
    offlineMode && cachedSnapshot?.nursingProgressData ? cachedSnapshot.nursingProgressData : nursingProgressData;
  const effectiveMedReconData =
    offlineMode && cachedSnapshot?.medReconData ? cachedSnapshot.medReconData : medReconData;
  const effectiveMarData = offlineMode && cachedSnapshot?.marData ? cachedSnapshot.marData : marData;

  const episodeResponse = episodeData as EpisodeResponse | undefined;
  const episode = episodeResponse?.episode || null;
  const ep = episode as Record<string, unknown> | null;
  const patient = (ep?.patient || {}) as Record<string, string>;
  const ownership = (ep?.ownership || {}) as Record<string, string>;
  const locationObj = (ep?.location || {}) as Record<string, string>;

  const medRecon = effectiveMedReconData as MedReconResponse | undefined;
  const activeMeds: ActiveMed[] = Array.isArray(medRecon?.activeMeds) ? medRecon.activeMeds : [];
  const pendingVerification: ActiveMed[] = Array.isArray(medRecon?.pendingVerification) ? medRecon.pendingVerification : [];
  const reconOverdue = medRecon?.overdueSnapshot || { overdueDoseCount: 0, overdueOrders: [] as OverdueOrder[] };

  const vitalsResponse = effectiveVitalsData as ListResponse<VitalsItem> | undefined;
  const vitalsItems = Array.isArray(vitalsResponse?.items) ? vitalsResponse.items : [];
  const latestVitals = vitalsItems[0] || null;

  const carePlansResponse = effectiveCarePlansData as ListResponse<CarePlan> | undefined;
  const carePlans = Array.isArray(carePlansResponse?.items) ? carePlansResponse.items : [];
  const activeCarePlans = carePlans.filter((p) => p.status === 'ACTIVE');

  const doctorResponse = effectiveDoctorProgressData as ListResponse<ProgressItem> | undefined;
  const nursingResponse = effectiveNursingProgressData as ListResponse<ProgressItem> | undefined;
  const doctorProgressItems = Array.isArray(doctorResponse?.items) ? doctorResponse.items : [];
  const nursingProgressItems = Array.isArray(nursingResponse?.items) ? nursingResponse.items : [];
  const latestDoctorProgress = doctorProgressItems[0] || null;
  const latestNursingProgress = nursingProgressItems[0] || null;

  const ordersResponse = effectiveOrdersData as ListResponse<Order> | undefined;
  const orders = Array.isArray(ordersResponse?.items) ? ordersResponse.items : [];
  const activeOrders = orders.filter((o) => o.status !== 'DONE' && o.status !== 'CANCELLED');

  const marResponse = effectiveMarData as MarResponse | undefined;
  const marHistory = Array.isArray(marResponse?.history) ? marResponse.history : [];
  const lastMarEvents = marHistory.slice(0, 5);

  const generatedAt = useMemo(() => new Date(), [episodeId, offlineMode, cachedSnapshot?.updatedAt]);
  const episodeIdShort = episodeId ? episodeId.slice(0, 8) : '—';
  const locationSummary = [locationObj?.ward, locationObj?.room, locationObj?.bed].filter(Boolean).join(' / ') || '—';
  const attending = String(ownership?.attendingPhysicianUserId || '').trim();
  const primaryNurse = String(ownership?.primaryInpatientNurseUserId || '').trim();

  if (isLoading || loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
        {tr('جاري التحميل...', 'Loading...')}
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="p-6 text-sm text-muted-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
        {tr('محظور', 'Forbidden')}
      </div>
    );
  }

  if (!episode && !cachedSnapshot) {
    return (
      <div className="p-6 text-sm text-muted-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
        {tr('غير موجود', 'Not found')}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 print:p-0" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between print:hidden">
        <div className="text-sm text-muted-foreground">
          {tr('حزمة الاستمرارية', 'Continuity Pack')}
        </div>
        <Button className="rounded-xl" onClick={() => window.print()} variant="outline">
          {tr('طباعة', 'Print')}
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        {tr('تم الإنشاء في', 'Generated at')} {generatedAt.toLocaleString()} • {offlineMode ? tr('لقطة بلا اتصال', 'Offline snapshot') : tr('بيانات مباشرة', 'Live data')}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{tr('المريض والحلقة', 'Patient & Episode')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">{tr('المريض:', 'Patient:')}</span> {patient.fullName || '—'}
          </div>
          <div>
            <span className="text-muted-foreground">{tr('الحلقة:', 'Episode:')}</span> {episodeIdShort}
          </div>
          <div>
            <span className="text-muted-foreground">{tr('الموقع:', 'Location:')}</span> {locationSummary}
          </div>
          <div>
            <span className="text-muted-foreground">{tr('الطبيب المعالج:', 'Attending:')}</span> {attending || '—'}
          </div>
          <div>
            <span className="text-muted-foreground">{tr('الممرضة الرئيسية:', 'Primary Nurse:')}</span> {primaryNurse || '—'}
          </div>
          <div>
            <span className="text-muted-foreground">{tr('رقم الملف:', 'MRN:')}</span> {patient.mrn || '—'} / {tr('مؤقت', 'Temp')} {patient.tempMrn || '—'}
          </div>
        </div>
      </section>

      <section className="space-y-2 print-break">
        <h2 className="text-sm font-semibold">{tr('لقطة الأدوية', 'Medication Snapshot')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="font-medium">{tr('الأدوية الفعالة', 'Active Meds')}</div>
            {activeMeds.length ? (
              <ul className="list-disc pl-4">
                {activeMeds.map((m: ActiveMed) => (
                  <li key={m.orderId}>
                    {m.drugName} — {m.dose || '—'} {m.route || ''} {m.schedule || m.type || ''}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-muted-foreground">{tr('لا يوجد', 'None')}</div>
            )}
          </div>
          <div>
            <div className="font-medium">{tr('بانتظار التحقق', 'Pending Verification')}</div>
            {pendingVerification.length ? (
              <ul className="list-disc pl-4">
                {pendingVerification.map((m: ActiveMed) => (
                  <li key={m.orderId}>
                    {m.drugName} — {m.dose || '—'} {m.route || ''} {m.schedule || m.type || ''}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-muted-foreground">{tr('لا يوجد', 'None')}</div>
            )}
          </div>
        </div>

        <div className="text-sm">
          <div className="font-medium">{tr('لقطة التأخر', 'Overdue Snapshot')}</div>
          <div>
            {tr('إجمالي الجرعات المتأخرة:', 'Total overdue doses:')} <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{reconOverdue.overdueDoseCount || 0}</span>
          </div>
          {Array.isArray(reconOverdue.overdueOrders) && reconOverdue.overdueOrders.length ? (
            <ul className="list-disc pl-4">
              {reconOverdue.overdueOrders.map((o: OverdueOrder) => (
                <li key={o.orderId}>{o.drugName || '—'} — {o.count}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="text-sm">
          <div className="font-medium">{tr('آخر أحداث MAR', 'Last MAR Events')}</div>
          {lastMarEvents.length ? (
            <ul className="list-disc pl-4">
              {lastMarEvents.map((m: MarEvent) => (
                <li key={m.id}>
                  {new Date(m.performedAt).toLocaleString()} — {m.drugName} {m.action}
                  {m.reason ? ` (${m.reason})` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-muted-foreground">{tr('لا يوجد', 'None')}</div>
          )}
        </div>
      </section>

      <section className="space-y-2 print-break">
        <h2 className="text-sm font-semibold">{tr('أحدث العلامات الحيوية', 'Latest Vitals')}</h2>
        {latestVitals?.critical ? (
          <div className="text-sm text-destructive">{tr('علامات حيوية حرجة — قم بالتصعيد', 'Critical vitals — escalate')}</div>
        ) : null}
        {latestVitals ? (
          <div className="text-sm">
            BP {latestVitals?.vitals?.systolic ?? '—'}/{latestVitals?.vitals?.diastolic ?? '—'} • HR {latestVitals?.vitals?.hr ?? '—'} • RR {latestVitals?.vitals?.rr ?? '—'} • Temp {latestVitals?.vitals?.temp ?? '—'} • SpO2 {latestVitals?.vitals?.spo2 ?? '—'}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">{tr('لم يتم تسجيل علامات حيوية.', 'No vitals recorded.')}</div>
        )}
      </section>

      <section className="space-y-2 print-break">
        <h2 className="text-sm font-semibold">{tr('خطط الرعاية الفعالة', 'Active Care Plans')}</h2>
        {activeCarePlans.length ? (
          <ul className="list-disc pl-4 text-sm">
            {activeCarePlans.map((p: CarePlan) => (
              <li key={p.id}>
                {p.problem} — {p.goals}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-muted-foreground">{tr('لا توجد خطط رعاية فعالة.', 'No active care plans.')}</div>
        )}
      </section>

      <section className="space-y-2 print-break">
        <h2 className="text-sm font-semibold">{tr('أحدث التقدم', 'Latest Progress')}</h2>
        <div className="text-sm space-y-2">
          <div>
            <div className="font-medium">{tr('الطبيب', 'Doctor')}</div>
            {latestDoctorProgress ? (
              <div className="whitespace-pre-wrap">
                {latestDoctorProgress.assessment || '—'}
              </div>
            ) : (
              <div className="text-muted-foreground">{tr('لا يوجد', 'None')}</div>
            )}
          </div>
          <div>
            <div className="font-medium">{tr('التمريض', 'Nursing')}</div>
            {latestNursingProgress ? (
              <div className="whitespace-pre-wrap">
                {latestNursingProgress.responseToCarePlan || '—'}
              </div>
            ) : (
              <div className="text-muted-foreground">{tr('لا يوجد', 'None')}</div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-2 print-break">
        <h2 className="text-sm font-semibold">{tr('الأوامر غير الدوائية الفعالة', 'Active Non-Med Orders')}</h2>
        {activeOrders.length ? (
          <ul className="list-disc pl-4 text-sm">
            {activeOrders.map((o: Order) => (
              <li key={o.id}>
                {String(o.kind || '').toUpperCase()} — {o.title} ({o.status})
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-muted-foreground">{tr('لا توجد أوامر فعالة.', 'No active orders.')}</div>
        )}
      </section>

      <style jsx global>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          .print-break {
            break-before: page;
            page-break-before: always;
          }
          body {
            background: white;
          }
        }
      `}</style>
    </div>
  );
}
