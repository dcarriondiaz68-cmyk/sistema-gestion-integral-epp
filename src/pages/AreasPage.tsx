import { useState, useCallback, useEffect } from 'react';
import { Layers } from 'lucide-react';
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
  fetchAreas,
  fetchSedes,
  fetchEmpresas,
  createArea,
  updateArea,
  toggleAreaActivo,
  deleteArea,
} from '@/services/maestros.service';
import { fetchWithCache } from '@/lib/data-cache';
import type { Area, Sede, Empresa, AreaInsert } from '@/types/maestros.types';

const EMPTY_FORM: AreaInsert = {
  sede_id: '',
  nombre: '',
  codigo: '',
  descripcion: '',
  activo: true,
};

export function AreasPage() {
  const { hasPermission } = useAuthz();
  const canManage = hasPermission('areas.manage');
  const { isOffline, enqueueOperation } = useSyncQueue();

  const [data, setData] = useState<Area[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaFilter, setEmpresaFilter] = useState<string>('all');
  const [sedeFilter, setSedeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Area | null>(null);
  const [form, setForm] = useState<AreaInsert>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [areas, allSedes, emps] = await Promise.all([
        fetchWithCache('areas', () => fetchAreas()),
        fetchWithCache('sedes', () => fetchSedes()),
        fetchWithCache('empresas', () => fetchEmpresas()),
      ]);
      setData(areas);
      setSedes(allSedes);
      setEmpresas(emps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar áreas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredSedes = empresaFilter === 'all' ? sedes : sedes.filter((s) => s.empresa_id === empresaFilter);
  const filtered = sedeFilter === 'all' ? data : data.filter((a) => a.sede_id === sedeFilter);

  const sedeNombre = (id: string) => sedes.find((s) => s.id === id)?.nombre ?? '—';
  const empresaOfSede = (sedeId: string) => {
    const sede = sedes.find((s) => s.id === sedeId);
    if (!sede) return '—';
    return empresas.find((e) => e.id === sede.empresa_id)?.razon_social ?? '—';
  };

  const { state: confirmState, requestDelete, requestToggle, close: closeConfirm, confirm: confirmAction } =
    useDeleteConfirm<Area>(
      async (row) => {
        try {
          if (isOffline) {
            await enqueueOperation('crud_maestro', 'Áreas', { table: 'areas', action: 'delete', record_id: row.id, payload: {} });
            setData((prev) => prev.filter((r) => r.id !== row.id));
            return;
          }
          await deleteArea(row.id);
          setData((prev) => prev.filter((r) => r.id !== row.id));
        } catch (err) {
          setActionError(err instanceof Error ? err.message : 'Error al eliminar.');
        }
      },
      async (row) => {
        try {
          if (isOffline) {
            await enqueueOperation('crud_maestro', 'Áreas', { table: 'areas', action: 'toggle', record_id: row.id, payload: { activo: !row.activo } });
            setData((prev) => prev.map((r) => (r.id === row.id ? { ...r, activo: !row.activo } : r)));
            return;
          }
          await toggleAreaActivo(row.id, !row.activo);
          setData((prev) => prev.map((r) => (r.id === row.id ? { ...r, activo: !r.activo } : r)));
        } catch (err) {
          setActionError(err instanceof Error ? err.message : 'Error al cambiar estado.');
        }
      }
    );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sede_id: filteredSedes[0]?.id ?? '' });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (row: Area) => {
    setEditing(row);
    setForm({
      sede_id: row.sede_id,
      nombre: row.nombre,
      codigo: row.codigo,
      descripcion: row.descripcion ?? '',
      activo: row.activo,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.sede_id || !form.nombre.trim() || !form.codigo.trim()) {
      setFormError('Sede, nombre y código son obligatorios.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (isOffline) {
        if (editing) {
          await enqueueOperation('crud_maestro', 'Áreas', { table: 'areas', action: 'update', record_id: editing.id, payload: form as unknown as Record<string, unknown> });
          setData((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...form } as Area : r)));
        } else {
          await enqueueOperation('crud_maestro', 'Áreas', { table: 'areas', action: 'create', payload: form as unknown as Record<string, unknown> });
          const tempId = `offline-${Date.now()}`;
          setData((prev) => [...prev, { ...form, id: tempId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as unknown as Area]);
        }
        setModalOpen(false);
        return;
      }
      if (editing) {
        const updated = await updateArea(editing.id, form);
        setData((prev) => prev.map((r) => (r.id === editing.id ? updated : r)));
      } else {
        const created = await createArea(form);
        setData((prev) => [...prev, created]);
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Area>[] = [
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
      key: 'sede_id',
      label: 'Sede',
      sortable: true,
      sortValue: (r) => sedeNombre(r.sede_id),
      render: (r) => (
        <div>
          <p className="text-neutral-700">{sedeNombre(r.sede_id)}</p>
          <p className="text-xs text-neutral-400">{empresaOfSede(r.sede_id)}</p>
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
      title="Áreas"
      description="Áreas operativas asociadas a sedes"
      icon={<Layers className="h-5 w-5" />}
      data={filtered}
      loading={loading}
      error={error}
      onRetry={load}
      onAdd={openCreate}
      onEdit={openEdit}
      onDelete={requestDelete}
      onToggleActivo={requestToggle}
      addLabel="Nueva Área"
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
            {filteredSedes.map((s) => (
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
        title={editing ? 'Editar Área' : 'Nueva Área'}
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
            label="Sede *"
            value={form.sede_id}
            onChange={(e) => setForm({ ...form, sede_id: e.target.value })}
          >
            <option value="">Seleccionar sede...</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </Select>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Código *"
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              placeholder="AREA-001"
            />
            <Input
              label="Nombre *"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Producción"
            />
          </div>
          <Textarea
            label="Descripción"
            value={form.descripcion ?? ''}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Descripción del área"
            rows={2}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmState.row !== null}
        onClose={closeConfirm}
        onConfirm={confirmAction}
        title={confirmState.type === 'delete' ? 'Eliminar área' : 'Cambiar estado'}
        message={
          confirmState.type === 'delete'
            ? '¿Seguro que deseas eliminar esta área? Esta acción no se puede deshacer.'
            : confirmState.row
              ? `¿Deseas ${confirmState.row.activo ? 'desactivar' : 'activar'} esta área?`
              : ''
        }
        confirmLabel={confirmState.type === 'delete' ? 'Eliminar' : 'Confirmar'}
        variant={confirmState.type === 'delete' ? 'danger' : 'primary'}
      />
    </CrudPageShell>
  );
}
