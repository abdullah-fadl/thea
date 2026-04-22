export type OverlaySuggestionType = 'ACCREDITATION' | 'REQUIRED_DOCS' | 'GLOSSARY' | 'RULES';

export interface OverlaySuggestion {
  id: string;
  title: string;
  description: string;
  type: OverlaySuggestionType;
  payload: Record<string, any>;
}

type OrgContext = {
  orgTypeName?: string;
  sector?: string;
  countryCode?: string | null;
  accreditationSets?: string[];
};

type OverlayLayer =
  | 'FOUNDATION'
  | 'ACCREDITATION_READY'
  | 'OPERATIONAL_EXCELLENCE'
  | 'ADVANCED_MATURITY';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const buildId = (profileKey: string, type: OverlaySuggestionType, title: string) =>
  `${profileKey}:${type}:${slugify(title)}`;

const profileKeyFrom = (orgType?: string, sector?: string, country?: string) =>
  [orgType || 'unknown', sector || 'unknown', country || 'unknown'].join('|').toLowerCase();

const countryNames: Record<string, string> = {
  SA: 'Saudi Arabia',
  AE: 'United Arab Emirates',
  US: 'United States',
  UK: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  DE: 'Germany',
  FR: 'France',
  IN: 'India',
  SG: 'Singapore',
};

const docTypes = ['policy', 'sop', 'workflow', 'checklist', 'form', 'guideline', 'instruction'];

const toLower = (value?: string) => (value || '').toLowerCase().trim();
const toUpper = (value?: string | null) => (value || '').toUpperCase().trim();

const buildReason = (context: OrgContext, extra?: string) => {
  const parts: string[] = [];
  if (context.orgTypeName) parts.push(`organization type (${context.orgTypeName})`);
  if (context.sector) parts.push(`sector (${context.sector})`);
  if (context.countryCode) {
    const label = countryNames[toUpper(context.countryCode)] || context.countryCode;
    parts.push(`country/region (${label})`);
  }
  if (context.accreditationSets && context.accreditationSets.length > 0) {
    parts.push(`accreditation sets (${context.accreditationSets.join(', ')})`);
  }
  const base = parts.length > 0 ? `Suggested based on ${parts.join(' and ')}.` : 'Suggested based on organization context.';
  return extra ? `${base} ${extra}` : base;
};

const addSuggestion = (
  suggestions: OverlaySuggestion[],
  profileKey: string,
  type: OverlaySuggestionType,
  title: string,
  description: string,
  payload: Record<string, any>
) => {
  suggestions.push({
    id: buildId(profileKey, type, title),
    title,
    description,
    type,
    payload,
  });
};

const addStandards = (
  suggestions: OverlaySuggestion[],
  profileKey: string,
  title: string,
  description: string,
  items: string[],
  category = 'STANDARDS'
) => {
  addSuggestion(suggestions, profileKey, 'ACCREDITATION', title, description, {
    items,
    category,
  });
};

const addRequiredDocs = (
  suggestions: OverlaySuggestion[],
  profileKey: string,
  title: string,
  description: string,
  items: string[],
  category: 'DOCUMENT_TYPES' | 'WORKFLOWS' | 'CHECKLISTS_FORMS'
) => {
  addSuggestion(suggestions, profileKey, 'REQUIRED_DOCS', title, description, {
    items: items.filter((item) => docTypes.includes(item)),
    category,
  });
};

const addGlossary = (
  suggestions: OverlaySuggestion[],
  profileKey: string,
  title: string,
  description: string,
  entries: Record<string, string>
) => {
  addSuggestion(suggestions, profileKey, 'GLOSSARY', title, description, {
    entries,
    category: 'GLOSSARY',
  });
};

const addGuidance = (
  suggestions: OverlaySuggestion[],
  profileKey: string,
  title: string,
  description: string,
  rules: Record<string, any>
) => {
  addSuggestion(suggestions, profileKey, 'RULES', title, description, {
    rules,
    category: 'GUIDANCE_DEFAULTS',
  });
};

