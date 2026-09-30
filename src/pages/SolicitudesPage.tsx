import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Eye, Check, X, Plus, PackageCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/StateDisplay';
import { useAuthz } from '@/hooks/useAuthz';
import { useAuth } from '@/hooks/useAuth';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import { formatDateTime } from '@/lib/format';
import {
  fetchSolicitudes,
  createSolicitud,
  procesarSolicitud,
  deleteSolicitud,
} from '@/services/solicitudes.service';
import { fetchWithCache } from '@/lib/data-cache';
import { fetchTrabajadores, fetchSedes, fetchMiTrabajador } from '@/services/maestros.service';
import { fetchCatalogoEPP } from '@/services/catalogo.service';
import type {
  SolicitudWithRelations,
  SolicitudInsert,
  EstadoSolicitud,
} from '@/types/solicitudes.types';
import type { TrabajadorWithRelations } from '@/types/maestros.types';
import type { CatalogoEPP } from '@/types/catalogo.types';
import type { Sede } from '@/types/maestros.types';

const ESTADO_VARIANTS: Record<EstadoSolicitud, 'warning' | 'success' | 'error'> = {
  PENDIENTE: 'warning',
  APROBADA: 'success',
  RECHAZADA: 'error',
};

const ESTADO_LABELS: Record<EstadoSolicitud, string> = {
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
};

const EMPTY_FORM: SolicitudInsert = {
  trabajador_id: '',
  epp_id: '',
  sede_id: '',
  talla: null,
  cantidad: 1,
  motivo: null,
  observacion: null,
};

