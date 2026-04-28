/**
 * CVision Sidebar Navigation Config — comprehensive section-based layout
 * with bilingual labels, permission gating, and badge support.
 */

import {
  LayoutDashboard, Users, GitBranch, UsersRound, Building2, Clock, CalendarDays,
  Wallet, FileText, Calendar, Mail, Plane, Package, UserPlus, Rocket, Target,
  GraduationCap, Puzzle, DollarSign, Trophy, ArrowUpCircle, TrendingUp,
  Banknote, Shield, Calculator, Megaphone, BookOpen, ClipboardList, AlertTriangle,
  HeartPulse, RefreshCw, Network, Heart, Activity, Compass, Landmark, ShieldCheck,
  Eye, BarChart3, PieChart, Database, User, Bot, Settings, Workflow, Upload,
  Layers, Webhook, Timer, FileCode, Bus, HardHat, ClipboardCheck, Folder,
  CreditCard, Bell, Gavel, Trash2, BrainCircuit, Briefcase,
  MessageSquare, Plug, Search, Sparkles, UtensilsCrossed, Dumbbell,
  Lock, Blocks, ContactRound, type LucideIcon,
} from 'lucide-react';

export interface SidebarItem {
  label: string;
  labelEn: string;
  href: string;
  icon: LucideIcon;
  permission: string;
  badge?: 'notifications' | 'approvals';
}

export interface SidebarSection {
  id: string;
  label: string;
  labelEn: string;
  items: SidebarItem[];
}

