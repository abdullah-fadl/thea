import type { AreaKey } from '@/lib/access/tenantUser';

export type UiAccessRequirement =
  | { type: 'public' }
  | { type: 'adminOnly' }
  | { type: 'area'; area: AreaKey; requireRoles?: string[]; allowRoles?: string[] }
  | { type: 'anyArea'; areas: AreaKey[]; allowRoles?: string[] };

const ANY_AREA: AreaKey[] = [
  'ER',
  'OPD',
  'IPD',
  'ORDERS',
  'RESULTS',
  'TASKS',
  'HANDOVER',
  'NOTIFICATIONS',
  'REGISTRATION',
  'BILLING',
  'MORTUARY',
];

export function getUiAccessRequirement(pathname: string): UiAccessRequirement {
  // Always allow these routes (avoid loops)
  if (pathname === '/' || pathname.startsWith('/platforms') || pathname.startsWith('/login') || pathname.startsWith('/owner')) {
    return { type: 'public' };
  }
  if (pathname === '/welcome') return { type: 'public' };

  if (pathname.startsWith('/admin')) return { type: 'adminOnly' };

  if (pathname.startsWith('/billing')) {
    return { type: 'area', area: 'BILLING', requireRoles: ['finance', 'admin', 'charge', 'dev'] };
  }
  if (pathname.startsWith('/mortuary')) {
    return { type: 'area', area: 'MORTUARY', requireRoles: ['charge', 'admin', 'dev'] };
  }

  if (pathname.startsWith('/er/respiratory-screen')) {
    return { type: 'area', area: 'ER', allowRoles: ['reception', 'front_desk', 'security', 'admin', 'dev', 'charge', 'nurse'] };
  }
  if (pathname.startsWith('/er')) return { type: 'area', area: 'ER' };
  if (pathname.startsWith('/opd')) return { type: 'area', area: 'OPD' };
  if (pathname.startsWith('/ipd')) return { type: 'area', area: 'IPD' };

  if (pathname.startsWith('/orders')) return { type: 'area', area: 'ORDERS', allowRoles: ['charge', 'admin', 'dev'] };
  if (pathname.startsWith('/results')) return { type: 'area', area: 'RESULTS', allowRoles: ['charge', 'admin', 'dev'] };
  if (pathname.startsWith('/tasks')) return { type: 'area', area: 'TASKS', allowRoles: ['charge', 'admin', 'dev'] };
  if (pathname.startsWith('/handover')) return { type: 'area', area: 'HANDOVER', allowRoles: ['charge', 'admin', 'dev'] };
  if (pathname.startsWith('/notifications')) return { type: 'area', area: 'NOTIFICATIONS', allowRoles: ['charge', 'admin', 'dev'] };

  // Registration pages require registration access (or admin/dev)
  if (pathname.startsWith('/registration')) return { type: 'area', area: 'REGISTRATION', allowRoles: ['charge', 'admin', 'dev'] };

  // Search / patient profile are hospital-wide read-only; require at least one area
  if (pathname.startsWith('/search')) return { type: 'anyArea', areas: ANY_AREA, allowRoles: ['charge', 'admin', 'dev'] };
  if (pathname.startsWith('/patient')) return { type: 'anyArea', areas: ANY_AREA, allowRoles: ['charge', 'admin', 'dev'] };

  // ── Scheduling ──
  if (pathname.startsWith('/scheduling')) return { type: 'area', area: 'OPD', allowRoles: ['charge', 'admin', 'dev'] };

  // ── Lab, Radiology, Pharmacy (mapped to ORDERS area) ──
  if (pathname.startsWith('/lab')) return { type: 'area', area: 'ORDERS', allowRoles: ['charge', 'admin', 'dev'] };
  if (pathname.startsWith('/radiology')) return { type: 'area', area: 'ORDERS', allowRoles: ['charge', 'admin', 'dev'] };
  if (pathname.startsWith('/pharmacy')) return { type: 'area', area: 'ORDERS', allowRoles: ['charge', 'admin', 'dev'] };

  // ── Dental, OBGYN (mapped to OPD area) ──
  if (pathname.startsWith('/dental')) return { type: 'area', area: 'OPD', allowRoles: ['charge', 'admin', 'dev'] };
  if (pathname.startsWith('/obgyn')) return { type: 'area', area: 'OPD', allowRoles: ['charge', 'admin', 'dev'] };

  // ── ICU, OR (mapped to IPD area) ──
  if (pathname.startsWith('/icu')) return { type: 'area', area: 'IPD', allowRoles: ['charge', 'admin', 'dev'] };
  if (pathname.startsWith('/or')) return { type: 'area', area: 'IPD', allowRoles: ['charge', 'admin', 'dev'] };

  // ── Quality ──
  if (pathname.startsWith('/quality')) return { type: 'anyArea', areas: ANY_AREA, allowRoles: ['charge', 'admin', 'dev'] };

  // ── Referrals ──
  if (pathname.startsWith('/referrals')) return { type: 'area', area: 'OPD', allowRoles: ['charge', 'admin', 'dev'] };

  // ── Departments, Handoff ──
  if (pathname.startsWith('/departments')) return { type: 'anyArea', areas: ANY_AREA, allowRoles: ['charge', 'admin', 'dev'] };
  if (pathname.startsWith('/handoff')) return { type: 'area', area: 'ER', allowRoles: ['charge', 'admin', 'dev'] };

  // ── Clinical Services (mapped to IPD area — cross-department) ──
  if (pathname.startsWith('/physiotherapy')) return { type: 'area', area: 'IPD', allowRoles: ['charge', 'admin', 'dev'] };
  if (pathname.startsWith('/consults')) return { type: 'area', area: 'IPD', allowRoles: ['charge', 'admin', 'dev'] };
  if (pathname.startsWith('/wound-care')) return { type: 'area', area: 'IPD', allowRoles: ['charge', 'admin', 'dev'] };
  if (pathname.startsWith('/nutrition')) return { type: 'area', area: 'IPD', allowRoles: ['charge', 'admin', 'dev'] };
  if (pathname.startsWith('/social-work')) return { type: 'area', area: 'IPD', allowRoles: ['charge', 'admin', 'dev'] };
  if (pathname.startsWith('/patient-education')) return { type: 'area', area: 'IPD', allowRoles: ['charge', 'admin', 'dev'] };

  // ── Lab & Diagnostics ──
  if (pathname.startsWith('/blood-bank')) return { type: 'area', area: 'ORDERS', allowRoles: ['charge', 'admin', 'dev'] };
  if (pathname.startsWith('/pathology')) return { type: 'area', area: 'ORDERS', allowRoles: ['charge', 'admin', 'dev'] };

  // ── Operations (mapped to IPD area) ──
  if (pathname.startsWith('/cssd')) return { type: 'area', area: 'IPD', allowRoles: ['charge', 'admin', 'dev'] };
  if (pathname.startsWith('/equipment-mgmt')) return { type: 'area', area: 'IPD', allowRoles: ['charge', 'admin', 'dev'] };
  if (pathname.startsWith('/infection-control')) return { type: 'area', area: 'IPD', allowRoles: ['charge', 'admin', 'dev'] };

  // ── Specialty Modules (cross-department, require any area) ──
  if (pathname.startsWith('/oncology')) return { type: 'anyArea', areas: ANY_AREA, allowRoles: ['charge', 'admin', 'dev'] };
  if (pathname.startsWith('/psychiatry')) return { type: 'anyArea', areas: ANY_AREA, allowRoles: ['charge', 'admin', 'dev'] };
  if (pathname.startsWith('/transplant')) return { type: 'anyArea', areas: ANY_AREA, allowRoles: ['charge', 'admin', 'dev'] };

  // ── Telemedicine & Analytics (cross-department) ──
  if (pathname.startsWith('/telemedicine')) return { type: 'anyArea', areas: ANY_AREA, allowRoles: ['charge', 'admin', 'dev'] };
  if (pathname.startsWith('/analytics')) return { type: 'anyArea', areas: ANY_AREA, allowRoles: ['charge', 'admin', 'dev'] };

  // ── Settings ──
  if (pathname.startsWith('/settings')) return { type: 'anyArea', areas: ANY_AREA, allowRoles: ['charge', 'admin', 'dev'] };

  // Default: require authentication (fail-closed)
  return { type: 'anyArea', areas: ANY_AREA, allowRoles: ['admin', 'dev'] };
}

export function getTestModeEffective(args: { area: string; position: string }) {
  const area = String(args.area || '').toUpperCase();
  const position = String(args.position || '').toUpperCase();

  const areas: AreaKey[] = (['ER','OPD','IPD','ORDERS','RESULTS','TASKS','HANDOVER','NOTIFICATIONS','REGISTRATION','BILLING','MORTUARY'] as AreaKey[])
    .filter((a) => a === (area as string));

  const roles: string[] = (() => {
    if (position.includes('FINANCE')) return ['finance'];
    if (position.includes('FRONT')) return ['front_desk'];
    if (position.includes('NURSE')) return ['nurse'];
    if (position.includes('DOCTOR')) return ['doctor'];
    if (position.includes('CHARGE')) return ['charge'];
    if (position.includes('ORDERS')) return ['orders'];
    return [];
  })();

  return { areas, roles };
}

