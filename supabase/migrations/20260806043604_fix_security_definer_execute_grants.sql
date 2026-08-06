-- Security hardening: restrict EXECUTE on two SECURITY DEFINER functions
-- that were callable by both anon and authenticated.

-- ─── admin_login ───────────────────────────────────────────────────
-- This function MUST be callable by anon (login happens before the
-- admin is authenticated). But authenticated (signed-in readers) have
-- no reason to call it. Revoke from authenticated only.
REVOKE EXECUTE ON FUNCTION admin_login(text, text) FROM authenticated;
-- anon retains EXECUTE — this is intentional and required for login.

-- ─── admin_increment_views ─────────────────────────────────────────
-- This function does a simple `views = views + 1` on a novel row. It
-- does not need to bypass RLS — it only touches the public `views`
-- column. Switch to SECURITY INVOKER so it runs as the caller and is
-- governed by RLS/policies like any other request.

-- 1. Add an UPDATE policy that allows anyone to increment views on
--    published novels (the only legitimate use of this function).
CREATE POLICY "anon_increment_views"
  ON novels FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 2. Revoke table-wide UPDATE, then grant UPDATE on just the views
--    column so callers can bump views but cannot change any other
--    column through the data API.
REVOKE UPDATE ON novels FROM anon;
REVOKE UPDATE ON novels FROM authenticated;
GRANT UPDATE (views) ON novels TO anon;
GRANT UPDATE (views) ON novels TO authenticated;

-- 3. Recreate the function as SECURITY INVOKER so RLS and column
--    privileges apply. Add search_path for safety.
CREATE OR REPLACE FUNCTION admin_increment_views(p_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO public, extensions
AS $$
BEGIN
  UPDATE novels SET views = views + 1 WHERE slug = p_slug;
END;
$$;
