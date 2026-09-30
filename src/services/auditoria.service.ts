import { supabase } from '@/lib/supabase';
import type { AuditLogEntry, AuditLogFilters } from '@/types/auditoria.types';

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return (error as { message: string }).message;
  }
  return 'Ocurrió un error inesperado.';
}

interface RawAuditRow {
  id: string;
  user_id: string | null;
  action: string;
  module: string;
  record_id: string | null;
  operation: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export async function fetchAuditLog(filters?: AuditLogFilters): Promise<AuditLogEntry[]> {
  let query = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.module) query = query.eq('module', filters.module);
  if (filters?.operation) query = query.eq('operation', filters.operation);
  if (filters?.fechaDesde) query = query.gte('created_at', filters.fechaDesde);
  if (filters?.fechaHasta) query = query.lte('created_at', filters.fechaHasta);

  const { data, error } = await query;
  if (error) throw new Error(getErrorMessage(error));

  const rows = (data ?? []) as unknown as RawAuditRow[];

  const userIds = Array.from(new Set(
    rows.map((r) => r.user_id).filter((id): id is string => id !== null)
  ));

  const nameMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users, error: userError } = await supabase
      .from('user_public_names')
      .select('id, full_name, email')
      .in('id', userIds);
    if (!userError && users) {
      for (const u of users) {
        nameMap.set(u.id, u.full_name ?? u.email ?? '—');
      }
    }
  }

  let result: AuditLogEntry[] = rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    action: row.action,
    module: row.module,
    record_id: row.record_id,
    operation: row.operation,
    details: row.details,
    created_at: row.created_at,
    user_name: row.user_id ? (nameMap.get(row.user_id) ?? '—') : 'Sistema',
  }));

  if (filters?.search) {
    const q = filters.search.toLowerCase().trim();
    result = result.filter((r) =>
      r.action.toLowerCase().includes(q) ||
      r.module.toLowerCase().includes(q) ||
      r.user_name.toLowerCase().includes(q) ||
      (r.record_id?.toLowerCase().includes(q) ?? false)
    );
  }

  return result;
}

export async function fetchAuditModules(): Promise<string[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('module')
    .order('module');

  if (error) throw new Error(getErrorMessage(error));

  const modules = Array.from(new Set((data ?? []).map((r) => (r as { module: string }).module)));
  return modules.sort();
}
