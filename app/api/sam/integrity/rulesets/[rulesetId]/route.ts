import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

const updateRulesetSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  categories: z.array(z.any()).optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  async (req, { tenantId }, params) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const rulesetId = String((resolvedParams as Record<string, string>)?.rulesetId || '').trim();
      if (!rulesetId) {
        return NextResponse.json({ error: 'rulesetId is required' }, { status: 400 });
      }

      const ruleset = await prisma.integrityRuleset.findFirst({ where: { tenantId, id: rulesetId } });
      if (!ruleset) {
        return NextResponse.json({ error: 'Ruleset not found' }, { status: 404 });
      }

      return NextResponse.json({ ruleset });
    } catch (error: any) {
      logger.error('Integrity ruleset fetch error', { error });
      // [SEC-06]
      return NextResponse.json(
        { error: 'Failed to fetch ruleset' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.integrity.read' }
);

export const PUT = withAuthTenant(
  async (req, { tenantId, userId }, params) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const rulesetId = String((resolvedParams as Record<string, string>)?.rulesetId || '').trim();
      if (!rulesetId) {
        return NextResponse.json({ error: 'rulesetId is required' }, { status: 400 });
      }
      const body = await req.json();
      const v = validateBody(body, updateRulesetSchema);
      if ('error' in v) return v.error;
      const { name, description, categories } = v.data;

      const updateData: any = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (categories !== undefined) updateData.rules = categories;

      const result = await prisma.integrityRuleset.updateMany({
        where: { tenantId, id: rulesetId },
        data: updateData,
      });
      if (result.count === 0) {
        return NextResponse.json({ error: 'Ruleset not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error: any) {
      logger.error('Integrity ruleset update error', { error });
      return NextResponse.json(
        { error: 'Failed to update ruleset' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.integrity.resolve' }
);

export const DELETE = withAuthTenant(
  async (req, { tenantId }, params) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const rulesetId = String((resolvedParams as Record<string, string>)?.rulesetId || '').trim();
      if (!rulesetId) {
        return NextResponse.json({ error: 'rulesetId is required' }, { status: 400 });
      }

      const result = await prisma.integrityRuleset.deleteMany({ where: { tenantId, id: rulesetId } });
      if (result.count === 0) {
        return NextResponse.json({ error: 'Ruleset not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error: any) {
      logger.error('Integrity ruleset delete error', { error });
      return NextResponse.json(
        { error: 'Failed to delete ruleset' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.integrity.resolve' }
);
