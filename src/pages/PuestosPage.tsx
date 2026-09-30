import { useState, useCallback, useEffect } from 'react';
import { Briefcase } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { CrudPageShell, RowActionButtons, useDeleteConfirm } from '@/components/ui/CrudPageShell';
import { useAuthz } from '@/hooks/useAuthz';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import {
  fetchPuestos,
  fetchAreas,
  fetchSedes,
  createPuesto,
  updatePuesto,
  togglePuestoActivo,
  deletePuesto,
} from '@/services/maestros.service';
import { fetchWithCache } from '@/lib/data-cache';
import type { Puesto, Area, Sede, PuestoInsert } from '@/types/maestros.types';

const EMPTY_FORM: PuestoInsert = {
  area_id: '',
  nombre: '',
  codigo: '',
  descripcion: '',
  activo: true,
};

export function PuestosPage() {
  const { hasPermission } = useAuthz();
  const canManage = hasPermission('puestos.manage');
  const { isOffline, enqueueOperation } = useSyncQueue();

  const [data, setData] = useState<Puesto[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [sedeFilter, setSedeFilter] = useState<string>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Puesto | null>(null);
  const [form, setForm] = useState<PuestoInsert>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [puestos, allAreas, allSedes] = await Promise.all([
        fetchWithCache('puestos', () => fetchPuestos()),
        fetchWithCache('areas', () => fetchAreas()),
        fetchWithCache('sedes', () => fetchSedes()),
      ]);
      setData(puestos);
      setAreas(allAreas);
      setSedes(allSedes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar puestos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredAreas = sedeFilter === 'all' ? areas : areas.filter((a) => a.sede_id === sedeFilter);
  const filtered = areaFilter === 'all' ? data : data.filter((p) => p.area_id === areaFilter);

  const areaNombre = (id: string) => areas.find((a) => a.id === id)?.nombre ?? '—';
  const sedeOfArea = (areaId: string) => {
    const area = areas.find((a) => a.id === areaId);
    if (!area) return '—';
    return sedes.find((s) => s.id === area.sede_id)?.nombre ?? '—';
  };

  const { state: confirmState, requestDelete, requestToggle, close: closeConfirm, confirm: confirmAction } =
    useDeleteConfirm<Puesto>(
      async (row) => {
        try {
          if (isOffline) {
            await enqueueOperation('crud_maestro', 'Puestos', { table: 'puestos', action: 'delete', record_id: row.id, payload: {} });
            setData((prev) => prev.filter((r) => r.id !== row.id));
            return;
          }
          await deletePuesto(row.id);
          setData((prev) => prev.filter((r) => r.id !== row.id));
        } catch (err) {
          setActionError(err instanceof Error ? err.message : 'Error al eliminar.');
        }
      },
      async (row) => {
        try {
          if (isOffline) {
            await enqueueOperation('crud_maestro', 'Puestos', { table: 'puestos', action: 'toggle', record_id: row.id, payload: { activo: !row.activo } });
            setData((prev) => prev.map((r) => (r.id === row.id ? { ...r, activo: !row.activo } : r)));
            return;
          }
          await togglePuestoActivo(row.id, !row.activo);
          setData((prev) => prev.map((r) => (r.id === row.id ? { ...r, activo: !r.activo } : r)));
        } catch (err) {
          setActionError(err instanceof Error ? err.message : 'Error al cambiar estado.');
        }
      }
    );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, area_id: filteredAreas[0]?.id ?? '' });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (row: Puesto) => {
    setEditing(row);
    setForm({
      area_id: row.area_id,
      nombre: row.nombre,
      codigo: row.codigo,
      descripcion: row.descripcion ?? '',
      activo: row.activo,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.area_id || !form.nombre.trim() || !form.codigo.trim()) {
      setFormError('Área, nombre y código son obligatorios.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (isOffline) {
        if (editing) {
          await enqueueOperation('crud_maestro', 'Puestos', { table: 'puestos', action: 'update', record_id: editing.id, payload: form as unknown as Record<string, unknown> });
          setData((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...form } as Puesto : r)));
        } else {
          await enqueueOperation('crud_maestro', 'Puestos', { table: 'puestos', action: 'create', payload: form as unknown as Record<string, unknown> });
          const tempId = `offline-${Date.now()}`;
          setData((prev) => [...prev, { ...form, id: tempId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as unknown as Puesto]);
        }
        setModalOpen(false);
        return;
      }
      if (editing) {
        const updated = await updatePuesto(editing.id, form);
        setData((prev) => prev.map((r) => (r.id === editing.id ? updated : r)));
      } else {
        const created = await createPuesto(form);
        setData((prev) => [...prev, created]);
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Puesto>[] = [
    {
      key: 'codigo',
      label: 'Código',
      sortable: true,
      sortValue: (r) => r.codigo,
      render: (r) => <span className="font-medium text-neutral-900">{r.codigo}</span>,
    },
    {
      key: 'nombre',
      label: 'Nombre',
      sortable: true,
      sortValue: (r) => r.nombre,
      render: (r) => <span className="font-medium text-neutral-900">{r.nombre}</span>,
    },
    {
      key: 'area_id',
      label: 'Área / Sede',
      sortable: true,
      sortValue: (r) => areaNombre(r.area_id),
      render: (r) => (
        <div>
          <p className="text-neutral-700">{areaNombre(r.area_id)}</p>
          <p className="text-xs text-neutral-400">{sedeOfArea(r.area_id)}</p>
        </div>
      ),
    },
    {
      key: 'activo',
      label: 'Estado',
      sortable: true,
      sortValue: (r) => (r.activo ? 1 : 0),
      render: (r) => <Badge variant={r.activo ? 'success' : 'neutral'}>{r.activo ? 'Activo' : 'Inactivo'}</Badge>,
    },
  ];

  return (
    <CrudPageShell
      title="Puestos"
      description="Puestos de trabajo asociados a áreas"
      icon={<Briefcase className="h-5 w-5" />}
      data={filtered}
      loading={loading}
      error={error}
      onRetry={load}
      onAdd={openCreate}
      onEdit={openEdit}
      onDelete={requestDelete}
      onToggleActivo={requestToggle}
      addLabel="Nuevo Puesto"
      canManage={canManage}
      renderTable={() => (
        <Card padding="sm">
          <DataTable
            columns={columns}
            data={filtered}
            searchKeys={['codigo', 'nombre', 'descripcion']}
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
            label="Filtrar por sede"
            value={sedeFilter}
            onChange={(e) => {
              setSedeFilter(e.target.value);
              setAreaFilter('all');
            }}
          >
            <option value="all">Todas las sedes</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:max-w-xs">
          <Select
            label="Filtrar por área"
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
          >
            <option value="all">Todas las áreas</option>
            {filteredAreas.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
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
        title={editing ? 'Editar Puesto' : 'Nuevo Puesto'}
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
          <Select
            label="Área *"
            value={form.area_id}
            onChange={(e) => setForm({ ...form, area_id: e.target.value })}
          >
            <option value="">Seleccionar área...</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </Select>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Código *"
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              placeholder="PUE-001"
            />
            <Input
              label="Nombre *"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Operario"
            />
          </div>
          <Textarea
            label="Descripción"
            value={form.descripcion ?? ''}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Descripción del puesto"
            rows={2}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmState.row !== null}
        onClose={closeConfirm}
        onConfirm={confirmAction}
        title={confirmState.type === 'delete' ? 'Eliminar puesto' : 'Cambiar estado'}
        message={
          confirmState.type === 'delete'
            ? '¿Seguro que deseas eliminar este puesto? Esta acción no se puede deshacer.'
            : confirmState.row
              ? `¿Deseas ${confirmState.row.activo ? 'desactivar' : 'activar'} este puesto?`
              : ''
        }
        confirmLabel={confirmState.type === 'delete' ? 'Eliminar' : 'Confirmar'}
        variant={confirmState.type === 'delete' ? 'danger' : 'primary'}
      />
    </CrudPageShell>
  );
}
