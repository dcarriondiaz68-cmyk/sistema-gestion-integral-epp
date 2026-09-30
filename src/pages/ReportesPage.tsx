import { useState, useCallback, useEffect } from 'react';
import {
  FileText, FileSignature, Users, Database, RefreshCw, DollarSign, Printer,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/StateDisplay';
import { DashboardFiltersBar } from '@/components/dashboard/DashboardFilters';
import { Select } from '@/components/ui/Input';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/format';
import { fetchEntregas } from '@/services/entregas.service';
import { fetchHistorialEPP } from '@/services/historial.service';
import { fetchKardex } from '@/services/inventario.service';
import { fetchCostosEntregas } from '@/services/costos.service';
import { fetchWithCache } from '@/lib/data-cache';
import type { EntregaWithRelations } from '@/types/entregas.types';
import type { HistorialEPP, EstadoVigencia } from '@/types/historial.types';
import type { KardexWithRelations } from '@/types/inventario.types';
import type { CostoEntregaItem } from '@/types/costos.types';
import type { DashboardFilters } from '@/types/dashboard-sst.types';
import type { ReporteType } from '@/types/reportes.types';

type TabKey = ReporteType;

interface TabDef {
  key: TabKey;
  label: string;
  icon: typeof FileText;
}

const TABS: TabDef[] = [
  { key: 'entregas', label: 'Entregas de EPP', icon: FileSignature },
  { key: 'epp-trabajador', label: 'EPP por Trabajador', icon: Users },
  { key: 'inventario-kardex', label: 'Inventario / Kardex', icon: Database },
  { key: 'renovaciones', label: 'Renovaciones', icon: RefreshCw },
  { key: 'costos', label: 'Costos', icon: DollarSign },
];

const ESTADO_ENTREGA_LABELS: Record<string, string> = {
  GENERADA: 'Generada',
  EN_PREPARACION: 'En preparación',
  EN_ESPERA_STOCK: 'En espera de stock',
  ENTREGADA_PENDIENTE_FIRMA: 'Pendiente de firma',
  FIRMADA_TRABAJADOR: 'Firmada por trabajador',
  FIRMADA_COMPLETA: 'Firmada completamente',
  CANCELADA: 'Cancelada',
};

const ESTADO_VIGENCIA_LABELS: Record<EstadoVigencia, string> = {
  VIGENTE: 'Vigente',
  POR_VENCER: 'Por vencer',
  VENCIDO: 'Vencido',
  RENOVADO: 'Renovado',
};

const ESTADO_VIGENCIA_VARIANTS: Record<EstadoVigencia, 'success' | 'warning' | 'error' | 'info'> = {
  VIGENTE: 'success',
  POR_VENCER: 'warning',
  VENCIDO: 'error',
  RENOVADO: 'info',
};

export function ReportesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('entregas');
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [estadoRenovacion, setEstadoRenovacion] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [entregas, setEntregas] = useState<EntregaWithRelations[]>([]);
  const [historial, setHistorial] = useState<HistorialEPP[]>([]);
  const [kardex, setKardex] = useState<KardexWithRelations[]>([]);
  const [renovaciones, setRenovaciones] = useState<HistorialEPP[]>([]);
  const [costos, setCostos] = useState<CostoEntregaItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'entregas') {
        const data = await fetchWithCache('reporte_entregas', () => fetchEntregas({
          sedeId: filters.sedeId,
          trabajadorId: filters.trabajadorId,
        }));
        let filtered = data;
        if (filters.fechaDesde) {
          filtered = filtered.filter((e) =>
            e.fecha_confirmacion && new Date(e.fecha_confirmacion) >= new Date(filters.fechaDesde!)
          );
        }
        if (filters.fechaHasta) {
          filtered = filtered.filter((e) =>
            e.fecha_confirmacion && new Date(e.fecha_confirmacion) <= new Date(filters.fechaHasta!)
          );
        }
        if (filters.eppId) {
          filtered = filtered.filter((e) => e.epp_id === filters.eppId);
        }
        setEntregas(filtered);
      } else if (activeTab === 'epp-trabajador') {
        const data = await fetchWithCache('reporte_epp_trabajador', () => fetchHistorialEPP({
          sedeId: filters.sedeId,
          areaId: filters.areaId,
          trabajadorId: filters.trabajadorId,
          eppId: filters.eppId,
          fechaDesde: filters.fechaDesde,
          fechaHasta: filters.fechaHasta,
        }));
        setHistorial(data);
      } else if (activeTab === 'inventario-kardex') {
        const data = await fetchWithCache('reporte_kardex', () => fetchKardex({
          sedeId: filters.sedeId,
          eppId: filters.eppId,
        }));
        let filtered = data;
        if (filters.fechaDesde) {
          filtered = filtered.filter((k) => new Date(k.created_at) >= new Date(filters.fechaDesde!));
        }
        if (filters.fechaHasta) {
          filtered = filtered.filter((k) => new Date(k.created_at) <= new Date(filters.fechaHasta!));
        }
        setKardex(filtered);
      } else if (activeTab === 'renovaciones') {
        const data = await fetchWithCache('reporte_renovaciones', () => fetchHistorialEPP({
          sedeId: filters.sedeId,
          areaId: filters.areaId,
          trabajadorId: filters.trabajadorId,
          eppId: filters.eppId,
          fechaDesde: filters.fechaDesde,
          fechaHasta: filters.fechaHasta,
          estadoVigencia: estadoRenovacion ? (estadoRenovacion as EstadoVigencia) : undefined,
        }));
        setRenovaciones(data);
      } else if (activeTab === 'costos') {
        const data = await fetchWithCache('reporte_costos', () => fetchCostosEntregas({
          fechaDesde: filters.fechaDesde,
          fechaHasta: filters.fechaHasta,
          sedeId: filters.sedeId,
          areaId: filters.areaId,
          trabajadorId: filters.trabajadorId,
          eppId: filters.eppId,
        }));
        setCostos(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el reporte.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters, estadoRenovacion]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePrint = () => {
    window.print();
  };

  // ---- Column definitions ----

  const entregasColumns: Column<EntregaWithRelations>[] = [
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
      sortValue: (r) => r.solicitud_numero ?? '',
      render: (r) => (
        r.solicitud_numero
          ? <span className="text-neutral-700">{r.solicitud_numero}</span>
          : <span className="text-neutral-400">Directa</span>
      ),
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      sortValue: (r) => r.estado,
      render: (r) => (
        <Badge variant={r.estado === 'CANCELADA' ? 'error' : r.estado === 'FIRMADA_COMPLETA' ? 'success' : 'info'}>
          {ESTADO_ENTREGA_LABELS[r.estado] ?? r.estado}
        </Badge>
      ),
    },
    {
      key: 'confirmado_nombre',
      label: 'Responsable',
      sortable: true,
      sortValue: (r) => r.confirmado_nombre,
      render: (r) => <span className="text-neutral-700">{r.confirmado_nombre}</span>,
    },
  ];

  const eppTrabajadorColumns: Column<HistorialEPP>[] = [
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
      key: 'epp_nombre',
      label: 'EPP Asignado',
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
      key: 'fecha_entrega',
      label: 'F. Entrega',
      sortable: true,
      sortValue: (r) => r.fecha_entrega,
      render: (r) => <span className="text-neutral-700">{formatDate(r.fecha_entrega)}</span>,
    },
    {
      key: 'fecha_renovacion',
      label: 'F. Vencimiento',
      sortable: true,
      sortValue: (r) => r.fecha_renovacion ?? '',
      render: (r) => <span className="text-neutral-700">{formatDate(r.fecha_renovacion)}</span>,
    },
    {
      key: 'estado_vigencia',
      label: 'Vigencia',
      sortable: true,
      sortValue: (r) => r.estado_vigencia,
      render: (r) => (
        <Badge variant={ESTADO_VIGENCIA_VARIANTS[r.estado_vigencia]}>
          {ESTADO_VIGENCIA_LABELS[r.estado_vigencia]}
        </Badge>
      ),
    },
    {
      key: 'sede_nombre',
      label: 'Sede',
      sortable: true,
      sortValue: (r) => r.sede_nombre,
      render: (r) => <span className="text-neutral-700">{r.sede_nombre}</span>,
    },
  ];

  const kardexColumns: Column<KardexWithRelations>[] = [
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
      key: 'tipo_movimiento',
      label: 'Tipo',
      sortable: true,
      sortValue: (r) => r.tipo_movimiento,
      render: (r) => (
        <Badge variant={r.tipo_movimiento === 'INGRESO' ? 'success' : r.tipo_movimiento === 'SALIDA' ? 'warning' : 'neutral'}>
          {r.tipo_movimiento}
        </Badge>
      ),
    },
    {
      key: 'cantidad',
      label: 'Cantidad',
      sortable: true,
      sortValue: (r) => r.cantidad,
      render: (r) => (
        <span className={r.tipo_movimiento === 'INGRESO' ? 'text-success-600 font-medium' : 'text-warning-600 font-medium'}>
          {r.tipo_movimiento === 'INGRESO' ? '+' : r.tipo_movimiento === 'SALIDA' ? '-' : ''}{r.cantidad}
        </span>
      ),
    },
    {
      key: 'saldo_resultante',
      label: 'Stock',
      sortable: true,
      sortValue: (r) => r.saldo_resultante,
      render: (r) => <span className="font-medium text-neutral-900">{r.saldo_resultante}</span>,
    },
    {
      key: 'created_at',
      label: 'Fecha',
      sortable: true,
      sortValue: (r) => r.created_at,
      render: (r) => <span className="text-neutral-700">{formatDateTime(r.created_at)}</span>,
    },
    {
      key: 'usuario_nombre',
      label: 'Usuario',
      sortable: true,
      sortValue: (r) => r.usuario_nombre,
      render: (r) => <span className="text-neutral-700">{r.usuario_nombre}</span>,
    },
    {
      key: 'referencia',
      label: 'Referencia',
      sortable: false,
      render: (r) => (
        r.referencia
          ? <span className="text-neutral-700">{r.referencia}</span>
          : <span className="text-neutral-400">—</span>
      ),
    },
  ];

  const renovacionesColumns: Column<HistorialEPP>[] = [
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
      key: 'fecha_entrega',
      label: 'F. Entrega',
      sortable: true,
      sortValue: (r) => r.fecha_entrega,
      render: (r) => <span className="text-neutral-700">{formatDate(r.fecha_entrega)}</span>,
    },
    {
      key: 'fecha_renovacion',
      label: 'F. Vencimiento',
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
        <Badge variant={ESTADO_VIGENCIA_VARIANTS[r.estado_vigencia]}>
          {ESTADO_VIGENCIA_LABELS[r.estado_vigencia]}
        </Badge>
      ),
    },
    {
      key: 'dias_restantes',
      label: 'Días Restantes',
      sortable: true,
      sortValue: (r) => r.dias_restantes ?? 9999,
      render: (r) => {
        if (r.dias_restantes == null) return <span className="text-neutral-400">—</span>;
        const variant = r.dias_restantes < 0 ? 'text-error-600' : r.dias_restantes <= 30 ? 'text-warning-600' : 'text-success-600';
        return <span className={`font-medium ${variant}`}>{r.dias_restantes}</span>;
      },
    },
    {
      key: 'sede_nombre',
      label: 'Sede',
      sortable: true,
      sortValue: (r) => r.sede_nombre,
      render: (r) => <span className="text-neutral-700">{r.sede_nombre}</span>,
    },
  ];

  const costosColumns: Column<CostoEntregaItem>[] = [
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
        r.precio_historico != null
          ? <span className="text-neutral-700">{formatCurrency(r.precio_historico)}</span>
          : <span className="text-neutral-400">—</span>
      ),
    },
    {
      key: 'costo_total',
      label: 'Costo Total',
      sortable: true,
      sortValue: (r) => r.costo_total ?? 0,
      render: (r) => (
        r.costo_total != null
          ? <span className="font-semibold text-neutral-900">{formatCurrency(r.costo_total)}</span>
          : <span className="text-neutral-400">—</span>
      ),
    },
    {
      key: 'fecha_confirmacion',
      label: 'Fecha',
      sortable: true,
      sortValue: (r) => r.fecha_confirmacion ?? '',
      render: (r) => <span className="text-neutral-700">{formatDate(r.fecha_confirmacion)}</span>,
    },
  ];

  const tabLabel = TABS.find((t) => t.key === activeTab)?.label ?? 'Reporte';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Print header — only visible when printing */}
      <div className="reporte-print-header hidden">
        <h1>Reporte: {tabLabel}</h1>
        <p>Generado el {formatDateTime(new Date().toISOString())}</p>
      </div>

      {/* Screen header */}
      <div className="reporte-screen-only flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Reportes</h1>
            <p className="mt-0.5 text-sm text-neutral-500">Consulte y exporte reportes del sistema de gestión de EPP</p>
          </div>
        </div>
        <button
          onClick={handlePrint}
          className="reporte-screen-only flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </button>
      </div>

      {/* Tabs */}
      <div className="reporte-screen-only flex flex-wrap gap-2">
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

      {/* Filters */}
      <div className="reporte-screen-only">
        <DashboardFiltersBar filters={filters} onFiltersChange={setFilters} />
      </div>

      {/* Extra filter for renovaciones: estado de vigencia */}
      {activeTab === 'renovaciones' && (
        <div className="reporte-screen-only flex items-end gap-3">
          <div className="w-56">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Estado de vigencia</label>
            <Select value={estadoRenovacion} onChange={(e) => setEstadoRenovacion(e.target.value)}>
              <option value="">Todos</option>
              <option value="VIGENTE">Vigente</option>
              <option value="POR_VENCER">Por vencer</option>
              <option value="VENCIDO">Vencido</option>
              <option value="RENOVADO">Renovado</option>
            </Select>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="error" title="Error">{error}</Alert>
      )}

      {/* Content */}
      {loading ? (
        <LoadingState message="Cargando reporte..." />
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : activeTab === 'entregas' ? (
        entregas.length === 0 ? (
          <Card><EmptyState title="Sin datos" description="No hay entregas para los filtros seleccionados." /></Card>
        ) : (
          <Card padding="sm">
            <DataTable
              columns={entregasColumns}
              data={entregas}
              searchKeys={['numero_entrega', 'trabajador_nombre', 'trabajador_dni', 'epp_nombre', 'epp_codigo', 'sede_nombre']}
              rowKey={(r) => r.id}
              pageSize={20}
            />
          </Card>
        )
      ) : activeTab === 'epp-trabajador' ? (
        historial.length === 0 ? (
          <Card><EmptyState title="Sin datos" description="No hay EPP asignados para los filtros seleccionados." /></Card>
        ) : (
          <Card padding="sm">
            <DataTable
              columns={eppTrabajadorColumns}
              data={historial}
              searchKeys={['trabajador_nombre', 'trabajador_dni', 'epp_nombre', 'epp_codigo', 'area_nombre', 'sede_nombre']}
              rowKey={(r) => r.entrega_id}
              pageSize={20}
            />
          </Card>
        )
      ) : activeTab === 'inventario-kardex' ? (
        kardex.length === 0 ? (
          <Card><EmptyState title="Sin datos" description="No hay movimientos de kardex para los filtros seleccionados." /></Card>
        ) : (
          <Card padding="sm">
            <DataTable
              columns={kardexColumns}
              data={kardex}
              searchKeys={['epp_nombre', 'epp_codigo', 'sede_nombre', 'usuario_nombre', 'referencia']}
              rowKey={(r) => r.id}
              pageSize={20}
            />
          </Card>
        )
      ) : activeTab === 'renovaciones' ? (
        renovaciones.length === 0 ? (
          <Card><EmptyState title="Sin datos" description="No hay renovaciones para los filtros seleccionados." /></Card>
        ) : (
          <Card padding="sm">
            <DataTable
              columns={renovacionesColumns}
              data={renovaciones}
              searchKeys={['trabajador_nombre', 'trabajador_dni', 'epp_nombre', 'epp_codigo', 'sede_nombre']}
              rowKey={(r) => r.entrega_id}
              pageSize={20}
            />
          </Card>
        )
      ) : costos.length === 0 ? (
        <Card><EmptyState title="Sin datos" description="No hay costos de entregas para los filtros seleccionados." /></Card>
      ) : (
        <Card padding="sm">
          <DataTable
            columns={costosColumns}
            data={costos}
            searchKeys={['trabajador_nombre', 'trabajador_dni', 'epp_nombre', 'epp_codigo', 'sede_nombre', 'area_nombre']}
            rowKey={(r) => r.entrega_id}
            pageSize={20}
          />
        </Card>
      )}
    </div>
  );
}
