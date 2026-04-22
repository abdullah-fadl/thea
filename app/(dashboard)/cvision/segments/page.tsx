'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTextarea, CVisionSelect, CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';

import { toast } from 'sonner';
import {
  Tags, Plus, Search, Users, Filter, RefreshCw, Loader2,
  Trash2, BarChart3, Hash, Layers, PieChart, X, ChevronRight,
  ArrowUpDown, Tag, UserPlus, Sparkles, CircleDot,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SegmentRule {
  field: string;
  operator: string;
  value: string;
}

interface Segment {
  _id: string;
  name: string;
  type: 'MANUAL' | 'DYNAMIC';
  rules: SegmentRule[];
  ruleLogic: 'AND' | 'OR';
  manualEmployeeIds: string[];
  employeeCount: number;
  lastCalculatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface TagCloudItem {
  tag: string;
  count: number;
}

interface SegmentEmployee {
  _id: string;
  employeeId: string;
  name: string;
  department: string;
  jobTitle: string;
  tags: string[];
}

interface StatsData {
  totalSegments: number;
  manualSegments: number;
  dynamicSegments: number;
  taggedEmployees: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API = '/api/cvision/segments';

const DEFAULT_TAGS = [
  'High Potential', 'Remote', 'Expat', 'Critical Role', 'Key Talent',
  'Flight Risk', 'New Hire', 'Part-Time', 'Probation', 'Contractor',
];

const getOperators = (tr: (ar: string, en: string) => string) => [
  { value: 'EQUALS', label: tr('يساوي', 'Equals') },
  { value: 'NOT_EQUALS', label: tr('لا يساوي', 'Not Equals') },
  { value: 'GREATER', label: tr('أكبر من', 'Greater Than') },
  { value: 'LESS', label: tr('أقل من', 'Less Than') },
  { value: 'CONTAINS', label: tr('يحتوي', 'Contains') },
  { value: 'IN', label: tr('ضمن', 'In') },
];

const RULE_FIELDS = [
  'department', 'jobTitle', 'grade', 'nationality', 'gender',
  'tenure', 'salary', 'status', 'location', 'contractType',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiFetch(url: string, signal?: AbortSignal) {
  const res = await fetch(url, { credentials: 'include', signal });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

async function apiPost(body: Record<string, unknown>) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '--';
  try {
    return new Date(iso).toLocaleDateString('en-SA', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '--';
  }
}

function typeBadgeVariant(type: string): string {
  return type === 'DYNAMIC'
    ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300'
    : 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300';
}

function tagSizeClass(count: number, maxCount: number): string {
  if (maxCount === 0) return 'text-sm';
  const ratio = count / maxCount;
  if (ratio > 0.8) return 'text-3xl font-bold';
  if (ratio > 0.6) return 'text-2xl font-semibold';
  if (ratio > 0.4) return 'text-xl font-medium';
  if (ratio > 0.2) return 'text-lg';
  return 'text-sm';
}

function tagColorClass(index: number): string {
  const colors = [
    'text-blue-600 dark:text-blue-400',
    'text-violet-600 dark:text-violet-400',
    'text-emerald-600 dark:text-emerald-400',
    'text-amber-600 dark:text-amber-400',
    'text-rose-600 dark:text-rose-400',
    'text-cyan-600 dark:text-cyan-400',
    'text-indigo-600 dark:text-indigo-400',
    'text-pink-600 dark:text-pink-400',
    'text-teal-600 dark:text-teal-400',
    'text-orange-600 dark:text-orange-400',
  ];
  return colors[index % colors.length];
}

// ---------------------------------------------------------------------------
// Empty rule factory
// ---------------------------------------------------------------------------

function emptyRule(): SegmentRule {
  return { field: 'department', operator: 'EQUALS', value: '' };
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function SegmentsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const OPERATORS = getOperators(tr);

  const [activeTab, setActiveTab] = useState('segments');

  // ---- Segments Tab State ----
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentsTotal, setSegmentsTotal] = useState(0);
  const [segmentsSearch, setSegmentsSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'MANUAL' | 'DYNAMIC'>('DYNAMIC');
  const [newRules, setNewRules] = useState<SegmentRule[]>([emptyRule()]);
  const [newRuleLogic, setNewRuleLogic] = useState<'AND' | 'OR'>('AND');
  const [newManualIds, setNewManualIds] = useState('');
  const [recalcBusy, setRecalcBusy] = useState<string | null>(null);

  // ---- Tags Tab State ----
  const [tagCloud, setTagCloud] = useState<TagCloudItem[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [addTagOpen, setAddTagOpen] = useState(false);
  const [addTagBusy, setAddTagBusy] = useState(false);
  const [addTagEmployeeId, setAddTagEmployeeId] = useState('');
  const [addTagValue, setAddTagValue] = useState('');
  const [removeTagOpen, setRemoveTagOpen] = useState(false);
  const [removeTagBusy, setRemoveTagBusy] = useState(false);
  const [removeTagEmployeeId, setRemoveTagEmployeeId] = useState('');
  const [removeTagValue, setRemoveTagValue] = useState('');
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkTagBusy, setBulkTagBusy] = useState(false);
  const [bulkTagIds, setBulkTagIds] = useState('');
  const [bulkTagValue, setBulkTagValue] = useState('');

  // ---- Employees Tab State ----
  const [selectedSegmentId, setSelectedSegmentId] = useState('');
  const [segmentEmployees, setSegmentEmployees] = useState<SegmentEmployee[]>([]);
  const [segmentEmployeesTotal, setSegmentEmployeesTotal] = useState(0);
  const [employeesSearch, setEmployeesSearch] = useState('');

  // ---- Stats Tab State ----
  const [stats, setStats] = useState<StatsData | null>(null);

  // =========================================================================
  // Data Fetching via React Query
  // =========================================================================

  const { data: segmentsRaw, isLoading: segmentsLoadingQ, refetch: refetchSegments } = useQuery({
    queryKey: cvisionKeys.segments.list({ action: 'list' }),
    queryFn: async () => {
      const json = await cvisionFetch<any>(`${API}`, { params: { action: 'list' } });
      const data = json.data || json;
      setSegments(data.items || []);
      setSegmentsTotal(data.total || 0);
      return json;
    },
    enabled: activeTab === 'segments',
  });
  const segmentsLoading = segmentsLoadingQ;
  const loadSegments = refetchSegments;

  const { isLoading: tagsLoadingQ, refetch: refetchTagCloud } = useQuery({
    queryKey: cvisionKeys.segments.list({ action: 'tag-cloud' }),
    queryFn: async () => {
      const [cloudRes, tagsRes] = await Promise.all([
        cvisionFetch<any>(`${API}`, { params: { action: 'tag-cloud' } }),
        cvisionFetch<any>(`${API}`, { params: { action: 'available-tags' } }),
      ]);
      setTagCloud(cloudRes.data?.items || cloudRes.data || []);
      setAvailableTags(tagsRes.data || DEFAULT_TAGS);
      return { cloudRes, tagsRes };
    },
    enabled: activeTab === 'tags',
  });
  const tagsLoading = tagsLoadingQ;
  const loadTagCloud = refetchTagCloud;

  const { isLoading: employeesLoadingQ, refetch: refetchSegmentEmployees } = useQuery({
    queryKey: cvisionKeys.segments.detail(selectedSegmentId || '__none__'),
    queryFn: async () => {
      const json = await cvisionFetch<any>(`${API}`, { params: { action: 'segment-employees', segmentId: selectedSegmentId } });
      const data = json.data || json;
      setSegmentEmployees(data.items || []);
      setSegmentEmployeesTotal(data.total || 0);
      return json;
    },
    enabled: !!selectedSegmentId,
  });
  const employeesLoading = employeesLoadingQ;
  const loadSegmentEmployees = (_id?: string) => refetchSegmentEmployees();

  const { isLoading: statsLoadingQ, refetch: refetchStats } = useQuery({
    queryKey: cvisionKeys.segments.list({ action: 'stats' }),
    queryFn: async () => {
      const json = await cvisionFetch<any>(`${API}`, { params: { action: 'stats' } });
      setStats(json.data || json);
      return json;
    },
    enabled: activeTab === 'stats',
  });
  const statsLoading = statsLoadingQ;
  const loadStats = () => refetchStats();

  const resetForm = () => {
    setNewName('');
    setNewType('DYNAMIC');
    setNewRules([emptyRule()]);
    setNewRuleLogic('AND');
    setNewManualIds('');
  };

  // =========================================================================
  // Actions
  // =========================================================================

  const handleCreateSegment = async () => {
    if (!newName.trim()) {
      toast.error('Please enter a segment name');
      return;
    }
    if (newType === 'DYNAMIC' && newRules.some(r => !r.value.trim())) {
      toast.error('All rules must have a value');
      return;
    }
    setCreateBusy(true);
    try {
      const body: Record<string, unknown> = {
        action: 'create-segment',
        name: newName.trim(),
        type: newType,
        ruleLogic: newRuleLogic,
        createdBy: 'current-user',
      };
      if (newType === 'DYNAMIC') {
        body.rules = newRules;
      } else {
        body.manualEmployeeIds = newManualIds
          .split(/[\n,]+/)
          .map(s => s.trim())
          .filter(Boolean);
      }
      await apiPost(body);
      toast.success('Segment created successfully');
      setCreateOpen(false);
      resetCreateForm();
      loadSegments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create segment');
    } finally {
      setCreateBusy(false);
    }
  };

  const handleRecalculate = async (segId: string) => {
    setRecalcBusy(segId);
    try {
      await apiPost({ action: 'recalculate', segmentId: segId });
      toast.success('Segment recalculated');
      loadSegments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to recalculate');
    } finally {
      setRecalcBusy(null);
    }
  };

  const handleAddTag = async () => {
    if (!addTagEmployeeId.trim() || !addTagValue.trim()) {
      toast.error('Employee ID and Tag are required');
      return;
    }
    setAddTagBusy(true);
    try {
      await apiPost({
        action: 'add-tag',
        employeeId: addTagEmployeeId.trim(),
        tag: addTagValue.trim(),
      });
      toast.success('Tag added successfully');
      setAddTagOpen(false);
      setAddTagEmployeeId('');
      setAddTagValue('');
      loadTagCloud();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add tag');
    } finally {
      setAddTagBusy(false);
    }
  };

  const handleRemoveTag = async () => {
    if (!removeTagEmployeeId.trim() || !removeTagValue.trim()) {
      toast.error('Employee ID and Tag are required');
      return;
    }
    setRemoveTagBusy(true);
    try {
      await apiPost({
        action: 'remove-tag',
        employeeId: removeTagEmployeeId.trim(),
        tag: removeTagValue.trim(),
      });
      toast.success('Tag removed successfully');
      setRemoveTagOpen(false);
      setRemoveTagEmployeeId('');
      setRemoveTagValue('');
      loadTagCloud();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove tag');
    } finally {
      setRemoveTagBusy(false);
    }
  };

  const handleBulkTag = async () => {
    if (!bulkTagIds.trim() || !bulkTagValue.trim()) {
      toast.error('Employee IDs and Tag are required');
      return;
    }
    setBulkTagBusy(true);
    try {
      const ids = bulkTagIds
        .split(/[\n,]+/)
        .map(s => s.trim())
        .filter(Boolean);
      await apiPost({
        action: 'bulk-tag',
        employeeIds: ids,
        tag: bulkTagValue.trim(),
      });
      toast.success(`Tag applied to ${ids.length} employee(s)`);
      setBulkTagOpen(false);
      setBulkTagIds('');
      setBulkTagValue('');
      loadTagCloud();
    } catch (err: any) {
      toast.error(err.message || 'Failed to bulk tag');
    } finally {
      setBulkTagBusy(false);
    }
  };

  // =========================================================================
  // Form helpers
  // =========================================================================

  function resetCreateForm() {
    setNewName('');
    setNewType('DYNAMIC');
    setNewRules([emptyRule()]);
    setNewRuleLogic('AND');
    setNewManualIds('');
  }

  function updateRule(index: number, field: keyof SegmentRule, value: string) {
    setNewRules(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  function addRule() {
    setNewRules(prev => [...prev, emptyRule()]);
  }

  function removeRule(index: number) {
    setNewRules(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== index));
  }

  // =========================================================================
  // Filtered lists
  // =========================================================================

  const filteredSegments = useMemo(() => {
    if (!segmentsSearch.trim()) return segments;
    const q = segmentsSearch.toLowerCase();
    return segments.filter(s =>
      s.name.toLowerCase().includes(q) || s.type.toLowerCase().includes(q)
    );
  }, [segments, segmentsSearch]);

  const filteredEmployees = useMemo(() => {
    if (!employeesSearch.trim()) return segmentEmployees;
    const q = employeesSearch.toLowerCase();
    return segmentEmployees.filter(e =>
      e.name?.toLowerCase().includes(q) ||
      e.employeeId?.toLowerCase().includes(q) ||
      e.department?.toLowerCase().includes(q) ||
      e.jobTitle?.toLowerCase().includes(q)
    );
  }, [segmentEmployees, employeesSearch]);

  const maxTagCount = useMemo(() => {
    if (tagCloud.length === 0) return 0;
    return Math.max(...tagCloud.map(t => t.count));
  }, [tagCloud]);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 16 }}>
      {/* Page header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tags style={{ height: 24, width: 24 }} />
            Employee Tagging & Segmentation
          </h1>
          <p style={{ color: C.textMuted, marginTop: 4 }}>
            Create segments, manage tags, and organize employees into targeted groups.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <CVisionTabs
        C={C}
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'segments', label: tr('الشرائح', 'Segments'), icon: <Layers style={{ height: 16, width: 16 }} /> },
          { id: 'tags', label: tr('العلامات', 'Tags'), icon: <Tag style={{ height: 16, width: 16 }} /> },
          { id: 'employees', label: tr('الموظفين', 'Employees'), icon: <Users style={{ height: 16, width: 16 }} /> },
          { id: 'stats', label: tr('الإحصائيات', 'Stats'), icon: <BarChart3 style={{ height: 16, width: 16 }} /> },
        ]}
        style={{ width: '100%' }}
      >
        {/* ============================================================= */}
        {/* TAB 1 : Segments                                              */}
        {/* ============================================================= */}
        <CVisionTabContent tabId="segments">
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
              <CVisionInput C={C}
                placeholder="Search segments..."
                value={segmentsSearch}
                onChange={e => setSegmentsSearch(e.target.value)}
                style={{ paddingLeft: 36 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => loadSegments()} disabled={segmentsLoading}>
                <RefreshCw className={`h-4 w-4 mr-1.5 ${segmentsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </CVisionButton>
              <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => setCreateOpen(true)}>
                <Plus style={{ height: 16, width: 16, marginRight: 6 }} />
                Create Segment
              </CVisionButton>
            </div>
          </div>

          {/* Segments Table */}
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: 0 }}>
              {segmentsLoading ? (
                <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <CVisionSkeletonCard C={C} height={200} style={{ height: 20, width: 160 }}  />
                      <CVisionSkeletonCard C={C} height={200} style={{ height: 20, width: 80 }}  />
                      <CVisionSkeletonCard C={C} height={200} style={{ height: 20, width: 64 }}  />
                      <CVisionSkeletonCard C={C} height={200} style={{ height: 20, width: 128 }}  />
                      <CVisionSkeletonCard C={C} height={200} style={{ height: 20, width: 96 }}  />
                    </div>
                  ))}
                </div>
              ) : filteredSegments.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 64, paddingBottom: 64, color: C.textMuted }}>
                  <Layers style={{ height: 48, width: 48, marginBottom: 12, opacity: 0.4 }} />
                  <p style={{ fontSize: 16, fontWeight: 500 }}>No segments found</p>
                  <p style={{ fontSize: 13, marginTop: 4 }}>Create a segment to get started.</p>
                </div>
              ) : (
                <CVisionTable C={C}>
                  <CVisionTableHead C={C}>
                      <CVisionTh C={C} className="min-w-[180px]">Name</CVisionTh>
                      <CVisionTh C={C}>Type</CVisionTh>
                      <CVisionTh C={C} align="center">Employees</CVisionTh>
                      <CVisionTh C={C}>Rule Logic</CVisionTh>
                      <CVisionTh C={C}>Last Calculated</CVisionTh>
                      <CVisionTh C={C}>Created</CVisionTh>
                      <CVisionTh C={C} align="right">Actions</CVisionTh>
                  </CVisionTableHead>
                  <CVisionTableBody>
                    {filteredSegments.map(seg => (
                      <CVisionTr C={C} key={seg._id}>
                        <CVisionTd style={{ fontWeight: 500 }}>{seg.name}</CVisionTd>
                        <CVisionTd>
                          <CVisionBadge C={C} className={`${typeBadgeVariant(seg.type)} border-0`}>
                            {seg.type === 'DYNAMIC' ? (
                              <><Sparkles style={{ height: 12, width: 12, marginRight: 4 }} /> Dynamic</>
                            ) : (
                              <><CircleDot style={{ height: 12, width: 12, marginRight: 4 }} /> Manual</>
                            )}
                          </CVisionBadge>
                        </CVisionTd>
                        <CVisionTd align="center">
                          <CVisionBadge C={C} variant="outline">{seg.employeeCount ?? 0}</CVisionBadge>
                        </CVisionTd>
                        <CVisionTd>
                          {seg.type === 'DYNAMIC' ? (
                            <CVisionBadge C={C} variant="secondary">{seg.ruleLogic || 'AND'}</CVisionBadge>
                          ) : (
                            <span style={{ color: C.textMuted, fontSize: 13 }}>--</span>
                          )}
                        </CVisionTd>
                        <CVisionTd style={{ fontSize: 13, color: C.textMuted }}>
                          {formatDate(seg.lastCalculatedAt)}
                        </CVisionTd>
                        <CVisionTd style={{ fontSize: 13, color: C.textMuted }}>
                          {formatDate(seg.createdAt)}
                        </CVisionTd>
                        <CVisionTd align="right">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                            <CVisionButton C={C} isDark={isDark}
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedSegmentId(seg._id);
                                setActiveTab('employees');
                              }}
                              title="View employees"
                            >
                              <Users style={{ height: 16, width: 16 }} />
                            </CVisionButton>
                            <CVisionButton C={C} isDark={isDark}
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRecalculate(seg._id)}
                              disabled={recalcBusy === seg._id}
                              title="Recalculate"
                            >
                              {recalcBusy === seg._id ? (
                                <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite' }} />
                              ) : (
                                <RefreshCw style={{ height: 16, width: 16 }} />
                              )}
                            </CVisionButton>
                          </div>
                        </CVisionTd>
                      </CVisionTr>
                    ))}
                  </CVisionTableBody>
                </CVisionTable>
              )}
            </CVisionCardBody>
            {!segmentsLoading && segments.length > 0 && (
              <div style={{ borderTop: `1px solid ${C.border}`, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontSize: 13, color: C.textMuted }}>
                Showing {filteredSegments.length} of {segmentsTotal} segment(s)
              </div>
            )}
          </CVisionCard>
        </div>
        </CVisionTabContent>

        {/* ============================================================= */}
        {/* TAB 2 : Tags                                                  */}
        {/* ============================================================= */}
        <CVisionTabContent tabId="tags">
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Hash style={{ height: 20, width: 20 }} />
              Tag Cloud
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => loadTagCloud()} disabled={tagsLoading}>
                <RefreshCw className={`h-4 w-4 mr-1.5 ${tagsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </CVisionButton>
              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => setRemoveTagOpen(true)}>
                <Trash2 style={{ height: 16, width: 16, marginRight: 6 }} />
                Remove Tag
              </CVisionButton>
              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => setBulkTagOpen(true)}>
                <UserPlus style={{ height: 16, width: 16, marginRight: 6 }} />
                Bulk Tag
              </CVisionButton>
              <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => setAddTagOpen(true)}>
                <Plus style={{ height: 16, width: 16, marginRight: 6 }} />
                Add Tag
              </CVisionButton>
            </div>
          </div>

          {/* Cloud Visualization */}
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Tag Distribution</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                Tags are sized relative to how many employees carry them.
              </div>
            </CVisionCardHeader>
            <CVisionCardBody>
              {tagsLoading ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: 16 }}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 32, width: 96, borderRadius: '50%' }}  />
                  ))}
                </div>
              ) : tagCloud.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 64, paddingBottom: 64, color: C.textMuted }}>
                  <Tag style={{ height: 48, width: 48, marginBottom: 12, opacity: 0.4 }} />
                  <p style={{ fontSize: 16, fontWeight: 500 }}>No tags found</p>
                  <p style={{ fontSize: 13, marginTop: 4 }}>Add tags to employees to see the distribution here.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', padding: 24, minHeight: '200px' }}>
                  {tagCloud.map((item, index) => (
                    <div
                      key={item.tag}
                      className={`cursor-default transition-transform hover:scale-110 ${tagSizeClass(item.count, maxTagCount)} ${tagColorClass(index)}`}
                      title={`${item.tag}: ${item.count} employee(s)`}
                    >
                      {item.tag}
                      <span style={{ marginLeft: 4, fontSize: 12, opacity: 0.6 }}>({item.count})</span>
                    </div>
                  ))}
                </div>
              )}
            </CVisionCardBody>
          </CVisionCard>

          {/* Tag Summary Table */}
          {!tagsLoading && tagCloud.length > 0 && (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ArrowUpDown style={{ height: 16, width: 16 }} />
                  Tag Summary
                </div>
              </CVisionCardHeader>
              <CVisionCardBody style={{ padding: 0 }}>
                <CVisionTable C={C}>
                  <CVisionTableHead C={C}>
                      <CVisionTh C={C}>Tag</CVisionTh>
                      <CVisionTh C={C} align="center">Employee Count</CVisionTh>
                      <CVisionTh C={C}>Distribution</CVisionTh>
                  </CVisionTableHead>
                  <CVisionTableBody>
                    {tagCloud
                      .slice()
                      .sort((a, b) => b.count - a.count)
                      .map((item, index) => {
                        const pct = maxTagCount > 0 ? Math.round((item.count / maxTagCount) * 100) : 0;
                        return (
                          <CVisionTr C={C} key={item.tag}>
                            <CVisionTd>
                              <CVisionBadge C={C} variant="outline" style={{ gap: 4 }}>
                                <Tag style={{ height: 12, width: 12 }} />
                                {item.tag}
                              </CVisionBadge>
                            </CVisionTd>
                            <CVisionTd align="center" style={{ fontWeight: 500 }}>{item.count}</CVisionTd>
                            <CVisionTd>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ height: 8, flex: 1, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}>
                                  <div
                                    className={`h-full rounded-full ${tagColorClass(index).replace('text-', 'bg-')}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span style={{ fontSize: 12, color: C.textMuted, width: 40, textAlign: 'right' }}>
                                  {pct}%
                                </span>
                              </div>
                            </CVisionTd>
                          </CVisionTr>
                        );
                      })}
                  </CVisionTableBody>
                </CVisionTable>
              </CVisionCardBody>
            </CVisionCard>
          )}

          {/* Default Tags Reference */}
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Default Tags Reference</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                These are the standard tags available in the system.
              </div>
            </CVisionCardHeader>
            <CVisionCardBody>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {DEFAULT_TAGS.map(tag => (
                  <CVisionBadge C={C} key={tag} variant="secondary" style={{ gap: 4, paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4 }}>
                    <Tag style={{ height: 12, width: 12 }} />
                    {tag}
                  </CVisionBadge>
                ))}
              </div>
            </CVisionCardBody>
          </CVisionCard>
        </div>
        </CVisionTabContent>

        {/* ============================================================= */}
        {/* TAB 3 : Employees                                             */}
        {/* ============================================================= */}
        <CVisionTabContent tabId="employees">
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Segment selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
              <CVisionLabel C={C}>Select Segment</CVisionLabel>
              <CVisionSelect
                C={C}
                value={selectedSegmentId || undefined}
                onChange={val => setSelectedSegmentId(val)}
                placeholder="Choose a segment..."
                options={[...segments.map(seg => (
                    ({ value: seg._id, label: `${seg.name} (${seg.type})` })
                  ))]}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {selectedSegmentId && (
                <>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
                    <CVisionInput C={C}
                      placeholder="Search employees..."
                      value={employeesSearch}
                      onChange={e => setEmployeesSearch(e.target.value)}
                      style={{ paddingLeft: 36 }}
                    />
                  </div>
                  <CVisionButton C={C} isDark={isDark}
                    variant="outline"
                    size="sm"
                    onClick={() => loadSegmentEmployees(selectedSegmentId)}
                    disabled={employeesLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1.5 ${employeesLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </CVisionButton>
                </>
              )}
            </div>
          </div>

          {/* Employees Table */}
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: 0 }}>
              {!selectedSegmentId ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 64, paddingBottom: 64, color: C.textMuted }}>
                  <Filter style={{ height: 48, width: 48, marginBottom: 12, opacity: 0.4 }} />
                  <p style={{ fontSize: 16, fontWeight: 500 }}>No segment selected</p>
                  <p style={{ fontSize: 13, marginTop: 4 }}>
                    Select a segment above to view its employees.
                  </p>
                </div>
              ) : employeesLoading ? (
                <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <CVisionSkeletonCard C={C} height={200} style={{ height: 20, width: 112 }}  />
                      <CVisionSkeletonCard C={C} height={200} style={{ height: 20, width: 144 }}  />
                      <CVisionSkeletonCard C={C} height={200} style={{ height: 20, width: 112 }}  />
                      <CVisionSkeletonCard C={C} height={200} style={{ height: 20, width: 128 }}  />
                      <CVisionSkeletonCard C={C} height={200} style={{ height: 20, width: 96 }}  />
                    </div>
                  ))}
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 64, paddingBottom: 64, color: C.textMuted }}>
                  <Users style={{ height: 48, width: 48, marginBottom: 12, opacity: 0.4 }} />
                  <p style={{ fontSize: 16, fontWeight: 500 }}>No employees in this segment</p>
                  <p style={{ fontSize: 13, marginTop: 4 }}>
                    This segment has no matching employees, or your search did not match any records.
                  </p>
                </div>
              ) : (
                <CVisionTable C={C}>
                  <CVisionTableHead C={C}>
                      <CVisionTh C={C}>Employee ID</CVisionTh>
                      <CVisionTh C={C}>Name</CVisionTh>
                      <CVisionTh C={C}>Department</CVisionTh>
                      <CVisionTh C={C}>Job Title</CVisionTh>
                      <CVisionTh C={C}>Tags</CVisionTh>
                  </CVisionTableHead>
                  <CVisionTableBody>
                    {filteredEmployees.map(emp => (
                      <CVisionTr C={C} key={emp._id}>
                        <CVisionTd style={{ fontFamily: 'monospace', fontSize: 13 }}>{emp.employeeId}</CVisionTd>
                        <CVisionTd style={{ fontWeight: 500 }}>{emp.name}</CVisionTd>
                        <CVisionTd>{emp.department || '--'}</CVisionTd>
                        <CVisionTd>{emp.jobTitle || '--'}</CVisionTd>
                        <CVisionTd>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {(emp.tags || []).length > 0 ? (
                              emp.tags.map(tag => (
                                <CVisionBadge C={C} key={tag} variant="secondary" style={{ fontSize: 12 }}>
                                  {tag}
                                </CVisionBadge>
                              ))
                            ) : (
                              <span style={{ fontSize: 12, color: C.textMuted }}>No tags</span>
                            )}
                          </div>
                        </CVisionTd>
                      </CVisionTr>
                    ))}
                  </CVisionTableBody>
                </CVisionTable>
              )}
            </CVisionCardBody>
            {selectedSegmentId && !employeesLoading && segmentEmployees.length > 0 && (
              <div style={{ borderTop: `1px solid ${C.border}`, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontSize: 13, color: C.textMuted }}>
                Showing {filteredEmployees.length} of {segmentEmployeesTotal} employee(s)
              </div>
            )}
          </CVisionCard>
        </div>
        </CVisionTabContent>

        {/* ============================================================= */}
        {/* TAB 4 : Stats                                                 */}
        {/* ============================================================= */}
        <CVisionTabContent tabId="stats">
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <PieChart style={{ height: 20, width: 20 }} />
              Segmentation Overview
            </h2>
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => loadStats()} disabled={statsLoading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${statsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </CVisionButton>
          </div>

          {statsLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <CVisionCard C={C} key={i}>
                  <CVisionCardBody style={{ padding: 24 }}>
                    <CVisionSkeletonCard C={C} height={200} style={{ height: 16, width: 112, marginBottom: 12 }}  />
                    <CVisionSkeletonCard C={C} height={200} style={{ height: 32, width: 64 }}  />
                  </CVisionCardBody>
                </CVisionCard>
              ))}
            </div>
          ) : !stats ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 64, paddingBottom: 64, color: C.textMuted }}>
              <BarChart3 style={{ height: 48, width: 48, marginBottom: 12, opacity: 0.4 }} />
              <p style={{ fontSize: 16, fontWeight: 500 }}>No statistics available</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Data will appear here once segments and tags are created.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
                {/* Total Segments */}
                <CVisionCard C={C}>
                  <CVisionCardBody style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: C.textMuted }}>Total Segments</p>
                      <Layers style={{ height: 20, width: 20 }} />
                    </div>
                    <p style={{ fontSize: 30, fontWeight: 700, marginTop: 8 }}>{stats.totalSegments}</p>
                    <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                      All active segments in the system
                    </p>
                  </CVisionCardBody>
                </CVisionCard>

                {/* Manual Segments */}
                <CVisionCard C={C}>
                  <CVisionCardBody style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: C.textMuted }}>Manual Segments</p>
                      <CircleDot style={{ height: 20, width: 20 }} />
                    </div>
                    <p style={{ fontSize: 30, fontWeight: 700, marginTop: 8 }}>{stats.manualSegments}</p>
                    <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                      Segments with manually assigned employees
                    </p>
                  </CVisionCardBody>
                </CVisionCard>

                {/* Dynamic Segments */}
                <CVisionCard C={C}>
                  <CVisionCardBody style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: C.textMuted }}>Dynamic Segments</p>
                      <Sparkles style={{ height: 20, width: 20, color: C.orange }} />
                    </div>
                    <p style={{ fontSize: 30, fontWeight: 700, marginTop: 8 }}>{stats.dynamicSegments}</p>
                    <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                      Rule-based segments that auto-calculate
                    </p>
                  </CVisionCardBody>
                </CVisionCard>

                {/* Tagged Employees */}
                <CVisionCard C={C}>
                  <CVisionCardBody style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: C.textMuted }}>Tagged Employees</p>
                      <Users style={{ height: 20, width: 20 }} />
                    </div>
                    <p style={{ fontSize: 30, fontWeight: 700, marginTop: 8 }}>{stats.taggedEmployees}</p>
                    <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                      Employees with at least one tag assigned
                    </p>
                  </CVisionCardBody>
                </CVisionCard>
              </div>

              {/* Breakdown visual */}
              <CVisionCard C={C}>
                <CVisionCardHeader C={C}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Segment Breakdown</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>
                    Distribution of manual vs. dynamic segments.
                  </div>
                </CVisionCardHeader>
                <CVisionCardBody>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Manual bar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CircleDot style={{ height: 14, width: 14 }} />
                          Manual Segments
                        </span>
                        <span style={{ fontWeight: 500 }}>
                          {stats.manualSegments} / {stats.totalSegments}
                        </span>
                      </div>
                      <div style={{ height: 12, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}>
                        <div
                          style={{ borderRadius: '50%', transition: 'all 0.2s', width: stats.totalSegments > 0
                              ? `${(stats.manualSegments / stats.totalSegments) * 100}%`
                              : '0%' }}
                        />
                      </div>
                    </div>

                    {/* Dynamic bar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Sparkles style={{ height: 14, width: 14, color: C.orange }} />
                          Dynamic Segments
                        </span>
                        <span style={{ fontWeight: 500 }}>
                          {stats.dynamicSegments} / {stats.totalSegments}
                        </span>
                      </div>
                      <div style={{ height: 12, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}>
                        <div
                          style={{ background: C.orangeDim, borderRadius: '50%', transition: 'all 0.2s', width: stats.totalSegments > 0
                              ? `${(stats.dynamicSegments / stats.totalSegments) * 100}%`
                              : '0%' }}
                        />
                      </div>
                    </div>

                    {/* Tagged employees bar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Tag style={{ height: 14, width: 14 }} />
                          Tagged Employees
                        </span>
                        <span style={{ fontWeight: 500 }}>{stats.taggedEmployees}</span>
                      </div>
                      <div style={{ height: 12, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}>
                        <div
                          style={{ borderRadius: '50%', transition: 'all 0.2s', width: stats.taggedEmployees > 0 ? '100%' : '0%' }}
                        />
                      </div>
                    </div>
                  </div>
                </CVisionCardBody>
              </CVisionCard>

              {/* Quick actions */}
              <CVisionCard C={C}>
                <CVisionCardHeader C={C}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Quick Actions</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>
                    Common tasks for managing segments and tags.
                  </div>
                </CVisionCardHeader>
                <CVisionCardBody>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 12 }}>
                    <CVisionButton C={C} isDark={isDark}
                      variant="outline"
                      style={{ paddingTop: 12, paddingBottom: 12 }}
                      onClick={() => {
                        setActiveTab('segments');
                        setCreateOpen(true);
                      }}
                    >
                      <Plus style={{ height: 16, width: 16, marginRight: 8 }} />
                      <div style={{ textAlign: 'left' }}>
                        <p style={{ fontWeight: 500, fontSize: 13 }}>Create Segment</p>
                        <p style={{ fontSize: 12, color: C.textMuted }}>Build a new segment</p>
                      </div>
                    </CVisionButton>
                    <CVisionButton C={C} isDark={isDark}
                      variant="outline"
                      style={{ paddingTop: 12, paddingBottom: 12 }}
                      onClick={() => {
                        setActiveTab('tags');
                        setAddTagOpen(true);
                      }}
                    >
                      <Tag style={{ height: 16, width: 16, marginRight: 8 }} />
                      <div style={{ textAlign: 'left' }}>
                        <p style={{ fontWeight: 500, fontSize: 13 }}>Add Tag</p>
                        <p style={{ fontSize: 12, color: C.textMuted }}>Tag an employee</p>
                      </div>
                    </CVisionButton>
                    <CVisionButton C={C} isDark={isDark}
                      variant="outline"
                      style={{ paddingTop: 12, paddingBottom: 12 }}
                      onClick={() => {
                        setActiveTab('tags');
                        setBulkTagOpen(true);
                      }}
                    >
                      <UserPlus style={{ height: 16, width: 16, marginRight: 8 }} />
                      <div style={{ textAlign: 'left' }}>
                        <p style={{ fontWeight: 500, fontSize: 13 }}>Bulk Tag</p>
                        <p style={{ fontSize: 12, color: C.textMuted }}>Tag multiple employees</p>
                      </div>
                    </CVisionButton>
                    <CVisionButton C={C} isDark={isDark}
                      variant="outline"
                      style={{ paddingTop: 12, paddingBottom: 12 }}
                      onClick={() => setActiveTab('employees')}
                    >
                      <Users style={{ height: 16, width: 16, marginRight: 8 }} />
                      <div style={{ textAlign: 'left' }}>
                        <p style={{ fontWeight: 500, fontSize: 13 }}>View Employees</p>
                        <p style={{ fontSize: 12, color: C.textMuted }}>Browse segment members</p>
                      </div>
                    </CVisionButton>
                  </div>
                </CVisionCardBody>
              </CVisionCard>
            </>
          )}
        </div>
        </CVisionTabContent>
      </CVisionTabs>

      {/* =============================================================== */}
      {/* DIALOG : Create Segment                                         */}
      {/* =============================================================== */}
      <CVisionDialog C={C} open={createOpen} onClose={() => { resetForm(); setCreateOpen(false); }} title="Create" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              Define a new segment by providing a name, type, and rules or employee IDs.
            </p>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8, paddingRight: 4 }}>
            {/* Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C} htmlFor="seg-name">Segment Name</CVisionLabel>
              <CVisionInput C={C}
                id="seg-name"
                placeholder="e.g. High Performers in Engineering"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </div>

            {/* Type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C}>Type</CVisionLabel>
              <CVisionSelect
                C={C}
                value={newType || undefined}
                onChange={val => setNewType(val as 'MANUAL' | 'DYNAMIC')}
                placeholder="Select type"
                options={[{ value: 'DYNAMIC', label: `<span style=${{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles style=${{ height: 14, width: 14 }} /> Dynamic (Rule-Based)
                    </span>` }, { value: 'MANUAL', label: `<span style=${{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CircleDot style=${{ height: 14, width: 14 }} /> Manual (Employee IDs)
                    </span>` }]}
              />
            </div>

            {/* Dynamic rules builder */}
            {newType === 'DYNAMIC' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <CVisionLabel C={C}>Rules</CVisionLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>Logic:</CVisionLabel>
                    <CVisionSelect
                C={C}
                value={newRuleLogic || undefined}
                onChange={val => setNewRuleLogic(val as 'AND' | 'OR')}
                options={[{ value: 'AND', label: 'AND' }, { value: 'OR', label: 'OR' }]}
              />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {newRules.map((rule, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, border: `1px solid ${C.border}`, borderRadius: 12 }}>
                      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {/* Field */}
                        <CVisionSelect
                C={C}
                value={rule.field || undefined}
                onChange={val => updateRule(idx, 'field', val)}
                placeholder="Field"
                options={[...RULE_FIELDS.map(f => (
                              ({ value: f, label: f })
                            ))]}
              />

                        {/* Operator */}
                        <CVisionSelect
                C={C}
                value={rule.operator || undefined}
                onChange={val => updateRule(idx, 'operator', val)}
                placeholder="Operator"
                options={[...OPERATORS.map(op => (
                              ({ value: op.value, label: op.label })
                            ))]}
              />

                        {/* Value */}
                        <CVisionInput C={C}
                          style={{ height: 32, fontSize: 12 }}
                          placeholder="Value"
                          value={rule.value}
                          onChange={e => updateRule(idx, 'value', e.target.value)}
                        />
                      </div>

                      <CVisionButton C={C} isDark={isDark}
                        variant="ghost"
                        size="sm"
                        style={{ height: 32, width: 32, padding: 0 }}
                        onClick={() => removeRule(idx)}
                        disabled={newRules.length <= 1}
                      >
                        <X style={{ height: 14, width: 14 }} />
                      </CVisionButton>
                    </div>
                  ))}
                </div>

                <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={addRule} style={{ width: '100%' }}>
                  <Plus style={{ height: 16, width: 16, marginRight: 6 }} />
                  Add Rule
                </CVisionButton>

                {newRules.length > 1 && (
                  <p style={{ fontSize: 12, color: C.textMuted, textAlign: 'center' }}>
                    Employees must match <strong>{newRuleLogic === 'AND' ? 'all' : 'any'}</strong> of the above rules.
                  </p>
                )}
              </div>
            )}

            {/* Manual employee IDs */}
            {newType === 'MANUAL' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C} htmlFor="manual-ids">Employee IDs</CVisionLabel>
                <CVisionTextarea C={C}
                  id="manual-ids"
                  placeholder="Enter employee IDs, one per line or comma-separated..."
                  rows={6}
                  value={newManualIds}
                  onChange={e => setNewManualIds(e.target.value)}
                />
                <p style={{ fontSize: 12, color: C.textMuted }}>
                  {newManualIds
                    .split(/[\n,]+/)
                    .map(s => s.trim())
                    .filter(Boolean).length}{' '}
                  ID(s) entered
                </p>
              </div>
            )}
          </div>

          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => { setCreateOpen(false); resetCreateForm(); }}>
              Cancel
            </CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleCreateSegment} disabled={createBusy}>
              {createBusy ? (
                <><Loader2 style={{ height: 16, width: 16, marginRight: 6, animation: 'spin 1s linear infinite' }} /> Creating...</>
              ) : (
                <><Plus style={{ height: 16, width: 16, marginRight: 6 }} /> Create Segment</>
              )}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* =============================================================== */}
      {/* DIALOG : Add Tag                                                */}
      {/* =============================================================== */}
      <CVisionDialog C={C} open={addTagOpen} onClose={() => { setAddTagOpen(false); setAddTagEmployeeId(""); setAddTagValue(""); }} title="Add Tag" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              Assign a tag to a specific employee by entering their ID and selecting a tag.
            </p>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C} htmlFor="add-tag-emp">Employee ID</CVisionLabel>
              <CVisionInput C={C}
                id="add-tag-emp"
                placeholder="Enter employee ID..."
                value={addTagEmployeeId}
                onChange={e => setAddTagEmployeeId(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C}>Tag</CVisionLabel>
              <CVisionSelect
                C={C}
                value={addTagValue || undefined}
                onChange={setAddTagValue}
                placeholder="Select a tag..."
                options={[...(availableTags.length > 0 ? availableTags : DEFAULT_TAGS).map(tag => (
                    ({ value: tag, label: tag })
                  ))]}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C} htmlFor="add-tag-custom">Or enter a custom tag</CVisionLabel>
              <CVisionInput C={C}
                id="add-tag-custom"
                placeholder="Custom tag name..."
                value={addTagValue}
                onChange={e => setAddTagValue(e.target.value)}
              />
            </div>
          </div>

          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => { setAddTagOpen(false); setAddTagEmployeeId(''); setAddTagValue(''); }}>
              Cancel
            </CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleAddTag} disabled={addTagBusy}>
              {addTagBusy ? (
                <><Loader2 style={{ height: 16, width: 16, marginRight: 6, animation: 'spin 1s linear infinite' }} /> Adding...</>
              ) : (
                <><Tag style={{ height: 16, width: 16, marginRight: 6 }} /> Add Tag</>
              )}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* =============================================================== */}
      {/* DIALOG : Remove Tag                                             */}
      {/* =============================================================== */}
      <CVisionDialog C={C} open={removeTagOpen} onClose={() => { setRemoveTagOpen(false); setRemoveTagEmployeeId(""); setRemoveTagValue(""); }} title="Remove Tag" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              Remove an existing tag from an employee by entering their ID and specifying the tag.
            </p>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C} htmlFor="rm-tag-emp">Employee ID</CVisionLabel>
              <CVisionInput C={C}
                id="rm-tag-emp"
                placeholder="Enter employee ID..."
                value={removeTagEmployeeId}
                onChange={e => setRemoveTagEmployeeId(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C}>Tag to Remove</CVisionLabel>
              <CVisionSelect
                C={C}
                value={removeTagValue || undefined}
                onChange={setRemoveTagValue}
                placeholder="Select a tag..."
                options={[...(availableTags.length > 0 ? availableTags : DEFAULT_TAGS).map(tag => (
                    ({ value: tag, label: tag })
                  ))]}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C} htmlFor="rm-tag-custom">Or enter the tag name</CVisionLabel>
              <CVisionInput C={C}
                id="rm-tag-custom"
                placeholder="Tag name..."
                value={removeTagValue}
                onChange={e => setRemoveTagValue(e.target.value)}
              />
            </div>
          </div>

          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => { setRemoveTagOpen(false); setRemoveTagEmployeeId(''); setRemoveTagValue(''); }}>
              Cancel
            </CVisionButton>
            <CVisionButton C={C} isDark={isDark} variant="danger" onClick={handleRemoveTag} disabled={removeTagBusy}>
              {removeTagBusy ? (
                <><Loader2 style={{ height: 16, width: 16, marginRight: 6, animation: 'spin 1s linear infinite' }} /> Removing...</>
              ) : (
                <><Trash2 style={{ height: 16, width: 16, marginRight: 6 }} /> Remove Tag</>
              )}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* =============================================================== */}
      {/* DIALOG : Bulk Tag                                               */}
      {/* =============================================================== */}
      <CVisionDialog C={C} open={bulkTagOpen} onClose={() => { setBulkTagOpen(false); setBulkTagIds(""); setBulkTagValue(""); }} title="Bulk Tag" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              Apply a single tag to multiple employees at once by entering their IDs.
            </p>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C}>Tag</CVisionLabel>
              <CVisionSelect
                C={C}
                value={bulkTagValue || undefined}
                onChange={setBulkTagValue}
                placeholder="Select a tag..."
                options={[...(availableTags.length > 0 ? availableTags : DEFAULT_TAGS).map(tag => (
                    ({ value: tag, label: tag })
                  ))]}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C} htmlFor="bulk-custom">Or enter a custom tag</CVisionLabel>
              <CVisionInput C={C}
                id="bulk-custom"
                placeholder="Custom tag name..."
                value={bulkTagValue}
                onChange={e => setBulkTagValue(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C} htmlFor="bulk-ids">Employee IDs</CVisionLabel>
              <CVisionTextarea C={C}
                id="bulk-ids"
                placeholder="Enter employee IDs, one per line or comma-separated..."
                rows={6}
                value={bulkTagIds}
                onChange={e => setBulkTagIds(e.target.value)}
              />
              <p style={{ fontSize: 12, color: C.textMuted }}>
                {bulkTagIds
                  .split(/[\n,]+/)
                  .map(s => s.trim())
                  .filter(Boolean).length}{' '}
                ID(s) entered
              </p>
            </div>
          </div>

          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => { setBulkTagOpen(false); setBulkTagIds(''); setBulkTagValue(''); }}>
              Cancel
            </CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleBulkTag} disabled={bulkTagBusy}>
              {bulkTagBusy ? (
                <><Loader2 style={{ height: 16, width: 16, marginRight: 6, animation: 'spin 1s linear infinite' }} /> Applying...</>
              ) : (
                <><UserPlus style={{ height: 16, width: 16, marginRight: 6 }} /> Apply Tag</>
              )}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}
