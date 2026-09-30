export interface ValorizacionItem {
  inventario_id: string;
  epp_id: string;
  epp_codigo: string;
  epp_nombre: string;
  epp_unidad_medida: string;
  sede_id: string;
  sede_nombre: string;
  stock_actual: number;
  stock_minimo: number | null;
  precio_unitario: number | null;
  valor_total: number | null;
}

export interface CostoEntregaItem {
  entrega_id: string;
  numero_entrega: string;
  trabajador_id: string;
  trabajador_nombre: string;
  trabajador_dni: string;
  epp_id: string;
  epp_codigo: string;
  epp_nombre: string;
  sede_id: string;
  sede_nombre: string;
  area_id: string | null;
  area_nombre: string;
  cantidad_entregada: number;
  precio_historico: number | null;
  costo_total: number | null;
  fecha_confirmacion: string | null;
  estado: string;
}

export interface CostoPorTrabajador {
  trabajador_id: string;
  trabajador_nombre: string;
  trabajador_dni: string;
  sede_nombre: string;
  area_nombre: string;
  num_entregas: number;
  cantidad_total: number;
  costo_total: number;
}

export interface CostoPorSede {
  sede_id: string;
  sede_nombre: string;
  num_entregas: number;
  cantidad_total: number;
  costo_total: number;
}

export interface CostoPorArea {
  area_id: string | null;
  area_nombre: string;
  sede_nombre: string;
  num_entregas: number;
  cantidad_total: number;
  costo_total: number;
}

export interface CostosFilters {
  fechaDesde?: string;
  fechaHasta?: string;
  sedeId?: string;
  areaId?: string;
  trabajadorId?: string;
  eppId?: string;
}
