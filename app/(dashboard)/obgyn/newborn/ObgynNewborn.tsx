'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Baby,
  HeartPulse,
  Scale,
  Activity,
  Milk,
  Plus,
  RefreshCw,
  Eye,
  X,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type NewbornRecord = {
  id: string;
  motherPatientId: string;
  motherName?: string;
  dateOfBirth: string;
  timeOfBirth?: string;
  gender?: string;
  birthWeight?: number;
  birthLength?: number;
  gestationalAge?: number;
  gestationalAgeDays?: number;
  apgar1Min?: number;
  apgar5Min?: number;
  apgar10Min?: number;
  deliveryType?: string;
  nicuAdmission?: boolean;
  nicuAdmissionReason?: string;
  feedingType?: string;
  skinToSkin?: boolean;
  status: string;
  [key: string]: any;
};

const DELIVERY_LABELS: Record<string, { ar: string; en: string }> = {
  SVD: { ar: 'ولادة طبيعية', en: 'SVD' },
  CS: { ar: 'قيصرية', en: 'C-Section' },
  INSTRUMENTAL_VACUUM: { ar: 'شفط', en: 'Vacuum' },
  INSTRUMENTAL_FORCEPS: { ar: 'ملقط', en: 'Forceps' },
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  DISCHARGED: 'bg-muted text-muted-foreground',
  TRANSFERRED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DECEASED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const GENDER_LABELS: Record<string, { ar: string; en: string }> = {
  MALE: { ar: 'ذكر', en: 'Male' },
  FEMALE: { ar: 'أنثى', en: 'Female' },
  AMBIGUOUS: { ar: 'غير محدد', en: 'Ambiguous' },
};

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  ACTIVE: { ar: 'نشط', en: 'Active' },
  DISCHARGED: { ar: 'خرج', en: 'Discharged' },
  TRANSFERRED: { ar: 'محول', en: 'Transferred' },
  DECEASED: { ar: 'متوفي', en: 'Deceased' },
};

