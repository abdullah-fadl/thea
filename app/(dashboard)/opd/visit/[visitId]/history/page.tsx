'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { HistoryTaking } from '@/components/clinical/HistoryTaking';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function VisitHistoryPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { visitId } = useParams();
  const { data } = useSWR(`/api/opd/encounters/${visitId}/summary`, fetcher);
  const patientId = data?.patient?.id;

  if (!patientId) {
    return <div className="text-sm text-slate-500">{tr('جاري تحميل المريض...', 'Loading patient...')}</div>;
  }

  return (
    <div className="space-y-4">
      <HistoryTaking patientId={patientId} />
    </div>
  );
}
