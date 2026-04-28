'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useLang } from '@/hooks/use-lang';

interface MobileSearchBarProps {
  placeholder?: string;
  placeholderKey?: string; // Translation key for placeholder (e.g., 'common.search')
  onSearch?: (query: string) => void;
  defaultValue?: string;
  className?: string;
  debounceMs?: number;
  queryParam?: string; // URL query param name (e.g., 'q', 'search')
}

/**
 * Mobile-optimized search bar with URL query param sync
 * - Debounced search
 * - URL query param persistence
 * - Clear button
 * - Full width on mobile
 */
export function MobileSearchBar({
  placeholder,
  placeholderKey = 'common.search',
  onSearch,
  defaultValue = '',
  className,
  debounceMs = 300,
  queryParam = 'q',
}: MobileSearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [query, setQuery] = useState(defaultValue || searchParams.get(queryParam) || '');

  // Get translated placeholder
  const translatedPlaceholder = placeholder || tr('بحث...', 'Search...');

  // Sync with URL query param
  useEffect(() => {
    const urlQuery = searchParams.get(queryParam) || '';
    if (urlQuery !== query) {
      setQuery(urlQuery);
    }
  }, [searchParams, queryParam]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onSearch) {
        onSearch(query);
      }

      // Update URL query param
      const params = new URLSearchParams(searchParams.toString());
      if (query.trim()) {
        params.set(queryParam, query.trim());
      } else {
        params.delete(queryParam);
      }
      const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      router.replace(newUrl, { scroll: false });
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs, onSearch, pathname, router, searchParams, queryParam]);

  const handleClear = () => {
    setQuery('');
    const params = new URLSearchParams(searchParams.toString());
    params.delete(queryParam);
    const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    router.replace(newUrl, { scroll: false });
  };

  return (
    <div className={cn('relative w-full', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder={translatedPlaceholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="pl-9 pr-9 h-11 text-base" // Larger touch target
      />
      {query && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClear}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

