-- Fix scheduled publishing:
-- 1. Re-grant EXECUTE on auto_publish_chapters() to anon (revoked during
--    security hardening, never re-granted). The frontend uses the anon
--    key client and calls this RPC on every page load; without EXECUTE
--    permission the call silently fails and scheduled chapters never
--    get published.
-- 2. Update the function to also set status='published' and
--    published_at (to the current date) so the chapter is fully
--    consistent after auto-publishing.

CREATE OR REPLACE FUNCTION auto_publish_chapters()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
DECLARE
  published_count integer;
BEGIN
  UPDATE chapters
  SET published = true,
      status = 'published',
      published_at = COALESCE(published_at, CURRENT_DATE)
  WHERE published = false
    AND publish_at IS NOT NULL
    AND publish_at <= now();

  GET DIAGNOSTICS published_count = ROW_COUNT;
  RETURN published_count;
END;
$$;

-- Grant execute to anon (frontend) and authenticated
GRANT EXECUTE ON FUNCTION auto_publish_chapters() TO anon, authenticated;
