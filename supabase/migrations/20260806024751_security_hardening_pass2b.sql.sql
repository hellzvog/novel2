/*
# Security Hardening Pass 2b: Revoke PUBLIC EXECUTE

The default grant to PUBLIC allows anon/authenticated to inherit EXECUTE.
Revoke PUBLIC on all SECURITY DEFINER admin functions so only the
service_role (edge function) and postgres owner can call them.
*/

REVOKE EXECUTE ON FUNCTION public.admin_create_chapter(text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_create_genre(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_create_novel(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_create_signed_token(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_chapter(text, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_genre(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_novel(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_ensure_tags(text, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_require_auth(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_chapter(text, text, integer, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_genre(text, uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_novel(text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_verify_token(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_password(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_publish_chapters() FROM PUBLIC;

-- admin_login and admin_increment_views remain callable by anon/authenticated
-- (explicitly granted in pass2). Revoke from PUBLIC to avoid ambiguity,
-- then re-grant to the specific roles.
REVOKE EXECUTE ON FUNCTION public.admin_login(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_login(text, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_increment_views(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_increment_views(text) TO anon, authenticated;

-- slugify and update_updated_at are not SECURITY DEFINER, so PUBLIC EXECUTE
-- is low-risk, but revoke from PUBLIC for consistency and re-grant explicitly.
REVOKE EXECUTE ON FUNCTION public.slugify(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.slugify(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_updated_at() TO anon, authenticated;
