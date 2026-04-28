/**
 * CTCAE v5.0 — Common Terminology Criteria for Adverse Events
 *
 * Comprehensive toxicity grading definitions for oncology chemotherapy
 * monitoring. Includes the 12 most clinically significant System Organ
 * Classes (SOCs) with bilingual (AR/EN) support.
 *
 * Reference: NCI CTCAE v5.0 (November 2017)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CtcaeGradeDefinition {
  descEn: string;
  descAr: string;
}

export interface CtcaeAdverseEvent {
  term: string;
  termAr: string;
  category: string;
  categoryAr: string;
  grades: {
    1: CtcaeGradeDefinition;
    2: CtcaeGradeDefinition;
    3: CtcaeGradeDefinition;
    4: CtcaeGradeDefinition;
    5: CtcaeGradeDefinition;
  };
}

export interface CtcaeCategory {
  key: string;
  labelEn: string;
  labelAr: string;
}

export interface AttributionOption {
  value: string;
  labelEn: string;
  labelAr: string;
}

export interface ActionOption {
  value: string;
  labelEn: string;
  labelAr: string;
}

export interface ToxicityEntry {
  category: string;
  term: string;
  grade: number;
  attribution: string;
  onset: string | null;
  resolved: boolean;
  resolvedDate: string | null;
  action: string;
  notes: string;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const CTCAE_CATEGORIES: CtcaeCategory[] = [
  { key: 'BLOOD_LYMPHATIC', labelEn: 'Blood and Lymphatic System', labelAr: 'الدم والجهاز اللمفاوي' },
  { key: 'CARDIAC', labelEn: 'Cardiac Disorders', labelAr: 'اضطرابات القلب' },
  { key: 'GASTROINTESTINAL', labelEn: 'Gastrointestinal Disorders', labelAr: 'اضطرابات الجهاز الهضمي' },
  { key: 'GENERAL', labelEn: 'General Disorders', labelAr: 'اضطرابات عامة' },
  { key: 'HEPATOBILIARY', labelEn: 'Hepatobiliary Disorders', labelAr: 'اضطرابات الكبد والقنوات الصفراوية' },
  { key: 'INFECTIONS', labelEn: 'Infections and Infestations', labelAr: 'العدوى والإصابات' },
  { key: 'METABOLISM', labelEn: 'Metabolism and Nutrition', labelAr: 'الأيض والتغذية' },
  { key: 'MUSCULOSKELETAL', labelEn: 'Musculoskeletal Disorders', labelAr: 'اضطرابات العضلات والعظام' },
  { key: 'NERVOUS', labelEn: 'Nervous System Disorders', labelAr: 'اضطرابات الجهاز العصبي' },
  { key: 'RENAL', labelEn: 'Renal and Urinary Disorders', labelAr: 'اضطرابات الكلى والمسالك البولية' },
  { key: 'RESPIRATORY', labelEn: 'Respiratory Disorders', labelAr: 'اضطرابات الجهاز التنفسي' },
  { key: 'SKIN', labelEn: 'Skin and Subcutaneous Tissue', labelAr: 'الجلد والأنسجة تحت الجلدية' },
];

// ---------------------------------------------------------------------------
// Attribution Options
// ---------------------------------------------------------------------------

export const ATTRIBUTION_OPTIONS: AttributionOption[] = [
  { value: 'DEFINITE', labelEn: 'Definite', labelAr: 'مؤكد' },
  { value: 'PROBABLE', labelEn: 'Probable', labelAr: 'محتمل جداً' },
  { value: 'POSSIBLE', labelEn: 'Possible', labelAr: 'محتمل' },
  { value: 'UNLIKELY', labelEn: 'Unlikely', labelAr: 'غير محتمل' },
  { value: 'UNRELATED', labelEn: 'Unrelated', labelAr: 'غير مرتبط' },
];

// ---------------------------------------------------------------------------
// Action Options
// ---------------------------------------------------------------------------

export const ACTION_OPTIONS: ActionOption[] = [
  { value: 'NONE', labelEn: 'No action taken', labelAr: 'لم يتم اتخاذ إجراء' },
  { value: 'DOSE_REDUCED', labelEn: 'Dose reduced', labelAr: 'تقليل الجرعة' },
  { value: 'DOSE_DELAYED', labelEn: 'Dose delayed', labelAr: 'تأجيل الجرعة' },
  { value: 'TREATMENT_HELD', labelEn: 'Treatment held', labelAr: 'تعليق العلاج' },
  { value: 'DISCONTINUED', labelEn: 'Treatment discontinued', labelAr: 'إيقاف العلاج' },
];

// ---------------------------------------------------------------------------
// CTCAE v5.0 Adverse Events — Full Definitions
// ---------------------------------------------------------------------------

export const CTCAE_ADVERSE_EVENTS: CtcaeAdverseEvent[] = [
  // ========================================================================
  // 1. BLOOD AND LYMPHATIC SYSTEM
  // ========================================================================
  {
    term: 'Anemia',
    termAr: 'فقر الدم',
    category: 'BLOOD_LYMPHATIC',
    categoryAr: 'الدم والجهاز اللمفاوي',
    grades: {
      1: { descEn: 'Hemoglobin (Hgb) <LLN - 10.0 g/dL; <LLN - 100 g/L', descAr: 'الهيموغلوبين أقل من الحد الطبيعي - 10.0 غ/دل' },
      2: { descEn: 'Hgb <10.0 - 8.0 g/dL; transfusion not indicated', descAr: 'الهيموغلوبين 8.0-10.0 غ/دل؛ لا يتطلب نقل دم' },
      3: { descEn: 'Hgb <8.0 g/dL; transfusion indicated', descAr: 'الهيموغلوبين أقل من 8.0 غ/دل؛ يتطلب نقل دم' },
      4: { descEn: 'Life-threatening consequences; urgent intervention indicated', descAr: 'عواقب مهددة للحياة؛ تدخل عاجل مطلوب' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Neutropenia',
    termAr: 'نقص العدلات',
    category: 'BLOOD_LYMPHATIC',
    categoryAr: 'الدم والجهاز اللمفاوي',
    grades: {
      1: { descEn: 'ANC <LLN - 1500/mm3', descAr: 'العدلات أقل من الحد الطبيعي - 1500/مم3' },
      2: { descEn: 'ANC <1500 - 1000/mm3', descAr: 'العدلات 1000-1500/مم3' },
      3: { descEn: 'ANC <1000 - 500/mm3', descAr: 'العدلات 500-1000/مم3' },
      4: { descEn: 'ANC <500/mm3', descAr: 'العدلات أقل من 500/مم3' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Thrombocytopenia',
    termAr: 'نقص الصفائح الدموية',
    category: 'BLOOD_LYMPHATIC',
    categoryAr: 'الدم والجهاز اللمفاوي',
    grades: {
      1: { descEn: 'Platelets <LLN - 75,000/mm3', descAr: 'الصفائح أقل من الحد الطبيعي - 75,000/مم3' },
      2: { descEn: 'Platelets <75,000 - 50,000/mm3', descAr: 'الصفائح 50,000-75,000/مم3' },
      3: { descEn: 'Platelets <50,000 - 25,000/mm3', descAr: 'الصفائح 25,000-50,000/مم3' },
      4: { descEn: 'Platelets <25,000/mm3', descAr: 'الصفائح أقل من 25,000/مم3' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Febrile neutropenia',
    termAr: 'نقص العدلات الحموي',
    category: 'BLOOD_LYMPHATIC',
    categoryAr: 'الدم والجهاز اللمفاوي',
    grades: {
      1: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      2: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      3: { descEn: 'ANC <1000/mm3 with single temperature >38.3C or sustained temp >=38C for >1 hour', descAr: 'العدلات أقل من 1000 مع حرارة أعلى من 38.3 درجة أو حرارة مستمرة >= 38 لأكثر من ساعة' },
      4: { descEn: 'Life-threatening consequences; urgent intervention indicated', descAr: 'عواقب مهددة للحياة؛ تدخل عاجل مطلوب' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Lymphopenia',
    termAr: 'نقص الخلايا اللمفاوية',
    category: 'BLOOD_LYMPHATIC',
    categoryAr: 'الدم والجهاز اللمفاوي',
    grades: {
      1: { descEn: 'Lymphocytes <LLN - 800/mm3', descAr: 'الخلايا اللمفاوية أقل من الحد الطبيعي - 800/مم3' },
      2: { descEn: 'Lymphocytes <800 - 500/mm3', descAr: 'الخلايا اللمفاوية 500-800/مم3' },
      3: { descEn: 'Lymphocytes <500 - 200/mm3', descAr: 'الخلايا اللمفاوية 200-500/مم3' },
      4: { descEn: 'Lymphocytes <200/mm3', descAr: 'الخلايا اللمفاوية أقل من 200/مم3' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },

  // ========================================================================
  // 2. CARDIAC DISORDERS
  // ========================================================================
  {
    term: 'Cardiac arrest',
    termAr: 'توقف القلب',
    category: 'CARDIAC',
    categoryAr: 'اضطرابات القلب',
    grades: {
      1: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      2: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      3: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      4: { descEn: 'Life-threatening consequences; hemodynamic compromise; urgent intervention indicated (e.g., defibrillation)', descAr: 'عواقب مهددة للحياة؛ اختلال ديناميكي؛ تدخل عاجل مطلوب (مثل إزالة الرجفان)' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Heart failure',
    termAr: 'فشل القلب',
    category: 'CARDIAC',
    categoryAr: 'اضطرابات القلب',
    grades: {
      1: { descEn: 'Asymptomatic with laboratory (e.g., BNP) or cardiac imaging abnormalities', descAr: 'بدون أعراض مع خلل مخبري أو تصويري للقلب' },
      2: { descEn: 'Symptoms with mild to moderate activity or exertion', descAr: 'أعراض مع نشاط بسيط إلى متوسط' },
      3: { descEn: 'Severe symptoms at rest or with minimal activity/exertion; intervention indicated', descAr: 'أعراض شديدة أثناء الراحة أو النشاط البسيط؛ تدخل مطلوب' },
      4: { descEn: 'Life-threatening consequences; urgent intervention indicated (e.g., ventricular assist device, IV vasopressor, heart transplant)', descAr: 'عواقب مهددة للحياة؛ تدخل عاجل مطلوب' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Arrhythmia',
    termAr: 'اضطراب نظم القلب',
    category: 'CARDIAC',
    categoryAr: 'اضطرابات القلب',
    grades: {
      1: { descEn: 'Asymptomatic; intervention not indicated', descAr: 'بدون أعراض؛ لا يتطلب تدخل' },
      2: { descEn: 'Non-urgent medical intervention indicated', descAr: 'تدخل طبي غير عاجل مطلوب' },
      3: { descEn: 'Symptomatic and incompletely controlled medically; device (e.g., pacemaker) indicated', descAr: 'أعراض غير مسيطر عليها بالكامل؛ جهاز مطلوب' },
      4: { descEn: 'Life-threatening consequences; urgent intervention indicated', descAr: 'عواقب مهددة للحياة؛ تدخل عاجل مطلوب' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Myocardial infarction',
    termAr: 'احتشاء عضلة القلب',
    category: 'CARDIAC',
    categoryAr: 'اضطرابات القلب',
    grades: {
      1: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      2: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      3: { descEn: 'Severe symptoms; cardiac enzymes abnormal; hemodynamically stable; ECG changes consistent with infarction', descAr: 'أعراض شديدة؛ إنزيمات القلب غير طبيعية؛ مستقر ديناميكياً' },
      4: { descEn: 'Life-threatening consequences; hemodynamic compromise; urgent intervention indicated', descAr: 'عواقب مهددة للحياة؛ اختلال ديناميكي؛ تدخل عاجل مطلوب' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },

  // ========================================================================
  // 3. GASTROINTESTINAL DISORDERS
  // ========================================================================
  {
    term: 'Nausea',
    termAr: 'الغثيان',
    category: 'GASTROINTESTINAL',
    categoryAr: 'اضطرابات الجهاز الهضمي',
    grades: {
      1: { descEn: 'Loss of appetite without alteration in eating habits', descAr: 'فقدان الشهية بدون تغيير في عادات الأكل' },
      2: { descEn: 'Oral intake decreased without significant weight loss, dehydration, or malnutrition', descAr: 'انخفاض التناول الفموي بدون فقدان وزن كبير أو جفاف' },
      3: { descEn: 'Inadequate oral caloric or fluid intake; tube feeding, TPN, or hospitalization indicated', descAr: 'عدم كفاية السعرات أو السوائل الفموية؛ تغذية أنبوبية أو دخول المستشفى' },
      4: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      5: { descEn: 'Not applicable', descAr: 'غير منطبق' },
    },
  },
  {
    term: 'Vomiting',
    termAr: 'القيء',
    category: 'GASTROINTESTINAL',
    categoryAr: 'اضطرابات الجهاز الهضمي',
    grades: {
      1: { descEn: '1-2 episodes in 24 hrs; intervention not indicated', descAr: '1-2 نوبات في 24 ساعة؛ لا يتطلب تدخل' },
      2: { descEn: '3-5 episodes in 24 hrs; outpatient IV hydration indicated', descAr: '3-5 نوبات في 24 ساعة؛ ترطيب وريدي خارجي' },
      3: { descEn: '>=6 episodes in 24 hrs; tube feeding, TPN, or hospitalization indicated', descAr: '6 نوبات أو أكثر في 24 ساعة؛ دخول المستشفى' },
      4: { descEn: 'Life-threatening consequences; urgent intervention indicated', descAr: 'عواقب مهددة للحياة؛ تدخل عاجل مطلوب' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Diarrhea',
    termAr: 'الإسهال',
    category: 'GASTROINTESTINAL',
    categoryAr: 'اضطرابات الجهاز الهضمي',
    grades: {
      1: { descEn: 'Increase of <4 stools per day over baseline', descAr: 'زيادة أقل من 4 حركات أمعاء يومياً' },
      2: { descEn: 'Increase of 4-6 stools per day over baseline; IV fluids indicated <24 hrs', descAr: 'زيادة 4-6 حركات يومياً؛ سوائل وريدية أقل من 24 ساعة' },
      3: { descEn: 'Increase of >=7 stools per day over baseline; incontinence; hospitalization indicated; IV fluids >=24 hrs', descAr: 'زيادة 7 أو أكثر يومياً؛ سلس؛ دخول المستشفى' },
      4: { descEn: 'Life-threatening consequences; urgent intervention indicated', descAr: 'عواقب مهددة للحياة؛ تدخل عاجل مطلوب' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Mucositis oral',
    termAr: 'التهاب الغشاء المخاطي الفموي',
    category: 'GASTROINTESTINAL',
    categoryAr: 'اضطرابات الجهاز الهضمي',
    grades: {
      1: { descEn: 'Asymptomatic or mild symptoms; intervention not indicated', descAr: 'بدون أعراض أو أعراض خفيفة؛ لا يتطلب تدخل' },
      2: { descEn: 'Moderate pain or ulcer that does not interfere with oral intake; modified diet indicated', descAr: 'ألم متوسط أو قرحة لا تمنع الأكل؛ تعديل النظام الغذائي' },
      3: { descEn: 'Severe pain; interfering with oral intake', descAr: 'ألم شديد؛ يمنع التناول الفموي' },
      4: { descEn: 'Life-threatening consequences; urgent intervention indicated', descAr: 'عواقب مهددة للحياة؛ تدخل عاجل مطلوب' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Constipation',
    termAr: 'الإمساك',
    category: 'GASTROINTESTINAL',
    categoryAr: 'اضطرابات الجهاز الهضمي',
    grades: {
      1: { descEn: 'Occasional or intermittent symptoms; occasional use of stool softeners, laxatives, dietary modification, or enema', descAr: 'أعراض متقطعة؛ استخدام ملينات أحياناً' },
      2: { descEn: 'Persistent symptoms with regular use of laxatives or enemas indicated', descAr: 'أعراض مستمرة مع استخدام منتظم للملينات' },
      3: { descEn: 'Obstipation with manual evacuation indicated; hospitalization indicated', descAr: 'انسداد يتطلب إخلاء يدوي؛ دخول المستشفى' },
      4: { descEn: 'Life-threatening consequences; urgent intervention indicated', descAr: 'عواقب مهددة للحياة؛ تدخل عاجل مطلوب' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Abdominal pain',
    termAr: 'ألم البطن',
    category: 'GASTROINTESTINAL',
    categoryAr: 'اضطرابات الجهاز الهضمي',
    grades: {
      1: { descEn: 'Mild pain', descAr: 'ألم خفيف' },
      2: { descEn: 'Moderate pain; limiting instrumental ADL', descAr: 'ألم متوسط؛ يحد من الأنشطة الوسيلية' },
      3: { descEn: 'Severe pain; limiting self care ADL', descAr: 'ألم شديد؛ يحد من الرعاية الذاتية' },
      4: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      5: { descEn: 'Not applicable', descAr: 'غير منطبق' },
    },
  },

  // ========================================================================
  // 4. GENERAL DISORDERS
  // ========================================================================
  {
    term: 'Fatigue',
    termAr: 'الإرهاق',
    category: 'GENERAL',
    categoryAr: 'اضطرابات عامة',
    grades: {
      1: { descEn: 'Fatigue relieved by rest', descAr: 'إرهاق يزول بالراحة' },
      2: { descEn: 'Fatigue not relieved by rest; limiting instrumental ADL', descAr: 'إرهاق لا يزول بالراحة؛ يحد من الأنشطة الوسيلية' },
      3: { descEn: 'Fatigue not relieved by rest; limiting self care ADL', descAr: 'إرهاق لا يزول بالراحة؛ يحد من الرعاية الذاتية' },
      4: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      5: { descEn: 'Not applicable', descAr: 'غير منطبق' },
    },
  },
  {
    term: 'Fever',
    termAr: 'الحمى',
    category: 'GENERAL',
    categoryAr: 'اضطرابات عامة',
    grades: {
      1: { descEn: '38.0 - 39.0 C (100.4 - 102.2 F)', descAr: '38.0 - 39.0 درجة مئوية' },
      2: { descEn: '>39.0 - 40.0 C (102.3 - 104.0 F)', descAr: 'أكثر من 39.0 - 40.0 درجة مئوية' },
      3: { descEn: '>40.0 C (>104.0 F) for <=24 hrs', descAr: 'أكثر من 40.0 درجة لمدة 24 ساعة أو أقل' },
      4: { descEn: '>40.0 C (>104.0 F) for >24 hrs', descAr: 'أكثر من 40.0 درجة لأكثر من 24 ساعة' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Weight loss',
    termAr: 'فقدان الوزن',
    category: 'GENERAL',
    categoryAr: 'اضطرابات عامة',
    grades: {
      1: { descEn: '5 - <10% from baseline; intervention not indicated', descAr: '5 - أقل من 10% من خط الأساس' },
      2: { descEn: '10 - <20% from baseline; nutritional support indicated', descAr: '10 - أقل من 20% من خط الأساس؛ دعم غذائي' },
      3: { descEn: '>=20% from baseline; tube feeding or TPN indicated', descAr: '20% أو أكثر من خط الأساس؛ تغذية أنبوبية' },
      4: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      5: { descEn: 'Not applicable', descAr: 'غير منطبق' },
    },
  },
  {
    term: 'Anorexia',
    termAr: 'فقدان الشهية',
    category: 'GENERAL',
    categoryAr: 'اضطرابات عامة',
    grades: {
      1: { descEn: 'Loss of appetite without alteration in eating habits', descAr: 'فقدان الشهية بدون تغيير في عادات الأكل' },
      2: { descEn: 'Oral intake altered without significant weight loss or malnutrition; oral nutritional supplements indicated', descAr: 'تغير في التناول الفموي بدون فقدان وزن كبير؛ مكملات غذائية' },
      3: { descEn: 'Associated with significant weight loss or malnutrition; IV fluids, tube feeding, or TPN indicated', descAr: 'مرتبط بفقدان وزن كبير أو سوء تغذية؛ سوائل وريدية أو تغذية أنبوبية' },
      4: { descEn: 'Life-threatening consequences; urgent intervention indicated', descAr: 'عواقب مهددة للحياة؛ تدخل عاجل مطلوب' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },

  // ========================================================================
  // 5. HEPATOBILIARY DISORDERS
  // ========================================================================
  {
    term: 'ALT increased',
    termAr: 'ارتفاع إنزيم ALT',
    category: 'HEPATOBILIARY',
    categoryAr: 'اضطرابات الكبد والقنوات الصفراوية',
    grades: {
      1: { descEn: '>ULN - 3.0 x ULN', descAr: 'أعلى من الحد الطبيعي - 3 أضعاف' },
      2: { descEn: '>3.0 - 5.0 x ULN', descAr: '3-5 أضعاف الحد الطبيعي' },
      3: { descEn: '>5.0 - 20.0 x ULN', descAr: '5-20 ضعف الحد الطبيعي' },
      4: { descEn: '>20.0 x ULN', descAr: 'أكثر من 20 ضعف الحد الطبيعي' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'AST increased',
    termAr: 'ارتفاع إنزيم AST',
    category: 'HEPATOBILIARY',
    categoryAr: 'اضطرابات الكبد والقنوات الصفراوية',
    grades: {
      1: { descEn: '>ULN - 3.0 x ULN', descAr: 'أعلى من الحد الطبيعي - 3 أضعاف' },
      2: { descEn: '>3.0 - 5.0 x ULN', descAr: '3-5 أضعاف الحد الطبيعي' },
      3: { descEn: '>5.0 - 20.0 x ULN', descAr: '5-20 ضعف الحد الطبيعي' },
      4: { descEn: '>20.0 x ULN', descAr: 'أكثر من 20 ضعف الحد الطبيعي' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Bilirubin increased',
    termAr: 'ارتفاع البيليروبين',
    category: 'HEPATOBILIARY',
    categoryAr: 'اضطرابات الكبد والقنوات الصفراوية',
    grades: {
      1: { descEn: '>ULN - 1.5 x ULN', descAr: 'أعلى من الحد الطبيعي - 1.5 ضعف' },
      2: { descEn: '>1.5 - 3.0 x ULN', descAr: '1.5-3 أضعاف الحد الطبيعي' },
      3: { descEn: '>3.0 - 10.0 x ULN', descAr: '3-10 أضعاف الحد الطبيعي' },
      4: { descEn: '>10.0 x ULN', descAr: 'أكثر من 10 أضعاف الحد الطبيعي' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Hepatic failure',
    termAr: 'فشل الكبد',
    category: 'HEPATOBILIARY',
    categoryAr: 'اضطرابات الكبد والقنوات الصفراوية',
    grades: {
      1: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      2: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      3: { descEn: 'Asterixis; mild encephalopathy; limiting self care ADL', descAr: 'ارتعاش؛ اعتلال دماغي خفيف؛ يحد من الرعاية الذاتية' },
      4: { descEn: 'Moderate to severe encephalopathy; coma; life-threatening consequences', descAr: 'اعتلال دماغي متوسط إلى شديد؛ غيبوبة؛ مهدد للحياة' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },

  // ========================================================================
  // 6. INFECTIONS AND INFESTATIONS
  // ========================================================================
  {
    term: 'Sepsis',
    termAr: 'تعفن الدم',
    category: 'INFECTIONS',
    categoryAr: 'العدوى والإصابات',
    grades: {
      1: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      2: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      3: { descEn: 'Sepsis; IV antibiotics indicated; medical intervention indicated but not life-threatening', descAr: 'تعفن الدم؛ مضادات حيوية وريدية؛ تدخل طبي غير مهدد للحياة' },
      4: { descEn: 'Life-threatening consequences (e.g., septic shock, multiorgan failure); urgent intervention indicated', descAr: 'عواقب مهددة للحياة (صدمة إنتانية، فشل متعدد الأعضاء)' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Pneumonia',
    termAr: 'الالتهاب الرئوي',
    category: 'INFECTIONS',
    categoryAr: 'العدوى والإصابات',
    grades: {
      1: { descEn: 'Asymptomatic; clinical or diagnostic observations only; intervention not indicated', descAr: 'بدون أعراض؛ ملاحظات سريرية فقط' },
      2: { descEn: 'Symptomatic; medical intervention indicated; limiting instrumental ADL', descAr: 'أعراض؛ تدخل طبي مطلوب؛ يحد من الأنشطة' },
      3: { descEn: 'Severe symptoms; IV antibiotics, antifungals, or antivirals indicated; radiologic, endoscopic, or operative intervention indicated; hospitalization', descAr: 'أعراض شديدة؛ مضادات وريدية؛ دخول المستشفى' },
      4: { descEn: 'Life-threatening consequences (e.g., respiratory failure); urgent intervention indicated', descAr: 'عواقب مهددة للحياة (مثل فشل تنفسي)؛ تدخل عاجل' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Urinary tract infection',
    termAr: 'عدوى المسالك البولية',
    category: 'INFECTIONS',
    categoryAr: 'العدوى والإصابات',
    grades: {
      1: { descEn: 'Asymptomatic bacteriuria; intervention not indicated', descAr: 'وجود بكتيريا بدون أعراض؛ لا يتطلب تدخل' },
      2: { descEn: 'Symptomatic; oral antibiotics indicated; limiting instrumental ADL', descAr: 'أعراض؛ مضادات حيوية فموية؛ يحد من الأنشطة' },
      3: { descEn: 'IV antibiotics indicated; hospitalization indicated', descAr: 'مضادات حيوية وريدية؛ دخول المستشفى' },
      4: { descEn: 'Life-threatening consequences (e.g., sepsis); urgent intervention indicated', descAr: 'عواقب مهددة للحياة (مثل تعفن الدم)؛ تدخل عاجل' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Catheter-related infection',
    termAr: 'عدوى مرتبطة بالقسطرة',
    category: 'INFECTIONS',
    categoryAr: 'العدوى والإصابات',
    grades: {
      1: { descEn: 'Localized; local intervention indicated (e.g., topical antibiotic, antifungal, or antiviral)', descAr: 'موضعي؛ علاج موضعي' },
      2: { descEn: 'Oral intervention indicated (e.g., antibiotic, antifungal, antiviral); catheter removal indicated', descAr: 'علاج فموي مطلوب؛ إزالة القسطرة' },
      3: { descEn: 'IV antibiotic, antifungal, or antiviral intervention indicated; radiologic or operative intervention indicated', descAr: 'مضادات وريدية؛ تدخل جراحي أو إشعاعي' },
      4: { descEn: 'Life-threatening consequences; urgent intervention indicated', descAr: 'عواقب مهددة للحياة؛ تدخل عاجل مطلوب' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },

  // ========================================================================
  // 7. METABOLISM AND NUTRITION
  // ========================================================================
  {
    term: 'Hyponatremia',
    termAr: 'نقص الصوديوم',
    category: 'METABOLISM',
    categoryAr: 'الأيض والتغذية',
    grades: {
      1: { descEn: '<LLN - 130 mmol/L', descAr: 'أقل من الحد الطبيعي - 130 مليمول/لتر' },
      2: { descEn: '<130 - 120 mmol/L', descAr: '120-130 مليمول/لتر' },
      3: { descEn: '<120 mmol/L; hospitalization indicated', descAr: 'أقل من 120 مليمول/لتر؛ دخول المستشفى' },
      4: { descEn: 'Life-threatening consequences (e.g., seizures); urgent intervention indicated', descAr: 'عواقب مهددة للحياة (تشنجات)؛ تدخل عاجل' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Hypokalemia',
    termAr: 'نقص البوتاسيوم',
    category: 'METABOLISM',
    categoryAr: 'الأيض والتغذية',
    grades: {
      1: { descEn: '<LLN - 3.0 mmol/L', descAr: 'أقل من الحد الطبيعي - 3.0 مليمول/لتر' },
      2: { descEn: '<3.0 - 2.5 mmol/L', descAr: '2.5-3.0 مليمول/لتر' },
      3: { descEn: '<2.5 mmol/L; hospitalization indicated', descAr: 'أقل من 2.5 مليمول/لتر؛ دخول المستشفى' },
      4: { descEn: 'Life-threatening consequences (e.g., arrhythmia); urgent intervention indicated', descAr: 'عواقب مهددة للحياة (اضطراب نظم)؛ تدخل عاجل' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Hyperglycemia',
    termAr: 'ارتفاع سكر الدم',
    category: 'METABOLISM',
    categoryAr: 'الأيض والتغذية',
    grades: {
      1: { descEn: 'Fasting glucose >ULN - 160 mg/dL; >ULN - 8.9 mmol/L', descAr: 'السكر الصائم أعلى من الحد الطبيعي - 160 ملغ/دل' },
      2: { descEn: 'Fasting glucose >160 - 250 mg/dL; >8.9 - 13.9 mmol/L', descAr: 'السكر الصائم 160-250 ملغ/دل' },
      3: { descEn: 'Fasting glucose >250 - 500 mg/dL; >13.9 - 27.8 mmol/L; hospitalization indicated', descAr: 'السكر الصائم 250-500 ملغ/دل؛ دخول المستشفى' },
      4: { descEn: 'Fasting glucose >500 mg/dL; >27.8 mmol/L; life-threatening consequences', descAr: 'السكر الصائم أكثر من 500 ملغ/دل؛ مهدد للحياة' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Dehydration',
    termAr: 'الجفاف',
    category: 'METABOLISM',
    categoryAr: 'الأيض والتغذية',
    grades: {
      1: { descEn: 'Increased oral fluids indicated; dry mucous membranes; diminished skin turgor', descAr: 'زيادة السوائل الفموية؛ أغشية مخاطية جافة' },
      2: { descEn: 'IV fluids indicated <24 hrs', descAr: 'سوائل وريدية أقل من 24 ساعة' },
      3: { descEn: 'IV fluids or hospitalization indicated >=24 hrs', descAr: 'سوائل وريدية أو دخول المستشفى 24 ساعة أو أكثر' },
      4: { descEn: 'Life-threatening consequences; urgent intervention indicated', descAr: 'عواقب مهددة للحياة؛ تدخل عاجل مطلوب' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Tumor lysis syndrome',
    termAr: 'متلازمة تحلل الورم',
    category: 'METABOLISM',
    categoryAr: 'الأيض والتغذية',
    grades: {
      1: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      2: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      3: { descEn: 'Present; laboratory TLS (abnormalities present) without clinical consequences', descAr: 'موجود؛ معملي بدون عواقب سريرية' },
      4: { descEn: 'Present; clinical TLS: life-threatening consequences (renal failure, cardiac arrhythmia, seizure)', descAr: 'موجود سريرياً؛ مهدد للحياة (فشل كلوي، اضطراب نظم، تشنجات)' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },

  // ========================================================================
  // 8. MUSCULOSKELETAL DISORDERS
  // ========================================================================
  {
    term: 'Arthralgia',
    termAr: 'ألم المفاصل',
    category: 'MUSCULOSKELETAL',
    categoryAr: 'اضطرابات العضلات والعظام',
    grades: {
      1: { descEn: 'Mild pain', descAr: 'ألم خفيف' },
      2: { descEn: 'Moderate pain; limiting instrumental ADL', descAr: 'ألم متوسط؛ يحد من الأنشطة الوسيلية' },
      3: { descEn: 'Severe pain; limiting self care ADL', descAr: 'ألم شديد؛ يحد من الرعاية الذاتية' },
      4: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      5: { descEn: 'Not applicable', descAr: 'غير منطبق' },
    },
  },
  {
    term: 'Myalgia',
    termAr: 'ألم العضلات',
    category: 'MUSCULOSKELETAL',
    categoryAr: 'اضطرابات العضلات والعظام',
    grades: {
      1: { descEn: 'Mild pain', descAr: 'ألم خفيف' },
      2: { descEn: 'Moderate pain; limiting instrumental ADL', descAr: 'ألم متوسط؛ يحد من الأنشطة الوسيلية' },
      3: { descEn: 'Severe pain; limiting self care ADL', descAr: 'ألم شديد؛ يحد من الرعاية الذاتية' },
      4: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      5: { descEn: 'Not applicable', descAr: 'غير منطبق' },
    },
  },
  {
    term: 'Bone pain',
    termAr: 'ألم العظام',
    category: 'MUSCULOSKELETAL',
    categoryAr: 'اضطرابات العضلات والعظام',
    grades: {
      1: { descEn: 'Mild pain', descAr: 'ألم خفيف' },
      2: { descEn: 'Moderate pain; limiting instrumental ADL', descAr: 'ألم متوسط؛ يحد من الأنشطة الوسيلية' },
      3: { descEn: 'Severe pain; limiting self care ADL', descAr: 'ألم شديد؛ يحد من الرعاية الذاتية' },
      4: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      5: { descEn: 'Not applicable', descAr: 'غير منطبق' },
    },
  },

  // ========================================================================
  // 9. NERVOUS SYSTEM DISORDERS
  // ========================================================================
  {
    term: 'Peripheral sensory neuropathy',
    termAr: 'اعتلال الأعصاب الطرفية الحسي',
    category: 'NERVOUS',
    categoryAr: 'اضطرابات الجهاز العصبي',
    grades: {
      1: { descEn: 'Asymptomatic; loss of deep tendon reflexes or paresthesia', descAr: 'بدون أعراض؛ فقدان المنعكسات أو تنميل' },
      2: { descEn: 'Moderate symptoms; limiting instrumental ADL', descAr: 'أعراض متوسطة؛ تحد من الأنشطة الوسيلية' },
      3: { descEn: 'Severe symptoms; limiting self care ADL', descAr: 'أعراض شديدة؛ تحد من الرعاية الذاتية' },
      4: { descEn: 'Life-threatening consequences; urgent intervention indicated', descAr: 'عواقب مهددة للحياة؛ تدخل عاجل مطلوب' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Headache',
    termAr: 'صداع',
    category: 'NERVOUS',
    categoryAr: 'اضطرابات الجهاز العصبي',
    grades: {
      1: { descEn: 'Mild pain', descAr: 'ألم خفيف' },
      2: { descEn: 'Moderate pain; limiting instrumental ADL', descAr: 'ألم متوسط؛ يحد من الأنشطة الوسيلية' },
      3: { descEn: 'Severe pain; limiting self care ADL', descAr: 'ألم شديد؛ يحد من الرعاية الذاتية' },
      4: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      5: { descEn: 'Not applicable', descAr: 'غير منطبق' },
    },
  },
  {
    term: 'Dizziness',
    termAr: 'الدوخة',
    category: 'NERVOUS',
    categoryAr: 'اضطرابات الجهاز العصبي',
    grades: {
      1: { descEn: 'Mild unsteadiness or sensation of movement', descAr: 'عدم استقرار خفيف أو إحساس بالحركة' },
      2: { descEn: 'Moderate unsteadiness; limiting instrumental ADL', descAr: 'عدم استقرار متوسط؛ يحد من الأنشطة الوسيلية' },
      3: { descEn: 'Severe unsteadiness; limiting self care ADL', descAr: 'عدم استقرار شديد؛ يحد من الرعاية الذاتية' },
      4: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      5: { descEn: 'Not applicable', descAr: 'غير منطبق' },
    },
  },
  {
    term: 'Seizure',
    termAr: 'نوبة صرعية',
    category: 'NERVOUS',
    categoryAr: 'اضطرابات الجهاز العصبي',
    grades: {
      1: { descEn: 'Brief partial seizure; no loss of consciousness; no intervention indicated', descAr: 'نوبة جزئية قصيرة؛ بدون فقدان وعي' },
      2: { descEn: 'Brief generalized seizure; anticonvulsant indicated; limiting instrumental ADL', descAr: 'نوبة عامة قصيرة؛ مضاد تشنجات مطلوب' },
      3: { descEn: 'Multiple seizures despite medical intervention; new onset seizures (generalized)', descAr: 'نوبات متعددة رغم العلاج؛ نوبات جديدة عامة' },
      4: { descEn: 'Life-threatening; prolonged, repetitive, or difficult to control (e.g., status epilepticus); urgent intervention indicated', descAr: 'مهدد للحياة؛ نوبات مطولة أو متكررة؛ تدخل عاجل' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Encephalopathy',
    termAr: 'اعتلال الدماغ',
    category: 'NERVOUS',
    categoryAr: 'اضطرابات الجهاز العصبي',
    grades: {
      1: { descEn: 'Mild symptoms; not interfering with function', descAr: 'أعراض خفيفة؛ لا تؤثر على الوظائف' },
      2: { descEn: 'Moderate symptoms; limiting instrumental ADL', descAr: 'أعراض متوسطة؛ تحد من الأنشطة الوسيلية' },
      3: { descEn: 'Severe symptoms; limiting self care ADL', descAr: 'أعراض شديدة؛ تحد من الرعاية الذاتية' },
      4: { descEn: 'Life-threatening consequences; urgent intervention indicated', descAr: 'عواقب مهددة للحياة؛ تدخل عاجل مطلوب' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },

  // ========================================================================
  // 10. RENAL AND URINARY DISORDERS
  // ========================================================================
  {
    term: 'Acute kidney injury',
    termAr: 'إصابة الكلى الحادة',
    category: 'RENAL',
    categoryAr: 'اضطرابات الكلى والمسالك البولية',
    grades: {
      1: { descEn: 'Creatinine level increase of >0.3 mg/dL; creatinine 1.5-2.0 x above baseline', descAr: 'ارتفاع الكرياتينين أكثر من 0.3 ملغ/دل؛ 1.5-2 ضعف خط الأساس' },
      2: { descEn: 'Creatinine 2-3 x above baseline', descAr: 'الكرياتينين 2-3 أضعاف خط الأساس' },
      3: { descEn: 'Creatinine >3 x baseline or >4.0 mg/dL; hospitalization indicated', descAr: 'الكرياتينين أكثر من 3 أضعاف أو أكثر من 4.0 ملغ/دل؛ دخول المستشفى' },
      4: { descEn: 'Life-threatening consequences; dialysis indicated', descAr: 'عواقب مهددة للحياة؛ غسيل كلى مطلوب' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Creatinine increased',
    termAr: 'ارتفاع الكرياتينين',
    category: 'RENAL',
    categoryAr: 'اضطرابات الكلى والمسالك البولية',
    grades: {
      1: { descEn: '>ULN - 1.5 x ULN', descAr: 'أعلى من الحد الطبيعي - 1.5 ضعف' },
      2: { descEn: '>1.5 - 3.0 x ULN', descAr: '1.5-3 أضعاف الحد الطبيعي' },
      3: { descEn: '>3.0 - 6.0 x ULN', descAr: '3-6 أضعاف الحد الطبيعي' },
      4: { descEn: '>6.0 x ULN; dialysis indicated', descAr: 'أكثر من 6 أضعاف الحد الطبيعي؛ غسيل كلى' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Proteinuria',
    termAr: 'البيلة البروتينية',
    category: 'RENAL',
    categoryAr: 'اضطرابات الكلى والمسالك البولية',
    grades: {
      1: { descEn: '1+ proteinuria; urinary protein <1.0 g/24 hrs', descAr: 'بروتين بولي 1+؛ أقل من 1.0 غ/24 ساعة' },
      2: { descEn: 'Urinary protein 1.0 - 3.4 g/24 hrs', descAr: 'بروتين بولي 1.0-3.4 غ/24 ساعة' },
      3: { descEn: 'Urinary protein >=3.5 g/24 hrs', descAr: 'بروتين بولي 3.5 غ/24 ساعة أو أكثر' },
      4: { descEn: 'Nephrotic syndrome', descAr: 'متلازمة كلوية' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },

  // ========================================================================
  // 11. RESPIRATORY DISORDERS
  // ========================================================================
  {
    term: 'Dyspnea',
    termAr: 'ضيق التنفس',
    category: 'RESPIRATORY',
    categoryAr: 'اضطرابات الجهاز التنفسي',
    grades: {
      1: { descEn: 'Shortness of breath with moderate exertion', descAr: 'ضيق التنفس مع مجهود متوسط' },
      2: { descEn: 'Shortness of breath with minimal exertion; limiting instrumental ADL', descAr: 'ضيق التنفس مع مجهود بسيط؛ يحد من الأنشطة' },
      3: { descEn: 'Shortness of breath at rest; limiting self care ADL; oxygen indicated', descAr: 'ضيق التنفس أثناء الراحة؛ أكسجين مطلوب' },
      4: { descEn: 'Life-threatening consequences; urgent intervention indicated (e.g., intubation)', descAr: 'عواقب مهددة للحياة؛ تدخل عاجل (مثل تنبيب)' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Pneumonitis',
    termAr: 'التهاب الرئة',
    category: 'RESPIRATORY',
    categoryAr: 'اضطرابات الجهاز التنفسي',
    grades: {
      1: { descEn: 'Asymptomatic; clinical or diagnostic observations only; intervention not indicated', descAr: 'بدون أعراض؛ ملاحظات سريرية أو تشخيصية فقط' },
      2: { descEn: 'Symptomatic; medical intervention indicated; limiting instrumental ADL', descAr: 'أعراض؛ تدخل طبي مطلوب؛ يحد من الأنشطة' },
      3: { descEn: 'Severe symptoms; limiting self care ADL; oxygen indicated', descAr: 'أعراض شديدة؛ أكسجين مطلوب' },
      4: { descEn: 'Life-threatening respiratory compromise; urgent intervention indicated (e.g., tracheotomy or intubation)', descAr: 'اختلال تنفسي مهدد للحياة؛ تدخل عاجل' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Cough',
    termAr: 'السعال',
    category: 'RESPIRATORY',
    categoryAr: 'اضطرابات الجهاز التنفسي',
    grades: {
      1: { descEn: 'Mild symptoms; nonprescription intervention indicated', descAr: 'أعراض خفيفة؛ علاج بدون وصفة' },
      2: { descEn: 'Moderate symptoms; medical intervention indicated; limiting instrumental ADL', descAr: 'أعراض متوسطة؛ تدخل طبي مطلوب' },
      3: { descEn: 'Severe symptoms; limiting self care ADL', descAr: 'أعراض شديدة؛ تحد من الرعاية الذاتية' },
      4: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      5: { descEn: 'Not applicable', descAr: 'غير منطبق' },
    },
  },
  {
    term: 'Pulmonary embolism',
    termAr: 'الانصمام الرئوي',
    category: 'RESPIRATORY',
    categoryAr: 'اضطرابات الجهاز التنفسي',
    grades: {
      1: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      2: { descEn: 'Subsegmental; no treatment indicated', descAr: 'تحت قطعي؛ لا يتطلب علاج' },
      3: { descEn: 'Segmental or subsegmental; anticoagulation indicated', descAr: 'قطعي أو تحت قطعي؛ مضاد تخثر مطلوب' },
      4: { descEn: 'Life-threatening hemodynamic or pulmonary compromise; intubation, thrombolysis, thrombectomy, or IVC filter placement indicated', descAr: 'اختلال ديناميكي أو رئوي مهدد للحياة؛ تدخل عاجل' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },

  // ========================================================================
  // 12. SKIN AND SUBCUTANEOUS TISSUE
  // ========================================================================
  {
    term: 'Rash maculopapular',
    termAr: 'طفح بقعي حطاطي',
    category: 'SKIN',
    categoryAr: 'الجلد والأنسجة تحت الجلدية',
    grades: {
      1: { descEn: 'Macules/papules covering <10% BSA with or without symptoms (e.g., pruritus, burning, tightness)', descAr: 'بقع/حطاطات تغطي أقل من 10% من سطح الجسم' },
      2: { descEn: 'Macules/papules covering 10-30% BSA with or without symptoms; limiting instrumental ADL; skin desquamation covering <10% BSA', descAr: 'بقع/حطاطات تغطي 10-30% من سطح الجسم؛ تحد من الأنشطة' },
      3: { descEn: 'Macules/papules covering >30% BSA with or without symptoms; limiting self care ADL', descAr: 'بقع/حطاطات تغطي أكثر من 30% من سطح الجسم' },
      4: { descEn: 'Papulopustular rash covering any % BSA associated with SJS/TEN/DRESS; limiting self care ADL', descAr: 'طفح حطاطي بثري مرتبط بمتلازمة ستيفنز جونسون' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
  {
    term: 'Hand-foot syndrome (PPE)',
    termAr: 'متلازمة اليد والقدم',
    category: 'SKIN',
    categoryAr: 'الجلد والأنسجة تحت الجلدية',
    grades: {
      1: { descEn: 'Minimal skin changes or dermatitis (e.g., erythema, edema, or hyperkeratosis) without pain', descAr: 'تغيرات جلدية بسيطة بدون ألم' },
      2: { descEn: 'Skin changes (e.g., peeling, blisters, bleeding, fissures, edema, or hyperkeratosis) with pain; limiting instrumental ADL', descAr: 'تغيرات جلدية مع ألم؛ تحد من الأنشطة الوسيلية' },
      3: { descEn: 'Severe skin changes with pain; limiting self care ADL', descAr: 'تغيرات جلدية شديدة مع ألم؛ تحد من الرعاية الذاتية' },
      4: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      5: { descEn: 'Not applicable', descAr: 'غير منطبق' },
    },
  },
  {
    term: 'Alopecia',
    termAr: 'تساقط الشعر',
    category: 'SKIN',
    categoryAr: 'الجلد والأنسجة تحت الجلدية',
    grades: {
      1: { descEn: 'Hair loss of <50% of normal for that individual that is not obvious from a distance; may require different hairstyle but does not require wig or hair piece', descAr: 'فقدان شعر أقل من 50%؛ قد يتطلب تغيير تسريحة الشعر' },
      2: { descEn: 'Hair loss of >=50% normal for that individual that is readily apparent to others; a wig or hair piece is necessary', descAr: 'فقدان شعر 50% أو أكثر؛ يتطلب باروكة' },
      3: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      4: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      5: { descEn: 'Not applicable', descAr: 'غير منطبق' },
    },
  },
  {
    term: 'Pruritus',
    termAr: 'الحكة',
    category: 'SKIN',
    categoryAr: 'الجلد والأنسجة تحت الجلدية',
    grades: {
      1: { descEn: 'Mild or localized; topical intervention indicated', descAr: 'خفيفة أو موضعية؛ علاج موضعي' },
      2: { descEn: 'Widespread and intermittent; skin changes from scratching (e.g., edema, papulation, excoriations, lichenification, oozing/crusts); oral intervention indicated; limiting instrumental ADL', descAr: 'منتشرة ومتقطعة؛ تغيرات جلدية من الحك؛ علاج فموي' },
      3: { descEn: 'Widespread and constant; limiting self care ADL or sleep; systemic corticosteroid or immunosuppressive therapy indicated', descAr: 'منتشرة ومستمرة؛ تحد من الرعاية الذاتية أو النوم' },
      4: { descEn: 'Not applicable', descAr: 'غير منطبق' },
      5: { descEn: 'Not applicable', descAr: 'غير منطبق' },
    },
  },
  {
    term: 'Dermatitis acneiform',
    termAr: 'التهاب الجلد الحبيبي',
    category: 'SKIN',
    categoryAr: 'الجلد والأنسجة تحت الجلدية',
    grades: {
      1: { descEn: 'Papules and/or pustules covering <10% BSA, which may or may not be associated with symptoms of pruritus or tenderness', descAr: 'حطاطات و/أو بثور تغطي أقل من 10% من سطح الجسم' },
      2: { descEn: 'Papules and/or pustules covering 10-30% BSA, which may or may not be associated with symptoms of pruritus or tenderness; associated with psychosocial impact; limiting instrumental ADL', descAr: 'حطاطات و/أو بثور تغطي 10-30% من سطح الجسم؛ تحد من الأنشطة' },
      3: { descEn: 'Papules and/or pustules covering >30% BSA with or without symptoms; limiting self care ADL; associated with local superinfection with oral antibiotics indicated', descAr: 'حطاطات و/أو بثور تغطي أكثر من 30%؛ عدوى ثانوية' },
      4: { descEn: 'Papules and/or pustules covering any % BSA associated with extensive superinfection with IV antibiotics indicated; life-threatening consequences', descAr: 'عدوى واسعة مع مضادات وريدية؛ مهدد للحياة' },
      5: { descEn: 'Death', descAr: 'الوفاة' },
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get adverse events filtered by SOC category key.
 */
