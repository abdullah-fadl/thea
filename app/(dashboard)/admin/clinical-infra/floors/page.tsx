'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { ClinicalInfraCrudPage, type CrudField } from '@/components/admin/clinicalInfra/CrudPage';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function FloorsPage() {
  const { data } = useSWR('/api/clinical-infra/facilities', fetcher);
  const facilities = Array.isArray(data?.items) ? data.items : [];

  const fields: CrudField[] = useMemo(() => {
    const facilityOptions = facilities.map((f: any) => ({ value: String(f.id), label: String(f.name || f.id) }));
    return [
      { key: 'name', label: 'Name', type: 'text', placeholder: 'Floor 2' },
      { key: 'level', label: 'Level (optional)', type: 'text', placeholder: '2' },
      { key: 'facilityId', label: 'Facility', type: 'select', options: facilityOptions },
    ];
  }, [facilities]);

  return <ClinicalInfraCrudPage title="Floors" endpoint="/api/clinical-infra/floors" fields={fields} />;
}

