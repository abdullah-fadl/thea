'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  FileText,
  Scan,
  Clock,
  Search,
} from 'lucide-react';
import RadiologyStructuredReport from '@/components/radiology/RadiologyStructuredReport';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

/* ─── Types ──────────────────────────────────────────────────────────── */
interface WorklistOrder {
  id: string;
  patientName: string;
  mrn: string;
  modality: string;
  bodyPart: string;
  examName: string;
  examNameAr?: string;
  priority: string;
  status: string;
  orderedAt: string;
}

interface StructuredReport {
  id: string;
  orderId: string;
  reportType: string;
  modality: string;
  category?: string;
  status: string;
  radiologistName?: string;
  createdAt: string;
  findings?: string;
  impression?: string;
}

/* ─── Constants ──────────────────────────────────────────────────────── */
const MODALITY_COLORS: Record<string, string> = {
  CT: 'bg-purple-100 text-purple-700',
  MR: 'bg-blue-100 text-blue-700',
  MRI: 'bg-blue-100 text-blue-700',
  US: 'bg-emerald-100 text-emerald-700',
  XR: 'bg-muted text-foreground',
  MAMMO: 'bg-pink-100 text-pink-700',
  NM: 'bg-yellow-100 text-yellow-700',
  PET: 'bg-pink-100 text-pink-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  STAT: 'bg-red-100 text-red-700',
  URGENT: 'bg-amber-100 text-amber-700',
  ROUTINE: 'bg-muted text-muted-foreground',
};

const REPORT_TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  FREE_TEXT: { en: 'Free Text', ar: 'نص حر' },
  BI_RADS: { en: 'BI-RADS', ar: 'BI-RADS' },
  LUNG_RADS: { en: 'Lung-RADS', ar: 'Lung-RADS' },
  TI_RADS: { en: 'TI-RADS', ar: 'TI-RADS' },
  PI_RADS: { en: 'PI-RADS', ar: 'PI-RADS' },
  LI_RADS: { en: 'LI-RADS', ar: 'LI-RADS' },
};

