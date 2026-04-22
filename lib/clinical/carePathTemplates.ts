// =============================================================================
// Specialized Care Path Templates
// =============================================================================
// Template-specific task generation for Baby, NICU, Critical Care, and L&D

import type { TaskCategory } from './carePath';

interface TemplateTask {
  category: TaskCategory;
  subcategory?: string;
  time: string; // HH:mm
  title: string;
  titleAr: string;
  description?: string;
  descriptionAr?: string;
  recurrenceRule?: string;
  isRecurring: boolean;
  priority: string;
  taskData?: Record<string, unknown>;
}

// =============================================================================
// Baby Path Template — Nursery
// =============================================================================
export function getBabyPathTasks(): TemplateTask[] {
  return [
    // Vitals q3h
    ...generateRecurringTasks('Q3H', {
      category: 'VITALS', title: 'Baby Vital Signs (Q3H)', titleAr: 'علامات الطفل الحيوية (كل ٣ ساعات)',
      taskData: { frequency: 'Q3H', parameters: ['Temp', 'HR', 'RR', 'SpO2', 'Weight'] },
    }),

    // Cord care q8h
    { category: 'NURSING_CARE', time: '08:00', title: 'Cord Care', titleAr: 'العناية بالسرة', isRecurring: true, recurrenceRule: 'Q8H', priority: 'ROUTINE', taskData: { type: 'cord_care' } },
    { category: 'NURSING_CARE', time: '16:00', title: 'Cord Care', titleAr: 'العناية بالسرة', isRecurring: true, recurrenceRule: 'Q8H', priority: 'ROUTINE', taskData: { type: 'cord_care' } },
    { category: 'NURSING_CARE', time: '00:00', title: 'Cord Care', titleAr: 'العناية بالسرة', isRecurring: true, recurrenceRule: 'Q8H', priority: 'ROUTINE', taskData: { type: 'cord_care' } },

    // Eye care q8h
    { category: 'NURSING_CARE', time: '08:00', title: 'Eye Care', titleAr: 'العناية بالعين', isRecurring: true, recurrenceRule: 'Q8H', priority: 'ROUTINE', taskData: { type: 'eye_care' } },
    { category: 'NURSING_CARE', time: '16:00', title: 'Eye Care', titleAr: 'العناية بالعين', isRecurring: true, recurrenceRule: 'Q8H', priority: 'ROUTINE', taskData: { type: 'eye_care' } },

    // Feeding log q2-3h
    ...generateRecurringTasks('Q3H', {
      category: 'DIET', title: 'Feeding', titleAr: 'رضاعة',
      taskData: { type: 'feeding', options: ['Breastfeed', 'Formula', 'Mixed'] },
    }),

    // Diaper check
    ...generateRecurringTasks('Q3H', {
      category: 'IO', title: 'Diaper Check & Output', titleAr: 'فحص الحفاض والإخراج',
      taskData: { type: 'OUTPUT', source: 'Diaper', options: ['Wet', 'Stool', 'Both', 'Dry'] },
    }),

    // Vaccination check
    { category: 'PROCEDURE', time: '10:00', title: 'Vaccination Check', titleAr: 'فحص التطعيمات', isRecurring: false, priority: 'ROUTINE', taskData: { type: 'vaccination' } },

    // Weight
    { category: 'ASSESSMENT', time: '07:00', title: 'Daily Weight', titleAr: 'الوزن اليومي', isRecurring: false, priority: 'ROUTINE', taskData: { type: 'weight' } },

    // Bilirubin check
    { category: 'ASSESSMENT', time: '08:00', title: 'Jaundice Assessment', titleAr: 'تقييم اليرقان', isRecurring: false, priority: 'ROUTINE', taskData: { type: 'jaundice_check' } },

    // Meals
    { category: 'DIET', time: '08:00', title: 'Breakfast (Mother)', titleAr: 'فطور (الأم)', isRecurring: false, priority: 'ROUTINE' },
    { category: 'DIET', time: '12:30', title: 'Lunch (Mother)', titleAr: 'غداء (الأم)', isRecurring: false, priority: 'ROUTINE' },
    { category: 'DIET', time: '18:00', title: 'Dinner (Mother)', titleAr: 'عشاء (الأم)', isRecurring: false, priority: 'ROUTINE' },
  ];
}

