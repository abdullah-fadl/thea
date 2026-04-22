'use client';

import { SWRConfig } from 'swr';
import { PlatformProvider } from '@/contexts/PlatformContext';
import { TenantContextProvider } from '@/contexts/TenantContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ConfirmModalProvider } from '@/components/ui/confirm-modal';
import { swrFetcher } from '@/lib/fetch';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: swrFetcher,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        shouldRetryOnError: false,
        dedupingInterval: 60000,
      }}
    >
      <ThemeProvider>
        <PlatformProvider>
          <TenantContextProvider>
            <ConfirmModalProvider>{children}</ConfirmModalProvider>
          </TenantContextProvider>
        </PlatformProvider>
      </ThemeProvider>
    </SWRConfig>
  );
}

