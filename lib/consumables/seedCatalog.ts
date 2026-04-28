/**
 * Seed data for consumable supplies catalog.
 * ~30 common items used across ER, OPD, IPD, OR departments.
 */

export interface SeedConsumableItem {
  name: string;
  nameAr?: string;
  category: string;
  usageUnit: string;
  costPrice: number;
  basePrice: number;
  isChargeable: boolean;
  insuranceCoverable: boolean;
  reorderLevel: number;
  defaultQuantity: number;
  requiresCount: boolean;
  trackExpiry: boolean;
  trackBatch: boolean;
}

export const CONSUMABLE_SEED_ITEMS: SeedConsumableItem[] = [
  // --- IV / Fluid Access ---
  { name: 'IV Cannula 20G', nameAr: 'كانيولا وريدية 20G', category: 'IV_ACCESS', usageUnit: 'EACH', costPrice: 2.5, basePrice: 15, isChargeable: true, insuranceCoverable: true, reorderLevel: 50, defaultQuantity: 1, requiresCount: false, trackExpiry: true, trackBatch: true },
  { name: 'IV Cannula 22G', nameAr: 'كانيولا وريدية 22G', category: 'IV_ACCESS', usageUnit: 'EACH', costPrice: 2.5, basePrice: 15, isChargeable: true, insuranceCoverable: true, reorderLevel: 50, defaultQuantity: 1, requiresCount: false, trackExpiry: true, trackBatch: true },
  { name: 'IV Extension Set', nameAr: 'وصلة تمديد وريدية', category: 'IV_ACCESS', usageUnit: 'EACH', costPrice: 3.0, basePrice: 18, isChargeable: true, insuranceCoverable: true, reorderLevel: 30, defaultQuantity: 1, requiresCount: false, trackExpiry: true, trackBatch: false },
  { name: 'IV Infusion Set', nameAr: 'طقم تسريب وريدي', category: 'IV_ACCESS', usageUnit: 'EACH', costPrice: 4.5, basePrice: 25, isChargeable: true, insuranceCoverable: true, reorderLevel: 40, defaultQuantity: 1, requiresCount: false, trackExpiry: true, trackBatch: false },
  { name: 'Normal Saline 500ml', nameAr: 'محلول ملحي 500مل', category: 'IV_FLUIDS', usageUnit: 'BAG', costPrice: 5.0, basePrice: 30, isChargeable: true, insuranceCoverable: true, reorderLevel: 30, defaultQuantity: 1, requiresCount: false, trackExpiry: true, trackBatch: true },
  { name: 'Normal Saline 1000ml', nameAr: 'محلول ملحي 1000مل', category: 'IV_FLUIDS', usageUnit: 'BAG', costPrice: 7.0, basePrice: 40, isChargeable: true, insuranceCoverable: true, reorderLevel: 20, defaultQuantity: 1, requiresCount: false, trackExpiry: true, trackBatch: true },

  // --- Wound Care / Dressings ---
  { name: 'Gauze Pad 4x4', nameAr: 'شاش 4×4', category: 'WOUND_CARE', usageUnit: 'PACK', costPrice: 1.0, basePrice: 8, isChargeable: true, insuranceCoverable: true, reorderLevel: 100, defaultQuantity: 2, requiresCount: false, trackExpiry: false, trackBatch: false },
  { name: 'Adhesive Bandage Strip', nameAr: 'لاصق جروح', category: 'WOUND_CARE', usageUnit: 'EACH', costPrice: 0.3, basePrice: 3, isChargeable: false, insuranceCoverable: false, reorderLevel: 200, defaultQuantity: 1, requiresCount: false, trackExpiry: false, trackBatch: false },
  { name: 'Elastic Bandage 10cm', nameAr: 'رباط مطاطي 10سم', category: 'WOUND_CARE', usageUnit: 'ROLL', costPrice: 3.0, basePrice: 20, isChargeable: true, insuranceCoverable: true, reorderLevel: 30, defaultQuantity: 1, requiresCount: false, trackExpiry: false, trackBatch: false },
  { name: 'Tegaderm Dressing 10x12', nameAr: 'ضماد تيغادرم 10×12', category: 'WOUND_CARE', usageUnit: 'EACH', costPrice: 8.0, basePrice: 35, isChargeable: true, insuranceCoverable: true, reorderLevel: 20, defaultQuantity: 1, requiresCount: false, trackExpiry: true, trackBatch: false },
  { name: 'Suture Kit (Nylon 3-0)', nameAr: 'طقم خياطة نايلون 3-0', category: 'WOUND_CARE', usageUnit: 'KIT', costPrice: 15.0, basePrice: 80, isChargeable: true, insuranceCoverable: true, reorderLevel: 15, defaultQuantity: 1, requiresCount: true, trackExpiry: true, trackBatch: true },

  // --- Syringes & Needles ---
  { name: 'Syringe 5ml', nameAr: 'محقنة 5مل', category: 'SYRINGES', usageUnit: 'EACH', costPrice: 0.5, basePrice: 5, isChargeable: false, insuranceCoverable: false, reorderLevel: 100, defaultQuantity: 1, requiresCount: false, trackExpiry: true, trackBatch: false },
  { name: 'Syringe 10ml', nameAr: 'محقنة 10مل', category: 'SYRINGES', usageUnit: 'EACH', costPrice: 0.7, basePrice: 6, isChargeable: false, insuranceCoverable: false, reorderLevel: 100, defaultQuantity: 1, requiresCount: false, trackExpiry: true, trackBatch: false },
  { name: 'Needle 21G', nameAr: 'إبرة 21G', category: 'SYRINGES', usageUnit: 'EACH', costPrice: 0.2, basePrice: 3, isChargeable: false, insuranceCoverable: false, reorderLevel: 150, defaultQuantity: 1, requiresCount: false, trackExpiry: false, trackBatch: false },

  // --- Catheters ---
  { name: 'Foley Catheter 16Fr', nameAr: 'قسطرة فولي 16Fr', category: 'CATHETERS', usageUnit: 'EACH', costPrice: 12.0, basePrice: 60, isChargeable: true, insuranceCoverable: true, reorderLevel: 10, defaultQuantity: 1, requiresCount: true, trackExpiry: true, trackBatch: true },
  { name: 'Urine Collection Bag', nameAr: 'كيس جمع بول', category: 'CATHETERS', usageUnit: 'EACH', costPrice: 5.0, basePrice: 25, isChargeable: true, insuranceCoverable: true, reorderLevel: 15, defaultQuantity: 1, requiresCount: false, trackExpiry: false, trackBatch: false },
  { name: 'Nasogastric Tube 14Fr', nameAr: 'أنبوب أنفي معدي 14Fr', category: 'CATHETERS', usageUnit: 'EACH', costPrice: 8.0, basePrice: 45, isChargeable: true, insuranceCoverable: true, reorderLevel: 10, defaultQuantity: 1, requiresCount: true, trackExpiry: true, trackBatch: false },

  // --- Respiratory ---
  { name: 'Oxygen Mask (Simple)', nameAr: 'قناع أكسجين بسيط', category: 'RESPIRATORY', usageUnit: 'EACH', costPrice: 4.0, basePrice: 20, isChargeable: true, insuranceCoverable: true, reorderLevel: 20, defaultQuantity: 1, requiresCount: false, trackExpiry: false, trackBatch: false },
  { name: 'Nasal Cannula', nameAr: 'قنية أنفية', category: 'RESPIRATORY', usageUnit: 'EACH', costPrice: 2.0, basePrice: 12, isChargeable: true, insuranceCoverable: true, reorderLevel: 30, defaultQuantity: 1, requiresCount: false, trackExpiry: false, trackBatch: false },
  { name: 'Nebulizer Kit', nameAr: 'طقم بخاخ', category: 'RESPIRATORY', usageUnit: 'EACH', costPrice: 6.0, basePrice: 30, isChargeable: true, insuranceCoverable: true, reorderLevel: 15, defaultQuantity: 1, requiresCount: false, trackExpiry: false, trackBatch: false },

  // --- Monitoring / Diagnostics ---
  { name: 'ECG Electrode (pack of 3)', nameAr: 'أقطاب تخطيط قلب (3 حبات)', category: 'MONITORING', usageUnit: 'PACK', costPrice: 2.0, basePrice: 10, isChargeable: true, insuranceCoverable: true, reorderLevel: 50, defaultQuantity: 1, requiresCount: false, trackExpiry: true, trackBatch: false },
  { name: 'SpO2 Probe (Disposable)', nameAr: 'مجس أكسجين الدم', category: 'MONITORING', usageUnit: 'EACH', costPrice: 15.0, basePrice: 50, isChargeable: true, insuranceCoverable: true, reorderLevel: 10, defaultQuantity: 1, requiresCount: true, trackExpiry: false, trackBatch: false },
  { name: 'Glucometer Strip', nameAr: 'شريحة قياس السكر', category: 'MONITORING', usageUnit: 'STRIP', costPrice: 1.5, basePrice: 8, isChargeable: true, insuranceCoverable: true, reorderLevel: 100, defaultQuantity: 1, requiresCount: false, trackExpiry: true, trackBatch: true },

  // --- PPE ---
  { name: 'Gloves Nitrile (pair)', nameAr: 'قفازات نتريل (زوج)', category: 'PPE', usageUnit: 'PAIR', costPrice: 0.5, basePrice: 3, isChargeable: false, insuranceCoverable: false, reorderLevel: 500, defaultQuantity: 2, requiresCount: false, trackExpiry: false, trackBatch: false },
  { name: 'Surgical Mask', nameAr: 'كمامة جراحية', category: 'PPE', usageUnit: 'EACH', costPrice: 0.3, basePrice: 2, isChargeable: false, insuranceCoverable: false, reorderLevel: 500, defaultQuantity: 1, requiresCount: false, trackExpiry: false, trackBatch: false },
  { name: 'Sterile Gown', nameAr: 'رداء معقم', category: 'PPE', usageUnit: 'EACH', costPrice: 8.0, basePrice: 35, isChargeable: true, insuranceCoverable: true, reorderLevel: 20, defaultQuantity: 1, requiresCount: false, trackExpiry: false, trackBatch: false },

  // --- Orthopedic ---
  { name: 'Arm Sling', nameAr: 'حمالة ذراع', category: 'ORTHOPEDIC', usageUnit: 'EACH', costPrice: 10.0, basePrice: 45, isChargeable: true, insuranceCoverable: true, reorderLevel: 10, defaultQuantity: 1, requiresCount: true, trackExpiry: false, trackBatch: false },
  { name: 'Plaster of Paris Roll 10cm', nameAr: 'لفة جبس 10سم', category: 'ORTHOPEDIC', usageUnit: 'ROLL', costPrice: 12.0, basePrice: 55, isChargeable: true, insuranceCoverable: true, reorderLevel: 8, defaultQuantity: 1, requiresCount: true, trackExpiry: false, trackBatch: false },
  { name: 'Splint Padded (Medium)', nameAr: 'جبيرة مبطنة وسط', category: 'ORTHOPEDIC', usageUnit: 'EACH', costPrice: 18.0, basePrice: 70, isChargeable: true, insuranceCoverable: true, reorderLevel: 5, defaultQuantity: 1, requiresCount: true, trackExpiry: false, trackBatch: false },

  // --- Drain / Surgical ---
  { name: 'Chest Drain 28Fr', nameAr: 'درنقة صدرية 28Fr', category: 'DRAINS', usageUnit: 'EACH', costPrice: 35.0, basePrice: 150, isChargeable: true, insuranceCoverable: true, reorderLevel: 5, defaultQuantity: 1, requiresCount: true, trackExpiry: true, trackBatch: true },
  { name: 'Wound Drain (Jackson-Pratt)', nameAr: 'درنقة جرح جاكسون-برات', category: 'DRAINS', usageUnit: 'EACH', costPrice: 25.0, basePrice: 120, isChargeable: true, insuranceCoverable: true, reorderLevel: 5, defaultQuantity: 1, requiresCount: true, trackExpiry: true, trackBatch: false },
];

