/*
# Allow anon role to upload to novel-covers bucket

## Overview
The admin CMS uses custom token-based authentication, not Supabase's built-in
auth. This means the Supabase client always runs as the `anon` role even when
an admin is logged in. The existing INSERT/UPDATE/DELETE policies on
storage.objects required `authenticated`, blocking cover image uploads.

## Changes
- Drop and recreate the INSERT, UPDATE, and DELETE policies on storage.objects
  for the `novel-covers` bucket to include the `anon` role alongside `authenticated`.
- SELECT (public read) policy is unchanged.
*/

DROP POLICY IF EXISTS "insert_covers" ON storage.objects;
CREATE POLICY "insert_covers" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'novel-covers');

DROP POLICY IF EXISTS "update_covers" ON storage.objects;
CREATE POLICY "update_covers" ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'novel-covers')
  WITH CHECK (bucket_id = 'novel-covers');

DROP POLICY IF EXISTS "delete_covers" ON storage.objects;
CREATE POLICY "delete_covers" ON storage.objects FOR DELETE
  TO anon, authenticated USING (bucket_id = 'novel-covers');
