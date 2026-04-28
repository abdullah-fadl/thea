'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-modal';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useOpdEvents } from '@/hooks/useOpdEvents';
import type { VitalsValidationResult } from '@/lib/clinical/vitalsValidation';
import { getFieldAlert, suggestPriority, type FieldAlert } from '@/lib/clinical/vitalsValidation';
import { ConsentForm, type ConsentData } from '@/components/consent/ConsentForm';
import { CONSENT_TYPES } from '@/lib/clinical/consentTypes';
import { VitalsEntry, type VitalsEntryValues } from '@/components/clinical/VitalsEntry';
import { ProcedureQueue } from '@/components/opd/ProcedureQueue';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Heart,
  Clock,
  User,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Timer,
  Stethoscope,
  X,
  Clipboard,
  FileText,
  PauseCircle,
  CalendarDays,
  Eye,
  Lock,
  FileCheck,
  Plus,
  Syringe,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { getAge, formatGender, formatDateLabel, timeAgo, addDaysToDateString } from '@/lib/opd/ui-helpers';
import { getVisitTypeConfig, getSourceTypeConfig } from '@/lib/opd/ui-config';
import { TheaKpiCard } from '@/components/thea-ui';
import { MEWSBadge } from '@/components/nursing/MEWSBadge';
import { CONSCIOUSNESS_OPTIONS, type ConsciousnessLevel, vitalsToMEWSInput, calculateMEWS } from '@/lib/clinical/mewsCalculator';
import { FallRiskAssessment } from '@/components/nursing/FallRiskAssessment';
import { GCSAssessment } from '@/components/nursing/GCSAssessment';
import { SBARForm } from '@/components/nursing/SBARForm';
import type { SBARData } from '@/lib/clinical/sbarTemplate';
import { VisitHistoryTimeline } from '@/components/nursing/VisitHistoryTimeline';
import { VitalsTrendAlert } from '@/components/nursing/VitalsTrendAlert';
import { PainAssessment } from '@/components/nursing/PainAssessment';
import type { PainEntry } from '@/lib/clinical/painAssessment';
import { FamilyCommunicationLog } from '@/components/nursing/FamilyCommunicationLog';
import type { FamilyCommData } from '@/lib/clinical/familyCommunication';
import { BedsideProcedureChecklist } from '@/components/nursing/BedsideProcedureChecklist';
import type { ProceduresData } from '@/lib/clinical/bedsideProcedures';
import { IntakeOutputTracker } from '@/components/nursing/IntakeOutputTracker';
import type { IOData } from '@/lib/clinical/intakeOutput';
import { BradenAssessment } from '@/components/nursing/BradenAssessment';
import type { BradenResult } from '@/lib/clinical/bradenScale';
import { NursingCarePlan } from '@/components/nursing/NursingCarePlan';
import type { CarePlanData } from '@/lib/clinical/nursingCarePlan';
import { ShiftHandover } from '@/components/nursing/ShiftHandover';
import type { ShiftHandoverData } from '@/lib/clinical/shiftHandover';
import { NursingTaskTimeline } from '@/components/nursing/NursingTaskTimeline';
import type { NursingTasksData } from '@/lib/clinical/nursingTasks';
import { DeteriorationAlert } from '@/components/nursing/DeteriorationAlert';
import { WorkloadDashboard } from '@/components/nursing/WorkloadDashboard';
import { SepsisScreening } from '@/components/nursing/SepsisScreening';
import { MedicationAdminRecord } from '@/components/nursing/MedicationAdminRecord';
import type { MARData } from '@/lib/clinical/medicationAdminRecord';
import { useNursingModules } from '@/lib/hooks/useNursingModules';
import type { GCSResult, GCSInput } from '@/lib/clinical/gcsCalculator';
import type { FallRiskResult, MorseFallInput, HumptyDumptyInput } from '@/lib/clinical/fallRiskCalculator';
import type { LucideIcon } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// ── Local interfaces for OPD Nurse Station data shapes ──

/** Shape of a nursing entry coming from the API (OpdNursingEntry Prisma model serialized as JSON) */
interface OpdNursingEntryData {
  id: string;
  nursingNote?: string | null;
  chiefComplaintShort?: string | null;
  painScore?: number | null;
  painLocation?: string | null;
  fallRiskScore?: number | null;
  fallRiskData?: (FallRiskResult & { input?: MorseFallInput | HumptyDumptyInput; morseInput?: MorseFallInput; humptyInput?: HumptyDumptyInput }) | null;
  consciousness?: string | null;
  onSupplementalO2?: boolean;
  gcsScore?: number | null;
  gcsCategory?: string | null;
  gcsData?: (GCSResult & { input: GCSInput }) | null;
  sbarData?: SBARData | null;
  painData?: PainEntry | null;
  familyCommData?: FamilyCommData | null;
  proceduresData?: ProceduresData | null;
  ioData?: IOData | null;
  bradenData?: BradenResult | null;
  carePlanData?: CarePlanData | null;
  handoverData?: ShiftHandoverData | null;
  nursingTasksData?: NursingTasksData | null;
  marData?: MARData | null;
  vitals?: Record<string, string | number | null> | null;
  pfe?: Record<string, unknown> | null;
  timeOutChecklist?: Record<string, unknown> | null;
  isCorrected?: boolean;
  correctionReason?: string | null;
  createdAt?: string | null;
}

/** Shape of the patient sub-object in a queue row */
interface OpdQueuePatient {
  id: string;
  fullName?: string | null;
  dob?: string | null;
  gender?: string | null;
  mrn?: string | null;
  ageYears?: number | null;
}

/** Shape of a single row from the /api/opd/nursing/worklist response */
interface OpdQueueRow {
  bookingId: string;
  bookingTypeLabel?: string | null;
  sourceType?: string | null;
  clinicId?: string | null;
  clinicName?: string | null;
  startAt?: string | null;
  checkedInAt?: string | null;
  encounterCoreId?: string | null;
  encounterCoreStatus?: string | null;
  visitType?: string | null;
  doctorName?: string | null;
  isArrived?: boolean;
  isCheckedIn?: boolean;
  status?: string | null;
  waitingStartAt?: string | null;
  waitingSinceLabel?: string | null;
  waitingToNursingMinutes?: number | null;
  waitingToDoctorMinutes?: number | null;
  patient?: OpdQueuePatient | null;
  patientMasterId?: string | null;
  opdFlowState?: string | null;
  latestAllergies?: string | null;
  latestVitals?: Record<string, unknown> | null;
  criticalVitalsFlag?: { active?: boolean } | null;
  priority?: string | null;
  opdClinicExtensions?: Record<string, unknown> | null;
  latestNursingEntry?: OpdNursingEntryData | null;
  opdNursingEntries?: OpdNursingEntryData[];
  specialtyCode?: string | null;
}

/** Tab key union used for the step-by-step nurse workflow */
type NurseStationTab = 'vitals' | 'assessment' | 'timeout' | 'pfe';

/** Clinic metadata from /api/opd/booking/metadata */
interface ClinicMeta {
  id: string;
  name?: string | null;
  specialtyCode?: string | null;
}

// ── B7: Structured PFE (Patient & Family Education) ──

const PFE_EDUCATION_TOPICS = [
  { key: 'patientRights', label: 'حقوق المريض', labelEn: 'Patient Rights' },
  { key: 'treatmentPlan', label: 'خطة العلاج', labelEn: 'Treatment Plan' },
  { key: 'medications', label: 'الأدوية', labelEn: 'Medications' },
  { key: 'nutrition', label: 'التغذية', labelEn: 'Nutrition' },
  { key: 'painManagement', label: 'إدارة الألم', labelEn: 'Pain Management' },
  { key: 'patientSafety', label: 'سلامة المريض', labelEn: 'Patient Safety' },
  { key: 'infectionControl', label: 'مكافحة العدوى', labelEn: 'Infection Control' },
  { key: 'followUp', label: 'مواعيد المتابعة', labelEn: 'Follow-up Appointments' },
  { key: 'dangerSigns', label: 'علامات الخطر', labelEn: 'Danger Signs' },
] as const;

const PFE_METHODS = [
  { key: 'verbal', label: 'شفهي', labelEn: 'Verbal' },
  { key: 'written', label: 'مكتوب', labelEn: 'Written' },
  { key: 'video', label: 'فيديو', labelEn: 'Video' },
  { key: 'brochure', label: 'مطوية', labelEn: 'Brochure' },
  { key: 'demonstration', label: 'عرض عملي', labelEn: 'Demonstration' },
] as const;

const PFE_LANGUAGES = [
  { key: 'ar', label: 'عربي', labelEn: 'Arabic' },
  { key: 'en', label: 'إنجليزي', labelEn: 'English' },
  { key: 'other', label: 'أخرى', labelEn: 'Other' },
] as const;

const PFE_BARRIERS = [
  { key: 'illiteracy', label: 'أمية', labelEn: 'Illiteracy' },
  { key: 'language', label: 'حاجز لغوي', labelEn: 'Language Barrier' },
  { key: 'hearing', label: 'ضعف سمع', labelEn: 'Hearing Impairment' },
  { key: 'vision', label: 'ضعف بصر', labelEn: 'Vision Impairment' },
  { key: 'cognitive', label: 'ضعف إدراك', labelEn: 'Cognitive Impairment' },
  { key: 'emotional', label: 'حالة نفسية', labelEn: 'Emotional State' },
  { key: 'cultural', label: 'عوامل ثقافية', labelEn: 'Cultural Factors' },
] as const;

const PFE_UNDERSTANDING = [
  { key: 'full', label: 'فهم كامل', labelEn: 'Full Understanding' },
  { key: 'partial', label: 'فهم جزئي', labelEn: 'Partial Understanding' },
  { key: 'none', label: 'لم يفهم', labelEn: 'Did Not Understand' },
  { key: 'refused', label: 'رفض', labelEn: 'Refused' },
] as const;

interface PfeData {
  allergies: { hasNone: boolean; details: string };
  medications: { hasNone: boolean; details: string };
  history: { hasNone: boolean; details: string };
  educationTopics: string[];
  method: string;
  language: string;
  barriers: string[];
  understanding: string;
  confirmed: boolean;
}

const DEFAULT_PFE: PfeData = {
  allergies: { hasNone: false, details: '' },
  medications: { hasNone: false, details: '' },
  history: { hasNone: false, details: '' },
  educationTopics: [],
  method: 'verbal',
  language: 'ar',
  barriers: [],
  understanding: '',
  confirmed: false,
};

function useValueFlash(value: number, durationMs = 550) {
  const prevRef = useRef<number>(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), durationMs);
      return () => window.clearTimeout(t);
    }
    prevRef.current = value;
  }, [value, durationMs]);

  return flash;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; dot: string; priority: number }
> = {
  WAITING_NURSE: {
    label: 'ينتظر',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    priority: 1,
  },
  IN_NURSING: {
    label: 'قيد التنفيذ',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    dot: 'bg-blue-500 animate-pulse',
    priority: 2,
  },
  READY_FOR_DOCTOR: {
    label: 'جاهز',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    priority: 3,
  },
  CHECKED_IN: {
    label: 'تم الحضور',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    dot: 'bg-purple-500',
    priority: 3,
  },
};

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getUrgencyColor(minutes?: number | null) {
  if (typeof minutes !== 'number') return 'text-muted-foreground';
  if (minutes > 30) return 'text-red-600 font-semibold';
  if (minutes > 15) return 'text-amber-600';
  return 'text-muted-foreground';
}

function parseAllergies(value?: string | null) {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getRowStatus(row: OpdQueueRow) {
  if (row?.opdFlowState) return row.opdFlowState;
  if (row?.isCheckedIn) return 'CHECKED_IN';
  return row?.status || 'CHECKED_IN';
}

function KPICard({
  icon: Icon,
  label,
  value,
  color,
  subtext,
  flash,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  color: string;
  subtext?: string;
  flash?: boolean;
}) {
  return (
    <div
      className={`bg-card rounded-2xl border border-border p-4 flex items-center gap-4 thea-hover-lift
        ${flash ? 'ring-2 ring-primary/30 border-primary shadow-md shadow-primary/10' : ''}`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {subtext ? <div className="text-xs text-muted-foreground/70 mt-0.5">{subtext}</div> : null}
      </div>
    </div>
  );
}

function getStatusLabel(status: string, language: 'ar' | 'en') {
  const labels: Record<string, { ar: string; en: string }> = {
    WAITING_NURSE: { ar: 'ينتظر', en: 'Waiting' },
    IN_NURSING: { ar: 'قيد التنفيذ', en: 'In progress' },
    READY_FOR_DOCTOR: { ar: 'جاهز', en: 'Ready' },
    CHECKED_IN: { ar: 'تم الحضور', en: 'Checked in' },
  };
  const entry = labels[status] || labels.CHECKED_IN;
  return language === 'ar' ? entry.ar : entry.en;
}

function StatusBadge({ status, language }: { status: string; language: 'ar' | 'en' }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.CHECKED_IN;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {getStatusLabel(status, language)}
    </span>
  );
}

function AllergyBadge({ allergies, language }: { allergies: string[]; language: 'ar' | 'en' }) {
  if (!allergies.length) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-200">
      <AlertCircle size={11} />
      {allergies.length} {language === 'ar' ? (allergies.length === 1 ? 'حساسية' : 'حساسيات') : 'allergy'}
    </span>
  );
}

