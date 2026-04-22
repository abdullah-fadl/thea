'use client';
import PatientGrowth from './PatientGrowth';
export default function PatientGrowthPage({ params }: { params: { patientMasterId: string } }) {
  return <PatientGrowth params={params} />;
}
