export type OrganizationMaturityStage = 'New' | 'Operating' | 'Mature';
export type OrganizationOnboardingPhase = 'Foundation' | 'Core' | 'Expansion';
export type OrganizationRiskProfile = 'Low' | 'Medium' | 'High' | 'Critical';

export interface OrganizationProfile {
  id: string;
  tenantId: string;
  organizationName: string;
  organizationType: string;
  maturityStage: OrganizationMaturityStage;
  isPartOfGroup: boolean;
  groupId?: string | null;
  selectedStandards: string[];
  onboardingPhase: OrganizationOnboardingPhase;
  riskProfile: OrganizationRiskProfile;
  primaryFocus: string[];
  createdAt: Date;
  updatedAt: Date;
}
