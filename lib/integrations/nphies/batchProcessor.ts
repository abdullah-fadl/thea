// =============================================================================
// NPHIES Batch Processor — Bulk Operations with Concurrency Control
// =============================================================================

import { checkEligibility } from './eligibility';
import { submitClaim } from './claims';
import { requestPriorAuthorization } from './priorAuth';
import { nphiesConfig } from './config';
import { logger } from '@/lib/monitoring/logger';
import { v4 as uuidv4 } from 'uuid';
import type {
  NphiesEligibilityRequest,
  NphiesEligibilityResponse,
  NphiesClaimRequest,
  NphiesClaimResponse,
  NphiesPriorAuthRequest,
  NphiesPriorAuthResponse,
} from './types';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface BatchProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
}

export interface BatchItemResult {
  index: number;
  success: boolean;
  response?: unknown;
  error?: string;
  errorAr?: string;
}

export interface BatchJob {
  id: string;
  tenantId: string;
  type: 'eligibility' | 'claim' | 'prior-auth';
  items: unknown[];
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: BatchProgress;
  results: BatchItemResult[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdBy: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// In-memory Job Store (per-process)
// ---------------------------------------------------------------------------

const jobStore = new Map<string, BatchJob>();

const MAX_STORED_JOBS = 200;
const JOB_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function pruneExpiredJobs(): void {
  const now = Date.now();
  for (const [id, job] of jobStore) {
    const createdMs = job.createdAt.getTime();
    if (now - createdMs > JOB_TTL_MS) {
      jobStore.delete(id);
    }
  }
  // If still over limit, remove oldest completed jobs first
  if (jobStore.size > MAX_STORED_JOBS) {
    const sorted = Array.from(jobStore.entries())
      .filter(([, j]) => j.status === 'completed' || j.status === 'failed')
      .sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime());
    for (const [id] of sorted) {
      jobStore.delete(id);
      if (jobStore.size <= MAX_STORED_JOBS) break;
    }
  }
}

// ---------------------------------------------------------------------------
// Create Batch Job
// ---------------------------------------------------------------------------

export function createBatchJob(
  tenantId: string,
  type: BatchJob['type'],
  items: unknown[],
  createdBy: string,
): BatchJob {
  pruneExpiredJobs();

  const job: BatchJob = {
    id: `batch_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
    tenantId,
    type,
    items,
    status: 'queued',
    progress: {
      total: items.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
    },
    results: [],
    createdAt: new Date(),
    createdBy,
  };

  jobStore.set(job.id, job);

  logger.info('NPHIES batch job created', {
    category: 'billing',
    jobId: job.id,
    type,
    itemCount: items.length,
    tenantId,
  });

  return job;
}

// ---------------------------------------------------------------------------
// Process Batch Job
// ---------------------------------------------------------------------------

/**
 * Processes a batch job with a concurrency limit.
 * Items are processed in windows of `concurrency` size using Promise.allSettled.
 *
 * @param job        The batch job to process
 * @param concurrency  Maximum parallel requests (default: 3, max: 10)
 * @returns The completed batch job with results
 */
export async function processBatch(
  job: BatchJob,
  concurrency: number = 3,
): Promise<BatchJob> {
  nphiesConfig.validate();

  const effectiveConcurrency = Math.max(1, Math.min(concurrency, 10));

  job.status = 'processing';
  job.startedAt = new Date();
  jobStore.set(job.id, job);

  logger.info('NPHIES batch processing started', {
    category: 'billing',
    jobId: job.id,
    type: job.type,
    itemCount: job.items.length,
    concurrency: effectiveConcurrency,
  });

  try {
    for (let i = 0; i < job.items.length; i += effectiveConcurrency) {
      const window = job.items.slice(i, i + effectiveConcurrency);

      const settled = await Promise.allSettled(
        window.map((item, windowIndex) =>
          processItem(job.type, item, i + windowIndex),
        ),
      );

      for (let j = 0; j < settled.length; j++) {
        const batchIndex = i + j;
        const result = settled[j];

        if (result.status === 'fulfilled') {
          job.results.push(result.value);
          if (result.value.success) {
            job.progress.succeeded++;
          } else {
            job.progress.failed++;
          }
        } else {
          const errorMsg =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);
          job.results.push({
            index: batchIndex,
            success: false,
            error: errorMsg,
            errorAr: 'فشل معالجة العنصر',
          });
          job.progress.failed++;
        }

        job.progress.processed++;
      }

      // Update in store after each window
      jobStore.set(job.id, job);
    }

    job.status = 'completed';
    job.completedAt = new Date();
  } catch (err) {
    job.status = 'failed';
    job.completedAt = new Date();
    job.error =
      err instanceof Error ? err.message : 'Batch processing failed';

    logger.error('NPHIES batch processing failed', {
      category: 'billing',
      jobId: job.id,
      error: err,
    });
  }

  jobStore.set(job.id, job);

  logger.info('NPHIES batch processing finished', {
    category: 'billing',
    jobId: job.id,
    status: job.status,
    total: job.progress.total,
    succeeded: job.progress.succeeded,
    failed: job.progress.failed,
    durationMs: job.completedAt
      ? job.completedAt.getTime() - (job.startedAt?.getTime() || job.createdAt.getTime())
      : undefined,
  });

  return job;
}

// ---------------------------------------------------------------------------
// Get Batch Progress
// ---------------------------------------------------------------------------

export function getBatchProgress(jobId: string): BatchJob | null {
  return jobStore.get(jobId) || null;
}

// ---------------------------------------------------------------------------
// List Batch Jobs for Tenant
// ---------------------------------------------------------------------------

export function listBatchJobs(tenantId: string): BatchJob[] {
  const jobs: BatchJob[] = [];
  for (const job of jobStore.values()) {
    if (job.tenantId === tenantId) {
      jobs.push(job);
    }
  }
  return jobs.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

// ---------------------------------------------------------------------------
// Process Individual Item
// ---------------------------------------------------------------------------

async function processItem(
  type: BatchJob['type'],
  item: unknown,
  index: number,
): Promise<BatchItemResult> {
  try {
    switch (type) {
      case 'eligibility': {
        const response = await checkEligibility(
          item as NphiesEligibilityRequest,
        );
        return {
          index,
          success: response.eligible,
          response,
        };
      }

      case 'claim': {
        const response = await submitClaim(item as NphiesClaimRequest);
        return {
          index,
          success: response.accepted,
          response,
        };
      }

      case 'prior-auth': {
        const response = await requestPriorAuthorization(
          item as NphiesPriorAuthRequest,
        );
        return {
          index,
          success: response.approved,
          response,
        };
      }

      default:
        return {
          index,
          success: false,
          error: `Unsupported batch type: ${type}`,
          errorAr: `نوع دفعة غير مدعوم: ${type}`,
        };
    }
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : 'Item processing failed';
    return {
      index,
      success: false,
      error: errorMsg,
      errorAr: 'فشل معالجة العنصر',
    };
  }
}
