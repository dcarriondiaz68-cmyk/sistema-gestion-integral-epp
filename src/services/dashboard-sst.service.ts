import { supabase } from '@/lib/supabase';
import { computeEstadoVigencia } from '@/services/historial.service';
import type {
  DashboardFilters,
  DashboardKPIs,
  SerieMensual,
  DistribucionItem,
  EstadoVigenciaDistribucion,
  AlertaVigencia,
} from '@/types/dashboard-sst.types';
import type { EstadoVigencia } from '@/types/historial.types';

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return (error as { message: string }).message;
  }
  return 'Ocurrió un error inesperado.';
}

interface RawEntregaRow {
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
  entrega_origen_id: string | null;
  trabajador: { nombres: string; apellidos: string; dni: string; area_id: string } | null;
  epp: { nombre: string; codigo: string; vida_util_meses: number | null } | null;
  sede: { nombre: string } | null;
}

interface AreaRow {
  id: string;
  nombre: string;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function monthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function fetchEntregasParaDashboard(filters?: DashboardFilters): Promise<{
  rows: RawEntregaRow[];
  areaMap: Map<string, string>;
  renovadoPorMap: Map<string, string>;
}> {
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
      entrega_origen_id,
      trabajador:trabajadores!trabajador_id(nombres, apellidos, dni, area_id),
      epp:catalogo_epp!epp_id(nombre, codigo, vida_util_meses),
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

  let rows = (data ?? []) as unknown as RawEntregaRow[];

  if (filters?.areaId) {
    rows = rows.filter((r) => r.trabajador?.area_id === filters.areaId);
  }

  const areaIds = Array.from(new Set(
    rows.map((r) => r.trabajador?.area_id).filter((id): id is string => !!id)
  ));

  const areaMap = new Map<string, string>();
  if (areaIds.length > 0) {
    const { data: areas } = await supabase
      .from('areas')
      .select('id, nombre')
      .in('id', areaIds) as { data: AreaRow[] | null; error: null };
    if (areas) {
      for (const a of areas) {
        areaMap.set(a.id, a.nombre);
      }
    }
  }

  const renovationIds = rows
    .filter((r) => r.entrega_origen_id)
    .map((r) => r.entrega_origen_id!) as string[];

  const renovadoPorMap = new Map<string, string>();
  if (renovationIds.length > 0) {
    const { data: renoEntregas } = await supabase
      .from('entregas')
      .select('id, numero_entrega, entrega_origen_id')
      .in('entrega_origen_id', renovationIds);
    if (renoEntregas) {
      for (const r of renoEntregas) {
        if (r.entrega_origen_id) {
          renovadoPorMap.set(r.entrega_origen_id, r.numero_entrega);
        }
      }
    }
  }

  return { rows, areaMap, renovadoPorMap };
}

export async function fetchDashboardKPIs(filters?: DashboardFilters): Promise<DashboardKPIs> {
  const { rows, renovadoPorMap } = await fetchEntregasParaDashboard(filters);

  let totalTrabajadoresQuery = supabase
    .from('trabajadores')
    .select('id', { count: 'exact', head: true })
    .eq('activo', true);
  if (filters?.sedeId) totalTrabajadoresQuery = totalTrabajadoresQuery.eq('sede_id', filters.sedeId);
  const totalTrabajadoresResult = await totalTrabajadoresQuery;
  const totalTrabajadores = totalTrabajadoresResult.count ?? 0;

  const trabajadoresConEppSet = new Set<string>();
  let eppVigentes = 0;
  let eppPorVencer = 0;
  let eppVencidos = 0;
  let renovadosCount = 0;
  let vencidosSinRenovar = 0;
  let costoTotalEntregas = 0;

  for (const row of rows) {
    const fechaConfirmacion = row.fecha_confirmacion;
    const vidaUtilMeses = row.epp?.vida_util_meses ?? null;

    let fechaRenovacion: string | null = null;
    if (fechaConfirmacion && vidaUtilMeses) {
      fechaRenovacion = addMonths(new Date(fechaConfirmacion), vidaUtilMeses).toISOString();
    }

    const renovadoPorNumero = row.entrega_origen_id
      ? renovadoPorMap.get(row.entrega_origen_id) ?? null
      : null;

    const { estado } = computeEstadoVigencia(fechaRenovacion, renovadoPorNumero);

    trabajadoresConEppSet.add(row.trabajador_id);

    if (estado === 'VIGENTE') eppVigentes++;
    else if (estado === 'POR_VENCER') eppPorVencer++;
    else if (estado === 'VENCIDO') {
      eppVencidos++;
      vencidosSinRenovar++;
    } else if (estado === 'RENOVADO') {
      renovadosCount++;
    }

    if (row.precio_historico != null) {
      costoTotalEntregas += row.cantidad_entregada * row.precio_historico;
    }
  }

  const trabajadoresConEpp = trabajadoresConEppSet.size;
  const coberturaPorcentaje = totalTrabajadores > 0
    ? Math.round((trabajadoresConEpp / totalTrabajadores) * 100)
    : 0;

  const cumplimientoRenovaciones = (renovadosCount + vencidosSinRenovar) > 0
    ? Math.round((renovadosCount / (renovadosCount + vencidosSinRenovar)) * 100)
    : 0;

  let valorizacionInventario = 0;
  let invQuery = supabase
    .from('inventario')
    .select(`
      stock_actual,
      epp:catalogo_epp!epp_id(precio_unitario)
    `);
  if (filters?.sedeId) invQuery = invQuery.eq('sede_id', filters.sedeId);
  const { data: invData } = await invQuery;
  if (invData) {
    for (const inv of invData) {
      const r = inv as unknown as Record<string, unknown>;
      const epp = r.epp as Record<string, unknown> | null;
      const precio = (epp?.precio_unitario as number) ?? null;
      const stock = (r.stock_actual as number) ?? 0;
      if (precio != null) {
        valorizacionInventario += stock * precio;
      }
    }
  }

  return {
    totalTrabajadores,
    trabajadoresConEpp,
    coberturaPorcentaje,
    eppVigentes,
    eppPorVencer,
    eppVencidos,
    entregasPeriodo: rows.length,
    cumplimientoRenovaciones,
    valorizacionInventario,
    costoTotalEntregas,
  };
}

export async function fetchEntregasPorMes(filters?: DashboardFilters): Promise<SerieMensual[]> {
  const { rows } = await fetchEntregasParaDashboard(filters);

  const now = new Date();
  const meses: SerieMensual[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const etiqueta = d.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' });
    meses.push({ mes: key, etiqueta, entregas: 0, costo: 0 });
  }

  const map = new Map(meses.map((m) => [m.mes, m]));

  for (const row of rows) {
    if (!row.fecha_confirmacion) continue;
    const d = new Date(row.fecha_confirmacion);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const entry = map.get(key);
    if (entry) {
      entry.entregas += 1;
      if (row.precio_historico != null) {
        entry.costo += row.cantidad_entregada * row.precio_historico;
      }
    }
  }

  return meses;
}

export async function fetchDistribucionPorSede(filters?: DashboardFilters): Promise<DistribucionItem[]> {
  const { rows } = await fetchEntregasParaDashboard(filters);

  const map = new Map<string, DistribucionItem>();
  for (const row of rows) {
    const nombre = row.sede?.nombre ?? '—';
    const existing = map.get(nombre);
    if (existing) {
      existing.cantidad += 1;
      if (row.precio_historico != null) {
        existing.costo += row.cantidad_entregada * row.precio_historico;
      }
    } else {
      map.set(nombre, {
        nombre,
        cantidad: 1,
        costo: row.precio_historico != null ? row.cantidad_entregada * row.precio_historico : 0,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.cantidad - a.cantidad);
}

export async function fetchDistribucionPorArea(filters?: DashboardFilters): Promise<DistribucionItem[]> {
  const { rows, areaMap } = await fetchEntregasParaDashboard(filters);

  const map = new Map<string, DistribucionItem>();
  for (const row of rows) {
    const nombre = row.trabajador?.area_id
      ? areaMap.get(row.trabajador.area_id) ?? '—'
      : 'Sin área';
    const existing = map.get(nombre);
    if (existing) {
      existing.cantidad += 1;
      if (row.precio_historico != null) {
        existing.costo += row.cantidad_entregada * row.precio_historico;
      }
    } else {
      map.set(nombre, {
        nombre,
        cantidad: 1,
        costo: row.precio_historico != null ? row.cantidad_entregada * row.precio_historico : 0,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);
}

export async function fetchDistribucionPorEPP(filters?: DashboardFilters): Promise<DistribucionItem[]> {
  const { rows } = await fetchEntregasParaDashboard(filters);

  const map = new Map<string, DistribucionItem>();
  for (const row of rows) {
    const nombre = row.epp?.nombre ?? '—';
    const existing = map.get(nombre);
    if (existing) {
      existing.cantidad += 1;
      if (row.precio_historico != null) {
        existing.costo += row.cantidad_entregada * row.precio_historico;
      }
    } else {
      map.set(nombre, {
        nombre,
        cantidad: 1,
        costo: row.precio_historico != null ? row.cantidad_entregada * row.precio_historico : 0,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);
}

export async function fetchEstadoVigenciaDistribucion(filters?: DashboardFilters): Promise<EstadoVigenciaDistribucion[]> {
  const { rows, renovadoPorMap } = await fetchEntregasParaDashboard(filters);

  const counts = new Map<string, number>([
    ['VIGENTE', 0],
    ['POR_VENCER', 0],
    ['VENCIDO', 0],
    ['RENOVADO', 0],
  ]);

  for (const row of rows) {
    const fechaConfirmacion = row.fecha_confirmacion;
    const vidaUtilMeses = row.epp?.vida_util_meses ?? null;

    let fechaRenovacion: string | null = null;
    if (fechaConfirmacion && vidaUtilMeses) {
      fechaRenovacion = addMonths(new Date(fechaConfirmacion), vidaUtilMeses).toISOString();
    }

    const renovadoPorNumero = row.entrega_origen_id
      ? renovadoPorMap.get(row.entrega_origen_id) ?? null
      : null;

    const { estado } = computeEstadoVigencia(fechaRenovacion, renovadoPorNumero);
    counts.set(estado, (counts.get(estado) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([estado, cantidad]) => ({
    estado: estado as EstadoVigencia,
    cantidad,
  }));
}

export async function fetchAlertasVigencia(filters?: DashboardFilters): Promise<AlertaVigencia[]> {
  let query = supabase
    .from('entregas')
    .select(`
      id,
      numero_entrega,
      trabajador_id,
      epp_id,
      sede_id,
      cantidad_entregada,
      fecha_confirmacion,
      estado,
      entrega_origen_id,
      created_at,
      trabajador:trabajadores!trabajador_id(nombres, apellidos, dni, area_id),
      epp:catalogo_epp!epp_id(nombre, codigo, vida_util_meses),
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

  let rows = (data ?? []) as unknown as RawEntregaRow[];
  if (filters?.areaId) {
    rows = rows.filter((r) => r.trabajador?.area_id === filters.areaId);
  }

  const areaIds = Array.from(new Set(
    rows.map((r) => r.trabajador?.area_id).filter((id): id is string => !!id)
  ));
  const areaMap = new Map<string, string>();
  if (areaIds.length > 0) {
    const { data: areas } = await supabase
      .from('areas')
      .select('id, nombre')
      .in('id', areaIds) as { data: AreaRow[] | null; error: null };
    if (areas) {
      for (const a of areas) {
        areaMap.set(a.id, a.nombre);
      }
    }
  }

  const renovationIds = rows
    .filter((r) => r.entrega_origen_id)
    .map((r) => r.entrega_origen_id!) as string[];
  const renovadoPorMap = new Map<string, string>();
  if (renovationIds.length > 0) {
    const { data: renoEntregas } = await supabase
      .from('entregas')
      .select('id, numero_entrega, entrega_origen_id')
      .in('entrega_origen_id', renovationIds);
    if (renoEntregas) {
      for (const r of renoEntregas) {
        if (r.entrega_origen_id) {
          renovadoPorMap.set(r.entrega_origen_id, r.numero_entrega);
        }
      }
    }
  }

  const alertas: AlertaVigencia[] = [];

  for (const row of rows) {
    const fechaConfirmacion = row.fecha_confirmacion;
    const vidaUtilMeses = row.epp?.vida_util_meses ?? null;

    let fechaRenovacion: string | null = null;
    if (fechaConfirmacion && vidaUtilMeses) {
      fechaRenovacion = addMonths(new Date(fechaConfirmacion), vidaUtilMeses).toISOString();
    }

    const renovadoPorNumero = row.entrega_origen_id
      ? renovadoPorMap.get(row.entrega_origen_id) ?? null
      : null;

    const { estado, diasRestantes } = computeEstadoVigencia(fechaRenovacion, renovadoPorNumero);

    if (estado === 'POR_VENCER' || estado === 'VENCIDO') {
      const trabajador = row.trabajador;
      alertas.push({
        entrega_id: row.id,
        numero_entrega: row.numero_entrega,
        trabajador_nombre: trabajador
          ? `${trabajador.nombres ?? ''} ${trabajador.apellidos ?? ''}`.trim()
          : '—',
        trabajador_dni: trabajador?.dni ?? '—',
        epp_nombre: row.epp?.nombre ?? '—',
        epp_codigo: row.epp?.codigo ?? '—',
        sede_nombre: row.sede?.nombre ?? '—',
        area_nombre: trabajador?.area_id ? areaMap.get(trabajador.area_id) ?? '—' : '—',
        estado_vigencia: estado,
        dias_restantes: diasRestantes,
        fecha_renovacion: fechaRenovacion,
      });
    }
  }

  return alertas.sort((a, b) => {
    if (a.estado_vigencia === 'VENCIDO' && b.estado_vigencia !== 'VENCIDO') return -1;
    if (a.estado_vigencia !== 'VENCIDO' && b.estado_vigencia === 'VENCIDO') return 1;
    return (a.dias_restantes ?? 999) - (b.dias_restantes ?? 999);
  });
}

export function getDefaultFechaDesde(): string {
  return monthsAgo(12);
}
