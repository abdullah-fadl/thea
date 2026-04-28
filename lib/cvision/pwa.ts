import { logger } from '@/lib/monitoring/logger';
export function registerSW() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        logger.warn('[PWA] SW registration failed:', err);
      });
    });
  }
}

export function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return Promise.resolve('denied' as NotificationPermission);
  return Notification.requestPermission();
}
