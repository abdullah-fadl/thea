/**
 * Smart Shift Handover
 * Structured ISBAR-based shift handover with auto-populated patient summaries.
 * Covers pending tasks, active alerts, and continuity items.
 */

export type HandoverUrgency = 'ROUTINE' | 'ATTENTION' | 'URGENT';
export type ShiftType = 'DAY' | 'EVENING' | 'NIGHT';

export interface HandoverTask {
  id: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  completed: boolean;
  dueTime?: string;
}

export interface HandoverEntry {
  id: string;
  patientName: string;
  patientMrn: string;
  encounterCoreId: string;
  urgency: HandoverUrgency;
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  pendingTasks: HandoverTask[];
  activeAlerts: string[];
  ivAccess: string;
  isolationPrecautions: string;
  dietRestrictions: string;
  codeStatus: string;
  notes: string;
}

export interface ShiftHandoverData {
  shiftType: ShiftType;
  handoverFrom: string;
  handoverTo: string;
  handoverTime: string;
  entries: HandoverEntry[];
  generalNotes: string;
}

export const DEFAULT_HANDOVER: ShiftHandoverData = {
  shiftType: 'DAY',
  handoverFrom: '',
  handoverTo: '',
  handoverTime: new Date().toISOString(),
  entries: [],
  generalNotes: '',
};

export const SHIFT_TYPES: { value: ShiftType; labelAr: string; labelEn: string; icon: string }[] = [
  { value: 'DAY', labelAr: 'صباحي', labelEn: 'Day Shift', icon: 'sun' },
  { value: 'EVENING', labelAr: 'مسائي', labelEn: 'Evening Shift', icon: 'sunset' },
  { value: 'NIGHT', labelAr: 'ليلي', labelEn: 'Night Shift', icon: 'moon' },
];

export const URGENCY_CFG: Record<HandoverUrgency, { bg: string; text: string; labelAr: string; labelEn: string }> = {
  ROUTINE: { bg: 'bg-gray-100', text: 'text-gray-600', labelAr: 'روتيني', labelEn: 'Routine' },
  ATTENTION: { bg: 'bg-amber-100', text: 'text-amber-700', labelAr: 'يحتاج انتباه', labelEn: 'Attention' },
  URGENT: { bg: 'bg-red-100', text: 'text-red-700', labelAr: 'عاجل', labelEn: 'Urgent' },
};

export function createHandoverEntry(patient: { name: string; mrn: string; encounterCoreId: string }): HandoverEntry {
  return {
    id: `ho-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    patientName: patient.name,
    patientMrn: patient.mrn,
    encounterCoreId: patient.encounterCoreId,
    urgency: 'ROUTINE',
    situation: '', background: '', assessment: '', recommendation: '',
    pendingTasks: [], activeAlerts: [],
    ivAccess: '', isolationPrecautions: '', dietRestrictions: '', codeStatus: '',
    notes: '',
  };
}
