import { useState, useCallback, useEffect, useMemo } from 'react';
import { ShieldCheck, ArrowDownCircle, ArrowUpCircle, SlidersHorizontal } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/StateDisplay';
import { useAuthz } from '@/hooks/useAuthz';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import { fetchInventario, registrarMovimiento, updateStockMinimo, createInventario } from '@/services/inventario.service';
import { fetchWithCache } from '@/lib/data-cache';
import { fetchSedes } from '@/services/maestros.service';
import { fetchCatalogoEPP } from '@/services/catalogo.service';
import type { InventarioWithRelations } from '@/types/inventario.types';
import type { TipoMovimiento } from '@/types/inventario.types';
import type { Sede } from '@/types/maestros.types';
import type { CatalogoEPP } from '@/types/catalogo.types';

type ModalMode = 'INGRESO' | 'SALIDA' | 'AJUSTE' | 'STOCK_MINIMO' | null;

export function InventarioPage() {
  const { hasPermission } = useAuthz();
  const canManage = hasPermission('inventario.manage');
  const { isOffline, enqueueOperation } = useSyncQueue();

  const [data, setData] = useState<InventarioWithRelations[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoEPP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sedeFilter, setSedeFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedRow, setSelectedRow] = useState<InventarioWithRelations | null>(null);
  const [cantidad, setCantidad] = useState<number>(0);
  const [motivo, setMotivo] = useState<string>('');
  const [stockMinimoInput, setStockMinimoInput] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [nuevoInventarioOpen, setNuevoInventarioOpen] = useState(false);
  const [nuevoEppId, setNuevoEppId] = useState<string>('');
  const [nuevoSedeId, setNuevoSedeId] = useState<string>('');
  const [nuevoStockMinimo, setNuevoStockMinimo] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inv, sds, epps] = await Promise.all([
        fetchWithCache('inventario', () => fetchInventario()),
        fetchWithCache('sedes', () => fetchSedes()),
        fetchWithCache('catalogo_epp', () => fetchCatalogoEPP()),
      ]);
      setData(inv);
      setSedes(sds as Sede[]);
      setCatalogo(epps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el inventario.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return data.filter((d) => {
      if (sedeFilter !== 'all' && d.sede_id !== sedeFilter) return false;
      if (stockFilter === 'bajo' && !(d.stock_minimo !== null && d.stock_actual <= d.stock_minimo)) return false;
      if (stockFilter === 'ok' && d.stock_minimo !== null && d.stock_actual <= d.stock_minimo) return false;
      return true;
    });
  }, [data, sedeFilter, stockFilter]);

  const openMovimiento = (row: InventarioWithRelations, mode: 'INGRESO' | 'SALIDA' | 'AJUSTE') => {
    setSelectedRow(row);
    setModalMode(mode);
    setCantidad(0);
    setMotivo('');
    setFormError(null);
  };

  const openStockMinimo = (row: InventarioWithRelations) => {
    setSelectedRow(row);
    setModalMode('STOCK_MINIMO');
    setStockMinimoInput(row.stock_minimo !== null ? String(row.stock_minimo) : '');
    setFormError(null);
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedRow(null);
    setFormError(null);
  };

  const handleSaveMovimiento = async () => {
    if (!selectedRow || !modalMode) return;
    if (modalMode === 'STOCK_MINIMO') {
      if (!saving) {
        setSaving(true);
        setFormError(null);
        try {
          const val = stockMinimoInput.trim() === '' ? null : Number(stockMinimoInput);
          if (val !== null && (Number.isNaN(val) || val < 0)) {
            setFormError('El stock mínimo debe ser un número válido mayor o igual a cero.');
            return;
          }
          if (isOffline) {
            await enqueueOperation('crud_maestro', 'Inventario', { table: 'inventario', action: 'update', record_id: selectedRow.id, payload: { stock_minimo: val } as unknown as Record<string, unknown> });
            setData((prev) =>
              prev.map((r) => (r.id === selectedRow.id ? { ...r, stock_minimo: val } : r))
            );
            closeModal();
            return;
          }
          await updateStockMinimo(selectedRow.id, val);
          setData((prev) =>
            prev.map((r) => (r.id === selectedRow.id ? { ...r, stock_minimo: val } : r))
          );
          closeModal();
        } catch (err) {
          setFormError(err instanceof Error ? err.message : 'Error al guardar.');
        } finally {
          setSaving(false);
        }
      }
      return;
    }

    if (cantidad <= 0) {
      setFormError('La cantidad debe ser mayor que cero.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      if (isOffline) {
        await enqueueOperation('registrar_movimiento', 'Inventario', {
          inventario_id: selectedRow.id,
          epp_id: selectedRow.epp_id,
          sede_id: selectedRow.sede_id,
          tipo_movimiento: modalMode as TipoMovimiento,
          cantidad,
          motivo: motivo.trim() || null,
        });
        const delta = modalMode === 'SALIDA' ? -cantidad : modalMode === 'INGRESO' ? cantidad : 0;
        const newStock = modalMode === 'AJUSTE' ? cantidad : selectedRow.stock_actual + delta;
        setData((prev) =>
          prev.map((r) =>
            r.id === selectedRow.id
              ? { ...r, stock_actual: newStock }
              : r
          )
        );
        closeModal();
        return;
      }
      const result = await registrarMovimiento({
        eppId: selectedRow.epp_id,
        sedeId: selectedRow.sede_id,
        tipoMovimiento: modalMode as TipoMovimiento,
        cantidad,
        motivo: motivo.trim() || null,
      });
      setData((prev) =>
        prev.map((r) =>
          r.id === selectedRow.id
            ? { ...r, stock_actual: result.nuevo_saldo }
            : r
        )
      );
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al registrar el movimiento.');
    } finally {
      setSaving(false);
    }
  };

  const handleCrearInventario = async () => {
    if (!nuevoEppId || !nuevoSedeId) {
      setFormError('Debe seleccionar un EPP y una sede.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const existing = data.find(
        (d) => d.epp_id === nuevoEppId && d.sede_id === nuevoSedeId
      );
      if (existing) {
        setFormError('Ya existe un registro de inventario para este EPP en esta sede.');
        return;
      }
      const val = nuevoStockMinimo.trim() === '' ? null : Number(nuevoStockMinimo);
      if (val !== null && (Number.isNaN(val) || val < 0)) {
        setFormError('El stock mínimo debe ser un número válido.');
        return;
      }

      if (isOffline) {
        await enqueueOperation('crud_maestro', 'Inventario', { table: 'inventario', action: 'create', payload: { epp_id: nuevoEppId, sede_id: nuevoSedeId, stock_minimo: val } as unknown as Record<string, unknown> });
        const tempId = `offline-${Date.now()}`;
        const epp = catalogo.find((e) => e.id === nuevoEppId);
        const sede = sedes.find((s) => s.id === nuevoSedeId);
        const newRow: InventarioWithRelations = {
          id: tempId,
          epp_id: nuevoEppId,
          sede_id: nuevoSedeId,
          stock_actual: 0,
          stock_minimo: val,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          epp_codigo: epp?.codigo ?? '—',
          epp_nombre: epp?.nombre ?? '—',
          epp_unidad_medida: epp?.unidad_medida ?? '—',
          sede_nombre: sede?.nombre ?? '—',
        };
        setData((prev) => [newRow, ...prev]);
        setNuevoInventarioOpen(false);
        setNuevoEppId('');
        setNuevoSedeId('');
        setNuevoStockMinimo('');
        return;
      }

      const newInv = await createInventario(nuevoEppId, nuevoSedeId, val);

      const epp = catalogo.find((e) => e.id === nuevoEppId);
      const sede = sedes.find((s) => s.id === nuevoSedeId);
      const newRow: InventarioWithRelations = {
        ...newInv,
        epp_codigo: epp?.codigo ?? '—',
        epp_nombre: epp?.nombre ?? '—',
        epp_unidad_medida: epp?.unidad_medida ?? '—',
        sede_nombre: sede?.nombre ?? '—',
      };
      setData((prev) => [newRow, ...prev]);
      setNuevoInventarioOpen(false);
      setNuevoEppId('');
      setNuevoSedeId('');
      setNuevoStockMinimo('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al crear el registro.');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<InventarioWithRelations>[] = [
    {
      key: 'epp_codigo',
      label: 'Código',
      sortable: true,
      sortValue: (r) => r.epp_codigo,
      render: (r) => <span className="font-medium text-neutral-900">{r.epp_codigo}</span>,
    },
    {
      key: 'epp_nombre',
      label: 'EPP',
      sortable: true,
      sortValue: (r) => r.epp_nombre,
      render: (r) => (
        <div>
          <p className="font-medium text-neutral-900">{r.epp_nombre}</p>
          <p className="text-xs text-neutral-400">{r.epp_unidad_medida}</p>
        </div>
      ),
    },
    {
      key: 'sede_nombre',
      label: 'Sede',
      sortable: true,
      sortValue: (r) => r.sede_nombre,
      render: (r) => <span className="text-neutral-700">{r.sede_nombre}</span>,
    },
    {
      key: 'stock_actual',
      label: 'Stock Actual',
      sortable: true,
      sortValue: (r) => r.stock_actual,
      render: (r) => {
        const isLow = r.stock_minimo !== null && r.stock_actual <= r.stock_minimo;
        return (
          <span className={`font-semibold ${isLow ? 'text-warning-600' : 'text-neutral-900'}`}>
            {r.stock_actual}
          </span>
        );
      },
    },
    {
      key: 'stock_minimo',
      label: 'Stock Mínimo',
      sortable: true,
      sortValue: (r) => r.stock_minimo ?? 0,
      render: (r) => <span className="text-neutral-700">{r.stock_minimo ?? '—'}</span>,
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: false,
      render: (r) => {
        const isLow = r.stock_minimo !== null && r.stock_actual <= r.stock_minimo;
        if (isLow) return <Badge variant="warning">Stock bajo</Badge>;
        return <Badge variant="success">Disponible</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Inventario</h1>
            <p className="mt-0.5 text-sm text-neutral-500">Stock de EPP por sede</p>
          </div>
        </div>
        {canManage && (
          <Button onClick={() => { setNuevoInventarioOpen(true); setFormError(null); }}>
            Nuevo registro
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:max-w-xs">
          <Select label="Filtrar por sede" value={sedeFilter} onChange={(e) => setSedeFilter(e.target.value)}>
            <option value="all">Todas las sedes</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:max-w-xs">
          <Select label="Filtrar por stock" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
            <option value="all">Todo el stock</option>
            <option value="bajo">Stock bajo</option>
            <option value="ok">Disponible</option>
          </Select>
        </div>
      </div>

      {actionError && (
        <Alert variant="error" onClose={() => setActionError(null)}>{actionError}</Alert>
      )}

      {loading ? (
        <LoadingState message="Cargando inventario..." />
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin inventario"
            description="No hay registros de inventario. Crea uno para comenzar."
            action={
              canManage ? (
                <Button onClick={() => { setNuevoInventarioOpen(true); setFormError(null); }}>
                  Nuevo registro
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card padding="sm">
          <DataTable
            columns={columns}
            data={filtered}
            searchKeys={['epp_codigo', 'epp_nombre', 'sede_nombre']}
            rowKey={(r) => r.id}
            actions={(row) => (
              <div className="flex items-center justify-end gap-1">
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => openMovimiento(row, 'INGRESO')}
                      className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-success-50 hover:text-success-600"
                      title="Registrar ingreso"
                    >
                      <ArrowDownCircle className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openMovimiento(row, 'SALIDA')}
                      className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-error-50 hover:text-error-600"
                      title="Registrar salida"
                    >
                      <ArrowUpCircle className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openMovimiento(row, 'AJUSTE')}
                      className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-primary-50 hover:text-primary-600"
                      title="Ajustar stock"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openStockMinimo(row)}
                      className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                      title="Configurar stock mínimo"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            )}
          />
        </Card>
      )}

      {/* Modal: Movimiento (ingreso/salida/ajuste) */}
      <Modal
        open={modalMode !== null && modalMode !== 'STOCK_MINIMO'}
        onClose={closeModal}
        title={
          modalMode === 'INGRESO' ? 'Registrar Ingreso' :
          modalMode === 'SALIDA' ? 'Registrar Salida' :
          modalMode === 'AJUSTE' ? 'Ajustar Stock' : ''
        }
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={handleSaveMovimiento} loading={saving}>Confirmar</Button>
          </>
        }
      >
        {formError && (
          <div className="mb-4">
            <Alert variant="error">{formError}</Alert>
          </div>
        )}
        {selectedRow && modalMode && modalMode !== 'STOCK_MINIMO' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
              <p><span className="text-neutral-500">EPP:</span> <span className="font-medium text-neutral-900">{selectedRow.epp_nombre}</span></p>
              <p><span className="text-neutral-500">Sede:</span> <span className="font-medium text-neutral-900">{selectedRow.sede_nombre}</span></p>
              <p><span className="text-neutral-500">Stock actual:</span> <span className="font-medium text-neutral-900">{selectedRow.stock_actual}</span></p>
            </div>
            <Input
              label={modalMode === 'AJUSTE' ? 'Nuevo stock total *' : 'Cantidad *'}
              type="number"
              min={0}
              value={cantidad || ''}
              onChange={(e) => setCantidad(Number(e.target.value))}
              placeholder={modalMode === 'AJUSTE' ? 'Ej. 50' : 'Ej. 10'}
            />
            {modalMode === 'AJUSTE' && (
              <p className="text-xs text-neutral-500">
                Ingrese el valor correcto del stock. El sistema calculará la diferencia automáticamente.
              </p>
            )}
            <Textarea
              label="Motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo del movimiento (opcional)"
              rows={2}
            />
          </div>
        )}
      </Modal>

      {/* Modal: Stock mínimo */}
      <Modal
        open={modalMode === 'STOCK_MINIMO'}
        onClose={closeModal}
        title="Configurar Stock Mínimo"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={handleSaveMovimiento} loading={saving}>Guardar</Button>
          </>
        }
      >
        {formError && (
          <div className="mb-4">
            <Alert variant="error">{formError}</Alert>
          </div>
        )}
        {selectedRow && (
          <div className="space-y-4">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
              <p><span className="text-neutral-500">EPP:</span> <span className="font-medium text-neutral-900">{selectedRow.epp_nombre}</span></p>
              <p><span className="text-neutral-500">Sede:</span> <span className="font-medium text-neutral-900">{selectedRow.sede_nombre}</span></p>
            </div>
            <Input
              label="Stock mínimo"
              type="number"
              min={0}
              value={stockMinimoInput}
              onChange={(e) => setStockMinimoInput(e.target.value)}
              placeholder="Dejar vacío para sin mínimo"
            />
          </div>
        )}
      </Modal>

      {/* Modal: Nuevo registro de inventario */}
      <Modal
        open={nuevoInventarioOpen}
        onClose={() => setNuevoInventarioOpen(false)}
        title="Nuevo registro de inventario"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setNuevoInventarioOpen(false)}>Cancelar</Button>
            <Button onClick={handleCrearInventario} loading={saving}>Crear</Button>
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
            label="EPP *"
            value={nuevoEppId}
            onChange={(e) => setNuevoEppId(e.target.value)}
          >
            <option value="">Seleccionar EPP...</option>
            {catalogo.filter((e) => e.activo).map((e) => (
              <option key={e.id} value={e.id}>{e.codigo} — {e.nombre}</option>
            ))}
          </Select>
          <Select
            label="Sede *"
            value={nuevoSedeId}
            onChange={(e) => setNuevoSedeId(e.target.value)}
          >
            <option value="">Seleccionar sede...</option>
            {sedes.filter((s) => s.activo).map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </Select>
          <Input
            label="Stock mínimo"
            type="number"
            min={0}
            value={nuevoStockMinimo}
            onChange={(e) => setNuevoStockMinimo(e.target.value)}
            placeholder="Opcional"
          />
          <p className="text-xs text-neutral-500">
            El stock inicial será 0. Use el botón de ingreso para registrar stock después de crear el registro.
          </p>
        </div>
      </Modal>
    </div>
  );
}
