/**
 * Saudi MOH Drug Formulary — Drug Data Part 12
 * Diagnostic Agents, Antidotes & Reversal Agents
 * IDs: FRM-0680 through FRM-0719
 */
import type { FormularyDrug } from './formularyTypes';

export const DIAGNOSTIC_ANTIDOTES: FormularyDrug[] = [
  // ─── CONTRAST MEDIA (5) ───
  {
    id: 'FRM-0680', genericName: 'Iohexol', genericNameAr: 'يوهيكسول', brandNames: ['Omnipaque'],
    sfda_registration: 'SFDA-IOH-680', atcCode: 'V08AB02', atcCategory: 'Iodinated Contrast Media',
    therapeuticClass: 'Non-ionic Iodinated Contrast Agent', therapeuticClassAr: 'مادة تباين يودية غير أيونية',
    formularyStatus: 'formulary', route: ['IV', 'intrathecal', 'intra-articular'],
    forms: [
      { form: 'Solution', strength: '300 mg I/mL 50 mL', unitPrice: 85.0, inStock: true },
      { form: 'Solution', strength: '300 mg I/mL 100 mL', unitPrice: 145.0, inStock: true },
      { form: 'Solution', strength: '350 mg I/mL 100 mL', unitPrice: 165.0, inStock: true }
    ],
    renalAdjustment: true, hepaticAdjustment: false, pregnancyCategory: 'B', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Iopamidol', 'Iodixanol'],
    blackBoxWarning: 'Risk of contrast-induced nephropathy; ensure adequate hydration. Severe allergic reactions including anaphylaxis may occur.',
    blackBoxWarningAr: 'خطر اعتلال الكلى الناتج عن التباين؛ تأكد من الترطيب الكافي. قد تحدث تفاعلات تحسسية شديدة بما في ذلك التأق.',
    interactions: [
      { interactsWith: 'Metformin', severity: 'major', mechanism: 'Risk of lactic acidosis in renal impairment', clinicalEffect: 'Lactic acidosis risk post-contrast', clinicalEffectAr: 'خطر الحماض اللبني بعد التباين', management: 'Hold metformin 48h before and after; check renal function', managementAr: 'أوقف الميتفورمين 48 ساعة قبل وبعد؛ افحص وظائف الكلى' },
      { interactsWith: 'NSAIDs', severity: 'moderate', mechanism: 'Additive nephrotoxicity', clinicalEffect: 'Increased contrast nephropathy risk', clinicalEffectAr: 'زيادة خطر اعتلال الكلى بالتباين', management: 'Avoid NSAIDs peri-procedure; hydrate well', managementAr: 'تجنب مضادات الالتهاب حول الإجراء؛ رطّب جيداً' }
    ],
    contraindications: ['Known iodine hypersensitivity', 'Thyrotoxicosis (relative)'],
    contraindicationsAr: ['فرط حساسية معروف لليود', 'تسمم درقي (نسبي)'],
    monitoringRequired: ['Serum creatinine before/after', 'eGFR', 'Monitor for allergic reactions 30 min post-injection'],
    storageConditions: 'Store at 15-30°C, protect from light, do not freeze'
  },
  {
    id: 'FRM-0681', genericName: 'Iopamidol', genericNameAr: 'يوباميدول', brandNames: ['Isovue'],
    sfda_registration: 'SFDA-IOP-681', atcCode: 'V08AB04', atcCategory: 'Iodinated Contrast Media',
    therapeuticClass: 'Non-ionic Iodinated Contrast Agent', therapeuticClassAr: 'مادة تباين يودية غير أيونية',
    formularyStatus: 'formulary', route: ['IV', 'intra-arterial'],
    forms: [
      { form: 'Solution', strength: '370 mg I/mL 50 mL', unitPrice: 90.0, inStock: true },
      { form: 'Solution', strength: '370 mg I/mL 100 mL', unitPrice: 155.0, inStock: true }
    ],
    renalAdjustment: true, hepaticAdjustment: false, pregnancyCategory: 'B', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Iohexol', 'Ioversol'],
    interactions: [
      { interactsWith: 'Metformin', severity: 'major', mechanism: 'Risk of lactic acidosis with renal impairment', clinicalEffect: 'Lactic acidosis', clinicalEffectAr: 'حماض لبني', management: 'Withhold metformin 48h peri-procedure', managementAr: 'أوقف الميتفورمين 48 ساعة حول الإجراء' }
    ],
    contraindications: ['Severe iodine allergy', 'Severe renal failure without dialysis access'],
    contraindicationsAr: ['حساسية شديدة لليود', 'فشل كلوي شديد بدون غسيل كلوي'],
    monitoringRequired: ['Serum creatinine', 'eGFR', 'Allergy observation 30 min'],
    storageConditions: 'Store at 20-25°C, protect from light'
  },
  {
    id: 'FRM-0682', genericName: 'Gadopentetate dimeglumine', genericNameAr: 'جادوبنتتات ثنائي الميغلومين', brandNames: ['Magnevist'],
    sfda_registration: 'SFDA-GAD-682', atcCode: 'V08CA01', atcCategory: 'Paramagnetic Contrast Media',
    therapeuticClass: 'Gadolinium-based MRI Contrast Agent', therapeuticClassAr: 'مادة تباين رنين مغناطيسي قائمة على الجادولينيوم',
    formularyStatus: 'formulary', route: ['IV'],
    forms: [
      { form: 'Solution', strength: '469.01 mg/mL (0.5 mmol/mL) 15 mL', unitPrice: 120.0, inStock: true },
      { form: 'Solution', strength: '469.01 mg/mL (0.5 mmol/mL) 20 mL', unitPrice: 150.0, inStock: true }
    ],
    renalAdjustment: true, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Gadobutrol', 'Gadoterate'],
    blackBoxWarning: 'Risk of nephrogenic systemic fibrosis (NSF) in patients with severe renal insufficiency (GFR <30). Screen renal function before use.',
    blackBoxWarningAr: 'خطر التليف الجهازي الكلوي المنشأ في مرضى القصور الكلوي الشديد. افحص وظائف الكلى قبل الاستخدام.',
    interactions: [
      { interactsWith: 'Nephrotoxic drugs', severity: 'major', mechanism: 'Additive renal toxicity increases NSF risk', clinicalEffect: 'Nephrogenic systemic fibrosis', clinicalEffectAr: 'تليف جهازي كلوي المنشأ', management: 'Ensure eGFR >30; avoid in severe renal impairment', managementAr: 'تأكد أن معدل الترشيح الكبيبي >30؛ تجنب في القصور الكلوي الشديد' }
    ],
    contraindications: ['eGFR <30 mL/min (relative)', 'Known gadolinium hypersensitivity'],
    contraindicationsAr: ['معدل ترشيح كبيبي أقل من 30 (نسبي)', 'فرط حساسية معروف للجادولينيوم'],
    monitoringRequired: ['eGFR within 7 days before injection', 'Observe for allergic reactions', 'Monitor for NSF signs in renal patients'],
    storageConditions: 'Store at 15-30°C, protect from light and freezing'
  },
  {
    id: 'FRM-0683', genericName: 'Barium sulfate', genericNameAr: 'كبريتات الباريوم', brandNames: ['E-Z-Paque', 'Readi-Cat'],
    sfda_registration: 'SFDA-BAR-683', atcCode: 'V08BA01', atcCategory: 'Barium Sulfate Contrast',
    therapeuticClass: 'GI Contrast Agent', therapeuticClassAr: 'مادة تباين للجهاز الهضمي',
    formularyStatus: 'formulary', route: ['oral', 'rectal'],
    forms: [
      { form: 'Suspension', strength: '60% w/v 450 mL', unitPrice: 25.0, inStock: true },
      { form: 'Suspension', strength: '98% w/w powder for reconstitution', unitPrice: 18.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'B', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: [],
    interactions: [],
    contraindications: ['Suspected GI perforation', 'GI obstruction', 'Tracheoesophageal fistula'],
    contraindicationsAr: ['اشتباه ثقب في الجهاز الهضمي', 'انسداد معوي', 'ناسور رغامي مريئي'],
    monitoringRequired: ['Post-procedure bowel movements', 'Watch for aspiration if oral'],
    storageConditions: 'Store at 20-25°C'
  },
  {
    id: 'FRM-0684', genericName: 'Fluorescein sodium (ophthalmic)', genericNameAr: 'فلوريسين صوديوم (عيني)', brandNames: ['Fluorescite', 'AK-Fluor'],
    sfda_registration: 'SFDA-FLU-684', atcCode: 'S01JA01', atcCategory: 'Ophthalmic Diagnostic Agent',
    therapeuticClass: 'Ophthalmic Diagnostic Dye', therapeuticClassAr: 'صبغة تشخيصية عينية',
    formularyStatus: 'formulary', route: ['IV', 'topical ophthalmic'],
    forms: [
      { form: 'Injection', strength: '10% 5 mL', unitPrice: 45.0, inStock: true },
      { form: 'Strips', strength: '1 mg ophthalmic strips', unitPrice: 2.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Indocyanine green'],
    interactions: [],
    contraindications: ['Known fluorescein hypersensitivity'],
    contraindicationsAr: ['فرط حساسية معروف للفلوريسين'],
    monitoringRequired: ['Monitor for anaphylaxis with IV use', 'Skin/urine discoloration (normal, warn patient)'],
    storageConditions: 'Store at 15-30°C, protect from light'
  },

  // ─── ANTIDOTES (15) ───
  {
    id: 'FRM-0685', genericName: 'N-Acetylcysteine', genericNameAr: 'ن-أسيتيل سيستين', brandNames: ['Acetadote', 'Mucomyst', 'Parvolex'],
    sfda_registration: 'SFDA-NAC-685', atcCode: 'V03AB23', atcCategory: 'Antidotes',
    therapeuticClass: 'Paracetamol Poisoning Antidote', therapeuticClassAr: 'ترياق تسمم الباراسيتامول',
    formularyStatus: 'formulary', route: ['IV', 'oral'],
    forms: [
      { form: 'Injection', strength: '200 mg/mL 10 mL', unitPrice: 65.0, inStock: true },
      { form: 'Solution', strength: '200 mg/mL oral 10 mL', unitPrice: 15.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'B', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Acetazolamide'],
    interactions: [
      { interactsWith: 'Activated charcoal', severity: 'moderate', mechanism: 'Charcoal may adsorb oral NAC', clinicalEffect: 'Reduced oral NAC efficacy', clinicalEffectAr: 'انخفاض فعالية NAC الفموي', management: 'If charcoal given, use IV NAC or wait 2h', managementAr: 'إذا أُعطي الفحم، استخدم NAC وريدياً أو انتظر ساعتين' }
    ],
    contraindications: ['Known NAC hypersensitivity (rare)'],
    contraindicationsAr: ['فرط حساسية معروف لـ NAC (نادر)'],
    monitoringRequired: ['Paracetamol level at 4h post-ingestion', 'ALT/AST', 'INR', 'Creatinine', 'Anaphylactoid reactions during IV infusion'],
    storageConditions: 'Store at 20-25°C; opened oral vials use within 96h'
  },
  {
    id: 'FRM-0686', genericName: 'Naloxone', genericNameAr: 'نالوكسون', brandNames: ['Narcan'],
    sfda_registration: 'SFDA-NAL-686', atcCode: 'V03AB15', atcCategory: 'Antidotes',
    therapeuticClass: 'Opioid Antagonist / Reversal Agent', therapeuticClassAr: 'مضاد أفيوني / عامل عكس',
    formularyStatus: 'formulary', route: ['IV', 'IM', 'SC', 'intranasal', 'endotracheal'],
    forms: [
      { form: 'Injection', strength: '0.4 mg/mL 1 mL', unitPrice: 22.0, inStock: true },
      { form: 'Injection', strength: '1 mg/mL 2 mL', unitPrice: 35.0, inStock: true },
      { form: 'Nasal spray', strength: '4 mg/0.1 mL', unitPrice: 85.0, inStock: true }
    ],
    maxDailyDose: 10, maxDailyDoseUnit: 'mg',
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Naltrexone', 'Lanoxin'],
    interactions: [
      { interactsWith: 'Opioids', severity: 'major', mechanism: 'Competitive mu-receptor antagonism', clinicalEffect: 'Acute opioid withdrawal in dependent patients', clinicalEffectAr: 'انسحاب أفيوني حاد في المرضى المعتمدين', management: 'Titrate carefully in opioid-dependent patients; start with 0.04-0.1 mg increments', managementAr: 'عاير بعناية في المرضى المعتمدين على الأفيونات؛ ابدأ بجرعات 0.04-0.1 ملغ' }
    ],
    contraindications: ['Known naloxone hypersensitivity'],
    contraindicationsAr: ['فرط حساسية معروف للنالوكسون'],
    monitoringRequired: ['Respiratory rate', 'Level of consciousness', 'Oxygen saturation', 'Re-sedation monitoring (opioid t½ > naloxone t½)'],
    storageConditions: 'Store at 20-25°C, protect from light'
  },
  {
    id: 'FRM-0687', genericName: 'Flumazenil', genericNameAr: 'فلومازينيل', brandNames: ['Anexate', 'Romazicon'],
    sfda_registration: 'SFDA-FLZ-687', atcCode: 'V03AB25', atcCategory: 'Antidotes',
    therapeuticClass: 'Benzodiazepine Antagonist', therapeuticClassAr: 'مضاد البنزوديازيبين',
    formularyStatus: 'formulary', route: ['IV'],
    forms: [
      { form: 'Injection', strength: '0.1 mg/mL 5 mL', unitPrice: 55.0, inStock: true },
      { form: 'Injection', strength: '0.1 mg/mL 10 mL', unitPrice: 95.0, inStock: true }
    ],
    maxDailyDose: 5, maxDailyDoseUnit: 'mg',
    renalAdjustment: false, hepaticAdjustment: true, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Fluconazole'],
    blackBoxWarning: 'Risk of seizures, especially in patients with benzodiazepine dependence or mixed overdose with pro-convulsant agents (e.g., tricyclics).',
    blackBoxWarningAr: 'خطر نوبات صرعية، خاصة في المرضى المعتمدين على البنزوديازيبينات أو الجرعة الزائدة المختلطة مع أدوية محفزة للتشنجات.',
    interactions: [
      { interactsWith: 'Tricyclic antidepressants', severity: 'major', mechanism: 'Removal of BZD protective effect unmasks TCA seizure risk', clinicalEffect: 'Seizures', clinicalEffectAr: 'نوبات صرعية', management: 'Avoid flumazenil in mixed TCA/BZD overdose', managementAr: 'تجنب الفلومازينيل في الجرعة الزائدة المختلطة من ثلاثية الحلقات/بنزوديازيبينات' }
    ],
    contraindications: ['Known BZD dependence (seizure risk)', 'Mixed overdose with pro-convulsant drugs', 'Raised intracranial pressure'],
    contraindicationsAr: ['اعتماد معروف على البنزوديازيبينات', 'جرعة زائدة مختلطة مع أدوية محفزة للتشنجات', 'ارتفاع الضغط داخل الجمجمة'],
    monitoringRequired: ['Level of consciousness', 'Seizure activity', 'Re-sedation (BZD t½ > flumazenil t½)', 'Respiratory status'],
    storageConditions: 'Store at 20-25°C'
  },
  {
    id: 'FRM-0688', genericName: 'Protamine sulfate', genericNameAr: 'بروتامين سلفات', brandNames: ['Protamine'],
    sfda_registration: 'SFDA-PRT-688', atcCode: 'V03AB14', atcCategory: 'Antidotes',
    therapeuticClass: 'Heparin Reversal Agent', therapeuticClassAr: 'عامل عكس الهيبارين',
    formularyStatus: 'formulary', route: ['IV'],
    forms: [
      { form: 'Injection', strength: '10 mg/mL 5 mL', unitPrice: 28.0, inStock: true }
    ],
    maxDailyDose: 50, maxDailyDoseUnit: 'mg',
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: [],
    blackBoxWarning: 'Risk of severe hypotension, bradycardia, and anaphylaxis. Administer slowly (no faster than 5 mg/min). Higher risk in patients with fish allergy or prior protamine exposure.',
    blackBoxWarningAr: 'خطر انخفاض ضغط شديد وبطء القلب والتأق. أعطِ ببطء (لا أسرع من 5 ملغ/دقيقة). خطر أعلى في مرضى حساسية السمك أو التعرض السابق للبروتامين.',
    interactions: [
      { interactsWith: 'Heparin', severity: 'major', mechanism: 'Ionic binding neutralizes heparin anticoagulant effect', clinicalEffect: 'Heparin reversal; excess protamine has own anticoagulant effect', clinicalEffectAr: 'عكس الهيبارين؛ فائض البروتامين له تأثير مضاد تخثر خاص', management: '1 mg protamine per 100 units heparin; do not exceed', managementAr: '1 ملغ بروتامين لكل 100 وحدة هيبارين؛ لا تتجاوز الجرعة' }
    ],
    contraindications: ['Known protamine/fish allergy (relative)'],
    contraindicationsAr: ['حساسية معروفة للبروتامين/السمك (نسبي)'],
    monitoringRequired: ['aPTT', 'ACT', 'Blood pressure', 'Heart rate', 'Signs of anaphylaxis'],
    storageConditions: 'Refrigerate 2-8°C; do not freeze'
  },
  {
    id: 'FRM-0689', genericName: 'Phytonadione (Vitamin K1)', genericNameAr: 'فيتوناديون (فيتامين ك1)', brandNames: ['Konakion', 'Mephyton'],
    sfda_registration: 'SFDA-VTK-689', atcCode: 'B02BA01', atcCategory: 'Vitamin K and Other Hemostatics',
    therapeuticClass: 'Warfarin Reversal / Vitamin K Supplement', therapeuticClassAr: 'عامل عكس الوارفارين / مكمل فيتامين ك',
    formularyStatus: 'formulary', route: ['IV', 'oral', 'SC'],
    forms: [
      { form: 'Injection', strength: '10 mg/mL 1 mL', unitPrice: 12.0, inStock: true },
      { form: 'Tablet', strength: '5 mg', unitPrice: 1.5, inStock: true },
      { form: 'Injection', strength: '1 mg/0.5 mL (neonatal)', unitPrice: 8.0, inStock: true }
    ],
    maxDailyDose: 25, maxDailyDoseUnit: 'mg',
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Vitamin K3 (menadione)'],
    interactions: [
      { interactsWith: 'Warfarin', severity: 'major', mechanism: 'Restores vitamin K-dependent clotting factor synthesis', clinicalEffect: 'Reverses anticoagulation; may cause warfarin resistance for days', clinicalEffectAr: 'يعكس التخثر؛ قد يسبب مقاومة الوارفارين لأيام', management: 'Use lowest effective dose; oral preferred for non-urgent INR correction', managementAr: 'استخدم أقل جرعة فعالة؛ يُفضل الفموي لتصحيح INR غير العاجل' }
    ],
    contraindications: ['Known hypersensitivity'],
    contraindicationsAr: ['فرط حساسية معروف'],
    monitoringRequired: ['INR at 6h and 24h post-dose', 'Signs of bleeding', 'Anaphylaxis risk with IV (give slowly)'],
    storageConditions: 'Store at 15-30°C, protect from light'
  },
  {
    id: 'FRM-0690', genericName: 'Idarucizumab', genericNameAr: 'إيداروسيزوماب', brandNames: ['Praxbind'],
    sfda_registration: 'SFDA-IDA-690', atcCode: 'V03AB37', atcCategory: 'Antidotes',
    therapeuticClass: 'Dabigatran Reversal Agent', therapeuticClassAr: 'عامل عكس الدابيجاتران',
    formularyStatus: 'restricted',
    restrictionCriteria: 'Life-threatening or uncontrolled bleeding in patients on dabigatran, or need for emergency surgery',
    restrictionCriteriaAr: 'نزيف مهدد للحياة أو غير مسيطر عليه في مرضى الدابيجاتران، أو الحاجة لجراحة طارئة',
    approverRole: 'hematologist',
    route: ['IV'],
    forms: [
      { form: 'Injection', strength: '2.5 g/50 mL (2 vials = full dose)', unitPrice: 8500.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: [],
    interactions: [],
    contraindications: ['Known hypersensitivity to idarucizumab'],
    contraindicationsAr: ['فرط حساسية معروف للإيداروسيزوماب'],
    monitoringRequired: ['dTT or ECT before and after', 'aPTT', 'Bleeding assessment', 'Thrombotic events post-reversal'],
    storageConditions: 'Refrigerate 2-8°C; do not freeze; may keep at room temp up to 48h'
  },
  {
    id: 'FRM-0691', genericName: 'Andexanet alfa', genericNameAr: 'أنديكسانيت ألفا', brandNames: ['Andexxa', 'Ondexxya'],
    sfda_registration: 'SFDA-ANX-691', atcCode: 'V03AB38', atcCategory: 'Antidotes',
    therapeuticClass: 'Factor Xa Inhibitor Reversal Agent', therapeuticClassAr: 'عامل عكس مثبطات العامل العاشر',
    formularyStatus: 'restricted',
    restrictionCriteria: 'Life-threatening bleeding in patients on apixaban or rivaroxaban only',
    restrictionCriteriaAr: 'نزيف مهدد للحياة في مرضى أبيكسابان أو ريفاروكسابان فقط',
    approverRole: 'hematologist',
    route: ['IV'],
    forms: [
      { form: 'Powder for injection', strength: '200 mg vial (low-dose: 400 mg bolus + 480 mg infusion)', unitPrice: 12000.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: [],
    blackBoxWarning: 'Risk of thromboembolic events, including stroke, MI, DVT, PE post-reversal. Resume anticoagulation as soon as medically appropriate.',
    blackBoxWarningAr: 'خطر أحداث تخثرية بما في ذلك السكتة والجلطة القلبية والتخثر الوريدي بعد العكس. استأنف مضادات التخثر في أقرب وقت مناسب طبياً.',
    interactions: [
      { interactsWith: 'Heparin', severity: 'moderate', mechanism: 'Andexanet also reverses heparin partially', clinicalEffect: 'Unintended heparin reversal', clinicalEffectAr: 'عكس غير مقصود للهيبارين', management: 'Be aware of anti-Xa reversal breadth', managementAr: 'كن على علم بنطاق عكس مضاد العامل العاشر' }
    ],
    contraindications: ['Known hypersensitivity'],
    contraindicationsAr: ['فرط حساسية معروف'],
    monitoringRequired: ['Anti-Xa levels', 'Bleeding assessment', 'Thrombotic event monitoring for 30 days', 'Infusion reactions'],
    storageConditions: 'Refrigerate 2-8°C; reconstituted solution use within 8h'
  },
  {
    id: 'FRM-0692', genericName: 'Sugammadex', genericNameAr: 'سوغاماديكس', brandNames: ['Bridion'],
    sfda_registration: 'SFDA-SUG-692', atcCode: 'V03AB35', atcCategory: 'Antidotes',
    therapeuticClass: 'Neuromuscular Block Reversal Agent', therapeuticClassAr: 'عامل عكس الحصار العصبي العضلي',
    formularyStatus: 'formulary', route: ['IV'],
    forms: [
      { form: 'Injection', strength: '100 mg/mL 2 mL', unitPrice: 180.0, inStock: true },
      { form: 'Injection', strength: '100 mg/mL 5 mL', unitPrice: 420.0, inStock: true }
    ],
    renalAdjustment: true, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: [],
    interactions: [
      { interactsWith: 'Hormonal contraceptives', severity: 'major', mechanism: 'Sugammadex binds progesterone; may reduce efficacy', clinicalEffect: 'Contraceptive failure', clinicalEffectAr: 'فشل وسائل منع الحمل', management: 'Advise additional contraception for 7 days post-dose', managementAr: 'انصح بوسيلة منع حمل إضافية لمدة 7 أيام بعد الجرعة' },
      { interactsWith: 'Toremifene', severity: 'moderate', mechanism: 'Competitive displacement from sugammadex binding', clinicalEffect: 'Delayed recovery from neuromuscular blockade', clinicalEffectAr: 'تأخر التعافي من الحصار العصبي العضلي', management: 'Monitor TOF closely', managementAr: 'راقب TOF عن كثب' }
    ],
    contraindications: ['Known sugammadex hypersensitivity'],
    contraindicationsAr: ['فرط حساسية معروف للسوغاماديكس'],
    monitoringRequired: ['Train-of-four (TOF) ratio', 'Respiratory function', 'Anaphylaxis observation', 'Renal function if CrCl <30'],
    storageConditions: 'Store at 20-25°C; opened vials use within 24h'
  },
  {
    id: 'FRM-0693', genericName: 'Neostigmine', genericNameAr: 'نيوستيغمين', brandNames: ['Prostigmin'],
    sfda_registration: 'SFDA-NEO-693', atcCode: 'N07AA01', atcCategory: 'Parasympathomimetics',
    therapeuticClass: 'Acetylcholinesterase Inhibitor / NMB Reversal', therapeuticClassAr: 'مثبط أسيتيل كولينستراز / عكس الحصار العصبي',
    formularyStatus: 'formulary', route: ['IV', 'IM', 'SC'],
    forms: [
      { form: 'Injection', strength: '0.5 mg/mL 1 mL', unitPrice: 8.0, inStock: true },
      { form: 'Injection', strength: '2.5 mg/mL 1 mL', unitPrice: 12.0, inStock: true }
    ],
    maxDailyDose: 5, maxDailyDoseUnit: 'mg',
    renalAdjustment: true, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Physostigmine'],
    interactions: [
      { interactsWith: 'Atropine', severity: 'moderate', mechanism: 'Co-administered to counteract muscarinic side effects', clinicalEffect: 'Prevents bradycardia/secretions from neostigmine', clinicalEffectAr: 'يمنع بطء القلب والإفرازات من النيوستيغمين', management: 'Always give atropine 0.02 mg/kg or glycopyrrolate with neostigmine', managementAr: 'أعطِ دائماً أتروبين 0.02 ملغ/كغ أو غليكوبيرولات مع النيوستيغمين' }
    ],
    contraindications: ['Mechanical GI or urinary obstruction', 'Peritonitis'],
    contraindicationsAr: ['انسداد ميكانيكي في الجهاز الهضمي أو البولي', 'التهاب الصفاق'],
    monitoringRequired: ['TOF ratio', 'Heart rate', 'Respiratory adequacy', 'Secretions'],
    storageConditions: 'Store at 20-25°C, protect from light'
  },
  {
    id: 'FRM-0694', genericName: 'Deferoxamine', genericNameAr: 'ديفيروكسامين', brandNames: ['Desferal'],
    sfda_registration: 'SFDA-DFX-694', atcCode: 'V03AC01', atcCategory: 'Iron Chelating Agents',
    therapeuticClass: 'Iron Chelation Agent / Iron Poisoning Antidote', therapeuticClassAr: 'عامل استخلاب الحديد / ترياق تسمم الحديد',
    formularyStatus: 'formulary', route: ['IV', 'IM', 'SC'],
    forms: [
      { form: 'Powder for injection', strength: '500 mg vial', unitPrice: 22.0, inStock: true },
      { form: 'Powder for injection', strength: '2 g vial', unitPrice: 75.0, inStock: true }
    ],
    maxDailyDose: 6000, maxDailyDoseUnit: 'mg',
    renalAdjustment: true, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Deferasirox', 'Deferiprone'],
    interactions: [
      { interactsWith: 'Vitamin C', severity: 'moderate', mechanism: 'High-dose vitamin C increases iron mobilization; cardiac toxicity', clinicalEffect: 'Increased cardiac iron toxicity', clinicalEffectAr: 'زيادة سمية الحديد القلبية', management: 'Limit vitamin C to 200 mg/day; start only after 1 month of deferoxamine', managementAr: 'حدد فيتامين ج بـ 200 ملغ/يوم؛ ابدأ فقط بعد شهر من الديفيروكسامين' }
    ],
    contraindications: ['Severe renal disease', 'Anuria'],
    contraindicationsAr: ['مرض كلوي شديد', 'انقطاع البول'],
    monitoringRequired: ['Serum iron/ferritin', 'Renal function', 'Audiometry (ototoxicity)', 'Ophthalmology exam (retinal toxicity)', 'Growth in children'],
    storageConditions: 'Store at 25°C; reconstituted solution use within 24h'
  },
  {
    id: 'FRM-0695', genericName: 'Penicillamine', genericNameAr: 'بنسيلامين', brandNames: ['Cuprimine', 'Depen'],
    sfda_registration: 'SFDA-PEN-695', atcCode: 'M01CC01', atcCategory: 'Chelating Agents',
    therapeuticClass: 'Copper/Lead Chelation Agent', therapeuticClassAr: 'عامل استخلاب النحاس/الرصاص',
    formularyStatus: 'restricted',
    restrictionCriteria: 'Wilson disease, lead poisoning, or severe rheumatoid arthritis refractory to standard therapy',
    restrictionCriteriaAr: 'داء ويلسون أو تسمم الرصاص أو التهاب المفاصل الروماتويدي الشديد المقاوم للعلاج القياسي',
    approverRole: 'specialist',
    route: ['oral'],
    forms: [
      { form: 'Capsule', strength: '250 mg', unitPrice: 8.0, inStock: true }
    ],
    maxDailyDose: 2000, maxDailyDoseUnit: 'mg',
    renalAdjustment: true, hepaticAdjustment: false, pregnancyCategory: 'D', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Penicillin'],
    blackBoxWarning: 'Can cause aplastic anemia, agranulocytosis, thrombocytopenia, Goodpasture syndrome, and myasthenia gravis. Requires regular CBC and urinalysis monitoring.',
    blackBoxWarningAr: 'قد يسبب فقر دم لاتنسجي ونقص المحببات ونقص الصفيحات ومتلازمة غودباستشر والوهن العضلي الوبيل. يتطلب مراقبة منتظمة لتعداد الدم وتحليل البول.',
    interactions: [
      { interactsWith: 'Iron supplements', severity: 'major', mechanism: 'Iron chelation reduces penicillamine absorption', clinicalEffect: 'Reduced efficacy', clinicalEffectAr: 'انخفاض الفعالية', management: 'Separate by at least 2 hours', managementAr: 'افصل بينهما بساعتين على الأقل' },
      { interactsWith: 'Antacids', severity: 'moderate', mechanism: 'Reduced GI absorption', clinicalEffect: 'Decreased penicillamine levels', clinicalEffectAr: 'انخفاض مستويات البنسيلامين', management: 'Take on empty stomach, 1h before meals', managementAr: 'تناول على معدة فارغة، ساعة قبل الوجبات' }
    ],
    contraindications: ['Penicillamine or penicillin allergy (cross-reactivity possible)', 'Renal insufficiency (relative)', 'Pregnancy'],
    contraindicationsAr: ['حساسية البنسيلامين أو البنسلين', 'قصور كلوي (نسبي)', 'الحمل'],
    monitoringRequired: ['CBC with differential every 2 weeks initially', 'Urinalysis for proteinuria', 'Hepatic function', 'Copper/ceruloplasmin levels'],
    storageConditions: 'Store at 20-25°C'
  },
  {
    id: 'FRM-0696', genericName: 'Calcium gluconate', genericNameAr: 'غلوكونات الكالسيوم', brandNames: ['Cal-G'],
    sfda_registration: 'SFDA-CAG-696', atcCode: 'A12AA03', atcCategory: 'Calcium Supplements',
    therapeuticClass: 'Electrolyte Replenisher / HF-Hyperkalemia Antidote', therapeuticClassAr: 'معوض إلكتروليتي / ترياق فرط البوتاسيوم وحمض الهيدروفلوريك',
    formularyStatus: 'formulary', route: ['IV', 'oral', 'topical'],
    forms: [
      { form: 'Injection', strength: '10% (100 mg/mL) 10 mL', unitPrice: 5.0, inStock: true },
      { form: 'Gel', strength: '2.5% topical (HF burns)', unitPrice: 35.0, inStock: true }
    ],
    renalAdjustment: true, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Calcium chloride'],
    interactions: [
      { interactsWith: 'Digoxin', severity: 'major', mechanism: 'Hypercalcemia potentiates digoxin toxicity', clinicalEffect: 'Cardiac arrhythmias', clinicalEffectAr: 'اضطرابات نظم القلب', management: 'Give slowly with cardiac monitoring in digitalized patients', managementAr: 'أعطِ ببطء مع مراقبة قلبية في مرضى الديجوكسين' },
      { interactsWith: 'Ceftriaxone', severity: 'major', mechanism: 'Calcium-ceftriaxone precipitates in neonates', clinicalEffect: 'Fatal lung/renal precipitates in neonates', clinicalEffectAr: 'ترسبات قاتلة في الرئة/الكلى عند حديثي الولادة', management: 'Never mix or give simultaneously in neonates; separate lines in older patients', managementAr: 'لا تخلط أو تعطِ معاً في حديثي الولادة؛ استخدم خطوط منفصلة في المرضى الأكبر' }
    ],
    contraindications: ['Hypercalcemia', 'Ventricular fibrillation', 'Digitalis toxicity'],
    contraindicationsAr: ['فرط كالسيوم الدم', 'رجفان بطيني', 'تسمم الديجيتال'],
    monitoringRequired: ['Serum calcium', 'ECG during IV administration', 'Potassium level', 'Heart rate'],
    storageConditions: 'Store at 20-25°C'
  },
  {
    id: 'FRM-0697', genericName: 'Sodium bicarbonate', genericNameAr: 'بيكربونات الصوديوم', brandNames: ['NaHCO3'],
    sfda_registration: 'SFDA-NAB-697', atcCode: 'B05XA02', atcCategory: 'Electrolyte Solutions',
    therapeuticClass: 'Alkalinizing Agent / Metabolic Acidosis Treatment', therapeuticClassAr: 'عامل قلوي / علاج الحماض الأيضي',
    formularyStatus: 'formulary', route: ['IV', 'oral'],
    forms: [
      { form: 'Injection', strength: '8.4% (1 mEq/mL) 50 mL', unitPrice: 8.0, inStock: true },
      { form: 'Injection', strength: '4.2% (0.5 mEq/mL) 10 mL (neonatal)', unitPrice: 5.0, inStock: true },
      { form: 'Tablet', strength: '650 mg', unitPrice: 0.5, inStock: true }
    ],
    renalAdjustment: true, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Sodium chloride'],
    interactions: [
      { interactsWith: 'Aspirin', severity: 'moderate', mechanism: 'Urinary alkalinization increases salicylate excretion', clinicalEffect: 'Used therapeutically in salicylate poisoning', clinicalEffectAr: 'يستخدم علاجياً في تسمم الساليسيلات', management: 'Monitor urine pH; target 7.5-8.0 in poisoning', managementAr: 'راقب حموضة البول؛ الهدف 7.5-8.0 في التسمم' }
    ],
    contraindications: ['Metabolic or respiratory alkalosis', 'Hypocalcemia', 'Chloride-responsive alkalosis'],
    contraindicationsAr: ['قلاء أيضي أو تنفسي', 'نقص كالسيوم الدم', 'قلاء مستجيب للكلوريد'],
    monitoringRequired: ['Arterial blood gases', 'Serum electrolytes (Na, K, Ca, Cl)', 'Urine pH'],
    storageConditions: 'Store at 20-25°C'
  },
  {
    id: 'FRM-0698', genericName: 'Digoxin immune Fab', genericNameAr: 'أضداد ديجوكسين فاب', brandNames: ['DigiFab', 'Digibind'],
    sfda_registration: 'SFDA-DIF-698', atcCode: 'V03AB25', atcCategory: 'Antidotes',
    therapeuticClass: 'Digoxin Toxicity Reversal Agent', therapeuticClassAr: 'عامل عكس تسمم الديجوكسين',
    formularyStatus: 'restricted',
    restrictionCriteria: 'Confirmed digoxin toxicity with life-threatening arrhythmias or potassium >5 mEq/L',
    restrictionCriteriaAr: 'تسمم ديجوكسين مؤكد مع اضطرابات نظم مهددة للحياة أو بوتاسيوم أكثر من 5',
    approverRole: 'cardiologist',
    route: ['IV'],
    forms: [
      { form: 'Powder for injection', strength: '40 mg vial', unitPrice: 1800.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: [],
    interactions: [],
    contraindications: ['Known sheep protein allergy (relative)'],
    contraindicationsAr: ['حساسية معروفة لبروتين الأغنام (نسبي)'],
    monitoringRequired: ['Serum digoxin (total will be elevated; free digoxin unreliable post-Fab)', 'Potassium (may drop rapidly)', 'ECG continuous', 'Allergic reaction monitoring'],
    storageConditions: 'Refrigerate 2-8°C; reconstituted solution use within 4h'
  },
  {
    id: 'FRM-0699', genericName: 'Activated charcoal', genericNameAr: 'فحم منشط', brandNames: ['Actidose', 'CharcoAid'],
    sfda_registration: 'SFDA-ACH-699', atcCode: 'A07BA01', atcCategory: 'Adsorbent Intestinal Agents',
    therapeuticClass: 'GI Decontamination Agent', therapeuticClassAr: 'عامل تطهير الجهاز الهضمي',
    formularyStatus: 'formulary', route: ['oral', 'nasogastric'],
    forms: [
      { form: 'Suspension', strength: '50 g/250 mL with sorbitol', unitPrice: 18.0, inStock: true },
      { form: 'Suspension', strength: '25 g/120 mL (pediatric)', unitPrice: 12.0, inStock: true },
      { form: 'Powder', strength: '50 g', unitPrice: 10.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: [],
    interactions: [
      { interactsWith: 'N-Acetylcysteine (oral)', severity: 'moderate', mechanism: 'Adsorbs oral NAC reducing bioavailability', clinicalEffect: 'Reduced efficacy of oral NAC', clinicalEffectAr: 'انخفاض فعالية NAC الفموي', management: 'Use IV NAC if charcoal needed, or separate by 2h', managementAr: 'استخدم NAC وريدياً إذا لزم الفحم، أو افصل بساعتين' },
      { interactsWith: 'All oral medications', severity: 'major', mechanism: 'Non-specific adsorption of co-ingested drugs', clinicalEffect: 'Reduced absorption of other oral drugs', clinicalEffectAr: 'انخفاض امتصاص الأدوية الفموية الأخرى', management: 'Hold other oral meds 2h before and after charcoal', managementAr: 'أوقف الأدوية الفموية ساعتين قبل وبعد الفحم' }
    ],
    contraindications: ['Unprotected airway', 'GI perforation or obstruction', 'Caustic ingestion (acids/alkalis)', 'Iron, lithium, alcohol poisoning (not adsorbed)'],
    contraindicationsAr: ['مجرى هوائي غير محمي', 'ثقب أو انسداد في الجهاز الهضمي', 'ابتلاع مواد كاوية', 'تسمم بالحديد أو الليثيوم أو الكحول (لا يُمتص)'],
    monitoringRequired: ['Airway protection', 'Aspiration risk assessment', 'Bowel sounds'],
    storageConditions: 'Store at 20-25°C'
  },

  // ─── VASOPRESSORS/INOTROPES (5) ───
  {
    id: 'FRM-0700', genericName: 'Norepinephrine (Noradrenaline)', genericNameAr: 'نورإبينفرين (نورأدرينالين)', brandNames: ['Levophed'],
    sfda_registration: 'SFDA-NOR-700', atcCode: 'C01CA03', atcCategory: 'Adrenergic and Dopaminergic Agents',
    therapeuticClass: 'Vasopressor', therapeuticClassAr: 'رافع للضغط الوعائي',
    formularyStatus: 'formulary', route: ['IV'],
    forms: [
      { form: 'Injection', strength: '1 mg/mL (norepinephrine base) 4 mL', unitPrice: 18.0, inStock: true },
      { form: 'Injection', strength: '4 mg/4 mL', unitPrice: 22.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Epinephrine'],
    blackBoxWarning: 'Extravasation causes severe tissue necrosis. Administer via central line only. Have phentolamine available for extravasation.',
    blackBoxWarningAr: 'التسرب يسبب نخر أنسجة شديد. أعطِ عبر خط مركزي فقط. اجعل الفينتولامين متاحاً للتسرب.',
    interactions: [
      { interactsWith: 'MAO inhibitors', severity: 'major', mechanism: 'Markedly potentiated pressor response', clinicalEffect: 'Severe hypertensive crisis', clinicalEffectAr: 'أزمة ارتفاع ضغط شديدة', management: 'Use extremely low doses if MAOIs given within 14 days', managementAr: 'استخدم جرعات منخفضة جداً إذا أُعطيت مثبطات MAO خلال 14 يوماً' },
      { interactsWith: 'Tricyclic antidepressants', severity: 'major', mechanism: 'Potentiated pressor response via NE reuptake inhibition', clinicalEffect: 'Exaggerated hypertension', clinicalEffectAr: 'ارتفاع ضغط مبالغ فيه', management: 'Reduce norepinephrine dose by 50-75%', managementAr: 'خفض جرعة النورإبينفرين بنسبة 50-75%' }
    ],
    contraindications: ['Hypovolemia (correct first)', 'Mesenteric/peripheral vascular thrombosis (relative)'],
    contraindicationsAr: ['نقص حجم الدم (صحح أولاً)', 'تخثر وعائي مساريقي/محيطي (نسبي)'],
    monitoringRequired: ['Continuous arterial BP (arterial line)', 'Heart rate', 'Urine output', 'Lactate', 'Central line site for extravasation'],
    storageConditions: 'Store at 20-25°C, protect from light; diluted solution use within 24h'
  },
  {
    id: 'FRM-0701', genericName: 'Vasopressin (Arginine vasopressin)', genericNameAr: 'فازوبريسين (أرجينين فازوبريسين)', brandNames: ['Vasostrict', 'Pitressin'],
    sfda_registration: 'SFDA-VAS-701', atcCode: 'H01BA01', atcCategory: 'Vasopressin and Analogues',
    therapeuticClass: 'Vasopressor / Antidiuretic', therapeuticClassAr: 'رافع ضغط وعائي / مضاد إدرار',
    formularyStatus: 'formulary', route: ['IV'],
    forms: [
      { form: 'Injection', strength: '20 units/mL 1 mL', unitPrice: 55.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Desmopressin', 'Terlipressin'],
    interactions: [
      { interactsWith: 'Norepinephrine', severity: 'moderate', mechanism: 'Additive vasoconstrictive effect', clinicalEffect: 'Enhanced pressor response; digital ischemia risk', clinicalEffectAr: 'استجابة ضاغطة معززة؛ خطر نقص تروية الأصابع', management: 'Monitor for peripheral ischemia; standard combination in septic shock', managementAr: 'راقب نقص التروية المحيطي؛ توليفة قياسية في الصدمة الإنتانية' }
    ],
    contraindications: ['Hypersensitivity'],
    contraindicationsAr: ['فرط حساسية'],
    monitoringRequired: ['Arterial BP', 'Heart rate', 'Urine output', 'Serum sodium', 'Peripheral perfusion (watch for skin necrosis)'],
    storageConditions: 'Refrigerate 2-8°C; diluted solution stable 24h at room temp'
  },
  {
    id: 'FRM-0702', genericName: 'Phenylephrine', genericNameAr: 'فينيليفرين', brandNames: ['Neo-Synephrine'],
    sfda_registration: 'SFDA-PHE-702', atcCode: 'C01CA06', atcCategory: 'Adrenergic Agents',
    therapeuticClass: 'Alpha-1 Agonist Vasopressor', therapeuticClassAr: 'رافع ضغط ناهض ألفا-1',
    formularyStatus: 'formulary', route: ['IV', 'nasal', 'ophthalmic'],
    forms: [
      { form: 'Injection', strength: '10 mg/mL 1 mL', unitPrice: 12.0, inStock: true },
      { form: 'Injection', strength: '100 mcg/mL 10 mL (pre-diluted)', unitPrice: 28.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Epinephrine', 'Phentolamine'],
    interactions: [
      { interactsWith: 'MAO inhibitors', severity: 'major', mechanism: 'Potentiated pressor response', clinicalEffect: 'Severe hypertension', clinicalEffectAr: 'ارتفاع ضغط شديد', management: 'Use with extreme caution; reduce dose', managementAr: 'استخدم بحذر شديد؛ خفض الجرعة' }
    ],
    contraindications: ['Severe hypertension', 'Ventricular tachycardia'],
    contraindicationsAr: ['ارتفاع ضغط شديد', 'تسرع بطيني'],
    monitoringRequired: ['Blood pressure', 'Heart rate (reflex bradycardia)', 'ECG', 'Peripheral perfusion'],
    storageConditions: 'Store at 20-25°C, protect from light'
  },
  {
    id: 'FRM-0703', genericName: 'Dobutamine', genericNameAr: 'دوبوتامين', brandNames: ['Dobutrex'],
    sfda_registration: 'SFDA-DOB-703', atcCode: 'C01CA07', atcCategory: 'Adrenergic and Dopaminergic Agents',
    therapeuticClass: 'Inotropic Agent (Beta-1 Agonist)', therapeuticClassAr: 'عامل مقوي لتقلص القلب (ناهض بيتا-1)',
    formularyStatus: 'formulary', route: ['IV'],
    forms: [
      { form: 'Injection', strength: '12.5 mg/mL 20 mL', unitPrice: 22.0, inStock: true },
      { form: 'Premixed infusion', strength: '250 mg/250 mL D5W', unitPrice: 38.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'B', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Dopamine'],
    interactions: [
      { interactsWith: 'Beta-blockers', severity: 'major', mechanism: 'Antagonism of inotropic effect', clinicalEffect: 'Reduced dobutamine efficacy', clinicalEffectAr: 'انخفاض فعالية الدوبوتامين', management: 'Consider milrinone as alternative in beta-blocked patients', managementAr: 'فكر في الميلرينون كبديل في المرضى المعالجين بمثبطات بيتا' }
    ],
    contraindications: ['IHSS (hypertrophic obstructive cardiomyopathy)', 'Severe aortic stenosis'],
    contraindicationsAr: ['اعتلال عضلة القلب الضخامي الانسدادي', 'تضيق أبهري شديد'],
    monitoringRequired: ['Continuous ECG', 'Blood pressure', 'Heart rate', 'Urine output', 'Cardiac output (if PA catheter)'],
    storageConditions: 'Store at 20-25°C; reconstituted solution stable 24h'
  },
  {
    id: 'FRM-0704', genericName: 'Dopamine', genericNameAr: 'دوبامين', brandNames: ['Intropin'],
    sfda_registration: 'SFDA-DOP-704', atcCode: 'C01CA04', atcCategory: 'Adrenergic and Dopaminergic Agents',
    therapeuticClass: 'Vasopressor / Inotrope (dose-dependent)', therapeuticClassAr: 'رافع ضغط / مقوي تقلصي (معتمد على الجرعة)',
    formularyStatus: 'formulary', route: ['IV'],
    forms: [
      { form: 'Injection', strength: '40 mg/mL 5 mL', unitPrice: 10.0, inStock: true },
      { form: 'Premixed infusion', strength: '400 mg/250 mL D5W', unitPrice: 25.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Dobutamine'],
    blackBoxWarning: 'Extravasation may cause severe tissue necrosis. Administer via central line preferred. Phentolamine infiltration for extravasation.',
    blackBoxWarningAr: 'التسرب قد يسبب نخر أنسجة شديد. يُفضل الإعطاء عبر خط مركزي. ارتشاح الفينتولامين للتسرب.',
    interactions: [
      { interactsWith: 'MAO inhibitors', severity: 'major', mechanism: 'Markedly potentiated response', clinicalEffect: 'Hypertensive crisis', clinicalEffectAr: 'أزمة ارتفاع ضغط', management: 'Reduce dopamine starting dose to 1/10th; titrate very slowly', managementAr: 'خفض جرعة البدء للدوبامين إلى العُشر؛ عاير ببطء شديد' },
      { interactsWith: 'Phenytoin', severity: 'major', mechanism: 'IV phenytoin with dopamine may cause profound hypotension', clinicalEffect: 'Severe hypotension and bradycardia', clinicalEffectAr: 'انخفاض ضغط شديد وبطء القلب', management: 'Avoid combination; use alternative anticonvulsant', managementAr: 'تجنب الجمع؛ استخدم مضاد اختلاج بديل' }
    ],
    contraindications: ['Pheochromocytoma', 'Uncorrected tachyarrhythmia', 'Ventricular fibrillation'],
    contraindicationsAr: ['ورم القواتم', 'تسرع نظم غير مصحح', 'رجفان بطيني'],
    monitoringRequired: ['Continuous ECG', 'Arterial BP', 'Urine output', 'Heart rate', 'IV site for extravasation'],
    storageConditions: 'Store at 20-25°C, protect from light; discard if discolored'
  },

  // ─── EMERGENCY/RESUSCITATION (5) ───
  {
    id: 'FRM-0705', genericName: 'Adenosine', genericNameAr: 'أدينوزين', brandNames: ['Adenocard'],
    sfda_registration: 'SFDA-ADN-705', atcCode: 'C01EB10', atcCategory: 'Cardiac Therapy',
    therapeuticClass: 'Antiarrhythmic (SVT Termination)', therapeuticClassAr: 'مضاد اضطراب نظم (إنهاء تسرع فوق بطيني)',
    formularyStatus: 'formulary', route: ['IV'],
    forms: [
      { form: 'Injection', strength: '3 mg/mL 2 mL', unitPrice: 35.0, inStock: true },
      { form: 'Injection', strength: '3 mg/mL 4 mL', unitPrice: 55.0, inStock: true }
    ],
    maxDailyDose: 12, maxDailyDoseUnit: 'mg',
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Adenosine deaminase'],
    interactions: [
      { interactsWith: 'Dipyridamole', severity: 'major', mechanism: 'Blocks adenosine uptake; potentiates effect', clinicalEffect: 'Profound bradycardia, prolonged AV block', clinicalEffectAr: 'بطء قلب عميق، إحصار أذيني بطيني مطول', management: 'Reduce adenosine dose by 75% (use 1 mg initial dose)', managementAr: 'خفض جرعة الأدينوزين بنسبة 75% (استخدم 1 ملغ جرعة أولية)' },
      { interactsWith: 'Theophylline/Caffeine', severity: 'major', mechanism: 'Competitive adenosine receptor antagonism', clinicalEffect: 'Reduced adenosine efficacy; may need higher doses', clinicalEffectAr: 'انخفاض فعالية الأدينوزين؛ قد يحتاج جرعات أعلى', management: 'Higher doses may be needed; consider alternative agents', managementAr: 'قد تحتاج جرعات أعلى؛ فكر في عوامل بديلة' }
    ],
    contraindications: ['2nd/3rd degree AV block', 'Sick sinus syndrome (without pacemaker)', 'Known hypersensitivity'],
    contraindicationsAr: ['إحصار أذيني بطيني من الدرجة الثانية/الثالثة', 'متلازمة الجيب المريض (بدون منظم)', 'فرط حساسية معروف'],
    monitoringRequired: ['Continuous ECG during and 1 min after', 'Blood pressure', 'Heart rate', 'Brief asystole expected (warn patient)'],
    storageConditions: 'Store at 15-30°C; do not refrigerate (may crystallize)'
  },
  {
    id: 'FRM-0706', genericName: 'Amiodarone (IV emergency)', genericNameAr: 'أميودارون (وريدي طارئ)', brandNames: ['Cordarone IV', 'Nexterone'],
    sfda_registration: 'SFDA-AMI-706', atcCode: 'C01BD01', atcCategory: 'Antiarrhythmics Class III',
    therapeuticClass: 'Antiarrhythmic (VF/VT/Emergency)', therapeuticClassAr: 'مضاد اضطراب نظم (رجفان/تسرع بطيني/طوارئ)',
    formularyStatus: 'formulary', route: ['IV'],
    forms: [
      { form: 'Injection', strength: '50 mg/mL 3 mL (150 mg)', unitPrice: 28.0, inStock: true },
      { form: 'Premixed infusion', strength: '150 mg/100 mL D5W', unitPrice: 45.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: true, pregnancyCategory: 'D', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Amantadine', 'Amlodipine'],
    blackBoxWarning: 'Pulmonary toxicity, hepatotoxicity, and thyroid dysfunction with long-term use. IV use: hypotension and bradycardia common.',
    blackBoxWarningAr: 'سمية رئوية وكبدية وخلل الغدة الدرقية مع الاستخدام طويل الأمد. الاستخدام الوريدي: انخفاض الضغط وبطء القلب شائعان.',
    interactions: [
      { interactsWith: 'Warfarin', severity: 'major', mechanism: 'Inhibits CYP2C9; increases warfarin levels', clinicalEffect: 'Bleeding risk; INR may double', clinicalEffectAr: 'خطر نزيف؛ قد يتضاعف INR', management: 'Reduce warfarin dose by 30-50%; monitor INR closely', managementAr: 'خفض جرعة الوارفارين بنسبة 30-50%؛ راقب INR عن كثب' },
      { interactsWith: 'Digoxin', severity: 'major', mechanism: 'Increases digoxin levels via P-gp inhibition', clinicalEffect: 'Digoxin toxicity', clinicalEffectAr: 'تسمم الديجوكسين', management: 'Reduce digoxin dose by 50%; monitor levels', managementAr: 'خفض جرعة الديجوكسين بنسبة 50%؛ راقب المستويات' },
      { interactsWith: 'QT-prolonging drugs', severity: 'major', mechanism: 'Additive QT prolongation', clinicalEffect: 'Torsades de pointes', clinicalEffectAr: 'تورساد دي بوينت', management: 'Avoid concurrent QT-prolonging agents; monitor QTc', managementAr: 'تجنب الأدوية المطيلة لـ QT بالتزامن؛ راقب QTc' }
    ],
    contraindications: ['Cardiogenic shock', 'Severe sinus node dysfunction', 'Iodine hypersensitivity'],
    contraindicationsAr: ['صدمة قلبية المنشأ', 'خلل شديد في العقدة الجيبية', 'فرط حساسية لليود'],
    monitoringRequired: ['Continuous ECG', 'QTc interval', 'Blood pressure', 'Thyroid function', 'Liver function', 'Chest X-ray (pulmonary toxicity)'],
    storageConditions: 'Store at 20-25°C, protect from light; use non-PVC tubing (DEHP leaching)'
  },
  {
    id: 'FRM-0707', genericName: 'Calcium chloride', genericNameAr: 'كلوريد الكالسيوم', brandNames: ['CaCl2'],
    sfda_registration: 'SFDA-CAC-707', atcCode: 'A12AA07', atcCategory: 'Calcium Supplements',
    therapeuticClass: 'Emergency Calcium / Cardiac Resuscitation', therapeuticClassAr: 'كالسيوم طوارئ / إنعاش قلبي',
    formularyStatus: 'formulary', route: ['IV'],
    forms: [
      { form: 'Injection', strength: '10% (100 mg/mL) 10 mL', unitPrice: 6.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Calcium gluconate'],
    blackBoxWarning: 'Severe tissue necrosis with extravasation. Central line strongly preferred. 3× more elemental calcium than gluconate — do not substitute mg-for-mg.',
    blackBoxWarningAr: 'نخر أنسجة شديد عند التسرب. يُفضل بشدة الخط المركزي. 3 أضعاف الكالسيوم العنصري مقارنة بالغلوكونات — لا تستبدل ملغ بملغ.',
    interactions: [
      { interactsWith: 'Digoxin', severity: 'major', mechanism: 'Hypercalcemia increases digoxin sensitivity', clinicalEffect: 'Fatal cardiac arrhythmias', clinicalEffectAr: 'اضطرابات نظم قلبية قاتلة', management: 'Avoid in digitalized patients unless cardiac arrest; use gluconate instead', managementAr: 'تجنب في مرضى الديجيتال إلا في حالة السكتة القلبية؛ استخدم الغلوكونات بدلاً منه' }
    ],
    contraindications: ['Hypercalcemia', 'Digitalis toxicity (relative)'],
    contraindicationsAr: ['فرط كالسيوم الدم', 'تسمم الديجيتال (نسبي)'],
    monitoringRequired: ['Ionized calcium', 'ECG', 'Blood pressure', 'IV site (necrosis risk)'],
    storageConditions: 'Store at 20-25°C'
  },
  {
    id: 'FRM-0708', genericName: 'Sodium thiosulfate', genericNameAr: 'ثيوسلفات الصوديوم', brandNames: ['Nithiodote (component)'],
    sfda_registration: 'SFDA-STS-708', atcCode: 'V03AB06', atcCategory: 'Antidotes',
    therapeuticClass: 'Cyanide Antidote / Cisplatin Nephroprotectant', therapeuticClassAr: 'ترياق السيانيد / حامي كلوي من السيسبلاتين',
    formularyStatus: 'formulary', route: ['IV'],
    forms: [
      { form: 'Injection', strength: '250 mg/mL 50 mL (12.5 g)', unitPrice: 85.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Sodium sulfate'],
    interactions: [
      { interactsWith: 'Cisplatin', severity: 'moderate', mechanism: 'Inactivates cisplatin (used therapeutically as otoprotectant)', clinicalEffect: 'May reduce cisplatin efficacy if given concurrently', clinicalEffectAr: 'قد يقلل فعالية السيسبلاتين إذا أُعطي بالتزامن', management: 'Administer 6h after cisplatin for otoprotection', managementAr: 'أعطِ بعد 6 ساعات من السيسبلاتين للحماية السمعية' }
    ],
    contraindications: ['Known hypersensitivity'],
    contraindicationsAr: ['فرط حساسية معروف'],
    monitoringRequired: ['Methemoglobin levels (if co-given with nitrites)', 'Blood pressure', 'Thiocyanate levels in renal impairment'],
    storageConditions: 'Store at 20-25°C'
  },
  {
    id: 'FRM-0709', genericName: 'Dantrolene', genericNameAr: 'دانترولين', brandNames: ['Dantrium', 'Ryanodex'],
    sfda_registration: 'SFDA-DAN-709', atcCode: 'M03CA01', atcCategory: 'Directly Acting Muscle Relaxants',
    therapeuticClass: 'Malignant Hyperthermia Antidote', therapeuticClassAr: 'ترياق فرط الحرارة الخبيث',
    formularyStatus: 'formulary', route: ['IV', 'oral'],
    forms: [
      { form: 'Powder for injection', strength: '20 mg vial (requires 60 mL sterile water)', unitPrice: 350.0, inStock: true },
      { form: 'Powder for injection', strength: '250 mg vial (Ryanodex)', unitPrice: 3500.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: true, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Danazol'],
    blackBoxWarning: 'Hepatotoxicity reported with oral use. IV formulation for MH is essential — must be immediately available in all OR suites.',
    blackBoxWarningAr: 'تم الإبلاغ عن سمية كبدية مع الاستخدام الفموي. المستحضر الوريدي لفرط الحرارة الخبيث ضروري — يجب أن يكون متاحاً فوراً في جميع غرف العمليات.',
    interactions: [
      { interactsWith: 'Calcium channel blockers', severity: 'major', mechanism: 'Both reduce intracellular calcium; synergistic cardiovascular collapse', clinicalEffect: 'Cardiovascular collapse, hyperkalemia', clinicalEffectAr: 'انهيار قلبي وعائي، فرط بوتاسيوم الدم', management: 'Avoid IV verapamil/diltiazem with IV dantrolene', managementAr: 'تجنب الفيراباميل/الديلتيازيم الوريدي مع الدانترولين الوريدي' }
    ],
    contraindications: ['Active hepatic disease (for oral chronic use)'],
    contraindicationsAr: ['مرض كبدي نشط (للاستخدام الفموي المزمن)'],
    monitoringRequired: ['Core temperature', 'ETCO2', 'Arterial blood gases', 'CK', 'Potassium', 'Myoglobin', 'Urine output (myoglobinuria)'],
    storageConditions: 'Store at 20-25°C; reconstitute immediately before use; Ryanodex must be available in all ORs'
  },

  // ─── REVERSAL/RESCUE (5) ───
  {
    id: 'FRM-0710', genericName: 'Leucovorin (Folinic acid)', genericNameAr: 'ليوكوفورين (حمض الفولينيك)', brandNames: ['Leucovorin', 'Wellcovorin'],
    sfda_registration: 'SFDA-LEU-710', atcCode: 'V03AF03', atcCategory: 'Detoxifying Agents for Antineoplastic Treatment',
    therapeuticClass: 'Methotrexate Rescue / Folate Supplement', therapeuticClassAr: 'إنقاذ من الميثوتريكسات / مكمل فولات',
    formularyStatus: 'formulary', route: ['IV', 'IM', 'oral'],
    forms: [
      { form: 'Injection', strength: '10 mg/mL 5 mL', unitPrice: 25.0, inStock: true },
      { form: 'Tablet', strength: '15 mg', unitPrice: 8.0, inStock: true },
      { form: 'Powder for injection', strength: '200 mg vial', unitPrice: 85.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Levoleucovorin', 'Folic acid'],
    interactions: [
      { interactsWith: 'Methotrexate', severity: 'major', mechanism: 'Competitively rescues normal cells from MTX toxicity', clinicalEffect: 'Prevents methotrexate-induced bone marrow suppression and mucositis', clinicalEffectAr: 'يمنع كبت نخاع العظم والتهاب الأغشية المخاطية الناتج عن الميثوتريكسات', management: 'Start within 24h of high-dose MTX; continue until MTX level <0.05 µmol/L', managementAr: 'ابدأ خلال 24 ساعة من الجرعة العالية من MTX؛ استمر حتى مستوى MTX أقل من 0.05 ميكرومول/لتر' },
      { interactsWith: '5-Fluorouracil', severity: 'major', mechanism: 'Enhances 5-FU cytotoxicity (intended in chemotherapy)', clinicalEffect: 'Enhanced antitumor and toxic effects of 5-FU', clinicalEffectAr: 'تعزيز التأثير المضاد للورم والسام لـ 5-FU', management: 'Part of standard FOLFOX/FOLFIRI regimen; monitor for mucositis/diarrhea', managementAr: 'جزء من نظام FOLFOX/FOLFIRI القياسي؛ راقب التهاب الأغشية المخاطية/الإسهال' }
    ],
    contraindications: ['Pernicious anemia (masks B12 deficiency)', 'Known hypersensitivity'],
    contraindicationsAr: ['فقر الدم الخبيث (يخفي نقص B12)', 'فرط حساسية معروف'],
    monitoringRequired: ['Serum methotrexate levels', 'CBC', 'Renal function', 'Mucositis assessment'],
    storageConditions: 'Store at 20-25°C, protect from light; reconstituted solution use within 24h'
  },
  {
    id: 'FRM-0711', genericName: 'Glucagon (rescue)', genericNameAr: 'غلوكاغون (إنقاذ)', brandNames: ['GlucaGen', 'Baqsimi'],
    sfda_registration: 'SFDA-GLR-711', atcCode: 'H04AA01', atcCategory: 'Glycogenolytic Hormones',
    therapeuticClass: 'Hypoglycemia Rescue / Beta-blocker Antidote', therapeuticClassAr: 'إنقاذ نقص السكر / ترياق حاصرات بيتا',
    formularyStatus: 'formulary', route: ['IV', 'IM', 'SC', 'intranasal'],
    forms: [
      { form: 'Powder for injection', strength: '1 mg vial with diluent', unitPrice: 120.0, inStock: true },
      { form: 'Nasal powder', strength: '3 mg (Baqsimi)', unitPrice: 150.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'B', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Glipizide', 'Glucophage'],
    interactions: [
      { interactsWith: 'Warfarin', severity: 'moderate', mechanism: 'Glucagon may increase anticoagulant effect', clinicalEffect: 'Increased INR and bleeding risk', clinicalEffectAr: 'زيادة INR وخطر النزيف', management: 'Monitor INR if glucagon infusion used for beta-blocker OD', managementAr: 'راقب INR إذا استُخدم تسريب الغلوكاغون لجرعة زائدة من حاصرات بيتا' },
      { interactsWith: 'Insulin', severity: 'moderate', mechanism: 'Opposing effects on blood glucose', clinicalEffect: 'Antagonizes insulin action', clinicalEffectAr: 'يعاكس عمل الإنسولين', management: 'Expected in hypoglycemia rescue; monitor glucose frequently', managementAr: 'متوقع في إنقاذ نقص السكر؛ راقب السكر بشكل متكرر' }
    ],
    contraindications: ['Pheochromocytoma', 'Insulinoma', 'Known hypersensitivity'],
    contraindicationsAr: ['ورم القواتم', 'ورم الإنسولين', 'فرط حساسية معروف'],
    monitoringRequired: ['Blood glucose q15-30 min', 'Heart rate/BP (in beta-blocker OD)', 'Nausea/vomiting'],
    storageConditions: 'Store at 20-25°C; reconstituted solution use immediately'
  },
  {
    id: 'FRM-0712', genericName: 'Pralidoxime (2-PAM)', genericNameAr: 'براليدوكسيم', brandNames: ['Protopam'],
    sfda_registration: 'SFDA-PRA-712', atcCode: 'V03AB04', atcCategory: 'Antidotes',
    therapeuticClass: 'Organophosphate Poisoning Antidote (Cholinesterase Reactivator)', therapeuticClassAr: 'ترياق تسمم الفوسفات العضوي (منشط الكولينستراز)',
    formularyStatus: 'formulary', route: ['IV', 'IM'],
    forms: [
      { form: 'Injection', strength: '1 g vial', unitPrice: 110.0, inStock: true }
    ],
    renalAdjustment: true, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Pyridoxine'],
    interactions: [
      { interactsWith: 'Atropine', severity: 'moderate', mechanism: 'Synergistic in OP poisoning (atropine for muscarinic, pralidoxime for nicotinic)', clinicalEffect: 'Combined reversal of OP poisoning effects', clinicalEffectAr: 'عكس مشترك لتأثيرات تسمم الفوسفات العضوي', management: 'Always co-administer with atropine; atropinize first', managementAr: 'أعطِ دائماً مع الأتروبين؛ أعطِ الأتروبين أولاً' }
    ],
    contraindications: ['Carbamate poisoning (may worsen)', 'Known hypersensitivity'],
    contraindicationsAr: ['تسمم الكربامات (قد يزداد سوءاً)', 'فرط حساسية معروف'],
    monitoringRequired: ['Cholinesterase levels (RBC and plasma)', 'Respiratory function', 'Muscle fasciculations', 'Heart rate/BP'],
    storageConditions: 'Store at 20-25°C'
  },
  {
    id: 'FRM-0713', genericName: 'Hydroxocobalamin', genericNameAr: 'هيدروكسوكوبالامين', brandNames: ['Cyanokit'],
    sfda_registration: 'SFDA-HYC-713', atcCode: 'V03AB33', atcCategory: 'Antidotes',
    therapeuticClass: 'Cyanide Poisoning Antidote', therapeuticClassAr: 'ترياق تسمم السيانيد',
    formularyStatus: 'formulary', route: ['IV'],
    forms: [
      { form: 'Powder for injection', strength: '5 g vial (Cyanokit)', unitPrice: 4500.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Cyanocobalamin (B12)'],
    interactions: [
      { interactsWith: 'Sodium thiosulfate', severity: 'moderate', mechanism: 'Potential interaction; thiosulfate may reduce hydroxocobalamin efficacy if mixed in same line', clinicalEffect: 'Reduced cyanide binding', clinicalEffectAr: 'انخفاض ارتباط السيانيد', management: 'Do not mix in same IV line; use separate lines', managementAr: 'لا تخلط في نفس خط الوريد؛ استخدم خطوط منفصلة' }
    ],
    contraindications: ['Known hypersensitivity'],
    contraindicationsAr: ['فرط حساسية معروف'],
    monitoringRequired: ['Lactate levels', 'Cyanide levels (if available)', 'BP (hypertension common)', 'Red discoloration of skin/urine (expected, warn lab)', 'Interferes with lab colorimetric assays for 48h'],
    storageConditions: 'Store at 20-25°C; reconstituted solution use within 6h'
  },
  {
    id: 'FRM-0714', genericName: 'Fomepizole', genericNameAr: 'فوميبيزول', brandNames: ['Antizol'],
    sfda_registration: 'SFDA-FOM-714', atcCode: 'V03AB34', atcCategory: 'Antidotes',
    therapeuticClass: 'Alcohol Dehydrogenase Inhibitor (Methanol/Ethylene Glycol Antidote)', therapeuticClassAr: 'مثبط نازعة هيدروجين الكحول (ترياق الميثانول/إيثيلين غلايكول)',
    formularyStatus: 'formulary', route: ['IV'],
    forms: [
      { form: 'Injection', strength: '1 g/mL 1.5 mL', unitPrice: 3200.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: [],
    interactions: [
      { interactsWith: 'Ethanol', severity: 'moderate', mechanism: 'Both inhibit alcohol dehydrogenase; fomepizole preferred over ethanol', clinicalEffect: 'Altered metabolism; do not co-administer', clinicalEffectAr: 'تغير الأيض؛ لا تعطِ معاً', management: 'Use fomepizole OR ethanol, not both', managementAr: 'استخدم الفوميبيزول أو الإيثانول، ليس كليهما' }
    ],
    contraindications: ['Known fomepizole hypersensitivity'],
    contraindicationsAr: ['فرط حساسية معروف للفوميبيزول'],
    monitoringRequired: ['Serum methanol or ethylene glycol levels', 'Osmolar gap', 'Anion gap', 'Arterial blood gases', 'Serum electrolytes', 'Renal function', 'Hepatic transaminases'],
    storageConditions: 'Store at 20-25°C; may solidify below 25°C (warm to dissolve); diluted solution use within 24h'
  },

  // ─── DIAGNOSTIC AGENTS (5) ───
  {
    id: 'FRM-0715', genericName: 'Tuberculin purified protein derivative (PPD)', genericNameAr: 'مشتق البروتين المنقى للتوبركولين', brandNames: ['Tubersol', 'Aplisol'],
    sfda_registration: 'SFDA-PPD-715', atcCode: 'V04CF01', atcCategory: 'Tuberculin Diagnostic Agents',
    therapeuticClass: 'Tuberculosis Diagnostic Agent', therapeuticClassAr: 'عامل تشخيصي للسل',
    formularyStatus: 'formulary', route: ['intradermal'],
    forms: [
      { form: 'Solution', strength: '5 TU/0.1 mL 1 mL (10-test)', unitPrice: 35.0, inStock: true },
      { form: 'Solution', strength: '5 TU/0.1 mL 5 mL (50-test)', unitPrice: 130.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: [],
    interactions: [
      { interactsWith: 'Live vaccines', severity: 'moderate', mechanism: 'Live viral vaccines may suppress PPD reactivity', clinicalEffect: 'False-negative PPD result', clinicalEffectAr: 'نتيجة PPD سلبية كاذبة', management: 'Test same day as vaccine or wait 4-6 weeks after live vaccine', managementAr: 'افحص في نفس يوم اللقاح أو انتظر 4-6 أسابيع بعد اللقاح الحي' },
      { interactsWith: 'Immunosuppressants', severity: 'moderate', mechanism: 'Suppressed cell-mediated immunity', clinicalEffect: 'False-negative PPD result', clinicalEffectAr: 'نتيجة PPD سلبية كاذبة', management: 'Consider IGRA (QuantiFERON) as alternative', managementAr: 'فكر في اختبار IGRA (كوانتيفيرون) كبديل' }
    ],
    contraindications: ['Previous severe reaction to PPD', 'Known active TB (skin test adds no information)'],
    contraindicationsAr: ['تفاعل شديد سابق لـ PPD', 'سل نشط معروف (اختبار الجلد لا يضيف معلومات)'],
    monitoringRequired: ['Read induration at 48-72h', 'Measure in mm (not erythema)', 'Document reader and result'],
    storageConditions: 'Refrigerate 2-8°C; do not freeze; protect from light'
  },
  {
    id: 'FRM-0716', genericName: 'Methacholine chloride', genericNameAr: 'ميثاكولين كلوريد', brandNames: ['Provocholine'],
    sfda_registration: 'SFDA-MET-716', atcCode: 'V04CX', atcCategory: 'Other Diagnostic Agents',
    therapeuticClass: 'Bronchial Challenge Diagnostic Agent', therapeuticClassAr: 'عامل تشخيصي لتحدي القصبات',
    formularyStatus: 'restricted',
    restrictionCriteria: 'Pulmonary function lab with resuscitation equipment; performed by trained respiratory therapist',
    restrictionCriteriaAr: 'مختبر وظائف رئوية مع معدات إنعاش؛ يجريه أخصائي تنفسي مدرب',
    approverRole: 'pulmonologist',
    route: ['inhalation'],
    forms: [
      { form: 'Powder for reconstitution', strength: '100 mg vial', unitPrice: 180.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Methadone'],
    interactions: [
      { interactsWith: 'Beta-agonists (albuterol)', severity: 'major', mechanism: 'Antagonizes methacholine bronchoconstriction', clinicalEffect: 'False-negative challenge test', clinicalEffectAr: 'اختبار تحدي سلبي كاذب', management: 'Hold short-acting beta-agonists 8h and long-acting 48h before test', managementAr: 'أوقف موسعات القصبات قصيرة المفعول 8 ساعات وطويلة المفعول 48 ساعة قبل الاختبار' }
    ],
    contraindications: ['Baseline FEV1 <60% predicted', 'Recent MI or stroke (<3 months)', 'Uncontrolled hypertension', 'Known hypersensitivity'],
    contraindicationsAr: ['FEV1 الأساسي أقل من 60% من المتوقع', 'جلطة قلبية أو سكتة حديثة (أقل من 3 أشهر)', 'ارتفاع ضغط غير مسيطر عليه', 'فرط حساسية معروف'],
    monitoringRequired: ['FEV1 at each dose step', 'SpO2', 'Vital signs', 'Have bronchodilator and resuscitation equipment ready'],
    storageConditions: 'Refrigerate 2-8°C after reconstitution; use within 2 weeks'
  },
  {
    id: 'FRM-0717', genericName: 'Cosyntropin (Tetracosactide)', genericNameAr: 'كوسينتروبين (تتراكوساكتيد)', brandNames: ['Cortrosyn', 'Synacthen'],
    sfda_registration: 'SFDA-COS-717', atcCode: 'V04CD01', atcCategory: 'Tests for Pituitary Function',
    therapeuticClass: 'Adrenal Function Diagnostic Agent (ACTH Stimulation Test)', therapeuticClassAr: 'عامل تشخيصي لوظائف الكظرية (اختبار تحفيز ACTH)',
    formularyStatus: 'formulary', route: ['IV', 'IM'],
    forms: [
      { form: 'Injection', strength: '0.25 mg vial', unitPrice: 95.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Corticotropin'],
    interactions: [
      { interactsWith: 'Exogenous corticosteroids', severity: 'moderate', mechanism: 'Suppresses HPA axis; may blunt cortisol response', clinicalEffect: 'False abnormal ACTH stimulation result', clinicalEffectAr: 'نتيجة اختبار تحفيز ACTH غير طبيعية كاذبة', management: 'Hold hydrocortisone 24h before test; dexamethasone does not cross-react with cortisol assay', managementAr: 'أوقف الهيدروكورتيزون 24 ساعة قبل الاختبار؛ الديكساميثازون لا يتداخل مع فحص الكورتيزول' }
    ],
    contraindications: ['Known ACTH hypersensitivity'],
    contraindicationsAr: ['فرط حساسية معروف لـ ACTH'],
    monitoringRequired: ['Baseline cortisol (draw before injection)', 'Cortisol at 30 and 60 min post-injection', 'Allergic reaction observation'],
    storageConditions: 'Refrigerate 2-8°C; reconstituted solution use within 12h'
  },
  {
    id: 'FRM-0718', genericName: 'Glucagon (diagnostic)', genericNameAr: 'غلوكاغون (تشخيصي)', brandNames: ['GlucaGen Diagnostic'],
    sfda_registration: 'SFDA-GLD-718', atcCode: 'V04CJ', atcCategory: 'Tests for Pancreatic Function',
    therapeuticClass: 'GI Motility Inhibitor / Diagnostic Aid', therapeuticClassAr: 'مثبط حركة الجهاز الهضمي / مساعد تشخيصي',
    formularyStatus: 'formulary', route: ['IV', 'IM'],
    forms: [
      { form: 'Powder for injection', strength: '1 mg vial', unitPrice: 95.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'B', lactationSafe: true,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Glucagon rescue formulation'],
    interactions: [
      { interactsWith: 'Insulin', severity: 'minor', mechanism: 'Transient hyperglycemia from glucagon', clinicalEffect: 'Temporary blood glucose elevation', clinicalEffectAr: 'ارتفاع مؤقت في سكر الدم', management: 'Monitor glucose in diabetic patients; effect transient', managementAr: 'راقب السكر في مرضى السكري؛ التأثير مؤقت' }
    ],
    contraindications: ['Pheochromocytoma', 'Insulinoma', 'Known hypersensitivity'],
    contraindicationsAr: ['ورم القواتم', 'ورم الإنسولين', 'فرط حساسية معروف'],
    monitoringRequired: ['Blood glucose', 'Blood pressure', 'Nausea/vomiting'],
    storageConditions: 'Refrigerate 2-8°C; reconstituted solution use immediately'
  },
  {
    id: 'FRM-0719', genericName: 'Regadenoson', genericNameAr: 'ريجادينوسون', brandNames: ['Lexiscan'],
    sfda_registration: 'SFDA-REG-719', atcCode: 'V04CX01', atcCategory: 'Other Diagnostic Agents',
    therapeuticClass: 'Pharmacologic Cardiac Stress Agent (A2A Adenosine Agonist)', therapeuticClassAr: 'عامل إجهاد قلبي دوائي (ناهض مستقبلات الأدينوزين A2A)',
    formularyStatus: 'formulary', route: ['IV'],
    forms: [
      { form: 'Injection', strength: '0.4 mg/5 mL pre-filled syringe', unitPrice: 250.0, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Adenosine'],
    interactions: [
      { interactsWith: 'Theophylline/Aminophylline', severity: 'major', mechanism: 'Non-selective adenosine receptor antagonism blocks regadenoson effect', clinicalEffect: 'Failed or inadequate cardiac stress test', clinicalEffectAr: 'فشل أو عدم كفاية اختبار الإجهاد القلبي', management: 'Hold theophylline/aminophylline for 36h before test', managementAr: 'أوقف الثيوفيلين/الأمينوفيلين لمدة 36 ساعة قبل الاختبار' },
      { interactsWith: 'Dipyridamole', severity: 'major', mechanism: 'Potentiates adenosine A2A agonism', clinicalEffect: 'Severe hypotension and bradycardia', clinicalEffectAr: 'انخفاض ضغط شديد وبطء القلب', management: 'Hold dipyridamole for 36-48h before test', managementAr: 'أوقف الديبيريدامول لمدة 36-48 ساعة قبل الاختبار' }
    ],
    contraindications: ['2nd/3rd degree AV block (without pacemaker)', 'SBP <90 mmHg', 'Acute coronary syndrome', 'Active wheezing/severe reactive airway disease'],
    contraindicationsAr: ['إحصار أذيني بطيني من الدرجة الثانية/الثالثة (بدون منظم)', 'ضغط انقباضي أقل من 90', 'متلازمة شريانية تاجية حادة', 'أزيز نشط/مرض مجاري هوائية تفاعلي شديد'],
    monitoringRequired: ['Continuous ECG', 'Blood pressure q1 min during and 10 min post', 'Heart rate', 'SpO2', 'Symptoms (chest pain, dyspnea, flushing)', 'Aminophylline available for reversal'],
    storageConditions: 'Store at 20-25°C; single-use prefilled syringe'
  }
];
