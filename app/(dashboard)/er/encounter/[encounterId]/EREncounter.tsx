'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useLang } from '@/hooks/use-lang';
import { useMe } from '@/lib/hooks/useMe';
import { deriveErRole } from '@/lib/er/role';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import useSWR from 'swr';
import { ER_ORDER_SETS } from '@/lib/er/orderSets';
import { compileErSmartNote } from '@/lib/er/smartNote';
import { useToast } from '@/hooks/use-toast';
import type {
  ErEncounterData,
  ErDisposition,
  ErTimelineEntry,
  ErAdmitUnit,
  ErAdmitRoom,
  ErAdmitOptionsResponse,
  ErAcceptingPhysician,
  ErOrderTask,
  ErResultItem,
  ErResultsResponse,
  ErAttachmentItem,
  ErNursingNote,
  ErDoctorNote,
  ErClinicalNote,
  ErHandover,
  ErTransferRequest,
  ErEscalation,
  ErEscalationsResponse,
  ErNursingUser,
  ErDischargeData,
  ErDeathStatusData,
  ErDeathDeclaration,
  ErMortuaryCase,
  ErIpdEpisodeData,
  ErListResponse,
  ErStaffAssignment,
  ErDischargeRecord,
} from '@/lib/cvision/types';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OrderSetsPanel } from '@/components/orders/OrderSetsPanel';
import { TasksPanel } from '@/components/tasks/TasksPanel';
import { HandoverPanel } from '@/components/handover/HandoverPanel';
import { ErPageShell } from '@/components/er/ErPageShell';
import { ErStatusPill } from '@/components/er/ErStatusPill';
import { ErLiveTimer } from '@/components/er/ErLiveTimer';

const TABS = ['overview', 'notes', 'clinical', 'orders', 'results', 'tasks', 'handover', 'nursing', 'disposition'] as const;
type TabKey = (typeof TABS)[number];

