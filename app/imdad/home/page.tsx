'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ImdadHomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/imdad/command-center');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#050a18] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 animate-pulse">
          <span className="text-xl font-bold text-white">إ</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-cyan-500/60 text-sm tracking-widest uppercase">
            IMDAD
          </span>
        </div>
      </div>
    </div>
  );
}
