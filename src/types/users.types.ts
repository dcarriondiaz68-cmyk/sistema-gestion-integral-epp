import type { UserRole } from '@/constants/roles.constants';

export interface UserListItem {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserFilters {
  role?: UserRole | 'all';
  status?: 'all' | 'active' | 'inactive';
  search?: string;
}

export interface UserCreateInput {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: UserRole;
}

export interface UserInviteInput {
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
}

export interface UserUpdateInput {
  full_name?: string;
  phone?: string;
  role?: UserRole;
  active?: boolean;
}
