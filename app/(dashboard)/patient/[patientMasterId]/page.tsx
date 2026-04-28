'use client';
import PatientFile from './PatientFile';
export default function PatientFilePage({ params }: { params: { patientMasterId: string } }) {
  return <PatientFile params={params} />;
}
