'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
// Using Dialog instead of Drawer for metadata editing
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Upload, Eye, Trash2, Edit, Archive, MoreVertical, Search, Filter, X, Loader2, AlertCircle, FileText, BookOpen, Workflow, PlayCircle, RefreshCw } from 'lucide-react';
import { LibraryUploadDialog } from '@/components/sam/library/LibraryUploadDialog';
import { LibraryMetadataDrawer } from '@/components/sam/library/LibraryMetadataDrawer';
import { useLang } from '@/hooks/use-lang';

interface LibraryItem {
  theaEngineId: string;
  filename: string;
  status: string;
  indexedAt?: string;
  progress?: {
    pagesTotal: number;
    pagesDone: number;
    chunksTotal: number;
    chunksDone: number;
  };
  taskCount?: number;
  metadata: {
    title: string;
    departmentIds: string[];
    scope: string;
    tagsStatus: 'auto-approved' | 'needs-review' | 'approved';
    effectiveDate?: string;
    expiryDate?: string;
    version?: string;
    owners: string[];
    lifecycleStatus: 'ACTIVE' | 'EXPIRING_SOON' | 'UNDER_REVIEW' | 'EXPIRED' | 'ARCHIVED';
    nextReviewDate?: string;
    statusUpdatedAt?: string;
    reviewCycleMonths?: number;
    entityType?: string;
    category?: string;
    source?: string;
    integrityOpenCount?: number;
    integrityLastRunAt?: string | null;
    integrityRunStatus?: string | null;
    integrityRunId?: string | null;
    operationalMapping?: {
      operations?: string[];
      function?: string;
      riskDomains?: string[];
      mappingConfidence?: {
        operations?: number;
        function?: number;
        riskDomains?: number;
      };
      needsReview?: boolean;
    };
  };
}

interface Department {
  id: string;
  name: string;
}

