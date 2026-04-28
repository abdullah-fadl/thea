// =============================================================================
// Daily Care Path — Core Types & Constants
// =============================================================================

export type CarePathDepartment = 'OPD' | 'IPD' | 'ER' | 'ICU' | 'NICU' | 'NURSERY' | 'LDR';
export type CarePathTemplate = 'adult' | 'baby' | 'nicu' | 'critical' | 'ldr';

export type TaskCategory =
  | 'VITALS'
  | 'MEDICATION'
  | 'LAB'
  | 'RADIOLOGY'
  | 'PROCEDURE'
  | 'DIET'
  | 'DOCTOR_VISIT'
  | 'NURSING_CARE'
  | 'INSTRUCTION'
  | 'IO'
  | 'WOUND_CARE'
  | 'ASSESSMENT'
  | 'CUSTOM';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'MISSED' | 'HELD' | 'REFUSED' | 'CANCELLED';
export type ShiftType = 'DAY' | 'NIGHT';
export type TaskPriority = 'STAT' | 'URGENT' | 'ROUTINE';
export type TaskSource = 'AUTO' | 'MANUAL' | 'ORDER_UPDATE' | 'CARRY_FORWARD';
export type AlertType = 'NEW_ORDER' | 'MODIFIED_ORDER' | 'CANCELLED_ORDER' | 'STAT_ORDER' | 'CRITICAL_RESULT' | 'DIET_CHANGE';
export type AlertSeverity = 'INFO' | 'WARNING' | 'URGENT' | 'CRITICAL';
export type MissedReason = 'patient_unavailable' | 'held_by_md' | 'patient_refused' | 'equipment_issue' | 'other';

export interface PatientSnapshot {
  fullName: string;
  fullNameAr?: string;
  mrn?: string;
  dob?: string;
  gender?: string;
  room?: string;
  bed?: string;
  ward?: string;
  allergies?: string[];
  diagnosis?: string;
  diagnosisAr?: string;
  bloodType?: string;
  weight?: number;
  gestationalAge?: number; // NICU
  incubatorNo?: string;    // NICU
  birthWeight?: number;    // Baby
  motherName?: string;     // Baby/NICU
  motherNameAr?: string;
}

export interface DietOrder {
  type: string;
  typeAr?: string;
  instructions?: string;
  instructionsAr?: string;
  mealTimes?: MealSlot[];
}

export interface MealSlot {
  time: string; // HH:mm
  label: string;
  labelAr?: string;
  status?: TaskStatus;
  notes?: string;
}

export interface RoundSchedule {
  doctorName: string;
  doctorNameAr?: string;
  doctorUserId?: string;
  scheduledTime: string; // HH:mm
  type: 'ROUTINE' | 'CONSULTATION' | 'FOLLOW_UP' | 'DISCHARGE';
  typeAr?: string;
  status?: TaskStatus;
  notes?: string;
}

export interface PatientInstruction {
  text: string;
  textAr?: string;
  status: 'EXPLAINED' | 'TO_BE_DONE';
  source?: string;
}

export interface ShiftSummary {
  completionPct: number;
  totalTasks: number;
  completedTasks: number;
  missedTasks: number;
  heldTasks: number;
  highlights: string[];
  highlightsAr?: string[];
  pendingCarryForward: string[];
  notes?: string;
  notesAr?: string;
}

// Task-specific data templates
export interface VitalsTaskData {
  frequency: string; // Q4H, Q1H, etc.
  parameters: string[]; // BP, HR, RR, Temp, SpO2
}

export interface VitalsResultData {
  systolic?: number;
  diastolic?: number;
  hr?: number;
  rr?: number;
  temp?: number;
  spo2?: number;
  painScore?: number;
  avpu?: string;
  notes?: string;
}

export interface MedicationTaskData {
  drugName: string;
  drugNameAr?: string;
  genericName?: string;
  dose: string;
  unit?: string;
  route: string;
  routeAr?: string;
  frequency: string;
  frequencyAr?: string;
  indication?: string;
  indicationAr?: string;
  isHighAlert?: boolean;
  isControlled?: boolean;
  specialInstructions?: string;
}

