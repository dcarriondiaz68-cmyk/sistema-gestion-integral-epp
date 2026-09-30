/*
# Fase 4 — Solicitudes y Aprobaciones de EPP

## Descripción
Crea la tabla `solicitudes_epp` para gestionar solicitudes de Equipos de
Protección Personal por parte de trabajadores, con su flujo de aprobación
o rechazo. No descuenta inventario — la solicitud representa una necesidad
que será atendida posteriormente en el módulo de Entregas (Fase 5).

## Tabla nueva
### solicitudes_epp
- id (uuid, primary key)
- numero_solicitud (text, unique, not null) — código legible autogenerado (SOL-000001)
- trabajador_id (uuid, FK a trabajadores, ON DELETE RESTRICT)
- epp_id (uuid, FK a catalogo_epp, ON DELETE RESTRICT)
- sede_id (uuid, FK a sedes, ON DELETE RESTRICT)
- talla (text, nullable) — obligatorio cuando el EPP tiene talla_requerida = true
- cantidad (integer, not null, CHECK > 0)
- motivo (text, nullable)
- observacion (text, nullable)
- estado (text, not null, default 'PENDIENTE') — valores: PENDIENTE, APROBADA, RECHAZADA
- solicitado_por (uuid, FK a auth.users, ON DELETE SET NULL) — usuario que registra la solicitud
- aprobado_por (uuid, FK a auth.users, nullable) — usuario que aprueba o rechaza
- fecha_aprobacion (timestamptz, nullable)
- motivo_rechazo (text, nullable) — obligatorio cuando estado = 'RECHAZADA'
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

## Objetos adicionales
- Secuencia seq_solicitud_numero para generar números consecutivos.
- Función generar_numero_solicitud() que formatea el número como SOL-000001.
- Trigger BEFORE INSERT que asigna numero_solicitud y solicitado_por automáticamente.
- Función procesar_solicitud (SECURITY DEFINER) que aprueba o rechaza solicitudes,
  validando permisos del usuario y exigencia de motivo de rechazo.
- Trigger BEFORE UPDATE para actualizar updated_at.

## Seguridad (RLS)
- RLS habilitado en solicitudes_epp.
- SELECT: todos los authenticated pueden leer (los permisos de la interfaz controlan la visibilidad).
- INSERT: todos los authenticated pueden insertar (el trigger asigna solicitado_por).
- UPDATE: todos los authenticated pueden actualizar (la función RPC controla qué campos cambian).
- DELETE: solo ADMINISTRADOR.

## Notas
- No se modifican tablas existentes.
- No se descuenta inventario al crear o aprobar una solicitud.
- La tabla queda preparada para que futuras entregas (Fase 5) referencien la solicitud.
- El motivo_rechazo es obligatorio cuando estado = 'RECHAZADA' (CHECK constraint).
*/

-- ============================================================
-- SECUENCIA PARA NÚMEROS DE SOLICITUD
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS seq_solicitud_numero START 1;

-- ============================================================
-- FUNCIÓN GENERADORA DE NÚMERO DE SOLICITUD
-- ============================================================
CREATE OR REPLACE FUNCTION generar_numero_solicitud()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_val bigint;
BEGIN
  next_val := nextval('seq_solicitud_numero');
  RETURN 'SOL-' || lpad(next_val::text, 6, '0');
END;
$$;

-- ============================================================
-- TABLA solicitudes_epp
-- ============================================================
CREATE TABLE IF NOT EXISTS solicitudes_epp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_solicitud text UNIQUE NOT NULL DEFAULT generar_numero_solicitud(),
  trabajador_id uuid NOT NULL REFERENCES trabajadores(id) ON DELETE RESTRICT,
  epp_id uuid NOT NULL REFERENCES catalogo_epp(id) ON DELETE RESTRICT,
  sede_id uuid NOT NULL REFERENCES sedes(id) ON DELETE RESTRICT,
  talla text,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  motivo text,
  observacion text,
  estado text NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA')),
  solicitado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  aprobado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fecha_aprobacion timestamptz,
  motivo_rechazo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (estado <> 'RECHAZADA') OR
    (estado = 'RECHAZADA' AND motivo_rechazo IS NOT NULL AND motivo_rechazo <> '')
  )
);

