export type TipoMovimiento = 'INGRESO' | 'SALIDA' | 'AJUSTE';

export interface Inventario {
  id: string;
  epp_id: string;
  sede_id: string;
  stock_actual: number;
  stock_minimo: number | null;
  created_at: string;
  updated_at: string;
}

export interface InventarioWithRelations extends Inventario {
  epp_codigo: string;
  epp_nombre: string;
  epp_unidad_medida: string;
  sede_nombre: string;
}

export interface KardexMovimiento {
  id: string;
  inventario_id: string;
  tipo_movimiento: TipoMovimiento;
  cantidad: number;
  saldo_resultante: number;
  motivo: string | null;
  referencia: string | null;
  usuario_id: string | null;
  created_at: string;
}

export interface KardexWithRelations extends KardexMovimiento {
  epp_codigo: string;
  epp_nombre: string;
  sede_nombre: string;
  usuario_nombre: string;
}
