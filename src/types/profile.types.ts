import type { UserRole } from '@/constants/roles.constants';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  module: string;
  record_id: string | null;
  operation: string;
  details: Record<string, unknown> | null;
  created_at: string;
}
