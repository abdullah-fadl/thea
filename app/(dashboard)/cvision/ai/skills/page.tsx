'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionSelect, CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import {
  GraduationCap,
  Search,
  Users,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Star,
  Target,
  Building2,
  Lightbulb,
  Pencil,
  Filter,
} from 'lucide-react';

// ─── Types (matching API response shapes) ──────────────────────────────────

interface SkillDefinition {
  id: string;
  name: string;
  nameAr: string;
  category: 'TECHNICAL' | 'SOFT' | 'MANAGEMENT' | 'DOMAIN' | 'LANGUAGE' | 'CERTIFICATION';
  subcategory?: string;
  description?: string;
}

interface ProficiencyLabels {
  [level: number]: { en: string; ar: string };
}

interface SkillCoverage {
  skillName: string;
  employeesWithSkill: number;
  averageLevel: number;
  maxLevel: number;
}

interface TopSkill {
  name: string;
  count: number;
  avgLevel: number;
}

interface SkillGap {
  skillName: string;
  skillNameAr: string;
  category: string;
  requiredLevel: number;
  currentLevel: number;
  gap: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  affectedEmployees: number;
  trainingRecommendation: string;
  trainingRecommendationAr: string;
}

interface DepartmentSummary {
  department: string;
  totalEmployees: number;
  skillCoverage: SkillCoverage[];
  topSkills: TopSkill[];
  skillGaps: SkillGap[];
  overallMaturityScore: number;
}

interface OrgReport {
  organizationScore: number;
  strongestDepartment: string;
  weakestDepartment: string;
  criticalGaps: SkillGap[];
  recommendations: string[];
  departmentCount: number;
  totalEmployees: number;
  departmentSummaries: DepartmentSummary[];
}

interface SkillSearchResult {
  employeeId: string;
  employeeName: string;
  department: string;
  proficiencyLevel: number;
  source: string;
}

interface GapAssessment {
  employeeId: string;
  employeeName: string;
  currentSkillCount: number;
  totalGaps: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
  gaps: SkillGap[];
}

interface BulkAssessResult {
  department: string;
  employeeCount: number;
  assessments: GapAssessment[];
  aggregateGaps: {
    skillName: string;
    affectedEmployees: number;
    averageGap: number;
    priority: string;
  }[];
  totalUniqueGaps: number;
}

interface EmployeeSearchItem {
  id: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  departmentId?: string;
  departmentName?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  TECHNICAL: 'bg-blue-100 text-blue-800',
  SOFT: 'bg-green-100 text-green-800',
  MANAGEMENT: 'bg-purple-100 text-purple-800',
  DOMAIN: 'bg-orange-100 text-orange-800',
  LANGUAGE: 'bg-cyan-100 text-cyan-800',
  CERTIFICATION: 'bg-yellow-100 text-yellow-800',
};

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-green-100 text-green-800',
};

const PRIORITY_BORDERS: Record<string, string> = {
  HIGH: 'border-l-red-500',
  MEDIUM: 'border-l-yellow-500',
  LOW: 'border-l-green-500',
};

function levelStars(level: number, max: number = 5) {
  return Array.from({ length: max }, (_, i) => (
    <Star
      key={i}
      className={cn(
        'h-3.5 w-3.5',
        i < level ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'
      )}
    />
  ));
}

