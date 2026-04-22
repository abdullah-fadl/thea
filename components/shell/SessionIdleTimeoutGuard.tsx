'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Props = {
  idleMinutes?: number;
  loginPath?: string;
};

function clampIdleMinutes(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 60;
  return Math.min(Math.max(Math.floor(n), 1), 24 * 60);
}

export function SessionIdleTimeoutGuard({ idleMinutes, loginPath = '/login' }: Props) {
  const pathname = usePathname();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const idleMs = useMemo(() => clampIdleMinutes(idleMinutes) * 60_000, [idleMinutes]);
  const [open, setOpen] = useState(false);
  const redirectTimerRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const title = tr('انتهت الجلسة', 'Session expired');
  const body = tr(
    'انتهت الجلسة بسبب عدم النشاط. سيتم تحويلك لتسجيل الدخول.',
    'Your session expired due to inactivity. You will be redirected to login.',
  );
  const cta = tr('تسجيل الدخول', 'Go to login');

  const clearTimers = () => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    if (redirectTimerRef.current) window.clearTimeout(redirectTimerRef.current);
    idleTimerRef.current = null;
    redirectTimerRef.current = null;
  };

  const doRedirect = () => {
    clearTimers();
    setOpen(false);
    // Use full navigation so redirect works even when router/app is in a bad state (e.g. DB unreachable).
    window.location.href = loginPath;
  };

  const scheduleIdleCheck = () => {
    if (typeof window === 'undefined') return;
    clearTimers();
    const now = Date.now();
    const elapsed = now - lastActivityRef.current;
    const remaining = Math.max(idleMs - elapsed, 0);

    idleTimerRef.current = window.setTimeout(() => {
      setOpen(true);
      // Give user a moment to see the modal; then redirect.
      redirectTimerRef.current = window.setTimeout(doRedirect, 2500);
    }, remaining);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const markActivity = () => {
      lastActivityRef.current = Date.now();
      if (!open) scheduleIdleCheck();
    };

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    for (const ev of events) window.addEventListener(ev, markActivity, { passive: true, capture: true });

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= idleMs) {
          setOpen(true);
          redirectTimerRef.current = window.setTimeout(doRedirect, 2500);
        } else if (!open) {
          scheduleIdleCheck();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Initial schedule
    scheduleIdleCheck();

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      for (const ev of events) window.removeEventListener(ev, markActivity, { capture: true });
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idleMs, open]);

  // Reset timer if route changes (counts as activity).
  useEffect(() => {
    lastActivityRef.current = Date.now();
    if (!open) scheduleIdleCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button asChild className="w-full">
            <a href={loginPath}>{cta}</a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

