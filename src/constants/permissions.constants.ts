import type { UserRole } from '@/constants/roles.constants';

export type Permission =
  | 'dashboard.view'
  | 'profile.view'
  | 'profile.edit'
  | 'settings.view'
  | 'users.manage'
  | 'empresas.view'
  | 'empresas.manage'
  | 'sedes.view'
  | 'sedes.manage'
  | 'areas.view'
  | 'areas.manage'
  | 'puestos.view'
  | 'puestos.manage'
  | 'trabajadores.view'
  | 'trabajadores.manage'
  | 'catalogo_epp.view'
  | 'catalogo_epp.manage'
  | 'inventario.view'
  | 'inventario.manage'
  | 'kardex.view'
  | 'kardex.manage'
  | 'solicitudes.view'
  | 'solicitudes.manage'
  | 'aprobaciones.view'
  | 'aprobaciones.manage'
  | 'entregas.view'
  | 'entregas.manage'
  | 'firmas.view'
  | 'firmas.manage'
  | 'historial.view'
  | 'renovaciones.view'
  | 'renovaciones.manage'
  | 'reportes.view'
  | 'reportes.manage'
  | 'costos.view'
  | 'costos.manage'
  | 'dashboard_sst.view'
  | 'auditoria.view'
  | 'configuracion.manage';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMINISTRADOR: [
    'dashboard.view',
    'profile.view',
    'profile.edit',
    'settings.view',
    'users.manage',
    'empresas.view',
    'empresas.manage',
    'sedes.view',
    'sedes.manage',
    'areas.view',
    'areas.manage',
    'puestos.view',
    'puestos.manage',
    'trabajadores.view',
    'trabajadores.manage',
    'catalogo_epp.view',
    'catalogo_epp.manage',
    'inventario.view',
    'inventario.manage',
    'kardex.view',
    'kardex.manage',
    'solicitudes.view',
    'solicitudes.manage',
    'aprobaciones.view',
    'aprobaciones.manage',
    'entregas.view',
    'entregas.manage',
    'firmas.view',
    'firmas.manage',
    'historial.view',
    'renovaciones.view',
    'renovaciones.manage',
    'reportes.view',
    'reportes.manage',
    'costos.view',
    'costos.manage',
    'dashboard_sst.view',
    'auditoria.view',
    'configuracion.manage',
  ],
  PREVENCIONISTA: [
    'dashboard.view',
    'profile.view',
    'profile.edit',
    'settings.view',
    'empresas.view',
    'sedes.view',
    'areas.view',
    'puestos.view',
    'trabajadores.view',
    'catalogo_epp.view',
    'inventario.view',
    'kardex.view',
    'solicitudes.view',
    'solicitudes.manage',
    'aprobaciones.view',
    'aprobaciones.manage',
    'entregas.view',
    'entregas.manage',
    'firmas.view',
    'firmas.manage',
    'historial.view',
    'renovaciones.view',
    'renovaciones.manage',
    'reportes.view',
    'costos.view',
    'dashboard_sst.view',
    'auditoria.view',
  ],
  ALMACENERO: [
    'dashboard.view',
    'profile.view',
    'profile.edit',
    'settings.view',
    'catalogo_epp.view',
    'catalogo_epp.manage',
    'inventario.view',
    'inventario.manage',
    'kardex.view',
    'kardex.manage',
    'solicitudes.view',
    'solicitudes.manage',
    'entregas.view',
    'entregas.manage',
    'firmas.view',
    'firmas.manage',
    'historial.view',
    'renovaciones.view',
    'costos.view',
    'dashboard_sst.view',
  ],
  RRHH: [
    'dashboard.view',
    'profile.view',
    'profile.edit',
    'settings.view',
    'empresas.view',
    'sedes.view',
    'areas.view',
    'puestos.view',
    'trabajadores.view',
    'trabajadores.manage',
    'solicitudes.view',
    'historial.view',
    'renovaciones.view',
    'reportes.view',
    'dashboard_sst.view',
  ],
  TRABAJADOR: [
    'dashboard.view',
    'profile.view',
    'profile.edit',
    'settings.view',
    'solicitudes.view',
    'solicitudes.manage',
    'historial.view',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  'dashboard.view': 'Ver Dashboard',
  'profile.view': 'Ver Perfil',
  'profile.edit': 'Editar Perfil',
  'settings.view': 'Ver Configuración',
  'users.manage': 'Gestionar Usuarios',
  'empresas.view': 'Ver Empresas',
  'empresas.manage': 'Gestionar Empresas',
  'sedes.view': 'Ver Sedes',
  'sedes.manage': 'Gestionar Sedes',
  'areas.view': 'Ver Áreas',
  'areas.manage': 'Gestionar Áreas',
  'puestos.view': 'Ver Puestos',
  'puestos.manage': 'Gestionar Puestos',
  'trabajadores.view': 'Ver Trabajadores',
  'trabajadores.manage': 'Gestionar Trabajadores',
  'catalogo_epp.view': 'Ver Catálogo EPP',
  'catalogo_epp.manage': 'Gestionar Catálogo EPP',
  'inventario.view': 'Ver Inventario',
  'inventario.manage': 'Gestionar Inventario',
  'kardex.view': 'Ver Kardex',
  'kardex.manage': 'Gestionar Kardex',
  'solicitudes.view': 'Ver Solicitudes',
  'solicitudes.manage': 'Gestionar Solicitudes',
  'aprobaciones.view': 'Ver Aprobaciones',
  'aprobaciones.manage': 'Gestionar Aprobaciones',
  'entregas.view': 'Ver Entregas',
  'entregas.manage': 'Gestionar Entregas',
  'firmas.view': 'Ver Firmas',
  'firmas.manage': 'Gestionar Firmas',
  'historial.view': 'Ver Historial EPP',
  'renovaciones.view': 'Ver Renovaciones',
  'renovaciones.manage': 'Gestionar Renovaciones',
  'reportes.view': 'Ver Reportes',
  'reportes.manage': 'Gestionar Reportes',
  'costos.view': 'Ver Costos',
  'costos.manage': 'Gestionar Costos',
  'dashboard_sst.view': 'Ver Dashboard SST',
  'auditoria.view': 'Ver Auditoría',
  'configuracion.manage': 'Gestionar Configuración',
};

