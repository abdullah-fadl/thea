'use client';

import { useEffect, useState } from 'react';
import { useLang } from '@/hooks/use-lang';

const WARNING_BEFORE_MS = 5 * 60 * 1000; // 5 minutes before expiry
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export function SessionWarning() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    const checkSession = () => {
      const lastActivity = localStorage.getItem('lastActivity');
      if (!lastActivity) return;

      const elapsed = Date.now() - parseInt(lastActivity, 10);
      const remaining = SESSION_DURATION_MS - elapsed;

      if (remaining <= WARNING_BEFORE_MS && remaining > 0) {
        setShowWarning(true);
        setRemainingSeconds(Math.ceil(remaining / 1000));
      } else if (remaining <= 0) {
        window.location.href = '/login?expired=1';
      } else {
        setShowWarning(false);
      }
    };

    const interval = setInterval(checkSession, 1000);
    return () => clearInterval(interval);
  }, []);

  const extendSession = async () => {
    await fetch('/api/auth/extend-session', { credentials: 'include', method: 'POST' });
    localStorage.setItem('lastActivity', Date.now().toString());
    setShowWarning(false);
  };

  if (!showWarning) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl p-6 max-w-md mx-4 shadow-2xl">
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          {tr('الجلسة على وشك الانتهاء', 'Session Expiring Soon')}
        </h2>
        <p className="text-slate-600 mb-4">
          {tr('ستنتهي جلستك خلال', 'Your session will expire in')}{' '}
          <span className="font-bold text-red-600">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </p>
        <div className="flex gap-3">
          <button
            onClick={extendSession}
            className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            {tr('البقاء متصلاً', 'Stay Logged In')}
          </button>
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
              window.location.href = '/login';
            }}
            className="flex-1 py-2 px-4 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300"
          >
            {tr('تسجيل الخروج', 'Log Out')}
          </button>
        </div>
      </div>
    </div>
  );
}
