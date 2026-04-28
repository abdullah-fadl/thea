'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { SamTopNav } from '@/components/sam/SamTopNav';

type Requirement = {
  id: string;
  title: string;
  titleAr?: string;
  status: string;
  priority: string;
  category?: string;
  dueDate?: string;
  departmentId?: string;
};

type Violation = {
  id: string;
  title: string;
  titleAr?: string;
  severity: string;
  status: string;
  detectedAt: string;
  slaDeadline?: string;
};

type CorrectiveAction = {
  id: string;
  title: string;
  titleAr?: string;
  status: string;
  priority: string;
  actionType: string;
  dueDate?: string;
};

type DashboardData = {
  complianceRate: number;
  totalRequirements: number;
  requirementsByStatus: Record<string, number>;
  openViolations: number;
  overdueViolations: number;
  violationsBySeverity: Record<string, number>;
  openCorrectiveActions: number;
  overdueCorrectiveActions: number;
  standardReadiness: Array<{ framework: string; code: string; title: string; readinessPercent: number }>;
};

export default function CompliancePage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [tab, setTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/sam/compliance/dashboard', { credentials: 'include' });
      if (res.ok) setDashboard(await res.json());
    } catch { /* ignore */ }
  }, []);

  const loadRequirements = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/sam/compliance?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRequirements(data.requirements || []);
      }
    } catch { /* ignore */ }
  }, [statusFilter]);

  const loadViolations = useCallback(async () => {
    try {
      const res = await fetch('/api/sam/compliance/violations', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setViolations(data.violations || []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadActions = useCallback(async () => {
    try {
      const res = await fetch('/api/sam/compliance/corrective-actions', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setActions(data.actions || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([loadDashboard(), loadRequirements(), loadViolations(), loadActions()])
      .finally(() => setIsLoading(false));
  }, [loadDashboard, loadRequirements, loadViolations, loadActions]);

  useEffect(() => {
    loadRequirements();
  }, [statusFilter, loadRequirements]);

  const statusColor = (s: string) => {
    if (s === 'MET' || s === 'COMPLIANT' || s === 'RESOLVED' || s === 'COMPLETED' || s === 'VERIFIED') return 'default';
    if (s === 'PARTIALLY_MET' || s === 'IN_PROGRESS' || s === 'PARTIALLY_COMPLIANT') return 'secondary';
    if (s === 'NOT_MET' || s === 'OPEN' || s === 'NON_COMPLIANT') return 'destructive';
    return 'outline';
  };

  const severityColor = (s: string) => {
    if (s === 'CRITICAL') return 'destructive';
    if (s === 'HIGH') return 'destructive';
    if (s === 'MEDIUM') return 'secondary';
    return 'outline';
  };

  return (
    <div className="space-y-6">
      <SamTopNav />
      <div>
        <h1 className="text-2xl font-semibold">{tr('الامتثال', 'Compliance')}</h1>
        <p className="text-sm text-muted-foreground">
          {tr('مراقبة متطلبات الامتثال والانتهاكات والإجراءات التصحيحية', 'Monitor compliance requirements, violations, and corrective actions')}
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="dashboard">{tr('لوحة المعلومات', 'Dashboard')}</TabsTrigger>
          <TabsTrigger value="requirements">{tr('المتطلبات', 'Requirements')}</TabsTrigger>
          <TabsTrigger value="violations">{tr('الانتهاكات', 'Violations')}</TabsTrigger>
          <TabsTrigger value="actions">{tr('الإجراءات التصحيحية', 'Corrective Actions')}</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4 mt-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>
          ) : dashboard ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>{tr('نسبة الامتثال', 'Compliance Rate')}</CardDescription>
                    <CardTitle className="text-3xl">{dashboard.complianceRate}%</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>{tr('إجمالي المتطلبات', 'Total Requirements')}</CardDescription>
                    <CardTitle className="text-3xl">{dashboard.totalRequirements}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>{tr('الانتهاكات المفتوحة', 'Open Violations')}</CardDescription>
                    <CardTitle className="text-3xl text-destructive">{dashboard.openViolations}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>{tr('إجراءات تصحيحية مفتوحة', 'Open Actions')}</CardDescription>
                    <CardTitle className="text-3xl">{dashboard.openCorrectiveActions}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{tr('المتطلبات حسب الحالة', 'Requirements by Status')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(dashboard.requirementsByStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <Badge variant={statusColor(status)}>{status.replace(/_/g, ' ')}</Badge>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{tr('الانتهاكات حسب الخطورة', 'Violations by Severity')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(dashboard.violationsBySeverity).map(([severity, count]) => (
                      <div key={severity} className="flex items-center justify-between">
                        <Badge variant={severityColor(severity)}>{severity}</Badge>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {dashboard.standardReadiness.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{tr('جاهزية المعايير', 'Standards Readiness')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {dashboard.standardReadiness.map((s) => (
                        <div key={s.code} className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium">{s.code}</span>
                            <span className="text-xs text-muted-foreground ml-2">{s.title}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${s.readinessPercent}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium w-10 text-right">{s.readinessPercent}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">{tr('لا توجد بيانات', 'No data available')}</div>
          )}
        </TabsContent>

        <TabsContent value="requirements" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={tr('جميع الحالات', 'All statuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr('الكل', 'All')}</SelectItem>
                <SelectItem value="NOT_MET">{tr('غير مستوفى', 'Not Met')}</SelectItem>
                <SelectItem value="PARTIALLY_MET">{tr('مستوفى جزئياً', 'Partially Met')}</SelectItem>
                <SelectItem value="MET">{tr('مستوفى', 'Met')}</SelectItem>
                <SelectItem value="NOT_APPLICABLE">{tr('غير قابل للتطبيق', 'N/A')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {requirements.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              {tr('لا توجد متطلبات امتثال', 'No compliance requirements found')}
            </div>
          ) : (
            <div className="space-y-3">
              {requirements.map((r) => (
                <Card key={r.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <div className="text-sm font-medium">{language === 'ar' && r.titleAr ? r.titleAr : r.title}</div>
                      {r.category && <span className="text-xs text-muted-foreground">{r.category}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusColor(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                      <Badge variant={severityColor(r.priority)}>{r.priority}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="violations" className="space-y-4 mt-4">
          {violations.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              {tr('لا توجد انتهاكات', 'No violations found')}
            </div>
          ) : (
            <div className="space-y-3">
              {violations.map((v) => (
                <Card key={v.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <div className="text-sm font-medium">{language === 'ar' && v.titleAr ? v.titleAr : v.title}</div>
                      <span className="text-xs text-muted-foreground">
                        {tr('تم الكشف في', 'Detected')}: {new Date(v.detectedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusColor(v.status)}>{v.status}</Badge>
                      <Badge variant={severityColor(v.severity)}>{v.severity}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="actions" className="space-y-4 mt-4">
          {actions.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              {tr('لا توجد إجراءات تصحيحية', 'No corrective actions found')}
            </div>
          ) : (
            <div className="space-y-3">
              {actions.map((a) => (
                <Card key={a.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <div className="text-sm font-medium">{language === 'ar' && a.titleAr ? a.titleAr : a.title}</div>
                      <span className="text-xs text-muted-foreground">{a.actionType}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusColor(a.status)}>{a.status}</Badge>
                      <Badge variant={severityColor(a.priority)}>{a.priority}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
