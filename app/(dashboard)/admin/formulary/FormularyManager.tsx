'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  AlertTriangle,
  Shield,
  Pill,
  Activity,
  BarChart3,
  FileWarning,
  Lock,
  CheckCircle,
  XCircle,
  Clock,
  Baby,
  Heart,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type TabKey = 'drugs' | 'highAlert' | 'lasa' | 'controlled' | 'restrictions' | 'stats';

export default function FormularyManager() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('drugs');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [selectedDrug, setSelectedDrug] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Fetch data
  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.set('q', searchQuery);
  if (statusFilter !== 'all') queryParams.set('formularyStatus', statusFilter);
  if (classFilter !== 'all') queryParams.set('therapeuticClass', classFilter);

  const { data: drugsData, mutate: mutateDrugs } = useSWR(
    `/api/clinical/formulary?${queryParams.toString()}`,
    fetcher
  );
  const { data: highAlertData } = useSWR(
    activeTab === 'highAlert' ? '/api/clinical/formulary/high-alert' : null,
    fetcher
  );
  const { data: controlledData } = useSWR(
    activeTab === 'controlled' ? '/api/clinical/formulary/controlled' : null,
    fetcher
  );
  const { data: restrictionsData, mutate: mutateRestrictions } = useSWR(
    activeTab === 'restrictions' ? '/api/clinical/formulary/restrictions' : null,
    fetcher
  );

  const drugs = drugsData?.items || [];
  const highAlertDrugs = highAlertData?.items || [];
  const controlledDrugs = controlledData?.items || [];
  const restrictions = restrictionsData?.items || [];

  // Compute stats from drugs list
  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    const byClass: Record<string, number> = {};
    const byPreg: Record<string, number> = {};
    let highAlert = 0;
    let controlled = 0;
    for (const d of drugs) {
      byStatus[d.formularyStatus] = (byStatus[d.formularyStatus] || 0) + 1;
      byClass[d.therapeuticClass] = (byClass[d.therapeuticClass] || 0) + 1;
      byPreg[d.pregnancyCategory] = (byPreg[d.pregnancyCategory] || 0) + 1;
      if (d.highAlert) highAlert++;
      if (d.controlled) controlled++;
    }
    return { total: drugs.length, byStatus, byClass, byPreg, highAlert, controlled };
  }, [drugs]);

  // LASA pairs from all drugs
  const lasaPairs = useMemo(() => {
    return drugs
      .filter((d: any) => {
        const pairs = Array.isArray(d.lasaPairs) ? d.lasaPairs : [];
        return pairs.length > 0;
      })
      .map((d: any) => ({
        name: d.genericName,
        nameAr: d.genericNameAr,
        pairs: d.lasaPairs as string[],
      }));
  }, [drugs]);

  // Seed formulary
  async function handleSeed() {
    setSeeding(true);
    try {
      const res = await fetch('/api/clinical/formulary/seed', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: tr('تم تحميل قائمة الأدوية بنجاح', 'Formulary seeded successfully'), description: `${data.created} ${tr('دواء', 'drugs')}` });
        mutateDrugs();
      } else {
        toast({ title: tr('خطأ', 'Error'), description: data.message || data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: tr('خطأ', 'Error'), description: tr('فشل تحميل البيانات', 'Failed to seed'), variant: 'destructive' });
    } finally {
      setSeeding(false);
    }
  }

  // Review restriction
  async function handleReview(requestId: string, action: 'approved' | 'rejected') {
    try {
      const res = await fetch('/api/clinical/formulary/restrictions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requestId, action }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: tr('تم التحديث', 'Updated'), description: tr('تم مراجعة الطلب', 'Request reviewed') });
        mutateRestrictions();
      }
    } catch {
      toast({ title: tr('خطأ', 'Error'), variant: 'destructive' });
    }
  }

  function openDrugDetail(drug: any) {
    setSelectedDrug(drug);
    setDetailOpen(true);
  }

  // Status badge colors
  function statusBadge(status: string) {
    switch (status) {
      case 'formulary': return <Badge className="bg-green-100 text-green-800">{tr('في القائمة', 'Formulary')}</Badge>;
      case 'restricted': return <Badge className="bg-orange-100 text-orange-800">{tr('مقيد', 'Restricted')}</Badge>;
      case 'conditional': return <Badge className="bg-yellow-100 text-yellow-800">{tr('مشروط', 'Conditional')}</Badge>;
      case 'non_formulary': return <Badge className="bg-red-100 text-red-800">{tr('خارج القائمة', 'Non-Formulary')}</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  }

  function pregBadge(cat: string) {
    const colors: Record<string, string> = {
      A: 'bg-green-100 text-green-800',
      B: 'bg-blue-100 text-blue-800',
      C: 'bg-yellow-100 text-yellow-800',
      D: 'bg-orange-100 text-orange-800',
      X: 'bg-red-100 text-red-800',
    };
    return <Badge className={colors[cat] || 'bg-muted text-foreground'}>{cat}</Badge>;
  }

  const tabs: Array<{ key: TabKey; label: string; icon: any }> = [
    { key: 'drugs', label: tr('قائمة الأدوية', 'Drug List'), icon: Pill },
    { key: 'highAlert', label: tr('عالية الخطورة', 'High-Alert'), icon: AlertTriangle },
    { key: 'lasa', label: tr('متشابهات LASA', 'LASA Pairs'), icon: FileWarning },
    { key: 'controlled', label: tr('مواد مراقبة', 'Controlled'), icon: Lock },
    { key: 'restrictions', label: tr('طلبات الموافقة', 'Restrictions'), icon: Shield },
    { key: 'stats', label: tr('إحصائيات', 'Statistics'), icon: BarChart3 },
  ];

  return (
    <div className="space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tr('قائمة الأدوية - وزارة الصحة السعودية', 'Saudi MOH Drug Formulary')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {tr('إدارة قائمة الأدوية المعتمدة وفقاً لمعايير هيئة الغذاء والدواء', 'Manage approved drug formulary per SFDA standards')}
          </p>
        </div>
        {drugs.length === 0 && (
          <Button onClick={handleSeed} disabled={seeding}>
            {seeding ? tr('جاري التحميل...', 'Seeding...') : tr('تحميل قائمة الأدوية الافتراضية', 'Seed Default Formulary')}
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">{tr('إجمالي الأدوية', 'Total Drugs')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.byStatus['formulary'] || 0}</p>
          <p className="text-xs text-muted-foreground">{tr('في القائمة', 'Formulary')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-orange-600">{(stats.byStatus['restricted'] || 0) + (stats.byStatus['conditional'] || 0)}</p>
          <p className="text-xs text-muted-foreground">{tr('مقيد/مشروط', 'Restricted')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.highAlert}</p>
          <p className="text-xs text-muted-foreground">{tr('عالية الخطورة', 'High-Alert')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{stats.controlled}</p>
          <p className="text-xs text-muted-foreground">{tr('مواد مراقبة', 'Controlled')}</p>
        </CardContent></Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap border-b pb-2">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab.key)}
            className="gap-1.5"
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Drug List Tab */}
      {activeTab === 'drugs' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={tr('بحث بالاسم، رمز ATC، الفئة...', 'Search by name, ATC code, class...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder={tr('الحالة', 'Status')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr('الكل', 'All')}</SelectItem>
                <SelectItem value="formulary">{tr('في القائمة', 'Formulary')}</SelectItem>
                <SelectItem value="restricted">{tr('مقيد', 'Restricted')}</SelectItem>
                <SelectItem value="conditional">{tr('مشروط', 'Conditional')}</SelectItem>
                <SelectItem value="non_formulary">{tr('خارج القائمة', 'Non-Formulary')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Drug table */}
          <div className="rounded-md border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{tr('الاسم', 'Name')}</th>
                  <th className="px-3 py-2 text-left font-medium">{tr('الفئة', 'Class')}</th>
                  <th className="px-3 py-2 text-left font-medium">{tr('الحالة', 'Status')}</th>
                  <th className="px-3 py-2 text-left font-medium">{tr('ATC', 'ATC')}</th>
                  <th className="px-3 py-2 text-center font-medium">{tr('حمل', 'Preg')}</th>
                  <th className="px-3 py-2 text-center font-medium">{tr('تنبيهات', 'Alerts')}</th>
                </tr>
              </thead>
              <tbody>
                {drugs.map((drug: any) => (
                  <tr
                    key={drug.id}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => openDrugDetail(drug)}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{language === 'ar' ? drug.genericNameAr : drug.genericName}</div>
                      <div className="text-xs text-muted-foreground">
                        {Array.isArray(drug.brandNames) ? drug.brandNames.join(', ') : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {language === 'ar' ? drug.therapeuticClassAr : drug.therapeuticClass}
                    </td>
                    <td className="px-3 py-2">{statusBadge(drug.formularyStatus)}</td>
                    <td className="px-3 py-2 text-xs font-mono">{drug.atcCode}</td>
                    <td className="px-3 py-2 text-center">{pregBadge(drug.pregnancyCategory)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-center">
                        {drug.highAlert && (
                          <span title={tr('عالي الخطورة', 'High-Alert')}><AlertTriangle className="h-4 w-4 text-red-500" /></span>
                        )}
                        {drug.controlled && (
                          <span title={tr('مادة مراقبة', 'Controlled')}><Lock className="h-4 w-4 text-purple-500" /></span>
                        )}
                        {drug.blackBoxWarning && (
                          <span title={tr('تحذير صندوق أسود', 'Black Box Warning')}><FileWarning className="h-4 w-4 text-orange-500" /></span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {drugs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      {tr('لا توجد أدوية. اضغط "تحميل قائمة الأدوية الافتراضية" لبدء التحميل.',
                           'No drugs found. Click "Seed Default Formulary" to populate.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* High-Alert Tab */}
      {activeTab === 'highAlert' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                {tr('أدوية عالية الخطورة - معايير ISMP + وزارة الصحة السعودية',
                     'High-Alert Medications - ISMP + Saudi MOH Standards')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {tr('هذه الأدوية تتطلب إجراءات سلامة إضافية: تحقق مزدوج، حدود جرعات، تنبيهات آلية.',
                     'These medications require additional safety measures: double-check, dose limits, automated alerts.')}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {highAlertDrugs.map((drug: any) => (
                  <div
                    key={drug.id}
                    className="border border-red-200 rounded-md p-3 bg-red-50/50 cursor-pointer hover:bg-red-50"
                    onClick={() => openDrugDetail(drug)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{language === 'ar' ? drug.genericNameAr : drug.genericName}</span>
                      {drug.controlled && <Lock className="h-4 w-4 text-purple-500" />}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {language === 'ar' ? drug.therapeuticClassAr : drug.therapeuticClass}
                    </div>
                    {drug.blackBoxWarning && (
                      <div className="text-xs text-orange-700 mt-2 bg-orange-100 p-2 rounded">
                        {language === 'ar' ? drug.blackBoxWarningAr : drug.blackBoxWarning}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* LASA Tab */}
      {activeTab === 'lasa' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileWarning className="h-5 w-5 text-orange-500" />
                {tr('أدوية متشابهة في الشكل أو الاسم (LASA)', 'Look-Alike Sound-Alike (LASA) Pairs')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {tr('هذه الأدوية قد تُخلط بسبب تشابه أسمائها أو أشكالها. يجب التحقق الدقيق عند الصرف.',
                     'These drugs may be confused due to similar names or appearance. Verify carefully during dispensing.')}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {lasaPairs.map((item: any, i: number) => (
                  <div key={i} className="border rounded-md p-3 bg-orange-50/30">
                    <div className="font-medium text-sm">{language === 'ar' ? item.nameAr : item.name}</div>
                    <div className="mt-2 space-y-1">
                      {item.pairs.map((pair: string, j: number) => (
                        <div key={j} className="text-xs bg-orange-100 text-orange-800 rounded px-2 py-1">
                          {pair}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Controlled Tab */}
      {activeTab === 'controlled' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-600">
                <Lock className="h-5 w-5" />
                {tr('مواد مراقبة - جداول وزارة الصحة السعودية', 'Controlled Substances - Saudi MOH Schedules')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-purple-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">{tr('الدواء', 'Drug')}</th>
                      <th className="px-3 py-2 text-left font-medium">{tr('الجدول', 'Schedule')}</th>
                      <th className="px-3 py-2 text-left font-medium">{tr('القيود', 'Restrictions')}</th>
                      <th className="px-3 py-2 text-left font-medium">{tr('الفئة', 'Class')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {controlledDrugs.map((drug: any) => (
                      <tr
                        key={drug.id}
                        className="border-t hover:bg-purple-50/30 cursor-pointer"
                        onClick={() => openDrugDetail(drug)}
                      >
                        <td className="px-3 py-2 font-medium">{language === 'ar' ? drug.genericNameAr : drug.genericName}</td>
                        <td className="px-3 py-2">
                          <Badge className="bg-purple-100 text-purple-800">{drug.controlSchedule || '-'}</Badge>
                        </td>
                        <td className="px-3 py-2 text-xs max-w-xs truncate">
                          {language === 'ar' ? drug.restrictionCriteriaAr : drug.restrictionCriteria}
                        </td>
                        <td className="px-3 py-2 text-xs">{language === 'ar' ? drug.therapeuticClassAr : drug.therapeuticClass}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Restrictions Tab */}
      {activeTab === 'restrictions' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {tr('طلبات الموافقة على الأدوية المقيدة', 'Restricted Drug Approval Requests')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">{tr('الدواء', 'Drug')}</th>
                      <th className="px-3 py-2 text-left font-medium">{tr('الطالب', 'Requester')}</th>
                      <th className="px-3 py-2 text-left font-medium">{tr('السبب', 'Reason')}</th>
                      <th className="px-3 py-2 text-left font-medium">{tr('الحالة', 'Status')}</th>
                      <th className="px-3 py-2 text-left font-medium">{tr('التاريخ', 'Date')}</th>
                      <th className="px-3 py-2 text-center font-medium">{tr('إجراء', 'Action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {restrictions.map((req: any) => (
                      <tr key={req.id} className="border-t">
                        <td className="px-3 py-2 font-medium">{req.drugName || req.drugId}</td>
                        <td className="px-3 py-2 text-xs">{req.requestedByName || req.requestedBy}</td>
                        <td className="px-3 py-2 text-xs max-w-xs truncate">{req.reason}</td>
                        <td className="px-3 py-2">
                          {req.status === 'pending' && <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />{tr('معلق', 'Pending')}</Badge>}
                          {req.status === 'approved' && <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />{tr('موافق', 'Approved')}</Badge>}
                          {req.status === 'rejected' && <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />{tr('مرفوض', 'Rejected')}</Badge>}
                        </td>
                        <td className="px-3 py-2 text-xs">{new Date(req.createdAt).toLocaleDateString()}</td>
                        <td className="px-3 py-2 text-center">
                          {req.status === 'pending' && (
                            <div className="flex gap-1 justify-center">
                              <Button size="sm" variant="outline" className="h-7 text-xs text-green-600" onClick={() => handleReview(req.id, 'approved')}>
                                {tr('موافقة', 'Approve')}
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={() => handleReview(req.id, 'rejected')}>
                                {tr('رفض', 'Reject')}
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {restrictions.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                          {tr('لا توجد طلبات', 'No requests found')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">{tr('حسب الحالة', 'By Status')}</CardTitle></CardHeader>
              <CardContent>
                {Object.entries(stats.byStatus).map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center py-1.5 border-b last:border-0">
                    <span className="text-sm">{statusBadge(status)}</span>
                    <span className="font-mono text-sm font-bold">{count as number}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">{tr('حسب الفئة العلاجية', 'By Therapeutic Class')}</CardTitle></CardHeader>
              <CardContent className="max-h-64 overflow-auto">
                {Object.entries(stats.byClass).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([cls, count]) => (
                  <div key={cls} className="flex justify-between items-center py-1.5 border-b last:border-0">
                    <span className="text-sm">{cls}</span>
                    <span className="font-mono text-sm font-bold">{count as number}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Baby className="h-4 w-4" />{tr('حسب فئة الحمل', 'By Pregnancy Category')}</CardTitle></CardHeader>
              <CardContent>
                {['A', 'B', 'C', 'D', 'X'].map((cat) => (
                  <div key={cat} className="flex justify-between items-center py-1.5 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      {pregBadge(cat)}
                      <span className="text-xs text-muted-foreground">
                        {cat === 'A' && tr('آمن', 'Safe')}
                        {cat === 'B' && tr('آمن غالباً', 'Probably Safe')}
                        {cat === 'C' && tr('استخدام بحذر', 'Use with Caution')}
                        {cat === 'D' && tr('خطر مثبت', 'Positive Evidence of Risk')}
                        {cat === 'X' && tr('ممنوع', 'Contraindicated')}
                      </span>
                    </div>
                    <span className="font-mono text-sm font-bold">{stats.byPreg[cat] || 0}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" />{tr('ملخص السلامة', 'Safety Summary')}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" />{tr('عالية الخطورة', 'High-Alert')}</span>
                    <span className="font-mono font-bold text-red-600">{stats.highAlert}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm flex items-center gap-2"><Lock className="h-4 w-4 text-purple-500" />{tr('مواد مراقبة', 'Controlled')}</span>
                    <span className="font-mono font-bold text-purple-600">{stats.controlled}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm flex items-center gap-2"><Heart className="h-4 w-4 text-pink-500" />{tr('ممنوع بالحمل (X)', 'Category X (Pregnancy)')}</span>
                    <span className="font-mono font-bold text-pink-600">{stats.byPreg['X'] || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Drug Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          {selectedDrug && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {language === 'ar' ? selectedDrug.genericNameAr : selectedDrug.genericName}
                  {selectedDrug.highAlert && <AlertTriangle className="h-5 w-5 text-red-500" />}
                  {selectedDrug.controlled && <Lock className="h-5 w-5 text-purple-500" />}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">{tr('الاسم (EN)', 'Name (EN)')}: </span><span className="font-medium">{selectedDrug.genericName}</span></div>
                  <div><span className="text-muted-foreground">{tr('الاسم (AR)', 'Name (AR)')}: </span><span className="font-medium">{selectedDrug.genericNameAr}</span></div>
                  <div><span className="text-muted-foreground">{tr('الأسماء التجارية', 'Brand Names')}: </span>{(Array.isArray(selectedDrug.brandNames) ? selectedDrug.brandNames : []).join(', ')}</div>
                  <div><span className="text-muted-foreground">{tr('رمز ATC', 'ATC Code')}: </span><span className="font-mono">{selectedDrug.atcCode}</span></div>
                  <div><span className="text-muted-foreground">{tr('التسجيل SFDA', 'SFDA Reg.')}: </span>{selectedDrug.sfdaRegistration || '-'}</div>
                  <div><span className="text-muted-foreground">{tr('الحالة', 'Status')}: </span>{statusBadge(selectedDrug.formularyStatus)}</div>
                </div>

                {/* Black Box Warning */}
                {selectedDrug.blackBoxWarning && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <div className="font-bold text-red-700 flex items-center gap-1 mb-1"><FileWarning className="h-4 w-4" />{tr('تحذير صندوق أسود', 'BLACK BOX WARNING')}</div>
                    <p className="text-red-800 text-xs">{language === 'ar' ? selectedDrug.blackBoxWarningAr : selectedDrug.blackBoxWarning}</p>
                  </div>
                )}

                {/* Restriction Criteria */}
                {selectedDrug.restrictionCriteria && (
                  <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                    <div className="font-bold text-orange-700 mb-1">{tr('معايير التقييد', 'Restriction Criteria')}</div>
                    <p className="text-xs">{language === 'ar' ? selectedDrug.restrictionCriteriaAr : selectedDrug.restrictionCriteria}</p>
                  </div>
                )}

                {/* Safety Profile */}
                <div>
                  <h4 className="font-medium mb-2">{tr('ملف السلامة', 'Safety Profile')}</h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="border rounded p-2"><span className="text-muted-foreground">{tr('فئة الحمل', 'Pregnancy')}</span><div className="mt-1">{pregBadge(selectedDrug.pregnancyCategory)}</div></div>
                    <div className="border rounded p-2"><span className="text-muted-foreground">{tr('الرضاعة', 'Lactation')}</span><div className="mt-1">{selectedDrug.lactationSafe ? <Badge className="bg-green-100 text-green-800">{tr('آمن', 'Safe')}</Badge> : <Badge className="bg-red-100 text-red-800">{tr('غير آمن', 'Unsafe')}</Badge>}</div></div>
                    <div className="border rounded p-2"><span className="text-muted-foreground">{tr('أطفال', 'Pediatric')}</span><div className="mt-1">{selectedDrug.pediatricApproved ? <Badge className="bg-green-100 text-green-800">{tr('معتمد', 'Approved')}</Badge> : <Badge className="bg-yellow-100 text-yellow-800">{tr('غير معتمد', 'Not Approved')}</Badge>}</div></div>
                    <div className="border rounded p-2"><span className="text-muted-foreground">{tr('كبار السن', 'Geriatric')}</span><div className="mt-1">{selectedDrug.geriatricCaution ? <Badge className="bg-yellow-100 text-yellow-800">{tr('حذر', 'Caution')}</Badge> : <Badge className="bg-green-100 text-green-800">{tr('عادي', 'Normal')}</Badge>}</div></div>
                    <div className="border rounded p-2"><span className="text-muted-foreground">{tr('تعديل كلوي', 'Renal Adj.')}</span><div className="mt-1">{selectedDrug.renalAdjustment ? <Badge className="bg-yellow-100 text-yellow-800">{tr('نعم', 'Yes')}</Badge> : <Badge variant="secondary">{tr('لا', 'No')}</Badge>}</div></div>
                    <div className="border rounded p-2"><span className="text-muted-foreground">{tr('تعديل كبدي', 'Hepatic Adj.')}</span><div className="mt-1">{selectedDrug.hepaticAdjustment ? <Badge className="bg-yellow-100 text-yellow-800">{tr('نعم', 'Yes')}</Badge> : <Badge variant="secondary">{tr('لا', 'No')}</Badge>}</div></div>
                  </div>
                </div>

                {/* Forms & Strengths */}
                {Array.isArray(selectedDrug.forms) && selectedDrug.forms.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">{tr('الأشكال والتراكيز', 'Forms & Strengths')}</h4>
                    <div className="grid grid-cols-1 gap-1">
                      {selectedDrug.forms.map((f: any, i: number) => (
                        <div key={i} className="flex justify-between items-center border rounded px-3 py-1.5 text-xs">
                          <span>{f.form} - {f.strength}</span>
                          <div className="flex items-center gap-2">
                            <span>{f.unitPrice} SAR</span>
                            {f.inStock ? <Badge className="bg-green-100 text-green-800 text-[10px]">{tr('متوفر', 'In Stock')}</Badge> : <Badge className="bg-red-100 text-red-800 text-[10px]">{tr('غير متوفر', 'Out of Stock')}</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interactions */}
                {Array.isArray(selectedDrug.interactions) && selectedDrug.interactions.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">{tr('التداخلات الدوائية', 'Drug Interactions')}</h4>
                    <div className="space-y-2">
                      {selectedDrug.interactions.map((int: any, i: number) => (
                        <div key={i} className={`border rounded p-2 text-xs ${int.severity === 'major' ? 'border-red-200 bg-red-50/50' : int.severity === 'moderate' ? 'border-yellow-200 bg-yellow-50/50' : 'border-border'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={int.severity === 'major' ? 'bg-red-100 text-red-800' : int.severity === 'moderate' ? 'bg-yellow-100 text-yellow-800' : 'bg-muted text-foreground'}>
                              {int.severity}
                            </Badge>
                            <span className="font-medium">{int.interactsWith}</span>
                          </div>
                          <p>{language === 'ar' ? int.clinicalEffectAr : int.clinicalEffect}</p>
                          <p className="text-muted-foreground mt-1">{language === 'ar' ? int.managementAr : int.management}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contraindications */}
                {Array.isArray(selectedDrug.contraindications) && selectedDrug.contraindications.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">{tr('موانع الاستخدام', 'Contraindications')}</h4>
                    <ul className="list-disc list-inside text-xs space-y-1">
                      {(language === 'ar' && Array.isArray(selectedDrug.contraindicationsAr) ? selectedDrug.contraindicationsAr : selectedDrug.contraindications).map((c: string, i: number) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Monitoring */}
                {Array.isArray(selectedDrug.monitoringRequired) && selectedDrug.monitoringRequired.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">{tr('المتابعة المطلوبة', 'Required Monitoring')}</h4>
                    <ul className="list-disc list-inside text-xs space-y-1">
                      {selectedDrug.monitoringRequired.map((m: string, i: number) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* LASA */}
                {Array.isArray(selectedDrug.lasaPairs) && selectedDrug.lasaPairs.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">{tr('أدوية متشابهة LASA', 'LASA Pairs')}</h4>
                    <div className="flex gap-1 flex-wrap">
                      {selectedDrug.lasaPairs.map((p: string, i: number) => (
                        <Badge key={i} className="bg-orange-100 text-orange-800">{p}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Storage */}
                {selectedDrug.storageConditions && (
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    {tr('التخزين', 'Storage')}: {selectedDrug.storageConditions}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
