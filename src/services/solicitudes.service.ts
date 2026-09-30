import { supabase } from '@/lib/supabase';
import type {
  SolicitudEPP,
  SolicitudWithRelations,
  SolicitudInsert,
  EstadoSolicitud,
} from '@/types/solicitudes.types';

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
    if (msg.includes('violates foreign key')) {
      return 'No se puede realizar esta acción porque el registro está relacionado con otros datos.';
    }
    return msg;
  }
  return 'Ocurrió un error inesperado.';
}

export async function fetchSolicitudes(filters?: {
  estado?: EstadoSolicitud;
  sedeId?: string;
  trabajadorId?: string;
  eppId?: string;
}): Promise<SolicitudWithRelations[]> {
  let query = supabase
    .from('solicitudes_epp')
    .select(`
      *,
      trabajador:trabajadores!trabajador_id(nombres, apellidos, dni),
      epp:catalogo_epp!epp_id(nombre, codigo, talla_requerida),
      sede:sedes!sede_id(nombre)
    `)
    .order('created_at', { ascending: false });

  if (filters?.estado) query = query.eq('estado', filters.estado);
  if (filters?.sedeId) query = query.eq('sede_id', filters.sedeId);
  if (filters?.trabajadorId) query = query.eq('trabajador_id', filters.trabajadorId);
  if (filters?.eppId) query = query.eq('epp_id', filters.eppId);

  const { data, error } = await query;
  if (error) throw new Error(getErrorMessage(error));

  const rows = (data ?? []) as unknown as SolicitudEPP[];

  const userIds = Array.from(new Set(
    rows.flatMap((r) => [r.solicitado_por, r.aprobado_por]).filter((id): id is string => id !== null)
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

  const solicitudIds = rows.map((r) => r.id);
  const entregaMap = new Map<string, { id: string; numero_entrega: string }>();
  if (solicitudIds.length > 0) {
    const { data: entregas, error: entError } = await supabase
      .from('entregas')
      .select('id, numero_entrega, solicitud_id')
      .in('solicitud_id', solicitudIds);
    if (!entError && entregas) {
      for (const e of entregas as unknown as Array<{ id: string; numero_entrega: string; solicitud_id: string | null }>) {
        if (e.solicitud_id && !entregaMap.has(e.solicitud_id)) {
          entregaMap.set(e.solicitud_id, { id: e.id, numero_entrega: e.numero_entrega });
        }
      }
    }
  }

  return rows.map((row) => {
    const r = row as unknown as Record<string, unknown>;
    const trabajador = r.trabajador as Record<string, unknown> | null;
    const epp = r.epp as Record<string, unknown> | null;
    const sede = r.sede as Record<string, unknown> | null;
    const entrega = entregaMap.get(row.id) ?? null;
    return {
      ...(r as unknown as SolicitudEPP),
      trabajador_nombre: trabajador
        ? `${trabajador.nombres ?? ''} ${trabajador.apellidos ?? ''}`.trim()
        : '—',
      trabajador_dni: (trabajador?.dni as string) ?? '—',
      epp_nombre: (epp?.nombre as string) ?? '—',
      epp_codigo: (epp?.codigo as string) ?? '—',
      epp_talla_requerida: (epp?.talla_requerida as boolean) ?? false,
      sede_nombre: (sede?.nombre as string) ?? '—',
      solicitado_nombre: row.solicitado_por ? (nameMap.get(row.solicitado_por) ?? '—') : '—',
      aprobado_nombre: row.aprobado_por ? (nameMap.get(row.aprobado_por) ?? '—') : '—',
      entrega_id: entrega?.id ?? null,
      entrega_numero: entrega?.numero_entrega ?? null,
    };
  });
}

export async function createSolicitud(input: SolicitudInsert): Promise<SolicitudEPP> {
  const { data, error } = await supabase
    .from('solicitudes_epp')
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Crear solicitud', 'Solicitudes', data.id, 'INSERT', {
    numero_solicitud: data.numero_solicitud,
    trabajador_id: input.trabajador_id,
    epp_id: input.epp_id,
    cantidad: input.cantidad,
  });
  return data as SolicitudEPP;
}

export async function procesarSolicitud(
  solicitudId: string,
  accion: 'APROBAR' | 'RECHAZAR',
  motivoRechazo?: string
): Promise<{ success: boolean; estado: string; numero_solicitud: string }> {
  const { data, error } = await supabase.rpc('procesar_solicitud', {
    p_solicitud_id: solicitudId,
    p_accion: accion,
    p_motivo_rechazo: motivoRechazo ?? null,
  });
  if (error) throw new Error(getErrorMessage(error));
  return data as { success: boolean; estado: string; numero_solicitud: string };
}

export async function deleteSolicitud(id: string): Promise<void> {
  const { error } = await supabase
    .from('solicitudes_epp')
    .delete()
    .eq('id', id);
  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Eliminar solicitud', 'Solicitudes', id, 'DELETE');
}
