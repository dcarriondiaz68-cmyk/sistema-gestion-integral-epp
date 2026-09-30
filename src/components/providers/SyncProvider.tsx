import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { ConnectionStatus } from '@/constants/statuses.constants';
import type { SyncOperation, SyncOperationType, SyncStats } from '@/types/sync.types';
import {
  enqueue as dbEnqueue,
  getAll,
  getPending,
  updateStatus,
  purgeSynchronized,
} from '@/lib/offline-queue';
import { processQueue } from '@/lib/sync-processor';

export interface SyncContextValue {
  connectionStatus: ConnectionStatus;
  isOnline: boolean;
  isOffline: boolean;
  isSyncing: boolean;
  queue: SyncOperation[];
  stats: SyncStats;
  enqueueOperation: (type: SyncOperationType, module: string, data: Record<string, unknown>) => Promise<void>;
  syncNow: () => Promise<void>;
  refreshQueue: () => Promise<void>;
  retryOperation: (id: string) => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function buildIdempotencyKey(
  type: SyncOperationType,
  data: Record<string, unknown>,
  userId: string
): string {
  const parts: string[] = [type, userId];
  if (type === 'crear_solicitud') {
    parts.push(
      String(data.trabajador_id ?? ''),
      String(data.epp_id ?? ''),
      String(data.sede_id ?? ''),
      String(data.cantidad ?? ''),
      String(data.talla ?? '')
    );
  } else if (type === 'registrar_entrega') {
    parts.push(
      String(data.trabajador_id ?? ''),
      String(data.epp_id ?? ''),
      String(data.sede_id ?? ''),
      String(data.cantidad_entregada ?? ''),
      String(data.talla ?? '')
    );
  } else if (type === 'capturar_firma') {
    parts.push(
      String(data.entrega_id ?? ''),
      String(data.tipo_firma ?? '')
    );
  } else if (type === 'crud_maestro') {
    parts.push(
      String(data.table ?? ''),
      String(data.action ?? ''),
      String(data.record_id ?? ''),
      String((data.payload as Record<string, unknown>)?.ruc ?? ''),
      String((data.payload as Record<string, unknown>)?.codigo ?? ''),
      String((data.payload as Record<string, unknown>)?.dni ?? ''),
      String((data.payload as Record<string, unknown>)?.codigo_interno ?? '')
    );
  } else if (type === 'registrar_movimiento') {
    parts.push(
      String(data.epp_id ?? ''),
      String(data.sede_id ?? ''),
      String(data.tipo_movimiento ?? ''),
      String(data.cantidad ?? ''),
      String(data.motivo ?? '')
    );
  } else if (type === 'admin_update_profile') {
    parts.push(
      String(data.target_uid ?? ''),
      String(data.full_name ?? ''),
      String(data.phone ?? ''),
      String(data.role ?? '')
    );
  }
  return parts.join('|');
}

function computeStats(ops: SyncOperation[]): SyncStats {
  return {
    pendientes: ops.filter((o) => o.status === 'pendiente').length,
    sincronizadas: ops.filter((o) => o.status === 'sincronizado').length,
    conflictos: ops.filter((o) => o.status === 'conflicto').length,
    errores: ops.filter((o) => o.status === 'error').length,
    total: ops.length,
  };
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [queue, setQueue] = useState<SyncOperation[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [hasError, setHasError] = useState(false);
  const syncingRef = useRef(false);

  const refreshQueue = useCallback(async () => {
    const ops = await getAll();
    setQueue(ops);
    setHasConflict(ops.some((o) => o.status === 'conflicto'));
    setHasError(ops.some((o) => o.status === 'error'));
  }, []);

  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncNow = useCallback(async () => {
    if (syncingRef.current) return;
    if (!navigator.onLine) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const pending = await getPending();
      if (pending.length === 0) {
        await purgeSynchronized();
        await refreshQueue();
        return;
      }
      await processQueue(pending);
      await purgeSynchronized();
      await refreshQueue();
    } catch {
      await refreshQueue();
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }, [refreshQueue]);

  useEffect(() => {
    if (isOnline) {
      syncNow();
    }
  }, [isOnline, syncNow]);

  const enqueueOperation = useCallback(
    async (type: SyncOperationType, module: string, data: Record<string, unknown>) => {
      const op: SyncOperation = {
        id: generateId(),
        type,
        module,
        status: 'pendiente',
        created_at: new Date().toISOString(),
        user_id: user?.id ?? 'unknown',
        user_role: profile?.role ?? 'unknown',
        data,
        message: null,
        attempts: 0,
        idempotency_key: buildIdempotencyKey(type, data, user?.id ?? 'unknown'),
      };
      await dbEnqueue(op);
      await refreshQueue();
    },
    [user, profile, refreshQueue]
  );

  const retryOperation = useCallback(
    async (id: string) => {
      await updateStatus(id, 'pendiente');
      await refreshQueue();
      await syncNow();
    },
    [refreshQueue, syncNow]
  );

  const connectionStatus: ConnectionStatus = isSyncing
    ? 'syncing'
    : !isOnline
      ? 'offline'
      : hasConflict
        ? 'conflict'
        : hasError
          ? 'error'
          : 'online';

  const stats = computeStats(queue);

  const value: SyncContextValue = {
    connectionStatus,
    isOnline,
    isOffline: !isOnline,
    isSyncing,
    queue,
    stats,
    enqueueOperation,
    syncNow,
    refreshQueue,
    retryOperation,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSyncQueue(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error('useSyncQueue debe usarse dentro de SyncProvider');
  }
  return ctx;
}
