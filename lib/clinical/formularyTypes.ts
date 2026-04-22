/**
 * Saudi MOH Drug Formulary — Type Definitions
 */

export interface DrugForm {
  form: string;        // tablet, capsule, injection, syrup, etc.
  strength: string;    // "500mg", "250mg/5ml"
  unitPrice: number;
  inStock: boolean;
}

export interface DrugInteraction {
  interactsWith: string;  // generic name
  severity: 'major' | 'moderate' | 'minor';
  mechanism: string;
  clinicalEffect: string;
  clinicalEffectAr: string;
  management: string;
  managementAr: string;
}

export interface FormularyDrug {
  id: string;
  genericName: string;
  genericNameAr: string;
  brandNames: string[];
  sfda_registration: string;
  atcCode: string;
  atcCategory: string;
  therapeuticClass: string;
  therapeuticClassAr: string;
  formularyStatus: 'formulary' | 'non_formulary' | 'restricted' | 'conditional';
  restrictionCriteria?: string;
  restrictionCriteriaAr?: string;
  approverRole?: string;
  route: string[];
  forms: DrugForm[];
  maxDailyDose?: number;
  maxDailyDoseUnit?: string;
  renalAdjustment: boolean;
  hepaticAdjustment: boolean;
  pregnancyCategory: string;
  lactationSafe: boolean;
  pediatricApproved: boolean;
  geriatricCaution: boolean;
  highAlertMedication: boolean;
  controlledSubstance: boolean;
  controlSchedule?: string;
  lookAlikeSoundAlike: string[];
  blackBoxWarning?: string;
  blackBoxWarningAr?: string;
  interactions: DrugInteraction[];
  contraindications: string[];
  contraindicationsAr: string[];
  monitoringRequired: string[];
  storageConditions: string;
}

export interface FormularySearchFilters {
  query?: string;
  therapeuticClass?: string;
  formularyStatus?: string;
  atcCode?: string;
  highAlert?: boolean;
  controlled?: boolean;
  pregnancyCategory?: string;
  route?: string;
}

export interface FormularyStats {
  totalDrugs: number;
  byStatus: Record<string, number>;
  byTherapeuticClass: Record<string, number>;
  highAlertCount: number;
  controlledCount: number;
  restrictedCount: number;
  byPregnancyCategory: Record<string, number>;
}
