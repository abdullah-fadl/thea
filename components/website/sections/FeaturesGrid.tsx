'use client';

import { useLang } from '@/hooks/use-lang';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';

export interface FeatureItem {
  icon: LucideIcon;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
}

interface FeaturesGridProps {
  features: FeatureItem[];
  columns?: 2 | 3 | 4;
  gradient?: 'primary' | 'teal' | 'cyan';
}

const gradientMap = {
  primary: 'from-thea-primary to-thea-cyan',
  teal: 'from-thea-teal to-thea-cyan',
  cyan: 'from-thea-cyan to-thea-primary',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 25 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
} as const;

export default function FeaturesGrid({
  features,
  columns = 3,
  gradient = 'primary',
}: FeaturesGridProps) {
  const { language } = useLang();
  const isArabic = language === 'ar';
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const gridCols = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      className={cn('grid gap-6 lg:gap-8', gridCols[columns])}
    >
      {features.map((feature, index) => {
        const Icon = feature.icon;
        return (
          <motion.div
            key={index}
            variants={cardVariants}
            className="group relative"
          >
            {/* Hover gradient border */}
            <div
              className={cn(
                'absolute -inset-[1px] rounded-2xl bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm',
                gradientMap[gradient]
              )}
            />
            <div
              className={cn(
                'absolute -inset-[1px] rounded-2xl bg-gradient-to-r opacity-0 group-hover:opacity-40 transition-opacity duration-500',
                gradientMap[gradient]
              )}
            />

            <div className="relative rounded-2xl bg-white dark:bg-thea-dark backdrop-blur-sm border border-slate-100 dark:border-white/5 p-6 lg:p-8 h-full transition-all duration-500 hover:border-transparent group-hover:bg-slate-50 dark:group-hover:bg-white/5 shadow-sm dark:shadow-none">
              {/* Icon */}
              <div
                className={cn(
                  'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110',
                  gradientMap[gradient]
                )}
              >
                <Icon className="w-6 h-6 text-white" />
              </div>

              {/* Title */}
              <h3
                className={cn(
                  'text-lg font-bold text-slate-900 dark:text-white mb-2',
                  isArabic && 'font-arabic text-right'
                )}
              >
                {tr(feature.titleAr, feature.title)}
              </h3>

              {/* Description */}
              <p
                className={cn(
                  'text-slate-500 dark:text-white/50 text-sm leading-relaxed',
                  isArabic && 'font-arabic text-right'
                )}
              >
                {tr(feature.descriptionAr, feature.description)}
              </p>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
