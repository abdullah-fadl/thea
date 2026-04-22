'use client';

import { useEffect, useRef } from 'react';
import { useLang } from '@/hooks/use-lang';

/**
 * Admin > API Documentation
 *
 * Renders the Thea EHR OpenAPI spec using Scalar API Reference viewer.
 * The spec is fetched from /api/docs (served by the docs route).
 */
export default function APIDocsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (scriptLoaded.current) return;
    scriptLoaded.current = true;

    // Load Scalar CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest/dist/style.min.css';
    document.head.appendChild(link);

    // Load Scalar JS
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest/dist/browser/standalone.min.js';
    script.async = true;
    script.onload = () => {
      if (containerRef.current && typeof (window as unknown as Record<string, unknown>).ScalarApiReference === 'function') {
        (window as unknown as Record<string, (...args: unknown[]) => void>).ScalarApiReference(containerRef.current, {
          url: '/api/docs',
          theme: 'default',
          layout: 'modern',
          darkMode: false,
          hideModels: false,
          searchHotKey: 'k',
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup is intentionally skipped — Scalar mounts once and persists
    };
  }, []);

  return (
    <div
      className="flex flex-col h-full w-full"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-card px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {tr('توثيق واجهة برمجة التطبيقات', 'API Documentation')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr(
              'مرجع شامل لجميع نقاط النهاية في نظام ثيا للسجلات الصحية الإلكترونية',
              'Comprehensive reference for all Thea EHR API endpoints'
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/api/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            {tr('عرض JSON الخام', 'View Raw JSON')}
          </a>

          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            OpenAPI 3.1
          </span>
        </div>
      </div>

      {/* Scalar viewer container */}
      <div className="flex-1 overflow-hidden">
        <div
          ref={containerRef}
          id="scalar-api-reference"
          className="h-full w-full"
          data-url="/api/docs"
          data-proxy-url=""
        />
      </div>

      {/* Fallback loading state */}
      <noscript>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">
            {tr(
              'يرجى تفعيل جافاسكريبت لعرض التوثيق',
              'Please enable JavaScript to view the API documentation'
            )}
          </p>
        </div>
      </noscript>
    </div>
  );
}
