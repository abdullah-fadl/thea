/**
 * Default permissions for each role and group expansion logic
 */

import { PERMISSIONS } from './definitions';

/**
 * Expand grouped permissions — when a "lead" permission is granted,
 * all hidden permissions in the same group are automatically included.
 */
export function expandGroupedPermissions(input: string[]): string[] {
  const set = new Set(input);

  // OPD Nurse Station group
  if (set.has('opd.nursing.view')) {
    set.add('opd.nursing.edit');
    set.add('opd.nursing.flow');
  }
  // OPD Doctor Station group
  if (set.has('opd.doctor.encounter.view')) {
    set.add('opd.visit.view');
    // opd.visit.create removed — Visit Registration is a separate permission
    set.add('opd.visit.edit');
    set.add('opd.doctor.visit.view');
    set.add('opd.doctor.orders.create');
    set.add('opd.doctor.schedule.view');
    set.add('referral.create');
    set.add('referral.view');
    set.add('referral.edit');
    set.add('scheduling.edit'); // needed to update booking status (complete/no-show)
  }
  // Appointments View → also grants availability view
  if (set.has('scheduling.view')) {
    set.add('scheduling.availability.view');
  }
  // Appointments Manage → grants create/edit/delete for both scheduling and availability + booking
  if (set.has('scheduling.create')) {
    set.add('scheduling.edit');
    set.add('scheduling.delete');
    set.add('scheduling.availability.create');
    set.add('scheduling.availability.edit');
    set.add('scheduling.availability.delete');
    set.add('opd.booking.create');
    set.add('opd.booking.cancel');
  }
  // Hospital Core — Registration → Encounters
  if (set.has('registration.view') || set.has('registration.create')) {
    set.add('encounters.core.view');
    set.add('encounters.core.create');
    set.add('encounters.core.close');
  }
  // Hospital Core — Patient Master → Clinical Data
  if (set.has('patients.master.view')) {
    set.add('clinical.view');
  }
  if (set.has('patients.master.edit')) {
    set.add('clinical.edit');
  }
  // Nurse Station → clinical.view
  if (set.has('opd.nursing.view')) {
    set.add('clinical.view');
  }
  // Doctor Station → clinical.view + clinical.edit
  if (set.has('opd.doctor.encounter.view')) {
    set.add('clinical.view');
    set.add('clinical.edit');
  }
  // ER Registration group
  if (set.has('er.register.view')) {
    set.add('er.register.create');
  }
  // ER Nurse Station group
  if (set.has('er.nursing.view')) {
    set.add('er.nursing.edit');
  }
  // ER Doctor Station group
  if (set.has('er.doctor.view')) {
    set.add('er.encounter.view');
    set.add('er.encounter.edit');
    set.add('er.disposition.update');
  }
  // ER Beds group
  if (set.has('er.beds.view')) {
    set.add('er.beds.assign');
    set.add('er.staff.assign');
  }
  // ER Triage group
  if (set.has('er.triage.view')) {
    set.add('er.triage.edit');
  }
  // OR group — or.view is the master toggle
  if (set.has('or.view')) {
    set.add('or.schedule.view');
    set.add('or.preop.view');
    set.add('or.surgeon-station.view');
    set.add('or.operative-notes.view');
    set.add('or.post-op-orders.view');
    set.add('or.manage');
  }
  // OR Nurse Station — or.nursing.view grants manage + surgical counts
  if (set.has('or.nursing.view')) {
    set.add('or.manage');
  }
  // Billing Invoices group
  if (set.has('billing.invoice.view')) {
    set.add('billing.invoice.create');
    set.add('billing.payment.view');
    set.add('billing.payment.create');
  }
  // Admin Users group
  if (set.has('admin.users.view')) {
    set.add('admin.users.create');
    set.add('admin.users.edit');
    set.add('admin.users.changePassword');
    set.add('admin.users.delete');
    set.add('admin.admin.view');
    set.add('admin.admin.create');
    set.add('admin.admin.edit');
    set.add('admin.admin.delete');
  }
  // Admin System group
  if (set.has('admin.data-admin.view')) {
    set.add('admin.clinical-infra.view');
    set.add('admin.scheduling.view');
    set.add('admin.data-admin.create');
    set.add('admin.data-admin.edit');
    set.add('admin.data-admin.delete');
    set.add('admin.quotas.view');
    set.add('admin.quotas.create');
    set.add('admin.quotas.edit');
    set.add('admin.quotas.delete');
    set.add('admin.structure-management.view');
    set.add('admin.structure-management.create');
    set.add('admin.structure-management.edit');
    set.add('admin.structure-management.delete');
    set.add('admin.delete-sample-data.view');
    set.add('admin.delete-sample-data.create');
    set.add('admin.delete-sample-data.edit');
    set.add('admin.delete-sample-data.delete');
    set.add('admin.groups-hospitals.view');
    set.add('admin.groups-hospitals.create');
    set.add('admin.groups-hospitals.edit');
    set.add('admin.groups-hospitals.delete');
  }
  // IPD group
  if (set.has('ipd.live-beds.view')) {
    set.add('ipd.live-beds.create');
    set.add('ipd.live-beds.edit');
    set.add('ipd.live-beds.delete');
    set.add('ipd.bed-setup');
    set.add('ipd.dept-input');
    set.add('ipd.live-beds');
    set.add('ipd.bed-setup.view');
    set.add('ipd.bed-setup.create');
    set.add('ipd.bed-setup.edit');
    set.add('ipd.bed-setup.delete');
    set.add('ipd.dept-input.view');
    set.add('ipd.dept-input.create');
    set.add('ipd.dept-input.edit');
    set.add('ipd.dept-input.delete');
  }
  // Orders — "orders.view" is the master toggle that grants all order sub-permissions
  if (set.has('orders.view')) {
    set.add('orders.hub.view');
    set.add('order.sets.view');
    set.add('results.inbox.view');
    set.add('tasks.queue.view');
    set.add('handover.view');
    set.add('orders.sets.view');
    set.add('orders.results.view');
    set.add('orders.tasks.view');
    set.add('orders.handover.view');
    set.add('lab.view');
    set.add('radiology.view');
    set.add('pharmacy.view');
  }
  // Lab → also gets orders hub (to see incoming lab orders)
  if (set.has('lab.view')) {
    set.add('orders.hub.view');
  }
  // Radiology → also gets orders hub (to see incoming radiology orders)
  if (set.has('radiology.view')) {
    set.add('orders.hub.view');
  }
  // Pharmacy → also gets orders hub
  if (set.has('pharmacy.view')) {
    set.add('orders.hub.view');
  }
  // Notifications — anyone with any clinical permission gets notifications
  if (set.has('er.board.view') || set.has('opd.dashboard.view') ||
      set.has('opd.nursing.view') || set.has('opd.doctor.encounter.view') ||
      set.has('er.nursing.view') || set.has('er.doctor.view') ||
      set.has('registration.view') || set.has('ipd.live-beds.view')) {
    set.add('notifications.view');
  }

  // ── CVision group expansion ──
  // CVision Employees group
  if (set.has('cvision.employees.view')) {
    set.add('cvision.employees.create');
    set.add('cvision.employees.edit');
    set.add('cvision.employees.status');
    set.add('cvision.employees.read');
    set.add('cvision.employees.write');
  }
  // CVision Org group
  if (set.has('cvision.org.view')) {
    set.add('cvision.org.edit');
    set.add('cvision.org.read');
    set.add('cvision.org.write');
  }
  // CVision Attendance group
  if (set.has('cvision.attendance.view')) {
    set.add('cvision.attendance.edit');
    set.add('cvision.attendance.approve');
    set.add('cvision.attendance.read');
    set.add('cvision.attendance.write');
  }
  // CVision Leaves group
  if (set.has('cvision.leaves.view')) {
    set.add('cvision.leaves.create');
    set.add('cvision.leaves.approve');
    set.add('cvision.leaves.read');
    set.add('cvision.leaves.write');
  }
  // CVision Payroll group
  if (set.has('cvision.payroll.view')) {
    set.add('cvision.payroll.edit');
    set.add('cvision.payroll.approve');
    set.add('cvision.payroll.read');
    set.add('cvision.payroll.write');
  }
  // CVision Recruitment group
  if (set.has('cvision.recruitment.view')) {
    set.add('cvision.recruitment.edit');
    set.add('cvision.recruitment.approve');
    set.add('cvision.recruitment.read');
    set.add('cvision.recruitment.write');
  }
  // CVision Performance group
  if (set.has('cvision.performance.view')) {
    set.add('cvision.performance.edit');
    set.add('cvision.performance.read');
    set.add('cvision.performance.write');
  }
  // CVision Training group
  if (set.has('cvision.training.view')) {
    set.add('cvision.training.edit');
    set.add('cvision.training.read');
    set.add('cvision.training.write');
  }
  // CVision Requests group
  if (set.has('cvision.requests.view')) {
    set.add('cvision.requests.create');
    set.add('cvision.requests.approve');
    set.add('cvision.requests.read');
    set.add('cvision.requests.write');
  }
  // CVision Admin group
  if (set.has('cvision.admin.view')) {
    set.add('cvision.admin.edit');
    set.add('cvision.admin.read');
    set.add('cvision.admin.write');
  }
  // CVision dashboard → notifications
  if (set.has('cvision.dashboard.view')) {
    set.add('notifications.view');
  }

  // Remove deprecated permission
  set.delete('departments.shell.view');

  return Array.from(set);
}

