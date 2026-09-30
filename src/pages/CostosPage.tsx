import { useState, useCallback, useEffect, useMemo } from 'react';
import { DollarSign, Boxes, FileSignature, Users, Building2, Layers } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/StateDisplay';
import { DashboardFiltersBar } from '@/components/dashboard/DashboardFilters';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import {
  fetchValorizacionInventario,
  fetchCostosEntregas,
  aggregateByTrabajador,
  aggregateBySede,
  aggregateByArea,
} from '@/services/costos.service';
import { fetchWithCache } from '@/lib/data-cache';
import type {
  ValorizacionItem,
  CostoEntregaItem,
  CostoPorTrabajador,
  CostoPorSede,
  CostoPorArea,
} from '@/types/costos.types';
import type { DashboardFilters } from '@/types/dashboard-sst.types';

type TabKey = 'valorizacion' | 'entregas' | 'trabajador' | 'sede';

const TABS: { key: TabKey; label: string; icon: typeof Boxes }[] = [
  { key: 'valorizacion', label: 'Valorización de Inventario', icon: Boxes },
  { key: 'entregas', label: 'Costos de Entregas', icon: FileSignature },
  { key: 'trabajador', label: 'Por Trabajador', icon: Users },
  { key: 'sede', label: 'Por Sede y Área', icon: Building2 },
];

