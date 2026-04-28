'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StickyActionBarAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface StickyActionBarProps {
  actions: StickyActionBarAction[];
  className?: string;
}

/**
 * Sticky bottom action bar for mobile pages
 * Use for primary actions like Save/Submit
 */
export function StickyActionBar({ actions, className }: StickyActionBarProps) {
  return (
    <div
      className={cn(
        'sticky bottom-0 left-0 right-0 z-40',
        'bg-card border-t border-border',
        'p-4 gap-2 flex',
        'safe-area-bottom',
        className
      )}
      style={{
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
      }}
    >
      {actions.map((action, index) => (
        <Button
          key={index}
          variant={action.variant || 'default'}
          onClick={action.onClick}
          disabled={action.disabled}
          className="flex-1"
        >
          {action.icon && <span className="mr-2">{action.icon}</span>}
          {action.label}
        </Button>
      ))}
    </div>
  );
}

