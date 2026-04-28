"use client";

import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import {
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Twitter,
  Github,
} from "lucide-react";

const productLinks = [
  {
    href: "/products/cvision-hr",
    en: "CVision HR",
    ar: "CVision HR",
  },
  {
    href: "/products/thea-ehr",
    en: "Thea EHR",
    ar: "Thea EHR",
  },
];

const companyLinks = [
  { href: "/about", en: "About", ar: "\u0639\u0646\u0651\u0627" },
  { href: "/blog", en: "Blog", ar: "\u0627\u0644\u0645\u062F\u0648\u0646\u0629" },
  { href: "/pricing", en: "Pricing", ar: "\u0627\u0644\u0623\u0633\u0639\u0627\u0631" },
  { href: "/contact", en: "Contact", ar: "\u0627\u062A\u0635\u0644 \u0628\u0646\u0627" },
];

const legalLinks = [
  { href: "/privacy", en: "Privacy Policy", ar: "\u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u062E\u0635\u0648\u0635\u064A\u0629" },
  { href: "/terms", en: "Terms of Service", ar: "\u0634\u0631\u0648\u0637 \u0627\u0644\u062E\u062F\u0645\u0629" },
  { href: "/cookies", en: "Cookie Policy", ar: "\u0633\u064A\u0627\u0633\u0629 \u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0627\u0631\u062A\u0628\u0627\u0637" },
];

const socialLinks = [
  {
    href: "https://linkedin.com/company/thea-technologies",
    label: "LinkedIn",
    icon: Linkedin,
  },
  {
    href: "https://x.com/theatech",
    label: "X (Twitter)",
    icon: Twitter,
  },
  {
    href: "https://github.com/thea-technologies",
    label: "GitHub",
    icon: Github,
  },
];

