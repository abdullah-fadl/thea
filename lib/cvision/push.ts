export async function requestPushPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  const perm = await Notification.requestPermission();
  return perm === 'granted';
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
    });
    return sub;
  } catch { return null; }
}

export function showLocalNotification(title: string, body: string, tag?: string) {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '/icons/icon-192.png', tag, badge: '/icons/icon-72.png' });
}
