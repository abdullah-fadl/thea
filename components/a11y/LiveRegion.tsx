'use client';

import { useState, useCallback, useId } from 'react';

interface LiveRegionProps {
  message: string;
  politeness?: 'polite' | 'assertive';
}

/**
 * ARIA live region component for dynamic screen reader announcements.
 */
export function LiveRegion({ message, politeness = 'polite' }: LiveRegionProps) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}

/**
 * Hook that returns an `announce` function and a `LiveRegionComponent`
 * to render in your tree. Calling `announce(msg)` updates the live
 * region so screen readers read it aloud.
 */
export function useLiveAnnounce(politeness: 'polite' | 'assertive' = 'polite') {
  const [message, setMessage] = useState('');
  const id = useId();

  const announce = useCallback((msg: string) => {
    // Clear first so the same message can be re-announced
    setMessage('');
    requestAnimationFrame(() => setMessage(msg));
  }, []);

  function LiveRegionComponent() {
    return (
      <div
        id={`live-region-${id}`}
        role="status"
        aria-live={politeness}
        aria-atomic="true"
        className="sr-only"
      >
        {message}
      </div>
    );
  }

  return { announce, LiveRegion: LiveRegionComponent } as const;
}
