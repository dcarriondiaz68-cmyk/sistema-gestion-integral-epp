import { useState, useCallback, useEffect, useMemo } from 'react';
import { Boxes } from 'lucide-react';
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
  fetchCatalogoEPP,
  createCatalogoEPP,
  updateCatalogoEPP,
  toggleCatalogoEPPActivo,
  deleteCatalogoEPP,
  checkDuplicateCodigo,
} from '@/services/catalogo.service';
import { fetchWithCache } from '@/lib/data-cache';
import type { CatalogoEPP, CatalogoEPPInsert } from '@/types/catalogo.types';
import { formatCurrency } from '@/lib/format';

const UNIDADES_MEDIDA = ['UND', 'PAR', 'JUEGO', 'KG', 'LITRO', 'METRO', 'CAJA'];

const CATEGORIAS_EPP = [
  'Protección de cabeza',
  'Protección ocular',
  'Protección facial',
  'Protección auditiva',
  'Protección respiratoria',
  'Protección de manos y brazos',
  'Protección de pies y piernas',
  'Protección del cuerpo',
  'Protección contra caídas',
  'Protección contra riesgos eléctricos',
  'Protección para trabajos especiales',
  'Otros EPP',
];

const EMPTY_FORM: CatalogoEPPInsert = {
  codigo: '',
  nombre: '',
  categoria: '',
  descripcion: '',
  marca: '',
  modelo: '',
  unidad_medida: 'UND',
  talla_requerida: false,
  lote_requerido: false,
  vida_util_meses: null,
  precio_unitario: null,
  activo: true,
};

