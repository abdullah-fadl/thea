import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { resolveIdentity, IdentityError } from '@/lib/imdad/user-identity';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/imdad/workflow/me — Return resolved canonical identity
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (_request, { tenantId, userId }) => {
    try {
      const identity = await resolveIdentity(userId, tenantId);
      return NextResponse.json({ identity, resolved: true });
    } catch (e) {
      if (e instanceof IdentityError) {
        return NextResponse.json({
          identity: null,
          resolved: false,
          error: e.toResponse(),
        }, { status: 200 }); // 200 so UI can display the error gracefully
      }
      return NextResponse.json({
        identity: null,
        resolved: false,
        error: { code: 'RESOLUTION_FAILED', message: 'Identity resolution failed' },
      }, { status: 200 });
    }
  },
  {
    tenantScoped: true,
    platformKey: 'imdad' as any,
    permissionKey: 'imdad.workflow.manage',
  },
);
