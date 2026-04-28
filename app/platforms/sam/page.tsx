/**
 * SAM Platform Landing Page
 * 
 * Route: /platforms/sam
 * This is the entry point for SAM platform
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyTokenEdge } from '@/lib/auth/edge';

export default async function SAMPlatformPage() {
  // Verify authentication
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  
  if (!token) {
    redirect('/login?redirect=/platforms/sam');
  }
  
  const payload = await verifyTokenEdge(token);
  if (!payload) {
    redirect('/login?redirect=/platforms/sam');
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
  if (!payload.entitlements?.sam && !ownerBypass) {
    if (isOwnerRole) {
      redirect('/owner');
    }
    redirect('/platforms?reason=not_entitled');
  }
  
  // Redirect to SAM home (default entry point)
  redirect('/sam/home');
}