export interface MedicationResultData {
  givenAt: string;
  givenBy: string;
  givenByName?: string;
  dose: string;
  route: string;
  site?: string;
  witnessedBy?: string;
  witnessName?: string;
  batchNo?: string;
  notes?: string;
}

export interface LabTaskData {
  testCode: string;
  testName: string;
  testNameAr?: string;
  specimenType?: string;
  instructions?: string;
}

export interface ProcedureTaskData {
  procedureName: string;
  procedureNameAr?: string;
  category: string; // Laboratory, Radiology, Nursing Care, Therapy, Other
  details?: string;
}

export interface IOTaskData {
  type: 'INTAKE' | 'OUTPUT';
  source?: string; // IV, PO, Urine, Drain, etc.
}

export interface IOResultData {
  amount: number;
  unit: string;
  source: string;
  notes?: string;
}

// Shift time boundaries
export const SHIFT_TIMES: Record<ShiftType, { start: string; end: string }> = {
  DAY:   { start: '07:00', end: '19:00' },
  NIGHT: { start: '19:00', end: '07:00' },
};

// Category display configuration
export const TASK_CATEGORY_CONFIG: Record<TaskCategory, {
  labelEn: string;
  labelAr: string;
  icon: string;
  color: string;
}> = {
  VITALS:        { labelEn: 'Vital Signs',       labelAr: 'العلامات الحيوية',   icon: 'heart',          color: '#ef4444' },
  MEDICATION:    { labelEn: 'Medication',         labelAr: 'الأدوية',           icon: 'pill',           color: '#3b82f6' },
  LAB:           { labelEn: 'Laboratory',         labelAr: 'المختبر',           icon: 'flask-conical',  color: '#8b5cf6' },
  RADIOLOGY:     { labelEn: 'Radiology',          labelAr: 'الأشعة',            icon: 'camera',         color: '#6366f1' },
  PROCEDURE:     { labelEn: 'Procedure',          labelAr: 'إجراء طبي',         icon: 'stethoscope',    color: '#0891b2' },
  DIET:          { labelEn: 'Diet / Meal',        labelAr: 'وجبة / حمية',       icon: 'utensils',       color: '#f59e0b' },
  DOCTOR_VISIT:  { labelEn: 'Doctor Visit',       labelAr: 'زيارة الطبيب',      icon: 'user-round',     color: '#10b981' },
  NURSING_CARE:  { labelEn: 'Nursing Care',       labelAr: 'عناية تمريضية',     icon: 'heart-handshake',color: '#ec4899' },
  INSTRUCTION:   { labelEn: 'Patient Instruction',labelAr: 'إرشادات المريض',    icon: 'clipboard',      color: '#64748b' },
  IO:            { labelEn: 'Intake/Output',      labelAr: 'سوائل داخلة/خارجة', icon: 'droplets',       color: '#06b6d4' },
  WOUND_CARE:    { labelEn: 'Wound Care',         labelAr: 'عناية بالجرح',      icon: 'bandage',        color: '#f97316' },
  ASSESSMENT:    { labelEn: 'Assessment',         labelAr: 'تقييم',             icon: 'bar-chart-3',    color: '#8b5cf6' },
  CUSTOM:        { labelEn: 'Custom Task',        labelAr: 'مهمة مخصصة',       icon: 'file-text',      color: '#6b7280' },
};

export const TASK_STATUS_CONFIG: Record<TaskStatus, {
  labelEn: string;
  labelAr: string;
  icon: string;
  color: string;
}> = {
  PENDING:     { labelEn: 'Pending',    labelAr: 'قيد الانتظار', icon: 'square',         color: '#94a3b8' },
  IN_PROGRESS: { labelEn: 'In Progress',labelAr: 'قيد التنفيذ', icon: 'clock',          color: '#f59e0b' },
  DONE:        { labelEn: 'Done',       labelAr: 'تم',          icon: 'check-circle-2', color: '#22c55e' },
  MISSED:      { labelEn: 'Missed',     labelAr: 'فائت',        icon: 'x-circle',       color: '#ef4444' },
  HELD:        { labelEn: 'Held',       labelAr: 'معلّق',       icon: 'pause-circle',   color: '#f97316' },
  REFUSED:     { labelEn: 'Refused',    labelAr: 'رفض المريض',  icon: 'x-circle',       color: '#dc2626' },
  CANCELLED:   { labelEn: 'Cancelled',  labelAr: 'ملغي',        icon: 'circle-dot',     color: '#9ca3af' },
};

