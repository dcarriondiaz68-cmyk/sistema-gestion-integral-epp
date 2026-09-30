/*
# Fase 1 — Fundación: Perfiles y Auditoría

## Descripción
Crea las tablas base del sistema de Gestión Integral de EPP:
- `profiles`: Perfiles de usuario vinculados a auth.users, con rol asignado.
- `audit_log`: Registro de auditoría preparado para futuros módulos.

## Tablas nuevas

### profiles
- `id` (uuid, PK): Vinculado a auth.users, elimina en cascada.
- `email` (text, not null): Correo del usuario.
- `full_name` (text, nullable): Nombre completo.
- `role` (text, not null): Rol del sistema (ADMINISTRADOR, PREVENCIONISTA, ALMACENERO, RRHH, TRABAJADOR).
- `avatar_url` (text, nullable): URL del avatar.
- `phone` (text, nullable): Teléfono de contacto.
- `active` (boolean, default true): Estado de la cuenta.
- `created_at` (timestamptz, default now()).
- `updated_at` (timestamptz, default now()).

### audit_log
- `id` (uuid, PK).
- `user_id` (uuid, nullable): Usuario que ejecutó la acción.
- `action` (text, not null): Acción realizada.
- `module` (text, not null): Módulo del sistema.
- `record_id` (text, nullable): ID del registro afectado.
- `operation` (text, not null): Tipo de operación.
- `details` (jsonb, nullable): Detalles adicionales.
- `created_at` (timestamptz, default now()).

## Seguridad
- RLS habilitado en ambas tablas.
- profiles: cada usuario puede leer y actualizar solo su propio perfil.
- audit_log: solo usuarios autenticados pueden leer sus propios registros.
  Las inserciones de auditoría se realizarán desde el servidor en fases posteriores.

## Notas
- Esta migración corresponde exclusivamente a la Fase 1 (Fundación).
- No se crean tablas de módulos de negocio (trabajadores, EPP, inventario, etc.).
- El rol se almacena en la tabla profiles, no en user_metadata, para evitar
  que el usuario pueda modificarlo desde el cliente.
*/

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'TRABAJADOR',
  avatar_url text,
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- AUDIT_LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  module text NOT NULL,
  record_id text,
  operation text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_audit_log" ON audit_log;
CREATE POLICY "select_own_audit_log" ON audit_log FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_module ON audit_log(module);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