export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    id: 'main', label: 'الرئيسية', labelEn: 'Main',
    items: [
      { label: 'لوحة التحكم', labelEn: 'Dashboard', href: '/cvision', icon: LayoutDashboard, permission: 'cvision.view' },
    ],
  },
  {
    id: 'employees', label: 'الموظفين', labelEn: 'Employees',
    items: [
      { label: 'قائمة الموظفين', labelEn: 'Employee List', href: '/cvision/employees', icon: Users, permission: 'cvision.employees.read' },
      { label: 'الهيكل التنظيمي', labelEn: 'Org Chart', href: '/cvision/organization', icon: GitBranch, permission: 'cvision.org.read' },
      { label: 'الفرق', labelEn: 'Teams', href: '/cvision/teams', icon: UsersRound, permission: 'cvision.employees.read' },
      { label: 'الفروع', labelEn: 'Branches', href: '/cvision/branches', icon: Building2, permission: 'cvision.org.read' },
      { label: 'الوحدات', labelEn: 'Units', href: '/cvision/units', icon: Blocks, permission: 'cvision.org.read' },
      { label: 'دليل الموظفين', labelEn: 'Directory', href: '/cvision/directory', icon: ContactRound, permission: 'cvision.employees.read' },
    ],
  },
  {
    id: 'operations', label: 'العمليات', labelEn: 'Operations',
    items: [
      { label: 'الحضور', labelEn: 'Attendance', href: '/cvision/attendance', icon: Clock, permission: 'cvision.attendance.read' },
      { label: 'الإجازات', labelEn: 'Leaves', href: '/cvision/leaves', icon: CalendarDays, permission: 'cvision.leaves.read' },
      { label: 'السلف والقروض', labelEn: 'Loans', href: '/cvision/payroll/loans', icon: Wallet, permission: 'cvision.loans.read' },
      { label: 'العقود', labelEn: 'Contracts', href: '/cvision/contracts', icon: FileText, permission: 'cvision.contracts.read' },
      { label: 'الجدولة', labelEn: 'Scheduling', href: '/cvision/scheduling', icon: Calendar, permission: 'cvision.scheduling.read' },
      { label: 'الخطابات', labelEn: 'Letters', href: '/cvision/letters', icon: Mail, permission: 'cvision.letters.read' },
      { label: 'السفر والمصروفات', labelEn: 'Travel & Expenses', href: '/cvision/travel', icon: Plane, permission: 'cvision.travel.read' },
      { label: 'الأصول', labelEn: 'Assets', href: '/cvision/assets', icon: Package, permission: 'cvision.assets.read' },
      { label: 'سجل الدوام', labelEn: 'Timesheets', href: '/cvision/timesheets', icon: ClipboardCheck, permission: 'cvision.attendance.read' },
      { label: 'النقل', labelEn: 'Transport', href: '/cvision/transport', icon: Bus, permission: 'cvision.transport.read' },
      { label: 'الوثائق', labelEn: 'Documents', href: '/cvision/documents', icon: Folder, permission: 'cvision.documents.read' },
      { label: 'الطلبات', labelEn: 'Requests', href: '/cvision/requests', icon: FileText, permission: 'cvision.requests.read' },
      { label: 'الحجوزات', labelEn: 'Bookings', href: '/cvision/bookings', icon: Calendar, permission: 'cvision.view' },
      { label: 'الوظائف', labelEn: 'Jobs', href: '/cvision/jobs', icon: Briefcase, permission: 'cvision.recruitment.read' },
    ],
  },
  {
    id: 'recruitment', label: 'التوظيف', labelEn: 'Recruitment',
    items: [
      { label: 'التوظيف', labelEn: 'Recruitment', href: '/cvision/recruitment', icon: UserPlus, permission: 'cvision.recruitment.read' },
      { label: 'التأهيل', labelEn: 'Onboarding', href: '/cvision/onboarding', icon: Rocket, permission: 'cvision.onboarding.read' },
    ],
  },
  {
    id: 'talent', label: 'المواهب', labelEn: 'Talent',
    items: [
      { label: 'الأداء (KPIs/OKRs)', labelEn: 'Performance', href: '/cvision/performance', icon: Target, permission: 'cvision.performance.read' },
      { label: 'التدريب', labelEn: 'Training', href: '/cvision/training', icon: GraduationCap, permission: 'cvision.training.read' },
      { label: 'مصفوفة المهارات', labelEn: 'Skills Matrix', href: '/cvision/ai/skills', icon: Puzzle, permission: 'cvision.employees.read' },
      { label: 'المطابقة الذكية', labelEn: 'AI Matching', href: '/cvision/ai/matching', icon: BrainCircuit, permission: 'cvision.employees.read' },
      { label: 'حوكمة الذكاء', labelEn: 'AI Governance', href: '/cvision/ai/governance', icon: ShieldCheck, permission: 'cvision.config.write' },
      { label: 'التعويضات', labelEn: 'Compensation', href: '/cvision/compensation', icon: DollarSign, permission: 'cvision.compensation.read' },
      { label: 'المكافآت والتقدير', labelEn: 'Rewards', href: '/cvision/recognition', icon: Trophy, permission: 'cvision.rewards.read' },
      { label: 'تخطيط التعاقب', labelEn: 'Succession', href: '/cvision/succession', icon: ArrowUpCircle, permission: 'cvision.succession.read' },
      { label: 'الترقيات', labelEn: 'Promotions', href: '/cvision/promotions', icon: TrendingUp, permission: 'cvision.employees.write' },
      { label: 'الأهداف (OKRs)', labelEn: 'OKRs', href: '/cvision/okrs', icon: Target, permission: 'cvision.performance.read' },
      { label: 'التحليلات التنبؤية', labelEn: 'Predictive', href: '/cvision/predictive', icon: BrainCircuit, permission: 'cvision.reports.read' },
    ],
  },
  {
    id: 'payroll', label: 'الرواتب', labelEn: 'Payroll',
    items: [
      { label: 'مسير الرواتب', labelEn: 'Payroll', href: '/cvision/payroll', icon: Banknote, permission: 'cvision.payroll.read' },
      { label: 'التأمين', labelEn: 'Insurance', href: '/cvision/insurance', icon: Shield, permission: 'cvision.insurance.read' },
      { label: 'ميزانية القوى', labelEn: 'Headcount Budget', href: '/cvision/headcount', icon: Calculator, permission: 'cvision.payroll.read' },
      { label: 'بطاقات الراتب', labelEn: 'Paycards', href: '/cvision/paycards', icon: CreditCard, permission: 'cvision.payroll.read' },
    ],
  },
  {
    id: 'workplace', label: 'بيئة العمل', labelEn: 'Workplace',
    items: [
      { label: 'الإعلانات', labelEn: 'Announcements', href: '/cvision/announcements', icon: Megaphone, permission: 'cvision.notifications.read' },
      { label: 'السياسات', labelEn: 'Policies', href: '/cvision/policies', icon: BookOpen, permission: 'cvision.policies.read' },
      { label: 'التقويم', labelEn: 'Calendar', href: '/cvision/calendar', icon: CalendarDays, permission: 'cvision.view' },
      { label: 'الاستبيانات', labelEn: 'Surveys', href: '/cvision/surveys', icon: ClipboardList, permission: 'cvision.surveys.read' },
      { label: 'الشكاوى', labelEn: 'Grievances', href: '/cvision/grievances', icon: AlertTriangle, permission: 'cvision.grievances.read' },
      { label: 'الإجراءات التأديبية', labelEn: 'Disciplinary', href: '/cvision/disciplinary', icon: Gavel, permission: 'cvision.disciplinary.read' },
      { label: 'الإشعارات', labelEn: 'Notifications', href: '/cvision/notifications', icon: Bell, permission: 'cvision.view' },
      { label: 'التواصل', labelEn: 'Communications', href: '/cvision/communications', icon: MessageSquare, permission: 'cvision.notifications.read' },
      { label: 'صحة الموظفين', labelEn: 'Wellness', href: '/cvision/wellness', icon: Dumbbell, permission: 'cvision.view' },
      { label: 'المشاركة', labelEn: 'Engagement', href: '/cvision/engagement', icon: Sparkles, permission: 'cvision.view' },
      { label: 'الكافتيريا', labelEn: 'Cafeteria', href: '/cvision/cafeteria', icon: UtensilsCrossed, permission: 'cvision.view' },
    ],
  },
  {
    id: 'od', label: 'التطوير المؤسسي', labelEn: 'OD',
    items: [
      { label: 'صحة المنظمة', labelEn: 'Org Health', href: '/cvision/od/health', icon: HeartPulse, permission: 'cvision.org.read' },
      { label: 'إدارة التغيير', labelEn: 'Change Mgmt', href: '/cvision/od/change', icon: RefreshCw, permission: 'cvision.org.read' },
      { label: 'التصميم التنظيمي', labelEn: 'Org Design', href: '/cvision/od/design', icon: Network, permission: 'cvision.org.read' },
      { label: 'الثقافة', labelEn: 'Culture', href: '/cvision/od/culture', icon: Heart, permission: 'cvision.org.read' },
      { label: 'فعالية العمليات', labelEn: 'Processes', href: '/cvision/od/processes', icon: Activity, permission: 'cvision.org.read' },
      { label: 'المواءمة الاستراتيجية', labelEn: 'Alignment', href: '/cvision/od/alignment', icon: Compass, permission: 'cvision.org.read' },
    ],
  },
  {
    id: 'compliance', label: 'الامتثال', labelEn: 'Compliance',
    items: [
      { label: 'التقارير الحكومية', labelEn: 'Gov Reports', href: '/cvision/reports?tab=gov', icon: Landmark, permission: 'cvision.compliance.read' },
      { label: 'الامتثال والسلامة', labelEn: 'Compliance', href: '/cvision/compliance', icon: ShieldCheck, permission: 'cvision.compliance.read' },
      { label: 'السلامة المهنية', labelEn: 'Safety', href: '/cvision/safety', icon: HardHat, permission: 'cvision.safety.read' },
      { label: 'التدقيق', labelEn: 'Audit', href: '/cvision/access-control', icon: Eye, permission: 'cvision.audit.read' },
    ],
  },
  {
    id: 'reports', label: 'التقارير', labelEn: 'Reports',
    items: [
      { label: 'التقارير', labelEn: 'Reports', href: '/cvision/reports', icon: BarChart3, permission: 'cvision.reports.read' },
      { label: 'لوحات مخصصة', labelEn: 'Dashboards', href: '/cvision/dashboards', icon: PieChart, permission: 'cvision.reports.read' },
      { label: 'مستودع البيانات', labelEn: 'Data Warehouse', href: '/cvision/admin/data-warehouse', icon: Database, permission: 'cvision.config.write' },
      { label: 'ميزانية القوى العاملة', labelEn: 'Manpower', href: '/cvision/manpower', icon: Calculator, permission: 'cvision.payroll.read' },
      { label: 'الوظائف', labelEn: 'Positions', href: '/cvision/positions', icon: Users, permission: 'cvision.org.read' },
      { label: 'التحليلات', labelEn: 'Analytics', href: '/cvision/analytics', icon: BarChart3, permission: 'cvision.reports.read' },
      { label: 'ذكاء الأعمال', labelEn: 'BI', href: '/cvision/bi', icon: PieChart, permission: 'cvision.reports.read' },
      { label: 'محرك التقارير', labelEn: 'Report Engine', href: '/cvision/report-engine', icon: FileCode, permission: 'cvision.reports.read' },
      { label: 'الشرائح', labelEn: 'Segments', href: '/cvision/segments', icon: Layers, permission: 'cvision.reports.read' },
    ],
  },
  {
    id: 'self-service', label: 'خدمتي', labelEn: 'My Services',
    items: [
      { label: 'بوابة الموظف', labelEn: 'Self-Service', href: '/cvision/self-service', icon: User, permission: 'cvision.self_service' },
      { label: 'المساعد الذكي', labelEn: 'AI Assistant', href: '/cvision/chat', icon: Bot, permission: 'cvision.self_service' },
    ],
  },
  {
    id: 'admin', label: 'الإدارة', labelEn: 'Admin',
    items: [
      { label: 'إعدادات النظام', labelEn: 'Settings', href: '/cvision/admin/settings', icon: Settings, permission: 'cvision.config.write' },
      { label: 'سير العمل', labelEn: 'Workflows', href: '/cvision/admin/workflows', icon: Workflow, permission: 'cvision.workflows.write' },
      { label: 'الاستيراد', labelEn: 'Import', href: '/cvision/admin/import', icon: Upload, permission: 'cvision.import.execute' },
      { label: 'العمليات الجماعية', labelEn: 'Bulk Ops', href: '/cvision/admin/bulk', icon: Layers, permission: 'cvision.bulk_operations' },
      { label: 'Webhooks', labelEn: 'Webhooks', href: '/cvision/admin/webhooks', icon: Webhook, permission: 'cvision.config.write' },
      { label: 'المهام المجدولة', labelEn: 'Cron Jobs', href: '/cvision/admin/cron', icon: Timer, permission: 'cvision.config.write' },
      { label: 'API Docs', labelEn: 'API Docs', href: '/cvision/admin/api-docs', icon: FileCode, permission: 'cvision.config.write' },
      { label: 'سلة المحذوفات', labelEn: 'Recycle Bin', href: '/cvision/recycle-bin', icon: Trash2, permission: 'cvision.config.write' },
      { label: 'سير العمل المتقدم', labelEn: 'Workflow Builder', href: '/cvision/workflow-builder', icon: Workflow, permission: 'cvision.workflows.write' },
      { label: 'منشئ اللوحات', labelEn: 'Dashboard Builder', href: '/cvision/dashboard-builder', icon: PieChart, permission: 'cvision.config.write' },
      { label: 'التكاملات', labelEn: 'Integrations', href: '/cvision/integrations-mgr', icon: Plug, permission: 'cvision.config.write' },
      { label: 'الأمان', labelEn: 'Security', href: '/cvision/security', icon: Lock, permission: 'cvision.config.write' },
      { label: 'جودة البيانات', labelEn: 'Data Quality', href: '/cvision/data-quality', icon: Search, permission: 'cvision.config.write' },
      { label: 'التشخيصات', labelEn: 'Diagnostics', href: '/cvision/diagnostics', icon: Activity, permission: 'cvision.config.write' },
      { label: 'البيانات التجريبية', labelEn: 'Seed Data', href: '/cvision/seed', icon: Database, permission: 'cvision.config.write' },
    ],
  },
];
