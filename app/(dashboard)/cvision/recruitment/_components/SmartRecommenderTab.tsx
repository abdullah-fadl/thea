'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionInput, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionSelect , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search, Sparkles, AlertTriangle, Trophy, CheckCircle,
  XCircle, ArrowRight, Star, Loader2, ChevronDown, ChevronUp,
  UserPlus, Bookmark,
} from 'lucide-react';
interface Recommendation {
  requisitionId: string;
  jobTitle: string;
  department: string;
  matchScore: number;
  matchBreakdown: {
    skillsMatch: number;
    experienceMatch: number;
    educationMatch: number;
    salaryMatch: number;
    locationMatch: number;
  };
  salaryRange: { min: number; max: number };
  salaryFit: string;
  missingSkills: string[];
  strongPoints: string[];
  recommendation: string;
  appliedForThis: boolean;
}

interface CrossFit {
  candidateId: string;
  candidateName: string;
  appliedFor: string;
  appliedForId: string;
  betterFitFor: string;
  betterFitForId: string;
  appliedScore: number;
  betterScore: number;
}

interface CandidateOption {
  id: string;
  fullName: string;
  email?: string;
}

export default function SmartRecommenderTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [crossFits, setCrossFits] = useState<CrossFit[]>([]);
  const [loading, setLoading] = useState(false);
  const [crossFitLoading, setCrossFitLoading] = useState(false);
  const [profileInfo, setProfileInfo] = useState<{ name: string; skills: number; experience: number } | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [savingToPool, setSavingToPool] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetch('/api/cvision/employees?limit=200', { credentials: 'include', signal: ac.signal })
      .catch(() => null);
    fetch('/api/cvision/recruitment/candidates?limit=200&stage=all', { credentials: 'include', signal: ac.signal })
      .then(r => r.json())
      .then(d => {
        const items = d.data || d.items || [];
        setCandidates(items.map((c: any) => ({
          id: c.id,
          fullName: c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
          email: c.email,
        })));
      })
      .catch(() => setCandidates([]));
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    setCrossFitLoading(true);
    fetch('/api/cvision/ai/recommender?action=cross-fit', { credentials: 'include', signal: ac.signal })
      .then(r => r.json())
      .then(d => setCrossFits(d.data?.items || d.data || []))
      .catch(() => setCrossFits([]))
      .finally(() => setCrossFitLoading(false));
    return () => ac.abort();
  }, []);

  async function runRecommendation() {
    if (!selectedCandidate) return;
    setLoading(true);
    setRecommendations([]);
    setProfileInfo(null);
    try {
      const res = await fetch(`/api/cvision/ai/recommender?action=recommend&candidateId=${selectedCandidate}`, { credentials: 'include' });
      const json = await res.json();
      setRecommendations(json.data?.items || json.data || []);
      setProfileInfo(json.profile || null);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function saveToPool(rec: Recommendation) {
    setSavingToPool(rec.requisitionId);
    try {
      const cand = candidates.find(c => c.id === selectedCandidate);
      await fetch('/api/cvision/ai/recommender', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-to-pool',
          candidateId: selectedCandidate,
          candidateName: cand?.fullName || '',
          email: cand?.email || '',
          source: 'AI_RECOMMENDED',
          tags: [],
          notes: `Recommended for: ${rec.jobTitle} (${rec.matchScore}%)`,
          matchedJobs: [{ requisitionId: rec.requisitionId, jobTitle: rec.jobTitle, score: rec.matchScore }],
        }),
      });
    } catch { /* ignore */ }
    finally { setSavingToPool(null); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Candidate selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, width: '100%' }}>
          <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>{tr('اختر مرشحاً', 'Select a candidate')}</label>
          <CVisionSelect
                C={C}
                value={selectedCandidate}
                onChange={setSelectedCandidate}
                placeholder={tr('اختر مرشحاً...', 'Choose candidate...')}
                options={candidates.map(c => (
                ({ value: c.id, label: `${c.fullName}${c.email ? ` (${c.email})` : ''}` })
              ))}
              />
        </div>
        <button
          onClick={runRecommendation}
          disabled={!selectedCandidate || loading}
          style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, background: C.gold, color: '#fff', borderRadius: 12, fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {loading ? <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite' }} /> : <Sparkles style={{ height: 16, width: 16 }} />}
          {tr('ابحث عن أفضل الوظائف', 'Find Best Jobs')}
        </button>
      </div>

      {/* Profile summary */}
      {profileInfo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: C.textMuted, borderRadius: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8 }}>
          <span style={{ fontWeight: 500 }}>{profileInfo.name}</span>
          <span>{profileInfo.skills} {tr('مهارات', 'skills')}</span>
          <span>{profileInfo.experience} {tr('سنوات خبرة', 'years exp.')}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 192, borderRadius: 16 }}  />)}
        </div>
      )}

      {/* Recommendations */}
      {!loading && recommendations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontWeight: 600, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trophy style={{ height: 20, width: 20, color: C.orange }} />
            {tr('أفضل الوظائف المتطابقة', 'Top Job Matches')}
          </h3>
          {recommendations.map((rec, idx) => (
            <RecommendationCard
              key={rec.requisitionId}
              rec={rec}
              rank={idx + 1}
              expanded={expandedCard === rec.requisitionId}
              onToggle={() => setExpandedCard(expandedCard === rec.requisitionId ? null : rec.requisitionId)}
              onSaveToPool={() => saveToPool(rec)}
              savingToPool={savingToPool === rec.requisitionId}
            />
          ))}
        </div>
      )}

      {!loading && recommendations.length === 0 && selectedCandidate && profileInfo && (
        <div style={{ textAlign: 'center', paddingTop: 48, paddingBottom: 48, color: C.textMuted }}>
          <Search style={{ height: 32, width: 32, marginBottom: 8, opacity: 0.4 }} />
          <p>{tr('لم يتم العثور على وظائف شاغرة للتوصية.', 'No open jobs found to recommend.')}</p>
        </div>
      )}

      {/* Cross-fit alerts */}
      {crossFits.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 32 }}>
          <h3 style={{ fontWeight: 600, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle style={{ height: 20, width: 20, color: C.orange }} />
            {tr('تنبيهات التوافق المتقاطع', 'Cross-Fit Alerts')}
            <CVisionBadge C={C} variant="secondary">{crossFits.length}</CVisionBadge>
          </h3>
          <p style={{ fontSize: 13, color: C.textMuted }}>
            {tr('هؤلاء المرشحون قد يكونون أنسب لوظيفة مختلفة عن التي تقدموا لها.', 'These candidates may be better suited for a different job than the one they applied for.')}
          </p>
          {crossFits.map(cf => (
            <div key={cf.candidateId} style={{ borderRadius: 16, border: `1px solid ${C.border}`, background: C.orangeDim, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 500 }}>{cf.candidateName}</p>
                <p style={{ fontSize: 13, color: C.textMuted }}>
                  {tr('تقدم لـ', 'Applied for')} &quot;{cf.appliedFor}&quot;
                  <span style={{ marginLeft: 6, marginRight: 6 }}>→</span>
                  <span style={{ color: C.red, fontWeight: 500 }}>{cf.appliedScore}% {tr('تطابق', 'match')}</span>
                </p>
                <p style={{ fontSize: 13, marginTop: 4 }}>
                  {tr('أنسب لـ', 'Better fit for')} &quot;{cf.betterFitFor}&quot;
                  <span style={{ marginLeft: 6, marginRight: 6 }}>→</span>
                  <span style={{ color: C.green, fontWeight: 600 }}>{cf.betterScore}% {tr('تطابق', 'match')}</span>
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CVisionBadge C={C} style={{ background: C.greenDim, color: C.green }}>+{cf.betterScore - cf.appliedScore}%</CVisionBadge>
              </div>
            </div>
          ))}
        </div>
      )}

      {crossFitLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textMuted, marginTop: 16 }}>
          <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite' }} />
          {tr('جارٍ البحث عن فرص التوافق المتقاطع...', 'Scanning for cross-fit opportunities...')}
        </div>
      )}
    </div>
  );
}

