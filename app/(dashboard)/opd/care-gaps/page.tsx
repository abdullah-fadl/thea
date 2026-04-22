'use client';

import dynamic from 'next/dynamic';

const CareGapsDashboard = dynamic(
  () => import('./CareGapsDashboard'),
  { ssr: false }
);

export default function CareGapsPage() {
  return <CareGapsDashboard />;
}
