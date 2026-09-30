/*
# Fase 5 — Entregas de EPP

## Descripción
Crea la tabla `entregas` que gestiona el flujo de entrega física de EPP
a trabajadores, desde su generación (desde una solicitud aprobada o directa)
hasta la confirmación que descuenta inventario y genera el movimiento de kardex.
Incluye funciones transaccionales `confirmar_entrega` y `cancelar_entrega`
que garantizan integridad atómica.

## Tabla nueva
### entregas
- id (uuid, primary key)
- numero_entrega (text, unique, not null) — código legible autogenerado (ENT-000001)
- solicitud_id (uuid, FK a solicitudes_epp, nullable, ON DELETE SET NULL) — solicitud de origen
- trabajador_id (uuid, FK a trabajadores, ON DELETE RESTRICT)
- epp_id (uuid, FK a catalogo_epp, ON DELETE RESTRICT)
- sede_id (uuid, FK a sedes, ON DELETE RESTRICT)
- talla (text, nullable)
- cantidad_entregada (integer, not null, CHECK > 0)
- cantidad_autorizada (integer, not null) — cantidad original de la solicitud o igual a entregada
- estado (text, not null, default 'GENERADA')
  Valores: GENERADA, EN_PREPARACION, EN_ESPERA_STOCK, ENTREGADA_PENDIENTE_FIRMA, CANCELADA
- precio_historico (numeric(12,2), nullable) — snapshot del precio del EPP al momento de confirmar
- kardex_id (uuid, FK a kardex, nullable, ON DELETE SET NULL) — vínculo con el movimiento de kardex
- generado_por (uuid, FK a auth.users, ON DELETE SET NULL) — usuario que genera la entrega
- confirmado_por (uuid, FK a auth.users, nullable, ON DELETE SET NULL) — usuario que confirma
- fecha_confirmacion (timestamptz, nullable)
- motivo_cancelacion (text, nullable) — obligatorio cuando estado = 'CANCELADA'
- observacion (text, nullable)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

## Tabla modificada
### catalogo_epp
- Se agrega columna `precio_unitario` (numeric(12,2), nullable) — precio unitario del EPP.
  Este precio se snapshoteará en entregas.precio_historico al confirmar.

## Objetos adicionales
- Secuencia `seq_entrega_numero` para números consecutivos.
- Función `generar_numero_entrega()` → ENT-000001.
- Trigger BEFORE INSERT que asigna numero_entrega y generado_por automáticamente.
- Trigger BEFORE UPDATE para actualizar updated_at.
- Función `confirmar_entrega(p_entrega_id)` (SECURITY DEFINER):
  Valida rol (ADMINISTRADOR, ALMACENERO, PREVENCIONISTA).
  Bloquea la fila de entrega. Valida estado EN_PREPARACION.
  Lee el stock del inventario (epp_id + sede_id).
  Si stock insuficiente → actualiza estado a EN_ESPERA_STOCK, audita, retorna.
  Si stock suficiente → descuenta stock, inserta kardex con referencia=numero_entrega,
    actualiza entrega con kardex_id, confirmado_por, fecha_confirmacion, precio_historico,
    estado = ENTREGADA_PENDIENTE_FIRMA. Audita. Retorna.
  Todo atómico: si algo falla, la entrega no se marca como entregada.
- Función `cancelar_entrega(p_entrega_id, p_motivo)` (SECURITY DEFINER):
  Valida rol. Valida estado (GENERADA o EN_PREPARACION o EN_ESPERA_STOCK).
  Establece estado = CANCELADA con motivo. Audita.

## Seguridad (RLS)
- entregas: SELECT para todos los authenticated.
  INSERT/UPDATE/DELETE: ADMINISTRADOR, ALMACENERO, PREVENCIONISTA (perfiles con entregas.manage).

## Notas
- No se modifican tablas existentes destructivamente.
- No se modifica la función registrar_movimiento existente — confirmar_entrega
  replica la lógica de descuento inline para mantener atomicidad y permitir
  el vínculo directo con kardex_id.
- La estructura queda preparada para Fase 6 (Firmas): el estado ENTREGADA_PENDIENTE_FIRMA
  es terminal en esta fase y será el punto de partida para firmas de trabajador y responsable.
- No se implementa control de lotes (no existe tabla de lotes aún).
- El precio_historico se captura al confirmar la entrega, no al generarla.
*/

