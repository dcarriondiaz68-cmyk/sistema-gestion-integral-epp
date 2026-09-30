/*
# Fase 6 — Corrección de recursión RLS en profiles

## Problema
Las políticas `select_all_profiles_admin` y `update_all_profiles_admin`
creadas en la migración 014 referencian la tabla `profiles` en una
subconsulta dentro de su cláusula USING. Como RLS está habilitado en
`profiles`, esa subconsulta dispara RLS nuevamente, creando recursión
infinita. PostgreSQL devuelve error, la carga del perfil falla, el rol
queda null, y hasPermission() devuelve false para todo — el menú lateral
aparece vacío.

## Solución
1. Crear función `is_admin()` SECURITY DEFINER que consulta `profiles`
   sin RLS (bypass por SECURITY DEFINER), evitando la recursión.
2. Reemplazar `select_all_profiles_admin` para usar `is_admin()`.
3. Reemplazar `update_all_profiles_admin` para usar `is_admin()`.

## Notas
- No se crean ni eliminan tablas.
- No se modifican columnas ni datos.
- Las políticas existentes (`select_own_profile`, `update_own_profile`)
  se conservan intactas.
- Las funciones SECURITY DEFINER de la migración 014 no se modifican.
- No se afectan otras fases.
*/

-- ============================================================
-- Función: is_admin()
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMINISTRADOR'
  );
$$;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- ============================================================
-- Reemplazar política SELECT sin recursión
-- ============================================================
DROP POLICY IF EXISTS "select_all_profiles_admin" ON profiles;
CREATE POLICY "select_all_profiles_admin"
ON profiles FOR SELECT
TO authenticated
USING (is_admin());

-- ============================================================
-- Reemplazar política UPDATE sin recursión
-- ============================================================
DROP POLICY IF EXISTS "update_all_profiles_admin" ON profiles;
CREATE POLICY "update_all_profiles_admin"
ON profiles FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());