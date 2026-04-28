'use client';

import { useState, useMemo } from 'react';
import { useLang } from '@/hooks/use-lang';
import { useImdadBrain } from '@/hooks/imdad/use-imdad-brain';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntityType = 'item' | 'device' | 'request';

interface SearchResult {
  type: EntityType;
  id: string;
  label: string;
  labelAr?: string;
  code?: string;
  status?: string;
  raw: any;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(status: string | undefined): string {
  if (!status) return 'bg-gray-500';
  const s = status.toUpperCase();
  if (['ACTIVE', 'APPROVED', 'COMPLETED', 'IN_STOCK', 'AVAILABLE'].includes(s)) return 'bg-emerald-500';
  if (['DOWN', 'REJECTED', 'EXPIRED', 'CRITICAL', 'OUT_OF_STOCK'].includes(s)) return 'bg-red-500';
  if (['MAINTENANCE', 'PENDING', 'IN_TRANSIT', 'PENDING_APPROVAL', 'REVIEW'].includes(s)) return 'bg-amber-500';
  return 'bg-cyan-500';
}

function statusTextColor(status: string | undefined): string {
  if (!status) return 'text-gray-400';
  const s = status.toUpperCase();
  if (['ACTIVE', 'APPROVED', 'COMPLETED', 'IN_STOCK', 'AVAILABLE'].includes(s)) return 'text-emerald-400';
  if (['DOWN', 'REJECTED', 'EXPIRED', 'CRITICAL', 'OUT_OF_STOCK'].includes(s)) return 'text-red-400';
  if (['MAINTENANCE', 'PENDING', 'IN_TRANSIT', 'PENDING_APPROVAL', 'REVIEW'].includes(s)) return 'text-amber-400';
  return 'text-cyan-400';
}

function formatDate(d: string | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-CA');
  } catch {
    return d;
  }
}