export default function Footer() {
  const { t, isArabic } = useLanguage();

  return (
    <footer
      className={cn(
        "relative bg-slate-50 dark:bg-thea-dark border-t border-slate-200 dark:border-white/10",
        isArabic && "font-arabic"
      )}
    >
      {/* Gradient accent line */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px bg-thea-gradient"
      />

      {/* Main footer content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div
          className={cn(
            "grid grid-cols-1 gap-12",
            "sm:grid-cols-2",
            "lg:grid-cols-4"
          )}
        >
          {/* Column 1: Company info */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-block mb-6">
              <Image
                src="/logos/thea-logo.svg"
                alt="Thea Technologies"
                width={140}
                height={40}
                className="h-10 w-auto dark:hidden"
              />
              <Image
                src="/logos/thea-logo-dark.svg"
                alt="Thea Technologies"
                width={140}
                height={40}
                className="h-10 w-auto hidden dark:block"
              />
            </Link>
            <p className="text-slate-600 dark:text-white/70 text-sm leading-relaxed max-w-xs">
              {t(
                "Enterprise SaaS platforms for HR and Healthcare. Empowering organizations across the MENA region with intelligent solutions.",
                "\u0645\u0646\u0635\u0627\u062A SaaS \u0644\u0644\u0645\u0624\u0633\u0633\u0627\u062A \u0641\u064A \u0645\u062C\u0627\u0644\u064A \u0627\u0644\u0645\u0648\u0627\u0631\u062F \u0627\u0644\u0628\u0634\u0631\u064A\u0629 \u0648\u0627\u0644\u0631\u0639\u0627\u064A\u0629 \u0627\u0644\u0635\u062D\u064A\u0629. \u0646\u064F\u0645\u0643\u0651\u0646 \u0627\u0644\u0645\u0624\u0633\u0633\u0627\u062A \u0641\u064A \u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642 \u0627\u0644\u0623\u0648\u0633\u0637 \u0648\u0634\u0645\u0627\u0644 \u0623\u0641\u0631\u064A\u0642\u064A\u0627 \u0628\u062D\u0644\u0648\u0644 \u0630\u0643\u064A\u0629."
              )}
            </p>

            {/* Vision 2030 badge */}
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-thea-primary/20 bg-thea-primary/5 px-4 py-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-thea-teal opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-thea-teal" />
              </span>
              <span className="text-xs font-medium text-thea-teal">
                {t(
                  "Aligned with Saudi Vision 2030",
                  "\u0645\u062A\u0648\u0627\u0641\u0642 \u0645\u0639 \u0631\u0624\u064A\u0629 \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629 2030"
                )}
              </span>
            </div>
          </div>

          {/* Column 2: Products */}
          <div>
            <h3 className="text-slate-900 dark:text-white text-sm font-semibold uppercase tracking-wider mb-6">
              {t("Products", "\u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A")}
            </h3>
            <ul className="space-y-4">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      "text-slate-600 dark:text-white/70 text-sm transition-colors duration-200",
                      "hover:text-thea-primary"
                    )}
                  >
                    {t(link.en, link.ar)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Company */}
          <div>
            <h3 className="text-slate-900 dark:text-white text-sm font-semibold uppercase tracking-wider mb-6">
              {t("Company", "\u0627\u0644\u0634\u0631\u0643\u0629")}
            </h3>
            <ul className="space-y-4">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      "text-slate-600 dark:text-white/70 text-sm transition-colors duration-200",
                      "hover:text-thea-primary"
                    )}
                  >
                    {t(link.en, link.ar)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Contact */}
          <div>
            <h3 className="text-slate-900 dark:text-white text-sm font-semibold uppercase tracking-wider mb-6">
              {t("Contact", "\u062A\u0648\u0627\u0635\u0644 \u0645\u0639\u0646\u0627")}
            </h3>
            <ul className="space-y-4">
              <li>
                <a
                  href="mailto:hello@thea.sa"
                  className={cn(
                    "flex items-center gap-3 text-slate-600 dark:text-white/70 text-sm transition-colors duration-200",
                    "hover:text-thea-primary group"
                  )}
                >
                  <Mail className="h-4 w-4 shrink-0 text-slate-400 dark:text-white/40 group-hover:text-thea-primary transition-colors duration-200" />
                  <span>hello@thea.sa</span>
                </a>
              </li>
              <li>
                <a
                  href="tel:+966112345678"
                  className={cn(
                    "flex items-center gap-3 text-slate-600 dark:text-white/70 text-sm transition-colors duration-200",
                    "hover:text-thea-primary group"
                  )}
                >
                  <Phone className="h-4 w-4 shrink-0 text-slate-400 dark:text-white/40 group-hover:text-thea-primary transition-colors duration-200" />
                  <span dir="ltr">+966 11 234 5678</span>
                </a>
              </li>
              <li>
                <div className="flex items-start gap-3 text-slate-600 dark:text-white/70 text-sm">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-slate-400 dark:text-white/40" />
                  <span>
                    {t(
                      "Riyadh, Saudi Arabia",
                      "\u0627\u0644\u0631\u064A\u0627\u0636\u060C \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629"
                    )}
                  </span>
                </div>
              </li>
            </ul>

            {/* Social links */}
            <div
              className={cn(
                "flex items-center gap-3 mt-8",
                isArabic && "flex-row-reverse justify-end"
              )}
            >
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    "bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/50",
                    "transition-all duration-200",
                    "hover:bg-thea-primary/10 hover:text-thea-primary",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-thea-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-thea-dark"
                  )}
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-16 border-t border-slate-200 dark:border-white/10" />

        {/* Bottom bar */}
        <div
          className={cn(
            "mt-8 flex flex-col items-center gap-4",
            "sm:flex-row sm:justify-between"
          )}
        >
          <p className="text-slate-400 dark:text-white/40 text-xs">
            {t(
              "\u00A9 2024 Thea Technologies. All Rights Reserved.",
              "\u00A9 2024 Thea Technologies. \u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0642\u0648\u0642 \u0645\u062D\u0641\u0648\u0638\u0629."
            )}
          </p>

          <nav aria-label={t("Legal", "\u0642\u0627\u0646\u0648\u0646\u064A")}>
            <ul
              className={cn(
                "flex items-center gap-6",
                isArabic && "flex-row-reverse"
              )}
            >
              {legalLinks.map((link, index) => (
                <li key={link.href} className="flex items-center gap-6">
                  <Link
                    href={link.href}
                    className={cn(
                      "text-slate-400 dark:text-white/40 text-xs transition-colors duration-200",
                      "hover:text-slate-600 dark:hover:text-white/70"
                    )}
                  >
                    {t(link.en, link.ar)}
                  </Link>
                  {index < legalLinks.length - 1 && (
                    <span aria-hidden="true" className="text-slate-300 dark:text-white/20">
                      |
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