export const MISSED_REASON_OPTIONS: { value: MissedReason; labelEn: string; labelAr: string }[] = [
  { value: 'patient_unavailable', labelEn: 'Patient Unavailable',  labelAr: 'المريض غير متاح' },
  { value: 'held_by_md',          labelEn: 'Held by Physician',    labelAr: 'معلّق بأمر الطبيب' },
  { value: 'patient_refused',     labelEn: 'Patient Refused',      labelAr: 'رفض المريض' },
  { value: 'equipment_issue',     labelEn: 'Equipment Issue',      labelAr: 'مشكلة بالمعدات' },
  { value: 'other',               labelEn: 'Other',                labelAr: 'أخرى' },
];

// Medication routes (from Path.html)
export const MEDICATION_ROUTES = [
  { value: 'PO',         labelEn: 'PO (Oral)',              labelAr: 'عن طريق الفم' },
  { value: 'SL',         labelEn: 'SL (Sublingual)',        labelAr: 'تحت اللسان' },
  { value: 'IV',         labelEn: 'IV (Intravenous)',       labelAr: 'وريدي' },
  { value: 'IV_PUSH',    labelEn: 'IV Push',                labelAr: 'دفع وريدي' },
  { value: 'IV_INFUSION',labelEn: 'IV Infusion',            labelAr: 'محلول وريدي مستمر' },
  { value: 'IM',         labelEn: 'IM (Intramuscular)',     labelAr: 'عضلي' },
  { value: 'SC',         labelEn: 'SC (Subcutaneous)',      labelAr: 'تحت الجلد' },
  { value: 'NGT',        labelEn: 'NGT (Nasogastric)',      labelAr: 'أنبوب أنفي معدي' },
  { value: 'OGT',        labelEn: 'OGT (Orogastric)',       labelAr: 'أنبوب فموي معدي' },
  { value: 'PEG',        labelEn: 'PEG Tube',               labelAr: 'أنبوب تغذية بالمعدة' },
  { value: 'INH',        labelEn: 'Inhalation (Puff)',      labelAr: 'استنشاق (بخة)' },
  { value: 'NEB',        labelEn: 'Nebulization',           labelAr: 'جهاز بخار' },
  { value: 'TOP_OINT',   labelEn: 'Topical Ointment',       labelAr: 'مرهم موضعي' },
  { value: 'TOP_CREAM',  labelEn: 'Topical Cream',          labelAr: 'كريم موضعي' },
  { value: 'TOP_GEL',    labelEn: 'Topical Gel',            labelAr: 'جل موضعي' },
  { value: 'TD',         labelEn: 'Transdermal Patch',      labelAr: 'لاصقة جلدية' },
  { value: 'PR_SUPP',    labelEn: 'Rectal (Suppository)',   labelAr: 'تحميلة شرجية' },
  { value: 'PR_ENEMA',   labelEn: 'Rectal (Enema)',         labelAr: 'حقنة شرجية' },
  { value: 'PV',         labelEn: 'Vaginal (PV)',           labelAr: 'مهبلي' },
  { value: 'EYE',        labelEn: 'Eye Drop (Ophthalmic)',  labelAr: 'قطرة عين' },
  { value: 'EAR',        labelEn: 'Ear Drop (Otic)',        labelAr: 'قطرة أذن' },
  { value: 'NASAL',      labelEn: 'Nasal Spray/Drop',       labelAr: 'بخاخ/قطرة أنف' },
  { value: 'CL',         labelEn: 'Central Line',           labelAr: 'قسطرة مركزية' },
  { value: 'PICC',       labelEn: 'PICC Line',              labelAr: 'قسطرة طرفية مركزية' },
  { value: 'EPIDURAL',   labelEn: 'Epidural',               labelAr: 'إيبيدورال' },
  { value: 'IO',         labelEn: 'Intraosseous (IO)',      labelAr: 'داخل العظم' },
];

