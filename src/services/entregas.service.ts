import { supabase } from '@/lib/supabase';
import type {
  Entrega,
  EntregaWithRelations,
  EntregaInsert,
  EstadoEntrega,
} from '@/types/entregas.types';
import type { SolicitudWithRelations } from '@/types/solicitudes.types';
import type { EntregaFirmaWithRelations, TipoFirma } from '@/types/firma.types';
import type { RegistroSST } from '@/types/registro-sst.types';

async function logAudit(
  action: string,
  module: string,
  recordId: string | null,
  operation: string,
  details?: Record<string, unknown>
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('audit_log').insert({
    user_id: user?.id ?? null,
    action,
    module,
    record_id: recordId,
    operation,
    details: details ?? null,
  });
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message: string }).message;
    if (msg.includes('No tiene permisos')) {
      return 'No tiene permisos para realizar esta acción.';
    }
    if (msg.includes('Stock insuficiente') || msg.includes('EN_ESPERA_STOCK')) {
      return 'No hay suficiente stock para confirmar esta entrega.';
    }
    if (msg.includes('no está en preparación')) {
      return 'La entrega no se puede confirmar en su estado actual.';
    }
    if (msg.includes('no puede cancelarse')) {
      return 'La entrega no se puede cancelar en su estado actual.';
    }
    if (msg.includes('no está pendiente de firma')) {
      return 'La entrega no está pendiente de firma en este momento.';
    }
    if (msg.includes('no está pendiente de firma del responsable')) {
      return 'La entrega no está pendiente de la firma del responsable.';
    }
    if (msg.includes('La firma no puede estar vacía')) {
      return 'Debe dibujar una firma antes de guardar.';
    }
    if (msg.includes('El nombre del firmante es obligatorio')) {
      return 'Debe ingresar el nombre del firmante.';
    }
    if (msg.includes('no tiene ambas firmas completas')) {
      return 'La entrega debe tener ambas firmas (trabajador y responsable) para generar el Registro SST.';
    }
    if (msg.includes('No tiene permisos para generar el Registro SST')) {
      return 'No tiene permisos para generar el Registro SST.';
    }
    if (msg.includes('violates foreign key')) {
      return 'No se puede realizar esta acción porque el registro está relacionado con otros datos.';
    }
    return msg;
  }
  return 'Ocurrió un error inesperado.';
}

export async function fetchEntregas(filters?: {
  estado?: EstadoEntrega;
  sedeId?: string;
  trabajadorId?: string;
}): Promise<EntregaWithRelations[]> {
  let query = supabase
    .from('entregas')
    .select(`
      *,
      trabajador:trabajadores!trabajador_id(nombres, apellidos, dni),
      epp:catalogo_epp!epp_id(nombre, codigo),
      sede:sedes!sede_id(nombre),
      solicitud:solicitudes_epp!solicitud_id(numero_solicitud)
    `)
    .order('created_at', { ascending: false });

  if (filters?.estado) query = query.eq('estado', filters.estado);
  if (filters?.sedeId) query = query.eq('sede_id', filters.sedeId);
  if (filters?.trabajadorId) query = query.eq('trabajador_id', filters.trabajadorId);

  const { data, error } = await query;
  if (error) throw new Error(getErrorMessage(error));

  const rows = (data ?? []) as unknown as Entrega[];

  const userIds = Array.from(new Set(
    rows.flatMap((r) => [r.generado_por, r.confirmado_por]).filter((id): id is string => id !== null)
  ));

  const nameMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users, error: userError } = await supabase
      .from('user_public_names')
      .select('id, full_name, email')
      .in('id', userIds);
    if (!userError && users) {
      for (const u of users) {
        nameMap.set(u.id, u.full_name ?? u.email ?? '—');
      }
    }
  }

  const eppSedePairs = Array.from(new Set(
    rows.map((r) => `${r.epp_id}:${r.sede_id}`)
  ));

  const stockMap = new Map<string, number>();
  if (eppSedePairs.length > 0) {
    const eppIds = rows.map((r) => r.epp_id);
    const sedeIds = rows.map((r) => r.sede_id);
    const { data: inv, error: invError } = await supabase
      .from('inventario')
      .select('epp_id, sede_id, stock_actual')
      .in('epp_id', eppIds)
      .in('sede_id', sedeIds);
    if (!invError && inv) {
      for (const i of inv) {
        stockMap.set(`${i.epp_id}:${i.sede_id}`, i.stock_actual);
      }
    }
  }

  return rows.map((row) => {
    const r = row as unknown as Record<string, unknown>;
    const trabajador = r.trabajador as Record<string, unknown> | null;
    const epp = r.epp as Record<string, unknown> | null;
    const sede = r.sede as Record<string, unknown> | null;
    const solicitud = r.solicitud as Record<string, unknown> | null;
    return {
      ...(r as unknown as Entrega),
      trabajador_nombre: trabajador
        ? `${trabajador.nombres ?? ''} ${trabajador.apellidos ?? ''}`.trim()
        : '—',
      trabajador_dni: (trabajador?.dni as string) ?? '—',
      epp_nombre: (epp?.nombre as string) ?? '—',
      epp_codigo: (epp?.codigo as string) ?? '—',
      sede_nombre: (sede?.nombre as string) ?? '—',
      solicitud_numero: (solicitud?.numero_solicitud as string) ?? null,
      generado_nombre: row.generado_por ? (nameMap.get(row.generado_por) ?? '—') : '—',
      confirmado_nombre: row.confirmado_por ? (nameMap.get(row.confirmado_por) ?? '—') : '—',
      stock_disponible: stockMap.get(`${row.epp_id}:${row.sede_id}`) ?? 0,
    };
  });
}

