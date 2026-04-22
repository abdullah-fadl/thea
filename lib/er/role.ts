export type ErViewRole = 'reception' | 'nursing' | 'doctor' | 'admin';

export function deriveErRole(permissions: string[]): ErViewRole {
  if (permissions.includes('er.staff.assign')) return 'admin';
  if (permissions.includes('er.disposition.update')) return 'doctor';
  if (permissions.includes('er.triage.edit')) return 'nursing';
  if (permissions.includes('er.register.create')) return 'reception';
  return 'reception'; // default to least-privileged role
}
