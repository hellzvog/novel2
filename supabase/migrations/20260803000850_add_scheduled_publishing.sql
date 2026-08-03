/*
# Add Scheduled Chapter Publishing

## Overview
Adds support for scheduling chapter publication. Chapters can now be:
- Published immediately (published=true, publish_at=now)
- Scheduled for future publication (published=false, publish_at=future timestamp)
- Auto-published when their publish_at time arrives (via RPC called on page load + edge function)

## Changes to existing tables

1. `chapters` table — two new columns:
   - `published` (boolean, NOT NULL, DEFAULT false)
     - When true, the chapter is visible to readers.
     - When false, the chapter is hidden from the public frontend.
   - `publish_at` (timestamptz, nullable)
     - When set to a future timestamp, the chapter is scheduled.
     - When set to a past/current timestamp, the chapter should be auto-published.
     - When null, the chapter's visibility is controlled solely by `published`.

2. Backfill logic:
   - All existing chapters are set to `published = true` so current content
     remains visible after the migration. This preserves existing behavior.

## New functions

1. `auto_publish_chapters()` — SECURITY DEFINER function
   - Updates all chapters where `published = false` AND `publish_at IS NOT NULL`
     AND `publish_at <= now()` to `published = true`.
   - Returns the count of newly published chapters.
   - Called by the frontend on page load and by a scheduled edge function.

## Security
- No RLS policy changes needed — existing anon/authenticated full CRUD
  policies remain. The `published` and `publish_at` columns inherit the
  same access as other chapter columns.
- `auto_publish_chapters()` is SECURITY DEFINER so it can update rows
  without needing per-row policy checks. It is callable by anon/authenticated.
*/

-- Add published column (default false, then backfill existing rows to true)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chapters' AND column_name = 'published'
  ) THEN
    ALTER TABLE chapters ADD COLUMN published boolean NOT NULL DEFAULT false;
    -- Backfill: all existing chapters become published
    UPDATE chapters SET published = true;
  END IF;
END $$;

-- Add publish_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chapters' AND column_name = 'publish_at'
  ) THEN
    ALTER TABLE chapters ADD COLUMN publish_at timestamptz;
  END IF;
END $$;

-- Index for efficient auto-publish queries
CREATE INDEX IF NOT EXISTS idx_chapters_publish_at
  ON chapters (publish_at)
  WHERE published = false AND publish_at IS NOT NULL;

-- Auto-publish function: promotes scheduled chapters whose time has arrived
CREATE OR REPLACE FUNCTION auto_publish_chapters()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  published_count integer;
BEGIN
  UPDATE chapters
  SET published = true
  WHERE published = false
    AND publish_at IS NOT NULL
    AND publish_at <= now();

  GET DIAGNOSTICS published_count = ROW_COUNT;
  RETURN published_count;
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION auto_publish_chapters() TO anon, authenticated;
