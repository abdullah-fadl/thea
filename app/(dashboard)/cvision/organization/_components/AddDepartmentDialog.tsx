'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionButton, CVisionDialog, CVisionDialogFooter, CVisionInput, CVisionLabel, CVisionSelect } from '@/components/cvision/ui';

import { useState, useEffect } from 'react';

import { Loader2 } from 'lucide-react';
import type { DeptFormData, EmployeeOption } from './types';


interface AddDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  allEmployees: EmployeeOption[];
  onLoadAllEmployees: () => void;
  onSubmit: (form: DeptFormData) => Promise<void>;
}

const EMPTY_FORM: DeptFormData = { code: '', name: '', nameAr: '', managerId: '' };

export default function AddDepartmentDialog({
  open, onOpenChange, saving, allEmployees, onLoadAllEmployees, onSubmit,
}: AddDepartmentDialogProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [form, setForm] = useState<DeptFormData>(EMPTY_FORM);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) setForm(EMPTY_FORM);
  }, [open]);

  return (
    <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title={tr('إنشاء قسم', 'Create Department')} isDark={isDark}>
        <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{tr('إضافة قسم جديد للمنظمة', 'Add a new department to the organization')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <CVisionLabel C={C}>{tr('الرمز *', 'Code *')}</CVisionLabel>
            <CVisionInput C={C}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder={tr('مثال: NS, HR', 'e.g., NS, HR')}
            />
          </div>
          <div>
            <CVisionLabel C={C}>{tr('الاسم *', 'Name *')}</CVisionLabel>
            <CVisionInput C={C}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={tr('التمريض', 'Nursing')}
            />
          </div>
          <div>
            <CVisionLabel C={C}>{tr('الاسم (بالعربية)', 'Name (Arabic)')}</CVisionLabel>
            <CVisionInput C={C}
              value={form.nameAr}
              onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
            />
          </div>
          <div>
            <CVisionLabel C={C}>{tr('المدير', 'Manager')}</CVisionLabel>
            <CVisionSelect
                C={C}
                value={form.managerId || 'none'}
                onChange={(v) => setForm({ ...form, managerId: v === 'none' ? '' : v })}
                placeholder={tr('اختر المدير', 'Select manager')}
                options={[{ value: 'none', label: tr('لا يوجد', 'None') }, ...allEmployees.map((emp) => (
                  ({ value: emp.id, label: `${emp.firstName} ${emp.lastName} (${emp.employeeNo})` })
                ))]}
              />
          </div>
          <CVisionButton C={C} isDark={isDark} onClick={() => onSubmit(form)} disabled={saving} style={{ width: '100%' }}>
            {saving && <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
            {tr('إنشاء', 'Create')}
          </CVisionButton>
        </div>
    </CVisionDialog>
  );
}
