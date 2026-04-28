'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useLang } from '@/hooks/use-lang';
import { THEA_UI } from '@/lib/thea-ui/tokens';

// Password strength checks
function getPasswordStrength(password: string) {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  return { checks, passed, total: 4 };
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = language === 'ar';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

  const strengthColor = strength.passed <= 1 ? '#ef4444'
    : strength.passed === 2 ? '#f59e0b'
    : strength.passed === 3 ? '#3b82f6'
    : '#22c55e';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!token) {
      setError(tr('رمز إعادة التعيين مفقود', 'Reset token is missing'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(tr('كلمات المرور غير متطابقة', 'Passwords do not match'));
      return;
    }

    if (strength.passed < 4) {
      setError(tr('كلمة المرور لا تستوفي المتطلبات', 'Password does not meet the requirements'));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || tr('حدث خطأ. حاول مرة أخرى.', 'An error occurred. Please try again.'));
      }

      setSuccess(true);
      // Redirect to login after 3 seconds
      setTimeout(() => router.push('/login'), 3000);
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
    lockIcon: isDark ? THEA_UI.sidebar.textMuted : '#94A3B8',
    linkColor: isDark ? '#60a5fa' : '#1D4ED8',
    successBg: isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.08)',
    successBorder: isDark ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.25)',
    successText: isDark ? '#86efac' : '#16a34a',
    errorBg: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)',
    errorBorder: isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.25)',
    errorText: isDark ? '#FCA5A5' : '#DC2626',
    checkPassedColor: isDark ? '#86efac' : '#16a34a',
    checkFailedColor: isDark ? 'rgba(148,163,184,0.5)' : 'rgba(100,116,139,0.5)',
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

          {!token ? (
            /* No token provided */
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: lp.heading, marginBottom: 8 }}>
                {tr('رابط غير صالح', 'Invalid link')}
              </h1>
              <p style={{ fontSize: 15, color: lp.subText, marginBottom: 24 }}>
                {tr(
                  'رابط إعادة تعيين كلمة المرور غير صالح أو مفقود.',
                  'The password reset link is invalid or missing.'
                )}
              </p>
              <Link
                href="/forgot-password"
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
                {tr('طلب رابط جديد', 'Request a new link')}
              </Link>
            </div>
          ) : success ? (
            /* Success state */
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: lp.heading, marginBottom: 8 }}>
                {tr('تم إعادة التعيين', 'Password reset')}
              </h1>
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
                  'تم إعادة تعيين كلمة المرور بنجاح. جاري التحويل لصفحة تسجيل الدخول...',
                  'Your password has been reset successfully. Redirecting to login...'
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
                {tr('تسجيل الدخول', 'Go to login')}
              </Link>
            </div>
          ) : (
            /* Reset form */
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: lp.heading, marginBottom: 8 }}>
                {tr('إعادة تعيين كلمة المرور', 'Reset your password')}
              </h1>
              <p style={{ fontSize: 15, color: lp.subText, marginBottom: 24 }}>
                {tr('أدخل كلمة المرور الجديدة', 'Enter your new password')}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New password */}
                <div className="relative">
                  <div
                    className="absolute top-1/2 -translate-y-1/2 z-10"
                    style={{ ...(isRTL ? { right: 14 } : { left: 14 }), color: lp.lockIcon }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={tr('كلمة المرور الجديدة', 'New password')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    dir={isRTL ? 'rtl' : 'ltr'}
                    aria-label={tr('كلمة المرور الجديدة', 'New password')}
                    autoComplete="new-password"
                    className="w-full thea-transition-fast"
                    style={{
                      padding: '14px 44px',
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
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-1/2 -translate-y-1/2"
                    aria-label={tr(showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور', showPassword ? 'Hide password' : 'Show password')}
                    style={{
                      ...(isRTL ? { left: 14 } : { right: 14 }),
                      color: lp.lockIcon,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  {/* Strength bar */}
                  <div
                    className="absolute bottom-0 h-0.5 rounded-b-xl overflow-hidden"
                    style={{ left: 1, right: 1 }}
                  >
                    <div
                      className="h-full thea-transition-fast"
                      style={{
                        background: strengthColor,
                        transform: `scaleX(${strength.passed / strength.total})`,
                        transformOrigin: isRTL ? 'right' : 'left',
                      }}
                    />
                  </div>
                </div>

                {/* Password strength indicator */}
                {newPassword.length > 0 && (
                  <div className="space-y-1" style={{ fontSize: 12 }}>
                    {[
                      { key: 'length' as const, ar: '8 أحرف على الأقل', en: 'At least 8 characters' },
                      { key: 'uppercase' as const, ar: 'حرف كبير واحد على الأقل', en: 'At least one uppercase letter' },
                      { key: 'lowercase' as const, ar: 'حرف صغير واحد على الأقل', en: 'At least one lowercase letter' },
                      { key: 'digit' as const, ar: 'رقم واحد على الأقل', en: 'At least one digit' },
                    ].map(({ key, ar, en }) => (
                      <div
                        key={key}
                        className="flex items-center gap-2"
                        style={{
                          color: strength.checks[key] ? lp.checkPassedColor : lp.checkFailedColor,
                        }}
                      >
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {strength.checks[key] ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          ) : (
                            <circle cx="12" cy="12" r="8" strokeWidth={2} />
                          )}
                        </svg>
                        <span>{tr(ar, en)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Confirm password */}
                <div className="relative">
                  <div
                    className="absolute top-1/2 -translate-y-1/2 z-10"
                    style={{ ...(isRTL ? { right: 14 } : { left: 14 }), color: lp.lockIcon }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    placeholder={tr('تأكيد كلمة المرور', 'Confirm password')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    dir={isRTL ? 'rtl' : 'ltr'}
                    aria-label={tr('تأكيد كلمة المرور', 'Confirm password')}
                    autoComplete="new-password"
                    className="w-full thea-transition-fast"
                    style={{
                      padding: '14px 44px',
                      background: lp.inputBg,
                      border: `1.5px solid ${confirmPassword && confirmPassword !== newPassword ? lp.errorBorder : lp.inputBorder}`,
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
                      const mismatch = confirmPassword && confirmPassword !== newPassword;
                      e.currentTarget.style.borderColor = mismatch ? lp.errorBorder : lp.inputBorder;
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.background = lp.inputBg;
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute top-1/2 -translate-y-1/2"
                    aria-label={tr(showConfirm ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور', showConfirm ? 'Hide password' : 'Show password')}
                    style={{
                      ...(isRTL ? { left: 14 } : { right: 14 }),
                      color: lp.lockIcon,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {showConfirm ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                </div>

                {/* Mismatch warning */}
                {confirmPassword && confirmPassword !== newPassword && (
                  <div style={{ color: lp.errorText, fontSize: 12 }}>
                    {tr('كلمات المرور غير متطابقة', 'Passwords do not match')}
                  </div>
                )}

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
                  disabled={isLoading || !newPassword || !confirmPassword || strength.passed < 4 || newPassword !== confirmPassword}
                  className="w-full thea-transition-fast"
                  style={{
                    padding: 14,
                    background: 'linear-gradient(135deg, #1D4ED8, #2563EB)',
                    border: 'none',
                    borderRadius: 12,
                    color: 'white',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: isLoading || !newPassword || !confirmPassword || strength.passed < 4 || newPassword !== confirmPassword ? 'not-allowed' : 'pointer',
                    opacity: isLoading || !newPassword || !confirmPassword || strength.passed < 4 || newPassword !== confirmPassword ? 0.5 : 1,
                  }}
                >
                  {isLoading
                    ? tr('جاري إعادة التعيين...', 'Resetting...')
                    : tr('إعادة تعيين كلمة المرور', 'Reset password')}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
