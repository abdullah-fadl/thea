const CHARGE_ROLES = new Set([
  'admin',
  'supervisor',
  'er-admin',
  'charge-nurse',
  'charge_nurse',
  'charge',
  'er-charge',
  'er_supervisor',
  'er-supervisor',
]);

export function isChargeOperator(role: string | null | undefined): boolean {
  const r = String(role || '').trim().toLowerCase();
  return CHARGE_ROLES.has(r);
}

export function canAccessChargeConsole(args: {
  email: string | null | undefined;
  tenantId: string | null | undefined;
  role: string | null | undefined;
}): boolean {
  return isChargeOperator(args.role);
}

