'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Search, Plus, X, RefreshCw, Package, Check } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import { v4 as uuidv4 } from 'uuid';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// ── Props ────────────────────────────────────────────────────────────────────

interface AddOrderDialogProps {
  patientId: string;
  encounterCoreId: string;
  departmentKey: string;
  kind: string; // LAB | RADIOLOGY | MEDICATION | PROCEDURE
  onComplete: () => void;
  onCancel: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function AddOrderDialog({
  patientId,
  encounterCoreId,
  departmentKey,
  kind,
  onComplete,
  onCancel,
}: AddOrderDialogProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [catalogSearch, setCatalogSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedCodes, setAddedCodes] = useState<Set<string>>(new Set());

  // Map kind to departmentDomain for charge catalog query
  const domainMap: Record<string, string> = {
    LAB: 'LAB',
    RADIOLOGY: 'RAD',
    MEDICATION: 'OTHER',
    PROCEDURE: 'OR',
  };
  const domain = domainMap[kind] || '';

  const shouldSearchCatalog = catalogSearch.trim().length >= 2;
  const { data: catalogData, isLoading: catalogLoading } = useSWR(
    shouldSearchCatalog
      ? `/api/billing/charge-catalog?search=${encodeURIComponent(catalogSearch.trim())}&departmentDomain=${domain}&limit=20`
      : null,
    fetcher,
    { dedupingInterval: 500 }
  );
  const catalogItems = catalogData?.items || [];

  const handleAddOrder = async (item: any) => {
    if (!encounterCoreId) {
      setError(tr('لا توجد زيارة نشطة للمريض', 'No active encounter for this patient'));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/orders', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterCoreId,
          kind,
          orderCode: item.code || item.id,
          orderName: item.name || item.code,
          departmentKey,
          priority: 'ROUTINE',
          idempotencyKey: uuidv4(),
          meta: {
            addedByReception: true,
            price: item.basePrice || 0,
            unitPrice: item.basePrice || 0,
            totalPrice: item.basePrice || 0,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || tr('فشل إضافة الطلب', 'Failed to add order'));
      }

      setAddedCodes((prev) => new Set([...prev, item.code || item.id]));
    } catch (err: any) {
      setError(err.message || tr('حدث خطأ', 'An error occurred'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Plus className="w-5 h-5" />
            {tr('إضافة كود جديد', 'Add new order code')}
          </h2>
          <button
            onClick={() => {
              if (addedCodes.size > 0) {
                onComplete();
              } else {
                onCancel();
              }
            }}
            className="p-2 hover:bg-muted rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Search ──────────────────────────────────────────────────────── */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={tr('ابحث بالكود أو الاسم...', 'Search by code or name...')}
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 border border-border rounded-xl thea-input-focus bg-card text-foreground"
              autoFocus
            />
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>

        {/* ── Results ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4">
          {catalogLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin inline mr-2" />
              {tr('جاري البحث...', 'Searching...')}
            </div>
          )}

          {shouldSearchCatalog && !catalogLoading && catalogItems.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {tr('لا توجد نتائج', 'No results found')}
            </div>
          )}

          {!shouldSearchCatalog && !catalogLoading && (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{tr('ابحث عن كود للإضافة', 'Search for a code to add')}</p>
            </div>
          )}

          {catalogItems.length > 0 && (
            <div className="space-y-2">
              {catalogItems.map((item: any) => {
                const isAdded = addedCodes.has(item.code || item.id);
                return (
                  <div
                    key={item.id || item.code}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        {(language === 'ar' ? item.nameAr : null) || item.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.code}
                        {item.basePrice != null && (
                          <span className="mx-2">
                            • {Number(item.basePrice).toFixed(2)} {tr('ر.س', 'SAR')}
                          </span>
                        )}
                      </p>
                    </div>
                    {isAdded ? (
                      <span className="text-sm text-green-600 font-medium px-3">
                        {tr('تمت الإضافة', 'Added')} <Check className="h-3.5 w-3.5 inline-block" />
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAddOrder(item)}
                        disabled={submitting}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50"
                      >
                        {submitting ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        {tr('إضافة', 'Add')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        {addedCodes.size > 0 && (
          <div className="p-4 border-t border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {tr(`تم إضافة ${addedCodes.size} كود`, `${addedCodes.size} code(s) added`)}
              </p>
              <button
                onClick={onComplete}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-medium"
              >
                {tr('تم', 'Done')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
