/*
# Fase 6 Paso 1 — Firmas Digitales en Entregas

## Descripción
Agrega el módulo de firmas digitales manuscritas para entregas de EPP
que se encuentran en estado ENTREGADA_PENDIENTE_FIRMA. Crea la tabla
`entrega_firmas` para almacenar las firmas del trabajador y del
responsable, y la función transaccional `registrar_firma` que inserta
la firma y transiciona el estado de la entrega automáticamente.

## Tabla nueva
### entrega_firmas
- id (uuid, primary key)
- entrega_id (uuid, FK a entregas, ON DELETE CASCADE)
- tipo_firma (text, CHECK IN ('TRABAJADOR', 'RESPONSABLE'))
- firma_data (text, not null) — imagen PNG en base64 de la firma manuscrita
- firmado_por (uuid, FK a auth.users, ON DELETE SET NULL) — usuario que capturó la firma
- nombre_firmante (text, not null) — nombre de la persona que firma
- fecha_firma (timestamptz, default now())
- created_at (timestamptz, default now())
- Constraint UNIQUE (entrega_id, tipo_firma) — solo una firma de cada tipo por entrega

## Tabla modificada
### entregas
- Se extiende el CHECK de estado para incluir:
  'FIRMADA_TRABAJADOR' (firma del trabajador registrada, pendiente responsable)
  'FIRMADA_COMPLETA' (ambas firmas registradas)

## Objetos adicionales
- Función `registrar_firma(p_entrega_id, p_tipo_firma, p_firma_data, p_nombre_firmante)`
  (SECURITY DEFINER): valida rol, bloquea entrega, valida estado según tipo,
  inserta firma (UNIQUE previene duplicados), transiciona estado automáticamente,
  audita. Retorna resultado.

## Seguridad (RLS)
- entrega_firmas: SELECT para todos los authenticated.
  INSERT/UPDATE/DELETE: ADMINISTRADOR, ALMACENERO, PREVENCIONISTA.

## Notas
- No se modifica inventario ni kardex al firmar.
- No se modifican las funciones confirmar_entrega ni cancelar_entrega.
- La estructura prepara para Fase 6 Paso 2 (Registro SST/RM050) y cierre documental.
*/

-- ============================================================
-- EXTENDER CHECK DE ESTADO EN entregas
-- ============================================================
DO $$
DECLARE
  v_has_new_states boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_namespace n ON n.oid = con.connamespace
    WHERE con.conname = 'entregas_estado_check'
      AND n.nspname = 'public'
      AND pg_get_constraintdef(con.oid) LIKE '%FIRMADA_TRABAJADOR%'
  ) INTO v_has_new_states;

  IF NOT v_has_new_states THEN
    ALTER TABLE entregas DROP CONSTRAINT IF EXISTS entregas_estado_check;
    ALTER TABLE entregas ADD CONSTRAINT entregas_estado_check
      CHECK (estado IN (
        'GENERADA', 'EN_PREPARACION', 'EN_ESPERA_STOCK',
        'ENTREGADA_PENDIENTE_FIRMA', 'FIRMADA_TRABAJADOR',
        'FIRMADA_COMPLETA', 'CANCELADA'
      ));
  END IF;
END $$;

-- ============================================================
-- TABLA entrega_firmas
-- ============================================================
CREATE TABLE IF NOT EXISTS entrega_firmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id uuid NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,
  tipo_firma text NOT NULL CHECK (tipo_firma IN ('TRABAJADOR', 'RESPONSABLE')),
  firma_data text NOT NULL,
  firmado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre_firmante text NOT NULL,
  fecha_firma timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entrega_id, tipo_firma)
);

ALTER TABLE entrega_firmas ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLÍTICAS RLS
-- ============================================================
DROP POLICY IF EXISTS "select_entrega_firmas" ON entrega_firmas;
CREATE POLICY "select_entrega_firmas" ON entrega_firmas FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_entrega_firmas" ON entrega_firmas;
CREATE POLICY "insert_entrega_firmas" ON entrega_firmas FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMINISTRADOR', 'ALMACENERO', 'PREVENCIONISTA')
    )
  );

DROP POLICY IF EXISTS "update_entrega_firmas" ON entrega_firmas;
CREATE POLICY "update_entrega_firmas" ON entrega_firmas FOR UPDATE
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

DROP POLICY IF EXISTS "delete_entrega_firmas" ON entrega_firmas;
CREATE POLICY "delete_entrega_firmas" ON entrega_firmas FOR DELETE
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
CREATE INDEX IF NOT EXISTS idx_entrega_firmas_entrega_id ON entrega_firmas(entrega_id);

