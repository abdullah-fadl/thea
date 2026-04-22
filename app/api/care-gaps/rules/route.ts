import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { getDefaultRules } from '@/lib/quality/careGapScanner';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/care-gaps/rules
 *
 * List all care gap rules — built-in (15 default) + tenant custom rules.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }) => {
    // Get built-in rules
    const builtInRules = getDefaultRules().map((r) => ({
      ...r,
      isBuiltIn: true,
      isActive: true,
      lastRunAt: null,
    }));

    // Get tenant custom rules
    const customRules = await prisma.careGapRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const customRulesMapped = customRules.map((r) => ({
      id: r.id,
      name: r.name,
      nameAr: r.nameAr,
      description: r.description,
      descriptionAr: r.descriptionAr,
      category: r.category,
      gapType: r.gapType,
      severity: r.severity,
      frequency: r.frequency,
      criteria: r.criteria,
      isBuiltIn: false,
      isActive: r.isActive,
      lastRunAt: r.lastRunAt,
    }));

    return NextResponse.json({
      rules: [...builtInRules, ...customRulesMapped],
      builtInCount: builtInRules.length,
      customCount: customRules.length,
    });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'care-gaps.view',
  }
);

const createRuleSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  description: z.string().min(1),
  descriptionAr: z.string().optional(),
  category: z.enum(['preventive', 'chronic_disease', 'medication', 'follow_up', 'screening']),
  gapType: z.enum(['screening_overdue', 'vaccination_due', 'follow_up_missed', 'lab_overdue', 'medication_refill', 'referral_pending', 'preventive_care']),
  severity: z.enum(['low', 'moderate', 'high', 'critical']).default('moderate'),
  frequency: z.enum(['daily', 'weekly', 'monthly']).default('monthly'),
  criteria: z.record(z.string(), z.any()),
}).passthrough();

/**
 * POST /api/care-gaps/rules
 *
 * Create a custom care gap rule.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const body = await req.json();

    const parsed = createRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const rule = await prisma.careGapRule.create({
      data: {
        tenantId,
        name: parsed.data.name,
        nameAr: parsed.data.nameAr || null,
        description: parsed.data.description,
        descriptionAr: parsed.data.descriptionAr || null,
        category: parsed.data.category,
        gapType: parsed.data.gapType,
        severity: parsed.data.severity,
        frequency: parsed.data.frequency,
        criteria: parsed.data.criteria,
        isActive: true,
      },
    });

    return NextResponse.json({ ok: true, rule }, { status: 201 });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'care-gaps.manage',
  }
);

/**
 * PATCH /api/care-gaps/rules
 *
 * Toggle a custom rule's active status.
 * Body: { ruleId: string, isActive: boolean }
 */
export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const body = await req.json();
    const { ruleId, isActive } = body;

    if (!ruleId || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'ruleId (string) and isActive (boolean) are required' },
        { status: 400 }
      );
    }

    const existing = await prisma.careGapRule.findFirst({
      where: { id: ruleId, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    const updated = await prisma.careGapRule.update({
      where: { id: ruleId },
      data: { isActive },
    });

    return NextResponse.json({ ok: true, rule: updated });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'care-gaps.manage',
  }
);
