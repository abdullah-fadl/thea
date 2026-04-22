/**
 * Imdad Simulation Scenario Definitions
 *
 * Static definitions for all available simulation scenarios.
 */

import type { ScenarioType } from './types';

export interface ScenarioDefinition {
  type: ScenarioType;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  defaultIntensity: number;
  defaultDurationTicks: number;
  category: string;
}

export const SCENARIO_DEFINITIONS: ScenarioDefinition[] = [
  {
    type: 'DEMAND_SPIKE',
    nameEn: 'Demand Spike',
    nameAr: '\u0627\u0631\u062a\u0641\u0627\u0639 \u0645\u0641\u0627\u062c\u0626 \u0641\u064a \u0627\u0644\u0637\u0644\u0628',
    descriptionEn: 'Simulate a sudden increase in supply requests across departments',
    descriptionAr: '\u0645\u062d\u0627\u0643\u0627\u0629 \u0632\u064a\u0627\u062f\u0629 \u0645\u0641\u0627\u062c\u0626\u0629 \u0641\u064a \u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062a\u0648\u0631\u064a\u062f',
    defaultIntensity: 0.7,
    defaultDurationTicks: 50,
    category: 'demand',
  },
  {
    type: 'SUPPLY_DISRUPTION',
    nameEn: 'Supply Disruption',
    nameAr: '\u0627\u0646\u0642\u0637\u0627\u0639 \u0641\u064a \u0627\u0644\u0625\u0645\u062f\u0627\u062f',
    descriptionEn: 'Simulate vendor delivery failures and delayed shipments',
    descriptionAr: '\u0645\u062d\u0627\u0643\u0627\u0629 \u0641\u0634\u0644 \u062a\u0633\u0644\u064a\u0645 \u0627\u0644\u0645\u0648\u0631\u062f\u064a\u0646 \u0648\u062a\u0623\u062e\u0631 \u0627\u0644\u0634\u062d\u0646\u0627\u062a',
    defaultIntensity: 0.5,
    defaultDurationTicks: 30,
    category: 'supply',
  },
  {
    type: 'QUALITY_ISSUE',
    nameEn: 'Quality Issue',
    nameAr: '\u0645\u0634\u0643\u0644\u0629 \u062c\u0648\u062f\u0629',
    descriptionEn: 'Simulate quality inspection failures and product recalls',
    descriptionAr: '\u0645\u062d\u0627\u0643\u0627\u0629 \u0641\u0634\u0644 \u0641\u062d\u0648\u0635\u0627\u062a \u0627\u0644\u062c\u0648\u062f\u0629 \u0648\u0627\u0633\u062a\u0631\u062c\u0627\u0639 \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a',
    defaultIntensity: 0.4,
    defaultDurationTicks: 20,
    category: 'quality',
  },
  {
    type: 'BUDGET_FREEZE',
    nameEn: 'Budget Freeze',
    nameAr: '\u062a\u062c\u0645\u064a\u062f \u0627\u0644\u0645\u064a\u0632\u0627\u0646\u064a\u0629',
    descriptionEn: 'Simulate budget constraints causing approval delays',
    descriptionAr: '\u0645\u062d\u0627\u0643\u0627\u0629 \u0642\u064a\u0648\u062f \u0627\u0644\u0645\u064a\u0632\u0627\u0646\u064a\u0629 \u0627\u0644\u062a\u064a \u062a\u0633\u0628\u0628 \u062a\u0623\u062e\u064a\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0627\u062a',
    defaultIntensity: 0.6,
    defaultDurationTicks: 40,
    category: 'financial',
  },
  {
    type: 'VENDOR_DELAY',
    nameEn: 'Vendor Delay',
    nameAr: '\u062a\u0623\u062e\u0631 \u0627\u0644\u0645\u0648\u0631\u062f',
    descriptionEn: 'Simulate delayed vendor responses and extended lead times',
    descriptionAr: '\u0645\u062d\u0627\u0643\u0627\u0629 \u062a\u0623\u062e\u0631 \u0627\u0633\u062a\u062c\u0627\u0628\u0627\u062a \u0627\u0644\u0645\u0648\u0631\u062f\u064a\u0646',
    defaultIntensity: 0.5,
    defaultDurationTicks: 25,
    category: 'supply',
  },
  {
    type: 'EMERGENCY_ORDER',
    nameEn: 'Emergency Order',
    nameAr: '\u0637\u0644\u0628 \u0637\u0627\u0631\u0626',
    descriptionEn: 'Simulate emergency procurement requests bypassing normal workflow',
    descriptionAr: '\u0645\u062d\u0627\u0643\u0627\u0629 \u0637\u0644\u0628\u0627\u062a \u0634\u0631\u0627\u0621 \u0637\u0627\u0631\u0626\u0629',
    defaultIntensity: 0.8,
    defaultDurationTicks: 10,
    category: 'demand',
  },
  {
    type: 'SEASONAL_SURGE',
    nameEn: 'Seasonal Surge',
    nameAr: '\u0632\u064a\u0627\u062f\u0629 \u0645\u0648\u0633\u0645\u064a\u0629',
    descriptionEn: 'Simulate seasonal demand increases (e.g., Hajj, Ramadan)',
    descriptionAr: '\u0645\u062d\u0627\u0643\u0627\u0629 \u0632\u064a\u0627\u062f\u0627\u062a \u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u0645\u0648\u0633\u0645\u064a\u0629',
    defaultIntensity: 0.6,
    defaultDurationTicks: 60,
    category: 'demand',
  },
  {
    type: 'REGULATORY_AUDIT',
    nameEn: 'Regulatory Audit',
    nameAr: '\u062a\u062f\u0642\u064a\u0642 \u062a\u0646\u0638\u064a\u0645\u064a',
    descriptionEn: 'Simulate SFDA or MOH regulatory audit activities',
    descriptionAr: '\u0645\u062d\u0627\u0643\u0627\u0629 \u0623\u0646\u0634\u0637\u0629 \u0627\u0644\u062a\u062f\u0642\u064a\u0642 \u0627\u0644\u062a\u0646\u0638\u064a\u0645\u064a',
    defaultIntensity: 0.3,
    defaultDurationTicks: 15,
    category: 'compliance',
  },
];
