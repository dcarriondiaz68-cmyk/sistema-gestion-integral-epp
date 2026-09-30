/*
# Audit log — ADMINISTRADOR full read access

## Descripción
Agrega una política SELECT adicional a la tabla `audit_log` para que
los usuarios con rol ADMINISTRADOR puedan visualizar todos los registros
de auditoría en el módulo de Reportes y Auditoría.

La política existente `select_own_audit_log` se conserva intacta, por lo
que cada usuario sigue pudiendo ver sus propios registros. La nueva
policia `select_all_audit_log_admin` permite al ADMINISTRADOR ver todos
los registros sin restricción.

## Seguridad
- No se crean ni eliminan tablas.
- No se modifican columnas ni datos existentes.
- No se altera la política INSERT existente.
- Se agrega una política SELECT que verifica el rol del usuario
  mediante `auth.jwt() ->> 'role'` almacenado en `raw_app_meta_data`.
*/

DROP POLICY IF EXISTS "select_all_audit_log_admin" ON audit_log;

CREATE POLICY "select_all_audit_log_admin"
ON audit_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
  )
);