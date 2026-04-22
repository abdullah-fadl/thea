'use client';

import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

export function useMe() {
  // Options are inherited from SWRConfig in app/providers.tsx
  // No need to override to avoid refetch loops
  const { data, error, isLoading, mutate } = useSWR('/api/auth/me', fetcher);

  return { me: data, error, isLoading, mutate };
}

