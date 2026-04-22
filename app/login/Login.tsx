'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '@/components/ThemeProvider';
import { Eye, EyeOff } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { THEA_UI } from '@/lib/thea-ui/tokens';

// ── Types ──

interface Tenant {
  tenantId: string;
  name: string;
  status: string;
}

type Step = 'email' | 'tenant' | 'password' | '2fa';

// ── Step helpers ──

const STEPS: Step[] = ['email', 'password', '2fa'];
function stepIndex(s: Step): number {
  if (s === 'tenant') return 0; // tenant shares the email dot
  return STEPS.indexOf(s);
}

// ── Transition variants ──

const stepVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

// ── Component ──

export default function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, setLanguage, isRTL } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  // ── Auth state (identical to LoginThea) ──

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const isDark = theme === 'dark';

  // ── Session expired check ──

  useEffect(() => {
    const sessionExpired = searchParams.get('sessionExpired');
    if (sessionExpired === 'true') {
      toast({
        title: language === 'ar' ? 'تم تسجيل الخروج' : 'Logged Out',
        description: language === 'ar'
          ? 'تم تسجيل خروجك لأنك سجلت الدخول من جهاز آخر.'
          : 'You were logged out because you signed in on another device.',
        variant: 'default',
      });
      router.replace('/login');
    }
  }, [searchParams, toast, language, router]);

  // ── Auth handlers (identical to LoginThea) ──

  const resetToEmail = () => {
    setStep('email');
    setPassword('');
    setTwoFactorToken('');
    setTempToken('');
    setSelectedTenantId('');
    setTenants([]);
    setError('');
  };

  async function parseAuthResponse(response: Response) {
    try {
      return await response.json();
    } catch {
      throw new Error(
        tr(
          'الخادم أرجع استجابة غير متوقعة. تحقق من إعدادات قاعدة البيانات ثم حاول مرة أخرى.',
          'Server returned an unexpected response. Check database setup and try again.',
        ),
      );
    }
  }

  async function handleIdentify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch('/api/auth/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await parseAuthResponse(response);
      if (!response.ok) {
        throw new Error(data.error || tr('خطأ في الشبكة. حاول مرة أخرى.', 'Network error. Please try again.'));
      }
      const tenantList = data.tenants || [];
      setTenants(tenantList);
      if (data.selectedTenant?.tenantId) {
        setSelectedTenantId(data.selectedTenant.tenantId);
        setStep('password');
      } else if (tenantList.length > 0) {
        if (tenantList.length === 1) {
          setSelectedTenantId(tenantList[0].tenantId);
        }
        setStep('tenant');
      } else {
        throw new Error(tr('لم يتم العثور على منشأة', 'No tenant found'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('خطأ في الشبكة. حاول مرة أخرى.', 'Network error. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  }

  function handleTenantContinue() {
    const isOwner = tenants.some((t) => t.tenantId === '__skip__');
    if (!isOwner && !selectedTenantId) {
      setError(tr('اختر المنشأة', 'Select a tenant'));
      return;
    }
    setError('');
    setStep('password');
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const isOwner = tenants.some((t) => t.tenantId === '__skip__');
      const tenantIdToSend =
        selectedTenantId === '__skip__' || (isOwner && !selectedTenantId)
          ? undefined
          : selectedTenantId;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          ...(tenantIdToSend && { tenantId: tenantIdToSend }),
        }),
        credentials: 'include',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await parseAuthResponse(response);
      if (!response.ok) {
        throw new Error(data.error || tr('كلمة مرور غير صحيحة', 'Invalid password'));
      }

      if (data?.requires2FA) {
        setTempToken(data.tempToken || '');
        setStep('2fa');
        return;
      }

      const redirectParam = searchParams.get('redirect');
      window.location.href = redirectParam || '/platforms';
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('خطأ في الشبكة. حاول مرة أخرى.', 'Network error. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handle2FALogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (twoFactorToken.length < 6) {
      setError(language === 'ar' ? 'أدخل رمز المصادقة' : 'Enter your 2FA code');
      return;
    }
    setIsLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch('/api/auth/login/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, token: twoFactorToken }),
        credentials: 'include',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await parseAuthResponse(response);
      if (!response.ok) {
        throw new Error(data.error || '2FA failed');
      }
      const redirectParam = searchParams.get('redirect');
      window.location.href = redirectParam || data.redirectTo || '/platforms';
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('خطأ في الشبكة. حاول مرة أخرى.', 'Network error. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  }

  const selectedTenant = tenants.find((t) => t.tenantId === selectedTenantId) || tenants[0];

  // ── Theme-aware color palette ──
  const lp = {
    bgBase:             isDark ? THEA_UI.sidebar.bg : '#f8fafc',
    bgGradientOverlay:  isDark ? 'rgba(29,78,216,0.1)' : 'rgba(29,78,216,0.05)',
    watermark:          isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
    cardBg:             isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)',
    cardBorder:         isDark ? 'rgba(148,163,184,0.15)' : 'rgba(203,213,225,0.6)',
    heading:            isDark ? '#FFFFFF' : '#0f172a',
    subText:            isDark ? 'rgba(148,163,184,0.8)' : 'rgba(71,85,105,0.8)',
    subTextFaint:       isDark ? 'rgba(148,163,184,0.6)' : 'rgba(100,116,139,0.7)',
    inputBg:            isDark ? 'rgba(255,255,255,0.05)' : 'rgba(241,245,249,1)',
    inputBorder:        isDark ? 'rgba(148,163,184,0.2)' : 'rgba(203,213,225,0.7)',
    inputFocusBg:       isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
    inputText:          isDark ? '#FFFFFF' : '#0f172a',
    toggleBg:           isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    toggleBorder:       isDark ? 'rgba(148,163,184,0.15)' : 'rgba(203,213,225,0.5)',
    toggleColor:        isDark ? THEA_UI.sidebar.textMuted : '#64748b',
    toggleHoverBg:      isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    toggleHoverColor:   isDark ? THEA_UI.sidebar.text : '#0f172a',
    tenantSelectedBg:   isDark ? 'rgba(29,78,216,0.08)' : 'rgba(29,78,216,0.05)',
    tenantDefaultBg:    isDark ? 'rgba(255,255,255,0.03)' : 'rgba(241,245,249,0.8)',
    secondaryBtnColor:  isDark ? 'rgba(226,232,240,0.8)' : '#334155',
    secondaryBtnBorder: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(203,213,225,0.5)',
    secondaryBtnHBorder:isDark ? 'rgba(148,163,184,0.4)' : 'rgba(203,213,225,0.8)',
    secondaryBtnHBg:    isDark ? 'rgba(255,255,255,0.03)' : 'rgba(241,245,249,0.6)',
    lockIcon:           isDark ? THEA_UI.sidebar.textMuted : '#94A3B8',
    errorBg:            isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)',
    errorBorder:        isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.25)',
    errorText:          isDark ? '#FCA5A5' : '#DC2626',
    dotInactive:        isDark ? '#334155' : '#CBD5E1',
  };

  // ── Render ──

  return (
    <div className="min-h-screen relative" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Background ── */}
      <div
        className="fixed inset-0 transition-colors duration-300"
        style={{
          background: `
            radial-gradient(circle at 30% 20%, ${lp.bgGradientOverlay} 0%, transparent 50%),
            ${lp.bgBase}
          `,
        }}
      />

      {/* ── Watermark ── */}
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

      {/* ── Theme / Language toggles ── */}
      <div
        className="fixed z-50 flex items-center gap-2"
        style={{
          top: 24,
          ...(isRTL ? { left: 24 } : { right: 24 }),
        }}
      >
        <button
          type="button"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          title={tr('المظهر', 'Theme')}
          aria-label={language === 'ar' ? (isDark ? 'التبديل للوضع الفاتح' : 'التبديل للوضع الداكن') : (isDark ? 'Switch to light mode' : 'Switch to dark mode')}
          className="thea-transition-fast"
          style={{
            padding: 8,
            borderRadius: 10,
            background: lp.toggleBg,
            border: `1px solid ${lp.toggleBorder}`,
            color: lp.toggleColor,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = lp.toggleHoverBg;
            e.currentTarget.style.color = lp.toggleHoverColor;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = lp.toggleBg;
            e.currentTarget.style.color = lp.toggleColor;
          }}
        >
          {isDark ? (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          title={tr('اللغة', 'Language')}
          aria-label={language === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
          className="thea-transition-fast"
          style={{
            padding: 8,
            borderRadius: 10,
            background: lp.toggleBg,
            border: `1px solid ${lp.toggleBorder}`,
            color: lp.toggleColor,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = lp.toggleHoverBg;
            e.currentTarget.style.color = lp.toggleHoverColor;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = lp.toggleBg;
            e.currentTarget.style.color = lp.toggleColor;
          }}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
        </button>
      </div>

      {/* ── Centered card ── */}
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

          {/* ── Step content ── */}
          <AnimatePresence mode="wait">
            {/* ═══ EMAIL STEP ═══ */}
            {step === 'email' && (
              <motion.div
                key="email"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.25 }}
              >
                <h1 style={{ fontSize: 28, fontWeight: 800, color: lp.heading, marginBottom: 8 }}>
                  {tr('مرحباً', 'Welcome')}
                </h1>
                <p style={{ fontSize: 15, color: lp.subText, marginBottom: 24 }}>
                  {tr('أدخل بريدك الإلكتروني للمتابعة', 'Enter your email to continue')}
                </p>

                <form onSubmit={handleIdentify} className="space-y-5" aria-label={tr('مرحباً', 'Welcome')}>
                  <TheaInput
                    type="email"
                    placeholder={tr('أدخل بريدك الإلكتروني', 'Enter your email')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    dir={isRTL ? 'rtl' : 'ltr'}
                    autoFocus
                    aria-label={tr('أدخل بريدك الإلكتروني', 'Enter your email')}
                    autoComplete="email"
                    dark={isDark}
                  />

                  {error && <TheaError message={error} dark={isDark} />}

                  <TheaPrimaryButton disabled={isLoading || !email} type="submit">
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner />
                        {tr('جاري التحقق...', 'Checking...')}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        {tr('متابعة', 'Continue')}
                        <ArrowIcon isRTL={isRTL} />
                      </span>
                    )}
                  </TheaPrimaryButton>
                </form>
              </motion.div>
            )}

            {/* ═══ TENANT STEP ═══ */}
            {step === 'tenant' && (
              <motion.div
                key="tenant"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.25 }}
              >
                <h1 style={{ fontSize: 28, fontWeight: 800, color: lp.heading, marginBottom: 8 }}>
                  {tr('تم العثور على المنشأة', 'Tenant found')}
                </h1>
                <p style={{ fontSize: 15, color: lp.subText, marginBottom: 24 }}>
                  {tr('متابعة مع المنشأة', 'Continue with organization')}
                </p>

                <div className="space-y-3" style={{ marginBottom: 20 }}>
                  {tenants.map((tenant) => {
                    const selected = selectedTenantId === tenant.tenantId;
                    return (
                      <button
                        key={tenant.tenantId}
                        type="button"
                        onClick={() => setSelectedTenantId(tenant.tenantId)}
                        className="w-full text-start thea-transition-fast"
                        aria-pressed={selected}
                        aria-label={`${language === 'ar' ? 'اختيار' : 'Select'} ${tenant.name}`}
                        style={{
                          padding: 16,
                          borderRadius: 14,
                          background: selected ? lp.tenantSelectedBg : lp.tenantDefaultBg,
                          border: `1.5px solid ${selected ? THEA_UI.colors.primary : lp.cardBorder}`,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontWeight: 600, color: lp.heading, fontSize: 14 }}>
                          {tenant.name}
                        </div>
                        <div style={{ color: lp.lockIcon, fontSize: 11, marginTop: 2 }}>
                          {tenant.tenantId}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {error && <TheaError message={error} dark={isDark} />}

                <div className="grid grid-cols-2 gap-3" style={{ marginTop: 20 }}>
                  <TheaSecondaryButton onClick={resetToEmail} dark={isDark}>
                    {tr('رجوع', 'Back')}
                  </TheaSecondaryButton>
                  <TheaPrimaryButton onClick={handleTenantContinue}>
                    {tr('متابعة', 'Continue')}
                  </TheaPrimaryButton>
                </div>
              </motion.div>
            )}

            {/* ═══ PASSWORD STEP ═══ */}
            {step === 'password' && (
              <motion.div
                key="password"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.25 }}
              >
                <h1 style={{ fontSize: 28, fontWeight: 800, color: lp.heading, marginBottom: 8 }}>
                  {tr('أدخل كلمة المرور', 'Enter your password')}
                </h1>
                <p style={{ fontSize: 15, color: lp.subText, marginBottom: 4 }}>
                  {tr('مرحباً بعودتك إلى', 'Welcome back to')} {selectedTenant?.name || ''}
                </p>
                <p style={{ fontSize: 13, color: lp.subTextFaint, marginBottom: 24 }}>
                  {email}
                </p>

                <form onSubmit={handleLogin} className="space-y-5">
                  {/* Password input with lock + eye */}
                  <div className="relative">
                    {/* Lock icon */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 z-10"
                      style={{
                        ...(isRTL ? { right: 14 } : { left: 14 }),
                        color: lp.lockIcon,
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder={tr('كلمة المرور', 'Password')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      dir={isRTL ? 'rtl' : 'ltr'}
                      aria-label={tr('كلمة المرور', 'Password')}
                      autoComplete="current-password"
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
                    {/* Eye toggle */}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute top-1/2 -translate-y-1/2 thea-transition-fast"
                      aria-label={language === 'ar' ? (showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور') : (showPassword ? 'Hide password' : 'Show password')}
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
                    {/* Progress bar */}
                    <div
                      className="absolute bottom-0 h-0.5 rounded-b-xl overflow-hidden"
                      style={{
                        left: 1,
                        right: 1,
                      }}
                    >
                      <div
                        className="h-full thea-transition-fast"
                        style={{
                          background: `linear-gradient(to right, ${THEA_UI.colors.primary}, #2563EB)`,
                          transform: `scaleX(${Math.min(password.length / 12, 1)})`,
                          transformOrigin: isRTL ? 'right' : 'left',
                        }}
                      />
                    </div>
                  </div>

                  {error && <TheaError message={error} dark={isDark} />}

                  <div className="grid grid-cols-2 gap-3">
                    <TheaSecondaryButton onClick={() => setStep('tenant')} dark={isDark}>
                      {tr('رجوع', 'Back')}
                    </TheaSecondaryButton>
                    <TheaPrimaryButton disabled={isLoading || !password} type="submit">
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <Spinner />
                          {tr('جاري تسجيل الدخول...', 'Signing in...')}
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          {tr('دخول', 'Sign in')}
                          <ArrowIcon isRTL={isRTL} />
                        </span>
                      )}
                    </TheaPrimaryButton>
                  </div>

                  <div className="text-center" style={{ marginTop: 12 }}>
                    <a
                      href="/forgot-password"
                      style={{
                        color: isDark ? '#60a5fa' : '#1D4ED8',
                        fontSize: 13,
                        textDecoration: 'none',
                      }}
                    >
                      {tr('نسيت كلمة المرور؟', 'Forgot your password?')}
                    </a>
                  </div>
                </form>
              </motion.div>
            )}

            {/* ═══ 2FA STEP ═══ */}
            {step === '2fa' && (
              <motion.div
                key="2fa"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.25 }}
              >
                <h1 style={{ fontSize: 28, fontWeight: 800, color: lp.heading, marginBottom: 8 }}>
                  {language === 'ar' ? 'رمز المصادقة' : 'Two-factor code'}
                </h1>
                <p style={{ fontSize: 13, color: lp.subTextFaint, marginBottom: 24 }}>
                  {email}
                </p>

                <form onSubmit={handle2FALogin} className="space-y-5" aria-label={language === 'ar' ? 'رمز المصادقة الثنائية' : 'Two-factor authentication'}>
                  <input
                    type="text"
                    value={twoFactorToken}
                    onChange={(e) =>
                      setTwoFactorToken(
                        e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
                      )
                    }
                    placeholder="000000"
                    maxLength={8}
                    autoFocus
                    aria-label={language === 'ar' ? 'رمز المصادقة' : 'Authentication code'}
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    className="w-full thea-transition-fast"
                    style={{
                      padding: '14px 16px',
                      background: lp.inputBg,
                      border: `1.5px solid ${lp.inputBorder}`,
                      borderRadius: 12,
                      color: lp.inputText,
                      fontSize: 18,
                      fontFamily: 'monospace',
                      letterSpacing: '0.3em',
                      textAlign: 'center',
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

                  {error && <TheaError message={error} dark={isDark} />}

                  <div className="grid grid-cols-2 gap-3">
                    <TheaSecondaryButton onClick={() => setStep('password')} dark={isDark}>
                      {tr('رجوع', 'Back')}
                    </TheaSecondaryButton>
                    <TheaPrimaryButton disabled={isLoading || !twoFactorToken} type="submit">
                      {isLoading ? tr('جاري تسجيل الدخول...', 'Signing in...') : (language === 'ar' ? 'تأكيد' : 'Verify')}
                    </TheaPrimaryButton>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Step progress dots ── */}
          <div className="flex items-center justify-center gap-2 mt-8" role="progressbar" aria-label={language === 'ar' ? 'خطوات تسجيل الدخول' : 'Login steps progress'} aria-valuenow={stepIndex(step) + 1} aria-valuemin={1} aria-valuemax={STEPS.length}>
            {STEPS.map((s, idx) => {
              const current = stepIndex(step);
              const isActive = idx === current;
              const isCompleted = idx < current;
              return (
                <div
                  key={s}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: THEA_UI.radius.pill,
                    background: isActive || isCompleted ? THEA_UI.colors.primary : lp.dotInactive,
                    boxShadow: isActive ? `0 0 8px ${THEA_UI.colors.primary}` : 'none',
                    transition: `all ${THEA_UI.animation.duration.fast} ${THEA_UI.animation.ease}`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// ── Shared sub-components (local to this file) ──
// ═══════════════════════════════════════════════

function TheaInput(props: React.InputHTMLAttributes<HTMLInputElement> & { dark?: boolean }) {
  const { dark = true, ...inputProps } = props;
  const bg     = dark ? 'rgba(255,255,255,0.05)' : 'rgba(241,245,249,1)';
  const border = dark ? 'rgba(148,163,184,0.2)' : 'rgba(203,213,225,0.7)';
  const focusBg = dark ? 'rgba(255,255,255,0.08)' : '#FFFFFF';
  const textColor = dark ? '#FFFFFF' : '#0f172a';

  return (
    <input
      {...inputProps}
      className={`w-full thea-transition-fast ${inputProps.className || ''}`}
      style={{
        padding: '14px 16px',
        background: bg,
        border: `1.5px solid ${border}`,
        borderRadius: 12,
        color: textColor,
        fontSize: 14,
        outline: 'none',
        ...inputProps.style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = THEA_UI.colors.primary;
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(29,78,216,0.15)';
        e.currentTarget.style.background = focusBg;
        inputProps.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = border;
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.background = bg;
        inputProps.onBlur?.(e);
      }}
    />
  );
}

function TheaPrimaryButton({
  children,
  disabled,
  onClick,
  type = 'button',
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="w-full thea-transition-fast"
      style={{
        padding: 14,
        background: 'linear-gradient(135deg, #1D4ED8, #2563EB)',
        border: 'none',
        borderRadius: 12,
        color: 'white',
        fontWeight: 700,
        fontSize: 14,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(29,78,216,0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {children}
    </button>
  );
}

function TheaSecondaryButton({
  children,
  onClick,
  dark = true,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  dark?: boolean;
}) {
  const textColor = dark ? 'rgba(226,232,240,0.8)' : '#334155';
  const borderColor = dark ? 'rgba(148,163,184,0.2)' : 'rgba(203,213,225,0.5)';
  const hoverBorder = dark ? 'rgba(148,163,184,0.4)' : 'rgba(203,213,225,0.8)';
  const hoverBg = dark ? 'rgba(255,255,255,0.03)' : 'rgba(241,245,249,0.6)';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full thea-transition-fast"
      style={{
        padding: '12px 20px',
        background: 'transparent',
        border: `1px solid ${borderColor}`,
        borderRadius: 12,
        color: textColor,
        fontSize: 13,
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = hoverBorder;
        e.currentTarget.style.background = hoverBg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = borderColor;
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

function TheaError({ message, dark = true }: { message: string; dark?: boolean }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        padding: '12px 16px',
        borderRadius: 12,
        background: dark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)',
        border: dark ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(239,68,68,0.25)',
        color: dark ? '#FCA5A5' : '#DC2626',
        fontSize: 13,
      }}
    >
      {message}
    </div>
  );
}

function Spinner() {
  return (
    <div
      className="animate-spin"
      style={{
        width: 18,
        height: 18,
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: 'white',
        borderRadius: '50%',
      }}
    />
  );
}

function ArrowIcon({ isRTL }: { isRTL: boolean }) {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      style={{ transform: isRTL ? 'scaleX(-1)' : undefined }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  );
}
