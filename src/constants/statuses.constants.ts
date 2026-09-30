export type SystemStatus =
  | 'solicitud_pendiente'
  | 'solicitud_aprobada'
  | 'solicitud_rechazada'
  | 'entrega_generada'
  | 'entrega_preparacion'
  | 'entrega_espera_stock'
  | 'entrega_pendiente_firma'
  | 'entrega_firmada_trabajador'
  | 'entrega_firmada_responsable'
  | 'entrega_cerrada'
  | 'sync_pendiente'
  | 'sync_sincronizando'
  | 'sync_sincronizado'
  | 'sync_conflicto'
  | 'sync_error'
  | 'vigencia_vigente'
  | 'vigencia_por_vencer'
  | 'vigencia_vencido'
  | 'vigencia_renovado';

export interface StatusDefinition {
  id: SystemStatus;
  label: string;
  variant: 'neutral' | 'info' | 'success' | 'warning' | 'error';
}

export const SYSTEM_STATUSES: Record<SystemStatus, StatusDefinition> = {
  solicitud_pendiente: { id: 'solicitud_pendiente', label: 'Pendiente de aprobación', variant: 'warning' },
  solicitud_aprobada: { id: 'solicitud_aprobada', label: 'Aprobada', variant: 'success' },
  solicitud_rechazada: { id: 'solicitud_rechazada', label: 'Rechazada', variant: 'error' },

  entrega_generada: { id: 'entrega_generada', label: 'Generada', variant: 'info' },
  entrega_preparacion: { id: 'entrega_preparacion', label: 'En preparación', variant: 'info' },
  entrega_espera_stock: { id: 'entrega_espera_stock', label: 'En espera de stock', variant: 'warning' },
  entrega_pendiente_firma: { id: 'entrega_pendiente_firma', label: 'Entregada pendiente de firma', variant: 'warning' },
  entrega_firmada_trabajador: { id: 'entrega_firmada_trabajador', label: 'Firmada por trabajador', variant: 'info' },
  entrega_firmada_responsable: { id: 'entrega_firmada_responsable', label: 'Firmada por responsable', variant: 'info' },
  entrega_cerrada: { id: 'entrega_cerrada', label: 'Cerrada', variant: 'success' },

  sync_pendiente: { id: 'sync_pendiente', label: 'Pendiente', variant: 'neutral' },
  sync_sincronizando: { id: 'sync_sincronizando', label: 'Sincronizando', variant: 'info' },
  sync_sincronizado: { id: 'sync_sincronizado', label: 'Sincronizado', variant: 'success' },
  sync_conflicto: { id: 'sync_conflicto', label: 'Conflicto', variant: 'warning' },
  sync_error: { id: 'sync_error', label: 'Error', variant: 'error' },

  vigencia_vigente: { id: 'vigencia_vigente', label: 'Vigente', variant: 'success' },
  vigencia_por_vencer: { id: 'vigencia_por_vencer', label: 'Por vencer', variant: 'warning' },
  vigencia_vencido: { id: 'vigencia_vencido', label: 'Vencido', variant: 'error' },
  vigencia_renovado: { id: 'vigencia_renovado', label: 'Renovado', variant: 'info' },
};

export type ConnectionStatus = 'online' | 'offline' | 'syncing' | 'conflict' | 'error';

export const CONNECTION_LABELS: Record<ConnectionStatus, string> = {
  online: 'En línea',
  offline: 'Sin conexión',
  syncing: 'Sincronizando',
  conflict: 'Conflicto',
  error: 'Error de sincronización',
};