export const CONSUMABLE_USAGE_TEMPLATES = [
  {
    name: 'IV Line Start',
    nameAr: 'بدء خط وريدي',
    department: 'ALL',
    usageContext: 'IV_LINE',
    items: [
      { supplyName: 'IV Cannula 20G', defaultQty: 1 },
      { supplyName: 'IV Extension Set', defaultQty: 1 },
      { supplyName: 'IV Infusion Set', defaultQty: 1 },
      { supplyName: 'Tegaderm Dressing 10x12', defaultQty: 1 },
      { supplyName: 'Gloves Nitrile (pair)', defaultQty: 1 },
    ],
  },
  {
    name: 'Wound Dressing Change',
    nameAr: 'تغيير ضماد جرح',
    department: 'ALL',
    usageContext: 'DRESSING',
    items: [
      { supplyName: 'Gauze Pad 4x4', defaultQty: 2 },
      { supplyName: 'Tegaderm Dressing 10x12', defaultQty: 1 },
      { supplyName: 'Gloves Nitrile (pair)', defaultQty: 2 },
      { supplyName: 'Surgical Mask', defaultQty: 1 },
    ],
  },
  {
    name: 'Foley Catheter Insertion',
    nameAr: 'تركيب قسطرة بولية',
    department: 'ALL',
    usageContext: 'CATHETER',
    items: [
      { supplyName: 'Foley Catheter 16Fr', defaultQty: 1 },
      { supplyName: 'Urine Collection Bag', defaultQty: 1 },
      { supplyName: 'Syringe 10ml', defaultQty: 1 },
      { supplyName: 'Gloves Nitrile (pair)', defaultQty: 2 },
      { supplyName: 'Sterile Gown', defaultQty: 1 },
    ],
  },
  {
    name: 'NG Tube Insertion',
    nameAr: 'تركيب أنبوب أنفي معدي',
    department: 'ALL',
    usageContext: 'PROCEDURE',
    items: [
      { supplyName: 'Nasogastric Tube 14Fr', defaultQty: 1 },
      { supplyName: 'Syringe 10ml', defaultQty: 1 },
      { supplyName: 'Adhesive Bandage Strip', defaultQty: 2 },
      { supplyName: 'Gloves Nitrile (pair)', defaultQty: 1 },
    ],
  },
  {
    name: 'Blood Glucose Check',
    nameAr: 'فحص سكر الدم',
    department: 'ALL',
    usageContext: 'MONITORING',
    items: [
      { supplyName: 'Glucometer Strip', defaultQty: 1 },
      { supplyName: 'Gloves Nitrile (pair)', defaultQty: 1 },
      { supplyName: 'Adhesive Bandage Strip', defaultQty: 1 },
    ],
  },
  {
    name: 'Chest Drain Insertion',
    nameAr: 'تركيب درنقة صدرية',
    department: 'ER',
    usageContext: 'DRAIN',
    items: [
      { supplyName: 'Chest Drain 28Fr', defaultQty: 1 },
      { supplyName: 'Suture Kit (Nylon 3-0)', defaultQty: 1 },
      { supplyName: 'Sterile Gown', defaultQty: 1 },
      { supplyName: 'Gloves Nitrile (pair)', defaultQty: 2 },
      { supplyName: 'Gauze Pad 4x4', defaultQty: 3 },
      { supplyName: 'Tegaderm Dressing 10x12', defaultQty: 1 },
    ],
  },
];
