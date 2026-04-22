'use client';

import { useLang } from '@/hooks/use-lang';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface ProductHeroProps {
  title: string;
  titleAr: string;
  subtitle: string;
  subtitleAr: string;
  badge: string;
  badgeAr: string;
  gradient?: 'primary' | 'teal' | 'cyan';
}

const gradientConfigs = {
  primary: {
    badge: 'bg-thea-primary/10 border-thea-primary/20 text-thea-primary',
    heading: 'from-thea-primary via-thea-cyan to-thea-teal',
    glow1: 'bg-thea-primary/8',
    glow2: 'bg-thea-cyan/5',
  },
  teal: {
    badge: 'bg-thea-teal/10 border-thea-teal/20 text-thea-teal',
    heading: 'from-thea-teal via-thea-cyan to-thea-primary',
    glow1: 'bg-thea-teal/8',
    glow2: 'bg-thea-primary/5',
  },
  cyan: {
    badge: 'bg-thea-cyan/10 border-thea-cyan/20 text-thea-cyan',
    heading: 'from-thea-cyan via-thea-primary to-thea-teal',
    glow1: 'bg-thea-cyan/8',
    glow2: 'bg-thea-teal/5',
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.15 },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 25 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' as const },
  },
} as const;

export default function ProductHero({
  title,
  titleAr,
  subtitle,
  subtitleAr,
  badge,
  badgeAr,
  gradient = 'primary',
}: ProductHeroProps) {
  const { language } = useLang();
  const isArabic = language === 'ar';
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const config = gradientConfigs[gradient];

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-thea-dark dark:via-thea-dark dark:to-thea-dark" />
      <div className="absolute inset-0 bg-grid-pattern opacity-50" />

      {/* Glow accents */}
      <motion.div
        className={cn(
          'absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[150px] pointer-events-none',
          config.glow1
        )}
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        className={cn(
          'absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none',
          config.glow2
        )}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className={cn(
            'flex flex-col items-center text-center gap-6',
            isArabic && 'font-arabic'
          )}
        >
          {/* Breadcrumb */}
          <motion.nav
            variants={itemVariants}
            className="flex items-center gap-2 text-sm text-slate-400 dark:text-white/40"
          >
            <Link href="/" className="hover:text-slate-600 dark:hover:text-white/70 transition-colors">
              {tr('الرئيسية', 'Home')}
            </Link>
            <ChevronRight className={cn('w-3.5 h-3.5', isArabic && 'rotate-180')} />
            <Link href="/#products" className="hover:text-slate-600 dark:hover:text-white/70 transition-colors">
              {tr('المنتجات', 'Products')}
            </Link>
            <ChevronRight className={cn('w-3.5 h-3.5', isArabic && 'rotate-180')} />
            <span className="text-slate-600 dark:text-white/70">{tr(titleAr, title)}</span>
          </motion.nav>

          {/* Badge */}
          <motion.div variants={itemVariants}>
            <span
              className={cn(
                'inline-flex items-center px-4 py-1.5 rounded-full border text-sm font-medium',
                config.badge
              )}
            >
              {tr(badgeAr, badge)}
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight"
          >
            <span
              className={cn(
                'bg-clip-text text-transparent bg-gradient-to-r',
                config.heading
              )}
            >
              {tr(titleAr, title)}
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            className="text-slate-500 dark:text-white/50 text-lg sm:text-xl max-w-3xl leading-relaxed"
          >
            {tr(subtitleAr, subtitle)}
          </motion.p>

          {/* Decorative divider */}
          <motion.div
            variants={itemVariants}
            className="flex items-center gap-3 mt-4"
          >
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-thea-primary/40" />
            <div className="w-2 h-2 rounded-full bg-thea-primary/40" />
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-thea-primary/40" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
