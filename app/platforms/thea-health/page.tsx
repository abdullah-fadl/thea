/**
 * Thea Health Platform Landing Page
 *
 * Route: /platforms/thea-health
 * This is the entry point for Thea Health platform
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyTokenEdge } from '@/lib/auth/edge';
import { getLastSessionState } from '@/lib/core/auth/sessionRestore';
import { getTestLanding } from '@/lib/ui/testMode';

export default async function TheaHealthPlatformPage() {
  // Verify authentication
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    redirect('/login?redirect=/platforms/thea-health');
  }

  const payload = await verifyTokenEdge(token);
  if (!payload) {
    redirect('/login?redirect=/platforms/thea-health');
  }

  // CRITICAL: Block owner from accessing tenant platforms without approved access OR owner tenant
  const isOwnerRole = payload.role === 'thea-owner' || payload.role === 'THEA_OWNER';
  const ownerBypass = isOwnerRole
    && process.env.THEA_TEST_MODE === 'true'
    && process.env.NODE_ENV !== 'production';

  if (isOwnerRole && !ownerBypass) {
    const approvedAccessToken = cookieStore.get('approved_access_token')?.value;
    const isOwnerTenant = payload.activeTenantId === 'thea-owner-dev';

    if (!approvedAccessToken && !isOwnerTenant) {
      redirect('/owner');
    }
  }

  // Check platform entitlements (owner with bypass gets all entitlements)
  if (!payload.entitlements?.health && !ownerBypass) {
    if (isOwnerRole) {
      redirect('/owner');
    }
    redirect('/platforms?reason=not_entitled');
  }

  try {
    const lastState = await getLastSessionState(payload.userId);
    if (lastState?.lastRoute && lastState.autoRestore) {
      redirect(lastState.lastRoute);
    }
  } catch {
    // ignore restore failures
  }

  const testModeCookie = cookieStore.get('ui-test-mode')?.value;
  if (testModeCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(testModeCookie));
      if (parsed?.enabled && parsed.area && parsed.position) {
        redirect(getTestLanding(parsed.position));
      }
    } catch {
      // ignore invalid cookie
    }
  }

  // Always redirect to welcome page when first opening the platform
  redirect('/welcome');
}