// ─── Recommendation Card ────────────────────────────────────────────────────

function ScoreBar({ label, value }: { label: string; value: number }) {
  const { C, isDark } = useCVisionTheme();
  const color = value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-amber-500' : value >= 40 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: C.textMuted, width: 80 }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}>
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, width: 32, textAlign: 'right' }}>{value}%</span>
    </div>
  );
}

function RecommendationCard({
  rec, rank, expanded, onToggle, onSaveToPool, savingToPool,
}: {
  rec: Recommendation;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
  onSaveToPool: () => void;
  savingToPool: boolean;
}) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const scoreColor = rec.matchScore >= 80 ? 'text-green-600' : rec.matchScore >= 60 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = rec.matchScore >= 80 ? 'bg-green-50 border-green-200' : rec.matchScore >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  const salaryBadge = rec.salaryFit === 'WITHIN_BUDGET'
    ? { label: tr('ضمن الميزانية', 'Within Budget'), cls: 'bg-green-100 text-green-800' }
    : rec.salaryFit === 'ABOVE_BUDGET'
    ? { label: tr('أعلى من الميزانية', 'Above Budget'), cls: 'bg-red-100 text-red-800' }
    : rec.salaryFit === 'BELOW_RANGE'
    ? { label: tr('أقل من النطاق', 'Below Range'), cls: 'bg-blue-100 text-blue-800' }
    : null;

  return (
    <div className={`rounded-xl border-2 overflow-hidden transition-shadow hover:shadow-md ${rank === 1 ? 'border-amber-300 bg-amber-50/30 dark:bg-amber-950/10' : 'border-border bg-card'}`}>
      <div style={{ padding: 16, cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${rank === 1 ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'}`}>
              #{rank}
            </div>
            <div style={{ minWidth: 0 }}>
              <h4 style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.jobTitle}</h4>
              <p style={{ fontSize: 13, color: C.textMuted }}>{rec.department}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className={`px-3 py-1 rounded-full border text-lg font-bold ${scoreBg} ${scoreColor}`}>
              {rec.matchScore}%
            </div>
            {expanded ? <ChevronUp style={{ height: 16, width: 16 }} /> : <ChevronDown style={{ height: 16, width: 16 }} />}
          </div>
        </div>

        {/* Quick badges row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 }}>
          {rec.appliedForThis && (
            <CVisionBadge C={C} variant="outline" style={{ fontSize: 12, background: C.blueDim, color: C.blue }}>{tr('متقدم', 'Applied')}</CVisionBadge>
          )}
          {!rec.appliedForThis && (
            <CVisionBadge C={C} variant="outline" style={{ fontSize: 12, background: C.purpleDim, color: C.purple }}>{tr('لم يتقدم', 'Not Applied')}</CVisionBadge>
          )}
          {salaryBadge && (
            <CVisionBadge C={C} className={`text-xs ${salaryBadge.cls}`}>{salaryBadge.label}</CVisionBadge>
          )}
          {rec.missingSkills.length > 0 && (
            <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>{rec.missingSkills.length} {tr('مهارات ناقصة', rec.missingSkills.length > 1 ? 'missing skills' : 'missing skill')}</CVisionBadge>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 16, display: 'flex', flexDirection: 'column', gap: 16, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
          {/* Score breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ScoreBar label={tr('المهارات', 'Skills')} value={rec.matchBreakdown.skillsMatch} />
            <ScoreBar label={tr('الخبرة', 'Experience')} value={rec.matchBreakdown.experienceMatch} />
            <ScoreBar label={tr('التعليم', 'Education')} value={rec.matchBreakdown.educationMatch} />
            <ScoreBar label={tr('الراتب', 'Salary')} value={rec.matchBreakdown.salaryMatch} />
          </div>

          {/* Strong points */}
          {rec.strongPoints.length > 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 500, color: C.green, marginBottom: 4 }}>{tr('نقاط القوة', 'Strong Points')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {rec.strongPoints.map((sp, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 13 }}>
                    <CheckCircle style={{ height: 14, width: 14, color: C.green, marginTop: 2 }} />
                    <span>{sp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing skills */}
          {rec.missingSkills.length > 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 500, color: C.orange, marginBottom: 4 }}>{tr('المهارات الناقصة', 'Missing Skills')}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {rec.missingSkills.map(s => (
                  <CVisionBadge C={C} key={s} variant="outline" style={{ fontSize: 12, background: C.orangeDim, color: C.orange }}>{s}</CVisionBadge>
                ))}
              </div>
            </div>
          )}

          {/* Salary range */}
          {(rec.salaryRange.min > 0 || rec.salaryRange.max > 0) && (
            <p style={{ fontSize: 12, color: C.textMuted }}>
              {tr('نطاق الراتب:', 'Salary range:')} {tr('ر.س', 'SAR')} {rec.salaryRange.min.toLocaleString()} – {rec.salaryRange.max.toLocaleString()}
            </p>
          )}

          {/* AI reasoning */}
          {rec.recommendation && (
            <div style={{ borderRadius: 12, padding: 12, fontSize: 13 }}>
              <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, color: C.textMuted }}>{tr('التوصية', 'Recommendation')}</p>
              {rec.recommendation}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            {!rec.appliedForThis && (
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 12, fontWeight: 500, background: C.gold, color: '#fff', borderRadius: 12 }}>
                <UserPlus style={{ height: 12, width: 12 }} />
                {tr('دعوة للتقديم', 'Invite to Apply')}
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onSaveToPool(); }}
              disabled={savingToPool}
              style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 12, fontWeight: 500, border: `1px solid ${C.border}`, borderRadius: 12 }}
            >
              {savingToPool ? <Loader2 style={{ height: 12, width: 12, animation: 'spin 1s linear infinite' }} /> : <Bookmark style={{ height: 12, width: 12 }} />}
              {tr('حفظ في المجمع', 'Save to Pool')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
