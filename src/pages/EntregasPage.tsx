import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileSignature,
  Eye,
  Check,
  X,
  Plus,
  PackageCheck,
  AlertTriangle,
  PenLine,
  CheckCircle2,
  Clock,
  FileText,
  Printer,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/StateDisplay';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { RegistroSSTDocument } from '@/components/registro-sst/RegistroSSTDocument';
import { useAuthz } from '@/hooks/useAuthz';
import { useAuth } from '@/hooks/useAuth';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import { formatDateTime } from '@/lib/format';
import {
  fetchEntregas,
  fetchSolicitudesAprobadas,
  generarEntregaDesdeSolicitud,
  generarEntregaDirecta,
  cambiarEstadoEntrega,
  confirmarEntrega,
  cancelarEntrega,
  fetchFirmasByEntrega,
  registrarFirma,
  generarRegistroSST,
  fetchRegistroSST,
} from '@/services/entregas.service';
import { fetchWithCache } from '@/lib/data-cache';
import { fetchTrabajadores, fetchSedes } from '@/services/maestros.service';
import { fetchCatalogoEPP } from '@/services/catalogo.service';
import type {
  EntregaWithRelations,
  EstadoEntrega,
  EntregaInsert,
} from '@/types/entregas.types';
import type { SolicitudWithRelations } from '@/types/solicitudes.types';
import type { TrabajadorWithRelations, Sede } from '@/types/maestros.types';
import type { CatalogoEPP } from '@/types/catalogo.types';
import type { EntregaFirmaWithRelations, TipoFirma } from '@/types/firma.types';
import type { RegistroSST } from '@/types/registro-sst.types';

const ESTADO_VARIANTS: Record<EstadoEntrega, 'neutral' | 'info' | 'warning' | 'success' | 'error'> = {
  GENERADA: 'neutral',
  EN_PREPARACION: 'info',
  EN_ESPERA_STOCK: 'warning',
  ENTREGADA_PENDIENTE_FIRMA: 'warning',
  FIRMADA_TRABAJADOR: 'info',
  FIRMADA_COMPLETA: 'success',
  CANCELADA: 'error',
};

const ESTADO_LABELS: Record<EstadoEntrega, string> = {
  GENERADA: 'Generada',
  EN_PREPARACION: 'En preparación',
  EN_ESPERA_STOCK: 'En espera de stock',
  ENTREGADA_PENDIENTE_FIRMA: 'Pendiente de firma',
  FIRMADA_TRABAJADOR: 'Firmada por trabajador',
  FIRMADA_COMPLETA: 'Firmada completa',
  CANCELADA: 'Cancelada',
};

const EMPTY_DIRECTA: EntregaInsert = {
  solicitud_id: null,
  trabajador_id: '',
  epp_id: '',
  sede_id: '',
  talla: null,
  cantidad_entregada: 1,
  cantidad_autorizada: 1,
  observacion: null,
};

