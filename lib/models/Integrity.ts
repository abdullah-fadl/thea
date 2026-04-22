export type IntegrityRunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type IntegrityFindingStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'IGNORED';

export type IntegrityFindingSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface IntegrityRun {
  id: string;
  tenantId: string;
  runKey?: string;
  status: IntegrityRunStatus;
  type: 'issues' | 'conflicts';
  mode?: 'quick_review' | 'operational';
  engineConfig?: {
    analysisTypes?: string[];
    compareMode?: string;
    profile?: string;
    layers?: string[];
    query?: string;
  };
  query?: string;
  documentIds?: string[];
  collections?: string[];
  scope?: {
    mode?: 'selection' | 'filters' | 'collection';
    type: 'selection' | 'filter' | 'all';
    filters?: Record<string, any>;
  };
  analysisId?: string | null;
  jobId?: string | null;
  progress?: {
    percent: number;
    step?: string;
    message?: string;
  };
  orgProfileSnapshot?: Record<string, any>;
  contextRulesSnapshot?: Record<string, any>;
  startedAt?: Date;
  completedAt?: Date;
  error?: string | null;
  summary?: {
    findingsTotal: number;
    openCount: number;
    inReviewCount: number;
    resolvedCount: number;
    ignoredCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrityEvidence {
  documentId: string;
  filename?: string;
  page?: number | null;
  chunkId?: string | null;
  quote?: string;
}

export interface IntegrityFinding {
  id: string;
  tenantId: string;
  runId: string;
  status: IntegrityFindingStatus;
  ownerName?: string | null;
  dueDate?: Date | null;
  slaDays?: number | null;
  type: string;
  severity: IntegrityFindingSeverity | string;
  title: string;
  summary: string;
  recommendation?: string;
  documentIds: string[];
  evidence: IntegrityEvidence[];
  dedupeKey: string;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrityActivity {
  id: string;
  tenantId: string;
  findingId?: string;
  runId?: string;
  type: 'STATUS_CHANGE' | 'APPLIED' | 'COMMENT';
  message?: string;
  createdBy?: string;
  createdAt: Date;
}
