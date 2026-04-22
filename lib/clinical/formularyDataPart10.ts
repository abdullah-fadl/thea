/**
 * Saudi MOH Drug Formulary — Drug Data Part 10
 * Biological & Targeted Therapies
 * IDs: FRM-0600 through FRM-0639
 */
import type { FormularyDrug } from './formularyTypes';

export const BIOLOGICS_TARGETED: FormularyDrug[] = [
  // ── Anti-TNF Agents ──
  {
    id: 'FRM-0600', genericName: 'Adalimumab', genericNameAr: 'أداليموماب',
    brandNames: ['Humira', 'Hadlima'], sfda_registration: 'SFDA-2024-ADA-600',
    atcCode: 'L04AB04', atcCategory: 'TNF-alpha inhibitors',
    therapeuticClass: 'Anti-TNF Biologic', therapeuticClassAr: 'مضاد عامل نخر الورم الحيوي',
    formularyStatus: 'restricted', restrictionCriteria: 'Requires rheumatologist or gastroenterologist approval. Failure of conventional DMARDs required.',
    restrictionCriteriaAr: 'يتطلب موافقة أخصائي الروماتيزم أو الجهاز الهضمي. يشترط فشل العلاج التقليدي.',
    approverRole: 'rheumatologist', route: ['subcutaneous'], forms: [
      { form: 'Pre-filled syringe', strength: '40mg/0.4mL', unitPrice: 1850, inStock: true },
      { form: 'Pre-filled pen', strength: '40mg/0.8mL', unitPrice: 1900, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'B', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Adalimumab/Abatacept'], blackBoxWarning: 'Serious infections including TB reactivation. Lymphoma and other malignancies in children and adolescents.',
    blackBoxWarningAr: 'عدوى خطيرة بما في ذلك إعادة تنشيط السل. أورام الغدد اللمفاوية وأورام أخرى في الأطفال والمراهقين.',
    interactions: [
      { interactsWith: 'Live vaccines', severity: 'major', mechanism: 'Immunosuppression', clinicalEffect: 'Increased risk of vaccine-related infection', clinicalEffectAr: 'زيادة خطر العدوى المرتبطة باللقاح', management: 'Avoid live vaccines during treatment', managementAr: 'تجنب اللقاحات الحية أثناء العلاج' },
      { interactsWith: 'Anakinra', severity: 'major', mechanism: 'Additive immunosuppression', clinicalEffect: 'Increased serious infections', clinicalEffectAr: 'زيادة العدوى الخطيرة', management: 'Avoid combination', managementAr: 'تجنب الجمع بينهما' }
    ],
    contraindications: ['Active serious infection', 'Active tuberculosis', 'Moderate to severe heart failure (NYHA III/IV)'],
    contraindicationsAr: ['عدوى خطيرة نشطة', 'سل نشط', 'فشل قلبي متوسط إلى شديد'],
    monitoringRequired: ['TB screening before initiation', 'CBC with differential', 'Hepatitis B serology', 'Signs of infection'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze. Protect from light.'
  },
  {
    id: 'FRM-0601', genericName: 'Infliximab', genericNameAr: 'إنفليكسيماب',
    brandNames: ['Remicade', 'Remsima'], sfda_registration: 'SFDA-2024-INF-601',
    atcCode: 'L04AB02', atcCategory: 'TNF-alpha inhibitors',
    therapeuticClass: 'Anti-TNF Biologic', therapeuticClassAr: 'مضاد عامل نخر الورم الحيوي',
    formularyStatus: 'restricted', restrictionCriteria: 'Specialist approval required. Must be administered in infusion center.',
    restrictionCriteriaAr: 'يتطلب موافقة أخصائي. يجب إعطاؤه في مركز التسريب.',
    approverRole: 'rheumatologist', route: ['intravenous'], forms: [
      { form: 'Vial for infusion', strength: '100mg', unitPrice: 2200, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'B', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Infliximab/Rituximab'], blackBoxWarning: 'Serious infections and malignancies. Hepatosplenic T-cell lymphoma reported.',
    blackBoxWarningAr: 'عدوى خطيرة وأورام خبيثة. تم الإبلاغ عن سرطان الغدد اللمفاوية التائية الكبدية الطحالية.',
    interactions: [
      { interactsWith: 'Live vaccines', severity: 'major', mechanism: 'Immunosuppression', clinicalEffect: 'Risk of disseminated infection', clinicalEffectAr: 'خطر العدوى المنتشرة', management: 'Avoid live vaccines', managementAr: 'تجنب اللقاحات الحية' }
    ],
    contraindications: ['Active serious infection', 'Heart failure NYHA III/IV at doses >5mg/kg', 'Hypersensitivity to murine proteins'],
    contraindicationsAr: ['عدوى خطيرة نشطة', 'فشل قلبي بجرعات أكثر من 5 ملغ/كغ', 'فرط الحساسية لبروتينات الفأر'],
    monitoringRequired: ['TB screening', 'Hepatitis B/C serology', 'Infusion reactions monitoring', 'LFTs'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0602', genericName: 'Etanercept', genericNameAr: 'إيتانرسبت',
    brandNames: ['Enbrel'], sfda_registration: 'SFDA-2024-ETA-602',
    atcCode: 'L04AB01', atcCategory: 'TNF-alpha inhibitors',
    therapeuticClass: 'Anti-TNF Biologic', therapeuticClassAr: 'مضاد عامل نخر الورم الحيوي',
    formularyStatus: 'restricted', restrictionCriteria: 'Rheumatologist or dermatologist approval required.',
    restrictionCriteriaAr: 'يتطلب موافقة أخصائي الروماتيزم أو الجلدية.',
    approverRole: 'rheumatologist', route: ['subcutaneous'], forms: [
      { form: 'Pre-filled syringe', strength: '50mg/mL', unitPrice: 1700, inStock: true },
      { form: 'Pre-filled syringe', strength: '25mg/0.5mL', unitPrice: 900, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'B', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Etanercept/Efalizumab'], blackBoxWarning: 'Serious infections including TB. Malignancies in children and adolescents.',
    blackBoxWarningAr: 'عدوى خطيرة بما في ذلك السل. أورام خبيثة في الأطفال والمراهقين.',
    interactions: [
      { interactsWith: 'Cyclophosphamide', severity: 'major', mechanism: 'Additive immunosuppression', clinicalEffect: 'Increased malignancy risk', clinicalEffectAr: 'زيادة خطر الأورام الخبيثة', management: 'Avoid combination', managementAr: 'تجنب الجمع بينهما' }
    ],
    contraindications: ['Active serious infection', 'Sepsis', 'Active TB'],
    contraindicationsAr: ['عدوى خطيرة نشطة', 'تعفن الدم', 'سل نشط'],
    monitoringRequired: ['TB screening', 'CBC', 'Signs of infection', 'Neurological symptoms'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze. Protect from light.'
  },
  {
    id: 'FRM-0603', genericName: 'Golimumab', genericNameAr: 'غوليموماب',
    brandNames: ['Simponi'], sfda_registration: 'SFDA-2024-GOL-603',
    atcCode: 'L04AB06', atcCategory: 'TNF-alpha inhibitors',
    therapeuticClass: 'Anti-TNF Biologic', therapeuticClassAr: 'مضاد عامل نخر الورم الحيوي',
    formularyStatus: 'restricted', restrictionCriteria: 'Rheumatologist approval. Prior DMARD failure required.',
    restrictionCriteriaAr: 'موافقة أخصائي الروماتيزم. يشترط فشل العلاج السابق.',
    approverRole: 'rheumatologist', route: ['subcutaneous', 'intravenous'], forms: [
      { form: 'Pre-filled pen', strength: '50mg/0.5mL', unitPrice: 2100, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'B', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Golimumab/Guselkumab'], blackBoxWarning: 'Serious infections including TB reactivation and invasive fungal infections.',
    blackBoxWarningAr: 'عدوى خطيرة بما في ذلك إعادة تنشيط السل والفطريات الغازية.',
    interactions: [
      { interactsWith: 'Live vaccines', severity: 'major', mechanism: 'Immunosuppression', clinicalEffect: 'Risk of vaccine-related infection', clinicalEffectAr: 'خطر العدوى من اللقاح', management: 'Avoid live vaccines during treatment', managementAr: 'تجنب اللقاحات الحية أثناء العلاج' }
    ],
    contraindications: ['Active serious infection', 'Active TB', 'Hypersensitivity'],
    contraindicationsAr: ['عدوى خطيرة نشطة', 'سل نشط', 'فرط الحساسية'],
    monitoringRequired: ['TB screening', 'Hepatitis B serology', 'CBC', 'LFTs'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0604', genericName: 'Certolizumab pegol', genericNameAr: 'سيرتوليزوماب بيغول',
    brandNames: ['Cimzia'], sfda_registration: 'SFDA-2024-CER-604',
    atcCode: 'L04AB05', atcCategory: 'TNF-alpha inhibitors',
    therapeuticClass: 'Anti-TNF Biologic (PEGylated)', therapeuticClassAr: 'مضاد عامل نخر الورم الحيوي (مبلمر)',
    formularyStatus: 'restricted', restrictionCriteria: 'Specialist approval required.',
    restrictionCriteriaAr: 'يتطلب موافقة أخصائي.',
    approverRole: 'rheumatologist', route: ['subcutaneous'], forms: [
      { form: 'Pre-filled syringe', strength: '200mg/mL', unitPrice: 2000, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'B', lactationSafe: true,
    pediatricApproved: false, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Certolizumab/Canakinumab'], blackBoxWarning: 'Serious infections and malignancies.',
    blackBoxWarningAr: 'عدوى خطيرة وأورام خبيثة.',
    interactions: [
      { interactsWith: 'Abatacept', severity: 'major', mechanism: 'Additive immunosuppression', clinicalEffect: 'Increased infection risk', clinicalEffectAr: 'زيادة خطر العدوى', management: 'Avoid combination', managementAr: 'تجنب الجمع' }
    ],
    contraindications: ['Active serious infection', 'Active TB'],
    contraindicationsAr: ['عدوى خطيرة نشطة', 'سل نشط'],
    monitoringRequired: ['TB screening', 'CBC', 'Signs of infection'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze.'
  },
  // ── IL Inhibitors ──
  {
    id: 'FRM-0605', genericName: 'Tocilizumab', genericNameAr: 'توسيليزوماب',
    brandNames: ['Actemra'], sfda_registration: 'SFDA-2024-TOC-605',
    atcCode: 'L04AC07', atcCategory: 'Interleukin inhibitors',
    therapeuticClass: 'IL-6 Receptor Inhibitor', therapeuticClassAr: 'مثبط مستقبل الإنترلوكين-6',
    formularyStatus: 'restricted', restrictionCriteria: 'Rheumatologist approval. For RA after DMARD failure or CRS.',
    restrictionCriteriaAr: 'موافقة أخصائي الروماتيزم. لالتهاب المفاصل بعد فشل العلاج أو متلازمة إفراز السيتوكين.',
    approverRole: 'rheumatologist', route: ['intravenous', 'subcutaneous'], forms: [
      { form: 'Vial for infusion', strength: '200mg/10mL', unitPrice: 2400, inStock: true },
      { form: 'Pre-filled syringe', strength: '162mg/0.9mL', unitPrice: 1200, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: true, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Tocilizumab/Tofacitinib'], blackBoxWarning: 'Serious infections including TB, bacterial, fungal, and viral.',
    blackBoxWarningAr: 'عدوى خطيرة بما في ذلك السل والبكتيرية والفطرية والفيروسية.',
    interactions: [
      { interactsWith: 'CYP3A4 substrates', severity: 'moderate', mechanism: 'IL-6 inhibition normalizes CYP3A4 activity', clinicalEffect: 'Decreased levels of CYP3A4 substrates', clinicalEffectAr: 'انخفاض مستويات أدوية CYP3A4', management: 'Monitor drug levels of narrow therapeutic index drugs', managementAr: 'مراقبة مستويات الأدوية ذات المؤشر العلاجي الضيق' }
    ],
    contraindications: ['Active serious infection', 'ANC <2000/mm3', 'Platelet count <100,000/mm3'],
    contraindicationsAr: ['عدوى خطيرة نشطة', 'عدد الخلايا المتعادلة أقل من 2000', 'عدد الصفائح أقل من 100,000'],
    monitoringRequired: ['LFTs every 4-8 weeks', 'CBC with differential', 'Lipid panel', 'TB screening'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0606', genericName: 'Secukinumab', genericNameAr: 'سيكيوكينوماب',
    brandNames: ['Cosentyx'], sfda_registration: 'SFDA-2024-SEC-606',
    atcCode: 'L04AC10', atcCategory: 'Interleukin inhibitors',
    therapeuticClass: 'IL-17A Inhibitor', therapeuticClassAr: 'مثبط الإنترلوكين-17A',
    formularyStatus: 'restricted', restrictionCriteria: 'Dermatologist or rheumatologist approval for psoriasis or ankylosing spondylitis.',
    restrictionCriteriaAr: 'موافقة أخصائي الجلدية أو الروماتيزم للصدفية أو التهاب الفقار المقسط.',
    approverRole: 'rheumatologist', route: ['subcutaneous'], forms: [
      { form: 'Pre-filled pen', strength: '150mg/mL', unitPrice: 1950, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'B', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: false, highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Secukinumab/Sarilumab'],
    interactions: [
      { interactsWith: 'Live vaccines', severity: 'major', mechanism: 'Immunosuppression', clinicalEffect: 'Risk of infection from live vaccine', clinicalEffectAr: 'خطر العدوى من اللقاح الحي', management: 'Avoid live vaccines', managementAr: 'تجنب اللقاحات الحية' }
    ],
    contraindications: ['Active serious infection', 'Active Crohn disease', 'Hypersensitivity'],
    contraindicationsAr: ['عدوى خطيرة نشطة', 'داء كرون النشط', 'فرط الحساسية'],
    monitoringRequired: ['TB screening', 'Signs of infection', 'IBD symptoms'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze. Protect from light.'
  },
  {
    id: 'FRM-0607', genericName: 'Ustekinumab', genericNameAr: 'أوستيكينوماب',
    brandNames: ['Stelara'], sfda_registration: 'SFDA-2024-UST-607',
    atcCode: 'L04AC05', atcCategory: 'Interleukin inhibitors',
    therapeuticClass: 'IL-12/23 Inhibitor', therapeuticClassAr: 'مثبط الإنترلوكين-12/23',
    formularyStatus: 'restricted', restrictionCriteria: 'Dermatologist or gastroenterologist approval.',
    restrictionCriteriaAr: 'موافقة أخصائي الجلدية أو الجهاز الهضمي.',
    approverRole: 'rheumatologist', route: ['subcutaneous', 'intravenous'], forms: [
      { form: 'Pre-filled syringe', strength: '45mg/0.5mL', unitPrice: 2500, inStock: true },
      { form: 'Vial for infusion', strength: '130mg/26mL', unitPrice: 4200, inStock: false }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'B', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Ustekinumab/Ustilaginoidea'],
    interactions: [
      { interactsWith: 'CYP450 substrates', severity: 'moderate', mechanism: 'IL-12/23 inhibition may normalize CYP450', clinicalEffect: 'Altered drug metabolism', clinicalEffectAr: 'تغيّر في استقلاب الدواء', management: 'Monitor narrow therapeutic index drugs', managementAr: 'مراقبة الأدوية ذات المؤشر العلاجي الضيق' }
    ],
    contraindications: ['Active serious infection', 'Hypersensitivity to ustekinumab'],
    contraindicationsAr: ['عدوى خطيرة نشطة', 'فرط الحساسية للأوستيكينوماب'],
    monitoringRequired: ['TB screening', 'Signs of infection', 'Skin examination for non-melanoma skin cancer'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze. Protect from light.'
  },
  {
    id: 'FRM-0608', genericName: 'Dupilumab', genericNameAr: 'دوبيلوماب',
    brandNames: ['Dupixent'], sfda_registration: 'SFDA-2024-DUP-608',
    atcCode: 'D11AH05', atcCategory: 'Other dermatological preparations',
    therapeuticClass: 'IL-4/13 Receptor Inhibitor', therapeuticClassAr: 'مثبط مستقبل الإنترلوكين-4/13',
    formularyStatus: 'restricted', restrictionCriteria: 'Dermatologist or allergist approval for moderate-to-severe atopic dermatitis or asthma.',
    restrictionCriteriaAr: 'موافقة أخصائي الجلدية أو الحساسية لالتهاب الجلد التأتبي أو الربو.',
    approverRole: 'rheumatologist', route: ['subcutaneous'], forms: [
      { form: 'Pre-filled syringe', strength: '300mg/2mL', unitPrice: 2800, inStock: true },
      { form: 'Pre-filled pen', strength: '200mg/1.14mL', unitPrice: 2200, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'B', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Dupilumab/Durvalumab'],
    interactions: [
      { interactsWith: 'Live vaccines', severity: 'moderate', mechanism: 'Immunomodulation', clinicalEffect: 'Uncertain vaccine efficacy', clinicalEffectAr: 'فعالية اللقاح غير مؤكدة', management: 'Avoid live vaccines during treatment', managementAr: 'تجنب اللقاحات الحية أثناء العلاج' }
    ],
    contraindications: ['Hypersensitivity to dupilumab', 'Active helminth infection'],
    contraindicationsAr: ['فرط الحساسية للدوبيلوماب', 'عدوى ديدانية نشطة'],
    monitoringRequired: ['Eosinophil count', 'Eye symptoms (conjunctivitis)', 'Parasitic infection screening'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze. Protect from light.'
  },
  {
    id: 'FRM-0609', genericName: 'Ixekizumab', genericNameAr: 'إكسيكيزوماب',
    brandNames: ['Taltz'], sfda_registration: 'SFDA-2024-IXE-609',
    atcCode: 'L04AC13', atcCategory: 'Interleukin inhibitors',
    therapeuticClass: 'IL-17A Inhibitor', therapeuticClassAr: 'مثبط الإنترلوكين-17A',
    formularyStatus: 'restricted', restrictionCriteria: 'Dermatologist approval for moderate-to-severe psoriasis.',
    restrictionCriteriaAr: 'موافقة أخصائي الجلدية للصدفية المتوسطة إلى الشديدة.',
    approverRole: 'rheumatologist', route: ['subcutaneous'], forms: [
      { form: 'Pre-filled pen', strength: '80mg/mL', unitPrice: 2050, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: false, highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Ixekizumab/Infliximab'],
    interactions: [
      { interactsWith: 'Live vaccines', severity: 'major', mechanism: 'Immunosuppression', clinicalEffect: 'Risk of disseminated infection', clinicalEffectAr: 'خطر العدوى المنتشرة', management: 'Avoid live vaccines', managementAr: 'تجنب اللقاحات الحية' }
    ],
    contraindications: ['Active serious infection', 'Active IBD', 'Hypersensitivity'],
    contraindicationsAr: ['عدوى خطيرة نشطة', 'أمراض التهاب الأمعاء النشطة', 'فرط الحساسية'],
    monitoringRequired: ['TB screening', 'Signs of infection', 'IBD symptoms'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze.'
  },
  // ── JAK Inhibitors ──
  {
    id: 'FRM-0610', genericName: 'Tofacitinib', genericNameAr: 'توفاسيتينيب',
    brandNames: ['Xeljanz'], sfda_registration: 'SFDA-2024-TOF-610',
    atcCode: 'L04AA29', atcCategory: 'Selective immunosuppressants',
    therapeuticClass: 'JAK1/3 Inhibitor', therapeuticClassAr: 'مثبط جاك 1/3',
    formularyStatus: 'restricted', restrictionCriteria: 'Rheumatologist approval. Requires cardiovascular risk assessment.',
    restrictionCriteriaAr: 'موافقة أخصائي الروماتيزم. يتطلب تقييم مخاطر القلب والأوعية.',
    approverRole: 'rheumatologist', route: ['oral'], forms: [
      { form: 'Tablet', strength: '5mg', unitPrice: 120, inStock: true },
      { form: 'Extended-release tablet', strength: '11mg', unitPrice: 240, inStock: true }
    ],
    renalAdjustment: true, hepaticAdjustment: true, pregnancyCategory: 'X', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Tofacitinib/Tocilizumab'], blackBoxWarning: 'Serious infections, malignancies, major adverse cardiovascular events, thrombosis. Use lowest effective dose in patients ≥50 years with CV risk factors.',
    blackBoxWarningAr: 'عدوى خطيرة، أورام خبيثة، أحداث قلبية وعائية خطيرة، تخثر. استخدم أقل جرعة فعالة.',
    interactions: [
      { interactsWith: 'Strong CYP3A4 inhibitors (ketoconazole)', severity: 'major', mechanism: 'CYP3A4 inhibition', clinicalEffect: 'Increased tofacitinib levels', clinicalEffectAr: 'زيادة مستويات توفاسيتينيب', management: 'Reduce dose to 5mg once daily', managementAr: 'تقليل الجرعة إلى 5 ملغ مرة يومياً' },
      { interactsWith: 'Immunosuppressants (azathioprine)', severity: 'major', mechanism: 'Additive immunosuppression', clinicalEffect: 'Increased infection and malignancy risk', clinicalEffectAr: 'زيادة خطر العدوى والأورام', management: 'Avoid combination', managementAr: 'تجنب الجمع' }
    ],
    contraindications: ['Active serious infection', 'Pregnancy', 'Severe hepatic impairment'],
    contraindicationsAr: ['عدوى خطيرة نشطة', 'الحمل', 'قصور كبدي شديد'],
    monitoringRequired: ['CBC at baseline and after 4-8 weeks', 'LFTs', 'Lipid panel', 'TB screening', 'VTE symptoms'],
    storageConditions: 'Store at room temperature 15-30°C.'
  },
  {
    id: 'FRM-0611', genericName: 'Baricitinib', genericNameAr: 'باريسيتينيب',
    brandNames: ['Olumiant'], sfda_registration: 'SFDA-2024-BAR-611',
    atcCode: 'L04AA37', atcCategory: 'Selective immunosuppressants',
    therapeuticClass: 'JAK1/2 Inhibitor', therapeuticClassAr: 'مثبط جاك 1/2',
    formularyStatus: 'restricted', restrictionCriteria: 'Rheumatologist approval. CV and VTE risk assessment required.',
    restrictionCriteriaAr: 'موافقة أخصائي الروماتيزم. تقييم مخاطر القلب والتخثر مطلوب.',
    approverRole: 'rheumatologist', route: ['oral'], forms: [
      { form: 'Tablet', strength: '2mg', unitPrice: 130, inStock: true },
      { form: 'Tablet', strength: '4mg', unitPrice: 130, inStock: true }
    ],
    renalAdjustment: true, hepaticAdjustment: true, pregnancyCategory: 'X', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Baricitinib/Brigatinib'], blackBoxWarning: 'Serious infections, malignancies, MACE, and thrombosis.',
    blackBoxWarningAr: 'عدوى خطيرة وأورام خبيثة وأحداث قلبية وتخثر.',
    interactions: [
      { interactsWith: 'Strong OAT3 inhibitors (probenecid)', severity: 'major', mechanism: 'OAT3 inhibition reduces renal clearance', clinicalEffect: 'Increased baricitinib exposure', clinicalEffectAr: 'زيادة التعرض للباريسيتينيب', management: 'Reduce dose to 2mg daily', managementAr: 'تقليل الجرعة إلى 2 ملغ يومياً' }
    ],
    contraindications: ['Active serious infection', 'Pregnancy', 'ALC <500 cells/mm3'],
    contraindicationsAr: ['عدوى خطيرة نشطة', 'الحمل', 'عدد الخلايا اللمفاوية أقل من 500'],
    monitoringRequired: ['CBC', 'LFTs', 'Lipid panel at 12 weeks', 'TB and hepatitis screening'],
    storageConditions: 'Store at room temperature 15-30°C.'
  },
  {
    id: 'FRM-0612', genericName: 'Upadacitinib', genericNameAr: 'أوباداسيتينيب',
    brandNames: ['Rinvoq'], sfda_registration: 'SFDA-2024-UPA-612',
    atcCode: 'L04AA44', atcCategory: 'Selective immunosuppressants',
    therapeuticClass: 'JAK1 Selective Inhibitor', therapeuticClassAr: 'مثبط جاك 1 انتقائي',
    formularyStatus: 'restricted', restrictionCriteria: 'Specialist approval. Not first-line therapy.',
    restrictionCriteriaAr: 'موافقة أخصائي. ليس خط العلاج الأول.',
    approverRole: 'rheumatologist', route: ['oral'], forms: [
      { form: 'Extended-release tablet', strength: '15mg', unitPrice: 150, inStock: true },
      { form: 'Extended-release tablet', strength: '30mg', unitPrice: 150, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: true, pregnancyCategory: 'X', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Upadacitinib/Ustekinumab'], blackBoxWarning: 'Serious infections, malignancies, MACE, thrombosis.',
    blackBoxWarningAr: 'عدوى خطيرة وأورام خبيثة وأحداث قلبية وتخثر.',
    interactions: [
      { interactsWith: 'Strong CYP3A4 inhibitors', severity: 'major', mechanism: 'CYP3A4 inhibition', clinicalEffect: 'Increased upadacitinib exposure', clinicalEffectAr: 'زيادة التعرض للأوباداسيتينيب', management: 'Use 15mg dose only', managementAr: 'استخدم جرعة 15 ملغ فقط' }
    ],
    contraindications: ['Active serious infection', 'Pregnancy', 'Severe hepatic impairment'],
    contraindicationsAr: ['عدوى خطيرة نشطة', 'الحمل', 'قصور كبدي شديد'],
    monitoringRequired: ['CBC', 'LFTs', 'Lipids', 'TB screening', 'Viral hepatitis serology'],
    storageConditions: 'Store at room temperature 15-30°C.'
  },
  {
    id: 'FRM-0613', genericName: 'Ruxolitinib', genericNameAr: 'روكسوليتينيب',
    brandNames: ['Jakavi', 'Jakafi'], sfda_registration: 'SFDA-2024-RUX-613',
    atcCode: 'L01EJ01', atcCategory: 'Janus-associated kinase inhibitors',
    therapeuticClass: 'JAK1/2 Inhibitor (Oncology)', therapeuticClassAr: 'مثبط جاك 1/2 (أورام)',
    formularyStatus: 'restricted', restrictionCriteria: 'Hematologist or oncologist approval for myelofibrosis or polycythemia vera.',
    restrictionCriteriaAr: 'موافقة أخصائي أمراض الدم أو الأورام لتليف النخاع أو كثرة الحمر الحقيقية.',
    approverRole: 'oncologist', route: ['oral'], forms: [
      { form: 'Tablet', strength: '5mg', unitPrice: 180, inStock: true },
      { form: 'Tablet', strength: '15mg', unitPrice: 350, inStock: true },
      { form: 'Tablet', strength: '20mg', unitPrice: 450, inStock: true }
    ],
    renalAdjustment: true, hepaticAdjustment: true, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Ruxolitinib/Rucaparib'],
    interactions: [
      { interactsWith: 'Strong CYP3A4 inhibitors', severity: 'major', mechanism: 'CYP3A4 inhibition', clinicalEffect: 'Increased ruxolitinib levels', clinicalEffectAr: 'زيادة مستويات الروكسوليتينيب', management: 'Reduce dose by 50%', managementAr: 'تقليل الجرعة بنسبة 50%' }
    ],
    contraindications: ['Platelet count <50,000/mm3 for myelofibrosis', 'ESRD on dialysis'],
    contraindicationsAr: ['عدد الصفائح أقل من 50,000 لتليف النخاع', 'فشل كلوي نهائي على الغسيل'],
    monitoringRequired: ['CBC every 2-4 weeks initially', 'LFTs', 'Lipid panel', 'Signs of infection'],
    storageConditions: 'Store at room temperature 15-30°C.'
  },
  // ── Anti-CD20 ──
  {
    id: 'FRM-0614', genericName: 'Rituximab', genericNameAr: 'ريتوكسيماب',
    brandNames: ['MabThera', 'Rituxan'], sfda_registration: 'SFDA-2024-RIT-614',
    atcCode: 'L01FA01', atcCategory: 'Anti-CD20 monoclonal antibodies',
    therapeuticClass: 'Anti-CD20 Monoclonal Antibody', therapeuticClassAr: 'جسم مضاد وحيد النسيلة مضاد CD20',
    formularyStatus: 'restricted', restrictionCriteria: 'Oncologist or rheumatologist approval. Infusion center administration required.',
    restrictionCriteriaAr: 'موافقة أخصائي الأورام أو الروماتيزم. يتطلب إعطاء في مركز التسريب.',
    approverRole: 'oncologist', route: ['intravenous'], forms: [
      { form: 'Vial for infusion', strength: '500mg/50mL', unitPrice: 3500, inStock: true },
      { form: 'Vial for infusion', strength: '100mg/10mL', unitPrice: 800, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Rituximab/Infliximab'], blackBoxWarning: 'Fatal infusion reactions, severe mucocutaneous reactions, hepatitis B reactivation, PML.',
    blackBoxWarningAr: 'تفاعلات تسريب مميتة، تفاعلات جلدية مخاطية شديدة، إعادة تنشيط التهاب الكبد B، اعتلال بيضاء الدماغ متعدد البؤر.',
    interactions: [
      { interactsWith: 'Cisplatin', severity: 'major', mechanism: 'Additive nephrotoxicity with immunosuppression', clinicalEffect: 'Increased renal toxicity', clinicalEffectAr: 'زيادة السمية الكلوية', management: 'Monitor renal function closely', managementAr: 'مراقبة وظائف الكلى بدقة' },
      { interactsWith: 'Live vaccines', severity: 'major', mechanism: 'B-cell depletion impairs immune response', clinicalEffect: 'Vaccine inefficacy and infection risk', clinicalEffectAr: 'عدم فعالية اللقاح وخطر العدوى', management: 'Avoid live vaccines; vaccinate 4 weeks before or 6 months after', managementAr: 'تجنب اللقاحات الحية؛ التطعيم 4 أسابيع قبل أو 6 أشهر بعد' }
    ],
    contraindications: ['Severe active infection', 'Severely immunocompromised', 'Hepatitis B active infection'],
    contraindicationsAr: ['عدوى نشطة شديدة', 'نقص مناعة شديد', 'التهاب كبد B نشط'],
    monitoringRequired: ['HBV serology before treatment', 'CBC before each course', 'Immunoglobulin levels', 'Infusion reaction monitoring'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze. Protect from light.'
  },
  {
    id: 'FRM-0615', genericName: 'Ocrelizumab', genericNameAr: 'أوكريليزوماب',
    brandNames: ['Ocrevus'], sfda_registration: 'SFDA-2024-OCR-615',
    atcCode: 'L04AA36', atcCategory: 'Selective immunosuppressants',
    therapeuticClass: 'Anti-CD20 Monoclonal Antibody', therapeuticClassAr: 'جسم مضاد وحيد النسيلة مضاد CD20',
    formularyStatus: 'restricted', restrictionCriteria: 'Neurologist approval for relapsing or primary progressive MS.',
    restrictionCriteriaAr: 'موافقة أخصائي الأعصاب للتصلب المتعدد الناكس أو الأولي المترقي.',
    approverRole: 'rheumatologist', route: ['intravenous'], forms: [
      { form: 'Vial for infusion', strength: '300mg/10mL', unitPrice: 5500, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Ocrelizumab/Obinutuzumab'],
    interactions: [
      { interactsWith: 'Immunosuppressants', severity: 'major', mechanism: 'Additive immunosuppression', clinicalEffect: 'Increased infection risk', clinicalEffectAr: 'زيادة خطر العدوى', management: 'Avoid combination with other immunosuppressants', managementAr: 'تجنب الجمع مع مثبطات مناعية أخرى' }
    ],
    contraindications: ['Active HBV infection', 'Active serious infection', 'History of severe infusion reaction to ocrelizumab'],
    contraindicationsAr: ['التهاب كبد B نشط', 'عدوى خطيرة نشطة', 'تاريخ تفاعل تسريب شديد'],
    monitoringRequired: ['HBV screening', 'Immunoglobulin levels', 'Infusion reaction monitoring', 'PML surveillance'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0616', genericName: 'Obinutuzumab', genericNameAr: 'أوبينوتوزوماب',
    brandNames: ['Gazyva', 'Gazyvaro'], sfda_registration: 'SFDA-2024-OBI-616',
    atcCode: 'L01FA03', atcCategory: 'Anti-CD20 monoclonal antibodies',
    therapeuticClass: 'Anti-CD20 Monoclonal Antibody (Type II)', therapeuticClassAr: 'جسم مضاد وحيد النسيلة مضاد CD20 نوع II',
    formularyStatus: 'restricted', restrictionCriteria: 'Hematologist-oncologist approval for CLL or follicular lymphoma.',
    restrictionCriteriaAr: 'موافقة أخصائي أمراض الدم والأورام لسرطان الدم الليمفاوي المزمن أو لمفوما الجريبات.',
    approverRole: 'oncologist', route: ['intravenous'], forms: [
      { form: 'Vial for infusion', strength: '1000mg/40mL', unitPrice: 6200, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Obinutuzumab/Ocrelizumab'], blackBoxWarning: 'Hepatitis B reactivation and PML.',
    blackBoxWarningAr: 'إعادة تنشيط التهاب الكبد B واعتلال بيضاء الدماغ متعدد البؤر.',
    interactions: [
      { interactsWith: 'Anticoagulants', severity: 'moderate', mechanism: 'Thrombocytopenia risk', clinicalEffect: 'Increased bleeding risk', clinicalEffectAr: 'زيادة خطر النزيف', management: 'Monitor platelet count and adjust anticoagulation', managementAr: 'مراقبة عدد الصفائح وتعديل مضادات التخثر' }
    ],
    contraindications: ['Hypersensitivity to obinutuzumab', 'Active HBV'],
    contraindicationsAr: ['فرط الحساسية للأوبينوتوزوماب', 'التهاب كبد B نشط'],
    monitoringRequired: ['CBC', 'HBV serology', 'Tumor lysis syndrome monitoring', 'Infusion reactions'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze.'
  },
  // ── Checkpoint Inhibitors ──
  {
    id: 'FRM-0617', genericName: 'Pembrolizumab', genericNameAr: 'بيمبروليزوماب',
    brandNames: ['Keytruda'], sfda_registration: 'SFDA-2024-PEM-617',
    atcCode: 'L01FF02', atcCategory: 'PD-1/PD-L1 inhibitors',
    therapeuticClass: 'Anti-PD-1 Checkpoint Inhibitor', therapeuticClassAr: 'مثبط نقاط التفتيش المناعية PD-1',
    formularyStatus: 'restricted', restrictionCriteria: 'Oncologist approval only. Tumor PD-L1 testing may be required.',
    restrictionCriteriaAr: 'موافقة أخصائي الأورام فقط. قد يتطلب فحص PD-L1 للورم.',
    approverRole: 'oncologist', route: ['intravenous'], forms: [
      { form: 'Vial for infusion', strength: '100mg/4mL', unitPrice: 9800, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'D', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Pembrolizumab/Pertuzumab'], blackBoxWarning: 'Immune-mediated adverse reactions: pneumonitis, colitis, hepatitis, endocrinopathies, nephritis, skin reactions. May be fatal.',
    blackBoxWarningAr: 'تفاعلات مناعية: التهاب رئوي، التهاب قولون، التهاب كبد، اعتلالات غدد صماء، التهاب كلى. قد تكون مميتة.',
    interactions: [
      { interactsWith: 'Corticosteroids (high dose)', severity: 'moderate', mechanism: 'Immunosuppression may reduce checkpoint inhibitor efficacy', clinicalEffect: 'Reduced antitumor response', clinicalEffectAr: 'انخفاض الاستجابة المضادة للورم', management: 'Avoid systemic corticosteroids before starting; use only for irAE management', managementAr: 'تجنب الكورتيكوستيرويدات قبل البدء؛ استخدمها فقط لعلاج التفاعلات المناعية' }
    ],
    contraindications: ['Severe immune-mediated reaction to prior anti-PD-1 therapy', 'Active autoimmune disease requiring systemic treatment'],
    contraindicationsAr: ['تفاعل مناعي شديد سابق لعلاج PD-1', 'مرض مناعي ذاتي نشط يتطلب علاجاً جهازياً'],
    monitoringRequired: ['Thyroid function every 6 weeks', 'LFTs before each cycle', 'Renal function', 'Signs of pneumonitis (dyspnea, cough)', 'Blood glucose'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze. Protect from light.'
  },
  {
    id: 'FRM-0618', genericName: 'Nivolumab', genericNameAr: 'نيفولوماب',
    brandNames: ['Opdivo'], sfda_registration: 'SFDA-2024-NIV-618',
    atcCode: 'L01FF01', atcCategory: 'PD-1/PD-L1 inhibitors',
    therapeuticClass: 'Anti-PD-1 Checkpoint Inhibitor', therapeuticClassAr: 'مثبط نقاط التفتيش المناعية PD-1',
    formularyStatus: 'restricted', restrictionCriteria: 'Oncologist approval required.',
    restrictionCriteriaAr: 'يتطلب موافقة أخصائي الأورام.',
    approverRole: 'oncologist', route: ['intravenous'], forms: [
      { form: 'Vial for infusion', strength: '240mg/24mL', unitPrice: 8500, inStock: true },
      { form: 'Vial for infusion', strength: '100mg/10mL', unitPrice: 3800, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'D', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Nivolumab/Niraparib'], blackBoxWarning: 'Immune-mediated adverse reactions affecting any organ system. Withhold or discontinue based on severity.',
    blackBoxWarningAr: 'تفاعلات مناعية تؤثر على أي جهاز عضوي. أوقف أو أوقف نهائياً حسب الشدة.',
    interactions: [
      { interactsWith: 'Ipilimumab', severity: 'major', mechanism: 'Dual checkpoint blockade increases immune activation', clinicalEffect: 'Higher rate of immune-mediated toxicity', clinicalEffectAr: 'معدل أعلى من السمية المناعية', management: 'Use approved combination dosing; monitor closely for irAEs', managementAr: 'استخدم الجرعات المعتمدة؛ مراقبة التفاعلات المناعية بدقة' }
    ],
    contraindications: ['Grade 4 immune-mediated reaction to prior checkpoint inhibitor', 'Active autoimmune disease'],
    contraindicationsAr: ['تفاعل مناعي درجة 4 سابق', 'مرض مناعي ذاتي نشط'],
    monitoringRequired: ['Thyroid function', 'LFTs', 'Renal function', 'Adrenal function', 'Glucose', 'Signs of colitis'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0619', genericName: 'Atezolizumab', genericNameAr: 'أتيزوليزوماب',
    brandNames: ['Tecentriq'], sfda_registration: 'SFDA-2024-ATE-619',
    atcCode: 'L01FF05', atcCategory: 'PD-1/PD-L1 inhibitors',
    therapeuticClass: 'Anti-PD-L1 Checkpoint Inhibitor', therapeuticClassAr: 'مثبط نقاط التفتيش المناعية PD-L1',
    formularyStatus: 'restricted', restrictionCriteria: 'Oncologist approval. For urothelial carcinoma, NSCLC, TNBC, HCC.',
    restrictionCriteriaAr: 'موافقة أخصائي الأورام. لسرطان المسالك البولية والرئة والثدي الثلاثي السلبي والكبد.',
    approverRole: 'oncologist', route: ['intravenous'], forms: [
      { form: 'Vial for infusion', strength: '1200mg/20mL', unitPrice: 11000, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'D', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Atezolizumab/Avelumab'], blackBoxWarning: 'Immune-mediated pneumonitis, hepatitis, colitis, endocrinopathies, meningoencephalitis, neuropathies.',
    blackBoxWarningAr: 'التهاب رئوي مناعي، التهاب كبد، التهاب قولون، اعتلالات غدد صماء، التهاب سحايا ودماغ.',
    interactions: [
      { interactsWith: 'Systemic corticosteroids', severity: 'moderate', mechanism: 'Immunosuppression', clinicalEffect: 'May reduce efficacy', clinicalEffectAr: 'قد يقلل الفعالية', management: 'Avoid before initiation; use for irAE only', managementAr: 'تجنب قبل البدء؛ استخدم للتفاعلات المناعية فقط' }
    ],
    contraindications: ['Severe immune-mediated reaction to prior anti-PD-L1', 'Active autoimmune disease'],
    contraindicationsAr: ['تفاعل مناعي شديد سابق', 'مرض مناعي ذاتي نشط'],
    monitoringRequired: ['Thyroid function', 'LFTs', 'Blood glucose', 'Renal function', 'Chest imaging for pneumonitis'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0620', genericName: 'Ipilimumab', genericNameAr: 'إبيليموماب',
    brandNames: ['Yervoy'], sfda_registration: 'SFDA-2024-IPI-620',
    atcCode: 'L01FX04', atcCategory: 'Other antineoplastic monoclonal antibodies',
    therapeuticClass: 'Anti-CTLA-4 Checkpoint Inhibitor', therapeuticClassAr: 'مثبط نقاط التفتيش المناعية CTLA-4',
    formularyStatus: 'restricted', restrictionCriteria: 'Oncologist approval only. Often used in combination with nivolumab.',
    restrictionCriteriaAr: 'موافقة أخصائي الأورام فقط. يستخدم غالباً مع نيفولوماب.',
    approverRole: 'oncologist', route: ['intravenous'], forms: [
      { form: 'Vial for infusion', strength: '200mg/40mL', unitPrice: 15000, inStock: true },
      { form: 'Vial for infusion', strength: '50mg/10mL', unitPrice: 4000, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'X', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Ipilimumab/Infliximab'], blackBoxWarning: 'Severe and fatal immune-mediated adverse reactions. Most common: enterocolitis, hepatitis, dermatitis, neuropathy, endocrinopathy.',
    blackBoxWarningAr: 'تفاعلات مناعية شديدة ومميتة. الأكثر شيوعاً: التهاب قولون ومعوي، التهاب كبد، التهاب جلد، اعتلال أعصاب، اعتلال غدد صماء.',
    interactions: [
      { interactsWith: 'Vemurafenib', severity: 'major', mechanism: 'Hepatotoxicity synergy', clinicalEffect: 'Increased hepatotoxicity', clinicalEffectAr: 'زيادة السمية الكبدية', management: 'Monitor LFTs closely; avoid concurrent use if possible', managementAr: 'مراقبة وظائف الكبد بدقة؛ تجنب الاستخدام المتزامن إن أمكن' }
    ],
    contraindications: ['Pregnancy', 'Severe prior immune-mediated reaction to anti-CTLA-4'],
    contraindicationsAr: ['الحمل', 'تفاعل مناعي شديد سابق لمضاد CTLA-4'],
    monitoringRequired: ['LFTs before each dose', 'Thyroid function', 'Adrenal function', 'Stool frequency', 'Skin examination'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze.'
  },
  // ── HER2-Targeted ──
  {
    id: 'FRM-0621', genericName: 'Trastuzumab', genericNameAr: 'تراستوزوماب',
    brandNames: ['Herceptin', 'Ogivri'], sfda_registration: 'SFDA-2024-TRA-621',
    atcCode: 'L01FD01', atcCategory: 'HER2 inhibitors',
    therapeuticClass: 'Anti-HER2 Monoclonal Antibody', therapeuticClassAr: 'جسم مضاد وحيد النسيلة مضاد HER2',
    formularyStatus: 'restricted', restrictionCriteria: 'Oncologist approval. HER2-positive confirmation required.',
    restrictionCriteriaAr: 'موافقة أخصائي الأورام. يشترط تأكيد إيجابية HER2.',
    approverRole: 'oncologist', route: ['intravenous', 'subcutaneous'], forms: [
      { form: 'Vial for infusion', strength: '440mg', unitPrice: 5800, inStock: true },
      { form: 'Vial for injection SC', strength: '600mg/5mL', unitPrice: 5200, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'D', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Trastuzumab/Trastuzumab emtansine'], blackBoxWarning: 'Cardiomyopathy (reduced LVEF), infusion reactions, embryo-fetal toxicity, pulmonary toxicity.',
    blackBoxWarningAr: 'اعتلال عضلة القلب (انخفاض الكسر القذفي)، تفاعلات تسريب، سمية جنينية، سمية رئوية.',
    interactions: [
      { interactsWith: 'Anthracyclines (doxorubicin)', severity: 'major', mechanism: 'Additive cardiotoxicity', clinicalEffect: 'Increased risk of heart failure', clinicalEffectAr: 'زيادة خطر فشل القلب', management: 'Avoid concurrent anthracycline use; monitor LVEF closely', managementAr: 'تجنب الاستخدام المتزامن؛ مراقبة الكسر القذفي بدقة' }
    ],
    contraindications: ['Severe cardiac dysfunction (LVEF <40%)', 'Severe dyspnea at rest due to lung disease'],
    contraindicationsAr: ['خلل قلبي شديد (الكسر القذفي أقل من 40%)', 'ضيق تنفس شديد أثناء الراحة'],
    monitoringRequired: ['LVEF by echocardiography every 3 months', 'Cardiac symptoms', 'Infusion reactions', 'CBC'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0622', genericName: 'Pertuzumab', genericNameAr: 'بيرتوزوماب',
    brandNames: ['Perjeta'], sfda_registration: 'SFDA-2024-PER-622',
    atcCode: 'L01FD02', atcCategory: 'HER2 inhibitors',
    therapeuticClass: 'Anti-HER2 Monoclonal Antibody', therapeuticClassAr: 'جسم مضاد وحيد النسيلة مضاد HER2',
    formularyStatus: 'restricted', restrictionCriteria: 'Oncologist approval. Used in combination with trastuzumab and docetaxel.',
    restrictionCriteriaAr: 'موافقة أخصائي الأورام. يستخدم مع تراستوزوماب ودوسيتاكسيل.',
    approverRole: 'oncologist', route: ['intravenous'], forms: [
      { form: 'Vial for infusion', strength: '420mg/14mL', unitPrice: 7200, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'D', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Pertuzumab/Pembrolizumab'], blackBoxWarning: 'Embryo-fetal toxicity. Left ventricular dysfunction.',
    blackBoxWarningAr: 'سمية جنينية. خلل في البطين الأيسر.',
    interactions: [
      { interactsWith: 'Trastuzumab', severity: 'moderate', mechanism: 'Additive cardiac effects', clinicalEffect: 'Increased LVEF decline', clinicalEffectAr: 'زيادة انخفاض الكسر القذفي', management: 'Monitor LVEF closely during combination', managementAr: 'مراقبة الكسر القذفي بدقة أثناء الجمع' }
    ],
    contraindications: ['Pregnancy', 'LVEF <45% or significant LVEF decline'],
    contraindicationsAr: ['الحمل', 'الكسر القذفي أقل من 45% أو انخفاض كبير'],
    monitoringRequired: ['LVEF every 3 months', 'Signs of CHF', 'Infusion reactions'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0623', genericName: 'Trastuzumab emtansine', genericNameAr: 'تراستوزوماب إمتانسين',
    brandNames: ['Kadcyla'], sfda_registration: 'SFDA-2024-TDM-623',
    atcCode: 'L01FD03', atcCategory: 'HER2 inhibitors',
    therapeuticClass: 'Antibody-Drug Conjugate (HER2)', therapeuticClassAr: 'أجسام مضادة مقترنة بالدواء (HER2)',
    formularyStatus: 'restricted', restrictionCriteria: 'Oncologist approval. For HER2+ breast cancer after prior trastuzumab and taxane.',
    restrictionCriteriaAr: 'موافقة أخصائي الأورام. لسرطان الثدي HER2+ بعد تراستوزوماب وتاكسان سابقاً.',
    approverRole: 'oncologist', route: ['intravenous'], forms: [
      { form: 'Vial for infusion', strength: '100mg', unitPrice: 8500, inStock: true },
      { form: 'Vial for infusion', strength: '160mg', unitPrice: 13500, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: true, pregnancyCategory: 'D', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Trastuzumab emtansine/Trastuzumab'], blackBoxWarning: 'Hepatotoxicity (including fatal liver failure), cardiotoxicity, embryo-fetal toxicity. Do NOT substitute with trastuzumab.',
    blackBoxWarningAr: 'سمية كبدية (بما في ذلك فشل كبدي مميت)، سمية قلبية، سمية جنينية. لا تستبدل بتراستوزوماب.',
    interactions: [
      { interactsWith: 'Strong CYP3A4 inhibitors', severity: 'moderate', mechanism: 'Inhibition of DM1 metabolism', clinicalEffect: 'Increased DM1 cytotoxic exposure', clinicalEffectAr: 'زيادة التعرض للمكون السام', management: 'Avoid strong CYP3A4 inhibitors if possible', managementAr: 'تجنب مثبطات CYP3A4 القوية إن أمكن' }
    ],
    contraindications: ['Pregnancy', 'Severe hepatic impairment', 'LVEF <40%'],
    contraindicationsAr: ['الحمل', 'قصور كبدي شديد', 'الكسر القذفي أقل من 40%'],
    monitoringRequired: ['LFTs before each dose', 'LVEF every 3 months', 'Platelet count', 'Signs of peripheral neuropathy'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze.'
  },
  // ── VEGF Inhibitors ──
  {
    id: 'FRM-0624', genericName: 'Bevacizumab', genericNameAr: 'بيفاسيزوماب',
    brandNames: ['Avastin', 'Zirabev'], sfda_registration: 'SFDA-2024-BEV-624',
    atcCode: 'L01FG01', atcCategory: 'VEGF inhibitors',
    therapeuticClass: 'Anti-VEGF Monoclonal Antibody', therapeuticClassAr: 'جسم مضاد وحيد النسيلة مضاد VEGF',
    formularyStatus: 'restricted', restrictionCriteria: 'Oncologist approval for colorectal, lung, renal, glioblastoma, cervical cancer.',
    restrictionCriteriaAr: 'موافقة أخصائي الأورام لسرطانات القولون والرئة والكلى والدماغ وعنق الرحم.',
    approverRole: 'oncologist', route: ['intravenous'], forms: [
      { form: 'Vial for infusion', strength: '400mg/16mL', unitPrice: 4800, inStock: true },
      { form: 'Vial for infusion', strength: '100mg/4mL', unitPrice: 1300, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'X', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Bevacizumab/Brentuximab'], blackBoxWarning: 'GI perforation, wound healing complications, hemorrhage (including fatal pulmonary hemorrhage).',
    blackBoxWarningAr: 'انثقاب الجهاز الهضمي، مضاعفات التئام الجروح، نزيف (بما في ذلك نزيف رئوي مميت).',
    interactions: [
      { interactsWith: 'Sunitinib', severity: 'major', mechanism: 'Synergistic anti-VEGF effect', clinicalEffect: 'Microangiopathic hemolytic anemia', clinicalEffectAr: 'فقر الدم الانحلالي الوعائي الدقيق', management: 'Avoid combination', managementAr: 'تجنب الجمع' }
    ],
    contraindications: ['Recent surgery (within 28 days)', 'Active internal bleeding', 'Pregnancy'],
    contraindicationsAr: ['جراحة حديثة (خلال 28 يوماً)', 'نزيف داخلي نشط', 'الحمل'],
    monitoringRequired: ['Blood pressure', 'Proteinuria', 'Signs of GI perforation', 'Wound healing'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0625', genericName: 'Ranibizumab', genericNameAr: 'رانيبيزوماب',
    brandNames: ['Lucentis'], sfda_registration: 'SFDA-2024-RAN-625',
    atcCode: 'S01LA04', atcCategory: 'Antineovascularisation agents',
    therapeuticClass: 'Anti-VEGF (Ophthalmic)', therapeuticClassAr: 'مضاد VEGF (عيني)',
    formularyStatus: 'restricted', restrictionCriteria: 'Ophthalmologist approval for wet AMD, DME, or retinal vein occlusion.',
    restrictionCriteriaAr: 'موافقة أخصائي العيون للتنكس البقعي الرطب أو وذمة السكري البقعية.',
    approverRole: 'rheumatologist', route: ['intravitreal'], forms: [
      { form: 'Pre-filled syringe', strength: '0.5mg/0.05mL', unitPrice: 3200, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Ranibizumab/Rituximab'],
    interactions: [
      { interactsWith: 'Other anti-VEGF agents', severity: 'moderate', mechanism: 'Additive VEGF suppression', clinicalEffect: 'Systemic VEGF reduction', clinicalEffectAr: 'انخفاض VEGF الجهازي', management: 'Avoid systemic anti-VEGF concurrently', managementAr: 'تجنب مضادات VEGF الجهازية بالتزامن' }
    ],
    contraindications: ['Active ocular infection', 'Active periocular infection', 'Hypersensitivity'],
    contraindicationsAr: ['عدوى عينية نشطة', 'عدوى حول العين نشطة', 'فرط الحساسية'],
    monitoringRequired: ['Intraocular pressure post-injection', 'Visual acuity', 'Retinal examination', 'Signs of endophthalmitis'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze. Protect from light.'
  },
  {
    id: 'FRM-0626', genericName: 'Aflibercept', genericNameAr: 'أفليبرسبت',
    brandNames: ['Eylea', 'Zaltrap'], sfda_registration: 'SFDA-2024-AFL-626',
    atcCode: 'S01LA05', atcCategory: 'Antineovascularisation agents',
    therapeuticClass: 'VEGF Trap Fusion Protein', therapeuticClassAr: 'بروتين اندماج مصيدة VEGF',
    formularyStatus: 'restricted', restrictionCriteria: 'Ophthalmologist approval for wet AMD, DME, RVO; or oncologist for mCRC (IV form).',
    restrictionCriteriaAr: 'موافقة أخصائي العيون أو الأورام.',
    approverRole: 'oncologist', route: ['intravitreal', 'intravenous'], forms: [
      { form: 'Pre-filled syringe (ophthalmic)', strength: '2mg/0.05mL', unitPrice: 3500, inStock: true },
      { form: 'Vial for infusion (oncology)', strength: '100mg/4mL', unitPrice: 2800, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Aflibercept/Abatacept'],
    interactions: [
      { interactsWith: 'Fluorouracil (IV formulation)', severity: 'moderate', mechanism: 'Additive GI and hematologic toxicity', clinicalEffect: 'Increased diarrhea, neutropenia', clinicalEffectAr: 'زيادة الإسهال ونقص العدلات', management: 'Monitor closely when using IV ziv-aflibercept with FOLFIRI', managementAr: 'مراقبة دقيقة عند الاستخدام مع FOLFIRI' }
    ],
    contraindications: ['Active ocular/periocular infection (ophthalmic)', 'Active GI perforation (IV)'],
    contraindicationsAr: ['عدوى عينية نشطة (العيني)', 'انثقاب الجهاز الهضمي النشط (الوريدي)'],
    monitoringRequired: ['IOP post-injection (ophthalmic)', 'Blood pressure (IV)', 'Proteinuria (IV)', 'CBC (IV)'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze. Protect from light.'
  },
  // ── Tyrosine Kinase Inhibitors ──
  {
    id: 'FRM-0627', genericName: 'Imatinib', genericNameAr: 'إيماتينيب',
    brandNames: ['Gleevec', 'Glivec'], sfda_registration: 'SFDA-2024-IMA-627',
    atcCode: 'L01EA01', atcCategory: 'BCR-ABL tyrosine kinase inhibitors',
    therapeuticClass: 'BCR-ABL Tyrosine Kinase Inhibitor', therapeuticClassAr: 'مثبط تيروزين كيناز BCR-ABL',
    formularyStatus: 'restricted', restrictionCriteria: 'Hematologist-oncologist approval for CML or GIST.',
    restrictionCriteriaAr: 'موافقة أخصائي أمراض الدم والأورام لسرطان الدم النقوي المزمن أو GIST.',
    approverRole: 'oncologist', route: ['oral'], forms: [
      { form: 'Tablet', strength: '100mg', unitPrice: 45, inStock: true },
      { form: 'Tablet', strength: '400mg', unitPrice: 160, inStock: true }
    ],
    maxDailyDose: 800, maxDailyDoseUnit: 'mg',
    renalAdjustment: true, hepaticAdjustment: true, pregnancyCategory: 'D', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Imatinib/Ibrutinib'],
    interactions: [
      { interactsWith: 'CYP3A4 inducers (rifampin)', severity: 'major', mechanism: 'CYP3A4 induction reduces imatinib levels', clinicalEffect: 'Decreased efficacy', clinicalEffectAr: 'انخفاض الفعالية', management: 'Avoid combination; increase imatinib dose if necessary', managementAr: 'تجنب الجمع؛ زيادة الجرعة إذا لزم الأمر' },
      { interactsWith: 'Warfarin', severity: 'major', mechanism: 'CYP3A4/2C9 interaction', clinicalEffect: 'Altered anticoagulation', clinicalEffectAr: 'تغير في التخثر', management: 'Use LMWH instead of warfarin', managementAr: 'استخدم الهيبارين منخفض الوزن الجزيئي بدلاً من الوارفارين' }
    ],
    contraindications: ['Pregnancy', 'Hypersensitivity to imatinib'],
    contraindicationsAr: ['الحمل', 'فرط الحساسية للإيماتينيب'],
    monitoringRequired: ['CBC weekly for first month', 'LFTs', 'Renal function', 'Body weight (fluid retention)', 'Molecular response (BCR-ABL)'],
    storageConditions: 'Store at room temperature 15-30°C. Protect from moisture.'
  },
  {
    id: 'FRM-0628', genericName: 'Erlotinib', genericNameAr: 'إرلوتينيب',
    brandNames: ['Tarceva'], sfda_registration: 'SFDA-2024-ERL-628',
    atcCode: 'L01EB02', atcCategory: 'EGFR tyrosine kinase inhibitors',
    therapeuticClass: 'EGFR Tyrosine Kinase Inhibitor', therapeuticClassAr: 'مثبط تيروزين كيناز EGFR',
    formularyStatus: 'restricted', restrictionCriteria: 'Oncologist approval. EGFR mutation testing required for NSCLC.',
    restrictionCriteriaAr: 'موافقة أخصائي الأورام. يشترط فحص طفرة EGFR لسرطان الرئة.',
    approverRole: 'oncologist', route: ['oral'], forms: [
      { form: 'Tablet', strength: '150mg', unitPrice: 200, inStock: true },
      { form: 'Tablet', strength: '100mg', unitPrice: 160, inStock: true }
    ],
    maxDailyDose: 150, maxDailyDoseUnit: 'mg',
    renalAdjustment: false, hepaticAdjustment: true, pregnancyCategory: 'D', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Erlotinib/Everolimus'],
    interactions: [
      { interactsWith: 'Proton pump inhibitors', severity: 'major', mechanism: 'Reduced absorption at higher gastric pH', clinicalEffect: 'Decreased erlotinib levels', clinicalEffectAr: 'انخفاض مستويات إرلوتينيب', management: 'Avoid PPIs; use H2 blockers with 10-hour separation', managementAr: 'تجنب مثبطات مضخة البروتون' }
    ],
    contraindications: ['Pregnancy', 'Severe hepatic impairment'],
    contraindicationsAr: ['الحمل', 'قصور كبدي شديد'],
    monitoringRequired: ['LFTs', 'Renal function', 'Skin rash assessment', 'Pulmonary symptoms (ILD)'],
    storageConditions: 'Store at room temperature 15-30°C.'
  },
  {
    id: 'FRM-0629', genericName: 'Osimertinib', genericNameAr: 'أوسيميرتينيب',
    brandNames: ['Tagrisso'], sfda_registration: 'SFDA-2024-OSI-629',
    atcCode: 'L01EB04', atcCategory: 'EGFR tyrosine kinase inhibitors',
    therapeuticClass: 'Third-Generation EGFR TKI', therapeuticClassAr: 'مثبط EGFR من الجيل الثالث',
    formularyStatus: 'restricted', restrictionCriteria: 'Oncologist approval. For EGFR T790M-positive or first-line EGFR-mutant NSCLC.',
    restrictionCriteriaAr: 'موافقة أخصائي الأورام. لسرطان الرئة مع طفرة T790M أو خط أول.',
    approverRole: 'oncologist', route: ['oral'], forms: [
      { form: 'Tablet', strength: '80mg', unitPrice: 350, inStock: true },
      { form: 'Tablet', strength: '40mg', unitPrice: 350, inStock: true }
    ],
    maxDailyDose: 80, maxDailyDoseUnit: 'mg',
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'D', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Osimertinib/Olaparib'],
    interactions: [
      { interactsWith: 'Strong CYP3A4 inducers (rifampin)', severity: 'major', mechanism: 'CYP3A4 induction', clinicalEffect: 'Decreased osimertinib exposure', clinicalEffectAr: 'انخفاض التعرض للأوسيميرتينيب', management: 'Avoid strong CYP3A4 inducers', managementAr: 'تجنب محفزات CYP3A4 القوية' }
    ],
    contraindications: ['Pregnancy', 'QTc prolongation >500ms'],
    contraindicationsAr: ['الحمل', 'إطالة QTc أكثر من 500 مللي ثانية'],
    monitoringRequired: ['ECG (QTc interval)', 'LVEF at baseline', 'Pulmonary symptoms (ILD)', 'Skin toxicity'],
    storageConditions: 'Store at room temperature 15-30°C.'
  },
  {
    id: 'FRM-0630', genericName: 'Lenvatinib', genericNameAr: 'لينفاتينيب',
    brandNames: ['Lenvima'], sfda_registration: 'SFDA-2024-LEN-630',
    atcCode: 'L01EX08', atcCategory: 'Other protein kinase inhibitors',
    therapeuticClass: 'Multi-Kinase Inhibitor (VEGFR/FGFR/RET)', therapeuticClassAr: 'مثبط كيناز متعدد (VEGFR/FGFR/RET)',
    formularyStatus: 'restricted', restrictionCriteria: 'Oncologist approval. For differentiated thyroid cancer, HCC, endometrial cancer, RCC.',
    restrictionCriteriaAr: 'موافقة أخصائي الأورام. لسرطان الغدة الدرقية المتمايز والكبد وبطانة الرحم والكلى.',
    approverRole: 'oncologist', route: ['oral'], forms: [
      { form: 'Capsule', strength: '4mg', unitPrice: 120, inStock: true },
      { form: 'Capsule', strength: '10mg', unitPrice: 280, inStock: true }
    ],
    maxDailyDose: 24, maxDailyDoseUnit: 'mg',
    renalAdjustment: true, hepaticAdjustment: true, pregnancyCategory: 'D', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Lenvatinib/Lenalidomide'],
    interactions: [
      { interactsWith: 'QT-prolonging drugs', severity: 'moderate', mechanism: 'Additive QTc prolongation', clinicalEffect: 'Risk of torsades de pointes', clinicalEffectAr: 'خطر اضطراب نظم القلب', management: 'Monitor ECG and electrolytes', managementAr: 'مراقبة تخطيط القلب والأملاح' }
    ],
    contraindications: ['Pregnancy', 'Uncontrolled hypertension', 'Active arterial thromboembolism'],
    contraindicationsAr: ['الحمل', 'ارتفاع ضغط الدم غير المسيطر عليه', 'انسداد شرياني نشط'],
    monitoringRequired: ['Blood pressure', 'LFTs', 'Renal function', 'Proteinuria', 'TSH', 'ECG'],
    storageConditions: 'Store at room temperature 15-30°C.'
  },
  {
    id: 'FRM-0631', genericName: 'Sorafenib', genericNameAr: 'سورافينيب',
    brandNames: ['Nexavar'], sfda_registration: 'SFDA-2024-SOR-631',
    atcCode: 'L01EX02', atcCategory: 'Other protein kinase inhibitors',
    therapeuticClass: 'Multi-Kinase Inhibitor (RAF/VEGFR/PDGFR)', therapeuticClassAr: 'مثبط كيناز متعدد',
    formularyStatus: 'restricted', restrictionCriteria: 'Oncologist approval for HCC, RCC, or DTC.',
    restrictionCriteriaAr: 'موافقة أخصائي الأورام لسرطان الكبد أو الكلى أو الغدة الدرقية.',
    approverRole: 'oncologist', route: ['oral'], forms: [
      { form: 'Tablet', strength: '200mg', unitPrice: 95, inStock: true }
    ],
    maxDailyDose: 800, maxDailyDoseUnit: 'mg',
    renalAdjustment: false, hepaticAdjustment: true, pregnancyCategory: 'D', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Sorafenib/Sunitinib'],
    interactions: [
      { interactsWith: 'Warfarin', severity: 'major', mechanism: 'Increased bleeding risk', clinicalEffect: 'Elevated INR and hemorrhage', clinicalEffectAr: 'ارتفاع INR ونزيف', management: 'Monitor INR frequently; consider LMWH', managementAr: 'مراقبة INR بشكل متكرر' }
    ],
    contraindications: ['Pregnancy', 'Known hypersensitivity', 'Severe hepatic impairment (Child-Pugh C)'],
    contraindicationsAr: ['الحمل', 'فرط الحساسية المعروف', 'قصور كبدي شديد'],
    monitoringRequired: ['Blood pressure weekly initially', 'Hand-foot skin reaction', 'LFTs', 'Lipase/amylase', 'ECG'],
    storageConditions: 'Store at room temperature 15-30°C. Store in original container.'
  },
  // ── Other Targeted Therapies ──
  {
    id: 'FRM-0632', genericName: 'Bortezomib', genericNameAr: 'بورتيزوميب',
    brandNames: ['Velcade'], sfda_registration: 'SFDA-2024-BOR-632',
    atcCode: 'L01XG01', atcCategory: 'Proteasome inhibitors',
    therapeuticClass: 'Proteasome Inhibitor', therapeuticClassAr: 'مثبط البروتيزوم',
    formularyStatus: 'restricted', restrictionCriteria: 'Hematologist-oncologist approval for multiple myeloma or mantle cell lymphoma.',
    restrictionCriteriaAr: 'موافقة أخصائي أمراض الدم والأورام للورم النقوي المتعدد أو لمفوما خلايا الوشاح.',
    approverRole: 'oncologist', route: ['subcutaneous', 'intravenous'], forms: [
      { form: 'Vial for injection', strength: '3.5mg', unitPrice: 2800, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: true, pregnancyCategory: 'D', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Bortezomib/Bosutinib'],
    interactions: [
      { interactsWith: 'Strong CYP3A4 inhibitors', severity: 'moderate', mechanism: 'CYP3A4 inhibition', clinicalEffect: 'Increased bortezomib toxicity', clinicalEffectAr: 'زيادة سمية بورتيزوميب', management: 'Monitor for toxicity; dose adjust if needed', managementAr: 'مراقبة السمية؛ تعديل الجرعة' }
    ],
    contraindications: ['Hypersensitivity to bortezomib or boron', 'Severe hepatic impairment', 'Acute diffuse pulmonary disease'],
    contraindicationsAr: ['فرط الحساسية للبورتيزوميب أو البورون', 'قصور كبدي شديد', 'مرض رئوي منتشر حاد'],
    monitoringRequired: ['CBC before each cycle', 'Peripheral neuropathy assessment', 'Blood glucose (diabetics)', 'Signs of tumor lysis syndrome'],
    storageConditions: 'Store at room temperature 15-30°C. Protect from light.'
  },
  {
    id: 'FRM-0633', genericName: 'Lenalidomide', genericNameAr: 'ليناليدوميد',
    brandNames: ['Revlimid'], sfda_registration: 'SFDA-2024-LENA-633',
    atcCode: 'L04AX04', atcCategory: 'Other immunosuppressants',
    therapeuticClass: 'Immunomodulatory Agent (IMiD)', therapeuticClassAr: 'عامل معدل للمناعة',
    formularyStatus: 'restricted', restrictionCriteria: 'Hematologist-oncologist approval. REMS program enrollment required.',
    restrictionCriteriaAr: 'موافقة أخصائي أمراض الدم والأورام. يتطلب التسجيل في برنامج السلامة.',
    approverRole: 'oncologist', route: ['oral'], forms: [
      { form: 'Capsule', strength: '25mg', unitPrice: 550, inStock: true },
      { form: 'Capsule', strength: '10mg', unitPrice: 480, inStock: true },
      { form: 'Capsule', strength: '5mg', unitPrice: 450, inStock: true }
    ],
    maxDailyDose: 25, maxDailyDoseUnit: 'mg',
    renalAdjustment: true, hepaticAdjustment: false, pregnancyCategory: 'X', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Lenalidomide/Lenvatinib'], blackBoxWarning: 'Embryo-fetal toxicity (teratogenic — thalidomide analog). Hematologic toxicity. Venous/arterial thromboembolism.',
    blackBoxWarningAr: 'سمية جنينية (مشوّه للأجنة — نظير الثاليدوميد). سمية دموية. انسداد وريدي/شرياني.',
    interactions: [
      { interactsWith: 'Dexamethasone', severity: 'moderate', mechanism: 'Additive thrombotic risk', clinicalEffect: 'Increased VTE risk', clinicalEffectAr: 'زيادة خطر الانسداد الوريدي', management: 'Thromboprophylaxis required with combination', managementAr: 'الوقاية من التخثر مطلوبة مع الجمع' }
    ],
    contraindications: ['Pregnancy', 'Women of childbearing potential without contraception', 'Hypersensitivity'],
    contraindicationsAr: ['الحمل', 'النساء في سن الإنجاب بدون موانع حمل', 'فرط الحساسية'],
    monitoringRequired: ['Pregnancy test before each cycle', 'CBC weekly for first 2 cycles then monthly', 'Renal function', 'TSH', 'VTE symptoms'],
    storageConditions: 'Store at room temperature 15-30°C.'
  },
  {
    id: 'FRM-0634', genericName: 'Ibrutinib', genericNameAr: 'إبروتينيب',
    brandNames: ['Imbruvica'], sfda_registration: 'SFDA-2024-IBR-634',
    atcCode: 'L01EL01', atcCategory: 'Bruton tyrosine kinase inhibitors',
    therapeuticClass: 'BTK Inhibitor', therapeuticClassAr: 'مثبط بروتون تيروزين كيناز',
    formularyStatus: 'restricted', restrictionCriteria: 'Hematologist-oncologist approval for CLL, MCL, or WM.',
    restrictionCriteriaAr: 'موافقة أخصائي أمراض الدم والأورام.',
    approverRole: 'oncologist', route: ['oral'], forms: [
      { form: 'Capsule', strength: '140mg', unitPrice: 280, inStock: true },
      { form: 'Tablet', strength: '420mg', unitPrice: 800, inStock: true }
    ],
    maxDailyDose: 560, maxDailyDoseUnit: 'mg',
    renalAdjustment: false, hepaticAdjustment: true, pregnancyCategory: 'D', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Ibrutinib/Imatinib'],
    interactions: [
      { interactsWith: 'Strong CYP3A4 inhibitors', severity: 'major', mechanism: 'CYP3A4 inhibition increases ibrutinib exposure', clinicalEffect: 'Increased toxicity (bleeding, infection)', clinicalEffectAr: 'زيادة السمية (نزيف، عدوى)', management: 'Reduce dose or avoid combination', managementAr: 'تقليل الجرعة أو تجنب الجمع' },
      { interactsWith: 'Anticoagulants/Antiplatelets', severity: 'major', mechanism: 'Additive bleeding risk via platelet inhibition', clinicalEffect: 'Increased hemorrhage risk', clinicalEffectAr: 'زيادة خطر النزيف', management: 'Use with caution; withhold 3-7 days peri-operatively', managementAr: 'استخدم بحذر؛ أوقف 3-7 أيام حول الجراحة' }
    ],
    contraindications: ['Pregnancy', 'Severe hepatic impairment (Child-Pugh C)'],
    contraindicationsAr: ['الحمل', 'قصور كبدي شديد'],
    monitoringRequired: ['CBC monthly', 'Blood pressure', 'ECG (atrial fibrillation)', 'Signs of bleeding', 'LFTs'],
    storageConditions: 'Store at room temperature 15-30°C.'
  },
  {
    id: 'FRM-0635', genericName: 'Venetoclax', genericNameAr: 'فينيتوكلاكس',
    brandNames: ['Venclexta', 'Venclyxto'], sfda_registration: 'SFDA-2024-VEN-635',
    atcCode: 'L01XX52', atcCategory: 'Other antineoplastic agents',
    therapeuticClass: 'BCL-2 Inhibitor', therapeuticClassAr: 'مثبط BCL-2',
    formularyStatus: 'restricted', restrictionCriteria: 'Hematologist-oncologist approval for CLL or AML. TLS risk stratification required.',
    restrictionCriteriaAr: 'موافقة أخصائي أمراض الدم والأورام. يتطلب تقييم خطر متلازمة انحلال الورم.',
    approverRole: 'oncologist', route: ['oral'], forms: [
      { form: 'Tablet', strength: '100mg', unitPrice: 320, inStock: true },
      { form: 'Tablet', strength: '10mg', unitPrice: 40, inStock: true }
    ],
    maxDailyDose: 400, maxDailyDoseUnit: 'mg',
    renalAdjustment: true, hepaticAdjustment: true, pregnancyCategory: 'D', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: true, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Venetoclax/Vemurafenib'], blackBoxWarning: 'Tumor lysis syndrome (TLS): fatalities have occurred. Gradual dose ramp-up over 5 weeks required.',
    blackBoxWarningAr: 'متلازمة انحلال الورم: تم الإبلاغ عن حالات وفاة. يتطلب زيادة تدريجية للجرعة على مدى 5 أسابيع.',
    interactions: [
      { interactsWith: 'Strong CYP3A4 inhibitors (posaconazole)', severity: 'major', mechanism: 'CYP3A4 inhibition', clinicalEffect: 'Markedly increased venetoclax exposure and TLS risk', clinicalEffectAr: 'زيادة ملحوظة في التعرض وخطر انحلال الورم', management: 'Reduce venetoclax dose by at least 75%', managementAr: 'تقليل الجرعة بنسبة 75% على الأقل' }
    ],
    contraindications: ['Concurrent strong CYP3A4 inhibitors during dose ramp-up', 'Pregnancy'],
    contraindicationsAr: ['مثبطات CYP3A4 القوية أثناء مرحلة زيادة الجرعة', 'الحمل'],
    monitoringRequired: ['TLS labs (potassium, uric acid, phosphorus, calcium, creatinine) per ramp-up schedule', 'CBC', 'Signs of infection'],
    storageConditions: 'Store at room temperature 15-30°C.'
  },
  {
    id: 'FRM-0636', genericName: 'Daratumumab', genericNameAr: 'داراتوموماب',
    brandNames: ['Darzalex'], sfda_registration: 'SFDA-2024-DAR-636',
    atcCode: 'L01FC01', atcCategory: 'Anti-CD38 monoclonal antibodies',
    therapeuticClass: 'Anti-CD38 Monoclonal Antibody', therapeuticClassAr: 'جسم مضاد وحيد النسيلة مضاد CD38',
    formularyStatus: 'restricted', restrictionCriteria: 'Hematologist-oncologist approval for multiple myeloma.',
    restrictionCriteriaAr: 'موافقة أخصائي أمراض الدم والأورام للورم النقوي المتعدد.',
    approverRole: 'oncologist', route: ['intravenous', 'subcutaneous'], forms: [
      { form: 'Vial for infusion', strength: '400mg/20mL', unitPrice: 6800, inStock: true },
      { form: 'Pre-mixed SC injection', strength: '1800mg/15mL', unitPrice: 7500, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Daratumumab/Denosumab'],
    interactions: [
      { interactsWith: 'Blood typing tests', severity: 'moderate', mechanism: 'Daratumumab binds CD38 on RBCs causing panreactivity in indirect antiglobulin test', clinicalEffect: 'False-positive indirect Coombs test', clinicalEffectAr: 'اختبار كومبس غير المباشر إيجابي كاذب', management: 'Type and screen before treatment; notify blood bank of daratumumab use', managementAr: 'فحص فصيلة الدم قبل العلاج؛ إبلاغ بنك الدم' }
    ],
    contraindications: ['Hypersensitivity to daratumumab'],
    contraindicationsAr: ['فرط الحساسية للداراتوموماب'],
    monitoringRequired: ['CBC', 'Infusion reaction monitoring (pre-medicate)', 'HBV reactivation screening', 'Blood bank notification'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze. Protect from light.'
  },
  {
    id: 'FRM-0637', genericName: 'Elotuzumab', genericNameAr: 'إيلوتوزوماب',
    brandNames: ['Empliciti'], sfda_registration: 'SFDA-2024-ELO-637',
    atcCode: 'L01FX08', atcCategory: 'Other antineoplastic monoclonal antibodies',
    therapeuticClass: 'Anti-SLAMF7 Monoclonal Antibody', therapeuticClassAr: 'جسم مضاد وحيد النسيلة مضاد SLAMF7',
    formularyStatus: 'restricted', restrictionCriteria: 'Hematologist-oncologist approval for relapsed/refractory multiple myeloma.',
    restrictionCriteriaAr: 'موافقة أخصائي أمراض الدم والأورام للورم النقوي الناكس/المقاوم.',
    approverRole: 'oncologist', route: ['intravenous'], forms: [
      { form: 'Vial for infusion', strength: '400mg', unitPrice: 5200, inStock: true },
      { form: 'Vial for infusion', strength: '300mg', unitPrice: 3900, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: false, highAlertMedication: true, controlledSubstance: false,
    lookAlikeSoundAlike: ['Elotuzumab/Emicizumab'],
    interactions: [
      { interactsWith: 'Lenalidomide + Dexamethasone', severity: 'moderate', mechanism: 'Combination regimen; additive hematologic toxicity', clinicalEffect: 'Increased cytopenias and infection risk', clinicalEffectAr: 'زيادة نقص الخلايا وخطر العدوى', management: 'Monitor CBC closely; dose adjust per combination protocol', managementAr: 'مراقبة تعداد الدم بدقة' }
    ],
    contraindications: ['Hypersensitivity to elotuzumab'],
    contraindicationsAr: ['فرط الحساسية للإيلوتوزوماب'],
    monitoringRequired: ['CBC', 'LFTs', 'Infusion reaction monitoring', 'Signs of infection', 'Second primary malignancy surveillance'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze.'
  },
  {
    id: 'FRM-0638', genericName: 'Denosumab', genericNameAr: 'دينوسوماب',
    brandNames: ['Prolia', 'Xgeva'], sfda_registration: 'SFDA-2024-DEN-638',
    atcCode: 'M05BX04', atcCategory: 'Other drugs affecting bone structure and mineralization',
    therapeuticClass: 'RANK Ligand Inhibitor', therapeuticClassAr: 'مثبط رابط RANK',
    formularyStatus: 'conditional', restrictionCriteria: 'Endocrinologist or oncologist approval depending on indication.',
    restrictionCriteriaAr: 'موافقة أخصائي الغدد الصماء أو الأورام حسب الاستطباب.',
    approverRole: 'rheumatologist', route: ['subcutaneous'], forms: [
      { form: 'Pre-filled syringe (Prolia)', strength: '60mg/mL', unitPrice: 1200, inStock: true },
      { form: 'Vial (Xgeva)', strength: '120mg/1.7mL', unitPrice: 1800, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'X', lactationSafe: false,
    pediatricApproved: false, geriatricCaution: true, highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Denosumab/Daratumumab'],
    interactions: [
      { interactsWith: 'Other antiresorptive agents (bisphosphonates)', severity: 'moderate', mechanism: 'Additive suppression of bone turnover', clinicalEffect: 'Increased risk of osteonecrosis of the jaw and atypical fracture', clinicalEffectAr: 'زيادة خطر نخر عظم الفك والكسور غير النمطية', management: 'Avoid sequential or concurrent use', managementAr: 'تجنب الاستخدام المتتالي أو المتزامن' }
    ],
    contraindications: ['Pregnancy', 'Hypocalcemia (must correct before initiating)', 'Hypersensitivity'],
    contraindicationsAr: ['الحمل', 'نقص كالسيوم الدم (يجب تصحيحه قبل البدء)', 'فرط الحساسية'],
    monitoringRequired: ['Serum calcium before each dose', 'Vitamin D levels', 'Dental examination before starting', 'Signs of ONJ', 'Renal function'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze. Protect from light.'
  },
  {
    id: 'FRM-0639', genericName: 'Abatacept', genericNameAr: 'أباتاسبت',
    brandNames: ['Orencia'], sfda_registration: 'SFDA-2024-ABA-639',
    atcCode: 'L04AA24', atcCategory: 'Selective immunosuppressants',
    therapeuticClass: 'T-Cell Co-stimulation Modulator (CTLA-4 Ig)', therapeuticClassAr: 'معدل التحفيز المشترك للخلايا التائية',
    formularyStatus: 'restricted', restrictionCriteria: 'Rheumatologist approval for RA after DMARD failure or juvenile idiopathic arthritis.',
    restrictionCriteriaAr: 'موافقة أخصائي الروماتيزم لالتهاب المفاصل بعد فشل العلاج أو التهاب المفاصل الشبابي.',
    approverRole: 'rheumatologist', route: ['intravenous', 'subcutaneous'], forms: [
      { form: 'Vial for infusion', strength: '250mg', unitPrice: 2500, inStock: true },
      { form: 'Pre-filled syringe', strength: '125mg/mL', unitPrice: 1100, inStock: true }
    ],
    renalAdjustment: false, hepaticAdjustment: false, pregnancyCategory: 'C', lactationSafe: false,
    pediatricApproved: true, geriatricCaution: true, highAlertMedication: false, controlledSubstance: false,
    lookAlikeSoundAlike: ['Abatacept/Adalimumab'],
    interactions: [
      { interactsWith: 'TNF inhibitors', severity: 'major', mechanism: 'Additive immunosuppression', clinicalEffect: 'Significantly increased serious infection risk without added benefit', clinicalEffectAr: 'زيادة كبيرة في خطر العدوى الخطيرة بدون فائدة إضافية', management: 'Do not combine with TNF inhibitors', managementAr: 'لا تجمع مع مثبطات عامل نخر الورم' },
      { interactsWith: 'Live vaccines', severity: 'major', mechanism: 'Immunosuppression', clinicalEffect: 'Risk of infection from live vaccine', clinicalEffectAr: 'خطر العدوى من اللقاح الحي', management: 'Avoid live vaccines during and for 3 months after treatment', managementAr: 'تجنب اللقاحات الحية أثناء و3 أشهر بعد العلاج' }
    ],
    contraindications: ['Active serious infection', 'Hypersensitivity to abatacept'],
    contraindicationsAr: ['عدوى خطيرة نشطة', 'فرط الحساسية للأباتاسبت'],
    monitoringRequired: ['TB screening before initiation', 'Hepatitis B/C serology', 'Signs of infection', 'Blood glucose (may affect in diabetics)'],
    storageConditions: 'Refrigerate at 2-8°C. Do not freeze. Protect from light.'
  }
];
