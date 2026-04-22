/**
 * Map routes to permission keys
 */
export const ROUTE_PERMISSIONS: Record<string, string> = {
  '/dashboard': 'dashboard.view',
  '/notifications': 'notifications.view',
  '/registration': 'registration.view',
  '/registration/insurance': 'registration.view',
  '/search': 'patients.search.view',
  '/patients': 'patients.master.view',
  '/patient': 'patients.master.view',
  '/patient/360': 'patients.master.view',
  '/patient/journey': 'patients.master.view',
  '/patient/growth': 'patients.growth.view',
  '/departments': 'registration.view',

  // ── OPD ──
  '/opd/dashboard': 'opd.dashboard.view',
  '/opd/home': 'opd.dashboard.view',
  '/opd/register': 'opd.dashboard.view',
  '/opd/encounter': 'opd.dashboard.view',
  '/opd/registration': 'opd.visit.create',
  '/opd/appointments': 'scheduling.view',
  '/opd/waiting-list': 'opd.queue.view',
  '/opd/nurse-station': 'opd.nursing.view',
  '/opd/doctor-worklist': 'opd.doctor.encounter.view',
  '/opd/doctor-station': 'opd.doctor.encounter.view',
  '/opd/visit': 'opd.visit.view',
  '/opd/visit-lookup': 'opd.visit.view',
  '/opd/doctor/schedule': 'opd.doctor.encounter.view',
  '/opd/booking': 'scheduling.view',
  '/opd/day': 'scheduling.view',
  '/opd/analytics': 'opd.analytics.view',
  '/opd/care-gaps': 'care-gaps.view',
  '/referrals': 'opd.visit.view',

  // ── Scheduling (admin-level management, accessible via direct URL) ──
  '/scheduling': 'scheduling.view',
  '/scheduling/resources': 'scheduling.view',
  '/scheduling/templates': 'scheduling.view',
  '/scheduling/calendar': 'scheduling.view',
  '/scheduling/scheduling': 'scheduling.view',
  '/scheduling/availability': 'scheduling.availability.view',

  // ── ER ──
  '/er/register': 'er.register.view',
  '/er/board': 'er.board.view',
  '/er/command': 'er.board.view',
  '/er/metrics': 'er.board.view',
  '/er/notifications': 'er.board.view',
  '/er/nursing': 'er.nursing.view',
  '/er/nurse-station': 'er.nursing.view',
  '/er/respiratory-screen': 'er.nursing.view',
  '/er/doctor': 'er.doctor.view',
  '/er/results-console': 'er.doctor.view',
  '/er/charge': 'er.doctor.view',
  '/er/triage': 'er.triage.view',
  '/er/beds': 'er.beds.view',
  '/er/encounter': 'er.encounter.view',

  // ── Orders ──
  '/orders': 'orders.hub.view',
  '/orders/sets': 'order.sets.view',
  '/results': 'results.inbox.view',
  '/tasks': 'tasks.queue.view',
  '/handover': 'handover.view',

  // ── Billing ──
  '/billing/charge-catalog': 'billing.view',
  '/billing/charge-events': 'billing.view',
  '/billing/statement': 'billing.view',
  '/billing/insurance': 'billing.view',
  '/billing/claims': 'billing.view',
  '/billing/cashier': 'billing.view',
  '/billing/pending-orders': 'billing.view',
  '/billing/insurance-verify': 'billing.view',
  '/billing/medication-catalog': 'billing.view',
  '/billing/diagnosis-catalog': 'billing.view',
  '/billing/lab-catalog': 'billing.view',
  '/billing/radiology-catalog': 'billing.view',
  '/billing/procedure-catalog': 'billing.view',
  '/billing/service-catalog': 'billing.view',
  '/billing/supplies-catalog': 'billing.view',
  '/billing/pricing-packages': 'billing.view',
  '/billing/invoice-draft': 'billing.invoice.view',
  '/billing/payments': 'billing.payment.view',
  '/billing/revenue-cycle': 'billing.view',
  '/billing/nphies-dashboard': 'billing.view',

  // ── Quality ──
  '/quality': 'quality.view',
  '/quality/incidents': 'quality.view',
  '/quality/kpis': 'quality.view',
  '/quality/rca': 'quality.rca.view',
  '/quality/mortality-review': 'quality.view',

  // ── IPD ──
  '/ipd': 'ipd.live-beds.view',
  '/ipd/bed-setup': 'ipd.bed-setup.view',
  '/ipd/live-beds': 'ipd.live-beds.view',
  '/ipd/inpatient-dept-input': 'ipd.dept-input.view',
  '/ipd/intake': 'ipd.live-beds.view',
  '/ipd/episode': 'ipd.live-beds.view',
  '/ipd/episodes': 'ipd.live-beds.view',
  '/ipd/nurse-station': 'ipd.live-beds.view',
  '/ipd/doctor-station': 'ipd.doctor-station.view',
  '/ipd/audit': 'ipd.live-beds.view',
  '/ipd/ward-board': 'ipd.live-beds.view',
  '/ipd/discharge-summary': 'ipd.live-beds.view',

  // ── Admission Office ──
  '/admission-office': 'admission.view',
  '/admission-office/': 'admission.view',

  // Admission Office — Financial API routes
  '/api/admission/requests/set-payment-type': 'admission.manage',
  '/api/admission/requests/estimate-cost': 'admission.manage',
  '/api/admission/requests/verify-insurance': 'admission.manage',
  '/api/admission/requests/collect-deposit': 'admission.collect_payment',
  '/api/admission/requests/financial-summary': 'admission.view',
  '/api/admission/requests/request-preauth': 'admission.manage',

  // ── OR / ICU / Mortuary ──
  '/or/cases': 'or.view',
  '/or/schedule': 'or.schedule.view',
  '/or/nurse-station': 'or.nursing.view',
  '/or/pre-op': 'or.preop.view',
  '/or/surgeon-station': 'or.view',
  '/or/operative-notes': 'or.view',
  '/or/post-op-orders': 'or.view',
  '/or': 'or.view',
  '/icu': 'icu.view',
  '/icu/nurse-station': 'icu.view',
  '/icu/episode': 'icu.view',
  '/icu/doctor-station': 'icu.doctor-station.view',
  '/icu/apache-score': 'icu.view',
  '/icu/sedation': 'icu.view',
  '/icu/delirium': 'icu.view',
  '/icu/bundles': 'icu.view',
  '/icu/code-blue': 'icu.view',
  '/mortuary': 'mortuary.view',
  '/handoff': 'er.board.view',

  // ── Document System / SAM ──
  '/integrity': 'policies.conflicts.view',
  '/alignment': 'policies.harmonization.view',
  '/risk-detector': 'policies.risk-detector.view',
  '/ai/policy-harmonization': 'policies.harmonization.view',

  // ── Admin ──
  '/admin/data-admin': 'admin.data-admin.view',
  '/admin/dashboard': 'admin.data-admin.view',
  '/admin/audit-coverage': 'admin.data-admin.view',
  '/admin/clinical-infra': 'admin.data-admin.view',
  '/admin/clinical-infra/beds': 'admin.data-admin.view',
  '/admin/clinical-infra/clinics': 'admin.data-admin.view',
  '/admin/clinical-infra/facilities': 'admin.data-admin.view',
  '/admin/clinical-infra/floors': 'admin.data-admin.view',
  '/admin/clinical-infra/providers': 'admin.data-admin.view',
  '/admin/clinical-infra/rooms': 'admin.data-admin.view',
  '/admin/clinical-infra/specialties': 'admin.data-admin.view',
  '/admin/clinical-infra/units': 'admin.data-admin.view',
  '/admin/doctors/onboard': 'admin.data-admin.view',
  '/admin/organization-profile': 'admin.data-admin.view',
  '/admin/clinical-settings': 'admin.data-admin.view',
  '/admin/groups-hospitals': 'admin.groups-hospitals.view',
  '/admin/users': 'admin.users.view',
  '/admin/roles': 'admin.users.view',
  '/admin/admin': 'admin.admin.view',
  '/admin/quotas': 'admin.quotas.view',
  '/admin/structure-management': 'admin.structure-management.view',
  '/admin/delete-sample-data': 'admin.delete-sample-data.view',
  '/admin/ai-settings': 'admin.data-admin.view',
  '/admin/dicom-sources': 'admin.data-admin.view',
  '/admin/instruments': 'admin.data-admin.view',
  '/admin/integration-log': 'admin.data-admin.view',
  '/admin/escalation': 'admin.data-admin.view',
  '/admin/order-sets': 'admin.data-admin.view',
  '/admin/pathways': 'admin.data-admin.view',
  '/admin/routing-rules': 'admin.data-admin.view',
  '/admin/consumable-stores': 'admin.data-admin.view',
  '/admin/consumable-templates': 'admin.data-admin.view',
  '/admin/consumable-reports': 'admin.data-admin.view',
  '/admin/reminders': 'admin.data-admin.view',
  '/admin/api-docs': 'admin.data-admin.view',

  // ── Radiology, Lab, Pharmacy, Dental ──
  '/radiology': 'radiology.view',
  '/radiology/reception': 'radiology.view',
  '/radiology/studies': 'radiology.view',
  '/radiology/reporting': 'radiology.view',
  '/radiology/patient-lookup': 'radiology.view',
  '/radiology/worklist': 'radiology.view',
  '/radiology/structured-reporting': 'radiology.view',
  '/radiology/critical-findings': 'radiology.view',
  '/lab': 'lab.view',
  '/lab/reception': 'lab.view',
  '/lab/results': 'lab.view',
  '/lab/collection': 'lab.view',
  '/lab/dashboard': 'lab.view',
  '/lab/qc': 'lab.view',
  '/lab/patient-lookup': 'lab.view',
  '/lab/microbiology': 'lab.view',
  '/lab/tat': 'lab.view',
  '/lab/critical-alerts': 'lab.view',
  '/pharmacy': 'pharmacy.view',
  '/pharmacy/reception': 'pharmacy.view',
  '/pharmacy/inventory': 'pharmacy.view',
  '/pharmacy/dispensing': 'pharmacy.view',
  '/pharmacy/patient-lookup': 'pharmacy.view',
  '/pharmacy/reports': 'pharmacy.view',
  '/pharmacy/unit-dose': 'pharmacy.view',
  '/pharmacy/controlled-substances': 'pharmacy.view',
  '/pharmacy/verification': 'pharmacy.view',
  '/dental': 'patients.master.view',
  '/dental/patients': 'patients.master.view',
  '/dental/procedures': 'patients.master.view',
  '/dental/chart': 'patients.master.view',
  '/dental/treatment': 'patients.master.view',

  // ── OBGYN, Settings ──
  '/obgyn': 'patients.master.view',
  '/obgyn/patients': 'patients.master.view',
  '/obgyn/antenatal': 'patients.master.view',
  '/obgyn/labor': 'patients.master.view',
  '/obgyn/postpartum': 'patients.master.view',
  '/obgyn/labor-nurse-station': 'patients.master.view',
  '/obgyn/labor-doctor-station': 'patients.master.view',
  '/obgyn/partogram': 'patients.master.view',
  '/obgyn/newborn': 'patients.master.view',
  '/settings/security': 'account.view',

  // ── Downtime ──
  '/downtime/pack': 'admin.data-admin.view',

  // Account
  '/account': 'account.view',

  // ── Clinical Services ──
  '/physiotherapy': 'physiotherapy.view',
  '/physiotherapy/': 'physiotherapy.view',
  '/consults': 'consults.view',
  '/consults/': 'consults.view',
  '/wound-care': 'wound_care.view',
  '/wound-care/': 'wound_care.view',
  '/nutrition': 'nutrition.view',
  '/nutrition/': 'nutrition.view',
  '/nutrition/dietary-orders': 'nutrition.view',
  '/nutrition/dietary-orders/': 'nutrition.view',
  '/social-work': 'social_work.view',
  '/social-work/': 'social_work.view',
  '/patient-education': 'patient_education.view',
  '/patient-education/': 'patient_education.view',

  // ── Lab & Diagnostics ──
  '/blood-bank': 'blood_bank.view',
  '/blood-bank/': 'blood_bank.view',
  '/blood-bank/crossmatch': 'blood_bank.view',
  '/blood-bank/inventory': 'blood_bank.view',
  '/pathology': 'pathology.view',
  '/pathology/': 'pathology.view',

  // ── Operations ──
  '/cssd': 'cssd.view',
  '/cssd/': 'cssd.view',
  '/equipment-mgmt': 'equipment.view',
  '/equipment-mgmt/': 'equipment.view',
  '/infection-control': 'infection_control.view',
  '/infection-control/': 'infection_control.view',
  '/infection-control/isolation': 'infection_control.view',
  '/infection-control/hand-hygiene': 'infection_control.view',
  '/infection-control/stewardship': 'infection_control.view',
  '/infection-control/outbreaks': 'infection_control.view',

  // ── Telemedicine ──
  '/telemedicine': 'telemedicine.view',
  '/telemedicine/': 'telemedicine.view',

  // ── Analytics ──
  '/analytics': 'analytics.view',
  '/analytics/': 'analytics.view',


  // -- Specialty Modules --
  '/oncology': 'oncology.view',
  '/oncology/': 'oncology.view',
  '/psychiatry': 'psychiatry.view',
  '/psychiatry/': 'psychiatry.view',
  '/psychiatry/restraints': 'psychiatry.view',
  '/psychiatry/risk-assessment': 'psychiatry.view',
  '/psychiatry/mse': 'psychiatry.view',
  '/transplant': 'transplant.view',
  '/transplant/': 'transplant.view',

  // ── Drug Formulary ──
  '/admin/formulary': 'formulary.view',
  '/admin/formulary/': 'formulary.view',

  // ── Staff Credentialing ──
  '/admin/credentialing': 'credentialing.view',
  '/admin/credentialing/': 'credentialing.view',

  // ── CBAHI Compliance ──
  '/admin/compliance': 'compliance.cbahi.view',
  '/admin/compliance/': 'compliance.cbahi.view',

  // ── Patient Transport ──
  '/transport': 'transport.view',
  '/transport/': 'transport.view',

  // ── ER: MCI ──
  '/er/mci': 'er.mci.view',
  '/er/mci/': 'er.mci.view',

  // ── ER: Triage Scoring ──
  '/er/triage/scoring': 'er.triage-scoring.view',
  '/er/triage/scoring/': 'er.triage-scoring.view',

  // ── ICU: Brain Death ──
  '/icu/brain-death': 'icu.brain-death.view',
  '/icu/brain-death/': 'icu.brain-death.view',

  // ── ICU: Organ Donation ──
  '/icu/organ-donation': 'icu.organ-donation.view',
  '/icu/organ-donation/': 'icu.organ-donation.view',

  // ── Telemedicine: Visits ──
  '/telemedicine/visits': 'telemedicine.visits.view',
  '/telemedicine/visits/': 'telemedicine.visits.view',

  // ── Telemedicine: Prescriptions ──
  '/telemedicine/prescriptions': 'telemedicine.prescriptions.view',
  '/telemedicine/prescriptions/': 'telemedicine.prescriptions.view',

  // ── Telemedicine: RPM ──
  '/telemedicine/rpm': 'telemedicine.rpm.view',
  '/telemedicine/rpm/': 'telemedicine.rpm.view',

  // ── Scheduling: Multi-Resource ──
  '/scheduling/multi-resource': 'scheduling.multi-resource.view',
  '/scheduling/multi-resource/': 'scheduling.multi-resource.view',

  // ── Scheduling: Waitlist ──
  '/scheduling/waitlist': 'scheduling.waitlist.view',
  '/scheduling/waitlist/': 'scheduling.waitlist.view',

  // ── Lab: Blood Gas ──
  '/lab/blood-gas': 'lab.blood-gas.view',
  '/lab/blood-gas/': 'lab.blood-gas.view',

  // ── Lab: LIS Dashboard ──
  '/lab/lis-dashboard': 'lab.lis-dashboard.view',
  '/lab/lis-dashboard/': 'lab.lis-dashboard.view',

  // ── Radiology: Peer Review ──
  '/radiology/peer-review': 'radiology.peer-review.view',
  '/radiology/peer-review/': 'radiology.peer-review.view',

  // ── Radiology: Prior Studies ──
  '/radiology/prior-studies': 'radiology.prior-studies.view',
  '/radiology/prior-studies/': 'radiology.prior-studies.view',

  // ── Dental: Periodontal ──
  '/dental/periodontal': 'dental.periodontal.view',
  '/dental/periodontal/': 'dental.periodontal.view',

  // ── Dental: Orthodontics ──
  '/dental/orthodontic': 'dental.orthodontic.view',
  '/dental/orthodontic/': 'dental.orthodontic.view',

  // ── Nutrition: Kitchen ──
  '/nutrition/kitchen': 'nutrition.kitchen.view',
  '/nutrition/kitchen/': 'nutrition.kitchen.view',

  // ── Pharmacy: IV Admixture ──
  '/pharmacy/iv-admixture': 'pharmacy.iv-admixture.view',
  '/pharmacy/iv-admixture/': 'pharmacy.iv-admixture.view',

  // ── Pharmacy: ADC ──
  '/pharmacy/adc': 'pharmacy.adc.view',
  '/pharmacy/adc/': 'pharmacy.adc.view',

  // ── OB/GYN: CTG ──
  '/obgyn/ctg': 'obgyn.ctg.view',
  '/obgyn/ctg/': 'obgyn.ctg.view',

  // ── Radiology: Speech Settings ──
  '/radiology/speech-settings': 'radiology.speech.view',
  '/radiology/speech-settings/': 'radiology.speech.view',

  // ── CVision (Employee Lifecycle Management) ──
  '/cvision': 'cvision.dashboard.view',
  '/cvision/dashboard': 'cvision.dashboard.view',
  '/cvision/employees': 'cvision.employees.view',
  '/cvision/attendance': 'cvision.attendance.view',
  '/cvision/leaves': 'cvision.leaves.view',
  '/cvision/payroll': 'cvision.payroll.view',
  '/cvision/recruitment': 'cvision.recruitment.view',
  '/cvision/organization': 'cvision.org.view',
  '/cvision/contracts': 'cvision.employees.view',
  '/cvision/self-service': 'cvision.requests.view',
  '/cvision/directory': 'cvision.employees.view',
  '/cvision/requests': 'cvision.requests.view',
  '/cvision/performance': 'cvision.performance.view',
  '/cvision/training': 'cvision.training.view',
  '/cvision/onboarding': 'cvision.employees.view',
  '/cvision/disciplinary': 'cvision.employees.view',
  '/cvision/promotions': 'cvision.employees.view',
  '/cvision/compensation': 'cvision.payroll.view',
  '/cvision/insurance': 'cvision.employees.view',
  '/cvision/letters': 'cvision.employees.view',
  '/cvision/scheduling': 'cvision.attendance.view',
  '/cvision/communications': 'cvision.admin.view',
  '/cvision/announcements': 'cvision.admin.view',
  '/cvision/travel': 'cvision.requests.view',
  '/cvision/grievances': 'cvision.requests.view',
  '/cvision/assets': 'cvision.admin.view',
  '/cvision/housing': 'cvision.admin.view',
  '/cvision/transport': 'cvision.admin.view',
  '/cvision/safety': 'cvision.admin.view',
  '/cvision/analytics': 'cvision.analytics.view',
  '/cvision/bi': 'cvision.analytics.view',
  '/cvision/headcount': 'cvision.analytics.view',
  '/cvision/succession': 'cvision.analytics.view',
  '/cvision/okrs': 'cvision.performance.view',
  '/cvision/compliance': 'cvision.admin.view',
  '/cvision/settings': 'cvision.admin.view',
  '/cvision/access-control': 'cvision.admin.view',
  '/cvision/integrations': 'cvision.admin.view',
  '/cvision/workflows': 'cvision.admin.view',
  '/cvision/dashboards': 'cvision.analytics.view',
};