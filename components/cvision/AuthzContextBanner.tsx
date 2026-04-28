'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionBadge } from '@/components/cvision/ui';

interface AuthzContext {
  tenantId: string; userId: string; roles: string[]; employeeId: string | null;
  departmentIds: string[]; employeeStatus: string | null; isOwner: boolean; hasOwnerRole: boolean;
}

interface Permissions {
  canEditPersonal?: boolean; canEditEmployment?: boolean; canEditFinancial?: boolean;
  canEditContract?: boolean; canChangeStatus: boolean;
}

export function AuthzContextBanner() {
  const { C } = useCVisionTheme();
  const [context, setContext] = useState<AuthzContext | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);
  const isProduction = process.env.NODE_ENV === 'production';

  useEffect(() => { if (!isProduction) loadContext(); }, [isProduction]);

  async function loadContext() {
    try {
      const res = await fetch('/api/cvision/authz-context', { credentials: 'include' });
      if (res.ok) { const data = await res.json(); if (data.success) { setContext(data.context); setPermissions(data.permissions); } }
    } catch { console.error('Failed to load authz context'); }
    finally { setLoading(false); }
  }

  if (isProduction) return null;

  if (loading) {
    return (
      <CVisionCard C={C} hover={false} style={{ margin: 16, border: `1px solid ${C.orange}30`, background: `${C.orange}08` }}>
        <CVisionCardBody style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Loader2 size={16} color={C.orange} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 13, color: C.textMuted }}>Loading authz context...</span>
        </CVisionCardBody>
      </CVisionCard>
    );
  }

  if (!context) return null;

  return (
    <CVisionCard C={C} hover={false} style={{ margin: 16, border: `1px solid ${C.orange}30`, background: `${C.orange}08` }}>
      <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Authz Context (DEV-ONLY)</div>
      </CVisionCardHeader>
      <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><span style={{ fontWeight: 600, color: C.textSecondary }}>tenantId:</span> <CVisionBadge C={C} variant="muted">{context.tenantId}</CVisionBadge></div>
          <div><span style={{ fontWeight: 600, color: C.textSecondary }}>userId:</span> <CVisionBadge C={C} variant="muted">{context.userId}</CVisionBadge></div>
        </div>
        <div>
          <span style={{ fontWeight: 600, color: C.textSecondary }}>roles: </span>
          {context.roles.length > 0 ? context.roles.map(role => (
            <CVisionBadge key={role} C={C} variant={role === 'owner' ? 'purple' : 'muted'} style={{ marginLeft: 4 }}>{role}</CVisionBadge>
          )) : <span style={{ color: C.textMuted }}>none</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><span style={{ fontWeight: 600, color: C.textSecondary }}>employeeId:</span> {context.employeeId ? <CVisionBadge C={C} variant="muted">{context.employeeId}</CVisionBadge> : <span style={{ color: C.textMuted }}>none</span>}</div>
          <div><span style={{ fontWeight: 600, color: C.textSecondary }}>depts:</span> {context.departmentIds.length > 0 ? context.departmentIds.map(id => <CVisionBadge key={id} C={C} variant="muted" style={{ marginLeft: 4 }}>{id}</CVisionBadge>) : <span style={{ color: C.textMuted }}>none</span>}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, color: C.textSecondary }}>Flags:</span>
          {context.isOwner && <CVisionBadge C={C} variant="info">isOwner</CVisionBadge>}
          {context.hasOwnerRole && <CVisionBadge C={C} variant="purple">hasOwnerRole</CVisionBadge>}
        </div>
        {permissions && (
          <div style={{ paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontWeight: 600, marginBottom: 4, color: C.textSecondary }}>Computed Permissions:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
              <div>PERSONAL: {permissions.canEditPersonal ? '✅' : '❌'}</div>
              <div>EMPLOYMENT: {permissions.canEditEmployment ? '✅' : '❌'}</div>
              <div>FINANCIAL: {permissions.canEditFinancial ? '✅' : '❌'}</div>
              <div>CONTRACT: {permissions.canEditContract ? '✅' : '❌'}</div>
              <div>Change Status: {permissions.canChangeStatus ? '✅' : '❌'}</div>
            </div>
          </div>
        )}
      </CVisionCardBody>
    </CVisionCard>
  );
}
