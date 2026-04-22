export type TenantContextOverlayType =
  | 'ACCREDITATION'
  | 'REQUIRED_DOCS'
  | 'GLOSSARY'
  | 'RULES'
  | 'SUGGESTION_PREFS';

export type TenantContextPackStatus = 'ACTIVE' | 'PENDING_REVIEW';

export interface TenantContextPack {
  id: string;
  tenantId: string;
  orgTypeId: string;
  orgTypeNameSnapshot: string;
  sectorSnapshot: string;
  countryCode?: string | null;
  accreditationSets: any[];
  requiredDocumentTypes: string[];
  baselineOperations?: any[];
  baselineFunctions?: any[];
  baselineRiskDomains?: any[];
  glossary?: Record<string, string>;
  behavior?: Record<string, any>;
  locked: boolean;
  version: number;
  status: TenantContextPackStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantContextOverlay {
  id: string;
  tenantId: string;
  type: TenantContextOverlayType;
  payload: Record<string, any>;
  createdBy?: string;
  createdAt: Date;
}
