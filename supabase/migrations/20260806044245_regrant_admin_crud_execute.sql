-- Re-grant EXECUTE on admin CRUD functions to anon.
-- These functions all accept a p_token parameter and verify it via
-- admin_require_auth() before performing any action, so they are safe
-- to expose to the anon role (the admin is not a Supabase auth user;
-- they authenticate via a signed HMAC token).

GRANT EXECUTE ON FUNCTION admin_create_genre(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION admin_update_genre(text, uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION admin_delete_genre(text, uuid) TO anon;

GRANT EXECUTE ON FUNCTION admin_create_novel(text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION admin_update_novel(text, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION admin_delete_novel(text, text) TO anon;

GRANT EXECUTE ON FUNCTION admin_create_chapter(text, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION admin_update_chapter(text, text, integer, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION admin_delete_chapter(text, text, integer) TO anon;

GRANT EXECUTE ON FUNCTION admin_ensure_tags(text, text[]) TO anon;

-- admin_verify_token is needed by the frontend to validate the stored
-- token on page load. It takes the token as a parameter and only
-- returns valid/invalid — no sensitive data is exposed.
GRANT EXECUTE ON FUNCTION admin_verify_token(text) TO anon;