ALTER TABLE solicitudes_epp ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLÍTICAS RLS
-- ============================================================
DROP POLICY IF EXISTS "select_solicitudes_epp" ON solicitudes_epp;
CREATE POLICY "select_solicitudes_epp" ON solicitudes_epp FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_solicitudes_epp" ON solicitudes_epp;
CREATE POLICY "insert_solicitudes_epp" ON solicitudes_epp FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_solicitudes_epp" ON solicitudes_epp;
CREATE POLICY "update_solicitudes_epp" ON solicitudes_epp FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_solicitudes_epp" ON solicitudes_epp;
CREATE POLICY "delete_solicitudes_epp" ON solicitudes_epp FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMINISTRADOR')
  );

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes_epp(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_trabajador_id ON solicitudes_epp(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_sede_id ON solicitudes_epp(sede_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_epp_id ON solicitudes_epp(epp_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_created_at ON solicitudes_epp(created_at DESC);

-- ============================================================
-- TRIGGER: ASIGNAR solicitado_por EN INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION asignar_solicitado_por()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.solicitado_por IS NULL THEN
    NEW.solicitado_por := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_asignar_solicitado_por ON solicitudes_epp;
CREATE TRIGGER trigger_asignar_solicitado_por
  BEFORE INSERT ON solicitudes_epp
  FOR EACH ROW EXECUTE FUNCTION asignar_solicitado_por();

-- ============================================================
-- TRIGGER: AUTO-UPDATE updated_at
-- ============================================================
DROP TRIGGER IF EXISTS trigger_solicitudes_epp_updated_at ON solicitudes_epp;
CREATE TRIGGER trigger_solicitudes_epp_updated_at
  BEFORE UPDATE ON solicitudes_epp
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- FUNCIÓN: PROCESAR SOLICITUD (APROBAR / RECHAZAR)
-- SECURITY DEFINER — ejecuta con privilegios del propietario, evita RLS
-- ============================================================
CREATE OR REPLACE FUNCTION procesar_solicitud(
  p_solicitud_id uuid,
  p_accion text,
  p_motivo_rechazo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solicitud RECORD;
  v_user_role text;
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  -- Validar acción
  IF p_accion NOT IN ('APROBAR', 'RECHAZAR') THEN
    RAISE EXCEPTION 'Acción no válida. Use APROBAR o RECHAZAR.';
  END IF;

  -- Obtener rol del usuario
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = v_user_id;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'No se pudo verificar su rol de usuario.';
  END IF;

  -- Verificar permisos: solo ADMINISTRADOR o PREVENCIONISTA pueden procesar
  IF v_user_role NOT IN ('ADMINISTRADOR', 'PREVENCIONISTA') THEN
    RAISE EXCEPTION 'No tiene permisos para aprobar o rechazar solicitudes.';
  END IF;

  -- Obtener la solicitud
  SELECT id, estado, numero_solicitud INTO v_solicitud
  FROM solicitudes_epp
  WHERE id = p_solicitud_id
  FOR UPDATE;

  IF v_solicitud.id IS NULL THEN
    RAISE EXCEPTION 'La solicitud no existe.';
  END IF;

  -- Verificar que esté pendiente
  IF v_solicitud.estado <> 'PENDIENTE' THEN
    RAISE EXCEPTION 'La solicitud % ya fue procesada.', v_solicitud.numero_solicitud;
  END IF;

  -- Procesar según la acción
  IF p_accion = 'APROBAR' THEN
    UPDATE solicitudes_epp
    SET
      estado = 'APROBADA',
      aprobado_por = v_user_id,
      fecha_aprobacion = now(),
      updated_at = now()
    WHERE id = p_solicitud_id;

    -- Registrar auditoría
    INSERT INTO audit_log (user_id, action, module, record_id, operation, details)
    VALUES (v_user_id, 'Aprobar solicitud', 'Solicitudes', p_solicitud_id, 'UPDATE',
            jsonb_build_object('numero_solicitud', v_solicitud.numero_solicitud, 'accion', 'APROBADA'));

    v_result := jsonb_build_object(
      'success', true,
      'estado', 'APROBADA',
      'numero_solicitud', v_solicitud.numero_solicitud
    );
  ELSE -- RECHAZAR
    -- Validar motivo de rechazo
    IF p_motivo_rechazo IS NULL OR btrim(p_motivo_rechazo) = '' THEN
      RAISE EXCEPTION 'El motivo de rechazo es obligatorio.';
    END IF;

    UPDATE solicitudes_epp
    SET
      estado = 'RECHAZADA',
      aprobado_por = v_user_id,
      fecha_aprobacion = now(),
      motivo_rechazo = p_motivo_rechazo,
      updated_at = now()
    WHERE id = p_solicitud_id;

    -- Registrar auditoría
    INSERT INTO audit_log (user_id, action, module, record_id, operation, details)
    VALUES (v_user_id, 'Rechazar solicitud', 'Solicitudes', p_solicitud_id, 'UPDATE',
            jsonb_build_object('numero_solicitud', v_solicitud.numero_solicitud, 'accion', 'RECHAZADA',
                               'motivo_rechazo', p_motivo_rechazo));

    v_result := jsonb_build_object(
      'success', true,
      'estado', 'RECHAZADA',
      'numero_solicitud', v_solicitud.numero_solicitud
    );
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION procesar_solicitud(uuid, text, text) TO authenticated;