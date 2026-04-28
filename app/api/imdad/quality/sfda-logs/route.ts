/**
 * SCM BC6 Quality — SFDA Integration Logs
 *
 * GET  /api/imdad/quality/sfda-logs — List SFDA integration logs (append-only, no isDeleted filter)
 * POST /api/imdad/quality/sfda-logs — Create a new SFDA log entry (append-only, no version)
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List SFDA integration logs (append-only — NO isDeleted filter)
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
      const organizationId = url.searchParams.get('organizationId') || undefined;
      const requestType = url.searchParams.get('requestType') || undefined;
      const referenceType = url.searchParams.get('referenceType') || undefined;
      const isSuccess = url.searchParams.get('isSuccess');
      const from = url.searchParams.get('from') || undefined;
      const to = url.searchParams.get('to') || undefined;

      // Append-only: no isDeleted filter
      const where: any = { tenantId };

      if (organizationId) where.organizationId = organizationId;
      if (requestType) where.requestType = requestType;
      if (referenceType) where.referenceType = referenceType;
      if (isSuccess !== null && isSuccess !== undefined) {
        where.isSuccess = isSuccess === 'true';
      }

      // Date range filter
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from);
        if (to) where.createdAt.lte = new Date(to);
      }

      const [data, total] = await Promise.all([
        prisma.imdadSfdaIntegrationLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadSfdaIntegrationLog.count({ where }),
      ]);

      return NextResponse.json({
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.integrations.sfda.manage' }
);

// ---------------------------------------------------------------------------
// POST — Create SFDA log entry (append-only — no version field)
// ---------------------------------------------------------------------------

const createSfdaLogSchema = z.object({
  requestType: z.string().min(1, 'requestType is required'),
  organizationId: z.string().min(1, 'organizationId is required'),
  requestPayload: z.record(z.string(), z.any()).optional(),
  responsePayload: z.record(z.string(), z.any()).optional(),
  httpStatusCode: z.number().int().optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  isSuccess: z.boolean().optional(),
  errorMessage: z.string().optional(),
  respondedAt: z.string().datetime().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createSfdaLogSchema.parse(body);

      const log = await prisma.imdadSfdaIntegrationLog.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId,
          requestType: parsed.requestType,
          requestPayload: parsed.requestPayload ?? undefined,
          responsePayload: parsed.responsePayload ?? undefined,
          httpStatusCode: parsed.httpStatusCode,
          referenceType: parsed.referenceType,
          referenceId: parsed.referenceId,
          isSuccess: parsed.isSuccess ?? false,
          errorMessage: parsed.errorMessage,
          respondedAt: parsed.respondedAt ? new Date(parsed.respondedAt) : undefined,
          requestedBy: userId,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: parsed.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'SFDA_LOG',
        resourceId: log.id,
        boundedContext: 'BC6_QUALITY',
        newData: log as any,
        request: req,
      });

      return NextResponse.json({ data: log }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.integrations.sfda.manage' }
);
