'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from '@/components/ThemeProvider';
import { useLang } from '@/hooks/use-lang';
import { THEA_UI } from '@/lib/thea-ui/tokens';

export default function ForgotPasswordPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = language === 'ar';

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || tr('حدث خطأ. حاول مرة أخرى.', 'An error occurred. Please try again.'));
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('حدث خطأ. حاول مرة أخرى.', 'An error occurred. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  }

  // Theme-aware palette (matching login page)
  const lp = {
    bgBase: isDark ? THEA_UI.sidebar.bg : '#f8fafc',
    bgGradientOverlay: isDark ? 'rgba(29,78,216,0.1)' : 'rgba(29,78,216,0.05)',
    watermark: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
    cardBg: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)',
    cardBorder: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(203,213,225,0.6)',
    heading: isDark ? '#FFFFFF' : '#0f172a',
    subText: isDark ? 'rgba(148,163,184,0.8)' : 'rgba(71,85,105,0.8)',
    inputBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(241,245,249,1)',
    inputBorder: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(203,213,225,0.7)',
    inputFocusBg: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
    inputText: isDark ? '#FFFFFF' : '#0f172a',
    linkColor: isDark ? '#60a5fa' : '#1D4ED8',
    successBg: isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.08)',
    successBorder: isDark ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.25)',
    successText: isDark ? '#86efac' : '#16a34a',
    errorBg: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)',
    errorBorder: isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.25)',
    errorText: isDark ? '#FCA5A5' : '#DC2626',
  };

  return (
    <div className="min-h-screen relative" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Background */}
      <div
        className="fixed inset-0 transition-colors duration-300"
        style={{
          background: `
            radial-gradient(circle at 30% 20%, ${lp.bgGradientOverlay} 0%, transparent 50%),
            ${lp.bgBase}
          `,
        }}
      />

      {/* Watermark */}
      <div
        className="fixed inset-0 flex items-center justify-center pointer-events-none select-none"
        aria-hidden="true"
        style={{
          fontSize: 'clamp(120px, 20vw, 280px)',
          fontWeight: 700,
          letterSpacing: '0.2em',
          color: lp.watermark,
          filter: 'blur(4px)',
        }}
      >
        THEA
      </div>

      {/* Centered card */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div
          className="w-full transition-colors duration-300"
          style={{
            maxWidth: 420,
            background: lp.cardBg,
            border: `1px solid ${lp.cardBorder}`,
            borderRadius: 24,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            padding: 40,
          }}
        >
          {/* Logo */}
          <div className="flex justify-center" style={{ marginBottom: 32 }}>
            <Image
              src={isDark ? '/brand/main/thea-logo-dark.svg' : '/brand/main/thea-logo.svg'}
              alt="Thea"
              width={323}
              height={110}
              className="h-auto"
              style={{ width: 323 }}
              priority
            />
          </div>

          <h1 style={{ fontSize: 28, fontWeight: 800, color: lp.heading, marginBottom: 8 }}>
            {tr('نسيت كلمة المرور؟', 'Forgot your password?')}
          </h1>
          <p style={{ fontSize: 15, color: lp.subText, marginBottom: 24 }}>
            {tr(
              'أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة تعيين كلمة المرور',
              'Enter your email and we\'ll send you a password reset link'
            )}
          </p>

          {submitted ? (
            <div>
              {/* Success message */}
              <div
                role="status"
                style={{
                  padding: '16px 20px',
                  borderRadius: 12,
                  background: lp.successBg,
                  border: `1px solid ${lp.successBorder}`,
                  color: lp.successText,
                  fontSize: 14,
                  lineHeight: 1.6,
                  marginBottom: 24,
                }}
              >
                {tr(
                  'إذا كان هناك حساب مرتبط بهذا البريد الإلكتروني، فسيتم إرسال رابط إعادة تعيين كلمة المرور.',
                  'If an account exists with that email, a password reset link has been sent.'
                )}
              </div>
              <Link
                href="/login"
                className="block w-full text-center thea-transition-fast"
                style={{
                  padding: 14,
                  background: 'linear-gradient(135deg, #1D4ED8, #2563EB)',
                  borderRadius: 12,
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 14,
                  textDecoration: 'none',
                }}
              >
                {tr('العودة لتسجيل الدخول', 'Back to login')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <input
                type="email"
                placeholder={tr('أدخل بريدك الإلكتروني', 'Enter your email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir={isRTL ? 'rtl' : 'ltr'}
                autoFocus
                aria-label={tr('البريد الإلكتروني', 'Email')}
                autoComplete="email"
                className="w-full thea-transition-fast"
                style={{
                  padding: '14px 16px',
                  background: lp.inputBg,
                  border: `1.5px solid ${lp.inputBorder}`,
                  borderRadius: 12,
                  color: lp.inputText,
                  fontSize: 14,
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = THEA_UI.colors.primary;
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(29,78,216,0.15)';
                  e.currentTarget.style.background = lp.inputFocusBg;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = lp.inputBorder;
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.background = lp.inputBg;
                }}
              />

              {error && (
                <div
                  role="alert"
                  aria-live="assertive"
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: lp.errorBg,
                    border: `1px solid ${lp.errorBorder}`,
                    color: lp.errorText,
                    fontSize: 13,
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full thea-transition-fast"
                style={{
                  padding: 14,
                  background: 'linear-gradient(135deg, #1D4ED8, #2563EB)',
                  border: 'none',
                  borderRadius: 12,
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: isLoading || !email ? 'not-allowed' : 'pointer',
                  opacity: isLoading || !email ? 0.5 : 1,
                }}
              >
                {isLoading
                  ? tr('جاري الإرسال...', 'Sending...')
                  : tr('إرسال رابط إعادة التعيين', 'Send reset link')}
              </button>

              <div className="text-center" style={{ marginTop: 16 }}>
                <Link
                  href="/login"
                  style={{
                    color: lp.linkColor,
                    fontSize: 14,
                    textDecoration: 'none',
                  }}
                >
                  {tr('العودة لتسجيل الدخول', 'Back to login')}
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
