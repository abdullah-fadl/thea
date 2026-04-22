'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionButton, CVisionDialog, CVisionDialogFooter, CVisionInput, CVisionLabel, CVisionTextarea, CVisionSelect } from '@/components/cvision/ui';

import { useState, useEffect } from 'react';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  REQUEST_TYPE_LABELS,
  REQUEST_PRIORITY_LABELS,
  REQUEST_CONFIDENTIALITY_LABELS,
  REQUEST_SLA_HOURS,
} from '@/lib/cvision/constants';

interface NewRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const TYPE_TITLE_SUGGESTIONS: Record<string, string> = {
  leave: 'Leave Request',
  salary_certificate: 'Salary Certificate Request',
  employment_letter: 'Employment Verification Letter',
  expense_claim: 'Expense Claim',
  complaint: '',
  transfer: 'Transfer Request',
  training: 'Training Program Request',
  equipment: 'Equipment Request',
  payroll_issue: 'Payroll Issue',
  other: '',
};

export default function NewRequestDialog({ open, onOpenChange, onSuccess }: NewRequestDialogProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [type, setType] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [confidentiality, setConfidentiality] = useState('normal');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setType('');
      setTitle('');
      setDescription('');
      setPriority('medium');
      setConfidentiality('normal');
    }
  }, [open]);

  // Auto-suggest title when type changes
  useEffect(() => {
    if (type && !title) {
      const suggestion = TYPE_TITLE_SUGGESTIONS[type];
      if (suggestion) {
        setTitle(suggestion);
      }
    }
  }, [type]);

  async function handleSubmit() {
    if (!type || !title.trim() || !description.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/cvision/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
          priority,
          confidentiality,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to create request');
      }

      toast({
        title: 'Request Created',
        description: `Request ${data.request?.requestNumber || ''} has been submitted successfully.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create request',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const slaHours = type ? (REQUEST_SLA_HOURS[type] || REQUEST_SLA_HOURS.other) : null;

  return (
    <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title={tr('طلب جديد', 'New Request')} isDark={isDark}>
        <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
          {tr('تقديم طلب موارد بشرية جديد. جميع الحقول المميزة بـ * مطلوبة.', 'Submit a new HR request. All fields marked with * are required.')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8 }}>
          {/* Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CVisionLabel C={C} htmlFor="req-type">Request Type *</CVisionLabel>
            <CVisionSelect
                C={C}
                value={type}
                onChange={setType}
                placeholder="Select request type"
                options={Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => (
                  ({ value: value, label: label })
                ))}
              />
            {slaHours !== null && (
              <p style={{ fontSize: 12, color: C.textMuted }}>
                SLA: {slaHours < 24 ? `${slaHours} hours` : `${Math.round(slaHours / 24)} days`} response time
              </p>
            )}
          </div>

          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CVisionLabel C={C} htmlFor="req-title">Title *</CVisionLabel>
            <CVisionInput C={C}
              id="req-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief title for your request"
              maxLength={500}
            />
          </div>

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CVisionLabel C={C} htmlFor="req-desc">Description *</CVisionLabel>
            <CVisionTextarea C={C}
              id="req-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide details about your request..."
              rows={4}
              maxLength={5000}
            />
          </div>

          {/* Priority */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CVisionLabel C={C}>Priority</CVisionLabel>
            <RadioGroup
              value={priority}
              onValueChange={setPriority}
              style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}
            >
              {Object.entries(REQUEST_PRIORITY_LABELS).map(([value, label]) => (
                <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RadioGroupItem value={value} id={`priority-${value}`} />
                  <CVisionLabel C={C} htmlFor={`priority-${value}`} style={{ fontSize: 13, cursor: 'pointer' }}>
                    {label}
                  </CVisionLabel>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Confidentiality */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CVisionLabel C={C}>Confidentiality</CVisionLabel>
            <RadioGroup
              value={confidentiality}
              onValueChange={setConfidentiality}
              style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}
            >
              {Object.entries(REQUEST_CONFIDENTIALITY_LABELS).map(([value, label]) => (
                <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RadioGroupItem value={value} id={`conf-${value}`} />
                  <CVisionLabel C={C} htmlFor={`conf-${value}`} style={{ fontSize: 13, cursor: 'pointer' }}>
                    {label}
                  </CVisionLabel>
                </div>
              ))}
            </RadioGroup>
            {confidentiality !== 'normal' && (
              <p style={{ fontSize: 12, color: C.textMuted }}>
                {confidentiality === 'confidential'
                  ? 'This request will be routed directly to HR, bypassing your manager.'
                  : 'This request will be anonymous and routed directly to HR.'}
              </p>
            )}
          </div>
        </div>

        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {tr('إلغاء', 'Cancel')}
          </CVisionButton>
          <CVisionButton C={C} isDark={isDark} onClick={handleSubmit} disabled={submitting || !type || !title.trim() || !description.trim()}>
            {submitting && <Loader2 style={{ marginRight: 8, height: 16, width: 16, animation: 'spin 1s linear infinite' }} />}
            {tr('تقديم الطلب', 'Submit Request')}
          </CVisionButton>
        </CVisionDialogFooter>
    </CVisionDialog>
  );
}
