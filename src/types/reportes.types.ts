export interface ReporteFilters {
  fechaDesde?: string;
  fechaHasta?: string;
  sedeId?: string;
  areaId?: string;
  trabajadorId?: string;
  eppId?: string;
  estado?: string;
}

export type ReporteType = 'entregas' | 'epp-trabajador' | 'inventario-kardex' | 'renovaciones' | 'costos';
