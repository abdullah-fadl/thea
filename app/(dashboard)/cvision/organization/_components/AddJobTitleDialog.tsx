'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionButton, CVisionDialog, CVisionDialogFooter, CVisionInput, CVisionLabel } from '@/components/cvision/ui';

import { useState, useEffect } from 'react';

import { Loader2 } from 'lucide-react';
import type { JobTitleFormData } from './types';


interface AddJobTitleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  departmentName: string;
  unitId?: string;
  unitName?: string;
  saving: boolean;
  onSubmit: (departmentId: string, unitId: string | undefined, form: JobTitleFormData) => Promise<void>;
}

const EMPTY_FORM: JobTitleFormData = { code: '', name: '', nameAr: '' };

export default function AddJobTitleDialog({
  open, onOpenChange, departmentId, departmentName, unitId, unitName, saving, onSubmit,
}: AddJobTitleDialogProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [form, setForm] = useState<JobTitleFormData>(EMPTY_FORM);

  useEffect(() => {
    if (!open) setForm(EMPTY_FORM);
  }, [open]);

  const description = unitName
    ? tr(`إضافة مسمى وظيفي جديد إلى ${unitName} (${departmentName})`, `Add a new job title to ${unitName} (${departmentName})`)
    : tr(`إضافة مسمى وظيفي مباشرة إلى ${departmentName} (بدون وحدة)`, `Add a job title directly to ${departmentName} (no unit)`);

  return (
    <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title={tr('إنشاء مسمى وظيفي', 'Create Job Title')} isDark={isDark}>
        <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{description}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <CVisionLabel C={C}>{tr('الرمز *', 'Code *')}</CVisionLabel>
            <CVisionInput C={C}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder={tr('مثال: SN, RN', 'e.g., SN, RN')}
            />
          </div>
          <div>
            <CVisionLabel C={C}>{tr('الاسم *', 'Name *')}</CVisionLabel>
            <CVisionInput C={C}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={tr('ممرض', 'Staff Nurse')}
            />
          </div>
          <div>
            <CVisionLabel C={C}>{tr('الاسم (بالعربية)', 'Name (Arabic)')}</CVisionLabel>
            <CVisionInput C={C}
              value={form.nameAr}
              onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
            />
          </div>
          <CVisionButton C={C} isDark={isDark} onClick={() => onSubmit(departmentId, unitId, form)} disabled={saving} style={{ width: '100%' }}>
            {saving && <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
            {tr('إنشاء', 'Create')}
          </CVisionButton>
        </div>
    </CVisionDialog>
  );
}
