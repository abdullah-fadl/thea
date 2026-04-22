'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

const NICHD_COLORS: Record<string, string> = {
  'CATEGORY_I': 'bg-green-100 text-green-800 border-green-300',
  'CATEGORY_II': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'CATEGORY_III': 'bg-red-100 text-red-800 border-red-300',
};

const ANNOTATION_TYPES = [
  'DECELERATION', 'ACCELERATION', 'VARIABILITY_CHANGE', 'CONTRACTION',
  'MATERNAL_POSITION', 'INTERVENTION', 'MEDICATION', 'NOTE',
] as const;

function categoryLabel(cat: string, tr: (ar: string, en: string) => string) {
  switch (cat) {
    case 'CATEGORY_I': return tr('الفئة الأولى - طبيعي', 'Category I - Normal');
    case 'CATEGORY_II': return tr('الفئة الثانية - غير محدد', 'Category II - Indeterminate');
    case 'CATEGORY_III': return tr('الفئة الثالثة - غير طبيعي', 'Category III - Abnormal');
    default: return tr('غير مصنف', 'Unclassified');
  }
}

function statusColor(status: string) {
  switch (status) {
    case 'RECORDING': return 'bg-red-100 text-red-800 animate-pulse';
    case 'PAUSED': return 'bg-yellow-100 text-yellow-800';
    case 'COMPLETED': return 'bg-green-100 text-green-800';
    case 'REVIEWED': return 'bg-blue-100 text-blue-800';
    default: return 'bg-muted text-foreground';
  }
}

