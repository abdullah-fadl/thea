'use client';

import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import useSWR, { mutate as globalMutate } from 'swr';
import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FlaskConical,
  Plus,
  Trash2,
  BookOpen,
  Beaker,
  Calculator,
  Printer,
  Eye,
  Copy,
  Archive,
  Search,
  Pill,
  Droplets,
  ShieldAlert,
  Heart,
  FileText,
} from 'lucide-react';
import {
  STANDARD_PROTOCOLS,
  CANCER_TYPES,
  EMETOGENIC_RISKS,
  INTENTS,
  DRUG_ROUTES,
  calculateBSA,
  calculateDose,
  type StandardProtocol,
  type ProtocolDrug,
  type ProtocolPremedication,
  type ProtocolHydration,
  type ProtocolDoseModification,
  type ProtocolSupportiveCare,
} from '@/lib/oncology/protocolLibrary';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface CustomTemplate {
  id: string;
  tenantId: string;
  name: string;
  cancerType: string;
  intent: string;
  emetogenicRisk: string | null;
  totalCyclesDefault: number | null;
  cycleLengthDays: number | null;
  drugs: DrugEntry[];
  premedications: PremedicationEntry[] | null;
  hydration: HydrationEntry[] | null;
  doseModifications: DoseModEntry[] | null;
  supportiveCare: SupportiveCareEntry[] | null;
  references: ReferenceEntry[] | null;
  isGlobal: boolean;
  status: string;
  createdBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DrugEntry {
  name: string;
  nameAr?: string;
  dose: number;
  unit: string;
  route: string;
  days: number[];
  infusionTimeMin: number | null;
}

interface PremedicationEntry {
  name: string;
  nameAr?: string;
  dose: string;
  route: string;
  timing: string;
  timingAr?: string;
}

interface HydrationEntry {
  fluid: string;
  fluidAr?: string;
  volume: string;
  rate: string;
  timing: string;
  timingAr?: string;
}

interface DoseModEntry {
  condition: string;
  conditionAr?: string;
  adjustment: string;
  adjustmentAr?: string;
  notes?: string;
  notesAr?: string;
}

interface SupportiveCareEntry {
  medication: string;
  medicationAr?: string;
  indication: string;
  indicationAr?: string;
}

interface ReferenceEntry {
  title: string;
  url?: string;
  year?: number;
}

// ---------------------------------------------------------------------------
// Empty row factories
// ---------------------------------------------------------------------------

function emptyDrug(): DrugEntry {
  return { name: '', dose: 0, unit: 'mg/m2', route: 'IV', days: [1], infusionTimeMin: null };
}

function emptyPremedication(): PremedicationEntry {
  return { name: '', dose: '', route: 'IV', timing: '' };
}

function emptyHydration(): HydrationEntry {
  return { fluid: '', volume: '', rate: '', timing: '' };
}

function emptyDoseMod(): DoseModEntry {
  return { condition: '', adjustment: '' };
}

function emptySupportiveCare(): SupportiveCareEntry {
  return { medication: '', indication: '' };
}

function emptyReference(): ReferenceEntry {
  return { title: '' };
}

// ---------------------------------------------------------------------------
// Emetogenic Risk Badge
// ---------------------------------------------------------------------------

function EmetogenicBadge({
  risk,
  language,
}: {
  risk: string | null | undefined;
  language: string;
}) {
  const found = EMETOGENIC_RISKS.find((r) => r.value === risk);
  if (!found) return null;
  const label = language === 'ar' ? found.labelAr : found.labelEn;
  return <Badge className={`${found.color} text-xs`}>{label}</Badge>;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function ProtocolBuilder() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('library');

  return (
    <div className="p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <FlaskConical className="h-7 w-7 text-purple-600" />
        <h1 className="text-2xl font-bold text-foreground">
          {tr('بناء بروتوكولات العلاج الكيميائي', 'Chemo Protocol Template Builder')}
        </h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="library" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {tr('مكتبة البروتوكولات', 'Protocol Library')}
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <Beaker className="h-4 w-4" />
            {tr('البروتوكولات المخصصة', 'Custom Protocols')}
          </TabsTrigger>
          <TabsTrigger value="calculator" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            {tr('حاسبة الجرعات', 'Dose Calculator')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library">
          <ProtocolLibraryTab language={language} tr={tr} toast={toast} onSwitchToCustom={() => setActiveTab('custom')} />
        </TabsContent>

        <TabsContent value="custom">
          <CustomProtocolsTab language={language} tr={tr} toast={toast} />
        </TabsContent>

        <TabsContent value="calculator">
          <DoseCalculatorTab language={language} tr={tr} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1: PROTOCOL LIBRARY
// ═══════════════════════════════════════════════════════════════════════════

function ProtocolLibraryTab({
  language,
  tr,
  toast,
  onSwitchToCustom,
}: {
  language: string;
  tr: (ar: string, en: string) => string;
  toast: ReturnType<typeof useToast>['toast'];
  onSwitchToCustom: () => void;
}) {
  const [filterCancer, setFilterCancer] = useState('ALL');
  const [searchText, setSearchText] = useState('');
  const [selectedProtocol, setSelectedProtocol] = useState<StandardProtocol | null>(null);

  const filtered = useMemo(() => {
    let list = STANDARD_PROTOCOLS;
    if (filterCancer !== 'ALL') {
      list = list.filter((p) => p.cancerType === filterCancer);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.nameAr.includes(searchText) ||
          p.cancerType.toLowerCase().includes(q),
      );
    }
    return list;
  }, [filterCancer, searchText]);

  const handleUseAsTemplate = useCallback(
    async (protocol: StandardProtocol) => {
      try {
        const res = await fetch('/api/oncology/protocol-templates', {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: protocol.name,
            cancerType: protocol.cancerType,
            intent: protocol.intent,
            emetogenicRisk: protocol.emetogenicRisk,
            totalCyclesDefault: protocol.totalCyclesDefault,
            cycleLengthDays: protocol.cycleLengthDays,
            drugs: protocol.drugs,
            premedications: protocol.premedications,
            hydration: protocol.hydration,
            doseModifications: protocol.doseModifications,
            supportiveCare: protocol.supportiveCare,
            references: protocol.references,
            notes: `${tr('مستنسخ من', 'Cloned from')} ${protocol.name}`,
          }),
        });
        if (!res.ok) throw new Error('Failed');
        toast({ title: tr('تم النسخ بنجاح', 'Template cloned successfully') });
        globalMutate('/api/oncology/protocol-templates');
        onSwitchToCustom();
      } catch {
        toast({ title: tr('خطأ في النسخ', 'Failed to clone template'), variant: 'destructive' });
      }
    },
    [tr, toast, onSwitchToCustom],
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 h-4 w-4 text-muted-foreground ltr:left-3 rtl:right-3" />
          <Input
            placeholder={tr('بحث عن بروتوكول...', 'Search protocols...')}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="ltr:pl-9 rtl:pr-9"
          />
        </div>
        <Select value={filterCancer} onValueChange={setFilterCancer}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={tr('نوع السرطان', 'Cancer Type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('جميع الأنواع', 'All Types')}</SelectItem>
            {CANCER_TYPES.map((ct) => (
              <SelectItem key={ct.value} value={ct.value}>
                {language === 'ar' ? ct.labelAr : ct.labelEn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Protocol Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((protocol) => {
          const cancerLabel = CANCER_TYPES.find((c) => c.value === protocol.cancerType);
          const intentLabel = INTENTS.find((i) => i.value === protocol.intent);
          return (
            <Card
              key={protocol.id}
              className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base font-semibold">
                    {language === 'ar' ? protocol.nameAr : protocol.name}
                  </CardTitle>
                  <EmetogenicBadge risk={protocol.emetogenicRisk} language={language} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {cancerLabel
                    ? language === 'ar'
                      ? cancerLabel.labelAr
                      : cancerLabel.labelEn
                    : protocol.cancerType}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">
                    {intentLabel
                      ? language === 'ar'
                        ? intentLabel.labelAr
                        : intentLabel.labelEn
                      : protocol.intent}
                  </Badge>
                  <Badge variant="secondary">
                    {protocol.cycleLengthDays} {tr('يوم/دورة', 'days/cycle')}
                  </Badge>
                  <Badge variant="secondary">
                    {protocol.totalCyclesDefault} {tr('دورة', 'cycles')}
                  </Badge>
                  <Badge variant="secondary">
                    {protocol.drugs.length} {tr('أدوية', 'drugs')}
                  </Badge>
                </div>

                {/* Drug names preview */}
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {protocol.drugs
                    .map((d) => (language === 'ar' ? d.nameAr : d.name))
                    .join(', ')}
                </p>

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setSelectedProtocol(protocol)}
                  >
                    <Eye className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                    {tr('عرض', 'View')}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleUseAsTemplate(protocol)}
                  >
                    <Copy className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                    {tr('استخدام كقالب', 'Use as Template')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {tr('لا توجد بروتوكولات تطابق البحث', 'No protocols match your search')}
        </div>
      )}

      {/* Protocol Detail Dialog */}
      <ProtocolDetailDialog
        protocol={selectedProtocol}
        language={language}
        tr={tr}
        onClose={() => setSelectedProtocol(null)}
        onUseAsTemplate={() => {
          if (selectedProtocol) handleUseAsTemplate(selectedProtocol);
          setSelectedProtocol(null);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Protocol Detail Dialog
// ---------------------------------------------------------------------------

function ProtocolDetailDialog({
  protocol,
  language,
  tr,
  onClose,
  onUseAsTemplate,
}: {
  protocol: StandardProtocol | null;
  language: string;
  tr: (ar: string, en: string) => string;
  onClose: () => void;
  onUseAsTemplate: () => void;
}) {
  if (!protocol) return null;

  const cancerLabel = CANCER_TYPES.find((c) => c.value === protocol.cancerType);
  const intentLabel = INTENTS.find((i) => i.value === protocol.intent);

  return (
    <Dialog open={!!protocol} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-purple-600" />
            {language === 'ar' ? protocol.nameAr : protocol.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Overview badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {cancerLabel
                ? language === 'ar'
                  ? cancerLabel.labelAr
                  : cancerLabel.labelEn
                : protocol.cancerType}
            </Badge>
            <Badge variant="outline">
              {intentLabel
                ? language === 'ar'
                  ? intentLabel.labelAr
                  : intentLabel.labelEn
                : protocol.intent}
            </Badge>
            <EmetogenicBadge risk={protocol.emetogenicRisk} language={language} />
            <Badge variant="secondary">
              {protocol.cycleLengthDays} {tr('يوم/دورة', 'days/cycle')}
            </Badge>
            <Badge variant="secondary">
              {protocol.totalCyclesDefault} {tr('دورة', 'cycles')}
            </Badge>
          </div>

          {/* Drugs Section */}
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Pill className="h-4 w-4" />
              {tr('الأدوية', 'Drugs')}
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('الدواء', 'Drug')}</TableHead>
                  <TableHead>{tr('الجرعة', 'Dose')}</TableHead>
                  <TableHead>{tr('الطريق', 'Route')}</TableHead>
                  <TableHead>{tr('الأيام', 'Days')}</TableHead>
                  <TableHead>{tr('مدة التسريب', 'Infusion Time')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {protocol.drugs.map((drug, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">
                      {language === 'ar' ? drug.nameAr : drug.name}
                    </TableCell>
                    <TableCell>
                      {drug.dose} {drug.unit}
                    </TableCell>
                    <TableCell>{drug.route}</TableCell>
                    <TableCell>{drug.days.join(', ')}</TableCell>
                    <TableCell>
                      {drug.infusionTimeMin != null
                        ? drug.infusionTimeMin >= 60
                          ? `${Math.floor(drug.infusionTimeMin / 60)}${tr('س', 'h')} ${drug.infusionTimeMin % 60 > 0 ? `${drug.infusionTimeMin % 60}${tr('د', 'm')}` : ''}`
                          : `${drug.infusionTimeMin} ${tr('دقيقة', 'min')}`
                        : tr('فموي/بولس', 'PO/Bolus')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Premedications */}
          {protocol.premedications.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                {tr('الأدوية المسبقة', 'Premedications')}
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr('الدواء', 'Medication')}</TableHead>
                    <TableHead>{tr('الجرعة', 'Dose')}</TableHead>
                    <TableHead>{tr('الطريق', 'Route')}</TableHead>
                    <TableHead>{tr('التوقيت', 'Timing')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {protocol.premedications.map((pm, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{language === 'ar' ? pm.nameAr : pm.name}</TableCell>
                      <TableCell>{pm.dose}</TableCell>
                      <TableCell>{pm.route}</TableCell>
                      <TableCell>{language === 'ar' ? pm.timingAr : pm.timing}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Hydration */}
          {protocol.hydration.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Droplets className="h-4 w-4" />
                {tr('الترطيب', 'Hydration')}
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr('السائل', 'Fluid')}</TableHead>
                    <TableHead>{tr('الحجم', 'Volume')}</TableHead>
                    <TableHead>{tr('المعدل', 'Rate')}</TableHead>
                    <TableHead>{tr('التوقيت', 'Timing')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {protocol.hydration.map((h, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{language === 'ar' ? h.fluidAr : h.fluid}</TableCell>
                      <TableCell>{h.volume}</TableCell>
                      <TableCell>{h.rate}</TableCell>
                      <TableCell>{language === 'ar' ? h.timingAr : h.timing}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Dose Modifications */}
          {protocol.doseModifications.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-orange-600" />
                {tr('تعديلات الجرعة', 'Dose Modifications')}
              </h3>
              <div className="space-y-2">
                {protocol.doseModifications.map((dm, idx) => (
                  <div key={idx} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-sm font-medium text-orange-900">
                      {language === 'ar' ? dm.conditionAr : dm.condition}
                    </p>
                    <p className="text-sm text-orange-700 mt-1">
                      {language === 'ar' ? dm.adjustmentAr : dm.adjustment}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Supportive Care */}
          {protocol.supportiveCare.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Heart className="h-4 w-4 text-pink-600" />
                {tr('الرعاية الداعمة', 'Supportive Care')}
              </h3>
              <div className="space-y-1">
                {protocol.supportiveCare.map((sc, idx) => (
                  <div key={idx} className="flex gap-2 text-sm">
                    <span className="font-medium">
                      {language === 'ar' ? sc.medicationAr : sc.medication}:
                    </span>
                    <span className="text-muted-foreground">
                      {language === 'ar' ? sc.indicationAr : sc.indication}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* References */}
          {protocol.references.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {tr('المراجع', 'References')}
              </h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {protocol.references.map((ref, idx) => (
                  <li key={idx}>{ref.title}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Action button */}
          <div className="flex justify-end pt-2">
            <Button onClick={onUseAsTemplate}>
              <Copy className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {tr('استخدام كقالب مخصص', 'Use as Custom Template')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2: CUSTOM PROTOCOLS
// ═══════════════════════════════════════════════════════════════════════════

function CustomProtocolsTab({
  language,
  tr,
  toast,
}: {
  language: string;
  tr: (ar: string, en: string) => string;
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const { data, isLoading } = useSWR('/api/oncology/protocol-templates', fetcher);
  const templates: CustomTemplate[] = data?.templates ?? [];

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editTemplate, setEditTemplate] = useState<CustomTemplate | null>(null);

  const handleArchive = useCallback(
    async (id: string) => {
      try {
        const res = await fetch('/api/oncology/protocol-templates', {
          credentials: 'include',
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: 'ARCHIVED' }),
        });
        if (!res.ok) throw new Error('Failed');
        toast({ title: tr('تم الأرشفة', 'Template archived') });
        globalMutate('/api/oncology/protocol-templates');
      } catch {
        toast({ title: tr('خطأ', 'Failed to archive'), variant: 'destructive' });
      }
    },
    [tr, toast],
  );

  const handleReactivate = useCallback(
    async (id: string) => {
      try {
        const res = await fetch('/api/oncology/protocol-templates', {
          credentials: 'include',
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: 'ACTIVE' }),
        });
        if (!res.ok) throw new Error('Failed');
        toast({ title: tr('تم التفعيل', 'Template reactivated') });
        globalMutate('/api/oncology/protocol-templates');
      } catch {
        toast({ title: tr('خطأ', 'Failed'), variant: 'destructive' });
      }
    },
    [tr, toast],
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {tr(
            'أنشئ وأدر بروتوكولات العلاج الكيميائي الخاصة بمنشأتك',
            'Create and manage your facility-specific chemo protocols',
          )}
        </p>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {tr('بروتوكول جديد', 'New Protocol')}
        </Button>
      </div>

      {/* Templates table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          {tr('جاري التحميل...', 'Loading...')}
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">
              {tr('لا توجد بروتوكولات مخصصة بعد', 'No custom protocols yet')}
            </p>
            <p className="text-sm mt-1">
              {tr(
                'أنشئ بروتوكولًا جديدًا أو انسخ واحدًا من المكتبة',
                'Create a new one or clone from the library',
              )}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr('اسم البروتوكول', 'Protocol Name')}</TableHead>
                <TableHead>{tr('نوع السرطان', 'Cancer Type')}</TableHead>
                <TableHead>{tr('الهدف', 'Intent')}</TableHead>
                <TableHead>{tr('خطر القيء', 'Emetogenic Risk')}</TableHead>
                <TableHead>{tr('الدورات', 'Cycles')}</TableHead>
                <TableHead>{tr('الأدوية', 'Drugs')}</TableHead>
                <TableHead>{tr('الحالة', 'Status')}</TableHead>
                <TableHead>{tr('الإجراءات', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => {
                const cancerLabel = CANCER_TYPES.find((c) => c.value === t.cancerType);
                const intentLabel = INTENTS.find((i) => i.value === t.intent);
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      {cancerLabel
                        ? language === 'ar'
                          ? cancerLabel.labelAr
                          : cancerLabel.labelEn
                        : t.cancerType}
                    </TableCell>
                    <TableCell>
                      {intentLabel
                        ? language === 'ar'
                          ? intentLabel.labelAr
                          : intentLabel.labelEn
                        : t.intent}
                    </TableCell>
                    <TableCell>
                      <EmetogenicBadge risk={t.emetogenicRisk} language={language} />
                    </TableCell>
                    <TableCell>
                      {t.totalCyclesDefault ?? '-'} x {t.cycleLengthDays ?? '-'} {tr('يوم', 'd')}
                    </TableCell>
                    <TableCell>{t.drugs?.length ?? 0}</TableCell>
                    <TableCell>
                      <Badge
                        variant={t.status === 'ACTIVE' ? 'default' : 'secondary'}
                        className={
                          t.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-muted text-muted-foreground'
                        }
                      >
                        {t.status === 'ACTIVE' ? tr('نشط', 'Active') : tr('مؤرشف', 'Archived')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!t.isGlobal && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditTemplate(t)}
                          >
                            {tr('تعديل', 'Edit')}
                          </Button>
                        )}
                        {!t.isGlobal && t.status === 'ACTIVE' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-orange-600"
                            onClick={() => handleArchive(t.id)}
                          >
                            <Archive className="h-3 w-3" />
                          </Button>
                        )}
                        {!t.isGlobal && t.status === 'ARCHIVED' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-600"
                            onClick={() => handleReactivate(t.id)}
                          >
                            {tr('تفعيل', 'Activate')}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Dialog */}
      {showCreateDialog && (
        <ProtocolFormDialog
          language={language}
          tr={tr}
          toast={toast}
          onClose={() => setShowCreateDialog(false)}
          mode="create"
        />
      )}

      {/* Edit Dialog */}
      {editTemplate && (
        <ProtocolFormDialog
          language={language}
          tr={tr}
          toast={toast}
          onClose={() => setEditTemplate(null)}
          mode="edit"
          initial={editTemplate}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Protocol Form Dialog (Create / Edit)
// ---------------------------------------------------------------------------

function ProtocolFormDialog({
  language,
  tr,
  toast,
  onClose,
  mode,
  initial,
}: {
  language: string;
  tr: (ar: string, en: string) => string;
  toast: ReturnType<typeof useToast>['toast'];
  onClose: () => void;
  mode: 'create' | 'edit';
  initial?: CustomTemplate;
}) {
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState(initial?.name ?? '');
  const [cancerType, setCancerType] = useState(initial?.cancerType ?? 'COLORECTAL');
  const [intent, setIntent] = useState(initial?.intent ?? 'CURATIVE');
  const [emetogenicRisk, setEmetogenicRisk] = useState(initial?.emetogenicRisk ?? 'MODERATE');
  const [cycleLengthDays, setCycleLengthDays] = useState<string>(String(initial?.cycleLengthDays ?? '21'));
  const [totalCyclesDefault, setTotalCyclesDefault] = useState<string>(String(initial?.totalCyclesDefault ?? '6'));
  const [notes, setNotes] = useState(initial?.notes ?? '');

  // Complex sub-arrays
  const [drugs, setDrugs] = useState<DrugEntry[]>(
    initial?.drugs?.length ? initial.drugs : [emptyDrug()],
  );
  const [premedications, setPremedications] = useState<PremedicationEntry[]>(
    initial?.premedications?.length ? initial.premedications : [],
  );
  const [hydration, setHydration] = useState<HydrationEntry[]>(
    initial?.hydration?.length ? initial.hydration : [],
  );
  const [doseMods, setDoseMods] = useState<DoseModEntry[]>(
    initial?.doseModifications?.length ? initial.doseModifications : [],
  );
  const [supportiveCare, setSupportiveCare] = useState<SupportiveCareEntry[]>(
    initial?.supportiveCare?.length ? initial.supportiveCare : [],
  );
  const [references, setReferences] = useState<ReferenceEntry[]>(
    initial?.references?.length ? initial.references : [],
  );

  // Sub-form section state
  const [activeSection, setActiveSection] = useState<string>('drugs');

  // Drug helpers
  const updateDrug = (idx: number, field: keyof DrugEntry, value: unknown) => {
    setDrugs((prev) => prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)));
  };
  const removeDrug = (idx: number) => setDrugs((prev) => prev.filter((_, i) => i !== idx));

  // Premedication helpers
  const updatePremed = (idx: number, field: keyof PremedicationEntry, value: unknown) => {
    setPremedications((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };
  const removePremed = (idx: number) => setPremedications((prev) => prev.filter((_, i) => i !== idx));

  // Hydration helpers
  const updateHydration = (idx: number, field: keyof HydrationEntry, value: unknown) => {
    setHydration((prev) => prev.map((h, i) => (i === idx ? { ...h, [field]: value } : h)));
  };
  const removeHydration = (idx: number) => setHydration((prev) => prev.filter((_, i) => i !== idx));

  // Dose modification helpers
  const updateDoseMod = (idx: number, field: keyof DoseModEntry, value: unknown) => {
    setDoseMods((prev) => prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)));
  };
  const removeDoseMod = (idx: number) => setDoseMods((prev) => prev.filter((_, i) => i !== idx));

  // Supportive care helpers
  const updateSC = (idx: number, field: keyof SupportiveCareEntry, value: unknown) => {
    setSupportiveCare((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };
  const removeSC = (idx: number) => setSupportiveCare((prev) => prev.filter((_, i) => i !== idx));

  // Reference helpers
  const updateRef = (idx: number, field: keyof ReferenceEntry, value: unknown) => {
    setReferences((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };
  const removeRef = (idx: number) => setReferences((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: tr('اسم البروتوكول مطلوب', 'Protocol name is required'), variant: 'destructive' });
      return;
    }
    if (drugs.length === 0 || !drugs[0].name) {
      toast({ title: tr('يجب إضافة دواء واحد على الأقل', 'At least one drug is required'), variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name,
        cancerType,
        intent,
        emetogenicRisk,
        cycleLengthDays: cycleLengthDays ? Number(cycleLengthDays) : null,
        totalCyclesDefault: totalCyclesDefault ? Number(totalCyclesDefault) : null,
        drugs: drugs.filter((d) => d.name),
        premedications: premedications.filter((p) => p.name),
        hydration: hydration.filter((h) => h.fluid),
        doseModifications: doseMods.filter((d) => d.condition),
        supportiveCare: supportiveCare.filter((s) => s.medication),
        references: references.filter((r) => r.title),
        notes: notes || null,
      };

      if (mode === 'edit' && initial) {
        payload.id = initial.id;
      }

      const res = await fetch('/api/oncology/protocol-templates', {
        credentials: 'include',
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      toast({
        title: mode === 'create'
          ? tr('تم إنشاء البروتوكول', 'Protocol created')
          : tr('تم تحديث البروتوكول', 'Protocol updated'),
      });
      globalMutate('/api/oncology/protocol-templates');
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? tr('إنشاء بروتوكول جديد', 'Create New Protocol')
              : tr('تعديل البروتوكول', 'Edit Protocol')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* ── Basic Info ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>{tr('اسم البروتوكول', 'Protocol Name')} *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. FOLFOX, R-CHOP" />
            </div>
            <div className="space-y-1">
              <Label>{tr('نوع السرطان', 'Cancer Type')} *</Label>
              <Select value={cancerType} onValueChange={setCancerType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CANCER_TYPES.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value}>
                      {language === 'ar' ? ct.labelAr : ct.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{tr('هدف العلاج', 'Treatment Intent')}</Label>
              <Select value={intent} onValueChange={setIntent}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTENTS.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {language === 'ar' ? i.labelAr : i.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{tr('خطر القيء', 'Emetogenic Risk')}</Label>
              <Select value={emetogenicRisk} onValueChange={setEmetogenicRisk}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EMETOGENIC_RISKS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {language === 'ar' ? r.labelAr : r.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{tr('طول الدورة (أيام)', 'Cycle Length (days)')}</Label>
              <Input type="number" value={cycleLengthDays} onChange={(e) => setCycleLengthDays(e.target.value)} min={1} />
            </div>
            <div className="space-y-1">
              <Label>{tr('عدد الدورات', 'Total Cycles')}</Label>
              <Input type="number" value={totalCyclesDefault} onChange={(e) => setTotalCyclesDefault(e.target.value)} min={1} />
            </div>
          </div>

          {/* ── Section Nav ───────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2 border-b pb-2">
            {[
              { key: 'drugs', label: tr('الأدوية', 'Drugs'), icon: Pill, count: drugs.length },
              { key: 'premeds', label: tr('أدوية مسبقة', 'Premedications'), icon: ShieldAlert, count: premedications.length },
              { key: 'hydration', label: tr('ترطيب', 'Hydration'), icon: Droplets, count: hydration.length },
              { key: 'dosemods', label: tr('تعديل الجرعة', 'Dose Modifications'), icon: ShieldAlert, count: doseMods.length },
              { key: 'supportive', label: tr('رعاية داعمة', 'Supportive Care'), icon: Heart, count: supportiveCare.length },
              { key: 'refs', label: tr('مراجع', 'References'), icon: FileText, count: references.length },
            ].map((sec) => (
              <Button
                key={sec.key}
                size="sm"
                variant={activeSection === sec.key ? 'default' : 'outline'}
                onClick={() => setActiveSection(sec.key)}
                className="flex items-center gap-1"
              >
                <sec.icon className="h-3 w-3" />
                {sec.label}
                {sec.count > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 text-xs">
                    {sec.count}
                  </Badge>
                )}
              </Button>
            ))}
          </div>

          {/* ── Drugs Section ─────────────────────────────────────────── */}
          {activeSection === 'drugs' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">{tr('الأدوية', 'Drugs')} *</h4>
                <Button size="sm" variant="outline" onClick={() => setDrugs((prev) => [...prev, emptyDrug()])}>
                  <Plus className="h-3 w-3 ltr:mr-1 rtl:ml-1" /> {tr('إضافة دواء', 'Add Drug')}
                </Button>
              </div>
              {drugs.map((drug, idx) => (
                <Card key={idx} className="p-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">{tr('اسم الدواء', 'Drug Name')}</Label>
                      <Input value={drug.name} onChange={(e) => updateDrug(idx, 'name', e.target.value)} placeholder="e.g. Oxaliplatin" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('الجرعة', 'Dose')}</Label>
                      <Input type="number" value={drug.dose || ''} onChange={(e) => updateDrug(idx, 'dose', Number(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('الوحدة', 'Unit')}</Label>
                      <Select value={drug.unit} onValueChange={(v) => updateDrug(idx, 'unit', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mg/m2">mg/m2</SelectItem>
                          <SelectItem value="mg/kg">mg/kg</SelectItem>
                          <SelectItem value="mg">mg (flat)</SelectItem>
                          <SelectItem value="AUC">AUC</SelectItem>
                          <SelectItem value="units/m2">units/m2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('طريق الإعطاء', 'Route')}</Label>
                      <Select value={drug.route} onValueChange={(v) => updateDrug(idx, 'route', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DRUG_ROUTES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {language === 'ar' ? r.labelAr : r.labelEn}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('الأيام', 'Days')}</Label>
                      <Input
                        value={drug.days.join(',')}
                        onChange={(e) => {
                          const days = e.target.value
                            .split(',')
                            .map((s) => parseInt(s.trim(), 10))
                            .filter((n) => !isNaN(n) && n > 0);
                          updateDrug(idx, 'days', days.length > 0 ? days : [1]);
                        }}
                        placeholder="1,8,15"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('مدة التسريب (دقيقة)', 'Infusion (min)')}</Label>
                      <Input
                        type="number"
                        value={drug.infusionTimeMin ?? ''}
                        onChange={(e) => updateDrug(idx, 'infusionTimeMin', e.target.value ? Number(e.target.value) : null)}
                        placeholder={tr('فارغ = فموي', 'empty = oral')}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => removeDrug(idx)} disabled={drugs.length <= 1}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* ── Premedications Section ────────────────────────────────── */}
          {activeSection === 'premeds' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">{tr('الأدوية المسبقة', 'Premedications')}</h4>
                <Button size="sm" variant="outline" onClick={() => setPremedications((prev) => [...prev, emptyPremedication()])}>
                  <Plus className="h-3 w-3 ltr:mr-1 rtl:ml-1" /> {tr('إضافة', 'Add')}
                </Button>
              </div>
              {premedications.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {tr('لا توجد أدوية مسبقة. أضف واحدة.', 'No premedications added. Add one.')}
                </p>
              )}
              {premedications.map((pm, idx) => (
                <Card key={idx} className="p-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('الدواء', 'Medication')}</Label>
                      <Input value={pm.name} onChange={(e) => updatePremed(idx, 'name', e.target.value)} placeholder="e.g. Ondansetron" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('الجرعة', 'Dose')}</Label>
                      <Input value={pm.dose} onChange={(e) => updatePremed(idx, 'dose', e.target.value)} placeholder="e.g. 8 mg" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('الطريق', 'Route')}</Label>
                      <Select value={pm.route} onValueChange={(v) => updatePremed(idx, 'route', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DRUG_ROUTES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {language === 'ar' ? r.labelAr : r.labelEn}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('التوقيت', 'Timing')}</Label>
                      <Input value={pm.timing} onChange={(e) => updatePremed(idx, 'timing', e.target.value)} placeholder="e.g. 30 min before" />
                    </div>
                    <div className="flex items-end">
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => removePremed(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* ── Hydration Section ─────────────────────────────────────── */}
          {activeSection === 'hydration' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">{tr('الترطيب', 'Hydration')}</h4>
                <Button size="sm" variant="outline" onClick={() => setHydration((prev) => [...prev, emptyHydration()])}>
                  <Plus className="h-3 w-3 ltr:mr-1 rtl:ml-1" /> {tr('إضافة', 'Add')}
                </Button>
              </div>
              {hydration.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {tr('لا توجد سوائل ترطيب مضافة.', 'No hydration fluids added.')}
                </p>
              )}
              {hydration.map((h, idx) => (
                <Card key={idx} className="p-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('السائل', 'Fluid')}</Label>
                      <Input value={h.fluid} onChange={(e) => updateHydration(idx, 'fluid', e.target.value)} placeholder="e.g. NS 0.9%" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('الحجم', 'Volume')}</Label>
                      <Input value={h.volume} onChange={(e) => updateHydration(idx, 'volume', e.target.value)} placeholder="e.g. 500 mL" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('المعدل', 'Rate')}</Label>
                      <Input value={h.rate} onChange={(e) => updateHydration(idx, 'rate', e.target.value)} placeholder="e.g. 250 mL/hr" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('التوقيت', 'Timing')}</Label>
                      <Input value={h.timing} onChange={(e) => updateHydration(idx, 'timing', e.target.value)} placeholder="e.g. Pre-hydration" />
                    </div>
                    <div className="flex items-end">
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => removeHydration(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* ── Dose Modifications Section ────────────────────────────── */}
          {activeSection === 'dosemods' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">{tr('تعديلات الجرعة', 'Dose Modifications')}</h4>
                <Button size="sm" variant="outline" onClick={() => setDoseMods((prev) => [...prev, emptyDoseMod()])}>
                  <Plus className="h-3 w-3 ltr:mr-1 rtl:ml-1" /> {tr('إضافة', 'Add')}
                </Button>
              </div>
              {doseMods.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {tr('لا توجد تعديلات جرعة مضافة.', 'No dose modifications added.')}
                </p>
              )}
              {doseMods.map((dm, idx) => (
                <Card key={idx} className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('الحالة/الشرط', 'Condition')}</Label>
                      <Input value={dm.condition} onChange={(e) => updateDoseMod(idx, 'condition', e.target.value)} placeholder="e.g. Grade 2+ neuropathy" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('التعديل', 'Adjustment')}</Label>
                      <Input value={dm.adjustment} onChange={(e) => updateDoseMod(idx, 'adjustment', e.target.value)} placeholder="e.g. Reduce by 25%" />
                    </div>
                    <div className="flex items-end">
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => removeDoseMod(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* ── Supportive Care Section ───────────────────────────────── */}
          {activeSection === 'supportive' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">{tr('الرعاية الداعمة', 'Supportive Care')}</h4>
                <Button size="sm" variant="outline" onClick={() => setSupportiveCare((prev) => [...prev, emptySupportiveCare()])}>
                  <Plus className="h-3 w-3 ltr:mr-1 rtl:ml-1" /> {tr('إضافة', 'Add')}
                </Button>
              </div>
              {supportiveCare.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {tr('لا توجد رعاية داعمة مضافة.', 'No supportive care added.')}
                </p>
              )}
              {supportiveCare.map((sc, idx) => (
                <Card key={idx} className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('الدواء', 'Medication')}</Label>
                      <Input value={sc.medication} onChange={(e) => updateSC(idx, 'medication', e.target.value)} placeholder="e.g. Pegfilgrastim" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('الاستطباب', 'Indication')}</Label>
                      <Input value={sc.indication} onChange={(e) => updateSC(idx, 'indication', e.target.value)} placeholder="e.g. Neutropenia prophylaxis" />
                    </div>
                    <div className="flex items-end">
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => removeSC(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* ── References Section ────────────────────────────────────── */}
          {activeSection === 'refs' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">{tr('المراجع', 'References')}</h4>
                <Button size="sm" variant="outline" onClick={() => setReferences((prev) => [...prev, emptyReference()])}>
                  <Plus className="h-3 w-3 ltr:mr-1 rtl:ml-1" /> {tr('إضافة', 'Add')}
                </Button>
              </div>
              {references.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {tr('لا توجد مراجع مضافة.', 'No references added.')}
                </p>
              )}
              {references.map((ref, idx) => (
                <Card key={idx} className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">{tr('العنوان', 'Title')}</Label>
                      <Input value={ref.title} onChange={(e) => updateRef(idx, 'title', e.target.value)} placeholder="e.g. Author et al. NEJM 2020" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{tr('السنة', 'Year')}</Label>
                      <Input type="number" value={ref.year ?? ''} onChange={(e) => updateRef(idx, 'year', e.target.value ? Number(e.target.value) : undefined)} placeholder="2020" />
                    </div>
                    <div className="flex items-end">
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => removeRef(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* ── Notes ─────────────────────────────────────────────────── */}
          <div className="space-y-1">
            <Label>{tr('ملاحظات', 'Notes')}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={tr('ملاحظات إضافية...', 'Additional notes...')} />
          </div>

          {/* ── Actions ───────────────────────────────────────────────── */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? tr('جاري الحفظ...', 'Saving...')
                : mode === 'create'
                  ? tr('إنشاء البروتوكول', 'Create Protocol')
                  : tr('حفظ التعديلات', 'Save Changes')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3: DOSE CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════

function DoseCalculatorTab({
  language,
  tr,
}: {
  language: string;
  tr: (ar: string, en: string) => string;
}) {
  const [heightCm, setHeightCm] = useState<string>('170');
  const [weightKg, setWeightKg] = useState<string>('70');
  const [capBSA, setCapBSA] = useState(false);
  const [capValue] = useState(2.0);
  const [selectedProtocolId, setSelectedProtocolId] = useState<string>(STANDARD_PROTOCOLS[0]?.id ?? '');
  const [filterCancerCalc, setFilterCancerCalc] = useState('ALL');

  const height = parseFloat(heightCm) || 0;
  const weight = parseFloat(weightKg) || 0;
  const rawBSA = calculateBSA(height, weight);
  const effectiveBSA = capBSA ? Math.min(rawBSA, capValue) : rawBSA;

  const selectedProtocol = STANDARD_PROTOCOLS.find((p) => p.id === selectedProtocolId);

  const filteredProtocols = useMemo(() => {
    if (filterCancerCalc === 'ALL') return STANDARD_PROTOCOLS;
    return STANDARD_PROTOCOLS.filter((p) => p.cancerType === filterCancerCalc);
  }, [filterCancerCalc]);

  const doseRows = useMemo(() => {
    if (!selectedProtocol || effectiveBSA <= 0) return [];
    return selectedProtocol.drugs.map((drug) => {
      const actualDose = calculateDose(drug as ProtocolDrug, effectiveBSA, {
        capBSA: capBSA ? capValue : undefined,
        weightKg: weight,
      });
      return {
        drug,
        actualDose,
        displayDose:
          drug.unit === 'AUC'
            ? `AUC ${drug.dose}`
            : `${actualDose} mg`,
      };
    });
  }, [selectedProtocol, effectiveBSA, capBSA, capValue, weight]);

  const totalDosePerCycle = doseRows.reduce((sum, row) => {
    if (row.drug.unit === 'AUC') return sum; // Skip AUC-based
    return sum + row.actualDose * row.drug.days.length;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Patient measurements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              {tr('بيانات المريض', 'Patient Data')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>{tr('الطول (سم)', 'Height (cm)')}</Label>
              <Input
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                min={50}
                max={250}
              />
            </div>
            <div className="space-y-1">
              <Label>{tr('الوزن (كجم)', 'Weight (kg)')}</Label>
              <Input
                type="number"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                min={10}
                max={300}
              />
            </div>

            {/* BSA Display */}
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 text-center space-y-1">
              <p className="text-sm text-purple-600 font-medium">{tr('مساحة سطح الجسم', 'Body Surface Area (BSA)')}</p>
              <p className="text-3xl font-bold text-purple-800">{rawBSA.toFixed(3)} m&sup2;</p>
              <p className="text-xs text-purple-500">{tr('صيغة موستلر', 'Mosteller Formula')}</p>
            </div>

            {/* BSA Cap */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="cap-bsa"
                checked={capBSA}
                onCheckedChange={(checked) => setCapBSA(checked === true)}
              />
              <Label htmlFor="cap-bsa" className="text-sm cursor-pointer">
                {tr(`تحديد BSA عند ${capValue} م²`, `Cap BSA at ${capValue} m\u00B2`)}
              </Label>
            </div>

            {capBSA && rawBSA > capValue && (
              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                {tr(
                  `BSA الفعلي ${rawBSA.toFixed(3)} محدد عند ${capValue} م²`,
                  `Actual BSA ${rawBSA.toFixed(3)} capped at ${capValue} m\u00B2`,
                )}
              </div>
            )}

            {/* Protocol Selector */}
            <div className="space-y-1 pt-2 border-t">
              <Label>{tr('تصفية حسب نوع السرطان', 'Filter by Cancer Type')}</Label>
              <Select value={filterCancerCalc} onValueChange={setFilterCancerCalc}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
                  {CANCER_TYPES.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value}>
                      {language === 'ar' ? ct.labelAr : ct.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{tr('اختر البروتوكول', 'Select Protocol')}</Label>
              <Select value={selectedProtocolId} onValueChange={setSelectedProtocolId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {filteredProtocols.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {language === 'ar' ? p.nameAr : p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Right: Dose Sheet */}
        <div className="lg:col-span-2">
          {selectedProtocol && effectiveBSA > 0 ? (
            <Card id="dose-sheet">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {tr('ورقة الجرعات', 'Dose Sheet')}: {language === 'ar' ? selectedProtocol.nameAr : selectedProtocol.name}
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (typeof window !== 'undefined') window.print();
                  }}
                >
                  <Printer className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                  {tr('طباعة', 'Print')}
                </Button>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Protocol summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-muted-foreground text-xs">{tr('مساحة السطح', 'BSA')}</p>
                    <p className="font-bold text-lg">{effectiveBSA.toFixed(3)} m&sup2;</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-muted-foreground text-xs">{tr('طول الدورة', 'Cycle Length')}</p>
                    <p className="font-bold text-lg">{selectedProtocol.cycleLengthDays} {tr('يوم', 'days')}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-muted-foreground text-xs">{tr('عدد الدورات', 'Total Cycles')}</p>
                    <p className="font-bold text-lg">{selectedProtocol.totalCyclesDefault}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-muted-foreground text-xs">{tr('خطر القيء', 'Emetogenic Risk')}</p>
                    <div className="mt-1">
                      <EmetogenicBadge risk={selectedProtocol.emetogenicRisk} language={language} />
                    </div>
                  </div>
                </div>

                {/* Drug doses table */}
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Pill className="h-4 w-4" />
                    {tr('جرعات الأدوية المحسوبة', 'Calculated Drug Doses')}
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tr('الدواء', 'Drug')}</TableHead>
                        <TableHead>{tr('الجرعة/م²', 'Dose/m\u00B2')}</TableHead>
                        <TableHead>{tr('الجرعة الفعلية', 'Actual Dose')}</TableHead>
                        <TableHead>{tr('الطريق', 'Route')}</TableHead>
                        <TableHead>{tr('الأيام', 'Days')}</TableHead>
                        <TableHead>{tr('مدة التسريب', 'Infusion')}</TableHead>
                        <TableHead>{tr('الجرعة/الدورة', 'Dose/Cycle')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {doseRows.map((row, idx) => {
                        const perCycle =
                          row.drug.unit === 'AUC'
                            ? `AUC ${row.drug.dose}`
                            : `${(row.actualDose * row.drug.days.length).toFixed(1)} mg`;
                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">
                              {language === 'ar' ? row.drug.nameAr : row.drug.name}
                            </TableCell>
                            <TableCell>
                              {row.drug.dose} {row.drug.unit}
                            </TableCell>
                            <TableCell className="font-bold text-purple-700">
                              {row.displayDose}
                            </TableCell>
                            <TableCell>{row.drug.route}</TableCell>
                            <TableCell>{row.drug.days.join(', ')}</TableCell>
                            <TableCell>
                              {row.drug.infusionTimeMin != null
                                ? row.drug.infusionTimeMin >= 60
                                  ? `${Math.floor(row.drug.infusionTimeMin / 60)}${tr('س', 'h')} ${row.drug.infusionTimeMin % 60 > 0 ? `${row.drug.infusionTimeMin % 60}${tr('د', 'm')}` : ''}`
                                  : `${row.drug.infusionTimeMin} ${tr('دقيقة', 'min')}`
                                : '-'}
                            </TableCell>
                            <TableCell className="font-semibold">{perCycle}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Total */}
                {totalDosePerCycle > 0 && (
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 flex justify-between items-center">
                    <span className="font-medium text-purple-800">
                      {tr('إجمالي الجرعة (بدون AUC) لكل دورة', 'Total dose (excl. AUC) per cycle')}
                    </span>
                    <span className="text-2xl font-bold text-purple-900">
                      {totalDosePerCycle.toFixed(1)} mg
                    </span>
                  </div>
                )}

                {/* Premedications summary */}
                {selectedProtocol.premedications.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" />
                      {tr('الأدوية المسبقة', 'Premedications')}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {selectedProtocol.premedications.map((pm, idx) => (
                        <div key={idx} className="p-2 bg-muted rounded text-sm flex justify-between">
                          <span className="font-medium">{language === 'ar' ? pm.nameAr : pm.name} ({pm.dose})</span>
                          <span className="text-muted-foreground">{pm.route} - {language === 'ar' ? pm.timingAr : pm.timing}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hydration summary */}
                {selectedProtocol.hydration.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Droplets className="h-4 w-4" />
                      {tr('الترطيب', 'Hydration')}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {selectedProtocol.hydration.map((h, idx) => (
                        <div key={idx} className="p-2 bg-blue-50 rounded text-sm border border-blue-200">
                          <span className="font-medium">{language === 'ar' ? h.fluidAr : h.fluid}</span>
                          <span className="mx-2 text-muted-foreground">|</span>
                          <span>{h.volume} @ {h.rate}</span>
                          <span className="mx-2 text-muted-foreground">|</span>
                          <span className="text-blue-700">{language === 'ar' ? h.timingAr : h.timing}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dose modifications warnings */}
                {selectedProtocol.doseModifications.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-orange-600" />
                      {tr('تعديلات الجرعة', 'Dose Modifications')}
                    </h4>
                    <div className="space-y-2">
                      {selectedProtocol.doseModifications.map((dm, idx) => (
                        <div key={idx} className="p-2 bg-orange-50 rounded border border-orange-200 text-sm">
                          <span className="font-medium text-orange-900">
                            {language === 'ar' ? dm.conditionAr : dm.condition}
                          </span>
                          <span className="mx-2">→</span>
                          <span className="text-orange-700">
                            {language === 'ar' ? dm.adjustmentAr : dm.adjustment}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Supportive Care */}
                {selectedProtocol.supportiveCare.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Heart className="h-4 w-4 text-pink-600" />
                      {tr('الرعاية الداعمة', 'Supportive Care')}
                    </h4>
                    <div className="grid grid-cols-1 gap-1">
                      {selectedProtocol.supportiveCare.map((sc, idx) => (
                        <div key={idx} className="text-sm flex gap-1">
                          <span className="font-medium">{language === 'ar' ? sc.medicationAr : sc.medication}:</span>
                          <span className="text-muted-foreground">{language === 'ar' ? sc.indicationAr : sc.indication}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <Calculator className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">
                  {tr('أدخل بيانات المريض واختر بروتوكول', 'Enter patient data and select a protocol')}
                </p>
                <p className="text-sm mt-1">
                  {tr(
                    'سيتم حساب الجرعات تلقائيًا بناءً على مساحة سطح الجسم',
                    'Doses will be calculated automatically based on BSA',
                  )}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
