'use client';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const OverviewPanel = dynamic(() => import('@/components/opd/panels/OverviewPanel'), { ssr: false });

export default function VisitOverviewPage() {
  const { visitId } = useParams();
  return <OverviewPanel visitId={visitId as string} />;
}
