import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Eye, ExternalLink, ArrowRight, Calendar, MapPin, Layers, Users, Package } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/StateDisplay';
import { useAuthz } from '@/hooks/useAuthz';
import { formatDate } from '@/lib/format';
import { fetchHistorialEPP, renovarEPP, type HistorialFilters } from '@/services/historial.service';
import { fetchSedes, fetchAreas, fetchTrabajadores } from '@/services/maestros.service';
import { fetchCatalogoEPP } from '@/services/catalogo.service';
import { fetchWithCache } from '@/lib/data-cache';
import type { HistorialEPP, EstadoVigencia } from '@/types/historial.types';
import type { Sede, Area, TrabajadorWithRelations } from '@/types/maestros.types';
import type { CatalogoEPP } from '@/types/catalogo.types';

const VIGENCIA_VARIANTS: Record<EstadoVigencia, 'success' | 'warning' | 'error' | 'info'> = {
  VIGENTE: 'success',
  POR_VENCER: 'warning',
  VENCIDO: 'error',
  RENOVADO: 'info',
};

const VIGENCIA_LABELS: Record<EstadoVigencia, string> = {
  VIGENTE: 'Vigente',
  POR_VENCER: 'Por vencer',
  VENCIDO: 'Vencido',
  RENOVADO: 'Renovado',
};

type FiltroVigencia = 'all' | EstadoVigencia;

const FILTRO_LABELS: Record<FiltroVigencia, string> = {
  all: 'Todos',
  VIGENTE: 'Vigente',
  POR_VENCER: 'Por vencer',
  VENCIDO: 'Vencido',
  RENOVADO: 'Renovado',
};

const PERIOD_PRESETS = [
  { value: 'all', label: 'Todo el histórico', months: 0 },
  { value: '1m', label: 'Último mes', months: 1 },
  { value: '3m', label: 'Últimos 3 meses', months: 3 },
  { value: '6m', label: 'Últimos 6 meses', months: 6 },
  { value: '12m', label: 'Últimos 12 meses', months: 12 },
];

