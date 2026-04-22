export interface CdsInput {
  vitals?: {
    bp?: string | null;
    hr?: number | null;
    temp?: number | null;
    spo2?: number | null;
    rr?: number | null;
    weight?: number | null;
    height?: number | null;
    bmi?: number | null;
    painScore?: number | null;
  };
  diagnoses?: Array<{ code: string; description?: string }>;
  medications?: Array<{ drugName: string; dose?: string }>;
  labResults?: Array<{ code: string; value: number; unit?: string; date?: string }>;
  age?: number | null;
  gender?: 'male' | 'female' | null;
  allergies?: string[];
  smokingStatus?: 'current' | 'former' | 'never' | null;
  pregnant?: boolean | null;
}

export interface CdsAlert {
  id: string;
  category: 'vital' | 'lab' | 'diagnosis' | 'medication' | 'prevention' | 'interaction';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  titleAr: string;
  message: string;
  messageAr: string;
  recommendation?: string;
  recommendationAr?: string;
  references?: string[];
}

const LAB_CRITICAL: Record<string, { low?: number; high?: number; unit: string }> = {
  GLU: { low: 40, high: 500, unit: 'mg/dL' },
  K: { low: 2.5, high: 6.5, unit: 'mEq/L' },
  NA: { low: 120, high: 160, unit: 'mEq/L' },
  CA: { low: 6.0, high: 13.0, unit: 'mg/dL' },
  HGB: { low: 5.0, high: 20.0, unit: 'g/dL' },
  PLT: { low: 20, high: 1000, unit: 'K/uL' },
  WBC: { low: 1.0, high: 30.0, unit: 'K/uL' },
  INR: { high: 5.0, unit: '' },
  TROP: { high: 0.04, unit: 'ng/mL' },
  CREA: { high: 10.0, unit: 'mg/dL' },
  BUN: { high: 100, unit: 'mg/dL' },
  TBIL: { high: 15.0, unit: 'mg/dL' },
  ALT: { high: 1000, unit: 'U/L' },
  AST: { high: 1000, unit: 'U/L' },
  PH: { low: 7.2, high: 7.6, unit: '' },
  PCO2: { low: 20, high: 60, unit: 'mmHg' },
  LACTATE: { high: 4.0, unit: 'mmol/L' },
};

const DIAGNOSIS_RULES: Record<
  string,
  {
    labsToMonitor: string[];
    medicationsToConsider: string[];
    contraindicated: string[];
    preventionReminders: string[];
  }
> = {
  E11: {
    labsToMonitor: ['HbA1c every 3 months', 'Lipid panel annually', 'Creatinine annually', 'Urine albumin annually'],
    medicationsToConsider: ['Metformin if no contraindication', 'Statin for cardiovascular protection'],
    contraindicated: ['Metformin if eGFR < 30'],
    preventionReminders: ['Annual eye exam', 'Annual foot exam', 'Pneumococcal vaccine', 'Influenza vaccine annually'],
  },
  I10: {
    labsToMonitor: ['Creatinine annually', 'Potassium if on ACE/ARB/diuretic', 'Lipid panel annually'],
    medicationsToConsider: ['ACE inhibitor or ARB first-line', 'Add thiazide if BP uncontrolled'],
    contraindicated: ['NSAIDs may increase BP'],
    preventionReminders: ['Home BP monitoring', 'Sodium restriction counseling'],
  },
  I25: {
    labsToMonitor: ['Lipid panel annually', 'Troponin if chest pain'],
    medicationsToConsider: ['Aspirin unless contraindicated', 'High-intensity statin', 'Beta-blocker', 'ACE inhibitor'],
    contraindicated: ['NSAIDs increase cardiovascular risk'],
    preventionReminders: ['Cardiac rehab referral', 'Smoking cessation'],
  },
  N18: {
    labsToMonitor: ['Creatinine quarterly', 'Potassium monthly if severe', 'Phosphorus', 'PTH'],
    medicationsToConsider: ['ACE/ARB for proteinuria', 'Phosphate binder if elevated'],
    contraindicated: ['NSAIDs', 'Metformin if eGFR < 30', 'Gadolinium contrast if eGFR < 30'],
    preventionReminders: ['Nephrology referral if eGFR < 30', 'Avoid nephrotoxins'],
  },
};