export function SolicitudesPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuthz();
  const { profile } = useAuth();
  const { isOffline, enqueueOperation } = useSyncQueue();
  const canCreate = hasPermission('solicitudes.manage');
  const canApprove = hasPermission('aprobaciones.manage');
  const canDelete = hasPermission('solicitudes.manage');

  const isTrabajador = profile?.role === 'TRABAJADOR';
  const [miTrabajador, setMiTrabajador] = useState<TrabajadorWithRelations | null>(null);

  const [data, setData] = useState<SolicitudWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [estadoFilter, setEstadoFilter] = useState<string>('all');
  const [sedeFilter, setSedeFilter] = useState<string>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<SolicitudInsert>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [trabajadores, setTrabajadores] = useState<TrabajadorWithRelations[]>([]);
  const [catalogoEPP, setCatalogoEPP] = useState<CatalogoEPP[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);

  const [detalleSolicitud, setDetalleSolicitud] = useState<SolicitudWithRelations | null>(null);
  const [rechazarSolicitud, setRechazarSolicitud] = useState<SolicitudWithRelations | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [procesando, setProcesando] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<SolicitudWithRelations | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let mio: TrabajadorWithRelations | null = null;
      if (isTrabajador) {
        mio = await fetchMiTrabajador();
        setMiTrabajador(mio);
      }

      const [items, trabs, epps, sds] = await Promise.all([
        fetchWithCache('solicitudes', () => fetchSolicitudes(isTrabajador && mio ? { trabajadorId: mio.id } : undefined)),
        fetchWithCache('trabajadores', () => fetchTrabajadores()),
        fetchWithCache('catalogo_epp', () => fetchCatalogoEPP()),
        fetchWithCache('sedes', () => fetchSedes()),
      ]);
      setData(items);
      setTrabajadores(trabs);
      setCatalogoEPP(epps);
      setSedes(sds as Sede[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar las solicitudes.');
    } finally {
      setLoading(false);
    }
  }, [isTrabajador]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return data.filter((d) => {
      if (estadoFilter !== 'all' && d.estado !== estadoFilter) return false;
      if (sedeFilter !== 'all' && d.sede_id !== sedeFilter) return false;
      return true;
    });
  }, [data, estadoFilter, sedeFilter]);

  const selectedEpp = useMemo(
    () => catalogoEPP.find((e) => e.id === form.epp_id),
    [catalogoEPP, form.epp_id]
  );

  const selectedTrabajador = useMemo(
    () => trabajadores.find((t) => t.id === form.trabajador_id),
    [trabajadores, form.trabajador_id]
  );

  const openCreate = () => {
    if (isTrabajador && miTrabajador) {
      setForm({
        ...EMPTY_FORM,
        trabajador_id: miTrabajador.id,
        sede_id: miTrabajador.sede_id,
      });
    } else {
      setForm({ ...EMPTY_FORM });
    }
    setFormError(null);
    setModalOpen(true);
  };

  const handleTrabajadorChange = (trabajadorId: string) => {
    const trab = trabajadores.find((t) => t.id === trabajadorId);
    setForm((prev) => ({
      ...prev,
      trabajador_id: trabajadorId,
      sede_id: trab?.sede_id ?? '',
    }));
  };

  const handleSave = async () => {
    if (!form.trabajador_id) {
      setFormError('Debe seleccionar un trabajador.');
      return;
    }
    if (!form.epp_id) {
      setFormError('Debe seleccionar un EPP.');
      return;
    }
    if (!form.cantidad || form.cantidad <= 0) {
      setFormError('La cantidad debe ser mayor que cero.');
      return;
    }
    if (selectedEpp?.talla_requerida && !form.talla?.trim()) {
      setFormError('Este EPP requiere talla. Debe ingresarla.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload: SolicitudInsert = {
        ...form,
        talla: form.talla?.trim() || null,
        motivo: form.motivo?.trim() || null,
        observacion: form.observacion?.trim() || null,
      };
      if (isOffline) {
        await enqueueOperation('crear_solicitud', 'Solicitudes', payload as unknown as Record<string, unknown>);
        setModalOpen(false);
        setActionError(null);
      } else {
        await createSolicitud(payload);
        setModalOpen(false);
        await load();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar la solicitud.');
    } finally {
      setSaving(false);
    }
  };

  const handleAprobar = async (solicitud: SolicitudWithRelations) => {
    setProcesando(true);
    setActionError(null);
    try {
      await procesarSolicitud(solicitud.id, 'APROBAR');
      setDetalleSolicitud(null);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al aprobar la solicitud.');
    } finally {
      setProcesando(false);
    }
  };

  const handleRechazar = async () => {
    if (!rechazarSolicitud) return;
    if (!motivoRechazo.trim()) {
      setFormError('El motivo de rechazo es obligatorio.');
      return;
    }
    setProcesando(true);
    setFormError(null);
    try {
      await procesarSolicitud(rechazarSolicitud.id, 'RECHAZAR', motivoRechazo.trim());
      setRechazarSolicitud(null);
      setMotivoRechazo('');
      setDetalleSolicitud(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al rechazar la solicitud.');
    } finally {
      setProcesando(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteSolicitud(confirmDelete.id);
      setData((prev) => prev.filter((r) => r.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al eliminar la solicitud.');
    }
  };

  const columns: Column<SolicitudWithRelations>[] = [
    {
      key: 'numero_solicitud',
      label: 'N° Solicitud',
      sortable: true,
      sortValue: (r) => r.numero_solicitud,
      render: (r) => <span className="font-medium text-neutral-900">{r.numero_solicitud}</span>,
    },
    {
      key: 'created_at',
      label: 'Fecha',
      sortable: true,
      sortValue: (r) => r.created_at,
      render: (r) => <span className="text-neutral-700">{formatDateTime(r.created_at)}</span>,
    },
    {
      key: 'trabajador_nombre',
      label: 'Trabajador',
      sortable: true,
      sortValue: (r) => r.trabajador_nombre,
      render: (r) => (
        <div>
          <p className="font-medium text-neutral-900">{r.trabajador_nombre}</p>
          <p className="text-xs text-neutral-400">DNI: {r.trabajador_dni}</p>
        </div>
      ),
    },
    {
      key: 'epp_nombre',
      label: 'EPP',
      sortable: true,
      sortValue: (r) => r.epp_nombre,
      render: (r) => (
        <div>
          <p className="font-medium text-neutral-900">{r.epp_nombre}</p>
          <p className="text-xs text-neutral-400">{r.epp_codigo}{r.talla ? ` · Talla: ${r.talla}` : ''}</p>
        </div>
      ),
    },
    {
      key: 'cantidad',
      label: 'Cant.',
      sortable: true,
      sortValue: (r) => r.cantidad,
      render: (r) => <span className="text-neutral-700">{r.cantidad}</span>,
    },
    {
      key: 'sede_nombre',
      label: 'Sede',
      sortable: true,
      sortValue: (r) => r.sede_nombre,
      render: (r) => <span className="text-neutral-700">{r.sede_nombre}</span>,
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      sortValue: (r) => r.estado,
      render: (r) => (
        <Badge variant={ESTADO_VARIANTS[r.estado]}>{ESTADO_LABELS[r.estado]}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Solicitudes de EPP</h1>
            <p className="mt-0.5 text-sm text-neutral-500">Gestión y aprobación de solicitudes de Equipos de Protección Personal</p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nueva solicitud
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:max-w-xs">
          <Select
            label="Filtrar por estado"
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="APROBADA">Aprobada</option>
            <option value="RECHAZADA">Rechazada</option>
          </Select>
        </div>
        <div className="w-full sm:max-w-xs">
          <Select
            label="Filtrar por sede"
            value={sedeFilter}
            onChange={(e) => setSedeFilter(e.target.value)}
          >
            <option value="all">Todas las sedes</option>
            {sedes.map((s) => (
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

      {loading ? (
        <LoadingState message="Cargando solicitudes..." />
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin solicitudes"
            description="Aún no hay solicitudes registradas. Crea la primera para comenzar."
            action={
              canCreate ? (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Nueva solicitud
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
            searchKeys={['numero_solicitud', 'trabajador_nombre', 'trabajador_dni', 'epp_nombre', 'epp_codigo']}
            rowKey={(r) => r.id}
            actions={(row) => (
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setDetalleSolicitud(row)}
                  className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-primary-600"
                  title="Ver detalle"
                >
                  <Eye className="h-4 w-4" />
                </button>
                {canApprove && row.estado === 'PENDIENTE' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleAprobar(row)}
                      className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-success-50 hover:text-success-600"
                      title="Aprobar"
                      disabled={procesando}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRechazarSolicitud(row);
                        setMotivoRechazo('');
                        setFormError(null);
                      }}
                      className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-error-50 hover:text-error-600"
                      title="Rechazar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(row)}
                    className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-error-600"
                    title="Eliminar"
                  >
                    <Plus className="h-4 w-4 rotate-45" />
                  </button>
                )}
              </div>
            )}
          />
        </Card>
      )}

      {/* Modal: Nueva solicitud */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nueva solicitud de EPP"
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
              label="Trabajador *"
              value={form.trabajador_id}
              onChange={(e) => handleTrabajadorChange(e.target.value)}
              disabled={isTrabajador}
            >
              <option value="">Seleccionar trabajador...</option>
              {(isTrabajador && miTrabajador ? [miTrabajador] : trabajadores)
                .filter((t) => t.activo)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.apellidos}, {t.nombres} — {t.dni}
                  </option>
                ))}
            </Select>
            <Select
              label="EPP *"
              value={form.epp_id}
              onChange={(e) => setForm({ ...form, epp_id: e.target.value })}
            >
              <option value="">Seleccionar EPP...</option>
              {catalogoEPP
                .filter((e) => e.activo)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.codigo} — {e.nombre}
                  </option>
                ))}
            </Select>
          </div>

          {selectedEpp && (
            <div className="flex flex-wrap gap-2">
              {selectedEpp.talla_requerida && <Badge variant="info">Requiere talla</Badge>}
              {selectedEpp.lote_requerido && <Badge variant="info">Requiere lote</Badge>}
              <Badge variant="neutral">{selectedEpp.unidad_medida}</Badge>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {selectedEpp?.talla_requerida ? (
              <Input
                label="Talla *"
                value={form.talla ?? ''}
                onChange={(e) => setForm({ ...form, talla: e.target.value })}
                placeholder="Ej. M, L, XL"
              />
            ) : (
              <Input
                label="Talla"
                value={form.talla ?? ''}
                onChange={(e) => setForm({ ...form, talla: e.target.value })}
                placeholder="Opcional"
              />
            )}
            <Input
              label="Cantidad *"
              type="number"
              min={1}
              value={form.cantidad}
              onChange={(e) => setForm({ ...form, cantidad: Number(e.target.value) })}
            />
          </div>

          {selectedTrabajador && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
              Sede del trabajador: <span className="font-medium text-neutral-800">{selectedTrabajador.sede_nombre}</span>
            </div>
          )}

          <Input
            label="Motivo"
            value={form.motivo ?? ''}
            onChange={(e) => setForm({ ...form, motivo: e.target.value })}
            placeholder="Motivo de la solicitud (opcional)"
          />
          <Textarea
            label="Observaciones"
            value={form.observacion ?? ''}
            onChange={(e) => setForm({ ...form, observacion: e.target.value })}
            placeholder="Observaciones adicionales (opcional)"
            rows={2}
          />
        </div>
      </Modal>

      {/* Modal: Detalle de solicitud */}
      <Modal
        open={detalleSolicitud !== null}
        onClose={() => setDetalleSolicitud(null)}
        title="Detalle de solicitud"
        size="lg"
        footer={
          detalleSolicitud && canApprove && detalleSolicitud.estado === 'PENDIENTE' ? (
            <>
              <Button variant="outline" onClick={() => setDetalleSolicitud(null)}>Cerrar</Button>
              <Button
                variant="success"
                onClick={() => handleAprobar(detalleSolicitud)}
                loading={procesando}
              >
                <Check className="h-4 w-4" />
                Aprobar
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setRechazarSolicitud(detalleSolicitud);
                  setMotivoRechazo('');
                  setFormError(null);
                }}
              >
                <X className="h-4 w-4" />
                Rechazar
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setDetalleSolicitud(null)}>Cerrar</Button>
          )
        }
      >
        {detalleSolicitud && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-neutral-900">{detalleSolicitud.numero_solicitud}</p>
                <p className="text-sm text-neutral-500">{formatDateTime(detalleSolicitud.created_at)}</p>
              </div>
              <Badge variant={ESTADO_VARIANTS[detalleSolicitud.estado]}>{ESTADO_LABELS[detalleSolicitud.estado]}</Badge>
            </div>

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-neutral-500">Trabajador</dt>
                <dd className="text-sm font-medium text-neutral-800">{detalleSolicitud.trabajador_nombre}</dd>
                <dd className="text-xs text-neutral-400">DNI: {detalleSolicitud.trabajador_dni}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-neutral-500">EPP solicitado</dt>
                <dd className="text-sm font-medium text-neutral-800">{detalleSolicitud.epp_nombre}</dd>
                <dd className="text-xs text-neutral-400">{detalleSolicitud.epp_codigo}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-neutral-500">Sede</dt>
                <dd className="text-sm font-medium text-neutral-800">{detalleSolicitud.sede_nombre}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-neutral-500">Cantidad</dt>
                <dd className="text-sm font-medium text-neutral-800">{detalleSolicitud.cantidad}</dd>
              </div>
              {detalleSolicitud.talla && (
                <div>
                  <dt className="text-xs font-medium text-neutral-500">Talla</dt>
                  <dd className="text-sm font-medium text-neutral-800">{detalleSolicitud.talla}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium text-neutral-500">Solicitado por</dt>
                <dd className="text-sm font-medium text-neutral-800">{detalleSolicitud.solicitado_nombre}</dd>
              </div>
              {detalleSolicitud.motivo && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-neutral-500">Motivo</dt>
                  <dd className="text-sm text-neutral-700">{detalleSolicitud.motivo}</dd>
                </div>
              )}
              {detalleSolicitud.observacion && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-neutral-500">Observaciones</dt>
                  <dd className="text-sm text-neutral-700">{detalleSolicitud.observacion}</dd>
                </div>
              )}
              {detalleSolicitud.estado !== 'PENDIENTE' && (
                <>
                  <div>
                    <dt className="text-xs font-medium text-neutral-500">Procesado por</dt>
                    <dd className="text-sm font-medium text-neutral-800">{detalleSolicitud.aprobado_nombre}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-neutral-500">Fecha de procesamiento</dt>
                    <dd className="text-sm font-medium text-neutral-800">{formatDateTime(detalleSolicitud.fecha_aprobacion)}</dd>
                  </div>
                </>
              )}
              {detalleSolicitud.estado === 'RECHAZADA' && detalleSolicitud.motivo_rechazo && (
                <div className="sm:col-span-2 rounded-lg border border-error-200 bg-error-50 p-3">
                  <dt className="text-xs font-medium text-error-600">Motivo de rechazo</dt>
                  <dd className="mt-1 text-sm text-error-800">{detalleSolicitud.motivo_rechazo}</dd>
                </div>
              )}
              {detalleSolicitud.entrega_id && detalleSolicitud.entrega_numero && (
                <div className="sm:col-span-2 rounded-lg border border-success-200 bg-success-50/50 p-3">
                  <div className="flex items-center gap-2">
                    <PackageCheck className="h-4 w-4 text-success-600" />
                    <dt className="text-xs font-bold uppercase tracking-wide text-success-700">Entrega generada</dt>
                  </div>
                  <dd className="mt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDetalleSolicitud(null);
                        navigate(`/entregas?open=${detalleSolicitud.entrega_id}`);
                      }}
                      className="text-sm font-bold text-success-700 underline decoration-success-300 underline-offset-2 transition-colors hover:text-success-800 hover:decoration-success-500"
                    >
                      {detalleSolicitud.entrega_numero}
                    </button>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </Modal>

      {/* Modal: Rechazar solicitud */}
      <Modal
        open={rechazarSolicitud !== null}
        onClose={() => {
          setRechazarSolicitud(null);
          setMotivoRechazo('');
          setFormError(null);
        }}
        title="Rechazar solicitud"
        description={rechazarSolicitud ? `Solicitud ${rechazarSolicitud.numero_solicitud}` : ''}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => {
              setRechazarSolicitud(null);
              setMotivoRechazo('');
              setFormError(null);
            }}>Cancelar</Button>
            <Button variant="danger" onClick={handleRechazar} loading={procesando}>
              Rechazar solicitud
            </Button>
          </>
        }
      >
        {formError && (
          <div className="mb-4">
            <Alert variant="error">{formError}</Alert>
          </div>
        )}
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">
            Debe ingresar el motivo del rechazo. Este campo es obligatorio.
          </p>
          <Textarea
            label="Motivo de rechazo *"
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            placeholder="Explique el motivo del rechazo..."
            rows={3}
          />
        </div>
      </Modal>

      {/* Confirmar eliminación */}
      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Eliminar solicitud"
        message={
          confirmDelete
            ? `¿Seguro que deseas eliminar la solicitud ${confirmDelete.numero_solicitud}? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        variant="danger"
      />
    </div>
  );
}
