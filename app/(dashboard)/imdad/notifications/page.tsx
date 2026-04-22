'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Filter,
  ChevronLeft,
  ChevronRight,
  Package,
  ShoppingCart,
  AlertTriangle,
  Shield,
  DollarSign,
  Wrench,
  Info,
  XCircle,
  AlertOctagon,
  Inbox,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  titleAr?: string | null;
  body?: string | null;
  bodyAr?: string | null;
  type: string;
  category?: string | null;
  priority: string;
  actionUrl?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  isDismissed: boolean;
  channels: string[];
  createdAt: string;
}

interface NotificationsResponse {
  data: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOTIFICATION_TYPES = [
  'stock_low',
  'po_approved',
  'po_rejected',
  'po_created',
  'grn_received',
  'inspection_failed',
  'inspection_passed',
  'asset_maintenance_due',
  'budget_exceeded',
  'budget_warning',
  'recall_issued',
  'contract_expiring',
  'requisition_approved',
  'requisition_rejected',
  'transfer_requested',
  'transfer_completed',
  'general',
];

const SEVERITY_OPTIONS = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'];

const READ_OPTIONS = [
  { value: '', labelEn: 'All', labelAr: '\u0627\u0644\u0643\u0644' },
  { value: 'false', labelEn: 'Unread', labelAr: '\u063a\u064a\u0631 \u0645\u0642\u0631\u0648\u0621\u0629' },
  { value: 'true', labelEn: 'Read', labelAr: '\u0645\u0642\u0631\u0648\u0621\u0629' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ImdadNotificationsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterRead, setFilterRead] = useState('');

  const limit = 20;

  // -------------------------------------------------------------------------
  // Fetch
  // -------------------------------------------------------------------------

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (filterType) params.set('type', filterType);
      if (filterSeverity) params.set('severity', filterSeverity);
      if (filterRead) params.set('isRead', filterRead);

      const res = await fetch(`/api/imdad/notifications?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');

      const json: NotificationsResponse = await res.json();
      setNotifications(json.data);
      setTotal(json.total);
      setTotalPages(json.totalPages);
      setUnreadCount(json.unreadCount);
    } catch {
      console.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [page, filterType, filterSeverity, filterRead]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/imdad/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      console.error('Failed to mark as read');
    }
  };

  const markAllRead = async () => {
    try {
      await fetch('/api/imdad/notifications/mark-all-read', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      console.error('Failed to mark all as read');
    }
  };

  const dismissNotification = async (id: string) => {
    try {
      await fetch(`/api/imdad/notifications/${id}`, { method: 'DELETE' });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotal((t) => t - 1);
    } catch {
      console.error('Failed to dismiss notification');
    }
  };

  const handleNotificationClick = (n: Notification) => {
    if (!n.isRead) markAsRead(n.id);
    if (n.actionUrl) {
      window.location.href = n.actionUrl;
    }
  };

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  const getCategoryIcon = (category?: string | null) => {
    switch (category) {
      case 'inventory':
        return <Package className="h-5 w-5 text-[#D4A017]" />;
      case 'procurement':
        return <ShoppingCart className="h-5 w-5 text-[#556B2F]" />;
      case 'quality':
        return <Shield className="h-5 w-5 text-orange-500" />;
      case 'budget':
        return <DollarSign className="h-5 w-5 text-[#6B8E23]" />;
      case 'asset':
        return <Wrench className="h-5 w-5 text-gray-500" />;
      case 'warehouse':
        return <Package className="h-5 w-5 text-[#6B8E23]" />;
      default:
        return <Bell className="h-5 w-5 text-gray-400" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const map: Record<string, { bg: string; text: string; labelEn: string; labelAr: string }> = {
      normal: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300', labelEn: 'Info', labelAr: '\u0645\u0639\u0644\u0648\u0645\u0629' },
      high: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', labelEn: 'Warning', labelAr: '\u062a\u062d\u0630\u064a\u0631' },
      critical: { bg: 'bg-[#8B4513]/10 dark:bg-[#8B4513]/30', text: 'text-[#8B4513] dark:text-[#A0522D]', labelEn: 'Critical', labelAr: '\u062d\u0631\u062c' },
    };
    const style = map[priority] ?? map.normal;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
        {priority === 'critical' && <AlertOctagon className="h-3 w-3" />}
        {priority === 'high' && <AlertTriangle className="h-3 w-3" />}
        {priority === 'normal' && <Info className="h-3 w-3" />}
        {tr(style.labelAr, style.labelEn)}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return tr('\u0627\u0644\u0622\u0646', 'Just now');
    if (diffMins < 60) return tr(`\u0645\u0646\u0630 ${diffMins} \u062f\u0642\u064a\u0642\u0629`, `${diffMins}m ago`);
    if (diffHours < 24) return tr(`\u0645\u0646\u0630 ${diffHours} \u0633\u0627\u0639\u0629`, `${diffHours}h ago`);
    if (diffDays < 7) return tr(`\u0645\u0646\u0630 ${diffDays} \u064a\u0648\u0645`, `${diffDays}d ago`);
    return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-7 w-7 text-[#D4A017]" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {tr('\u0645\u0631\u0643\u0632 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a', 'Notification Center')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {unreadCount > 0
                ? tr(
                    `${unreadCount} \u0625\u0634\u0639\u0627\u0631 \u063a\u064a\u0631 \u0645\u0642\u0631\u0648\u0621 \u0645\u0646 ${total}`,
                    `${unreadCount} unread of ${total} notifications`,
                  )
                : tr('\u0644\u0627 \u062a\u0648\u062c\u062f \u0625\u0634\u0639\u0627\u0631\u0627\u062a \u063a\u064a\u0631 \u0645\u0642\u0631\u0648\u0621\u0629', 'No unread notifications')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((f) => !f)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
              showFilters
                ? 'border-[#D4A017] bg-[#D4A017]/5 text-[#D4A017] dark:border-[#C4960C] dark:bg-[#C4960C]/20 dark:text-[#E8A317]'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            <Filter className="h-4 w-4" />
            {tr('\u062a\u0635\u0641\u064a\u0629', 'Filter')}
          </button>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 rounded-lg bg-[#D4A017] px-3 py-2 text-sm font-medium text-white hover:bg-[#C4960C] transition-colors"
            >
              <CheckCheck className="h-4 w-4" />
              {tr('\u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0643\u0644', 'Mark All Read')}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="min-w-[160px]">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {tr('\u0627\u0644\u0646\u0648\u0639', 'Type')}
            </label>
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">{tr('\u0627\u0644\u0643\u0644', 'All')}</option>
              {NOTIFICATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {tr('\u0627\u0644\u0623\u0647\u0645\u064a\u0629', 'Severity')}
            </label>
            <select
              value={filterSeverity}
              onChange={(e) => {
                setFilterSeverity(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">{tr('\u0627\u0644\u0643\u0644', 'All')}</option>
              {SEVERITY_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {tr('\u0627\u0644\u062d\u0627\u0644\u0629', 'Status')}
            </label>
            <select
              value={filterRead}
              onChange={(e) => {
                setFilterRead(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              {READ_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {tr(o.labelAr, o.labelEn)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterType('');
                setFilterSeverity('');
                setFilterRead('');
                setPage(1);
              }}
              className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <XCircle className="h-3.5 w-3.5" />
              {tr('\u0645\u0633\u062d', 'Clear')}
            </button>
          </div>
        </div>
      )}

      {/* Notification List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 py-16 dark:border-gray-700 dark:bg-gray-800/50">
          <Inbox className="mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">
            {tr('\u0644\u0627 \u062a\u0648\u062c\u062f \u0625\u0634\u0639\u0627\u0631\u0627\u062a', 'No notifications')}
          </p>
          <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
            {tr(
              '\u0633\u062a\u0638\u0647\u0631 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a \u0627\u0644\u062c\u062f\u064a\u062f\u0629 \u0647\u0646\u0627',
              'New notifications will appear here',
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`group flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                n.isRead
                  ? 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-750'
                  : 'border-[#D4A017]/30 bg-[#D4A017]/5 hover:bg-[#D4A017]/10 dark:border-[#C4960C] dark:bg-[#C4960C]/15 dark:hover:bg-[#C4960C]/20'
              }`}
            >
              {/* Icon */}
              <div className="mt-0.5 flex-shrink-0">
                {getCategoryIcon(n.category)}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p
                      className={`text-sm ${
                        n.isRead
                          ? 'font-normal text-gray-700 dark:text-gray-300'
                          : 'font-semibold text-gray-900 dark:text-white'
                      }`}
                    >
                      {language === 'ar' && n.titleAr ? n.titleAr : n.title}
                    </p>
                    {(n.body || n.bodyAr) && (
                      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                        {language === 'ar' && n.bodyAr ? n.bodyAr : n.body}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!n.isRead && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(n.id);
                        }}
                        title={tr('\u0642\u0631\u0627\u0621\u0629', 'Mark as read')}
                        className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-[#D4A017] dark:hover:bg-gray-700 dark:hover:text-[#E8A317]"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissNotification(n.id);
                      }}
                      title={tr('\u062d\u0630\u0641', 'Dismiss')}
                      className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-[#8B4513] dark:hover:bg-gray-700 dark:hover:text-[#A0522D]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Meta row */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {getPriorityBadge(n.priority)}
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                    {n.type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDate(n.createdAt)}
                  </span>
                  {!n.isRead && (
                    <span className="h-2 w-2 rounded-full bg-[#D4A017]" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr(
              `\u0635\u0641\u062d\u0629 ${page} \u0645\u0646 ${totalPages} (${total} \u0625\u0634\u0639\u0627\u0631)`,
              `Page ${page} of ${totalPages} (${total} notifications)`,
            )}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              <ChevronLeft className="h-4 w-4" />
              {tr('\u0627\u0644\u0633\u0627\u0628\u0642', 'Previous')}
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              {tr('\u0627\u0644\u062a\u0627\u0644\u064a', 'Next')}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
