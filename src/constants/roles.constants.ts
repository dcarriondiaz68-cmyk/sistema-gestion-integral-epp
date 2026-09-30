export type UserRole =
  | 'ADMINISTRADOR'
  | 'PREVENCIONISTA'
  | 'ALMACENERO'
  | 'RRHH'
  | 'TRABAJADOR';

export interface RoleDefinition {
  id: UserRole;
  label: string;
  description: string;
}

export const ROLES: Record<UserRole, RoleDefinition> = {
  ADMINISTRADOR: {
    id: 'ADMINISTRADOR',
    label: 'Administrador',
    description: 'Acceso global al sistema y configuración',
  },
  PREVENCIONISTA: {
    id: 'PREVENCIONISTA',
    label: 'Prevencionista',
    description: 'Acceso a funciones de Seguridad y Salud en el Trabajo',
  },
  ALMACENERO: {
    id: 'ALMACENERO',
    label: 'Almacenero',
    description: 'Acceso a funciones de almacén e inventario',
  },
  RRHH: {
    id: 'RRHH',
    label: 'RRHH',
    description: 'Acceso a trabajadores y recursos humanos',
  },
  TRABAJADOR: {
    id: 'TRABAJADOR',
    label: 'Trabajador',
    description: 'Acceso únicamente a sus datos y funciones autorizadas',
  },
};

export const ROLE_LIST = Object.values(ROLES);

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMINISTRADOR: 'Administrador',
  PREVENCIONISTA: 'Prevencionista',
  ALMACENERO: 'Almacenero',
  RRHH: 'RRHH',
  TRABAJADOR: 'Trabajador',
};
