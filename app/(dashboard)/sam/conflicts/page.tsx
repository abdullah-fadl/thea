'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { AlertCircle, Loader2, Eye, FileText, RefreshCw, Sparkles, Copy, Check, Download } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Policy {
  policyId: string;
  filename: string;
  status: string;
}

interface Issue {
  issueId: string;
  severity: 'HIGH' | 'MED' | 'LOW';
  type: 'CONFLICT' | 'GAP' | 'DUPLICATE' | 'INCONSISTENCY';
  summary: string;
  policyA: { policyId: string; filename: string };
  policyB: { policyId: string; filename: string } | null;
  locationA: { pageNumber: number; lineStart: number; lineEnd: number; snippet: string };
  locationB: { pageNumber: number; lineStart: number; lineEnd: number; snippet: string } | null;
  recommendation: string;
}

interface AIIssue {
  type: 'CONTRADICTION' | 'GAP' | 'AMBIGUITY' | 'DUPLICATION' | 'OUTDATED' | 'RISK';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  title: string;
  summary: string;
  recommendation: string;
  evidence: Array<{
    policyId: string;
    filename: string;
    page: number | null;
    chunkId: string;
    quote: string;
  }>;
}

export default function PoliciesConflictsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const searchParams = useSearchParams();
  const autoRunRef = useRef(false);
  const [mode, setMode] = useState<'single' | 'pair' | 'global'>('single');
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedPolicyA, setSelectedPolicyA] = useState<string>('');
  const [selectedPolicyB, setSelectedPolicyB] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [strictness, setStrictness] = useState<'Strict' | 'Balanced'>('Strict');
  const [limitPolicies, setLimitPolicies] = useState<number>(20);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewrittenPolicy, setRewrittenPolicy] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [rewrittenPolicies, setRewrittenPolicies] = useState<Record<string, { policyId: string; filename: string; text: string; accreditation?: string }>>({});
  const [currentPreviewPolicyId, setCurrentPreviewPolicyId] = useState<string | null>(null);
  const [isPolicySelectorOpen, setIsPolicySelectorOpen] = useState(false);
  const [pendingRewritePolicies, setPendingRewritePolicies] = useState<Array<{ policyId: string; filename: string; issueCount: number }>>([]);
  const [currentRewriteIndex, setCurrentRewriteIndex] = useState(0);
  const { toast } = useToast();
  const sourceIdFilter = searchParams?.get('sourceId');

  const filteredIssues = useMemo(() => {
    if (!sourceIdFilter) return issues;
    return issues.filter((issue) => {
      return issue.policyA?.policyId === sourceIdFilter || issue.policyB?.policyId === sourceIdFilter;
    });
  }, [issues, sourceIdFilter]);

  useEffect(() => {
    const queueType = searchParams?.get('queueType');
    const sourceId = searchParams?.get('sourceId');
    const modeParam = searchParams?.get('mode');
    const categoryParam = searchParams?.get('category');
    if (modeParam === 'single' || modeParam === 'pair' || modeParam === 'global') {
      setMode(modeParam);
    } else if (queueType === 'conflicts_to_review') {
      setMode(sourceId ? 'single' : 'global');
    }
    if (sourceId) {
      setSelectedPolicyA(sourceId);
    }
    if (categoryParam) {
      setCategory(categoryParam);
    } else if (queueType === 'conflicts_to_review') {
      setCategory('CONFLICT');
    }
  }, [searchParams]);

  useEffect(() => {
    const queueType = searchParams?.get('queueType');
    if (!queueType || autoRunRef.current) return;
    if (queueType !== 'conflicts_to_review') return;
    if (isScanning) return;
    if (mode === 'single' && !selectedPolicyA) return;
    autoRunRef.current = true;
    handleScan();
  }, [searchParams, mode, selectedPolicyA, isScanning]);

  // AI Review state
  const [aiQuery, setAiQuery] = useState('Find conflicts, gaps, and risks in these documents');
  const [selectedPoliciesForAI, setSelectedPoliciesForAI] = useState<string[]>([]);
  const [isAIRunning, setIsAIRunning] = useState(false);
  const [aiIssues, setAiIssues] = useState<AIIssue[]>([]);
  const [aiMeta, setAiMeta] = useState<{ retrievedChunks?: number; model?: string } | null>(null);
  const [selectedAIIssue, setSelectedAIIssue] = useState<AIIssue | null>(null);
  const [isAIDetailsOpen, setIsAIDetailsOpen] = useState(false);
  const [copiedRecommendation, setCopiedRecommendation] = useState<string | null>(null);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);

  // AI Rewrite state
  const [isAIRewriteSelectorOpen, setIsAIRewriteSelectorOpen] = useState(false);
  const [aiRewrittenPolicies, setAiRewrittenPolicies] = useState<Record<string, { policyId: string; filename: string; text: string; accreditation?: string }>>({});
  const [isAIRewriting, setIsAIRewriting] = useState(false);
  const [pendingAIRewritePolicies, setPendingAIRewritePolicies] = useState<Array<{ policyId: string; filename: string; issueCount: number }>>([]);
  const [currentAIRewriteIndex, setCurrentAIRewriteIndex] = useState(0);
  
  // Accreditation selection state
  const [isAccreditationDialogOpen, setIsAccreditationDialogOpen] = useState(false);
  const [selectedAccreditations, setSelectedAccreditations] = useState<string[]>(['CBAHI']);
  const [customAccreditation, setCustomAccreditation] = useState('');
  const [pendingRewritePolicyId, setPendingRewritePolicyId] = useState<string | null>(null);
  
  // Comprehensive list of local and international accreditations
  const accreditationOptions = [
    // International
    { id: 'JCIA', label: 'JCIA (Joint Commission International Accreditation)', category: 'International' },
    { id: 'JCI', label: 'JCI (Joint Commission International)', category: 'International' },
    { id: 'ISO_9001', label: 'ISO 9001 (Quality Management)', category: 'International' },
    { id: 'ISO_15189', label: 'ISO 15189 (Medical Laboratories)', category: 'International' },
    { id: 'ISO_27001', label: 'ISO 27001 (Information Security)', category: 'International' },
    { id: 'HIMSS', label: 'HIMSS (Healthcare Information and Management Systems Society)', category: 'International' },
    { id: 'COCIR', label: 'COCIR (European Coordination Committee of the Radiological)', category: 'International' },
    { id: 'AABB', label: 'AABB (American Association of Blood Banks)', category: 'International' },
    { id: 'CAP', label: 'CAP (College of American Pathologists)', category: 'International' },
    { id: 'AHIMA', label: 'AHIMA (American Health Information Management Association)', category: 'International' },
    // Regional/Local
    { id: 'CBAHI', label: 'CBAHI (Central Board for Accreditation of Healthcare Institutions)', category: 'Regional/Local' },
    { id: 'SASO', label: 'SASO (Saudi Standards, Metrology and Quality Organization)', category: 'Regional/Local' },
    { id: 'MOH', label: 'MOH (Ministry of Health Standards)', category: 'Regional/Local' },
    { id: 'SCFHS', label: 'SCFHS (Saudi Commission for Health Specialties)', category: 'Regional/Local' },
    { id: 'SBC', label: 'SBC (Saudi Building Code)', category: 'Regional/Local' },
    { id: 'SFD', label: 'SFD (Saudi Food and Drug Authority)', category: 'Regional/Local' },
  ];

  // Load saved rewritten policies from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('rewrittenPolicies');
      if (saved) {
        const parsed = JSON.parse(saved);
        setRewrittenPolicies(parsed);
      }
    } catch (error) {
      console.error('Failed to load saved rewritten policies:', error);
    }
  }, []);

  // Save rewritten policies to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(rewrittenPolicies).length > 0) {
      try {
        localStorage.setItem('rewrittenPolicies', JSON.stringify(rewrittenPolicies));
      } catch (error) {
        console.error('Failed to save rewritten policies:', error);
      }
    }
  }, [rewrittenPolicies]);

  // Load saved AI rewritten policies from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('aiRewrittenPolicies');
      if (saved) {
        const parsed = JSON.parse(saved);
        setAiRewrittenPolicies(parsed);
      }
    } catch (error) {
      console.error('Failed to load saved AI rewritten policies:', error);
    }
  }, []);

  // Save AI rewritten policies to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(aiRewrittenPolicies).length > 0) {
      try {
        localStorage.setItem('aiRewrittenPolicies', JSON.stringify(aiRewrittenPolicies));
      } catch (error) {
        console.error('Failed to save AI rewritten policies:', error);
      }
    }
  }, [aiRewrittenPolicies]);

  // Fetch policies list
  useEffect(() => {
    async function fetchPolicies() {
      try {
        const response = await fetch('/api/sam/thea-engine/policies', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setServiceUnavailable(data.serviceUnavailable === true);
          const readyPolicies = (data.policies || []).filter(
            (p: Policy) => p.status === 'READY'
          );
          setPolicies(readyPolicies);
        }
      } catch (error) {
        console.error('Failed to fetch policies:', error);
      }
    }
    fetchPolicies();
  }, []);

  async function handleScan() {
    if (mode === 'single' && !selectedPolicyA) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('يرجى اختيار مستند', 'Please select a policy'),
        variant: 'destructive',
      });
      return;
    }

    if (mode === 'pair' && (!selectedPolicyA || !selectedPolicyB)) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('يرجى اختيار كلا المستندين', 'Please select both documents'),
        variant: 'destructive',
      });
      return;
    }

    setIsScanning(true);
    setIssues([]);

    try {
      const response = await fetch('/api/sam/thea-engine/conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mode,
          policyIdA: selectedPolicyA || undefined,
          policyIdB: selectedPolicyB || undefined,
          strictness: strictness.toLowerCase(),
          category: category || undefined,
          limitPolicies: mode === 'global' ? limitPolicies : undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setIssues(data.issues || []);
        toast({
          title: tr('نجاح', 'Success'),
          description: `${tr('المشاكل المكتشفة', 'Issues found')}: ${data.issues?.length || 0}`,
        });
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Scan failed' }));
        throw new Error(errorData.error || 'Failed to scan for conflicts');
      }
    } catch (error: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error.message || tr('فشل فحص المستندات', 'Failed to scan documents'),
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  }

  function getSeverityColor(severity: string): 'destructive' | 'default' | 'secondary' | 'outline' {
    switch (severity) {
      case 'HIGH':
        return 'destructive';
      case 'MED':
        return 'default';
      case 'LOW':
        return 'secondary';
      default:
        return 'outline';
    }
  }

  function getTypeColor(type: string): 'destructive' | 'default' | 'secondary' | 'outline' {
    switch (type) {
      case 'CONFLICT':
        return 'destructive';
      case 'GAP':
        return 'default';
      case 'DUPLICATE':
        return 'secondary';
      case 'INCONSISTENCY':
        return 'outline';
      default:
        return 'outline';
    }
  }

  // Group issues by policyId
  function getIssuesByPolicy() {
    const grouped: Record<string, { policy: { policyId: string; filename: string }; issues: Issue[] }> = {};
    issues.forEach((issue) => {
      const policyId = issue.policyA.policyId;
      if (!grouped[policyId]) {
        grouped[policyId] = {
          policy: issue.policyA,
          issues: [],
        };
      }
      grouped[policyId].issues.push(issue);
      
      // Also include policyB if it exists
      if (issue.policyB) {
        const policyBId = issue.policyB.policyId;
        if (!grouped[policyBId]) {
          grouped[policyBId] = {
            policy: issue.policyB,
            issues: [],
          };
        }
        grouped[policyBId].issues.push(issue);
      }
    });
    return grouped;
  }
  
  // Get unique policies with issues for global scan
  function getPoliciesWithIssues() {
    const grouped = getIssuesByPolicy();
    return Object.values(grouped).map(({ policy, issues }) => ({
      policyId: policy.policyId,
      filename: policy.filename,
      issueCount: issues.length,
    }));
  }

  async function handleAIRun() {
    if (!aiQuery.trim()) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('يرجى إدخال استعلام', 'Please enter a query'),
        variant: 'destructive',
      });
      return;
    }

    setIsAIRunning(true);
    setAiIssues([]);
    setAiMeta(null);

    try {
      const response = await fetch('/api/sam/thea-engine/issues/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          query: aiQuery,
          policyIds: selectedPoliciesForAI.length > 0 ? selectedPoliciesForAI : null,
          topK: 20,
          includeEvidence: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Check if service is unavailable
        if (data.serviceUnavailable === true) {
          setServiceUnavailable(true);
          setAiIssues([]);
          return; // Don't show error toast
        }
        setServiceUnavailable(false);
        setAiIssues(data.issues || []);
        setAiMeta(data.meta || {});
        toast({
          title: tr('اكتملت المراجعة', 'Review complete'),
          description: `${tr('تم العثور على', 'Found')} ${data.issues?.length || 0} ${tr('مشكلة', 'issue(s)')}`,
        });
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Review failed' }));
        // Check if service is unavailable
        if (response.status === 503 || errorData.error?.includes('not available')) {
          setServiceUnavailable(true);
          setAiIssues([]);
          return; // Don't show error toast
        }
        throw new Error(errorData.error || 'Failed to run review');
      }
    } catch (error: any) {
      // Don't show error toast if service is unavailable - banner will show instead
      if (!serviceUnavailable && !error.message?.includes('not available')) {
        toast({
          title: tr('خطأ', 'Error'),
          description: error.message || tr('فشل تشغيل المراجعة', 'Failed to run review'),
          variant: 'destructive',
        });
      }
    } finally {
      setIsAIRunning(false);
    }
  }

  function handleCopyRecommendation(issue: AIIssue) {
    navigator.clipboard.writeText(issue.recommendation);
    setCopiedRecommendation(issue.title);
    toast({
      title: tr('تم النسخ', 'Copied'),
      description: tr('تم نسخ التوصية إلى الحافظة', 'Recommendation copied to clipboard'),
    });
    setTimeout(() => setCopiedRecommendation(null), 2000);
  }

  function getAISeverityColor(severity: string): 'destructive' | 'default' | 'secondary' | 'outline' {
    switch (severity) {
      case 'HIGH':
        return 'destructive';
      case 'MEDIUM':
        return 'default';
      case 'LOW':
        return 'secondary';
      default:
        return 'outline';
    }
  }

  function getAITypeColor(type: string): 'destructive' | 'default' | 'secondary' | 'outline' {
    switch (type) {
      case 'CONTRADICTION':
        return 'destructive';
      case 'GAP':
        return 'default';
      case 'AMBIGUITY':
        return 'secondary';
      case 'DUPLICATION':
        return 'outline';
      case 'OUTDATED':
        return 'outline';
      case 'RISK':
        return 'destructive';
      default:
        return 'outline';
    }
  }

  // Get unique policies from AI issues
  function getPoliciesFromAIIssues() {
    const policyMap = new Map<string, { policyId: string; filename: string; issueCount: number }>();
    
    aiIssues.forEach((issue) => {
      issue.evidence.forEach((ev) => {
        const policyId = ev.policyId;
        if (!policyMap.has(policyId)) {
          policyMap.set(policyId, {
            policyId,
            filename: ev.filename,
            issueCount: 0,
          });
        }
        policyMap.get(policyId)!.issueCount++;
      });
    });
    
    return Array.from(policyMap.values());
  }

  async function handleAIRewriteAll(policyId?: string, accreditation?: string) {
    let targetPolicyId = policyId;
    
    // Check if policy is already rewritten
    if (targetPolicyId && aiRewrittenPolicies[targetPolicyId]) {
      const rewritten = aiRewrittenPolicies[targetPolicyId];
      setRewrittenPolicy(rewritten.text);
      setCurrentPreviewPolicyId(rewritten.policyId);
      setIsPreviewOpen(true);
      toast({
        title: tr('معلومة', 'Info'),
        description: tr('عرض المستند المعاد كتابته سابقاً', 'Showing previously rewritten document') + `: ${rewritten.filename}`,
      });
      return;
    }

    // If no policyId provided, show selector
    if (!targetPolicyId) {
      const policiesWithIssues = getPoliciesFromAIIssues();
      if (policiesWithIssues.length === 0) {
        toast({
          title: tr('خطأ', 'Error'),
          description: tr('لا توجد مستندات في نتائج المراجعة', 'No documents found in review results'),
          variant: 'destructive',
        });
        return;
      }

      // Check if all are already rewritten
      const needsRewrite = policiesWithIssues.filter(p => !aiRewrittenPolicies[p.policyId]);
      if (needsRewrite.length === 0) {
        // All rewritten, show first one
        const firstPolicy = policiesWithIssues[0];
        const rewritten = aiRewrittenPolicies[firstPolicy.policyId];
        setRewrittenPolicy(rewritten.text);
        setCurrentPreviewPolicyId(rewritten.policyId);
        setPendingAIRewritePolicies(policiesWithIssues);
        setCurrentAIRewriteIndex(0);
        setIsPreviewOpen(true);
        toast({
          title: tr('معلومة', 'Info'),
          description: tr('تمت إعادة كتابة جميع المستندات. عرض المستند الأول.', 'All documents have been rewritten. Showing first document.'),
        });
        return;
      }

      // Show selector
      setPendingAIRewritePolicies(policiesWithIssues);
      setCurrentAIRewriteIndex(0);
      setIsAIRewriteSelectorOpen(true);
      return;
    }

    // If no accreditation provided, show accreditation dialog
    if (!accreditation) {
      setPendingRewritePolicyId(targetPolicyId);
      setIsAccreditationDialogOpen(true);
      return;
    }

    // Get issues for this policy
    const policyIssues = aiIssues.filter((issue) =>
      issue.evidence.some((ev) => ev.policyId === targetPolicyId)
    );

    if (policyIssues.length === 0) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('لا توجد مشاكل للمستند المحدد', 'No issues found for the selected policy'),
        variant: 'destructive',
      });
      return;
    }

    setIsAIRewriting(true);
    try {
      // Convert AI issues to rewrite format
      const rewriteIssues = policyIssues.map((issue) => {
        // Find evidence for this policy
        const policyEvidence = issue.evidence.filter((ev) => ev.policyId === targetPolicyId);
        
        return {
          issueId: `ai-${issue.title}-${Date.now()}`, // Generate unique ID
          severity: issue.severity === 'HIGH' ? 'HIGH' : issue.severity === 'MEDIUM' ? 'MED' : 'LOW',
          type: issue.type === 'CONTRADICTION' ? 'CONFLICT' : 
                issue.type === 'DUPLICATION' ? 'DUPLICATE' : 
                issue.type === 'AMBIGUITY' ? 'INCONSISTENCY' : 
                issue.type === 'GAP' ? 'GAP' : 'INCONSISTENCY',
          summary: issue.summary,
          recommendation: issue.recommendation,
          locationA: policyEvidence[0] ? {
            pageNumber: policyEvidence[0].page || 1,
            lineStart: 1,
            lineEnd: 50,
            snippet: policyEvidence[0].quote || issue.summary,
          } : {
            pageNumber: 1,
            lineStart: 1,
            lineEnd: 50,
            snippet: issue.summary,
          },
          locationB: null,
        };
      });

      const response = await fetch(`/api/sam/thea-engine/policies/${targetPolicyId}/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mode: 'apply_all',
          issues: rewriteIssues,
          language: 'auto',
          standard: accreditation, // Pass accreditation/standard to API
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rewrittenText = data.updatedPolicyText || data.policyText || '';
        
        // Find the policy filename
        const policy = policies.find(p => p.policyId === targetPolicyId);
        const filename = policy?.filename || targetPolicyId;
        
        // Store rewritten policy with accreditation
        const updatedPolicies = {
          ...aiRewrittenPolicies,
          [targetPolicyId]: {
            policyId: targetPolicyId,
            filename,
            text: rewrittenText,
            accreditation,
          }
        };
        setAiRewrittenPolicies(updatedPolicies);
        
        // Show preview
        setRewrittenPolicy(rewrittenText);
        setCurrentPreviewPolicyId(targetPolicyId);
        setIsPreviewOpen(true);
        
        toast({
          title: tr('نجاح', 'Success'),
          description: `${tr('تمت إعادة كتابة المستند', 'Document rewritten successfully')}: "${filename}" (${accreditation})`,
        });
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Rewrite failed' }));
        throw new Error(errorData.error || 'Failed to rewrite document');
      }
    } catch (error: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error.message || tr('فشل إعادة كتابة المستند', 'Failed to rewrite document'),
        variant: 'destructive',
      });
    } finally {
      setIsAIRewriting(false);
    }
  }
  
  // Handle accreditation selection and proceed with rewrite
  async function handleAccreditationConfirm() {
    if (selectedAccreditations.length === 0 && !customAccreditation.trim()) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('يرجى اختيار اعتماد واحد على الأقل', 'Please select at least one accreditation/certification'),
        variant: 'destructive',
      });
      return;
    }

    // Combine selected accreditations with custom one if provided
    const accreditations = [...selectedAccreditations];
    if (customAccreditation.trim()) {
      accreditations.push(customAccreditation.trim());
    }
    
    const accreditationString = accreditations.join(', ');
    setIsAccreditationDialogOpen(false);
    
    if (pendingRewritePolicyId) {
      // Check if this is for AI rewrite or regular rewrite
      const isAIRewrite = aiIssues.length > 0 && aiIssues.some(issue => 
        issue.evidence.some(ev => ev.policyId === pendingRewritePolicyId)
      );
      
      if (isAIRewrite) {
        await handleAIRewriteAll(pendingRewritePolicyId, accreditationString);
      } else {
        await handleRewriteAll(pendingRewritePolicyId, accreditationString);
      }
      setPendingRewritePolicyId(null);
    }
  }
  
  // Toggle accreditation selection
  function toggleAccreditation(accreditationId: string) {
    setSelectedAccreditations(prev => 
      prev.includes(accreditationId)
        ? prev.filter(id => id !== accreditationId)
        : [...prev, accreditationId]
    );
  }
  
  // Download policy as text file
  function handleDownloadText() {
    // Try AI rewritten first, then regular rewritten, then current rewrittenPolicy state
    let policyText = null;
    let accreditation = null;
    
    if (currentPreviewPolicyId) {
      const aiRewritten = aiRewrittenPolicies[currentPreviewPolicyId];
      const regularRewritten = rewrittenPolicies[currentPreviewPolicyId];
      
      if (aiRewritten) {
        policyText = aiRewritten.text;
        accreditation = aiRewritten.accreditation;
      } else if (regularRewritten) {
        policyText = regularRewritten.text;
      }
    }
    
    if (!policyText) {
      policyText = rewrittenPolicy;
    }
    
    if (!policyText) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('لا يوجد نص مستند للتحميل', 'No document text to download'),
        variant: 'destructive',
      });
      return;
    }

    const policy = currentPreviewPolicyId ? policies.find(p => p.policyId === currentPreviewPolicyId) : null;
    const filename = policy?.filename || 'document';
    const blob = new Blob([policyText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileExtension = accreditation ? `_rewritten_${accreditation.replace(/\s+/g, '_')}.txt` : '_rewritten.txt';
    a.download = `${filename.replace(/\.pdf$/i, '')}${fileExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: tr('نجاح', 'Success'),
      description: tr('تم تحميل المستند كملف نصي', 'Document downloaded as text file'),
    });
  }
  
  // Download policy as PDF (simple implementation using browser print)
  function handleDownloadPDF() {
    // Try AI rewritten first, then regular rewritten, then current rewrittenPolicy state
    let policyText = null;
    let accreditation = null;
    
    if (currentPreviewPolicyId) {
      const aiRewritten = aiRewrittenPolicies[currentPreviewPolicyId];
      const regularRewritten = rewrittenPolicies[currentPreviewPolicyId];
      
      if (aiRewritten) {
        policyText = aiRewritten.text;
        accreditation = aiRewritten.accreditation;
      } else if (regularRewritten) {
        policyText = regularRewritten.text;
      }
    }
    
    if (!policyText) {
      policyText = rewrittenPolicy;
    }
    
    if (!policyText) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('لا يوجد نص مستند للتحميل', 'No document text to download'),
        variant: 'destructive',
      });
      return;
    }

    // Create a new window with formatted policy text
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('يرجى السماح بالنوافذ المنبثقة لتحميل PDF', 'Please allow pop-ups to download PDF'),
        variant: 'destructive',
      });
      return;
    }

    // Format text with basic HTML for better PDF output
    const formattedText = policyText
      .split('\n')
      .map(line => {
        // Convert markdown-like headings
        if (line.startsWith('# ')) {
          return `<h1 style="font-size: 24px; font-weight: bold; margin-top: 20px; margin-bottom: 10px;">${line.substring(2)}</h1>`;
        } else if (line.startsWith('## ')) {
          return `<h2 style="font-size: 20px; font-weight: bold; margin-top: 16px; margin-bottom: 8px;">${line.substring(3)}</h2>`;
        } else if (line.startsWith('### ')) {
          return `<h3 style="font-size: 16px; font-weight: bold; margin-top: 12px; margin-bottom: 6px;">${line.substring(4)}</h3>`;
        } else if (line.startsWith('**') && line.endsWith('**')) {
          return `<p style="font-weight: bold; margin: 8px 0;">${line.substring(2, line.length - 2)}</p>`;
        } else if (line.trim() === '') {
          return '<br>';
        } else {
          return `<p style="margin: 4px 0; line-height: 1.6;">${line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`;
        }
      })
      .join('');

    const policy = currentPreviewPolicyId ? policies.find(p => p.policyId === currentPreviewPolicyId) : null;
    const filename = policy?.filename || 'document';
    const accreditationText = accreditation ? ` (${accreditation})` : '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${filename}${accreditationText}</title>
        <style>
          body {
            font-family: 'Times New Roman', serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
            color: #000;
          }
          @media print {
            body { margin: 0; padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 10px;">
          <h1 style="margin: 0; font-size: 28px;">${filename.replace(/\.pdf$/i, '')}</h1>
          ${accreditation ? `<p style="margin: 10px 0; font-size: 14px;">Accreditation Standard: ${accreditation}</p>` : ''}
        </div>
        <div style="text-align: left;">
          ${formattedText}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print();
      // Close window after a delay
      setTimeout(() => printWindow.close(), 1000);
    }, 500);

    toast({
      title: tr('نجاح', 'Success'),
      description: tr('جاري فتح نافذة الطباعة لحفظ كـ PDF', 'Opening print dialog to save as PDF'),
    });
  }
  
  // Format policy text for better display (basic markdown-like rendering)
  function formatPolicyText(text: string): React.ReactElement[] {
    if (!text) return [];
    
    const lines = text.split('\n');
    const elements: React.ReactElement[] = [];
    
    lines.forEach((line, index) => {
      const key = `line-${index}`;
      
      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={key} className="text-2xl font-bold mt-6 mb-3 text-foreground">
            {line.substring(2)}
          </h1>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={key} className="text-xl font-semibold mt-5 mb-2 text-foreground">
            {line.substring(3)}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={key} className="text-lg font-semibold mt-4 mb-2 text-foreground">
            {line.substring(4)}
          </h3>
        );
      } else if (line.trim() === '') {
        elements.push(<br key={key} />);
      } else {
        // Process bold text **text**
        const parts: (string | React.ReactElement)[] = [];
        let lastIndex = 0;
        const boldRegex = /\*\*(.*?)\*\*/g;
        let match;
        
        while ((match = boldRegex.exec(line)) !== null) {
          if (match.index > lastIndex) {
            parts.push(line.substring(lastIndex, match.index));
          }
          parts.push(<strong key={`bold-${match.index}`} className="font-semibold">{match[1]}</strong>);
          lastIndex = match.index + match[0].length;
        }
        if (lastIndex < line.length) {
          parts.push(line.substring(lastIndex));
        }
        
        elements.push(
          <p key={key} className="mb-2 text-sm leading-relaxed text-foreground">
            {parts.length > 0 ? parts : line}
          </p>
        );
      }
    });
    
    return elements;
  }

  async function handleRewriteAll(policyId?: string, accreditation?: string) {
    // Determine which policy to rewrite
    let targetPolicyId = policyId;
    
    // Check if policy is already rewritten
    if (targetPolicyId && rewrittenPolicies[targetPolicyId]) {
      // Policy already rewritten, just show it
      const rewritten = rewrittenPolicies[targetPolicyId];
      setRewrittenPolicy(rewritten.text);
      setCurrentPreviewPolicyId(rewritten.policyId);
      setIsPreviewOpen(true);
      toast({
        title: tr('معلومة', 'Info'),
        description: tr('عرض المستند المعاد كتابته سابقاً', 'Showing previously rewritten document') + `: ${rewritten.filename}`,
      });
      return;
    }

    if (mode === 'single') {
      if (!selectedPolicyA || issues.length === 0) {
        toast({
          title: tr('خطأ', 'Error'),
          description: tr('يرجى فحص مستند واحد أولاً والتأكد من وجود مشاكل', 'Please scan a single document first and ensure issues are found'),
          variant: 'destructive',
        });
        return;
      }
      targetPolicyId = selectedPolicyA;
      
      // Check if already rewritten
      if (rewrittenPolicies[targetPolicyId]) {
        const rewritten = rewrittenPolicies[targetPolicyId];
        setRewrittenPolicy(rewritten.text);
        setCurrentPreviewPolicyId(rewritten.policyId);
        setIsPreviewOpen(true);
        toast({
          title: tr('معلومة', 'Info'),
          description: tr('عرض المستند المعاد كتابته سابقاً', 'Showing previously rewritten document') + `: ${rewritten.filename}`,
        });
        return;
      }

      // If no accreditation provided, show dialog
      if (!accreditation) {
        setPendingRewritePolicyId(targetPolicyId);
        setIsAccreditationDialogOpen(true);
        return;
      }
    } else if (mode === 'pair') {
      if (!selectedPolicyA || !selectedPolicyB || issues.length === 0) {
        toast({
          title: tr('خطأ', 'Error'),
          description: tr('يرجى مقارنة مستندين أولاً والتأكد من وجود مشاكل', 'Please compare two documents first and ensure issues are found'),
          variant: 'destructive',
        });
        return;
      }
      // If no specific policyId provided, rewrite both (if not already rewritten)
      if (!targetPolicyId) {
        // Check which policies need rewriting
        const needsRewriteA = !rewrittenPolicies[selectedPolicyA];
        const needsRewriteB = !rewrittenPolicies[selectedPolicyB];
        
        if (!needsRewriteA && !needsRewriteB) {
          // Both already rewritten, show selector or first one
          setRewrittenPolicies(prev => prev);
          setCurrentPreviewPolicyId(selectedPolicyA);
          const rewritten = rewrittenPolicies[selectedPolicyA];
          setRewrittenPolicy(rewritten.text);
          setIsPreviewOpen(true);
          toast({
            title: tr('معلومة', 'Info'),
            description: tr('تمت إعادة كتابة كلا المستندين. عرض المستند الأول.', 'Both documents have been rewritten. Showing first document.'),
          });
          return;
        }

        // For pair mode, we need to show accreditation dialog for first policy that needs rewriting
        // This is handled in the dialog - we'll rewrite one at a time
        if (needsRewriteA) {
          setPendingRewritePolicyId(selectedPolicyA);
          setIsAccreditationDialogOpen(true);
          return;
        } else if (needsRewriteB) {
          setPendingRewritePolicyId(selectedPolicyB);
          setIsAccreditationDialogOpen(true);
          return;
        } else {
          // Both already rewritten, show first one
          const rewritten = rewrittenPolicies[selectedPolicyA];
          setRewrittenPolicy(rewritten.text);
          setCurrentPreviewPolicyId(rewritten.policyId);
          setIsPreviewOpen(true);
          toast({
            title: tr('معلومة', 'Info'),
            description: tr('تمت إعادة كتابة كلا المستندين. عرض المستند الأول.', 'Both documents have been rewritten. Showing first document.'),
          });
          return;
        }
      }

      // Check if specific policy is already rewritten
      if (rewrittenPolicies[targetPolicyId]) {
        const rewritten = rewrittenPolicies[targetPolicyId];
        setRewrittenPolicy(rewritten.text);
        setCurrentPreviewPolicyId(rewritten.policyId);
        setIsPreviewOpen(true);
        toast({
          title: tr('معلومة', 'Info'),
          description: tr('عرض المستند المعاد كتابته سابقاً', 'Showing previously rewritten document') + `: ${rewritten.filename}`,
        });
        return;
      }
    } else if (mode === 'global') {
      if (issues.length === 0) {
        toast({
          title: tr('خطأ', 'Error'),
          description: tr('يرجى تشغيل فحص شامل أولاً والتأكد من وجود مشاكل', 'Please run a global scan first and ensure issues are found'),
          variant: 'destructive',
        });
        return;
      }
      // For global mode, show policy selector if no specific policyId provided
      if (!targetPolicyId) {
        const policiesWithIssues = getPoliciesWithIssues();
        if (policiesWithIssues.length === 0) {
          toast({
            title: tr('خطأ', 'Error'),
            description: tr('لا توجد مستندات بها مشاكل', 'No documents with issues found'),
            variant: 'destructive',
          });
          return;
        }
        // Filter out already rewritten policies, but still show them in selector
        const needsRewrite = policiesWithIssues.filter(p => !rewrittenPolicies[p.policyId]);
        if (needsRewrite.length === 0) {
          // All policies already rewritten, show first one
          const firstPolicy = policiesWithIssues[0];
          const rewritten = rewrittenPolicies[firstPolicy.policyId];
          setRewrittenPolicy(rewritten.text);
          setCurrentPreviewPolicyId(rewritten.policyId);
          setPendingRewritePolicies(policiesWithIssues);
          setCurrentRewriteIndex(0);
          setIsPreviewOpen(true);
          toast({
            title: tr('معلومة', 'Info'),
            description: tr('تمت إعادة كتابة جميع المستندات. عرض المستند الأول.', 'All documents have been rewritten. Showing first document.'),
          });
          return;
        }
        // Store pending policies and open selector
        setPendingRewritePolicies(policiesWithIssues);
        setCurrentRewriteIndex(0);
        setIsPolicySelectorOpen(true);
        return;
      }
      
      // Check if specific policy is already rewritten
      if (rewrittenPolicies[targetPolicyId]) {
        const rewritten = rewrittenPolicies[targetPolicyId];
        setRewrittenPolicy(rewritten.text);
        setCurrentPreviewPolicyId(rewritten.policyId);
        setIsPreviewOpen(true);
        toast({
          title: tr('معلومة', 'Info'),
          description: tr('عرض المستند المعاد كتابته سابقاً', 'Showing previously rewritten document') + `: ${rewritten.filename}`,
        });
        return;
      }

      // Update currentRewriteIndex if this policy is in the pending list
      if (mode === 'global' && pendingRewritePolicies.length > 0) {
        const index = pendingRewritePolicies.findIndex(p => p.policyId === targetPolicyId);
        if (index >= 0) {
          setCurrentRewriteIndex(index);
        }
      }
    } else {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('وضع فحص غير صالح', 'Invalid scan mode'),
        variant: 'destructive',
      });
      return;
    }

    // Get issues for the target policy
    const policyIssues = issues.filter((issue) => 
      issue.policyA.policyId === targetPolicyId || 
      (issue.policyB && issue.policyB.policyId === targetPolicyId)
    );
    
    if (policyIssues.length === 0) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('لا توجد مشاكل للمستند المحدد', 'No issues found for the selected policy'),
        variant: 'destructive',
      });
      return;
    }

    // If no accreditation provided and we have a target policy, show dialog
    if (!accreditation && targetPolicyId) {
      setPendingRewritePolicyId(targetPolicyId);
      setIsAccreditationDialogOpen(true);
      return;
    }
    
    setIsRewriting(true);
    try {
      const response = await fetch(`/api/sam/thea-engine/policies/${targetPolicyId}/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mode: 'apply_all',
          issues: policyIssues.map((issue) => ({
            issueId: issue.issueId,
            severity: issue.severity,
            type: issue.type,
            summary: issue.summary,
            recommendation: issue.recommendation,
            locationA: {
              pageNumber: issue.locationA.pageNumber,
              lineStart: issue.locationA.lineStart,
              lineEnd: issue.locationA.lineEnd,
              snippet: issue.locationA.snippet,
            },
            locationB: issue.locationB
              ? {
                  pageNumber: issue.locationB.pageNumber,
                  lineStart: issue.locationB.lineStart,
                  lineEnd: issue.locationB.lineEnd,
                  snippet: issue.locationB.snippet,
                }
              : null,
          })),
          language: 'auto',
          standard: accreditation, // Pass accreditation/standard to API
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rewrittenText = data.updatedPolicyText || data.policyText || '';
        
        // Find the policy filename
        const policy = policies.find(p => p.policyId === targetPolicyId);
        const filename = policy?.filename || targetPolicyId;
        
        // Store rewritten policy with accreditation
        const updatedPolicies = {
          ...rewrittenPolicies,
          [targetPolicyId!]: {
            policyId: targetPolicyId!,
            filename,
            text: rewrittenText,
            accreditation: accreditation || undefined,
          }
        };
        setRewrittenPolicies(updatedPolicies);
        
        // For single mode, show preview immediately
        if (mode === 'single') {
          setRewrittenPolicy(rewrittenText);
          setCurrentPreviewPolicyId(targetPolicyId!);
          setIsPreviewOpen(true);
        } else if (mode === 'pair') {
          // For pair mode, set current preview
          setCurrentPreviewPolicyId(targetPolicyId!);
          // Check if both policies are rewritten
          const allPolicyIds = [selectedPolicyA, selectedPolicyB].filter(Boolean);
          const rewrittenIds = Object.keys(updatedPolicies);
          if (allPolicyIds.every(id => rewrittenIds.includes(id))) {
            setIsPreviewOpen(true);
          }
        } else if (mode === 'global') {
          // For global mode, show preview immediately and allow navigation to next
          setRewrittenPolicy(rewrittenText);
          setCurrentPreviewPolicyId(targetPolicyId!);
          setIsPreviewOpen(true);
        }
        
        toast({
          title: tr('نجاح', 'Success'),
          description: `${tr('تمت إعادة كتابة المستند بنجاح', 'Policy rewritten successfully')}: "${filename}"${accreditation ? ` (${accreditation})` : ''}`,
        });
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Rewrite failed' }));
        throw new Error(errorData.error || 'Failed to rewrite document');
      }
    } catch (error: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error.message || tr('فشل إعادة كتابة المستند', 'Failed to rewrite document'),
        variant: 'destructive',
      });
    } finally {
      setIsRewriting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{tr('التعارضات والمشاكل', 'Conflicts & Issues')}</h1>
        <p className="text-muted-foreground">
          {tr('فحص المستندات للكشف عن التعارضات والثغرات والتكرارات والتناقضات', 'Scan documents for conflicts, gaps, duplicates, and inconsistencies')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tr('إعدادات الفحص', 'Scan Configuration')}</CardTitle>
          <CardDescription>{tr('اختر الوضع وضبط معاملات الفحص', 'Select mode and configure scan parameters')}</CardDescription>
        </CardHeader>
        {serviceUnavailable && (
          <div className="px-6 pb-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                <span className="font-medium">{tr('محرك المستندات غير متصل.', 'Document engine is offline.')}</span> {tr('الميزات التلقائية معطلة.', 'Automated features are disabled.')}
              </p>
            </div>
          </div>
        )}
        <CardContent>
          <div className="space-y-6">
            {/* Mode Selector Tabs */}
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'single' | 'pair' | 'global')}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="single">{tr('مستند واحد', 'Single Policy')}</TabsTrigger>
                <TabsTrigger value="pair">{tr('مقارنة اثنين', 'Compare Two')}</TabsTrigger>
                <TabsTrigger value="global">{tr('فحص شامل', 'Global Scan')}</TabsTrigger>
              </TabsList>

              <TabsContent value="single" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>{tr('المستند', 'Policy')}</Label>
                  <Select value={selectedPolicyA} onValueChange={setSelectedPolicyA}>
                    <SelectTrigger>
                      <SelectValue placeholder={tr('اختر مستند', 'Select a document')} />
                    </SelectTrigger>
                    <SelectContent>
                      {policies.map((policy) => (
                        <SelectItem key={policy.policyId} value={policy.policyId}>
                          {policy.filename}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleScan} disabled={isScanning || !selectedPolicyA}>
                  {isScanning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {tr('جاري الفحص...', 'Scanning...')}
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      {tr('فحص المستند', 'Scan Policy')}
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="pair" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{tr('المستند أ', 'Policy A')}</Label>
                    <Select value={selectedPolicyA} onValueChange={setSelectedPolicyA}>
                      <SelectTrigger>
                        <SelectValue placeholder={tr('اختر المستند الأول', 'Select Policy A')} />
                      </SelectTrigger>
                      <SelectContent>
                        {policies.map((policy) => (
                          <SelectItem key={policy.policyId} value={policy.policyId}>
                            {policy.filename}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{tr('المستند ب', 'Policy B')}</Label>
                    <Select value={selectedPolicyB} onValueChange={setSelectedPolicyB}>
                      <SelectTrigger>
                        <SelectValue placeholder={tr('اختر المستند الثاني', 'Select Policy B')} />
                      </SelectTrigger>
                      <SelectContent>
                        {policies.map((policy) => (
                          <SelectItem key={policy.policyId} value={policy.policyId}>
                            {policy.filename}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={handleScan}
                  disabled={isScanning || !selectedPolicyA || !selectedPolicyB}
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {tr('جاري المقارنة...', 'Comparing...')}
                    </>
                  ) : (
                    <>
                      <AlertCircle className="mr-2 h-4 w-4" />
                      {tr('مقارنة', 'Compare')}
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="global" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>{tr('تحديد أعلى N مستند (اختياري)', 'Limit Top N Policies (optional)')}</Label>
                  <Input
                    type="number"
                    min="5"
                    max="100"
                    value={limitPolicies}
                    onChange={(e) => setLimitPolicies(parseInt(e.target.value) || 20)}
                  />
                </div>
                <Button onClick={handleScan} disabled={isScanning}>
                  {isScanning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {tr('جاري فحص جميع المستندات...', 'Scanning All Documents...')}
                    </>
                  ) : (
                    <>
                      <AlertCircle className="mr-2 h-4 w-4" />
                      {tr('فحص جميع المستندات', 'Scan All Documents')}
                    </>
                  )}
                </Button>
              </TabsContent>
            </Tabs>

            {/* Shared Filters */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>{tr('الفئة (اختياري)', 'Category (optional)')}</Label>
                <Input
                  placeholder={tr('تصفية حسب الفئة', 'Filter by category')}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{tr('صرامة الصلة', 'Relevance Strictness')}</Label>
                <Select value={strictness} onValueChange={(v: 'Strict' | 'Balanced') => setStrictness(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Strict">{tr('صارم', 'Strict')}</SelectItem>
                    <SelectItem value="Balanced">{tr('متوازن', 'Balanced')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

          {/* Review Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {tr('مراجعة النظام', 'System Review')}
          </CardTitle>
          <CardDescription>
            {tr('يحلل النظام المستندات للكشف عن التعارضات والثغرات والغموض والمخاطر', 'The system analyzes documents for conflicts, gaps, ambiguities, and risks')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{tr('استعلام', 'Query')}</Label>
              <Textarea
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder={tr('ابحث عن التعارضات والثغرات والمخاطر في هذه المستندات', 'Find conflicts, gaps, and risks in these documents')}
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label>{tr('المستندات (اختياري - اتركه فارغاً للبحث في الكل)', 'Documents (optional - leave empty to search all)')}</Label>
              <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                {policies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{tr('لا توجد مستندات متاحة', 'No documents available')}</p>
                ) : (
                  policies.map((policy) => (
                    <label key={policy.policyId} className="flex items-center space-x-2 cursor-pointer hover:bg-muted p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedPoliciesForAI.includes(policy.policyId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPoliciesForAI([...selectedPoliciesForAI, policy.policyId]);
                          } else {
                            setSelectedPoliciesForAI(selectedPoliciesForAI.filter(id => id !== policy.policyId));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{policy.filename}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <Button onClick={handleAIRun} disabled={isAIRunning || !aiQuery.trim()}>
              {isAIRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tr('جاري التحليل...', 'Analyzing...')}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {tr('تشغيل المراجعة', 'Run Review')}
                </>
              )}
            </Button>

            {aiMeta && (
              <div className="text-sm text-muted-foreground">
                {tr('تم استرجاع', 'Retrieved')} {aiMeta.retrievedChunks || 0} {tr('جزء', 'chunks')}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Review Results */}
      {aiIssues.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>{tr('نتائج المراجعة', 'Review Results')}</CardTitle>
                <CardDescription>{aiIssues.length} {tr('مشكلة مكتشفة', 'issue(s) detected')}</CardDescription>
              </div>
              <Button
                onClick={() => handleAIRewriteAll()}
                disabled={isAIRewriting}
                className="gap-2"
              >
                {isAIRewriting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {tr('جاري الكتابة...', 'Rewriting...')}
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    {tr('إعادة كتابة المستند', 'Rewrite Document')}
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {aiIssues.map((issue, idx) => (
                <div key={idx} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={getAISeverityColor(issue.severity)}>
                          {issue.severity}
                        </Badge>
                        <Badge variant={getAITypeColor(issue.type)}>
                          {issue.type}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-lg">{issue.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{issue.summary}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedAIIssue(issue);
                          setIsAIDetailsOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {tr('تفاصيل', 'Details')}
                      </Button>
                      {issue.evidence && issue.evidence.length > 0 && aiRewrittenPolicies[issue.evidence[0].policyId] && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            const rewritten = aiRewrittenPolicies[issue.evidence[0].policyId];
                            setRewrittenPolicy(rewritten.text);
                            setCurrentPreviewPolicyId(rewritten.policyId);
                            setIsPreviewOpen(true);
                          }}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          {tr('عرض المعاد كتابته', 'View Rewritten')}
                        </Button>
                      )}
                    </div>
                  </div>

                  {issue.evidence && issue.evidence.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="text-sm font-medium">{tr('الأدلة:', 'Evidence:')}</div>
                      {issue.evidence.slice(0, 2).map((ev, evIdx) => (
                        <div key={evIdx} className="text-xs bg-muted p-2 rounded">
                          <div className="font-medium">
                            {ev.filename}
                            {ev.page !== null && ` (${tr('صفحة', 'Page')} ${ev.page})`}
                          </div>
                          <div className="mt-1 text-muted-foreground line-clamp-2">
                            {ev.quote}
                          </div>
                        </div>
                      ))}
                      {issue.evidence.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{issue.evidence.length - 2} {tr('عنصر إضافي', 'more evidence item(s)')}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="text-sm">
                      <span className="font-medium">{tr('التوصية:', 'Recommendation:')}</span>
                      <p className="text-muted-foreground mt-1">{issue.recommendation}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyRecommendation(issue)}
                    >
                      {copiedRecommendation === issue.title ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          {tr('تم النسخ', 'Copied')}
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1" />
                          {tr('نسخ', 'Copy')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rewrite Document Selector Dialog */}
      <Dialog open={isAIRewriteSelectorOpen} onOpenChange={setIsAIRewriteSelectorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{tr('اختر المستند لإعادة الكتابة', 'Select Document to Rewrite')}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-2 max-h-[60vh] overflow-y-auto">
            {pendingAIRewritePolicies.map((policy, index) => {
              const isAlreadyRewritten = aiRewrittenPolicies[policy.policyId];
              const policyIssues = aiIssues.filter((issue) =>
                issue.evidence.some((ev) => ev.policyId === policy.policyId)
              );
              
              return (
                <div
                  key={policy.policyId}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    index === currentAIRewriteIndex
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-border'
                  } ${isAlreadyRewritten ? 'bg-green-50 dark:bg-green-950/20' : ''}`}
                  onClick={() => setCurrentAIRewriteIndex(index)}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{policy.filename}</h3>
                        {isAlreadyRewritten && (
                          <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            {tr('تمت إعادة الكتابة', 'Already Rewritten')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {policyIssues.length} {tr('مشكلة', 'issue(s) found')}
                      </p>
                      <div className="mt-2 space-y-1">
                        {policyIssues.slice(0, 2).map((issue, idx) => (
                          <div key={idx} className="text-xs text-muted-foreground">
                            • {issue.title} ({issue.severity})
                          </div>
                        ))}
                        {policyIssues.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{policyIssues.length - 2} {tr('مشاكل أخرى', 'more issue(s)')}
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge variant={index === currentAIRewriteIndex ? 'default' : 'outline'}>
                      {index + 1} / {pendingAIRewritePolicies.length}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsAIRewriteSelectorOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button
              onClick={async () => {
                if (currentAIRewriteIndex < pendingAIRewritePolicies.length) {
                  const selectedPolicy = pendingAIRewritePolicies[currentAIRewriteIndex];
                  setIsAIRewriteSelectorOpen(false);

                  // Check if already rewritten
                  if (aiRewrittenPolicies[selectedPolicy.policyId]) {
                    const rewritten = aiRewrittenPolicies[selectedPolicy.policyId];
                    setRewrittenPolicy(rewritten.text);
                    setCurrentPreviewPolicyId(rewritten.policyId);
                    setIsPreviewOpen(true);
                    toast({
                      title: tr('معلومة', 'Info'),
                      description: tr('عرض المستند المعاد كتابته سابقاً', 'Showing previously rewritten document') + `: ${rewritten.filename}`,
                    });
                  } else {
                    // Show accreditation dialog first
                    setPendingRewritePolicyId(selectedPolicy.policyId);
                    setIsAccreditationDialogOpen(true);
                  }
                }
              }}
              disabled={isAIRewriting}
            >
              {isAIRewriting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {tr('جاري الكتابة...', 'Rewriting...')}
                </>
              ) : (
                <>
                  {aiRewrittenPolicies[pendingAIRewritePolicies[currentAIRewriteIndex]?.policyId]
                    ? tr('عرض المستند المعاد كتابته', 'View Rewritten Document')
                    : tr('إعادة كتابة هذا المستند', 'Rewrite This Document')}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Accreditation Selection Dialog */}
      <Dialog open={isAccreditationDialogOpen} onOpenChange={setIsAccreditationDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr('اختر معايير الاعتماد/الشهادات', 'Select Accreditation/Certification Standards')}</DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              {tr('اختر واحداً أو أكثر من الاعتمادات/الشهادات لتطبيقها على إعادة كتابة المستند', 'Select one or more accreditations/certifications to apply to this document rewrite')}
            </p>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* International Accreditations */}
            <div>
              <Label className="text-base font-semibold mb-3 block">{tr('اعتمادات دولية', 'International Accreditations')}</Label>
              <div className="space-y-2">
                {accreditationOptions.filter(opt => opt.category === 'International').map((option) => (
                  <div key={option.id} className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50">
                    <Checkbox
                      id={option.id}
                      checked={selectedAccreditations.includes(option.id)}
                      onCheckedChange={() => toggleAccreditation(option.id)}
                    />
                    <label
                      htmlFor={option.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Regional/Local Accreditations */}
            <div>
              <Label className="text-base font-semibold mb-3 block">{tr('اعتمادات إقليمية/محلية', 'Regional/Local Accreditations')}</Label>
              <div className="space-y-2">
                {accreditationOptions.filter(opt => opt.category === 'Regional/Local').map((option) => (
                  <div key={option.id} className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50">
                    <Checkbox
                      id={option.id}
                      checked={selectedAccreditations.includes(option.id)}
                      onCheckedChange={() => toggleAccreditation(option.id)}
                    />
                    <label
                      htmlFor={option.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Accreditation */}
            <div className="pt-2 border-t">
              <Label className="text-base font-semibold mb-3 block">{tr('أخرى (مخصصة)', 'Other (Custom)')}</Label>
              <div className="flex items-center space-x-2">
                <Input
                  placeholder={tr('أدخل اسم الاعتماد/الشهادة المخصصة', 'Enter custom accreditation/certification name')}
                  value={customAccreditation}
                  onChange={(e) => setCustomAccreditation(e.target.value)}
                  className="flex-1"
                />
              </div>
              {customAccreditation.trim() && (
                <p className="text-xs text-muted-foreground mt-1">
                  {tr('سيتم تضمين الاعتماد المخصص:', 'Custom accreditation will be included:')} &quot;{customAccreditation}&quot;
                </p>
              )}
            </div>

            {/* Selected Count */}
            {selectedAccreditations.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  {selectedAccreditations.length} {tr('اعتماد محدد', 'accreditation(s) selected')}
                </p>
              </div>
            )}
            
            <div className="flex gap-2 justify-end pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsAccreditationDialogOpen(false);
                  setPendingRewritePolicyId(null);
                  setCustomAccreditation('');
                }}
              >
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button onClick={handleAccreditationConfirm}>
                {tr('متابعة', 'Continue')} ({selectedAccreditations.length + (customAccreditation.trim() ? 1 : 0)})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Issue Details Dialog */}
      <Dialog open={isAIDetailsOpen} onOpenChange={setIsAIDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {tr('تفاصيل المشكلة', 'Issue Details')}
              {selectedAIIssue && (
                <div className="flex gap-2 mt-2">
                  <Badge variant={getAISeverityColor(selectedAIIssue.severity)}>
                    {selectedAIIssue.severity}
                  </Badge>
                  <Badge variant={getAITypeColor(selectedAIIssue.type)}>
                    {selectedAIIssue.type}
                  </Badge>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedAIIssue && (
            <div className="space-y-4 mt-4">
              <div>
                <h3 className="font-semibold mb-2">{tr('العنوان', 'Title')}</h3>
                <p className="text-sm">{selectedAIIssue.title}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">{tr('الملخص', 'Summary')}</h3>
                <p className="text-sm">{selectedAIIssue.summary}</p>
              </div>

              {selectedAIIssue.evidence && selectedAIIssue.evidence.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">{tr('الأدلة', 'Evidence')} ({selectedAIIssue.evidence.length} {tr('عنصر', 'item(s)')})</h3>
                  <div className="space-y-3">
                    {selectedAIIssue.evidence.map((ev, idx) => (
                      <div key={idx} className="p-3 bg-muted rounded text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{ev.filename}</Badge>
                          {ev.page !== null && (
                            <Badge variant="outline">{tr('صفحة', 'Page')} {ev.page}</Badge>
                          )}
                          <Badge variant="outline" className="font-mono text-xs">
                            {ev.chunkId.substring(0, 16)}...
                          </Badge>
                        </div>
                        <div className="mt-2 p-2 bg-background rounded border">
                          {ev.quote}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">{tr('التوصية', 'Recommendation')}</h3>
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800 flex items-start justify-between">
                  <p className="text-sm flex-1">{selectedAIIssue.recommendation}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyRecommendation(selectedAIIssue)}
                    className="ml-2"
                  >
                    {copiedRecommendation === selectedAIIssue.title ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        {tr('تم النسخ', 'Copied')}
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        {tr('نسخ', 'Copy')}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {selectedAIIssue.evidence && selectedAIIssue.evidence.length > 0 && (
                <div className="pt-4 border-t flex gap-2">
                  <Button
                    onClick={async () => {
                      setIsAIDetailsOpen(false);
                      const policyId = selectedAIIssue.evidence[0].policyId;
                      if (aiRewrittenPolicies[policyId]) {
                        const rewritten = aiRewrittenPolicies[policyId];
                        setRewrittenPolicy(rewritten.text);
                        setCurrentPreviewPolicyId(rewritten.policyId);
                        setIsPreviewOpen(true);
                        toast({
                          title: tr('معلومة', 'Info'),
                          description: tr('عرض المستند المعاد كتابته سابقاً', 'Showing previously rewritten document') + `: ${rewritten.filename}`,
                        });
                      } else {
                        // Show accreditation dialog first
                        setPendingRewritePolicyId(policyId);
                        setIsAccreditationDialogOpen(true);
                      }
                    }}
                    disabled={isAIRewriting}
                    className="flex-1"
                  >
                    {isAIRewriting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {tr('جاري الكتابة...', 'Rewriting...')}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {tr('إعادة كتابة المستند', 'Rewrite Document')}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Results */}
      {issues.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>{tr('المشاكل المكتشفة', 'Issues Found')}</CardTitle>
                <CardDescription>{issues.length} {tr('مشكلة مكتشفة', 'issue(s) detected')}</CardDescription>
              </div>
              {((mode === 'single' && selectedPolicyA) || (mode === 'pair' && selectedPolicyA && selectedPolicyB) || mode === 'global') && (
                <Button
                  onClick={() => handleRewriteAll()}
                  disabled={isRewriting}
                  className="gap-2"
                >
                  {isRewriting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {tr('جاري الكتابة...', 'Rewriting...')}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      {mode === 'pair'
                        ? tr('إعادة كتابة كلا المستندين (تطبيق جميع المشاكل)', 'Rewrite Both Documents (Apply All Issues)')
                        : mode === 'global'
                        ? tr('إعادة كتابة المستندات (تطبيق جميع المشاكل)', 'Rewrite Documents (Apply All Issues)')
                        : tr('إعادة كتابة المستند (تطبيق جميع المشاكل)', 'Rewrite Document (Apply All Issues)')}
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('الخطورة', 'Severity')}</TableHead>
                  <TableHead>{tr('النوع', 'Type')}</TableHead>
                  <TableHead>{tr('الملخص', 'Summary')}</TableHead>
                  <TableHead>{tr('المستندات', 'Documents')}</TableHead>
                  <TableHead>{tr('المواقع', 'Locations')}</TableHead>
                  <TableHead>{tr('الإجراءات', 'Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIssues.map((issue) => (
                  <TableRow key={issue.issueId}>
                    <TableCell>
                      <Badge variant={getSeverityColor(issue.severity)}>
                        {issue.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getTypeColor(issue.type)}>
                        {issue.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md">{issue.summary}</TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div>
                          <span className="font-medium">A:</span> {issue.policyA.filename}
                        </div>
                        {issue.policyB && (
                          <div>
                            <span className="font-medium">B:</span> {issue.policyB.filename}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div>
                          {tr('صفحة', 'Page')} {issue.locationA.pageNumber}, {tr('سطور', 'Lines')} {issue.locationA.lineStart}-
                          {issue.locationA.lineEnd}
                        </div>
                        {issue.locationB && (
                          <div>
                            {tr('صفحة', 'Page')} {issue.locationB.pageNumber}, {tr('سطور', 'Lines')} {issue.locationB.lineStart}-
                            {issue.locationB.lineEnd}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedIssue(issue);
                            setIsDetailsOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {tr('عرض التفاصيل', 'View Details')}
                        </Button>
                        {rewrittenPolicies[issue.policyA.policyId] && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              const rewritten = rewrittenPolicies[issue.policyA.policyId];
                              setRewrittenPolicy(rewritten.text);
                              setCurrentPreviewPolicyId(rewritten.policyId);
                              setIsPreviewOpen(true);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            {tr('عرض المعاد كتابته', 'View Rewritten')}
                          </Button>
                        )}
                        {issue.policyB && rewrittenPolicies[issue.policyB.policyId] && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              const rewritten = rewrittenPolicies[issue.policyB!.policyId];
                              setRewrittenPolicy(rewritten.text);
                              setCurrentPreviewPolicyId(rewritten.policyId);
                              setIsPreviewOpen(true);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            {tr('عرض المعاد كتابته', 'View Rewritten')} B
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {tr('تفاصيل المشكلة', 'Issue Details')}
              {selectedIssue && (
                <div className="flex gap-2 mt-2">
                  <Badge variant={getSeverityColor(selectedIssue.severity)}>
                    {selectedIssue.severity}
                  </Badge>
                  <Badge variant={getTypeColor(selectedIssue.type)}>
                    {selectedIssue.type}
                  </Badge>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedIssue && (
            <div className="space-y-4 mt-4">
              <div>
                <h3 className="font-semibold mb-2">{tr('الملخص', 'Summary')}</h3>
                <p className="text-sm">{selectedIssue.summary}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">{tr('المستندات المعنية', 'Policies Involved')}</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">{tr('المستند أ:', 'Policy A:')}</span> {selectedIssue.policyA.filename}
                    <Badge variant="outline" className="ml-2 font-mono text-xs">
                      {selectedIssue.policyA.policyId.substring(0, 8)}...
                    </Badge>
                  </div>
                  {selectedIssue.policyB && (
                    <div>
                      <span className="font-medium">{tr('المستند ب:', 'Policy B:')}</span> {selectedIssue.policyB.filename}
                      <Badge variant="outline" className="ml-2 font-mono text-xs">
                        {selectedIssue.policyB.policyId.substring(0, 8)}...
                      </Badge>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">{tr('الموقع أ', 'Location A')}</h3>
                <div className="p-3 bg-muted rounded text-sm space-y-1">
                  <div>
                    <Badge variant="outline">{tr('صفحة', 'Page')} {selectedIssue.locationA.pageNumber}</Badge>
                    <Badge variant="outline" className="ml-2">
                      {tr('سطور', 'Lines')} {selectedIssue.locationA.lineStart}-{selectedIssue.locationA.lineEnd}
                    </Badge>
                  </div>
                  <div className="mt-2 p-2 bg-background rounded border">
                    {selectedIssue.locationA.snippet}
                  </div>
                </div>
              </div>

              {selectedIssue.locationB && (
                <div>
                  <h3 className="font-semibold mb-2">{tr('الموقع ب', 'Location B')}</h3>
                  <div className="p-3 bg-muted rounded text-sm space-y-1">
                    <div>
                      <Badge variant="outline">{tr('صفحة', 'Page')} {selectedIssue.locationB.pageNumber}</Badge>
                      <Badge variant="outline" className="ml-2">
                        {tr('سطور', 'Lines')} {selectedIssue.locationB.lineStart}-{selectedIssue.locationB.lineEnd}
                      </Badge>
                    </div>
                    <div className="mt-2 p-2 bg-background rounded border">
                      {selectedIssue.locationB.snippet}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">{tr('الحل الموصى به', 'Recommended Resolution')}</h3>
                <p className="text-sm p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
                  {selectedIssue.recommendation}
                </p>
              </div>

              <div className="pt-4 border-t flex gap-2">
                <Button
                  onClick={async () => {
                    setIsDetailsOpen(false);
                    await handleRewriteAll();
                  }}
                  disabled={isRewriting}
                  className="flex-1"
                >
                  {isRewriting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {tr('جاري الكتابة...', 'Rewriting...')}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {tr('إعادة كتابة المستند باستخدام جميع المشاكل', 'Rewrite Policy Using ALL Issues')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rewritten Policy Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === 'pair' && Object.keys(rewrittenPolicies).length > 1
                ? tr('معاينة المستندات المعاد كتابتها', 'Rewritten Documents Preview')
                : mode === 'global'
                ? `${tr('معاينة المستند المعاد كتابته', 'Rewritten Policy Preview')} (${currentRewriteIndex + 1} / ${pendingRewritePolicies.length})`
                : tr('معاينة المستند المعاد كتابته', 'Rewritten Document Preview')}
            </DialogTitle>
          </DialogHeader>
          {mode === 'pair' && Object.keys(rewrittenPolicies).length > 1 ? (
            // Pair mode: Show tabs for multiple policies
            <div className="mt-4">
              {(() => {
                // Sort policies by filename alphabetically (natural sort for numbers)
                const sortedPolicies = Object.values(rewrittenPolicies).sort((a, b) => {
                  const filenameA = (a.filename || '').toLowerCase().trim();
                  const filenameB = (b.filename || '').toLowerCase().trim();
                  // Use natural sort (handles numbers correctly)
                  return filenameA.localeCompare(filenameB, undefined, { 
                    numeric: true, 
                    sensitivity: 'base' 
                  });
                });
                const firstPolicyId = sortedPolicies[0]?.policyId || Object.keys(rewrittenPolicies)[0];
                
                return (
                  <Tabs value={currentPreviewPolicyId || firstPolicyId} onValueChange={setCurrentPreviewPolicyId}>
                    <TabsList className="flex flex-wrap w-full gap-1">
                      {sortedPolicies.map((policy) => (
                        <TabsTrigger 
                          key={policy.policyId} 
                          value={policy.policyId} 
                          className="text-xs px-3 py-2 flex-1 min-w-0 truncate"
                        >
                          {policy.filename}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {sortedPolicies.map((policy) => (
                      <TabsContent key={policy.policyId} value={policy.policyId} className="mt-4">
                        <div className="p-6 bg-muted rounded-lg max-h-[60vh] overflow-y-auto border">
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            {formatPolicyText(policy.text)}
                          </div>
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                );
              })()}
              <div className="mt-4 flex gap-2 justify-end">
                <Button
                  variant="default"
                  onClick={() => {
                    // Reset accreditation selection and show dialog again
                    setSelectedAccreditations(['CBAHI']);
                    setCustomAccreditation('');
                    setPendingRewritePolicyId(currentPreviewPolicyId || null);
                    setIsPreviewOpen(false);
                    setIsAccreditationDialogOpen(true);
                  }}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  {tr('إعادة الكتابة', 'Rewrite Again')}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadText}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  {tr('تحميل نصي', 'Download Text')}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadPDF}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  {tr('تحميل PDF', 'Download PDF')}
                </Button>
                <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            // Single mode, global mode, or single policy in pair mode
            <div className="mt-4">
              {(() => {
                // Determine which policy text to display
                let policyTextToShow = null;
                
                if (currentPreviewPolicyId) {
                  // Try AI rewritten first, then regular rewritten
                  const aiRewritten = aiRewrittenPolicies[currentPreviewPolicyId];
                  const regularRewritten = rewrittenPolicies[currentPreviewPolicyId];
                  
                  if (aiRewritten) {
                    policyTextToShow = aiRewritten.text;
                  } else if (regularRewritten) {
                    policyTextToShow = regularRewritten.text;
                  }
                }
                
                if (!policyTextToShow && rewrittenPolicy) {
                  // Fallback to rewrittenPolicy state
                  policyTextToShow = rewrittenPolicy;
                }
                
                return policyTextToShow ? (
                  <div className="p-6 bg-muted rounded-lg max-h-[60vh] overflow-y-auto border">
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      {formatPolicyText(policyTextToShow)}
                    </div>
                  </div>
                ) : null;
              })()}
              <div className="mt-4 flex gap-2 justify-between items-center">
                {mode === 'global' && currentRewriteIndex > 0 && (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      setIsPreviewOpen(false);
                      const prevPolicy = pendingRewritePolicies[currentRewriteIndex - 1];
                      if (rewrittenPolicies[prevPolicy.policyId]) {
                        // Already rewritten, just show it
                        setRewrittenPolicy(rewrittenPolicies[prevPolicy.policyId].text);
                        setCurrentPreviewPolicyId(prevPolicy.policyId);
                        setCurrentRewriteIndex(currentRewriteIndex - 1);
                        setIsPreviewOpen(true);
                      } else {
                        // Need to rewrite
                        setCurrentRewriteIndex(currentRewriteIndex - 1);
                        await handleRewriteAll(prevPolicy.policyId);
                      }
                    }}
                  >
                    {tr('← المستند السابق', '← Previous Policy')}
                  </Button>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button
                    variant="default"
                    onClick={() => {
                      // Reset accreditation selection and show dialog again
                      setSelectedAccreditations(['CBAHI']);
                      setCustomAccreditation('');
                      setPendingRewritePolicyId(currentPreviewPolicyId);
                      setIsPreviewOpen(false);
                      setIsAccreditationDialogOpen(true);
                    }}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {tr('إعادة الكتابة', 'Rewrite Again')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDownloadText}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {tr('تحميل نصي', 'Download Text')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDownloadPDF}
                    className="gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    {tr('تحميل PDF', 'Download PDF')}
                  </Button>
                  {mode === 'global' && currentRewriteIndex < pendingRewritePolicies.length - 1 && (
                    <Button
                      onClick={async () => {
                        setIsPreviewOpen(false);
                        const nextPolicy = pendingRewritePolicies[currentRewriteIndex + 1];
                        if (rewrittenPolicies[nextPolicy.policyId]) {
                          // Already rewritten, just show it
                          setRewrittenPolicy(rewrittenPolicies[nextPolicy.policyId].text);
                          setCurrentPreviewPolicyId(nextPolicy.policyId);
                          setCurrentRewriteIndex(currentRewriteIndex + 1);
                          setIsPreviewOpen(true);
                        } else {
                          // Need to rewrite
                          setCurrentRewriteIndex(currentRewriteIndex + 1);
                          await handleRewriteAll(nextPolicy.policyId);
                        }
                      }}
                    >
                      {tr('المستند التالي →', 'Next Policy →')}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
                    {tr('إغلاق', 'Close')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Policy Selector Dialog for Global Scan */}
      <Dialog open={isPolicySelectorOpen} onOpenChange={setIsPolicySelectorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{tr('اختر المستند لإعادة الكتابة', 'Select Policy to Rewrite')}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-2 max-h-[60vh] overflow-y-auto">
            {pendingRewritePolicies.map((policy, index) => {
              const isAlreadyRewritten = rewrittenPolicies[policy.policyId];
              return (
                <div
                  key={policy.policyId}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    index === currentRewriteIndex
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-border'
                  } ${isAlreadyRewritten ? 'bg-green-50 dark:bg-green-950/20' : ''}`}
                  onClick={() => setCurrentRewriteIndex(index)}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{policy.filename}</h3>
                        {isAlreadyRewritten && (
                          <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            {tr('تمت إعادة الكتابة', 'Already Rewritten')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {policy.issueCount} {tr('مشكلة', 'issue(s) found')}
                      </p>
                    </div>
                    <Badge variant={index === currentRewriteIndex ? 'default' : 'outline'}>
                      {index + 1} / {pendingRewritePolicies.length}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsPolicySelectorOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button
              onClick={async () => {
                if (currentRewriteIndex < pendingRewritePolicies.length) {
                  const selectedPolicy = pendingRewritePolicies[currentRewriteIndex];
                  setIsPolicySelectorOpen(false);
                  // Check if already rewritten
                  if (rewrittenPolicies[selectedPolicy.policyId]) {
                    const rewritten = rewrittenPolicies[selectedPolicy.policyId];
                    setRewrittenPolicy(rewritten.text);
                    setCurrentPreviewPolicyId(rewritten.policyId);
                    setIsPreviewOpen(true);
                    toast({
                      title: tr('معلومة', 'Info'),
                      description: tr('عرض المستند المعاد كتابته سابقاً', 'Showing previously rewritten document') + `: ${rewritten.filename}`,
                    });
                  } else {
                    // Show accreditation dialog first
                    setPendingRewritePolicyId(selectedPolicy.policyId);
                    setIsAccreditationDialogOpen(true);
                  }
                }
              }}
            >
              {rewrittenPolicies[pendingRewritePolicies[currentRewriteIndex]?.policyId]
                ? tr('عرض المستند المعاد كتابته', 'View Rewritten Document')
                : tr('إعادة كتابة هذا المستند', 'Rewrite This Document')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
