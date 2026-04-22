// =============================================================================
// Specialty Configuration — NEW FILE
// =============================================================================
// To add a new specialty: add one entry to SPECIALTY_CONFIGS below.
// The UI (SpecialtyExamSection, SoapPanel) reads this config automatically.
// NO other files need to be modified.

export type FieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'textarea'
  | 'bilateral'   // OD/OS or Left/Right
  | 'scale'       // numeric scale with labels
  | 'checkbox'
  | 'date';

export interface SpecialtyField {
  key: string;
  labelAr: string;
  labelEn: string;
  type: FieldType;
  unit?: string;
  options?: string[];          // for select / multiselect
  optionsAr?: string[];        // Arabic options
  min?: number;
  max?: number;
  step?: number;
  group?: string;              // visual grouping within section
  hint?: string;
  hintAr?: string;
}

export interface SpecialtyScoreTool {
  id: string;
  labelAr: string;
  labelEn: string;
  description?: string;
}

export interface SpecialtyConfig {
  codes: string[];             // specialty codes that match this config (lowercase, partial match)
  labelAr: string;
  labelEn: string;
  icon: string;
  examFields: SpecialtyField[];
  scoringTools?: SpecialtyScoreTool[];
  soapHints?: {
    chiefComplaintAr?: string;
    chiefComplaintEn?: string;
    physicalExamAr?: string;
    physicalExamEn?: string;
  };
}

// =============================================================================
// All Specialty Configs
// =============================================================================

