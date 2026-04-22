'use client';

import { motion } from 'framer-motion';
import { useLang } from '@/hooks/use-lang';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Calendar, Clock, ArrowRight, Tag } from 'lucide-react';

const posts = [
  {
    slug: 'ai-transforming-hr-saudi-arabia',
    title: 'How AI is Transforming HR in Saudi Arabia',
    titleAr: 'كيف يحول الذكاء الاصطناعي الموارد البشرية في السعودية',
    excerpt:
      'Discover how artificial intelligence is revolutionizing recruitment, performance management, and employee engagement across Saudi organizations.',
    excerptAr:
      'اكتشف كيف يحول الذكاء الاصطناعي التوظيف وإدارة الأداء ومشاركة الموظفين في المنظمات السعودية.',
    category: 'AI & HR',
    categoryAr: 'الذكاء الاصطناعي والموارد البشرية',
    date: 'Jan 15, 2024',
    dateAr: '15 يناير 2024',
    readTime: '5 min read',
    readTimeAr: '5 دقائق قراءة',
    gradient: 'from-thea-primary to-thea-cyan',
  },
  {
    slug: 'digital-health-records-benefits',
    title: 'The Benefits of Digital Health Records for Saudi Hospitals',
    titleAr: 'فوائد السجلات الصحية الرقمية للمستشفيات السعودية',
    excerpt:
      'Electronic Health Records are transforming patient care in the Kingdom. Learn about the key benefits and implementation strategies.',
    excerptAr:
      'السجلات الصحية الإلكترونية تحول رعاية المرضى في المملكة. تعرف على الفوائد الرئيسية واستراتيجيات التنفيذ.',
    category: 'Healthcare',
    categoryAr: 'الرعاية الصحية',
    date: 'Jan 8, 2024',
    dateAr: '8 يناير 2024',
    readTime: '7 min read',
    readTimeAr: '7 دقائق قراءة',
    gradient: 'from-thea-teal to-emerald-500',
  },
  {
    slug: 'gosi-compliance-guide-2024',
    title: 'Complete GOSI Compliance Guide for 2024',
    titleAr: 'دليل الامتثال الكامل للتأمينات الاجتماعية 2024',
    excerpt:
      'Everything you need to know about GOSI regulations, contribution rates, and compliance requirements for Saudi employers.',
    excerptAr:
      'كل ما تحتاج معرفته عن أنظمة التأمينات الاجتماعية ومعدلات الاشتراكات ومتطلبات الامتثال لأصحاب العمل السعوديين.',
    category: 'Compliance',
    categoryAr: 'الامتثال',
    date: 'Dec 28, 2023',
    dateAr: '28 ديسمبر 2023',
    readTime: '10 min read',
    readTimeAr: '10 دقائق قراءة',
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    slug: 'vision-2030-digital-transformation',
    title: 'Vision 2030: Digital Transformation in Healthcare & HR',
    titleAr: 'رؤية 2030: التحول الرقمي في الرعاية الصحية والموارد البشرية',
    excerpt:
      'How Saudi Vision 2030 is driving technological innovation and digital transformation across key sectors.',
    excerptAr:
      'كيف تدفع رؤية السعودية 2030 الابتكار التقني والتحول الرقمي عبر القطاعات الرئيسية.',
    category: 'Industry',
    categoryAr: 'الصناعة',
    date: 'Dec 15, 2023',
    dateAr: '15 ديسمبر 2023',
    readTime: '6 min read',
    readTimeAr: '6 دقائق قراءة',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    slug: 'payroll-automation-best-practices',
    title: 'Payroll Automation: Best Practices for Saudi Companies',
    titleAr: 'أتمتة الرواتب: أفضل الممارسات للشركات السعودية',
    excerpt:
      'Streamline your payroll processes with automation. Learn about WPS compliance, GOSI integration, and modern payroll best practices.',
    excerptAr:
      'بسّط عمليات الرواتب بالأتمتة. تعرف على امتثال حماية الأجور وتكامل التأمينات وأفضل ممارسات الرواتب الحديثة.',
    category: 'HR Tech',
    categoryAr: 'تقنية الموارد البشرية',
    date: 'Dec 5, 2023',
    dateAr: '5 ديسمبر 2023',
    readTime: '8 min read',
    readTimeAr: '8 دقائق قراءة',
    gradient: 'from-rose-500 to-pink-600',
  },
  {
    slug: 'telemedicine-future-saudi',
    title: 'The Future of Telemedicine in Saudi Arabia',
    titleAr: 'مستقبل الطب عن بُعد في المملكة العربية السعودية',
    excerpt:
      'Telemedicine is reshaping healthcare delivery. Explore the trends, challenges, and opportunities for Saudi healthcare providers.',
    excerptAr:
      'الطب عن بُعد يعيد تشكيل تقديم الرعاية الصحية. استكشف الاتجاهات والتحديات والفرص لمقدمي الرعاية الصحية السعوديين.',
    category: 'Healthcare',
    categoryAr: 'الرعاية الصحية',
    date: 'Nov 20, 2023',
    dateAr: '20 نوفمبر 2023',
    readTime: '6 min read',
    readTimeAr: '6 دقائق قراءة',
    gradient: 'from-cyan-500 to-blue-600',
  },
];

