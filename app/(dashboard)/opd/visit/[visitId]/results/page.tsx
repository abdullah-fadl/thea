'use client';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const ResultsPanel = dynamic(() => import('@/components/opd/panels/ResultsPanel'), { ssr: false });

export default function ResultsPage() {
  const { visitId } = useParams();
  return <ResultsPanel visitId={visitId as string} />;
}
