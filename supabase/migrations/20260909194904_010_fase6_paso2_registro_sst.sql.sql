/*
# Fase 6 Paso 2 — Registro SST / RM050

## Descripción
Crea el módulo de Registro SST / RM050 (Registro de Equipos de
Seguridad o Emergencia) vinculado a cada entrega de EPP. El registro
se genera automáticamente a partir de los datos existentes de la
entrega, el trabajador, la empresa y las firmas digitales capturadas
en el Paso 1. No se requiere reingresar información.

## Tabla nueva
### registro_sst
- id (uuid, primary key)
- entrega_id (uuid, FK a entregas, UNIQUE — una entrega tiene un solo registro)
- codigo_documento (text, default 'RM050') — código del formato
- version_documento (text, default '01') — versión del formato
- tipo_equipo (text, CHECK IN ('EPP', 'EMERGENCIA'), default 'EPP')
- Snapshot del empleador:
  - empresa_razon_social (text, not null)
  - empresa_ruc (text, not null)
  - empresa_domicilio (text, null)
  - empresa_actividad (text, null)
  - empresa_num_trabajadores (integer, null)
- Snapshot del trabajador:
  - trabajador_nombre (text, not null)
  - trabajador_dni (text, not null)
  - trabajador_area (text, null)
- Snapshot del EPP:
  - epp_nombre (text, not null)
- Fechas:
  - fecha_entrega (timestamptz, not null) — de la entrega
  - fecha_renovacion (timestamptz, null) — calculada si vida_util_meses está disponible
- Responsable:
  - responsable_nombre (text, not null) — de la firma del responsable
  - responsable_cargo (text, null)
- Firmas (copiadas de entrega_firmas):
  - firma_trabajador_data (text, null) — imagen PNG en base64
  - firma_responsable_data (text, null) — imagen PNG en base64
- generado_por (uuid, FK a auth.users, ON DELETE SET NULL)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

## Objetos adicionales
- Función `generar_registro_sst(p_entrega_id)` (SECURITY DEFINER):
  Valida rol (ADMINISTRADOR, ALMACENERO, PREVENCIONISTA con permiso firmas.manage).
  Bloquea la fila de entrega. Valida estado = FIRMADA_COMPLETA.
  Valida que ambas firmas (TRABAJADOR y RESPONSABLE) existan.
  Obtiene datos del trabajador (con sede, área, empresa).
  Calcula fecha_renovacion si el EPP tiene vida_util_meses.
  Snapshots todos los datos en registro_sst (ON CONFLICT DO NOTHING).
  Copia las imágenes de las firmas desde entrega_firmas.
  Audita. Retorna el registro creado o el existente.

## Seguridad (RLS)
- registro_sst: SELECT para todos los authenticated.
  INSERT/UPDATE: ADMINISTRADOR, ALMACENERO, PREVENCIONISTA.

## Notas
- No se modifica inventario ni kardex.
- No se modifican las entregas, firmas, solicitudes ni catálogo.
- El registro persiste independientemente y puede consultarse cuantas
  veces sea necesario sin regenerarse.
- Los datos se snapshottean al momento de la generación para preservar
  la información aunque posteriormente cambien los datos maestros.
- Preparado para futura generación de PDF.
- No se implementa el estado CERRADA en este paso.
*/

-- ============================================================
-- TABLA registro_sst
-- ============================================================
CREATE TABLE IF NOT EXISTS registro_sst (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id uuid NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,
  codigo_documento text NOT NULL DEFAULT 'RM050',
  version_documento text NOT NULL DEFAULT '01',
  tipo_equipo text NOT NULL DEFAULT 'EPP' CHECK (tipo_equipo IN ('EPP', 'EMERGENCIA')),
  empresa_razon_social text NOT NULL,
  empresa_ruc text NOT NULL,
  empresa_domicilio text,
  empresa_actividad text,
  empresa_num_trabajadores integer,
  trabajador_nombre text NOT NULL,
  trabajador_dni text NOT NULL,
  trabajador_area text,
  epp_nombre text NOT NULL,
  fecha_entrega timestamptz NOT NULL,
  fecha_renovacion timestamptz,
  responsable_nombre text NOT NULL,
  responsable_cargo text,
  firma_trabajador_data text,
  firma_responsable_data text,
  generado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entrega_id)
);

