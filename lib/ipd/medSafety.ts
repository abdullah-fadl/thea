const HIGH_RISK_KEYWORDS = [
  'heparin',
  'warfarin',
  'insulin',
  'morphine',
  'fentanyl',
  'hydromorphone',
  'potassium chloride',
  'kcl',
  'chemotherapy',
];

function normalize(value: any): string {
  return String(value || '').trim().toLowerCase();
}

function hasAllergyConflict(drugName: any, allergies: any[]): boolean {
  const drug = normalize(drugName);
  if (!drug) return false;
  return allergies.some((a) => {
    const allergy = normalize(a);
    return allergy ? drug.includes(allergy) : false;
  });
}

function isHighRisk(drugName: any): boolean {
  const drug = normalize(drugName);
  if (!drug) return false;
  return HIGH_RISK_KEYWORDS.some((keyword) => drug.includes(keyword));
}

export function buildMedicationSafetyFlags(
  orders: any[],
  allergies: any[]
): Record<
  string,
  {
    allergyConflict: boolean;
    duplicateWarning: boolean;
    highRisk: boolean;
    existingOrderIds: string[];
  }
> {
  const safeAllergies = Array.isArray(allergies) ? allergies : [];
  const duplicateMap = new Map<string, string[]>();
  for (const order of orders) {
    const key = [
      normalize(order.drugNameNormalized || order.drugName),
      normalize(order.route),
      normalize(order.type),
      normalize(order.schedule || ''),
    ].join('|');
    const list = duplicateMap.get(key) || [];
    list.push(String(order.id || ''));
    duplicateMap.set(key, list);
  }

  const flags: Record<string, any> = {};
  for (const order of orders) {
    const id = String(order.id || '');
    const key = [
      normalize(order.drugNameNormalized || order.drugName),
      normalize(order.route),
      normalize(order.type),
      normalize(order.schedule || ''),
    ].join('|');
    const ids = duplicateMap.get(key) || [];
    const existingOrderIds = ids.filter((item) => item && item !== id);
    flags[id] = {
      allergyConflict: hasAllergyConflict(order.drugName, safeAllergies),
      duplicateWarning: existingOrderIds.length > 0,
      highRisk: isHighRisk(order.drugName),
      existingOrderIds,
    };
  }
  return flags;
}