export function getSuggestedOverlays(context: OrgContext): { suggestions: OverlaySuggestion[]; isDraft: boolean } {
  const { orgTypeName, sector, countryCode, accreditationSets } = context;
  const profileKey = profileKeyFrom(orgTypeName, sector, countryCode || undefined);
  const suggestions: OverlaySuggestion[] = [];
  const orgType = toLower(orgTypeName);
  const sectorKey = toLower(sector);
  const country = toUpper(countryCode);
  const countryLabel = country ? countryNames[country] || country : undefined;
  const derivedFrom = {
    organizationType: orgTypeName || null,
    sector: sector || null,
    country: countryLabel || countryCode || null,
    accreditationSets: accreditationSets?.length ? accreditationSets : null,
  };

  const isHealthcare = orgType.includes('hospital') || orgType.includes('clinic') || orgType.includes('medical') || sectorKey === 'healthcare';
  const isManufacturing = orgType.includes('factory') || orgType.includes('manufacturing') || sectorKey === 'manufacturing' || sectorKey === 'industrial';
  const isGovernment = orgType.includes('government') || orgType.includes('municipal') || orgType.includes('ministry') || sectorKey === 'government' || sectorKey === 'public';
  const isEducation = orgType.includes('school') || orgType.includes('university') || orgType.includes('college') || sectorKey === 'education';
  const isFinance = orgType.includes('bank') || orgType.includes('insurance') || sectorKey === 'finance' || sectorKey === 'financial';
  const isLogistics = orgType.includes('airport') || orgType.includes('port') || orgType.includes('logistics') || sectorKey === 'logistics' || sectorKey === 'transport';
  const isEnergy = orgType.includes('energy') || orgType.includes('utility') || orgType.includes('oil') || orgType.includes('gas') || sectorKey === 'energy';
  const isRetail = orgType.includes('retail') || orgType.includes('hotel') || orgType.includes('hospitality') || sectorKey === 'retail' || sectorKey === 'hospitality';

  const sectorLabel = sectorKey || 'operations';
  const nationalRegTitle = countryLabel
    ? `National ${sectorLabel} regulations (${countryLabel})`
    : `National ${sectorLabel} regulations`;

  addStandards(
    suggestions,
    profileKey,
    'Quality management standards',
    buildReason(context, 'Supports consistent operations and audit readiness.'),
    ['ISO 9001']
  );
  addStandards(
    suggestions,
    profileKey,
    'Occupational safety standards',
    buildReason(context, 'Supports safety workflows and incident readiness.'),
    ['ISO 45001']
  );
  addStandards(
    suggestions,
    profileKey,
    'Data protection and confidentiality',
    buildReason(context, 'Protects sensitive operational and personal data.'),
    ['Data protection requirements']
  );
  addRequiredDocs(
    suggestions,
    profileKey,
    'Incident reporting workflow',
    buildReason(context, 'Ensures rapid response and compliance readiness.'),
    ['workflow'],
    'WORKFLOWS'
  );

  if (countryLabel) {
    addStandards(
      suggestions,
      profileKey,
      nationalRegTitle,
      buildReason(context, 'Aligns with local compliance expectations.'),
      [nationalRegTitle]
    );
  }

  if (accreditationSets && accreditationSets.length > 0) {
    addStandards(
      suggestions,
      profileKey,
      'Accreditation readiness alignment',
      buildReason(context, 'Aligns baseline controls to your accreditation scope.'),
      accreditationSets
    );
  }

  if (isHealthcare) {
    addStandards(
      suggestions,
      profileKey,
      'Healthcare compliance standards',
      buildReason(context, 'Focused on clinical governance and patient safety.'),
      ['Healthcare compliance standards']
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Clinical policies and SOPs',
      buildReason(context, 'Establishes core clinical requirements.'),
      ['policy', 'sop'],
      'DOCUMENT_TYPES'
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Patient care workflows',
      buildReason(context, 'Ensures consistent clinical execution.'),
      ['workflow'],
      'WORKFLOWS'
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Incident reporting workflow',
      buildReason(context, 'Supports safety and escalation.'),
      ['workflow'],
      'WORKFLOWS'
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Clinical checklists',
      buildReason(context, 'Reinforces safe and consistent procedures.'),
      ['checklist'],
      'CHECKLISTS_FORMS'
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Consent and admission forms',
      buildReason(context, 'Improves patient documentation quality.'),
      ['form'],
      'CHECKLISTS_FORMS'
    );
    addGlossary(
      suggestions,
      profileKey,
      'Informed consent',
      buildReason(context, 'Common clinical terminology.'),
      {
        'Informed consent': 'Documented agreement acknowledging risks, benefits, and alternatives.',
      }
    );
    addGlossary(
      suggestions,
      profileKey,
      'Adverse event',
      buildReason(context, 'Key patient safety terminology.'),
      {
        'Adverse event': 'Incident that results in harm or potential harm to a patient.',
      }
    );
    addGuidance(
      suggestions,
      profileKey,
      'Clinical governance defaults',
      buildReason(context, 'Recommended for high-impact operations.'),
      { strictness: 'strict', reviewFrequency: 'quarterly', documentationDepth: 'high' }
    );
    addGuidance(
      suggestions,
      profileKey,
      'Continuous improvement cycle',
      buildReason(context, 'Supports long-term clinical excellence.'),
      { reviewFrequency: 'monthly', maturityFocus: 'continuous-improvement' }
    );
  }

  if (isManufacturing) {
    addStandards(
      suggestions,
      profileKey,
      'Safety and quality standards',
      buildReason(context, 'Aligns production with safety and quality baselines.'),
      ['ISO 9001', 'ISO 45001', 'ISO 14001']
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Production SOPs and work instructions',
      buildReason(context, 'Standardizes production execution.'),
      ['sop', 'instruction'],
      'DOCUMENT_TYPES'
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Quality assurance workflow',
      buildReason(context, 'Supports inspection and defect handling.'),
      ['workflow'],
      'WORKFLOWS'
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Equipment maintenance workflow',
      buildReason(context, 'Prevents unplanned downtime.'),
      ['workflow'],
      'WORKFLOWS'
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Safety inspection checklists',
      buildReason(context, 'Maintains operational safety readiness.'),
      ['checklist'],
      'CHECKLISTS_FORMS'
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Maintenance forms',
      buildReason(context, 'Tracks equipment servicing.'),
      ['form'],
      'CHECKLISTS_FORMS'
    );
    addGlossary(
      suggestions,
      profileKey,
      'Nonconformance',
      buildReason(context, 'Quality terminology for production control.'),
      { Nonconformance: 'Deviation from a required process or standard.' }
    );
    addGlossary(
      suggestions,
      profileKey,
      'Corrective action',
      buildReason(context, 'Quality and safety terminology.'),
      { 'Corrective action': 'Action taken to eliminate the cause of a detected nonconformance.' }
    );
    addGuidance(
      suggestions,
      profileKey,
      'Manufacturing oversight defaults',
      buildReason(context, 'Supports audit and compliance readiness.'),
      { strictness: 'strict', reviewFrequency: 'monthly', documentationDepth: 'high' }
    );
    addGuidance(
      suggestions,
      profileKey,
      'Process optimization cadence',
      buildReason(context, 'Improves long-term throughput and quality.'),
      { reviewFrequency: 'monthly', maturityFocus: 'continuous-improvement' }
    );
  }

  if (isGovernment) {
    addStandards(
      suggestions,
      profileKey,
      'Public governance requirements',
      buildReason(context, 'Ensures transparency and accountability.'),
      ['Public governance requirements']
    );
    addStandards(
      suggestions,
      profileKey,
      'Records retention standards',
      buildReason(context, 'Supports compliance with record keeping.'),
      ['Records retention standards']
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Policy and guideline library',
      buildReason(context, 'Defines official procedures and expectations.'),
      ['policy', 'guideline'],
      'DOCUMENT_TYPES'
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Approval and escalation workflows',
      buildReason(context, 'Ensures decisions follow governance steps.'),
      ['workflow'],
      'WORKFLOWS'
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Compliance and audit checklists',
      buildReason(context, 'Supports periodic reviews.'),
      ['checklist'],
      'CHECKLISTS_FORMS'
    );
    addGlossary(
      suggestions,
      profileKey,
      'Public accountability',
      buildReason(context, 'Public sector terminology.'),
      { 'Public accountability': 'Responsibility to justify actions and decisions to the public.' }
    );
    addGuidance(
      suggestions,
      profileKey,
      'Government oversight defaults',
      buildReason(context, 'Supports strict compliance requirements.'),
      { strictness: 'strict', reviewFrequency: 'semiannual', documentationDepth: 'high' }
    );
    addGuidance(
      suggestions,
      profileKey,
      'Public service improvement cycle',
      buildReason(context, 'Drives continuous service enhancements.'),
      { reviewFrequency: 'quarterly', maturityFocus: 'continuous-improvement' }
    );
  }

  if (isEducation) {
    addStandards(
      suggestions,
      profileKey,
      'Academic governance standards',
      buildReason(context, 'Supports consistent educational quality.'),
      ['Academic governance standards']
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Academic policies and guidelines',
      buildReason(context, 'Sets curriculum and conduct expectations.'),
      ['policy', 'guideline'],
      'DOCUMENT_TYPES'
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Curriculum approval workflow',
      buildReason(context, 'Ensures structured academic changes.'),
      ['workflow'],
      'WORKFLOWS'
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Academic checklists and forms',
      buildReason(context, 'Supports audits and assessments.'),
      ['checklist', 'form'],
      'CHECKLISTS_FORMS'
    );
    addGlossary(
      suggestions,
      profileKey,
      'Academic integrity',
      buildReason(context, 'Education terminology.'),
      { 'Academic integrity': 'Commitment to honesty and responsibility in scholarship.' }
    );
    addGuidance(
      suggestions,
      profileKey,
      'Education governance defaults',
      buildReason(context, 'Balances quality and flexibility.'),
      { strictness: 'balanced', reviewFrequency: 'annual', documentationDepth: 'medium' }
    );
    addGuidance(
      suggestions,
      profileKey,
      'Academic improvement cycle',
      buildReason(context, 'Sustains program excellence and growth.'),
      { reviewFrequency: 'semester', maturityFocus: 'continuous-improvement' }
    );
  }

  if (isFinance) {
    addStandards(
      suggestions,
      profileKey,
      'Financial regulatory requirements',
      buildReason(context, 'Supports compliance and risk management.'),
      ['Financial regulatory requirements']
    );
    addStandards(
      suggestions,
      profileKey,
      'Information security standards',
      buildReason(context, 'Protects sensitive financial data.'),
      ['ISO 27001']
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Risk and compliance policies',
      buildReason(context, 'Defines risk controls and obligations.'),
      ['policy', 'sop'],
      'DOCUMENT_TYPES'
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'KYC onboarding workflow',
      buildReason(context, 'Ensures customer verification.'),
      ['workflow'],
      'WORKFLOWS'
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Compliance checklists and forms',
      buildReason(context, 'Supports audit readiness.'),
      ['checklist', 'form'],
      'CHECKLISTS_FORMS'
    );
    addGlossary(
      suggestions,
      profileKey,
      'KYC',
      buildReason(context, 'Financial services terminology.'),
      { KYC: 'Know Your Customer processes used for identity verification.' }
    );
    addGlossary(
      suggestions,
      profileKey,
      'AML',
      buildReason(context, 'Regulatory terminology.'),
      { AML: 'Anti-Money Laundering controls for monitoring financial activity.' }
    );
    addGuidance(
      suggestions,
      profileKey,
      'Financial compliance defaults',
      buildReason(context, 'Reinforces strict compliance requirements.'),
      { strictness: 'strict', reviewFrequency: 'quarterly', documentationDepth: 'high' }
    );
    addGuidance(
      suggestions,
      profileKey,
      'Risk maturity roadmap',
      buildReason(context, 'Prepares for scaling and advanced oversight.'),
      { reviewFrequency: 'quarterly', maturityFocus: 'advanced-readiness' }
    );
  }

  if (isLogistics) {
    addStandards(
      suggestions,
      profileKey,
      'Transportation and safety standards',
      buildReason(context, 'Supports safe logistics operations.'),
      ['Transportation safety standards']
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Operations SOPs and workflows',
      buildReason(context, 'Standardizes handling and routing.'),
      ['sop', 'workflow'],
      'DOCUMENT_TYPES'
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Incident response workflow',
      buildReason(context, 'Supports rapid response and escalation.'),
      ['workflow'],
      'WORKFLOWS'
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Daily operations checklists',
      buildReason(context, 'Ensures readiness and compliance.'),
      ['checklist'],
      'CHECKLISTS_FORMS'
    );
    addGlossary(
      suggestions,
      profileKey,
      'Chain of custody',
      buildReason(context, 'Logistics terminology.'),
      { 'Chain of custody': 'Documented process tracking custody of items throughout transport.' }
    );
    addGuidance(
      suggestions,
      profileKey,
      'Logistics oversight defaults',
      buildReason(context, 'Improves operational consistency.'),
      { strictness: 'balanced', reviewFrequency: 'monthly', documentationDepth: 'medium' }
    );
    addGuidance(
      suggestions,
      profileKey,
      'Network expansion readiness',
      buildReason(context, 'Supports growth across routes and sites.'),
      { reviewFrequency: 'quarterly', maturityFocus: 'expansion-readiness' }
    );
  }

  if (isEnergy) {
    addStandards(
      suggestions,
      profileKey,
      'Environmental compliance standards',
      buildReason(context, 'Supports safe and compliant operations.'),
      ['ISO 14001']
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Permit-to-work workflow',
      buildReason(context, 'Ensures controlled operational activities.'),
      ['workflow'],
      'WORKFLOWS'
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Safety inspection checklists',
      buildReason(context, 'Maintains safety readiness.'),
      ['checklist'],
      'CHECKLISTS_FORMS'
    );
    addGlossary(
      suggestions,
      profileKey,
      'Lockout/tagout',
      buildReason(context, 'Energy sector terminology.'),
      { 'Lockout/tagout': 'Procedure to ensure equipment is isolated before maintenance.' }
    );
    addGuidance(
      suggestions,
      profileKey,
      'Energy operations defaults',
      buildReason(context, 'Supports safety-critical operations.'),
      { strictness: 'strict', reviewFrequency: 'monthly', documentationDepth: 'high' }
    );
    addGuidance(
      suggestions,
      profileKey,
      'Asset lifecycle optimization',
      buildReason(context, 'Improves long-term reliability and scalability.'),
      { reviewFrequency: 'quarterly', maturityFocus: 'asset-optimization' }
    );
  }

  if (isRetail) {
    addStandards(
      suggestions,
      profileKey,
      'Consumer protection standards',
      buildReason(context, 'Supports customer-facing compliance.'),
      ['Consumer protection standards']
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Store policies and SOPs',
      buildReason(context, 'Improves front-line consistency.'),
      ['policy', 'sop'],
      'DOCUMENT_TYPES'
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Customer complaint workflow',
      buildReason(context, 'Supports escalation and resolution.'),
      ['workflow'],
      'WORKFLOWS'
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Daily operations checklists',
      buildReason(context, 'Ensures readiness and quality.'),
      ['checklist'],
      'CHECKLISTS_FORMS'
    );
    addGlossary(
      suggestions,
      profileKey,
      'Service recovery',
      buildReason(context, 'Retail and hospitality terminology.'),
      { 'Service recovery': 'Actions taken to resolve customer issues and restore satisfaction.' }
    );
    addGuidance(
      suggestions,
      profileKey,
      'Retail operations defaults',
      buildReason(context, 'Balances speed and compliance.'),
      { strictness: 'balanced', reviewFrequency: 'quarterly', documentationDepth: 'medium' }
    );
    addGuidance(
      suggestions,
      profileKey,
      'Customer experience maturity',
      buildReason(context, 'Supports long-term service excellence.'),
      { reviewFrequency: 'quarterly', maturityFocus: 'experience-maturity' }
    );
  }

  if (suggestions.length === 0) {
    addStandards(
      suggestions,
      profileKey,
      'Core compliance standards',
      buildReason(context, 'Baseline governance and operational readiness.'),
      ['Core compliance standards']
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Core policy and SOP set',
      buildReason(context, 'Establishes foundational governance.'),
      ['policy', 'sop'],
      'DOCUMENT_TYPES'
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Operational approval workflow',
      buildReason(context, 'Ensures controlled execution.'),
      ['workflow'],
      'WORKFLOWS'
    );
    addRequiredDocs(
      suggestions,
      profileKey,
      'Operational readiness checklists',
      buildReason(context, 'Supports routine controls.'),
      ['checklist'],
      'CHECKLISTS_FORMS'
    );
    addGlossary(
      suggestions,
      profileKey,
      'Operational risk',
      buildReason(context, 'Baseline governance terminology.'),
      { 'Operational risk': 'Risk of loss from inadequate or failed processes and systems.' }
    );
    addGuidance(
      suggestions,
      profileKey,
      'General governance defaults',
      buildReason(context, 'Suitable for new organization types.'),
      { strictness: 'balanced', reviewFrequency: 'annual', documentationDepth: 'medium' }
    );
    addGuidance(
      suggestions,
      profileKey,
      'Operational maturity roadmap',
      buildReason(context, 'Supports long-term excellence growth.'),
      { reviewFrequency: 'quarterly', maturityFocus: 'advanced-readiness' }
    );
  }

  const inferLayer = (suggestion: OverlaySuggestion): OverlayLayer => {
    const title = suggestion.title.toLowerCase();
    const category = suggestion.payload?.category || '';
    if (
      title.includes('regulation') ||
      title.includes('safety') ||
      title.includes('confidential') ||
      title.includes('data protection') ||
      title.includes('incident') ||
      title.includes('patient safety')
    ) {
      return 'FOUNDATION';
    }
    if (
      title.includes('quality management') ||
      title.includes('governance') ||
      title.includes('risk management') ||
      title.includes('audit readiness') ||
      title.includes('document control') ||
      title.includes('compliance')
    ) {
      return 'ACCREDITATION_READY';
    }
    if (
      title.includes('continuous improvement') ||
      title.includes('maturity') ||
      title.includes('expansion') ||
      title.includes('multi-site') ||
      title.includes('analytics') ||
      title.includes('optimization') ||
      title.includes('roadmap')
    ) {
      return 'ADVANCED_MATURITY';
    }
    if (category === 'WORKFLOWS' || category === 'CHECKLISTS_FORMS') {
      return title.includes('incident') ? 'FOUNDATION' : 'OPERATIONAL_EXCELLENCE';
    }
    return 'OPERATIONAL_EXCELLENCE';
  };

  const enhancedSuggestions = suggestions.map((suggestion) => ({
    ...suggestion,
    payload: {
      ...suggestion.payload,
      derivedFrom,
      layer: suggestion.payload?.layer || inferLayer(suggestion),
      completeness: 'operational-excellence',
    },
  }));

  const idCounts = new Map<string, number>();
  const uniqueSuggestions = enhancedSuggestions.map((suggestion) => {
    const baseId = suggestion.id;
    const nextCount = (idCounts.get(baseId) || 0) + 1;
    idCounts.set(baseId, nextCount);
    return nextCount === 1
      ? suggestion
      : { ...suggestion, id: `${baseId}-${nextCount}` };
  });

  const knownOrgTypes = [
    'hospital',
    'clinic',
    'factory',
    'government',
    'school',
    'university',
    'airport',
    'bank',
    'insurance',
    'logistics',
    'energy',
    'retail',
    'hotel',
  ];
  const isDraft = orgTypeName ? !knownOrgTypes.some((type) => orgType.includes(type)) : true;

  return { suggestions: uniqueSuggestions, isDraft };
}