export function EntregasPage() {
  const { hasPermission } = useAuthz();
  const canManage = hasPermission('entregas.manage');
  const canFirmas = hasPermission('firmas.manage');
  const { profile } = useAuth();
  const { isOffline, enqueueOperation } = useSyncQueue();

  const [data, setData] = useState<EntregaWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [estadoFilter, setEstadoFilter] = useState<string>('all');
  const [sedeFilter, setSedeFilter] = useState<string>('all');

  const [detalleEntrega, setDetalleEntrega] = useState<EntregaWithRelations | null>(null);
  const [confirmarEntregaRow, setConfirmarEntregaRow] = useState<EntregaWithRelations | null>(null);
  const [cancelarEntregaRow, setCancelarEntregaRow] = useState<EntregaWithRelations | null>(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [solicitudesAprobadas, setSolicitudesAprobadas] = useState<SolicitudWithRelations[]>([]);
  const [trabajadores, setTrabajadores] = useState<TrabajadorWithRelations[]>([]);
  const [catalogoEPP, setCatalogoEPP] = useState<CatalogoEPP[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);

  const [modalOrigenOpen, setModalOrigenOpen] = useState(false);
  const [modalDirectaOpen, setModalDirectaOpen] = useState(false);
  const [directaForm, setDirectaForm] = useState<EntregaInsert>(EMPTY_DIRECTA);
  const [saving, setSaving] = useState(false);

  const [firmas, setFirmas] = useState<EntregaFirmaWithRelations[]>([]);
  const [firmasLoading, setFirmasLoading] = useState(false);
  const [firmaTrabajadorData, setFirmaTrabajadorData] = useState<string | null>(null);
  const [firmaResponsableData, setFirmaResponsableData] = useState<string | null>(null);
  const [firmaTrabajadorNombre, setFirmaTrabajadorNombre] = useState('');
  const [firmaResponsableNombre, setFirmaResponsableNombre] = useState('');
  const [firmaError, setFirmaError] = useState<string | null>(null);
  const [firmaSuccess, setFirmaSuccess] = useState<string | null>(null);
  const [savingFirma, setSavingFirma] = useState(false);
  const prevEntregaIdRef = useRef<string | null>(null);

  const [registroSST, setRegistroSST] = useState<RegistroSST | null>(null);
  const [registroSSTLoading, setRegistroSSTLoading] = useState(false);
  const [registroSSTError, setRegistroSSTError] = useState<string | null>(null);
  const [modalRegistroSSTOpen, setModalRegistroSSTOpen] = useState(false);
  const [generandoSST, setGenerandoSST] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const openParamRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [items, trabs, epps, sds] = await Promise.all([
        fetchWithCache('entregas', () => fetchEntregas()),
        fetchWithCache('trabajadores', () => fetchTrabajadores()),
        fetchWithCache('catalogo_epp', () => fetchCatalogoEPP()),
        fetchWithCache('sedes', () => fetchSedes()),
      ]);
      setData(items);
      setTrabajadores(trabs);
      setCatalogoEPP(epps);
      setSedes(sds as Sede[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar las entregas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId && openId !== openParamRef.current && !loading && data.length > 0) {
      const found = data.find((e) => e.id === openId);
      if (found) {
        setDetalleEntrega(found);
        openParamRef.current = openId;
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, data, loading, setSearchParams]);

  const filtered = useMemo(() => {
    return data.filter((d) => {
      if (estadoFilter !== 'all' && d.estado !== estadoFilter) return false;
      if (sedeFilter !== 'all' && d.sede_id !== sedeFilter) return false;
      return true;
    });
  }, [data, estadoFilter, sedeFilter]);

  const openGenerarDesdeSolicitud = async () => {
    setModalOrigenOpen(true);
    setFormError(null);
    if (isOffline) {
      setSolicitudesAprobadas([]);
      setFormError('Sin conexión. La generación desde solicitud no está disponible en modo offline.');
      return;
    }
    try {
      const sols = await fetchSolicitudesAprobadas();
      setSolicitudesAprobadas(sols);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al cargar solicitudes aprobadas.');
    }
  };

  const handleGenerarDesdeSolicitud = async (solicitud: SolicitudWithRelations) => {
    setProcesando(true);
    setFormError(null);
    try {
      await generarEntregaDesdeSolicitud(solicitud.id);
      setModalOrigenOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al generar la entrega.');
    } finally {
      setProcesando(false);
    }
  };

  const openGenerarDirecta = () => {
    setDirectaForm({ ...EMPTY_DIRECTA });
    setFormError(null);
    setModalDirectaOpen(true);
  };

  const handleTrabajadorChange = (trabajadorId: string) => {
    const trab = trabajadores.find((t) => t.id === trabajadorId);
    setDirectaForm((prev) => ({
      ...prev,
      trabajador_id: trabajadorId,
      sede_id: trab?.sede_id ?? '',
    }));
  };

  const selectedEpp = useMemo(
    () => catalogoEPP.find((e) => e.id === directaForm.epp_id),
    [catalogoEPP, directaForm.epp_id]
  );

  const handleGuardarDirecta = async () => {
    if (!directaForm.trabajador_id) {
      setFormError('Debe seleccionar un trabajador.');
      return;
    }
    if (!directaForm.epp_id) {
      setFormError('Debe seleccionar un EPP.');
      return;
    }
    if (!directaForm.cantidad_entregada || directaForm.cantidad_entregada <= 0) {
      setFormError('La cantidad debe ser mayor que cero.');
      return;
    }
    if (selectedEpp?.talla_requerida && !directaForm.talla?.trim()) {
      setFormError('Este EPP requiere talla. Debe ingresarla.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload: EntregaInsert = {
        ...directaForm,
        talla: directaForm.talla?.trim() || null,
        cantidad_autorizada: directaForm.cantidad_entregada,
        observacion: directaForm.observacion?.trim() || null,
      };
      if (isOffline) {
        await enqueueOperation('registrar_entrega', 'Entregas', payload as unknown as Record<string, unknown>);
        setModalDirectaOpen(false);
      } else {
        await generarEntregaDirecta(payload);
        setModalDirectaOpen(false);
        await load();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al crear la entrega.');
    } finally {
      setSaving(false);
    }
  };

  const handlePreparar = async (row: EntregaWithRelations) => {
    setActionError(null);
    try {
      await cambiarEstadoEntrega(row.id, 'EN_PREPARACION');
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al cambiar el estado.');
    }
  };

  const handleConfirmar = async () => {
    if (!confirmarEntregaRow) return;
    setProcesando(true);
    setActionError(null);
    try {
      const result = await confirmarEntrega(confirmarEntregaRow.id);
      if (result.estado === 'EN_ESPERA_STOCK') {
        setActionError(`Stock insuficiente para ${result.numero_entrega}. Stock disponible: ${result.stock_disponible}. La entrega pasó a "En espera de stock".`);
      }
      setConfirmarEntregaRow(null);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al confirmar la entrega.');
    } finally {
      setProcesando(false);
    }
  };

  const handleCancelar = async () => {
    if (!cancelarEntregaRow) return;
    if (!motivoCancelacion.trim()) {
      setFormError('El motivo de cancelación es obligatorio.');
      return;
    }
    setProcesando(true);
    setFormError(null);
    try {
      await cancelarEntrega(cancelarEntregaRow.id, motivoCancelacion.trim());
      setCancelarEntregaRow(null);
      setMotivoCancelacion('');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al cancelar la entrega.');
    } finally {
      setProcesando(false);
    }
  };

  const loadFirmas = useCallback(async (entregaId: string) => {
    setFirmasLoading(true);
    setFirmaError(null);
    try {
      const data = await fetchFirmasByEntrega(entregaId);
      setFirmas(data);
      const firmaTrab = data.find((f) => f.tipo_firma === 'TRABAJADOR');
      const firmaResp = data.find((f) => f.tipo_firma === 'RESPONSABLE');
      setFirmaTrabajadorNombre(firmaTrab?.nombre_firmante ?? detalleEntrega?.trabajador_nombre ?? '');
      setFirmaResponsableNombre(firmaResp?.nombre_firmante ?? profile?.full_name ?? '');
    } catch (err) {
      setFirmaError(err instanceof Error ? err.message : 'Error al cargar las firmas.');
    } finally {
      setFirmasLoading(false);
    }
  }, [detalleEntrega, profile]);

  useEffect(() => {
    if (detalleEntrega) {
      const isSameEntrega = prevEntregaIdRef.current === detalleEntrega.id;
      prevEntregaIdRef.current = detalleEntrega.id;

      if (!isSameEntrega) {
        setFirmaTrabajadorData(null);
        setFirmaResponsableData(null);
        setFirmaError(null);
        setFirmaSuccess(null);
        setRegistroSST(null);
        setRegistroSSTError(null);
      }
      loadFirmas(detalleEntrega.id);
      if (detalleEntrega.estado === 'FIRMADA_COMPLETA') {
        fetchRegistroSST(detalleEntrega.id)
          .then((r) => setRegistroSST(r))
          .catch(() => { });
      }
    } else {
      prevEntregaIdRef.current = null;
      setFirmas([]);
      setRegistroSST(null);
    }
  }, [detalleEntrega, loadFirmas]);

  const firmaTrabajador = firmas.find((f) => f.tipo_firma === 'TRABAJADOR');
  const firmaResponsable = firmas.find((f) => f.tipo_firma === 'RESPONSABLE');

  const canSignTrabajador = canFirmas
    && detalleEntrega?.estado === 'ENTREGADA_PENDIENTE_FIRMA'
    && !firmaTrabajador;

  const canSignResponsable = canFirmas
    && (detalleEntrega?.estado === 'ENTREGADA_PENDIENTE_FIRMA'
        || detalleEntrega?.estado === 'FIRMADA_TRABAJADOR')
    && !firmaResponsable;

  const handleGuardarFirma = async (tipo: TipoFirma) => {
    if (!detalleEntrega) return;
    const firmaData = tipo === 'TRABAJADOR' ? firmaTrabajadorData : firmaResponsableData;
    const nombre = tipo === 'TRABAJADOR' ? firmaTrabajadorNombre : firmaResponsableNombre;

    if (!firmaData) {
      setFirmaError('Debe dibujar una firma antes de guardar.');
      return;
    }
    if (!nombre.trim()) {
      setFirmaError('Debe ingresar el nombre del firmante.');
      return;
    }

    setSavingFirma(true);
    setFirmaError(null);
    setFirmaSuccess(null);
    try {
      if (isOffline) {
        await enqueueOperation('capturar_firma', 'Entregas', {
          entrega_id: detalleEntrega.id,
          tipo_firma: tipo,
          firma_data: firmaData,
          nombre_firmante: nombre.trim(),
        });
        setFirmaSuccess(`Firma de ${tipo === 'TRABAJADOR' ? 'trabajador' : 'responsable'} guardada offline. Se sincronizará al recuperar conexión.`);
        if (tipo === 'TRABAJADOR') setFirmaTrabajadorData(null);
        else setFirmaResponsableData(null);
      } else {
        const result = await registrarFirma(detalleEntrega.id, tipo, firmaData, nombre.trim());

        const tempFirma: EntregaFirmaWithRelations = {
          id: crypto.randomUUID(),
          entrega_id: detalleEntrega.id,
          tipo_firma: tipo,
          firma_data: firmaData,
          firmado_por: profile?.id ?? null,
          nombre_firmante: nombre.trim(),
          fecha_firma: new Date().toISOString(),
          created_at: new Date().toISOString(),
          firmado_nombre: profile?.full_name ?? '—',
        };
        setFirmas((prev) => {
          const filtered = prev.filter((f) => f.tipo_firma !== tipo);
          return [...filtered, tempFirma];
        });

        if (tipo === 'TRABAJADOR') setFirmaTrabajadorData(null);
        else setFirmaResponsableData(null);

        setFirmaSuccess(`Firma de ${tipo === 'TRABAJADOR' ? 'trabajador' : 'responsable'} guardada correctamente.`);

        void result;

        loadFirmas(detalleEntrega.id).catch(() => { });
        load().catch(() => { });
        fetchEntregas().then((updated) => {
          const refreshed = updated.find((e) => e.id === detalleEntrega.id);
          if (refreshed) setDetalleEntrega(refreshed);
        }).catch(() => { });
      }
    } catch (err) {
      setFirmaError(err instanceof Error ? err.message : 'Error al registrar la firma.');
    } finally {
      setSavingFirma(false);
    }
  };

  const handleAbrirRegistroSST = async () => {
    if (!detalleEntrega) return;
    setRegistroSSTLoading(true);
    setRegistroSSTError(null);
    try {
      const existing = await fetchRegistroSST(detalleEntrega.id);
      if (existing) {
        setRegistroSST(existing);
        setModalRegistroSSTOpen(true);
      } else {
        setGenerandoSST(true);
        const result = await generarRegistroSST(detalleEntrega.id);
        const nuevo = await fetchRegistroSST(detalleEntrega.id);
        setRegistroSST(nuevo);
        setModalRegistroSSTOpen(true);
        void result;
      }
    } catch (err) {
      setRegistroSSTError(err instanceof Error ? err.message : 'Error al generar el Registro SST.');
    } finally {
      setRegistroSSTLoading(false);
      setGenerandoSST(false);
    }
  };

  const columns: Column<EntregaWithRelations>[] = [
    {
      key: 'numero_entrega',
      label: 'N° Entrega',
      sortable: true,
      sortValue: (r) => r.numero_entrega,
      render: (r) => <span className="font-medium text-neutral-900">{r.numero_entrega}</span>,
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
      key: 'cantidad_entregada',
      label: 'Cant.',
      sortable: true,
      sortValue: (r) => r.cantidad_entregada,
      render: (r) => <span className="text-neutral-700">{r.cantidad_entregada}</span>,
    },
    {
      key: 'sede_nombre',
      label: 'Sede',
      sortable: true,
      sortValue: (r) => r.sede_nombre,
      render: (r) => <span className="text-neutral-700">{r.sede_nombre}</span>,
    },
    {
      key: 'solicitud_numero',
      label: 'Origen',
      sortable: true,
      sortValue: (r) => r.solicitud_numero ?? 'zzz',
      render: (r) => (
        <span className="text-sm text-neutral-600">
          {r.solicitud_numero ?? <span className="text-neutral-400">Directa</span>}
        </span>
      ),
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
            <FileSignature className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Entregas de EPP</h1>
            <p className="mt-0.5 text-sm text-neutral-500">Gestión de entregas físicas de Equipos de Protección Personal</p>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={openGenerarDirecta}>
              <Plus className="h-4 w-4" />
              Entrega directa
            </Button>
            <Button onClick={openGenerarDesdeSolicitud}>
              <PackageCheck className="h-4 w-4" />
              Desde solicitud
            </Button>
          </div>
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
            <option value="GENERADA">Generada</option>
            <option value="EN_PREPARACION">En preparación</option>
            <option value="EN_ESPERA_STOCK">En espera de stock</option>
            <option value="ENTREGADA_PENDIENTE_FIRMA">Pendiente de firma</option>
            <option value="FIRMADA_TRABAJADOR">Firmada por trabajador</option>
            <option value="FIRMADA_COMPLETA">Firmada completa</option>
            <option value="CANCELADA">Cancelada</option>
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
        <LoadingState message="Cargando entregas..." />
      ) : error ? (
        <div className="space-y-4">
          <ErrorState onRetry={load} />
          {canManage && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-neutral-500">Puede crear una entrega directa mientras recupera la conexión:</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={openGenerarDirecta}>
                  <Plus className="h-4 w-4" />
                  Entrega directa
                </Button>
                <Button onClick={openGenerarDesdeSolicitud}>
                  <PackageCheck className="h-4 w-4" />
                  Desde solicitud
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : isOffline && filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin entregas cargadas"
            description="No hay conexión al servidor. Los datos se mostrarán al recuperar la conexión. Puede crear una entrega directa mientras tanto."
            action={
              canManage ? (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={openGenerarDirecta}>
                    <Plus className="h-4 w-4" />
                    Entrega directa
                  </Button>
                  <Button onClick={openGenerarDesdeSolicitud}>
                    <PackageCheck className="h-4 w-4" />
                    Desde solicitud
                  </Button>
                </div>
              ) : undefined
            }
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin entregas"
            description="Aún no hay entregas registradas. Genere una desde una solicitud aprobada o cree una entrega directa."
            action={
              canManage ? (
                <Button onClick={openGenerarDesdeSolicitud}>
                  <PackageCheck className="h-4 w-4" />
                  Desde solicitud
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
            searchKeys={['numero_entrega', 'trabajador_nombre', 'trabajador_dni', 'epp_nombre', 'epp_codigo', 'solicitud_numero']}
            rowKey={(r) => r.id}
            actions={(row) => (
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setDetalleEntrega(row)}
                  className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-primary-600"
                  title="Ver detalle"
                >
                  <Eye className="h-4 w-4" />
                </button>
                {canManage && row.estado === 'GENERADA' && (
                  <button
                    type="button"
                    onClick={() => handlePreparar(row)}
                    className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-primary-50 hover:text-primary-600"
                    title="Pasar a preparación"
                  >
                    <PackageCheck className="h-4 w-4" />
                  </button>
                )}
                {canManage && (row.estado === 'EN_PREPARACION' || row.estado === 'EN_ESPERA_STOCK') && (
                  <button
                    type="button"
                    onClick={() => { setConfirmarEntregaRow(row); setActionError(null); }}
                    className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-success-50 hover:text-success-600"
                    title="Confirmar entrega"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
                {canManage && row.estado !== 'ENTREGADA_PENDIENTE_FIRMA' && row.estado !== 'CANCELADA' && (
                  <button
                    type="button"
                    onClick={() => {
                      setCancelarEntregaRow(row);
                      setMotivoCancelacion('');
                      setFormError(null);
                    }}
                    className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-error-50 hover:text-error-600"
                    title="Cancelar entrega"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          />
        </Card>
      )}

      {/* Modal: Generar desde solicitud */}
      <Modal
        open={modalOrigenOpen}
        onClose={() => setModalOrigenOpen(false)}
        title="Generar entrega desde solicitud aprobada"
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setModalOrigenOpen(false)}>Cerrar</Button>
        }
      >
        {formError && (
          <div className="mb-4">
            <Alert variant="error">{formError}</Alert>
          </div>
        )}
        {solicitudesAprobadas.length === 0 ? (
          <div className="py-8 text-center">
            <PackageCheck className="mx-auto h-10 w-10 text-neutral-300" />
            <p className="mt-3 text-sm text-neutral-500">
              No hay solicitudes aprobadas pendientes de entrega.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {solicitudesAprobadas.map((sol) => (
              <div
                key={sol.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 transition-colors hover:border-primary-300 hover:bg-primary-50/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900">{sol.numero_solicitud}</span>
                    <Badge variant="success">Aprobada</Badge>
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">
                    {sol.trabajador_nombre} — {sol.epp_nombre} ({sol.cantidad} und.)
                  </p>
                  <p className="text-xs text-neutral-400">
                    Sede: {sol.sede_nombre} · {formatDateTime(sol.created_at)}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleGenerarDesdeSolicitud(sol)}
                  loading={procesando}
                >
                  Generar
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Modal: Nueva entrega directa */}
      <Modal
        open={modalDirectaOpen}
        onClose={() => setModalDirectaOpen(false)}
        title="Nueva entrega directa"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalDirectaOpen(false)}>Cancelar</Button>
            <Button onClick={handleGuardarDirecta} loading={saving}>Crear entrega</Button>
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
              value={directaForm.trabajador_id}
              onChange={(e) => handleTrabajadorChange(e.target.value)}
            >
              <option value="">Seleccionar trabajador...</option>
              {trabajadores
                .filter((t) => t.activo)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.apellidos}, {t.nombres} — {t.dni}
                  </option>
                ))}
            </Select>
            <Select
              label="EPP *"
              value={directaForm.epp_id}
              onChange={(e) => setDirectaForm({ ...directaForm, epp_id: e.target.value })}
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
              <Badge variant="neutral">{selectedEpp.unidad_medida}</Badge>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {selectedEpp?.talla_requerida ? (
              <Input
                label="Talla *"
                value={directaForm.talla ?? ''}
                onChange={(e) => setDirectaForm({ ...directaForm, talla: e.target.value })}
                placeholder="Ej. M, L, XL"
              />
            ) : (
              <Input
                label="Talla"
                value={directaForm.talla ?? ''}
                onChange={(e) => setDirectaForm({ ...directaForm, talla: e.target.value })}
                placeholder="Opcional"
              />
            )}
            <Input
              label="Cantidad *"
              type="number"
              min={1}
              value={directaForm.cantidad_entregada}
              onChange={(e) => setDirectaForm({ ...directaForm, cantidad_entregada: Number(e.target.value) })}
            />
          </div>

          <Textarea
            label="Observaciones"
            value={directaForm.observacion ?? ''}
            onChange={(e) => setDirectaForm({ ...directaForm, observacion: e.target.value })}
            placeholder="Observaciones adicionales (opcional)"
            rows={2}
          />
        </div>
      </Modal>

      {/* Modal: Detalle de entrega */}
      <Modal
        open={detalleEntrega !== null}
        onClose={() => setDetalleEntrega(null)}
        title="Detalle de entrega"
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setDetalleEntrega(null)}>Cerrar</Button>
        }
      >
        {detalleEntrega && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-neutral-900">{detalleEntrega.numero_entrega}</p>
                <p className="text-sm text-neutral-500">{formatDateTime(detalleEntrega.created_at)}</p>
              </div>
              <Badge variant={ESTADO_VARIANTS[detalleEntrega.estado]}>
                {ESTADO_LABELS[detalleEntrega.estado]}
              </Badge>
            </div>

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-neutral-500">Trabajador</dt>
                <dd className="text-sm font-medium text-neutral-800">{detalleEntrega.trabajador_nombre}</dd>
                <dd className="text-xs text-neutral-400">DNI: {detalleEntrega.trabajador_dni}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-neutral-500">EPP</dt>
                <dd className="text-sm font-medium text-neutral-800">{detalleEntrega.epp_nombre}</dd>
                <dd className="text-xs text-neutral-400">{detalleEntrega.epp_codigo}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-neutral-500">Sede</dt>
                <dd className="text-sm font-medium text-neutral-800">{detalleEntrega.sede_nombre}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-neutral-500">Cantidad entregada</dt>
                <dd className="text-sm font-medium text-neutral-800">{detalleEntrega.cantidad_entregada}</dd>
              </div>
              {detalleEntrega.talla && (
                <div>
                  <dt className="text-xs font-medium text-neutral-500">Talla</dt>
                  <dd className="text-sm font-medium text-neutral-800">{detalleEntrega.talla}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium text-neutral-500">Solicitud de origen</dt>
                <dd className="text-sm font-medium text-neutral-800">
                  {detalleEntrega.solicitud_numero ?? 'Entrega directa'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-neutral-500">Generada por</dt>
                <dd className="text-sm font-medium text-neutral-800">{detalleEntrega.generado_nombre}</dd>
              </div>
              {(detalleEntrega.estado === 'ENTREGADA_PENDIENTE_FIRMA' || detalleEntrega.estado === 'FIRMADA_TRABAJADOR' || detalleEntrega.estado === 'FIRMADA_COMPLETA') && (
                <>
                  <div>
                    <dt className="text-xs font-medium text-neutral-500">Confirmada por</dt>
                    <dd className="text-sm font-medium text-neutral-800">{detalleEntrega.confirmado_nombre}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-neutral-500">Fecha de confirmación</dt>
                    <dd className="text-sm font-medium text-neutral-800">{formatDateTime(detalleEntrega.fecha_confirmacion)}</dd>
                  </div>
                  {detalleEntrega.precio_historico !== null && (
                    <div>
                      <dt className="text-xs font-medium text-neutral-500">Precio histórico</dt>
                      <dd className="text-sm font-medium text-neutral-800">
                        S/ {detalleEntrega.precio_historico.toFixed(2)}
                      </dd>
                    </div>
                  )}
                  {detalleEntrega.kardex_id && (
                    <div>
                      <dt className="text-xs font-medium text-neutral-500">Movimiento Kardex</dt>
                      <dd className="text-sm font-medium text-neutral-800">
                        {detalleEntrega.kardex_id.slice(0, 8)}...
                      </dd>
                    </div>
                  )}
                </>
              )}
              {detalleEntrega.observacion && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-neutral-500">Observaciones</dt>
                  <dd className="text-sm text-neutral-700">{detalleEntrega.observacion}</dd>
                </div>
              )}
              {detalleEntrega.estado === 'CANCELADA' && detalleEntrega.motivo_cancelacion && (
                <div className="sm:col-span-2 rounded-lg border border-error-200 bg-error-50 p-3">
                  <dt className="text-xs font-medium text-error-600">Motivo de cancelación</dt>
                  <dd className="mt-1 text-sm text-error-800">{detalleEntrega.motivo_cancelacion}</dd>
                </div>
              )}
              {(detalleEntrega.estado === 'EN_PREPARACION' || detalleEntrega.estado === 'EN_ESPERA_STOCK' || detalleEntrega.estado === 'GENERADA') && (
                <div className="sm:col-span-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                  <dt className="text-xs font-medium text-neutral-500">Stock disponible en sede</dt>
                  <dd className="mt-1 flex items-center gap-2">
                    {detalleEntrega.stock_disponible >= detalleEntrega.cantidad_entregada ? (
                      <>
                        <span className="text-sm font-medium text-success-700">
                          {detalleEntrega.stock_disponible} und. — Suficiente
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 text-warning-600" />
                        <span className="text-sm font-medium text-warning-700">
                          {detalleEntrega.stock_disponible} und. — Insuficiente (necesita {detalleEntrega.cantidad_entregada})
                        </span>
                      </>
                    )}
                  </dd>
                </div>
              )}
            </dl>

            {(detalleEntrega.estado === 'ENTREGADA_PENDIENTE_FIRMA' || detalleEntrega.estado === 'FIRMADA_TRABAJADOR' || detalleEntrega.estado === 'FIRMADA_COMPLETA') && (
              <div className="border-t border-neutral-200 pt-4">
                <div className="mb-3 flex items-center gap-2">
                  <PenLine className="h-4 w-4 text-primary-600" />
                  <h3 className="text-sm font-semibold text-neutral-900">Firmas de la entrega</h3>
                </div>

                {firmaError && (
                  <div className="mb-3">
                    <Alert variant="error" onClose={() => setFirmaError(null)}>{firmaError}</Alert>
                  </div>
                )}

                {firmaSuccess && (
                  <div className="mb-3">
                    <Alert variant="success" onClose={() => setFirmaSuccess(null)}>{firmaSuccess}</Alert>
                  </div>
                )}

                {firmasLoading ? (
                  <LoadingState message="Cargando firmas..." />
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Firma del Trabajador */}
                    <div className={`rounded-lg border p-4 ${firmaTrabajador ? 'border-success-200 bg-success-50/30' : 'border-neutral-200'}`}>
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-neutral-800">Firma del trabajador</span>
                        </div>
                        {firmaTrabajador ? (
                          <Badge variant="success" icon={<CheckCircle2 className="h-3 w-3" />}>Firmada</Badge>
                        ) : (
                          <Badge variant="warning" icon={<Clock className="h-3 w-3" />}>Pendiente</Badge>
                        )}
                      </div>

                      {firmaTrabajador ? (
                        <div className="space-y-2">
                          <div className="rounded-md border border-neutral-200 bg-white p-2">
                            <img src={firmaTrabajador.firma_data} alt="Firma del trabajador" className="h-20 w-full object-contain" />
                          </div>
                          <div className="space-y-1 text-xs text-neutral-500">
                            <p><span className="font-medium text-neutral-700">Firmante:</span> {firmaTrabajador.nombre_firmante}</p>
                            <p><span className="font-medium text-neutral-700">Fecha:</span> {formatDateTime(firmaTrabajador.fecha_firma)}</p>
                            <p><span className="font-medium text-neutral-700">Capturada por:</span> {firmaTrabajador.firmado_nombre}</p>
                          </div>
                        </div>
                      ) : canSignTrabajador ? (
                        <div className="space-y-3">
                          <Input
                            label="Nombre del trabajador"
                            value={firmaTrabajadorNombre}
                            onChange={(e) => setFirmaTrabajadorNombre(e.target.value)}
                            placeholder="Nombre completo del trabajador"
                          />
                          <SignaturePad
                            key={`sig-trab-${detalleEntrega.id}`}
                            value={firmaTrabajadorData}
                            onChange={setFirmaTrabajadorData}
                          />
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => handleGuardarFirma('TRABAJADOR')}
                            loading={savingFirma}
                            disabled={!firmaTrabajadorData}
                          >
                            <PenLine className="h-4 w-4" />
                            Firmar trabajador
                          </Button>
                          <p className="text-center text-xs text-neutral-400">
                            Pulse este botón para guardar la firma en la base de datos
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-6 text-sm text-neutral-400">
                          Sin firma registrada
                        </div>
                      )}
                    </div>

                    {/* Firma del Responsable */}
                    <div className={`rounded-lg border p-4 ${firmaResponsable ? 'border-success-200 bg-success-50/30' : 'border-neutral-200'}`}>
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-neutral-800">Firma del responsable</span>
                        </div>
                        {firmaResponsable ? (
                          <Badge variant="success" icon={<CheckCircle2 className="h-3 w-3" />}>Firmada</Badge>
                        ) : (
                          <Badge variant="warning" icon={<Clock className="h-3 w-3" />}>Pendiente</Badge>
                        )}
                      </div>

                      {firmaResponsable ? (
                        <div className="space-y-2">
                          <div className="rounded-md border border-neutral-200 bg-white p-2">
                            <img src={firmaResponsable.firma_data} alt="Firma del responsable" className="h-20 w-full object-contain" />
                          </div>
                          <div className="space-y-1 text-xs text-neutral-500">
                            <p><span className="font-medium text-neutral-700">Firmante:</span> {firmaResponsable.nombre_firmante}</p>
                            <p><span className="font-medium text-neutral-700">Fecha:</span> {formatDateTime(firmaResponsable.fecha_firma)}</p>
                            <p><span className="font-medium text-neutral-700">Capturada por:</span> {firmaResponsable.firmado_nombre}</p>
                          </div>
                        </div>
                      ) : canSignResponsable ? (
                        <div className="space-y-3">
                          <Input
                            label="Nombre del responsable"
                            value={firmaResponsableNombre}
                            onChange={(e) => setFirmaResponsableNombre(e.target.value)}
                            placeholder="Nombre completo del responsable"
                          />
                          <SignaturePad
                            key={`sig-resp-${detalleEntrega.id}`}
                            value={firmaResponsableData}
                            onChange={setFirmaResponsableData}
                          />
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => handleGuardarFirma('RESPONSABLE')}
                            loading={savingFirma}
                            disabled={!firmaResponsableData}
                          >
                            <PenLine className="h-4 w-4" />
                            Firmar responsable
                          </Button>
                          <p className="text-center text-xs text-neutral-400">
                            Pulse este botón para guardar la firma en la base de datos
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-6 text-sm text-neutral-400">
                          {detalleEntrega.estado === 'ENTREGADA_PENDIENTE_FIRMA'
                            ? 'Pendiente firma del trabajador'
                            : 'Sin firma registrada'}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {detalleEntrega.estado === 'FIRMADA_COMPLETA' && canFirmas && (
              <div className="border-t border-neutral-200 pt-4">
                {registroSSTError && (
                  <div className="mb-3">
                    <Alert variant="error" onClose={() => setRegistroSSTError(null)}>{registroSSTError}</Alert>
                  </div>
                )}
                <div className="flex items-center justify-between rounded-lg border border-primary-200 bg-primary-50/30 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                      <FileText className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">Registro SST / RM050</p>
                      <p className="text-xs text-neutral-500">
                        {registroSST ? 'Documento generado y disponible' : 'Genere el documento a partir de los datos de esta entrega'}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleAbrirRegistroSST}
                    loading={registroSSTLoading || generandoSST}
                  >
                    <FileText className="h-4 w-4" />
                    {registroSST ? 'Ver registro' : 'Generar registro'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal: Confirmar entrega */}
      <ConfirmDialog
        open={confirmarEntregaRow !== null}
        onClose={() => setConfirmarEntregaRow(null)}
        onConfirm={handleConfirmar}
        title="Confirmar entrega"
        message={
          confirmarEntregaRow
            ? `¿Confirmar la entrega ${confirmarEntregaRow.numero_entrega}? Se descontará ${confirmarEntregaRow.cantidad_entregada} und. del inventario y se generará el movimiento de kardex correspondiente.`
            : ''
        }
        confirmLabel="Confirmar entrega"
        variant="success"
      />

      {/* Modal: Cancelar entrega */}
      <Modal
        open={cancelarEntregaRow !== null}
        onClose={() => {
          setCancelarEntregaRow(null);
          setMotivoCancelacion('');
          setFormError(null);
        }}
        title="Cancelar entrega"
        description={cancelarEntregaRow ? `Entrega ${cancelarEntregaRow.numero_entrega}` : ''}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => {
              setCancelarEntregaRow(null);
              setMotivoCancelacion('');
              setFormError(null);
            }}>Cancelar</Button>
            <Button variant="danger" onClick={handleCancelar} loading={procesando}>
              Cancelar entrega
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
            Debe ingresar el motivo de cancelación. Esta acción no se puede deshacer.
            No se realizará ningún descuento de inventario.
          </p>
          <Textarea
            label="Motivo de cancelación *"
            value={motivoCancelacion}
            onChange={(e) => setMotivoCancelacion(e.target.value)}
            placeholder="Explique el motivo de cancelación..."
            rows={3}
          />
        </div>
      </Modal>

      {/* Modal: Registro SST / RM050 */}
      <Modal
        open={modalRegistroSSTOpen}
        onClose={() => setModalRegistroSSTOpen(false)}
        title="Registro SST / RM050"
        description={registroSST ? `${registroSST.codigo_documento} · v${registroSST.version_documento}` : ''}
        size="xl"
        footer={
          <>
            <Button variant="primary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Descargar PDF
            </Button>
            <Button variant="outline" onClick={() => setModalRegistroSSTOpen(false)}>Cerrar</Button>
          </>
        }
      >
        {registroSST ? (
          <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
            <RegistroSSTDocument registro={registroSST} />
          </div>
        ) : (
          <LoadingState message="Cargando registro..." />
        )}
      </Modal>
    </div>
  );
}
