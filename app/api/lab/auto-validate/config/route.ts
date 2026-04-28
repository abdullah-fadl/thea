import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const autoValidationRuleSchema = z.object({
  testCode: z.string().min(1, 'testCode is required'),
  ruleName: z.string().min(1, 'ruleName is required'),
  ruleType: z.enum(['range', 'delta', 'qc'], {
    message: 'ruleType must be one of: range, delta, qc / نوع القاعدة يجب أن يكون: range, delta, qc',
  }),
  parameters: z.record(z.string(), z.unknown()).refine(
    (val) => Object.keys(val).length > 0,
    { message: 'parameters must not be empty / المعلمات يجب ألا تكون فارغة' }
  ),
  enabled: z.boolean().optional().default(true),
  priority: z.number().int().min(0).optional().default(0),
});

/**
 * GET /api/lab/auto-validate/config
 *
 * List all auto-validation rules for the current tenant.
 * Supports optional filtering by testCode and ruleType.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const testCode = req.nextUrl.searchParams.get('testCode');
    const ruleType = req.nextUrl.searchParams.get('ruleType');
    const enabledOnly = req.nextUrl.searchParams.get('enabledOnly');

    const where: any = { tenantId };
    if (testCode) where.testCode = testCode;
    if (ruleType) where.ruleType = ruleType;
    if (enabledOnly === 'true') where.enabled = true;

    const rules = await prisma.labAutoValidationRule.findMany({
      where,
      orderBy: [
        { testCode: 'asc' },
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 100,
    });

    return NextResponse.json({
      rules,
      total: rules.length,
    });
  }),
  { tenantScoped: true, permissionKey: 'admin.data-admin.view' }
);

/**
 * POST /api/lab/auto-validate/config
 *
 * Create or update an auto-validation rule.
 * If a rule with the same (tenantId, testCode, ruleName) exists, it is updated.
 * Otherwise a new rule is created.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, autoValidationRuleSchema);
    if ('error' in v) return v.error;

    const { testCode, ruleName, ruleType, parameters, enabled, priority } = v.data;

    // Validate rule-specific parameters
    const paramValidation = validateRuleParameters(ruleType, parameters);
    if (paramValidation) {
      return NextResponse.json(
        { error: paramValidation },
        { status: 400 }
      );
    }

    // Upsert: find existing rule by unique constraint (tenantId, testCode, ruleName)
    const existing = await prisma.labAutoValidationRule.findFirst({
      where: { tenantId, testCode, ruleName },
    });

    let rule;
    if (existing) {
      rule = await prisma.labAutoValidationRule.update({
        where: { id: existing.id },
        data: {
          ruleType,
          parameters: parameters as any,
          enabled,
          priority,
          updatedBy: userId,
        },
      });
    } else {
      rule = await prisma.labAutoValidationRule.create({
        data: {
          tenantId,
          testCode,
          ruleName,
          ruleType,
          parameters: parameters as any,
          enabled,
          priority,
          createdBy: userId,
          updatedBy: userId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      rule,
      action: existing ? 'updated' : 'created',
    });
  }),
  { tenantScoped: true, permissionKey: 'admin.data-admin.view' }
);

/**
 * Validate that the rule parameters match the expected shape for the rule type.
 * Returns an error message if invalid, or null if valid.
 */
function validateRuleParameters(
  ruleType: string,
  parameters: Record<string, unknown>
): string | null {
  switch (ruleType) {
    case 'range': {
      // Range rules need at least min or max
      const hasMin = 'min' in parameters && parameters.min !== null && parameters.min !== undefined;
      const hasMax = 'max' in parameters && parameters.max !== null && parameters.max !== undefined;
      if (!hasMin && !hasMax) {
        return 'Range rules require at least "min" or "max" parameter / قواعد النطاق تتطلب على الأقل معلمة "min" أو "max"';
      }
      if (hasMin && hasMax && Number(parameters.min) > Number(parameters.max)) {
        return '"min" must be less than or equal to "max" / يجب أن يكون "min" أقل من أو يساوي "max"';
      }
      return null;
    }

    case 'delta': {
      // Delta rules need maxDelta (max change from previous result)
      if (!('maxDelta' in parameters) || parameters.maxDelta === null || parameters.maxDelta === undefined) {
        return 'Delta rules require "maxDelta" parameter / قواعد الدلتا تتطلب معلمة "maxDelta"';
      }
      if (Number(parameters.maxDelta) <= 0) {
        return '"maxDelta" must be a positive number / يجب أن يكون "maxDelta" رقمًا موجبًا';
      }
      return null;
    }

    case 'qc': {
      // QC rules need reference to QC lot/level or Westgard rule name
      if (!('qcRule' in parameters) || !parameters.qcRule) {
        return 'QC rules require "qcRule" parameter (e.g., "1-2s", "1-3s", "2-2s", "R-4s") / قواعد مراقبة الجودة تتطلب معلمة "qcRule"';
      }
      return null;
    }

    default:
      return `Unknown rule type: ${ruleType} / نوع قاعدة غير معروف: ${ruleType}`;
  }
}
