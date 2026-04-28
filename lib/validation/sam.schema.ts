import { z } from 'zod';

// ─── Bulk Action Types ───────────────────────────────────
export const samBulkActionEnum = z.enum([
  'delete', 'archive', 'unarchive',
  'reassign-departments', 'mark-global', 'mark-shared',
]);

// ─── Bulk Action ─────────────────────────────────────────
export const samBulkActionSchema = z.object({
  action: samBulkActionEnum,
  theaEngineIds: z.array(z.string().min(1)).min(1, 'At least one ID is required'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ─── Draft Version ───────────────────────────────────────
export const createDraftVersionSchema = z.object({
  content: z.string().min(1, 'content is required'),
  message: z.string().optional(),
});

// ─── Integrity Finding Apply ─────────────────────────────
export const integrityFindingApplySchema = z.object({
  confirm: z.boolean(),
});

// ─── AI Harmonize ────────────────────────────────────────
export const aiHarmonizeSchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1, 'At least one document ID is required'),
  topicQuery: z.string().optional(),
});

// ─── AI Policy Assistant ─────────────────────────────────
export const aiPolicyAssistantSchema = z.object({
  question: z.string().min(1, 'question is required'),
});

// ─── Risk Detector Run ───────────────────────────────────
export const riskDetectorRunSchema = z.object({
  departmentId: z.string().min(1, 'departmentId is required'),
  setting: z.enum(['IPD', 'OPD', 'Corporate', 'Shared']),
  practiceIds: z.array(z.string()).optional(),
});

// ─── Queue Action ────────────────────────────────────────
export const queueActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'escalate']),
  itemId: z.string().min(1, 'itemId is required'),
  reason: z.string().optional(),
});

// ─── SAM Org Profile ─────────────────────────────────────
export const samOrgProfileSchema = z.object({
  orgName: z.string().optional(),
  sector: z.string().optional(),
  departments: z.array(z.string()).optional(),
}).passthrough();

// ─── Policy Upload Metadata ──────────────────────────────
export const policyUpdateMetadataSchema = z.object({
  title: z.string().optional(),
  category: z.string().optional(),
  departments: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  status: z.string().optional(),
}).passthrough();

// ─── AI Create Policy ────────────────────────────────────
export const aiCreatePolicySchema = z.object({
  title: z.string().min(1, 'title is required'),
  category: z.string().optional(),
  context: z.string().optional(),
  departments: z.array(z.string()).optional(),
}).passthrough();

// ─── AI Summarize ────────────────────────────────────────
export const aiSummarizeSchema = z.object({
  documentId: z.string().min(1, 'documentId is required'),
  format: z.enum(['brief', 'detailed']).optional().default('brief'),
});

// ─── Practice CRUD ───────────────────────────────────────
export const createPracticeSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  riskDomainId: z.string().optional(),
  functionId: z.string().optional(),
  operationId: z.string().optional(),
  setting: z.string().optional(),
}).passthrough();

export const updatePracticeSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  riskDomainId: z.string().optional(),
  functionId: z.string().optional(),
  operationId: z.string().optional(),
  setting: z.string().optional(),
}).passthrough();
