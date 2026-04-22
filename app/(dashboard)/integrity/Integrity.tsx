'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';

type IntegrityRun = {
  id: string;
  status: string;
  type: string;
  mode?: 'quick_review' | 'operational';
  engineConfig?: {
    profile?: string;
    layers?: string[];
  };
  query?: string;
  createdAt: string;
  progress?: {
    percent?: number;
    step?: string;
    message?: string;
  };
  summary?: {
    findingsTotal: number;
    openCount: number;
    inReviewCount: number;
    resolvedCount: number;
    ignoredCount: number;
  };
};

type IntegrityFinding = {
  id: string;
  status: string;
  type: string;
  severity: string;
  impactScore?: number;
  ownerName?: string | null;
  dueDate?: string | null;
  slaDays?: number | null;
  title: string;
  summary: string;
  recommendation?: string;
  documentIds: string[];
  evidence: Array<{
    documentId: string;
    filename?: string;
    page?: number | null;
    chunkId?: string | null;
    quote?: string;
  }>;
};

export default function Integrity() {
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [runs, setRuns] = useState<IntegrityRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<IntegrityRun | null>(null);
  const [findings, setFindings] = useState<IntegrityFinding[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isLoadingFindings, setIsLoadingFindings] = useState(false);
  const [isStartingRun, setIsStartingRun] = useState(false);
  const [activity, setActivity] = useState<Array<{ id: string; message?: string; createdAt: string }>>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<IntegrityFinding | null>(null);
  const [isFindingDetailsOpen, setIsFindingDetailsOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [assistantNotes, setAssistantNotes] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'findings' | 'graph' | 'root_causes'>('findings');
  const [graphDocumentFilter, setGraphDocumentFilter] = useState<string | null>(null);
  const [rootCauseFilter, setRootCauseFilter] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [slaDays, setSlaDays] = useState<number | null>(null);
  const [isSimulationOpen, setIsSimulationOpen] = useState(false);
  const [simulationSummary, setSimulationSummary] = useState<{ willResolve: number; mayCreate: number } | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [activeMode, setActiveMode] = useState<'quick_review' | 'operational'>('quick_review');
  const [quickQuery, setQuickQuery] = useState('');
  const [quickDocuments, setQuickDocuments] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedQuickDocs, setSelectedQuickDocs] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedLayers, setSelectedLayers] = useState<string[]>([
    'document_conflicts',
    'workflow_conflicts',
    'cost_efficiency',
    'coverage_gaps',
  ]);
  const [selectedProfile, setSelectedProfile] = useState('general_ops');
  const [findingsPage, setFindingsPage] = useState(1);
  const [findingsTotalPages, setFindingsTotalPages] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [rulesets, setRulesets] = useState<Array<{ id: string; name: string; key: string; description?: string }>>([]);
  const [isRulesetsLoading, setIsRulesetsLoading] = useState(false);
  const [isRulesetDialogOpen, setIsRulesetDialogOpen] = useState(false);
  const [rulesetName, setRulesetName] = useState('');
  const [rulesetKey, setRulesetKey] = useState('');
  const [rulesetDescription, setRulesetDescription] = useState('');
  const presetRulesets = [
    { key: 'clinical_safety', name: 'Clinical Safety', description: 'Clinical safety checks' },
    { key: 'privacy_security', name: 'Privacy & Security', description: 'Privacy and security controls' },
    { key: 'legal_contracting', name: 'Legal Contracting', description: 'Legal alignment checks' },
    { key: 'finance_billing', name: 'Finance & Billing', description: 'Financial integrity checks' },
    { key: 'hr_ops', name: 'HR Operations', description: 'People operations compliance' },
    { key: 'general_ops', name: 'General Operations', description: 'General operational integrity' },
  ];

  const documentIds = useMemo(() => {
    const raw = searchParams.get('documentIds');
    return raw ? raw.split(',').filter(Boolean) : [];
  }, [searchParams]);

  const runIdParam = searchParams.get('runId');

  useEffect(() => {
    if (runIdParam) {
      setSelectedRunId(runIdParam);
    }
  }, [runIdParam]);

  const loadRuns = async () => {
    setIsLoadingRuns(true);
    try {
      const response = await fetch('/api/sam/integrity/runs', { credentials: 'include' });
      const data = await response.json();
      setRuns(data.items || []);
    } catch (error) {
      console.error('Failed to load runs:', error);
      toast({ title: tr('خطأ', 'Error'), description: tr('فشل تحميل عمليات التحقق', 'Failed to load integrity runs'), variant: 'destructive' });
    } finally {
      setIsLoadingRuns(false);
    }
  };

  const loadFindings = async (runId: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setIsLoadingFindings(true);
    }
    try {
      const response = await fetch(
        `/api/sam/integrity/runs/${runId}/findings?page=${findingsPage}&limit=25`,
        { credentials: 'include' }
      );
      const data = await response.json();
      setFindings(data.items || []);
      setFindingsTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Failed to load findings:', error);
      toast({ title: tr('خطأ', 'Error'), description: tr('فشل تحميل النتائج', 'Failed to load findings'), variant: 'destructive' });
    } finally {
      if (!opts?.silent) {
        setIsLoadingFindings(false);
      }
    }
  };

  const loadActivity = async (runId: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setIsLoadingActivity(true);
    }
    try {
      const response = await fetch(
        `/api/sam/integrity/activity?runId=${runId}&page=${activityPage}&limit=25`,
        { credentials: 'include' }
      );
      const data = await response.json();
      if (response.ok) {
        setActivity(data.items || []);
        setActivityTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to load activity:', error);
    } finally {
      if (!opts?.silent) {
        setIsLoadingActivity(false);
      }
    }
  };

  const loadRun = async (runId: string) => {
    try {
      const response = await fetch(`/api/sam/integrity/runs/${runId}`, { credentials: 'include' });
      const data = await response.json();
      if (response.ok) {
        setSelectedRun(data);
        return data as IntegrityRun;
      }
    } catch (error) {
      console.error('Failed to load run:', error);
    }
    return null;
  };

  useEffect(() => {
    loadRuns();
  }, []);

  const loadRulesets = async () => {
    setIsRulesetsLoading(true);
    try {
      const response = await fetch('/api/sam/integrity/rulesets', { credentials: 'include' });
      const data = await response.json();
      if (response.ok) {
        setRulesets(data.items || []);
      }
    } catch (error) {
      console.error('Failed to load rulesets:', error);
    } finally {
      setIsRulesetsLoading(false);
    }
  };

  useEffect(() => {
    loadRulesets();
  }, []);

  const loadQuickDocuments = async () => {
    try {
      const response = await fetch('/api/sam/library/list?limit=50&page=1', { credentials: 'include' });
      const data = await response.json();
      if (response.ok) {
        const items = (data.items || []).map((item: any) => ({
          id: item.theaEngineId,
          name: item.filename || item.metadata?.title || 'Untitled document',
        }));
        setQuickDocuments(items);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const loadDepartments = async () => {
    try {
      const response = await fetch('/api/structure/departments', { credentials: 'include' });
      const data = await response.json();
      if (response.ok) {
        setDepartments(data.departments || []);
      }
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  };

  useEffect(() => {
    loadQuickDocuments();
    loadDepartments();
  }, []);

  const createRuleset = async () => {
    try {
      const response = await fetch('/api/sam/integrity/rulesets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: rulesetName, key: rulesetKey, description: rulesetDescription }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to create ruleset');
      }
      setRulesetName('');
      setRulesetKey('');
      setRulesetDescription('');
      setIsRulesetDialogOpen(false);
      loadRulesets();
    } catch (error) {
      console.error('Create ruleset error:', error);
      toast({ title: tr('خطأ', 'Error'), description: tr('فشل إنشاء مجموعة القواعد', 'Failed to create ruleset'), variant: 'destructive' });
    }
  };

  const addPresetRuleset = async (preset: { key: string; name: string; description: string }) => {
    try {
      const response = await fetch('/api/sam/integrity/rulesets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(preset),
      });
      if (response.ok) {
        loadRulesets();
      }
    } catch (error) {
      console.error('Add preset ruleset error:', error);
    }
  };

  const exportRuleset = (ruleset: { id: string; name: string; key: string; description?: string }) => {
    const data = JSON.stringify(ruleset, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${ruleset.key}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (selectedRunId) {
      loadRun(selectedRunId);
      loadFindings(selectedRunId);
      loadActivity(selectedRunId);
    }
  }, [selectedRunId, findingsPage, activityPage]);

  useEffect(() => {
    if (!selectedRunId) return;
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    pollIntervalRef.current = setInterval(async () => {
      const run = await loadRun(selectedRunId);
      if (run && ['RUNNING', 'QUEUED'].includes(run.status)) {
        return;
      }
      await loadFindings(selectedRunId, { silent: true });
      await loadActivity(selectedRunId, { silent: true });
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }, 8000);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [selectedRunId]);

  const startRun = async () => {
    setIsStartingRun(true);
    try {
      const response = await fetch('/api/sam/integrity/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'issues',
          documentIds: documentIds.length > 0 ? documentIds : undefined,
          scope: documentIds.length > 0 ? { type: 'selection' } : { type: 'all' },
          collections: selectedCollections.length > 0 ? selectedCollections : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to start integrity run');
      }
      await loadRuns();
      setSelectedRunId(data.runId);
      router.replace(`/integrity?runId=${data.runId}`);
    } catch (error: any) {
      console.error('Failed to start run:', error);
      toast({ title: tr('خطأ', 'Error'), description: error.message || tr('فشل بدء العملية', 'Failed to start run'), variant: 'destructive' });
    } finally {
      setIsStartingRun(false);
    }
  };

  const startQuickReview = async () => {
    setIsStartingRun(true);
    try {
      const response = await fetch('/api/sam/integrity/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mode: 'quick_review',
          query: quickQuery,
          documentIds: selectedQuickDocs.length > 0 ? selectedQuickDocs : undefined,
          scope: {
            type: selectedQuickDocs.length > 0 ? 'selection' : 'filter',
            mode: selectedQuickDocs.length > 0 ? 'selection' : 'filters',
            filters: selectedQuickDocs.length > 0 ? undefined : { textQuery: quickQuery },
          },
          profile: 'general_ops',
          layers: ['issues', 'conflicts'],
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to start review');
      }
      await loadRuns();
      setSelectedRunId(data.runId);
      router.replace(`/integrity?runId=${data.runId}`);
      document.getElementById('integrity-findings')?.scrollIntoView({ behavior: 'smooth' });
    } catch (error: any) {
      console.error('Failed to start review:', error);
      toast({ title: tr('خطأ', 'Error'), description: error.message || tr('فشل بدء المراجعة', 'Failed to start review'), variant: 'destructive' });
    } finally {
      setIsStartingRun(false);
    }
  };

  const startOperationalIntegrity = async () => {
    setIsStartingRun(true);
    try {
      const response = await fetch('/api/sam/integrity/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mode: 'operational',
          profile: selectedProfile,
          layers: selectedLayers,
          scope: {
            type: selectedDepartmentId ? 'filter' : 'all',
            mode: selectedDepartmentId ? 'filters' : 'filters',
            filters: selectedDepartmentId ? { departmentIds: selectedDepartmentId } : undefined,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to start integrity check');
      }
      await loadRuns();
      setSelectedRunId(data.runId);
      router.replace(`/integrity?runId=${data.runId}`);
      document.getElementById('integrity-findings')?.scrollIntoView({ behavior: 'smooth' });
    } catch (error: any) {
      console.error('Failed to start integrity check:', error);
      toast({ title: tr('خطأ', 'Error'), description: error.message || tr('فشل بدء فحص السلامة', 'Failed to start integrity check'), variant: 'destructive' });
    } finally {
      setIsStartingRun(false);
    }
  };

  const updateFindingStatus = async (findingId: string, status: string) => {
    try {
      const response = await fetch(`/api/sam/integrity/findings/${findingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error('Failed to update finding');
      }
      if (selectedRunId) {
        await loadFindings(selectedRunId);
      }
    } catch (error) {
      console.error('Failed to update finding:', error);
      toast({ title: tr('خطأ', 'Error'), description: tr('فشل تحديث النتيجة', 'Failed to update finding'), variant: 'destructive' });
    }
  };

  const saveResolutionWorkflow = async () => {
    if (!selectedFinding) return;
    try {
      const response = await fetch(`/api/sam/integrity/findings/${selectedFinding.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ownerName,
          dueDate: dueDate || null,
          slaDays,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to update workflow');
      }
      await loadFindings(selectedRunId as string, { silent: true });
      toast({ title: tr('تم الحفظ', 'Saved'), description: tr('تم تحديث سير العمل', 'Workflow updated') });
    } catch (error) {
      console.error('Workflow update error:', error);
      toast({ title: tr('خطأ', 'Error'), description: tr('فشل تحديث سير العمل', 'Failed to update workflow'), variant: 'destructive' });
    }
  };

  const openSimulation = async () => {
    if (!selectedFinding) return;
    setIsSimulating(true);
    try {
      const response = await fetch(`/api/sam/integrity/findings/${selectedFinding.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirm: false }),
      });
      const data = await response.json();
      setSimulationSummary(data.summary || { willResolve: 0, mayCreate: 0 });
      setIsSimulationOpen(true);
    } catch (error) {
      console.error('Simulation error:', error);
      toast({ title: tr('خطأ', 'Error'), description: tr('فشل محاكاة التغييرات', 'Failed to simulate changes'), variant: 'destructive' });
    } finally {
      setIsSimulating(false);
    }
  };

  const confirmApply = async () => {
    if (!selectedFinding) return;
    try {
      const response = await fetch(`/api/sam/integrity/findings/${selectedFinding.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirm: true }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to apply remediation');
      }
      setIsSimulationOpen(false);
      toast({ title: tr('تم التطبيق', 'Applied'), description: tr('تم تطبيق المعالجة', 'Remediation applied') });
    } catch (error) {
      console.error('Apply error:', error);
      toast({ title: tr('خطأ', 'Error'), description: tr('فشل تطبيق المعالجة', 'Failed to apply remediation'), variant: 'destructive' });
    }
  };

  const graphSummary = useMemo(() => {
    const documentCounts = new Map<string, { count: number; filename?: string }>();
    findings.forEach((finding) => {
      finding.evidence?.forEach((entry) => {
        if (!entry.documentId) return;
        const existing = documentCounts.get(entry.documentId) || { count: 0, filename: entry.filename };
        documentCounts.set(entry.documentId, { count: existing.count + 1, filename: entry.filename || existing.filename });
      });
    });
    const documents = Array.from(documentCounts.entries()).map(([documentId, info]) => ({
      documentId,
      filename: info.filename,
      count: info.count,
    }));
    documents.sort((a, b) => b.count - a.count);
    return { documents };
  }, [findings]);

  const filteredFindings = useMemo(() => {
    if (!graphDocumentFilter) return findings;
    return findings.filter((finding) =>
      finding.evidence?.some((entry) => entry.documentId === graphDocumentFilter)
    );
  }, [findings, graphDocumentFilter]);

  const rootCauseClusters = useMemo(() => {
    const clusters = new Map<string, { key: string; label: string; count: number; items: IntegrityFinding[] }>();
    findings.forEach((finding) => {
      const typeKey = (finding.type || 'general').toLowerCase();
      const severityKey = (finding.severity || 'low').toLowerCase();
      const key = `${typeKey}:${severityKey}`;
      const label = `${finding.type || 'General'} • ${finding.severity || 'Low'}`;
      const cluster = clusters.get(key) || { key, label, count: 0, items: [] };
      cluster.count += 1;
      cluster.items.push(finding);
      clusters.set(key, cluster);
    });
    return Array.from(clusters.values()).sort((a, b) => b.count - a.count);
  }, [findings]);

  const rootCauseFilteredFindings = useMemo(() => {
    if (!rootCauseFilter) return findings;
    const cluster = rootCauseClusters.find((item) => item.key === rootCauseFilter);
    return cluster ? cluster.items : findings;
  }, [findings, rootCauseFilter, rootCauseClusters]);

  const getResolutionOptions = (finding: IntegrityFinding) => {
    const options = [
      `Clarify language: update document to remove ambiguity in "${finding.title}"`,
      `Align responsibilities: define owner or approval path related to "${finding.type}"`,
      finding.recommendation ? `Apply recommendation: ${finding.recommendation}` : 'Apply the recommended remediation path',
    ];
    return options.slice(0, 3);
  };

  const computeImpactScore = (finding: IntegrityFinding) => {
    const severityWeight: Record<string, number> = {
      CRITICAL: 90,
      HIGH: 75,
      MEDIUM: 50,
      LOW: 30,
    };
    const severity = (finding.severity || 'LOW').toUpperCase();
    const base = severityWeight[severity] ?? 30;
    const documentFactor = Math.min((finding.documentIds?.length || 1) * 5, 20);
    const evidenceFactor = Math.min((finding.evidence?.length || 0) * 3, 15);
    return Math.min(100, base + documentFactor + evidenceFactor);
  };

  const getFileKind = (filename?: string) => {
    const ext = (filename || '').split('.').pop()?.toLowerCase();
    if (!ext) return 'Document';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'tiff', 'bmp'].includes(ext)) return 'Image';
    if (['xlsx', 'xls', 'csv'].includes(ext)) return 'Spreadsheet';
    if (['docx', 'doc'].includes(ext)) return 'Document';
    if (['pptx', 'ppt'].includes(ext)) return 'Slides';
    if (['pdf'].includes(ext)) return 'PDF';
    return 'Document';
  };

  const findingsContent =
    viewMode === 'graph' ? (
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">
          {tr('المستندات مجمعة حسب مراجع الأدلة. انقر على مستند لتصفية النتائج.', 'Documents are grouped by evidence references. Click a document to filter findings.')}
        </div>
        {graphSummary.documents.length === 0 ? (
          <div className="text-sm text-muted-foreground">{tr('لا يوجد رسم بياني للأدلة.', 'No evidence graph available.')}</div>
        ) : (
          <div className="space-y-2">
            {graphSummary.documents.map((doc) => (
              <Button
                key={doc.documentId}
                variant={graphDocumentFilter === doc.documentId ? 'default' : 'outline'}
                className="w-full justify-between"
                onClick={() => setGraphDocumentFilter(doc.documentId)}
              >
                <span className="truncate">{doc.filename || doc.documentId}</span>
                <Badge variant="secondary" className="rounded-full text-[11px] font-bold">{doc.count}</Badge>
              </Button>
            ))}
          </div>
        )}
      </div>
    ) : viewMode === 'root_causes' ? (
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">
          {tr('النتائج مجمعة في مجموعات الأسباب الجذرية حسب النوع والشدة.', 'Findings grouped into root cause clusters by type and severity.')}
        </div>
        {rootCauseClusters.length === 0 ? (
          <div className="text-sm text-muted-foreground">{tr('لا توجد مجموعات متاحة.', 'No clusters available.')}</div>
        ) : (
          <div className="space-y-2">
            {rootCauseClusters.map((cluster) => (
              <Button
                key={cluster.key}
                variant={rootCauseFilter === cluster.key ? 'default' : 'outline'}
                className="w-full justify-between"
                onClick={() => setRootCauseFilter(cluster.key)}
              >
                <span>{cluster.label}</span>
                <Badge variant="secondary" className="rounded-full text-[11px] font-bold">{cluster.count}</Badge>
              </Button>
            ))}
          </div>
        )}
      </div>
    ) : (
      <>
        <div className="overflow-x-auto">
          <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow>
              <TableHead>{tr('النوع', 'Type')}</TableHead>
              <TableHead>{tr('الشدة', 'Severity')}</TableHead>
              <TableHead>{tr('التأثير', 'Impact')}</TableHead>
              <TableHead>{tr('المالك', 'Owner')}</TableHead>
              <TableHead>{tr('الموعد', 'Due')}</TableHead>
              <TableHead>{tr('الحالة', 'Status')}</TableHead>
              <TableHead>{tr('الملخص', 'Summary')}</TableHead>
              <TableHead>{tr('المستند', 'Document')}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingFindings ? (
              <TableRow>
                <TableCell colSpan={5}>{tr('جاري تحميل النتائج...', 'Loading findings...')}</TableCell>
              </TableRow>
            ) : filteredFindings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>{tr('لا توجد نتائج لهذه العملية.', 'No findings for this run.')}</TableCell>
              </TableRow>
            ) : (
              filteredFindings.map((finding) => (
                <TableRow key={finding.id}>
                  <TableCell>{finding.type}</TableCell>
                  <TableCell>{finding.severity}</TableCell>
                  <TableCell>
                    <Badge className="rounded-full text-[11px] font-bold" variant={computeImpactScore(finding) >= 70 ? 'destructive' : 'secondary'}>
                      {computeImpactScore(finding)}
                    </Badge>
                  </TableCell>
                  <TableCell>{finding.ownerName || tr('غير معين', 'Unassigned')}</TableCell>
                  <TableCell>{finding.dueDate ? new Date(finding.dueDate).toLocaleDateString() : '—'}</TableCell>
                  <TableCell>
                    <Badge className="rounded-full text-[11px] font-bold" variant="secondary">{finding.status}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[220px] whitespace-normal break-words">
                    {finding.summary}
                  </TableCell>
                  <TableCell>
                    {finding.evidence?.[0]?.documentId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const documentId = finding.evidence?.[0]?.documentId;
                          window.open(`/api/sam/library/view-file?theaEngineId=${documentId}`, '_blank');
                        }}
                      >
                        {tr('عرض المستند', 'View Document')}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">{tr('لا يوجد دليل', 'No evidence')}</span>
                    )}
                  </TableCell>
                  <TableCell className="min-w-[220px]">
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedFinding(finding);
                          setAssistantNotes([]);
                          setAssistantPrompt('');
                          setOwnerName(finding.ownerName || '');
                          setDueDate(finding.dueDate ? new Date(finding.dueDate).toISOString().split('T')[0] : '');
                          setSlaDays(finding.slaDays ?? null);
                          setIsFindingDetailsOpen(true);
                        }}
                      >
                        {tr('التفاصيل', 'Details')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => updateFindingStatus(finding.id, 'IN_REVIEW')}>
                        {tr('مراجعة', 'Review')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => updateFindingStatus(finding.id, 'RESOLVED')}>
                        {tr('حل', 'Resolve')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => updateFindingStatus(finding.id, 'IGNORED')}>
                        {tr('تجاهل', 'Ignore')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={openSimulation}>
                        {tr('محاكاة التطبيق', 'Simulate Apply')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          </Table>
        </div>
        {findingsTotalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <Button
              size="sm"
              variant="outline"
              disabled={findingsPage <= 1}
              onClick={() => setFindingsPage((prev) => Math.max(1, prev - 1))}
            >
              {tr('السابق', 'Previous')}
            </Button>
            <span>
              {tr(`صفحة ${findingsPage} من ${findingsTotalPages}`, `Page ${findingsPage} of ${findingsTotalPages}`)}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={findingsPage >= findingsTotalPages}
              onClick={() => setFindingsPage((prev) => Math.min(findingsTotalPages, prev + 1))}
            >
              {tr('التالي', 'Next')}
            </Button>
          </div>
        )}
      </>
    );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{tr('تعارضات المستندات والمشاكل', 'Document Conflicts & Issues')}</CardTitle>
          <CardDescription>
            {tr('تشغيل فحوصات سلامة العمليات عبر المستندات ومراجعة النتائج.', 'Run operational integrity checks across documents and review findings.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={activeMode === 'quick_review' ? 'default' : 'outline'}
              onClick={() => setActiveMode('quick_review')}
            >
              {tr('مراجعة سريعة', 'Quick Review')}
            </Button>
            <Button
              size="sm"
              variant={activeMode === 'operational' ? 'default' : 'outline'}
              onClick={() => setActiveMode('operational')}
            >
              {tr('سلامة العمليات', 'Operational Integrity')}
            </Button>
          </div>
          {activeMode === 'quick_review' ? (
            <div className="space-y-3">
              <Textarea
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
                placeholder={tr('صف ما تريد التحقق منه...', 'Describe what to check for...')}
                className="thea-input-focus"
              />
              <div className="rounded-xl border-border border p-3 space-y-2">
                <div className="text-sm font-medium text-foreground">{tr('المستندات (اختياري)', 'Documents (optional)')}</div>
                {quickDocuments.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{tr('لم يتم تحميل مستندات.', 'No documents loaded.')}</div>
                ) : (
                  quickDocuments.map((doc) => (
                    <label key={doc.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedQuickDocs.includes(doc.id)}
                        onCheckedChange={(checked) => {
                          setSelectedQuickDocs((prev) =>
                            checked ? [...prev, doc.id] : prev.filter((id) => id !== doc.id)
                          );
                        }}
                      />
                      {doc.name}
                    </label>
                  ))
                )}
              </div>
              <Button onClick={startQuickReview} disabled={isStartingRun}>
                {isStartingRun ? tr('جاري التشغيل...', 'Running...') : tr('بدء المراجعة', 'Run Review')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <label className="text-sm font-medium text-foreground">{tr('الملف التعريفي', 'Profile')}</label>
                <select
                  value={selectedProfile}
                  onChange={(e) => setSelectedProfile(e.target.value)}
                  className="border-border border rounded-xl px-2 py-1 text-sm thea-input-focus"
                >
                  {presetRulesets.map((preset) => (
                    <option key={preset.key} value={preset.key}>
                      {preset.name}
                    </option>
                  ))}
                </select>
                <label className="text-sm font-medium text-foreground">{tr('القسم', 'Department')}</label>
                <select
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  className="border-border border rounded-xl px-2 py-1 text-sm thea-input-focus"
                >
                  <option value="">{tr('جميع الأقسام', 'All Departments')}</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'document_conflicts', label: tr('تعارضات المستندات', 'Document Conflicts') },
                  { id: 'workflow_conflicts', label: tr('تعارضات سير العمل', 'Workflow Conflicts') },
                  { id: 'cost_efficiency', label: tr('التكلفة والكفاءة', 'Cost & Efficiency') },
                  { id: 'coverage_gaps', label: tr('فجوات التغطية', 'Coverage Gaps') },
                ].map((layer) => (
                  <label key={layer.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedLayers.includes(layer.id)}
                      onCheckedChange={(checked) => {
                        setSelectedLayers((prev) =>
                          checked ? [...prev, layer.id] : prev.filter((item) => item !== layer.id)
                        );
                      }}
                    />
                    {layer.label}
                  </label>
                ))}
              </div>
              <Button onClick={startOperationalIntegrity} disabled={isStartingRun}>
                {isStartingRun ? tr('جاري التشغيل...', 'Running...') : tr('بدء فحص السلامة', 'Run Integrity Check')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tr('عمليات التحقق', 'Integrity Runs')}</CardTitle>
          <CardDescription>{tr('عمليات فحص السلامة الأخيرة ونتائجها.', 'Recent integrity scans and their results.')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr('العملية', 'Run')}</TableHead>
              <TableHead>{tr('الحالة', 'Status')}</TableHead>
              <TableHead>{tr('الوضع', 'Mode')}</TableHead>
                <TableHead>{tr('النوع', 'Type')}</TableHead>
                <TableHead>{tr('النتائج', 'Findings')}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingRuns ? (
                <TableRow>
                  <TableCell colSpan={5}>{tr('جاري تحميل العمليات...', 'Loading runs...')}</TableCell>
                </TableRow>
              ) : runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>{tr('لا توجد عمليات بعد.', 'No runs yet.')}</TableCell>
                </TableRow>
              ) : (
                runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>{new Date(run.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{run.status}</TableCell>
                  <TableCell>{run.mode === 'operational' ? tr('عمليات', 'Operational') : tr('مراجعة سريعة', 'Quick Review')}</TableCell>
                    <TableCell>{run.type}</TableCell>
                    <TableCell>{run.summary?.findingsTotal ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedRunId(run.id);
                          router.replace(`/integrity?runId=${run.id}`);
                        }}
                      >
                        {tr('عرض', 'View')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedRunId && (
        <Card id="integrity-findings">
          <CardHeader>
            <CardTitle>{tr('النتائج', 'Findings')}</CardTitle>
            <CardDescription>{tr('مراجعة وحل نتائج فحص السلامة.', 'Review and resolve integrity findings.')}</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedRun && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Badge className="rounded-full text-[11px] font-bold" variant="secondary">{selectedRun.status}</Badge>
                {selectedRun.progress?.percent !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {selectedRun.progress?.percent}% {selectedRun.progress?.step ? `• ${selectedRun.progress.step}` : ''}
                  </span>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Button
                size="sm"
                variant={viewMode === 'findings' ? 'default' : 'outline'}
                onClick={() => setViewMode('findings')}
              >
                {tr('النتائج', 'Findings')}
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'graph' ? 'default' : 'outline'}
                onClick={() => setViewMode('graph')}
              >
                {tr('عرض الرسم البياني', 'Graph View')}
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'root_causes' ? 'default' : 'outline'}
                onClick={() => setViewMode('root_causes')}
              >
                {tr('الأسباب الجذرية', 'Root Causes')}
              </Button>
              {graphDocumentFilter && (
                <Button size="sm" variant="ghost" onClick={() => setGraphDocumentFilter(null)}>
                  {tr('مسح الفلتر', 'Clear filter')}
                </Button>
              )}
              {rootCauseFilter && (
                <Button size="sm" variant="ghost" onClick={() => setRootCauseFilter(null)}>
                  {tr('مسح السبب الجذري', 'Clear root cause')}
                </Button>
              )}
            </div>
            {findingsContent}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{tr('مجموعات القواعد', 'Rulesets')}</CardTitle>
          <CardDescription>{tr('إدارة مجموعات قواعد السلامة والإعدادات المسبقة.', 'Manage integrity rulesets and presets.')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {presetRulesets.map((preset) => (
              <Button key={preset.key} size="sm" variant="outline" onClick={() => addPresetRuleset(preset)}>
                {tr('إضافة', 'Add')} {preset.name}
              </Button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setIsRulesetDialogOpen(true)}>
              {tr('مجموعة قواعد جديدة', 'New Ruleset')}
            </Button>
          </div>
          {isRulesetsLoading ? (
            <div className="text-sm text-muted-foreground">{tr('جاري تحميل مجموعات القواعد...', 'Loading rulesets...')}</div>
          ) : rulesets.length === 0 ? (
            <div className="text-sm text-muted-foreground">{tr('لا توجد مجموعات قواعد بعد.', 'No rulesets yet.')}</div>
          ) : (
            <div className="space-y-2">
              {rulesets.map((ruleset) => (
                <div key={ruleset.id} className="flex items-center justify-between border-border border rounded-xl p-2">
                  <div>
                    <div className="font-medium text-foreground">{ruleset.name}</div>
                    <div className="text-xs text-muted-foreground">{ruleset.description || ruleset.key}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => exportRuleset(ruleset)}>
                    {tr('تصدير', 'Export')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isRulesetDialogOpen} onOpenChange={setIsRulesetDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tr('إنشاء مجموعة قواعد', 'Create Ruleset')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input className="thea-input-focus" placeholder={tr('اسم مجموعة القواعد', 'Ruleset name')} value={rulesetName} onChange={(e) => setRulesetName(e.target.value)} />
            <Input className="thea-input-focus" placeholder={tr('مفتاح مجموعة القواعد', 'Ruleset key')} value={rulesetKey} onChange={(e) => setRulesetKey(e.target.value)} />
            <Textarea
              className="thea-input-focus"
              placeholder={tr('الوصف', 'Description')}
              value={rulesetDescription}
              onChange={(e) => setRulesetDescription(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsRulesetDialogOpen(false)}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button onClick={createRuleset}>{tr('حفظ', 'Save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedRunId && (
        <Card>
          <CardHeader>
            <CardTitle>{tr('النشاط', 'Activity')}</CardTitle>
            <CardDescription>{tr('نشاط عمليات التحقق الأخيرة.', 'Recent integrity run activity.')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingActivity ? (
              <div className="text-sm text-muted-foreground">{tr('جاري تحميل النشاط...', 'Loading activity...')}</div>
            ) : activity.length === 0 ? (
              <div className="text-sm text-muted-foreground">{tr('لا يوجد نشاط بعد.', 'No activity yet.')}</div>
            ) : (
              <div className="space-y-2 text-sm">
                {activity.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-4">
                    <span>{entry.message || 'Activity'}</span>
                    <span className="text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {activityTotalPages > 1 && (
              <div className="mt-3 flex items-center justify-between text-sm">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={activityPage <= 1}
                  onClick={() => setActivityPage((prev) => Math.max(1, prev - 1))}
                >
                  {tr('السابق', 'Previous')}
                </Button>
                <span>
                  {tr(`صفحة ${activityPage} من ${activityTotalPages}`, `Page ${activityPage} of ${activityTotalPages}`)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={activityPage >= activityTotalPages}
                  onClick={() => setActivityPage((prev) => Math.min(activityTotalPages, prev + 1))}
                >
                  {tr('التالي', 'Next')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={isFindingDetailsOpen} onOpenChange={setIsFindingDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{tr('تفاصيل النتيجة', 'Finding Details')}</DialogTitle>
          </DialogHeader>
          {selectedFinding ? (
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-xs uppercase text-muted-foreground">{tr('سبب التعليم', 'Why flagged')}</div>
                <p className="mt-1 text-foreground">{selectedFinding.summary || tr('لا يوجد ملخص متاح.', 'No summary available.')}</p>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">{tr('التأثير التشغيلي', 'Operational impact')}</div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge className="rounded-full text-[11px] font-bold" variant={computeImpactScore(selectedFinding) >= 70 ? 'destructive' : 'secondary'}>
                    {tr('التأثير', 'Impact')} {computeImpactScore(selectedFinding)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {tr('الدرجات الأعلى تشير إلى تعرض تشغيلي أوسع.', 'Higher scores indicate broader operational exposure.')}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">{tr('سير عمل الحل', 'Resolution workflow')}</div>
                <div className="mt-2 grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">{tr('المالك', 'Owner')}</span>
                    <Input className="thea-input-focus" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder={tr('اسم المالك', 'Owner name')} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">{tr('تاريخ الاستحقاق', 'Due date')}</span>
                    <Input className="thea-input-focus" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">{tr('اتفاقية مستوى الخدمة (أيام)', 'SLA (days)')}</span>
                    <Input
                      className="thea-input-focus"
                      type="number"
                      min={1}
                      value={slaDays ?? ''}
                      onChange={(e) => setSlaDays(e.target.value ? Number(e.target.value) : null)}
                      placeholder="e.g. 14"
                    />
                  </div>
                </div>
                <div className="mt-2 flex justify-end">
                  <Button size="sm" onClick={saveResolutionWorkflow}>
                    {tr('حفظ سير العمل', 'Save Workflow')}
                  </Button>
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">{tr('الأدلة', 'Evidence')}</div>
                <div className="mt-2 space-y-2">
                  {selectedFinding.evidence?.length ? (
                    selectedFinding.evidence.map((entry, idx) => (
                      <div key={`${selectedFinding.id}-ev-${idx}`} className="rounded-xl border-border border p-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{entry.filename || entry.documentId}</span>
                          {entry.page ? <span>• Page {entry.page}</span> : null}
                          {entry.chunkId ? <span>• Chunk {entry.chunkId}</span> : null}
                          <Badge className="rounded-full text-[11px] font-bold" variant="outline">{getFileKind(entry.filename)}</Badge>
                        </div>
                        <div className="mt-1 text-foreground">{entry.quote || tr('لا يوجد مقتطف متاح.', 'No excerpt available.')}</div>
                        {entry.documentId && (
                          <div className="mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                window.open(
                                  `/api/sam/library/view-file?theaEngineId=${entry.documentId}`,
                                  '_blank'
                                );
                              }}
                            >
                              {tr('فتح ملف الدليل', 'Open Evidence File')}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground">{tr('لم يتم التقاط أدلة.', 'No evidence captured.')}</div>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">{tr('أفضل 3 خيارات للحل', 'Top 3 resolution options')}</div>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  {getResolutionOptions(selectedFinding).map((option) => (
                    <li key={option}>{option}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">{tr('المقايضات', 'Trade-offs')}</div>
                <p className="mt-1 text-muted-foreground">
                  {tr('حل هذه النتيجة قد يتطلب تحديثات عبر المستندات ذات الصلة للحفاظ على الاتساق.', 'Resolving this finding may require updates across related documents to keep consistency.')}
                </p>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">{tr('اسأل مساعد السلامة', 'Ask Integrity Assistant')}</div>
                <Textarea
                  value={assistantPrompt}
                  onChange={(e) => setAssistantPrompt(e.target.value)}
                  placeholder={tr('اطلب تحسين أو خطوات حل بديلة...', 'Ask for refinement or alternative resolution steps...')}
                  className="mt-2 thea-input-focus"
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!assistantPrompt.trim()) return;
                      setAssistantNotes((prev) => [...prev, assistantPrompt.trim()]);
                      setAssistantPrompt('');
                    }}
                  >
                    {tr('تحديث الاقتراحات', 'Update Suggestions')}
                  </Button>
                </div>
                {assistantNotes.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {assistantNotes.map((note, idx) => (
                      <div key={`${selectedFinding.id}-note-${idx}`} className="rounded-xl bg-muted p-2">
                        {note}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={openSimulation} disabled={isSimulating}>
                  {isSimulating ? tr('جاري المحاكاة...', 'Simulating...') : tr('محاكاة التطبيق', 'Simulate Apply')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">{tr('اختر نتيجة لعرض التفاصيل.', 'Select a finding to view details.')}</div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isSimulationOpen} onOpenChange={setIsSimulationOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tr('محاكاة التغيير', 'Change Simulation')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p>
              {tr(`سيغلق هذا التغيير`, 'This change will close')} <strong>{simulationSummary?.willResolve ?? 0}</strong> {tr('نتائج وقد ينشئ', 'findings and may create')}{' '}
              <strong>{simulationSummary?.mayCreate ?? 0}</strong> {tr('نتائج جديدة.', 'new findings.')}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsSimulationOpen(false)}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button onClick={confirmApply}>{tr('تأكيد التطبيق', 'Confirm Apply')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
