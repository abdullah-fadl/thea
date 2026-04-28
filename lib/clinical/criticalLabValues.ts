/**
 * Critical Lab Value Auto-Detection & Notification System
 *
 * Patient safety feature: automatically detects CRITICAL and PANIC lab values
 * based on CAP (College of American Pathologists) and CLSI guidelines.
 *
 * Two severity tiers:
 *   CRITICAL  — requires physician notification within 30 minutes
 *   PANIC     — life-threatening, requires notification within 15 minutes
 *
 * All values use real clinical thresholds from:
 *   - CAP Critical Values Consensus Statements
 *   - CLSI GP47 — Management of Critical and Significantly Abnormal Results
 *   - CBAHI (Saudi Central Board for Accreditation of Healthcare Institutions) standards
 *   - Clinical laboratory reference literature (Tietz Clinical Chemistry)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CriticalLabThreshold {
  testCode: string;
  testName: string;
  testNameAr: string;
  unit: string;
  /** Below this = CRITICAL low */
  criticalLow?: number;
  /** Above this = CRITICAL high */
  criticalHigh?: number;
  /** Below this = PANIC (life-threatening) low */
  panicLow?: number;
  /** Above this = PANIC (life-threatening) high */
  panicHigh?: number;
  /** Patient context — "adult", "pediatric", "neonatal" */
  context: string;
  /** Category grouping */
  category: string;
  /** Immediate clinical action (English) */
  immediateAction: string;
  /** Immediate clinical action (Arabic) */
  immediateActionAr: string;
}

export interface LabResultInput {
  testCode: string;
  testName: string;
  value: number;
  unit: string;
  patientId: string;
  encounterId?: string;
  /** Age in years — used for neonatal/pediatric threshold selection */
  patientAge?: number;
  orderedBy?: string;
}

export interface CriticalLabAlert {
  severity: 'CRITICAL' | 'PANIC';
  testCode: string;
  testName: string;
  testNameAr: string;
  value: number;
  unit: string;
  threshold: {
    type: 'HIGH' | 'LOW';
    criticalValue: number;
    panicValue?: number;
  };
  immediateAction: string;
  immediateActionAr: string;
  /** Per CAP/CBAHI: physician must be notified */
  requiresPhysicianNotification: boolean;
  /** Per CAP/CBAHI: critical values must be read-back verified */
  requiresReadBack: boolean;
  /** Standard: 30 min for CRITICAL, 15 min for PANIC */
  timeToNotify: number;
  patientId: string;
  encounterId?: string;
  detectedAt: string;
}

export interface BatchLabResult {
  alerts: CriticalLabAlert[];
  criticalCount: number;
  panicCount: number;
  requiresImmediateAction: boolean;
}

// ---------------------------------------------------------------------------
// Critical Value Threshold Database
// Real clinical values per CAP/CLSI/CBAHI guidelines
// ---------------------------------------------------------------------------

