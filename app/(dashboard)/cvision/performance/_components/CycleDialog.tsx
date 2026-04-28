'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionButton, CVisionDialog, CVisionDialogFooter, CVisionInput, CVisionLabel } from '@/components/cvision/ui';

import { useState, useEffect } from 'react';

import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CycleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function CycleDialog({
  open,
  onOpenChange,
  onSuccess,
}: CycleDialogProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const currentYear = new Date().getFullYear();
  const [name, setName] = useState(`${currentYear} Annual Performance Review`);
  const [nameAr, setNameAr] = useState('');
  const [year, setYear] = useState(String(currentYear));
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-12-31`);
  const [selfDeadline, setSelfDeadline] = useState(`${currentYear}-02-15`);
  const [managerDeadline, setManagerDeadline] = useState(`${currentYear}-02-28`);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      const y = new Date().getFullYear();
      setName(`${y} Annual Performance Review`);
      setNameAr('');
      setYear(String(y));
      setStartDate(`${y}-01-01`);
      setEndDate(`${y}-12-31`);
      setSelfDeadline(`${y}-02-15`);
      setManagerDeadline(`${y}-02-28`);
    }
  }, [open]);

  async function handleSubmit() {
    if (!name.trim() || !year || !startDate || !endDate) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/cvision/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'create-cycle',
          name: name.trim(),
          nameAr: nameAr.trim() || name.trim(),
          year: Number(year),
          startDate,
          endDate,
          selfReviewDeadline: selfDeadline || endDate,
          managerReviewDeadline: managerDeadline || endDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create review cycle');
      }

      toast({
        title: 'Review Cycle Created',
        description: `${data.reviewsCreated} employee reviews initialized.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create review cycle',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title={tr('دورة مراجعة جديدة', 'New Review Cycle')} isDark={isDark}>
        <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
          {tr('إنشاء دورة مراجعة أداء جديدة. سيتم إنشاء المراجعات تلقائيًا لجميع الموظفين النشطين.', 'Create a new performance review cycle. Reviews will be auto-created for all active employees.')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C} htmlFor="cycle-name">{tr('اسم الدورة *', 'Cycle Name *')}</CVisionLabel>
              <CVisionInput C={C}
                id="cycle-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 2026 Annual Review"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C} htmlFor="cycle-year">{tr('السنة *', 'Year *')}</CVisionLabel>
              <CVisionInput C={C}
                id="cycle-year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                min={2020}
                max={2040}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CVisionLabel C={C} htmlFor="cycle-name-ar">{tr('الاسم (بالعربية)', 'Name (Arabic)')}</CVisionLabel>
            <CVisionInput C={C}
              id="cycle-name-ar"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C} htmlFor="cycle-start">{tr('بداية الفترة *', 'Period Start *')}</CVisionLabel>
              <CVisionInput C={C}
                id="cycle-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C} htmlFor="cycle-end">{tr('نهاية الفترة *', 'Period End *')}</CVisionLabel>
              <CVisionInput C={C}
                id="cycle-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C} htmlFor="self-deadline">Self-Review Deadline</CVisionLabel>
              <CVisionInput C={C}
                id="self-deadline"
                type="date"
                value={selfDeadline}
                onChange={(e) => setSelfDeadline(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C} htmlFor="mgr-deadline">Manager Review Deadline</CVisionLabel>
              <CVisionInput C={C}
                id="mgr-deadline"
                type="date"
                value={managerDeadline}
                onChange={(e) => setManagerDeadline(e.target.value)}
              />
            </div>
          </div>
        </div>

        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark}
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {tr('إلغاء', 'Cancel')}
          </CVisionButton>
          <CVisionButton C={C} isDark={isDark}
            onClick={handleSubmit}
            disabled={submitting || !name.trim() || !year || !startDate || !endDate}
          >
            {submitting && <Loader2 style={{ marginRight: 8, height: 16, width: 16, animation: 'spin 1s linear infinite' }} />}
            {tr('إنشاء دورة', 'Create Cycle')}
          </CVisionButton>
        </CVisionDialogFooter>
    </CVisionDialog>
  );
}
