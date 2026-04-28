'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/hooks/use-lang';

export default function OpdEncounterPage({
  params,
}: {
  params: { encounterCoreId: string };
}) {
  const { isRTL } = useLang();
  const router = useRouter();
  const encounterCoreId = String(params?.encounterCoreId || '').trim();

  useEffect(() => {
    if (!encounterCoreId) return;
    router.replace(`/opd/visit/${encounterCoreId}/overview`);
  }, [encounterCoreId, router]);

  return <div dir={isRTL ? 'rtl' : 'ltr'} />;
}