export const CRITICAL_LAB_THRESHOLDS: CriticalLabThreshold[] = [
  // =========================================================================
  // ELECTROLYTES
  // =========================================================================
  {
    testCode: 'K',
    testName: 'Potassium',
    testNameAr: 'البوتاسيوم',
    unit: 'mEq/L',
    criticalLow: 2.8,
    criticalHigh: 6.0,
    panicLow: 2.5,
    panicHigh: 6.5,
    context: 'adult',
    category: 'ELECTROLYTES',
    immediateAction: 'Obtain ECG immediately. If K+ < 2.5: IV replacement with cardiac monitoring. If K+ > 6.5: calcium gluconate, insulin + glucose, kayexalate, consider dialysis.',
    immediateActionAr: 'اطلب تخطيط القلب فوراً. إذا K+ أقل من 2.5: تعويض وريدي مع مراقبة قلبية. إذا K+ أعلى من 6.5: غلوكونات الكالسيوم، أنسولين + جلوكوز، كايكسالات، فكر في الغسيل الكلوي.',
  },
  {
    testCode: 'NA',
    testName: 'Sodium',
    testNameAr: 'الصوديوم',
    unit: 'mEq/L',
    criticalLow: 125,
    criticalHigh: 155,
    panicLow: 120,
    panicHigh: 160,
    context: 'adult',
    category: 'ELECTROLYTES',
    immediateAction: 'If Na+ < 120: risk of cerebral edema and seizures — initiate hypertonic saline cautiously (<8 mEq/L per 24h to avoid ODS). If Na+ > 160: slow correction with free water.',
    immediateActionAr: 'إذا Na+ أقل من 120: خطر وذمة دماغية وتشنجات — ابدأ محلول ملحي مفرط التوتر بحذر (أقل من 8 ميلي مكافئ/لتر لكل 24 ساعة). إذا Na+ أعلى من 160: تصحيح بطيء بالماء الحر.',
  },
  {
    testCode: 'CA',
    testName: 'Calcium (Total)',
    testNameAr: 'الكالسيوم الكلي',
    unit: 'mg/dL',
    criticalLow: 6.5,
    criticalHigh: 12.0,
    panicLow: 6.0,
    panicHigh: 13.0,
    context: 'adult',
    category: 'ELECTROLYTES',
    immediateAction: 'If Ca < 6.0: risk of tetany, seizures, cardiac arrest — IV calcium gluconate with cardiac monitoring. If Ca > 13.0: aggressive hydration, calcitonin, consider bisphosphonates.',
    immediateActionAr: 'إذا Ca أقل من 6.0: خطر تكزز وتشنجات وتوقف قلبي — غلوكونات كالسيوم وريدية مع مراقبة قلبية. إذا Ca أعلى من 13.0: ترطيب مكثف، كالسيتونين، فكر في البيسفوسفونات.',
  },
  {
    testCode: 'MG',
    testName: 'Magnesium',
    testNameAr: 'المغنيسيوم',
    unit: 'mg/dL',
    criticalLow: 1.2,
    criticalHigh: 3.5,
    panicLow: 1.0,
    panicHigh: 4.0,
    context: 'adult',
    category: 'ELECTROLYTES',
    immediateAction: 'If Mg < 1.0: risk of arrhythmia, seizures — IV magnesium sulfate. If Mg > 4.0: loss of deep tendon reflexes, respiratory depression — calcium gluconate antagonist.',
    immediateActionAr: 'إذا Mg أقل من 1.0: خطر اضطراب نظم القلب وتشنجات — كبريتات المغنيسيوم وريدياً. إذا Mg أعلى من 4.0: فقدان منعكسات وتثبيط تنفسي — غلوكونات الكالسيوم كمضاد.',
  },
  {
    testCode: 'PO4',
    testName: 'Phosphorus',
    testNameAr: 'الفوسفور',
    unit: 'mg/dL',
    criticalLow: 1.0,
    panicLow: 0.5,
    criticalHigh: 8.0,
    panicHigh: 10.0,
    context: 'adult',
    category: 'ELECTROLYTES',
    immediateAction: 'If PO4 < 1.0: risk of respiratory failure, rhabdomyolysis — IV phosphate replacement. If PO4 > 8.0: risk of cardiac arrhythmia — check calcium, consider dialysis.',
    immediateActionAr: 'إذا PO4 أقل من 1.0: خطر فشل تنفسي — تعويض فوسفات وريدي. إذا PO4 أعلى من 8.0: خطر اضطراب نظم القلب — افحص الكالسيوم، فكر في الغسيل.',
  },

  // =========================================================================
  // GLUCOSE
  // =========================================================================
  {
    testCode: 'GLU',
    testName: 'Glucose',
    testNameAr: 'الجلوكوز',
    unit: 'mg/dL',
    criticalLow: 50,
    criticalHigh: 400,
    panicLow: 40,
    panicHigh: 500,
    context: 'adult',
    category: 'GLUCOSE',
    immediateAction: 'If glucose < 40: immediate D50W IV push, recheck in 15 min. If glucose > 500: assess for DKA/HHS — IV fluids, insulin drip, monitor K+ closely.',
    immediateActionAr: 'إذا الجلوكوز أقل من 40: دكستروز 50% وريدي فوري، أعد الفحص بعد 15 دقيقة. إذا الجلوكوز أعلى من 500: قيّم لحماض كيتوني/فرط أسمولية — سوائل وريدية، أنسولين مستمر، راقب البوتاسيوم.',
  },
  {
    testCode: 'GLU',
    testName: 'Glucose (Neonatal)',
    testNameAr: 'الجلوكوز (حديثي الولادة)',
    unit: 'mg/dL',
    criticalLow: 40,
    criticalHigh: 300,
    panicLow: 30,
    panicHigh: 400,
    context: 'neonatal',
    category: 'GLUCOSE',
    immediateAction: 'Neonatal hypoglycemia < 30: immediate IV dextrose 10% bolus 2 mL/kg. Recheck glucose in 15 min. Consider continuous D10W infusion.',
    immediateActionAr: 'نقص سكر حديثي الولادة أقل من 30: دكستروز 10% وريدي فوري 2 مل/كغ. أعد الفحص بعد 15 دقيقة. فكر في تسريب مستمر.',
  },

  // =========================================================================
  // BLOOD GASES
  // =========================================================================
  {
    testCode: 'PH',
    testName: 'Blood pH',
    testNameAr: 'حموضة الدم',
    unit: '',
    criticalLow: 7.25,
    criticalHigh: 7.55,
    panicLow: 7.20,
    panicHigh: 7.60,
    context: 'adult',
    category: 'BLOOD_GAS',
    immediateAction: 'pH < 7.20: severe acidosis — identify cause (metabolic vs respiratory), consider bicarbonate if metabolic, intubation if respiratory. pH > 7.60: severe alkalosis — risk of arrhythmia.',
    immediateActionAr: 'pH أقل من 7.20: حموضة شديدة — حدد السبب (استقلابي أو تنفسي)، فكر في بيكربونات أو تنبيب. pH أعلى من 7.60: قلوية شديدة — خطر اضطراب نظم القلب.',
  },
  {
    testCode: 'PCO2',
    testName: 'pCO2',
    testNameAr: 'ضغط ثاني أكسيد الكربون',
    unit: 'mmHg',
    criticalLow: 20,
    criticalHigh: 60,
    panicLow: 15,
    panicHigh: 70,
    context: 'adult',
    category: 'BLOOD_GAS',
    immediateAction: 'pCO2 > 70: severe respiratory acidosis — assess airway, consider BiPAP or intubation. pCO2 < 20: severe respiratory alkalosis — assess for hyperventilation, PE.',
    immediateActionAr: 'pCO2 أعلى من 70: حموضة تنفسية شديدة — قيّم مجرى الهواء، فكر في BiPAP أو تنبيب. pCO2 أقل من 20: قلوية تنفسية شديدة — قيّم فرط التنفس.',
  },
  {
    testCode: 'PO2',
    testName: 'pO2',
    testNameAr: 'ضغط الأكسجين',
    unit: 'mmHg',
    criticalLow: 50,
    panicLow: 40,
    context: 'adult',
    category: 'BLOOD_GAS',
    immediateAction: 'pO2 < 40: severe hypoxemia — high-flow O2 immediately, assess for respiratory failure, consider intubation.',
    immediateActionAr: 'pO2 أقل من 40: نقص أكسجة شديد — أكسجين عالي التدفق فوراً، قيّم فشل تنفسي، فكر في التنبيب.',
  },

  // =========================================================================
  // HEMATOLOGY
  // =========================================================================
  {
    testCode: 'HGB',
    testName: 'Hemoglobin',
    testNameAr: 'الهيموجلوبين',
    unit: 'g/dL',
    criticalLow: 7.0,
    criticalHigh: 18.5,
    panicLow: 5.0,
    panicHigh: 20.0,
    context: 'adult',
    category: 'HEMATOLOGY',
    immediateAction: 'If Hgb < 7.0: type and crossmatch, prepare transfusion. If Hgb < 5.0: emergent transfusion required — risk of cardiovascular collapse. If Hgb > 20.0: assess for polycythemia, therapeutic phlebotomy.',
    immediateActionAr: 'إذا Hgb أقل من 7.0: تصالب دم وتحضير نقل. إذا Hgb أقل من 5.0: نقل دم طارئ — خطر انهيار قلبي وعائي. إذا Hgb أعلى من 20.0: قيّم كثرة الحمر.',
  },
  {
    testCode: 'PLT',
    testName: 'Platelets',
    testNameAr: 'الصفائح الدموية',
    unit: '10^3/uL',
    criticalLow: 50,
    criticalHigh: 800,
    panicLow: 20,
    panicHigh: 1000,
    context: 'adult',
    category: 'HEMATOLOGY',
    immediateAction: 'If PLT < 20: high risk of spontaneous bleeding — platelet transfusion if active bleeding or procedure needed. If PLT > 1,000: risk of thrombosis or paradoxical bleeding — hematology consult.',
    immediateActionAr: 'إذا PLT أقل من 20: خطر نزيف تلقائي عالي — نقل صفائح إذا نزيف فعال. إذا PLT أعلى من 1000: خطر تخثر — استشارة أمراض الدم.',
  },
  {
    testCode: 'WBC',
    testName: 'White Blood Cells',
    testNameAr: 'كريات الدم البيضاء',
    unit: '10^3/uL',
    criticalLow: 2.5,
    criticalHigh: 25.0,
    panicLow: 2.0,
    panicHigh: 30.0,
    context: 'adult',
    category: 'HEMATOLOGY',
    immediateAction: 'If WBC < 2.0: severe neutropenia likely — neutropenic precautions, blood cultures if febrile, consider G-CSF. If WBC > 30.0: assess for leukemia, severe infection — manual differential, peripheral smear.',
    immediateActionAr: 'إذا WBC أقل من 2.0: نقص كريات شديد — احتياطات عزل، مزارع دم إذا حمى، فكر في G-CSF. إذا WBC أعلى من 30.0: قيّم لسرطان الدم أو إنتان شديد.',
  },
  {
    testCode: 'INR',
    testName: 'INR',
    testNameAr: 'نسبة التخثر الدولية',
    unit: '',
    criticalHigh: 4.0,
    panicHigh: 5.0,
    context: 'adult',
    category: 'HEMATOLOGY',
    immediateAction: 'INR > 5.0: high bleeding risk — hold warfarin, vitamin K (oral if no bleeding, IV if active bleeding), consider PCC or FFP if life-threatening bleed.',
    immediateActionAr: 'INR أعلى من 5.0: خطر نزيف مرتفع — أوقف الوارفارين، فيتامين K (فموي إذا لا نزيف، وريدي إذا نزيف فعال)، فكر في PCC أو بلازما.',
  },
  {
    testCode: 'FIBRINOGEN',
    testName: 'Fibrinogen',
    testNameAr: 'الفيبرينوجين',
    unit: 'mg/dL',
    criticalLow: 100,
    panicLow: 80,
    criticalHigh: 700,
    context: 'adult',
    category: 'HEMATOLOGY',
    immediateAction: 'If fibrinogen < 100: DIC risk — cryoprecipitate transfusion. Check D-dimer, PT/aPTT, platelets.',
    immediateActionAr: 'إذا الفيبرينوجين أقل من 100: خطر تخثر منتشر — نقل راسب بارد. افحص D-dimer و PT/aPTT والصفائح.',
  },

  // =========================================================================
  // RENAL
  // =========================================================================
  {
    testCode: 'CREA',
    testName: 'Creatinine',
    testNameAr: 'الكرياتينين',
    unit: 'mg/dL',
    criticalHigh: 7.0,
    panicHigh: 10.0,
    context: 'adult',
    category: 'RENAL',
    immediateAction: 'Creatinine > 10: likely acute kidney injury requiring urgent nephrology consult — assess for dialysis indication (uremia, hyperkalemia, fluid overload, acidosis).',
    immediateActionAr: 'كرياتينين أعلى من 10: إصابة كلوية حادة محتملة — استشارة كلى عاجلة، قيّم مؤشرات الغسيل (يوريميا، فرط بوتاسيوم، فرط سوائل، حموضة).',
  },
  {
    testCode: 'BUN',
    testName: 'Blood Urea Nitrogen',
    testNameAr: 'نيتروجين يوريا الدم',
    unit: 'mg/dL',
    criticalHigh: 80,
    panicHigh: 100,
    context: 'adult',
    category: 'RENAL',
    immediateAction: 'BUN > 100: severe azotemia — nephrology consult, assess for dialysis. Evaluate for GI bleeding as cause of disproportionate elevation.',
    immediateActionAr: 'BUN أعلى من 100: آزوتيميا شديدة — استشارة كلى، قيّم مؤشرات الغسيل. قيّم نزيف الجهاز الهضمي كسبب.',
  },

  // =========================================================================
  // CARDIAC MARKERS
  // =========================================================================
  {
    testCode: 'TROP',
    testName: 'Troponin T/I',
    testNameAr: 'التروبونين',
    unit: 'ng/mL',
    criticalHigh: 0.04,
    panicHigh: 0.1,
    context: 'adult',
    category: 'CARDIAC',
    immediateAction: 'Troponin > 0.1: suggestive of myocardial injury/infarction — STAT 12-lead ECG, activate ACS protocol, cardiology consult, serial troponins q3-6h.',
    immediateActionAr: 'تروبونين أعلى من 0.1: إصابة عضلة قلبية محتملة — تخطيط قلب فوري، فعّل بروتوكول متلازمة شريان تاجي حادة، استشارة قلب، تروبونين متسلسل.',
  },
  {
    testCode: 'BNP',
    testName: 'BNP',
    testNameAr: 'الببتيد الدماغي المدر للصوديوم',
    unit: 'pg/mL',
    criticalHigh: 500,
    panicHigh: 900,
    context: 'adult',
    category: 'CARDIAC',
    immediateAction: 'BNP > 900: severe heart failure likely — assess volume status, initiate diuresis, echocardiography, cardiology consult.',
    immediateActionAr: 'BNP أعلى من 900: فشل قلبي شديد محتمل — قيّم حالة السوائل، ابدأ مدرات، تخطيط صدى القلب، استشارة قلب.',
  },
  {
    testCode: 'CK_MB',
    testName: 'CK-MB',
    testNameAr: 'إنزيم القلب CK-MB',
    unit: 'ng/mL',
    criticalHigh: 10,
    panicHigh: 25,
    context: 'adult',
    category: 'CARDIAC',
    immediateAction: 'CK-MB > 25: myocardial injury — correlate with troponin, ECG, and clinical presentation. Cardiology consult.',
    immediateActionAr: 'CK-MB أعلى من 25: إصابة عضلة قلبية — قارن مع التروبونين وتخطيط القلب. استشارة قلب.',
  },

  // =========================================================================
  // HEPATIC
  // =========================================================================
  {
    testCode: 'ALT',
    testName: 'ALT (SGPT)',
    testNameAr: 'إنزيم الكبد ALT',
    unit: 'U/L',
    criticalHigh: 500,
    panicHigh: 1000,
    context: 'adult',
    category: 'HEPATIC',
    immediateAction: 'ALT > 1000: acute hepatocellular injury — assess for acute hepatitis, drug-induced liver injury, ischemic hepatitis. Check INR, bilirubin, ammonia. Hepatology consult.',
    immediateActionAr: 'ALT أعلى من 1000: إصابة كبدية حادة — قيّم التهاب كبد حاد أو تسمم دوائي. افحص INR والبيليروبين والأمونيا. استشارة كبد.',
  },
  {
    testCode: 'AST',
    testName: 'AST (SGOT)',
    testNameAr: 'إنزيم الكبد AST',
    unit: 'U/L',
    criticalHigh: 500,
    panicHigh: 1000,
    context: 'adult',
    category: 'HEPATIC',
    immediateAction: 'AST > 1000: acute hepatocellular injury — assess etiology (viral, toxic, ischemic). Also consider rhabdomyolysis if CK elevated. Hepatology consult.',
    immediateActionAr: 'AST أعلى من 1000: إصابة كبدية حادة — قيّم السبب (فيروسي، سمي، إقفاري). فكر أيضاً في انحلال عضلي إذا CK مرتفع. استشارة كبد.',
  },
  {
    testCode: 'TBIL',
    testName: 'Total Bilirubin',
    testNameAr: 'البيليروبين الكلي',
    unit: 'mg/dL',
    criticalHigh: 12.0,
    panicHigh: 15.0,
    context: 'adult',
    category: 'HEPATIC',
    immediateAction: 'Total bilirubin > 15: severe jaundice — assess for biliary obstruction (ultrasound), liver failure (check INR), hemolysis (check LDH, reticulocytes).',
    immediateActionAr: 'بيليروبين كلي أعلى من 15: يرقان شديد — قيّم انسداد القناة الصفراوية (أشعة)، فشل كبدي (INR)، انحلال دم (LDH).',
  },
  {
    testCode: 'TBIL_NEO',
    testName: 'Total Bilirubin (Neonatal)',
    testNameAr: 'البيليروبين الكلي (حديثي الولادة)',
    unit: 'mg/dL',
    criticalHigh: 13.0,
    panicHigh: 15.0,
    context: 'neonatal',
    category: 'HEPATIC',
    immediateAction: 'Neonatal bilirubin > 15: risk of kernicterus — initiate phototherapy, consider exchange transfusion per AAP guidelines based on age in hours.',
    immediateActionAr: 'بيليروبين حديثي الولادة أعلى من 15: خطر يرقان نووي — ابدأ المعالجة الضوئية، فكر في نقل الدم التبادلي حسب إرشادات AAP.',
  },
  {
    testCode: 'NH3',
    testName: 'Ammonia',
    testNameAr: 'الأمونيا',
    unit: 'umol/L',
    criticalHigh: 60,
    panicHigh: 100,
    context: 'adult',
    category: 'HEPATIC',
    immediateAction: 'Ammonia > 100: risk of hepatic encephalopathy — lactulose, rifaximin, protein restriction, assess for precipitants (GI bleed, infection, dehydration).',
    immediateActionAr: 'أمونيا أعلى من 100: خطر اعتلال دماغي كبدي — لاكتيولوز، ريفاكسيمين، تقييد البروتين، قيّم المسببات.',
  },

  // =========================================================================
  // CSF (Cerebrospinal Fluid)
  // =========================================================================
  {
    testCode: 'CSF_WBC',
    testName: 'CSF White Blood Cells',
    testNameAr: 'كريات بيضاء في السائل الشوكي',
    unit: 'cells/uL',
    criticalHigh: 5,
    panicHigh: 10,
    context: 'adult',
    category: 'CSF',
    immediateAction: 'CSF WBC > 10: possible meningitis/encephalitis — STAT gram stain, culture, empiric antibiotics (ceftriaxone + vancomycin + dexamethasone). Do NOT delay antibiotics for imaging.',
    immediateActionAr: 'كريات بيضاء شوكية أعلى من 10: التهاب سحايا/دماغ محتمل — صبغة جرام فورية ومزرعة ومضادات حيوية تجريبية. لا تؤخر المضادات الحيوية.',
  },
  {
    testCode: 'CSF_GLU',
    testName: 'CSF Glucose',
    testNameAr: 'جلوكوز السائل الشوكي',
    unit: 'mg/dL',
    criticalLow: 40,
    panicLow: 30,
    context: 'adult',
    category: 'CSF',
    immediateAction: 'CSF glucose < 40: suggests bacterial meningitis (CSF glucose < 40% of serum glucose). Ensure empiric antibiotics started. Infectious disease consult.',
    immediateActionAr: 'جلوكوز شوكي أقل من 40: يشير لالتهاب سحايا جرثومي. تأكد من بدء المضادات الحيوية التجريبية. استشارة أمراض معدية.',
  },

  // =========================================================================
  // SEPSIS / INFLAMMATION MARKERS
  // =========================================================================
  {
    testCode: 'LACTATE',
    testName: 'Lactate',
    testNameAr: 'اللاكتات',
    unit: 'mmol/L',
    criticalHigh: 2.0,
    panicHigh: 4.0,
    context: 'adult',
    category: 'SEPSIS',
    immediateAction: 'Lactate > 4: septic shock criteria — 30 mL/kg crystalloid bolus, blood cultures, broad-spectrum antibiotics within 1 hour per Surviving Sepsis Campaign, vasopressors if MAP < 65 after fluids.',
    immediateActionAr: 'لاكتات أعلى من 4: معايير صدمة إنتانية — بلورانيات 30 مل/كغ، مزارع دم، مضادات حيوية واسعة الطيف خلال ساعة، مقبضات أوعية إذا MAP أقل من 65.',
  },
  {
    testCode: 'PROCALCITONIN',
    testName: 'Procalcitonin',
    testNameAr: 'البروكالسيتونين',
    unit: 'ng/mL',
    criticalHigh: 2.0,
    panicHigh: 10.0,
    context: 'adult',
    category: 'SEPSIS',
    immediateAction: 'Procalcitonin > 10: high likelihood of severe bacterial sepsis — ensure adequate source control, appropriate antibiotic coverage, ICU admission.',
    immediateActionAr: 'بروكالسيتونين أعلى من 10: احتمالية عالية لإنتان جرثومي شديد — تأكد من السيطرة على المصدر والمضادات الحيوية المناسبة ودخول العناية.',
  },

  // =========================================================================
  // D-DIMER / COAGULATION
  // =========================================================================
  {
    testCode: 'DDIMER',
    testName: 'D-Dimer',
    testNameAr: 'دي-دايمر',
    unit: 'ng/mL',
    criticalHigh: 2000,
    panicHigh: 4000,
    context: 'adult',
    category: 'COAGULATION',
    immediateAction: 'D-dimer > 4000: high concern for PE/DVT/DIC — STAT CT pulmonary angiography if PE suspected, check fibrinogen, PT/aPTT, platelets for DIC.',
    immediateActionAr: 'دي-دايمر أعلى من 4000: قلق عالي من انصمام رئوي/تخثر منتشر — أشعة مقطعية رئوية فورية، افحص الفيبرينوجين والتخثر والصفائح.',
  },
  {
    testCode: 'PT',
    testName: 'Prothrombin Time',
    testNameAr: 'زمن البروثرومبين',
    unit: 'seconds',
    criticalHigh: 25,
    panicHigh: 30,
    context: 'adult',
    category: 'COAGULATION',
    immediateAction: 'PT > 30 seconds: significant coagulopathy — assess for liver disease, DIC, warfarin overdose. Consider FFP or vitamin K.',
    immediateActionAr: 'PT أعلى من 30 ثانية: اعتلال تخثر كبير — قيّم أمراض الكبد أو تخثر منتشر أو جرعة زائدة من الوارفارين. فكر في بلازما أو فيتامين K.',
  },
  {
    testCode: 'APTT',
    testName: 'Activated Partial Thromboplastin Time',
    testNameAr: 'زمن الثرومبوبلاستين الجزئي',
    unit: 'seconds',
    criticalHigh: 80,
    panicHigh: 100,
    context: 'adult',
    category: 'COAGULATION',
    immediateAction: 'aPTT > 100: severe coagulopathy or heparin excess — hold heparin, check anti-Xa. If not on anticoagulants: assess for factor deficiencies, DIC.',
    immediateActionAr: 'aPTT أعلى من 100: اعتلال تخثر شديد أو فرط هيبارين — أوقف الهيبارين، افحص anti-Xa. إذا لا مضادات تخثر: قيّم نقص العوامل.',
  },

  // =========================================================================
  // THYROID
  // =========================================================================
  {
    testCode: 'TSH',
    testName: 'TSH',
    testNameAr: 'هرمون الغدة الدرقية',
    unit: 'mIU/L',
    criticalLow: 0.05,
    panicLow: 0.01,
    criticalHigh: 50,
    panicHigh: 100,
    context: 'adult',
    category: 'ENDOCRINE',
    immediateAction: 'TSH < 0.01: possible thyroid storm — check free T4, T3, assess for tachycardia, fever, altered mental status. TSH > 100: severe hypothyroidism/myxedema — check free T4, assess for myxedema coma.',
    immediateActionAr: 'TSH أقل من 0.01: عاصفة درقية محتملة — افحص T4 حر، قيّم تسرع القلب والحمى. TSH أعلى من 100: قصور درقي شديد — افحص T4 حر، قيّم غيبوبة وذمة مخاطية.',
  },

  // =========================================================================
  // MISCELLANEOUS
  // =========================================================================
  {
    testCode: 'LITHIUM',
    testName: 'Lithium',
    testNameAr: 'الليثيوم',
    unit: 'mEq/L',
    criticalHigh: 1.5,
    panicHigh: 2.0,
    context: 'adult',
    category: 'TOXICOLOGY',
    immediateAction: 'Lithium > 2.0: lithium toxicity — hold lithium, aggressive IV hydration, monitor renal function. If level > 4.0 or symptomatic: consider hemodialysis.',
    immediateActionAr: 'ليثيوم أعلى من 2.0: تسمم ليثيوم — أوقف الليثيوم، ترطيب وريدي مكثف، راقب وظائف الكلى. إذا أعلى من 4.0: فكر في الغسيل.',
  },
  {
    testCode: 'DIGOXIN',
    testName: 'Digoxin',
    testNameAr: 'الديجوكسين',
    unit: 'ng/mL',
    criticalHigh: 2.0,
    panicHigh: 2.5,
    context: 'adult',
    category: 'TOXICOLOGY',
    immediateAction: 'Digoxin > 2.5: digitalis toxicity — ECG for arrhythmia, check K+ and Mg2+, consider digoxin-specific Fab fragments (Digibind).',
    immediateActionAr: 'ديجوكسين أعلى من 2.5: تسمم ديجيتال — تخطيط قلب، افحص البوتاسيوم والمغنيسيوم، فكر في أجسام مضادة للديجوكسين.',
  },
  {
    testCode: 'VANCOMYCIN',
    testName: 'Vancomycin Trough',
    testNameAr: 'فانكومايسين (مستوى قاعدي)',
    unit: 'ug/mL',
    criticalHigh: 25,
    panicHigh: 40,
    context: 'adult',
    category: 'TOXICOLOGY',
    immediateAction: 'Vancomycin trough > 25: nephrotoxicity risk — hold dose, check renal function, pharmacy consult for dose adjustment.',
    immediateActionAr: 'فانكومايسين قاعدي أعلى من 25: خطر سمية كلوية — أوقف الجرعة، افحص وظائف الكلى، استشر الصيدلي لتعديل الجرعة.',
  },
  {
    testCode: 'GENTAMICIN',
    testName: 'Gentamicin Trough',
    testNameAr: 'جنتامايسين (مستوى قاعدي)',
    unit: 'ug/mL',
    criticalHigh: 2.0,
    panicHigh: 4.0,
    context: 'adult',
    category: 'TOXICOLOGY',
    immediateAction: 'Gentamicin trough > 2.0: nephrotoxicity and ototoxicity risk — hold dose, check renal function, pharmacy consult.',
    immediateActionAr: 'جنتامايسين قاعدي أعلى من 2.0: خطر سمية كلوية وسمعية — أوقف الجرعة، افحص وظائف الكلى.',
  },
];

