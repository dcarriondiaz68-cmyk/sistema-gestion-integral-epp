/*
# Fase 2 — Maestros Organizacionales

## Descripción
Crea las tablas para la gestión de maestros organizacionales: empresa, sedes,
áreas, puestos y trabajadores. Jerarquía: Empresa → Sede → Área → Puesto → Trabajador.

## Tablas nuevas
### empresas
- id, ruc (unique), razon_social, nombre_comercial, domicilio, actividad_economica,
  numero_trabajadores (default 0), activo (default true), created_at, updated_at

### sedes
- id, empresa_id (FK empresas), nombre, codigo, direccion, activo,
  created_at, updated_at. UNIQUE(empresa_id, codigo)

### areas
- id, sede_id (FK sedes), nombre, codigo, descripcion, activo,
  created_at, updated_at. UNIQUE(sede_id, codigo)

### puestos
- id, area_id (FK areas), nombre, codigo, descripcion, activo,
  created_at, updated_at. UNIQUE(area_id, codigo)

### trabajadores
- id, empresa_id (FK), sede_id (FK), area_id (FK), puesto_id (FK),
  nombres, apellidos, dni (unique), codigo_interno (unique),
  fecha_ingreso, telefono, email, estado_laboral (default ACTIVO),
  activo (default true), created_at, updated_at

## Seguridad (RLS)
- RLS habilitado en todas las tablas.
- SELECT: todos los authenticated pueden leer.
- INSERT/UPDATE/DELETE: solo ADMINISTRADOR (check profiles.role).
- 4 políticas por tabla.

## Notas
- ON DELETE RESTRICT en todas las FK.
- DNI y codigo_interno únicos globalmente.
- activo permite desactivar sin eliminar (preserva historial).
*/

-- ============================================================
-- EMPRESAS
-- ============================================================
CREATE TABLE IF NOT EXISTS empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ruc text UNIQUE NOT NULL,
  razon_social text NOT NULL,
  nombre_comercial text,
  domicilio text,
  actividad_economica text,
  numero_trabajadores integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_empresas" ON empresas;
CREATE POLICY "select_empresas" ON empresas FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_empresas" ON empresas;
CREATE POLICY "insert_empresas" ON empresas FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMINISTRADOR')
  );

DROP POLICY IF EXISTS "update_empresas" ON empresas;
CREATE POLICY "update_empresas" ON empresas FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMINISTRADOR')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMINISTRADOR')
  );

DROP POLICY IF EXISTS "delete_empresas" ON empresas;
CREATE POLICY "delete_empresas" ON empresas FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMINISTRADOR')
  );

-- ============================================================
-- SEDES
-- ============================================================
CREATE TABLE IF NOT EXISTS sedes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  nombre text NOT NULL,
  codigo text NOT NULL,
  direccion text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, codigo)
);

ALTER TABLE sedes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_sedes" ON sedes;
CREATE POLICY "select_sedes" ON sedes FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_sedes" ON sedes;
CREATE POLICY "insert_sedes" ON sedes FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMINISTRADOR')
  );

DROP POLICY IF EXISTS "update_sedes" ON sedes;
CREATE POLICY "update_sedes" ON sedes FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMINISTRADOR')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMINISTRADOR')
  );

DROP POLICY IF EXISTS "delete_sedes" ON sedes;
CREATE POLICY "delete_sedes" ON sedes FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMINISTRADOR')
  );

-- ============================================================
-- AREAS
-- ============================================================
CREATE TABLE IF NOT EXISTS areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id uuid NOT NULL REFERENCES sedes(id) ON DELETE RESTRICT,
  nombre text NOT NULL,
  codigo text NOT NULL,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sede_id, codigo)
);

ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_areas" ON areas;
CREATE POLICY "select_areas" ON areas FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_areas" ON areas;
CREATE POLICY "insert_areas" ON areas FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMINISTRADOR')
  );

