'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useMe } from '@/lib/hooks/useMe';
import { usePlatform } from '@/lib/hooks/usePlatform';
import { hasRoutePermission } from '@/lib/permissions';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { translations } from '@/lib/i18n';
import type { LucideIcon } from 'lucide-react';

/** Index-signature interface for nav translation keys */
interface NavTranslationKeys {
  [key: string]: string | undefined;
}

/** Translation tree shape passed to getNavItems */
interface TranslationInput {
  nav?: NavTranslationKeys;
  [key: string]: unknown;
}

// NavItem type — self-contained, no dependency on old Sidebar
export interface NavItem {
  title: string;
  href?: string;
  icon: LucideIcon;
  children?: NavItem[];
  area?: string;
}

// ── Nav item builder (mirrors Sidebar.tsx getNavItems) ──

import {
  ClipboardList,
  ClipboardCheck,
  Search,
  AlertCircle,
  Activity,
  Bed,
  Stethoscope,
  FileText,
  Users,
  BarChart3,
  Bell,
  Home,
  UserPlus,
  Calendar,
  Clock,
  Heart,
  Send,
  UserCircle,
  Settings,
  LayoutDashboard,
  Building2,
  AlertTriangle,
  Scissors,
  Dumbbell,
  MessageSquare,
  Bandage,
  Apple,
  HandHeart,
  GraduationCap,
  Droplets,
  Microscope,
  Wind,
  ShieldAlert,
  ShieldCheck,
  Wrench,
  FlaskConical,
  Baby,
  Pill,
  Lock,
  Zap,
  Brain,
  Timer,
  DollarSign,
  Siren,
  Biohazard,
  HandMetal,
  TestTube,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

function getNavItems(t: TranslationInput): NavItem[] {
  const nav: NavTranslationKeys = (t?.nav || translations.ar.nav) as NavTranslationKeys;

  return [
    {
      title: nav.registration || 'Patient Master',
      icon: ClipboardList,
      area: 'registration',
      children: [
        { title: nav.registration || 'Patient Master', href: '/registration', icon: ClipboardList },
        { title: nav.patientRecords || 'Patient Records', href: '/search', icon: Search },
      ],
    },
    {
      title: nav.er || 'Emergency Room',
      icon: AlertCircle,
      area: 'er',
      children: [
        { title: nav.erRegister || 'Registration', href: '/er/register', icon: AlertCircle },
        { title: nav.erBoard || 'Tracking Board', href: '/er/board', icon: Activity },
        { title: nav.erBeds || 'Beds', href: '/er/beds', icon: Bed },
        { title: nav.erNursing || 'Nursing Hub', href: '/er/nursing', icon: ClipboardList },
        { title: nav.erDoctor || 'Doctor Hub', href: '/er/doctor', icon: Stethoscope },
        { title: nav.erResultsConsole || 'Results Console', href: '/er/results-console', icon: FileText },
        { title: nav.erCharge || 'Charge Console', href: '/er/charge', icon: Users },
        { title: nav.erCommand || 'ER Command', href: '/er/command', icon: BarChart3 },
        { title: nav.erAlerts || 'ER Alerts', href: '/er/notifications', icon: Bell },
        { title: nav.erMetrics || 'Metrics', href: '/er/metrics', icon: BarChart3 },
        { title: nav.erTriage || 'Triage', href: '/er/triage', icon: Activity },
        { title: nav.erRespiratoryScreen || 'Respiratory Screen', href: '/er/respiratory-screen', icon: AlertCircle },
      ],
    },
    {
      title: nav.opd || 'OPD',
      icon: Stethoscope,
      area: 'opd',
      children: [
        { title: nav.opdHome || 'Home', href: '/opd/home', icon: Home },
        { title: nav.opdDashboard || 'OPD Dashboard', href: '/opd/dashboard', icon: LayoutDashboard },
        { title: nav.opdRegistration || 'Visit Registration', href: '/opd/registration', icon: UserPlus },
        { title: nav.opdAppointments || 'Appointments', href: '/opd/appointments', icon: Calendar },
        { title: nav.opdWaitingList || 'Waiting List', href: '/opd/waiting-list', icon: Clock },
        { title: nav.opdNurseStation || 'Nurse Station', href: '/opd/nurse-station', icon: Heart },
        { title: nav.opdDoctorStation || 'Doctor Station', href: '/opd/doctor-station', icon: Stethoscope },
        { title: nav.opdVisitLookup || 'Visit Lookup', href: '/opd/visit-lookup', icon: Search },
        { title: nav.opdReferrals || 'Referrals', href: '/referrals', icon: Send },
        { title: nav.opdAnalytics || 'Analytics', href: '/opd/analytics', icon: BarChart3 },
        { title: nav.careGaps || 'Care Gaps', href: '/opd/care-gaps', icon: AlertTriangle },
      ],
    },
    {
      title: nav.ipd || 'Inpatient Department',
      icon: Bed,
      area: 'ipd',
      children: [
        { title: nav.admissionOffice || 'Admission Office', href: '/admission-office', icon: ClipboardCheck },
        { title: nav.ipdEpisodes || 'IPD Episodes', href: '/ipd/episodes', icon: Bed },
        { title: nav.ipdLiveBeds || 'IPD Live Beds', href: '/ipd/live-beds', icon: Bed },
        { title: nav.bedSetup || 'Bed Setup', href: '/ipd/bed-setup', icon: Bed },
        { title: nav.ipdIntake || 'IPD Intake', href: '/ipd/intake', icon: ClipboardList },
        { title: nav.departmentInput || 'Department Input', href: '/ipd/inpatient-dept-input', icon: FileText },
        { title: nav.ipdNurseStation || 'Nurse Station', href: '/ipd/nurse-station', icon: Heart },
        { title: nav.ipdDoctorStation || 'Doctor Station', href: '/ipd/doctor-station', icon: Stethoscope },
        { title: nav.ipdAudit || 'Audit Trail', href: '/ipd/audit', icon: FileText },
        { title: nav.ipdWardBoard || 'Ward Board', href: '/ipd/ward-board', icon: LayoutDashboard },
        { title: nav.ipdDischargeSummary || 'Discharge Summary', href: '/ipd/discharge-summary', icon: FileText },
      ],
    },
    {
      title: nav.orders || nav.ordersHub || 'Orders',
      icon: ClipboardList,
      area: 'orders',
      children: [
        { title: nav.ordersHub || 'Orders Hub', href: '/orders', icon: ClipboardList },
        { title: nav.orderSets || 'Order Sets', href: '/orders/sets', icon: ClipboardList },
        { title: nav.resultsInbox || 'Results Inbox', href: '/results', icon: ClipboardList },
        { title: nav.tasksQueue || 'Tasks Queue', href: '/tasks', icon: ClipboardList },
        { title: nav.handover || 'Handover', href: '/handover', icon: ClipboardList },
      ],
    },
    {
      title: nav.scheduling || nav.schedulingCore || 'Scheduling',
      href: '/scheduling',
      icon: Calendar,
      area: 'opd',
    },
    {
      title: nav.billing || 'Billing',
      icon: FileText,
      area: 'billing',
      children: [
        { title: nav.chargeCatalog || 'Charge Catalog', href: '/billing/charge-catalog', icon: FileText },
        { title: nav.medicationCatalog || 'Medication Catalog', href: '/billing/medication-catalog', icon: FileText },
        { title: nav.diagnosisCatalog || 'Diagnosis Catalog', href: '/billing/diagnosis-catalog', icon: FileText },
        { title: nav.labCatalog || 'Lab Catalog', href: '/billing/lab-catalog', icon: FileText },
        { title: nav.radiologyCatalog || 'Radiology Catalog', href: '/billing/radiology-catalog', icon: FileText },
        { title: nav.procedureCatalog || 'Procedure Catalog', href: '/billing/procedure-catalog', icon: FileText },
        { title: nav.suppliesCatalog || 'Supplies Catalog', href: '/billing/supplies-catalog', icon: FileText },
        { title: nav.serviceCatalog || 'Service Catalog', href: '/billing/service-catalog', icon: FileText },
        { title: nav.pricingPackages || 'Pricing Packages', href: '/billing/pricing-packages', icon: FileText },
        { title: nav.chargeEvents || 'Charge Events', href: '/billing/charge-events', icon: FileText },
        { title: nav.chargeStatement || 'Statement', href: '/billing/statement', icon: FileText },
        { title: nav.invoiceDraft || 'Invoice Draft', href: '/billing/invoice-draft', icon: FileText },
        { title: nav.payments || 'Payments', href: '/billing/payments', icon: FileText },
        { title: nav.cashier || 'Cashier', href: '/billing/cashier', icon: FileText },
        { title: nav.pendingOrders || 'Pending Orders', href: '/billing/pending-orders', icon: Clock },
        { title: nav.insurance || 'Insurance', href: '/billing/insurance', icon: FileText },
        { title: nav.insuranceVerify || 'Insurance Verify', href: '/billing/insurance-verify', icon: FileText },
        { title: nav.claims || 'Claims', href: '/billing/claims', icon: FileText },
        { title: nav.billingRevenueCycle || 'Revenue Cycle', href: '/billing/revenue-cycle', icon: DollarSign },
        { title: nav.billingNphiesDashboard || 'NPHIES Dashboard', href: '/billing/nphies-dashboard', icon: BarChart3 },
      ],
    },
    {
      title: nav.quality || 'Quality',
      icon: Heart,
      area: 'quality',
      children: [
        { title: nav.qualityIncidents || 'Incidents', href: '/quality/incidents', icon: AlertTriangle },
        { title: nav.qualityKpis || 'KPIs', href: '/quality/kpis', icon: BarChart3 },
        { title: nav.qualityRca || 'RCA / FMEA', href: '/quality/rca', icon: FileText },
      ],
    },
    {
      title: nav.account || 'Account',
      href: '/account',
      icon: UserCircle,
    },
    {
      title: nav.admin || 'Admin',
      icon: Settings,
      children: [
        { title: nav.adminDashboard || 'Admin Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
        { title: nav.users || 'Users', href: '/admin/users', icon: Users },
        { title: nav.roles || 'Roles', href: '/admin/roles', icon: Users },
        { title: nav.doctorsOnboard || 'Doctors Onboard', href: '/admin/doctors/onboard', icon: Stethoscope },
        { title: nav.groupsHospitals || 'Groups & Hospitals', href: '/admin/groups-hospitals', icon: Building2 },
        { title: nav.structureManagement || 'Structure Management', href: '/admin/structure-management', icon: Building2 },
        { title: nav.organizationProfile || 'Organization Profile', href: '/admin/organization-profile', icon: Building2 },
        { title: nav.quotas || 'Demo Quotas', href: '/admin/quotas', icon: ClipboardList },
        { title: nav.deleteSampleData || 'Delete Sample Data', href: '/admin/delete-sample-data', icon: FileText },
        { title: nav.auditCoverage || 'Audit Coverage', href: '/admin/audit-coverage', icon: FileText },
        { title: nav.clinicalInfra || 'Clinical Infrastructure', href: '/admin/clinical-infra', icon: Building2 },
        { title: nav.clinicalSettings || 'Clinical Settings', href: '/admin/clinical-settings', icon: Settings },
        { title: nav.credentialing || 'Staff Credentialing', href: '/admin/credentialing', icon: ShieldCheck },
        { title: nav.downtimePack || 'Downtime Pack', href: '/downtime/pack', icon: Clock },
        { title: nav.apiDocs || 'API Documentation', href: '/admin/api-docs', icon: FileText },
      ],
    },
    {
      title: nav.dashboard || 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: nav.notifications || 'Notifications',
      href: '/notifications',
      icon: Bell,
    },
    {
      title: nav.mortuary || 'Mortuary',
      href: '/mortuary',
      icon: Bed,
    },
    {
      title: nav.departments || 'Departments',
      href: '/departments',
      icon: Building2,
    },
    {
      title: nav.radiology || 'Radiology',
      icon: FileText,
      area: 'orders',
      children: [
        { title: nav.radiologyReception || 'Reception', href: '/radiology/reception', icon: ClipboardList },
        { title: nav.radiologyStudies || 'Studies', href: '/radiology/studies', icon: FileText },
        { title: nav.radiologyReporting || 'Reporting', href: '/radiology/reporting', icon: FileText },
        { title: nav.radiologyPatientLookup || 'Patient Lookup', href: '/radiology/patient-lookup', icon: Search },
        { title: nav.radiologyWorklist || 'Worklist', href: '/radiology/worklist', icon: ClipboardList },
        { title: nav.radiologyStructuredReporting || 'Structured Reporting', href: '/radiology/structured-reporting', icon: FileText },
        { title: nav.radiologyCriticalFindings || 'Critical Findings', href: '/radiology/critical-findings', icon: AlertTriangle },
      ],
    },
    {
      title: nav.lab || 'Lab',
      icon: FileText,
      area: 'orders',
      children: [
        { title: nav.labReception || 'Reception', href: '/lab/reception', icon: ClipboardList },
        { title: nav.labResults || 'Results', href: '/lab/results', icon: FileText },
        { title: nav.labCollection || 'Collection', href: '/lab/collection', icon: ClipboardList },
        { title: nav.labPatientLookup || 'Patient Lookup', href: '/lab/patient-lookup', icon: Search },
        { title: nav.labDashboard || 'Dashboard', href: '/lab/dashboard', icon: LayoutDashboard },
        { title: nav.labQc || 'QC Module', href: '/lab/qc', icon: FlaskConical },
        { title: nav.labMicrobiology || 'Microbiology', href: '/lab/microbiology', icon: TestTube },
        { title: nav.labTat || 'TAT Dashboard', href: '/lab/tat', icon: Timer },
        { title: nav.labCriticalAlerts || 'Critical Alerts', href: '/lab/critical-alerts', icon: AlertTriangle },
      ],
    },
    {
      title: nav.pharmacy || 'Pharmacy',
      icon: FileText,
      area: 'orders',
      children: [
        { title: nav.pharmacyDashboard || 'Dashboard', href: '/pharmacy', icon: FileText },
        { title: nav.pharmacyReception || 'Reception', href: '/pharmacy/reception', icon: ClipboardList },
        { title: nav.pharmacyDispensing || 'Dispensing', href: '/pharmacy/dispensing', icon: FileText },
        { title: nav.pharmacyInventory || 'Inventory', href: '/pharmacy/inventory', icon: FileText },
        { title: nav.pharmacyPatientLookup || 'Patient Lookup', href: '/pharmacy/patient-lookup', icon: Search },
        { title: nav.pharmacyReports || 'Reports', href: '/pharmacy/reports', icon: FileText },
        { title: nav.pharmacyUnitDose || 'Unit Dose', href: '/pharmacy/unit-dose', icon: Pill },
        { title: nav.pharmacyControlledSubstances || 'Controlled Substances', href: '/pharmacy/controlled-substances', icon: Lock },
        { title: nav.pharmacyVerification || 'Rx Verification', href: '/pharmacy/verification', icon: ShieldCheck },
      ],
    },
    {
      title: nav.obgyn || 'OBGYN',
      icon: Heart,
      area: 'opd',
      children: [
        { title: nav.obgynPatients || 'Patients', href: '/obgyn/patients', icon: Users },
        { title: nav.laborNurseStation || 'Nursing Station', href: '/obgyn/labor-nurse-station', icon: Activity },
        { title: nav.laborDoctorStation || 'Doctor Station', href: '/obgyn/labor-doctor-station', icon: Stethoscope },
        { title: nav.obgynNewborn || 'Newborn / NICU', href: '/obgyn/newborn', icon: Baby },
      ],
    },
    {
      title: nav.or || 'Operating Room',
      icon: Scissors,
      area: 'er',
      children: [
        { title: nav.orCases || 'OR Cases', href: '/or/cases', icon: ClipboardList },
        { title: nav.orPreOp || 'Pre-Op Assessment', href: '/or/pre-op', icon: ClipboardCheck },
        { title: nav.orNurseStation || 'OR Nurse Station', href: '/or/nurse-station', icon: Heart },
        { title: nav.orSchedule || 'Schedule Board', href: '/or/schedule', icon: Calendar },
        { title: nav.orSurgeonStation || 'Surgeon Station', href: '/or/surgeon-station', icon: Stethoscope },
        { title: nav.orOperativeNotes || 'Operative Notes', href: '/or/operative-notes', icon: FileText },
        { title: nav.orPostOpOrders || 'Post-Op Orders', href: '/or/post-op-orders', icon: ClipboardList },
      ],
    },
    {
      title: nav.icu || 'ICU',
      icon: Activity,
      area: 'ipd',
      children: [
        { title: nav.icuDashboard || 'Dashboard', href: '/icu', icon: FileText },
        { title: nav.icuNurseStation || 'Nurse Station', href: '/icu/nurse-station', icon: ClipboardList },
        { title: nav.icuDoctorStation || 'Doctor Station', href: '/icu/doctor-station', icon: Stethoscope },
        { title: nav.icuApacheScore || 'APACHE Score', href: '/icu/apache-score', icon: BarChart3 },
        { title: nav.icuSedation || 'Sedation', href: '/icu/sedation', icon: Pill },
        { title: nav.icuDelirium || 'Delirium', href: '/icu/delirium', icon: Brain },
        { title: nav.icuBundles || 'Bundles', href: '/icu/bundles', icon: ClipboardCheck },
        { title: nav.icuCodeBlue || 'Code Blue', href: '/icu/code-blue', icon: Siren },
      ],
    },
    {
      title: nav.security || 'Security',
      href: '/settings/security',
      icon: Settings,
    },

    // ── Clinical Services ──
    {
      title: nav.clinicalServices || 'Clinical Services',
      icon: Stethoscope,
      area: 'ipd',
      children: [
        { title: nav.physiotherapy || 'Physiotherapy', href: '/physiotherapy', icon: Dumbbell },
        { title: nav.consults || 'Consultations', href: '/consults', icon: MessageSquare },
        { title: nav.woundCare || 'Wound Care', href: '/wound-care', icon: Bandage },
        { title: nav.nutrition || 'Nutrition', href: '/nutrition', icon: Apple },
        { title: nav.socialWork || 'Social Work', href: '/social-work', icon: HandHeart },
        { title: nav.patientEducation || 'Patient Education', href: '/patient-education', icon: GraduationCap },
      ],
    },

    // ── Lab & Diagnostics ──
    {
      title: nav.bloodBank || 'Blood Bank',
      icon: Droplets,
      area: 'orders',
      children: [
        { title: nav.bloodBankCrossmatch || 'Cross-Match', href: '/blood-bank/crossmatch', icon: Droplets },
        { title: nav.bloodBankInventory || 'Inventory', href: '/blood-bank/inventory', icon: ClipboardList },
      ],
    },
    {
      title: nav.pathology || 'Pathology',
      href: '/pathology',
      icon: Microscope,
      area: 'orders',
    },

    // ── Operations ──
    {
      title: nav.operations || 'Operations',
      icon: Wrench,
      area: 'ipd',
      children: [
        { title: nav.cssd || 'CSSD / Sterilization', href: '/cssd', icon: FlaskConical },
        { title: nav.equipmentMgmt || 'Equipment', href: '/equipment-mgmt', icon: Wrench },
        { title: nav.infectionControl || 'Infection Control', href: '/infection-control', icon: ShieldAlert },
        { title: nav.icIsolation || 'Isolation Precautions', href: '/infection-control/isolation', icon: ShieldAlert },
        { title: nav.icHandHygiene || 'Hand Hygiene', href: '/infection-control/hand-hygiene', icon: HandMetal },
        { title: nav.icStewardship || 'Stewardship', href: '/infection-control/stewardship', icon: Pill },
        { title: nav.icOutbreaks || 'Outbreaks', href: '/infection-control/outbreaks', icon: Biohazard },
      ],
    },

    // ── Dental ──
    {
      title: nav.dental || 'Dental',
      icon: Stethoscope,
      area: 'opd',
      children: [
        { title: nav.dentalPatients || 'Patients', href: '/dental/patients', icon: Users },
        { title: nav.dentalProcedures || 'Procedures', href: '/dental/procedures', icon: ClipboardList },
        { title: nav.dentalChart || 'Chart', href: '/dental/chart', icon: FileText },
        { title: nav.dentalTreatment || 'Treatment', href: '/dental/treatment', icon: Activity },
      ],
    },

    // ── Specialty Modules ──
    {
      title: nav.specialtyModules || 'Specialty Modules',
      icon: Stethoscope,
      children: [
        { title: nav.oncology || 'Oncology', href: '/oncology', icon: Activity },
        { title: nav.psychiatry || 'Psychiatry', href: '/psychiatry', icon: Brain },
        { title: nav.psychiatryRestraints || 'Restraint/Seclusion', href: '/psychiatry/restraints', icon: Lock },
        { title: nav.psychiatryRiskAssessment || 'Risk Assessment', href: '/psychiatry/risk-assessment', icon: AlertTriangle },
        { title: nav.psychiatryMse || 'Mental Status Exam', href: '/psychiatry/mse', icon: Brain },
        { title: nav.transplant || 'Transplant', href: '/transplant', icon: Heart },
      ],
    },

    // ── Telemedicine ──
    {
      title: nav.telemedicine || 'Telemedicine',
      href: '/telemedicine',
      icon: Activity,
    },

    // ── Analytics ──
    {
      title: nav.analytics || 'Analytics',
      href: '/analytics',
      icon: BarChart3,
    },
  ];
}

// ── Platform route helpers ──

const SAM_ROUTES = ['/sam', '/platforms/sam'];
const HEALTH_ROUTES = [
  '/dashboard', '/opd', '/er', '/ipd', '/notifications', '/registration',
  '/search', '/orders', '/results', '/tasks', '/handover', '/billing',
  '/settings', '/patient', '/mortuary', '/quality', '/referrals', '/admin',
  '/scheduling', '/radiology', '/lab', '/pharmacy', '/dental', '/obgyn', '/icu',
  '/departments', '/downtime', '/integrity', '/or', '/handoff', '/risk-detector',
  // Clinical Services
  '/physiotherapy', '/consults', '/wound-care', '/nutrition', '/social-work', '/patient-education',
  // Lab & Diagnostics
  '/blood-bank', '/pathology',
  // Operations
  '/cssd', '/equipment-mgmt', '/infection-control',
  // Specialty Modules
  '/oncology', '/psychiatry', '/transplant',
  // Telemedicine & Analytics
  '/telemedicine', '/analytics',
  // Admission Office
  '/admission-office',
];
const COMMON_ROUTES = ['/account'];

function getRoutePlatform(pathname: string | null): 'sam' | 'health' | null {
  if (!pathname) return null;
  if (pathname.startsWith('/sam') || pathname.startsWith('/platforms/sam')) return 'sam';
  if (
    pathname.startsWith('/platforms/thea-health') ||
    pathname.startsWith('/er') || pathname.startsWith('/ipd') ||
    pathname.startsWith('/opd') || pathname.startsWith('/billing') ||
    pathname.startsWith('/dashboard') || pathname.startsWith('/registration') ||
    pathname.startsWith('/orders') || pathname.startsWith('/handover') ||
    pathname.startsWith('/tasks') || pathname.startsWith('/results') ||
    pathname.startsWith('/mortuary') || pathname.startsWith('/departments') ||
    pathname.startsWith('/settings') || pathname.startsWith('/patient') ||
    pathname.startsWith('/quality') || pathname.startsWith('/search') ||
    pathname.startsWith('/referrals') || pathname.startsWith('/scheduling') ||
    pathname.startsWith('/radiology') || pathname.startsWith('/lab') ||
    pathname.startsWith('/pharmacy') || pathname.startsWith('/dental') ||
    pathname.startsWith('/obgyn') || pathname.startsWith('/mortuary') ||
    pathname.startsWith('/departments') || pathname.startsWith('/downtime') ||
    pathname.startsWith('/integrity') || pathname.startsWith('/notifications') ||
    pathname.startsWith('/or') ||
    // Clinical Services
    pathname.startsWith('/physiotherapy') || pathname.startsWith('/consults') ||
    pathname.startsWith('/wound-care') || pathname.startsWith('/nutrition') ||
    pathname.startsWith('/social-work') || pathname.startsWith('/patient-education') ||
    // Lab & Diagnostics
    pathname.startsWith('/blood-bank') || pathname.startsWith('/pathology') ||
    // Operations
    pathname.startsWith('/cssd') || pathname.startsWith('/equipment-mgmt') ||
    pathname.startsWith('/infection-control') ||
    // Specialty Modules
    pathname.startsWith('/oncology') || pathname.startsWith('/psychiatry') ||
    pathname.startsWith('/transplant') ||
    // Telemedicine & Analytics
    pathname.startsWith('/telemedicine') || pathname.startsWith('/analytics') ||
    pathname.startsWith('/handoff') || pathname.startsWith('/risk-detector') ||
    pathname.startsWith('/icu') || pathname.startsWith('/admin') ||
    pathname.startsWith('/admission-office')
  ) return 'health';
  return null;
}

function isRouteForPlatform(href: string | undefined, targetPlatform: 'sam' | 'health'): boolean {
  if (!href) return true;
  if (COMMON_ROUTES.some(r => href.startsWith(r))) return true;
  if (targetPlatform === 'sam') return SAM_ROUTES.some(r => href.startsWith(r));
  return HEALTH_ROUTES.some(r => href.startsWith(r));
}

function getAreaFromHref(href?: string): string | null {
  if (!href) return null;
  if (href.startsWith('/er')) return 'er';
  if (href.startsWith('/ipd') || href.startsWith('/admission-office')) return 'ipd';
  if (href.startsWith('/opd')) return 'opd';
  if (href.startsWith('/registration') || href.startsWith('/search')) return 'registration';
  if (href.startsWith('/orders')) return 'orders';
  if (href.startsWith('/billing')) return 'billing';
  if (href.startsWith('/scheduling')) return 'opd';
  if (href.startsWith('/radiology') || href.startsWith('/lab') || href.startsWith('/pharmacy')) return 'orders';
  if (href.startsWith('/dental') || href.startsWith('/obgyn')) return 'opd';
  if (href.startsWith('/or')) return 'er';
  // Clinical Services
  if (
    href.startsWith('/physiotherapy') || href.startsWith('/consults') ||
    href.startsWith('/wound-care') || href.startsWith('/nutrition') ||
    href.startsWith('/social-work') || href.startsWith('/patient-education')
  ) return 'ipd';
  // Lab & Diagnostics
  if (href.startsWith('/blood-bank') || href.startsWith('/pathology')) return 'orders';
  // Operations
  if (
    href.startsWith('/cssd') || href.startsWith('/equipment-mgmt') ||
    href.startsWith('/infection-control')
  ) return 'ipd';
  return null;
}

// ── Hook return type ──

export interface SidebarNavResult {
  navItems: NavItem[];
  unreadCount: number;
  erUnreadCount: number;
  platform: 'sam' | 'health' | null;
  mounted: boolean;
  me: Record<string, unknown> | undefined;
}

// ── Main hook ──

export function useSidebarNav(): SidebarNavResult {
  const [mounted, setMounted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [erUnreadCount, setErUnreadCount] = useState(0);
  const { language } = useLang();
  const { me } = useMe();
  const { platform: platformData } = usePlatform();
  const pathname = usePathname();

  useEffect(() => { setMounted(true); }, []);

  // ── Derived user data ──
  const userRole = me?.user?.role || null;
  const userPermissions: string[] = me?.user?.permissions || [];
  const activeTenantId = me?.tenantId || null;
  const isChargeOrDev = canAccessChargeConsole({ email: me?.user?.email, tenantId: activeTenantId, role: me?.user?.role });
  const isAdminUser = ['admin', 'tenant-admin'].includes(String(userRole || '').toLowerCase());
  const isOwnerRole = userRole === 'thea-owner';
  const effectiveEntitlements = me?.effectiveEntitlements;
  const hasSAMAccess = effectiveEntitlements?.sam ?? false;
  const hasHealthAccess = effectiveEntitlements?.health ?? false;

  // ── Platform detection ──
  const routePlatform = getRoutePlatform(pathname);
  const platform: 'sam' | 'health' | null =
    routePlatform ||
    (platformData?.platform === 'sam' || platformData?.platform === 'health' ? platformData.platform : null);

  // ── Tenant user data for area filtering ──
  const { data: tenantUserData } = useSWR(
    activeTenantId ? '/api/access/tenant-user' : null,
    fetcher,
    { refreshInterval: 0 },
  );
  const tenantAreas: string[] = Array.isArray(tenantUserData?.tenantUser?.areas)
    ? tenantUserData.tenantUser.areas.map((a: string) => String(a || '').toLowerCase())
    : [];
  const tenantRoles: string[] = Array.isArray(tenantUserData?.tenantUser?.roles)
    ? tenantUserData.tenantUser.roles.map((r: string) => String(r || '').toLowerCase())
    : [];
  const tenantIsAdminDev = tenantRoles.includes('admin') || tenantRoles.includes('dev');
  const canSeeAdminNav = isOwnerRole || isAdminUser || tenantIsAdminDev;

  // ── Nav translations ──
  const navTranslations = useMemo(() => {
    if (mounted && language && (language === 'ar' || language === 'en')) {
      const langT = translations[language];
      if (langT?.nav) return langT.nav;
    }
    return translations.ar.nav;
  }, [mounted, language]);

  // ── Notification polling ──
  useEffect(() => {
    if (!mounted) return;
    const canView = isOwnerRole || isAdminUser || tenantIsAdminDev ||
      hasRoutePermission(userPermissions, '/notifications');
    async function fetch_() {
      try {
        if (!canView) { setUnreadCount(0); return; }
        const r = await fetch('/api/notifications/inbox?status=OPEN&limit=1', { credentials: 'include' });
        if (r.ok) { const d = await r.json(); setUnreadCount(d.openCount || 0); }
        else if (r.status === 401 || r.status === 403) setUnreadCount(0);
      } catch { /* best-effort */ }
    }
    fetch_();
    const id = setInterval(fetch_, 30_000);
    return () => clearInterval(id);
  }, [mounted, userRole, userPermissions, isOwnerRole, isAdminUser, tenantIsAdminDev]);

  useEffect(() => {
    if (!mounted) return;
    const canView = isOwnerRole || isAdminUser || tenantIsAdminDev ||
      hasRoutePermission(userPermissions, '/er/notifications');
    if (!isChargeOrDev || !canView) { setErUnreadCount(0); return; }
    async function fetch_() {
      try {
        const r = await fetch('/api/er/notifications', { credentials: 'include' });
        if (r.ok) { const d = await r.json(); setErUnreadCount(d.unreadCount || 0); }
        else if (r.status === 401 || r.status === 403) setErUnreadCount(0);
      } catch { /* best-effort */ }
    }
    fetch_();
    const id = setInterval(fetch_, 30_000);
    return () => clearInterval(id);
  }, [mounted, isChargeOrDev, isOwnerRole, isAdminUser, tenantIsAdminDev, userPermissions]);

  // ── Filtering logic (mirrors Sidebar.tsx getVisibleNav) ──
  const navItems = useMemo(() => {
    const currentLang = translations[language] || translations.ar;
    const tWithNav = { ...currentLang, nav: navTranslations || currentLang.nav };
    const items = getNavItems(tWithNav);

    if (!mounted) return items;

    const roleLower = String(userRole || '').toLowerCase();
    const isAdminRole = roleLower === 'admin' || roleLower === 'tenant-admin';
    const allowedAreas: string[] | null =
      platform === 'health'
        ? (tenantIsAdminDev || isAdminUser || isAdminRole ? null : tenantAreas.length ? tenantAreas : null)
        : null;

    return items
      .map((item) => {
        let filteredItem: NavItem | null = item;

        // Platform filter
        if (platform) {
          if (item.href) {
            if (isRouteForPlatform(item.href, 'sam') && !hasSAMAccess) return null;
            if (isRouteForPlatform(item.href, 'health') && !hasHealthAccess) return null;
            if (!isRouteForPlatform(item.href, platform)) return null;
          } else if (item.children) {
            const kids = item.children.filter((c) => {
              if (!c.href) return true;
              if (isRouteForPlatform(c.href, 'sam') && !hasSAMAccess) return false;
              if (isRouteForPlatform(c.href, 'health') && !hasHealthAccess) return false;
              return isRouteForPlatform(c.href, platform);
            });
            if (!kids.length) return null;
            filteredItem = { ...item, children: kids };
          } else {
            const isCommon =
              item.title === (navTranslations?.account || 'Account') ||
              item.title === ((navTranslations as NavTranslationKeys)?.admin || 'Admin');
            if (!isCommon) return null;
          }
        }

        if (!filteredItem) return null;

        // Permission filter — single items
        if (filteredItem.href && !filteredItem.children) {
          if (!isOwnerRole && !isAdminUser && !isAdminRole && !tenantIsAdminDev) {
            if (!hasRoutePermission(userPermissions, filteredItem.href)) return null;
          }
          const area = getAreaFromHref(filteredItem.href);
          if (allowedAreas && area && !allowedAreas.includes(area)) return null;
          return filteredItem;
        }

        // Permission filter — items with children
        if (filteredItem.children) {
          if (allowedAreas && filteredItem.area && !allowedAreas.includes(filteredItem.area)) return null;

          let kids = filteredItem.children.filter((child) => {
            if (!child.href) return true;
            if (child.href.startsWith('/admin/clinical-infra') && !canSeeAdminNav && !userPermissions.includes('admin.clinical-infra.view')) return false;
            if (isOwnerRole || isAdminUser || isAdminRole || tenantIsAdminDev) return true;
            return hasRoutePermission(userPermissions, child.href);
          });

          if (allowedAreas) {
            kids = kids.filter((c) => {
              const a = getAreaFromHref(c.href);
              return !a || allowedAreas.includes(a);
            });
          }

          if (!kids.length) return null;
          return { ...filteredItem, children: kids };
        }

        return filteredItem;
      })
      .filter((i): i is NavItem => i !== null);
  }, [
    mounted, language, navTranslations, userRole, userPermissions,
    isOwnerRole, isAdminUser, tenantIsAdminDev,
    canSeeAdminNav, platform, hasSAMAccess, hasHealthAccess, tenantAreas,
  ]);

  return { navItems, unreadCount, erUnreadCount, platform, mounted, me };
}
