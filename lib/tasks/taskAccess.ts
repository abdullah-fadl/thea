export function roleLower(role: string, user: any) {
  return String(role || user?.role || '').toLowerCase();
}

export function canNurseOrCharge(role: string, user: any, tenantId: string) {
  const r = roleLower(role, user);
  return r.includes('nurse') || r.includes('charge') || r.includes('admin');
}

export function canDoctorOrCharge(role: string, user: any, tenantId: string) {
  const r = roleLower(role, user);
  return r.includes('doctor') || r.includes('physician') || r.includes('charge') || r.includes('admin');
}

export function canClaimTasks(role: string, user: any, tenantId: string) {
  return canNurseOrCharge(role, user, tenantId);
}

export function canCancelTasks(role: string, user: any, tenantId: string) {
  return canDoctorOrCharge(role, user, tenantId);
}

export function canOverrideTaskAssignment(role: string, user: any, tenantId: string) {
  const r = roleLower(role, user);
  return r.includes('charge') || r.includes('admin');
}
