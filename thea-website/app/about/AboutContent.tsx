"use client";

import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import {
  Target,
  Eye,
  Rocket,
  Users,
  Globe,
  Award,
  Heart,
  Lightbulb,
} from "lucide-react";
import CTASection from "@/components/sections/CTASection";

const values = [
  {
    icon: Lightbulb,
    title: "Innovation",
    titleAr: "الابتكار",
    description: "Pushing boundaries with AI and cutting-edge technology.",
    descriptionAr: "دفع الحدود بالذكاء الاصطناعي والتقنيات المتطورة.",
  },
  {
    icon: Users,
    title: "Customer First",
    titleAr: "العميل أولاً",
    description: "Every decision starts with our customers' needs.",
    descriptionAr: "كل قرار يبدأ من احتياجات عملائنا.",
  },
  {
    icon: Globe,
    title: "Local Expertise",
    titleAr: "خبرة محلية",
    description:
      "Deep understanding of Saudi market and regulatory landscape.",
    descriptionAr: "فهم عميق للسوق السعودي والمشهد التنظيمي.",
  },
  {
    icon: Award,
    title: "Excellence",
    titleAr: "التميز",
    description: "Relentless pursuit of quality in everything we build.",
    descriptionAr: "سعي دؤوب للجودة في كل ما نبنيه.",
  },
  {
    icon: Heart,
    title: "Impact",
    titleAr: "التأثير",
    description: "Building technology that makes a real difference.",
    descriptionAr: "بناء تقنية تُحدث فرقاً حقيقياً.",
  },
  {
    icon: Rocket,
    title: "Agility",
    titleAr: "المرونة",
    description: "Moving fast and adapting to evolving market needs.",
    descriptionAr: "التحرك بسرعة والتكيف مع احتياجات السوق المتطورة.",
  },
];

const stats = [
  { value: "2021", label: "Founded", labelAr: "تأسست" },
  { value: "50+", label: "Team Members", labelAr: "عضو فريق" },
  { value: "500+", label: "Clients", labelAr: "عميل" },
  { value: "3", label: "Countries", labelAr: "دول" },
];

export default function AboutContent() {
  const { t, isArabic } = useLanguage();

  return (
    <div className="min-h-screen bg-white dark:bg-thea-dark">
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-thea-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-thea-teal/5 rounded-full blur-[120px]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-thea-primary/10 border border-thea-primary/20 text-thea-primary text-sm font-medium mb-6">
              {t("About Thea", "عن ثيا")}
            </span>
            <h1
              className={cn(
                "text-4xl md:text-5xl lg:text-6xl font-bold mb-6",
                isArabic && "font-arabic"
              )}
            >
              {t("Building the Future of", "نبني مستقبل")}{" "}
              <span className="text-gradient">
                {t("Enterprise Software", "البرمجيات المؤسسية")}
              </span>
            </h1>
            <p
              className={cn(
                "text-lg text-slate-400 dark:text-white/40 leading-relaxed",
                isArabic && "font-arabic"
              )}
            >
              {t(
                "We're on a mission to transform how organizations in Saudi Arabia and the Middle East manage their most critical operations — people and health — through intelligent, compliant, and beautifully designed software.",
                "نحن في مهمة لتحويل طريقة إدارة المنظمات في السعودية والشرق الأوسط لعملياتها الأكثر أهمية — الموارد البشرية والصحة — من خلال برمجيات ذكية ومتوافقة ومصممة بشكل جميل."
              )}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="p-8 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-thea-dark shadow-sm dark:shadow-none"
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-thea-primary to-thea-cyan flex items-center justify-center mb-6">
                <Target className="w-7 h-7 text-white" />
              </div>
              <h2
                className={cn(
                  "text-2xl font-bold mb-4",
                  isArabic && "font-arabic"
                )}
              >
                {t("Our Mission", "مهمتنا")}
              </h2>
              <p
                className={cn(
                  "text-slate-400 dark:text-white/40 leading-relaxed",
                  isArabic && "font-arabic"
                )}
              >
                {t(
                  "To empower organizations with AI-powered enterprise platforms that simplify complex operations, ensure regulatory compliance, and drive digital transformation across HR and Healthcare sectors in the Kingdom of Saudi Arabia.",
                  "تمكين المنظمات بمنصات مؤسسية مدعومة بالذكاء الاصطناعي تبسط العمليات المعقدة، وتضمن الامتثال التنظيمي، وتدفع التحول الرقمي في قطاعي الموارد البشرية والرعاية الصحية في المملكة العربية السعودية."
                )}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="p-8 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-thea-dark shadow-sm dark:shadow-none"
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-thea-teal to-emerald-500 flex items-center justify-center mb-6">
                <Eye className="w-7 h-7 text-white" />
              </div>
              <h2
                className={cn(
                  "text-2xl font-bold mb-4",
                  isArabic && "font-arabic"
                )}
              >
                {t("Our Vision", "رؤيتنا")}
              </h2>
              <p
                className={cn(
                  "text-slate-400 dark:text-white/40 leading-relaxed",
                  isArabic && "font-arabic"
                )}
              >
                {t(
                  "To become the leading enterprise SaaS provider in the Middle East, recognized for innovation, reliability, and deep local market expertise — contributing to Saudi Vision 2030's digital transformation goals.",
                  "أن نصبح المزود الرائد لحلول SaaS المؤسسية في الشرق الأوسط، معروفين بالابتكار والموثوقية والخبرة المحلية العميقة — مساهمين في أهداف التحول الرقمي لرؤية السعودية 2030."
                )}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-4xl md:text-5xl font-bold text-gradient mb-2">
                  {stat.value}
                </div>
                <div
                  className={cn(
                    "text-slate-400 dark:text-white/40",
                    isArabic && "font-arabic"
                  )}
                >
                  {t(stat.label, stat.labelAr)}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2
              className={cn(
                "text-3xl md:text-4xl font-bold mb-4",
                isArabic && "font-arabic"
              )}
            >
              {t("Our Values", "قيمنا")}
            </h2>
            <p
              className={cn(
                "text-slate-400 dark:text-white/40 max-w-2xl mx-auto",
                isArabic && "font-arabic"
              )}
            >
              {t(
                "The principles that guide everything we do at Thea.",
                "المبادئ التي توجه كل ما نقوم به في ثيا."
              )}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="p-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-thea-dark hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group shadow-sm dark:shadow-none"
              >
                <div className="w-12 h-12 rounded-xl bg-thea-primary/10 flex items-center justify-center mb-4 group-hover:bg-thea-primary/20 transition-colors">
                  <value.icon className="w-6 h-6 text-thea-primary" />
                </div>
                <h3
                  className={cn(
                    "text-lg font-semibold mb-2",
                    isArabic && "font-arabic"
                  )}
                >
                  {t(value.title, value.titleAr)}
                </h3>
                <p
                  className={cn(
                    "text-sm text-slate-400 dark:text-white/40",
                    isArabic && "font-arabic"
                  )}
                >
                  {t(value.description, value.descriptionAr)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CTASection />
    </div>
  );
}
