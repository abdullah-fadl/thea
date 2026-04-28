// =============================================================================
// TPN (Total Parenteral Nutrition) Definitions & Calculation Functions
// =============================================================================

// ── Dextrose Concentrations ──────────────────────────────────────────────────

export interface DextroseConcentration {
  value: string;
  label: string;
  labelAr: string;
  kcalPerMl: number;
  pct: number;
}

export const DEXTROSE_CONCENTRATIONS: DextroseConcentration[] = [
  { value: '5',  label: 'D5W (5%)',   labelAr: 'دكستروز 5%',   kcalPerMl: 0.17,  pct: 5 },
  { value: '10', label: 'D10W (10%)', labelAr: 'دكستروز 10%',  kcalPerMl: 0.34,  pct: 10 },
  { value: '20', label: 'D20W (20%)', labelAr: 'دكستروز 20%',  kcalPerMl: 0.68,  pct: 20 },
  { value: '50', label: 'D50W (50%)', labelAr: 'دكستروز 50%',  kcalPerMl: 1.70,  pct: 50 },
  { value: '70', label: 'D70W (70%)', labelAr: 'دكستروز 70%',  kcalPerMl: 2.38,  pct: 70 },
];

// ── Amino Acid Concentrations ────────────────────────────────────────────────

export interface AminoAcidConcentration {
  value: string;
  label: string;
  labelAr: string;
  proteinPerMl: number;
  kcalPerMl: number;
}

export const AMINO_ACID_CONCENTRATIONS: AminoAcidConcentration[] = [
  { value: '8.5',  label: '8.5%',  labelAr: '8.5%', proteinPerMl: 0.085, kcalPerMl: 0.34 },
  { value: '10',   label: '10%',   labelAr: '10%',  proteinPerMl: 0.10,  kcalPerMl: 0.40 },
  { value: '15',   label: '15%',   labelAr: '15%',  proteinPerMl: 0.15,  kcalPerMl: 0.60 },
];

// ── Lipid Concentrations ─────────────────────────────────────────────────────

export interface LipidConcentration {
  value: string;
  label: string;
  labelAr: string;
  kcalPerMl: number;
}

export const LIPID_CONCENTRATIONS: LipidConcentration[] = [
  { value: '10', label: '10% (1.1 kcal/mL)', labelAr: '10% (1.1 سعرة/مل)', kcalPerMl: 1.1 },
  { value: '20', label: '20% (2.0 kcal/mL)', labelAr: '20% (2.0 سعرة/مل)', kcalPerMl: 2.0 },
];

// ── Standard Electrolytes ────────────────────────────────────────────────────

export interface ElectrolyteDef {
  name: string;
  nameAr: string;
  unit: string;
  defaultMin: number;
  defaultMax: number;
  perKg: boolean;
  osmolarity: number; // mOsm per mEq or mmol
}

export const STANDARD_ELECTROLYTES: ElectrolyteDef[] = [
  { name: 'Sodium (Na)',         nameAr: 'صوديوم (Na)',        unit: 'mEq', defaultMin: 1,     defaultMax: 2,     perKg: true,  osmolarity: 2 },
  { name: 'Potassium (K)',       nameAr: 'بوتاسيوم (K)',      unit: 'mEq', defaultMin: 1,     defaultMax: 2,     perKg: true,  osmolarity: 2 },
  { name: 'Calcium (Ca)',        nameAr: 'كالسيوم (Ca)',      unit: 'mEq', defaultMin: 5,     defaultMax: 20,    perKg: false, osmolarity: 1.4 },
  { name: 'Magnesium (Mg)',      nameAr: 'مغنيسيوم (Mg)',     unit: 'mEq', defaultMin: 8,     defaultMax: 24,    perKg: false, osmolarity: 1 },
  { name: 'Phosphorus (P)',      nameAr: 'فوسفور (P)',        unit: 'mmol', defaultMin: 10,   defaultMax: 40,    perKg: false, osmolarity: 0.7 },
  { name: 'Chloride (Cl)',       nameAr: 'كلوريد (Cl)',       unit: 'mEq', defaultMin: 0,     defaultMax: 150,   perKg: false, osmolarity: 1 },
  { name: 'Acetate',             nameAr: 'اسيتات',            unit: 'mEq', defaultMin: 0,     defaultMax: 150,   perKg: false, osmolarity: 1 },
];

// ── Standard Vitamins ────────────────────────────────────────────────────────

export interface VitaminDef {
  name: string;
  nameAr: string;
  unit: string;
  standardDose: string;
}

export const STANDARD_VITAMINS: VitaminDef[] = [
  { name: 'MVI-12 (Adult)',          nameAr: 'MVI-12 (بالغين)',         unit: 'mL',  standardDose: '10' },
  { name: 'MVI-Pediatric',          nameAr: 'MVI (أطفال)',             unit: 'mL',  standardDose: '5' },
  { name: 'Vitamin K (Phytonadione)', nameAr: 'فيتامين ك (فيتوناديون)', unit: 'mg',  standardDose: '10' },
  { name: 'Vitamin C (Ascorbic Acid)', nameAr: 'فيتامين ج (حمض الأسكوربيك)', unit: 'mg', standardDose: '200' },
  { name: 'Thiamine (B1)',          nameAr: 'ثيامين (ب1)',             unit: 'mg',  standardDose: '100' },
  { name: 'Folic Acid',             nameAr: 'حمض الفوليك',             unit: 'mg',  standardDose: '1' },
];

