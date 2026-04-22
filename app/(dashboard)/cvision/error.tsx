'use client';

import { useEffect } from 'react';
import { useLang } from '@/hooks/use-lang';

export default function CVisionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[CVision Error Boundary]', error);
    }
  }, [error]);

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        background: '#0f0f0f',
        padding: '32px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          textAlign: 'center',
          maxWidth: '440px',
          width: '100%',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        {/* Heading */}
        <h2
          style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#f5f5f5',
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          {tr('حدث خطأ ما', 'Something went wrong')}
        </h2>

        {/* Description */}
        <p
          style={{
            fontSize: '14px',
            color: '#a3a3a3',
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          {tr(
            'نأسف، حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
            'Sorry, an unexpected error occurred. Please try again.'
          )}
        </p>

        {/* Dev-only error details */}
        {process.env.NODE_ENV === 'development' && error?.message && (
          <pre
            style={{
              width: '100%',
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '11px',
              textAlign: 'left',
              color: '#ef4444',
              overflow: 'auto',
              maxHeight: '128px',
              margin: 0,
            }}
          >
            {error.message}
          </pre>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: '#C9A84C',
              color: '#0f0f0f',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.85')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {tr('إعادة المحاولة', 'Try Again')}
          </button>

          <button
            onClick={() => (window.location.href = '/cvision')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: 'transparent',
              color: '#a3a3a3',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.borderColor = '#C9A84C';
              btn.style.color = '#C9A84C';
            }}
            onMouseLeave={e => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.borderColor = '#2a2a2a';
              btn.style.color = '#a3a3a3';
            }}
          >
            {tr('الذهاب إلى لوحة التحكم', 'Go to Dashboard')}
          </button>
        </div>

        {/* Error digest (support reference) */}
        {error.digest && (
          <p style={{ fontSize: '11px', color: '#525252', margin: 0 }}>
            {tr('معرف الخطأ', 'Error ID')}: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
