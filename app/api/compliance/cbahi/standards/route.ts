import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { CBAHI_STANDARDS, CBAHI_DOMAINS, getStandardsByDomain, searchStandards } from '@/lib/compliance/cbahi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/compliance/cbahi/standards
 * List all CBAHI standards with optional domain filter and search
 *
 * Query params:
 * - domain: string (e.g., "PC", "MM")
 * - search: string (search across titles, descriptions, IDs)
 * - priority: 'essential' | 'standard' | 'advanced'
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = new URL(req.url);
    const domain = url.searchParams.get('domain');
    const search = url.searchParams.get('search');
    const priority = url.searchParams.get('priority');

    let standards = CBAHI_STANDARDS;

    // Filter by domain
    if (domain) {
      standards = getStandardsByDomain(domain);
    }

    // Search filter
    if (search) {
      const searchResult = searchStandards(search);
      // If domain filter is also applied, intersect the results
      if (domain) {
        const domainIds = new Set(standards.map(s => s.id));
        standards = searchResult.filter(s => domainIds.has(s.id));
      } else {
        standards = searchResult;
      }
    }

    // Priority filter
    if (priority && ['essential', 'standard', 'advanced'].includes(priority)) {
      standards = standards.filter(s => s.priority === priority);
    }

    // Serialize standards (remove automatedCheck functions for JSON response)
    const serialized = standards.map(s => ({
      ...s,
      measurableElements: s.measurableElements.map(me => ({
        id: me.id,
        text: me.text,
        textAr: me.textAr,
        evidenceRequired: me.evidenceRequired,
        hasAutomatedCheck: !!me.automatedCheck,
      })),
    }));

    return NextResponse.json({
      standards: serialized,
      domains: CBAHI_DOMAINS,
      totalCount: CBAHI_STANDARDS.length,
      filteredCount: serialized.length,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'compliance.cbahi.view' }
);
