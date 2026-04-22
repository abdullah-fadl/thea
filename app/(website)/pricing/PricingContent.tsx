'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '@/hooks/use-lang';
import { cn } from '@/lib/utils';
import { Check, X, Zap, Building2, Crown } from 'lucide-react';
import Link from 'next/link';

const plans = [
  {
    name: 'Starter',
    nameAr: 'المبتدئ',
    icon: Zap,
    price: 'Starting from',
    priceAr: 'يبدأ من',
    amount: '2,499',
    currency: 'SAR',
    currencyAr: 'ر.س',
    period: '/month',
    periodAr: '/شهرياً',
    description: 'Perfect for small businesses getting started',
    descriptionAr: 'مثالي للشركات الصغيرة في البداية',
    features: [
      { text: 'Up to 50 employees', textAr: 'حتى 50 موظف', included: true },
      { text: 'Core HR modules', textAr: 'وحدات HR الأساسية', included: true },
      { text: 'Payroll processing', textAr: 'معالجة الرواتب', included: true },
      { text: 'Leave management', textAr: 'إدارة الإجازات', included: true },
      { text: 'GOSI integration', textAr: 'تكامل التأمينات', included: true },
      { text: 'Email support', textAr: 'دعم بالبريد الإلكتروني', included: true },
      { text: 'AI features', textAr: 'ميزات الذكاء الاصطناعي', included: false },
      { text: 'Custom integrations', textAr: 'تكاملات مخصصة', included: false },
      { text: 'Dedicated account manager', textAr: 'مدير حساب مخصص', included: false },
    ],
    popular: false,
    gradient: 'from-slate-500 to-slate-600',
  },
  {
    name: 'Professional',
    nameAr: 'المحترف',
    icon: Building2,
    price: 'Starting from',
    priceAr: 'يبدأ من',
    amount: '7,999',
    currency: 'SAR',
    currencyAr: 'ر.س',
    period: '/month',
    periodAr: '/شهرياً',
    description: 'For growing companies with advanced needs',
    descriptionAr: 'للشركات المتنامية ذات الاحتياجات المتقدمة',
    features: [
      { text: 'Up to 500 employees', textAr: 'حتى 500 موظف', included: true },
      { text: 'All HR modules', textAr: 'جميع وحدات HR', included: true },
      { text: 'Advanced payroll', textAr: 'رواتب متقدمة', included: true },
      { text: 'Performance management', textAr: 'إدارة الأداء', included: true },
      { text: 'Full compliance suite', textAr: 'حزمة الامتثال الكاملة', included: true },
      { text: 'Priority support', textAr: 'دعم ذو أولوية', included: true },
      { text: 'AI recruitment', textAr: 'توظيف بالذكاء الاصطناعي', included: true },
      { text: 'API access', textAr: 'وصول API', included: true },
      { text: 'Dedicated account manager', textAr: 'مدير حساب مخصص', included: false },
    ],
    popular: true,
    gradient: 'from-thea-primary to-thea-cyan',
  },
  {
    name: 'Enterprise',
    nameAr: 'المؤسسات',
    icon: Crown,
    price: 'Custom',
    priceAr: 'مخصص',
    amount: 'Custom',
    currency: '',
    currencyAr: '',
    period: '',
    periodAr: '',
    description: 'Tailored solutions for large organizations',
    descriptionAr: 'حلول مصممة للمنظمات الكبيرة',
    features: [
      { text: 'Unlimited employees', textAr: 'موظفين بلا حدود', included: true },
      { text: 'All modules + EHR', textAr: 'جميع الوحدات + EHR', included: true },
      { text: 'Custom workflows', textAr: 'سير عمل مخصص', included: true },
      { text: 'On-premise option', textAr: 'خيار محلي', included: true },
      { text: 'Full compliance suite', textAr: 'حزمة الامتثال الكاملة', included: true },
      { text: '24/7 dedicated support', textAr: 'دعم مخصص 24/7', included: true },
      { text: 'Advanced AI suite', textAr: 'حزمة ذكاء اصطناعي متقدمة', included: true },
      { text: 'Custom integrations', textAr: 'تكاملات مخصصة', included: true },
      { text: 'Dedicated account manager', textAr: 'مدير حساب مخصص', included: true },
    ],
    popular: false,
    gradient: 'from-thea-teal to-emerald-500',
  },
];

