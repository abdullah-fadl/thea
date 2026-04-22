'use client';
import { type ReactNode } from 'react';
import { useCVisionAuthz } from '@/components/shell/CVisionAuthzClient';
import { CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import AccessDenied from './AccessDenied';

interface PermissionGateProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

function checkPermission(roles: string[], isOwner: boolean, permission: string): boolean {
  if (isOwner) return true;
  for (const role of roles) {
    const perms = CVISION_ROLE_PERMISSIONS[role];
    if (perms?.includes(permission)) return true;
  }
  return false;
}

export default function PermissionGate({ permission, children, fallback }: PermissionGateProps) {
  const authz = useCVisionAuthz();
  if (!authz) return fallback || <AccessDenied />;

  const hasAccess = checkPermission(authz.roles || [], authz.isOwner || false, permission);
  if (!hasAccess) return fallback || <AccessDenied />;

  return <>{children}</>;
}

export function useHasPermission(permission: string): boolean {
  const authz = useCVisionAuthz();
  if (!authz) return false;
  return checkPermission(authz.roles || [], authz.isOwner || false, permission);
}
