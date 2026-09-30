export function getAuthErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('Invalid login credentials')) {
    return 'El correo o la contraseña son incorrectos. Verifica tus datos e inténtalo nuevamente.';
  }
  if (message.includes('Email not confirmed')) {
    return 'Tu cuenta no ha sido confirmada. Contacta al administrador del sistema.';
  }
  if (message.includes('User already registered')) {
    return 'Ya existe una cuenta registrada con este correo electrónico.';
  }
  if (message.includes('Password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (message.includes('Unable to validate email address') || message.includes('invalid email')) {
    return 'El correo electrónico ingresado no es válido.';
  }
  if (message.includes('FetchError') || message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'No se pudo conectar con el servidor. Verifica tu conexión a internet e inténtalo nuevamente.';
  }
  if (message.includes('Session missing') || message.includes('session_not_found')) {
    return 'Tu sesión ha expirado. Inicia sesión nuevamente.';
  }
  if (message.includes('JWT expired')) {
    return 'Tu sesión ha expirado. Inicia sesión nuevamente.';
  }

  return 'Ocurrió un error inesperado. Inténtalo nuevamente en unos momentos.';
}

export function getGenericErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('FetchError') || message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
  }

  return 'Ocurrió un error inesperado. Inténtalo nuevamente.';
}
