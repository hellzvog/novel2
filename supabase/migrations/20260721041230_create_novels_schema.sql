/*
# Create novel reading platform schema

## Overview
Creates the full database schema for a novel reading platform: genres, tags,
novels, chapters, and the join tables linking novels to genres and tags.
This is a single-tenant, no-auth app (public read/write) so the frontend
using the anon key can read and manage all data.

## New Tables

1. `genres`
   - `id` (uuid, primary key)
   - `name` (text, unique, not null) — e.g. "Fantasy"
   - `slug` (text, unique, not null) — URL-friendly key
   - `created_at` (timestamptz)

2. `tags`
   - `id` (uuid, primary key)
   - `name` (text, unique, not null)
   - `slug` (text, unique, not null)
   - `created_at` (timestamptz)

3. `novels`
   - `id` (uuid, primary key)
   - `slug` (text, unique, not null) — URL-friendly identifier
   - `title` (text, not null)
   - `author` (text, not null)
   - `status` (text, not null) — 'Ongoing' | 'Completed' | 'Hiatus'
   - `rating` (numeric, default 0)
   - `views` (bigint, default 0)
   - `synopsis` (text, not null)
   - `cover_hue` (integer, default 0) — palette index for generated cover
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)

4. `chapters`
   - `id` (uuid, primary key)
   - `novel_id` (uuid, references novels, on delete cascade)
   - `number` (integer, not null)
   - `title` (text, not null)
   - `content` (jsonb, not null) — array of paragraph strings
   - `published_at` (date)
   - `created_at` (timestamptz)
   - Unique constraint on (novel_id, number)

5. `novel_genres` (join table)
   - `novel_id` (uuid, references novels, on delete cascade)
   - `genre_id` (uuid, references genres, on delete cascade)
   - Primary key (novel_id, genre_id)

6. `novel_tags` (join table)
   - `novel_id` (uuid, references novels, on delete cascade)
   - `tag_id` (uuid, references tags, on delete cascade)
   - Primary key (novel_id, tag_id)

## Indexes
- `chapters.novel_id` for listing chapters by novel
- `novels.status` for status filtering
- `novels.slug` for slug lookups (covered by unique index)

## Security (RLS)
- All tables have RLS enabled.
- All tables allow anon + authenticated full CRUD because this is a
  single-tenant public prototype with no sign-in flow.
- Policies: separate SELECT / INSERT / UPDATE / DELETE per table.
*/

-- Genres
CREATE TABLE IF NOT EXISTS genres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE genres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_genres" ON genres;
CREATE POLICY "anon_read_genres" ON genres FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_genres" ON genres;
CREATE POLICY "anon_insert_genres" ON genres FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_genres" ON genres;
CREATE POLICY "anon_update_genres" ON genres FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_genres" ON genres;
CREATE POLICY "anon_delete_genres" ON genres FOR DELETE
  TO anon, authenticated USING (true);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_tags" ON tags;
CREATE POLICY "anon_read_tags" ON tags FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_tags" ON tags;
CREATE POLICY "anon_insert_tags" ON tags FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_tags" ON tags;
CREATE POLICY "anon_update_tags" ON tags FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_tags" ON tags;
CREATE POLICY "anon_delete_tags" ON tags FOR DELETE
  TO anon, authenticated USING (true);

-- Novels
CREATE TABLE IF NOT EXISTS novels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  author text NOT NULL,
  status text NOT NULL DEFAULT 'Ongoing',
  rating numeric(3,1) NOT NULL DEFAULT 0,
  views bigint NOT NULL DEFAULT 0,
  synopsis text NOT NULL DEFAULT '',
  cover_hue integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE novels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_novels" ON novels;
CREATE POLICY "anon_read_novels" ON novels FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_novels" ON novels;
CREATE POLICY "anon_insert_novels" ON novels FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_novels" ON novels;
CREATE POLICY "anon_update_novels" ON novels FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_novels" ON novels;
CREATE POLICY "anon_delete_novels" ON novels FOR DELETE
  TO anon, authenticated USING (true);

-- Chapters
CREATE TABLE IF NOT EXISTS chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id uuid NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  number integer NOT NULL,
  title text NOT NULL,
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_at date,
  created_at timestamptz DEFAULT now(),
  UNIQUE (novel_id, number)
);
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_chapters_novel_id ON chapters(novel_id);
CREATE INDEX IF NOT EXISTS idx_chapters_novel_number ON chapters(novel_id, number);

DROP POLICY IF EXISTS "anon_read_chapters" ON chapters;
CREATE POLICY "anon_read_chapters" ON chapters FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_chapters" ON chapters;
CREATE POLICY "anon_insert_chapters" ON chapters FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_chapters" ON chapters;
CREATE POLICY "anon_update_chapters" ON chapters FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_chapters" ON chapters;
CREATE POLICY "anon_delete_chapters" ON chapters FOR DELETE
  TO anon, authenticated USING (true);

-- Novel-Genres join
CREATE TABLE IF NOT EXISTS novel_genres (
  novel_id uuid NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  genre_id uuid NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (novel_id, genre_id)
);
ALTER TABLE novel_genres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_novel_genres" ON novel_genres;
CREATE POLICY "anon_read_novel_genres" ON novel_genres FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_novel_genres" ON novel_genres;
CREATE POLICY "anon_insert_novel_genres" ON novel_genres FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_novel_genres" ON novel_genres;
CREATE POLICY "anon_update_novel_genres" ON novel_genres FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_novel_genres" ON novel_genres;
CREATE POLICY "anon_delete_novel_genres" ON novel_genres FOR DELETE
  TO anon, authenticated USING (true);

-- Novel-Tags join
CREATE TABLE IF NOT EXISTS novel_tags (
  novel_id uuid NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (novel_id, tag_id)
);
ALTER TABLE novel_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_novel_tags" ON novel_tags;
CREATE POLICY "anon_read_novel_tags" ON novel_tags FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_novel_tags" ON novel_tags;
CREATE POLICY "anon_insert_novel_tags" ON novel_tags FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_novel_tags" ON novel_tags;
CREATE POLICY "anon_update_novel_tags" ON novel_tags FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_novel_tags" ON novel_tags;
CREATE POLICY "anon_delete_novel_tags" ON novel_tags FOR DELETE
  TO anon, authenticated USING (true);

-- updated_at trigger for novels
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_novels_updated_at ON novels;
CREATE TRIGGER trg_novels_updated_at
  BEFORE UPDATE ON novels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
