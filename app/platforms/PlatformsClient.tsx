'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Settings, LogOut, Keyboard, Lock } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/components/ThemeProvider';
import { useMe } from '@/lib/hooks/useMe';
import { usePlatform } from '@/lib/hooks/usePlatform';

interface PlatformEntitlements {
  sam: boolean;
  siraHealth: boolean;
  edrac: boolean;
  cvision: boolean;
  imdad: boolean;
}

interface PlatformsClientProps {
  userName: string;
  hospitalName?: string | null;
  entitlements: PlatformEntitlements;
}

interface Platform {
  id: string;
  name: string;
  nameAr: string;
  tagline: string;
  taglineAr: string;
  logo: string;
  route: string;
  enabled: boolean;
  status: 'available' | 'coming-soon';
  gradient: string;
  glowColor: string;
  features: string[];
  featuresAr: string[];
  stats: Record<string, string>;
}

interface AccessibilitySettings {
  highContrast: boolean;
  largeText: boolean;
  reduceMotion: boolean;
  keyboardNavigation: boolean;
}

export default function PlatformsClient({ userName, hospitalName, entitlements }: PlatformsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const { theme } = useTheme();
  const [accessibilitySettings, setAccessibilitySettings] = useState<AccessibilitySettings>({
    highContrast: false,
    largeText: false,
    reduceMotion: false,
    keyboardNavigation: false
  });

  const { platform: platformData, mutate: mutatePlatform } = usePlatform();
  const currentPlatform = platformData?.platform || null;

  // Check if user is admin or owner
  const { me } = useMe();
  
  const isRTL = language === 'ar';
  const isDark = theme === 'dark';

  // Colors exactly matching login page (Ocean theme)
  const colors = useMemo(() => ({
    primary: isDark ? '#22D3EE' : '#0891B2',
    secondary: isDark ? '#38BDF8' : '#0EA5E9',
    accent: isDark ? '#06B6D4' : '#0284C7',
    success: isDark ? '#10B981' : '#059669',
    warning: isDark ? '#FB923C' : '#EA580C',
    error: isDark ? '#EF4444' : '#DC2626',
    background: isDark ? '#0F172A' : '#FFFFFF',
    surface: isDark ? '#1E293B' : '#F8FAFC',
    text: isDark ? '#F1F5F9' : '#1E293B',
    textSecondary: isDark ? '#94A3B8' : '#64748B'
  }), [isDark]);

  useEffect(() => {
    if (!me) return;
    setIsAdmin(me.user?.role === 'admin' || me.user?.role === 'ADMIN');
    setIsOwner(me.user?.role === 'thea-owner' || me.user?.role === 'THEA_OWNER');
  }, [me]);

  // Enhanced platforms with comprehensive details
  const platforms: Platform[] = useMemo(() => {
    const platformList: Platform[] = [];

    // Only add SAM if user is entitled
    if (entitlements.sam) {
      platformList.push({
        id: 'sam',
        name: language === 'ar' ? 'سَم' : 'SAM',
        nameAr: 'سَم',
        tagline: 'From Policy to Compliance',
        taglineAr: 'من السياسة إلى الامتثال',
        logo: '/brand/sam.png',
        route: '/platforms/sam',
        enabled: true,
        status: 'available',
        gradient: 'from-purple-500 via-violet-500 to-pink-500',
        glowColor: '#A855F7',
        features: [
          'Policy Management',
          'Compliance Monitoring',
          'Risk Assessment',
          'Audit Reports'
        ],
        featuresAr: [
          'إدارة السياسات',
          'مراقبة الامتثال',
          'تقييم المخاطر',
          'تقارير المراجعة'
        ],
        stats: { policies: '1,200+', compliance: '98%', audits: '150+' }
      });
    }
    
    // Only add Thea Health if user is entitled
    if (entitlements.siraHealth) {
      platformList.push({
        id: 'siraHealth',
        name: language === 'ar' ? 'ثيا الصحة' : 'Thea Health',
        nameAr: 'ثيا الصحة',
        tagline: 'One Platform, Total Care',
        taglineAr: 'منصة واحدة، رعاية شاملة',
        logo: '/brand/thea-health.svg',
        route: '/platforms/thea-health',
        enabled: true,
        status: 'available',
        gradient: 'from-cyan-400 to-blue-400',
        glowColor: '#22D3EE',
        features: [
          'Electronic Health Records',
          'Patient Management',
          'Appointment Scheduling',
          'Clinical Analytics'
        ],
        featuresAr: [
          'السجلات الطبية الإلكترونية',
          'إدارة المرضى',
          'جدولة المواعيد',
          'التحليلات السريرية'
        ],
        stats: { patients: '50K+', appointments: '25K+', records: '500K+' }
      });
    }

    // Future platforms (coming soon) - only if entitled
    if (entitlements.edrac) {
      platformList.push({
        id: 'edrac',
        name: language === 'ar' ? 'إدراك' : 'EDRAC',
        nameAr: 'إدراك',
        tagline: 'AI-Powered Clinical Intelligence',
        taglineAr: 'الذكاء السريري المدعوم بالذكاء الاصطناعي',
        logo: '/brand/edrac.png',
        route: '/platforms/edrac',
        enabled: false,
        status: 'coming-soon',
        gradient: 'from-emerald-500 to-teal-500',
        glowColor: '#10B981',
        features: [
          'AI Diagnostics',
          'Predictive Analytics',
          'Clinical Decision Support',
          'Research Insights'
        ],
        featuresAr: [
          'التشخيص بالذكاء الاصطناعي',
          'التحليلات التنبؤية',
          'دعم القرار السريري',
          'رؤى البحث'
        ],
        stats: { accuracy: '97%', models: '25+', insights: '10K+' }
      });
    }

    // Only add Imdad if user is entitled
    if (entitlements.imdad) {
      platformList.push({
        id: 'imdad',
        name: language === 'ar' ? 'إمداد' : 'Imdad',
        nameAr: 'إمداد',
        tagline: 'Smart Supply Chain',
        taglineAr: 'سلاسل الإمداد الذكية',
        logo: '/brand/imdad.svg',
        route: '/platforms/imdad',
        enabled: true,
        status: 'available',
        gradient: 'from-green-500 via-emerald-500 to-teal-500',
        glowColor: '#10B981',
        features: [
          'Inventory Management',
          'Procurement',
          'Warehouse Management',
          'Supply Analytics'
        ],
        featuresAr: [
          'إدارة المخزون',
          'المشتريات',
          'إدارة المستودعات',
          'تحليلات الإمداد'
        ],
        stats: { items: '50K+', suppliers: '500+', warehouses: '25+' }
      });
    }

    if (entitlements.cvision) {
      platformList.push({
        id: 'cvision',
        name: language === 'ar' ? 'سي فيجن' : 'C-Vision',
        nameAr: 'سي فيجن',
        tagline: 'Employee Lifecycle Management',
        taglineAr: 'إدارة شؤون الموظفين',
        logo: '/brand/cvision.png',
        route: '/platforms/cvision',
        enabled: true,
        status: 'available',
        gradient: 'from-orange-500 to-red-500',
        glowColor: '#F97316',
        features: [
          'Employee Management',
          'Attendance & Payroll',
          'Recruitment & Hiring',
          'HR Analytics'
        ],
        featuresAr: [
          'إدارة الموظفين',
          'الحضور والرواتب',
          'التوظيف والاستقطاب',
          'تحليلات الموارد البشرية'
        ],
        stats: { employees: '10K+', modules: '89+', integrations: '4+' }
      });
    }
    
    return platformList;
  }, [language, entitlements]);

  const handlePlatformClick = useCallback(async (platform: Platform) => {
    if (!platform.enabled || platform.status !== 'available') {
      return; // Don't allow clicking locked platforms
    }

    // Map platform ID to cookie value
    const platformValue = platform.id === 'sam' ? 'sam' : platform.id === 'siraHealth' ? 'health' : platform.id === 'cvision' ? 'cvision' : platform.id === 'imdad' ? 'imdad' : null;

    if (!platformValue) {
      return; // Invalid platform
    }

    // If already on this platform, just navigate
    if (currentPlatform === platformValue) {
      router.push(platform.route);
      return;
    }

    setIsSwitching(platformValue);

    try {
      // Switch platform via API (checks entitlements)
      const response = await fetch('/api/platform/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: platformValue }),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        // Revalidate platform cache to get updated value
        await mutatePlatform();
        
        // Wait a bit for cookie to be set, then navigate
        setTimeout(() => {
          router.push(platform.route);
          router.refresh();
        }, 100);
      } else if (response.status === 403) {
        // Not entitled to this platform
        toast({
          title: 'Access Denied',
          description: data.message || 'You are not entitled to access this platform',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to switch platform',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error switching platform:', error);
      toast({
        title: 'Error',
        description: 'Failed to switch platform. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSwitching(null);
    }
  }, [currentPlatform, router, mutatePlatform, toast]);

  const handleAdminClick = useCallback(async () => {
    // Admin UI lives under health routes, so ensure health platform is active first.
    if (currentPlatform !== 'health') {
      setIsSwitching('health');
      try {
        const response = await fetch('/api/platform/switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'health' }),
          credentials: 'include',
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          toast({
            title: tr('تعذر فتح لوحة الإدارة', 'Unable to open admin panel'),
            description: data?.message || tr('ليس لديك صلاحية منصة الصحة', 'You are not entitled to Thea Health platform'),
            variant: 'destructive',
          });
          return;
        }

        await mutatePlatform();
      } catch {
        toast({
          title: tr('خطأ في الشبكة', 'Network error'),
          description: tr('تعذر التبديل إلى منصة الصحة', 'Failed to switch to Thea Health platform'),
          variant: 'destructive',
        });
        return;
      } finally {
        setIsSwitching(null);
      }
    }

    router.push('/admin');
    router.refresh();
  }, [currentPlatform, mutatePlatform, router, toast, tr]);

  // Keyboard shortcuts for accessibility
  useEffect(() => {
    if (!accessibilitySettings.keyboardNavigation) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.altKey) {
        const platformIndex = parseInt(e.key) - 1;
        if (platformIndex >= 0 && platformIndex < platforms.length) {
          const platform = platforms[platformIndex];
          if (platform.enabled) {
            e.preventDefault();
            handlePlatformClick(platform);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [accessibilitySettings.keyboardNavigation, platforms, handlePlatformClick]);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: accessibilitySettings.reduceMotion ? 0 : 0.15,
      },
    },
  };

  const tileVariants = {
    hidden: { 
      opacity: 0, 
      y: accessibilitySettings.reduceMotion ? 0 : 30,
      scale: accessibilitySettings.reduceMotion ? 1 : 0.95,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: accessibilitySettings.reduceMotion ? 0 : 0.6,
        ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
      },
    },
  };

  // Check if platform is currently active
  const isPlatformActive = (platformId: string) => {
    const platformValue = platformId === 'sam' ? 'sam' : platformId === 'siraHealth' ? 'health' : platformId === 'cvision' ? 'cvision' : platformId === 'imdad' ? 'imdad' : null;
    return currentPlatform === platformValue;
  };

  // Translations
  const translations = {
    ar: {
      title: 'اختر منصتك',
      subtitle: 'اختر المنصة التي تريد الوصول إليها',
      welcome: 'مرحباً',
      features: 'المميزات',
      current: 'الحالية',
      comingSoon: 'قريباً',
      switching: 'جاري التبديل...',
      skipToContent: 'انتقل إلى المحتوى الرئيسي',
      accessibility: 'إعدادات إمكانية الوصول',
      highContrast: 'تباين عالي',
      largeText: 'نص كبير',
      reduceMotion: 'تقليل الحركة',
      keyboardShortcuts: 'Alt + رقم',
      betweenYourHands: 'بين يديك'
    },
    en: {
      title: 'Choose Your Platform',
      subtitle: 'Select the platform you want to access',
      welcome: 'Welcome',
      features: 'Features',
      current: 'Current',
      comingSoon: 'Coming Soon',
      switching: 'Switching...',
      skipToContent: 'Skip to Main Content',
      accessibility: 'Accessibility Settings',
      highContrast: 'High Contrast',
      largeText: 'Large Text',
      reduceMotion: 'Reduce Motion',
      keyboardShortcuts: 'Alt + Number',
      betweenYourHands: 'Between Your Hands'
    }
  };

  const t = translations[language] || translations.en;

  return (
    <div 
      className="min-h-screen transition-all duration-500"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        backgroundColor: colors.background,
        backgroundImage: isDark 
          ? `radial-gradient(circle at 25% 25%, rgba(34, 211, 238, 0.05) 0%, transparent 50%),
             radial-gradient(circle at 75% 75%, rgba(56, 189, 248, 0.05) 0%, transparent 50%)`
          : `radial-gradient(circle at 25% 25%, rgba(8, 145, 178, 0.03) 0%, transparent 50%),
             radial-gradient(circle at 75% 75%, rgba(14, 165, 233, 0.03) 0%, transparent 50%)`,
        filter: accessibilitySettings.highContrast ? 'contrast(150%)' : 'none'
      }}
    >
      {/* Skip to content link */}
      <a 
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 rounded-lg text-white font-medium"
        style={{ backgroundColor: colors.primary }}
      >
        {t.skipToContent}
      </a>

      {/* Floating Particles */}
      {!accessibilitySettings.reduceMotion && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full opacity-40"
              style={{
                backgroundColor: i % 2 === 0 ? colors.primary : colors.secondary,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `float ${4 + Math.random() * 6}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 3}s`
              }}
            />
          ))}
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: accessibilitySettings.reduceMotion ? 0 : 0.5 }}
          className="text-center space-y-6"
        >
          {/* Thea Main Logo */}
          <div className="mx-auto w-[260px] sm:w-[320px]">
            <Image
              src={isDark ? '/brand/main/thea-logo-dark.svg' : '/brand/main/thea-logo.svg'}
              alt="Thea"
              width={320}
              height={110}
              className="w-full h-auto"
              priority
            />
          </div>

          {/* Main Title and Controls */}
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <h1 
                className={`text-4xl font-bold transition-colors duration-500 ${
                  accessibilitySettings.largeText ? 'text-5xl' : ''
                }`}
                style={{ color: colors.text }}
              >
                {t.title}
              </h1>
              
              {/* Controls */}
              <div className="flex items-center gap-2">
                <ThemeToggle />
                
                {/* Accessibility Toggle */}
                <button
                  onClick={() => setAccessibilitySettings(prev => ({ 
                    ...prev, 
                    keyboardNavigation: !prev.keyboardNavigation 
                  }))}
                  aria-label="Toggle accessibility features"
                  className={`p-3 rounded-xl transition-all duration-200 hover:scale-105 ${
                    accessibilitySettings.keyboardNavigation 
                      ? 'ring-2 ring-offset-2' 
                      : ''
                  }`}
                  style={{
                    backgroundColor: accessibilitySettings.keyboardNavigation 
                      ? `${colors.primary}20` 
                      : colors.surface,
                    borderColor: `${colors.primary}40`,
                    color: accessibilitySettings.keyboardNavigation 
                      ? colors.primary 
                      : colors.textSecondary,
                    ['--tw-ring-color' as string]: colors.primary
                  }}
                >
                  <Keyboard className="h-5 w-5" />
                </button>

                {isOwner && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/owner')}
                    className="gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Owner
                  </Button>
                )}
                {isAdmin && !isOwner && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAdminClick}
                    className="gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    {tr('الإدارة', 'Admin')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await fetch('/api/auth/logout', { 
                        method: 'POST',
                        credentials: 'include',
                      });
                      router.push('/login');
                      router.refresh();
                    } catch (error) {
                      console.error('Logout failed:', error);
                    }
                  }}
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>

            {accessibilitySettings.keyboardNavigation && (
              <p
                className={`text-muted-foreground ${
                  accessibilitySettings.largeText ? 'text-base' : 'text-sm'
                }`}
                style={{ color: colors.textSecondary }}
              >
                ({t.keyboardShortcuts})
              </p>
            )}
          </div>

          {/* User Info */}
          <div className="space-y-2">
            {hospitalName && (
              <p 
                className={`text-lg ${accessibilitySettings.largeText ? 'text-xl' : ''}`}
                style={{ color: colors.textSecondary }}
              >
                {hospitalName}
              </p>
            )}
            <p 
              className={`text-muted-foreground ${
                accessibilitySettings.largeText ? 'text-base' : ''
              }`}
              style={{ color: colors.textSecondary }}
            >
              {language === 'ar' 
                ? `${t.welcome} ${userName} - ${t.subtitle}`
                : `${t.welcome}, ${userName}`
              }
            </p>
          </div>
        </motion.div>

        {/* Platforms Grid */}
        <motion.div
          id="main-content"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className={`grid gap-8 max-w-6xl mx-auto ${
            platforms.length === 1 ? 'grid-cols-1 max-w-lg' :
            platforms.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
            platforms.length === 4 ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4' :
            'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
          }`}
        >
          {platforms.map((platform, index) => {
            const isAvailable = platform.enabled && platform.status === 'available';
            const isActive = isPlatformActive(platform.id);
            const isLoading = isSwitching === (platform.id === 'sam' ? 'sam' : platform.id === 'siraHealth' ? 'health' : platform.id === 'cvision' ? 'cvision' : platform.id === 'imdad' ? 'imdad' : null);

            return (
              <motion.div
                key={platform.id}
                variants={tileVariants}
                whileHover={isAvailable && !accessibilitySettings.reduceMotion ? {
                  scale: 1.03,
                  y: -8,
                  transition: { duration: 0.2 },
                } : {}}
                className="group relative"
                data-platform={platform.id}
                data-enabled={platform.enabled}
                data-testid={`platform-tile-${platform.id}`}
              >
                <div
                  onClick={() => {
                    if (isAvailable) {
                      handlePlatformClick(platform);
                    }
                  }}
                  role="button"
                  tabIndex={isAvailable ? 0 : -1}
                  aria-label={`${platform.name}${accessibilitySettings.keyboardNavigation ? ` - Alt+${index + 1}` : ''}`}
                  aria-disabled={!isAvailable}
                  className={`
                    relative h-80 rounded-2xl border overflow-hidden transition-all duration-300 
                    focus:outline-none focus:ring-4 focus:ring-offset-2
                    ${isAvailable 
                      ? 'cursor-pointer hover:shadow-2xl' 
                      : 'cursor-not-allowed opacity-60 grayscale'
                    }
                    ${isActive && isAvailable ? 'ring-4 shadow-xl' : ''}
                  `}
                  style={{
                    backgroundColor: isAvailable 
                      ? `${colors.surface}CC`
                      : `${colors.surface}80`,
                    backdropFilter: 'blur(20px)',
                    borderColor: isActive 
                      ? colors.primary
                      : isAvailable 
                        ? `${platform.glowColor}40`
                        : `${colors.textSecondary}40`,
                    boxShadow: isActive 
                      ? `0 0 40px ${colors.primary}40, 0 20px 25px -5px rgba(0, 0, 0, 0.1)`
                      : isAvailable 
                        ? `0 4px 20px ${platform.glowColor}20`
                        : 'none',
                    ['--tw-ring-color' as string]: `${colors.primary}40`
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && isAvailable) {
                      e.preventDefault();
                      handlePlatformClick(platform);
                    }
                  }}
                >
                  {/* Gradient Background */}
                  <div 
                    className={`absolute inset-0 bg-gradient-to-br ${platform.gradient} opacity-10`}
                    aria-hidden="true"
                  />

                  {/* Glow Effect */}
                  {isAvailable && !accessibilitySettings.reduceMotion && (
                    <div 
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{
                        background: `radial-gradient(circle at 50% 50%, ${platform.glowColor}20 0%, transparent 70%)`
                      }}
                      aria-hidden="true"
                    />
                  )}

                  {/* Loading Overlay */}
                  {isLoading && (
                    <div 
                      className="absolute inset-0 flex items-center justify-center z-30"
                      style={{ backgroundColor: `${colors.background}E6` }}
                    >
                      <div className="text-center space-y-3">
                        <div 
                          className="w-12 h-12 border-4 border-transparent rounded-full animate-spin mx-auto"
                          style={{
                            borderTopColor: platform.glowColor,
                            borderRightColor: platform.glowColor
                          }}
                        />
                        <p 
                          className={`font-medium ${
                            accessibilitySettings.largeText ? 'text-base' : 'text-sm'
                          }`}
                          style={{ color: colors.text }}
                        >
                          {t.switching}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Content */}
                  <div className="relative h-full p-6 flex flex-col">
                    
                    {/* Status Badges */}
                    <div className="absolute top-4 right-4 flex gap-2">
                      {isActive && isAvailable && (
                        <Badge 
                          className="text-white"
                          style={{ backgroundColor: colors.primary }}
                        >
                          {t.current}
                        </Badge>
                      )}
                      {!isAvailable && (
                        <Badge 
                          variant="secondary"
                          style={{ 
                            backgroundColor: `${colors.warning}20`,
                            color: colors.warning
                          }}
                        >
                          {t.comingSoon}
                        </Badge>
                      )}
                      {accessibilitySettings.keyboardNavigation && (
                        <Badge 
                          variant="outline"
                          className="text-xs"
                          style={{ borderColor: colors.textSecondary }}
                        >
                          Alt+{index + 1}
                        </Badge>
                      )}
                    </div>

                    {/* Logo */}
                    <div className="flex-1 flex items-center justify-center mb-4">
                      {(() => {
                        const isTheaHealth = platform.id === 'siraHealth';
                        const logoWidth = isTheaHealth ? 240 : 160;
                        const logoHeight = isTheaHealth ? 150 : 100;
                        return (
                      <motion.div 
                        className={`relative transition-transform duration-300 ${
                          isAvailable && !accessibilitySettings.reduceMotion 
                            ? 'group-hover:scale-110' 
                            : ''
                        }`}
                        animate={isAvailable && !accessibilitySettings.reduceMotion ? {
                          scale: [1, 1.02, 1],
                        } : {}}
                        transition={isAvailable && !accessibilitySettings.reduceMotion ? {
                          duration: 3,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        } : {}}
                        style={{
                          width: `${logoWidth}px`,
                          height: `${logoHeight}px`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Image
                          src={platform.logo}
                          alt={platform.name}
                          width={logoWidth}
                          height={logoHeight}
                          className={`object-contain transition-all duration-300 ${
                            isAvailable ? '' : 'grayscale opacity-50'
                          }`}
                          style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%' }}
                          priority={index < 2}
                          unoptimized={false}
                        />
                      </motion.div>
                        );
                      })()}
                    </div>

                    {/* Platform Info */}
                    <div className="space-y-3">
                      <div className="text-center">
                        <h2 
                          className={`font-bold mb-2 transition-colors duration-500 ${
                            accessibilitySettings.largeText ? 'text-xl' : 'text-lg'
                          }`}
                          style={{ 
                            color: isAvailable ? colors.text : colors.textSecondary 
                          }}
                        >
                          {platform.name}
                        </h2>
                        
                        <p 
                          className={`transition-colors duration-500 ${
                            accessibilitySettings.largeText ? 'text-sm' : 'text-xs'
                          }`}
                          style={{ 
                            color: isAvailable ? colors.textSecondary : `${colors.textSecondary}80` 
                          }}
                        >
                          {language === 'ar' ? platform.taglineAr : platform.tagline}
                        </p>
                      </div>

                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* No platforms message */}
        {platforms.length === 0 && (
          <div className="text-center py-12">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 
              className={`font-bold mb-2 ${
                accessibilitySettings.largeText ? 'text-2xl' : 'text-xl'
              }`}
              style={{ color: colors.text }}
            >
              {language === 'ar' ? 'لا توجد منصات متاحة' : 'No Platforms Available'}
            </h3>
            <p style={{ color: colors.textSecondary }}>
              {language === 'ar' 
                ? 'تواصل مع المدير للحصول على إذن الوصول'
                : 'Contact your administrator for access permissions'
              }
            </p>
          </div>
        )}
      </div>

      {/* Accessibility Panel */}
      {accessibilitySettings.keyboardNavigation && (
        <div
          role="dialog"
          aria-labelledby="accessibility-panel-title"
          className="fixed bottom-6 right-6 w-80 p-5 rounded-2xl border z-50"
          style={{
            backgroundColor: `${colors.surface}F0`,
            backdropFilter: 'blur(20px)',
            borderColor: `${colors.primary}40`,
            boxShadow: `0 20px 25px -5px rgba(0, 0, 0, 0.1)`
          }}
        >
          <h3
            id="accessibility-panel-title"
            className={`font-bold mb-4 ${
              accessibilitySettings.largeText ? 'text-lg' : 'text-base'
            }`}
            style={{ color: colors.text }}
          >
            {t.accessibility}
          </h3>
          
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={accessibilitySettings.highContrast}
                onChange={(e) => setAccessibilitySettings(prev => ({ 
                  ...prev, 
                  highContrast: e.target.checked 
                }))}
                className="w-4 h-4 rounded"
                style={{ accentColor: colors.primary }}
              />
              <span 
                className={accessibilitySettings.largeText ? 'text-base' : 'text-sm'}
                style={{ color: colors.text }}
              >
                {t.highContrast}
              </span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={accessibilitySettings.largeText}
                onChange={(e) => setAccessibilitySettings(prev => ({ 
                  ...prev, 
                  largeText: e.target.checked 
                }))}
                className="w-4 h-4 rounded"
                style={{ accentColor: colors.primary }}
              />
              <span 
                className={accessibilitySettings.largeText ? 'text-base' : 'text-sm'}
                style={{ color: colors.text }}
              >
                {t.largeText}
              </span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={accessibilitySettings.reduceMotion}
                onChange={(e) => setAccessibilitySettings(prev => ({ 
                  ...prev, 
                  reduceMotion: e.target.checked 
                }))}
                className="w-4 h-4 rounded"
                style={{ accentColor: colors.primary }}
              />
              <span 
                className={accessibilitySettings.largeText ? 'text-base' : 'text-sm'}
                style={{ color: colors.text }}
              >
                {t.reduceMotion}
              </span>
            </label>
          </div>
        </div>
      )}

      {/* CSS Classes */}
      <style jsx global>{`
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        @keyframes grid-move {
          0% { transform: translate(0, 0); }
          100% { transform: translate(60px, 60px); }
        }
        
        @keyframes float {
          0%, 100% { 
            transform: translateY(0px) rotate(0deg); 
            opacity: 0.4;
          }
          50% { 
            transform: translateY(-30px) rotate(180deg); 
            opacity: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
            transition: none !important;
          }
        }

        *:focus-visible {
          outline: 2px solid ${colors.primary} !important;
          outline-offset: 2px !important;
        }
      `}</style>
    </div>
  );
}
