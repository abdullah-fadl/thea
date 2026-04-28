export interface DosageInput {
  drugCode: string;
  patientWeight: number;
  patientAge: number;
  patientAgeMonths?: number;
  indication?: string;
  renalFunction?: 'normal' | 'mild' | 'moderate' | 'severe';
  hepaticFunction?: 'normal' | 'mild' | 'moderate' | 'severe';
}

export interface DosageResult {
  recommendedDose: number;
  unit: string;
  frequency: string;
  maxDailyDose: number;
  route: string;
  warnings: string[];
  adjustments: string[];
  calculationMethod: string;
}

const PEDIATRIC_DRUGS: Record<
  string,
  {
    name: string;
    dosePerKg: number;
    unit: string;
    frequency: string;
    maxDose: number;
    maxDailyDose: number;
    route: string;
    minAge?: number;
    maxAge?: number;
    renalAdjustment?: Record<string, number>;
    hepaticAdjustment?: Record<string, number>;
    indications?: Record<string, { dosePerKg: number; frequency: string }>;
  }
> = {
  amoxicillin: {
    name: 'Amoxicillin',
    dosePerKg: 25,
    unit: 'mg',
    frequency: 'TID',
    maxDose: 500,
    maxDailyDose: 3000,
    route: 'PO',
    indications: {
      otitis_media: { dosePerKg: 40, frequency: 'BID' },
      pneumonia: { dosePerKg: 45, frequency: 'TID' },
      strep_pharyngitis: { dosePerKg: 25, frequency: 'BID' },
    },
  },
  ibuprofen: {
    name: 'Ibuprofen',
    dosePerKg: 10,
    unit: 'mg',
    frequency: 'Q6-8H',
    maxDose: 400,
    maxDailyDose: 1200,
    route: 'PO',
    minAge: 6,
  },
  acetaminophen: {
    name: 'Acetaminophen',
    dosePerKg: 15,
    unit: 'mg',
    frequency: 'Q4-6H',
    maxDose: 1000,
    maxDailyDose: 4000,
    route: 'PO',
    hepaticAdjustment: {
      mild: 0.75,
      moderate: 0.5,
      severe: 0.25,
    },
  },
  azithromycin: {
    name: 'Azithromycin',
    dosePerKg: 10,
    unit: 'mg',
    frequency: 'QD',
    maxDose: 500,
    maxDailyDose: 500,
    route: 'PO',
    indications: {
      otitis_media: { dosePerKg: 10, frequency: 'QD x 3 days' },
      pneumonia: { dosePerKg: 10, frequency: 'QD x 5 days' },
    },
  },
  ceftriaxone: {
    name: 'Ceftriaxone',
    dosePerKg: 50,
    unit: 'mg',
    frequency: 'QD',
    maxDose: 2000,
    maxDailyDose: 4000,
    route: 'IV/IM',
    indications: {
      meningitis: { dosePerKg: 100, frequency: 'Q12H' },
      severe_infection: { dosePerKg: 75, frequency: 'QD' },
    },
  },
  prednisolone: {
    name: 'Prednisolone',
    dosePerKg: 1,
    unit: 'mg',
    frequency: 'QD',
    maxDose: 60,
    maxDailyDose: 60,
    route: 'PO',
    indications: {
      asthma_acute: { dosePerKg: 2, frequency: 'QD x 5 days' },
      croup: { dosePerKg: 1, frequency: 'single dose' },
    },
  },
  salbutamol: {
    name: 'Salbutamol (Albuterol)',
    dosePerKg: 0.15,
    unit: 'mg',
    frequency: 'Q4-6H PRN',
    maxDose: 2.5,
    maxDailyDose: 15,
    route: 'NEB',
  },
  ondansetron: {
    name: 'Ondansetron',
    dosePerKg: 0.15,
    unit: 'mg',
    frequency: 'Q8H PRN',
    maxDose: 8,
    maxDailyDose: 24,
    route: 'PO/IV',
    minAge: 6,
  },
  'amoxicillin-clavulanate': {
    name: 'Amoxicillin-Clavulanate',
    dosePerKg: 25,
    unit: 'mg',
    frequency: 'BID',
    maxDose: 875,
    maxDailyDose: 1750,
    route: 'PO',
    indications: {
      otitis_media: { dosePerKg: 45, frequency: 'BID' },
      sinusitis: { dosePerKg: 45, frequency: 'BID' },
    },
  },
  metronidazole: {
    name: 'Metronidazole',
    dosePerKg: 7.5,
    unit: 'mg',
    frequency: 'TID',
    maxDose: 500,
    maxDailyDose: 1500,
    route: 'PO/IV',
  },
};

export function calculatePediatricDose(input: DosageInput): DosageResult | null {
  const drug = PEDIATRIC_DRUGS[input.drugCode.toLowerCase()];

  if (!drug) {
    return null;
  }

  const warnings: string[] = [];
  const adjustments: string[] = [];
  let dosePerKg = drug.dosePerKg;
  let frequency = drug.frequency;

  if (input.indication && drug.indications?.[input.indication]) {
    const indicationDosing = drug.indications[input.indication];
    dosePerKg = indicationDosing.dosePerKg;
    frequency = indicationDosing.frequency;
    adjustments.push(`Dose adjusted for indication: ${input.indication}`);
  }

  const ageInMonths = input.patientAge * 12 + (input.patientAgeMonths || 0);
  if (drug.minAge && ageInMonths < drug.minAge) {
    warnings.push(
      `[WARN] Patient age (${ageInMonths} months) is below minimum age (${drug.minAge} months) for this medication`
    );
  }
  if (drug.maxAge && input.patientAge > drug.maxAge) {
    warnings.push(`[WARN] Patient age exceeds typical pediatric dosing range`);
  }

  let calculatedDose = dosePerKg * input.patientWeight;

  if (input.renalFunction && input.renalFunction !== 'normal' && drug.renalAdjustment) {
    const factor = drug.renalAdjustment[input.renalFunction];
    if (factor) {
      calculatedDose *= factor;
      adjustments.push(`Renal adjustment (${input.renalFunction}): ${factor * 100}%`);
    }
  }

  if (input.hepaticFunction && input.hepaticFunction !== 'normal' && drug.hepaticAdjustment) {
    const factor = drug.hepaticAdjustment[input.hepaticFunction];
    if (factor) {
      calculatedDose *= factor;
      adjustments.push(`Hepatic adjustment (${input.hepaticFunction}): ${factor * 100}%`);
    }
  }

  if (calculatedDose > drug.maxDose) {
    warnings.push(
      `Calculated dose (${calculatedDose.toFixed(1)} ${drug.unit}) exceeds max single dose. Capped at ${drug.maxDose} ${drug.unit}`
    );
    calculatedDose = drug.maxDose;
  }

  calculatedDose = Math.round(calculatedDose / 5) * 5;

  return {
    recommendedDose: calculatedDose,
    unit: drug.unit,
    frequency,
    maxDailyDose: drug.maxDailyDose,
    route: drug.route,
    warnings,
    adjustments,
    calculationMethod: `${dosePerKg} ${drug.unit}/kg × ${input.patientWeight} kg`,
  };
}

export function getDrugInfo(drugCode: string) {
  return PEDIATRIC_DRUGS[drugCode.toLowerCase()] || null;
}

export function listAvailableDrugs() {
  return Object.entries(PEDIATRIC_DRUGS).map(([code, drug]) => ({
    code,
    name: drug.name,
    route: drug.route,
  }));
}