export function CostosPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('valorizacion');
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [valorizacion, setValorizacion] = useState<ValorizacionItem[]>([]);
  const [entregas, setEntregas] = useState<CostoEntregaItem[]>([]);
  const [porTrabajador, setPorTrabajador] = useState<CostoPorTrabajador[]>([]);
  const [porSede, setPorSede] = useState<CostoPorSede[]>([]);
  const [porArea, setPorArea] = useState<CostoPorArea[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const costosFilters = {
        fechaDesde: filters.fechaDesde,
        fechaHasta: filters.fechaHasta,
        sedeId: filters.sedeId,
        areaId: filters.areaId,
        trabajadorId: filters.trabajadorId,
        eppId: filters.eppId,
      };

      if (activeTab === 'valorizacion') {
        const data = await fetchWithCache('costos_valorizacion', () => fetchValorizacionInventario(costosFilters));
        setValorizacion(data);
      } else if (activeTab === 'entregas') {
        const data = await fetchWithCache('costos_entregas', () => fetchCostosEntregas(costosFilters));
        setEntregas(data);
      } else if (activeTab === 'trabajador') {
        const data = await fetchWithCache('costos_entregas', () => fetchCostosEntregas(costosFilters));
        setPorTrabajador(aggregateByTrabajador(data));
      } else if (activeTab === 'sede') {
        const data = await fetchWithCache('costos_entregas', () => fetchCostosEntregas(costosFilters));
        setPorSede(aggregateBySede(data));
        setPorArea(aggregateByArea(data));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los costos.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const totalValorizacion = useMemo(() => {
    return valorizacion.reduce((sum, item) => sum + (item.valor_total ?? 0), 0);
  }, [valorizacion]);

  const totalEntregas = useMemo(() => {
    return entregas.reduce((sum, item) => sum + (item.costo_total ?? 0), 0);
  }, [entregas]);

  const totalTrabajador = useMemo(() => {
    return porTrabajador.reduce((sum, item) => sum + item.costo_total, 0);
  }, [porTrabajador]);

  const totalSede = useMemo(() => {
    return porSede.reduce((sum, item) => sum + item.costo_total, 0);
  }, [porSede]);

  // ---- Column definitions ----

  const valorizacionColumns: Column<ValorizacionItem>[] = [
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
      label: 'Stock',
      sortable: true,
      sortValue: (r) => r.stock_actual,
      render: (r) => <span className="font-medium text-neutral-900">{r.stock_actual}</span>,
    },
    {
      key: 'precio_unitario',
      label: 'Precio Unit.',
      sortable: true,
      sortValue: (r) => r.precio_unitario ?? 0,
      render: (r) => (
        <span className="text-neutral-700">
          {r.precio_unitario != null ? formatCurrency(r.precio_unitario) : <span className="text-neutral-400">Sin precio</span>}
        </span>
      ),
    },
    {
      key: 'valor_total',
      label: 'Valor Total',
      sortable: true,
      sortValue: (r) => r.valor_total ?? 0,
      render: (r) => (
        <span className="font-semibold text-neutral-900">
          {r.valor_total != null ? formatCurrency(r.valor_total) : <span className="text-neutral-400">—</span>}
        </span>
      ),
    },
  ];

  const entregasColumns: Column<CostoEntregaItem>[] = [
    {
      key: 'numero_entrega',
      label: 'N° Entrega',
      sortable: true,
      sortValue: (r) => r.numero_entrega,
      render: (r) => <span className="font-medium text-neutral-900">{r.numero_entrega}</span>,
    },
    {
      key: 'fecha_confirmacion',
      label: 'Fecha',
      sortable: true,
      sortValue: (r) => r.fecha_confirmacion ?? '',
      render: (r) => <span className="text-neutral-700">{formatDate(r.fecha_confirmacion)}</span>,
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
      key: 'cantidad_entregada',
      label: 'Cant.',
      sortable: true,
      sortValue: (r) => r.cantidad_entregada,
      render: (r) => <span className="text-neutral-700">{r.cantidad_entregada}</span>,
    },
    {
      key: 'precio_historico',
      label: 'Precio Hist.',
      sortable: true,
      sortValue: (r) => r.precio_historico ?? 0,
      render: (r) => (
        <span className="text-neutral-700">
          {r.precio_historico != null ? formatCurrency(r.precio_historico) : <span className="text-neutral-400">—</span>}
        </span>
      ),
    },
    {
      key: 'costo_total',
      label: 'Costo Total',
      sortable: true,
      sortValue: (r) => r.costo_total ?? 0,
      render: (r) => (
        <span className="font-semibold text-neutral-900">
          {r.costo_total != null ? formatCurrency(r.costo_total) : <span className="text-neutral-400">—</span>}
        </span>
      ),
    },
  ];

  const trabajadorColumns: Column<CostoPorTrabajador>[] = [
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
      key: 'num_entregas',
      label: 'Entregas',
      sortable: true,
      sortValue: (r) => r.num_entregas,
      render: (r) => <span className="text-neutral-700">{r.num_entregas}</span>,
    },
    {
      key: 'cantidad_total',
      label: 'Cant. EPP',
      sortable: true,
      sortValue: (r) => r.cantidad_total,
      render: (r) => <span className="text-neutral-700">{r.cantidad_total}</span>,
    },
    {
      key: 'costo_total',
      label: 'Costo Total',
      sortable: true,
      sortValue: (r) => r.costo_total,
      render: (r) => <span className="font-semibold text-neutral-900">{formatCurrency(r.costo_total)}</span>,
    },
  ];

  const sedeColumns: Column<CostoPorSede>[] = [
    {
      key: 'sede_nombre',
      label: 'Sede',
      sortable: true,
      sortValue: (r) => r.sede_nombre,
      render: (r) => <span className="font-medium text-neutral-900">{r.sede_nombre}</span>,
    },
    {
      key: 'num_entregas',
      label: 'Entregas',
      sortable: true,
      sortValue: (r) => r.num_entregas,
      render: (r) => <span className="text-neutral-700">{r.num_entregas}</span>,
    },
    {
      key: 'cantidad_total',
      label: 'Cant. EPP',
      sortable: true,
      sortValue: (r) => r.cantidad_total,
      render: (r) => <span className="text-neutral-700">{r.cantidad_total}</span>,
    },
    {
      key: 'costo_total',
      label: 'Costo Total',
      sortable: true,
      sortValue: (r) => r.costo_total,
      render: (r) => <span className="font-semibold text-neutral-900">{formatCurrency(r.costo_total)}</span>,
    },
  ];

  const areaColumns: Column<CostoPorArea>[] = [
    {
      key: 'area_nombre',
      label: 'Área',
      sortable: true,
      sortValue: (r) => r.area_nombre,
      render: (r) => <span className="font-medium text-neutral-900">{r.area_nombre}</span>,
    },
    {
      key: 'sede_nombre',
      label: 'Sede',
      sortable: true,
      sortValue: (r) => r.sede_nombre,
      render: (r) => <span className="text-neutral-700">{r.sede_nombre}</span>,
    },
    {
      key: 'num_entregas',
      label: 'Entregas',
      sortable: true,
      sortValue: (r) => r.num_entregas,
      render: (r) => <span className="text-neutral-700">{r.num_entregas}</span>,
    },
    {
      key: 'cantidad_total',
      label: 'Cant. EPP',
      sortable: true,
      sortValue: (r) => r.cantidad_total,
      render: (r) => <span className="text-neutral-700">{r.cantidad_total}</span>,
    },
    {
      key: 'costo_total',
      label: 'Costo Total',
      sortable: true,
      sortValue: (r) => r.costo_total,
      render: (r) => <span className="font-semibold text-neutral-900">{formatCurrency(r.costo_total)}</span>,
    },
  ];

  const currentTotal = activeTab === 'valorizacion' ? totalValorizacion
    : activeTab === 'entregas' ? totalEntregas
    : activeTab === 'trabajador' ? totalTrabajador
    : totalSede;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          <DollarSign className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Costos</h1>
          <p className="mt-0.5 text-sm text-neutral-500">Valorización de inventario y análisis de costos de entrega de EPP</p>
        </div>
      </div>

      <DashboardFiltersBar filters={filters} onFiltersChange={setFilters} />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-300 bg-primary-50 text-primary-700'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && (
        <Alert variant="error" title="Error">{error}</Alert>
      )}

      {/* Total bar */}
      {!loading && !error && currentTotal > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary-200 bg-primary-50/50 px-4 py-3">
          <span className="text-sm font-medium text-primary-700">
            {activeTab === 'valorizacion' ? 'Valor total del inventario' : 'Costo total del periodo'}
          </span>
          <span className="text-lg font-bold text-primary-700">{formatCurrency(currentTotal)}</span>
        </div>
      )}

      {loading ? (
        <LoadingState message="Cargando costos..." />
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : activeTab === 'valorizacion' ? (
        valorizacion.length === 0 ? (
          <Card><EmptyState title="Sin datos" description="No hay inventario registrado para los filtros seleccionados." /></Card>
        ) : (
          <Card padding="sm">
            <DataTable
              columns={valorizacionColumns}
              data={valorizacion}
              searchKeys={['epp_codigo', 'epp_nombre', 'sede_nombre']}
              rowKey={(r) => r.inventario_id}
              pageSize={15}
            />
          </Card>
        )
      ) : activeTab === 'entregas' ? (
        entregas.length === 0 ? (
          <Card><EmptyState title="Sin entregas" description="No hay entregas con costo para los filtros seleccionados." /></Card>
        ) : (
          <Card padding="sm">
            <DataTable
              columns={entregasColumns}
              data={entregas}
              searchKeys={['numero_entrega', 'trabajador_nombre', 'trabajador_dni', 'epp_nombre', 'epp_codigo', 'sede_nombre']}
              rowKey={(r) => r.entrega_id}
              pageSize={15}
            />
          </Card>
        )
      ) : activeTab === 'trabajador' ? (
        porTrabajador.length === 0 ? (
          <Card><EmptyState title="Sin datos" description="No hay entregas para los filtros seleccionados." /></Card>
        ) : (
          <Card padding="sm">
            <DataTable
              columns={trabajadorColumns}
              data={porTrabajador}
              searchKeys={['trabajador_nombre', 'trabajador_dni', 'sede_nombre', 'area_nombre']}
              rowKey={(r) => r.trabajador_id}
              pageSize={15}
            />
          </Card>
        )
      ) : porSede.length === 0 && porArea.length === 0 ? (
        <Card><EmptyState title="Sin datos" description="No hay entregas para los filtros seleccionados." /></Card>
      ) : (
        <div className="space-y-6">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-neutral-500" />
              <h3 className="text-sm font-semibold text-neutral-900">Costos por sede</h3>
            </div>
            {porSede.length === 0 ? (
              <Card><EmptyState title="Sin datos" description="No hay entregas para mostrar." /></Card>
            ) : (
              <Card padding="sm">
                <DataTable
                  columns={sedeColumns}
                  data={porSede}
                  searchKeys={['sede_nombre']}
                  rowKey={(r) => r.sede_id}
                  pageSize={10}
                />
              </Card>
            )}
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Layers className="h-4 w-4 text-neutral-500" />
              <h3 className="text-sm font-semibold text-neutral-900">Costos por área</h3>
            </div>
            {porArea.length === 0 ? (
              <Card><EmptyState title="Sin datos" description="No hay entregas para mostrar." /></Card>
            ) : (
              <Card padding="sm">
                <DataTable
                  columns={areaColumns}
                  data={porArea}
                  searchKeys={['area_nombre', 'sede_nombre']}
                  rowKey={(r) => r.area_id ?? 'sin-area'}
                  pageSize={15}
                />
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