function monthsAgo(months: number): string | undefined {
  if (months === 0) return undefined;
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function RenovacionesPage() {
  const { hasPermission } = useAuthz();
  const canManage = hasPermission('renovaciones.manage');
  const navigate = useNavigate();

  const [data, setData] = useState<HistorialEPP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroVigencia>('all');
  const [detalle, setDetalle] = useState<HistorialEPP | null>(null);
  const [renovarRow, setRenovarRow] = useState<HistorialEPP | null>(null);
  const [renovando, setRenovando] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [extraFilters, setExtraFilters] = useState<HistorialFilters>({});
  const [periodPreset, setPeriodPreset] = useState('all');
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [trabajadores, setTrabajadores] = useState<TrabajadorWithRelations[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoEPP[]>([]);

  useEffect(() => {
    fetchWithCache('sedes', () => fetchSedes()).then(setSedes).catch(() => setSedes([]));
    fetchWithCache('trabajadores', () => fetchTrabajadores()).then(setTrabajadores).catch(() => setTrabajadores([]));
    fetchWithCache('catalogo_epp', () => fetchCatalogoEPP()).then(setCatalogo).catch(() => setCatalogo([]));
  }, []);

  useEffect(() => {
    if (extraFilters.sedeId) {
      fetchAreas(extraFilters.sedeId).then(setAreas).catch(() => setAreas([]));
    } else {
      fetchWithCache('areas', () => fetchAreas()).then(setAreas).catch(() => setAreas([]));
    }
  }, [extraFilters.sedeId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchWithCache('renovaciones', () => fetchHistorialEPP(extraFilters));
      setData(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar renovaciones.');
    } finally {
      setLoading(false);
    }
  }, [extraFilters]);

  useEffect(() => {
    load();
  }, [load]);

  const updateFilter = (key: keyof HistorialFilters, value: string | undefined) => {
    setExtraFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const handlePeriodChange = (preset: string) => {
    setPeriodPreset(preset);
    const config = PERIOD_PRESETS.find((p) => p.value === preset);
    if (!config) return;
    const desde = monthsAgo(config.months);
    setExtraFilters((prev) => ({ ...prev, fechaDesde: desde, fechaHasta: undefined }));
  };

  const filteredTrabajadores = extraFilters.sedeId
    ? trabajadores.filter((t) => t.sede_id === extraFilters.sedeId)
    : trabajadores;

  const hasActiveExtraFilters = Object.values(extraFilters).some((v) => v !== undefined && v !== '');

  const counts = useMemo(() => {
    const c: Record<FiltroVigencia, number> = {
      all: data.length,
      VIGENTE: 0,
      POR_VENCER: 0,
      VENCIDO: 0,
      RENOVADO: 0,
    };
    for (const r of data) {
      c[r.estado_vigencia]++;
    }
    return c;
  }, [data]);

  const filtered = useMemo(() => {
    if (filtro === 'all') return data;
    return data.filter((r) => r.estado_vigencia === filtro);
  }, [data, filtro]);

  const canRenovar = (row: HistorialEPP): boolean => {
    return canManage &&
      (row.estado_vigencia === 'POR_VENCER' ||
       row.estado_vigencia === 'VENCIDO');
  };

  const canRenovarDisabled = (row: HistorialEPP): boolean => {
    return canManage && row.estado_vigencia === 'VIGENTE';
  };

  const handleConfirmRenovar = async () => {
    if (!renovarRow) return;
    setRenovando(true);
    setActionError(null);
    setSuccessMsg(null);
    try {
      const nuevaId = await renovarEPP(renovarRow.entrega_id);
      setSuccessMsg(
        `Renovación creada correctamente. La nueva entrega ha sido generada y puede ser procesada en el módulo de Entregas.`
      );
      setRenovarRow(null);
      await load();
      void nuevaId;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al renovar el EPP.');
    } finally {
      setRenovando(false);
    }
  };

  const columns: Column<HistorialEPP>[] = useMemo(() => [
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
          <p className="text-xs text-neutral-400">{r.epp_codigo}</p>
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
      key: 'area_nombre',
      label: 'Área',
      sortable: true,
      sortValue: (r) => r.area_nombre,
      render: (r) => <span className="text-neutral-700">{r.area_nombre}</span>,
    },
    {
      key: 'fecha_entrega',
      label: 'Fecha entrega',
      sortable: true,
      sortValue: (r) => r.fecha_entrega,
      render: (r) => <span className="text-neutral-700">{formatDate(r.fecha_entrega)}</span>,
    },
    {
      key: 'fecha_renovacion',
      label: 'Fecha renovación',
      sortable: true,
      sortValue: (r) => r.fecha_renovacion ?? '',
      render: (r) => <span className="text-neutral-700">{formatDate(r.fecha_renovacion)}</span>,
    },
    {
      key: 'estado_vigencia',
      label: 'Estado',
      sortable: true,
      sortValue: (r) => r.estado_vigencia,
      render: (r) => (
        <Badge variant={VIGENCIA_VARIANTS[r.estado_vigencia]}>
          {VIGENCIA_LABELS[r.estado_vigencia]}
        </Badge>
      ),
    },
    {
      key: 'dias_restantes',
      label: 'Días',
      sortable: true,
      sortValue: (r) => r.dias_restantes ?? 9999,
      render: (r) => {
        if (r.estado_vigencia === 'RENOVADO') {
          return <span className="text-neutral-400">—</span>;
        }
        if (r.dias_restantes === null) {
          return <span className="text-neutral-400">—</span>;
        }
        const dias = Math.abs(r.dias_restantes);
        const vencido = r.dias_restantes < 0;
        return (
          <span className={`font-medium ${vencido ? 'text-error-700' : 'text-success-700'}`}>
            {vencido ? `${dias} días vencido` : `${dias} días restantes`}
          </span>
        );
      },
    },
    {
      key: 'numero_entrega',
      label: 'Entrega origen',
      sortable: true,
      sortValue: (r) => r.numero_entrega,
      render: (r) => <span className="text-neutral-700">{r.numero_entrega}</span>,
    },
  ], []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Renovaciones</h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              Control de vigencia y renovación de EPP por trabajador
            </p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && !error && data.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['VIGENTE', 'POR_VENCER', 'VENCIDO', 'RENOVADO'] as EstadoVigencia[]).map((estado) => (
            <button
              key={estado}
              type="button"
              onClick={() => setFiltro(estado)}
              className={`rounded-lg border p-4 text-left transition-all hover:shadow-sm ${
                filtro === estado
                  ? 'border-primary-300 bg-primary-50/50 ring-1 ring-primary-200'
                  : 'border-neutral-200 bg-white hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">{VIGENCIA_LABELS[estado]}</span>
                <Badge variant={VIGENCIA_VARIANTS[estado]}>{counts[estado]}</Badge>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-600">
              <Calendar className="h-3.5 w-3.5 text-neutral-400" />
              Período
            </label>
            <Select value={periodPreset} onChange={(e) => handlePeriodChange(e.target.value)}>
              {PERIOD_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-600">
              <MapPin className="h-3.5 w-3.5 text-neutral-400" />
              Sede
            </label>
            <Select
              value={extraFilters.sedeId ?? ''}
              onChange={(e) => {
                updateFilter('sedeId', e.target.value);
                updateFilter('areaId', undefined);
              }}
            >
              <option value="">Todas las sedes</option>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-600">
              <Layers className="h-3.5 w-3.5 text-neutral-400" />
              Área
            </label>
            <Select
              value={extraFilters.areaId ?? ''}
              onChange={(e) => updateFilter('areaId', e.target.value)}
            >
              <option value="">Todas las áreas</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-600">
              <Users className="h-3.5 w-3.5 text-neutral-400" />
              Trabajador
            </label>
            <Select
              value={extraFilters.trabajadorId ?? ''}
              onChange={(e) => updateFilter('trabajadorId', e.target.value)}
            >
              <option value="">Todos los trabajadores</option>
              {filteredTrabajadores
                .filter((t) => t.activo)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.apellidos}, {t.nombres}
                  </option>
                ))}
            </Select>
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-600">
              <Package className="h-3.5 w-3.5 text-neutral-400" />
              EPP
            </label>
            <Select
              value={extraFilters.eppId ?? ''}
              onChange={(e) => updateFilter('eppId', e.target.value)}
            >
              <option value="">Todos los EPP</option>
              {catalogo
                .filter((e) => e.activo)
                .map((e) => (
                  <option key={e.id} value={e.id}>{e.codigo} — {e.nombre}</option>
                ))}
            </Select>
          </div>
        </div>

        {hasActiveExtraFilters && (
          <div className="mt-3 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setExtraFilters({});
                setPeriodPreset('all');
              }}
            >
              Limpiar filtros
            </Button>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      {!loading && !error && data.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FILTRO_LABELS) as FiltroVigencia[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filtro === f
                  ? 'bg-primary-600 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {FILTRO_LABELS[f]} {f !== 'all' && counts[f] > 0 && `(${counts[f]})`}
            </button>
          ))}
        </div>
      )}

      {successMsg && (
        <Alert variant="success" onClose={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}

      {actionError && (
        <Alert variant="error" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {error && (
        <Alert variant="error" title="Error">
          {error}
        </Alert>
      )}

      {loading ? (
        <LoadingState message="Cargando renovaciones..." />
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : data.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin registros"
            description="Aún no hay entregas de EPP para controlar renovaciones con los filtros seleccionados."
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin registros"
            description={`No hay EPP en estado "${FILTRO_LABELS[filtro]}".`}
          />
        </Card>
      ) : (
        <Card padding="sm">
          <DataTable
            columns={columns}
            data={filtered}
            searchKeys={['trabajador_nombre', 'trabajador_dni', 'epp_nombre', 'epp_codigo', 'numero_entrega']}
            pageSize={15}
            rowKey={(r) => r.entrega_id}
            actions={(row) => (
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setDetalle(row)}
                  className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-primary-600"
                  title="Ver detalle"
                >
                  <Eye className="h-4 w-4" />
                </button>
                {canRenovar(row) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRenovarRow(row);
                      setActionError(null);
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Renovar
                  </Button>
                )}
                {canRenovarDisabled(row) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled
                    title="Renovación disponible cuando falten 30 días o menos"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Renovar
                  </Button>
                )}
              </div>
            )}
          />
        </Card>
      )}

      {/* Detail modal */}
      <Modal
        open={detalle !== null}
        onClose={() => setDetalle(null)}
        title="Detalle de EPP"
        size="lg"
        footer={<Button variant="outline" onClick={() => setDetalle(null)}>Cerrar</Button>}
      >
        {detalle && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-neutral-900">{detalle.numero_entrega}</p>
                <p className="text-sm text-neutral-500">{formatDate(detalle.fecha_entrega)}</p>
              </div>
              <Badge variant={VIGENCIA_VARIANTS[detalle.estado_vigencia]}>
                {VIGENCIA_LABELS[detalle.estado_vigencia]}
              </Badge>
            </div>

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-neutral-500">Trabajador</dt>
                <dd className="text-sm font-medium text-neutral-800">{detalle.trabajador_nombre}</dd>
                <dd className="text-xs text-neutral-400">DNI: {detalle.trabajador_dni}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-neutral-500">EPP</dt>
                <dd className="text-sm font-medium text-neutral-800">{detalle.epp_nombre}</dd>
                <dd className="text-xs text-neutral-400">{detalle.epp_codigo}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-neutral-500">Sede</dt>
                <dd className="text-sm font-medium text-neutral-800">{detalle.sede_nombre}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-neutral-500">Área</dt>
                <dd className="text-sm font-medium text-neutral-800">{detalle.area_nombre}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-neutral-500">Puesto</dt>
                <dd className="text-sm font-medium text-neutral-800">{detalle.puesto_nombre ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-neutral-500">Fecha de entrega</dt>
                <dd className="text-sm font-medium text-neutral-800">{formatDate(detalle.fecha_entrega)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-neutral-500">Fecha de renovación</dt>
                <dd className="text-sm font-medium text-neutral-800">{formatDate(detalle.fecha_renovacion)}</dd>
              </div>
              {detalle.dias_restantes !== null && detalle.estado_vigencia !== 'RENOVADO' && (
                <div>
                  <dt className="text-xs font-medium text-neutral-500">
                    {detalle.dias_restantes >= 0 ? 'Días restantes' : 'Días vencido'}
                  </dt>
                  <dd className={`text-sm font-medium ${detalle.dias_restantes >= 0 ? 'text-success-700' : 'text-error-700'}`}>
                    {Math.abs(detalle.dias_restantes)} días
                  </dd>
                </div>
              )}
              {detalle.renovado_por_entrega_numero && (
                <div>
                  <dt className="text-xs font-medium text-neutral-500">Renovado por</dt>
                  <dd className="text-sm font-medium text-primary-700">{detalle.renovado_por_entrega_numero}</dd>
                </div>
              )}
              {detalle.entrega_origen_numero && (
                <div>
                  <dt className="text-xs font-medium text-neutral-500">Renovación de</dt>
                  <dd className="text-sm font-medium text-neutral-800">{detalle.entrega_origen_numero}</dd>
                </div>
              )}
            </dl>

            <div className="flex items-center gap-2 border-t border-neutral-200 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/entregas?open=${detalle.entrega_id}`)}
              >
                <ExternalLink className="h-4 w-4" />
                Ver entrega completa
              </Button>
              {canRenovar(detalle) && (
                <Button
                  size="sm"
                  onClick={() => {
                    setRenovarRow(detalle);
                    setDetalle(null);
                    setActionError(null);
                  }}
                >
                  <ArrowRight className="h-4 w-4" />
                  Renovar EPP
                </Button>
              )}
              {canRenovarDisabled(detalle) && (
                <span className="inline-flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled
                    title="Renovación disponible cuando falten 30 días o menos"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Renovar EPP
                  </Button>
                  <span className="text-xs text-neutral-400">
                    Renovación disponible cuando falten 30 días o menos
                  </span>
                </span>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Renovar confirmation */}
      <ConfirmDialog
        open={renovarRow !== null}
        onClose={() => setRenovarRow(null)}
        onConfirm={handleConfirmRenovar}
        title="Renovar EPP"
        message={
          renovarRow
            ? `Se creará una nueva entrega de "${renovarRow.epp_nombre}" para ${renovarRow.trabajador_nombre}. La entrega original ${renovarRow.numero_entrega} se conservará intacta. La nueva entrega deberá ser procesada (preparación, confirmación, firmas y Registro SST) siguiendo el flujo normal.`
            : ''
        }
        confirmLabel={renovando ? 'Creando...' : 'Crear renovación'}
        variant="primary"
      />
    </div>
  );
}
