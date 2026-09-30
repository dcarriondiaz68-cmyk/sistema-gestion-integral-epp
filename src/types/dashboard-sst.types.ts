import type { EstadoVigencia } from '@/types/historial.types';

export interface DashboardFilters {
  fechaDesde?: string;
  fechaHasta?: string;
  sedeId?: string;
  areaId?: string;
  trabajadorId?: string;
  eppId?: string;
}

export interface DashboardKPIs {
  totalTrabajadores: number;
  trabajadoresConEpp: number;
  coberturaPorcentaje: number;
  eppVigentes: number;
  eppPorVencer: number;
  eppVencidos: number;
  entregasPeriodo: number;
  cumplimientoRenovaciones: number;
  valorizacionInventario: number;
  costoTotalEntregas: number;
}

export interface SerieMensual {
  mes: string;
  etiqueta: string;
  entregas: number;
  costo: number;
}

export interface DistribucionItem {
  nombre: string;
  cantidad: number;
  costo: number;
}

export interface EstadoVigenciaDistribucion {
  estado: EstadoVigencia;
  cantidad: number;
}

export interface AlertaVigencia {
  entrega_id: string;
  numero_entrega: string;
  trabajador_nombre: string;
  trabajador_dni: string;
  epp_nombre: string;
  epp_codigo: string;
  sede_nombre: string;
  area_nombre: string;
  estado_vigencia: EstadoVigencia;
  dias_restantes: number | null;
  fecha_renovacion: string | null;
}
