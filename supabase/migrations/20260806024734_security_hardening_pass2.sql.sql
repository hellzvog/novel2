/*
# Security Hardening Pass 2

Fixes:
1. Mutable search_path on slugify, update_updated_at, handle_new_user
2. Over-broad EXECUTE grants on SECURITY DEFINER functions
3. RLS tables without policies (admin_login_attempts, admin_token_secret, admin_users)
*/

-- 1. Fix mutable search_path on non-SECURITY DEFINER functions
-- These functions were created without a fixed search_path, allowing
-- an attacker who can create objects in another schema to hijack
-- unqualified name resolution. Recreate with explicit search_path.

ALTER FUNCTION public.slugify(input text) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;

-- 2. Revoke EXECUTE on all SECURITY DEFINER functions from anon and authenticated.
-- These functions run with the owner's privileges; only the service_role
-- (used by the edge function) and internal callers should invoke them.
-- The admin RPC functions all validate a signed token internally, so
-- revoking public EXECUTE is safe and defense-in-depth.

REVOKE EXECUTE ON FUNCTION public.admin_create_chapter(text, text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_create_genre(text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_create_novel(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_create_signed_token(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_delete_chapter(text, text, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_delete_genre(text, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_delete_novel(text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_ensure_tags(text, text[]) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_require_auth(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_update_chapter(text, text, integer, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_update_genre(text, uuid, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_update_novel(text, text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_verify_token(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_password(text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- admin_login and admin_increment_views are intentionally callable by anon:
--   - admin_login: public login endpoint, validates credentials + rate-limits internally
--   - admin_increment_views: called by anonymous readers to bump view counts
-- We keep these EXECUTE grants but ensure they are explicit.
REVOKE EXECUTE ON FUNCTION public.admin_login(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_login(text, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_increment_views(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_increment_views(text) TO anon, authenticated;

-- auto_publish_chapters is called by the edge function using the service
-- role key, so it does not need anon/authenticated EXECUTE.
REVOKE EXECUTE ON FUNCTION public.auto_publish_chapters() FROM anon, authenticated;

-- 3. Add deny-all policies to RLS-enabled tables that have no policies.
-- With RLS enabled and no policies, the default is deny-all for non-owners,
-- but adding an explicit deny policy makes the intent clear and silences
-- the advisor warning.

CREATE POLICY "deny_all_admin_login_attempts" ON public.admin_login_attempts
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "deny_all_admin_token_secret" ON public.admin_token_secret
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "deny_all_admin_users" ON public.admin_users
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);
