/**
 * Drug Interaction Checker for Thea EHR
 *
 * Provides a lookup table of known drug-drug interaction pairs and a
 * function to check for interactions between medications.
 *
 * In production this would be backed by a comprehensive drug database
 * (e.g. RxNorm, First Databank). This implementation covers the most
 * clinically significant pairs so the workflow is functional out of the box.
 */

export type InteractionSeverity = 'critical' | 'major' | 'minor' | 'none';

export interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: InteractionSeverity;
  description: { ar: string; en: string };
  recommendation: { ar: string; en: string };
}

// ---------------------------------------------------------------------------
// Known interaction pairs (normalised to lowercase)
// ---------------------------------------------------------------------------

const INTERACTION_TABLE: DrugInteraction[] = [
  // Anticoagulants + NSAIDs
  {
    drug1: 'warfarin',
    drug2: 'aspirin',
    severity: 'critical',
    description: {
      ar: 'زيادة خطر النزيف عند استخدام وارفارين مع أسبرين',
      en: 'Increased bleeding risk when warfarin is combined with aspirin',
    },
    recommendation: {
      ar: 'تجنب الاستخدام المتزامن إلا بإشراف طبي مباشر',
      en: 'Avoid concurrent use unless under direct medical supervision',
    },
  },
  {
    drug1: 'warfarin',
    drug2: 'ibuprofen',
    severity: 'critical',
    description: {
      ar: 'زيادة خطر النزيف الهضمي',
      en: 'Increased risk of gastrointestinal bleeding',
    },
    recommendation: {
      ar: 'استخدم بديل آمن مثل أسيتامينوفين',
      en: 'Use safer alternative such as acetaminophen',
    },
  },
  {
    drug1: 'warfarin',
    drug2: 'naproxen',
    severity: 'critical',
    description: {
      ar: 'زيادة خطر النزيف الهضمي',
      en: 'Increased risk of gastrointestinal bleeding',
    },
    recommendation: {
      ar: 'تجنب الاستخدام المتزامن',
      en: 'Avoid concurrent use',
    },
  },

  // ACE inhibitors + Potassium-sparing diuretics
  {
    drug1: 'lisinopril',
    drug2: 'spironolactone',
    severity: 'major',
    description: {
      ar: 'خطر ارتفاع البوتاسيوم في الدم',
      en: 'Risk of hyperkalemia',
    },
    recommendation: {
      ar: 'مراقبة مستوى البوتاسيوم بانتظام',
      en: 'Monitor potassium levels regularly',
    },
  },
  {
    drug1: 'enalapril',
    drug2: 'spironolactone',
    severity: 'major',
    description: {
      ar: 'خطر ارتفاع البوتاسيوم في الدم',
      en: 'Risk of hyperkalemia',
    },
    recommendation: {
      ar: 'مراقبة مستوى البوتاسيوم بانتظام',
      en: 'Monitor potassium levels regularly',
    },
  },

  // Metformin + Contrast dye (iodinated)
  {
    drug1: 'metformin',
    drug2: 'iodinated contrast',
    severity: 'major',
    description: {
      ar: 'خطر الحماض اللاكتيكي',
      en: 'Risk of lactic acidosis',
    },
    recommendation: {
      ar: 'أوقف ميتفورمين 48 ساعة قبل وبعد التصوير',
      en: 'Withhold metformin 48 hours before and after imaging',
    },
  },

  // Statins + Macrolide antibiotics
  {
    drug1: 'simvastatin',
    drug2: 'erythromycin',
    severity: 'major',
    description: {
      ar: 'زيادة خطر تحلل العضلات',
      en: 'Increased risk of rhabdomyolysis',
    },
    recommendation: {
      ar: 'استخدم بديل للمضاد الحيوي أو أوقف الستاتين مؤقتاً',
      en: 'Use alternative antibiotic or temporarily suspend statin',
    },
  },
  {
    drug1: 'simvastatin',
    drug2: 'clarithromycin',
    severity: 'major',
    description: {
      ar: 'زيادة خطر تحلل العضلات',
      en: 'Increased risk of rhabdomyolysis',
    },
    recommendation: {
      ar: 'استخدم بديل للمضاد الحيوي أو أوقف الستاتين مؤقتاً',
      en: 'Use alternative antibiotic or temporarily suspend statin',
    },
  },
  {
    drug1: 'atorvastatin',
    drug2: 'clarithromycin',
    severity: 'major',
    description: {
      ar: 'زيادة مستوى الستاتين في الدم',
      en: 'Increased statin blood levels',
    },
    recommendation: {
      ar: 'قلل جرعة الستاتين أو استخدم مضاد حيوي بديل',
      en: 'Reduce statin dose or use alternative antibiotic',
    },
  },

  // SSRIs + MAOIs
  {
    drug1: 'fluoxetine',
    drug2: 'phenelzine',
    severity: 'critical',
    description: {
      ar: 'خطر متلازمة السيروتونين - قد تكون مميتة',
      en: 'Risk of serotonin syndrome - potentially fatal',
    },
    recommendation: {
      ar: 'ممنوع الاستخدام المتزامن - فاصل 14 يوم على الأقل',
      en: 'Contraindicated - minimum 14-day washout period',
    },
  },
  {
    drug1: 'sertraline',
    drug2: 'phenelzine',
    severity: 'critical',
    description: {
      ar: 'خطر متلازمة السيروتونين - قد تكون مميتة',
      en: 'Risk of serotonin syndrome - potentially fatal',
    },
    recommendation: {
      ar: 'ممنوع الاستخدام المتزامن',
      en: 'Contraindicated - do not combine',
    },
  },

  // Digoxin + Amiodarone
  {
    drug1: 'digoxin',
    drug2: 'amiodarone',
    severity: 'major',
    description: {
      ar: 'زيادة تركيز الديجوكسين في الدم',
      en: 'Increased digoxin blood concentration',
    },
    recommendation: {
      ar: 'قلل جرعة الديجوكسين بنسبة 50% وراقب المستوى',
      en: 'Reduce digoxin dose by 50% and monitor levels',
    },
  },

  // Ciprofloxacin + Theophylline
  {
    drug1: 'ciprofloxacin',
    drug2: 'theophylline',
    severity: 'major',
    description: {
      ar: 'زيادة تركيز الثيوفيلين وخطر التسمم',
      en: 'Increased theophylline levels with toxicity risk',
    },
    recommendation: {
      ar: 'راقب مستوى الثيوفيلين وقلل الجرعة',
      en: 'Monitor theophylline levels and reduce dose',
    },
  },

  // Methotrexate + NSAIDs
  {
    drug1: 'methotrexate',
    drug2: 'ibuprofen',
    severity: 'critical',
    description: {
      ar: 'زيادة سمية الميثوتريكسات بسبب انخفاض التصفية الكلوية',
      en: 'Increased methotrexate toxicity due to reduced renal clearance',
    },
    recommendation: {
      ar: 'تجنب مضادات الالتهاب مع الميثوتريكسات',
      en: 'Avoid NSAIDs with methotrexate',
    },
  },

  // Clopidogrel + Omeprazole
  {
    drug1: 'clopidogrel',
    drug2: 'omeprazole',
    severity: 'major',
    description: {
      ar: 'انخفاض فعالية كلوبيدوغريل',
      en: 'Reduced clopidogrel effectiveness',
    },
    recommendation: {
      ar: 'استخدم بانتوبرازول بدلاً من أوميبرازول',
      en: 'Use pantoprazole instead of omeprazole',
    },
  },

  // Potassium supplements + ACE inhibitors
  {
    drug1: 'potassium chloride',
    drug2: 'lisinopril',
    severity: 'major',
    description: {
      ar: 'خطر ارتفاع البوتاسيوم',
      en: 'Risk of hyperkalemia',
    },
    recommendation: {
      ar: 'مراقبة البوتاسيوم في الدم بشكل دوري',
      en: 'Monitor serum potassium periodically',
    },
  },

  // Minor interactions
  {
    drug1: 'amoxicillin',
    drug2: 'oral contraceptive',
    severity: 'minor',
    description: {
      ar: 'احتمال انخفاض فعالية موانع الحمل',
      en: 'Possible reduced oral contraceptive effectiveness',
    },
    recommendation: {
      ar: 'استخدمي وسيلة إضافية خلال فترة المضاد الحيوي',
      en: 'Use additional contraception during antibiotic course',
    },
  },
  {
    drug1: 'calcium carbonate',
    drug2: 'levothyroxine',
    severity: 'minor',
    description: {
      ar: 'الكالسيوم يقلل امتصاص الليفوثيروكسين',
      en: 'Calcium reduces levothyroxine absorption',
    },
    recommendation: {
      ar: 'فصل 4 ساعات على الأقل بين الجرعتين',
      en: 'Separate doses by at least 4 hours',
    },
  },
  {
    drug1: 'iron',
    drug2: 'levothyroxine',
    severity: 'minor',
    description: {
      ar: 'الحديد يقلل امتصاص الليفوثيروكسين',
      en: 'Iron reduces levothyroxine absorption',
    },
    recommendation: {
      ar: 'فصل 4 ساعات على الأقل بين الجرعتين',
      en: 'Separate doses by at least 4 hours',
    },
  },
];

