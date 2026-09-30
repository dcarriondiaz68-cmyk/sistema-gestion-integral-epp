// Entity type definitions for future modules.
// These interfaces define the data shapes that will be used in subsequent phases.
// They are NOT implemented in Phase 1 — only the types are prepared.

export interface Empresa {
  id: string;
  ruc: string;
  razon_social: string;
  nombre_comercial: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Sede {
  id: string;
  empresa_id: string;
  nombre: string;
  direccion: string | null;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface Area {
  id: string;
  sede_id: string;
  nombre: string;
  codigo: string | null;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface Puesto {
  id: string;
  area_id: string;
  nombre: string;
  codigo: string | null;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Trabajador {
  id: string;
  puesto_id: string;
  dni: string;
  nombres: string;
  apellidos: string;
  fecha_ingreso: string | null;
  telefono: string | null;
  email: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CatalogoEPP {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  unidad_medida: string;
  vida_util_dias: number | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface PrecioEPP {
  id: string;
  catalogo_epp_id: string;
  proveedor: string | null;
  precio: number;
  moneda: string;
  fecha_vigencia: string;
  created_at: string;
}

export interface MatrizPuestoEPP {
  id: string;
  puesto_id: string;
  catalogo_epp_id: string;
  cantidad_entrega: number;
  frecuencia_renovacion_dias: number | null;
  obligatorio: boolean;
  created_at: string;
  updated_at: string;
}

export interface Stock {
  id: string;
  catalogo_epp_id: string;
  sede_id: string;
  cantidad_actual: number;
  cantidad_reservada: number;
  updated_at: string;
}

export interface StockMinimo {
  id: string;
  catalogo_epp_id: string;
  sede_id: string;
  cantidad_minima: number;
  updated_at: string;
}

export interface MovimientoKardex {
  id: string;
  catalogo_epp_id: string;
  sede_id: string;
  tipo_movimiento: 'INGRESO' | 'SALIDA' | 'AJUSTE';
  cantidad: number;
  saldo_resultante: number;
  documento_ref: string | null;
  observacion: string | null;
  usuario_id: string;
  created_at: string;
}

export interface Solicitud {
  id: string;
  trabajador_id: string;
  sede_id: string;
  estado: string;
  observacion: string | null;
  solicitado_por: string;
  created_at: string;
  updated_at: string;
}

export interface RegistroEntrega {
  id: string;
  solicitud_id: string | null;
  trabajador_id: string;
  estado: string;
  entregado_por: string;
  fecha_entrega: string | null;
  created_at: string;
  updated_at: string;
}

export interface DetalleEntrega {
  id: string;
  registro_entrega_id: string;
  catalogo_epp_id: string;
  cantidad: number;
  precio_unitario: number | null;
}

export interface Firma {
  id: string;
  registro_entrega_id: string;
  tipo_firmante: 'TRABAJADOR' | 'RESPONSABLE';
  firmante_id: string;
  imagen_firma: string | null;
  fecha_firma: string;
}

export interface HistorialEPP {
  id: string;
  trabajador_id: string;
  catalogo_epp_id: string;
  fecha_entrega: string;
  fecha_vencimiento: string | null;
  estado_vigencia: string;
  registro_entrega_id: string;
}

export interface Notificacion {
  id: string;
  usuario_id: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  tipo: string;
  created_at: string;
}

export interface RegistroAuditoria {
  id: string;
  usuario_id: string | null;
  accion: string;
  modulo: string;
  registro_id: string | null;
  operacion: string;
  detalles: Record<string, unknown> | null;
  created_at: string;
}

export interface ColaSincronizacion {
  id: string;
  operacion: string;
  tabla: string;
  registro_id: string;
  datos: Record<string, unknown>;
  estado: string;
  intentos: number;
  ultimo_intento: string | null;
  error: string | null;
  created_at: string;
}
