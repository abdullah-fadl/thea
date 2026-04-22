"use client";

import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

export default function CTASection() {
  const { t, isArabic } = useLanguage();

  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-thea-primary via-thea-cyan to-thea-teal" />

      {/* Pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Floating decorative elements */}
      <motion.div
        className="absolute top-10 left-[10%] w-20 h-20 rounded-full bg-white/10 blur-xl"
        animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-10 right-[15%] w-32 h-32 rounded-full bg-white/10 blur-xl"
        animate={{ y: [0, 15, 0], x: [0, -10, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className="absolute top-1/2 left-[5%] w-16 h-16 rounded-full bg-white/5 blur-lg"
        animate={{ y: [0, -15, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute top-[20%] right-[8%] w-12 h-12 rounded-full bg-white/5 blur-lg"
        animate={{ y: [0, 12, 0], x: [0, -8, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />

      {/* Decorative corner shapes */}
      <div className="absolute top-0 left-0 w-40 h-40 border-t-2 border-l-2 border-white/10 rounded-tl-3xl" />
      <div className="absolute bottom-0 right-0 w-40 h-40 border-b-2 border-r-2 border-white/10 rounded-br-3xl" />

      <div className="relative z-10 max-w-4xl mx-auto container-padding text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className={cn("flex flex-col items-center gap-6", isArabic && "font-arabic")}
        >
          {/* Sparkle icon */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Sparkles className="w-10 h-10 text-white/80" />
          </motion.div>

          {/* Heading */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
            {t(
              "Ready to Transform Your Business?",
              "هل أنت مستعد لتحويل أعمالك؟"
            )}
          </h2>

          {/* Subtext */}
          <p className="text-white/80 text-lg sm:text-xl max-w-2xl leading-relaxed">
            {t(
              "Join hundreds of Saudi companies already using Thea to streamline their operations. Get started today with a free trial.",
              "انضم إلى مئات الشركات السعودية التي تستخدم ثيا بالفعل لتبسيط عملياتها. ابدأ اليوم مع تجربة مجانية."
            )}
          </p>

          {/* Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap justify-center gap-4 mt-2"
          >
            <Link
              href="/contact"
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-thea-dark font-semibold text-base transition-all duration-300 hover:bg-white/90 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-105"
            >
              {t("Start Free Trial", "ابدأ التجربة المجانية")}
              <ArrowRight
                className={cn(
                  "w-5 h-5 transition-transform group-hover:translate-x-1",
                  isArabic && "rotate-180 group-hover:-translate-x-1"
                )}
              />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border-2 border-white/30 text-white font-semibold text-base transition-all duration-300 hover:bg-white/10 hover:border-white/50"
            >
              {t("Contact Sales", "تواصل مع المبيعات")}
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
