'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function DoctorScheduleRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/opd/doctor-station'); }, [router]);
  return null;
}
