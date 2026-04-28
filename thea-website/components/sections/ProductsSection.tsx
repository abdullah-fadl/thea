"use client";

import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Brain, Heart, Users, CreditCard, BarChart3, FileText, FlaskConical, CalendarDays, ArrowRight, ClipboardList, Building2, Stethoscope } from "lucide-react";
import Link from "next/link";

const products = [
  {
    id: "cvision-hr",
    icon: Brain,
    secondaryIcon: Users,
    titleEn: "CVision HR",
    titleAr: "سي فيجن للموارد البشرية",
    descriptionEn:
      "AI-powered Human Resources platform that automates recruitment, payroll, performance management, and ensures full Saudi labor law compliance.",
    descriptionAr:
      "منصة الموارد البشرية المدعومة بالذكاء الاصطناعي التي تؤتمت التوظيف والرواتب وإدارة الأداء وتضمن الامتثال الكامل لنظام العمل السعودي.",
    href: "/products/cvision-hr",
    gradient: "from-thea-primary to-thea-cyan",
    features: [
      { icon: Users, en: "AI Recruitment", ar: "التوظيف الذكي" },
      { icon: CreditCard, en: "Payroll & GOSI", ar: "الرواتب والتأمينات" },
      { icon: BarChart3, en: "Performance Analytics", ar: "تحليلات الأداء" },
      { icon: ClipboardList, en: "Leave Management", ar: "إدارة الإجازات" },
      { icon: Building2, en: "Mudad & Elm Integration", ar: "تكامل مدد وعلم" },
      { icon: FileText, en: "Employee Self-Service", ar: "الخدمة الذاتية للموظفين" },
    ],
  },
  {
    id: "thea-ehr",
    icon: Heart,
    secondaryIcon: Stethoscope,
    titleEn: "Thea EHR",
    titleAr: "ثيا للسجلات الصحية",
    descriptionEn:
      "Comprehensive Electronic Health Records system with patient management, lab integration, appointment scheduling, and Saudi NPHIES compliance.",
    descriptionAr:
      "نظام شامل للسجلات الصحية الإلكترونية مع إدارة المرضى وتكامل المختبرات وجدولة المواعيد والامتثال لنظام نفيس السعودي.",
    href: "/products/thea-ehr",
    gradient: "from-thea-teal to-thea-cyan",
    features: [
      { icon: FileText, en: "Patient Records", ar: "سجلات المرضى" },
      { icon: FlaskConical, en: "Lab Integration", ar: "تكامل المختبرات" },
      { icon: CalendarDays, en: "Appointments", ar: "المواعيد" },
      { icon: Stethoscope, en: "Clinical Workflows", ar: "سير العمل السريري" },
      { icon: CreditCard, en: "Insurance & Billing", ar: "التأمين والفواتير" },
      { icon: BarChart3, en: "Health Analytics", ar: "التحليلات الصحية" },
    ],
  },
];

const sectionVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export default function ProductsSection() {
  const { t, isArabic } = useLanguage();

  return (
    <section id="products" className="relative section-padding overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white dark:from-thea-dark dark:via-thea-dark-secondary dark:to-thea-dark" />
      <div className="absolute inset-0 bg-dot-pattern opacity-30" />

      <div className="relative z-10 max-w-7xl mx-auto container-padding">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className={cn("text-center mb-16", isArabic && "font-arabic")}
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-thea-primary/10 border border-thea-primary/20 text-thea-primary text-sm font-medium mb-4">
            {t("Our Solutions", "حلولنا")}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            {t("Our Products", "منتجاتنا")}
          </h2>
          <p className="text-slate-500 dark:text-white/50 text-lg max-w-2xl mx-auto">
            {t(
              "Enterprise-grade platforms designed for the Saudi market, powered by artificial intelligence.",
              "منصات مؤسسية مصممة للسوق السعودي، مدعومة بالذكاء الاصطناعي."
            )}
          </p>
        </motion.div>

        {/* Product cards */}
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid md:grid-cols-2 gap-8"
        >
          {products.map((product) => {
            const MainIcon = product.icon;
            return (
              <motion.div
                key={product.id}
                variants={cardVariants}
                className="group relative"
              >
                {/* Gradient border glow on hover */}
                <div
                  className={cn(
                    "absolute -inset-[1px] rounded-2xl bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm",
                    product.gradient
                  )}
                />
                <div
                  className={cn(
                    "absolute -inset-[1px] rounded-2xl bg-gradient-to-r opacity-0 group-hover:opacity-50 transition-opacity duration-500",
                    product.gradient
                  )}
                />

                {/* Card content */}
                <div className="relative rounded-2xl bg-white dark:bg-thea-dark backdrop-blur-xl border border-slate-200 dark:border-white/10 p-8 h-full flex flex-col group-hover:border-transparent transition-colors duration-500 shadow-sm dark:shadow-none">
                  {/* Icon */}
                  <div
                    className={cn(
                      "w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center mb-6",
                      product.gradient
                    )}
                  >
                    <MainIcon className="w-7 h-7 text-white" />
                  </div>

                  {/* Title */}
                  <h3
                    className={cn(
                      "text-2xl font-bold text-slate-900 dark:text-white mb-3",
                      isArabic && "font-arabic"
                    )}
                  >
                    {t(product.titleEn, product.titleAr)}
                  </h3>

                  {/* Description */}
                  <p
                    className={cn(
                      "text-slate-500 dark:text-white/50 leading-relaxed mb-6",
                      isArabic && "font-arabic"
                    )}
                  >
                    {t(product.descriptionEn, product.descriptionAr)}
                  </p>

                  {/* Features grid */}
                  <div className="grid grid-cols-2 gap-3 mb-8 flex-1">
                    {product.features.map((feature, idx) => {
                      const FeatureIcon = feature.icon;
                      return (
                        <div
                          key={idx}
                          className={cn(
                            "flex items-center gap-2.5 text-sm text-slate-600 dark:text-white/70",
                            isArabic && "flex-row-reverse text-right font-arabic"
                          )}
                        >
                          <FeatureIcon className="w-4 h-4 text-thea-primary shrink-0" />
                          <span>{t(feature.en, feature.ar)}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Learn More link */}
                  <Link
                    href={product.href}
                    className={cn(
                      "inline-flex items-center gap-2 text-thea-primary font-semibold transition-all duration-300 group-hover:gap-3",
                      isArabic && "flex-row-reverse font-arabic"
                    )}
                  >
                    {t("Learn More", "اعرف المزيد")}
                    <ArrowRight
                      className={cn(
                        "w-4 h-4 transition-transform duration-300 group-hover:translate-x-1",
                        isArabic && "rotate-180 group-hover:-translate-x-1"
                      )}
                    />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
