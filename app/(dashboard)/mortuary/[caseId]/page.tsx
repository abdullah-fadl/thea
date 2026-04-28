'use client';

import Mortuary from './Mortuary';

export default function MortuaryCasePage({ params }: { params: { caseId: string } }) {
  return <Mortuary params={params} />;
}
