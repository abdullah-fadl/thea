'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionPageLayout, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { useToast } from '@/hooks/use-toast';
import {
  Video, VideoOff, Mic, MicOff, PhoneOff,
  Brain, Eye, Heart, AlertTriangle, CheckCircle,
  MessageSquare, Clock, User, Sparkles, ArrowLeft,
  Play, Send, FileText, TrendingUp,
  Smile, Frown, Meh, AlertCircle, ThumbsUp,
} from 'lucide-react';

interface Candidate {
  id: string; fullName: string; email?: string; phone?: string;
  jobTitleName?: string; departmentName?: string; notes?: string;
}

interface AIAnalysis {
  timestamp: number;
  emotion: 'happy' | 'neutral' | 'nervous' | 'confused' | 'confident';
  confidence: number; eyeContact: number; engagement: number; stressLevel: number; notes: string;
}

interface InterviewQuestion {
  id: string; question: string;
  category: 'behavioral' | 'technical' | 'situational' | 'general';
  aiSuggested?: boolean;
}

const SAMPLE_QUESTIONS: InterviewQuestion[] = [
  { id: '1', question: 'Tell me about yourself and your background.', category: 'general' },
  { id: '2', question: 'Why are you interested in this position?', category: 'general' },
  { id: '3', question: 'Describe a challenging situation you faced at work and how you handled it.', category: 'behavioral' },
  { id: '4', question: 'Where do you see yourself in 5 years?', category: 'general' },
  { id: '5', question: 'What are your greatest strengths and weaknesses?', category: 'behavioral' },
  { id: '6', question: 'How do you handle pressure and tight deadlines?', category: 'situational' },
  { id: '7', question: 'Describe your ideal work environment.', category: 'general' },
  { id: '8', question: 'Do you have any questions for us?', category: 'general' },
];

