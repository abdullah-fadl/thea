import type { AreaKey } from '@/lib/access/tenantUser';

export function resolveHomeByAreas(areas: AreaKey[]) {
  const list = areas.map((a) => String(a || '').toUpperCase());
  if (list.includes('ER')) return '/er/board';
  if (list.includes('IPD')) return '/ipd/episodes';
  if (list.includes('OPD')) return '/opd/waiting-list';
  if (list.includes('REGISTRATION')) return '/registration';
  if (list.includes('ORDERS')) return '/orders';
  if (list.includes('BILLING')) return '/billing/statement';
  if (list.includes('MORTUARY')) return '/search';
  return '/welcome';
}
