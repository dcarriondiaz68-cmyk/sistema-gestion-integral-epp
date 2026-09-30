/*
# Fase 3 — Inventario y Kardex

## Descripción
Crea las tablas `inventario` y `kardex` para gestionar el stock de EPP
por sede y registrar todos los movimientos (ingresos, salidas, ajustes).
Incluye una función SECURITY DEFINER `registrar_movimiento` que actualiza
el stock e inserta el movimiento de kardex atómicamente, validando que
el stock no sea negativo.

## Tablas nuevas

### inventario
- id (uuid, primary key)
- epp_id (uuid, FK a catalogo_epp, ON DELETE RESTRICT)
- sede_id (uuid, FK a sedes, ON DELETE RESTRICT)
- stock_actual (integer, not null, default 0) — cantidad disponible
- stock_minimo (integer, nullable) — umbral de stock bajo
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())
- UNIQUE (epp_id, sede_id) — una fila por combinación EPP-sede

### kardex
- id (uuid, primary key)
- inventario_id (uuid, FK a inventario, ON DELETE CASCADE)
- tipo_movimiento (text, not null) — valores: INGRESO, SALIDA, AJUSTE
- cantidad (integer, not null) — firmada: positiva ingreso, negativa salida/ajuste
- saldo_resultante (integer, not null) — snapshot del stock después del movimiento
- motivo (text, nullable)
- referencia (text, nullable) — para futura vinculación con entregas
- usuario_id (uuid, FK a auth.users, ON DELETE SET NULL) — usuario responsable
- created_at (timestamptz, default now())

## Función nueva

### registrar_movimiento (SECURITY DEFINER)
Parámetros: p_epp_id, p_sede_id, p_tipo_movimiento, p_cantidad, p_motivo, p_referencia
- Valida permisos del usuario (ADMINISTRADOR o ALMACENERO)
- Bloquea la fila de inventario (FOR UPDATE)
- Crea la fila de inventario si no existe (stock 0)
- Valida stock no negativo en salidas
- Actualiza stock_actual
- Inserta el movimiento en kardex con saldo_resultante
- Registra auditoría
- Retorna jsonb con success, nuevo saldo, inventario_id

## Seguridad (RLS)
- inventario: SELECT para todos los authenticated; INSERT/UPDATE/DELETE solo ADMINISTRADOR y ALMACENERO
- kardex: SELECT para todos los authenticated; INSERT/UPDATE/DELETE solo ADMINISTRADOR y ALMACENERO
- 4 políticas separadas por tabla (SELECT, INSERT, UPDATE, DELETE)

## Notas
- No se modifican tablas existentes ni la función procesar_solicitud.
- No se descuenta inventario desde las solicitudes existentes.
- La función registrar_movimiento queda preparada para que Fase 5 (Entregas)
  la invoque con tipo='SALIDA' y referencia=entrega_id.
- El stock no puede ser negativo: la función valida antes de actualizar.
*/

-- ============================================================
-- TABLA inventario
-- ============================================================
CREATE TABLE IF NOT EXISTS inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  epp_id uuid NOT NULL REFERENCES catalogo_epp(id) ON DELETE RESTRICT,
  sede_id uuid NOT NULL REFERENCES sedes(id) ON DELETE RESTRICT,
  stock_actual integer NOT NULL DEFAULT 0,
  stock_minimo integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (epp_id, sede_id)
);

ALTER TABLE inventario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_inventario" ON inventario;
CREATE POLICY "select_inventario" ON inventario FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_inventario" ON inventario;
CREATE POLICY "insert_inventario" ON inventario FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMINISTRADOR', 'ALMACENERO')
    )
  );

DROP POLICY IF EXISTS "update_inventario" ON inventario;
CREATE POLICY "update_inventario" ON inventario FOR UPDATE
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

DROP POLICY IF EXISTS "delete_inventario" ON inventario;
CREATE POLICY "delete_inventario" ON inventario FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMINISTRADOR', 'ALMACENERO')
    )
  );

-- ============================================================
-- TABLA kardex
-- ============================================================
CREATE TABLE IF NOT EXISTS kardex (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventario_id uuid NOT NULL REFERENCES inventario(id) ON DELETE CASCADE,
  tipo_movimiento text NOT NULL CHECK (tipo_movimiento IN ('INGRESO', 'SALIDA', 'AJUSTE')),
  cantidad integer NOT NULL,
  saldo_resultante integer NOT NULL,
  motivo text,
  referencia text,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE kardex ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_kardex" ON kardex;
CREATE POLICY "select_kardex" ON kardex FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_kardex" ON kardex;
CREATE POLICY "insert_kardex" ON kardex FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMINISTRADOR', 'ALMACENERO')
    )
  );

DROP POLICY IF EXISTS "update_kardex" ON kardex;
CREATE POLICY "update_kardex" ON kardex FOR UPDATE
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

