-- Fix: chapters.content is jsonb, not text[]. Pass p_data->'content'
-- directly. chapters.published_at is a date column, so empty strings
-- must become NULL.

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
    p_data->'content',
    NULLIF(p_data->>'published_at', '')::date,
    COALESCE(p_data->>'status', 'published'),
    COALESCE((p_data->>'published')::boolean, false),
    NULLIF(p_data->>'publish_at', '')::timestamptz
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
    content = CASE WHEN p_data ? 'content' THEN p_data->'content' ELSE content END,
    published_at = CASE WHEN p_data ? 'published_at' THEN NULLIF(p_data->>'published_at', '')::date ELSE published_at END,
    number = CASE WHEN p_data ? 'number' THEN (p_data->>'number')::int ELSE number END,
    status = CASE WHEN p_data ? 'status' THEN p_data->>'status' ELSE status END,
    published = CASE WHEN p_data ? 'published' THEN (p_data->>'published')::boolean ELSE published END,
    publish_at = CASE WHEN p_data ? 'publish_at' THEN NULLIF(p_data->>'publish_at', '')::timestamptz ELSE publish_at END
  WHERE novel_id = v_novel_id AND number = p_chapter_number;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_create_chapter(text, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION admin_update_chapter(text, text, integer, jsonb) TO anon;
