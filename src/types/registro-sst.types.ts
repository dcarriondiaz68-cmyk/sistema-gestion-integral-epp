export type TipoEquipoSST = 'EPP' | 'EMERGENCIA';

export interface RegistroSST {
  id: string;
  entrega_id: string;
  codigo_documento: string;
  version_documento: string;
  tipo_equipo: TipoEquipoSST;
  empresa_razon_social: string;
  empresa_ruc: string;
  empresa_domicilio: string | null;
  empresa_actividad: string | null;
  empresa_num_trabajadores: number | null;
  trabajador_nombre: string;
  trabajador_dni: string;
  trabajador_area: string | null;
  epp_nombre: string;
  fecha_entrega: string;
  fecha_renovacion: string | null;
  responsable_nombre: string;
  responsable_cargo: string | null;
  firma_trabajador_data: string | null;
  firma_responsable_data: string | null;
  generado_por: string | null;
  created_at: string;
  updated_at: string;
}
