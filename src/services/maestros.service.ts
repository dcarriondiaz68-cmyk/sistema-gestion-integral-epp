import { supabase } from '@/lib/supabase';
import type {
  Empresa,
  EmpresaInsert,
  EmpresaUpdate,
  Sede,
  SedeInsert,
  SedeUpdate,
  Area,
  AreaInsert,
  AreaUpdate,
  Puesto,
  PuestoInsert,
  PuestoUpdate,
  Trabajador,
  TrabajadorInsert,
  TrabajadorUpdate,
  TrabajadorWithRelations,
} from '@/types/maestros.types';

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
      if (msg.includes('ruc')) return 'Ya existe una empresa con este RUC.';
      if (msg.includes('dni')) return 'Ya existe un trabajador con este DNI.';
      if (msg.includes('codigo_interno')) return 'Ya existe un trabajador con este código interno.';
      if (msg.includes('codigo')) return 'Ya existe un registro con este código.';
      return 'Ya existe un registro con estos datos.';
    }
    if (msg.includes('violates foreign key')) {
      return 'No se puede realizar esta acción porque el registro está relacionado con otros datos.';
    }
    return msg;
  }
  return 'Ocurrió un error inesperado.';
}

// ============================================================
// EMPRESAS
// ============================================================

export async function fetchEmpresas(): Promise<Empresa[]> {
  const { data, error } = await supabase
    .from('empresas')
    .select('*')
    .order('razon_social');
  if (error) throw new Error(getErrorMessage(error));
  return data as Empresa[];
}

export async function fetchEmpresaById(id: string): Promise<Empresa | null> {
  const { data, error } = await supabase
    .from('empresas')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(getErrorMessage(error));
  return data as Empresa | null;
}

export async function createEmpresa(input: EmpresaInsert): Promise<Empresa> {
  const { data, error } = await supabase
    .from('empresas')
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Crear empresa', 'Empresas', data.id, 'INSERT', { ruc: input.ruc });
  return data as Empresa;
}

export async function updateEmpresa(id: string, input: EmpresaUpdate): Promise<Empresa> {
  const { data, error } = await supabase
    .from('empresas')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Editar empresa', 'Empresas', id, 'UPDATE', input);
  return data as Empresa;
}

export async function toggleEmpresaActivo(id: string, activo: boolean): Promise<void> {
  const { error } = await supabase
    .from('empresas')
    .update({ activo })
    .eq('id', id);
  if (error) throw new Error(getErrorMessage(error));
  await logAudit(activo ? 'Activar empresa' : 'Desactivar empresa', 'Empresas', id, 'UPDATE', { activo });
}

export async function deleteEmpresa(id: string): Promise<void> {
  const { error } = await supabase
    .from('empresas')
    .delete()
    .eq('id', id);
  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Eliminar empresa', 'Empresas', id, 'DELETE');
}

// ============================================================
// SEDES
// ============================================================

export async function fetchSedes(empresaId?: string): Promise<Sede[]> {
  let query = supabase.from('sedes').select('*').order('nombre');
  if (empresaId) query = query.eq('empresa_id', empresaId);
  const { data, error } = await query;
  if (error) throw new Error(getErrorMessage(error));
  return data as Sede[];
}

export async function createSede(input: SedeInsert): Promise<Sede> {
  const { data, error } = await supabase
    .from('sedes')
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Crear sede', 'Sedes', data.id, 'INSERT', { codigo: input.codigo });
  return data as Sede;
}

export async function updateSede(id: string, input: SedeUpdate): Promise<Sede> {
  const { data, error } = await supabase
    .from('sedes')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Editar sede', 'Sedes', id, 'UPDATE', input);
  return data as Sede;
}

export async function toggleSedeActivo(id: string, activo: boolean): Promise<void> {
  const { error } = await supabase
    .from('sedes')
    .update({ activo })
    .eq('id', id);
  if (error) throw new Error(getErrorMessage(error));
  await logAudit(activo ? 'Activar sede' : 'Desactivar sede', 'Sedes', id, 'UPDATE', { activo });
}

export async function deleteSede(id: string): Promise<void> {
  const { error } = await supabase
    .from('sedes')
    .delete()
    .eq('id', id);
  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Eliminar sede', 'Sedes', id, 'DELETE');
}

// ============================================================
// AREAS
// ============================================================

export async function fetchAreas(sedeId?: string): Promise<Area[]> {
  let query = supabase.from('areas').select('*').order('nombre');
  if (sedeId) query = query.eq('sede_id', sedeId);
  const { data, error } = await query;
  if (error) throw new Error(getErrorMessage(error));
  return data as Area[];
}

export async function createArea(input: AreaInsert): Promise<Area> {
  const { data, error } = await supabase
    .from('areas')
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Crear área', 'Áreas', data.id, 'INSERT', { codigo: input.codigo });
  return data as Area;
}

export async function updateArea(id: string, input: AreaUpdate): Promise<Area> {
  const { data, error } = await supabase
    .from('areas')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Editar área', 'Áreas', id, 'UPDATE', input);
  return data as Area;
}

export async function toggleAreaActivo(id: string, activo: boolean): Promise<void> {
  const { error } = await supabase
    .from('areas')
    .update({ activo })
    .eq('id', id);
  if (error) throw new Error(getErrorMessage(error));
  await logAudit(activo ? 'Activar área' : 'Desactivar área', 'Áreas', id, 'UPDATE', { activo });
}

export async function deleteArea(id: string): Promise<void> {
  const { error } = await supabase
    .from('areas')
    .delete()
    .eq('id', id);
  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Eliminar área', 'Áreas', id, 'DELETE');
}

// ============================================================
// PUESTOS
// ============================================================

