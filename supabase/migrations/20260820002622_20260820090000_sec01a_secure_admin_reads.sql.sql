/*
# SEC-01A: Secure Admin Read Paths

## Purpose
Prepares the Admin CMS to read Draft / Scheduled / unpublished chapter
data through SECURITY DEFINER RPCs (validated by `admin_require_auth`)
so that public RLS can be tightened in SEC-01B without breaking admin
functionality.

This stage does NOT tighten public RLS, revoke table privileges, or
change any existing policy. It is purely additive.

## New Functions

1. `admin_list_chapter_summaries(p_token, p_novel_ids)`
   - Read-only summary of ALL chapters (published/draft/scheduled)
     for the given novel IDs, WITHOUT content.
   - Returns: novel_id, number, title, published_at, status, published,
     publish_at.
   - Ordered by novel_id, number ASC.

2. `admin_list_chapters(p_token, p_novel_id)`
   - Read-only full chapter list for one novel, including content.
   - Returns: id, number, title, content, published_at, status,
     published, publish_at.
   - Ordered by number ASC.

3. `admin_dashboard_overview(p_token)`
   - Returns JSONB with chapter_count (all chapters), user_count
     (profiles), and recent_chapters (max 5 newest by created_at with
     title, number, status, created_at, novel_title).

## Security
- All three functions are SECURITY DEFINER with `SET search_path = ''`.
- All objects are fully qualified with `public.`.
- Each function validates the admin token via
  `PERFORM public.admin_require_auth(p_token)` before returning data.
- EXECUTE is revoked from PUBLIC and granted to anon, authenticated
  (the browser CMS uses the anon/authenticated role; security comes
  from the token validation inside the function).
- `admin_require_auth` itself is NOT modified.

## No Changes To
- No RLS policies changed.
- No table grants changed.
- No storage policies changed.
- No schema columns added/removed.
- No data modified.
*/

-- ═══════════════════════════════════════════════════════════
-- 1. admin_list_chapter_summaries
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_list_chapter_summaries(
  p_token text,
  p_novel_ids uuid[]
)
RETURNS TABLE (
  novel_id uuid,
  number integer,
  title text,
  published_at date,
  status text,
  published boolean,
  publish_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.admin_require_auth(p_token);

  IF p_novel_ids IS NULL OR array_length(p_novel_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.novel_id,
    c.number,
    c.title,
    c.published_at,
    c.status,
    c.published,
    c.publish_at
  FROM public.chapters AS c
  WHERE c.novel_id = ANY(p_novel_ids)
  ORDER BY c.novel_id, c.number ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_chapter_summaries(text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_chapter_summaries(text, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_chapter_summaries(text, uuid[]) TO service_role;

-- ═══════════════════════════════════════════════════════════
-- 2. admin_list_chapters
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_list_chapters(
  p_token text,
  p_novel_id uuid
)
RETURNS TABLE (
  id uuid,
  number integer,
  title text,
  content jsonb,
  published_at date,
  status text,
  published boolean,
  publish_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.admin_require_auth(p_token);

  RETURN QUERY
  SELECT
    c.id,
    c.number,
    c.title,
    c.content,
    c.published_at,
    c.status,
    c.published,
    c.publish_at
  FROM public.chapters AS c
  WHERE c.novel_id = p_novel_id
  ORDER BY c.number ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_chapters(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_chapters(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_chapters(text, uuid) TO service_role;

-- ═══════════════════════════════════════════════════════════
-- 3. admin_dashboard_overview
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_dashboard_overview(
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chapter_count integer;
  v_user_count integer;
  v_recent jsonb;
BEGIN
  PERFORM public.admin_require_auth(p_token);

  SELECT count(*) INTO v_chapter_count FROM public.chapters;

  SELECT count(*) INTO v_user_count FROM public.profiles;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'title', c.title,
        'number', c.number,
        'status', c.status,
        'created_at', c.created_at,
        'novel_title', n.title
      )
      ORDER BY c.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_recent
  FROM public.chapters AS c
  JOIN public.novels AS n ON n.id = c.novel_id
  ORDER BY c.created_at DESC
  LIMIT 5;

  RETURN jsonb_build_object(
    'chapter_count', v_chapter_count,
    'user_count', v_user_count,
    'recent_chapters', v_recent
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_dashboard_overview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_overview(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_overview(text) TO service_role;
