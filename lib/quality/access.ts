export function canAccessQuality(args: {
  email: string | null | undefined;
  tenantId: string | null | undefined;
  role: string | null | undefined;
}): boolean {
  const role = String(args.role || '').toLowerCase();
  if (role === 'admin') return true;
  if (role.includes('quality')) return true;
  if (role.includes('supervisor')) return true;
  return false;
}
