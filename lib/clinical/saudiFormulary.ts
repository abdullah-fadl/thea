/**
 * Saudi MOH Drug Formulary Engine
 * Core functions for formulary search, interaction checking, and safety alerts
 */

import type { FormularyDrug, FormularySearchFilters, FormularyStats, DrugInteraction } from './formularyTypes';
// Part 1: Antibiotics & Cardiovascular (27 drugs)
import { ANTIBIOTICS, CARDIOVASCULAR } from './formularyData';
// Part 2: Diabetes, Analgesics, GI, Respiratory, Psychiatric, Others (52 drugs)
import { DIABETES, ANALGESICS, GI, RESPIRATORY, PSYCHIATRIC, OTHERS } from './formularyDataPart2';
// Part 3: Anticoagulants, Antihypertensives Ext, Antiplatelets, Lipid Lowering (53 drugs)
import { ANTICOAGULANTS, ANTIHYPERTENSIVES_EXT, ANTIPLATELETS, LIPID_LOWERING } from './formularyDataPart3';
// Part 4: Dermatology, Ophthalmology, ENT, Urology, Endocrine (50 drugs)
import { DERMATOLOGY, OPHTHALMOLOGY, ENT_DRUGS, UROLOGY, ENDOCRINE } from './formularyDataPart4';
// Part 5: Anesthesia, Emergency, Oncology, Immunosuppressants (55 drugs)
import { ANESTHESIA, EMERGENCY, ONCOLOGY_DRUGS, IMMUNOSUPPRESSANTS } from './formularyDataPart5';
// Part 6: Antifungals, Antivirals, Anti-TB, Antiparasitics (40 drugs)
import { ANTIFUNGALS, ANTIVIRALS, ANTI_TB, ANTIPARASITICS } from './formularyDataPart6';
// Part 7: Neurology, Anti-epileptics, Rheumatology, Vaccines, Supplements (72 drugs)
import { NEUROLOGY, ANTI_EPILEPTICS, RHEUMATOLOGY, VACCINES, SUPPLEMENTS_ELECTROLYTES } from './formularyDataPart7';
// Part 8: Antibiotics Ext, Diabetes Ext, Pain, Cardiac Adv, Respiratory Ext (80 drugs)
import { ANTIBIOTICS_EXTENDED, DIABETES_EXTENDED, PAIN_MANAGEMENT, CARDIAC_ADVANCED, RESPIRATORY_EXTENDED } from './formularyDataPart8';
// Part 9: GI Ext, Hematology, Psychiatric Ext, Musculoskeletal, Hospital Misc (42 drugs)
import { GI_EXTENDED, HEMATOLOGY, PSYCHIATRIC_EXTENDED, MUSCULOSKELETAL, HOSPITAL_MISCELLANEOUS } from './formularyDataPart9';
// Part 10: Biologics & Targeted Therapies (40 drugs)
import { BIOLOGICS_TARGETED } from './formularyDataPart10';
// Part 11: Hormonal & Reproductive (40 drugs)
import { HORMONAL_REPRODUCTIVE } from './formularyDataPart11';
// Part 12: Diagnostic Agents & Antidotes (40 drugs)
import { DIAGNOSTIC_ANTIDOTES } from './formularyDataPart12';
// Part 13: IV Fluids, TPN & Electrolytes (40 drugs)
import { IV_FLUIDS_ELECTROLYTES } from './formularyDataPart13';
// Part 14: Vaccines & Immunoglobulins (40 drugs)
import { VACCINES_IMMUNOGLOBULINS } from './formularyDataPart14';
// Part 15: Topical & Local Preparations (40 drugs)
import { TOPICAL_LOCAL } from './formularyDataPart15';
// Part 16: Corticosteroids, Antihistamines, Vitamins, Muscle Relaxants, Laxatives (40 drugs)
import { CORTICOSTEROIDS, ANTIHISTAMINES, VITAMINS_MINERALS, MUSCLE_RELAXANTS_GOUT, LAXATIVES_GI } from './formularyDataPart16';
// Part 17: Sedatives, Antidotes, Ophthalmic, Dermatologic, Miscellaneous (30 drugs)
import { SEDATIVES_ANXIOLYTICS, ANTIDOTES_EMERGENCY, OPHTHALMIC_DERMATOLOGIC, MISCELLANEOUS_ESSENTIAL } from './formularyDataPart17';
// Part 18: Critical Care Essential (20 drugs)
import { CRITICAL_CARE_ESSENTIAL } from './formularyDataPart18';

// Re-export types for convenience
export type { FormularyDrug, FormularySearchFilters, FormularyStats, DrugForm, DrugInteraction } from './formularyTypes';

// ─── Built-in drug database (801 drugs) ─────────────────────────────────────

