'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function DoctorWorklistRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/opd/doctor-station'); }, [router]);
  return null;
}
