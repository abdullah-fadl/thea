'use client';

import { THEA_UI } from '@/lib/thea-ui/tokens';

interface TheaSidebarUserProps {
  expanded: boolean;
  name: string;
  role: string;
}

export function TheaSidebarUser({ expanded, name, role }: TheaSidebarUserProps) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-3 flex-shrink-0"
      style={{ borderTop: `1px solid ${THEA_UI.sidebar.border}` }}
    >
      {/* Avatar circle */}
      <div
        className="flex-shrink-0 rounded-full flex items-center justify-center"
        style={{
          width: 34,
          height: 34,
          background: THEA_UI.sidebar.userAvatar,
          color: THEA_UI.sidebar.text,
          fontSize: THEA_UI.font.size.md,
          fontWeight: THEA_UI.font.weight.semibold,
        }}
      >
        {name ? name.charAt(0).toUpperCase() : '?'}
      </div>
      {/* Text — fades in/out */}
      <div
        className="overflow-hidden whitespace-nowrap min-w-0"
        style={{
          opacity: expanded ? 1 : 0,
          width: expanded ? 'auto' : 0,
          transition: `opacity ${THEA_UI.animation.duration.normal} ${THEA_UI.animation.ease}, width ${THEA_UI.animation.duration.normal} ${THEA_UI.animation.ease}`,
        }}
      >
        <div
          className="truncate"
          style={{
            fontWeight: THEA_UI.font.weight.semibold,
            fontSize: THEA_UI.font.size.md,
            color: THEA_UI.sidebar.text,
            lineHeight: 1.3,
          }}
        >
          {name || 'User'}
        </div>
        <div
          className="truncate"
          style={{
            fontSize: THEA_UI.font.size.base,
            color: THEA_UI.sidebar.textMuted,
            lineHeight: 1.3,
          }}
        >
          {role || 'Staff'}
        </div>
      </div>
    </div>
  );
}