// Medication frequencies (from Path.html)
export const MEDICATION_FREQUENCIES = [
  { value: 'STAT',       labelEn: 'STAT',                   labelAr: 'حالاً (مرة واحدة)' },
  { value: 'PRN',        labelEn: 'PRN',                    labelAr: 'عند اللزوم' },
  { value: 'QD',         labelEn: 'Once Daily (QD)',         labelAr: 'مرة يومياً' },
  { value: 'BID',        labelEn: 'BID (Q12H)',             labelAr: 'مرتين يومياً' },
  { value: 'TID',        labelEn: 'TID (Q8H)',              labelAr: '٣ مرات يومياً' },
  { value: 'QID',        labelEn: 'QID (Q6H)',              labelAr: '٤ مرات يومياً' },
  { value: 'Q1H',        labelEn: 'Q1H',                    labelAr: 'كل ساعة' },
  { value: 'Q2H',        labelEn: 'Q2H',                    labelAr: 'كل ساعتين' },
  { value: 'Q3H',        labelEn: 'Q3H',                    labelAr: 'كل ٣ ساعات' },
  { value: 'Q4H',        labelEn: 'Q4H',                    labelAr: 'كل ٤ ساعات' },
  { value: 'Q6H',        labelEn: 'Q6H',                    labelAr: 'كل ٦ ساعات' },
  { value: 'Q8H',        labelEn: 'Q8H',                    labelAr: 'كل ٨ ساعات' },
  { value: 'Q12H',       labelEn: 'Q12H',                   labelAr: 'كل ١٢ ساعة' },
  { value: 'Q24H',       labelEn: 'Q24H',                   labelAr: 'كل ٢٤ ساعة' },
  { value: 'CONTINUOUS',  labelEn: 'Continuous Infusion',    labelAr: 'محلول مستمر' },
  { value: 'TITRATED',   labelEn: 'Titrated',               labelAr: 'جرعة متغيرة' },
  { value: 'AC',         labelEn: 'Before Meals (AC)',       labelAr: 'قبل الأكل' },
  { value: 'PC',         labelEn: 'After Meals (PC)',        labelAr: 'بعد الأكل' },
  { value: 'HS',         labelEn: 'At Bedtime (HS)',         labelAr: 'عند النوم' },
];

// Diet types (from Path.html)
export const DIET_TYPES = [
  { value: 'REGULAR',       labelEn: 'Regular Diet',            labelAr: 'حمية عادية' },
  { value: 'DIABETIC',      labelEn: 'Diabetic (ADA)',          labelAr: 'سكري' },
  { value: 'CARDIAC',       labelEn: 'Cardiac / Low Sodium',    labelAr: 'قلب / قليلة الصوديوم' },
  { value: 'RENAL',         labelEn: 'Renal Diet',              labelAr: 'كلى' },
  { value: 'SOFT',          labelEn: 'Soft / Mechanical Soft',  labelAr: 'أكل لين' },
  { value: 'FULL_LIQUID',   labelEn: 'Full Liquid',             labelAr: 'سوائل كاملة' },
  { value: 'CLEAR_LIQUID',  labelEn: 'Clear Liquid',            labelAr: 'سوائل شفافة' },
  { value: 'NPO',           labelEn: 'NPO',                     labelAr: 'صيام تام' },
  { value: 'HIGH_FIBER',    labelEn: 'High Fiber',              labelAr: 'عالية الألياف' },
  { value: 'LOW_RESIDUE',   labelEn: 'Low Residue',             labelAr: 'قليلة الألياف' },
  { value: 'GLUTEN_FREE',   labelEn: 'Gluten Free',             labelAr: 'خالية من الجلوتين' },
  { value: 'G6PD',          labelEn: 'G6PD Diet',               labelAr: 'حمية أنيميا الفول' },
  { value: 'TUBE_FEEDING',  labelEn: 'Tube Feeding',            labelAr: 'تغذية أنبوبية' },
  { value: 'TPN',           labelEn: 'TPN',                     labelAr: 'تغذية وريدية كاملة' },
  { value: 'ENTERAL',       labelEn: 'Enteral Nutrition',       labelAr: 'تغذية معوية' },
];

