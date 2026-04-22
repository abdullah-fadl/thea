'use client';

import { Users, SearchX, Plus, X } from 'lucide-react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionButton , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

interface EmptyStateProps {
  onAddEmployee: () => void;
  onClearFilters?: () => void;
  hasFilters: boolean;
}

export default function EmptyState({ onAddEmployee, onClearFilters, hasFilters }: EmptyStateProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  if (hasFilters) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingBottom: 80 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, width: 80, borderRadius: '50%', background: `${C.textMuted}10`, marginBottom: 16 }}>
          <SearchX style={{ width: 40, height: 40, color: `${C.textMuted}60` }} />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 4 }}>
          {tr('لا يوجد موظفون يطابقون الفلاتر', 'No employees match your filters')}
        </h3>
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 24, textAlign: 'center', maxWidth: 380 }}>
          {tr('حاول تعديل البحث أو معايير التصفية للعثور على أعضاء الفريق.', 'Try adjusting your search or filter criteria to find the team members you are looking for.')}
        </p>
        {onClearFilters && (
          <CVisionButton C={C} isDark={isDark} variant="outline" icon={<X style={{ width: 16, height: 16 }} />} onClick={onClearFilters}>
            {tr('مسح الفلاتر', 'Clear Filters')}
          </CVisionButton>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingBottom: 80 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, width: 80, borderRadius: '50%', background: `${C.textMuted}10`, marginBottom: 16 }}>
        <Users style={{ width: 40, height: 40, color: `${C.textMuted}60` }} />
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 4 }}>
        {tr('لا يوجد أعضاء فريق بعد', 'No team members yet')}
      </h3>
      <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 24, textAlign: 'center', maxWidth: 380 }}>
        {tr('ابدأ بإضافة أول موظف لبناء دليل الفريق.', 'Get started by adding your first employee to build your team directory.')}
      </p>
      <CVisionButton C={C} isDark={isDark} variant="primary" icon={<Plus style={{ width: 16, height: 16 }} />} onClick={onAddEmployee}>
        {tr('إضافة موظف', 'Add Employee')}
      </CVisionButton>
    </div>
  );
}