const ALL_DRUGS: FormularyDrug[] = [
  // Part 1
  ...ANTIBIOTICS,
  ...CARDIOVASCULAR,
  // Part 2
  ...DIABETES,
  ...ANALGESICS,
  ...GI,
  ...RESPIRATORY,
  ...PSYCHIATRIC,
  ...OTHERS,
  // Part 3
  ...ANTICOAGULANTS,
  ...ANTIHYPERTENSIVES_EXT,
  ...ANTIPLATELETS,
  ...LIPID_LOWERING,
  // Part 4
  ...DERMATOLOGY,
  ...OPHTHALMOLOGY,
  ...ENT_DRUGS,
  ...UROLOGY,
  ...ENDOCRINE,
  // Part 5
  ...ANESTHESIA,
  ...EMERGENCY,
  ...ONCOLOGY_DRUGS,
  ...IMMUNOSUPPRESSANTS,
  // Part 6
  ...ANTIFUNGALS,
  ...ANTIVIRALS,
  ...ANTI_TB,
  ...ANTIPARASITICS,
  // Part 7
  ...NEUROLOGY,
  ...ANTI_EPILEPTICS,
  ...RHEUMATOLOGY,
  ...VACCINES,
  ...SUPPLEMENTS_ELECTROLYTES,
  // Part 8
  ...ANTIBIOTICS_EXTENDED,
  ...DIABETES_EXTENDED,
  ...PAIN_MANAGEMENT,
  ...CARDIAC_ADVANCED,
  ...RESPIRATORY_EXTENDED,
  // Part 9
  ...GI_EXTENDED,
  ...HEMATOLOGY,
  ...PSYCHIATRIC_EXTENDED,
  ...MUSCULOSKELETAL,
  ...HOSPITAL_MISCELLANEOUS,
  // Part 10
  ...BIOLOGICS_TARGETED,
  // Part 11
  ...HORMONAL_REPRODUCTIVE,
  // Part 12
  ...DIAGNOSTIC_ANTIDOTES,
  // Part 13
  ...IV_FLUIDS_ELECTROLYTES,
  // Part 14
  ...VACCINES_IMMUNOGLOBULINS,
  // Part 15
  ...TOPICAL_LOCAL,
  // Part 16
  ...CORTICOSTEROIDS,
  ...ANTIHISTAMINES,
  ...VITAMINS_MINERALS,
  ...MUSCLE_RELAXANTS_GOUT,
  ...LAXATIVES_GI,
  // Part 17
  ...SEDATIVES_ANXIOLYTICS,
  ...ANTIDOTES_EMERGENCY,
  ...OPHTHALMIC_DERMATOLOGIC,
  ...MISCELLANEOUS_ESSENTIAL,
  // Part 18
  ...CRITICAL_CARE_ESSENTIAL,
];

/**
 * Returns the full built-in formulary dataset (801 drugs).
 * Used for seeding and as a fallback when DB is empty.
 */
export function getBuiltInFormulary(): FormularyDrug[] {
  return ALL_DRUGS;
}

// ─── Search & Filter ─────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Search the formulary by query and filters.
 * Searches generic name (EN + AR), brand names, ATC code, and therapeutic class.
 */
export function searchFormulary(
  drugs: FormularyDrug[],
  filters: FormularySearchFilters
): FormularyDrug[] {
  let results = [...drugs];

  if (filters.query) {
    const q = normalize(filters.query);
    results = results.filter((d) =>
      normalize(d.genericName).includes(q) ||
      normalize(d.genericNameAr).includes(q) ||
      d.brandNames.some((b) => normalize(b).includes(q)) ||
      (d.atcCode && normalize(d.atcCode).includes(q)) ||
      normalize(d.therapeuticClass).includes(q) ||
      normalize(d.therapeuticClassAr).includes(q)
    );
  }

  if (filters.therapeuticClass) {
    const tc = normalize(filters.therapeuticClass);
    results = results.filter(
      (d) => normalize(d.therapeuticClass) === tc || normalize(d.therapeuticClassAr) === tc
    );
  }

  if (filters.formularyStatus) {
    results = results.filter((d) => d.formularyStatus === filters.formularyStatus);
  }

  if (filters.atcCode) {
    const code = normalize(filters.atcCode);
    results = results.filter((d) => d.atcCode && normalize(d.atcCode).startsWith(code));
  }

  if (filters.highAlert === true) {
    results = results.filter((d) => d.highAlertMedication);
  }

  if (filters.controlled === true) {
    results = results.filter((d) => d.controlledSubstance);
  }

  if (filters.pregnancyCategory) {
    results = results.filter((d) => d.pregnancyCategory === filters.pregnancyCategory.toUpperCase());
  }

  if (filters.route) {
    const r = normalize(filters.route);
    results = results.filter((d) => d.route.some((rt) => normalize(rt) === r));
  }

  return results;
}

