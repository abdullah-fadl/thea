'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  FileText,
  Sparkles,
  AlertTriangle,
  Plus,
  LayoutDashboard,
  Stethoscope,
  Heart,
  Calendar,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import { hasRoutePermission } from '@/lib/permissions';
import { useMe } from '@/lib/hooks/useMe';
import { usePlatform } from '@/lib/hooks/usePlatform';

interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: any;
  shortcut: string;
}

export default function Welcome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, dir } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [userName, setUserName] = useState<string>('');
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { me, isLoading: meLoading, error: meError } = useMe();
  const { platform: platformData, isLoading: platformLoading } = usePlatform();
  const denied = searchParams?.get('denied') === '1';
  const deniedTarget = searchParams?.get('target');
  const disabled = searchParams?.get('disabled') === '1';
  const disabledTarget = searchParams?.get('target');

  // Redirect to login when session expired (API returns 200 with { user: null } or 401)
  useEffect(() => {
    if (meLoading) return;
    if (meError && String(meError) === '401') {
      router.push('/login?redirect=/welcome');
      return;
    }
    if (me && !me.user) {
      router.push('/login?redirect=/welcome');
      return;
    }
  }, [me, meLoading, meError, router]);

  useEffect(() => {
    if (meLoading || !me?.user) {
      setIsLoading(meLoading);
      return;
    }

    const user = me.user;
    setUserName(`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User');
    setUserPermissions(user.permissions || []);
    setIsLoading(false);
  }, [me, meLoading]);

  useEffect(() => {
    if (!platformLoading && platformData) {
      const platformValue = platformData.platform;
      if (platformValue !== 'sam' && platformValue !== 'health') {
        router.push('/platforms');
      }
    }
  }, [platformData, platformLoading, router]);

  const platform = platformData?.platform === 'sam' || platformData?.platform === 'health'
    ? platformData.platform
    : null;

  // SAM Platform quick actions
  const samActions: QuickAction[] = [
    {
      title: language === 'ar' ? 'مكتبة المستندات' : 'Documents Library',
      description: language === 'ar' ? 'تصفح وإدارة جميع المستندات' : 'Browse and manage all documents',
      href: '/library',
      icon: FileText,
      shortcut: 'D',
    },
    {
      title: language === 'ar' ? 'مساعد المستندات' : 'Document Assistant',
      description: language === 'ar' ? 'استخدم توصيات النظام لإنشاء وتعديل المستندات' : 'Use system recommendations to create and edit documents',
      href: '/assistant',
      icon: Sparkles,
      shortcut: 'A',
    },
    {
      title: language === 'ar' ? 'التعارضات والمشاكل' : 'Conflicts & Issues',
      description: language === 'ar' ? 'اكتشف وحل تعارضات المستندات' : 'Discover and resolve document conflicts',
      href: '/integrity',
      icon: AlertTriangle,
      shortcut: 'C',
    },
    {
      title: language === 'ar' ? 'منشئ مستند جديد' : 'New Document Creator',
      description: language === 'ar' ? 'أنشئ مستنداً جديداً من الصفر' : 'Create a new document from scratch',
      href: '/creator',
      icon: Plus,
      shortcut: 'N',
    },
  ];

  // Health Platform quick actions
  const healthActions: QuickAction[] = [
    {
      title: language === 'ar' ? 'لوحة التحكم' : 'Dashboard',
      description: language === 'ar' ? 'نظرة عامة على العمليات' : 'Overview of operations',
      href: '/dashboard',
      icon: LayoutDashboard,
      shortcut: 'D',
    },
    {
      title: language === 'ar' ? 'لوحة OPD' : 'OPD Dashboard',
      description: language === 'ar' ? 'إدارة العيادات الخارجية' : 'Manage outpatient clinics',
      href: '/opd/home',
      icon: Stethoscope,
      shortcut: 'O',
    },
    {
      title: language === 'ar' ? 'عمليات التمريض' : 'Nursing Operations',
      description: language === 'ar' ? 'إدارة عمليات التمريض' : 'Manage nursing operations',
      href: '/nursing/operations',
      icon: Activity,
      shortcut: 'N',
    },
    {
      title: language === 'ar' ? 'الجدولة' : 'Scheduling',
      description: language === 'ar' ? 'إدارة الجداول والمواعيد' : 'Manage schedules and appointments',
      href: '/scheduling/scheduling',
      icon: Calendar,
      shortcut: 'S',
    },
    {
      title: language === 'ar' ? 'غرفة الطوارئ' : 'Emergency Room',
      description: language === 'ar' ? 'إدارة حالات الطوارئ' : 'Manage emergency cases',
      href: '/er/register',
      icon: AlertCircle,
      shortcut: 'E',
    },
  ];

  const allQuickActions = platform === 'sam' ? samActions : healthActions;
  const quickActions = allQuickActions.filter(action => {
    return hasRoutePermission(userPermissions, action.href);
  });
  const platformName = platform === 'sam' ? (language === 'ar' ? 'سَم' : 'SAM') : platform === 'health' ? 'Thea Health' : '';
  const userRole = me?.user?.role || '';

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  // Session expired or 401 — redirect in progress; show loading to avoid blank screen
  if (!meLoading && me && !me.user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">
          {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">
          {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
        </div>
      </div>
    );
  }

  if (!platform) {
    return null;
  }

  return (
    <div dir={dir} className="min-h-screen bg-background">
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 md:py-10 space-y-8">
        {disabled ? (
          <div className="rounded-2xl bg-card border border-destructive/50 p-4 text-sm text-destructive mb-4">
            {language === 'ar'
              ? 'تم تعطيل حسابك لهذه المنشأة. يرجى التواصل مع الإدارة.'
              : 'Your access for this tenant is disabled. Please contact an administrator.'}
            {disabledTarget ? <span className="text-muted-foreground"> ({disabledTarget})</span> : null}
          </div>
        ) : null}

        {denied ? (
          <div className="rounded-2xl bg-card border border-destructive/50 p-4 text-sm text-destructive mb-4">
            {language === 'ar' ? 'تم رفض الوصول لهذا القسم.' : 'Access denied for that area.'}
            {deniedTarget ? <span className="text-muted-foreground"> ({deniedTarget})</span> : null}
          </div>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-4"
        >
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-4xl font-bold text-foreground">
                {language === 'ar' ? `مرحباً، ${userName}!` : `Welcome, ${userName}!`}
              </h1>
              <p className="text-base md:text-xl text-muted-foreground">
                {language === 'ar'
                  ? `أنت الآن في منصة ${platformName}. اختر من الإجراءات السريعة أدناه للبدء.`
                  : `You're now on ${platformName} platform. Choose from the quick actions below to get started.`}
              </p>
              {userRole ? (
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' ? `الدور: ${userRole}` : `Role: ${userRole}`}
                </div>
              ) : null}
            </div>
          </div>
        </motion.div>

        <div className="flex items-center justify-between">
          <h2 className="text-lg md:text-2xl font-semibold text-foreground">
            {language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
          </h2>
        </div>

        <motion.div
          id="main-content"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
        >
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={index}
                type="button"
                variants={itemVariants}
                onClick={() => router.push(action.href)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(action.href);
                  }
                }}
                aria-label={action.title}
                className="text-left"
              >
                <div className="h-full rounded-2xl bg-card border border-border p-5 thea-hover-lift thea-transition-fast">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="p-3 rounded-xl bg-primary text-primary-foreground flex-shrink-0">
                      <Icon className="h-5 w-5 md:h-6 md:w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="text-base md:text-lg font-semibold text-foreground">
                        {action.title}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground mt-3">
                    {action.description}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        <div className="rounded-2xl bg-card border border-border overflow-hidden mt-6 md:mt-8">
          <div className="p-5 border-b border-border">
            <h3 className="text-lg md:text-xl font-bold text-foreground">
              {language === 'ar' ? 'نصائح للبدء' : 'Getting Started Tips'}
            </h3>
          </div>
          <div className="p-5">
            <ul className="list-disc list-inside space-y-2 text-sm md:text-base text-muted-foreground">
              {platform === 'sam' ? (
                <>
                  <li>
                    {language === 'ar'
                      ? 'استخدم مكتبة المستندات لتصفح جميع المستندات المتاحة'
                      : 'Use the Documents Library to browse all available documents'}
                  </li>
                  <li>
                    {language === 'ar'
                      ? 'استخدم مساعد المستندات لإنشاء مستندات جديدة بتوصيات النظام'
                      : 'Use Document Assistant to create new documents with system recommendations'}
                  </li>
                  <li>
                    {language === 'ar'
                      ? 'تحقق من تعارضات المستندات بانتظام لضمان الاتساق'
                      : 'Check for document conflicts regularly to ensure consistency'}
                  </li>
                </>
              ) : (
                <>
                  <li>
                    {language === 'ar'
                      ? 'استخدم لوحة التحكم للحصول على نظرة عامة سريعة على العمليات'
                      : 'Use the Dashboard for a quick overview of operations'}
                  </li>
                  <li>
                    {language === 'ar'
                      ? 'إدارة تجربة المريض من خلال لوحة تجربة المريض'
                      : 'Manage patient experience through the Patient Experience dashboard'}
                  </li>
                  <li>
                    {language === 'ar'
                      ? 'استخدم OPD Dashboard لإدارة العيادات الخارجية'
                      : 'Use OPD Dashboard to manage outpatient clinics'}
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
