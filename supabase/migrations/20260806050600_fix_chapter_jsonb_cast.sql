-- Fix: same jsonb-to-text[] cast issue in chapter functions.
-- (p_data->'content')::text[] fails; use ARRAY(SELECT jsonb_array_elements_text(...))

CREATE OR REPLACE FUNCTION admin_create_chapter(p_token text, p_novel_slug text, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
DECLARE
  v_novel_id uuid;
  v_chapter_id uuid;
  v_content text[];
BEGIN
  PERFORM admin_require_auth(p_token);

  SELECT id INTO v_novel_id FROM novels WHERE slug = p_novel_slug;
  IF v_novel_id IS NULL THEN
    RAISE EXCEPTION 'Novel not found';
  END IF;

  v_content := ARRAY(SELECT jsonb_array_elements_text(p_data->'content'));

  INSERT INTO chapters (
    novel_id, number, title, content, published_at, status, published, publish_at
  ) VALUES (
    v_novel_id,
    (p_data->>'number')::int,
    p_data->>'title',
    v_content,
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
  v_content text[];
BEGIN
  PERFORM admin_require_auth(p_token);

  SELECT id INTO v_novel_id FROM novels WHERE slug = p_novel_slug;
  IF v_novel_id IS NULL THEN
    RAISE EXCEPTION 'Novel not found';
  END IF;

  IF p_data ? 'content' THEN
    v_content := ARRAY(SELECT jsonb_array_elements_text(p_data->'content'));
  END IF;

  UPDATE chapters SET
    title = CASE WHEN p_data ? 'title' THEN p_data->>'title' ELSE title END,
    content = CASE WHEN p_data ? 'content' THEN v_content ELSE content END,
    published_at = CASE WHEN p_data ? 'published_at' THEN p_data->>'published_at' ELSE published_at END,
    number = CASE WHEN p_data ? 'number' THEN (p_data->>'number')::int ELSE number END,
    status = CASE WHEN p_data ? 'status' THEN p_data->>'status' ELSE status END,
    published = CASE WHEN p_data ? 'published' THEN (p_data->>'published')::boolean ELSE published END,
    publish_at = CASE WHEN p_data ? 'publish_at' THEN NULLIF(p_data->>'publish_at', '') ELSE publish_at END
  WHERE novel_id = v_novel_id AND number = p_chapter_number;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_create_chapter(text, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION admin_update_chapter(text, text, integer, jsonb) TO anon;
