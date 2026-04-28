import allergenMap from '@/data/drug-allergen-map.json';

interface AllergenClassData {
  name: string;
  nameAr: string;
  drugs: string[];
  crossReactivity?: Record<string, { risk: string; percentage: string }>;
}

export interface PatientAllergy {
  allergen: string;
  reaction?: string;
  severity?: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  onsetDate?: string;
  verifiedBy?: string;
}

export interface AllergyCheckResult {
  safe: boolean;
  alerts: AllergyAlert[];
}

export interface AllergyAlert {
  id: string;
  type: 'direct' | 'cross-reactivity' | 'class';
  severity: 'contraindicated' | 'high' | 'moderate' | 'low';
  drugName: string;
  allergen: string;
  allergenClass?: string;
  message: string;
  messageAr: string;
  recommendation: string;
  recommendationAr: string;
  crossReactivityRisk?: string;
  requiresOverride: boolean;
}

function normalize(str: string): string {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

function findDrugClass(drugName: string): string | null {
  const normalizedDrug = normalize(drugName);

  for (const [classKey, classData] of Object.entries(allergenMap.allergenClasses) as [string, AllergenClassData][]) {
    const drugs = classData.drugs;
    if (drugs.some((d) => normalize(d) === normalizedDrug || normalizedDrug.includes(normalize(d)))) {
      return classKey;
    }
  }
  return null;
}

function findAllergyClass(allergen: string): string | null {
  const normalizedAllergen = normalize(allergen);

  for (const classKey of Object.keys(allergenMap.allergenClasses)) {
    if (normalize(classKey) === normalizedAllergen) {
      return classKey;
    }
  }

  for (const [classKey, classData] of Object.entries(allergenMap.allergenClasses) as [string, AllergenClassData][]) {
    const className = normalize(classData.name);
    if (className === normalizedAllergen || normalizedAllergen.includes(className)) {
      return classKey;
    }

    const drugs = classData.drugs;
    if (drugs.some((d) => normalize(d) === normalizedAllergen || normalizedAllergen.includes(normalize(d)))) {
      return classKey;
    }
  }
  return null;
}

export function checkDrugAllergy(drugName: string, patientAllergies: PatientAllergy[]): AllergyCheckResult {
  const alerts: AllergyAlert[] = [];
  const normalizedDrug = normalize(drugName);
  const drugClass = findDrugClass(drugName);

  for (const allergy of patientAllergies) {
    const normalizedAllergen = normalize(allergy.allergen);
    const allergyClass = findAllergyClass(allergy.allergen);

    if (
      normalizedDrug === normalizedAllergen ||
      normalizedDrug.includes(normalizedAllergen) ||
      normalizedAllergen.includes(normalizedDrug)
    ) {
      alerts.push({
        id: `direct-${normalizedDrug}-${normalizedAllergen}`,
        type: 'direct',
        severity: 'contraindicated',
        drugName,
        allergen: allergy.allergen,
        message: `DIRECT ALLERGY: Patient is allergic to ${allergy.allergen}`,
        messageAr: `تحذير: المريض لديه حساسية مباشرة من ${allergy.allergen}`,
        recommendation: `Do NOT administer ${drugName}. Choose alternative medication.`,
        recommendationAr: `لا تعطي ${drugName}. اختر دواء بديل.`,
        requiresOverride: true,
      });
      continue;
    }

    if (drugClass && allergyClass && drugClass === allergyClass) {
      const classData = allergenMap.allergenClasses[drugClass as keyof typeof allergenMap.allergenClasses] as unknown as AllergenClassData;
      alerts.push({
        id: `class-${drugClass}-${normalizedDrug}`,
        type: 'class',
        severity: 'high',
        drugName,
        allergen: allergy.allergen,
        allergenClass: classData.name,
        message: `CLASS ALLERGY: ${drugName} is in the same class (${classData.name}) as ${allergy.allergen}`,
        messageAr: `تحذير: ${drugName} من نفس فئة ${allergy.allergen} (${classData.nameAr})`,
        recommendation: `High risk of cross-reactivity. Consider alternative from different class.`,
        recommendationAr: `خطر عالي للتفاعل التبادلي. اختر دواء من فئة مختلفة.`,
        requiresOverride: true,
      });
      continue;
    }

    if (drugClass && allergyClass) {
      const allergyClassData = allergenMap.allergenClasses[allergyClass as keyof typeof allergenMap.allergenClasses] as unknown as AllergenClassData;
      const crossReactivity = allergyClassData.crossReactivity?.[drugClass];

      if (crossReactivity) {
        alerts.push({
          id: `cross-${allergyClass}-${drugClass}`,
          type: 'cross-reactivity',
          severity: crossReactivity.risk === 'high' ? 'high' : 'moderate',
          drugName,
          allergen: allergy.allergen,
          allergenClass: allergyClassData.name,
          message: `CROSS-REACTIVITY: ${drugName} may cross-react with ${allergy.allergen} (${crossReactivity.percentage} risk)`,
          messageAr: `تحذير تفاعل تبادلي: ${drugName} قد يتفاعل مع ${allergy.allergen} (نسبة الخطر ${crossReactivity.percentage})`,
          recommendation: `Monitor closely if administered. Consider skin testing or alternative.`,
          recommendationAr: `راقب بحذر إذا أُعطي. فكر في اختبار الجلد أو بديل.`,
          crossReactivityRisk: crossReactivity.percentage,
          requiresOverride: crossReactivity.risk === 'high',
        });
      }
    }
  }

  alerts.sort((a, b) => {
    const severityOrder = { contraindicated: 0, high: 1, moderate: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return {
    safe: alerts.length === 0,
    alerts,
  };
}

export function checkMultipleDrugsAllergy(drugs: string[], patientAllergies: PatientAllergy[]): Map<string, AllergyCheckResult> {
  const results = new Map<string, AllergyCheckResult>();

  for (const drug of drugs) {
    results.set(drug, checkDrugAllergy(drug, patientAllergies));
  }

  return results;
}

export function getSeverityInfo(severity: string) {
  return allergenMap.severityLevels[severity as keyof typeof allergenMap.severityLevels];
}