function maturityColor(score: number): string {
  if (score >= 70) return 'text-green-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

function maturityProgressColor(score: number): string {
  if (score >= 70) return '[&>div]:bg-green-500';
  if (score >= 40) return '[&>div]:bg-yellow-500';
  return '[&>div]:bg-red-500';
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function SkillsMatrixPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const { toast } = useToast();

  // ── Shared state ──
  const [defaults, setDefaults] = useState<{ skills: SkillDefinition[]; proficiencyLabels: ProficiencyLabels } | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // ── Organization Overview tab ──
  const [orgReport, setOrgReport] = useState<OrgReport | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

  // ── Skill Search tab ──
  const [searchSkill, setSearchSkill] = useState('');
  const [searchMinLevel, setSearchMinLevel] = useState('1');
  const [searchDept, setSearchDept] = useState('__all__');
  const [searchResults, setSearchResults] = useState<SkillSearchResult[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [popularSkills, setPopularSkills] = useState<TopSkill[]>([]);

  // ── Gap Analysis tab ──
  const [gapMode, setGapMode] = useState<'individual' | 'department'>('individual');
  const [gapEmployeeSearch, setGapEmployeeSearch] = useState('');
  const [gapEmployeeResults, setGapEmployeeResults] = useState<EmployeeSearchItem[]>([]);
  const [gapSelectedEmployee, setGapSelectedEmployee] = useState<EmployeeSearchItem | null>(null);
  const [gapEmployeeLoading, setGapEmployeeLoading] = useState(false);
  const [gapIndividualResult, setGapIndividualResult] = useState<{
    employeeId: string;
    employeeName: string;
    currentSkillCount: number;
    gaps: SkillGap[];
    totalGaps: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
  } | null>(null);
  const [gapIndividualLoading, setGapIndividualLoading] = useState(false);
  const [gapDeptId, setGapDeptId] = useState('');
  const [gapBulkResult, setGapBulkResult] = useState<BulkAssessResult | null>(null);
  const [gapBulkLoading, setGapBulkLoading] = useState(false);

  // ── Skill Update Modal ──
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateEmployeeId, setUpdateEmployeeId] = useState('');
  const [updateSkillId, setUpdateSkillId] = useState('');
  const [updateLevel, setUpdateLevel] = useState('3');
  const [updateSaving, setUpdateSaving] = useState(false);

  // ── Debounce timer ──
  const [empSearchTimer, setEmpSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // ─── API fetch helper ────────────────────────────────────────────────────

  const apiFetch = useCallback(async (url: string, options?: RequestInit) => {
    if (options?.method === 'POST' || options?.method === 'PATCH' || options?.method === 'PUT') {
      const body = options?.body ? JSON.parse(options.body as string) : undefined;
      const json = await cvisionMutate<any>(url, (options.method as 'POST' | 'PUT' | 'PATCH' | 'DELETE'), body);
      if (!json.success) throw new Error(json.error || 'Request failed');
      return json.data;
    }
    const [baseUrl, qs] = url.split('?');
    const params: Record<string, string> = {};
    if (qs) new URLSearchParams(qs).forEach((v, k) => { params[k] = v; });
    const json = await cvisionFetch<any>(baseUrl, { params });
    if (!json.success) throw new Error(json.error || 'Request failed');
    return json.data;
  }, []);

  // ─── Load defaults on mount ──────────────────────────────────────────────

  useEffect(() => {
    apiFetch('/api/cvision/ai/skills?action=defaults')
      .then(setDefaults)
      .catch(() => {
        // Non-critical: defaults are used for skill picker UI
      });
  }, [apiFetch]);

  // ─── Organization Overview ───────────────────────────────────────────────

  const loadOrgReport = useCallback(async () => {
    setOrgLoading(true);
    setOrgError(null);
    try {
      const data = await apiFetch('/api/cvision/ai/skills?action=organization-report');
      setOrgReport(data);
      // Extract popular skills for search tab
      if (data.departmentSummaries?.length) {
        const allTop: TopSkill[] = [];
        for (const dept of data.departmentSummaries) {
          for (const ts of dept.topSkills) {
            const existing = allTop.find((t) => t.name === ts.name);
            if (existing) {
              existing.count += ts.count;
              existing.avgLevel = (existing.avgLevel + ts.avgLevel) / 2;
            } else {
              allTop.push({ ...ts });
            }
          }
        }
        allTop.sort((a, b) => b.count - a.count);
        setPopularSkills(allTop.slice(0, 12));
      }
    } catch (err: any) {
      setOrgError(err.message || 'Failed to load organization report');
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setOrgLoading(false);
    }
  }, [apiFetch, toast]);

  useEffect(() => {
    loadOrgReport();
  }, [loadOrgReport]);

  // ─── Skill Search ────────────────────────────────────────────────────────

  const handleSkillSearch = useCallback(async () => {
    if (!searchSkill.trim()) {
      toast({ title: 'Validation', description: 'Enter a skill name to search.' });
      return;
    }
    setSearchLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'search',
        skill: searchSkill.trim(),
        minLevel: searchMinLevel,
      });
      if (searchDept && searchDept !== '__all__') params.set('department', searchDept);
      const data = await apiFetch(`/api/cvision/ai/skills?${params}`);
      setSearchResults(data.results || []);
    } catch (err: any) {
      toast({ title: 'Search Error', description: err.message, variant: 'destructive' });
    } finally {
      setSearchLoading(false);
    }
  }, [apiFetch, searchSkill, searchMinLevel, searchDept, toast]);

  // ─── Employee search (for Gap Analysis individual mode) ──────────────────

  const searchEmployees = useCallback(
    (query: string) => {
      setGapEmployeeSearch(query);
      if (empSearchTimer) clearTimeout(empSearchTimer);
      if (query.trim().length < 2) {
        setGapEmployeeResults([]);
        return;
      }
      const timer = setTimeout(async () => {
        setGapEmployeeLoading(true);
        try {
          const res = await fetch(
            `/api/cvision/employees?search=${encodeURIComponent(query.trim())}&limit=10`,
            { credentials: 'include', cache: 'no-store' }
          );
          const json = await res.json();
          if (json.success && json.data) {
            const list = Array.isArray(json.data) ? json.data : json.data.employees || [];
            setGapEmployeeResults(list);
          }
        } catch {
          // Silent fail for dropdown
        } finally {
          setGapEmployeeLoading(false);
        }
      }, 300);
      setEmpSearchTimer(timer);
    },
    [empSearchTimer]
  );

  // ─── Individual Gap Assessment ───────────────────────────────────────────

  const assessIndividualGaps = useCallback(
    async (employeeId: string) => {
      setGapIndividualLoading(true);
      setGapIndividualResult(null);
      try {
        const data = await apiFetch('/api/cvision/ai/skills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'assess-gaps', employeeId }),
        });
        setGapIndividualResult(data);
      } catch (err: any) {
        toast({ title: 'Assessment Error', description: err.message, variant: 'destructive' });
      } finally {
        setGapIndividualLoading(false);
      }
    },
    [apiFetch, toast]
  );

  // ─── Department Bulk Assessment ──────────────────────────────────────────

  const assessDepartmentGaps = useCallback(async () => {
    if (!gapDeptId) {
      toast({ title: 'Validation', description: 'Select a department first.' });
      return;
    }
    setGapBulkLoading(true);
    setGapBulkResult(null);
    try {
      const data = await apiFetch('/api/cvision/ai/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk-assess-department', department: gapDeptId }),
      });
      setGapBulkResult(data);
    } catch (err: any) {
      toast({ title: 'Assessment Error', description: err.message, variant: 'destructive' });
    } finally {
      setGapBulkLoading(false);
    }
  }, [apiFetch, gapDeptId, toast]);

  // ─── Skill Update ────────────────────────────────────────────────────────

  const handleSkillUpdate = useCallback(async () => {
    if (!updateEmployeeId || !updateSkillId) {
      toast({ title: 'Validation', description: 'Employee and skill are required.' });
      return;
    }
    setUpdateSaving(true);
    try {
      await apiFetch('/api/cvision/ai/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-employee-skill',
          employeeId: updateEmployeeId,
          skillId: updateSkillId,
          proficiencyLevel: parseInt(updateLevel),
        }),
      });
      toast({ title: 'Success', description: 'Skill updated successfully.' });
      setUpdateModalOpen(false);
      setUpdateEmployeeId('');
      setUpdateSkillId('');
      setUpdateLevel('3');
      // Refresh individual gap result if same employee
      if (gapSelectedEmployee && gapSelectedEmployee.id === updateEmployeeId) {
        assessIndividualGaps(updateEmployeeId);
      }
    } catch (err: any) {
      toast({ title: 'Update Error', description: err.message, variant: 'destructive' });
    } finally {
      setUpdateSaving(false);
    }
  }, [apiFetch, updateEmployeeId, updateSkillId, updateLevel, toast, gapSelectedEmployee, assessIndividualGaps]);

  // ─── Department list (derived from org report) ───────────────────────────

  const departmentList = orgReport?.departmentSummaries?.map((d) => d.department) || [];

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <GraduationCap style={{ height: 24, width: 24 }} />
            Skills Matrix
          </h1>
          <p style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
            Track, analyze, and develop employee skills across the organization
          </p>
        </div>
        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={loadOrgReport} disabled={orgLoading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', orgLoading && 'animate-spin')} />
          Refresh
        </CVisionButton>
      </div>

      {/* Tabs */}
      <CVisionTabs
        C={C}
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'overview', label: tr('نظرة عامة على المنظمة', 'Organization Overview'), icon: <Building2 style={{ height: 16, width: 16 }} /> },
          { id: 'search', label: tr('بحث المهارات', 'Skill Search'), icon: <Search style={{ height: 16, width: 16 }} /> },
          { id: 'gaps', label: 'Gap Analysis', icon: <Target style={{ height: 16, width: 16 }} /> },
        ]}
      >
        {/* ═══════════════════ Tab 1: Organization Overview ═══════════════════ */}
        <CVisionTabContent tabId="overview">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {orgLoading && !orgReport ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
                {[1, 2, 3, 4].map((i) => (
                  <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 112, borderRadius: 16 }}  />
                ))}
              </div>
              <CVisionSkeletonCard C={C} height={200} style={{ height: 256, borderRadius: 16 }}  />
            </div>
          ) : orgError ? (
            <CVisionCard C={C}>
              <CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}>
                <AlertTriangle style={{ height: 32, width: 32, marginBottom: 12 }} />
                <p style={{ fontWeight: 500 }}>{orgError}</p>
                <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ marginTop: 16 }} onClick={loadOrgReport}>
                  Retry
                </CVisionButton>
              </CVisionCardBody>
            </CVisionCard>
          ) : orgReport ? (
            <>
              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
                <CVisionCard C={C}>
                  <CVisionCardBody style={{ paddingTop: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontSize: 13, color: C.textMuted }}>{tr('درجة المنظمة', 'Organization Score')}</p>
                        <p className={cn('text-3xl font-bold mt-1', maturityColor(orgReport.organizationScore))}>
                          {orgReport.organizationScore}%
                        </p>
                      </div>
                      <div style={{ height: 48, width: 48, borderRadius: '50%', background: C.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <BarChart3 style={{ height: 24, width: 24, color: C.blue }} />
                      </div>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: C.bgSubtle, overflow: "hidden" }}><div style={{ height: "100%", width: `${orgReport.organizationScore}%`, background: C.gold, borderRadius: 3, transition: "width 0.3s" }} /></div>
                  </CVisionCardBody>
                </CVisionCard>

                <CVisionCard C={C}>
                  <CVisionCardBody style={{ paddingTop: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontSize: 13, color: C.textMuted }}>{tr('إجمالي الموظفين', 'Total Employees')}</p>
                        <p style={{ fontSize: 30, fontWeight: 700, marginTop: 4 }}>{orgReport.totalEmployees}</p>
                      </div>
                      <div style={{ height: 48, width: 48, borderRadius: '50%', background: C.greenDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users style={{ height: 24, width: 24, color: C.green }} />
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: C.textMuted, marginTop: 12 }}>
                      Across {orgReport.departmentCount} departments
                    </p>
                  </CVisionCardBody>
                </CVisionCard>

                <CVisionCard C={C}>
                  <CVisionCardBody style={{ paddingTop: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontSize: 13, color: C.textMuted }}>{tr('أقوى قسم', 'Strongest Dept')}</p>
                        <p style={{ fontSize: 16, fontWeight: 600, marginTop: 4, color: C.green, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {orgReport.strongestDepartment}
                        </p>
                      </div>
                      <div style={{ height: 48, width: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TrendingUp style={{ height: 24, width: 24 }} />
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: C.textMuted, marginTop: 12 }}>{tr('أعلى درجة نضج', 'Highest maturity score')}</p>
                  </CVisionCardBody>
                </CVisionCard>

                <CVisionCard C={C}>
                  <CVisionCardBody style={{ paddingTop: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontSize: 13, color: C.textMuted }}>{tr('الفجوات الحرجة', 'Critical Gaps')}</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          orgReport.criticalGaps.length > 0 ? 'text-red-600' : 'text-green-600'
                        )}>
                          {orgReport.criticalGaps.length}
                        </p>
                      </div>
                      <div style={{ height: 48, width: 48, borderRadius: '50%', background: C.redDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AlertTriangle style={{ height: 24, width: 24, color: C.red }} />
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: C.textMuted, marginTop: 12 }}>HIGH priority skill gaps</p>
                  </CVisionCardBody>
                </CVisionCard>
              </div>

              {/* Recommendations */}
              {orgReport.recommendations.length > 0 && (
                <CVisionCard C={C} className="border-l-4 border-l-blue-500">
                  <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Lightbulb style={{ height: 20, width: 20, color: C.blue }} />
                      Recommendations
                    </div>
                  </CVisionCardHeader>
                  <CVisionCardBody>
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {orgReport.recommendations.map((rec, idx) => (
                        <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
                          <span style={{ marginTop: 4, height: 6, width: 6, borderRadius: '50%', background: C.blueDim }} />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </CVisionCardBody>
                </CVisionCard>
              )}

              {/* Critical Gaps */}
              {orgReport.criticalGaps.length > 0 && (
                <CVisionCard C={C}>
                  <CVisionCardHeader C={C}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('فجوات المهارات الحرجة', 'Critical Skill Gaps')}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>
                      Organization-wide HIGH priority gaps requiring immediate attention
                    </div>
                  </CVisionCardHeader>
                  <CVisionCardBody>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 12 }}>
                      {orgReport.criticalGaps.map((gap, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'border rounded-lg p-3 border-l-4',
                            PRIORITY_BORDERS[gap.priority]
                          )}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontWeight: 500, fontSize: 13 }}>{gap.skillName}</span>
                            <CVisionBadge C={C} className={CATEGORY_COLORS[gap.category] || 'bg-gray-100 text-gray-800'} variant="secondary">
                              {gap.category}
                            </CVisionBadge>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: C.textMuted }}>
                            <span>{tr('المطلوب:', 'Required:')} Lv{gap.requiredLevel}</span>
                            <span>{tr('الحالي:', 'Current:')} Lv{gap.currentLevel}</span>
                            <span style={{ color: C.red, fontWeight: 500 }}>{tr('الفجوة:', 'Gap:')} {gap.gap}</span>
                          </div>
                          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
                            {gap.affectedEmployees} employee{gap.affectedEmployees !== 1 ? 's' : ''} affected
                          </p>
                          <p style={{ fontSize: 12, marginTop: 4, color: C.blue }}>{gap.trainingRecommendation}</p>
                        </div>
                      ))}
                    </div>
                  </CVisionCardBody>
                </CVisionCard>
              )}

              {/* Department Cards */}
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{tr('تفصيل الأقسام', 'Department Breakdown')}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {orgReport.departmentSummaries.map((dept) => {
                    const isExpanded = expandedDept === dept.department;
                    return (
                      <CVisionCard C={C} key={dept.department} style={{ overflow: 'hidden' }}>
                        <button
                          style={{ width: '100%', textAlign: 'left' }}
                          onClick={() => setExpandedDept(isExpanded ? null : dept.department)}
                        >
                          <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                <Building2 style={{ height: 20, width: 20, color: C.textMuted }} />
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dept.department}</p>
                                  <p style={{ fontSize: 12, color: C.textMuted }}>
                                    {dept.totalEmployees} employees &middot; {dept.skillCoverage.length} skills tracked
                                  </p>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <div style={{ textAlign: 'right' }}>
                                  <p className={cn('text-lg font-bold', maturityColor(dept.overallMaturityScore))}>
                                    {dept.overallMaturityScore}%
                                  </p>
                                  <p style={{ fontSize: 12, color: C.textMuted }}>{tr('النضج', 'Maturity')}</p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <p className={cn(
                                    'text-lg font-bold',
                                    dept.skillGaps.length > 0 ? 'text-orange-500' : 'text-green-500'
                                  )}>
                                    {dept.skillGaps.length}
                                  </p>
                                  <p style={{ fontSize: 12, color: C.textMuted }}>{tr('الفجوات', 'Gaps')}</p>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp style={{ height: 20, width: 20, color: C.textMuted }} />
                                ) : (
                                  <ChevronDown style={{ height: 20, width: 20, color: C.textMuted }} />
                                )}
                              </div>
                            </div>
                            <div style={{ height: 6, borderRadius: 3, background: C.bgSubtle, overflow: "hidden" }}><div style={{ height: "100%", width: `${dept.overallMaturityScore}%`, background: C.gold, borderRadius: 3, transition: "width 0.3s" }} /></div>
                          </CVisionCardBody>
                        </button>

                        {isExpanded && (
                          <div style={{ borderTop: `1px solid ${C.border}`, paddingLeft: 24, paddingRight: 24, paddingBottom: 16, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Top Skills */}
                            {dept.topSkills.length > 0 && (
                              <div>
                                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{tr('أهم المهارات', 'Top Skills')}</p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                  {dept.topSkills.map((ts) => (
                                    <div
                                      key={ts.name}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, background: C.bgSubtle, borderRadius: 8, fontSize: 12 }}
                                    >
                                      <span style={{ fontWeight: 500 }}>{ts.name}</span>
                                      <span style={{ color: C.textMuted }}>
                                        ({ts.count}) Avg: {ts.avgLevel.toFixed(1)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Skill Coverage Table */}
                            {dept.skillCoverage.length > 0 && (
                              <div>
                                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{tr('تغطية المهارات', 'Skill Coverage')}</p>
                                <div style={{ borderRadius: 8, border: `1px solid ${C.border}` }}>
                                  <CVisionTable C={C}>
                                    <CVisionTableHead C={C}>
                                        <CVisionTh C={C}>{tr('المهارة', 'Skill')}</CVisionTh>
                                        <CVisionTh C={C} align="center">{tr('الموظفين', 'Employees')}</CVisionTh>
                                        <CVisionTh C={C} align="center">{tr('متوسط المستوى', 'Avg Level')}</CVisionTh>
                                        <CVisionTh C={C} align="center">{tr('أقصى مستوى', 'Max Level')}</CVisionTh>
                                    </CVisionTableHead>
                                    <CVisionTableBody>
                                      {dept.skillCoverage
                                        .sort((a, b) => b.employeesWithSkill - a.employeesWithSkill)
                                        .map((sc) => (
                                          <CVisionTr C={C} key={sc.skillName}>
                                            <CVisionTd style={{ fontWeight: 500 }}>{sc.skillName}</CVisionTd>
                                            <CVisionTd align="center">{sc.employeesWithSkill}</CVisionTd>
                                            <CVisionTd align="center">
                                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                                {levelStars(Math.round(sc.averageLevel))}
                                                <span style={{ marginLeft: 4, fontSize: 12, color: C.textMuted }}>
                                                  {sc.averageLevel.toFixed(1)}
                                                </span>
                                              </div>
                                            </CVisionTd>
                                            <CVisionTd align="center">{sc.maxLevel}</CVisionTd>
                                          </CVisionTr>
                                        ))}
                                    </CVisionTableBody>
                                  </CVisionTable>
                                </div>
                              </div>
                            )}

                            {/* Department Gaps */}
                            {dept.skillGaps.length > 0 && (
                              <div>
                                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{tr('فجوات المهارات', 'Skill Gaps')}</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {dept.skillGaps.map((gap, idx) => (
                                    <div
                                      key={idx}
                                      className={cn(
                                        'flex items-center justify-between p-2 rounded-md border-l-4 bg-muted/50',
                                        PRIORITY_BORDERS[gap.priority]
                                      )}
                                    >
                                      <div>
                                        <span style={{ fontSize: 13, fontWeight: 500 }}>{gap.skillName}</span>
                                        <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>
                                          (Required: {gap.requiredLevel} / Current: {gap.currentLevel.toFixed ? gap.currentLevel.toFixed(1) : gap.currentLevel})
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <CVisionBadge C={C} className={PRIORITY_COLORS[gap.priority]} variant="secondary">
                                          {gap.priority}
                                        </CVisionBadge>
                                        <span style={{ fontSize: 12, color: C.textMuted }}>
                                          {gap.affectedEmployees} affected
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </CVisionCard>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>
        </CVisionTabContent>

        {/* ═══════════════════ Tab 2: Skill Search ═══════════════════ */}
        <CVisionTabContent tabId="search">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Search Form */}
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('البحث عن موظفين حسب المهارة', 'Find Employees by Skill')}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                Search for employees who have a specific skill at a minimum proficiency level
              </div>
            </CVisionCardHeader>
            <CVisionCardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <CVisionLabel C={C} htmlFor="search-skill" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>{tr('اسم المهارة', 'Skill Name')}</CVisionLabel>
                  <CVisionInput C={C}
                    id="search-skill"
                    placeholder="e.g., React, Leadership, Python..."
                    value={searchSkill}
                    onChange={(e) => setSearchSkill(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSkillSearch()}
                  />
                </div>
                <div style={{ width: '100%' }}>
                  <CVisionLabel C={C} htmlFor="search-level" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>{tr('الحد الأدنى للمستوى', 'Min Level')}</CVisionLabel>
                  <CVisionSelect
                C={C}
                value={searchMinLevel}
                onChange={setSearchMinLevel}
                options={[1, 2, 3, 4, 5].map((l) => (
                        ({ value: String(l), label: `${l} - ${defaults?.proficiencyLabels?.[l]?.en || `Level ${l}`}` })
                      ))}
              />
                </div>
                <div style={{ width: '100%' }}>
                  <CVisionLabel C={C} htmlFor="search-dept" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>{tr('القسم (اختياري)', 'Department (optional)')}</CVisionLabel>
                  <CVisionSelect
                C={C}
                value={searchDept}
                onChange={setSearchDept}
                placeholder="All departments"
                options={[
                  { value: '__all__', label: 'All departments' },
                  ...departmentList.map((d) => (
                        ({ value: d, label: d })
                      )),
                ]}
              />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <CVisionButton C={C} isDark={isDark} onClick={handleSkillSearch} disabled={searchLoading}>
                    <Search style={{ height: 16, width: 16, marginRight: 8 }} />
                    {searchLoading ? 'Searching...' : 'Search'}
                  </CVisionButton>
                </div>
              </div>
            </CVisionCardBody>
          </CVisionCard>

          {/* Popular Skills */}
          {popularSkills.length > 0 && !searchResults && (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('المهارات الشائعة', 'Popular Skills')}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>
                  Most common skills across the organization. Click to search.
                </div>
              </CVisionCardHeader>
              <CVisionCardBody>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {popularSkills.map((ps) => (
                    <button
                      key={ps.name}
                      onClick={() => {
                        setSearchSkill(ps.name);
                        setSearchMinLevel('1');
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, background: C.bgSubtle, borderRadius: '50%', fontSize: 13, transition: 'color 0.2s, background 0.2s' }}
                    >
                      <span style={{ fontWeight: 500 }}>{ps.name}</span>
                      <CVisionBadge C={C} variant="secondary" style={{ fontSize: 12 }}>
                        {ps.count}
                      </CVisionBadge>
                    </button>
                  ))}
                </div>
              </CVisionCardBody>
            </CVisionCard>
          )}

          {/* Search Results */}
          {searchResults && (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                      Search Results
                      <CVisionBadge C={C} variant="secondary" style={{ marginLeft: 8 }}>
                        {searchResults.length} found
                      </CVisionBadge>
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>
                      Employees with &quot;{searchSkill}&quot; at level {searchMinLevel}+
                    </div>
                  </div>
                  <CVisionButton C={C} isDark={isDark}
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchResults(null)}
                  >
                    Clear
                  </CVisionButton>
                </div>
              </CVisionCardHeader>
              <CVisionCardBody>
                {searchResults.length === 0 ? (
                  <div style={{ paddingTop: 32, paddingBottom: 32, textAlign: 'center', color: C.textMuted }}>
                    <Search style={{ height: 32, width: 32, marginBottom: 8, opacity: 0.5 }} />
                    <p>{tr('لم يتم العثور على موظفين بهذه المهارة عند المستوى المحدد.', 'No employees found with this skill at the specified level.')}</p>
                  </div>
                ) : (
                  <div style={{ borderRadius: 8, border: `1px solid ${C.border}` }}>
                    <CVisionTable C={C}>
                      <CVisionTableHead C={C}>
                          <CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh>
                          <CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh>
                          <CVisionTh C={C} align="center">{tr('الكفاءة', 'Proficiency')}</CVisionTh>
                          <CVisionTh C={C}>{tr('المصدر', 'Source')}</CVisionTh>
                          <CVisionTh C={C} align="right">{tr('الإجراءات', 'Actions')}</CVisionTh>
                      </CVisionTableHead>
                      <CVisionTableBody>
                        {searchResults.map((r) => (
                          <CVisionTr C={C} key={r.employeeId}>
                            <CVisionTd style={{ fontWeight: 500 }}>{r.employeeName}</CVisionTd>
                            <CVisionTd>{r.department}</CVisionTd>
                            <CVisionTd>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                {levelStars(r.proficiencyLevel)}
                              </div>
                            </CVisionTd>
                            <CVisionTd>
                              <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>
                                {r.source.replace(/_/g, ' ')}
                              </CVisionBadge>
                            </CVisionTd>
                            <CVisionTd align="right">
                              <CVisionButton C={C} isDark={isDark}
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setUpdateEmployeeId(r.employeeId);
                                  setUpdateSkillId(
                                    defaults?.skills?.find(
                                      (s) => s.name.toLowerCase() === searchSkill.toLowerCase()
                                    )?.id || searchSkill
                                  );
                                  setUpdateLevel(String(r.proficiencyLevel));
                                  setUpdateModalOpen(true);
                                }}
                              >
                                <Pencil style={{ height: 14, width: 14 }} />
                              </CVisionButton>
                            </CVisionTd>
                          </CVisionTr>
                        ))}
                      </CVisionTableBody>
                    </CVisionTable>
                  </div>
                )}
              </CVisionCardBody>
            </CVisionCard>
          )}
        </div>
        </CVisionTabContent>

        {/* ═══════════════════ Tab 3: Gap Analysis ═══════════════════ */}
        <CVisionTabContent tabId="gaps">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Mode Selector */}
          <div style={{ display: 'flex', gap: 12 }}>
            <CVisionButton C={C} isDark={isDark}
              variant={gapMode === 'individual' ? 'default' : 'outline'}
              onClick={() => setGapMode('individual')}
              style={{ flex: 1 }}
            >
              <Users style={{ height: 16, width: 16, marginRight: 8 }} />
              Individual Employee
            </CVisionButton>
            <CVisionButton C={C} isDark={isDark}
              variant={gapMode === 'department' ? 'default' : 'outline'}
              onClick={() => setGapMode('department')}
              style={{ flex: 1 }}
            >
              <Building2 style={{ height: 16, width: 16, marginRight: 8 }} />
              Department
            </CVisionButton>
          </div>

          {/* ── Individual Mode ── */}
          {gapMode === 'individual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <CVisionCard C={C}>
                <CVisionCardHeader C={C}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('اختيار موظف', 'Select Employee')}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>
                    Search for an employee to assess their skill gaps against their role requirements
                  </div>
                </CVisionCardHeader>
                <CVisionCardBody>
                  <div style={{ position: 'relative', maxWidth: 448 }}>
                    <CVisionInput C={C}
                      placeholder="Search employee by name..."
                      value={gapEmployeeSearch}
                      onChange={(e) => searchEmployees(e.target.value)}
                    />
                    {gapEmployeeLoading && (
                      <div style={{ position: 'absolute' }}>
                        <RefreshCw style={{ height: 16, width: 16, animation: 'spin 1s linear infinite', color: C.textMuted }} />
                      </div>
                    )}
                    {gapEmployeeResults.length > 0 && (
                      <div style={{ position: 'absolute', zIndex: 10, width: '100%', marginTop: 4, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                        {gapEmployeeResults.map((emp) => {
                          const name = emp.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.id;
                          return (
                            <button
                              key={emp.id}
                              style={{ width: '100%', textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 13, transition: 'color 0.2s, background 0.2s' }}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setGapSelectedEmployee(emp);
                                setGapEmployeeSearch(name);
                                setGapEmployeeResults([]);
                                assessIndividualGaps(emp.id);
                              }}
                            >
                              <span style={{ fontWeight: 500 }}>{name}</span>
                              {(emp.departmentName || emp.departmentId) && (
                                <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>
                                  {emp.departmentName || emp.departmentId}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {gapSelectedEmployee && (
                    <p style={{ fontSize: 13, color: C.textMuted, marginTop: 8 }}>
                      Selected: <span style={{ fontWeight: 500 }}>
                        {gapSelectedEmployee.fullName || `${gapSelectedEmployee.firstName || ''} ${gapSelectedEmployee.lastName || ''}`.trim()}
                      </span>
                    </p>
                  )}
                </CVisionCardBody>
              </CVisionCard>

              {/* Individual Results */}
              {gapIndividualLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <CVisionSkeletonCard C={C} height={200} style={{ height: 96, borderRadius: 16 }}  />
                  <CVisionSkeletonCard C={C} height={200} style={{ height: 192, borderRadius: 16 }}  />
                </div>
              )}

              {gapIndividualResult && !gapIndividualLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    <CVisionCard C={C}>
                      <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12, textAlign: 'center' }}>
                        <p style={{ fontSize: 24, fontWeight: 700 }}>{gapIndividualResult.currentSkillCount}</p>
                        <p style={{ fontSize: 12, color: C.textMuted }}>{tr('المهارات الحالية', 'Current Skills')}</p>
                      </CVisionCardBody>
                    </CVisionCard>
                    <CVisionCard C={C}>
                      <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12, textAlign: 'center' }}>
                        <p className={cn(
                          'text-2xl font-bold',
                          gapIndividualResult.totalGaps > 0 ? 'text-orange-500' : 'text-green-500'
                        )}>
                          {gapIndividualResult.totalGaps}
                        </p>
                        <p style={{ fontSize: 12, color: C.textMuted }}>{tr('إجمالي الفجوات', 'Total Gaps')}</p>
                      </CVisionCardBody>
                    </CVisionCard>
                    <CVisionCard C={C}>
                      <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12, textAlign: 'center' }}>
                        <p style={{ fontSize: 24, fontWeight: 700, color: C.red }}>{gapIndividualResult.highPriority}</p>
                        <p style={{ fontSize: 12, color: C.textMuted }}>{tr('أولوية عالية', 'High Priority')}</p>
                      </CVisionCardBody>
                    </CVisionCard>
                    <CVisionCard C={C}>
                      <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12, textAlign: 'center' }}>
                        <p style={{ fontSize: 24, fontWeight: 700, color: C.orange }}>{gapIndividualResult.mediumPriority}</p>
                        <p style={{ fontSize: 12, color: C.textMuted }}>Medium Priority</p>
                      </CVisionCardBody>
                    </CVisionCard>
                  </div>

                  {/* Gaps List */}
                  {gapIndividualResult.gaps.length === 0 ? (
                    <CVisionCard C={C}>
                      <CVisionCardBody style={{ paddingTop: 32, paddingBottom: 32, textAlign: 'center' }}>
                        <TrendingUp style={{ height: 32, width: 32, color: C.green, marginBottom: 8 }} />
                        <p style={{ fontWeight: 500, color: C.green }}>No skill gaps detected!</p>
                        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
                          This employee meets or exceeds all role requirements.
                        </p>
                      </CVisionCardBody>
                    </CVisionCard>
                  ) : (
                    <CVisionCard C={C}>
                      <CVisionCardHeader C={C}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Skill Gaps for {gapIndividualResult.employeeName}</div>
                          <CVisionButton C={C} isDark={isDark}
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setUpdateEmployeeId(gapIndividualResult.employeeId);
                              setUpdateSkillId('');
                              setUpdateLevel('3');
                              setUpdateModalOpen(true);
                            }}
                          >
                            <Pencil style={{ height: 14, width: 14, marginRight: 6 }} />
                            Update Skill
                          </CVisionButton>
                        </div>
                      </CVisionCardHeader>
                      <CVisionCardBody>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {gapIndividualResult.gaps.map((gap, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                'border rounded-lg p-4 border-l-4',
                                PRIORITY_BORDERS[gap.priority]
                              )}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontWeight: 500 }}>{gap.skillName}</span>
                                    <CVisionBadge C={C} className={PRIORITY_COLORS[gap.priority]} variant="secondary">
                                      {gap.priority}
                                    </CVisionBadge>
                                    <CVisionBadge C={C} className={CATEGORY_COLORS[gap.category] || 'bg-gray-100 text-gray-800'} variant="secondary">
                                      {gap.category}
                                    </CVisionBadge>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, fontSize: 13, color: C.textMuted }}>
                                    <span>Required: Level {gap.requiredLevel}</span>
                                    <span>Current: Level {gap.currentLevel}</span>
                                    <span style={{ fontWeight: 500, color: C.red }}>Gap: {gap.gap}</span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex' }}>
                                  {levelStars(gap.currentLevel)}
                                </div>
                              </div>
                              <p style={{ fontSize: 13, color: C.blue, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Lightbulb style={{ height: 14, width: 14 }} />
                                {gap.trainingRecommendation}
                              </p>
                            </div>
                          ))}
                        </div>
                      </CVisionCardBody>
                    </CVisionCard>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Department Mode ── */}
          {gapMode === 'department' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <CVisionCard C={C}>
                <CVisionCardHeader C={C}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Select Department</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>
                    Assess skill gaps for all employees in a department
                  </div>
                </CVisionCardHeader>
                <CVisionCardBody>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, maxWidth: 320 }}>
                      <CVisionLabel C={C} style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>{tr('القسم', 'Department')}</CVisionLabel>
                      <CVisionSelect
                C={C}
                value={gapDeptId}
                onChange={setGapDeptId}
                placeholder="Choose department..."
                options={departmentList.map((d) => (
                            ({ value: d, label: d })
                          ))}
              />
                    </div>
                    <CVisionButton C={C} isDark={isDark} onClick={assessDepartmentGaps} disabled={gapBulkLoading || !gapDeptId}>
                      <Target style={{ height: 16, width: 16, marginRight: 8 }} />
                      {gapBulkLoading ? 'Assessing...' : 'Assess Gaps'}
                    </CVisionButton>
                  </div>
                </CVisionCardBody>
              </CVisionCard>

              {/* Bulk Results */}
              {gapBulkLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <CVisionSkeletonCard C={C} height={200} style={{ height: 96, borderRadius: 16 }}  />
                  <CVisionSkeletonCard C={C} height={200} style={{ height: 192, borderRadius: 16 }}  />
                </div>
              )}

              {gapBulkResult && !gapBulkLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Department Summary */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    <CVisionCard C={C}>
                      <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12, textAlign: 'center' }}>
                        <p style={{ fontSize: 24, fontWeight: 700 }}>{gapBulkResult.employeeCount}</p>
                        <p style={{ fontSize: 12, color: C.textMuted }}>Employees Assessed</p>
                      </CVisionCardBody>
                    </CVisionCard>
                    <CVisionCard C={C}>
                      <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12, textAlign: 'center' }}>
                        <p className={cn(
                          'text-2xl font-bold',
                          gapBulkResult.totalUniqueGaps > 0 ? 'text-orange-500' : 'text-green-500'
                        )}>
                          {gapBulkResult.totalUniqueGaps}
                        </p>
                        <p style={{ fontSize: 12, color: C.textMuted }}>Unique Skill Gaps</p>
                      </CVisionCardBody>
                    </CVisionCard>
                    <CVisionCard C={C}>
                      <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12, textAlign: 'center' }}>
                        <p style={{ fontSize: 24, fontWeight: 700, color: C.red }}>
                          {gapBulkResult.aggregateGaps.filter((g) => g.priority === 'HIGH').length}
                        </p>
                        <p style={{ fontSize: 12, color: C.textMuted }}>High Priority Gaps</p>
                      </CVisionCardBody>
                    </CVisionCard>
                  </div>

                  {/* Aggregate Gaps Table */}
                  {gapBulkResult.aggregateGaps.length > 0 && (
                    <CVisionCard C={C}>
                      <CVisionCardHeader C={C}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Aggregate Skill Gaps</div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>
                          Skills with gaps across the department, sorted by priority and impact
                        </div>
                      </CVisionCardHeader>
                      <CVisionCardBody>
                        <div style={{ borderRadius: 8, border: `1px solid ${C.border}` }}>
                          <CVisionTable C={C}>
                            <CVisionTableHead C={C}>
                                <CVisionTh C={C}>{tr('المهارة', 'Skill')}</CVisionTh>
                                <CVisionTh C={C} align="center">{tr('الأولوية', 'Priority')}</CVisionTh>
                                <CVisionTh C={C} align="center">Affected Employees</CVisionTh>
                                <CVisionTh C={C} align="center">Avg Gap</CVisionTh>
                            </CVisionTableHead>
                            <CVisionTableBody>
                              {gapBulkResult.aggregateGaps.map((ag) => (
                                <CVisionTr C={C} key={ag.skillName}>
                                  <CVisionTd style={{ fontWeight: 500 }}>{ag.skillName}</CVisionTd>
                                  <CVisionTd align="center">
                                    <CVisionBadge C={C} className={PRIORITY_COLORS[ag.priority] || 'bg-gray-100'} variant="secondary">
                                      {ag.priority}
                                    </CVisionBadge>
                                  </CVisionTd>
                                  <CVisionTd align="center">{ag.affectedEmployees}</CVisionTd>
                                  <CVisionTd align="center">{ag.averageGap}</CVisionTd>
                                </CVisionTr>
                              ))}
                            </CVisionTableBody>
                          </CVisionTable>
                        </div>
                      </CVisionCardBody>
                    </CVisionCard>
                  )}

                  {/* Per-Employee Breakdown */}
                  {gapBulkResult.assessments.length > 0 && (
                    <CVisionCard C={C}>
                      <CVisionCardHeader C={C}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Employee Breakdown</div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>
                          Individual gap counts for each employee in the department
                        </div>
                      </CVisionCardHeader>
                      <CVisionCardBody>
                        <div style={{ borderRadius: 8, border: `1px solid ${C.border}` }}>
                          <CVisionTable C={C}>
                            <CVisionTableHead C={C}>
                                <CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh>
                                <CVisionTh C={C} align="center">{tr('المهارات', 'Skills')}</CVisionTh>
                                <CVisionTh C={C} align="center">Total Gaps</CVisionTh>
                                <CVisionTh C={C} align="center">
                                  <span style={{ color: C.red }}>High</span>
                                </CVisionTh>
                                <CVisionTh C={C} align="center">
                                  <span style={{ color: C.orange }}>Med</span>
                                </CVisionTh>
                                <CVisionTh C={C} align="center">
                                  <span style={{ color: C.green }}>Low</span>
                                </CVisionTh>
                                <CVisionTh C={C} align="right">{tr('الإجراءات', 'Actions')}</CVisionTh>
                            </CVisionTableHead>
                            <CVisionTableBody>
                              {gapBulkResult.assessments.map((a) => (
                                <CVisionTr C={C} key={a.employeeId}>
                                  <CVisionTd style={{ fontWeight: 500 }}>{a.employeeName}</CVisionTd>
                                  <CVisionTd align="center">{a.currentSkillCount}</CVisionTd>
                                  <CVisionTd align="center" style={{ fontWeight: 500 }}>
                                    <span className={a.totalGaps > 0 ? 'text-orange-500' : 'text-green-500'}>
                                      {a.totalGaps}
                                    </span>
                                  </CVisionTd>
                                  <CVisionTd align="center" style={{ color: C.red }}>{a.highPriority}</CVisionTd>
                                  <CVisionTd align="center" style={{ color: C.orange }}>{a.mediumPriority}</CVisionTd>
                                  <CVisionTd align="center" style={{ color: C.green }}>{a.lowPriority}</CVisionTd>
                                  <CVisionTd align="right">
                                    <CVisionButton C={C} isDark={isDark}
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setGapMode('individual');
                                        setGapSelectedEmployee({ id: a.employeeId, fullName: a.employeeName });
                                        setGapEmployeeSearch(a.employeeName);
                                        assessIndividualGaps(a.employeeId);
                                      }}
                                    >
                                      View Details
                                    </CVisionButton>
                                  </CVisionTd>
                                </CVisionTr>
                              ))}
                            </CVisionTableBody>
                          </CVisionTable>
                        </div>
                      </CVisionCardBody>
                    </CVisionCard>
                  )}

                  {gapBulkResult.aggregateGaps.length === 0 && gapBulkResult.employeeCount > 0 && (
                    <CVisionCard C={C}>
                      <CVisionCardBody style={{ paddingTop: 32, paddingBottom: 32, textAlign: 'center' }}>
                        <TrendingUp style={{ height: 32, width: 32, color: C.green, marginBottom: 8 }} />
                        <p style={{ fontWeight: 500, color: C.green }}>No skill gaps detected!</p>
                        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
                          All employees in this department meet their role requirements.
                        </p>
                      </CVisionCardBody>
                    </CVisionCard>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        </CVisionTabContent>
      </CVisionTabs>

      {/* ═══════════════════ Skill Update Modal ═══════════════════ */}
      <CVisionDialog C={C} open={updateModalOpen} onClose={() => setUpdateModalOpen(false)} title="Update Skills" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              Add or update a skill for this employee. Changes are saved immediately.
            </p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8 }}>
            <div>
              <CVisionLabel C={C} style={{ fontSize: 13 }}>Employee ID</CVisionLabel>
              <CVisionInput C={C} value={updateEmployeeId} disabled style={{ marginTop: 4, background: C.bgSubtle }} />
            </div>
            <div>
              <CVisionLabel C={C} style={{ fontSize: 13 }}>Skill</CVisionLabel>
              <CVisionSelect
                C={C}
                value={updateSkillId}
                onChange={setUpdateSkillId}
                placeholder="Select a skill..."
                options={(defaults?.skills || []).map((skill) => (
                    ({ value: skill.id, label: `${skill.name} (${skill.category})` })
                  ))}
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <CVisionLabel C={C} style={{ fontSize: 13 }}>Proficiency Level</CVisionLabel>
              <CVisionSelect
                C={C}
                value={updateLevel}
                onChange={setUpdateLevel}
                options={[1, 2, 3, 4, 5].map((l) => (
                    ({ value: String(l), label: `${l} - ${defaults?.proficiencyLabels?.[l]?.en || `Level ${l}`}` })
                  ))}
                style={{ marginTop: 4 }}
              />
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setUpdateModalOpen(false)}>
              Cancel
            </CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleSkillUpdate} disabled={updateSaving || !updateSkillId}>
              {updateSaving ? 'Saving...' : 'Save Changes'}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}