// ── Standard Trace Elements ──────────────────────────────────────────────────

export interface TraceElementDef {
  name: string;
  nameAr: string;
  unit: string;
  standardDose: string;
}

export const STANDARD_TRACE_ELEMENTS: TraceElementDef[] = [
  { name: 'Zinc (Zn)',        nameAr: 'زنك (Zn)',       unit: 'mg',  standardDose: '5' },
  { name: 'Copper (Cu)',      nameAr: 'نحاس (Cu)',      unit: 'mg',  standardDose: '1' },
  { name: 'Manganese (Mn)',   nameAr: 'منغنيز (Mn)',    unit: 'mcg', standardDose: '500' },
  { name: 'Chromium (Cr)',    nameAr: 'كروميوم (Cr)',   unit: 'mcg', standardDose: '10' },
  { name: 'Selenium (Se)',    nameAr: 'سيلينيوم (Se)',  unit: 'mcg', standardDose: '60' },
];

// ── Access Types ─────────────────────────────────────────────────────────────

export interface AccessTypeDef {
  value: string;
  label: string;
  labelAr: string;
  maxOsmolarity: number;
}

export const ACCESS_TYPES: AccessTypeDef[] = [
  { value: 'CENTRAL',     label: 'Central Line',     labelAr: 'قسطرة مركزية',    maxOsmolarity: 3000 },
  { value: 'PERIPHERAL',  label: 'Peripheral IV',    labelAr: 'وريدي طرفي',      maxOsmolarity: 900  },
];

// ── Lab Monitoring Schedule ──────────────────────────────────────────────────

export interface LabMonitoringItem {
  test: string;
  testAr: string;
  frequency: string;
  frequencyAr: string;
}

export const LAB_MONITORING_SCHEDULE: LabMonitoringItem[] = [
  // Daily
  { test: 'Basic Metabolic Panel (BMP)',        testAr: 'تحليل الأيض الأساسي',      frequency: 'Daily x 3 days, then twice weekly', frequencyAr: 'يوميا لمدة 3 أيام ثم مرتين أسبوعيا' },
  { test: 'Blood Glucose',                       testAr: 'سكر الدم',                  frequency: 'Every 6 hours initially',           frequencyAr: 'كل 6 ساعات بداية' },
  { test: 'Intake & Output',                     testAr: 'السوائل الداخلة والخارجة',  frequency: 'Daily',                             frequencyAr: 'يوميا' },
  { test: 'Weight',                               testAr: 'الوزن',                    frequency: 'Daily',                             frequencyAr: 'يوميا' },
  // Weekly
  { test: 'Hepatic Function Panel',              testAr: 'وظائف الكبد',               frequency: 'Weekly',                            frequencyAr: 'أسبوعيا' },
  { test: 'Triglycerides',                        testAr: 'الدهون الثلاثية',           frequency: 'Weekly (if lipids given)',           frequencyAr: 'أسبوعيا (في حالة إعطاء دهون)' },
  { test: 'Prealbumin',                           testAr: 'ما قبل الألبومين',          frequency: 'Weekly',                            frequencyAr: 'أسبوعيا' },
  { test: 'Magnesium',                            testAr: 'مغنيسيوم',                 frequency: 'Twice weekly',                      frequencyAr: 'مرتين أسبوعيا' },
  { test: 'Phosphorus',                            testAr: 'فوسفور',                   frequency: 'Twice weekly',                      frequencyAr: 'مرتين أسبوعيا' },
  { test: 'Ionized Calcium',                      testAr: 'كالسيوم متأين',            frequency: 'Twice weekly',                      frequencyAr: 'مرتين أسبوعيا' },
  { test: 'CBC with Differential',                testAr: 'تعداد الدم الشامل',        frequency: 'Weekly',                            frequencyAr: 'أسبوعيا' },
  { test: 'Trace Elements (Zn, Cu, Se, Mn)',     testAr: 'العناصر النادرة',           frequency: 'Monthly',                           frequencyAr: 'شهريا' },
];

// ── TPN Status values ────────────────────────────────────────────────────────

export const TPN_STATUSES = ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
export type TpnStatus = (typeof TPN_STATUSES)[number];

// =============================================================================
// Calculation Functions
// =============================================================================

export interface DextroseInput {
  concentration: string; // "5", "10", "20", "50", "70"
  volume: number; // mL
}

export interface AminoAcidInput {
  concentration: string; // "8.5", "10", "15"
  volume: number; // mL
}

export interface LipidInput {
  concentration: string; // "10", "20"
  volume: number; // mL
}

/**
 * Calculate total calories from all TPN macronutrient components.
 * Dextrose: 3.4 kcal/g (concentration% * volume * 0.034)
 * Amino acids: 4 kcal/g (concentration% * volume * 0.04)
 * Lipids: 1.1 or 2.0 kcal/mL depending on concentration
 */
