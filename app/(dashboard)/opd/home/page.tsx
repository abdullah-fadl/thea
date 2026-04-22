'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OPDHomePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/opd/dashboard');
  }, [router]);
  return null;
}
