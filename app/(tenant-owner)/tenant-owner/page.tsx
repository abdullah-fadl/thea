'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState } from 'react';

interface Hospital {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
}

export default function TenantOwnerPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/tenant-owner/hospitals')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => setHospitals(data.items ?? []))
      .catch(() => setError(tr('تعذّر تحميل المستشفيات', 'Failed to load hospitals')))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main
      className="p-8 max-w-4xl mx-auto"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <h1 className="text-2xl font-bold mb-6">
        {tr('لوحة تحكم مالك المستأجر', 'Tenant Owner Dashboard')}
      </h1>

      <section>
        <h2 className="text-lg font-semibold mb-4">
          {tr('المستشفيات', 'Hospitals')}
        </h2>

        {loading && (
          <p className="text-gray-500">{tr('جارٍ التحميل…', 'Loading…')}</p>
        )}

        {error && <p className="text-red-600">{error}</p>}

        {!loading && !error && hospitals.length === 0 && (
          <p className="text-gray-500">
            {tr('لا توجد مستشفيات بعد.', 'No hospitals yet.')}
          </p>
        )}

        {!loading && !error && hospitals.length > 0 && (
          <ul className="divide-y border rounded-md">
            {hospitals.map((h) => (
              <li key={h.id} className="px-4 py-3 flex items-center justify-between">
                <span className="font-medium">{h.name}</span>
                <span className="text-sm text-gray-500">
                  {h.code ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-xs text-gray-400">
        {tr(
          'صفحة مؤقتة — ستُضاف واجهة إدارة كاملة في مرحلة لاحقة.',
          'Placeholder page — full management UI deferred to a later phase.',
        )}
      </p>
    </main>
  );
}
