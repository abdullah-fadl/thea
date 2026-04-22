'use client';

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface TheaViewerViewportProps {
  viewportIndex: number;
  isActive: boolean;
  loading: boolean;
  onMount: (element: HTMLDivElement, index: number) => void;
  onClick: (index: number) => void;
  children?: React.ReactNode;
}

export function TheaViewerViewport({
  viewportIndex,
  isActive,
  loading,
  onMount,
  onClick,
  children,
}: TheaViewerViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (containerRef.current && !mountedRef.current) {
      mountedRef.current = true;
      onMount(containerRef.current, viewportIndex);
    }
  }, [onMount, viewportIndex]);

  return (
    <div
      className={`relative w-full h-full bg-black overflow-hidden ${
        isActive ? 'ring-2 ring-blue-500' : 'ring-1 ring-gray-700'
      }`}
      onClick={() => onClick(viewportIndex)}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: '200px' }}
        data-viewport-index={viewportIndex}
      />
      {/* Overlays rendered as children */}
      {children}
    </div>
  );
}
