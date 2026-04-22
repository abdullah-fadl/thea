'use client';
import { useState, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

interface PullToRefreshProps { onRefresh: () => Promise<void>; children: React.ReactNode; }

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const threshold = 80;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) startY.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === 0 || refreshing) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0 && window.scrollY === 0) {
      setPulling(true);
      setPullDistance(Math.min(diff * 0.4, 120));
    }
  }, [refreshing]);

  const onTouchEnd = useCallback(async () => {
    if (!pulling) return;
    if (pullDistance >= threshold) {
      setRefreshing(true);
      try { await onRefresh(); } catch {}
      setRefreshing(false);
    }
    setPulling(false);
    setPullDistance(0);
    startY.current = 0;
  }, [pulling, pullDistance, onRefresh]);

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {(pulling || refreshing) && (
        <div className="flex justify-center py-2 transition-all" style={{ height: pulling ? pullDistance : refreshing ? 40 : 0, overflow: 'hidden' }}>
          <Loader2 className={`h-5 w-5 text-primary ${refreshing ? 'animate-spin' : ''}`} style={{ opacity: Math.min(pullDistance / threshold, 1) }} />
        </div>
      )}
      {children}
    </div>
  );
}
