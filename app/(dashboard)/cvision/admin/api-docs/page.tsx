'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionPageLayout, CVisionPageHeader, CVisionCard, CVisionCardHeader, CVisionCardBody,
  CVisionBadge, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { FileCode2, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

export default function ApiDocsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: spec } = useQuery({
    queryKey: ['cvision', 'api-docs'],
    queryFn: () => cvisionFetch<any>('/api/cvision/docs'),
  });

  const toggleTag = (tag: string) => setExpanded(prev => ({ ...prev, [tag]: !prev[tag] }));

  const methodVariant = (m: string): 'success' | 'info' | 'warning' | 'danger' => {
    if (m === 'get') return 'success';
    if (m === 'post') return 'info';
    if (m === 'put') return 'warning';
    if (m === 'delete') return 'danger';
    return 'info';
  };

  if (!spec) return (
    <CVisionPageLayout>
      <div style={{ padding: 48, textAlign: 'center', color: C.textMuted, fontSize: 14 }}>
        {tr('جاري تحميل توثيق API...', 'Loading API docs...')}
      </div>
    </CVisionPageLayout>
  );

  const pathsByTag: Record<string, { path: string; method: string; op: any }[]> = {};
  Object.entries(spec.paths || {}).forEach(([path, methods]: [string, any]) => {
    Object.entries(methods).forEach(([method, op]: [string, any]) => {
      const tags = op.tags || ['Other'];
      tags.forEach((tag: string) => {
        if (!pathsByTag[tag]) pathsByTag[tag] = [];
        pathsByTag[tag].push({ path, method, op });
      });
    });
  });

  return (
    <CVisionPageLayout style={{ maxWidth: 900, margin: '0 auto' }}>
      <CVisionPageHeader
        C={C}
        title={spec.info.title}
        subtitle={spec.info.description}
        icon={FileCode2}
        iconColor={C.purple}
        isRTL={isRTL}
        actions={<CVisionBadge C={C} variant="muted">v{spec.info.version}</CVisionBadge>}
      />

      <CVisionCard C={C} style={{ background: C.bgSubtle }}>
        <CVisionCardBody style={{ fontSize: 13, color: C.text }}>
          <div><strong>Base URL:</strong> <code style={{ background: C.bgCard, padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{spec.servers?.[0]?.url}</code></div>
          <div style={{ marginTop: 4 }}><strong>Auth:</strong> Bearer Token (JWT)</div>
          <div style={{ marginTop: 4 }}>
            <strong>OpenAPI JSON:</strong>{' '}
            <a href="/api/cvision/docs" target="_blank" style={{ color: C.gold, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              /api/cvision/docs <ExternalLink size={12} />
            </a>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {(spec.tags || []).map((tag: any) => {
        const endpoints = pathsByTag[tag.name] || [];
        const isOpen = expanded[tag.name];
        return (
          <CVisionCard C={C} key={tag.name}>
            <CVisionCardHeader C={C} style={{ cursor: 'pointer' }}>
              <div onClick={() => toggleTag(tag.name)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isOpen ? <ChevronDown size={16} color={C.textMuted} /> : <ChevronRight size={16} color={C.textMuted} />}
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tag.name}</span>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{tag.description}</span>
                </div>
                <CVisionBadge C={C} variant="muted">{endpoints.length} endpoints</CVisionBadge>
              </div>
            </CVisionCardHeader>
            {isOpen && (
              <CVisionCardBody style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
                {endpoints.map((ep, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: i > 0 ? `1px solid ${C.border}` : 'none', fontSize: 13 }}>
                    <CVisionBadge C={C} variant={methodVariant(ep.method)} style={{ fontFamily: 'monospace', textTransform: 'uppercase', width: 56, justifyContent: 'center' }}>{ep.method}</CVisionBadge>
                    <code style={{ fontFamily: 'monospace', fontSize: 12, flex: 1, color: C.text }}>{ep.path}</code>
                    <span style={{ fontSize: 11, color: C.textMuted, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.op.summary}</span>
                  </div>
                ))}
              </CVisionCardBody>
            )}
          </CVisionCard>
        );
      })}
    </CVisionPageLayout>
  );
}
