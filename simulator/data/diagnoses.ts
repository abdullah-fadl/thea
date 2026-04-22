export interface Diagnosis {
  code: string;
  en: string;
  ar: string;
}

export const ICD10_COMMON: Diagnosis[] = [
  { code: 'J06.9', en: 'Acute upper respiratory infection', ar: 'التهاب الجهاز التنفسي العلوي الحاد' },
  { code: 'I10', en: 'Essential hypertension', ar: 'ارتفاع ضغط الدم الأساسي' },
  { code: 'E11.9', en: 'Type 2 diabetes mellitus', ar: 'داء السكري النوع الثاني' },
  { code: 'M54.5', en: 'Low back pain', ar: 'ألم أسفل الظهر' },
  { code: 'K21.0', en: 'Gastroesophageal reflux disease', ar: 'ارتجاع المريء' },
  { code: 'J18.9', en: 'Pneumonia, unspecified', ar: 'التهاب رئوي غير محدد' },
  { code: 'N39.0', en: 'Urinary tract infection', ar: 'التهاب المسالك البولية' },
  { code: 'I20.9', en: 'Angina pectoris', ar: 'ذبحة صدرية' },
  { code: 'S52.5', en: 'Fracture of lower end of radius', ar: 'كسر نهاية عظم الكعبرة' },
  { code: 'K35.8', en: 'Acute appendicitis', ar: 'التهاب الزائدة الدودية الحاد' },
  { code: 'J45.9', en: 'Asthma, unspecified', ar: 'ربو غير محدد' },
  { code: 'R10.4', en: 'Abdominal pain, unspecified', ar: 'ألم بطني غير محدد' },
  { code: 'R51', en: 'Headache', ar: 'صداع' },
  { code: 'J20.9', en: 'Acute bronchitis', ar: 'التهاب قصبات حاد' },
  { code: 'K29.7', en: 'Gastritis, unspecified', ar: 'التهاب المعدة' },
  { code: 'L30.9', en: 'Dermatitis, unspecified', ar: 'التهاب جلدي' },
  { code: 'M79.3', en: 'Myalgia', ar: 'ألم عضلي' },
  { code: 'R50.9', en: 'Fever, unspecified', ar: 'حمى غير محددة' },
  { code: 'H10.9', en: 'Conjunctivitis', ar: 'التهاب الملتحمة' },
  { code: 'B34.9', en: 'Viral infection, unspecified', ar: 'عدوى فيروسية' },
  { code: 'E78.5', en: 'Hyperlipidemia', ar: 'ارتفاع الدهون في الدم' },
  { code: 'G43.9', en: 'Migraine, unspecified', ar: 'صداع نصفي' },
  { code: 'F41.9', en: 'Anxiety disorder', ar: 'اضطراب القلق' },
  { code: 'K80.2', en: 'Gallbladder calculus', ar: 'حصوات المرارة' },
  { code: 'I25.1', en: 'Atherosclerotic heart disease', ar: 'مرض القلب التصلبي' },
  { code: 'J44.1', en: 'COPD with acute exacerbation', ar: 'انسداد رئوي مزمن مع تفاقم حاد' },
  { code: 'N20.0', en: 'Calculus of kidney', ar: 'حصوات الكلى' },
  { code: 'S72.0', en: 'Fracture of neck of femur', ar: 'كسر عنق الفخذ' },
  { code: 'I63.9', en: 'Cerebral infarction', ar: 'احتشاء دماغي' },
  { code: 'D50.9', en: 'Iron deficiency anemia', ar: 'فقر الدم بعوز الحديد' },
];

export class DiagnosisGenerator {
  random(): Diagnosis {
    return ICD10_COMMON[Math.floor(Math.random() * ICD10_COMMON.length)];
  }

  randomN(n: number): Diagnosis[] {
    const shuffled = [...ICD10_COMMON].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(n, shuffled.length));
  }
}
