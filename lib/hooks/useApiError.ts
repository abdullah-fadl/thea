'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { useUiTestMode } from '@/lib/hooks/useUiTestMode';
import { useMe } from '@/lib/hooks/useMe';

/**
 * Hook to handle API errors globally, especially session expiration
 */
export function useApiError() {
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { me } = useMe();
  const { state: testMode } = useUiTestMode(me?.tenantId);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    // Intercept fetch errors globally
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      
      // Check for 401 with session expired message
      if (response.status === 401) {
        try {
          const data = await response.clone().json();
          if (data.message?.includes('logged in elsewhere') || data.message?.includes('Session expired')) {
            // Session expired - redirect to login with message
            toast({
              title: tr('تم تسجيل الخروج', 'Logged Out'),
              description: tr(
                'تم تسجيل خروجك لأنك سجلت الدخول من جهاز آخر.',
                'You were logged out because you signed in on another device.',
              ),
              variant: 'default',
            });
            router.push('/login?sessionExpired=true');
          }
        } catch (e) {
          // Not JSON response, ignore
        }
      }

      if (response.status === 403 && testMode.enabled) {
        toast({
          title: tr('وضع الاختبار', 'Test Mode'),
          description: tr('وضع الاختبار — تتطلب الإذن الحقيقي', 'Test mode — real permission required'),
          variant: 'default',
        });
      }
      
      return response;
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  }, [router, toast, language]);
}

