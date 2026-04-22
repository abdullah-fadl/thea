'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '@/components/ThemeProvider';
import { Eye, EyeOff } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';

interface Tenant {
  tenantId: string;
  name: string;
  status: string;
}

type Step = 'email' | 'tenant' | 'password' | '2fa';

export default function LoginThea() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, setLanguage, isRTL } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

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
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const isDark = theme === 'dark';
  const colors = useMemo(
    () => ({
      primary: isDark ? '#22D3EE' : '#0891B2',
      secondary: isDark ? '#38BDF8' : '#0EA5E9',
    }),
    [isDark]
  );
  const bgTextColor = isDark
    ? 'rgba(255, 255, 255, 0.06)'
    : 'rgba(8, 145, 178, 0.06)';

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
      const response = await fetch('/api/auth/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });
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

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          ...(tenantIdToSend && { tenantId: tenantIdToSend }),
        }),
        credentials: 'include',
      });

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
      const response = await fetch('/api/auth/login/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, token: twoFactorToken }),
        credentials: 'include',
      });
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

  return (
    <div className={`min-h-screen transition-all duration-500 ${isDark ? 'dark' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div
        id="login-container"
        className={`min-h-screen flex items-center justify-center p-4 overflow-hidden transition-colors duration-500 ${
          isDark ? 'bg-gradient-to-br from-gray-900 via-slate-900 to-black' : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
        }`}
        style={{
          background: isDark
            ? `
              radial-gradient(circle at 30% 20%, ${colors.primary}1A 0%, transparent 50%),
              radial-gradient(circle at 70% 80%, ${colors.secondary}1A 0%, transparent 50%),
              linear-gradient(135deg, #0f172a 0%, #020617 100%)
            `
            : `
              radial-gradient(circle at 30% 20%, ${colors.primary}0D 0%, transparent 50%),
              radial-gradient(circle at 70% 80%, ${colors.secondary}0D 0%, transparent 50%),
              linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)
            `,
        }}
      >
        <div className="absolute top-6 right-6 flex items-center gap-3 z-50">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`p-2 rounded-xl backdrop-blur-sm border transition-all duration-200 ${
              isDark ? 'bg-slate-800/80 border-gray-700 hover:bg-slate-800' : 'bg-white/80 border-border hover:bg-card'
            }`}
            title={tr('المظهر', 'Theme')}
          >
            {isDark ? (
              <svg className="h-4 w-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="h-4 w-4 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className={`p-2 rounded-xl backdrop-blur-sm border transition-all duration-200 ${
              isDark ? 'bg-slate-800/80 border-gray-700 hover:bg-slate-800' : 'bg-white/80 border-border hover:bg-card'
            }`}
            title={tr('اللغة', 'Language')}
          >
            <svg className={`h-4 w-4 ${isDark ? 'text-muted-foreground' : 'text-foreground'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
          </button>
        </div>

        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div
            className="absolute inset-0 flex items-center justify-center select-none"
            style={{
              fontSize: 'clamp(120px, 22vw, 320px)',
              fontWeight: 700,
              letterSpacing: '0.2em',
              color: bgTextColor,
              filter: 'blur(6px)',
            }}
          >
            THEA
          </div>
        </div>

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full opacity-30"
              style={{
                backgroundColor: colors.primary,
                left: `${(i * 7) % 100}%`,
                top: `${(i * 13) % 100}%`,
                animation: `float ${3 + (i % 4)}s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>

        <div className="relative perspective-1000">
          <div
            className="relative w-full max-w-5xl h-[620px] transform-gpu transition-transform duration-300 preserve-3d"
            style={{
              opacity: 1,
              scale: 1,
              transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              const centerX = rect.width / 2;
              const centerY = rect.height / 2;
              const rotateX = ((y - centerY) / centerY) * -6;
              const rotateY = ((x - centerX) / centerX) * 6;
              setTilt({ x: rotateX, y: rotateY });
            }}
            onMouseLeave={() => setTilt({ x: 0, y: 0 })}
          >
            <div
              className={`relative w-full h-full rounded-3xl overflow-hidden transform-gpu transition-all duration-500 ${
                isDark ? 'shadow-2xl shadow-black/50' : 'shadow-2xl shadow-gray-500/20'
              }`}
              style={{
                background: isDark
                  ? `linear-gradient(135deg, ${colors.primary}1A 0%, rgba(0, 0, 0, 0.85) 30%, rgba(0, 0, 0, 0.95) 70%, ${colors.primary}1A 100%)`
                  : `linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.7) 30%, rgba(255, 255, 255, 0.8) 70%, rgba(255, 255, 255, 0.9) 100%)`,
                backdropFilter: 'blur(20px)',
                border: `1px solid ${colors.primary}4D`,
                boxShadow: isDark
                  ? `0 0 60px ${colors.primary}66, inset 0 0 60px ${colors.primary}1A, 0 8px 32px rgba(0, 0, 0, 0.8)`
                  : `0 0 60px ${colors.primary}33, inset 0 0 60px ${colors.primary}0D, 0 8px 32px rgba(0, 0, 0, 0.1)`,
              }}
            >
              <div className="absolute inset-0 rounded-3xl">
                <div
                  className="absolute inset-0 rounded-3xl opacity-75"
                  style={{
                    background: `linear-gradient(45deg, ${colors.primary}66, transparent, ${colors.primary}66)`,
                    animation: 'border-glow 3s ease-in-out infinite alternate',
                  }}
                />
              </div>

              <div className="relative h-full flex">
                <div className="flex-1 flex flex-col justify-center p-10 z-10 max-w-md">
                  <div className="mb-6 flex justify-center">
                    <Image
                      src={isDark ? '/brand/main/thea-logo-dark.svg' : '/brand/main/thea-logo.svg'}
                      alt="Thea"
                      width={260}
                      height={90}
                      className="w-52 sm:w-60 h-auto"
                      priority
                    />
                  </div>
                  <AnimatePresence mode="wait">
                    {step === 'email' && (
                      <motion.div
                        key="email"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                      >
                        <div>
                          <h1 className={`text-4xl font-bold mb-3 tracking-wide ${isDark ? 'text-white' : 'text-foreground'}`}>
                            {tr('مرحباً', 'Welcome')}
                          </h1>
                          <p className={`text-lg mb-6 ${isDark ? 'text-cyan-200/80' : 'text-muted-foreground'}`}>
                            {tr('أدخل بريدك الإلكتروني للمتابعة', 'Enter your email to continue')}
                          </p>
                        </div>

                        <form onSubmit={handleIdentify} className="space-y-6">
                          <div className="relative group border border-black bg-white/0 shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]">
                            <input
                              type="email"
                              placeholder={tr('أدخل بريدك الإلكتروني', 'Enter your email')}
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className={`w-full px-4 py-4 bg-transparent border-b-2 transition-all duration-300 outline-none text-base text-center placeholder:text-sm ${
                                isDark
                                  ? 'border-gray-600 focus:border-cyan-400 text-white placeholder-gray-400 group-hover:border-border0'
                                  : 'border-border focus:border-blue-500 text-foreground placeholder-gray-500 group-hover:border-border'
                              }`}
                              style={{
                                background: isDark ? 'rgba(15, 23, 42, 0.35)' : 'rgba(255, 255, 255, 0.55)',
                                backdropFilter: 'blur(10px)',
                                borderColor: email ? colors.primary : undefined,
                              }}
                              required
                              dir={isRTL ? 'rtl' : 'ltr'}
                            />
                            <div
                              className="absolute bottom-0 w-full h-0.5 transition-all duration-300"
                              style={{
                                background: `linear-gradient(to right, ${colors.primary}, ${colors.secondary})`,
                                transform: `scaleX(${email ? 1 : 0})`,
                                transformOrigin: isRTL ? 'right' : 'left',
                              }}
                            />
                          </div>

                          {error && (
                            <div className={`p-4 rounded-xl border backdrop-blur-sm ${
                              isDark ? 'bg-red-500/10 border-red-400/20' : 'bg-red-50/80 border-red-200/50'
                            }`}>
                              <div className="flex items-center gap-3">
                                <svg className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-red-400' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                                  {error}
                                </p>
                              </div>
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={isLoading || !email}
                            className="w-full py-4 px-8 rounded-xl font-semibold text-white transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                              boxShadow: `0 10px 30px ${colors.primary}66, inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                              border: `1px solid ${colors.primary}4D`,
                            }}
                          >
                            <div className="flex items-center justify-center gap-2">
                              {isLoading ? (
                                <>
                                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  {tr('جاري التحقق...', 'Checking...')}
                                </>
                              ) : (
                                <>
                                  {tr('متابعة', 'Continue')}
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                  </svg>
                                </>
                              )}
                            </div>
                          </button>
                        </form>
                      </motion.div>
                    )}

                    {step === 'tenant' && (
                      <motion.div
                        key="tenant"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                      >
                        <div>
                          <h1 className={`text-4xl font-bold mb-3 tracking-wide ${isDark ? 'text-white' : 'text-foreground'}`}>
                            {tr('تم العثور على المنشأة', 'Tenant found')}
                          </h1>
                          <p className={`text-lg mb-6 ${isDark ? 'text-cyan-200/80' : 'text-muted-foreground'}`}>
                            {tr('متابعة مع المنشأة', 'Continue with organization')}
                          </p>
                        </div>

                        <div className="space-y-3">
                          {tenants.map((tenant) => (
                            <button
                              key={tenant.tenantId}
                              type="button"
                              onClick={() => setSelectedTenantId(tenant.tenantId)}
                              className={`w-full p-4 rounded-2xl border backdrop-blur-sm text-left transition-all duration-200 ${
                                selectedTenantId === tenant.tenantId
                                  ? 'ring-2 ring-offset-2 ring-offset-transparent'
                                  : ''
                              } ${isDark ? 'bg-cyan-500/10 border-cyan-400/20' : 'bg-white/80 border-blue-200/50'}`}
                              style={{ borderColor: selectedTenantId === tenant.tenantId ? colors.primary : undefined }}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className={`font-semibold ${isDark ? 'text-white' : 'text-foreground'}`}>{tenant.name}</div>
                                  <div className={`text-xs ${isDark ? 'text-cyan-200/70' : 'text-muted-foreground'}`}>{tenant.tenantId}</div>
                                </div>
                                {selectedTenantId === tenant.tenantId && (
                                  <span className="text-xs font-medium" style={{ color: colors.primary }}>
                                    {tr('متابعة', 'Continue')}
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>

                        {error && (
                          <div className={`p-4 rounded-xl border backdrop-blur-sm ${
                            isDark ? 'bg-red-500/10 border-red-400/20' : 'bg-red-50/80 border-red-200/50'
                          }`}>
                            <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{error}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <button
                            type="button"
                            onClick={resetToEmail}
                            className={`py-3 px-6 rounded-xl font-medium border transition-all duration-200 flex items-center justify-center gap-2 ${
                              isDark ? 'text-muted-foreground border-gray-600 hover:border-border0 hover:bg-gray-800/30' : 'text-muted-foreground border-border hover:border-border hover:bg-muted/50'
                            }`}
                          >
                            {tr('رجوع', 'Back')}
                          </button>
                          <button
                            type="button"
                            onClick={handleTenantContinue}
                            className="py-3 px-6 rounded-xl font-semibold text-white transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
                            style={{
                              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                              boxShadow: `0 10px 30px ${colors.primary}66`,
                              border: `1px solid ${colors.primary}4D`,
                            }}
                          >
                            {tr('متابعة', 'Continue')}
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {step === 'password' && (
                      <motion.div
                        key="password"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                      >
                        <div>
                          <h1 className={`text-4xl font-bold mb-3 tracking-wide ${isDark ? 'text-white' : 'text-foreground'}`}>
                            {tr('أدخل كلمة المرور', 'Enter your password')}
                          </h1>
                          <p className={`text-lg mb-2 ${isDark ? 'text-cyan-200/80' : 'text-muted-foreground'}`}>
                            {tr('مرحباً بعودتك إلى', 'Welcome back to')} {selectedTenant?.name || ''}
                          </p>
                          <p className={`text-sm mb-6 ${isDark ? 'text-cyan-200/60' : 'text-muted-foreground'}`}>
                            {email}
                          </p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-6">
                          <div className="relative group border border-black bg-white/0 shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]">
                            <div className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 z-10`} style={{ color: colors.primary }}>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            </div>
                            <input
                              type={showPassword ? 'text' : 'password'}
                              placeholder={tr('كلمة المرور', 'Password')}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className={`w-full ${isRTL ? 'pr-12 pl-12' : 'pl-12 pr-12'} py-4 bg-transparent border-b-2 transition-all duration-300 outline-none text-lg ${
                                isDark
                                  ? 'border-gray-600 focus:border-cyan-400 text-white placeholder-gray-400 group-hover:border-border0'
                                  : 'border-border focus:border-blue-500 text-foreground placeholder-gray-500 group-hover:border-border'
                              }`}
                              style={{
                                background: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.8)',
                                backdropFilter: 'blur(10px)',
                                borderColor: password ? colors.primary : undefined,
                              }}
                              required
                              dir={isRTL ? 'rtl' : 'ltr'}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 transition-colors ${
                                isDark ? 'text-muted-foreground hover:text-cyan-400' : 'text-muted-foreground hover:text-blue-500'
                              }`}
                            >
                              {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                            </button>
                            <div
                              className="absolute bottom-0 w-full h-0.5 transition-all duration-300"
                              style={{
                                background: `linear-gradient(to right, ${colors.primary}, ${colors.secondary})`,
                                transform: `scaleX(${password ? 1 : 0})`,
                                transformOrigin: isRTL ? 'right' : 'left',
                              }}
                            />
                          </div>

                          {error && (
                            <div className={`p-4 rounded-xl border backdrop-blur-sm ${
                              isDark ? 'bg-red-500/10 border-red-400/20' : 'bg-red-50/80 border-red-200/50'
                            }`}>
                              <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{error}</p>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4">
                            <button
                              type="button"
                              onClick={() => setStep('tenant')}
                              className={`py-3 px-6 rounded-xl font-medium border transition-all duration-200 flex items-center justify-center gap-2 ${
                                isDark ? 'text-muted-foreground border-gray-600 hover:border-border0 hover:bg-gray-800/30' : 'text-muted-foreground border-border hover:border-border hover:bg-muted/50'
                              }`}
                            >
                              {tr('رجوع', 'Back')}
                            </button>
                            <button
                              type="submit"
                              disabled={isLoading || !password}
                              className="py-3 px-6 rounded-xl font-semibold text-white transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                              style={{
                                background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                                boxShadow: `0 10px 30px ${colors.primary}66`,
                                border: `1px solid ${colors.primary}4D`,
                              }}
                            >
                              {isLoading ? (
                                <>
                                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  {tr('جاري تسجيل الدخول...', 'Signing in...')}
                                </>
                              ) : (
                                <>
                                  {tr('دخول', 'Sign in')}
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                  </svg>
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      </motion.div>
                    )}

                    {step === '2fa' && (
                      <motion.div
                        key="2fa"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                      >
                        <div>
                          <h1 className={`text-3xl font-bold mb-3 ${isDark ? 'text-white' : 'text-foreground'}`}>
                            {language === 'ar' ? 'رمز المصادقة' : 'Two-factor code'}
                          </h1>
                          <p className={`text-sm mb-6 ${isDark ? 'text-cyan-200/60' : 'text-muted-foreground'}`}>
                            {email}
                          </p>
                        </div>

                        <form onSubmit={handle2FALogin} className="space-y-6">
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
                            className={`w-full py-4 text-center font-mono tracking-widest rounded-xl border transition-all duration-200 ${
                              isDark
                                ? 'bg-black/30 border-gray-700 text-white'
                                : 'bg-card border-border text-foreground'
                            }`}
                          />

                          {error && (
                            <div className={`p-4 rounded-xl border backdrop-blur-sm ${
                              isDark ? 'bg-red-500/10 border-red-400/20' : 'bg-red-50/80 border-red-200/50'
                            }`}>
                              <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{error}</p>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4">
                            <button
                              type="button"
                              onClick={() => setStep('password')}
                              className={`py-3 px-6 rounded-xl font-medium border transition-all duration-200 flex items-center justify-center gap-2 ${
                                isDark ? 'text-muted-foreground border-gray-600 hover:border-border0 hover:bg-gray-800/30' : 'text-muted-foreground border-border hover:border-border hover:bg-muted/50'
                              }`}
                            >
                              {tr('رجوع', 'Back')}
                            </button>
                            <button
                              type="submit"
                              disabled={isLoading || !twoFactorToken}
                              className="py-3 px-6 rounded-xl font-semibold text-white transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                              style={{
                                background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                                boxShadow: `0 10px 30px ${colors.primary}66`,
                                border: `1px solid ${colors.primary}4D`,
                              }}
                            >
                              {isLoading ? tr('جاري تسجيل الدخول...', 'Signing in...') : (language === 'ar' ? 'تأكيد' : 'Verify')}
                            </button>
                          </div>
                        </form>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden">
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `
                        linear-gradient(135deg,
                          ${colors.primary}33 0%,
                          ${colors.primary}1A 50%,
                          transparent 50%
                        )
                      `,
                      clipPath: 'polygon(0 0, 100% 0, 70% 100%, 0% 100%)',
                    }}
                  />
                  <div className="relative z-10 text-center px-12">
                    <div className="flex justify-center gap-3 mb-8">
                      {['email', 'tenant', 'password'].map((s, idx) => (
                        <div
                          key={s}
                          className={`w-3 h-3 rounded-full transition-all duration-300 ${
                            step === s ? 'scale-125 shadow-lg' : idx < ['email', 'tenant', 'password'].indexOf(step) ? 'scale-110' : 'scale-100'
                          }`}
                          style={{
                            backgroundColor: idx <= ['email', 'tenant', 'password'].indexOf(step) ? colors.primary : (isDark ? '#4B5563' : '#D1D5DB'),
                            boxShadow: step === s ? `0 0 20px ${colors.primary}80` : 'none',
                          }}
                        />
                      ))}
                    </div>
                    <div className="mx-auto w-[280px] sm:w-[320px] mb-6">
                      <Image
                        src={isDark ? '/brand/main/thea-logo-dark.svg' : '/brand/main/thea-logo.svg'}
                        alt="Thea"
                        width={320}
                        height={110}
                        className="w-full h-auto"
                        priority
                      />
                    </div>
                  </div>
                  <div
                    className="absolute top-1/4 right-1/4 w-32 h-32 border rounded-full opacity-30"
                    style={{
                      borderColor: colors.primary,
                      animation: 'spin 20s linear infinite',
                    }}
                  />
                  <div
                    className="absolute bottom-1/4 left-1/4 w-24 h-24 border rounded-full opacity-30"
                    style={{
                      borderColor: colors.secondary,
                      animation: 'spin 15s linear infinite reverse',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
