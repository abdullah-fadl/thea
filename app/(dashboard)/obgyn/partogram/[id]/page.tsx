'use client';
import { PartogramDetail } from './PartogramDetail';
export default function Page({ params }: { params: { id: string } }) {
  return <PartogramDetail id={params.id} />;
}
