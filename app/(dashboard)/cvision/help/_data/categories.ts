import {
  Rocket, Users, CalendarDays, Wallet, Palmtree, ClipboardList,
  Star, Bot, Landmark, Settings, Plug, BarChart3,
} from 'lucide-react';

export interface Category {
  id: string;
  title: string;
  icon: any;
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: 'getting-started', title: 'Getting Started',         icon: Rocket,        color: 'text-blue-600 bg-blue-50' },
  { id: 'employees',       title: 'Employees',               icon: Users,         color: 'text-violet-600 bg-violet-50' },
  { id: 'attendance',      title: 'Attendance',              icon: CalendarDays,  color: 'text-emerald-600 bg-emerald-50' },
  { id: 'payroll',         title: 'Payroll',                 icon: Wallet,        color: 'text-amber-600 bg-amber-50' },
  { id: 'leave',           title: 'Leave',                   icon: Palmtree,      color: 'text-teal-600 bg-teal-50' },
  { id: 'recruitment',     title: 'Recruitment',             icon: ClipboardList, color: 'text-pink-600 bg-pink-50' },
  { id: 'performance',     title: 'Performance',             icon: Star,          color: 'text-yellow-600 bg-yellow-50' },
  { id: 'ai',              title: 'AI Features',             icon: Bot,           color: 'text-indigo-600 bg-indigo-50' },
  { id: 'government',      title: 'Government & Compliance', icon: Landmark,      color: 'text-red-600 bg-red-50' },
  { id: 'settings',        title: 'Settings & Admin',        icon: Settings,      color: 'text-gray-600 bg-gray-100' },
  { id: 'integrations',    title: 'Integrations',            icon: Plug,          color: 'text-cyan-600 bg-cyan-50' },
  { id: 'reports',         title: 'Reports',                 icon: BarChart3,     color: 'text-orange-600 bg-orange-50' },
];
