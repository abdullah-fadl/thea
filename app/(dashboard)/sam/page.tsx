'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * SAM Index Page — redirects to /sam/home.
 * Uses client-side router.replace() to avoid Next.js 14 server-side redirect()
 * crash ("Cannot update component while rendering Router").
 */
export default function SamIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/sam/home');
  }, [router]);

  return null;
}
