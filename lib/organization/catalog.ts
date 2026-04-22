export type OrganizationCatalogItem = {
  orgTypeId: string;
  displayName: string;
  defaultSector: string;
  baselineAccreditationSets?: string[];
  baselineRequiredDocumentTypes?: string[];
  baselineGlossary?: Record<string, string>;
  baselineGuidanceDefaults?: {
    strictness: 'lenient' | 'balanced' | 'strict';
    reviewFrequency?: string;
    documentationDepth?: string;
  };
};

export const ORGANIZATION_TYPE_CATALOG: OrganizationCatalogItem[] = [
  {
    orgTypeId: 'hospital',
    displayName: 'Hospital',
    defaultSector: 'healthcare',
    baselineAccreditationSets: ['Healthcare compliance standards'],
    baselineRequiredDocumentTypes: ['policy', 'sop', 'workflow', 'checklist', 'form', 'guideline', 'instruction'],
    baselineGlossary: {
      'Informed consent': 'Documented agreement acknowledging risks, benefits, and alternatives.',
      'Adverse event': 'Incident that results in harm or potential harm to a patient.',
    },
    baselineGuidanceDefaults: { strictness: 'strict', reviewFrequency: 'quarterly', documentationDepth: 'high' },
  },
  {
    orgTypeId: 'clinic',
    displayName: 'Clinic',
    defaultSector: 'healthcare',
    baselineAccreditationSets: ['Healthcare compliance standards'],
    baselineRequiredDocumentTypes: ['policy', 'sop', 'workflow', 'checklist', 'form', 'guideline', 'instruction'],
    baselineGlossary: {
      'Patient intake': 'Process for collecting patient information during registration.',
    },
    baselineGuidanceDefaults: { strictness: 'balanced', reviewFrequency: 'quarterly', documentationDepth: 'medium' },
  },
  {
    orgTypeId: 'factory',
    displayName: 'Factory',
    defaultSector: 'manufacturing',
    baselineAccreditationSets: ['ISO 9001', 'ISO 45001', 'ISO 14001'],
    baselineRequiredDocumentTypes: ['policy', 'sop', 'workflow', 'checklist', 'form', 'instruction'],
    baselineGlossary: {
      'Nonconformance': 'Deviation from a required process or standard.',
    },
    baselineGuidanceDefaults: { strictness: 'strict', reviewFrequency: 'monthly', documentationDepth: 'high' },
  },
  {
    orgTypeId: 'government-agency',
    displayName: 'Government Agency',
    defaultSector: 'government',
    baselineAccreditationSets: ['Public governance requirements'],
    baselineRequiredDocumentTypes: ['policy', 'sop', 'workflow', 'checklist', 'form', 'guideline'],
    baselineGlossary: {
      'Public accountability': 'Responsibility to justify actions and decisions to the public.',
    },
    baselineGuidanceDefaults: { strictness: 'strict', reviewFrequency: 'semiannual', documentationDepth: 'high' },
  },
  {
    orgTypeId: 'school',
    displayName: 'School',
    defaultSector: 'education',
    baselineAccreditationSets: ['Academic governance standards'],
    baselineRequiredDocumentTypes: ['policy', 'sop', 'workflow', 'checklist', 'form', 'guideline', 'instruction'],
    baselineGlossary: {
      'Academic integrity': 'Commitment to honesty and responsibility in scholarship.',
    },
    baselineGuidanceDefaults: { strictness: 'balanced', reviewFrequency: 'annual', documentationDepth: 'medium' },
  },
  {
    orgTypeId: 'university',
    displayName: 'University',
    defaultSector: 'education',
    baselineAccreditationSets: ['Academic governance standards'],
    baselineRequiredDocumentTypes: ['policy', 'sop', 'workflow', 'checklist', 'form', 'guideline', 'instruction'],
    baselineGlossary: {
      'Curriculum review': 'Structured evaluation of educational programs.',
    },
    baselineGuidanceDefaults: { strictness: 'balanced', reviewFrequency: 'annual', documentationDepth: 'medium' },
  },
  {
    orgTypeId: 'logistics',
    displayName: 'Logistics Provider',
    defaultSector: 'logistics',
    baselineAccreditationSets: ['Transportation safety standards'],
    baselineRequiredDocumentTypes: ['policy', 'sop', 'workflow', 'checklist', 'form', 'instruction'],
    baselineGlossary: {
      'Chain of custody': 'Documented process tracking custody of items throughout transport.',
    },
    baselineGuidanceDefaults: { strictness: 'balanced', reviewFrequency: 'monthly', documentationDepth: 'medium' },
  },
  {
    orgTypeId: 'retail',
    displayName: 'Retail',
    defaultSector: 'retail',
    baselineAccreditationSets: ['Consumer protection standards'],
    baselineRequiredDocumentTypes: ['policy', 'sop', 'workflow', 'checklist', 'form', 'guideline', 'instruction'],
    baselineGlossary: {
      'Service recovery': 'Actions taken to resolve customer issues and restore satisfaction.',
    },
    baselineGuidanceDefaults: { strictness: 'balanced', reviewFrequency: 'quarterly', documentationDepth: 'medium' },
  },
  {
    orgTypeId: 'bank',
    displayName: 'Bank',
    defaultSector: 'finance',
    baselineAccreditationSets: ['Financial regulatory requirements', 'ISO 27001'],
    baselineRequiredDocumentTypes: ['policy', 'sop', 'workflow', 'checklist', 'form', 'guideline', 'instruction'],
    baselineGlossary: {
      KYC: 'Know Your Customer processes used for identity verification.',
      AML: 'Anti-Money Laundering controls for monitoring financial activity.',
    },
    baselineGuidanceDefaults: { strictness: 'strict', reviewFrequency: 'quarterly', documentationDepth: 'high' },
  },
  {
    orgTypeId: 'hotel',
    displayName: 'Hotel',
    defaultSector: 'hospitality',
    baselineAccreditationSets: ['Consumer protection standards'],
    baselineRequiredDocumentTypes: ['policy', 'sop', 'workflow', 'checklist', 'form', 'instruction'],
    baselineGlossary: {
      'Guest experience': 'Processes focused on service quality and guest satisfaction.',
    },
    baselineGuidanceDefaults: { strictness: 'balanced', reviewFrequency: 'quarterly', documentationDepth: 'medium' },
  },
  {
    orgTypeId: 'construction',
    displayName: 'Construction',
    defaultSector: 'construction',
    baselineAccreditationSets: ['Occupational safety standards'],
    baselineRequiredDocumentTypes: ['policy', 'sop', 'workflow', 'checklist', 'form', 'instruction'],
    baselineGlossary: {
      'Permit to work': 'Authorization process for high-risk tasks.',
    },
    baselineGuidanceDefaults: { strictness: 'strict', reviewFrequency: 'monthly', documentationDepth: 'high' },
  },
  {
    orgTypeId: 'energy',
    displayName: 'Energy',
    defaultSector: 'energy',
    baselineAccreditationSets: ['ISO 14001', 'Occupational safety standards'],
    baselineRequiredDocumentTypes: ['policy', 'sop', 'workflow', 'checklist', 'form', 'instruction'],
    baselineGlossary: {
      'Lockout/tagout': 'Procedure to ensure equipment is isolated before maintenance.',
    },
    baselineGuidanceDefaults: { strictness: 'strict', reviewFrequency: 'monthly', documentationDepth: 'high' },
  },
  {
    orgTypeId: 'telecom',
    displayName: 'Telecom',
    defaultSector: 'telecom',
    baselineAccreditationSets: ['Information security standards', 'Service continuity standards'],
    baselineRequiredDocumentTypes: ['policy', 'sop', 'workflow', 'checklist', 'form', 'instruction'],
    baselineGlossary: {
      'Service continuity': 'Capability to maintain essential services during disruptions.',
    },
    baselineGuidanceDefaults: { strictness: 'balanced', reviewFrequency: 'quarterly', documentationDepth: 'medium' },
  },
];

export const getCatalogOrgType = (orgTypeId?: string) =>
  ORGANIZATION_TYPE_CATALOG.find((item) => item.orgTypeId === orgTypeId);
