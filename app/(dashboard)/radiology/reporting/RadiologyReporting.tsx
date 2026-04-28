'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { TheaImageViewer } from '@/components/radiology/thea-viewer';
import AiRadiologyAssist from '@/components/ai/AiRadiologyAssist';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Eye, EyeOff, Sparkles, FileText, AlertTriangle, CheckCircle2,
  Clock, BookOpen, Scan,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface RadiologyOrder {
  id: string;
  patientName: string;
  mrn: string;
  examCode: string;
  examName: string;
  examNameAr?: string;
  modality: 'XR' | 'CT' | 'MRI' | 'US' | 'NM' | 'FLUORO' | 'MAMMO';
  bodyPart: string;
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  status: 'ORDERED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
  orderedAt: string;
  clinicalHistory?: string;
  indication?: string;
  patientAge?: number;
  patientGender?: string;
  studyInstanceUID?: string;
  imageIds?: string[];
  sourceId?: string;
}

// ─── Report Templates ─────────────────────────────────────────────────────────
const TEMPLATES: Record<string, { arFindings: string; enFindings: string; arImpression: string; enImpression: string }> = {
  'chest-xr-normal': {
    arFindings: `الرئتان: واضحتان بدون ارتشاح أو عتامة.
القلب: حجم طبيعي، نسبة القلب للصدر ضمن المعدل الطبيعي.
المنصف: طبيعي، لا توسع.
الحجاب الحاجز: واضح، مستوى طبيعي.
العظام والأنسجة الرخوة: لا توجد تغيرات مرضية.`,
    enFindings: `Lungs: Clear, no infiltrates or opacities.
Heart: Normal size, cardiothoracic ratio within normal limits.
Mediastinum: Normal, no widening.
Diaphragm: Clear, normal position.
Bones and soft tissues: No significant bony or soft tissue abnormalities.`,
    arImpression: 'صورة صدر طبيعية.',
    enImpression: 'Normal chest X-ray.',
  },
  'chest-xr-pneumonia': {
    arFindings: `الرئتان: تكثف هوائي في القاعدة اليمنى مع تلوين هوائي.
القلب: حجم طبيعي.
المنصف: طبيعي.`,
    enFindings: `Lungs: Airspace consolidation in the right lower lobe with air bronchograms.
Heart: Normal size.
Mediastinum: Normal.`,
    arImpression: 'تكثف ذات رئة في الفص السفلي الأيمن.',
    enImpression: 'Right lower lobe pneumonia.',
  },
  'abdomen-us-normal': {
    arFindings: `الكبد: حجم وكثافة صدى طبيعية، لا توجد آفات بؤرية.
المرارة: طبيعية بدون حصوات أو سماكة جدار.
البنكرياس: طبيعي بقدر الظهور.
الطحال: حجم طبيعي، كثافة صدى متجانسة.
الكلى: حجم وشكل طبيعي، لا توجد حصوات أو استسقاء.
البطن: لا توجد سوائل حرة.`,
    enFindings: `Liver: Normal size and echogenicity, no focal lesions.
Gallbladder: Normal, no gallstones or wall thickening.
Pancreas: Unremarkable to the extent visualized.
Spleen: Normal size, homogeneous echogenicity.
Kidneys: Normal size and morphology, no stones or hydronephrosis.
Abdomen: No free fluid.`,
    arImpression: 'فحص سونار بطن طبيعي.',
    enImpression: 'Normal abdominal ultrasound.',
  },
  'brain-ct-normal': {
    arFindings: `لا توجد منطقة نزف أو احتشاء حديث.
البطينات: طبيعية الحجم والموضع.
الدماغ: لا توجد كتل أو آفات.
العظام: لا كسور.
الجيوب الأنفية: سليمة.`,
    enFindings: `No acute hemorrhage or infarction identified.
Ventricles: Normal size and position.
Brain parenchyma: No masses or lesions.
Bone windows: No fractures.
Paranasal sinuses: Clear.`,
    arImpression: 'صورة دماغ طبيعية بدون علامات نزف أو احتشاء حديث.',
    enImpression: 'Normal brain CT without evidence of acute hemorrhage or infarction.',
  },
  'knee-xr-normal': {
    arFindings: `المفصل: محافظ على مساحة طبيعية.
العظام: لا كسور أو انخلاع.
الأنسجة الرخوة: طبيعية.
لا توجد علامات التهاب مفصلي تنكسي.`,
    enFindings: `Joint space: Maintained.
Bones: No fractures or dislocations.
Soft tissues: Normal.
No significant degenerative changes.`,
    arImpression: 'صورة ركبة طبيعية.',
    enImpression: 'Normal knee X-ray.',
  },
};

