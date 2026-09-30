import { createContext, useContext } from 'react';
import type { Permission } from '@/constants/permissions.constants';
import type { UserRole } from '@/constants/roles.constants';

export interface AuthzContextValue {
  role: UserRole | null;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
}

export const AuthzContext = createContext<AuthzContextValue | undefined>(undefined);

export function useAuthz(): AuthzContextValue {
  const context = useContext(AuthzContext);
  if (!context) {
    throw new Error('useAuthz debe usarse dentro de un AuthzProvider');
  }
  return context;
}
