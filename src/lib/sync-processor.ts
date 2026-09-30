import { supabase } from '@/lib/supabase';
import { createSolicitud } from '@/services/solicitudes.service';
import { generarEntregaDirecta, registrarFirma } from '@/services/entregas.service';
import { updateUser } from '@/services/users.service';
import {
  createEmpresa, updateEmpresa, toggleEmpresaActivo, deleteEmpresa,
  createSede, updateSede, toggleSedeActivo, deleteSede,
  createArea, updateArea, toggleAreaActivo, deleteArea,
  createPuesto, updatePuesto, togglePuestoActivo, deletePuesto,
  createTrabajador, updateTrabajador, toggleTrabajadorActivo, deleteTrabajador,
} from '@/services/maestros.service';
import {
  createCatalogoEPP, updateCatalogoEPP, toggleCatalogoEPPActivo, deleteCatalogoEPP,
} from '@/services/catalogo.service';
import {
  createInventario, updateStockMinimo, registrarMovimiento,
} from '@/services/inventario.service';
import { updateStatus } from '@/lib/offline-queue';
import type { SyncOperation } from '@/types/sync.types';
import type { SolicitudInsert } from '@/types/solicitudes.types';
import type { EntregaInsert } from '@/types/entregas.types';
import type { TipoFirma } from '@/types/firma.types';
import type { EmpresaInsert, SedeInsert, AreaInsert, PuestoInsert, TrabajadorInsert } from '@/types/maestros.types';
import type { CatalogoEPPInsert } from '@/types/catalogo.types';
import type { TipoMovimiento } from '@/types/inventario.types';

function isConflictError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('no está aprobada') ||
    lower.includes('no está en preparación') ||
    lower.includes('no se puede cancelar') ||
    lower.includes('no está pendiente de firma') ||
    lower.includes('ya existe') ||
    lower.includes('duplicate') ||
    lower.includes('conflict')
  );
}

function oneHourAgoISO(): string {
  return new Date(Date.now() - 60 * 60 * 1000).toISOString();
}

async function existsSolicitud(data: SolicitudInsert): Promise<boolean> {
  let q = supabase
    .from('solicitudes_epp')
    .select('id', { count: 'exact', head: true })
    .eq('trabajador_id', data.trabajador_id)
    .eq('epp_id', data.epp_id)
    .eq('sede_id', data.sede_id)
    .eq('cantidad', data.cantidad)
    .gte('created_at', oneHourAgoISO());
  if (data.talla) {
    q = q.eq('talla', data.talla);
  } else {
    q = q.is('talla', null);
  }
  const { count } = await q;
  return (count ?? 0) > 0;
}

async function existsEntrega(data: EntregaInsert): Promise<boolean> {
  let q = supabase
    .from('entregas')
    .select('id', { count: 'exact', head: true })
    .eq('trabajador_id', data.trabajador_id)
    .eq('epp_id', data.epp_id)
    .eq('sede_id', data.sede_id)
    .eq('cantidad_entregada', data.cantidad_entregada)
    .gte('created_at', oneHourAgoISO());
  if (data.talla) {
    q = q.eq('talla', data.talla);
  } else {
    q = q.is('talla', null);
  }
  const { count } = await q;
  return (count ?? 0) > 0;
}

async function existsFirma(entregaId: string, tipoFirma: TipoFirma): Promise<boolean> {
  const { count } = await supabase
    .from('entrega_firmas')
    .select('id', { count: 'exact', head: true })
    .eq('entrega_id', entregaId)
    .eq('tipo_firma', tipoFirma);
  return (count ?? 0) > 0;
}

