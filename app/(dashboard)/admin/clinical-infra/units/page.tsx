'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { ClinicalInfraCrudPage, type CrudField } from '@/components/admin/clinicalInfra/CrudPage';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function UnitsPage() {
  const { data } = useSWR('/api/clinical-infra/facilities', fetcher);
  const facilities = Array.isArray(data?.items) ? data.items : [];

  const fields: CrudField[] = useMemo(() => {
    const facilityOptions = facilities.map((f: any) => ({ value: String(f.id), label: String(f.name || f.id) }));
    return [
      { key: 'name', label: 'Name', type: 'text', placeholder: 'ER' },
      { key: 'code', label: 'Code (optional)', type: 'text', placeholder: 'ER-A' },
      {
        key: 'unitType',
        label: 'Unit Type',
        type: 'select',
        options: ['OPD', 'ER', 'IPD', 'ICU', 'OR', 'LAB', 'RAD', 'OTHER'].map((v) => ({ value: v, label: v })),
      },
      { key: 'facilityId', label: 'Facility', type: 'select', options: facilityOptions },
      { key: 'samNodeId', label: 'SAM Node Link (optional)', type: 'text', placeholder: '(read-only link)' },
    ];
  }, [facilities]);

  return <ClinicalInfraCrudPage title="Clinical Units" endpoint="/api/clinical-infra/units" fields={fields} />;
}