// ---------------------------------------------------------------------------
// Normalised lookup index (built once)
// ---------------------------------------------------------------------------

function normalise(name: string): string {
  return String(name || '').trim().toLowerCase();
}

function pairKey(a: string, b: string): string {
  const sorted = [normalise(a), normalise(b)].sort();
  return `${sorted[0]}::${sorted[1]}`;
}

const INDEX = new Map<string, DrugInteraction>();
for (const entry of INTERACTION_TABLE) {
  INDEX.set(pairKey(entry.drug1, entry.drug2), entry);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface InteractionCheckResult {
  hasInteraction: boolean;
  severity: InteractionSeverity;
  interaction?: DrugInteraction;
}

/**
 * Check for a known drug-drug interaction between two medications.
 */
export function checkDrugInteraction(drug1: string, drug2: string): InteractionCheckResult {
  const key = pairKey(drug1, drug2);
  const found = INDEX.get(key);
  if (!found) {
    return { hasInteraction: false, severity: 'none' };
  }
  return { hasInteraction: true, severity: found.severity, interaction: found };
}

/**
 * Check a single medication against a list of current medications.
 * Returns all found interactions.
 */
export function checkDrugInteractions(
  newDrug: string,
  currentMedications: string[]
): InteractionCheckResult[] {
  const results: InteractionCheckResult[] = [];
  for (const med of currentMedications) {
    const result = checkDrugInteraction(newDrug, med);
    if (result.hasInteraction) {
      results.push(result);
    }
  }
  // Sort by severity (critical first)
  const severityOrder: Record<InteractionSeverity, number> = {
    critical: 0,
    major: 1,
    minor: 2,
    none: 3,
  };
  results.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return results;
}
