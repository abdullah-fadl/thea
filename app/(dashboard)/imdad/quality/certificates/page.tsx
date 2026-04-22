'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';

interface Certificate {
  _id: string;
  certificateNumber: string;
  certificateType: string;
  entityName: string;
  issuingAuthority: string;
  issuedDate: string;
  expiryDate: string;
  renewalStatus: string;
  verified: boolean;
}

const TYPE_OPTIONS = [
  'SFDA_REGISTRATION', 'GMP_CERTIFICATE', 'ISO_CERTIFICATE', 'HALAL_CERTIFICATE',
  'COA', 'COC', 'INSURANCE', 'IMPORT_LICENSE', 'STORAGE_LICENSE', 'OTHER',
] as const;
const RENEWAL_OPTIONS = ['NOT_DUE', 'UPCOMING', 'OVERDUE', 'RENEWED'] as const;

export default function ComplianceCertificatesPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [data, setData] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const [renewalFilter, setRenewalFilter] = useState('');
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (typeFilter) params.set('certificateType', typeFilter);
      if (renewalFilter) params.set('renewalStatus', renewalFilter);
      const res = await fetch(`/api/imdad/quality/certificates?${params}`, { credentials: 'include' });
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
  }, [page, search, typeFilter, renewalFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const certTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      SFDA_REGISTRATION: tr('تسجيل SFDA', 'SFDA Registration'),
      GMP_CERTIFICATE: tr('شهادة GMP', 'GMP Certificate'),
      ISO_CERTIFICATE: tr('شهادة ISO', 'ISO Certificate'),
      HALAL_CERTIFICATE: tr('شهادة حلال', 'Halal Certificate'),
      COA: tr('شهادة تحليل', 'Certificate of Analysis'),
      COC: tr('شهادة مطابقة', 'Certificate of Conformity'),
      INSURANCE: tr('تأمين', 'Insurance'),
      IMPORT_LICENSE: tr('رخصة استيراد', 'Import License'),
      STORAGE_LICENSE: tr('رخصة تخزين', 'Storage License'),
      OTHER: tr('أخرى', 'Other'),
    };
    return map[type] || type;
  };

  const renewalBadge = (status: string) => {
    const map: Record<string, { color: string; label: string }> = {
      NOT_DUE: { color: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]', label: tr('غير مستحق', 'Not Due') },
      UPCOMING: { color: 'bg-[#E8A317]/10 text-[#E8A317] dark:bg-[#E8A317]/20 dark:text-[#E8A317]', label: tr('قريب', 'Upcoming') },
      OVERDUE: { color: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D2691E]', label: tr('متأخر', 'Overdue') },
      RENEWED: { color: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('مجدد', 'Renewed') },
    };
    const s = map[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const renewalFilterLabel = (s: string) => {
    const map: Record<string, string> = {
      NOT_DUE: tr('غير مستحق', 'Not Due'),
      UPCOMING: tr('قريب', 'Upcoming'),
      OVERDUE: tr('متأخر', 'Overdue'),
      RENEWED: tr('مجدد', 'Renewed'),
    };
    return map[s] || s;
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US');
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {tr('شهادات الامتثال', 'Compliance Certificates')}
      </h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder={tr('بحث...', 'Search...')}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        />
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع الأنواع', 'All Types')}</option>
          {TYPE_OPTIONS.map(t => (
            <option key={t} value={t}>{certTypeLabel(t)}</option>
          ))}
        </select>
        <select
          value={renewalFilter}
          onChange={e => { setRenewalFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع حالات التجديد', 'All Renewal Statuses')}</option>
          {RENEWAL_OPTIONS.map(s => (
            <option key={s} value={s}>{renewalFilterLabel(s)}</option>
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
          {tr('لا توجد شهادات', 'No certificates found')}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  tr('رقم الشهادة', 'Certificate #'),
                  tr('النوع', 'Type'),
                  tr('الجهة', 'Entity'),
                  tr('جهة الإصدار', 'Issuing Authority'),
                  tr('تاريخ الإصدار', 'Issued Date'),
                  tr('تاريخ الانتهاء', 'Expiry Date'),
                  tr('حالة التجديد', 'Renewal Status'),
                  tr('موثق', 'Verified'),
                  tr('الإجراءات', 'Actions'),
                ].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-start">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {data.map(row => (
                <tr key={row._id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{row.certificateNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{certTypeLabel(row.certificateType)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.entityName || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.issuingAuthority || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(row.issuedDate)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(row.expiryDate)}</td>
                  <td className="px-4 py-3 text-sm">{renewalBadge(row.renewalStatus)}</td>
                  <td className="px-4 py-3 text-sm">
                    {row.verified ? (
                      <span className="text-[#6B8E23] dark:text-[#9CB86B] font-medium">&#10003;</span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">&#10007;</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button className="text-[#D4A017] hover:text-[#C4960C] dark:text-[#E8A317] dark:hover:text-[#E8A317] text-sm">
                      {tr('عرض', 'View')}
                    </button>
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
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            >
              {tr('السابق', 'Previous')}
            </button>
            <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
              {tr(`صفحة ${page} من ${totalPages}`, `Page ${page} of ${totalPages}`)}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            >
              {tr('التالي', 'Next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
