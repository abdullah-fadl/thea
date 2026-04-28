'use client';
import PatientJourney from './PatientJourney';
export default function PatientJourneyPage({ params }: { params: { patientMasterId: string } }) {
  return <PatientJourney params={params} />;
}