function parseBp(bp?: string | null): { systolic?: number; diastolic?: number } {
  if (!bp) return {};
  const parts = String(bp).split('/');
  const systolic = Number(parts[0]);
  const diastolic = Number(parts[1]);
  return {
    systolic: Number.isNaN(systolic) ? undefined : systolic,
    diastolic: Number.isNaN(diastolic) ? undefined : diastolic,
  };
}

export function evaluateCds(input: CdsInput): CdsAlert[] {
  const alerts: CdsAlert[] = [];
  const vitals = input.vitals || {};
  const bp = parseBp(vitals.bp);

  if (bp.systolic && bp.diastolic) {
    if (bp.systolic >= 180 || bp.diastolic >= 120) {
      alerts.push({
        id: 'bp-crisis',
        category: 'vital',
        severity: 'critical',
        title: 'Hypertensive Crisis',
        titleAr: 'أزمة ارتفاع ضغط الدم',
        message: `BP ${bp.systolic}/${bp.diastolic} indicates hypertensive crisis`,
        messageAr: `ضغط الدم ${bp.systolic}/${bp.diastolic} يشير إلى أزمة ارتفاع الضغط`,
        recommendation: 'Immediate evaluation. Consider IV antihypertensives if symptomatic.',
        recommendationAr: 'تقييم فوري. فكر في خافضات الضغط الوريدية إذا كان هناك أعراض.',
      });
    } else if (bp.systolic >= 140 || bp.diastolic >= 90) {
      alerts.push({
        id: 'bp-elevated',
        category: 'vital',
        severity: 'warning',
        title: 'Elevated Blood Pressure',
        titleAr: 'ارتفاع ضغط الدم',
        message: `BP ${bp.systolic}/${bp.diastolic} is elevated`,
        messageAr: `ضغط الدم ${bp.systolic}/${bp.diastolic} مرتفع`,
        recommendation: 'Recheck BP. Consider antihypertensive if persistent.',
        recommendationAr: 'أعد قياس الضغط. فكر في علاج إذا استمر.',
      });
    }
  }

  if (typeof vitals.hr === 'number') {
    if (vitals.hr < 50) {
      alerts.push({
        id: 'hr-brady',
        category: 'vital',
        severity: 'warning',
        title: 'Bradycardia',
        titleAr: 'بطء ضربات القلب',
        message: `Heart rate ${vitals.hr} bpm is low`,
        messageAr: `معدل ضربات القلب ${vitals.hr} منخفض`,
        recommendation: 'Assess for symptoms. Review medications (beta-blockers).',
        recommendationAr: 'قيّم الأعراض. راجع الأدوية (حاصرات بيتا).',
      });
    } else if (vitals.hr > 120) {
      alerts.push({
        id: 'hr-tachy',
        category: 'vital',
        severity: 'warning',
        title: 'Tachycardia',
        titleAr: 'تسارع ضربات القلب',
        message: `Heart rate ${vitals.hr} bpm is elevated`,
        messageAr: `معدل ضربات القلب ${vitals.hr} مرتفع`,
        recommendation: 'Assess for pain, fever, dehydration, anxiety.',
        recommendationAr: 'قيّم الألم، الحرارة، الجفاف، القلق.',
      });
    }
  }

  if (typeof vitals.spo2 === 'number') {
    if (vitals.spo2 < 90) {
      alerts.push({
        id: 'spo2-critical',
        category: 'vital',
        severity: 'critical',
        title: 'Severe Hypoxemia',
        titleAr: 'نقص أكسجين شديد',
        message: `SpO2 ${vitals.spo2}% is critically low`,
        messageAr: `تشبع الأكسجين ${vitals.spo2}% منخفض بشكل خطير`,
        recommendation: 'Immediate supplemental oxygen. Consider respiratory distress workup.',
        recommendationAr: 'أكسجين فوري. فكر في تقييم ضيق التنفس.',
      });
    } else if (vitals.spo2 < 94) {
      alerts.push({
        id: 'spo2-low',
        category: 'vital',
        severity: 'warning',
        title: 'Hypoxemia',
        titleAr: 'نقص الأكسجين',
        message: `SpO2 ${vitals.spo2}% is below normal`,
        messageAr: `تشبع الأكسجين ${vitals.spo2}% أقل من الطبيعي`,
        recommendation: 'Consider supplemental oxygen and respiratory assessment.',
        recommendationAr: 'فكر في إعطاء أكسجين وتقييم التنفس.',
      });
    }
  }

  if (typeof vitals.temp === 'number') {
    if (vitals.temp >= 39.5) {
      alerts.push({
        id: 'temp-high-fever',
        category: 'vital',
        severity: 'critical',
        title: 'High Fever',
        titleAr: 'حرارة عالية جداً',
        message: `Temperature ${vitals.temp}°C indicates high fever`,
        messageAr: `درجة الحرارة ${vitals.temp}°م تشير إلى حرارة عالية`,
        recommendation: 'Investigate source. Consider blood cultures, antipyretics.',
        recommendationAr: 'ابحث عن المصدر. فكر في مزارع الدم وخافضات الحرارة.',
      });
    } else if (vitals.temp >= 38.0) {
      alerts.push({
        id: 'temp-fever',
        category: 'vital',
        severity: 'warning',
        title: 'Fever',
        titleAr: 'حرارة',
        message: `Temperature ${vitals.temp}°C indicates fever`,
        messageAr: `درجة الحرارة ${vitals.temp}°م تشير إلى حمى`,
        recommendation: 'Assess for infection source.',
        recommendationAr: 'قيّم مصدر العدوى.',
      });
    } else if (vitals.temp < 35.5) {
      alerts.push({
        id: 'temp-hypothermia',
        category: 'vital',
        severity: 'warning',
        title: 'Hypothermia',
        titleAr: 'انخفاض الحرارة',
        message: `Temperature ${vitals.temp}°C is low`,
        messageAr: `درجة الحرارة ${vitals.temp}°م منخفضة`,
        recommendation: 'Warming measures. Assess for sepsis in elderly.',
        recommendationAr: 'إجراءات التدفئة. قيّم تسمم الدم في كبار السن.',
      });
    }
  }

  if (typeof vitals.rr === 'number') {
    if (vitals.rr > 24) {
      alerts.push({
        id: 'rr-tachy',
        category: 'vital',
        severity: 'warning',
        title: 'Tachypnea',
        titleAr: 'تسارع التنفس',
        message: `Respiratory rate ${vitals.rr}/min is elevated`,
        messageAr: `معدل التنفس ${vitals.rr}/دقيقة مرتفع`,
        recommendation: 'Assess for respiratory distress, acidosis, pain.',
        recommendationAr: 'قيّم ضيق التنفس، الحموضة، الألم.',
      });
    } else if (vitals.rr < 10) {
      alerts.push({
        id: 'rr-brady',
        category: 'vital',
        severity: 'critical',
        title: 'Bradypnea',
        titleAr: 'بطء التنفس',
        message: `Respiratory rate ${vitals.rr}/min is critically low`,
        messageAr: `معدل التنفس ${vitals.rr}/دقيقة منخفض بشكل خطير`,
        recommendation: 'Assess airway. Review sedatives/opioids.',
        recommendationAr: 'قيّم مجرى الهواء. راجع المهدئات/الأفيونات.',
      });
    }
  }

  if (typeof vitals.painScore === 'number' && vitals.painScore >= 7) {
    alerts.push({
      id: 'pain-severe',
      category: 'vital',
      severity: 'warning',
      title: 'Severe Pain',
      titleAr: 'ألم شديد',
      message: `Pain score ${vitals.painScore}/10 requires attention`,
      messageAr: `درجة الألم ${vitals.painScore}/10 تحتاج اهتمام`,
      recommendation: 'Assess pain source. Consider analgesia.',
      recommendationAr: 'قيّم مصدر الألم. فكر في المسكنات.',
    });
  }

  if (typeof vitals.bmi === 'number') {
    if (vitals.bmi >= 40) {
      alerts.push({
        id: 'bmi-morbid',
        category: 'vital',
        severity: 'warning',
        title: 'Morbid Obesity',
        titleAr: 'سمنة مفرطة',
        message: `BMI ${vitals.bmi.toFixed(1)} indicates morbid obesity`,
        messageAr: `مؤشر كتلة الجسم ${vitals.bmi.toFixed(1)} يشير إلى سمنة مفرطة`,
        recommendation: 'Weight management referral. Screen for metabolic syndrome.',
        recommendationAr: 'تحويل لإدارة الوزن. فحص متلازمة الأيض.',
      });
    } else if (vitals.bmi >= 30) {
      alerts.push({
        id: 'bmi-obese',
        category: 'vital',
        severity: 'info',
        title: 'Obesity',
        titleAr: 'سمنة',
        message: `BMI ${vitals.bmi.toFixed(1)} indicates obesity`,
        messageAr: `مؤشر كتلة الجسم ${vitals.bmi.toFixed(1)} يشير إلى السمنة`,
        recommendation: 'Lifestyle counseling. Screen for comorbidities.',
        recommendationAr: 'إرشاد نمط الحياة. فحص الأمراض المصاحبة.',
      });
    } else if (vitals.bmi < 18.5) {
      alerts.push({
        id: 'bmi-underweight',
        category: 'vital',
        severity: 'warning',
        title: 'Underweight',
        titleAr: 'نقص الوزن',
        message: `BMI ${vitals.bmi.toFixed(1)} indicates underweight`,
        messageAr: `مؤشر كتلة الجسم ${vitals.bmi.toFixed(1)} يشير إلى نقص الوزن`,
        recommendation: 'Nutritional assessment. Screen for eating disorders, malabsorption.',
        recommendationAr: 'تقييم غذائي. فحص اضطرابات الأكل وسوء الامتصاص.',
      });
    }
  }

  if (input.labResults) {
    for (const lab of input.labResults) {
      const critical = LAB_CRITICAL[lab.code.toUpperCase()];
      if (!critical) continue;

      if (critical.low !== undefined && lab.value < critical.low) {
        alerts.push({
          id: `lab-critical-low-${lab.code}`,
          category: 'lab',
          severity: 'critical',
          title: `Critical Low ${lab.code}`,
          titleAr: `${lab.code} منخفض بشكل خطير`,
          message: `${lab.code} = ${lab.value} ${critical.unit} (critical low < ${critical.low})`,
          messageAr: `${lab.code} = ${lab.value} ${critical.unit} (الحد الأدنى الخطير < ${critical.low})`,
          recommendation: 'Immediate clinical correlation and intervention.',
          recommendationAr: 'ربط سريري وتدخل فوري.',
        });
      }

      if (critical.high !== undefined && lab.value > critical.high) {
        alerts.push({
          id: `lab-critical-high-${lab.code}`,
          category: 'lab',
          severity: 'critical',
          title: `Critical High ${lab.code}`,
          titleAr: `${lab.code} مرتفع بشكل خطير`,
          message: `${lab.code} = ${lab.value} ${critical.unit} (critical high > ${critical.high})`,
          messageAr: `${lab.code} = ${lab.value} ${critical.unit} (الحد الأعلى الخطير > ${critical.high})`,
          recommendation: 'Immediate clinical correlation and intervention.',
          recommendationAr: 'ربط سريري وتدخل فوري.',
        });
      }
    }
  }

  if (input.diagnoses) {
    for (const dx of input.diagnoses) {
      const code3 = dx.code.substring(0, 3);
      const rules = DIAGNOSIS_RULES[code3];
      if (rules) {
        alerts.push({
          id: `dx-reminder-${code3}`,
          category: 'diagnosis',
          severity: 'info',
          title: `${dx.description || code3} - Clinical Reminders`,
          titleAr: `${dx.description || code3} - تذكيرات سريرية`,
          message: `Labs to monitor: ${rules.labsToMonitor.join(', ')}`,
          messageAr: `فحوصات للمتابعة: ${rules.labsToMonitor.join(', ')}`,
          recommendation: rules.preventionReminders.join('. '),
          recommendationAr: rules.preventionReminders.join('. '),
        });
      }
    }
  }

  if (input.pregnant === true) {
    const dangerousMeds = ['warfarin', 'methotrexate', 'isotretinoin', 'valproic acid', 'lithium'];
    if (input.medications) {
      for (const med of input.medications) {
        const normalizedMed = med.drugName.toLowerCase();
        if (dangerousMeds.some((d) => normalizedMed.includes(d))) {
          alerts.push({
            id: `pregnancy-contraindicated-${normalizedMed}`,
            category: 'medication',
            severity: 'critical',
            title: 'Pregnancy Contraindication',
            titleAr: 'ممنوع في الحمل',
            message: `${med.drugName} is contraindicated in pregnancy`,
            messageAr: `${med.drugName} ممنوع أثناء الحمل`,
            recommendation: 'Discontinue immediately. Use alternative.',
            recommendationAr: 'أوقف فوراً. استخدم بديل.',
          });
        }
      }
    }
  }

  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}
