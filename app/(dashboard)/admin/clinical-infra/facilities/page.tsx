'use client';

import { ClinicalInfraCrudPage } from '@/components/admin/clinicalInfra/CrudPage';

export default function FacilitiesPage() {
  return (
    <ClinicalInfraCrudPage
      title="Facilities"
      endpoint="/api/clinical-infra/facilities"
      fields={[
        { key: 'name', label: 'Name', type: 'text', placeholder: 'Main Hospital' },
        { key: 'code', label: 'Code (optional)', type: 'text', placeholder: 'Thee-1' },
        { key: 'samNodeId', label: 'SAM Node Link (optional)', type: 'text', placeholder: '(read-only link)' },
      ]}
    />
  );
}

