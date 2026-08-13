/*
# Fix scheduled chapter published_at date

## Root cause
auto_publish_chapters() previously set:
  published_at = COALESCE(published_at, CURRENT_DATE)

For a scheduled chapter, published_at is already populated at CMS
creation/edit time with the calendar date of creation. COALESCE therefore
preserves that stale creation date instead of the scheduled publication
date, so a chapter scheduled days ahead shows an old "Xd ago" date the
moment it becomes public.

## Fix
Derive published_at from the scheduled publication timestamp (publish_at),
converted to the Asia/Jakarta calendar date — matching the timezone the
admin selects the schedule in.

  published_at = (publish_at AT TIME ZONE 'Asia/Jakarta')::date

publish_at is timestamptz, so `AT TIME ZONE 'Asia/Jakarta'` yields a
timestamp without time zone in Jakarta wall-clock, and ::date extracts
the Jakarta calendar date. This avoids the off-by-one error where a
timestamp shortly after midnight Jakarta would otherwise land on the
previous UTC calendar date.

## Scope
- Only the scheduled-promotion UPDATE inside auto_publish_chapters()
  changes. The eligibility conditions (published = false,
  publish_at IS NOT NULL, publish_at <= now()) are unchanged.
- Publish Now is unaffected: it does not flow through this function.
- Already-published historical rows are untouched (the WHERE clause
  only matches published = false).
- No bulk backfill of existing data.
- Signature, return type, SECURITY DEFINER, search_path, and grants
  are preserved.
*/

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
      published_at = (publish_at AT TIME ZONE 'Asia/Jakarta')::date
  WHERE published = false
    AND publish_at IS NOT NULL
    AND publish_at <= now();

  GET DIAGNOSTICS published_count = ROW_COUNT;
  RETURN published_count;
END;
$function$;