-- ============================================================
-- FUNCIÓN: REGISTRAR FIRMA (SECURITY DEFINER)
-- ============================================================
CREATE OR REPLACE FUNCTION registrar_firma(
  p_entrega_id uuid,
  p_tipo_firma text,
  p_firma_data text,
  p_nombre_firmante text
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
  v_firma_trabajador_exists boolean;
  v_firma_responsable_exists boolean;
  v_nuevo_estado text;
BEGIN
  -- Validar tipo de firma
  IF p_tipo_firma NOT IN ('TRABAJADOR', 'RESPONSABLE') THEN
    RAISE EXCEPTION 'Tipo de firma no válido. Use TRABAJADOR o RESPONSABLE.';
  END IF;

  -- Validar nombre del firmante
  IF p_nombre_firmante IS NULL OR btrim(p_nombre_firmante) = '' THEN
    RAISE EXCEPTION 'El nombre del firmante es obligatorio.';
  END IF;

  -- Validar datos de la firma
  IF p_firma_data IS NULL OR btrim(p_firma_data) = '' THEN
    RAISE EXCEPTION 'La firma no puede estar vacía.';
  END IF;

  -- Obtener rol del usuario
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = v_user_id;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'No se pudo verificar su rol de usuario.';
  END IF;

  -- Verificar permisos
  IF v_user_role NOT IN ('ADMINISTRADOR', 'ALMACENERO', 'PREVENCIONISTA') THEN
    RAISE EXCEPTION 'No tiene permisos para registrar firmas.';
  END IF;

  -- Bloquear la fila de entrega
  SELECT id, numero_entrega, estado INTO v_entrega
  FROM entregas
  WHERE id = p_entrega_id
  FOR UPDATE;

  IF v_entrega.id IS NULL THEN
    RAISE EXCEPTION 'La entrega no existe.';
  END IF;

  -- Validar estado según tipo de firma
  IF p_tipo_firma = 'TRABAJADOR' THEN
    IF v_entrega.estado NOT IN ('ENTREGADA_PENDIENTE_FIRMA') THEN
      RAISE EXCEPTION 'La entrega % no está pendiente de firma. Estado actual: %',
        v_entrega.numero_entrega, v_entrega.estado;
    END IF;
  ELSE -- RESPONSABLE
    IF v_entrega.estado NOT IN ('ENTREGADA_PENDIENTE_FIRMA', 'FIRMADA_TRABAJADOR') THEN
      RAISE EXCEPTION 'La entrega % no está pendiente de firma del responsable. Estado actual: %',
        v_entrega.numero_entrega, v_entrega.estado;
    END IF;
  END IF;

  -- Insertar la firma (UNIQUE constraint previene duplicados)
  INSERT INTO entrega_firmas (entrega_id, tipo_firma, firma_data, firmado_por, nombre_firmante)
  VALUES (p_entrega_id, p_tipo_firma, p_firma_data, v_user_id, p_nombre_firmante)
  ON CONFLICT (entrega_id, tipo_firma) DO NOTHING;

  -- Verificar qué firmas existen ahora
  SELECT
    EXISTS (SELECT 1 FROM entrega_firmas WHERE entrega_id = p_entrega_id AND tipo_firma = 'TRABAJADOR'),
    EXISTS (SELECT 1 FROM entrega_firmas WHERE entrega_id = p_entrega_id AND tipo_firma = 'RESPONSABLE')
  INTO v_firma_trabajador_exists, v_firma_responsable_exists;

  -- Determinar nuevo estado
  IF v_firma_trabajador_exists AND v_firma_responsable_exists THEN
    v_nuevo_estado := 'FIRMADA_COMPLETA';
  ELSIF v_firma_trabajador_exists THEN
    v_nuevo_estado := 'FIRMADA_TRABAJADOR';
  ELSE
    v_nuevo_estado := v_entrega.estado;
  END IF;

  -- Actualizar estado si cambió
  IF v_nuevo_estado <> v_entrega.estado THEN
    UPDATE entregas
    SET estado = v_nuevo_estado, updated_at = now()
    WHERE id = p_entrega_id;
  END IF;

  -- Registrar auditoría
  INSERT INTO audit_log (user_id, action, module, record_id, operation, details)
  VALUES (v_user_id, 'Registrar firma ' || p_tipo_firma, 'Entregas', p_entrega_id, 'INSERT',
          jsonb_build_object('numero_entrega', v_entrega.numero_entrega,
                             'tipo_firma', p_tipo_firma,
                             'nombre_firmante', p_nombre_firmante,
                             'nuevo_estado', v_nuevo_estado));

  RETURN jsonb_build_object(
    'success', true,
    'estado', v_nuevo_estado,
    'numero_entrega', v_entrega.numero_entrega,
    'tipo_firma', p_tipo_firma
  );
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_firma(uuid, text, text, text) TO authenticated;
