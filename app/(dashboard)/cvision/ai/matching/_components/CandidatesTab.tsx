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

  // Screening dialog
  const [screenDialogOpen, setScreenDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [screening, setScreening] = useState(false);
  const [screenData, setScreenData] = useState({ screeningScore: 5, notes: '', decision: '' as string });

  // Interview dialog
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

  // Notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => { const ac = new AbortController(); loadAll(ac.signal); loadNotifications(ac.signal); return () => ac.abort(); }, []);
  useEffect(() => { if (newCandidate.departmentId) loadJobTitles(newCandidate.departmentId); }, [newCandidate.departmentId]);

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
      toast.error(tr('فشل التحليل', 'Failed to analyze CV'));
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
        toast.success(`${data.candidate?.fullName} added successfully`);
        setAddDialogOpen(false);
        setCvFile(null); setCvAnalysis(null); setPositionMatches([]);
        setNewCandidate({ fullName: '', email: '', phone: '', departmentId: '', jobTitleId: '', source: 'DIRECT', notes: '' });
        await loadCandidates();
      } else { toast.error(data.error || 'Failed to add candidate'); }
    } catch (error) { toast.error('Failed to add candidate'); } finally { setSaving(false); }
  }

  // Update status
  async function updateStatus(candidateId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/cvision/recruitment/candidates/${candidateId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) { toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`); await loadCandidates(); }
      else toast.error(data.error || 'Failed to update status');
    } catch (error) { toast.error(tr('فشل التحديث', 'Failed to update status')); }
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
    if (!selectedCandidate || !screenData.decision) { toast.error('Please select a decision'); return; }
    try {
      setScreening(true);
      if (screenData.decision === 'interview') {
        const res = await fetch(`/api/cvision/recruitment/candidates/${selectedCandidate.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ status: 'interview', notes: screenData.notes }),
        });
        const data = await res.json();
        if (data.success) { toast.success(`${selectedCandidate.fullName} moved to Interview`); setScreenDialogOpen(false); await loadCandidates(); }
        else toast.error(data.error || 'Failed to update candidate');
      } else {
        const res = await fetch(`/api/cvision/recruitment/candidates/${selectedCandidate.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ action: 'screen', screeningScore: screenData.screeningScore * 10, notes: screenData.notes, decision: screenData.decision }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success(screenData.decision === 'shortlisted' ? `${selectedCandidate.fullName} shortlisted!` : `${selectedCandidate.fullName} rejected`);
          setScreenDialogOpen(false); await loadCandidates();
        } else toast.error(data.error || 'Failed to screen candidate');
      }
    } catch (error) { toast.error('Failed to screen candidate'); } finally { setScreening(false); }
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
      toast.error('Please select date and time'); return;
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
        toast.success(`Interview Round ${data.interview.roundNumber} scheduled`);
        setInterviewDialogOpen(false); await loadCandidates();
      } else toast.error(data.error || 'Failed to schedule interview');
    } catch (error) { toast.error('Failed to schedule interview'); } finally { setSavingInterview(false); }
  }

  async function handleInterviewResult() {
    if (!selectedCandidate || !interviewData.decision) { toast.error('Please select a decision'); return; }
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
          toast.success(interviewData.decision === 'offer' ? `${selectedCandidate.fullName} moved to Offer!` : 'Interview result recorded');
          setInterviewDialogOpen(false); await loadCandidates();
        } else toast.error(data.error || 'Failed to save result');
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
        if (data.success) { toast.success('Interview result recorded'); setInterviewDialogOpen(false); await loadCandidates(); }
        else toast.error(data.error || 'Failed to save result');
      }
    } catch (error) { toast.error(tr('فشل الحفظ', 'Failed to save result')); } finally { setSavingInterview(false); }
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
      toast.error('Please enter salary and start date'); return;
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
        toast.success(`Offer sent to ${selectedCandidate.fullName}!`);
        if (data.portalUrl) setOfferPortalUrl(data.portalUrl);
        setOfferDialogOpen(false); await loadCandidates();
      } else toast.error(data.error || 'Failed to send offer');
    } catch (error) { toast.error(tr('فشل الإرسال', 'Failed to send offer')); } finally { setSavingOffer(false); }
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
        toast.success(response === 'accepted' ? `${selectedCandidate.fullName} accepted!` : response === 'rejected' ? 'Offer rejected' : 'Negotiation started');
        setOfferDialogOpen(false); await loadCandidates();
      } else toast.error(data.error || 'Failed to process response');
    } catch (error) { toast.error('Failed to process response'); } finally { setSavingOffer(false); }
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
          toast.success(`Offer approved! Ready to hire ${selectedCandidate.fullName}`);
          setOfferDialogOpen(false);
          const offer = data.offer;
          setHireData({
            startDate: offer?.startDate || offerData.startDate || new Date().toISOString().split('T')[0],
            basicSalary: (offer?.basicSalary || parseFloat(offerData.basicSalary) || 0).toString(),
            housingAllowance: (offer?.housingAllowance || 0).toString(), transportAllowance: (offer?.transportAllowance || 0).toString(),
          });
          setHireDialogOpen(true);
        } else { toast.info('Offer approval rejected'); setOfferDialogOpen(false); }
        await loadCandidates();
      } else toast.error(data.error || 'Failed to process approval');
    } catch (error) { toast.error('Failed to process approval'); } finally { setSavingOffer(false); }
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
    if (!selectedCandidate || !hireData.basicSalary) { toast.error('Please enter basic salary'); return; }
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
      if (data.success) { toast.success(`${selectedCandidate.fullName} hired successfully!`); setHireDialogOpen(false); await loadCandidates(); }
      else toast.error(data.error || 'Failed to hire');
    } catch (error) { toast.error(tr('فشل التوظيف', 'Failed to hire')); } finally { setHiring(false); }
  }

  // Seed candidate
  async function seedCandidate() {
    try {
      const res = await fetch('/api/cvision/recruitment/seed-candidate', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (data.success) { toast.success('Seed candidate created'); await loadCandidates(); }
      else toast.error(data.error || 'Failed to seed');
    } catch (error) { toast.error('Failed to seed'); }
  }

  // Candidate detail
  async function openCandidateDetail(candidate: Candidate) {
    setDetailCandidate(candidate);
    setDetailOpen(true);
    setLoadingDocuments(true);
    try {
      const res = await fetch(`/api/cvision/recruitment/candidates/${candidate.id}/documents`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setCandidateDocuments(data.documents || []);
    } catch (error) { console.error('Failed to load documents:', error); } finally { setLoadingDocuments(false); }
  }

  // Filter
  const filteredCandidates = candidates.filter(c => {
    const matchesSearch = !searchQuery || c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || c.email?.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone?.includes(searchQuery);
    const matchesDepartment = !filterDepartment || c.departmentId === filterDepartment;
    const matchesStatus = !filterStatus || c.status === filterStatus;
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const hiredCandidates = filteredCandidates.filter(c => c.status === 'hired');
  const pipelineCandidates = {
    applied: filteredCandidates.filter(c => c.status === 'applied' || c.status === 'new'),
    screening: filteredCandidates.filter(c => c.status === 'screening' || c.status === 'shortlisted'),
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
        <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 16 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ padding: 8, background: C.blueDim, borderRadius: 12 }}><Users style={{ height: 16, width: 16, color: C.blue }} /></div><div><p style={{ fontSize: 12, color: C.textMuted }}>Total</p><p style={{ fontSize: 18, fontWeight: 700 }}>{stats.total}</p></div></div></CVisionCardBody></CVisionCard>
        <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 16 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ padding: 8, background: C.orangeDim, borderRadius: 12 }}><Clock style={{ height: 16, width: 16, color: C.orange }} /></div><div><p style={{ fontSize: 12, color: C.textMuted }}>In Pipeline</p><p style={{ fontSize: 18, fontWeight: 700, color: C.orange }}>{stats.inPipeline}</p></div></div></CVisionCardBody></CVisionCard>
        <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 16 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ padding: 8, background: C.greenDim, borderRadius: 12 }}><UserCheck style={{ height: 16, width: 16, color: C.green }} /></div><div><p style={{ fontSize: 12, color: C.textMuted }}>Hired</p><p style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{stats.hired}</p></div></div></CVisionCardBody></CVisionCard>
        <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 16 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ padding: 8, background: C.purpleDim, borderRadius: 12 }}><Calendar style={{ height: 16, width: 16, color: C.purple }} /></div><div><p style={{ fontSize: 12, color: C.textMuted }}>This Month</p><p style={{ fontSize: 18, fontWeight: 700, color: C.purple }}>{stats.thisMonth}</p></div></div></CVisionCardBody></CVisionCard>
      </div>

      {/* Filters */}
      <CVisionCard C={C}>
        <CVisionCardBody style={{ paddingTop: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
                <CVisionInput C={C} placeholder="Search by name, email, phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ paddingLeft: 36 }} />
              </div>
            </div>
            <CVisionSelect
                C={C}
                value={filterDepartment || 'all'}
                placeholder="Department"
                options={[
                  { value: 'all', label: tr('كل الأقسام', 'All Departments') },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
            <CVisionSelect
                C={C}
                value={filterStatus || 'all'}
                placeholder="Status"
                options={[
                  { value: 'all', label: 'All Status' },
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
                  {v === 'all' ? `All (${filteredCandidates.length})` : v === 'pipeline' ? 'Pipeline' : `Hired (${hiredCandidates.length})`}
                </button>
              ))}
            </div>
            <CVisionButton C={C} isDark={isDark} variant="outline" size="icon" onClick={() => loadCandidates()}><RefreshCw style={{ height: 16, width: 16 }} /></CVisionButton>
            {isDev && <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={seedCandidate}><Sparkles style={{ height: 16, width: 16, marginRight: 4 }} /> Seed</CVisionButton>}
            <CVisionButton C={C} isDark={isDark} onClick={() => setAddDialogOpen(true)}><UserPlus style={{ height: 16, width: 16, marginRight: 8 }} /> Add Candidate</CVisionButton>
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
                  <CVisionTh C={C}>Contact</CVisionTh>
                  <CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الوظيفة', 'Position')}</CVisionTh>
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
                      <CVisionTd><CVisionBadge C={C} className={STATUS_CONFIG[candidate.status]?.color}>{STATUS_CONFIG[candidate.status]?.label || candidate.status}</CVisionBadge></CVisionTd>
                      <CVisionTd style={{ fontSize: 13 }}>{new Date(candidate.createdAt).toLocaleDateString()}</CVisionTd>
                      <CVisionTd>
                        <div onClick={(e) => e.stopPropagation()}>
                          <CandidateActionsMenu candidate={candidate} onStatusChange={updateStatus} onHire={openHireDialog} onScreen={openScreenDialog} onInterview={openInterviewDialog} onOffer={openOfferDialog} onMatch={onRunMatching} />
                        </div>
                      </CVisionTd>
                    </CVisionTr>
                  ))
                )}
              </CVisionTableBody>
            </CVisionTable>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Pipeline View */}
      {activeView === 'pipeline' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
          {Object.entries(pipelineCandidates).map(([status, list]) => {
            const config = STATUS_CONFIG[status];
            return (
              <CVisionCard C={C} key={status}>
                <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {config?.label || status}
                    <CVisionBadge C={C} variant="secondary" className="ml-auto">{list.length}</CVisionBadge>
                  </div>
                </CVisionCardHeader>
                <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                  {list.length === 0 ? (
                    <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', paddingTop: 16, paddingBottom: 16 }}>No candidates</p>
                  ) : (
                    list.map((c) => (
                      <div key={c.id} style={{ padding: 12, border: `1px solid ${C.border}`, borderRadius: 12, cursor: 'pointer' }} onClick={() => openCandidateDetail(c)}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.fullName}</p>
                            {c.jobTitleName && <p style={{ fontSize: 12, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.jobTitleName}</p>}
                          </div>
                          <div onClick={(e) => e.stopPropagation()}>
                            <CandidateActionsMenu candidate={c} onStatusChange={updateStatus} onHire={openHireDialog} onScreen={openScreenDialog} onInterview={openInterviewDialog} onOffer={openOfferDialog} onMatch={onRunMatching} compact />
                          </div>
                        </div>
                        {c.screeningScore != null && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 12, color: C.orange }}>
                            <Star style={{ height: 12, width: 12 }} />{Math.round(c.screeningScore / 10)}/10
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </CVisionCardBody>
              </CVisionCard>
            );
          })}
        </div>
      )}

      {/* Hired View */}
      {activeView === 'hired' && (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 16 }}>
            {hiredCandidates.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: 48, paddingBottom: 48 }}><UserCheck style={{ height: 48, width: 48, color: C.textMuted, marginBottom: 16 }} /><p style={{ color: C.textMuted }}>No hired candidates yet</p></div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
                {hiredCandidates.map((c) => (
                  <CVisionCard C={C} key={c.id} style={{ background: C.greenDim }}>
                    <CVisionCardBody style={{ paddingTop: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><div><p style={{ fontWeight: 500 }}>{c.fullName}</p><p style={{ fontSize: 13, color: C.textMuted }}>{c.jobTitleName}</p><p style={{ fontSize: 12, color: C.textMuted }}>{c.departmentName}</p></div><CVisionBadge C={C} style={{ background: C.greenDim }}>Hired</CVisionBadge></div>
                      {c.employeeId && <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ width: '100%', marginTop: 12 }} onClick={() => router.push(`/cvision/employees/${c.employeeId}`)}>View Employee Profile</CVisionButton>}
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
      <CVisionDialog C={C} open={addDialogOpen} onClose={() => setAddDialogOpen(false)} title={tr('إضافة مرشح', 'Add Candidate')} isDark={isDark}><p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Enter candidate information to start the hiring process.</p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16, paddingBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Full Name *</CVisionLabel><CVisionInput C={C} value={newCandidate.fullName} onChange={(e) => setNewCandidate({ ...newCandidate, fullName: e.target.value })} placeholder="Enter full name" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('البريد الإلكتروني', 'Email')}</CVisionLabel><CVisionInput C={C} type="email" value={newCandidate.email} onChange={(e) => setNewCandidate({ ...newCandidate, email: e.target.value })} placeholder="email@example.com" /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('الهاتف', 'Phone')}</CVisionLabel><CVisionInput C={C} value={newCandidate.phone} onChange={(e) => setNewCandidate({ ...newCandidate, phone: e.target.value })} placeholder="+966..." /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('القسم', 'Department')}</CVisionLabel>
                <CVisionSelect
                C={C}
                value={newCandidate.departmentId || 'none'}
                placeholder="Select"
                options={[
                  { value: 'none', label: 'Select...' },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Position</CVisionLabel>
                <CVisionSelect
                C={C}
                value={newCandidate.jobTitleId || 'none'}
                placeholder="Select"
                options={[
                  { value: 'none', label: 'Select...' },
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
                  { value: 'DIRECT', label: 'Direct Application' },
                  { value: 'REFERRAL', label: 'Referral' },
                  { value: 'AGENCY', label: 'Agency' },
                  { value: 'LINKEDIN', label: 'LinkedIn' },
                  { value: 'OTHER', label: 'Other' },
                ]}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('ملاحظات', 'Notes')}</CVisionLabel><CVisionInput C={C} value={newCandidate.notes} onChange={(e) => setNewCandidate({ ...newCandidate, notes: e.target.value })} placeholder="Any additional notes..." /></div>
            {/* CV Upload */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FileText style={{ height: 16, width: 16 }} /> Upload CV (PDF/DOCX) - Auto-fills form!</CVisionLabel>
              <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${cvAnalyzing ? 'border-blue-400 bg-blue-50' : ''}`}>
                {cvAnalyzing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingTop: 8, paddingBottom: 8 }}><RefreshCw style={{ height: 32, width: 32, animation: 'spin 1s linear infinite', color: C.blue }} /><span style={{ fontSize: 13, color: C.blue, fontWeight: 500 }}>Analyzing CV with AI...</span></div>
                ) : cvFile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>{cvFile.name}</span><CVisionButton C={C} isDark={isDark} type="button" variant="ghost" size="sm" onClick={() => { setCvFile(null); setCvAnalysis(null); setPositionMatches([]); }}><XCircle style={{ height: 16, width: 16, color: C.red }} /></CVisionButton></div>
                    {cvAnalysis && (
                      <div style={{ textAlign: 'left', padding: 8, background: C.greenDim, borderRadius: 6, border: `1px solid ${C.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.green, fontSize: 12, fontWeight: 500, marginBottom: 4 }}><CheckCircle style={{ height: 12, width: 12 }} /> Data Extracted</div>
                        {cvAnalysis.skills?.length > 0 && <div style={{ fontSize: 12, color: C.textMuted }}>Skills: {cvAnalysis.skills.slice(0, 5).join(', ')}{cvAnalysis.skills.length > 5 ? '...' : ''}</div>}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="sr-only" tabIndex={-1} onChange={(e) => { const file = e.target.files?.[0]; if (file) { setCvFile(file); analyzeCvFile(file); } }} />
                    <div style={{ fontSize: 13, color: C.textMuted, cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}>
                      <Upload style={{ height: 32, width: 32, marginBottom: 8 }} /><span style={{ color: C.blue, fontWeight: 500 }}>Click to upload CV</span><p style={{ fontSize: 12, marginTop: 4 }}>AI will auto-fill the form</p>
                    </div>
                  </>
                )}
              </div>
            </div>
            {/* Position Suggestions */}
            {positionMatches.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Star style={{ height: 16, width: 16, color: C.orange }} /> Suggested Positions</CVisionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {positionMatches.map((match: any, idx: number) => (
                    <div key={idx} className={`p-3 rounded-lg border cursor-pointer transition-colors ${newCandidate.jobTitleId === match.jobTitleId ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                      onClick={() => { setNewCandidate(prev => ({ ...prev, departmentId: match.departmentId, jobTitleId: match.jobTitleId })); if (match.departmentId) loadJobTitles(match.departmentId); }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div><span style={{ fontWeight: 500, fontSize: 13 }}>{match.jobTitleName}</span><span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>({match.departmentName})</span></div>
                        <CVisionBadge C={C} variant={match.matchScore >= 70 ? 'default' : 'secondary'} className={match.matchScore >= 70 ? 'bg-green-500' : ''}>{match.matchScore}% Match</CVisionBadge>
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
                {cvUploading ? 'Uploading CV...' : 'Add Candidate'}
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
                  <p style={{ fontSize: 13, color: C.textMuted }}>{detailCandidate.jobTitleName || 'No position'} {detailCandidate.departmentName ? `- ${detailCandidate.departmentName}` : ''}</p>
                </div>
                <CVisionBadge C={C} className={STATUS_CONFIG[detailCandidate.status]?.color}>{STATUS_CONFIG[detailCandidate.status]?.label || detailCandidate.status}</CVisionBadge>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 13 }}>
                {detailCandidate.email && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail style={{ height: 12, width: 12 }} /> {detailCandidate.email}</div>}
                {detailCandidate.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone style={{ height: 12, width: 12 }} /> {detailCandidate.phone}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar style={{ height: 12, width: 12 }} /> {new Date(detailCandidate.createdAt).toLocaleDateString()}</div>
                {detailCandidate.screeningScore != null && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Star style={{ height: 12, width: 12, color: C.orange }} /> Score: {Math.round(detailCandidate.screeningScore / 10)}/10</div>}
              </div>
              {/* Skills from metadata */}
              {detailCandidate.metadata?.skills?.length > 0 && (
                <div><span style={{ fontSize: 13, color: C.textMuted }}>Skills:</span><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>{detailCandidate.metadata.skills.map((s: string) => <CVisionBadge C={C} key={s} variant="secondary" style={{ fontSize: 12 }}>{s}</CVisionBadge>)}</div></div>
              )}
              {/* Documents */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Documents:</span>
                {loadingDocuments ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 13, color: C.textMuted }}><RefreshCw style={{ height: 12, width: 12, animation: 'spin 1s linear infinite' }} /> Loading...</div>
                : candidateDocuments.length === 0 ? <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>No documents</p>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>{candidateDocuments.map((doc: any) => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><FileText style={{ height: 12, width: 12, color: C.blue }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{doc.fileName}</span><CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>{doc.kind}</CVisionBadge></div>
                ))}</div>}
              </div>
              {detailCandidate.notes && <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}><span style={{ fontSize: 13, fontWeight: 500 }}>Notes:</span><p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>{detailCandidate.notes}</p></div>}
              {/* Action buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                {(detailCandidate.status === 'applied' || detailCandidate.status === 'new' || detailCandidate.status === 'screening') && (
                  <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => { setDetailOpen(false); openScreenDialog(detailCandidate); }} style={{ color: C.purple }}><FileText style={{ height: 16, width: 16, marginRight: 4 }} /> Screen</CVisionButton>
                )}
                {detailCandidate.status === 'interview' && (
                  <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => { setDetailOpen(false); openInterviewDialog(detailCandidate, 'result'); }} style={{ color: C.blue }}><ClipboardList style={{ height: 16, width: 16, marginRight: 4 }} /> Interview Result</CVisionButton>
                )}
                {detailCandidate.status === 'offer' && (
                  <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => { setDetailOpen(false); openOfferDialog(detailCandidate); }} style={{ color: C.orange }}><FileSignature style={{ height: 16, width: 16, marginRight: 4 }} /> Manage Offer</CVisionButton>
                )}
                {onRunMatching && (
                  <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => { setDetailOpen(false); onRunMatching(detailCandidate.id); }} style={{ color: C.purple }}><Sparkles style={{ height: 16, width: 16, marginRight: 4 }} /> AI Match</CVisionButton>
                )}
              </div>
            </div>
          )}
      </CVisionDialog>

      {/* Screening Dialog */}
      <CVisionDialog C={C} open={screenDialogOpen} onClose={() => setScreenDialogOpen(false)} title={tr('فحص المرشح', 'Screen Candidate')} isDark={isDark}><p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Evaluate and make a decision</p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 16, paddingBottom: 16 }}>
            {selectedCandidate && (
              <div style={{ padding: 16, background: C.bgSubtle, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><div><p style={{ fontWeight: 600, fontSize: 16 }}>{selectedCandidate.fullName}</p><p style={{ fontSize: 13, color: C.textMuted }}>{selectedCandidate.jobTitleName || 'No position'} - {selectedCandidate.departmentName || 'No department'}</p></div><CVisionBadge C={C} className={STATUS_CONFIG[selectedCandidate.status]?.color}>{STATUS_CONFIG[selectedCandidate.status]?.label}</CVisionBadge></div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><CVisionLabel C={C} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Star style={{ height: 16, width: 16, color: C.orange }} /> Screening Score</CVisionLabel><span style={{ fontSize: 24, fontWeight: 700, color: C.gold }}>{screenData.screeningScore}/10</span></div>
              <Slider value={[screenData.screeningScore]} onValueChange={([v]) => setScreenData({ ...screenData, screeningScore: v })} min={1} max={10} step={1} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('ملاحظات', 'Notes')}</CVisionLabel><CVisionTextarea C={C} value={screenData.notes} onChange={(e) => setScreenData({ ...screenData, notes: e.target.value })} placeholder="Evaluation notes..." rows={3} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>{tr('القرار', 'Decision')}</CVisionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <CVisionButton C={C} isDark={isDark} type="button" variant={screenData.decision === 'shortlisted' ? 'default' : 'outline'} className={`h-20 flex flex-col items-center justify-center gap-2 ${screenData.decision === 'shortlisted' ? 'bg-green-600 hover:bg-green-700' : ''}`} onClick={() => setScreenData({ ...screenData, decision: 'shortlisted' })}><ThumbsUp style={{ height: 24, width: 24 }} /><span style={{ fontSize: 12 }}>Shortlist</span></CVisionButton>
                <CVisionButton C={C} isDark={isDark} type="button" variant={screenData.decision === 'interview' ? 'default' : 'outline'} className={`h-20 flex flex-col items-center justify-center gap-2 ${screenData.decision === 'interview' ? 'bg-blue-600 hover:bg-blue-700' : ''}`} onClick={() => setScreenData({ ...screenData, decision: 'interview' })}><Users style={{ height: 24, width: 24 }} /><span style={{ fontSize: 12 }}>Interview</span></CVisionButton>
                <CVisionButton C={C} isDark={isDark} type="button" variant={screenData.decision === 'rejected' ? 'default' : 'outline'} className={`h-20 flex flex-col items-center justify-center gap-2 ${screenData.decision === 'rejected' ? 'bg-red-600 hover:bg-red-700' : ''}`} onClick={() => setScreenData({ ...screenData, decision: 'rejected' })}><ThumbsDown style={{ height: 24, width: 24 }} /><span style={{ fontSize: 12 }}>Reject</span></CVisionButton>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setScreenDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
              <CVisionButton C={C} isDark={isDark} onClick={handleScreen} disabled={screening || !screenData.decision}>{screening && <RefreshCw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}{screenData.decision === 'shortlisted' ? 'Shortlist' : screenData.decision === 'interview' ? 'Move to Interview' : screenData.decision === 'rejected' ? 'Reject' : 'Select Decision'}</CVisionButton>
            </div>
          </div>
      </CVisionDialog>

      {/* Interview Dialog */}
      <CVisionDialog C={C} open={interviewDialogOpen} onClose={() => setInterviewDialogOpen(false)} title={tr('جدولة مقابلة', 'Schedule Interview')} isDark={isDark}>          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 16, paddingBottom: 16 }}>
            {selectedCandidate && <div style={{ padding: 12, background: C.bgSubtle, borderRadius: 12 }}><p style={{ fontWeight: 600 }}>{selectedCandidate.fullName}</p><p style={{ fontSize: 13, color: C.textMuted }}>{selectedCandidate.jobTitleName || 'No position'}</p></div>}
            {/* Interview rounds list */}
            {!loadingInterviews && candidateInterviews.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C} style={{ fontSize: 13, fontWeight: 500 }}>Interview Rounds ({candidateInterviews.length})</CVisionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                  {candidateInterviews.map((interview: any) => (
                    <div key={interview.id} className={`p-2 rounded border text-sm cursor-pointer ${selectedInterviewId === interview.id ? 'border-blue-500 bg-blue-50' : 'hover:border-blue-300'}`}
                      onClick={() => { if (interview.status !== 'cancelled') { setSelectedInterviewId(interview.id); setInterviewMode('result'); } }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 500 }}>Round {interview.roundNumber} - {interview.type?.replace('_', ' ')}</span>
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
              <CVisionButton C={C} isDark={isDark} type="button" variant={interviewMode === 'schedule' ? 'default' : 'outline'} size="sm" style={{ flex: 1 }} onClick={() => { setInterviewMode('schedule'); setSelectedInterviewId(null); }}><Calendar style={{ height: 16, width: 16, marginRight: 8 }} /> Schedule New</CVisionButton>
              <CVisionButton C={C} isDark={isDark} type="button" variant={interviewMode === 'result' ? 'default' : 'outline'} size="sm" style={{ flex: 1 }} onClick={() => setInterviewMode('result')} disabled={candidateInterviews.length === 0}><ClipboardList style={{ height: 16, width: 16, marginRight: 8 }} /> Record Result</CVisionButton>
            </div>
            {interviewMode === 'schedule' ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Date *</CVisionLabel><CVisionInput C={C} type="date" value={interviewData.scheduledDate} onChange={(e) => setInterviewData({ ...interviewData, scheduledDate: e.target.value })} /></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Time *</CVisionLabel><CVisionInput C={C} type="time" value={interviewData.scheduledTime} onChange={(e) => setInterviewData({ ...interviewData, scheduledTime: e.target.value })} /></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Type</CVisionLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {[{ value: 'phone', label: 'Phone' }, { value: 'video', label: 'Video' }, { value: 'in_person', label: 'In Person' }, { value: 'technical', label: 'Technical' }].map((t) => (
                      <CVisionButton C={C} isDark={isDark} key={t.value} type="button" variant={interviewData.interviewType === t.value ? 'default' : 'outline'} size="sm" onClick={() => setInterviewData({ ...interviewData, interviewType: t.value })}>{t.label}</CVisionButton>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('المحاورون', 'Interviewers')}</CVisionLabel><CVisionInput C={C} value={interviewData.interviewers} onChange={(e) => setInterviewData({ ...interviewData, interviewers: e.target.value })} placeholder="Names (comma separated)" /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('الموقع', 'Location')}</CVisionLabel><CVisionInput C={C} value={interviewData.location} onChange={(e) => setInterviewData({ ...interviewData, location: e.target.value })} placeholder="Meeting room, office..." /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('ملاحظات', 'Notes')}</CVisionLabel><CVisionTextarea C={C} value={interviewData.notes} onChange={(e) => setInterviewData({ ...interviewData, notes: e.target.value })} rows={2} /></div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                  <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setInterviewDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
                  <CVisionButton C={C} isDark={isDark} onClick={handleScheduleInterview} disabled={savingInterview || !interviewData.scheduledDate || !interviewData.scheduledTime} style={{ background: C.blueDim }}>{savingInterview && <RefreshCw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />} Schedule Interview</CVisionButton>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><CVisionLabel C={C}>{tr('درجة المقابلة', 'Interview Score')}</CVisionLabel><span style={{ fontSize: 24, fontWeight: 700, color: C.gold }}>{interviewData.interviewScore}/10</span></div>
                  <Slider value={[interviewData.interviewScore]} onValueChange={([v]) => setInterviewData({ ...interviewData, interviewScore: v })} min={1} max={10} step={1} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('الملاحظات', 'Feedback')}</CVisionLabel><CVisionTextarea C={C} value={interviewData.feedback} onChange={(e) => setInterviewData({ ...interviewData, feedback: e.target.value })} rows={3} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('القرار', 'Decision')}</CVisionLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    <CVisionButton C={C} isDark={isDark} type="button" variant={interviewData.decision === 'offer' ? 'default' : 'outline'} className={`h-16 flex flex-col items-center justify-center gap-1 ${interviewData.decision === 'offer' ? 'bg-green-600 hover:bg-green-700' : ''}`} onClick={() => setInterviewData({ ...interviewData, decision: 'offer' })}><Send style={{ height: 20, width: 20 }} /><span style={{ fontSize: 12 }}>Send Offer</span></CVisionButton>
                    <CVisionButton C={C} isDark={isDark} type="button" variant={interviewData.decision === 'next_interview' ? 'default' : 'outline'} className={`h-16 flex flex-col items-center justify-center gap-1 ${interviewData.decision === 'next_interview' ? 'bg-blue-600 hover:bg-blue-700' : ''}`} onClick={() => setInterviewData({ ...interviewData, decision: 'next_interview' })}><Users style={{ height: 20, width: 20 }} /><span style={{ fontSize: 12 }}>Next Round</span></CVisionButton>
                    <CVisionButton C={C} isDark={isDark} type="button" variant={interviewData.decision === 'hold' ? 'default' : 'outline'} className={`h-16 flex flex-col items-center justify-center gap-1 ${interviewData.decision === 'hold' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}`} onClick={() => setInterviewData({ ...interviewData, decision: 'hold' })}><Clock style={{ height: 20, width: 20 }} /><span style={{ fontSize: 12 }}>On Hold</span></CVisionButton>
                    <CVisionButton C={C} isDark={isDark} type="button" variant={interviewData.decision === 'rejected' ? 'default' : 'outline'} className={`h-16 flex flex-col items-center justify-center gap-1 ${interviewData.decision === 'rejected' ? 'bg-red-600 hover:bg-red-700' : ''}`} onClick={() => setInterviewData({ ...interviewData, decision: 'rejected' })}><ThumbsDown style={{ height: 20, width: 20 }} /><span style={{ fontSize: 12 }}>Reject</span></CVisionButton>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                  <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setInterviewDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
                  <CVisionButton C={C} isDark={isDark} onClick={handleInterviewResult} disabled={savingInterview || !interviewData.decision}>{savingInterview && <RefreshCw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}{interviewData.decision === 'offer' ? 'Move to Offer' : interviewData.decision === 'rejected' ? 'Reject' : 'Save Result'}</CVisionButton>
                </div>
              </>
            )}
          </div>
      </CVisionDialog>

      {/* Offer Dialog */}
      <CVisionDialog C={C} open={offerDialogOpen} onClose={() => setOfferDialogOpen(false)} title="Make Offer" isDark={isDark}><p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Create and send offer to {selectedCandidate?.fullName}</p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 16, paddingBottom: 16 }}>
            {selectedCandidate && <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${C.border}` }}><p style={{ fontWeight: 600, fontSize: 16 }}>{selectedCandidate.fullName}</p><p style={{ fontSize: 13, color: C.textMuted }}>{selectedCandidate.jobTitleName || 'No position'}</p></div>}
            {/* Salary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <CVisionLabel C={C} style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><DollarSign style={{ height: 20, width: 20, color: C.green }} /> Compensation</CVisionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>Basic *</CVisionLabel><CVisionInput C={C} type="number" placeholder="5000" value={offerData.basicSalary} onChange={(e) => setOfferData({ ...offerData, basicSalary: e.target.value })} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>Housing</CVisionLabel><CVisionInput C={C} type="number" placeholder="1500" value={offerData.housingAllowance} onChange={(e) => setOfferData({ ...offerData, housingAllowance: e.target.value })} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>Transport</CVisionLabel><CVisionInput C={C} type="number" placeholder="500" value={offerData.transportAllowance} onChange={(e) => setOfferData({ ...offerData, transportAllowance: e.target.value })} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>Other</CVisionLabel><CVisionInput C={C} type="number" placeholder="0" value={offerData.otherAllowances} onChange={(e) => setOfferData({ ...offerData, otherAllowances: e.target.value })} /></div>
              </div>
              {offerData.basicSalary && <div style={{ padding: 12, background: C.greenDim, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 13 }}>Total Monthly:</span><span style={{ fontWeight: 700, color: C.green }}>{((parseFloat(offerData.basicSalary) || 0) + (parseFloat(offerData.housingAllowance) || 0) + (parseFloat(offerData.transportAllowance) || 0) + (parseFloat(offerData.otherAllowances) || 0)).toLocaleString()} {offerData.currency}</span></div>}
            </div>
            {/* Employment */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12 }}>Start Date *</CVisionLabel><CVisionInput C={C} type="date" value={offerData.startDate} onChange={(e) => setOfferData({ ...offerData, startDate: e.target.value })} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('نوع العقد', 'Contract Type')}</CVisionLabel><CVisionSelect C={C} value={offerData.contractType} onChange={(v: string) => setOfferData({ ...offerData, contractType: v })} options={[{ value: 'full_time', label: 'Full Time' }, { value: 'part_time', label: 'Part Time' }, { value: 'contract', label: 'Contract' }, { value: 'internship', label: 'Internship' }]} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12 }}>Probation (days)</CVisionLabel><CVisionSelect C={C} value={offerData.probationPeriod} onChange={(v: string) => setOfferData({ ...offerData, probationPeriod: v })} options={[{ value: '0', label: 'No Probation' }, { value: '30', label: '30 Days' }, { value: '60', label: '60 Days' }, { value: '90', label: '90 Days' }, { value: '180', label: '180 Days' }]} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12 }}>Offer Expires</CVisionLabel><CVisionInput C={C} type="date" value={offerData.expiryDate} onChange={(e) => setOfferData({ ...offerData, expiryDate: e.target.value })} /></div>
            </div>
            {/* Benefits */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C} style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><Gift style={{ height: 20, width: 20, color: C.purple }} /> Benefits</CVisionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {['Health Insurance', 'Dental Insurance', 'Annual Leave 21 days', 'Annual Leave 30 days', 'End of Service Benefits', 'Annual Bonus', 'Flight Tickets', 'Company Car', 'Remote Work', 'Training Budget'].map((b) => (
                  <label key={b} className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${offerData.benefits.includes(b) ? 'bg-purple-50 border-purple-300' : 'hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={offerData.benefits.includes(b)} onChange={(e) => setOfferData({ ...offerData, benefits: e.target.checked ? [...offerData.benefits, b] : offerData.benefits.filter(x => x !== b) })} style={{ borderRadius: 6 }} />
                    <span style={{ fontSize: 13 }}>{b}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{tr('ملاحظات', 'Notes')}</CVisionLabel><CVisionTextarea C={C} value={offerData.notes} onChange={(e) => setOfferData({ ...offerData, notes: e.target.value })} rows={2} /></div>
            {/* Offer workflow for existing offers */}
            {selectedCandidate?.status === 'offer' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                {/* Record response */}
                {(offerData.offerStatus === 'sent' || offerData.offerStatus === 'draft' || !offerData.offerStatus) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <CVisionLabel C={C} style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><Handshake style={{ height: 20, width: 20, color: C.green }} /> Record Response</CVisionLabel>
                    <CVisionTextarea C={C} value={offerData.responseNotes} onChange={(e) => setOfferData({ ...offerData, responseNotes: e.target.value })} placeholder="Notes..." rows={2} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                      <CVisionButton C={C} isDark={isDark} type="button" style={{ height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, background: C.greenDim }} onClick={() => handleOfferResponse('accepted')} disabled={savingOffer}><Check style={{ height: 20, width: 20 }} /><span style={{ fontSize: 12 }}>Accepted</span></CVisionButton>
                      <CVisionButton C={C} isDark={isDark} type="button" variant="outline" style={{ height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: C.orange }} onClick={() => handleOfferResponse('negotiating')} disabled={savingOffer}><MessageSquare style={{ height: 20, width: 20 }} /><span style={{ fontSize: 12 }}>Negotiating</span></CVisionButton>
                      <CVisionButton C={C} isDark={isDark} type="button" variant="outline" style={{ height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: C.red }} onClick={() => handleOfferResponse('rejected')} disabled={savingOffer}><XCircle style={{ height: 20, width: 20 }} /><span style={{ fontSize: 12 }}>Rejected</span></CVisionButton>
                    </div>
                  </div>
                )}
                {/* HR Approval */}
                {offerData.offerStatus === 'accepted_pending_approval' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ padding: 12, background: C.blueDim, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, color: C.blue }}><AlertCircle style={{ height: 20, width: 20 }} /><span style={{ fontWeight: 500 }}>Candidate accepted! Awaiting HR approval.</span></div>
                    <CVisionTextarea C={C} value={offerData.responseNotes} onChange={(e) => setOfferData({ ...offerData, responseNotes: e.target.value })} placeholder="Approval notes..." rows={2} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                      <CVisionButton C={C} isDark={isDark} type="button" style={{ height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, background: C.greenDim }} onClick={() => handleHRApproval(true)} disabled={savingOffer}><Check style={{ height: 20, width: 20 }} /><span style={{ fontSize: 12 }}>Approve & Hire</span></CVisionButton>
                      <CVisionButton C={C} isDark={isDark} type="button" variant="outline" style={{ height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: C.red }} onClick={() => handleHRApproval(false)} disabled={savingOffer}><XCircle style={{ height: 20, width: 20 }} /><span style={{ fontSize: 12 }}>Reject</span></CVisionButton>
                    </div>
                  </div>
                )}
                {offerData.offerStatus === 'approved' && (
                  <div style={{ padding: 16, background: C.greenDim, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.green }}><CheckCircle style={{ height: 20, width: 20 }} /><span style={{ fontWeight: 500 }}>Approved! Ready to hire.</span></div>
                    <CVisionButton C={C} isDark={isDark} onClick={() => { setOfferDialogOpen(false); openHireDialog(selectedCandidate!); }} style={{ background: C.greenDim }}><UserCheck style={{ height: 16, width: 16, marginRight: 8 }} /> Complete Hiring</CVisionButton>
                  </div>
                )}
              </div>
            )}
            {/* Portal link */}
            {offerPortalUrl && <div style={{ padding: 12, background: C.blueDim, border: `1px solid ${C.border}`, borderRadius: 12 }}><CVisionLabel C={C} style={{ fontSize: 13, fontWeight: 600, color: C.blue }}>Offer Portal Link</CVisionLabel><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}><CVisionInput C={C} value={offerPortalUrl} readOnly style={{ fontSize: 12 }} /><CVisionButton C={C} isDark={isDark} type="button" variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(offerPortalUrl); toast.success('Copied!'); }}><Copy style={{ height: 16, width: 16 }} /></CVisionButton></div></div>}
            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setOfferDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
              {selectedCandidate?.status !== 'offer' && <CVisionButton C={C} isDark={isDark} onClick={handleSendOffer} disabled={savingOffer || !offerData.basicSalary || !offerData.startDate} style={{ background: C.orangeDim }}>{savingOffer && <RefreshCw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}<Send style={{ height: 16, width: 16, marginRight: 8 }} /> Send Offer</CVisionButton>}
            </div>
          </div>
      </CVisionDialog>

      {/* Hire Dialog */}
      <CVisionDialog C={C} open={hireDialogOpen} onClose={() => setHireDialogOpen(false)} title={tr('توظيف المرشح', 'Hire Candidate')} isDark={isDark}><p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Complete the hiring process for {selectedCandidate?.fullName}</p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16, paddingBottom: 16 }}>
            {selectedCandidate && <div style={{ padding: 12, background: C.bgSubtle, borderRadius: 12 }}><p style={{ fontWeight: 500 }}>{selectedCandidate.fullName}</p><p style={{ fontSize: 13, color: C.textMuted }}>{selectedCandidate.jobTitleName || 'No position'}</p></div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Start Date *</CVisionLabel><CVisionInput C={C} type="date" value={hireData.startDate} onChange={(e) => setHireData({ ...hireData, startDate: e.target.value })} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Basic *</CVisionLabel><CVisionInput C={C} type="number" placeholder="5000" value={hireData.basicSalary} onChange={(e) => setHireData({ ...hireData, basicSalary: e.target.value })} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Housing</CVisionLabel><CVisionInput C={C} type="number" placeholder="1500" value={hireData.housingAllowance} onChange={(e) => setHireData({ ...hireData, housingAllowance: e.target.value })} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Transport</CVisionLabel><CVisionInput C={C} type="number" placeholder="500" value={hireData.transportAllowance} onChange={(e) => setHireData({ ...hireData, transportAllowance: e.target.value })} /></div>
            </div>
            {hireData.basicSalary && <div style={{ padding: 12, background: C.greenDim, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 13 }}>Total Monthly:</span><span style={{ fontWeight: 700, color: C.green }}>{((parseFloat(hireData.basicSalary) || 0) + (parseFloat(hireData.housingAllowance) || 0) + (parseFloat(hireData.transportAllowance) || 0)).toLocaleString()} SAR</span></div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16 }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setHireDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
              <CVisionButton C={C} isDark={isDark} onClick={handleHire} disabled={hiring || !hireData.basicSalary}>{hiring && <RefreshCw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}<UserCheck style={{ height: 16, width: 16, marginRight: 8 }} /> Confirm Hire</CVisionButton>
            </div>
          </div>
      </CVisionDialog>
    </div>
  );
}

// Actions menu component
function CandidateActionsMenu({
  candidate, onStatusChange, onHire, onScreen, onInterview, onOffer, onMatch, compact = false,
}: {
  candidate: Candidate; onStatusChange: (id: string, status: string) => void;
  onHire: (c: Candidate) => void; onScreen: (c: Candidate) => void;
  onInterview: (c: Candidate, mode: 'schedule' | 'result') => void;
  onOffer: (c: Candidate) => void; onMatch?: (id: string) => void; compact?: boolean;
}) {
  const { C, isDark } = useCVisionTheme();
  if (candidate.status === 'hired' || candidate.status === 'rejected') return null;
  const canScreen = candidate.status === 'applied' || candidate.status === 'new' || candidate.status === 'screening';
  const canInterview = candidate.status === 'interview';
  const canOffer = candidate.status === 'offer';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <CVisionButton C={C} isDark={isDark} variant="ghost" size={compact ? "icon" : "sm"} className={compact ? "h-6 w-6" : ""}><MoreHorizontal style={{ height: 16, width: 16 }} /></CVisionButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canScreen && <>
          <DropdownMenuItem onClick={() => onScreen(candidate)} style={{ color: C.purple }}><FileText style={{ height: 16, width: 16, marginRight: 8 }} /> Screen</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onStatusChange(candidate.id, 'shortlisted')} className="text-indigo-600"><ThumbsUp style={{ height: 16, width: 16, marginRight: 8 }} /> Quick Shortlist</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onInterview(candidate, 'schedule')} style={{ color: C.blue }}><Calendar style={{ height: 16, width: 16, marginRight: 8 }} /> Schedule Interview</DropdownMenuItem>
        </>}
        {canInterview && <>
          <DropdownMenuItem onClick={() => onInterview(candidate, 'result')} style={{ color: C.blue }}><ClipboardList style={{ height: 16, width: 16, marginRight: 8 }} /> Record Result</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onInterview(candidate, 'schedule')} style={{ color: C.blue }}><Calendar style={{ height: 16, width: 16, marginRight: 8 }} /> Schedule Another</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onOffer(candidate)} style={{ color: C.orange }}><FileSignature style={{ height: 16, width: 16, marginRight: 8 }} /> Send Offer</DropdownMenuItem>
        </>}
        {canOffer && <DropdownMenuItem onClick={() => onOffer(candidate)} style={{ color: C.orange }}><FileSignature style={{ height: 16, width: 16, marginRight: 8 }} /> Manage Offer</DropdownMenuItem>}
        {(candidate.status === 'offer' || candidate.status === 'interview' || candidate.status === 'shortlisted') && (
          <DropdownMenuItem onClick={() => onHire(candidate)} style={{ color: C.green }}><UserCheck style={{ height: 16, width: 16, marginRight: 8 }} /> Hire Now</DropdownMenuItem>
        )}
        {onMatch && <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => onMatch(candidate.id)} style={{ color: C.purple }}><Sparkles style={{ height: 16, width: 16, marginRight: 8 }} /> AI Match</DropdownMenuItem></>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onStatusChange(candidate.id, 'rejected')} style={{ color: C.red }}><XCircle style={{ height: 16, width: 16, marginRight: 8 }} /> Reject</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
