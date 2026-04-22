'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import {
  FlaskConical,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Bug,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
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
import { Card, CardContent } from '@/components/ui/card';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type CultureStatus = 'ALL' | 'RECEIVED' | 'IN_PROGRESS' | 'PRELIMINARY' | 'FINAL';

interface Organism {
  name: string;
  colonyCount: string;
  identificationMethod: string;
}

interface Sensitivity {
  organismName: string;
  antibiotic: string;
  result: 'S' | 'I' | 'R' | '';
  mic: string;
}

const ANTIBIOTICS = [
  'Amoxicillin', 'Ampicillin', 'Azithromycin', 'Ceftriaxone', 'Cefuroxime',
  'Ciprofloxacin', 'Clindamycin', 'Doxycycline', 'Erythromycin', 'Gentamicin',
  'Imipenem', 'Levofloxacin', 'Meropenem', 'Metronidazole', 'Nitrofurantoin',
  'Penicillin', 'Piperacillin-Tazobactam', 'Trimethoprim-Sulfamethoxazole',
  'Vancomycin', 'Linezolid',
];

export default function LabMicrobiology() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<CultureStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCulture, setSelectedCulture] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Edit state for dialog
  const [gramStain, setGramStain] = useState('');
  const [growthStatus, setGrowthStatus] = useState('');
  const [organisms, setOrganisms] = useState<Organism[]>([]);
  const [sensitivities, setSensitivities] = useState<Sensitivity[]>([]);
  const [interpretation, setInterpretation] = useState('');
  const [clinicalSignificance, setClinicalSignificance] = useState('');
  const [infectionControlAlert, setInfectionControlAlert] = useState(false);
  const [resistanceFlags, setResistanceFlags] = useState<string[]>([]);

  const queryParams = statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
  const { data, mutate } = useSWR(`/api/lab/microbiology${queryParams}`, fetcher, {
    refreshInterval: 15000,
  });

  const cultures = data?.cultures ?? [];
  const summary = data?.summary ?? { pending: 0, inProgress: 0, preliminary: 0, final: 0, finalToday: 0 };

  const filteredCultures = searchQuery
    ? cultures.filter((c: any) =>
        (c.patientName ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.mrn ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.specimenType ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : cultures;

  const openCultureDialog = useCallback((culture: any) => {
    setSelectedCulture(culture);
    setGramStain(culture.gramStain ?? '');
    setGrowthStatus(culture.growthStatus ?? '');
    setOrganisms(culture.organisms?.length ? culture.organisms : []);
    setSensitivities(culture.sensitivities?.length ? culture.sensitivities : []);
    setInterpretation(culture.interpretation ?? '');
    setClinicalSignificance(culture.clinicalSignificance ?? '');
    setInfectionControlAlert(culture.infectionControlAlert ?? false);
    setResistanceFlags(culture.resistanceFlags ?? []);
  }, []);

  const addOrganism = () => {
    setOrganisms([...organisms, { name: '', colonyCount: '', identificationMethod: '' }]);
  };

  const updateOrganism = (index: number, field: keyof Organism, value: string) => {
    const updated = [...organisms];
    updated[index] = { ...updated[index], [field]: value };
    setOrganisms(updated);
  };

  const removeOrganism = (index: number) => {
    setOrganisms(organisms.filter((_, i) => i !== index));
  };

  const addSensitivityRow = (organismName: string, antibiotic: string) => {
    setSensitivities([...sensitivities, { organismName, antibiotic, result: '', mic: '' }]);
  };

  const updateSensitivity = (index: number, field: keyof Sensitivity, value: string) => {
    const updated = [...sensitivities];
    updated[index] = { ...updated[index], [field]: value };
    setSensitivities(updated);
  };

  const toggleResistanceFlag = (flag: string) => {
    setResistanceFlags((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag],
    );
  };

  const getNextStatus = (current: string): string | null => {
    const transitions: Record<string, string> = {
      RECEIVED: 'IN_PROGRESS',
      IN_PROGRESS: 'PRELIMINARY',
      PRELIMINARY: 'FINAL',
    };
    return transitions[current] ?? null;
  };

  const handleSave = async (advanceStatus: boolean = false) => {
    if (!selectedCulture) return;
    setSaving(true);
    try {
      const payload: any = {
        gramStain,
        growthStatus: growthStatus || undefined,
        organisms,
        sensitivities,
        interpretation,
        clinicalSignificance: clinicalSignificance || undefined,
        infectionControlAlert,
        resistanceFlags,
      };

      if (advanceStatus) {
        const next = getNextStatus(selectedCulture.status);
        if (next) payload.status = next;
      }

      const res = await fetch(`/api/lab/microbiology/${selectedCulture.id}`, {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({ title: tr('تم الحفظ بنجاح', 'Saved successfully') });
        mutate();
        if (advanceStatus) {
          const updated = await res.json();
          setSelectedCulture(updated.culture);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: tr('خطأ في الحفظ', 'Save error'), description: err.error, variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  const daysElapsed = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      RECEIVED: { label: tr('مستلم', 'Received'), variant: 'secondary' },
      IN_PROGRESS: { label: tr('قيد العمل', 'In Progress'), variant: 'default' },
      PRELIMINARY: { label: tr('أولي', 'Preliminary'), variant: 'outline' },
      FINAL: { label: tr('نهائي', 'Final'), variant: 'default' },
    };
    const info = map[status] ?? { label: status, variant: 'secondary' as const };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  // Build sensitivity grid for the dialog
  const organismNames = organisms.filter((o) => o.name).map((o) => o.name);

  return (
    <div className="min-h-screen bg-background p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bug className="w-6 h-6 text-purple-600" />
              {tr('سير عمل الأحياء الدقيقة', 'Microbiology Workflow')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {tr('إدارة الزراعات والحساسيات', 'Manage cultures and sensitivities')}
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-yellow-50">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tr('زراعات معلقة', 'Pending Cultures')}</p>
                  <p className="text-2xl font-bold text-foreground">{summary.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-50">
                  <FlaskConical className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tr('قيد العمل', 'In Progress')}</p>
                  <p className="text-2xl font-bold text-foreground">{summary.inProgress}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-50">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tr('أولي', 'Preliminary')}</p>
                  <p className="text-2xl font-bold text-foreground">{summary.preliminary}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-green-50">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tr('نهائي اليوم', 'Final Today')}</p>
                  <p className="text-2xl font-bold text-foreground">{summary.finalToday}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as CultureStatus)} className="flex-1">
            <TabsList>
              <TabsTrigger value="ALL">{tr('الكل', 'All')}</TabsTrigger>
              <TabsTrigger value="RECEIVED">{tr('مستلم', 'Received')}</TabsTrigger>
              <TabsTrigger value="IN_PROGRESS">{tr('قيد العمل', 'In Progress')}</TabsTrigger>
              <TabsTrigger value="PRELIMINARY">{tr('أولي', 'Preliminary')}</TabsTrigger>
              <TabsTrigger value="FINAL">{tr('نهائي', 'Final')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-64">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={tr('بحث بالاسم أو الملف...', 'Search by name or MRN...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-9"
            />
          </div>
        </div>

        {/* Culture List */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground">{tr('المريض', 'Patient')}</th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground">{tr('نوع العينة', 'Specimen Type')}</th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground">{tr('الكائن الحي', 'Organism')}</th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground">{tr('الحالة', 'Status')}</th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground">{tr('الأيام', 'Days')}</th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground">{tr('الأولوية', 'Priority')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCultures.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {tr('لا توجد زراعات', 'No cultures found')}
                    </td>
                  </tr>
                )}
                {filteredCultures.map((culture: any) => {
                  const primaryOrganism = culture.organisms?.[0]?.name;
                  return (
                    <tr
                      key={culture.id}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => openCultureDialog(culture)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{culture.patientName ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">{culture.mrn ?? ''}</div>
                      </td>
                      <td className="px-4 py-3 text-foreground">{culture.specimenType}</td>
                      <td className="px-4 py-3 text-foreground">
                        {primaryOrganism ? (
                          <span className="font-medium italic">{primaryOrganism}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{statusBadge(culture.status)}</td>
                      <td className="px-4 py-3 text-foreground">
                        <span className={daysElapsed(culture.createdAt) >= 3 ? 'text-red-600 font-bold' : ''}>
                          {daysElapsed(culture.createdAt)}{tr('ي', 'd')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {culture.priority === 'STAT' && <Badge variant="destructive">STAT</Badge>}
                        {culture.priority === 'URGENT' && <Badge variant="outline" className="border-orange-400 text-orange-600">URGENT</Badge>}
                        {culture.priority === 'ROUTINE' && <span className="text-muted-foreground text-xs">{tr('روتيني', 'Routine')}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Culture Detail Dialog */}
        <Dialog open={!!selectedCulture} onOpenChange={(open) => { if (!open) setSelectedCulture(null); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bug className="w-5 h-5 text-purple-600" />
                {tr('تفاصيل الزراعة', 'Culture Details')}
                {selectedCulture && (
                  <span className="ms-2">{statusBadge(selectedCulture.status)}</span>
                )}
              </DialogTitle>
            </DialogHeader>

            {selectedCulture && (
              <div className="space-y-6">
                {/* Specimen Info */}
                <div className="bg-muted/30 rounded-xl p-4">
                  <h3 className="font-semibold text-sm mb-3">{tr('معلومات العينة', 'Specimen Information')}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">{tr('النوع', 'Type')}</span>
                      <p className="font-medium">{selectedCulture.specimenType}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{tr('المصدر', 'Source')}</span>
                      <p className="font-medium">{selectedCulture.specimenSource ?? '—'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{tr('وقت الجمع', 'Collection Time')}</span>
                      <p className="font-medium">
                        {selectedCulture.collectionTime
                          ? new Date(selectedCulture.collectionTime).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{tr('المريض', 'Patient')}</span>
                      <p className="font-medium">{selectedCulture.patientName ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{selectedCulture.mrn ?? ''}</p>
                    </div>
                  </div>
                </div>

                {/* Gram Stain */}
                <div>
                  <label className="text-sm font-medium mb-1 block">{tr('نتيجة صبغة غرام', 'Gram Stain Result')}</label>
                  <Input
                    value={gramStain}
                    onChange={(e) => setGramStain(e.target.value)}
                    placeholder={tr('مثال: عصيات سالبة الغرام', 'e.g. Gram-negative bacilli')}
                    disabled={selectedCulture.status === 'FINAL'}
                  />
                </div>

                {/* Growth Status */}
                <div>
                  <label className="text-sm font-medium mb-1 block">{tr('حالة النمو', 'Growth Status')}</label>
                  <Select
                    value={growthStatus}
                    onValueChange={setGrowthStatus}
                    disabled={selectedCulture.status === 'FINAL'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={tr('اختر حالة النمو', 'Select growth status')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NO_GROWTH">{tr('لا نمو', 'No Growth')}</SelectItem>
                      <SelectItem value="GROWTH">{tr('نمو', 'Growth')}</SelectItem>
                      <SelectItem value="CONTAMINATED">{tr('ملوث', 'Contaminated')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Organism Identification */}
                {growthStatus === 'GROWTH' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm">{tr('تحديد الكائنات الحية', 'Organism Identification')}</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addOrganism}
                        disabled={selectedCulture.status === 'FINAL'}
                      >
                        {tr('إضافة كائن حي', 'Add Organism')}
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {organisms.map((org, index) => (
                        <div key={index} className="flex gap-2 items-start">
                          <Input
                            placeholder={tr('اسم الكائن الحي', 'Organism name')}
                            value={org.name}
                            onChange={(e) => updateOrganism(index, 'name', e.target.value)}
                            className="flex-1"
                            disabled={selectedCulture.status === 'FINAL'}
                          />
                          <Input
                            placeholder={tr('عدد المستعمرات', 'Colony count')}
                            value={org.colonyCount}
                            onChange={(e) => updateOrganism(index, 'colonyCount', e.target.value)}
                            className="w-32"
                            disabled={selectedCulture.status === 'FINAL'}
                          />
                          <Select
                            value={org.identificationMethod}
                            onValueChange={(v) => updateOrganism(index, 'identificationMethod', v)}
                            disabled={selectedCulture.status === 'FINAL'}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder={tr('الطريقة', 'Method')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="VITEK">{tr('فايتك', 'VITEK')}</SelectItem>
                              <SelectItem value="MALDI-TOF">MALDI-TOF</SelectItem>
                              <SelectItem value="BIOCHEMICAL">{tr('كيميائي حيوي', 'Biochemical')}</SelectItem>
                              <SelectItem value="MOLECULAR">{tr('جزيئي', 'Molecular')}</SelectItem>
                              <SelectItem value="MANUAL">{tr('يدوي', 'Manual')}</SelectItem>
                            </SelectContent>
                          </Select>
                          {selectedCulture.status !== 'FINAL' && (
                            <Button variant="ghost" size="sm" onClick={() => removeOrganism(index)} className="text-red-500">
                              &times;
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sensitivity Table */}
                {growthStatus === 'GROWTH' && organismNames.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm">{tr('جدول الحساسية', 'Sensitivity Table')}</h3>
                      <Select
                        onValueChange={(abx) => {
                          organismNames.forEach((orgName) => {
                            const exists = sensitivities.some(
                              (s) => s.organismName === orgName && s.antibiotic === abx,
                            );
                            if (!exists) addSensitivityRow(orgName, abx);
                          });
                        }}
                        disabled={selectedCulture.status === 'FINAL'}
                      >
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder={tr('إضافة مضاد حيوي', 'Add Antibiotic')} />
                        </SelectTrigger>
                        <SelectContent>
                          {ANTIBIOTICS.map((abx) => (
                            <SelectItem key={abx} value={abx}>{abx}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {sensitivities.length > 0 && (
                      <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-3 py-2 text-start text-xs font-medium text-muted-foreground">{tr('الكائن الحي', 'Organism')}</th>
                              <th className="px-3 py-2 text-start text-xs font-medium text-muted-foreground">{tr('المضاد الحيوي', 'Antibiotic')}</th>
                              <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">S/I/R</th>
                              <th className="px-3 py-2 text-start text-xs font-medium text-muted-foreground">MIC</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {sensitivities.map((s, i) => (
                              <tr key={i}>
                                <td className="px-3 py-2 italic">{s.organismName}</td>
                                <td className="px-3 py-2">{s.antibiotic}</td>
                                <td className="px-3 py-2 text-center">
                                  <div className="flex gap-1 justify-center">
                                    {(['S', 'I', 'R'] as const).map((val) => (
                                      <button
                                        key={val}
                                        type="button"
                                        onClick={() => updateSensitivity(i, 'result', val)}
                                        disabled={selectedCulture.status === 'FINAL'}
                                        className={`w-8 h-8 rounded text-xs font-bold border transition-colors ${
                                          s.result === val
                                            ? val === 'S'
                                              ? 'bg-green-100 border-green-500 text-green-700'
                                              : val === 'I'
                                              ? 'bg-yellow-100 border-yellow-500 text-yellow-700'
                                              : 'bg-red-100 border-red-500 text-red-700'
                                            : 'bg-background border-border text-muted-foreground hover:bg-muted'
                                        }`}
                                      >
                                        {val}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    value={s.mic}
                                    onChange={(e) => updateSensitivity(i, 'mic', e.target.value)}
                                    placeholder="MIC"
                                    className="w-20 h-8 text-xs"
                                    disabled={selectedCulture.status === 'FINAL'}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Resistance Detection Flags */}
                <div>
                  <h3 className="font-semibold text-sm mb-2">{tr('كشف المقاومة', 'Resistance Detection')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {['ESBL', 'MRSA', 'VRE', 'CPR', 'MDR', 'XDR', 'PDR'].map((flag) => (
                      <label key={flag} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={resistanceFlags.includes(flag)}
                          onChange={() => toggleResistanceFlag(flag)}
                          disabled={selectedCulture.status === 'FINAL'}
                          className="rounded border-border"
                        />
                        <span className="text-sm font-medium">{flag}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Interpretation */}
                <div>
                  <label className="text-sm font-medium mb-1 block">{tr('التفسير', 'Interpretation')}</label>
                  <Textarea
                    value={interpretation}
                    onChange={(e) => setInterpretation(e.target.value)}
                    placeholder={tr('أدخل التفسير السريري...', 'Enter clinical interpretation...')}
                    rows={3}
                    disabled={selectedCulture.status === 'FINAL'}
                  />
                </div>

                {/* Clinical Significance */}
                <div>
                  <label className="text-sm font-medium mb-1 block">{tr('الأهمية السريرية', 'Clinical Significance')}</label>
                  <Select
                    value={clinicalSignificance}
                    onValueChange={setClinicalSignificance}
                    disabled={selectedCulture.status === 'FINAL'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={tr('اختر الأهمية السريرية', 'Select clinical significance')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PATHOGEN">{tr('ممرض', 'Pathogen')}</SelectItem>
                      <SelectItem value="COLONIZER">{tr('مستعمر', 'Colonizer')}</SelectItem>
                      <SelectItem value="CONTAMINANT">{tr('ملوث', 'Contaminant')}</SelectItem>
                      <SelectItem value="NORMAL_FLORA">{tr('فلورا طبيعية', 'Normal Flora')}</SelectItem>
                      <SelectItem value="UNDETERMINED">{tr('غير محدد', 'Undetermined')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Infection Control Alert */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={infectionControlAlert}
                    onChange={(e) => setInfectionControlAlert(e.target.checked)}
                    disabled={selectedCulture.status === 'FINAL'}
                    className="rounded border-border"
                    id="infection-control"
                  />
                  <label htmlFor="infection-control" className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                    {tr('تنبيه مكافحة العدوى', 'Infection Control Alert')}
                  </label>
                </div>

                {/* Action Buttons */}
                {selectedCulture.status !== 'FINAL' && (
                  <div className="flex gap-3 pt-2 border-t">
                    <Button onClick={() => handleSave(false)} disabled={saving} variant="outline" className="flex-1">
                      {saving && <Loader2 className="w-4 h-4 animate-spin me-2" />}
                      {tr('حفظ', 'Save')}
                    </Button>
                    {getNextStatus(selectedCulture.status) && (
                      <Button onClick={() => handleSave(true)} disabled={saving} className="flex-1">
                        {saving && <Loader2 className="w-4 h-4 animate-spin me-2" />}
                        {tr('حفظ وتقديم إلى', 'Save & Advance to')}{' '}
                        {getNextStatus(selectedCulture.status) === 'IN_PROGRESS'
                          ? tr('قيد العمل', 'In Progress')
                          : getNextStatus(selectedCulture.status) === 'PRELIMINARY'
                          ? tr('أولي', 'Preliminary')
                          : tr('نهائي', 'Final')}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
