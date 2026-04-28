"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLang } from "@/hooks/use-lang";
import { useTheme } from "@/components/ThemeProvider";
import { Menu, X, Globe, ChevronDown, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

interface NavLink {
  labelEn: string;
  labelAr: string;
  href: string;
}

interface ProductItem {
  titleEn: string;
  titleAr: string;
  descEn: string;
  descAr: string;
  href: string;
  icon: React.ReactNode;
  gradient: string;
}

const NAV_LINKS: NavLink[] = [
  { labelEn: "Home", labelAr: "الرئيسية", href: "/" },
  { labelEn: "Pricing", labelAr: "الأسعار", href: "/pricing" },
  { labelEn: "About", labelAr: "من نحن", href: "/about" },
  { labelEn: "Blog", labelAr: "المدونة", href: "/blog" },
  { labelEn: "Contact", labelAr: "تواصل معنا", href: "/contact" },
];

const PRODUCTS: ProductItem[] = [
  {
    titleEn: "CVision HR",
    titleAr: "CVision HR",
    descEn: "AI-powered human resources management platform",
    descAr: "منصة إدارة الموارد البشرية المدعومة بالذكاء الاصطناعي",
    href: "/products/cvision-hr",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
    gradient: "from-thea-primary to-thea-cyan",
  },
  {
    titleEn: "Thea EHR",
    titleAr: "Thea EHR",
    descEn: "Comprehensive electronic health records system",
    descAr: "نظام السجلات الصحية الإلكترونية الشامل",
    href: "/products/thea-ehr",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
      </svg>
    ),
    gradient: "from-thea-cyan to-thea-teal",
  },
];