// ─── Formulary Status Check ──────────────────────────────────────────────────

export interface FormularyStatusResult {
  drug: FormularyDrug;
  isFormulary: boolean;
  isRestricted: boolean;
  requiresApproval: boolean;
  restrictionCriteria?: string;
  restrictionCriteriaAr?: string;
  approverRole?: string;
}

/**
 * Check formulary status of a drug by ID.
 */
export function checkFormularyStatus(drugs: FormularyDrug[], drugId: string): FormularyStatusResult | null {
  const drug = drugs.find((d) => d.id === drugId);
  if (!drug) return null;

  return {
    drug,
    isFormulary: drug.formularyStatus === 'formulary',
    isRestricted: drug.formularyStatus === 'restricted' || drug.formularyStatus === 'conditional',
    requiresApproval: drug.formularyStatus === 'restricted' || drug.formularyStatus === 'conditional',
    restrictionCriteria: drug.restrictionCriteria,
    restrictionCriteriaAr: drug.restrictionCriteriaAr,
    approverRole: drug.approverRole,
  };
}

// ─── Drug Interaction Checker ────────────────────────────────────────────────

export interface InteractionCheckResult {
  hasInteractions: boolean;
  hasMajor: boolean;
  interactions: Array<{
    drug1: string;
    drug1Ar: string;
    drug2: string;
    drug2Ar: string;
    severity: 'major' | 'moderate' | 'minor';
    mechanism: string;
    clinicalEffect: string;
    clinicalEffectAr: string;
    management: string;
    managementAr: string;
  }>;
}

/**
 * Check interactions between multiple drugs.
 * Performs pairwise comparison using the built-in interaction database.
 */
export function checkDrugInteractions(drugs: FormularyDrug[], drugIds: string[]): InteractionCheckResult {
  const selectedDrugs = drugIds
    .map((id) => drugs.find((d) => d.id === id))
    .filter(Boolean) as FormularyDrug[];

  const interactions: InteractionCheckResult['interactions'] = [];

  for (let i = 0; i < selectedDrugs.length; i++) {
    for (let j = i + 1; j < selectedDrugs.length; j++) {
      const drug1 = selectedDrugs[i];
      const drug2 = selectedDrugs[j];

      // Check drug1's interactions for drug2
      for (const int of drug1.interactions) {
        if (normalize(int.interactsWith) === normalize(drug2.genericName) ||
            drug2.brandNames.some((b) => normalize(b) === normalize(int.interactsWith))) {
          interactions.push({
            drug1: drug1.genericName,
            drug1Ar: drug1.genericNameAr,
            drug2: drug2.genericName,
            drug2Ar: drug2.genericNameAr,
            severity: int.severity,
            mechanism: int.mechanism,
            clinicalEffect: int.clinicalEffect,
            clinicalEffectAr: int.clinicalEffectAr,
            management: int.management,
            managementAr: int.managementAr,
          });
        }
      }

      // Check drug2's interactions for drug1 (bidirectional)
      for (const int of drug2.interactions) {
        if (normalize(int.interactsWith) === normalize(drug1.genericName) ||
            drug1.brandNames.some((b) => normalize(b) === normalize(int.interactsWith))) {
          // Avoid duplicate — check if we already found this pair
          const dup = interactions.find(
            (x) =>
              (normalize(x.drug1) === normalize(drug2.genericName) && normalize(x.drug2) === normalize(drug1.genericName)) ||
              (normalize(x.drug1) === normalize(drug1.genericName) && normalize(x.drug2) === normalize(drug2.genericName))
          );
          if (!dup) {
            interactions.push({
              drug1: drug2.genericName,
              drug1Ar: drug2.genericNameAr,
              drug2: drug1.genericName,
              drug2Ar: drug1.genericNameAr,
              severity: int.severity,
              mechanism: int.mechanism,
              clinicalEffect: int.clinicalEffect,
              clinicalEffectAr: int.clinicalEffectAr,
              management: int.management,
              managementAr: int.managementAr,
            });
          }
        }
      }
    }
  }

  // Sort by severity: major first
  const order: Record<string, number> = { major: 0, moderate: 1, minor: 2 };
  interactions.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));

  return {
    hasInteractions: interactions.length > 0,
    hasMajor: interactions.some((i) => i.severity === 'major'),
    interactions,
  };
}

// ─── LASA (Look-Alike, Sound-Alike) ──────────────────────────────────────────

export interface LASAPair {
  drugName: string;
  drugNameAr: string;
  pairs: string[];
}

/**
 * Get LASA pairs for a drug by name.
 */
export function getLASAPairs(drugs: FormularyDrug[], drugName: string): LASAPair | null {
  const drug = drugs.find(
    (d) => normalize(d.genericName) === normalize(drugName) ||
           d.brandNames.some((b) => normalize(b) === normalize(drugName))
  );
  if (!drug || drug.lookAlikeSoundAlike.length === 0) return null;

  return {
    drugName: drug.genericName,
    drugNameAr: drug.genericNameAr,
    pairs: drug.lookAlikeSoundAlike,
  };
}

