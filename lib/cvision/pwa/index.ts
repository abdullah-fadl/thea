import { logger } from '@/lib/monitoring/logger';
export function registerSW() {
  if (typeof window === 'undefined') return;
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        logger.warn('[PWA] SW registration failed:', err);
      });
    });
  }
}

export function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return Promise.resolve('denied' as NotificationPermission);
  return Notification.requestPermission();
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });
    return sub;
  } catch { return null; }
}
