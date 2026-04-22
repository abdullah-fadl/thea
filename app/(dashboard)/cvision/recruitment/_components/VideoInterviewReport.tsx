'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState } from 'react';
import {
  CheckCircle, XCircle, Eye, Mic, Brain, Activity,
  AlertTriangle, ThumbsUp, ThumbsDown, Clock, Video,
  ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface VideoReport {
  candidateName: string;
  jobTitle: string;
  interviewDate: string;
  totalQuestions: number;
  scores: {
    content: number;
    bodyLanguage: number;
    voice: number;
    overall: number;
  };
  questionScores: Array<{
    questionId: string;
    contentScore: number;
    bodyLanguageScore: number;
    voiceScore: number;
    compositeScore: number;
  }>;
  recommendation: string;
  highlights: string[];
  concerns: string[];
  bodyLanguageHighlights: string[];
  voiceHighlights: string[];
}

interface VideoResult {
  questionId: string;
  transcript: string;
  contentEvaluation: {
    relevanceScore: number;
    depthScore: number;
    clarityScore: number;
    exampleScore: number;
    overallScore: number;
    strengths: string[];
    weaknesses: string[];
    summary: string;
    keyPoints: string[];
    redFlags: string[];
  } | null;
  bodyLanguage: {
    eyeContactPercentage: number;
    postureScore: number;
    fidgetingLevel: string;
    overallScore: number;
    observations: string[];
  } | null;
  voice: {
    confidenceScore: number;
    estimatedWordsPerMinute: number;
    paceCategory: string;
    pauseCount: number;
    silencePercentage: number;
    observations: string[];
  } | null;
}

interface Props {
  report: VideoReport;
  results?: VideoResult[];
  questions?: Array<{ id: string; question: string; category: string }>;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function VideoInterviewReport({ report, results, questions }: Props) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const RECOMMENDATION_CONFIG: Record<string, { label: string; cls: string; icon: typeof CheckCircle }> = {
    STRONG_HIRE: { label: tr('توظيف مؤكد', 'Strong Hire'), cls: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
    HIRE: { label: tr('توظيف', 'Hire'), cls: 'bg-green-50 text-green-700 border-green-200', icon: ThumbsUp },
    MAYBE: { label: tr('ربما', 'Maybe'), cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertTriangle },
    NO_HIRE: { label: tr('عدم توظيف', 'No Hire'), cls: 'bg-red-50 text-red-700 border-red-200', icon: ThumbsDown },
    STRONG_NO_HIRE: { label: tr('عدم توظيف مؤكد', 'Strong No Hire'), cls: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
  };

  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const rec = RECOMMENDATION_CONFIG[report.recommendation] || RECOMMENDATION_CONFIG.MAYBE;
  const RecIcon = rec.icon;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{report.candidateName}</h3>
          <p style={{ fontSize: 13, color: C.textMuted }}>{report.jobTitle}</p>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
            {report.interviewDate ? new Date(report.interviewDate).toLocaleDateString() : ''} •{' '}
            {report.totalQuestions} {tr('أسئلة', 'questions')}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <CVisionBadge C={C} className={`text-sm border px-3 py-1 ${rec.cls}`}>
            <RecIcon style={{ height: 16, width: 16, marginRight: 6 }} />
            {rec.label}
          </CVisionBadge>
        </div>
      </div>

      {/* Score bars */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
        <ScoreBar
          label={tr('جودة المحتوى', 'Content Quality')}
          score={report.scores.content}
          icon={<Brain style={{ height: 16, width: 16 }} />}
          color="blue"
        />
        <ScoreBar
          label={tr('لغة الجسد', 'Body Language')}
          score={report.scores.bodyLanguage}
          icon={<Eye style={{ height: 16, width: 16 }} />}
          color="purple"
        />
        <ScoreBar
          label={tr('الصوت والثقة', 'Voice & Confidence')}
          score={report.scores.voice}
          icon={<Mic style={{ height: 16, width: 16 }} />}
          color="indigo"
        />
        <ScoreBar
          label={tr('الدرجة الإجمالية', 'Overall Score')}
          score={report.scores.overall}
          icon={<Activity style={{ height: 16, width: 16 }} />}
          color="emerald"
          bold
        />
      </div>

      {/* Highlights + Concerns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
        {report.highlights.length > 0 && (
          <div style={{ background: C.greenDim, borderRadius: 16, padding: 16, border: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.green, marginBottom: 8 }}>{tr('نقاط القوة', 'Strengths')}</p>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {report.highlights.map((h, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 13, color: C.green }}>
                  <CheckCircle style={{ height: 14, width: 14, marginTop: 2, color: C.green }} />
                  {h}
                </li>
              ))}
            </ul>
          </div>
        )}
        {report.concerns.length > 0 && (
          <div style={{ background: C.orangeDim, borderRadius: 16, padding: 16, border: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.orange, marginBottom: 8 }}>{tr('المخاوف', 'Concerns')}</p>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {report.concerns.map((c, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 13, color: C.orange }}>
                  <AlertTriangle style={{ height: 14, width: 14, marginTop: 2, color: C.orange }} />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Body Language + Voice highlights */}
      {(report.bodyLanguageHighlights.length > 0 || report.voiceHighlights.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
          {report.bodyLanguageHighlights.length > 0 && (
            <div style={{ borderRadius: 16, padding: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Eye style={{ height: 14, width: 14 }} /> {tr('لغة الجسد', 'Body Language')}
              </p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {report.bodyLanguageHighlights.map((o, i) => (
                  <li key={i} style={{ fontSize: 12, color: C.textMuted }}>• {o}</li>
                ))}
              </ul>
            </div>
          )}
          {report.voiceHighlights.length > 0 && (
            <div style={{ borderRadius: 16, padding: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mic style={{ height: 14, width: 14 }} /> {tr('تحليل الصوت', 'Voice Analysis')}
              </p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {report.voiceHighlights.map((o, i) => (
                  <li key={i} style={{ fontSize: 12, color: C.textMuted }}>• {o}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Per-question breakdown */}
      {results && results.length > 0 && (
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 12 }}>{tr('تحليل كل سؤال', 'Per-Question Breakdown')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map((r, i) => {
              const q = questions?.find(q => q.id === r.questionId);
              const qs = report.questionScores.find(s => s.questionId === r.questionId);
              const isExpanded = expandedQ === r.questionId;

              return (
                <div
                  key={r.questionId}
                  style={{ border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}
                >
                  <button
                    onClick={() => setExpandedQ(isExpanded ? null : r.questionId)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'left' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <span style={{ fontSize: 12, color: C.textMuted, width: 24 }}>{tr('س', 'Q')}{i + 1}</span>
                      <CVisionBadge C={C} variant="outline" className="text-[10px] shrink-0">{q?.category || tr('عام', 'General')}</CVisionBadge>
                      <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q?.question || r.questionId}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                      {qs && (
                        <span className={`text-sm font-semibold ${qs.compositeScore >= 70 ? 'text-green-600' : qs.compositeScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                          {qs.compositeScore}
                        </span>
                      )}
                      {isExpanded ? <ChevronUp style={{ height: 16, width: 16, color: C.textMuted }} /> : <ChevronDown style={{ height: 16, width: 16, color: C.textMuted }} />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 16, display: 'flex', flexDirection: 'column', gap: 12, borderTop: `1px solid ${C.border}` }}>
                      {/* Transcript */}
                      {r.transcript && r.transcript !== '[Transcription failed]' && (
                        <div style={{ marginTop: 12 }}>
                          <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 4 }}>{tr('النص المكتوب', 'Transcript')}</p>
                          <p style={{ fontSize: 13, borderRadius: 12, padding: 12 }}>{r.transcript}</p>
                        </div>
                      )}

                      {/* Content evaluation */}
                      {r.contentEvaluation && (
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 4 }}>{tr('تقييم المحتوى', 'Content Evaluation')}</p>
                          <p style={{ fontSize: 13, color: C.textMuted }}>{r.contentEvaluation.summary}</p>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
                            <MiniScore label={tr('الصلة', 'Relevance')} score={r.contentEvaluation.relevanceScore} />
                            <MiniScore label={tr('العمق', 'Depth')} score={r.contentEvaluation.depthScore} />
                            <MiniScore label={tr('الوضوح', 'Clarity')} score={r.contentEvaluation.clarityScore} />
                            <MiniScore label={tr('الأمثلة', 'Examples')} score={r.contentEvaluation.exampleScore} />
                          </div>
                        </div>
                      )}

                      {/* Body + Voice mini stats */}
                      <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                        {r.bodyLanguage && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.textMuted }}>
                            <Eye style={{ height: 12, width: 12 }} /> {tr('التواصل البصري:', 'Eye:')} {r.bodyLanguage.eyeContactPercentage}%
                          </span>
                        )}
                        {r.voice && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.textMuted }}>
                            <Mic style={{ height: 12, width: 12 }} /> {tr('الثقة:', 'Confidence:')} {r.voice.confidenceScore}
                          </span>
                        )}
                        {r.voice && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.textMuted }}>
                            <Clock style={{ height: 12, width: 12 }} /> {r.voice.estimatedWordsPerMinute} {tr('كلمة/د', 'WPM')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ScoreBar({
  label,
  score,
  icon,
  color,
  bold,
}: {
  label: string;
  score: number;
  icon: React.ReactNode;
  color: string;
  bold?: boolean;
}) {
  const { C, isDark } = useCVisionTheme();
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    indigo: 'bg-indigo-500',
    emerald: 'bg-emerald-500',
  };
  const barColor = colorMap[color] || 'bg-blue-500';

  return (
    <div className={`space-y-1 ${bold ? 'border-t pt-3' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className={`text-xs ${bold ? 'font-semibold' : ''} text-muted-foreground flex items-center gap-1.5`}>
          {icon} {label}
        </span>
        <span className={`text-sm ${bold ? 'font-bold' : 'font-semibold'}`}>{score}/100</span>
      </div>
      <div style={{ height: 8, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
    </div>
  );
}

function MiniScore({ label, score }: { label: string; score: number }) {
  const { C, isDark } = useCVisionTheme();
  const cls = score >= 7 ? 'text-green-600 bg-green-50' : score >= 4 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
  return (
    <div style={{ textAlign: 'center' }}>
      <div className={`text-lg font-bold rounded-lg py-1 ${cls}`}>{score}</div>
      <p style={{ color: C.textMuted, marginTop: 2 }}>{label}</p>
    </div>
  );
}
