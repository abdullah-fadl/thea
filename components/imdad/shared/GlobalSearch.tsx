'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/hooks/use-lang';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X, Package, ShoppingCart, Warehouse, FileText, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  title: { ar: string; en: string };
  category: { ar: string; en: string };
  href: string;
  icon: React.ElementType;
}

const QUICK_LINKS: SearchResult[] = [
  {
    id: 'inv',
    title: { ar: 'المخزون', en: 'Inventory' },
    category: { ar: 'وحدة', en: 'Module' },
    href: '/imdad/inventory',
    icon: Package,
  },
  {
    id: 'proc',
    title: { ar: 'المشتريات', en: 'Procurement' },
    category: { ar: 'وحدة', en: 'Module' },
    href: '/imdad/procurement',
    icon: ShoppingCart,
  },
  {
    id: 'wh',
    title: { ar: 'المستودعات', en: 'Warehouse' },
    category: { ar: 'وحدة', en: 'Module' },
    href: '/imdad/warehouse',
    icon: Warehouse,
  },
  {
    id: 'reports',
    title: { ar: 'التقارير', en: 'Reports' },
    category: { ar: 'وحدة', en: 'Module' },
    href: '/imdad/reports',
    icon: FileText,
  },
];

export default function GlobalSearch() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut: Ctrl/Cmd + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredResults = query.trim()
    ? QUICK_LINKS.filter(
        (item) =>
          item.title.en.toLowerCase().includes(query.toLowerCase()) ||
          item.title.ar.includes(query)
      )
    : QUICK_LINKS;

  const handleSelect = (href: string) => {
    setOpen(false);
    setQuery('');
    router.push(href);
  };

  return (
    <div ref={containerRef} className="relative" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Search trigger button */}
      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-2 text-gray-500 dark:text-gray-400"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">{tr('بحث...', 'Search...')}</span>
        <kbd className="pointer-events-none hidden rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-400 sm:inline dark:border-gray-600 dark:bg-gray-800">
          ⌘K
        </kbd>
      </Button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute end-0 top-full z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr('ابحث في المنصة...', 'Search the platform...')}
              className="border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setQuery('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-64 overflow-y-auto p-2">
            {filteredResults.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-gray-400">
                {tr('لا توجد نتائج', 'No results found')}
              </p>
            ) : (
              <>
                <p className="mb-1 px-2 text-xs font-medium text-gray-400 dark:text-gray-500">
                  {query ? tr('النتائج', 'Results') : tr('روابط سريعة', 'Quick Links')}
                </p>
                {filteredResults.map((result) => {
                  const Icon = result.icon;
                  return (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result.href)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-start text-sm transition-colors',
                        'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-gray-400" />
                      <div className="flex-1">
                        <span>{language === 'ar' ? result.title.ar : result.title.en}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">
                        {language === 'ar' ? result.category.ar : result.category.en}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-gray-300 rtl:rotate-180" />
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