// Doctor visit types
export const DOCTOR_VISIT_TYPES = [
  { value: 'ROUTINE',      labelEn: 'Routine Round',    labelAr: 'زيارة روتينية' },
  { value: 'CONSULTATION', labelEn: 'Consultation',     labelAr: 'استشارة' },
  { value: 'FOLLOW_UP',    labelEn: 'Follow Up',        labelAr: 'متابعة' },
  { value: 'DISCHARGE',    labelEn: 'Discharge Plan',   labelAr: 'خروج' },
];

// Procedure categories
export const PROCEDURE_CATEGORIES = [
  { value: 'LABORATORY',    labelEn: 'Laboratory',      labelAr: 'المختبر' },
  { value: 'RADIOLOGY',     labelEn: 'Radiology',       labelAr: 'الأشعة' },
  { value: 'NURSING_CARE',  labelEn: 'Nursing Care',    labelAr: 'عناية تمريضية' },
  { value: 'THERAPY',       labelEn: 'Therapy',         labelAr: 'علاج' },
  { value: 'OTHER',         labelEn: 'Other',           labelAr: 'أخرى' },
];

// Default meal times
export const DEFAULT_MEAL_TIMES: Record<string, MealSlot[]> = {
  STANDARD: [
    { time: '08:00', label: 'Breakfast', labelAr: 'فطور' },
    { time: '12:30', label: 'Lunch',     labelAr: 'غداء' },
    { time: '18:00', label: 'Dinner',    labelAr: 'عشاء' },
  ],
  WITH_SNACKS: [
    { time: '08:00', label: 'Breakfast',       labelAr: 'فطور' },
    { time: '10:30', label: 'Morning Snack',   labelAr: 'وجبة خفيفة صباحية' },
    { time: '12:30', label: 'Lunch',           labelAr: 'غداء' },
    { time: '15:30', label: 'Afternoon Snack', labelAr: 'وجبة خفيفة مسائية' },
    { time: '18:00', label: 'Dinner',          labelAr: 'عشاء' },
    { time: '21:00', label: 'Evening Snack',   labelAr: 'وجبة خفيفة ليلية' },
  ],
};

// Template-to-department mapping
export const DEPARTMENT_TEMPLATE_MAP: Record<CarePathDepartment, CarePathTemplate> = {
  OPD: 'adult',
  IPD: 'adult',
  ER: 'adult',
  ICU: 'critical',
  NICU: 'nicu',
  NURSERY: 'baby',
  LDR: 'ldr',
};

// Frequency to hours mapping for generating task times
export function frequencyToHours(freq: string): number | null {
  const map: Record<string, number> = {
    Q1H: 1, Q2H: 2, Q3H: 3, Q4H: 4, Q6H: 6, Q8H: 8, Q12H: 12, Q24H: 24,
    QD: 24, BID: 12, TID: 8, QID: 6,
  };
  return map[freq] ?? null;
}

export function generateTimeSlots(frequency: string, shiftStart: string, shiftEnd: string): string[] {
  const hours = frequencyToHours(frequency);
  if (!hours) return [];

  const times: string[] = [];
  const [startH] = shiftStart.split(':').map(Number);
  const [endH] = shiftEnd.split(':').map(Number);

  const effectiveEnd = endH <= startH ? endH + 24 : endH;

  for (let h = startH; h < effectiveEnd; h += hours) {
    const displayH = h % 24;
    times.push(`${String(displayH).padStart(2, '0')}:00`);
  }
  return times;
}

export function generateDayTimeSlots(frequency: string): string[] {
  const hours = frequencyToHours(frequency);
  if (!hours) return [];

  const times: string[] = [];
  for (let h = 0; h < 24; h += hours) {
    times.push(`${String(h).padStart(2, '0')}:00`);
  }
  return times;
}

export function getShiftForTime(time: string): ShiftType {
  const [h] = time.split(':').map(Number);
  return (h >= 7 && h < 19) ? 'DAY' : 'NIGHT';
}
