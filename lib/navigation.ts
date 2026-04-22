/**
 * Navigation Registry
 * 
 * Central registry for all navigation items/modules in the system.
 * Used for:
 * - Welcome page module cards
 * - Sidebar navigation (optional integration)
 * - Permission-based filtering
 * 
 * IMPORTANT: This is for UX/navigation only. Server-side route authorization
 * must still be enforced in API routes and page guards.
 */

import {
  LayoutDashboard,
  Bell,
  Stethoscope,
  Calendar,
  Clock,
  AlertCircle,
  Heart,
  Home,
  Bed,
  PackagePlus,
  Wrench,
  FileText,
  Settings,
  UserCircle,
  Activity,
  BarChart3,
  Database,
  Building2,
  Upload,
  Users,
  ClipboardList,
  UserPlus,
  LayoutGrid,
  TrendingUp,
} from 'lucide-react';

export interface NavigationModule {
  id: string;
  titleKey: string; // Translation key in nav object (e.g., 'dashboard', 'notifications')
  descriptionKey?: string; // Translation key for description (optional)
  href: string;
  requiredPermission: string; // Permission key from ROUTE_PERMISSIONS
  icon: any; // Lucide icon component
  category?: string; // Optional category for grouping
}

/**
 * Navigation modules registry
 * Each module represents a page/module the user can access
 */
