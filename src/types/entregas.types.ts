export type EstadoEntrega =
  | 'GENERADA'
  | 'EN_PREPARACION'
  | 'EN_ESPERA_STOCK'
  | 'ENTREGADA_PENDIENTE_FIRMA'
  | 'FIRMADA_TRABAJADOR'
  | 'FIRMADA_COMPLETA'
  | 'CANCELADA';

export interface Entrega {
  id: string;
  numero_entrega: string;
  solicitud_id: string | null;
  trabajador_id: string;
  epp_id: string;
  sede_id: string;
  talla: string | null;
  cantidad_entregada: number;
  cantidad_autorizada: number;
  estado: EstadoEntrega;
  precio_historico: number | null;
  kardex_id: string | null;
  generado_por: string | null;
  confirmado_por: string | null;
  fecha_confirmacion: string | null;
  motivo_cancelacion: string | null;
  observacion: string | null;
  entrega_origen_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntregaWithRelations extends Entrega {
  trabajador_nombre: string;
  trabajador_dni: string;
  epp_nombre: string;
  epp_codigo: string;
  sede_nombre: string;
  solicitud_numero: string | null;
  generado_nombre: string;
  confirmado_nombre: string;
  stock_disponible: number;
}

export interface EntregaInsert {
  solicitud_id?: string | null;
  trabajador_id: string;
  epp_id: string;
  sede_id: string;
  talla?: string | null;
  cantidad_entregada: number;
  cantidad_autorizada: number;
  observacion?: string | null;
  entrega_origen_id?: string | null;
}
