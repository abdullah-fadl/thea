'use client';

import React from 'react';
import { CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

/**
 * Error boundary wrapping the Employment card so a rendering crash
 * does not take down the whole profile page.
 */
export default class EmploymentFormErrorBoundary extends React.Component<
  { children: React.ReactNode; C: any; isDark: boolean; tr?: (ar: string, en: string) => string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; C: any; isDark: boolean; tr?: (ar: string, en: string) => string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[EmploymentFormErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    const { C, isDark, tr: trProp } = this.props;
    const tr = trProp || ((_ar: string, en: string) => en);
    if (this.state.hasError) {
      return (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('معلومات التوظيف', 'Employment Information')}</div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgSubtle }}>
              <div style={{ fontSize: 13, color: C.textSecondary }}>
                <p>{tr('حدث خطأ أثناء عرض نموذج التوظيف.', 'An error occurred while rendering the Employment form.')}</p>
                {this.state.error && (
                  <p style={{ fontSize: 12, fontFamily: 'monospace' }}>{this.state.error.message}</p>
                )}
                <CVisionButton C={C} isDark={isDark}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    this.setState({ hasError: false, error: null });
                    window.location.reload();
                  }}
                >
                  {tr('إعادة تحميل الصفحة', 'Reload Page')}
                </CVisionButton>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      );
    }

    return this.props.children;
  }
}