export function getEventsByCategory(categoryKey: string): CtcaeAdverseEvent[] {
  return CTCAE_ADVERSE_EVENTS.filter((e) => e.category === categoryKey);
}

/**
 * Find a specific adverse event by its English term.
 */
export function findAdverseEvent(term: string): CtcaeAdverseEvent | undefined {
  return CTCAE_ADVERSE_EVENTS.find((e) => e.term === term);
}

/**
 * Calculate the overall worst (highest) grade from an array of toxicity entries.
 * Returns 0 if the array is empty.
 */
export function getWorstGrade(toxicities: ToxicityEntry[]): number {
  if (!toxicities || toxicities.length === 0) return 0;
  return Math.max(...toxicities.map((t) => t.grade ?? 0));
}

/**
 * Returns the grade color class for Tailwind badge styling.
 */
export function getGradeColor(grade: number): string {
  switch (grade) {
    case 1: return 'bg-green-100 text-green-800';
    case 2: return 'bg-yellow-100 text-yellow-800';
    case 3: return 'bg-orange-100 text-orange-800';
    case 4: return 'bg-red-100 text-red-800';
    case 5: return 'bg-gray-900 text-white';
    default: return 'bg-gray-100 text-gray-600';
  }
}

/**
 * Grade labels — bilingual.
 */
export function getGradeLabel(grade: number, lang: 'ar' | 'en'): string {
  const labels: Record<number, { ar: string; en: string }> = {
    1: { ar: 'خفيف', en: 'Mild' },
    2: { ar: 'متوسط', en: 'Moderate' },
    3: { ar: 'شديد', en: 'Severe' },
    4: { ar: 'مهدد للحياة', en: 'Life-threatening' },
    5: { ar: 'وفاة', en: 'Death' },
  };
  const l = labels[grade];
  if (!l) return '';
  return lang === 'ar' ? l.ar : l.en;
}
