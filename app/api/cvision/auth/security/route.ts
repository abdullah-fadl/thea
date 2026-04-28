import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withCVisionAuth } from '@/lib/cvision/infra/withAuth';
import {
  getSecurityStats,
  getLoginHistory,
  getSuspiciousActivities,
  getLockedAccounts,
  unlockAccount,
  resolveActivity,
  SECURITY_CONFIG,
} from '@/lib/cvision/auth/security-engine';

function ok(data: any, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}
function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

// ─── GET ─────────────────────────────────────────────────────

export const GET = withCVisionAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'stats';

    switch (action) {
      case 'stats': {
        const stats = await getSecurityStats();
        return ok({ stats, config: SECURITY_CONFIG });
      }

      case 'history': {
        const email = searchParams.get('email');
        if (!email) return fail('email parameter required');
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const history = await getLoginHistory(email, limit);
        return ok({ history });
      }

      case 'alerts': {
        const resolved = searchParams.get('resolved') === 'true';
        const alerts = await getSuspiciousActivities(resolved);
        return ok({ alerts });
      }

      case 'locked': {
        const accounts = await getLockedAccounts();
        return ok({ accounts });
      }

      default:
        return fail(`Unknown action: ${action}`);
    }
  } catch (err: any) {
    logger.error('[Security API GET]', err);
    return fail(err.message || 'Internal error', 500);
  }
}, { permissionKey: 'cvision_admin.read' });

// ─── POST ────────────────────────────────────────────────────

export const POST = withCVisionAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'unlock': {
        const { email } = body;
        if (!email) return fail('email required');
        await unlockAccount(email);
        return ok({ message: `Account ${email} unlocked` });
      }

      case 'resolve': {
        const { activityId } = body;
        if (!activityId) return fail('activityId required');
        await resolveActivity(activityId);
        return ok({ message: 'Alert resolved' });
      }

      default:
        return fail(`Unknown action: ${action}`);
    }
  } catch (err: any) {
    logger.error('[Security API POST]', err);
    return fail(err.message || 'Internal error', 500);
  }
}, { permissionKey: 'cvision_admin.write' });
