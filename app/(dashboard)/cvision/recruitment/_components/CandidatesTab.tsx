'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionTextarea, CVisionSelect, CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDevMode } from '@/lib/dev-mode';

import { Slider } from '@/components/ui/slider';

import { toast } from 'sonner';
import {
  UserPlus, Users, UserCheck, Clock, CheckCircle, XCircle, Search, MoreHorizontal,
  Phone, Mail, Building2, RefreshCw, Filter, FileText, Star, ThumbsUp, ThumbsDown,
  MessageSquare, Upload, Sparkles, Video, UserCircle, MapPin, Calendar, Send,
  ClipboardList, DollarSign, FileSignature, Gift, Handshake, AlertCircle, Check,
  Copy, ExternalLink, ArrowLeft, ArrowRight, Eye,
} from 'lucide-react';
import { STATUS_CONFIG, STATUS_FLOW } from './types';
import type { Candidate, Department, JobTitle } from './types';
import InterviewManager from './InterviewManager';
import VideoInterviewReport from './VideoInterviewReport';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

interface CandidatesTabProps {
  onRunMatching?: (candidateId: string) => void;
}

export default function CandidatesTab({ onRunMatching }: CandidatesTabProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const router = useRouter();
  const isDev = useDevMode();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'pipeline' | 'all' | 'hired'>('all');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Add candidate dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newCandidate, setNewCandidate] = useState({
    fullName: '', email: '', phone: '', departmentId: '', jobTitleId: '', source: 'DIRECT', notes: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvUploading, setCvUploading] = useState(false);
  const [cvAnalyzing, setCvAnalyzing] = useState(false);
  const [cvAnalysis, setCvAnalysis] = useState<any>(null);
  const [positionMatches, setPositionMatches] = useState<any[]>([]);

  // Candidate detail dialog
  const [detailCandidate, setDetailCandidate] = useState<Candidate | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [candidateDocuments, setCandidateDocuments] = useState<any[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  // Manual skill management
  const [skillInput, setSkillInput] = useState('');
  const [savingSkills, setSavingSkills] = useState(false);

  // Screening dialog
  const [screenDialogOpen, setScreenDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [screening, setScreening] = useState(false);
  const [screenData, setScreenData] = useState({ screeningScore: 5, notes: '', decision: '' as string });

  // Interview dialog (legacy)
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [interviewMode, setInterviewMode] = useState<'schedule' | 'result'>('schedule');
  const [savingInterview, setSavingInterview] = useState(false);
  const [candidateInterviews, setCandidateInterviews] = useState<any[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(false);
  const [selectedInterviewId, setSelectedInterviewId] = useState<string | null>(null);
  const [interviewData, setInterviewData] = useState({
    scheduledDate: '', scheduledTime: '', interviewType: 'in_person' as string,
    interviewers: '', location: '', notes: '', interviewScore: 7, feedback: '', decision: '' as string,
  });

  // New InterviewManager
  const [imOpen, setImOpen] = useState(false);
  const [imCandidate, setImCandidate] = useState<Candidate | null>(null);
  const [imMode, setImMode] = useState<'schedule' | 'feedback' | 'decision' | 'history'>('schedule');
  const [imDefaultType, setImDefaultType] = useState<string | undefined>(undefined);

  // Offer dialog
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [savingOffer, setSavingOffer] = useState(false);
  const [offerData, setOfferData] = useState({
    basicSalary: '', housingAllowance: '', transportAllowance: '', otherAllowances: '',
    currency: 'SAR', jobTitle: '', department: '', startDate: '',
    contractType: 'full_time' as string, probationPeriod: '90', benefits: [] as string[],
    expiryDate: '', notes: '', offerStatus: 'draft' as string, responseDate: '', responseNotes: '',
  });
  const [offerPortalUrl, setOfferPortalUrl] = useState<string | null>(null);

  // Hire dialog
  const [hireDialogOpen, setHireDialogOpen] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [hireData, setHireData] = useState({
    startDate: new Date().toISOString().split('T')[0],
    basicSalary: '', housingAllowance: '', transportAllowance: '',
  });

  // AI Video Interview dialog
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoSessions, setVideoSessions] = useState<any[]>([]);
  const [loadingVideoSessions, setLoadingVideoSessions] = useState(false);
  const [selectedVideoSession, setSelectedVideoSession] = useState<any>(null);
  const [sendingVideoInvite, setSendingVideoInvite] = useState(false);
  const [videoInterviewLang, setVideoInterviewLang] = useState<'en' | 'ar'>('en');
  const videoPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => { const ac = new AbortController(); loadAll(ac.signal); loadNotifications(ac.signal); return () => ac.abort(); }, []);
  useEffect(() => { if (newCandidate.departmentId) loadJobTitles(newCandidate.departmentId); }, [newCandidate.departmentId]);

  // Poll video sessions while dialog is open and sessions are in-progress
  useEffect(() => {
    // Clear any existing polling
    if (videoPollingRef.current) {
      clearInterval(videoPollingRef.current);
      videoPollingRef.current = null;
    }

    if (!videoDialogOpen || !selectedCandidate) return;

    // Check if any session needs polling (IN_PROGRESS, PENDING, or SENT)
    const needsPolling = videoSessions.some(
      (s: any) => s.status === 'IN_PROGRESS' || s.status === 'PENDING' || s.status === 'SENT',
    );

    if (!needsPolling) return;

    videoPollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/cvision/ai/chatbot?action=sessions&candidateId=${selectedCandidate.id}`,
          { credentials: 'include' },
        );
        const data = await res.json();
        const updated = (data.data?.items || data.data || []).filter(
          (s: any) => s.candidateId === selectedCandidate.id,
        );
        setVideoSessions(updated);

        // If a session just completed while we're viewing its detail, refresh detail too
        if (selectedVideoSession) {
          const updatedSession = updated.find((s: any) => s.id === selectedVideoSession.id);
          if (
            updatedSession &&
            (updatedSession.status === 'COMPLETED' || updatedSession.status === 'SCORED') &&
            selectedVideoSession.status !== 'COMPLETED' &&
            selectedVideoSession.status !== 'SCORED'
          ) {
            // Fetch full detail with videoReport
            try {
              const detRes = await fetch(
                `/api/cvision/ai/chatbot?action=session-detail&sessionId=${updatedSession.id}`,
                { credentials: 'include' },
              );
              const detData = await detRes.json();
              setSelectedVideoSession(detData.data || updatedSession);
            } catch {
              setSelectedVideoSession(updatedSession);
            }
          }
        }
      } catch { /* ignore polling errors */ }
    }, 5000); // Poll every 5 seconds

    return () => {
      if (videoPollingRef.current) {
        clearInterval(videoPollingRef.current);
        videoPollingRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoDialogOpen, selectedCandidate?.id, videoSessions.map(s => s.status).join(','), selectedVideoSession?.id]);

  async function loadAll(signal?: AbortSignal) {
    setLoading(true);
    await Promise.all([loadCandidates(signal), loadDepartments(signal)]);
    setLoading(false);
  }

  async function loadCandidates(signal?: AbortSignal) {
    try {
      const res = await fetch('/api/cvision/recruitment/candidates?limit=200', { credentials: 'include', signal });
      const data = await res.json();
      if (data.success) setCandidates(data.data?.items || data.data || []);
    } catch (error) { console.error('Failed to load candidates:', error); }
  }

  async function loadDepartments(signal?: AbortSignal) {
    try {
      const res = await fetch('/api/cvision/org/departments?limit=100', { credentials: 'include', signal });
      const data = await res.json();
      setDepartments(data.items || data.data?.items || data.data || []);
    } catch (error) { console.error('Failed to load departments:', error); }
  }

  async function loadJobTitles(departmentId: string, signal?: AbortSignal) {
    try {
      const res = await fetch(`/api/cvision/job-titles?departmentId=${departmentId}&limit=100`, { credentials: 'include', signal });
      const data = await res.json();
      setJobTitles(data.data || data.items || []);
    } catch (error) { console.error('Failed to load job titles:', error); }
  }

  async function loadNotifications(signal?: AbortSignal) {
    try {
      const res = await fetch('/api/cvision/notifications?limit=20', { credentials: 'include', signal });
      const data = await res.json();
      if (data.success) { setNotifications(data.notifications || []); setUnreadCount(data.unreadCount || 0); }
    } catch (error) { console.error('Failed to load notifications:', error); }
  }

  // CV Analysis
  async function analyzeCvFile(file: File) {
    setCvAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/cvision/recruitment/analyze-cv', { method: 'POST', credentials: 'include', body: formData });
      const data = await res.json();
      if (data.success && data.analysis) {
        setCvAnalysis(data.analysis);
        setPositionMatches(data.positionMatches || []);
        // Auto-fill form
        const a = data.analysis;
        setNewCandidate(prev => ({
          ...prev,
          fullName: prev.fullName || a.fullName || '',
          email: prev.email || a.email || '',
          phone: prev.phone || a.phone || '',
        }));
        if (data.positionMatches?.length > 0) {
          const best = data.positionMatches[0];
          if (best.matchScore >= 50) {
            setNewCandidate(prev => ({
              ...prev,
              departmentId: prev.departmentId || best.departmentId || '',
              jobTitleId: prev.jobTitleId || best.jobTitleId || '',
            }));
            if (best.departmentId) loadJobTitles(best.departmentId);
          }
        }
        toast.success(tr('تم تحليل السيرة الذاتية بنجاح', 'CV analyzed successfully'));
      }
    } catch (error) {
      toast.error(tr('فشل في تحليل السيرة الذاتية', 'Failed to analyze CV'));
    } finally {
      setCvAnalyzing(false);
    }
  }

  // Add candidate
  async function handleAddCandidate() {
    if (!newCandidate.fullName.trim()) { toast.error(tr('الاسم مطلوب', 'Name is required')); return; }
    try {
      setSaving(true);
      const candidatePayload: any = { ...newCandidate, status: 'new' };
      if (cvAnalysis) {
        candidatePayload.metadata = {
          skills: cvAnalysis.skills || [], yearsOfExperience: cvAnalysis.yearsOfExperience || 0,
          education: cvAnalysis.education || [], experience: cvAnalysis.experience || [],
          summary: cvAnalysis.summary || '',
        };
      }
      const res = await fetch('/api/cvision/recruitment/candidates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(candidatePayload),
      });
      const data = await res.json();
      if (data.success) {
        const candidateId = data.candidate?.id;
        // Upload CV if present
        if (cvFile && candidateId) {
          setCvUploading(true);
          try {
            const extractFd = new FormData();
            extractFd.append('file', cvFile);
            const extractRes = await fetch('/api/cvision/recruitment/extract-cv-text', { method: 'POST', credentials: 'include', body: extractFd });
            const extractData = await extractRes.json();
            if (extractData.success && extractData.extractedText) {
              await fetch(`/api/cvision/recruitment/candidates/${candidateId}/cv`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify({
                  fileName: cvFile.name, mimeType: cvFile.type, fileSize: cvFile.size,
                  extractedText: extractData.extractedText, analysisJson: cvAnalysis || null,
                }),
              });
            }
          } catch (error) { console.error('CV upload failed:', error); } finally { setCvUploading(false); }
        }
        toast.success(tr(`تمت إضافة ${data.candidate?.fullName} بنجاح`, `${data.candidate?.fullName} added successfully`));
        setAddDialogOpen(false);
        setCvFile(null); setCvAnalysis(null); setPositionMatches([]);
        setNewCandidate({ fullName: '', email: '', phone: '', departmentId: '', jobTitleId: '', source: 'DIRECT', notes: '' });
        await loadCandidates();
      } else { toast.error(data.error || tr('فشل في إضافة المرشح', 'Failed to add candidate')); }
    } catch (error) { toast.error(tr('فشل في إضافة المرشح', 'Failed to add candidate')); } finally { setSaving(false); }
  }

  // Update status
  async function updateStatus(candidateId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/cvision/recruitment/candidates/${candidateId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) { toast.success(tr(`تم تحديث الحالة إلى ${STATUS_CONFIG[newStatus]?.label || newStatus}`, `Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`)); await loadCandidates(); }
      else toast.error(data.error || tr('فشل في تحديث الحالة', 'Failed to update status'));
    } catch (error) { toast.error(tr('فشل في تحديث الحالة', 'Failed to update status')); }
  }

  // Screening
  function openScreenDialog(candidate: Candidate) {
    setSelectedCandidate(candidate);
    setScreenData({ screeningScore: 5, notes: candidate.notes || '', decision: '' });
    setCandidateDocuments([]);
    setScreenDialogOpen(true);
    setLoadingDocuments(true);
    fetch(`/api/cvision/recruitment/candidates/${candidate.id}/documents`, { credentials: 'include' })
      .then(r => r.json()).then(data => { if (data.success) setCandidateDocuments(data.documents || []); })
      .catch(() => {}).finally(() => setLoadingDocuments(false));
  }

  async function handleScreen() {
    if (!selectedCandidate || !screenData.decision) { toast.error(tr('يرجى اختيار قرار', 'Please select a decision')); return; }
    try {
      setScreening(true);
      if (screenData.decision === 'interview') {
        const res = await fetch(`/api/cvision/recruitment/candidates/${selectedCandidate.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ status: 'interview', notes: screenData.notes }),
        });
        const data = await res.json();
        if (data.success) { toast.success(tr(`تم نقل ${selectedCandidate.fullName} إلى المقابلة`, `${selectedCandidate.fullName} moved to Interview`)); setScreenDialogOpen(false); await loadCandidates(); }
        else toast.error(data.error || tr('فشل في تحديث المرشح', 'Failed to update candidate'));
      } else {
        const res = await fetch(`/api/cvision/recruitment/candidates/${selectedCandidate.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ action: 'screen', screeningScore: screenData.screeningScore * 10, notes: screenData.notes, decision: screenData.decision }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success(screenData.decision === 'shortlisted' ? tr(`تم اختيار ${selectedCandidate.fullName} في القائمة المختصرة!`, `${selectedCandidate.fullName} shortlisted!`) : tr(`تم رفض ${selectedCandidate.fullName}`, `${selectedCandidate.fullName} rejected`));
          setScreenDialogOpen(false); await loadCandidates();
        } else toast.error(data.error || tr('فشل في فرز المرشح', 'Failed to screen candidate'));
      }
    } catch (error) { toast.error(tr('فشل في فرز المرشح', 'Failed to screen candidate')); } finally { setScreening(false); }
  }

  // Interview
  function openInterviewDialog(candidate: Candidate, mode: 'schedule' | 'result' = 'schedule') {
    setSelectedCandidate(candidate);
    setInterviewMode(mode);
    setCandidateInterviews([]); setSelectedInterviewId(null);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    setInterviewData({
      scheduledDate: tomorrow.toISOString().split('T')[0], scheduledTime: '10:00',
      interviewType: 'in_person', interviewers: '', location: '', notes: '',
      interviewScore: 7, feedback: '', decision: '',
    });
    setInterviewDialogOpen(true);
    setLoadingInterviews(true);
    fetch(`/api/cvision/recruitment/candidates/${candidate.id}/interviews`, { credentials: 'include' })
      .then(r => r.json()).then(data => {
        if (data.success) {
          setCandidateInterviews(data.interviews || []);
          if (mode === 'result' && data.interviews?.length > 0) {
            const scheduled = data.interviews.find((i: any) => i.status === 'scheduled' || i.status === 'in_progress');
            if (scheduled) setSelectedInterviewId(scheduled.id);
          }
        }
      }).catch(() => {}).finally(() => setLoadingInterviews(false));
  }

  async function handleScheduleInterview() {
    if (!selectedCandidate || !interviewData.scheduledDate || !interviewData.scheduledTime) {
      toast.error(tr('يرجى اختيار التاريخ والوقت', 'Please select date and time')); return;
    }
    try {
      setSavingInterview(true);
      const res = await fetch(`/api/cvision/recruitment/candidates/${selectedCandidate.id}/interviews`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          type: interviewData.interviewType, scheduledDate: interviewData.scheduledDate,
          scheduledTime: interviewData.scheduledTime,
          interviewers: interviewData.interviewers ? interviewData.interviewers.split(',').map(s => s.trim()) : ['TBD'],
          location: interviewData.location || undefined, notes: interviewData.notes || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr(`تم جدولة جولة المقابلة ${data.interview.roundNumber}`, `Interview Round ${data.interview.roundNumber} scheduled`));
        setInterviewDialogOpen(false); await loadCandidates();
      } else toast.error(data.error || tr('فشل في جدولة المقابلة', 'Failed to schedule interview'));
    } catch (error) { toast.error(tr('فشل في جدولة المقابلة', 'Failed to schedule interview')); } finally { setSavingInterview(false); }
  }

  async function handleInterviewResult() {
    if (!selectedCandidate || !interviewData.decision) { toast.error(tr('يرجى اختيار قرار', 'Please select a decision')); return; }
    try {
      setSavingInterview(true);
      const decisionMap: Record<string, string> = { offer: 'offer', next_interview: 'next_round', hold: 'hold', rejected: 'fail' };
      if (selectedInterviewId) {
        const res = await fetch(`/api/cvision/recruitment/candidates/${selectedCandidate.id}/interviews`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({
            interviewId: selectedInterviewId, status: 'completed',
            score: interviewData.interviewScore, feedback: interviewData.feedback,
            decision: decisionMap[interviewData.decision] || 'pending',
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success(interviewData.decision === 'offer' ? tr(`تم نقل ${selectedCandidate.fullName} إلى مرحلة العرض`, `${selectedCandidate.fullName} moved to Offer stage`) : tr('تم تسجيل نتيجة المقابلة', 'Interview result recorded'));
          setInterviewDialogOpen(false); await loadCandidates();
        } else toast.error(data.error || tr('فشل في حفظ النتيجة', 'Failed to save result'));
      } else {
        // Fallback: update status directly
        let newStatus = selectedCandidate.status;
        if (interviewData.decision === 'offer') newStatus = 'offer';
        else if (interviewData.decision === 'rejected') newStatus = 'rejected';
        const res = await fetch(`/api/cvision/recruitment/candidates/${selectedCandidate.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ status: newStatus, notes: `${selectedCandidate.notes || ''}\n\n---\nInterview Score: ${interviewData.interviewScore}/10\nDecision: ${interviewData.decision}\nFeedback: ${interviewData.feedback || 'N/A'}`.trim() }),
        });
        const data = await res.json();
        if (data.success) { toast.success(tr('تم تسجيل نتيجة المقابلة', 'Interview result recorded')); setInterviewDialogOpen(false); await loadCandidates(); }
        else toast.error(data.error || tr('فشل في حفظ النتيجة', 'Failed to save result'));
      }
    } catch (error) { toast.error(tr('فشل في حفظ النتيجة', 'Failed to save result')); } finally { setSavingInterview(false); }
  }

  // Offer
  async function openOfferDialog(candidate: Candidate) {
    setSelectedCandidate(candidate);
    const today = new Date();
    const expiryDate = new Date(today); expiryDate.setDate(expiryDate.getDate() + 7);
    const startDate = new Date(today); startDate.setDate(startDate.getDate() + 30);
    setOfferData({
      basicSalary: candidate.offer?.basicSalary?.toString() || candidate.offerAmount?.toString() || '',
      housingAllowance: candidate.offer?.housingAllowance?.toString() || '',
      transportAllowance: candidate.offer?.transportAllowance?.toString() || '',
      otherAllowances: candidate.offer?.otherAllowances?.toString() || '',
      currency: candidate.offer?.currency || 'SAR',
      jobTitle: candidate.jobTitleName || '', department: candidate.departmentName || '',
      startDate: candidate.offer?.startDate || startDate.toISOString().split('T')[0],
      contractType: candidate.offer?.contractType || 'full_time',
      probationPeriod: candidate.offer?.probationPeriod?.toString() || '90',
      benefits: candidate.offer?.benefits || ['Health Insurance', 'Annual Leave 21 days', 'End of Service Benefits'],
      expiryDate: candidate.offer?.expiryDate || expiryDate.toISOString().split('T')[0],
      notes: candidate.offer?.notes || '',
      offerStatus: candidate.offer?.status || 'draft', responseDate: '', responseNotes: '',
    });
    setOfferPortalUrl(null);
    setOfferDialogOpen(true);
    // Load fresh offer data if candidate already has one
    if (candidate.status === 'offer') {
      try {
        const res = await fetch(`/api/cvision/recruitment/candidates/${candidate.id}/offer`, { credentials: 'include' });
        const data = await res.json();
        if (data.success && data.offer) {
          const o = data.offer;
          setOfferData(prev => ({
            ...prev, basicSalary: o.basicSalary?.toString() || prev.basicSalary,
            housingAllowance: o.housingAllowance?.toString() || '', transportAllowance: o.transportAllowance?.toString() || '',
            otherAllowances: o.otherAllowances?.toString() || '', currency: o.currency || 'SAR',
            startDate: o.startDate || prev.startDate, contractType: o.contractType || 'full_time',
            probationPeriod: o.probationPeriod?.toString() || '90',
            benefits: o.benefits?.length > 0 ? o.benefits : prev.benefits,
            expiryDate: o.expiryDate || prev.expiryDate, notes: o.notes || '',
            offerStatus: o.status || 'sent', responseNotes: o.candidateResponseNotes || '',
          }));
          if (data.portalUrl) setOfferPortalUrl(data.portalUrl);
        }
      } catch (error) { console.error('Failed to load offer:', error); }
    }
  }

  async function handleSendOffer() {
    if (!selectedCandidate || !offerData.basicSalary || !offerData.startDate) {
      toast.error(tr('يرجى إدخال الراتب وتاريخ البدء', 'Please enter salary and start date')); return;
    }
    try {
      setSavingOffer(true);
      const res = await fetch(`/api/cvision/recruitment/candidates/${selectedCandidate.id}/offer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          basicSalary: parseFloat(offerData.basicSalary), housingAllowance: parseFloat(offerData.housingAllowance) || 0,
          transportAllowance: parseFloat(offerData.transportAllowance) || 0, otherAllowances: parseFloat(offerData.otherAllowances) || 0,
          currency: offerData.currency, startDate: offerData.startDate, contractType: offerData.contractType,
          probationPeriod: parseInt(offerData.probationPeriod), benefits: offerData.benefits,
          expiryDate: offerData.expiryDate, notes: offerData.notes, sendEmail: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr(`تم إرسال العرض إلى ${selectedCandidate.fullName}!`, `Offer sent to ${selectedCandidate.fullName}!`));
        if (data.portalUrl) setOfferPortalUrl(data.portalUrl);
        setOfferDialogOpen(false); await loadCandidates();
      } else toast.error(data.error || tr('فشل في إرسال العرض', 'Failed to send offer'));
    } catch (error) { toast.error(tr('فشل في إرسال العرض', 'Failed to send offer')); } finally { setSavingOffer(false); }
  }

  async function handleOfferResponse(response: 'accepted' | 'rejected' | 'negotiating') {
    if (!selectedCandidate) return;
    try {
      setSavingOffer(true);
      const actionMap = { accepted: 'candidate_accept', rejected: 'candidate_reject', negotiating: 'candidate_negotiate' };
      const res = await fetch(`/api/cvision/recruitment/candidates/${selectedCandidate.id}/offer`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: actionMap[response], notes: offerData.responseNotes }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(response === 'accepted' ? tr(`${selectedCandidate.fullName} قبل العرض!`, `${selectedCandidate.fullName} accepted!`) : response === 'rejected' ? tr('تم رفض العرض', 'Offer rejected') : tr('بدأت المفاوضات', 'Negotiation started'));
        setOfferDialogOpen(false); await loadCandidates();
      } else toast.error(data.error || tr('فشل في معالجة الرد', 'Failed to process response'));
    } catch (error) { toast.error(tr('فشل في معالجة الرد', 'Failed to process response')); } finally { setSavingOffer(false); }
  }

  async function handleHRApproval(approved: boolean) {
    if (!selectedCandidate) return;
    try {
      setSavingOffer(true);
      const res = await fetch(`/api/cvision/recruitment/candidates/${selectedCandidate.id}/offer`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: approved ? 'hr_approve' : 'hr_reject', notes: offerData.responseNotes }),
      });
      const data = await res.json();
      if (data.success) {
        if (approved) {
          toast.success(tr(`تمت الموافقة على العرض! جاهز لتوظيف ${selectedCandidate.fullName}`, `Offer approved! Ready to hire ${selectedCandidate.fullName}`));
          setOfferDialogOpen(false);
          const offer = data.offer;
          setHireData({
            startDate: offer?.startDate || offerData.startDate || new Date().toISOString().split('T')[0],
            basicSalary: (offer?.basicSalary || parseFloat(offerData.basicSalary) || 0).toString(),
            housingAllowance: (offer?.housingAllowance || 0).toString(), transportAllowance: (offer?.transportAllowance || 0).toString(),
          });
          setHireDialogOpen(true);
        } else { toast.info(tr('تم رفض الموافقة على العرض', 'Offer approval rejected')); setOfferDialogOpen(false); }
        await loadCandidates();
      } else toast.error(data.error || tr('فشل في معالجة الموافقة', 'Failed to process approval'));
    } catch (error) { toast.error(tr('فشل في معالجة الموافقة', 'Failed to process approval')); } finally { setSavingOffer(false); }
  }

  // Hire
  async function openHireDialog(candidate: Candidate) {
    setSelectedCandidate(candidate);
    const defaultStart = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setHireData({
      startDate: candidate.offer?.startDate || defaultStart,
      basicSalary: (candidate.offer?.basicSalary || candidate.offerAmount || '').toString(),
      housingAllowance: (candidate.offer?.housingAllowance || '').toString(),
      transportAllowance: (candidate.offer?.transportAllowance || '').toString(),
    });
    setHireDialogOpen(true);
    try {
      const res = await fetch(`/api/cvision/recruitment/candidates/${candidate.id}/offer`, { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.offer) {
        setHireData({
          startDate: data.offer.startDate || defaultStart,
          basicSalary: (data.offer.basicSalary || data.offer.totalSalary || 0).toString(),
          housingAllowance: (data.offer.housingAllowance || 0).toString(),
          transportAllowance: (data.offer.transportAllowance || 0).toString(),
        });
      }
    } catch (error) { console.error('Failed to load offer for hire:', error); }
  }

  async function handleHire() {
    if (!selectedCandidate || !hireData.basicSalary) { toast.error(tr('يرجى إدخال الراتب الأساسي', 'Please enter basic salary')); return; }
    try {
      setHiring(true);
      const res = await fetch(`/api/cvision/recruitment/candidates/${selectedCandidate.id}/quick-hire`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          startDate: hireData.startDate, basicSalary: parseFloat(hireData.basicSalary),
          housingAllowance: parseFloat(hireData.housingAllowance) || 0,
          transportAllowance: parseFloat(hireData.transportAllowance) || 0,
          departmentId: selectedCandidate.departmentId, jobTitleId: selectedCandidate.jobTitleId,
        }),
      });
      const data = await res.json();
      if (data.success) { toast.success(tr(`تم توظيف ${selectedCandidate.fullName} بنجاح!`, `${selectedCandidate.fullName} hired successfully!`)); setHireDialogOpen(false); await loadCandidates(); }
      else toast.error(data.error || tr('فشل في التوظيف', 'Failed to hire'));
    } catch (error) { toast.error(tr('فشل في التوظيف', 'Failed to hire')); } finally { setHiring(false); }
  }

  // Seed candidate
  async function seedCandidate() {
    try {
      const res = await fetch('/api/cvision/recruitment/seed-candidate', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (data.success) { toast.success(tr('تم إنشاء مرشح تجريبي', 'Seed candidate created')); await loadCandidates(); }
      else toast.error(data.error || tr('فشل في الإنشاء', 'Failed to seed'));
    } catch (error) { toast.error(tr('فشل في الإنشاء', 'Failed to seed')); }
  }

  // Candidate detail
  async function openCandidateDetail(candidate: Candidate) {
    setDetailCandidate(candidate);
    setDetailOpen(true);
    setSkillInput('');
    setLoadingDocuments(true);
    try {
      const res = await fetch(`/api/cvision/recruitment/candidates/${candidate.id}/documents`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setCandidateDocuments(data.documents || []);
    } catch (error) { console.error('Failed to load documents:', error); } finally { setLoadingDocuments(false); }
  }

  async function addSkillToCandidate(skill: string) {
    if (!detailCandidate || !skill.trim()) return;
    const currentSkills: string[] = detailCandidate.metadata?.skills || [];
    if (currentSkills.some(s => s.toLowerCase() === skill.trim().toLowerCase())) {
      toast.error(tr('المهارة موجودة بالفعل', 'Skill already exists'));
      return;
    }
    const updatedSkills = [...currentSkills, skill.trim()];
    setSavingSkills(true);
    try {
      const res = await fetch(`/api/cvision/recruitment/candidates/${detailCandidate.id}`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: { ...detailCandidate.metadata, skills: updatedSkills } }),
      });
      const data = await res.json();
      if (data.success) {
        const updated = { ...detailCandidate, metadata: { ...detailCandidate.metadata, skills: updatedSkills } };
        setDetailCandidate(updated as Candidate);
        setCandidates(prev => prev.map(c => c.id === detailCandidate.id ? updated as Candidate : c));
        setSkillInput('');
        toast.success(tr(`تمت إضافة "${skill.trim()}"`, `Added "${skill.trim()}"`));
      } else { toast.error(data.error || tr('فشل في إضافة المهارة', 'Failed to add skill')); }
    } catch { toast.error(tr('خطأ في الشبكة', 'Network error')); }
    finally { setSavingSkills(false); }
  }

  async function removeSkillFromCandidate(skill: string) {
    if (!detailCandidate) return;
    const currentSkills: string[] = detailCandidate.metadata?.skills || [];
    const updatedSkills = currentSkills.filter(s => s !== skill);
    setSavingSkills(true);
    try {
      const res = await fetch(`/api/cvision/recruitment/candidates/${detailCandidate.id}`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: { ...detailCandidate.metadata, skills: updatedSkills } }),
      });
      const data = await res.json();
      if (data.success) {
        const updated = { ...detailCandidate, metadata: { ...detailCandidate.metadata, skills: updatedSkills } };
        setDetailCandidate(updated as Candidate);
        setCandidates(prev => prev.map(c => c.id === detailCandidate.id ? updated as Candidate : c));
        toast.success(tr(`تمت إزالة "${skill}"`, `Removed "${skill}"`));
      }
    } catch { toast.error(tr('خطأ في الشبكة', 'Network error')); }
    finally { setSavingSkills(false); }
  }

  // AI Video Interview
  async function openVideoInterviewDialog(candidate: Candidate) {
    setSelectedCandidate(candidate);
    setVideoDialogOpen(true);
    setSelectedVideoSession(null);
    setLoadingVideoSessions(true);
    try {
      const res = await fetch(`/api/cvision/ai/chatbot?action=sessions&candidateId=${candidate.id}`, { credentials: 'include' });
      const data = await res.json();
      setVideoSessions((data.data?.items || data.data || []).filter((s: any) => s.candidateId === candidate.id));
    } catch { setVideoSessions([]); }
    finally { setLoadingVideoSessions(false); }
  }

  async function sendVideoInterviewInvite() {
    if (!selectedCandidate) return;
    setSendingVideoInvite(true);
    try {
      // Check for an existing PENDING/SENT session to resend
      const existingSession = videoSessions.find((s: any) =>
        s.status === 'PENDING' || s.status === 'SENT',
      );

      if (existingSession) {
        // Resend existing invite
        const res = await fetch('/api/cvision/ai/chatbot', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send-invite', sessionId: existingSession.id, email: selectedCandidate.email }),
        });
        const data = await res.json();
        if (data.data?.inviteLink) {
          toast.success(tr('تم إرسال دعوة المقابلة!', 'Interview invite sent!'));
          await openVideoInterviewDialog(selectedCandidate);
        } else { toast.error(data.error || tr('فشل في إرسال الدعوة', 'Failed to send invite')); }
        return;
      }

      // No existing session — create a new one
      // 1. Find a matching job requisition for this candidate
      let requisition: any = null;

      // Priority 1: Use candidate's direct requisitionId if available
      if (selectedCandidate.requisitionId) {
        try {
          const directRes = await fetch(
            `/api/cvision/recruitment/requisitions?limit=100`,
            { credentials: 'include' },
          );
          const directData = await directRes.json();
          requisition = (directData.data?.items || directData.data || []).find(
            (r: any) => r.id === selectedCandidate.requisitionId,
          );
        } catch { /* continue to search */ }
      }

      // Priority 2: Search by jobTitleId and departmentId
      if (!requisition) {
        const reqRes = await fetch(
          `/api/cvision/recruitment/requisitions?limit=100`,
          { credentials: 'include' },
        );
        const reqData = await reqRes.json();
        const allReqs = (reqData.data?.items || reqData.data || []).filter(
          (r: any) => r.status === 'open' || r.status === 'approved',
        );
        const reqs = allReqs.length > 0 ? allReqs : (reqData.data?.items || reqData.data || []);

        // Try exact match: jobTitleId + departmentId
        if (selectedCandidate.jobTitleId) {
          requisition = reqs.find(
            (r: any) =>
              r.jobTitleId === selectedCandidate.jobTitleId &&
              r.departmentId === selectedCandidate.departmentId,
          );
          // Try jobTitleId only
          if (!requisition) {
            requisition = reqs.find(
              (r: any) => r.jobTitleId === selectedCandidate.jobTitleId,
            );
          }
        }

        // Try title name fuzzy match (case-insensitive)
        if (!requisition && selectedCandidate.jobTitleName) {
          const candTitle = selectedCandidate.jobTitleName.toLowerCase().trim();
          requisition = reqs.find((r: any) => {
            const reqTitle = (r.title || '').toLowerCase().trim();
            const reqJobTitle = (r.jobTitleName || '').toLowerCase().trim();
            return reqTitle === candTitle || reqJobTitle === candTitle
              || reqTitle.includes(candTitle) || candTitle.includes(reqTitle);
          });
        }

        // DO NOT fall back to reqs[0] — that causes wrong job title matching
      }

      // 2. Create interview session
      // If no matching requisition found, use candidate's job title directly
      const createRes = await fetch('/api/cvision/ai/chatbot', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-session',
          candidateId: selectedCandidate.id,
          ...(requisition
            ? { requisitionId: requisition.id }
            : { jobTitle: selectedCandidate.jobTitleName || selectedCandidate.departmentName || 'General' }),
          language: videoInterviewLang,
          questionCount: 8,
        }),
      });
      const createData = await createRes.json();
      if (createData.error) {
        toast.error(createData.error);
        return;
      }

      const newSessionId = createData.data?.session?.id;
      if (!newSessionId) {
        toast.error(tr('فشل في إنشاء جلسة المقابلة', 'Failed to create interview session'));
        return;
      }

      // 3. Send invite
      if (selectedCandidate.email) {
        await fetch('/api/cvision/ai/chatbot', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send-invite',
            sessionId: newSessionId,
            email: selectedCandidate.email,
          }),
        });
      }

      // 4. Auto-advance candidate to 'interview' stage if still earlier
      if (['applied', 'new', 'screening', 'shortlisted'].includes(selectedCandidate.status)) {
        await fetch(`/api/cvision/recruitment/candidates/${selectedCandidate.id}`, {
          method: 'PUT', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'interview' }),
        });
      }

      toast.success(tr('تم إرسال المقابلة المرئية! تم نقل المرشح إلى مرحلة المقابلة.', 'Video interview sent! Candidate moved to Interview stage.'));
      await loadCandidates();
      await openVideoInterviewDialog(selectedCandidate);
    } catch { toast.error(tr('حدث خطأ ما', 'Something went wrong')); }
    finally { setSendingVideoInvite(false); }
  }

  // Filter
  const filteredCandidates = candidates.filter(c => {
    const matchesSearch = !searchQuery || c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || c.email?.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone?.includes(searchQuery);
    const matchesDepartment = !filterDepartment || c.departmentId === filterDepartment;
    const matchesStatus = !filterStatus || c.status === filterStatus;
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const hiredCandidates = filteredCandidates.filter(c => c.status === 'hired');
  // Pipeline: new → screening → shortlisted → interview → offer
  const pipelineCandidates: Record<string, Candidate[]> = {
    applied: filteredCandidates.filter(c => c.status === 'applied' || c.status === 'new'),
    screening: filteredCandidates.filter(c => c.status === 'screening'),
    shortlisted: filteredCandidates.filter(c => c.status === 'shortlisted'),
    interview: filteredCandidates.filter(c => c.status === 'interview'),
    offer: filteredCandidates.filter(c => c.status === 'offer'),
  };

  const stats = {
    total: candidates.length,
    inPipeline: candidates.filter(c => !['hired', 'rejected'].includes(c.status)).length,
    hired: candidates.filter(c => c.status === 'hired').length,
    thisMonth: candidates.filter(c => { const d = new Date(c.createdAt); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }).length,
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}><RefreshCw style={{ height: 32, width: 32, animation: 'spin 1s linear infinite' }} /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 16 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ padding: 8, background: C.blueDim, borderRadius: 12 }}><Users style={{ height: 16, width: 16, color: C.blue }} /></div><div><p style={{ fontSize: 12, color: C.textMuted }}>{tr('الإجمالي', 'Total')}</p><p style={{ fontSize: 18, fontWeight: 700 }}>{stats.total}</p></div></div></CVisionCardBody></CVisionCard>
        <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 16 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ padding: 8, background: C.orangeDim, borderRadius: 12 }}><Clock style={{ height: 16, width: 16, color: C.orange }} /></div><div><p style={{ fontSize: 12, color: C.textMuted }}>{tr('في المسار', 'In Pipeline')}</p><p style={{ fontSize: 18, fontWeight: 700, color: C.orange }}>{stats.inPipeline}</p></div></div></CVisionCardBody></CVisionCard>
        <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 16 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ padding: 8, background: C.greenDim, borderRadius: 12 }}><UserCheck style={{ height: 16, width: 16, color: C.green }} /></div><div><p style={{ fontSize: 12, color: C.textMuted }}>{tr('تم التوظيف', 'Hired')}</p><p style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{stats.hired}</p></div></div></CVisionCardBody></CVisionCard>
        <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 16 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ padding: 8, background: C.purpleDim, borderRadius: 12 }}><Calendar style={{ height: 16, width: 16, color: C.purple }} /></div><div><p style={{ fontSize: 12, color: C.textMuted }}>{tr('هذا الشهر', 'This Month')}</p><p style={{ fontSize: 18, fontWeight: 700, color: C.purple }}>{stats.thisMonth}</p></div></div></CVisionCardBody></CVisionCard>
      </div>

      {/* Filters */}
      <CVisionCard C={C}>
        <CVisionCardBody style={{ paddingTop: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
                <CVisionInput C={C} placeholder={tr('البحث بالاسم، البريد، الهاتف...', 'Search by name, email, phone...')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ paddingLeft: 36 }} />
              </div>
            </div>
            <CVisionSelect
                C={C}
                value={filterDepartment || 'all'}
                placeholder={tr('القسم', 'Department')}
                options={[
                  { value: 'all', label: tr('جميع الأقسام', 'All Departments') },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
            <CVisionSelect
                C={C}
                value={filterStatus || 'all'}
                placeholder={tr('الحالة', 'Status')}
                options={[
                  { value: 'all', label: tr('جميع الحالات', 'All Status') },
                  ...Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'new').map(([key, config]) => (
                  ({ value: key, label: config.label })
                )),
                ]}
              />
            {/* View toggle */}
            <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              {(['all', 'pipeline', 'hired'] as const).map(v => (
                <button key={v} onClick={() => setActiveView(v)}
                  className={`px-3 py-1.5 text-xs font-medium ${activeView === v ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}>
                  {v === 'all' ? tr(`الكل (${filteredCandidates.length})`, `All (${filteredCandidates.length})`) : v === 'pipeline' ? tr('المسار', 'Pipeline') : tr(`تم التوظيف (${hiredCandidates.length})`, `Hired (${hiredCandidates.length})`)}
                </button>
              ))}
            </div>
            <CVisionButton C={C} isDark={isDark} variant="outline" size="icon" onClick={() => loadCandidates()}><RefreshCw style={{ height: 16, width: 16 }} /></CVisionButton>
            {isDev && <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={seedCandidate}><Sparkles style={{ height: 16, width: 16, marginRight: 4 }} /> Seed</CVisionButton>}
            <CVisionButton C={C} isDark={isDark} onClick={() => setAddDialogOpen(true)}><UserPlus style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('إضافة مرشح', 'Add Candidate')}</CVisionButton>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* All Candidates Table */}
      {activeView === 'all' && (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 16 }}>
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                  <CVisionTh C={C}>{tr('الاسم', 'Name')}</CVisionTh>
                  <CVisionTh C={C}>{tr('التواصل', 'Contact')}</CVisionTh>
                  <CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh>
                  <CVisionTh C={C}>{tr('المنصب', 'Position')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
                  <CVisionTh C={C}>{tr('التاريخ', 'Date')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الإجراءات', 'Actions')}</CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {filteredCandidates.length === 0 ? (
                  <CVisionTr C={C}><CVisionTd align="center" colSpan={7} style={{ paddingTop: 32, paddingBottom: 32 }}><Users style={{ height: 48, width: 48, color: C.textMuted, marginBottom: 8 }} /><p style={{ color: C.textMuted }}>{tr('لم يتم العثور على مرشحين', 'No candidates found')}</p></CVisionTd></CVisionTr>
                ) : (
                  filteredCandidates.map((candidate) => (
                    <CVisionTr C={C} key={candidate.id} style={{ cursor: 'pointer' }} onClick={() => openCandidateDetail(candidate)}>
                      <CVisionTd style={{ fontWeight: 500 }}>{candidate.fullName}</CVisionTd>
                      <CVisionTd>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13 }}>
                          {candidate.email && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail style={{ height: 12, width: 12 }} /> {candidate.email}</div>}
                          {candidate.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone style={{ height: 12, width: 12 }} /> {candidate.phone}</div>}
                        </div>
                      </CVisionTd>
                      <CVisionTd>{candidate.departmentName || '-'}</CVisionTd>
                      <CVisionTd>{candidate.jobTitleName || '-'}</CVisionTd>
                      <CVisionTd>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CVisionBadge C={C} className={STATUS_CONFIG[candidate.status]?.color}>{STATUS_CONFIG[candidate.status]?.label || candidate.status}</CVisionBadge>
                          {candidate.status !== 'hired' && candidate.status !== 'rejected' && (
                            <span style={{ color: C.textMuted, display: 'none' }}>
                              {(candidate.status === 'applied' || candidate.status === 'new' || candidate.status === 'screening') && '→ Shortlist'}
                              {candidate.status === 'shortlisted' && '→ Interview'}
                              {candidate.status === 'interview' && '→ Decision'}
                              {candidate.status === 'offer' && '→ Send Offer'}
                            </span>
                          )}
                        </div>
                      </CVisionTd>
                      <CVisionTd style={{ fontSize: 13 }}>{new Date(candidate.createdAt).toLocaleDateString()}</CVisionTd>
                      <CVisionTd onClick={(e) => e.stopPropagation()}>
                        <CandidateActionsMenu candidate={candidate} onStatusChange={updateStatus} onHire={openHireDialog} onScreen={openScreenDialog} onInterview={openInterviewDialog} onOffer={openOfferDialog} onMatch={onRunMatching} onVideoInterview={openVideoInterviewDialog} onScheduleInterview={(c) => { setImCandidate(c); setImMode('schedule'); setImDefaultType(c.status === 'shortlisted' ? 'VIDEO' : undefined); setImOpen(true); }} onViewInterviews={(c) => { setImCandidate(c); setImMode('history'); setImOpen(true); }} onSubmitFeedback={(c) => { setImCandidate(c); setImMode('feedback'); setImOpen(true); }} onInterviewDecision={(c) => { setImCandidate(c); setImMode('decision'); setImOpen(true); }} />
                      </CVisionTd>
                    </CVisionTr>
                  ))
                )}
              </CVisionTableBody>
            </CVisionTable>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Pipeline View — Professional Kanban */}
      {activeView === 'pipeline' && (
        <div>
          {/* Flow Steps Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16, paddingLeft: 4, paddingRight: 4 }}>
            {[
              { key: 'applied', label: tr('جديد', 'New'), icon: UserPlus, color: 'text-blue-600 bg-blue-100' },
              { key: 'shortlisted', label: tr('مختار', 'Shortlisted'), icon: ThumbsUp, color: 'text-indigo-600 bg-indigo-100' },
              { key: 'interview', label: tr('مقابلة', 'Interview'), icon: Video, color: 'text-yellow-600 bg-yellow-100' },
              { key: 'offer', label: tr('عرض', 'Offer'), icon: FileSignature, color: 'text-orange-600 bg-orange-100' },
            ].map((step, idx, arr) => (
              <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${step.color}`}>
                  <step.icon style={{ height: 14, width: 14 }} />
                  {step.label}
                  <span style={{ marginLeft: 4, opacity: 0.7 }}>({pipelineCandidates[step.key]?.length || 0})</span>
                </div>
                {idx < arr.length - 1 && <ArrowRight style={{ height: 16, width: 16, marginLeft: 4, marginRight: 4 }} />}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 12 }}>
            {[
              { key: 'applied', nextAction: tr('اختيار أو إرسال مقابلة مرئية', 'Shortlist or Send Video Interview'), nextIcon: ArrowRight },
              { key: 'shortlisted', nextAction: tr('إرسال مقابلة مرئية', 'Send Video Interview'), nextIcon: Video },
              { key: 'interview', nextAction: tr('تقييم واتخاذ قرار', 'Evaluate & Decide'), nextIcon: CheckCircle },
              { key: 'offer', nextAction: tr('إنشاء وإرسال العرض', 'Create & Send Offer'), nextIcon: FileSignature },
            ].map(({ key, nextAction, nextIcon: NextIcon }) => {
              const list = pipelineCandidates[key] || [];
              const config = STATUS_CONFIG[key];
              return (
                <div key={key} style={{ border: `1px solid ${C.border}`, borderRadius: 16 }}>
                  <div style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{config?.label || key}</span>
                      <CVisionBadge C={C} variant="secondary" style={{ fontSize: 12 }}>{list.length}</CVisionBadge>
                    </div>
                    <p style={{ color: C.textMuted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <NextIcon style={{ height: 12, width: 12 }} /> {tr('التالي:', 'Next:')} {nextAction}
                    </p>
                  </div>
                  <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                    {list.length === 0 ? (
                      <p style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', paddingTop: 24, paddingBottom: 24 }}>{tr('لا يوجد مرشحون', 'No candidates')}</p>
                    ) : (
                      list.map((c: Candidate) => (
                        <div key={c.id} style={{ padding: 10, border: `1px solid ${C.border}`, borderRadius: 12, cursor: 'pointer' }} onClick={() => openCandidateDetail(c)}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.fullName}</p>
                              {c.jobTitleName && <p style={{ color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.jobTitleName}</p>}
                            </div>
                            <div onClick={(e) => e.stopPropagation()}>
                              <CandidateActionsMenu candidate={c} onStatusChange={updateStatus} onHire={openHireDialog} onScreen={openScreenDialog} onInterview={openInterviewDialog} onOffer={openOfferDialog} onMatch={onRunMatching} onVideoInterview={openVideoInterviewDialog} onScheduleInterview={(c2) => { setImCandidate(c2); setImMode('schedule'); setImOpen(true); }} onViewInterviews={(c2) => { setImCandidate(c2); setImMode('history'); setImOpen(true); }} onSubmitFeedback={(c2) => { setImCandidate(c2); setImMode('feedback'); setImOpen(true); }} onInterviewDecision={(c2) => { setImCandidate(c2); setImMode('decision'); setImOpen(true); }} compact />
                            </div>
                          </div>
                          {c.screeningScore != null && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, color: C.orange }}>
                              <Star style={{ height: 12, width: 12 }} />{Math.round(c.screeningScore / 10)}/10
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hired View */}
      {activeView === 'hired' && (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 16 }}>
            {hiredCandidates.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: 48, paddingBottom: 48 }}><UserCheck style={{ height: 48, width: 48, color: C.textMuted, marginBottom: 16 }} /><p style={{ color: C.textMuted }}>{tr('لا يوجد مرشحون تم توظيفهم بعد', 'No hired candidates yet')}</p></div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
                {hiredCandidates.map((c) => (
                  <CVisionCard C={C} key={c.id} style={{ background: C.greenDim }}>
                    <CVisionCardBody style={{ paddingTop: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><div><p style={{ fontWeight: 500 }}>{c.fullName}</p><p style={{ fontSize: 13, color: C.textMuted }}>{c.jobTitleName}</p><p style={{ fontSize: 12, color: C.textMuted }}>{c.departmentName}</p></div><CVisionBadge C={C} style={{ background: C.greenDim }}>{tr('تم التوظيف', 'Hired')}</CVisionBadge></div>
                      {c.employeeId && <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ width: '100%', marginTop: 12 }} onClick={() => router.push(`/cvision/employees/${c.employeeId}`)}>{tr('عرض ملف الموظف', 'View Employee Profile')}</CVisionButton>}
                    </CVisionCardBody>
                  </CVisionCard>
                ))}
              </div>
            )}
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* ===== DIALOGS ===== */}

      {/* Add Candidate Dialog */}
      <CVisionDialog C={C} open={addDialogOpen} onClose={() => setAddDialogOpen(false)} title={tr('إضافة مرشح', 'Add Candidate')} isDark={isDark}><p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{tr('أدخل معلومات المرشح لبدء عملية التوظيف.', 'Enter candidate information to start the hiring process.')}</p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16, paddingBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('الاسم الكامل *', 'Full Name *')}</CVisionLabel><CVisionInput C={C} value={newCandidate.fullName} onChange={(e) => setNewCandidate({ ...newCandidate, fullName: e.target.value })} placeholder={tr('أدخل الاسم الكامل', 'Enter full name')} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('البريد الإلكتروني', 'Email')}</CVisionLabel><CVisionInput C={C} type="email" value={newCandidate.email} onChange={(e) => setNewCandidate({ ...newCandidate, email: e.target.value })} placeholder="email@example.com" /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('الهاتف', 'Phone')}</CVisionLabel><CVisionInput C={C} value={newCandidate.phone} onChange={(e) => setNewCandidate({ ...newCandidate, phone: e.target.value })} placeholder="+966..." /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('القسم', 'Department')}</CVisionLabel>
                <CVisionSelect
                C={C}
                value={newCandidate.departmentId || 'none'}
                placeholder={tr('اختر', 'Select')}
                options={[
                  { value: 'none', label: tr('اختر...', 'Select...') },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('المنصب', 'Position')}</CVisionLabel>
                <CVisionSelect
                C={C}
                value={newCandidate.jobTitleId || 'none'}
                placeholder={tr('اختر', 'Select')}
                options={[
                  { value: 'none', label: tr('اختر...', 'Select...') },
                  ...jobTitles.map((j) => ({ value: j.id, label: j.name })),
                ]}
              />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('المصدر', 'Source')}</CVisionLabel>
              <CVisionSelect
                C={C}
                value={newCandidate.source}
                options={[
                  { value: 'DIRECT', label: tr('تقديم مباشر', 'Direct Application') },
                  { value: 'REFERRAL', label: tr('إحالة', 'Referral') },
                  { value: 'AGENCY', label: tr('وكالة', 'Agency') },
                  { value: 'LINKEDIN', label: 'LinkedIn' },
                  { value: 'OTHER', label: tr('أخرى', 'Other') },
                ]}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('ملاحظات', 'Notes')}</CVisionLabel><CVisionInput C={C} value={newCandidate.notes} onChange={(e) => setNewCandidate({ ...newCandidate, notes: e.target.value })} placeholder={tr('أي ملاحظات إضافية...', 'Any additional notes...')} /></div>
            {/* CV Upload */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FileText style={{ height: 16, width: 16 }} /> {tr('رفع السيرة الذاتية (PDF/DOCX) - يملأ النموذج تلقائياً!', 'Upload CV (PDF/DOCX) - Auto-fills form!')}</CVisionLabel>
              <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${cvAnalyzing ? 'border-blue-400 bg-blue-50' : ''}`}>
                {cvAnalyzing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingTop: 8, paddingBottom: 8 }}><RefreshCw style={{ height: 32, width: 32, animation: 'spin 1s linear infinite', color: C.blue }} /><span style={{ fontSize: 13, color: C.blue, fontWeight: 500 }}>{tr('جاري تحليل السيرة الذاتية بالذكاء الاصطناعي...', 'Analyzing CV with AI...')}</span></div>
                ) : cvFile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>{cvFile.name}</span><CVisionButton C={C} isDark={isDark} type="button" variant="ghost" size="sm" onClick={() => { setCvFile(null); setCvAnalysis(null); setPositionMatches([]); }}><XCircle style={{ height: 16, width: 16, color: C.red }} /></CVisionButton></div>
                    {cvAnalysis && (
                      <div style={{ textAlign: 'left', padding: 8, background: C.greenDim, borderRadius: 6, border: `1px solid ${C.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.green, fontSize: 12, fontWeight: 500, marginBottom: 4 }}><CheckCircle style={{ height: 12, width: 12 }} /> {tr('تم استخراج البيانات', 'Data Extracted')}</div>
                        {cvAnalysis.skills?.length > 0 && <div style={{ fontSize: 12, color: C.textMuted }}>{tr('المهارات:', 'Skills:')} {cvAnalysis.skills.slice(0, 5).join(', ')}{cvAnalysis.skills.length > 5 ? '...' : ''}</div>}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="sr-only" tabIndex={-1} onChange={(e) => { const file = e.target.files?.[0]; if (file) { setCvFile(file); analyzeCvFile(file); } }} />
                    <div style={{ fontSize: 13, color: C.textMuted, cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}>
                      <Upload style={{ height: 32, width: 32, marginBottom: 8 }} /><span style={{ color: C.blue, fontWeight: 500 }}>{tr('انقر لرفع السيرة الذاتية', 'Click to upload CV')}</span><p style={{ fontSize: 12, marginTop: 4 }}>{tr('الذكاء الاصطناعي سيملأ النموذج تلقائياً', 'AI will auto-fill the form')}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
            {/* Position Suggestions */}
            {positionMatches.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Star style={{ height: 16, width: 16, color: C.orange }} /> {tr('المناصب المقترحة', 'Suggested Positions')}</CVisionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {positionMatches.map((match: any, idx: number) => (
                    <div key={idx} className={`p-3 rounded-lg border cursor-pointer transition-colors ${newCandidate.jobTitleId === match.jobTitleId ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                      onClick={() => { setNewCandidate(prev => ({ ...prev, departmentId: match.departmentId, jobTitleId: match.jobTitleId })); if (match.departmentId) loadJobTitles(match.departmentId); }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div><span style={{ fontWeight: 500, fontSize: 13 }}>{match.jobTitleName}</span><span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>({match.departmentName})</span></div>
                        <CVisionBadge C={C} variant={match.matchScore >= 70 ? 'default' : 'secondary'} className={match.matchScore >= 70 ? 'bg-green-500' : ''}>{match.matchScore}% {tr('تطابق', 'Match')}</CVisionBadge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16 }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => { setAddDialogOpen(false); setCvFile(null); setCvAnalysis(null); setPositionMatches([]); }}>{tr('إلغاء', 'Cancel')}</CVisionButton>
              <CVisionButton C={C} isDark={isDark} onClick={handleAddCandidate} disabled={saving || cvUploading || cvAnalyzing || !newCandidate.fullName}>
                {(saving || cvUploading) && <RefreshCw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
                {cvUploading ? tr('جاري رفع السيرة الذاتية...', 'Uploading CV...') : tr('إضافة مرشح', 'Add Candidate')}
              </CVisionButton>
            </div>
          </div>
      </CVisionDialog>

      {/* Candidate Detail Dialog */}
      <CVisionDialog C={C} open={detailOpen} onClose={() => setDetailOpen(false)} title="Details" isDark={isDark}>          {detailCandidate && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 16 }}>{detailCandidate.fullName}</p>
                  <p style={{ fontSize: 13, color: C.textMuted }}>{detailCandidate.jobTitleName || tr('بدون منصب', 'No position')} {detailCandidate.departmentName ? `- ${detailCandidate.departmentName}` : ''}</p>
                </div>
                <CVisionBadge C={C} className={STATUS_CONFIG[detailCandidate.status]?.color}>{STATUS_CONFIG[detailCandidate.status]?.label || detailCandidate.status}</CVisionBadge>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 13 }}>
                {detailCandidate.email && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail style={{ height: 12, width: 12 }} /> {detailCandidate.email}</div>}
                {detailCandidate.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone style={{ height: 12, width: 12 }} /> {detailCandidate.phone}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar style={{ height: 12, width: 12 }} /> {new Date(detailCandidate.createdAt).toLocaleDateString()}</div>
                {detailCandidate.screeningScore != null && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Star style={{ height: 12, width: 12, color: C.orange }} /> {tr('الدرجة:', 'Score:')} {Math.round(detailCandidate.screeningScore / 10)}/10</div>}
              </div>
              {/* Skills section — manual entry + CV-extracted */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{tr('المهارات', 'Skills')}</span>
                  {detailCandidate.metadata?.cvParsed && <CVisionBadge C={C} variant="outline" className="text-[10px]">{tr('تم تحليل السيرة الذاتية', 'CV Parsed')}</CVisionBadge>}
                </div>
                {(detailCandidate.metadata?.skills?.length || 0) > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                    {(detailCandidate.metadata?.skills || []).map((s: string) => (
                      <CVisionBadge C={C} key={s} variant="secondary" style={{ fontSize: 12, paddingRight: 4 }}>
                        {s}
                        <button onClick={() => removeSkillFromCandidate(s)} style={{ marginLeft: 2 }} disabled={savingSkills}>
                          <XCircle style={{ height: 12, width: 12 }} />
                        </button>
                      </CVisionBadge>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>{tr('لا توجد مهارات بعد — أضف يدوياً أو ارفع سيرة ذاتية', 'No skills yet — add manually or upload a CV')}</p>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <CVisionInput C={C}
                    value={skillInput}
                    onChange={e => setSkillInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && skillInput.trim()) { e.preventDefault(); addSkillToCandidate(skillInput); } }}
                    placeholder={tr('اكتب المهارة، اضغط Enter...', 'Type skill, press Enter...')}
                    style={{ fontSize: 13, height: 32 }}
                    disabled={savingSkills}
                  />
                  <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ height: 32, paddingLeft: 8, paddingRight: 8 }} disabled={!skillInput.trim() || savingSkills} onClick={() => addSkillToCandidate(skillInput)}>
                    {savingSkills ? <RefreshCw style={{ height: 12, width: 12, animation: 'spin 1s linear infinite' }} /> : <Check style={{ height: 12, width: 12 }} />}
                  </CVisionButton>
                </div>
              </div>
              {/* Documents */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{tr('المستندات:', 'Documents:')}</span>
                {loadingDocuments ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 13, color: C.textMuted }}><RefreshCw style={{ height: 12, width: 12, animation: 'spin 1s linear infinite' }} /> {tr('جاري التحميل...', 'Loading...')}</div>
                : candidateDocuments.length === 0 ? <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{tr('لا توجد مستندات', 'No documents')}</p>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>{candidateDocuments.map((doc: any) => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><FileText style={{ height: 12, width: 12, color: C.blue }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{doc.fileName}</span><CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>{doc.kind}</CVisionBadge></div>
                ))}</div>}
              </div>
              {detailCandidate.notes && <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}><span style={{ fontSize: 13, fontWeight: 500 }}>{tr('ملاحظات:', 'Notes:')}</span><p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>{detailCandidate.notes}</p></div>}
              {/* Pipeline Progress */}
              {detailCandidate.status !== 'hired' && detailCandidate.status !== 'rejected' && (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 8 }}>{tr('مسار التوظيف', 'Hiring Pipeline')}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {['new', 'shortlisted', 'interview', 'offer', 'hired'].map((step, i, arr) => {
                      const stepIndex = arr.indexOf(step);
                      const currentIndex = arr.indexOf(
                        detailCandidate.status === 'applied' || detailCandidate.status === 'new' || detailCandidate.status === 'screening' ? 'new' : detailCandidate.status
                      );
                      const isDone = stepIndex < currentIndex;
                      const isCurrent = stepIndex === currentIndex;
                      const labels: Record<string, string> = { new: tr('جديد', 'New'), shortlisted: tr('مختار', 'Shortlisted'), interview: tr('مقابلة', 'Interview'), offer: tr('عرض', 'Offer'), hired: tr('تم التوظيف', 'Hired') };
                      return (
                        <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                          <div className={`flex-1 text-center py-1 rounded text-[10px] font-medium ${
                            isDone ? 'bg-green-100 text-green-700' : isCurrent ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300' : 'bg-muted text-muted-foreground'
                          }`}>
                            {isDone ? '✓' : ''} {labels[step]}
                          </div>
                          {i < arr.length - 1 && <ArrowRight style={{ height: 12, width: 12, marginLeft: 2, marginRight: 2 }} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action buttons — clear next step */}
              <div style={{ paddingTop: 12, borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Primary: Next Step */}
                {(detailCandidate.status === 'applied' || detailCandidate.status === 'new' || detailCandidate.status === 'screening') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <p style={{ fontWeight: 600, color: C.textMuted, textTransform: 'uppercase' }}>{tr('الخطوة التالية', 'Next Step')}</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => { setDetailOpen(false); updateStatus(detailCandidate.id, 'shortlisted'); }} style={{ flex: 1 }}><ThumbsUp style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('اختيار', 'Shortlist')}</CVisionButton>
                      <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => { setDetailOpen(false); openVideoInterviewDialog(detailCandidate); }} style={{ color: C.blue, flex: 1 }}><Video style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('مقابلة مرئية', 'Video Interview')}</CVisionButton>
                    </div>
                  </div>
                )}
                {detailCandidate.status === 'shortlisted' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <p style={{ fontWeight: 600, color: C.textMuted, textTransform: 'uppercase' }}>{tr('الخطوة التالية', 'Next Step')}</p>
                    <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => { setDetailOpen(false); openVideoInterviewDialog(detailCandidate); }} style={{ background: C.blueDim, width: '100%' }}><Video style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('إرسال مقابلة مرئية', 'Send Video Interview')}</CVisionButton>
                  </div>
                )}
                {detailCandidate.status === 'interview' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <p style={{ fontWeight: 600, color: C.textMuted, textTransform: 'uppercase' }}>{tr('الخطوة التالية', 'Next Step')}</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => { setDetailOpen(false); setImCandidate(detailCandidate); setImMode('decision'); setImOpen(true); }} style={{ background: C.greenDim, flex: 1 }}><CheckCircle style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('تقييم واتخاذ قرار', 'Evaluate & Decide')}</CVisionButton>
                      <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => { setDetailOpen(false); openVideoInterviewDialog(detailCandidate); }} style={{ color: C.blue }}><Video style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('النتائج', 'Results')}</CVisionButton>
                    </div>
                  </div>
                )}
                {detailCandidate.status === 'offer' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <p style={{ fontWeight: 600, color: C.textMuted, textTransform: 'uppercase' }}>{tr('الخطوة التالية', 'Next Step')}</p>
                    <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => { setDetailOpen(false); openOfferDialog(detailCandidate); }} style={{ background: C.orangeDim, width: '100%' }}><FileSignature style={{ height: 16, width: 16, marginRight: 4 }} /> {detailCandidate.offer ? tr('إدارة العرض', 'Manage Offer') : tr('إنشاء وإرسال العرض', 'Create & Send Offer')}</CVisionButton>
                  </div>
                )}
              </div>
            </div>
          )}
      </CVisionDialog>

      {/* Screening Dialog */}
      <CVisionDialog C={C} open={screenDialogOpen} onClose={() => setScreenDialogOpen(false)} title={tr('فحص المرشح', 'Screen Candidate')} isDark={isDark}><p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{tr('تقييم واتخاذ قرار', 'Evaluate and make a decision')}</p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 16, paddingBottom: 16 }}>
            {selectedCandidate && (
              <div style={{ padding: 16, background: C.bgSubtle, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><div><p style={{ fontWeight: 600, fontSize: 16 }}>{selectedCandidate.fullName}</p><p style={{ fontSize: 13, color: C.textMuted }}>{selectedCandidate.jobTitleName || tr('بدون منصب', 'No position')} - {selectedCandidate.departmentName || tr('بدون قسم', 'No department')}</p></div><CVisionBadge C={C} className={STATUS_CONFIG[selectedCandidate.status]?.color}>{STATUS_CONFIG[selectedCandidate.status]?.label}</CVisionBadge></div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><CVisionLabel C={C} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Star style={{ height: 16, width: 16, color: C.orange }} /> {tr('درجة الفرز', 'Screening Score')}</CVisionLabel><span style={{ fontSize: 24, fontWeight: 700, color: C.gold }}>{screenData.screeningScore}/10</span></div>
              <Slider value={[screenData.screeningScore]} onValueChange={([v]) => setScreenData({ ...screenData, screeningScore: v })} min={1} max={10} step={1} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('ملاحظات', 'Notes')}</CVisionLabel><CVisionTextarea C={C} value={screenData.notes} onChange={(e) => setScreenData({ ...screenData, notes: e.target.value })} placeholder={tr('ملاحظات التقييم...', 'Evaluation notes...')} rows={3} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>{tr('القرار', 'Decision')}</CVisionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <CVisionButton C={C} isDark={isDark} type="button" variant={screenData.decision === 'shortlisted' ? 'default' : 'outline'} className={`h-20 flex flex-col items-center justify-center gap-2 ${screenData.decision === 'shortlisted' ? 'bg-green-600 hover:bg-green-700' : ''}`} onClick={() => setScreenData({ ...screenData, decision: 'shortlisted' })}><ThumbsUp style={{ height: 24, width: 24 }} /><span style={{ fontSize: 12 }}>{tr('اختيار', 'Shortlist')}</span></CVisionButton>
                <CVisionButton C={C} isDark={isDark} type="button" variant={screenData.decision === 'interview' ? 'default' : 'outline'} className={`h-20 flex flex-col items-center justify-center gap-2 ${screenData.decision === 'interview' ? 'bg-blue-600 hover:bg-blue-700' : ''}`} onClick={() => setScreenData({ ...screenData, decision: 'interview' })}><Users style={{ height: 24, width: 24 }} /><span style={{ fontSize: 12 }}>{tr('مقابلة', 'Interview')}</span></CVisionButton>
                <CVisionButton C={C} isDark={isDark} type="button" variant={screenData.decision === 'rejected' ? 'default' : 'outline'} className={`h-20 flex flex-col items-center justify-center gap-2 ${screenData.decision === 'rejected' ? 'bg-red-600 hover:bg-red-700' : ''}`} onClick={() => setScreenData({ ...screenData, decision: 'rejected' })}><ThumbsDown style={{ height: 24, width: 24 }} /><span style={{ fontSize: 12 }}>{tr('رفض', 'Reject')}</span></CVisionButton>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setScreenDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
              <CVisionButton C={C} isDark={isDark} onClick={handleScreen} disabled={screening || !screenData.decision}>{screening && <RefreshCw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}{screenData.decision === 'shortlisted' ? tr('اختيار', 'Shortlist') : screenData.decision === 'interview' ? tr('نقل إلى المقابلة', 'Move to Interview') : screenData.decision === 'rejected' ? tr('رفض', 'Reject') : tr('اختر القرار', 'Select Decision')}</CVisionButton>
            </div>
          </div>
      </CVisionDialog>

      {/* Interview Dialog */}
      <CVisionDialog C={C} open={interviewDialogOpen} onClose={() => setInterviewDialogOpen(false)} title={tr('جدولة مقابلة', 'Schedule Interview')} isDark={isDark}>          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 16, paddingBottom: 16 }}>
            {selectedCandidate && <div style={{ padding: 12, background: C.bgSubtle, borderRadius: 12 }}><p style={{ fontWeight: 600 }}>{selectedCandidate.fullName}</p><p style={{ fontSize: 13, color: C.textMuted }}>{selectedCandidate.jobTitleName || tr('بدون منصب', 'No position')}</p></div>}
            {/* Interview rounds list */}
            {!loadingInterviews && candidateInterviews.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C} style={{ fontSize: 13, fontWeight: 500 }}>{tr('جولات المقابلات', 'Interview Rounds')} ({candidateInterviews.length})</CVisionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                  {candidateInterviews.map((interview: any) => (
                    <div key={interview.id} className={`p-2 rounded border text-sm cursor-pointer ${selectedInterviewId === interview.id ? 'border-blue-500 bg-blue-50' : 'hover:border-blue-300'}`}
                      onClick={() => { if (interview.status !== 'cancelled') { setSelectedInterviewId(interview.id); setInterviewMode('result'); } }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 500 }}>{tr('الجولة', 'Round')} {interview.roundNumber} - {interview.type?.replace('_', ' ')}</span>
                        <CVisionBadge C={C} className={`text-xs ${interview.status === 'completed' ? 'bg-green-100 text-green-800' : interview.status === 'scheduled' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}>{interview.status}</CVisionBadge>
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{new Date(interview.scheduledDate).toLocaleDateString()} at {interview.scheduledTime}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 8 }}>
              <CVisionButton C={C} isDark={isDark} type="button" variant={interviewMode === 'schedule' ? 'default' : 'outline'} size="sm" style={{ flex: 1 }} onClick={() => { setInterviewMode('schedule'); setSelectedInterviewId(null); }}><Calendar style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('جدولة جديدة', 'Schedule New')}</CVisionButton>
              <CVisionButton C={C} isDark={isDark} type="button" variant={interviewMode === 'result' ? 'default' : 'outline'} size="sm" style={{ flex: 1 }} onClick={() => setInterviewMode('result')} disabled={candidateInterviews.length === 0}><ClipboardList style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('تسجيل النتيجة', 'Record Result')}</CVisionButton>
            </div>
            {interviewMode === 'schedule' ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('التاريخ *', 'Date *')}</CVisionLabel><CVisionInput C={C} type="date" value={interviewData.scheduledDate} onChange={(e) => setInterviewData({ ...interviewData, scheduledDate: e.target.value })} /></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('الوقت *', 'Time *')}</CVisionLabel><CVisionInput C={C} type="time" value={interviewData.scheduledTime} onChange={(e) => setInterviewData({ ...interviewData, scheduledTime: e.target.value })} /></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('النوع', 'Type')}</CVisionLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {[{ value: 'phone', label: tr('هاتفية', 'Phone') }, { value: 'video', label: tr('مرئية', 'Video') }, { value: 'in_person', label: tr('حضورية', 'In Person') }, { value: 'technical', label: tr('تقنية', 'Technical') }].map((t) => (
                      <CVisionButton C={C} isDark={isDark} key={t.value} type="button" variant={interviewData.interviewType === t.value ? 'default' : 'outline'} size="sm" onClick={() => setInterviewData({ ...interviewData, interviewType: t.value })}>{t.label}</CVisionButton>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('المقابِلون', 'Interviewers')}</CVisionLabel><CVisionInput C={C} value={interviewData.interviewers} onChange={(e) => setInterviewData({ ...interviewData, interviewers: e.target.value })} placeholder={tr('الأسماء (مفصولة بفاصلة)', 'Names (comma separated)')} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('الموقع', 'Location')}</CVisionLabel><CVisionInput C={C} value={interviewData.location} onChange={(e) => setInterviewData({ ...interviewData, location: e.target.value })} placeholder={tr('قاعة الاجتماعات، المكتب...', 'Meeting room, office...')} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('ملاحظات', 'Notes')}</CVisionLabel><CVisionTextarea C={C} value={interviewData.notes} onChange={(e) => setInterviewData({ ...interviewData, notes: e.target.value })} rows={2} /></div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                  <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setInterviewDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
                  <CVisionButton C={C} isDark={isDark} onClick={handleScheduleInterview} disabled={savingInterview || !interviewData.scheduledDate || !interviewData.scheduledTime} style={{ background: C.blueDim }}>{savingInterview && <RefreshCw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />} {tr('جدولة المقابلة', 'Schedule Interview')}</CVisionButton>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><CVisionLabel C={C}>{tr('درجة المقابلة', 'Interview Score')}</CVisionLabel><span style={{ fontSize: 24, fontWeight: 700, color: C.gold }}>{interviewData.interviewScore}/10</span></div>
                  <Slider value={[interviewData.interviewScore]} onValueChange={([v]) => setInterviewData({ ...interviewData, interviewScore: v })} min={1} max={10} step={1} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('التقييم', 'Feedback')}</CVisionLabel><CVisionTextarea C={C} value={interviewData.feedback} onChange={(e) => setInterviewData({ ...interviewData, feedback: e.target.value })} rows={3} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('القرار', 'Decision')}</CVisionLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    <CVisionButton C={C} isDark={isDark} type="button" variant={interviewData.decision === 'offer' ? 'default' : 'outline'} className={`h-16 flex flex-col items-center justify-center gap-1 ${interviewData.decision === 'offer' ? 'bg-green-600 hover:bg-green-700' : ''}`} onClick={() => setInterviewData({ ...interviewData, decision: 'offer' })}><CheckCircle style={{ height: 20, width: 20 }} /><span style={{ fontSize: 12 }}>{tr('ناجح - مرحلة العرض', 'Pass - Offer Stage')}</span></CVisionButton>
                    <CVisionButton C={C} isDark={isDark} type="button" variant={interviewData.decision === 'next_interview' ? 'default' : 'outline'} className={`h-16 flex flex-col items-center justify-center gap-1 ${interviewData.decision === 'next_interview' ? 'bg-blue-600 hover:bg-blue-700' : ''}`} onClick={() => setInterviewData({ ...interviewData, decision: 'next_interview' })}><Users style={{ height: 20, width: 20 }} /><span style={{ fontSize: 12 }}>{tr('الجولة التالية', 'Next Round')}</span></CVisionButton>
                    <CVisionButton C={C} isDark={isDark} type="button" variant={interviewData.decision === 'hold' ? 'default' : 'outline'} className={`h-16 flex flex-col items-center justify-center gap-1 ${interviewData.decision === 'hold' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}`} onClick={() => setInterviewData({ ...interviewData, decision: 'hold' })}><Clock style={{ height: 20, width: 20 }} /><span style={{ fontSize: 12 }}>{tr('معلق', 'On Hold')}</span></CVisionButton>
                    <CVisionButton C={C} isDark={isDark} type="button" variant={interviewData.decision === 'rejected' ? 'default' : 'outline'} className={`h-16 flex flex-col items-center justify-center gap-1 ${interviewData.decision === 'rejected' ? 'bg-red-600 hover:bg-red-700' : ''}`} onClick={() => setInterviewData({ ...interviewData, decision: 'rejected' })}><ThumbsDown style={{ height: 20, width: 20 }} /><span style={{ fontSize: 12 }}>{tr('رفض', 'Reject')}</span></CVisionButton>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                  <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setInterviewDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
                  <CVisionButton C={C} isDark={isDark} onClick={handleInterviewResult} disabled={savingInterview || !interviewData.decision}>{savingInterview && <RefreshCw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}{interviewData.decision === 'offer' ? tr('نقل إلى مرحلة العرض', 'Move to Offer Stage') : interviewData.decision === 'rejected' ? tr('رفض', 'Reject') : tr('حفظ النتيجة', 'Save Result')}</CVisionButton>
                </div>
              </>
            )}
          </div>
      </CVisionDialog>

      {/* Offer Dialog */}
      <CVisionDialog C={C} open={offerDialogOpen} onClose={() => setOfferDialogOpen(false)} title="Make Offer" isDark={isDark}><p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{tr(`إنشاء وإرسال عرض إلى ${selectedCandidate?.fullName}`, `Create and send offer to ${selectedCandidate?.fullName}`)}</p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 16, paddingBottom: 16 }}>
            {selectedCandidate && <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${C.border}` }}><p style={{ fontWeight: 600, fontSize: 16 }}>{selectedCandidate.fullName}</p><p style={{ fontSize: 13, color: C.textMuted }}>{selectedCandidate.jobTitleName || tr('بدون منصب', 'No position')}</p></div>}
            {/* Salary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <CVisionLabel C={C} style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><DollarSign style={{ height: 20, width: 20, color: C.green }} /> {tr('التعويضات', 'Compensation')}</CVisionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>{tr('الأساسي *', 'Basic *')}</CVisionLabel><CVisionInput C={C} type="number" placeholder="5000" value={offerData.basicSalary} onChange={(e) => setOfferData({ ...offerData, basicSalary: e.target.value })} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>{tr('السكن', 'Housing')}</CVisionLabel><CVisionInput C={C} type="number" placeholder="1500" value={offerData.housingAllowance} onChange={(e) => setOfferData({ ...offerData, housingAllowance: e.target.value })} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>{tr('النقل', 'Transport')}</CVisionLabel><CVisionInput C={C} type="number" placeholder="500" value={offerData.transportAllowance} onChange={(e) => setOfferData({ ...offerData, transportAllowance: e.target.value })} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>{tr('أخرى', 'Other')}</CVisionLabel><CVisionInput C={C} type="number" placeholder="0" value={offerData.otherAllowances} onChange={(e) => setOfferData({ ...offerData, otherAllowances: e.target.value })} /></div>
              </div>
              {offerData.basicSalary && <div style={{ padding: 12, background: C.greenDim, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 13 }}>{tr('الإجمالي الشهري:', 'Total Monthly:')}</span><span style={{ fontWeight: 700, color: C.green }}>{((parseFloat(offerData.basicSalary) || 0) + (parseFloat(offerData.housingAllowance) || 0) + (parseFloat(offerData.transportAllowance) || 0) + (parseFloat(offerData.otherAllowances) || 0)).toLocaleString()} {offerData.currency}</span></div>}
            </div>
            {/* Employment */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('تاريخ البدء *', 'Start Date *')}</CVisionLabel><CVisionInput C={C} type="date" value={offerData.startDate} onChange={(e) => setOfferData({ ...offerData, startDate: e.target.value })} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('نوع العقد', 'Contract Type')}</CVisionLabel><CVisionSelect C={C} value={offerData.contractType} onChange={(v) => setOfferData({ ...offerData, contractType: v })} options={[{ value: 'full_time', label: tr('دوام كامل', 'Full Time') }, { value: 'part_time', label: tr('دوام جزئي', 'Part Time') }, { value: 'contract', label: tr('عقد', 'Contract') }, { value: 'internship', label: tr('تدريب', 'Internship') }]} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('فترة التجربة (أيام)', 'Probation (days)')}</CVisionLabel><CVisionSelect C={C} value={offerData.probationPeriod} onChange={(v) => setOfferData({ ...offerData, probationPeriod: v })} options={[{ value: '0', label: tr('بدون فترة تجربة', 'No Probation') }, { value: '30', label: tr('30 يوم', '30 Days') }, { value: '60', label: tr('60 يوم', '60 Days') }, { value: '90', label: tr('90 يوم', '90 Days') }, { value: '180', label: tr('180 يوم', '180 Days') }]} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('انتهاء العرض', 'Offer Expires')}</CVisionLabel><CVisionInput C={C} type="date" value={offerData.expiryDate} onChange={(e) => setOfferData({ ...offerData, expiryDate: e.target.value })} /></div>
            </div>
            {/* Benefits */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C} style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><Gift style={{ height: 20, width: 20, color: C.purple }} /> {tr('المزايا', 'Benefits')}</CVisionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {['Health Insurance', 'Dental Insurance', 'Annual Leave 21 days', 'Annual Leave 30 days', 'End of Service Benefits', 'Annual Bonus', 'Flight Tickets', 'Company Car', 'Remote Work', 'Training Budget'].map((b) => {
                  const benefitLabels: Record<string, string> = { 'Health Insurance': tr('تأمين صحي', 'Health Insurance'), 'Dental Insurance': tr('تأمين أسنان', 'Dental Insurance'), 'Annual Leave 21 days': tr('إجازة سنوية 21 يوم', 'Annual Leave 21 days'), 'Annual Leave 30 days': tr('إجازة سنوية 30 يوم', 'Annual Leave 30 days'), 'End of Service Benefits': tr('مكافأة نهاية الخدمة', 'End of Service Benefits'), 'Annual Bonus': tr('مكافأة سنوية', 'Annual Bonus'), 'Flight Tickets': tr('تذاكر طيران', 'Flight Tickets'), 'Company Car': tr('سيارة الشركة', 'Company Car'), 'Remote Work': tr('عمل عن بعد', 'Remote Work'), 'Training Budget': tr('ميزانية التدريب', 'Training Budget') };
                  return (
                  <label key={b} className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${offerData.benefits.includes(b) ? 'bg-purple-50 border-purple-300' : 'hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={offerData.benefits.includes(b)} onChange={(e) => setOfferData({ ...offerData, benefits: e.target.checked ? [...offerData.benefits, b] : offerData.benefits.filter(x => x !== b) })} style={{ borderRadius: 6 }} />
                    <span style={{ fontSize: 13 }}>{benefitLabels[b] || b}</span>
                  </label>
                );})}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('ملاحظات', 'Notes')}</CVisionLabel><CVisionTextarea C={C} value={offerData.notes} onChange={(e) => setOfferData({ ...offerData, notes: e.target.value })} rows={2} /></div>
            {/* Offer workflow for existing offers */}
            {selectedCandidate?.status === 'offer' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                {/* Record response */}
                {(offerData.offerStatus === 'sent' || offerData.offerStatus === 'draft' || !offerData.offerStatus) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <CVisionLabel C={C} style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><Handshake style={{ height: 20, width: 20, color: C.green }} /> {tr('تسجيل الرد', 'Record Response')}</CVisionLabel>
                    <CVisionTextarea C={C} value={offerData.responseNotes} onChange={(e) => setOfferData({ ...offerData, responseNotes: e.target.value })} placeholder={tr('ملاحظات...', 'Notes...')} rows={2} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                      <CVisionButton C={C} isDark={isDark} type="button" style={{ height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, background: C.greenDim }} onClick={() => handleOfferResponse('accepted')} disabled={savingOffer}><Check style={{ height: 20, width: 20 }} /><span style={{ fontSize: 12 }}>{tr('مقبول', 'Accepted')}</span></CVisionButton>
                      <CVisionButton C={C} isDark={isDark} type="button" variant="outline" style={{ height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: C.orange }} onClick={() => handleOfferResponse('negotiating')} disabled={savingOffer}><MessageSquare style={{ height: 20, width: 20 }} /><span style={{ fontSize: 12 }}>{tr('تفاوض', 'Negotiating')}</span></CVisionButton>
                      <CVisionButton C={C} isDark={isDark} type="button" variant="outline" style={{ height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: C.red }} onClick={() => handleOfferResponse('rejected')} disabled={savingOffer}><XCircle style={{ height: 20, width: 20 }} /><span style={{ fontSize: 12 }}>{tr('مرفوض', 'Rejected')}</span></CVisionButton>
                    </div>
                  </div>
                )}
                {/* HR Approval */}
                {offerData.offerStatus === 'accepted_pending_approval' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ padding: 12, background: C.blueDim, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, color: C.blue }}><AlertCircle style={{ height: 20, width: 20 }} /><span style={{ fontWeight: 500 }}>{tr('المرشح قبل! في انتظار موافقة الموارد البشرية.', 'Candidate accepted! Awaiting HR approval.')}</span></div>
                    <CVisionTextarea C={C} value={offerData.responseNotes} onChange={(e) => setOfferData({ ...offerData, responseNotes: e.target.value })} placeholder={tr('ملاحظات الموافقة...', 'Approval notes...')} rows={2} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                      <CVisionButton C={C} isDark={isDark} type="button" style={{ height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, background: C.greenDim }} onClick={() => handleHRApproval(true)} disabled={savingOffer}><Check style={{ height: 20, width: 20 }} /><span style={{ fontSize: 12 }}>{tr('موافقة وتوظيف', 'Approve & Hire')}</span></CVisionButton>
                      <CVisionButton C={C} isDark={isDark} type="button" variant="outline" style={{ height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: C.red }} onClick={() => handleHRApproval(false)} disabled={savingOffer}><XCircle style={{ height: 20, width: 20 }} /><span style={{ fontSize: 12 }}>{tr('رفض', 'Reject')}</span></CVisionButton>
                    </div>
                  </div>
                )}
                {offerData.offerStatus === 'approved' && (
                  <div style={{ padding: 16, background: C.greenDim, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.green }}><CheckCircle style={{ height: 20, width: 20 }} /><span style={{ fontWeight: 500 }}>{tr('تمت الموافقة! جاهز للتوظيف.', 'Approved! Ready to hire.')}</span></div>
                    <CVisionButton C={C} isDark={isDark} onClick={() => { setOfferDialogOpen(false); openHireDialog(selectedCandidate!); }} style={{ background: C.greenDim }}><UserCheck style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('إتمام التوظيف', 'Complete Hiring')}</CVisionButton>
                  </div>
                )}
              </div>
            )}
            {/* Portal link */}
            {offerPortalUrl && <div style={{ padding: 12, background: C.blueDim, border: `1px solid ${C.border}`, borderRadius: 12 }}><CVisionLabel C={C} style={{ fontSize: 13, fontWeight: 600, color: C.blue }}>{tr('رابط بوابة العرض', 'Offer Portal Link')}</CVisionLabel><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}><CVisionInput C={C} value={offerPortalUrl} readOnly style={{ fontSize: 12 }} /><CVisionButton C={C} isDark={isDark} type="button" variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(offerPortalUrl); toast.success(tr('تم النسخ!', 'Copied!')); }}><Copy style={{ height: 16, width: 16 }} /></CVisionButton></div></div>}
            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setOfferDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
              {selectedCandidate?.status !== 'offer' && <CVisionButton C={C} isDark={isDark} onClick={handleSendOffer} disabled={savingOffer || !offerData.basicSalary || !offerData.startDate} style={{ background: C.orangeDim }}>{savingOffer && <RefreshCw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}<Send style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('إنشاء وإرسال العرض', 'Create & Send Offer')}</CVisionButton>}
            </div>
          </div>
      </CVisionDialog>

      {/* Hire Dialog */}
      <CVisionDialog C={C} open={hireDialogOpen} onClose={() => setHireDialogOpen(false)} title={tr('توظيف المرشح', 'Hire Candidate')} isDark={isDark}><p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{tr(`إتمام عملية التوظيف لـ ${selectedCandidate?.fullName}`, `Complete the hiring process for ${selectedCandidate?.fullName}`)}</p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16, paddingBottom: 16 }}>
            {selectedCandidate && <div style={{ padding: 12, background: C.bgSubtle, borderRadius: 12 }}><p style={{ fontWeight: 500 }}>{selectedCandidate.fullName}</p><p style={{ fontSize: 13, color: C.textMuted }}>{selectedCandidate.jobTitleName || tr('بدون منصب', 'No position')}</p></div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('تاريخ البدء *', 'Start Date *')}</CVisionLabel><CVisionInput C={C} type="date" value={hireData.startDate} onChange={(e) => setHireData({ ...hireData, startDate: e.target.value })} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('الأساسي *', 'Basic *')}</CVisionLabel><CVisionInput C={C} type="number" placeholder="5000" value={hireData.basicSalary} onChange={(e) => setHireData({ ...hireData, basicSalary: e.target.value })} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('السكن', 'Housing')}</CVisionLabel><CVisionInput C={C} type="number" placeholder="1500" value={hireData.housingAllowance} onChange={(e) => setHireData({ ...hireData, housingAllowance: e.target.value })} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('النقل', 'Transport')}</CVisionLabel><CVisionInput C={C} type="number" placeholder="500" value={hireData.transportAllowance} onChange={(e) => setHireData({ ...hireData, transportAllowance: e.target.value })} /></div>
            </div>
            {hireData.basicSalary && <div style={{ padding: 12, background: C.greenDim, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 13 }}>{tr('الإجمالي الشهري:', 'Total Monthly:')}</span><span style={{ fontWeight: 700, color: C.green }}>{((parseFloat(hireData.basicSalary) || 0) + (parseFloat(hireData.housingAllowance) || 0) + (parseFloat(hireData.transportAllowance) || 0)).toLocaleString()} SAR</span></div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16 }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setHireDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
              <CVisionButton C={C} isDark={isDark} onClick={handleHire} disabled={hiring || !hireData.basicSalary}>{hiring && <RefreshCw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}<UserCheck style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('تأكيد التوظيف', 'Confirm Hire')}</CVisionButton>
            </div>
          </div>
      </CVisionDialog>

      {/* AI Video Interview Dialog */}
      <CVisionDialog C={C} open={videoDialogOpen} onClose={() => setVideoDialogOpen(false)} title="Video Interview" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{selectedCandidate?.fullName} — {selectedCandidate?.jobTitleName || tr('مرشح', 'Candidate')}</p>
          {/* ── Flow Progress Indicator ── */}
          {!loadingVideoSessions && videoSessions.length > 0 && !selectedVideoSession && (() => {
            const latest = videoSessions[0];
            const isWaiting = latest?.status === 'PENDING' || latest?.status === 'SENT';
            const isInProgress = latest?.status === 'IN_PROGRESS';
            const isDone = latest?.status === 'COMPLETED' || latest?.status === 'SCORED';
            const stepNum = isDone ? 3 : isInProgress ? 2 : isWaiting ? 1 : 0;
            return (
              <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 4, paddingRight: 4 }}>
                {[
                  { label: tr('تم إرسال الدعوة', 'Invite Sent'), icon: Send },
                  { label: tr('مقابلة المرشح', 'Candidate Interview'), icon: Video },
                  { label: tr('مراجعة واتخاذ قرار', 'Review & Decide'), icon: CheckCircle },
                ].map((step, idx) => (
                  <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                      idx < stepNum ? 'bg-green-100 text-green-700' :
                      idx === stepNum ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {idx < stepNum ? <Check style={{ height: 12, width: 12 }} /> : <step.icon style={{ height: 12, width: 12 }} />}
                      {step.label}
                    </div>
                    {idx < 2 && <ArrowRight className={`h-3.5 w-3.5 mx-1 shrink-0 ${idx < stepNum ? 'text-green-400' : 'text-gray-300'}`} />}
                  </div>
                ))}
              </div>
            );
          })()}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8 }}>
            {loadingVideoSessions ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 32, paddingBottom: 32, color: C.textMuted }}><RefreshCw style={{ height: 16, width: 16, animation: 'spin 1s linear infinite' }} /> {tr('جاري تحميل الجلسات...', 'Loading sessions...')}</div>
            ) : videoSessions.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32 }}>
                <Video style={{ height: 40, width: 40, marginBottom: 12 }} />
                <p style={{ fontSize: 13, fontWeight: 500 }}>{tr('لا توجد جلسات مقابلة مرئية بعد', 'No video interview sessions yet')}</p>
                <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{tr('أرسل دعوة مقابلة مرئية بالذكاء الاصطناعي للمرشح', 'Send an AI video interview invite to the candidate')}</p>
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setVideoInterviewLang('en')}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${videoInterviewLang === 'en' ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'}`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoInterviewLang('ar')}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${videoInterviewLang === 'ar' ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'}`}
                    >
                      العربية
                    </button>
                  </div>
                </div>
                <CVisionButton C={C} isDark={isDark}
                  style={{ marginTop: 12, background: C.blueDim }}
                  onClick={sendVideoInterviewInvite}
                  disabled={sendingVideoInvite}
                >
                  {sendingVideoInvite ? <RefreshCw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} /> : <Send style={{ height: 16, width: 16, marginRight: 8 }} />}
                  {tr('إرسال مقابلة مرئية', 'Send Video Interview')}
                </CVisionButton>
              </div>
            ) : selectedVideoSession ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => setSelectedVideoSession(null)} style={{ color: C.textMuted }}><ArrowLeft style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('العودة إلى الجلسات', 'Back to sessions')}</CVisionButton>
                {selectedVideoSession.videoReport ? (
                  <>
                    <VideoInterviewReport
                      report={selectedVideoSession.videoReport}
                      results={selectedVideoSession.videoResults}
                      questions={selectedVideoSession.questions}
                    />
                    {/* Next Step after viewing results */}
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                      <div style={{ paddingLeft: 4, paddingRight: 4, marginBottom: 8 }}>
                        <p style={{ fontWeight: 600, color: C.textMuted, textTransform: 'uppercase' }}>{tr('الخطوة التالية', 'Next Step')}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <CVisionButton C={C} isDark={isDark}
                          style={{ flex: 1, background: C.greenDim }}
                          onClick={() => {
                            setVideoDialogOpen(false);
                            if (selectedCandidate) {
                              setImCandidate(selectedCandidate);
                              setImMode('decision');
                              setImOpen(true);
                            }
                          }}
                        >
                          <CheckCircle style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('تقييم واتخاذ قرار', 'Evaluate & Decide')}
                        </CVisionButton>
                        <CVisionButton C={C} isDark={isDark}
                          variant="outline"
                          style={{ color: C.red }}
                          onClick={() => {
                            if (selectedCandidate) {
                              updateStatus(selectedCandidate.id, 'rejected');
                              setVideoDialogOpen(false);
                            }
                          }}
                        >
                          <XCircle style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('رفض', 'Reject')}
                        </CVisionButton>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32, color: C.textMuted }}>
                    <Clock style={{ height: 32, width: 32, marginBottom: 8, opacity: 0.5 }} />
                    <p style={{ fontSize: 13, fontWeight: 500 }}>{tr('لم تكتمل المقابلة بعد', 'Interview not yet completed')}</p>
                    <p style={{ fontSize: 12, marginTop: 4 }}>{tr('لم ينهِ المرشح المقابلة بعد', "The candidate hasn't finished the interview yet")}</p>
                    {selectedVideoSession.inviteLink && (
                      <div style={{ marginTop: 12, padding: 12, background: C.bgSubtle, borderRadius: 12, textAlign: 'left' }}>
                        <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>{tr('شارك رابط الدعوة مع المرشح:', 'Share invite link with the candidate:')}</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <CVisionInput C={C} value={`${typeof window !== 'undefined' ? window.location.origin : ''}${selectedVideoSession.inviteLink}`} readOnly style={{ fontSize: 12 }} />
                          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}${selectedVideoSession.inviteLink}`);
                            toast.success(tr('تم النسخ!', 'Copied!'));
                          }}><Copy style={{ height: 14, width: 14 }} /></CVisionButton>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {videoSessions.map((session: any) => {
                  const statusMap: Record<string, { label: string; cls: string; hint: string }> = {
                    PENDING: { label: tr('معلق', 'Pending'), cls: 'bg-gray-100 text-gray-700', hint: tr('في الانتظار — لم يتم فتح الدعوة بعد', 'Waiting — invite not yet opened') },
                    SENT: { label: tr('تم الإرسال', 'Sent'), cls: 'bg-blue-100 text-blue-700', hint: tr('في انتظار إكمال المرشح للمقابلة', 'Waiting for candidate to complete the interview') },
                    IN_PROGRESS: { label: tr('قيد التنفيذ', 'In Progress'), cls: 'bg-yellow-100 text-yellow-700', hint: tr('المرشح يجري المقابلة حالياً — يتم التحديث تلقائياً...', 'Candidate is currently taking the interview — auto-refreshing...') },
                    COMPLETED: { label: tr('مكتمل', 'Completed'), cls: 'bg-green-100 text-green-700', hint: tr('جاهز لمراجعة النتائج', 'Ready to review results') },
                    SCORED: { label: tr('تم التقييم', 'Scored'), cls: 'bg-emerald-100 text-emerald-700', hint: tr('النتائج جاهزة — راجع واتخذ قراراً', 'Results ready — review and decide') },
                    EXPIRED: { label: tr('منتهي', 'Expired'), cls: 'bg-red-100 text-red-700', hint: tr('انتهت المقابلة — أرسل واحدة جديدة', 'Interview expired — send a new one') },
                    CANCELLED: { label: tr('ملغي', 'Cancelled'), cls: 'bg-red-100 text-red-700', hint: tr('تم إلغاء المقابلة', 'Interview was cancelled') },
                  };
                  const st = statusMap[session.status] || statusMap.PENDING;
                  const isCompleted = session.status === 'COMPLETED' || session.status === 'SCORED';
                  const isWaiting = session.status === 'PENDING' || session.status === 'SENT';
                  return (
                    <div key={session.id} className={`p-3 border rounded-lg transition ${isCompleted ? 'border-green-300 bg-green-50/30' : ''}`}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 500 }}>{session.jobTitle}</p>
                          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                            {session.questions?.length || 0} {tr('أسئلة', 'questions')} &middot; {new Date(session.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {session.videoReport && (
                            <span className={`text-sm font-bold ${(session.videoReport.scores?.overall || 0) >= 65 ? 'text-green-600' : (session.videoReport.scores?.overall || 0) >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                              {session.videoReport.scores?.overall || 0}/100
                            </span>
                          )}
                          <CVisionBadge C={C} className={`text-xs ${st.cls}`}>{st.label}</CVisionBadge>
                        </div>
                      </div>

                      {/* Status hint message */}
                      <p style={{ color: C.textMuted, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isWaiting && <Clock style={{ height: 12, width: 12 }} />}
                        {session.status === 'IN_PROGRESS' && <RefreshCw style={{ height: 12, width: 12, animation: 'spin 1s linear infinite' }} />}
                        {isCompleted && <CheckCircle style={{ height: 12, width: 12, color: C.green }} />}
                        {st.hint}
                      </p>

                      {/* Invite link for pending/sent sessions */}
                      {isWaiting && session.inviteLink && (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CVisionInput C={C} value={`${typeof window !== 'undefined' ? window.location.origin : ''}${session.inviteLink}`} readOnly style={{ fontSize: 12, height: 28 }} />
                          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ height: 28, paddingLeft: 8, paddingRight: 8 }} onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}${session.inviteLink}`);
                            toast.success(tr('تم النسخ!', 'Copied!'));
                          }}><Copy style={{ height: 12, width: 12 }} /></CVisionButton>
                        </div>
                      )}

                      {/* Action buttons based on status */}
                      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                        {isCompleted && (
                          <>
                            <CVisionButton C={C} isDark={isDark} size="sm" style={{ flex: 1, background: C.greenDim, height: 32, fontSize: 12 }}
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/cvision/ai/chatbot?action=session-detail&sessionId=${session.id}`, { credentials: 'include' });
                                  const data = await res.json();
                                  setSelectedVideoSession(data.data || session);
                                } catch { setSelectedVideoSession(session); }
                              }}>
                              <Eye style={{ height: 14, width: 14, marginRight: 4 }} /> {tr('عرض النتائج واتخاذ قرار', 'View Results & Decide')}
                            </CVisionButton>
                          </>
                        )}
                        {isWaiting && (
                          <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ height: 32, fontSize: 12, color: C.blue }}
                            onClick={() => {
                              sendVideoInterviewInvite();
                            }}>
                            <Send style={{ height: 14, width: 14, marginRight: 4 }} /> {tr('إعادة إرسال الدعوة', 'Resend Invite')}
                          </CVisionButton>
                        )}
                        {session.status === 'IN_PROGRESS' && (
                          <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ height: 32, fontSize: 12 }}
                            onClick={async () => {
                              if (!selectedCandidate) return;
                              try {
                                const res = await fetch(`/api/cvision/ai/chatbot?action=sessions&candidateId=${selectedCandidate.id}`, { credentials: 'include' });
                                const data = await res.json();
                                setVideoSessions((data.data?.items || data.data || []).filter((s: any) => s.candidateId === selectedCandidate.id));
                                toast.success(tr('تم تحديث الحالة', 'Status refreshed'));
                              } catch { toast.error(tr('فشل في التحديث', 'Failed to refresh')); }
                            }}>
                            <RefreshCw style={{ height: 14, width: 14, marginRight: 4 }} /> {tr('تحديث الحالة', 'Refresh Status')}
                          </CVisionButton>
                        )}
                        {(session.status === 'EXPIRED' || session.status === 'CANCELLED') && (
                          <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ height: 32, fontSize: 12, color: C.blue }}
                            onClick={sendVideoInterviewInvite}>
                            <Video style={{ height: 14, width: 14, marginRight: 4 }} /> {tr('إرسال مقابلة جديدة', 'Send New Interview')}
                          </CVisionButton>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Next Step guidance at bottom */}
                {(() => {
                  const latest = videoSessions[0];
                  const isCompleted = latest?.status === 'COMPLETED' || latest?.status === 'SCORED';
                  const isWaiting = latest?.status === 'PENDING' || latest?.status === 'SENT';
                  if (isCompleted) return (
                    <div style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, background: C.greenDim, border: `1px solid ${C.border}`, borderRadius: 12 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.green, textTransform: 'uppercase', marginBottom: 8 }}>{tr('الخطوة التالية', 'Next Step')}</p>
                      <p style={{ fontSize: 12, color: C.green, marginBottom: 12 }}>{tr('راجع نتائج المقابلة أعلاه، ثم قيّم واتخذ قرار التوظيف.', 'Review the interview results above, then evaluate and make a hiring decision.')}</p>
                      <CVisionButton C={C} isDark={isDark}
                        style={{ width: '100%', background: C.greenDim }}
                        onClick={() => {
                          setVideoDialogOpen(false);
                          if (selectedCandidate) {
                            setImCandidate(selectedCandidate);
                            setImMode('decision');
                            setImOpen(true);
                          }
                        }}
                      >
                        <CheckCircle style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('تقييم واتخاذ قرار', 'Evaluate & Decide')}
                      </CVisionButton>
                    </div>
                  );
                  if (latest?.status === 'IN_PROGRESS') return (
                    <div style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, background: C.orangeDim, border: `1px solid ${C.border}`, borderRadius: 12 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.orange, textTransform: 'uppercase', marginBottom: 4 }}>{tr('المقابلة قيد التنفيذ', 'Interview In Progress')}</p>
                      <p style={{ fontSize: 12, color: C.orange }}>{tr('المرشح يكمل المقابلة المرئية حالياً. ستتحدث هذه الصفحة تلقائياً عند الانتهاء.', 'The candidate is currently completing the video interview. This page will automatically update when they finish.')}</p>
                    </div>
                  );
                  if (isWaiting) return (
                    <div style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, background: C.blueDim, border: `1px solid ${C.border}`, borderRadius: 12 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.blue, textTransform: 'uppercase', marginBottom: 4 }}>{tr('ماذا سيحدث بعد ذلك؟', 'What Happens Next?')}</p>
                      <p style={{ fontSize: 12, color: C.blue }}>{tr('سيتلقى المرشح رابط الدعوة ويكمل المقابلة المرئية بالذكاء الاصطناعي. بعد الانتهاء، ستتمكن من مراجعة النتائج واتخاذ قرار هنا.', "The candidate will receive the invite link and complete the AI video interview. Once done, you'll be able to review results and make a decision here.")}</p>
                    </div>
                  );
                  return null;
                })()}

                {/* Send new video interview button with language selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
                    <button type="button" onClick={() => setVideoInterviewLang('en')}
                      className={`px-2 py-1.5 text-[11px] font-medium transition-colors ${videoInterviewLang === 'en' ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'}`}>
                      EN
                    </button>
                    <button type="button" onClick={() => setVideoInterviewLang('ar')}
                      className={`px-2 py-1.5 text-[11px] font-medium transition-colors ${videoInterviewLang === 'ar' ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'}`}>
                      AR
                    </button>
                  </div>
                  <CVisionButton C={C} isDark={isDark}
                    variant="outline"
                    style={{ flex: 1 }}
                    onClick={sendVideoInterviewInvite}
                    disabled={sendingVideoInvite}
                  >
                    {sendingVideoInvite ? <RefreshCw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} /> : <Video style={{ height: 16, width: 16, marginRight: 8 }} />}
                    {tr('إرسال مقابلة مرئية جديدة', 'Send New Video Interview')}
                  </CVisionButton>
                </div>
              </div>
            )}
          </div>
      </CVisionDialog>

      {/* Interview Manager */}
      <InterviewManager
        candidate={imCandidate}
        open={imOpen}
        onOpenChange={setImOpen}
        mode={imMode}
        defaultType={imDefaultType}
        onDone={loadCandidates}
        onVideoSessionCreated={(c) => {
          // Refresh candidate list since status may have changed
          loadCandidates();
        }}
      />
    </div>
  );
}

