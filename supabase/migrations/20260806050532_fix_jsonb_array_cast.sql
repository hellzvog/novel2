-- Fix: jsonb arrays cannot be cast directly to text[] in PostgreSQL.
-- The original functions used (p_data->'genres')::text[] which fails
-- with "cannot cast type jsonb to text[]". Use a LATERAL unnest or
-- array_agg via a helper expression instead.
-- We use: ARRAY(SELECT jsonb_array_elements_text(p_data->'genres'))

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

  -- Link genres
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

  -- Link tags
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
$$;

GRANT EXECUTE ON FUNCTION admin_create_novel(text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION admin_update_novel(text, text, jsonb) TO anon;