-- ============================================================
-- ADD precio_unitario TO catalogo_epp
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'catalogo_epp' AND column_name = 'precio_unitario'
  ) THEN
    ALTER TABLE catalogo_epp ADD COLUMN precio_unitario numeric(12,2);
  END IF;
END $$;

-- ============================================================
-- SECUENCIA PARA NÚMEROS DE ENTREGA
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS seq_entrega_numero START 1;

-- ============================================================
-- FUNCIÓN GENERADORA DE NÚMERO DE ENTREGA
-- ============================================================
CREATE OR REPLACE FUNCTION generar_numero_entrega()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_val bigint;
BEGIN
  next_val := nextval('seq_entrega_numero');
  RETURN 'ENT-' || lpad(next_val::text, 6, '0');
END;
$$;

-- ============================================================
-- TABLA entregas
-- ============================================================
CREATE TABLE IF NOT EXISTS entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_entrega text UNIQUE NOT NULL DEFAULT generar_numero_entrega(),
  solicitud_id uuid REFERENCES solicitudes_epp(id) ON DELETE SET NULL,
  trabajador_id uuid NOT NULL REFERENCES trabajadores(id) ON DELETE RESTRICT,
  epp_id uuid NOT NULL REFERENCES catalogo_epp(id) ON DELETE RESTRICT,
  sede_id uuid NOT NULL REFERENCES sedes(id) ON DELETE RESTRICT,
  talla text,
  cantidad_entregada integer NOT NULL CHECK (cantidad_entregada > 0),
  cantidad_autorizada integer NOT NULL,
  estado text NOT NULL DEFAULT 'GENERADA'
    CHECK (estado IN ('GENERADA', 'EN_PREPARACION', 'EN_ESPERA_STOCK', 'ENTREGADA_PENDIENTE_FIRMA', 'CANCELADA')),
  precio_historico numeric(12,2),
  kardex_id uuid REFERENCES kardex(id) ON DELETE SET NULL,
  generado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fecha_confirmacion timestamptz,
  motivo_cancelacion text,
  observacion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (estado <> 'CANCELADA') OR
    (estado = 'CANCELADA' AND motivo_cancelacion IS NOT NULL AND motivo_cancelacion <> '')
  )
);

ALTER TABLE entregas ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLÍTICAS RLS
-- ============================================================
DROP POLICY IF EXISTS "select_entregas" ON entregas;
CREATE POLICY "select_entregas" ON entregas FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_entregas" ON entregas;
CREATE POLICY "insert_entregas" ON entregas FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMINISTRADOR', 'ALMACENERO', 'PREVENCIONISTA')
    )
  );

DROP POLICY IF EXISTS "update_entregas" ON entregas;
CREATE POLICY "update_entregas" ON entregas FOR UPDATE
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

