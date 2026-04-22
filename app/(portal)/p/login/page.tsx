'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PortalLoginPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/p');
  }, [router]);
  return null;
}
