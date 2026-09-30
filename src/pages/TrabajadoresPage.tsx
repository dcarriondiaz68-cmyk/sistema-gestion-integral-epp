import { useState, useCallback, useEffect } from 'react';
import { Users } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { CrudPageShell, RowActionButtons, useDeleteConfirm } from '@/components/ui/CrudPageShell';
import { useAuthz } from '@/hooks/useAuthz';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import { formatDate } from '@/lib/format';
import {
  fetchTrabajadores,
  fetchEmpresas,
  fetchSedes,
  fetchAreas,
  fetchPuestos,
  createTrabajador,
  updateTrabajador,
  toggleTrabajadorActivo,
  deleteTrabajador,
  checkDuplicateDni,
  checkDuplicateCodigoInterno,
} from '@/services/maestros.service';
import { fetchWithCache } from '@/lib/data-cache';
import type {
  TrabajadorWithRelations,
  Empresa,
  Sede,
  Area,
  Puesto,
  TrabajadorInsert,
  EstadoLaboral,
} from '@/types/maestros.types';

const EMPTY_FORM: TrabajadorInsert = {
  empresa_id: '',
  sede_id: '',
  area_id: '',
  puesto_id: '',
  nombres: '',
  apellidos: '',
  dni: '',
  codigo_interno: '',
  fecha_ingreso: null,
  telefono: '',
  email: '',
  estado_laboral: 'ACTIVO',
  activo: true,
};

const ESTADO_LABELS: Record<EstadoLaboral, string> = {
  ACTIVO: 'Activo',
  INACTIVO: 'Inactivo',
  CESADO: 'Cesado',
};

const ESTADO_VARIANTS: Record<EstadoLaboral, 'success' | 'neutral' | 'warning'> = {
  ACTIVO: 'success',
  INACTIVO: 'neutral',
  CESADO: 'warning',
};

