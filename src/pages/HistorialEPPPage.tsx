import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Eye, ExternalLink, Calendar, MapPin, Layers, Users, Package, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/StateDisplay';
import { useAuthz } from '@/hooks/useAuthz';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatDateTime } from '@/lib/format';
import { fetchHistorialEPP, type HistorialFilters } from '@/services/historial.service';
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

export function HistorialEPPPage() {
  const { role } = useAuthz();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<HistorialEPP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<HistorialEPP | null>(null);

  const isTrabajador = role === 'TRABAJADOR';

  const [filters, setFilters] = useState<HistorialFilters>({});
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
    if (filters.sedeId) {
      fetchAreas(filters.sedeId).then(setAreas).catch(() => setAreas([]));
    } else {
      fetchWithCache('areas', () => fetchAreas()).then(setAreas).catch(() => setAreas([]));
    }
  }, [filters.sedeId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const activeFilters: HistorialFilters = { ...filters };
      if (isTrabajador && profile?.email) {
        activeFilters.trabajadorEmail = profile.email;
      }
      const items = await fetchWithCache('historial_epp', () => fetchHistorialEPP(activeFilters));
      setData(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el historial.');
    } finally {
      setLoading(false);
    }
  }, [filters, isTrabajador, profile?.email]);

  useEffect(() => {
    load();
  }, [load]);

  const updateFilter = (key: keyof HistorialFilters, value: string | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const handlePeriodChange = (preset: string) => {
    setPeriodPreset(preset);
    const config = PERIOD_PRESETS.find((p) => p.value === preset);
    if (!config) return;
    const desde = monthsAgo(config.months);
    setFilters((prev) => ({ ...prev, fechaDesde: desde, fechaHasta: undefined }));
  };

  const filteredTrabajadores = filters.sedeId
    ? trabajadores.filter((t) => t.sede_id === filters.sedeId)
    : trabajadores;

  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined && v !== '');

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
      key: 'area_nombre',
      label: 'Área',
      sortable: true,
      sortValue: (r) => r.area_nombre,
      render: (r) => <span className="text-neutral-700">{r.area_nombre}</span>,
    },
    {
      key: 'puesto_nombre',
      label: 'Puesto',
      sortable: true,
      sortValue: (r) => r.puesto_nombre ?? '',
      render: (r) => <span className="text-neutral-700">{r.puesto_nombre ?? '—'}</span>,
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
  ], []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Historial EPP</h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              {isTrabajador
                ? 'Historial de tus equipos de protección personal entregados'
                : 'Historial de entregas de EPP por trabajador'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      {!isTrabajador && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
                value={filters.sedeId ?? ''}
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
                value={filters.areaId ?? ''}
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
                value={filters.trabajadorId ?? ''}
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
                value={filters.eppId ?? ''}
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

            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-600">
                <ShieldCheck className="h-3.5 w-3.5 text-neutral-400" />
                Vigencia
              </label>
              <Select
                value={filters.estadoVigencia ?? ''}
                onChange={(e) => updateFilter('estadoVigencia', e.target.value as EstadoVigencia | undefined)}
              >
                <option value="">Todos los estados</option>
                {(Object.keys(VIGENCIA_LABELS) as EstadoVigencia[]).map((ev) => (
                  <option key={ev} value={ev}>{VIGENCIA_LABELS[ev]}</option>
                ))}
              </Select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-3 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilters({});
                  setPeriodPreset('all');
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          )}
        </div>
      )}

      {error && (
        <Alert variant="error" title="Error">
          {error}
        </Alert>
      )}

      {loading ? (
        <LoadingState message="Cargando historial..." />
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : data.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin historial"
            description="Aún no hay entregas de EPP registradas con los filtros seleccionados."
          />
        </Card>
      ) : (
        <Card padding="sm">
          <DataTable
            columns={columns}
            data={data}
            searchKeys={['trabajador_nombre', 'trabajador_dni', 'epp_nombre', 'epp_codigo', 'numero_entrega']}
            pageSize={15}
            rowKey={(r) => r.entrega_id}
            actions={(row) => (
              <button
                type="button"
                onClick={() => setDetalle(row)}
                className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-primary-600"
                title="Ver detalle"
              >
                <Eye className="h-4 w-4" />
              </button>
            )}
          />
        </Card>
      )}

      <Modal
        open={detalle !== null}
        onClose={() => setDetalle(null)}
        title="Detalle del historial EPP"
        size="lg"
        footer={<Button variant="outline" onClick={() => setDetalle(null)}>Cerrar</Button>}
      >
        {detalle && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-neutral-900">{detalle.numero_entrega}</p>
                <p className="text-sm text-neutral-500">{formatDateTime(detalle.fecha_entrega)}</p>
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
                <dt className="text-xs font-medium text-neutral-500">Cantidad entregada</dt>
                <dd className="text-sm font-medium text-neutral-800">{detalle.cantidad_entregada}</dd>
              </div>
              {detalle.talla && (
                <div>
                  <dt className="text-xs font-medium text-neutral-500">Talla</dt>
                  <dd className="text-sm font-medium text-neutral-800">{detalle.talla}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium text-neutral-500">Fecha de entrega</dt>
                <dd className="text-sm font-medium text-neutral-800">{formatDate(detalle.fecha_entrega)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-neutral-500">Fecha estimada de renovación</dt>
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
              <div>
                <dt className="text-xs font-medium text-neutral-500">Solicitud relacionada</dt>
                <dd className="text-sm font-medium text-neutral-800">
                  {detalle.solicitud_numero ?? 'Entrega directa'}
                </dd>
              </div>
              {detalle.entrega_origen_numero && (
                <div>
                  <dt className="text-xs font-medium text-neutral-500">Entrega original (renovación de)</dt>
                  <dd className="text-sm font-medium text-neutral-800">{detalle.entrega_origen_numero}</dd>
                </div>
              )}
              {detalle.renovado_por_entrega_numero && (
                <div>
                  <dt className="text-xs font-medium text-neutral-500">Renovado por</dt>
                  <dd className="text-sm font-medium text-primary-700">{detalle.renovado_por_entrega_numero}</dd>
                </div>
              )}
              {detalle.observacion && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-neutral-500">Observaciones</dt>
                  <dd className="text-sm text-neutral-700">{detalle.observacion}</dd>
                </div>
              )}
            </dl>

            <div className="border-t border-neutral-200 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/entregas?open=${detalle.entrega_id}`)}
              >
                <ExternalLink className="h-4 w-4" />
                Ver entrega completa
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
