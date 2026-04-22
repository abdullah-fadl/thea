'use client';

import { useState } from 'react';
import { Search, Plus, Minus, Trash2, Package } from 'lucide-react';
import useSWR from 'swr';

export interface ServiceItem {
  id: string;
  code: string;
  name: string;
  nameEn?: string;
  price: number;
  quantity: number;
  category?: string;
}

interface Props {
  services: ServiceItem[];
  onServicesChange: (services: ServiceItem[]) => void;
  specialtyCode?: string;
  providerId?: string;
  language?: 'ar' | 'en';
}

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const CATALOG_OPTIONS = [
  { value: 'all', labelAr: 'جميع الكتالوجات', labelEn: 'All catalogs' },
  { value: 'services', labelAr: 'الخدمات', labelEn: 'Services' },
  { value: 'imaging', labelAr: 'الأشعة', labelEn: 'Radiology' },
  { value: 'lab', labelAr: 'المختبر', labelEn: 'Lab' },
  { value: 'procedure', labelAr: 'الإجراءات', labelEn: 'Procedures' },
  { value: 'medication', labelAr: 'الأدوية', labelEn: 'Medications' },
  { value: 'supply', labelAr: 'المستهلكات', labelEn: 'Supplies' },
];

export function ServiceSelector({ services, onServicesChange, specialtyCode, language = 'ar' }: Props) {
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [search, setSearch] = useState('');
  const [catalogFilter, setCatalogFilter] = useState('all');
  const [showCatalog, setShowCatalog] = useState(false);

  const params = new URLSearchParams();
  params.set('catalog', catalogFilter);
  if (search.trim()) params.set('search', search.trim());
  params.set('limit', '50');

  const { data: catalogData } = useSWR(
    showCatalog ? `/api/billing/invoice-items?${params.toString()}` : null,
    fetcher
  );

  const catalogItems = catalogData?.items || [];

  const addService = (item: any) => {
    const id = item.id || `chg:${item.code}`;
    const existing = services.find((s) => s.id === id);
    const price = item.basePrice ?? item.price ?? 0;
    const name = item.nameAr || item.nameEn || item.name;
    const nameEn = item.nameEn || item.name;
    const category = item.itemType || item.serviceType || item.category;

    if (existing) {
      onServicesChange(
        services.map((s) => (s.id === id ? { ...s, quantity: s.quantity + 1 } : s))
      );
    } else {
      onServicesChange([
        ...services,
        { id, code: item.code, name, nameEn, price: Number(price), quantity: 1, category },
      ]);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    onServicesChange(
      services.map((s) => {
        if (s.id === id) {
          const newQty = Math.max(1, s.quantity + delta);
          return { ...s, quantity: newQty };
        }
        return s;
      })
    );
  };

  const removeService = (id: string) => {
    onServicesChange(services.filter((s) => s.id !== id));
  };

  return (
    <div className="space-y-4">
      {services.length > 0 && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b">
            <h4 className="font-medium text-slate-900">{tr('الخدمات المحددة', 'Selected services')}</h4>
          </div>
          <div className="divide-y">
            {services.map((service) => (
              <div key={service.id} className="p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-medium text-slate-900">{language === 'en' ? (service.nameEn || service.name) : service.name}</div>
                  <div className="text-sm text-slate-500">
                    {service.code} • {tr(`${Number(service.price).toFixed(2)} ر.س`, `SAR ${Number(service.price).toFixed(2)}`)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(service.id, -1)}
                    className="p-1 hover:bg-slate-100 rounded"
                    disabled={service.quantity <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-medium">{service.quantity}</span>
                  <button
                    onClick={() => updateQuantity(service.id, 1)}
                    className="p-1 hover:bg-slate-100 rounded"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="w-24 text-left font-semibold text-slate-900">
                  {tr(`${Number(service.price * service.quantity).toFixed(2)} ر.س`, `SAR ${Number(service.price * service.quantity).toFixed(2)}`)}
                </div>

                <button
                  onClick={() => removeService(service.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setShowCatalog(true)}
        className="w-full p-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        {tr('إضافة خدمة +', 'Add service +')}
      </button>

      {showCatalog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{tr('قائمة الخدمات والإجراءات', 'Services & procedures')}</h3>
                <button
                  onClick={() => setShowCatalog(false)}
                  className="p-1 hover:bg-slate-100 rounded"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="flex gap-2 mb-3">
                <select
                  value={catalogFilter}
                  onChange={(e) => setCatalogFilter(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 border rounded-lg text-sm"
                >
                  {CATALOG_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {tr(opt.labelAr, opt.labelEn)}
                    </option>
                  ))}
                </select>
                <div className="relative flex-[2] min-w-0">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={tr('بحث بالكود أو الاسم...', 'Search by code or name...')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pr-10 pl-4 py-2 border rounded-lg"
                    autoFocus
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {catalogItems.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>{tr('لا توجد نتائج', 'No results')}</p>
                  <p className="text-xs mt-1">
                    {tr('جرّب تغيير الكتالوج أو مصطلحات البحث', 'Try changing catalog or search terms')}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {catalogItems.map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => addService(item)}
                      className="w-full p-4 text-right hover:bg-slate-50 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium text-slate-900">
                          {language === 'en' ? (item.nameEn || item.name || item.nameAr) : (item.nameAr || item.name)}
                        </div>
                        <div className="text-sm text-slate-500">
                          {item.code} • {item.itemType || item.serviceType || item.category || '—'}
                        </div>
                      </div>
                      <div className="text-lg font-semibold text-blue-600">
                        {tr(`${Number(item.basePrice ?? item.price ?? 0).toFixed(2)} ر.س`, `SAR ${Number(item.basePrice ?? item.price ?? 0).toFixed(2)}`)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