/* ─── Component ──────────────────────────────────────────────────────── */
export default function RadiologyStructuredReporting() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [selectedOrder, setSelectedOrder] = useState<WorklistOrder | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING_REPORT');

  // Fetch pending and in-progress orders
  const orderStatuses =
    statusFilter === 'PENDING_REPORT'
      ? 'ORDERED,SCHEDULED,IN_PROGRESS'
      : statusFilter === 'IN_PROGRESS'
      ? 'IN_PROGRESS'
      : 'ORDERED,SCHEDULED,IN_PROGRESS,REPORTED,VERIFIED';

  const { data: worklistData, isLoading: worklistLoading, mutate: mutateWorklist } = useSWR(
    `/api/radiology/worklist?status=${orderStatuses}${search ? `&search=${search}` : ''}`,
    fetcher,
    { refreshInterval: 15000 }
  );
  const orders: WorklistOrder[] = Array.isArray(worklistData?.orders) ? worklistData.orders : [];

  // Fetch report history
  const { data: historyData, mutate: mutateHistory } = useSWR(
    '/api/radiology/structured-report',
    fetcher,
    { refreshInterval: 15000 }
  );
  const reportHistory: StructuredReport[] = Array.isArray(historyData?.reports) ? historyData.reports : [];

  const handleReportSaved = () => {
    mutateWorklist();
    mutateHistory();
    setSelectedOrder(null);
    toast({ title: tr('تم حفظ التقرير بنجاح', 'Report saved successfully') });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {tr('التقارير الهيكلية للأشعة', 'Radiology Structured Reporting')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr('BI-RADS, Lung-RADS, TI-RADS, PI-RADS, LI-RADS', 'BI-RADS, Lung-RADS, TI-RADS, PI-RADS, LI-RADS')}
          </p>
        </div>

        <Tabs defaultValue="report" className="space-y-4">
          <TabsList>
            <TabsTrigger value="report">{tr('كتابة التقرير', 'Write Report')}</TabsTrigger>
            <TabsTrigger value="history">
              {tr('سجل التقارير', 'Report History')}
              {reportHistory.length > 0 && (
                <span className="ms-1.5 px-1.5 py-0.5 bg-muted rounded text-xs">{reportHistory.length}</span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ─── Write Report Tab ─────────────────────────────────────── */}
          <TabsContent value="report" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Study selector sidebar */}
              <div className="lg:col-span-3">
                <Card className="overflow-hidden">
                  <div className="p-3 border-b bg-muted/30">
                    <p className="font-semibold text-sm">{tr('اختر دراسة', 'Select Study')}</p>
                    <div className="mt-2 space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder={tr('بحث...', 'Search...')}
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="pl-9 h-8 text-xs"
                        />
                      </div>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING_REPORT">{tr('بانتظار التقرير', 'Pending Report')}</SelectItem>
                          <SelectItem value="IN_PROGRESS">{tr('قيد التنفيذ', 'In Progress')}</SelectItem>
                          <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="divide-y max-h-[calc(100vh-340px)] overflow-y-auto">
                    {worklistLoading ? (
                      <div className="p-6 text-center text-muted-foreground text-sm">
                        {tr('جاري التحميل...', 'Loading...')}
                      </div>
                    ) : orders.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground text-sm">
                        <Scan className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        {tr('لا توجد دراسات', 'No studies found')}
                      </div>
                    ) : (
                      orders.map((order) => (
                        <button
                          key={order.id}
                          onClick={() => setSelectedOrder(order)}
                          className={`w-full p-3 text-start hover:bg-muted/30 transition-colors ${
                            selectedOrder?.id === order.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <Badge className={`text-[10px] ${MODALITY_COLORS[order.modality] || 'bg-muted text-muted-foreground'}`}>
                              {order.modality}
                            </Badge>
                            <Badge className={`text-[10px] ${PRIORITY_COLORS[order.priority] || ''}`}>
                              {order.priority}
                            </Badge>
                          </div>
                          <p className="font-medium text-sm text-foreground">{order.patientName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {language === 'ar' && order.examNameAr ? order.examNameAr : order.examName}
                          </p>
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(order.orderedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </Card>
              </div>

              {/* Report form */}
              <div className="lg:col-span-9">
                {selectedOrder ? (
                  <RadiologyStructuredReport
                    orderId={selectedOrder.id}
                    modality={selectedOrder.modality}
                    patientName={selectedOrder.patientName}
                    mrn={selectedOrder.mrn}
                    onSaved={handleReportSaved}
                  />
                ) : (
                  <Card className="p-14 text-center text-muted-foreground">
                    <Scan className="h-14 w-14 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium">
                      {tr('اختر دراسة من القائمة', 'Select a study from the list')}
                    </p>
                    <p className="text-sm mt-1">
                      {tr('لبدء كتابة التقرير الهيكلي', 'to start structured reporting')}
                    </p>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ─── History Tab ──────────────────────────────────────────── */}
          <TabsContent value="history">
            <Card className="overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-start text-sm font-medium text-muted-foreground">
                      {tr('التاريخ', 'Date')}
                    </th>
                    <th className="px-4 py-3 text-start text-sm font-medium text-muted-foreground">
                      {tr('نوع التقرير', 'Report Type')}
                    </th>
                    <th className="px-4 py-3 text-start text-sm font-medium text-muted-foreground">
                      {tr('النوع', 'Modality')}
                    </th>
                    <th className="px-4 py-3 text-start text-sm font-medium text-muted-foreground">
                      {tr('التصنيف', 'Category')}
                    </th>
                    <th className="px-4 py-3 text-start text-sm font-medium text-muted-foreground">
                      {tr('الطبيب', 'Radiologist')}
                    </th>
                    <th className="px-4 py-3 text-start text-sm font-medium text-muted-foreground">
                      {tr('الحالة', 'Status')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {reportHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        {tr('لا توجد تقارير سابقة', 'No reports found')}
                      </td>
                    </tr>
                  ) : (
                    reportHistory.map((report) => {
                      const rtLabel = REPORT_TYPE_LABELS[report.reportType];
                      return (
                        <tr key={report.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {new Date(report.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs">
                              {rtLabel ? (language === 'ar' ? rtLabel.ar : rtLabel.en) : report.reportType}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`text-xs ${MODALITY_COLORS[report.modality] || 'bg-muted text-muted-foreground'}`}>
                              {report.modality || '---'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground">
                            {report.category || '---'}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {report.radiologistName || '---'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`text-xs ${
                              report.status === 'FINAL'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {report.status === 'FINAL'
                                ? tr('نهائي', 'Final')
                                : tr('مسودة', 'Draft')}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
