import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { addressGap, dismissGap } from '@/lib/quality/careGapScanner';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * PATCH /api/care-gaps/findings/[id]
 *
 * Address or dismiss a care gap finding.
 * Body: { action: 'address' | 'dismiss', dismissedReason?: string }
 */
export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const segments = req.nextUrl.pathname.split('/');
    const id = segments[segments.length - 1];

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const body = await req.json();
    const { action, dismissedReason } = body;

    if (!action || !['address', 'dismiss'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "address" or "dismiss"' },
        { status: 400 }
      );
    }

    let result;
    if (action === 'address') {
      result = await addressGap(id, userId || 'unknown', tenantId);
    } else {
      if (!dismissedReason) {
        return NextResponse.json(
          { error: 'dismissedReason is required when dismissing a gap' },
          { status: 400 }
        );
      }
      result = await dismissGap(id, dismissedReason, userId || 'unknown', tenantId);
    }

    if (!result) {
      return NextResponse.json({ error: 'Care gap finding not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, finding: result });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'care-gaps.manage',
  }
);
