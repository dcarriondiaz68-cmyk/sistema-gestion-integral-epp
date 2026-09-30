import { useState, useCallback, useEffect } from 'react';
import { MapPin } from 'lucide-react';
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
  fetchSedes,
  fetchEmpresas,
  createSede,
  updateSede,
  toggleSedeActivo,
  deleteSede,
} from '@/services/maestros.service';
import { fetchWithCache } from '@/lib/data-cache';
import type { Sede, Empresa, SedeInsert } from '@/types/maestros.types';

const EMPTY_FORM: SedeInsert = {
  empresa_id: '',
  nombre: '',
  codigo: '',
  direccion: '',
  activo: true,
};

export function SedesPage() {
  const { hasPermission } = useAuthz();
  const canManage = hasPermission('sedes.manage');
  const { isOffline, enqueueOperation } = useSyncQueue();

  const [data, setData] = useState<Sede[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaFilter, setEmpresaFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sede | null>(null);
  const [form, setForm] = useState<SedeInsert>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sedes, emps] = await Promise.all([
        fetchWithCache('sedes', () => fetchSedes()),
        fetchWithCache('empresas', () => fetchEmpresas()),
      ]);
      setData(sedes);
      setEmpresas(emps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar sedes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = empresaFilter === 'all' ? data : data.filter((s) => s.empresa_id === empresaFilter);

  const empresaName = (id: string) => empresas.find((e) => e.id === id)?.razon_social ?? '—';

  const { state: confirmState, requestDelete, requestToggle, close: closeConfirm, confirm: confirmAction } =
    useDeleteConfirm<Sede>(
      async (row) => {
        try {
          if (isOffline) {
            await enqueueOperation('crud_maestro', 'Sedes', { table: 'sedes', action: 'delete', record_id: row.id, payload: {} });
            setData((prev) => prev.filter((r) => r.id !== row.id));
            return;
          }
          await deleteSede(row.id);
          setData((prev) => prev.filter((r) => r.id !== row.id));
        } catch (err) {
          setActionError(err instanceof Error ? err.message : 'Error al eliminar.');
        }
      },
      async (row) => {
        try {
          if (isOffline) {
            await enqueueOperation('crud_maestro', 'Sedes', { table: 'sedes', action: 'toggle', record_id: row.id, payload: { activo: !row.activo } });
            setData((prev) => prev.map((r) => (r.id === row.id ? { ...r, activo: !row.activo } : r)));
            return;
          }
          await toggleSedeActivo(row.id, !row.activo);
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

  const openEdit = (row: Sede) => {
    setEditing(row);
    setForm({
      empresa_id: row.empresa_id,
      nombre: row.nombre,
      codigo: row.codigo,
      direccion: row.direccion ?? '',
      activo: row.activo,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.empresa_id || !form.nombre.trim() || !form.codigo.trim()) {
      setFormError('Empresa, nombre y código son obligatorios.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (isOffline) {
        if (editing) {
          await enqueueOperation('crud_maestro', 'Sedes', { table: 'sedes', action: 'update', record_id: editing.id, payload: form as unknown as Record<string, unknown> });
          setData((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...form } as Sede : r)));
        } else {
          await enqueueOperation('crud_maestro', 'Sedes', { table: 'sedes', action: 'create', payload: form as unknown as Record<string, unknown> });
          const tempId = `offline-${Date.now()}`;
          setData((prev) => [...prev, { ...form, id: tempId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as unknown as Sede]);
        }
        setModalOpen(false);
        return;
      }
      if (editing) {
        const updated = await updateSede(editing.id, form);
        setData((prev) => prev.map((r) => (r.id === editing.id ? updated : r)));
      } else {
        const created = await createSede(form);
        setData((prev) => [...prev, created]);
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Sede>[] = [
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
      key: 'empresa_id',
      label: 'Empresa',
      sortable: true,
      sortValue: (r) => empresaName(r.empresa_id),
      render: (r) => empresaName(r.empresa_id),
    },
    {
      key: 'direccion',
      label: 'Dirección',
      render: (r) => r.direccion ?? '—',
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
      title="Sedes"
      description="Centros de trabajo asociados a empresas"
      icon={<MapPin className="h-5 w-5" />}
      data={filtered}
      loading={loading}
      error={error}
      onRetry={load}
      onAdd={openCreate}
      onEdit={openEdit}
      onDelete={requestDelete}
      onToggleActivo={requestToggle}
      addLabel="Nueva Sede"
      canManage={canManage}
      renderTable={() => (
        <Card padding="sm">
          <DataTable
            columns={columns}
            data={filtered}
            searchKeys={['codigo', 'nombre', 'direccion']}
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="w-full sm:max-w-xs">
          <Select
            label="Filtrar por empresa"
            value={empresaFilter}
            onChange={(e) => setEmpresaFilter(e.target.value)}
          >
            <option value="all">Todas las empresas</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>{e.razon_social}</option>
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
        title={editing ? 'Editar Sede' : 'Nueva Sede'}
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
            label="Empresa *"
            value={form.empresa_id}
            onChange={(e) => setForm({ ...form, empresa_id: e.target.value })}
          >
            <option value="">Seleccionar empresa...</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>{e.razon_social}</option>
            ))}
          </Select>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Código *"
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              placeholder="SED-001"
            />
            <Input
              label="Nombre *"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Sede Central"
            />
          </div>
          <Textarea
            label="Dirección"
            value={form.direccion ?? ''}
            onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            placeholder="Dirección de la sede"
            rows={2}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmState.row !== null}
        onClose={closeConfirm}
        onConfirm={confirmAction}
        title={confirmState.type === 'delete' ? 'Eliminar sede' : 'Cambiar estado'}
        message={
          confirmState.type === 'delete'
            ? '¿Seguro que deseas eliminar esta sede? Esta acción no se puede deshacer.'
            : confirmState.row
              ? `¿Deseas ${confirmState.row.activo ? 'desactivar' : 'activar'} esta sede?`
              : ''
        }
        confirmLabel={confirmState.type === 'delete' ? 'Eliminar' : 'Confirmar'}
        variant={confirmState.type === 'delete' ? 'danger' : 'primary'}
      />
    </CrudPageShell>
  );
}
