'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EncounterOphthalmologyRedirect({
  params,
}: {
  params: { encounterCoreId: string };
}) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/opd/visit/${params.encounterCoreId}/eye-report`);
  }, [params.encounterCoreId, router]);
  return null;
}
