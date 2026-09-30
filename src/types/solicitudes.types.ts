export type EstadoSolicitud = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

export interface SolicitudEPP {
  id: string;
  numero_solicitud: string;
  trabajador_id: string;
  epp_id: string;
  sede_id: string;
  talla: string | null;
  cantidad: number;
  motivo: string | null;
  observacion: string | null;
  estado: EstadoSolicitud;
  solicitado_por: string | null;
  aprobado_por: string | null;
  fecha_aprobacion: string | null;
  motivo_rechazo: string | null;
  created_at: string;
  updated_at: string;
}

export interface SolicitudWithRelations extends SolicitudEPP {
  trabajador_nombre: string;
  trabajador_dni: string;
  epp_nombre: string;
  epp_codigo: string;
  epp_talla_requerida: boolean;
  sede_nombre: string;
  solicitado_nombre: string;
  aprobado_nombre: string;
  entrega_id: string | null;
  entrega_numero: string | null;
}

export interface SolicitudInsert {
  trabajador_id: string;
  epp_id: string;
  sede_id: string;
  talla?: string | null;
  cantidad: number;
  motivo?: string | null;
  observacion?: string | null;
}
