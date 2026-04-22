/**
 * SCM Admin: Background Jobs API
 *
 * GET  /api/imdad/admin/jobs — List job registry + recent executions
 * POST /api/imdad/admin/jobs — Trigger a specific job manually
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { IMDAD_JOB_REGISTRY } from '@/lib/imdad/jobs';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET: List all registered jobs with their last execution status
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    const url = new URL(req.url);
    const category = url.searchParams.get('category');

    // Get recent job executions
    const recentExecutions = await prisma.imdadJobExecution.findMany({
      where: { tenantId, isDeleted: false },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    // Build registry with last execution info
    const jobs = IMDAD_JOB_REGISTRY.filter((j) => !category || j.category === category).map(
      (job) => {
        const lastExecution = recentExecutions.find((e) => e.jobName === job.name);
        return {
          name: job.name,
          description: job.description,
          descriptionAr: job.descriptionAr,
          cronExpression: job.cronExpression,
          isEnabled: job.isEnabled,
          category: job.category,
          lastExecution: lastExecution
            ? {
                id: lastExecution.id,
                status: lastExecution.status,
                startedAt: lastExecution.startedAt,
                completedAt: lastExecution.completedAt,
                result: lastExecution.resultSummary,
                errorMessage: lastExecution.errorMessage,
              }
            : null,
        };
      }
    );

    return NextResponse.json({ data: jobs, total: jobs.length });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.admin.view' }
);

// POST: Trigger a specific job manually
const triggerJobSchema = z.object({
  jobName: z.string(),
  organizationId: z.string().uuid(),
  parameters: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    const body = await req.json();
    const parsed = triggerJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { jobName, organizationId, parameters } = parsed.data;

    // Find job in registry
    const jobDef = IMDAD_JOB_REGISTRY.find((j) => j.name === jobName);
    if (!jobDef) {
      return NextResponse.json({ error: 'Job not found', jobName }, { status: 404 });
    }

    // Run job
    try {
      const result = await jobDef.handler({
        tenantId,
        organizationId,
        userId,
        ...parameters,
      });

      await imdadAudit.log({
        tenantId,
        actorUserId: userId,
        action: 'CREATE',
        resourceType: 'JOB_EXECUTION',
        resourceId: jobName,
        metadata: { triggeredManually: true, result },
      });

      return NextResponse.json({ success: true, jobName, result });
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Job execution failed',
          jobName,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.admin.jobs.execute' }
);
