/**
 * Organizational Structure Management Page — Thea UI
 *
 * UI for managing organizational structure with drag & drop
 */

'use client';

import { useState, useEffect, Dispatch, SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Trash2, Edit, GripVertical, Building2, Settings, Shield, AlertTriangle, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { useConfirm } from '@/components/ui/confirm-modal';

interface OrgNode {
  id: string;
  type: 'department' | 'unit' | 'floor' | 'room' | 'line' | 'section' | 'committee' | 'custom' | 'operation' | 'function' | 'risk-domain';
  name: string;
  code?: string;
  description?: string;
  parentId?: string;
  level: number;
  path: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  children?: OrgNode[]; // For tree structure
}

interface TaxonomyItem {
  id: string;
  name: string;
  code?: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export default function StructureManagement() {
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { confirm } = useConfirm();
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [allFloors, setAllFloors] = useState<any[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(new Set());
  const [selectedFloors, setSelectedFloors] = useState<Set<string>>(new Set());
  const [operations, setOperations] = useState<TaxonomyItem[]>([]);
  const [functions, setFunctions] = useState<TaxonomyItem[]>([]);
  const [riskDomains, setRiskDomains] = useState<TaxonomyItem[]>([]);
  const [entityTypes, setEntityTypes] = useState<TaxonomyItem[]>([]);
  const [scopes, setScopes] = useState<TaxonomyItem[]>([]);
  const [sectors, setSectors] = useState<TaxonomyItem[]>([]);
  const [selectedOperations, setSelectedOperations] = useState<Set<string>>(new Set());
  const [selectedFunctions, setSelectedFunctions] = useState<Set<string>>(new Set());
  const [selectedRiskDomains, setSelectedRiskDomains] = useState<Set<string>>(new Set());
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<Set<string>>(new Set());
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAllDepts, setIsLoadingAllDepts] = useState(false);
  const [isLoadingAllFloors, setIsLoadingAllFloors] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingTaxonomy, setIsDeletingTaxonomy] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<OrgNode | null>(null);
  const [editingTaxonomy, setEditingTaxonomy] = useState<{ type: 'operation' | 'function' | 'risk-domain' | 'entity-type' | 'scope' | 'sector'; item: TaxonomyItem | null }>({ type: 'operation', item: null });
  const [activeTab, setActiveTab] = useState<'structure' | 'operations' | 'functions' | 'risk-domains' | 'entity-types' | 'scopes' | 'sectors' | 'all-departments' | 'rooms' | 'floors' | 'units' | 'all-floors'>('structure');
  const [formData, setFormData] = useState({
    type: 'department' as OrgNode['type'],
    name: '',
    code: '',
    description: '',
    parentId: '',
  });
  const [taxonomyFormData, setTaxonomyFormData] = useState({
    name: '',
    code: '',
    description: '',
  });

  useEffect(() => {
    const loadAllData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchNodes(),
          fetchOperations(),
          fetchFunctions(),
          fetchRiskDomains(),
          fetchEntityTypes(),
          fetchScopes(),
          fetchSectors(),
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    loadAllData();
  }, []);

  useEffect(() => {
    if (activeTab === 'all-departments') {
      fetchAllDepartments();
    } else if (activeTab === 'all-floors') {
      fetchAllFloors();
    }
  }, [activeTab]);

  async function fetchNodes() {
    try {
      console.log('[StructureManagement] Fetching org nodes from /api/structure/org');
      const response = await fetch('/api/structure/org', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[StructureManagement] Fetched ${data.nodes?.length || 0} org nodes`);
        setNodes(data.nodes || []);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error(`[StructureManagement] Failed to fetch nodes: status ${response.status}`, errorData);
        throw new Error(errorData.error || 'Failed to fetch nodes');
      }
    } catch (error) {
      console.error('[StructureManagement] Exception fetching nodes:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('فشل تحميل الهيكل التنظيمي', 'Failed to load organizational structure'),
        variant: 'destructive',
      });
    }
  }

  async function fetchAllFloors() {
    setIsLoadingAllFloors(true);
    try {
      console.log('[StructureManagement] Fetching ALL floors (including deleted)');

      // Fetch from floors collection (including deleted/inactive)
      const floorsResponse = await fetch('/api/structure/floors?includeDeleted=true', {
        credentials: 'include',
      });
      let floors: any[] = [];
      if (floorsResponse.ok) {
        const floorsData = await floorsResponse.json();
        floors = (floorsData.data || [])
          .map((f: any) => ({
            id: f.id,
            name: f.label_en || f.name,
            code: f.key || f.code,
            number: f.number,
            label_en: f.label_en,
            label_ar: f.label_ar,
            source: 'floors',
            isActive: f.active !== false,
            deletedAt: f.deletedAt,
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
          }));
      }

      // Also fetch from org_nodes (if any floors exist there)
      try {
        const orgResponse = await fetch('/api/structure/org', {
          credentials: 'include',
        });
        if (orgResponse.ok) {
          const orgData = await orgResponse.json();
          const orgFloors = (orgData.nodes || [])
            .filter((n: any) => n.type === 'floor')
            .map((n: any) => ({
              id: n.id,
              name: n.name,
              code: n.code,
              number: n.number,
              label_en: n.name,
              label_ar: n.name,
              source: 'org_nodes',
              isActive: n.isActive !== false,
              deletedAt: n.deletedAt,
              createdAt: n.createdAt,
              updatedAt: n.updatedAt,
            }));

          // Merge and deduplicate (prefer org_nodes)
          const floorsMap = new Map<string, any>();
          floors.forEach(f => {
            if (!floorsMap.has(f.id)) {
              floorsMap.set(f.id, f);
            }
          });
          orgFloors.forEach(f => {
            floorsMap.set(f.id, f); // Overwrite with org_nodes (preferred source)
          });

          floors = Array.from(floorsMap.values());
        }
      } catch (orgError) {
        // Ignore - continue with floors collection only
      }

      console.log(`[StructureManagement] Fetched ${floors.length} total floors`);
      setAllFloors(floors);
    } catch (error) {
      console.error('[StructureManagement] Error fetching all floors:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('فشل تحميل جميع الطوابق', 'Failed to load all floors'),
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAllFloors(false);
    }
  }

  async function fetchAllDepartments() {
    setIsLoadingAllDepts(true);
    try {
      console.log('[StructureManagement] Fetching ALL departments (including deleted)');

        // Fetch from org_nodes (including deleted/inactive)
        // CRITICAL: Fetch ALL nodes, not just deleted ones, to show all departments
        const orgResponse = await fetch('/api/structure/org', {
          credentials: 'include',
        });
        let orgDepts: any[] = [];
        if (orgResponse.ok) {
          const orgData = await orgResponse.json();
          // Get all departments from org_nodes (active and inactive)
          orgDepts = (orgData.nodes || [])
            .filter((n: any) => n.type === 'department')
            .map((n: any) => ({
              id: n.id,
              name: n.name,
              code: n.code,
              source: 'org_nodes',
              isActive: n.isActive !== false,
              deletedAt: n.deletedAt,
              createdAt: n.createdAt,
              updatedAt: n.updatedAt,
            }));
        }

        // Also fetch from includeDeleted=true to get truly deleted ones
        try {
          const orgDeletedResponse = await fetch('/api/structure/org?includeDeleted=true', {
            credentials: 'include',
          });
          if (orgDeletedResponse.ok) {
            const orgDeletedData = await orgDeletedResponse.json();
            const deletedDepts = (orgDeletedData.nodes || [])
              .filter((n: any) => n.type === 'department' && n.deletedAt)
              .map((n: any) => ({
                id: n.id,
                name: n.name,
                code: n.code,
                source: 'org_nodes',
                isActive: false,
                deletedAt: n.deletedAt,
                createdAt: n.createdAt,
                updatedAt: n.updatedAt,
              }));

            // Merge with existing, avoiding duplicates
            const existingIds = new Set(orgDepts.map(d => d.id));
            const newDeleted = deletedDepts.filter(d => !existingIds.has(d.id));
            orgDepts = [...orgDepts, ...newDeleted];
          }
        } catch (error) {
          // Ignore error - continue with normal fetch
        }

      // Fetch from floor_departments (including deleted/inactive)
      const floorResponse = await fetch('/api/structure/departments?includeDeleted=true', {
        credentials: 'include',
      });
      let floorDepts: any[] = [];
      if (floorResponse.ok) {
        const floorData = await floorResponse.json();
        floorDepts = (floorData.data || [])
          .map((d: any) => ({
            id: d.id || d.departmentId,
            name: d.label_en || d.name || d.departmentName,
            code: d.departmentKey || d.code,
            source: 'floor_departments',
            isActive: d.active !== false,
            deletedAt: d.deletedAt,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          }));
      }

      // Merge and deduplicate (prefer org_nodes)
      const allDeptsMap = new Map<string, any>();
      floorDepts.forEach(d => {
        if (!allDeptsMap.has(d.id)) {
          allDeptsMap.set(d.id, d);
        }
      });
      orgDepts.forEach(d => {
        allDeptsMap.set(d.id, d); // Overwrite with org_nodes (preferred source)
      });

      const allDepts = Array.from(allDeptsMap.values());
      console.log(`[StructureManagement] Fetched ${allDepts.length} total departments (${orgDepts.length} from org_nodes, ${floorDepts.length} from floor_departments)`);
      setAllDepartments(allDepts);
    } catch (error) {
      console.error('[StructureManagement] Error fetching all departments:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('فشل تحميل جميع الأقسام', 'Failed to load all departments'),
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAllDepts(false);
    }
  }

  async function fetchOperations() {
    try {
      const response = await fetch('/api/taxonomy/operations', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setOperations(data.data || []);
        setSelectedOperations(new Set());
      }
    } catch (error) {
      console.error('[StructureManagement] Error fetching operations:', error);
    }
  }

  async function fetchFunctions() {
    try {
      const response = await fetch('/api/taxonomy/functions', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setFunctions(data.data || []);
        setSelectedFunctions(new Set());
      }
    } catch (error) {
      console.error('[StructureManagement] Error fetching functions:', error);
    }
  }

  async function fetchRiskDomains() {
    try {
      const response = await fetch('/api/taxonomy/risk-domains', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setRiskDomains(data.data || []);
        setSelectedRiskDomains(new Set());
      }
    } catch (error) {
      console.error('[StructureManagement] Error fetching risk domains:', error);
    }
  }

  async function fetchEntityTypes() {
    try {
      const response = await fetch('/api/taxonomy/entity-types', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setEntityTypes(data.data || []);
        setSelectedEntityTypes(new Set());
      }
    } catch (error) {
      console.error('[StructureManagement] Error fetching entity types:', error);
    }
  }

  async function fetchScopes() {
    try {
      const response = await fetch('/api/taxonomy/scopes', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setScopes(data.data || []);
        setSelectedScopes(new Set());
      }
    } catch (error) {
      console.error('[StructureManagement] Error fetching scopes:', error);
    }
  }

  async function fetchSectors() {
    try {
      const response = await fetch('/api/taxonomy/sectors', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setSectors(data.data || []);
        setSelectedSectors(new Set());
      }
    } catch (error) {
      console.error('[StructureManagement] Error fetching sectors:', error);
    }
  }

  async function handleCreate() {
    try {
      const response = await fetch('/api/structure/org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          parentId: formData.parentId || undefined,
        }),
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: tr('نجاح', 'Success'),
          description: tr('تم إنشاء العقدة بنجاح', 'Node created successfully'),
        });
        setIsDialogOpen(false);
        setFormData({
          type: 'department',
          name: '',
          code: '',
          description: '',
          parentId: '',
        });

        // Refresh nodes to show in Structure tab
        await fetchNodes();

        // Also refresh relevant tab based on node type
        if (formData.type === 'department') {
          await fetchAllDepartments();
          setActiveTab('all-departments');
        } else if (formData.type === 'room') {
          setActiveTab('rooms');
        } else if (formData.type === 'floor') {
          setActiveTab('floors');
        } else if (formData.type === 'unit') {
          setActiveTab('units');
        } else if (formData.type === 'operation') {
          await fetchOperations();
          setActiveTab('operations');
        } else if (formData.type === 'function') {
          await fetchFunctions();
          setActiveTab('functions');
        } else if (formData.type === 'risk-domain') {
          await fetchRiskDomains();
          setActiveTab('risk-domains');
        } else {
          // For other types, stay on Structure tab
          setActiveTab('structure');
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create node');
      }
    } catch (error) {
      console.error('Failed to create node:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : 'Failed to create node',
        variant: 'destructive',
      });
    }
  }

  async function handleDelete(nodeId: string, forceDelete: boolean = false) {
    const node = nodes.find(n => n.id === nodeId);
    const nodeName = node?.name || 'this node';

    const confirmMessage = forceDelete
      ? tr(`تحذير: حذف قسري: هل أنت متأكد من حذف "${nodeName}" نهائياً؟ سيتم حذف جميع البيانات المرتبطة.`, `WARNING: Force delete: Are you sure you want to permanently delete "${nodeName}"? This will delete all associated data.`)
      : tr(`هل أنت متأكد من حذف "${nodeName}"؟`, `Are you sure you want to delete "${nodeName}"?`);

    if (!(await confirm(confirmMessage))) {
      return;
    }

    try {
      const response = await fetch(`/api/structure/org/${nodeId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ forceDelete }),
      });

      if (response.ok) {
        toast({
          title: tr('نجاح', 'Success'),
          description: tr('تم حذف العقدة بنجاح', 'Node deleted successfully'),
        });
        await fetchNodes();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete node');
      }
    } catch (error) {
      console.error('Failed to delete node:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : 'Failed to delete node',
        variant: 'destructive',
      });
    }
  }

  function getNodeTypeColor(type: OrgNode['type']): string {
    const colors: Record<OrgNode['type'], string> = {
      department: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      unit: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      floor: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      room: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      line: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      section: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      committee: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      custom: 'bg-muted text-foreground',
      operation: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
      function: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
      'risk-domain': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return colors[type] || colors.custom;
  }

  function buildTree(nodes: OrgNode[]): OrgNode[] {
    const nodeMap = new Map<string, OrgNode>();
    const rootNodes: OrgNode[] = [];

    // Create map of all nodes
    nodes.forEach(node => {
      nodeMap.set(node.id, { ...node, children: [] });
    });

    // Build tree
    nodes.forEach(node => {
      const nodeWithChildren = nodeMap.get(node.id)!;
      if (node.parentId) {
        const parent = nodeMap.get(node.parentId);
        if (parent) {
          if (!parent.children) parent.children = [];
          parent.children.push(nodeWithChildren);
        }
      } else {
        rootNodes.push(nodeWithChildren);
      }
    });

    return rootNodes;
  }

  function renderNode(node: OrgNode & { children?: OrgNode[] }, level: number = 0) {
    return (
      <div key={node.id} className="ml-4">
        <div className="flex items-center gap-2 p-2 rounded-xl hover:bg-muted thea-hover-lift thea-transition-fast">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${getNodeTypeColor(node.type)}`}>{node.type}</span>
          <span className="font-medium">{node.name}</span>
          {node.code && (
            <span className="text-sm text-muted-foreground">({node.code})</span>
          )}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl"
            onClick={() => {
              setEditingNode(node);
              setFormData({
                type: node.type,
                name: node.name,
                code: node.code || '',
                description: node.description || '',
                parentId: node.parentId || '',
              });
              setIsDialogOpen(true);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl"
            onClick={() => handleDelete(node.id, false)}
            title="Delete node"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {(
            node.name.toLowerCase().includes('emergency') ||
            node.name.toLowerCase().includes('quality') ||
            node.name.toLowerCase().includes('surgery') ||
            node.name.toLowerCase() === 'surg' ||
            node.name.toLowerCase() === 'er' ||
            node.name.toLowerCase() === 'ed'
          ) && (
            <Button
              variant="destructive"
              size="sm"
              className="rounded-xl"
              onClick={() => handleDelete(node.id, true)}
              title="Force delete (bypass data checks)"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        {node.children && node.children.length > 0 && (
          <div className="ml-4">
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  }

  async function handleCreateTaxonomy(type: 'operation' | 'function' | 'risk-domain' | 'entity-type' | 'scope' | 'sector') {
    try {
      const endpoint = `/api/taxonomy/${type === 'risk-domain' ? 'risk-domains' : type === 'entity-type' ? 'entity-types' : `${type}s`}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taxonomyFormData),
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: tr('نجاح', 'Success'),
          description: `${type.charAt(0).toUpperCase() + type.slice(1)} created successfully`,
        });
        setIsDialogOpen(false);
        setTaxonomyFormData({ name: '', code: '', description: '' });
        if (type === 'operation') await fetchOperations();
        else if (type === 'function') await fetchFunctions();
        else if (type === 'risk-domain') await fetchRiskDomains();
        else if (type === 'entity-type') await fetchEntityTypes();
        else if (type === 'scope') await fetchScopes();
        else await fetchSectors();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create');
      }
    } catch (error) {
      console.error(`Failed to create ${type}:`, error);
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : 'Failed to create',
        variant: 'destructive',
      });
    }
  }

  async function handleDeleteTaxonomy(type: 'operation' | 'function' | 'risk-domain' | 'entity-type' | 'scope' | 'sector', id: string) {
    const itemName = type === 'risk-domain'
      ? 'risk domain'
      : type === 'entity-type'
      ? 'entity type'
      : type;
    if (!(await confirm(tr(`هل أنت متأكد من حذف هذا ${itemName}؟`, `Are you sure you want to delete this ${itemName}?`)))) {
      return;
    }

    try {
      const endpoint = `/api/taxonomy/${type === 'risk-domain' ? 'risk-domains' : type === 'entity-type' ? 'entity-types' : `${type}s`}/${id}`;
      const response = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: tr('نجاح', 'Success'),
          description: `${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`,
        });
        if (type === 'operation') await fetchOperations();
        else if (type === 'function') await fetchFunctions();
        else if (type === 'risk-domain') await fetchRiskDomains();
        else if (type === 'entity-type') await fetchEntityTypes();
        else if (type === 'scope') await fetchScopes();
        else await fetchSectors();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete');
      }
    } catch (error) {
      console.error(`Failed to delete ${type}:`, error);
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : 'Failed to delete',
        variant: 'destructive',
      });
    }
  }

  function toggleSelection(
    setter: Dispatch<SetStateAction<Set<string>>>,
    id: string
  ) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll(type: 'operation' | 'function' | 'risk-domain' | 'entity-type' | 'scope' | 'sector') {
    if (type === 'operation') {
      if (selectedOperations.size === operations.length) {
        setSelectedOperations(new Set());
      } else {
        setSelectedOperations(new Set(operations.map((op) => op.id)));
      }
    } else if (type === 'function') {
      if (selectedFunctions.size === functions.length) {
        setSelectedFunctions(new Set());
      } else {
        setSelectedFunctions(new Set(functions.map((fn) => fn.id)));
      }
    } else if (type === 'risk-domain') {
      if (selectedRiskDomains.size === riskDomains.length) {
        setSelectedRiskDomains(new Set());
      } else {
        setSelectedRiskDomains(new Set(riskDomains.map((rd) => rd.id)));
      }
    } else if (type === 'entity-type') {
      if (selectedEntityTypes.size === entityTypes.length) {
        setSelectedEntityTypes(new Set());
      } else {
        setSelectedEntityTypes(new Set(entityTypes.map((et) => et.id)));
      }
    } else if (type === 'scope') {
      if (selectedScopes.size === scopes.length) {
        setSelectedScopes(new Set());
      } else {
        setSelectedScopes(new Set(scopes.map((sc) => sc.id)));
      }
    } else {
      if (selectedSectors.size === sectors.length) {
        setSelectedSectors(new Set());
      } else {
        setSelectedSectors(new Set(sectors.map((sc) => sc.id)));
      }
    }
  }

  async function handleBulkDeleteTaxonomy(
    type: 'operation' | 'function' | 'risk-domain' | 'entity-type' | 'scope' | 'sector',
    ids: string[],
    deleteAll = false
  ) {
    if (ids.length === 0) return;
    const itemName = type === 'risk-domain'
      ? 'risk domains'
      : type === 'entity-type'
      ? 'entity types'
      : `${type}s`;
    const confirmMessage = deleteAll
      ? tr(`تحذير: هل أنت متأكد من حذف جميع ${itemName}؟ لا يمكن التراجع عن هذا الإجراء!`, `WARNING: Are you sure you want to delete ALL ${itemName}? This action cannot be undone!`)
      : tr(`هل أنت متأكد من حذف ${ids.length} ${itemName}؟`, `Are you sure you want to delete ${ids.length} ${itemName}?`);
    if (!(await confirm(confirmMessage))) {
      return;
    }
    setIsDeletingTaxonomy(true);
    try {
      const endpointBase = `/api/taxonomy/${type === 'risk-domain' ? 'risk-domains' : type === 'entity-type' ? 'entity-types' : `${type}s`}`;
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`${endpointBase}/${id}`, {
            method: 'DELETE',
            credentials: 'include',
          })
        )
      );
      const successCount = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
      const failureCount = results.length - successCount;
      toast({
        title: failureCount === 0 ? 'Success' : 'Partial Success',
        description: `Deleted ${successCount} ${itemName}${failureCount ? `, ${failureCount} failed` : ''}`,
        variant: failureCount === 0 ? 'default' : 'destructive',
      });
      if (type === 'operation') await fetchOperations();
      else if (type === 'function') await fetchFunctions();
      else if (type === 'risk-domain') await fetchRiskDomains();
      else if (type === 'entity-type') await fetchEntityTypes();
      else if (type === 'scope') await fetchScopes();
      else await fetchSectors();
    } catch (error) {
      console.error(`Failed to delete ${type}:`, error);
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : 'Failed to delete',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingTaxonomy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tree = buildTree(nodes);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{tr('إدارة الهيكل التنظيمي', 'Structure Management')}</h1>
          <p className="text-sm text-muted-foreground">
            Manage organizational structure, operations, functions, and risk domains
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl" onClick={() => {
              setEditingNode(null);
              setFormData({
                type: 'department',
                name: '',
                code: '',
                description: '',
                parentId: '',
              });
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Node
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingNode ? 'Edit Node' : 'Create New Node'}
              </DialogTitle>
              <DialogDescription>
                {editingNode
                  ? 'Update the organizational node details'
                  : 'Add a new organizational unit to the structure'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</span>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as OrgNode['type'] })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="department">Department</SelectItem>
                    <SelectItem value="unit">Unit</SelectItem>
                    <SelectItem value="floor">Floor</SelectItem>
                    <SelectItem value="room">Room</SelectItem>
                    <SelectItem value="line">Line</SelectItem>
                    <SelectItem value="section">Section</SelectItem>
                    <SelectItem value="committee">Committee</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</span>
                <Input
                  className="rounded-xl thea-input-focus"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter node name"
                />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Code (Optional)</span>
                <Input
                  className="rounded-xl thea-input-focus"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Enter code"
                />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description (Optional)</span>
                <Input
                  className="rounded-xl thea-input-focus"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter description"
                />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Parent Node (Optional)</span>
                <Select
                  value={formData.parentId || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, parentId: value === 'none' ? '' : value })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select parent node" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Root Level)</SelectItem>
                    {nodes.map((node) => (
                      <SelectItem key={node.id} value={node.id}>
                        {node.path} ({node.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="rounded-xl" onClick={handleCreate}>
                {editingNode ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="flex w-full items-center justify-start gap-2 overflow-x-auto whitespace-nowrap px-2 scroll-px-2">
          <TabsTrigger value="structure">
            <Building2 className="h-4 w-4 mr-2" />
            {tr('الهيكل', 'Structure')}
          </TabsTrigger>
          <TabsTrigger value="all-departments">
            <AlertTriangle className="h-4 w-4 mr-2" />
            {tr('جميع الأقسام', 'All Departments')}
          </TabsTrigger>
          <TabsTrigger value="all-floors">
            <AlertTriangle className="h-4 w-4 mr-2" />
            {tr('جميع الطوابق', 'All Floors')}
          </TabsTrigger>
          <TabsTrigger value="rooms">
            <Building2 className="h-4 w-4 mr-2" />
            {tr('الغرف', 'Rooms')}
          </TabsTrigger>
          <TabsTrigger value="floors">
            <Building2 className="h-4 w-4 mr-2" />
            {tr('الطوابق (عقد)', 'Floors (Nodes)')}
          </TabsTrigger>
          <TabsTrigger value="units">
            <Building2 className="h-4 w-4 mr-2" />
            {tr('الوحدات', 'Units')}
          </TabsTrigger>
          <TabsTrigger value="operations">
            <Settings className="h-4 w-4 mr-2" />
            {tr('العمليات', 'Operations')}
          </TabsTrigger>
          <TabsTrigger value="entity-types">
            <FileText className="h-4 w-4 mr-2" />
            {tr('أنواع الكيانات', 'Entity Types')}
          </TabsTrigger>
          <TabsTrigger value="scopes">
            <Shield className="h-4 w-4 mr-2" />
            {tr('النطاقات', 'Scopes')}
          </TabsTrigger>
          <TabsTrigger value="sectors">
            <Building2 className="h-4 w-4 mr-2" />
            {tr('القطاعات', 'Sectors')}
          </TabsTrigger>
          <TabsTrigger value="functions">
            <Settings className="h-4 w-4 mr-2" />
            {tr('الوظائف', 'Functions')}
          </TabsTrigger>
          <TabsTrigger value="risk-domains">
            <Shield className="h-4 w-4 mr-2" />
            {tr('مجالات المخاطر', 'Risk Domains')}
          </TabsTrigger>
        </TabsList>

        {/* Structure Tab */}
        <TabsContent value="structure" className="space-y-4">
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">{tr('شجرة الهيكل', 'Structure Tree')}</h2>
            <p className="text-sm text-muted-foreground">
              Hierarchical view of organizational structure
            </p>
            {tree.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No organizational nodes found. Create your first node to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {tree.map(node => renderNode(node))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* All Departments Tab */}
        <TabsContent value="all-departments" className="space-y-4">
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">All Departments (Including Deleted/Hidden)</h2>
                <p className="text-sm text-muted-foreground">
                  View all departments from all sources (org_nodes and floor_departments), including deleted or inactive ones
                </p>
              </div>
              {allDepartments.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => {
                      if (selectedDepartments.size === allDepartments.length) {
                        setSelectedDepartments(new Set());
                      } else {
                        setSelectedDepartments(new Set(allDepartments.map(d => d.id)));
                      }
                    }}
                  >
                    {selectedDepartments.size === allDepartments.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  {selectedDepartments.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="rounded-xl"
                      disabled={isDeleting}
                      onClick={async () => {
                        if (!(await confirm(tr(`هل أنت متأكد من حذف ${selectedDepartments.size} قسم/أقسام نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`, `Are you sure you want to permanently delete ${selectedDepartments.size} department(s)? This action cannot be undone.`)))) {
                          return;
                        }

                        setIsDeleting(true);
                        const selectedIds = Array.from(selectedDepartments);
                        let successCount = 0;
                        let failCount = 0;

                        for (const deptId of selectedIds) {
                          try {
                            // Delete from floor_departments
                            const floorResponse = await fetch(`/api/structure/departments/${deptId}`, {
                              method: 'DELETE',
                              credentials: 'include',
                            });

                            // Also try to delete from org_nodes (might not exist there)
                            try {
                              await fetch(`/api/structure/org/${deptId}`, {
                                method: 'DELETE',
                                credentials: 'include',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ forceDelete: true }),
                              });
                            } catch (orgError) {
                              // Ignore - might not exist in org_nodes
                            }

                            if (floorResponse.ok) {
                              successCount++;
                            } else {
                              failCount++;
                            }
                          } catch (error) {
                            console.error(`Error deleting department ${deptId}:`, error);
                            failCount++;
                          }
                        }

                        setIsDeleting(false);
                        setSelectedDepartments(new Set());

                        if (successCount > 0) {
                          toast({
                            title: tr('نجاح', 'Success'),
                            description: `Successfully deleted ${successCount} department(s)${failCount > 0 ? `. ${failCount} failed.` : ''}`,
                          });
                        } else {
                          toast({
                            title: tr('خطأ', 'Error'),
                            description: `Failed to delete ${failCount} department(s)`,
                            variant: 'destructive',
                          });
                        }

                        // Refresh list
                        await fetchAllDepartments();
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete Selected ({selectedDepartments.size})
                    </Button>
                  )}
                </div>
              )}
            </div>
            {isLoadingAllDepts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>{tr('جاري تحميل جميع الأقسام...', 'Loading all departments...')}</span>
              </div>
            ) : allDepartments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No departments found in any source.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground mb-4">
                  Found {allDepartments.length} department(s) total
                </div>
                <div className="space-y-2">
                  {allDepartments.map((dept) => (
                    <div
                      key={dept.id}
                      className={`flex items-center justify-between p-3 border border-border rounded-xl thea-hover-lift thea-transition-fast ${
                        selectedDepartments.has(dept.id)
                          ? 'bg-primary/10 border-primary'
                          : 'bg-card'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedDepartments.has(dept.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedDepartments);
                            if (e.target.checked) {
                              newSelected.add(dept.id);
                            } else {
                              newSelected.delete(dept.id);
                            }
                            setSelectedDepartments(newSelected);
                          }}
                          className="h-4 w-4"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{dept.name}</span>
                            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{dept.source}</span>
                          </div>
                          {dept.code && (
                            <div className="text-sm text-muted-foreground">Code: {dept.code}</div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            ID: {dept.id}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="rounded-xl"
                          disabled={isDeleting}
                          onClick={async () => {
                            if (!(await confirm(tr(`هل أنت متأكد من حذف "${dept.name}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`, `Are you sure you want to permanently delete "${dept.name}"? This action cannot be undone.`)))) {
                              return;
                            }

                            setIsDeleting(true);
                            try {
                              // Delete from floor_departments (HARD DELETE)
                              const floorResponse = await fetch(`/api/structure/departments/${dept.id}`, {
                                method: 'DELETE',
                                credentials: 'include',
                              });

                              if (!floorResponse.ok) {
                                const errorData = await floorResponse.json().catch(() => ({ error: 'Unknown error' }));
                                throw new Error(errorData.error || 'Failed to delete from floor_departments');
                              }

                              // Also try to delete from org_nodes (might not exist there)
                              try {
                                await fetch(`/api/structure/org/${dept.id}`, {
                                  method: 'DELETE',
                                  credentials: 'include',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ forceDelete: true }),
                                });
                              } catch (orgError) {
                                // Ignore - node might not exist in org_nodes
                              }

                              toast({
                                title: tr('نجاح', 'Success'),
                                description: `Department "${dept.name}" permanently deleted`,
                              });

                              // Remove from selection if selected
                              const newSelected = new Set(selectedDepartments);
                              newSelected.delete(dept.id);
                              setSelectedDepartments(newSelected);

                              // Refresh list
                              await fetchAllDepartments();
                            } catch (error: any) {
                              console.error('Error deleting department:', error);
                              toast({
                                title: tr('خطأ', 'Error'),
                                description: error.message || 'Failed to delete department',
                                variant: 'destructive',
                              });
                            } finally {
                              setIsDeleting(false);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* All Floors Tab */}
        <TabsContent value="all-floors" className="space-y-4">
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">All Floors (Including Deleted/Hidden)</h2>
                <p className="text-sm text-muted-foreground">
                  View all floors from all sources (floors collection and org_nodes), including deleted or inactive ones
                </p>
              </div>
              {allFloors.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => {
                      if (selectedFloors.size === allFloors.length) {
                        setSelectedFloors(new Set());
                      } else {
                        setSelectedFloors(new Set(allFloors.map(f => f.id)));
                      }
                    }}
                  >
                    {selectedFloors.size === allFloors.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  {selectedFloors.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="rounded-xl"
                      disabled={isDeleting}
                      onClick={async () => {
                        if (!(await confirm(tr(`هل أنت متأكد من حذف ${selectedFloors.size} طابق/طوابق نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`, `Are you sure you want to permanently delete ${selectedFloors.size} floor(s)? This action cannot be undone.`)))) {
                          return;
                        }

                        setIsDeleting(true);
                        const selectedIds = Array.from(selectedFloors);
                        let successCount = 0;
                        let failCount = 0;

                        for (const floorId of selectedIds) {
                          try {
                            // Delete from floors collection
                            const floorResponse = await fetch(`/api/structure/floors/${floorId}`, {
                              method: 'DELETE',
                              credentials: 'include',
                            });

                            // Also try to delete from org_nodes (might not exist there)
                            try {
                              await fetch(`/api/structure/org/${floorId}`, {
                                method: 'DELETE',
                                credentials: 'include',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ forceDelete: true }),
                              });
                            } catch (orgError) {
                              // Ignore - might not exist in org_nodes
                            }

                            if (floorResponse.ok) {
                              successCount++;
                            } else {
                              failCount++;
                            }
                          } catch (error) {
                            console.error(`Error deleting floor ${floorId}:`, error);
                            failCount++;
                          }
                        }

                        setIsDeleting(false);
                        setSelectedFloors(new Set());

                        if (successCount > 0) {
                          toast({
                            title: tr('نجاح', 'Success'),
                            description: `Successfully deleted ${successCount} floor(s)${failCount > 0 ? `. ${failCount} failed.` : ''}`,
                          });
                        } else {
                          toast({
                            title: tr('خطأ', 'Error'),
                            description: `Failed to delete ${failCount} floor(s)`,
                            variant: 'destructive',
                          });
                        }

                        // Refresh list
                        await fetchAllFloors();
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete Selected ({selectedFloors.size})
                    </Button>
                  )}
                </div>
              )}
            </div>
            {isLoadingAllFloors ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>{tr('جاري تحميل جميع الطوابق...', 'Loading all floors...')}</span>
              </div>
            ) : allFloors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No floors found in any source.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground mb-4">
                  Found {allFloors.length} floor(s) total
                </div>
                <div className="space-y-2">
                  {allFloors.map((floor) => (
                    <div
                      key={floor.id}
                      className={`flex items-center justify-between p-3 border border-border rounded-xl thea-hover-lift thea-transition-fast ${
                        selectedFloors.has(floor.id)
                          ? 'bg-primary/10 border-primary'
                          : 'bg-card'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedFloors.has(floor.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedFloors);
                            if (e.target.checked) {
                              newSelected.add(floor.id);
                            } else {
                              newSelected.delete(floor.id);
                            }
                            setSelectedFloors(newSelected);
                          }}
                          className="h-4 w-4"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{floor.label_en || floor.name}</span>
                            {floor.label_ar && (
                              <span className="text-sm text-muted-foreground">({floor.label_ar})</span>
                            )}
                            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{floor.source}</span>
                          </div>
                          {floor.code && (
                            <div className="text-sm text-muted-foreground">Code: {floor.code}</div>
                          )}
                          {floor.number && (
                            <div className="text-sm text-muted-foreground">Number: {floor.number}</div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            ID: {floor.id}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="rounded-xl"
                          disabled={isDeleting}
                          onClick={async () => {
                            if (!(await confirm(tr(`هل أنت متأكد من حذف "${floor.label_en || floor.name}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`, `Are you sure you want to permanently delete "${floor.label_en || floor.name}"? This action cannot be undone.`)))) {
                              return;
                            }

                            setIsDeleting(true);
                            try {
                              // Delete from floors collection (HARD DELETE)
                              const floorResponse = await fetch(`/api/structure/floors/${floor.id}`, {
                                method: 'DELETE',
                                credentials: 'include',
                              });

                              if (!floorResponse.ok) {
                                const errorData = await floorResponse.json().catch(() => ({ error: 'Unknown error' }));
                                throw new Error(errorData.error || 'Failed to delete from floors collection');
                              }

                              // Also try to delete from org_nodes (might not exist there)
                              try {
                                await fetch(`/api/structure/org/${floor.id}`, {
                                  method: 'DELETE',
                                  credentials: 'include',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ forceDelete: true }),
                                });
                              } catch (orgError) {
                                // Ignore - node might not exist in org_nodes
                              }

                              toast({
                                title: tr('نجاح', 'Success'),
                                description: `Floor "${floor.label_en || floor.name}" permanently deleted`,
                              });

                              // Remove from selection if selected
                              const newSelected = new Set(selectedFloors);
                              newSelected.delete(floor.id);
                              setSelectedFloors(newSelected);

                              // Refresh list
                              await fetchAllFloors();
                            } catch (error: any) {
                              console.error('Error deleting floor:', error);
                              toast({
                                title: tr('خطأ', 'Error'),
                                description: error.message || 'Failed to delete floor',
                                variant: 'destructive',
                              });
                            } finally {
                              setIsDeleting(false);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Rooms Tab */}
        <TabsContent value="rooms" className="space-y-4">
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Rooms</h2>
            <p className="text-sm text-muted-foreground">
              All rooms from organizational structure
            </p>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>{tr('جاري تحميل الغرف...', 'Loading rooms...')}</span>
              </div>
            ) : (
              (() => {
                const roomNodes = nodes.filter(n => n.type === 'room');
                return roomNodes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No rooms found. Create a room using &quot;Add Node&quot; button.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {roomNodes.map((node) => (
                      <div
                        key={node.id}
                        className="flex items-center justify-between p-3 border border-border rounded-xl bg-card thea-hover-lift thea-transition-fast"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{node.name}</span>
                            {node.code && (
                              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">Code: {node.code}</span>
                            )}
                          </div>
                          {node.description && (
                            <div className="text-sm text-muted-foreground mt-1">{node.description}</div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">ID: {node.id}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => {
                              setEditingNode(node);
                              setFormData({
                                type: node.type,
                                name: node.name,
                                code: node.code || '',
                                description: node.description || '',
                                parentId: node.parentId || '',
                              });
                              setIsDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => handleDelete(node.id, false)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>
        </TabsContent>

        {/* Floors (Nodes) Tab */}
        <TabsContent value="floors" className="space-y-4">
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Floors</h2>
            <p className="text-sm text-muted-foreground">
              All floors from organizational structure
            </p>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>{tr('جاري تحميل الطوابق...', 'Loading floors...')}</span>
              </div>
            ) : (
              (() => {
                const floorNodes = nodes.filter(n => n.type === 'floor');
                return floorNodes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No floors found. Create a floor using &quot;Add Node&quot; button.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {floorNodes.map((node) => (
                      <div
                        key={node.id}
                        className="flex items-center justify-between p-3 border border-border rounded-xl bg-card thea-hover-lift thea-transition-fast"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{node.name}</span>
                            {node.code && (
                              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">Code: {node.code}</span>
                            )}
                          </div>
                          {node.description && (
                            <div className="text-sm text-muted-foreground mt-1">{node.description}</div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">ID: {node.id}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => {
                              setEditingNode(node);
                              setFormData({
                                type: node.type,
                                name: node.name,
                                code: node.code || '',
                                description: node.description || '',
                                parentId: node.parentId || '',
                              });
                              setIsDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => handleDelete(node.id, false)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>
        </TabsContent>

        {/* Units Tab */}
        <TabsContent value="units" className="space-y-4">
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Units</h2>
            <p className="text-sm text-muted-foreground">
              All units from organizational structure
            </p>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>{tr('جاري تحميل الوحدات...', 'Loading units...')}</span>
              </div>
            ) : (
              (() => {
                const unitNodes = nodes.filter(n => n.type === 'unit');
                return unitNodes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No units found. Create a unit using &quot;Add Node&quot; button.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {unitNodes.map((node) => (
                      <div
                        key={node.id}
                        className="flex items-center justify-between p-3 border border-border rounded-xl bg-card thea-hover-lift thea-transition-fast"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{node.name}</span>
                            {node.code && (
                              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">Code: {node.code}</span>
                            )}
                          </div>
                          {node.description && (
                            <div className="text-sm text-muted-foreground mt-1">{node.description}</div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">ID: {node.id}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => {
                              setEditingNode(node);
                              setFormData({
                                type: node.type,
                                name: node.name,
                                code: node.code || '',
                                description: node.description || '',
                                parentId: node.parentId || '',
                              });
                              setIsDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => handleDelete(node.id, false)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>
        </TabsContent>

        {/* Operations Tab */}
        <TabsContent value="operations" className="space-y-4">
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <div className="flex flex-row items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Operations</h2>
                <p className="text-sm text-muted-foreground">
                  Manage policy operations and processes
                </p>
              </div>
              <Dialog open={activeTab === 'operations' && isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl" onClick={() => {
                    setEditingTaxonomy({ type: 'operation', item: null });
                    setTaxonomyFormData({ name: '', code: '', description: '' });
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Operation
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>{tr('إنشاء عملية جديدة', 'Create New Operation')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name *</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={taxonomyFormData.name}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, name: e.target.value })}
                        placeholder="Enter operation name"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Code (Optional)</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={taxonomyFormData.code}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, code: e.target.value })}
                        placeholder="Enter code"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description (Optional)</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={taxonomyFormData.description}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, description: e.target.value })}
                        placeholder="Enter description"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" className="rounded-xl" onClick={() => setIsDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</Button>
                    <Button className="rounded-xl" onClick={() => handleCreateTaxonomy('operation')}>{tr('إنشاء', 'Create')}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {operations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No operations found. Create your first operation.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={operations.length > 0 && selectedOperations.size === operations.length}
                      onChange={() => toggleSelectAll('operation')}
                    />
                    Select All
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="rounded-xl"
                      disabled={selectedOperations.size === 0 || isDeletingTaxonomy}
                      onClick={() =>
                        handleBulkDeleteTaxonomy('operation', Array.from(selectedOperations))
                      }
                    >
                      Delete Selected
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={operations.length === 0 || isDeletingTaxonomy}
                      onClick={() =>
                        handleBulkDeleteTaxonomy('operation', operations.map((op) => op.id), true)
                      }
                    >
                      Delete All
                    </Button>
                  </div>
                </div>
                {operations.map((op) => (
                  <div key={op.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-muted thea-hover-lift thea-transition-fast">
                    <input
                      type="checkbox"
                      checked={selectedOperations.has(op.id)}
                      onChange={() => toggleSelection(setSelectedOperations, op.id)}
                    />
                    <span className="inline-flex items-center rounded-full bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200 px-2.5 py-0.5 text-[11px] font-bold">Operation</span>
                    <span className="font-medium flex-1">{op.name}</span>
                    {op.code && <span className="text-sm text-muted-foreground">({op.code})</span>}
                    <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => handleDeleteTaxonomy('operation', op.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Functions Tab */}
        <TabsContent value="functions" className="space-y-4">
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <div className="flex flex-row items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Functions</h2>
                <p className="text-sm text-muted-foreground">
                  Manage functional areas (HR, Finance, Operations, etc.)
                </p>
              </div>
              <Dialog open={activeTab === 'functions' && isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl" onClick={() => {
                    setEditingTaxonomy({ type: 'function', item: null });
                    setTaxonomyFormData({ name: '', code: '', description: '' });
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Function
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>{tr('إنشاء وظيفة جديدة', 'Create New Function')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name *</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={taxonomyFormData.name}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, name: e.target.value })}
                        placeholder="Enter function name"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Code (Optional)</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={taxonomyFormData.code}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, code: e.target.value })}
                        placeholder="Enter code"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description (Optional)</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={taxonomyFormData.description}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, description: e.target.value })}
                        placeholder="Enter description"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" className="rounded-xl" onClick={() => setIsDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</Button>
                    <Button className="rounded-xl" onClick={() => handleCreateTaxonomy('function')}>{tr('إنشاء', 'Create')}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {functions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No functions found. Create your first function.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={functions.length > 0 && selectedFunctions.size === functions.length}
                      onChange={() => toggleSelectAll('function')}
                    />
                    Select All
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="rounded-xl"
                      disabled={selectedFunctions.size === 0 || isDeletingTaxonomy}
                      onClick={() =>
                        handleBulkDeleteTaxonomy('function', Array.from(selectedFunctions))
                      }
                    >
                      Delete Selected
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={functions.length === 0 || isDeletingTaxonomy}
                      onClick={() =>
                        handleBulkDeleteTaxonomy('function', functions.map((fn) => fn.id), true)
                      }
                    >
                      Delete All
                    </Button>
                  </div>
                </div>
                {functions.map((func) => (
                  <div key={func.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-muted thea-hover-lift thea-transition-fast">
                    <input
                      type="checkbox"
                      checked={selectedFunctions.has(func.id)}
                      onChange={() => toggleSelection(setSelectedFunctions, func.id)}
                    />
                    <span className="inline-flex items-center rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 px-2.5 py-0.5 text-[11px] font-bold">Function</span>
                    <span className="font-medium flex-1">{func.name}</span>
                    {func.code && <span className="text-sm text-muted-foreground">({func.code})</span>}
                    <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => handleDeleteTaxonomy('function', func.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Entity Types Tab */}
        <TabsContent value="entity-types" className="space-y-4">
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <div className="flex flex-row items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Entity Types</h2>
                <p className="text-sm text-muted-foreground">
                  Manage entity types used for document classification
                </p>
              </div>
              <Dialog open={activeTab === 'entity-types' && isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl" onClick={() => {
                    setEditingTaxonomy({ type: 'entity-type', item: null });
                    setTaxonomyFormData({ name: '', code: '', description: '' });
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Entity Type
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>{tr('إنشاء نوع كيان جديد', 'Create New Entity Type')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name *</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={taxonomyFormData.name}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, name: e.target.value })}
                        placeholder="Enter entity type name"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Code (Optional)</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={taxonomyFormData.code}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, code: e.target.value })}
                        placeholder="Enter code"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description (Optional)</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={taxonomyFormData.description}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, description: e.target.value })}
                        placeholder="Enter description"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" className="rounded-xl" onClick={() => setIsDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</Button>
                    <Button className="rounded-xl" onClick={() => handleCreateTaxonomy('entity-type')}>{tr('إنشاء', 'Create')}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {entityTypes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No entity types found. Create your first entity type.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={entityTypes.length > 0 && selectedEntityTypes.size === entityTypes.length}
                      onChange={() => toggleSelectAll('entity-type')}
                    />
                    Select All
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="rounded-xl"
                      disabled={selectedEntityTypes.size === 0 || isDeletingTaxonomy}
                      onClick={() =>
                        handleBulkDeleteTaxonomy('entity-type', Array.from(selectedEntityTypes))
                      }
                    >
                      Delete Selected
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={entityTypes.length === 0 || isDeletingTaxonomy}
                      onClick={() =>
                        handleBulkDeleteTaxonomy('entity-type', entityTypes.map((et) => et.id), true)
                      }
                    >
                      Delete All
                    </Button>
                  </div>
                </div>
                {entityTypes.map((et) => (
                  <div key={et.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-muted thea-hover-lift thea-transition-fast">
                    <input
                      type="checkbox"
                      checked={selectedEntityTypes.has(et.id)}
                      onChange={() => toggleSelection(setSelectedEntityTypes, et.id)}
                    />
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">Entity Type</span>
                    <span className="font-medium flex-1">{et.name}</span>
                    {et.code && <span className="text-sm text-muted-foreground">({et.code})</span>}
                    <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => handleDeleteTaxonomy('entity-type', et.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Scopes Tab */}
        <TabsContent value="scopes" className="space-y-4">
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <div className="flex flex-row items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Scopes</h2>
                <p className="text-sm text-muted-foreground">
                  Manage scopes used for document classification
                </p>
              </div>
              <Dialog open={activeTab === 'scopes' && isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl" onClick={() => {
                    setEditingTaxonomy({ type: 'scope', item: null });
                    setTaxonomyFormData({ name: '', code: '', description: '' });
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Scope
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>{tr('إنشاء نطاق جديد', 'Create New Scope')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name *</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={taxonomyFormData.name}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, name: e.target.value })}
                        placeholder="Enter scope name"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Code (Optional)</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={taxonomyFormData.code}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, code: e.target.value })}
                        placeholder="Enter code"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description (Optional)</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={taxonomyFormData.description}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, description: e.target.value })}
                        placeholder="Enter description"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" className="rounded-xl" onClick={() => setIsDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</Button>
                    <Button className="rounded-xl" onClick={() => handleCreateTaxonomy('scope')}>{tr('إنشاء', 'Create')}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {scopes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No scopes found. Create your first scope.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={scopes.length > 0 && selectedScopes.size === scopes.length}
                      onChange={() => toggleSelectAll('scope')}
                    />
                    Select All
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="rounded-xl"
                      disabled={selectedScopes.size === 0 || isDeletingTaxonomy}
                      onClick={() =>
                        handleBulkDeleteTaxonomy('scope', Array.from(selectedScopes))
                      }
                    >
                      Delete Selected
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={scopes.length === 0 || isDeletingTaxonomy}
                      onClick={() =>
                        handleBulkDeleteTaxonomy('scope', scopes.map((sc) => sc.id), true)
                      }
                    >
                      Delete All
                    </Button>
                  </div>
                </div>
                {scopes.map((sc) => (
                  <div key={sc.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-muted thea-hover-lift thea-transition-fast">
                    <input
                      type="checkbox"
                      checked={selectedScopes.has(sc.id)}
                      onChange={() => toggleSelection(setSelectedScopes, sc.id)}
                    />
                    <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Scope</span>
                    <span className="font-medium flex-1">{sc.name}</span>
                    {sc.code && <span className="text-sm text-muted-foreground">({sc.code})</span>}
                    <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => handleDeleteTaxonomy('scope', sc.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Sectors Tab */}
        <TabsContent value="sectors" className="space-y-4">
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <div className="flex flex-row items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Sectors</h2>
                <p className="text-sm text-muted-foreground">
                  Manage sectors used for document classification
                </p>
              </div>
              <Dialog open={activeTab === 'sectors' && isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl" onClick={() => {
                    setEditingTaxonomy({ type: 'sector', item: null });
                    setTaxonomyFormData({ name: '', code: '', description: '' });
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Sector
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>{tr('إنشاء قطاع جديد', 'Create New Sector')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name *</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={taxonomyFormData.name}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, name: e.target.value })}
                        placeholder="Enter sector name"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Code (Optional)</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={taxonomyFormData.code}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, code: e.target.value })}
                        placeholder="Enter code"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description (Optional)</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={taxonomyFormData.description}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, description: e.target.value })}
                        placeholder="Enter description"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" className="rounded-xl" onClick={() => setIsDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</Button>
                    <Button className="rounded-xl" onClick={() => handleCreateTaxonomy('sector')}>{tr('إنشاء', 'Create')}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {sectors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No sectors found. Create your first sector.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={sectors.length > 0 && selectedSectors.size === sectors.length}
                      onChange={() => toggleSelectAll('sector')}
                    />
                    Select All
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="rounded-xl"
                      disabled={selectedSectors.size === 0 || isDeletingTaxonomy}
                      onClick={() =>
                        handleBulkDeleteTaxonomy('sector', Array.from(selectedSectors))
                      }
                    >
                      Delete Selected
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={sectors.length === 0 || isDeletingTaxonomy}
                      onClick={() =>
                        handleBulkDeleteTaxonomy('sector', sectors.map((sc) => sc.id), true)
                      }
                    >
                      Delete All
                    </Button>
                  </div>
                </div>
                {sectors.map((sc) => (
                  <div key={sc.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-muted thea-hover-lift thea-transition-fast">
                    <input
                      type="checkbox"
                      checked={selectedSectors.has(sc.id)}
                      onChange={() => toggleSelection(setSelectedSectors, sc.id)}
                    />
                    <span className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 px-2.5 py-0.5 text-[11px] font-bold">Sector</span>
                    <span className="font-medium flex-1">{sc.name}</span>
                    {sc.code && <span className="text-sm text-muted-foreground">({sc.code})</span>}
                    <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => handleDeleteTaxonomy('sector', sc.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Risk Domains Tab */}
        <TabsContent value="risk-domains" className="space-y-4">
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <div className="flex flex-row items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Risk Domains</h2>
                <p className="text-sm text-muted-foreground">
                  Manage risk domains (Data Privacy, Safety, Regulatory Compliance, etc.)
                </p>
              </div>
              <Dialog open={activeTab === 'risk-domains' && isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl" onClick={() => {
                    setEditingTaxonomy({ type: 'risk-domain', item: null });
                    setTaxonomyFormData({ name: '', code: '', description: '' });
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Risk Domain
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>{tr('إنشاء مجال مخاطر جديد', 'Create New Risk Domain')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name *</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={taxonomyFormData.name}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, name: e.target.value })}
                        placeholder="Enter risk domain name"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Code (Optional)</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={taxonomyFormData.code}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, code: e.target.value })}
                        placeholder="Enter code"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description (Optional)</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={taxonomyFormData.description}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, description: e.target.value })}
                        placeholder="Enter description"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" className="rounded-xl" onClick={() => setIsDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</Button>
                    <Button className="rounded-xl" onClick={() => handleCreateTaxonomy('risk-domain')}>{tr('إنشاء', 'Create')}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {riskDomains.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No risk domains found. Create your first risk domain.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={riskDomains.length > 0 && selectedRiskDomains.size === riskDomains.length}
                      onChange={() => toggleSelectAll('risk-domain')}
                    />
                    Select All
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="rounded-xl"
                      disabled={selectedRiskDomains.size === 0 || isDeletingTaxonomy}
                      onClick={() =>
                        handleBulkDeleteTaxonomy('risk-domain', Array.from(selectedRiskDomains))
                      }
                    >
                      Delete Selected
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={riskDomains.length === 0 || isDeletingTaxonomy}
                      onClick={() =>
                        handleBulkDeleteTaxonomy('risk-domain', riskDomains.map((rd) => rd.id), true)
                      }
                    >
                      Delete All
                    </Button>
                  </div>
                </div>
                {riskDomains.map((rd) => (
                  <div key={rd.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-muted thea-hover-lift thea-transition-fast">
                    <input
                      type="checkbox"
                      checked={selectedRiskDomains.has(rd.id)}
                      onChange={() => toggleSelection(setSelectedRiskDomains, rd.id)}
                    />
                    <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">Risk Domain</span>
                    <span className="font-medium flex-1">{rd.name}</span>
                    {rd.code && <span className="text-sm text-muted-foreground">({rd.code})</span>}
                    <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => handleDeleteTaxonomy('risk-domain', rd.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
