'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface TheaViewerSeriesNavProps {
  currentIndex: number;
  totalImages: number;
  onIndexChange: (index: number) => void;
}

/**
 * Horizontal slider indicating position within a series stack.
 * Drag or click to jump to a specific slice.
 */
export function TheaViewerSeriesNav({
  currentIndex,
  totalImages,
  onIndexChange,
}: TheaViewerSeriesNavProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const calculateIndex = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const idx = Math.round(ratio * (totalImages - 1));
      onIndexChange(idx);
    },
    [totalImages, onIndexChange],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setDragging(true);
      calculateIndex(e.clientX);
    },
    [calculateIndex],
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => calculateIndex(e.clientX);
    const handleUp = () => setDragging(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, calculateIndex]);

  if (totalImages <= 1) return null;

  const percent = totalImages > 1 ? (currentIndex / (totalImages - 1)) * 100 : 0;

  return (
    <div className="px-3 py-2 bg-gray-900 border-t border-gray-700 flex items-center gap-3">
      <span className="text-xs text-muted-foreground font-mono min-w-[60px]">
        {currentIndex + 1} / {totalImages}
      </span>
      <div
        ref={trackRef}
        className="flex-1 h-2 bg-gray-700 rounded-full cursor-pointer relative"
        onMouseDown={handleMouseDown}
      >
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 bg-blue-600 rounded-full"
          style={{ width: `${percent}%` }}
        />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-card rounded-full shadow-md border border-blue-500"
          style={{ left: `calc(${percent}% - 6px)` }}
        />
      </div>
    </div>
  );
}
