import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = req.nextUrl;
      const where: any = { tenantId };
      const status = url.searchParams.get('status');
      const patientId = url.searchParams.get('patientId');
      if (status) where.status = status;
      if (patientId) where.patientId = patientId;
      
      const items = await (prisma as Record<string, any>).erTriageScore.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return NextResponse.json({ items });
    } catch (e) {
      logger.error('[ERTRIAGESCORE GET] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.triage-score.view' }
);

export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const body = await req.json();

      // VAL-02: Validate required fields and score range
      const errors: string[] = [];
      if (!body.patientId || typeof body.patientId !== 'string' || !body.patientId.trim()) {
        errors.push('patientId is required');
      }
      if (!body.encounterId || typeof body.encounterId !== 'string' || !body.encounterId.trim()) {
        errors.push('encounterId is required');
      }
      if (body.score == null || typeof body.score !== 'number' || !Number.isInteger(body.score) || body.score < 1 || body.score > 5) {
        errors.push('score must be an integer between 1 and 5');
      }
      if (!body.category || typeof body.category !== 'string' || !body.category.trim()) {
        errors.push('category is required');
      }
      if (errors.length > 0) {
        return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
      }

      const item = await (prisma as Record<string, any>).erTriageScore.create({
        data: {
          tenantId,
          patientId: String(body.patientId).trim(),
          encounterId: String(body.encounterId).trim(),
          score: body.score,
          category: String(body.category).trim(),
          notes: body.notes ? String(body.notes).trim() : null,
          createdByUserId: userId,
        },
      });
      return NextResponse.json({ item }, { status: 201 });
    } catch (e) {
      logger.error('[ERTRIAGESCORE POST] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.triage-score.edit' }
);
