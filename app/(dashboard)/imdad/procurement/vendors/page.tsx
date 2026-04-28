'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { VendorFormDialog } from '@/components/imdad/procurement/VendorFormDialog';
import { VendorDetailSheet } from '@/components/imdad/procurement/VendorDetailSheet';

interface Vendor {
  id: string;
  _id?: string;
  code: string;
  name: string;
  nameAr?: string;
  country: string;
  city: string;
  type: string;
  vendorType?: string;
  tier?: string;
  vendorTier?: string;
  status: string;
  paymentTerms: string;
  rating?: number;
  currency?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  notes?: string;
  website?: string;
  crNumber?: string;
  vatNumber?: string;
  iban?: string;
  sfdaLicense?: string;
  sfdaLicenseExpiry?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface VendorsResponse {
  data?: Vendor[];
  vendors?: Vendor[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_OPTIONS = [
  'PENDING_APPROVAL',
  'APPROVED',
  'CONDITIONAL',
  'PROBATION',
  'SUSPENDED',
  'BLACKLISTED',
] as const;

const TIER_OPTIONS = ['PREFERRED', 'APPROVED', 'CONDITIONAL', 'PROBATION', 'SUSPENDED'] as const;

function statusBadge(status: string) {
  const map: Record<string, string> = {
    PENDING_APPROVAL: 'bg-[#E8A317]/10 text-[#E8A317] dark:bg-[#E8A317]/20 dark:text-[#E8A317]',
    APPROVED: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]',
    ACTIVE: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]',
    CONDITIONAL: 'bg-[#E8A317]/10 text-[#E8A317] dark:bg-[#E8A317]/20 dark:text-[#E8A317]',
    PROBATION: 'bg-[#E8A317]/10 text-[#C4960C] dark:bg-[#E8A317]/20 dark:text-[#E8A317]',
    SUSPENDED: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#CD853F]',
    BLACKLISTED: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#CD853F]',
    INACTIVE: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  };
  return map[status] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
}

function tierBadge(tier: string) {
  const map: Record<string, string> = {
    STRATEGIC: 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]',
    PREFERRED: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#D4A017]/20 dark:text-[#E8A317]',
    APPROVED: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]',
    CONDITIONAL: 'bg-[#E8A317]/10 text-[#E8A317] dark:bg-[#E8A317]/20 dark:text-[#E8A317]',
    PROBATION: 'bg-[#E8A317]/10 text-[#C4960C] dark:bg-[#E8A317]/20 dark:text-[#E8A317]',
    PROBATIONARY: 'bg-[#E8A317]/10 text-[#C4960C] dark:bg-[#E8A317]/20 dark:text-[#E8A317]',
    SUSPENDED: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#CD853F]',
  };
  return map[tier] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
}

export default function VendorsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Dialog/Sheet state
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (tierFilter) params.set('vendorTier', tierFilter);

      const res = await fetch(`/api/imdad/procurement/vendors?${params}`);
      if (res.ok) {
        const json: VendorsResponse = await res.json();
        // API returns { data: [...] } or { vendors: [...] }
        setVendors(json.data ?? json.vendors ?? []);
        setTotal(json.total ?? 0);
      }
    } catch {
      // handle error silently
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, tierFilter]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const totalPages = Math.ceil(total / limit) || 1;

  const statusTr: Record<string, [string, string]> = {
    PENDING_APPROVAL: ['بانتظار الموافقة', 'Pending Approval'],
    APPROVED: ['معتمد', 'Approved'],
    CONDITIONAL: ['مشروط', 'Conditional'],
    PROBATION: ['تحت التجربة', 'Probation'],
    SUSPENDED: ['موقوف', 'Suspended'],
    BLACKLISTED: ['محظور', 'Blacklisted'],
    ACTIVE: ['نشط', 'Active'],
    INACTIVE: ['غير نشط', 'Inactive'],
  };

  const tierTr: Record<string, [string, string]> = {
    STRATEGIC: ['استراتيجي', 'Strategic'],
    PREFERRED: ['مفضل', 'Preferred'],
    APPROVED: ['معتمد', 'Approved'],
    CONDITIONAL: ['مشروط', 'Conditional'],
    PROBATION: ['تحت التجربة', 'Probation'],
    PROBATIONARY: ['تحت التجربة', 'Probationary'],
    SUSPENDED: ['موقوف', 'Suspended'],
  };

  const typeTr: Record<string, [string, string]> = {
    PHARMACEUTICAL: ['أدوية', 'Pharmaceutical'],
    MEDICAL_DEVICE: ['أجهزة طبية', 'Medical Device'],
    SURGICAL: ['جراحي', 'Surgical'],
    GENERAL: ['عام', 'General'],
    SERVICE: ['خدمات', 'Service'],
  };

  const handleRowClick = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setSheetOpen(true);
  };

  const handleRefresh = () => {
    fetchVendors();
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {tr('الموردون', 'Vendors')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {tr('إدارة الموردين والمعلومات المرتبطة بهم', 'Manage vendors and their information')}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#D4A017] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#C4960C] transition-colors"
        >
          <Plus className="h-4 w-4" />
          {tr('إضافة مورد', 'Add Vendor')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={tr('بحث بالاسم أو الرمز...', 'Search by name or code...')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 ps-10 pe-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">{tr('جميع الحالات', 'All Statuses')}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {tr(statusTr[s]?.[0] ?? s, statusTr[s]?.[1] ?? s)}
            </option>
          ))}
        </select>
        <select
          value={tierFilter}
          onChange={(e) => {
            setTierFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">{tr('جميع المستويات', 'All Tiers')}</option>
          {TIER_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {tr(tierTr[t]?.[0] ?? t, tierTr[t]?.[1] ?? t)}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              {[
                tr('الرمز', 'Code'),
                tr('الاسم', 'Name'),
                tr('الدولة', 'Country'),
                tr('المدينة', 'City'),
                tr('النوع', 'Type'),
                tr('المستوى', 'Tier'),
                tr('الحالة', 'Status'),
                tr('شروط الدفع', 'Payment Terms'),
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                  ))}
                </tr>
              ))
            ) : vendors.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  {tr('لا توجد بيانات موردين', 'No vendors found')}
                </td>
              </tr>
            ) : (
              vendors.map((v) => {
                const vType = v.type || v.vendorType || '';
                const vTier = v.tier || v.vendorTier || '';
                return (
                  <tr
                    key={v.id || v._id}
                    onClick={() => handleRowClick(v)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {v.code}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {language === 'ar' && v.nameAr ? v.nameAr : v.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {v.country}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {v.city}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {vType ? tr(typeTr[vType]?.[0] ?? vType, typeTr[vType]?.[1] ?? vType) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {vTier ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tierBadge(vTier)}`}
                        >
                          {tr(tierTr[vTier]?.[0] ?? vTier, tierTr[vTier]?.[1] ?? vTier)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(v.status)}`}
                      >
                        {tr(
                          statusTr[v.status]?.[0] ?? v.status,
                          statusTr[v.status]?.[1] ?? v.status
                        )}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {v.paymentTerms || '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr(
              `عرض ${(page - 1) * limit + 1} - ${Math.min(page * limit, total)} من ${total}`,
              `Showing ${(page - 1) * limit + 1} - ${Math.min(page * limit, total)} of ${total}`
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-300 p-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {tr(`${page} من ${totalPages}`, `${page} of ${totalPages}`)}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-gray-300 p-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create Vendor Dialog */}
      <VendorFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleRefresh}
      />

      {/* Vendor Detail Sheet */}
      <VendorDetailSheet
        vendor={selectedVendor}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