export default function WebsiteNavbar() {
  const { language, setLanguage } = useLang();
  const isArabic = language === 'ar';
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProductsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDropdownEnter = useCallback(() => {
    if (dropdownTimeoutRef.current) { clearTimeout(dropdownTimeoutRef.current); dropdownTimeoutRef.current = null; }
    setProductsOpen(true);
  }, []);

  const handleDropdownLeave = useCallback(() => {
    dropdownTimeoutRef.current = setTimeout(() => setProductsOpen(false), 200);
  }, []);

  const closeMobile = useCallback(() => { setMobileOpen(false); setMobileProductsOpen(false); }, []);

  const toggleLanguage = () => setLanguage(language === 'ar' ? 'en' : 'ar');

  return (
    <>
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isArabic ? "font-arabic" : "font-sans",
        scrolled
          ? "bg-white/80 dark:bg-thea-dark/80 backdrop-blur-xl shadow-lg shadow-slate-200/50 dark:shadow-black/10 border-b border-slate-200 dark:border-white/5"
          : "bg-white/40 dark:bg-thea-dark/40 backdrop-blur-md"
      )}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between lg:h-20">
            <Link href="/" className="relative flex shrink-0 items-center gap-2" aria-label="Thea — Home">
              <Image src="/logos/thea-logo.svg" alt="Thea" width={120} height={36} priority className="h-8 w-auto lg:h-9 dark:hidden" />
              <Image src="/logos/thea-logo-dark.svg" alt="Thea" width={120} height={36} priority className="h-8 w-auto lg:h-9 hidden dark:block" />
              <span className="hidden items-center text-2xl font-bold tracking-tight" aria-hidden>
                <span className="bg-gradient-to-r from-thea-primary via-thea-cyan to-thea-teal bg-clip-text text-transparent">Thea</span>
              </span>
            </Link>

            <div className="hidden items-center gap-1 lg:flex">
              <NavItem href="/" label={tr('الرئيسية', 'Home')} />
              <div ref={dropdownRef} className="relative" onMouseEnter={handleDropdownEnter} onMouseLeave={handleDropdownLeave}>
                <button type="button" onClick={() => setProductsOpen((p) => !p)} className="group flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 dark:text-white/70 transition-colors hover:text-slate-900 dark:hover:text-white" aria-expanded={productsOpen} aria-haspopup="true">
                  {tr('المنتجات', 'Products')}
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", productsOpen && "rotate-180")} />
                </button>
                <AnimatePresence>
                  {productsOpen && (
                    <motion.div initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.96 }} transition={{ duration: 0.18, ease: "easeOut" }} className={cn("absolute top-full mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-thea-dark/95 p-2 shadow-2xl shadow-slate-200/50 dark:shadow-black/10 backdrop-blur-xl", isArabic ? "right-0" : "left-0")}>
                      {PRODUCTS.map((product) => (
                        <Link key={product.href} href={product.href} onClick={() => setProductsOpen(false)} className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50 dark:hover:bg-white/5">
                          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white", product.gradient)}>{product.icon}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-thea-primary transition-colors">{tr(product.titleAr, product.titleEn)}</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-white/50">{tr(product.descAr, product.descEn)}</p>
                          </div>
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {NAV_LINKS.filter((l) => l.href !== "/").map((link) => (
                <NavItem key={link.href} href={link.href} label={tr(link.labelAr, link.labelEn)} />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={toggleTheme} className="flex items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 w-9 h-9 text-slate-600 dark:text-white/70 transition-all hover:border-thea-primary/50 hover:text-thea-primary hover:bg-slate-50 dark:hover:bg-white/5" aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}>
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button type="button" onClick={toggleLanguage} className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-white/70 transition-all hover:border-thea-primary/50 hover:text-thea-primary hover:bg-slate-50 dark:hover:bg-white/5" aria-label={tr('التبديل إلى الإنجليزية', 'Switch to Arabic')}>
                <Globe className="h-3.5 w-3.5" />
                <span>{language === "ar" ? "EN" : "AR"}</span>
              </button>
              <Link href="/contact" className="hidden rounded-lg bg-gradient-to-r from-thea-primary to-thea-cyan px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-thea-primary/20 transition-all hover:shadow-thea-primary/40 hover:brightness-110 lg:inline-flex">
                {tr('ابدأ الآن', 'Get Started')}
              </Link>
              <button type="button" onClick={() => setMobileOpen((p) => !p)} className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 transition-colors hover:border-thea-primary/50 hover:text-slate-900 dark:hover:text-white lg:hidden" aria-label={tr('فتح القائمة', 'Open menu')} aria-expanded={mobileOpen}>
                <AnimatePresence mode="wait" initial={false}>
                  {mobileOpen ? (
                    <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X className="h-5 w-5" /></motion.span>
                  ) : (
                    <motion.span key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><Menu className="h-5 w-5" /></motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 z-40 bg-black/20 dark:bg-black/60 backdrop-blur-sm lg:hidden" onClick={closeMobile} aria-hidden />
            <motion.div key="sheet" initial={{ x: isArabic ? "-100%" : "100%" }} animate={{ x: 0 }} exit={{ x: isArabic ? "-100%" : "100%" }} transition={{ type: "spring", damping: 26, stiffness: 260 }} className={cn("fixed top-0 z-50 flex h-full w-[300px] max-w-[85vw] flex-col overflow-y-auto border-slate-200 dark:border-white/10 bg-white/95 dark:bg-thea-dark/95 backdrop-blur-xl lg:hidden", isArabic ? "left-0 border-r" : "right-0 border-l")}>
              <div className="flex h-16 items-center justify-between px-5">
                <Link href="/" onClick={closeMobile}>
                  <Image src="/logos/thea-logo.svg" alt="Thea" width={100} height={30} className="h-7 w-auto dark:hidden" />
                  <Image src="/logos/thea-logo-dark.svg" alt="Thea" width={100} height={30} className="h-7 w-auto hidden dark:block" />
                </Link>
                <button type="button" onClick={closeMobile} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 dark:text-white/40 transition-colors hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white" aria-label={tr('إغلاق القائمة', 'Close menu')}><X className="h-5 w-5" /></button>
              </div>
              <div className="h-px w-full bg-slate-100 dark:bg-white/5" />
              <nav className="flex flex-1 flex-col gap-1 p-4">
                <MobileNavLink href="/" label={tr('الرئيسية', 'Home')} onClick={closeMobile} index={0} />
                <div>
                  <button type="button" onClick={() => setMobileProductsOpen((p) => !p)} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-white/70 transition-colors hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white">
                    {tr('المنتجات', 'Products')}
                    <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", mobileProductsOpen && "rotate-180")} />
                  </button>
                  <AnimatePresence>
                    {mobileProductsOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: "easeInOut" }} className="overflow-hidden">
                        <div className={cn("flex flex-col gap-1 pb-1", isArabic ? "pr-3" : "pl-3")}>
                          {PRODUCTS.map((product) => (
                            <Link key={product.href} href={product.href} onClick={closeMobile} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-white/5">
                              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white", product.gradient)}>{product.icon}</span>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-thea-primary transition-colors">{tr(product.titleAr, product.titleEn)}</p>
                                <p className="text-xs text-slate-500 dark:text-white/50 leading-snug">{tr(product.descAr, product.descEn)}</p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {NAV_LINKS.filter((l) => l.href !== "/").map((link, idx) => (
                  <MobileNavLink key={link.href} href={link.href} label={tr(link.labelAr, link.labelEn)} onClick={closeMobile} index={idx + 1} />
                ))}
              </nav>
              <div className="h-px w-full bg-slate-100 dark:bg-white/5" />
              <div className="p-4">
                <Link href="/contact" onClick={closeMobile} className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-thea-primary to-thea-cyan px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-thea-primary/20 transition-all hover:shadow-thea-primary/40 hover:brightness-110">
                  {tr('ابدأ الآن', 'Get Started')}
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="relative rounded-lg px-3 py-2 text-sm font-medium text-slate-600 dark:text-white/70 transition-colors hover:text-slate-900 dark:hover:text-white after:absolute after:inset-x-3 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-gradient-to-r after:from-thea-primary after:to-thea-cyan after:transition-transform after:duration-300 hover:after:scale-x-100">
      {label}
    </Link>
  );
}

function MobileNavLink({ href, label, onClick, index }: { href: string; label: string; onClick: () => void; index: number }) {
  return (
    <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04, duration: 0.2 }}>
      <Link href={href} onClick={onClick} className="flex rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-white/70 transition-colors hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white">
        {label}
      </Link>
    </motion.div>
  );
}