export function calculateTpnCalories(
  dextrose: DextroseInput,
  aminoAcids: AminoAcidInput,
  lipids: LipidInput | null,
): { dextroseKcal: number; aminoAcidKcal: number; lipidKcal: number; totalKcal: number } {
  const dexConc = DEXTROSE_CONCENTRATIONS.find(d => d.value === dextrose.concentration);
  const aaConc = AMINO_ACID_CONCENTRATIONS.find(a => a.value === aminoAcids.concentration);
  const lipConc = lipids ? LIPID_CONCENTRATIONS.find(l => l.value === lipids.concentration) : null;

  const dextroseKcal = dexConc ? dexConc.kcalPerMl * dextrose.volume : 0;
  const aminoAcidKcal = aaConc ? aaConc.kcalPerMl * aminoAcids.volume : 0;
  const lipidKcal = lipConc && lipids ? lipConc.kcalPerMl * lipids.volume : 0;

  return {
    dextroseKcal: Math.round(dextroseKcal),
    aminoAcidKcal: Math.round(aminoAcidKcal),
    lipidKcal: Math.round(lipidKcal),
    totalKcal: Math.round(dextroseKcal + aminoAcidKcal + lipidKcal),
  };
}

/**
 * Calculate total protein from amino acid component.
 * protein (g) = concentration% * volume / 100
 */
export function calculateTpnProtein(aminoAcids: AminoAcidInput): number {
  const aaConc = AMINO_ACID_CONCENTRATIONS.find(a => a.value === aminoAcids.concentration);
  if (!aaConc) return 0;
  return Math.round(aaConc.proteinPerMl * aminoAcids.volume * 10) / 10;
}

/**
 * Calculate Glucose Infusion Rate (GIR) in mg/kg/min.
 * GIR = (dextrose g/day * 1000) / (weight kg * infusion hours * 60)
 *
 * dextrose g = concentration% * volume / 100
 */
export function calculateGIR(
  dextrose: DextroseInput,
  weightKg: number,
  infusionHours: number,
): number {
  const dexConc = DEXTROSE_CONCENTRATIONS.find(d => d.value === dextrose.concentration);
  if (!dexConc || !weightKg || !infusionHours) return 0;

  const dextroseGrams = (dexConc.pct / 100) * dextrose.volume;
  const dextroseMg = dextroseGrams * 1000;
  const totalMinutes = infusionHours * 60;
  const gir = dextroseMg / (weightKg * totalMinutes);
  return Math.round(gir * 100) / 100;
}

/**
 * Calculate osmolarity of TPN solution in mOsm/L.
 * Dextrose contribution: concentration (g/L) * 5 mOsm per g
 * Amino acid contribution: concentration (g/L) * 10 mOsm per g
 * Electrolyte contribution: sum of each electrolyte (mEq or mmol) * factor / volume in L
 */
export function calculateOsmolarity(
  dextrose: DextroseInput,
  aminoAcids: AminoAcidInput,
  electrolytes: Array<{ name: string; amount: number }>,
  totalVolumeMl: number,
): number {
  if (!totalVolumeMl) return 0;
  const totalVolumeL = totalVolumeMl / 1000;

  const dexConc = DEXTROSE_CONCENTRATIONS.find(d => d.value === dextrose.concentration);
  const aaConc = AMINO_ACID_CONCENTRATIONS.find(a => a.value === aminoAcids.concentration);

  // Dextrose: ~5 mOsm per gram of dextrose
  const dextroseGrams = dexConc ? (dexConc.pct / 100) * dextrose.volume : 0;
  const dexOsm = (dextroseGrams / totalVolumeL) * 5;

  // Amino acids: ~10 mOsm per gram of protein
  const aaGrams = aaConc ? aaConc.proteinPerMl * aminoAcids.volume : 0;
  const aaOsm = (aaGrams / totalVolumeL) * 10;

  // Electrolytes contribution
  let electrolyteOsm = 0;
  for (const elec of electrolytes) {
    const def = STANDARD_ELECTROLYTES.find(e => e.name === elec.name);
    if (def && elec.amount > 0) {
      electrolyteOsm += (elec.amount * def.osmolarity) / totalVolumeL;
    }
  }

  return Math.round(dexOsm + aaOsm + electrolyteOsm);
}

/**
 * Check if osmolarity is safe for peripheral administration (< 900 mOsm/L).
 */
export function isPeripheralSafe(osmolarity: number): boolean {
  return osmolarity < 900;
}

/**
 * Calculate BMI from weight (kg) and height (cm).
 * BMI = weight / (height in meters)^2
 */
export function calculateBMI(weightKg: number, heightCm: number): number {
  if (!weightKg || !heightCm) return 0;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

/**
 * Calculate total volume from all TPN components.
 */
export function calculateTotalVolume(
  dextroseVol: number,
  aminoAcidVol: number,
  lipidVol: number,
): number {
  return Math.round(dextroseVol + aminoAcidVol + lipidVol);
}