// ---------------------------------------------------------------------------
// Index for fast lookup
// ---------------------------------------------------------------------------

const thresholdIndex = new Map<string, CriticalLabThreshold[]>();

for (const t of CRITICAL_LAB_THRESHOLDS) {
  const key = t.testCode.toUpperCase();
  if (!thresholdIndex.has(key)) thresholdIndex.set(key, []);
  thresholdIndex.get(key)!.push(t);
}

/**
 * Resolve the appropriate threshold for a test code + patient context.
 * Falls back from neonatal → pediatric → adult, selecting the most specific match.
 */
function resolveThreshold(
  testCode: string,
  patientAge?: number,
): CriticalLabThreshold | undefined {
  const key = testCode.toUpperCase();
  const candidates = thresholdIndex.get(key);
  if (!candidates || candidates.length === 0) return undefined;

  // Determine context from age
  let desiredContext: string | undefined;
  if (patientAge !== undefined) {
    if (patientAge < 0.0833) {
      // < ~1 month
      desiredContext = 'neonatal';
    } else if (patientAge < 18) {
      desiredContext = 'pediatric';
    } else {
      desiredContext = 'adult';
    }
  }

  // Find best match
  if (desiredContext) {
    const exact = candidates.find((c) => c.context === desiredContext);
    if (exact) return exact;

    // Fallback: neonatal → pediatric → adult
    if (desiredContext === 'neonatal') {
      return candidates.find((c) => c.context === 'pediatric') || candidates.find((c) => c.context === 'adult');
    }
    if (desiredContext === 'pediatric') {
      return candidates.find((c) => c.context === 'adult');
    }
  }

  // Default to adult or first available
  return candidates.find((c) => c.context === 'adult') || candidates[0];
}

