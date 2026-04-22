import { ClientLayoutSwitcher } from '@/components/shell/ClientLayoutSwitcher';
import { TenantOrgProfileGuard } from '@/components/tenant/TenantOrgProfileGuard';
import { SessionIdleTimeoutGuard } from '@/components/shell/SessionIdleTimeoutGuard';
import { Toaster } from '@/components/ui/toaster';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const idleMinutes = Number(process.env.SESSION_IDLE_MINUTES || 60);
  return (
    <TenantOrgProfileGuard>
      <SessionIdleTimeoutGuard idleMinutes={idleMinutes} />
      <ClientLayoutSwitcher>{children}</ClientLayoutSwitcher>
      <Toaster />
    </TenantOrgProfileGuard>
  );
}
