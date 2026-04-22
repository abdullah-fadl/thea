/**
 * Imdad Platform Landing Page
 *
 * Route: /platforms/imdad
 * This is the entry point for Imdad (Supply Chain Management) platform
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyTokenEdge } from '@/lib/auth/edge';

export default async function ImdadPlatformPage() {
  // Verify authentication
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    redirect('/login?redirect=/platforms/imdad');
  }

  const payload = await verifyTokenEdge(token);
  if (!payload) {
    redirect('/login?redirect=/platforms/imdad');
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
  if (!payload.entitlements?.imdad && !ownerBypass) {
    if (isOwnerRole) {
      redirect('/owner');
    }
    redirect('/platforms?reason=not_entitled');
  }

  // Redirect to Imdad dashboard (command center is the default landing)
  redirect('/imdad/command-center');
}