function PatientCard({
  patient: row,
  onOpen,
  isSelected,
  isNew,
  language,
}: {
  patient: OpdQueueRow;
  onOpen: (row: OpdQueueRow) => void;
  isSelected: boolean;
  isNew?: boolean;
  language: 'ar' | 'en';
}) {
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const waitMins = row.waitingToNursingMinutes || 0;
  const status = getRowStatus(row);
  const allergies = parseAllergies(row.latestAllergies);
  return (
    <motion.button
      onClick={() => onOpen(row)}
      layout="position"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`w-full text-left bg-card rounded-2xl border-2 thea-transition-fast p-4
        ${isSelected ? 'border-primary shadow-lg shadow-primary/10' : 'border-border hover:border-muted-foreground/30 thea-hover-lift'}
        ${isNew ? 'ring-2 ring-emerald-200 border-emerald-200' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-foreground truncate">{row.patient?.fullName}</span>
            {row.criticalVitalsFlag?.active && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-red-600 text-white rounded animate-pulse">
                {tr('حرج', 'Critical')}
              </span>
            )}
            {row.priority && row.priority !== 'NORMAL' && (
              <span className={`ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded ${
                row.priority === 'URGENT' ? 'bg-red-100 text-red-800' :
                row.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                row.priority === 'LOW' ? 'bg-blue-100 text-blue-800' : ''
              }`}>
                {row.priority === 'URGENT' ? 'عاجل' : row.priority === 'HIGH' ? 'مرتفع' : 'منخفض'}
              </span>
            )}
            <span className="text-xs text-muted-foreground shrink-0">
              {getAge(row.patient?.dob)}y • {formatGender(row.patient?.gender)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">{row.patient?.mrn}</div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusBadge status={status} language={language} />
          {row.latestNursingEntry?.vitals && (
            <MEWSBadge vitals={row.latestNursingEntry.vitals} consciousness={row.latestNursingEntry?.consciousness as ConsciousnessLevel | undefined} onSupplementalO2={row.latestNursingEntry?.onSupplementalO2} compact />
          )}
          {row.latestNursingEntry?.gcsData && (
            <GCSAssessment initialData={row.latestNursingEntry.gcsData} compact />
          )}
          {row.latestNursingEntry?.painData && (
            <PainAssessment value={row.latestNursingEntry.painData} onChange={() => {}} compact />
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1">
          <Stethoscope size={12} />
          {row.doctorName || '—'}
          {row.clinicName ? (
            <span className="text-muted-foreground/80">• {row.clinicName}</span>
          ) : null}
        </span>
        <span className="flex items-center gap-1">
          <FileText size={12} />
          {language === 'en' && getVisitTypeConfig(row.visitType).labelEn
            ? getVisitTypeConfig(row.visitType).labelEn
            : getVisitTypeConfig(row.visitType).label}
        </span>
        {row.sourceType ? (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getSourceTypeConfig(row.sourceType).color}`}>
            {language === 'en' ? getSourceTypeConfig(row.sourceType).labelEn : getSourceTypeConfig(row.sourceType).label}
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AllergyBadge allergies={allergies} language={language} />
          {!allergies.length ? (
            <span className="text-xs text-emerald-500 flex items-center gap-1">
              <CheckCircle2 size={12} /> NKA
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={12} className={getUrgencyColor(waitMins)} />
          <span className={`text-xs ${getUrgencyColor(waitMins)}`}>{timeAgo(row.waitingStartAt || row.checkedInAt, language)}</span>
          <ChevronRight size={14} className="text-muted-foreground" />
        </div>
      </div>
    </motion.button>
  );
}

function PatientRow({
  patient: row,
  onOpen,
  isSelected,
  isNew,
  language,
}: {
  patient: OpdQueueRow;
  onOpen: (row: OpdQueueRow) => void;
  isSelected: boolean;
  isNew?: boolean;
  language: 'ar' | 'en';
}) {
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const waitMins = row.waitingToNursingMinutes || 0;
  const status = getRowStatus(row);
  const allergies = parseAllergies(row.latestAllergies);
  return (
    <motion.tr
      onClick={() => onOpen(row)}
      layout="position"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`cursor-pointer thea-transition-fast group ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'} ${isNew ? 'bg-emerald-50/40' : ''}`}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white
              ${row.patient?.gender === 'MALE' ? 'bg-blue-500' : 'bg-pink-500'}`}
          >
            {(row.patient?.fullName || '?')[0]}
          </div>
          <div>
            <div className="font-medium text-foreground group-hover:text-primary thea-transition-fast">
              {row.patient?.fullName}
              {row.criticalVitalsFlag?.active && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-red-600 text-white rounded animate-pulse">
                  {tr('حرج', 'Critical')}
                </span>
              )}
              {row.priority && row.priority !== 'NORMAL' && (
                <span className={`ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded ${
                  row.priority === 'URGENT' ? 'bg-red-100 text-red-800' :
                  row.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                  row.priority === 'LOW' ? 'bg-blue-100 text-blue-800' : ''
                }`}>
                  {row.priority === 'URGENT' ? (language === 'ar' ? 'عاجل' : 'Urgent') : row.priority === 'HIGH' ? (language === 'ar' ? 'مرتفع' : 'High') : (language === 'ar' ? 'منخفض' : 'Low')}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {row.patient?.mrn} • {getAge(row.patient?.dob)}y • {formatGender(row.patient?.gender)}
            </div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusBadge status={status} language={language} />
          {row.latestNursingEntry?.vitals && (
            <MEWSBadge vitals={row.latestNursingEntry.vitals} consciousness={row.latestNursingEntry?.consciousness as ConsciousnessLevel | undefined} onSupplementalO2={row.latestNursingEntry?.onSupplementalO2} compact />
          )}
          {row.latestNursingEntry?.gcsData && (
            <GCSAssessment initialData={row.latestNursingEntry.gcsData} compact />
          )}
          {row.latestNursingEntry?.painData && (
            <PainAssessment value={row.latestNursingEntry.painData} onChange={() => {}} compact />
          )}
        </div>
      </td>
      <td className="py-3 px-4 text-sm text-muted-foreground">
          {row.doctorName || '—'}
          {row.clinicName ? (
            <span className="text-muted-foreground/80"> • {row.clinicName}</span>
          ) : null}
        </td>
      <td className="py-3 px-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
              ${['NEW', 'FVC', 'FVH'].includes(String(row.visitType || '').toUpperCase()) ? 'bg-blue-50 text-blue-700' : 'bg-muted text-muted-foreground'}`}
          >
            {language === 'en' && getVisitTypeConfig(row.visitType).labelEn
              ? getVisitTypeConfig(row.visitType).labelEn
              : getVisitTypeConfig(row.visitType).label}
          </span>
          {row.sourceType ? (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSourceTypeConfig(row.sourceType).color}`}>
              {language === 'en' ? getSourceTypeConfig(row.sourceType).labelEn : getSourceTypeConfig(row.sourceType).label}
            </span>
          ) : null}
        </div>
      </td>
      <td className="py-3 px-4">
        <AllergyBadge allergies={allergies} language={language} />
        {!allergies.length ? (
          <span className="text-xs text-emerald-500 flex items-center gap-1">
            <CheckCircle2 size={12} /> NKA
          </span>
        ) : null}
      </td>
      <td className="py-3 px-4">
        <div className={`flex items-center gap-1.5 ${getUrgencyColor(waitMins)}`}>
          <Timer size={14} />
          <span className="text-sm">{timeAgo(row.waitingStartAt || row.checkedInAt, language)}</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary thea-transition-fast" />
      </td>
    </motion.tr>
  );
}

function CalendarDropdown({
  selectedDate,
  onSelect,
  onClose,
  alignLeft,
  language,
}: {
  selectedDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
  alignLeft: boolean;
  language: 'ar' | 'en';
}) {
  const _now = new Date();
  const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
  const selected = new Date(`${selectedDate}T00:00:00`);
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const month = viewMonth === 0 ? 11 : viewMonth - 1;
    const year = viewMonth === 0 ? viewYear - 1 : viewYear;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ day, dateStr, isCurrentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ day, dateStr, isCurrentMonth: true });
  }
  const remaining = 42 - cells.length;
  for (let day = 1; day <= remaining; day++) {
    const month = viewMonth === 11 ? 0 : viewMonth + 1;
    const year = viewMonth === 11 ? viewYear + 1 : viewYear;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ day, dateStr, isCurrentMonth: false });
  }

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };
  const goToNextMonth = () => {
    const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
    const firstOfNext = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01`;
    if (firstOfNext > todayStr) return;
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const canGoNext = (() => {
    const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
    return `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01` <= todayStr;
  })();

  return (
    <div
      className={`absolute top-full mt-2 ${alignLeft ? 'left-0' : 'right-0'} z-50 bg-card rounded-2xl shadow-xl border border-border p-4 w-[320px] thea-animate-slide-up`}
    >
      <div className="flex items-center justify-between mb-3">
        <button onClick={goToPrevMonth} className="p-1.5 hover:bg-muted rounded-xl thea-transition-fast">
          <ChevronLeft size={16} className="text-muted-foreground" />
        </button>
        <div className="text-sm font-semibold text-foreground">
          {MONTHS[viewMonth]} {viewYear}
        </div>
        <button onClick={goToNextMonth} disabled={!canGoNext} className="p-1.5 hover:bg-muted rounded-xl thea-transition-fast disabled:opacity-30">
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1.5">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell, idx) => {
          const isSelected = cell.dateStr === selectedDate;
          const isTodayCell = cell.dateStr === todayStr;
          const isFuture = cell.dateStr > todayStr;
          const disabled = isFuture || !cell.isCurrentMonth;
          return (
            <button
              key={idx}
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                onSelect(cell.dateStr);
                onClose();
              }}
              className={`relative w-full aspect-square flex items-center justify-center rounded-xl text-sm thea-transition-fast
                ${disabled
                  ? 'text-muted-foreground/40 cursor-default'
                  : isSelected
                    ? 'bg-primary text-white font-bold shadow-lg shadow-primary/30'
                    : isTodayCell
                      ? 'ring-2 ring-primary bg-primary/10 text-primary font-semibold hover:bg-primary/20'
                      : 'text-foreground hover:bg-muted font-medium'
                }`}
            >
              {cell.day}
              {isTodayCell && !isSelected ? (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 mt-3 pt-3 border-t border-border">
        <button
          onClick={() => {
            onSelect(todayStr);
            onClose();
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-medium thea-transition-fast ${
            selectedDate === todayStr ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {language === 'ar' ? 'اليوم' : 'Today'}
        </button>
        <button
          onClick={() => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            onSelect(d.toISOString().slice(0, 10));
            onClose();
          }}
          className="flex-1 py-2 rounded-xl text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 thea-transition-fast"
        >
          {language === 'ar' ? 'أمس' : 'Yesterday'}
        </button>
        <button
          onClick={() => {
            const d = new Date();
            d.setDate(d.getDate() - 7);
            onSelect(d.toISOString().slice(0, 10));
            onClose();
          }}
          className="flex-1 py-2 rounded-xl text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 thea-transition-fast"
        >
          {language === 'ar' ? 'قبل 7 أيام' : '7 days ago'}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ clinicName, language = 'en' }: { clinicName: string; language?: 'ar' | 'en' }) {
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mb-5">
        <Stethoscope size={32} className="text-muted-foreground" />
      </div>
      <div className="text-lg font-semibold text-foreground mb-2">{tr('لا يوجد مرضى منتظرين', 'No patients waiting')}</div>
      <div className="text-sm text-muted-foreground max-w-sm">
        {tr(
          `لا يوجد مرضى مسجلين في `,
          `No patients registered in `
        )}
        <span className="font-medium">{clinicName}</span>
        {tr(
          ` اليوم. سيظهر المرضى الجدد هنا تلقائياً عند تسجيل الحضور.`,
          ` today. New patients will appear here automatically upon check-in.`
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-muted rounded-xl" />
              <div className="space-y-2">
                <div className="w-8 h-6 bg-muted rounded" />
                <div className="w-16 h-3 bg-muted/60 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-4">
          <div className="w-9 h-9 bg-muted rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="w-40 h-4 bg-muted rounded" />
            <div className="w-24 h-3 bg-muted/60 rounded" />
          </div>
          <div className="w-20 h-6 bg-muted rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function NurseStation() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const { prompt: showPrompt } = useConfirm();
  const { hasPermission, isLoading } = useRoutePermission('/opd/nurse-station');
  const { show } = useNursingModules('OPD');

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [selectedDate, setSelectedDate] = useState(today);
  const [clinicId, setClinicId] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(15);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<OpdQueueRow | null>(null);
  const [activeTab, setActiveTab] = useState<NurseStationTab>('vitals');
  const [stationView, setStationView] = useState<'nursing' | 'procedures'>('nursing');
  const [busyStart, setBusyStart] = useState(false);
  const [busyReady, setBusyReady] = useState(false);
  const [busySave, setBusySave] = useState(false);
  const [busyOph, setBusyOph] = useState(false);

  const [vitals, setVitals] = useState<VitalsEntryValues>({
    bp: '',
    hr: '',
    rr: '',
    temp: '',
    spo2: '',
    weight: '',
    height: '',
    painScore: null,
    painLocation: '',
    glucose: '',
    headCircumference: '',
    fetalHr: '',
    fundalHeight: '',
  });
  const [validation, setValidation] = useState<VitalsValidationResult | null>(null);
  const [consciousness, setConsciousness] = useState<ConsciousnessLevel>('ALERT');
  const [onSupplementalO2, setOnSupplementalO2] = useState(false);
  const [chief, setChief] = useState('');
  const [fallRisk, setFallRisk] = useState<number | null>(null);
  const [fallRiskData, setFallRiskData] = useState<(FallRiskResult & { input?: MorseFallInput | HumptyDumptyInput; morseInput?: MorseFallInput; humptyInput?: HumptyDumptyInput }) | null>(null);
  const [gcsData, setGcsData] = useState<(GCSResult & { input: GCSInput }) | null>(null);
  const [sbarData, setSbarData] = useState<SBARData | null>(null);
  const [painData, setPainData] = useState<PainEntry | null>(null);
  const [familyCommData, setFamilyCommData] = useState<FamilyCommData | null>(null);
  const [proceduresData, setProceduresData] = useState<ProceduresData | null>(null);
  const [ioData, setIoData] = useState<IOData | null>(null);
  const [bradenData, setBradenData] = useState<BradenResult | null>(null);
  const [carePlanData, setCarePlanData] = useState<CarePlanData | null>(null);
  const [handoverData, setHandoverData] = useState<ShiftHandoverData | null>(null);
  const [nursingTasksData, setNursingTasksData] = useState<NursingTasksData | null>(null);
  const [marData, setMarData] = useState<MARData | null>(null);
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState<string>('');
  const [priorityManual, setPriorityManual] = useState(false);
  const [pfe, setPfe] = useState<PfeData>({ ...DEFAULT_PFE });
  const [timeOutData, setTimeOutData] = useState({
    // Phase 1: Sign In (nurse only, before anesthesia)
    patientIdentified: false,
    procedureConfirmed: false,
    siteMarked: false,
    consentSigned: false,
    allergiesReviewed: false,
    // Phase 2: Time Out (nurse + doctor, before procedure)
    teamConfirmed: false,
    patientProcedureConfirmed: false,
    antibioticsGiven: false,
    imagingReviewed: false,
    anticipatedEvents: false,
    // Phase 3: Sign Out (nurse + doctor, after procedure)
    procedureRecorded: false,
    instrumentCount: false,
    specimenLabeled: false,
    equipmentIssues: false,
    recoveryPlan: false,
  });
  const [ophVisualAcuityOD, setOphVisualAcuityOD] = useState('');
  const [ophVisualAcuityOS, setOphVisualAcuityOS] = useState('');
  const [ophBcvaOD, setOphBcvaOD] = useState('');
  const [ophBcvaOS, setOphBcvaOS] = useState('');
  const [ophNearVisionOD, setOphNearVisionOD] = useState('');
  const [ophNearVisionOS, setOphNearVisionOS] = useState('');
  const [ophRefractionOD, setOphRefractionOD] = useState('');
  const [ophRefractionOS, setOphRefractionOS] = useState('');
  const [ophIopOD, setOphIopOD] = useState('');
  const [ophIopOS, setOphIopOS] = useState('');
  const [ophPD, setOphPD] = useState('');
  const [ophColorVision, setOphColorVision] = useState('');
  // Additional optometry-specific fields
  const [ophAutoRefOD, setOphAutoRefOD] = useState('');
  const [ophAutoRefOS, setOphAutoRefOS] = useState('');
  const [ophKReadingsOD, setOphKReadingsOD] = useState('');
  const [ophKReadingsOS, setOphKReadingsOS] = useState('');
  const [ophCoverTest, setOphCoverTest] = useState('');
  const [ophNPC, setOphNPC] = useState('');
  const [ophStereopsis, setOphStereopsis] = useState('');
  const [ophAccommodation, setOphAccommodation] = useState('');

  // B2: Lock vitals until nursing started
  const [nursingStarted, setNursingStarted] = useState(false);
  // B6: Step-by-step flow tracking
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  // B8: Unlock mechanism for charge nurse / admin
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [manualUnlock, setManualUnlock] = useState(false);
  // C1: Consent
  const [showConsentForm, setShowConsentForm] = useState(false);
  const [consentType, setConsentType] = useState('general_treatment');

  const isToday = selectedDate === today;
  const isPast = selectedDate < today;

  const { data: metadata } = useSWR(hasPermission ? '/api/opd/booking/metadata' : null, fetcher, {
    refreshInterval: 0,
  });
  const clinics = Array.isArray(metadata?.clinics) ? metadata.clinics : [];
  const selectedClinic = useMemo(
    () => clinics.find((clinic: ClinicMeta) => String(clinic.id || '') === clinicId) || null,
    [clinics, clinicId]
  );
  // Use selected patient's clinic when panel is open, otherwise filter clinic
  const clinicForOphCheck = useMemo(() => {
    if (selected?.clinicId && clinics.length) {
      const c = clinics.find((clinic: ClinicMeta) => String(clinic.id || '') === String(selected.clinicId));
      if (c) return c;
    }
    return selectedClinic;
  }, [selected?.clinicId, selectedClinic, clinics]);
  const clinicNameForCheck = String(clinicForOphCheck?.name || '').toLowerCase();
  const specialtyCodeForCheck = String(clinicForOphCheck?.specialtyCode || selected?.specialtyCode || '').toLowerCase();
  const showOphthalmology =
    clinicNameForCheck.includes('ophthalmology') ||
    clinicNameForCheck.includes('ophthalmic') ||
    clinicNameForCheck.includes('optometry') ||
    clinicNameForCheck.includes('optometrist') ||
    clinicNameForCheck.includes('eye') ||
    clinicNameForCheck.includes('عيون') ||
    clinicNameForCheck.includes('العيون') ||
    clinicNameForCheck.includes('بصريات') ||
    clinicNameForCheck.includes('أمراض العيون') ||
    clinicNameForCheck.includes('طب العيون') ||
    clinicNameForCheck.includes('رؤية') ||
    specialtyCodeForCheck.includes('opt') ||
    specialtyCodeForCheck.includes('oph') ||
    specialtyCodeForCheck.includes('eye') ||
    specialtyCodeForCheck === 'optometry' ||
    specialtyCodeForCheck === 'optometrist' ||
    specialtyCodeForCheck === 'ophthalmology';

  useEffect(() => {
    if (!clinicId) {
      setClinicId('ALL');
    }
  }, [clinicId]);


  useEffect(() => {
    if (isPast) {
      setAutoRefresh(false);
    }
    setRefreshCountdown(15);
  }, [isPast, selectedDate]);

  const { data, mutate, isValidating } = useSWR(
    hasPermission && clinicId
      ? `/api/opd/nursing/worklist?clinicId=${encodeURIComponent(clinicId)}&date=${selectedDate}`
      : null,
    fetcher,
    {
      // We drive polling via the countdown effect below to avoid duplicate revalidations.
      refreshInterval: 0,
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  useEffect(() => {
    if (!autoRefresh || !isToday) return;
    const interval = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          mutate();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, isToday, mutate]);

  useOpdEvents(
    useCallback((event) => {
      if (['FLOW_STATE_CHANGE', 'NEW_PATIENT', 'VITALS_SAVED'].includes(event.type)) {
        // Background refresh only (keep existing UI rendered).
        mutate();
      }
    }, [mutate]),
    hasPermission && isToday
  );

  const items = Array.isArray(data?.items) ? data.items : [];
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set<string>());
  const prevIdsRef = useRef<Set<string>>(new Set<string>());

  useEffect(() => {
    const currentIds = new Set<string>(items.map((row: OpdQueueRow) => String(row.bookingId || '')));
    const prevIds = prevIdsRef.current;
    const added: string[] = [];
    currentIds.forEach((id) => {
      if (!id) return;
      if (!prevIds.has(id)) added.push(id);
    });
    prevIdsRef.current = currentIds;

    if (added.length === 0) return;

    setNewIds((existing) => {
      const next = new Set(existing);
      added.forEach((id) => next.add(id));
      return next;
    });

    const t = window.setTimeout(() => {
      setNewIds((existing) => {
        const next = new Set(existing);
        added.forEach((id) => next.delete(id));
        return next;
      });
    }, 6000);

    return () => window.clearTimeout(t);
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = items.filter((row: OpdQueueRow) => {
      if (!q) return true;
      const name = String(row.patient?.fullName || '').toLowerCase();
      const mrn = String(row.patient?.mrn || '').toLowerCase();
      return name.includes(q) || mrn.includes(q);
    });
    return filtered.sort((a: OpdQueueRow, b: OpdQueueRow) => {
      const aStatus = getRowStatus(a);
      const bStatus = getRowStatus(b);
      const aPrio = STATUS_CONFIG[aStatus]?.priority ?? 99;
      const bPrio = STATUS_CONFIG[bStatus]?.priority ?? 99;
      if (aPrio !== bPrio) return aPrio - bPrio;
      const aWait = typeof a.waitingToNursingMinutes === 'number' ? a.waitingToNursingMinutes : 0;
      const bWait = typeof b.waitingToNursingMinutes === 'number' ? b.waitingToNursingMinutes : 0;
      return bWait - aWait;
    });
  }, [items, search]);

  const stats = useMemo(() => {
    const total = items.length;
    const waiting = items.filter((row: OpdQueueRow) => {
      const status = getRowStatus(row);
      return status === 'WAITING_NURSE' || status === 'CHECKED_IN';
    }).length;
    const inProgress = items.filter((row: OpdQueueRow) => getRowStatus(row) === 'IN_NURSING').length;
    const ready = items.filter((row: OpdQueueRow) => getRowStatus(row) === 'READY_FOR_DOCTOR').length;
    return { total, waiting, inProgress, ready };
  }, [items]);

  const flashTotal = useValueFlash(stats.total);
  const flashWaiting = useValueFlash(stats.waiting);
  const flashInProgress = useValueFlash(stats.inProgress);
  const flashReady = useValueFlash(stats.ready);

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  const openPanel = (row: OpdQueueRow) => {
    setSelected(row);
    setActiveTab('vitals');
    const flowState = row?.opdFlowState || row?.encounterCoreStatus;
    const isViewOnly = ['READY_FOR_DOCTOR', 'IN_DOCTOR', 'WAITING_DOCTOR', 'COMPLETED'].includes(flowState);
    const entry = row?.latestNursingEntry;
    if (isViewOnly && entry) {
      const v = (entry.vitals as Record<string, any>) || {};
      setVitals({
        bp: v.bp ?? '',
        hr: v.hr != null ? String(v.hr) : '',
        rr: v.rr != null ? String(v.rr) : '',
        temp: v.temp != null ? String(v.temp) : '',
        spo2: v.spo2 != null ? String(v.spo2) : '',
        weight: v.weight != null ? String(v.weight) : '',
        height: v.height != null ? String(v.height) : '',
        painScore: entry.painScore ?? null,
        painLocation: entry.painLocation ?? '',
        glucose: v.glucose != null ? String(v.glucose) : '',
        headCircumference: v.headCircumference != null ? String(v.headCircumference) : '',
        fetalHr: v.fetalHr != null ? String(v.fetalHr) : '',
        fundalHeight: v.fundalHeight != null ? String(v.fundalHeight) : '',
      });
      setChief(entry.chiefComplaintShort ?? '');
      setFallRisk(entry.fallRiskScore ?? null);
      setFallRiskData(entry.fallRiskData || null);
      setGcsData(entry.gcsData || null);
      setSbarData(entry.sbarData || null);
      setPainData(entry.painData || null);
      setFamilyCommData(entry.familyCommData || null);
      setProceduresData(entry.proceduresData || null);
      setIoData(entry.ioData || null);
      setBradenData(entry.bradenData || null);
      setCarePlanData(entry.carePlanData || null);
      setHandoverData(entry.handoverData || null);
      setNursingTasksData(entry.nursingTasksData || null);
      setMarData(entry.marData || null);
      setConsciousness((entry.consciousness as ConsciousnessLevel) || 'ALERT');
      setOnSupplementalO2(Boolean(entry.onSupplementalO2));
      setNote(entry.nursingNote ?? '');
      const pfeData = (entry.pfe as Record<string, any>) || {};
      setPfe({
        allergies: pfeData.allergies ?? DEFAULT_PFE.allergies,
        medications: pfeData.medications ?? DEFAULT_PFE.medications,
        history: pfeData.medicalHistory ?? pfeData.history ?? DEFAULT_PFE.history,
        educationTopics: Array.isArray(pfeData.educationTopics) ? pfeData.educationTopics : [],
        method: pfeData.method ?? 'verbal',
        language: pfeData.language ?? 'ar',
        barriers: Array.isArray(pfeData.barriers) ? pfeData.barriers : [],
        understanding: pfeData.understanding ?? '',
        confirmed: Boolean(pfeData.confirmed),
      });
      const to = (entry.timeOutChecklist as Record<string, unknown>) || {};
      setTimeOutData({
        patientIdentified: Boolean(to.patientIdentified),
        procedureConfirmed: Boolean(to.procedureConfirmed),
        siteMarked: Boolean(to.siteMarked),
        consentSigned: Boolean(to.consentSigned),
        allergiesReviewed: Boolean(to.allergiesReviewed),
        teamConfirmed: Boolean(to.teamConfirmed),
        patientProcedureConfirmed: Boolean(to.patientProcedureConfirmed),
        antibioticsGiven: Boolean(to.antibioticsGiven),
        imagingReviewed: Boolean(to.imagingReviewed),
        anticipatedEvents: Boolean(to.anticipatedEvents),
        procedureRecorded: Boolean(to.procedureRecorded),
        instrumentCount: Boolean(to.instrumentCount),
        specimenLabeled: Boolean(to.specimenLabeled),
        equipmentIssues: Boolean(to.equipmentIssues),
        recoveryPlan: Boolean(to.recoveryPlan),
      });
      setCompletedSteps(new Set(['vitals', 'assessment', 'pfe', 'timeout']));
    } else {
      setVitals({
        bp: '',
        hr: '',
        rr: '',
        temp: '',
        spo2: '',
        weight: '',
        height: '',
        painScore: null,
        painLocation: '',
        glucose: '',
        headCircumference: '',
        fetalHr: '',
        fundalHeight: '',
      });
      setChief('');
      setFallRisk(null);
      setFallRiskData(null);
      setGcsData(null);
      setSbarData(null);
      setPainData(null);
      setFamilyCommData(null);
      setProceduresData(null);
      setIoData(null);
      setBradenData(null);
      setCarePlanData(null);
      setHandoverData(null);
      setNursingTasksData(null);
      setMarData(null);
      setConsciousness('ALERT');
      setOnSupplementalO2(false);
      setNote('');
      setPfe({ ...DEFAULT_PFE });
      setTimeOutData({
        patientIdentified: false, procedureConfirmed: false, siteMarked: false,
        consentSigned: false, allergiesReviewed: false,
        teamConfirmed: false, patientProcedureConfirmed: false, antibioticsGiven: false,
        imagingReviewed: false, anticipatedEvents: false,
        procedureRecorded: false, instrumentCount: false, specimenLabeled: false,
        equipmentIssues: false, recoveryPlan: false,
      });
      setCompletedSteps(new Set());
    }
    const oph = (row?.opdClinicExtensions as Record<string, unknown>)?.ophthalmology as Record<string, unknown> | undefined;
    setOphVisualAcuityOD(oph?.visualAcuityOD as string ?? oph?.visualAcuity as string ?? '');
    setOphVisualAcuityOS(oph?.visualAcuityOS as string ?? '');
    setOphBcvaOD(oph?.bcvaOD as string ?? '');
    setOphBcvaOS(oph?.bcvaOS as string ?? '');
    setOphNearVisionOD(oph?.nearVisionOD as string ?? '');
    setOphNearVisionOS(oph?.nearVisionOS as string ?? '');
    setOphRefractionOD(oph?.refractionOD as string ?? oph?.refraction as string ?? '');
    setOphRefractionOS(oph?.refractionOS as string ?? '');
    setOphIopOD(String(oph?.iopOD ?? oph?.intraocularPressureOD ?? oph?.intraocularPressure ?? ''));
    setOphIopOS(String(oph?.iopOS ?? oph?.intraocularPressureOS ?? ''));
    setOphPD(oph?.pd as string ?? '');
    setOphColorVision(oph?.colorVision as string ?? '');
    setOphAutoRefOD(oph?.autoRefractionOD as string ?? '');
    setOphAutoRefOS(oph?.autoRefractionOS as string ?? '');
    setOphKReadingsOD(oph?.kReadingsOD as string ?? '');
    setOphKReadingsOS(oph?.kReadingsOS as string ?? '');
    setOphCoverTest(oph?.coverTest as string ?? '');
    setOphNPC(oph?.npc as string ?? '');
    setOphStereopsis(oph?.stereopsis as string ?? '');
    setOphAccommodation(oph?.accommodation as string ?? '');
    // B2: Reset nursing started — set true if patient already in nursing or beyond
    const alreadyStarted = ['IN_NURSING', 'READY_FOR_DOCTOR', 'WAITING_DOCTOR', 'IN_DOCTOR', 'COMPLETED'].includes(flowState);
    setNursingStarted(alreadyStarted);
    // B6: Reset completed steps
    setCompletedSteps(new Set());
    // B8: Reset unlock
    setShowUnlockDialog(false);
    setUnlockReason('');
    setManualUnlock(false);
  };
  const closePanel = () => {
    setSelected(null);
  };

  const startNursing = async () => {
    if (!selected?.encounterCoreId || isPast) return;
    setBusyStart(true);
    try {
      const flowRes = await fetch(`/api/opd/encounters/${selected.encounterCoreId}/flow-state`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opdFlowState: 'IN_NURSING' }),
      });
      const flowPayload = await flowRes.json().catch(() => ({}));
      if (!flowRes.ok) throw new Error(flowPayload.error || (language === 'ar' ? 'فشل تحديث حالة التدفق' : 'Failed to set flow state'));

      const tsRes = await fetch(`/api/opd/encounters/${selected.encounterCoreId}/timestamps`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opdTimestamps: { nursingStartAt: new Date().toISOString() } }),
      });
      const tsPayload = await tsRes.json().catch(() => ({}));
      if (!tsRes.ok && tsRes.status !== 409) throw new Error(tsPayload.error || (language === 'ar' ? 'فشل تسجيل بداية التمريض' : 'Failed to set nursing start'));
      if (tsRes.status === 409) {
        toast({ title: tr('بدأت الزيارة مسبقاً', 'Already started') });
      } else {
        toast({ title: tr('تم بدء التمريض', 'Nursing started') });
      }
      setNursingStarted(true);
      mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setBusyStart(false);
    }
  };

  const markReady = async () => {
    if (!selected?.encounterCoreId || isPast) return;
    setBusyReady(true);
    try {
      const tsRes = await fetch(`/api/opd/encounters/${selected.encounterCoreId}/timestamps`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opdTimestamps: { nursingEndAt: new Date().toISOString() } }),
      });
      const tsPayload = await tsRes.json().catch(() => ({}));
      if (!tsRes.ok && tsRes.status !== 409) throw new Error(tsPayload.error || (language === 'ar' ? 'فشل تسجيل نهاية التمريض' : 'Failed to set nursing end'));

      const flowRes = await fetch(`/api/opd/encounters/${selected.encounterCoreId}/flow-state`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opdFlowState: 'READY_FOR_DOCTOR' }),
      });
      const flowPayload = await flowRes.json().catch(() => ({}));
      if (!flowRes.ok) throw new Error(flowPayload.error || (language === 'ar' ? 'فشل تعيين الحالة جاهز' : 'Failed to set ready'));
      if (tsRes.status === 409) {
        toast({ title: tr('تم التعليم كجاهز مسبقاً', 'Already marked ready') });
      } else {
        toast({ title: tr('جاهز للطبيب', 'Ready for doctor') });
      }
      closePanel();
      mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setBusyReady(false);
    }
  };

  const saveNursing = async () => {
    if (!selected?.encounterCoreId || isPast) return;
    // Critical alerts are shown inline (B3) — no window.confirm() blocking
    setBusySave(true);
    try {
      const weight = vitals.weight ? Number(vitals.weight) : null;
      const height = vitals.height ? Number(vitals.height) : null;

      const res = await fetch(`/api/opd/encounters/${selected.encounterCoreId}/nursing`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nursingNote: note || null,
          chiefComplaintShort: chief || null,
          painScore: vitals.painScore,
          painLocation: vitals.painLocation || null,
          fallRiskScore: fallRisk,
          fallRiskData: fallRiskData || null,
          gcsData: gcsData || null,
          sbarData: sbarData || null,
          painData: painData || null,
          familyCommData: familyCommData || null,
          proceduresData: proceduresData || null,
          ioData: ioData || null,
          bradenData: bradenData || null,
          carePlanData: carePlanData || null,
          handoverData: handoverData || null,
          nursingTasksData: nursingTasksData || null,
          marData: marData || null,
          vitals: {
            bp: vitals.bp || null,
            hr: vitals.hr ? Number(vitals.hr) : null,
            temp: vitals.temp ? Number(vitals.temp) : null,
            rr: vitals.rr ? Number(vitals.rr) : null,
            spo2: vitals.spo2 ? Number(vitals.spo2) : null,
            weight,
            height,
            glucose: vitals.glucose ? Number(vitals.glucose) : null,
            headCircumference: vitals.headCircumference ? Number(vitals.headCircumference) : null,
            fetalHr: vitals.fetalHr ? Number(vitals.fetalHr) : null,
            fundalHeight: vitals.fundalHeight ? Number(vitals.fundalHeight) : null,
          },
          consciousness: consciousness || 'ALERT',
          onSupplementalO2: onSupplementalO2 || false,
          pfe: {
            allergies: pfe.allergies,
            medications: pfe.medications,
            medicalHistory: pfe.history,
            educationTopics: pfe.educationTopics,
            method: pfe.method || null,
            language: pfe.language || null,
            barriers: pfe.barriers,
            understanding: pfe.understanding || null,
            confirmed: pfe.confirmed,
          },
          timeOutChecklist: timeOutData,
          priority: priority || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || (language === 'ar' ? 'فشل الحفظ' : 'Failed'));
      toast({ title: tr('تم الحفظ', 'Saved') });
      mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message, variant: 'destructive' as const });
    } finally {
      setBusySave(false);
    }
  };

  const saveOphthalmology = async () => {
    if (!selected?.encounterCoreId || isPast) return;
    setBusyOph(true);
    try {
      const res = await fetch(`/api/opd/encounters/${selected.encounterCoreId}/clinic-extensions`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opdClinicExtensions: {
            ophthalmology: {
              visualAcuityOD: ophVisualAcuityOD || null,
              visualAcuityOS: ophVisualAcuityOS || null,
              bcvaOD: ophBcvaOD || null,
              bcvaOS: ophBcvaOS || null,
              nearVisionOD: ophNearVisionOD || null,
              nearVisionOS: ophNearVisionOS || null,
              refractionOD: ophRefractionOD || null,
              refractionOS: ophRefractionOS || null,
              iopOD: ophIopOD || null,
              iopOS: ophIopOS || null,
              pd: ophPD || null,
              colorVision: ophColorVision || null,
              autoRefractionOD: ophAutoRefOD || null,
              autoRefractionOS: ophAutoRefOS || null,
              kReadingsOD: ophKReadingsOD || null,
              kReadingsOS: ophKReadingsOS || null,
              coverTest: ophCoverTest || null,
              npc: ophNPC || null,
              stereopsis: ophStereopsis || null,
              accommodation: ophAccommodation || null,
            },
          },
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || (language === 'ar' ? 'فشل حفظ فحوصات العيون' : 'Failed to save'));
      toast({ title: tr('تم حفظ فحوصات العيون', 'Ophthalmology saved') });
      mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setBusyOph(false);
    }
  };

  // ── B6: Step-by-step flow ──
  const TAB_ORDER: readonly string[] = ['vitals', 'assessment', 'pfe'];
  const isTabEnabled = (tabKey: string): boolean => {
    if (!nursingStarted) return false;
    // When read-only (viewing completed/sent patient), allow viewing all tabs
    if (isReadOnly) return true;
    if (tabKey === 'vitals') return true;
    if (tabKey === 'timeout') return true; // Always accessible but optional
    const idx = TAB_ORDER.indexOf(tabKey);
    if (idx <= 0) return true;
    for (let i = 0; i < idx; i++) {
      if (!completedSteps.has(TAB_ORDER[i])) return false;
    }
    return true;
  };
  const allRequiredComplete = TAB_ORDER.every(tab => completedSteps.has(tab));

  // Per-tab save functions — each sends FULL payload via POST
  const buildNursingPayload = () => {
    const weight = vitals.weight ? Number(vitals.weight) : null;
    const height = vitals.height ? Number(vitals.height) : null;
    return {
      nursingNote: note || null,
      chiefComplaintShort: chief || null,
      painScore: vitals.painScore,
      painLocation: vitals.painLocation || null,
      fallRiskScore: fallRisk,
      fallRiskData: fallRiskData || null,
      gcsData: gcsData || null,
      sbarData: sbarData || null,
      painData: painData || null,
      familyCommData: familyCommData || null,
      proceduresData: proceduresData || null,
      ioData: ioData || null,
      bradenData: bradenData || null,
      carePlanData: carePlanData || null,
      handoverData: handoverData || null,
      nursingTasksData: nursingTasksData || null,
      marData: marData || null,
      consciousness: consciousness || 'ALERT',
      onSupplementalO2: onSupplementalO2 || false,
      vitals: {
        bp: vitals.bp || null,
        hr: vitals.hr ? Number(vitals.hr) : null,
        temp: vitals.temp ? Number(vitals.temp) : null,
        rr: vitals.rr ? Number(vitals.rr) : null,
        spo2: vitals.spo2 ? Number(vitals.spo2) : null,
        weight,
        height,
        glucose: vitals.glucose ? Number(vitals.glucose) : null,
        headCircumference: vitals.headCircumference ? Number(vitals.headCircumference) : null,
        fetalHr: vitals.fetalHr ? Number(vitals.fetalHr) : null,
        fundalHeight: vitals.fundalHeight ? Number(vitals.fundalHeight) : null,
      },
      pfe: {
        allergies: pfe.allergies,
        medications: pfe.medications,
        medicalHistory: pfe.history,
        educationTopics: pfe.educationTopics,
        method: pfe.method || null,
        language: pfe.language || null,
        barriers: pfe.barriers,
        understanding: pfe.understanding || null,
        confirmed: pfe.confirmed,
      },
      timeOutChecklist: timeOutData,
      priority: priority || undefined,
    };
  };

  const saveVitalsStep = async () => {
    if (!selected?.encounterCoreId || isPast) return;
    if (!vitals.bp && !vitals.hr && !vitals.temp) {
      toast({ title: tr('يجب إدخال العلامات الحيوية', 'Enter vitals first'), variant: 'destructive' as const });
      return;
    }
    setBusySave(true);
    try {
      const res = await fetch(`/api/opd/encounters/${selected.encounterCoreId}/nursing`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildNursingPayload()),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || tr('فشل الحفظ', 'Failed'));
      setCompletedSteps(prev => new Set([...prev, 'vitals']));
      // B5: Auto-suggest priority from vitals (only if nurse hasn't manually chosen)
      if (!priorityManual) {
        const suggested = suggestPriority(vitals);
        setPriority(suggested);
      }
      setActiveTab('assessment');
      toast({ title: tr('تم حفظ العلامات الحيوية — انتقل للتقييم', 'Vitals saved — proceed to assessment') });
      mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message, variant: 'destructive' as const });
    } finally {
      setBusySave(false);
    }
  };

  const saveAssessmentStep = async () => {
    if (!selected?.encounterCoreId || isPast) return;
    if (!chief) {
      toast({ title: tr('يجب إدخال الشكوى الرئيسية', 'Enter chief complaint'), variant: 'destructive' as const });
      return;
    }
    setBusySave(true);
    try {
      const res = await fetch(`/api/opd/encounters/${selected.encounterCoreId}/nursing`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildNursingPayload()),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || tr('فشل الحفظ', 'Failed'));
      setCompletedSteps(prev => new Set([...prev, 'assessment']));
      setActiveTab('pfe');
      toast({ title: tr('تم حفظ التقييم — انتقل للتثقيف الصحي', 'Assessment saved — proceed to education') });
      mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message, variant: 'destructive' as const });
    } finally {
      setBusySave(false);
    }
  };

  const savePFEStep = async () => {
    if (!selected?.encounterCoreId || isPast) return;
    setBusySave(true);
    try {
      const res = await fetch(`/api/opd/encounters/${selected.encounterCoreId}/nursing`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildNursingPayload()),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || tr('فشل الحفظ', 'Failed'));
      setCompletedSteps(prev => new Set([...prev, 'pfe']));
      toast({ title: tr('تم حفظ التثقيف الصحي', 'Patient education saved') });
      mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message, variant: 'destructive' as const });
    } finally {
      setBusySave(false);
    }
  };

  // C1: Handle consent completion
  const handleConsentComplete = async (data: ConsentData) => {
    try {
      await fetch('/api/clinical/consents', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          encounterId: selected?.encounterCoreId,
          patientId: selected?.patient?.id || selected?.patientMasterId,
        }),
      });
      toast({ title: tr('تم حفظ الموافقة', 'Consent saved') });
      setShowConsentForm(false);
    } catch {
      toast({ title: tr('فشل حفظ الموافقة', 'Failed to save consent'), variant: 'destructive' as const });
    }
  };

  const timeOutComplete = Object.values(timeOutData).every(Boolean);
  const progress = [
    !!vitals.bp,
    !!vitals.hr,
    !!vitals.temp,
    !!vitals.rr,
    !!vitals.spo2,
    !!vitals.weight,
    !!vitals.height,
    !!chief,
    vitals.painScore !== null,
    fallRisk !== null,
  ].filter(Boolean).length;
  const totalFields = 10;
  const progressPct = Math.round((progress / totalFields) * 100);

  const patientAge = selected?.patient?.dob ? getAge(selected.patient.dob) : '—';
  const isPediatric = typeof patientAge === 'number' && patientAge < 16;
  const isObstetric =
    String(selected?.patient?.gender || '').toUpperCase() === 'FEMALE' &&
    typeof patientAge === 'number' &&
    patientAge >= 12 &&
    patientAge <= 50;
  const selectedAllergies = parseAllergies(selected?.latestAllergies);
  const selectedStatus = selected ? getRowStatus(selected) : 'CHECKED_IN';
  // B8: Read-only after Ready for Doctor
  const isReadOnly = !manualUnlock && ['READY_FOR_DOCTOR', 'IN_DOCTOR', 'WAITING_DOCTOR', 'COMPLETED'].includes(selectedStatus);
  // fallRiskOptions removed — replaced by FallRiskAssessment component (Morse/Humpty Dumpty)

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                  <Heart size={20} className="text-white" />
                </div>
                {tr('محطة التمريض', 'Nurse station')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <div className="flex items-center bg-card border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => {
                      setSelectedDate(addDaysToDateString(selectedDate, -1));
                      setShowCalendar(false);
                    }}
                    className="px-2.5 py-2.5 hover:bg-muted thea-transition-fast border-r border-border"
                  >
                    <ChevronLeft size={16} className="text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => setShowCalendar(!showCalendar)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-muted thea-transition-fast"
                  >
                    <CalendarDays size={15} className={isToday ? 'text-primary' : 'text-amber-600'} />
                    <span className={`text-sm font-medium ${isToday ? 'text-foreground' : 'text-amber-700'}`}>
                      {formatDateLabel(selectedDate, language)}
                    </span>
                    <ChevronDown size={14} className={`text-muted-foreground thea-transition-fast ${showCalendar ? 'rotate-180' : ''}`} />
                  </button>
                  {!isToday ? (
                    <button
                      onClick={() => {
                        setSelectedDate(today);
                        setShowCalendar(false);
                      }}
                      className="px-2.5 py-2.5 hover:bg-primary/10 thea-transition-fast border-l border-border text-xs font-medium text-primary"
                    >
                      {language === 'ar' ? 'اليوم' : 'Today'}
                    </button>
                  ) : null}
                  <button
                    onClick={() => {
                      const ns = addDaysToDateString(selectedDate, 1);
                      if (ns <= today) setSelectedDate(ns);
                      setShowCalendar(false);
                    }}
                    disabled={isToday}
                    className="px-2.5 py-2.5 hover:bg-muted thea-transition-fast border-l border-border disabled:opacity-30"
                  >
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </button>
                </div>

                {showCalendar ? (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowCalendar(false)} />
                    <CalendarDropdown
                      selectedDate={selectedDate}
                      onSelect={setSelectedDate}
                      onClose={() => setShowCalendar(false)}
                      alignLeft={isRTL}
                      language={language}
                    />
                  </>
                ) : null}
              </div>

              <select
                value={clinicId}
                onChange={(e) => setClinicId(e.target.value)}
                className="h-11 w-full bg-card border border-border rounded-xl text-sm font-medium px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary thea-transition-fast"
              >
                <option value="ALL">{tr('جميع العيادات', 'All clinics')}</option>
                {clinics.map((clinic: any) => (
                  <option key={clinic.id} value={String(clinic.id)}>
                    {clinic.name || clinic.id}
                  </option>
                ))}
              </select>

              {isToday ? (
                <button
                  onClick={() => {
                    setAutoRefresh(!autoRefresh);
                    if (!autoRefresh) setRefreshCountdown(15);
                  }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium thea-transition-fast
                    ${autoRefresh
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50'
                      : 'bg-card border-border text-muted-foreground hover:border-muted-foreground/40'
                    }`}
                  title={
                    autoRefresh
                      ? (language === 'ar' ? 'التحديث التلقائي يعمل (اضغط للإيقاف)' : 'Auto-refresh ON (click to pause)')
                      : (language === 'ar' ? 'التحديث التلقائي متوقف (اضغط للتفعيل)' : 'Auto-refresh OFF (click to enable)')
                  }
                >
                  <span className="relative flex h-2.5 w-2.5">
                    {autoRefresh ? (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    ) : null}
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${autoRefresh ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                  </span>
                  {autoRefresh ? `${language === 'ar' ? 'مباشر' : 'LIVE'} · ${refreshCountdown}s` : language === 'ar' ? 'متوقف' : 'PAUSED'}
                  {isValidating ? (
                    <span className="ml-1 inline-flex items-center" aria-label="Refreshing">
                      <span className="w-3 h-3 border-2 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin" />
                    </span>
                  ) : null}
                </button>
              ) : null}

              <button
                onClick={() => {
                  setRefreshCountdown(15);
                  mutate();
                }}
                className="p-2.5 bg-card border border-border rounded-xl hover:bg-muted thea-transition-fast group"
                title={language === 'ar' ? 'تحديث الآن' : 'Refresh now'}
              >
                <RefreshCw
                  size={18}
                  className={`text-muted-foreground group-hover:text-primary thea-transition-fast ${isValidating ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>

          {!data ? (
            <LoadingSkeleton />
          ) : (
            <>
              {/* ── Station View Toggle ──────────────────────────────────── */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStationView('nursing')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors
                    ${stationView === 'nursing'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                >
                  <Heart size={16} />
                  {tr('قائمة التمريض', 'Nursing Queue')}
                </button>
                <button
                  onClick={() => setStationView('procedures')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors
                    ${stationView === 'procedures'
                      ? 'bg-green-600 text-white'
                      : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                >
                  <Syringe size={16} />
                  {tr('قائمة الإجراءات', 'Procedure Queue')}
                </button>
              </div>

              {stationView === 'procedures' ? (
                <ProcedureQueue
                  clinicId={clinicId || 'ALL'}
                  date={selectedDate}
                  onRefresh={() => mutate()}
                />
              ) : (
              <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <TheaKpiCard icon={<User size={18} />} label={tr('إجمالي المرضى', 'Total patients')} value={stats.total} />
                <TheaKpiCard icon={<Clock size={18} />} label={tr('ينتظر', 'Waiting')} value={stats.waiting} color="#F59E0B" />
                <TheaKpiCard icon={<Activity size={18} />} label={tr('قيد التنفيذ', 'In progress')} value={stats.inProgress} color="#3B82F6" />
                <TheaKpiCard icon={<CheckCircle2 size={18} />} label={tr('جاهز للطبيب', 'Ready for doctor')} value={stats.ready} color="#10B981" />
              </div>

              <WorkloadDashboard patients={filteredItems} />

              {isPast ? (
                <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-2xl">
                  <CalendarDays size={18} className="text-amber-600 shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      {language === 'ar' ? 'عرض بيانات تاريخية ليوم ' : 'Viewing historical data for '}
                      {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="text-xs text-amber-600 dark:text-amber-400 block">
                      {language === 'ar' ? 'الإجراءات معطلة للتواريخ الماضية.' : 'Actions are disabled for past dates.'}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedDate(today)}
                    className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-xl hover:bg-amber-700 thea-transition-fast"
                  >
                    {language === 'ar' ? 'العودة لليوم' : 'Back to Today'}
                  </button>
                </div>
              ) : null}

              <div className="relative max-w-md">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tr('ابحث بالاسم أو رقم الملف...', 'Search by name or MRN...')}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border-[1.5px] border-border bg-muted/30 text-[13px] outline-none thea-input-focus thea-transition-fast"
                />
              </div>

              {filteredItems.length === 0 ? (
                <EmptyState clinicName={selectedClinic?.name || (language === 'ar' ? 'هذه العيادة' : 'this clinic')} language={language} />
              ) : (
                <>
                  <div className="md:hidden space-y-3">
                    <AnimatePresence initial={false}>
                      {filteredItems.map((row: any) => (
                        <PatientCard
                          key={row.bookingId}
                          patient={row}
                          onOpen={openPanel}
                          isSelected={selected?.bookingId === row.bookingId}
                          isNew={newIds.has(String(row.bookingId))}
                          language={language}
                        />
                      ))}
                    </AnimatePresence>
                  </div>

                  <div className="hidden md:block bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border">
                          <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-3 px-4">
                            {tr('المريض', 'Patient')}
                          </th>
                          <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-3 px-4">
                            {tr('الحالة', 'Status')}
                          </th>
                          <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-3 px-4">
                            {tr('الطبيب', 'Doctor')}
                          </th>
                          <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-3 px-4">
                            {tr('النوع', 'Type')}
                          </th>
                          <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-3 px-4">
                            {tr('الحساسية', 'Allergy')}
                          </th>
                          <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-3 px-4">
                            {tr('وقت الانتظار', 'Waiting time')}
                          </th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <motion.tbody layout className="divide-y divide-border/50">
                        <AnimatePresence initial={false}>
                          {filteredItems.map((row: any) => (
                            <PatientRow
                              key={row.bookingId}
                              patient={row}
                              onOpen={openPanel}
                              isSelected={selected?.bookingId === row.bookingId}
                              isNew={newIds.has(String(row.bookingId))}
                              language={language}
                            />
                          ))}
                        </AnimatePresence>
                      </motion.tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
            </>
          )}
        </div>

        {selected ? (
          <div className="fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closePanel} />

            <div
              className={`relative ${isRTL ? 'mr-auto' : 'ml-auto'} w-full max-w-xl bg-card shadow-2xl flex flex-col overflow-hidden ${isRTL ? 'thea-animate-slide-left' : 'thea-animate-slide-right'}`}
            >
              <div className="bg-gradient-to-r from-primary to-primary/80 text-white px-6 py-5">
                <div className="flex items-center justify-between mb-3">
                  <button onClick={closePanel} className="p-1.5 hover:bg-white/20 rounded-xl thea-transition-fast">
                    <X size={18} />
                  </button>
                  <div className="flex gap-2">
                    {/* C1: Consent button */}
                    <button
                      onClick={() => setShowConsentForm(true)}
                      className="p-1.5 hover:bg-white/20 rounded-xl thea-transition-fast"
                      title={tr('الموافقات', 'Consents')}
                    >
                      <FileCheck size={18} />
                    </button>
                    {['WAITING_NURSE', 'CHECKED_IN'].includes(selectedStatus) ? (
                      <button
                        onClick={startNursing}
                        disabled={isPast || busyStart}
                        className="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium thea-transition-fast disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        ▶ {tr('بدء التمريض', 'Start Nursing')}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold
                      ${selected?.patient?.gender === 'MALE' ? 'bg-blue-400/40' : 'bg-pink-400/40'}`}
                  >
                    {(selected?.patient?.fullName || '?')[0]}
                  </div>
                  <div>
                    <div className="text-lg font-semibold">{selected?.patient?.fullName}</div>
                    <div className="text-white/70 text-sm">
                      {(selected?.patient?.mrn || '—').replace(/^MRN-?/i, '')} • {getAge(selected?.patient?.dob) ?? '—'}y •{' '}
                      {selected?.patient?.gender === 'MALE'
                        ? (language === 'ar' ? 'ذكر' : 'Male')
                        : selected?.patient?.gender === 'FEMALE'
                          ? (language === 'ar' ? 'أنثى' : 'Female')
                          : '—'}
                    </div>
                  </div>
                </div>

                {selectedAllergies.length ? (
                  <div className="mt-3 px-3 py-2 bg-red-500/30 border border-red-400/40 rounded-xl flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span className="text-sm font-medium">{tr('حساسية', 'Allergy')}: {selectedAllergies.join(', ')}</span>
                  </div>
                ) : null}

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-white/70 mb-1.5">
                    <span>{tr('تقدم التمريض', 'Nursing progress')}</span>
                    <span>{progressPct}%</span>
                  </div>
                  <progress value={progressPct} max={100} className="w-full h-1.5 rounded-full overflow-hidden bg-white/20 accent-white" />
                </div>
              </div>

              {/* Visit History Timeline */}
              {selected?.patient?.id && (
                <div className="px-4 py-2 border-b border-border">
                  <VisitHistoryTimeline
                    patientId={selected.patient.id}
                    currentEncounterId={selected.encounterCoreId}
                  />
                </div>
              )}

              <div className="flex border-b border-border bg-muted/30 px-2">
                {[
                  { key: 'vitals', label: tr('العلامات الحيوية', 'Vitals'), icon: Heart },
                  { key: 'assessment', label: tr('التقييم', 'Assessment'), icon: Clipboard },
                  { key: 'timeout', label: 'Time Out', icon: PauseCircle },
                  { key: 'pfe', label: tr('تثقيف المريض', 'Patient education'), icon: FileText },
                ].map((section) => {
                  const enabled = isTabEnabled(section.key);
                  const done = completedSteps.has(section.key);
                  return (
                    <button
                      key={section.key}
                      disabled={!enabled}
                      onClick={() => enabled && setActiveTab(section.key as NurseStationTab)}
                      className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 thea-transition-fast
                        ${activeTab === section.key ? 'border-primary text-primary bg-card font-bold'
                          : !enabled ? 'border-transparent text-muted-foreground/40 cursor-not-allowed'
                          : done ? 'border-emerald-400 text-emerald-700'
                          : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                      {done && <CheckCircle2 size={14} className="text-emerald-500" />}
                      {!done && !enabled && <Lock size={14} className="text-muted-foreground/40" />}
                      <section.icon size={15} />
                      {section.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {/* B8: Read-only lock banner */}
                {isReadOnly && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-2xl mb-4">
                    <div className="flex items-center gap-2">
                      <Lock size={16} className="text-amber-600" />
                      <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                        {tr('تم إرسال المريض للطبيب — السجل مقفل للتعديل', 'Patient sent to doctor — record locked')}
                      </span>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{tr('للتعديل تواصل مع المشرف أو الأدمن', 'Contact supervisor or admin to unlock')}</p>
                  </div>
                )}

                {/* B2: Lock overlay when nursing not started */}
                <div className={`relative ${!nursingStarted ? 'pointer-events-none' : ''} ${isReadOnly ? 'pointer-events-none' : ''}`}>
                  {!nursingStarted && (
                    <div className="absolute inset-0 bg-card/60 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-2xl">
                      <div className="text-center p-6">
                        <PauseCircle size={48} className="text-muted-foreground/40 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground font-medium">
                          {tr('اضغط "بدء التمريض" أولاً', 'Press "Start Nursing" first')}
                        </p>
                      </div>
                    </div>
                  )}

                {activeTab === 'vitals' ? (
                  <div className="space-y-4">
                    <div className="bg-card rounded-2xl border border-border p-4">
                      <VitalsEntry
                        value={vitals}
                        onChange={setVitals}
                        onValidation={setValidation}
                        disabled={isPast}
                        showPediatric={isPediatric}
                        showObstetric={isObstetric}
                        language={language}
                      />
                    </div>

                    {/* Real-time NEWS2 score preview while entering vitals */}
                    {(vitals.bp || vitals.hr || vitals.rr || vitals.temp || vitals.spo2) && (
                      <MEWSBadge
                        vitals={vitals}
                        consciousness={consciousness}
                        onSupplementalO2={onSupplementalO2}
                      />
                    )}

                    {showOphthalmology ? (
                      <div className="border-t border-border pt-4 mt-2 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Eye size={16} className="text-primary" />
                          {tr('فحوصات العيون', 'Ophthalmology exams')}
                        </div>
                        <div className="space-y-4">
                          {/* Nurse fills: Visual Acuity, Auto-Refraction, IOP only */}
                          <div>
                            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{tr('حدة البصر (UCVA)', 'Visual Acuity (UCVA)')}</div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] text-muted-foreground">OD</label>
                                <input
                                  value={ophVisualAcuityOD}
                                  onChange={(e) => setOphVisualAcuityOD(e.target.value)}
                                  placeholder="20/20"
                                  className="w-full px-3 py-2 rounded-xl border-[1.5px] border-border bg-muted/30 text-sm thea-input-focus thea-transition-fast"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] text-muted-foreground">OS</label>
                                <input
                                  value={ophVisualAcuityOS}
                                  onChange={(e) => setOphVisualAcuityOS(e.target.value)}
                                  placeholder="20/25"
                                  className="w-full px-3 py-2 rounded-xl border-[1.5px] border-border bg-muted/30 text-sm thea-input-focus thea-transition-fast"
                                />
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{tr('الانكسار التلقائي (Auto-Ref)', 'Auto-Refraction')}</div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] text-muted-foreground">OD</label>
                                <input value={ophAutoRefOD} onChange={(e) => setOphAutoRefOD(e.target.value)} placeholder="-1.00/-0.50×90" className="w-full px-3 py-2 rounded-xl border-[1.5px] border-border bg-muted/30 text-sm thea-input-focus thea-transition-fast" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] text-muted-foreground">OS</label>
                                <input value={ophAutoRefOS} onChange={(e) => setOphAutoRefOS(e.target.value)} placeholder="-0.75/-0.25×80" className="w-full px-3 py-2 rounded-xl border-[1.5px] border-border bg-muted/30 text-sm thea-input-focus thea-transition-fast" />
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{tr('ضغط العين (IOP)', 'Intraocular Pressure (IOP)')}</div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] text-muted-foreground">OD</label>
                                <input
                                  value={ophIopOD}
                                  onChange={(e) => setOphIopOD(e.target.value)}
                                  placeholder="14 mmHg"
                                  className="w-full px-3 py-2 rounded-xl border-[1.5px] border-border bg-muted/30 text-sm thea-input-focus thea-transition-fast"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] text-muted-foreground">OS</label>
                                <input
                                  value={ophIopOS}
                                  onChange={(e) => setOphIopOS(e.target.value)}
                                  placeholder="15 mmHg"
                                  className="w-full px-3 py-2 rounded-xl border-[1.5px] border-border bg-muted/30 text-sm thea-input-focus thea-transition-fast"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div>
                          <button
                            onClick={saveOphthalmology}
                            disabled={busyOph || isPast}
                            className="px-4 py-2 bg-card text-foreground border border-border rounded-xl text-sm font-medium hover:bg-muted disabled:opacity-50 thea-transition-fast"
                          >
                            {busyOph ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ فحوصات العيون', 'Save eye exams')}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {/* Previous Nursing Entries */}
                    {selected?.opdNursingEntries?.length > 0 && (
                      <div className="mt-4 border-t border-border pt-4">
                        <h4 className="text-sm font-semibold text-foreground mb-2">{tr('إدخالات سابقة', 'Previous entries')}</h4>
                        {selected.opdNursingEntries.filter((e: OpdNursingEntryData) => !e.isCorrected).map((entry: OpdNursingEntryData) => (
                          <div key={entry.id} className="p-3 rounded-xl border border-border mb-2 text-sm">
                            <div className="flex justify-between items-start">
                              <div>
                                {entry.vitals?.bp && <span className="mr-2">BP: {entry.vitals.bp}</span>}
                                {entry.vitals?.hr && <span className="mr-2">HR: {entry.vitals.hr}</span>}
                                {entry.vitals?.temp && <span className="mr-2">T: {entry.vitals.temp}°</span>}
                                {entry.vitals?.spo2 && <span className="mr-2">SpO2: {entry.vitals.spo2}%</span>}
                              </div>
                              <button
                                onClick={async () => {
                                  const reason = await showPrompt(tr('سبب التصحيح:', 'Reason for correction:'));
                                  if (!reason?.trim()) return;
                                  try {
                                    const res = await fetch(`/api/opd/encounters/${selected.encounterCoreId}/nursing`, {
                                      credentials: 'include',
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ entryId: entry.id, correctionReason: reason.trim() }),
                                    });
                                    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || (language === 'ar' ? 'فشلت العملية' : 'Failed'));
                                    toast({ title: tr('تم تصحيح الإدخال', 'Entry corrected') });
                                    mutate();
                                  } catch (err: any) {
                                    toast({ title: err.message, variant: 'destructive' as const });
                                  }
                                }}
                                className="text-xs text-amber-600 hover:text-amber-800"
                              >
                                {tr('تصحيح', 'Correct')}
                              </button>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {entry.createdAt ? new Date(entry.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh' }) : ''}
                            </div>
                          </div>
                        ))}
                        {/* Show corrected entries with strikethrough */}
                        {selected.opdNursingEntries.filter((e: OpdNursingEntryData) => e.isCorrected).map((entry: OpdNursingEntryData) => (
                          <div key={entry.id} className="p-3 rounded-xl border border-red-100 bg-red-50/30 mb-2 text-sm line-through opacity-60">
                            <div>
                              {entry.vitals?.bp && <span className="mr-2">BP: {entry.vitals.bp}</span>}
                              {entry.vitals?.hr && <span className="mr-2">HR: {entry.vitals.hr}</span>}
                            </div>
                            <div className="text-xs text-red-500 mt-1 no-underline">
                              {tr('تم التصحيح', 'Corrected')}: {entry.correctionReason}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* B3: Critical alerts inline banner */}
                    {validation?.criticalAlerts?.length ? (
                      <div className="p-3 bg-red-50 border-2 border-red-200 rounded-2xl animate-pulse">
                        <span className="text-sm font-medium text-red-800">{tr('يوجد قيم حرجة:', 'Critical values:')}</span>
                        {validation.criticalAlerts.map((a: string, i: number) => (
                          <div key={i} className="text-xs text-red-700 mt-1">• {a}</div>
                        ))}
                      </div>
                    ) : null}

                    {/* Deterioration Predictor */}
                    <DeteriorationAlert
                      input={{
                        mewsScore: vitals.bp || vitals.hr ? (() => { const m = calculateMEWS(vitalsToMEWSInput({ bp: vitals.bp, hr: vitals.hr ? Number(vitals.hr) : null, temp: vitals.temp ? Number(vitals.temp) : null, rr: vitals.rr ? Number(vitals.rr) : null, spo2: vitals.spo2 ? Number(vitals.spo2) : null }, consciousness, onSupplementalO2)); return m.totalScore; })() : null,
                        gcsScore: gcsData?.totalScore ?? null,
                        bradenScore: bradenData?.totalScore ?? null,
                        painScore: painData?.score ?? null,
                        spo2: vitals.spo2 ? Number(vitals.spo2) : null,
                        hr: vitals.hr ? Number(vitals.hr) : null,
                        sbp: vitals.bp ? Number(vitals.bp.split('/')[0]) : null,
                        temp: vitals.temp ? Number(vitals.temp) : null,
                        rr: vitals.rr ? Number(vitals.rr) : null,
                        consciousness,
                        ageYears: selected?.patient?.ageYears ?? null,
                      }}
                    />

                    {/* Sepsis Screening */}
                    {show('sepsis') && (
                    <SepsisScreening
                      vitals={{
                        sbp: vitals.bp ? Number(vitals.bp.split('/')[0]) : null,
                        rr: vitals.rr ? Number(vitals.rr) : null,
                        temp: vitals.temp ? Number(vitals.temp) : null,
                        hr: vitals.hr ? Number(vitals.hr) : null,
                      }}
                      gcsScore={gcsData?.totalScore ?? null}
                    />
                    )}

                    {/* Vitals Trend Analysis */}
                    {selected?.patient?.id && (
                      <VitalsTrendAlert
                        patientId={selected.patient.id}
                        currentVitals={{
                          bp: vitals.bp || null,
                          hr: vitals.hr ? Number(vitals.hr) : null,
                          temp: vitals.temp ? Number(vitals.temp) : null,
                          spo2: vitals.spo2 ? Number(vitals.spo2) : null,
                          rr: vitals.rr ? Number(vitals.rr) : null,
                          weight: vitals.weight ? Number(vitals.weight) : null,
                        }}
                      />
                    )}

                    {/* Pain Assessment */}
                    <PainAssessment
                      value={painData}
                      onChange={setPainData}
                      ageYears={selected?.patient?.ageYears ?? null}
                    />

                    {/* Intake & Output — IPD/ER/ICU only */}
                    {show('intakeOutput') && (
                    <IntakeOutputTracker
                      value={ioData}
                      onChange={setIoData}
                      disabled={isReadOnly}
                    />
                    )}

                    {/* B6: Vitals tab save button */}
                    <button
                      onClick={saveVitalsStep}
                      disabled={busySave || isPast || (validation ? !validation.valid : false)}
                      className="w-full py-3 bg-primary text-white rounded-xl font-bold mt-4 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed thea-transition-fast"
                    >
                      {busySave ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ العلامات الحيوية ←', 'Save Vitals →')}
                    </button>
                  </div>
                ) : null}

                {activeTab === 'assessment' ? (
                  <div className="space-y-5">
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{tr('الشكوى الرئيسية', 'Chief complaint')}</label>
                      <input
                        value={chief}
                        onChange={(e) => setChief(e.target.value)}
                        placeholder={language === 'ar' ? 'مثال: صداع منذ يومين' : 'e.g., headache for 2 days'}
                        className="px-4 py-3 rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast w-full"
                      />
                    </div>

                    {/* NEWS2 Early Warning Score */}
                    <MEWSBadge
                      vitals={vitals}
                      consciousness={consciousness}
                      onSupplementalO2={onSupplementalO2}
                      showDetails
                    />

                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{tr('مستوى الوعي (AVPU)', 'Consciousness (AVPU)')}</label>
                      <div className="grid grid-cols-5 gap-1.5">
                        {CONSCIOUSNESS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => !isReadOnly && setConsciousness(opt.value)}
                            disabled={isReadOnly}
                            className={`py-2 rounded-xl text-xs font-medium thea-transition-fast border-[1.5px] text-center
                              ${consciousness === opt.value
                                ? opt.value === 'ALERT'
                                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-lg'
                                  : opt.value === 'CONFUSION'
                                  ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-lg'
                                  : 'bg-red-50 border-red-500 text-red-700 shadow-lg'
                                : 'bg-card border-border text-muted-foreground hover:border-muted-foreground/40'
                              }`}
                          >
                            <div className="font-bold text-sm">{opt.description}</div>
                            <div className="text-[10px] mt-0.5">{language === 'ar' ? opt.labelAr : opt.labelEn}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={onSupplementalO2}
                          onChange={(e) => !isReadOnly && setOnSupplementalO2(e.target.checked)}
                          disabled={isReadOnly}
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-foreground">{tr('المريض على أكسجين إضافي', 'Patient on supplemental O₂')}</span>
                      </label>
                    </div>

                    <FallRiskAssessment
                      patientDob={selected?.patient?.dob}
                      patientGender={selected?.patient?.gender}
                      initialData={fallRiskData}
                      disabled={isReadOnly}
                      onChange={(result) => {
                        const level = result.riskLevel === 'HIGH' ? 2 : result.riskLevel === 'MODERATE' ? 1 : 0;
                        setFallRisk(level);
                        setFallRiskData({
                          ...result,
                          input: result.input,
                          morseInput: result.scale === 'MORSE' ? result.input as MorseFallInput : undefined,
                          humptyInput: result.scale === 'HUMPTY_DUMPTY' ? result.input as HumptyDumptyInput : undefined,
                        } as FallRiskResult & { input?: MorseFallInput | HumptyDumptyInput; morseInput?: MorseFallInput; humptyInput?: HumptyDumptyInput });
                      }}
                    />

                    {/* Braden Scale — IPD/ICU only */}
                    {show('braden') && (
                    <BradenAssessment
                      initialData={bradenData?.input || null}
                      disabled={isReadOnly}
                      onChange={(result) => setBradenData(result)}
                    />
                    )}

                    <GCSAssessment
                      patientDob={selected?.patient?.dob}
                      initialData={gcsData}
                      disabled={isReadOnly}
                      onChange={(result) => {
                        setGcsData(result as GCSResult & { input: GCSInput });
                      }}
                    />

                    <SBARForm
                      initialData={sbarData}
                      disabled={isReadOnly}
                      autoPopulateCtx={{
                        patient: selected?.patient,
                        clinicName: selected?.clinicName,
                        vitals: {
                          bp: vitals.bp, hr: vitals.hr ? Number(vitals.hr) : null,
                          temp: vitals.temp ? Number(vitals.temp) : null, rr: vitals.rr ? Number(vitals.rr) : null,
                          spo2: vitals.spo2 ? Number(vitals.spo2) : null,
                        },
                        chiefComplaint: chief,
                        mewsResult: vitals.bp || vitals.hr ? (() => {
                          const m = calculateMEWS(vitalsToMEWSInput({
                            bp: vitals.bp, hr: vitals.hr ? Number(vitals.hr) : null,
                            temp: vitals.temp ? Number(vitals.temp) : null, rr: vitals.rr ? Number(vitals.rr) : null,
                            spo2: vitals.spo2 ? Number(vitals.spo2) : null,
                          }, consciousness, onSupplementalO2));
                          return { totalScore: m.totalScore, riskLevel: m.riskLevel };
                        })() : undefined,
                        gcsResult: gcsData ? { totalScore: gcsData.totalScore, category: gcsData.category } : undefined,
                        fallRiskResult: fallRiskData ? { totalScore: fallRiskData.totalScore, riskLevel: fallRiskData.riskLevel, scale: fallRiskData.scale } : undefined,
                      }}
                      onChange={(data) => setSbarData(data)}
                    />

                    <FamilyCommunicationLog
                      value={familyCommData}
                      onChange={setFamilyCommData}
                      disabled={isReadOnly}
                    />

                    <BedsideProcedureChecklist
                      value={proceduresData}
                      onChange={setProceduresData}
                      disabled={isReadOnly}
                    />

                    <NursingCarePlan
                      value={carePlanData}
                      onChange={setCarePlanData}
                      disabled={isReadOnly}
                    />

                    {/* Shift Handover — IPD/ER/ICU only */}
                    {show('shiftHandover') && (
                    <ShiftHandover
                      value={handoverData}
                      onChange={setHandoverData}
                      disabled={isReadOnly}
                    />
                    )}

                    <NursingTaskTimeline
                      value={nursingTasksData}
                      onChange={setNursingTasksData}
                      disabled={isReadOnly}
                    />

                    <MedicationAdminRecord
                      value={marData}
                      onChange={setMarData}
                      disabled={isReadOnly}
                    />

                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{tr('ملاحظات التمريض', 'Nursing notes')}</label>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        placeholder={tr('ملاحظات إضافية...', 'Additional notes...')}
                        className="px-4 py-3 rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast resize-none w-full"
                      />
                    </div>

                    {/* Eye exam fields are in the Vitals tab */}

                    {/* B6: Assessment tab save button */}
                    <button
                      onClick={saveAssessmentStep}
                      disabled={busySave || isPast}
                      className="w-full py-3 bg-primary text-white rounded-xl font-bold mt-4 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed thea-transition-fast"
                    >
                      {busySave ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ التقييم ←', 'Save Assessment →')}
                    </button>
                  </div>
                ) : null}


                {activeTab === 'timeout' ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                      <div className="text-sm font-medium text-primary mb-1">{tr('قائمة التحقق الجراحية — WHO', 'WHO Surgical Safety Checklist')}</div>
                      <div className="text-xs text-primary/70">{tr('3 مراحل: تسجيل الدخول ← وقت التوقف ← تسجيل الخروج', '3 Phases: Sign In → Time Out → Sign Out')}</div>
                    </div>

                    {/* Phase 1: Sign In */}
                    {(() => {
                      const phases = [
                        {
                          title: tr('١. تسجيل الدخول (Sign In)', '1. Sign In'),
                          desc: tr('قبل التخدير — التمريض فقط', 'Before anesthesia — Nurse only'),
                          color: 'blue',
                          items: [
                            { key: 'patientIdentified', label: tr('تأكيد هوية المريض', 'Patient identity confirmed'), desc: tr('الاسم، رقم الملف، تاريخ الميلاد', 'Name, MRN, DOB match wristband') },
                            { key: 'procedureConfirmed', label: tr('تأكيد الإجراء', 'Procedure confirmed'), desc: tr('الإجراء الصحيح مع المريض والطبيب', 'Correct procedure with patient and doctor') },
                            { key: 'siteMarked', label: tr('تحديد الموقع', 'Site marked'), desc: tr('تحديد الموقع الصحيح (إن وجد)', 'Correct site marked if applicable') },
                            { key: 'consentSigned', label: tr('التوقيع على الموافقة', 'Consent signed'), desc: tr('موافقة مستنيرة موقعة وموثقة', 'Informed consent signed') },
                            { key: 'allergiesReviewed', label: tr('مراجعة الحساسيات', 'Allergies reviewed'), desc: tr('حالة الحساسية مؤكدة وموثقة', 'Allergy status confirmed') },
                          ],
                        },
                        {
                          title: tr('٢. وقت التوقف (Time Out)', '2. Time Out'),
                          desc: tr('قبل بدء الإجراء — التمريض + الطبيب', 'Before procedure — Nurse + Doctor'),
                          color: 'amber',
                          items: [
                            { key: 'teamConfirmed', label: tr('تعريف الفريق', 'Team introduction'), desc: tr('جميع أعضاء الفريق عرّفوا أنفسهم', 'All team members introduced') },
                            { key: 'patientProcedureConfirmed', label: tr('تأكيد المريض والإجراء', 'Patient+procedure confirmed'), desc: tr('تأكيد المريض والإجراء والموقع', 'Patient, procedure, and site confirmed') },
                            { key: 'antibioticsGiven', label: tr('المضادات الحيوية', 'Antibiotics given'), desc: tr('تم إعطاء المضادات الوقائية', 'Prophylactic antibiotics administered') },
                            { key: 'imagingReviewed', label: tr('مراجعة التصوير', 'Imaging reviewed'), desc: tr('الصور الطبية متوفرة ومراجعة', 'Relevant imaging available and reviewed') },
                            { key: 'anticipatedEvents', label: tr('الأحداث المتوقعة', 'Anticipated events'), desc: tr('مناقشة المخاطر والأحداث المتوقعة', 'Risks and anticipated events discussed') },
                          ],
                        },
                        {
                          title: tr('٣. تسجيل الخروج (Sign Out)', '3. Sign Out'),
                          desc: tr('بعد الإجراء — التمريض + الطبيب', 'After procedure — Nurse + Doctor'),
                          color: 'emerald',
                          items: [
                            { key: 'procedureRecorded', label: tr('تسجيل الإجراء', 'Procedure recorded'), desc: tr('اسم الإجراء مسجل بدقة', 'Procedure name accurately recorded') },
                            { key: 'instrumentCount', label: tr('عد الأدوات', 'Instrument count'), desc: tr('عد الأدوات والإبر والشاش صحيح', 'Instruments, needles, and sponge count correct') },
                            { key: 'specimenLabeled', label: tr('تسمية العينات', 'Specimen labeled'), desc: tr('العينات مسماة بشكل صحيح', 'Specimens correctly labeled') },
                            { key: 'equipmentIssues', label: tr('مشاكل المعدات', 'Equipment issues'), desc: tr('لا توجد مشاكل في المعدات', 'No equipment issues reported') },
                            { key: 'recoveryPlan', label: tr('خطة التعافي', 'Recovery plan'), desc: tr('خطة التعافي متفق عليها', 'Recovery plan agreed upon') },
                          ],
                        },
                      ];

                      return phases.map((phase) => {
                        const checkedCount = phase.items.filter((i) => timeOutData[i.key as keyof typeof timeOutData]).length;
                        const isComplete = checkedCount === phase.items.length;
                        const borderColor = phase.color === 'blue' ? 'border-blue-200' : phase.color === 'amber' ? 'border-amber-200' : 'border-emerald-200';
                        const bgColor = phase.color === 'blue' ? 'bg-blue-50 dark:bg-blue-950/20' : phase.color === 'amber' ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-emerald-50 dark:bg-emerald-950/20';

                        return (
                          <div key={phase.title} className={`rounded-2xl border-[1.5px] ${isComplete ? 'border-emerald-300' : borderColor} overflow-hidden`}>
                            <div className={`px-4 py-3 ${isComplete ? 'bg-emerald-50 dark:bg-emerald-950/20' : bgColor} flex items-center justify-between`}>
                              <div>
                                <div className="text-sm font-semibold text-foreground">{phase.title}</div>
                                <div className="text-xs text-muted-foreground">{phase.desc}</div>
                              </div>
                              <span className={`text-xs font-medium px-2 py-1 rounded-full ${isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-card text-muted-foreground'}`}>
                                {checkedCount}/{phase.items.length}
                              </span>
                            </div>
                            <div className="divide-y divide-border/50">
                              {phase.items.map((item) => {
                                const checked = timeOutData[item.key as keyof typeof timeOutData];
                                return (
                                  <button
                                    key={item.key}
                                    onClick={() => setTimeOutData({ ...timeOutData, [item.key]: !checked })}
                                    className={`w-full flex items-start gap-3 p-3 text-right thea-transition-fast rounded-xl hover:bg-muted/50 ${checked ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : ''}`}
                                  >
                                    <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 thea-transition-fast ${checked ? 'bg-emerald-500 border-emerald-500' : 'bg-card border-border'}`}>
                                      {checked ? <CheckCircle2 size={12} className="text-white" /> : null}
                                    </div>
                                    <div>
                                      <div className={`text-sm font-medium ${checked ? 'text-emerald-800 dark:text-emerald-400' : 'text-foreground'}`}>{item.label}</div>
                                      <div className={`text-xs ${checked ? 'text-emerald-600 dark:text-emerald-500' : 'text-muted-foreground'}`}>{item.desc}</div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()}

                    <div className="mt-2 text-center">
                      <div className="text-xs text-muted-foreground">
                        {Object.values(timeOutData).filter(Boolean).length} / {Object.keys(timeOutData).length} {tr('عناصر مكتملة', 'checks complete')}
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeTab === 'pfe' ? (
                  <div className="space-y-5">
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                      <div className="text-sm font-medium text-primary mb-1">{tr('تثقيف المريض والأسرة (PFE)', 'Patient & Family Education (PFE)')}</div>
                      <div className="text-xs text-primary/70">{tr('متطلبات JCI/CBAHI — تسجيل الحساسيات والأدوية والتاريخ المرضي والتثقيف الصحي', 'JCI/CBAHI requirements — Record allergies, medications, medical history, and health education')}</div>
                    </div>

                    {/* 1-3: Allergies, Medications, Medical History with NKDA-style checkboxes */}
                    {([
                      { key: 'allergies' as const, label: tr('الحساسيات', 'Allergies'), noneLabel: tr('لا توجد حساسيات معروفة (NKDA)', 'No Known Drug Allergies (NKDA)'), placeholder: tr('مثال: بنسلين، سلفا', 'e.g., Penicillin, Sulfa') },
                      { key: 'medications' as const, label: tr('الأدوية الحالية', 'Current Medications'), noneLabel: tr('لا توجد أدوية حالية', 'No current medications'), placeholder: tr('مثال: ميتفورمين 500mg مرتين يومياً', 'e.g., Metformin 500mg twice daily') },
                      { key: 'history' as const, label: tr('التاريخ المرضي', 'Medical History'), noneLabel: tr('لا يوجد تاريخ مرضي', 'No medical history'), placeholder: tr('مثال: سكري، ضغط الدم', 'e.g., Diabetes, Hypertension') },
                    ]).map((field) => (
                      <div key={field.key} className="space-y-2">
                        <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{field.label}</label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pfe[field.key].hasNone}
                            onChange={(e) => setPfe({ ...pfe, [field.key]: { hasNone: e.target.checked, details: e.target.checked ? '' : pfe[field.key].details } })}
                            className="w-4 h-4 rounded border-border text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-sm text-muted-foreground">{field.noneLabel}</span>
                        </label>
                        {!pfe[field.key].hasNone && (
                          <textarea
                            value={pfe[field.key].details}
                            onChange={(e) => setPfe({ ...pfe, [field.key]: { ...pfe[field.key], details: e.target.value } })}
                            rows={2}
                            placeholder={field.placeholder}
                            className="w-full px-4 py-3 rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast resize-none text-sm"
                          />
                        )}
                      </div>
                    ))}

                    {/* 4: Education Topics Checklist */}
                    <div className="space-y-2">
                      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{tr('مواضيع التثقيف', 'Education Topics')}</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {PFE_EDUCATION_TOPICS.map((topic) => (
                          <label key={topic.key} className="flex items-center gap-2 p-2 rounded-xl hover:bg-muted/50 cursor-pointer thea-transition-fast">
                            <input
                              type="checkbox"
                              checked={pfe.educationTopics.includes(topic.key)}
                              onChange={(e) => {
                                const topics = e.target.checked
                                  ? [...pfe.educationTopics, topic.key]
                                  : pfe.educationTopics.filter((t) => t !== topic.key);
                                setPfe({ ...pfe, educationTopics: topics });
                              }}
                              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-foreground">{language === 'en' && topic.labelEn ? topic.labelEn : topic.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* 5 & 6: Method + Language */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{tr('طريقة التثقيف', 'Education Method')}</label>
                        <div className="flex flex-wrap gap-1.5">
                          {PFE_METHODS.map((m) => (
                            <button
                              key={m.key}
                              type="button"
                              onClick={() => setPfe({ ...pfe, method: m.key })}
                              className={`px-3 py-1.5 rounded-xl text-xs border thea-transition-fast ${
                                pfe.method === m.key ? 'bg-primary/10 text-primary border-primary ring-1 ring-primary' : 'bg-card text-muted-foreground border-border'
                              }`}
                            >
                              {language === 'en' && m.labelEn ? m.labelEn : m.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{tr('لغة التثقيف', 'Education Language')}</label>
                        <div className="flex gap-2">
                          {PFE_LANGUAGES.map((l) => (
                            <button
                              key={l.key}
                              type="button"
                              onClick={() => setPfe({ ...pfe, language: l.key })}
                              className={`px-3 py-1.5 rounded-xl text-xs border thea-transition-fast ${
                                pfe.language === l.key ? 'bg-primary/10 text-primary border-primary ring-1 ring-primary' : 'bg-card text-muted-foreground border-border'
                              }`}
                            >
                              {language === 'en' && l.labelEn ? l.labelEn : l.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 7: Learning Barriers */}
                    <div className="space-y-2">
                      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{tr('عوائق التعلم', 'Learning Barriers')}</label>
                      <div className="flex flex-wrap gap-2">
                        {PFE_BARRIERS.map((b) => (
                          <button
                            key={b.key}
                            type="button"
                            onClick={() => {
                              const barriers = pfe.barriers.includes(b.key)
                                ? pfe.barriers.filter((x) => x !== b.key)
                                : [...pfe.barriers, b.key];
                              setPfe({ ...pfe, barriers });
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs border thea-transition-fast ${
                              pfe.barriers.includes(b.key) ? 'bg-amber-100 text-amber-800 border-amber-300 ring-1 ring-amber-300' : 'bg-card text-muted-foreground border-border'
                            }`}
                          >
                            {language === 'en' && b.labelEn ? b.labelEn : b.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 8: Understanding Assessment (required) */}
                    <div className="space-y-2">
                      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {tr('تقييم الفهم', 'Understanding Assessment')} <span className="text-red-500">*</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {PFE_UNDERSTANDING.map((u) => (
                          <button
                            key={u.key}
                            type="button"
                            onClick={() => setPfe({ ...pfe, understanding: u.key })}
                            className={`px-4 py-2 rounded-xl text-sm border thea-transition-fast ${
                              pfe.understanding === u.key
                                ? u.key === 'full' ? 'bg-green-100 text-green-800 border-green-300 ring-1 ring-green-300'
                                  : u.key === 'partial' ? 'bg-amber-100 text-amber-800 border-amber-300 ring-1 ring-amber-300'
                                  : 'bg-red-100 text-red-800 border-red-300 ring-1 ring-red-300'
                                : 'bg-card text-muted-foreground border-border'
                            }`}
                          >
                            {language === 'en' && u.labelEn ? u.labelEn : u.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 9: Confirmation checkbox (required) */}
                    <label className="flex items-start gap-3 p-4 bg-muted/30 rounded-2xl border border-border cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pfe.confirmed}
                        onChange={(e) => setPfe({ ...pfe, confirmed: e.target.checked })}
                        className="w-5 h-5 mt-0.5 rounded border-border text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-foreground">{tr('أقر بأنه تم تثقيف المريض / الأسرة', 'I confirm that patient/family education was provided')}</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">{tr('مطلوب للإكمال', 'Required to complete')}</span>
                      </div>
                    </label>

                    {/* B6: PFE tab save button */}
                    <button
                      onClick={savePFEStep}
                      disabled={busySave || isPast || !pfe.understanding || !pfe.confirmed}
                      className="w-full py-3 bg-primary text-white rounded-xl font-bold mt-4 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed thea-transition-fast"
                    >
                      {busySave ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ التثقيف الصحي ✓', 'Save Patient Education ✓')}
                    </button>
                    {(!pfe.understanding || !pfe.confirmed) && (
                      <p className="text-xs text-amber-600 text-center">{tr('يجب تقييم الفهم والإقرار بالتثقيف', 'Understanding assessment and confirmation required')}</p>
                    )}
                  </div>
                ) : null}

                </div>{/* Close B2 wrapper */}
              </div>

              <div className="px-6 py-3 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  {tr('الأولوية', 'Priority')}
                  {!priorityManual && priority && (
                    <span className="text-xs text-primary font-normal mr-2">{tr('(مقترح)', '(Suggested)')}</span>
                  )}
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'URGENT', labelAr: 'عاجل', labelEn: 'Urgent', style: 'bg-red-100 text-red-800 border-red-300' },
                    { value: 'HIGH', labelAr: 'مرتفع', labelEn: 'High', style: 'bg-orange-100 text-orange-800 border-orange-300' },
                    { value: 'NORMAL', labelAr: 'عادي', labelEn: 'Normal', style: 'bg-green-100 text-green-800 border-green-300' },
                    { value: 'LOW', labelAr: 'منخفض', labelEn: 'Low', style: 'bg-blue-100 text-blue-800 border-blue-300' },
                  ].map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => { setPriority(priority === p.value ? '' : p.value); setPriorityManual(true); }}
                      className={`px-3 py-1.5 rounded-xl text-xs border thea-transition-fast ${
                        priority === p.value ? p.style + ' ring-2 ring-offset-1' : 'bg-card text-muted-foreground border-border'
                      }`}
                    >
                      {tr(p.labelAr, p.labelEn)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border bg-muted/30 px-6 py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <button onClick={closePanel} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground thea-transition-fast">
                    {tr('إلغاء', 'Cancel')}
                  </button>
                  {/* B6: "جاهز للطبيب" gated on all required steps complete */}
                  <button
                    onClick={markReady}
                    disabled={!allRequiredComplete || isPast || busyReady || isReadOnly}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold thea-transition-fast ${
                      allRequiredComplete && !isReadOnly
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/25'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    }`}
                  >
                    {busyReady ? tr('جاري الإرسال...', 'Sending...') : `✓ ${tr('جاهز للطبيب', 'Ready for doctor')}`}
                  </button>
                </div>
                {!allRequiredComplete && nursingStarted && !isReadOnly && (
                  <p className="text-xs text-amber-600 text-center">
                    {tr('أكمل:', 'Complete:')}
                    {!completedSteps.has('vitals') && ` ${tr('العلامات الحيوية', 'Vitals')} •`}
                    {!completedSteps.has('assessment') && ` ${tr('التقييم', 'Assessment')} •`}
                    {!completedSteps.has('pfe') && ` ${tr('التثقيف الصحي', 'Education')}`}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}

      {/* C1: Consent Form Modal */}
      {showConsentForm && selected && (
        <ConsentForm
          consentType={consentType}
          patientName={selected.patient?.fullName || ''}
          patientId={selected.patient?.id || selected.patientMasterId || ''}
          encounterId={selected.encounterCoreId}
          onComplete={handleConsentComplete}
          onCancel={() => setShowConsentForm(false)}
        />
      )}
      </div>
  );
}
