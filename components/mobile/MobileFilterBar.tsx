'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Filter, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useLang } from '@/hooks/use-lang';

interface FilterOption {
  id: string;
  label: string;
  value: string;
}

export interface FilterGroup {
  id: string;
  label: string;
  options: FilterOption[];
  type?: 'single' | 'multiple';
}

interface MobileFilterBarProps {
  filters: FilterGroup[];
  activeFilters: Record<string, string | string[]>;
  onFilterChange: (filterId: string, value: string | string[]) => void;
  onClearAll?: () => void;
  className?: string;
}

/**
 * Mobile-optimized filter bar
 * - Sticky filter button with active count badge
 * - Sheet/drawer for filter options
 * - Shows active filter chips
 */
export function MobileFilterBar({
  filters,
  activeFilters,
  onFilterChange,
  onClearAll,
  className,
}: MobileFilterBarProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [open, setOpen] = useState(false);

  // Count active filters
  const activeCount = Object.values(activeFilters).reduce((count, value) => {
    if (Array.isArray(value)) {
      return count + value.length;
    }
    return count + (value ? 1 : 0);
  }, 0);

  const handleFilterChange = (filterId: string, value: string | string[]) => {
    onFilterChange(filterId, value);
  };

  const handleClearFilter = (filterId: string) => {
    onFilterChange(filterId, '');
  };

  return (
    <div className={cn('sticky top-14 z-40 bg-background border-b pb-2', className)}>
      <div className="flex items-center gap-2 px-4 py-2">
        {/* Filter Button */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              <span>{tr('تصفية', 'Filter')}</span>
              {activeCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5">
                  {activeCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh]">
            <SheetHeader>
              <SheetTitle>{tr('تصفية', 'Filters')}</SheetTitle>
              <SheetDescription>{tr('اختر فلاتر لتنقيح النتائج', 'Select filters to refine your results')}</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-6 overflow-y-auto">
              {filters.map((group) => (
                <div key={group.id}>
                  <h3 className="text-sm font-semibold mb-3">{group.label}</h3>
                  <div className="space-y-2">
                    {group.options.map((option) => {
                      const isSelected = group.type === 'multiple'
                        ? Array.isArray(activeFilters[group.id]) && activeFilters[group.id].includes(option.value)
                        : activeFilters[group.id] === option.value;

                      return (
                        <Button
                          key={option.id}
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => {
                            if (group.type === 'multiple') {
                              const filterValue = activeFilters[group.id];
                              const current: string[] = Array.isArray(filterValue)
                                ? filterValue
                                : (filterValue ? [filterValue] : []);
                              const newValue = isSelected
                                ? current.filter((v) => v !== option.value)
                                : [...current, option.value];
                              handleFilterChange(group.id, newValue);
                            } else {
                              handleFilterChange(group.id, isSelected ? '' : option.value);
                            }
                          }}
                        >
                          {option.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {onClearAll && activeCount > 0 && (
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => {
                    onClearAll();
                    setOpen(false);
                  }}
                >
                  {tr('مسح الكل', 'Clear All Filters')}
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Active Filter Chips */}
        <div className="flex-1 flex gap-2 overflow-x-auto scrollbar-hide">
          {filters.map((group) => {
            const value = activeFilters[group.id];
            if (!value || (Array.isArray(value) && value.length === 0)) return null;

            if (Array.isArray(value)) {
              return value.map((v) => {
                const option = group.options.find((opt) => opt.value === v);
                if (!option) return null;
                return (
                  <Badge
                    key={`${group.id}-${v}`}
                    variant="secondary"
                    className="gap-1 flex-shrink-0"
                  >
                    {option.label}
                    <button
                      onClick={() => handleClearFilter(group.id)}
                      className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                      aria-label={`Remove ${option.label} filter`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              });
            }

            const option = group.options.find((opt) => opt.value === value);
            if (!option) return null;

            return (
              <Badge
                key={group.id}
                variant="secondary"
                className="gap-1 flex-shrink-0"
              >
                {option.label}
                <button
                  onClick={() => handleClearFilter(group.id)}
                  className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                  aria-label={`Remove ${option.label} filter`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      </div>
    </div>
  );
}

