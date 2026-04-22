'use client';

import { useState, useMemo } from 'react';
import { useLang } from '@/hooks/use-lang';
import { useImdadBrain } from '@/hooks/imdad/use-imdad-brain';
import { ItemDetailDrawer } from '@/components/imdad/drawers/ItemDetailDrawer';
import { DeviceDetailDrawer } from '@/components/imdad/drawers/DeviceDetailDrawer';
import { DecisionDetailDrawer } from '@/components/imdad/drawers/DecisionDetailDrawer';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const HOSPITAL_ID = '';
const HOSPITAL_NAME_EN = '';
const HOSPITAL_NAME_AR = '';
const ROLE_EN = 'Head Nurse - ICU';
const ROLE_AR = 'رئيسة التمريض - العناية المركزة';

type Tab = 'stock' | 'devices' | 'requests' | 'approvals';

const TABS: { key: Tab; labelAr: string; labelEn: string }[] = [
  { key: 'stock', labelAr: 'المخزون', labelEn: 'Stock' },
  { key: 'devices', labelAr: 'الأجهزة', labelEn: 'Devices' },
  { key: 'requests', labelAr: 'طلباتي', labelEn: 'My Requests' },
  { key: 'approvals', labelAr: 'الموافقات', labelEn: 'Approvals' },
];

const REQUEST_FILTERS = [
  { key: 'all', labelAr: 'الكل', labelEn: 'All' },
  { key: 'PENDING_REVIEW', labelAr: 'قيد المراجعة', labelEn: 'Pending' },
  { key: 'APPROVED', labelAr: 'موافق عليه', labelEn: 'Approved' },
  { key: 'REJECTED', labelAr: 'مرفوض', labelEn: 'Rejected' },
] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function stockStatus(item: any): 'green' | 'amber' | 'red' {
  const onHand = item.onHand ?? item.quantityOnHand ?? 0;
  const reorder = item.reorderPoint ?? 10;
  if (onHand <= 0) return 'red';
  if (onHand <= reorder) return 'amber';
  return 'green';
}

