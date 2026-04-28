'use client';

// =============================================================================
// DepartmentsListing — Hospital department overview
// =============================================================================

import { useRouter } from 'next/navigation';
import { useLang } from '@/hooks/use-lang';
import {
  Building2, ChevronRight, Activity, FlaskConical, Microscope, Scissors,
  Heart, Bone, Flower2, MonitorSmartphone, CircleDot,
} from 'lucide-react';
import { type LucideIcon } from 'lucide-react';

// ── Department config ─────────────────────────────────────────────────────────
const DEPARTMENTS: { slug: string; key: string; labelEn: string; labelAr: string; icon: LucideIcon; iconColor: string; href: string; color: string }[] = [
  { slug: 'opd',           key: 'OPD',            labelEn: 'Outpatient (OPD)',   labelAr: 'العيادات الخارجية',   icon: Building2,          iconColor: 'text-blue-500',    href: '/departments/opd',           color: 'border-blue-200 dark:border-blue-800 hover:border-blue-400' },
  { slug: 'laboratory',    key: 'LABORATORY',      labelEn: 'Laboratory',         labelAr: 'المختبر',             icon: FlaskConical,       iconColor: 'text-purple-500',  href: '/departments/laboratory',     color: 'border-purple-200 dark:border-purple-800 hover:border-purple-400' },
  { slug: 'radiology',     key: 'RADIOLOGY',       labelEn: 'Radiology',          labelAr: 'الأشعة',              icon: Microscope,         iconColor: 'text-cyan-500',    href: '/departments/radiology',      color: 'border-cyan-200 dark:border-cyan-800 hover:border-cyan-400' },
  { slug: 'or',            key: 'OPERATING_ROOM',  labelEn: 'Operating Room',     labelAr: 'غرفة العمليات',       icon: Scissors,           iconColor: 'text-red-500',     href: '/departments/or',             color: 'border-red-200 dark:border-red-800 hover:border-red-400' },
  { slug: 'cath-lab',      key: 'CATH_LAB',        labelEn: 'Cath Lab',           labelAr: 'مختبر القسطرة',       icon: Heart,              iconColor: 'text-rose-500',    href: '/departments/cath-lab',       color: 'border-rose-200 dark:border-rose-800 hover:border-rose-400' },
  { slug: 'physiotherapy', key: 'PHYSIOTHERAPY',   labelEn: 'Physiotherapy',      labelAr: 'العلاج الطبيعي',     icon: Bone,               iconColor: 'text-orange-500',  href: '/departments/physiotherapy',  color: 'border-orange-200 dark:border-orange-800 hover:border-orange-400' },
  { slug: 'delivery',      key: 'DELIVERY',        labelEn: 'Delivery / L&D',     labelAr: 'غرفة الولادة',        icon: Flower2,            iconColor: 'text-pink-500',    href: '/departments/delivery',       color: 'border-pink-200 dark:border-pink-800 hover:border-pink-400' },
  { slug: 'icu',           key: 'CRITICAL_CARE',   labelEn: 'Critical Care (ICU)', labelAr: 'العناية المركزة',   icon: MonitorSmartphone,  iconColor: 'text-indigo-500',  href: '/departments/icu',            color: 'border-indigo-200 dark:border-indigo-800 hover:border-indigo-400' },
  { slug: 'mortuary',      key: 'MORTUARY',        labelEn: 'Mortuary',           labelAr: 'المشرحة',            icon: CircleDot,          iconColor: 'text-muted-foreground',    href: '/departments/mortuary',       color: 'border-border hover:border-border' },
];

export default function DepartmentsListing() {
  const { language } = useLang();
  const isAr = language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);
  const router = useRouter();

  return (
    <div className="space-y-6 p-4">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-6 w-6 text-blue-500" />
          {tr('الأقسام', 'Hospital Departments')}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {tr('عرض وإدارة أقسام المستشفى', 'View and manage hospital departments')}
        </p>
      </div>

      {/* ── Departments Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {DEPARTMENTS.map(dept => (
          <button
            key={dept.key}
            onClick={() => router.push(dept.href)}
            className={`bg-card rounded-xl border-2 p-5 text-start hover:shadow-md transition cursor-pointer ${dept.color}`}
          >
            <div className="flex items-center justify-between mb-3">
              {(() => { const Icon = dept.icon; return <Icon className={`h-7 w-7 ${dept.iconColor}`} />; })()}
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground text-base mb-0.5">
              {isAr ? dept.labelAr : dept.labelEn}
            </h3>
            <p className="text-xs text-muted-foreground font-mono">{dept.key}</p>
          </button>
        ))}
      </div>

      {/* ── Quick Links ── */}
      <div className="mt-6 bg-muted/50/50 rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          {tr('روابط سريعة', 'Quick Links')}
        </h3>
        <div className="flex flex-wrap gap-2">
          {[
            { label: tr('تتبع التنقل', 'Dept. Tracking'), href: '/ipd/inpatient-dept-input' },
            { label: tr('الأسرة', 'Bed Setup'), href: '/ipd/bed-setup' },
            { label: tr('أسرة مباشر', 'Live Beds'), href: '/ipd/live-beds' },
            { label: tr('هيكل المستشفى', 'Structure'), href: '/admin/structure-management' },
          ].map(link => (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              className="text-xs px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 transition text-muted-foreground font-medium"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
