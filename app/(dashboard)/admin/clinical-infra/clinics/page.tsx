'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { ClinicalInfraCrudPage, type CrudField } from '@/components/admin/clinicalInfra/CrudPage';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function ClinicsPage() {
  const { data: units } = useSWR('/api/clinical-infra/units', fetcher);
  const { data: specs } = useSWR('/api/clinical-infra/specialties', fetcher);
  const unitItems = Array.isArray(units?.items) ? units.items : [];
  const specItems = Array.isArray(specs?.items) ? specs.items : [];

  const fields: CrudField[] = useMemo(() => {
    const unitOptions = unitItems.map((u: any) => ({ value: String(u.id), label: String(u.name || u.id) }));
    const specOptions = specItems.map((s: any) => ({ value: String(s.id), label: String(s.name || s.id) }));
    return [
      { key: 'name', label: 'Name', type: 'text', placeholder: 'OPD Clinic A' },
      { key: 'unitId', label: 'Unit', type: 'select', options: unitOptions },
      { key: 'specialtyId', label: 'Specialty', type: 'select', options: specOptions },
      { key: 'allowedRoomIds', label: 'Allowed Room IDs (comma separated)', type: 'text', placeholder: 'roomId1,roomId2' },
    ];
  }, [unitItems, specItems]);

  return <ClinicalInfraCrudPage title="Clinics" endpoint="/api/clinical-infra/clinics" fields={fields} />;
}

