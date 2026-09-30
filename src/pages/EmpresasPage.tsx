import { useState, useCallback, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { CrudPageShell, RowActionButtons, useDeleteConfirm } from '@/components/ui/CrudPageShell';
import { useAuthz } from '@/hooks/useAuthz';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import {
  fetchEmpresas,
  createEmpresa,
  updateEmpresa,
  toggleEmpresaActivo,
  deleteEmpresa,
} from '@/services/maestros.service';
import { fetchWithCache } from '@/lib/data-cache';
import type { Empresa, EmpresaInsert } from '@/types/maestros.types';

const EMPTY_FORM: EmpresaInsert = {
  ruc: '',
  razon_social: '',
  nombre_comercial: '',
  domicilio: '',
  actividad_economica: '',
  numero_trabajadores: 0,
  activo: true,
};

export function EmpresasPage() {
  const { hasPermission } = useAuthz();
  const canManage = hasPermission('empresas.manage');
  const { isOffline, enqueueOperation } = useSyncQueue();

  const [data, setData] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [form, setForm] = useState<EmpresaInsert>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchWithCache('empresas', () => fetchEmpresas());
      setData(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar empresas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { state: confirmState, requestDelete, requestToggle, close: closeConfirm, confirm: confirmAction } =
    useDeleteConfirm<Empresa>(
      async (row) => {
        try {
          if (isOffline) {
            await enqueueOperation('crud_maestro', 'Empresas', { table: 'empresas', action: 'delete', record_id: row.id, payload: {} });
            setData((prev) => prev.filter((r) => r.id !== row.id));
            return;
          }
          await deleteEmpresa(row.id);
          setData((prev) => prev.filter((r) => r.id !== row.id));
        } catch (err) {
          setActionError(err instanceof Error ? err.message : 'Error al eliminar.');
        }
      },
      async (row) => {
        try {
          if (isOffline) {
            await enqueueOperation('crud_maestro', 'Empresas', { table: 'empresas', action: 'toggle', record_id: row.id, payload: { activo: !row.activo } });
            setData((prev) => prev.map((r) => (r.id === row.id ? { ...r, activo: !r.activo } : r)));
            return;
          }
          await toggleEmpresaActivo(row.id, !row.activo);
          setData((prev) => prev.map((r) => (r.id === row.id ? { ...r, activo: !r.activo } : r)));
        } catch (err) {
          setActionError(err instanceof Error ? err.message : 'Error al cambiar estado.');
        }
      }
    );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (row: Empresa) => {
    setEditing(row);
    setForm({
      ruc: row.ruc,
      razon_social: row.razon_social,
      nombre_comercial: row.nombre_comercial ?? '',
      domicilio: row.domicilio ?? '',
      actividad_economica: row.actividad_economica ?? '',
      numero_trabajadores: row.numero_trabajadores,
      activo: row.activo,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.ruc.trim() || !form.razon_social.trim()) {
      setFormError('El RUC y la razón social son obligatorios.');
      return;
    }
    if (form.ruc.trim().length !== 11) {
      setFormError('El RUC debe tener 11 dígitos.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (isOffline) {
        if (editing) {
          await enqueueOperation('crud_maestro', 'Empresas', { table: 'empresas', action: 'update', record_id: editing.id, payload: form as unknown as Record<string, unknown> });
          setData((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...form } as Empresa : r)));
        } else {
          await enqueueOperation('crud_maestro', 'Empresas', { table: 'empresas', action: 'create', payload: form as unknown as Record<string, unknown> });
          const tempId = `offline-${Date.now()}`;
          setData((prev) => [...prev, { ...form, id: tempId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as unknown as Empresa]);
        }
        setModalOpen(false);
        return;
      }
      if (editing) {
        const updated = await updateEmpresa(editing.id, form);
        setData((prev) => prev.map((r) => (r.id === editing.id ? updated : r)));
      } else {
        const created = await createEmpresa(form);
        setData((prev) => [...prev, created]);
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Empresa>[] = [
    {
      key: 'ruc',
      label: 'RUC',
      sortable: true,
      sortValue: (r) => r.ruc,
      render: (r) => <span className="font-medium text-neutral-900">{r.ruc}</span>,
    },
    {
      key: 'razon_social',
      label: 'Razón Social',
      sortable: true,
      sortValue: (r) => r.razon_social,
      render: (r) => (
        <div>
          <p className="font-medium text-neutral-900">{r.razon_social}</p>
          {r.nombre_comercial && <p className="text-xs text-neutral-400">{r.nombre_comercial}</p>}
        </div>
      ),
    },
    {
      key: 'actividad_economica',
      label: 'Actividad',
      render: (r) => r.actividad_economica ?? '—',
    },
    {
      key: 'numero_trabajadores',
      label: 'N° Trabajadores',
      sortable: true,
      sortValue: (r) => r.numero_trabajadores,
      render: (r) => <span className="tabular-nums">{r.numero_trabajadores}</span>,
    },
    {
      key: 'activo',
      label: 'Estado',
      sortable: true,
      sortValue: (r) => (r.activo ? 1 : 0),
      render: (r) => (
        <Badge variant={r.activo ? 'success' : 'neutral'}>
          {r.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
  ];

  return (
    <CrudPageShell
      title="Empresas"
      description="Gestión de empresas registradas en el sistema"
      icon={<Building2 className="h-5 w-5" />}
      data={data}
      loading={loading}
      error={error}
      onRetry={load}
      onAdd={openCreate}
      onEdit={openEdit}
      onDelete={requestDelete}
      onToggleActivo={requestToggle}
      addLabel="Nueva Empresa"
      canManage={canManage}
      renderTable={() => (
        <Card padding="sm">
          <DataTable
            columns={columns}
            data={data}
            searchKeys={['ruc', 'razon_social', 'nombre_comercial']}
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
      {actionError && (
        <Alert variant="error" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Empresa' : 'Nueva Empresa'}
        description="Información de la empresa"
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
            <Input
              label="RUC *"
              value={form.ruc}
              onChange={(e) => setForm({ ...form, ruc: e.target.value })}
              placeholder="12345678901"
              maxLength={11}
            />
            <Input
              label="Razón Social *"
              value={form.razon_social}
              onChange={(e) => setForm({ ...form, razon_social: e.target.value })}
              placeholder="Mi Empresa S.A.C."
            />
          </div>
          <Input
            label="Nombre Comercial"
            value={form.nombre_comercial ?? ''}
            onChange={(e) => setForm({ ...form, nombre_comercial: e.target.value })}
            placeholder="Nombre comercial (opcional)"
          />
          <Textarea
            label="Domicilio"
            value={form.domicilio ?? ''}
            onChange={(e) => setForm({ ...form, domicilio: e.target.value })}
            placeholder="Dirección fiscal"
            rows={2}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Actividad Económica"
              value={form.actividad_economica ?? ''}
              onChange={(e) => setForm({ ...form, actividad_economica: e.target.value })}
              placeholder="Ej. Construcción"
            />
            <Input
              label="N° de Trabajadores"
              type="number"
              min={0}
              value={form.numero_trabajadores ?? 0}
              onChange={(e) => setForm({ ...form, numero_trabajadores: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmState.row !== null}
        onClose={closeConfirm}
        onConfirm={confirmAction}
        title={confirmState.type === 'delete' ? 'Eliminar empresa' : 'Cambiar estado'}
        message={
          confirmState.type === 'delete'
            ? '¿Seguro que deseas eliminar esta empresa? Esta acción no se puede deshacer.'
            : confirmState.row
              ? `¿Deseas ${confirmState.row.activo ? 'desactivar' : 'activar'} esta empresa?`
              : ''
        }
        confirmLabel={confirmState.type === 'delete' ? 'Eliminar' : 'Confirmar'}
        variant={confirmState.type === 'delete' ? 'danger' : 'primary'}
      />
    </CrudPageShell>
  );
}
