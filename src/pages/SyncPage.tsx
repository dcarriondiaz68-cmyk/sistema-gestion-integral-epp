import { useEffect, useState } from 'react';
import { RefreshCw, Clock, CheckCircle2, AlertTriangle, XCircle, RotateCw, Wifi } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { LoadingState, EmptyState } from '@/components/ui/StateDisplay';
import { ConnectionIndicator } from '@/components/ui/ConnectionIndicator';
import { formatDateTime } from '@/lib/format';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import type { SyncOperation, SyncOperationStatus } from '@/types/sync.types';

const STATUS_VARIANTS: Record<SyncOperationStatus, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = {
  pendiente: 'neutral',
  sincronizando: 'info',
  sincronizado: 'success',
  conflicto: 'warning',
  error: 'error',
};

const STATUS_LABELS: Record<SyncOperationStatus, string> = {
  pendiente: 'Pendiente',
  sincronizando: 'Sincronizando',
  sincronizado: 'Sincronizado',
  conflicto: 'Conflicto',
  error: 'Error',
};

const TYPE_LABELS: Record<string, string> = {
  crear_solicitud: 'Crear solicitud',
  registrar_entrega: 'Registrar entrega',
  capturar_firma: 'Capturar firma',
};

interface StatCardProps {
  label: string;
  value: number;
  icon: typeof Clock;
  color: string;
  bg: string;
}

function StatCard({ label, value, icon: Icon, color, bg }: StatCardProps) {
  return (
    <Card padding="sm" className="flex items-center gap-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg} ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-neutral-900">{value}</p>
        <p className="text-xs text-neutral-500">{label}</p>
      </div>
    </Card>
  );
}

export function SyncPage() {
  const { connectionStatus, isOnline, isSyncing, queue, stats, syncNow, retryOperation, refreshQueue } = useSyncQueue();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      await syncNow();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al sincronizar.');
    } finally {
      setSyncing(false);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await retryOperation(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reintentar.');
    }
  };

  const columns: Column<SyncOperation>[] = [
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
      key: 'type',
      label: 'Operación',
      sortable: true,
      sortValue: (r) => r.type,
      render: (r) => <span className="font-medium text-neutral-900">{TYPE_LABELS[r.type] ?? r.type}</span>,
    },
    {
      key: 'status',
      label: 'Estado',
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => (
        <Badge variant={STATUS_VARIANTS[r.status]}>
          {STATUS_LABELS[r.status]}
        </Badge>
      ),
    },
    {
      key: 'attempts',
      label: 'Intentos',
      sortable: true,
      sortValue: (r) => r.attempts,
      render: (r) => <span className="text-neutral-500">{r.attempts}</span>,
    },
    {
      key: 'message',
      label: 'Mensaje',
      sortable: false,
      render: (r) => (
        r.message
          ? <span className="text-xs text-neutral-500 line-clamp-2 max-w-xs">{r.message}</span>
          : <span className="text-neutral-400">—</span>
      ),
    },
    {
      key: 'actions',
      label: 'Acciones',
      sortable: false,
      render: (r) => (
        (r.status === 'error' || r.status === 'conflicto') && isOnline ? (
          <button
            onClick={() => handleRetry(r.id)}
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Reintentar
          </button>
        ) : (
          <span className="text-neutral-400">—</span>
        )
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          <RefreshCw className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Sincronización</h1>
          <p className="mt-0.5 text-sm text-neutral-500">Estado de la conexión y cola de operaciones pendientes</p>
        </div>
      </div>

      <Card padding="sm" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <ConnectionIndicator status={connectionStatus} />
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Wifi className="h-4 w-4" />
            <span>{isOnline ? 'Conexión activa' : 'Sin conexión a internet'}</span>
          </div>
        </div>
        <Button
          onClick={handleSync}
          disabled={isSyncing || syncing || !isOnline || stats.pendientes === 0}
          variant="primary"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing || syncing ? 'animate-spin' : ''}`} />
          Sincronizar ahora
        </Button>
      </Card>

      {error && (
        <Alert variant="error" title="Error">{error}</Alert>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Pendientes"
          value={stats.pendientes}
          icon={Clock}
          color="text-neutral-600"
          bg="bg-neutral-100"
        />
        <StatCard
          label="Sincronizadas"
          value={stats.sincronizadas}
          icon={CheckCircle2}
          color="text-success-600"
          bg="bg-success-50"
        />
        <StatCard
          label="Conflictos"
          value={stats.conflictos}
          icon={AlertTriangle}
          color="text-warning-600"
          bg="bg-warning-50"
        />
        <StatCard
          label="Errores"
          value={stats.errores}
          icon={XCircle}
          color="text-error-600"
          bg="bg-error-50"
        />
      </div>

      {queue.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin operaciones pendientes"
            description="No hay operaciones en la cola de sincronización. Todas las acciones se han procesado correctamente."
          />
        </Card>
      ) : (
        <Card padding="sm">
          <DataTable
            columns={columns}
            data={queue}
            searchKeys={['module', 'type', 'message']}
            rowKey={(r) => r.id}
            pageSize={15}
          />
        </Card>
      )}

      <p className="text-xs text-neutral-400">
        Las operaciones sincronizadas se eliminan automáticamente de la cola tras una sincronización exitosa.
        Las operaciones en conflicto o con error se conservan para revisión y pueden reintentarse.
      </p>
    </div>
  );
}
