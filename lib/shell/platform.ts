export type ActivePlatform = 'sam' | 'health' | 'cvision' | 'imdad';

export const ACTIVE_PLATFORM_COOKIE = 'activePlatform' as const;

export function parseActivePlatform(value: string | null | undefined): ActivePlatform | null {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'sam') return 'sam';
  if (v === 'health') return 'health';
  if (v === 'cvision') return 'cvision';
  if (v === 'imdad') return 'imdad';
  return null;
}

export function platformHomePath(platform: ActivePlatform): '/sam' | '/platforms/thea-health' | '/cvision' | '/imdad' {
  if (platform === 'sam') return '/sam';
  if (platform === 'cvision') return '/cvision';
  if (platform === 'imdad') return '/imdad';
  return '/platforms/thea-health';
}