export const NAVIGATION_MODULES: NavigationModule[] = [
  {
    id: 'dashboard',
    titleKey: 'dashboard',
    descriptionKey: 'dashboardDescription',
    href: '/dashboard',
    requiredPermission: 'dashboard.view',
    icon: LayoutDashboard,
    category: 'Main',
  },
  {
    id: 'notifications',
    titleKey: 'notifications',
    descriptionKey: 'notificationsDescription',
    href: '/notifications',
    requiredPermission: 'notifications.view',
    icon: Bell,
    category: 'Main',
  },
  {
    id: 'registration',
    titleKey: 'registration',
    descriptionKey: 'registrationDescription',
    href: '/registration',
    requiredPermission: 'registration.view',
    icon: ClipboardList,
    category: 'Hospital Core',
  },
  {
    id: 'opd-home',
    titleKey: 'opdHome',
    descriptionKey: 'opdHomeDescription',
    href: '/opd/home',
    requiredPermission: 'opd.dashboard.view',
    icon: Home,
    category: 'OPD',
  },
  {
    id: 'opd-registration',
    titleKey: 'opdRegistration',
    href: '/opd/registration',
    requiredPermission: 'opd.visit.create',
    icon: UserPlus,
    category: 'OPD',
  },
  {
    id: 'opd-appointments',
    titleKey: 'opdAppointments',
    href: '/opd/appointments',
    requiredPermission: 'scheduling.view',
    icon: Calendar,
    category: 'OPD',
  },
  {
    id: 'opd-waiting-list',
    titleKey: 'opdWaitingList',
    href: '/opd/waiting-list',
    requiredPermission: 'opd.queue.view',
    icon: Clock,
    category: 'OPD',
  },
  {
    id: 'opd-nurse-station',
    titleKey: 'opdNurseStation',
    href: '/opd/nurse-station',
    requiredPermission: 'opd.nursing.view',
    icon: Heart,
    category: 'OPD',
  },
  {
    id: 'opd-doctor-worklist',
    titleKey: 'opdDoctorWorklist',
    href: '/opd/doctor-worklist',
    requiredPermission: 'opd.doctor.schedule.view',
    icon: Stethoscope,
    category: 'OPD',
  },
  {
    id: 'scheduling',
    titleKey: 'schedule',
    descriptionKey: 'scheduleDescription',
    href: '/scheduling/scheduling',
    requiredPermission: 'scheduling.view',
    icon: Calendar,
    category: 'Scheduling',
  },
  {
    id: 'scheduling-availability',
    titleKey: 'availability',
    descriptionKey: 'availabilityDescription',
    href: '/scheduling/availability',
    requiredPermission: 'scheduling.availability.view',
    icon: Calendar,
    category: 'Scheduling',
  },
  {
    id: 'er-register',
    titleKey: 'patientRegistration',
    descriptionKey: 'patientRegistrationDescription',
    href: '/er/register',
    requiredPermission: 'er.register.view',
    icon: AlertCircle,
    category: 'Emergency Room',
  },
  {
    id: 'er-triage',
    titleKey: 'triage',
    descriptionKey: 'triageDescription',
    href: '/er/triage',
    requiredPermission: 'er.triage.view',
    icon: Activity,
    category: 'Emergency Room',
  },
  {
    id: 'er-disposition',
    titleKey: 'disposition',
    descriptionKey: 'dispositionDescription',
    href: '/er/disposition',
    requiredPermission: 'er.disposition.view',
    icon: Bed,
    category: 'Emergency Room',
  },
  {
    id: 'er-progress-note',
    titleKey: 'progressNote',
    descriptionKey: 'progressNoteDescription',
    href: '/er/progress-note',
    requiredPermission: 'er.progress-note.view',
    icon: FileText,
    category: 'Emergency Room',
  },
  {
    id: 'px-dashboard',
    titleKey: 'dashboard',
    descriptionKey: 'pxDashboardDescription',
    href: '/patient-experience/dashboard',
    requiredPermission: 'px.dashboard.view',
    icon: Heart,
    category: 'Patient Experience',
  },
  {
    id: 'px-reports',
    titleKey: 'reports',
    descriptionKey: 'reportsDescription',
    href: '/patient-experience/reports',
    requiredPermission: 'px.reports.view',
    icon: FileText,
    category: 'Patient Experience',
  },
  {
    id: 'px-visits',
    titleKey: 'allVisits',
    descriptionKey: 'allVisitsDescription',
    href: '/patient-experience/visits',
    requiredPermission: 'px.visits.view',
    icon: FileText,
    category: 'Patient Experience',
  },
  {
    id: 'px-cases',
    titleKey: 'cases',
    descriptionKey: 'casesDescription',
    href: '/patient-experience/cases',
    requiredPermission: 'px.cases.view',
    icon: AlertCircle,
    category: 'Patient Experience',
  },
  {
    id: 'equipment-master',
    titleKey: 'master',
    descriptionKey: 'equipmentMasterDescription',
    href: '/equipment/master',
    requiredPermission: 'equipment.opd.master.view',
    icon: PackagePlus,
    category: 'Equipment',
  },
  {
    id: 'equipment-checklist',
    titleKey: 'checklist',
    descriptionKey: 'equipmentChecklistDescription',
    href: '/equipment/checklist',
    requiredPermission: 'equipment.opd.checklist.view',
    icon: PackagePlus,
    category: 'Equipment',
  },
  {
    id: 'nursing-operations',
    titleKey: 'nursingOperations',
    descriptionKey: 'nursingOperationsDescription',
    href: '/nursing/operations',
    requiredPermission: 'nursing.operations.view',
    icon: Activity,
    category: 'Nursing',
  },
  {
    id: 'admin-data-admin',
    titleKey: 'dataAdmin',
    descriptionKey: 'dataAdminDescription',
    href: '/admin/data-admin',
    requiredPermission: 'admin.data-admin.view',
    icon: Database,
    category: 'Admin',
  },
  {
    id: 'admin-users',
    titleKey: 'users',
    descriptionKey: 'usersDescription',
    href: '/admin/users',
    requiredPermission: 'admin.users.view',
    icon: Users,
    category: 'Admin',
  },
  {
    id: 'admin-structure',
    titleKey: 'structureManagement',
    descriptionKey: 'structureManagementDescription',
    href: '/admin/structure-management',
    requiredPermission: 'admin.structure-management.view',
    icon: Building2,
    category: 'Admin',
  },
  {
    id: 'account',
    titleKey: 'account',
    descriptionKey: 'accountDescription',
    href: '/account',
    requiredPermission: 'account.view',
    icon: UserCircle,
    category: 'Account',
  },

  // ── CVision (Employee Lifecycle Management) ──
  {
    id: 'cvision-dashboard',
    titleKey: 'cvisionDashboard',
    descriptionKey: 'cvisionDashboardDescription',
    href: '/cvision',
    requiredPermission: 'cvision.dashboard.view',
    icon: LayoutDashboard,
    category: 'CVision',
  },
  {
    id: 'cvision-employees',
    titleKey: 'cvisionEmployees',
    descriptionKey: 'cvisionEmployeesDescription',
    href: '/cvision/employees',
    requiredPermission: 'cvision.employees.view',
    icon: Users,
    category: 'CVision',
  },
  {
    id: 'cvision-attendance',
    titleKey: 'cvisionAttendance',
    descriptionKey: 'cvisionAttendanceDescription',
    href: '/cvision/attendance',
    requiredPermission: 'cvision.attendance.view',
    icon: Clock,
    category: 'CVision',
  },
  {
    id: 'cvision-recruitment',
    titleKey: 'cvisionRecruitment',
    descriptionKey: 'cvisionRecruitmentDescription',
    href: '/cvision/recruitment',
    requiredPermission: 'cvision.recruitment.view',
    icon: UserPlus,
    category: 'CVision',
  },
  {
    id: 'cvision-payroll',
    titleKey: 'cvisionPayroll',
    descriptionKey: 'cvisionPayrollDescription',
    href: '/cvision/payroll',
    requiredPermission: 'cvision.payroll.view',
    icon: TrendingUp,
    category: 'CVision',
  },
  {
    id: 'cvision-organization',
    titleKey: 'cvisionOrganization',
    descriptionKey: 'cvisionOrganizationDescription',
    href: '/cvision/organization',
    requiredPermission: 'cvision.org.view',
    icon: Building2,
    category: 'CVision',
  },
  {
    id: 'cvision-leaves',
    titleKey: 'cvisionLeaves',
    descriptionKey: 'cvisionLeavesDescription',
    href: '/cvision/leaves',
    requiredPermission: 'cvision.leaves.view',
    icon: Calendar,
    category: 'CVision',
  },
  {
    id: 'cvision-directory',
    titleKey: 'cvisionDirectory',
    descriptionKey: 'cvisionDirectoryDescription',
    href: '/cvision/directory',
    requiredPermission: 'cvision.employees.view',
    icon: Users,
    category: 'CVision',
  },
  {
    id: 'cvision-analytics',
    titleKey: 'cvisionAnalytics',
    descriptionKey: 'cvisionAnalyticsDescription',
    href: '/cvision/analytics',
    requiredPermission: 'cvision.analytics.view',
    icon: BarChart3,
    category: 'CVision',
  },
  {
    id: 'cvision-settings',
    titleKey: 'cvisionSettings',
    descriptionKey: 'cvisionSettingsDescription',
    href: '/cvision/settings',
    requiredPermission: 'cvision.admin.view',
    icon: Settings,
    category: 'CVision',
  },
];

/**
 * Filter navigation modules based on user permissions
 */
export function getAccessibleModules(userPermissions: string[]): NavigationModule[] {
  return NAVIGATION_MODULES.filter(module => {
    // Admin with admin.users permission has access to everything
    if (userPermissions.includes('admin.users')) {
      return true;
    }
    
    // Check if user has the required permission
    return userPermissions.includes(module.requiredPermission);
  });
}

/**
 * Get modules grouped by category
 */
export function getModulesByCategory(modules: NavigationModule[]): Record<string, NavigationModule[]> {
  const grouped: Record<string, NavigationModule[]> = {};
  
  modules.forEach(module => {
    const category = module.category || 'Other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(module);
  });
  
  return grouped;
}

