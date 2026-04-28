'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface InventoryItem {
  id: string;
  medicationId: string;
  medicationName: string;
  medicationNameAr: string;
  genericName: string;
  strength: string;
  form: string; // tablet, capsule, injection, etc.
  manufacturer: string;
  barcode: string;
  currentStock: number;
  minStock: number; // reorder level
  maxStock: number;
  unit: string; // box, strip, vial, etc.
  unitPrice: number;
  expiryDate: string;
  batchNumber: string;
  location: string; // shelf location
  lastUpdated: string;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRED';
}

interface StockMovement {
  id: string;
  medicationId: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'EXPIRED' | 'RETURNED';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  reference?: string; // prescription ID, PO number, etc.
  createdAt: string;
  createdBy: string;
}

type FilterStatus = 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRED' | 'EXPIRING_SOON';

export default function PharmacyInventory() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMovementsModal, setShowMovementsModal] = useState(false);

  // Fetch inventory
  const { data, mutate, isLoading } = useSWR(
    `/api/pharmacy/inventory?search=${encodeURIComponent(search)}&status=${filterStatus}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  const items: InventoryItem[] = data?.items || [];
  const stats = data?.stats || {
    total: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
    expired: 0,
    expiringSoon: 0,
    totalValue: 0,
  };

  // Calculate status based on stock levels
  const getStatusBadge = (item: InventoryItem) => {
    if (item.status === 'EXPIRED' || new Date(item.expiryDate) < new Date()) {
      return { label: tr('\u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629', 'Expired'), color: 'bg-red-100 text-red-700', icon: '\u26D4' };
    }
    if (item.currentStock === 0) {
      return { label: tr('\u0646\u0641\u0630', 'Out of Stock'), color: 'bg-red-100 text-red-700', icon: '\u274C' };
    }
    if (item.currentStock <= item.minStock) {
      return { label: tr('\u0645\u062E\u0632\u0648\u0646 \u0645\u0646\u062E\u0641\u0636', 'Low Stock'), color: 'bg-amber-100 text-amber-700', icon: '\u26A0\uFE0F' };
    }
    // Check if expiring within 90 days
    const daysToExpiry = Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysToExpiry <= 90) {
      return { label: tr(`\u064A\u0646\u062A\u0647\u064A \u062E\u0644\u0627\u0644 ${daysToExpiry} \u064A\u0648\u0645`, `Expires in ${daysToExpiry} days`), color: 'bg-orange-100 text-orange-700', icon: '\u23F0' };
    }
    return { label: tr('\u0645\u062A\u0648\u0641\u0631', 'Available'), color: 'bg-emerald-100 text-emerald-700', icon: '\u2713' };
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tr('\u0645\u062E\u0632\u0648\u0646 \u0627\u0644\u0635\u064A\u062F\u0644\u064A\u0629', 'Pharmacy Inventory')}</h1>
            <p className="text-muted-foreground">{tr('\u0625\u062F\u0627\u0631\u0629 \u0645\u062E\u0632\u0648\u0646 \u0627\u0644\u0635\u064A\u062F\u0644\u064A\u0629', 'Pharmacy Inventory Management')}</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <span>+</span>
            {tr('\u0625\u0636\u0627\u0641\u0629 \u0635\u0646\u0641 \u062C\u062F\u064A\u062F', 'Add New Item')}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="text-3xl font-bold text-foreground">{stats.total}</div>
            <div className="text-sm text-muted-foreground">{tr('\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0623\u0635\u0646\u0627\u0641', 'Total Items')}</div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="text-3xl font-bold text-emerald-600">{stats.inStock}</div>
            <div className="text-sm text-muted-foreground">{tr('\u0645\u062A\u0648\u0641\u0631', 'Available')}</div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="text-3xl font-bold text-amber-600">{stats.lowStock}</div>
            <div className="text-sm text-muted-foreground">{tr('\u0645\u062E\u0632\u0648\u0646 \u0645\u0646\u062E\u0641\u0636', 'Low Stock')}</div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="text-3xl font-bold text-red-600">{stats.outOfStock}</div>
            <div className="text-sm text-muted-foreground">{tr('\u0646\u0641\u0630', 'Out of Stock')}</div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="text-3xl font-bold text-orange-600">{stats.expiringSoon}</div>
            <div className="text-sm text-muted-foreground">{tr('\u0642\u0627\u0631\u0628 \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621', 'Expiring Soon')}</div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="text-2xl font-bold text-blue-600">
              {stats.totalValue?.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')} <span className="text-sm">{tr('\u0631.\u0633', 'SAR')}</span>
            </div>
            <div className="text-sm text-muted-foreground">{tr('\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u062E\u0632\u0648\u0646', 'Inventory Value')}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-2xl border border-border p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tr('\u0628\u062D\u062B \u0628\u0627\u0644\u0627\u0633\u0645\u060C \u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F\u060C \u0623\u0648 \u0631\u0642\u0645 \u0627\u0644\u062F\u0641\u0639\u0629...', 'Search by name, barcode, or batch number...')}
                className="w-full px-4 py-2 border border-border rounded-xl thea-input-focus"
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'ALL', label: tr('\u0627\u0644\u0643\u0644', 'All') },
                { value: 'IN_STOCK', label: tr('\u0645\u062A\u0648\u0641\u0631', 'Available') },
                { value: 'LOW_STOCK', label: tr('\u0645\u0646\u062E\u0641\u0636', 'Low') },
                { value: 'OUT_OF_STOCK', label: tr('\u0646\u0641\u0630', 'Out') },
                { value: 'EXPIRING_SOON', label: tr('\u0642\u0627\u0631\u0628 \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621', 'Expiring') },
                { value: 'EXPIRED', label: tr('\u0645\u0646\u062A\u0647\u064A', 'Expired') },
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setFilterStatus(filter.value as FilterStatus)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                    filterStatus === filter.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 text-right text-sm text-muted-foreground">
                  <th className="px-4 py-3 font-medium">{tr('\u0627\u0644\u062F\u0648\u0627\u0621', 'Medication')}</th>
                  <th className="px-4 py-3 font-medium">{tr('\u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F', 'Barcode')}</th>
                  <th className="px-4 py-3 font-medium">{tr('\u0627\u0644\u0645\u062E\u0632\u0648\u0646', 'Stock')}</th>
                  <th className="px-4 py-3 font-medium">{tr('\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u062F\u0646\u0649', 'Min Level')}</th>
                  <th className="px-4 py-3 font-medium">{tr('\u0627\u0644\u0633\u0639\u0631', 'Price')}</th>
                  <th className="px-4 py-3 font-medium">{tr('\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621', 'Expiry Date')}</th>
                  <th className="px-4 py-3 font-medium">{tr('\u0627\u0644\u062D\u0627\u0644\u0629', 'Status')}</th>
                  <th className="px-4 py-3 font-medium">{tr('\u0627\u0644\u0625\u062C\u0631\u0627\u0621\u0627\u062A', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      {tr('\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644...', 'Loading...')}
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      {tr('\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0635\u0646\u0627\u0641', 'No items found')}
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const status = getStatusBadge(item);
                    return (
                      <tr key={item.id} className="thea-hover-lift">
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">
                            {item.medicationNameAr || item.medicationName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {item.genericName} {'\u2022'} {item.strength} {'\u2022'} {item.form}
                          </div>
                          <div className="text-xs text-muted-foreground/60">{item.manufacturer}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-muted-foreground">{item.barcode}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${
                            item.currentStock === 0 ? 'text-red-600' :
                            item.currentStock <= item.minStock ? 'text-amber-600' :
                            'text-foreground'
                          }`}>
                            {item.currentStock}
                          </span>
                          <span className="text-muted-foreground text-sm"> {item.unit}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {item.minStock} {item.unit}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {item.unitPrice?.toFixed(2)} {tr('\u0631.\u0633', 'SAR')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm ${
                            new Date(item.expiryDate) < new Date() ? 'text-red-600 font-bold' :
                            Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 90
                              ? 'text-orange-600' : 'text-muted-foreground'
                          }`}>
                            {new Date(item.expiryDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                          </span>
                          <div className="text-xs text-muted-foreground/60">{tr('\u062F\u0641\u0639\u0629:', 'Batch:')} {item.batchNumber}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${status.color}`}>
                            {status.icon} {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                setSelectedItem(item);
                                setShowAdjustModal(true);
                              }}
                              className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm"
                              title={tr('\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u062E\u0632\u0648\u0646', 'Adjust Stock')}
                            >
                              {'\u270F\uFE0F'}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedItem(item);
                                setShowMovementsModal(true);
                              }}
                              className="px-2 py-1 text-muted-foreground hover:bg-muted rounded text-sm"
                              title={tr('\u0633\u062C\u0644 \u0627\u0644\u062D\u0631\u0643\u0627\u062A', 'Movement Log')}
                            >
                              {'\uD83D\uDCCB'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Alert */}
        {stats.lowStock > 0 && (
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
            <div className="flex items-center gap-2 text-amber-800">
              <span className="text-xl">{'\u26A0\uFE0F'}</span>
              <span className="font-medium">
                {tr(`\u064A\u0648\u062C\u062F ${stats.lowStock} \u0635\u0646\u0641 \u0628\u0645\u062E\u0632\u0648\u0646 \u0645\u0646\u062E\u0641\u0636 \u064A\u062D\u062A\u0627\u062C \u0625\u0639\u0627\u062F\u0629 \u0637\u0644\u0628`, `${stats.lowStock} items with low stock need reordering`)}
              </span>
              <button className="mr-auto px-3 py-1 bg-amber-600 text-white rounded-xl text-sm hover:bg-amber-700">
                {tr('\u0639\u0631\u0636 \u062A\u0642\u0631\u064A\u0631 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0637\u0644\u0628', 'View Reorder Report')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Adjust Stock Modal */}
      {showAdjustModal && selectedItem && (
        <AdjustStockModal
          item={selectedItem}
          language={language}
          onClose={() => {
            setShowAdjustModal(false);
            setSelectedItem(null);
          }}
          onSave={() => {
            mutate();
            setShowAdjustModal(false);
            setSelectedItem(null);
          }}
        />
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <AddItemModal
          language={language}
          onClose={() => setShowAddModal(false)}
          onSave={() => {
            mutate();
            setShowAddModal(false);
          }}
        />
      )}

      {/* Stock Movements Modal */}
      {showMovementsModal && selectedItem && (
        <StockMovementsModal
          item={selectedItem}
          language={language}
          onClose={() => {
            setShowMovementsModal(false);
            setSelectedItem(null);
          }}
        />
      )}
    </div>
  );
}