export interface PermissionGroup {
  module: string;
  label: string;
  view: Permission;
  manage?: Permission;
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  { module: 'dashboard', label: 'Dashboard', view: 'dashboard.view' },
  { module: 'users', label: 'Usuarios', view: 'users.manage' },
  { module: 'empresas', label: 'Empresas', view: 'empresas.view', manage: 'empresas.manage' },
  { module: 'sedes', label: 'Sedes', view: 'sedes.view', manage: 'sedes.manage' },
  { module: 'areas', label: 'Áreas', view: 'areas.view', manage: 'areas.manage' },
  { module: 'puestos', label: 'Puestos', view: 'puestos.view', manage: 'puestos.manage' },
  { module: 'trabajadores', label: 'Trabajadores', view: 'trabajadores.view', manage: 'trabajadores.manage' },
  { module: 'catalogo_epp', label: 'Catálogo EPP', view: 'catalogo_epp.view', manage: 'catalogo_epp.manage' },
  { module: 'inventario', label: 'Inventario', view: 'inventario.view', manage: 'inventario.manage' },
  { module: 'kardex', label: 'Kardex', view: 'kardex.view', manage: 'kardex.manage' },
  { module: 'solicitudes', label: 'Solicitudes', view: 'solicitudes.view', manage: 'solicitudes.manage' },
  { module: 'aprobaciones', label: 'Aprobaciones', view: 'aprobaciones.view', manage: 'aprobaciones.manage' },
  { module: 'entregas', label: 'Entregas', view: 'entregas.view', manage: 'entregas.manage' },
  { module: 'firmas', label: 'Firmas', view: 'firmas.view', manage: 'firmas.manage' },
  { module: 'historial', label: 'Historial EPP', view: 'historial.view' },
  { module: 'renovaciones', label: 'Renovaciones', view: 'renovaciones.view', manage: 'renovaciones.manage' },
  { module: 'reportes', label: 'Reportes', view: 'reportes.view', manage: 'reportes.manage' },
  { module: 'costos', label: 'Costos', view: 'costos.view', manage: 'costos.manage' },
  { module: 'dashboard_sst', label: 'Dashboard SST', view: 'dashboard_sst.view' },
  { module: 'auditoria', label: 'Auditoría', view: 'auditoria.view' },
  { module: 'configuracion', label: 'Configuración', view: 'configuracion.manage' },
];
