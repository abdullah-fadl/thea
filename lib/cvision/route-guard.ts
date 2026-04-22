/**
 * CVision Route → Permission mapping.
 * Used by PermissionGate and middleware to check access.
 */

export const ROUTE_PERMISSIONS: Record<string, string> = {
  // Admin
  '/cvision/admin/settings': 'cvision.config.write',
  '/cvision/admin/workflows': 'cvision.workflows.write',
  '/cvision/admin/import': 'cvision.import.execute',
  '/cvision/admin/bulk': 'cvision.bulk_operations',
  '/cvision/admin/webhooks': 'cvision.config.write',
  '/cvision/admin/cron': 'cvision.config.write',
  '/cvision/admin/api-docs': 'cvision.config.write',
  '/cvision/admin/data-warehouse': 'cvision.config.write',

  // Access Control
  '/cvision/access-control': 'cvision.audit.read',

  // OD
  '/cvision/od/health': 'cvision.org.read',
  '/cvision/od/change': 'cvision.org.read',
  '/cvision/od/design': 'cvision.org.write',
  '/cvision/od/culture': 'cvision.org.read',
  '/cvision/od/processes': 'cvision.org.read',
  '/cvision/od/alignment': 'cvision.org.read',

  // Modules
  '/cvision/employees': 'cvision.employees.read',
  '/cvision/attendance': 'cvision.attendance.read',
  '/cvision/leaves': 'cvision.leaves.read',
  '/cvision/payroll/loans': 'cvision.loans.read',
  '/cvision/contracts': 'cvision.contracts.read',
  '/cvision/scheduling': 'cvision.scheduling.read',
  '/cvision/training': 'cvision.training.read',
  '/cvision/performance': 'cvision.performance.read',
  '/cvision/compensation': 'cvision.compensation.read',
  '/cvision/rewards': 'cvision.rewards.read',
  '/cvision/succession': 'cvision.succession.read',
  '/cvision/surveys': 'cvision.surveys.read',
  '/cvision/travel': 'cvision.travel.read',
  '/cvision/grievances': 'cvision.grievances.read',
  '/cvision/assets': 'cvision.assets.read',
  '/cvision/compliance': 'cvision.compliance.read',
  '/cvision/reports': 'cvision.reports.read',
  '/cvision/dashboards': 'cvision.reports.read',
  '/cvision/letters': 'cvision.letters.read',
  '/cvision/onboarding': 'cvision.onboarding.read',
  '/cvision/policies': 'cvision.policies.read',
  '/cvision/branches': 'cvision.org.read',
  '/cvision/headcount': 'cvision.payroll.read',
  '/cvision/announcements': 'cvision.notifications.read',
  '/cvision/teams': 'cvision.employees.read',
  '/cvision/insurance': 'cvision.insurance.read',
  '/cvision/payroll': 'cvision.payroll.read',
  '/cvision/recruitment': 'cvision.recruitment.read',
  '/cvision/promotions': 'cvision.employees.write',
  '/cvision/organization': 'cvision.org.read',

  // Self-service — open to all authenticated
  '/cvision/self-service': 'cvision.self_service',
  '/cvision/chat': 'cvision.self_service',
  '/cvision/calendar': 'cvision.view',
  '/cvision/notifications': 'cvision.notifications.read',
  '/cvision/directory': 'cvision.view',
};

export function getRequiredPermission(pathname: string): string | null {
  if (ROUTE_PERMISSIONS[pathname]) return ROUTE_PERMISSIONS[pathname];
  const segments = pathname.split('/');
  while (segments.length > 2) {
    segments.pop();
    const parent = segments.join('/');
    if (ROUTE_PERMISSIONS[parent]) return ROUTE_PERMISSIONS[parent];
  }
  return null;
}
