'use client';

import { Users, UserCheck, Clock, Building2, TrendingUp } from 'lucide-react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionSkeletonCard , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import type { EmployeeListItem, DepartmentRef, StatsData } from './types';

interface StatsBarProps {
  stats: StatsData;
  loading?: boolean;
}

const STAT_CONFIG = [
  { key: 'total', labelAr: 'الإجمالي', labelEn: 'Total', icon: Users, color: '#3b82f6' },
  { key: 'active', labelAr: 'نشط', labelEn: 'Active', icon: UserCheck, color: '#22c55e' },
  { key: 'probation', labelAr: 'تحت التجربة', labelEn: 'Probation', icon: Clock, color: '#f59e0b' },
  { key: 'departmentCount', labelAr: 'الأقسام', labelEn: 'Departments', icon: Building2, color: '#a855f7' },
  { key: 'avgTenureMonths', labelAr: 'متوسط المدة', labelEn: 'Avg Tenure', icon: TrendingUp, color: '#06b6d4' },
] as const;

function formatStatValue(key: string, value: number): string {
  if (key === 'avgTenureMonths') {
    if (value === 0) return '\u2014';
    if (value < 12) return `${value}mo`;
    const y = Math.floor(value / 12);
    const m = value % 12;
    return m > 0 ? `${y}y ${m}mo` : `${y}y`;
  }
  return value.toString();
}

export function computeStats(employees: EmployeeListItem[], departments: DepartmentRef[]): StatsData {
  const active = employees.filter(e => e.status?.toUpperCase() === 'ACTIVE').length;
  const probation = employees.filter(e => e.status?.toUpperCase() === 'PROBATION').length;
  const uniqueDepts = new Set(departments.map(d => d.id)).size;

  const tenures = employees
    .filter(e => e.hireDate || e.hiredAt)
    .map(e => {
      const hired = new Date((e.hireDate || e.hiredAt)!);
      if (isNaN(hired.getTime())) return 0;
      const diffDays = (Date.now() - hired.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays > 0 ? diffDays / 30.44 : 0;
    })
    .filter(t => t > 0);

  const avgTenure = tenures.length > 0
    ? Math.round(tenures.reduce((a, b) => a + b, 0) / tenures.length)
    : 0;

  return {
    total: employees.length,
    active,
    probation,
    departmentCount: uniqueDepts,
    avgTenureMonths: avgTenure,
  };
}

export default function StatsBar({ stats, loading }: StatsBarProps) {
  const { C } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <CVisionSkeletonCard key={i} C={C} height={72} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
      {STAT_CONFIG.map((cfg) => {
        const Icon = cfg.icon;
        const value = stats[cfg.key as keyof StatsData];
        return (
          <div
            key={cfg.key}
            style={{
              borderLeft: isRTL ? 'none' : `4px solid ${cfg.color}`,
              borderRight: isRTL ? `4px solid ${cfg.color}` : 'none',
              background: C.bgCard,
              borderRadius: '0 8px 8px 0',
              padding: 12,
              border: `1px solid ${C.border}`,
              borderLeftWidth: isRTL ? 1 : 4,
              borderLeftColor: isRTL ? C.border : cfg.color,
              borderRightWidth: isRTL ? 4 : 1,
              borderRightColor: isRTL ? cfg.color : C.border,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Icon style={{ width: 14, height: 14, color: cfg.color }} />
              <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}>
                {tr(cfg.labelAr, cfg.labelEn)}
              </span>
            </div>
            <p style={{ fontSize: 20, fontWeight: 700, color: cfg.color }}>
              {formatStatValue(cfg.key, value)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
