'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLang } from '@/hooks/use-lang';

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'txt',
  'text',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'jpg',
  'jpeg',
]);

interface Department {
  id: string;
  name: string;
}

interface LibraryUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function LibraryUploadDialog({
  open,
  onClose,
  onSuccess,
}: LibraryUploadDialogProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadMode] = useState<'manual' | 'ai'>('ai');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewResults, setPreviewResults] = useState<any[]>([]);
  const [dateOverrides, setDateOverrides] = useState<Record<string, { effectiveDate?: string; expiryDate?: string; version?: string }>>({});
  const [mappingOverrides, setMappingOverrides] = useState<Record<string, { operations: string[]; function?: string; riskDomains: string[]; needsReview: boolean }>>({});
  const [availableOperations, setAvailableOperations] = useState<Array<{ id: string; name: string }>>([]);
  const [availableFunctions, setAvailableFunctions] = useState<Array<{ id: string; name: string }>>([]);
  const [availableRiskDomains, setAvailableRiskDomains] = useState<Array<{ id: string; name: string }>>([]);
  
  // Step 1: Classification
  const [classificationType, setClassificationType] = useState<'Global' | 'DepartmentSpecific' | 'Shared'>('Global');
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [scope, setScope] = useState<string>('enterprise');
  const [entityType, setEntityType] = useState<string>('policy');
  const [effectiveDate, setEffectiveDate] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [version, setVersion] = useState<string>('');
  const [tagsStatus, setTagsStatus] = useState<'approved' | 'needs-review'>('approved');
  
  // Step 2: Files
  const [files, setFiles] = useState<File[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Load departments
  useEffect(() => {
    if (open && step === 1) {
      async function loadDepartments() {
        try {
          const response = await fetch('/api/structure/departments', {
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            setDepartments(data.departments || []);
          }
        } catch (error) {
          console.error('Failed to load departments:', error);
        }
      }
      loadDepartments();
    }
  }, [open, step]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setClassificationType('Global');
      setDepartmentIds([]);
      setScope('enterprise');
      setEntityType('policy');
      setEffectiveDate('');
      setExpiryDate('');
      setVersion('');
      setTagsStatus('approved');
      setFiles([]);
      setIsAnalyzing(false);
      setPreviewOpen(false);
      setPreviewResults([]);
      setDateOverrides({});
      setMappingOverrides({});
    }
  }, [open]);

  useEffect(() => {
    if (!previewOpen) return;
    const loadTaxonomy = async () => {
      try {
        const [opsRes, funcsRes, riskRes] = await Promise.all([
          fetch('/api/taxonomy/operations', { credentials: 'include' }),
          fetch('/api/taxonomy/functions', { credentials: 'include' }),
          fetch('/api/taxonomy/risk-domains', { credentials: 'include' }),
        ]);
        if (opsRes.ok) {
          const data = await opsRes.json();
          setAvailableOperations(data.data || []);
        }
        if (funcsRes.ok) {
          const data = await funcsRes.json();
          setAvailableFunctions(data.data || []);
        }
        if (riskRes.ok) {
          const data = await riskRes.json();
          setAvailableRiskDomains(data.data || []);
        }
      } catch (error) {
        console.error('Failed to load taxonomy catalogs:', error);
      }
    };
    loadTaxonomy();
  }, [previewOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const allowedFiles = selectedFiles.filter((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      return ALLOWED_UPLOAD_EXTENSIONS.has(ext);
    });
    const rejectedFiles = selectedFiles.filter((file) => !allowedFiles.includes(file));
    if (rejectedFiles.length > 0) {
      toast({
        title: tr('نوع ملف غير مدعوم', 'Unsupported file type'),
        description: tr('المدعوم: PDF، DOC/DOCX، TXT/TEXT، XLS/XLSX، PPT/PPTX، JPG/JPEG', 'Supported: PDF, DOC/DOCX, TXT/TEXT, XLS/XLSX, PPT/PPTX, JPG/JPEG'),
        variant: 'destructive',
      });
    }
    setFiles(allowedFiles);
    setPreviewResults([]);
    setPreviewOpen(false);
  };

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
    setPreviewResults([]);
    setPreviewOpen(false);
  };

  const handleAnalyzeWithAI = async () => {
    if (files.length === 0) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('يرجى اختيار ملف واحد على الأقل', 'Please select at least one file'),
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const previewResponse = await fetch('/api/sam/thea-engine/preview-classify', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!previewResponse.ok) {
        const errorData = await previewResponse.json();
        throw new Error(errorData.error || 'Failed to analyze files');
      }

      const previewData = await previewResponse.json();
      const results = Array.isArray(previewData?.results)
        ? previewData.results
        : Array.isArray(previewData)
        ? previewData
        : [];

      setPreviewResults(results);
      setPreviewOpen(true);
    } catch (error: any) {
      console.error('Preview error:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: error.message || tr('فشل تحليل الملفات', 'Failed to analyze files'),
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getPreviewForFile = (fileName: string) => {
    if (!fileName) return null;
    const lower = fileName.toLowerCase();
    return (
      previewResults.find(result => String(result?.filename || '').toLowerCase() === lower) ||
      previewResults.find(result => String(result?.fileName || '').toLowerCase() === lower) ||
      null
    );
  };

  const getResolvedForFile = (file: File) => {
    const preview = uploadMode === 'ai' && previewResults.length > 0 ? getPreviewForFile(file.name) : null;
    const overrides = dateOverrides[file.name] || {};
    const mappingOverride = mappingOverrides[file.name];
    const entityTypeMatch = preview?.entityType;
    const scopeMatch = preview?.scope;
    const sectorMatch = preview?.sector;
    const resolvedEntityType =
      entityTypeMatch?.matchedName || entityTypeMatch?.suggestedName || entityType;
    const resolvedScope =
      scopeMatch?.matchedName || scopeMatch?.suggestedName || scope;
    const resolvedDepartmentIds =
      Array.isArray(preview?.departmentIds) && preview.departmentIds.length
        ? preview.departmentIds
        : departmentIds;
    const resolvedOperations =
      mappingOverride?.operations?.length
        ? mappingOverride.operations
        : Array.isArray(preview?.operationIds) && preview.operationIds.length
        ? preview.operationIds
        : [];
    const resolvedFunction =
      mappingOverride?.function
        ? mappingOverride.function
        : preview?.functionId || undefined;
    const resolvedRiskDomains =
      mappingOverride?.riskDomains?.length
        ? mappingOverride.riskDomains
        : Array.isArray(preview?.riskDomainIds) && preview.riskDomainIds.length
        ? preview.riskDomainIds
        : [];
    const resolvedEffectiveDate =
      overrides.effectiveDate || preview?.effectiveDate || effectiveDate || '';
    const resolvedExpiryDate =
      overrides.expiryDate || preview?.expiryDate || expiryDate || '';
    const resolvedVersion =
      overrides.version || preview?.version || version || '';

    return {
      preview,
      resolvedEntityTypeId: entityTypeMatch?.matchedId,
      resolvedScopeId: scopeMatch?.matchedId,
      resolvedSectorId: sectorMatch?.matchedId,
      resolvedEntityType,
      resolvedScope,
      resolvedDepartmentIds,
      resolvedOperations,
      resolvedFunction,
      resolvedRiskDomains,
      resolvedMappingConfidence: preview?.mappingConfidence,
      resolvedNeedsReview: mappingOverride?.needsReview ?? false,
      resolvedEffectiveDate,
      resolvedExpiryDate,
      resolvedVersion,
    };
  };

  const toIsoIfValid = (value?: string) => {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed.toISOString();
  };

  const handleSubmit = async () => {
    // Validation
    if (files.length === 0) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('يرجى اختيار ملف واحد على الأقل', 'Please select at least one file'),
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      if (uploadMode === 'ai' && previewResults.length > 0) {
        for (const file of files) {
          const resolved = getResolvedForFile(file);
          if ((classificationType === 'DepartmentSpecific' || classificationType === 'Shared') && resolved.resolvedDepartmentIds.length === 0) {
            throw new Error(`Please select at least one department for ${file.name}`);
          }

          const formData = new FormData();
          formData.append('files', file);
          formData.append('entityType', resolved.resolvedEntityType);
          formData.append('scope', resolved.resolvedScope);
          if (resolved.resolvedEntityTypeId) formData.append('entityTypeId', resolved.resolvedEntityTypeId);
          if (resolved.resolvedScopeId) formData.append('scopeId', resolved.resolvedScopeId);
          if (resolved.resolvedSectorId) formData.append('sectorId', resolved.resolvedSectorId);
          resolved.resolvedDepartmentIds.forEach(id => formData.append('departments[]', id));
          resolved.resolvedOperations.forEach(id => formData.append('operations[]', id));
          if (resolved.resolvedFunction) formData.append('function', resolved.resolvedFunction);
          resolved.resolvedRiskDomains.forEach(id => formData.append('riskDomains[]', id));
          const effectiveIso = toIsoIfValid(resolved.resolvedEffectiveDate);
          const expiryIso = toIsoIfValid(resolved.resolvedExpiryDate);
          if (effectiveIso) formData.append('effectiveDate', effectiveIso);
          if (expiryIso) formData.append('expiryDate', expiryIso);
          if (resolved.resolvedVersion) formData.append('version', resolved.resolvedVersion);
          formData.append('tagsStatus', tagsStatus);

          const ingestResponse = await fetch('/api/sam/thea-engine/ingest', {
            method: 'POST',
            body: formData,
            credentials: 'include',
          });

          if (!ingestResponse.ok) {
            const errorData = await ingestResponse.json();
            throw new Error(errorData.error || `Failed to upload ${file.name}`);
          }

          const ingestData = await ingestResponse.json();
          const job = ingestData?.jobs?.[0];
          const theaEngineId = job?.policyId;
          if (theaEngineId) {
            const metadataResponse = await fetch('/api/sam/library/metadata', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                theaEngineId,
                metadata: {
                  title: file.name.replace(/\.[^/.]+$/i, ''),
                  departmentIds: resolved.resolvedDepartmentIds,
                  scope: resolved.resolvedScope,
                  scopeId: resolved.resolvedScopeId,
                  tagsStatus,
                  effectiveDate: effectiveIso,
                  expiryDate: expiryIso,
                  version: resolved.resolvedVersion || undefined,
                  entityType: resolved.resolvedEntityType,
                  entityTypeId: resolved.resolvedEntityTypeId,
                  sectorId: resolved.resolvedSectorId,
                  operationalMapping: {
                    operations: resolved.resolvedOperations,
                    function: resolved.resolvedFunction,
                    riskDomains: resolved.resolvedRiskDomains,
                    mappingConfidence: resolved.resolvedMappingConfidence,
                    needsReview: resolved.resolvedNeedsReview,
                  },
                },
              }),
            });

            if (!metadataResponse.ok) {
              console.warn(`Failed to update metadata for ${theaEngineId}`);
            }
          }
        }
      } else {
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file);
        });

        if ((classificationType === 'DepartmentSpecific' || classificationType === 'Shared') && departmentIds.length === 0) {
          throw new Error('Please select at least one department');
        }

        formData.append('entityType', entityType);
        formData.append('scope', scope);
        departmentIds.forEach(id => formData.append('departments[]', id));
        const effectiveIso = toIsoIfValid(effectiveDate);
        const expiryIso = toIsoIfValid(expiryDate);
        if (effectiveIso) formData.append('effectiveDate', effectiveIso);
        if (expiryIso) formData.append('expiryDate', expiryIso);
        if (version) formData.append('version', version);
        formData.append('tagsStatus', tagsStatus);

        const ingestResponse = await fetch('/api/sam/thea-engine/ingest', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (!ingestResponse.ok) {
          const errorData = await ingestResponse.json();
          throw new Error(errorData.error || 'Failed to upload files');
        }

        const ingestData = await ingestResponse.json();
        if (ingestData.jobs && Array.isArray(ingestData.jobs)) {
          const metadataPromises = ingestData.jobs.map(async (job: any) => {
            const theaEngineId = job.policyId;
            if (!theaEngineId) return;

            const metadataResponse = await fetch('/api/sam/library/metadata', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                theaEngineId,
                metadata: {
                  title:
                    files.find((_, i) => i === ingestData.jobs.indexOf(job))?.name.replace(/\.[^/.]+$/i, '') || '',
                  departmentIds,
                  scope,
                  tagsStatus,
                  effectiveDate: effectiveIso,
                  expiryDate: expiryIso,
                  version: version || undefined,
                  entityType,
                },
              }),
            });

            if (!metadataResponse.ok) {
              console.warn(`Failed to update metadata for ${theaEngineId}`);
            }
          });

          await Promise.all(metadataPromises);
        }
      }

      toast({
        title: tr('نجاح', 'Success'),
        description: tr(`تم رفع ${files.length} ملف(ملفات) بنجاح`, `Successfully uploaded ${files.length} file(s)`),
      });

      onSuccess();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: error.message || tr('فشل رفع الملفات', 'Failed to upload files'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getValueLabel = (value: any) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (typeof value === 'object') {
      if ('value' in value && value.value) return String(value.value);
      if ('name' in value && value.name) return String(value.name);
      if ('label' in value && value.label) return String(value.label);
      if ('id' in value && value.id) return String(value.id);
    }
    return '';
  };

  const formatField = (value: any) => {
    const label = getValueLabel(value);
    return label || '—';
  };

  const formatList = (items: any) => {
    if (!Array.isArray(items) || items.length === 0) return '—';
    const labels = items.map(getValueLabel).filter(Boolean);
    return labels.length > 0 ? labels.join(', ') : '—';
  };

  const getPreviewTitle = (result: any) =>
    result?.extractedTitle || result?.title || result?.suggestions?.title?.value;

  const getPreviewSummary = (result: any) =>
    result?.extractedSummary || result?.summary || result?.suggestions?.summary?.value;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr('رفع الوثائق', 'Upload Documents')}</DialogTitle>
            <DialogDescription>
              {step === 1 ? tr('الخطوة 1: التصنيف', 'Step 1: Classification') : tr('الخطوة 2: اختيار الملفات', 'Step 2: Select Files')}
            </DialogDescription>
          </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            {/* Classification Type */}
            <div className="space-y-2">
              <Label>{tr('نوع التصنيف *', 'Classification Type *')}</Label>
              <Select value={classificationType} onValueChange={(v: any) => {
                setClassificationType(v);
                if (v === 'Global') {
                  setDepartmentIds([]);
                  setScope('enterprise');
                } else if (v === 'Shared') {
                  setScope('shared');
                } else {
                  setScope('department');
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Global">{tr('عام (على مستوى المؤسسة)', 'Global (Enterprise-wide)')}</SelectItem>
                  <SelectItem value="DepartmentSpecific">{tr('خاص بقسم', 'Department Specific')}</SelectItem>
                  <SelectItem value="Shared">{tr('مشترك (أقسام متعددة)', 'Shared (Multiple Departments)')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Departments (required if not Global) */}
            {(classificationType === 'DepartmentSpecific' || classificationType === 'Shared') && (
              <div className="space-y-2">
                <Label>{tr('الأقسام *', 'Departments *')}</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                  {departments.map(dept => (
                    <div key={dept.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`dept-${dept.id}`}
                        checked={departmentIds.includes(dept.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setDepartmentIds([...departmentIds, dept.id]);
                          } else {
                            setDepartmentIds(departmentIds.filter(id => id !== dept.id));
                          }
                        }}
                      />
                      <Label htmlFor={`dept-${dept.id}`} className="cursor-pointer">
                        {dept.name}
                      </Label>
                    </div>
                  ))}
                </div>
                {departmentIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {departmentIds.map(id => {
                      const dept = departments.find(d => d.id === id);
                      return (
                        <Badge key={id} variant="secondary">
                          {dept?.name || id}
                          <X
                            className="ml-1 h-3 w-3 cursor-pointer"
                            onClick={() => setDepartmentIds(departmentIds.filter(d => d !== id))}
                          />
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Scope (optional, auto-set based on classification) */}
            <div className="space-y-2">
              <Label>{tr('النطاق', 'Scope')}</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enterprise">{tr('مؤسسي', 'Enterprise')}</SelectItem>
                  <SelectItem value="shared">{tr('مشترك', 'Shared')}</SelectItem>
                  <SelectItem value="department">{tr('قسم', 'Department')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Entity Type */}
            <div className="space-y-2">
              <Label>{tr('نوع الكيان', 'Entity Type')}</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="policy">{tr('وثيقة', 'Document')}</SelectItem>
                  <SelectItem value="sop">{tr('إجراء تشغيلي', 'SOP')}</SelectItem>
                  <SelectItem value="workflow">{tr('سير عمل', 'Workflow')}</SelectItem>
                  <SelectItem value="playbook">{tr('دليل تشغيل', 'Playbook')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Effective Date */}
            <div className="space-y-2">
              <Label>{tr('تاريخ السريان', 'Effective Date')}</Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>

            {/* Expiry Date */}
            <div className="space-y-2">
              <Label>{tr('تاريخ الانتهاء', 'Expiry Date')}</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>

            {/* Version */}
            <div className="space-y-2">
              <Label>{tr('الإصدار', 'Version')}</Label>
              <Input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder={tr('مثال: 1.0، 2024.1', 'e.g., 1.0, 2024.1')}
              />
            </div>

            {/* Tags Status */}
            <div className="space-y-2">
              <Label>{tr('حالة العلامات', 'Tags Status')}</Label>
              <Select value={tagsStatus} onValueChange={(v: any) => setTagsStatus(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">{tr('موافق عليه', 'Approved')}</SelectItem>
                  <SelectItem value="needs-review">{tr('يحتاج مراجعة', 'Needs Review')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{tr('اختر الملفات (PDF، DOC/DOCX، TXT/TEXT، XLS/XLSX، PPT/PPTX، JPG/JPEG)', 'Select Files (PDF, DOC/DOCX, TXT/TEXT, XLS/XLSX, PPT/PPTX, JPG/JPEG)')}</Label>
              <Input
                type="file"
                multiple
                onChange={handleFileSelect}
              />
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                <Label>{tr(`الملفات المحددة (${files.length})`, `Selected Files (${files.length})`)}</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={onClose}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button onClick={() => setStep(2)}>
                {tr('التالي: اختيار الملفات', 'Next: Select Files')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                {tr('رجوع', 'Back')}
              </Button>
              <Button onClick={handleAnalyzeWithAI} disabled={isAnalyzing || isUploading || files.length === 0}>
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {tr('جاري تحليل الوثيقة...', 'Analyzing document...')}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    {tr('تحليل الوثيقة', 'Analyze Document')}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr('معاينة التصنيف', 'Classification Preview')}</DialogTitle>
            <DialogDescription>{tr('راجع توصيات النظام قبل الرفع', 'Review system recommendations before upload')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {previewResults.length === 0 ? (
              <div className="text-sm text-muted-foreground">{tr('لا توجد نتائج معاينة متاحة.', 'No preview results available.')}</div>
            ) : (
              previewResults.map((result, index) => {
                const suggestions = result?.suggestions || result || {};
                const entityTypeMatch = result?.entityType;
                const scopeMatch = result?.scope;
                const classification = suggestions?.classification || {};
                const fileName = result?.filename || result?.fileName || files[index]?.name || `File ${index + 1}`;
                const title = getPreviewTitle(result);
                const summary = getPreviewSummary(result);
                const dateOverride = dateOverrides[fileName] || {};
                const detectedEffectiveDate = result?.effectiveDate;
                const detectedExpiryDate = result?.expiryDate;
                const detectedVersion = result?.version;
                const mappingOverride = mappingOverrides[fileName];
                const resolvedOperations =
                  mappingOverride?.operations?.length
                    ? mappingOverride.operations
                    : Array.isArray(result?.operationIds)
                    ? result.operationIds
                    : [];
                const resolvedFunction = mappingOverride?.function || result?.functionId || '';
                const resolvedRiskDomains =
                  mappingOverride?.riskDomains?.length
                    ? mappingOverride.riskDomains
                    : Array.isArray(result?.riskDomainIds)
                    ? result.riskDomainIds
                    : [];
                return (
                  <div key={index} className="rounded-md border p-4 space-y-3">
                    <div className="text-sm font-medium">{fileName}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">{tr('نوع الكيان', 'Entity Type')}</div>
                        <div>{formatField(entityTypeMatch?.matchedName || entityTypeMatch?.suggestedName || suggestions?.entityType)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">{tr('النطاق', 'Scope')}</div>
                        <div>{formatField(scopeMatch?.matchedName || scopeMatch?.suggestedName || suggestions?.scope)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">{tr('الأقسام', 'Departments')}</div>
                        <div>{formatList(suggestions?.departments)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">{tr('العمليات', 'Operations')}</div>
                        <div>{formatList(classification?.operations || suggestions?.operations)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">{tr('الوظيفة', 'Function')}</div>
                        <div>{formatField(classification?.function || suggestions?.function)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">{tr('مجالات المخاطر', 'Risk Domains')}</div>
                        <div>{formatList(classification?.riskDomains || suggestions?.riskDomains)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">{tr('الجهات التنظيمية', 'Regulators')}</div>
                        <div>{formatList(suggestions?.regulators)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">{tr('المرحلة', 'Stage')}</div>
                        <div>{formatField(suggestions?.stage)}</div>
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-xs text-muted-foreground">{tr('تاريخ السريان', 'Effective Date')}</div>
                        <div className="text-xs text-muted-foreground">
                          {detectedEffectiveDate ? String(detectedEffectiveDate) : tr('لم يتم الكشف', 'Not detected')}
                        </div>
                        <Input
                          type="date"
                          value={dateOverride.effectiveDate ?? detectedEffectiveDate ?? ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDateOverrides(prev => ({
                              ...prev,
                              [fileName]: {
                                ...prev[fileName],
                                effectiveDate: value,
                              },
                            }));
                          }}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-xs text-muted-foreground">{tr('تاريخ الانتهاء', 'Expiry Date')}</div>
                        <div className="text-xs text-muted-foreground">
                          {detectedExpiryDate ? String(detectedExpiryDate) : tr('لم يتم الكشف', 'Not detected')}
                        </div>
                        <Input
                          type="date"
                          value={dateOverride.expiryDate ?? detectedExpiryDate ?? ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDateOverrides(prev => ({
                              ...prev,
                              [fileName]: {
                                ...prev[fileName],
                                expiryDate: value,
                              },
                            }));
                          }}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-xs text-muted-foreground">{tr('الإصدار', 'Version')}</div>
                        <div className="text-xs text-muted-foreground">
                          {detectedVersion ? String(detectedVersion) : tr('لم يتم الكشف', 'Not detected')}
                        </div>
                        <Input
                          value={dateOverride.version ?? detectedVersion ?? ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDateOverrides(prev => ({
                              ...prev,
                              [fileName]: {
                                ...prev[fileName],
                                version: value,
                              },
                            }));
                          }}
                          placeholder={tr('مثال: 1.0، 2024.1', 'e.g., 1.0, 2024.1')}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                          <div className="text-sm font-medium">{tr('التخطيط التشغيلي', 'Operational Mapping')}</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">{tr('العمليات', 'Operations')}</div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" className="w-full justify-between">
                                    {resolvedOperations.length > 0
                                      ? tr(`${resolvedOperations.length} محدد`, `${resolvedOperations.length} selected`)
                                      : tr('اختر العمليات', 'Select operations')}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-72 max-h-64 overflow-y-auto">
                                  {availableOperations.length === 0 && (
                                    <div className="px-2 py-1 text-xs text-muted-foreground">{tr('لا توجد عمليات متاحة', 'No operations available')}</div>
                                  )}
                                  {availableOperations.map((op) => (
                                    <DropdownMenuCheckboxItem
                                      key={op.id}
                                      checked={resolvedOperations.includes(op.id)}
                                      onCheckedChange={(checked) => {
                                        setMappingOverrides((prev) => {
                                          const current = prev[fileName]?.operations || resolvedOperations;
                                          const next = checked
                                            ? Array.from(new Set([...current, op.id]))
                                            : current.filter((id) => id !== op.id);
                                          return {
                                            ...prev,
                                            [fileName]: {
                                              operations: next,
                                              function: resolvedFunction || undefined,
                                              riskDomains: resolvedRiskDomains,
                                              needsReview: prev[fileName]?.needsReview ?? false,
                                            },
                                          };
                                        });
                                      }}
                                    >
                                      {op.name}
                                    </DropdownMenuCheckboxItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">{tr('الوظيفة', 'Function')}</div>
                              <Select
                                value={resolvedFunction || 'none'}
                                onValueChange={(value) => {
                                  const normalizedFunction = value === 'none' ? undefined : value;
                                  setMappingOverrides((prev) => ({
                                    ...prev,
                                    [fileName]: {
                                      operations: resolvedOperations,
                                      function: normalizedFunction,
                                      riskDomains: resolvedRiskDomains,
                                      needsReview: prev[fileName]?.needsReview ?? false,
                                    },
                                  }));
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={tr('اختر الوظيفة', 'Select function')} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">{tr('بدون وظيفة', 'No function')}</SelectItem>
                                  {availableFunctions.map((fn) => (
                                    <SelectItem key={fn.id} value={fn.id}>
                                      {fn.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <div className="text-xs text-muted-foreground">{tr('مجالات المخاطر', 'Risk Domains')}</div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" className="w-full justify-between">
                                    {resolvedRiskDomains.length > 0
                                      ? tr(`${resolvedRiskDomains.length} محدد`, `${resolvedRiskDomains.length} selected`)
                                      : tr('اختر مجالات المخاطر', 'Select risk domains')}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-72 max-h-64 overflow-y-auto">
                                  {availableRiskDomains.length === 0 && (
                                    <div className="px-2 py-1 text-xs text-muted-foreground">{tr('لا توجد مجالات مخاطر متاحة', 'No risk domains available')}</div>
                                  )}
                                  {availableRiskDomains.map((rd) => (
                                    <DropdownMenuCheckboxItem
                                      key={rd.id}
                                      checked={resolvedRiskDomains.includes(rd.id)}
                                      onCheckedChange={(checked) => {
                                        setMappingOverrides((prev) => {
                                          const current = prev[fileName]?.riskDomains || resolvedRiskDomains;
                                          const next = checked
                                            ? Array.from(new Set([...current, rd.id]))
                                            : current.filter((id) => id !== rd.id);
                                          return {
                                            ...prev,
                                            [fileName]: {
                                              operations: resolvedOperations,
                                              function: resolvedFunction || undefined,
                                              riskDomains: next,
                                              needsReview: prev[fileName]?.needsReview ?? false,
                                            },
                                          };
                                        });
                                      }}
                                    >
                                      {rd.name}
                                    </DropdownMenuCheckboxItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={mappingOverride?.needsReview ?? false}
                                onCheckedChange={(checked) => {
                                  setMappingOverrides((prev) => ({
                                    ...prev,
                                    [fileName]: {
                                      operations: resolvedOperations,
                                      function: resolvedFunction || undefined,
                                      riskDomains: resolvedRiskDomains,
                                      needsReview: Boolean(checked),
                                    },
                                  }));
                                }}
                              />
                              <div className="text-sm">{tr('يحتاج مراجعة', 'Needs review')}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-xs text-muted-foreground">{tr('العنوان المستخرج', 'Extracted Title')}</div>
                        <div>{title ? String(title) : '—'}</div>
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-xs text-muted-foreground">{tr('الملخص', 'Summary')}</div>
                        <div>{summary ? String(summary) : '—'}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button
              onClick={() => {
                setPreviewOpen(false);
                handleSubmit();
              }}
              disabled={isUploading || files.length === 0}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tr('جاري الرفع...', 'Uploading...')}
                </>
              ) : (
                <>{tr('تأكيد ورفع', 'Confirm & Upload')}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
