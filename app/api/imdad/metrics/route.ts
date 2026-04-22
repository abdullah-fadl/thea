import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getMetrics } from '@/lib/imdad/metrics';

export const dynamic = 'force-dynamic';

// [Bug #15 FIX] Wrap with withAuthTenant to require authentication
export const GET = withAuthTenant(
  async () => {
    return NextResponse.json(getMetrics());
  },
  { platformKey: 'imdad', permissionKey: 'imdad.admin' }
);
