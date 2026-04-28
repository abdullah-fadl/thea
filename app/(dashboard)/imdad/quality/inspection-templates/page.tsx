'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Plus, Search, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

/* ---------- Types ---------- */
interface ChecklistItem {
  id: string;
  description: string;
  descriptionAr: string;
  isCritical: boolean;
  weight: number;
}

interface InspectionTemplate {
  _id?: string;
  id: string;
  name: string;
  nameAr: string;
  inspectionType: string;
  version: number;
  status: string;
  checklistItems: ChecklistItem[];
  createdAt?: string;
}

const INSPECTION_TYPES = [
  'INCOMING',
  'IN_PROCESS',
  'OUTGOING',
  'RANDOM',
  'COMPLAINT_DRIVEN',
  'PERIODIC',
  'RECALL',
] as const;

const STATUS_OPTIONS = ['ACTIVE', 'DRAFT', 'ARCHIVED'] as const;

/* ---------- Component ---------- */
export default function InspectionTemplatesPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [data, setData] = useState<InspectionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const limit = 20;

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<InspectionTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formNameAr, setFormNameAr] = useState('');
  const [formType, setFormType] = useState<string>('INCOMING');
  const [formChecklist, setFormChecklist] = useState<ChecklistItem[]>([]);

  /* ---------- Fetch ---------- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('inspectionType', typeFilter);
      const res = await fetch(`/api/imdad/quality/inspection-templates?${params}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 0);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [page, search, statusFilter, typeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---------- Labels ---------- */
  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      INCOMING: tr('وارد', 'Incoming'),
      IN_PROCESS: tr('أثناء العملية', 'In-Process'),
      OUTGOING: tr('صادر', 'Outgoing'),
      RANDOM: tr('عشوائي', 'Random'),
      COMPLAINT_DRIVEN: tr('شكوى', 'Complaint-Driven'),
      PERIODIC: tr('دوري', 'Periodic'),
      RECALL: tr('استرجاع', 'Recall'),
    };
    return map[type] || type;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; label: string }> = {
      ACTIVE: {
        color: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]',
        label: tr('نشط', 'Active'),
      },
      DRAFT: {
        color: 'bg-[#E8A317]/10 text-[#E8A317] dark:bg-[#E8A317]/20 dark:text-[#E8A317]',
        label: tr('مسودة', 'Draft'),
      },
      ARCHIVED: {
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
        label: tr('مؤرشف', 'Archived'),
      },
    };
    const s = map[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
    );
  };

  const statusFilterLabel = (s: string) => {
    const map: Record<string, string> = {
      ACTIVE: tr('نشط', 'Active'),
      DRAFT: tr('مسودة', 'Draft'),
      ARCHIVED: tr('مؤرشف', 'Archived'),
    };
    return map[s] || s;
  };

  const formatDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  /* ---------- Dialog helpers ---------- */
  function openCreate() {
    setEditingTemplate(null);
    setFormName('');
    setFormNameAr('');
    setFormType('INCOMING');
    setFormChecklist([]);
    setDialogOpen(true);
  }

  function openEdit(tpl: InspectionTemplate) {
    setEditingTemplate(tpl);
    setFormName(tpl.name);
    setFormNameAr(tpl.nameAr || '');
    setFormType(tpl.inspectionType);
    setFormChecklist(
      (tpl.checklistItems || []).map((item, i) => ({
        ...item,
        id: item.id || `existing-${i}`,
      }))
    );
    setDialogOpen(true);
  }

  function addChecklistItem() {
    setFormChecklist((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${Math.random()}`,
        description: '',
        descriptionAr: '',
        isCritical: false,
        weight: 1,
      },
    ]);
  }

  function removeChecklistItem(id: string) {
    setFormChecklist((prev) => prev.filter((item) => item.id !== id));
  }

  function updateChecklistItem(id: string, field: keyof ChecklistItem, value: any) {
    setFormChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  /* ---------- Save ---------- */
  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: formName,
        nameAr: formNameAr,
        inspectionType: formType,
        checklistItems: formChecklist.map(({ description, descriptionAr, isCritical, weight }) => ({
          description,
          descriptionAr,
          isCritical,
          weight,
        })),
      };

      const isEdit = !!editingTemplate;
      const url = isEdit
        ? `/api/imdad/quality/inspection-templates/${editingTemplate!.id || editingTemplate!._id}`
        : '/api/imdad/quality/inspection-templates';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setDialogOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  /* ---------- Delete ---------- */
  async function handleDelete(tpl: InspectionTemplate) {
    const confirmed = window.confirm(
      tr('هل أنت متأكد من حذف هذا القالب؟', 'Are you sure you want to delete this template?')
    );
    if (!confirmed) return;
    try {
      const res = await fetch(
        `/api/imdad/quality/inspection-templates/${tpl.id || tpl._id}`,
        { method: 'DELETE', credentials: 'include' }
      );
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  /* ---------- Render ---------- */
  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {tr('قوالب الفحص', 'Inspection Templates')}
        </h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 me-2" />
          {tr('إنشاء قالب', 'Create Template')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={tr('بحث...', 'Search...')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="border rounded-lg ps-10 pe-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع الأنواع', 'All Types')}</option>
          {INSPECTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع الحالات', 'All Statuses')}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {statusFilterLabel(s)}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('جارٍ التحميل...', 'Loading...')}
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('لا توجد قوالب', 'No templates found')}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  tr('اسم القالب', 'Template Name'),
                  tr('نوع الفحص', 'Inspection Type'),
                  tr('الإصدار', 'Version'),
                  tr('الحالة', 'Status'),
                  tr('عدد عناصر القائمة', 'Checklist Items'),
                  tr('تاريخ الإنشاء', 'Created Date'),
                  tr('إجراءات', 'Actions'),
                ].map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-start"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {data.map((row) => (
                <tr
                  key={row.id || row._id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {language === 'ar' && row.nameAr ? row.nameAr : row.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {typeLabel(row.inspectionType)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    v{row.version || 1}
                  </td>
                  <td className="px-4 py-3 text-sm">{statusBadge(row.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {row.checklistItems?.length || 0}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(row)}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                        title={tr('تعديل', 'Edit')}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(row)}
                        className="p-1 rounded hover:bg-[#8B4513]/10 dark:hover:bg-[#8B4513]/20 text-[#8B4513] dark:text-[#D2691E]"
                        title={tr('حذف', 'Delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {tr(`الإجمالي: ${total}`, `Total: ${total}`)}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            >
              {tr('السابق', 'Previous')}
            </button>
            <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
              {tr(`صفحة ${page} من ${totalPages}`, `Page ${page} of ${totalPages}`)}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            >
              {tr('التالي', 'Next')}
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate
                ? tr('تعديل قالب الفحص', 'Edit Inspection Template')
                : tr('إنشاء قالب فحص جديد', 'Create Inspection Template')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name (English) */}
            <div className="space-y-2">
              <Label>{tr('الاسم (إنجليزي)', 'Name (English)')}</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={tr('اسم القالب بالإنجليزية', 'Template name in English')}
              />
            </div>

            {/* Name (Arabic) */}
            <div className="space-y-2">
              <Label>{tr('الاسم (عربي)', 'Name (Arabic)')}</Label>
              <Input
                value={formNameAr}
                onChange={(e) => setFormNameAr(e.target.value)}
                placeholder={tr('اسم القالب بالعربية', 'Template name in Arabic')}
                dir="rtl"
              />
            </div>

            {/* Inspection Type */}
            <div className="space-y-2">
              <Label>{tr('نوع الفحص', 'Inspection Type')}</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger>
                  <SelectValue placeholder={tr('اختر النوع', 'Select type')} />
                </SelectTrigger>
                <SelectContent>
                  {INSPECTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {typeLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Checklist Items */}
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label className="text-base font-semibold">
                  {tr('عناصر قائمة الفحص', 'Checklist Items')}
                </Label>
                <Button type="button" variant="outline" size="sm" onClick={addChecklistItem}>
                  <Plus className="h-4 w-4 me-1" />
                  {tr('إضافة عنصر', 'Add Item')}
                </Button>
              </div>

              {formChecklist.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  {tr('لا توجد عناصر. أضف عنصرًا للبدء.', 'No items yet. Add an item to get started.')}
                </p>
              )}

              {formChecklist.map((item, index) => (
                <div
                  key={item.id}
                  className="border rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {tr(`عنصر ${index + 1}`, `Item ${index + 1}`)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeChecklistItem(item.id)}
                      className="p-1 rounded hover:bg-[#8B4513]/10 dark:hover:bg-[#8B4513]/20 text-[#8B4513] dark:text-[#D2691E]"
                      title={tr('إزالة', 'Remove')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">
                        {tr('الوصف (إنجليزي)', 'Description (English)')}
                      </Label>
                      <Input
                        value={item.description}
                        onChange={(e) =>
                          updateChecklistItem(item.id, 'description', e.target.value)
                        }
                        placeholder={tr('وصف العنصر', 'Item description')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">
                        {tr('الوصف (عربي)', 'Description (Arabic)')}
                      </Label>
                      <Input
                        value={item.descriptionAr}
                        onChange={(e) =>
                          updateChecklistItem(item.id, 'descriptionAr', e.target.value)
                        }
                        placeholder={tr('وصف العنصر بالعربية', 'Item description in Arabic')}
                        dir="rtl"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={item.isCritical}
                        onCheckedChange={(checked) =>
                          updateChecklistItem(item.id, 'isCritical', checked)
                        }
                      />
                      <Label className="text-sm">
                        {tr('حرج', 'Critical')}
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">{tr('الوزن', 'Weight')}</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        value={item.weight}
                        onChange={(e) =>
                          updateChecklistItem(item.id, 'weight', parseFloat(e.target.value) || 0)
                        }
                        className="w-20"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving
                ? tr('جارٍ الحفظ...', 'Saving...')
                : editingTemplate
                  ? tr('تحديث', 'Update')
                  : tr('إنشاء', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