/**
 * Get default permissions for a role
 */
export function getDefaultPermissionsForRole(role: string): string[] {
  const defaults: Record<string, string[]> = {
    'thea-owner': PERMISSIONS.map(p => p.key), // Owner gets all permissions (super-admin)
    admin: PERMISSIONS.map(p => p.key), // Admin gets all permissions
    'tenant-admin': PERMISSIONS.map(p => p.key), // Tenant admin gets all permissions
    supervisor: [
      'dashboard.view',
      'notifications.view',
      'er.board.view',
      'er.encounter.view',
      'er.nursing.view',
      'er.doctor.view',
      'scheduling.view',
      'orders.view',
      'quality.view',
      'ipd.live-beds.view',
      'icu.view',
      'or.view',
      'policies.view',
      'policies.upload.create',
      'policies.delete',
      'policies.conflicts.view',
      'policies.conflicts.analyze',
      'policies.conflicts.resolve',
      'sam.thea-engine.conflicts',
      'sam.thea-engine.conflicts.resolve',
      'policies.builder.view',
      'account.view',
      'account.edit',
    ],
    staff: [
      'dashboard.view',
      'account.view',
      'lab.view',
      'lab.specimens.view',
      'lab.specimens.create',
      'lab.results.view',
      'lab.results.create',
      'lab.orders.view',
      'lab.orders.create',
      'lab.alerts.view',
      'lab.alerts.acknowledge',
      'radiology.view',
      'radiology.reports.view',
      'radiology.reports.create',
      'pharmacy.view',
      'pharmacy.dispense.view',
      'pharmacy.dispense.create',
      'pharmacy.inventory.view',
      'orders.hub.view',
      'results.inbox.view',
      'patients.master.view',
      'patients.search.view',
      'scheduling.view',
      'scheduling.create',
      'or.view',
      'billing.view',
      'billing.manage',
      'billing.invoice.view',
      'billing.payment.view',
    ],
    'er-reception': [
      'er.register.view',
      'er.register.create',
      'er.board.view',
      'er.encounter.view',
      'registration.view',
      'registration.create',
      'patients.master.view',
      'patients.master.create',
      'patients.master.edit',
      'encounters.core.view',
      'encounters.core.create',
    ],
    'er-nurse': [
      'er.board.view',
      'er.nursing.view',
      'er.nursing.edit',
      'er.triage.view',
      'er.triage.edit',
      'er.beds.view',
      'er.beds.assign',
      'er.encounter.view',
      'er.encounter.edit',
      // ER Nurse: Tasks Queue + Handover
      'tasks.queue.view',
      'handover.view',
    ],
    'er-doctor': [
      'er.board.view',
      'er.doctor.view',
      'er.encounter.view',
      'er.encounter.edit',
      'er.disposition.update',
      // ER Doctor sees: Results Inbox + Order Sets
      'results.inbox.view',
      'order.sets.view',
    ],
    'er-admin': [
      'er.register.view',
      'er.register.create',
      'er.board.view',
      'er.nursing.view',
      'er.nursing.edit',
      'er.doctor.view',
      'er.triage.view',
      'er.triage.edit',
      'er.encounter.view',
      'er.encounter.edit',
      'er.beds.view',
      'er.beds.assign',
      'er.staff.assign',
      'er.disposition.update',
      'registration.view',
      'registration.create',
      'patients.master.view',
      'patients.master.create',
      'patients.master.edit',
      'patients.master.merge',
      'encounters.core.view',
      'encounters.core.create',
      'encounters.core.close',
    ],
    'opd-reception': [
      'opd.dashboard.view',
      'opd.visit.view',
      'opd.visit.create',
      'opd.queue.view',
      'opd.booking.create',
      'opd.booking.cancel',
      'registration.view',
      'registration.create',
      'patients.master.view',
      'patients.master.create',
      'patients.master.edit',
      'patients.search.view',
      'patients.growth.view',
      'scheduling.view',
      'scheduling.create',
      'scheduling.edit',
      'billing.invoice.view',
      'billing.invoice.create',
      'billing.payment.view',
      'billing.payment.create',
      'billing.view',
    ],
    'opd-nurse': [
      'opd.dashboard.view',
      'opd.queue.view',
      'opd.visit.view',
      'opd.nursing.view',
      'opd.nursing.edit',
      'opd.nursing.flow',
      'patients.master.view',
      // OPD Nurse: Tasks Queue + Handover
      'tasks.queue.view',
      'handover.view',
    ],
    'opd-doctor': [
      'opd.dashboard.view',
      'opd.visit.view',
      'opd.visit.edit',
      'opd.doctor.encounter.view',
      'opd.doctor.visit.view',
      'opd.nursing.view',
      'patients.master.view',
      'clinical.view',
      'clinical.edit',
      // Doctor sees: Results Inbox + Order Sets
      'results.inbox.view',
      'order.sets.view',
    ],
    'charge-nurse': ['er.board.view', 'er.encounter.view'],
    charge_nurse: ['er.board.view', 'er.encounter.view'],

    // ── OPD Extended Roles ──
    'opd-charge-nurse': [
      'opd.dashboard.view',
      'opd.queue.view',
      'opd.visit.view',
      'opd.nursing.view',
      'opd.nursing.edit',
      'opd.nursing.flow',
      'patients.master.view',
      'patients.search.view',
      'scheduling.view',
      'dashboard.view',
      'account.view',
      // Charge Nurse: Tasks + Handover + Results Inbox
      'tasks.queue.view',
      'handover.view',
      'results.inbox.view',
    ],
    'opd-consultant': [
      'opd.dashboard.view',
      'opd.queue.view',
      'opd.visit.view',
      'opd.visit.create',
      'opd.visit.edit',
      'opd.doctor.encounter.view',
      'opd.doctor.visit.view',
      'opd.doctor.orders.create',
      'opd.doctor.schedule.view',
      'opd.nursing.view',
      'clinical.view',
      'clinical.edit',
      'patients.master.view',
      'patients.search.view',
      'patients.growth.view',
      'scheduling.view',
      'dashboard.view',
      'account.view',
      // Consultant sees: Results Inbox + Order Sets
      'results.inbox.view',
      'order.sets.view',
    ],
    'opd-admin': [
      'opd.dashboard.view',
      'opd.queue.view',
      'opd.visit.view',
      'opd.visit.create',
      'opd.visit.edit',
      'opd.nursing.view',
      'opd.nursing.edit',
      'opd.nursing.flow',
      'opd.doctor.encounter.view',
      'opd.doctor.visit.view',
      'opd.doctor.orders.create',
      'opd.doctor.schedule.view',
      'clinical.view',
      'clinical.edit',
      'registration.view',
      'registration.create',
      'patients.master.view',
      'patients.master.create',
      'patients.master.edit',
      'patients.master.merge',
      'patients.search.view',
      'patients.growth.view',
      'encounters.core.view',
      'encounters.core.create',
      'encounters.core.close',
      'scheduling.view',
      'scheduling.create',
      'scheduling.edit',
      'scheduling.delete',
      'scheduling.availability.view',
      'scheduling.availability.create',
      'scheduling.availability.edit',
      'billing.view',
      'billing.invoice.view',
      'billing.invoice.create',
      'billing.payment.view',
      'billing.payment.create',
      'dashboard.view',
      'account.view',
      'account.edit',
    ],

    // ── Reception Roles ──
    reception: [
      'registration.view',
      'registration.create',
      'patients.master.view',
      'patients.master.create',
      'patients.master.edit',
      'patients.search.view',
      'encounters.core.view',
      'encounters.core.create',
      'opd.visit.view',
      'opd.visit.create',
      'opd.booking.create',
      'opd.booking.cancel',
      'scheduling.view',
      'scheduling.create',
      'billing.view',
      'billing.invoice.view',
      'billing.payment.view',
      // ER registration — reception handles both OPD and ER walk-ins
      'er.register.view',
      'er.board.view',
      'dashboard.view',
      'account.view',
    ],
    'reception-staff': [
      'registration.view',
      'registration.create',
      'patients.master.view',
      'patients.master.create',
      'patients.search.view',
      'encounters.core.view',
      'encounters.core.create',
      'opd.visit.create',
      'opd.booking.create',
      'opd.booking.cancel',
      'scheduling.view',
      'scheduling.create',
      'billing.view',
      'billing.invoice.view',
      'billing.payment.view',
      'dashboard.view',
      'account.view',
    ],
    'reception-supervisor': [
      'registration.view',
      'registration.create',
      'patients.master.view',
      'patients.master.create',
      'patients.master.edit',
      'patients.master.merge',
      'patients.search.view',
      'patients.growth.view',
      'encounters.core.view',
      'encounters.core.create',
      'encounters.core.close',
      'opd.visit.create',
      'scheduling.view',
      'scheduling.create',
      'scheduling.edit',
      'scheduling.availability.view',
      'billing.view',
      'billing.invoice.view',
      'billing.invoice.create',
      'billing.payment.view',
      'billing.payment.create',
      'dashboard.view',
      'account.view',
      'account.edit',
    ],
    'reception-admin': [
      'registration.view',
      'registration.create',
      'patients.master.view',
      'patients.master.create',
      'patients.master.edit',
      'patients.master.merge',
      'patients.search.view',
      'patients.growth.view',
      'encounters.core.view',
      'encounters.core.create',
      'encounters.core.close',
      'opd.visit.create',
      'scheduling.view',
      'scheduling.create',
      'scheduling.edit',
      'scheduling.delete',
      'scheduling.availability.view',
      'scheduling.availability.create',
      'scheduling.availability.edit',
      'scheduling.availability.delete',
      'billing.view',
      'billing.invoice.view',
      'billing.invoice.create',
      'billing.payment.view',
      'billing.payment.create',
      'admin.users.view',
      'dashboard.view',
      'account.view',
      'account.edit',
    ],

    // ── Lab Roles ──
    'lab-technician': [
      'lab.view',
      'lab.specimens.view',
      'lab.specimens.create',
      'lab.results.view',
      'lab.results.create',
      'lab.orders.view',
      'lab.orders.create',
      'lab.alerts.view',
      'lab.alerts.acknowledge',
      'orders.hub.view',
      'results.inbox.view',
      'patients.master.view',
      'patients.search.view',
      'dashboard.view',
      'account.view',
    ],
    'lab-admin': [
      'lab.view',
      'orders.hub.view',
      'results.inbox.view',
      'patients.master.view',
      'patients.search.view',
      'blood_bank.view',
      'blood_bank.manage',
      'pathology.view',
      'pathology.manage',
      'dashboard.view',
      'account.view',
      'account.edit',
    ],

    // ── Radiology Roles ──
    'radiology-technician': [
      'radiology.view',
      'orders.hub.view',
      'results.inbox.view',
      'patients.master.view',
      'patients.search.view',
      'dashboard.view',
      'account.view',
    ],

    // ── Pharmacy Roles ──
    pharmacist: [
      'pharmacy.view',
      'pharmacy.dispense.view',
      'pharmacy.dispense.create',
      'pharmacy.inventory.view',
      'orders.hub.view',
      'patients.master.view',
      'patients.search.view',
      'dashboard.view',
      'account.view',
    ],

    // ── Billing Roles ──
    'billing-staff': [
      'billing.view',
      'billing.invoice.view',
      'billing.invoice.create',
      'billing.payment.view',
      'billing.payment.create',
      'patients.master.view',
      'patients.search.view',
      'dashboard.view',
      'account.view',
    ],

    // ── Quality Roles ──
    'quality-manager': [
      'quality.view',
      'quality.manage',
      'quality.rca.view',
      'quality.rca.manage',
      'infection_control.view',
      'infection_control.manage',
      'dashboard.view',
      'account.view',
      'account.edit',
    ],

    // ── OR Roles ──
    'or-nurse': [
      'or.view',
      'or.nursing.view',
      'patients.master.view',
      'patients.search.view',
      'clinical.view',
      'orders.hub.view',
      'tasks.queue.view',
      'handover.view',
      'cssd.view',
      'equipment.view',
      'dashboard.view',
      'account.view',
    ],
    'or-doctor': [
      'or.view',
      'or.nursing.view',
      'patients.master.view',
      'patients.search.view',
      'clinical.view',
      'clinical.edit',
      'orders.hub.view',
      'results.inbox.view',
      'order.sets.view',
      'dashboard.view',
      'account.view',
    ],

    // ── Dental Roles ──
    dentist: [
      'patients.master.view',
      'patients.search.view',
      'clinical.view',
      'clinical.edit',
      'dental.chart.view',
      'dental.chart.edit',
      'dental.treatment.view',
      'dental.treatment.edit',
      'orders.hub.view',
      'results.inbox.view',
      'scheduling.view',
      'dashboard.view',
      'account.view',
    ],

    // ── OBGYN Roles ──
    'obgyn-doctor': [
      'patients.master.view',
      'patients.search.view',
      'clinical.view',
      'clinical.edit',
      'orders.hub.view',
      'results.inbox.view',
      'order.sets.view',
      'scheduling.view',
      'dashboard.view',
      'account.view',
    ],
    'obgyn-nurse': [
      'patients.master.view',
      'patients.search.view',
      'clinical.view',
      'orders.hub.view',
      'tasks.queue.view',
      'handover.view',
      'dashboard.view',
      'account.view',
    ],

    // ── Specialty Module Roles ──
    'physiotherapist': [
      'physiotherapy.view',
      'physiotherapy.manage',
      'patients.master.view',
      'patients.search.view',
      'orders.hub.view',
      'dashboard.view',
      'account.view',
    ],
    'dietitian': [
      'nutrition.view',
      'nutrition.manage',
      'patients.master.view',
      'patients.search.view',
      'dashboard.view',
      'account.view',
    ],
    'social-worker': [
      'social_work.view',
      'social_work.manage',
      'patients.master.view',
      'patients.search.view',
      'dashboard.view',
      'account.view',
    ],

    // ── Mortuary ──
    'mortuary-staff': [
      'mortuary.view',
      'patients.master.view',
      'patients.search.view',
      'dashboard.view',
      'account.view',
    ],

    // ── Generic roles (used in demo/seed data) ──
    doctor: [
      'opd.dashboard.view',
      'opd.visit.view',
      'opd.visit.edit',
      'opd.doctor.encounter.view',
      'opd.doctor.visit.view',
      'opd.nursing.view',
      'er.board.view',
      'er.doctor.view',
      'er.encounter.view',
      'er.encounter.edit',
      'ipd.live-beds.view',
      'icu.view',
      'or.view',
      'patients.master.view',
      'patients.search.view',
      'patients.growth.view',
      'clinical.view',
      'clinical.edit',
      'orders.view',
      'results.inbox.view',
      'order.sets.view',
      'scheduling.view',
      'registration.view',
      'dashboard.view',
      'account.view',
      'dental.chart.view',
      'dental.chart.edit',
      'dental.treatment.view',
      'dental.treatment.edit',
      'obgyn.view',
      'obgyn.edit',
      'obgyn.forms.view',
      'obgyn.forms.edit',
      'pharmacy.dispense.view',
    ],
    nurse: [
      'opd.dashboard.view',
      'opd.queue.view',
      'opd.visit.view',
      'opd.nursing.view',
      'opd.nursing.edit',
      'opd.nursing.flow',
      'er.board.view',
      'er.nursing.view',
      'er.nursing.edit',
      'er.triage.view',
      'er.triage.edit',
      'er.beds.view',
      'er.encounter.view',
      'ipd.live-beds.view',
      'or.view',
      'or.nursing.view',
      'patients.master.view',
      'patients.search.view',
      'clinical.view',
      'orders.view',
      'tasks.queue.view',
      'handover.view',
      'registration.view',
      'dashboard.view',
      'account.view',
    ],

    viewer: [
      'dashboard.view',
      'policies.view',
      'account.view',
    ],

    // ── CVision Roles ──
    'cvision-admin': [
      'cvision.dashboard.view',
      'cvision.employees.view',
      'cvision.employees.create',
      'cvision.employees.edit',
      'cvision.employees.delete',
      'cvision.employees.status',
      'cvision.org.view',
      'cvision.org.edit',
      'cvision.attendance.view',
      'cvision.attendance.edit',
      'cvision.attendance.approve',
      'cvision.leaves.view',
      'cvision.leaves.create',
      'cvision.leaves.approve',
      'cvision.payroll.view',
      'cvision.payroll.edit',
      'cvision.payroll.approve',
      'cvision.recruitment.view',
      'cvision.recruitment.edit',
      'cvision.recruitment.approve',
      'cvision.performance.view',
      'cvision.performance.edit',
      'cvision.training.view',
      'cvision.training.edit',
      'cvision.requests.view',
      'cvision.requests.create',
      'cvision.requests.approve',
      'cvision.analytics.view',
      'cvision.admin.view',
      'cvision.admin.edit',
      'account.view',
      'account.edit',
    ],
    'cvision-hr-manager': [
      'cvision.dashboard.view',
      'cvision.employees.view',
      'cvision.employees.create',
      'cvision.employees.edit',
      'cvision.employees.status',
      'cvision.org.view',
      'cvision.attendance.view',
      'cvision.attendance.edit',
      'cvision.attendance.approve',
      'cvision.leaves.view',
      'cvision.leaves.create',
      'cvision.leaves.approve',
      'cvision.payroll.view',
      'cvision.recruitment.view',
      'cvision.recruitment.edit',
      'cvision.performance.view',
      'cvision.performance.edit',
      'cvision.training.view',
      'cvision.training.edit',
      'cvision.requests.view',
      'cvision.requests.create',
      'cvision.requests.approve',
      'cvision.analytics.view',
      'account.view',
    ],
    'cvision-manager': [
      'cvision.dashboard.view',
      'cvision.employees.view',
      'cvision.attendance.view',
      'cvision.attendance.approve',
      'cvision.leaves.view',
      'cvision.leaves.approve',
      'cvision.performance.view',
      'cvision.performance.edit',
      'cvision.requests.view',
      'cvision.requests.approve',
      'account.view',
    ],
    'cvision-recruiter': [
      'cvision.dashboard.view',
      'cvision.recruitment.view',
      'cvision.recruitment.edit',
      'cvision.employees.view',
      'account.view',
    ],
    // hr-admin: full CVision HR access (used by simulator & seeded HR admin users)
    'hr-admin': [
      'cvision.dashboard.view',
      'cvision.employees.view',
      'cvision.employees.create',
      'cvision.employees.edit',
      'cvision.employees.status',
      'cvision.org.view',
      'cvision.org.edit',
      'cvision.attendance.view',
      'cvision.attendance.edit',
      'cvision.attendance.approve',
      'cvision.leaves.view',
      'cvision.leaves.create',
      'cvision.leaves.approve',
      'cvision.payroll.view',
      'cvision.payroll.edit',
      'cvision.payroll.approve',
      'cvision.recruitment.view',
      'cvision.recruitment.edit',
      'cvision.recruitment.approve',
      'cvision.performance.view',
      'cvision.performance.edit',
      'cvision.training.view',
      'cvision.training.edit',
      'cvision.requests.view',
      'cvision.requests.create',
      'cvision.requests.approve',
      'cvision.analytics.view',
      'cvision.admin.view',
      'cvision.admin.edit',
      'account.view',
      'account.edit',
    ],
    'cvision-employee': [
      'cvision.dashboard.view',
      'cvision.requests.view',
      'cvision.requests.create',
      'cvision.leaves.view',
      'cvision.leaves.create',
      'account.view',
    ],

    // IT: user list (change password) + Clinical Infrastructure
    it: [
      'admin.users.changePassword',
      'admin.clinical-infra.view',
      'dashboard.view',
      'account.view',
      'account.edit',
    ],

    // ── ICU Roles ──
    'icu-nurse': [
      'icu.view',
      'ipd.live-beds.view',
      'patients.master.view',
      'patients.search.view',
      'clinical.view',
      'orders.view',
      'tasks.queue.view',
      'handover.view',
      'dashboard.view',
      'account.view',
    ],
    'icu-doctor': [
      'icu.view',
      'ipd.live-beds.view',
      'patients.master.view',
      'patients.search.view',
      'clinical.view',
      'clinical.edit',
      'orders.view',
      'results.inbox.view',
      'order.sets.view',
      'dashboard.view',
      'account.view',
    ],
    'icu-admin': [
      'icu.view',
      'ipd.live-beds.view',
      'patients.master.view',
      'patients.master.create',
      'patients.master.edit',
      'patients.search.view',
      'clinical.view',
      'clinical.edit',
      'orders.view',
      'results.inbox.view',
      'order.sets.view',
      'tasks.queue.view',
      'handover.view',
      'dashboard.view',
      'account.view',
      'account.edit',
    ],
  };

  const key = typeof role === 'string' ? role.toLowerCase().trim() : '';
  const base = defaults[key] || defaults[role] || [];
  return expandGroupedPermissions(base);
}
