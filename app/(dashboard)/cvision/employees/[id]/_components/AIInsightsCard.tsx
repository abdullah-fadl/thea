'use client';

import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionSkeletonCard , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

interface RetentionRisk {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: string[];
}

interface AIInsightsCardProps {
  employeeId: string;
}

export default function AIInsightsCard({ employeeId }: AIInsightsCardProps) {
  const { C } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [risk, setRisk] = useState<RetentionRisk | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    fetch(`/api/cvision/analytics?action=retention-risk&limit=100`, {
      credentials: 'include', signal: ac.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.employees && Array.isArray(data.employees)) {
          const emp = data.employees.find((e: any) => e.employeeId === employeeId || e.id === employeeId);
          if (emp) {
            setRisk({
              score: emp.riskScore ?? emp.score ?? 0,
              level: emp.riskLevel ?? emp.level ?? 'LOW',
              factors: emp.factors ?? emp.riskFactors ?? [],
            });
          }
        } else if (data?.risks && Array.isArray(data.risks)) {
          const emp = data.risks.find((e: any) => e.employeeId === employeeId || e.id === employeeId);
          if (emp) {
            setRisk({
              score: emp.riskScore ?? emp.score ?? 0,
              level: emp.riskLevel ?? emp.level ?? 'LOW',
              factors: emp.factors ?? emp.riskFactors ?? [],
            });
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [employeeId]);

  function getRiskBadgeVariant(level: string): 'success' | 'warning' | 'danger' | 'muted' {
    switch (level?.toUpperCase()) {
      case 'LOW': return 'success';
      case 'MEDIUM': return 'warning';
      case 'HIGH': case 'CRITICAL': return 'danger';
      default: return 'muted';
    }
  }

  function getScoreColor(score: number): string {
    if (score <= 25) return C.green;
    if (score <= 50) return C.orange;
    if (score <= 75) return C.orange;
    return C.red;
  }

  return (
    <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles style={{ width: 16, height: 16, color: C.textMuted }} />
          <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('رؤى الذكاء الاصطناعي', 'AI Insights')}</h3>
        </div>
      </div>
      <div style={{ padding: 20 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CVisionSkeletonCard C={C} height={40} />
            <CVisionSkeletonCard C={C} height={16} />
            <CVisionSkeletonCard C={C} height={12} />
          </div>
        ) : !risk ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p style={{ fontSize: 13, color: C.textMuted }}>{tr('قم بتشغيل التحليلات لرؤية الرؤى', 'Run analytics to see insights')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Risk score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: getScoreColor(risk.score) }}>
                {risk.score}
              </span>
              <div>
                <CVisionBadge C={C} variant={getRiskBadgeVariant(risk.level)}>
                  {risk.level} {tr('خطر', 'Risk')}
                </CVisionBadge>
                <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{tr('نقاط خطر الاستبقاء', 'Retention Risk Score')}</p>
              </div>
            </div>

            {/* Risk factors */}
            {risk.factors.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, textTransform: 'uppercase' }}>{tr('العوامل الرئيسية', 'Key Factors')}</p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 4, listStyle: 'none', padding: 0, margin: 0 }}>
                  {risk.factors.slice(0, 3).map((factor, idx) => (
                    <li key={idx} style={{ fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <span style={{ marginTop: 6, height: 4, width: 4, borderRadius: '50%', background: `${C.textMuted}60`, flexShrink: 0 }} />
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
