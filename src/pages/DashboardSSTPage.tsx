import { useState, useCallback, useEffect } from 'react';
import {
  BarChart3, Users, ShieldCheck, AlertTriangle, PackageCheck,
  RefreshCw, DollarSign, TrendingUp, Boxes, FileSignature, PieChart,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart as RechartsPie, Pie, Cell, Legend, Area, AreaChart,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/StateDisplay';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { ChartContainer } from '@/components/dashboard/ChartContainer';
import { DashboardFiltersBar } from '@/components/dashboard/DashboardFilters';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  fetchDashboardKPIs,
  fetchEntregasPorMes,
  fetchDistribucionPorSede,
  fetchDistribucionPorArea,
  fetchDistribucionPorEPP,
  fetchEstadoVigenciaDistribucion,
  fetchAlertasVigencia,
  getDefaultFechaDesde,
} from '@/services/dashboard-sst.service';
import { fetchWithCache } from '@/lib/data-cache';
import type {
  DashboardFilters,
  DashboardKPIs,
  SerieMensual,
  DistribucionItem,
  EstadoVigenciaDistribucion,
  AlertaVigencia,
} from '@/types/dashboard-sst.types';

const VIGENCIA_COLORS: Record<string, string> = {
  VIGENTE: '#16a34a',
  POR_VENCER: '#f59e0b',
  VENCIDO: '#dc2626',
  RENOVADO: '#1d63e0',
};

const VIGENCIA_LABELS: Record<string, string> = {
  VIGENTE: 'Vigente',
  POR_VENCER: 'Por vencer',
  VENCIDO: 'Vencido',
  RENOVADO: 'Renovado',
};

const DISTRIBUCION_COLORS = ['#1d63e0', '#18b8a6', '#fe800f', '#16a34a', '#f59e0b', '#dc2626', '#8ec6ff', '#3dd4c0', '#ffc070', '#86efac'];

