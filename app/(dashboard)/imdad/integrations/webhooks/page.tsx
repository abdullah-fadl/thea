'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Plus, Trash2, Eye, Power, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';

interface Webhook {
  id: string;
  name: string;
  url: string;
  eventTypes: string[];
  isActive: boolean;
  failureCount: number;
  lastTriggeredAt: string | null;
  headers?: Record<string, string>;
  version: number;
  createdAt: string;
}

interface DeliveryLog {
  id: string;
  webhookId: string;
  eventType: string;
  httpStatusCode: number | null;
  isSuccess: boolean;
  responseTimeMs: number | null;
  deliveredAt: string;
  errorMessage?: string;
}

const EVENT_TYPE_OPTIONS = [
  'inventory.stock_low',
  'inventory.stock_out',
  'inventory.received',
  'procurement.po_created',
  'procurement.po_approved',
  'procurement.grn_received',
  'quality.recall_initiated',
  'quality.inspection_failed',
  'asset.maintenance_due',
  'asset.disposed',
] as const;

export default function WebhooksPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Create dialog state
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createUrl, setCreateUrl] = useState('');
  const [createEvents, setCreateEvents] = useState<string[]>([]);
  const [createHeaders, setCreateHeaders] = useState('{}');
  const [creating, setCreating] = useState(false);

  // Delivery history dialog state
  const [deliveryWebhookId, setDeliveryWebhookId] = useState<string | null>(null);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([]);
  const [deliveryLoading, setDeliveryLoading] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (statusFilter) params.set('isActive', statusFilter);
      const res = await fetch(`/api/imdad/integrations/webhooks?${params}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setWebhooks(json.data || []);
        setTotal(json.total || 0);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [page, search, statusFilter]);

  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);

  const totalPages = Math.ceil(total / limit) || 1;

  const formatDate = (d: string | null) => {
    if (!d) return '\u2014';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const truncateUrl = (url: string, max = 40) => {
    if (url.length <= max) return url;
    return url.slice(0, max) + '\u2026';
  };

  const eventTypeTr: Record<string, [string, string]> = {
    'inventory.stock_low': ['\u0645\u062E\u0632\u0648\u0646 \u0645\u0646\u062E\u0641\u0636', 'Stock Low'],
    'inventory.stock_out': ['\u0646\u0641\u0627\u062F \u0627\u0644\u0645\u062E\u0632\u0648\u0646', 'Stock Out'],
    'inventory.received': ['\u0627\u0633\u062A\u0644\u0627\u0645 \u0645\u062E\u0632\u0648\u0646', 'Received'],
    'procurement.po_created': ['\u0625\u0646\u0634\u0627\u0621 \u0623\u0645\u0631 \u0634\u0631\u0627\u0621', 'PO Created'],
    'procurement.po_approved': ['\u0627\u0639\u062A\u0645\u0627\u062F \u0623\u0645\u0631 \u0634\u0631\u0627\u0621', 'PO Approved'],
    'procurement.grn_received': ['\u0627\u0633\u062A\u0644\u0627\u0645 GRN', 'GRN Received'],
    'quality.recall_initiated': ['\u0628\u062F\u0621 \u0627\u0633\u062A\u0631\u062C\u0627\u0639', 'Recall Initiated'],
    'quality.inspection_failed': ['\u0641\u0634\u0644 \u0627\u0644\u0641\u062D\u0635', 'Inspection Failed'],
    'asset.maintenance_due': ['\u0635\u064A\u0627\u0646\u0629 \u0645\u0633\u062A\u062D\u0642\u0629', 'Maintenance Due'],
    'asset.disposed': ['\u0625\u062A\u0644\u0627\u0641 \u0623\u0635\u0644', 'Asset Disposed'],
  };

  const handleCreate = async () => {
    if (!createName || !createUrl || createEvents.length === 0) return;
    setCreating(true);
    try {
      let parsedHeaders = {};
      try { parsedHeaders = JSON.parse(createHeaders); } catch { /* ignore */ }
      const res = await fetch('/api/imdad/integrations/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: createName, url: createUrl, eventTypes: createEvents, headers: parsedHeaders }),
      });
      if (res.ok) {
        setShowCreate(false);
        setCreateName('');
        setCreateUrl('');
        setCreateEvents([]);
        setCreateHeaders('{}');
        fetchWebhooks();
      }
    } catch (err) {
      console.error(err);
    }
    setCreating(false);
  };

  const toggleStatus = async (webhook: Webhook) => {
    try {
      const res = await fetch(`/api/imdad/integrations/webhooks/${webhook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ version: webhook.version, isActive: !webhook.isActive }),
      });
      if (res.ok) fetchWebhooks();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteWebhook = async (id: string) => {
    try {
      const res = await fetch(`/api/imdad/integrations/webhooks/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) fetchWebhooks();
    } catch (err) {
      console.error(err);
    }
  };

  const openDeliveryHistory = async (webhookId: string) => {
    setDeliveryWebhookId(webhookId);
    setDeliveryLoading(true);
    try {
      const res = await fetch(`/api/imdad/integrations/webhooks/${webhookId}/deliveries`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setDeliveryLogs(json.data || []);
      }
    } catch (err) {
      console.error(err);
    }
    setDeliveryLoading(false);
  };

  const toggleEventType = (event: string) => {
    setCreateEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {tr('\u0627\u0644\u0648\u064A\u0628 \u0647\u0648\u0643', 'Webhooks')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {tr('\u0625\u062F\u0627\u0631\u0629 \u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0627\u0644\u0648\u064A\u0628 \u0647\u0648\u0643 \u0644\u0623\u062D\u062F\u0627\u062B \u0633\u0644\u0633\u0644\u0629 \u0627\u0644\u0625\u0645\u062F\u0627\u062F', 'Manage webhook notifications for supply chain events')}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#D4A017] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#C4960C] transition-colors"
        >
          <Plus className="h-4 w-4" />
          {tr('\u0625\u0636\u0627\u0641\u0629 \u0648\u064A\u0628 \u0647\u0648\u0643', 'Add Webhook')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={tr('\u0628\u062D\u062B \u0628\u0627\u0644\u0627\u0633\u0645 \u0623\u0648 \u0627\u0644\u0631\u0627\u0628\u0637...', 'Search by name or URL...')}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 ps-10 pe-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">{tr('\u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0627\u0644\u0627\u062A', 'All Statuses')}</option>
          <option value="true">{tr('\u0646\u0634\u0637', 'Active')}</option>
          <option value="false">{tr('\u0645\u0639\u0637\u0644', 'Disabled')}</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('\u062C\u0627\u0631\u064D \u0627\u0644\u062A\u062D\u0645\u064A\u0644...', 'Loading...')}
        </div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('\u0644\u0627 \u062A\u0648\u062C\u062F \u0648\u064A\u0628 \u0647\u0648\u0643', 'No webhooks found')}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-xl border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                {[
                  tr('\u0627\u0644\u0627\u0633\u0645', 'Name'),
                  tr('\u0627\u0644\u0631\u0627\u0628\u0637', 'URL'),
                  tr('\u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0623\u062D\u062F\u0627\u062B', 'Event Types'),
                  tr('\u0627\u0644\u062D\u0627\u0644\u0629', 'Status'),
                  tr('\u0639\u062F\u062F \u0627\u0644\u0625\u062E\u0641\u0627\u0642\u0627\u062A', 'Failures'),
                  tr('\u0622\u062E\u0631 \u062A\u0634\u063A\u064A\u0644', 'Last Triggered'),
                  tr('\u0625\u062C\u0631\u0627\u0621\u0627\u062A', 'Actions'),
                ].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {webhooks.map(wh => (
                <tr key={wh.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{wh.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300 font-mono" title={wh.url}>{truncateUrl(wh.url)}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {wh.eventTypes.slice(0, 3).map(et => (
                        <span key={et} className="inline-flex items-center rounded-full bg-[#D4A017]/10 px-2 py-0.5 text-xs font-medium text-[#D4A017] dark:bg-[#D4A017]/20 dark:text-[#E8A317]">
                          {tr(eventTypeTr[et]?.[0] ?? et, eventTypeTr[et]?.[1] ?? et)}
                        </span>
                      ))}
                      {wh.eventTypes.length > 3 && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          +{wh.eventTypes.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      wh.isActive
                        ? 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {wh.isActive ? tr('\u0646\u0634\u0637', 'Active') : tr('\u0645\u0639\u0637\u0644', 'Disabled')}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={`font-medium ${wh.failureCount > 0 ? 'text-[#8B4513] dark:text-[#CD853F]' : 'text-gray-700 dark:text-gray-300'}`}>
                      {wh.failureCount}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(wh.lastTriggeredAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleStatus(wh)}
                        title={wh.isActive ? tr('\u062A\u0639\u0637\u064A\u0644', 'Disable') : tr('\u062A\u0641\u0639\u064A\u0644', 'Enable')}
                        className={`rounded p-1.5 transition-colors ${
                          wh.isActive
                            ? 'text-[#556B2F] hover:bg-[#556B2F]/5 dark:hover:bg-[#556B2F]/10'
                            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <Power className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openDeliveryHistory(wh.id)}
                        title={tr('\u0633\u062C\u0644 \u0627\u0644\u062A\u0633\u0644\u064A\u0645', 'Delivery History')}
                        className="rounded p-1.5 text-[#D4A017] hover:bg-[#D4A017]/5 dark:hover:bg-[#D4A017]/10 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteWebhook(wh.id)}
                        title={tr('\u062D\u0630\u0641', 'Delete')}
                        className="rounded p-1.5 text-[#8B4513] hover:bg-[#8B4513]/5 dark:hover:bg-[#8B4513]/10 transition-colors"
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
      {total > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr(
              `\u0639\u0631\u0636 ${(page - 1) * limit + 1} - ${Math.min(page * limit, total)} \u0645\u0646 ${total}`,
              `Showing ${(page - 1) * limit + 1} - ${Math.min(page * limit, total)} of ${total}`
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-300 p-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {tr(`${page} \u0645\u0646 ${totalPages}`, `${page} of ${totalPages}`)}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-gray-300 p-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create Webhook Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800 space-y-4 mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tr('\u0625\u0646\u0634\u0627\u0621 \u0648\u064A\u0628 \u0647\u0648\u0643', 'Create Webhook')}
              </h2>
              <button onClick={() => setShowCreate(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {tr('\u0627\u0644\u0627\u0633\u0645', 'Name')}
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  placeholder={tr('\u0627\u0633\u0645 \u0627\u0644\u0648\u064A\u0628 \u0647\u0648\u0643', 'Webhook name')}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {tr('\u0627\u0644\u0631\u0627\u0628\u0637', 'URL')}
                </label>
                <input
                  type="url"
                  value={createUrl}
                  onChange={e => setCreateUrl(e.target.value)}
                  placeholder="https://example.com/webhook"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {tr('\u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0623\u062D\u062F\u0627\u062B', 'Event Types')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 p-3 dark:border-gray-600">
                  {EVENT_TYPE_OPTIONS.map(et => (
                    <label key={et} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createEvents.includes(et)}
                        onChange={() => toggleEventType(et)}
                        className="rounded border-gray-300 text-[#D4A017] focus:ring-[#D4A017]"
                      />
                      {tr(eventTypeTr[et]?.[0] ?? et, eventTypeTr[et]?.[1] ?? et)}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {tr('\u0631\u0624\u0648\u0633 \u0645\u062E\u0635\u0635\u0629 (JSON)', 'Custom Headers (JSON)')}
                </label>
                <textarea
                  value={createHeaders}
                  onChange={e => setCreateHeaders(e.target.value)}
                  rows={3}
                  placeholder='{"Authorization": "Bearer ..."}'
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {tr('\u0625\u0644\u063A\u0627\u0621', 'Cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !createName || !createUrl || createEvents.length === 0}
                className="rounded-lg bg-[#D4A017] px-4 py-2 text-sm font-medium text-white hover:bg-[#C4960C] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                {creating ? tr('\u062C\u0627\u0631\u064D \u0627\u0644\u0625\u0646\u0634\u0627\u0621...', 'Creating...') : tr('\u0625\u0646\u0634\u0627\u0621', 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery History Dialog */}
      {deliveryWebhookId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800 space-y-4 mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tr('\u0633\u062C\u0644 \u0627\u0644\u062A\u0633\u0644\u064A\u0645', 'Delivery History')}
              </h2>
              <button onClick={() => { setDeliveryWebhookId(null); setDeliveryLogs([]); }} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            {deliveryLoading ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                {tr('\u062C\u0627\u0631\u064D \u0627\u0644\u062A\u062D\u0645\u064A\u0644...', 'Loading...')}
              </div>
            ) : deliveryLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                {tr('\u0644\u0627 \u062A\u0648\u062C\u062F \u0633\u062C\u0644\u0627\u062A \u062A\u0633\u0644\u064A\u0645', 'No delivery logs found')}
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      {[
                        tr('\u0627\u0644\u062D\u062F\u062B', 'Event'),
                        tr('\u0631\u0645\u0632 \u0627\u0644\u062D\u0627\u0644\u0629', 'Status Code'),
                        tr('\u0627\u0644\u0646\u062A\u064A\u062C\u0629', 'Result'),
                        tr('\u0632\u0645\u0646 \u0627\u0644\u0627\u0633\u062A\u062C\u0627\u0628\u0629', 'Response Time'),
                        tr('\u0627\u0644\u062A\u0627\u0631\u064A\u062E', 'Date'),
                        tr('\u0627\u0644\u062E\u0637\u0623', 'Error'),
                      ].map((h, i) => (
                        <th key={i} className="px-3 py-2 text-start text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {deliveryLogs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                          {tr(eventTypeTr[log.eventType]?.[0] ?? log.eventType, eventTypeTr[log.eventType]?.[1] ?? log.eventType)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-sm font-mono text-gray-700 dark:text-gray-300">{log.httpStatusCode ?? '\u2014'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-sm">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            log.isSuccess
                              ? 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]'
                              : 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#CD853F]'
                          }`}>
                            {log.isSuccess ? tr('\u0646\u062C\u0627\u062D', 'Success') : tr('\u0641\u0634\u0644', 'Failed')}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{log.responseTimeMs != null ? `${log.responseTimeMs}ms` : '\u2014'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{formatDate(log.deliveredAt)}</td>
                        <td className="px-3 py-2 text-sm text-[#8B4513] dark:text-[#CD853F] max-w-[200px] truncate">{log.errorMessage || '\u2014'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