export const SPECIALTY_CONFIGS: SpecialtyConfig[] = [

  // ── 1. Ophthalmology (already existed — migrated to config system) ─────────
  {
    codes: ['ophthalmology', 'optometry', 'ophthal', 'eye'],
    labelAr: 'طب العيون',
    labelEn: 'Ophthalmology',
    icon: 'eye',
    examFields: [
      { key: 'bcvaOD', labelAr: 'BCVA يمين', labelEn: 'BCVA OD', type: 'text', group: 'visual_acuity' },
      { key: 'bcvaOS', labelAr: 'BCVA يسار', labelEn: 'BCVA OS', type: 'text', group: 'visual_acuity' },
      { key: 'nearVisionOD', labelAr: 'قريب يمين', labelEn: 'Near OD', type: 'text', group: 'visual_acuity' },
      { key: 'nearVisionOS', labelAr: 'قريب يسار', labelEn: 'Near OS', type: 'text', group: 'visual_acuity' },
      { key: 'refractionOD', labelAr: 'انكسار يمين', labelEn: 'Refraction OD', type: 'text', group: 'refraction' },
      { key: 'refractionOS', labelAr: 'انكسار يسار', labelEn: 'Refraction OS', type: 'text', group: 'refraction' },
      { key: 'kReadingsOD', labelAr: 'K Readings يمين', labelEn: 'K Readings OD', type: 'text', group: 'refraction' },
      { key: 'kReadingsOS', labelAr: 'K Readings يسار', labelEn: 'K Readings OS', type: 'text', group: 'refraction' },
      { key: 'iopOD', labelAr: 'ضغط العين يمين', labelEn: 'IOP OD', type: 'number', unit: 'mmHg', group: 'iop' },
      { key: 'iopOS', labelAr: 'ضغط العين يسار', labelEn: 'IOP OS', type: 'number', unit: 'mmHg', group: 'iop' },
      { key: 'pd', labelAr: 'المسافة بين الحدقتين PD', labelEn: 'PD', type: 'text', group: 'extra' },
      { key: 'colorVision', labelAr: 'رؤية الألوان', labelEn: 'Color Vision', type: 'select', options: ['Normal', 'Deficient', 'Absent'], group: 'extra' },
      { key: 'coverTest', labelAr: 'اختبار التغطية', labelEn: 'Cover Test', type: 'select', options: ['Orthophoric', 'Esophoria', 'Exophoria', 'Esotropia', 'Exotropia'], group: 'extra' },
    ],
  },

  // ── 2. Cardiology ───────────────────────────────────────────────────────────
  {
    codes: ['cardiology', 'cardiac', 'heart', 'قلب'],
    labelAr: 'أمراض القلب',
    labelEn: 'Cardiology',
    icon: 'heart',
    examFields: [
      { key: 'heartSounds', labelAr: 'أصوات القلب', labelEn: 'Heart Sounds', type: 'select', options: ['S1S2 Normal', 'S3 Gallop', 'S4 Gallop', 'Murmur', 'Muffled'], group: 'cardiac' },
      { key: 'murmurGrade', labelAr: 'درجة النفخة', labelEn: 'Murmur Grade', type: 'select', options: ['None', '1/6', '2/6', '3/6', '4/6', '5/6', '6/6'], group: 'cardiac' },
      { key: 'rhythm', labelAr: 'إيقاع القلب', labelEn: 'Rhythm', type: 'select', options: ['Normal Sinus Rhythm', 'AF', 'Atrial Flutter', 'Bradycardia', 'Tachycardia', 'Heart Block', 'VT', 'PVCs'], group: 'cardiac' },
      { key: 'ejectionFraction', labelAr: 'كسر القذف EF%', labelEn: 'Ejection Fraction %', type: 'number', min: 10, max: 80, unit: '%', group: 'echo' },
      { key: 'jvp', labelAr: 'الضغط الوريدي JVP', labelEn: 'JVP', type: 'select', options: ['Normal', 'Elevated', 'Markedly elevated'], group: 'vascular' },
      { key: 'peripheralPulses', labelAr: 'النبضات الطرفية', labelEn: 'Peripheral Pulses', type: 'select', options: ['Normal', 'Diminished', 'Absent', 'Bounding'], group: 'vascular' },
      { key: 'edema', labelAr: 'الوذمة', labelEn: 'Pedal Edema', type: 'select', options: ['None', '+1 Pitting', '+2 Pitting', '+3 Pitting', '+4 Pitting'], group: 'vascular' },
      { key: 'ecgFindings', labelAr: 'نتائج تخطيط القلب', labelEn: 'ECG Findings', type: 'textarea', group: 'investigations' },
      { key: 'echoFindings', labelAr: 'نتائج الإيكو', labelEn: 'Echo Findings', type: 'textarea', group: 'investigations' },
    ],
    scoringTools: [
      { id: 'chadsvasc', labelAr: 'CHA₂DS₂-VASc (AF Risk)', labelEn: 'CHA₂DS₂-VASc Score' },
      { id: 'grace', labelAr: 'GRACE Score (ACS)', labelEn: 'GRACE Score' },
    ],
    soapHints: {
      physicalExamAr: 'القلب: منتظم الضربات، ولا توجد نفخات.\nالأوعية: النبض الطرفي طبيعي، لا وذمة.',
      physicalExamEn: 'CVS: Regular rate and rhythm, no murmurs.\nPeripheral: Pulses intact, no pedal edema.',
    },
  },

  // ── 3. Pediatrics ───────────────────────────────────────────────────────────
  {
    codes: ['pediatric', 'paediatric', 'child', 'أطفال', 'peds'],
    labelAr: 'طب الأطفال',
    labelEn: 'Pediatrics',
    icon: 'baby',
    examFields: [
      { key: 'weight', labelAr: 'الوزن', labelEn: 'Weight', type: 'number', unit: 'kg', step: 0.1, group: 'anthropometry' },
      { key: 'height', labelAr: 'الطول', labelEn: 'Height', type: 'number', unit: 'cm', group: 'anthropometry' },
      { key: 'headCircumference', labelAr: 'محيط الرأس', labelEn: 'Head Circumference', type: 'number', unit: 'cm', group: 'anthropometry' },
      { key: 'developmentalMilestones', labelAr: 'مراحل التطور', labelEn: 'Developmental Milestones', type: 'select', options: ['Age Appropriate', 'Delayed', 'Advanced'], group: 'development' },
      { key: 'fontanelle', labelAr: 'اليافوخ', labelEn: 'Fontanelle', type: 'select', options: ['Closed', 'Open-Normal', 'Bulging', 'Sunken'], group: 'head' },
      { key: 'vaccination', labelAr: 'حالة التطعيم', labelEn: 'Vaccination Status', type: 'select', options: ['Up to date', 'Incomplete', 'Unknown', 'Refused'], group: 'immunization' },
      { key: 'feedingType', labelAr: 'نوع التغذية', labelEn: 'Feeding Type', type: 'select', options: ['Breastfeeding', 'Formula', 'Mixed', 'Solid foods', 'N/A'], group: 'nutrition' },
      { key: 'apgarScore', labelAr: 'نقاط APGAR (للمواليد)', labelEn: 'APGAR Score', type: 'number', min: 0, max: 10, group: 'newborn' },
      { key: 'gestationalAge', labelAr: 'عمر الحمل', labelEn: 'Gestational Age', type: 'number', unit: 'weeks', group: 'newborn' },
    ],
    scoringTools: [
      { id: 'pews', labelAr: 'PEWS (Early Warning)', labelEn: 'Pediatric Early Warning Score' },
      { id: 'wellsChild', labelAr: 'Wells Pediatric', labelEn: 'Wells Child Score' },
    ],
    soapHints: {
      physicalExamAr: 'الطفل نشيط ومتفاعل مع المحيط. الوجه طبيعي، لا علامات ضيق.\nالرأس والعنق: طبيعي. الصدر: هواء دخول جيد طرفي.',
      physicalExamEn: 'Child active and interactive. No dysmorphic features, no distress.\nH&N: Normal. Chest: Good air entry bilaterally.',
    },
  },

  // ── 4. Internal Medicine ─────────────────────────────────────────────────
  {
    codes: ['internal', 'medicine', 'general', 'باطنية', 'im'],
    labelAr: 'الطب الباطني',
    labelEn: 'Internal Medicine',
    icon: 'stethoscope',
    examFields: [
      { key: 'generalAppearance', labelAr: 'المظهر العام', labelEn: 'General Appearance', type: 'select', options: ['Well', 'Unwell', 'Acutely ill', 'Chronically ill', 'Cachexic'], group: 'general' },
      { key: 'pallor', labelAr: 'الشحوب', labelEn: 'Pallor', type: 'select', options: ['None', 'Mild', 'Moderate', 'Severe'], group: 'general' },
      { key: 'jaundice', labelAr: 'الصفار', labelEn: 'Jaundice', type: 'select', options: ['None', 'Mild', 'Moderate', 'Severe'], group: 'general' },
      { key: 'cyanosis', labelAr: 'الزرقة', labelEn: 'Cyanosis', type: 'select', options: ['None', 'Peripheral', 'Central'], group: 'general' },
      { key: 'lymphNodes', labelAr: 'الغدد الليمفاوية', labelEn: 'Lymph Nodes', type: 'select', options: ['Not palpable', 'Cervical', 'Axillary', 'Inguinal', 'Generalized'], group: 'general' },
      { key: 'liverSize', labelAr: 'حجم الكبد', labelEn: 'Liver Size', type: 'select', options: ['Normal', 'Enlarged (hepatomegaly)', 'Tender', 'Not palpable'], group: 'abdomen' },
      { key: 'spleenSize', labelAr: 'حجم الطحال', labelEn: 'Spleen Size', type: 'select', options: ['Not palpable', 'Mild splenomegaly', 'Moderate splenomegaly', 'Massive splenomegaly'], group: 'abdomen' },
      { key: 'ascites', labelAr: 'الاستسقاء', labelEn: 'Ascites', type: 'select', options: ['None', 'Mild', 'Moderate', 'Massive'], group: 'abdomen' },
      { key: 'chestAuscultation', labelAr: 'تسمع الصدر', labelEn: 'Chest Auscultation', type: 'select', options: ['Clear', 'Crackles', 'Wheeze', 'Pleural rub', 'Reduced air entry'], group: 'chest' },
      { key: 'diabetesControl', labelAr: 'التحكم بالسكري', labelEn: 'Diabetes Control', type: 'select', options: ['Well controlled', 'Suboptimal', 'Poorly controlled', 'N/A'], group: 'chronic' },
      { key: 'hbp', labelAr: 'ضبط ضغط الدم', labelEn: 'BP Control', type: 'select', options: ['Well controlled', 'Suboptimal', 'Uncontrolled', 'N/A'], group: 'chronic' },
    ],
    soapHints: {
      physicalExamAr: 'المريض متعاون، واعٍ ومتيقظ. لا اصفرار، لا شحوب.\nالصدر: هواء دخول جيد، لا صفير.\nالبطن: لين، لا تضخم أحشاء.',
      physicalExamEn: 'Patient cooperative, alert and oriented. No jaundice, no pallor.\nChest: Clear, good air entry bilaterally.\nAbdomen: Soft, non-tender, no organomegaly.',
    },
  },

  // ── 5. Orthopedics ───────────────────────────────────────────────────────
  {
    codes: ['orthop', 'orthopaedic', 'bone', 'عظام', 'trauma'],
    labelAr: 'جراحة العظام',
    labelEn: 'Orthopedics',
    icon: 'bone',
    examFields: [
      { key: 'affectedSite', labelAr: 'موضع الإصابة', labelEn: 'Affected Site', type: 'select', options: ['Cervical Spine', 'Lumbar Spine', 'Shoulder', 'Elbow', 'Wrist', 'Hand', 'Hip', 'Knee', 'Ankle', 'Foot', 'Multiple'], group: 'site' },
      { key: 'painScore', labelAr: 'شدة الألم (0-10)', labelEn: 'Pain Score (0-10)', type: 'scale', min: 0, max: 10, group: 'pain' },
      { key: 'swelling', labelAr: 'الانتفاخ', labelEn: 'Swelling', type: 'select', options: ['None', 'Mild', 'Moderate', 'Severe'], group: 'physical' },
      { key: 'deformity', labelAr: 'التشوه', labelEn: 'Deformity', type: 'select', options: ['None', 'Mild', 'Moderate', 'Severe angular', 'Rotational'], group: 'physical' },
      { key: 'romFlexion', labelAr: 'نطاق الحركة - ثني', labelEn: 'ROM Flexion', type: 'number', unit: '°', group: 'rom' },
      { key: 'romExtension', labelAr: 'نطاق الحركة - بسط', labelEn: 'ROM Extension', type: 'number', unit: '°', group: 'rom' },
      { key: 'neurovascular', labelAr: 'الحالة الوعائية العصبية', labelEn: 'Neurovascular Status', type: 'select', options: ['Intact', 'Compromised - Vascular', 'Compromised - Neurological', 'Both compromised'], group: 'neuro' },
      { key: 'fractureType', labelAr: 'نوع الكسر', labelEn: 'Fracture Type', type: 'select', options: ['None', 'Closed simple', 'Closed comminuted', 'Open Grade I', 'Open Grade II', 'Open Grade III', 'Pathological'], group: 'fracture' },
      { key: 'xrayFindings', labelAr: 'نتائج الأشعة', labelEn: 'X-Ray Findings', type: 'textarea', group: 'investigations' },
    ],
    scoringTools: [
      { id: 'vasScale', labelAr: 'VAS (ألم)', labelEn: 'Visual Analogue Scale (Pain)' },
      { id: 'koos', labelAr: 'KOOS (الركبة)', labelEn: 'KOOS Knee Score' },
    ],
  },

  // ── 6. ENT ───────────────────────────────────────────────────────────────
  {
    codes: ['ent', 'otorhinolaryngology', 'ear', 'nose', 'throat', 'أنف', 'ent'],
    labelAr: 'الأنف والأذن والحنجرة',
    labelEn: 'ENT',
    icon: 'ear',
    examFields: [
      { key: 'earOD', labelAr: 'الأذن اليمنى', labelEn: 'Right Ear', type: 'select', options: ['Normal', 'TM perforation', 'Otitis media', 'Wax impaction', 'Effusion', 'Cholesteatoma'], group: 'ear' },
      { key: 'earOS', labelAr: 'الأذن اليسرى', labelEn: 'Left Ear', type: 'select', options: ['Normal', 'TM perforation', 'Otitis media', 'Wax impaction', 'Effusion', 'Cholesteatoma'], group: 'ear' },
      { key: 'rinneRight', labelAr: 'Rinne يمين', labelEn: 'Rinne Right', type: 'select', options: ['Positive (AC>BC)', 'Negative (BC>AC)', 'N/A'], group: 'hearing' },
      { key: 'rinneLeft', labelAr: 'Rinne يسار', labelEn: 'Rinne Left', type: 'select', options: ['Positive (AC>BC)', 'Negative (BC>AC)', 'N/A'], group: 'hearing' },
      { key: 'weber', labelAr: 'Weber', labelEn: 'Weber', type: 'select', options: ['Central', 'Lateralizes right', 'Lateralizes left', 'N/A'], group: 'hearing' },
      { key: 'nasalMucosa', labelAr: 'الغشاء المخاطي الأنفي', labelEn: 'Nasal Mucosa', type: 'select', options: ['Normal', 'Congested', 'Pale', 'Hypertrophied', 'Atrophic'], group: 'nose' },
      { key: 'septum', labelAr: 'الحاجز الأنفي', labelEn: 'Nasal Septum', type: 'select', options: ['Midline', 'Deviated right', 'Deviated left', 'Perforated'], group: 'nose' },
      { key: 'tonsils', labelAr: 'اللوزتان', labelEn: 'Tonsils', type: 'select', options: ['T0 (absent)', 'T1', 'T2', 'T3', 'T4 (kissing)', 'Erythematous', 'Exudate'], group: 'throat' },
      { key: 'vocalCords', labelAr: 'الحبال الصوتية', labelEn: 'Vocal Cords', type: 'select', options: ['Not assessed', 'Normal', 'Erythematous', 'Vocal nodule', 'Polyp', 'Paralysis'], group: 'larynx' },
    ],
    scoringTools: [
      { id: 'tonsillitis', labelAr: 'Centor Score (التهاب اللوزتين)', labelEn: 'Centor Score' },
    ],
  },

  // ── 7. Dermatology ───────────────────────────────────────────────────────
  {
    codes: ['dermatology', 'skin', 'جلدية', 'derm'],
    labelAr: 'الجلدية',
    labelEn: 'Dermatology',
    icon: 'flask-conical',
    examFields: [
      { key: 'lesionType', labelAr: 'نوع الآفة', labelEn: 'Lesion Type', type: 'select', options: ['Macule', 'Patch', 'Papule', 'Plaque', 'Nodule', 'Vesicle', 'Bulla', 'Pustule', 'Ulcer', 'Wheal', 'Cyst', 'Scale', 'Crust', 'Erosion', 'Excoriation'], group: 'primary' },
      { key: 'lesionColor', labelAr: 'لون الآفة', labelEn: 'Color', type: 'select', options: ['Erythematous', 'Hyperpigmented', 'Hypopigmented', 'Depigmented', 'Violaceous', 'Yellow', 'Brown', 'Black'], group: 'primary' },
      { key: 'lesionSize', labelAr: 'حجم الآفة', labelEn: 'Size', type: 'text', hint: 'e.g. 2x3 cm', group: 'primary' },
      { key: 'lesionBorder', labelAr: 'حدود الآفة', labelEn: 'Border', type: 'select', options: ['Well-defined', 'Ill-defined', 'Regular', 'Irregular'], group: 'primary' },
      { key: 'lesionDistribution', labelAr: 'توزيع الآفة', labelEn: 'Distribution', type: 'select', options: ['Localized', 'Regional', 'Generalized', 'Symmetric', 'Dermatomal', 'Flexural', 'Extensor'], group: 'distribution' },
      { key: 'affectedArea', labelAr: 'المنطقة المصابة', labelEn: 'Affected Area', type: 'multiselect', options: ['Face', 'Scalp', 'Neck', 'Chest', 'Back', 'Arms', 'Hands', 'Abdomen', 'Groin', 'Legs', 'Feet', 'Nails', 'Mucosa'], group: 'distribution' },
      { key: 'pruritus', labelAr: 'الحكة', labelEn: 'Pruritus', type: 'select', options: ['None', 'Mild', 'Moderate', 'Severe', 'Nocturnal'], group: 'symptoms' },
      { key: 'nailChanges', labelAr: 'تغيرات الأظافر', labelEn: 'Nail Changes', type: 'select', options: ['None', 'Pitting', 'Onycholysis', 'Thickening', 'Discoloration'], group: 'nails' },
    ],
    soapHints: {
      physicalExamAr: 'فحص الجلد: آفة جلدية محددة الحواف، ذات لون ...\nلا توجد آفات أخرى. الأظافر والشعر طبيعيان.',
      physicalExamEn: 'Skin exam: Well-defined erythematous plaque on ...\nNo satellite lesions. Nails and hair normal.',
    },
  },

  // ── 8. Psychiatry / Mental Health ────────────────────────────────────────
  {
    codes: ['psychiatry', 'mental', 'psychology', 'نفسية', 'psych'],
    labelAr: 'الطب النفسي',
    labelEn: 'Psychiatry',
    icon: 'brain',
    examFields: [
      { key: 'appearance', labelAr: 'المظهر', labelEn: 'Appearance', type: 'select', options: ['Well-groomed', 'Disheveled', 'Bizarre', 'Unkempt'], group: 'mse' },
      { key: 'behavior', labelAr: 'السلوك', labelEn: 'Behavior', type: 'select', options: ['Cooperative', 'Agitated', 'Aggressive', 'Withdrawn', 'Psychomotor agitation', 'Psychomotor retardation'], group: 'mse' },
      { key: 'speech', labelAr: 'الكلام', labelEn: 'Speech', type: 'select', options: ['Normal rate and volume', 'Pressured', 'Slow', 'Slurred', 'Mute', 'Incoherent'], group: 'mse' },
      { key: 'mood', labelAr: 'المزاج', labelEn: 'Mood (patient reports)', type: 'select', options: ['Euthymic', 'Depressed', 'Elevated', 'Irritable', 'Anxious', 'Labile'], group: 'mse' },
      { key: 'affect', labelAr: 'الوجدان', labelEn: 'Affect', type: 'select', options: ['Appropriate', 'Flat', 'Blunted', 'Restricted', 'Expansive', 'Incongruent'], group: 'mse' },
      { key: 'thoughtProcess', labelAr: 'عملية التفكير', labelEn: 'Thought Process', type: 'select', options: ['Logical', 'Flight of ideas', 'Circumstantial', 'Tangential', 'Loose associations', 'Thought blocking'], group: 'thought' },
      { key: 'thoughtContent', labelAr: 'محتوى التفكير', labelEn: 'Thought Content', type: 'multiselect', options: ['No abnormality', 'Suicidal ideation', 'Homicidal ideation', 'Delusions', 'Obsessions', 'Phobias'], group: 'thought' },
      { key: 'perception', labelAr: 'الإدراك', labelEn: 'Perceptions', type: 'select', options: ['No hallucinations', 'Auditory hallucinations', 'Visual hallucinations', 'Tactile hallucinations', 'Olfactory'], group: 'perception' },
      { key: 'orientation', labelAr: 'التوجه', labelEn: 'Orientation', type: 'select', options: ['Fully oriented (x3)', 'Disoriented to time', 'Disoriented to place', 'Disoriented to person'], group: 'cognition' },
      { key: 'insight', labelAr: 'البصيرة', labelEn: 'Insight', type: 'select', options: ['Full', 'Partial', 'None'], group: 'cognition' },
      { key: 'judgment', labelAr: 'الحكم', labelEn: 'Judgment', type: 'select', options: ['Intact', 'Impaired', 'Poor'], group: 'cognition' },
      { key: 'riskAssessment', labelAr: 'تقييم الخطورة', labelEn: 'Risk Assessment', type: 'select', options: ['Low risk', 'Moderate risk - monitor', 'High risk - requires intervention'], group: 'risk' },
    ],
    scoringTools: [
      { id: 'phq9', labelAr: 'PHQ-9 (الاكتئاب)', labelEn: 'PHQ-9 Depression Scale' },
      { id: 'gad7', labelAr: 'GAD-7 (القلق)', labelEn: 'GAD-7 Anxiety Scale' },
      { id: 'moca', labelAr: 'MoCA (الإدراك)', labelEn: 'Montreal Cognitive Assessment' },
    ],
  },

  // ── 9. Gynecology & Obstetrics ──────────────────────────────────────────
  {
    codes: ['gynecology', 'gynaecology', 'obgyn', 'obstetric', 'نساء', 'توليد'],
    labelAr: 'النساء والتوليد',
    labelEn: 'Gynecology & Obstetrics',
    icon: 'flower-2',
    scoringTools: [
      { id: 'meows', labelAr: 'MEOWS (تنبيه مبكر توليدي)', labelEn: 'MEOWS Obstetric EWS' },
      { id: 'bishop', labelAr: 'بيشوب (استعداد عنق الرحم)', labelEn: 'Bishop Score (Cervical)' },
    ],
    examFields: [
      { key: 'lmp', labelAr: 'آخر دورة شهرية LMP', labelEn: 'LMP', type: 'date', group: 'menstrual' },
      { key: 'cycleRegularity', labelAr: 'انتظام الدورة', labelEn: 'Cycle Regularity', type: 'select', options: ['Regular', 'Irregular', 'Oligomenorrhea', 'Amenorrhea', 'Polymenorrhea', 'Post-menopausal'], group: 'menstrual' },
      { key: 'gravida', labelAr: 'G (عدد الحمل)', labelEn: 'Gravida (G)', type: 'number', min: 0, max: 20, group: 'obstetric_history' },
      { key: 'para', labelAr: 'P (عدد الولادات)', labelEn: 'Para (P)', type: 'number', min: 0, max: 20, group: 'obstetric_history' },
      { key: 'abortus', labelAr: 'A (الإجهاض)', labelEn: 'Abortus (A)', type: 'number', min: 0, max: 20, group: 'obstetric_history' },
      { key: 'living', labelAr: 'L (الأحياء)', labelEn: 'Living (L)', type: 'number', min: 0, max: 20, group: 'obstetric_history' },
      { key: 'edd', labelAr: 'تاريخ الولادة المتوقع EDD', labelEn: 'EDD', type: 'date', group: 'current_pregnancy' },
      { key: 'gestationalWeeks', labelAr: 'أسابيع الحمل', labelEn: 'Gestational Weeks', type: 'number', unit: 'weeks', group: 'current_pregnancy' },
      { key: 'uterusSize', labelAr: 'حجم الرحم', labelEn: 'Uterus Size', type: 'select', options: ['Not pregnant size', 'Weeks size', 'Enlarged (fibroid)', 'Retroverted', 'N/A'], group: 'gynae_exam' },
      { key: 'cervix', labelAr: 'عنق الرحم', labelEn: 'Cervix', type: 'select', options: ['Normal', 'Erosion', 'Polyp', 'Discharge', 'Not assessed'], group: 'gynae_exam' },
      { key: 'vaginalDischarge', labelAr: 'الإفرازات', labelEn: 'Vaginal Discharge', type: 'select', options: ['None', 'Clear/White (normal)', 'Yellowish', 'Greenish', 'Bloodstained', 'Foul-smelling'], group: 'gynae_exam' },
      { key: 'fetalHeartRate', labelAr: 'نبض الجنين', labelEn: 'Fetal Heart Rate', type: 'number', unit: 'bpm', group: 'fetal' },
      { key: 'fetalPresentation', labelAr: 'وضع الجنين', labelEn: 'Fetal Presentation', type: 'select', options: ['Cephalic', 'Breech', 'Transverse', 'N/A'], group: 'fetal' },
    ],
  },

  // ── 10. General Surgery ──────────────────────────────────────────────────
  {
    codes: ['surgery', 'surgical', 'جراحة', 'general surgery'],
    labelAr: 'الجراحة العامة',
    labelEn: 'General Surgery',
    icon: 'scissors',
    examFields: [
      { key: 'surgicalSite', labelAr: 'موضع الجراحة', labelEn: 'Surgical Site', type: 'select', options: ['Abdomen', 'Chest', 'Neck', 'Head', 'Breast', 'Groin', 'Limb', 'Back', 'N/A'], group: 'site' },
      { key: 'woundStatus', labelAr: 'حالة الجرح', labelEn: 'Wound Status', type: 'select', options: ['Intact', 'Healing well', 'Dehiscence', 'Infected', 'Seroma', 'Hematoma', 'N/A'], group: 'wound' },
      { key: 'woundClassification', labelAr: 'تصنيف الجرح', labelEn: 'Wound Classification', type: 'select', options: ['Clean', 'Clean-contaminated', 'Contaminated', 'Dirty/infected'], group: 'wound' },
      { key: 'drains', labelAr: 'المصارف', labelEn: 'Drains', type: 'select', options: ['None', 'Present - functioning', 'Present - blocked', 'Removed'], group: 'drains' },
      { key: 'drainOutput', labelAr: 'إنتاج المصرف', labelEn: 'Drain Output', type: 'text', hint: 'e.g. 50ml sero-sanguinous', group: 'drains' },
      { key: 'bowelSounds', labelAr: 'أصوات الأمعاء', labelEn: 'Bowel Sounds', type: 'select', options: ['Normal', 'Hyperactive', 'Hypoactive', 'Absent'], group: 'abdomen' },
      { key: 'herniaType', labelAr: 'نوع الفتق', labelEn: 'Hernia Type', type: 'select', options: ['N/A', 'Inguinal', 'Umbilical', 'Incisional', 'Femoral', 'Epigastric'], group: 'hernia' },
      { key: 'asaGrade', labelAr: 'درجة ASA', labelEn: 'ASA Grade', type: 'select', options: ['ASA I', 'ASA II', 'ASA III', 'ASA IV', 'ASA V'], group: 'surgical_risk' },
    ],
    scoringTools: [
      { id: 'possum', labelAr: 'P-POSSUM (خطر الجراحة)', labelEn: 'P-POSSUM Surgical Risk' },
    ],
  },

  // ── 11. Neurology ────────────────────────────────────────────────────────
  {
    codes: ['neurology', 'neuro', 'neurological', 'أعصاب'],
    labelAr: 'الجهاز العصبي',
    labelEn: 'Neurology',
    icon: 'brain',
    examFields: [
      { key: 'gcs', labelAr: 'مقياس غلاسكو GCS', labelEn: 'Glasgow Coma Scale', type: 'number', min: 3, max: 15, group: 'consciousness' },
      { key: 'orientation', labelAr: 'التوجه', labelEn: 'Orientation', type: 'select', options: ['Fully oriented', 'Disoriented to time', 'Disoriented to place', 'Disoriented to person', 'Confused'], group: 'consciousness' },
      { key: 'cranialNerves', labelAr: 'الأعصاب القحفية', labelEn: 'Cranial Nerves', type: 'select', options: ['Intact', 'CN II affected', 'CN III/IV/VI affected', 'CN V affected', 'CN VII affected', 'CN VIII affected', 'Multiple affected'], group: 'cranial' },
      { key: 'motorStrength', labelAr: 'قوة الحركة', labelEn: 'Motor Strength', type: 'select', options: ['5/5 Normal', '4/5 Reduced', '3/5 Against gravity', '2/5 With gravity', '1/5 Flicker', '0/5 None', 'Asymmetric'], group: 'motor' },
      { key: 'reflexes', labelAr: 'ردود الفعل', labelEn: 'Deep Tendon Reflexes', type: 'select', options: ['Normal (2+)', 'Hyperreflexia (3+/4+)', 'Hyporeflexia (1+)', 'Areflexia (0)', 'Asymmetric'], group: 'reflex' },
      { key: 'plantarResponse', labelAr: 'استجابة أخمص القدم', labelEn: 'Plantar Response', type: 'select', options: ['Flexor (normal)', 'Extensor (Babinski+)', 'Equivocal'], group: 'reflex' },
      { key: 'sensory', labelAr: 'الحس', labelEn: 'Sensory', type: 'select', options: ['Intact', 'Reduced', 'Lost', 'Paresthesia', 'Dermatomal pattern'], group: 'sensory' },
      { key: 'gait', labelAr: 'المشية', labelEn: 'Gait', type: 'select', options: ['Normal', 'Ataxic', 'Spastic', 'Steppage', 'Antalgic', 'Unable to assess'], group: 'cerebellar' },
      { key: 'meningism', labelAr: 'علامات السحايا', labelEn: 'Meningism', type: 'select', options: ['Absent', 'Neck stiffness', 'Kernig positive', 'Brudzinski positive'], group: 'meningeal' },
    ],
    scoringTools: [
      { id: 'nihss', labelAr: 'NIHSS (السكتة الدماغية)', labelEn: 'NIH Stroke Scale' },
      { id: 'gcs', labelAr: 'GCS (الوعي)', labelEn: 'Glasgow Coma Scale' },
      { id: 'mmse', labelAr: 'MMSE (الذاكرة)', labelEn: 'Mini-Mental State Exam' },
    ],
  },

  // ── 12. Pulmonology / Respiratory ────────────────────────────────────────
  {
    codes: ['pulmonology', 'respiratory', 'chest', 'صدرية', 'تنفسية'],
    labelAr: 'الصدر والجهاز التنفسي',
    labelEn: 'Pulmonology',
    icon: 'wind',
    examFields: [
      { key: 'breathingSounds', labelAr: 'أصوات التنفس', labelEn: 'Breath Sounds', type: 'select', options: ['Clear bilaterally', 'Crackles right', 'Crackles left', 'Crackles bilateral', 'Wheezes', 'Rhonchi', 'Pleural rub', 'Absent right', 'Absent left'], group: 'auscultation' },
      { key: 'peakFlow', labelAr: 'ذروة الجريان', labelEn: 'Peak Flow', type: 'number', unit: 'L/min', group: 'spirometry' },
      { key: 'fev1', labelAr: 'FEV1%', labelEn: 'FEV1%', type: 'number', unit: '%', min: 0, max: 130, group: 'spirometry' },
      { key: 'oxygenRequirement', labelAr: 'متطلب الأكسجين', labelEn: 'Oxygen Requirement', type: 'select', options: ['None (room air)', '1-2L nasal cannula', '3-5L mask', 'High-flow', 'NIV', 'Intubated'], group: 'oxygen' },
      { key: 'dyspneaScale', labelAr: 'درجة ضيق التنفس mMRC', labelEn: 'mMRC Dyspnea Scale', type: 'select', options: ['0 - Only strenuous', '1 - Hurrying/incline', '2 - Walking level', '3 - 100m on level', '4 - Too breathless to leave house'], group: 'functional' },
      { key: 'clubbing', labelAr: 'تطبيل الأصابع', labelEn: 'Clubbing', type: 'select', options: ['Absent', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4'], group: 'signs' },
      { key: 'cyanosis', labelAr: 'الزرقة', labelEn: 'Cyanosis', type: 'select', options: ['None', 'Peripheral', 'Central'], group: 'signs' },
    ],
    scoringTools: [
      { id: 'cat', labelAr: 'CAT (COPD)', labelEn: 'COPD Assessment Test' },
      { id: 'wells_pe', labelAr: 'Wells (PE)', labelEn: 'Wells Score for PE' },
    ],
  },

  // ── 13. Urology ──────────────────────────────────────────────────────────
  {
    codes: ['urology', 'urological', 'بولية', 'مسالك'],
    labelAr: 'المسالك البولية',
    labelEn: 'Urology',
    icon: 'scan',
    examFields: [
      { key: 'ipssScore', labelAr: 'مقياس IPSS (البروستاتا)', labelEn: 'IPSS Score', type: 'number', min: 0, max: 35, group: 'prostate' },
      { key: 'prostateSize', labelAr: 'حجم البروستاتا', labelEn: 'Prostate Size', type: 'select', options: ['Not assessed', 'Normal', 'Mildly enlarged', 'Moderately enlarged', 'Grossly enlarged', 'Hard/irregular'], group: 'prostate' },
      { key: 'kidneyTenderness', labelAr: 'ألم الكلى', labelEn: 'Renal Angle Tenderness', type: 'select', options: ['Bilateral absent', 'Right CVA tenderness', 'Left CVA tenderness', 'Bilateral present'], group: 'renal' },
      { key: 'hematuria', labelAr: 'الدم في البول', labelEn: 'Hematuria', type: 'select', options: ['None', 'Microscopic', 'Gross (initial)', 'Gross (total)', 'Gross (terminal)'], group: 'urine' },
      { key: 'urinarySymptoms', labelAr: 'الأعراض البولية', labelEn: 'Urinary Symptoms', type: 'multiselect', options: ['Frequency', 'Urgency', 'Dysuria', 'Nocturia', 'Retention', 'Incontinence', 'Weak stream', 'Hesitancy'], group: 'symptoms' },
      { key: 'scrotalExam', labelAr: 'فحص الصفن', labelEn: 'Scrotal Exam', type: 'select', options: ['N/A', 'Normal', 'Hydrocele', 'Varicocele', 'Mass', 'Tender (orchitis)', 'Epididymitis'], group: 'male' },
    ],
    scoringTools: [
      { id: 'ipss', labelAr: 'IPSS (أعراض البروستاتا)', labelEn: 'International Prostate Symptom Score' },
    ],
  },

  // ── 14. Endocrinology / Diabetes ─────────────────────────────────────────
  {
    codes: ['endocrinology', 'diabetes', 'thyroid', 'غدد', 'سكري'],
    labelAr: 'الغدد الصماء والسكري',
    labelEn: 'Endocrinology',
    icon: 'flask-conical',
    examFields: [
      { key: 'thyroidSize', labelAr: 'حجم الغدة الدرقية', labelEn: 'Thyroid Size', type: 'select', options: ['Normal', 'Goitre Grade 1', 'Goitre Grade 2', 'Goitre Grade 3', 'Nodule present', 'Not palpable'], group: 'thyroid' },
      { key: 'thyroidTenderness', labelAr: 'ألم الغدة الدرقية', labelEn: 'Thyroid Tenderness', type: 'select', options: ['None', 'Tender', 'Very tender'], group: 'thyroid' },
      { key: 'hba1c', labelAr: 'HbA1c%', labelEn: 'HbA1c%', type: 'number', unit: '%', step: 0.1, min: 3, max: 20, group: 'diabetes' },
      { key: 'footExam', labelAr: 'فحص القدم السكرية', labelEn: 'Diabetic Foot Exam', type: 'select', options: ['Normal', 'Callus', 'Ulcer Grade 1', 'Ulcer Grade 2', 'Ulcer Grade 3', 'Gangrene', 'Amputation site'], group: 'complications' },
      { key: 'peripheralNeuropathy', labelAr: 'الاعتلال العصبي الطرفي', labelEn: 'Peripheral Neuropathy', type: 'select', options: ['Absent', 'Mild (reduced sensation)', 'Moderate', 'Severe', 'Painful neuropathy'], group: 'complications' },
      { key: 'retinopathy', labelAr: 'اعتلال الشبكية', labelEn: 'Retinopathy', type: 'select', options: ['None', 'Mild NPDR', 'Moderate NPDR', 'Severe NPDR', 'PDR', 'Not assessed'], group: 'complications' },
      { key: 'insulinTherapy', labelAr: 'العلاج بالأنسولين', labelEn: 'Insulin Therapy', type: 'select', options: ['None', 'Basal only', 'Basal-bolus', 'Premixed', 'Pump'], group: 'management' },
      { key: 'diabetesType', labelAr: 'نوع السكري', labelEn: 'Diabetes Type', type: 'select', options: ['Type 1', 'Type 2', 'MODY', 'Gestational', 'Secondary', 'Not diagnosed'], group: 'management' },
    ],
    scoringTools: [
      { id: 'diabetesRisk', labelAr: 'خطر السكري', labelEn: 'Diabetes Risk Score (FINDRISC)' },
    ],
  },

  // ── Dentistry ─────────────────────────────────────────────────────────────
  {
    codes: ['dental', 'dentistry', 'dentist', 'أسنان', 'dent'],
    labelAr: 'طب الأسنان',
    labelEn: 'Dentistry',
    icon: 'circle-dot',
    examFields: [
      { key: 'gingivitis', labelAr: 'التهاب اللثة', labelEn: 'Gingivitis', type: 'select', options: ['None', 'Mild', 'Moderate', 'Severe'], optionsAr: ['لا يوجد', 'خفيف', 'متوسط', 'شديد'], group: 'periodontal' },
      { key: 'periodontitis', labelAr: 'التهاب المحيط بالسن', labelEn: 'Periodontitis', type: 'select', options: ['None', 'Mild', 'Moderate', 'Severe'], optionsAr: ['لا يوجد', 'خفيف', 'متوسط', 'شديد'], group: 'periodontal' },
      { key: 'pocketDepth', labelAr: 'عمق الجيب (mm)', labelEn: 'Pocket Depth (mm)', type: 'number', min: 0, max: 12, unit: 'mm', group: 'periodontal' },
      { key: 'plaque', labelAr: 'الترسبات', labelEn: 'Plaque', type: 'select', options: ['None', 'Minimal', 'Moderate', 'Excessive'], optionsAr: ['لا يوجد', 'خفيف', 'متوسط', 'مفرط'], group: 'oral_hygiene' },
      { key: 'tartar', labelAr: 'الجير', labelEn: 'Tartar / Calculus', type: 'select', options: ['None', 'Minimal', 'Moderate', 'Excessive'], optionsAr: ['لا يوجد', 'خفيف', 'متوسط', 'مفرط'], group: 'oral_hygiene' },
      { key: 'oralHygieneIndex', labelAr: 'مستوى نظافة الفم', labelEn: 'Oral Hygiene Index', type: 'select', options: ['Good', 'Fair', 'Poor'], optionsAr: ['جيد', 'مقبول', 'سيء'], group: 'oral_hygiene' },
      { key: 'occlusionType', labelAr: 'نوع الإطباق', labelEn: 'Occlusion Type', type: 'select', options: ['Normal (Class I)', 'Class II Div 1', 'Class II Div 2', 'Class III', 'Open Bite', 'Crossbite'], group: 'occlusion' },
      { key: 'alignment', labelAr: 'تراص الأسنان', labelEn: 'Alignment', type: 'select', options: ['Normal', 'Mild crowding', 'Moderate crowding', 'Severe crowding', 'Spacing'], optionsAr: ['طبيعي', 'تراص خفيف', 'تراص متوسط', 'تراص شديد', 'فجوات'], group: 'occlusion' },
      { key: 'erosion', labelAr: 'تآكل المينا', labelEn: 'Enamel Erosion', type: 'select', options: ['None', 'Mild', 'Moderate', 'Severe'], optionsAr: ['لا يوجد', 'خفيف', 'متوسط', 'شديد'], group: 'enamel' },
      { key: 'fluorosis', labelAr: 'تفلور الأسنان', labelEn: 'Fluorosis', type: 'select', options: ['None', 'Questionable', 'Very Mild', 'Mild', 'Moderate', 'Severe'], group: 'enamel' },
      { key: 'tmjClick', labelAr: 'صوت المفصل الفكي', labelEn: 'TMJ Click', type: 'select', options: ['None', 'Unilateral', 'Bilateral'], optionsAr: ['لا يوجد', 'أحادي', 'ثنائي'], group: 'tmj' },
      { key: 'tmjPain', labelAr: 'ألم المفصل الفكي', labelEn: 'TMJ Pain', type: 'select', options: ['None', 'Mild', 'Moderate', 'Severe'], optionsAr: ['لا يوجد', 'خفيف', 'متوسط', 'شديد'], group: 'tmj' },
      { key: 'mouthOpening', labelAr: 'فتح الفم (mm)', labelEn: 'Mouth Opening (mm)', type: 'number', min: 0, max: 60, unit: 'mm', group: 'tmj' },
    ],
    soapHints: {
      chiefComplaintAr: 'المريض يشكو من ألم في الأسنان / تسوس / الرغبة في إجراء فحص دوري.',
      chiefComplaintEn: 'Patient presents with tooth pain / caries / routine dental check-up.',
      physicalExamAr: 'الأسنان: حضور جيد، لا تسوس ظاهر.\nاللثة: وردية، لا نزيف عند اللمس.\nالإطباق: طبيعي (Class I).\nالمفصل الفكي: بدون ألم أو صوت.',
      physicalExamEn: 'Teeth: Good dentition, no visible caries.\nGingiva: Pink, no bleeding on probing.\nOcclusion: Normal (Class I).\nTMJ: No pain or clicking.',
    },
  },
];

// =============================================================================
// Lookup helpers
// =============================================================================

export function getSpecialtyConfig(specialtyCode: string): SpecialtyConfig | null {
  if (!specialtyCode) return null;
  const lower = specialtyCode.toLowerCase();
  return SPECIALTY_CONFIGS.find(cfg =>
    cfg.codes.some(c => lower.includes(c) || c.includes(lower))
  ) ?? null;
}

export function getSpecialtyGroups(fields: SpecialtyField[]): string[] {
  const seen: Record<string, boolean> = {};
  const result: string[] = [];
  for (const f of fields) {
    const g = f.group ?? 'general';
    if (!seen[g]) { seen[g] = true; result.push(g); }
  }
  return result;
}

export const GROUP_LABELS: Record<string, { ar: string; en: string }> = {
  general: { ar: 'عام', en: 'General' },
  cardiac: { ar: 'القلب', en: 'Cardiac' },
  echo: { ar: 'الإيكو', en: 'Echocardiography' },
  vascular: { ar: 'الأوعية', en: 'Vascular' },
  investigations: { ar: 'الفحوصات', en: 'Investigations' },
  visual_acuity: { ar: 'حدة البصر', en: 'Visual Acuity' },
  refraction: { ar: 'الانكسار', en: 'Refraction' },
  iop: { ar: 'ضغط العين', en: 'IOP' },
  extra: { ar: 'إضافي', en: 'Additional' },
  anthropometry: { ar: 'القياسات', en: 'Anthropometry' },
  development: { ar: 'التطور', en: 'Development' },
  head: { ar: 'الرأس', en: 'Head' },
  immunization: { ar: 'التطعيم', en: 'Immunization' },
  nutrition: { ar: 'التغذية', en: 'Nutrition' },
  newborn: { ar: 'المولود', en: 'Newborn' },
  site: { ar: 'الموضع', en: 'Site' },
  pain: { ar: 'الألم', en: 'Pain' },
  physical: { ar: 'الفحص الفيزيائي', en: 'Physical Exam' },
  rom: { ar: 'نطاق الحركة', en: 'Range of Motion' },
  neuro: { ar: 'العصبي', en: 'Neurological' },
  fracture: { ar: 'الكسر', en: 'Fracture' },
  ear: { ar: 'الأذن', en: 'Ear' },
  hearing: { ar: 'السمع', en: 'Hearing Tests' },
  nose: { ar: 'الأنف', en: 'Nose' },
  throat: { ar: 'الحلق', en: 'Throat' },
  larynx: { ar: 'الحنجرة', en: 'Larynx' },
  primary: { ar: 'الآفة الأولية', en: 'Primary Lesion' },
  distribution: { ar: 'التوزيع', en: 'Distribution' },
  symptoms: { ar: 'الأعراض', en: 'Symptoms' },
  nails: { ar: 'الأظافر', en: 'Nails' },
  mse: { ar: 'الفحص النفسي', en: 'Mental Status Exam' },
  thought: { ar: 'التفكير', en: 'Thought' },
  perception: { ar: 'الإدراك', en: 'Perception' },
  cognition: { ar: 'المعرفة', en: 'Cognition' },
  risk: { ar: 'تقييم الخطورة', en: 'Risk Assessment' },
  menstrual: { ar: 'الدورة الشهرية', en: 'Menstrual' },
  obstetric_history: { ar: 'تاريخ الولادة G/P/A/L', en: 'Obstetric History' },
  current_pregnancy: { ar: 'الحمل الحالي', en: 'Current Pregnancy' },
  gynae_exam: { ar: 'الفحص النسائي', en: 'Gynaecological Exam' },
  fetal: { ar: 'الجنين', en: 'Fetal' },
  wound: { ar: 'الجرح', en: 'Wound' },
  drains: { ar: 'المصارف', en: 'Drains' },
  abdomen: { ar: 'البطن', en: 'Abdomen' },
  hernia: { ar: 'الفتق', en: 'Hernia' },
  surgical_risk: { ar: 'خطر الجراحة', en: 'Surgical Risk' },
  consciousness: { ar: 'الوعي', en: 'Consciousness' },
  cranial: { ar: 'الأعصاب القحفية', en: 'Cranial Nerves' },
  motor: { ar: 'الحركة', en: 'Motor' },
  reflex: { ar: 'ردود الفعل', en: 'Reflexes' },
  sensory: { ar: 'الحس', en: 'Sensory' },
  cerebellar: { ar: 'المخيخ', en: 'Cerebellar' },
  meningeal: { ar: 'السحايا', en: 'Meningeal' },
  auscultation: { ar: 'التسمع', en: 'Auscultation' },
  spirometry: { ar: 'قياس التنفس', en: 'Spirometry' },
  oxygen: { ar: 'الأكسجين', en: 'Oxygen' },
  functional: { ar: 'الوظيفي', en: 'Functional Status' },
  signs: { ar: 'العلامات', en: 'Clinical Signs' },
  prostate: { ar: 'البروستاتا', en: 'Prostate' },
  renal: { ar: 'الكلى', en: 'Renal' },
  urine: { ar: 'البول', en: 'Urine' },
  male: { ar: 'التناسلي', en: 'Genitourinary' },
  thyroid: { ar: 'الغدة الدرقية', en: 'Thyroid' },
  diabetes: { ar: 'السكري', en: 'Diabetes' },
  complications: { ar: 'المضاعفات', en: 'Complications' },
  management: { ar: 'العلاج', en: 'Management' },
  chest: { ar: 'الصدر', en: 'Chest' },
  chronic: { ar: 'الأمراض المزمنة', en: 'Chronic Conditions' },
  periodontal: { ar: 'حول السن', en: 'Periodontal' },
  oral_hygiene: { ar: 'صحة الفم', en: 'Oral Hygiene' },
  occlusion: { ar: 'الإطباق', en: 'Occlusion' },
  enamel: { ar: 'مينا الأسنان', en: 'Enamel' },
  tmj: { ar: 'المفصل الفكي', en: 'TMJ' },
};