DROP POLICY IF EXISTS "update_areas" ON areas;
CREATE POLICY "update_areas" ON areas FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMINISTRADOR')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMINISTRADOR')
  );

DROP POLICY IF EXISTS "delete_areas" ON areas;
CREATE POLICY "delete_areas" ON areas FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMINISTRADOR')
  );

-- ============================================================
-- PUESTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS puestos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
  nombre text NOT NULL,
  codigo text NOT NULL,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(area_id, codigo)
);

ALTER TABLE puestos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_puestos" ON puestos;
CREATE POLICY "select_puestos" ON puestos FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_puestos" ON puestos;
CREATE POLICY "insert_puestos" ON puestos FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMINISTRADOR')
  );

DROP POLICY IF EXISTS "update_puestos" ON puestos;
CREATE POLICY "update_puestos" ON puestos FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMINISTRADOR')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMINISTRADOR')
  );

DROP POLICY IF EXISTS "delete_puestos" ON puestos;
CREATE POLICY "delete_puestos" ON puestos FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMINISTRADOR')
  );

-- ============================================================
-- TRABAJADORES
-- ============================================================
CREATE TABLE IF NOT EXISTS trabajadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  sede_id uuid NOT NULL REFERENCES sedes(id) ON DELETE RESTRICT,
  area_id uuid NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
  puesto_id uuid NOT NULL REFERENCES puestos(id) ON DELETE RESTRICT,
  nombres text NOT NULL,
  apellidos text NOT NULL,
  dni text UNIQUE NOT NULL,
  codigo_interno text UNIQUE NOT NULL,
  fecha_ingreso date,
  telefono text,
  email text,
  estado_laboral text NOT NULL DEFAULT 'ACTIVO',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trabajadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_trabajadores" ON trabajadores;
CREATE POLICY "select_trabajadores" ON trabajadores FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_trabajadores" ON trabajadores;
CREATE POLICY "insert_trabajadores" ON trabajadores FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMINISTRADOR')
  );

DROP POLICY IF EXISTS "update_trabajadores" ON trabajadores;
CREATE POLICY "update_trabajadores" ON trabajadores FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMINISTRADOR')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMINISTRADOR')
  );

DROP POLICY IF EXISTS "delete_trabajadores" ON trabajadores;
CREATE POLICY "delete_trabajadores" ON trabajadores FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMINISTRADOR')
  );

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sedes_empresa_id ON sedes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_areas_sede_id ON areas(sede_id);
CREATE INDEX IF NOT EXISTS idx_puestos_area_id ON puestos(area_id);
CREATE INDEX IF NOT EXISTS idx_trabajadores_empresa_id ON trabajadores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_trabajadores_sede_id ON trabajadores(sede_id);
CREATE INDEX IF NOT EXISTS idx_trabajadores_area_id ON trabajadores(area_id);
CREATE INDEX IF NOT EXISTS idx_trabajadores_puesto_id ON trabajadores(puesto_id);
CREATE INDEX IF NOT EXISTS idx_trabajadores_dni ON trabajadores(dni);
CREATE INDEX IF NOT EXISTS idx_trabajadores_codigo_interno ON trabajadores(codigo_interno);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS trigger_empresas_updated_at ON empresas;
CREATE TRIGGER trigger_empresas_updated_at
  BEFORE UPDATE ON empresas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_sedes_updated_at ON sedes;
CREATE TRIGGER trigger_sedes_updated_at
  BEFORE UPDATE ON sedes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_areas_updated_at ON areas;
CREATE TRIGGER trigger_areas_updated_at
  BEFORE UPDATE ON areas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_puestos_updated_at ON puestos;
CREATE TRIGGER trigger_puestos_updated_at
  BEFORE UPDATE ON puestos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_trabajadores_updated_at ON trabajadores;
CREATE TRIGGER trigger_trabajadores_updated_at
  BEFORE UPDATE ON trabajadores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
