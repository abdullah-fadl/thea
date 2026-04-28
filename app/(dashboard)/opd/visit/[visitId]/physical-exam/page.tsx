'use client';

import { useParams } from 'next/navigation';
import { PhysicalExam } from '@/components/clinical/PhysicalExam';

export default function VisitPhysicalExamPage() {
  const { visitId } = useParams();

  return (
    <div className="space-y-4">
      <PhysicalExam encounterId={String(visitId)} />
    </div>
  );
}
