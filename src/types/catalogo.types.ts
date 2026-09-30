export interface CatalogoEPP {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  descripcion: string | null;
  marca: string | null;
  modelo: string | null;
  unidad_medida: string;
  talla_requerida: boolean;
  lote_requerido: boolean;
  vida_util_meses: number | null;
  precio_unitario: number | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CatalogoEPPInsert {
  codigo: string;
  nombre: string;
  categoria: string;
  descripcion?: string | null;
  marca?: string | null;
  modelo?: string | null;
  unidad_medida: string;
  talla_requerida?: boolean;
  lote_requerido?: boolean;
  vida_util_meses?: number | null;
  precio_unitario?: number | null;
  activo?: boolean;
}

export type CatalogoEPPUpdate = Partial<CatalogoEPPInsert>;