export default function EREncounter() {
  const router = useRouter();
  const params = useParams();
  const encounterId = String(params.encounterId || '');
  const { isRTL, language } = useLang();
  const { hasPermission, isLoading } = useRoutePermission('/er/encounter');
  const { me } = useMe();
  const { toast } = useToast();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const permissions = me?.user?.permissions || [];
  const role = deriveErRole(permissions);
  const roleValue: string = String(role || '').toLowerCase();

  const [tab, setTab] = useState<TabKey>('overview');
  const [encounter, setEncounter] = useState<ErEncounterData | null>(null);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [assessmentPlan, setAssessmentPlan] = useState('');
  const [timeline, setTimeline] = useState<ErTimelineEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [disposition, setDisposition] = useState<ErDisposition | null>(null);
  const [dispositionSaving, setDispositionSaving] = useState(false);
  const [dispositionError, setDispositionError] = useState<string | null>(null);
  const [dispositionValidation, setDispositionValidation] = useState<{ isValid: boolean; missing: string[] } | null>(null);
  const dispositionTimeout = useRef<NodeJS.Timeout | null>(null);
  const dispositionEditSeq = useRef(0);
  const noteTimeout = useRef<NodeJS.Timeout | null>(null);
  const [dischargeOpen, setDischargeOpen] = useState(false);
  const [dischargeDisposition, setDischargeDisposition] = useState<(typeof DISPOSITION_OPTIONS)[number]>('HOME');
  const [dischargeSummaryText, setDischargeSummaryText] = useState('');
  const [dischargeBusy, setDischargeBusy] = useState(false);
  const [deathDeclareOpen, setDeathDeclareOpen] = useState(false);
  const [deathFinalizeOpen, setDeathFinalizeOpen] = useState(false);
  const [deathDateTime, setDeathDateTime] = useState('');
  const [deathPlace, setDeathPlace] = useState<'ER' | 'IPD' | 'OPD' | 'OTHER'>('ER');
  const [deathCause, setDeathCause] = useState('');
  const [deathNotes, setDeathNotes] = useState('');
  const [deathBusy, setDeathBusy] = useState(false);
  const [clinicalOpen, setClinicalOpen] = useState(false);
  const [clinicalTitle, setClinicalTitle] = useState('');
  const [clinicalContent, setClinicalContent] = useState('');
  const [clinicalBusy, setClinicalBusy] = useState(false);
  const [admitOpen, setAdmitOpen] = useState(false);
  const [admitServiceUnit, setAdmitServiceUnit] = useState('');
  const [admitDoctorId, setAdmitDoctorId] = useState('');
  const [admitBedClass, setAdmitBedClass] = useState('');
  const [admitNotes, setAdmitNotes] = useState('');
  const [admitBusy, setAdmitBusy] = useState(false);
  const [pendingFinalizeStatus, setPendingFinalizeStatus] = useState<null | 'ADMITTED'>(null);

  const SMART_NOTE_START = '---- SMART NOTE v0.1 START ----';
  const SMART_NOTE_END = '---- SMART NOTE v0.1 END ----';

  const isAdminRole = roleValue === 'admin' || roleValue === 'charge';
  const canAckResults =
    roleValue === 'doctor' ||
    roleValue === 'nursing' ||
    roleValue === 'charge' ||
    roleValue === 'admin';
  const canApplyOrderSet =
    roleValue === 'doctor' || roleValue === 'charge' || roleValue === 'admin';
  const canAdmitToIpd =
    roleValue === 'doctor' || roleValue === 'admin' || roleValue === 'charge';

  const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());
  const normalizePick = (value: string) => String(value || '').trim().toLowerCase();
  const resolveUnitIdFromValue = (value: string) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const parenMatch = raw.match(/\(([^)]+)\)/);
    const parenToken = String(parenMatch?.[1] || '').trim();
    const rawName = String(raw.replace(/\s*\([^)]+\)\s*/g, '') || '').trim();
    const direct = admitUnits.find((unit: ErAdmitUnit) => String(unit.id) === raw);
    if (direct) return String(direct.id);
    const normalized = normalizePick(rawName || raw);
    const match = admitUnits.find(
      (unit: ErAdmitUnit) =>
        normalizePick(unit?.name) === normalized ||
        (unit?.shortCode && normalizePick(unit.shortCode) === normalized) ||
        (parenToken && unit?.shortCode && normalizePick(unit.shortCode) === normalizePick(parenToken))
    );
    return match ? String(match.id) : '';
  };
  const encounterCoreId = String(encounter?.encounterCoreId || encounterId || '').trim();
  const { data: ipdEpisodeData, mutate: mutateIpdEpisode } = useSWR(
    encounterCoreId ? `/api/ipd/episodes/by-encounter?encounterCoreId=${encodeURIComponent(encounterCoreId)}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: admitOptionsData } = useSWR(hasPermission ? '/api/er/admit-options' : null, fetcher, {
    refreshInterval: 0,
  });
  const admitUnits: ErAdmitUnit[] = Array.isArray((admitOptionsData as ErAdmitOptionsResponse | undefined)?.units) ? (admitOptionsData as ErAdmitOptionsResponse).units! : [];
  const admitServiceValue = String(disposition?.admitService || '').trim();
  const admitServiceSelectValue = resolveUnitIdFromValue(admitServiceValue);
  const admitWardValue = String(disposition?.admitWardUnit || '').trim();
  const unitIdForDisposition = admitServiceSelectValue;
  useEffect(() => {
    if (!admitServiceValue) return;
    if (!admitServiceSelectValue) return;
    if (admitServiceValue === admitServiceSelectValue) return;
    setDispositionLocal((prev: ErDisposition | null) => ({ ...(prev || {}), type: 'ADMIT' as const, admitService: admitServiceSelectValue }));
    saveDisposition({ admitService: admitServiceSelectValue, type: 'ADMIT' });
  }, [admitServiceValue, admitServiceSelectValue]);
  const { data: admitRoomsData } = useSWR(
    unitIdForDisposition ? `/api/er/admit-options?unitId=${encodeURIComponent(unitIdForDisposition)}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const admitRooms: ErAdmitRoom[] = Array.isArray((admitRoomsData as ErAdmitOptionsResponse | undefined)?.rooms) ? (admitRoomsData as ErAdmitOptionsResponse).rooms! : [];
  const acceptingPhysiciansQuery = unitIdForDisposition || admitServiceValue;
  const { data: acceptingPhysiciansData } = useSWR(
    hasPermission && acceptingPhysiciansQuery
      ? `/api/er/accepting-physicians?unitId=${encodeURIComponent(acceptingPhysiciansQuery)}`
      : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const acceptingDoctorOptions: ErAcceptingPhysician[] = Array.isArray((acceptingPhysiciansData as ErListResponse<ErAcceptingPhysician> | undefined)?.items)
    ? (acceptingPhysiciansData as ErListResponse<ErAcceptingPhysician>).items!
    : [];
  const admitDoctorOptions = acceptingDoctorOptions;
  const admitServiceOptions = useMemo(() => {
    return admitUnits.map((unit: ErAdmitUnit) => ({
      id: unit.id,
      label: unit.shortCode ? `${unit.name} (${unit.shortCode})` : unit.name,
      value: unit.id,
    }));
  }, [admitUnits]);
  const admitServiceUnitSelectValue = resolveUnitIdFromValue(admitServiceUnit);
  const admitServiceUnitOptions = useMemo(() => {
    return admitUnits.map((unit: ErAdmitUnit) => ({
      id: unit.id,
      label: unit.shortCode ? `${unit.name} (${unit.shortCode})` : unit.name,
      value: unit.id,
    }));
  }, [admitUnits]);
  const admitWardOptions = useMemo(() => {
    const base = admitRooms.map((room: ErAdmitRoom) => ({
      id: room.id,
      label: room.name,
      value: room.name,
    }));
    if (admitWardValue && !base.find((opt) => normalizePick(opt.value) === normalizePick(admitWardValue))) {
      base.unshift({ id: 'custom', label: admitWardValue, value: admitWardValue });
    }
    return base;
  }, [admitRooms, admitWardValue, normalizePick]);
  const acceptingPhysicianValue = String(disposition?.acceptingPhysician || '').trim();
  const acceptingPhysicianSelectedId = useMemo(() => {
    if (!acceptingPhysicianValue) return '';
    const match = acceptingDoctorOptions.find((doc: ErAcceptingPhysician) =>
      [doc.displayName, doc.id].some((v: string | undefined) => normalizePick(v || '') === normalizePick(acceptingPhysicianValue))
    );
    return match?.id || '';
  }, [acceptingDoctorOptions, acceptingPhysicianValue, normalizePick]);
  const acceptingDoctorOptionsWithCustom = useMemo(() => {
    return acceptingDoctorOptions.map((doc: ErAcceptingPhysician) => ({
      id: doc.id,
      label: doc.displayName || doc.id,
      value: doc.id,
    }));
  }, [acceptingDoctorOptions, acceptingPhysicianValue, normalizePick]);
  const NoteOrdersList = ({ noteId }: { noteId: string }) => {
    const { data } = useSWR(noteId ? `/api/clinical-notes/${encodeURIComponent(noteId)}/orders` : null, fetcher, {
      refreshInterval: 0,
    });
    const items: ErOrderTask[] = Array.isArray((data as ErListResponse<ErOrderTask> | undefined)?.items) ? (data as ErListResponse<ErOrderTask>).items! : [];
    if (!items.length) {
      return <div className="text-xs text-muted-foreground">{tr('لا توجد أوامر مرتبطة.', 'No orders linked.')}</div>;
    }
    return (
      <div className="space-y-1 text-xs">
        {items.map((item: ErOrderTask) => (
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
    const { data } = useSWR(
      entityId ? `/api/attachments?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}` : null,
      fetcher,
      { refreshInterval: 0 }
    );
    const items: ErAttachmentItem[] = Array.isArray((data as ErListResponse<ErAttachmentItem> | undefined)?.items) ? (data as ErListResponse<ErAttachmentItem>).items! : [];
    if (!items.length) {
      return <div className="text-xs text-muted-foreground">{tr('لا توجد مرفقات.', 'No attachments.')}</div>;
    }
    return (
      <div className="space-y-1 text-xs">
        {items.map((item: ErAttachmentItem) => (
          <div key={item.id} className="flex items-center justify-between">
            <span>{item.fileName}</span>
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{item.mimeType}</span>
          </div>
        ))}
      </div>
    );
  };
  const OrderResultsList = ({
    orderId,
    canAck,
  }: {
    orderId: string;
    canAck: boolean;
  }) => {
    const { data, mutate } = useSWR(orderId ? `/api/orders/${encodeURIComponent(orderId)}/results` : null, fetcher, {
      refreshInterval: 0,
    });
    const items: ErResultItem[] = Array.isArray((data as ErListResponse<ErResultItem> | undefined)?.items) ? (data as ErListResponse<ErResultItem>).items! : [];
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
        if (!res.ok) throw new Error(payload.error || tr('فشلت العملية', 'Failed'));
        toast({ title: payload.noOp ? tr('تم الإقرار مسبقاً', 'Already acknowledged') : tr('تم الإقرار', 'Acknowledged') });
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
        {items.map((result: ErResultItem) => (
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
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{result.acksCount || 0} ACK</span>
                {canAck ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    disabled={result.ackedByMe}
                    onClick={() => ackResult(result.id)}
                  >
                    {result.ackedByMe ? tr('تم الإقرار', 'Acknowledged') : tr('إقرار', 'Acknowledge')}
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
  const DISPOSITION_OPTIONS = ['HOME', 'AMA', 'LAMA', 'TRANSFER_OUT', 'DEATH_PENDING'] as const;
  const DEATH_PLACES = ['ER', 'IPD', 'OPD', 'OTHER'] as const;
  const { data: dischargeData, mutate: mutateDischarge } = useSWR(
    encounterId ? `/api/discharge/finalize?encounterCoreId=${encodeURIComponent(encounterId)}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const discharge = (dischargeData as ErDischargeData | undefined)?.discharge || null;
  const { data: deathStatusData, mutate: mutateDeathStatus } = useSWR(
    encounterId ? `/api/death/status?encounterCoreId=${encodeURIComponent(encounterId)}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const deathDeclaration = (deathStatusData as ErDeathStatusData | undefined)?.declaration || null;
  const mortuaryCase = (deathStatusData as ErDeathStatusData | undefined)?.mortuaryCase || null;

  const { data: nursingNotesData, mutate: mutateNursingNotes, isLoading: nursingNotesLoading } = useSWR(
    encounterId ? `/api/er/nursing/encounters/${encounterId}/notes` : null,
    fetcher,
    { refreshInterval: 5000 }
  );
  const { data: clinicalNotesData, mutate: mutateClinicalNotes } = useSWR(
    encounterId ? `/api/clinical-notes?encounterCoreId=${encodeURIComponent(encounterId)}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: ordersHubData } = useSWR(
    encounterId ? `/api/orders?encounterCoreId=${encodeURIComponent(encounterId)}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: resultsData, mutate: mutateResults } = useSWR(
    encounterId ? `/api/er/encounters/${encounterId}/results` : null,
    fetcher,
    { refreshInterval: 5000 }
  );
  const nursingNotes: ErNursingNote[] = Array.isArray((nursingNotesData as ErListResponse<ErNursingNote> | undefined)?.items) ? (nursingNotesData as ErListResponse<ErNursingNote>).items! : [];
  const clinicalNotes: ErClinicalNote[] = Array.isArray((clinicalNotesData as ErListResponse<ErClinicalNote> | undefined)?.items) ? (clinicalNotesData as ErListResponse<ErClinicalNote>).items! : [];
  const ordersHub: ErOrderTask[] = Array.isArray((ordersHubData as ErListResponse<ErOrderTask> | undefined)?.items) ? (ordersHubData as ErListResponse<ErOrderTask>).items! : [];
  const resultsItems: ErResultItem[] = Array.isArray((resultsData as ErResultsResponse | undefined)?.items) ? (resultsData as ErResultsResponse).items! : [];

  const { data: nursingHandoversData, mutate: mutateNursingHandovers, isLoading: nursingHandoversLoading } = useSWR(
    encounterId ? `/api/er/nursing/encounters/${encounterId}/handovers` : null,
    fetcher,
    { refreshInterval: 5000 }
  );
  const nursingHandovers: ErHandover[] = Array.isArray((nursingHandoversData as ErListResponse<ErHandover> | undefined)?.items) ? (nursingHandoversData as ErListResponse<ErHandover>).items! : [];

  const { data: transferRequestsData, mutate: mutateTransferRequests } = useSWR(
    encounterId ? `/api/er/nursing/encounters/${encounterId}/transfer-requests` : null,
    fetcher,
    { refreshInterval: 5000 }
  );
  const transferRequests: ErTransferRequest[] = Array.isArray((transferRequestsData as ErListResponse<ErTransferRequest> | undefined)?.items) ? (transferRequestsData as ErListResponse<ErTransferRequest>).items! : [];
  const openTransferRequest = transferRequests.find((r: ErTransferRequest) => r.status === 'OPEN') || null;

  const { data: escalationsData, mutate: mutateEscalations } = useSWR(
    encounterId ? `/api/er/nursing/encounters/${encounterId}/escalations` : null,
    fetcher,
    { refreshInterval: 5000 }
  );
  const escalations: ErEscalation[] = Array.isArray((escalationsData as ErEscalationsResponse | undefined)?.items) ? (escalationsData as ErEscalationsResponse).items! : [];
  const hasOpenEscalation = Boolean((escalationsData as ErEscalationsResponse | undefined)?.hasOpenEscalation);

  const { data: doctorNotesData, mutate: mutateDoctorNotes, isLoading: doctorNotesLoading } = useSWR(
    encounterId ? `/api/er/doctor/encounters/${encounterId}/notes` : null,
    fetcher,
    { refreshInterval: 5000 }
  );
  const doctorNotes: ErDoctorNote[] = Array.isArray((doctorNotesData as ErListResponse<ErDoctorNote> | undefined)?.items) ? (doctorNotesData as ErListResponse<ErDoctorNote>).items! : [];

  const [nursingNoteDialogOpen, setNursingNoteDialogOpen] = useState(false);
  const [nursingNoteType, setNursingNoteType] = useState<'SHIFT' | 'PROGRESS'>('SHIFT');
  const [nursingNoteBody, setNursingNoteBody] = useState('');
  const [nursingNoteSaving, setNursingNoteSaving] = useState(false);

  const [handoverDialogOpen, setHandoverDialogOpen] = useState(false);
  const [handoverType, setHandoverType] = useState<'END_OF_SHIFT' | 'NURSE_TO_NURSE'>('END_OF_SHIFT');
  const [handoverSaving, setHandoverSaving] = useState(false);
  const [handoverS, setHandoverS] = useState('');
  const [handoverB, setHandoverB] = useState('');
  const [handoverA, setHandoverA] = useState('');
  const [handoverR, setHandoverR] = useState('');
  const [primaryNurseAssigning, setPrimaryNurseAssigning] = useState(false);

  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferReason, setTransferReason] = useState('');
  const [transferUrgency, setTransferUrgency] = useState<'ROUTINE' | 'URGENT'>('ROUTINE');
  const [transferSaving, setTransferSaving] = useState(false);

  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolveRequestId, setResolveRequestId] = useState<string | null>(null);
  const [newPrimaryNurseUserId, setNewPrimaryNurseUserId] = useState('');
  const [resolveSaving, setResolveSaving] = useState(false);

  const { data: nursingUsersData } = useSWR(
    isAdminRole ? '/api/er/nursing/users' : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const nursingUsers: ErNursingUser[] = Array.isArray((nursingUsersData as ErListResponse<ErNursingUser> | undefined)?.items) ? (nursingUsersData as ErListResponse<ErNursingUser>).items! : [];

  const [escalationDialogOpen, setEscalationDialogOpen] = useState(false);
  const [escalationUrgency, setEscalationUrgency] = useState<'ROUTINE' | 'URGENT'>('ROUTINE');
  const [escalationReason, setEscalationReason] = useState('');
  const [escalationNote, setEscalationNote] = useState('');
  const [escalationSaving, setEscalationSaving] = useState(false);
  const [escalationResolvingId, setEscalationResolvingId] = useState<string | null>(null);

  const [doctorNoteDialogOpen, setDoctorNoteDialogOpen] = useState(false);
  const [doctorNoteType, setDoctorNoteType] = useState<'PROGRESS' | 'ASSESSMENT_PLAN'>('PROGRESS');
  const [doctorNoteBody, setDoctorNoteBody] = useState('');
  const [doctorNoteSaving, setDoctorNoteSaving] = useState(false);

  // Disposition required field refs (for auto-scroll/focus)
  const dischargeFinalDxRef = useRef<HTMLInputElement | null>(null);
  const dischargeInstructionsRef = useRef<HTMLTextAreaElement | null>(null);
  const admitServiceRef = useRef<HTMLButtonElement | null>(null);
  const admitWardUnitRef = useRef<HTMLButtonElement | null>(null);
  const admitReasonRef = useRef<HTMLTextAreaElement | null>(null);
  const admitSbarRef = useRef<HTMLTextAreaElement | null>(null);
  const transferTypeWrapRef = useRef<HTMLDivElement | null>(null);
  const transferDestinationRef = useRef<HTMLInputElement | null>(null);
  const transferReasonRef = useRef<HTMLTextAreaElement | null>(null);
  const transferSbarRef = useRef<HTMLTextAreaElement | null>(null);

  const canEditNotes = permissions.includes('er.encounter.edit') || roleValue === 'doctor' || roleValue === 'nursing';
  const canUpdateDisposition = permissions.includes('er.disposition.update') || roleValue === 'doctor' || roleValue === 'admin';
  const canUpdateStatus = permissions.includes('er.encounter.edit') || roleValue === 'doctor' || roleValue === 'admin';
  const canManageOrders = permissions.includes('er.encounter.edit') || roleValue === 'doctor' || roleValue === 'admin';
  const { data: ordersData, mutate: mutateOrders, isLoading: ordersLoading } = useSWR(
    encounterId ? `/api/er/encounters/${encounterId}/orders` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const pendingResultsCount = useMemo(() => {
    if (typeof (resultsData as ErResultsResponse | undefined)?.pendingReviewCount === 'number') {
      return Number((resultsData as ErResultsResponse | undefined)?.pendingReviewCount || 0);
    }
    const done = (ordersData?.items || []).filter((t: ErOrderTask) => t.status === 'DONE');
    return done.filter((t: ErOrderTask) => !t.resultAcknowledgedAt).length;
  }, [resultsData, ordersData]);

  const applyOrderSet = async (setKey: string) => {
    if (!canManageOrders) return;
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/er/encounters/${encounterId}/orders/apply-set`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tr('فشل تطبيق مجموعة الطلبات', 'Failed to apply order set'));
      await mutateOrders();
    } finally {
      setStatusUpdating(false);
    }
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    if (!canManageOrders) return;
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/er/encounters/${encounterId}/orders/task-status`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tr('فشل تحديث المهمة', 'Failed to update task'));
      await mutateOrders();
    } finally {
      setStatusUpdating(false);
    }
  };

  const ackResult = async (taskId: string) => {
    if (!canManageOrders) return;
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/er/encounters/${encounterId}/results/ack`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tr('فشل التأكيد', 'Failed to acknowledge'));
      await Promise.all([mutateOrders(), mutateResults()]);
    } finally {
      setStatusUpdating(false);
    }
  };

  useEffect(() => {
    if (!encounterId) return;
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/er/encounters/${encounterId}`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data || !active) return;
        setEncounter(data.encounter);
        setNotes(data.encounter?.notes?.content || '');
        setDisposition(data.encounter?.disposition || null);
      } catch {
        return;
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [encounterId]);

  const refreshEncounter = async () => {
    if (!encounterId) return;
    try {
      const res = await fetch(`/api/er/encounters/${encounterId}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      if (data?.encounter) {
        setEncounter(data.encounter);
      }
    } catch {
      return;
    }
  };

  const submitAdmit = async () => {
    if (!encounterCoreId) return;
    if (!admitServiceUnit.trim() || !admitDoctorId.trim()) {
      toast({
        title: tr('نقص بيانات', 'Missing'),
        description: tr('القسم/الوحدة والطبيب المعالج مطلوبة.', 'Service/unit and admitting doctor are required.'),
        variant: 'destructive' as const,
      });
      return;
    }
    setAdmitBusy(true);
    try {
      const res = await fetch('/api/ipd/episodes/create-from-encounter', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterCoreId,
          serviceUnit: admitServiceUnit.trim(),
          admittingDoctorUserId: admitDoctorId.trim(),
          bedClass: admitBedClass.trim() || undefined,
          notes: admitNotes.trim() || undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || tr('فشل التنويم', 'Failed to admit'));
      toast({ title: payload.noOp ? tr('تم القبول مسبقاً', 'Already admitted') : tr('تم إنشاء حلقة IPD', 'IPD episode created') });
      setAdmitOpen(false);
      await mutateIpdEpisode();
      if (pendingFinalizeStatus === 'ADMITTED') {
        setPendingFinalizeStatus(null);
        await finalizeDisposition('ADMITTED');
      }
      if (payload?.episodeId) {
        router.push(`/ipd/episode/${payload.episodeId}`);
      }
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setAdmitBusy(false);
    }
  };

  useEffect(() => {
    if (!admitOpen) return;
    if (!admitServiceUnit.trim() && admitServiceValue) {
      setAdmitServiceUnit(admitServiceValue);
    }
  }, [admitOpen, admitServiceUnit, admitServiceValue]);

  useEffect(() => {
    if (!encounterId) return;
    let active = true;
    async function loadTimeline() {
      setTimelineLoading(true);
      setTimelineError(null);
      try {
        const res = await fetch(`/api/er/encounters/${encounterId}/timeline`, { credentials: 'include' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `Failed to load timeline (${res.status})`);
        }
        const data = await res.json();
        if (!active) return;
        setTimeline(Array.isArray(data.items) ? data.items : []);
      } catch (err: any) {
        if (!active) return;
        setTimelineError(err?.message || tr('فشل تحميل المخطط الزمني', 'Failed to load timeline'));
      } finally {
        if (active) setTimelineLoading(false);
      }
    }
    loadTimeline();
    const interval = setInterval(loadTimeline, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [encounterId]);

  useEffect(() => {
    if (!encounterId) return;
    let active = true;
    async function loadDisposition() {
      try {
        const res = await fetch(`/api/er/encounters/${encounterId}/disposition`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setDisposition(data.disposition || null);
        setDispositionValidation(data.validation || null);
      } catch {}
    }
    loadDisposition();
    return () => {
      active = false;
    };
  }, [encounterId]);

  const saveNotes = (value: string) => {
    if (!canEditNotes) return;
    if (noteTimeout.current) clearTimeout(noteTimeout.current);
    noteTimeout.current = setTimeout(async () => {
      setSavingNotes(true);
      setNoteError(null);
      try {
        const res = await fetch('/api/er/encounters/notes', {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encounterId, content: value }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || tr('فشل الحفظ', 'Failed to save'));
      } catch (err: any) {
        setNoteError(err.message || tr('فشل الحفظ', 'Failed to save'));
      } finally {
        setSavingNotes(false);
      }
    }, 500);
  };

  const tasksForSmartNote = useMemo(() => {
    return Array.isArray(ordersData?.items) ? ordersData.items : [];
  }, [ordersData]);

  const sepsisBundle = useMemo(() => {
    const text = `${String(encounter?.chiefComplaint || '')} ${String(encounter?.triage?.notes || '')}`.toLowerCase();
    const suspectedByText = text.includes('sepsis');
    const suspectedByOrderSet = tasksForSmartNote.some((t: ErOrderTask) => String(t.orderSetKey || '') === 'SEPSIS');
    const suspected = suspectedByText || suspectedByOrderSet;

    const tasks = tasksForSmartNote || [];
    const matches = (patterns: RegExp[]) =>
      tasks.filter((t: ErOrderTask) => {
        const label = String(t.label || t.taskName || '').toLowerCase();
        return patterns.some((p) => p.test(label));
      });

    const compute = (label: string, patterns: RegExp[]) => {
      const m = matches(patterns);
      const anyDone = m.some((t: ErOrderTask) => String(t.status) === 'DONE');
      const anyInProgress = m.some((t: ErOrderTask) => String(t.status) === 'IN_PROGRESS');
      const status = anyDone ? 'Done' : anyInProgress ? 'In progress' : 'Not started';
      const minDate = (vals: (string | undefined | null)[]) => {
        const times = vals
          .map((v) => (v ? new Date(v).getTime() : NaN))
          .filter((n) => Number.isFinite(n)) as number[];
        if (times.length === 0) return null;
        return new Date(Math.min(...times)).toISOString();
      };
      const startedAt = minDate(m.map((t: ErOrderTask) => t.startedAt));
      const completedAt = minDate(m.map((t: ErOrderTask) => t.completedAt));
      return { label, status, startedAt, completedAt };
    };

    return {
      suspected,
      checks: [
        compute('Lactate ordered', [/lactate/i]),
        compute('Blood cultures ordered', [/blood\\s*culture/i, /cultures/i]),
        compute('IV fluids started', [/iv\\s*access/i, /fluids?/i]),
        compute('Antibiotics ordered', [/antibiot/i, /\\babx\\b/i]),
      ],
    };
  }, [encounter?.chiefComplaint, tasksForSmartNote]);

  const smartNoteText = useMemo(() => {
    return compileErSmartNote({
      encounter,
      timeline,
      tasks: tasksForSmartNote,
      assessmentPlan,
    });
  }, [encounter, timeline, tasksForSmartNote, assessmentPlan]);

  const smartNoteBlock = useMemo(() => {
    const body = String(smartNoteText || '').trim();
    return `${SMART_NOTE_START}\n${body}\n${SMART_NOTE_END}\n`;
  }, [SMART_NOTE_END, SMART_NOTE_START, smartNoteText]);

  const upsertSmartNoteBlock = (currentNotes: string, block: string) => {
    const current = String(currentNotes || '');
    const escapedStart = SMART_NOTE_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedEnd = SMART_NOTE_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}\\n?`, 'm');

    if (re.test(current)) {
      return current.replace(re, block);
    }
    return current.trim() ? `${current.trim()}\n\n---\n\n${block}` : block;
  };

  const insertSmartNoteIntoNotes = () => {
    const merged = upsertSmartNoteBlock(notes, smartNoteBlock);
    setNotes(merged);
    saveNotes(merged);
  };

  const copySmartNote = async () => {
    try {
      await navigator.clipboard.writeText(smartNoteBlock);
    } catch {
      // best-effort copy only
    }
  };

  const filteredTabs = useMemo(() => {
    if (roleValue === 'reception') return ['overview'] as TabKey[];
    if (roleValue === 'nursing') return ['overview', 'notes', 'tasks', 'handover', 'nursing'] as TabKey[];
    if (roleValue === 'doctor') return ['overview', 'notes', 'orders', 'results', 'tasks', 'handover', 'disposition'] as TabKey[];
    return TABS;
  }, [role]);

  const staff = useMemo(() => {
    const assignments = encounter?.staffAssignments || [];
    const doctor = assignments.find((item: ErStaffAssignment) => item.role === 'PRIMARY_DOCTOR');
    const nurse = assignments.find((item: ErStaffAssignment) => item.role === 'PRIMARY_NURSE');
    const triageNurse = assignments.find((item: ErStaffAssignment) => item.role === 'TRIAGE_NURSE');
    return { doctor, nurse, triageNurse };
  }, [encounter]);

  const canAddNursingNote = useMemo(() => {
    const myId = me?.user?.id;
    if (!myId) return false;
    if (isAdminRole) return true;
    return staff.nurse?.userId === myId;
  }, [isAdminRole, me?.user?.id, staff.nurse?.userId]);

  const canAddDoctorNote = useMemo(() => {
    const myId = me?.user?.id;
    if (!myId) return false;
    if (isAdminRole) return true;
    const seenByDoctorUserId = String(encounter?.seenByDoctorUserId || '');
    return staff.doctor?.userId === myId || seenByDoctorUserId === myId;
  }, [encounter, isAdminRole, me?.user?.id, staff.doctor?.userId]);

  const saveNursingNote = async () => {
    if (!encounterId) return;
    if (!nursingNoteBody.trim()) {
      toast({ title: tr('خطأ', 'Error'), description: tr('محتوى الملاحظة مطلوب', 'Note body is required'), variant: 'destructive' as const });
      return;
    }
    setNursingNoteSaving(true);
    try {
      const res = await fetch('/api/er/nursing/notes', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId, type: nursingNoteType, content: nursingNoteBody.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || tr('فشل حفظ ملاحظة التمريض', 'Failed to save nursing note'));
      toast({ title: tr('نجاح', 'Success'), description: tr('تم حفظ ملاحظة التمريض.', 'Nursing note saved.') });
      setNursingNoteBody('');
      setNursingNoteDialogOpen(false);
      await mutateNursingNotes();
    } catch (err: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: err?.message || tr('فشل الحفظ', 'Failed to save'),
        variant: 'destructive' as const,
      });
    } finally {
      setNursingNoteSaving(false);
    }
  };

  const saveDoctorNote = async () => {
    if (!encounterId) return;
    if (!doctorNoteBody.trim()) {
      toast({ title: tr('خطأ', 'Error'), description: tr('محتوى الملاحظة مطلوب', 'Note body is required'), variant: 'destructive' as const });
      return;
    }
    setDoctorNoteSaving(true);
    try {
      const res = await fetch('/api/er/doctor/notes', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterId,
          type: doctorNoteType,
          content: doctorNoteBody.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || tr('فشل حفظ ملاحظة الطبيب', 'Failed to save doctor note'));
      toast({ title: tr('نجاح', 'Success'), description: tr('تم حفظ ملاحظة الطبيب.', 'Doctor note saved.') });
      setDoctorNoteBody('');
      setDoctorNoteDialogOpen(false);
      await mutateDoctorNotes();
    } catch (err: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: err?.message || tr('فشل الحفظ', 'Failed to save'),
        variant: 'destructive' as const,
      });
    } finally {
      setDoctorNoteSaving(false);
    }
  };

  const saveHandover = async () => {
    if (!encounterId) return;
    if (!handoverS.trim() && !handoverB.trim() && !handoverA.trim() && !handoverR.trim()) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('مطلوب تعبئة حقل واحد على الأقل من SBAR', 'At least one SBAR field is required'),
        variant: 'destructive' as const,
      });
      return;
    }
    setHandoverSaving(true);
    try {
      const res = await fetch('/api/er/nursing/handovers', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterId,
          type: handoverType,
          situation: handoverS.trim(),
          background: handoverB.trim(),
          assessment: handoverA.trim(),
          recommendation: handoverR.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save handover');
      toast({ title: tr('نجاح', 'Success'), description: tr('تم حفظ تسليم المناوبة.', 'Handover saved.') });
      setHandoverS('');
      setHandoverB('');
      setHandoverA('');
      setHandoverR('');
      setHandoverDialogOpen(false);
      await mutateNursingHandovers();
    } catch (err: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: err?.message || tr('فشل الحفظ', 'Failed to save'),
        variant: 'destructive' as const,
      });
    } finally {
      setHandoverSaving(false);
    }
  };

  const requestTransfer = async () => {
    if (!encounterId) return;
    if (!transferReason.trim()) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('السبب مطلوب', 'Reason is required'),
        variant: 'destructive' as const,
      });
      return;
    }
    setTransferSaving(true);
    try {
      const res = await fetch('/api/er/nursing/transfer-requests', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterId,
          reason: transferReason.trim(),
          urgency: transferUrgency,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to request transfer');
      toast({ title: tr('نجاح', 'Success'), description: tr('تم إرسال طلب النقل.', 'Transfer request submitted.') });
      setTransferReason('');
      setTransferUrgency('ROUTINE');
      setTransferDialogOpen(false);
      await mutateTransferRequests();
    } catch (err: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: err?.message || tr('فشلت العملية', 'Failed'),
        variant: 'destructive' as const,
      });
    } finally {
      setTransferSaving(false);
    }
  };

  const resolveTransferRequest = async (args: {
    requestId: string;
    action: 'APPROVE' | 'REJECT' | 'CANCEL';
    newPrimaryNurseUserId?: string;
  }) => {
    setResolveSaving(true);
    try {
      const res = await fetch('/api/er/nursing/transfer-requests/resolve', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterId,
          requestId: args.requestId,
          action: args.action,
          newPrimaryNurseUserId: args.newPrimaryNurseUserId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to resolve request');
      toast({
        title: tr('نجاح', 'Success'),
        description: language === 'ar' ? `تم تنفيذ الإجراء على الطلب: ${args.action}` : `Request ${args.action.toLowerCase()}d.`,
      });
      await mutateTransferRequests();
      await refreshEncounter();
    } catch (err: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: err?.message || tr('فشلت العملية', 'Failed'),
        variant: 'destructive' as const,
      });
    } finally {
      setResolveSaving(false);
    }
  };

  const createEscalation = async () => {
    if (!encounterId) return;
    if (!escalationReason.trim()) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('السبب مطلوب', 'Reason is required'),
        variant: 'destructive' as const,
      });
      return;
    }
    setEscalationSaving(true);
    try {
      const res = await fetch('/api/er/nursing/escalations', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterId,
          urgency: escalationUrgency,
          reason: escalationReason.trim(),
          note: escalationNote.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create escalation');
      toast({ title: tr('نجاح', 'Success'), description: tr('تم إنشاء التصعيد.', 'Escalation created.') });
      setEscalationReason('');
      setEscalationNote('');
      setEscalationUrgency('ROUTINE');
      setEscalationDialogOpen(false);
      await mutateEscalations();
    } catch (err: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: err?.message || tr('فشلت العملية', 'Failed'),
        variant: 'destructive' as const,
      });
    } finally {
      setEscalationSaving(false);
    }
  };

  const resolveEscalation = async (escalationId: string) => {
    if (!isAdminRole) return;
    setEscalationResolvingId(escalationId);
    try {
      const res = await fetch('/api/er/nursing/escalations/resolve', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escalationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to resolve escalation');
      toast({ title: tr('نجاح', 'Success'), description: tr('تم إغلاق التصعيد.', 'Escalation resolved.') });
      await mutateEscalations();
    } catch (err: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: err?.message || tr('فشلت العملية', 'Failed'),
        variant: 'destructive' as const,
      });
    } finally {
      setEscalationResolvingId(null);
    }
  };

  const updateStatus = async (nextStatus: string): Promise<boolean> => {
    if (!canUpdateStatus) return false;
    setStatusUpdating(true);
    setDispositionError(null);
    try {
      const res = await fetch('/api/er/encounters/status', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId, status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update status');
      const effectiveStatus = data?.status || nextStatus;
      setEncounter((prev: ErEncounterData | null) => (prev ? { ...prev, status: effectiveStatus } : prev));
      if (data?.noOp) {
        toast({ title: tr('لا يوجد تغيير', 'No change'), description: tr('الحالة الحالية هي نفسها.', 'Already in this state.') });
      }
      return true;
    } catch (err: any) {
      const msg = err.message || 'Failed to update status';
      setDispositionError(msg);
      toast({ title: tr('خطأ', 'Error'), description: msg, variant: 'destructive' as const });
      return false;
    } finally {
      setStatusUpdating(false);
    }
  };

  const assignMe = async (assignmentRole: 'PRIMARY_DOCTOR' | 'PRIMARY_NURSE') => {
    if (!me?.user?.id) return;
    setStatusUpdating(true);
    try {
      const res = await fetch('/api/er/staff/assign', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId, userId: me.user.id, role: assignmentRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign');
      setEncounter((prev: ErEncounterData | null) => {
        if (!prev) return prev;
        const assignments = (prev.staffAssignments || []).filter((a: ErStaffAssignment) => a.role !== assignmentRole);
        return { ...prev, staffAssignments: [...assignments, data.assignment] };
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  const assignMeAsPrimaryNurse = async () => {
    if (!me?.user?.id) return;
    setPrimaryNurseAssigning(true);
    try {
      const res = await fetch(`/api/er/encounters/${encounterId}/assign-primary-nurse`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to assign primary nurse');
      toast({
        title: tr('نجاح', 'Success'),
        description: tr('أنت الآن ممرض الرعاية الأساسي لهذه الزيارة.', 'You are now the Primary Nurse for this visit.'),
      });
      await refreshEncounter();
    } catch (err: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: err?.message || tr('فشل الإسناد', 'Failed to assign'),
        variant: 'destructive' as const,
      });
    } finally {
      setPrimaryNurseAssigning(false);
    }
  };

  const saveDisposition = (patch: Record<string, any>) => {
    if (!canUpdateDisposition) return;
    if (dispositionTimeout.current) clearTimeout(dispositionTimeout.current);
    dispositionTimeout.current = setTimeout(async () => {
      const requestSeq = dispositionEditSeq.current;
      setDispositionSaving(true);
      setDispositionError(null);
      try {
        const type = patch.type || disposition?.type;
        const res = await fetch(`/api/er/encounters/${encounterId}/disposition`, {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...patch, type }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save disposition');
        if (requestSeq === dispositionEditSeq.current) {
          setDisposition(data.disposition || null);
        }
        setDispositionValidation(data.validation || null);
      } catch (err: any) {
        setDispositionError(err.message || 'Failed to save disposition');
      } finally {
        setDispositionSaving(false);
      }
    }, 400);
  };

  const setDispositionLocal = (updater: ((prev: ErDisposition | null) => ErDisposition | null) | ErDisposition | null) => {
    dispositionEditSeq.current += 1;
    setDisposition(updater);
  };

  const finalizeDischarge = async () => {
    setDischargeBusy(true);
    try {
      const res = await fetch('/api/discharge/finalize', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterCoreId: encounterId,
          disposition: dischargeDisposition,
          summaryText: dischargeSummaryText,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || tr('فشلت العملية', 'Failed'));
      toast({ title: payload.noOp ? tr('لا يوجد تغيير', 'No change') : tr('تم إنهاء الخروج', 'Discharge finalized') });
      setDischargeOpen(false);
      setDischargeSummaryText('');
      await mutateDischarge();
      await refreshEncounter();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setDischargeBusy(false);
    }
  };

  const declareDeath = async () => {
    setDeathBusy(true);
    try {
      const res = await fetch('/api/death/declare', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterCoreId: encounterId,
          deathDateTime,
          placeOfDeath: deathPlace,
          preliminaryCause: deathCause,
          notes: deathNotes,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || tr('فشلت العملية', 'Failed'));
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
    setDeathBusy(true);
    try {
      const res = await fetch('/api/death/finalize', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterCoreId: encounterId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || tr('فشلت العملية', 'Failed'));
      toast({ title: payload.noOp ? tr('لا يوجد تغيير', 'No change') : tr('تم اعتماد الوفاة', 'Death finalized') });
      setDeathFinalizeOpen(false);
      await mutateDeathStatus();
      await refreshEncounter();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setDeathBusy(false);
    }
  };

  const addClinicalNote = async () => {
    const patientMasterId = encounter?.patient?.patientMasterId;
    if (!patientMasterId) return;
    setClinicalBusy(true);
    try {
      const res = await fetch('/api/clinical-notes', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientMasterId,
          encounterCoreId: encounterId,
          area: 'ER',
          noteType: 'ER_PROGRESS',
          title: clinicalTitle || undefined,
          content: clinicalContent,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || tr('فشلت العملية', 'Failed'));
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

  const finalizeDisposition = async (
    finalStatus: 'DISCHARGED' | 'ADMITTED' | 'TRANSFERRED' | 'DEATH'
  ): Promise<{ ok: boolean; missing?: string[] }> => {
    if (!canUpdateDisposition) return { ok: false };
    setStatusUpdating(true);
    setDispositionError(null);
    try {
      const res = await fetch('/api/er/encounters/status', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId, status: finalStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        const missing = Array.isArray(data.missing) ? data.missing : undefined;
        if (missing) {
          setDispositionValidation({ isValid: false, missing });
        }
        const missingText = missing ? missing.join(', ') : '';
        setDispositionError(data.error ? `${data.error}${missingText ? ` (${missingText})` : ''}` : 'Failed to finalize');
        return { ok: false, missing };
      }
      setEncounter((prev: ErEncounterData | null) => (prev ? { ...prev, status: finalStatus } : prev));
      return { ok: true };
    } catch (err: any) {
      setDispositionError(err.message || 'Failed to finalize');
      return { ok: false };
    } finally {
      setStatusUpdating(false);
    }
  };

  const missingSet = useMemo(() => {
    return new Set<string>(dispositionValidation?.missing || []);
  }, [dispositionValidation]);

  const focusFirstMissing = (missing: string[], type: 'DISCHARGE' | 'ADMIT' | 'TRANSFER') => {
    const orderByType: Record<typeof type, string[]> = {
      DISCHARGE: ['finalDiagnosis', 'dischargeInstructions'],
      ADMIT: ['admitService', 'admitWardUnit', 'reasonForAdmission', 'handoffSbar'],
      TRANSFER: ['transferType', 'destinationFacilityUnit', 'reason', 'handoffSbar'],
    };

    const firstKey = orderByType[type].find((key) => missing.includes(key));
    if (!firstKey) return;

    const focusElement = (el: HTMLElement | null | undefined) => {
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof el.focus === 'function') {
        setTimeout(() => el.focus(), 100);
      }
    };

    if (firstKey === 'finalDiagnosis') return focusElement(dischargeFinalDxRef.current);
    if (firstKey === 'dischargeInstructions') return focusElement(dischargeInstructionsRef.current);
    if (firstKey === 'admitService') return focusElement(admitServiceRef.current);
    if (firstKey === 'admitWardUnit') return focusElement(admitWardUnitRef.current);
    if (firstKey === 'reasonForAdmission') return focusElement(admitReasonRef.current);
    if (firstKey === 'destinationFacilityUnit') return focusElement(transferDestinationRef.current);
    if (firstKey === 'reason') return focusElement(transferReasonRef.current);
    if (firstKey === 'handoffSbar') {
      if (type === 'ADMIT') return focusElement(admitSbarRef.current);
      return focusElement(transferSbarRef.current);
    }
    if (firstKey === 'transferType') {
      const wrap = transferTypeWrapRef.current;
      if (!wrap) return;
      wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const firstButton = wrap.querySelector('button') as HTMLButtonElement | null;
      if (firstButton) {
        setTimeout(() => firstButton.focus(), 100);
      }
    }
  };

  const handleFinalizeClick = async (finalStatus: 'DISCHARGED' | 'ADMITTED' | 'TRANSFERRED' | 'DEATH') => {
    if (!canUpdateDisposition) return;
    setTab('disposition');

    // DEATH bypasses disposition type logic — finalize directly
    if (finalStatus === 'DEATH') {
      const result = await finalizeDisposition(finalStatus);
      if (!result.ok) {
        const missing = dispositionValidation?.missing || result.missing || [];
        if (missing.length) {
          focusFirstMissing(missing, 'DISCHARGE');
        }
      }
      return;
    }

    const desiredType =
      finalStatus === 'DISCHARGED' ? 'DISCHARGE' : finalStatus === 'ADMITTED' ? 'ADMIT' : 'TRANSFER';
    if ((disposition?.type || 'DISCHARGE') !== desiredType) {
      setDispositionLocal((prev: ErDisposition | null) => ({ ...(prev || {}), type: desiredType }));
      saveDisposition({ type: desiredType });
      setTimeout(() => {
        if (desiredType === 'DISCHARGE') focusFirstMissing(['finalDiagnosis'], 'DISCHARGE');
        if (desiredType === 'ADMIT') focusFirstMissing(['admitService'], 'ADMIT');
        if (desiredType === 'TRANSFER') focusFirstMissing(['transferType'], 'TRANSFER');
      }, 50);
      return;
    }
    const hasIpdEpisode = Boolean((ipdEpisodeData as ErIpdEpisodeData | undefined)?.episode?.id);
    if (finalStatus === 'ADMITTED' && !hasIpdEpisode) {
      setPendingFinalizeStatus('ADMITTED');
      if (!admitServiceUnit.trim() || !admitDoctorId.trim()) {
        setAdmitOpen(true);
        return;
      }
      await submitAdmit();
      return;
    }

    const result = await finalizeDisposition(finalStatus);
    if (!result.ok) {
      const missing = dispositionValidation?.missing || result.missing || [];
      if (missing.length) {
        focusFirstMissing(missing, desiredType);
      }
    }
  };

  const previewDischargeSummary = useMemo(() => {
    const lines: string[] = [];
    const patientName = encounter?.patient?.fullName || 'Unknown';
    const mrn = encounter?.patient?.mrn || encounter?.patient?.tempMrn || 'N/A';
    lines.push(`Patient: ${patientName} (${mrn})`);
    lines.push(`ER Visit: ${encounter?.visitNumber || 'ER-—'}`);
    if (encounter?.triageLevel) lines.push(`Triage: ${encounter.triageLevel}`);
    if (encounter?.chiefComplaint) lines.push(`Chief complaint: ${encounter.chiefComplaint}`);
    if (disposition?.type === 'DISCHARGE') {
      if (disposition.finalDiagnosis) lines.push(`Final diagnosis: ${disposition.finalDiagnosis}`);
      if (disposition.dischargeInstructions) lines.push(`Discharge instructions: ${disposition.dischargeInstructions}`);
      if (disposition.followUpPlan) lines.push(`Follow-up: ${disposition.followUpPlan}`);
    }
    const recentActions = timeline.slice(0, 8).map((t) => `${t.action} (${t.entityType})`);
    if (recentActions.length) {
      lines.push(`Recent activity: ${recentActions.join(' • ')}`);
    }
    return lines.join('\n');
  }, [encounter, disposition, timeline]);

  const patientName = encounter?.patient?.fullName || 'Unknown';
  const patientMrn = encounter?.patient?.mrn || encounter?.patient?.tempMrn || 'N/A';
  const bedLabel = encounter?.bed ? `${encounter.bed.zone}-${encounter.bed.bedLabel}` : 'Unassigned';
  const visitNumber = encounter?.visitNumber || 'ER-—';
  const timerStartAt =
    encounter?.statusUpdatedAt ||
    encounter?.updatedAt ||
    encounter?.createdAt ||
    encounter?.arrivalTime ||
    encounter?.triage?.createdAt;
  const patientHeader = encounter ? (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-[200px]">
        <div className="text-xs text-muted-foreground">Patient</div>
        <div className="font-semibold">{patientName}</div>
        <div className="text-xs text-muted-foreground">{patientMrn}</div>
      </div>
      <div className="min-w-[140px]">
        <div className="text-xs text-muted-foreground">ER Visit</div>
        <div className="font-semibold">{visitNumber}</div>
      </div>
      <div className="min-w-[160px]">
        <div className="text-xs text-muted-foreground">Bed</div>
        <div className="font-semibold">{bedLabel}</div>
      </div>
      <div className="min-w-[140px]">
        <div className="text-xs text-muted-foreground">Triage</div>
        <div className="font-semibold">{encounter?.triageLevel ?? '--'}</div>
      </div>
      <div className="min-w-[160px]">
        <div className="text-xs text-muted-foreground">Status</div>
        <ErStatusPill status={encounter?.status || '—'} critical={Boolean(encounter?.triage?.critical)} />
      </div>
      <div className="min-w-[140px]">
        <ErLiveTimer startAt={timerStartAt} label="Live timer" />
      </div>
    </div>
  ) : null;

  if (isLoading || hasPermission === null) {
    return null;
  }

  if (!hasPermission) {
    return null;
  }

  return (
    <ErPageShell
      isRTL={isRTL}
      title={tr('زيارة الطوارئ', 'Emergency Visit')}
      subtitle={tr('النظرة العامة هي العرض الافتراضي للإجراءات السريرية.', 'Overview is the default view for clinical actions.')}
      patientHeader={patientHeader}
      actions={
        encounter?.patient?.patientMasterId ? (
          <>
            <Button variant="outline" className="rounded-xl" asChild>
              <Link href={`/patient/${encounter.patient.patientMasterId}`}>{tr('فتح ملف المريض', 'Open Patient Profile')}</Link>
            </Button>
            <Button variant="outline" className="rounded-xl" asChild>
              <Link href={`/patient/${encodeURIComponent(encounter.patient.patientMasterId)}/journey`}>
                {tr('عرض رحلة المريض', 'View Patient Journey')}
              </Link>
            </Button>
          </>
        ) : null
      }
    >
      <div className="flex flex-wrap gap-2">
        {filteredTabs.map((key) => (
          <Button
            key={key}
            variant={tab === key ? 'default' : 'outline'}
            className="rounded-xl"
            onClick={() => setTab(key)}
          >
            {key.toUpperCase()}
            {key === 'results' && pendingResultsCount > 0 && (
              <span className={`inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive ${isRTL ? 'mr-2' : 'ml-2'}`}>
                {pendingResultsCount}
              </span>
            )}
          </Button>
        ))}
      </div>

        {tab === 'overview' && (
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <div className="pt-6 space-y-3">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">{tr('زيارة الطوارئ', 'ER Visit')}</p>
                  <p className="font-medium">{visitNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tr('الفرز', 'Triage')}</p>
                  <p className="font-medium">{encounter?.triageLevel ?? '--'}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {encounter?.triage?.critical && <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{tr('حرج', 'Critical')}</span>}
                {encounter?.patientMaster?.identityVerification?.matchLevel ? (
                  encounter.patientMaster.identityVerification.matchLevel === 'VERIFIED' ? (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                      Identity {encounter.patientMaster.identityVerification.matchLevel}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                      Identity {encounter.patientMaster.identityVerification.matchLevel}
                    </span>
                  )
                ) : null}
              </div>

              {(roleValue === 'doctor' || roleValue === 'nursing' || roleValue === 'admin') && (
                <div className="rounded-2xl bg-card border border-border p-6 space-y-4 mt-4">
                  <h2 className="text-lg font-semibold text-foreground text-base">{tr('الإجراءات السريرية', 'Clinical Actions')}</h2>
                  <div className="flex flex-wrap gap-2">
                    {roleValue === 'doctor' && (
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        disabled={statusUpdating}
                        onClick={() => assignMe('PRIMARY_DOCTOR')}
                      >
                        {tr('تعييني كطبيب رئيسي', 'Assign me as Primary Doctor')}
                      </Button>
                    )}
                    {roleValue === 'nursing' && (
                      <>
                        {(!staff.nurse?.userId || isAdminRole) && (
                          <Button
                            variant="outline"
                            className="rounded-xl"
                            disabled={primaryNurseAssigning}
                            onClick={assignMeAsPrimaryNurse}
                          >
                            {tr('تعييني كممرضة رئيسية', 'Assign me as Primary Nurse')}
                          </Button>
                        )}
                      </>
                    )}

                    {canUpdateStatus && (
                      <>
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          disabled={statusUpdating}
                          onClick={() => updateStatus('SEEN_BY_DOCTOR')}
                        >
                          {tr('تحديد كمعاين', 'Mark Seen')}
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          disabled={statusUpdating}
                          onClick={() => updateStatus('ORDERS_IN_PROGRESS')}
                        >
                          {tr('أوامر قيد التنفيذ', 'Orders In Progress')}
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          disabled={statusUpdating}
                          onClick={() => updateStatus('RESULTS_PENDING')}
                        >
                          {tr('نتائج معلقة', 'Results Pending')}
                        </Button>
                        <Button
                          className="rounded-xl"
                          disabled={statusUpdating}
                          onClick={async () => {
                            await updateStatus('DECISION');
                            setTab('disposition');
                          }}
                        >
                          {tr('نقل إلى القرار', 'Move to Decision')}
                        </Button>
                      </>
                    )}
                    {canAdmitToIpd && (
                      <Button variant="outline" className="rounded-xl" onClick={() => setAdmitOpen(true)} disabled={admitBusy}>
                        {tr('قبول في التنويم', 'Admit to IPD')}
                      </Button>
                    )}
                    {(ipdEpisodeData as ErIpdEpisodeData | undefined)?.episode?.id && (
                      <Button variant="outline" className="rounded-xl" asChild>
                        <Link href={`/ipd/episode/${(ipdEpisodeData as ErIpdEpisodeData | undefined)?.episode?.id}`}>{tr('فتح حلقة التنويم', 'Open IPD Episode')}</Link>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-2xl bg-card border border-border p-6 space-y-4 mt-4">
                <h2 className="text-lg font-semibold text-foreground text-base">{tr('الفريق', 'Team')}</h2>
                <div className="grid gap-2 md:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{tr('الطبيب الرئيسي', 'Primary Doctor')}</p>
                    <p className="text-sm">{staff.doctor?.userId || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{tr('الممرضة الرئيسية', 'Primary Nurse')}</p>
                    <p className="text-sm">{staff.nurse?.userId || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{tr('ممرضة الفرز', 'Triage Nurse')}</p>
                    <p className="text-sm">{staff.triageNurse?.userId || '—'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-card border border-border p-6 space-y-4 mt-4">
                <h2 className="text-lg font-semibold text-foreground text-base">{tr('التسلسل الزمني', 'Timeline')}</h2>
                <div>
                  {timelineLoading && <div className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>}
                  {!timelineLoading && timelineError && (
                    <div className="text-sm text-muted-foreground">{timelineError}</div>
                  )}
                  {!timelineLoading && timeline.length === 0 && (
                    <div className="text-sm text-muted-foreground">{tr('لا يوجد نشاط بعد.', 'No activity yet.')}</div>
                  )}
                  {!timelineLoading && timeline.length > 0 && (
                    <div>
                      <div className="grid grid-cols-4 gap-4 px-4 py-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوقت', 'Time')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الإجراء', 'Action')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الكيان', 'Entity')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المستخدم', 'User')}</span>
                      </div>
                      <div className="divide-y divide-border">
                        {timeline.map((item) => (
                          <div key={item.id} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                            <span className="text-sm text-foreground text-xs text-muted-foreground">
                              {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
                            </span>
                            <span className="text-sm text-foreground">{item.action}</span>
                            <span className="text-sm text-foreground text-xs text-muted-foreground">
                              {item.entityType}
                            </span>
                            <span className="text-sm text-foreground text-xs text-muted-foreground">
                              {item.userId}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'notes' && (
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">{tr('الملاحظات', 'Notes')}</h2>
            <div className="space-y-3">
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground text-base">{tr('ملاحظة الطوارئ الذكية v0.1', 'ER Smart Note v0.1')}</h2>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التقييم والخطة (يدوي)', 'Assessment & Plan (manual)')}</span>
                    <Textarea
                      value={assessmentPlan}
                      onChange={(e) => setAssessmentPlan(e.target.value)}
                      className="min-h-[120px] rounded-xl thea-input-focus"
                      placeholder={tr('تقييم وخطة الطبيب...', 'Physician assessment & plan...')}
                      disabled={!canEditNotes}
                    />
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('معاينة (تجميع تلقائي، قراءة فقط)', 'Preview (auto-compiled, read only)')}</span>
                    <Textarea value={smartNoteText} readOnly className="min-h-[220px] rounded-xl thea-input-focus" />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className="rounded-xl"
                        disabled={!canEditNotes || savingNotes}
                        onClick={insertSmartNoteIntoNotes}
                      >
                        {tr('إدراج الملاحظة الذكية في الملاحظات', 'Insert Smart Note into Notes')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        disabled={!canEditNotes}
                        onClick={copySmartNote}
                      >
                        {tr('نسخ الملاحظة الذكية', 'Copy Smart Note')}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tr('هذه الملاحظة يتم إنشاؤها حتمياً من بيانات الطوارئ الموجودة (بدون ذكاء اصطناعي). التقييم والخطة فقط يدوي.', 'This note is generated deterministically from existing ER data (no AI). Only Assessment & Plan is manual.')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground text-base">{tr('ملاحظات الطبيب', 'Doctor Notes')}</h2>
                    <p className="text-sm text-muted-foreground">{tr('ملاحظات على مستوى الزيارة (إضافة فقط، بدون تعديل/حذف).', 'Append-only visit-level notes (no edit/delete).')}</p>
                  </div>
                  <Dialog open={doctorNoteDialogOpen} onOpenChange={setDoctorNoteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="rounded-xl" disabled={!canAddDoctorNote}>{tr('إضافة ملاحظة طبيب', 'Add Doctor Note')}</Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-2xl">
                      <DialogHeader>
                        <DialogTitle>{tr('إضافة ملاحظة طبيب', 'Add Doctor Note')}</DialogTitle>
                        <DialogDescription>{tr('ملاحظة تقدم أو تقييم وخطة (إضافة فقط).', 'Progress note or Assessment & Plan (append-only).')}</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النوع', 'Type')}</span>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              className="rounded-xl"
                              variant={doctorNoteType === 'PROGRESS' ? 'default' : 'outline'}
                              onClick={() => setDoctorNoteType('PROGRESS')}
                            >
                              {tr('تقدم', 'Progress')}
                            </Button>
                            <Button
                              type="button"
                              className="rounded-xl"
                              variant={doctorNoteType === 'ASSESSMENT_PLAN' ? 'default' : 'outline'}
                              onClick={() => setDoctorNoteType('ASSESSMENT_PLAN')}
                            >
                              {tr('التقييم والخطة', 'Assessment & Plan')}
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الملاحظة', 'Note')}</span>
                          <Textarea
                            value={doctorNoteBody}
                            onChange={(e) => setDoctorNoteBody(e.target.value)}
                            className="min-h-[160px] rounded-xl thea-input-focus"
                            placeholder={tr('اكتب ملاحظة الطبيب...', 'Write doctor note...')}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" className="rounded-xl" onClick={() => setDoctorNoteDialogOpen(false)}>
                          {tr('إلغاء', 'Cancel')}
                        </Button>
                        <Button className="rounded-xl" disabled={doctorNoteSaving || !canAddDoctorNote} onClick={saveDoctorNote}>
                          {tr('حفظ', 'Save')}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="space-y-3">
                  {!canAddDoctorNote && (
                    <div className="text-sm text-muted-foreground">
                      {tr('يمكنك العرض فقط. إضافة ملاحظات الطبيب مقتصرة على طبيب السجل لهذه الزيارة.', 'You can view only. Adding doctor notes is limited to the doctor-of-record for this visit.')}
                    </div>
                  )}
                  {doctorNotesLoading && <div className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>}
                  {!doctorNotesLoading && doctorNotes.length === 0 && (
                    <div className="text-sm text-muted-foreground">{tr('لا توجد ملاحظات طبيب بعد.', 'No doctor notes yet.')}</div>
                  )}
                  {!doctorNotesLoading && doctorNotes.length > 0 && (
                    <div>
                      <div className="grid grid-cols-4 gap-4 px-4 py-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوقت', 'Time')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الطبيب', 'Doctor')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النوع', 'Type')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الملاحظة', 'Note')}</span>
                      </div>
                      <div className="divide-y divide-border">
                        {doctorNotes.slice(0, 30).map((n: any) => (
                          <div key={n.id} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                            <span className="text-sm text-foreground text-xs text-muted-foreground">
                              {n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}
                            </span>
                            <span className="text-sm text-foreground text-xs text-muted-foreground">{n.doctorDisplay || '—'}</span>
                            <span className="text-sm text-foreground text-xs text-muted-foreground">{n.type || '—'}</span>
                            <span className="text-sm text-foreground">
                              <div className="line-clamp-3 whitespace-pre-wrap">{String(n.content || '')}</div>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  saveNotes(e.target.value);
                }}
                className="min-h-[200px] rounded-xl thea-input-focus"
                placeholder={tr('ملاحظات...', 'Notes...')}
                disabled={!canEditNotes}
              />
              <div className="text-xs text-muted-foreground">
                {savingNotes ? tr('جاري الحفظ...', 'Saving...') : noteError ? `${tr('خطأ في الحفظ', 'Save error')}: ${noteError}` : tr('تم الحفظ مباشرة', 'Live saved')}
              </div>
            </div>
          </div>
        )}

        {tab === 'clinical' && (
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">{tr('الملاحظات السريرية', 'Clinical Notes')}</h2>
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
                          <div className="text-xs font-medium mb-1">{tr('الأوامر من هذه الملاحظة', 'Orders from this note')}</div>
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
        )}

        {tab === 'orders' && (
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">{tr('الأوامر', 'Orders')}</h2>
            <div className="space-y-4">
              <OrderSetsPanel encounterType="ER" encounterId={encounterId} canApply={canApplyOrderSet} />
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('مجموعات الأوامر', 'Order Sets')}</span>
                <div className="flex flex-wrap gap-2">
                  {ER_ORDER_SETS.map((set) => (
                    <Button
                      key={set.key}
                      variant="outline"
                      className="rounded-xl"
                      disabled={!canManageOrders || statusUpdating}
                      onClick={() => applyOrderSet(set.key)}
                    >
                      {set.title}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {tr('اختيار مجموعة ينشئ مهام وينقل الزيارة إلى أوامر قيد التنفيذ عند الاقتضاء.', 'Selecting a set creates tasks and moves the visit to ORDERS_IN_PROGRESS when applicable.')}
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المهام', 'Tasks')}</span>
                {ordersLoading && <div className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>}
                {!ordersLoading && (ordersData?.items?.length || 0) === 0 && (
                  <div className="text-sm text-muted-foreground">{tr('لا توجد مهام بعد.', 'No tasks yet.')}</div>
                )}
                {!ordersLoading && (ordersData?.items?.length || 0) > 0 && (
                  <div>
                    <div className="grid grid-cols-4 gap-4 px-4 py-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المهمة', 'Task')}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النوع', 'Kind')}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">{tr('الإجراءات', 'Actions')}</span>
                    </div>
                    <div className="divide-y divide-border">
                      {ordersData.items.map((task: any) => (
                        <div key={task.id} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                          <span className="text-sm text-foreground">{task.label}</span>
                          <span className="text-sm text-foreground text-xs text-muted-foreground">{task.kind}</span>
                          <span className="text-sm text-foreground">
                            {task.status === 'DONE' ? (
                              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{task.status}</span>
                            ) : task.status === 'CANCELLED' ? (
                              <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{task.status}</span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{task.status}</span>
                            )}
                          </span>
                          <span className="text-sm text-foreground text-right">
                            <div className="inline-flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-xl"
                                disabled={!canManageOrders || statusUpdating || task.status !== 'ORDERED'}
                                onClick={() => updateTaskStatus(task.id, 'IN_PROGRESS')}
                              >
                                {tr('بدء', 'Start')}
                              </Button>
                              <Button
                                size="sm"
                                className="rounded-xl"
                                disabled={!canManageOrders || statusUpdating || task.status === 'DONE' || task.status === 'CANCELLED'}
                                onClick={() => updateTaskStatus(task.id, 'DONE')}
                              >
                                {tr('إكمال', 'Complete')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-xl"
                                disabled={!canManageOrders || statusUpdating || task.status === 'CANCELLED'}
                                onClick={() => updateTaskStatus(task.id, 'CANCELLED')}
                              >
                                {tr('إلغاء', 'Cancel')}
                              </Button>
                            </div>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'results' && (
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">{tr('النتائج', 'Results')}</h2>
            <div className="space-y-4">
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
                    <OrderResultsList orderId={order.id} canAck={canAckResults} />
                  </div>
                ))
              ) : resultsItems.length ? (
                resultsItems.map((task: any) => (
                  <div key={task.id} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">{task.label || tr('مهمة', 'Task')}</div>
                        <div className="text-xs text-muted-foreground">
                          {task.kind || '—'} • {task.status || '—'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {task.resultAcknowledgedAt ? (
                          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('تم الإقرار', 'Acknowledged')}</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('معلق', 'Pending')}</span>
                        )}
                        {canAckResults && !task.resultAcknowledgedAt ? (
                          <Button size="sm" variant="outline" className="rounded-xl" disabled={statusUpdating} onClick={() => ackResult(task.id)}>
                            {tr('إقرار', 'Acknowledge')}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">{tr('لا توجد نتائج بعد.', 'No results yet.')}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No results yet.</div>
              )}
            </div>
          </div>
        )}

        {tab === 'tasks' && <TasksPanel encounterCoreId={encounterId} />}

        {tab === 'handover' && <HandoverPanel encounterCoreId={encounterId} />}

        {tab === 'nursing' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground text-base">{tr('الممرضة الرئيسية', 'Primary Nurse')}</h2>
                  <p className="text-sm text-muted-foreground">
                    {staff.nurse?.userId ? `${tr('معين:', 'Assigned:')} ${staff.nurse.userId}` : tr('غير معين', 'Unassigned')}
                  </p>
                </div>
                {(!staff.nurse?.userId || isAdminRole) && (
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={primaryNurseAssigning}
                    onClick={assignMeAsPrimaryNurse}
                  >
                    {tr('تعييني كممرضة رئيسية', 'Assign me as Primary Nurse')}
                  </Button>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {tr('يتم تعيينك كممرضة رئيسية فقط إذا كانت الزيارة غير معينة حالياً.', 'This assigns you as the Primary Nurse only if the visit is currently unassigned (dev can always see the button for testing).')}
              </div>
            </div>

            <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground text-base">{tr('حزمة الإنتان (v0.1)', 'Sepsis Bundle (v0.1)')}</h2>
                  <p className="text-sm text-muted-foreground">{tr('متتبع حتمي بناءً على المهام الحالية + الشكوى الرئيسية.', 'Deterministic tracker based on existing tasks + chief complaint.')}</p>
                </div>
                {sepsisBundle.suspected ? (
                  <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{tr('مشتبه', 'Suspected')}</span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('غير مشتبه', 'Not suspected')}</span>
                )}
              </div>
              <div className="space-y-3">
                {!sepsisBundle.suspected && (
                  <div className="text-sm text-muted-foreground">{tr('لم يتم اكتشاف محفز إنتان (مطابقة نص أو مجموعة أوامر "إنتان / حمى").', 'No sepsis trigger detected (text match or "Sepsis / Fever" order set).')}</div>
                )}
                <div>
                  <div className="grid grid-cols-4 gap-4 px-4 py-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('العنصر', 'Item')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('بدأ', 'Started')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('مكتمل', 'Completed')}</span>
                  </div>
                  <div className="divide-y divide-border">
                    {sepsisBundle.checks.map((c: any) => (
                      <div key={c.label} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                        <span className="text-sm text-foreground">{c.label}</span>
                        <span className="text-sm text-foreground text-xs text-muted-foreground">{c.status}</span>
                        <span className="text-sm text-foreground text-xs text-muted-foreground">
                          {c.startedAt ? new Date(c.startedAt).toLocaleString() : '—'}
                        </span>
                        <span className="text-sm text-foreground text-xs text-muted-foreground">
                          {c.completedAt ? new Date(c.completedAt).toLocaleString() : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground text-base">{tr('التصعيدات', 'Escalations')}</h2>
                  <p className="text-sm text-muted-foreground">{tr('التصعيد للطبيب (بدون إشعارات/تغييرات في سير العمل).', 'Escalate to doctor (no notifications/workflow changes).')}</p>
                </div>
                <div className="flex items-center gap-2">
                  {hasOpenEscalation && <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{tr('مفتوح', 'OPEN')}</span>}
                  <Dialog open={escalationDialogOpen} onOpenChange={setEscalationDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="rounded-xl" disabled={!canAddNursingNote}>{tr('التصعيد للطبيب', 'Escalate to Doctor')}</Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-2xl">
                      <DialogHeader>
                        <DialogTitle>{tr('التصعيد للطبيب', 'Escalate to Doctor')}</DialogTitle>
                        <DialogDescription>{tr('ينشئ حدث تصعيد مفتوح قابل للتدقيق (بدون إشعارات).', 'Creates an auditable OPEN escalation event (no notifications).')}</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الأولوية', 'Urgency')}</span>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              className="rounded-xl"
                              variant={escalationUrgency === 'ROUTINE' ? 'default' : 'outline'}
                              onClick={() => setEscalationUrgency('ROUTINE')}
                            >
                              {tr('روتيني', 'Routine')}
                            </Button>
                            <Button
                              type="button"
                              className="rounded-xl"
                              variant={escalationUrgency === 'URGENT' ? 'default' : 'outline'}
                              onClick={() => setEscalationUrgency('URGENT')}
                            >
                              {tr('عاجل', 'Urgent')}
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السبب', 'Reason')}</span>
                          <Textarea
                            value={escalationReason}
                            onChange={(e) => setEscalationReason(e.target.value)}
                            className="min-h-[120px] rounded-xl thea-input-focus"
                            placeholder={tr('لماذا تقوم بالتصعيد؟', 'Why are you escalating?')}
                          />
                        </div>
                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ملاحظة (اختياري)', 'Note (optional)')}</span>
                          <Textarea
                            value={escalationNote}
                            onChange={(e) => setEscalationNote(e.target.value)}
                            className="min-h-[100px] rounded-xl thea-input-focus"
                            placeholder={tr('سياق إضافي (اختياري)', 'Additional context (optional)')}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" className="rounded-xl" onClick={() => setEscalationDialogOpen(false)}>
                          {tr('إلغاء', 'Cancel')}
                        </Button>
                        <Button className="rounded-xl" disabled={escalationSaving || !canAddNursingNote} onClick={createEscalation}>
                          {tr('إنشاء تصعيد', 'Create escalation')}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <div className="space-y-3">
                {!canAddNursingNote && (
                  <div className="text-sm text-muted-foreground">
                    {tr('يمكنك عرض التصعيدات فقط. الإنشاء مقتصر على الممرضة الرئيسية المعينة لهذه الزيارة.', 'You can view escalations only. Creating is limited to the Primary Nurse assigned to this visit.')}
                  </div>
                )}
                {escalations.length === 0 && <div className="text-sm text-muted-foreground">{tr('لا توجد تصعيدات بعد.', 'No escalations yet.')}</div>}
                {escalations.length > 0 && (
                  <div>
                    <div className="grid grid-cols-6 gap-4 px-4 py-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوقت', 'Time')}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الأولوية', 'Urgency')}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السبب', 'Reason')}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('بواسطة', 'By')}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">{tr('الإجراء', 'Action')}</span>
                    </div>
                    <div className="divide-y divide-border">
                      {escalations.map((e: any) => (
                        <div key={e.id} className="grid grid-cols-6 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                          <span className="text-sm text-foreground text-xs text-muted-foreground">
                            {e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}
                          </span>
                          <span className="text-sm text-foreground text-xs text-muted-foreground">{e.urgency || 'ROUTINE'}</span>
                          <span className="text-sm text-foreground">
                            {e.status === 'OPEN' ? (
                              <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{e.status}</span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{e.status}</span>
                            )}
                          </span>
                          <span className="text-sm text-foreground">{e.reason}</span>
                          <span className="text-sm text-foreground text-xs text-muted-foreground">{e.createdByDisplay || '—'}</span>
                          <span className="text-sm text-foreground text-right">
                            {isAdminRole && e.status === 'OPEN' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-xl"
                                disabled={escalationResolvingId === e.id}
                                onClick={() => resolveEscalation(e.id)}
                              >
                                {tr('حل', 'Resolve')}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{tr('ملاحظات التمريض', 'Nursing Notes')}</h2>
                  <p className="text-sm text-muted-foreground">{tr('ملاحظات مناوبة/تقدم للقراءة فقط لهذه الزيارة.', 'Append-only shift/progress notes for this ER visit.')}</p>
                </div>
                <Dialog open={nursingNoteDialogOpen} onOpenChange={setNursingNoteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="rounded-xl" disabled={!canAddNursingNote}>{tr('إضافة ملاحظة تمريض', 'Add Nursing Note')}</Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>{tr('إضافة ملاحظة تمريض', 'Add Nursing Note')}</DialogTitle>
                      <DialogDescription>{tr('ملاحظة مناوبة/تقدم (إضافة فقط).', 'Shift/progress note (append-only).')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع الملاحظة', 'Note type')}</span>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            className="rounded-xl"
                            variant={nursingNoteType === 'SHIFT' ? 'default' : 'outline'}
                            onClick={() => setNursingNoteType('SHIFT')}
                          >
                            {tr('ملاحظة مناوبة', 'Shift Note')}
                          </Button>
                          <Button
                            type="button"
                            className="rounded-xl"
                            variant={nursingNoteType === 'PROGRESS' ? 'default' : 'outline'}
                            onClick={() => setNursingNoteType('PROGRESS')}
                          >
                            {tr('ملاحظة تقدم', 'Progress Note')}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الملاحظة', 'Note')}</span>
                        <Textarea
                          value={nursingNoteBody}
                          onChange={(e) => setNursingNoteBody(e.target.value)}
                          className="min-h-[160px] rounded-xl thea-input-focus"
                          placeholder={tr('اكتب ملاحظة تمريض...', 'Write nursing note...')}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" className="rounded-xl" onClick={() => setNursingNoteDialogOpen(false)}>
                        {tr('إلغاء', 'Cancel')}
                      </Button>
                      <Button className="rounded-xl" disabled={nursingNoteSaving || !canAddNursingNote} onClick={saveNursingNote}>
                        {tr('حفظ', 'Save')}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="space-y-3">
                {!canAddNursingNote && (
                  <div className="text-sm text-muted-foreground">
                    {tr('يمكنك عرض الملاحظات فقط. الإضافة مقتصرة على الممرضة الرئيسية المعينة لهذه الزيارة.', 'You can view notes only. Adding notes is limited to the Primary Nurse assigned to this visit.')}
                  </div>
                )}
                {nursingNotesLoading && <div className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>}
                {!nursingNotesLoading && nursingNotes.length === 0 && (
                  <div className="text-sm text-muted-foreground">{tr('لا توجد ملاحظات تمريض بعد.', 'No nursing notes yet.')}</div>
                )}
                {!nursingNotesLoading && nursingNotes.length > 0 && (
                  <div>
                    <div className="grid grid-cols-4 gap-4 px-4 py-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوقت', 'Time')}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الممرضة', 'Nurse')}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النوع', 'Type')}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الملاحظة', 'Note')}</span>
                    </div>
                    <div className="divide-y divide-border">
                      {nursingNotes.slice(0, 20).map((n: any) => (
                        <div key={n.id} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                          <span className="text-sm text-foreground text-xs text-muted-foreground">
                            {n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}
                          </span>
                          <span className="text-sm text-foreground text-xs text-muted-foreground">{n.nurseDisplay || '—'}</span>
                          <span className="text-sm text-foreground">
                            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{n.type === 'SHIFT' ? tr('مناوبة', 'Shift') : tr('تقدم', 'Progress')}</span>
                          </span>
                          <span className="text-sm text-foreground whitespace-pre-wrap">{n.content}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{tr('تسليم التمريض', 'Nursing Handover')}</h2>
                  <p className="text-sm text-muted-foreground">{tr('توثيق تسليم SBAR مبسط (إضافة فقط).', 'Light SBAR handover documentation (append-only).')}</p>
                </div>
                <Dialog open={handoverDialogOpen} onOpenChange={setHandoverDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="rounded-xl" disabled={!canAddNursingNote}>{tr('إضافة تسليم', 'Add Handover')}</Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>{tr('إضافة تسليم', 'Add Handover')}</DialogTitle>
                      <DialogDescription>{tr('SBAR (إضافة فقط). لا يوجد منطق إعادة تعيين في هذه الخطوة.', 'SBAR (append-only). No reassignment logic in this step.')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع التسليم', 'Handover type')}</span>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            className="rounded-xl"
                            variant={handoverType === 'END_OF_SHIFT' ? 'default' : 'outline'}
                            onClick={() => setHandoverType('END_OF_SHIFT')}
                          >
                            {tr('نهاية المناوبة', 'End of Shift')}
                          </Button>
                          <Button
                            type="button"
                            className="rounded-xl"
                            variant={handoverType === 'NURSE_TO_NURSE' ? 'default' : 'outline'}
                            onClick={() => setHandoverType('NURSE_TO_NURSE')}
                          >
                            {tr('ممرضة لممرضة', 'Nurse-to-Nurse')}
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-3">
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Situation')}</span>
                          <Textarea value={handoverS} onChange={(e) => setHandoverS(e.target.value)} className="min-h-[90px] rounded-xl thea-input-focus" />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الخلفية', 'Background')}</span>
                          <Textarea value={handoverB} onChange={(e) => setHandoverB(e.target.value)} className="min-h-[90px] rounded-xl thea-input-focus" />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التقييم', 'Assessment')}</span>
                          <Textarea value={handoverA} onChange={(e) => setHandoverA(e.target.value)} className="min-h-[90px] rounded-xl thea-input-focus" />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التوصية', 'Recommendation')}</span>
                          <Textarea value={handoverR} onChange={(e) => setHandoverR(e.target.value)} className="min-h-[90px] rounded-xl thea-input-focus" />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" className="rounded-xl" onClick={() => setHandoverDialogOpen(false)}>
                        {tr('إلغاء', 'Cancel')}
                      </Button>
                      <Button className="rounded-xl" disabled={handoverSaving || !canAddNursingNote} onClick={saveHandover}>
                        {tr('حفظ', 'Save')}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="space-y-3">
                {!canAddNursingNote && (
                  <div className="text-sm text-muted-foreground">
                    {tr('يمكنك عرض التسليمات فقط. الإضافة مقتصرة على الممرضة الرئيسية المعينة لهذه الزيارة.', 'You can view handovers only. Adding handovers is limited to the Primary Nurse assigned to this visit.')}
                  </div>
                )}
                {nursingHandoversLoading && <div className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>}
                {!nursingHandoversLoading && nursingHandovers.length === 0 && (
                  <div className="text-sm text-muted-foreground">{tr('لا توجد تسليمات بعد.', 'No handovers yet.')}</div>
                )}
                {!nursingHandoversLoading && nursingHandovers.length > 0 && (
                  <div>
                    <div className="grid grid-cols-4 gap-4 px-4 py-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوقت', 'Time')}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('من الممرضة', 'From Nurse')}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النوع', 'Type')}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ملخص SBAR', 'SBAR summary')}</span>
                    </div>
                    <div className="divide-y divide-border">
                      {nursingHandovers.slice(0, 20).map((h: any) => {
                        const s = String(h.sbar?.situation || '').trim();
                        const b = String(h.sbar?.background || '').trim();
                        const a = String(h.sbar?.assessment || '').trim();
                        const r = String(h.sbar?.recommendation || '').trim();
                        const summary = [
                          s ? `S: ${s}` : null,
                          b ? `B: ${b}` : null,
                          a ? `A: ${a}` : null,
                          r ? `R: ${r}` : null,
                        ]
                          .filter(Boolean)
                          .join(' | ');
                        const clipped = summary.length > 220 ? `${summary.slice(0, 220)}...` : summary;
                        return (
                          <div key={h.id} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                            <span className="text-sm text-foreground text-xs text-muted-foreground">
                              {h.createdAt ? new Date(h.createdAt).toLocaleString() : '—'}
                            </span>
                            <span className="text-sm text-foreground text-xs text-muted-foreground">{h.fromNurseDisplay || '—'}</span>
                            <span className="text-sm text-foreground">
                              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                                {h.type === 'END_OF_SHIFT' ? tr('نهاية المناوبة', 'End of Shift') : tr('ممرضة لممرضة', 'Nurse-to-Nurse')}
                              </span>
                            </span>
                            <span className="text-sm text-foreground">{clipped || '—'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{tr('طلب نقل الممرضة الرئيسية', 'Primary Nurse Transfer Request')}</h2>
                  <p className="text-sm text-muted-foreground">
                    {tr('طلب نقل مسؤولية الممرضة الرئيسية (لا يغير التعيين بعد).', 'Request a transfer of primary nurse responsibility (does not change assignment yet).')}
                  </p>
                </div>
                <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="rounded-xl" disabled={!canAddNursingNote}>{tr('طلب نقل الممرضة الرئيسية', 'Request Primary Nurse Transfer')}</Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>{tr('طلب نقل الممرضة الرئيسية', 'Request Primary Nurse Transfer')}</DialogTitle>
                      <DialogDescription>{tr('السبب مطلوب. هذا ينشئ طلباً مفتوحاً فقط.', 'Reason is required. This creates an OPEN request only.')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الأولوية', 'Urgency')}</span>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            className="rounded-xl"
                            variant={transferUrgency === 'ROUTINE' ? 'default' : 'outline'}
                            onClick={() => setTransferUrgency('ROUTINE')}
                          >
                            {tr('روتيني', 'Routine')}
                          </Button>
                          <Button
                            type="button"
                            className="rounded-xl"
                            variant={transferUrgency === 'URGENT' ? 'default' : 'outline'}
                            onClick={() => setTransferUrgency('URGENT')}
                          >
                            {tr('عاجل', 'Urgent')}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السبب (مطلوب)', 'Reason (required)')}</span>
                        <Textarea
                          value={transferReason}
                          onChange={(e) => setTransferReason(e.target.value)}
                          className="min-h-[140px] rounded-xl thea-input-focus"
                          placeholder={tr('لماذا يلزم النقل؟', 'Why is transfer needed?')}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" className="rounded-xl" onClick={() => setTransferDialogOpen(false)}>
                        {tr('إلغاء', 'Cancel')}
                      </Button>
                      <Button className="rounded-xl" disabled={transferSaving || !canAddNursingNote} onClick={requestTransfer}>
                        {tr('إرسال الطلب', 'Submit Request')}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="space-y-3">
                {openTransferRequest ? (
                  <div className="rounded-md border p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{tr('تم طلب النقل', 'Transfer requested')}</span>
                      <span className="text-xs text-muted-foreground">
                        {openTransferRequest.createdAt ? new Date(openTransferRequest.createdAt).toLocaleString() : '—'}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">{tr('الأولوية:', 'Urgency:')}</span> {openTransferRequest.urgency || 'ROUTINE'}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">
                      <span className="font-medium">{tr('السبب:', 'Reason:')}</span> {openTransferRequest.reason}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tr('طلب بواسطة:', 'Requested by:')} {openTransferRequest.requestedByDisplay || '—'}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">{tr('لا يوجد طلب نقل مفتوح.', 'No open transfer request.')}</div>
                )}

                {isAdminRole && transferRequests.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">{tr('الطلبات الأخيرة', 'Recent requests')}</div>
                    <div>
                      <div className="grid grid-cols-5 gap-4 px-4 py-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوقت', 'Time')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الأولوية', 'Urgency')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السبب', 'Reason')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">{tr('الإجراءات', 'Actions')}</span>
                      </div>
                      <div className="divide-y divide-border">
                        {transferRequests.map((r: any) => (
                          <div key={r.id} className="grid grid-cols-5 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                            <span className="text-sm text-foreground text-xs text-muted-foreground">
                              {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                            </span>
                            <span className="text-sm text-foreground">
                              {r.status === 'OPEN' ? (
                                <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{r.status}</span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{r.status}</span>
                              )}
                            </span>
                            <span className="text-sm text-foreground text-xs text-muted-foreground">{r.urgency || 'ROUTINE'}</span>
                            <span className="text-sm text-foreground">{r.reason}</span>
                            <span className="text-sm text-foreground text-right">
                              {r.status === 'OPEN' ? (
                                <div className="inline-flex gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    className="rounded-xl"
                                    disabled={resolveSaving}
                                    onClick={() => {
                                      setResolveRequestId(r.id);
                                      setNewPrimaryNurseUserId('');
                                      setResolveDialogOpen(true);
                                    }}
                                  >
                                    {tr('موافقة', 'Approve')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-xl"
                                    disabled={resolveSaving}
                                    onClick={() => resolveTransferRequest({ requestId: r.id, action: 'REJECT' })}
                                  >
                                    {tr('رفض', 'Reject')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-xl"
                                    disabled={resolveSaving}
                                    onClick={() => resolveTransferRequest({ requestId: r.id, action: 'CANCEL' })}
                                  >
                                    {tr('إلغاء', 'Cancel')}
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Dialog
              open={resolveDialogOpen}
              onOpenChange={(open) => {
                setResolveDialogOpen(open);
                if (!open) {
                  setResolveRequestId(null);
                  setNewPrimaryNurseUserId('');
                }
              }}
            >
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle>{tr('الموافقة على النقل', 'Approve Transfer')}</DialogTitle>
                  <DialogDescription>{tr('اختر مستخدم الممرضة الرئيسية الجديد.', 'Select the new Primary Nurse user.')}</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الممرضة الرئيسية الجديدة', 'New Primary Nurse')}</span>
                  <Select value={newPrimaryNurseUserId} onValueChange={setNewPrimaryNurseUserId}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder={tr('اختر مستخدم', 'Select user')} />
                    </SelectTrigger>
                    <SelectContent>
                      {nursingUsers.map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.display}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button variant="outline" className="rounded-xl" onClick={() => setResolveDialogOpen(false)}>
                    {tr('إلغاء', 'Cancel')}
                  </Button>
                  <Button
                    className="rounded-xl"
                    disabled={!resolveRequestId || !newPrimaryNurseUserId || resolveSaving}
                    onClick={async () => {
                      if (!resolveRequestId) return;
                      await resolveTransferRequest({
                        requestId: resolveRequestId,
                        action: 'APPROVE',
                        newPrimaryNurseUserId,
                      });
                      setResolveDialogOpen(false);
                      setResolveRequestId(null);
                      setNewPrimaryNurseUserId('');
                    }}
                  >
                    {tr('الموافقة والنقل', 'Approve & Transfer')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">{tr('أحدث العلامات الحيوية (من الفرز)', 'Latest Vitals (from triage)')}</h2>
              <div>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {JSON.stringify(encounter?.triage?.vitals || {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {tab === 'disposition' && (
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">{tr('التصرف', 'Disposition')}</h2>
            <div className="space-y-3">
              <div className="rounded-md border p-3 text-sm space-y-2">
                <div className="font-medium">{tr('الخروج', 'Discharge')}</div>
                {discharge ? (
                  <div className="space-y-1">
                    <div>
                      {tr('الحالة:', 'Status:')} <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('مكتمل', 'FINALIZED')}</span>
                    </div>
                    <div>{tr('التصرف:', 'Disposition:')} {discharge.disposition}</div>
                    <div className="text-xs text-muted-foreground">
                      {discharge.createdAt ? new Date(discharge.createdAt).toLocaleString() : ''}
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground">{tr('لا يوجد ملخص خروج بعد.', 'No discharge summary yet.')}</div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="rounded-xl" onClick={() => setDischargeOpen(true)} disabled={dischargeBusy}>
                    {tr('إنهاء الخروج', 'Finalize Discharge')}
                  </Button>
                  {encounter?.patient?.patientMasterId ? (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="rounded-xl" asChild>
                        <Link href={`/patient/${encounter.patient.patientMasterId}`}>{tr('فتح ملف المريض', 'Open Patient Profile')}</Link>
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-xl" asChild>
                        <Link href={`/patient/${encodeURIComponent(encounter.patient.patientMasterId)}/journey`}>
                          {tr('عرض رحلة المريض', 'View Patient Journey')}
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-md border p-3 text-sm space-y-2">
                <div className="font-medium">{tr('الوفاة', 'Death')}</div>
                {deathDeclaration ? (
                  <div className="space-y-1">
                    <div>
                      {tr('الإعلان:', 'Declaration:')} <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{deathDeclaration.finalizedAt ? tr('مكتمل', 'FINALIZED') : tr('معلن', 'DECLARED')}</span>
                    </div>
                    <div>{tr('المكان:', 'Place:')} {deathDeclaration.placeOfDeath}</div>
                    <div className="text-xs text-muted-foreground">
                      {deathDeclaration.declaredAt ? new Date(deathDeclaration.declaredAt).toLocaleString() : ''}
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground">{tr('لا يوجد إعلان بعد.', 'No declaration yet.')}</div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="rounded-xl" onClick={() => setDeathDeclareOpen(true)} disabled={deathBusy}>
                    {tr('إعلان الوفاة', 'Declare Death')}
                  </Button>
                  <Button variant="outline" className="rounded-xl" onClick={() => setDeathFinalizeOpen(true)} disabled={deathBusy}>
                    {tr('إنهاء الوفاة', 'Finalize Death')}
                  </Button>
                  {mortuaryCase?.id ? (
                    <Button size="sm" variant="outline" className="rounded-xl" asChild>
                      <Link href={`/mortuary/${mortuaryCase.id}`}>{tr('فتح حالة المشرحة', 'Open Mortuary Case')}</Link>
                    </Button>
                  ) : null}
                </div>
              </div>

              {dispositionValidation && !dispositionValidation.isValid && (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div className="text-sm">
                    <span className="font-medium">{dispositionValidation.missing.length}</span> {tr('حقول مفقودة', 'fields missing')}
                  </div>
                  <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">{tr('غير مكتمل', 'Incomplete')}</span>
                </div>
              )}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع القرار', 'Decision Type')}</span>
                <div className="flex flex-wrap gap-2">
                  {(['DISCHARGE', 'ADMIT', 'TRANSFER'] as const).map((t) => (
                    <Button
                      key={t}
                      type="button"
                      className="rounded-xl"
                      variant={(disposition?.type || 'DISCHARGE') === t ? 'default' : 'outline'}
                      disabled={!canUpdateDisposition}
                      onClick={() => {
                        setDispositionLocal((prev: ErDisposition | null) => ({ ...(prev || {}), type: t }));
                        saveDisposition({ type: t });
                      }}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              </div>

              {/* DISCHARGE */}
              {(disposition?.type || 'DISCHARGE') === 'DISCHARGE' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التشخيص النهائي (مطلوب)', 'Final Diagnosis (required)')}</span>
                    <Input
                      ref={dischargeFinalDxRef}
                      className="rounded-xl thea-input-focus"
                      value={disposition?.finalDiagnosis || ''}
                      disabled={!canUpdateDisposition}
                      onChange={(e) => {
                        const value = e.target.value;
                        setDispositionLocal((prev: ErDisposition | null) => ({ ...(prev || {}), type: 'DISCHARGE', finalDiagnosis: value }));
                        saveDisposition({ finalDiagnosis: value, type: 'DISCHARGE' });
                      }}
                    />
                    {missingSet.has('finalDiagnosis') && (
                      <p className="text-xs text-destructive">{tr('مطلوب', 'Required')}</p>
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('تعليمات الخروج (مطلوب)', 'Discharge Instructions (required)')}</span>
                    <Textarea
                      ref={dischargeInstructionsRef}
                      value={disposition?.dischargeInstructions || ''}
                      disabled={!canUpdateDisposition}
                      onChange={(e) => {
                        const value = e.target.value;
                        setDispositionLocal((prev: ErDisposition | null) => ({
                          ...(prev || {}),
                          type: 'DISCHARGE',
                          dischargeInstructions: value,
                        }));
                        saveDisposition({ dischargeInstructions: value, type: 'DISCHARGE' });
                      }}
                      className="min-h-[140px] rounded-xl thea-input-focus"
                    />
                    {missingSet.has('dischargeInstructions') && (
                      <p className="text-xs text-destructive">{tr('مطلوب', 'Required')}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('خطة المتابعة (اختياري)', 'Follow-up Plan (optional)')}</span>
                    <Input
                      className="rounded-xl thea-input-focus"
                      value={disposition?.followUpPlan || ''}
                      disabled={!canUpdateDisposition}
                      onChange={(e) => {
                        const value = e.target.value;
                        setDispositionLocal((prev: ErDisposition | null) => ({ ...(prev || {}), type: 'DISCHARGE', followUpPlan: value }));
                        saveDisposition({ followUpPlan: value, type: 'DISCHARGE' });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('أدوية الخروج (عنصر نائب اختياري)', 'Discharge Medications (optional placeholder)')}</span>
                    <Input
                      className="rounded-xl thea-input-focus"
                      value={disposition?.dischargeMedications || ''}
                      disabled={!canUpdateDisposition}
                      onChange={(e) => {
                        const value = e.target.value;
                        setDispositionLocal((prev: ErDisposition | null) => ({
                          ...(prev || {}),
                          type: 'DISCHARGE',
                          dischargeMedications: value,
                        }));
                        saveDisposition({ dischargeMedications: value, type: 'DISCHARGE' });
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 md:col-span-2">
                    <Checkbox
                      checked={Boolean(disposition?.sickLeaveRequested)}
                      disabled={!canUpdateDisposition}
                      onCheckedChange={(checked) => {
                        const value = checked === true;
                        setDispositionLocal((prev: ErDisposition | null) => ({
                          ...(prev || {}),
                          type: 'DISCHARGE',
                          sickLeaveRequested: value,
                        }));
                        saveDisposition({ sickLeaveRequested: value, type: 'DISCHARGE' });
                      }}
                    />
                    <span className="text-sm">{tr('طلب إجازة مرضية (عنصر نائب)', 'Sick leave requested (placeholder)')}</span>
                  </div>
                </div>
              )}

              {/* ADMIT */}
              {(disposition?.type || 'DISCHARGE') === 'ADMIT' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('خدمة القبول (مطلوب)', 'Admit Service (required)')}</span>
                    <Select
                      value={admitServiceSelectValue}
                      onValueChange={(value) => {
                        setDispositionLocal((prev: ErDisposition | null) => ({ ...(prev || {}), type: 'ADMIT', admitService: value }));
                        saveDisposition({ admitService: value, type: 'ADMIT' });
                      }}
                    >
                      <SelectTrigger ref={admitServiceRef} className="rounded-xl" disabled={!canUpdateDisposition}>
                        <SelectValue placeholder={tr('اختر خدمة/وحدة', 'Select service/unit')} />
                      </SelectTrigger>
                      <SelectContent>
                        {admitServiceOptions.length ? (
                          admitServiceOptions.map((option) => (
                            <SelectItem key={option.id} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="__none__" disabled>
                            {tr('لا توجد خدمات متاحة', 'No services available')}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {missingSet.has('admitService') && (
                      <p className="text-xs text-destructive">{tr('مطلوب', 'Required')}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('جناح/وحدة القبول (مطلوب)', 'Admit Ward/Unit (required)')}</span>
                    <Select
                      value={admitWardValue}
                      onValueChange={(value) => {
                        setDispositionLocal((prev: ErDisposition | null) => ({ ...(prev || {}), type: 'ADMIT', admitWardUnit: value }));
                        saveDisposition({ admitWardUnit: value, type: 'ADMIT' });
                      }}
                    >
                      <SelectTrigger ref={admitWardUnitRef} className="rounded-xl" disabled={!canUpdateDisposition || !unitIdForDisposition}>
                        <SelectValue placeholder={unitIdForDisposition ? tr('اختر جناح/وحدة', 'Select ward/unit') : tr('اختر الخدمة أولاً', 'Select service first')} />
                      </SelectTrigger>
                      <SelectContent>
                        {admitWardOptions.length ? (
                          admitWardOptions.map((option) => (
                            <SelectItem key={option.id} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="__none__" disabled>
                            {tr('لا توجد أجنحة متاحة', 'No wards available')}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {missingSet.has('admitWardUnit') && (
                      <p className="text-xs text-destructive">{tr('مطلوب', 'Required')}</p>
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('سبب القبول (مطلوب)', 'Reason for Admission (required)')}</span>
                    <Textarea
                      ref={admitReasonRef}
                      value={disposition?.reasonForAdmission || ''}
                      disabled={!canUpdateDisposition}
                      onChange={(e) => {
                        const value = e.target.value;
                        setDispositionLocal((prev: ErDisposition | null) => ({
                          ...(prev || {}),
                          type: 'ADMIT',
                          reasonForAdmission: value,
                        }));
                        saveDisposition({ reasonForAdmission: value, type: 'ADMIT' });
                      }}
                      className="min-h-[120px] rounded-xl thea-input-focus"
                    />
                    {missingSet.has('reasonForAdmission') && (
                      <p className="text-xs text-destructive">{tr('مطلوب', 'Required')}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الطبيب المستقبل (اختياري)', 'Accepting Physician (optional)')}</span>
                    <Select
                      value={acceptingPhysicianSelectedId}
                      onValueChange={(value) => {
                        const selected = acceptingDoctorOptions.find((doc: any) => doc.id === value);
                        const label = selected?.displayName || selected?.id || '';
                        setDispositionLocal((prev: ErDisposition | null) => ({
                          ...(prev || {}),
                          type: 'ADMIT',
                          acceptingPhysician: label,
                        }));
                        saveDisposition({ acceptingPhysician: label, type: 'ADMIT' });
                      }}
                    >
                      <SelectTrigger className="rounded-xl" disabled={!canUpdateDisposition}>
                        <SelectValue placeholder={tr('اختر طبيب', 'Select physician')} />
                      </SelectTrigger>
                      <SelectContent>
                        {acceptingDoctorOptionsWithCustom.length ? (
                          acceptingDoctorOptionsWithCustom.map((option) => (
                            <SelectItem key={option.id} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="__none__" disabled>
                            {tr('لا يوجد أطباء متاحون', 'No physicians available')}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('طلب سرير', 'Bed Request')}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        disabled={!canUpdateDisposition}
                        onClick={() => saveDisposition({ bedRequestCreated: true, type: 'ADMIT' })}
                      >
                        {tr('إنشاء طلب سرير (طابع زمني)', 'Create Bed Request (timestamp)')}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {disposition?.bedRequestCreatedAt ? new Date(disposition.bedRequestCreatedAt).toLocaleString() : tr('لم يتم الإنشاء', 'Not created')}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('تسليم SBAR (مطلوب)', 'Handoff SBAR (required)')}</span>
                    <Textarea
                      ref={admitSbarRef}
                      value={disposition?.handoffSbar || ''}
                      disabled={!canUpdateDisposition}
                      onChange={(e) => {
                        const value = e.target.value;
                        setDispositionLocal((prev: ErDisposition | null) => ({ ...(prev || {}), type: 'ADMIT', handoffSbar: value }));
                        saveDisposition({ handoffSbar: value, type: 'ADMIT' });
                      }}
                      className="min-h-[160px] rounded-xl thea-input-focus"
                      placeholder={tr('الحالة / الخلفية / التقييم / التوصية', 'Situation / Background / Assessment / Recommendation')}
                    />
                    {missingSet.has('handoffSbar') && (
                      <p className="text-xs text-destructive">{tr('مطلوب', 'Required')}</p>
                    )}
                  </div>
                </div>
              )}

              {/* TRANSFER */}
              {(disposition?.type || 'DISCHARGE') === 'TRANSFER' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2" ref={transferTypeWrapRef}>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع النقل (مطلوب)', 'Transfer Type (required)')}</span>
                    <div className="flex flex-wrap gap-2">
                      {(['INTERNAL', 'EXTERNAL'] as const).map((t) => (
                        <Button
                          key={t}
                          type="button"
                          className="rounded-xl"
                          variant={disposition?.transferType === t ? 'default' : 'outline'}
                          disabled={!canUpdateDisposition}
                          onClick={() => {
                            setDispositionLocal((prev: ErDisposition | null) => ({ ...(prev || {}), type: 'TRANSFER', transferType: t }));
                            saveDisposition({ transferType: t, type: 'TRANSFER' });
                          }}
                        >
                          {t}
                        </Button>
                      ))}
                    </div>
                    {missingSet.has('transferType') && (
                      <p className="text-xs text-destructive">{tr('مطلوب', 'Required')}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المنشأة/الوحدة المقصودة (مطلوب)', 'Destination Facility/Unit (required)')}</span>
                    <Input
                      ref={transferDestinationRef}
                      className="rounded-xl thea-input-focus"
                      value={disposition?.destinationFacilityUnit || ''}
                      disabled={!canUpdateDisposition}
                      onChange={(e) => {
                        const value = e.target.value;
                        setDispositionLocal((prev: ErDisposition | null) => ({
                          ...(prev || {}),
                          type: 'TRANSFER',
                          destinationFacilityUnit: value,
                        }));
                        saveDisposition({ destinationFacilityUnit: value, type: 'TRANSFER' });
                      }}
                    />
                    {missingSet.has('destinationFacilityUnit') && (
                      <p className="text-xs text-destructive">{tr('مطلوب', 'Required')}</p>
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السبب (مطلوب)', 'Reason (required)')}</span>
                    <Textarea
                      ref={transferReasonRef}
                      value={disposition?.reason || ''}
                      disabled={!canUpdateDisposition}
                      onChange={(e) => {
                        const value = e.target.value;
                        setDispositionLocal((prev: ErDisposition | null) => ({ ...(prev || {}), type: 'TRANSFER', reason: value }));
                        saveDisposition({ reason: value, type: 'TRANSFER' });
                      }}
                      className="min-h-[120px] rounded-xl thea-input-focus"
                    />
                    {missingSet.has('reason') && (
                      <p className="text-xs text-destructive">{tr('مطلوب', 'Required')}</p>
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('تسليم SBAR (مطلوب)', 'Handoff SBAR (required)')}</span>
                    <Textarea
                      ref={transferSbarRef}
                      value={disposition?.handoffSbar || ''}
                      disabled={!canUpdateDisposition}
                      onChange={(e) => {
                        const value = e.target.value;
                        setDispositionLocal((prev: ErDisposition | null) => ({ ...(prev || {}), type: 'TRANSFER', handoffSbar: value }));
                        saveDisposition({ handoffSbar: value, type: 'TRANSFER' });
                      }}
                      className="min-h-[160px] rounded-xl thea-input-focus"
                    />
                    {missingSet.has('handoffSbar') && (
                      <p className="text-xs text-destructive">{tr('مطلوب', 'Required')}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground text-base">{tr('معاينة ملخص الخروج', 'Preview Discharge Summary')}</h2>
                <div className="space-y-2">
                  <Textarea value={previewDischargeSummary} readOnly className="min-h-[140px] rounded-xl thea-input-focus" />
                  <div className="text-xs text-muted-foreground">
                    {dispositionSaving ? tr('جاري الحفظ...', 'Saving...') : dispositionError ? `${tr('خطأ:', 'Error:')} ${dispositionError}` : tr('تم الحفظ تلقائياً', 'Autosaved')}
                    {dispositionValidation && !dispositionValidation.isValid && (
                      <span className="ml-2">
                        {tr('مفقود:', 'Missing:')} {dispositionValidation.missing.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  className="rounded-xl"
                  disabled={!canUpdateDisposition || dispositionSaving || statusUpdating}
                  onClick={() => handleFinalizeClick('DISCHARGED')}
                >
                  {tr('إنهاء الخروج', 'Finalize Discharge')}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={!canUpdateDisposition || dispositionSaving || statusUpdating}
                  onClick={() => handleFinalizeClick('ADMITTED')}
                >
                  {tr('إنهاء القبول', 'Finalize Admit')}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={!canUpdateDisposition || dispositionSaving || statusUpdating}
                  onClick={() => handleFinalizeClick('TRANSFERRED')}
                >
                  {tr('إنهاء النقل', 'Finalize Transfer')}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl bg-black text-white hover:bg-black/90 border-black"
                  disabled={!canUpdateDisposition || dispositionSaving || statusUpdating}
                  onClick={() => handleFinalizeClick('DEATH')}
                >
                  {tr('وفاة', 'Death')}
                </Button>
              </div>
            </div>
          </div>
        )}

        <Dialog open={clinicalOpen} onOpenChange={setClinicalOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>{tr('إضافة ملاحظة سريرية', 'Add Clinical Note')}</DialogTitle>
              <DialogDescription>{tr('ملاحظة إضافة فقط لزيارة الطوارئ.', 'Append-only note for ER visit.')}</DialogDescription>
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
              <Button variant="outline" className="rounded-xl" onClick={() => setClinicalOpen(false)}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button className="rounded-xl" onClick={addClinicalNote} disabled={clinicalBusy || !clinicalContent.trim()}>
                {clinicalBusy ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ الملاحظة', 'Save Note')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deathDeclareOpen} onOpenChange={setDeathDeclareOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>{tr('إعلان الوفاة', 'Declare Death')}</DialogTitle>
              <DialogDescription>{tr('إعلان إضافة فقط.', 'Append-only declaration.')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('تاريخ/وقت الوفاة', 'Death Date/Time')}</span>
                <Input className="rounded-xl thea-input-focus" value={deathDateTime} onChange={(e) => setDeathDateTime(e.target.value)} placeholder="YYYY-MM-DD HH:mm" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('مكان الوفاة', 'Place of Death')}</span>
                <Select value={deathPlace} onValueChange={(value) => setDeathPlace(value as typeof deathPlace)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={tr('المكان', 'Place')} />
                  </SelectTrigger>
                  <SelectContent>
                    {DEATH_PLACES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السبب الأولي', 'Preliminary Cause')}</span>
                <Textarea className="rounded-xl thea-input-focus" value={deathCause} onChange={(e) => setDeathCause(e.target.value)} />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ملاحظات', 'Notes')}</span>
                <Textarea className="rounded-xl thea-input-focus" value={deathNotes} onChange={(e) => setDeathNotes(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => setDeathDeclareOpen(false)}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button className="rounded-xl" onClick={declareDeath} disabled={deathBusy}>
                {deathBusy ? tr('جاري الحفظ...', 'Saving...') : tr('إعلان', 'Declare')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deathFinalizeOpen} onOpenChange={setDeathFinalizeOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>{tr('إنهاء الوفاة', 'Finalize Death')}</DialogTitle>
              <DialogDescription>{tr('ينشئ حالة مشرحة ويغلق الزيارة.', 'Creates mortuary case and closes visit.')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => setDeathFinalizeOpen(false)}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button className="rounded-xl" onClick={finalizeDeath} disabled={deathBusy}>
                {deathBusy ? tr('جاري الحفظ...', 'Saving...') : tr('إنهاء', 'Finalize')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dischargeOpen} onOpenChange={setDischargeOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>{tr('إنهاء الخروج', 'Finalize Discharge')}</DialogTitle>
              <DialogDescription>{tr('ملخص خروج إضافة فقط.', 'Append-only discharge summary.')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التصرف', 'Disposition')}</span>
                <Select value={dischargeDisposition} onValueChange={(value) => setDischargeDisposition(value as typeof dischargeDisposition)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={tr('التصرف', 'Disposition')} />
                  </SelectTrigger>
                  <SelectContent>
                    {DISPOSITION_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الملخص', 'Summary')}</span>
                <Textarea className="rounded-xl thea-input-focus" value={dischargeSummaryText} onChange={(e) => setDischargeSummaryText(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => setDischargeOpen(false)}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button className="rounded-xl" onClick={finalizeDischarge} disabled={dischargeBusy}>
                {dischargeBusy ? tr('جاري الحفظ...', 'Saving...') : tr('إنهاء', 'Finalize')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={admitOpen}
          onOpenChange={(open) => {
            setAdmitOpen(open);
            if (!open && pendingFinalizeStatus === 'ADMITTED') {
              setPendingFinalizeStatus(null);
            }
          }}
        >
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>{tr('القبول في التنويم', 'Admit to IPD')}</DialogTitle>
              <DialogDescription>{tr('إنشاء حلقة تنويم من هذه الزيارة.', 'Create an IPD episode from this visit.')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الخدمة / الوحدة', 'Service / Unit')}</span>
                <Select value={admitServiceUnitSelectValue} onValueChange={setAdmitServiceUnit}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={tr('اختر خدمة/وحدة', 'Select service/unit')} />
                  </SelectTrigger>
                  <SelectContent>
                    {admitServiceUnitOptions.length ? (
                      admitServiceUnitOptions.map((option) => (
                        <SelectItem key={option.id} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__none__" disabled>
                        {tr('لا توجد خدمات متاحة', 'No services available')}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الطبيب المعالج', 'Admitting Doctor')}</span>
                <Select value={admitDoctorId} onValueChange={setAdmitDoctorId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={tr('اختر طبيب', 'Select doctor')} />
                  </SelectTrigger>
                  <SelectContent>
                    {admitDoctorOptions.length ? (
                      admitDoctorOptions.map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.displayName || u.id}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__none__" disabled>
                        {tr('لا يوجد أطباء متاحون', 'No doctors available')}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('فئة السرير (اختياري)', 'Bed Class (optional)')}</span>
                <Input className="rounded-xl thea-input-focus" value={admitBedClass} onChange={(e) => setAdmitBedClass(e.target.value)} placeholder={tr('مثال: عام', 'e.g. General')} />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ملاحظات (اختياري)', 'Notes (optional)')}</span>
                <Textarea className="rounded-xl thea-input-focus" value={admitNotes} onChange={(e) => setAdmitNotes(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => setAdmitOpen(false)}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button className="rounded-xl" onClick={submitAdmit} disabled={admitBusy}>
                {admitBusy ? tr('جاري الحفظ...', 'Saving...') : tr('قبول', 'Admit')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </ErPageShell>
  );
}
