"use client";

import Link from "next/link";
import Image from "next/image";
import { useLang } from "@/hooks/use-lang";
import { cn } from "@/lib/utils";
import { Mail, Phone, MapPin, Linkedin, Twitter, Github } from "lucide-react";

const productLinks = [
  { href: "/products/cvision-hr", en: "CVision HR", ar: "CVision HR" },
  { href: "/products/thea-ehr", en: "Thea EHR", ar: "Thea EHR" },
];

const companyLinks = [
  { href: "/about", en: "About", ar: "عنّا" },
  { href: "/blog", en: "Blog", ar: "المدونة" },
  { href: "/pricing", en: "Pricing", ar: "الأسعار" },
  { href: "/contact", en: "Contact", ar: "اتصل بنا" },
];

const legalLinks = [
  { href: "/privacy", en: "Privacy Policy", ar: "سياسة الخصوصية" },
  { href: "/terms", en: "Terms of Service", ar: "شروط الخدمة" },
  { href: "/cookies", en: "Cookie Policy", ar: "سياسة ملفات الارتباط" },
];

const socialLinks = [
  { href: "https://linkedin.com/company/thea-technologies", label: "LinkedIn", icon: Linkedin },
  { href: "https://x.com/theatech", label: "X (Twitter)", icon: Twitter },
  { href: "https://github.com/thea-technologies", label: "GitHub", icon: Github },
];

export default function WebsiteFooter() {
  const { language } = useLang();
  const isArabic = language === 'ar';
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <footer className={cn("relative bg-slate-50 dark:bg-thea-dark border-t border-slate-200 dark:border-white/10", isArabic && "font-arabic")}>
      <div aria-hidden="true" className="absolute top-0 left-0 right-0 h-px bg-thea-gradient" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-block mb-6">
              <Image src="/logos/thea-logo.svg" alt="Thea Technologies" width={140} height={40} className="h-10 w-auto dark:hidden" />
              <Image src="/logos/thea-logo-dark.svg" alt="Thea Technologies" width={140} height={40} className="h-10 w-auto hidden dark:block" />
            </Link>
            <p className="text-slate-600 dark:text-white/70 text-sm leading-relaxed max-w-xs">
              {tr('منصات SaaS للمؤسسات في مجالي الموارد البشرية والرعاية الصحية. نُمكّن المؤسسات في منطقة الشرق الأوسط وشمال أفريقيا بحلول ذكية.', 'Enterprise SaaS platforms for HR and Healthcare. Empowering organizations across the MENA region with intelligent solutions.')}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-thea-primary/20 bg-thea-primary/5 px-4 py-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-thea-teal opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-thea-teal" />
              </span>
              <span className="text-xs font-medium text-thea-teal">{tr('متوافق مع رؤية السعودية 2030', 'Aligned with Saudi Vision 2030')}</span>
            </div>
          </div>

          <div>
            <h3 className="text-slate-900 dark:text-white text-sm font-semibold uppercase tracking-wider mb-6">{tr('المنتجات', 'Products')}</h3>
            <ul className="space-y-4">
              {productLinks.map((link) => (
                <li key={link.href}><Link href={link.href} className="text-slate-600 dark:text-white/70 text-sm transition-colors duration-200 hover:text-thea-primary">{tr(link.ar, link.en)}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-slate-900 dark:text-white text-sm font-semibold uppercase tracking-wider mb-6">{tr('الشركة', 'Company')}</h3>
            <ul className="space-y-4">
              {companyLinks.map((link) => (
                <li key={link.href}><Link href={link.href} className="text-slate-600 dark:text-white/70 text-sm transition-colors duration-200 hover:text-thea-primary">{tr(link.ar, link.en)}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-slate-900 dark:text-white text-sm font-semibold uppercase tracking-wider mb-6">{tr('تواصل معنا', 'Contact')}</h3>
            <ul className="space-y-4">
              <li><a href="mailto:hello@thea.sa" className="flex items-center gap-3 text-slate-600 dark:text-white/70 text-sm transition-colors duration-200 hover:text-thea-primary group"><Mail className="h-4 w-4 shrink-0 text-slate-400 dark:text-white/40 group-hover:text-thea-primary transition-colors duration-200" /><span>hello@thea.sa</span></a></li>
              <li><a href="tel:+966112345678" className="flex items-center gap-3 text-slate-600 dark:text-white/70 text-sm transition-colors duration-200 hover:text-thea-primary group"><Phone className="h-4 w-4 shrink-0 text-slate-400 dark:text-white/40 group-hover:text-thea-primary transition-colors duration-200" /><span dir="ltr">+966 11 234 5678</span></a></li>
              <li><div className="flex items-start gap-3 text-slate-600 dark:text-white/70 text-sm"><MapPin className="h-4 w-4 shrink-0 mt-0.5 text-slate-400 dark:text-white/40" /><span>{tr('الرياض، المملكة العربية السعودية', 'Riyadh, Saudi Arabia')}</span></div></li>
            </ul>
            <div className={cn("flex items-center gap-3 mt-8", isArabic && "flex-row-reverse justify-end")}>
              {socialLinks.map((social) => (
                <a key={social.label} href={social.href} target="_blank" rel="noopener noreferrer" aria-label={social.label} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/50 transition-all duration-200 hover:bg-thea-primary/10 hover:text-thea-primary">
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 border-t border-slate-200 dark:border-white/10" />
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-slate-400 dark:text-white/40 text-xs">{tr('© 2024 Thea Technologies. جميع الحقوق محفوظة.', '© 2024 Thea Technologies. All Rights Reserved.')}</p>
          <nav aria-label={tr('قانوني', 'Legal')}>
            <ul className={cn("flex items-center gap-6", isArabic && "flex-row-reverse")}>
              {legalLinks.map((link, index) => (
                <li key={link.href} className="flex items-center gap-6">
                  <Link href={link.href} className="text-slate-400 dark:text-white/40 text-xs transition-colors duration-200 hover:text-slate-600 dark:hover:text-white/70">{tr(link.ar, link.en)}</Link>
                  {index < legalLinks.length - 1 && <span aria-hidden="true" className="text-slate-300 dark:text-white/20">|</span>}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
