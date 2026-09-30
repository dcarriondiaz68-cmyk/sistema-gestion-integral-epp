import { type ReactNode, useMemo, useCallback } from 'react';
import { AuthzContext, type AuthzContextValue } from '@/hooks/useAuthz';
import { hasPermission as checkPermission, hasAnyPermission as checkAny, hasAllPermissions as checkAll } from '@/constants/permissions.constants';
import type { UserRole } from '@/constants/roles.constants';
import type { Permission } from '@/constants/permissions.constants';
import { useAuth } from '@/hooks/useAuth';

export function AuthzProvider({ children }: { children: ReactNode }) {
  const { role } = useAuth();

  const hasPermission = useCallback(
    (permission: Permission) => (role ? checkPermission(role, permission) : false),
    [role]
  );

  const hasAnyPermission = useCallback(
    (permissions: Permission[]) => (role ? checkAny(role, permissions) : false),
    [role]
  );

  const hasAllPermissions = useCallback(
    (permissions: Permission[]) => (role ? checkAll(role, permissions) : false),
    [role]
  );

  const value = useMemo<AuthzContextValue>(
    () => ({ role, hasPermission, hasAnyPermission, hasAllPermissions }),
    [role, hasPermission, hasAnyPermission, hasAllPermissions]
  );

  return <AuthzContext.Provider value={value}>{children}</AuthzContext.Provider>;
}
