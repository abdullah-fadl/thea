/**
 * Nursing Care Plan (NCP)
 * Structured NANDA-I / NIC / NOC–based nursing care plans.
 * Supports: Nursing Diagnosis → Goals → Interventions → Evaluation cycle.
 */

export type NCPStatus = 'ACTIVE' | 'RESOLVED' | 'REVISED' | 'DISCONTINUED';
export type GoalStatus = 'NOT_MET' | 'PARTIALLY_MET' | 'MET';
export type NCPPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface NCPIntervention {
  id: string;
  description: string;
  frequency: string;
  completed: boolean;
  completedAt?: string;
}

export interface NCPGoal {
  id: string;
  description: string;
  targetDate: string;
  status: GoalStatus;
  evaluation: string;
}

export interface CarePlanEntry {
  id: string;
  status: NCPStatus;
  priority: NCPPriority;
  nursingDiagnosis: string;
  relatedTo: string;
  evidencedBy: string;
  goals: NCPGoal[];
  interventions: NCPIntervention[];
  evaluation: string;
  createdAt: string;
  updatedAt: string;
}

export interface CarePlanData {
  plans: CarePlanEntry[];
}

export const DEFAULT_CARE_PLAN: CarePlanData = { plans: [] };

export const COMMON_DIAGNOSES: { labelAr: string; labelEn: string }[] = [
  { labelAr: 'ألم حاد', labelEn: 'Acute Pain' },
  { labelAr: 'خطر السقوط', labelEn: 'Risk for Falls' },
  { labelAr: 'خطر العدوى', labelEn: 'Risk for Infection' },
  { labelAr: 'ضعف سلامة الجلد', labelEn: 'Impaired Skin Integrity' },
  { labelAr: 'قصور في التغذية', labelEn: 'Imbalanced Nutrition' },
  { labelAr: 'قلق', labelEn: 'Anxiety' },
  { labelAr: 'ضعف تبادل الغازات', labelEn: 'Impaired Gas Exchange' },
  { labelAr: 'خطر نقص حجم السوائل', labelEn: 'Risk for Fluid Volume Deficit' },
  { labelAr: 'ضعف الحركة الجسدية', labelEn: 'Impaired Physical Mobility' },
  { labelAr: 'عدم فعالية تنظيف مجرى الهواء', labelEn: 'Ineffective Airway Clearance' },
  { labelAr: 'ارتفاع الحرارة', labelEn: 'Hyperthermia' },
  { labelAr: 'قصور في المعرفة', labelEn: 'Deficient Knowledge' },
  { labelAr: 'اضطراب نمط النوم', labelEn: 'Disturbed Sleep Pattern' },
  { labelAr: 'خطر قرح الضغط', labelEn: 'Risk for Pressure Injury' },
];

export function createEmptyPlan(): CarePlanEntry {
  return {
    id: `ncp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    status: 'ACTIVE',
    priority: 'MEDIUM',
    nursingDiagnosis: '',
    relatedTo: '',
    evidencedBy: '',
    goals: [],
    interventions: [],
    evaluation: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