export async function fetchSolicitudesAprobadas(): Promise<SolicitudWithRelations[]> {
  const { data: entregas } = await supabase
    .from('entregas')
    .select('solicitud_id')
    .not('solicitud_id', 'is', null);

  const usedSolicitudIds = new Set(
    (entregas ?? []).map((e) => (e as { solicitud_id: string }).solicitud_id)
  );

  const { data, error } = await supabase
    .from('solicitudes_epp')
    .select(`
      *,
      trabajador:trabajadores!trabajador_id(nombres, apellidos, dni),
      epp:catalogo_epp!epp_id(nombre, codigo, talla_requerida),
      sede:sedes!sede_id(nombre)
    `)
    .eq('estado', 'APROBADA')
    .order('created_at', { ascending: false });

  if (error) throw new Error(getErrorMessage(error));

  const rows = (data ?? []) as unknown as SolicitudWithRelations[];
  return rows.filter((r) => !usedSolicitudIds.has(r.id));
}

export async function generarEntregaDesdeSolicitud(solicitudId: string): Promise<Entrega> {
  const { data: sol, error: solError } = await supabase
    .from('solicitudes_epp')
    .select('*')
    .eq('id', solicitudId)
    .maybeSingle();

  if (solError) throw new Error(getErrorMessage(solError));
  if (!sol) throw new Error('La solicitud no existe.');
  if (sol.estado !== 'APROBADA') throw new Error('La solicitud no está aprobada.');

  const insert: EntregaInsert = {
    solicitud_id: solicitudId,
    trabajador_id: sol.trabajador_id,
    epp_id: sol.epp_id,
    sede_id: sol.sede_id,
    talla: sol.talla ?? null,
    cantidad_entregada: sol.cantidad,
    cantidad_autorizada: sol.cantidad,
    observacion: null,
  };

  const { data, error } = await supabase
    .from('entregas')
    .insert(insert)
    .select()
    .single();

  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Generar entrega desde solicitud', 'Entregas', data.id, 'INSERT', {
    numero_entrega: data.numero_entrega,
    solicitud_id: solicitudId,
  });
  return data as Entrega;
}

export async function generarEntregaDirecta(input: EntregaInsert): Promise<Entrega> {
  const { data, error } = await supabase
    .from('entregas')
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Generar entrega directa', 'Entregas', data.id, 'INSERT', {
    numero_entrega: data.numero_entrega,
    trabajador_id: input.trabajador_id,
  });
  return data as Entrega;
}

