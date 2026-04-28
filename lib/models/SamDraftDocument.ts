export type SamDraftDocumentType = 'policy' | 'sop' | 'workflow';

export type SamDraftDocumentVersion = {
  version: number;
  content: string;
  createdAt: Date;
  createdBy: string;
  model?: string;
  promptHash?: string;
  inputs?: Record<string, any>;
};

export interface SamDraftDocument {
  id: string;
  tenantId: string;

  status: 'draft' | 'published';
  documentType: SamDraftDocumentType;

  title: string;
  departmentId?: string | null;
  operationId?: string | null;
  requiredType?: 'Policy' | 'SOP' | 'Workflow';

  latestContent: string;
  latestVersion: number;
  versions: SamDraftDocumentVersion[];

  reuseSource?: {
    groupId: string;
    groupDocumentId: string;
    adaptationNotes?: string;
  };

  orgProfileSnapshot?: Record<string, any>;
  contextRulesSnapshot?: Record<string, any>;

  publishedTheaEngineId?: string | null;
  publishedAt?: Date | null;
  publishedBy?: string | null;

  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}
