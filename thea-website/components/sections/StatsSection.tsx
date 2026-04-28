"use client";

import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { Building2, Users, Clock, Headphones } from "lucide-react";
import { useRef, useEffect, useState } from "react";

interface AnimatedCounterProps {
  target: number;
  suffix: string;
  isInView: boolean;
  duration?: number;
}

function AnimatedCounter({ target, suffix, isInView, duration = 2 }: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (latest) => Math.round(latest));

  useEffect(() => {
    if (isInView) {
      const controls = animate(motionValue, target, {
        duration,
        ease: "easeOut",
      });
      return controls.stop;
    }
  }, [isInView, target, duration, motionValue]);

  useEffect(() => {
    const unsubscribe = rounded.on("change", (latest) => {
      setDisplayValue(latest);
    });
    return unsubscribe;
  }, [rounded]);

  return (
    <span>
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  );
}

const stats = [
  {
    icon: Building2,
    target: 500,
    suffix: "+",
    labelEn: "Companies",
    labelAr: "شركة",
    descriptionEn: "Trust Thea for their operations",
    descriptionAr: "تثق بثيا لعملياتها",
  },
  {
    icon: Users,
    target: 50,
    suffix: "K+",
    labelEn: "Users",
    labelAr: "مستخدم",
    descriptionEn: "Active across all platforms",
    descriptionAr: "نشط عبر جميع المنصات",
  },
  {
    icon: Clock,
    target: 99.9,
    suffix: "%",
    labelEn: "Uptime",
    labelAr: "وقت التشغيل",
    descriptionEn: "Guaranteed availability SLA",
    descriptionAr: "اتفاقية مستوى خدمة مضمونة",
  },
  {
    icon: Headphones,
    target: 24,
    suffix: "/7",
    labelEn: "Support",
    labelAr: "الدعم",
    descriptionEn: "Round-the-clock assistance",
    descriptionAr: "مساعدة على مدار الساعة",
  },
];

export default function StatsSection() {
  const { t, isArabic } = useLanguage();
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  return (
    <section ref={sectionRef} className="relative py-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-50 dark:from-thea-dark via-white dark:via-thea-dark to-slate-50 dark:to-thea-dark" />
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />

      {/* Glow accents */}
      <div className="absolute top-0 left-0 w-[400px] h-[200px] bg-thea-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[200px] bg-thea-teal/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Top and bottom borders */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-thea-primary/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-thea-teal/20 to-transparent" />

      <div className="relative z-10 max-w-7xl mx-auto container-padding">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className={cn(
                  "flex flex-col items-center text-center gap-3",
                  isArabic && "font-arabic"
                )}
              >
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-thea-primary/10 to-thea-teal/10 border border-slate-100 dark:border-white/5 flex items-center justify-center mb-1">
                  <Icon className="w-6 h-6 text-thea-primary" />
                </div>

                {/* Number */}
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white">
                  <AnimatedCounter
                    target={stat.target}
                    suffix={stat.suffix}
                    isInView={isInView}
                    duration={stat.target > 100 ? 2.5 : 1.5}
                  />
                </div>

                {/* Label */}
                <div className="text-base font-semibold text-slate-700 dark:text-white/80">
                  {t(stat.labelEn, stat.labelAr)}
                </div>

                {/* Description */}
                <div className="text-sm text-slate-400 dark:text-white/40">
                  {t(stat.descriptionEn, stat.descriptionAr)}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
