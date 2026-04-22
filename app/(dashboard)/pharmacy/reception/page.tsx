'use client';

import DepartmentReception from '@/components/reception/DepartmentReception';
import { Pill } from 'lucide-react';

export default function PharmacyReceptionPage() {
  return (
    <DepartmentReception
      departmentKey="pharmacy"
      kind="MEDICATION"
      icon={Pill}
      title={{ ar: 'استقبال الصيدلية', en: 'Pharmacy Reception' }}
      color="amber"
    />
  );
}
