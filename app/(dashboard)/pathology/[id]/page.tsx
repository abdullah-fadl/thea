'use client';

import PathologyDetail from './PathologyDetail';

export default function PathologyDetailPage({ params }: { params: { id: string } }) {
  return <PathologyDetail specimenId={params.id} />;
}
