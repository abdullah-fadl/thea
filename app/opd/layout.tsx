'use client';

import { ClientLayoutSwitcher } from '@/components/shell/ClientLayoutSwitcher';

export default function OPDLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClientLayoutSwitcher>{children}</ClientLayoutSwitcher>;
}
