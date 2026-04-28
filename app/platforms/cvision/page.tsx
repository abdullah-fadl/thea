/**
 * CVision Platform Landing Page
 * 
 * Route: /platforms/cvision
 * This is the entry point for CVision (HR OS) platform
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyTokenEdge } from '@/lib/auth/edge';

export default async function CVisionPlatformPage() {
  // Verify authentication
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value || cookieStore.get('token')?.value;
  
  if (!token) {
    redirect('/login?redirect=/platforms/cvision');
  }
  
  const payload = await verifyTokenEdge(token);
  if (!payload) {
    redirect('/login?redirect=/platforms/cvision');
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
  if (!payload.entitlements?.cvision && !ownerBypass) {
    if (isOwnerRole) {
      redirect('/owner');
    }
    redirect('/platforms?reason=not_entitled');
  }
  
  // Redirect to CVision dashboard
  redirect('/cvision');
}