DROP POLICY IF EXISTS "delete_kardex" ON kardex;
CREATE POLICY "delete_kardex" ON kardex FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMINISTRADOR', 'ALMACENERO')
    )
  );

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_inventario_epp_id ON inventario(epp_id);
CREATE INDEX IF NOT EXISTS idx_inventario_sede_id ON inventario(sede_id);
CREATE INDEX IF NOT EXISTS idx_kardex_inventario_id ON kardex(inventario_id);
CREATE INDEX IF NOT EXISTS idx_kardex_tipo_movimiento ON kardex(tipo_movimiento);
CREATE INDEX IF NOT EXISTS idx_kardex_created_at ON kardex(created_at DESC);

-- ============================================================
-- TRIGGER: AUTO-UPDATE updated_at en inventario
-- ============================================================
DROP TRIGGER IF EXISTS trigger_inventario_updated_at ON inventario;
CREATE TRIGGER trigger_inventario_updated_at
  BEFORE UPDATE ON inventario
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- FUNCIÓN: REGISTRAR MOVIMIENTO (SECURITY DEFINER)
-- Actualiza stock e inserta kardex atómicamente
-- ============================================================
CREATE OR REPLACE FUNCTION registrar_movimiento(
  p_epp_id uuid,
  p_sede_id uuid,
  p_tipo_movimiento text,
  p_cantidad integer,
  p_motivo text DEFAULT NULL,
  p_referencia text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inventario_id uuid;
  v_stock_actual integer;
  v_nuevo_saldo integer;
  v_cantidad_firmada integer;
  v_user_role text;
  v_user_id uuid := auth.uid();
BEGIN
  -- Validar tipo de movimiento
  IF p_tipo_movimiento NOT IN ('INGRESO', 'SALIDA', 'AJUSTE') THEN
    RAISE EXCEPTION 'Tipo de movimiento no válido. Use INGRESO, SALIDA o AJUSTE.';
  END IF;

  -- Validar cantidad positiva
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor que cero.';
  END IF;

  -- Obtener rol del usuario
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = v_user_id;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'No se pudo verificar su rol de usuario.';
  END IF;

  -- Verificar permisos: solo ADMINISTRADOR o ALMACENERO
  IF v_user_role NOT IN ('ADMINISTRADOR', 'ALMACENERO') THEN
    RAISE EXCEPTION 'No tiene permisos para registrar movimientos de inventario.';
  END IF;

  -- Determinar cantidad firmada
  IF p_tipo_movimiento = 'INGRESO' THEN
    v_cantidad_firmada := p_cantidad;
  ELSIF p_tipo_movimiento = 'SALIDA' THEN
    v_cantidad_firmada := -p_cantidad;
  ELSE -- AJUSTE
    v_cantidad_firmada := p_cantidad;
  END IF;

  -- Buscar o crear la fila de inventario
  SELECT id, stock_actual INTO v_inventario_id, v_stock_actual
  FROM inventario
  WHERE epp_id = p_epp_id AND sede_id = p_sede_id
  FOR UPDATE;

  IF v_inventario_id IS NULL THEN
    -- Crear inventario con stock 0
    INSERT INTO inventario (epp_id, sede_id, stock_actual)
    VALUES (p_epp_id, p_sede_id, 0)
    RETURNING id, stock_actual INTO v_inventario_id, v_stock_actual;
  END IF;

  -- Para SALIDA, validar stock suficiente
  IF p_tipo_movimiento = 'SALIDA' THEN
    IF v_stock_actual < p_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente. Stock actual: %, cantidad solicitada: %',
        v_stock_actual, p_cantidad;
    END IF;
  END IF;

  -- Calcular nuevo saldo
  IF p_tipo_movimiento = 'AJUSTE' THEN
    -- AJUSTE: la cantidad es el valor absoluto del nuevo stock
    v_nuevo_saldo := p_cantidad;
    v_cantidad_firmada := v_nuevo_saldo - v_stock_actual;
  ELSE
    v_nuevo_saldo := v_stock_actual + v_cantidad_firmada;
  END IF;

  -- Validar que el nuevo saldo no sea negativo
  IF v_nuevo_saldo < 0 THEN
    RAISE EXCEPTION 'El saldo resultante no puede ser negativo.';
  END IF;

  -- Actualizar stock
  UPDATE inventario
  SET stock_actual = v_nuevo_saldo, updated_at = now()
  WHERE id = v_inventario_id;

  -- Insertar movimiento en kardex
  INSERT INTO kardex (inventario_id, tipo_movimiento, cantidad, saldo_resultante, motivo, referencia, usuario_id)
  VALUES (v_inventario_id, p_tipo_movimiento, v_cantidad_firmada, v_nuevo_saldo, p_motivo, p_referencia, v_user_id);

  -- Registrar auditoría
  INSERT INTO audit_log (user_id, action, module, record_id, operation, details)
  VALUES (v_user_id, 'Registrar ' || p_tipo_movimiento, 'Inventario', v_inventario_id, 'INSERT',
          jsonb_build_object('tipo', p_tipo_movimiento, 'cantidad', v_cantidad_firmada,
                             'saldo', v_nuevo_saldo, 'motivo', p_motivo, 'referencia', p_referencia));

  RETURN jsonb_build_object(
    'success', true,
    'inventario_id', v_inventario_id,
    'nuevo_saldo', v_nuevo_saldo
  );
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_movimiento(uuid, uuid, text, integer, text, text) TO authenticated;
