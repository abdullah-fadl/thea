/**
 * Hook to check route permissions and redirect if unauthorized
 * 
 * This hook should be used in all pages to ensure users can only access
 * pages they have permission for.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from './useMe';
import { usePlatform } from './usePlatform';
import { hasRoutePermission } from '@/lib/permissions';

/**
 * Hook to check if user has permission for current route
 * Redirects to /welcome if user doesn't have permission
 * 
 * Also checks platform access for SAM routes (/policies, /sam, etc.)
 * If user has SAM platform access, they can access SAM routes even without explicit permissions
 * 
 * @param route - Route path to check (e.g., '/policies', '/ai/policy-assistant')
 * @returns { hasPermission: boolean, isLoading: boolean }
 */
export function useRoutePermission(route: string) {
  const router = useRouter();
  const { me, isLoading: meLoading } = useMe();
  const { platform: platformData, isLoading: platformLoading } = usePlatform();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (meLoading) {
      setIsLoading(true);
      return;
    }

    if (!me) {
      setHasPermission(false);
      setIsLoading(false);
      router.push('/welcome');
      return;
    }

    const userPermissions = me.user?.permissions || [];
    
    // Check permission-based access
    let hasAccess = hasRoutePermission(userPermissions, route);
    
    // If no permission-based access, check platform-based access for SAM routes
    if (!hasAccess) {
      // SAM platform routes that should be accessible with platform access
      const samRoutes = ['/library', '/integrity', '/builder', '/assistant', '/creator', '/alignment', '/risk-detector', '/policies', '/ai', '/sam'];
      const isSAMRoute = samRoutes.some(prefix => route.startsWith(prefix));
      
      if (isSAMRoute && me) {
        // Check if user has SAM platform access (from effectiveEntitlements or platform cookie)
        const effectiveEntitlements = me.effectiveEntitlements;
        // effectiveEntitlements uses 'sam' key (not 'health' for SAM)
        const hasSAMAccess = 
          (effectiveEntitlements?.sam === true) || 
          (platformData?.platform === 'sam');
        
        if (hasSAMAccess) {
          // User has SAM platform access - allow access to SAM routes
          hasAccess = true;
        }
      }
    }
    
    setHasPermission(hasAccess);
    setIsLoading(false);

    // If user doesn't have permission, redirect to welcome page
    if (!hasAccess) {
      router.push('/welcome');
      return;
    }
  }, [me, meLoading, platformData, route, router]);

  return { hasPermission, isLoading };
}