// =============================================================================
// NICU Path Template
// =============================================================================
export function getNICUPathTasks(): TemplateTask[] {
  return [
    // Vitals q1-2h (intensive)
    ...generateRecurringTasks('Q2H', {
      category: 'VITALS', title: 'NICU Vitals (Q2H)', titleAr: 'علامات حيوية NICU (كل ٢ ساعات)',
      taskData: { frequency: 'Q2H', parameters: ['Temp', 'HR', 'RR', 'SpO2', 'FiO2', 'MAP'] },
    }),

    // Weight
    { category: 'ASSESSMENT', time: '06:00', title: 'Daily Weight', titleAr: 'الوزن اليومي', isRecurring: false, priority: 'ROUTINE' },

    // Respiratory assessment
    ...generateRecurringTasks('Q4H', {
      category: 'ASSESSMENT', title: 'Respiratory Assessment', titleAr: 'تقييم التنفس',
      taskData: { type: 'respiratory', parameters: ['Mode', 'FiO2', 'PEEP', 'RR', 'Work of breathing'] },
    }),

    // Feeding/TPN
    ...generateRecurringTasks('Q3H', {
      category: 'DIET', title: 'Feeding / TPN Check', titleAr: 'تغذية / TPN',
      taskData: { type: 'nicu_feeding', options: ['TPN', 'NGT', 'OGT', 'Breast milk', 'Formula'] },
    }),

    // I/O strict monitoring
    ...generateRecurringTasks('Q4H', {
      category: 'IO', title: 'I/O Balance Check', titleAr: 'ميزان السوائل',
      taskData: { type: 'INTAKE' },
    }),

    // Lines & catheters check
    ...generateRecurringTasks('Q8H', {
      category: 'NURSING_CARE', title: 'Lines & Catheters Check', titleAr: 'فحص القسطرات والخطوط',
      taskData: { type: 'lines_check' },
    }),

    // Skin assessment
    { category: 'ASSESSMENT', time: '08:00', title: 'Skin Integrity Assessment', titleAr: 'تقييم سلامة الجلد', isRecurring: false, priority: 'ROUTINE' },

    // Pain score
    ...generateRecurringTasks('Q4H', {
      category: 'ASSESSMENT', title: 'Pain Score (NIPS/N-PASS)', titleAr: 'تقييم الألم (NIPS/N-PASS)',
      taskData: { type: 'pain_neonatal' },
    }),

    // Incubator temperature
    ...generateRecurringTasks('Q4H', {
      category: 'NURSING_CARE', title: 'Incubator Temperature Check', titleAr: 'فحص حرارة الحاضنة',
      taskData: { type: 'incubator_temp' },
    }),
  ];
}

// =============================================================================
// Critical Care Path (ICU/CCU/PICU)
// =============================================================================
export function getCriticalCarePathTasks(): TemplateTask[] {
  return [
    // Vitals q1h
    ...generateRecurringTasks('Q1H', {
      category: 'VITALS', title: 'ICU Vitals (Hourly)', titleAr: 'علامات حيوية العناية المركزة (كل ساعة)',
      taskData: { frequency: 'Q1H', parameters: ['BP', 'HR', 'RR', 'Temp', 'SpO2', 'MAP', 'CVP', 'EtCO2'] },
    }),

    // Neurological assessment
    ...generateRecurringTasks('Q2H', {
      category: 'ASSESSMENT', title: 'Neurological Assessment (GCS)', titleAr: 'تقييم عصبي (GCS)',
      taskData: { type: 'gcs' },
    }),

    // Ventilator check
    ...generateRecurringTasks('Q2H', {
      category: 'ASSESSMENT', title: 'Ventilator Settings Check', titleAr: 'فحص إعدادات جهاز التنفس',
      taskData: { type: 'ventilator', parameters: ['Mode', 'FiO2', 'PEEP', 'TV', 'RR', 'PIP'] },
    }),

    // Sedation score
    ...generateRecurringTasks('Q2H', {
      category: 'ASSESSMENT', title: 'Sedation Score (RASS)', titleAr: 'تقييم التخدير (RASS)',
      taskData: { type: 'rass' },
    }),

    // I/O strict
    ...generateRecurringTasks('Q1H', {
      category: 'IO', title: 'Strict I/O', titleAr: 'سوائل دقيقة',
      taskData: { type: 'INTAKE' },
    }),

    // Drip titration check
    ...generateRecurringTasks('Q2H', {
      category: 'NURSING_CARE', title: 'Infusion/Drip Titration', titleAr: 'معايرة المحاليل الوريدية',
      taskData: { type: 'drip_titration' },
    }),

    // Lines, tubes, drains
    ...generateRecurringTasks('Q8H', {
      category: 'NURSING_CARE', title: 'Lines, Tubes & Drains Check', titleAr: 'فحص القسطرات والأنابيب',
      taskData: { type: 'lines_check' },
    }),

    // Skin & pressure injury
    ...generateRecurringTasks('Q8H', {
      category: 'ASSESSMENT', title: 'Skin & Pressure Injury Check', titleAr: 'فحص الجلد وقرح الضغط',
      taskData: { type: 'braden' },
    }),

    // Blood sugar
    ...generateRecurringTasks('Q6H', {
      category: 'LAB', title: 'Blood Glucose Check', titleAr: 'فحص سكر الدم',
      taskData: { type: 'glucose' },
    }),

    // Meals / nutrition
    { category: 'DIET', time: '08:00', title: 'Nutrition Check (TPN/Enteral/Oral)', titleAr: 'تغذية (TPN/معوية/فموية)', isRecurring: false, priority: 'ROUTINE' },
    { category: 'DIET', time: '12:30', title: 'Nutrition Check', titleAr: 'فحص التغذية', isRecurring: false, priority: 'ROUTINE' },
    { category: 'DIET', time: '18:00', title: 'Nutrition Check', titleAr: 'فحص التغذية', isRecurring: false, priority: 'ROUTINE' },

    // Fall risk & safety
    { category: 'INSTRUCTION', time: '07:30', title: 'Fall Risk & Safety Check', titleAr: 'فحص خطر السقوط والسلامة', isRecurring: false, priority: 'ROUTINE' },
  ];
}

