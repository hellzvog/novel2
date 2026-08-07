-- Fix: admin CRUD functions have SET search_path TO 'public' but call
-- gen_random_bytes() which lives in the `extensions` schema. Add
-- `extensions` to the search_path of every affected function.
-- Only the search_path clause changes; function bodies are preserved
-- exactly as they were (including return types).

CREATE OR REPLACE FUNCTION admin_create_novel(p_token text, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
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

  IF p_data ? 'genres' THEN
    FOREACH v_genre_name IN ARRAY (p_data->'genres')::text[] LOOP
      SELECT id INTO v_genre_id FROM genres WHERE name = v_genre_name LIMIT 1;
      IF v_genre_id IS NOT NULL THEN
        INSERT INTO novel_genres (novel_id, genre_id) VALUES (v_novel_id, v_genre_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

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

CREATE OR REPLACE FUNCTION admin_update_novel(p_token text, p_slug text, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
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

CREATE OR REPLACE FUNCTION admin_delete_novel(p_token text, p_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
BEGIN
  PERFORM admin_require_auth(p_token);
  DELETE FROM novels WHERE slug = p_slug;
END;
$$;

CREATE OR REPLACE FUNCTION admin_create_chapter(p_token text, p_novel_slug text, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
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

CREATE OR REPLACE FUNCTION admin_update_chapter(p_token text, p_novel_slug text, p_chapter_number integer, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
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

CREATE OR REPLACE FUNCTION admin_delete_chapter(p_token text, p_novel_slug text, p_chapter_number integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
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

CREATE OR REPLACE FUNCTION admin_ensure_tags(p_token text, p_names text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
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

CREATE OR REPLACE FUNCTION admin_create_genre(p_token text, p_name text, p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
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

-- admin_update_genre returns jsonb (not void) — preserve that.
CREATE OR REPLACE FUNCTION admin_update_genre(p_token text, p_id uuid, p_name text, p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
BEGIN
  PERFORM admin_require_auth(p_token);

  IF trim(p_name) = '' THEN RAISE EXCEPTION 'Name is required'; END IF;
  IF trim(p_slug) = '' THEN RAISE EXCEPTION 'Slug is required'; END IF;

  UPDATE genres SET name = trim(p_name), slug = trim(p_slug) WHERE id = p_id
  RETURNING id, name, slug INTO p_id, p_name, p_slug;

  RETURN jsonb_build_object('id', p_id, 'name', p_name, 'slug', p_slug);
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_genre(p_token text, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
BEGIN
  PERFORM admin_require_auth(p_token);
  DELETE FROM genres WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_require_auth(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
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
$$;

-- Re-grant EXECUTE to anon for all admin CRUD functions.
GRANT EXECUTE ON FUNCTION admin_create_novel(text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION admin_update_novel(text, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION admin_delete_novel(text, text) TO anon;
GRANT EXECUTE ON FUNCTION admin_create_chapter(text, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION admin_update_chapter(text, text, integer, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION admin_delete_chapter(text, text, integer) TO anon;
GRANT EXECUTE ON FUNCTION admin_ensure_tags(text, text[]) TO anon;
GRANT EXECUTE ON FUNCTION admin_create_genre(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION admin_update_genre(text, uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION admin_delete_genre(text, uuid) TO anon;