/* ---- Simple FHR + Contraction Strip Canvas ---- */
function StripChart({
  fhrData,
  contractionData,
  annotations,
  width,
  height,
  tr,
}: {
  fhrData: number[];
  contractionData: number[];
  annotations: any[];
  width: number;
  height: number;
  tr: (ar: string, en: string) => string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fhrHeight = Math.round(height * 0.65);
  const ucHeight = height - fhrHeight;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Clear
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, width, height);

    // FHR section background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, fhrHeight);

    // UC section background
    ctx.fillStyle = '#f0f9ff';
    ctx.fillRect(0, fhrHeight, width, ucHeight);

    // Divider
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, fhrHeight);
    ctx.lineTo(width, fhrHeight);
    ctx.stroke();

    // FHR grid lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    const fhrLevels = [60, 80, 100, 110, 120, 140, 160, 180, 200, 240];
    const fhrMin = 60;
    const fhrMax = 240;
    for (const level of fhrLevels) {
      const y = fhrHeight - ((level - fhrMin) / (fhrMax - fhrMin)) * (fhrHeight - 20);
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(String(level), 36, y + 3);
    }

    // Normal range highlight (110-160)
    const normalTop = fhrHeight - ((160 - fhrMin) / (fhrMax - fhrMin)) * (fhrHeight - 20);
    const normalBot = fhrHeight - ((110 - fhrMin) / (fhrMax - fhrMin)) * (fhrHeight - 20);
    ctx.fillStyle = 'rgba(34, 197, 94, 0.05)';
    ctx.fillRect(40, normalTop, width - 40, normalBot - normalTop);

    // Draw FHR trace
    if (fhrData.length > 1) {
      const step = (width - 40) / Math.max(fhrData.length - 1, 1);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < fhrData.length; i++) {
        const x = 40 + i * step;
        const y = fhrHeight - ((fhrData[i] - fhrMin) / (fhrMax - fhrMin)) * (fhrHeight - 20);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // UC grid
    const ucMax = 100;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    for (let level = 0; level <= 100; level += 25) {
      const y = fhrHeight + ucHeight - (level / ucMax) * (ucHeight - 15) - 5;
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(String(level), 36, y + 3);
    }

    // Draw contraction trace
    if (contractionData.length > 1) {
      const step = (width - 40) / Math.max(contractionData.length - 1, 1);
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < contractionData.length; i++) {
        const x = 40 + i * step;
        const y = fhrHeight + ucHeight - (contractionData[i] / ucMax) * (ucHeight - 15) - 5;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Draw annotations
    if (fhrData.length > 0) {
      const step = (width - 40) / Math.max(fhrData.length - 1, 1);
      for (const ann of annotations) {
        const idx = ann.dataPointIndex || 0;
        const x = 40 + idx * step;
        if (x < 40 || x > width) continue;

        ctx.strokeStyle = '#7c3aed';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, fhrHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        // Annotation label
        ctx.fillStyle = '#7c3aed';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        const label = ann.type?.substring(0, 4) || '?';
        ctx.fillText(label, x, 12);
      }
    }

    // Labels
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(12, fhrHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('FHR (bpm)', 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(12, fhrHeight + ucHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('UC', 0, 0);
    ctx.restore();

  }, [fhrData, contractionData, annotations, width, height, fhrHeight, ucHeight]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px`, border: '1px solid #e2e8f0', borderRadius: '8px' }}
    />
  );
}

export default function CtgMonitor() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const [tab, setTab] = useState('live');
  const [selectedRecording, setSelectedRecording] = useState<string | null>(null);
  const [patientFilter, setPatientFilter] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newPatientId, setNewPatientId] = useState('');
  const [newEncounterId, setNewEncounterId] = useState('');
  const [newGestationalWeeks, setNewGestationalWeeks] = useState('');
  const [showAnnotateDialog, setShowAnnotateDialog] = useState(false);
  const [annType, setAnnType] = useState<string>('NOTE');
  const [annText, setAnnText] = useState('');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(800);

  // Fetch recordings list
  const listUrl = `/api/obgyn/ctg${patientFilter ? `?patientId=${patientFilter}` : ''}`;
  const { data: listData, mutate: mutateList } = useSWR(listUrl, fetcher, { refreshInterval: 10000 });
  const recordings = listData?.recordings || [];

  // Fetch selected recording details
  const { data: recordingData, mutate: mutateRecording } = useSWR(
    selectedRecording ? `/api/obgyn/ctg/${selectedRecording}` : null,
    fetcher,
    { refreshInterval: selectedRecording ? 3000 : 0 }
  );
  const recording = recordingData?.recording;

  // Resize observer for chart
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setChartWidth(entry.contentRect.width);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Extract FHR and contraction data
  const fhrData = useMemo(() => {
    if (!recording?.fhrData) return [];
    return recording.fhrData.map((d: any) => d.value || d);
  }, [recording?.fhrData]);

  const contractionData = useMemo(() => {
    if (!recording?.contractionData) return [];
    return recording.contractionData.map((d: any) => d.value || d);
  }, [recording?.contractionData]);

  const annotations = useMemo(() => {
    return recording?.annotations || [];
  }, [recording?.annotations]);

  // Create new recording
  const startRecording = useCallback(async () => {
    if (!newPatientId) return;
    try {
      const res = await fetch('/api/obgyn/ctg', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: newPatientId,
          encounterId: newEncounterId || undefined,
          gestationalWeeks: newGestationalWeeks ? Number(newGestationalWeeks) : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: tr('بدأ التسجيل', 'Recording started') });
        setSelectedRecording(data.recording.id);
        setShowNewDialog(false);
        setNewPatientId('');
        setNewEncounterId('');
        setNewGestationalWeeks('');
        mutateList();
      } else {
        toast({ title: data.error || tr('فشل البدء', 'Start failed'), variant: 'destructive' });
      }
    } catch {
      toast({ title: tr('فشل البدء', 'Start failed'), variant: 'destructive' });
    }
  }, [newPatientId, newEncounterId, newGestationalWeeks, mutateList, toast, tr]);

  // Pause/Resume/Complete recording
  const updateRecordingStatus = useCallback(async (status: string) => {
    if (!selectedRecording) return;
    try {
      const res = await fetch(`/api/obgyn/ctg/${selectedRecording}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast({ title: tr('تم التحديث', 'Status updated') });
        mutateRecording();
        mutateList();
      }
    } catch {
      toast({ title: tr('فشل التحديث', 'Update failed'), variant: 'destructive' });
    }
  }, [selectedRecording, mutateRecording, mutateList, toast, tr]);

  // Request auto-interpretation
  const requestInterpretation = useCallback(async () => {
    if (!selectedRecording) return;
    try {
      const res = await fetch(`/api/obgyn/ctg/${selectedRecording}/interpret`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: tr('تم التحليل', 'Interpretation complete') });
        mutateRecording();
      } else {
        toast({ title: data.error || tr('فشل التحليل', 'Interpretation failed'), variant: 'destructive' });
      }
    } catch {
      toast({ title: tr('فشل التحليل', 'Interpretation failed'), variant: 'destructive' });
    }
  }, [selectedRecording, mutateRecording, toast, tr]);

  // Add annotation
  const addAnnotation = useCallback(async () => {
    if (!selectedRecording || !annType) return;
    try {
      const res = await fetch(`/api/obgyn/ctg/${selectedRecording}/annotate`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: annType,
          text: annText || undefined,
          timestamp: new Date().toISOString(),
          dataPointIndex: fhrData.length > 0 ? fhrData.length - 1 : 0,
        }),
      });
      if (res.ok) {
        toast({ title: tr('تمت إضافة الملاحظة', 'Annotation added') });
        setShowAnnotateDialog(false);
        setAnnText('');
        mutateRecording();
      }
    } catch {
      toast({ title: tr('فشلت الإضافة', 'Add failed'), variant: 'destructive' });
    }
  }, [selectedRecording, annType, annText, fhrData.length, mutateRecording, toast, tr]);

  // Simulate data (for demo purposes when recording is live)
  const simulateData = useCallback(async () => {
    if (!selectedRecording) return;
    const fhrPoints = Array.from({ length: 10 }, () => ({
      value: 130 + Math.round((Math.random() - 0.5) * 30),
      timestamp: new Date().toISOString(),
    }));
    const ucPoints = Array.from({ length: 10 }, () => ({
      value: 10 + Math.round(Math.random() * 40),
      timestamp: new Date().toISOString(),
    }));
    try {
      await fetch(`/api/obgyn/ctg/${selectedRecording}/data`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fhrPoints, contractionPoints: ucPoints }),
      });
      mutateRecording();
    } catch {
      // silent
    }
  }, [selectedRecording, mutateRecording]);

  const interpretation = recording?.interpretation;

  return (
    <div className="p-4 space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{tr('مراقبة نبض الجنين (CTG)', 'Fetal Monitor (CTG)')}</h1>
        <div className="flex items-center gap-2">
          <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
            <DialogTrigger asChild>
              <Button>{tr('تسجيل جديد', 'New Recording')}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{tr('بدء تسجيل CTG جديد', 'Start New CTG Recording')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>{tr('معرّف المريضة', 'Patient ID')}</Label>
                  <Input value={newPatientId} onChange={e => setNewPatientId(e.target.value)} placeholder={tr('أدخل معرّف المريضة', 'Enter patient ID')} />
                </div>
                <div>
                  <Label>{tr('معرّف الزيارة (اختياري)', 'Encounter ID (optional)')}</Label>
                  <Input value={newEncounterId} onChange={e => setNewEncounterId(e.target.value)} placeholder={tr('معرّف الزيارة', 'Encounter ID')} />
                </div>
                <div>
                  <Label>{tr('أسابيع الحمل', 'Gestational Weeks')}</Label>
                  <Input type="number" min="20" max="44" value={newGestationalWeeks} onChange={e => setNewGestationalWeeks(e.target.value)} placeholder="37" />
                </div>
                <Button className="w-full" onClick={startRecording} disabled={!newPatientId}>
                  {tr('بدء التسجيل', 'Start Recording')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="live">{tr('المراقبة المباشرة', 'Live Monitor')}</TabsTrigger>
          <TabsTrigger value="history">{tr('السجل', 'History')}</TabsTrigger>
        </TabsList>

        {/* Live Monitor Tab */}
        <TabsContent value="live" className="space-y-4">
          {!selectedRecording ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  {tr('اختر تسجيلاً من السجل أو ابدأ تسجيلاً جديداً', 'Select a recording from history or start a new one')}
                </p>
                <Button variant="outline" onClick={() => setTab('history')}>
                  {tr('عرض السجل', 'View History')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Recording Info Bar */}
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <Badge className={statusColor(recording?.status || '')}>
                        {recording?.status === 'RECORDING' ? tr('تسجيل', 'Recording') :
                         recording?.status === 'PAUSED' ? tr('متوقف', 'Paused') :
                         recording?.status === 'COMPLETED' ? tr('مكتمل', 'Completed') :
                         recording?.status === 'REVIEWED' ? tr('مراجع', 'Reviewed') :
                         recording?.status || ''}
                      </Badge>
                      {recording?.patientId && (
                        <span className="text-sm font-medium">
                          {tr('المريضة', 'Patient')}: {recording.patientId.substring(0, 8)}...
                        </span>
                      )}
                      {recording?.gestationalWeeks && (
                        <span className="text-sm text-muted-foreground">
                          {recording.gestationalWeeks} {tr('أسبوع', 'weeks')}
                        </span>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {fhrData.length} {tr('نقطة بيانات', 'data points')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {recording?.status === 'RECORDING' && (
                        <>
                          <Button size="sm" variant="outline" onClick={simulateData}>
                            {tr('محاكاة بيانات', 'Simulate Data')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => updateRecordingStatus('PAUSED')}>
                            {tr('إيقاف مؤقت', 'Pause')}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => updateRecordingStatus('COMPLETED')}>
                            {tr('إنهاء', 'Complete')}
                          </Button>
                        </>
                      )}
                      {recording?.status === 'PAUSED' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => updateRecordingStatus('RECORDING')}>
                            {tr('استئناف', 'Resume')}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => updateRecordingStatus('COMPLETED')}>
                            {tr('إنهاء', 'Complete')}
                          </Button>
                        </>
                      )}
                      {(recording?.status === 'COMPLETED' || recording?.status === 'REVIEWED') && (
                        <Button size="sm" variant="outline" onClick={requestInterpretation}>
                          {tr('تحليل تلقائي', 'Auto-Interpret')}
                        </Button>
                      )}
                      <Dialog open={showAnnotateDialog} onOpenChange={setShowAnnotateDialog}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            {tr('إضافة ملاحظة', 'Add Annotation')}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{tr('إضافة ملاحظة على التسجيل', 'Annotate Recording')}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3">
                            <div>
                              <Label>{tr('النوع', 'Type')}</Label>
                              <Select value={annType} onValueChange={setAnnType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {ANNOTATION_TYPES.map(t => (
                                    <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>{tr('النص', 'Text')}</Label>
                              <Textarea value={annText} onChange={e => setAnnText(e.target.value)} placeholder={tr('وصف الملاحظة', 'Description')} />
                            </div>
                            <Button className="w-full" onClick={addAnnotation}>
                              {tr('إضافة', 'Add')}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedRecording(null)}>
                        {tr('إغلاق', 'Close')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* NICHD Category Badge */}
              {interpretation && (
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{tr('تصنيف NICHD', 'NICHD Classification')}:</span>
                        <Badge className={`text-sm px-3 py-1 border ${NICHD_COLORS[interpretation.nichdCategory] || 'bg-muted text-foreground'}`}>
                          {categoryLabel(interpretation.nichdCategory, tr)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">{tr('الأساسي', 'Baseline')}: </span>
                          <span className="font-medium">{interpretation.baselineFhr} bpm</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{tr('التغيرية', 'Variability')}: </span>
                          <span className="font-medium">{interpretation.variability}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{tr('التسارعات', 'Accels')}: </span>
                          <span className="font-medium">{interpretation.accelerations}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{tr('التباطؤات', 'Decels')}: </span>
                          <span className="font-medium">{interpretation.decelerations}</span>
                        </div>
                      </div>
                    </div>
                    {interpretation.summary && (
                      <p className="text-sm text-muted-foreground mt-2">{interpretation.summary}</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Strip Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>{tr('شريط التسجيل', 'CTG Strip')}</span>
                    <div className="flex items-center gap-4 text-xs font-normal">
                      <div className="flex items-center gap-1">
                        <span className="w-3 h-0.5 bg-red-600 inline-block"></span>
                        <span>{tr('نبض الجنين (FHR)', 'FHR')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-3 h-0.5 bg-blue-600 inline-block"></span>
                        <span>{tr('الانقباضات (UC)', 'Contractions (UC)')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-3 h-0.5 bg-purple-600 inline-block" style={{ borderTop: '1px dashed' }}></span>
                        <span>{tr('ملاحظات', 'Annotations')}</span>
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent ref={chartContainerRef}>
                  {fhrData.length === 0 && contractionData.length === 0 ? (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                      {recording?.status === 'RECORDING'
                        ? tr('في انتظار البيانات... اضغط "محاكاة بيانات" للاختبار', 'Waiting for data... click "Simulate Data" to test')
                        : tr('لا توجد بيانات مسجلة', 'No data recorded')}
                    </div>
                  ) : (
                    <StripChart
                      fhrData={fhrData}
                      contractionData={contractionData}
                      annotations={annotations}
                      width={chartWidth - 32}
                      height={400}
                      tr={tr}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Annotations List */}
              {annotations.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{tr('الملاحظات', 'Annotations')} ({annotations.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {annotations.map((ann: any, i: number) => (
                        <div key={i} className="flex items-center justify-between border-b pb-2 last:border-b-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{ann.type?.replace(/_/g, ' ')}</Badge>
                            <span className="text-sm">{ann.text || '-'}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {ann.timestamp ? new Date(ann.timestamp).toLocaleTimeString() : '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Input
              placeholder={tr('تصفية حسب معرّف المريضة', 'Filter by patient ID')}
              value={patientFilter}
              onChange={e => setPatientFilter(e.target.value)}
              className="max-w-xs"
            />
          </div>

          {recordings.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              {tr('لا توجد تسجيلات', 'No recordings found')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-start p-2">{tr('المريضة', 'Patient')}</th>
                    <th className="text-start p-2">{tr('أسابيع الحمل', 'GA Weeks')}</th>
                    <th className="text-start p-2">{tr('البداية', 'Started')}</th>
                    <th className="text-start p-2">{tr('المدة', 'Duration')}</th>
                    <th className="text-start p-2">{tr('التصنيف', 'Category')}</th>
                    <th className="text-start p-2">{tr('الحالة', 'Status')}</th>
                    <th className="text-start p-2">{tr('إجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recordings.map((rec: any) => {
                    const duration = rec.startedAt && rec.endedAt
                      ? Math.round((new Date(rec.endedAt).getTime() - new Date(rec.startedAt).getTime()) / 60000)
                      : rec.startedAt
                        ? Math.round((Date.now() - new Date(rec.startedAt).getTime()) / 60000)
                        : 0;
                    return (
                      <tr key={rec.id} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => { setSelectedRecording(rec.id); setTab('live'); }}>
                        <td className="p-2 font-medium">{rec.patientId?.substring(0, 8)}...</td>
                        <td className="p-2">{rec.gestationalWeeks || '-'}</td>
                        <td className="p-2">{rec.startedAt ? new Date(rec.startedAt).toLocaleString() : '-'}</td>
                        <td className="p-2">{duration} {tr('دقيقة', 'min')}</td>
                        <td className="p-2">
                          {rec.interpretation?.nichdCategory ? (
                            <Badge className={`text-xs border ${NICHD_COLORS[rec.interpretation.nichdCategory] || ''}`}>
                              {rec.interpretation.nichdCategory.replace('CATEGORY_', tr('الفئة ', 'Cat '))}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-2"><Badge className={statusColor(rec.status)}>{rec.status}</Badge></td>
                        <td className="p-2">
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelectedRecording(rec.id); setTab('live'); }}>
                            {tr('عرض', 'View')}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
