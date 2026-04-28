'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { SamTopNav } from '@/components/sam/SamTopNav';

type Risk = {
  id: string;
  title: string;
  titleAr?: string;
  riskCategory?: string;
  likelihood: number;
  impact: number;
  riskScore: number;
  riskLevel: string;
  status: string;
  assignedTo?: string;
  dueDate?: string;
  reviewDate?: string;
};

type MatrixCell = {
  count: number;
  risks: Array<{ id: string; title: string; status: string }>;
};

type MatrixData = {
  matrix: Record<string, MatrixCell>;
  summary: { total: number; critical: number; high: number; medium: number; low: number; averageScore: number };
};

type Mitigation = {
  id: string;
  riskId: string;
  title: string;
  strategy: string;
  status: string;
  dueDate?: string;
};

export default function RisksPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [tab, setTab] = useState('matrix');
  const [risks, setRisks] = useState<Risk[]>([]);
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
  const [mitigations, setMitigations] = useState<Mitigation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [riskLevelFilter, setRiskLevelFilter] = useState('all');

  const loadRisks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (riskLevelFilter !== 'all') params.set('riskLevel', riskLevelFilter);
      const res = await fetch(`/api/sam/risks?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRisks(data.risks || []);
      }
    } catch { /* ignore */ }
  }, [riskLevelFilter]);

  const loadMatrix = useCallback(async () => {
    try {
      const res = await fetch('/api/sam/risks/matrix', { credentials: 'include' });
      if (res.ok) setMatrixData(await res.json());
    } catch { /* ignore */ }
  }, []);

  const loadMitigations = useCallback(async () => {
    try {
      const res = await fetch('/api/sam/risks/mitigation', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMitigations(data.mitigations || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([loadRisks(), loadMatrix(), loadMitigations()])
      .finally(() => setIsLoading(false));
  }, [loadRisks, loadMatrix, loadMitigations]);

  useEffect(() => {
    loadRisks();
  }, [riskLevelFilter, loadRisks]);

  const riskColor = (level: string) => {
    if (level === 'CRITICAL') return 'destructive';
    if (level === 'HIGH') return 'destructive';
    if (level === 'MEDIUM') return 'secondary';
    return 'outline';
  };

  const matrixCellColor = (l: number, i: number) => {
    const score = l * i;
    if (score >= 20) return 'bg-red-500/20 border-red-500/40';
    if (score >= 12) return 'bg-orange-500/20 border-orange-500/40';
    if (score >= 6) return 'bg-yellow-500/20 border-yellow-500/40';
    return 'bg-green-500/20 border-green-500/40';
  };

  return (
    <div className="space-y-6">
      <SamTopNav />
      <div>
        <h1 className="text-2xl font-semibold">{tr('تقييم المخاطر', 'Risk Assessment')}</h1>
        <p className="text-sm text-muted-foreground">
          {tr('إدارة المخاطر وخطط التخفيف والمتابعة', 'Manage risks, mitigation plans, and follow-ups')}
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="matrix">{tr('مصفوفة المخاطر', 'Risk Matrix')}</TabsTrigger>
          <TabsTrigger value="register">{tr('سجل المخاطر', 'Risk Register')}</TabsTrigger>
          <TabsTrigger value="mitigations">{tr('خطط التخفيف', 'Mitigations')}</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="space-y-4 mt-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>
          ) : matrixData ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>{tr('إجمالي المخاطر', 'Total Risks')}</CardDescription>
                    <CardTitle className="text-3xl">{matrixData.summary.total}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>{tr('حرجة', 'Critical')}</CardDescription>
                    <CardTitle className="text-3xl text-red-600">{matrixData.summary.critical}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>{tr('عالية', 'High')}</CardDescription>
                    <CardTitle className="text-3xl text-orange-600">{matrixData.summary.high}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>{tr('متوسط النقاط', 'Avg Score')}</CardDescription>
                    <CardTitle className="text-3xl">{matrixData.summary.averageScore}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{tr('مصفوفة المخاطر 5×5', '5x5 Risk Matrix')}</CardTitle>
                  <CardDescription>{tr('الاحتمالية × التأثير', 'Likelihood x Impact')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <th className="p-2 text-left">{tr('الاحتمال↓ / التأثير→', 'Likelihood↓ / Impact→')}</th>
                          {[1, 2, 3, 4, 5].map((i) => (
                            <th key={i} className="p-2 text-center">{i}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[5, 4, 3, 2, 1].map((l) => (
                          <tr key={l}>
                            <td className="p-2 font-medium">{l}</td>
                            {[1, 2, 3, 4, 5].map((i) => {
                              const cell = matrixData.matrix[`${l}-${i}`];
                              return (
                                <td key={i} className={`p-2 text-center border rounded ${matrixCellColor(l, i)}`}>
                                  <div className="font-bold">{cell?.count || 0}</div>
                                  <div className="text-[10px] text-muted-foreground">{l * i}</div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">{tr('لا توجد بيانات', 'No data')}</div>
          )}
        </TabsContent>

        <TabsContent value="register" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <Select value={riskLevelFilter} onValueChange={setRiskLevelFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={tr('جميع المستويات', 'All levels')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr('الكل', 'All')}</SelectItem>
                <SelectItem value="CRITICAL">{tr('حرج', 'Critical')}</SelectItem>
                <SelectItem value="HIGH">{tr('عالي', 'High')}</SelectItem>
                <SelectItem value="MEDIUM">{tr('متوسط', 'Medium')}</SelectItem>
                <SelectItem value="LOW">{tr('منخفض', 'Low')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {risks.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              {tr('لا توجد مخاطر مسجلة', 'No risks registered')}
            </div>
          ) : (
            <div className="space-y-3">
              {risks.map((r) => (
                <Card key={r.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{language === 'ar' && r.titleAr ? r.titleAr : r.title}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {tr('الاحتمالية', 'L')}: {r.likelihood} | {tr('التأثير', 'I')}: {r.impact} | {tr('النقاط', 'Score')}: {r.riskScore}
                        </span>
                        {r.riskCategory && <span className="text-xs text-muted-foreground">| {r.riskCategory}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={riskColor(r.riskLevel)}>{r.riskLevel}</Badge>
                      <Badge variant="outline">{r.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mitigations" className="space-y-4 mt-4">
          {mitigations.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              {tr('لا توجد خطط تخفيف', 'No mitigation plans found')}
            </div>
          ) : (
            <div className="space-y-3">
              {mitigations.map((m) => (
                <Card key={m.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <div className="text-sm font-medium">{m.title}</div>
                      <span className="text-xs text-muted-foreground">{tr('استراتيجية', 'Strategy')}: {m.strategy}</span>
                    </div>
                    <Badge variant="outline">{m.status}</Badge>
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
