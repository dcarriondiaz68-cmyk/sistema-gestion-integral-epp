/*
# Fase 6 — Gestión de Usuarios

## Descripción
Habilita a los administradores gestionar todos los usuarios del sistema:
listar, crear, editar, activar/desactivar y restablecer contraseñas.

## Cambios de seguridad (RLS)
1. Nueva política SELECT sobre `profiles` para que ADMINISTRADOR vea todos los perfiles.
   La política existente `select_own_profile` se conserva intacta.
2. Nueva política UPDATE sobre `profiles` para que ADMINISTRADOR pueda editar perfiles ajenos.
   La política existente `update_own_profile` se conserva intacta.

## Funciones SECURITY DEFINER
1. `admin_update_profile(target_uid, p_full_name, p_phone, p_role, p_active)`:
   - Verifica que el llamador es ADMINISTRADOR.
   - Impide que un admin modifique su propio rol o estado activo (protección de autocierre).
   - Actualiza el perfil del usuario objetivo.
   - Registra la acción en audit_log.
2. `admin_insert_audit_user(p_action, p_record_id, p_details)`:
   - Verifica que el llamador es ADMINISTRADOR.
   - Inserta un registro en audit_log con módulo 'Users'.

## Notas
- No se crean ni eliminan tablas.
- No se modifican columnas ni datos existentes.
- Las políticas existentes se conservan intactas.
- La eliminación de usuarios es lógica (active = false), no física.
*/

-- ============================================================
-- RLS: ADMINISTRADOR puede ver todos los perfiles
-- ============================================================
DROP POLICY IF EXISTS "select_all_profiles_admin" ON profiles;
CREATE POLICY "select_all_profiles_admin"
ON profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'ADMINISTRADOR'
  )
);

-- ============================================================
-- RLS: ADMINISTRADOR puede actualizar perfiles ajenos
-- ============================================================
DROP POLICY IF EXISTS "update_all_profiles_admin" ON profiles;
CREATE POLICY "update_all_profiles_admin"
ON profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'ADMINISTRADOR'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'ADMINISTRADOR'
  )
);

-- ============================================================
-- Función: admin_update_profile
-- ============================================================
CREATE OR REPLACE FUNCTION admin_update_profile(
  target_uid uuid,
  p_full_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_active boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
  target_row profiles%ROWTYPE;
BEGIN
  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();
  IF caller_role IS NULL OR caller_role <> 'ADMINISTRADOR' THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol ADMINISTRADOR';
  END IF;

  SELECT * INTO target_row FROM profiles WHERE id = target_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  IF target_uid = auth.uid() THEN
    IF p_role IS NOT NULL AND p_role <> caller_role THEN
      RAISE EXCEPTION 'No puedes cambiar tu propio rol';
    END IF;
    IF p_active IS NOT NULL AND p_active = false THEN
      RAISE EXCEPTION 'No puedes desactivar tu propia cuenta';
    END IF;
  END IF;

  UPDATE profiles SET
    full_name = COALESCE(p_full_name, full_name),
    phone = COALESCE(p_phone, phone),
    role = COALESCE(p_role, role),
    active = COALESCE(p_active, active),
    updated_at = now()
  WHERE id = target_uid;

  INSERT INTO audit_log (user_id, action, module, record_id, operation, details)
  VALUES (
    auth.uid(),
    'Actualización de usuario',
    'Users',
    target_uid::text,
    'UPDATE',
    jsonb_build_object(
      'target_email', target_row.email,
      'changes', jsonb_strip_nulls(jsonb_build_object(
        'full_name', CASE WHEN p_full_name IS NOT NULL AND p_full_name IS DISTINCT FROM target_row.full_name THEN p_full_name ELSE NULL END,
        'phone', CASE WHEN p_phone IS NOT NULL AND p_phone IS DISTINCT FROM target_row.phone THEN p_phone ELSE NULL END,
        'role', CASE WHEN p_role IS NOT NULL AND p_role IS DISTINCT FROM target_row.role THEN p_role ELSE NULL END,
        'active', CASE WHEN p_active IS NOT NULL AND p_active IS DISTINCT FROM target_row.active THEN p_active ELSE NULL END
      ))
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_update_profile(uuid, text, text, text, boolean) TO authenticated;

-- ============================================================
-- Función: admin_insert_audit_user
-- ============================================================
CREATE OR REPLACE FUNCTION admin_insert_audit_user(
  p_action text,
  p_record_id text DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
BEGIN
  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();
  IF caller_role IS NULL OR caller_role <> 'ADMINISTRADOR' THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol ADMINISTRADOR';
  END IF;

  INSERT INTO audit_log (user_id, action, module, record_id, operation, details)
  VALUES (
    auth.uid(),
    p_action,
    'Users',
    p_record_id,
    'INSERT',
    p_details
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_insert_audit_user(text, text, jsonb) TO authenticated;