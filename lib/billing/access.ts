import { isChargeOperator } from '@/lib/er/chargeAccess';

/**
 * Check if user can access billing features.
 * Allowed roles: admin, charge operators, finance, reception/front-desk.
 */
export function canAccessBilling(args: {
  email: string | null | undefined;
  tenantId: string | null | undefined;
  role: string | null | undefined;
}): boolean {
  const role = String(args.role || '').toLowerCase();
  if (isChargeOperator(role)) return true;
  const BILLING_ROLES = new Set([
    'admin', 'finance', 'finance_manager', 'billing', 'billing_manager',
    'reception', 'receptionist', 'front_desk',
    'opd-reception', 'opd-admin', 'opd-charge-nurse',
    'reception-staff', 'reception-supervisor', 'reception-admin',
    'staff', 'billing-staff',
  ]);
  if (BILLING_ROLES.has(role)) return true;
  // Also allow any role that has billing.invoice.view permission (checked upstream)
  if (role.includes('reception') || role.includes('billing') || role.includes('finance')) return true;
  return false;
}
