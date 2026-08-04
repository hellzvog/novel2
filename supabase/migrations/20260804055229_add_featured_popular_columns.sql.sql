/*
# Add featured and popular columns to novels

## Overview
Adds four new columns to the `novels` table to support manual editorial
control over which novels appear in the homepage Hero Banner and the
Popular Novels section.

## New Columns (on `novels` table)

1. `featured` (boolean, default false)
   - When true, the novel is eligible for the homepage Hero Banner.
2. `featured_at` (timestamptz, nullable)
   - Timestamp recording when the novel was marked featured.
   - Set to `now()` when featured is turned on, NULL when turned off.
   - Used to ORDER BY so the most recently featured novels appear first.
3. `popular` (boolean, default false)
   - When true, the novel appears in the homepage Popular Novels section.
4. `popular_at` (timestamptz, nullable)
   - Timestamp recording when the novel was marked popular.
   - Set to `now()` when popular is turned on, NULL when turned off.
   - Used to ORDER BY so the most recently marked popular novels appear first.

## Indexes
- `idx_novels_featured` on (featured, featured_at) for fast Hero queries
- `idx_novels_popular` on (popular, popular_at) for fast Popular queries

## Security
- No RLS policy changes. The existing anon+authenticated full CRUD
  policies on `novels` already cover the new columns.

## Notes
1. The frontend queries `featured = true ORDER BY featured_at DESC LIMIT 6`
   for the Hero Banner, and `popular = true ORDER BY popular_at DESC`
   for the Popular section.
2. If more than 6 novels are featured, only the 6 newest (by featured_at)
   appear in the Hero; older featured novels are automatically excluded.
3. All columns are nullable/defaulted so existing rows are unaffected.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'novels' AND column_name = 'featured'
  ) THEN
    ALTER TABLE novels ADD COLUMN featured boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'novels' AND column_name = 'featured_at'
  ) THEN
    ALTER TABLE novels ADD COLUMN featured_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'novels' AND column_name = 'popular'
  ) THEN
    ALTER TABLE novels ADD COLUMN popular boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'novels' AND column_name = 'popular_at'
  ) THEN
    ALTER TABLE novels ADD COLUMN popular_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_novels_featured ON novels(featured, featured_at DESC);
CREATE INDEX IF NOT EXISTS idx_novels_popular ON novels(popular, popular_at DESC);
