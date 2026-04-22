'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCcw,
  X,
} from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type Direction = 'INBOUND' | 'OUTBOUND' | '';
type Protocol = 'HL7' | 'ASTM' | 'DICOM' | 'FHIR' | '';
type Status = 'RECEIVED' | 'PROCESSED' | 'FAILED' | 'RETRY' | '';

export default function IntegrationLog() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [direction, setDirection] = useState<Direction>('');
  const [protocol, setProtocol] = useState<Protocol>('');
  const [status, setStatus] = useState<Status>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (direction) params.set('direction', direction);
  if (protocol) params.set('protocol', protocol);
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  params.set('page', String(page));
  params.set('limit', '30');

  const { data, mutate } = useSWR(`/api/integration/messages?${params}`, fetcher, { refreshInterval: 10000 });
  const { data: statsData } = useSWR('/api/integration/messages?stats=true', fetcher);

  const messages = data?.messages ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const stats = statsData?.stats;

  const handleRetry = async (messageId: string) => {
    setRetrying(messageId);
    try {
      await fetch('/api/integration/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'retry', messageId }),
      });
      mutate();
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tr('سجل التكامل', 'Integration Log')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{tr('سجل رسائل التكامل', 'Integration Message Log')}</p>
          </div>
          <button onClick={() => mutate()} className="p-2 border border-border rounded-xl hover:bg-muted">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <MiniStat label={tr('إجمالي', 'Total')} value={stats.total} color="text-blue-600" />
            <MiniStat label={tr('مستلم', 'Received')} value={stats.received} color="text-yellow-600" />
            <MiniStat label={tr('معالج', 'Processed')} value={stats.processed} color="text-green-600" />
            <MiniStat label={tr('فشل', 'Failed')} value={stats.failed} color="text-red-600" />
            <MiniStat label={tr('إعادة', 'Retry')} value={stats.retry} color="text-amber-600" />
          </div>
        )}

        {/* Filters */}
        <div className="bg-card rounded-2xl border border-border p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={tr('بحث...', 'Search...')}
                className="w-full pl-9 pr-3 py-2 border border-border rounded-xl thea-input-focus text-sm"
              />
            </div>
            <select value={direction} onChange={(e) => { setDirection(e.target.value as Direction); setPage(1); }} className="px-3 py-2 border border-border rounded-xl thea-input-focus text-sm">
              <option value="">{tr('كل الاتجاهات', 'All Directions')}</option>
              <option value="INBOUND">{tr('وارد', 'Inbound')}</option>
              <option value="OUTBOUND">{tr('صادر', 'Outbound')}</option>
            </select>
            <select value={protocol} onChange={(e) => { setProtocol(e.target.value as Protocol); setPage(1); }} className="px-3 py-2 border border-border rounded-xl thea-input-focus text-sm">
              <option value="">{tr('كل البروتوكولات', 'All Protocols')}</option>
              <option value="HL7">HL7</option>
              <option value="ASTM">ASTM</option>
              <option value="DICOM">DICOM</option>
              <option value="FHIR">FHIR</option>
            </select>
            <select value={status} onChange={(e) => { setStatus(e.target.value as Status); setPage(1); }} className="px-3 py-2 border border-border rounded-xl thea-input-focus text-sm">
              <option value="">{tr('كل الحالات', 'All Statuses')}</option>
              <option value="RECEIVED">{tr('مستلم', 'Received')}</option>
              <option value="PROCESSED">{tr('معالج', 'Processed')}</option>
              <option value="FAILED">{tr('فشل', 'Failed')}</option>
              <option value="RETRY">{tr('إعادة', 'Retry')}</option>
            </select>
          </div>
        </div>

        {/* Messages Table */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">{tr('الاتجاه', 'Direction')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">{tr('البروتوكول', 'Protocol')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">{tr('النوع', 'Type')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">{tr('الجهاز', 'Instrument')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">{tr('الحالة', 'Status')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">{tr('الوقت', 'Timestamp')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">{tr('إجراء', 'Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {messages.map((msg: any) => (
                <tr key={msg.id} className="thea-hover-lift">
                  <td className="px-4 py-3">
                    {msg.direction === 'INBOUND' ? (
                      <ArrowDownLeft className="w-4 h-4 text-blue-600" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-green-600" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-muted rounded text-[10px] font-bold">{msg.protocol}</span>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-foreground">{msg.messageType}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{msg.instrumentId || '\u2014'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      msg.status === 'PROCESSED' ? 'bg-green-100 text-green-700' :
                      msg.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                      msg.status === 'RETRY' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {msg.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {msg.receivedAt ? new Date(msg.receivedAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '\u2014'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setSelectedMessage(msg)} className="p-1 text-muted-foreground hover:text-foreground" title={tr('عرض', 'View')}>
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {msg.status === 'FAILED' && (
                        <button
                          onClick={() => handleRetry(msg.id)}
                          disabled={retrying === msg.id}
                          className="p-1 text-amber-600 hover:text-amber-700"
                          title={tr('إعادة المحاولة', 'Retry')}
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${retrying === msg.id ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {messages.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">{tr('لا توجد رسائل', 'No messages')}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{total} {tr('رسالة', 'messages')}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="p-1 border border-border rounded disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-sm">{page}/{totalPages}</span>
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="p-1 border border-border rounded disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Message Detail Modal */}
        {selectedMessage && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-bold">{selectedMessage.messageType} — {selectedMessage.protocol}</h2>
                <button onClick={() => setSelectedMessage(null)} className="p-1 hover:bg-muted rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">{tr('الاتجاه', 'Direction')}: </span><span className="font-medium">{selectedMessage.direction}</span></div>
                  <div><span className="text-muted-foreground">{tr('الحالة', 'Status')}: </span><span className="font-medium">{selectedMessage.status}</span></div>
                  <div><span className="text-muted-foreground">{tr('الجهاز', 'Instrument')}: </span><span className="font-medium">{selectedMessage.instrumentId || '\u2014'}</span></div>
                  <div><span className="text-muted-foreground">{tr('المحاولات', 'Retries')}: </span><span className="font-medium">{selectedMessage.retryCount}</span></div>
                </div>

                {selectedMessage.errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{selectedMessage.errorMessage}</div>
                )}

                <div>
                  <h3 className="text-sm font-bold mb-2">{tr('الرسالة الخام', 'Raw Message')}</h3>
                  <pre className="bg-muted p-3 rounded-xl text-xs font-mono overflow-x-auto max-h-48 whitespace-pre-wrap">
                    {selectedMessage.rawMessage}
                  </pre>
                </div>

                {selectedMessage.parsedData && (
                  <div>
                    <h3 className="text-sm font-bold mb-2">{tr('البيانات المفسرة', 'Parsed Data')}</h3>
                    <pre className="bg-muted p-3 rounded-xl text-xs font-mono overflow-x-auto max-h-48">
                      {JSON.stringify(selectedMessage.parsedData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-3 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
