/*
# SEC-01B: Public Database & Storage Security Lockdown

## Purpose
Locks down public access so that:
- Only PUBLISHED chapters are readable by public roles.
- Profiles are no longer directly readable.
- Direct novels.views UPDATE is removed.
- View incrementing works only through a hardened SECURITY DEFINER RPC.
- Excess table privileges are removed from public content tables.
- Unused chapter-count RPC is no longer publicly executable.
- Authenticated users can no longer write/delete novel cover storage objects.

## Security Changes

### 1. chapters RLS
- `anon_read_chapters` replaced: `USING (published = true)` instead of `USING (true)`.
- Draft/Scheduled chapters are now invisible to public roles.
- Admin access to unpublished chapters is via SEC-01A SECURITY DEFINER RPCs.

### 2. profiles RLS & privileges
- `read_profiles` policy dropped.
- ALL table privileges revoked from anon and authenticated on profiles.
- No replacement public profile policy created.

### 3. Public content table grants locked
- novels, chapters, genres, tags, novel_genres, novel_tags:
  anon/authenticated retain SELECT only.
  INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER revoked.

### 4. novels.views column-level UPDATE removed
- REVOKE UPDATE (views) FROM anon, authenticated on novels.

### 5. anon_increment_views policy removed
- Dropped entirely. No direct UPDATE route to novels for public roles.

### 6. admin_increment_views hardened
- Recreated as SECURITY DEFINER with SET search_path = ''.
- Fully qualified public.novels reference.
- EXECUTE revoked from PUBLIC, granted to anon, authenticated, service_role.
- No admin token required (public readers need to increment views).
- Security comes from the narrowly scoped function body.

### 7. get_novel_chapter_counts public execution removed
- EXECUTE revoked from PUBLIC, anon, authenticated.
- service_role retains EXECUTE.

### 8. Storage novel-covers write lockdown
- insert_covers, update_covers, delete_covers policies dropped.
- read_covers policy kept unchanged.

## No Changes To
- No RLS policies on novels, genres, tags, novel_genres, novel_tags.
- No admin token-protected RPC permissions (SEC-01A functions unchanged).
- No auto-publish behavior.
- No scheduling behavior.
- No data modified or deleted.
- No schema columns changed.
- No storage bucket settings changed.
- No storage.objects base table grants changed.
*/

-- ═══════════════════════════════════════════════════════════
-- 1. CHAPTERS — restrict public SELECT to published only
-- ═══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "anon_read_chapters" ON public.chapters;
CREATE POLICY "anon_read_chapters" ON public.chapters FOR SELECT
  TO anon, authenticated USING (published = true);

-- ═══════════════════════════════════════════════════════════
-- 2. PROFILES — remove all public access
-- ═══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "read_profiles" ON public.profiles;
REVOKE ALL PRIVILEGES ON public.profiles FROM anon;
REVOKE ALL PRIVILEGES ON public.profiles FROM authenticated;

-- ═══════════════════════════════════════════════════════════
-- 3. PUBLIC CONTENT TABLE GRANTS — SELECT only
-- ═══════════════════════════════════════════════════════════

-- novels
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.novels FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.novels FROM authenticated;
GRANT SELECT ON public.novels TO anon;
GRANT SELECT ON public.novels TO authenticated;

-- chapters
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.chapters FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.chapters FROM authenticated;
GRANT SELECT ON public.chapters TO anon;
GRANT SELECT ON public.chapters TO authenticated;

-- genres
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.genres FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.genres FROM authenticated;
GRANT SELECT ON public.genres TO anon;
GRANT SELECT ON public.genres TO authenticated;

-- tags
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.tags FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.tags FROM authenticated;
GRANT SELECT ON public.tags TO anon;
GRANT SELECT ON public.tags TO authenticated;

-- novel_genres
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.novel_genres FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.novel_genres FROM authenticated;
GRANT SELECT ON public.novel_genres TO anon;
GRANT SELECT ON public.novel_genres TO authenticated;

-- novel_tags
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.novel_tags FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.novel_tags FROM authenticated;
GRANT SELECT ON public.novel_tags TO anon;
GRANT SELECT ON public.novel_tags TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- 4. NOVELS.VIEWS column-level UPDATE removed
-- ═══════════════════════════════════════════════════════════

REVOKE UPDATE (views) ON public.novels FROM anon;
REVOKE UPDATE (views) ON public.novels FROM authenticated;

-- ═══════════════════════════════════════════════════════════
-- 5. Remove permissive anon_increment_views policy
-- ═══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "anon_increment_views" ON public.novels;

-- ═══════════════════════════════════════════════════════════
-- 6. Harden admin_increment_views as SECURITY DEFINER
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_increment_views(p_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.novels SET views = views + 1 WHERE slug = p_slug;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_increment_views(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_increment_views(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_increment_views(text) TO service_role;

-- ═══════════════════════════════════════════════════════════
-- 7. Disable public execution of get_novel_chapter_counts
-- ═══════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.get_novel_chapter_counts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_novel_chapter_counts() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_novel_chapter_counts() FROM authenticated;

-- ═══════════════════════════════════════════════════════════
-- 8. Storage — remove authenticated cover write policies
-- ═══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "insert_covers" ON storage.objects;
DROP POLICY IF EXISTS "update_covers" ON storage.objects;
DROP POLICY IF EXISTS "delete_covers" ON storage.objects;
