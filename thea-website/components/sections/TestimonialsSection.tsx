"use client";

import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Quote, Star } from "lucide-react";

const testimonials = [
  {
    quoteEn:
      "Thea CVision HR transformed our recruitment process. We reduced hiring time by 60% and the GOSI integration saved us countless hours every month.",
    quoteAr:
      "حولت ثيا سي فيجن للموارد البشرية عملية التوظيف لدينا. قللنا وقت التوظيف بنسبة 60% ووفر لنا تكامل التأمينات الاجتماعية ساعات لا حصر لها كل شهر.",
    nameEn: "Mohammed Al-Rashidi",
    nameAr: "محمد الراشدي",
    roleEn: "HR Director",
    roleAr: "مدير الموارد البشرية",
    companyEn: "Saudi Logistics Co.",
    companyAr: "شركة الخدمات اللوجستية السعودية",
    rating: 5,
  },
  {
    quoteEn:
      "The EHR system is incredibly intuitive. Our doctors and nurses adapted quickly, and the bilingual support makes it perfect for our diverse medical staff.",
    quoteAr:
      "نظام السجلات الصحية الإلكترونية سهل الاستخدام بشكل لا يصدق. تكيف أطباؤنا وممرضونا بسرعة، والدعم ثنائي اللغة يجعله مثالياً لطاقمنا الطبي المتنوع.",
    nameEn: "Dr. Fatima Al-Zahrani",
    nameAr: "د. فاطمة الزهراني",
    roleEn: "Chief Medical Officer",
    roleAr: "المدير الطبي",
    companyEn: "Riyadh Medical Center",
    companyAr: "مركز الرياض الطبي",
    rating: 5,
  },
  {
    quoteEn:
      "Best enterprise platform we have used. The 24/7 support team is exceptional, and the Saudi compliance features give us complete peace of mind.",
    quoteAr:
      "أفضل منصة مؤسسية استخدمناها. فريق الدعم على مدار الساعة استثنائي، وميزات الامتثال السعودي تمنحنا راحة بال كاملة.",
    nameEn: "Abdullah Al-Otaibi",
    nameAr: "عبدالله العتيبي",
    roleEn: "CEO",
    roleAr: "الرئيس التنفيذي",
    companyEn: "Tamkeen Group",
    companyAr: "مجموعة تمكين",
    rating: 5,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
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

export default function TestimonialsSection() {
  const { t, isArabic } = useLanguage();

  return (
    <section className="relative section-padding overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white dark:from-thea-dark dark:via-thea-dark-secondary dark:to-thea-dark" />
      <div className="absolute inset-0 bg-dot-pattern opacity-20" />

      {/* Glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-thea-cyan/5 rounded-full blur-[120px] pointer-events-none" />

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
            {t("Testimonials", "آراء العملاء")}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            {t("What Our Clients Say", "ماذا يقول عملاؤنا")}
          </h2>
          <p className="text-slate-500 dark:text-white/50 text-lg max-w-2xl mx-auto">
            {t(
              "Trusted by leading companies across Saudi Arabia.",
              "موثوق بها من قبل الشركات الرائدة في المملكة العربية السعودية."
            )}
          </p>
        </motion.div>

        {/* Testimonial cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              variants={cardVariants}
              className="group relative"
            >
              <div className="relative rounded-2xl bg-white dark:bg-thea-dark backdrop-blur-sm border border-slate-100 dark:border-white/5 p-8 h-full flex flex-col transition-all duration-500 hover:border-slate-200 dark:hover:border-white/10 dark:hover:bg-white/5 hover:bg-slate-50 glow-border-hover shadow-sm dark:shadow-none">
                {/* Quote icon */}
                <div className="mb-5">
                  <Quote className="w-8 h-8 text-thea-primary/30" />
                </div>

                {/* Stars */}
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-thea-primary text-thea-primary"
                    />
                  ))}
                </div>

                {/* Quote text */}
                <p
                  className={cn(
                    "text-slate-600 dark:text-white/70 leading-relaxed flex-1 mb-6",
                    isArabic && "font-arabic text-right"
                  )}
                >
                  &ldquo;{t(testimonial.quoteEn, testimonial.quoteAr)}&rdquo;
                </p>

                {/* Author */}
                <div
                  className={cn(
                    "flex items-center gap-3 pt-5 border-t border-slate-100 dark:border-white/5",
                    isArabic && "flex-row-reverse"
                  )}
                >
                  {/* Avatar placeholder */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-thea-primary to-thea-teal flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {t(
                      testimonial.nameEn.charAt(0),
                      testimonial.nameAr.charAt(0)
                    )}
                  </div>
                  <div className={cn(isArabic && "text-right")}>
                    <div
                      className={cn(
                        "text-slate-900 dark:text-white font-semibold text-sm",
                        isArabic && "font-arabic"
                      )}
                    >
                      {t(testimonial.nameEn, testimonial.nameAr)}
                    </div>
                    <div
                      className={cn(
                        "text-slate-400 dark:text-white/40 text-xs",
                        isArabic && "font-arabic"
                      )}
                    >
                      {t(testimonial.roleEn, testimonial.roleAr)},{" "}
                      {t(testimonial.companyEn, testimonial.companyAr)}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
