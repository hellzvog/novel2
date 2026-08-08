/*
# Migration Reconciliation — Final Hardened State

This migration reconciles all prior migrations into a single idempotent snapshot.
It ensures every function has the correct signature, SECURITY DEFINER flag,
search_path setting, and EXECUTE grants. It also ensures all RLS policies
match the intended production configuration.

## What this does

1. Re-creates all helper, auth, admin CRUD, auto-publish, and trigger functions
   with correct SECURITY DEFINER + search_path settings.
2. Sets EXECUTE grants:
   - admin_login, admin_verify_token, admin CRUD functions, get_novel_chapter_counts:
     granted to anon + authenticated (protected by internal token checks)
   - auto_publish_chapters, handle_new_user, verify_password, internal helpers:
     revoked from anon + authenticated + PUBLIC (service_role only)
3. Drops and recreates all RLS policies to ensure correct state:
   - Admin tables (admin_users, admin_login_attempts, admin_token_secret): deny all
   - Public read tables (novels, chapters, genres, novel_genres, novel_tags, tags,
     profiles): SELECT to anon + authenticated
   - novels: UPDATE for view counting to anon + authenticated

## Idempotency
All CREATE OR REPLACE statements are safe to re-run.
All policies use DROP POLICY IF EXISTS before CREATE.
All GRANT/REVOKE statements are safe to re-run.
*/