/**
 * Get all LASA pairs in the formulary.
 */
export function getAllLASAPairs(drugs: FormularyDrug[]): LASAPair[] {
  return drugs
    .filter((d) => d.lookAlikeSoundAlike.length > 0)
    .map((d) => ({
      drugName: d.genericName,
      drugNameAr: d.genericNameAr,
      pairs: d.lookAlikeSoundAlike,
    }));
}

// ─── High-Alert & Controlled ─────────────────────────────────────────────────

/**
 * Get all high-alert medications.
 */
export function getHighAlertMedications(drugs: FormularyDrug[]): FormularyDrug[] {
  return drugs.filter((d) => d.highAlertMedication);
}

/**
 * Get all controlled substances.
 */
export function getControlledSubstances(drugs: FormularyDrug[]): FormularyDrug[] {
  return drugs.filter((d) => d.controlledSubstance);
}

// ─── Pregnancy Safety ────────────────────────────────────────────────────────

export interface PregnancySafetyResult {
  drugName: string;
  drugNameAr: string;
  pregnancyCategory: string;
  isSafe: boolean;
  lactationSafe: boolean;
  warning?: string;
  warningAr?: string;
}

/**
 * Check pregnancy safety of a drug.
 */
export function checkPregnancySafety(drugs: FormularyDrug[], drugId: string): PregnancySafetyResult | null {
  const drug = drugs.find((d) => d.id === drugId);
  if (!drug) return null;

  const dangerousCategories = new Set(['D', 'X']);
  const isSafe = !dangerousCategories.has(drug.pregnancyCategory);

  let warning: string | undefined;
  let warningAr: string | undefined;

  if (drug.pregnancyCategory === 'X') {
    warning = 'CONTRAINDICATED in pregnancy. Evidence of fetal abnormalities and/or risk clearly outweighs benefits.';
    warningAr = 'ممنوع في الحمل. دليل على تشوهات جنينية و/أو الخطر يفوق الفائدة بوضوح.';
  } else if (drug.pregnancyCategory === 'D') {
    warning = 'Positive evidence of fetal risk. Use only if benefits outweigh risks and no safer alternatives exist.';
    warningAr = 'دليل إيجابي على خطر جنيني. يُستخدم فقط إذا كانت الفائدة تفوق المخاطر ولا توجد بدائل أكثر أماناً.';
  } else if (drug.pregnancyCategory === 'C') {
    warning = 'Animal studies show adverse effects. No adequate human studies. Use only if potential benefit justifies potential risk.';
    warningAr = 'الدراسات الحيوانية تظهر تأثيرات سلبية. لا توجد دراسات بشرية كافية. يُستخدم فقط إذا كانت الفائدة تبرر المخاطر.';
  }

  return {
    drugName: drug.genericName,
    drugNameAr: drug.genericNameAr,
    pregnancyCategory: drug.pregnancyCategory,
    isSafe,
    lactationSafe: drug.lactationSafe,
    warning,
    warningAr,
  };
}

// ─── Statistics ──────────────────────────────────────────────────────────────

/**
 * Get formulary statistics.
 */
export function getFormularyStats(drugs: FormularyDrug[]): FormularyStats {
  const byStatus: Record<string, number> = {};
  const byClass: Record<string, number> = {};
  const byPreg: Record<string, number> = {};

  for (const d of drugs) {
    byStatus[d.formularyStatus] = (byStatus[d.formularyStatus] || 0) + 1;
    byClass[d.therapeuticClass] = (byClass[d.therapeuticClass] || 0) + 1;
    byPreg[d.pregnancyCategory] = (byPreg[d.pregnancyCategory] || 0) + 1;
  }

  return {
    totalDrugs: drugs.length,
    byStatus,
    byTherapeuticClass: byClass,
    highAlertCount: drugs.filter((d) => d.highAlertMedication).length,
    controlledCount: drugs.filter((d) => d.controlledSubstance).length,
    restrictedCount: drugs.filter((d) => d.formularyStatus === 'restricted').length,
    byPregnancyCategory: byPreg,
  };
}

/**
 * Get all unique therapeutic classes.
 */
export function getTherapeuticClasses(drugs: FormularyDrug[]): Array<{ en: string; ar: string }> {
  const seen = new Set<string>();
  const result: Array<{ en: string; ar: string }> = [];
  for (const d of drugs) {
    if (!seen.has(d.therapeuticClass)) {
      seen.add(d.therapeuticClass);
      result.push({ en: d.therapeuticClass, ar: d.therapeuticClassAr });
    }
  }
  return result;
}
