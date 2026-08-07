-- Efficient bulk chapter count query for the CMS novel list.
-- Returns counts for ALL chapters (published + draft + scheduled) per novel.
-- Avoids N+1 queries when displaying chapter counts across many novels.

CREATE OR REPLACE FUNCTION get_novel_chapter_counts()
RETURNS TABLE(novel_id uuid, chapter_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT novel_id, COUNT(*)::bigint AS chapter_count
  FROM chapters
  GROUP BY novel_id;
$$;

GRANT EXECUTE ON FUNCTION get_novel_chapter_counts() TO anon, authenticated;