DROP POLICY IF EXISTS "delete_entregas" ON entregas;
CREATE POLICY "delete_entregas" ON entregas FOR DELETE
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
CREATE INDEX IF NOT EXISTS idx_entregas_estado ON entregas(estado);
CREATE INDEX IF NOT EXISTS idx_entregas_trabajador_id ON entregas(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_entregas_sede_id ON entregas(sede_id);
CREATE INDEX IF NOT EXISTS idx_entregas_epp_id ON entregas(epp_id);
CREATE INDEX IF NOT EXISTS idx_entregas_solicitud_id ON entregas(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_entregas_created_at ON entregas(created_at DESC);

-- ============================================================
-- TRIGGER: ASIGNAR generado_por EN INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION asignar_generado_por()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.generado_por IS NULL THEN
    NEW.generado_por := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_asignar_generado_por ON entregas;
CREATE TRIGGER trigger_asignar_generado_por
  BEFORE INSERT ON entregas
  FOR EACH ROW EXECUTE FUNCTION asignar_generado_por();

-- ============================================================
-- TRIGGER: AUTO-UPDATE updated_at
-- ============================================================
DROP TRIGGER IF EXISTS trigger_entregas_updated_at ON entregas;
CREATE TRIGGER trigger_entregas_updated_at
  BEFORE UPDATE ON entregas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- FUNCIÓN: CONFIRMAR ENTREGA (SECURITY DEFINER)
-- Descuenta inventario, genera kardex, actualiza entrega — atómico
-- ============================================================
CREATE OR REPLACE FUNCTION confirmar_entrega(
  p_entrega_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entrega RECORD;
  v_inventario_id uuid;
  v_stock_actual integer;
  v_nuevo_saldo integer;
  v_kardex_id uuid;
  v_precio numeric(12,2);
  v_user_role text;
  v_user_id uuid := auth.uid();
BEGIN
  -- Obtener rol del usuario
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = v_user_id;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'No se pudo verificar su rol de usuario.';
  END IF;

  -- Verificar permisos: ADMINISTRADOR, ALMACENERO, PREVENCIONISTA
  IF v_user_role NOT IN ('ADMINISTRADOR', 'ALMACENERO', 'PREVENCIONISTA') THEN
    RAISE EXCEPTION 'No tiene permisos para confirmar entregas.';
  END IF;

  -- Bloquear la fila de entrega
  SELECT id, numero_entrega, epp_id, sede_id, cantidad_entregada, estado
  INTO v_entrega
  FROM entregas
  WHERE id = p_entrega_id
  FOR UPDATE;

  IF v_entrega.id IS NULL THEN
    RAISE EXCEPTION 'La entrega no existe.';
  END IF;

  -- Validar estado: debe estar EN_PREPARACION
  IF v_entrega.estado NOT IN ('EN_PREPARACION', 'EN_ESPERA_STOCK') THEN
    RAISE EXCEPTION 'La entrega % no está en preparación. Estado actual: %',
      v_entrega.numero_entrega, v_entrega.estado;
  END IF;

  -- Bloquear la fila de inventario
  SELECT id, stock_actual INTO v_inventario_id, v_stock_actual
  FROM inventario
  WHERE epp_id = v_entrega.epp_id AND sede_id = v_entrega.sede_id
  FOR UPDATE;

  -- Si no existe inventario o stock insuficiente → EN_ESPERA_STOCK
  IF v_inventario_id IS NULL OR v_stock_actual < v_entrega.cantidad_entregada THEN
    UPDATE entregas
    SET estado = 'EN_ESPERA_STOCK', updated_at = now()
    WHERE id = p_entrega_id;

    INSERT INTO audit_log (user_id, action, module, record_id, operation, details)
    VALUES (v_user_id, 'Entrega en espera de stock', 'Entregas', p_entrega_id, 'UPDATE',
            jsonb_build_object('numero_entrega', v_entrega.numero_entrega,
                               'stock_actual', COALESCE(v_stock_actual, 0),
                               'cantidad_solicitada', v_entrega.cantidad_entregada));

    RETURN jsonb_build_object(
      'success', true,
      'estado', 'EN_ESPERA_STOCK',
      'numero_entrega', v_entrega.numero_entrega,
      'stock_disponible', COALESCE(v_stock_actual, 0)
    );
  END IF;

  -- Stock suficiente → descontar
  v_nuevo_saldo := v_stock_actual - v_entrega.cantidad_entregada;

  -- Actualizar inventario
  UPDATE inventario
  SET stock_actual = v_nuevo_saldo, updated_at = now()
  WHERE id = v_inventario_id;

  -- Insertar movimiento de kardex
  INSERT INTO kardex (inventario_id, tipo_movimiento, cantidad, saldo_resultante, motivo, referencia, usuario_id)
  VALUES (v_inventario_id, 'SALIDA', -v_entrega.cantidad_entregada, v_nuevo_saldo,
          'Entrega ' || v_entrega.numero_entrega, v_entrega.numero_entrega, v_user_id)
  RETURNING id INTO v_kardex_id;

  -- Capturar precio histórico del catálogo
  SELECT precio_unitario INTO v_precio
  FROM catalogo_epp
  WHERE id = v_entrega.epp_id;

  -- Actualizar entrega
  UPDATE entregas
  SET
    estado = 'ENTREGADA_PENDIENTE_FIRMA',
    kardex_id = v_kardex_id,
    confirmado_por = v_user_id,
    fecha_confirmacion = now(),
    precio_historico = v_precio,
    updated_at = now()
  WHERE id = p_entrega_id;

  -- Registrar auditoría
  INSERT INTO audit_log (user_id, action, module, record_id, operation, details)
  VALUES (v_user_id, 'Confirmar entrega', 'Entregas', p_entrega_id, 'UPDATE',
          jsonb_build_object('numero_entrega', v_entrega.numero_entrega,
                             'kardex_id', v_kardex_id,
                             'cantidad', v_entrega.cantidad_entregada,
                             'nuevo_saldo', v_nuevo_saldo,
                             'precio_historico', v_precio));

  RETURN jsonb_build_object(
    'success', true,
    'estado', 'ENTREGADA_PENDIENTE_FIRMA',
    'numero_entrega', v_entrega.numero_entrega,
    'kardex_id', v_kardex_id,
    'nuevo_saldo', v_nuevo_saldo
  );
END;
$$;

GRANT EXECUTE ON FUNCTION confirmar_entrega(uuid) TO authenticated;

-- ============================================================
-- FUNCIÓN: CANCELAR ENTREGA (SECURITY DEFINER)
-- ============================================================
CREATE OR REPLACE FUNCTION cancelar_entrega(
  p_entrega_id uuid,
  p_motivo text
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
BEGIN
  -- Validar motivo
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'El motivo de cancelación es obligatorio.';
  END IF;

  -- Obtener rol
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = v_user_id;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'No se pudo verificar su rol de usuario.';
  END IF;

  IF v_user_role NOT IN ('ADMINISTRADOR', 'ALMACENERO', 'PREVENCIONISTA') THEN
    RAISE EXCEPTION 'No tiene permisos para cancelar entregas.';
  END IF;

  -- Bloquear la fila
  SELECT id, numero_entrega, estado INTO v_entrega
  FROM entregas
  WHERE id = p_entrega_id
  FOR UPDATE;

  IF v_entrega.id IS NULL THEN
    RAISE EXCEPTION 'La entrega no existe.';
  END IF;

  -- Solo se puede cancelar si no ha sido entregada
  IF v_entrega.estado NOT IN ('GENERADA', 'EN_PREPARACION', 'EN_ESPERA_STOCK') THEN
    RAISE EXCEPTION 'La entrega % no puede cancelarse en su estado actual: %',
      v_entrega.numero_entrega, v_entrega.estado;
  END IF;

  -- Cancelar
  UPDATE entregas
  SET
    estado = 'CANCELADA',
    motivo_cancelacion = p_motivo,
    updated_at = now()
  WHERE id = p_entrega_id;

  -- Auditar
  INSERT INTO audit_log (user_id, action, module, record_id, operation, details)
  VALUES (v_user_id, 'Cancelar entrega', 'Entregas', p_entrega_id, 'UPDATE',
          jsonb_build_object('numero_entrega', v_entrega.numero_entrega,
                             'motivo', p_motivo));

  RETURN jsonb_build_object(
    'success', true,
    'estado', 'CANCELADA',
    'numero_entrega', v_entrega.numero_entrega
  );
END;
$$;

GRANT EXECUTE ON FUNCTION cancelar_entrega(uuid, text) TO authenticated;
