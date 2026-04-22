"use client";

import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Brain, Shield, Cloud, Globe, Lock, Headphones } from "lucide-react";

const features = [
  {
    icon: Brain,
    titleEn: "AI-Powered",
    titleAr: "مدعوم بالذكاء الاصطناعي",
    descriptionEn:
      "Smart automation and intelligent insights that transform how you work. From predictive analytics to automated workflows.",
    descriptionAr:
      "أتمتة ذكية ورؤى تحليلية تحول طريقة عملك. من التحليلات التنبؤية إلى سير العمل المؤتمت.",
    gradient: "from-thea-primary to-thea-cyan",
  },
  {
    icon: Shield,
    titleEn: "Saudi Compliant",
    titleAr: "متوافق مع الأنظمة السعودية",
    descriptionEn:
      "Full integration with GOSI, Mudad, Elm, and NPHIES. Stay compliant with all Saudi regulations effortlessly.",
    descriptionAr:
      "تكامل كامل مع التأمينات الاجتماعية ومدد وعلم ونفيس. كن متوافقاً مع جميع الأنظمة السعودية بسهولة.",
    gradient: "from-thea-cyan to-thea-teal",
  },
  {
    icon: Cloud,
    titleEn: "Cloud Native",
    titleAr: "سحابي بالكامل",
    descriptionEn:
      "Scalable cloud infrastructure hosted in Saudi Arabia. Auto-scaling, high availability, and disaster recovery built in.",
    descriptionAr:
      "بنية تحتية سحابية قابلة للتوسع مستضافة في المملكة العربية السعودية. التوسع التلقائي والتوفر العالي واستعادة الكوارث مدمجة.",
    gradient: "from-thea-teal to-thea-primary",
  },
  {
    icon: Globe,
    titleEn: "Bilingual",
    titleAr: "ثنائي اللغة",
    descriptionEn:
      "Complete Arabic and English support with RTL layouts. Every interface, report, and notification in your preferred language.",
    descriptionAr:
      "دعم كامل للعربية والإنجليزية مع تخطيطات من اليمين لليسار. كل واجهة وتقرير وإشعار بلغتك المفضلة.",
    gradient: "from-thea-primary to-thea-teal",
  },
  {
    icon: Lock,
    titleEn: "Secure",
    titleAr: "آمن",
    descriptionEn:
      "Enterprise-grade security with end-to-end encryption, role-based access control, and compliance with international standards.",
    descriptionAr:
      "أمان على مستوى المؤسسات مع تشفير شامل وتحكم في الوصول حسب الأدوار والامتثال للمعايير الدولية.",
    gradient: "from-thea-cyan to-thea-primary",
  },
  {
    icon: Headphones,
    titleEn: "24/7 Support",
    titleAr: "دعم على مدار الساعة",
    descriptionEn:
      "Dedicated support team available around the clock. Get help in Arabic or English whenever you need it.",
    descriptionAr:
      "فريق دعم مخصص متاح على مدار الساعة. احصل على المساعدة بالعربية أو الإنجليزية وقتما تحتاج.",
    gradient: "from-thea-teal to-thea-cyan",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

export default function WhyTheaSection() {
  const { t, isArabic } = useLanguage();

  return (
    <section className="relative section-padding overflow-hidden">
      <div className="absolute inset-0 bg-white dark:bg-thea-dark" />
      <div className="absolute inset-0 bg-grid-pattern opacity-40" />

      {/* Decorative glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-thea-primary/5 rounded-full blur-[120px] pointer-events-none" />

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
            {t("Why Us", "لماذا نحن")}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            {t("Why Choose Thea?", "لماذا ثيا؟")}
          </h2>
          <p className="text-slate-500 dark:text-white/50 text-lg max-w-2xl mx-auto">
            {t(
              "Built with the latest technology and designed specifically for the Saudi market.",
              "بُنيت بأحدث التقنيات وصُممت خصيصاً للسوق السعودي."
            )}
          </p>
        </motion.div>

        {/* Features grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                variants={cardVariants}
                className="group relative"
              >
                <div className="relative rounded-2xl bg-white dark:bg-thea-dark backdrop-blur-sm border border-slate-100 dark:border-white/5 p-8 h-full transition-all duration-500 hover:border-slate-200 dark:hover:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 glow-border-hover shadow-sm dark:shadow-none">
                  {/* Icon */}
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110",
                      feature.gradient
                    )}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  {/* Title */}
                  <h3
                    className={cn(
                      "text-xl font-bold text-slate-900 dark:text-white mb-3",
                      isArabic && "font-arabic text-right"
                    )}
                  >
                    {t(feature.titleEn, feature.titleAr)}
                  </h3>

                  {/* Description */}
                  <p
                    className={cn(
                      "text-slate-500 dark:text-white/50 leading-relaxed text-sm",
                      isArabic && "font-arabic text-right"
                    )}
                  >
                    {t(feature.descriptionEn, feature.descriptionAr)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
