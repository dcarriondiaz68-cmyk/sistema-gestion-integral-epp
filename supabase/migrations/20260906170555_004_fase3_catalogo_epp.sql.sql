/*
# Fase 3 — Catálogo EPP

## Descripción
Crea la tabla catalogo_epp como maestro central de Equipos de Protección Personal.
Este catálogo queda preparado para relacionarse posteriormente con precios,
inventario, matriz Puesto-EPP, entregas e historial mediante FK desde esas tablas.

## Tabla nueva
### catalogo_epp
- id (uuid, primary key)
- codigo (text, unique, not null) — código único del EPP
- nombre (text, not null) — nombre del EPP
- categoria (text, not null) — categoría del EPP
- descripcion (text, nullable) — descripción del EPP
- marca (text, nullable) — marca del EPP
- modelo (text, nullable) — modelo del EPP
- unidad_medida (text, not null) — unidad de medida (und, par, juego, etc.)
- talla_requerida (boolean, default false) — indica si el EPP requiere talla
- lote_requerido (boolean, default false) — indica si el EPP requiere lote
- vida_util_meses (integer, nullable) — vida útil en meses
- activo (boolean, default true) — estado Activo/Inactivo
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

## Seguridad (RLS)
- RLS habilitado en catalogo_epp.
- SELECT: todos los authenticated pueden leer.
- INSERT/UPDATE/DELETE: solo ADMINISTRADOR o ALMACENERO (check profiles.role).
- 4 políticas separadas (SELECT, INSERT, UPDATE, DELETE).

## Índices
- Índice único en codigo.
- Índice en categoria para búsquedas filtradas.

## Notas
- No se crean FK hacia otras tablas; el catálogo es un maestro independiente.
- Las futuras tablas (precios, inventario, matriz puesto-epp, entregas, historial)
  referenciarán catalogo_epp.id mediante FK.
- activo permite desactivar sin eliminar (preserva historial).
*/

-- ============================================================
-- CATALOGO_EPP
-- ============================================================
CREATE TABLE IF NOT EXISTS catalogo_epp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  nombre text NOT NULL,
  categoria text NOT NULL,
  descripcion text,
  marca text,
  modelo text,
  unidad_medida text NOT NULL,
  talla_requerida boolean NOT NULL DEFAULT false,
  lote_requerido boolean NOT NULL DEFAULT false,
  vida_util_meses integer,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE catalogo_epp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_catalogo_epp" ON catalogo_epp;
CREATE POLICY "select_catalogo_epp" ON catalogo_epp FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_catalogo_epp" ON catalogo_epp;
CREATE POLICY "insert_catalogo_epp" ON catalogo_epp FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMINISTRADOR', 'ALMACENERO')
    )
  );

DROP POLICY IF EXISTS "update_catalogo_epp" ON catalogo_epp;
CREATE POLICY "update_catalogo_epp" ON catalogo_epp FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMINISTRADOR', 'ALMACENERO')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMINISTRADOR', 'ALMACENERO')
    )
  );

DROP POLICY IF EXISTS "delete_catalogo_epp" ON catalogo_epp;
CREATE POLICY "delete_catalogo_epp" ON catalogo_epp FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMINISTRADOR', 'ALMACENERO')
    )
  );

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_catalogo_epp_categoria ON catalogo_epp(categoria);
CREATE INDEX IF NOT EXISTS idx_catalogo_epp_activo ON catalogo_epp(activo);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
DROP TRIGGER IF EXISTS trigger_catalogo_epp_updated_at ON catalogo_epp;
CREATE TRIGGER trigger_catalogo_epp_updated_at
  BEFORE UPDATE ON catalogo_epp
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();