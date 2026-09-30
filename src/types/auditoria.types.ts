export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  module: string;
  record_id: string | null;
  operation: string;
  details: Record<string, unknown> | null;
  created_at: string;
  user_name: string;
}

export interface AuditLogFilters {
  module?: string;
  operation?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  search?: string;
}
