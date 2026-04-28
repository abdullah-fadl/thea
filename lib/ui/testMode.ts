export type TestModeArea = 'ER' | 'OPD' | 'IPD' | 'REGISTRATION' | 'ORDERS' | 'BILLING';
export type TestModePosition =
  | 'ER_NURSE'
  | 'ER_DOCTOR'
  | 'ER_COMMAND'
  | 'OPD_DOCTOR'
  | 'OPD_NURSE'
  | 'IPD_NURSE'
  | 'IPD_ADMIN'
  | 'FRONT_DESK'
  | 'ORDERS_STAFF'
  | 'FINANCE';

export const TEST_MODE_AREAS: TestModeArea[] = [
  'ER',
  'OPD',
  'IPD',
  'REGISTRATION',
  'ORDERS',
  'BILLING',
];

export const TEST_MODE_POSITIONS: Record<TestModeArea, TestModePosition[]> = {
  ER: ['ER_NURSE', 'ER_DOCTOR', 'ER_COMMAND'],
  OPD: ['OPD_DOCTOR', 'OPD_NURSE'],
  IPD: ['IPD_NURSE', 'IPD_ADMIN'],
  REGISTRATION: ['FRONT_DESK'],
  ORDERS: ['ORDERS_STAFF'],
  BILLING: ['FINANCE'],
};

export function getTestAreaLabel(area: TestModeArea): string {
  switch (area) {
    case 'ER':
      return 'ER';
    case 'OPD':
      return 'OPD';
    case 'IPD':
      return 'IPD';
    case 'REGISTRATION':
      return 'Registration';
    case 'ORDERS':
      return 'Orders';
    case 'BILLING':
      return 'Billing';
    default:
      return area;
  }
}

export function getTestPositionLabel(position: TestModePosition): string {
  switch (position) {
    case 'ER_NURSE':
      return 'Nurse';
    case 'ER_DOCTOR':
      return 'Doctor';
    case 'ER_COMMAND':
      return 'Command';
    case 'OPD_DOCTOR':
      return 'Doctor';
    case 'OPD_NURSE':
      return 'Nurse';
    case 'IPD_NURSE':
      return 'Nurse';
    case 'IPD_ADMIN':
      return 'Admin';
    case 'FRONT_DESK':
      return 'Front Desk';
    case 'ORDERS_STAFF':
      return 'Orders Staff';
    case 'FINANCE':
      return 'Finance';
    default:
      return position;
  }
}

export function getTestRoleKey(position: TestModePosition): string {
  switch (position) {
    case 'ER_NURSE':
      return 'er nurse';
    case 'ER_DOCTOR':
      return 'er doctor';
    case 'ER_COMMAND':
      return 'er command';
    case 'OPD_DOCTOR':
      return 'opd doctor';
    case 'OPD_NURSE':
      return 'opd nurse';
    case 'IPD_NURSE':
      return 'ipd nurse';
    case 'IPD_ADMIN':
      return 'ipd admin';
    case 'FRONT_DESK':
      return 'front desk';
    case 'ORDERS_STAFF':
      return 'orders staff';
    case 'FINANCE':
      return 'finance';
    default:
      return String(position).toLowerCase();
  }
}

export function getTestLanding(position: TestModePosition): string {
  switch (position) {
    case 'ER_NURSE':
      return '/er/nursing';
    case 'ER_DOCTOR':
      return '/er/doctor';
    case 'ER_COMMAND':
      return '/er/command';
    case 'OPD_DOCTOR':
      return '/opd/waiting-list';
    case 'OPD_NURSE':
      return '/opd/nurse-station';
    case 'IPD_NURSE':
      return '/ipd/live-beds';
    case 'IPD_ADMIN':
      return '/ipd/live-beds';
    case 'FRONT_DESK':
      return '/registration';
    case 'ORDERS_STAFF':
      return '/orders';
    case 'FINANCE':
      return '/billing/statement';
    default:
      return '/welcome';
  }
}
