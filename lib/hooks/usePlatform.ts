'use client';

import useSWR from 'swr';
import { usePathname } from 'next/navigation';

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

export function usePlatform() {
  const pathname = usePathname();
  const swrKey = pathname ? ['/api/platform/get', pathname] : '/api/platform/get';
  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    (key) => fetcher(Array.isArray(key) ? key[0] : key),
    {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    dedupingInterval: 60000,
    }
  );

  return { platform: data, error, isLoading, mutate };
}