export default function AIInterviewPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const { toast } = useToast();

  const router = useRouter();
  const params = useParams();
  const candidateId = params.candidateId as string;

  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewEnded, setInterviewEnded] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [aiEnabled, setAiEnabled] = useState(true);
  const [currentAnalysis, setCurrentAnalysis] = useState<AIAnalysis>({
    timestamp: Date.now(), emotion: 'neutral', confidence: 70, eyeContact: 80, engagement: 75, stressLevel: 30,
    notes: 'Candidate appears calm and composed.',
  });
  const [analysisHistory, setAnalysisHistory] = useState<AIAnalysis[]>([]);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions] = useState<InterviewQuestion[]>(SAMPLE_QUESTIONS);
  const [notes, setNotes] = useState('');
  const [overallScore, setOverallScore] = useState(7);

  const { data: candidate = null, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.recruitment.candidates.detail(candidateId),
    queryFn: async () => {
      const data = await cvisionFetch<any>(`/api/cvision/recruitment/candidates/${candidateId}`);
      if (data.success) return data.candidate as Candidate;
      return null;
    },
    enabled: !!candidateId,
  });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (interviewStarted && !interviewEnded) { interval = setInterval(() => setElapsedTime(prev => prev + 1), 1000); }
    return () => clearInterval(interval);
  }, [interviewStarted, interviewEnded]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (interviewStarted && !interviewEnded && aiEnabled) { interval = setInterval(() => simulateAIAnalysis(), 5000); }
    return () => clearInterval(interval);
  }, [interviewStarted, interviewEnded, aiEnabled]);

  const saveResultsMutation = useMutation({
    mutationFn: async () => {
      if (!candidate) throw new Error('No candidate');
      const avgConfidence = analysisHistory.length > 0 ? analysisHistory.reduce((sum, a) => sum + a.confidence, 0) / analysisHistory.length : currentAnalysis.confidence;
      const avgEngagement = analysisHistory.length > 0 ? analysisHistory.reduce((sum, a) => sum + a.engagement, 0) / analysisHistory.length : currentAnalysis.engagement;
      const aiSummary = `AI Interview Analysis:\n- Duration: ${formatTime(elapsedTime)}\n- Questions Asked: ${currentQuestionIndex + 1}\n- Avg Confidence: ${Math.round(avgConfidence)}%\n- Avg Engagement: ${Math.round(avgEngagement)}%\n- Interviewer Score: ${overallScore}/10\n\nAI Observations:\n${analysisHistory.slice(-5).map(a => `- ${a.notes}`).join('\n')}\n\nInterviewer Notes:\n${notes || 'No additional notes'}`;
      return cvisionMutate<any>(`/api/cvision/recruitment/candidates/${candidateId}`, 'PUT', { notes: `${candidate.notes || ''}\n\n---\n${aiSummary}`, screeningScore: overallScore * 10 });
    },
    onSuccess: () => {
      toast({ title: tr('تم', 'Success'), description: tr('تم حفظ نتائج المقابلة', 'Interview results saved!') });
      router.push('/cvision/recruitment');
    },
    onError: () => { toast({ title: tr('خطأ', 'Error'), description: tr('فشل حفظ النتائج', 'Failed to save results'), variant: 'destructive' }); },
  });

  async function startVideo() {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch { toast({ title: tr('خطأ', 'Error'), description: tr('تعذر الوصول للكاميرا/الميكروفون', 'Could not access camera/microphone'), variant: 'destructive' }); }
  }

  function stopVideo() { if (stream) { stream.getTracks().forEach(track => track.stop()); setStream(null); } }

  function toggleVideo() {
    if (stream) { stream.getVideoTracks().forEach(track => { track.enabled = !videoEnabled; }); setVideoEnabled(!videoEnabled); }
  }

  function toggleAudio() {
    if (stream) { stream.getAudioTracks().forEach(track => { track.enabled = !audioEnabled; }); setAudioEnabled(!audioEnabled); }
  }

  function simulateAIAnalysis() {
    const emotions: AIAnalysis['emotion'][] = ['happy', 'neutral', 'nervous', 'confused', 'confident'];
    const emotionNotes: Record<AIAnalysis['emotion'], string[]> = {
      happy: ['Candidate shows positive attitude', 'Good enthusiasm detected', 'Smiling indicates comfort'],
      neutral: ['Candidate appears calm', 'Steady composure maintained', 'Professional demeanor'],
      nervous: ['Some signs of nervousness', 'Candidate may need reassurance', 'Consider asking easier questions'],
      confused: ['Candidate may not understand question', 'Consider rephrasing', 'Allow more time to think'],
      confident: ['Strong confidence displayed', 'Good eye contact', 'Assertive body language'],
    };
    const newAnalysis: AIAnalysis = {
      timestamp: Date.now(), emotion: emotions[Math.floor(Math.random() * emotions.length)],
      confidence: 50 + Math.random() * 50, eyeContact: 60 + Math.random() * 40,
      engagement: 55 + Math.random() * 45, stressLevel: Math.random() * 60, notes: '',
    };
    const notesArr = emotionNotes[newAnalysis.emotion];
    newAnalysis.notes = notesArr[Math.floor(Math.random() * notesArr.length)];
    setCurrentAnalysis(newAnalysis);
    setAnalysisHistory(prev => [...prev, newAnalysis].slice(-20));
  }

  async function startInterview() {
    await startVideo(); setInterviewStarted(true);
    toast({ title: tr('تم', 'Started'), description: tr('بدأت المقابلة! تحليل الذكاء الاصطناعي نشط.', 'Interview started! AI analysis is active.') });
  }

  function endInterview() {
    stopVideo(); setInterviewEnded(true);
    toast({ title: tr('تم', 'Done'), description: tr('انتهت المقابلة. راجع النتائج أدناه.', 'Interview ended. Review the results below.') });
  }

  async function saveResults() {
    if (!candidate) return;
    try {
      const avgConfidence = analysisHistory.length > 0 ? analysisHistory.reduce((sum, a) => sum + a.confidence, 0) / analysisHistory.length : currentAnalysis.confidence;
      const avgEngagement = analysisHistory.length > 0 ? analysisHistory.reduce((sum, a) => sum + a.engagement, 0) / analysisHistory.length : currentAnalysis.engagement;
      const aiSummary = `AI Interview Analysis:\n- Duration: ${formatTime(elapsedTime)}\n- Questions Asked: ${currentQuestionIndex + 1}\n- Avg Confidence: ${Math.round(avgConfidence)}%\n- Avg Engagement: ${Math.round(avgEngagement)}%\n- Interviewer Score: ${overallScore}/10\n\nAI Observations:\n${analysisHistory.slice(-5).map(a => `- ${a.notes}`).join('\n')}\n\nInterviewer Notes:\n${notes || 'No additional notes'}`;
      const res = await fetch(`/api/cvision/recruitment/candidates/${candidateId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ notes: `${candidate.notes || ''}\n\n---\n${aiSummary}`, screeningScore: overallScore * 10 }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: tr('تم', 'Success'), description: tr('تم حفظ نتائج المقابلة', 'Interview results saved!') });
        router.push('/cvision/recruitment');
      } else { toast({ title: tr('خطأ', 'Error'), description: tr('فشل حفظ النتائج', 'Failed to save results'), variant: 'destructive' }); }
    } catch { toast({ title: tr('خطأ', 'Error'), description: tr('فشل حفظ النتائج', 'Failed to save results'), variant: 'destructive' }); }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function getEmotionIcon(emotion: AIAnalysis['emotion']) {
    switch (emotion) {
      case 'happy': return <Smile size={18} color={C.green} />;
      case 'confident': return <ThumbsUp size={18} color={C.blue} />;
      case 'neutral': return <Meh size={18} color={C.textMuted} />;
      case 'nervous': return <AlertCircle size={18} color={C.orange} />;
      case 'confused': return <Frown size={18} color={C.orange} />;
    }
  }

  function getEmotionVariant(emotion: AIAnalysis['emotion']): 'success' | 'info' | 'muted' | 'warning' {
    switch (emotion) {
      case 'happy': return 'success';
      case 'confident': return 'info';
      case 'neutral': return 'muted';
      case 'nervous': return 'warning';
      case 'confused': return 'warning';
    }
  }

  function getBarColor(metric: string): string {
    switch (metric) {
      case 'confidence': return C.blue;
      case 'eyeContact': return C.green;
      case 'engagement': return C.purple;
      case 'stress': return currentAnalysis.stressLevel > 50 ? C.red : C.orange;
      default: return C.blue;
    }
  }

  if (loading) {
    return (
      <CVisionPageLayout>
        <CVisionSkeletonStyles />
        <CVisionSkeletonCard C={C} height={200} />
        <CVisionSkeletonCard C={C} height={400} />
      </CVisionPageLayout>
    );
  }

  if (!candidate) {
    return (
      <CVisionPageLayout>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ color: C.textMuted }}>{tr('المرشح غير موجود', 'Candidate not found')}</p>
          <CVisionButton C={C} isDark={isDark} onClick={() => router.push('/cvision/recruitment')} style={{ marginTop: 16 }}>
            {tr('العودة للتوظيف', 'Back to Recruitment')}
          </CVisionButton>
        </div>
      </CVisionPageLayout>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: isDark ? '#111827' : C.bg, color: C.text }}>
      {/* Header */}
      <div style={{ background: isDark ? '#1f2937' : C.bgCard, borderBottom: `1px solid ${C.border}`, padding: 16 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => router.push('/cvision/recruitment')} icon={<ArrowLeft size={14} />}>
              {tr('رجوع', 'Back')}
            </CVisionButton>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, color: C.text }}>
                <Sparkles size={18} color={C.purple} />
                {tr('مقابلة بمساعدة الذكاء الاصطناعي', 'AI-Assisted Interview')}
              </div>
              <div style={{ fontSize: 13, color: C.textMuted }}>
                {candidate.fullName} - {candidate.jobTitleName || tr('الوظيفة غير محددة', 'Position TBD')}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {interviewStarted && !interviewEnded && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: C.red, borderRadius: 20, color: '#fff' }}>
                <div style={{ width: 8, height: 8, background: '#fff', borderRadius: '50%' }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>LIVE</span>
                <span style={{ fontSize: 13 }}>{formatTime(elapsedTime)}</span>
              </div>
            )}
            {!interviewStarted && (
              <CVisionButton C={C} isDark={isDark} onClick={startInterview} icon={<Play size={14} />}>
                {tr('بدء المقابلة', 'Start Interview')}
              </CVisionButton>
            )}
            {interviewStarted && !interviewEnded && (
              <CVisionButton C={C} isDark={isDark} variant="danger" onClick={endInterview} icon={<PhoneOff size={14} />}>
                {tr('إنهاء المقابلة', 'End Interview')}
              </CVisionButton>
            )}
            {interviewEnded && (
              <CVisionButton C={C} isDark={isDark} onClick={saveResults} icon={<Send size={14} />}>
                {tr('حفظ النتائج', 'Save Results')}
              </CVisionButton>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: 16, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Video Feed */}
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: 0 }}>
              <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000', borderRadius: '8px 8px 0 0', overflow: 'hidden' }}>
                {interviewStarted ? (
                  <video ref={videoRef} autoPlay muted playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: !videoEnabled ? 'none' : 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <Video size={64} color={C.textMuted} style={{ margin: '0 auto 16px' }} />
                      <p style={{ color: C.textMuted }}>{tr('اضغط "بدء المقابلة" للبدء', 'Click "Start Interview" to begin')}</p>
                      <p style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
                        {tr('سيتم طلب الوصول للكاميرا والميكروفون', 'Camera and microphone access will be requested')}
                      </p>
                    </div>
                  </div>
                )}
                {!videoEnabled && interviewStarted && (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? '#111827' : '#1f2937' }}>
                    <VideoOff size={64} color={C.textMuted} />
                  </div>
                )}
                {/* AI Overlay */}
                {interviewStarted && !interviewEnded && aiEnabled && (
                  <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between' }}>
                    <CVisionBadge C={C} variant={getEmotionVariant(currentAnalysis.emotion)}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {getEmotionIcon(currentAnalysis.emotion)}
                        {currentAnalysis.emotion.charAt(0).toUpperCase() + currentAnalysis.emotion.slice(1)}
                      </span>
                    </CVisionBadge>
                    <CVisionBadge C={C} variant="purple">
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Brain size={14} />
                        {tr('الذكاء الاصطناعي نشط', 'AI Active')}
                      </span>
                    </CVisionBadge>
                  </div>
                )}
              </div>

              {/* Video Controls */}
              {interviewStarted && !interviewEnded && (
                <div style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, borderTop: `1px solid ${C.border}` }}>
                  <CVisionButton C={C} isDark={isDark} variant={videoEnabled ? 'secondary' : 'danger'} size="icon" onClick={toggleVideo}>
                    {videoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
                  </CVisionButton>
                  <CVisionButton C={C} isDark={isDark} variant={audioEnabled ? 'secondary' : 'danger'} size="icon" onClick={toggleAudio}>
                    {audioEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                  </CVisionButton>
                  <CVisionButton C={C} isDark={isDark} variant={aiEnabled ? 'primary' : 'secondary'} size="sm" onClick={() => setAiEnabled(!aiEnabled)}
                    icon={<Brain size={14} />}>
                    {tr('تحليل الذكاء الاصطناعي', 'AI Analysis')} {aiEnabled ? tr('مفعل', 'ON') : tr('متوقف', 'OFF')}
                  </CVisionButton>
                </div>
              )}
            </CVisionCardBody>
          </CVisionCard>

          {/* Questions Section */}
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={14} color={C.gold} />
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tr('أسئلة المقابلة', 'Interview Questions')}</span>
              </div>
            </CVisionCardHeader>
            <CVisionCardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {questions.map((q, idx) => (
                  <div key={q.id} onClick={() => setCurrentQuestionIndex(idx)}
                    style={{
                      padding: 12, borderRadius: 8, cursor: 'pointer', transition: 'background 0.2s',
                      background: idx === currentQuestionIndex ? C.gold : idx < currentQuestionIndex ? C.bgSubtle : C.bgCard,
                      color: idx === currentQuestionIndex ? '#fff' : C.text,
                      border: `1px solid ${idx === currentQuestionIndex ? C.gold : C.border}`,
                    }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, minWidth: 20 }}>{idx + 1}.</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13 }}>{q.question}</p>
                        <CVisionBadge C={C} variant="muted" style={{ marginTop: 4 }}>{q.category}</CVisionBadge>
                      </div>
                      {idx < currentQuestionIndex && <CheckCircle size={16} color={C.green} />}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ flex: 1 }}
                  disabled={currentQuestionIndex === 0} onClick={() => setCurrentQuestionIndex(prev => prev - 1)}>
                  {tr('السابق', 'Previous')}
                </CVisionButton>
                <CVisionButton C={C} isDark={isDark} size="sm" style={{ flex: 1 }}
                  disabled={currentQuestionIndex === questions.length - 1} onClick={() => setCurrentQuestionIndex(prev => prev + 1)}>
                  {tr('السؤال التالي', 'Next Question')}
                </CVisionButton>
              </div>
            </CVisionCardBody>
          </CVisionCard>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* AI Analysis Panel */}
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Brain size={14} color={C.purple} />
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tr('تحليل الذكاء الاصطناعي', 'AI Analysis')}</span>
              </div>
            </CVisionCardHeader>
            <CVisionCardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Current Emotion */}
                <div style={{ padding: 12, background: C.bgSubtle, borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: C.textMuted }}>{tr('الحالة الحالية', 'Current State')}</span>
                    {getEmotionIcon(currentAnalysis.emotion)}
                  </div>
                  <p style={{ fontSize: 13, color: C.text }}>{currentAnalysis.notes}</p>
                </div>

                {/* Metrics */}
                {[
                  { label: tr('الثقة', 'Confidence'), icon: <TrendingUp size={12} />, value: currentAnalysis.confidence, color: C.blue },
                  { label: tr('التواصل البصري', 'Eye Contact'), icon: <Eye size={12} />, value: currentAnalysis.eyeContact, color: C.green },
                  { label: tr('التفاعل', 'Engagement'), icon: <Heart size={12} />, value: currentAnalysis.engagement, color: C.purple },
                  { label: tr('مستوى التوتر', 'Stress Level'), icon: <AlertTriangle size={12} />, value: currentAnalysis.stressLevel, color: currentAnalysis.stressLevel > 50 ? C.red : C.orange },
                ].map((metric, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {metric.icon} {metric.label}
                      </span>
                      <span style={{ color: C.text }}>{Math.round(metric.value)}%</span>
                    </div>
                    <div style={{ height: 8, background: C.barTrack || C.bgSubtle, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: metric.color, borderRadius: 4, transition: 'width 0.5s', width: `${metric.value}%` }} />
                    </div>
                  </div>
                ))}

                {/* AI Suggestion */}
                {currentAnalysis.stressLevel > 40 && (
                  <div style={{ padding: 8, background: C.orangeDim, border: `1px solid ${C.orange}`, borderRadius: 8 }}>
                    <p style={{ fontSize: 12, color: C.orange, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={12} />
                      {tr('اقتراح: جرب سؤالاً أسهل لمساعدة المرشح على الاسترخاء.', 'Suggestion: Consider asking an easier question to help the candidate relax.')}
                    </p>
                  </div>
                )}
              </div>
            </CVisionCardBody>
          </CVisionCard>

          {/* Notes & Scoring */}
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={14} color={C.gold} />
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tr('الملاحظات والتقييم', 'Notes & Evaluation')}</span>
              </div>
            </CVisionCardHeader>
            <CVisionCardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, color: C.textMuted, display: 'block', marginBottom: 4 }}>{tr('ملاحظات المقابلة', 'Interview Notes')}</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder={tr('أضف ملاحظاتك...', 'Add your observations...')} rows={4}
                    style={{ width: '100%', fontSize: 13, padding: 10, border: `1px solid ${C.border}`, borderRadius: 6, background: C.bg, color: C.text, resize: 'vertical', outline: 'none' }} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                    <span style={{ color: C.textMuted }}>{tr('التقييم العام', 'Overall Score')}</span>
                    <span style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{overallScore}/10</span>
                  </div>
                  <input type="range" min={1} max={10} step={1} value={overallScore} onChange={(e) => setOverallScore(Number(e.target.value))}
                    style={{ width: '100%', accentColor: C.gold }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                    <span>{tr('ضعيف', 'Poor')}</span>
                    <span>{tr('ممتاز', 'Excellent')}</span>
                  </div>
                </div>
              </div>
            </CVisionCardBody>
          </CVisionCard>

          {/* Candidate Info */}
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={14} color={C.gold} />
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tr('معلومات المرشح', 'Candidate Info')}</span>
              </div>
            </CVisionCardHeader>
            <CVisionCardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <p><span style={{ color: C.textMuted }}>{tr('الاسم:', 'Name:')}</span> <span style={{ color: C.text }}>{candidate.fullName}</span></p>
                <p><span style={{ color: C.textMuted }}>{tr('الوظيفة:', 'Position:')}</span> <span style={{ color: C.text }}>{candidate.jobTitleName || tr('غير محدد', 'TBD')}</span></p>
                <p><span style={{ color: C.textMuted }}>{tr('القسم:', 'Department:')}</span> <span style={{ color: C.text }}>{candidate.departmentName || tr('غير محدد', 'TBD')}</span></p>
                {candidate.email && <p><span style={{ color: C.textMuted }}>{tr('البريد:', 'Email:')}</span> <span style={{ color: C.text }}>{candidate.email}</span></p>}
                {candidate.phone && <p><span style={{ color: C.textMuted }}>{tr('الهاتف:', 'Phone:')}</span> <span style={{ color: C.text }}>{candidate.phone}</span></p>}
              </div>
            </CVisionCardBody>
          </CVisionCard>
        </div>
      </div>
    </div>
  );
}
