-- Add user_id column to trabajadores to link auth users with worker records
ALTER TABLE trabajadores
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Ensure one worker per auth user (a user can only be one worker)
CREATE UNIQUE INDEX IF NOT EXISTS trabajadores_user_id_unique_idx
  ON trabajadores(user_id)
  WHERE user_id IS NOT NULL;

-- Allow any authenticated user to read the user_id column (SELECT policy is already true for all)
-- No additional RLS needed: select_trabajadores already grants SELECT to all authenticated users
-- Update/insert remain admin-only, which is correct — workers cannot change their own link