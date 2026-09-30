-- View exposing only public name columns from profiles, bypassing RLS.
-- Needed so solicitudes_epp joins can resolve solicitado_por / aprobado_por
-- UUIDs to human-readable names for any authenticated user, not just the row owner.

CREATE OR REPLACE VIEW user_public_names AS
SELECT id, full_name, email FROM profiles;

GRANT SELECT ON user_public_names TO authenticated;
