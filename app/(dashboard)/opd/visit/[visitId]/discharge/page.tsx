'use client';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const DischargePanel = dynamic(() => import('@/components/opd/panels/DischargePanel'), { ssr: false });

export default function DischargePage() {
  const { visitId } = useParams();
  return <DischargePanel visitId={visitId as string} />;
}