const STATUS_DOT: Record<string, string> = {
  green: 'bg-emerald-400',
  amber: 'bg-amber-400',
  red: 'bg-red-500 animate-pulse',
};

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return '---';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function elapsedHours(from: string | Date | null | undefined) {
  if (!from) return '---';
  const ms = Date.now() - new Date(from).getTime();
  const hrs = Math.floor(ms / 3_600_000);
  if (hrs < 1) return '<1h';
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function MyOperationsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const brain = useImdadBrain();

  // ---- state ----
  const [activeTab, setActiveTab] = useState<Tab>('stock');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [selectedDecision, setSelectedDecision] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [requestFilter, setRequestFilter] = useState<string>('all');

  // ---- filtered data from brain ----
  const items = useMemo(() => {
    const raw = (brain as any).inventoryItems ?? (brain as any).procurement ?? [];
    return raw.filter((i: any) => i.hospitalId === HOSPITAL_ID);
  }, [brain]);

  const devices = useMemo(() => {
    const raw = (brain as any).deviceAssets ?? [];
    return raw.filter((d: any) => d.hospitalId === HOSPITAL_ID);
  }, [brain]);

  const decisions = useMemo(() => {
    return (brain.decisions ?? []).filter((d: any) => d.hospitalId === HOSPITAL_ID);
  }, [brain.decisions]);

  // ---- search-filtered ----
  const q = searchQuery.toLowerCase();

  const filteredItems = useMemo(() => {
    if (!q) return items;
    return items.filter((i: any) =>
      (i.name || '').toLowerCase().includes(q) ||
      (i.nameAr || '').includes(q) ||
      (i.sku || '').toLowerCase().includes(q),
    );
  }, [items, q]);

  const filteredDevices = useMemo(() => {
    if (!q) return devices;
    return devices.filter((d: any) =>
      (d.name || '').toLowerCase().includes(q) ||
      (d.nameAr || '').includes(q) ||
      (d.model || '').toLowerCase().includes(q),
    );
  }, [devices, q]);

  const filteredRequests = useMemo(() => {
    let list = decisions;
    if (requestFilter !== 'all') {
      list = list.filter((d: any) => d.status === requestFilter);
    }
    return list;
  }, [decisions, requestFilter]);

  const approvalDecisions = useMemo(() => {
    return decisions.filter((d: any) => d.approvalChain && d.approvalChain.length > 0);
  }, [decisions]);

  // ---- render helpers ----
  const isRtl = language === 'ar';

  return (
    <div className="min-h-screen bg-[#050a18] text-white" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ========== HEADER ========== */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050a18]/95 backdrop-blur px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {tr('عملياتي', 'My Operations')}
            </h1>
            <p className="mt-0.5 text-sm text-white/50">
              {tr(HOSPITAL_NAME_AR, HOSPITAL_NAME_EN)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400">
              {tr(ROLE_AR, ROLE_EN)}
            </span>
          </div>
        </div>

        {/* ---- Tabs ---- */}
        <nav className="mt-4 flex gap-1 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearchQuery(''); }}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/80'
              }`}
            >
              {tr(tab.labelAr, tab.labelEn)}
            </button>
          ))}
        </nav>
      </header>

      {/* ========== CONTENT ========== */}
      <main className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* ---------- TAB 1: STOCK ---------- */}
        {activeTab === 'stock' && (
          <section>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr('بحث بالاسم أو SKU...', 'Search by name or SKU...')}
                className="w-full sm:w-80 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-cyan-500/50 focus:outline-none"
              />
              <button className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 transition-colors">
                {tr('إنشاء طلب', 'Create Request')}
              </button>
            </div>

            {filteredItems.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-12 text-center">
                <p className="text-white/30 text-sm">{tr('لا توجد أصناف', 'No items found')}</p>
                <p className="text-white/20 text-xs mt-1">{tr('سيتم ملء البيانات من المحاكاة', 'Data will populate from simulation')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03]">
                      <th className="px-4 py-3 text-start font-medium text-white/50">{tr('الصنف', 'Item')}</th>
                      <th className="px-4 py-3 text-start font-medium text-white/50">SKU</th>
                      <th className="px-4 py-3 text-center font-medium text-white/50">{tr('بالمخزن', 'On Hand')}</th>
                      <th className="px-4 py-3 text-center font-medium text-white/50">{tr('متاح', 'Available')}</th>
                      <th className="px-4 py-3 text-start font-medium text-white/50">{tr('الموقع', 'Location')}</th>
                      <th className="px-4 py-3 text-center font-medium text-white/50">{tr('الحالة', 'Status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item: any, idx: number) => {
                      const st = stockStatus(item);
                      return (
                        <tr
                          key={item.id || idx}
                          onClick={() => setSelectedItem(item)}
                          className="border-b border-white/5 cursor-pointer hover:bg-white/[0.04] transition-colors"
                        >
                          <td className="px-4 py-3 text-white/90 font-medium">
                            {isRtl && item.nameAr ? item.nameAr : item.name || '---'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-white/50">{item.sku || '---'}</td>
                          <td className="px-4 py-3 text-center text-white/80">{item.onHand ?? item.quantityOnHand ?? 0}</td>
                          <td className="px-4 py-3 text-center text-white/80">{item.available ?? item.quantityAvailable ?? 0}</td>
                          <td className="px-4 py-3 text-white/60 text-xs">{item.location ?? item.warehouseName ?? '---'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[st]}`} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ---------- TAB 2: DEVICES ---------- */}
        {activeTab === 'devices' && (
          <section>
            <div className="mb-5">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr('بحث بالاسم أو الموديل...', 'Search by name or model...')}
                className="w-full sm:w-80 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-cyan-500/50 focus:outline-none"
              />
            </div>

            {filteredDevices.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-12 text-center">
                <p className="text-white/30 text-sm">{tr('لا توجد أجهزة', 'No devices found')}</p>
                <p className="text-white/20 text-xs mt-1">{tr('سيتم ملء البيانات من المحاكاة', 'Data will populate from simulation')}</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredDevices.map((dev: any, idx: number) => {
                  const isDown = dev.status === 'DOWN';
                  const isMaint = dev.status === 'MAINTENANCE';
                  const borderCls = isDown ? 'border-red-500/40' : isMaint ? 'border-amber-500/30' : 'border-white/5';
                  const statusCls = isDown
                    ? 'bg-red-500/20 text-red-400 animate-pulse'
                    : isMaint
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-emerald-500/20 text-emerald-400';
                  return (
                    <div
                      key={dev.id || idx}
                      onClick={() => setSelectedDevice(dev)}
                      className={`cursor-pointer rounded-xl border ${borderCls} bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-white/90 truncate">
                            {isRtl && dev.nameAr ? dev.nameAr : dev.name || '---'}
                          </p>
                          <p className="text-xs text-white/40 mt-0.5">{dev.model ?? dev.modelNumber ?? ''}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusCls}`}>
                          {dev.status || 'N/A'}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-white/40">
                        <span>{dev.departmentName ?? dev.department ?? '---'}</span>
                        <span>
                          {tr('الصيانة القادمة', 'Next Maint.')}: {dev.nextMaintenance ? fmtDate(dev.nextMaintenance) : '---'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ---------- TAB 3: MY REQUESTS ---------- */}
        {activeTab === 'requests' && (
          <section>
            <div className="flex flex-wrap gap-2 mb-5">
              {REQUEST_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setRequestFilter(f.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    requestFilter === f.key
                      ? 'bg-white/10 text-white'
                      : 'bg-white/[0.03] text-white/40 hover:text-white/70'
                  }`}
                >
                  {tr(f.labelAr, f.labelEn)}
                </button>
              ))}
            </div>

            {filteredRequests.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-12 text-center">
                <p className="text-white/30 text-sm">{tr('لا توجد طلبات', 'No requests found')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map((dec: any, idx: number) => {
                  const isPending = dec.status === 'PENDING_REVIEW' || dec.status === 'PENDING';
                  const isApproved = dec.status === 'APPROVED' || dec.status === 'COMPLETED' || dec.status === 'AUTO_APPROVED';
                  const isRejected = dec.status === 'REJECTED';
                  const statusCls = isApproved
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : isRejected
                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/30';

                  const chain: any[] = dec.approvalChain || [];
                  const currentStep = chain.findIndex((s: any) => s.status === 'PENDING');

                  return (
                    <div
                      key={dec.id || dec.code || idx}
                      onClick={() => setSelectedDecision(dec)}
                      className="cursor-pointer rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {dec.code && <span className="font-mono text-xs text-cyan-400">{dec.code}</span>}
                            {dec.type && (
                              <span className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-white/50">
                                {dec.type.replace(/_/g, ' ')}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 font-medium text-white/90 truncate">
                            {isRtl && dec.titleAr ? dec.titleAr : dec.title || '---'}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusCls}`}>
                          {dec.status || 'N/A'}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-white/40">
                        <span>{tr('تاريخ التقديم', 'Submitted')}: {fmtDate(dec.createdAt)}</span>
                        {currentStep >= 0 && (
                          <span>
                            {tr('الخطوة', 'Step')} {currentStep + 1}/{chain.length}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ---------- TAB 4: APPROVALS ---------- */}
        {activeTab === 'approvals' && (
          <section>
            {approvalDecisions.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-12 text-center">
                <p className="text-white/30 text-sm">{tr('لا توجد موافقات', 'No approvals in scope')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {approvalDecisions.map((dec: any, idx: number) => {
                  const chain: any[] = dec.approvalChain || [];
                  return (
                    <div
                      key={dec.id || dec.code || idx}
                      onClick={() => setSelectedDecision(dec)}
                      className="cursor-pointer rounded-xl border border-white/5 bg-white/[0.02] p-5 hover:bg-white/[0.05] transition-colors"
                    >
                      {/* title row */}
                      <div className="flex items-center gap-2 mb-4">
                        {dec.code && <span className="font-mono text-xs text-cyan-400">{dec.code}</span>}
                        <p className="font-medium text-white/90 truncate flex-1">
                          {isRtl && dec.titleAr ? dec.titleAr : dec.title || '---'}
                        </p>
                      </div>

                      {/* vertical stepper */}
                      <div className="space-y-0">
                        {chain.map((step: any, si: number) => {
                          const isLast = si === chain.length - 1;
                          const isDone = step.status === 'APPROVED' || step.status === 'COMPLETED';
                          const isRej = step.status === 'REJECTED';
                          const isPend = !isDone && !isRej;
                          const dotCls = isDone
                            ? 'bg-emerald-400'
                            : isRej
                              ? 'bg-red-500'
                              : 'bg-amber-400 animate-pulse';
                          const labelCls = isDone
                            ? 'text-emerald-400'
                            : isRej
                              ? 'text-red-400'
                              : 'text-amber-400';

                          return (
                            <div key={si} className="relative flex items-start gap-3 pb-3">
                              {!isLast && (
                                <div className="absolute top-4 h-full w-px bg-white/10" style={isRtl ? { right: 5 } : { left: 5 }} />
                              )}
                              <div className={`relative mt-1.5 h-3 w-3 shrink-0 rounded-full ${dotCls}`} />
                              <div className="flex flex-1 items-center justify-between min-w-0">
                                <span className="text-sm text-white/70 truncate">
                                  {step.role || step.approverRole || `${tr('الخطوة', 'Step')} ${si + 1}`}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-medium ${labelCls}`}>
                                    {isDone
                                      ? tr('تمت', 'Done')
                                      : isRej
                                        ? tr('مرفوض', 'Rejected')
                                        : tr('قيد الانتظار', 'Pending')}
                                  </span>
                                  {isPend && step.timestamp && (
                                    <span className="text-[11px] text-white/30">
                                      {elapsedHours(step.timestamp)}
                                    </span>
                                  )}
                                  {isPend && !step.timestamp && dec.createdAt && (
                                    <span className="text-[11px] text-white/30">
                                      {elapsedHours(dec.createdAt)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ========== DRAWERS ========== */}
      <ItemDetailDrawer
        item={selectedItem}
        open={!!selectedItem}
        onOpenChange={(open) => { if (!open) setSelectedItem(null); }}
      />

      <DeviceDetailDrawer
        device={selectedDevice}
        open={!!selectedDevice}
        onOpenChange={(open) => { if (!open) setSelectedDevice(null); }}
      />

      <DecisionDetailDrawer
        decision={selectedDecision}
        onClose={() => setSelectedDecision(null)}
      />
    </div>
  );
}
