export type UiPreviewRole =
  | 'ER_NURSE'
  | 'ER_DOCTOR'
  | 'OPD_DOCTOR'
  | 'IPD_NURSE'
  | 'FRONT_DESK'
  | 'FINANCE';

export const UI_PREVIEW_ROLES: UiPreviewRole[] = [
  'ER_NURSE',
  'ER_DOCTOR',
  'OPD_DOCTOR',
  'IPD_NURSE',
  'FRONT_DESK',
  'FINANCE',
];

export function getPreviewRoleLabel(role: UiPreviewRole): string {
  switch (role) {
    case 'ER_NURSE':
      return 'ER Nurse';
    case 'ER_DOCTOR':
      return 'ER Doctor';
    case 'OPD_DOCTOR':
      return 'OPD Doctor';
    case 'IPD_NURSE':
      return 'IPD Nurse';
    case 'FRONT_DESK':
      return 'Front Desk';
    case 'FINANCE':
      return 'Finance';
    default:
      return role;
  }
}

export function getPreviewLanding(role: UiPreviewRole): string {
  switch (role) {
    case 'ER_NURSE':
      return '/er/nursing';
    case 'ER_DOCTOR':
      return '/er/doctor';
    case 'OPD_DOCTOR':
      return '/opd/waiting-list';
    case 'IPD_NURSE':
      return '/ipd/live-beds';
    case 'FRONT_DESK':
      return '/registration';
    case 'FINANCE':
      return '/billing/statement';
    default:
      return '/welcome';
  }
}

export function getPreviewRoleKey(role: UiPreviewRole): string {
  switch (role) {
    case 'ER_NURSE':
      return 'er nurse';
    case 'ER_DOCTOR':
      return 'er doctor';
    case 'OPD_DOCTOR':
      return 'opd doctor';
    case 'IPD_NURSE':
      return 'ipd nurse';
    case 'FRONT_DESK':
      return 'front desk';
    case 'FINANCE':
      return 'finance';
    default:
      return String(role).toLowerCase();
  }
}
