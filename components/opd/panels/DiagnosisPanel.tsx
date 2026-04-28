'use client';

import useSWR from 'swr';
import { DiagnosisSelector } from '@/components/clinical/DiagnosisSelector';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface Props {
  visitId: string;
}

export default function DiagnosisPanel({ visitId }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const { data: summaryData, isLoading } = useSWR(
    visitId ? `/api/opd/encounters/${visitId}/summary` : null,
    fetcher
  );

  const patientId =
    summaryData?.patient?.id || summaryData?.patientMasterId || null;

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="text-center py-8 text-muted-foreground">
          {tr('جاري التحميل...', 'Loading...')}
        </div>
      </div>
    );
  }

  return (
    <DiagnosisSelector
      encounterId={visitId}
      patientId={patientId}
      required={true}
    />
  );
}
