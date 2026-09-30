/*
# Fase 7 — Historial EPP + Renovaciones

## Purpose
Add a self-referencing `entrega_origen_id` column to the `entregas` table so that
a renovation entrega can link back to the original entrega it replaces, without
modifying any existing entrega or historical data.

## Changes
1. New Column
   - `entregas.entrega_origen_id` (uuid, nullable, self-referencing FK to `entregas.id`)
     - NULL for all existing entregas (no data modification)
     - Set on renovation entregas to point to the original entrega
     - ON DELETE SET NULL: deleting the original doesn't cascade-delete the renovation

2. Index
   - `idx_entregas_entrega_origen_id` on `entrega_origen_id` for fast lookups
     of which entregas have been renovated by a given original.

3. Security
   - No new policies needed. The existing entregas RLS policies already cover
     SELECT/INSERT/UPDATE/DELETE for authenticated users. The new column is
     accessible under those same policies — no additional restrictions required.

## Important Notes
- This migration does NOT modify, delete, or rename any existing column, row, or policy.
- ENT-000001 and all existing entregas remain untouched (entrega_origen_id defaults to NULL).
- The column is additive only.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'entregas'
      AND column_name = 'entrega_origen_id'
  ) THEN
    ALTER TABLE public.entregas
      ADD COLUMN entrega_origen_id uuid;
  END IF;
END $$;

-- Add self-referencing FK if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'entregas'
      AND constraint_name = 'fk_entregas_entrega_origen'
  ) THEN
    ALTER TABLE public.entregas
      ADD CONSTRAINT fk_entregas_entrega_origen
      FOREIGN KEY (entrega_origen_id) REFERENCES public.entregas(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Index for fast "is this entrega renovated?" lookups
CREATE INDEX IF NOT EXISTS idx_entregas_entrega_origen_id
  ON public.entregas (entrega_origen_id);
