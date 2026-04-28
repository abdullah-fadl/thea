/**
 * Medication Administration Record (MAR)
 * Tracks scheduled and PRN medications with administration times,
 * held/refused documentation, and safety checks.
 */

export type MARStatus = 'SCHEDULED' | 'GIVEN' | 'HELD' | 'REFUSED' | 'MISSED' | 'SELF_ADMIN';
export type MARRoute = 'PO' | 'IV' | 'IM' | 'SC' | 'TOPICAL' | 'INHALED' | 'RECTAL' | 'SUBLINGUAL' | 'OPHTHALMIC' | 'OTIC' | 'NASAL' | 'OTHER';
export type MARFrequency = 'STAT' | 'ONCE' | 'BID' | 'TID' | 'QID' | 'Q4H' | 'Q6H' | 'Q8H' | 'Q12H' | 'DAILY' | 'PRN';

export interface MARMedication {
  id: string;
  name: string;
  dose: string;
  route: MARRoute;
  frequency: MARFrequency;
  prescribedBy: string;
  startDate: string;
  isPRN: boolean;
  prnReason?: string;
  instructions?: string;
}

export interface MARAdminEntry {
  id: string;
  medicationId: string;
  scheduledTime: string;
  status: MARStatus;
  administeredAt?: string;
  administeredBy?: string;
  holdReason?: string;
  refusedReason?: string;
  siteGiven?: string;
  notes?: string;
  painScoreBefore?: number;
  painScoreAfter?: number;
}

export interface MARData {
  medications: MARMedication[];
  adminEntries: MARAdminEntry[];
}

export const DEFAULT_MAR: MARData = { medications: [], adminEntries: [] };

export const MAR_ROUTES: { value: MARRoute; labelAr: string; labelEn: string }[] = [
  { value: 'PO', labelAr: 'فموي', labelEn: 'Oral (PO)' },
  { value: 'IV', labelAr: 'وريدي', labelEn: 'Intravenous (IV)' },
  { value: 'IM', labelAr: 'عضلي', labelEn: 'Intramuscular (IM)' },
  { value: 'SC', labelAr: 'تحت الجلد', labelEn: 'Subcutaneous (SC)' },
  { value: 'TOPICAL', labelAr: 'موضعي', labelEn: 'Topical' },
  { value: 'INHALED', labelAr: 'استنشاق', labelEn: 'Inhaled' },
  { value: 'RECTAL', labelAr: 'شرجي', labelEn: 'Rectal' },
  { value: 'SUBLINGUAL', labelAr: 'تحت اللسان', labelEn: 'Sublingual' },
  { value: 'OPHTHALMIC', labelAr: 'عيني', labelEn: 'Ophthalmic' },
  { value: 'OTIC', labelAr: 'أذني', labelEn: 'Otic' },
  { value: 'NASAL', labelAr: 'أنفي', labelEn: 'Nasal' },
  { value: 'OTHER', labelAr: 'أخرى', labelEn: 'Other' },
];

export const MAR_FREQUENCIES: { value: MARFrequency; labelAr: string; labelEn: string }[] = [
  { value: 'STAT', labelAr: 'فوري', labelEn: 'STAT' },
  { value: 'ONCE', labelAr: 'مرة واحدة', labelEn: 'Once' },
  { value: 'DAILY', labelAr: 'يومياً', labelEn: 'Daily' },
  { value: 'BID', labelAr: 'مرتين يومياً', labelEn: 'BID' },
  { value: 'TID', labelAr: 'ثلاث مرات', labelEn: 'TID' },
  { value: 'QID', labelAr: 'أربع مرات', labelEn: 'QID' },
  { value: 'Q4H', labelAr: 'كل 4 ساعات', labelEn: 'Q4H' },
  { value: 'Q6H', labelAr: 'كل 6 ساعات', labelEn: 'Q6H' },
  { value: 'Q8H', labelAr: 'كل 8 ساعات', labelEn: 'Q8H' },
  { value: 'Q12H', labelAr: 'كل 12 ساعة', labelEn: 'Q12H' },
  { value: 'PRN', labelAr: 'عند الحاجة', labelEn: 'PRN' },
];

export const MAR_STATUS_CFG: Record<MARStatus, { bg: string; text: string; labelAr: string; labelEn: string; icon: string }> = {
  SCHEDULED: { bg: 'bg-blue-100', text: 'text-blue-700', labelAr: 'مجدول', labelEn: 'Scheduled', icon: 'clock' },
  GIVEN: { bg: 'bg-green-100', text: 'text-green-700', labelAr: 'تم إعطاؤه', labelEn: 'Given', icon: 'check-circle-2' },
  HELD: { bg: 'bg-amber-100', text: 'text-amber-700', labelAr: 'معلّق', labelEn: 'Held', icon: 'pause-circle' },
  REFUSED: { bg: 'bg-red-100', text: 'text-red-600', labelAr: 'رفض المريض', labelEn: 'Refused', icon: 'x-circle' },
  MISSED: { bg: 'bg-gray-100', text: 'text-gray-500', labelAr: 'فائت', labelEn: 'Missed', icon: 'alert-triangle' },
  SELF_ADMIN: { bg: 'bg-purple-100', text: 'text-purple-700', labelAr: 'إعطاء ذاتي', labelEn: 'Self-Admin', icon: 'user' },
};

export function createMedication(): MARMedication {
  return {
    id: `med-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: '', dose: '', route: 'PO', frequency: 'DAILY',
    prescribedBy: '', startDate: new Date().toISOString().slice(0, 10),
    isPRN: false,
  };
}

export function createAdminEntry(medicationId: string): MARAdminEntry {
  return {
    id: `adm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    medicationId,
    scheduledTime: new Date().toISOString(),
    status: 'SCHEDULED',
  };
}
