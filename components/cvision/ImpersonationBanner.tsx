'use client';

import { useEffect, useState } from 'react';
import { useDevMode } from '@/lib/dev-mode';
import { X } from 'lucide-react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { CVisionBadge } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { useLang } from '@/hooks/use-lang';

interface ImpersonationState {
  active: boolean;
  impersonation: { role: string; departmentIds?: string[]; employeeId?: string; } | null;
}

export function ImpersonationBanner() {
  const { C } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(null);
  const [loading, setLoading] = useState(true);
  const devOverrideAvailable = useDevMode();

  useEffect(() => {
    if (devOverrideAvailable) { loadImpersonation(); } else { setLoading(false); }
  }, []);

  async function loadImpersonation() {
    try {
      const res = await fetch('/api/cvision/dev-override', { credentials: 'include' });
      if (res.ok) { setImpersonation(await res.json()); }
      else if (res.status === 403) { setImpersonation({ active: false, impersonation: null }); }
    } catch { console.debug('[ImpersonationBanner] Dev override not available'); }
    finally { setLoading(false); }
  }

  async function clearImpersonation() {
    try {
      const res = await fetch('/api/cvision/dev-override', { method: 'DELETE', credentials: 'include' });
      const result = await res.json();
      if (result.success) { setImpersonation(result); toast.success(tr('تم إيقاف المحاكاة', 'Impersonation cleared')); window.location.reload(); }
    } catch (error: any) { toast.error(error.message || tr('فشل إيقاف المحاكاة', 'Failed to clear impersonation')); }
  }

  if (loading || !devOverrideAvailable || !impersonation?.active || !impersonation.impersonation) return null;

  return (
    <div style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${C.purple}40`, background: `${C.purple}10`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 12, color: C.purple }}>{tr('المحاكاة كـ:', 'IMPERSONATING:')}</span>
        <CVisionBadge C={C} variant="purple">{impersonation.impersonation.role}</CVisionBadge>
        {impersonation.impersonation.departmentIds && impersonation.impersonation.departmentIds.length > 0 && (
          <span style={{ fontSize: 12, color: C.purple }}>({tr('الأقسام:', 'Depts:')} {impersonation.impersonation.departmentIds.join(', ')})</span>
        )}
        {impersonation.impersonation.employeeId && (
          <span style={{ fontSize: 12, color: C.purple }}>({tr('الموظف:', 'Employee:')} {impersonation.impersonation.employeeId})</span>
        )}
      </div>
      <button onClick={clearImpersonation} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: C.purple }}>
        <X size={16} />
      </button>
    </div>
  );
}
