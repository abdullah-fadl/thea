'use client';

import { ReactNode } from 'react';
import { useCVisionTheme, type CVisionPalette } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionButton } from '@/components/cvision/ui';

interface EmptyStateProps {
  icon?: string | ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  C?: CVisionPalette;
}

export default function EmptyState({ icon, title, description, action, C: externalC }: EmptyStateProps) {
  const theme = useCVisionTheme();
  const C = externalC || theme.C;
  const isDark = theme.isDark;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 16px',
        textAlign: 'center',
      }}
    >
      {icon && (
        <div style={{ marginBottom: 16, fontSize: 36 }}>
          {typeof icon === 'string' ? <span>{icon}</span> : icon}
        </div>
      )}
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: C.text }}>{title}</h3>
      {description && (
        <p style={{ fontSize: 13, color: C.textMuted, maxWidth: 360, marginBottom: 16 }}>{description}</p>
      )}
      {action && (
        <CVisionButton C={C} isDark={isDark} size="sm" onClick={action.onClick}>
          {action.label}
        </CVisionButton>
      )}
    </div>
  );
}

/** Predefined empty states for common CVision modules.
 *  Each entry carries both Arabic and English strings so callers can use
 *  `const tr = (ar, en) => language === 'ar' ? ar : en` to pick the right one.
 */
export const EMPTY_STATES = {
  employees: {
    icon: '👥',
    title: { ar: 'لا يوجد موظفون بعد', en: 'No employees yet' },
    description: { ar: 'أضف موظفك الأول للبدء.', en: 'Add your first employee to get started.' },
  },
  attendance: {
    icon: '🕐',
    title: { ar: 'لا توجد سجلات حضور', en: 'No attendance records' },
    description: { ar: 'ستظهر سجلات الحضور هنا بمجرد تسجيل الموظفين دخولهم.', en: 'Attendance records will appear here once employees check in.' },
  },
  payroll: {
    icon: '💰',
    title: { ar: 'لا توجد مسيرات رواتب', en: 'No payroll runs' },
    description: { ar: 'أنشئ أول مسيرة رواتب لمعالجة الرواتب.', en: 'Create your first payroll run to process salaries.' },
  },
  recruitment: {
    icon: '📋',
    title: { ar: 'لا توجد طلبات وظيفية', en: 'No job requisitions' },
    description: { ar: 'أنشئ طلب وظيفي لبدء التوظيف.', en: 'Create a job requisition to start hiring.' },
  },
  candidates: {
    icon: '🧑‍💼',
    title: { ar: 'لا يوجد مرشحون', en: 'No candidates' },
    description: { ar: 'سيظهر المرشحون هنا بمجرد تقدمهم.', en: 'Candidates will appear here once they apply.' },
  },
  scheduling: {
    icon: '📅',
    title: { ar: 'لا توجد ورديات مجدولة', en: 'No shifts scheduled' },
    description: { ar: 'قم بتعيين الورديات للموظفين أو استخدم الإنشاء التلقائي.', en: 'Assign shifts to employees or use auto-generate.' },
  },
  requests: {
    icon: '📝',
    title: { ar: 'لا توجد طلبات', en: 'No requests' },
    description: { ar: 'ستظهر طلبات الموظفين هنا.', en: 'Employee requests will appear here.' },
  },
  search: {
    icon: '🔍',
    title: { ar: 'لا توجد نتائج', en: 'No results found' },
    description: { ar: 'جرب بحثاً مختلفاً أو عدّل الفلاتر.', en: 'Try adjusting your search or filters.' },
  },
  recycleBin: {
    icon: '🗑️',
    title: { ar: 'سلة المحذوفات فارغة', en: 'Recycle bin is empty' },
    description: { ar: 'ستظهر العناصر المحذوفة هنا لمدة 30 يومًا قبل الحذف النهائي.', en: 'Deleted items will appear here for 30 days before permanent removal.' },
  },
  notifications: {
    icon: '🔔',
    title: { ar: 'لا توجد إشعارات', en: 'No notifications' },
    description: { ar: 'أنت مطلع على كل شيء!', en: "You're all caught up!" },
  },
} as const;