export default function ObgynNewborn() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const isRTL = language === 'ar';

  const [tab, setTab] = useState('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Build query params
  const params = new URLSearchParams();
  if (tab === 'ACTIVE') params.set('status', 'ACTIVE');
  if (tab === 'NICU') params.set('nicuAdmission', 'true');
  if (tab === 'DISCHARGED') params.set('status', 'DISCHARGED');
  const qs = params.toString();

  const { data, mutate, isLoading } = useSWR(
    `/api/obgyn/newborn${qs ? `?${qs}` : ''}`,
    fetcher,
    { refreshInterval: 15000 },
  );
  const items: NewbornRecord[] = Array.isArray(data?.items) ? data.items : [];

  // Detail record
  const { data: detailData } = useSWR(
    showDetail ? `/api/obgyn/newborn/${showDetail}` : null,
    fetcher,
  );
  const detailRecord: NewbornRecord | null = detailData?.record || null;

  // --- KPI calculations ---
  const allItems = items;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = allItems.filter((r) => r.dateOfBirth?.slice(0, 10) === today).length;
  const nicuCount = allItems.filter((r) => r.nicuAdmission).length;
  const apgarScores = allItems.filter((r) => r.apgar5Min != null).map((r) => r.apgar5Min!);
  const avgApgar = apgarScores.length > 0 ? (apgarScores.reduce((a, b) => a + b, 0) / apgarScores.length).toFixed(1) : '--';
  const weights = allItems.filter((r) => r.birthWeight != null).map((r) => Number(r.birthWeight));
  const avgWeight = weights.length > 0 ? Math.round(weights.reduce((a, b) => a + b, 0) / weights.length) : '--';
  const breastfed = allItems.filter((r) => r.feedingType === 'BREAST').length;
  const breastRate = allItems.length > 0 ? Math.round((breastfed / allItems.length) * 100) : '--';

  // --- Create form ---
  const [form, setForm] = useState<Record<string, any>>({
    motherPatientId: '',
    dateOfBirth: '',
    gender: '',
    deliveryType: '',
    birthWeight: '',
    birthLength: '',
    headCircumference: '',
    gestationalAge: '',
    gestationalAgeDays: '',
    apgar1Min: '',
    apgar5Min: '',
    apgar10Min: '',
    heartRate: '',
    respiratoryRate: '',
    temperature: '',
    oxygenSaturation: '',
    skinColor: '',
    cry: '',
    tone: '',
    reflexes: '',
    presentation: '',
    resuscitationNeeded: false,
    cordClamped: false,
    cordBloodBanked: false,
    vitaminKGiven: false,
    eyeProphylaxis: false,
    feedingType: '',
    skinToSkin: false,
    bandApplied: false,
    footprintsTaken: false,
    nicuAdmission: false,
    nicuAdmissionReason: '',
    attendingPhysician: '',
    notes: '',
  });

  const setField = useCallback((field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCreate = async () => {
    if (!form.motherPatientId || !form.dateOfBirth) return;
    setCreating(true);
    try {
      const payload: any = {
        motherPatientId: form.motherPatientId,
        dateOfBirth: form.dateOfBirth,
      };

      // Optional string enums
      if (form.gender) payload.gender = form.gender;
      if (form.deliveryType) payload.deliveryType = form.deliveryType;
      if (form.presentation) payload.presentation = form.presentation;
      if (form.skinColor) payload.skinColor = form.skinColor;
      if (form.cry) payload.cry = form.cry;
      if (form.tone) payload.tone = form.tone;
      if (form.reflexes) payload.reflexes = form.reflexes;
      if (form.feedingType) payload.feedingType = form.feedingType;
      if (form.nicuAdmissionReason) payload.nicuAdmissionReason = form.nicuAdmissionReason;
      if (form.attendingPhysician) payload.attendingPhysician = form.attendingPhysician;
      if (form.notes) payload.notes = form.notes;

      // Optional numbers
      const numFields = [
        'birthWeight', 'birthLength', 'headCircumference', 'gestationalAge',
        'gestationalAgeDays', 'apgar1Min', 'apgar5Min', 'apgar10Min',
        'heartRate', 'respiratoryRate', 'temperature', 'oxygenSaturation',
      ];
      for (const f of numFields) {
        if (form[f] !== '' && form[f] != null) payload[f] = Number(form[f]);
      }

      // Booleans
      const boolFields = [
        'resuscitationNeeded', 'cordClamped', 'cordBloodBanked',
        'vitaminKGiven', 'eyeProphylaxis', 'skinToSkin',
        'bandApplied', 'footprintsTaken', 'nicuAdmission',
      ];
      for (const f of boolFields) {
        payload[f] = !!form[f];
      }

      const res = await fetch('/api/obgyn/newborn', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowCreate(false);
        setForm({
          motherPatientId: '', dateOfBirth: '', gender: '', deliveryType: '',
          birthWeight: '', birthLength: '', headCircumference: '',
          gestationalAge: '', gestationalAgeDays: '', apgar1Min: '', apgar5Min: '',
          apgar10Min: '', heartRate: '', respiratoryRate: '', temperature: '',
          oxygenSaturation: '', skinColor: '', cry: '', tone: '', reflexes: '',
          presentation: '', resuscitationNeeded: false, cordClamped: false,
          cordBloodBanked: false, vitaminKGiven: false, eyeProphylaxis: false,
          feedingType: '', skinToSkin: false, bandApplied: false,
          footprintsTaken: false, nicuAdmission: false, nicuAdmissionReason: '',
          attendingPhysician: '', notes: '',
        });
        mutate();
      }
    } finally {
      setCreating(false);
    }
  };

  // --- Render helpers ---
  const renderKPI = (icon: React.ReactNode, label: string, value: string | number, color: string) => (
    <Card className="flex-1 min-w-[160px]">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-xl ${color}`}>{icon}</div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return d;
    }
  };

  const formatTime = (d: string) => {
    try {
      return new Date(d).toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tr('حديثي الولادة / العناية المركزة', 'Newborn / NICU')}</h1>
            <p className="text-muted-foreground text-sm">{tr('إدارة سجلات حديثي الولادة والعناية المركزة', 'Manage newborn and NICU records')}</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            {tr('تسجيل مولود جديد', 'Register New Newborn')}
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="flex flex-wrap gap-4">
          {renderKPI(<Baby className="w-5 h-5 text-pink-600" />, tr('المواليد اليوم', 'Births Today'), todayCount, 'bg-pink-100 dark:bg-pink-900/30')}
          {renderKPI(<HeartPulse className="w-5 h-5 text-red-600" />, tr('في العناية المركزة', 'In NICU'), nicuCount, 'bg-red-100 dark:bg-red-900/30')}
          {renderKPI(<Activity className="w-5 h-5 text-blue-600" />, tr('متوسط APGAR (5 دقائق)', 'Avg APGAR (5min)'), avgApgar, 'bg-blue-100 dark:bg-blue-900/30')}
          {renderKPI(<Scale className="w-5 h-5 text-amber-600" />, tr('متوسط الوزن (غم)', 'Avg Weight (g)'), avgWeight, 'bg-amber-100 dark:bg-amber-900/30')}
          {renderKPI(<Milk className="w-5 h-5 text-emerald-600" />, tr('نسبة الرضاعة الطبيعية', 'Breastfeeding Rate'), breastRate !== '--' ? `${breastRate}%` : '--', 'bg-emerald-100 dark:bg-emerald-900/30')}
        </div>

        {/* Filter Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="ALL">{tr('الكل', 'All')}</TabsTrigger>
            <TabsTrigger value="ACTIVE">{tr('نشط', 'Active')}</TabsTrigger>
            <TabsTrigger value="NICU">{tr('عناية مركزة', 'NICU')}</TabsTrigger>
            <TabsTrigger value="DISCHARGED">{tr('مخرج', 'Discharged')}</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Data Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Baby className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>{tr('لا توجد سجلات', 'No records found')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">{tr('الأم', 'Mother')}</th>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">{tr('تاريخ/وقت الولادة', 'DOB/Time')}</th>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">{tr('الجنس', 'Gender')}</th>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">{tr('الوزن (غم)', 'Weight (g)')}</th>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">{tr('عمر الحمل', 'GA')}</th>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">{tr('APGAR 1/5', 'APGAR 1/5')}</th>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">{tr('نوع الولادة', 'Delivery')}</th>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">{tr('عناية مركزة', 'NICU')}</th>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">{tr('الحالة', 'Status')}</th>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{r.motherName || r.motherPatientId?.slice(0, 8) || '--'}</td>
                        <td className="px-4 py-3">
                          <div>{formatDate(r.dateOfBirth)}</div>
                          {r.timeOfBirth && <div className="text-xs text-muted-foreground">{formatTime(r.timeOfBirth)}</div>}
                        </td>
                        <td className="px-4 py-3">{r.gender ? tr(GENDER_LABELS[r.gender]?.ar || r.gender, GENDER_LABELS[r.gender]?.en || r.gender) : '--'}</td>
                        <td className="px-4 py-3">{r.birthWeight != null ? Number(r.birthWeight).toFixed(0) : '--'}</td>
                        <td className="px-4 py-3">{r.gestationalAge != null ? `${r.gestationalAge}${r.gestationalAgeDays ? `+${r.gestationalAgeDays}` : ''}w` : '--'}</td>
                        <td className="px-4 py-3">{r.apgar1Min ?? '--'} / {r.apgar5Min ?? '--'}</td>
                        <td className="px-4 py-3">
                          {r.deliveryType ? tr(DELIVERY_LABELS[r.deliveryType]?.ar || r.deliveryType, DELIVERY_LABELS[r.deliveryType]?.en || r.deliveryType) : '--'}
                        </td>
                        <td className="px-4 py-3">
                          {r.nicuAdmission ? (
                            <Badge variant="destructive" className="text-xs">{tr('نعم', 'Yes')}</Badge>
                          ) : (
                            <span className="text-muted-foreground">{tr('لا', 'No')}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`text-xs ${STATUS_COLORS[r.status] || ''}`}>
                            {tr(STATUS_LABELS[r.status]?.ar || r.status, STATUS_LABELS[r.status]?.en || r.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Button variant="ghost" size="sm" onClick={() => setShowDetail(r.id)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* =========== CREATE DIALOG =========== */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
            <DialogHeader>
              <DialogTitle>{tr('تسجيل مولود جديد', 'Register New Newborn')}</DialogTitle>
            </DialogHeader>

            <div className="space-y-6 pt-2">
              {/* Birth Details */}
              <section>
                <h3 className="font-semibold text-sm mb-3 text-blue-600">{tr('تفاصيل الولادة', 'Birth Details')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>{tr('معرف الأم (مطلوب)', 'Mother Patient ID (required)')}</Label>
                    <Input value={form.motherPatientId} onChange={(e) => setField('motherPatientId', e.target.value)} placeholder={tr('أدخل معرف الأم', 'Enter mother patient ID')} />
                  </div>
                  <div>
                    <Label>{tr('تاريخ الولادة (مطلوب)', 'Date of Birth (required)')}</Label>
                    <Input type="datetime-local" value={form.dateOfBirth} onChange={(e) => setField('dateOfBirth', e.target.value)} />
                  </div>
                  <div>
                    <Label>{tr('الجنس', 'Gender')}</Label>
                    <Select value={form.gender} onValueChange={(v) => setField('gender', v)}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MALE">{tr('ذكر', 'Male')}</SelectItem>
                        <SelectItem value="FEMALE">{tr('أنثى', 'Female')}</SelectItem>
                        <SelectItem value="AMBIGUOUS">{tr('غير محدد', 'Ambiguous')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('نوع الولادة', 'Delivery Type')}</Label>
                    <Select value={form.deliveryType} onValueChange={(v) => setField('deliveryType', v)}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SVD">{tr('ولادة طبيعية', 'SVD')}</SelectItem>
                        <SelectItem value="CS">{tr('قيصرية', 'C-Section')}</SelectItem>
                        <SelectItem value="INSTRUMENTAL_VACUUM">{tr('شفط', 'Vacuum')}</SelectItem>
                        <SelectItem value="INSTRUMENTAL_FORCEPS">{tr('ملقط', 'Forceps')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('المجيء', 'Presentation')}</Label>
                    <Select value={form.presentation} onValueChange={(v) => setField('presentation', v)}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CEPHALIC">{tr('رأسي', 'Cephalic')}</SelectItem>
                        <SelectItem value="BREECH">{tr('مقعدي', 'Breech')}</SelectItem>
                        <SelectItem value="TRANSVERSE">{tr('عرضي', 'Transverse')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('الوزن عند الولادة (غم)', 'Birth Weight (g)')}</Label>
                    <Input type="number" value={form.birthWeight} onChange={(e) => setField('birthWeight', e.target.value)} />
                  </div>
                  <div>
                    <Label>{tr('الطول (سم)', 'Birth Length (cm)')}</Label>
                    <Input type="number" value={form.birthLength} onChange={(e) => setField('birthLength', e.target.value)} />
                  </div>
                  <div>
                    <Label>{tr('محيط الرأس (سم)', 'Head Circumference (cm)')}</Label>
                    <Input type="number" value={form.headCircumference} onChange={(e) => setField('headCircumference', e.target.value)} />
                  </div>
                  <div>
                    <Label>{tr('عمر الحمل (أسابيع)', 'Gestational Age (weeks)')}</Label>
                    <Input type="number" value={form.gestationalAge} onChange={(e) => setField('gestationalAge', e.target.value)} />
                  </div>
                  <div>
                    <Label>{tr('أيام إضافية', 'Additional Days')}</Label>
                    <Input type="number" min={0} max={6} value={form.gestationalAgeDays} onChange={(e) => setField('gestationalAgeDays', e.target.value)} />
                  </div>
                </div>
              </section>

              {/* APGAR Scores */}
              <section>
                <h3 className="font-semibold text-sm mb-3 text-blue-600">{tr('درجات أبغار', 'APGAR Scores')}</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>{tr('1 دقيقة', '1 Min')}</Label>
                    <Input type="number" min={0} max={10} value={form.apgar1Min} onChange={(e) => setField('apgar1Min', e.target.value)} />
                  </div>
                  <div>
                    <Label>{tr('5 دقائق', '5 Min')}</Label>
                    <Input type="number" min={0} max={10} value={form.apgar5Min} onChange={(e) => setField('apgar5Min', e.target.value)} />
                  </div>
                  <div>
                    <Label>{tr('10 دقائق', '10 Min')}</Label>
                    <Input type="number" min={0} max={10} value={form.apgar10Min} onChange={(e) => setField('apgar10Min', e.target.value)} />
                  </div>
                </div>
              </section>

              {/* Vitals */}
              <section>
                <h3 className="font-semibold text-sm mb-3 text-blue-600">{tr('العلامات الحيوية', 'Vitals')}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label>{tr('معدل القلب', 'Heart Rate')}</Label>
                    <Input type="number" value={form.heartRate} onChange={(e) => setField('heartRate', e.target.value)} />
                  </div>
                  <div>
                    <Label>{tr('معدل التنفس', 'Resp Rate')}</Label>
                    <Input type="number" value={form.respiratoryRate} onChange={(e) => setField('respiratoryRate', e.target.value)} />
                  </div>
                  <div>
                    <Label>{tr('الحرارة', 'Temperature')}</Label>
                    <Input type="number" step="0.1" value={form.temperature} onChange={(e) => setField('temperature', e.target.value)} />
                  </div>
                  <div>
                    <Label>{tr('تشبع الأكسجين %', 'SpO2 %')}</Label>
                    <Input type="number" value={form.oxygenSaturation} onChange={(e) => setField('oxygenSaturation', e.target.value)} />
                  </div>
                </div>
              </section>

              {/* Newborn Exam */}
              <section>
                <h3 className="font-semibold text-sm mb-3 text-blue-600">{tr('فحص المولود', 'Newborn Exam')}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label>{tr('لون البشرة', 'Skin Color')}</Label>
                    <Select value={form.skinColor} onValueChange={(v) => setField('skinColor', v)}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PINK">{tr('وردي', 'Pink')}</SelectItem>
                        <SelectItem value="ACROCYANOSIS">{tr('زرقة طرفية', 'Acrocyanosis')}</SelectItem>
                        <SelectItem value="CYANOTIC">{tr('مزرق', 'Cyanotic')}</SelectItem>
                        <SelectItem value="JAUNDICED">{tr('يرقاني', 'Jaundiced')}</SelectItem>
                        <SelectItem value="PALE">{tr('شاحب', 'Pale')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('البكاء', 'Cry')}</Label>
                    <Select value={form.cry} onValueChange={(v) => setField('cry', v)}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STRONG">{tr('قوي', 'Strong')}</SelectItem>
                        <SelectItem value="WEAK">{tr('ضعيف', 'Weak')}</SelectItem>
                        <SelectItem value="ABSENT">{tr('غائب', 'Absent')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('التوتر العضلي', 'Tone')}</Label>
                    <Select value={form.tone} onValueChange={(v) => setField('tone', v)}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GOOD">{tr('جيد', 'Good')}</SelectItem>
                        <SelectItem value="DECREASED">{tr('منخفض', 'Decreased')}</SelectItem>
                        <SelectItem value="FLOPPY">{tr('مرتخي', 'Floppy')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr('المنعكسات', 'Reflexes')}</Label>
                    <Select value={form.reflexes} onValueChange={(v) => setField('reflexes', v)}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NORMAL">{tr('طبيعي', 'Normal')}</SelectItem>
                        <SelectItem value="DECREASED">{tr('منخفض', 'Decreased')}</SelectItem>
                        <SelectItem value="ABSENT">{tr('غائب', 'Absent')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.resuscitationNeeded} onChange={(e) => setField('resuscitationNeeded', e.target.checked)} className="rounded" />
                    {tr('إنعاش مطلوب', 'Resuscitation Needed')}
                  </label>
                </div>
              </section>

              {/* Cord */}
              <section>
                <h3 className="font-semibold text-sm mb-3 text-blue-600">{tr('الحبل السري', 'Cord')}</h3>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.cordClamped} onChange={(e) => setField('cordClamped', e.target.checked)} className="rounded" />
                    {tr('تم ربط الحبل السري', 'Cord Clamped')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.cordBloodBanked} onChange={(e) => setField('cordBloodBanked', e.target.checked)} className="rounded" />
                    {tr('بنك دم الحبل', 'Cord Blood Banked')}
                  </label>
                </div>
              </section>

              {/* Prophylaxis */}
              <section>
                <h3 className="font-semibold text-sm mb-3 text-blue-600">{tr('الوقاية', 'Prophylaxis')}</h3>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.vitaminKGiven} onChange={(e) => setField('vitaminKGiven', e.target.checked)} className="rounded" />
                    {tr('فيتامين ك', 'Vitamin K')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.eyeProphylaxis} onChange={(e) => setField('eyeProphylaxis', e.target.checked)} className="rounded" />
                    {tr('وقاية العين', 'Eye Prophylaxis')}
                  </label>
                </div>
              </section>

              {/* Feeding */}
              <section>
                <h3 className="font-semibold text-sm mb-3 text-blue-600">{tr('التغذية', 'Feeding')}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{tr('نوع التغذية', 'Feeding Type')}</Label>
                    <Select value={form.feedingType} onValueChange={(v) => setField('feedingType', v)}>
                      <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BREAST">{tr('رضاعة طبيعية', 'Breast')}</SelectItem>
                        <SelectItem value="FORMULA">{tr('حليب صناعي', 'Formula')}</SelectItem>
                        <SelectItem value="MIXED">{tr('مختلط', 'Mixed')}</SelectItem>
                        <SelectItem value="NPO">{tr('صيام', 'NPO')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm pb-2">
                      <input type="checkbox" checked={form.skinToSkin} onChange={(e) => setField('skinToSkin', e.target.checked)} className="rounded" />
                      {tr('ملامسة جلد لجلد', 'Skin-to-Skin')}
                    </label>
                  </div>
                </div>
              </section>

              {/* Identification */}
              <section>
                <h3 className="font-semibold text-sm mb-3 text-blue-600">{tr('تعريف المولود', 'Identification')}</h3>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.bandApplied} onChange={(e) => setField('bandApplied', e.target.checked)} className="rounded" />
                    {tr('سوار تعريف', 'ID Band Applied')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.footprintsTaken} onChange={(e) => setField('footprintsTaken', e.target.checked)} className="rounded" />
                    {tr('بصمات القدم', 'Footprints Taken')}
                  </label>
                </div>
              </section>

              {/* NICU */}
              <section>
                <h3 className="font-semibold text-sm mb-3 text-blue-600">{tr('العناية المركزة', 'NICU')}</h3>
                <label className="flex items-center gap-2 text-sm mb-3">
                  <input type="checkbox" checked={form.nicuAdmission} onChange={(e) => setField('nicuAdmission', e.target.checked)} className="rounded" />
                  {tr('نقل للعناية المركزة', 'NICU Admission')}
                </label>
                {form.nicuAdmission && (
                  <div>
                    <Label>{tr('سبب النقل', 'Admission Reason')}</Label>
                    <Textarea value={form.nicuAdmissionReason} onChange={(e) => setField('nicuAdmissionReason', e.target.value)} />
                  </div>
                )}
              </section>

              {/* General */}
              <section>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>{tr('الطبيب المعالج', 'Attending Physician')}</Label>
                    <Input value={form.attendingPhysician} onChange={(e) => setField('attendingPhysician', e.target.value)} />
                  </div>
                  <div>
                    <Label>{tr('ملاحظات', 'Notes')}</Label>
                    <Textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
                  </div>
                </div>
              </section>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowCreate(false)}>{tr('إلغاء', 'Cancel')}</Button>
                <Button onClick={handleCreate} disabled={creating || !form.motherPatientId || !form.dateOfBirth}>
                  {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : tr('حفظ', 'Save')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* =========== DETAIL DIALOG =========== */}
        <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                {tr('تفاصيل المولود', 'Newborn Details')}
              </DialogTitle>
            </DialogHeader>

            {!detailRecord ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-5 text-sm">
                {/* Status */}
                <div className="flex items-center gap-2">
                  <Badge className={STATUS_COLORS[detailRecord.status] || ''}>
                    {tr(STATUS_LABELS[detailRecord.status]?.ar || detailRecord.status, STATUS_LABELS[detailRecord.status]?.en || detailRecord.status)}
                  </Badge>
                  {detailRecord.nicuAdmission && <Badge variant="destructive">{tr('عناية مركزة', 'NICU')}</Badge>}
                </div>

                {/* Birth Info */}
                <section>
                  <h4 className="font-semibold text-blue-600 mb-2">{tr('معلومات الولادة', 'Birth Information')}</h4>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                    <DetailRow label={tr('الأم', 'Mother')} value={detailRecord.motherName || detailRecord.motherPatientId?.slice(0, 8)} />
                    <DetailRow label={tr('تاريخ الولادة', 'Date of Birth')} value={formatDate(detailRecord.dateOfBirth)} />
                    <DetailRow label={tr('الجنس', 'Gender')} value={detailRecord.gender ? tr(GENDER_LABELS[detailRecord.gender]?.ar, GENDER_LABELS[detailRecord.gender]?.en) : '--'} />
                    <DetailRow label={tr('نوع الولادة', 'Delivery Type')} value={detailRecord.deliveryType ? tr(DELIVERY_LABELS[detailRecord.deliveryType]?.ar, DELIVERY_LABELS[detailRecord.deliveryType]?.en) : '--'} />
                    <DetailRow label={tr('الوزن (غم)', 'Weight (g)')} value={detailRecord.birthWeight != null ? `${Number(detailRecord.birthWeight).toFixed(0)}` : '--'} />
                    <DetailRow label={tr('الطول (سم)', 'Length (cm)')} value={detailRecord.birthLength != null ? `${Number(detailRecord.birthLength).toFixed(1)}` : '--'} />
                    <DetailRow label={tr('محيط الرأس (سم)', 'Head Circ (cm)')} value={detailRecord.headCircumference != null ? `${Number(detailRecord.headCircumference).toFixed(1)}` : '--'} />
                    <DetailRow label={tr('عمر الحمل', 'Gestational Age')} value={detailRecord.gestationalAge != null ? `${detailRecord.gestationalAge}${detailRecord.gestationalAgeDays ? `+${detailRecord.gestationalAgeDays}` : ''} ${tr('أسابيع', 'weeks')}` : '--'} />
                  </div>
                </section>

                {/* APGAR */}
                <section>
                  <h4 className="font-semibold text-blue-600 mb-2">{tr('درجات أبغار', 'APGAR Scores')}</h4>
                  <div className="flex gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{detailRecord.apgar1Min ?? '--'}</div>
                      <div className="text-xs text-muted-foreground">{tr('1 دقيقة', '1 Min')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{detailRecord.apgar5Min ?? '--'}</div>
                      <div className="text-xs text-muted-foreground">{tr('5 دقائق', '5 Min')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{detailRecord.apgar10Min ?? '--'}</div>
                      <div className="text-xs text-muted-foreground">{tr('10 دقائق', '10 Min')}</div>
                    </div>
                  </div>
                </section>

                {/* Vitals */}
                <section>
                  <h4 className="font-semibold text-blue-600 mb-2">{tr('العلامات الحيوية', 'Vitals at Birth')}</h4>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                    <DetailRow label={tr('معدل القلب', 'Heart Rate')} value={detailRecord.heartRate != null ? `${detailRecord.heartRate} bpm` : '--'} />
                    <DetailRow label={tr('معدل التنفس', 'Resp Rate')} value={detailRecord.respiratoryRate != null ? `${detailRecord.respiratoryRate} /min` : '--'} />
                    <DetailRow label={tr('الحرارة', 'Temperature')} value={detailRecord.temperature != null ? `${Number(detailRecord.temperature).toFixed(1)} C` : '--'} />
                    <DetailRow label={tr('تشبع الأكسجين', 'SpO2')} value={detailRecord.oxygenSaturation != null ? `${detailRecord.oxygenSaturation}%` : '--'} />
                  </div>
                </section>

                {/* Prophylaxis & Feeding */}
                <section>
                  <h4 className="font-semibold text-blue-600 mb-2">{tr('الوقاية والتغذية', 'Prophylaxis & Feeding')}</h4>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                    <DetailRow label={tr('فيتامين ك', 'Vitamin K')} value={detailRecord.vitaminKGiven ? tr('نعم', 'Yes') : tr('لا', 'No')} />
                    <DetailRow label={tr('وقاية العين', 'Eye Prophylaxis')} value={detailRecord.eyeProphylaxis ? tr('نعم', 'Yes') : tr('لا', 'No')} />
                    <DetailRow label={tr('نوع التغذية', 'Feeding Type')} value={detailRecord.feedingType || '--'} />
                    <DetailRow label={tr('ملامسة جلد لجلد', 'Skin-to-Skin')} value={detailRecord.skinToSkin ? tr('نعم', 'Yes') : tr('لا', 'No')} />
                  </div>
                </section>

                {/* NICU */}
                {detailRecord.nicuAdmission && (
                  <section>
                    <h4 className="font-semibold text-red-600 mb-2">{tr('العناية المركزة', 'NICU')}</h4>
                    <DetailRow label={tr('سبب النقل', 'Reason')} value={detailRecord.nicuAdmissionReason || '--'} />
                  </section>
                )}

                {/* Notes */}
                {detailRecord.notes && (
                  <section>
                    <h4 className="font-semibold text-blue-600 mb-2">{tr('ملاحظات', 'Notes')}</h4>
                    <p className="text-muted-foreground whitespace-pre-wrap">{detailRecord.notes}</p>
                  </section>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}</span>
      <p className="font-medium">{value}</p>
    </div>
  );
}