export function CatalogoEPPPage() {
  const { hasPermission } = useAuthz();
  const canManage = hasPermission('catalogo_epp.manage');
  const { isOffline, enqueueOperation } = useSyncQueue();

  const [data, setData] = useState<CatalogoEPP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoriaFilter, setCategoriaFilter] = useState<string>('all');
  const [estadoFilter, setEstadoFilter] = useState<string>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogoEPP | null>(null);
  const [form, setForm] = useState<CatalogoEPPInsert>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchWithCache('catalogo_epp', () => fetchCatalogoEPP());
      setData(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el catálogo EPP.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categorias = useMemo(() => {
    const set = new Set<string>(CATEGORIAS_EPP);
    data.forEach((d) => { if (d.categoria) set.add(d.categoria); });
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    return data.filter((d) => {
      if (categoriaFilter !== 'all' && d.categoria !== categoriaFilter) return false;
      if (estadoFilter === 'activo' && !d.activo) return false;
      if (estadoFilter === 'inactivo' && d.activo) return false;
      return true;
    });
  }, [data, categoriaFilter, estadoFilter]);

  const { state: confirmState, requestDelete, requestToggle, close: closeConfirm, confirm: confirmAction } =
    useDeleteConfirm<CatalogoEPP>(
      async (row) => {
        try {
          if (isOffline) {
            await enqueueOperation('crud_maestro', 'Catálogo EPP', { table: 'catalogo_epp', action: 'delete', record_id: row.id, payload: {} });
            setData((prev) => prev.filter((r) => r.id !== row.id));
            return;
          }
          await deleteCatalogoEPP(row.id);
          setData((prev) => prev.filter((r) => r.id !== row.id));
        } catch (err) {
          setActionError(err instanceof Error ? err.message : 'Error al eliminar.');
        }
      },
      async (row) => {
        try {
          if (isOffline) {
            await enqueueOperation('crud_maestro', 'Catálogo EPP', { table: 'catalogo_epp', action: 'toggle', record_id: row.id, payload: { activo: !row.activo } });
            setData((prev) => prev.map((r) => (r.id === row.id ? { ...r, activo: !row.activo } : r)));
            return;
          }
          await toggleCatalogoEPPActivo(row.id, !row.activo);
          setData((prev) => prev.map((r) => (r.id === row.id ? { ...r, activo: !r.activo } : r)));
        } catch (err) {
          setActionError(err instanceof Error ? err.message : 'Error al cambiar estado.');
        }
      }
    );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (row: CatalogoEPP) => {
    setEditing(row);
    setForm({
      codigo: row.codigo,
      nombre: row.nombre,
      categoria: row.categoria,
      descripcion: row.descripcion ?? '',
      marca: row.marca ?? '',
      modelo: row.modelo ?? '',
      unidad_medida: row.unidad_medida,
      talla_requerida: row.talla_requerida,
      lote_requerido: row.lote_requerido,
      vida_util_meses: row.vida_util_meses,
      precio_unitario: row.precio_unitario,
      activo: row.activo,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.codigo.trim() || !form.nombre.trim() || !form.categoria.trim() || !form.unidad_medida.trim()) {
      setFormError('Código, nombre, categoría y unidad de medida son obligatorios.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      if (!isOffline) {
        const isDuplicate = await checkDuplicateCodigo(form.codigo.trim(), editing?.id);
        if (isDuplicate) {
          setFormError('Ya existe un EPP con este código.');
          return;
        }
      }

      if (isOffline) {
        if (editing) {
          await enqueueOperation('crud_maestro', 'Catálogo EPP', { table: 'catalogo_epp', action: 'update', record_id: editing.id, payload: form as unknown as Record<string, unknown> });
          setData((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...form } as CatalogoEPP : r)));
        } else {
          await enqueueOperation('crud_maestro', 'Catálogo EPP', { table: 'catalogo_epp', action: 'create', payload: form as unknown as Record<string, unknown> });
          const tempId = `offline-${Date.now()}`;
          setData((prev) => [...prev, { ...form, id: tempId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as unknown as CatalogoEPP]);
        }
        setModalOpen(false);
        return;
      }

      if (editing) {
        const updated = await updateCatalogoEPP(editing.id, form);
        setData((prev) => prev.map((r) => (r.id === editing.id ? updated : r)));
      } else {
        const created = await createCatalogoEPP(form);
        setData((prev) => [...prev, created]);
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<CatalogoEPP>[] = [
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
      render: (r) => (
        <div>
          <p className="font-medium text-neutral-900">{r.nombre}</p>
          {r.descripcion && <p className="text-xs text-neutral-400 line-clamp-1">{r.descripcion}</p>}
        </div>
      ),
    },
    {
      key: 'categoria',
      label: 'Categoría',
      sortable: true,
      sortValue: (r) => r.categoria,
      render: (r) => <Badge variant="info">{r.categoria}</Badge>,
    },
    {
      key: 'marca',
      label: 'Marca / Modelo',
      sortable: false,
      render: (r) => (
        <div>
          <p className="text-neutral-700">{r.marca ?? '—'}</p>
          <p className="text-xs text-neutral-400">{r.modelo ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'unidad_medida',
      label: 'Unidad',
      sortable: true,
      sortValue: (r) => r.unidad_medida,
      render: (r) => <span className="text-neutral-700">{r.unidad_medida}</span>,
    },
    {
      key: 'vida_util_meses',
      label: 'Vida útil',
      sortable: true,
      sortValue: (r) => r.vida_util_meses ?? 0,
      render: (r) => (
        <span className="text-neutral-700">
          {r.vida_util_meses != null ? `${r.vida_util_meses} m` : '—'}
        </span>
      ),
    },
    {
      key: 'precio_unitario',
      label: 'Precio',
      sortable: true,
      sortValue: (r) => r.precio_unitario ?? 0,
      render: (r) => (
        <span className="font-medium text-neutral-900">
          {r.precio_unitario != null ? formatCurrency(r.precio_unitario) : <span className="text-neutral-400">—</span>}
        </span>
      ),
    },
    {
      key: 'talla_requerida',
      label: 'Talla/Lote',
      sortable: false,
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.talla_requerida && <Badge variant="neutral">Talla</Badge>}
          {r.lote_requerido && <Badge variant="neutral">Lote</Badge>}
          {!r.talla_requerida && !r.lote_requerido && <span className="text-neutral-400">—</span>}
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
      title="Catálogo EPP"
      description="Maestro central de Equipos de Protección Personal"
      icon={<Boxes className="h-5 w-5" />}
      data={filtered}
      loading={loading}
      error={error}
      onRetry={load}
      onAdd={openCreate}
      onEdit={openEdit}
      onDelete={requestDelete}
      onToggleActivo={requestToggle}
      addLabel="Nuevo EPP"
      canManage={canManage}
      renderTable={() => (
        <Card padding="sm">
          <DataTable
            columns={columns}
            data={filtered}
            searchKeys={['codigo', 'nombre', 'marca', 'modelo', 'categoria']}
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
            label="Filtrar por categoría"
            value={categoriaFilter}
            onChange={(e) => setCategoriaFilter(e.target.value)}
          >
            <option value="all">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:max-w-xs">
          <Select
            label="Filtrar por estado"
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
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
        title={editing ? 'Editar EPP' : 'Nuevo EPP'}
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
              label="Código *"
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              placeholder="EPP-001"
            />
            <Input
              label="Nombre *"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Casco de seguridad"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Categoría *"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            >
              <option value="">Seleccionar categoría...</option>
              {CATEGORIAS_EPP.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
            <Select
              label="Unidad de medida *"
              value={form.unidad_medida}
              onChange={(e) => setForm({ ...form, unidad_medida: e.target.value })}
            >
              {UNIDADES_MEDIDA.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Marca"
              value={form.marca ?? ''}
              onChange={(e) => setForm({ ...form, marca: e.target.value })}
              placeholder="3M"
            />
            <Input
              label="Modelo"
              value={form.modelo ?? ''}
              onChange={(e) => setForm({ ...form, modelo: e.target.value })}
              placeholder="H-700"
            />
          </div>
          <Textarea
            label="Descripción"
            value={form.descripcion ?? ''}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Descripción del EPP"
            rows={2}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Select
              label="Talla requerida"
              value={form.talla_requerida ? 'si' : 'no'}
              onChange={(e) => setForm({ ...form, talla_requerida: e.target.value === 'si' })}
            >
              <option value="no">No</option>
              <option value="si">Sí</option>
            </Select>
            <Select
              label="Lote requerido"
              value={form.lote_requerido ? 'si' : 'no'}
              onChange={(e) => setForm({ ...form, lote_requerido: e.target.value === 'si' })}
            >
              <option value="no">No</option>
              <option value="si">Sí</option>
            </Select>
            <Input
              label="Vida útil (meses)"
              type="number"
              min={0}
              value={form.vida_util_meses ?? ''}
              onChange={(e) => setForm({ ...form, vida_util_meses: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="12"
            />
            <Input
              label="Precio unitario (S/)"
              type="number"
              min={0}
              step="0.01"
              value={form.precio_unitario ?? ''}
              onChange={(e) => setForm({ ...form, precio_unitario: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="0.00"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmState.row !== null}
        onClose={closeConfirm}
        onConfirm={confirmAction}
        title={confirmState.type === 'delete' ? 'Eliminar EPP' : 'Cambiar estado'}
        message={
          confirmState.type === 'delete'
            ? '¿Seguro que deseas eliminar este EPP del catálogo? Esta acción no se puede deshacer.'
            : confirmState.row
              ? `¿Deseas ${confirmState.row.activo ? 'desactivar' : 'activar'} este EPP?`
              : ''
        }
        confirmLabel={confirmState.type === 'delete' ? 'Eliminar' : 'Confirmar'}
        variant={confirmState.type === 'delete' ? 'danger' : 'primary'}
      />
    </CrudPageShell>
  );
}
