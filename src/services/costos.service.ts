import { supabase } from '@/lib/supabase';
import type {
  ValorizacionItem,
  CostoEntregaItem,
  CostoPorTrabajador,
  CostoPorSede,
  CostoPorArea,
  CostosFilters,
} from '@/types/costos.types';

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return (error as { message: string }).message;
  }
  return 'Ocurrió un error inesperado.';
}

interface RawEntregaCostoRow {
  id: string;
  numero_entrega: string;
  trabajador_id: string;
  epp_id: string;
  sede_id: string;
  cantidad_entregada: number;
  precio_historico: number | null;
  fecha_confirmacion: string | null;
  estado: string;
  created_at: string;
  trabajador: { nombres: string; apellidos: string; dni: string; area_id: string } | null;
  epp: { nombre: string; codigo: string; precio_unitario: number | null } | null;
  sede: { nombre: string } | null;
}

interface AreaRow {
  id: string;
  nombre: string;
  sede_id: string;
}

interface SedeRow {
  id: string;
  nombre: string;
}

export async function fetchValorizacionInventario(filters?: CostosFilters): Promise<ValorizacionItem[]> {
  let query = supabase
    .from('inventario')
    .select(`
      id,
      epp_id,
      sede_id,
      stock_actual,
      stock_minimo,
      epp:catalogo_epp!epp_id(codigo, nombre, unidad_medida, precio_unitario),
      sede:sedes!sede_id(nombre)
    `)
    .order('updated_at', { ascending: false });

  if (filters?.sedeId) query = query.eq('sede_id', filters.sedeId);
  if (filters?.eppId) query = query.eq('epp_id', filters.eppId);

  const { data, error } = await query;
  if (error) throw new Error(getErrorMessage(error));

  return (data ?? []).map((row) => {
    const r = row as unknown as Record<string, unknown>;
    const epp = r.epp as Record<string, unknown> | null;
    const sede = r.sede as Record<string, unknown> | null;
    const precioUnitario = (epp?.precio_unitario as number) ?? null;
    const stockActual = (r.stock_actual as number) ?? 0;
    return {
      inventario_id: r.id as string,
      epp_id: r.epp_id as string,
      epp_codigo: (epp?.codigo as string) ?? '—',
      epp_nombre: (epp?.nombre as string) ?? '—',
      epp_unidad_medida: (epp?.unidad_medida as string) ?? '—',
      sede_id: r.sede_id as string,
      sede_nombre: (sede?.nombre as string) ?? '—',
      stock_actual: stockActual,
      stock_minimo: (r.stock_minimo as number | null) ?? null,
      precio_unitario: precioUnitario,
      valor_total: precioUnitario != null ? stockActual * precioUnitario : null,
    };
  });
}

export async function fetchCostosEntregas(filters?: CostosFilters): Promise<CostoEntregaItem[]> {
  let query = supabase
    .from('entregas')
    .select(`
      id,
      numero_entrega,
      trabajador_id,
      epp_id,
      sede_id,
      cantidad_entregada,
      precio_historico,
      fecha_confirmacion,
      estado,
      created_at,
      trabajador:trabajadores!trabajador_id(nombres, apellidos, dni, area_id),
      epp:catalogo_epp!epp_id(nombre, codigo, precio_unitario),
      sede:sedes!sede_id(nombre)
    `)
    .in('estado', ['ENTREGADA_PENDIENTE_FIRMA', 'FIRMADA_TRABAJADOR', 'FIRMADA_COMPLETA'])
    .order('created_at', { ascending: false });

  if (filters?.sedeId) query = query.eq('sede_id', filters.sedeId);
  if (filters?.trabajadorId) query = query.eq('trabajador_id', filters.trabajadorId);
  if (filters?.eppId) query = query.eq('epp_id', filters.eppId);
  if (filters?.fechaDesde) query = query.gte('fecha_confirmacion', filters.fechaDesde);
  if (filters?.fechaHasta) query = query.lte('fecha_confirmacion', filters.fechaHasta);

  const { data, error } = await query;
  if (error) throw new Error(getErrorMessage(error));

  const rows = (data ?? []) as unknown as RawEntregaCostoRow[];

  const areaIds = Array.from(new Set(
    rows.map((r) => r.trabajador?.area_id).filter((id): id is string => !!id)
  ));

  const areaMap = new Map<string, { nombre: string; sedeId: string }>();
  if (areaIds.length > 0) {
    const { data: areas } = await supabase
      .from('areas')
      .select('id, nombre, sede_id')
      .in('id', areaIds) as { data: AreaRow[] | null; error: null };
    if (areas) {
      for (const a of areas) {
        areaMap.set(a.id, { nombre: a.nombre, sedeId: a.sede_id });
      }
    }
  }

  let filtered = rows;
  if (filters?.areaId) {
    filtered = filtered.filter((r) => r.trabajador?.area_id === filters.areaId);
  }

  return filtered.map((row) => {
    const precioHistorico = row.precio_historico;
    const cantidad = row.cantidad_entregada;
    const trabajador = row.trabajador;
    const areaInfo = trabajador?.area_id ? areaMap.get(trabajador.area_id) : null;

    const precioEfectivo = precioHistorico ?? (row.epp?.precio_unitario ?? null);

    return {
      entrega_id: row.id,
      numero_entrega: row.numero_entrega,
      trabajador_id: row.trabajador_id,
      trabajador_nombre: trabajador
        ? `${trabajador.nombres ?? ''} ${trabajador.apellidos ?? ''}`.trim()
        : '—',
      trabajador_dni: trabajador?.dni ?? '—',
      epp_id: row.epp_id,
      epp_codigo: row.epp?.codigo ?? '—',
      epp_nombre: row.epp?.nombre ?? '—',
      sede_id: row.sede_id,
      sede_nombre: row.sede?.nombre ?? '—',
      area_id: trabajador?.area_id ?? null,
      area_nombre: areaInfo?.nombre ?? '—',
      cantidad_entregada: cantidad,
      precio_historico: precioEfectivo,
      costo_total: precioEfectivo != null ? cantidad * precioEfectivo : null,
      fecha_confirmacion: row.fecha_confirmacion,
      estado: row.estado,
    };
  });
}

