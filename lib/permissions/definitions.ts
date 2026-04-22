/**
 * All available permissions for pages/modules in the system
 */

import type { Permission } from './types';

export const PERMISSIONS: Permission[] = [
  // Dashboard
  { key: 'dashboard.view', label: 'View Dashboard', category: 'Dashboard' },

  // Notifications
  { key: 'notifications.view', label: 'View Notifications', category: 'Notifications' },

  // ── Hospital Core ──
  // Registration (standalone — 2 visible actions)
  { key: 'registration.view', label: 'Registration', category: 'Hospital Core' },
  { key: 'registration.create', label: 'Registration', category: 'Hospital Core' },

  // Patient Master (standalone — 4 visible actions)
  { key: 'patients.master.view', label: 'Patient Master', category: 'Hospital Core' },
  { key: 'patients.master.create', label: 'Patient Master', category: 'Hospital Core' },
  { key: 'patients.master.edit', label: 'Patient Master', category: 'Hospital Core' },
  { key: 'patients.master.merge', label: 'Patient Master', category: 'Hospital Core' },

  // Encounter Core (hidden — auto-included with Registration)
  { key: 'encounters.core.view', label: 'Registration Encounters', category: 'Hospital Core', group: 'hc-registration', hidden: true },
  { key: 'encounters.core.create', label: 'Registration Encounters', category: 'Hospital Core', group: 'hc-registration', hidden: true },
  { key: 'encounters.core.close', label: 'Registration Encounters', category: 'Hospital Core', group: 'hc-registration', hidden: true },

  // Clinical Data (hidden — auto-included with Patient Master / Doctor Station / Nurse Station)
  { key: 'clinical.view', label: 'Clinical Data View', category: 'Hospital Core', group: 'hc-clinical', hidden: true },
  { key: 'clinical.edit', label: 'Clinical Data Edit', category: 'Hospital Core', group: 'hc-clinical', hidden: true },

  // ── OPD ──
  // OPD Dashboard (standalone + tab-level)
  { key: 'opd.dashboard.view', label: 'OPD Dashboard', category: 'OPD' },
  { key: 'opd.dashboard.specialties', label: 'OPD Dashboard Specialties', category: 'OPD', group: 'opd-dashboard-tabs', hidden: true },
  { key: 'opd.dashboard.doctors', label: 'OPD Dashboard Doctors', category: 'OPD', group: 'opd-dashboard-tabs', hidden: true },
  { key: 'opd.dashboard.rooms', label: 'OPD Dashboard Rooms', category: 'OPD', group: 'opd-dashboard-tabs', hidden: true },
  { key: 'opd.dashboard.strategic', label: 'OPD Dashboard Strategic', category: 'OPD', group: 'opd-dashboard-tabs', hidden: true },
  { key: 'opd.dashboard.export', label: 'OPD Dashboard Export', category: 'OPD', group: 'opd-dashboard-tabs', hidden: true },

  // OPD Analytics (standalone)
  { key: 'opd.analytics.view', label: 'OPD Analytics', category: 'OPD' },

  // OPD Queue (standalone)
  { key: 'opd.queue.view', label: 'Waiting List', category: 'OPD' },

  // Nurse Station (grouped — one row in admin UI)
  { key: 'opd.nursing.view', label: 'Nurse Station', category: 'OPD', group: 'opd-nurse-station' },
  { key: 'opd.nursing.edit', label: 'Nurse Station Edit', category: 'OPD', group: 'opd-nurse-station', hidden: true },
  { key: 'opd.nursing.flow', label: 'Nurse Station Flow', category: 'OPD', group: 'opd-nurse-station', hidden: true },

  // Visit Registration (standalone visible row — only reception should have this)
  { key: 'opd.visit.create', label: 'Visit Registration', category: 'OPD', group: 'opd-visit-registration' },

  // Doctor Station (grouped — one row in admin UI)
  { key: 'opd.doctor.encounter.view', label: 'Doctor Station', category: 'OPD', group: 'opd-doctor-station' },
  { key: 'opd.visit.view', label: 'Doctor Station Visit View', category: 'OPD', group: 'opd-doctor-station', hidden: true },
  { key: 'opd.visit.edit', label: 'Doctor Station Visit Edit', category: 'OPD', group: 'opd-doctor-station', hidden: true },
  { key: 'opd.doctor.visit.view', label: 'Doctor Station Doctor Visit', category: 'OPD', group: 'opd-doctor-station', hidden: true },
  { key: 'opd.doctor.orders.create', label: 'Doctor Station Orders', category: 'OPD', group: 'opd-doctor-station', hidden: true },
  { key: 'opd.doctor.schedule.view', label: 'Doctor Station Schedule', category: 'OPD', group: 'opd-doctor-station', hidden: true },

  // Appointments — View only (for nurses and anyone who needs to see the schedule)
  { key: 'scheduling.view', label: 'Appointments (View)', category: 'OPD', group: 'opd-appointments-view' },
  { key: 'scheduling.availability.view', label: 'Appointments Availability View', category: 'OPD', group: 'opd-appointments-view', hidden: true },

  // Appointments — Manage (for reception who needs to create/edit/delete)
  { key: 'scheduling.create', label: 'Appointments (Manage)', category: 'OPD', group: 'opd-appointments-manage' },
  { key: 'scheduling.edit', label: 'Appointments Edit', category: 'OPD', group: 'opd-appointments-manage', hidden: true },
  { key: 'scheduling.delete', label: 'Appointments Delete', category: 'OPD', group: 'opd-appointments-manage', hidden: true },
  { key: 'scheduling.availability.create', label: 'Availability Create', category: 'OPD', group: 'opd-appointments-manage', hidden: true },
  { key: 'scheduling.availability.edit', label: 'Availability Edit', category: 'OPD', group: 'opd-appointments-manage', hidden: true },
  { key: 'scheduling.availability.delete', label: 'Availability Delete', category: 'OPD', group: 'opd-appointments-manage', hidden: true },

  // ── ER ──
  // ER Registration (group: er-registration)
  { key: 'er.register.view', label: 'ER Registration', category: 'ER', group: 'er-registration' },
  { key: 'er.register.create', label: 'ER Registration Create', category: 'ER', group: 'er-registration', hidden: true },

  // ER Tracking Board (group: er-board) — includes Command, Metrics, Alerts
  { key: 'er.board.view', label: 'ER Tracking Board', category: 'ER', group: 'er-board' },

  // ER Nurse Station (group: er-nurse-station)
  { key: 'er.nursing.view', label: 'ER Nurse Station', category: 'ER', group: 'er-nurse-station' },
  { key: 'er.nursing.edit', label: 'ER Nurse Station Edit', category: 'ER', group: 'er-nurse-station', hidden: true },

  // ER Doctor Station (group: er-doctor-station)
  { key: 'er.doctor.view', label: 'ER Doctor Station', category: 'ER', group: 'er-doctor-station' },
  { key: 'er.encounter.view', label: 'ER Encounter View', category: 'ER', group: 'er-doctor-station', hidden: true },
  { key: 'er.encounter.edit', label: 'ER Encounter Edit', category: 'ER', group: 'er-doctor-station', hidden: true },
  { key: 'er.disposition.update', label: 'ER Disposition Update', category: 'ER', group: 'er-doctor-station', hidden: true },

  // ER Triage (group: er-triage)
  { key: 'er.triage.view', label: 'ER Triage', category: 'ER', group: 'er-triage' },
  { key: 'er.triage.edit', label: 'ER Triage Edit', category: 'ER', group: 'er-triage', hidden: true },

  // ER Beds (group: er-beds)
  { key: 'er.beds.view', label: 'ER Beds', category: 'ER', group: 'er-beds' },
  { key: 'er.beds.assign', label: 'ER Beds Assign', category: 'ER', group: 'er-beds', hidden: true },
  { key: 'er.staff.assign', label: 'ER Staff Assign', category: 'ER', group: 'er-beds', hidden: true },

  // ── Billing ──
  { key: 'billing.view', label: 'Billing', category: 'Billing', group: 'billing-main' },
  { key: 'billing.invoice.view', label: 'Invoices & Payments', category: 'Billing', group: 'billing-invoices' },
  { key: 'billing.invoice.create', label: 'Invoices Create', category: 'Billing', group: 'billing-invoices', hidden: true },
  { key: 'billing.payment.view', label: 'Payments View', category: 'Billing', group: 'billing-invoices', hidden: true },
  { key: 'billing.payment.create', label: 'Payments Create', category: 'Billing', group: 'billing-invoices', hidden: true },
  { key: 'billing.revenue-cycle.view', label: 'Revenue Cycle Dashboard', category: 'Billing', group: 'billing-main', hidden: true },
  { key: 'billing.nphies-dashboard.view', label: 'NPHIES Dashboard', category: 'Billing', group: 'billing-main', hidden: true },

  // ── Patient Search & Growth ──
  { key: 'patients.search.view', label: 'Patient Search', category: 'Patients' },
  { key: 'patients.growth.view', label: 'Patient Growth Charts', category: 'Patients' },

  // ── Orders ──
  // Orders Hub — lead permission, grants all order sub-pages when checked in admin UI
  { key: 'orders.view', label: 'Orders (All)', category: 'Orders', group: 'orders-all' },
  { key: 'orders.sets.view', label: 'Order Sets', category: 'Orders', group: 'orders-all', hidden: true },
  { key: 'orders.results.view', label: 'Results Inbox', category: 'Orders', group: 'orders-all', hidden: true },
  { key: 'orders.tasks.view', label: 'Tasks Queue', category: 'Orders', group: 'orders-all', hidden: true },
  { key: 'orders.handover.view', label: 'Handover', category: 'Orders', group: 'orders-all', hidden: true },
  // Standalone permissions for specific pages (shown individually in admin UI)
  { key: 'orders.hub.view', label: 'Orders Hub', category: 'Orders' },
  { key: 'results.inbox.view', label: 'Results Inbox', category: 'Orders' },
  { key: 'tasks.queue.view', label: 'Tasks Queue', category: 'Orders' },
  { key: 'handover.view', label: 'Handover', category: 'Orders' },
  { key: 'order.sets.view', label: 'Order Sets', category: 'Orders' },

  // ── Lab ──
  { key: 'lab.view', label: 'Laboratory', category: 'Lab' },
  { key: 'lab.microbiology.view', label: 'Lab Microbiology', category: 'Lab', group: 'lab', hidden: true },
  { key: 'lab.tat.view', label: 'Lab TAT Dashboard', category: 'Lab', group: 'lab', hidden: true },
  { key: 'lab.critical-alerts.view', label: 'Lab Critical Alerts', category: 'Lab', group: 'lab', hidden: true },

  // ── Radiology ──
  { key: 'radiology.view', label: 'Radiology', category: 'Radiology' },
  { key: 'radiology.worklist.view', label: 'Radiology Worklist', category: 'Radiology', group: 'radiology', hidden: true },
  { key: 'radiology.structured-reporting.view', label: 'Radiology Structured Reporting', category: 'Radiology', group: 'radiology', hidden: true },
  { key: 'radiology.critical-findings.view', label: 'Radiology Critical Findings', category: 'Radiology', group: 'radiology', hidden: true },

  // ── Pharmacy ──
  { key: 'pharmacy.view', label: 'Pharmacy', category: 'Pharmacy' },
  { key: 'pharmacy.unit-dose.view', label: 'Pharmacy Unit Dose', category: 'Pharmacy', group: 'pharmacy', hidden: true },
  { key: 'pharmacy.controlled-substances.view', label: 'Pharmacy Controlled Substances', category: 'Pharmacy', group: 'pharmacy', hidden: true },

  // ── Quality ──
  { key: 'quality.view', label: 'Quality', category: 'Quality' },
  { key: 'quality.manage', label: 'Quality Manage', category: 'Quality', group: 'quality-manage', hidden: true },
  { key: 'quality.rca.view', label: 'Quality RCA/FMEA View', category: 'Quality', group: 'quality-rca' },
  { key: 'quality.rca.manage', label: 'Quality RCA/FMEA Manage', category: 'Quality', group: 'quality-rca', hidden: true },

  // Care Gap Scanner
  { key: 'care-gaps.view', label: 'Care Gap Scanner', category: 'Quality', group: 'care-gaps' },
  { key: 'care-gaps.manage', label: 'Care Gap Manage', category: 'Quality', group: 'care-gaps', hidden: true },
  { key: 'care-gaps.scan', label: 'Care Gap Scan', category: 'Quality', group: 'care-gaps', hidden: true },

  // Readmission Tracking
  { key: 'readmissions.view', label: 'Readmission Tracking', category: 'Quality', group: 'readmissions' },
  { key: 'readmissions.review', label: 'Readmission Review', category: 'Quality', group: 'readmissions', hidden: true },

  // ── IPD ──
  { key: 'ipd.doctor-station.view', label: 'IPD Doctor Station', category: 'IPD', group: 'ipd-main' },
  { key: 'ipd.live-beds.view', label: 'IPD Episodes', category: 'IPD', group: 'ipd-main' },
  { key: 'ipd.live-beds.create', label: 'IPD Live Beds Create', category: 'IPD', group: 'ipd-main', hidden: true },
  { key: 'ipd.live-beds.edit', label: 'IPD Live Beds Edit', category: 'IPD', group: 'ipd-main', hidden: true },
  { key: 'ipd.live-beds.delete', label: 'IPD Live Beds Delete', category: 'IPD', group: 'ipd-main', hidden: true },
  { key: 'ipd.bed-setup', label: 'IPD Bed Setup', category: 'IPD', group: 'ipd-main', hidden: true },
  { key: 'ipd.dept-input', label: 'IPD Department Input', category: 'IPD', group: 'ipd-main', hidden: true },
  { key: 'ipd.live-beds', label: 'IPD Live Beds', category: 'IPD', group: 'ipd-main', hidden: true },
  { key: 'ipd.bed-setup.view', label: 'View IPD Bed Setup', category: 'IPD', group: 'ipd-main', hidden: true },
  { key: 'ipd.bed-setup.create', label: 'Create IPD Bed Setup', category: 'IPD', group: 'ipd-main', hidden: true },
  { key: 'ipd.bed-setup.edit', label: 'Edit IPD Bed Setup', category: 'IPD', group: 'ipd-main', hidden: true },
  { key: 'ipd.bed-setup.delete', label: 'Delete IPD Bed Setup', category: 'IPD', group: 'ipd-main', hidden: true },
  { key: 'ipd.dept-input.view', label: 'View IPD Department Input', category: 'IPD', group: 'ipd-main', hidden: true },
  { key: 'ipd.dept-input.create', label: 'Create IPD Department Input', category: 'IPD', group: 'ipd-main', hidden: true },
  { key: 'ipd.dept-input.edit', label: 'Edit IPD Department Input', category: 'IPD', group: 'ipd-main', hidden: true },
  { key: 'ipd.dept-input.delete', label: 'Delete IPD Department Input', category: 'IPD', group: 'ipd-main', hidden: true },
  { key: 'ipd.ward-board.view', label: 'IPD Ward Board', category: 'IPD', group: 'ipd-main', hidden: true },
  { key: 'ipd.discharge-summary.view', label: 'IPD Discharge Summary', category: 'IPD', group: 'ipd-main', hidden: true },

  // ── Admission Office ──
  { key: 'admission.view', label: 'Admission Office', category: 'IPD', group: 'admission-office' },
  { key: 'admission.manage', label: 'Admission Manage', category: 'IPD', group: 'admission-office', hidden: true },
  { key: 'admission.approve_transfer', label: 'Approve Ward Transfer', category: 'IPD', group: 'admission-office', hidden: true },
  { key: 'admission.admin', label: 'Admission Admin (Templates)', category: 'IPD', group: 'admission-office', hidden: true },
  { key: 'admission.escalate_icu', label: 'Escalate to ICU/CCU', category: 'IPD', group: 'admission-office', hidden: true },
  { key: 'admission.collect_payment', label: 'Collect Admission Payment', labelAr: 'تحصيل دفعات القبول', category: 'IPD', group: 'admission-office' },

  // ── OR / ICU / Mortuary ──
  { key: 'or.view', label: 'Operating Room', category: 'OR' },
  { key: 'or.schedule.view', label: 'OR Schedule Board', category: 'OR', group: 'or' },
  { key: 'or.nursing.view', label: 'OR Nurse Station', category: 'OR', group: 'or' },
  { key: 'or.preop.view', label: 'OR Pre-Op Assessment', category: 'OR', group: 'or' },
  { key: 'or.surgeon-station.view', label: 'OR Surgeon Station', category: 'OR', group: 'or', hidden: true },
  { key: 'or.operative-notes.view', label: 'OR Operative Notes', category: 'OR', group: 'or', hidden: true },
  { key: 'or.post-op-orders.view', label: 'OR Post-Op Orders', category: 'OR', group: 'or', hidden: true },
  { key: 'icu.view', label: 'ICU', category: 'ICU' },
  { key: 'icu.doctor-station.view', label: 'ICU Doctor Station', category: 'ICU', group: 'icu' },
  { key: 'icu.apache.view', label: 'ICU APACHE Score', category: 'ICU', group: 'icu', hidden: true },
  { key: 'icu.sedation.view', label: 'ICU Sedation Assessment', category: 'ICU', group: 'icu', hidden: true },
  { key: 'icu.delirium.view', label: 'ICU Delirium Screen', category: 'ICU', group: 'icu', hidden: true },
  { key: 'icu.bundles.view', label: 'ICU Bundle Compliance', category: 'ICU', group: 'icu', hidden: true },
  { key: 'icu.code-blue.view', label: 'ICU Code Blue', category: 'ICU', group: 'icu', hidden: true },
  { key: 'icu.transfer.approve', label: 'ICU Transfer Approve/Reject', category: 'ICU', group: 'icu', hidden: true },
  { key: 'mortuary.view', label: 'Mortuary', category: 'Mortuary' },

  // ── Document System ──
  { key: 'policies.upload.view', label: 'View Document Upload', category: 'Document System' },
  { key: 'policies.upload.create', label: 'Create Document Upload', category: 'Document System' },
  { key: 'policies.upload.edit', label: 'Edit Document Upload', category: 'Document System' },
  { key: 'policies.upload.delete', label: 'Delete Document Upload', category: 'Document System' },

  { key: 'policies.view', label: 'View Documents Library', category: 'Document System' },
  { key: 'policies.create', label: 'Create Document', category: 'Document System' },
  { key: 'policies.edit', label: 'Edit Document', category: 'Document System' },
  { key: 'policies.delete', label: 'Delete Document', category: 'Document System' },

  { key: 'policies.conflicts.view', label: 'View Document Conflicts & Issues', category: 'Document System' },
  { key: 'policies.conflicts.analyze', label: 'Analyze Document Conflicts', category: 'Document System' },
  { key: 'policies.conflicts.resolve', label: 'Resolve Document Conflicts', category: 'Document System' },

  // SAM Document Engine permissions
  { key: 'sam.thea-engine.conflicts', label: 'SAM Document Engine Conflicts', category: 'Document System' },
  { key: 'sam.thea-engine.conflicts.resolve', label: 'SAM Document Engine Resolve Conflicts', category: 'Document System' },

  { key: 'policies.assistant.view', label: 'View Document Assistant', category: 'Document System' },
  { key: 'policies.assistant.create', label: 'Create Document Assistant', category: 'Document System' },
  { key: 'policies.assistant.edit', label: 'Edit Document Assistant', category: 'Document System' },
  { key: 'policies.assistant.delete', label: 'Delete Document Assistant', category: 'Document System' },

  { key: 'policies.new-creator.view', label: 'View New Document Creator', category: 'Document System' },
  { key: 'policies.new-creator.create', label: 'Create New Document Creator', category: 'Document System' },
  { key: 'policies.new-creator.edit', label: 'Edit New Document Creator', category: 'Document System' },
  { key: 'policies.new-creator.delete', label: 'Delete New Document Creator', category: 'Document System' },

  { key: 'policies.harmonization.view', label: 'View Document Alignment', category: 'Document System' },
  { key: 'policies.harmonization.create', label: 'Create Document Alignment', category: 'Document System' },
  { key: 'policies.harmonization.edit', label: 'Edit Document Alignment', category: 'Document System' },
  { key: 'policies.harmonization.delete', label: 'Delete Document Alignment', category: 'Document System' },

  { key: 'policies.risk-detector.view', label: 'View Risk Detector', category: 'Document System' },
  { key: 'policies.risk-detector.create', label: 'Create Risk Detector', category: 'Document System' },
  { key: 'policies.risk-detector.edit', label: 'Edit Risk Detector', category: 'Document System' },
  { key: 'policies.risk-detector.delete', label: 'Delete Risk Detector', category: 'Document System' },

  { key: 'policies.tag-review.view', label: 'View Tag Review Queue', category: 'Document System' },
  { key: 'policies.tag-review.create', label: 'Create Tag Review Queue', category: 'Document System' },
  { key: 'policies.tag-review.edit', label: 'Edit Tag Review Queue', category: 'Document System' },
  { key: 'policies.tag-review.delete', label: 'Delete Tag Review Queue', category: 'Document System' },

  { key: 'policies.builder.view', label: 'View Document Builder', category: 'Document System' },
  { key: 'policies.builder.create', label: 'Create Document Builder', category: 'Document System' },
  { key: 'policies.builder.edit', label: 'Edit Document Builder', category: 'Document System' },
  { key: 'policies.builder.delete', label: 'Delete Document Builder', category: 'Document System' },

  // ── Admin ──
  // User Management (group: admin-users)
  { key: 'admin.users.view', label: 'User Management', category: 'Admin', group: 'admin-users' },
  { key: 'admin.users.create', label: 'User Create', category: 'Admin', group: 'admin-users', hidden: true },
  { key: 'admin.users.edit', label: 'User Edit', category: 'Admin', group: 'admin-users', hidden: true },
  { key: 'admin.users.changePassword', label: 'Change User Password', category: 'Admin', group: 'admin-users', hidden: true },
  { key: 'admin.users.delete', label: 'User Delete', category: 'Admin', group: 'admin-users', hidden: true },
  { key: 'admin.admin.view', label: 'Admin Users View', category: 'Admin', group: 'admin-users', hidden: true },
  { key: 'admin.admin.create', label: 'Admin Users Create', category: 'Admin', group: 'admin-users', hidden: true },
  { key: 'admin.admin.edit', label: 'Admin Users Edit', category: 'Admin', group: 'admin-users', hidden: true },
  { key: 'admin.admin.delete', label: 'Admin Users Delete', category: 'Admin', group: 'admin-users', hidden: true },

  // Clinical Infrastructure (Facilities, Floors, Beds, Clinics, Units, Rooms, Specialties, Providers)
  { key: 'admin.clinical-infra.view', label: 'Clinical Infrastructure', category: 'Admin', group: 'admin-clinical-infra' },

  // Scheduling (Resources, Templates, Calendar, Availability)
  { key: 'admin.scheduling.view', label: 'Scheduling', category: 'Admin', group: 'admin-scheduling' },

  // System Admin (group: admin-system)
  { key: 'admin.data-admin.view', label: 'System Admin', category: 'Admin', group: 'admin-system' },
  { key: 'admin.data-admin.create', label: 'System Admin Create', category: 'Admin', group: 'admin-system', hidden: true },
  { key: 'admin.data-admin.edit', label: 'System Admin Edit', category: 'Admin', group: 'admin-system', hidden: true },
  { key: 'admin.data-admin.delete', label: 'System Admin Delete', category: 'Admin', group: 'admin-system', hidden: true },
  { key: 'admin.quotas.view', label: 'Quotas View', category: 'Admin', group: 'admin-system', hidden: true },
  { key: 'admin.quotas.create', label: 'Quotas Create', category: 'Admin', group: 'admin-system', hidden: true },
  { key: 'admin.quotas.edit', label: 'Quotas Edit', category: 'Admin', group: 'admin-system', hidden: true },
  { key: 'admin.quotas.delete', label: 'Quotas Delete', category: 'Admin', group: 'admin-system', hidden: true },
  { key: 'admin.structure-management.view', label: 'Structure View', category: 'Admin', group: 'admin-system', hidden: true },
  { key: 'admin.structure-management.create', label: 'Structure Create', category: 'Admin', group: 'admin-system', hidden: true },
  { key: 'admin.structure-management.edit', label: 'Structure Edit', category: 'Admin', group: 'admin-system', hidden: true },
  { key: 'admin.structure-management.delete', label: 'Structure Delete', category: 'Admin', group: 'admin-system', hidden: true },
  { key: 'admin.delete-sample-data.view', label: 'Delete Sample View', category: 'Admin', group: 'admin-system', hidden: true },
  { key: 'admin.delete-sample-data.create', label: 'Delete Sample Create', category: 'Admin', group: 'admin-system', hidden: true },
  { key: 'admin.delete-sample-data.edit', label: 'Delete Sample Edit', category: 'Admin', group: 'admin-system', hidden: true },
  { key: 'admin.delete-sample-data.delete', label: 'Delete Sample Delete', category: 'Admin', group: 'admin-system', hidden: true },
  { key: 'admin.groups-hospitals.view', label: 'Groups View', category: 'Admin', group: 'admin-system', hidden: true },
  { key: 'admin.groups-hospitals.create', label: 'Groups Create', category: 'Admin', group: 'admin-system', hidden: true },
  { key: 'admin.groups-hospitals.edit', label: 'Groups Edit', category: 'Admin', group: 'admin-system', hidden: true },
  { key: 'admin.groups-hospitals.delete', label: 'Groups Delete', category: 'Admin', group: 'admin-system', hidden: true },

  // Account
  { key: 'account.view', label: 'View Account', category: 'Account' },
  { key: 'account.edit', label: 'Edit Account', category: 'Account' },

  // ── Clinical Services ──
  // Physiotherapy
  { key: 'physiotherapy.view', label: 'Physiotherapy', category: 'Clinical Services', group: 'physiotherapy' },
  { key: 'physiotherapy.manage', label: 'Physiotherapy Manage', category: 'Clinical Services', group: 'physiotherapy', hidden: true },

  // Consult Management
  { key: 'consults.view', label: 'Consultation Requests', category: 'Clinical Services', group: 'consults' },
  { key: 'consults.create', label: 'Consult Create', category: 'Clinical Services', group: 'consults', hidden: true },
  { key: 'consults.respond', label: 'Consult Respond', category: 'Clinical Services', group: 'consults', hidden: true },

  // Wound Care
  { key: 'wound_care.view', label: 'Wound Care', category: 'Clinical Services', group: 'wound-care' },
  { key: 'wound_care.manage', label: 'Wound Care Manage', category: 'Clinical Services', group: 'wound-care', hidden: true },

  // Nutrition
  { key: 'nutrition.view', label: 'Nutrition / Dietitian', category: 'Clinical Services', group: 'nutrition' },
  { key: 'nutrition.manage', label: 'Nutrition Manage', category: 'Clinical Services', group: 'nutrition', hidden: true },

  // Social Work
  { key: 'social_work.view', label: 'Social Work', category: 'Clinical Services', group: 'social-work' },
  { key: 'social_work.manage', label: 'Social Work Manage', category: 'Clinical Services', group: 'social-work', hidden: true },

  // Patient Education
  { key: 'patient_education.view', label: 'Patient Education', category: 'Clinical Services', group: 'patient-education' },
  { key: 'patient_education.manage', label: 'Patient Education Manage', category: 'Clinical Services', group: 'patient-education', hidden: true },

  // ── Lab & Diagnostics ──
  // Blood Bank
  { key: 'blood_bank.view', label: 'Blood Bank', category: 'Lab & Diagnostics', group: 'blood-bank' },
  { key: 'blood_bank.manage', label: 'Blood Bank Manage', category: 'Lab & Diagnostics', group: 'blood-bank', hidden: true },
  { key: 'blood_bank.transfuse', label: 'Blood Bank Transfuse', category: 'Lab & Diagnostics', group: 'blood-bank', hidden: true },
  { key: 'blood_bank.crossmatch.view', label: 'Blood Bank Cross-Match', category: 'Lab & Diagnostics', group: 'blood-bank', hidden: true },
  { key: 'blood_bank.inventory.view', label: 'Blood Bank Inventory', category: 'Lab & Diagnostics', group: 'blood-bank', hidden: true },

  // Pathology / Histology
  { key: 'pathology.view', label: 'Pathology / Histology', category: 'Lab & Diagnostics', group: 'pathology' },
  { key: 'pathology.report', label: 'Pathology Report', category: 'Lab & Diagnostics', group: 'pathology', hidden: true },

  // ── Operations ──
  // CSSD / Sterilization
  { key: 'cssd.view', label: 'CSSD / Sterilization', category: 'Operations', group: 'cssd' },
  { key: 'cssd.manage', label: 'CSSD Manage', category: 'Operations', group: 'cssd', hidden: true },

  // Equipment Maintenance
  { key: 'equipment.view', label: 'Equipment Management', category: 'Operations', group: 'equipment' },
  { key: 'equipment.manage', label: 'Equipment Manage', category: 'Operations', group: 'equipment', hidden: true },

  // Infection Control
  { key: 'infection_control.view', label: 'Infection Control', category: 'Operations', group: 'infection-control' },
  { key: 'infection_control.manage', label: 'Infection Control Manage', category: 'Operations', group: 'infection-control', hidden: true },
  { key: 'infection_control.isolation.view', label: 'Isolation Precautions', category: 'Operations', group: 'infection-control', hidden: true },
  { key: 'infection_control.hand-hygiene.view', label: 'Hand Hygiene Compliance', category: 'Operations', group: 'infection-control', hidden: true },
  { key: 'infection_control.stewardship.view', label: 'Antibiotic Stewardship', category: 'Operations', group: 'infection-control', hidden: true },
  { key: 'infection_control.outbreaks.view', label: 'Outbreak Management', category: 'Operations', group: 'infection-control', hidden: true },

  // ── Telemedicine ──
  { key: 'telemedicine.view', label: 'Telemedicine', category: 'Clinical Services', group: 'telemedicine' },
  { key: 'telemedicine.manage', label: 'Telemedicine Manage', category: 'Clinical Services', group: 'telemedicine', hidden: true },

  // ── Analytics ──
  { key: 'analytics.view', label: 'Analytics Dashboard', category: 'Administration', group: 'analytics' },


  // -- Specialty Modules --
  // Oncology
  { key: 'oncology.view', label: 'Oncology View', category: 'Specialty Modules', group: 'oncology' },
  { key: 'oncology.manage', label: 'Oncology Manage', category: 'Specialty Modules', group: 'oncology', hidden: true },

  // Psychiatry
  { key: 'psychiatry.view', label: 'Psychiatry View', category: 'Specialty Modules', group: 'psychiatry' },
  { key: 'psychiatry.manage', label: 'Psychiatry Manage', category: 'Specialty Modules', group: 'psychiatry', hidden: true },
  { key: 'psychiatry.restraints.view', label: 'Restraint/Seclusion Log', category: 'Specialty Modules', group: 'psychiatry', hidden: true },
  { key: 'psychiatry.risk-assessment.view', label: 'Suicide/Violence Risk Assessment', category: 'Specialty Modules', group: 'psychiatry', hidden: true },
  { key: 'psychiatry.mse.view', label: 'Mental Status Exam', category: 'Specialty Modules', group: 'psychiatry', hidden: true },

  // Transplant
  { key: 'transplant.view', label: 'Transplant View', category: 'Specialty Modules', group: 'transplant' },
  { key: 'transplant.manage', label: 'Transplant Manage', category: 'Specialty Modules', group: 'transplant', hidden: true },

  // ── Drug Formulary ──
  { key: 'formulary.view', label: 'Drug Formulary (View)', category: 'Admin', group: 'formulary' },
  { key: 'formulary.manage', label: 'Drug Formulary (Manage)', category: 'Admin', group: 'formulary', hidden: true },
  { key: 'formulary.approve', label: 'Drug Formulary (Approve Restrictions)', category: 'Admin', group: 'formulary', hidden: true },

  // ── Staff Credentialing ──
  { key: 'credentialing.view', label: 'Staff Credentialing (View)', category: 'Admin', group: 'credentialing' },
  { key: 'credentialing.manage', label: 'Staff Credentialing (Manage)', category: 'Admin', group: 'credentialing', hidden: true },
  { key: 'credentialing.verify', label: 'Staff Credentialing (Verify)', category: 'Admin', group: 'credentialing', hidden: true },

  // ── CBAHI Compliance ──
  { key: 'compliance.cbahi.view', label: 'CBAHI Compliance (View)', category: 'Quality', group: 'compliance-cbahi' },
  { key: 'compliance.cbahi.manage', label: 'CBAHI Compliance (Manage)', category: 'Quality', group: 'compliance-cbahi', hidden: true },
  { key: 'compliance.cbahi.audit', label: 'CBAHI Compliance (Audit)', category: 'Quality', group: 'compliance-cbahi', hidden: true },

  // ── Patient Transport ──
  { key: 'transport.view', label: 'Patient Transport', category: 'Operations', group: 'transport' },
  { key: 'transport.create', label: 'Transport Create', category: 'Operations', group: 'transport', hidden: true },
  { key: 'transport.manage', label: 'Transport Manage', category: 'Operations', group: 'transport', hidden: true },

  // ── ER: MCI Protocol ──
  { key: 'er.mci.view', label: 'MCI Dashboard', category: 'ER' },
  { key: 'er.mci.activate', label: 'MCI Activate', category: 'ER', group: 'er-mci', hidden: true },

  // ── ER: Triage Scoring ──
  { key: 'er.triage-scoring.view', label: 'Triage Scoring', category: 'ER' },
  { key: 'er.triage-scoring.edit', label: 'Triage Score Entry', category: 'ER', group: 'er-triage', hidden: true },

  // ── ICU: Brain Death Protocol ──
  { key: 'icu.brain-death.view', label: 'Brain Death Protocol', category: 'ICU' },
  { key: 'icu.brain-death.edit', label: 'Brain Death Management', category: 'ICU', group: 'icu-brain-death', hidden: true },

  // ── ICU: Organ Donation ──
  { key: 'icu.organ-donation.view', label: 'Organ Donation', category: 'ICU' },
  { key: 'icu.organ-donation.edit', label: 'Organ Donation Management', category: 'ICU', group: 'icu-organ', hidden: true },

  // ── Telemedicine: Video Visits ──
  { key: 'telemedicine.visits.view', label: 'Tele-Visits', category: 'Telemedicine' },
  { key: 'telemedicine.visits.edit', label: 'Tele-Visit Management', category: 'Telemedicine', group: 'tele-visits', hidden: true },

  // ── Telemedicine: E-Prescriptions ──
  { key: 'telemedicine.prescriptions.view', label: 'Tele-Prescriptions', category: 'Telemedicine' },

  // ── Telemedicine: RPM ──
  { key: 'telemedicine.rpm.view', label: 'Remote Patient Monitoring', category: 'Telemedicine' },
  { key: 'telemedicine.rpm.edit', label: 'RPM Management', category: 'Telemedicine', group: 'tele-rpm', hidden: true },

  // ── Scheduling: Multi-Resource Booking ──
  { key: 'scheduling.multi-resource.view', label: 'Multi-Resource Booking', category: 'Scheduling' },
  { key: 'scheduling.multi-resource.edit', label: 'Multi-Resource Management', category: 'Scheduling', group: 'sched-multi', hidden: true },

  // ── Scheduling: Waitlist ──
  { key: 'scheduling.waitlist.view', label: 'Waitlist Management', category: 'Scheduling' },
  { key: 'scheduling.waitlist.edit', label: 'Waitlist Actions', category: 'Scheduling', group: 'sched-waitlist', hidden: true },

  // ── Lab: Blood Gas Analysis ──
  { key: 'lab.blood-gas.view', label: 'Blood Gas Analysis', category: 'Lab' },
  { key: 'lab.blood-gas.edit', label: 'ABG Entry', category: 'Lab', group: 'lab-abg', hidden: true },

  // ── Lab: LIS Integration ──
  { key: 'lab.lis-dashboard.view', label: 'LIS Dashboard', category: 'Lab' },

  // ── Radiology: Peer Review ──
  { key: 'radiology.peer-review.view', label: 'Peer Review', category: 'Radiology' },
  { key: 'radiology.peer-review.edit', label: 'Peer Review Submit', category: 'Radiology', group: 'rad-peer', hidden: true },

  // ── Radiology: Prior Studies ──
  { key: 'radiology.prior-studies.view', label: 'Prior Studies', category: 'Radiology' },

  // ── Portal: Family Access ──
  { key: 'portal.family-access.view', label: 'Family/Proxy Access', category: 'Portal' },
  { key: 'portal.family-access.edit', label: 'Family Access Management', category: 'Portal', group: 'portal-family', hidden: true },

  // ── Dental: Periodontal ──
  { key: 'dental.periodontal.view', label: 'Periodontal Charting', category: 'Dental' },
  { key: 'dental.periodontal.edit', label: 'Periodontal Entry', category: 'Dental', group: 'dental-perio', hidden: true },

  // ── Dental: Orthodontics ──
  { key: 'dental.orthodontic.view', label: 'Orthodontics', category: 'Dental' },
  { key: 'dental.orthodontic.edit', label: 'Orthodontic Management', category: 'Dental', group: 'dental-ortho', hidden: true },

  // ── Nutrition: Kitchen ──
  { key: 'nutrition.kitchen.view', label: 'Kitchen Dashboard', category: 'Nutrition' },
  { key: 'nutrition.kitchen.edit', label: 'Kitchen Management', category: 'Nutrition', group: 'nutrition-kitchen', hidden: true },

  // ── Pharmacy: IV Admixture ──
  { key: 'pharmacy.iv-admixture.view', label: 'IV Admixture', category: 'Pharmacy' },
  { key: 'pharmacy.iv-admixture.edit', label: 'IV Admixture Management', category: 'Pharmacy', group: 'pharma-iv', hidden: true },

  // ── Pharmacy: ADC ──
  { key: 'pharmacy.adc.view', label: 'ADC Dashboard', category: 'Pharmacy' },
  { key: 'pharmacy.adc.edit', label: 'ADC Management', category: 'Pharmacy', group: 'pharma-adc', hidden: true },

  // ── OB/GYN: CTG ──
  { key: 'obgyn.ctg.view', label: 'CTG Monitoring', category: 'OB/GYN' },
  { key: 'obgyn.ctg.edit', label: 'CTG Recording', category: 'OB/GYN', group: 'obgyn-ctg', hidden: true },

  // ── Radiology: Speech Recognition ──
  { key: 'radiology.speech.view', label: 'Speech Recognition', category: 'Radiology' },
  { key: 'radiology.speech.edit', label: 'Speech Settings', category: 'Radiology', group: 'rad-speech', hidden: true },

  // ── CVision (Employee Lifecycle Management) ──
  // Dashboard
  { key: 'cvision.dashboard.view', label: 'CVision Dashboard', labelAr: 'لوحة تحكم CVision', category: 'CVision' },

  // Employees
  { key: 'cvision.employees.view', label: 'View Employees', labelAr: 'عرض الموظفين', category: 'CVision', group: 'cvision-employees' },
  { key: 'cvision.employees.create', label: 'Create Employee', labelAr: 'إضافة موظف', category: 'CVision', group: 'cvision-employees', hidden: true },
  { key: 'cvision.employees.edit', label: 'Edit Employee', labelAr: 'تعديل موظف', category: 'CVision', group: 'cvision-employees', hidden: true },
  { key: 'cvision.employees.delete', label: 'Delete Employee', labelAr: 'حذف موظف', category: 'CVision', group: 'cvision-employees', hidden: true },
  { key: 'cvision.employees.status', label: 'Change Employee Status', labelAr: 'تغيير حالة الموظف', category: 'CVision', group: 'cvision-employees', hidden: true },

  // Organization
  { key: 'cvision.org.view', label: 'View Organization', labelAr: 'عرض الهيكل التنظيمي', category: 'CVision', group: 'cvision-org' },
  { key: 'cvision.org.edit', label: 'Edit Organization', labelAr: 'تعديل الهيكل التنظيمي', category: 'CVision', group: 'cvision-org', hidden: true },

  // Attendance
  { key: 'cvision.attendance.view', label: 'View Attendance', labelAr: 'عرض الحضور', category: 'CVision', group: 'cvision-attendance' },
  { key: 'cvision.attendance.edit', label: 'Edit Attendance', labelAr: 'تعديل الحضور', category: 'CVision', group: 'cvision-attendance', hidden: true },
  { key: 'cvision.attendance.approve', label: 'Approve Attendance', labelAr: 'اعتماد الحضور', category: 'CVision', group: 'cvision-attendance', hidden: true },

  // Leaves
  { key: 'cvision.leaves.view', label: 'View Leaves', labelAr: 'عرض الإجازات', category: 'CVision', group: 'cvision-leaves' },
  { key: 'cvision.leaves.create', label: 'Request Leave', labelAr: 'طلب إجازة', category: 'CVision', group: 'cvision-leaves', hidden: true },
  { key: 'cvision.leaves.approve', label: 'Approve Leave', labelAr: 'اعتماد الإجازة', category: 'CVision', group: 'cvision-leaves', hidden: true },

  // Payroll
  { key: 'cvision.payroll.view', label: 'View Payroll', labelAr: 'عرض الرواتب', category: 'CVision', group: 'cvision-payroll' },
  { key: 'cvision.payroll.edit', label: 'Manage Payroll', labelAr: 'إدارة الرواتب', category: 'CVision', group: 'cvision-payroll', hidden: true },
  { key: 'cvision.payroll.approve', label: 'Approve Payroll', labelAr: 'اعتماد الرواتب', category: 'CVision', group: 'cvision-payroll', hidden: true },

  // Recruitment
  { key: 'cvision.recruitment.view', label: 'View Recruitment', labelAr: 'عرض التوظيف', category: 'CVision', group: 'cvision-recruitment' },
  { key: 'cvision.recruitment.edit', label: 'Manage Recruitment', labelAr: 'إدارة التوظيف', category: 'CVision', group: 'cvision-recruitment', hidden: true },
  { key: 'cvision.recruitment.approve', label: 'Approve Recruitment', labelAr: 'اعتماد التوظيف', category: 'CVision', group: 'cvision-recruitment', hidden: true },

  // Performance
  { key: 'cvision.performance.view', label: 'View Performance', labelAr: 'عرض الأداء', category: 'CVision', group: 'cvision-performance' },
  { key: 'cvision.performance.edit', label: 'Manage Performance', labelAr: 'إدارة الأداء', category: 'CVision', group: 'cvision-performance', hidden: true },

  // Training
  { key: 'cvision.training.view', label: 'View Training', labelAr: 'عرض التدريب', category: 'CVision', group: 'cvision-training' },
  { key: 'cvision.training.edit', label: 'Manage Training', labelAr: 'إدارة التدريب', category: 'CVision', group: 'cvision-training', hidden: true },

  // Requests
  { key: 'cvision.requests.view', label: 'View Requests', labelAr: 'عرض الطلبات', category: 'CVision', group: 'cvision-requests' },
  { key: 'cvision.requests.create', label: 'Create Request', labelAr: 'إنشاء طلب', category: 'CVision', group: 'cvision-requests', hidden: true },
  { key: 'cvision.requests.approve', label: 'Approve Request', labelAr: 'اعتماد الطلبات', category: 'CVision', group: 'cvision-requests', hidden: true },

  // Analytics
  { key: 'cvision.analytics.view', label: 'CVision Analytics', labelAr: 'تحليلات CVision', category: 'CVision' },

  // Admin
  { key: 'cvision.admin.view', label: 'CVision Admin', labelAr: 'إدارة CVision', category: 'CVision', group: 'cvision-admin' },
  { key: 'cvision.admin.edit', label: 'CVision Admin Edit', labelAr: 'تعديل إعدادات CVision', category: 'CVision', group: 'cvision-admin', hidden: true },
];