function formatDateTime(d: string | undefined): string {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return `${dt.toLocaleDateString('en-CA')} ${dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return d;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TracePage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const brain = useImdadBrain();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SearchResult | null>(null);

  // ---- Search across all entity types ----
  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const out: SearchResult[] = [];

    // Items
    (brain.inventoryItems || []).forEach((item: any) => {
      const searchable = [item.name, item.nameAr, item.sku, item.code, item.serialNumber, item.id].filter(Boolean).join(' ').toLowerCase();
      if (searchable.includes(q)) {
        out.push({ type: 'item', id: item.id || item.sku || item.code, label: item.name || item.sku || 'Item', labelAr: item.nameAr, code: item.sku || item.code, status: item.status, raw: item });
      }
    });

    // Devices
    (brain.deviceAssets || []).forEach((dev: any) => {
      const searchable = [dev.name, dev.nameAr, dev.serialNumber, dev.model, dev.code, dev.id, dev.assetTag].filter(Boolean).join(' ').toLowerCase();
      if (searchable.includes(q)) {
        out.push({ type: 'device', id: dev.id || dev.serialNumber || dev.code, label: dev.name || dev.model || 'Device', labelAr: dev.nameAr, code: dev.serialNumber || dev.assetTag || dev.code, status: dev.status, raw: dev });
      }
    });

    // Requests
    (brain.requests || []).forEach((req: any) => {
      const searchable = [req.code, req.title, req.titleAr, req.id, req.requestedBy].filter(Boolean).join(' ').toLowerCase();
      if (searchable.includes(q)) {
        out.push({ type: 'request', id: req.id || req.code, label: req.title || req.code || 'Request', labelAr: req.titleAr, code: req.code, status: req.status, raw: req });
      }
    });

    return out.slice(0, 50);
  }, [query, brain.inventoryItems, brain.deviceAssets, brain.requests]);

  const groupedResults = useMemo(() => {
    const groups: Record<EntityType, SearchResult[]> = { item: [], device: [], request: [] };
    results.forEach((r) => groups[r.type].push(r));
    return groups;
  }, [results]);

  const typeLabel = (t: EntityType) => {
    switch (t) {
      case 'item': return tr('المواد والمستهلكات', 'Items & Consumables');
      case 'device': return tr('الأجهزة والأصول', 'Devices & Assets');
      case 'request': return tr('الطلبات', 'Requests');
    }
  };

  const typeIcon = (t: EntityType) => {
    switch (t) {
      case 'item': return '\u25A3';
      case 'device': return '\u2699';
      case 'request': return '\u2709';
    }
  };

  // ---- Audit log for selected entity ----
  const entityAudit = useMemo(() => {
    if (!selected) return [];
    if (selected.type === 'request') {
      return brain.getAuditLog(selected.id) || [];
    }
    // For items/devices try matching audit entries
    return (brain.auditLog || []).filter((entry: any) => {
      const eid = selected.id;
      return entry.entityId === eid || entry.itemId === eid || entry.deviceId === eid || entry.referenceId === eid;
    });
  }, [selected, brain]);

  // ---- Render ----
  return (
    <div className="min-h-screen bg-[#050a18] text-white p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {tr('تتبع وتعقب', 'Trace & Track')}
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              {tr('ابحث عن أي مادة أو جهاز أو طلب واعرض سلسلة الملكية والتاريخ الكامل', 'Look up any item, device, or request and view its full ownership chain and history')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-500 font-mono">{tr('دورة', 'CYCLE')} #{brain.cycleCount}</span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-4">
          <div className="relative">
            <span className="absolute top-1/2 -translate-y-1/2 text-gray-500 text-lg" style={{ [language === 'ar' ? 'right' : 'left']: 14 }}>&#x1F50D;</span>
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
              placeholder={tr('ابحث بالرقم أو الاسم أو الرقم التسلسلي', 'Search by code, name, or serial number')}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
              style={{ [language === 'ar' ? 'paddingRight' : 'paddingLeft']: 44, [language === 'ar' ? 'paddingLeft' : 'paddingRight']: 16 }}
            />
          </div>
        </div>

        {/* Back button when entity selected */}
        {selected && (
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <span>{language === 'ar' ? '\u2192' : '\u2190'}</span>
            {tr('العودة للنتائج', 'Back to results')}
          </button>
        )}

        {/* Search Results (when not selected) */}
        {!selected && query.trim().length >= 2 && (
          <div className="space-y-5">
            {results.length === 0 && (
              <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-8 text-center">
                <p className="text-gray-500 text-sm">{tr('لم يتم العثور على نتائج تطابق بحثك', 'No results match your search')}</p>
                <p className="text-gray-600 text-xs mt-1">{tr('جرب البحث بالرقم التسلسلي أو رمز الصنف أو اسم الجهاز', 'Try searching by serial number, item code, or device name')}</p>
              </div>
            )}
            {(['item', 'device', 'request'] as EntityType[]).map((type) => {
              const group = groupedResults[type];
              if (group.length === 0) return null;
              return (
                <div key={type} className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
                  <h2 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                    <span>{typeIcon(type)}</span>
                    {typeLabel(type)}
                    <span className="text-[10px] font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{group.length}</span>
                  </h2>
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {group.map((r) => (
                      <button
                        key={`${r.type}-${r.id}`}
                        onClick={() => setSelected(r)}
                        className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] hover:border-cyan-500/20 transition-all text-left"
                        dir={language === 'ar' ? 'rtl' : 'ltr'}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs text-gray-300 truncate">{language === 'ar' ? (r.labelAr || r.label) : r.label}</span>
                          {r.code && <span className="text-[10px] font-mono text-gray-600">{r.code}</span>}
                        </div>
                        {r.status && (
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${statusColor(r.status)} bg-opacity-20 ${statusTextColor(r.status)}`}>
                            {r.status}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ---- Trace Panel: Item ---- */}
        {selected?.type === 'item' && <ItemTracePanel item={selected.raw} audit={entityAudit} tr={tr} language={language} />}

        {/* ---- Trace Panel: Device ---- */}
        {selected?.type === 'device' && <DeviceTracePanel device={selected.raw} audit={entityAudit} tr={tr} language={language} />}

        {/* ---- Trace Panel: Request ---- */}
        {selected?.type === 'request' && <RequestTracePanel request={selected.raw} audit={entityAudit} tr={tr} language={language} />}
      </div>
    </div>
  );
}