export function aggregateByTrabajador(items: CostoEntregaItem[]): CostoPorTrabajador[] {
  const map = new Map<string, CostoPorTrabajador>();
  for (const item of items) {
    const existing = map.get(item.trabajador_id);
    if (existing) {
      existing.num_entregas += 1;
      existing.cantidad_total += item.cantidad_entregada;
      existing.costo_total += item.costo_total ?? 0;
    } else {
      map.set(item.trabajador_id, {
        trabajador_id: item.trabajador_id,
        trabajador_nombre: item.trabajador_nombre,
        trabajador_dni: item.trabajador_dni,
        sede_nombre: item.sede_nombre,
        area_nombre: item.area_nombre,
        num_entregas: 1,
        cantidad_total: item.cantidad_entregada,
        costo_total: item.costo_total ?? 0,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.costo_total - a.costo_total);
}

export function aggregateBySede(items: CostoEntregaItem[]): CostoPorSede[] {
  const map = new Map<string, CostoPorSede>();
  for (const item of items) {
    const existing = map.get(item.sede_id);
    if (existing) {
      existing.num_entregas += 1;
      existing.cantidad_total += item.cantidad_entregada;
      existing.costo_total += item.costo_total ?? 0;
    } else {
      map.set(item.sede_id, {
        sede_id: item.sede_id,
        sede_nombre: item.sede_nombre,
        num_entregas: 1,
        cantidad_total: item.cantidad_entregada,
        costo_total: item.costo_total ?? 0,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.costo_total - a.costo_total);
}

export function aggregateByArea(items: CostoEntregaItem[]): CostoPorArea[] {
  const map = new Map<string, CostoPorArea>();
  for (const item of items) {
    const key = item.area_id ?? 'sin-area';
    const existing = map.get(key);
    if (existing) {
      existing.num_entregas += 1;
      existing.cantidad_total += item.cantidad_entregada;
      existing.costo_total += item.costo_total ?? 0;
    } else {
      map.set(key, {
        area_id: item.area_id,
        area_nombre: item.area_nombre,
        sede_nombre: item.sede_nombre,
        num_entregas: 1,
        cantidad_total: item.cantidad_entregada,
        costo_total: item.costo_total ?? 0,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.costo_total - a.costo_total);
}

export async function fetchAllSedes(): Promise<SedeRow[]> {
  const { data, error } = await supabase
    .from('sedes')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre');
  if (error) throw new Error(getErrorMessage(error));
  return (data ?? []) as SedeRow[];
}

export async function fetchAllAreas(sedeId?: string): Promise<AreaRow[]> {
  let query = supabase.from('areas').select('id, nombre, sede_id').eq('activo', true).order('nombre');
  if (sedeId) query = query.eq('sede_id', sedeId);
  const { data, error } = await query;
  if (error) throw new Error(getErrorMessage(error));
  return (data ?? []) as AreaRow[];
}
