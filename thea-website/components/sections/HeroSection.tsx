"use client";

import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Users, Clock, Layers, ShieldCheck } from "lucide-react";
import Link from "next/link";

const stats = [
  {
    icon: Users,
    valueEn: "500+",
    valueAr: "500+",
    labelEn: "Clients",
    labelAr: "عميل",
  },
  {
    icon: Clock,
    valueEn: "99.9%",
    valueAr: "99.9%",
    labelEn: "Uptime",
    labelAr: "وقت التشغيل",
  },
  {
    icon: Layers,
    valueEn: "50+",
    valueAr: "50+",
    labelEn: "Features",
    labelAr: "ميزة",
  },
  {
    icon: ShieldCheck,
    valueEn: "100%",
    valueAr: "100%",
    labelEn: "Saudi Compliant",
    labelAr: "متوافق مع الأنظمة السعودية",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export default function HeroSection() {
  const { t, isArabic } = useLanguage();

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-thea-dark dark:via-thea-dark dark:to-thea-dark" />
      <div className="absolute inset-0 bg-grid-pattern opacity-60" />

      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-thea-primary/20"
            style={{
              width: Math.random() * 4 + 2,
              height: Math.random() * 4 + 2,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: Math.random() * 4 + 3,
              repeat: Infinity,
              delay: Math.random() * 3,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Radial glow accents */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-thea-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-thea-teal/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-7xl mx-auto container-padding">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center min-h-[80vh] py-24">
          {/* Left content */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={cn("flex flex-col gap-6", isArabic && "lg:order-2 text-right")}
          >
            {/* Badge */}
            <motion.div variants={itemVariants}>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-thea-primary/10 border border-thea-primary/20 text-thea-primary text-sm font-medium">
                <Sparkles className="w-4 h-4" />
                {t("AI-Powered Enterprise Platform", "منصة مؤسسية مدعومة بالذكاء الاصطناعي")}
              </span>
            </motion.div>

            {/* Heading */}
            <motion.h1
              variants={itemVariants}
              className={cn(
                "text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight tracking-tight",
                isArabic && "font-arabic"
              )}
            >
              <span className="text-slate-900 dark:text-white">
                {t("Everything You Need,", "كل ما تحتاجه،")}
              </span>
              <br />
              <span className="text-gradient">
                {t("Between Your Hands", "بين يديك")}
              </span>
            </motion.h1>

            {/* Subheading */}
            <motion.p
              variants={itemVariants}
              className={cn(
                "text-lg sm:text-xl text-slate-500 dark:text-white/50 max-w-xl leading-relaxed",
                isArabic && "font-arabic"
              )}
            >
              {t(
                "AI-powered enterprise platforms for Human Resources and Healthcare. Built for Saudi Arabia, designed for the future.",
                "منصات مؤسسية مدعومة بالذكاء الاصطناعي للموارد البشرية والرعاية الصحية. صُممت للمملكة العربية السعودية، بُنيت للمستقبل."
              )}
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              variants={itemVariants}
              className={cn("flex flex-wrap gap-4 mt-2", isArabic && "justify-end")}
            >
              <Link
                href="#products"
                className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-thea-primary via-thea-cyan to-thea-teal text-white font-semibold text-base transition-all duration-300 hover:shadow-[0_0_30px_rgba(14,165,233,0.4)] hover:scale-105"
              >
                {t("Explore Products", "استكشف المنتجات")}
                <ArrowRight className={cn("w-5 h-5 transition-transform group-hover:translate-x-1", isArabic && "rotate-180 group-hover:-translate-x-1")} />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/80 font-semibold text-base transition-all duration-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:border-slate-300"
              >
                {t("Book a Demo", "احجز عرض تجريبي")}
              </Link>
            </motion.div>
          </motion.div>

          {/* Right side - Tech visualization */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            className={cn(
              "relative flex items-center justify-center lg:justify-end",
              isArabic && "lg:order-1 lg:justify-start"
            )}
          >
            <div className="relative w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] lg:w-[480px] lg:h-[480px]">
              {/* Central glowing orb */}
              <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-thea-primary/30 via-thea-cyan/20 to-thea-teal/30 blur-xl"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-thea-primary via-thea-cyan to-thea-teal opacity-60" />

              {/* Orbit ring 1 */}
              <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-60 sm:h-60 rounded-full border border-thea-primary/20"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-thea-primary shadow-[0_0_10px_rgba(14,165,233,0.6)]" />
                <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2 h-2 rounded-full bg-thea-cyan shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
              </motion.div>

              {/* Orbit ring 2 */}
              <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 sm:w-80 sm:h-80 lg:w-96 lg:h-96 rounded-full border border-thea-teal/10"
                animate={{ rotate: -360 }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-thea-teal shadow-[0_0_8px_rgba(20,184,166,0.6)]" />
                <div className="absolute bottom-4 left-8 w-2.5 h-2.5 rounded-full bg-thea-primary/60 shadow-[0_0_6px_rgba(14,165,233,0.4)]" />
              </motion.div>

              {/* Floating tech elements */}
              <motion.div
                className="absolute top-8 right-8 sm:top-4 sm:right-12 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl glass-dark flex items-center justify-center"
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-thea-primary to-thea-cyan opacity-80" />
              </motion.div>

              <motion.div
                className="absolute bottom-12 left-4 sm:bottom-8 sm:left-8 w-14 h-14 sm:w-16 sm:h-16 rounded-xl glass-dark flex items-center justify-center"
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              >
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-thea-teal to-thea-cyan opacity-80" />
              </motion.div>

              <motion.div
                className="absolute top-1/3 left-0 sm:-left-4 w-12 h-12 sm:w-14 sm:h-14 rounded-lg glass-dark flex items-center justify-center"
                animate={{ y: [0, -8, 0], x: [0, 4, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
              >
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-gradient-to-br from-thea-primary to-thea-teal opacity-70" />
              </motion.div>

              {/* Decorative lines */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 480 480">
                <motion.line
                  x1="240" y1="200" x2="340" y2="100"
                  stroke="rgba(14,165,233,0.15)"
                  strokeWidth="1"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 2, delay: 0.8 }}
                />
                <motion.line
                  x1="240" y1="240" x2="140" y2="360"
                  stroke="rgba(20,184,166,0.15)"
                  strokeWidth="1"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 2, delay: 1.2 }}
                />
                <motion.line
                  x1="240" y1="220" x2="80" y2="180"
                  stroke="rgba(6,182,212,0.12)"
                  strokeWidth="1"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 2, delay: 1.5 }}
                />
              </svg>
            </div>
          </motion.div>
        </div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.8 }}
          className="relative z-10 pb-12"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 p-6 md:p-8 rounded-2xl glass-dark glow-border">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 1 + index * 0.1 }}
                  className={cn(
                    "flex flex-col items-center text-center gap-2",
                    isArabic && "font-arabic"
                  )}
                >
                  <Icon className="w-5 h-5 text-thea-primary mb-1" />
                  <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                    {isArabic ? stat.valueAr : stat.valueEn}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-white/50">
                    {isArabic ? stat.labelAr : stat.labelEn}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
