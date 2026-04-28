import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { requireTenantContext, OrgProfileRequiredError, buildOrgProfileRequiredResponse } from '@/lib/tenant/getTenantContext';
import { getSuggestedOverlays } from '@/lib/sam/overlaySuggestions';

export const dynamic = 'force-dynamic';

export const POST = withAuthTenant(async (req, { tenantId }) => {
  try {
    const context = await requireTenantContext(req, tenantId);
    const { suggestions, isDraft } = getSuggestedOverlays({
      orgTypeName: context.org.typeName,
      sector: context.org.sectorId,
      countryCode: context.org.countryCode || null,
      accreditationSets: context.org.accreditationSetIds || [],
    });

    const coverage = {
      standardsCount: suggestions.filter((item) => item.type === 'ACCREDITATION').length,
      docTypesCount: suggestions.filter((item) => item.type === 'REQUIRED_DOCS').length,
      glossaryCount: suggestions.filter((item) => item.type === 'GLOSSARY').length,
      guidanceCount: suggestions.filter((item) => item.type === 'RULES').length,
      notes: 'Derived from organization profile',
    };

    return NextResponse.json({ suggestions, isDraft, coverage });
  } catch (error) {
    if (error instanceof OrgProfileRequiredError) {
      return buildOrgProfileRequiredResponse();
    }
    return NextResponse.json({ error: 'Failed to load suggestions' }, { status: 500 });
  }
}, { platformKey: 'sam', tenantScoped: true });
