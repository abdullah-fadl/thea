interface Medication {
  drugCode: string;
  drugName: string;
  drugClass?: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'discontinued';
}

export interface DuplicateAlert {
  type: 'exact' | 'therapeutic' | 'class';
  severity: 'high' | 'moderate';
  existingDrug: string;
  newDrug: string;
  drugClass?: string;
  message: string;
  messageAr: string;
}

const DRUG_CLASSES: Record<string, { name: string; nameAr: string; drugs: string[] }> = {
  PPI: {
    name: 'Proton Pump Inhibitors',
    nameAr: 'مثبطات مضخة البروتون',
    drugs: ['omeprazole', 'esomeprazole', 'pantoprazole', 'lansoprazole', 'rabeprazole'],
  },
  STATIN: {
    name: 'HMG-CoA Reductase Inhibitors',
    nameAr: 'الستاتينات',
    drugs: ['atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin', 'lovastatin'],
  },
  ACE: {
    name: 'ACE Inhibitors',
    nameAr: 'مثبطات ACE',
    drugs: ['lisinopril', 'enalapril', 'ramipril', 'captopril', 'benazepril'],
  },
  ARB: {
    name: 'Angiotensin Receptor Blockers',
    nameAr: 'حاصرات مستقبلات الأنجيوتنسين',
    drugs: ['losartan', 'valsartan', 'irbesartan', 'telmisartan', 'olmesartan'],
  },
  BETA_BLOCKER: {
    name: 'Beta Blockers',
    nameAr: 'حاصرات بيتا',
    drugs: ['metoprolol', 'atenolol', 'bisoprolol', 'carvedilol', 'propranolol'],
  },
  CCB: {
    name: 'Calcium Channel Blockers',
    nameAr: 'حاصرات قنوات الكالسيوم',
    drugs: ['amlodipine', 'nifedipine', 'diltiazem', 'verapamil', 'felodipine'],
  },
  SSRI: {
    name: 'SSRIs',
    nameAr: 'مثبطات استرداد السيروتونين',
    drugs: ['sertraline', 'fluoxetine', 'paroxetine', 'escitalopram', 'citalopram'],
  },
  NSAID: {
    name: 'NSAIDs',
    nameAr: 'مضادات الالتهاب',
    drugs: ['ibuprofen', 'naproxen', 'diclofenac', 'ketorolac', 'meloxicam', 'celecoxib'],
  },
  OPIOID: {
    name: 'Opioid Analgesics',
    nameAr: 'المسكنات الأفيونية',
    drugs: ['morphine', 'oxycodone', 'hydrocodone', 'tramadol', 'codeine', 'fentanyl'],
  },
  BENZODIAZEPINE: {
    name: 'Benzodiazepines',
    nameAr: 'البنزوديازيبينات',
    drugs: ['lorazepam', 'diazepam', 'alprazolam', 'clonazepam', 'midazolam'],
  },
  THIAZIDE: {
    name: 'Thiazide Diuretics',
    nameAr: 'مدرات البول الثيازيدية',
    drugs: ['hydrochlorothiazide', 'chlorthalidone', 'indapamide', 'metolazone'],
  },
  LOOP_DIURETIC: {
    name: 'Loop Diuretics',
    nameAr: 'مدرات البول العروية',
    drugs: ['furosemide', 'bumetanide', 'torsemide'],
  },
  ANTICOAGULANT: {
    name: 'Anticoagulants',
    nameAr: 'مضادات التخثر',
    drugs: ['warfarin', 'apixaban', 'rivaroxaban', 'dabigatran', 'enoxaparin', 'heparin'],
  },
  ANTIPLATELET: {
    name: 'Antiplatelet Agents',
    nameAr: 'مضادات الصفيحات',
    drugs: ['aspirin', 'clopidogrel', 'ticagrelor', 'prasugrel'],
  },
};

function normalize(str: string): string {
  return String(str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function findDrugClass(drugName: string): string | null {
  const normalized = normalize(drugName);
  for (const [classKey, classData] of Object.entries(DRUG_CLASSES)) {
    if (classData.drugs.some((d) => normalize(d) === normalized || normalized.includes(normalize(d)))) {
      return classKey;
    }
  }
  return null;
}

export function checkDuplicateTherapy(newDrug: string, activeMedications: Medication[]): DuplicateAlert[] {
  const alerts: DuplicateAlert[] = [];
  const normalizedNew = normalize(newDrug);
  const newDrugClass = findDrugClass(newDrug);

  for (const med of activeMedications) {
    if (med.status !== 'active') continue;

    const normalizedExisting = normalize(med.drugName);
    const existingClass = findDrugClass(med.drugName);

    if (normalizedNew === normalizedExisting) {
      alerts.push({
        type: 'exact',
        severity: 'high',
        existingDrug: med.drugName,
        newDrug,
        message: `EXACT DUPLICATE: ${newDrug} is already prescribed`,
        messageAr: `تكرار: ${newDrug} موصوف بالفعل`,
      });
      continue;
    }

    if (newDrugClass && existingClass && newDrugClass === existingClass) {
      const classInfo = DRUG_CLASSES[newDrugClass];
      alerts.push({
        type: 'therapeutic',
        severity: 'high',
        existingDrug: med.drugName,
        newDrug,
        drugClass: classInfo.name,
        message: `THERAPEUTIC DUPLICATE: ${newDrug} and ${med.drugName} are both ${classInfo.name}`,
        messageAr: `تكرار علاجي: ${newDrug} و ${med.drugName} من نفس الفئة (${classInfo.nameAr})`,
      });
    }
  }

  return alerts;
}