// Actions menu component
function CandidateActionsMenu({
  candidate, onStatusChange, onHire, onScreen, onInterview, onOffer, onMatch,
  onScheduleInterview, onViewInterviews, onSubmitFeedback, onInterviewDecision,
  onVideoInterview,
  compact = false,
}: {
  candidate: Candidate; onStatusChange: (id: string, status: string) => void;
  onHire: (c: Candidate) => void; onScreen: (c: Candidate) => void;
  onInterview: (c: Candidate, mode: 'schedule' | 'result') => void;
  onOffer: (c: Candidate) => void; onMatch?: (id: string) => void;
  onScheduleInterview?: (c: Candidate) => void;
  onViewInterviews?: (c: Candidate) => void;
  onSubmitFeedback?: (c: Candidate) => void;
  onInterviewDecision?: (c: Candidate) => void;
  onVideoInterview?: (c: Candidate) => void;
  compact?: boolean;
}) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  if (candidate.status === 'hired' || candidate.status === 'rejected') return null;

  const s = candidate.status;
  const isNew = s === 'applied' || s === 'new' || s === 'screening';
  const isShortlisted = s === 'shortlisted';
  const isInterview = s === 'interview';
  const isOffer = s === 'offer';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <CVisionButton C={C} isDark={isDark} variant="ghost" size={compact ? "icon" : "sm"} className={compact ? "h-6 w-6" : ""}><MoreHorizontal style={{ height: 16, width: 16 }} /></CVisionButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" style={{ width: 208 }}>

        {/* ── Step 1: New → Shortlist ── */}
        {isNew && (<>
          <div style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase' }}>{tr('الخطوة التالية', 'Next Step')}</div>
          <DropdownMenuItem onClick={() => onStatusChange(candidate.id, 'shortlisted')} style={{ fontWeight: 500 }}>
            <ThumbsUp style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('القائمة المختصرة', 'Shortlist')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {onVideoInterview && (
            <DropdownMenuItem onClick={() => onVideoInterview(candidate)} style={{ color: C.blue }}>
              <Video style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('إرسال مقابلة فيديو', 'Send Video Interview')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onScreen(candidate)} style={{ color: C.purple }}>
            <FileText style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('فرز وتقييم', 'Screen & Score')}
          </DropdownMenuItem>
        </>)}

        {/* ── Step 2: Shortlisted → Send Video Interview ── */}
        {isShortlisted && (<>
          <div style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase' }}>{tr('الخطوة التالية', 'Next Step')}</div>
          {onVideoInterview && (
            <DropdownMenuItem onClick={() => onVideoInterview(candidate)} style={{ color: C.blue, fontWeight: 500 }}>
              <Video style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('إرسال مقابلة فيديو', 'Send Video Interview')}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {onScheduleInterview && (
            <DropdownMenuItem onClick={() => onScheduleInterview(candidate)} style={{ color: C.blue }}>
              <Calendar style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('جدولة مقابلة', 'Schedule Interview')}
            </DropdownMenuItem>
          )}
        </>)}

        {/* ── Step 3: Interview → Evaluate & Decide ── */}
        {isInterview && (<>
          <div style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase' }}>{tr('الخطوة التالية', 'Next Step')}</div>
          {onInterviewDecision && (
            <DropdownMenuItem onClick={() => onInterviewDecision(candidate)} style={{ color: C.green, fontWeight: 500 }}>
              <CheckCircle style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('تقييم واتخاذ قرار', 'Evaluate & Decide')}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {onVideoInterview && (
            <DropdownMenuItem onClick={() => onVideoInterview(candidate)} style={{ color: C.blue }}>
              <Video style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('نتائج مقابلة الفيديو', 'Video Interview Results')}
            </DropdownMenuItem>
          )}
          {onViewInterviews && (
            <DropdownMenuItem onClick={() => onViewInterviews(candidate)} style={{ color: C.blue }}>
              <Eye style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('عرض المقابلات', 'View Interviews')}
            </DropdownMenuItem>
          )}
        </>)}

        {/* ── Step 4: Offer → Create & Send Offer ── */}
        {isOffer && (<>
          <div style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase' }}>{tr('الخطوة التالية', 'Next Step')}</div>
          <DropdownMenuItem onClick={() => onOffer(candidate)} style={{ color: C.orange, fontWeight: 500 }}>
            <FileSignature style={{ height: 16, width: 16, marginRight: 8 }} /> {candidate.offer ? tr('إدارة العرض', 'Manage Offer') : tr('إنشاء وإرسال عرض', 'Create & Send Offer')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onHire(candidate)} style={{ color: C.green }}>
            <UserCheck style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('توظيف الآن', 'Hire Now')}
          </DropdownMenuItem>
        </>)}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onStatusChange(candidate.id, 'rejected')} style={{ color: C.red }}>
          <XCircle style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('رفض', 'Reject')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
