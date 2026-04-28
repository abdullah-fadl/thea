'use client';

import { useState } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ChevronRight } from 'lucide-react';

interface MobileCardListItem {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  badges?: Array<{ label: string; variant?: 'default' | 'secondary' | 'destructive' | 'outline' }>;
  metadata?: Array<{ label: string; value: string }>;
  actions?: Array<{
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  }>;
  onCardClick?: () => void;
}

interface MobileCardListProps {
  items: MobileCardListItem[];
  isLoading?: boolean;
  emptyMessage?: string;
  detailsSheet?: {
    title: string;
    content: (item: MobileCardListItem) => React.ReactNode;
  };
  className?: string;
}

/**
 * Mobile-optimized card list component
 * Shows cards on mobile, can be used with tables on desktop
 */
export function MobileCardList({
  items,
  isLoading = false,
  emptyMessage,
  detailsSheet,
  className,
}: MobileCardListProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [selectedItem, setSelectedItem] = useState<MobileCardListItem | null>(null);
  const resolvedEmptyMessage = emptyMessage || tr('لا توجد عناصر', 'No items found');

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground text-center">{resolvedEmptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className={`space-y-3 ${className || ''}`}>
        {items.map((item) => (
          <Card
            key={item.id}
            className={item.onCardClick || detailsSheet ? 'cursor-pointer hover:bg-accent transition-colors' : ''}
            onClick={() => {
              if (detailsSheet) {
                setSelectedItem(item);
              } else if (item.onCardClick) {
                item.onCardClick();
              }
            }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base leading-tight">{item.title}</CardTitle>
                  {item.subtitle && (
                    <CardDescription className="mt-1">{item.subtitle}</CardDescription>
                  )}
                </div>
                {(item.onCardClick || detailsSheet) && (
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {item.description && (
                <p className="text-sm text-muted-foreground">{item.description}</p>
              )}
              
              {item.badges && item.badges.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {item.badges.map((badge, index) => (
                    <Badge key={index} variant={badge.variant || 'default'}>
                      {badge.label}
                    </Badge>
                  ))}
                </div>
              )}

              {item.metadata && item.metadata.length > 0 && (
                <div className="space-y-1.5">
                  {item.metadata.map((meta, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{meta.label}:</span>
                      <span className="font-medium">{meta.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {item.actions && item.actions.length > 0 && (
                <div className="flex gap-2 pt-2 border-t">
                  {item.actions.map((action, index) => (
                    <Button
                      key={index}
                      variant={action.variant || 'outline'}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        action.onClick();
                      }}
                      className="flex-1"
                    >
                      {action.icon && <span className="mr-2">{action.icon}</span>}
                      {action.label}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Details Sheet */}
      {detailsSheet && selectedItem && (
        <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{detailsSheet.title}</SheetTitle>
              <SheetDescription>{tr('عرض التفاصيل واتخاذ الإجراءات', 'View details and take actions')}</SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              {detailsSheet.content(selectedItem)}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

