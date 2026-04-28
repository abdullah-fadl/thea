export type OrganizationTypeStatus = 'ACTIVE' | 'DRAFT_PENDING_REVIEW' | 'REJECTED';

export interface OrganizationType {
  id: string;
  name: string;
  sector: string;
  countryCode?: string | null;
  status: OrganizationTypeStatus;
  createdAt: Date;
  updatedAt: Date;
}
