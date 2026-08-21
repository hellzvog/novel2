/*
# Fix admin_dashboard_overview recent_chapters aggregation

## Purpose
The SEC-01A implementation applied LIMIT after jsonb_agg, which did not
safely limit the INPUT rows to the latest 5 chapters before aggregation.

## Fix
Select the latest 5 chapters FIRST (ordered by created_at DESC), THEN
aggregate into JSONB. Empty result returns '[]'::jsonb, not null.

## No Other Changes
- Function signature, return type, SECURITY DEFINER, search_path, token
  validation, chapter_count, user_count, and EXECUTE grants are unchanged.
- No data modified.
- No RLS, table privileges, or storage policies touched.
*/

CREATE OR REPLACE FUNCTION public.admin_dashboard_overview(p_token text)
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
        'title', r.title,
        'number', r.number,
        'status', r.status,
        'created_at', r.created_at,
        'novel_title', r.novel_title
      )
      ORDER BY r.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_recent
  FROM (
    SELECT
      c.title,
      c.number,
      c.status,
      c.created_at,
      n.title AS novel_title
    FROM public.chapters AS c
    JOIN public.novels AS n ON n.id = c.novel_id
    ORDER BY c.created_at DESC
    LIMIT 5
  ) AS r;

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
