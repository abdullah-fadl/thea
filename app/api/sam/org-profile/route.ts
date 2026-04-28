import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import type { OrganizationProfile } from '@/lib/models/OrganizationProfile';
import { createAuditContext, logAuditEvent } from '@/lib/security/audit';
import {
  MATURITY_STAGES,
  ONBOARDING_PHASES,
  buildDefaultOrganizationProfile,
  deriveRiskProfile,
  getOrganizationTypeLabel,
  isOrgProfileSetupComplete,
  normalizeOrganizationType,
  normalizeStandards,
} from '@/lib/sam/orgProfile';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

const upsertSchema = z.object({
  organizationName: z.string().min(1).optional(),
  organizationType: z.string().min(1),
  maturityStage: z.enum(MATURITY_STAGES as [string, ...string[]]),
  isPartOfGroup: z.boolean().default(false),
  groupId: z.string().optional().nullable(),
  selectedStandards: z.array(z.string()).optional().default([]),
  onboardingPhase: z.enum(ONBOARDING_PHASES as [string, ...string[]]).optional(),
  primaryFocus: z.array(z.string()).optional().default([]),
});

async function getTenantName(tenantId: string): Promise<string> {
  try {
    const tenant: Record<string, unknown> = await prisma.tenant.findFirst({ where: { tenantId } }) as any;
    return (tenant?.name as string) || tenantId;
  } catch {
    return tenantId;
  }
}

function shapeProfileResponse(profile: OrganizationProfile) {
  return {
    ...profile,
    organizationTypeLabel: getOrganizationTypeLabel(profile.organizationType),
  };
}

const stripInternalFields = (profile?: OrganizationProfile | null) => {
  if (!profile) return null;
  const { _id, ...rest } = profile as OrganizationProfile & { _id?: unknown };
  return rest;
};

const computeProfileDiff = (
  before: OrganizationProfile | null,
  after: OrganizationProfile
) => {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const beforeData = (stripInternalFields(before) || {}) as Record<string, unknown>;
  const afterData = (stripInternalFields(after) || {}) as Record<string, unknown>;

  Object.keys(afterData).forEach((key) => {
    const fromValue = beforeData[key];
    const toValue = afterData[key];
    if (JSON.stringify(fromValue) !== JSON.stringify(toValue)) {
      changes[key] = { from: fromValue ?? null, to: toValue ?? null };
    }
  });

  return changes;
};

export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
  let profile: Record<string, unknown> = await prisma.organizationProfile.findFirst({ where: { tenantId } }) as any;

  if (!profile) {
    const tenantName = await getTenantName(tenantId);
    profile = buildDefaultOrganizationProfile({
      tenantId,
      organizationName: tenantName,
    }) as any;
    await prisma.organizationProfile.create({ data: profile as Prisma.OrganizationProfileUncheckedCreateInput });
  }

  return NextResponse.json({
    profile: shapeProfileResponse(profile as unknown as OrganizationProfile),
    setupComplete: isOrgProfileSetupComplete(profile as unknown as OrganizationProfile),
  });
}),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.admin.view' });

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, user, userId, role }) => {
  try {
    const payload = upsertSchema.parse(await req.json());
    const existing: Record<string, unknown> = await prisma.organizationProfile.findFirst({ where: { tenantId } }) as any;

    const now = new Date();
    const onboardingPhase = (payload.onboardingPhase ||
      existing?.onboardingPhase ||
      'Foundation') as OrganizationProfile['onboardingPhase'];
    const maturityStage = payload.maturityStage as OrganizationProfile['maturityStage'];
    const organizationType = normalizeOrganizationType(payload.organizationType);
    if (!organizationType || organizationType === 'unknown') {
      return NextResponse.json(
        { error: 'Organization type is required.' },
        { status: 400 }
      );
    }
    const selectedStandards = normalizeStandards(payload.selectedStandards || []);
    const primaryFocus = normalizeStandards(payload.primaryFocus || (existing?.primaryFocus as string[]) || []);

    const organizationName =
      payload.organizationName?.trim() ||
      (existing?.organizationName as string) ||
      (await getTenantName(tenantId));

    const profile: OrganizationProfile = {
      id: (existing?.id as string) || crypto.randomUUID(),
      tenantId,
      organizationName,
      organizationType,
      maturityStage,
      isPartOfGroup: payload.isPartOfGroup,
      groupId: payload.isPartOfGroup ? (payload.groupId?.trim() || null) : null,
      selectedStandards,
      onboardingPhase,
      riskProfile: deriveRiskProfile({ maturityStage, onboardingPhase }),
      primaryFocus,
      createdAt: (existing?.createdAt as Date) || now,
      updatedAt: now,
    };

    if (existing) {
      await prisma.organizationProfile.updateMany({
        where: { tenantId },
        data: profile as Prisma.OrganizationProfileUncheckedCreateInput,
      });
    } else {
      await prisma.organizationProfile.create({ data: profile as Prisma.OrganizationProfileUncheckedCreateInput });
    }

    const auditContext = createAuditContext(
      {
        userId,
        userRole: role,
        userEmail: user?.email,
        tenantId,
      },
      {
        ip: req.headers.get('x-forwarded-for') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
        method: req.method,
        path: req.nextUrl.pathname,
      }
    );

    await logAuditEvent(auditContext, 'org_profile_updated', 'organization_profile', {
      resourceId: profile.id,
      metadata: {
        changes: computeProfileDiff(existing as unknown as OrganizationProfile | null, profile),
        before: stripInternalFields(existing as unknown as OrganizationProfile | null),
        after: stripInternalFields(profile),
        updatedAt: profile.updatedAt,
      },
    });

    return NextResponse.json({
      profile: shapeProfileResponse(profile),
      setupComplete: isOrgProfileSetupComplete(profile),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error as Error)?.message || 'Failed to save organization profile' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.admin.manage' });
