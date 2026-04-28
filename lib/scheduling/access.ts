const SCHEDULING_PERMISSIONS = ['admin.scheduling.view', 'scheduling.view', 'scheduling.availability.view'];

export function canManageScheduling(args: { user: any; tenantId: string; role?: string; permissions?: string[] }) {
  const { user, role, permissions = [] } = args;
  const perms = permissions.length ? permissions : (args.user?.permissions ?? []);
  if (perms.some((p: string) => SCHEDULING_PERMISSIONS.includes(p))) return true;
  const roleLower = String(role || user?.role || '').toLowerCase();
  if (roleLower === 'thea-owner') return true;
  return roleLower.includes('admin') || roleLower.includes('charge') || roleLower.includes('ops') || roleLower.includes('operations') || roleLower.includes('staff');
}
