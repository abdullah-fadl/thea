'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionSelect , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useCallback, useEffect, useState } from 'react';
import {
  Trophy, AlertTriangle, CheckCircle, XCircle, Clock, FileText,
  UserCheck, MessageSquare, Star, ChevronDown, ChevronUp, Loader2,
  BarChart3, RefreshCw, Medal, Flag, Zap, Eye, ArrowUpDown,
} from 'lucide-react';
// ─── Types ──────────────────────────────────────────────────────────────────

interface SeriousnessFactors {
  responseTime: { score: number; avgResponseHours: number; detail: string };
  profileCompleteness: { score: number; filledFields: number; totalFields: number; missingFields: string[] };
  documentSubmission: { score: number; cvUploaded: boolean; certificatesUploaded: boolean; referencesProvided: boolean };
  interviewAttendance: { score: number; scheduled: number; attended: number; noShows: number; onTime: number };
  followUp: { score: number; sentFollowUp: boolean; askedQuestions: boolean };
  applicationQuality: { score: number; coverLetterProvided: boolean; customizedApplication: boolean; relevantExperience: boolean };
}

interface CandidateRanking {
  candidateId: string;
  candidateName: string;
  requisitionId: string;
  jobTitle: string;
  overallScore: number;
  rank: number;
  matchScore: number;
  seriousnessScore: number;
  completenessScore: number;
  responsivenessScore: number;
  seriousnessFactors: SeriousnessFactors;
  recommendation: string;
  flags: string[];
}

