/*
# Fase 2 — Audit log INSERT policy

## Descripción
Agrega la política INSERT a audit_log para que los usuarios autenticados
puedan registrar acciones de auditoría desde la aplicación.

## Seguridad
- INSERT: cualquier usuario autenticado puede insertar en audit_log.
  El user_id se establece desde el servicio usando auth.uid().
*/

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_audit_log" ON audit_log;
CREATE POLICY "insert_audit_log" ON audit_log FOR INSERT
  TO authenticated WITH CHECK (true);
