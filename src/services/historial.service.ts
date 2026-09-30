import { supabase } from '@/lib/supabase';
import type { HistorialEPP, EstadoVigencia } from '@/types/historial.types';
import type { EntregaInsert } from '@/types/entregas.types';

const DIAS_POR_VENCER = 30;

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return (error as { message: string }).message;
  }
  return 'Ocurrió un error inesperado.';
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function daysBetween(from: Date, to: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((to.getTime() - from.getTime()) / msPerDay);
}

export function computeEstadoVigencia(
  fechaRenovacion: string | null,
  renovadoPorEntregaId: string | null
): { estado: EstadoVigencia; diasRestantes: number | null } {
  if (renovadoPorEntregaId) {
    return { estado: 'RENOVADO', diasRestantes: null };
  }
  if (!fechaRenovacion) {
    return { estado: 'VIGENTE', diasRestantes: null };
  }

  const renovacionDate = new Date(fechaRenovacion);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  renovacionDate.setHours(0, 0, 0, 0);

  const dias = daysBetween(today, renovacionDate);

  if (dias < 0) {
    return { estado: 'VENCIDO', diasRestantes: dias };
  }
  if (dias <= DIAS_POR_VENCER) {
    return { estado: 'POR_VENCER', diasRestantes: dias };
  }
  return { estado: 'VIGENTE', diasRestantes: dias };
}

interface RawEntregaRow {
  id: string;
  numero_entrega: string;
  trabajador_id: string;
  epp_id: string;
  sede_id: string;
  talla: string | null;
  cantidad_entregada: number;
  estado: string;
  fecha_confirmacion: string | null;
  observacion: string | null;
  entrega_origen_id: string | null;
  created_at: string;
  trabajador: { nombres: string; apellidos: string; dni: string; area_id: string; puesto_id: string | null } | null;
  epp: { nombre: string; codigo: string; vida_util_meses: number | null } | null;
  sede: { nombre: string } | null;
  solicitud: { numero_solicitud: string } | null;
  entrega_origen: { numero_entrega: string } | null;
}

interface AreaRow {
  id: string;
  nombre: string;
}

interface PuestoRow {
  id: string;
  nombre: string;
}

export interface HistorialFilters {
  trabajadorId?: string;
  trabajadorEmail?: string;
  eppId?: string;
  sedeId?: string;
  areaId?: string;
  estadoVigencia?: EstadoVigencia;
  fechaDesde?: string;
  fechaHasta?: string;
}

