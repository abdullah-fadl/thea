'use client';

import { useEffect, useRef } from 'react';

/**
 * Interactive API Documentation page.
 *
 * Renders the OpenAPI spec served at /api/docs using the Scalar
 * API Reference viewer loaded from CDN (no npm dependency).
 */
export default function DocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialised = useRef(false);

  useEffect(() => {
    // Guard against double-init in React strict mode
    if (initialised.current) return;
    initialised.current = true;

    // Inject Scalar CSS
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest/dist/style.min.css';
    document.head.appendChild(style);

    // Inject Scalar JS
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest/dist/browser/standalone.min.js';
    script.async = true;

    script.onload = () => {
      // The Scalar standalone build exposes a global `createScalarReferences` or
      // injects via a web component. We use the <script id="api-reference">
      // data-attribute approach which the standalone bundle picks up automatically.
      // If the global API is available, call it explicitly.
      const win = window as unknown as Record<string, unknown>;
      if (typeof win.Scalar === 'object' && win.Scalar !== null) {
        const scalar = win.Scalar as Record<string, unknown>;
        if (typeof scalar.createApiReference === 'function') {
          scalar.createApiReference('#api-docs', {
            url: '/api/docs',
            theme: 'default',
            hideModels: false,
          });
          return;
        }
      }

      // Fallback: create the web-component style element that Scalar picks up
      if (containerRef.current && !containerRef.current.querySelector('api-reference')) {
        const el = document.createElement('div');
        el.setAttribute('data-url', '/api/docs');
        el.id = 'scalar-api-reference';
        containerRef.current.appendChild(el);

        // Try the web component approach
        const refScript = document.createElement('script');
        refScript.id = 'api-reference';
        refScript.type = 'application/json';
        refScript.textContent = JSON.stringify({
          url: '/api/docs',
          theme: 'default',
        });
        containerRef.current.appendChild(refScript);
      }
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup is intentionally omitted since Scalar injects global state.
      // Re-mounting in dev is handled by the initialised guard.
    };
  }, []);

  return (
    <div className="w-full h-screen overflow-auto bg-white dark:bg-zinc-950">
      <div ref={containerRef} id="api-docs" className="min-h-screen" />
    </div>
  );
}
