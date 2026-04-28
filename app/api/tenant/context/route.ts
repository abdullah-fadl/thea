import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getTenantContext } from '@/lib/tenant/getTenantContext';

export const dynamic = 'force-dynamic';

function isValidTenantId(value: string | null | undefined): value is string {
  const normalized = String(value || '').trim();
  return !!normalized && normalized !== 'default' && normalized !== '__skip__';
}

const EMPTY_CONTEXT = {
  tenantId: '',
  org: { typeId: '', typeName: '', sectorId: '', countryCode: null, accreditationSetIds: [] },
  requiredDocumentTypes: [],
  glossary: {},
  guidanceDefaults: {},
  overlays: { applied: [], ignored: [] },
  contextVersion: 'none',
};

export const GET = async (req: Request) => {
  try {
    const authResult = await requireAuth(req as NextRequest);
    if (authResult instanceof NextResponse) {
      // Unauthenticated: return 200 with empty context (avoids 401 noise when session expired)
      return NextResponse.json(EMPTY_CONTEXT);
    }

    const roleStr = String(authResult.user?.role || '').toLowerCase();
    const isOwner = roleStr === 'thea-owner' || roleStr === 'thea_owner';

    if (!isValidTenantId(authResult.tenantId) || isOwner) {
      return NextResponse.json({ ...EMPTY_CONTEXT, tenantId: authResult.tenantId || '' });
    }

    const context = await getTenantContext(req, authResult.tenantId);
    return NextResponse.json(context);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load tenant context' },
      { status: 500 }
    );
  }
};
