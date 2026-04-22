/**
 * Saudi MOH Drug Formulary — Drug Data Part 14
 * Vaccines & Immunoglobulins
 * IDs: FRM-0760 through FRM-0799
 */
import type { FormularyDrug } from './formularyTypes';

export const VACCINES_IMMUNOGLOBULINS: FormularyDrug[] = [
  // ─── Saudi MOH Mandatory Vaccines (10) ───
  {
    id: 'FRM-0760', genericName: 'BCG Vaccine (Bacillus Calmette-Guérin)', genericNameAr: 'لقاح بي سي جي (عصية كالميت غيران)', brandNames: ['BCG Vaccine SSI', 'BCG-TICE'],
    sfda_registration: 'SFDA-BCG-760', atcCode: 'J07AN01', atcCategory: 'Vaccines — Mycobacterial',
    therapeuticClass: 'Live Attenuated Bacterial Vaccine', therapeuticClassAr: 'لقاح بكتيري حي مُضعف',
    formularyStatus: 'formulary',
    route: ['intradermal'], forms: [{ form: 'Powder for injection', strength: '0.05 mg/0.1 mL', unitPrice: 12.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'X', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['BCG intravesical'],
    interactions: [
      { interactsWith: 'Immunosuppressants', severity: 'major', mechanism: 'Impaired immune response to live vaccine', clinicalEffect: 'Risk of disseminated BCG infection', clinicalEffectAr: 'خطر عدوى بي سي جي منتشرة', management: 'Contraindicated in immunosuppressed patients', managementAr: 'ممنوع في المرضى مثبطي المناعة' }
    ],
    contraindications: ['Immunodeficiency', 'HIV positive', 'Active tuberculosis', 'Pregnancy'],
    contraindicationsAr: ['نقص المناعة', 'إيجابية فيروس نقص المناعة', 'سل نشط', 'الحمل'],
    monitoringRequired: ['Injection site reaction', 'Scar formation'], storageConditions: 'Store at 2-8°C, protect from light. Use within 4 hours of reconstitution.'
  },
  {
    id: 'FRM-0761', genericName: 'Hepatitis B Vaccine (Recombinant)', genericNameAr: 'لقاح التهاب الكبد ب (مؤتلف)', brandNames: ['Engerix-B', 'Recombivax HB', 'Heplisav-B'],
    sfda_registration: 'SFDA-HEPB-761', atcCode: 'J07BC01', atcCategory: 'Vaccines — Hepatitis',
    therapeuticClass: 'Recombinant Viral Vaccine', therapeuticClassAr: 'لقاح فيروسي مؤتلف',
    formularyStatus: 'formulary',
    route: ['intramuscular'], forms: [
      { form: 'Suspension for injection', strength: '10 mcg/0.5 mL (pediatric)', unitPrice: 35.00, inStock: true },
      { form: 'Suspension for injection', strength: '20 mcg/1 mL (adult)', unitPrice: 45.00, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'B', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Hepatitis A Vaccine'],
    interactions: [
      { interactsWith: 'Immunosuppressants', severity: 'moderate', mechanism: 'Reduced antibody response', clinicalEffect: 'Decreased vaccine efficacy', clinicalEffectAr: 'انخفاض فعالية اللقاح', management: 'May require additional doses or titer check', managementAr: 'قد يحتاج جرعات إضافية أو فحص مستوى الأجسام المضادة' }
    ],
    contraindications: ['Severe allergic reaction to previous dose', 'Yeast hypersensitivity'],
    contraindicationsAr: ['رد فعل تحسسي شديد لجرعة سابقة', 'فرط حساسية للخميرة'],
    monitoringRequired: ['Anti-HBs titer post-vaccination in high-risk groups'], storageConditions: 'Store at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0762', genericName: 'Polio Vaccine (IPV — Inactivated)', genericNameAr: 'لقاح شلل الأطفال المعطل', brandNames: ['IPOL', 'Imovax Polio'],
    sfda_registration: 'SFDA-IPV-762', atcCode: 'J07BF03', atcCategory: 'Vaccines — Poliomyelitis',
    therapeuticClass: 'Inactivated Viral Vaccine', therapeuticClassAr: 'لقاح فيروسي معطل',
    formularyStatus: 'formulary',
    route: ['intramuscular', 'subcutaneous'], forms: [{ form: 'Suspension for injection', strength: '0.5 mL', unitPrice: 40.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['OPV (Oral Polio Vaccine)'],
    interactions: [
      { interactsWith: 'Immunosuppressants', severity: 'moderate', mechanism: 'Reduced immune response', clinicalEffect: 'Lower seroconversion rate', clinicalEffectAr: 'معدل تحول مصلي أقل', management: 'Check antibody titers post-series', managementAr: 'فحص مستوى الأجسام المضادة بعد السلسلة' }
    ],
    contraindications: ['Severe allergic reaction to neomycin, streptomycin, or polymyxin B', 'Anaphylaxis to previous dose'],
    contraindicationsAr: ['حساسية شديدة للنيومايسين أو الستربتومايسين أو البوليميكسين ب', 'حساسية مفرطة لجرعة سابقة'],
    monitoringRequired: ['Injection site reactions'], storageConditions: 'Store at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0763', genericName: 'DTaP Vaccine (Diphtheria, Tetanus, Acellular Pertussis)', genericNameAr: 'لقاح الخناق والكزاز والسعال الديكي اللاخلوي', brandNames: ['Infanrix', 'Daptacel', 'Pentacel'],
    sfda_registration: 'SFDA-DTAP-763', atcCode: 'J07CA02', atcCategory: 'Vaccines — Bacterial & Viral Combinations',
    therapeuticClass: 'Combination Inactivated Vaccine', therapeuticClassAr: 'لقاح مركب معطل',
    formularyStatus: 'formulary',
    route: ['intramuscular'], forms: [{ form: 'Suspension for injection', strength: '0.5 mL', unitPrice: 55.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Tdap', 'DT', 'Td'],
    interactions: [
      { interactsWith: 'Anticoagulants', severity: 'moderate', mechanism: 'Risk of hematoma at injection site', clinicalEffect: 'Bleeding at injection site', clinicalEffectAr: 'نزيف في موضع الحقن', management: 'Apply firm pressure for 2 minutes post-injection', managementAr: 'ضغط قوي لمدة دقيقتين بعد الحقن' }
    ],
    contraindications: ['Encephalopathy within 7 days of previous dose', 'Progressive neurological disorder', 'Severe allergic reaction to previous dose'],
    contraindicationsAr: ['اعتلال دماغي خلال 7 أيام من جرعة سابقة', 'اضطراب عصبي تدريجي', 'رد فعل تحسسي شديد لجرعة سابقة'],
    monitoringRequired: ['Temperature monitoring 48h post-vaccination', 'Neurological symptoms'], storageConditions: 'Store at 2-8°C. Do not freeze. Shake well before use.'
  },
  {
    id: 'FRM-0764', genericName: 'Haemophilus influenzae type b Vaccine (Hib)', genericNameAr: 'لقاح المستدمية النزلية النوع ب', brandNames: ['ActHIB', 'Hiberix', 'PedvaxHIB'],
    sfda_registration: 'SFDA-HIB-764', atcCode: 'J07AG01', atcCategory: 'Vaccines — Haemophilus influenzae',
    therapeuticClass: 'Conjugate Bacterial Vaccine', therapeuticClassAr: 'لقاح بكتيري مقترن',
    formularyStatus: 'formulary',
    route: ['intramuscular'], forms: [{ form: 'Powder for injection', strength: '10 mcg/0.5 mL', unitPrice: 42.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: [],
    interactions: [
      { interactsWith: 'Immunosuppressive therapy', severity: 'moderate', mechanism: 'Blunted immune response', clinicalEffect: 'Suboptimal antibody production', clinicalEffectAr: 'إنتاج أجسام مضادة دون المستوى الأمثل', management: 'Defer vaccination if possible until immunosuppression resolved', managementAr: 'تأجيل التطعيم إن أمكن حتى زوال تثبيط المناعة' }
    ],
    contraindications: ['Age < 6 weeks', 'Severe allergic reaction to previous dose'],
    contraindicationsAr: ['العمر أقل من 6 أسابيع', 'رد فعل تحسسي شديد لجرعة سابقة'],
    monitoringRequired: ['Injection site reactions'], storageConditions: 'Store at 2-8°C. Do not freeze. Use within 24 hours of reconstitution.'
  },
  {
    id: 'FRM-0765', genericName: 'Pneumococcal Conjugate Vaccine (PCV13)', genericNameAr: 'لقاح المكورات الرئوية المقترن (13 تكافؤ)', brandNames: ['Prevnar 13', 'Prevenar 13'],
    sfda_registration: 'SFDA-PCV13-765', atcCode: 'J07AL02', atcCategory: 'Vaccines — Pneumococcal',
    therapeuticClass: 'Conjugate Bacterial Vaccine', therapeuticClassAr: 'لقاح بكتيري مقترن',
    formularyStatus: 'formulary',
    route: ['intramuscular'], forms: [{ form: 'Suspension for injection', strength: '0.5 mL', unitPrice: 180.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'B', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['PPSV23'],
    interactions: [
      { interactsWith: 'Antipyretics (prophylactic)', severity: 'minor', mechanism: 'May reduce immune response when given prophylactically', clinicalEffect: 'Potentially lower antibody titers', clinicalEffectAr: 'احتمال انخفاض مستوى الأجسام المضادة', management: 'Avoid prophylactic antipyretics; use only for fever', managementAr: 'تجنب خافضات الحرارة الوقائية؛ استخدامها فقط عند الحمى' }
    ],
    contraindications: ['Severe allergic reaction to previous dose or diphtheria toxoid'],
    contraindicationsAr: ['رد فعل تحسسي شديد لجرعة سابقة أو لذوفان الخناق'],
    monitoringRequired: ['Fever', 'Injection site reactions'], storageConditions: 'Store at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0766', genericName: 'Rotavirus Vaccine (Live, Oral)', genericNameAr: 'لقاح فيروس الروتا (حي، فموي)', brandNames: ['Rotarix', 'RotaTeq'],
    sfda_registration: 'SFDA-ROTA-766', atcCode: 'J07BH01', atcCategory: 'Vaccines — Rotavirus',
    therapeuticClass: 'Live Attenuated Viral Vaccine', therapeuticClassAr: 'لقاح فيروسي حي مُضعف',
    formularyStatus: 'formulary',
    route: ['oral'], forms: [
      { form: 'Oral suspension', strength: '1 mL (Rotarix)', unitPrice: 120.00, inStock: true },
      { form: 'Oral solution', strength: '2 mL (RotaTeq)', unitPrice: 130.00, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'X', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: [],
    interactions: [
      { interactsWith: 'Immunosuppressants', severity: 'major', mechanism: 'Risk of vaccine-strain viral shedding and disease', clinicalEffect: 'Disseminated vaccine virus infection', clinicalEffectAr: 'عدوى فيروس اللقاح المنتشرة', management: 'Contraindicated in immunocompromised infants', managementAr: 'ممنوع في الرضع مثبطي المناعة' }
    ],
    contraindications: ['SCID', 'History of intussusception', 'Immunodeficiency', 'Age > 8 months (first dose)'],
    contraindicationsAr: ['نقص المناعة المشترك الشديد', 'تاريخ انغلاف معوي', 'نقص المناعة', 'العمر أكبر من 8 أشهر (الجرعة الأولى)'],
    monitoringRequired: ['Signs of intussusception within 7 days', 'Vomiting', 'Diarrhea'], storageConditions: 'Store at 2-8°C. Do not freeze. Protect from light.'
  },
  {
    id: 'FRM-0767', genericName: 'MMR Vaccine (Measles, Mumps, Rubella)', genericNameAr: 'لقاح الحصبة والنكاف والحصبة الألمانية', brandNames: ['M-M-R II', 'Priorix'],
    sfda_registration: 'SFDA-MMR-767', atcCode: 'J07BD52', atcCategory: 'Vaccines — Measles Combinations',
    therapeuticClass: 'Live Attenuated Viral Vaccine', therapeuticClassAr: 'لقاح فيروسي حي مُضعف',
    formularyStatus: 'formulary',
    route: ['subcutaneous'], forms: [{ form: 'Powder for injection', strength: '0.5 mL', unitPrice: 65.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'X', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['MMRV'],
    interactions: [
      { interactsWith: 'Immunoglobulins', severity: 'major', mechanism: 'Passive antibodies neutralize live vaccine virus', clinicalEffect: 'Vaccine failure', clinicalEffectAr: 'فشل اللقاح', management: 'Delay MMR 3-11 months after immunoglobulin depending on product/dose', managementAr: 'تأخير اللقاح 3-11 شهر بعد الغلوبيولين المناعي حسب المنتج والجرعة' },
      { interactsWith: 'Immunosuppressants', severity: 'major', mechanism: 'Risk of disseminated vaccine infection', clinicalEffect: 'Severe vaccine-related illness', clinicalEffectAr: 'مرض شديد مرتبط باللقاح', management: 'Contraindicated during immunosuppression', managementAr: 'ممنوع أثناء تثبيط المناعة' }
    ],
    contraindications: ['Pregnancy', 'Severe immunodeficiency', 'Neomycin/gelatin allergy', 'Active untreated TB'],
    contraindicationsAr: ['الحمل', 'نقص مناعة شديد', 'حساسية للنيومايسين/الجيلاتين', 'سل نشط غير معالج'],
    monitoringRequired: ['Fever 7-12 days post-vaccination', 'Rash', 'Joint symptoms'], storageConditions: 'Store at 2-8°C or colder. Protect from light. Use within 8 hours of reconstitution.'
  },
  {
    id: 'FRM-0768', genericName: 'Varicella Vaccine (Live)', genericNameAr: 'لقاح جدري الماء (حي)', brandNames: ['Varivax', 'Varilrix'],
    sfda_registration: 'SFDA-VAR-768', atcCode: 'J07BK01', atcCategory: 'Vaccines — Varicella-Zoster',
    therapeuticClass: 'Live Attenuated Viral Vaccine', therapeuticClassAr: 'لقاح فيروسي حي مُضعف',
    formularyStatus: 'formulary',
    route: ['subcutaneous'], forms: [{ form: 'Powder for injection', strength: '1350 PFU/0.5 mL', unitPrice: 85.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'X', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Zoster vaccine'],
    interactions: [
      { interactsWith: 'Immunoglobulins', severity: 'major', mechanism: 'Passive antibodies neutralize vaccine virus', clinicalEffect: 'Reduced vaccine efficacy', clinicalEffectAr: 'انخفاض فعالية اللقاح', management: 'Delay vaccine 5 months after immunoglobulin', managementAr: 'تأخير اللقاح 5 أشهر بعد الغلوبيولين المناعي' },
      { interactsWith: 'Salicylates', severity: 'moderate', mechanism: 'Theoretical risk of Reye syndrome', clinicalEffect: 'Reye syndrome risk in children', clinicalEffectAr: 'خطر متلازمة راي عند الأطفال', management: 'Avoid salicylates for 6 weeks post-vaccination', managementAr: 'تجنب الساليسيلات لمدة 6 أسابيع بعد التطعيم' }
    ],
    contraindications: ['Pregnancy', 'Severe immunodeficiency', 'Active untreated TB', 'Neomycin/gelatin allergy'],
    contraindicationsAr: ['الحمل', 'نقص مناعة شديد', 'سل نشط غير معالج', 'حساسية للنيومايسين/الجيلاتين'],
    monitoringRequired: ['Varicella-like rash 2-4 weeks post-vaccination', 'Fever'], storageConditions: 'Store frozen at -15°C or colder. May store at 2-8°C for up to 72 hours before use.'
  },
  {
    id: 'FRM-0769', genericName: 'Hepatitis A Vaccine (Inactivated)', genericNameAr: 'لقاح التهاب الكبد أ (معطل)', brandNames: ['Havrix', 'Vaqta', 'Avaxim'],
    sfda_registration: 'SFDA-HEPA-769', atcCode: 'J07BC02', atcCategory: 'Vaccines — Hepatitis',
    therapeuticClass: 'Inactivated Viral Vaccine', therapeuticClassAr: 'لقاح فيروسي معطل',
    formularyStatus: 'formulary',
    route: ['intramuscular'], forms: [
      { form: 'Suspension for injection', strength: '720 EU/0.5 mL (pediatric)', unitPrice: 60.00, inStock: true },
      { form: 'Suspension for injection', strength: '1440 EU/1 mL (adult)', unitPrice: 80.00, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'B', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Hepatitis B Vaccine'],
    interactions: [
      { interactsWith: 'Immunosuppressants', severity: 'moderate', mechanism: 'Reduced antibody response', clinicalEffect: 'Decreased vaccine efficacy', clinicalEffectAr: 'انخفاض فعالية اللقاح', management: 'Check anti-HAV titers if immunosuppressed', managementAr: 'فحص أجسام مضادة للكبد أ إذا كان المريض مثبط المناعة' }
    ],
    contraindications: ['Severe allergic reaction to previous dose', 'Neomycin hypersensitivity'],
    contraindicationsAr: ['رد فعل تحسسي شديد لجرعة سابقة', 'فرط حساسية للنيومايسين'],
    monitoringRequired: ['Injection site reactions', 'Anti-HAV seroconversion in high-risk'], storageConditions: 'Store at 2-8°C. Do not freeze.'
  },

  // ─── Hajj/Umrah Required Vaccines (4) ───
  {
    id: 'FRM-0770', genericName: 'Meningococcal ACWY Conjugate Vaccine', genericNameAr: 'لقاح المكورات السحائية أ س و ي المقترن', brandNames: ['Menactra', 'Menveo', 'Nimenrix'],
    sfda_registration: 'SFDA-MENACWY-770', atcCode: 'J07AH08', atcCategory: 'Vaccines — Meningococcal',
    therapeuticClass: 'Conjugate Bacterial Vaccine', therapeuticClassAr: 'لقاح بكتيري مقترن',
    formularyStatus: 'formulary',
    route: ['intramuscular'], forms: [{ form: 'Solution for injection', strength: '0.5 mL', unitPrice: 200.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'B', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Meningococcal B Vaccine'],
    blackBoxWarning: 'Mandatory for all Hajj/Umrah pilgrims per Saudi MOH regulations',
    blackBoxWarningAr: 'إلزامي لجميع حجاج العمرة والحج وفقاً لأنظمة وزارة الصحة السعودية',
    interactions: [
      { interactsWith: 'Anticoagulants', severity: 'moderate', mechanism: 'IM injection risk of hematoma', clinicalEffect: 'Injection site bleeding', clinicalEffectAr: 'نزيف في موضع الحقن', management: 'Apply pressure; use SC route if available', managementAr: 'الضغط على الموضع؛ استخدام الحقن تحت الجلد إن توفر' }
    ],
    contraindications: ['Severe allergic reaction to previous dose or vaccine component'],
    contraindicationsAr: ['رد فعل تحسسي شديد لجرعة سابقة أو مكون اللقاح'],
    monitoringRequired: ['Injection site reactions', 'Syncope observation 15 min post-vaccination'], storageConditions: 'Store at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0771', genericName: 'Meningococcal B Vaccine (Recombinant)', genericNameAr: 'لقاح المكورات السحائية ب (مؤتلف)', brandNames: ['Bexsero', 'Trumenba'],
    sfda_registration: 'SFDA-MENB-771', atcCode: 'J07AH09', atcCategory: 'Vaccines — Meningococcal',
    therapeuticClass: 'Recombinant Bacterial Vaccine', therapeuticClassAr: 'لقاح بكتيري مؤتلف',
    formularyStatus: 'formulary',
    route: ['intramuscular'], forms: [{ form: 'Suspension for injection', strength: '0.5 mL', unitPrice: 350.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'B', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Meningococcal ACWY Vaccine'],
    interactions: [
      { interactsWith: 'Antipyretics (prophylactic)', severity: 'minor', mechanism: 'Potential reduction in immune response', clinicalEffect: 'Slightly lower antibody response', clinicalEffectAr: 'انخفاض طفيف في استجابة الأجسام المضادة', management: 'Use antipyretics only for treatment of fever, not prophylaxis', managementAr: 'استخدام خافضات الحرارة للعلاج فقط وليس وقائياً' }
    ],
    contraindications: ['Severe allergic reaction to previous dose'],
    contraindicationsAr: ['رد فعل تحسسي شديد لجرعة سابقة'],
    monitoringRequired: ['High fever in infants', 'Injection site reactions'], storageConditions: 'Store at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0772', genericName: 'Influenza Vaccine (Inactivated, Quadrivalent)', genericNameAr: 'لقاح الإنفلونزا (معطل، رباعي التكافؤ)', brandNames: ['Fluarix Quadrivalent', 'Fluzone', 'Vaxigrip Tetra'],
    sfda_registration: 'SFDA-FLU-772', atcCode: 'J07BB02', atcCategory: 'Vaccines — Influenza',
    therapeuticClass: 'Inactivated Viral Vaccine', therapeuticClassAr: 'لقاح فيروسي معطل',
    formularyStatus: 'formulary',
    route: ['intramuscular'], forms: [
      { form: 'Suspension for injection', strength: '0.25 mL (pediatric)', unitPrice: 45.00, inStock: true },
      { form: 'Suspension for injection', strength: '0.5 mL (adult)', unitPrice: 55.00, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'B', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['LAIV (live influenza vaccine)'],
    interactions: [
      { interactsWith: 'Warfarin', severity: 'moderate', mechanism: 'Transient increase in INR reported', clinicalEffect: 'Temporarily elevated bleeding risk', clinicalEffectAr: 'ارتفاع مؤقت في خطر النزيف', management: 'Monitor INR 1-2 weeks post-vaccination', managementAr: 'مراقبة INR لمدة 1-2 أسبوع بعد التطعيم' }
    ],
    contraindications: ['Severe egg allergy (with caution)', 'Severe allergic reaction to previous influenza vaccine', 'Guillain-Barré syndrome within 6 weeks of prior dose'],
    contraindicationsAr: ['حساسية شديدة للبيض (بحذر)', 'رد فعل تحسسي شديد لجرعة إنفلونزا سابقة', 'متلازمة غيلان-باريه خلال 6 أسابيع من جرعة سابقة'],
    monitoringRequired: ['Egg-allergic patients: observe 30 min', 'GBS history'], storageConditions: 'Store at 2-8°C. Do not freeze. Seasonal supply — check expiry.'
  },
  {
    id: 'FRM-0773', genericName: 'COVID-19 mRNA Vaccine', genericNameAr: 'لقاح كوفيد-19 (الحمض النووي الريبوزي المرسال)', brandNames: ['Comirnaty (Pfizer-BioNTech)', 'Spikevax (Moderna)'],
    sfda_registration: 'SFDA-COVID-773', atcCode: 'J07BX03', atcCategory: 'Vaccines — Other Viral',
    therapeuticClass: 'mRNA Vaccine', therapeuticClassAr: 'لقاح الحمض النووي الريبوزي المرسال',
    formularyStatus: 'formulary',
    route: ['intramuscular'], forms: [
      { form: 'Concentrate for dispersion', strength: '30 mcg/0.3 mL (Pfizer)', unitPrice: 85.00, inStock: true },
      { form: 'Dispersion for injection', strength: '50 mcg/0.5 mL (Moderna)', unitPrice: 95.00, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: [],
    interactions: [
      { interactsWith: 'Immunosuppressants', severity: 'moderate', mechanism: 'Reduced vaccine immune response', clinicalEffect: 'Lower antibody titers', clinicalEffectAr: 'انخفاض مستوى الأجسام المضادة', management: 'Additional booster doses may be needed', managementAr: 'قد تكون هناك حاجة لجرعات تعزيزية إضافية' }
    ],
    contraindications: ['Severe allergic reaction to previous dose', 'Known allergy to PEG or polysorbate'],
    contraindicationsAr: ['رد فعل تحسسي شديد لجرعة سابقة', 'حساسية معروفة للبولي إيثيلين غليكول أو البولي سوربات'],
    monitoringRequired: ['Observe 15-30 min post-vaccination', 'Myocarditis symptoms in young males', 'Anaphylaxis preparedness'], storageConditions: 'Pfizer: -90°C to -60°C (ultra-cold); thawed 2-8°C up to 31 days. Moderna: -25°C to -15°C; thawed 2-8°C up to 30 days.'
  },

  // ─── Travel Vaccines (5) ───
  {
    id: 'FRM-0774', genericName: 'Typhoid Vaccine (Vi Polysaccharide)', genericNameAr: 'لقاح التيفوئيد (عديد السكاريد في آي)', brandNames: ['Typhim Vi', 'Typherix'],
    sfda_registration: 'SFDA-TYPH-774', atcCode: 'J07AP03', atcCategory: 'Vaccines — Typhoid',
    therapeuticClass: 'Polysaccharide Bacterial Vaccine', therapeuticClassAr: 'لقاح بكتيري عديد السكاريد',
    formularyStatus: 'formulary',
    route: ['intramuscular'], forms: [{ form: 'Solution for injection', strength: '25 mcg/0.5 mL', unitPrice: 55.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Typhoid oral vaccine (Ty21a)'],
    interactions: [
      { interactsWith: 'Antibiotics', severity: 'moderate', mechanism: 'May interfere with oral typhoid vaccine (not injectable)', clinicalEffect: 'No significant interaction with injectable form', clinicalEffectAr: 'لا تفاعل مهم مع الشكل القابل للحقن', management: 'No dose adjustment needed for injectable form', managementAr: 'لا حاجة لتعديل الجرعة للشكل القابل للحقن' }
    ],
    contraindications: ['Severe allergic reaction to previous dose'],
    contraindicationsAr: ['رد فعل تحسسي شديد لجرعة سابقة'],
    monitoringRequired: ['Injection site reactions', 'Revaccination every 3 years for ongoing risk'], storageConditions: 'Store at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0775', genericName: 'Yellow Fever Vaccine (Live)', genericNameAr: 'لقاح الحمى الصفراء (حي)', brandNames: ['YF-VAX', 'Stamaril'],
    sfda_registration: 'SFDA-YF-775', atcCode: 'J07BL01', atcCategory: 'Vaccines — Yellow Fever',
    therapeuticClass: 'Live Attenuated Viral Vaccine', therapeuticClassAr: 'لقاح فيروسي حي مُضعف',
    formularyStatus: 'restricted',
    restrictionCriteria: 'Only authorized WHO Yellow Fever vaccination centers', restrictionCriteriaAr: 'فقط في مراكز التطعيم المعتمدة من منظمة الصحة العالمية',
    approverRole: 'travel_medicine_specialist',
    route: ['subcutaneous'], forms: [{ form: 'Powder for injection', strength: '≥1000 IU/0.5 mL', unitPrice: 150.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'X', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: [],
    blackBoxWarning: 'Risk of vaccine-associated viscerotropic disease (YEL-AVD) and neurotropic disease (YEL-AND), especially in elderly and immunocompromised',
    blackBoxWarningAr: 'خطر المرض الحشوي والعصبي المرتبط باللقاح، خاصة في كبار السن ومثبطي المناعة',
    interactions: [
      { interactsWith: 'Immunoglobulins', severity: 'major', mechanism: 'Passive antibodies inhibit live vaccine replication', clinicalEffect: 'Vaccine failure', clinicalEffectAr: 'فشل اللقاح', management: 'Delay vaccine 3 months after immunoglobulin', managementAr: 'تأخير اللقاح 3 أشهر بعد الغلوبيولين المناعي' },
      { interactsWith: 'Immunosuppressants', severity: 'major', mechanism: 'Risk of vaccine-strain yellow fever infection', clinicalEffect: 'Life-threatening viscerotropic/neurotropic disease', clinicalEffectAr: 'مرض حشوي/عصبي مهدد للحياة', management: 'Contraindicated; provide medical waiver', managementAr: 'ممنوع؛ تقديم إعفاء طبي' }
    ],
    contraindications: ['Immunodeficiency', 'Thymus disorder', 'Age < 6 months', 'Pregnancy', 'Egg allergy (severe)', 'Age ≥ 60 years (relative)'],
    contraindicationsAr: ['نقص المناعة', 'اضطراب الغدة الصعترية', 'العمر أقل من 6 أشهر', 'الحمل', 'حساسية شديدة للبيض', 'العمر ≥ 60 سنة (نسبي)'],
    monitoringRequired: ['Observe 30 min post-vaccination', 'Monitor for viscerotropic signs 10 days', 'International Certificate of Vaccination'], storageConditions: 'Store at 2-8°C. Protect from light. Use within 1 hour of reconstitution.'
  },
  {
    id: 'FRM-0776', genericName: 'Rabies Vaccine (Inactivated, Pre-exposure)', genericNameAr: 'لقاح داء الكلب (معطل، قبل التعرض)', brandNames: ['Imovax Rabies', 'RabAvert'],
    sfda_registration: 'SFDA-RAB-776', atcCode: 'J07BG01', atcCategory: 'Vaccines — Rabies',
    therapeuticClass: 'Inactivated Viral Vaccine', therapeuticClassAr: 'لقاح فيروسي معطل',
    formularyStatus: 'formulary',
    route: ['intramuscular'], forms: [{ form: 'Powder for injection', strength: '≥2.5 IU/1 mL', unitPrice: 180.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Rabies Immunoglobulin'],
    interactions: [
      { interactsWith: 'Chloroquine', severity: 'moderate', mechanism: 'Reduced antibody response to intradermal route', clinicalEffect: 'Lower seroconversion with ID administration', clinicalEffectAr: 'انخفاض التحول المصلي بالحقن داخل الأدمة', management: 'Use IM route if concurrent antimalarials', managementAr: 'استخدام الحقن العضلي مع مضادات الملاريا المتزامنة' },
      { interactsWith: 'Corticosteroids', severity: 'moderate', mechanism: 'Immunosuppression reduces vaccine response', clinicalEffect: 'Suboptimal antibody titers', clinicalEffectAr: 'مستوى أجسام مضادة دون المستوى الأمثل', management: 'Check rabies antibody titer post-series', managementAr: 'فحص مستوى أجسام مضادة لداء الكلب بعد السلسلة' }
    ],
    contraindications: ['None absolute for post-exposure; Pre-exposure: severe allergic reaction to previous dose'],
    contraindicationsAr: ['لا موانع مطلقة بعد التعرض؛ قبل التعرض: رد فعل تحسسي شديد لجرعة سابقة'],
    monitoringRequired: ['Rabies antibody titer for high-risk individuals', 'Injection site reactions'], storageConditions: 'Store at 2-8°C. Do not freeze. Use immediately after reconstitution.'
  },
  {
    id: 'FRM-0777', genericName: 'Japanese Encephalitis Vaccine (Inactivated)', genericNameAr: 'لقاح التهاب الدماغ الياباني (معطل)', brandNames: ['Ixiaro', 'JESPECT'],
    sfda_registration: 'SFDA-JE-777', atcCode: 'J07BA02', atcCategory: 'Vaccines — Encephalitis',
    therapeuticClass: 'Inactivated Viral Vaccine', therapeuticClassAr: 'لقاح فيروسي معطل',
    formularyStatus: 'conditional',
    restrictionCriteria: 'Travel to endemic areas in Asia with prolonged outdoor exposure', restrictionCriteriaAr: 'السفر إلى مناطق موبوءة في آسيا مع تعرض خارجي مطول',
    route: ['intramuscular'], forms: [{ form: 'Suspension for injection', strength: '6 mcg/0.5 mL', unitPrice: 250.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: [],
    interactions: [
      { interactsWith: 'Other inactivated vaccines', severity: 'minor', mechanism: 'No significant interaction', clinicalEffect: 'Can be co-administered at different sites', clinicalEffectAr: 'يمكن إعطاؤه بالتزامن في مواقع مختلفة', management: 'Administer at different anatomical sites', managementAr: 'إعطاء في مواقع تشريحية مختلفة' }
    ],
    contraindications: ['Severe allergic reaction to previous dose or protamine sulfate'],
    contraindicationsAr: ['رد فعل تحسسي شديد لجرعة سابقة أو كبريتات البروتامين'],
    monitoringRequired: ['Delayed allergic reaction up to 2 weeks', 'Injection site reactions'], storageConditions: 'Store at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0778', genericName: 'Cholera Vaccine (Oral, Inactivated)', genericNameAr: 'لقاح الكوليرا (فموي، معطل)', brandNames: ['Dukoral', 'Shanchol', 'Euvichol-Plus'],
    sfda_registration: 'SFDA-CHOL-778', atcCode: 'J07AE01', atcCategory: 'Vaccines — Cholera',
    therapeuticClass: 'Oral Inactivated Bacterial Vaccine', therapeuticClassAr: 'لقاح بكتيري معطل فموي',
    formularyStatus: 'conditional',
    restrictionCriteria: 'Travel to cholera-endemic areas or outbreak response', restrictionCriteriaAr: 'السفر إلى مناطق موبوءة بالكوليرا أو الاستجابة لتفشي المرض',
    route: ['oral'], forms: [{ form: 'Oral suspension', strength: '3 mL/dose', unitPrice: 120.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: [],
    interactions: [
      { interactsWith: 'Oral Typhoid Vaccine', severity: 'minor', mechanism: 'Potential immune interference', clinicalEffect: 'Reduced response to one or both', clinicalEffectAr: 'انخفاض الاستجابة لأحدهما أو كليهما', management: 'Separate by at least 8 hours', managementAr: 'الفصل بينهما بـ 8 ساعات على الأقل' }
    ],
    contraindications: ['Acute gastrointestinal illness', 'Severe allergic reaction to previous dose'],
    contraindicationsAr: ['مرض معدي معوي حاد', 'رد فعل تحسسي شديد لجرعة سابقة'],
    monitoringRequired: ['Nausea/diarrhea post-dose'], storageConditions: 'Store at 2-8°C. Do not freeze.'
  },

  // ─── Adult/Booster Vaccines (4) ───
  {
    id: 'FRM-0779', genericName: 'Tdap Vaccine (Tetanus, Diphtheria, Pertussis — Adult)', genericNameAr: 'لقاح الكزاز والخناق والسعال الديكي (للبالغين)', brandNames: ['Boostrix', 'Adacel'],
    sfda_registration: 'SFDA-TDAP-779', atcCode: 'J07CA01', atcCategory: 'Vaccines — Bacterial Combinations',
    therapeuticClass: 'Combination Inactivated Vaccine (Adult)', therapeuticClassAr: 'لقاح مركب معطل (للبالغين)',
    formularyStatus: 'formulary',
    route: ['intramuscular'], forms: [{ form: 'Suspension for injection', strength: '0.5 mL', unitPrice: 65.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'B', lactationSafe: true,
    pediatricApproved: false, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['DTaP', 'DT', 'Td'],
    interactions: [
      { interactsWith: 'Immunosuppressants', severity: 'moderate', mechanism: 'Reduced antibody response', clinicalEffect: 'Suboptimal protection', clinicalEffectAr: 'حماية دون المستوى الأمثل', management: 'Vaccinate and check titers; revaccinate after immunosuppression if needed', managementAr: 'التطعيم وفحص المستويات؛ إعادة التطعيم بعد زوال تثبيط المناعة إذا لزم' }
    ],
    contraindications: ['Encephalopathy within 7 days of previous pertussis vaccine', 'Severe allergic reaction to previous dose'],
    contraindicationsAr: ['اعتلال دماغي خلال 7 أيام من لقاح سعال ديكي سابق', 'رد فعل تحسسي شديد لجرعة سابقة'],
    monitoringRequired: ['Injection site reactions', 'Arthus-type hypersensitivity if frequent Td boosters'], storageConditions: 'Store at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0780', genericName: 'Pneumococcal Polysaccharide Vaccine (PPSV23)', genericNameAr: 'لقاح المكورات الرئوية عديد السكاريد (23 تكافؤ)', brandNames: ['Pneumovax 23'],
    sfda_registration: 'SFDA-PPSV23-780', atcCode: 'J07AL01', atcCategory: 'Vaccines — Pneumococcal',
    therapeuticClass: 'Polysaccharide Bacterial Vaccine', therapeuticClassAr: 'لقاح بكتيري عديد السكاريد',
    formularyStatus: 'formulary',
    route: ['intramuscular', 'subcutaneous'], forms: [{ form: 'Solution for injection', strength: '25 mcg each/0.5 mL', unitPrice: 150.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'B', lactationSafe: true,
    pediatricApproved: false, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['PCV13'],
    interactions: [
      { interactsWith: 'PCV13', severity: 'minor', mechanism: 'Sequencing affects immune response', clinicalEffect: 'Lower response if PPSV23 given first', clinicalEffectAr: 'استجابة أقل إذا أُعطي PPSV23 أولاً', management: 'Give PCV13 first, then PPSV23 at least 8 weeks later', managementAr: 'إعطاء PCV13 أولاً ثم PPSV23 بعد 8 أسابيع على الأقل' }
    ],
    contraindications: ['Severe allergic reaction to previous dose'],
    contraindicationsAr: ['رد فعل تحسسي شديد لجرعة سابقة'],
    monitoringRequired: ['Injection site reactions', 'Revaccination schedule for high-risk groups'], storageConditions: 'Store at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0781', genericName: 'Recombinant Zoster Vaccine (Shingrix)', genericNameAr: 'لقاح الهربس النطاقي المؤتلف (شينغريكس)', brandNames: ['Shingrix'],
    sfda_registration: 'SFDA-ZOST-781', atcCode: 'J07BK03', atcCategory: 'Vaccines — Varicella-Zoster',
    therapeuticClass: 'Recombinant Adjuvanted Vaccine', therapeuticClassAr: 'لقاح مؤتلف مع مادة مساعدة',
    formularyStatus: 'formulary',
    route: ['intramuscular'], forms: [{ form: 'Powder and suspension for injection', strength: '50 mcg/0.5 mL', unitPrice: 450.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: false, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Varicella vaccine (Varivax)'],
    interactions: [
      { interactsWith: 'Immunosuppressants', severity: 'moderate', mechanism: 'May reduce vaccine efficacy but not contraindicated', clinicalEffect: 'Potentially lower immune response', clinicalEffectAr: 'احتمال انخفاض الاستجابة المناعية', management: 'Can be given to immunocompromised (not live vaccine); timing optimization recommended', managementAr: 'يمكن إعطاؤه لمثبطي المناعة (ليس لقاحاً حياً)؛ يُوصى بتحسين التوقيت' }
    ],
    contraindications: ['Severe allergic reaction to previous dose or vaccine component'],
    contraindicationsAr: ['رد فعل تحسسي شديد لجرعة سابقة أو مكون اللقاح'],
    monitoringRequired: ['Injection site pain/swelling (common)', 'Myalgia', 'Fatigue'], storageConditions: 'Store at 2-8°C. Do not freeze. Use immediately after reconstitution.'
  },
  {
    id: 'FRM-0782', genericName: 'HPV Vaccine 9-valent (Gardasil 9)', genericNameAr: 'لقاح فيروس الورم الحليمي البشري 9 أنماط (غارداسيل 9)', brandNames: ['Gardasil 9'],
    sfda_registration: 'SFDA-HPV9-782', atcCode: 'J07BM03', atcCategory: 'Vaccines — Papillomavirus',
    therapeuticClass: 'Recombinant Viral Vaccine', therapeuticClassAr: 'لقاح فيروسي مؤتلف',
    formularyStatus: 'formulary',
    route: ['intramuscular'], forms: [{ form: 'Suspension for injection', strength: '0.5 mL', unitPrice: 380.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'B', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Gardasil (4-valent)', 'Cervarix'],
    interactions: [
      { interactsWith: 'Immunosuppressants', severity: 'moderate', mechanism: 'Reduced antibody response', clinicalEffect: 'Suboptimal HPV protection', clinicalEffectAr: 'حماية دون المستوى الأمثل ضد الورم الحليمي', management: 'Complete series; consider titer check', managementAr: 'إكمال السلسلة؛ النظر في فحص المستويات' }
    ],
    contraindications: ['Severe allergic reaction to previous dose or yeast'],
    contraindicationsAr: ['رد فعل تحسسي شديد لجرعة سابقة أو الخميرة'],
    monitoringRequired: ['Syncope observation 15 min', 'Injection site reactions'], storageConditions: 'Store at 2-8°C. Do not freeze. Protect from light.'
  },

  // ─── Immunoglobulins (8) ───
  {
    id: 'FRM-0783', genericName: 'Intravenous Immunoglobulin (IVIG)', genericNameAr: 'الغلوبيولين المناعي الوريدي', brandNames: ['Gamunex-C', 'Privigen', 'Octagam', 'Flebogamma'],
    sfda_registration: 'SFDA-IVIG-783', atcCode: 'J06BA02', atcCategory: 'Immunoglobulins — Normal Human',
    therapeuticClass: 'Polyclonal Immunoglobulin', therapeuticClassAr: 'غلوبيولين مناعي متعدد النسائل',
    formularyStatus: 'restricted',
    restrictionCriteria: 'Requires hematologist/immunologist approval. Indications: primary immunodeficiency, ITP, Kawasaki disease, GBS, CIDP',
    restrictionCriteriaAr: 'يتطلب موافقة أخصائي أمراض الدم/المناعة. دواعي الاستعمال: نقص المناعة الأولي، فرفرية نقص الصفيحات، مرض كاواساكي، متلازمة غيلان-باريه، اعتلال الأعصاب المزمن',
    approverRole: 'hematologist',
    route: ['intravenous'], forms: [
      { form: 'Solution for infusion', strength: '5 g/50 mL (10%)', unitPrice: 1200.00, inStock: true },
      { form: 'Solution for infusion', strength: '10 g/100 mL (10%)', unitPrice: 2300.00, inStock: true },
      { form: 'Solution for infusion', strength: '20 g/200 mL (10%)', unitPrice: 4500.00, inStock: true }
    ],
    renalAdjustment: true, hepaticAdjustment: false,
    pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: true,
    highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['SCIG (subcutaneous immunoglobulin)'],
    blackBoxWarning: 'Risk of renal dysfunction, acute renal failure, osmotic nephrosis, and death. Use caution in patients with renal insufficiency. Use minimum concentration and slowest infusion rate.',
    blackBoxWarningAr: 'خطر اختلال وظيفي كلوي، فشل كلوي حاد، تنخر كلوي تناضحي، والوفاة. توخ الحذر في المرضى المصابين بقصور كلوي. استخدام أقل تركيز وأبطأ معدل تسريب.',
    interactions: [
      { interactsWith: 'Live vaccines (MMR, Varicella, Yellow Fever)', severity: 'major', mechanism: 'Passive antibodies neutralize live vaccine virus', clinicalEffect: 'Vaccine failure', clinicalEffectAr: 'فشل اللقاح', management: 'Delay live vaccines 3-11 months after IVIG depending on dose', managementAr: 'تأخير اللقاحات الحية 3-11 شهر بعد IVIG حسب الجرعة' },
      { interactsWith: 'Nephrotoxic agents', severity: 'major', mechanism: 'Additive renal toxicity', clinicalEffect: 'Acute kidney injury', clinicalEffectAr: 'إصابة كلوية حادة', management: 'Hydrate well; avoid concurrent nephrotoxins; monitor creatinine', managementAr: 'ترطيب جيد؛ تجنب السموم الكلوية المتزامنة؛ مراقبة الكرياتينين' }
    ],
    contraindications: ['IgA deficiency with anti-IgA antibodies', 'Severe fructose intolerance (sucrose-containing products)', 'Anaphylaxis to previous IVIG'],
    contraindicationsAr: ['نقص IgA مع أجسام مضادة ضد IgA', 'عدم تحمل شديد للفركتوز (منتجات تحتوي على السكروز)', 'حساسية مفرطة لـ IVIG سابق'],
    monitoringRequired: ['Vital signs q15min during first 30 min then hourly', 'Renal function (BUN, Cr)', 'IgA level pre-treatment', 'Signs of hemolysis', 'Fluid overload in cardiac patients'], storageConditions: 'Store at 2-8°C or room temperature per product. Do not freeze. Do not shake.'
  },
  {
    id: 'FRM-0784', genericName: 'Anti-D Immunoglobulin (RhoGAM)', genericNameAr: 'الغلوبيولين المناعي المضاد لـ D (روغام)', brandNames: ['RhoGAM', 'WinRho SDF', 'Rhophylac'],
    sfda_registration: 'SFDA-RHOGAM-784', atcCode: 'J06BB01', atcCategory: 'Immunoglobulins — Specific',
    therapeuticClass: 'Specific Anti-D Immunoglobulin', therapeuticClassAr: 'غلوبيولين مناعي نوعي مضاد لـ D',
    formularyStatus: 'formulary',
    route: ['intramuscular', 'intravenous'], forms: [
      { form: 'Solution for injection', strength: '300 mcg (1500 IU)', unitPrice: 350.00, inStock: true },
      { form: 'Solution for injection', strength: '50 mcg (250 IU)', unitPrice: 180.00, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['RhoGAM vs MICRhoGAM'],
    blackBoxWarning: 'IV formulation (WinRho): Risk of intravascular hemolysis, DIC, and death when used for ITP. Do NOT administer IV formulation to Rh-positive patients for suppression of Rh immunization.',
    blackBoxWarningAr: 'الصيغة الوريدية: خطر انحلال الدم داخل الأوعية والتخثر المنتشر والوفاة عند استخدامه لعلاج نقص الصفيحات. لا تُعطى الصيغة الوريدية لمرضى Rh الإيجابي لقمع التمنيع.',
    interactions: [
      { interactsWith: 'Live vaccines', severity: 'moderate', mechanism: 'May impair response to live vaccines', clinicalEffect: 'Reduced vaccine efficacy', clinicalEffectAr: 'انخفاض فعالية اللقاح', management: 'Delay MMR/Varicella 3 months after Anti-D', managementAr: 'تأخير لقاح الحصبة/جدري الماء 3 أشهر بعد مضاد D' }
    ],
    contraindications: ['Rh-D positive patient (for immunization suppression)', 'IgA deficiency with anti-IgA antibodies', 'Prior severe reaction'],
    contraindicationsAr: ['مريض Rh-D إيجابي (لقمع التمنيع)', 'نقص IgA مع أجسام مضادة ضد IgA', 'رد فعل شديد سابق'],
    monitoringRequired: ['Blood type confirmation pre-administration', 'Kleihauer-Betke test for large fetomaternal hemorrhage', 'Hemolysis monitoring (IV route)'], storageConditions: 'Store at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0785', genericName: 'Tetanus Immunoglobulin (TIG)', genericNameAr: 'الغلوبيولين المناعي للكزاز', brandNames: ['HyperTET', 'BayTet'],
    sfda_registration: 'SFDA-TIG-785', atcCode: 'J06BB02', atcCategory: 'Immunoglobulins — Specific',
    therapeuticClass: 'Specific Human Immunoglobulin', therapeuticClassAr: 'غلوبيولين مناعي بشري نوعي',
    formularyStatus: 'formulary',
    route: ['intramuscular'], forms: [{ form: 'Solution for injection', strength: '250 IU/mL', unitPrice: 280.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Tetanus Toxoid (Td/Tdap)'],
    interactions: [
      { interactsWith: 'Tetanus Vaccine', severity: 'minor', mechanism: 'No interference — give at different sites', clinicalEffect: 'Can be administered concurrently', clinicalEffectAr: 'يمكن إعطاؤه بالتزامن', management: 'Administer TIG and vaccine at different anatomical sites', managementAr: 'إعطاء الغلوبيولين واللقاح في مواقع تشريحية مختلفة' }
    ],
    contraindications: ['Severe allergic reaction to previous human immunoglobulin'],
    contraindicationsAr: ['رد فعل تحسسي شديد لغلوبيولين مناعي بشري سابق'],
    monitoringRequired: ['Injection site reactions', 'Anaphylaxis observation 20 min'], storageConditions: 'Store at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0786', genericName: 'Hepatitis B Immunoglobulin (HBIG)', genericNameAr: 'الغلوبيولين المناعي لالتهاب الكبد ب', brandNames: ['HepaGam B', 'HyperHEP B', 'Nabi-HB'],
    sfda_registration: 'SFDA-HBIG-786', atcCode: 'J06BB04', atcCategory: 'Immunoglobulins — Specific',
    therapeuticClass: 'Specific Human Immunoglobulin', therapeuticClassAr: 'غلوبيولين مناعي بشري نوعي',
    formularyStatus: 'formulary',
    route: ['intramuscular', 'intravenous'], forms: [
      { form: 'Solution for injection (IM)', strength: '220 IU/mL', unitPrice: 450.00, inStock: true },
      { form: 'Solution for injection (IV)', strength: '312 IU/mL', unitPrice: 600.00, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Hepatitis B Vaccine'],
    interactions: [
      { interactsWith: 'Hepatitis B Vaccine', severity: 'minor', mechanism: 'No interference when given at different sites', clinicalEffect: 'Can be co-administered for post-exposure prophylaxis', clinicalEffectAr: 'يمكن إعطاؤهما معاً للوقاية بعد التعرض', management: 'Administer at different injection sites; both should be given within 24h of exposure', managementAr: 'إعطاء في مواقع حقن مختلفة؛ يجب إعطاء كليهما خلال 24 ساعة من التعرض' },
      { interactsWith: 'Live vaccines', severity: 'moderate', mechanism: 'Passive antibodies may reduce live vaccine response', clinicalEffect: 'Potential vaccine interference', clinicalEffectAr: 'احتمال تداخل مع اللقاح', management: 'Delay MMR/Varicella 3 months after HBIG', managementAr: 'تأخير لقاح الحصبة/جدري الماء 3 أشهر بعد HBIG' }
    ],
    contraindications: ['Severe allergic reaction to human immunoglobulin', 'IgA deficiency with anti-IgA antibodies (for IV products)'],
    contraindicationsAr: ['رد فعل تحسسي شديد للغلوبيولين المناعي البشري', 'نقص IgA مع أجسام مضادة ضد IgA (للمنتجات الوريدية)'],
    monitoringRequired: ['Newborn: HBsAg status at 9-12 months', 'Post-exposure: follow-up HBV serology'], storageConditions: 'Store at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0787', genericName: 'Rabies Immunoglobulin (HRIG)', genericNameAr: 'الغلوبيولين المناعي لداء الكلب', brandNames: ['Imogam Rabies-HT', 'HyperRAB', 'KedRAB'],
    sfda_registration: 'SFDA-HRIG-787', atcCode: 'J06BB05', atcCategory: 'Immunoglobulins — Specific',
    therapeuticClass: 'Specific Human Immunoglobulin', therapeuticClassAr: 'غلوبيولين مناعي بشري نوعي',
    formularyStatus: 'formulary',
    route: ['infiltration around wound', 'intramuscular'], forms: [{ form: 'Solution for injection', strength: '150 IU/mL', unitPrice: 800.00, inStock: true }],
    maxDailyDose: 20, maxDailyDoseUnit: 'IU/kg',
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Rabies Vaccine'],
    interactions: [
      { interactsWith: 'Rabies Vaccine', severity: 'moderate', mechanism: 'Excessive HRIG can suppress active immune response', clinicalEffect: 'Reduced vaccine antibody response if overdosed', clinicalEffectAr: 'انخفاض استجابة الأجسام المضادة للقاح عند الجرعة الزائدة', management: 'Do not exceed 20 IU/kg; infiltrate as much as possible around wound, remainder IM at distant site; NEVER inject at same site as vaccine', managementAr: 'لا تتجاوز 20 وحدة دولية/كغ؛ حقن أكبر قدر حول الجرح والباقي عضلياً في موقع بعيد؛ لا تحقن أبداً في نفس موقع اللقاح' }
    ],
    contraindications: ['None absolute for post-exposure prophylaxis', 'Previously vaccinated individuals (do not give HRIG)'],
    contraindicationsAr: ['لا موانع مطلقة للوقاية بعد التعرض', 'الأفراد الذين سبق تطعيمهم (لا يُعطى الغلوبيولين)'],
    monitoringRequired: ['Wound site healing', 'Completion of vaccine series', 'Anaphylaxis observation'], storageConditions: 'Store at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0788', genericName: 'Varicella-Zoster Immunoglobulin (VZIG)', genericNameAr: 'الغلوبيولين المناعي لجدري الماء والهربس النطاقي', brandNames: ['VariZIG'],
    sfda_registration: 'SFDA-VZIG-788', atcCode: 'J06BB03', atcCategory: 'Immunoglobulins — Specific',
    therapeuticClass: 'Specific Human Immunoglobulin', therapeuticClassAr: 'غلوبيولين مناعي بشري نوعي',
    formularyStatus: 'restricted',
    restrictionCriteria: 'Post-exposure prophylaxis for high-risk individuals: immunocompromised, neonates, pregnant women without immunity',
    restrictionCriteriaAr: 'وقاية بعد التعرض للأفراد عالي الخطورة: مثبطو المناعة، حديثو الولادة، الحوامل بدون مناعة',
    approverRole: 'infectious_disease_specialist',
    route: ['intramuscular'], forms: [{ form: 'Solution for injection', strength: '125 IU/vial', unitPrice: 900.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Varicella Vaccine'],
    interactions: [
      { interactsWith: 'Varicella Vaccine', severity: 'major', mechanism: 'Passive antibodies neutralize live vaccine', clinicalEffect: 'Vaccine failure', clinicalEffectAr: 'فشل اللقاح', management: 'Delay varicella vaccine at least 5 months after VZIG', managementAr: 'تأخير لقاح جدري الماء 5 أشهر على الأقل بعد VZIG' },
      { interactsWith: 'MMR Vaccine', severity: 'major', mechanism: 'Passive antibodies neutralize live vaccine', clinicalEffect: 'Vaccine failure', clinicalEffectAr: 'فشل اللقاح', management: 'Delay MMR at least 5 months after VZIG', managementAr: 'تأخير لقاح الحصبة 5 أشهر على الأقل بعد VZIG' }
    ],
    contraindications: ['Severe thrombocytopenia (IM contraindicated)', 'IgA deficiency with anti-IgA antibodies'],
    contraindicationsAr: ['نقص شديد في الصفيحات (ممنوع عضلياً)', 'نقص IgA مع أجسام مضادة ضد IgA'],
    monitoringRequired: ['Administer within 10 days of exposure (ideally 96 hours)', 'Monitor for varicella symptoms 28 days', 'Injection site reactions'], storageConditions: 'Store at -15°C or colder. Thaw at room temperature; use within 12 hours.'
  },
  {
    id: 'FRM-0789', genericName: 'Cytomegalovirus Immunoglobulin (CMV-IVIG)', genericNameAr: 'الغلوبيولين المناعي للفيروس المضخم للخلايا', brandNames: ['Cytogam'],
    sfda_registration: 'SFDA-CMVIG-789', atcCode: 'J06BB09', atcCategory: 'Immunoglobulins — Specific',
    therapeuticClass: 'Specific Human Immunoglobulin', therapeuticClassAr: 'غلوبيولين مناعي بشري نوعي',
    formularyStatus: 'restricted',
    restrictionCriteria: 'CMV-seronegative transplant recipients from CMV-seropositive donors; CMV disease prophylaxis/treatment adjunct',
    restrictionCriteriaAr: 'متلقو الزراعة السلبيون لـ CMV من متبرعين إيجابيين؛ وقاية/علاج مساعد لمرض CMV',
    approverRole: 'transplant_specialist',
    route: ['intravenous'], forms: [{ form: 'Solution for infusion', strength: '2500 mg/50 mL (50 mg/mL)', unitPrice: 3500.00, inStock: true }],
    renalAdjustment: true, hepaticAdjustment: false,
    pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: true,
    highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['IVIG'],
    interactions: [
      { interactsWith: 'Live vaccines', severity: 'major', mechanism: 'Passive antibodies neutralize live vaccines', clinicalEffect: 'Vaccine failure', clinicalEffectAr: 'فشل اللقاح', management: 'Delay live vaccines 3 months after CMV-IVIG', managementAr: 'تأخير اللقاحات الحية 3 أشهر بعد CMV-IVIG' },
      { interactsWith: 'Nephrotoxic agents', severity: 'major', mechanism: 'Additive renal toxicity', clinicalEffect: 'Acute kidney injury', clinicalEffectAr: 'إصابة كلوية حادة', management: 'Monitor creatinine; ensure adequate hydration; slow infusion rate', managementAr: 'مراقبة الكرياتينين؛ ضمان ترطيب كافٍ؛ إبطاء معدل التسريب' }
    ],
    contraindications: ['IgA deficiency with anti-IgA antibodies', 'Anaphylaxis to immunoglobulin products'],
    contraindicationsAr: ['نقص IgA مع أجسام مضادة ضد IgA', 'حساسية مفرطة لمنتجات الغلوبيولين المناعي'],
    monitoringRequired: ['Vital signs q15min during infusion', 'Renal function', 'CMV viral load', 'Signs of hemolysis'], storageConditions: 'Store at 2-8°C. Do not freeze. Begin infusion within 6 hours of entering vial.'
  },
  {
    id: 'FRM-0790', genericName: 'Anti-thymocyte Globulin (Rabbit ATG)', genericNameAr: 'الغلوبيولين المضاد للخلايا اللمفاوية التائية (أرنبي)', brandNames: ['Thymoglobulin', 'ATG-Fresenius'],
    sfda_registration: 'SFDA-ATG-790', atcCode: 'L04AA04', atcCategory: 'Immunosuppressants — Anti-lymphocyte',
    therapeuticClass: 'Polyclonal Anti-T-Cell Immunoglobulin', therapeuticClassAr: 'غلوبيولين مناعي متعدد النسائل مضاد للخلايا التائية',
    formularyStatus: 'restricted',
    restrictionCriteria: 'Transplant rejection treatment/induction; aplastic anemia. Requires transplant medicine or hematology specialist approval',
    restrictionCriteriaAr: 'علاج/تحريض رفض الزراعة؛ فقر الدم اللاتنسجي. يتطلب موافقة أخصائي زراعة أعضاء أو أمراض دم',
    approverRole: 'transplant_specialist',
    route: ['intravenous'], forms: [{ form: 'Powder for solution for infusion', strength: '25 mg/vial', unitPrice: 2800.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true,
    highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Equine ATG (Atgam)'],
    blackBoxWarning: 'Should only be used by physicians experienced in immunosuppressive therapy for organ transplantation or aplastic anemia. Adequate lab and supportive resources must be available.',
    blackBoxWarningAr: 'يجب استخدامه فقط من قبل أطباء ذوي خبرة في العلاج المثبط للمناعة لزراعة الأعضاء أو فقر الدم اللاتنسجي. يجب توفر موارد مخبرية وداعمة كافية.',
    interactions: [
      { interactsWith: 'Live vaccines', severity: 'major', mechanism: 'Profound immunosuppression — risk of vaccine-strain infection', clinicalEffect: 'Disseminated vaccine infection', clinicalEffectAr: 'عدوى اللقاح المنتشرة', management: 'Contraindicated during and months after ATG therapy', managementAr: 'ممنوع أثناء وأشهر بعد علاج ATG' },
      { interactsWith: 'Other immunosuppressants', severity: 'major', mechanism: 'Additive immunosuppression', clinicalEffect: 'Severe infection risk, lymphoma risk', clinicalEffectAr: 'خطر عدوى شديدة، خطر ورم لمفي', management: 'Reduce concurrent immunosuppressant doses; monitor WBC/lymphocyte counts daily', managementAr: 'تقليل جرعات مثبطات المناعة المتزامنة؛ مراقبة تعداد الكريات البيضاء/الخلايا اللمفاوية يومياً' }
    ],
    contraindications: ['Active infection', 'Known allergy to rabbit proteins', 'Severe thrombocytopenia without appropriate monitoring'],
    contraindicationsAr: ['عدوى نشطة', 'حساسية معروفة لبروتينات الأرنب', 'نقص شديد في الصفيحات بدون مراقبة مناسبة'],
    monitoringRequired: ['CBC with differential daily', 'Platelet count (dose reduce if < 50,000)', 'WBC (dose reduce if < 3,000)', 'Vital signs q15min during infusion', 'Test dose recommended', 'Cytokine release syndrome symptoms', 'Serum sickness 7-14 days post-treatment'], storageConditions: 'Store at 2-8°C. Do not freeze. Use within 4 hours of reconstitution.'
  },

  // ─── Immune Modulators (5) ───
  {
    id: 'FRM-0791', genericName: 'Interferon alfa-2b', genericNameAr: 'إنترفيرون ألفا-2ب', brandNames: ['Intron A'],
    sfda_registration: 'SFDA-IFNA-791', atcCode: 'L03AB05', atcCategory: 'Immunostimulants — Interferons',
    therapeuticClass: 'Recombinant Interferon', therapeuticClassAr: 'إنترفيرون مؤتلف',
    formularyStatus: 'restricted',
    restrictionCriteria: 'Hepatitis B/C, certain malignancies. Requires hepatologist or oncologist approval',
    restrictionCriteriaAr: 'التهاب الكبد ب/ج، بعض الأورام الخبيثة. يتطلب موافقة أخصائي كبد أو أورام',
    approverRole: 'hepatologist',
    route: ['subcutaneous', 'intramuscular', 'intravenous'], forms: [
      { form: 'Solution for injection', strength: '3 MIU/0.5 mL', unitPrice: 180.00, inStock: true },
      { form: 'Solution for injection', strength: '10 MIU/mL', unitPrice: 550.00, inStock: true }
    ],
    renalAdjustment: true, hepaticAdjustment: true,
    pregnancyCategory: 'X', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true,
    highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Interferon beta', 'Peginterferon'],
    blackBoxWarning: 'May cause or aggravate fatal or life-threatening neuropsychiatric, autoimmune, ischemic, and infectious disorders. Monitor closely with periodic clinical and lab evaluations.',
    blackBoxWarningAr: 'قد يسبب أو يفاقم اضطرابات عصبية نفسية ومناعية ذاتية وإقفارية ومعدية مميتة أو مهددة للحياة. مراقبة دقيقة مع تقييمات سريرية ومخبرية دورية.',
    interactions: [
      { interactsWith: 'Theophylline', severity: 'moderate', mechanism: 'Inhibits CYP1A2 metabolism', clinicalEffect: 'Increased theophylline levels', clinicalEffectAr: 'ارتفاع مستويات الثيوفيلين', management: 'Monitor theophylline levels; dose reduction may be needed', managementAr: 'مراقبة مستويات الثيوفيلين؛ قد يلزم تقليل الجرعة' },
      { interactsWith: 'Zidovudine', severity: 'major', mechanism: 'Additive myelosuppression', clinicalEffect: 'Severe neutropenia and anemia', clinicalEffectAr: 'قلة العدلات وفقر دم شديد', management: 'Monitor CBC closely; dose-reduce both if needed', managementAr: 'مراقبة تعداد الدم بدقة؛ تقليل جرعة كليهما إذا لزم' }
    ],
    contraindications: ['Decompensated liver disease', 'Autoimmune hepatitis', 'Pregnancy', 'History of severe psychiatric disorder'],
    contraindicationsAr: ['مرض كبد غير معاوض', 'التهاب الكبد المناعي الذاتي', 'الحمل', 'تاريخ اضطراب نفسي شديد'],
    monitoringRequired: ['CBC q2 weeks initially', 'LFTs monthly', 'Thyroid function q3 months', 'Depression screening', 'Ophthalmologic exam', 'Triglycerides'], storageConditions: 'Store at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0792', genericName: 'Interferon beta-1a', genericNameAr: 'إنترفيرون بيتا-1أ', brandNames: ['Avonex', 'Rebif'],
    sfda_registration: 'SFDA-IFNB-792', atcCode: 'L03AB07', atcCategory: 'Immunostimulants — Interferons',
    therapeuticClass: 'Recombinant Interferon', therapeuticClassAr: 'إنترفيرون مؤتلف',
    formularyStatus: 'restricted',
    restrictionCriteria: 'Relapsing-remitting multiple sclerosis. Requires neurologist approval',
    restrictionCriteriaAr: 'التصلب المتعدد الانتكاسي الهاجع. يتطلب موافقة طبيب أعصاب',
    approverRole: 'neurologist',
    route: ['intramuscular', 'subcutaneous'], forms: [
      { form: 'Solution for injection (prefilled syringe)', strength: '30 mcg/0.5 mL (Avonex)', unitPrice: 1200.00, inStock: true },
      { form: 'Solution for injection (prefilled syringe)', strength: '44 mcg/0.5 mL (Rebif)', unitPrice: 900.00, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: true,
    pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: true,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Interferon alfa', 'Interferon beta-1b'],
    interactions: [
      { interactsWith: 'Hepatotoxic drugs', severity: 'moderate', mechanism: 'Additive hepatotoxicity', clinicalEffect: 'Elevated liver enzymes', clinicalEffectAr: 'ارتفاع إنزيمات الكبد', management: 'Monitor LFTs monthly for first 6 months, then periodically', managementAr: 'مراقبة إنزيمات الكبد شهرياً لأول 6 أشهر ثم دورياً' }
    ],
    contraindications: ['Decompensated liver disease', 'Known hypersensitivity to interferon beta or albumin'],
    contraindicationsAr: ['مرض كبد غير معاوض', 'فرط حساسية معروف للإنترفيرون بيتا أو الألبومين'],
    monitoringRequired: ['CBC with differential', 'LFTs monthly × 6 months then q6 months', 'Thyroid function annually', 'Depression screening', 'Injection site assessment'], storageConditions: 'Store at 2-8°C. Do not freeze. Allow to reach room temperature before injection.'
  },
  {
    id: 'FRM-0793', genericName: 'Peginterferon alfa-2a', genericNameAr: 'بيغ إنترفيرون ألفا-2أ', brandNames: ['Pegasys'],
    sfda_registration: 'SFDA-PEGA-793', atcCode: 'L03AB11', atcCategory: 'Immunostimulants — Interferons',
    therapeuticClass: 'Pegylated Recombinant Interferon', therapeuticClassAr: 'إنترفيرون مؤتلف مبيغل',
    formularyStatus: 'restricted',
    restrictionCriteria: 'Chronic hepatitis B or C. Requires hepatologist or infectious disease specialist approval',
    restrictionCriteriaAr: 'التهاب الكبد ب أو ج المزمن. يتطلب موافقة أخصائي كبد أو أمراض معدية',
    approverRole: 'hepatologist',
    route: ['subcutaneous'], forms: [
      { form: 'Solution for injection (prefilled syringe)', strength: '180 mcg/0.5 mL', unitPrice: 1500.00, inStock: true },
      { form: 'Solution for injection (prefilled syringe)', strength: '135 mcg/0.5 mL', unitPrice: 1200.00, inStock: true }
    ],
    renalAdjustment: true, hepaticAdjustment: true,
    pregnancyCategory: 'X', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true,
    highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Peginterferon alfa-2b', 'Interferon alfa'],
    blackBoxWarning: 'May cause or aggravate fatal or life-threatening neuropsychiatric, autoimmune, ischemic, and infectious disorders. Use with ribavirin: combination is contraindicated in pregnancy and causes hemolytic anemia.',
    blackBoxWarningAr: 'قد يسبب أو يفاقم اضطرابات مميتة أو مهددة للحياة. الاستخدام مع ريبافيرين: ممنوع في الحمل ويسبب فقر دم انحلالي.',
    interactions: [
      { interactsWith: 'Ribavirin', severity: 'major', mechanism: 'Combined teratogenicity and hemolytic anemia', clinicalEffect: 'Birth defects; severe anemia', clinicalEffectAr: 'عيوب خلقية؛ فقر دم شديد', management: 'Two forms of contraception required; monthly pregnancy tests; monitor Hb closely', managementAr: 'شكلان من وسائل منع الحمل مطلوبان؛ اختبارات حمل شهرية؛ مراقبة الهيموغلوبين بدقة' },
      { interactsWith: 'Methadone', severity: 'moderate', mechanism: 'Increased methadone levels via CYP inhibition', clinicalEffect: 'Opioid toxicity risk', clinicalEffectAr: 'خطر سمية الأفيون', management: 'Monitor for sedation; may need methadone dose reduction', managementAr: 'مراقبة التخدير؛ قد يلزم تقليل جرعة الميثادون' }
    ],
    contraindications: ['Pregnancy', 'Autoimmune hepatitis', 'Decompensated cirrhosis', 'Neonates/infants (benzyl alcohol in formulation)'],
    contraindicationsAr: ['الحمل', 'التهاب الكبد المناعي الذاتي', 'تليف كبد غير معاوض', 'حديثو الولادة/الرضع (كحول بنزيلي في التركيبة)'],
    monitoringRequired: ['CBC q2-4 weeks', 'LFTs q4 weeks', 'TSH q12 weeks', 'Pregnancy test monthly', 'Depression/suicidality screening', 'Ophthalmologic exam baseline and prn'], storageConditions: 'Store at 2-8°C. Do not freeze. Do not shake.'
  },
  {
    id: 'FRM-0794', genericName: 'Glatiramer Acetate', genericNameAr: 'غلاتيرامر أسيتات', brandNames: ['Copaxone', 'Glatopa'],
    sfda_registration: 'SFDA-GLAT-794', atcCode: 'L03AX13', atcCategory: 'Immunostimulants — Other',
    therapeuticClass: 'Immunomodulator (MS-specific)', therapeuticClassAr: 'معدل مناعي (خاص بالتصلب المتعدد)',
    formularyStatus: 'restricted',
    restrictionCriteria: 'Relapsing-remitting multiple sclerosis. Requires neurologist approval',
    restrictionCriteriaAr: 'التصلب المتعدد الانتكاسي الهاجع. يتطلب موافقة طبيب أعصاب',
    approverRole: 'neurologist',
    route: ['subcutaneous'], forms: [
      { form: 'Solution for injection (prefilled syringe)', strength: '20 mg/mL', unitPrice: 800.00, inStock: true },
      { form: 'Solution for injection (prefilled syringe)', strength: '40 mg/mL', unitPrice: 850.00, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'B', lactationSafe: true,
    pediatricApproved: false, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: [],
    interactions: [
      { interactsWith: 'Other immunomodulators', severity: 'moderate', mechanism: 'Potential additive immunomodulation', clinicalEffect: 'Unpredictable immune effects', clinicalEffectAr: 'تأثيرات مناعية غير متوقعة', management: 'Avoid concurrent use with other MS disease-modifying therapies', managementAr: 'تجنب الاستخدام المتزامن مع علاجات معدلة للمرض الأخرى' }
    ],
    contraindications: ['Known hypersensitivity to glatiramer or mannitol'],
    contraindicationsAr: ['فرط حساسية معروف للغلاتيرامر أو المانيتول'],
    monitoringRequired: ['Post-injection reaction (flushing, chest tightness, dyspnea — typically transient)', 'Injection site rotation', 'Lipoatrophy assessment'], storageConditions: 'Store at 2-8°C. May store at room temperature up to 25°C for 1 month. Do not freeze.'
  },
  {
    id: 'FRM-0795', genericName: 'Fingolimod', genericNameAr: 'فينغوليمود', brandNames: ['Gilenya'],
    sfda_registration: 'SFDA-FING-795', atcCode: 'L04AA27', atcCategory: 'Selective Immunosuppressants',
    therapeuticClass: 'Sphingosine-1-Phosphate Receptor Modulator', therapeuticClassAr: 'معدل مستقبلات سفينغوزين-1-فوسفات',
    formularyStatus: 'restricted',
    restrictionCriteria: 'Relapsing multiple sclerosis. Requires neurologist approval with first-dose cardiac monitoring',
    restrictionCriteriaAr: 'التصلب المتعدد الانتكاسي. يتطلب موافقة طبيب أعصاب مع مراقبة قلبية للجرعة الأولى',
    approverRole: 'neurologist',
    route: ['oral'], forms: [{ form: 'Capsule', strength: '0.5 mg', unitPrice: 220.00, inStock: true }],
    maxDailyDose: 0.5, maxDailyDoseUnit: 'mg',
    renalAdjustment: false, hepaticAdjustment: true,
    pregnancyCategory: 'X', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true,
    highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Siponimod', 'Ozanimod'],
    blackBoxWarning: 'First-dose monitoring required: bradycardia and AV block may occur. Cases of PML and serious infections including fatal herpes simplex encephalitis have been reported.',
    blackBoxWarningAr: 'مراقبة الجرعة الأولى مطلوبة: قد يحدث بطء القلب وإحصار أذيني بطيني. تم الإبلاغ عن حالات اعتلال بيضاء الدماغ متعدد البؤر وعدوى خطيرة بما فيها التهاب الدماغ الحلئي المميت.',
    interactions: [
      { interactsWith: 'Beta-blockers', severity: 'major', mechanism: 'Additive bradycardia', clinicalEffect: 'Severe symptomatic bradycardia', clinicalEffectAr: 'بطء قلب عرضي شديد', management: 'Avoid if possible; if needed, switch to alternative or extend first-dose monitoring to 24h', managementAr: 'تجنب إن أمكن؛ إذا لزم، التبديل لبديل أو تمديد المراقبة إلى 24 ساعة' },
      { interactsWith: 'Live vaccines', severity: 'major', mechanism: 'Immunosuppression increases infection risk', clinicalEffect: 'Risk of vaccine-strain infection', clinicalEffectAr: 'خطر عدوى سلالة اللقاح', management: 'Complete all vaccines 2 weeks before starting; avoid live vaccines during and 2 months after', managementAr: 'إكمال جميع اللقاحات قبل أسبوعين من البدء؛ تجنب اللقاحات الحية أثناء وشهرين بعد' },
      { interactsWith: 'Ketoconazole', severity: 'moderate', mechanism: 'CYP4F2 inhibition increases fingolimod exposure', clinicalEffect: 'Increased fingolimod levels by ~70%', clinicalEffectAr: 'زيادة مستويات فينغوليمود بنسبة ~70%', management: 'Use caution with strong CYP3A4/CYP4F2 inhibitors', managementAr: 'الحذر مع مثبطات CYP3A4/CYP4F2 القوية' }
    ],
    contraindications: ['Recent MI or stroke (within 6 months)', 'Severe heart failure (class III/IV)', 'Mobitz type II or 3rd degree AV block', 'Concurrent class Ia/III antiarrhythmics', 'Pregnancy'],
    contraindicationsAr: ['احتشاء قلبي أو سكتة حديثة (خلال 6 أشهر)', 'قصور قلب شديد (درجة III/IV)', 'إحصار أذيني بطيني من النوع الثاني أو الدرجة الثالثة', 'مضادات اضطراب النظم فئة Ia/III المتزامنة', 'الحمل'],
    monitoringRequired: ['First-dose: ECG continuous 6 hours, HR/BP hourly', 'CBC before and periodically', 'LFTs before and q3 months', 'Ophthalmologic exam at 3-4 months (macular edema)', 'VZV antibody before starting', 'PML vigilance — MRI annually'], storageConditions: 'Store at 15-30°C. Protect from moisture.'
  },

  // ─── Allergy Treatments (4) ───
  {
    id: 'FRM-0796', genericName: 'Allergen Immunotherapy Extract (Subcutaneous)', genericNameAr: 'مستخلص العلاج المناعي للحساسية (تحت الجلد)', brandNames: ['ALK-Abelló SCIT', 'Stallergenes'],
    sfda_registration: 'SFDA-ALIT-796', atcCode: 'V01AA20', atcCategory: 'Allergens — Allergen Extracts',
    therapeuticClass: 'Allergen-Specific Immunotherapy', therapeuticClassAr: 'علاج مناعي نوعي للمستأرجات',
    formularyStatus: 'restricted',
    restrictionCriteria: 'Allergic rhinitis/asthma with confirmed IgE-mediated sensitization. Requires allergist/immunologist approval',
    restrictionCriteriaAr: 'التهاب الأنف التحسسي/الربو مع تحسس IgE مؤكد. يتطلب موافقة أخصائي حساسية/مناعة',
    approverRole: 'allergist',
    route: ['subcutaneous'], forms: [
      { form: 'Solution for injection', strength: 'Patient-specific (maintenance 1:100 w/v)', unitPrice: 350.00, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Sublingual immunotherapy tablets'],
    blackBoxWarning: 'Risk of anaphylaxis. Must be administered in a medical facility with resuscitation equipment. Observe patient 30 minutes post-injection.',
    blackBoxWarningAr: 'خطر الحساسية المفرطة. يجب إعطاؤه في منشأة طبية مع معدات إنعاش. مراقبة المريض 30 دقيقة بعد الحقن.',
    interactions: [
      { interactsWith: 'Beta-blockers', severity: 'major', mechanism: 'May increase severity of anaphylaxis and reduce epinephrine effectiveness', clinicalEffect: 'Refractory anaphylaxis', clinicalEffectAr: 'حساسية مفرطة مقاومة للعلاج', management: 'Relative contraindication; assess risk/benefit with allergist', managementAr: 'موانع نسبية؛ تقييم المخاطر/الفوائد مع أخصائي الحساسية' },
      { interactsWith: 'ACE inhibitors', severity: 'moderate', mechanism: 'Increased risk of angioedema during immunotherapy', clinicalEffect: 'Angioedema', clinicalEffectAr: 'وذمة وعائية', management: 'Monitor closely; consider switching antihypertensive', managementAr: 'مراقبة دقيقة؛ النظر في تبديل خافض الضغط' }
    ],
    contraindications: ['Severe/uncontrolled asthma (FEV1 < 70%)', 'Concurrent beta-blocker therapy (relative)', 'Systemic immunotherapy during pregnancy initiation'],
    contraindicationsAr: ['ربو شديد/غير مسيطر عليه (FEV1 < 70%)', 'علاج متزامن بحاصرات بيتا (نسبي)', 'بدء العلاج المناعي الجهازي أثناء الحمل'],
    monitoringRequired: ['Observe 30 min post-injection', 'Peak flow before each injection if asthmatic', 'Epinephrine auto-injector available', 'Injection site reactions'], storageConditions: 'Store at 2-8°C. Do not freeze. Patient-specific — label clearly.'
  },
  {
    id: 'FRM-0797', genericName: 'Benralizumab', genericNameAr: 'بينراليزوماب', brandNames: ['Fasenra'],
    sfda_registration: 'SFDA-BENR-797', atcCode: 'R03DX10', atcCategory: 'Other Systemic Drugs for Obstructive Airway Diseases',
    therapeuticClass: 'Anti-IL-5 Receptor Alpha Monoclonal Antibody', therapeuticClassAr: 'جسم مضاد وحيد النسيلة مضاد لمستقبل IL-5 ألفا',
    formularyStatus: 'restricted',
    restrictionCriteria: 'Severe eosinophilic asthma uncontrolled on high-dose ICS+LABA. Requires pulmonologist approval. Eosinophil count ≥300 cells/µL',
    restrictionCriteriaAr: 'الربو الحمضي الشديد غير المسيطر عليه بجرعة عالية ICS+LABA. يتطلب موافقة أخصائي الرئة. تعداد الحمضات ≥300 خلية/ميكرولتر',
    approverRole: 'pulmonologist',
    route: ['subcutaneous'], forms: [{ form: 'Solution for injection (prefilled syringe)', strength: '30 mg/mL', unitPrice: 4200.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: false, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Mepolizumab', 'Reslizumab'],
    interactions: [
      { interactsWith: 'Live vaccines', severity: 'moderate', mechanism: 'Theoretical immunomodulatory effect', clinicalEffect: 'Uncertain vaccine response', clinicalEffectAr: 'استجابة لقاحية غير مؤكدة', management: 'Complete live vaccinations before initiating; avoid during treatment', managementAr: 'إكمال التطعيمات الحية قبل البدء؛ تجنبها أثناء العلاج' }
    ],
    contraindications: ['Hypersensitivity to benralizumab', 'Acute bronchospasm or status asthmaticus'],
    contraindicationsAr: ['فرط حساسية للبينراليزوماب', 'تشنج قصبي حاد أو حالة ربو مستمرة'],
    monitoringRequired: ['Eosinophil count (expect near-zero depletion)', 'Helminth infection screening before initiation', 'Injection site reactions', 'Anaphylaxis observation'], storageConditions: 'Store at 2-8°C. Do not freeze. Protect from light.'
  },
  {
    id: 'FRM-0798', genericName: 'Montelukast Sodium (Injectable)', genericNameAr: 'مونتيلوكاست صوديوم (حقن)', brandNames: ['Singulair IV'],
    sfda_registration: 'SFDA-MONT-798', atcCode: 'R03DC03', atcCategory: 'Leukotriene Receptor Antagonists',
    therapeuticClass: 'Leukotriene Receptor Antagonist (Parenteral)', therapeuticClassAr: 'مضاد مستقبلات الليوكوترين (حقني)',
    formularyStatus: 'conditional',
    restrictionCriteria: 'Acute severe asthma when oral route unavailable. Emergency/ICU use only',
    restrictionCriteriaAr: 'ربو حاد شديد عندما يكون الطريق الفموي غير متاح. للاستخدام في الطوارئ/العناية المركزة فقط',
    route: ['intravenous'], forms: [{ form: 'Solution for injection', strength: '7 mg/mL', unitPrice: 280.00, inStock: true }],
    renalAdjustment: false, hepaticAdjustment: true,
    pregnancyCategory: 'B', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false,
    highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Montelukast oral'],
    blackBoxWarning: 'Neuropsychiatric events (agitation, depression, suicidal thinking) have been reported. Monitor for behavioral changes.',
    blackBoxWarningAr: 'تم الإبلاغ عن أحداث عصبية نفسية (هياج، اكتئاب، أفكار انتحارية). مراقبة التغيرات السلوكية.',
    interactions: [
      { interactsWith: 'Phenobarbital', severity: 'moderate', mechanism: 'CYP3A4 induction reduces montelukast levels', clinicalEffect: 'Decreased montelukast efficacy', clinicalEffectAr: 'انخفاض فعالية مونتيلوكاست', management: 'Monitor clinical response; higher doses may be needed', managementAr: 'مراقبة الاستجابة السريرية؛ قد تكون هناك حاجة لجرعات أعلى' },
      { interactsWith: 'Gemfibrozil', severity: 'moderate', mechanism: 'CYP2C8 inhibition increases montelukast exposure', clinicalEffect: 'Increased montelukast levels ~4.4-fold', clinicalEffectAr: 'زيادة مستويات مونتيلوكاست ~4.4 ضعف', management: 'Monitor for adverse effects; dose adjustment may be needed', managementAr: 'مراقبة الآثار الجانبية؛ قد يلزم تعديل الجرعة' }
    ],
    contraindications: ['Hypersensitivity to montelukast', 'Phenylketonuria (some oral forms contain phenylalanine)'],
    contraindicationsAr: ['فرط حساسية للمونتيلوكاست', 'بيلة الفينيل كيتون (بعض الأشكال الفموية تحتوي على فينيل ألانين)'],
    monitoringRequired: ['Respiratory function', 'Neuropsychiatric symptoms', 'Hepatic function in hepatic impairment'], storageConditions: 'Store at 15-30°C. Protect from light and moisture.'
  },
  {
    id: 'FRM-0799', genericName: 'Epinephrine Auto-Injector', genericNameAr: 'حاقن الإبينفرين الذاتي', brandNames: ['EpiPen', 'EpiPen Jr', 'Auvi-Q', 'Jext'],
    sfda_registration: 'SFDA-EPI-799', atcCode: 'C01CA24', atcCategory: 'Cardiac Stimulants — Adrenergic',
    therapeuticClass: 'Sympathomimetic (Emergency Anaphylaxis)', therapeuticClassAr: 'محاكي الودي (طوارئ الحساسية المفرطة)',
    formularyStatus: 'formulary',
    route: ['intramuscular'], forms: [
      { form: 'Auto-injector', strength: '0.15 mg (pediatric ≥15-30 kg)', unitPrice: 280.00, inStock: true },
      { form: 'Auto-injector', strength: '0.3 mg (adult ≥30 kg)', unitPrice: 280.00, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false,
    pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: true,
    highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['EpiPen vs EpiPen Jr — dose confusion'],
    interactions: [
      { interactsWith: 'Beta-blockers', severity: 'major', mechanism: 'Unopposed alpha-stimulation; reduced epinephrine effectiveness', clinicalEffect: 'Severe hypertension; refractory anaphylaxis', clinicalEffectAr: 'ارتفاع ضغط شديد؛ حساسية مفرطة مقاومة', management: 'Epinephrine still indicated — may need higher doses and glucagon as adjunct', managementAr: 'الإبينفرين لا يزال مطلوباً — قد تلزم جرعات أعلى وغلوكاغون كمساعد' },
      { interactsWith: 'Tricyclic antidepressants', severity: 'major', mechanism: 'Potentiation of sympathomimetic effects', clinicalEffect: 'Severe hypertension, arrhythmias', clinicalEffectAr: 'ارتفاع ضغط شديد، اضطرابات نظم القلب', management: 'Use with caution; benefit outweighs risk in anaphylaxis', managementAr: 'استخدام بحذر؛ الفائدة تفوق المخاطر في الحساسية المفرطة' },
      { interactsWith: 'MAO inhibitors', severity: 'major', mechanism: 'Impaired catecholamine metabolism', clinicalEffect: 'Hypertensive crisis', clinicalEffectAr: 'أزمة ارتفاع ضغط', management: 'Still administer for anaphylaxis — life-saving; monitor closely', managementAr: 'لا يزال يُعطى للحساسية المفرطة — منقذ للحياة؛ مراقبة دقيقة' }
    ],
    contraindications: ['None absolute in anaphylaxis — always administer if indicated'],
    contraindicationsAr: ['لا موانع مطلقة في الحساسية المفرطة — يُعطى دائماً عند الحاجة'],
    monitoringRequired: ['Vital signs post-administration', 'Biphasic reaction monitoring 4-6 hours', 'Expiry date check on device', 'Patient/caregiver injection technique training'], storageConditions: 'Store at 20-25°C. Do not refrigerate or freeze. Protect from light. Check window for discoloration/particles. Replace before expiry date.'
  }
];
