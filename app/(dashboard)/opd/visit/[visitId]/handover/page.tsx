'use client';

import { useParams } from 'next/navigation';
import { HandoverPanel } from '@/components/handover/HandoverPanel';

export default function HandoverPage() {
  const { visitId } = useParams();
  return (
    <div className="space-y-6">
      <HandoverPanel encounterCoreId={String(visitId || '')} />
    </div>
  );
}
