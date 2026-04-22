import { ORGANIZATION_TYPE_CATALOG } from '@/lib/organization/catalog';
import type {
  OrganizationMaturityStage,
  OrganizationOnboardingPhase,
  OrganizationRiskProfile,
  OrganizationProfile,
} from '@/lib/models/OrganizationProfile';

export const MATURITY_STAGES: OrganizationMaturityStage[] = ['New', 'Operating', 'Mature'];
export const ONBOARDING_PHASES: OrganizationOnboardingPhase[] = ['Foundation', 'Core', 'Expansion'];
export const RISK_PROFILES: OrganizationRiskProfile[] = ['Low', 'Medium', 'High', 'Critical'];

export const KNOWN_STANDARDS: string[] = [
  'Healthcare compliance standards',
  'Academic governance standards',
  'Transportation safety standards',
  'Consumer protection standards',
  'Occupational safety standards',
  'Information security standards',
  'Service continuity standards',
  'Public governance requirements',
  'Financial regulatory requirements',
  'Records retention standards',
  'Core compliance standards',
  'Quality management standards',
  'Safety and quality standards',
  'Environmental compliance standards',
  'ISO 9001',
  'ISO 14001',
  'ISO 27001',
  'ISO 45001',
  'SOC 2',
  'HIPAA',
  'GDPR',
];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();

const KNOWN_STANDARD_MAP = new Map(
  KNOWN_STANDARDS.map((standard) => [normalizeKey(standard), standard])
);

const normalizeCustomStandard = (value: string) => {
  const cleaned = value.trim().replace(/\s+/g, ' ');
  const words = cleaned.split(' ').filter(Boolean);
  return words
    .map((word) => {
      if (/^[A-Z0-9-]+$/.test(word)) return word;
      if (word.length <= 3 && word === word.toUpperCase()) return word;
      if (/^\d/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

export function normalizeOrganizationType(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'unknown';

  const lower = trimmed.toLowerCase();
  if (lower === 'other') {
    return 'unknown';
  }
  if (lower.startsWith('other')) {
    const extracted = trimmed.replace(/^other[:\-\s(]+/i, '').replace(/\)$/g, '').trim();
    if (extracted) {
      return slugify(extracted);
    }
    return 'unknown';
  }

  const directMatch = ORGANIZATION_TYPE_CATALOG.find(
    (item) => item.orgTypeId.toLowerCase() === trimmed.toLowerCase()
  );
  if (directMatch) {
    return directMatch.orgTypeId;
  }

  const nameMatch = ORGANIZATION_TYPE_CATALOG.find(
    (item) => item.displayName.toLowerCase() === trimmed.toLowerCase()
  );
  if (nameMatch) {
    return nameMatch.orgTypeId;
  }

  return slugify(trimmed) || 'unknown';
}

export function getOrganizationTypeLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'unknown') {
    return 'Unspecified';
  }
  const directMatch = ORGANIZATION_TYPE_CATALOG.find((item) => item.orgTypeId === trimmed);
  if (directMatch) {
    return directMatch.displayName;
  }
  return trimmed
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function normalizeStandards(values: string[]): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  values.forEach((value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const knownMatch = KNOWN_STANDARD_MAP.get(normalizeKey(trimmed));
    const normalized = knownMatch || normalizeCustomStandard(trimmed);
    const dedupeKey = normalizeKey(normalized);
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    output.push(normalized);
  });
  return output;
}

export function deriveRiskProfile(input: {
  maturityStage: OrganizationMaturityStage;
  onboardingPhase: OrganizationOnboardingPhase;
}): OrganizationRiskProfile {
  if (input.maturityStage === 'New') {
    return input.onboardingPhase === 'Expansion' ? 'Medium' : 'High';
  }
  if (input.maturityStage === 'Operating') {
    return input.onboardingPhase === 'Expansion' ? 'Low' : 'Medium';
  }
  return input.onboardingPhase === 'Foundation' ? 'Medium' : 'Low';
}

export function buildDefaultOrganizationProfile(input: {
  tenantId: string;
  organizationName: string;
}): OrganizationProfile {
  const now = new Date();
  const onboardingPhase: OrganizationOnboardingPhase = 'Foundation';
  const maturityStage: OrganizationMaturityStage = 'New';

  return {
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    organizationName: input.organizationName || 'Organization',
    organizationType: 'unknown',
    maturityStage,
    isPartOfGroup: false,
    groupId: null,
    selectedStandards: [],
    onboardingPhase,
    riskProfile: deriveRiskProfile({ maturityStage, onboardingPhase }),
    primaryFocus: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function isOrgProfileSetupComplete(profile: OrganizationProfile): boolean {
  if (!profile.organizationType || profile.organizationType === 'unknown') {
    return false;
  }
  if (!profile.maturityStage) {
    return false;
  }
  if (profile.isPartOfGroup && !profile.groupId) {
    return false;
  }
  return true;
}