// ===========================================================================
// Item Trace Panel
// ===========================================================================

function ItemTracePanel({ item, audit, tr, language }: { item: any; audit: any[]; tr: (ar: string, en: string) => string; language: string }) {
  return (
    <div className="space-y-5">
      {/* Current Owner */}
      <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
        <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('الحالة الحالية', 'Current State')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Field label={tr('الاسم', 'Name')} value={language === 'ar' ? (item.nameAr || item.name) : item.name} />
          <Field label={tr('رمز الصنف', 'SKU')} value={item.sku || item.code} mono />
          <Field label={tr('المستشفى', 'Hospital')} value={language === 'ar' ? (item.hospitalNameAr || item.hospitalName) : item.hospitalName} />
          <Field label={tr('القسم', 'Department')} value={language === 'ar' ? (item.departmentNameAr || item.departmentName || item.department) : (item.departmentName || item.department)} />
          <Field label={tr('الموقع', 'Location')} value={item.location || item.warehouseName || item.warehouse} />
          <Field label={tr('المصنّع', 'Manufacturer')} value={item.manufacturer} />
          <Field label={tr('الحالة', 'Status')} value={item.status} badge />
          <Field label={tr('الكمية المتوفرة', 'On Hand')} value={item.onHand ?? item.quantity ?? item.quantityOnHand} mono />
          <Field label={tr('متاح', 'Available')} value={item.available ?? item.quantityAvailable} mono />
          <Field label={tr('محجوز', 'Reserved')} value={item.reserved ?? item.quantityReserved ?? 0} mono />
          <Field label={tr('قيد النقل', 'In Transit')} value={item.inTransit ?? item.quantityInTransit ?? 0} mono />
          <Field label={tr('نقطة إعادة الطلب', 'Reorder Point')} value={item.reorderPoint ?? item.minStock} mono />
          <Field label={tr('تاريخ الانتهاء', 'Expiry Date')} value={formatDate(item.expiryDate || item.expiry)} />
        </div>
      </div>

      {/* Movement History */}
      <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
        <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('سجل الحركة', 'Movement History')}</h2>
        {audit.length > 0 ? (
          <Timeline entries={audit} tr={tr} language={language} />
        ) : (
          <div className="py-6 text-center text-gray-500 text-xs">
            <p>{tr('لا يوجد سجل حركة مسجّل حتى الآن', 'No movement history recorded yet')}</p>
            <p className="mt-1 text-gray-600">{tr('ستظهر الحركات هنا عند حدوث أي تحويل أو استهلاك أو إعادة تخزين', 'Transfers, consumption, and restocking events will appear here')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// Device Trace Panel
// ===========================================================================

function DeviceTracePanel({ device, audit, tr, language }: { device: any; audit: any[]; tr: (ar: string, en: string) => string; language: string }) {
  return (
    <div className="space-y-5">
      {/* Current State */}
      <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
        <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('حالة الجهاز', 'Device State')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Field label={tr('الاسم', 'Name')} value={language === 'ar' ? (device.nameAr || device.name) : device.name} />
          <Field label={tr('الحالة', 'Status')} value={device.status} badge />
          <Field label={tr('الرقم التسلسلي', 'Serial Number')} value={device.serialNumber} mono />
          <Field label={tr('الموديل', 'Model')} value={device.model} />
          <Field label={tr('المصنّع', 'Manufacturer')} value={device.manufacturer} />
          <Field label={tr('المستشفى', 'Hospital')} value={language === 'ar' ? (device.hospitalNameAr || device.hospitalName) : device.hospitalName} />
          <Field label={tr('القسم', 'Department')} value={language === 'ar' ? (device.departmentNameAr || device.departmentName || device.department) : (device.departmentName || device.department)} />
          <Field label={tr('رقم الأصل', 'Asset Tag')} value={device.assetTag || device.code} mono />
          <Field label={tr('آخر صيانة', 'Last Maintenance')} value={formatDate(device.lastMaintenanceDate || device.lastMaintenance)} />
          <Field label={tr('الصيانة القادمة', 'Next Maintenance')} value={formatDate(device.nextMaintenanceDate || device.nextMaintenance)} />
          <Field label={tr('تاريخ الشراء', 'Purchase Date')} value={formatDate(device.purchaseDate)} />
          <Field label={tr('انتهاء الضمان', 'Warranty Expiry')} value={formatDate(device.warrantyExpiry || device.warrantyEnd)} />
        </div>
      </div>

      {/* Assignment History */}
      <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
        <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('سجل التعيين والموقع', 'Assignment & Location History')}</h2>
        {audit.length > 0 ? (
          <Timeline entries={audit} tr={tr} language={language} />
        ) : (
          <div className="py-6 text-center text-gray-500 text-xs">
            <p>{tr('لا يوجد سجل تعيين مسجّل حتى الآن', 'No assignment history recorded yet')}</p>
            <p className="mt-1 text-gray-600">{tr('ستظهر عمليات النقل والتعيين والصيانة هنا', 'Transfers, assignments, and maintenance events will appear here')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// Request Trace Panel
// ===========================================================================

function RequestTracePanel({ request, audit, tr, language }: { request: any; audit: any[]; tr: (ar: string, en: string) => string; language: string }) {
  const approvalChain: any[] = request.approvalChain || request.approvalSteps || request.steps || [];
  const requestItems: any[] = request.items || request.lineItems || [];

  return (
    <div className="space-y-5">
      {/* Request Detail */}
      <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
        <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('تفاصيل الطلب', 'Request Detail')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Field label={tr('الرمز', 'Code')} value={request.code} mono />
          <Field label={tr('النوع', 'Type')} value={request.type || request.requestType} />
          <Field label={tr('الأولوية', 'Priority')} value={request.priority} badge />
          <Field label={tr('الحالة', 'Status')} value={request.status} badge />
          <Field label={tr('مقدم الطلب', 'Requested By')} value={request.requestedBy || request.createdBy} />
          <Field label={tr('القسم', 'Department')} value={language === 'ar' ? (request.departmentNameAr || request.departmentName || request.department) : (request.departmentName || request.department)} />
          <Field label={tr('تاريخ الإنشاء', 'Created')} value={formatDateTime(request.createdAt)} />
          <Field label={tr('خطوة الموافقة الحالية', 'Current Approval Step')} value={request.currentStep || request.currentApprovalStep} />
        </div>

        {/* Line items */}
        {requestItems.length > 0 && (
          <div className="mt-5">
            <h3 className="text-xs font-semibold text-gray-400 mb-2">{tr('المواد المطلوبة', 'Requested Items')}</h3>
            <div className="space-y-1">
              {requestItems.map((li: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <span className="text-xs text-gray-300">{language === 'ar' ? (li.nameAr || li.name || li.itemName) : (li.name || li.itemName)}</span>
                  <div className="flex items-center gap-3">
                    {li.sku && <span className="text-[10px] font-mono text-gray-600">{li.sku}</span>}
                    <span className="text-xs font-mono text-white">{li.quantity ?? li.qty ?? '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Approval Chain */}
      <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
        <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('سلسلة الموافقات', 'Approval Chain')}</h2>
        {approvalChain.length > 0 ? (
          <div className="space-y-0">
            {approvalChain.map((step: any, i: number) => {
              const stepStatus = (step.status || '').toUpperCase();
              const isApproved = stepStatus === 'APPROVED' || stepStatus === 'COMPLETED';
              const isRejected = stepStatus === 'REJECTED';
              const isPending = !isApproved && !isRejected;
              const isLast = i === approvalChain.length - 1;

              return (
                <div key={i} className="flex gap-3">
                  {/* Stepper line */}
                  <div className="flex flex-col items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                      isApproved ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' :
                      isRejected ? 'border-red-500 bg-red-500/20 text-red-400' :
                      'border-amber-500 bg-amber-500/20 text-amber-400'
                    }`}>
                      {isApproved ? '\u2713' : isRejected ? '\u2717' : (i + 1)}
                    </div>
                    {!isLast && <div className="w-px h-8 bg-white/10" />}
                  </div>
                  {/* Step info */}
                  <div className="pb-4 min-w-0">
                    <p className="text-xs text-white font-medium">{step.role || step.approverRole || step.stepName || `${tr('خطوة', 'Step')} ${i + 1}`}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-[10px] font-mono ${isApproved ? 'text-emerald-400' : isRejected ? 'text-red-400' : 'text-amber-400'}`}>
                        {step.status || tr('معلّق', 'PENDING')}
                      </span>
                      {step.approvedBy && <span className="text-[10px] text-gray-500">{step.approvedBy}</span>}
                      {(step.approvedAt || step.timestamp) && <span className="text-[10px] text-gray-600">{formatDateTime(step.approvedAt || step.timestamp)}</span>}
                    </div>
                    {step.comments && <p className="text-[10px] text-gray-500 mt-1">{step.comments}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-gray-500 text-xs">
            <p>{tr('لا توجد خطوات موافقة مسجّلة لهذا الطلب', 'No approval steps recorded for this request')}</p>
          </div>
        )}
      </div>

      {/* Audit Trail */}
      <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
        <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('السجل التدقيقي', 'Audit Trail')}</h2>
        {audit.length > 0 ? (
          <Timeline entries={audit} tr={tr} language={language} />
        ) : (
          <div className="py-6 text-center text-gray-500 text-xs">
            <p>{tr('لا توجد إدخالات تدقيق مسجّلة حتى الآن', 'No audit entries recorded yet')}</p>
            <p className="mt-1 text-gray-600">{tr('ستظهر هنا جميع التغييرات والإجراءات المتخذة على هذا الطلب', 'All changes and actions taken on this request will appear here')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// Shared: Field
// ===========================================================================

function Field({ label, value, mono, badge }: { label: string; value: any; mono?: boolean; badge?: boolean }) {
  const display = value !== undefined && value !== null && value !== '' ? String(value) : '—';
  return (
    <div>
      <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>
      {badge && display !== '—' ? (
        <span className={`inline-block text-xs font-mono px-2 py-0.5 rounded ${statusColor(display)} bg-opacity-20 ${statusTextColor(display)}`}>
          {display}
        </span>
      ) : (
        <p className={`text-sm ${mono ? 'font-mono' : ''} text-white`}>{display}</p>
      )}
    </div>
  );
}

// ===========================================================================
// Shared: Timeline
// ===========================================================================

function Timeline({ entries, tr, language }: { entries: any[]; tr: (ar: string, en: string) => string; language: string }) {
  const sorted = [...entries].sort((a, b) => {
    const ta = new Date(a.timestamp || a.createdAt || a.at || 0).getTime();
    const tb = new Date(b.timestamp || b.createdAt || b.at || 0).getTime();
    return tb - ta; // newest first
  });

  return (
    <div className="space-y-0 max-h-[400px] overflow-y-auto">
      {sorted.map((entry, i) => {
        const isLast = i === sorted.length - 1;
        const action = entry.action || entry.event || entry.type || entry.what || tr('إجراء', 'Action');
        const who = entry.performedBy || entry.actor || entry.who || entry.userId || '—';
        const when = formatDateTime(entry.timestamp || entry.createdAt || entry.at);
        const stateChange = entry.stateChange || entry.fromTo || entry.transition;
        const notes = entry.notes || entry.comments || entry.details;

        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-500/60 border border-cyan-400/40 mt-1" />
              {!isLast && <div className="w-px flex-1 bg-white/10 min-h-[24px]" />}
            </div>
            <div className="pb-3 min-w-0">
              <p className="text-xs text-white font-medium">{action}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[10px] text-gray-500">{who}</span>
                <span className="text-[10px] text-gray-600">{when}</span>
              </div>
              {stateChange && (
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {stateChange.from && <span>{stateChange.from}</span>}
                  {stateChange.from && stateChange.to && <span className="mx-1 text-gray-600">{'\u2192'}</span>}
                  {stateChange.to && <span className={statusTextColor(stateChange.to)}>{stateChange.to}</span>}
                </p>
              )}
              {notes && <p className="text-[10px] text-gray-600 mt-0.5">{notes}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
