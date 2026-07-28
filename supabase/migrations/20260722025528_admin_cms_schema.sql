/*
# Admin CMS schema additions

## Overview
Adds the schema pieces needed for the Admin CMS:
1. A `profiles` table linked to auth.users with an `is_admin` flag.
2. An `alt_title` column and a `cover_url` column on novels (for cover image uploads).
3. A `status` column on chapters supporting 'published' | 'draft'.
4. A storage bucket for novel cover images.

## New Tables
- `profiles`
  - `id` (uuid, primary key, references auth.users)
  - `email` (text)
  - `is_admin` (boolean, default false)
  - `created_at` (timestamptz)

## Modified Tables
- `novels`: adds `alt_title` (text, nullable) and `cover_url` (text, nullable).
- `chapters`: adds `status` column (text, default 'published') — values 'published' | 'draft'.

## Security
- `profiles` RLS enabled. Anyone can read profiles (to check is_admin). Only the user themselves can update their own profile. Inserts handled by a trigger on auth.users.
- A trigger auto-creates a profile row when a new auth.user signs up.
- Storage bucket `novel-covers` is public-read, authenticated-write.
*/

-- profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_profiles" ON profiles;
CREATE POLICY "read_profiles" ON profiles FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, is_admin)
  VALUES (NEW.id, NEW.email, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Add alt_title and cover_url to novels
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'novels' AND column_name = 'alt_title') THEN
    ALTER TABLE novels ADD COLUMN alt_title text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'novels' AND column_name = 'cover_url') THEN
    ALTER TABLE novels ADD COLUMN cover_url text;
  END IF;
END $$;

-- Add status to chapters
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chapters' AND column_name = 'status') THEN
    ALTER TABLE chapters ADD COLUMN status text NOT NULL DEFAULT 'published';
  END IF;
END $$;

-- Storage bucket for covers (public read, auth write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('novel-covers', 'novel-covers', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "read_covers" ON storage.objects;
CREATE POLICY "read_covers" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'novel-covers');
DROP POLICY IF EXISTS "insert_covers" ON storage.objects;
CREATE POLICY "insert_covers" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'novel-covers');
DROP POLICY IF EXISTS "update_covers" ON storage.objects;
CREATE POLICY "update_covers" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'novel-covers') WITH CHECK (bucket_id = 'novel-covers');
DROP POLICY IF EXISTS "delete_covers" ON storage.objects;
CREATE POLICY "delete_covers" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'novel-covers');
