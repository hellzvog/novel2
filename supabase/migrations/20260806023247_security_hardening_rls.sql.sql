/*
# Security Hardening: Row Level Security Lockdown

## Overview
Locks down all content tables so anonymous users can only SELECT
(read) public data. All INSERT, UPDATE, and DELETE operations are
removed from anon/authenticated RLS policies and moved into
SECURITY DEFINER functions that validate the admin token before
performing any mutation.

## Problems Fixed
1. **Anon could INSERT/UPDATE/DELETE** on novels, chapters, genres,
   tags, novel_genres, novel_tags — anyone with the anon key could
   create, modify, or destroy content.
2. **No admin authorization on mutations** — the frontend "admin"
   check was client-side only; the database had no server-side
   enforcement.

## Tables Modified
- `novels` — SELECT only for anon/authenticated; write policies dropped.
- `chapters` — SELECT only for anon/authenticated; write policies dropped.
- `genres` — SELECT only for anon/authenticated; write policies dropped.
- `tags` — SELECT only for anon/authenticated; write policies dropped.
- `novel_genres` — SELECT only for anon/authenticated; write policies dropped.
- `novel_tags` — SELECT only for anon/authenticated; write policies dropped.
- `profiles` — SELECT only for anon/authenticated; existing authenticated
  INSERT/UPDATE policies dropped (this app has no user signup flow;
  profiles is only used for the dashboard user count).

## New SECURITY DEFINER Functions
All functions validate the admin token via `admin_verify_token`
before performing any mutation. If the token is invalid or expired,
they raise `Not authorized`. They all use `SET search_path = public`.

- `admin_create_novel(p_data jsonb)` — creates a novel + links genres/tags.
- `admin_update_novel(p_slug text, p_data jsonb)` — updates a novel + relinks genres/tags.
- `admin_delete_novel(p_slug text)` — deletes a novel (cascades to chapters).
- `admin_create_chapter(p_novel_slug text, p_data jsonb)` — creates a chapter.
- `admin_update_chapter(p_novel_slug text, p_chapter_number int, p_data jsonb)` — updates a chapter.
- `admin_delete_chapter(p_novel_slug text, p_chapter_number int)` — deletes a chapter.
- `admin_create_genre(p_name text, p_slug text)` — creates a genre.
- `admin_update_genre(p_id uuid, p_name text, p_slug text)` — updates a genre.
- `admin_delete_genre(p_id uuid)` — deletes a genre.
- `admin_ensure_tags(p_names text[])` — upserts tags by slug.
- `admin_increment_views(p_slug text)` — increments novel views (public, no auth needed).

## Security Notes
1. **Public SELECT retained**: anon and authenticated can read all
   content (novels, chapters, genres, tags, link tables). This is
   intentional — the site is a public reading platform.
2. **No anon writes**: all INSERT/UPDATE/DELETE policies for
   anon/authenticated are dropped. Writes only succeed through the
   SECURITY DEFINER functions, which check the admin token.
3. **Token validation**: every admin function calls
   `admin_verify_token(p_token)` and raises `Not authorized` if it
   returns `valid = false`. The token is passed as the first
   parameter by the frontend.
4. **Search path**: all SECURITY DEFINER functions set
   `SET search_path = public` to prevent search-path injection.
5. **EXECUTE grants**: admin mutation functions are granted to
   anon and authenticated (the frontend uses the anon key), but
   they are safe because the function body validates the admin
   token before any operation.
6. **auto_publish_chapters**: already had search_path set; kept as-is.
*/

