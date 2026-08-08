/*
# Remove anon write access from novel-covers storage bucket

## Overview
Cover image uploads now go through the `secure-cover-upload` Edge Function,
which verifies the admin token via the `admin_verify_token` RPC and then
uploads using the `SUPABASE_SERVICE_ROLE_KEY` (bypassing RLS entirely).
This makes direct browser-to-storage writes unnecessary and insecure —
anyone with the anon key could upload, modify, or delete cover images.

## Changes
1. Recreate the INSERT, UPDATE, and DELETE policies on `storage.objects`
   for the `novel-covers` bucket so they are scoped to `authenticated` only
   (removing `anon`).
2. The public SELECT policy (`read_covers`) remains unchanged — cover images
   are public assets and must be readable by anonymous visitors.
3. The Edge Function uses the service role key, which bypasses RLS, so
   admin-initiated uploads continue to work without any anon write grant.

## Security Impact
- Anonymous users can no longer INSERT, UPDATE, or DELETE objects in the
  `novel-covers` bucket.
- Only authenticated Supabase users (and the service role used by the Edge
  Function) can write to the bucket.
- Public reads of cover images are unaffected.
*/

DROP POLICY IF EXISTS "insert_covers" ON storage.objects;
CREATE POLICY "insert_covers" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'novel-covers'
    AND lower(storage.extension(name)) = ANY (ARRAY['jpg', 'jpeg', 'png', 'webp'])
  );

DROP POLICY IF EXISTS "update_covers" ON storage.objects;
CREATE POLICY "update_covers" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'novel-covers')
  WITH CHECK (
    bucket_id = 'novel-covers'
    AND lower(storage.extension(name)) = ANY (ARRAY['jpg', 'jpeg', 'png', 'webp'])
  );

DROP POLICY IF EXISTS "delete_covers" ON storage.objects;
CREATE POLICY "delete_covers" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'novel-covers');
