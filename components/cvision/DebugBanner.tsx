'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { useCVisionTheme } from '@/lib/cvision/theme';

interface DebugInfo {
  pathname: string;
  tenantId: string | null;
  userId: string | null;
  role: string | null;
  roles: string[];
}

const DEBUG_BANNER_STORAGE_KEY = 'cvision_debug_banner_hidden';

export function DebugBanner() {
  const pathname = usePathname();
  const { C } = useCVisionTheme();
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHidden, setIsHidden] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hidden = localStorage.getItem(DEBUG_BANNER_STORAGE_KEY);
      const showEnv = process.env.NEXT_PUBLIC_DEBUG_BANNER_SHOW === '1';
      setIsHidden(!showEnv && hidden !== 'false');
    }
    if (process.env.NODE_ENV === 'production') { setLoading(false); return; }

    async function loadDebugInfo() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
        const data = await res.json();
        setDebugInfo({ pathname, tenantId: data.tenantId || data.activeTenantId || null, userId: data.user?.id || null, role: data.user?.role || null, roles: data.user?.permissions || [] });
      } catch {
        setDebugInfo({ pathname, tenantId: null, userId: null, role: null, roles: [] });
      } finally { setLoading(false); }
    }
    loadDebugInfo();
  }, [pathname]);

  const handleHide = () => { setIsHidden(true); if (typeof window !== 'undefined') localStorage.setItem(DEBUG_BANNER_STORAGE_KEY, 'true'); };

  if (process.env.NODE_ENV === 'production' || loading || isHidden) return null;

  const bannerStyle = {
    borderRadius: 10,
    padding: '8px 16px',
    marginBottom: 16,
    border: `1px solid ${debugInfo ? C.blue : C.orange}`,
    background: debugInfo ? `${C.blue}10` : `${C.orange}10`,
  };

  if (!debugInfo) {
    return (
      <div style={bannerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: C.textMuted }}>[DEBUG] Failed to load debug info</span>
          <button onClick={handleHide} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><X size={14} color={C.textMuted} /></button>
        </div>
      </div>
    );
  }

  return (
    <div style={bannerStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ fontSize: 11, fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: 2, flex: 1, color: C.textSecondary }}>
          <div><span style={{ fontWeight: 700 }}>[DEBUG]</span> Pathname: <span style={{ color: C.blue }}>{debugInfo.pathname}</span></div>
          <div>TenantId: <span style={{ color: C.blue }}>{debugInfo.tenantId || 'NULL'}</span></div>
          <div>UserId: <span style={{ color: C.blue }}>{debugInfo.userId || 'NULL'}</span></div>
          <div>Role: <span style={{ color: C.blue }}>{debugInfo.role || 'NULL'}</span></div>
          <div style={{ wordBreak: 'break-all' }}>Roles: <span style={{ color: C.blue }}>{debugInfo.roles.length > 0 ? `[${debugInfo.roles.length} permissions]` : '[]'}</span></div>
        </div>
        <button onClick={handleHide} title="Hide Debug Banner" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}><X size={14} color={C.textMuted} /></button>
      </div>
    </div>
  );
}