// Adjust Stock Modal Component
function AdjustStockModal({
  item,
  language,
  onClose,
  onSave,
}: {
  item: InventoryItem;
  language: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [adjustmentType, setAdjustmentType] = useState<'ADD' | 'REMOVE' | 'SET'>('ADD');
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (quantity <= 0 && adjustmentType !== 'SET') {
      alert(tr('\u0627\u0644\u0631\u062C\u0627\u0621 \u0625\u062F\u062E\u0627\u0644 \u0643\u0645\u064A\u0629 \u0635\u062D\u064A\u062D\u0629', 'Please enter a valid quantity'));
      return;
    }
    if (!reason.trim()) {
      alert(tr('\u0627\u0644\u0631\u062C\u0627\u0621 \u0625\u062F\u062E\u0627\u0644 \u0633\u0628\u0628 \u0627\u0644\u062A\u0639\u062F\u064A\u0644', 'Please enter an adjustment reason'));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/pharmacy/inventory/adjust', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryId: item.id,
          adjustmentType,
          quantity,
          reason,
        }),
      });

      if (!res.ok) throw new Error('Failed to adjust');
      onSave();
    } catch (error) {
      alert(tr('\u0641\u0634\u0644 \u0641\u064A \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u062E\u0632\u0648\u0646', 'Failed to adjust stock'));
    } finally {
      setSaving(false);
    }
  };

  const getNewStock = () => {
    switch (adjustmentType) {
      case 'ADD':
        return item.currentStock + quantity;
      case 'REMOVE':
        return Math.max(0, item.currentStock - quantity);
      case 'SET':
        return quantity;
      default:
        return item.currentStock;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl max-w-md w-full">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">{tr('\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u062E\u0632\u0648\u0646', 'Adjust Stock')}</h2>
          <p className="text-muted-foreground">{item.medicationNameAr || item.medicationName}</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Current Stock */}
          <div className="bg-muted/50 rounded-xl p-3 flex justify-between">
            <span className="text-muted-foreground">{tr('\u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0627\u0644\u062D\u0627\u0644\u064A:', 'Current Stock:')}</span>
            <span className="font-bold">{item.currentStock} {item.unit}</span>
          </div>

          {/* Adjustment Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{tr('\u0646\u0648\u0639 \u0627\u0644\u062A\u0639\u062F\u064A\u0644', 'Adjustment Type')}</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setAdjustmentType('ADD')}
                className={`px-3 py-2 rounded-xl text-sm font-medium border-2 ${
                  adjustmentType === 'ADD'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-border text-muted-foreground hover:border-border'
                }`}
              >
                {tr('\u2795 \u0625\u0636\u0627\u0641\u0629', '\u2795 Add')}
              </button>
              <button
                onClick={() => setAdjustmentType('REMOVE')}
                className={`px-3 py-2 rounded-xl text-sm font-medium border-2 ${
                  adjustmentType === 'REMOVE'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-border text-muted-foreground hover:border-border'
                }`}
              >
                {tr('\u2796 \u062E\u0635\u0645', '\u2796 Remove')}
              </button>
              <button
                onClick={() => setAdjustmentType('SET')}
                className={`px-3 py-2 rounded-xl text-sm font-medium border-2 ${
                  adjustmentType === 'SET'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-border text-muted-foreground hover:border-border'
                }`}
              >
                {tr('\uD83D\uDD04 \u062A\u062D\u062F\u064A\u062F', '\uD83D\uDD04 Set')}
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {adjustmentType === 'SET' ? tr('\u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0627\u0644\u062C\u062F\u064A\u062F', 'New Stock') : tr('\u0627\u0644\u0643\u0645\u064A\u0629', 'Quantity')}
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              min={0}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
            />
          </div>

          {/* New Stock Preview */}
          <div className="bg-blue-50 rounded-xl p-3 flex justify-between">
            <span className="text-blue-600">{tr('\u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0628\u0639\u062F \u0627\u0644\u062A\u0639\u062F\u064A\u0644:', 'Stock After Adjustment:')}</span>
            <span className="font-bold text-blue-700">{getNewStock()} {item.unit}</span>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('\u0633\u0628\u0628 \u0627\u0644\u062A\u0639\u062F\u064A\u0644', 'Adjustment Reason')} <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus mb-2"
            >
              <option value="">{tr('\u0627\u062E\u062A\u0631 \u0627\u0644\u0633\u0628\u0628...', 'Select reason...')}</option>
              <option value={tr('\u0627\u0633\u062A\u0644\u0627\u0645 \u0637\u0644\u0628\u064A\u0629 \u062C\u062F\u064A\u062F\u0629', 'New order received')}>{tr('\u0627\u0633\u062A\u0644\u0627\u0645 \u0637\u0644\u0628\u064A\u0629 \u062C\u062F\u064A\u062F\u0629', 'New order received')}</option>
              <option value={tr('\u062C\u0631\u062F \u0641\u0639\u0644\u064A', 'Physical count')}>{tr('\u062C\u0631\u062F \u0641\u0639\u0644\u064A', 'Physical count')}</option>
              <option value={tr('\u062A\u0627\u0644\u0641', 'Damaged')}>{tr('\u062A\u0627\u0644\u0641', 'Damaged')}</option>
              <option value={tr('\u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629', 'Expired')}>{tr('\u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629', 'Expired')}</option>
              <option value={tr('\u0645\u0631\u062A\u062C\u0639 \u0645\u0646 \u0627\u0644\u0645\u0631\u064A\u0636', 'Patient return')}>{tr('\u0645\u0631\u062A\u062C\u0639 \u0645\u0646 \u0627\u0644\u0645\u0631\u064A\u0636', 'Patient return')}</option>
              <option value={tr('\u0646\u0642\u0644 \u0628\u064A\u0646 \u0627\u0644\u0641\u0631\u0648\u0639', 'Branch transfer')}>{tr('\u0646\u0642\u0644 \u0628\u064A\u0646 \u0627\u0644\u0641\u0631\u0648\u0639', 'Branch transfer')}</option>
              <option value={tr('\u062A\u0635\u062D\u064A\u062D \u062E\u0637\u0623', 'Error correction')}>{tr('\u062A\u0635\u062D\u064A\u062D \u062E\u0637\u0623', 'Error correction')}</option>
              <option value="other">{tr('\u0633\u0628\u0628 \u0622\u062E\u0631', 'Other')}</option>
            </select>
            {reason === 'other' && (
              <input
                type="text"
                placeholder={tr('\u0627\u0643\u062A\u0628 \u0627\u0644\u0633\u0628\u0628...', 'Enter reason...')}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
              />
            )}
          </div>
        </div>

        <div className="p-6 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-muted-foreground hover:text-foreground">
            {tr('\u0625\u0644\u063A\u0627\u0621', 'Cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !reason}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? tr('\u062C\u0627\u0631\u064A \u0627\u0644\u062D\u0641\u0638...', 'Saving...') : tr('\u2713 \u062D\u0641\u0638 \u0627\u0644\u062A\u0639\u062F\u064A\u0644', '\u2713 Save Adjustment')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Add Item Modal Component
function AddItemModal({
  language,
  onClose,
  onSave,
}: {
  language: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [formData, setFormData] = useState({
    medicationName: '',
    medicationNameAr: '',
    genericName: '',
    strength: '',
    form: 'tablet',
    manufacturer: '',
    barcode: '',
    currentStock: 0,
    minStock: 10,
    maxStock: 100,
    unit: 'box',
    unitPrice: 0,
    expiryDate: '',
    batchNumber: '',
    location: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.medicationName || !formData.barcode || !formData.expiryDate) {
      alert(tr('\u0627\u0644\u0631\u062C\u0627\u0621 \u0645\u0644\u0621 \u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0642\u0648\u0644 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629', 'Please fill in all required fields'));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/pharmacy/inventory', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to add');
      onSave();
    } catch (error) {
      alert(tr('\u0641\u0634\u0644 \u0641\u064A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0635\u0646\u0641', 'Failed to add item'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">{tr('\u0625\u0636\u0627\u0641\u0629 \u0635\u0646\u0641 \u062C\u062F\u064A\u062F', 'Add New Item')}</h2>
        </div>

        <div className="p-6 grid grid-cols-2 gap-4">
          {/* Medication Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('\u0627\u0633\u0645 \u0627\u0644\u062F\u0648\u0627\u0621 (English)', 'Medication Name (English)')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.medicationName}
              onChange={(e) => setFormData({ ...formData, medicationName: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('\u0627\u0633\u0645 \u0627\u0644\u062F\u0648\u0627\u0621 (\u0639\u0631\u0628\u064A)', 'Medication Name (Arabic)')}
            </label>
            <input
              type="text"
              value={formData.medicationNameAr}
              onChange={(e) => setFormData({ ...formData, medicationNameAr: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
            />
          </div>

          {/* Generic Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{tr('\u0627\u0644\u0645\u0627\u062F\u0629 \u0627\u0644\u0641\u0639\u0627\u0644\u0629', 'Active Ingredient')}</label>
            <input
              type="text"
              value={formData.genericName}
              onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
            />
          </div>

          {/* Strength */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{tr('\u0627\u0644\u062A\u0631\u0643\u064A\u0632', 'Strength')}</label>
            <input
              type="text"
              value={formData.strength}
              onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
              placeholder={tr('\u0645\u062B\u0627\u0644: 500mg', 'e.g. 500mg')}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
            />
          </div>

          {/* Form */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{tr('\u0627\u0644\u0634\u0643\u0644 \u0627\u0644\u0635\u064A\u062F\u0644\u0627\u0646\u064A', 'Dosage Form')}</label>
            <select
              value={formData.form}
              onChange={(e) => setFormData({ ...formData, form: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
            >
              <option value="tablet">{tr('\u0623\u0642\u0631\u0627\u0635 (Tablet)', 'Tablet')}</option>
              <option value="capsule">{tr('\u0643\u0628\u0633\u0648\u0644\u0627\u062A (Capsule)', 'Capsule')}</option>
              <option value="syrup">{tr('\u0634\u0631\u0627\u0628 (Syrup)', 'Syrup')}</option>
              <option value="injection">{tr('\u062D\u0642\u0646 (Injection)', 'Injection')}</option>
              <option value="cream">{tr('\u0643\u0631\u064A\u0645 (Cream)', 'Cream')}</option>
              <option value="ointment">{tr('\u0645\u0631\u0647\u0645 (Ointment)', 'Ointment')}</option>
              <option value="drops">{tr('\u0642\u0637\u0631\u0629 (Drops)', 'Drops')}</option>
              <option value="inhaler">{tr('\u0628\u062E\u0627\u062E (Inhaler)', 'Inhaler')}</option>
              <option value="suppository">{tr('\u062A\u062D\u0627\u0645\u064A\u0644 (Suppository)', 'Suppository')}</option>
            </select>
          </div>

          {/* Manufacturer */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{tr('\u0627\u0644\u0634\u0631\u0643\u0629 \u0627\u0644\u0645\u0635\u0646\u0639\u0629', 'Manufacturer')}</label>
            <input
              type="text"
              value={formData.manufacturer}
              onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
            />
          </div>

          {/* Barcode */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('\u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F', 'Barcode')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus font-mono"
            />
          </div>

          {/* Batch Number */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{tr('\u0631\u0642\u0645 \u0627\u0644\u062F\u0641\u0639\u0629', 'Batch Number')}</label>
            <input
              type="text"
              value={formData.batchNumber}
              onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
            />
          </div>

          {/* Stock Levels */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{tr('\u0627\u0644\u0643\u0645\u064A\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629', 'Current Quantity')}</label>
            <input
              type="number"
              value={formData.currentStock}
              onChange={(e) => setFormData({ ...formData, currentStock: parseInt(e.target.value) || 0 })}
              min={0}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{tr('\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u062F\u0646\u0649 (\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0637\u0644\u0628)', 'Min Level (Reorder)')}</label>
            <input
              type="number"
              value={formData.minStock}
              onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value) || 0 })}
              min={0}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
            />
          </div>

          {/* Unit */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{tr('\u0648\u062D\u062F\u0629 \u0627\u0644\u0642\u064A\u0627\u0633', 'Unit')}</label>
            <select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
            >
              <option value="box">{tr('\u0639\u0644\u0628\u0629', 'Box')}</option>
              <option value="strip">{tr('\u0634\u0631\u064A\u0637', 'Strip')}</option>
              <option value="bottle">{tr('\u0632\u062C\u0627\u062C\u0629', 'Bottle')}</option>
              <option value="vial">{tr('\u0641\u064A\u0627\u0644', 'Vial')}</option>
              <option value="ampoule">{tr('\u0623\u0645\u0628\u0648\u0644', 'Ampoule')}</option>
              <option value="tube">{tr('\u0623\u0646\u0628\u0648\u0628', 'Tube')}</option>
              <option value="piece">{tr('\u0642\u0637\u0639\u0629', 'Piece')}</option>
            </select>
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{tr('\u0633\u0639\u0631 \u0627\u0644\u0648\u062D\u062F\u0629 (\u0631.\u0633)', 'Unit Price (SAR)')}</label>
            <input
              type="number"
              value={formData.unitPrice}
              onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
              min={0}
              step={0.01}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
            />
          </div>

          {/* Expiry Date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621', 'Expiry Date')} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.expiryDate}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{tr('\u0645\u0648\u0642\u0639 \u0627\u0644\u062A\u062E\u0632\u064A\u0646', 'Storage Location')}</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder={tr('\u0645\u062B\u0627\u0644: \u0631\u0641 A-3', 'e.g. Shelf A-3')}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
            />
          </div>
        </div>

        <div className="p-6 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-muted-foreground hover:text-foreground">
            {tr('\u0625\u0644\u063A\u0627\u0621', 'Cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? tr('\u062C\u0627\u0631\u064A \u0627\u0644\u062D\u0641\u0638...', 'Saving...') : tr('\u2713 \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0635\u0646\u0641', '\u2713 Add Item')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Stock Movements Modal
function StockMovementsModal({
  item,
  language,
  onClose,
}: {
  item: InventoryItem;
  language: string;
  onClose: () => void;
}) {
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { data } = useSWR(`/api/pharmacy/inventory/${item.id}/movements`, fetcher);
  const movements: StockMovement[] = data?.movements || [];

  const getMovementBadge = (type: StockMovement['type']) => {
    switch (type) {
      case 'IN':
        return { label: tr('\u0625\u0636\u0627\u0641\u0629', 'Added'), color: 'bg-emerald-100 text-emerald-700', icon: '\u2795' };
      case 'OUT':
        return { label: tr('\u0635\u0631\u0641', 'Dispensed'), color: 'bg-blue-100 text-blue-700', icon: '\u2796' };
      case 'ADJUSTMENT':
        return { label: tr('\u062A\u0639\u062F\u064A\u0644', 'Adjusted'), color: 'bg-amber-100 text-amber-700', icon: '\uD83D\uDD04' };
      case 'EXPIRED':
        return { label: tr('\u0645\u0646\u062A\u0647\u064A', 'Expired'), color: 'bg-red-100 text-red-700', icon: '\u26D4' };
      case 'RETURNED':
        return { label: tr('\u0645\u0631\u062A\u062C\u0639', 'Returned'), color: 'bg-purple-100 text-purple-700', icon: '\u21A9\uFE0F' };
      default:
        return { label: type, color: 'bg-muted text-foreground', icon: '\u2022' };
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">{tr('\u0633\u062C\u0644 \u062D\u0631\u0643\u0627\u062A \u0627\u0644\u0645\u062E\u0632\u0648\u0646', 'Stock Movement Log')}</h2>
          <p className="text-muted-foreground">{item.medicationNameAr || item.medicationName}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {movements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{tr('\u0644\u0627 \u062A\u0648\u062C\u062F \u062D\u0631\u0643\u0627\u062A \u0645\u0633\u062C\u0644\u0629', 'No movements recorded')}</div>
          ) : (
            <div className="space-y-3">
              {movements.map((movement) => {
                const badge = getMovementBadge(movement.type);
                return (
                  <div key={movement.id} className="p-3 bg-muted/50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${badge.color}`}>
                        {badge.icon} {badge.label}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(movement.createdAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        {movement.previousStock} {'\u2192'} {movement.newStock}
                      </span>
                      <span className={movement.type === 'IN' || movement.type === 'RETURNED' ? 'text-emerald-600' : 'text-red-600'}>
                        {movement.type === 'IN' || movement.type === 'RETURNED' ? '+' : '-'}{movement.quantity}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{movement.reason}</div>
                    {movement.reference && (
                      <div className="text-xs text-muted-foreground/60 mt-1">{tr('\u0627\u0644\u0645\u0631\u062C\u0639:', 'Ref:')} {movement.reference}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-muted text-foreground rounded-xl hover:bg-muted">
            {tr('\u0625\u063A\u0644\u0627\u0642', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}
