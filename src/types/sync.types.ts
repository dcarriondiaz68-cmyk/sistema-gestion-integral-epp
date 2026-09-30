export type SyncOperationStatus =
  | 'pendiente'
  | 'sincronizando'
  | 'sincronizado'
  | 'conflicto'
  | 'error';

export type SyncOperationType =
  | 'crear_solicitud'
  | 'registrar_entrega'
  | 'capturar_firma'
  | 'crud_maestro'
  | 'registrar_movimiento'
  | 'admin_update_profile';

export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  module: string;
  status: SyncOperationStatus;
  created_at: string;
  user_id: string;
  user_role: string;
  data: Record<string, unknown>;
  message: string | null;
  attempts: number;
  idempotency_key?: string;
}

export interface SyncStats {
  pendientes: number;
  sincronizadas: number;
  conflictos: number;
  errores: number;
  total: number;
}
