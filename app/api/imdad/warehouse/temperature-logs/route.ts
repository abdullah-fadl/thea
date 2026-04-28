/**
 * SCM BC2 Warehouse — Temperature Logs
 *
 * GET  /api/imdad/warehouse/temperature-logs — List temperature log entries
 * POST /api/imdad/warehouse/temperature-logs — Create temperature log entry (IoT sensor data)
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List temperature logs
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
      const organizationId = url.searchParams.get('organizationId') || undefined;
      const zoneId = url.searchParams.get('zoneId') || undefined;
      const isOutOfRange = url.searchParams.get('isOutOfRange');
      const from = url.searchParams.get('from') || undefined;
      const to = url.searchParams.get('to') || undefined;

      const where: any = { tenantId };

      if (organizationId) where.organizationId = organizationId;
      if (zoneId) where.zoneId = zoneId;
      if (isOutOfRange !== null && isOutOfRange !== undefined) {
        where.isOutOfRange = isOutOfRange === 'true';
      }

      if (from || to) {
        where.recordedAt = {};
        if (from) where.recordedAt.gte = new Date(from);
        if (to) where.recordedAt.lte = new Date(to);
      }

      const [data, total] = await Promise.all([
        prisma.imdadTemperatureLog.findMany({
          where,
          orderBy: { recordedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadTemperatureLog.count({ where }),
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
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.view' }
);

// ---------------------------------------------------------------------------
// POST — Create temperature log entry (append-only, no version field)
// ---------------------------------------------------------------------------

const createTempLogSchema = z.object({
  zoneId: z.string().uuid('zoneId must be a valid UUID'),
  organizationId: z.string().uuid('organizationId must be a valid UUID'),
  temperature: z.number(),
  humidity: z.number().optional(),
  recordedAt: z.string().min(1, 'recordedAt is required'),
  sensorId: z.string().optional(),
  isOutOfRange: z.boolean().optional(),
  minThreshold: z.number().optional(),
  maxThreshold: z.number().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createTempLogSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const data = parsed.data;

      // Auto-detect out-of-range if thresholds provided
      let isOutOfRange = data.isOutOfRange;
      if (isOutOfRange === undefined && data.minThreshold !== undefined && data.maxThreshold !== undefined) {
        isOutOfRange = data.temperature < data.minThreshold || data.temperature > data.maxThreshold;
      }

      const entry = await prisma.imdadTemperatureLog.create({
        data: {
          tenantId,
          organizationId: data.organizationId,
          zoneId: data.zoneId,
          temperature: data.temperature,
          humidity: data.humidity,
          recordedAt: new Date(data.recordedAt),
          sensorId: data.sensorId,
          isOutOfRange: isOutOfRange ?? false,
          metadata: data.metadata ?? undefined,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: data.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'TEMPERATURE_LOG',
        resourceId: entry.id,
        boundedContext: 'BC2_WAREHOUSE',
        newData: entry as any,
        request: req,
      });

      return NextResponse.json({ data: entry }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.temperature.create' }
);
