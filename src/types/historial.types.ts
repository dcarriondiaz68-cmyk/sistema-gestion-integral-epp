export type EstadoVigencia = 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' | 'RENOVADO';

export interface HistorialEPP {
  entrega_id: string;
  numero_entrega: string;
  trabajador_id: string;
  trabajador_nombre: string;
  trabajador_dni: string;
  epp_id: string;
  epp_nombre: string;
  epp_codigo: string;
  cantidad_entregada: number;
  talla: string | null;
  fecha_entrega: string;
  fecha_confirmacion: string | null;
  fecha_renovacion: string | null;
  vida_util_meses: number | null;
  estado_vigencia: EstadoVigencia;
  dias_restantes: number | null;
  sede_id: string;
  sede_nombre: string;
  area_id: string | null;
  area_nombre: string;
  puesto_id: string | null;
  puesto_nombre: string | null;
  solicitud_id: string | null;
  solicitud_numero: string | null;
  entrega_origen_id: string | null;
  entrega_origen_numero: string | null;
  renovado_por_entrega_id: string | null;
  renovado_por_entrega_numero: string | null;
  observacion: string | null;
}
