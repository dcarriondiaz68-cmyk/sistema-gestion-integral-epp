import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAuthz } from '@/hooks/useAuthz';
import { LoadingState, NoPermissionsState } from '@/components/ui/StateDisplay';
import type { UserRole } from '@/constants/roles.constants';
import type { Permission } from '@/constants/permissions.constants';

interface ProtectedRouteProps {
  children: ReactNode;
  requireRoles?: UserRole[];
}

export function ProtectedRoute({ children, requireRoles }: ProtectedRouteProps) {
  const { session, loading, profile } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingState message="Verificando sesión..." />;
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireRoles && profile && !requireRoles.includes(profile.role)) {
    return <NoPermissionsState />;
  }

  return <>{children}</>;
}

interface PermissionRouteProps {
  permission: Permission;
  children: ReactNode;
}

export function PermissionRoute({ permission, children }: PermissionRouteProps) {
  const { hasPermission } = useAuthz();

  if (!hasPermission(permission)) {
    return <NoPermissionsState />;
  }

  return <>{children}</>;
}
