import type { Db } from '@/lib/cvision/infra/mongo-compat';

/**
 * Lightweight background job queue backed by MongoDB.
 *
 * Production path: swap for BullMQ + Redis when scaling requires it.
 * This implementation stores jobs in `cvision_jobs` and processes
 * them via polling or direct invocation.
 */

const JOBS_COLLECTION = 'cvision_jobs';

/* ── Types ─────────────────────────────────────────────────────────── */

export type JobStatus = 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface Job {
  _id?: any;
  tenantId: string;
  jobId: string;
  queue: string;
  data: any;
  status: JobStatus;
  progress: number;
  result?: any;
  error?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export type ProcessorFn = (job: Job, updateProgress: (pct: number) => Promise<void>) => Promise<any>;

/* ── Registry ──────────────────────────────────────────────────────── */

const processors = new Map<string, ProcessorFn>();

export function registerProcessor(queueName: string, fn: ProcessorFn) {
  processors.set(queueName, fn);
}

/* ── Add Job ───────────────────────────────────────────────────────── */

export async function addJob(
  db: Db, tenantId: string, queue: string, data: any,
  options: { maxAttempts?: number } = {},
): Promise<string> {
  const jobId = `JOB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const doc: Job = {
    tenantId, jobId, queue, data,
    status: 'WAITING', progress: 0,
    attempts: 0, maxAttempts: options.maxAttempts ?? 3,
    createdAt: new Date(),
  };
  await db.collection(JOBS_COLLECTION).insertOne(doc);
  return jobId;
}

/* ── Process Next ──────────────────────────────────────────────────── */

export async function processNextJob(db: Db, queueName: string): Promise<Job | null> {
  const processor = processors.get(queueName);
  if (!processor) return null;

  // Atomically claim the next waiting job
  const result = await db.collection(JOBS_COLLECTION).findOneAndUpdate(
    { queue: queueName, status: 'WAITING' },
    { $set: { status: 'ACTIVE', startedAt: new Date() }, $inc: { attempts: 1 } },
    { sort: { createdAt: 1 }, returnDocument: 'after' },
  );

  const job = result as unknown as Job | null;
  if (!job) return null;

  const updateProgress = async (pct: number) => {
    await db.collection(JOBS_COLLECTION).updateOne(
      { jobId: job.jobId },
      { $set: { progress: Math.min(100, Math.max(0, pct)) } },
    );
  };

  try {
    const jobResult = await processor(job, updateProgress);
    await db.collection(JOBS_COLLECTION).updateOne(
      { jobId: job.jobId },
      { $set: { status: 'COMPLETED', progress: 100, result: jobResult, completedAt: new Date() } },
    );
    return { ...job, status: 'COMPLETED', result: jobResult } as Job;
  } catch (err: any) {
    const newStatus: JobStatus = (job.attempts || 0) >= job.maxAttempts ? 'FAILED' : 'WAITING';
    await db.collection(JOBS_COLLECTION).updateOne(
      { jobId: job.jobId },
      { $set: { status: newStatus, error: err.message } },
    );
    return { ...job, status: newStatus, error: err.message } as Job;
  }
}

/* ── Drain Queue (process all waiting) ─────────────────────────────── */

export async function drainQueue(db: Db, queueName: string, limit = 20): Promise<{ processed: number; succeeded: number; failed: number }> {
  let processed = 0, succeeded = 0, failed = 0;
  while (processed < limit) {
    const result = await processNextJob(db, queueName);
    if (!result) break;
    processed++;
    if (result.status === 'COMPLETED') succeeded++;
    else failed++;
  }
  return { processed, succeeded, failed };
}

/* ── Query Helpers ─────────────────────────────────────────────────── */

export async function getJob(db: Db, jobId: string): Promise<Job | null> {
  return db.collection(JOBS_COLLECTION).findOne({ jobId }) as any;
}

export async function getJobsByQueue(db: Db, tenantId: string, queue: string, status?: JobStatus, limit = 50) {
  const query: any = { tenantId, queue };
  if (status) query.status = status;
  return db.collection(JOBS_COLLECTION).find(query).sort({ createdAt: -1 }).limit(limit).toArray();
}

export async function getQueueStats(db: Db, tenantId: string) {
  const pipeline = [
    { $match: { tenantId } },
    { $group: { _id: { queue: '$queue', status: '$status' }, count: { $sum: 1 } } },
  ];
  const raw = await db.collection(JOBS_COLLECTION).aggregate(pipeline).toArray();

  const stats: Record<string, Record<string, number>> = {};
  for (const r of raw as any[]) {
    const q = r._id.queue;
    if (!stats[q]) stats[q] = {};
    stats[q][r._id.status] = r.count;
  }
  return stats;
}

export async function retryJob(db: Db, jobId: string) {
  return db.collection(JOBS_COLLECTION).updateOne(
    { jobId, status: 'FAILED' },
    { $set: { status: 'WAITING', error: undefined, progress: 0 } },
  );
}

export async function cancelJob(db: Db, jobId: string) {
  return db.collection(JOBS_COLLECTION).updateOne(
    { jobId, status: 'WAITING' },
    { $set: { status: 'CANCELLED' } },
  );
}

/* ── Pre-registered Processor Stubs ────────────────────────────────── */

registerProcessor('email', async (job, updateProgress) => {
  await updateProgress(50);
  // In production: send via SMTP / SES / SendGrid
  await updateProgress(100);
  return { sent: true, to: job.data.to };
});

registerProcessor('pdf', async (job, updateProgress) => {
  await updateProgress(30);
  // In production: render HTML → PDF
  await updateProgress(100);
  return { generated: true, type: job.data.type };
});

registerProcessor('webhooks', async (job, updateProgress) => {
  const { url, payload, headers } = job.data;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  await updateProgress(100);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { delivered: true, httpStatus: res.status };
});