export async function fetchHistorialEPP(filters?: HistorialFilters): Promise<HistorialEPP[]> {
  let query = supabase
    .from('entregas')
    .select(`
      id,
      numero_entrega,
      trabajador_id,
      epp_id,
      sede_id,
      talla,
      cantidad_entregada,
      estado,
      fecha_confirmacion,
      observacion,
      entrega_origen_id,
      created_at,
      trabajador:trabajadores!trabajador_id(nombres, apellidos, dni, area_id, puesto_id),
      epp:catalogo_epp!epp_id(nombre, codigo, vida_util_meses),
      sede:sedes!sede_id(nombre),
      solicitud:solicitudes_epp!solicitud_id(numero_solicitud),
      entrega_origen:entregas!entrega_origen_id(numero_entrega)
    `)
    .in('estado', ['ENTREGADA_PENDIENTE_FIRMA', 'FIRMADA_TRABAJADOR', 'FIRMADA_COMPLETA'])
    .order('created_at', { ascending: false });

  if (filters?.trabajadorId) {
    query = query.eq('trabajador_id', filters.trabajadorId);
  }
  if (filters?.eppId) {
    query = query.eq('epp_id', filters.eppId);
  }
  if (filters?.sedeId) {
    query = query.eq('sede_id', filters.sedeId);
  }
  if (filters?.fechaDesde) {
    query = query.gte('fecha_confirmacion', filters.fechaDesde);
  }
  if (filters?.fechaHasta) {
    query = query.lte('fecha_confirmacion', filters.fechaHasta);
  }

  if (filters?.trabajadorEmail) {
    const { data: trab, error: trabError } = await supabase
      .from('trabajadores')
      .select('id')
      .eq('email', filters.trabajadorEmail)
      .maybeSingle();

    if (trabError) throw new Error(getErrorMessage(trabError));
    if (!trab) return [];
    query = query.eq('trabajador_id', trab.id);
  }

  const { data, error } = await query;
  if (error) throw new Error(getErrorMessage(error));

  const rows = (data ?? []) as unknown as RawEntregaRow[];

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

  const puestoIds = Array.from(new Set(
    rows.map((r) => r.trabajador?.puesto_id).filter((id): id is string => !!id)
  ));

  const puestoMap = new Map<string, string>();
  if (puestoIds.length > 0) {
    const { data: puestos } = await supabase
      .from('puestos')
      .select('id, nombre')
      .in('id', puestoIds) as { data: PuestoRow[] | null; error: null };

    if (puestos) {
      for (const p of puestos) {
        puestoMap.set(p.id, p.nombre);
      }
    }
  }

  let filtered = rows;
  if (filters?.areaId) {
    filtered = filtered.filter((r) => r.trabajador?.area_id === filters.areaId);
  }

  const computed = filtered.map((row) => {
    const fechaConfirmacion = row.fecha_confirmacion;
    const vidaUtilMeses = row.epp?.vida_util_meses ?? null;

    let fechaRenovacion: string | null = null;
    if (fechaConfirmacion && vidaUtilMeses) {
      const baseDate = new Date(fechaConfirmacion);
      const renovacionDate = addMonths(baseDate, vidaUtilMeses);
      fechaRenovacion = renovacionDate.toISOString();
    }

    const renovadoPorNumero = row.entrega_origen_id
      ? renovadoPorMap.get(row.entrega_origen_id) ?? null
      : null;

    const { estado, diasRestantes } = computeEstadoVigencia(
      fechaRenovacion,
      renovadoPorNumero
    );

    const trabajador = row.trabajador;
    const areaNombre = trabajador?.area_id
      ? areaMap.get(trabajador.area_id) ?? '—'
      : '—';

    return {
      entrega_id: row.id,
      numero_entrega: row.numero_entrega,
      trabajador_id: row.trabajador_id,
      trabajador_nombre: trabajador
        ? `${trabajador.nombres ?? ''} ${trabajador.apellidos ?? ''}`.trim()
        : '—',
      trabajador_dni: trabajador?.dni ?? '—',
      epp_id: row.epp_id,
      epp_nombre: row.epp?.nombre ?? '—',
      epp_codigo: row.epp?.codigo ?? '—',
      cantidad_entregada: row.cantidad_entregada,
      talla: row.talla,
      fecha_entrega: row.created_at,
      fecha_confirmacion: fechaConfirmacion,
      fecha_renovacion: fechaRenovacion,
      vida_util_meses: vidaUtilMeses,
      estado_vigencia: estado,
      dias_restantes: diasRestantes,
      sede_id: row.sede_id,
      sede_nombre: row.sede?.nombre ?? '—',
      area_id: row.trabajador?.area_id ?? null,
      area_nombre: areaNombre,
      puesto_id: row.trabajador?.puesto_id ?? null,
      puesto_nombre: trabajador?.puesto_id ? puestoMap.get(trabajador.puesto_id) ?? null : null,
      solicitud_id: null,
      solicitud_numero: row.solicitud?.numero_solicitud ?? null,
      entrega_origen_id: row.entrega_origen_id,
      entrega_origen_numero: row.entrega_origen?.numero_entrega ?? null,
      renovado_por_entrega_id: renovadoPorNumero ? row.entrega_origen_id : null,
      renovado_por_entrega_numero: renovadoPorNumero,
      observacion: row.observacion,
    };
  });

  if (filters?.estadoVigencia) {
    return computed.filter((item) => item.estado_vigencia === filters.estadoVigencia);
  }
  return computed;
}

export async function renovarEPP(entregaOrigenId: string): Promise<string> {
  const { data: original, error: origError } = await supabase
    .from('entregas')
    .select('*')
    .eq('id', entregaOrigenId)
    .maybeSingle();

  if (origError) throw new Error(getErrorMessage(origError));
  if (!original) throw new Error('La entrega original no existe.');

  const insert: EntregaInsert = {
    solicitud_id: null,
    trabajador_id: original.trabajador_id,
    epp_id: original.epp_id,
    sede_id: original.sede_id,
    talla: original.talla ?? null,
    cantidad_entregada: original.cantidad_entregada,
    cantidad_autorizada: original.cantidad_entregada,
    observacion: `Renovación de entrega ${original.numero_entrega}`,
    entrega_origen_id: entregaOrigenId,
  };

  const { data: nueva, error: insertError } = await supabase
    .from('entregas')
    .insert(insert)
    .select()
    .single();

  if (insertError) throw new Error(getErrorMessage(insertError));

  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('audit_log').insert({
    user_id: user?.id ?? null,
    action: 'Renovar EPP',
    module: 'Renovaciones',
    record_id: nueva.id,
    operation: 'INSERT',
    details: {
      entrega_origen_id: entregaOrigenId,
      entrega_origen_numero: original.numero_entrega,
      nueva_entrega_numero: nueva.numero_entrega,
    },
  });

  return nueva.id;
}
