'use client';

import DepartmentReception from '@/components/reception/DepartmentReception';
import { Scan } from 'lucide-react';

export default function RadiologyReceptionPage() {
  return (
    <DepartmentReception
      departmentKey="radiology"
      kind="RADIOLOGY"
      icon={Scan}
      title={{ ar: 'استقبال الأشعة', en: 'Radiology Reception' }}
      color="blue"
    />
  );
}