export function DashboardSSTPage() {
  const [filters, setFilters] = useState<DashboardFilters>({ fechaDesde: getDefaultFechaDesde() });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [serieMensual, setSerieMensual] = useState<SerieMensual[]>([]);
  const [distSede, setDistSede] = useState<DistribucionItem[]>([]);
  const [distArea, setDistArea] = useState<DistribucionItem[]>([]);
  const [distEPP, setDistEPP] = useState<DistribucionItem[]>([]);
  const [distVigencia, setDistVigencia] = useState<EstadoVigenciaDistribucion[]>([]);
  const [alertas, setAlertas] = useState<AlertaVigencia[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filterKey = JSON.stringify(filters);
      const [k, sm, ds, da, de, dv, al] = await Promise.all([
        fetchWithCache(`dashboard_kpis_${filterKey}`, () => fetchDashboardKPIs(filters)),
        fetchWithCache(`dashboard_serie_${filterKey}`, () => fetchEntregasPorMes(filters)),
        fetchWithCache(`dashboard_dist_sede_${filterKey}`, () => fetchDistribucionPorSede(filters)),
        fetchWithCache(`dashboard_dist_area_${filterKey}`, () => fetchDistribucionPorArea(filters)),
        fetchWithCache(`dashboard_dist_epp_${filterKey}`, () => fetchDistribucionPorEPP(filters)),
        fetchWithCache(`dashboard_vigencia_${filterKey}`, () => fetchEstadoVigenciaDistribucion(filters)),
        fetchWithCache(`dashboard_alertas_${filterKey}`, () => fetchAlertasVigencia(filters)),
      ]);
      setKpis(k);
      setSerieMensual(sm);
      setDistSede(ds);
      setDistArea(da);
      setDistEPP(de);
      setDistVigencia(dv);
      setAlertas(al);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el dashboard.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Dashboard SST</h1>
          <p className="mt-0.5 text-sm text-neutral-500">Indicadores de Seguridad y Salud en el Trabajo — Gestión de EPP</p>
        </div>
      </div>

      {/* Filters */}
      <DashboardFiltersBar filters={filters} onFiltersChange={setFilters} />

      {error && (
        <Alert variant="error" title="Error">{error}</Alert>
      )}

      {loading ? (
        <LoadingState message="Cargando indicadores..." />
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : !kpis ? (
        <Card><EmptyState title="Sin datos" description="No se pudieron cargar los indicadores." /></Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <KpiCard
              title="Total Trabajadores"
              value={kpis.totalTrabajadores}
              icon={<Users className="h-5 w-5" />}
              description="Trabajadores activos"
            />
            <KpiCard
              title="Cobertura de EPP"
              value={`${kpis.coberturaPorcentaje}%`}
              icon={<ShieldCheck className="h-5 w-5" />}
              description={`${kpis.trabajadoresConEpp} de ${kpis.totalTrabajadores} con EPP`}
              variant={kpis.coberturaPorcentaje >= 80 ? 'success' : kpis.coberturaPorcentaje >= 50 ? 'warning' : 'error'}
            />
            <KpiCard
              title="EPP Vigentes"
              value={kpis.eppVigentes}
              icon={<ShieldCheck className="h-5 w-5" />}
              description="Entregas con vigencia activa"
              variant="success"
            />
            <KpiCard
              title="EPP por Vencer"
              value={kpis.eppPorVencer}
              icon={<AlertTriangle className="h-5 w-5" />}
              description="Faltan 30 días o menos"
              variant="warning"
            />
            <KpiCard
              title="EPP Vencidos"
              value={kpis.eppVencidos}
              icon={<AlertTriangle className="h-5 w-5" />}
              description="Requieren renovación"
              variant="error"
            />
            <KpiCard
              title="Entregas del Período"
              value={kpis.entregasPeriodo}
              icon={<PackageCheck className="h-5 w-5" />}
              description="Entregas confirmadas"
            />
            <KpiCard
              title="Cumplimiento Renovaciones"
              value={`${kpis.cumplimientoRenovaciones}%`}
              icon={<RefreshCw className="h-5 w-5" />}
              description="EPP vencidos que fueron renovados"
              variant={kpis.cumplimientoRenovaciones >= 80 ? 'success' : kpis.cumplimientoRenovaciones >= 50 ? 'warning' : 'error'}
            />
            <KpiCard
              title="Valorización Inventario"
              value={formatCurrency(kpis.valorizacionInventario)}
              icon={<Boxes className="h-5 w-5" />}
              description="Valor del stock actual"
              variant="info"
            />
            <KpiCard
              title="Costo Entregas (Período)"
              value={formatCurrency(kpis.costoTotalEntregas)}
              icon={<DollarSign className="h-5 w-5" />}
              description="Costo total de EPP entregados"
              variant="info"
            />
          </div>

          {/* Charts row 1: Entregas por mes + Estado de vigencia */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ChartContainer
                title="Entregas por mes"
                description="Tendencia de entregas en los últimos 12 meses"
                icon={<TrendingUp className="h-4 w-4" />}
              >
                {serieMensual.every((m) => m.entregas === 0) ? (
                  <EmptyState title="Sin entregas" description="No hay entregas en el período seleccionado." />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={serieMensual}>
                      <defs>
                        <linearGradient id="colorEntregas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1d63e0" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#1d63e0" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="etiqueta" tick={{ fontSize: 12, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                        labelStyle={{ fontWeight: 600, color: '#0f172a' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="entregas"
                        stroke="#1d63e0"
                        strokeWidth={2}
                        fill="url(#colorEntregas)"
                        name="Entregas"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </ChartContainer>
            </div>

            <ChartContainer
              title="Estado de vigencia"
              description="Distribución de EPP por estado"
              icon={<PieChart className="h-4 w-4" />}
            >
              {distVigencia.every((d) => d.cantidad === 0) ? (
                <EmptyState title="Sin datos" description="No hay EPP para mostrar." />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <RechartsPie>
                    <Pie
                      data={distVigencia.map((d) => ({
                        name: VIGENCIA_LABELS[d.estado] ?? d.estado,
                        value: d.cantidad,
                        key: d.estado,
                      }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={45}
                      paddingAngle={2}
                    >
                      {distVigencia.map((d) => (
                        <Cell key={d.estado} fill={VIGENCIA_COLORS[d.estado] ?? '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  </RechartsPie>
                </ResponsiveContainer>
              )}
            </ChartContainer>
          </div>

          {/* Charts row 2: Distribucion por sede + por area */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartContainer
              title="Distribución por sede"
              description="Entregas por sede en el período"
              icon={<BarChart3 className="h-4 w-4" />}
            >
              {distSede.length === 0 ? (
                <EmptyState title="Sin datos" description="No hay entregas para mostrar." />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={distSede} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="nombre"
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      width={120}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                      cursor={{ fill: '#f1f5f9' }}
                    />
                    <Bar dataKey="cantidad" name="Entregas" radius={[0, 4, 4, 0]}>
                      {distSede.map((_, idx) => (
                        <Cell key={idx} fill={DISTRIBUCION_COLORS[idx % DISTRIBUCION_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartContainer>

            <ChartContainer
              title="Distribución por área"
              description="Top 10 áreas con más entregas"
              icon={<BarChart3 className="h-4 w-4" />}
            >
              {distArea.length === 0 ? (
                <EmptyState title="Sin datos" description="No hay entregas para mostrar." />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={distArea} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="nombre"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      width={130}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                      cursor={{ fill: '#f1f5f9' }}
                    />
                    <Bar dataKey="cantidad" name="Entregas" radius={[0, 4, 4, 0]} fill="#18b8a6" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartContainer>
          </div>

          {/* Charts row 3: Top EPP */}
          <ChartContainer
            title="Top EPP más entregados"
            description="Los 10 EPP con mayor cantidad de entregas en el período"
            icon={<FileSignature className="h-4 w-4" />}
          >
            {distEPP.length === 0 ? (
              <EmptyState title="Sin datos" description="No hay entregas para mostrar." />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={distEPP} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="nombre"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    width={180}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                    cursor={{ fill: '#f1f5f9' }}
                  />
                  <Bar dataKey="cantidad" name="Entregas" radius={[0, 4, 4, 0]} fill="#fe800f" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartContainer>

          {/* Alertas de vigencia */}
          <Card padding="md">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning-600" />
              <h3 className="text-base font-semibold text-neutral-900">Alertas de vigencia</h3>
              {alertas.length > 0 && (
                <Badge variant="warning">{alertas.length}</Badge>
              )}
            </div>

            {alertas.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck className="h-8 w-8" />}
                title="Sin alertas"
                description="No hay EPP vencidos ni por vencer para los filtros seleccionados."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-left text-xs font-medium uppercase text-neutral-500">
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Trabajador</th>
                      <th className="px-3 py-2">EPP</th>
                      <th className="px-3 py-2">Sede</th>
                      <th className="px-3 py-2">Área</th>
                      <th className="px-3 py-2">Días restantes</th>
                      <th className="px-3 py-2">Fecha renovación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertas.slice(0, 20).map((a) => (
                      <tr key={a.entrega_id} className="border-b border-neutral-100 hover:bg-neutral-50">
                        <td className="px-3 py-2.5">
                          <Badge variant={a.estado_vigencia === 'VENCIDO' ? 'error' : 'warning'}>
                            {VIGENCIA_LABELS[a.estado_vigencia] ?? a.estado_vigencia}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-neutral-900">{a.trabajador_nombre}</p>
                          <p className="text-xs text-neutral-400">DNI: {a.trabajador_dni}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-neutral-900">{a.epp_nombre}</p>
                          <p className="text-xs text-neutral-400">{a.epp_codigo}</p>
                        </td>
                        <td className="px-3 py-2.5 text-neutral-700">{a.sede_nombre}</td>
                        <td className="px-3 py-2.5 text-neutral-700">{a.area_nombre}</td>
                        <td className="px-3 py-2.5">
                          <span className={`font-medium ${a.dias_restantes != null && a.dias_restantes < 0 ? 'text-error-600' : 'text-warning-600'}`}>
                            {a.dias_restantes != null
                              ? a.dias_restantes < 0 ? `Hace ${Math.abs(a.dias_restantes)} días` : `${a.dias_restantes} días`
                              : '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-neutral-700">{formatDate(a.fecha_renovacion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {alertas.length > 20 && (
                  <p className="mt-3 text-center text-xs text-neutral-400">
                    Mostrando 20 de {alertas.length} alertas. Usa filtros para reducir la lista.
                  </p>
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
