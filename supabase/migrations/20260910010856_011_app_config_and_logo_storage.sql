/*
# App Configuration Table + Logo Storage

## Descripción
Crea una tabla minimal de configuración de la aplicación (`app_config`) 
para almacenar ajustes globales del sistema como la URL del logo de la empresa.
También crea un bucket público en Supabase Storage para almacenar la imagen del logo.

## Tabla nueva
### app_config
- key (text, primary key) — clave de configuración (ej: 'logo_url')
- value (text, not null) — valor de configuración
- updated_by (uuid, FK a auth.users, ON DELETE SET NULL)
- updated_at (timestamptz, default now())

## Storage
- Bucket público `logos` para almacenar imágenes de logo de la empresa.

## Seguridad (RLS)
- app_config: SELECT para todos los authenticated (todos pueden ver el logo).
  INSERT/UPDATE/DELETE: solo ADMINISTRADOR.

## Notas
- No se modifica ninguna tabla existente.
- No se modifica inventario, kardex, solicitudes, entregas ni firmas.
- El logo se almacena como imagen en el bucket `logos` y su URL pública
  se guarda en `app_config` con key='logo_url'.
- Si no hay logo configurado, el documento RM050 muestra un espacio reservado.
*/

-- ============================================================
-- TABLA app_config
-- ============================================================
CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLÍTICAS RLS — app_config
-- ============================================================
DROP POLICY IF EXISTS "select_app_config" ON app_config;
CREATE POLICY "select_app_config" ON app_config FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_app_config" ON app_config;
CREATE POLICY "insert_app_config" ON app_config FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  );

DROP POLICY IF EXISTS "update_app_config" ON app_config;
CREATE POLICY "update_app_config" ON app_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  );

DROP POLICY IF EXISTS "delete_app_config" ON app_config;
CREATE POLICY "delete_app_config" ON app_config FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  );

-- ============================================================
-- STORAGE BUCKET — logos
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE POLICIES — logos bucket
-- ============================================================
DROP POLICY IF EXISTS "select_logos" ON storage.objects;
CREATE POLICY "select_logos" ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "insert_logos" ON storage.objects;
CREATE POLICY "insert_logos" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  );

DROP POLICY IF EXISTS "update_logos" ON storage.objects;
CREATE POLICY "update_logos" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  )
  WITH CHECK (
    bucket_id = 'logos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  );

DROP POLICY IF EXISTS "delete_logos" ON storage.objects;
CREATE POLICY "delete_logos" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  );
