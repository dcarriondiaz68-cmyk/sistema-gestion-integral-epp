import { type ReactNode } from 'react';
import { useAuthz } from '@/hooks/useAuthz';
import { NoPermissionsState } from '@/components/ui/StateDisplay';
import type { Permission } from '@/constants/permissions.constants';

interface PermissionGateProps {
  permissions: Permission[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({ permissions, children, fallback }: PermissionGateProps) {
  const { hasAnyPermission } = useAuthz();

  if (!hasAnyPermission(permissions)) {
    return <>{fallback ?? <NoPermissionsState />}</>;
  }

  return <>{children}</>;
}