// ---------------------------------------------------------------------------
// Core Detection Function
// ---------------------------------------------------------------------------

/**
 * Check a single lab result against critical/panic thresholds.
 *
 * Returns an array of alerts (0 or 1 element). Array format allows
 * easy merging when processing batches.
 */
export function checkCriticalLabValues(results: LabResultInput[]): CriticalLabAlert[] {
  const alerts: CriticalLabAlert[] = [];
  const now = new Date().toISOString();

  for (const result of results) {
    const code = String(result.testCode || '').toUpperCase();
    const threshold = resolveThreshold(code, result.patientAge);
    if (!threshold) continue;

    const value = result.value;

    // Check LOW thresholds (panic first, then critical)
    if (threshold.panicLow !== undefined && value <= threshold.panicLow) {
      alerts.push({
        severity: 'PANIC',
        testCode: code,
        testName: threshold.testName,
        testNameAr: threshold.testNameAr,
        value,
        unit: result.unit || threshold.unit,
        threshold: {
          type: 'LOW',
          criticalValue: threshold.criticalLow ?? threshold.panicLow,
          panicValue: threshold.panicLow,
        },
        immediateAction: threshold.immediateAction,
        immediateActionAr: threshold.immediateActionAr,
        requiresPhysicianNotification: true,
        requiresReadBack: true,
        timeToNotify: 15, // PANIC = 15 min per CAP
        patientId: result.patientId,
        encounterId: result.encounterId,
        detectedAt: now,
      });
    } else if (threshold.criticalLow !== undefined && value <= threshold.criticalLow) {
      alerts.push({
        severity: 'CRITICAL',
        testCode: code,
        testName: threshold.testName,
        testNameAr: threshold.testNameAr,
        value,
        unit: result.unit || threshold.unit,
        threshold: {
          type: 'LOW',
          criticalValue: threshold.criticalLow,
          panicValue: threshold.panicLow,
        },
        immediateAction: threshold.immediateAction,
        immediateActionAr: threshold.immediateActionAr,
        requiresPhysicianNotification: true,
        requiresReadBack: true,
        timeToNotify: 30, // CRITICAL = 30 min per CAP
        patientId: result.patientId,
        encounterId: result.encounterId,
        detectedAt: now,
      });
    }

    // Check HIGH thresholds (panic first, then critical)
    if (threshold.panicHigh !== undefined && value >= threshold.panicHigh) {
      // Don't double-alert if we already flagged a low
      if (alerts.length === 0 || alerts[alerts.length - 1].testCode !== code || alerts[alerts.length - 1].threshold.type !== 'HIGH') {
        alerts.push({
          severity: 'PANIC',
          testCode: code,
          testName: threshold.testName,
          testNameAr: threshold.testNameAr,
          value,
          unit: result.unit || threshold.unit,
          threshold: {
            type: 'HIGH',
            criticalValue: threshold.criticalHigh ?? threshold.panicHigh,
            panicValue: threshold.panicHigh,
          },
          immediateAction: threshold.immediateAction,
          immediateActionAr: threshold.immediateActionAr,
          requiresPhysicianNotification: true,
          requiresReadBack: true,
          timeToNotify: 15,
          patientId: result.patientId,
          encounterId: result.encounterId,
          detectedAt: now,
        });
      }
    } else if (threshold.criticalHigh !== undefined && value >= threshold.criticalHigh) {
      alerts.push({
        severity: 'CRITICAL',
        testCode: code,
        testName: threshold.testName,
        testNameAr: threshold.testNameAr,
        value,
        unit: result.unit || threshold.unit,
        threshold: {
          type: 'HIGH',
          criticalValue: threshold.criticalHigh,
          panicValue: threshold.panicHigh,
        },
        immediateAction: threshold.immediateAction,
        immediateActionAr: threshold.immediateActionAr,
        requiresPhysicianNotification: true,
        requiresReadBack: true,
        timeToNotify: 30,
        patientId: result.patientId,
        encounterId: result.encounterId,
        detectedAt: now,
      });
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Batch Processing Function
// ---------------------------------------------------------------------------

/**
 * Process a batch of lab results and return a structured report of all
 * critical and panic alerts found.
 *
 * Called when lab results are saved — checks all results and returns
 * actionable alert data.
 */
export function processBatchLabResults(results: LabResultInput[]): BatchLabResult {
  const alerts = checkCriticalLabValues(results);

  const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL').length;
  const panicCount = alerts.filter((a) => a.severity === 'PANIC').length;

  return {
    alerts,
    criticalCount,
    panicCount,
    requiresImmediateAction: panicCount > 0,
  };
}

// ---------------------------------------------------------------------------
// Utility: Get all supported test codes
// ---------------------------------------------------------------------------

/**
 * Returns the list of all test codes that have critical/panic thresholds defined.
 * Useful for UI display and configuration screens.
 */
export function getSupportedCriticalTestCodes(): Array<{
  testCode: string;
  testName: string;
  testNameAr: string;
  category: string;
  context: string;
  unit: string;
  criticalLow?: number;
  criticalHigh?: number;
  panicLow?: number;
  panicHigh?: number;
}> {
  return CRITICAL_LAB_THRESHOLDS.map((t) => ({
    testCode: t.testCode,
    testName: t.testName,
    testNameAr: t.testNameAr,
    category: t.category,
    context: t.context,
    unit: t.unit,
    criticalLow: t.criticalLow,
    criticalHigh: t.criticalHigh,
    panicLow: t.panicLow,
    panicHigh: t.panicHigh,
  }));
}

// ---------------------------------------------------------------------------
// Utility: Build notification message
// ---------------------------------------------------------------------------

/**
 * Build a structured bilingual notification message for a critical lab alert.
 * Used by the API route to create notifications via the emit system.
 */
export function buildCriticalAlertNotificationMessage(alert: CriticalLabAlert): {
  title: string;
  titleAr: string;
  message: string;
  messageAr: string;
} {
  const direction = alert.threshold.type === 'HIGH' ? 'above' : 'below';
  const directionAr = alert.threshold.type === 'HIGH' ? 'أعلى من' : 'أقل من';
  const severityLabel = alert.severity === 'PANIC' ? 'PANIC' : 'CRITICAL';
  const severityLabelAr = alert.severity === 'PANIC' ? 'خطر فوري' : 'حرج';

  return {
    title: `[${severityLabel}] ${alert.testName} = ${alert.value} ${alert.unit}`,
    titleAr: `[${severityLabelAr}] ${alert.testNameAr} = ${alert.value} ${alert.unit}`,
    message: `${alert.testName} value of ${alert.value} ${alert.unit} is ${direction} ${alert.severity === 'PANIC' ? 'panic' : 'critical'} threshold (${alert.threshold.criticalValue} ${alert.unit}). ${alert.immediateAction}. Physician notification required within ${alert.timeToNotify} minutes. Read-back confirmation required per CAP/CBAHI standards.`,
    messageAr: `قيمة ${alert.testNameAr} بمقدار ${alert.value} ${alert.unit} ${directionAr} الحد ${alert.severity === 'PANIC' ? 'الخطر' : 'الحرج'} (${alert.threshold.criticalValue} ${alert.unit}). ${alert.immediateActionAr}. يجب إشعار الطبيب خلال ${alert.timeToNotify} دقيقة. مطلوب تأكيد القراءة المرتدة حسب معايير CAP/CBAHI.`,
  };
}
