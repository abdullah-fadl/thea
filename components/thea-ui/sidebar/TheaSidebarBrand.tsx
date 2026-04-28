'use client';

import { THEA_UI } from '@/lib/thea-ui/tokens';

interface TheaSidebarBrandProps {
  expanded: boolean;
}

export function TheaSidebarBrand({ expanded }: TheaSidebarBrandProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-4 flex-shrink-0">
      {/* Logo square with T letter */}
      <div
        className="flex-shrink-0 rounded-lg flex items-center justify-center"
        style={{
          width: 34,
          height: 34,
          background: THEA_UI.sidebar.brandLogo,
        }}
      >
        <span
          className="text-white font-extrabold leading-none select-none"
          style={{ fontSize: 20 }}
          aria-hidden
        >
          T
        </span>
      </div>
      {/* Text — fades in/out */}
      <div
        className="overflow-hidden whitespace-nowrap"
        style={{
          opacity: expanded ? 1 : 0,
          width: expanded ? 'auto' : 0,
          transition: `opacity ${THEA_UI.animation.duration.normal} ${THEA_UI.animation.ease}, width ${THEA_UI.animation.duration.normal} ${THEA_UI.animation.ease}`,
        }}
      >
        <div
          style={{
            fontWeight: THEA_UI.font.weight.bold,
            fontSize: THEA_UI.font.size.lg,
            color: THEA_UI.sidebar.text,
            lineHeight: 1.2,
          }}
        >
          Thea Health
        </div>
        <div
          style={{
            fontSize: THEA_UI.font.size.base,
            color: THEA_UI.sidebar.textMuted,
            lineHeight: 1.3,
          }}
        >
          Clinical Workspace
        </div>
      </div>
    </div>
  );
}
