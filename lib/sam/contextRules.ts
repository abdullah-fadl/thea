import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';
type InputJsonValue = Prisma.InputJsonValue;
import { tenantWhere } from '@/lib/db/tenantLookup';
import type { OrganizationProfile } from '@/lib/models/OrganizationProfile';
import { logger } from '@/lib/monitoring/logger';
import {
  buildDefaultOrganizationProfile,
  deriveRiskProfile,
} from '@/lib/sam/orgProfile';

export type ContextRules = {
  strictnessLevel: 'lenient' | 'balanced' | 'strict';
  tone: 'coaching' | 'operational' | 'audit';
  preferReuse: boolean;
  suppressAdvancedConflicts: boolean;
  priorities: string[];
};

export function buildContextRules(
  profile: OrganizationProfile,
  _departmentId?: string
): ContextRules {
  const preferReuse = Boolean(profile.isPartOfGroup);
  let strictnessLevel: ContextRules['strictnessLevel'] = 'balanced';
  let tone: ContextRules['tone'] = 'operational';
  let suppressAdvancedConflicts = false;
  const priorities: string[] = [];

  if (profile.maturityStage === 'New') {
    strictnessLevel = 'lenient';
    tone = 'coaching';
    suppressAdvancedConflicts = true;
    priorities.push('foundation_gaps', 'baseline_controls');
  } else if (profile.maturityStage === 'Mature') {
    strictnessLevel = 'strict';
    tone = 'audit';
    priorities.push('audit_readiness', 'conflict_resolution');
  } else {
    strictnessLevel = 'balanced';
    tone = 'operational';
    priorities.push('operational_gaps');
  }

  if (profile.onboardingPhase === 'Foundation') {
    priorities.push('foundational_policies');
    if (profile.maturityStage !== 'Mature') {
      suppressAdvancedConflicts = true;
    }
  }

  if (profile.onboardingPhase === 'Expansion') {
    priorities.push('scale_controls');
  }

  if (preferReuse) {
    priorities.push('reuse_before_create');
  }

  return {
    strictnessLevel,
    tone,
    preferReuse,
    suppressAdvancedConflicts,
    priorities: Array.from(new Set(priorities)),
  };
}

export async function loadOrgProfileSnapshot(
  request: Request,
  tenantId: string
): Promise<OrganizationProfile> {
  try {
    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({
      where: tenantWhere(tenantId),
      select: { id: true },
    });
    const tenantUuid = tenant?.id || tenantId;

    // Try to find existing org profile
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM organization_profiles WHERE "tenantId" = $1 LIMIT 1`,
      tenantUuid
    ) as Record<string, unknown>[];

    if (rows && rows.length > 0) {
      return rows[0] as unknown as OrganizationProfile;
    }

    // Build and insert default profile
    const profile = buildDefaultOrganizationProfile({
      tenantId,
      organizationName: tenantId,
    });
    profile.riskProfile = deriveRiskProfile({
      maturityStage: profile.maturityStage,
      onboardingPhase: profile.onboardingPhase,
    });

    // Store as JSON in organization_profiles table
    await prisma.organizationProfile.create({
      data: {
        tenantId: tenantUuid,
        name: profile.organizationName,
        metadata: profile as unknown as InputJsonValue,
      },
    });

    return profile;
  } catch (error) {
    logger.error('loadOrgProfileSnapshot error', { category: 'general', error });
    // Return default profile as fallback
    const profile = buildDefaultOrganizationProfile({
      tenantId,
      organizationName: tenantId,
    });
    profile.riskProfile = deriveRiskProfile({
      maturityStage: profile.maturityStage,
      onboardingPhase: profile.onboardingPhase,
    });
    return profile;
  }
}

export async function getOrgContextSnapshot(
  request: Request,
  tenantId: string,
  departmentId?: string
) {
  const orgProfile = await loadOrgProfileSnapshot(request, tenantId);
  const contextRules = buildContextRules(orgProfile, departmentId);
  return { orgProfile, contextRules };
}
