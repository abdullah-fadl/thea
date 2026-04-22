'use client';

import { useLang } from '@/hooks/use-lang';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Globe,
  User,
  LogOut,
  ChevronDown,
  ArrowLeftRight,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function IdentityBar() {
  const { language, setLanguage } = useLang();
  const router = useRouter();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  return (
    <div
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className="flex items-center justify-between border-b border-gray-200 bg-emerald-600 px-4 py-1.5 dark:border-gray-700 dark:bg-emerald-800"
    >
      {/* Left: Organization info */}
      <div className="flex items-center gap-3">
        <Building2 className="h-4 w-4 text-emerald-100" />
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">
            {tr('إمداد', 'IMDAD')}
          </span>
          <Badge
            variant="secondary"
            className="bg-emerald-500/30 text-[10px] text-emerald-50 hover:bg-emerald-500/40"
          >
            {tr('سلسلة الإمداد', 'Supply Chain')}
          </Badge>
        </div>
      </div>

      {/* Right: User actions */}
      <div className="flex items-center gap-2">
        {/* Switch Platform */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-emerald-100 hover:bg-emerald-500/30 hover:text-white"
          onClick={() => router.push('/platforms')}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          <span className="hidden text-xs font-medium sm:inline">
            {tr('تغيير المنصة', 'Switch Platform')}
          </span>
        </Button>

        {/* Language toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-emerald-100 hover:bg-emerald-500/30 hover:text-white"
          onClick={toggleLanguage}
        >
          <Globe className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">
            {language === 'ar' ? 'EN' : 'عربي'}
          </span>
        </Button>

        {/* User menu */}
        <div ref={menuRef} className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-emerald-100 hover:bg-emerald-500/30 hover:text-white"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <User className="h-3.5 w-3.5" />
            <span className="hidden text-xs font-medium sm:inline">
              {tr('المستخدم', 'User')}
            </span>
            <ChevronDown
              className={cn(
                'h-3 w-3 transition-transform',
                menuOpen && 'rotate-180'
              )}
            />
          </Button>

          {menuOpen && (
            <div className="absolute end-0 top-full z-50 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
              <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {tr('المستخدم الحالي', 'Current User')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {tr('مدير سلسلة الإمداد', 'Supply Chain Manager')}
                </p>
              </div>
              <button
                onClick={toggleLanguage}
                className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <Globe className="h-4 w-4" />
                {tr('التبديل إلى الإنجليزية', 'Switch to Arabic')}
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  window.location.href = '/login';
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <LogOut className="h-4 w-4" />
                {tr('تسجيل الخروج', 'Sign Out')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
