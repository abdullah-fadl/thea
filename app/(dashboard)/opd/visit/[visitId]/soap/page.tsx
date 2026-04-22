'use client';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const SoapPanel = dynamic(() => import('@/components/opd/panels/SoapPanel'), { ssr: false });

export default function SoapNotesPage() {
  const { visitId } = useParams();
  return <SoapPanel visitId={visitId as string} />;
}
