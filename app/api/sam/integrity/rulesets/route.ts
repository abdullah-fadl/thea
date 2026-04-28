import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

const createRulesetSchema = z.object({
  name: z.string().min(1, 'name is required'),
  key: z.string().min(1, 'key is required'),
  description: z.string().optional(),
  categories: z.array(z.any()).optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const items = await prisma.integrityRuleset.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      return NextResponse.json({ items });
    } catch (error: any) {
      logger.error('Integrity rulesets list error:', { error: error });
      // [SEC-06]
      return NextResponse.json(
        { error: 'Failed to list rulesets' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.integrity.read' }
);

export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const v = validateBody(body, createRulesetSchema);
      if ('error' in v) return v.error;
      const { name, key, description, categories } = v.data;

      const now = new Date();
      const ruleset = {
        tenantId,
        name,
        description: description || '',
        rules: Array.isArray(categories) ? categories : [],
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      };

      const created = await prisma.integrityRuleset.create({ data: ruleset as never });

      return NextResponse.json({ success: true, ruleset: { ...created, key } });
    } catch (error: any) {
      logger.error('Integrity ruleset create error:', { error: error });
      return NextResponse.json(
        { error: 'Failed to create ruleset' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.integrity.resolve' }
);