export default function PricingContent() {
  const { language } = useLang();
  const isArabic = language === 'ar';
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>(
    'monthly'
  );

  return (
    <div className="min-h-screen bg-white dark:bg-thea-dark">
      {/* Hero */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-thea-primary/10 rounded-full blur-[120px]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-thea-primary/10 border border-thea-primary/20 text-thea-primary text-sm font-medium mb-6">
              {tr('أسعار بسيطة وشفافة', 'Simple, Transparent Pricing')}
            </span>
            <h1
              className={cn(
                'text-4xl md:text-5xl lg:text-6xl font-bold mb-6',
                isArabic && 'font-arabic'
              )}
            >
              {tr('اختر', 'Choose Your')}{' '}
              <span className="text-gradient">{tr('خطتك', 'Plan')}</span>
            </h1>
            <p
              className={cn(
                'text-lg text-slate-400 dark:text-white/40 max-w-2xl mx-auto',
                isArabic && 'font-arabic'
              )}
            >
              {tr(
                'خطط مرنة مصممة للأعمال بجميع الأحجام. ابدأ بما تحتاج وتوسع مع نموك.',
                'Flexible plans designed for businesses of all sizes. Start with what you need and scale as you grow.'
              )}
            </p>
          </motion.div>

          {/* Billing toggle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex items-center justify-center gap-4 mt-10"
          >
            <span
              className={cn(
                'text-sm transition-colors',
                billingCycle === 'monthly'
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-400 dark:text-white/40'
              )}
            >
              {tr('شهري', 'Monthly')}
            </span>
            <button
              onClick={() =>
                setBillingCycle(
                  billingCycle === 'monthly' ? 'annual' : 'monthly'
                )
              }
              className={cn(
                'relative w-14 h-7 rounded-full transition-colors',
                billingCycle === 'annual'
                  ? 'bg-thea-primary'
                  : 'bg-slate-300 dark:bg-white/20'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-5 h-5 bg-white rounded-full transition-transform',
                  billingCycle === 'annual'
                    ? 'translate-x-8'
                    : 'translate-x-1'
                )}
              />
            </button>
            <span
              className={cn(
                'text-sm transition-colors',
                billingCycle === 'annual'
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-400 dark:text-white/40'
              )}
            >
              {tr('سنوي', 'Annual')}
              <span className="ml-1.5 text-thea-teal text-xs font-medium">
                {tr('وفر 20%', 'Save 20%')}
              </span>
            </span>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="relative pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.15 }}
                className={cn(
                  'relative rounded-2xl border p-8 transition-all duration-300 hover:scale-[1.02]',
                  plan.popular
                    ? 'border-thea-primary/50 bg-gradient-to-b from-thea-primary/10 to-transparent glow-border'
                    : 'border-slate-200 dark:border-white/10 bg-white dark:bg-thea-dark shadow-sm dark:shadow-none'
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 rounded-full bg-gradient-to-r from-thea-primary to-thea-cyan text-white text-sm font-medium">
                      {tr('الأكثر شعبية', 'Most Popular')}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br',
                      plan.gradient
                    )}
                  >
                    <plan.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3
                    className={cn(
                      'text-xl font-bold mb-2',
                      isArabic && 'font-arabic'
                    )}
                  >
                    {tr(plan.nameAr, plan.name)}
                  </h3>
                  <p
                    className={cn(
                      'text-sm text-slate-400 dark:text-white/40',
                      isArabic && 'font-arabic'
                    )}
                  >
                    {tr(plan.descriptionAr, plan.description)}
                  </p>
                </div>

                <div className="mb-8">
                  {plan.amount !== 'Custom' ? (
                    <>
                      <span className="text-sm text-slate-400 dark:text-white/40">
                        {tr(plan.priceAr, plan.price)}
                      </span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-4xl font-bold">
                          {plan.amount}
                        </span>
                        <span className="text-slate-400 dark:text-white/40">
                          {tr(plan.currencyAr, plan.currency)}
                          {tr(plan.periodAr, plan.period)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="mt-1">
                      <span className="text-4xl font-bold">
                        {tr('مخصص', 'Custom')}
                      </span>
                    </div>
                  )}
                </div>

                <Link
                  href="/contact"
                  className={cn(
                    'block w-full py-3 rounded-xl font-medium text-center transition-all mb-8',
                    plan.popular
                      ? 'bg-gradient-to-r from-thea-primary to-thea-cyan text-white hover:shadow-lg hover:shadow-thea-primary/25'
                      : 'bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/15'
                  )}
                >
                  {plan.amount === 'Custom'
                    ? tr('تواصل مع المبيعات', 'Contact Sales')
                    : tr('ابدأ الآن', 'Get Started')}
                </Link>

                <ul className="space-y-3">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-center gap-3">
                      {feature.included ? (
                        <Check className="w-4 h-4 text-thea-teal flex-shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-slate-600 dark:text-white/30 flex-shrink-0" />
                      )}
                      <span
                        className={cn(
                          'text-sm',
                          feature.included
                            ? 'text-slate-700 dark:text-white/80'
                            : 'text-slate-400 dark:text-white/40',
                          isArabic && 'font-arabic'
                        )}
                      >
                        {tr(feature.textAr, feature.text)}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
