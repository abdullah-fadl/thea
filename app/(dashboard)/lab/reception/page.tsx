'use client';

import DepartmentReception from '@/components/reception/DepartmentReception';
import { TestTube } from 'lucide-react';

export default function LabReceptionPage() {
  return (
    <DepartmentReception
      departmentKey="laboratory"
      kind="LAB"
      icon={TestTube}
      title={{ ar: 'استقبال المختبر', en: 'Lab Reception' }}
      color="purple"
    />
  );
}
