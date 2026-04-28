'use client';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const DiagnosisPanel = dynamic(() => import('@/components/opd/panels/DiagnosisPanel'), { ssr: false });

export default function DiagnosisPage() {
  const { visitId } = useParams();
  return <DiagnosisPanel visitId={visitId as string} />;
}