-- ============================================================================
-- 1. Helper functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.slugify(input text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
SELECT lower(
regexp_replace(
regexp_replace(input, '[^a-z0-9]+', '-', 'gi'),
'^-+|-+$', '', 'g'
)
);
$function$;

-- ============================================================================
-- 2. Auth functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verify_password(plain_pass text, hash_pass text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
RETURN crypt(plain_pass, hash_pass) = hash_pass;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_verify_token(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
v_parts text[];
v_payload_b64 text;
v_signature text;
v_payload_text text;
v_payload_bytes bytea;
v_expected_sig text;
v_secret bytea;
v_payload jsonb;
v_exp bigint;
v_now bigint;
BEGIN
v_parts := string_to_array(p_token, '.');
IF array_length(v_parts, 1) IS NULL OR array_length(v_parts, 1) <> 2 THEN
RETURN jsonb_build_object('valid', false);
END IF;

v_payload_b64 := v_parts[1];
v_signature := v_parts[2];

BEGIN
v_payload_bytes := decode(v_payload_b64, 'base64');
v_payload_text := convert_from(v_payload_bytes, 'UTF8');
EXCEPTION WHEN OTHERS THEN
RETURN jsonb_build_object('valid', false);
END;

SELECT secret INTO v_secret FROM admin_token_secret WHERE id = 1;
IF v_secret IS NULL THEN
RETURN jsonb_build_object('valid', false);
END IF;

v_expected_sig := encode(hmac(v_payload_bytes, v_secret, 'sha256'), 'base64');

IF v_signature IS DISTINCT FROM v_expected_sig THEN
RETURN jsonb_build_object('valid', false);
END IF;

BEGIN
v_payload := v_payload_text::jsonb;
EXCEPTION WHEN OTHERS THEN
RETURN jsonb_build_object('valid', false);
END;

v_exp := NULLIF(v_payload->>'exp', '')::bigint;
v_now := extract(epoch from now())::bigint;

IF v_exp IS NULL OR v_now > v_exp THEN
RETURN jsonb_build_object('valid', false);
END IF;

RETURN jsonb_build_object(
'valid', true,
'user', jsonb_build_object(
'id', v_payload->>'sub',
'email', v_payload->>'email'
)
);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_signed_token(p_user_id uuid, p_email text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
v_secret bytea;
v_payload jsonb;
v_payload_text text;
v_payload_bytes bytea;
v_signature text;
BEGIN
SELECT secret INTO v_secret FROM admin_token_secret WHERE id = 1;

v_payload := jsonb_build_object(
'sub', p_user_id,
'email', p_email,
'role', 'admin',
'iat', extract(epoch from now())::bigint,
'exp', extract(epoch from (now() + interval '7 days'))::bigint
);

v_payload_text := v_payload::text;
v_payload_bytes := convert_to(v_payload_text, 'UTF8');
v_signature := encode(hmac(v_payload_bytes, v_secret, 'sha256'), 'base64');

RETURN encode(v_payload_bytes, 'base64') || '.' || v_signature;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_require_auth(p_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
v_result jsonb;
v_user_id uuid;
BEGIN
SELECT admin_verify_token(p_token) INTO v_result;
IF NOT COALESCE((v_result->>'valid')::boolean, false) THEN
RAISE EXCEPTION 'Not authorized';
END IF;
v_user_id := (v_result->'user'->>'id')::uuid;
RETURN v_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_login(p_email text, p_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
v_user admin_users%ROWTYPE;
v_token text;
v_attempts int;
v_identifier text;
BEGIN
v_identifier := lower(trim(p_email));

DELETE FROM admin_login_attempts
WHERE attempted_at < now() - interval '15 minutes';

SELECT count(*) INTO v_attempts
FROM admin_login_attempts
WHERE identifier = v_identifier
AND attempted_at > now() - interval '15 minutes';

IF v_attempts >= 5 THEN
RETURN jsonb_build_object('error', 'Too many failed attempts. Please try again later.');
END IF;

SELECT * INTO v_user FROM admin_users WHERE lower(email) = lower(trim(p_email));

IF v_user.id IS NULL THEN
INSERT INTO admin_login_attempts (identifier) VALUES (v_identifier);
RETURN jsonb_build_object('error', 'Invalid email or password.');
END IF;

IF crypt(p_password, v_user.password_hash) = v_user.password_hash THEN
DELETE FROM admin_login_attempts WHERE identifier = v_identifier;
v_token := admin_create_signed_token(v_user.id, v_user.email);
RETURN jsonb_build_object(
'token', v_token,
'user', jsonb_build_object('id', v_user.id, 'email', v_user.email)
);
ELSE
INSERT INTO admin_login_attempts (identifier) VALUES (v_identifier);
RETURN jsonb_build_object('error', 'Invalid email or password.');
END IF;
END;
$function$;

-- ============================================================================
-- 3. Admin CRUD functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_ensure_tags(p_token text, p_names text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
v_name text;
v_slug text;
BEGIN
PERFORM admin_require_auth(p_token);
FOREACH v_name IN ARRAY p_names LOOP
v_slug := slugify(v_name);
IF v_slug = '' THEN CONTINUE; END IF;
INSERT INTO tags (name, slug) VALUES (v_name, v_slug)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;
END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_genre(p_token text, p_name text, p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
v_id uuid;
BEGIN
PERFORM admin_require_auth(p_token);
IF trim(p_name) = '' THEN RAISE EXCEPTION 'Name is required'; END IF;
IF trim(p_slug) = '' THEN RAISE EXCEPTION 'Slug is required'; END IF;
INSERT INTO genres (name, slug) VALUES (trim(p_name), trim(p_slug))
RETURNING id INTO v_id;
RETURN jsonb_build_object('id', v_id, 'name', trim(p_name), 'slug', trim(p_slug));
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_novel(p_token text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
v_slug text;
v_novel_id uuid;
v_genre_name text;
v_genre_id uuid;
v_tag_name text;
v_tag_id uuid;
v_result jsonb;
v_genres text[];
v_tags text[];
BEGIN
PERFORM admin_require_auth(p_token);

v_slug := slugify(p_data->>'title');
IF v_slug = '' THEN
RAISE EXCEPTION 'Title is required';
END IF;
v_slug := v_slug || '-' || substr(encode(gen_random_bytes(3), 'hex'), 1, 4);

INSERT INTO novels (
slug, title, alt_title, author, status, synopsis, cover_hue, cover_url,
featured, featured_at, popular, popular_at
) VALUES (
v_slug,
p_data->>'title',
NULLIF(p_data->>'alt_title', ''),
p_data->>'author',
COALESCE(p_data->>'status', 'Ongoing'),
COALESCE(p_data->>'synopsis', ''),
COALESCE((p_data->>'cover_hue')::int, 0),
NULLIF(p_data->>'cover_url', ''),
COALESCE((p_data->>'featured')::boolean, false),
CASE WHEN COALESCE((p_data->>'featured')::boolean, false) THEN now() ELSE NULL END,
COALESCE((p_data->>'popular')::boolean, false),
CASE WHEN COALESCE((p_data->>'popular')::boolean, false) THEN now() ELSE NULL END
)
RETURNING id INTO v_novel_id;

IF p_data ? 'genres' THEN
v_genres := ARRAY(SELECT jsonb_array_elements_text(p_data->'genres'));
FOREACH v_genre_name IN ARRAY v_genres LOOP
SELECT id INTO v_genre_id FROM genres WHERE name = v_genre_name LIMIT 1;
IF v_genre_id IS NOT NULL THEN
INSERT INTO novel_genres (novel_id, genre_id) VALUES (v_novel_id, v_genre_id)
ON CONFLICT DO NOTHING;
END IF;
END LOOP;
END IF;

IF p_data ? 'tags' THEN
v_tags := ARRAY(SELECT jsonb_array_elements_text(p_data->'tags'));
PERFORM admin_ensure_tags(p_token, v_tags);
FOREACH v_tag_name IN ARRAY v_tags LOOP
SELECT id INTO v_tag_id FROM tags WHERE slug = slugify(v_tag_name) LIMIT 1;
IF v_tag_id IS NOT NULL THEN
INSERT INTO novel_tags (novel_id, tag_id) VALUES (v_novel_id, v_tag_id)
ON CONFLICT DO NOTHING;
END IF;
END LOOP;
END IF;

SELECT jsonb_build_object('id', v_novel_id, 'slug', v_slug) INTO v_result;
RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_novel(p_token text, p_slug text, p_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
v_novel_id uuid;
v_genre_name text;
v_genre_id uuid;
v_tag_name text;
v_tag_id uuid;
v_genres text[];
v_tags text[];
BEGIN
PERFORM admin_require_auth(p_token);

SELECT id INTO v_novel_id FROM novels WHERE slug = p_slug;
IF v_novel_id IS NULL THEN
RAISE EXCEPTION 'Novel not found';
END IF;

UPDATE novels SET
title = COALESCE(NULLIF(p_data->>'title', ''), title),
alt_title = CASE WHEN p_data ? 'alt_title' THEN NULLIF(p_data->>'alt_title', '') ELSE alt_title END,
author = COALESCE(NULLIF(p_data->>'author', ''), author),
status = COALESCE(NULLIF(p_data->>'status', ''), status),
synopsis = CASE WHEN p_data ? 'synopsis' THEN p_data->>'synopsis' ELSE synopsis END,
cover_hue = CASE WHEN p_data ? 'cover_hue' THEN (p_data->>'cover_hue')::int ELSE cover_hue END,
cover_url = CASE WHEN p_data ? 'cover_url' THEN NULLIF(p_data->>'cover_url', '') ELSE cover_url END,
featured = CASE WHEN p_data ? 'featured' THEN (p_data->>'featured')::boolean ELSE featured END,
featured_at = CASE WHEN p_data ? 'featured' THEN (CASE WHEN (p_data->>'featured')::boolean THEN now() ELSE NULL END) ELSE featured_at END,
popular = CASE WHEN p_data ? 'popular' THEN (p_data->>'popular')::boolean ELSE popular END,
popular_at = CASE WHEN p_data ? 'popular' THEN (CASE WHEN (p_data->>'popular')::boolean THEN now() ELSE NULL END) ELSE popular_at END
WHERE id = v_novel_id;

IF p_data ? 'genres' THEN
DELETE FROM novel_genres WHERE novel_id = v_novel_id;
v_genres := ARRAY(SELECT jsonb_array_elements_text(p_data->'genres'));
FOREACH v_genre_name IN ARRAY v_genres LOOP
SELECT id INTO v_genre_id FROM genres WHERE name = v_genre_name LIMIT 1;
IF v_genre_id IS NOT NULL THEN
INSERT INTO novel_genres (novel_id, genre_id) VALUES (v_novel_id, v_genre_id)
ON CONFLICT DO NOTHING;
END IF;
END LOOP;
END IF;

IF p_data ? 'tags' THEN
DELETE FROM novel_tags WHERE novel_id = v_novel_id;
v_tags := ARRAY(SELECT jsonb_array_elements_text(p_data->'tags'));
PERFORM admin_ensure_tags(p_token, v_tags);
FOREACH v_tag_name IN ARRAY v_tags LOOP
SELECT id INTO v_tag_id FROM tags WHERE slug = slugify(v_tag_name) LIMIT 1;
IF v_tag_id IS NOT NULL THEN
INSERT INTO novel_tags (novel_id, tag_id) VALUES (v_novel_id, v_tag_id)
ON CONFLICT DO NOTHING;
END IF;
END LOOP;
END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_chapter(p_token text, p_novel_slug text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
v_novel_id uuid;
v_chapter_id uuid;
BEGIN
PERFORM admin_require_auth(p_token);

SELECT id INTO v_novel_id FROM novels WHERE slug = p_novel_slug;
IF v_novel_id IS NULL THEN
RAISE EXCEPTION 'Novel not found';
END IF;

INSERT INTO chapters (
novel_id, number, title, content, published_at, status, published, publish_at
) VALUES (
v_novel_id,
(p_data->>'number')::int,
p_data->>'title',
p_data->'content',
NULLIF(p_data->>'published_at', '')::date,
COALESCE(p_data->>'status', 'published'),
COALESCE((p_data->>'published')::boolean, false),
NULLIF(p_data->>'publish_at', '')::timestamptz
)
RETURNING id INTO v_chapter_id;

RETURN jsonb_build_object('id', v_chapter_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_chapter(p_token text, p_novel_slug text, p_chapter_number integer, p_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
v_novel_id uuid;
BEGIN
PERFORM admin_require_auth(p_token);

SELECT id INTO v_novel_id FROM novels WHERE slug = p_novel_slug;
IF v_novel_id IS NULL THEN
RAISE EXCEPTION 'Novel not found';
END IF;

UPDATE chapters SET
title = CASE WHEN p_data ? 'title' THEN p_data->>'title' ELSE title END,
content = CASE WHEN p_data ? 'content' THEN p_data->'content' ELSE content END,
published_at = CASE WHEN p_data ? 'published_at' THEN NULLIF(p_data->>'published_at', '')::date ELSE published_at END,
number = CASE WHEN p_data ? 'number' THEN (p_data->>'number')::int ELSE number END,
status = CASE WHEN p_data ? 'status' THEN p_data->>'status' ELSE status END,
published = CASE WHEN p_data ? 'published' THEN (p_data->>'published')::boolean ELSE published END,
publish_at = CASE WHEN p_data ? 'publish_at' THEN NULLIF(p_data->>'publish_at', '')::timestamptz ELSE publish_at END
WHERE novel_id = v_novel_id AND number = p_chapter_number;
END;
$function$;

-- ============================================================================
-- 4. Auto-publish and chapter counts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_publish_chapters()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_novel_chapter_counts()
 RETURNS TABLE(novel_id uuid, chapter_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
SELECT novel_id, COUNT(*)::bigint AS chapter_count
FROM chapters
GROUP BY novel_id;
$function$;

-- ============================================================================
-- 5. Trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
INSERT INTO profiles (id, email, is_admin)
VALUES (NEW.id, NEW.email, false)
ON CONFLICT (id) DO NOTHING;
RETURN NEW;
END;
$function$;

-- ============================================================================
-- 6. EXECUTE grants
-- ============================================================================

-- Public-facing auth functions: callable by anon + authenticated
GRANT EXECUTE ON FUNCTION public.admin_login(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_token(text) TO anon, authenticated;

-- Admin CRUD functions: callable by anon + authenticated (protected by token check inside)
GRANT EXECUTE ON FUNCTION public.admin_create_genre(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_novel(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_novel(text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_chapter(text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_chapter(text, text, integer, jsonb) TO anon, authenticated;

-- Read-only RPC: callable by anon + authenticated
GRANT EXECUTE ON FUNCTION public.get_novel_chapter_counts() TO anon, authenticated;

-- Internal/privileged functions: service_role only
REVOKE EXECUTE ON FUNCTION public.auto_publish_chapters() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_publish_chapters() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_publish_chapters() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.verify_password(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_password(text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_password(text, text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.admin_require_auth(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_require_auth(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_require_auth(text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.admin_create_signed_token(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_create_signed_token(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_create_signed_token(uuid, text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.admin_ensure_tags(text, text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_ensure_tags(text, text[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_ensure_tags(text, text[]) FROM PUBLIC;

-- ============================================================================
-- 7. RLS policies (drop and recreate to ensure correct state)
-- ============================================================================

-- Admin tables: deny all access to anon/authenticated
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all_admin_users ON public.admin_users;
CREATE POLICY deny_all_admin_users ON public.admin_users
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all_admin_login_attempts ON public.admin_login_attempts;
CREATE POLICY deny_all_admin_login_attempts ON public.admin_login_attempts
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

ALTER TABLE public.admin_token_secret ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_all_admin_token_secret ON public.admin_token_secret;
CREATE POLICY deny_all_admin_token_secret ON public.admin_token_secret
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Public read tables
ALTER TABLE public.novels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read_novels ON public.novels;
CREATE POLICY anon_read_novels ON public.novels
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS anon_increment_views ON public.novels;
CREATE POLICY anon_increment_views ON public.novels
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read_chapters ON public.chapters;
CREATE POLICY anon_read_chapters ON public.chapters
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read_genres ON public.genres;
CREATE POLICY anon_read_genres ON public.genres
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.novel_genres ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read_novel_genres ON public.novel_genres;
CREATE POLICY anon_read_novel_genres ON public.novel_genres
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.novel_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read_novel_tags ON public.novel_tags;
CREATE POLICY anon_read_novel_tags ON public.novel_tags
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read_tags ON public.tags;
CREATE POLICY anon_read_tags ON public.tags
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS read_profiles ON public.profiles;
CREATE POLICY read_profiles ON public.profiles
  FOR SELECT TO anon, authenticated USING (true);
