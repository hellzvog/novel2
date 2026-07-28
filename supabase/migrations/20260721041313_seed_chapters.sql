/*
# Seed chapters for all novels

## Overview
Generates chapter rows for every novel using a PL/pgSQL function. Each novel
gets a varying number of chapters (matching the original mock data counts).
Chapter content is a JSONB array of paragraph strings. Idempotent: skips
novels that already have chapters.

## Notes
- Uses a DO block (not a transaction) to loop over novels.
- Chapter content uses a fixed set of sample paragraphs rotated by index.
*/

DO $$
DECLARE
  novel_row RECORD;
  chapter_count integer;
  i integer;
  paras jsonb;
  n_paras integer;
  sample text[] := ARRAY[
    'The wind swept across the barren plateau, carrying with it the scent of distant rain and something older, something that did not belong to this age. Kael pulled his cloak tighter and stared at the horizon where the sky met the broken spires of the old city.',
    'She had been told never to open the door after midnight, but the knocking would not stop. Three slow beats, a pause, then three more. It had gone on for an hour now, patient and relentless, as if whatever stood outside had all the time in the world.',
    'In the year 2147, memory became a currency. You could sell a happy childhood for a month''s rent, trade the face of a lost love for a new identity. Maren had spent most of hers already, and now she sat in the broker''s office trying to remember why she had come.',
    'The sword was not remarkable. Plain steel, a worn grip, a nick on the edge from some forgotten battle. Yet every king who had held it had died within a year, and the kingdom had learned to fear the blade more than the enemies it was forged against.',
    'Letters arrived every Tuesday. They were never addressed to anyone who lived in the house, and they always described, in precise detail, events that had not yet happened. The first one had predicted the fire. The second, the disappearance of the postman.',
    'He woke in a forest he did not recognize, beneath trees whose leaves glowed a faint silver in the dark. His name was the only thing he could remember, and even that felt borrowed, like a coat that did not quite fit.',
    'The city floated above the clouds, tethered by chains the length of cathedrals. Below it, the surface world had forgotten the sky people existed. Above, the sky people had forgotten why they had ever left.',
    'Two strangers met at a train station neither of them remembered arriving at. The trains, according to the schedule board, had not run for forty years. Yet the platform was warm, the lamps were lit, and a voice over the speaker announced a delay.'
  ];
BEGIN
  FOR novel_row IN SELECT id, slug, title FROM novels LOOP
    -- Determine chapter count from the slug
    chapter_count := CASE novel_row.slug
      WHEN 'the-ember-throne' THEN 86
      WHEN 'whispers-of-the-hollow' THEN 64
      WHEN 'starlight-requiem' THEN 120
      WHEN 'the-salt-crown' THEN 42
      WHEN 'paper-lanterns' THEN 38
      WHEN 'iron-and-vellum' THEN 58
      WHEN 'the-ninth-passenger' THEN 29
      WHEN 'garden-of-static' THEN 33
      WHEN 'the-cartographers-daughter' THEN 71
      WHEN 'half-a-moon-of-sorrow' THEN 50
      WHEN 'the-quiet-machine' THEN 47
      WHEN 'ashen-vows' THEN 55
      WHEN 'the-lighthouse-at-the-end' THEN 31
      WHEN 'crimson-ledger' THEN 44
      WHEN 'songs-for-the-drowned' THEN 27
      WHEN 'the-unfinished-map' THEN 36
      WHEN 'velvet-and-iron' THEN 60
      WHEN 'the-last-broadcast' THEN 40
      WHEN 'beneath-the-glass-sea' THEN 33
      WHEN 'the-coin-keeper' THEN 28
      WHEN 'tideborn' THEN 65
      WHEN 'the-wax-garden' THEN 24
      WHEN 'letters-to-a-burning-city' THEN 48
      WHEN 'the-null-knight' THEN 52
      ELSE 10
    END;

    -- Skip if chapters already exist
    IF EXISTS (SELECT 1 FROM chapters WHERE novel_id = novel_row.id) THEN
      CONTINUE;
    END IF;

    FOR i IN 1..chapter_count LOOP
      n_paras := 3 + ((i * 2) % 4);
      SELECT jsonb_build_array(
        sample[((i + 0) % 8) + 1],
        sample[((i + 1) % 8) + 1],
        sample[((i + 2) % 8) + 1],
        sample[((i + 3) % 8) + 1]
      ) INTO paras;
      -- Trim to n_paras
      paras := jsonb_path_query_array(paras, ('$[0 to ' || (n_paras - 1) || ']')::jsonpath);

      INSERT INTO chapters (novel_id, number, title, content, published_at)
      VALUES (
        novel_row.id,
        i,
        novel_row.title || ' — Chapter ' || i,
        paras,
        ('2025-01-01'::date + ((i % 365) || ' days')::interval)::date
      );
    END LOOP;
  END LOOP;
END $$;