ALTER TABLE registro_sst ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLÍTICAS RLS
-- ============================================================
DROP POLICY IF EXISTS "select_registro_sst" ON registro_sst;
CREATE POLICY "select_registro_sst" ON registro_sst FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_registro_sst" ON registro_sst;
CREATE POLICY "insert_registro_sst" ON registro_sst FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMINISTRADOR', 'ALMACENERO', 'PREVENCIONISTA')
    )
  );

DROP POLICY IF EXISTS "update_registro_sst" ON registro_sst;
CREATE POLICY "update_registro_sst" ON registro_sst FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMINISTRADOR', 'ALMACENERO', 'PREVENCIONISTA')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMINISTRADOR', 'ALMACENERO', 'PREVENCIONISTA')
    )
  );

DROP POLICY IF EXISTS "delete_registro_sst" ON registro_sst;
CREATE POLICY "delete_registro_sst" ON registro_sst FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMINISTRADOR'
    )
  );

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_registro_sst_entrega_id ON registro_sst(entrega_id);

-- ============================================================
-- FUNCIÓN: GENERAR REGISTRO SST (SECURITY DEFINER)
-- ============================================================
CREATE OR REPLACE FUNCTION generar_registro_sst(
  p_entrega_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entrega RECORD;
  v_user_role text;
  v_user_id uuid := auth.uid();
  v_trabajador RECORD;
  v_empresa RECORD;
  v_epp RECORD;
  v_firma_trab RECORD;
  v_firma_resp RECORD;
  v_fecha_renovacion timestamptz;
  v_registro_id uuid;
  v_existing registro_sst%ROWTYPE;
BEGIN
  -- Obtener rol del usuario
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = v_user_id;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'No se pudo verificar su rol de usuario.';
  END IF;

  -- Verificar permisos
  IF v_user_role NOT IN ('ADMINISTRADOR', 'ALMACENERO', 'PREVENCIONISTA') THEN
    RAISE EXCEPTION 'No tiene permisos para generar el Registro SST.';
  END IF;

  -- Bloquear la fila de entrega
  SELECT * INTO v_entrega
  FROM entregas
  WHERE id = p_entrega_id
  FOR UPDATE;

  IF v_entrega.id IS NULL THEN
    RAISE EXCEPTION 'La entrega no existe.';
  END IF;

  -- Validar estado
  IF v_entrega.estado <> 'FIRMADA_COMPLETA' THEN
    RAISE EXCEPTION 'La entrega % no tiene ambas firmas completas. Estado actual: %',
      v_entrega.numero_entrega, v_entrega.estado;
  END IF;

  -- Verificar si ya existe un registro (idempotente)
  SELECT * INTO v_existing
  FROM registro_sst
  WHERE entrega_id = p_entrega_id;

  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'registro_id', v_existing.id,
      'already_exists', true
    );
  END IF;

  -- Obtener la firma del trabajador
  SELECT * INTO v_firma_trab
  FROM entrega_firmas
  WHERE entrega_id = p_entrega_id AND tipo_firma = 'TRABAJADOR';

  IF v_firma_trab.id IS NULL THEN
    RAISE EXCEPTION 'Falta la firma del trabajador.';
  END IF;

  -- Obtener la firma del responsable
  SELECT * INTO v_firma_resp
  FROM entrega_firmas
  WHERE entrega_id = p_entrega_id AND tipo_firma = 'RESPONSABLE';

  IF v_firma_resp.id IS NULL THEN
    RAISE EXCEPTION 'Falta la firma del responsable.';
  END IF;

  -- Obtener datos del trabajador con relaciones
  SELECT
    t.nombres,
    t.apellidos,
    t.dni,
    t.empresa_id,
    a.nombre AS area_nombre
  INTO v_trabajador
  FROM trabajadores t
  LEFT JOIN areas a ON a.id = t.area_id
  WHERE t.id = v_entrega.trabajador_id;

  IF v_trabajador.dni IS NULL THEN
    RAISE EXCEPTION 'No se encontraron los datos del trabajador.';
  END IF;

  -- Obtener datos de la empresa
  SELECT
    razon_social,
    ruc,
    domicilio,
    actividad_economica,
    numero_trabajadores
  INTO v_empresa
  FROM empresas
  WHERE id = v_trabajador.empresa_id;

  IF v_empresa.ruc IS NULL THEN
    RAISE EXCEPTION 'No se encontraron los datos de la empresa del trabajador.';
  END IF;

  -- Obtener datos del EPP
  SELECT nombre, vida_util_meses
  INTO v_epp
  FROM catalogo_epp
  WHERE id = v_entrega.epp_id;

  IF v_epp.nombre IS NULL THEN
    RAISE EXCEPTION 'No se encontraron los datos del EPP.';
  END IF;

  -- Calcular fecha de renovación si hay vida útil
  IF v_epp.vida_util_meses IS NOT NULL AND v_epp.vida_util_meses > 0 THEN
    v_fecha_renovacion := v_entrega.fecha_confirmacion + make_interval(months => v_epp.vida_util_meses);
  ELSE
    v_fecha_renovacion := NULL;
  END IF;

  -- Insertar el registro SST
  INSERT INTO registro_sst (
    entrega_id,
    codigo_documento,
    version_documento,
    tipo_equipo,
    empresa_razon_social,
    empresa_ruc,
    empresa_domicilio,
    empresa_actividad,
    empresa_num_trabajadores,
    trabajador_nombre,
    trabajador_dni,
    trabajador_area,
    epp_nombre,
    fecha_entrega,
    fecha_renovacion,
    responsable_nombre,
    responsable_cargo,
    firma_trabajador_data,
    firma_responsable_data,
    generado_por
  )
  VALUES (
    p_entrega_id,
    'RM050',
    '01',
    'EPP',
    v_empresa.razon_social,
    v_empresa.ruc,
    v_empresa.domicilio,
    v_empresa.actividad_economica,
    v_empresa.numero_trabajadores,
    v_trabajador.nombres || ' ' || v_trabajador.apellidos,
    v_trabajador.dni,
    v_trabajador.area_nombre,
    v_epp.nombre,
    COALESCE(v_entrega.fecha_confirmacion, v_entrega.updated_at),
    v_fecha_renovacion,
    v_firma_resp.nombre_firmante,
    CASE
      WHEN v_user_role = 'ADMINISTRADOR' THEN 'Administrador del sistema'
      WHEN v_user_role = 'ALMACENERO' THEN 'Almacenero'
      WHEN v_user_role = 'PREVENCIONISTA' THEN 'Prevencionista / Seguridad'
      ELSE NULL
    END,
    v_firma_trab.firma_data,
    v_firma_resp.firma_data,
    v_user_id
  )
  ON CONFLICT (entrega_id) DO NOTHING
  RETURNING id INTO v_registro_id;

  -- Si ON CONFLICT ejecutó DO NOTHING, obtener el existente
  IF v_registro_id IS NULL THEN
    SELECT id INTO v_registro_id
    FROM registro_sst
    WHERE entrega_id = p_entrega_id;
  END IF;

  -- Registrar auditoría
  INSERT INTO audit_log (user_id, action, module, record_id, operation, details)
  VALUES (v_user_id, 'Generar Registro SST/RM050', 'Registro SST', p_entrega_id, 'INSERT',
          jsonb_build_object('numero_entrega', v_entrega.numero_entrega,
                             'registro_id', v_registro_id));

  RETURN jsonb_build_object(
    'success', true,
    'registro_id', v_registro_id,
    'already_exists', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION generar_registro_sst(uuid) TO authenticated;
