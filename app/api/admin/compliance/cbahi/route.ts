import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import {
  CBAHI_DOMAINS,
  CBAHI_STANDARDS,
  runFullComplianceAudit,
  getStandardsByDomain,
  getStandardById,
  searchStandards,
} from '@/lib/compliance/cbahi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'overview';

    if (action === 'overview') {
      return NextResponse.json({
        success: true,
        domains: CBAHI_DOMAINS,
        totalStandards: CBAHI_STANDARDS.length,
        domainBreakdown: Object.entries(CBAHI_DOMAINS).map(([key, info]) => ({
          domain: key,
          name: info.name,
          nameAr: info.nameAr,
          standardCount: CBAHI_STANDARDS.filter((s) => s.domain === key).length,
        })),
      });
    }

    if (action === 'standards') {
      const domain = searchParams.get('domain');
      const standards = domain ? getStandardsByDomain(domain) : CBAHI_STANDARDS;
      return NextResponse.json({
        success: true,
        standards: standards.map((s) => ({
          id: s.id,
          domain: s.domain,
          domainName: s.domainName,
          domainNameAr: s.domainNameAr,
          title: s.title,
          titleAr: s.titleAr,
          priority: s.priority,
          measurableElementCount: s.measurableElements.length,
          theaModuleMapping: s.theaModuleMapping,
          hasAutomatedCheck: s.measurableElements.some((me) => !!me.automatedCheck),
        })),
        total: standards.length,
      });
    }

    if (action === 'standard-detail') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
      const standard = getStandardById(id);
      if (!standard) return NextResponse.json({ success: false, error: 'Standard not found' }, { status: 404 });
      return NextResponse.json({ success: true, standard });
    }

    if (action === 'search') {
      const q = searchParams.get('q') || '';
      if (!q) return NextResponse.json({ success: false, error: 'Missing query' }, { status: 400 });
      const results = searchStandards(q);
      return NextResponse.json({ success: true, results, total: results.length });
    }

    if (action === 'audit') {
      const result = await runFullComplianceAudit(tenantId);
      return NextResponse.json({ success: true, audit: result });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'admin.compliance.view' }
);
