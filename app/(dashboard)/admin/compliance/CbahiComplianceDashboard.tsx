'use client';

import { useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Play,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Shield,
  TrendingUp,
  ClipboardList,
  Calendar,
  User,
  Loader2,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Standard {
  id: string;
  domain: string;
  domainName: string;
  domainNameAr: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  priority: 'essential' | 'standard' | 'advanced';
  theaModuleMapping: string[];
  evidenceTypes: string[];
  measurableElements: {
    id: string;
    text: string;
    textAr: string;
    evidenceRequired: string[];
    hasAutomatedCheck: boolean;
  }[];
}

interface DomainScore {
  domain: string;
  domainName: string;
  domainNameAr: string;
  totalStandards: number;
  assessedStandards: number;
  compliant: number;
  partial: number;
  nonCompliant: number;
  notApplicable: number;
  score: number;
}

interface Assessment {
  id: string;
  assessmentDate: string;
  assessorName: string | null;
  overallScore: number;
  domainScores: Record<string, number>;
  status: string;
  findings: any[];
  actionPlan: any[];
  nextReviewDate: string | null;
  createdAt: string;
}

interface Evidence {
  id: string;
  assessmentId: string;
  standardId: string;
  elementId: string | null;
  evidenceType: string;
  title: string;
  description: string | null;
  fileUrl: string | null;
  status: string;
  reviewerNotes: string | null;
  uploadedBy: string;
  uploadedAt: string;
  reviewedAt: string | null;
}

interface DomainInfo {
  name: string;
  nameAr: string;
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export function CbahiComplianceDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch standards
  const { data: standardsData } = useSWR('/api/compliance/cbahi/standards', fetcher);
  // Fetch assessments
  const { data: assessmentsData, mutate: mutateAssessments } = useSWR('/api/compliance/cbahi/audit', fetcher);

  const standards: Standard[] = standardsData?.standards || [];
  const domains: Record<string, DomainInfo> = standardsData?.domains || {};
  const assessments: Assessment[] = assessmentsData?.items || [];
  const latestAssessment = assessments[0];

  return (
    <div className="p-4 md:p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            {tr('اعتماد سباهي', 'CBAHI Accreditation')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tr(
              'لوحة مراقبة الامتثال لمعايير المجلس المركزي لاعتماد المنشآت الصحية',
              'Central Board for Accreditation of Healthcare Institutions compliance dashboard'
            )}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="overview">{tr('نظرة عامة', 'Overview')}</TabsTrigger>
          <TabsTrigger value="standards">{tr('المعايير', 'Standards')}</TabsTrigger>
          <TabsTrigger value="audit">{tr('التدقيق', 'Audit')}</TabsTrigger>
          <TabsTrigger value="evidence">{tr('الأدلة', 'Evidence')}</TabsTrigger>
          <TabsTrigger value="action-plan">{tr('خطة العمل', 'Action Plan')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            latestAssessment={latestAssessment}
            domains={domains}
            tr={tr}
            language={language}
          />
        </TabsContent>

        <TabsContent value="standards">
          <StandardsTab standards={standards} domains={domains} tr={tr} language={language} />
        </TabsContent>

        <TabsContent value="audit">
          <AuditTab
            assessments={assessments}
            mutateAssessments={mutateAssessments}
            tr={tr}
            language={language}
          />
        </TabsContent>

        <TabsContent value="evidence">
          <EvidenceTab
            assessments={assessments}
            standards={standards}
            tr={tr}
            language={language}
          />
        </TabsContent>

        <TabsContent value="action-plan">
          <ActionPlanTab
            latestAssessment={latestAssessment}
            mutateAssessments={mutateAssessments}
            tr={tr}
            language={language}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({
  latestAssessment,
  domains,
  tr,
  language,
}: {
  latestAssessment: Assessment | undefined;
  domains: Record<string, { name: string; nameAr: string }>;
  tr: (ar: string, en: string) => string;
  language: string;
}) {
  const domainScores = latestAssessment?.domainScores || {};
  const overallScore = latestAssessment?.overallScore || 0;
  const domainEntries = Object.entries(domains);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-100 border-green-300';
    if (score >= 50) return 'bg-yellow-100 border-yellow-300';
    return 'bg-red-100 border-red-300';
  };

  const getStatusLabel = (score: number) => {
    if (score >= 80) return tr('جاهز', 'Ready');
    if (score >= 50) return tr('جزئي', 'Partial');
    return tr('غير جاهز', 'Not Ready');
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Overall Score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`border-2 ${getScoreBg(overallScore)}`}>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">{tr('الدرجة الإجمالية', 'Overall Score')}</p>
            <p className={`text-5xl font-bold mt-2 ${getScoreColor(overallScore)}`}>
              {latestAssessment ? `${overallScore}%` : '—'}
            </p>
            <p className="text-sm mt-2 font-medium">{latestAssessment ? getStatusLabel(overallScore) : tr('لم يُجرَ تدقيق بعد', 'No audit run yet')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">{tr('عدد المجالات', 'Domains')}</p>
            <p className="text-4xl font-bold mt-2">{domainEntries.length}</p>
            <p className="text-sm mt-2 text-muted-foreground">
              {tr('مجالات معايير سباهي', 'CBAHI standard domains')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">{tr('آخر تدقيق', 'Last Audit')}</p>
            <p className="text-lg font-bold mt-2">
              {latestAssessment
                ? new Date(latestAssessment.assessmentDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')
                : '—'}
            </p>
            <p className="text-sm mt-2 text-muted-foreground">
              {latestAssessment?.assessorName || tr('لم يُحدد', 'Not specified')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Domain Scores Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {tr('درجات المجالات', 'Domain Scores')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!latestAssessment ? (
            <p className="text-muted-foreground text-center py-8">
              {tr('قم بتشغيل التدقيق الآلي من تبويب "التدقيق" لعرض الدرجات', 'Run an automated audit from the "Audit" tab to view scores')}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {domainEntries.map(([code, info]) => {
                const score = domainScores[code] ?? 0;
                return (
                  <div
                    key={code}
                    className={`rounded-lg border p-3 ${getScoreBg(score)} transition-colors`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{code}</span>
                      <span className={`text-lg font-bold ${getScoreColor(score)}`}>{score}%</span>
                    </div>
                    <p className="text-xs mt-1 truncate" title={language === 'ar' ? info.nameAr : info.name}>
                      {language === 'ar' ? info.nameAr : info.name}
                    </p>
                    {/* Simple bar */}
                    <div className="mt-2 h-2 bg-white/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Traffic Light Summary */}
      {latestAssessment && latestAssessment.findings && latestAssessment.findings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{tr('ملخص الامتثال', 'Compliance Summary')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { status: 'compliant', icon: CheckCircle2, color: 'text-green-600', label: tr('مطابق', 'Compliant') },
                { status: 'partial', icon: AlertTriangle, color: 'text-yellow-600', label: tr('جزئي', 'Partial') },
                { status: 'non_compliant', icon: XCircle, color: 'text-red-600', label: tr('غير مطابق', 'Non-Compliant') },
                { status: 'not_applicable', icon: HelpCircle, color: 'text-muted-foreground', label: tr('غير قابل للتطبيق', 'Not Applicable') },
              ].map(({ status, icon: Icon, color, label }) => {
                const count = latestAssessment.findings.filter((f: any) => f.status === status).length;
                return (
                  <div key={status} className="flex items-center gap-3 p-3 rounded-lg border">
                    <Icon className={`h-6 w-6 ${color}`} />
                    <div>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Standards Tab
// ---------------------------------------------------------------------------

function StandardsTab({
  standards,
  domains,
  tr,
  language,
}: {
  standards: Standard[];
  domains: Record<string, { name: string; nameAr: string }>;
  tr: (ar: string, en: string) => string;
  language: string;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(new Set());

  const toggleStandard = (id: string) => {
    setExpandedStandards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = standards.filter(s => {
    if (selectedDomain !== 'all' && s.domain !== selectedDomain) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        s.id.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.titleAr.includes(searchQuery) ||
        s.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group by domain
  const grouped: Record<string, Standard[]> = {};
  for (const s of filtered) {
    if (!grouped[s.domain]) grouped[s.domain] = [];
    grouped[s.domain].push(s);
  }

  const priorityBadge = (p: string) => {
    switch (p) {
      case 'essential': return <Badge variant="destructive" className="text-xs">{tr('أساسي', 'Essential')}</Badge>;
      case 'standard': return <Badge variant="secondary" className="text-xs">{tr('معياري', 'Standard')}</Badge>;
      case 'advanced': return <Badge variant="outline" className="text-xs">{tr('متقدم', 'Advanced')}</Badge>;
      default: return null;
    }
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tr('البحث في المعايير...', 'Search standards...')}
            className="pl-9"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={selectedDomain} onValueChange={setSelectedDomain}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={tr('كل المجالات', 'All Domains')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr('كل المجالات', 'All Domains')}</SelectItem>
            {Object.entries(domains).map(([code, info]) => (
              <SelectItem key={code} value={code}>
                {code} — {language === 'ar' ? info.nameAr : info.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {tr(`عرض ${filtered.length} معيار`, `Showing ${filtered.length} standards`)}
      </p>

      {/* Grouped by domain */}
      {Object.entries(grouped).map(([domain, stds]) => (
        <Card key={domain}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="font-mono text-primary">{domain}</span>
              <span>—</span>
              <span>{language === 'ar' ? domains[domain]?.nameAr : domains[domain]?.name}</span>
              <Badge variant="outline" className="ml-2">{stds.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stds.map(std => (
              <div key={std.id} className="border rounded-lg">
                <button
                  onClick={() => toggleStandard(std.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-accent/50 rounded-lg text-left"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {expandedStandards.has(std.id) ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                    <span className="font-mono text-sm text-primary font-bold">{std.id}</span>
                    <span className="text-sm truncate">{language === 'ar' ? std.titleAr : std.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {priorityBadge(std.priority)}
                    <Badge variant="outline" className="text-xs">
                      {std.measurableElements.length} {tr('عنصر', 'ME')}
                    </Badge>
                  </div>
                </button>

                {expandedStandards.has(std.id) && (
                  <div className="px-4 pb-4 space-y-3 border-t">
                    <p className="text-sm text-muted-foreground mt-3">
                      {language === 'ar' ? std.descriptionAr : std.description}
                    </p>

                    {/* Thea Module Mapping */}
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground mr-1">{tr('الوحدات:', 'Modules:')}</span>
                      {std.theaModuleMapping.map(m => (
                        <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                      ))}
                    </div>

                    {/* Measurable Elements */}
                    <div className="space-y-2 mt-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {tr('العناصر القابلة للقياس', 'Measurable Elements')}
                      </p>
                      {std.measurableElements.map(me => (
                        <div key={me.id} className="bg-accent/30 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <span className="font-mono text-xs text-primary font-bold whitespace-nowrap">{me.id}</span>
                            <div className="flex-1">
                              <p className="text-sm">{language === 'ar' ? me.textAr : me.text}</p>
                              {me.hasAutomatedCheck && (
                                <Badge variant="default" className="text-xs mt-1">
                                  {tr('فحص آلي متاح', 'Automated check available')}
                                </Badge>
                              )}
                              <div className="flex flex-wrap gap-1 mt-2">
                                {me.evidenceRequired.map(ev => (
                                  <span key={ev} className="text-xs bg-background rounded px-2 py-0.5 border">
                                    {ev}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tr('لم يتم العثور على معايير مطابقة', 'No matching standards found')}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit Tab
// ---------------------------------------------------------------------------

function AuditTab({
  assessments,
  mutateAssessments,
  tr,
  language,
}: {
  assessments: Assessment[];
  mutateAssessments: any;
  tr: (ar: string, en: string) => string;
  language: string;
}) {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);

  const runAudit = useCallback(async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/compliance/cbahi/audit/run', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Audit failed');
      toast({
        title: tr('اكتمل التدقيق', 'Audit Complete'),
        description: tr(`الدرجة الإجمالية: ${data.result?.overallScore}%`, `Overall score: ${data.result?.overallScore}%`),
      });
      mutateAssessments();
      mutate('/api/compliance/cbahi/standards');
    } catch (e: any) {
      toast({ title: tr('خطأ', 'Error'), description: e.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  }, [mutateAssessments, toast, tr]);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary">{tr('مسودة', 'Draft')}</Badge>;
      case 'in_progress': return <Badge variant="default">{tr('قيد التنفيذ', 'In Progress')}</Badge>;
      case 'completed': return <Badge className="bg-green-100 text-green-700 border-green-300">{tr('مكتمل', 'Completed')}</Badge>;
      case 'submitted': return <Badge className="bg-blue-100 text-blue-700 border-blue-300">{tr('مُقدّم', 'Submitted')}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Run Audit Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-semibold">{tr('التدقيق الآلي', 'Automated Audit')}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {tr(
                  'يفحص النظام تلقائياً البيانات الحية مقابل معايير سباهي ويقيّم مستوى الامتثال',
                  'Automatically checks live system data against CBAHI standards and evaluates compliance level'
                )}
              </p>
            </div>
            <Button onClick={runAudit} disabled={running} size="lg">
              {running ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{tr('جاري التدقيق...', 'Running audit...')}</>
              ) : (
                <><Play className="h-4 w-4 mr-2" />{tr('تشغيل التدقيق', 'Run Audit')}</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Assessment History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            {tr('سجل التدقيقات', 'Assessment History')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assessments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {tr('لم يتم إجراء أي تدقيق بعد', 'No assessments conducted yet')}
            </p>
          ) : (
            <div className="space-y-3">
              {assessments.map(a => (
                <div key={a.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {new Date(a.assessmentDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                      {statusBadge(a.status)}
                    </div>
                    <div className="flex items-center gap-4">
                      {a.assessorName && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" /> {a.assessorName}
                        </span>
                      )}
                      <span className={`text-xl font-bold ${a.overallScore >= 80 ? 'text-green-600' : a.overallScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {a.overallScore}%
                      </span>
                    </div>
                  </div>

                  {/* Domain score mini bars */}
                  {a.domainScores && Object.keys(a.domainScores).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(a.domainScores).map(([domain, score]) => (
                        <div key={domain} className="flex items-center gap-1">
                          <span className="text-xs font-mono">{domain}</span>
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${(score as number) >= 80 ? 'bg-green-500' : (score as number) >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                          <span className="text-xs">{score as number}%</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Findings summary */}
                  {Array.isArray(a.findings) && a.findings.length > 0 && (
                    <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" /> {a.findings.filter((f: any) => f.status === 'compliant').length} {tr('مطابق', 'compliant')}</span>
                      <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-yellow-600" /> {a.findings.filter((f: any) => f.status === 'partial').length} {tr('جزئي', 'partial')}</span>
                      <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-600" /> {a.findings.filter((f: any) => f.status === 'non_compliant').length} {tr('غير مطابق', 'non-compliant')}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence Tab
// ---------------------------------------------------------------------------

function EvidenceTab({
  assessments,
  standards,
  tr,
  language,
}: {
  assessments: Assessment[];
  standards: Standard[];
  tr: (ar: string, en: string) => string;
  language: string;
}) {
  const { toast } = useToast();
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>(assessments[0]?.id || '');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadStandardId, setUploadStandardId] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadType, setUploadType] = useState<string>('document');
  const [uploading, setUploading] = useState(false);

  const { data: evidenceData, mutate: mutateEvidence } = useSWR(
    selectedAssessmentId ? `/api/compliance/cbahi/evidence?assessmentId=${selectedAssessmentId}` : null,
    fetcher
  );
  const evidenceItems: Evidence[] = evidenceData?.items || [];

  const handleUpload = async () => {
    if (!selectedAssessmentId || !uploadStandardId || !uploadTitle) {
      toast({ title: tr('خطأ', 'Error'), description: tr('يرجى ملء جميع الحقول المطلوبة', 'Please fill all required fields'), variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const res = await fetch('/api/compliance/cbahi/evidence', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentId: selectedAssessmentId,
          standardId: uploadStandardId,
          evidenceType: uploadType,
          title: uploadTitle,
          description: uploadDescription || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      toast({ title: tr('تم الرفع', 'Uploaded'), description: tr('تم رفع الدليل بنجاح', 'Evidence uploaded successfully') });
      setShowUpload(false);
      setUploadTitle('');
      setUploadDescription('');
      setUploadStandardId('');
      mutateEvidence();
    } catch (e: any) {
      toast({ title: tr('خطأ', 'Error'), description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const evidenceStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="secondary">{tr('قيد المراجعة', 'Pending')}</Badge>;
      case 'accepted': return <Badge className="bg-green-100 text-green-700 border-green-300">{tr('مقبول', 'Accepted')}</Badge>;
      case 'rejected': return <Badge variant="destructive">{tr('مرفوض', 'Rejected')}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const evidenceTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      document: tr('مستند', 'Document'),
      screenshot: tr('لقطة شاشة', 'Screenshot'),
      report: tr('تقرير', 'Report'),
      log: tr('سجل', 'Log'),
      certificate: tr('شهادة', 'Certificate'),
    };
    return <Badge variant="outline" className="text-xs">{labels[type] || type}</Badge>;
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Assessment selector + upload */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Select value={selectedAssessmentId} onValueChange={setSelectedAssessmentId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder={tr('اختر التقييم', 'Select Assessment')} />
          </SelectTrigger>
          <SelectContent>
            {assessments.map(a => (
              <SelectItem key={a.id} value={a.id}>
                {new Date(a.assessmentDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')} — {a.overallScore}%
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={showUpload} onOpenChange={setShowUpload}>
          <DialogTrigger asChild>
            <Button disabled={!selectedAssessmentId}>
              <Upload className="h-4 w-4 mr-2" />
              {tr('رفع دليل', 'Upload Evidence')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tr('رفع دليل امتثال', 'Upload Compliance Evidence')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>{tr('المعيار', 'Standard')}</Label>
                <Select value={uploadStandardId} onValueChange={setUploadStandardId}>
                  <SelectTrigger>
                    <SelectValue placeholder={tr('اختر المعيار', 'Select Standard')} />
                  </SelectTrigger>
                  <SelectContent>
                    {standards.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.id} — {language === 'ar' ? s.titleAr : s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tr('نوع الدليل', 'Evidence Type')}</Label>
                <Select value={uploadType} onValueChange={setUploadType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="document">{tr('مستند', 'Document')}</SelectItem>
                    <SelectItem value="screenshot">{tr('لقطة شاشة', 'Screenshot')}</SelectItem>
                    <SelectItem value="report">{tr('تقرير', 'Report')}</SelectItem>
                    <SelectItem value="log">{tr('سجل', 'Log')}</SelectItem>
                    <SelectItem value="certificate">{tr('شهادة', 'Certificate')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tr('العنوان', 'Title')}</Label>
                <Input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder={tr('عنوان الدليل', 'Evidence title')} />
              </div>
              <div>
                <Label>{tr('الوصف', 'Description')}</Label>
                <Textarea value={uploadDescription} onChange={e => setUploadDescription(e.target.value)} placeholder={tr('وصف اختياري', 'Optional description')} />
              </div>
              <Button onClick={handleUpload} disabled={uploading} className="w-full">
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {tr('رفع', 'Upload')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Evidence list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {tr('الأدلة المرفوعة', 'Uploaded Evidence')}
            {evidenceItems.length > 0 && <Badge variant="outline">{evidenceItems.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedAssessmentId ? (
            <p className="text-center text-muted-foreground py-8">
              {tr('اختر تقييماً لعرض الأدلة', 'Select an assessment to view evidence')}
            </p>
          ) : evidenceItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {tr('لم يتم رفع أدلة بعد لهذا التقييم', 'No evidence uploaded for this assessment yet')}
            </p>
          ) : (
            <div className="space-y-3">
              {evidenceItems.map(ev => (
                <div key={ev.id} className="border rounded-lg p-3 hover:bg-accent/50 transition-colors">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-xs text-primary">{ev.standardId}</span>
                      <span className="text-sm font-medium">{ev.title}</span>
                      {evidenceTypeBadge(ev.evidenceType)}
                    </div>
                    <div className="flex items-center gap-2">
                      {evidenceStatusBadge(ev.status)}
                    </div>
                  </div>
                  {ev.description && (
                    <p className="text-xs text-muted-foreground mt-1 ml-7">{ev.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground ml-7">
                    <span>{tr('بواسطة:', 'By:')} {ev.uploadedBy}</span>
                    <span>{new Date(ev.uploadedAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</span>
                    {ev.reviewerNotes && <span className="italic">{ev.reviewerNotes}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action Plan Tab
// ---------------------------------------------------------------------------

function ActionPlanTab({
  latestAssessment,
  mutateAssessments,
  tr,
  language,
}: {
  latestAssessment: Assessment | undefined;
  mutateAssessments: any;
  tr: (ar: string, en: string) => string;
  language: string;
}) {
  const { toast } = useToast();
  const [showAddAction, setShowAddAction] = useState(false);
  const [newAction, setNewAction] = useState({
    standardId: '',
    gap: '',
    action: '',
    owner: '',
    dueDate: '',
    priority: 'medium' as 'high' | 'medium' | 'low',
    status: 'pending' as 'pending' | 'in_progress' | 'completed',
  });
  const [saving, setSaving] = useState(false);

  const actionPlan: any[] = Array.isArray(latestAssessment?.actionPlan) ? latestAssessment!.actionPlan : [];

  // Build gaps from findings for suggestions
  const gaps = (latestAssessment?.findings || [])
    .filter((f: any) => f.status === 'non_compliant' || f.status === 'partial')
    .flatMap((f: any) => (f.gaps || []).map((g: string) => ({ standardId: f.standardId, gap: g, recommendations: f.recommendations || [] })));

  const handleAddAction = async () => {
    if (!latestAssessment) return;
    if (!newAction.standardId || !newAction.gap || !newAction.action) {
      toast({ title: tr('خطأ', 'Error'), description: tr('يرجى ملء الحقول المطلوبة', 'Please fill required fields'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const updatedPlan = [...actionPlan, newAction];
      const res = await fetch('/api/compliance/cbahi/audit', {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: latestAssessment.id, actionPlan: updatedPlan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add action');
      toast({ title: tr('تمت الإضافة', 'Added'), description: tr('تمت إضافة الإجراء لخطة العمل', 'Action added to plan') });
      setShowAddAction(false);
      setNewAction({ standardId: '', gap: '', action: '', owner: '', dueDate: '', priority: 'medium', status: 'pending' });
      mutateAssessments();
    } catch (e: any) {
      toast({ title: tr('خطأ', 'Error'), description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateActionStatus = async (index: number, status: string) => {
    if (!latestAssessment) return;
    const updatedPlan = [...actionPlan];
    updatedPlan[index] = { ...updatedPlan[index], status };
    try {
      const res = await fetch('/api/compliance/cbahi/audit', {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: latestAssessment.id, actionPlan: updatedPlan }),
      });
      if (!res.ok) throw new Error('Failed to update');
      mutateAssessments();
    } catch (e: any) {
      toast({ title: tr('خطأ', 'Error'), description: e.message, variant: 'destructive' });
    }
  };

  const priorityBadge = (p: string) => {
    switch (p) {
      case 'high': return <Badge variant="destructive" className="text-xs">{tr('عالي', 'High')}</Badge>;
      case 'medium': return <Badge variant="default" className="text-xs">{tr('متوسط', 'Medium')}</Badge>;
      case 'low': return <Badge variant="secondary" className="text-xs">{tr('منخفض', 'Low')}</Badge>;
      default: return <Badge variant="outline" className="text-xs">{p}</Badge>;
    }
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'pending': return <Badge variant="secondary">{tr('معلّق', 'Pending')}</Badge>;
      case 'in_progress': return <Badge variant="default">{tr('قيد التنفيذ', 'In Progress')}</Badge>;
      case 'completed': return <Badge className="bg-green-100 text-green-700 border-green-300">{tr('مكتمل', 'Completed')}</Badge>;
      default: return <Badge variant="outline">{s}</Badge>;
    }
  };

  return (
    <div className="space-y-4 mt-4">
      {!latestAssessment ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tr('قم بإجراء تدقيق أولاً لبناء خطة العمل', 'Run an audit first to build the action plan')}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Suggested Gaps */}
          {gaps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{tr('الفجوات المكتشفة', 'Identified Gaps')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {gaps.slice(0, 10).map((g: any, i: number) => (
                    <div key={i} className="border rounded-lg p-3 bg-red-50/50">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        <span className="font-mono text-xs text-primary">{g.standardId}</span>
                        <span className="text-sm">{g.gap}</span>
                      </div>
                      {g.recommendations?.length > 0 && (
                        <div className="ml-6 mt-1">
                          {g.recommendations.map((r: string, ri: number) => (
                            <p key={ri} className="text-xs text-muted-foreground">• {r}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Plan */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  {tr('خطة العمل', 'Action Plan')}
                  {actionPlan.length > 0 && <Badge variant="outline">{actionPlan.length}</Badge>}
                </CardTitle>
                <Dialog open={showAddAction} onOpenChange={setShowAddAction}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      {tr('إضافة إجراء', 'Add Action')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{tr('إضافة إجراء تصحيحي', 'Add Corrective Action')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label>{tr('المعيار', 'Standard ID')}</Label>
                        <Input value={newAction.standardId} onChange={e => setNewAction(p => ({ ...p, standardId: e.target.value }))} placeholder="PC.1" />
                      </div>
                      <div>
                        <Label>{tr('الفجوة', 'Gap')}</Label>
                        <Textarea value={newAction.gap} onChange={e => setNewAction(p => ({ ...p, gap: e.target.value }))} placeholder={tr('وصف الفجوة', 'Describe the gap')} />
                      </div>
                      <div>
                        <Label>{tr('الإجراء التصحيحي', 'Corrective Action')}</Label>
                        <Textarea value={newAction.action} onChange={e => setNewAction(p => ({ ...p, action: e.target.value }))} placeholder={tr('الإجراء المطلوب', 'Required action')} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>{tr('المسؤول', 'Owner')}</Label>
                          <Input value={newAction.owner} onChange={e => setNewAction(p => ({ ...p, owner: e.target.value }))} />
                        </div>
                        <div>
                          <Label>{tr('تاريخ الاستحقاق', 'Due Date')}</Label>
                          <Input type="date" value={newAction.dueDate} onChange={e => setNewAction(p => ({ ...p, dueDate: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <Label>{tr('الأولوية', 'Priority')}</Label>
                        <Select value={newAction.priority} onValueChange={v => setNewAction(p => ({ ...p, priority: v as 'high' | 'medium' | 'low' }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">{tr('عالي', 'High')}</SelectItem>
                            <SelectItem value="medium">{tr('متوسط', 'Medium')}</SelectItem>
                            <SelectItem value="low">{tr('منخفض', 'Low')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleAddAction} disabled={saving} className="w-full">
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {tr('إضافة', 'Add')}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {actionPlan.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {tr('لم يتم إضافة إجراءات بعد', 'No actions added yet')}
                </p>
              ) : (
                <div className="space-y-3">
                  {actionPlan.map((a: any, i: number) => (
                    <div key={i} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-primary">{a.standardId}</span>
                          {priorityBadge(a.priority || 'medium')}
                          {statusBadge(a.status || 'pending')}
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={a.status || 'pending'}
                            onValueChange={v => updateActionStatus(i, v)}
                          >
                            <SelectTrigger className="w-[140px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">{tr('معلّق', 'Pending')}</SelectItem>
                              <SelectItem value="in_progress">{tr('قيد التنفيذ', 'In Progress')}</SelectItem>
                              <SelectItem value="completed">{tr('مكتمل', 'Completed')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-sm mt-2"><strong>{tr('الفجوة:', 'Gap:')}</strong> {a.gap}</p>
                      <p className="text-sm mt-1"><strong>{tr('الإجراء:', 'Action:')}</strong> {a.action}</p>
                      <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                        {a.owner && <span>{tr('المسؤول:', 'Owner:')} {a.owner}</span>}
                        {a.dueDate && <span>{tr('الاستحقاق:', 'Due:')} {a.dueDate}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Progress summary */}
          {actionPlan.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{actionPlan.filter((a: any) => a.status === 'completed').length}</p>
                    <p className="text-xs text-muted-foreground">{tr('مكتمل', 'Completed')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{actionPlan.filter((a: any) => a.status === 'in_progress').length}</p>
                    <p className="text-xs text-muted-foreground">{tr('قيد التنفيذ', 'In Progress')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{actionPlan.filter((a: any) => !a.status || a.status === 'pending').length}</p>
                    <p className="text-xs text-muted-foreground">{tr('معلّق', 'Pending')}</p>
                  </div>
                </div>
                <div className="mt-3 h-3 bg-muted rounded-full overflow-hidden flex">
                  <div className="bg-green-500 h-full" style={{ width: `${actionPlan.length > 0 ? (actionPlan.filter((a: any) => a.status === 'completed').length / actionPlan.length) * 100 : 0}%` }} />
                  <div className="bg-blue-500 h-full" style={{ width: `${actionPlan.length > 0 ? (actionPlan.filter((a: any) => a.status === 'in_progress').length / actionPlan.length) * 100 : 0}%` }} />
                  <div className="bg-muted h-full flex-1" />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
