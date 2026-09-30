import { useState, useCallback, useEffect } from 'react';
import { ScrollText, Printer } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/StateDisplay';
import { formatDateTime } from '@/lib/format';
import { fetchAuditLog, fetchAuditModules } from '@/services/auditoria.service';
import { fetchWithCache } from '@/lib/data-cache';
import type { AuditLogEntry, AuditLogFilters } from '@/types/auditoria.types';

const OPERATION_VARIANTS: Record<string, 'success' | 'info' | 'error' | 'neutral'> = {
  INSERT: 'success',
  UPDATE: 'info',
  DELETE: 'error',
};

const OPERATION_LABELS: Record<string, string> = {
  INSERT: 'Crear',
  UPDATE: 'Modificar',
  DELETE: 'Eliminar',
};

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return '—';
  const entries = Object.entries(details);
  if (entries.length === 0) return '—';
  return entries.map(([key, value]) => {
    const displayKey = key.replace(/_/g, ' ');
    let displayValue = String(value);
    if (typeof value === 'object' && value !== null) {
      displayValue = JSON.stringify(value);
    }
    return `${displayKey}: ${displayValue}`;
  }).join(', ');
}

export function AuditoriaPage() {
  const [data, setData] = useState<AuditLogEntry[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [moduleFilter, setModuleFilter] = useState('');
  const [operationFilter, setOperationFilter] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: AuditLogFilters = {
        module: moduleFilter || undefined,
        operation: operationFilter || undefined,
        fechaDesde: fechaDesde ? new Date(fechaDesde).toISOString() : undefined,
        fechaHasta: fechaHasta ? new Date(fechaHasta + 'T23:59:59').toISOString() : undefined,
        search: search || undefined,
      };
      const [logData, modData] = await Promise.all([
        fetchWithCache('auditoria_log', () => fetchAuditLog(filters)),
        modules.length === 0 ? fetchWithCache('auditoria_modules', () => fetchAuditModules()) : Promise.resolve(modules),
      ]);
      setData(logData);
      if (modules.length === 0) setModules(modData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la auditoría.');
    } finally {
      setLoading(false);
    }
  }, [moduleFilter, operationFilter, fechaDesde, fechaHasta, search, modules]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePrint = () => {
    window.print();
  };

  const handleClearFilters = () => {
    setModuleFilter('');
    setOperationFilter('');
    setFechaDesde('');
    setFechaHasta('');
    setSearch('');
  };

  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'user_name',
      label: 'Usuario',
      sortable: true,
      sortValue: (r) => r.user_name,
      render: (r) => <span className="font-medium text-neutral-900">{r.user_name}</span>,
    },
    {
      key: 'created_at',
      label: 'Fecha y Hora',
      sortable: true,
      sortValue: (r) => r.created_at,
      render: (r) => <span className="text-neutral-700">{formatDateTime(r.created_at)}</span>,
    },
    {
      key: 'module',
      label: 'Módulo',
      sortable: true,
      sortValue: (r) => r.module,
      render: (r) => <span className="text-neutral-700">{r.module}</span>,
    },
    {
      key: 'action',
      label: 'Acción',
      sortable: true,
      sortValue: (r) => r.action,
      render: (r) => <span className="font-medium text-neutral-900">{r.action}</span>,
    },
    {
      key: 'operation',
      label: 'Operación',
      sortable: true,
      sortValue: (r) => r.operation,
      render: (r) => (
        <Badge variant={OPERATION_VARIANTS[r.operation] ?? 'neutral'}>
          {OPERATION_LABELS[r.operation] ?? r.operation}
        </Badge>
      ),
    },
    {
      key: 'record_id',
      label: 'Registro',
      sortable: false,
      render: (r) => (
        r.record_id
          ? <span className="font-mono text-xs text-neutral-500">{r.record_id.slice(0, 8)}…</span>
          : <span className="text-neutral-400">—</span>
      ),
    },
    {
      key: 'details',
      label: 'Descripción',
      sortable: false,
      render: (r) => (
        <span className="text-xs text-neutral-500 line-clamp-2 max-w-md">
          {formatDetails(r.details)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Print header */}
      <div className="reporte-print-header hidden">
        <h1>Auditoría del Sistema</h1>
        <p>Generado el {formatDateTime(new Date().toISOString())}</p>
      </div>

      {/* Screen header */}
      <div className="reporte-screen-only flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <ScrollText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Auditoría</h1>
            <p className="mt-0.5 text-sm text-neutral-500">Registro histórico de acciones críticas del sistema</p>
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

      {/* Filters */}
      <div className="reporte-screen-only rounded-xl border border-neutral-200 bg-white p-4 shadow-card">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Módulo</label>
            <Select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
              <option value="">Todos</option>
              {modules.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Operación</label>
            <Select value={operationFilter} onChange={(e) => setOperationFilter(e.target.value)}>
              <option value="">Todas</option>
              <option value="INSERT">Crear</option>
              <option value="UPDATE">Modificar</option>
              <option value="DELETE">Eliminar</option>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="input-base"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="input-base"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Buscar</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Usuario, acción, registro..."
              className="input-base"
            />
          </div>
        </div>
        {(moduleFilter || operationFilter || fechaDesde || fechaHasta || search) && (
          <div className="mt-3">
            <button
              onClick={handleClearFilters}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="error" title="Error">{error}</Alert>
      )}

      {loading ? (
        <LoadingState message="Cargando auditoría..." />
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : data.length === 0 ? (
        <Card><EmptyState title="Sin registros" description="No hay acciones de auditoría para los filtros seleccionados." /></Card>
      ) : (
        <Card padding="sm">
          <DataTable
            columns={columns}
            data={data}
            searchKeys={['user_name', 'action', 'module', 'record_id']}
            rowKey={(r) => r.id}
            pageSize={20}
          />
        </Card>
      )}

      <p className="reporte-screen-only text-xs text-neutral-400">
        Los registros de auditoría son de solo lectura y no pueden ser modificados ni eliminados desde esta interfaz.
      </p>
    </div>
  );
}
