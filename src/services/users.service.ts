import { supabase } from '@/lib/supabase';
import type { UserListItem, UserFilters, UserCreateInput, UserInviteInput, UserUpdateInput } from '@/types/users.types';
import { getGenericErrorMessage } from '@/lib/errors';

function getUserErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('Ya existe')) return message;
  if (message.includes('Faltan campos')) return message;
  if (message.includes('No puedes')) return message;
  if (message.includes('al menos 8')) return message;
  if (message.includes('Acceso denegado')) return message;
  if (message.includes('Error al crear')) return message;
  if (message.includes('Error al enviar')) return message;
  if (message.includes('Error al establecer')) return message;
  if (message.includes('Error al suspender')) return message;
  if (message.includes('Error al reactivar')) return message;
  if (message.includes('Usuario creado en Auth')) return message;
  if (message.includes('No autenticado')) return 'Tu sesión ha expirado. Inicia sesión nuevamente.';
  if (message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('FetchError')) {
    return 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
  }
  return 'Ocurrió un error inesperado. Inténtalo nuevamente.';
}

export async function fetchUsers(filters?: UserFilters): Promise<UserListItem[]> {
  let query = supabase
    .from('profiles')
    .select('id, email, full_name, role, phone, active, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (filters?.role && filters.role !== 'all') {
    query = query.eq('role', filters.role);
  }
  if (filters?.status === 'active') {
    query = query.eq('active', true);
  } else if (filters?.status === 'inactive') {
    query = query.eq('active', false);
  }

  const { data, error } = await query;
  if (error) throw new Error(getGenericErrorMessage(error));

  let result = (data ?? []) as unknown as UserListItem[];

  if (filters?.search) {
    const q = filters.search.toLowerCase().trim();
    result = result.filter(
      (u) =>
        (u.full_name?.toLowerCase().includes(q) ?? false) ||
        u.email.toLowerCase().includes(q)
    );
  }

  return result;
}

async function callEdgeFunction(action: string, payload: Record<string, unknown>): Promise<void> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`;
  const { data: session } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
  if (session.session?.access_token) {
    headers.Authorization = `Bearer ${session.session.access_token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...payload }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Error del servidor (${response.status})`);
  }
}

export async function createUser(input: UserCreateInput): Promise<void> {
  try {
    await callEdgeFunction('create_user', {
      email: input.email,
      password: input.password,
      full_name: input.full_name,
      phone: input.phone || null,
      role: input.role,
    });
  } catch (error) {
    throw new Error(getUserErrorMessage(error));
  }
}

export async function inviteUser(input: UserInviteInput): Promise<void> {
  try {
    await callEdgeFunction('invite_user', {
      email: input.email,
      full_name: input.full_name,
      phone: input.phone || null,
      role: input.role,
    });
  } catch (error) {
    throw new Error(getUserErrorMessage(error));
  }
}

export async function updateUser(id: string, input: UserUpdateInput, currentEmail: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('admin_update_profile', {
      target_uid: id,
      p_full_name: input.full_name ?? null,
      p_phone: input.phone ?? null,
      p_role: input.role ?? null,
      p_active: input.active ?? null,
    });
    if (error) throw error;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('No puedes cambiar tu propio rol')) {
      throw new Error('No puedes cambiar tu propio rol');
    }
    if (msg.includes('No puedes desactivar tu propia cuenta')) {
      throw new Error('No puedes desactivar tu propia cuenta');
    }
    if (msg.includes('Acceso denegado')) {
      throw new Error('Acceso denegado: se requiere rol ADMINISTRADOR');
    }
    throw new Error(getGenericErrorMessage(error));
  }
}

export async function toggleUserActive(id: string, active: boolean, email: string): Promise<void> {
  try {
    if (active) {
      await callEdgeFunction('unban_user', { user_id: id, email });
    } else {
      await callEdgeFunction('ban_user', { user_id: id, email });
    }
  } catch (error) {
    throw new Error(getUserErrorMessage(error));
  }
}

export async function resetPassword(email: string): Promise<void> {
  try {
    await callEdgeFunction('reset_password', { email });
  } catch (error) {
    throw new Error(getUserErrorMessage(error));
  }
}

export async function setTempPassword(userId: string, email: string, newPassword: string): Promise<void> {
  try {
    await callEdgeFunction('set_temp_password', { user_id: userId, email, new_password: newPassword });
  } catch (error) {
    throw new Error(getUserErrorMessage(error));
  }
}
