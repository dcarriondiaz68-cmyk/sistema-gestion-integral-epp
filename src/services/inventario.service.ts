import { supabase } from '@/lib/supabase';
import type {
  Inventario,
  InventarioWithRelations,
  KardexMovimiento,
  KardexWithRelations,
  TipoMovimiento,
} from '@/types/inventario.types';

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message: string }).message;
    if (msg.includes('Stock insuficiente')) {
      return 'No hay suficiente stock para registrar esta salida.';
    }
    if (msg.includes('No tiene permisos')) {
      return 'No tiene permisos para realizar esta acción.';
    }
    return msg;
  }
  return 'Ocurrió un error inesperado.';
}

export async function fetchInventario(filters?: {
  sedeId?: string;
  eppId?: string;
}): Promise<InventarioWithRelations[]> {
  let query = supabase
    .from('inventario')
    .select(`
      *,
      epp:catalogo_epp!epp_id(codigo, nombre, unidad_medida),
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
    return {
      ...(r as unknown as Inventario),
      epp_codigo: (epp?.codigo as string) ?? '—',
      epp_nombre: (epp?.nombre as string) ?? '—',
      epp_unidad_medida: (epp?.unidad_medida as string) ?? '—',
      sede_nombre: (sede?.nombre as string) ?? '—',
    };
  });
}

export async function updateStockMinimo(id: string, stockMinimo: number | null): Promise<void> {
  const { error } = await supabase
    .from('inventario')
    .update({ stock_minimo: stockMinimo })
    .eq('id', id);
  if (error) throw new Error(getErrorMessage(error));
}

export async function fetchKardex(filters?: {
  sedeId?: string;
  eppId?: string;
  tipoMovimiento?: TipoMovimiento;
}): Promise<KardexWithRelations[]> {
  let query = supabase
    .from('kardex')
    .select(`
      *,
      inventario:inventario!inventario_id(
        epp:catalogo_epp!epp_id(codigo, nombre),
        sede:sedes!sede_id(nombre)
      )
    `)
    .order('created_at', { ascending: false });

  if (filters?.tipoMovimiento) query = query.eq('tipo_movimiento', filters.tipoMovimiento);

  const { data, error } = await query;
  if (error) throw new Error(getErrorMessage(error));

  const rows = (data ?? []) as unknown as KardexMovimiento[];

  const userIds = Array.from(new Set(
    rows.map((r) => r.usuario_id).filter((id): id is string => id !== null)
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

  return rows.map((row) => {
    const r = row as unknown as Record<string, unknown>;
    const inv = r.inventario as Record<string, unknown> | null;
    const epp = inv?.epp as Record<string, unknown> | null;
    const sede = inv?.sede as Record<string, unknown> | null;

    let eppCodigo = '—';
    let eppNombre = '—';
    let sedeNombre = '—';
    if (inv) {
      eppCodigo = (epp?.codigo as string) ?? '—';
      eppNombre = (epp?.nombre as string) ?? '—';
      sedeNombre = (sede?.nombre as string) ?? '—';
    }

    if (filters?.sedeId) {
      const invRow = inv as Record<string, unknown> | null;
      const sedeId = invRow?.sede_id as string | undefined;
      if (sedeId !== filters.sedeId) return null;
    }
    if (filters?.eppId) {
      const invRow = inv as Record<string, unknown> | null;
      const eppId = invRow?.epp_id as string | undefined;
      if (eppId !== filters.eppId) return null;
    }

    return {
      ...(r as unknown as KardexMovimiento),
      epp_codigo: eppCodigo,
      epp_nombre: eppNombre,
      sede_nombre: sedeNombre,
      usuario_nombre: row.usuario_id ? (nameMap.get(row.usuario_id) ?? '—') : '—',
    };
  }).filter((row): row is KardexWithRelations => row !== null);
}

export async function createInventario(
  eppId: string,
  sedeId: string,
  stockMinimo?: number | null
): Promise<Inventario> {
  const { data, error } = await supabase
    .from('inventario')
    .insert({
      epp_id: eppId,
      sede_id: sedeId,
      stock_actual: 0,
      stock_minimo: stockMinimo ?? null,
    })
    .select('*')
    .single();
  if (error) throw new Error(getErrorMessage(error));
  return data as Inventario;
}

export async function registrarMovimiento(params: {
  eppId: string;
  sedeId: string;
  tipoMovimiento: TipoMovimiento;
  cantidad: number;
  motivo?: string | null;
  referencia?: string | null;
}): Promise<{ success: boolean; inventario_id: string; nuevo_saldo: number }> {
  const { data, error } = await supabase.rpc('registrar_movimiento', {
    p_epp_id: params.eppId,
    p_sede_id: params.sedeId,
    p_tipo_movimiento: params.tipoMovimiento,
    p_cantidad: params.cantidad,
    p_motivo: params.motivo ?? null,
    p_referencia: params.referencia ?? null,
  });
  if (error) throw new Error(getErrorMessage(error));
  return data as { success: boolean; inventario_id: string; nuevo_saldo: number };
}