-- ─── Helper: validate admin token, raise if invalid ───
CREATE OR REPLACE FUNCTION admin_require_auth(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_user_id uuid;
BEGIN
  SELECT admin_verify_token(p_token) INTO v_result;
  IF NOT COALESCE((v_result->>'valid')::boolean, false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  v_user_id := NULLIF(v_result->>'user', '')::jsonb->>'id';
  v_user_id := (v_result->'user'->>'id')::uuid;
  RETURN v_user_id;
END;
$$;

-- ═══ Novels ═══

DROP POLICY IF EXISTS "anon_insert_novels" ON novels;
DROP POLICY IF EXISTS "anon_update_novels" ON novels;
DROP POLICY IF EXISTS "anon_delete_novels" ON novels;

-- Keep: public read
DROP POLICY IF EXISTS "anon_read_novels" ON novels;
CREATE POLICY "anon_read_novels" ON novels FOR SELECT
  TO anon, authenticated USING (true);

-- ═══ Chapters ═══

DROP POLICY IF EXISTS "anon_insert_chapters" ON chapters;
DROP POLICY IF EXISTS "anon_update_chapters" ON chapters;
DROP POLICY IF EXISTS "anon_delete_chapters" ON chapters;

DROP POLICY IF EXISTS "anon_read_chapters" ON chapters;
CREATE POLICY "anon_read_chapters" ON chapters FOR SELECT
  TO anon, authenticated USING (true);

-- ═══ Genres ═══

DROP POLICY IF EXISTS "anon_insert_genres" ON genres;
DROP POLICY IF EXISTS "anon_update_genres" ON genres;
DROP POLICY IF EXISTS "anon_delete_genres" ON genres;

DROP POLICY IF EXISTS "anon_read_genres" ON genres;
CREATE POLICY "anon_read_genres" ON genres FOR SELECT
  TO anon, authenticated USING (true);

-- ═══ Tags ═══

DROP POLICY IF EXISTS "anon_insert_tags" ON tags;
DROP POLICY IF EXISTS "anon_update_tags" ON tags;
DROP POLICY IF EXISTS "anon_delete_tags" ON tags;

DROP POLICY IF EXISTS "anon_read_tags" ON tags;
CREATE POLICY "anon_read_tags" ON tags FOR SELECT
  TO anon, authenticated USING (true);

-- ═══ novel_genres ═══

DROP POLICY IF EXISTS "anon_insert_novel_genres" ON novel_genres;
DROP POLICY IF EXISTS "anon_update_novel_genres" ON novel_genres;
DROP POLICY IF EXISTS "anon_delete_novel_genres" ON novel_genres;

DROP POLICY IF EXISTS "anon_read_novel_genres" ON novel_genres;
CREATE POLICY "anon_read_novel_genres" ON novel_genres FOR SELECT
  TO anon, authenticated USING (true);

-- ═══ novel_tags ═══

DROP POLICY IF EXISTS "anon_insert_novel_tags" ON novel_tags;
DROP POLICY IF EXISTS "anon_update_novel_tags" ON novel_tags;
DROP POLICY IF EXISTS "anon_delete_novel_tags" ON novel_tags;

DROP POLICY IF EXISTS "anon_read_novel_tags" ON novel_tags;
CREATE POLICY "anon_read_novel_tags" ON novel_tags FOR SELECT
  TO anon, authenticated USING (true);

-- ═══ profiles: remove write policies (no user signup in this app) ═══

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
DROP POLICY IF EXISTS "update_own_profile" ON profiles;

-- ═══════════════════════════════════════════════════
-- SECURITY DEFINER mutation functions
-- ═══════════════════════════════════════════════════

-- ─── Ensure tags exist (upsert by slug) ───
CREATE OR REPLACE FUNCTION admin_ensure_tags(p_token text, p_names text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- ─── Create novel ───
CREATE OR REPLACE FUNCTION admin_create_novel(p_token text, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_novel_id uuid;
  v_genre_name text;
  v_genre_id uuid;
  v_tag_name text;
  v_tag_id uuid;
  v_result jsonb;
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

  -- Link genres
  IF p_data ? 'genres' THEN
    FOREACH v_genre_name IN ARRAY (p_data->'genres')::text[] LOOP
      SELECT id INTO v_genre_id FROM genres WHERE name = v_genre_name LIMIT 1;
      IF v_genre_id IS NOT NULL THEN
        INSERT INTO novel_genres (novel_id, genre_id) VALUES (v_novel_id, v_genre_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- Link tags
  IF p_data ? 'tags' THEN
    PERFORM admin_ensure_tags(p_token, (p_data->'tags')::text[]);
    FOREACH v_tag_name IN ARRAY (p_data->'tags')::text[] LOOP
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
$$;

-- ─── Update novel ───
CREATE OR REPLACE FUNCTION admin_update_novel(p_token text, p_slug text, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_novel_id uuid;
  v_genre_name text;
  v_genre_id uuid;
  v_tag_name text;
  v_tag_id uuid;
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

  -- Re-link genres
  IF p_data ? 'genres' THEN
    DELETE FROM novel_genres WHERE novel_id = v_novel_id;
    FOREACH v_genre_name IN ARRAY (p_data->'genres')::text[] LOOP
      SELECT id INTO v_genre_id FROM genres WHERE name = v_genre_name LIMIT 1;
      IF v_genre_id IS NOT NULL THEN
        INSERT INTO novel_genres (novel_id, genre_id) VALUES (v_novel_id, v_genre_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- Re-link tags
  IF p_data ? 'tags' THEN
    DELETE FROM novel_tags WHERE novel_id = v_novel_id;
    PERFORM admin_ensure_tags(p_token, (p_data->'tags')::text[]);
    FOREACH v_tag_name IN ARRAY (p_data->'tags')::text[] LOOP
      SELECT id INTO v_tag_id FROM tags WHERE slug = slugify(v_tag_name) LIMIT 1;
      IF v_tag_id IS NOT NULL THEN
        INSERT INTO novel_tags (novel_id, tag_id) VALUES (v_novel_id, v_tag_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
END;
$$;

-- ─── Delete novel ───
CREATE OR REPLACE FUNCTION admin_delete_novel(p_token text, p_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM admin_require_auth(p_token);
  DELETE FROM novels WHERE slug = p_slug;
END;
$$;

-- ─── Create chapter ───
CREATE OR REPLACE FUNCTION admin_create_chapter(p_token text, p_novel_slug text, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    (p_data->'content')::text[],
    COALESCE(p_data->>'published_at', ''),
    COALESCE(p_data->>'status', 'published'),
    COALESCE((p_data->>'published')::boolean, false),
    NULLIF(p_data->>'publish_at', '')
  )
  RETURNING id INTO v_chapter_id;

  RETURN jsonb_build_object('id', v_chapter_id);
END;
$$;

-- ─── Update chapter ───
CREATE OR REPLACE FUNCTION admin_update_chapter(p_token text, p_novel_slug text, p_chapter_number int, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    content = CASE WHEN p_data ? 'content' THEN (p_data->'content')::text[] ELSE content END,
    published_at = CASE WHEN p_data ? 'published_at' THEN p_data->>'published_at' ELSE published_at END,
    number = CASE WHEN p_data ? 'number' THEN (p_data->>'number')::int ELSE number END,
    status = CASE WHEN p_data ? 'status' THEN p_data->>'status' ELSE status END,
    published = CASE WHEN p_data ? 'published' THEN (p_data->>'published')::boolean ELSE published END,
    publish_at = CASE WHEN p_data ? 'publish_at' THEN NULLIF(p_data->>'publish_at', '') ELSE publish_at END
  WHERE novel_id = v_novel_id AND number = p_chapter_number;
END;
$$;

-- ─── Delete chapter ───
CREATE OR REPLACE FUNCTION admin_delete_chapter(p_token text, p_novel_slug text, p_chapter_number int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_novel_id uuid;
BEGIN
  PERFORM admin_require_auth(p_token);

  SELECT id INTO v_novel_id FROM novels WHERE slug = p_novel_slug;
  IF v_novel_id IS NULL THEN
    RAISE EXCEPTION 'Novel not found';
  END IF;

  DELETE FROM chapters WHERE novel_id = v_novel_id AND number = p_chapter_number;
END;
$$;

-- ─── Create genre ───
CREATE OR REPLACE FUNCTION admin_create_genre(p_token text, p_name text, p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- ─── Update genre ───
CREATE OR REPLACE FUNCTION admin_update_genre(p_token text, p_id uuid, p_name text, p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM admin_require_auth(p_token);

  IF trim(p_name) = '' THEN RAISE EXCEPTION 'Name is required'; END IF;
  IF trim(p_slug) = '' THEN RAISE EXCEPTION 'Slug is required'; END IF;

  UPDATE genres SET name = trim(p_name), slug = trim(p_slug) WHERE id = p_id
  RETURNING id, name, slug AS slug INTO p_id, p_name, p_slug;

  RETURN jsonb_build_object('id', p_id, 'name', p_name, 'slug', p_slug);
END;
$$;

-- ─── Delete genre ───
CREATE OR REPLACE FUNCTION admin_delete_genre(p_token text, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM admin_require_auth(p_token);
  DELETE FROM genres WHERE id = p_id;
END;
$$;

-- ─── Increment views (public, no auth) ───
CREATE OR REPLACE FUNCTION admin_increment_views(p_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE novels SET views = views + 1 WHERE slug = p_slug;
END;
$$;

-- ═══ Grant EXECUTE on public/admin functions ═══
GRANT EXECUTE ON FUNCTION admin_require_auth(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_create_novel(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_update_novel(text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_novel(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_create_chapter(text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_update_chapter(text, text, int, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_chapter(text, text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_create_genre(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_update_genre(text, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_genre(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_ensure_tags(text, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_increment_views(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION slugify(text) TO anon, authenticated;
