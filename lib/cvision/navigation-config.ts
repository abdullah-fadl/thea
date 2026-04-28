/**
 * CVision Navigation Config — Single Source of Truth
 *
 * BOTH the top nav bar (layout.tsx) AND the sidebar (Sidebar.tsx)
 * render from this ONE config. If you add a page, add it here ONCE.
 *
 * Rules:
 *  - Every item MUST have a corresponding page.tsx
 *  - Order here = order in BOTH nav surfaces
 *  - Dropdowns with 0 visible children are auto-hidden
 */

import {
  LayoutDashboard,
  Users,
  Clock,
  Briefcase,
  DollarSign,
  Building2,
  GitBranch,
  CalendarDays,
  Layers,
  FileText,
  Globe,
  MessageSquare,
  Calendar,
  BarChart,
  ClipboardList,
  Scale,
  CreditCard,
  Star,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  PieChart,
  FlaskConical,
  Sparkles,
  Brain,
  GraduationCap,
  ShieldCheck,
  BookOpen,
  Code2,
  Settings,
  HelpCircle,
  Plug,
  Wrench,
  Heart,
  Banknote,
  Trophy,
  Plane,
  Bell,
  ClipboardCheck,
  Home,
  Package,
  Shield,
  MessageCircle,
  Target,
  Activity,
  Contact,
  Wallet,
  KeyRound,
  Bus,
  UtensilsCrossed,
  ShieldAlert,
  Workflow,
  UsersRound,
  Gauge,
  HardHat,
  Megaphone,
  Tags,
  HeartPulse,
  Lightbulb,
  Upload,
  Timer,
  LineChart,
  Database,
  Blocks,
  FolderOpen,
  Star as StarIcon,
  Trash2,
  Sprout,
  ListChecks,
  Lock,
  ScanSearch,
  Network,
  Compass,
  Zap,
  Webhook,
  Search,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────

export interface CvisionNavItem {
  title: string;
  titleAr: string;
  href: string;
  icon: any;
  devOnly?: boolean;
}

export interface CvisionNavGroup {
  title: string;
  titleAr: string;
  icon: any;
  children: CvisionNavItem[];
}

export type CvisionNavEntry =
  | (CvisionNavItem & { kind: 'link' })
  | (CvisionNavGroup & { kind: 'group' });

// ─── Main Tabs (top-level direct links — no dropdown) ────────────────

export const cvisionMainTabs: CvisionNavItem[] = [
  { title: 'Dashboard',    titleAr: 'لوحة المعلومات',   href: '/cvision',             icon: LayoutDashboard },
  { title: 'Employees',    titleAr: 'الموظفون',          href: '/cvision/employees',   icon: Users },
  { title: 'Attendance',   titleAr: 'الحضور',            href: '/cvision/attendance',  icon: Clock },
  { title: 'Recruitment',  titleAr: 'التوظيف',           href: '/cvision/recruitment', icon: Briefcase },
  { title: 'Payroll',      titleAr: 'الرواتب',           href: '/cvision/payroll',     icon: DollarSign },
  { title: 'Self-Service', titleAr: 'الخدمة الذاتية',   href: '/cvision/self-service', icon: Home },
  { title: 'Directory',    titleAr: 'الدليل',            href: '/cvision/directory',   icon: Contact },
];

// ─── Dropdown Groups ─────────────────────────────────────────────────

export const cvisionOperationsGroup: CvisionNavGroup = {
  title: 'Operations',
  titleAr: 'العمليات',
  icon: Settings,
  children: [
    { title: 'Organization',   titleAr: 'الهيكل التنظيمي',  href: '/cvision/organization',   icon: Building2 },
    { title: 'Units',          titleAr: 'الوحدات',           href: '/cvision/units',          icon: Layers },
    { title: 'Positions',      titleAr: 'المناصب',           href: '/cvision/positions',      icon: Briefcase },
    { title: 'Scheduling',     titleAr: 'الجدولة',           href: '/cvision/scheduling',     icon: CalendarDays },
    { title: 'Communications', titleAr: 'الاتصالات',         href: '/cvision/communications', icon: MessageSquare },
    { title: 'Appointments',   titleAr: 'المواعيد',          href: '/cvision/bookings',       icon: Calendar },
    { title: 'Manpower',       titleAr: 'القوى العاملة',     href: '/cvision/manpower/plans', icon: BarChart },
    { title: 'Gov. Reports',   titleAr: 'التقارير الحكومية', href: '/cvision/reports',        icon: FileText },
    { title: 'Muqeem',         titleAr: 'مقيم',              href: '/cvision/muqeem',         icon: Globe },
    { title: 'Training',       titleAr: 'التدريب',           href: '/cvision/training',       icon: GraduationCap },
    { title: 'Recognition',    titleAr: 'التقدير',           href: '/cvision/recognition',    icon: Trophy },
    { title: 'Onboarding',     titleAr: 'الاستقبال الوظيفي', href: '/cvision/onboarding',    icon: ClipboardCheck },
    { title: 'Calendar',       titleAr: 'التقويم',           href: '/cvision/calendar',       icon: Calendar },
    { title: 'Surveys',        titleAr: 'الاستبيانات',       href: '/cvision/surveys',        icon: MessageCircle },
    { title: 'Assets',         titleAr: 'الأصول',            href: '/cvision/assets',         icon: Package },
    { title: 'Housing',        titleAr: 'السكن',             href: '/cvision/housing',        icon: Home },
    { title: 'Paycards',       titleAr: 'بطاقات الرواتب',    href: '/cvision/paycards',       icon: Wallet },
    { title: 'Transport',      titleAr: 'النقل',             href: '/cvision/transport',      icon: Bus },
    { title: 'Cafeteria',      titleAr: 'الكافيتيريا',       href: '/cvision/cafeteria',      icon: UtensilsCrossed },
    { title: 'Safety',         titleAr: 'السلامة',           href: '/cvision/safety',         icon: ShieldAlert },
    { title: 'Teams',          titleAr: 'الفرق',             href: '/cvision/teams',          icon: UsersRound },
    { title: 'Announcements',  titleAr: 'الإعلانات',         href: '/cvision/announcements',  icon: Megaphone },
    { title: 'Branches',       titleAr: 'الفروع',            href: '/cvision/branches',       icon: Building2 },
    { title: 'Timesheets',     titleAr: 'الجداول الزمنية',   href: '/cvision/timesheets',     icon: Timer },
    { title: 'Documents',      titleAr: 'المستندات',         href: '/cvision/documents',      icon: FolderOpen },
    { title: 'Change Mgmt',    titleAr: 'إدارة التغيير',     href: '/cvision/od/change',      icon: Workflow },
  ],
};

export const cvisionHRGroup: CvisionNavGroup = {
  title: 'HR',
  titleAr: 'الموارد البشرية',
  icon: ClipboardList,
  children: [
    { title: 'Contracts',      titleAr: 'العقود',                href: '/cvision/contracts',      icon: FileText },
    { title: 'Leaves',         titleAr: 'الإجازات',              href: '/cvision/leaves',         icon: CalendarDays },
    { title: 'Requests',       titleAr: 'الطلبات',               href: '/cvision/requests',       icon: FileText },
    { title: 'Performance',    titleAr: 'الأداء',                href: '/cvision/performance',    icon: Star },
    { title: 'Promotions',     titleAr: 'الترقيات',              href: '/cvision/promotions',     icon: TrendingUp },
    { title: 'Disciplinary',   titleAr: 'الإجراءات التأديبية',   href: '/cvision/disciplinary',   icon: AlertTriangle },
    { title: 'Investigations', titleAr: 'التحقيقات',             href: '/cvision/investigations', icon: Scale },
    { title: 'Insurance',      titleAr: 'التأمين',               href: '/cvision/insurance',      icon: Heart },
    { title: 'Compensation',   titleAr: 'التعويضات',             href: '/cvision/compensation',   icon: DollarSign },
    { title: 'Travel',         titleAr: 'السفر',                 href: '/cvision/travel',         icon: Plane },
    { title: 'Policies',       titleAr: 'سياسات الشركة',         href: '/cvision/policies',       icon: BookOpen },
    { title: 'Letters',        titleAr: 'الخطابات',              href: '/cvision/letters',        icon: FileText },
    { title: 'Grievances',     titleAr: 'التظلمات',              href: '/cvision/grievances',     icon: Shield },
    { title: 'Segments',       titleAr: 'الشرائح',               href: '/cvision/segments',       icon: Tags },
    { title: 'Wellness',       titleAr: 'الرفاهية',              href: '/cvision/wellness',       icon: HeartPulse },
    { title: 'Engagement',     titleAr: 'الانخراط الوظيفي',      href: '/cvision/engagement',     icon: Lightbulb },
  ],
};

export const cvisionAnalyticsGroup: CvisionNavGroup = {
  title: 'Analytics',
  titleAr: 'التحليلات',
  icon: BarChart3,
  children: [
    { title: 'Dashboard',     titleAr: 'لوحة المعلومات',    href: '/cvision/analytics',   icon: BarChart3 },
    { title: 'BI',            titleAr: 'ذكاء الأعمال',      href: '/cvision/bi',           icon: PieChart },
    { title: 'What-If',       titleAr: 'ماذا لو',           href: '/cvision/whatif',       icon: FlaskConical },
    { title: 'Succession',    titleAr: 'التعاقب الوظيفي',   href: '/cvision/succession',   icon: GitBranch },
    { title: 'Headcount',     titleAr: 'الأعداد الوظيفية',  href: '/cvision/headcount',    icon: Target },
    { title: 'Report Engine', titleAr: 'محرك التقارير',     href: '/cvision/reports',      icon: Activity },
    { title: 'KPIs & OKRs',   titleAr: 'الأهداف',           href: '/cvision/okrs',         icon: Gauge },
    { title: 'Compliance',    titleAr: 'الامتثال',          href: '/cvision/compliance',   icon: Scale },
    { title: 'Predictive',    titleAr: 'التنبؤات',          href: '/cvision/predictive',   icon: LineChart },
    { title: 'Org Health',    titleAr: 'صحة المنظمة',       href: '/cvision/od/health',    icon: HeartPulse },
    { title: 'Org Design',    titleAr: 'التصميم التنظيمي',  href: '/cvision/od/design',    icon: Network },
    { title: 'Culture',       titleAr: 'الثقافة التنظيمية', href: '/cvision/od/culture',   icon: Heart },
    { title: 'Processes',     titleAr: 'العمليات',          href: '/cvision/od/processes', icon: Workflow },
    { title: 'Alignment',     titleAr: 'المواءمة',          href: '/cvision/od/alignment', icon: Compass },
    { title: 'Dashboards',    titleAr: 'لوحات البيانات',    href: '/cvision/dashboards',   icon: Blocks },
  ],
};

export const cvisionAIGroup: CvisionNavGroup = {
  title: 'AI',
  titleAr: 'الذكاء الاصطناعي',
  icon: Sparkles,
  children: [
    { title: 'Retention AI',  titleAr: 'الاستبقاء الذكي',       href: '/cvision/retention',     icon: Brain },
    { title: 'Skills Matrix', titleAr: 'مصفوفة المهارات',        href: '/cvision/ai/skills',     icon: GraduationCap },
    { title: 'AI Governance', titleAr: 'حوكمة الذكاء الاصطناعي', href: '/cvision/ai/governance', icon: ShieldCheck },
    { title: 'Algorithms',    titleAr: 'الخوارزميات',            href: '/cvision/ai/algorithms', icon: BookOpen },
    { title: 'AI Assistant',  titleAr: 'المساعد الذكي',          href: '/cvision/chat',          icon: MessageCircle },
  ],
};

export const cvisionDeveloperGroup: CvisionNavGroup = {
  title: 'Developer',
  titleAr: 'المطوّر',
  icon: Code2,
  children: [
    { title: 'API Docs',        titleAr: 'وثائق API',           href: '/cvision/api-docs',            icon: BookOpen },
    { title: 'Settings',        titleAr: 'الإعدادات',           href: '/cvision/settings',            icon: Settings },
    { title: 'Help Center',     titleAr: 'المساعدة',            href: '/cvision/help',                icon: HelpCircle },
    { title: 'Integrations',    titleAr: 'التكاملات',           href: '/cvision/integrations',        icon: Plug },
    { title: 'Connectors',      titleAr: 'الموصلات',            href: '/cvision/integrations-mgr',   icon: Activity },
    { title: 'Workflows',       titleAr: 'سير العمل',           href: '/cvision/admin/workflows',     icon: Workflow },
    { title: 'Access Control',  titleAr: 'التحكم بالوصول',      href: '/cvision/access-control',      icon: KeyRound },
    { title: 'Import/Export',   titleAr: 'الاستيراد والتصدير',  href: '/cvision/admin/import',        icon: Upload },
    { title: 'System Admin',    titleAr: 'إدارة النظام',        href: '/cvision/admin/settings',      icon: Database },
    { title: 'Notifications',   titleAr: 'الإشعارات',           href: '/cvision/notifications',       icon: Bell },
    { title: 'Bulk Ops',        titleAr: 'العمليات الجماعية',   href: '/cvision/admin/bulk',          icon: Zap },
    { title: 'Webhooks',        titleAr: 'ويب هوكس',            href: '/cvision/admin/webhooks',      icon: Webhook },
    { title: 'Recycle Bin',     titleAr: 'سلة المحذوفات',       href: '/cvision/recycle-bin',         icon: Trash2 },
    { title: 'Background Jobs', titleAr: 'المهام الخلفية',      href: '/cvision/jobs',                icon: ListChecks },
    { title: 'Demo Data',       titleAr: 'بيانات تجريبية',      href: '/cvision/seed',                icon: Sprout },
    { title: 'Data Quality',    titleAr: 'جودة البيانات',       href: '/cvision/data-quality',        icon: ScanSearch },
    { title: 'Security',        titleAr: 'الأمان',              href: '/cvision/security',            icon: Lock },
    { title: 'Data Warehouse',  titleAr: 'مستودع البيانات',     href: '/cvision/admin/data-warehouse', icon: Database },
    { title: 'Cron Jobs',       titleAr: 'المهام المجدولة',     href: '/cvision/admin/cron',          icon: Timer },
    { title: 'API Docs',        titleAr: 'وثائق API',           href: '/cvision/admin/api-docs',      icon: Code2 },
    { title: 'Diagnostics',     titleAr: 'التشخيصات',           href: '/cvision/diagnostics',         icon: Wrench, devOnly: true },
  ],
};

// ─── All groups in order ─────────────────────────────────────────────

export const cvisionDropdownGroups: CvisionNavGroup[] = [
  cvisionOperationsGroup,
  cvisionHRGroup,
  cvisionAnalyticsGroup,
  cvisionAIGroup,
  cvisionDeveloperGroup,
];

// ─── Full ordered config (useful for sidebar) ────────────────────────

export const cvisionFullNav: CvisionNavEntry[] = [
  ...cvisionMainTabs.map((t) => ({ ...t, kind: 'link' as const })),
  ...cvisionDropdownGroups.map((g) => ({ ...g, kind: 'group' as const })),
];
