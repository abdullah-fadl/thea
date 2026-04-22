/**
 * Policy Alert Model
 */
export interface PolicyAlert {
  id: string; // UUID
  tenantId: string;
  eventId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  recommendations: string[];
  policyIds: string[];
  evidence: Array<{
    policyId: string;
    policyTitle: string;
    snippet: string;
    relevance: number;
  }>;
  trace?: {
    eventId: string;
    engineCallId?: string;
    checkedAt: Date;
    processingTimeMs: number;
  };
  createdAt: Date;
  updatedAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  status?: 'active' | 'acknowledged' | 'resolved';
}