// ─── Color maps ───────────────────────────────────────────────────────────────
const MODALITY_COLOR: Record<string, string> = {
  CT:     'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  MRI:    'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  US:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  XR:     'bg-muted text-foreground',
  NM:     'bg-yellow-100 text-yellow-700',
  FLUORO: 'bg-orange-100 text-orange-700',
  MAMMO:  'bg-pink-100 text-pink-700',
};

const PRIORITY_COLOR: Record<string, string> = {
  STAT:    'bg-red-100 text-red-700',
  URGENT:  'bg-amber-100 text-amber-700',
  ROUTINE: 'bg-muted text-muted-foreground',
};

export default function RadiologyReporting() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();

  const [selectedOrder, setSelectedOrder] = useState<RadiologyOrder | null>(null);
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [procedureNote, setProcedureNote] = useState('');
  const [criticalFinding, setCriticalFinding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [activeTab, setActiveTab] = useState<'report' | 'prior'>('report');

  const { data, mutate } = useSWR('/api/radiology/worklist?status=IN_PROGRESS', fetcher, {
    refreshInterval: 30000,
  });
  const orders: RadiologyOrder[] = Array.isArray(data?.orders) ? data.orders : [];

  const { data: priorData } = useSWR(
    selectedOrder ? `/api/radiology/reports?patientId=${selectedOrder.mrn}&limit=5` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const priorReports: { date: string; impression: string }[] = priorData?.reports ?? [];

  const selectOrder = (order: RadiologyOrder) => {
    setSelectedOrder(order);
    setFindings('');
    setImpression('');
    setProcedureNote('');
    setCriticalFinding(false);
    setShowViewer(false);
    setShowAI(false);
    setActiveTab('report');
  };

  const applyTemplate = (key: string) => {
    const t = TEMPLATES[key];
    if (!t) return;
    setFindings(language === 'ar' ? t.arFindings : t.enFindings);
    setImpression(language === 'ar' ? t.arImpression : t.enImpression);
  };

  const handleSave = async (isFinal: boolean) => {
    if (!selectedOrder) return;
    if (isFinal && (!findings.trim() || !impression.trim())) {
      toast({ title: tr('النتائج والانطباع مطلوبان', 'Findings and impression are required'), variant: 'destructive' as const });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/radiology/reports/save', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          findings,
          impression,
          procedureNote,
          criticalFinding,
          status: isFinal ? 'COMPLETED' : 'IN_PROGRESS',
        }),
      });
      if (!res.ok) throw new Error('Failed to save report');
      toast({ title: isFinal ? tr('تم إصدار التقرير النهائي', 'Final report issued') : tr('تم الحفظ كمسودة', 'Saved as draft') });
      await mutate();
      if (isFinal) {
        setSelectedOrder(null);
        setFindings('');
        setImpression('');
        setProcedureNote('');
        setCriticalFinding(false);
      }
    } catch {
      toast({ title: tr('فشل حفظ التقرير', 'Failed to save report'), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tr('كتابة تقارير الأشعة', 'Radiology Reporting')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {orders.length} {tr('فحص بانتظار التقرير', 'studies awaiting report')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* ─── Worklist ──────────────────────────────────────────────── */}
          <div className="lg:col-span-3">
            <div className="bg-card rounded-2xl border overflow-hidden">
              <div className="p-3 border-b bg-muted/30">
                <p className="font-semibold text-sm">{tr('قائمة العمل', 'Worklist')}</p>
                <p className="text-xs text-muted-foreground">{orders.length} {tr('حالة', 'cases')}</p>
              </div>
              <div className="divide-y max-h-[calc(100vh-220px)] overflow-y-auto">
                {orders.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    <Scan className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    {tr('لا توجد فحوصات', 'No pending studies')}
                  </div>
                ) : (
                  orders.map((order) => (
                    <button key={order.id} onClick={() => selectOrder(order)}
                      className={`w-full p-3 text-start hover:bg-muted/30 transition-colors ${
                        selectedOrder?.id === order.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                      }`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${MODALITY_COLOR[order.modality] || 'bg-muted text-muted-foreground'}`}>
                          {order.modality}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${PRIORITY_COLOR[order.priority]}`}>
                          {order.priority}
                        </span>
                      </div>
                      <p className="font-medium text-sm text-foreground">{order.patientName}</p>
                      <p className="text-xs text-muted-foreground truncate">{order.examNameAr || order.examName}</p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(order.orderedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ─── Main Reporting Panel ─────────────────────────────────── */}
          <div className="lg:col-span-9 space-y-4">
            {showViewer && selectedOrder && (
              <div className="h-[420px] rounded-2xl overflow-hidden border border-gray-700 shadow-xl">
                <TheaImageViewer
                  studyId={selectedOrder.id}
                  imageIds={selectedOrder.imageIds || []}
                  studyInstanceUID={selectedOrder.studyInstanceUID}
                  sourceId={selectedOrder.sourceId}
                  patientInfo={{ patientName: selectedOrder.patientName, mrn: selectedOrder.mrn }}
                  onClose={() => setShowViewer(false)}
                  mode="embedded"
                  initialLayout="1x1"
                />
              </div>
            )}

            {selectedOrder ? (
              <div className="bg-card rounded-2xl border">
                {/* Report header */}
                <div className="p-4 border-b">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-bold text-foreground">{selectedOrder.examNameAr || selectedOrder.examName}</h2>
                        <Badge className={`${MODALITY_COLOR[selectedOrder.modality]} text-xs`}>{selectedOrder.modality}</Badge>
                        <Badge className={`${PRIORITY_COLOR[selectedOrder.priority]} text-xs`}>{selectedOrder.priority}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {selectedOrder.patientName} · MRN: {selectedOrder.mrn}
                        {selectedOrder.patientAge ? ` · ${selectedOrder.patientAge}y` : ''}
                        {selectedOrder.patientGender ? ` · ${selectedOrder.patientGender}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setShowViewer(v => !v)} className="gap-1.5">
                        {showViewer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {showViewer ? tr('إخفاء الصور', 'Hide Images') : tr('عرض الصور', 'View Images')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowAI(v => !v)} className="gap-1.5">
                        <Sparkles className="h-4 w-4 text-purple-500" />
                        {tr('مساعد AI', 'AI Assist')}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Clinical context */}
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border-b text-sm space-y-1">
                  <div>
                    <span className="font-medium text-amber-800 dark:text-amber-300">{tr('التاريخ السريري: ', 'Clinical History: ')}</span>
                    <span className="text-amber-700 dark:text-amber-400">{selectedOrder.clinicalHistory || '—'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-amber-800 dark:text-amber-300">{tr('دواعي الفحص: ', 'Indication: ')}</span>
                    <span className="text-amber-700 dark:text-amber-400">{selectedOrder.indication || '—'}</span>
                  </div>
                </div>

                {/* AI Assist panel */}
                {showAI && (
                  <div className="border-b p-4 bg-muted/20">
                    <AiRadiologyAssist
                      modality={selectedOrder.modality}
                      bodyPart={selectedOrder.bodyPart || ''}
                      clinicalIndication={selectedOrder.indication}
                      currentFindings={findings}
                      priorReports={priorReports}
                      patientAge={selectedOrder.patientAge}
                      patientGender={selectedOrder.patientGender}
                      onInsertFinding={(text) => setFindings(prev => prev ? `${prev}\n${text}` : text)}
                      onInsertImpression={(text) => setImpression(prev => prev ? `${prev}\n${text}` : text)}
                    />
                  </div>
                )}

                {/* Tabs */}
                <div className="flex border-b px-4">
                  {([
                    { key: 'report' as const, ar: 'التقرير', en: 'Report' },
                    { key: 'prior'  as const, ar: 'تقارير سابقة', en: 'Prior Reports' },
                  ]).map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key)}
                      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}>
                      {tr(t.ar, t.en)}
                      {t.key === 'prior' && priorReports.length > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.5 bg-muted rounded text-xs">{priorReports.length}</span>
                      )}
                    </button>
                  ))}
                </div>

                {activeTab === 'report' && (
                  <div className="p-4 space-y-4">
                    {/* Templates */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{tr('قوالب جاهزة', 'Report Templates')}</Label>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { key: 'chest-xr-normal',    ar: 'صدر طبيعي',   en: 'Chest Normal' },
                          { key: 'chest-xr-pneumonia',  ar: 'التهاب رئة',  en: 'Pneumonia' },
                          { key: 'abdomen-us-normal',   ar: 'بطن طبيعي',   en: 'Abdomen US' },
                          { key: 'brain-ct-normal',     ar: 'دماغ طبيعي',  en: 'Brain CT' },
                          { key: 'knee-xr-normal',      ar: 'ركبة طبيعي',  en: 'Knee XR' },
                        ].map(t => (
                          <Button key={t.key} size="sm" variant="outline" onClick={() => applyTemplate(t.key)}
                            className="text-xs h-7 gap-1">
                            <BookOpen className="h-3 w-3" />
                            {tr(t.ar, t.en)}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label>{tr('النتائج (Findings) *', 'Findings *')}</Label>
                      <Textarea value={findings} onChange={(e) => setFindings(e.target.value)} rows={8}
                        className="thea-input-focus font-mono text-sm"
                        placeholder={tr('اكتب نتائج الفحص...', 'Enter findings...')} />
                    </div>

                    <div className="space-y-1">
                      <Label>{tr('الانطباع والخلاصة (Impression) *', 'Impression *')}</Label>
                      <Textarea value={impression} onChange={(e) => setImpression(e.target.value)} rows={3}
                        className="thea-input-focus font-mono text-sm"
                        placeholder={tr('الخلاصة والتوصيات...', 'Summary and recommendations...')} />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-sm">{tr('ملاحظة الإجراء (اختياري)', 'Procedure Note (Optional)')}</Label>
                      <Textarea value={procedureNote} onChange={(e) => setProcedureNote(e.target.value)} rows={2}
                        className="thea-input-focus text-sm"
                        placeholder={tr('تقنية الفحص، التباين، إلخ...', 'Technique, contrast, etc...')} />
                    </div>

                    {/* Critical finding toggle */}
                    <div className="flex items-center gap-3 p-3 border rounded-xl bg-red-50 dark:bg-red-950/20">
                      <button onClick={() => setCriticalFinding(v => !v)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${criticalFinding ? 'bg-red-600' : 'bg-muted'}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-card shadow transition-transform ${criticalFinding ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className={`h-4 w-4 ${criticalFinding ? 'text-red-600' : 'text-muted-foreground'}`} />
                        <Label className={`text-sm font-medium ${criticalFinding ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'}`}>
                          {tr('نتيجة حرجة — تتطلب إبلاغاً فورياً', 'Critical Finding — Requires Immediate Notification')}
                        </Label>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'prior' && (
                  <div className="p-4">
                    {priorReports.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        {tr('لا توجد تقارير سابقة', 'No prior reports')}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {priorReports.map((r, i) => (
                          <div key={i} className="border rounded-xl p-3 space-y-1">
                            <p className="text-xs text-muted-foreground">{new Date(r.date).toLocaleDateString()}</p>
                            <p className="text-sm">{r.impression}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Save buttons */}
                <div className="p-4 border-t flex items-center justify-between gap-3 flex-wrap">
                  {criticalFinding && (
                    <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      {tr('سيتم إرسال تنبيه حرج للطبيب المحوّل', 'Critical alert will be sent to referring physician')}
                    </div>
                  )}
                  <div className="flex gap-2 ms-auto">
                    <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
                      {tr('حفظ مسودة', 'Save Draft')}
                    </Button>
                    <Button onClick={() => handleSave(true)} disabled={saving || !findings.trim() || !impression.trim()}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      {saving ? tr('جارٍ الإصدار...', 'Issuing...') : tr('إصدار التقرير النهائي', 'Issue Final Report')}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-2xl border p-14 text-center text-muted-foreground">
                <Scan className="h-14 w-14 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">{tr('اختر فحصاً من قائمة العمل', 'Select a study from the worklist')}</p>
                <p className="text-sm mt-1">{tr('لكتابة التقرير الشعاعي', 'to start reporting')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
