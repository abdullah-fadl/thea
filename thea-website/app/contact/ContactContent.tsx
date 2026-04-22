"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import {
  Mail,
  Phone,
  MapPin,
  Send,
  Building2,
  Clock,
  MessageSquare,
} from "lucide-react";

const contactInfo = [
  {
    icon: Mail,
    title: "Email",
    titleAr: "البريد الإلكتروني",
    value: "hello@thea.sa",
    valueAr: "hello@thea.sa",
    href: "mailto:hello@thea.sa",
  },
  {
    icon: Phone,
    title: "Phone",
    titleAr: "الهاتف",
    value: "+966 11 234 5678",
    valueAr: "+966 11 234 5678",
    href: "tel:+966112345678",
  },
  {
    icon: MapPin,
    title: "Address",
    titleAr: "العنوان",
    value: "Riyadh, Saudi Arabia",
    valueAr: "الرياض، المملكة العربية السعودية",
    href: "#",
  },
  {
    icon: Clock,
    title: "Working Hours",
    titleAr: "ساعات العمل",
    value: "Sun - Thu, 9:00 AM - 6:00 PM",
    valueAr: "الأحد - الخميس، 9:00 ص - 6:00 م",
    href: "#",
  },
];

export default function ContactContent() {
  const { t, isArabic } = useLanguage();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    product: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Form submission logic here
  };

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
              {t("Contact Us", "تواصل معنا")}
            </span>
            <h1
              className={cn(
                "text-4xl md:text-5xl lg:text-6xl font-bold mb-6",
                isArabic && "font-arabic"
              )}
            >
              {t("Let's", "لنبدأ")}{" "}
              <span className="text-gradient">
                {t("Talk", "الحديث")}
              </span>
            </h1>
            <p
              className={cn(
                "text-lg text-slate-400 dark:text-white/40 max-w-2xl mx-auto",
                isArabic && "font-arabic"
              )}
            >
              {t(
                "Have a question or ready to get started? We'd love to hear from you. Our team will get back to you within 24 hours.",
                "لديك سؤال أو مستعد للبدء؟ يسعدنا سماعك. فريقنا سيرد عليك خلال 24 ساعة."
              )}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            {/* Form */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="lg:col-span-3"
            >
              <div className="p-8 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-thea-dark shadow-sm dark:shadow-none">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-thea-primary/10 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-thea-primary" />
                  </div>
                  <h2
                    className={cn(
                      "text-xl font-bold",
                      isArabic && "font-arabic"
                    )}
                  >
                    {t("Send us a message", "أرسل لنا رسالة")}
                  </h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label
                        className={cn(
                          "block text-sm font-medium text-slate-700 dark:text-white/80 mb-2",
                          isArabic && "font-arabic"
                        )}
                      >
                        {t("Full Name", "الاسم الكامل")}
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-thea-dark-secondary border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-thea-primary/50 focus:border-thea-primary/50 transition-all"
                        placeholder={t("John Doe", "محمد أحمد")}
                      />
                    </div>
                    <div>
                      <label
                        className={cn(
                          "block text-sm font-medium text-slate-700 dark:text-white/80 mb-2",
                          isArabic && "font-arabic"
                        )}
                      >
                        {t("Email Address", "البريد الإلكتروني")}
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-thea-dark-secondary border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-thea-primary/50 focus:border-thea-primary/50 transition-all"
                        placeholder="john@company.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label
                        className={cn(
                          "block text-sm font-medium text-slate-700 dark:text-white/80 mb-2",
                          isArabic && "font-arabic"
                        )}
                      >
                        {t("Company", "الشركة")}
                      </label>
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            company: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-thea-dark-secondary border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-thea-primary/50 focus:border-thea-primary/50 transition-all"
                        placeholder={t("Company Name", "اسم الشركة")}
                      />
                    </div>
                    <div>
                      <label
                        className={cn(
                          "block text-sm font-medium text-slate-700 dark:text-white/80 mb-2",
                          isArabic && "font-arabic"
                        )}
                      >
                        {t("Interested In", "مهتم بـ")}
                      </label>
                      <select
                        value={formData.product}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            product: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-thea-dark-secondary border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-thea-primary/50 focus:border-thea-primary/50 transition-all"
                      >
                        <option value="">
                          {t("Select a product", "اختر منتج")}
                        </option>
                        <option value="cvision-hr">CVision HR</option>
                        <option value="thea-ehr">Thea EHR</option>
                        <option value="both">
                          {t("Both Products", "كلا المنتجين")}
                        </option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      className={cn(
                        "block text-sm font-medium text-slate-700 dark:text-white/80 mb-2",
                        isArabic && "font-arabic"
                      )}
                    >
                      {t("Message", "الرسالة")}
                    </label>
                    <textarea
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          message: e.target.value,
                        })
                      }
                      rows={5}
                      className="w-full px-4 py-3 rounded-xl bg-white dark:bg-thea-dark-secondary border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-thea-primary/50 focus:border-thea-primary/50 transition-all resize-none"
                      placeholder={t(
                        "Tell us about your needs...",
                        "أخبرنا عن احتياجاتك..."
                      )}
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-thea-primary to-thea-cyan text-white font-medium hover:shadow-lg hover:shadow-thea-primary/25 transition-all flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {t("Send Message", "إرسال الرسالة")}
                  </button>
                </form>
              </div>
            </motion.div>

            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="lg:col-span-2 space-y-6"
            >
              {contactInfo.map((info, index) => (
                <a
                  key={info.title}
                  href={info.href}
                  className="flex items-start gap-4 p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-thea-dark hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group shadow-sm dark:shadow-none"
                >
                  <div className="w-11 h-11 rounded-xl bg-thea-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-thea-primary/20 transition-colors">
                    <info.icon className="w-5 h-5 text-thea-primary" />
                  </div>
                  <div>
                    <h3
                      className={cn(
                        "text-sm font-medium text-slate-400 dark:text-white/40 mb-1",
                        isArabic && "font-arabic"
                      )}
                    >
                      {t(info.title, info.titleAr)}
                    </h3>
                    <p className="text-slate-900 dark:text-white font-medium">
                      {t(info.value, info.valueAr)}
                    </p>
                  </div>
                </a>
              ))}

              {/* Map placeholder */}
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-thea-dark-secondary overflow-hidden h-64 flex items-center justify-center">
                <div className="text-center">
                  <Building2 className="w-10 h-10 text-thea-primary/30 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-white/50 text-sm">
                    {t("Riyadh, Saudi Arabia", "الرياض، المملكة العربية السعودية")}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
