'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionButton, CVisionDialog, CVisionDialogFooter, CVisionInput, CVisionLabel, CVisionSelect } from '@/components/cvision/ui';

import { useState, useEffect } from 'react';

import { Loader2 } from 'lucide-react';
import type { Grade, PositionFormData } from './types';


interface AddPositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobTitleId: string;
  departmentId: string;
  unitId?: string | null;
  grades: Grade[];
  saving: boolean;
  onSubmit: (jobTitleId: string, departmentId: string, unitId: string | null | undefined, form: PositionFormData) => Promise<void>;
}

const EMPTY_FORM: PositionFormData = { gradeId: '', title: '', budgetedHeadcount: 1 };

export default function AddPositionDialog({
  open, onOpenChange, jobTitleId, departmentId, unitId, grades, saving, onSubmit,
}: AddPositionDialogProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [form, setForm] = useState<PositionFormData>(EMPTY_FORM);

  useEffect(() => {
    if (!open) setForm(EMPTY_FORM);
  }, [open]);

  return (
    <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title={tr('إنشاء وظيفة', 'Create Position')} isDark={isDark}>
        <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{tr('إضافة وظيفة مخططة لهذا المسمى الوظيفي', 'Add a budgeted position for this job title')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <CVisionLabel C={C}>{tr('الدرجة (اختياري)', 'Grade (Optional)')}</CVisionLabel>
            <CVisionSelect
                C={C}
                value={form.gradeId}
                placeholder={tr('اختر الدرجة', 'Select grade')}
                options={grades.filter(g => !g.isArchived).map((g) => (
                  ({ value: g.id, label: `${g.code} - ${g.name}` })
                ))}
              />
          </div>
          <div>
            <CVisionLabel C={C}>{tr('المسمى (اختياري)', 'Title (Optional)')}</CVisionLabel>
            <CVisionInput C={C}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={tr('مثال: ممرضة العيادات', 'e.g., OPD Nurse')}
            />
          </div>
          <div>
            <CVisionLabel C={C}>{tr('العدد المخطط *', 'Budgeted Headcount *')}</CVisionLabel>
            <CVisionInput C={C}
              type="number"
              min="1"
              value={form.budgetedHeadcount}
              onChange={(e) => setForm({ ...form, budgetedHeadcount: parseInt(e.target.value) || 1 })}
            />
          </div>
          <CVisionButton C={C} isDark={isDark}
            onClick={() => onSubmit(jobTitleId, departmentId, unitId, form)}
            disabled={saving}
            style={{ width: '100%' }}
          >
            {saving && <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
            {tr('إنشاء وظيفة', 'Create Position')}
          </CVisionButton>
        </div>
    </CVisionDialog>
  );
}
