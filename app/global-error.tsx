'use client';

import { useEffect, useState } from 'react';

type Language = 'ar' | 'en';

function getLanguage(): Language {
  if (typeof window === 'undefined') return 'ar';
  try {
    const cookies = document.cookie.split(';');
    const langCookie = cookies.find(c => c.trim().startsWith('px-language='));
    if (langCookie) {
      const value = langCookie.split('=')[1]?.trim();
      if (value === 'en' || value === 'ar') return value;
    }
    const stored = localStorage.getItem('px-language');
    if (stored === 'en' || stored === 'ar') return stored;
  } catch { /* fallback */ }
  return 'ar';
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [lang, setLang] = useState<Language>('ar');

  useEffect(() => {
    setLang(getLanguage());
  }, []);

  const tr = (ar: string, en: string) => lang === 'ar' ? ar : en;
  const isRTL = lang === 'ar';
  const goBack = () => {
    if (typeof window === 'undefined') return;
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = '/platforms';
  };

  const forceLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore network issues and continue clearing local state.
    }

    try {
      localStorage.removeItem('thea:platform');
      localStorage.removeItem('thea:selectedPlatform');
      sessionStorage.clear();
    } catch {
      // Best effort cleanup only.
    }

    window.location.href = '/login';
  };

  return (
    <html lang={lang} dir={isRTL ? 'rtl' : 'ltr'}>
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          padding: '2rem',
          maxWidth: '600px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#fef2f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#dc2626"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h1 style={{ color: '#111827', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          {tr('حدث خطأ غير متوقع', 'Something went wrong')}
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
          {tr(
            'نعتذر عن هذا الخطأ. يمكنك المحاولة مرة أخرى أو العودة للصفحة الرئيسية.',
            'We apologize for this error. You can try again or go to the dashboard.'
          )}
        </p>

        {error?.digest && (
          <p style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '1rem' }}>
            {tr('معرّف:', 'ID:')} {error.digest}
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => reset()}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            {tr('حاول مرة أخرى', 'Try Again')}
          </button>
          <button
            onClick={goBack}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            {tr('رجوع', 'Go Back')}
          </button>
          <button
            onClick={forceLogout}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: '#fff7ed',
              color: '#9a3412',
              border: '1px solid #fdba74',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            {tr('تسجيل الخروج', 'Sign Out')}
          </button>
        </div>
      </body>
    </html>
  );
}
