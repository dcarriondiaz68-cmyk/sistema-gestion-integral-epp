export interface Empresa {
  id: string;
  ruc: string;
  razon_social: string;
  nombre_comercial: string | null;
  domicilio: string | null;
  actividad_economica: string | null;
  numero_trabajadores: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Sede {
  id: string;
  empresa_id: string;
  nombre: string;
  codigo: string;
  direccion: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Area {
  id: string;
  sede_id: string;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Puesto {
  id: string;
  area_id: string;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export type EstadoLaboral = 'ACTIVO' | 'INACTIVO' | 'CESADO';

export interface Trabajador {
  id: string;
  empresa_id: string;
  sede_id: string;
  area_id: string;
  puesto_id: string;
  nombres: string;
  apellidos: string;
  dni: string;
  codigo_interno: string;
  fecha_ingreso: string | null;
  telefono: string | null;
  email: string | null;
  estado_laboral: EstadoLaboral;
  activo: boolean;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrabajadorWithRelations extends Trabajador {
  empresa_razon_social: string;
  sede_nombre: string;
  area_nombre: string;
  puesto_nombre: string;
}

export interface EmpresaInsert {
  ruc: string;
  razon_social: string;
  nombre_comercial?: string | null;
  domicilio?: string | null;
  actividad_economica?: string | null;
  numero_trabajadores?: number;
  activo?: boolean;
}

export interface SedeInsert {
  empresa_id: string;
  nombre: string;
  codigo: string;
  direccion?: string | null;
  activo?: boolean;
}

export interface AreaInsert {
  sede_id: string;
  nombre: string;
  codigo: string;
  descripcion?: string | null;
  activo?: boolean;
}

export interface PuestoInsert {
  area_id: string;
  nombre: string;
  codigo: string;
  descripcion?: string | null;
  activo?: boolean;
}

export interface TrabajadorInsert {
  empresa_id: string;
  sede_id: string;
  area_id: string;
  puesto_id: string;
  nombres: string;
  apellidos: string;
  dni: string;
  codigo_interno: string;
  fecha_ingreso?: string | null;
  telefono?: string | null;
  email?: string | null;
  estado_laboral?: EstadoLaboral;
  activo?: boolean;
}

export type EmpresaUpdate = Partial<EmpresaInsert>;
export type SedeUpdate = Partial<SedeInsert>;
export type AreaUpdate = Partial<AreaInsert>;
export type PuestoUpdate = Partial<PuestoInsert>;
export type TrabajadorUpdate = Partial<TrabajadorInsert>;
