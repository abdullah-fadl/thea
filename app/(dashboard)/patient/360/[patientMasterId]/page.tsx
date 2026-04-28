'use client';
import Patient360 from './Patient360';
export default function Patient360Page({ params }: { params: { patientMasterId: string } }) {
  return <Patient360 params={params} />;
}
