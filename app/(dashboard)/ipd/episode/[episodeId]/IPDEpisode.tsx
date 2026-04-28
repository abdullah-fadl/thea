'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useMe } from '@/lib/hooks/useMe';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrderSetsPanel } from '@/components/orders/OrderSetsPanel';
import { TasksPanel } from '@/components/tasks/TasksPanel';
import { HandoverPanel } from '@/components/handover/HandoverPanel';
import { MedReconciliation } from '@/components/clinical/MedReconciliation';
import type { HomeMedication } from '@/components/clinical/HomeMedications';
import type {
  IPDEpisode as IPDEpisodeType,
  IPDEpisodeResponse,
  IPDItemsResponse,
  IPDMarResponse,
  IPDMedCatalogItem,
  IPDMedReconRecord,
  IPDCachedSnapshot,
  IPDPatient,
} from '@/lib/cvision/types';

const DISPOSITION_OPTIONS = ['HOME', 'AMA', 'LAMA', 'TRANSFER_OUT', 'DEATH_PENDING'] as const;
const DEATH_PLACES = ['ER', 'IPD', 'OPD', 'OTHER'] as const;

export default function IPDEpisode(props: any) {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
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
  const [cachedSnapshot, setCachedSnapshot] = useState<IPDCachedSnapshot | null>(null);
  const [dischargeOpen, setDischargeOpen] = useState(false);
  const [dischargeDisposition, setDischargeDisposition] = useState<(typeof DISPOSITION_OPTIONS)[number]>('HOME');
  const [dischargeSummaryText, setDischargeSummaryText] = useState('');
  const [dischargeBusy, setDischargeBusy] = useState(false);
  const [deathDeclareOpen, setDeathDeclareOpen] = useState(false);
  const [deathFinalizeOpen, setDeathFinalizeOpen] = useState(false);
  const [deathDateTime, setDeathDateTime] = useState('');
  const [deathPlace, setDeathPlace] = useState<(typeof DEATH_PLACES)[number]>('IPD');
  const [deathCause, setDeathCause] = useState('');
  const [deathNotes, setDeathNotes] = useState('');
  const [deathBusy, setDeathBusy] = useState(false);
  const [clinicalOpen, setClinicalOpen] = useState(false);
  const [clinicalTitle, setClinicalTitle] = useState('');
  const [clinicalContent, setClinicalContent] = useState('');
  const [clinicalBusy, setClinicalBusy] = useState(false);
  const [medCatalogSearch, setMedCatalogSearch] = useState('');
  const [medCatalogId, setMedCatalogId] = useState('');
  const [savingAdmissionRec, setSavingAdmissionRec] = useState(false);

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
    setCachedSnapshot((prev: IPDCachedSnapshot | null) => {
      const next = {
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

  const finalizeDischarge = async () => {
    if (!handoverFinalized) {
      toast({
        title: tr('مطلوب تسليم المناوبة', 'Handover required'),
        description: tr('أكمل تسليم المناوبة قبل الخروج.', 'Finalize handover before discharge.'),
        variant: 'destructive' as const,
      });
      return;
    }
    if (!encounterCoreId) return;
    setDischargeBusy(true);
    try {
      const res = await fetch('/api/discharge/finalize', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterCoreId,
          disposition: dischargeDisposition,
          summaryText: dischargeSummaryText,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed');
      toast({ title: payload.noOp ? tr('لا يوجد تغيير', 'No change') : tr('تم إنهاء الخروج', 'Discharge finalized') });
      setDischargeOpen(false);
      setDischargeSummaryText('');
      await mutateDischarge();
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setDischargeBusy(false);
    }
  };

  const declareDeath = async () => {
    if (!encounterCoreId) return;
    setDeathBusy(true);
    try {
      const res = await fetch('/api/death/declare', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterCoreId,
          deathDateTime,
          placeOfDeath: deathPlace,
          preliminaryCause: deathCause,
          notes: deathNotes,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed');
      toast({ title: payload.noOp ? tr('لا يوجد تغيير', 'No change') : tr('تم إعلان الوفاة', 'Death declared') });
      setDeathDeclareOpen(false);
      await mutateDeathStatus();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setDeathBusy(false);
    }
  };

  const finalizeDeath = async () => {
    if (!encounterCoreId) return;
    setDeathBusy(true);
    try {
      const res = await fetch('/api/death/finalize', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterCoreId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed');
      toast({ title: payload.noOp ? tr('لا يوجد تغيير', 'No change') : tr('تم اعتماد الوفاة', 'Death finalized') });
      setDeathFinalizeOpen(false);
      await mutateDeathStatus();
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setDeathBusy(false);
    }
  };

  const addClinicalNote = async () => {
    if (!encounterCoreId) return;
    const patientMasterId = patient?.patientMasterId || patient?.id;
    if (!patientMasterId) return;
    setClinicalBusy(true);
    try {
      const res = await fetch('/api/clinical-notes', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientMasterId,
          encounterCoreId,
          area: 'IPD',
          noteType: isNurse ? 'NURSING_NOTE' : 'IPD_DAILY',
          title: clinicalTitle || undefined,
          content: clinicalContent,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed');
      toast({ title: payload.noOp ? tr('لا يوجد تغيير', 'No change') : tr('تمت إضافة الملاحظة', 'Note added') });
      setClinicalTitle('');
      setClinicalContent('');
      setClinicalOpen(false);
      await mutateClinicalNotes();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setClinicalBusy(false);
    }
  };

  const fetcher = async (url: string) => {
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        const error: any = new Error(`Request failed (${res.status})`);
        error.status = res.status;
        throw error;
      }
      return await res.json();
    } catch (err: any) {
      if (!err?.status) setHasFetchError(true);
      throw err;
    }
  };
  const todayStr = new Date().toISOString().slice(0, 10);

  const NoteOrdersList = ({ noteId }: { noteId: string }) => {
    const { data } = useSWR<IPDItemsResponse>(noteId ? `/api/clinical-notes/${encodeURIComponent(noteId)}/orders` : null, fetcher, {
      refreshInterval: 0,
    });
    const items = Array.isArray(data?.items) ? data.items : [];
    if (!items.length) {
      return <div className="text-xs text-muted-foreground">{tr('لا توجد طلبات مرتبطة.', 'No orders linked.')}</div>;
    }
    return (
      <div className="space-y-1 text-xs">
        {items.map((item: any) => (
          <div key={item.orderId} className="flex items-center justify-between">
            <span>
              {item.kind || 'ORDER'} • {item.orderName || item.orderCode || String(item.orderId || '').slice(0, 8)}
            </span>
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{item.status || '—'}</span>
          </div>
        ))}
      </div>
    );
  };
  const AttachmentsList = ({ entityType, entityId }: { entityType: string; entityId: string }) => {
    const { data } = useSWR<IPDItemsResponse>(
      entityId ? `/api/attachments?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}` : null,
      fetcher,
      { refreshInterval: 0 }
    );
    const items = Array.isArray(data?.items) ? data.items : [];
    if (!items.length) {
      return <div className="text-xs text-muted-foreground">{tr('لا توجد مرفقات.', 'No attachments.')}</div>;
    }
    return (
      <div className="space-y-1 text-xs">
        {items.map((item: any) => (
          <div key={item.id} className="flex items-center justify-between">
            <span>{item.fileName}</span>
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{item.mimeType}</span>
          </div>
        ))}
      </div>
    );
  };
  const OrderResultsList = ({ orderId, canAck }: { orderId: string; canAck: boolean }) => {
    const { data, mutate } = useSWR<IPDItemsResponse>(orderId ? `/api/orders/${encodeURIComponent(orderId)}/results` : null, fetcher, {
      refreshInterval: 0,
    });
    const items = Array.isArray(data?.items) ? data.items : [];
    const ackResult = async (resultId: string) => {
      if (!canAck) return;
      try {
        const key =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
        const res = await fetch(`/api/results/${encodeURIComponent(resultId)}/ack`, {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idempotencyKey: key }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || 'Failed');
        toast({ title: payload.noOp ? tr('تم التأكيد مسبقاً', 'Already acknowledged') : tr('تم التأكيد', 'Acknowledged') });
        await mutate();
      } catch (err: any) {
        toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
      }
    };
    if (!items.length) {
      return <div className="text-sm text-muted-foreground">{tr('لا توجد نتائج بعد.', 'No results yet.')}</div>;
    }
    return (
      <div className="space-y-2">
        {items.map((result: any) => (
          <div key={result.id} className="rounded-md border p-2 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{result.summary || result.resultType || tr('نتيجة', 'Result')}</div>
                <div className="text-xs text-muted-foreground">
                  {result.createdAt ? new Date(result.createdAt).toLocaleString() : '—'} • {result.resultType || '—'} •{' '}
                  {result.status || '—'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{result.acksCount || 0} {tr('تأكيد', 'ACK')}</span>
                {canAck ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    disabled={result.ackedByMe}
                    onClick={() => ackResult(result.id)}
                  >
                    {result.ackedByMe ? tr('تم التأكيد', 'Acknowledged') : tr('تأكيد', 'Acknowledge')}
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="rounded-md border bg-muted/30 p-2">
              <div className="text-xs font-medium mb-1">{tr('المرفقات', 'Attachments')}</div>
              <AttachmentsList entityType="order_result" entityId={result.id} />
            </div>
          </div>
        ))}
      </div>
    );
  };
  const canFetchEpisode = hasPermission && episodeId && !offlineMode;
  const { data, isLoading: loading, mutate } = useSWR(
    canFetchEpisode ? `/api/ipd/episodes/${episodeId}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const canFetchEpisodeDetails = canFetchEpisode && Boolean((data as IPDEpisodeResponse | undefined)?.episode);
  const encounterCoreId = String((data as IPDEpisodeResponse | undefined)?.episode?.encounterId || '').trim();
  const typedData = data as IPDEpisodeResponse | undefined;
  const patientMasterId = String(
    typedData?.episode?.patient?.patientMasterId || typedData?.episode?.patient?.id || ''
  ).trim();
  const { data: homeMedsData } = useSWR(
    canFetchEpisodeDetails && patientMasterId
      ? `/api/clinical/home-medications/${encodeURIComponent(patientMasterId)}`
      : null,
    fetcher,
    { refreshInterval: 0 }
  );

  const { data: clinicalNotesData, mutate: mutateClinicalNotes } = useSWR(
    hasPermission && encounterCoreId ? `/api/clinical-notes?encounterCoreId=${encodeURIComponent(encounterCoreId)}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const clinicalNotes = Array.isArray((clinicalNotesData as IPDItemsResponse | undefined)?.items) ? (clinicalNotesData as IPDItemsResponse | undefined).items : [];
  const { data: ordersHubData } = useSWR(
    hasPermission && encounterCoreId ? `/api/orders?encounterCoreId=${encodeURIComponent(encounterCoreId)}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: todayResultsData } = useSWR(
    canFetchEpisodeDetails && encounterCoreId
      ? `/api/results/inbox?scope=encounter&unacked=0&encounterCoreId=${encodeURIComponent(encounterCoreId)}&date=${encodeURIComponent(todayStr)}`
      : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: tasksQueueData } = useSWR(
    canFetchEpisodeDetails && encounterCoreId ? '/api/tasks/queue?area=IPD' : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const ordersHub = Array.isArray((ordersHubData as IPDItemsResponse | undefined)?.items) ? (ordersHubData as IPDItemsResponse | undefined).items : [];
  const { data: dischargeData, mutate: mutateDischarge } = useSWR(
    canFetchEpisodeDetails && encounterCoreId
      ? `/api/discharge/finalize?encounterCoreId=${encodeURIComponent(encounterCoreId)}`
      : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: deathStatusData, mutate: mutateDeathStatus } = useSWR(
    canFetchEpisodeDetails && encounterCoreId
      ? `/api/death/status?encounterCoreId=${encodeURIComponent(encounterCoreId)}`
      : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: usersData } = useSWR(
    hasPermission && canAccess && !offlineMode ? '/api/ipd/users' : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: bedsData } = useSWR(
    canFetchEpisodeDetails && (canAccess || isNurse) ? '/api/ipd/beds/available' : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: handoverData } = useSWR(
    canFetchEpisodeDetails && encounterCoreId
      ? `/api/handover/by-encounter?encounterCoreId=${encodeURIComponent(encounterCoreId)}`
      : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: ordersData, mutate: mutateOrders } = useSWR(
    canFetchEpisodeDetails && (canAccess || isDoctor) ? `/api/ipd/episodes/${episodeId}/orders` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: vitalsData, mutate: mutateVitals } = useSWR(
    canFetchEpisodeDetails && (canAccess || isNurse) ? `/api/ipd/episodes/${episodeId}/vitals` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: connectVitalsData } = useSWR(
    canFetchEpisodeDetails ? `/api/connect/vitals?episodeId=${encodeURIComponent(episodeId)}&area=IPD` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: notesData, mutate: mutateNotes } = useSWR(
    canFetchEpisodeDetails && (canAccess || isNurse) ? `/api/ipd/episodes/${episodeId}/nursing-notes` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: assessmentsData, mutate: mutateAssessments } = useSWR(
    canFetchEpisodeDetails && (canAccess || isNurse) ? `/api/ipd/episodes/${episodeId}/nursing-assessments` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: medOrdersData, mutate: mutateMedOrders } = useSWR(
    canFetchEpisodeDetails && (canAccess || isDoctor || isPharmacy)
      ? `/api/ipd/episodes/${episodeId}/med-orders`
      : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const medCatalogQuery = medCatalogSearch.trim() ? `?search=${encodeURIComponent(medCatalogSearch.trim())}` : '';
  const { data: medCatalogData } = useSWR(
    canFetchEpisodeDetails && (canAccess || isDoctor || isPharmacy)
      ? `/api/billing/medication-catalog${medCatalogQuery}`
      : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const medCatalogItems = Array.isArray((medCatalogData as IPDItemsResponse<IPDMedCatalogItem> | undefined)?.items) ? (medCatalogData as IPDItemsResponse<IPDMedCatalogItem> | undefined).items : [];
  const selectedMed = useMemo(
    () => medCatalogItems.find((m: any) => String(m.id) === String(medCatalogId)) || null,
    [medCatalogItems, medCatalogId]
  );
  const allowedMedRoutes = useMemo(() => {
    const routes = Array.isArray((selectedMed as IPDMedCatalogItem | null)?.routes)
      ? (selectedMed as IPDMedCatalogItem).routes!.map((r) => String(r || '').toUpperCase())
      : [];
    return routes.length ? routes : ['PO', 'IV', 'IM', 'SC'];
  }, [selectedMed]);
  const { data: pharmacyQueueData, mutate: mutatePharmacyQueue } = useSWR(
    canFetchEpisodeDetails && (canAccess || isPharmacy) ? `/api/ipd/episodes/${episodeId}/pharmacy-queue` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: carePlansData, mutate: mutateCarePlans } = useSWR(
    canFetchEpisodeDetails && (canAccess || isDoctor) ? `/api/ipd/episodes/${episodeId}/care-plans` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: doctorProgressData, mutate: mutateDoctorProgress } = useSWR(
    canFetchEpisodeDetails && (canAccess || isDoctor) ? `/api/ipd/episodes/${episodeId}/doctor-progress` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: nursingProgressData, mutate: mutateNursingProgress } = useSWR(
    canFetchEpisodeDetails && (canAccess || isNurse) ? `/api/ipd/episodes/${episodeId}/nursing-progress` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: marData, mutate: mutateMar } = useSWR(
    canFetchEpisodeDetails && (canAccess || isNurse) ? `/api/ipd/episodes/${episodeId}/mar` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: narcoticCountData, mutate: mutateNarcoticCount } = useSWR(
    canFetchEpisodeDetails && (canAccess || isNurse) ? `/api/ipd/episodes/${episodeId}/narcotic-count` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: medTimelineData } = useSWR(
    canFetchEpisodeDetails && (canAccess || isDoctor || isNurse || isPharmacy)
      ? `/api/ipd/episodes/${episodeId}/med-timeline`
      : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: medReconData, mutate: mutateMedRecon } = useSWR(
    canFetchEpisodeDetails && (canAccess || isDoctor || isNurse || isPharmacy)
      ? `/api/clinical/med-reconciliation/${encodeURIComponent(encounterCoreId)}`
      : null,
    fetcher,
    { refreshInterval: 0 }
  );
  useEffect(() => {
    if (!offlineMode && data) updateCache('episodeData', data);
  }, [offlineMode, data]);
  useEffect(() => {
    if (!offlineMode && usersData) updateCache('usersData', usersData);
  }, [offlineMode, usersData]);
  useEffect(() => {
    if (!offlineMode && ordersData) updateCache('ordersData', ordersData);
  }, [offlineMode, ordersData]);
  useEffect(() => {
    if (!offlineMode && vitalsData) updateCache('vitalsData', vitalsData);
  }, [offlineMode, vitalsData]);
  useEffect(() => {
    if (!offlineMode && connectVitalsData) updateCache('connectVitalsData', connectVitalsData);
  }, [offlineMode, connectVitalsData]);
  useEffect(() => {
    if (!offlineMode && notesData) updateCache('notesData', notesData);
  }, [offlineMode, notesData]);
  useEffect(() => {
    if (!offlineMode && assessmentsData) updateCache('assessmentsData', assessmentsData);
  }, [offlineMode, assessmentsData]);
  useEffect(() => {
    if (!offlineMode && todayResultsData) updateCache('todayResultsData', todayResultsData);
  }, [offlineMode, todayResultsData]);
  useEffect(() => {
    if (!offlineMode && tasksQueueData) updateCache('tasksQueueData', tasksQueueData);
  }, [offlineMode, tasksQueueData]);
  useEffect(() => {
    if (!offlineMode && medOrdersData) updateCache('medOrdersData', medOrdersData);
  }, [offlineMode, medOrdersData]);
  useEffect(() => {
    if (!offlineMode && pharmacyQueueData) updateCache('pharmacyQueueData', pharmacyQueueData);
  }, [offlineMode, pharmacyQueueData]);
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
    if (!offlineMode && marData) updateCache('marData', marData);
  }, [offlineMode, marData]);
  useEffect(() => {
    if (!offlineMode && narcoticCountData) updateCache('narcoticCountData', narcoticCountData);
  }, [offlineMode, narcoticCountData]);
  useEffect(() => {
    if (!offlineMode && medTimelineData) updateCache('medTimelineData', medTimelineData);
  }, [offlineMode, medTimelineData]);
  useEffect(() => {
    if (!offlineMode && homeMedsData) updateCache('homeMedsData', homeMedsData);
  }, [offlineMode, homeMedsData]);
  useEffect(() => {
    if (!offlineMode && medReconData) updateCache('medReconData', medReconData);
  }, [offlineMode, medReconData]);

  const episodeData = offlineMode && cachedSnapshot?.episodeData ? cachedSnapshot.episodeData : data;
  const effectiveUsersData = offlineMode && cachedSnapshot?.usersData ? cachedSnapshot.usersData : usersData;
  const effectiveOrdersData = offlineMode && cachedSnapshot?.ordersData ? cachedSnapshot.ordersData : ordersData;
  const effectiveVitalsData = offlineMode && cachedSnapshot?.vitalsData ? cachedSnapshot.vitalsData : vitalsData;
  const effectiveConnectVitalsData =
    offlineMode && cachedSnapshot?.connectVitalsData ? cachedSnapshot.connectVitalsData : connectVitalsData;
  const effectiveNotesData = offlineMode && cachedSnapshot?.notesData ? cachedSnapshot.notesData : notesData;
  const effectiveAssessmentsData =
    offlineMode && cachedSnapshot?.assessmentsData ? cachedSnapshot.assessmentsData : assessmentsData;
  const effectiveTodayResultsData =
    offlineMode && cachedSnapshot?.todayResultsData ? cachedSnapshot.todayResultsData : todayResultsData;
  const effectiveTasksQueueData =
    offlineMode && cachedSnapshot?.tasksQueueData ? cachedSnapshot.tasksQueueData : tasksQueueData;
  const effectiveMedOrdersData = offlineMode && cachedSnapshot?.medOrdersData ? cachedSnapshot.medOrdersData : medOrdersData;
  const effectivePharmacyQueueData =
    offlineMode && cachedSnapshot?.pharmacyQueueData ? cachedSnapshot.pharmacyQueueData : pharmacyQueueData;
  const effectiveCarePlansData = offlineMode && cachedSnapshot?.carePlansData ? cachedSnapshot.carePlansData : carePlansData;
  const effectiveDoctorProgressData =
    offlineMode && cachedSnapshot?.doctorProgressData ? cachedSnapshot.doctorProgressData : doctorProgressData;
  const effectiveNursingProgressData =
    offlineMode && cachedSnapshot?.nursingProgressData ? cachedSnapshot.nursingProgressData : nursingProgressData;
  const effectiveMarData = offlineMode && cachedSnapshot?.marData ? cachedSnapshot.marData : marData;
  const effectiveNarcoticCountData =
    offlineMode && cachedSnapshot?.narcoticCountData ? cachedSnapshot.narcoticCountData : narcoticCountData;
  const effectiveMedTimelineData =
    offlineMode && cachedSnapshot?.medTimelineData ? cachedSnapshot.medTimelineData : medTimelineData;
  const effectiveHomeMedsData =
    offlineMode && cachedSnapshot?.homeMedsData ? cachedSnapshot.homeMedsData : homeMedsData;
  const effectiveMedReconData =
    offlineMode && cachedSnapshot?.medReconData ? cachedSnapshot.medReconData : medReconData;

  const orders = Array.isArray((effectiveOrdersData as IPDItemsResponse | undefined)?.items) ? (effectiveOrdersData as IPDItemsResponse | undefined).items : [];
  const todayResults = Array.isArray((effectiveTodayResultsData as IPDItemsResponse | undefined)?.items)
    ? (effectiveTodayResultsData as IPDItemsResponse | undefined).items
    : [];
  const taskQueueItems = Array.isArray((effectiveTasksQueueData as IPDItemsResponse | undefined)?.items)
    ? (effectiveTasksQueueData as IPDItemsResponse | undefined).items
    : [];
  const vitalsItems = Array.isArray((effectiveVitalsData as IPDItemsResponse | undefined)?.items) ? (effectiveVitalsData as IPDItemsResponse | undefined).items : [];
  const connectVitalsItems = Array.isArray((effectiveConnectVitalsData as IPDItemsResponse | undefined)?.items)
    ? (effectiveConnectVitalsData as IPDItemsResponse | undefined).items
    : [];
  const nursingNotes = Array.isArray((effectiveNotesData as IPDItemsResponse | undefined)?.items) ? (effectiveNotesData as IPDItemsResponse | undefined).items : [];
  const medOrders = Array.isArray((effectiveMedOrdersData as IPDItemsResponse | undefined)?.items) ? (effectiveMedOrdersData as IPDItemsResponse | undefined).items : [];
  const homeMedications = Array.isArray((effectiveHomeMedsData as IPDItemsResponse | undefined)?.items)
    ? (effectiveHomeMedsData as IPDItemsResponse | undefined).items
    : [];
  const medReconItems = Array.isArray((effectiveMedReconData as IPDItemsResponse | undefined)?.items)
    ? (effectiveMedReconData as IPDItemsResponse | undefined).items
    : [];
  const reconAdmission = (medReconItems as IPDMedReconRecord[]).find((item) => item.type === 'admission') || null;
  const reconDischarge = (medReconItems as IPDMedReconRecord[]).find((item) => item.type === 'discharge') || null;
  const pharmacyQueue = Array.isArray((effectivePharmacyQueueData as IPDItemsResponse | undefined)?.items)
    ? (effectivePharmacyQueueData as IPDItemsResponse | undefined).items
    : [];
  const carePlans = Array.isArray((effectiveCarePlansData as IPDItemsResponse | undefined)?.items) ? (effectiveCarePlansData as IPDItemsResponse | undefined).items : [];
  const doctorProgressItems = Array.isArray((effectiveDoctorProgressData as IPDItemsResponse | undefined)?.items)
    ? (effectiveDoctorProgressData as IPDItemsResponse | undefined).items
    : [];
  const nursingProgressItems = Array.isArray((effectiveNursingProgressData as IPDItemsResponse | undefined)?.items)
    ? (effectiveNursingProgressData as IPDItemsResponse | undefined).items
    : [];
  const marDue = Array.isArray((effectiveMarData as IPDMarResponse | undefined)?.due) ? (effectiveMarData as IPDMarResponse | undefined).due : [];
  const marPrn = Array.isArray((effectiveMarData as IPDMarResponse | undefined)?.prn) ? (effectiveMarData as IPDMarResponse | undefined).prn : [];
  const marHistory = Array.isArray((effectiveMarData as IPDMarResponse | undefined)?.history) ? (effectiveMarData as IPDMarResponse | undefined).history : [];
  const narcoticCounts = Array.isArray((effectiveNarcoticCountData as IPDItemsResponse | undefined)?.items)
    ? (effectiveNarcoticCountData as IPDItemsResponse | undefined).items
    : [];
  const marDueByOrder = marDue.reduce((acc: Record<string, any[]>, item: any) => {
    acc[item.orderId] = acc[item.orderId] || [];
    acc[item.orderId].push(item);
    return acc;
  }, {});
  const marPrnByOrder = marPrn.reduce((acc: Record<string, any[]>, item: any) => {
    acc[item.orderId] = acc[item.orderId] || [];
    acc[item.orderId].push(item);
    return acc;
  }, {});
  const marHistoryByOrder = marHistory.reduce((acc: Record<string, any[]>, item: any) => {
    acc[item.orderId] = acc[item.orderId] || [];
    acc[item.orderId].push(item);
    return acc;
  }, {});
  const medTimeline = Array.isArray((effectiveMedTimelineData as IPDItemsResponse | undefined)?.items)
    ? (effectiveMedTimelineData as IPDItemsResponse | undefined).items
    : [];
  const latestVitals = vitalsItems[0] || null;
  const nursingAssessments = Array.isArray((effectiveAssessmentsData as IPDItemsResponse | undefined)?.items)
    ? (effectiveAssessmentsData as IPDItemsResponse | undefined).items
    : [];

  const bedsAvailable = Array.isArray((bedsData as IPDItemsResponse | undefined)?.items) ? (bedsData as IPDItemsResponse | undefined).items : [];
  const handoverItems = Array.isArray((handoverData as IPDItemsResponse | undefined)?.items) ? (handoverData as IPDItemsResponse | undefined).items : [];
  const handoverFinalized = handoverItems.some((h: any) => String(h.status || '').toUpperCase() === 'FINALIZED');

  const users = Array.isArray((effectiveUsersData as IPDItemsResponse | undefined)?.items) ? (effectiveUsersData as IPDItemsResponse | undefined).items : [];
  const userOptions = useMemo(
    () =>
      users.map((u: any) => ({
        id: String(u.id || ''),
        label: u.display || u.email || u.id,
        role: String(u.role || '').toLowerCase(),
      })),
    [users]
  );
  const physicianOptions = useMemo(
    () => userOptions.filter((u) => u.role.includes('doctor') || u.role.includes('physician')),
    [userOptions]
  );
  const nurseOptions = useMemo(
    () => userOptions.filter((u) => u.role.includes('nurse') || u.role.includes('nursing')),
    [userOptions]
  );

  const episode: IPDEpisodeType | null = (episodeData as IPDEpisodeResponse | undefined)?.episode || null;
  const discharge = dischargeData?.discharge || null;
  const deathDeclaration = deathStatusData?.declaration || null;
  const mortuaryCase = deathStatusData?.mortuaryCase || null;
  const error = (episodeData as IPDEpisodeResponse | undefined)?.error || null;

  const [ward, setWard] = useState<string>('');
  const [unit, setUnit] = useState<string>('');
  const [room, setRoom] = useState<string>('');
  const [bed, setBed] = useState<string>('');
  const [bedAssignId, setBedAssignId] = useState<string>('');
  const [bedTransferId, setBedTransferId] = useState<string>('');
  const [bedActionBusy, setBedActionBusy] = useState(false);
  const [handoverGateError, setHandoverGateError] = useState<string | null>(null);
  const [assessmentConsciousness, setAssessmentConsciousness] = useState<string>('');
  const [assessmentMobility, setAssessmentMobility] = useState<string>('');
  const [assessmentDiet, setAssessmentDiet] = useState<string>('');
  const [assessmentPainControlled, setAssessmentPainControlled] = useState(false);
  const [assessmentFallRisk, setAssessmentFallRisk] = useState(false);
  const [assessmentPressureRisk, setAssessmentPressureRisk] = useState(false);
  const [assessmentIvLine, setAssessmentIvLine] = useState(false);
  const [assessmentOxygen, setAssessmentOxygen] = useState(false);
  const [assessmentBusy, setAssessmentBusy] = useState(false);
  const [attendingPhysicianUserId, setAttendingPhysicianUserId] = useState<string>('');
  const [primaryInpatientNurseUserId, setPrimaryInpatientNurseUserId] = useState<string>('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [savingOwnership, setSavingOwnership] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderKind, setOrderKind] = useState<'LAB' | 'IMAGING' | 'NURSING'>('LAB');
  const [orderTitle, setOrderTitle] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [savingVitals, setSavingVitals] = useState(false);
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [hr, setHr] = useState('');
  const [rr, setRr] = useState('');
  const [temp, setTemp] = useState('');
  const [spo2, setSpo2] = useState('');
  const [painScore, setPainScore] = useState('');
  const [avpu, setAvpu] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteType, setNoteType] = useState<'SHIFT' | 'PROGRESS'>('SHIFT');
  const [noteContent, setNoteContent] = useState('');
  const [allergiesInput, setAllergiesInput] = useState('');
  const [savingAllergies, setSavingAllergies] = useState(false);
  const [creatingMedOrder, setCreatingMedOrder] = useState(false);
  const [medDrugName, setMedDrugName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medDoseUnit, setMedDoseUnit] = useState('');
  const [medRoute, setMedRoute] = useState<'PO' | 'IV' | 'IM' | 'SC'>('PO');
  const [medType, setMedType] = useState<'STAT' | 'PRN' | 'SCHEDULED'>('STAT');
  const [medSchedule, setMedSchedule] = useState<'Q6H' | 'Q8H' | 'Q12H' | 'Q24H'>('Q8H');
  const [medStartAt, setMedStartAt] = useState('');
  const [medDurationDays, setMedDurationDays] = useState('');
  const [medNote, setMedNote] = useState('');
  const [medIsNarcotic, setMedIsNarcotic] = useState(false);
  const [marDialogOpen, setMarDialogOpen] = useState(false);
  const [marOrderId, setMarOrderId] = useState<string | null>(null);
  const [marReason, setMarReason] = useState('');
  const [marDoseGiven, setMarDoseGiven] = useState('');
  const [marNotes, setMarNotes] = useState('');
  const [marError, setMarError] = useState('');
  const [marAction, setMarAction] = useState<'GIVEN' | 'HELD' | 'MISSED' | null>(null);
  const [marScheduledFor, setMarScheduledFor] = useState<string>('');
  const [narcoticShift, setNarcoticShift] = useState<'START' | 'END'>('START');
  const [narcoticCount, setNarcoticCount] = useState('');
  const [savingNarcoticCount, setSavingNarcoticCount] = useState(false);
  const [discontinueDialogOpen, setDiscontinueDialogOpen] = useState(false);
  const [discontinueOrderId, setDiscontinueOrderId] = useState<string | null>(null);
  const [discontinueReason, setDiscontinueReason] = useState('');
  const [discontinueError, setDiscontinueError] = useState('');
  const [verifyBusyId, setVerifyBusyId] = useState<string | null>(null);
  const [creatingCarePlan, setCreatingCarePlan] = useState(false);
  const [careProblem, setCareProblem] = useState('');
  const [careGoals, setCareGoals] = useState('');
  const [careInterventions, setCareInterventions] = useState('');
  const [careStatus, setCareStatus] = useState<'ACTIVE' | 'RESOLVED'>('ACTIVE');
  const [creatingDoctorProgress, setCreatingDoctorProgress] = useState(false);
  const [doctorAssessment, setDoctorAssessment] = useState('');
  const [doctorProgressSummary, setDoctorProgressSummary] = useState('');
  const [doctorChangesToday, setDoctorChangesToday] = useState('');
  const [doctorPlanNext24h, setDoctorPlanNext24h] = useState('');
  const [doctorDispositionPlan, setDoctorDispositionPlan] = useState<'CONTINUE' | 'DISCHARGE_PLANNING' | 'CONSULT' | ''>('');
  const [creatingNursingProgress, setCreatingNursingProgress] = useState(false);
  const [nursingResponseCarePlan, setNursingResponseCarePlan] = useState('');
  const [nursingVitalsSummary, setNursingVitalsSummary] = useState('');
  const [nursingIssues, setNursingIssues] = useState('');
  const [nursingEscalations, setNursingEscalations] = useState('');
  const [shiftNote, setShiftNote] = useState('');
  const [shiftPainSpike, setShiftPainSpike] = useState(false);
  const [shiftFall, setShiftFall] = useState(false);
  const [shiftRefusal, setShiftRefusal] = useState(false);
  const [creatingShiftNote, setCreatingShiftNote] = useState(false);

  const location = episode?.location || {};
  const ownership = episode?.ownership || {};

  useEffect(() => {
    if (!episode) return;
    setWard(String(location.ward || ''));
    setUnit(String(location.unit || ''));
    setRoom(String(location.room || ''));
    setBed(String(location.bed || ''));
    setAttendingPhysicianUserId(String(ownership.attendingPhysicianUserId || ''));
    setPrimaryInpatientNurseUserId(String(ownership.primaryInpatientNurseUserId || ''));
    const allergyList = Array.isArray(episode?.allergies) ? episode.allergies : [];
    setAllergiesInput(allergyList.join(', '));
  }, [
    episode,
    location.ward,
    location.unit,
    location.room,
    location.bed,
    ownership.attendingPhysicianUserId,
    ownership.primaryInpatientNurseUserId,
    episode?.allergies?.length,
  ]);

  const userId = String(me?.user?.id || '');
  const latestMar = marHistory.length ? marHistory[0] : null;
  const canDoctorTab = Boolean(
    canAccess || (attendingPhysicianUserId && attendingPhysicianUserId === userId)
  );
  const canNurseTab = Boolean(
    canAccess || (primaryInpatientNurseUserId && primaryInpatientNurseUserId === userId)
  );
  const canPharmacyTab = Boolean(canAccess || isPharmacy);
  const canTimelineTab = Boolean(canAccess || canDoctorTab || canNurseTab || canPharmacyTab);
  const canReconTab = canTimelineTab;
  const canCreateCarePlan = canDoctorTab;
  const canCreateMedOrder = canDoctorTab;
  const canCreateDoctorProgress = canDoctorTab;
  const canCreateNursingProgress = canNurseTab;
  const canVerifyPharmacy = canPharmacyTab;
  const canMar = canNurseTab;
  const actionsDisabled = offlineMode;
  const canApplyOrderSet =
    roleLower.includes('doctor') || roleLower.includes('charge') || roleLower.includes('admin');

  const guardOffline = () => {
    if (!offlineMode) return false;
    toast({
      title: tr('غير متاح بدون اتصال', 'Unavailable offline'),
      description: tr('بدون اتصال — عرض فقط', 'Offline — Read-only'),
      variant: 'destructive' as const,
    });
    return true;
  };

  const getUserLabel = (id: string) => {
    const match = userOptions.find((u) => u.id === id);
    return match?.label || id || '—';
  };
  const episodeIdShort = episodeId ? episodeId.slice(0, 8) : '—';
  const locationSummary = [unit, ward, room, bed].filter(Boolean).join(' / ') || '—';
  const attendingLabel = getUserLabel(attendingPhysicianUserId);
  const primaryNurseLabel = getUserLabel(primaryInpatientNurseUserId);

  const tabs = [
    { value: 'overview', label: tr('نظرة عامة', 'Overview'), show: true },
    { value: 'clinical-notes', label: tr('الملاحظات السريرية', 'Clinical Notes'), show: true },
    { value: 'results', label: tr('النتائج', 'Results'), show: canDoctorTab || canNurseTab || canPharmacyTab },
    { value: 'tasks', label: tr('المهام', 'Tasks'), show: canDoctorTab || canNurseTab },
    { value: 'handover', label: tr('تسليم المناوبة', 'Handover'), show: canDoctorTab || canNurseTab },
    { value: 'doctor', label: tr('الطبيب', 'Doctor'), show: canDoctorTab },
    { value: 'nursing', label: tr('التمريض', 'Nursing'), show: canNurseTab },
    { value: 'emar', label: tr('سجل الأدوية', 'eMAR'), show: canNurseTab },
    { value: 'pharmacy', label: tr('الصيدلية', 'Pharmacy'), show: canPharmacyTab },
    { value: 'timeline', label: tr('الجدول الزمني', 'Timeline'), show: canTimelineTab },
    { value: 'recon', label: tr('المطابقة', 'Reconciliation'), show: canReconTab },
  ];
  const defaultTab = tabs.find((t) => t.show)?.value || 'overview';

  const patient: IPDPatient = episode?.patient || {};
  const pendingTasks = Array.isArray(episode?.pendingTasks) ? episode.pendingTasks : [];
  const pendingResults = Array.isArray(episode?.pendingResults) ? episode.pendingResults : [];
  const riskFlags = episode?.riskFlags || {};
  const handoffId = String(episode?.source?.handoffId || '');
  const doctorSubmittedToday = doctorProgressItems.some((p: any) => p.date === todayStr);
  const nursingSubmittedToday = nursingProgressItems.some((p: any) => p.date === todayStr);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const vitalSlots = [0, 4, 8, 12, 16, 20].map((hour) => {
    const slotStart = new Date(dayStart);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setHours(slotStart.getHours() + 4, 0, 0, 0);
    const recorded = vitalsItems.some((v: any) => {
      const ts = v?.recordedAt ? new Date(v.recordedAt).getTime() : 0;
      return ts >= slotStart.getTime() && ts < slotEnd.getTime();
    });
    return { slotStart, recorded };
  });
  const openTasksForEncounter = taskQueueItems.filter(
    (item: any) => String(item?.task?.encounterCoreId || '') === String(encounterCoreId || '')
  );
  const lastHandover = handoverItems
    .filter((h: any) => String(h.status || '').toUpperCase() === 'FINALIZED')
    .sort((a: any, b: any) => {
      const at = new Date(a.finalizedAt || a.createdAt || 0).getTime();
      const bt = new Date(b.finalizedAt || b.createdAt || 0).getTime();
      if (bt !== at) return bt - at;
      return String(b.id || '').localeCompare(String(a.id || ''));
    })[0] || null;
  const admissionDate = episode?.createdAt ? new Date(episode.createdAt) : null;
  const dayOfStay =
    admissionDate && !Number.isNaN(admissionDate.getTime())
      ? Math.max(1, Math.floor((dayStart.getTime() - admissionDate.setHours(0, 0, 0, 0)) / (24 * 60 * 60 * 1000)) + 1)
      : null;
  const admittingDx =
    String(episode?.reasonForAdmission || '').trim() ||
    String(episode?.admissionNotes || '').trim() ||
    '—';
  const patientMrn = String(patient?.mrn || patient?.tempMrn || '').trim() || '—';

  const saveLocation = async () => {
    if (guardOffline()) return;
    setSavingLocation(true);
    try {
      const res = await fetch(`/api/ipd/episodes/${episodeId}/location`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ward, unit, room, bed }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to save location');
      toast({
        title: tr('تم الحفظ', 'Saved'),
        description: payload.noOp ? tr('لا توجد تغييرات.', 'No changes detected.') : tr('تم تحديث الموقع.', 'Location updated.'),
      });
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setSavingLocation(false);
    }
  };

  const assignBed = async () => {
    if (guardOffline()) return;
    if (!bedAssignId) return;
    setBedActionBusy(true);
    setHandoverGateError(null);
    try {
      const res = await fetch(`/api/ipd/episodes/${episodeId}/bed/assign`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bedId: bedAssignId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to assign bed');
      toast({ title: tr('تم تعيين السرير', 'Bed assigned') });
      setBedAssignId('');
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setBedActionBusy(false);
    }
  };

  const transferBed = async () => {
    if (guardOffline()) return;
    if (!bedTransferId) return;
    setBedActionBusy(true);
    setHandoverGateError(null);
    try {
      const res = await fetch(`/api/ipd/episodes/${episodeId}/bed/transfer`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bedId: bedTransferId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to transfer bed');
      toast({ title: tr('تم تحويل السرير', 'Bed transferred') });
      setBedTransferId('');
      await mutate();
    } catch (err: any) {
      if (String(err?.message || '').includes('Handover')) {
        setHandoverGateError(tr('يجب إنهاء تسليم المناوبة قبل النقل.', 'Handover must be finalized before transfer.'));
      }
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setBedActionBusy(false);
    }
  };

  const releaseBed = async () => {
    if (guardOffline()) return;
    setBedActionBusy(true);
    try {
      const res = await fetch(`/api/ipd/episodes/${episodeId}/bed/release`, { credentials: 'include', method: 'POST' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to release bed');
      toast({ title: payload.noOp ? tr('لا يوجد سرير نشط', 'No active bed') : tr('تم تحرير السرير', 'Bed released') });
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setBedActionBusy(false);
    }
  };

  const createAssessment = async () => {
    if (guardOffline()) return;
    setAssessmentBusy(true);
    try {
      const res = await fetch(`/api/ipd/episodes/${episodeId}/nursing-assessments`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consciousness: assessmentConsciousness,
          painControlled: assessmentPainControlled,
          fallRisk: assessmentFallRisk,
          pressureUlcerRisk: assessmentPressureRisk,
          ivLine: assessmentIvLine,
          oxygenTherapy: assessmentOxygen,
          mobility: assessmentMobility,
          diet: assessmentDiet,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to record assessment');
      toast({ title: tr('تم تسجيل التقييم', 'Assessment recorded') });
      setAssessmentConsciousness('');
      setAssessmentMobility('');
      setAssessmentDiet('');
      setAssessmentPainControlled(false);
      setAssessmentFallRisk(false);
      setAssessmentPressureRisk(false);
      setAssessmentIvLine(false);
      setAssessmentOxygen(false);
      await mutateAssessments();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setAssessmentBusy(false);
    }
  };

  const saveOwnership = async () => {
    if (guardOffline()) return;
    setSavingOwnership(true);
    try {
      const res = await fetch(`/api/ipd/episodes/${episodeId}/ownership`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendingPhysicianUserId, primaryInpatientNurseUserId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to save ownership');
      toast({
        title: tr('تم الحفظ', 'Saved'),
        description: payload.noOp ? tr('لا توجد تغييرات.', 'No changes detected.') : tr('تم تحديث مسؤولية الرعاية.', 'Care ownership updated.'),
      });
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setSavingOwnership(false);
    }
  };

  const createOrder = async () => {
    if (guardOffline()) return;
    if (!orderTitle.trim()) {
      toast({ title: tr('نقص بيانات', 'Missing'), description: tr('عنوان الطلب مطلوب', 'Order title is required'), variant: 'destructive' as const });
      return;
    }
    setCreatingOrder(true);
    try {
      const res = await fetch(`/api/ipd/episodes/${episodeId}/orders`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: orderKind, title: orderTitle.trim(), notes: orderNotes.trim() }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to create order');
      toast({ title: tr('تم الإنشاء', 'Created'), description: tr('تم حفظ الطلب كمسودة.', 'Order saved as draft.') });
      setOrderTitle('');
      setOrderNotes('');
      await mutateOrders();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setCreatingOrder(false);
    }
  };

  const updateOrderStatus = async (
    orderId: string,
    status: 'ORDERED' | 'DONE' | 'CANCELLED',
    reason?: string
  ) => {
    if (guardOffline()) return;
    setActionBusyId(orderId);
    try {
      const res = await fetch(`/api/ipd/orders/${orderId}/status`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, cancelReason: status === 'CANCELLED' ? reason : undefined }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to update status');
      toast({
        title: tr('تم التحديث', 'Updated'),
        description: payload.noOp ? tr('لا يوجد تغيير.', 'No change.') : (language === 'ar' ? `تم تحديث حالة الطلب إلى ${status}.` : `Order set to ${status}.`),
      });
      await mutateOrders();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setActionBusyId(null);
    }
  };

  const openCancelDialog = (orderId: string) => {
    setCancelOrderId(orderId);
    setCancelReason('');
    setCancelError('');
    setCancelDialogOpen(true);
  };

  const confirmCancel = async () => {
    if (guardOffline()) return;
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelError(tr('سبب الإلغاء مطلوب.', 'Cancel reason is required.'));
      return;
    }
    if (!cancelOrderId) return;
    setCancelDialogOpen(false);
    await updateOrderStatus(cancelOrderId, 'CANCELLED', reason);
    setCancelOrderId(null);
    setCancelReason('');
    setCancelError('');
  };

  const createVitals = async () => {
    if (guardOffline()) return;
    setSavingVitals(true);
    try {
      const res = await fetch(`/api/ipd/episodes/${episodeId}/vitals`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systolic, diastolic, hr, rr, temp, spo2, painScore, avpu }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to record vitals');
      toast({ title: tr('تم الحفظ', 'Saved'), description: tr('تم تسجيل العلامات الحيوية.', 'Vitals recorded.') });
      setSystolic(''); setDiastolic(''); setHr(''); setRr(''); setTemp(''); setSpo2(''); setPainScore(''); setAvpu('');
      await mutateVitals();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setSavingVitals(false);
    }
  };

  const createNursingNote = async () => {
    if (guardOffline()) return;
    if (!noteContent.trim()) {
      toast({ title: tr('نقص بيانات', 'Missing'), description: tr('محتوى الملاحظة مطلوب', 'Note content is required'), variant: 'destructive' as const });
      return;
    }
    setSavingNote(true);
    try {
      const res = await fetch(`/api/ipd/episodes/${episodeId}/nursing-notes`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: noteType, content: noteContent.trim() }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to add note');
      toast({ title: tr('تم الحفظ', 'Saved'), description: tr('تمت إضافة ملاحظة التمريض.', 'Nursing note added.') });
      setNoteContent('');
      await mutateNotes();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setSavingNote(false);
    }
  };

  const createCarePlan = async () => {
    if (guardOffline()) return;
    if (!careProblem.trim() || !careGoals.trim() || !careInterventions.trim()) {
      toast({ title: tr('نقص بيانات', 'Missing'), description: tr('المشكلة والأهداف والتدخلات مطلوبة', 'Problem, goals, and interventions are required'), variant: 'destructive' as const });
      return;
    }
    setCreatingCarePlan(true);
    try {
      const res = await fetch(`/api/ipd/episodes/${episodeId}/care-plans`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem: careProblem.trim(), goals: careGoals.trim(), interventions: careInterventions.trim(), status: careStatus }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to add care plan');
      toast({ title: tr('تم الحفظ', 'Saved'), description: tr('تمت إضافة خطة الرعاية.', 'Care plan added.') });
      setCareProblem(''); setCareGoals(''); setCareInterventions(''); setCareStatus('ACTIVE');
      await mutateCarePlans();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setCreatingCarePlan(false);
    }
  };

  const createDoctorProgress = async () => {
    if (guardOffline()) return;
    if (!doctorAssessment.trim() || !doctorPlanNext24h.trim()) {
      toast({ title: tr('نقص بيانات', 'Missing'), description: tr('ملاحظة التقدم والخطة مطلوبة', 'Progress note and plan are required'), variant: 'destructive' as const });
      return;
    }
    setCreatingDoctorProgress(true);
    try {
      const res = await fetch(`/api/ipd/episodes/${episodeId}/doctor-progress`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessment: doctorAssessment.trim(),
          progressSummary: doctorProgressSummary.trim(),
          changesToday: doctorChangesToday.trim(),
          planNext24h: doctorPlanNext24h.trim(),
          dispositionPlan: doctorDispositionPlan,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to add progress');
      toast({
        title: tr('تم الحفظ', 'Saved'),
        description: payload.noOp ? tr('تم الإرسال مسبقاً اليوم.', 'Already submitted today.') : tr('تمت إضافة التقدم.', 'Progress added.'),
      });
      if (!payload.noOp) {
        setDoctorAssessment(''); setDoctorProgressSummary(''); setDoctorChangesToday(''); setDoctorPlanNext24h(''); setDoctorDispositionPlan('');
      }
      await mutateDoctorProgress();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setCreatingDoctorProgress(false);
    }
  };

  const createNursingProgress = async () => {
    if (guardOffline()) return;
    if (!nursingResponseCarePlan.trim() || !nursingVitalsSummary.trim() || !nursingIssues.trim() || !nursingEscalations.trim()) {
      toast({ title: tr('نقص بيانات', 'Missing'), description: tr('كل الحقول مطلوبة', 'All fields are required'), variant: 'destructive' as const });
      return;
    }
    setCreatingNursingProgress(true);
    try {
      const res = await fetch(`/api/ipd/episodes/${episodeId}/nursing-progress`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseToCarePlan: nursingResponseCarePlan.trim(),
          vitalsSummary: nursingVitalsSummary.trim(),
          issues: nursingIssues.trim(),
          escalations: nursingEscalations.trim(),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to add progress');
      toast({
        title: tr('تم الحفظ', 'Saved'),
        description: payload.noOp ? tr('تم الإرسال مسبقاً اليوم.', 'Already submitted today.') : tr('تمت إضافة التقدم.', 'Progress added.'),
      });
      if (!payload.noOp) {
        setNursingResponseCarePlan(''); setNursingVitalsSummary(''); setNursingIssues(''); setNursingEscalations('');
      }
      await mutateNursingProgress();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setCreatingNursingProgress(false);
    }
  };

  const createShiftNote = async () => {
    if (guardOffline()) return;
    const exceptions: string[] = [];
    if (shiftPainSpike) exceptions.push(tr('نوبة ألم', 'Pain spike'));
    if (shiftFall) exceptions.push(tr('سقوط', 'Fall'));
    if (shiftRefusal) exceptions.push(tr('رفض', 'Refusal'));
    const note = shiftNote.trim();
    if (!exceptions.length && !note) {
      toast({ title: tr('نقص بيانات', 'Missing'), description: tr('أضف استثناء أو ملاحظة قصيرة', 'Add an exception or a short note'), variant: 'destructive' as const });
      return;
    }
    setCreatingShiftNote(true);
    try {
      const content = [
        exceptions.length ? `Exceptions: ${exceptions.join(', ')}` : null,
        note ? `Note: ${note}` : null,
      ].filter(Boolean).join(' | ');
      const res = await fetch(`/api/ipd/episodes/${episodeId}/nursing-notes`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'SHIFT_NOTE', content }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to add shift note');
      toast({
        title: tr('تم الحفظ', 'Saved'),
        description: payload.noOp ? tr('لا يوجد تغيير.', 'No change.') : tr('تمت إضافة ملاحظة المناوبة.', 'Shift note added.'),
      });
      setShiftNote(''); setShiftPainSpike(false); setShiftFall(false); setShiftRefusal(false);
      await mutateNotes();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setCreatingShiftNote(false);
    }
  };

  const ackTodayResult = async (resultId: string) => {
    if (guardOffline()) return;
    try {
      const key = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const res = await fetch(`/api/results/${encodeURIComponent(resultId)}/ack`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: key }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed');
      toast({ title: payload.noOp ? tr('تم التأكيد مسبقاً', 'Already acknowledged') : tr('تم التأكيد', 'Acknowledged') });
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    }
  };

  const saveAllergies = async () => {
    if (guardOffline()) return;
    setSavingAllergies(true);
    try {
      const res = await fetch(`/api/ipd/episodes/${episodeId}/allergies`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allergies: allergiesInput }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to save allergies');
      toast({
        title: tr('تم الحفظ', 'Saved'),
        description: payload.noOp ? tr('لا توجد تغييرات.', 'No changes detected.') : tr('تم تحديث الحساسية.', 'Allergies updated.'),
      });
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setSavingAllergies(false);
    }
  };

  const createMedOrder = async () => {
    if (guardOffline()) return;
    if (!medCatalogId || !medDose.trim() || !medDoseUnit.trim()) {
      toast({ title: tr('نقص بيانات', 'Missing'), description: tr('الدواء والجرعة والوحدة مطلوبة', 'Medication, dose, and unit are required'), variant: 'destructive' as const });
      return;
    }
    setCreatingMedOrder(true);
    try {
      const startAt = medStartAt ? new Date(medStartAt).toISOString() : undefined;
      const durationDays = medDurationDays ? Number(medDurationDays) : undefined;
      const key = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const res = await fetch(`/api/ipd/episodes/${episodeId}/med-orders`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicationCatalogId: medCatalogId, medicationName: medDrugName.trim(), doseValue: medDose.trim(), doseUnit: medDoseUnit.trim(),
          route: medRoute, orderType: medType, frequency: medType === 'SCHEDULED' ? medSchedule : undefined,
          startAt, durationDays, orderingDoctorId: attendingPhysicianUserId || userId,
          isNarcotic: medIsNarcotic, notes: medNote.trim(), idempotencyKey: key,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to create med order');
      if (payload.duplicateWarning) {
        toast({ title: tr('تحذير تكرار', 'Duplicate warning'), description: tr('نفس الدواء موجود بالفعل في هذه الحلقة.', 'Same medication already exists in this episode.') });
      } else {
        toast({ title: tr('تم الإنشاء', 'Created'), description: tr('تم إنشاء طلب الدواء.', 'Medication order created.') });
      }
      setMedCatalogId(''); setMedDrugName(''); setMedDose(''); setMedDoseUnit(''); setMedStartAt(''); setMedDurationDays(''); setMedNote(''); setMedIsNarcotic(false);
      await mutateMedOrders();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setCreatingMedOrder(false);
    }
  };

  const saveAdmissionReconciliation = async (items: any[]) => {
    if (guardOffline()) return;
    if (!encounterCoreId) return;
    setSavingAdmissionRec(true);
    try {
      const res = await fetch(`/api/clinical/med-reconciliation/${encodeURIComponent(encounterCoreId)}`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'admission', items, homeMedications }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to save reconciliation');
      toast({ title: tr('تم الحفظ', 'Saved'), description: tr('تم حفظ مطابقة أدوية الدخول.', 'Admission reconciliation saved.') });
      await mutateMedRecon();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setSavingAdmissionRec(false);
    }
  };

  const submitMarEvent = async (orderId: string, action: 'GIVEN' | 'HELD' | 'MISSED', scheduledFor: string, reason?: string, doseGiven?: string, notes?: string) => {
    if (guardOffline()) return;
    setActionBusyId(orderId);
    try {
      const res = await fetch(`/api/ipd/mar/${orderId}/event`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, scheduledFor, reason, doseGiven, notes }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to record MAR');
      toast({ title: tr('تم التسجيل', 'Recorded'), description: payload.noOp ? tr('لا يوجد تغيير.', 'No change.') : `MAR: ${action}` });
      await mutateMar();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setActionBusyId(null);
    }
  };

  const startMarAction = (orderId: string, scheduledFor: string, action: 'GIVEN' | 'HELD' | 'MISSED') => {
    if (guardOffline()) return;
    setMarOrderId(orderId); setMarScheduledFor(scheduledFor); setMarAction(action);
    setMarReason(''); setMarDoseGiven(''); setMarNotes(''); setMarError('');
    setMarDialogOpen(true);
  };

  const confirmMarAction = async () => {
    const reason = marReason.trim();
    const dose = marDoseGiven.trim();
    if (marAction === 'HELD' || marAction === 'MISSED') {
      if (!reason) { setMarError('Reason is required.'); return; }
    }
    if (marAction === 'GIVEN' && !dose) { setMarError('Dose given is required.'); return; }
    if (!marOrderId || !marAction || !marScheduledFor) return;
    setMarDialogOpen(false);
    await submitMarEvent(marOrderId, marAction, marScheduledFor, reason, dose, marNotes.trim());
    setMarOrderId(null); setMarScheduledFor(''); setMarAction(null);
    setMarReason(''); setMarDoseGiven(''); setMarNotes(''); setMarError('');
  };

  const openDiscontinueDialog = (orderId: string) => {
    setDiscontinueOrderId(orderId); setDiscontinueReason(''); setDiscontinueError('');
    setDiscontinueDialogOpen(true);
  };

  const confirmDiscontinue = async () => {
    if (guardOffline()) return;
    const reason = discontinueReason.trim();
    if (!reason) { setDiscontinueError('Reason is required.'); return; }
    if (!discontinueOrderId) return;
    setDiscontinueDialogOpen(false);
    setActionBusyId(discontinueOrderId);
    try {
      const res = await fetch(`/api/ipd/med-orders/${discontinueOrderId}/status`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DISCONTINUED', reason }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to discontinue');
      toast({ title: tr('تم التحديث', 'Updated'), description: payload.noOp ? tr('لا يوجد تغيير.', 'No change.') : tr('تم إيقاف الطلب.', 'Order discontinued.') });
      await mutateMedOrders();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setActionBusyId(null); setDiscontinueOrderId(null); setDiscontinueReason(''); setDiscontinueError('');
    }
  };

  const verifyOrder = async (orderId: string) => {
    if (guardOffline()) return;
    setVerifyBusyId(orderId);
    try {
      const res = await fetch(`/api/ipd/med-orders/${orderId}/verify`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'DISPENSED' }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to dispense');
      toast({ title: tr('تم الصرف', 'Dispensed'), description: payload.noOp ? tr('لا يوجد تغيير.', 'No change.') : tr('تم تأكيد الصرف.', 'Dispense confirmed.') });
      await mutateMedOrders();
      await mutatePharmacyQueue();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setVerifyBusyId(null);
    }
  };

  const submitNarcoticCount = async () => {
    if (guardOffline()) return;
    const countValue = Number(narcoticCount);
    if (!Number.isFinite(countValue)) {
      toast({ title: tr('نقص بيانات', 'Missing'), description: tr('أدخل عدداً صحيحاً.', 'Enter a valid count.'), variant: 'destructive' as const });
      return;
    }
    setSavingNarcoticCount(true);
    try {
      const res = await fetch(`/api/ipd/episodes/${episodeId}/narcotic-count`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift: narcoticShift, count: countValue }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to record count');
      toast({ title: tr('تم التسجيل', 'Recorded'), description: payload.noOp ? tr('لا يوجد تغيير.', 'No change.') : tr('تم حفظ العدّ.', 'Count saved.') });
      setNarcoticCount('');
      await mutateNarcoticCount();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setSavingNarcoticCount(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="p-6">
        <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{tr('حلقة التنويم', 'IPD Episode')}</h2>
          <p className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="p-6">
        <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{tr('حلقة التنويم', 'IPD Episode')}</h2>
          <p className="text-sm text-muted-foreground">{tr('محظور', 'Forbidden')}</p>
          <div className="text-sm text-muted-foreground">
            {tr('هذا العرض مقتصر على الأدوار المصرح بها.', 'This view is restricted to authorized roles.')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">{tr('قراءة فقط', 'Read-only')}</div>
          <h1 className="text-xl font-semibold">{tr('حلقة التنويم', 'IPD Episode')}</h1>
          <div className="text-sm text-muted-foreground">
            {tr('المصدر:', 'Source:')} <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('تسليم قبول الطوارئ', 'ER Admission Handoff')}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {handoffId ? (
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={`/handoff/${handoffId}`}>{tr('عرض التسليم', 'View Handoff')}</Link>
            </Button>
          ) : null}
          {patient?.patientMasterId || patient?.id ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="rounded-xl">
                <Link href={`/patient/${patient.patientMasterId || patient.id}`}>{tr('فتح ملف المريض', 'Open Patient Profile')}</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href={`/patient/${encodeURIComponent(patient.patientMasterId || patient.id)}/journey`}>
                  {tr('عرض رحلة المريض', 'View Patient Journey')}
                </Link>
              </Button>
            </div>
          ) : null}
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/er/board">{tr('لوحة الطوارئ', 'ER Board')}</Link>
          </Button>
        </div>
      </div>

      <div className="sticky top-0 z-10 rounded-md border bg-background/95 px-3 py-2 text-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-4">
          <div><span className="text-muted-foreground">{tr('المريض:', 'Patient:')}</span> {patient.fullName || '—'}</div>
          <div><span className="text-muted-foreground">{tr('الحلقة:', 'Episode:')}</span> {episodeIdShort}</div>
          <div><span className="text-muted-foreground">{tr('الموقع:', 'Location:')}</span> {locationSummary}</div>
          <div><span className="text-muted-foreground">{tr('الطبيب المعالج:', 'Attending:')}</span> {attendingLabel}</div>
          <div><span className="text-muted-foreground">{tr('الممرض الرئيسي:', 'Primary Nurse:')}</span> {primaryNurseLabel}</div>
        </div>
      </div>
      {offlineMode ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {tr('بدون اتصال — عرض فقط', 'Offline — Read-only')}
        </div>
      ) : null}

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <div className="rounded-md border bg-muted/40 p-2">
          <TabsList className="flex h-auto w-full flex-wrap items-start gap-2 bg-transparent p-0">
            {tabs.filter((t) => t.show).map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="h-9">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="clinical-notes">
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">{tr('الملاحظات السريرية', 'Clinical Notes')}</h2>
            <p className="text-sm text-muted-foreground">{tr('ملاحظات إضافة فقط لهذه الحلقة', 'Append-only notes for this episode')}</p>
            <div className="space-y-3">
              <Button variant="outline" className="rounded-xl" onClick={() => setClinicalOpen(true)}>
                {tr('إضافة ملاحظة', 'Add Note')}
              </Button>
              <div className="space-y-2">
                {clinicalNotes.length ? (
                  clinicalNotes.map((note: any) => (
                    <div key={note.id} className="rounded-md border p-3 text-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{note.title || note.noteType || tr('ملاحظة سريرية', 'Clinical Note')}</div>
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{note.role}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {note.createdAt ? new Date(note.createdAt).toLocaleString() : ''} •{' '}
                        {note.author?.name || tr('غير معروف', 'Unknown')}
                      </div>
                      <div className="whitespace-pre-wrap">{note.content}</div>
                      <div className="rounded-md border bg-muted/30 p-2 space-y-2">
                        <div>
                          <div className="text-xs font-medium mb-1">{tr('طلبات من هذه الملاحظة', 'Orders from this note')}</div>
                          <NoteOrdersList noteId={note.id} />
                        </div>
                        <div>
                          <div className="text-xs font-medium mb-1">{tr('المرفقات', 'Attachments')}</div>
                          <AttachmentsList entityType="clinical_note" entityId={note.id} />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">{tr('لا توجد ملاحظات بعد.', 'No notes yet.')}</div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="results">
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">{tr('النتائج', 'Results')}</h2>
            <p className="text-sm text-muted-foreground">{tr('نتائج مرتبطة بالطلبات (قراءة فقط)', 'Read-only results linked to orders')}</p>
            <div className="space-y-3">
              {ordersHub.length ? (
                ordersHub.map((order: any) => (
                  <div key={order.id} className="rounded-md border p-3 space-y-2">
                    <div>
                      <div className="font-medium">
                        {order.orderName} <span className="text-xs text-muted-foreground">({order.orderCode})</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {order.kind} • {order.status}
                      </div>
                    </div>
                    <OrderResultsList orderId={order.id} canAck={canDoctorTab || canNurseTab} />
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">{tr('لا توجد طلبات بعد.', 'No orders yet.')}</div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tasks">
          <TasksPanel encounterCoreId={encounterCoreId} />
        </TabsContent>

        <TabsContent value="handover">
          <HandoverPanel encounterCoreId={encounterCoreId} episodeId={episodeId} />
        </TabsContent>

        {/* --- OVERVIEW TAB --- */}
        <TabsContent value="overview">
          <div className="space-y-4">
            {!episode ? (
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{tr('حلقة التنويم', 'IPD Episode')}</h2>
                <p className="text-sm text-muted-foreground">{error || tr('غير موجود', 'Not found')}</p>
                <Button asChild variant="outline" className="rounded-xl">
                  <Link href="/er/board">{tr('العودة للوحة الطوارئ', 'Back to ER Board')}</Link>
                </Button>
              </div>
            ) : (
              <>
                <OrderSetsPanel encounterType="IPD" encounterId={encounterCoreId} canApply={canApplyOrderSet} />
                {/* Patient Card */}
                <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">{tr('المريض', 'Patient')}</h2>
                  <p className="text-sm text-muted-foreground">{tr('لقطة محمولة إلى الحلقة', 'Snapshot carried into the episode')}</p>
                  <div className="text-sm space-y-2">
                    <div><span className="text-muted-foreground">{tr('الاسم:', 'Name:')}</span> {patient.fullName || '—'}</div>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('رقم الملف:', 'MRN:')} {patient.mrn || '—'}</span>
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('رقم الملف المؤقت:', 'Temp MRN:')} {patient.tempMrn || '—'}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {riskFlags.sepsisSuspected ? (
                        <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{tr('اشتباه تعفن', 'Sepsis suspected')}</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('لا يوجد تعفن', 'No sepsis flag')}</span>
                      )}
                      {riskFlags.hasOpenEscalation ? (
                        <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{tr('تصعيد مفتوح', 'Open escalation')}</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('لا يوجد تصعيد', 'No escalation')}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Discharge Card */}
                <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">{tr('الخروج', 'Discharge')}</h2>
                  <p className="text-sm text-muted-foreground">{tr('إنهاء ملخص الخروج', 'Finalize discharge summary')}</p>
                  <div className="space-y-3 text-sm">
                  {!handoverFinalized && (
                    <div className="rounded-md border border-amber-500/40 bg-amber-50 p-2 text-sm text-amber-800 flex items-center justify-between gap-2 flex-wrap">
                      <span>{tr('يجب إنهاء تسليم المناوبة قبل الخروج.', 'Handover must be finalized before discharge.')}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl border-amber-500 text-amber-800 hover:bg-amber-100"
                        onClick={() => {
                          const trigger = document.querySelector<HTMLButtonElement>('[data-state][value="handover"]');
                          if (trigger) trigger.click();
                        }}
                      >
                        {tr('إنشاء تسليم المناوبة', 'Create Handover')}
                      </Button>
                    </div>
                  )}
                    {discharge ? (
                      <div className="space-y-1">
                        <div>{tr('الحالة:', 'Status:')} <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('مكتمل', 'FINALIZED')}</span></div>
                        <div>{tr('التصرف:', 'Disposition:')} {discharge.disposition}</div>
                        <div className="text-xs text-muted-foreground">{discharge.createdAt ? new Date(discharge.createdAt).toLocaleString() : ''}</div>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">{tr('لا يوجد ملخص خروج بعد.', 'No discharge summary yet.')}</div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" className="rounded-xl" onClick={() => setDischargeOpen(true)} disabled={dischargeBusy || !handoverFinalized}>{tr('إنهاء الخروج', 'Finalize Discharge')}</Button>
                      {(patient.patientMasterId || patient.id) ? (
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" className="rounded-xl" asChild><Link href={`/patient/${patient.patientMasterId || patient.id}`}>{tr('فتح ملف المريض', 'Open Patient Profile')}</Link></Button>
                          <Button size="sm" variant="outline" className="rounded-xl" asChild><Link href={`/patient/${encodeURIComponent(patient.patientMasterId || patient.id)}/journey`}>{tr('عرض رحلة المريض', 'View Patient Journey')}</Link></Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Death Card */}
                <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">{tr('الوفاة', 'Death')}</h2>
                  <p className="text-sm text-muted-foreground">{tr('إعلان واعتماد', 'Declare and finalize')}</p>
                  <div className="space-y-3 text-sm">
                    {deathDeclaration ? (
                      <div className="space-y-1">
                        <div>{tr('الإعلان:', 'Declaration:')} <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{deathDeclaration.finalizedAt ? tr('مكتمل', 'FINALIZED') : tr('معلن', 'DECLARED')}</span></div>
                        <div>{tr('المكان:', 'Place:')} {deathDeclaration.placeOfDeath}</div>
                        <div className="text-xs text-muted-foreground">{deathDeclaration.declaredAt ? new Date(deathDeclaration.declaredAt).toLocaleString() : ''}</div>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">{tr('لا يوجد إعلان بعد.', 'No declaration yet.')}</div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" className="rounded-xl" onClick={() => setDeathDeclareOpen(true)} disabled={deathBusy}>{tr('إعلان الوفاة', 'Declare Death')}</Button>
                      <Button variant="outline" className="rounded-xl" onClick={() => setDeathFinalizeOpen(true)} disabled={deathBusy}>{tr('تأكيد الوفاة', 'Finalize Death')}</Button>
                      {mortuaryCase?.id ? (<Button size="sm" variant="outline" className="rounded-xl" asChild><Link href={`/mortuary/${mortuaryCase.id}`}>{tr('فتح حالة المشرحة', 'Open Mortuary Case')}</Link></Button>) : null}
                    </div>
                  </div>
                </div>

                {/* Allergies Card */}
                <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">{tr('الحساسية', 'Allergies')}</h2>
                  <p className="text-sm text-muted-foreground">{tr('قائمة مستوى الحلقة (مختصرة)', 'Episode-level list (minimal)')}</p>
                  <div className="space-y-3">
                    {(isDoctor || isNurse || canAccess) ? (
                      <>
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحساسية (مفصولة بفاصلة)', 'Allergies (comma-separated)')}</span>
                          <Input className="rounded-xl thea-input-focus" value={allergiesInput} onChange={(e) => setAllergiesInput(e.target.value)} placeholder={tr('مثال: بنسلين، لاتكس', 'e.g., Penicillin, Latex')} />
                        </div>
                        <Button className="rounded-xl" onClick={saveAllergies} disabled={actionsDisabled || savingAllergies}>{tr('حفظ الحساسية', 'Save Allergies')}</Button>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">{tr('الحساسية للقراءة فقط.', 'Allergies are read-only.')}</div>
                    )}
                    <div className="text-sm text-muted-foreground">{tr('الحالية:', 'Current:')} {allergiesInput.trim() ? allergiesInput : '—'}</div>
                  </div>
                </div>

                {/* Reason Card */}
                <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">{tr('السبب', 'Reason')}</h2>
                  <p className="text-sm text-muted-foreground">{tr('من تصرف الطوارئ وقت الإنهاء', 'From ER disposition at finalize time')}</p>
                  <div className="text-sm whitespace-pre-wrap">{String(episode?.reasonForAdmission || '').trim() || '—'}</div>
                </div>

                {/* IPD Location Card */}
                <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">{tr('موقع التنويم', 'IPD Location')}</h2>
                  <p className="text-sm text-muted-foreground">{tr('تخصيص السرير + نقل الغرف/الوحدات', 'Bed assignment + room/unit transfers')}</p>
                  <div className="space-y-3">
                  {!handoverFinalized && (
                    <div className="rounded-md border border-amber-500/40 bg-amber-50 p-2 text-sm text-amber-800">{tr('يجب إنهاء تسليم المناوبة قبل النقل أو الخروج.', 'Handover must be finalized before transfers or discharge.')}</div>
                  )}
                  {handoverGateError ? (
                    <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">{handoverGateError}</div>
                  ) : null}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('تخصيص سرير', 'Assign bed')}</span>
                      <Select value={bedAssignId} onValueChange={setBedAssignId}>
                        <SelectTrigger className="rounded-xl"><SelectValue placeholder={tr('اختر سرير متاح', 'Select available bed')} /></SelectTrigger>
                        <SelectContent>
                          {bedsAvailable.map((b: any) => (
                            <SelectItem key={b.id} value={b.id} disabled={b.status !== 'AVAILABLE'}>{b.bedLabel} • {b.unit || b.ward || tr('وحدة', 'Unit')} {b.room ? `• ${b.room}` : ''} • {b.status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button className="rounded-xl" onClick={assignBed} disabled={actionsDisabled || bedActionBusy || !bedAssignId}>{tr('تخصيص السرير', 'Assign Bed')}</Button>
                    </div>
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نقل السرير', 'Transfer bed')}</span>
                      <Select value={bedTransferId} onValueChange={setBedTransferId}>
                        <SelectTrigger className="rounded-xl"><SelectValue placeholder={tr('اختر سرير جديد', 'Select new bed')} /></SelectTrigger>
                        <SelectContent>
                          {bedsAvailable.map((b: any) => (
                            <SelectItem key={b.id} value={b.id} disabled={b.status !== 'AVAILABLE'}>{b.bedLabel} • {b.unit || b.ward || tr('وحدة', 'Unit')} {b.room ? `• ${b.room}` : ''} • {b.status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" className="rounded-xl" onClick={transferBed} disabled={actionsDisabled || bedActionBusy || !bedTransferId || !handoverFinalized}>{tr('نقل السرير', 'Transfer Bed')}</Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="rounded-xl" onClick={releaseBed} disabled={actionsDisabled || bedActionBusy}>{tr('تحرير السرير', 'Release Bed')}</Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوحدة', 'Unit')}</span>
                      <Input className="rounded-xl thea-input-focus" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={tr('الوحدة', 'Unit')} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الجناح', 'Ward')}</span>
                      <Input className="rounded-xl thea-input-focus" value={ward} onChange={(e) => setWard(e.target.value)} placeholder={tr('الجناح', 'Ward')} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الغرفة', 'Room')}</span>
                      <Input className="rounded-xl thea-input-focus" value={room} onChange={(e) => setRoom(e.target.value)} placeholder={tr('الغرفة', 'Room')} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السرير', 'Bed')}</span>
                      <Input className="rounded-xl thea-input-focus" value={bed} onChange={(e) => setBed(e.target.value)} placeholder={tr('السرير', 'Bed')} />
                    </div>
                  </div>
                  <Button className="rounded-xl" onClick={saveLocation} disabled={actionsDisabled || savingLocation || !handoverFinalized}>{tr('حفظ الموقع', 'Save Location')}</Button>
                  </div>
                </div>

                {/* Care Ownership Card */}
                <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">{tr('ملكية الرعاية', 'Care Ownership')}</h2>
                  <p className="text-sm text-muted-foreground">{tr('الطبيب المعالج والممرض الرئيسي', 'Attending Physician & Primary Inpatient Nurse')}</p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الطبيب المعالج', 'Attending Physician')}</span>
                        <Select value={attendingPhysicianUserId || undefined} onValueChange={(value) => setAttendingPhysicianUserId(value || '')}>
                          <SelectTrigger className="rounded-xl"><SelectValue placeholder={tr('اختر طبيب', 'Select physician')} /></SelectTrigger>
                          <SelectContent>{physicianOptions.map((u) => (<SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الممرض/ة الرئيسي/ة', 'Primary Inpatient Nurse')}</span>
                        <Select value={primaryInpatientNurseUserId || undefined} onValueChange={(value) => setPrimaryInpatientNurseUserId(value || '')}>
                          <SelectTrigger className="rounded-xl"><SelectValue placeholder={tr('اختر ممرض/ة', 'Select nurse')} /></SelectTrigger>
                          <SelectContent>{nurseOptions.map((u) => (<SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button className="rounded-xl" onClick={saveOwnership} disabled={actionsDisabled || savingOwnership}>{tr('حفظ المسؤولية', 'Save Ownership')}</Button>
                  </div>
                </div>

                {/* Doctor Summary Card */}
                <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">{tr('ملخص الطبيب (التقييم والخطة)', 'Doctor Summary (Assessment & Plan)')}</h2>
                  <p className="text-sm text-muted-foreground">{tr('لقطة من الطوارئ', 'Snapshot from ER')}</p>
                  <div className="text-sm whitespace-pre-wrap">{String(episode?.doctorSummary?.content || '').trim() || '—'}</div>
                </div>

                {/* Nursing Summary Card */}
                <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">{tr('ملخص التمريض (SBAR)', 'Nursing Summary (SBAR)')}</h2>
                  <p className="text-sm text-muted-foreground">{tr('لقطة من الطوارئ', 'Snapshot from ER')}</p>
                  <div className="text-sm space-y-2">
                    <div className="whitespace-pre-wrap"><span className="text-muted-foreground">{tr('الحالة:', 'Situation:')}</span> {String(episode?.nursingSummary?.situation || '').trim() || '—'}</div>
                    <div className="whitespace-pre-wrap"><span className="text-muted-foreground">{tr('الخلفية:', 'Background:')}</span> {String(episode?.nursingSummary?.background || '').trim() || '—'}</div>
                    <div className="whitespace-pre-wrap"><span className="text-muted-foreground">{tr('التقييم:', 'Assessment:')}</span> {String(episode?.nursingSummary?.assessment || '').trim() || '—'}</div>
                    <div className="whitespace-pre-wrap"><span className="text-muted-foreground">{tr('التوصية:', 'Recommendation:')}</span> {String(episode?.nursingSummary?.recommendation || '').trim() || '—'}</div>
                  </div>
                </div>

                {/* Pending Items Card */}
                <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">{tr('العناصر المعلقة', 'Pending Items')}</h2>
                  <p className="text-sm text-muted-foreground">{tr('محمولة من لقطة تسليم الطوارئ', 'Carried from ER handoff snapshot')}</p>
                  <div className="space-y-4">
                    <div className="text-sm">
                      {tr('المهام المعلقة:', 'Pending Tasks:')} <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{pendingTasks.length}</span>
                      <span className="ml-3">{tr('النتائج المعلقة:', 'Pending Results:')} <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{pendingResults.length}</span></span>
                    </div>

                    {pendingTasks.length ? (
                      <div>
                        <div className="grid grid-cols-2 gap-4 px-4 py-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المهمة', 'Task')}</span>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                        </div>
                        <div className="divide-y divide-border">
                          {pendingTasks.slice(0, 15).map((t: any) => (
                            <div key={t.id} className="grid grid-cols-2 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                              <span className="text-sm text-foreground">{t.label || t.kind || t.id}</span>
                              <span className="text-sm text-foreground"><span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{String(t.status || '')}</span></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">{tr('لا توجد مهام معلقة.', 'No pending tasks.')}</div>
                    )}

                    {pendingResults.length ? (
                      <div>
                        <div className="grid grid-cols-1 gap-4 px-4 py-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نتيجة معلقة', 'Pending Result')}</span>
                        </div>
                        <div className="divide-y divide-border">
                          {pendingResults.slice(0, 15).map((r: any) => (
                            <div key={r.id} className="grid grid-cols-1 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                              <span className="text-sm text-foreground">{r.label || r.kind || r.id}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">{tr('لا توجد نتائج معلقة.', 'No pending results.')}</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {canDoctorTab ? (
          <TabsContent value="doctor">
            <div className="space-y-4">
              {/* IPD Orders (Non-Medication) */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{tr('طلبات التنويم (غير دوائية)', 'IPD Orders (Non-Medication)')}</h2>
                <p className="text-sm text-muted-foreground">{tr('مختبر، أشعة، تعليمات تمريض فقط', 'Labs, Imaging, Nursing instructions only')}</p>
                <div className="space-y-4">
                  {isDoctor ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النوع', 'Type')}</span>
                          <Select value={orderKind} onValueChange={(value) => setOrderKind(value as 'LAB' | 'IMAGING' | 'NURSING')}>
                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="LAB">{tr('مختبر', 'Lab')}</SelectItem>
                              <SelectItem value="IMAGING">{tr('أشعة', 'Imaging')}</SelectItem>
                              <SelectItem value="NURSING">{tr('تمريض', 'Nursing')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('عنوان الطلب', 'Order Title')}</span>
                          <Input className="rounded-xl thea-input-focus" value={orderTitle} onChange={(e) => setOrderTitle(e.target.value)} placeholder={tr('مثال: CBC, أشعة صدر', 'e.g., CBC, Chest X-Ray')} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ملاحظات (اختياري)', 'Notes (optional)')}</span>
                        <Textarea className="rounded-xl thea-input-focus" value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder={tr('تعليمات اختيارية', 'Optional instructions')} />
                      </div>
                      <Button className="rounded-xl" onClick={createOrder} disabled={actionsDisabled || creatingOrder}>{tr('حفظ مسودة', 'Save Draft')}</Button>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">{tr('الطلبات يمكن إنشاؤها من قبل الأطباء فقط.', 'Orders can be created by doctors only.')}</div>
                  )}

                  {orders.length ? (
                    <div>
                      <div className="grid grid-cols-4 gap-4 px-4 py-2">
                        {[tr('النوع', 'Type'), tr('الطلب', 'Order'), tr('الحالة', 'Status'), tr('الإجراءات', 'Actions')].map((h) => (
                          <span key={h} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</span>
                        ))}
                      </div>
                      <div className="divide-y divide-border">
                        {orders.map((o: any) => (
                          <div key={o.id} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                            <span className="text-sm text-foreground">{String(o.kind || '').toUpperCase()}</span>
                            <span className="text-sm text-foreground">
                              <div className="font-medium">{o.title}</div>
                              {o.notes ? <div className="text-xs text-muted-foreground">{o.notes}</div> : null}
                            </span>
                            <span className="text-sm text-foreground"><span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{String(o.status || '')}</span></span>
                            <span className="text-sm text-foreground space-x-2">
                              {o.status === 'DRAFT' && isDoctor ? (
                                <>
                                  <Button size="sm" className="rounded-xl" onClick={() => updateOrderStatus(o.id, 'ORDERED')} disabled={actionsDisabled || actionBusyId === o.id}>{tr('تنفيذ', 'Place')}</Button>
                                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openCancelDialog(o.id)} disabled={actionsDisabled || actionBusyId === o.id}>{tr('إلغاء', 'Cancel')}</Button>
                                </>
                              ) : null}
                              {o.status === 'ORDERED' && isNurse ? (
                                <Button size="sm" className="rounded-xl" onClick={() => updateOrderStatus(o.id, 'DONE')} disabled={actionsDisabled || actionBusyId === o.id}>{tr('تم التنفيذ', 'Mark Done')}</Button>
                              ) : null}
                              {o.status === 'ORDERED' && isDoctor ? (
                                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openCancelDialog(o.id)} disabled={actionsDisabled || actionBusyId === o.id}>{tr('إلغاء', 'Cancel')}</Button>
                              ) : null}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">{tr('لا توجد طلبات بعد.', 'No orders yet.')}</div>
                  )}
                </div>
              </div>

              {/* Medication Orders */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{tr('أوامر الأدوية', 'Medication Orders')}</h2>
                <p className="text-sm text-muted-foreground">{tr('طلب - صرف - إعطاء', 'Order - dispense - administer')}</p>
                <div className="space-y-4">
                  {canCreateMedOrder ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="space-y-1 md:col-span-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الدواء', 'Medication')}</span>
                          <Input className="rounded-xl thea-input-focus" value={medCatalogSearch} onChange={(e) => setMedCatalogSearch(e.target.value)} placeholder={tr('ابحث عن دواء...', 'Search medication...')} />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('اختر الدواء', 'Select Medication')}</span>
                          <Select value={medCatalogId || ''} onValueChange={(value) => {
                            setMedCatalogId(value);
                            const item = medCatalogItems.find((m: any) => String(m.id) === String(value));
                            const label = item ? `${item.genericName || ''} ${item.strength || ''} ${item.form || ''}`.trim() : '';
                            setMedDrugName(label);
                            const routes = Array.isArray(item?.routes) ? item.routes.map((r: any) => String(r || '').toUpperCase()) : [];
                            if (routes.length) setMedRoute(routes[0] as 'PO' | 'IV' | 'IM' | 'SC');
                          }}>
                            <SelectTrigger className="rounded-xl"><SelectValue placeholder={tr('اختر دواء', 'Select medication')} /></SelectTrigger>
                            <SelectContent>
                              {medCatalogItems.map((item: any) => (
                                <SelectItem key={item.id} value={item.id}>{`${item.genericName || ''} ${item.strength || ''} ${item.form || ''}`.trim() || item.code}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الجرعة', 'Dose')}</span><Input className="rounded-xl thea-input-focus" value={medDose} onChange={(e) => setMedDose(e.target.value)} placeholder={tr('مثال: 1', 'e.g., 1')} /></div>
                        <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوحدة', 'Unit')}</span><Input className="rounded-xl thea-input-focus" value={medDoseUnit} onChange={(e) => setMedDoseUnit(e.target.value)} placeholder={tr('مثال: غ', 'e.g., g')} /></div>
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الطريق', 'Route')}</span>
                          <Select value={medRoute} onValueChange={(value) => setMedRoute(value as 'PO' | 'IV' | 'IM' | 'SC')}>
                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>{allowedMedRoutes.map((route) => (<SelectItem key={route} value={route}>{route}</SelectItem>))}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع الأمر', 'Order Type')}</span>
                          <Select value={medType} onValueChange={(value) => setMedType(value as 'STAT' | 'PRN' | 'SCHEDULED')}>
                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="STAT">{tr('فوري', 'STAT')}</SelectItem><SelectItem value="SCHEDULED">{tr('مجدول', 'Scheduled')}</SelectItem><SelectItem value="PRN">{tr('عند الحاجة', 'PRN')}</SelectItem></SelectContent>
                          </Select>
                        </div>
                        {medType === 'SCHEDULED' ? (
                          <div className="space-y-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التكرار', 'Frequency')}</span>
                            <Select value={medSchedule} onValueChange={(value) => setMedSchedule(value as 'Q6H' | 'Q8H' | 'Q12H' | 'Q24H')}>
                              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="Q6H">Q6H</SelectItem><SelectItem value="Q8H">Q8H</SelectItem><SelectItem value="Q12H">Q12H</SelectItem><SelectItem value="Q24H">Q24H</SelectItem></SelectContent>
                            </Select>
                          </div>
                        ) : null}
                        {(medType === 'SCHEDULED' || medType === 'PRN') ? (
                          <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('وقت البدء', 'Start At')}</span><Input className="rounded-xl thea-input-focus" type="datetime-local" value={medStartAt} onChange={(e) => setMedStartAt(e.target.value)} /></div>
                        ) : null}
                        <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المدة (أيام)', 'Duration (days)')}</span><Input className="rounded-xl thea-input-focus" value={medDurationDays} onChange={(e) => setMedDurationDays(e.target.value)} placeholder={tr('اختياري', 'Optional')} /></div>
                        <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الطبيب الآمر', 'Ordering Doctor')}</span><Input className="rounded-xl thea-input-focus" value={attendingLabel || userId} disabled /></div>
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('مخدر', 'Narcotic')}</span>
                          <div className="flex items-center gap-2"><Checkbox checked={medIsNarcotic} onCheckedChange={(v) => setMedIsNarcotic(Boolean(v))} /><span className="text-sm text-muted-foreground">{tr('يتطلب تأكيد الصرف', 'Requires dispense confirm')}</span></div>
                        </div>
                      </div>
                      <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ملاحظات (اختياري)', 'Notes (optional)')}</span><Textarea className="rounded-xl thea-input-focus" value={medNote} onChange={(e) => setMedNote(e.target.value)} placeholder={tr('ملاحظة اختيارية', 'Optional note')} /></div>
                      <Button className="rounded-xl" onClick={createMedOrder} disabled={actionsDisabled || creatingMedOrder}>{tr('إنشاء أمر دواء', 'Create Medication Order')}</Button>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">{tr('أوامر الأدوية للقراءة فقط.', 'Medication orders are read-only.')}</div>
                  )}

                  {medOrders.length ? (
                    <div>
                      <div className="grid grid-cols-9 gap-4 px-4 py-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الدواء', 'Medication')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الجرعة', 'Dose')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الطريق', 'Route')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع الأمر', 'Order Type')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التكرار', 'Frequency')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('مخدر', 'Narcotic')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ملاحظة', 'Note')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الإجراءات', 'Actions')}</span>
                      </div>
                      <div className="divide-y divide-border">
                        {medOrders.map((m: any) => (
                          <div key={m.id} className="grid grid-cols-9 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                            <span className="text-sm text-foreground">
                              <div className="font-medium">{m.drugName}</div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {m.allergyConflict ? <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{tr('حساسية', 'Allergy')}</span> : null}
                                {m.highRisk ? <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('خطورة عالية', 'High Risk')}</span> : null}
                                {m.duplicateWarning ? <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('مكرر', 'Duplicate')}</span> : null}
                                {m.overdueDoseCount > 0 ? <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{tr('متأخر', 'Overdue')} x{m.overdueDoseCount}</span> : null}
                              </div>
                            </span>
                            <span className="text-sm text-foreground">{m.dose} {m.doseUnit}</span>
                            <span className="text-sm text-foreground">{m.route}</span>
                            <span className="text-sm text-foreground">{m.type}</span>
                            <span className="text-sm text-foreground">{m.schedule || '—'}</span>
                            <span className="text-sm text-foreground">{m.isNarcotic ? tr('نعم', 'Yes') : tr('لا', 'No')}</span>
                            <span className="text-xs text-muted-foreground">{m.note || '—'}</span>
                            <span className="text-sm text-foreground"><span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{m.currentStatus || m.status || 'ORDERED'}</span></span>
                            <span className="text-sm text-foreground space-x-2">
                              {['ORDERED', 'ACTIVE', 'DISPENSED'].includes(m.currentStatus || m.status) && canCreateMedOrder ? (
                                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openDiscontinueDialog(m.id)} disabled={actionsDisabled || actionBusyId === m.id}>{tr('إيقاف', 'Discontinue')}</Button>
                              ) : null}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">{tr('لا توجد أوامر أدوية.', 'No medication orders.')}</div>
                  )}
                </div>
              </div>

              {/* Care Plans */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{tr('خطط الرعاية', 'Care Plans')}</h2>
                <p className="text-sm text-muted-foreground">{tr('موجهة بالمشكلة، إضافة فقط', 'Problem-oriented, append-only')}</p>
                <div className="space-y-4">
                  <div className="text-sm">
                    {tr('الأوامر المرتبطة:', 'Related Orders:')} <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{orders.length}</span>
                    <span className="ml-3">{tr('آخر علامات حيوية:', 'Latest Vitals:')} {latestVitals?.vitals ? `${latestVitals.vitals.systolic ?? '—'}/${latestVitals.vitals.diastolic ?? '—'} BP, HR ${latestVitals.vitals.hr ?? '—'}` : '—'}</span>
                    <span className="ml-3">{tr('آخر سجل إعطاء:', 'Latest MAR:')} {latestMar ? `${latestMar.drugName} (${latestMar.route}) — ${latestMar.action}` : '—'}</span>
                  </div>

                  {carePlans.filter((p: any) => p.status === 'ACTIVE').length ? (
                    <div>
                      <div className="grid grid-cols-4 gap-4 px-4 py-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المشكلة', 'Problem')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الأهداف', 'Goals')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التدخلات', 'Interventions')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                      </div>
                      <div className="divide-y divide-border">
                        {carePlans.filter((p: any) => p.status === 'ACTIVE').map((p: any) => (
                          <div key={p.id} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                            <span className="text-sm text-foreground">{p.problem}</span>
                            <span className="text-sm text-foreground whitespace-pre-wrap">{p.goals}</span>
                            <span className="text-sm text-foreground whitespace-pre-wrap">{p.interventions}</span>
                            <span className="text-sm text-foreground"><span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{p.status}</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">{tr('لا توجد خطط رعاية نشطة.', 'No active care plans.')}</div>
                  )}

                  {canCreateCarePlan ? (
                    <div className="space-y-3">
                      <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المشكلة', 'Problem')}</span><Input className="rounded-xl thea-input-focus" value={careProblem} onChange={(e) => setCareProblem(e.target.value)} /></div>
                      <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الأهداف', 'Goals')}</span><Textarea className="rounded-xl thea-input-focus" value={careGoals} onChange={(e) => setCareGoals(e.target.value)} /></div>
                      <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التدخلات', 'Interventions')}</span><Textarea className="rounded-xl thea-input-focus" value={careInterventions} onChange={(e) => setCareInterventions(e.target.value)} /></div>
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                        <Select value={careStatus} onValueChange={(value) => setCareStatus(value as 'ACTIVE' | 'RESOLVED')}>
                          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="ACTIVE">{tr('نشط', 'ACTIVE')}</SelectItem><SelectItem value="RESOLVED">{tr('محلول', 'RESOLVED')}</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <Button className="rounded-xl" onClick={createCarePlan} disabled={actionsDisabled || creatingCarePlan}>{tr('إضافة خطة رعاية', 'Add Care Plan')}</Button>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">{tr('خطط الرعاية للقراءة فقط للتمريض.', 'Care plans are read-only for nursing.')}</div>
                  )}
                </div>
              </div>

              {/* Doctor Today */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{tr('الطبيب اليوم', 'Doctor Today')}</h2>
                <p className="text-sm text-muted-foreground">{tr('إجراءات يومية وملاحظة تقدم', 'Daily actions and progress note')}</p>
                <div className="space-y-4">
                  <div className="rounded-md border bg-muted/20 p-3 text-sm space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{patient.fullName || tr('غير معروف', 'Unknown')}</span>
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('رقم الملف', 'MRN')} {patientMrn}</span>
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{locationSummary}</span>
                      {dayOfStay ? <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('اليوم', 'Day')} {dayOfStay}</span> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">{tr('تشخيص القبول:', 'Admitting Dx:')} {admittingDx}</div>
                  </div>

                  {!doctorSubmittedToday && (<div className="rounded-md border border-amber-500/40 bg-amber-50 p-2 text-sm text-amber-800">{tr('ملاحظة التقدم لليوم معلقة.', 'Progress note for today is pending.')}</div>)}

                  {canCreateDoctorProgress ? (
                    <div className="space-y-3">
                      <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ملاحظة التقدم (يومي)', 'Progress Note (DAILY_PROGRESS)')}</span><Textarea className="rounded-xl thea-input-focus" value={doctorAssessment} onChange={(e) => setDoctorAssessment(e.target.value)} /></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('خطة التصرف', 'Disposition Plan')}</span>
                          <Select value={doctorDispositionPlan} onValueChange={(value) => setDoctorDispositionPlan(value as 'CONTINUE' | 'DISCHARGE_PLANNING' | 'CONSULT' | '')}>
                            <SelectTrigger className="rounded-xl"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                            <SelectContent><SelectItem value="CONTINUE">{tr('استمرار', 'Continue')}</SelectItem><SelectItem value="DISCHARGE_PLANNING">{tr('تخطيط الخروج', 'Discharge Planning')}</SelectItem><SelectItem value="CONSULT">{tr('استشارة', 'Consult')}</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('خطة اليوم', 'Plan for Today')}</span><Textarea className="rounded-xl thea-input-focus" value={doctorPlanNext24h} onChange={(e) => setDoctorPlanNext24h(e.target.value)} /></div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الملخص (اختياري)', 'Summary (optional)')}</span><Textarea className="rounded-xl thea-input-focus" value={doctorProgressSummary} onChange={(e) => setDoctorProgressSummary(e.target.value)} /></div>
                        <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التغييرات اليوم (اختياري)', 'Changes Today (optional)')}</span><Textarea className="rounded-xl thea-input-focus" value={doctorChangesToday} onChange={(e) => setDoctorChangesToday(e.target.value)} /></div>
                      </div>
                      <Button className="rounded-xl" onClick={createDoctorProgress} disabled={actionsDisabled || creatingDoctorProgress || doctorSubmittedToday}>{doctorSubmittedToday ? tr('تم التقديم اليوم', 'Submitted Today') : tr('حفظ التقدم', 'Save Progress')}</Button>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">{tr('تقدم الطبيب للقراءة فقط.', 'Doctor progress is read-only.')}</div>
                  )}

                  <div className="space-y-2">
                    <div className="text-sm font-medium">{tr('نتائج اليوم', 'Results Today')}</div>
                    {todayResults.length ? (
                      <div className="space-y-2">
                        {todayResults.map((r: any) => (
                          <div key={r.resultId} className="rounded-md border p-2 text-sm flex items-center justify-between">
                            <div>
                              <div className="font-medium">{r.summary || r.kind || 'Result'}</div>
                              <div className="text-xs text-muted-foreground">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'} • {r.severity}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!r.ackedByMe ? <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{tr('غير مراجع', 'Unreviewed')}</span> : <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('تمت المراجعة', 'Reviewed')}</span>}
                              {canDoctorTab ? (<Button size="sm" variant="outline" className="rounded-xl" disabled={r.ackedByMe} onClick={() => ackTodayResult(r.resultId)}>{r.ackedByMe ? tr('تم التأكيد', 'ACKed') : tr('تأكيد', 'ACK')}</Button>) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">{tr('لا توجد نتائج اليوم.', 'No results today.')}</div>
                    )}
                  </div>

                  {doctorProgressItems.length ? (
                    <div>
                      <div className="grid grid-cols-4 gap-4 px-4 py-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التاريخ', 'Date')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التقييم', 'Assessment')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الخطة', 'Plan')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التصرف', 'Disposition')}</span>
                      </div>
                      <div className="divide-y divide-border">
                        {doctorProgressItems.map((p: any) => (
                          <div key={p.id} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                            <span className="text-sm text-foreground">{p.date}</span>
                            <span className="text-sm text-foreground whitespace-pre-wrap">{p.assessment}</span>
                            <span className="text-sm text-foreground whitespace-pre-wrap">{p.planNext24h}</span>
                            <span className="text-sm text-foreground">{p.dispositionPlan || '—'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">{tr('لا توجد مدخلات تقدم الطبيب.', 'No doctor progress entries.')}</div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        ) : null}
        {canNurseTab ? (
          <TabsContent value="nursing">
            <div className="space-y-4">
              {/* My Shift */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{tr('مناوبتي', 'My Shift')}</h2>
                <p className="text-sm text-muted-foreground">{tr('المهام وجدول العلامات الحيوية وآخر تسليم', 'Tasks, vitals schedule, and last handover')}</p>
                <div className="space-y-4 text-sm">
                  <div className="space-y-2">
                    <div className="font-medium">{tr('العلامات الحيوية المجدولة (كل 4 ساعات)', 'Scheduled Vitals (q4h)')}</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {vitalSlots.map((slot) => (
                        <div key={slot.slotStart.toISOString()} className="flex items-center justify-between rounded-md border p-2">
                          <span>{slot.slotStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {slot.recorded ? <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">{tr('تم', 'Done')}</span> : <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('مستحق', 'Due')}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="font-medium">{tr('المهام المفتوحة', 'Open Tasks')}</div>
                    {openTasksForEncounter.length ? (
                      <div className="space-y-1">
                        {openTasksForEncounter.slice(0, 5).map((item: any) => (
                          <div key={item.task?.id || item.task?.title} className="flex items-center justify-between rounded-md border p-2">
                            <span>{item.task?.title || item.task?.type || 'Task'}</span>
                            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{item.task?.status || 'OPEN'}</span>
                          </div>
                        ))}
                        {openTasksForEncounter.length > 5 ? (<div className="text-xs text-muted-foreground">+{openTasksForEncounter.length - 5} {tr('المزيد', 'more')}</div>) : null}
                      </div>
                    ) : (<div className="text-sm text-muted-foreground">{tr('لا توجد مهام مفتوحة.', 'No open tasks.')}</div>)}
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">{tr('آخر تسليم', 'Last Handover')}</div>
                    <div className="text-muted-foreground">{lastHandover?.summary || tr('لا يوجد ملخص تسليم.', 'No handover summary available.')}</div>
                  </div>
                </div>
              </div>

              {/* Shift Note */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{tr('ملاحظة المناوبة', 'Shift Note')}</h2>
                <p className="text-sm text-muted-foreground">{tr('استثناءات فقط', 'Exceptions only')}</p>
                <div className="space-y-3">
                  {isNurse ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                        <label className="flex items-center gap-2"><Checkbox checked={shiftPainSpike} onCheckedChange={(v) => setShiftPainSpike(Boolean(v))} />{tr('نوبة ألم', 'Pain spike')}</label>
                        <label className="flex items-center gap-2"><Checkbox checked={shiftFall} onCheckedChange={(v) => setShiftFall(Boolean(v))} />{tr('سقوط', 'Fall')}</label>
                        <label className="flex items-center gap-2"><Checkbox checked={shiftRefusal} onCheckedChange={(v) => setShiftRefusal(Boolean(v))} />{tr('رفض', 'Refusal')}</label>
                      </div>
                      <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ملاحظة قصيرة (اختياري)', 'Short Note (optional)')}</span><Textarea className="rounded-xl thea-input-focus" value={shiftNote} onChange={(e) => setShiftNote(e.target.value)} /></div>
                      <Button className="rounded-xl" onClick={createShiftNote} disabled={actionsDisabled || creatingShiftNote}>{tr('حفظ ملاحظة المناوبة', 'Save Shift Note')}</Button>
                    </>
                  ) : (<div className="text-sm text-muted-foreground">{tr('ملاحظات المناوبة يسجلها التمريض فقط.', 'Shift notes can be recorded by nurses only.')}</div>)}
                </div>
              </div>

              {/* Nursing Vitals */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{tr('العلامات الحيوية التمريضية', 'Nursing Vitals')}</h2>
                <p className="text-sm text-muted-foreground">{tr('تسجيل العلامات الحيوية (إضافة فقط)', 'Append-only vitals recording')}</p>
                <div className="space-y-4">
                  {latestVitals?.critical ? (
                    <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                      {tr('علامات حيوية حرجة - يجب التصعيد', 'Critical vitals - escalate')}
                      {Array.isArray(latestVitals.criticalReasons) && latestVitals.criticalReasons.length ? (<div className="mt-1 text-xs">{latestVitals.criticalReasons.join(', ')}</div>) : null}
                    </div>
                  ) : null}
                  {isNurse ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ضغط انقباضي', 'BP Sys')}</span><Input className="rounded-xl thea-input-focus" value={systolic} onChange={(e) => setSystolic(e.target.value)} /></div>
                      <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ضغط انبساطي', 'BP Dia')}</span><Input className="rounded-xl thea-input-focus" value={diastolic} onChange={(e) => setDiastolic(e.target.value)} /></div>
                      <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نبض', 'HR')}</span><Input className="rounded-xl thea-input-focus" value={hr} onChange={(e) => setHr(e.target.value)} /></div>
                      <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('تنفس', 'RR')}</span><Input className="rounded-xl thea-input-focus" value={rr} onChange={(e) => setRr(e.target.value)} /></div>
                      <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('حرارة', 'Temp')}</span><Input className="rounded-xl thea-input-focus" value={temp} onChange={(e) => setTemp(e.target.value)} /></div>
                      <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('تشبع الأكسجين', 'SpO2')}</span><Input className="rounded-xl thea-input-focus" value={spo2} onChange={(e) => setSpo2(e.target.value)} /></div>
                      <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الألم (0-10)', 'Pain (0-10)')}</span><Input className="rounded-xl thea-input-focus" value={painScore} onChange={(e) => setPainScore(e.target.value)} /></div>
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('مستوى الوعي', 'AVPU')}</span>
                        <Select value={avpu} onValueChange={(value) => setAvpu(value)}>
                          <SelectTrigger className="rounded-xl"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                          <SelectContent><SelectItem value="A">A</SelectItem><SelectItem value="V">V</SelectItem><SelectItem value="P">P</SelectItem><SelectItem value="U">U</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-4"><Button className="rounded-xl" onClick={createVitals} disabled={actionsDisabled || savingVitals}>{tr('تسجيل العلامات الحيوية', 'Record Vitals')}</Button></div>
                    </div>
                  ) : (<div className="text-sm text-muted-foreground">{tr('العلامات الحيوية يسجلها التمريض فقط.', 'Vitals can be recorded by nurses only.')}</div>)}

                  {vitalsItems.length ? (
                    <div>
                      <div className="grid grid-cols-10 gap-4 px-4 py-2">
                        {[tr('وقت التسجيل','Recorded At'),tr('ضغط الدم','BP'),tr('النبض','HR'),tr('التنفس','RR'),tr('الحرارة','Temp'),tr('تشبع الأكسجين','SpO2'),tr('الألم','Pain'),tr('الوعي','AVPU'),tr('حرج','Critical'),tr('سجّله','Recorded By')].map(h => (
                          <span key={h} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</span>
                        ))}
                      </div>
                      <div className="divide-y divide-border">
                        {vitalsItems.map((v: any) => (
                          <div key={v.id} className="grid grid-cols-10 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                            <span className="text-sm text-foreground">{v.recordedAt ? new Date(v.recordedAt).toLocaleString() : '—'}</span>
                            <span className="text-sm text-foreground">{v?.vitals?.systolic ?? '—'}/{v?.vitals?.diastolic ?? '—'}</span>
                            <span className="text-sm text-foreground">{v?.vitals?.hr ?? '—'}</span>
                            <span className="text-sm text-foreground">{v?.vitals?.rr ?? '—'}</span>
                            <span className="text-sm text-foreground">{v?.vitals?.temp ?? '—'}</span>
                            <span className="text-sm text-foreground">{v?.vitals?.spo2 ?? '—'}</span>
                            <span className="text-sm text-foreground">{v?.painScore ?? '—'}</span>
                            <span className="text-sm text-foreground">{v?.avpu ?? '—'}</span>
                            <span className="text-sm text-foreground">{v?.critical ? tr('نعم', 'Yes') : tr('لا', 'No')}</span>
                            <span className="text-sm text-foreground">{v?.recordedByUserId || '—'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (<div className="text-sm text-muted-foreground">{tr('لا توجد علامات حيوية مسجلة.', 'No vitals recorded.')}</div>)}
                </div>
              </div>

              {/* Device Vitals (Connect) */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{tr('العلامات الحيوية من الأجهزة (Connect)', 'Device Vitals (Connect)')}</h2>
                <p className="text-sm text-muted-foreground">{tr('استيعاب العلامات الحيوية من الأجهزة (قراءة فقط)', 'Read-only device vitals ingestion')}</p>
                {connectVitalsItems.length ? (
                  <div>
                    <div className="grid grid-cols-7 gap-4 px-4 py-2">
                      {[tr('وقت الحدوث','Occurred At'),tr('النبض','HR'),tr('ضغط الدم','BP'),tr('التنفس','RR'),tr('الحرارة','Temp'),tr('تشبع الأكسجين','SpO2'),tr('المصدر','Source')].map(h => (<span key={h} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</span>))}
                    </div>
                    <div className="divide-y divide-border">
                      {connectVitalsItems.map((v: any) => (
                        <div key={v.id} className="grid grid-cols-7 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                          <span className="text-sm text-foreground">{v.occurredAt ? new Date(v.occurredAt).toLocaleString() : '—'}</span>
                          <span className="text-sm text-foreground">{v?.vitals?.hr ?? '—'}</span>
                          <span className="text-sm text-foreground">{v?.vitals?.bpSys ?? '—'}/{v?.vitals?.bpDia ?? '—'}</span>
                          <span className="text-sm text-foreground">{v?.vitals?.rr ?? '—'}</span>
                          <span className="text-sm text-foreground">{v?.vitals?.temp ?? '—'}</span>
                          <span className="text-sm text-foreground">{v?.vitals?.spo2 ?? '—'}</span>
                          <span className="text-xs text-muted-foreground">{v?.source?.system || 'CONNECT'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (<div className="text-sm text-muted-foreground">{tr('لا توجد علامات حيوية من الأجهزة.', 'No device vitals ingested.')}</div>)}
              </div>

              {/* Nursing Assessment */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{tr('تقييم التمريض v0.1', 'Nursing Assessment v0.1')}</h2>
                <p className="text-sm text-muted-foreground">{tr('قائمة مرجعية منظمة فقط', 'Structured checklist only')}</p>
                <div className="space-y-4">
                  {isNurse ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوعي', 'Consciousness')}</span>
                        <Select value={assessmentConsciousness} onValueChange={setAssessmentConsciousness}><SelectTrigger className="rounded-xl"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger><SelectContent><SelectItem value="ALERT">{tr('واعٍ', 'Alert')}</SelectItem><SelectItem value="DROWSY">{tr('نعسان', 'Drowsy')}</SelectItem><SelectItem value="UNRESPONSIVE">{tr('غير مستجيب', 'Unresponsive')}</SelectItem></SelectContent></Select>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحركة', 'Mobility')}</span>
                        <Select value={assessmentMobility} onValueChange={setAssessmentMobility}><SelectTrigger className="rounded-xl"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger><SelectContent><SelectItem value="INDEPENDENT">{tr('مستقل', 'Independent')}</SelectItem><SelectItem value="ASSISTED">{tr('بمساعدة', 'Assisted')}</SelectItem><SelectItem value="BEDBOUND">{tr('طريح الفراش', 'Bedbound')}</SelectItem></SelectContent></Select>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النظام الغذائي', 'Diet')}</span>
                        <Select value={assessmentDiet} onValueChange={setAssessmentDiet}><SelectTrigger className="rounded-xl"><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger><SelectContent><SelectItem value="NPO">{tr('صائم', 'NPO')}</SelectItem><SelectItem value="SOFT">{tr('طري', 'Soft')}</SelectItem><SelectItem value="REGULAR">{tr('عادي', 'Regular')}</SelectItem></SelectContent></Select>
                      </div>
                      <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <label className="flex items-center gap-2"><Checkbox checked={assessmentPainControlled} onCheckedChange={(v) => setAssessmentPainControlled(Boolean(v))} />{tr('الألم مسيطر عليه', 'Pain controlled')}</label>
                        <label className="flex items-center gap-2"><Checkbox checked={assessmentFallRisk} onCheckedChange={(v) => setAssessmentFallRisk(Boolean(v))} />{tr('خطر سقوط', 'Fall risk')}</label>
                        <label className="flex items-center gap-2"><Checkbox checked={assessmentPressureRisk} onCheckedChange={(v) => setAssessmentPressureRisk(Boolean(v))} />{tr('خطر قرحة الضغط', 'Pressure ulcer risk')}</label>
                        <label className="flex items-center gap-2"><Checkbox checked={assessmentIvLine} onCheckedChange={(v) => setAssessmentIvLine(Boolean(v))} />{tr('خط وريدي', 'IV line')}</label>
                        <label className="flex items-center gap-2"><Checkbox checked={assessmentOxygen} onCheckedChange={(v) => setAssessmentOxygen(Boolean(v))} />{tr('علاج بالأكسجين', 'Oxygen therapy')}</label>
                      </div>
                      <div className="md:col-span-3"><Button className="rounded-xl" onClick={createAssessment} disabled={actionsDisabled || assessmentBusy}>{tr('تسجيل التقييم', 'Record Assessment')}</Button></div>
                    </div>
                  ) : (<div className="text-sm text-muted-foreground">{tr('التقييمات يسجلها التمريض فقط.', 'Assessments can be recorded by nurses only.')}</div>)}

                  {nursingAssessments.length ? (
                    <div>
                      <div className="grid grid-cols-6 gap-4 px-4 py-2">
                        {[tr('وقت التسجيل','Recorded At'),tr('الوعي','Consciousness'),tr('الحركة','Mobility'),tr('النظام الغذائي','Diet'),tr('العلامات','Flags'),tr('سجّله','Recorded By')].map(h => (<span key={h} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</span>))}
                      </div>
                      <div className="divide-y divide-border">
                        {nursingAssessments.map((a: any) => (
                          <div key={a.id} className="grid grid-cols-6 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                            <span className="text-sm text-foreground">{a.createdAt ? new Date(a.createdAt).toLocaleString() : '—'}</span>
                            <span className="text-sm text-foreground">{a.assessment?.consciousness || '—'}</span>
                            <span className="text-sm text-foreground">{a.assessment?.mobility || '—'}</span>
                            <span className="text-sm text-foreground">{a.assessment?.diet || '—'}</span>
                            <span className="text-xs text-muted-foreground">{a.assessment?.painControlled ? tr('ألم مسيطر', 'Pain OK') : tr('ألم؟', 'Pain ?')} • {a.assessment?.fallRisk ? tr('خطر سقوط', 'Fall risk') : tr('لا خطر سقوط', 'No fall risk')} • {a.assessment?.pressureUlcerRisk ? tr('خطر قرحة', 'Pressure risk') : tr('لا خطر قرحة', 'No pressure risk')} • {a.assessment?.ivLine ? tr('خط وريدي', 'IV line') : tr('لا وريدي', 'No IV')} • {a.assessment?.oxygenTherapy ? tr('أكسجين', 'Oxygen') : tr('لا أكسجين', 'No oxygen')}</span>
                            <span className="text-sm text-foreground">{a.createdByUserId || '—'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (<div className="text-sm text-muted-foreground">{tr('لا توجد تقييمات مسجلة.', 'No assessments recorded.')}</div>)}
                </div>
              </div>

              {/* Nursing Notes */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{tr('ملاحظات التمريض', 'Nursing Notes')}</h2>
                <p className="text-sm text-muted-foreground">{tr('ملاحظات المناوبة/التقدم (إضافة فقط)', 'Append-only shift/progress notes')}</p>
                <div className="space-y-4">
                  {isNurse ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النوع', 'Type')}</span>
                          <Select value={noteType} onValueChange={(value) => setNoteType(value as 'SHIFT' | 'PROGRESS')}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SHIFT">{tr('مناوبة', 'Shift')}</SelectItem><SelectItem value="PROGRESS">{tr('تقدم', 'Progress')}</SelectItem></SelectContent></Select>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المحتوى', 'Content')}</span>
                          <Textarea className="rounded-xl thea-input-focus" value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder={tr('اكتب ملاحظة', 'Write note')} />
                        </div>
                      </div>
                      <Button className="rounded-xl" onClick={createNursingNote} disabled={actionsDisabled || savingNote}>{tr('إضافة ملاحظة', 'Add Note')}</Button>
                    </div>
                  ) : (<div className="text-sm text-muted-foreground">{tr('الملاحظات يضيفها التمريض فقط.', 'Notes can be created by nurses only.')}</div>)}

                  {nursingNotes.length ? (
                    <div>
                      <div className="grid grid-cols-4 gap-4 px-4 py-2">
                        {[tr('تاريخ الإنشاء','Created At'),tr('النوع','Type'),tr('المحتوى','Content'),tr('أنشأه','Created By')].map(h => (<span key={h} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</span>))}
                      </div>
                      <div className="divide-y divide-border">
                        {nursingNotes.map((n: any) => (
                          <div key={n.id} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                            <span className="text-sm text-foreground">{n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}</span>
                            <span className="text-sm text-foreground">{n.type}</span>
                            <span className="text-sm text-foreground whitespace-pre-wrap">{n.content}</span>
                            <span className="text-sm text-foreground">{n.createdByUserId || '—'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (<div className="text-sm text-muted-foreground">{tr('لا توجد ملاحظات تمريض.', 'No nursing notes.')}</div>)}
                </div>
              </div>

              {/* Daily Nursing Progress */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{tr('تقدم التمريض اليومي', 'Daily Nursing Progress')}</h2>
                <p className="text-sm text-muted-foreground">{tr('إدخال واحد لكل ممرض/ة يومياً', 'One entry per nurse per day')}</p>
                <div className="space-y-4">
                  {canCreateNursingProgress ? (
                    <div className="space-y-3">
                      <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاستجابة لخطة الرعاية', 'Response to Care Plan')}</span><Textarea className="rounded-xl thea-input-focus" value={nursingResponseCarePlan} onChange={(e) => setNursingResponseCarePlan(e.target.value)} /></div>
                      <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ملخص العلامات الحيوية', 'Vitals Summary')}</span><Textarea className="rounded-xl thea-input-focus" value={nursingVitalsSummary} onChange={(e) => setNursingVitalsSummary(e.target.value)} /></div>
                      <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المشاكل', 'Issues')}</span><Textarea className="rounded-xl thea-input-focus" value={nursingIssues} onChange={(e) => setNursingIssues(e.target.value)} /></div>
                      <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التصعيدات', 'Escalations')}</span><Textarea className="rounded-xl thea-input-focus" value={nursingEscalations} onChange={(e) => setNursingEscalations(e.target.value)} /></div>
                      <Button className="rounded-xl" onClick={createNursingProgress} disabled={actionsDisabled || creatingNursingProgress || nursingSubmittedToday}>{nursingSubmittedToday ? tr('تم التقديم اليوم', 'Submitted Today') : tr('إضافة تقدم', 'Add Progress')}</Button>
                    </div>
                  ) : (<div className="text-sm text-muted-foreground">{tr('تقدم التمريض للقراءة فقط.', 'Nursing progress is read-only.')}</div>)}

                  {nursingProgressItems.length ? (
                    <div>
                      <div className="grid grid-cols-5 gap-4 px-4 py-2">
                        {[tr('التاريخ','Date'),tr('الاستجابة','Response'),tr('العلامات الحيوية','Vitals'),tr('المشاكل','Issues'),tr('التصعيدات','Escalations')].map(h => (<span key={h} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</span>))}
                      </div>
                      <div className="divide-y divide-border">
                        {nursingProgressItems.map((p: any) => (
                          <div key={p.id} className="grid grid-cols-5 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                            <span className="text-sm text-foreground">{p.date}</span>
                            <span className="text-sm text-foreground whitespace-pre-wrap">{p.responseToCarePlan}</span>
                            <span className="text-sm text-foreground whitespace-pre-wrap">{p.vitalsSummary}</span>
                            <span className="text-sm text-foreground whitespace-pre-wrap">{p.issues}</span>
                            <span className="text-sm text-foreground whitespace-pre-wrap">{p.escalations}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (<div className="text-sm text-muted-foreground">{tr('لا توجد مدخلات تقدم التمريض.', 'No nursing progress entries.')}</div>)}
                </div>
              </div>
            </div>
          </TabsContent>
        ) : null}

        {canNurseTab ? (
          <TabsContent value="emar">
            <div className="space-y-4">
              {/* Narcotic Shift Count */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{tr('عدّ المخدرات بالمناوبة', 'Narcotic Shift Count')}</h2>
                <p className="text-sm text-muted-foreground">{tr('تسجيل العدّ في بداية/نهاية المناوبة', 'Record start/end shift counts')}</p>
                <div className="space-y-4">
                  {isNurse ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المناوبة', 'Shift')}</span>
                        <Select value={narcoticShift} onValueChange={(value) => setNarcoticShift(value as 'START' | 'END')}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="START">{tr('بداية', 'Start')}</SelectItem><SelectItem value="END">{tr('نهاية', 'End')}</SelectItem></SelectContent></Select>
                      </div>
                      <div className="space-y-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('العدد', 'Count')}</span><Input className="rounded-xl thea-input-focus" value={narcoticCount} onChange={(e) => setNarcoticCount(e.target.value)} placeholder={tr('أرقام فقط', 'Number only')} /></div>
                      <div className="space-y-1 md:pt-6"><Button className="rounded-xl" onClick={submitNarcoticCount} disabled={actionsDisabled || savingNarcoticCount}>{tr('تسجيل العدد', 'Record Count')}</Button></div>
                    </div>
                  ) : (<div className="text-sm text-muted-foreground">{tr('عدّ المناوبة يسجّله التمريض فقط.', 'Shift counts can be recorded by nurses only.')}</div>)}

                  {narcoticCounts.length ? (
                    <div>
                      <div className="grid grid-cols-4 gap-4 px-4 py-2">
                        {[tr('الوقت','When'),tr('المناوبة','Shift'),tr('العدد','Count'),tr('سجّله','Recorded By')].map(h => (<span key={h} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</span>))}
                      </div>
                      <div className="divide-y divide-border">
                        {narcoticCounts.map((c: any) => (
                          <div key={c.id} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                            <span className="text-sm text-foreground">{c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}</span>
                            <span className="text-sm text-foreground">{c?.metadata?.shift || '—'}</span>
                            <span className="text-sm text-foreground">{c?.metadata?.count ?? '—'}</span>
                            <span className="text-sm text-foreground">{c?.author?.name || c?.createdByUserId || '—'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (<div className="text-sm text-muted-foreground">{tr('لا توجد أعداد مناوبة مسجلة.', 'No shift counts recorded.')}</div>)}
                </div>
              </div>

              {/* eMAR */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{tr('سجل إعطاء الأدوية', 'eMAR')}</h2>
                <p className="text-sm text-muted-foreground">{tr('إعطاء الأدوية حسب الأمر', 'Medication administration by order')}</p>
                <div className="space-y-6">
                  {medOrders.length ? (
                    medOrders.map((m: any) => {
                      const dueItems = marDueByOrder[m.id] || [];
                      const prnItems = marPrnByOrder[m.id] || [];
                      const historyItems = marHistoryByOrder[m.id] || [];
                      return (
                        <div key={m.id} className="rounded-2xl bg-card border border-border p-6 space-y-4">
                          <h2 className="text-lg font-semibold text-foreground text-base">{m.drugName}</h2>
                          <p className="text-sm text-muted-foreground">{m.dose} {m.doseUnit} · {m.route} · {m.type}{m.schedule ? ` · ${m.schedule}` : ''}{m.isNarcotic ? ` · ${tr('مخدر', 'Narcotic')}` : ''}</p>
                          <div className="space-y-4">
                            {dueItems.length ? (
                              <div>
                                <div className="grid grid-cols-3 gap-4 px-4 py-2">
                                  {[tr('الموعد المجدول','Scheduled For'),tr('الحالة','Status'),tr('الإجراءات','Actions')].map(h => (<span key={h} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</span>))}
                                </div>
                                <div className="divide-y divide-border">
                                  {dueItems.map((d: any) => (
                                    <div key={`${d.orderId}-${String(d.scheduledFor)}`} className="grid grid-cols-3 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                                      <span className="text-sm text-foreground">{new Date(d.scheduledFor).toLocaleString()}</span>
                                      <span className="text-sm text-foreground">
                                        {d.overdue ? <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{tr('متأخر', 'Overdue')}</span> : <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('مستحق', 'Due')}</span>}
                                      </span>
                                      <span className="text-sm text-foreground space-x-2">
                                        {canMar ? (
                                          <>
                                            <Button size="sm" className="rounded-xl" onClick={() => startMarAction(d.orderId, new Date(d.scheduledFor).toISOString(), 'GIVEN')} disabled={actionsDisabled || actionBusyId === d.orderId}>{tr('إعطاء', 'Give')}</Button>
                                            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => startMarAction(d.orderId, new Date(d.scheduledFor).toISOString(), 'HELD')} disabled={actionsDisabled || actionBusyId === d.orderId}>{tr('تأجيل', 'Held')}</Button>
                                            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => startMarAction(d.orderId, new Date(d.scheduledFor).toISOString(), 'MISSED')} disabled={actionsDisabled || actionBusyId === d.orderId}>{tr('فائت', 'Missed')}</Button>
                                          </>
                                        ) : (<div className="text-xs text-muted-foreground">{tr('مقيّد', 'Restricted')}</div>)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (<div className="text-sm text-muted-foreground">{tr('لا توجد جرعات مجدولة مستحقة.', 'No scheduled doses due.')}</div>)}

                            {prnItems.length ? (
                              <div>
                                <div className="grid grid-cols-3 gap-4 px-4 py-2">
                                  {[tr('عند الحاجة','PRN'),tr('الحد/24 ساعة','Max/24h'),tr('الإجراءات','Actions')].map(h => (<span key={h} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</span>))}
                                </div>
                                <div className="divide-y divide-border">
                                  {prnItems.map((p: any) => (
                                    <div key={`${p.orderId}-prn`} className="grid grid-cols-3 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                                      <span className="text-sm text-foreground">{tr('عند الحاجة', 'PRN')}</span>
                                      <span className="text-sm text-foreground">{p.prnMaxPer24h ?? '—'}</span>
                                      <span className="text-sm text-foreground space-x-2">
                                        {canMar ? (
                                          <>
                                            <Button size="sm" className="rounded-xl" onClick={() => startMarAction(p.orderId, new Date().toISOString(), 'GIVEN')} disabled={actionsDisabled || actionBusyId === p.orderId}>{tr('إعطاء', 'Give')}</Button>
                                            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => startMarAction(p.orderId, new Date().toISOString(), 'HELD')} disabled={actionsDisabled || actionBusyId === p.orderId}>{tr('تأجيل', 'Held')}</Button>
                                            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => startMarAction(p.orderId, new Date().toISOString(), 'MISSED')} disabled={actionsDisabled || actionBusyId === p.orderId}>{tr('فائت', 'Missed')}</Button>
                                          </>
                                        ) : (<div className="text-xs text-muted-foreground">{tr('مقيّد', 'Restricted')}</div>)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {historyItems.length ? (
                              <div>
                                <div className="grid grid-cols-4 gap-4 px-4 py-2">
                                  {[tr('الوقت','When'),tr('الحالة','Status'),tr('الجرعة','Dose'),tr('السبب','Reason')].map(h => (<span key={h} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</span>))}
                                </div>
                                <div className="divide-y divide-border">
                                  {historyItems.map((h: any) => (
                                    <div key={h.id} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                                      <span className="text-sm text-foreground">{new Date(h.performedAt).toLocaleString()}</span>
                                      <span className="text-sm text-foreground">{h.action}</span>
                                      <span className="text-sm text-foreground">{h.doseGiven || '—'}</span>
                                      <span className="text-xs text-muted-foreground">{h.reason || '—'}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (<div className="text-sm text-muted-foreground">{tr('لا توجد عمليات إعطاء بعد.', 'No administrations yet.')}</div>)}
                          </div>
                        </div>
                      );
                    })
                  ) : (<div className="text-sm text-muted-foreground">{tr('لا توجد أوامر أدوية متاحة.', 'No medication orders available.')}</div>)}
                </div>
              </div>
            </div>
          </TabsContent>
        ) : null}

        {canPharmacyTab ? (
          <TabsContent value="pharmacy">
            <div className="space-y-4">
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{tr('طابور صرف المخدرات', 'Narcotics Dispense Queue')}</h2>
                <p className="text-sm text-muted-foreground">{tr('أوامر بانتظار تأكيد الصرف', 'Orders awaiting dispense confirmation')}</p>
                <div className="space-y-4">
                  {canVerifyPharmacy ? (
                    pharmacyQueue.length ? (
                      <div>
                        <div className="grid grid-cols-5 gap-4 px-4 py-2">
                          {[tr('الدواء','Medication'),tr('الطريق','Route'),tr('النوع','Type'),tr('التحذيرات','Warnings'),tr('الإجراءات','Actions')].map(h => (<span key={h} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</span>))}
                        </div>
                        <div className="divide-y divide-border">
                          {pharmacyQueue.map((m: any) => (
                            <div key={m.id} className="grid grid-cols-5 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                              <span className="text-sm text-foreground">{m.drugName}</span>
                              <span className="text-sm text-foreground">{m.route}</span>
                              <span className="text-sm text-foreground">{m.type}</span>
                              <span className="text-sm text-foreground">
                                {m.duplicateWarning ? <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('مكرر', 'Duplicate')}</span> : null}
                                {m.allergyConflict ? <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive ml-2">{tr('حساسية', 'Allergy')}</span> : null}
                                {m.highRisk ? <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground ml-2">{tr('خطورة عالية', 'High Risk')}</span> : null}
                                {m.overdueDoseCount > 0 ? <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive ml-2">{tr('متأخر', 'Overdue')} x{m.overdueDoseCount}</span> : null}
                                {Array.isArray(m.allergies) && m.allergies.length ? (<div className="text-xs text-muted-foreground mt-1">{m.allergies.join(', ')}</div>) : null}
                              </span>
                              <span className="text-sm text-foreground space-x-2"><Button size="sm" className="rounded-xl" onClick={() => verifyOrder(m.id)} disabled={verifyBusyId === m.id}>{tr('صرف', 'Dispense')}</Button></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (<div className="text-sm text-muted-foreground">{tr('لا توجد مخدرات بانتظار الصرف.', 'No narcotics awaiting dispense.')}</div>)
                  ) : (<div className="text-sm text-muted-foreground">{tr('طابور الصيدلية مقيّد.', 'Pharmacy queue is restricted.')}</div>)}
                </div>
              </div>

              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{tr('أوامر الأدوية', 'Medication Orders')}</h2>
                <p className="text-sm text-muted-foreground">{tr('قائمة للقراءة فقط', 'Read-only list')}</p>
                {medOrders.length ? (
                  <div>
                    <div className="grid grid-cols-6 gap-4 px-4 py-2">
                      {[tr('الدواء','Medication'),tr('الجرعة','Dose'),tr('الطريق','Route'),tr('النوع','Type'),tr('الجدول','Schedule'),tr('الحالة','Status')].map(h => (<span key={h} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</span>))}
                    </div>
                    <div className="divide-y divide-border">
                      {medOrders.map((m: any) => (
                        <div key={m.id} className="grid grid-cols-6 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                          <span className="text-sm text-foreground">
                            <div className="font-medium">{m.drugName}</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {m.allergyConflict ? <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{tr('حساسية', 'Allergy')}</span> : null}
                              {m.highRisk ? <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('خطورة عالية', 'High Risk')}</span> : null}
                              {m.duplicateWarning ? <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('مكرر', 'Duplicate')}</span> : null}
                              {m.overdueDoseCount > 0 ? <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{tr('متأخر', 'Overdue')} x{m.overdueDoseCount}</span> : null}
                            </div>
                          </span>
                          <span className="text-sm text-foreground">{m.dose} {m.doseUnit}</span>
                          <span className="text-sm text-foreground">{m.route}</span>
                          <span className="text-sm text-foreground">{m.type}</span>
                          <span className="text-sm text-foreground">{m.schedule || '—'}</span>
                          <span className="text-sm text-foreground"><span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{m.currentStatus || m.status || 'DRAFT'}</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (<div className="text-sm text-muted-foreground">{tr('لا توجد أوامر أدوية.', 'No medication orders.')}</div>)}
              </div>
            </div>
          </TabsContent>
        ) : null}

        {canTimelineTab ? (
          <TabsContent value="timeline">
            <div className="space-y-4">
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{tr('الجدول الزمني للأدوية', 'Medication Timeline')}</h2>
                <p className="text-sm text-muted-foreground">{tr('سجل الأدوية (قراءة فقط)', 'Read-only medication history')}</p>
                {medTimeline.length ? (
                  <div>
                    <div className="grid grid-cols-4 gap-4 px-4 py-2">
                      {[tr('الوقت','Time'),tr('الحدث','Event'),tr('التفاصيل','Details'),tr('المنفذ','Actor')].map(h => (<span key={h} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</span>))}
                    </div>
                    <div className="divide-y divide-border">
                      {medTimeline.map((item: any, idx: number) => (
                        <div key={`${item.time}-${item.type}-${idx}`} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                          <span className="text-sm text-foreground">{item.time ? new Date(item.time).toLocaleString() : '—'}</span>
                          <span className="text-sm text-foreground">
                            <div className="font-medium">{item.label || item.type}</div>
                            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground mt-1">{item.type}</span>
                          </span>
                          <span className="text-xs text-muted-foreground whitespace-pre-wrap">{item.details || '—'}</span>
                          <span className="text-sm text-foreground">{item.actorDisplay || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (<div className="text-sm text-muted-foreground">{tr('لا توجد مدخلات في الجدول الزمني للأدوية.', 'No medication timeline entries.')}</div>)}
              </div>
            </div>
          </TabsContent>
        ) : null}

        {canReconTab ? (
          <TabsContent value="recon">
            <div className="space-y-4">
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{tr('مطابقة القبول', 'Admission Reconciliation')}</h2>
                <p className="text-sm text-muted-foreground">{tr('أدوية المنزل والقرارات عند القبول', 'Home meds and decisions at admission')}</p>
                <div className="space-y-4">
                  {reconAdmission ? (
                    <div className="rounded-md border p-3 text-sm text-muted-foreground">
                      <div className="font-medium text-foreground">{tr('آخر سجل', 'Latest record')}</div>
                      <div>{tr('مكتمل:', 'Completed:')} {reconAdmission.completedAt ? new Date(reconAdmission.completedAt).toLocaleString() : '—'}</div>
                      <div>{tr('العناصر:', 'Items:')} {Array.isArray(reconAdmission.items) ? reconAdmission.items.length : 0}</div>
                    </div>
                  ) : null}
                  {savingAdmissionRec ? (<div className="text-xs text-muted-foreground">{tr('جاري حفظ المطابقة...', 'Saving reconciliation...')}</div>) : null}
                  <MedReconciliation
                    patientId={patientMasterId}
                    encounterId={encounterCoreId}
                    type="admission"
                    homeMedications={homeMedications as HomeMedication[]}
                    hospitalMedications={medOrders}
                    patientAllergies={Array.isArray(patient?.allergies) ? patient.allergies : []}
                    onComplete={saveAdmissionReconciliation}
                    onCancel={() => null}
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{tr('مطابقة الخروج', 'Discharge Reconciliation')}</h2>
                <p className="text-sm text-muted-foreground">{tr('اعتماد قرارات أدوية المنزل عند الخروج', 'Finalize home meds decisions at discharge')}</p>
                <div className="space-y-4">
                  {reconDischarge ? (
                    <div className="rounded-md border p-3 text-sm text-muted-foreground">
                      <div className="font-medium text-foreground">{tr('آخر سجل', 'Latest record')}</div>
                      <div>{tr('مكتمل:', 'Completed:')} {reconDischarge.completedAt ? new Date(reconDischarge.completedAt).toLocaleString() : '—'}</div>
                      <div>{tr('العناصر:', 'Items:')} {Array.isArray(reconDischarge.items) ? reconDischarge.items.length : 0}</div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">{tr('استخدم سير عمل الخروج لإكمال مطابقة أدوية الخروج.', 'Use the discharge workflow to complete discharge medication reconciliation.')}</div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        ) : null}
      {/* Cancel Order Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('إلغاء الأمر', 'Cancel Order')}</DialogTitle>
            <DialogDescription>{tr('يرجى تقديم سبب مطلوب للإلغاء.', 'Provide a required reason for cancellation.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('سبب الإلغاء', 'Cancel Reason')}</span>
            <Textarea className="rounded-xl thea-input-focus" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder={tr('أدخل السبب', 'Enter reason')} />
            {cancelError ? <div className="text-sm text-destructive">{cancelError}</div> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setCancelDialogOpen(false)}>{tr('رجوع', 'Back')}</Button>
            <Button className="rounded-xl" onClick={confirmCancel} disabled={actionsDisabled || !cancelReason.trim()}>{tr('تأكيد الإلغاء', 'Confirm Cancel')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MAR Dialog */}
      <Dialog open={marDialogOpen} onOpenChange={setMarDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{marAction === 'GIVEN' ? tr('إعطاء الدواء', 'Give Medication') : marAction === 'HELD' ? tr('تأجيل الدواء', 'Hold Medication') : tr('جرعة فائتة', 'Missed Dose')}</DialogTitle>
            <DialogDescription>{tr('أكمل الحقول المطلوبة قبل التأكيد.', 'Complete the required fields before confirming.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {marAction === 'GIVEN' ? (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الجرعة المعطاة', 'Dose Given')}</span>
                <Input className="rounded-xl thea-input-focus" value={marDoseGiven} onChange={(e) => setMarDoseGiven(e.target.value)} placeholder={tr('مثال: 500 ملغ', 'e.g., 500 mg')} />
              </div>
            ) : null}
            {(marAction === 'HELD' || marAction === 'MISSED') ? (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السبب', 'Reason')}</span>
                <Textarea className="rounded-xl thea-input-focus" value={marReason} onChange={(e) => setMarReason(e.target.value)} placeholder={tr('أدخل السبب', 'Enter reason')} />
              </div>
            ) : null}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ملاحظات (اختياري)', 'Notes (optional)')}</span>
              <Textarea className="rounded-xl thea-input-focus" value={marNotes} onChange={(e) => setMarNotes(e.target.value)} placeholder={tr('ملاحظة اختيارية', 'Optional note')} />
            </div>
            {marError ? <div className="text-sm text-destructive">{marError}</div> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setMarDialogOpen(false)}>{tr('رجوع', 'Back')}</Button>
            <Button className="rounded-xl" onClick={confirmMarAction} disabled={actionsDisabled}>{tr('تأكيد', 'Confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discontinue Dialog */}
      <Dialog open={discontinueDialogOpen} onOpenChange={setDiscontinueDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('إيقاف الأمر', 'Discontinue Order')}</DialogTitle>
            <DialogDescription>{tr('يرجى تقديم سبب مطلوب.', 'Provide a required reason.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السبب', 'Reason')}</span>
            <Textarea className="rounded-xl thea-input-focus" value={discontinueReason} onChange={(e) => setDiscontinueReason(e.target.value)} placeholder={tr('أدخل السبب', 'Enter reason')} />
            {discontinueError ? <div className="text-sm text-destructive">{discontinueError}</div> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDiscontinueDialogOpen(false)}>{tr('رجوع', 'Back')}</Button>
            <Button className="rounded-xl" onClick={confirmDiscontinue} disabled={actionsDisabled || !discontinueReason.trim()}>{tr('تأكيد', 'Confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clinical Note Dialog */}
      <Dialog open={clinicalOpen} onOpenChange={setClinicalOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('إضافة ملاحظة سريرية', 'Add Clinical Note')}</DialogTitle>
            <DialogDescription>{tr('ملاحظة للإضافة فقط لحلقة التنويم.', 'Append-only note for IPD episode.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('العنوان (اختياري)', 'Title (optional)')}</span>
              <Input className="rounded-xl thea-input-focus" value={clinicalTitle} onChange={(e) => setClinicalTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المحتوى', 'Content')}</span>
              <Textarea className="rounded-xl thea-input-focus" value={clinicalContent} onChange={(e) => setClinicalContent(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setClinicalOpen(false)}>{tr('إلغاء', 'Cancel')}</Button>
            <Button className="rounded-xl" onClick={addClinicalNote} disabled={clinicalBusy || !clinicalContent.trim()}>{clinicalBusy ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ الملاحظة', 'Save Note')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Death Declare Dialog */}
      <Dialog open={deathDeclareOpen} onOpenChange={setDeathDeclareOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('إعلان الوفاة', 'Declare Death')}</DialogTitle>
            <DialogDescription>{tr('إعلان للإضافة فقط.', 'Append-only declaration.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('تاريخ/وقت الوفاة', 'Death Date/Time')}</span>
              <Input className="rounded-xl thea-input-focus" value={deathDateTime} onChange={(e) => setDeathDateTime(e.target.value)} placeholder="YYYY-MM-DD HH:mm" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('مكان الوفاة', 'Place of Death')}</span>
              <Select value={deathPlace} onValueChange={(value) => setDeathPlace(value as (typeof DEATH_PLACES)[number])}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder={tr('المكان', 'Place')} /></SelectTrigger>
                <SelectContent>{DEATH_PLACES.map((option) => (<SelectItem key={option} value={option}>{option}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السبب المبدئي', 'Preliminary Cause')}</span>
              <Textarea className="rounded-xl thea-input-focus" value={deathCause} onChange={(e) => setDeathCause(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ملاحظات', 'Notes')}</span>
              <Textarea className="rounded-xl thea-input-focus" value={deathNotes} onChange={(e) => setDeathNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDeathDeclareOpen(false)}>{tr('إلغاء', 'Cancel')}</Button>
            <Button className="rounded-xl" onClick={declareDeath} disabled={deathBusy}>{deathBusy ? tr('جاري الحفظ...', 'Saving...') : tr('إعلان', 'Declare')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Death Finalize Dialog */}
      <Dialog open={deathFinalizeOpen} onOpenChange={setDeathFinalizeOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('اعتماد الوفاة', 'Finalize Death')}</DialogTitle>
            <DialogDescription>{tr('ينشئ حالة مشرحة ويغلق الزيارة.', 'Creates mortuary case and closes encounter.')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDeathFinalizeOpen(false)}>{tr('إلغاء', 'Cancel')}</Button>
            <Button className="rounded-xl" onClick={finalizeDeath} disabled={deathBusy}>{deathBusy ? tr('جاري الحفظ...', 'Saving...') : tr('اعتماد', 'Finalize')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discharge Dialog */}
      <Dialog open={dischargeOpen} onOpenChange={setDischargeOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('اعتماد الخروج', 'Finalize Discharge')}</DialogTitle>
            <DialogDescription>{tr('ملخص الخروج (إضافة فقط).', 'Append-only discharge summary.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التصرف', 'Disposition')}</span>
              <Select value={dischargeDisposition} onValueChange={(value) => setDischargeDisposition(value as (typeof DISPOSITION_OPTIONS)[number])}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder={tr('التصرف', 'Disposition')} /></SelectTrigger>
                <SelectContent>{DISPOSITION_OPTIONS.map((option) => (<SelectItem key={option} value={option}>{option}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الملخص', 'Summary')}</span>
              <Textarea className="rounded-xl thea-input-focus" value={dischargeSummaryText} onChange={(e) => setDischargeSummaryText(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDischargeOpen(false)}>{tr('إلغاء', 'Cancel')}</Button>
            <Button className="rounded-xl" onClick={finalizeDischarge} disabled={dischargeBusy}>{dischargeBusy ? tr('جاري الحفظ...', 'Saving...') : tr('اعتماد', 'Finalize')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </Tabs>
    </div>
  );
}
