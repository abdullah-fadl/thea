'use client';

import { ClinicalInfraCrudPage } from '@/components/admin/clinicalInfra/CrudPage';

export default function SpecialtiesPage() {
  return (
    <ClinicalInfraCrudPage
      title="Specialties"
      endpoint="/api/clinical-infra/specialties"
      fields={[
        { key: 'name', label: 'Name', type: 'text', placeholder: 'Cardiology' },
        { key: 'code', label: 'Code (optional)', type: 'text', placeholder: 'CARD' },
      ]}
    />
  );
}

