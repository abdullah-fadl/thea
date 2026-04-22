'use client';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const PrescriptionPanel = dynamic(() => import('@/components/opd/panels/PrescriptionPanel'), { ssr: false });

export default function PrescriptionPage() {
  const { visitId } = useParams();
  return <PrescriptionPanel visitId={visitId as string} />;
}