interface JobOption {
  id: string;
  title: string;
  department?: string;
  status?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

function getTierConfig(tr: (ar: string, en: string) => string): Record<string, { label: string; cls: string; icon: typeof Trophy }> {
  return {
    HIGHLY_RECOMMENDED: { label: tr('موصى به بشدة', 'Highly Recommended'), cls: 'bg-green-100 text-green-800 border-green-300', icon: Trophy },
    RECOMMENDED: { label: tr('موصى به', 'Recommended'), cls: 'bg-blue-100 text-blue-800 border-blue-300', icon: Star },
    CONSIDER: { label: tr('للنظر', 'Consider'), cls: 'bg-amber-100 text-amber-800 border-amber-300', icon: Eye },
    NOT_RECOMMENDED: { label: tr('غير موصى به', 'Not Recommended'), cls: 'bg-red-100 text-red-800 border-red-300', icon: XCircle },
  };
}

function getFlagConfig(tr: (ar: string, en: string) => string): Record<string, { label: string; cls: string }> {
  return {
    slow_responder: { label: tr('بطيء الاستجابة', 'Slow Responder'), cls: 'bg-orange-100 text-orange-700 border-orange-200' },
    incomplete_profile: { label: tr('ملف غير مكتمل', 'Incomplete Profile'), cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    no_show_risk: { label: tr('خطر عدم الحضور', 'No-Show Risk'), cls: 'bg-red-100 text-red-700 border-red-200' },
    low_engagement: { label: tr('تفاعل منخفض', 'Low Engagement'), cls: 'bg-gray-100 text-gray-600 border-gray-200' },
    underqualified: { label: tr('غير مؤهل كفاية', 'Underqualified'), cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  };
}

const RANK_MEDALS = ['', '\u{1F947}', '\u{1F948}', '\u{1F949}'];

// ─── Component ──────────────────────────────────────────────────────────────

export default function CandidateRankingsTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [rankings, setRankings] = useState<CandidateRanking[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);
  const [sortBy, setSortBy] = useState<'overall' | 'match' | 'seriousness' | 'completeness'>('overall');

  // Load open jobs
  useEffect(() => {
    const ac = new AbortController();
    fetch('/api/cvision/recruitment/openings?status=open&limit=200', { credentials: 'include', signal: ac.signal })
      .then(r => r.json())
      .then(d => {
        const items = (d.data || d.items || []).map((j: any) => ({
          id: j.id,
          title: j.title,
          department: j.departmentName || j.department,
          status: j.status,
        }));
        setJobs(items);
      })
      .catch(() => setJobs([]));
    return () => ac.abort();
  }, []);

  const generateRankings = useCallback(async () => {
    if (!selectedJob) return;
    setLoading(true);
    setRankings([]);
    setExpandedId(null);
    setCompareIds(new Set());
    setShowCompare(false);
    try {
      const res = await fetch(
        `/api/cvision/ai/ranking?action=rank&requisitionId=${selectedJob}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      setRankings(json.data?.items || json.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [selectedJob]);

  const sorted = [...rankings].sort((a, b) => {
    if (sortBy === 'match') return b.matchScore - a.matchScore;
    if (sortBy === 'seriousness') return b.seriousnessScore - a.seriousnessScore;
    if (sortBy === 'completeness') return b.completenessScore - a.completenessScore;
    return b.overallScore - a.overallScore;
  });

  function toggleCompare(id: string) {
    setCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
  }

  const comparedCandidates = rankings.filter(r => compareIds.has(r.candidateId));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Job selector + generate */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, width: '100%' }}>
          <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>{tr('اختر الوظيفة المفتوحة', 'Select Job Opening')}</label>
          <CVisionSelect
                C={C}
                value={selectedJob}
                onChange={setSelectedJob}
                placeholder={tr('اختر الوظيفة...', 'Choose job...')}
                options={jobs.map(j => (
                ({ value: j.id, label: `${j.title}${j.department ? ` - ${j.department}` : ''}` })
              ))}
              />
        </div>
        <button
          onClick={generateRankings}
          disabled={!selectedJob || loading}
          style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, background: C.gold, color: '#fff', borderRadius: 12, fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {loading ? <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite' }} /> : <BarChart3 style={{ height: 16, width: 16 }} />}
          {tr('إنشاء الترتيب', 'Generate Rankings')}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 160, borderRadius: 16 }}  />)}
        </div>
      )}

      {/* Results header */}
      {!loading && rankings.length > 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <h3 style={{ fontWeight: 600, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Medal style={{ height: 20, width: 20, color: C.orange }} />
              {rankings.length} {tr('مرشح تم ترتيبه', rankings.length !== 1 ? 'Candidates Ranked' : 'Candidate Ranked')}
            </h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {compareIds.size >= 2 && (
                <button
                  onClick={() => setShowCompare(!showCompare)}
                  style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 12, fontWeight: 500, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <ArrowUpDown style={{ height: 12, width: 12 }} />
                  {showCompare ? tr('إخفاء', 'Hide') : tr('مقارنة', 'Compare')} ({compareIds.size})
                </button>
              )}
              <CVisionSelect
                C={C}
                value={sortBy}
                options={[
                  { value: 'overall', label: tr('ترتيب: الإجمالي', 'Sort: Overall') },
                  { value: 'match', label: tr('ترتيب: التطابق', 'Sort: Match') },
                  { value: 'seriousness', label: tr('ترتيب: الجدية', 'Sort: Seriousness') },
                  { value: 'completeness', label: tr('ترتيب: الاكتمال', 'Sort: Completeness') },
                ]}
                style={{ width: 144, height: 32, fontSize: 12 }}
              />
            </div>
          </div>

          {/* Comparison table */}
          {showCompare && comparedCandidates.length >= 2 && (
            <ComparisonTable candidates={comparedCandidates} />
          )}

          {/* Ranking cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sorted.map(r => (
              <RankingCard
                key={r.candidateId}
                ranking={r}
                expanded={expandedId === r.candidateId}
                onToggle={() => setExpandedId(expandedId === r.candidateId ? null : r.candidateId)}
                comparing={compareIds.has(r.candidateId)}
                onToggleCompare={() => toggleCompare(r.candidateId)}
                canCompare={compareIds.size < 3 || compareIds.has(r.candidateId)}
              />
            ))}
          </div>
        </>
      )}

      {!loading && rankings.length === 0 && selectedJob && (
        <div style={{ textAlign: 'center', paddingTop: 64, paddingBottom: 64, color: C.textMuted }}>
          <UserCheck style={{ height: 32, width: 32, marginBottom: 8, opacity: 0.4 }} />
          <p>{tr('لا يوجد مرشحون لهذه الوظيفة.', 'No candidates found for this job.')}</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>{tr('يجب على المرشحين التقدم لهذه الوظيفة أولاً.', 'Candidates must apply to this job opening first.')}</p>
        </div>
      )}
    </div>
  );
}

// ─── Score bar ──────────────────────────────────────────────────────────────

function ScoreBar({ label, value, compact }: { label: string; value: number; compact?: boolean }) {
  const { C, isDark } = useCVisionTheme();
  const color = value >= 75 ? 'bg-green-500' : value >= 55 ? 'bg-amber-500' : value >= 35 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className={`flex items-center gap-2 ${compact ? '' : ''}`}>
      <span className={`text-xs text-muted-foreground ${compact ? 'w-16' : 'w-24'} shrink-0`}>{label}</span>
      <div style={{ flex: 1, height: 8, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}>
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, width: 32, textAlign: 'right' }}>{value}%</span>
    </div>
  );
}

// ─── Ranking Card ───────────────────────────────────────────────────────────

function RankingCard({
  ranking: r, expanded, onToggle, comparing, onToggleCompare, canCompare,
}: {
  ranking: CandidateRanking;
  expanded: boolean;
  onToggle: () => void;
  comparing: boolean;
  onToggleCompare: () => void;
  canCompare: boolean;
}) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const TIER_CONFIG = getTierConfig(tr);
  const FLAG_CONFIG = getFlagConfig(tr);
  const tier = TIER_CONFIG[r.recommendation] || TIER_CONFIG.CONSIDER;
  const medal = RANK_MEDALS[r.rank] || '';
  const scoreColor = r.overallScore >= 75 ? 'text-green-600' : r.overallScore >= 55 ? 'text-amber-600' : r.overallScore >= 35 ? 'text-orange-600' : 'text-red-600';
  const borderCls = r.rank === 1 ? 'border-amber-300' : r.rank === 2 ? 'border-gray-300' : r.rank === 3 ? 'border-orange-200' : 'border-border';

  return (
    <div className={`rounded-xl border-2 overflow-hidden transition-shadow hover:shadow-md ${borderCls} ${comparing ? 'ring-2 ring-indigo-400' : ''}`}>
      <div style={{ padding: 16, cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${r.rank <= 3 ? 'bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground'}`}>
              {medal || `#${r.rank}`}
            </div>
            <div style={{ minWidth: 0 }}>
              <h4 style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.candidateName}</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <CVisionBadge C={C} className={`text-xs border ${tier.cls}`}>{tier.label}</CVisionBadge>
                {r.flags.map(f => {
                  const fc = FLAG_CONFIG[f];
                  return fc ? (
                    <CVisionBadge C={C} key={f} variant="outline" className={`text-xs ${fc.cls}`}>{fc.label}</CVisionBadge>
                  ) : (
                    <CVisionBadge C={C} key={f} variant="outline" style={{ fontSize: 12 }}>{f}</CVisionBadge>
                  );
                })}
                {r.flags.length === 0 && (
                  <span style={{ fontSize: 12, color: C.green, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle style={{ height: 12, width: 12 }} /> {tr('لا توجد علامات', 'No flags')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className={`text-2xl font-bold ${scoreColor}`}>
              {r.overallScore}
            </div>
            {expanded ? <ChevronUp style={{ height: 16, width: 16 }} /> : <ChevronDown style={{ height: 16, width: 16 }} />}
          </div>
        </div>

        {/* Quick score chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12, fontSize: 12 }}>
          <span style={{ background: C.bgSubtle, paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, borderRadius: '50%' }}>{tr('تطابق الذكاء الاصطناعي:', 'AI Match:')} <strong>{r.matchScore}%</strong></span>
          <span style={{ background: C.bgSubtle, paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, borderRadius: '50%' }}>{tr('الجدية:', 'Seriousness:')} <strong>{r.seriousnessScore}%</strong></span>
          <span style={{ background: C.bgSubtle, paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, borderRadius: '50%' }}>{tr('الملف الشخصي:', 'Profile:')} <strong>{r.completenessScore}%</strong></span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 16, borderTop: `1px solid ${C.border}`, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Score breakdown bars */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>{tr('تفصيل الدرجات', 'Score Breakdown')}</p>
              <ScoreBar label={tr('تطابق الذكاء الاصطناعي', 'AI Match')} value={r.matchScore} />
              <ScoreBar label={tr('الجدية', 'Seriousness')} value={r.seriousnessScore} />
              <ScoreBar label={tr('الاكتمال', 'Completeness')} value={r.completenessScore} />
              <ScoreBar label={tr('الاستجابة', 'Responsiveness')} value={r.responsivenessScore} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>{tr('عوامل الجدية', 'Seriousness Factors')}</p>
              <ScoreBar label={tr('الرد', 'Response')} value={r.seriousnessFactors.responseTime.score} />
              <ScoreBar label={tr('الملف الشخصي', 'Profile')} value={r.seriousnessFactors.profileCompleteness.score} />
              <ScoreBar label={tr('المستندات', 'Documents')} value={r.seriousnessFactors.documentSubmission.score} />
              <ScoreBar label={tr('المقابلات', 'Interviews')} value={r.seriousnessFactors.interviewAttendance.score} />
              <ScoreBar label={tr('المتابعة', 'Follow-up')} value={r.seriousnessFactors.followUp.score} />
              <ScoreBar label={tr('الجودة', 'Quality')} value={r.seriousnessFactors.applicationQuality.score} />
            </div>
          </div>

          {/* Factor details */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 12, fontSize: 13 }}>
            <FactorDetail
              icon={<Zap style={{ height: 16, width: 16, color: C.blue }} />}
              title={tr('وقت الاستجابة', 'Response Time')}
              detail={r.seriousnessFactors.responseTime.detail}
            />
            <FactorDetail
              icon={<FileText style={{ height: 16, width: 16, color: C.purple }} />}
              title={tr('المستندات', 'Documents')}
              detail={[
                r.seriousnessFactors.documentSubmission.cvUploaded ? `${tr('السيرة الذاتية', 'CV')} \u2705` : `${tr('السيرة الذاتية', 'CV')} \u274C`,
                r.seriousnessFactors.documentSubmission.certificatesUploaded ? `${tr('الشهادات', 'Certs')} \u2705` : `${tr('الشهادات', 'Certs')} \u274C`,
                r.seriousnessFactors.documentSubmission.referencesProvided ? `${tr('المراجع', 'Refs')} \u2705` : `${tr('المراجع', 'Refs')} \u274C`,
              ].join('  ')}
            />
            <FactorDetail
              icon={<UserCheck style={{ height: 16, width: 16, color: C.green }} />}
              title={tr('المقابلات', 'Interviews')}
              detail={`${r.seriousnessFactors.interviewAttendance.attended}/${r.seriousnessFactors.interviewAttendance.scheduled} ${tr('حضور', 'attended')}${r.seriousnessFactors.interviewAttendance.noShows > 0 ? `، ${r.seriousnessFactors.interviewAttendance.noShows} ${tr('غياب', 'no-show')}` : ''}`}
            />
          </div>

          {/* Missing profile fields */}
          {r.seriousnessFactors.profileCompleteness.missingFields.length > 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 500, color: C.orange, marginBottom: 4 }}>{tr('الحقول الناقصة', 'Missing Fields')}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {r.seriousnessFactors.profileCompleteness.missingFields.map(f => (
                  <CVisionBadge C={C} key={f} variant="outline" style={{ fontSize: 12, background: C.orangeDim, color: C.orange }}>{f}</CVisionBadge>
                ))}
              </div>
            </div>
          )}

          {/* Compare toggle */}
          <div style={{ paddingTop: 4 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleCompare(); }}
              disabled={!canCompare && !comparing}
              className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition ${
                comparing
                  ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                  : 'hover:bg-muted'
              } disabled:opacity-50`}
            >
              {comparing ? tr('إزالة من المقارنة', 'Remove from comparison') : tr('إضافة للمقارنة', 'Add to comparison')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Factor detail chip ─────────────────────────────────────────────────────

function FactorDetail({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  const { C, isDark } = useCVisionTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, borderRadius: 12, border: `1px solid ${C.border}`, padding: 12 }}>
      <div style={{ marginTop: 2 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 500 }}>{title}</p>
        <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{detail}</p>
      </div>
    </div>
  );
}

// ─── Comparison table ───────────────────────────────────────────────────────

function ComparisonTable({ candidates }: { candidates: CandidateRanking[] }) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const TIER_CONFIG = getTierConfig(tr);

  const rows: { label: string; getValue: (r: CandidateRanking) => string | number }[] = [
    { label: tr('الدرجة الإجمالية', 'Overall Score'), getValue: r => r.overallScore },
    { label: tr('تطابق الذكاء الاصطناعي', 'AI Match'), getValue: r => `${r.matchScore}%` },
    { label: tr('الجدية', 'Seriousness'), getValue: r => `${r.seriousnessScore}%` },
    { label: tr('الاكتمال', 'Completeness'), getValue: r => `${r.completenessScore}%` },
    { label: tr('الاستجابة', 'Responsiveness'), getValue: r => `${r.responsivenessScore}%` },
    { label: tr('وقت الاستجابة', 'Response Time'), getValue: r => r.seriousnessFactors.responseTime.detail },
    { label: tr('السيرة الذاتية مرفوعة', 'CV Uploaded'), getValue: r => r.seriousnessFactors.documentSubmission.cvUploaded ? tr('نعم', 'Yes') : tr('لا', 'No') },
    { label: tr('المقابلات', 'Interviews'), getValue: r => `${r.seriousnessFactors.interviewAttendance.attended}/${r.seriousnessFactors.interviewAttendance.scheduled}` },
    { label: tr('حالات الغياب', 'No-Shows'), getValue: r => r.seriousnessFactors.interviewAttendance.noShows },
    { label: tr('المتابعة', 'Follow-Up'), getValue: r => r.seriousnessFactors.followUp.sentFollowUp ? tr('نعم', 'Yes') : tr('لا', 'No') },
    { label: tr('العلامات', 'Flags'), getValue: r => r.flags.length > 0 ? r.flags.join(', ') : tr('لا توجد', 'None') },
    { label: tr('التوصية', 'Recommendation'), getValue: r => TIER_CONFIG[r.recommendation]?.label || r.recommendation },
  ];

  return (
    <div style={{ borderRadius: 16, border: `1px solid ${C.border}` }}>
      <table style={{ width: '100%', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            <th style={{ textAlign: 'left', paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontWeight: 500, color: C.textMuted }}>{tr('المعيار', 'Metric')}</th>
            {candidates.map(c => (
              <th key={c.candidateId} style={{ textAlign: 'center', paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontWeight: 600 }}>{c.candidateName}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, color: C.textMuted, fontSize: 12, fontWeight: 500 }}>{row.label}</td>
              {candidates.map(c => {
                const val = row.getValue(c);
                return (
                  <td key={c.candidateId} style={{ textAlign: 'center', paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontSize: 12 }}>
                    {val}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