// =============================================================================
// Labor & Delivery Path
// =============================================================================
export function getLDRPathTasks(): TemplateTask[] {
  return [
    // Maternal vitals q2h
    ...generateRecurringTasks('Q2H', {
      category: 'VITALS', title: 'Maternal Vitals (Q2H)', titleAr: 'علامات الأم الحيوية (كل ٢ ساعات)',
      taskData: { frequency: 'Q2H', parameters: ['BP', 'HR', 'Temp', 'SpO2'] },
    }),

    // Fetal heart rate q30min to q1h
    ...generateRecurringTasks('Q1H', {
      category: 'ASSESSMENT', title: 'Fetal Heart Rate', titleAr: 'نبض الجنين',
      taskData: { type: 'fhr', parameters: ['FHR', 'Variability', 'Decelerations'] },
    }),

    // Contraction monitoring
    ...generateRecurringTasks('Q1H', {
      category: 'ASSESSMENT', title: 'Contraction Assessment', titleAr: 'تقييم الطلق',
      taskData: { type: 'contractions', parameters: ['Frequency', 'Duration', 'Intensity'] },
    }),

    // Cervical check (less frequent, ordered)
    { category: 'ASSESSMENT', time: '08:00', title: 'Cervical Exam', titleAr: 'فحص عنق الرحم', isRecurring: false, priority: 'ROUTINE', taskData: { type: 'cervical_check', parameters: ['Dilation', 'Effacement', 'Station'] } },

    // I/O
    ...generateRecurringTasks('Q4H', {
      category: 'IO', title: 'Fluid Balance', titleAr: 'ميزان السوائل',
      taskData: { type: 'INTAKE' },
    }),

    // Pain assessment (epidural/no epidural)
    ...generateRecurringTasks('Q2H', {
      category: 'ASSESSMENT', title: 'Pain Assessment', titleAr: 'تقييم الألم',
      taskData: { type: 'pain_labor' },
    }),

    // Epidural check (if applicable)
    ...generateRecurringTasks('Q4H', {
      category: 'NURSING_CARE', title: 'Epidural Site Check', titleAr: 'فحص موقع الإيبيدورال',
      taskData: { type: 'epidural_check' },
    }),

    // Fall precaution
    { category: 'INSTRUCTION', time: '07:30', title: 'Fall Precaution (Epidural/Preeclampsia)', titleAr: 'الحذر من السقوط (إيبيدورال/تسمم حمل)', isRecurring: false, priority: 'ROUTINE' },

    // Meals (if allowed)
    { category: 'DIET', time: '08:00', title: 'Clear Liquids / Ice Chips', titleAr: 'سوائل شفافة / ثلج', isRecurring: false, priority: 'ROUTINE' },
    { category: 'DIET', time: '12:30', title: 'Clear Liquids / Light', titleAr: 'سوائل شفافة / خفيف', isRecurring: false, priority: 'ROUTINE' },
  ];
}

// =============================================================================
// Helper: Generate recurring tasks from frequency
// =============================================================================
function generateRecurringTasks(freq: string, base: {
  category: TaskCategory;
  title: string;
  titleAr: string;
  taskData?: Record<string, unknown>;
}): TemplateTask[] {
  const freqToHours: Record<string, number> = {
    Q1H: 1, Q2H: 2, Q3H: 3, Q4H: 4, Q6H: 6, Q8H: 8, Q12H: 12,
  };

  const hours = freqToHours[freq];
  if (!hours) return [];

  const tasks: TemplateTask[] = [];
  for (let h = 0; h < 24; h += hours) {
    tasks.push({
      ...base,
      time: `${String(h).padStart(2, '0')}:00`,
      isRecurring: true,
      recurrenceRule: freq,
      priority: 'ROUTINE',
    });
  }
  return tasks;
}