export function TrabajadoresPage() {
  const { hasPermission } = useAuthz();
  const canManage = hasPermission('trabajadores.manage');
  const { isOffline, enqueueOperation } = useSyncQueue();

  const [data, setData] = useState<TrabajadorWithRelations[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [allSedes, setAllSedes] = useState<Sede[]>([]);
  const [allAreas, setAllAreas] = useState<Area[]>([]);
  const [allPuestos, setAllPuestos] = useState<Puesto[]>([]);

  const [empresaFilter, setEmpresaFilter] = useState<string>('all');
  const [sedeFilter, setSedeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TrabajadorWithRelations | null>(null);
  const [form, setForm] = useState<TrabajadorInsert>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [trabs, emps, sedes, areas, puestos] = await Promise.all([
        fetchWithCache('trabajadores', () => fetchTrabajadores()),
        fetchWithCache('empresas', () => fetchEmpresas()),
        fetchWithCache('sedes', () => fetchSedes()),
        fetchWithCache('areas', () => fetchAreas()),
        fetchWithCache('puestos', () => fetchPuestos()),
      ]);
      setData(trabs);
      setEmpresas(emps);
      setAllSedes(sedes);
      setAllAreas(areas);
      setAllPuestos(puestos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar trabajadores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredSedes = form.empresa_id ? allSedes.filter((s) => s.empresa_id === form.empresa_id) : [];
  const filteredAreas = form.sede_id ? allAreas.filter((a) => a.sede_id === form.sede_id) : [];
  const filteredPuestos = form.area_id ? allPuestos.filter((p) => p.area_id === form.area_id) : [];

  const displaySedes = empresaFilter === 'all' ? allSedes : allSedes.filter((s) => s.empresa_id === empresaFilter);
  const filtered = sedeFilter === 'all' ? data : data.filter((t) => t.sede_id === sedeFilter);

  const { state: confirmState, requestDelete, requestToggle, close: closeConfirm, confirm: confirmAction } =
    useDeleteConfirm<TrabajadorWithRelations>(
      async (row) => {
        try {
          if (isOffline) {
            await enqueueOperation('crud_maestro', 'Trabajadores', { table: 'trabajadores', action: 'delete', record_id: row.id, payload: {} });
            setData((prev) => prev.filter((r) => r.id !== row.id));
            return;
          }
          await deleteTrabajador(row.id);
          setData((prev) => prev.filter((r) => r.id !== row.id));
        } catch (err) {
          setActionError(err instanceof Error ? err.message : 'Error al eliminar.');
        }
      },
      async (row) => {
        try {
          if (isOffline) {
            await enqueueOperation('crud_maestro', 'Trabajadores', { table: 'trabajadores', action: 'toggle', record_id: row.id, payload: { activo: !row.activo } });
            setData((prev) => prev.map((r) => (r.id === row.id ? { ...r, activo: !row.activo } : r)));
            return;
          }
          await toggleTrabajadorActivo(row.id, !row.activo);
          setData((prev) => prev.map((r) => (r.id === row.id ? { ...r, activo: !r.activo } : r)));
        } catch (err) {
          setActionError(err instanceof Error ? err.message : 'Error al cambiar estado.');
        }
      }
    );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, empresa_id: empresas[0]?.id ?? '' });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (row: TrabajadorWithRelations) => {
    setEditing(row);
    setForm({
      empresa_id: row.empresa_id,
      sede_id: row.sede_id,
      area_id: row.area_id,
      puesto_id: row.puesto_id,
      nombres: row.nombres,
      apellidos: row.apellidos,
      dni: row.dni,
      codigo_interno: row.codigo_interno,
      fecha_ingreso: row.fecha_ingreso ?? '',
      telefono: row.telefono ?? '',
      email: row.email ?? '',
      estado_laboral: row.estado_laboral,
      activo: row.activo,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.empresa_id || !form.sede_id || !form.area_id || !form.puesto_id) {
      setFormError('Debe seleccionar empresa, sede, área y puesto.');
      return;
    }
    if (!form.nombres.trim() || !form.apellidos.trim()) {
      setFormError('Nombres y apellidos son obligatorios.');
      return;
    }
    if (!form.dni.trim() || form.dni.trim().length !== 8) {
      setFormError('El DNI debe tener 8 dígitos.');
      return;
    }
    if (!form.codigo_interno.trim()) {
      setFormError('El código interno es obligatorio.');
      return;
    }

    const editId = editing?.id;

    if (!isOffline) {
      const [dniDup, codigoDup] = await Promise.all([
        checkDuplicateDni(form.dni.trim(), editId),
        checkDuplicateCodigoInterno(form.codigo_interno.trim(), editId),
      ]);

      if (dniDup) {
        setFormError('Ya existe un trabajador con este DNI.');
        return;
      }
      if (codigoDup) {
        setFormError('Ya existe un trabajador con este código interno.');
        return;
      }
    }

    setSaving(true);
    setFormError(null);
    try {
      if (isOffline) {
        if (editing) {
          await enqueueOperation('crud_maestro', 'Trabajadores', { table: 'trabajadores', action: 'update', record_id: editing.id, payload: form as unknown as Record<string, unknown> });
          setData((prev) =>
            prev.map((r) => (r.id === editing.id ? { ...r, ...form, empresa_razon_social: r.empresa_razon_social, sede_nombre: r.sede_nombre, area_nombre: r.area_nombre, puesto_nombre: r.puesto_nombre } : r))
          );
        } else {
          await enqueueOperation('crud_maestro', 'Trabajadores', { table: 'trabajadores', action: 'create', payload: form as unknown as Record<string, unknown> });
          const tempId = `offline-${Date.now()}`;
          const empName = empresas.find((e) => e.id === form.empresa_id)?.razon_social ?? '—';
          const sedeName = allSedes.find((s) => s.id === form.sede_id)?.nombre ?? '—';
          const areaName = allAreas.find((a) => a.id === form.area_id)?.nombre ?? '—';
          const puestoName = allPuestos.find((p) => p.id === form.puesto_id)?.nombre ?? '—';
          setData((prev) => [...prev, { ...form, id: tempId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), empresa_razon_social: empName, sede_nombre: sedeName, area_nombre: areaName, puesto_nombre: puestoName } as unknown as TrabajadorWithRelations]);
        }
        setModalOpen(false);
        return;
      }
      if (editing) {
        const updated = await updateTrabajador(editing.id, form);
        setData((prev) =>
          prev.map((r) => (r.id === editing.id ? { ...r, ...updated, empresa_razon_social: r.empresa_razon_social, sede_nombre: r.sede_nombre, area_nombre: r.area_nombre, puesto_nombre: r.puesto_nombre } : r))
        );
      } else {
        await createTrabajador(form);
        await load();
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<TrabajadorWithRelations>[] = [
    {
      key: 'codigo_interno',
      label: 'Código',
      sortable: true,
      sortValue: (r) => r.codigo_interno,
      render: (r) => <span className="font-medium text-neutral-900">{r.codigo_interno}</span>,
    },
    {
      key: 'apellidos',
      label: 'Nombre completo',
      sortable: true,
      sortValue: (r) => `${r.apellidos} ${r.nombres}`,
      render: (r) => (
        <div>
          <p className="font-medium text-neutral-900">{r.apellidos}, {r.nombres}</p>
          <p className="text-xs text-neutral-400">DNI: {r.dni}</p>
        </div>
      ),
    },
    {
      key: 'puesto_nombre',
      label: 'Puesto / Área',
      sortable: true,
      sortValue: (r) => r.puesto_nombre,
      render: (r) => (
        <div>
          <p className="text-neutral-700">{r.puesto_nombre}</p>
          <p className="text-xs text-neutral-400">{r.area_nombre}</p>
        </div>
      ),
    },
    {
      key: 'sede_nombre',
      label: 'Sede',
      sortable: true,
      sortValue: (r) => r.sede_nombre,
      render: (r) => r.sede_nombre,
    },
    {
      key: 'fecha_ingreso',
      label: 'F. Ingreso',
      sortable: true,
      sortValue: (r) => r.fecha_ingreso ?? '',
      render: (r) => formatDate(r.fecha_ingreso),
    },
    {
      key: 'estado_laboral',
      label: 'Estado laboral',
      render: (r) => (
        <Badge variant={ESTADO_VARIANTS[r.estado_laboral]}>{ESTADO_LABELS[r.estado_laboral]}</Badge>
      ),
    },
    {
      key: 'activo',
      label: 'Registro',
      sortable: true,
      sortValue: (r) => (r.activo ? 1 : 0),
      render: (r) => <Badge variant={r.activo ? 'success' : 'neutral'}>{r.activo ? 'Vigente' : 'Inactivo'}</Badge>,
    },
  ];

  return (
    <CrudPageShell
      title="Trabajadores"
      description="Gestión de trabajadores del sistema"
      icon={<Users className="h-5 w-5" />}
      data={filtered}
      loading={loading}
      error={error}
      onRetry={load}
      onAdd={openCreate}
      onEdit={openEdit}
      onDelete={requestDelete}
      onToggleActivo={requestToggle}
      addLabel="Nuevo Trabajador"
      canManage={canManage}
      renderTable={() => (
        <Card padding="sm">
          <DataTable
            columns={columns}
            data={filtered}
            searchKeys={['nombres', 'apellidos', 'dni', 'codigo_interno']}
            pageSize={15}
            rowKey={(r) => r.id}
            actions={(row) => (
              <RowActionButtons
                row={row}
                onEdit={openEdit}
                onDelete={requestDelete}
                onToggleActivo={requestToggle}
                activo={row.activo}
                canManage={canManage}
              />
            )}
          />
        </Card>
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:max-w-xs">
          <Select
            label="Filtrar por empresa"
            value={empresaFilter}
            onChange={(e) => {
              setEmpresaFilter(e.target.value);
              setSedeFilter('all');
            }}
          >
            <option value="all">Todas las empresas</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>{e.razon_social}</option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:max-w-xs">
          <Select
            label="Filtrar por sede"
            value={sedeFilter}
            onChange={(e) => setSedeFilter(e.target.value)}
          >
            <option value="all">Todas las sedes</option>
            {displaySedes.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </Select>
        </div>
      </div>

      {actionError && (
        <Alert variant="error" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Trabajador' : 'Nuevo Trabajador'}
        description="Información personal y laboral"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>Guardar</Button>
          </>
        }
      >
        {formError && (
          <div className="mb-4">
            <Alert variant="error">{formError}</Alert>
          </div>
        )}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Empresa *"
              value={form.empresa_id}
              onChange={(e) => setForm({ ...form, empresa_id: e.target.value, sede_id: '', area_id: '', puesto_id: '' })}
            >
              <option value="">Seleccionar...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.razon_social}</option>
              ))}
            </Select>
            <Select
              label="Sede *"
              value={form.sede_id}
              onChange={(e) => setForm({ ...form, sede_id: e.target.value, area_id: '', puesto_id: '' })}
              disabled={!form.empresa_id}
            >
              <option value="">Seleccionar...</option>
              {filteredSedes.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </Select>
            <Select
              label="Área *"
              value={form.area_id}
              onChange={(e) => setForm({ ...form, area_id: e.target.value, puesto_id: '' })}
              disabled={!form.sede_id}
            >
              <option value="">Seleccionar...</option>
              {filteredAreas.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </Select>
            <Select
              label="Puesto *"
              value={form.puesto_id}
              onChange={(e) => setForm({ ...form, puesto_id: e.target.value })}
              disabled={!form.area_id}
            >
              <option value="">Seleccionar...</option>
              {filteredPuestos.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Nombres *"
              value={form.nombres}
              onChange={(e) => setForm({ ...form, nombres: e.target.value })}
              placeholder="Juan Carlos"
            />
            <Input
              label="Apellidos *"
              value={form.apellidos}
              onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
              placeholder="Pérez García"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="DNI *"
              value={form.dni}
              onChange={(e) => setForm({ ...form, dni: e.target.value.replace(/\D/g, '').slice(0, 8) })}
              placeholder="12345678"
              maxLength={8}
              hint="8 dígitos, sin puntos"
            />
            <Input
              label="Código Interno *"
              value={form.codigo_interno}
              onChange={(e) => setForm({ ...form, codigo_interno: e.target.value })}
              placeholder="EMP-001"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Fecha de Ingreso"
              type="date"
              value={form.fecha_ingreso ?? ''}
              onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value || null })}
            />
            <Select
              label="Estado Laboral"
              value={form.estado_laboral}
              onChange={(e) => setForm({ ...form, estado_laboral: e.target.value as EstadoLaboral })}
            >
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
              <option value="CESADO">Cesado</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Teléfono"
              value={form.telefono ?? ''}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              placeholder="999 999 999"
            />
            <Input
              label="Correo electrónico"
              type="email"
              value={form.email ?? ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="trabajador@empresa.com"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmState.row !== null}
        onClose={closeConfirm}
        onConfirm={confirmAction}
        title={confirmState.type === 'delete' ? 'Eliminar trabajador' : 'Cambiar estado'}
        message={
          confirmState.type === 'delete'
            ? '¿Seguro que deseas eliminar este trabajador? Se perderá su historial. Considera desactivarlo en su lugar.'
            : confirmState.row
              ? `¿Deseas ${confirmState.row.activo ? 'desactivar' : 'activar'} este trabajador? Su historial se conservará.`
              : ''
        }
        confirmLabel={confirmState.type === 'delete' ? 'Eliminar' : 'Confirmar'}
        variant={confirmState.type === 'delete' ? 'danger' : 'primary'}
      />
    </CrudPageShell>
  );
}
