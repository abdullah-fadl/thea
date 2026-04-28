'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionButton, CVisionDialog, CVisionDialogFooter, CVisionInput, CVisionLabel, CVisionSelect } from '@/components/cvision/ui';

import { useState, useEffect } from 'react';

import { Loader2 } from 'lucide-react';
import type { Grade, GradeFormData } from './types';


interface AddGradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobTitleId: string;
  jobTitleName: string;
  /** Grades not already linked to this job title */
  existingGrades: Grade[];
  saving: boolean;
  onSubmit: (jobTitleId: string, gradeForm: GradeFormData, existingGradeId: string) => Promise<void>;
}

const EMPTY_FORM: GradeFormData = { code: '', name: '', nameAr: '', level: 1 };

export default function AddGradeDialog({
  open, onOpenChange, jobTitleId, jobTitleName, existingGrades, saving, onSubmit,
}: AddGradeDialogProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [form, setForm] = useState<GradeFormData>(EMPTY_FORM);
  const [selectedExistingGradeId, setSelectedExistingGradeId] = useState('');

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setSelectedExistingGradeId('');
    }
  }, [open]);

  const handleExistingSelect = (v: string) => {
    setSelectedExistingGradeId(v);
    if (v && v !== 'new') {
      const g = existingGrades.find(gr => gr.id === v);
      if (g) setForm({ code: g.code, name: g.name, nameAr: g.nameAr || '', level: g.level });
    } else {
      setForm(EMPTY_FORM);
    }
  };

  const isNewMode = !selectedExistingGradeId || selectedExistingGradeId === 'new';

  return (
    <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title={tr('إضافة درجة', 'Add Grade')} isDark={isDark}>
        <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
          {tr(`اختر درجة موجودة أو أنشئ درجة جديدة لـ "${jobTitleName}"`, `Select existing or create new grade for "${jobTitleName}"`)}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <CVisionLabel C={C}>{tr('اختر درجة موجودة', 'Select Existing Grade')}</CVisionLabel>
            <CVisionSelect
                C={C}
                value={selectedExistingGradeId}
                onChange={handleExistingSelect}
                placeholder={tr('اختر أو أنشئ جديد', 'Select or create new')}
                options={[
                  { value: 'new', label: tr('+ إنشاء درجة جديدة', '+ Create New Grade') },
                  ...existingGrades.map((g) => (
                  ({ value: g.id, label: `${g.code} - ${g.name}` })
                )),
                ]}
              />
          </div>

          {isNewMode && (
            <>
              <div>
                <CVisionLabel C={C}>{tr('الرمز *', 'Code *')}</CVisionLabel>
                <CVisionInput C={C} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder={tr('مثال: G1', 'e.g., G1')} />
              </div>
              <div>
                <CVisionLabel C={C}>{tr('الاسم *', 'Name *')}</CVisionLabel>
                <CVisionInput C={C} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={tr('الدرجة 1', 'Grade 1')} />
              </div>
              <div>
                <CVisionLabel C={C}>{tr('الاسم (بالعربية)', 'Name (Arabic)')}</CVisionLabel>
                <CVisionInput C={C} value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
              </div>
              <div>
                <CVisionLabel C={C}>{tr('المستوى', 'Level')}</CVisionLabel>
                <CVisionInput C={C} type="number" min="1" value={form.level} onChange={(e) => setForm({ ...form, level: parseInt(e.target.value) || 1 })} />
              </div>
            </>
          )}

          <CVisionButton C={C} isDark={isDark}
            onClick={() => onSubmit(jobTitleId, form, selectedExistingGradeId)}
            disabled={saving}
            style={{ width: '100%' }}
          >
            {saving && <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
            {isNewMode ? tr('إنشاء درجة', 'Create Grade') : tr('ربط درجة', 'Link Grade')}
          </CVisionButton>
        </div>
    </CVisionDialog>
  );
}
