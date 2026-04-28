'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AssetFormDialog } from '@/components/imdad/assets/AssetFormDialog';
import { AssetDetailSheet, type AssetDetail } from '@/components/imdad/assets/AssetDetailSheet';

// ---------- Constants ----------

const STATUS_OPTIONS = ['IN_SERVICE', 'OUT_OF_SERVICE', 'UNDER_MAINTENANCE', 'CALIBRATION_DUE', 'CONDEMNED', 'DISPOSED', 'IN_STORAGE', 'TRANSFERRED'] as const;
const CATEGORY_OPTIONS = ['MEDICAL_EQUIPMENT', 'IT_EQUIPMENT', 'FURNITURE', 'VEHICLE', 'BUILDING', 'INSTRUMENT', 'OTHER'] as const;
const CRITICALITY_OPTIONS = ['HIGH', 'MEDIUM', 'LOW'] as const;

export default function AssetRegisterPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  // List state
  const [data, setData] = useState<AssetDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [criticalityFilter, setCriticalityFilter] = useState('');
  const limit = 20;

  // Dialog / sheet state
  const [formOpen, setFormOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<AssetDetail | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetDetail | null>(null);

  // ---------- Fetch ----------

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('assetCategory', categoryFilter);
      if (criticalityFilter) params.set('criticalityLevel', criticalityFilter);
      const res = await fetch(`/api/imdad/assets/register?${params}`, { credentials: 'include' });
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
  }, [page, search, statusFilter, categoryFilter, criticalityFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ---------- Label helpers ----------

  const statusConfig: Record<string, { color: string; label: string }> = {
    IN_SERVICE: { color: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]', label: tr('في الخدمة', 'In Service') },
    OUT_OF_SERVICE: { color: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D2691E]', label: tr('خارج الخدمة', 'Out of Service') },
    UNDER_MAINTENANCE: { color: 'bg-[#E8A317]/10 text-[#E8A317] dark:bg-[#E8A317]/20 dark:text-[#E8A317]', label: tr('تحت الصيانة', 'Under Maintenance') },
    CALIBRATION_DUE: { color: 'bg-[#D4A017]/15 text-[#C4960C] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('معايرة مستحقة', 'Calibration Due') },
    CONDEMNED: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', label: tr('محكوم عليه', 'Condemned') },
    DISPOSED: { color: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400', label: tr('تم التخلص', 'Disposed') },
    IN_STORAGE: { color: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('في المخزن', 'In Storage') },
    TRANSFERRED: { color: 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]', label: tr('محول', 'Transferred') },
  };

  const statusLabel = (s: string) => statusConfig[s]?.label || s;

  const categoryLabel = (c: string) => {
    const map: Record<string, string> = {
      MEDICAL_EQUIPMENT: tr('معدات طبية', 'Medical Equipment'),
      IT_EQUIPMENT: tr('معدات تقنية', 'IT Equipment'),
      FURNITURE: tr('أثاث', 'Furniture'),
      VEHICLE: tr('مركبة', 'Vehicle'),
      BUILDING: tr('مبنى', 'Building'),
      INSTRUMENT: tr('أداة', 'Instrument'),
      OTHER: tr('أخرى', 'Other'),
    };
    return map[c] || c;
  };

  const criticalityLabel = (c: string) => {
    const map: Record<string, string> = {
      HIGH: tr('عالي', 'High'),
      MEDIUM: tr('متوسط', 'Medium'),
      LOW: tr('منخفض', 'Low'),
    };
    return map[c] || c;
  };

  const criticalityColor: Record<string, string> = {
    HIGH: 'text-[#8B4513] dark:text-[#D2691E]',
    MEDIUM: 'text-[#E8A317] dark:text-[#E8A317]',
    LOW: 'text-[#6B8E23] dark:text-[#9CB86B]',
  };

  const formatCurrency = (val: number | string | undefined | null) => {
    if (val == null || val === '') return '—';
    const n = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(n)) return '—';
    return new Intl.NumberFormat(language === 'ar' ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }).format(n);
  };

  // ---------- Row click ----------

  const handleRowClick = (asset: AssetDetail) => {
    setSelectedAsset(asset);
    setSheetOpen(true);
  };

  // ---------- Edit from sheet ----------

  const handleEditFromSheet = (asset: AssetDetail) => {
    setSheetOpen(false);
    setEditAsset(asset);
    setFormOpen(true);
  };

  // ---------- Create new ----------

  const handleCreate = () => {
    setEditAsset(null);
    setFormOpen(true);
  };

  // ---------- After create/edit ----------

  const handleFormSuccess = () => {
    fetchData();
    // If the detail sheet was open for the edited asset, close it
    setSheetOpen(false);
    setSelectedAsset(null);
  };

  // ---------- After delete ----------

  const handleDelete = () => {
    fetchData();
  };

  // ---------- Reset filters ----------

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setCategoryFilter('');
    setCriticalityFilter('');
    setPage(1);
  };

  const hasFilters = search || statusFilter || categoryFilter || criticalityFilter;

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {tr('سجل الأصول', 'Asset Register')}
        </h1>
        <Button onClick={handleCreate}>
          {tr('+ تسجيل أصل جديد', '+ Register New Asset')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          type="text"
          placeholder={tr('بحث بالرمز، الاسم، الرقم التسلسلي...', 'Search by tag, name, serial...')}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-64"
        />
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={tr('جميع الحالات', 'All Statuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{tr('جميع الحالات', 'All Statuses')}</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={tr('جميع الفئات', 'All Categories')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{tr('جميع الفئات', 'All Categories')}</SelectItem>
            {CATEGORY_OPTIONS.map(c => (
              <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={criticalityFilter} onValueChange={v => { setCriticalityFilter(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={tr('جميع مستويات الأهمية', 'All Criticality')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{tr('جميع مستويات الأهمية', 'All Criticality')}</SelectItem>
            {CRITICALITY_OPTIONS.map(c => (
              <SelectItem key={c} value={c}>{criticalityLabel(c)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={handleResetFilters}>
            {tr('مسح الفلاتر', 'Clear Filters')}
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {tr(`${total} أصل`, `${total} asset${total !== 1 ? 's' : ''}`)}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('جارٍ التحميل...', 'Loading...')}
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="text-lg mb-2">{tr('لا توجد أصول', 'No assets found')}</p>
          <p className="text-sm">{tr('ابدأ بتسجيل أصل جديد', 'Start by registering a new asset')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  tr('رمز الأصل', 'Asset Tag'),
                  tr('اسم الأصل', 'Asset Name'),
                  tr('الفئة', 'Category'),
                  tr('الحالة', 'Status'),
                  tr('الرقم التسلسلي', 'Serial Number'),
                  tr('الشركة المصنعة', 'Manufacturer'),
                  tr('مستوى الأهمية', 'Criticality'),
                  tr('القيمة الدفترية', 'Book Value'),
                ].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-start">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {data.map(row => {
                const sc = statusConfig[row.status] || { color: 'bg-gray-100 text-gray-800', label: row.status };
                return (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                    onClick={() => handleRowClick(row)}
                  >
                    <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900 dark:text-white">
                      {row.assetTag}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      <div>{row.assetName || '—'}</div>
                      {row.assetNameAr && (
                        <div className="text-xs text-gray-400 dark:text-gray-500" dir="rtl">{row.assetNameAr}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {categoryLabel(row.assetCategory)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge className={sc.color}>{sc.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 font-mono">
                      {row.serialNumber || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {row.manufacturer || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {row.criticalityLevel ? (
                        <span className={`font-medium ${criticalityColor[row.criticalityLevel] || ''}`}>
                          {criticalityLabel(row.criticalityLevel)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {formatCurrency(row.currentBookValue)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {tr(`صفحة ${page} من ${totalPages}`, `Page ${page} of ${totalPages}`)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              {tr('السابق', 'Previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              {tr('التالي', 'Next')}
            </Button>
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <AssetFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        asset={editAsset as any}
        onSuccess={handleFormSuccess}
      />

      {/* Detail Sheet */}
      <AssetDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        asset={selectedAsset}
        onEdit={handleEditFromSheet}
        onDelete={handleDelete}
      />
    </div>
  );
}
