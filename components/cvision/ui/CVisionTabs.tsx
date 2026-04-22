'use client';

import React, { ReactNode, useState, CSSProperties, createElement, Children, cloneElement, isValidElement } from 'react';
import { type CVisionPalette } from '@/lib/cvision/theme';

/* ─── Tab Item ───────────────────────────────────────────────────────── */

export interface CVisionTabItem {
  id?: string;
  tabId?: string;
  key?: string;
  label: string;
  labelAr?: string;
  icon?: ReactNode | React.ComponentType<any>;
  badge?: number;
}

/* ─── Tabs ───────────────────────────────────────────────────────────── */

interface CVisionTabsProps {
  C: CVisionPalette;
  tabs: CVisionTabItem[];
  activeTab?: string;
  defaultTab?: string;
  onChange?: (id: string) => void;
  onTabChange?: (id: string) => void;
  isRTL?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
}

export function CVisionTabs({ C, tabs, activeTab: activeTabProp, defaultTab, onChange, onTabChange, isRTL, style, children }: CVisionTabsProps) {
  const [internalTab, setInternalTab] = useState(defaultTab || (tabs[0] && (tabs[0].id || tabs[0].tabId)) || '');
  const activeTab = activeTabProp || internalTab;
  const handleChange = (id: string) => {
    setInternalTab(id);
    (onChange || onTabChange)?.(id);
  };
  const renderedChildren = children
    ? Children.map(children, (child) => {
        if (isValidElement(child)) {
          return cloneElement(child as React.ReactElement<{ activeTab?: string }>, { activeTab });
        }
        return child;
      })
    : null;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: 3,
          borderRadius: 12,
          background: C.bgSubtle,
          border: `1px solid ${C.border}`,
          overflowX: 'auto',
          ...style,
        }}
      >
        {tabs.map((tab) => {
          const tid = tab.id || tab.tabId || '';
          const active = tid === activeTab;
          return (
            <button
              key={tid}
              onClick={() => handleChange(tid)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 9,
                border: 'none',
                background: active ? C.bgCard : 'transparent',
                color: active ? C.gold : C.textMuted,
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                boxShadow: active ? C.shadow : 'none',
              }}
            >
              {typeof tab.icon === 'function' ? createElement(tab.icon as React.ComponentType<{ size: number }>, { size: 14 }) : tab.icon}
              <span>{isRTL ? (tab.labelAr || tab.label) : tab.label}</span>
              {tab.badge != null && tab.badge > 0 && (
                <span
                  style={{
                    minWidth: 18,
                    height: 18,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    background: active ? C.goldDim : C.bgSubtle,
                    color: active ? C.gold : C.textMuted,
                    padding: '0 4px',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {renderedChildren}
    </div>
  );
}

/* ─── Tab Content ────────────────────────────────────────────────────── */

interface CVisionTabContentProps {
  id?: string;
  tabId?: string;
  tabKey?: string;
  activeTab?: string;
  children: ReactNode;
}

export function CVisionTabContent({ id, tabId, tabKey, activeTab, children }: CVisionTabContentProps) {
  const key = id || tabId || tabKey || '';
  if (key !== activeTab) return null;
  return <>{children}</>;
}
