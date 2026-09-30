import { supabase } from '@/lib/supabase';
import type {
  CatalogoEPP,
  CatalogoEPPInsert,
  CatalogoEPPUpdate,
} from '@/types/catalogo.types';

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
    if (msg.includes('duplicate key')) {
      if (msg.includes('codigo')) return 'Ya existe un EPP con este código.';
      return 'Ya existe un registro con estos datos.';
    }
    if (msg.includes('violates foreign key')) {
      return 'No se puede realizar esta acción porque el registro está relacionado con otros datos.';
    }
    return msg;
  }
  return 'Ocurrió un error inesperado.';
}

export async function fetchCatalogoEPP(): Promise<CatalogoEPP[]> {
  const { data, error } = await supabase
    .from('catalogo_epp')
    .select('*')
    .order('nombre');
  if (error) throw new Error(getErrorMessage(error));
  return data as CatalogoEPP[];
}

export async function fetchCatalogoEPPById(id: string): Promise<CatalogoEPP | null> {
  const { data, error } = await supabase
    .from('catalogo_epp')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(getErrorMessage(error));
  return data as CatalogoEPP | null;
}

export async function createCatalogoEPP(input: CatalogoEPPInsert): Promise<CatalogoEPP> {
  const { data, error } = await supabase
    .from('catalogo_epp')
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Crear EPP', 'Catálogo EPP', data.id, 'INSERT', { codigo: input.codigo });
  return data as CatalogoEPP;
}

export async function updateCatalogoEPP(id: string, input: CatalogoEPPUpdate): Promise<CatalogoEPP> {
  const { data, error } = await supabase
    .from('catalogo_epp')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Editar EPP', 'Catálogo EPP', id, 'UPDATE', input);
  return data as CatalogoEPP;
}

export async function toggleCatalogoEPPActivo(id: string, activo: boolean): Promise<void> {
  const { error } = await supabase
    .from('catalogo_epp')
    .update({ activo })
    .eq('id', id);
  if (error) throw new Error(getErrorMessage(error));
  await logAudit(activo ? 'Activar EPP' : 'Desactivar EPP', 'Catálogo EPP', id, 'UPDATE', { activo });
}

export async function deleteCatalogoEPP(id: string): Promise<void> {
  const { error } = await supabase
    .from('catalogo_epp')
    .delete()
    .eq('id', id);
  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Eliminar EPP', 'Catálogo EPP', id, 'DELETE');
}

export async function checkDuplicateCodigo(codigo: string, excludeId?: string): Promise<boolean> {
  let query = supabase.from('catalogo_epp').select('id').eq('codigo', codigo);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query.maybeSingle();
  if (error) return false;
  return data !== null;
}