export async function processOperation(op: SyncOperation): Promise<void> {
  await updateStatus(op.id, 'sincronizando');

  try {
    if (op.type === 'crear_solicitud') {
      const data = op.data as unknown as SolicitudInsert;
      if (await existsSolicitud(data)) {
        await updateStatus(op.id, 'sincronizado', 'Solicitud ya existente (idempotente)');
        return;
      }
      await createSolicitud(data);
    } else if (op.type === 'registrar_entrega') {
      const data = op.data as unknown as EntregaInsert;
      if (await existsEntrega(data)) {
        await updateStatus(op.id, 'sincronizado', 'Entrega ya existente (idempotente)');
        return;
      }
      await generarEntregaDirecta(data);
    } else if (op.type === 'capturar_firma') {
      const d = op.data;
      const entregaId = d.entrega_id as string;
      const tipoFirma = d.tipo_firma as TipoFirma;
      if (await existsFirma(entregaId, tipoFirma)) {
        await updateStatus(op.id, 'sincronizado', 'Firma ya existente (idempotente)');
        return;
      }
      await registrarFirma(
        entregaId,
        tipoFirma,
        d.firma_data as string,
        d.nombre_firmante as string
      );
    } else if (op.type === 'crud_maestro') {
      const d = op.data;
      const table = d.table as string;
      const action = d.action as string;
      const recordId = d.record_id as string | undefined;
      const payload = (d.payload ?? {}) as Record<string, unknown>;

      const exists = async (check: { table: string; column: string; value: string }): Promise<boolean> => {
        const { count } = await supabase
          .from(check.table)
          .select('id', { count: 'exact', head: true })
          .eq(check.column, check.value);
        return (count ?? 0) > 0;
      };

      if (action === 'create' && table === 'empresas') {
        if (await exists({ table: 'empresas', column: 'ruc', value: payload.ruc as string })) {
          await updateStatus(op.id, 'sincronizado', 'Empresa ya existente (idempotente)');
          return;
        }
        await createEmpresa(payload as unknown as EmpresaInsert);
      } else if (action === 'update' && table === 'empresas') {
        await updateEmpresa(recordId!, payload as unknown as Partial<EmpresaInsert>);
      } else if (action === 'toggle' && table === 'empresas') {
        await toggleEmpresaActivo(recordId!, payload.activo as boolean);
      } else if (action === 'delete' && table === 'empresas') {
        await deleteEmpresa(recordId!);

      } else if (action === 'create' && table === 'sedes') {
        await createSede(payload as unknown as SedeInsert);
      } else if (action === 'update' && table === 'sedes') {
        await updateSede(recordId!, payload as unknown as Partial<SedeInsert>);
      } else if (action === 'toggle' && table === 'sedes') {
        await toggleSedeActivo(recordId!, payload.activo as boolean);
      } else if (action === 'delete' && table === 'sedes') {
        await deleteSede(recordId!);

      } else if (action === 'create' && table === 'areas') {
        await createArea(payload as unknown as AreaInsert);
      } else if (action === 'update' && table === 'areas') {
        await updateArea(recordId!, payload as unknown as Partial<AreaInsert>);
      } else if (action === 'toggle' && table === 'areas') {
        await toggleAreaActivo(recordId!, payload.activo as boolean);
      } else if (action === 'delete' && table === 'areas') {
        await deleteArea(recordId!);

      } else if (action === 'create' && table === 'puestos') {
        await createPuesto(payload as unknown as PuestoInsert);
      } else if (action === 'update' && table === 'puestos') {
        await updatePuesto(recordId!, payload as unknown as Partial<PuestoInsert>);
      } else if (action === 'toggle' && table === 'puestos') {
        await togglePuestoActivo(recordId!, payload.activo as boolean);
      } else if (action === 'delete' && table === 'puestos') {
        await deletePuesto(recordId!);

      } else if (action === 'create' && table === 'trabajadores') {
        if (await exists({ table: 'trabajadores', column: 'dni', value: payload.dni as string })) {
          await updateStatus(op.id, 'sincronizado', 'Trabajador ya existente (idempotente)');
          return;
        }
        await createTrabajador(payload as unknown as TrabajadorInsert);
      } else if (action === 'update' && table === 'trabajadores') {
        await updateTrabajador(recordId!, payload as unknown as Partial<TrabajadorInsert>);
      } else if (action === 'toggle' && table === 'trabajadores') {
        await toggleTrabajadorActivo(recordId!, payload.activo as boolean);
      } else if (action === 'delete' && table === 'trabajadores') {
        await deleteTrabajador(recordId!);

      } else if (action === 'create' && table === 'catalogo_epp') {
        if (await exists({ table: 'catalogo_epp', column: 'codigo', value: payload.codigo as string })) {
          await updateStatus(op.id, 'sincronizado', 'EPP ya existente (idempotente)');
          return;
        }
        await createCatalogoEPP(payload as unknown as CatalogoEPPInsert);
      } else if (action === 'update' && table === 'catalogo_epp') {
        await updateCatalogoEPP(recordId!, payload as unknown as Partial<CatalogoEPPInsert>);
      } else if (action === 'toggle' && table === 'catalogo_epp') {
        await toggleCatalogoEPPActivo(recordId!, payload.activo as boolean);
      } else if (action === 'delete' && table === 'catalogo_epp') {
        await deleteCatalogoEPP(recordId!);

      } else if (action === 'create' && table === 'inventario') {
        await createInventario(payload.epp_id as string, payload.sede_id as string, payload.stock_minimo as number | null);
      } else if (action === 'update' && table === 'inventario') {
        await updateStockMinimo(recordId!, payload.stock_minimo as number | null);

      } else {
        await updateStatus(op.id, 'error', `Operación no reconocida: ${table}.${action}`);
        return;
      }
    } else if (op.type === 'registrar_movimiento') {
      const d = op.data;
      const { count } = await supabase
        .from('kardex')
        .select('id', { count: 'exact', head: true })
        .eq('inventario_id', d.inventario_id as string)
        .eq('tipo_movimiento', d.tipo_movimiento as string)
        .eq('cantidad', d.cantidad as number)
        .gte('created_at', oneHourAgoISO());
      if ((count ?? 0) > 0) {
        await updateStatus(op.id, 'sincronizado', 'Movimiento ya existente (idempotente)');
        return;
      }
      await registrarMovimiento({
        eppId: d.epp_id as string,
        sedeId: d.sede_id as string,
        tipoMovimiento: d.tipo_movimiento as TipoMovimiento,
        cantidad: d.cantidad as number,
        motivo: (d.motivo as string | null) ?? null,
        referencia: (d.referencia as string | null) ?? null,
      });
    } else if (op.type === 'admin_update_profile') {
      const d = op.data;
      await updateUser(
        d.target_uid as string,
        {
          full_name: (d.full_name as string | null) ?? null,
          phone: (d.phone as string | null) ?? null,
          role: (d.role as string | null) ?? null,
        },
        (d.email as string | null) ?? ''
      );
    } else {
      await updateStatus(op.id, 'error', 'Tipo de operación no reconocido');
      return;
    }
    await updateStatus(op.id, 'sincronizado');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    if (isConflictError(message)) {
      await updateStatus(op.id, 'conflicto', message);
    } else {
      await updateStatus(op.id, 'error', message);
    }
  }
}

export async function processQueue(operations: SyncOperation[]): Promise<void> {
  for (const op of operations) {
    await processOperation(op);
  }
}