export async function cambiarEstadoEntrega(
  entregaId: string,
  nuevoEstado: 'EN_PREPARACION'
): Promise<void> {
  const { error } = await supabase
    .from('entregas')
    .update({ estado: nuevoEstado })
    .eq('id', entregaId);

  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Cambiar estado entrega', 'Entregas', entregaId, 'UPDATE', { nuevoEstado });
}

export async function confirmarEntrega(
  entregaId: string
): Promise<{ success: boolean; estado: string; numero_entrega: string; stock_disponible?: number; kardex_id?: string; nuevo_saldo?: number }> {
  const { data, error } = await supabase.rpc('confirmar_entrega', {
    p_entrega_id: entregaId,
  });
  if (error) throw new Error(getErrorMessage(error));
  return data as { success: boolean; estado: string; numero_entrega: string; stock_disponible?: number; kardex_id?: string; nuevo_saldo?: number };
}

export async function cancelarEntrega(
  entregaId: string,
  motivo: string
): Promise<{ success: boolean; estado: string; numero_entrega: string }> {
  const { data, error } = await supabase.rpc('cancelar_entrega', {
    p_entrega_id: entregaId,
    p_motivo: motivo,
  });
  if (error) throw new Error(getErrorMessage(error));
  return data as { success: boolean; estado: string; numero_entrega: string };
}

// ============================================================
// FIRMAS
// ============================================================

export async function fetchFirmasByEntrega(entregaId: string): Promise<EntregaFirmaWithRelations[]> {
  const { data, error } = await supabase
    .from('entrega_firmas')
    .select('*')
    .eq('entrega_id', entregaId)
    .order('fecha_firma', { ascending: true });

  if (error) throw new Error(getErrorMessage(error));

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;

  const userIds = Array.from(new Set(
    rows.map((r) => r.firmado_por as string).filter((id): id is string => id !== null)
  ));

  const nameMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users, error: userError } = await supabase
      .from('user_public_names')
      .select('id, full_name, email')
      .in('id', userIds);
    if (!userError && users) {
      for (const u of users) {
        nameMap.set(u.id, u.full_name ?? u.email ?? '—');
      }
    }
  }

  return rows.map((row) => ({
    id: row.id as string,
    entrega_id: row.entrega_id as string,
    tipo_firma: row.tipo_firma as TipoFirma,
    firma_data: row.firma_data as string,
    firmado_por: (row.firmado_por as string) ?? null,
    nombre_firmante: row.nombre_firmante as string,
    fecha_firma: row.fecha_firma as string,
    created_at: row.created_at as string,
    firmado_nombre: row.firmado_por ? (nameMap.get(row.firmado_por as string) ?? '—') : '—',
  }));
}

export async function registrarFirma(
  entregaId: string,
  tipoFirma: TipoFirma,
  firmaData: string,
  nombreFirmante: string
): Promise<{ success: boolean; estado: string; numero_entrega: string; tipo_firma: string }> {
  const { data, error } = await supabase.rpc('registrar_firma', {
    p_entrega_id: entregaId,
    p_tipo_firma: tipoFirma,
    p_firma_data: firmaData,
    p_nombre_firmante: nombreFirmante,
  });
  if (error) throw new Error(getErrorMessage(error));
  return data as { success: boolean; estado: string; numero_entrega: string; tipo_firma: string };
}

// ============================================================
// REGISTRO SST / RM050
// ============================================================

export async function generarRegistroSST(
  entregaId: string
): Promise<{ success: boolean; registro_id: string; already_exists: boolean }> {
  const { data, error } = await supabase.rpc('generar_registro_sst', {
    p_entrega_id: entregaId,
  });
  if (error) throw new Error(getErrorMessage(error));
  return data as { success: boolean; registro_id: string; already_exists: boolean };
}

export async function fetchRegistroSST(entregaId: string): Promise<RegistroSST | null> {
  const { data, error } = await supabase
    .from('registro_sst')
    .select('*')
    .eq('entrega_id', entregaId)
    .maybeSingle();
  if (error) throw new Error(getErrorMessage(error));
  return data as RegistroSST | null;
}