export async function fetchPuestos(areaId?: string): Promise<Puesto[]> {
  let query = supabase.from('puestos').select('*').order('nombre');
  if (areaId) query = query.eq('area_id', areaId);
  const { data, error } = await query;
  if (error) throw new Error(getErrorMessage(error));
  return data as Puesto[];
}

export async function createPuesto(input: PuestoInsert): Promise<Puesto> {
  const { data, error } = await supabase
    .from('puestos')
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Crear puesto', 'Puestos', data.id, 'INSERT', { codigo: input.codigo });
  return data as Puesto;
}

export async function updatePuesto(id: string, input: PuestoUpdate): Promise<Puesto> {
  const { data, error } = await supabase
    .from('puestos')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Editar puesto', 'Puestos', id, 'UPDATE', input);
  return data as Puesto;
}

export async function togglePuestoActivo(id: string, activo: boolean): Promise<void> {
  const { error } = await supabase
    .from('puestos')
    .update({ activo })
    .eq('id', id);
  if (error) throw new Error(getErrorMessage(error));
  await logAudit(activo ? 'Activar puesto' : 'Desactivar puesto', 'Puestos', id, 'UPDATE', { activo });
}

export async function deletePuesto(id: string): Promise<void> {
  const { error } = await supabase
    .from('puestos')
    .delete()
    .eq('id', id);
  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Eliminar puesto', 'Puestos', id, 'DELETE');
}

// ============================================================
// TRABAJADORES
// ============================================================

export async function fetchTrabajadores(filters?: {
  empresaId?: string;
  sedeId?: string;
  areaId?: string;
  puestoId?: string;
}): Promise<TrabajadorWithRelations[]> {
  let query = supabase
    .from('trabajadores')
    .select(`
      *,
      empresa:empresas!empresa_id(razon_social),
      sede:sedes!sede_id(nombre),
      area:areas!area_id(nombre),
      puesto:puestos!puesto_id(nombre)
    `)
    .order('apellidos')
    .order('nombres');

  if (filters?.empresaId) query = query.eq('empresa_id', filters.empresaId);
  if (filters?.sedeId) query = query.eq('sede_id', filters.sedeId);
  if (filters?.areaId) query = query.eq('area_id', filters.areaId);
  if (filters?.puestoId) query = query.eq('puesto_id', filters.puestoId);

  const { data, error } = await query;
  if (error) throw new Error(getErrorMessage(error));

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const empresa = r.empresa as Record<string, unknown> | null;
    const sede = r.sede as Record<string, unknown> | null;
    const area = r.area as Record<string, unknown> | null;
    const puesto = r.puesto as Record<string, unknown> | null;
    return {
      ...(r as unknown as Trabajador),
      empresa_razon_social: empresa?.razon_social as string ?? '—',
      sede_nombre: sede?.nombre as string ?? '—',
      area_nombre: area?.nombre as string ?? '—',
      puesto_nombre: puesto?.nombre as string ?? '—',
    };
  });
}

export async function createTrabajador(input: TrabajadorInsert): Promise<Trabajador> {
  const { data, error } = await supabase
    .from('trabajadores')
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Crear trabajador', 'Trabajadores', data.id, 'INSERT', { dni: input.dni });
  return data as Trabajador;
}

export async function updateTrabajador(id: string, input: TrabajadorUpdate): Promise<Trabajador> {
  const { data, error } = await supabase
    .from('trabajadores')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Editar trabajador', 'Trabajadores', id, 'UPDATE', input);
  return data as Trabajador;
}

export async function toggleTrabajadorActivo(id: string, activo: boolean): Promise<void> {
  const { error } = await supabase
    .from('trabajadores')
    .update({ activo })
    .eq('id', id);
  if (error) throw new Error(getErrorMessage(error));
  await logAudit(activo ? 'Activar trabajador' : 'Desactivar trabajador', 'Trabajadores', id, 'UPDATE', { activo });
}

export async function deleteTrabajador(id: string): Promise<void> {
  const { error } = await supabase
    .from('trabajadores')
    .delete()
    .eq('id', id);
  if (error) throw new Error(getErrorMessage(error));
  await logAudit('Eliminar trabajador', 'Trabajadores', id, 'DELETE');
}

export async function fetchMiTrabajador(): Promise<TrabajadorWithRelations | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('trabajadores')
    .select(`
      *,
      empresa:empresas!empresa_id(razon_social),
      sede:sedes!sede_id(nombre),
      area:areas!area_id(nombre),
      puesto:puestos!puesto_id(nombre)
    `)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw new Error(getErrorMessage(error));
  if (!data) return null;

  const r = data as Record<string, unknown>;
  const empresa = r.empresa as Record<string, unknown> | null;
  const sede = r.sede as Record<string, unknown> | null;
  const area = r.area as Record<string, unknown> | null;
  const puesto = r.puesto as Record<string, unknown> | null;
  return {
    ...(r as unknown as Trabajador),
    empresa_razon_social: empresa?.razon_social as string ?? '—',
    sede_nombre: sede?.nombre as string ?? '—',
    area_nombre: area?.nombre as string ?? '—',
    puesto_nombre: puesto?.nombre as string ?? '—',
  };
}

export async function checkDuplicateDni(dni: string, excludeId?: string): Promise<boolean> {
  let query = supabase.from('trabajadores').select('id').eq('dni', dni);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query.maybeSingle();
  if (error) return false;
  return data !== null;
}

export async function checkDuplicateCodigoInterno(codigo: string, excludeId?: string): Promise<boolean> {
  let query = supabase.from('trabajadores').select('id').eq('codigo_interno', codigo);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query.maybeSingle();
  if (error) return false;
  return data !== null;
}
