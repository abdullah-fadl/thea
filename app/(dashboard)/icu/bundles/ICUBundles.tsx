'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IcuBundleForm } from '@/components/icu/IcuBundleForm';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function ICUBundles() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [episodeId, setEpisodeId] = useState('');
  const [bundleFilter, setBundleFilter] = useState('ALL');
  const [showNewAudit, setShowNewAudit] = useState(false);

  // Fetch bundle data
  const apiUrl = episodeId
    ? `/api/icu/episodes/${episodeId}/bundle-compliance?bundleType=${bundleFilter}`
    : null;

  const { data, isLoading, mutate } = useSWR(apiUrl, fetcher, {
    refreshInterval: 15000,
  });

  const audits: any[] = data?.audits ?? [];
  const summary = data?.summary ?? { VAP: { count: 0, avgCompliance: 0 }, CLABSI: { count: 0, avgCompliance: 0 }, CAUTI: { count: 0, avgCompliance: 0 } };
  const overallAvg: number = data?.overallAvg ?? 0;

  const complianceColor = (pct: number) => {
    if (pct >= 90) return 'text-green-600';
    if (pct >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const complianceBg = (pct: number) => {
    if (pct >= 90) return 'bg-green-50 border-green-200';
    if (pct >= 70) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const badgeVariant = (pct: number): 'default' | 'secondary' | 'destructive' => {
    if (pct >= 90) return 'default';
    if (pct >= 70) return 'secondary';
    return 'destructive';
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const bundleTypeLabel = (type: string) => {
    const map: Record<string, { ar: string; en: string }> = {
      VAP: { ar: 'ذات الرئة', en: 'VAP' },
      CLABSI: { ar: 'خط مركزي', en: 'CLABSI' },
      CAUTI: { ar: 'قسطرة بولية', en: 'CAUTI' },
    };
    return map[type] ? tr(map[type].ar, map[type].en) : type;
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {tr('حزم الوقاية من العدوى — العناية المركزة', 'ICU Infection Prevention Bundles')}
            </h1>
            <p className="text-muted-foreground">
              {tr('تدقيق الامتثال لحزم VAP / CLABSI / CAUTI', 'VAP / CLABSI / CAUTI bundle compliance auditing')}
            </p>
          </div>
          <Button onClick={() => setShowNewAudit(true)} disabled={!episodeId}>
            {tr('تدقيق جديد', 'New Audit')}
          </Button>
        </div>

        {/* Episode selector */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">{tr('معرّف الحلقة', 'Episode ID')}</label>
          <Input
            placeholder={tr('أدخل معرّف حلقة العناية المركزة', 'Enter ICU episode ID')}
            value={episodeId}
            onChange={(e) => setEpisodeId(e.target.value.trim())}
            className="max-w-sm"
          />
        </div>

        {/* KPI Cards */}
        {episodeId && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className={`border ${complianceBg(summary.VAP?.avgCompliance ?? 0)}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {tr('امتثال VAP', 'VAP Compliance')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${complianceColor(summary.VAP?.avgCompliance ?? 0)}`}>
                  {summary.VAP?.avgCompliance ?? 0}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.VAP?.count ?? 0} {tr('تدقيقات', 'audits')}
                </p>
              </CardContent>
            </Card>

            <Card className={`border ${complianceBg(summary.CLABSI?.avgCompliance ?? 0)}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {tr('امتثال CLABSI', 'CLABSI Compliance')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${complianceColor(summary.CLABSI?.avgCompliance ?? 0)}`}>
                  {summary.CLABSI?.avgCompliance ?? 0}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.CLABSI?.count ?? 0} {tr('تدقيقات', 'audits')}
                </p>
              </CardContent>
            </Card>

            <Card className={`border ${complianceBg(summary.CAUTI?.avgCompliance ?? 0)}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {tr('امتثال CAUTI', 'CAUTI Compliance')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${complianceColor(summary.CAUTI?.avgCompliance ?? 0)}`}>
                  {summary.CAUTI?.avgCompliance ?? 0}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.CAUTI?.count ?? 0} {tr('تدقيقات', 'audits')}
                </p>
              </CardContent>
            </Card>

            <Card className={`border ${complianceBg(overallAvg)}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {tr('الامتثال الكلي', 'Overall Compliance')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${complianceColor(overallAvg)}`}>
                  {overallAvg}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(summary.VAP?.count ?? 0) + (summary.CLABSI?.count ?? 0) + (summary.CAUTI?.count ?? 0)} {tr('إجمالي التدقيقات', 'total audits')}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filter tabs */}
        <Tabs value={bundleFilter} onValueChange={setBundleFilter}>
          <TabsList>
            <TabsTrigger value="ALL">{tr('الكل', 'All')}</TabsTrigger>
            <TabsTrigger value="VAP">VAP</TabsTrigger>
            <TabsTrigger value="CLABSI">CLABSI</TabsTrigger>
            <TabsTrigger value="CAUTI">CAUTI</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Audit history table */}
        {isLoading && episodeId ? (
          <div className="text-center py-12 text-muted-foreground">
            {tr('جاري التحميل...', 'Loading...')}
          </div>
        ) : !episodeId ? (
          <div className="text-center py-12 text-muted-foreground">
            {tr('أدخل معرّف الحلقة لعرض بيانات التدقيق', 'Enter an episode ID to view audit data')}
          </div>
        ) : audits.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {tr('لا توجد تدقيقات بعد', 'No audits yet')}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-start p-3 font-medium">{tr('التاريخ', 'Date')}</th>
                  <th className="text-start p-3 font-medium">{tr('النوع', 'Type')}</th>
                  <th className="text-start p-3 font-medium">{tr('الامتثال %', 'Compliance %')}</th>
                  <th className="text-start p-3 font-medium">{tr('المدقق', 'Auditor')}</th>
                  <th className="text-start p-3 font-medium">{tr('ملاحظات الانحراف', 'Deviation Notes')}</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((audit: any) => (
                  <tr key={audit.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-3">{formatDate(audit.auditDate)}</td>
                    <td className="p-3">
                      <Badge variant="outline">{bundleTypeLabel(audit.bundleType)}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={badgeVariant(audit.compliancePercent)}>
                        {audit.compliancePercent}%
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">{audit.auditorId || '—'}</td>
                    <td className="p-3 text-muted-foreground max-w-xs truncate">
                      {audit.deviationNotes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* New audit dialog */}
        <Dialog open={showNewAudit} onOpenChange={setShowNewAudit}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {tr('تدقيق حزمة جديد', 'New Bundle Audit')}
              </DialogTitle>
            </DialogHeader>
            <IcuBundleForm
              episodeId={episodeId}
              onSuccess={() => {
                setShowNewAudit(false);
                mutate();
              }}
              onCancel={() => setShowNewAudit(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