export default function BlogContent() {
  const { language } = useLang();
  const isArabic = language === 'ar';
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

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
              {tr('مدونتنا', 'Our Blog')}
            </span>
            <h1
              className={cn(
                'text-4xl md:text-5xl lg:text-6xl font-bold mb-6',
                isArabic && 'font-arabic'
              )}
            >
              {tr('رؤى و', 'Insights &')}{' '}
              <span className="text-gradient">{tr('تحديثات', 'Updates')}</span>
            </h1>
            <p
              className={cn(
                'text-lg text-slate-400 dark:text-white/40 max-w-2xl mx-auto',
                isArabic && 'font-arabic'
              )}
            >
              {tr(
                'ابقَ على اطلاع بأحدث الاتجاهات في تقنية الموارد البشرية والابتكار الصحي والتحول الرقمي.',
                'Stay updated with the latest trends in HR technology, healthcare innovation, and digital transformation.'
              )}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Blog Grid */}
      <section className="pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post, index) => (
              <motion.article
                key={post.slug}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group"
              >
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-thea-dark overflow-hidden hover:border-thea-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-thea-primary/5 h-full flex flex-col shadow-sm dark:shadow-none">
                  {/* Gradient banner */}
                  <div
                    className={cn(
                      'h-48 bg-gradient-to-br flex items-center justify-center relative overflow-hidden',
                      post.gradient
                    )}
                  >
                    <div className="absolute inset-0 bg-grid-pattern opacity-20" />
                    <div className="relative text-white/20 text-8xl font-bold">
                      {post.title.charAt(0)}
                    </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col">
                    {/* Category */}
                    <div className="flex items-center gap-2 mb-3">
                      <Tag className="w-3.5 h-3.5 text-thea-primary" />
                      <span
                        className={cn(
                          'text-xs font-medium text-thea-primary',
                          isArabic && 'font-arabic'
                        )}
                      >
                        {tr(post.categoryAr, post.category)}
                      </span>
                    </div>

                    {/* Title */}
                    <h2
                      className={cn(
                        'text-lg font-bold mb-3 group-hover:text-thea-primary transition-colors line-clamp-2',
                        isArabic && 'font-arabic'
                      )}
                    >
                      {tr(post.titleAr, post.title)}
                    </h2>

                    {/* Excerpt */}
                    <p
                      className={cn(
                        'text-sm text-slate-400 dark:text-white/40 mb-4 line-clamp-3 flex-1',
                        isArabic && 'font-arabic'
                      )}
                    >
                      {tr(post.excerptAr, post.excerpt)}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-white/50">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {tr(post.dateAr, post.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {tr(post.readTimeAr, post.readTime)}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-thea-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
