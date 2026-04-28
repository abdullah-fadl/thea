'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionSkeleton, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionSelect , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDevMode } from '@/lib/dev-mode';

import {
  Sparkles, UserSearch, Search, Loader2, AlertTriangle, Wrench, Brain,
  ChevronDown, ChevronUp, CheckCircle, XCircle,
  Users, Briefcase, Target, GraduationCap, DollarSign,
  ThumbsUp, ThumbsDown, FileText, Bot, UserPlus, Database,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { MatchResult, CandidateOption, JobOption } from './types';
// =============================================================================
// Constants
// =============================================================================

type RecLevel = MatchResult['recommendation'];

function getRecConfig(tr: (ar: string, en: string) => string): Record<RecLevel, { label: string; color: string; bg: string; border: string; ring: string }> {
  return {
    STRONG_MATCH: { label: tr('تطابق قوي', 'Strong Match'), color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-300', ring: 'ring-green-200' },
    GOOD_MATCH: { label: tr('تطابق جيد', 'Good Match'), color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-300', ring: 'ring-blue-200' },
    PARTIAL_MATCH: { label: tr('تطابق جزئي', 'Partial Match'), color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300', ring: 'ring-amber-200' },
    WEAK_MATCH: { label: tr('تطابق ضعيف', 'Weak Match'), color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-300', ring: 'ring-gray-200' },
  };
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-gray-500';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-gray-400';
}

function getSourceBadge(tr: (ar: string, en: string) => string): Record<string, { label: string; icon: typeof Bot; className: string }> {
  return {
    ai: { label: tr('محرك الذكاء الاصطناعي', 'AI Engine'), icon: Brain, className: 'bg-purple-100 text-purple-700 border-purple-200' },
    cv_inbox: { label: tr('صندوق السيرة الذاتية', 'CV Inbox'), icon: FileText, className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    deterministic: { label: tr('التقييم الأساسي', 'Basic Scoring'), icon: Target, className: 'bg-gray-100 text-gray-600 border-gray-200' },
  };
}

// =============================================================================
// Score Ring — circular progress
// =============================================================================

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#2563eb' : score >= 40 ? '#d97706' : '#9ca3af';
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={4} className="text-muted/20" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeLinecap="round" strokeDasharray={`${dash} ${circ - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'all 0.2s' }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        style={{ fontWeight: 700, fontSize: size * 0.28, fill: color }}>
        {Math.round(score)}%
      </text>
    </svg>
  );
}

// =============================================================================
// DetailPanel
// =============================================================================

function DetailPanel({ type, id }: { type: 'job' | 'candidate'; id: string }) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const url = type === 'job' ? `/api/cvision/recruitment/requisitions/${id}` : `/api/cvision/recruitment/candidates/${id}`;
        const res = await fetch(url, { credentials: 'include', cache: 'no-store', signal: ac.signal });
        const json = await res.json();
        setData(type === 'job' ? (json.requisition || json.data || json) : (json.candidate || json.data || json));
      } catch { /* ignore */ }
      setLoading(false);
    })();
    return () => ac.abort();
  }, [type, id]);
  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, paddingBottom: 8 }}><CVisionSkeleton C={C} height={16} /><CVisionSkeleton C={C} height={16} /></div>;
  if (!data) return <p style={{ fontSize: 12, color: C.textMuted, paddingTop: 8, paddingBottom: 8 }}>{tr('تعذر تحميل التفاصيل.', 'Could not load details.')}</p>;
  if (type === 'job') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', fontSize: 13 }}>
        {data.title && <div><span style={{ color: C.textMuted, fontSize: 12 }}>{tr('العنوان:', 'Title:')}</span> <span style={{ fontWeight: 500 }}>{data.title}</span></div>}
        {data.requisitionNumber && <div><span style={{ color: C.textMuted, fontSize: 12 }}>{tr('رقم الطلب:', 'Req #:')}</span> <span style={{ fontWeight: 500 }}>{data.requisitionNumber}</span></div>}
        {data.status && <div><span style={{ color: C.textMuted, fontSize: 12 }}>{tr('الحالة:', 'Status:')}</span> <CVisionBadge C={C} variant="outline" style={{ marginLeft: 4 }}>{data.status}</CVisionBadge></div>}
        {data.employmentType && <div><span style={{ color: C.textMuted, fontSize: 12 }}>{tr('النوع:', 'Type:')}</span> <span style={{ fontWeight: 500 }}>{data.employmentType.replace('_', ' ')}</span></div>}
        {data.skills && data.skills.length > 0 && (
          <div className="sm:col-span-2"><span style={{ color: C.textMuted, fontSize: 12 }}>{tr('المهارات:', 'Skills:')}</span><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>{data.skills.map((s: string) => <CVisionBadge C={C} key={s} variant="secondary" className="text-[10px]">{s}</CVisionBadge>)}</div></div>
        )}
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', fontSize: 13 }}>
      {data.fullName && <div><span style={{ color: C.textMuted, fontSize: 12 }}>{tr('الاسم:', 'Name:')}</span> <span style={{ fontWeight: 500 }}>{data.fullName}</span></div>}
      {data.email && <div><span style={{ color: C.textMuted, fontSize: 12 }}>{tr('البريد الإلكتروني:', 'Email:')}</span> <span style={{ fontWeight: 500 }}>{data.email}</span></div>}
      {data.metadata?.skills?.length > 0 && (
        <div className="sm:col-span-2"><span style={{ color: C.textMuted, fontSize: 12 }}>{tr('المهارات:', 'Skills:')}</span><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>{data.metadata.skills.map((s: string) => <CVisionBadge C={C} key={s} variant="secondary" className="text-[10px]">{s}</CVisionBadge>)}</div></div>
      )}
      {data.metadata?.yearsOfExperience != null && data.metadata.yearsOfExperience > 0 && <div><span style={{ color: C.textMuted, fontSize: 12 }}>{tr('الخبرة:', 'Experience:')}</span> <span style={{ fontWeight: 500 }}>{data.metadata.yearsOfExperience} {tr('سنوات', 'yrs')}</span></div>}
    </div>
  );
}

// =============================================================================
// MatchCard — redesigned
// =============================================================================

function MatchCard({ match, rank, mode }: { match: MatchResult; rank: number; mode: 'candidate' | 'job' }) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const [expanded, setExpanded] = useState(rank <= 2);
  const [showDetail, setShowDetail] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [invited, setInvited] = useState(false);
  const [savingPool, setSavingPool] = useState(false);
  const [savedPool, setSavedPool] = useState(false);
  const { toast } = useToast();
  const REC_CONFIG = getRecConfig(tr);
  const SOURCE_BADGE = getSourceBadge(tr);
  const rec = REC_CONFIG[match.recommendation];
  const src = match.source ? SOURCE_BADGE[match.source] : null;
  const SourceIcon = src?.icon || Bot;

  async function handleInviteToApply(e: React.MouseEvent) {
    e.stopPropagation();
    setInviting(true);
    try {
      const res = await fetch(`/api/cvision/recruitment/candidates/${match.candidateId}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'shortlisted', reason: `Invited via AI Match — ${match.jobTitle} (${match.overallScore}% match)` }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || 'Failed');
      setInvited(true);
      toast({ title: tr('تمت دعوة المرشح', 'Candidate Invited'), description: `${match.candidateName} ${tr('تم اختياره لـ', 'shortlisted for')} ${match.jobTitle}` });
    } catch (err: any) {
      toast({ title: tr('تعذرت الدعوة', 'Could not invite'), description: err.message, variant: 'destructive' });
    } finally { setInviting(false); }
  }

  async function handleSaveToPool(e: React.MouseEvent) {
    e.stopPropagation();
    setSavingPool(true);
    try {
      const res = await fetch('/api/cvision/ai/recommender', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-to-pool',
          candidateId: match.candidateId,
          candidateName: match.candidateName,
          skills: match.matchedSkills,
          source: 'AI_MATCH',
          notes: `Saved from AI Matching — ${match.overallScore}% match for ${match.jobTitle}`,
          matchedJobs: [{ jobId: match.jobId, jobTitle: match.jobTitle, score: match.overallScore }],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setSavedPool(true);
      toast({ title: tr('تم الحفظ في مجمع المواهب', 'Saved to Talent Pool'), description: `${match.candidateName} ${tr('أُضيف إلى مجمع المواهب', 'added to talent pool')}` });
    } catch (err: any) {
      toast({ title: tr('تعذر الحفظ', 'Could not save'), description: err.message, variant: 'destructive' });
    } finally { setSavingPool(false); }
  }

  return (
    <CVisionCard C={C} className={cn('transition-all duration-200 hover:shadow-lg border-l-4', rec.border)} onClick={() => setExpanded(!expanded)}>
      <CVisionCardBody style={{ padding: 0 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: 16, cursor: 'pointer' }}>
          {/* Rank + Score ring */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div className={cn(
              'flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold',
              rank <= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}>#{rank}</div>
            <ScoreRing score={match.overallScore} size={56} />
          </div>

          {/* Main content */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Title line */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {mode === 'candidate' ? match.jobTitle : match.candidateName}
                </h3>
                {match.department && mode === 'candidate' && (
                  <p style={{ fontSize: 13, color: C.textMuted }}>{match.department}</p>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CVisionBadge C={C} variant="outline" className={cn('text-[10px] gap-1', rec.color, rec.bg, rec.border)}>
                  {rec.label}
                </CVisionBadge>
                {src && (
                  <CVisionBadge C={C} variant="outline" className={cn('text-[10px] gap-1', src.className)}>
                    <SourceIcon style={{ height: 10, width: 10 }} />{src.label}
                  </CVisionBadge>
                )}
              </div>
            </div>

            {/* AI Reasoning — always visible */}
            {match.reasoning && (
              <div style={{ borderRadius: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 13 }}>
                <p>{match.reasoning}</p>
              </div>
            )}

            {/* Matched + Missing skills preview */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {match.matchedSkills.slice(0, 5).map(s => (
                <CVisionBadge C={C} key={s} variant="outline" style={{ background: C.greenDim, color: C.green }}>
                  <CheckCircle style={{ height: 10, width: 10 }} />{s.replace(/ \(~\w+\)/, '')}
                </CVisionBadge>
              ))}
              {match.matchedSkills.length > 5 && (
                <CVisionBadge C={C} variant="secondary" className="text-[10px]">+{match.matchedSkills.length - 5} {tr('إضافي', 'more')}</CVisionBadge>
              )}
              {match.missingSkills.slice(0, 3).map(s => (
                <CVisionBadge C={C} key={s} variant="outline" style={{ background: C.redDim, color: C.red }}>
                  <XCircle style={{ height: 10, width: 10 }} />{s}
                </CVisionBadge>
              ))}
              {match.missingSkills.length > 3 && (
                <CVisionBadge C={C} variant="secondary" className="text-[10px]">+{match.missingSkills.length - 3} {tr('ناقص', 'missing')}</CVisionBadge>
              )}
              {match.missingPreferredSkills && match.missingPreferredSkills.slice(0, 3).map(s => (
                <CVisionBadge C={C} key={`pref-${s}`} variant="outline" style={{ background: C.orangeDim, color: C.orange }}>
                  <AlertTriangle style={{ height: 10, width: 10 }} />{s}
                </CVisionBadge>
              ))}
              {match.missingPreferredSkills && match.missingPreferredSkills.length > 3 && (
                <CVisionBadge C={C} variant="secondary" className="text-[10px]">+{match.missingPreferredSkills.length - 3} {tr('يُستحسن', 'nice-to-have')}</CVisionBadge>
              )}
            </div>
          </div>

          <div style={{ display: 'none', paddingTop: 4 }}>
            {expanded ? <ChevronUp style={{ height: 16, width: 16, color: C.textMuted }} /> : <ChevronDown style={{ height: 16, width: 16, color: C.textMuted }} />}
          </div>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 16, borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Strengths & Gaps */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 12, paddingTop: 12 }}>
              {match.strengthPoints && match.strengthPoints.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}><ThumbsUp style={{ height: 12, width: 12, color: C.green }} />{tr('نقاط القوة', 'Strengths')}</p>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {match.strengthPoints.map((s, i) => (
                      <li key={i} style={{ fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <CheckCircle style={{ height: 14, width: 14, color: C.green, marginTop: 2 }} />{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {match.gaps && match.gaps.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}><ThumbsDown style={{ height: 12, width: 12, color: C.red }} />{tr('الثغرات / المخاوف', 'Gaps / Concerns')}</p>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {match.gaps.map((g, i) => (
                      <li key={i} style={{ fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <AlertTriangle style={{ height: 14, width: 14, color: C.orange, marginTop: 2 }} />{g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Full skills lists */}
            {match.matchedSkills.length > 5 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>{tr('جميع المهارات المتطابقة', 'All Matched Skills')} ({match.matchedSkills.length})</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {match.matchedSkills.map(s => (
                    <CVisionBadge C={C} key={s} variant="outline" style={{ fontSize: 12, background: C.greenDim, color: C.green }}>
                      <CheckCircle style={{ height: 10, width: 10 }} />{s.replace(/ \(~\w+\)/, '')}
                    </CVisionBadge>
                  ))}
                </div>
              </div>
            )}
            {match.missingSkills.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>{tr('المهارات المطلوبة الناقصة', 'Missing Required Skills')} ({match.missingSkills.length})</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {match.missingSkills.map(s => (
                    <CVisionBadge C={C} key={s} variant="outline" style={{ fontSize: 12, background: C.redDim, color: C.red }}>
                      <XCircle style={{ height: 10, width: 10 }} />{s}
                    </CVisionBadge>
                  ))}
                </div>
              </div>
            )}
            {match.missingPreferredSkills && match.missingPreferredSkills.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle style={{ height: 12, width: 12, color: C.orange }} />{tr('يُستحسن توفرها', 'Nice to Have')} ({match.missingPreferredSkills.length})
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {match.missingPreferredSkills.map(s => (
                    <CVisionBadge C={C} key={`pref-${s}`} variant="outline" style={{ fontSize: 12, background: C.orangeDim, color: C.orange }}>
                      <AlertTriangle style={{ height: 10, width: 10 }} />{s}
                    </CVisionBadge>
                  ))}
                </div>
              </div>
            )}

            {/* Detail panel toggle */}
            {showDetail && (
              <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 8 }}>{mode === 'candidate' ? tr('تفاصيل الوظيفة', 'Job Details') : tr('ملف المرشح', 'Candidate Profile')}</p>
                <DetailPanel type={mode === 'candidate' ? 'job' : 'candidate'} id={mode === 'candidate' ? match.jobId : match.candidateId} />
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} onClick={(e) => e.stopPropagation()}>
              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" disabled={inviting || invited} onClick={handleInviteToApply}>
                {inviting ? <Loader2 style={{ height: 14, width: 14, marginRight: 6, animation: 'spin 1s linear infinite' }} /> : invited ? <CheckCircle style={{ height: 14, width: 14, marginRight: 6, color: C.green }} /> : <UserPlus style={{ height: 14, width: 14, marginRight: 6 }} />}
                {invited ? tr('تمت الدعوة', 'Invited') : tr('دعوة للتقديم', 'Invite to Apply')}
              </CVisionButton>
              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" disabled={savingPool || savedPool} onClick={handleSaveToPool}>
                {savingPool ? <Loader2 style={{ height: 14, width: 14, marginRight: 6, animation: 'spin 1s linear infinite' }} /> : savedPool ? <CheckCircle style={{ height: 14, width: 14, marginRight: 6, color: C.green }} /> : <Database style={{ height: 14, width: 14, marginRight: 6 }} />}
                {savedPool ? tr('تم الحفظ', 'Saved') : tr('حفظ في المجمع', 'Save to Pool')}
              </CVisionButton>
              <CVisionButton C={C} isDark={isDark} variant={showDetail ? 'default' : 'outline'} size="sm" onClick={() => setShowDetail(!showDetail)}>
                {showDetail ? <><ChevronUp style={{ height: 14, width: 14, marginRight: 6 }} />{tr('إخفاء التفاصيل', 'Hide Details')}</> : <><Briefcase style={{ height: 14, width: 14, marginRight: 6 }} />{tr('عرض التفاصيل', 'View Details')}</>}
              </CVisionButton>
            </div>
          </div>
        )}
      </CVisionCardBody>
    </CVisionCard>
  );
}

// =============================================================================
// Main Component
// =============================================================================

interface AIMatchingTabProps {
  preSelectedJobId?: string | null;
  preSelectedCandidateId?: string | null;
}

interface Stats {
  totalCandidates: number;
  openJobs: number;
}

export default function AIMatchingTab({ preSelectedJobId, preSelectedCandidateId }: AIMatchingTabProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const { toast } = useToast();
  const isDev = useDevMode();
  const [mode, setMode] = useState<'candidate' | 'job'>(preSelectedJobId ? 'job' : 'candidate');
  const [stats, setStats] = useState<Stats | null>(null);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateOption | null>(null);
  const [candidateOpen, setCandidateOpen] = useState(false);
  const candidateDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [jobSearch, setJobSearch] = useState('');
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobOption | null>(null);
  const [jobOpen, setJobOpen] = useState(false);
  const jobDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [maxResults, setMaxResults] = useState(mode === 'candidate' ? 5 : 10);
  const [matching, setMatching] = useState(false);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [totalAnalyzed, setTotalAnalyzed] = useState(0);
  const [matchError, setMatchError] = useState('');
  const [hasCvData, setHasCvData] = useState(true);
  const [matchEngine, setMatchEngine] = useState<string>('');
  const [sortBy, setSortBy] = useState<'overall' | 'skill' | 'experience'>('overall');
  const [fixingSkills, setFixingSkills] = useState(false);
  const [fixResult, setFixResult] = useState<{ totalChecked: number; fixed: number; fixes: { title: string; oldSkills: string[]; newSkills: string[] }[] } | null>(null);

  useEffect(() => { setMaxResults(mode === 'candidate' ? 5 : 10); setResults([]); setMatchError(''); setTotalAnalyzed(0); setMatchEngine(''); }, [mode]);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/cvision/ai/recommend?action=stats', { credentials: 'include', cache: 'no-store', signal: ac.signal });
        if (res.ok) { const json = await res.json(); setStats(json.data); }
      } catch { /* silent */ }
    })();
    return () => ac.abort();
  }, []);

  const searchCandidates = useCallback(async (query: string) => {
    if (query.length < 1) { setCandidates([]); return; }
    setCandidatesLoading(true);
    try {
      const res = await fetch(`/api/cvision/recruitment/candidates?search=${encodeURIComponent(query)}&limit=15`, { credentials: 'include', cache: 'no-store' });
      if (res.ok) { const json = await res.json(); setCandidates((json.data?.items || json.data || []).map((c: any) => ({ id: c.id || c._id, fullName: c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim(), email: c.email, status: c.status, screeningScore: c.screeningScore }))); }
    } catch { /* silent */ } finally { setCandidatesLoading(false); }
  }, []);

  function onCandidateSearchChange(value: string) {
    setCandidateSearch(value);
    if (candidateDebounce.current) clearTimeout(candidateDebounce.current);
    candidateDebounce.current = setTimeout(() => searchCandidates(value), 300);
  }

  const searchJobs = useCallback(async (query: string) => {
    if (query.length < 1) { setJobs([]); return; }
    setJobsLoading(true);
    try {
      const res = await fetch(`/api/cvision/recruitment/requisitions?search=${encodeURIComponent(query)}&limit=15&status=open`, { credentials: 'include', cache: 'no-store' });
      if (res.ok) { const json = await res.json(); setJobs((json.data?.items || json.data || []).map((j: any) => ({ id: j.id || j._id, title: j.title, departmentId: j.departmentId || '', departmentName: j.departmentName || j.department || '', requisitionNumber: j.requisitionNumber || '', status: j.status, headcount: j.headcount || j.headcountRequested || 0 }))); }
    } catch { /* silent */ } finally { setJobsLoading(false); }
  }, []);

  function onJobSearchChange(value: string) {
    setJobSearch(value);
    if (jobDebounce.current) clearTimeout(jobDebounce.current);
    jobDebounce.current = setTimeout(() => searchJobs(value), 300);
  }

  useEffect(() => { searchCandidates('a'); searchJobs('a'); }, [searchCandidates, searchJobs]);

  useEffect(() => {
    if (preSelectedJobId && jobs.length > 0) {
      const found = jobs.find(j => j.id === preSelectedJobId);
      if (found) { setSelectedJob(found); setJobSearch(found.title); setMode('job'); }
    }
  }, [preSelectedJobId, jobs]);

  useEffect(() => {
    if (preSelectedCandidateId && candidates.length > 0) {
      const found = candidates.find(c => c.id === preSelectedCandidateId);
      if (found) { setSelectedCandidate(found); setCandidateSearch(found.fullName); setMode('candidate'); }
    }
  }, [preSelectedCandidateId, candidates]);

  async function handleMatch() {
    setMatching(true); setResults([]); setMatchError(''); setTotalAnalyzed(0); setMatchEngine('');
    try {
      let body: Record<string, any>;
      if (mode === 'candidate') {
        if (!selectedCandidate) { setMatchError(tr('يرجى اختيار مرشح', 'Please select a candidate')); setMatching(false); return; }
        body = { action: 'match-candidate-to-jobs', candidateId: selectedCandidate.id, limit: maxResults };
      } else {
        if (!selectedJob) { setMatchError(tr('يرجى اختيار وظيفة', 'Please select a job')); setMatching(false); return; }
        body = { action: 'match-job-to-candidates', jobId: selectedJob.id, limit: maxResults };
      }
      const res = await fetch('/api/cvision/ai/recommend', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `Match failed (${res.status})`);
      if (mode === 'candidate') {
        setResults(json.data.topMatches || []);
        setTotalAnalyzed(json.data.totalJobsAnalyzed || 0);
        setHasCvData(json.data.hasCvData !== false);
        setMatchEngine(json.data.matchEngine || '');
      } else {
        setResults(json.data.candidates || []);
        setTotalAnalyzed(json.data.totalCandidatesAnalyzed || 0);
        setHasCvData(true);
        setMatchEngine(json.data.matchEngine || '');
      }
    } catch (err: any) {
      setMatchError(err.message);
      toast({ title: tr('فشلت المطابقة', 'Match Failed'), description: err.message, variant: 'destructive' });
    } finally { setMatching(false); }
  }

  const sortedResults = [...results].sort((a, b) => {
    if (sortBy === 'skill') return b.breakdown.skillMatch - a.breakdown.skillMatch;
    if (sortBy === 'experience') return b.breakdown.experienceMatch - a.breakdown.experienceMatch;
    return b.overallScore - a.overallScore;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Stats row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {stats && <p style={{ fontSize: 13, color: C.textMuted }}>{stats.totalCandidates} {tr('مرشحون', 'candidates')} &middot; {stats.openJobs} {tr('وظائف مفتوحة', 'open jobs')}</p>}
          <CVisionBadge C={C} variant="outline" style={{ gap: 4, background: C.purpleDim, color: C.purple }}>
            <Brain style={{ height: 10, width: 10 }} />{tr('مطابقة بالذكاء الاصطناعي', 'AI-Powered Matching')}
          </CVisionBadge>
        </div>
        {isDev && (
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" disabled={fixingSkills} onClick={async () => {
            setFixingSkills(true); setFixResult(null);
            try {
              const res = await fetch('/api/cvision/ai/recommend', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'fix-skills' }) });
              const json = await res.json();
              if (json.success) { setFixResult(json.data); toast({ title: tr('تم إصلاح المهارات', 'Skills Fixed'), description: `${json.data.fixed} ${tr('من', 'of')} ${json.data.totalChecked} ${tr('وظائف تم تصحيحها', 'jobs corrected')}` }); }
              else toast({ title: tr('خطأ', 'Error'), description: json.error, variant: 'destructive' });
            } catch { toast({ title: tr('خطأ', 'Error'), description: tr('خطأ في الشبكة', 'Network error'), variant: 'destructive' }); }
            finally { setFixingSkills(false); }
          }}>
            {fixingSkills ? <Loader2 style={{ height: 14, width: 14, marginRight: 6, animation: 'spin 1s linear infinite' }} /> : <Wrench style={{ height: 14, width: 14, marginRight: 6 }} />}
            {tr('إصلاح مهارات الوظائف', 'Fix Job Skills')}
          </CVisionButton>
        )}
      </div>

      {isDev && fixResult && fixResult.fixed > 0 && (
        <CVisionCard C={C} style={{ background: C.greenDim }}>
          <CVisionCardBody style={{ padding: 12, fontSize: 13 }}>
            <p style={{ fontWeight: 500, color: C.green }}>{fixResult.fixed} {tr('وظيفة بها مهارات غير متطابقة وتم تصحيحها:', 'job(s) had mismatched skills and were corrected:')}</p>
            <ul style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, color: C.green }}>
              {fixResult.fixes.map((f, i) => <li key={i}><strong>{f.title}</strong>: {f.oldSkills.join(', ')} → {f.newSkills.join(', ')}</li>)}
            </ul>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Mode Selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
        <CVisionCard C={C} className={cn('cursor-pointer transition-all hover:shadow-md', mode === 'candidate' ? 'border-2 border-primary ring-1 ring-primary/20' : 'border hover:border-primary/40')} onClick={() => setMode('candidate')}>
          <CVisionCardBody style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className={cn('flex items-center justify-center h-12 w-12 rounded-lg shrink-0', mode === 'candidate' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}><UserSearch style={{ height: 24, width: 24 }} /></div>
            <div><p style={{ fontWeight: 600 }}>{tr('إيجاد وظائف للمرشح', 'Find Jobs for Candidate')}</p><p style={{ fontSize: 12, color: C.textMuted }}>{tr('الذكاء الاصطناعي يحلل سيرة المرشح ويجد أفضل الوظائف المطابقة', 'AI analyzes candidate\'s CV and finds best matching jobs')}</p></div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C} className={cn('cursor-pointer transition-all hover:shadow-md', mode === 'job' ? 'border-2 border-primary ring-1 ring-primary/20' : 'border hover:border-primary/40')} onClick={() => setMode('job')}>
          <CVisionCardBody style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className={cn('flex items-center justify-center h-12 w-12 rounded-lg shrink-0', mode === 'job' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}><Search style={{ height: 24, width: 24 }} /></div>
            <div><p style={{ fontWeight: 600 }}>{tr('إيجاد مرشحين للوظيفة', 'Find Candidates for Job')}</p><p style={{ fontSize: 12, color: C.textMuted }}>{tr('الذكاء الاصطناعي يرتب المرشحين حسب جودة التطابق لدور محدد', 'AI ranks candidates by match quality for a specific role')}</p></div>
          </CVisionCardBody>
        </CVisionCard>
      </div>

      {/* Selection Form */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{mode === 'candidate' ? tr('اختر المرشح', 'Select Candidate') : tr('اختر الوظيفة المفتوحة', 'Select Job Opening')}</div></CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>{mode === 'candidate' ? tr('المرشح', 'Candidate') : tr('الوظيفة', 'Job')}</CVisionLabel>
              {mode === 'candidate' ? (
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 12, paddingLeft: 12, paddingRight: 12 }}><Search style={{ height: 16, width: 16, opacity: 0.5, marginRight: 8 }} /><input style={{ display: 'flex', height: 40, width: '100%', paddingTop: 12, paddingBottom: 12, fontSize: 13 }} placeholder={tr('ابحث عن مرشحين...', 'Search candidates...')} value={candidateSearch} onChange={(e) => onCandidateSearchChange(e.target.value)} onFocus={() => setCandidateOpen(true)} onBlur={() => setTimeout(() => setCandidateOpen(false), 200)} />{candidatesLoading && <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite', color: C.textMuted }} />}</div>
                  {candidateOpen && candidates.length > 0 && (
                    <div style={{ position: 'absolute', zIndex: 10, marginTop: 4, width: '100%', overflowY: 'auto', borderRadius: 12, border: `1px solid ${C.border}` }}>{candidates.map(c => (
                      <button key={c.id} type="button" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, textAlign: 'left', fontSize: 13, cursor: 'pointer' }} onMouseDown={(e) => e.preventDefault()} onClick={() => { setSelectedCandidate(c); setCandidateSearch(c.fullName); setCandidateOpen(false); }}>
                        <div><p style={{ fontWeight: 500 }}>{c.fullName}</p>{c.email && <p style={{ fontSize: 12, color: C.textMuted }}>{c.email}</p>}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{c.screeningScore != null && <CVisionBadge C={C} variant="secondary" className="text-[10px]">{c.screeningScore}%</CVisionBadge>}<CVisionBadge C={C} variant="outline" className="text-[10px]">{c.status}</CVisionBadge></div>
                      </button>
                    ))}</div>
                  )}
                  {selectedCandidate && <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><CheckCircle style={{ height: 14, width: 14, color: C.green }} /><span style={{ fontWeight: 500 }}>{selectedCandidate.fullName}</span><CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ height: 20, paddingLeft: 4, paddingRight: 4, fontSize: 12, color: C.textMuted }} onClick={() => { setSelectedCandidate(null); setCandidateSearch(''); }}>{tr('مسح', 'Clear')}</CVisionButton></div>}
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 12, paddingLeft: 12, paddingRight: 12 }}><Search style={{ height: 16, width: 16, opacity: 0.5, marginRight: 8 }} /><input style={{ display: 'flex', height: 40, width: '100%', paddingTop: 12, paddingBottom: 12, fontSize: 13 }} placeholder={tr('ابحث عن وظائف...', 'Search jobs...')} value={jobSearch} onChange={(e) => onJobSearchChange(e.target.value)} onFocus={() => setJobOpen(true)} onBlur={() => setTimeout(() => setJobOpen(false), 200)} />{jobsLoading && <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite', color: C.textMuted }} />}</div>
                  {jobOpen && jobs.length > 0 && (
                    <div style={{ position: 'absolute', zIndex: 10, marginTop: 4, width: '100%', overflowY: 'auto', borderRadius: 12, border: `1px solid ${C.border}` }}>{jobs.map(j => (
                      <button key={j.id} type="button" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, textAlign: 'left', fontSize: 13, cursor: 'pointer' }} onMouseDown={(e) => e.preventDefault()} onClick={() => { setSelectedJob(j); setJobSearch(j.title); setJobOpen(false); }}>
                        <div><p style={{ fontWeight: 500 }}>{j.title}</p><p style={{ fontSize: 12, color: C.textMuted }}>{j.requisitionNumber} &middot; {j.departmentName || tr('غير مُعيّن', 'Unassigned')}</p></div>
                        <CVisionBadge C={C} variant="outline" className="text-[10px]">{j.headcount} {tr('وظيفة', 'pos')}</CVisionBadge>
                      </button>
                    ))}</div>
                  )}
                  {selectedJob && <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><CheckCircle style={{ height: 14, width: 14, color: C.green }} /><span style={{ fontWeight: 500 }}>{selectedJob.title}</span><CVisionBadge C={C} variant="secondary" className="text-[10px]">{selectedJob.departmentName || tr('غير مُعيّن', 'Unassigned')}</CVisionBadge><CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ height: 20, paddingLeft: 4, paddingRight: 4, fontSize: 12, color: C.textMuted }} onClick={() => { setSelectedJob(null); setJobSearch(''); }}>{tr('مسح', 'Clear')}</CVisionButton></div>}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('الحد الأقصى للنتائج', 'Max Results')}</CVisionLabel><CVisionInput C={C} type="number" min={1} max={mode === 'candidate' ? 20 : 30} value={maxResults} onChange={(e) => setMaxResults(Number(e.target.value))} /></div>
            <CVisionButton C={C} isDark={isDark} onClick={handleMatch} disabled={matching || (mode === 'candidate' ? !selectedCandidate : !selectedJob)} className="min-w-[180px]">
              {matching
                ? <><Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />{tr('جاري التحليل...', 'AI Analyzing...')}</>
                : <><Brain style={{ height: 16, width: 16, marginRight: 8 }} />{mode === 'candidate' ? tr('إيجاد الوظائف المطابقة', 'Find Matching Jobs') : tr('إيجاد المرشحين المطابقين', 'Find Matching Candidates')}</>
              }
            </CVisionButton>
          </div>
          {matchError && <p style={{ marginTop: 12, fontSize: 13, color: C.red, display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle style={{ height: 14, width: 14 }} />{matchError}</p>}
        </CVisionCardBody>
      </CVisionCard>

      {/* Results */}
      {matching && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textMuted }}>
            <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite' }} />
            {tr(
              `الذكاء الاصطناعي يحلل ${mode === 'candidate' ? 'الوظائف المتاحة' : 'المرشحين'}... قد يستغرق بضع ثوانٍ.`,
              `AI is analyzing ${mode === 'candidate' ? 'job openings' : 'candidates'}... This may take a few seconds.`
            )}
          </div>
          {[1, 2, 3].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ width: '100%', borderRadius: 12 }}  />)}
        </div>
      )}

      {!matching && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                {results.length} {results.length === 1 ? tr('تطابق', 'match') : tr('تطابقات', 'matches')} {tr('وُجدت', 'found')}
                {matchEngine === 'ai' && <CVisionBadge C={C} variant="outline" style={{ gap: 4, background: C.purpleDim, color: C.purple }}><Brain style={{ height: 10, width: 10 }} />{tr('محرك الذكاء الاصطناعي', 'AI Engine')}</CVisionBadge>}
                {matchEngine === 'deterministic' && <CVisionBadge C={C} variant="outline" className="text-[10px] bg-gray-50 text-gray-600">{tr('التقييم الأساسي', 'Basic Scoring')}</CVisionBadge>}
              </h2>
              <p style={{ fontSize: 12, color: C.textMuted }}>
                {totalAnalyzed} {mode === 'candidate' ? tr('وظائف', 'jobs') : tr('مرشحين', 'candidates')} {tr('تم تحليلهم', 'analyzed')}
                {mode === 'candidate' && selectedCandidate ? ` ${tr('لـ', 'for')} ${selectedCandidate.fullName}` : ''}
                {mode === 'job' && selectedJob ? ` ${tr('لـ', 'for')} ${selectedJob.title}` : ''}
              </p>
              {!hasCvData && mode === 'candidate' && (
                <p style={{ fontSize: 12, color: C.orange, fontWeight: 500, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle style={{ height: 12, width: 12 }} />
                  {tr('لم يتم العثور على بيانات السيرة الذاتية. ارفع وحلل سيرة ذاتية في صندوق الوارد للحصول على نتائج أفضل.', 'No CV data found. Upload and analyze a CV in CV Inbox for much better results.')}
                </p>
              )}
            </div>
            <CVisionSelect
                C={C}
                value={sortBy}
                options={[
                  { value: 'overall', label: tr('أفضل تطابق', 'Best Match') },
                  { value: 'skill', label: tr('تطابق المهارات', 'Skill Match') },
                  { value: 'experience', label: tr('الخبرة', 'Experience') },
                ]}
              />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sortedResults.map((match, idx) => (
              <div key={`${match.jobId}-${match.candidateId}`}
                className="animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'backwards' }}>
                <MatchCard match={match} rank={idx + 1} mode={mode} />
              </div>
            ))}
          </div>
        </div>
      )}

      {!matching && results.length === 0 && matchError === '' && totalAnalyzed > 0 && (
        <CVisionCard C={C} className="border-dashed">
          <CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}>
            <Search style={{ height: 48, width: 48, marginBottom: 12 }} />
            <p style={{ color: C.textMuted, fontWeight: 500 }}>{tr('لا توجد تطابقات', 'No matches found')}</p>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{tr('جرب اختيار مرشح أو وظيفة أخرى، أو تأكد من معالجة السير الذاتية في صندوق الوارد.', 'Try selecting a different candidate or job, or ensure CVs have been processed in CV Inbox.')}</p>
          </CVisionCardBody>
        </CVisionCard>
      )}

    </div>
  );
}
