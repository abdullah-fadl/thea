'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EncounterPrescriptionPrintRedirect({
  params,
}: {
  params: { encounterCoreId: string };
}) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/opd/visit/${params.encounterCoreId}/prescription-print`);
  }, [params.encounterCoreId, router]);
  return null;
}