export default function SAMLibraryPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const router = useRouter();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
  const [isMetadataDrawerOpen, setIsMetadataDrawerOpen] = useState(false);
  const [viewingPolicyId, setViewingPolicyId] = useState<string | null>(null);
  const [taskRefreshToken, setTaskRefreshToken] = useState(0);
  const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);
  const [mappingItem, setMappingItem] = useState<LibraryItem | null>(null);
  const [mappingOperations, setMappingOperations] = useState<string[]>([]);
  const [mappingFunction, setMappingFunction] = useState<string>('');
  const [mappingRiskDomains, setMappingRiskDomains] = useState<string[]>([]);
  const [mappingNeedsReview, setMappingNeedsReview] = useState(false);
  const [mappingConfidence, setMappingConfidence] = useState<{ operations?: number; function?: number; riskDomains?: number } | null>(null);
  const [operationsCatalog, setOperationsCatalog] = useState<Array<{ id: string; name: string }>>([]);
  const [functionsCatalog, setFunctionsCatalog] = useState<Array<{ id: string; name: string }>>([]);
  const [riskDomainsCatalog, setRiskDomainsCatalog] = useState<Array<{ id: string; name: string }>>([]);
  const [isSavingMapping, setIsSavingMapping] = useState(false);
  const [isAssignOperationOpen, setIsAssignOperationOpen] = useState(false);
  const [assigningItem, setAssigningItem] = useState<LibraryItem | null>(null);
  const [selectedOperationId, setSelectedOperationId] = useState<string>('');
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [reassignDepartmentIds, setReassignDepartmentIds] = useState<string[]>([]);
  const [isRunningIntegrity, setIsRunningIntegrity] = useState(false);
  const [autoViewedDocumentId, setAutoViewedDocumentId] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [selectedScope, setSelectedScope] = useState<string>('all');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('all');
  const [selectedTagsStatus, setSelectedTagsStatus] = useState<string>('all');
  const [selectedExpiryStatus, setSelectedExpiryStatus] = useState<string>('all');
  const [selectedLifecycleStatus, setSelectedLifecycleStatus] = useState<string>('all');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [isRunningLifecycle, setIsRunningLifecycle] = useState(false);
  const [operationalFilter, setOperationalFilter] = useState<'all' | 'mapped' | 'needs_review' | 'unmapped'>('all');
  const [initialFiltersApplied, setInitialFiltersApplied] = useState(false);
  
  // Departments for filter
  const [departments, setDepartments] = useState<Department[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (initialFiltersApplied) return;
    const queueType = searchParams?.get('queueType');
    const departmentId = searchParams?.get('departmentId');
    const documentId = searchParams?.get('documentId');
    const lifecycleStatus = searchParams?.get('lifecycleStatus');
    if (departmentId) {
      setSelectedDepartmentIds([departmentId]);
    }
    if (queueType === 'lifecycle_alerts') {
      setSelectedLifecycleStatus(lifecycleStatus || 'EXPIRING_SOON');
    }
    if (queueType === 'required_missing') {
      setOperationalFilter('unmapped');
    }
    if (queueType === 'my_tasks' && documentId) {
      setSearchQuery(documentId);
    }
    setInitialFiltersApplied(true);
  }, [searchParams, initialFiltersApplied]);

  // Load departments
  useEffect(() => {
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
  }, []);

  // Fetch library items
  const fetchItems = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (selectedDepartmentIds.length > 0) params.set('departmentIds', selectedDepartmentIds.join(','));
      if (selectedScope !== 'all') params.set('scope', selectedScope);
      if (selectedEntityType !== 'all') params.set('entityType', selectedEntityType);
      if (selectedTagsStatus !== 'all') params.set('tagsStatus', selectedTagsStatus);
      if (selectedExpiryStatus !== 'all') params.set('expiryStatus', selectedExpiryStatus);
      if (selectedLifecycleStatus !== 'all') params.set('lifecycleStatus', selectedLifecycleStatus);
      if (includeArchived) params.set('includeArchived', '1');
      params.set('page', page.toString());
      params.set('limit', '20');

      const response = await fetch(`/api/sam/library/list?${params.toString()}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      } else {
        toast({
          title: tr('خطأ', 'Error'),
          description: tr('فشل تحميل عناصر المكتبة', 'Failed to load library items'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('فشل تحميل عناصر المكتبة', 'Failed to load library items'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedDepartmentIds, selectedScope, selectedEntityType, selectedTagsStatus, selectedExpiryStatus, selectedLifecycleStatus, includeArchived, page, toast, language]);


  const handleRunLifecycle = async () => {
    setIsRunningLifecycle(true);
    try {
      const response = await fetch('/api/sam/library/lifecycle/status', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to run lifecycle automation');
      }
      toast({
        title: tr('تم تحديث دورة الحياة', 'Lifecycle updated'),
        description: tr('تم تحديث حالات الوثائق', 'Document statuses were refreshed'),
      });
      fetchItems();
    } catch (error: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error.message || 'Failed to run lifecycle automation',
        variant: 'destructive',
      });
    } finally {
      setIsRunningLifecycle(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const documentId = params.get('documentId');
    if (documentId && documentId !== autoViewedDocumentId) {
      handleView(documentId);
      setAutoViewedDocumentId(documentId);
      router.replace(window.location.pathname);
    }
  }, [autoViewedDocumentId, router]);


  // Handle view PDF
  const handleView = (theaEngineId: string) => {
    const url = `/api/sam/library/view-file?theaEngineId=${encodeURIComponent(theaEngineId)}`;
    window.open(url, '_blank');
  };

  // Handle edit metadata
  const handleEditMetadata = (item: LibraryItem) => {
    setEditingItem(item);
    setIsMetadataDrawerOpen(true);
  };

  const loadOperationalCatalogs = useCallback(async () => {
    try {
      const [opsRes, funcRes, riskRes] = await Promise.all([
        fetch('/api/taxonomy/operations', { credentials: 'include' }),
        fetch('/api/taxonomy/functions', { credentials: 'include' }),
        fetch('/api/taxonomy/risk-domains', { credentials: 'include' }),
      ]);
      if (opsRes.ok) {
        const data = await opsRes.json();
        setOperationsCatalog(data.data || []);
      }
      if (funcRes.ok) {
        const data = await funcRes.json();
        setFunctionsCatalog(data.data || []);
      }
      if (riskRes.ok) {
        const data = await riskRes.json();
        setRiskDomainsCatalog(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load operational catalogs:', error);
    }
  }, []);

  const openMappingDialog = (item: LibraryItem) => {
    const mapping = item.metadata.operationalMapping || {};
    setMappingItem(item);
    setMappingOperations(mapping.operations || []);
    setMappingFunction(mapping.function || '');
    setMappingRiskDomains(mapping.riskDomains || []);
    setMappingNeedsReview(Boolean(mapping.needsReview));
    setMappingConfidence(mapping.mappingConfidence || null);
    setIsMappingDialogOpen(true);
    if (operationsCatalog.length === 0 && functionsCatalog.length === 0 && riskDomainsCatalog.length === 0) {
      loadOperationalCatalogs();
    }
  };

  const openAssignOperationDialog = (item: LibraryItem) => {
    setAssigningItem(item);
    setSelectedOperationId(item.metadata.operationalMapping?.operations?.[0] || '');
    setIsAssignOperationOpen(true);
    if (operationsCatalog.length === 0) {
      loadOperationalCatalogs();
    }
  };

  const handleAssignOperation = async () => {
    if (!assigningItem || !selectedOperationId) return;
    try {
      const response = await fetch('/api/sam/library/metadata', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          theaEngineId: assigningItem.theaEngineId,
          metadata: {
            operationIds: [selectedOperationId],
            operationalMapping: {
              operations: [selectedOperationId],
              needsReview: false,
              mappingConfidence: { operations: 1, function: 1, riskDomains: 1 },
            },
          },
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to assign operation' }));
        throw new Error(errorData.error || 'Failed to assign operation');
      }
      setItems((prev) =>
        prev.map((item) =>
          item.theaEngineId === assigningItem.theaEngineId
            ? {
                ...item,
                metadata: {
                  ...item.metadata,
                  operationalMapping: {
                    operations: [selectedOperationId],
                    function: item.metadata.operationalMapping?.function,
                    riskDomains: item.metadata.operationalMapping?.riskDomains || [],
                    needsReview: false,
                    mappingConfidence: { operations: 1, function: 1, riskDomains: 1 },
                  },
                },
              }
            : item
        )
      );
      toast({
        title: tr('نجاح', 'Success'),
        description: tr('تم تعيين العملية', 'Operation assigned'),
      });
      setIsAssignOperationOpen(false);
      setAssigningItem(null);
      setSelectedOperationId('');
    } catch (error: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error.message || tr('فشل تعيين العملية', 'Failed to assign operation'),
        variant: 'destructive',
      });
    }
  };

  const handleSaveMapping = async () => {
    if (!mappingItem) return;
    setIsSavingMapping(true);
    try {
      const response = await fetch('/api/sam/library/metadata', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          theaEngineId: mappingItem.theaEngineId,
          metadata: {
            operationalMapping: {
              operations: mappingOperations,
              function: mappingFunction || undefined,
              riskDomains: mappingRiskDomains,
              needsReview: mappingNeedsReview,
            },
          },
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update mapping' }));
        throw new Error(errorData.error || 'Failed to update mapping');
      }
      setItems((prev) =>
        prev.map((item) =>
          item.theaEngineId === mappingItem.theaEngineId
            ? {
                ...item,
                metadata: {
                  ...item.metadata,
                  operationalMapping: {
                    operations: mappingOperations,
                    function: mappingFunction || undefined,
                    riskDomains: mappingRiskDomains,
                    mappingConfidence: item.metadata.operationalMapping?.mappingConfidence,
                    needsReview: mappingNeedsReview,
                  },
                },
              }
            : item
        )
      );
      toast({
        title: tr('نجاح', 'Success'),
        description: tr('تم تحديث التخطيط التشغيلي', 'Operational mapping updated'),
      });
      setIsMappingDialogOpen(false);
      setMappingItem(null);
    } catch (error: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error.message || tr('فشل تحديث التخطيط', 'Failed to update mapping'),
        variant: 'destructive',
      });
    } finally {
      setIsSavingMapping(false);
    }
  };

  // Handle delete
  const handleDelete = async (theaEngineId: string) => {
    if (!confirm(tr('هل أنت متأكد من حذف هذا العنصر؟', 'Are you sure you want to delete this item?'))) return;

    try {
      const response = await fetch('/api/sam/library/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'delete',
          theaEngineIds: [theaEngineId],
        }),
      });

      if (response.ok) {
        toast({
          title: tr('نجاح', 'Success'),
          description: tr('تم حذف العنصر بنجاح', 'Item deleted successfully'),
        });
        fetchItems();
      } else {
        toast({
          title: tr('خطأ', 'Error'),
          description: tr('فشل حذف العنصر', 'Failed to delete item'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('فشل حذف العنصر', 'Failed to delete item'),
        variant: 'destructive',
      });
    }
  };

  // Handle archive/unarchive
  const handleArchive = async (theaEngineId: string, isArchived: boolean) => {
    try {
      const response = await fetch('/api/sam/library/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: isArchived ? 'unarchive' : 'archive',
          theaEngineIds: [theaEngineId],
        }),
      });

      if (response.ok) {
        toast({
          title: tr('نجاح', 'Success'),
          description: isArchived ? tr('تم إلغاء أرشفة العنصر', 'Item unarchived') : tr('تم أرشفة العنصر', 'Item archived'),
        });
        fetchItems();
      } else {
        toast({
          title: tr('خطأ', 'Error'),
          description: tr('فشل تحديث العنصر', 'Failed to update item'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Archive error:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('فشل تحديث العنصر', 'Failed to update item'),
        variant: 'destructive',
      });
    }
  };

  // Handle bulk actions
  const handleBulkAction = async (action: string, metadata?: any) => {
    if (selectedItems.size === 0) {
      toast({
        title: tr('لا يوجد تحديد', 'No selection'),
        description: tr('يرجى تحديد العناصر أولاً', 'Please select items first'),
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/sam/library/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action,
          theaEngineIds: Array.from(selectedItems),
          metadata,
        }),
      });

      if (response.ok) {
        toast({
          title: tr('نجاح', 'Success'),
          description: tr(`الإجراء الجماعي ${action} اكتمل`, `Bulk ${action} completed`),
        });
        setSelectedItems(new Set());
        fetchItems();
      } else {
        toast({
          title: tr('خطأ', 'Error'),
          description: tr(`فشل ${action}`, `Failed to ${action}`),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Bulk action error:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: tr(`فشل ${action}`, `Failed to ${action}`),
        variant: 'destructive',
      });
    }
  };

  const handleRunIntegrity = async (documentIds: string[]) => {
    if (documentIds.length === 0) {
      toast({
        title: tr('لا يوجد تحديد', 'No selection'),
        description: tr('يرجى تحديد العناصر أولاً', 'Please select items first'),
        variant: 'destructive',
      });
      return;
    }
    setIsRunningIntegrity(true);
    try {
      const response = await fetch('/api/sam/integrity/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'issues',
          documentIds,
          scope: { type: 'selection' },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to start integrity run');
      }
      router.push(`/integrity?runId=${data.runId}&documentIds=${documentIds.join(',')}`);
    } catch (error: any) {
      console.error('Integrity run error:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: error.message || tr('فشل بدء فحص التكامل', 'Failed to start integrity run'),
        variant: 'destructive',
      });
    } finally {
      setIsRunningIntegrity(false);
    }
  };

  const handleRunIntegrityForFilters = async () => {
    const filters = {
      search: searchQuery.trim() || undefined,
      departmentIds: selectedDepartmentIds.length > 0 ? selectedDepartmentIds.join(',') : undefined,
      scope: selectedScope === 'all' ? undefined : selectedScope,
      entityType: selectedEntityType === 'all' ? undefined : selectedEntityType,
      tagsStatus: selectedTagsStatus === 'all' ? undefined : selectedTagsStatus,
      expiryStatus: selectedExpiryStatus === 'all' ? undefined : selectedExpiryStatus,
      lifecycleStatus: selectedLifecycleStatus === 'all' ? undefined : selectedLifecycleStatus,
      includeArchived: includeArchived ? '1' : undefined,
    };

    setIsRunningIntegrity(true);
    try {
      const response = await fetch('/api/sam/integrity/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'issues',
          scope: { type: 'filter', filters },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to start integrity run');
      }
      router.push(`/integrity?runId=${data.runId}`);
    } catch (error: any) {
      console.error('Integrity run error:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: error.message || tr('فشل بدء فحص التكامل', 'Failed to start integrity run'),
        variant: 'destructive',
      });
    } finally {
      setIsRunningIntegrity(false);
    }
  };

  // Get lifecycle badge
  const getLifecycleBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="default">{tr('نشط', 'Active')}</Badge>;
      case 'EXPIRING_SOON':
        return <Badge variant="outline" className="bg-yellow-500 text-yellow-900 border-yellow-600">{tr('ينتهي قريباً', 'Expiring Soon')}</Badge>;
      case 'UNDER_REVIEW':
        return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">{tr('قيد المراجعة', 'Under Review')}</Badge>;
      case 'EXPIRED':
        return <Badge variant="destructive">{tr('منتهي', 'Expired')}</Badge>;
      case 'ARCHIVED':
        return <Badge variant="secondary">{tr('مؤرشف', 'Archived')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLifecycleHelperText = (metadata: LibraryItem['metadata']) => {
    const now = new Date();
    if (metadata.expiryDate) {
      const expiryDate = new Date(metadata.expiryDate);
      const days = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (metadata.lifecycleStatus === 'EXPIRING_SOON') {
        return tr(`ينتهي خلال ${days} يوم`, `Expires in ${days} day(s)`);
      }
      if (metadata.lifecycleStatus === 'EXPIRED') {
        return tr(`انتهى منذ ${Math.abs(days)} يوم`, `Expired ${Math.abs(days)} day(s) ago`);
      }
      if (metadata.lifecycleStatus === 'ACTIVE' && days > 0) {
        return tr(`ينتهي خلال ${days} يوم`, `Expires in ${days} day(s)`);
      }
    }
    if (metadata.nextReviewDate) {
      const reviewDate = new Date(metadata.nextReviewDate);
      const days = Math.ceil((reviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (metadata.lifecycleStatus === 'UNDER_REVIEW') {
        return days <= 0
          ? tr(`المراجعة مستحقة منذ ${Math.abs(days)} يوم`, `Review due ${Math.abs(days)} day(s) ago`)
          : tr(`المراجعة مستحقة خلال ${days} يوم`, `Review due in ${days} day(s)`);
      }
    }
    return '';
  };

  // Get entity icon
  const getEntityIcon = (entityType?: string) => {
    switch (entityType) {
      case 'policy':
        return <FileText className="h-4 w-4" />;
      case 'sop':
        return <BookOpen className="h-4 w-4" />;
      case 'workflow':
        return <Workflow className="h-4 w-4" />;
      case 'playbook':
        return <PlayCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const formatEntityTypeLabel = (entityType?: string) => {
    if (!entityType || entityType === 'policy') return tr('وثيقة', 'document');
    return entityType;
  };

  // Get department names
  const getDepartmentNames = (departmentIds: string[]) => {
    return departmentIds
      .map(id => departments.find(d => d.id === id)?.name || id)
      .filter(Boolean)
      .join(', ') || tr('غير مصنف', 'Unclassified');
  };

  const getOperationalStatus = (item: LibraryItem) => {
    const mapping = item.metadata.operationalMapping;
    const operations = Array.isArray(mapping?.operations) ? mapping?.operations : [];
    const riskDomains = Array.isArray(mapping?.riskDomains) ? mapping?.riskDomains : [];
    const hasAny = operations.length > 0 || riskDomains.length > 0;
    if (!hasAny) return 'UNMAPPED';
    const needsReview = Boolean(mapping?.needsReview);
    const confidence = mapping?.mappingConfidence;
    const lowConfidence = Boolean(
      confidence &&
        [confidence.operations, confidence.function, confidence.riskDomains]
          .filter((value) => typeof value === 'number')
          .some((value) => (value as number) < 0.6)
    );
    if (operations.length > 0 && riskDomains.length > 0 && !needsReview && !lowConfidence) {
      return 'MAPPED';
    }
    return 'NEEDS_REVIEW';
  };

  const visibleItems = useMemo(() => {
    if (operationalFilter === 'all') return items;
    return items.filter((item) => {
      const status = getOperationalStatus(item);
      if (operationalFilter === 'mapped') return status === 'MAPPED';
      if (operationalFilter === 'needs_review') return status === 'NEEDS_REVIEW';
      if (operationalFilter === 'unmapped') return status === 'UNMAPPED';
      return true;
    });
  }, [items, operationalFilter]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{tr('مكتبة الوثائق', 'Documents Library')}</CardTitle>
          <CardDescription>
            {tr('إدارة الوثائق التشغيلية عبر السياسات والإجراءات وسير العمل والقوائم والنماذج والإرشادات والتعليمات', 'Manage operational documents across policy, SOP, workflow, checklist, form, guideline, and instruction')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Top Bar: Search, Filters, Upload */}
          <div className="space-y-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={tr('البحث في الوثائق...', 'Search documents...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleRunLifecycle} disabled={isRunningLifecycle}>
                  {isRunningLifecycle ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {tr('جاري التشغيل...', 'Running...')}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {tr('تشغيل دورة الحياة', 'Run Lifecycle Now')}
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleRunIntegrityForFilters} disabled={isRunningIntegrity}>
                  {isRunningIntegrity ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {tr('جاري التشغيل...', 'Running...')}
                    </>
                  ) : (
                    <>
                      <AlertCircle className="mr-2 h-4 w-4" />
                      {tr('تشغيل التكامل', 'Run Integrity')}
                    </>
                  )}
                </Button>
                <Button onClick={() => setIsUploadDialogOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  {tr('رفع', 'Upload')}
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <Select 
                value={selectedDepartmentIds.length > 0 ? selectedDepartmentIds[0] : 'all'} 
                onValueChange={(v) => {
                  if (v === 'all') {
                    setSelectedDepartmentIds([]);
                    return;
                  }
                  if (v) {
                    setSelectedDepartmentIds([v]);
                  } else {
                    setSelectedDepartmentIds([]);
                  }
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={tr('القسم', 'Department')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr('جميع الأقسام', 'All Departments')}</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedScope} onValueChange={setSelectedScope}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={tr('النطاق', 'Scope')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr('جميع النطاقات', 'All Scopes')}</SelectItem>
                  <SelectItem value="enterprise">{tr('مؤسسي', 'Enterprise')}</SelectItem>
                  <SelectItem value="shared">{tr('مشترك', 'Shared')}</SelectItem>
                  <SelectItem value="department">{tr('قسم', 'Department')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedEntityType} onValueChange={setSelectedEntityType}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={tr('النوع', 'Type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr('جميع الأنواع', 'All Types')}</SelectItem>
                  <SelectItem value="policy">{tr('سياسة', 'Policy')}</SelectItem>
                  <SelectItem value="sop">{tr('إجراء تشغيلي', 'SOP')}</SelectItem>
                  <SelectItem value="workflow">{tr('سير عمل', 'Workflow')}</SelectItem>
                  <SelectItem value="checklist">{tr('قائمة مرجعية', 'Checklist')}</SelectItem>
                  <SelectItem value="form">{tr('نموذج', 'Form')}</SelectItem>
                  <SelectItem value="guideline">{tr('إرشاد', 'Guideline')}</SelectItem>
                  <SelectItem value="instruction">{tr('تعليمات', 'Instruction')}</SelectItem>
                  <SelectItem value="playbook">{tr('دليل تشغيل', 'Playbook')}</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-archived"
                  checked={includeArchived}
                  onCheckedChange={(checked) => setIncludeArchived(Boolean(checked))}
                />
                <Label htmlFor="include-archived" className="text-sm font-normal cursor-pointer">
                  {tr('عرض المؤرشف', 'Show archived')}
                </Label>
              </div>

              <Select value={selectedTagsStatus} onValueChange={setSelectedTagsStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={tr('حالة العلامات', 'Tags Status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr('الكل', 'All')}</SelectItem>
                  <SelectItem value="auto-approved">{tr('موافق تلقائياً', 'Auto-approved')}</SelectItem>
                  <SelectItem value="needs-review">{tr('يحتاج مراجعة', 'Needs Review')}</SelectItem>
                  <SelectItem value="approved">{tr('موافق عليه', 'Approved')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedExpiryStatus} onValueChange={setSelectedExpiryStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={tr('الانتهاء', 'Expiry')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr('الكل', 'All')}</SelectItem>
                  <SelectItem value="valid">{tr('صالح', 'Valid')}</SelectItem>
                  <SelectItem value="expiringSoon">{tr('ينتهي قريباً', 'Expiring Soon')}</SelectItem>
                  <SelectItem value="expired">{tr('منتهي', 'Expired')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedLifecycleStatus} onValueChange={setSelectedLifecycleStatus}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder={tr('حالة دورة الحياة', 'Lifecycle Status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr('الكل', 'All')}</SelectItem>
                  <SelectItem value="ACTIVE">{tr('نشط', 'Active')}</SelectItem>
                  <SelectItem value="UNDER_REVIEW">{tr('قيد المراجعة', 'Under Review')}</SelectItem>
                  <SelectItem value="EXPIRING_SOON">{tr('ينتهي قريباً', 'Expiring Soon')}</SelectItem>
                  <SelectItem value="EXPIRED">{tr('منتهي', 'Expired')}</SelectItem>
                  <SelectItem value="ARCHIVED">{tr('مؤرشف', 'Archived')}</SelectItem>
                </SelectContent>
              </Select>

              {(selectedDepartmentIds.length > 0 ||
                selectedScope !== 'all' ||
                selectedEntityType !== 'all' ||
                selectedTagsStatus !== 'all' ||
                selectedExpiryStatus !== 'all' ||
                selectedLifecycleStatus !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedDepartmentIds([]);
                    setSelectedScope('all');
                    setSelectedEntityType('all');
                    setSelectedTagsStatus('all');
                    setSelectedExpiryStatus('all');
                    setSelectedLifecycleStatus('all');
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  {tr('مسح', 'Clear')}
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm text-muted-foreground">{tr('التشغيلي:', 'Operational:')}</div>
              <Button
                variant={operationalFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setOperationalFilter('all')}
              >
                {tr('الكل', 'All')}
              </Button>
              <Button
                variant={operationalFilter === 'mapped' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setOperationalFilter('mapped')}
              >
                {tr('مرتبط', 'Mapped')}
              </Button>
              <Button
                variant={operationalFilter === 'needs_review' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setOperationalFilter('needs_review')}
              >
                {tr('يحتاج مراجعة', 'Needs review')}
              </Button>
              <Button
                variant={operationalFilter === 'unmapped' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setOperationalFilter('unmapped')}
              >
                {tr('غير مرتبط', 'Unmapped')}
              </Button>
            </div>

            {/* Bulk Actions */}
            {selectedItems.size > 0 && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <span className="text-sm">{selectedItems.size} {tr('محدد', 'selected')}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('archive')}
                >
                  {tr('أرشفة', 'Archive')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRunIntegrity(Array.from(selectedItems))}
                  disabled={isRunningIntegrity}
                >
                  {isRunningIntegrity ? tr('جاري التشغيل...', 'Running...') : tr('تشغيل التكامل', 'Run Integrity')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('delete')}
                >
                  {tr('حذف', 'Delete')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReassignDepartmentIds([]);
                    setIsReassignDialogOpen(true);
                  }}
                >
                  {tr('إعادة تعيين الأقسام', 'Reassign Departments')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('mark-global')}
                >
                  {tr('تعيين كمؤسسي', 'Mark Global')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('mark-shared')}
                >
                  {tr('تعيين كمشترك', 'Mark Shared')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedItems(new Set())}
                >
                  {tr('مسح التحديد', 'Clear Selection')}
                </Button>
              </div>
            )}
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {tr('لا توجد عناصر', 'No items found')}
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedItems.size === visibleItems.length && visibleItems.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedItems(new Set(visibleItems.map(item => item.theaEngineId)));
                          } else {
                            setSelectedItems(new Set());
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>{tr('العنوان/اسم الملف', 'Title/Filename')}</TableHead>
                    <TableHead>{tr('القسم(الأقسام)', 'Department(s)')}</TableHead>
                    <TableHead>{tr('النطاق', 'Scope')}</TableHead>
                    <TableHead>{tr('النوع', 'Type')}</TableHead>
                    <TableHead>{tr('دورة الحياة', 'Lifecycle')}</TableHead>
                    <TableHead>{tr('الحالة التشغيلية', 'Operational Status')}</TableHead>
                    <TableHead>{tr('التكامل', 'Integrity')}</TableHead>
                    <TableHead>{tr('الفهرسة', 'Indexed')}</TableHead>
                    <TableHead>{tr('الانتهاء', 'Expiry')}</TableHead>
                    <TableHead>{tr('الإجراءات', 'Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleItems.map((item) => (
                    <TableRow key={item.theaEngineId}>
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.has(item.theaEngineId)}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedItems);
                            if (checked) {
                              newSet.add(item.theaEngineId);
                            } else {
                              newSet.delete(item.theaEngineId);
                            }
                            setSelectedItems(newSet);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getEntityIcon(item.metadata.entityType)}
                          <span className="font-medium">{item.metadata.title || item.filename}</span>
                          {item.metadata.tagsStatus === 'needs-review' && (
                            <Badge variant="outline" className="bg-yellow-100">{tr('مراجعة', 'Review')}</Badge>
                          )}
                          {item.taskCount && item.taskCount > 0 && (
                            <Badge variant="secondary">
                              {tr('مهام', 'Tasks')} ({item.taskCount})
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.metadata.departmentIds.length > 0 ? (
                          getDepartmentNames(item.metadata.departmentIds)
                        ) : (
                          <span className="text-muted-foreground">{tr('غير مصنف', 'Unclassified')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.metadata.scope || 'enterprise'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{formatEntityTypeLabel(item.metadata.entityType)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getLifecycleBadge(item.metadata.lifecycleStatus)}
                          {getLifecycleHelperText(item.metadata) && (
                            <div className="text-xs text-muted-foreground">
                              {getLifecycleHelperText(item.metadata)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const status = getOperationalStatus(item);
                          if (status === 'MAPPED') return <Badge variant="secondary">{tr('مرتبط', 'Mapped')}</Badge>;
                          if (status === 'NEEDS_REVIEW') return <Badge variant="outline">{tr('يحتاج مراجعة', 'Needs review')}</Badge>;
                          return <Badge variant="destructive">{tr('غير مرتبط', 'Unmapped')}</Badge>;
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {item.metadata.integrityRunStatus ? (
                            <Badge variant="outline">
                              {item.metadata.integrityRunStatus === 'RUNNING' ? tr('جاري التشغيل', 'Running') : tr('في الانتظار', 'Queued')}
                            </Badge>
                          ) : (
                            <Badge variant={item.metadata.integrityOpenCount ? 'destructive' : 'secondary'}>
                              {item.metadata.integrityOpenCount || 0} {tr('مفتوحة', 'open')}
                            </Badge>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {item.metadata.integrityLastRunAt
                              ? new Date(item.metadata.integrityLastRunAt).toLocaleDateString()
                              : tr('لم يتم التحليل', 'Not analyzed')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.status === 'READY' ? (
                          <Badge variant="default">{tr('جاهز', 'Ready')}</Badge>
                        ) : item.status === 'PROCESSING' ? (
                          <Badge variant="secondary">{tr('قيد المعالجة', 'Processing')}</Badge>
                        ) : (
                          <Badge variant="outline">{item.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.metadata.expiryDate ? (
                          new Date(item.metadata.expiryDate).toLocaleDateString()
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleView(item.theaEngineId)}>
                                <Eye className="mr-2 h-4 w-4" />
                                {tr('عرض', 'View')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditMetadata(item)}>
                                <Edit className="mr-2 h-4 w-4" />
                                {tr('تعديل البيانات الوصفية', 'Edit Metadata')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openAssignOperationDialog(item)}>
                                {tr('تعيين عملية', 'Assign Operation')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openMappingDialog(item)}>
                                {tr('إصلاح التخطيط', 'Fix Mapping')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRunIntegrity([item.theaEngineId])}>
                                {tr('تشغيل التكامل', 'Run Integrity')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleArchive(item.theaEngineId, item.metadata.lifecycleStatus === 'ARCHIVED')}
                              >
                                <Archive className="mr-2 h-4 w-4" />
                                {item.metadata.lifecycleStatus === 'ARCHIVED' ? tr('إلغاء الأرشفة', 'Unarchive') : tr('أرشفة', 'Archive')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(item.theaEngineId)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {tr('حذف', 'Delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                {tr(`صفحة ${page} من ${totalPages} (${total} إجمالي)`, `Page ${page} of ${totalPages} (${total} total)`)}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  {tr('السابق', 'Previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  {tr('التالي', 'Next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <LibraryUploadDialog
        open={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
        onSuccess={() => {
          setIsUploadDialogOpen(false);
          fetchItems();
        }}
      />

      {/* Metadata Drawer */}
      {editingItem && (
        <LibraryMetadataDrawer
          open={isMetadataDrawerOpen}
          onClose={() => {
            setIsMetadataDrawerOpen(false);
            setEditingItem(null);
          }}
          theaEngineId={editingItem.theaEngineId}
          initialMetadata={editingItem.metadata}
          tasksRefreshToken={taskRefreshToken}
          onTasksUpdated={(documentId, count) => {
            setItems((prev) =>
              prev.map((item) =>
                item.theaEngineId === documentId
                  ? { ...item, taskCount: count }
                  : item
              )
            );
          }}
          onSuccess={() => {
            setIsMetadataDrawerOpen(false);
            setEditingItem(null);
            fetchItems();
          }}
        />
      )}

      {/* Operational Mapping Dialog */}
      <Dialog
        open={isMappingDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsMappingDialogOpen(false);
            setMappingItem(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{tr('التخطيط التشغيلي', 'Operational Mapping')}</DialogTitle>
            <DialogDescription>
              {tr('تحديث العمليات والوظائف ومجالات المخاطر لهذه الوثيقة.', 'Update operations, function, and risk domains for this document.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {mappingConfidence && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="font-medium">{tr('درجة الثقة', 'Confidence')}</div>
                <div className="text-muted-foreground">
                  {tr('العمليات', 'Operations')}: {mappingConfidence.operations ?? '—'} • {tr('الوظيفة', 'Function')}: {mappingConfidence.function ?? '—'} • {tr('مجالات المخاطر', 'Risk Domains')}: {mappingConfidence.riskDomains ?? '—'}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>{tr('العمليات', 'Operations')}</Label>
              <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-2">
                {operationsCatalog.length === 0 && (
                  <div className="text-sm text-muted-foreground">{tr('لا توجد عمليات متاحة', 'No operations available')}</div>
                )}
                {operationsCatalog.map((op) => (
                  <div key={op.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={mappingOperations.includes(op.id)}
                      onCheckedChange={(checked) => {
                        setMappingOperations((prev) =>
                          checked
                            ? Array.from(new Set([...prev, op.id]))
                            : prev.filter((id) => id !== op.id)
                        );
                      }}
                    />
                    <span className="text-sm">{op.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{tr('الوظيفة', 'Function')}</Label>
              <Select
                value={mappingFunction || 'none'}
                onValueChange={(v) => setMappingFunction(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tr('اختر الوظيفة', 'Select function')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tr('لا توجد وظيفة', 'No function')}</SelectItem>
                  {functionsCatalog.map((fn) => (
                    <SelectItem key={fn.id} value={fn.id}>
                      {fn.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tr('مجالات المخاطر', 'Risk Domains')}</Label>
              <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-2">
                {riskDomainsCatalog.length === 0 && (
                  <div className="text-sm text-muted-foreground">{tr('لا توجد مجالات مخاطر متاحة', 'No risk domains available')}</div>
                )}
                {riskDomainsCatalog.map((rd) => (
                  <div key={rd.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={mappingRiskDomains.includes(rd.id)}
                      onCheckedChange={(checked) => {
                        setMappingRiskDomains((prev) =>
                          checked
                            ? Array.from(new Set([...prev, rd.id]))
                            : prev.filter((id) => id !== rd.id)
                        );
                      }}
                    />
                    <span className="text-sm">{rd.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={mappingNeedsReview}
                onCheckedChange={(checked) => setMappingNeedsReview(Boolean(checked))}
              />
              <span className="text-sm">{tr('يحتاج مراجعة', 'Needs review')}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMappingDialogOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={handleSaveMapping} disabled={isSavingMapping}>
              {isSavingMapping ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tr('جاري الحفظ...', 'Saving...')}
                </>
              ) : (
                tr('حفظ', 'Save')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Operation Dialog */}
      <Dialog
        open={isAssignOperationOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAssignOperationOpen(false);
            setAssigningItem(null);
            setSelectedOperationId('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('تعيين عملية', 'Assign Operation')}</DialogTitle>
            <DialogDescription>{tr('اختر عملية لهذه الوثيقة.', 'Select an operation for this document.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{tr('العملية', 'Operation')}</Label>
            <Select value={selectedOperationId} onValueChange={setSelectedOperationId}>
              <SelectTrigger>
                <SelectValue placeholder={tr('اختر العملية', 'Select operation')} />
              </SelectTrigger>
              <SelectContent>
                {operationsCatalog.length === 0 && (
                  <SelectItem value="__no_ops__" disabled>
                    {tr('لا توجد عمليات متاحة', 'No operations available')}
                  </SelectItem>
                )}
                {operationsCatalog.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignOperationOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={handleAssignOperation} disabled={!selectedOperationId}>
              {tr('حفظ', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Departments Dialog */}
      <Dialog
        open={isReassignDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsReassignDialogOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('إعادة تعيين الأقسام', 'Reassign Departments')}</DialogTitle>
            <DialogDescription>
              {tr('اختر الأقسام لتعيينها للوثائق المحددة.', 'Select departments to assign to the selected documents.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{tr('الأقسام', 'Departments')}</Label>
            <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-2">
              {departments.length === 0 && (
                <div className="text-sm text-muted-foreground">{tr('لا توجد أقسام متاحة', 'No departments available')}</div>
              )}
              {departments.map((dept) => (
                <div key={dept.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={reassignDepartmentIds.includes(dept.id)}
                    onCheckedChange={(checked) => {
                      setReassignDepartmentIds((prev) =>
                        checked
                          ? Array.from(new Set([...prev, dept.id]))
                          : prev.filter((id) => id !== dept.id)
                      );
                    }}
                  />
                  <span className="text-sm">{dept.name}</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReassignDialogOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button
              onClick={() => {
                handleBulkAction('reassign-departments', { departmentIds: reassignDepartmentIds });
                setIsReassignDialogOpen(false);
              }}
              disabled={reassignDepartmentIds.length === 0}
            >
              {tr('حفظ', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
