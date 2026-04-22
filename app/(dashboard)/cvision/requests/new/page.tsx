'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionTextarea, CVisionSelect , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { cvisionMutate } from '@/lib/cvision/hooks';

import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import {
  REQUEST_TYPE_LABELS,
  REQUEST_CONFIDENTIALITY_LABELS,
  REQUEST_SLA_HOURS,
} from '@/lib/cvision/constants';
export default function NewRequestPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    type: '',
    title: '',
    description: '',
    confidentiality: 'normal',
    targetManagerEmployeeId: '',
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => cvisionMutate<any>('/api/cvision/requests', 'POST', payload),
    onSuccess: (data) => {
      router.push(`/cvision/requests/${data.request.id}`);
    },
    onError: (err: any) => {
      setError(err.message);
    },
  });

  const loading = createMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.type || !formData.title || !formData.description) {
      setError('Please fill in all required fields');
      return;
    }

    setError(null);
    createMutation.mutate({
      type: formData.type,
      title: formData.title,
      description: formData.description,
      confidentiality: formData.confidentiality,
      targetManagerEmployeeId: formData.targetManagerEmployeeId || null,
    });
  }

  function getSlaInfo(type: string): string {
    if (!type) return '';
    const hours = REQUEST_SLA_HOURS[type] || 72;
    if (hours < 24) return `${hours} hours`;
    return `${Math.round(hours / 24)} days`;
  }

  return (
    <div style={{ padding: 24, maxWidth: 672 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <CVisionButton C={C} isDark={isDark} variant="ghost" onClick={() => router.back()}>
          <ArrowLeft style={{ width: 16, height: 16, marginRight: 8 }} />
          Back
        </CVisionButton>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>New Request</h1>
          <p className="text-gray-500">Submit a new HR request</p>
        </div>
      </div>

      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Request Details</div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {error && (
              <div style={{ padding: 12, background: C.redDim, border: `1px solid ${C.border}`, color: C.red, borderRadius: 8, fontSize: 13 }}>
                {error}
              </div>
            )}

            {/* Request Type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C} htmlFor="type">Request Type *</CVisionLabel>
              <CVisionSelect
                C={C}
                value={formData.type}
                onChange={(value) => setFormData({ ...formData, type: value })}
                placeholder="Select type"
                options={[...Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => (
                    ({ value: value, label: label })
                  ))]}
              />
              {formData.type && (
                <p style={{ fontSize: 12, color: C.textMuted }}>
                  SLA: {getSlaInfo(formData.type)}
                </p>
              )}
            </div>

            {/* Title */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C} htmlFor="title">Title *</CVisionLabel>
              <CVisionInput C={C}
                id="title"
                placeholder="Brief summary of your request"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                maxLength={500}
              />
            </div>

            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C} htmlFor="description">Description *</CVisionLabel>
              <CVisionTextarea C={C}
                id="description"
                placeholder="Provide details about your request..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={5}
                maxLength={5000}
              />
            </div>

            {/* Confidentiality */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C} htmlFor="confidentiality">Confidentiality Level</CVisionLabel>
              <CVisionSelect
                C={C}
                value={formData.confidentiality}
                onChange={(value) => setFormData({ ...formData, confidentiality: value })}
                options={[...Object.entries(REQUEST_CONFIDENTIALITY_LABELS).map(([value, label]) => (
                    ({ value: value, label: label })
                  ))]}
              />
              <p style={{ fontSize: 12, color: C.textMuted }}>
                {formData.confidentiality === 'normal' && 'Request will be visible to your manager.'}
                {formData.confidentiality === 'confidential' && 'Request will be sent directly to HR, bypassing your manager.'}
                {formData.confidentiality === 'anonymous' && 'Your identity will be protected. Request goes to HR.'}
              </p>
            </div>

            {/* Submit Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 16 }}>
              <CVisionButton C={C} isDark={isDark}
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancel
              </CVisionButton>
              <CVisionButton C={C} isDark={isDark} type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 style={{ width: 16, height: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send style={{ width: 16, height: 16, marginRight: 8 }} />
                    Submit Request
                  </>
                )}
              </CVisionButton>
            </div>
          </form>
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}
