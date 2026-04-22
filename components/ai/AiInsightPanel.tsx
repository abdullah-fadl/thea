'use client';

import { useState } from 'react';
import { Sparkles, X, Minimize2, Maximize2 } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

interface AiInsightPanelProps {
  title?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  position?: 'right' | 'bottom';
  className?: string;
}

/**
 * Floating panel container for AI suggestions.
 * Wraps any AI component in a collapsible, dismissible panel.
 */
export default function AiInsightPanel({
  title,
  children,
  defaultOpen = false,
  position = 'right',
  className = '',
}: AiInsightPanelProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [open, setOpen] = useState(defaultOpen);
  const [minimized, setMinimized] = useState(false);

  const defaultTitle = tr('رؤى الذكاء الاصطناعي', 'AI Insights');

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`fixed ${
          position === 'right' ? 'right-4 top-1/2 -translate-y-1/2' : 'bottom-4 right-4'
        } z-40 flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 ${className}`}
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium">{title || defaultTitle}</span>
      </button>
    );
  }

  const panelClasses = position === 'right'
    ? 'fixed right-4 top-20 bottom-20 w-96 z-40'
    : 'fixed bottom-4 left-4 right-4 max-h-[50vh] z-40';

  return (
    <div className={`${panelClasses} ${className}`}>
      <div className="h-full bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <h3 className="text-sm font-bold">{title || defaultTitle}</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMinimized(!minimized)}
              className="p-1 hover:bg-white/20 rounded"
            >
              {minimized ? (
                <Maximize2 className="w-3.5 h-3.5" />
              ) : (
                <Minimize2 className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1 hover:bg-white/20 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {!minimized && (
          <div className="flex-1 overflow-y-auto p-4">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
